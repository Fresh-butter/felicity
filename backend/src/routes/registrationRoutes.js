// registrationRoutes.js — Organizer-facing routes: list registrations, CSV export, analytics, payment, scan

import express from "express";
import QRCode from "qrcode";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import { findOrganizerAndEvent, computeStatus } from "./eventHelpers.js";
import { sendTicketEmail } from "../utils/mailer.js";

const router = express.Router();

// NOTE: The old POST /:id/register route has been split into two separate files:
// - normalRegistration.js (for normal events with form fields)
// - merchandiseRegistration.js (for merchandise events with stock/pricing)
// This file now only contains organizer-facing routes.

/* ── List Registrations for Event (organizer) ── */
router.get("/:id/registrations", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const result = await findOrganizerAndEvent(request.user.userId, request.params.id);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        const registrations = await Registration.find({ eventId: request.params.id })
            .populate("userId", "firstName lastName email participantType")
            .sort({ registeredAt: -1 });

        response.json(registrations);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Export Registrations as CSV (organizer) ── */
router.get("/:id/registrations/export", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const result = await findOrganizerAndEvent(request.user.userId, request.params.id);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        const event = result.event;

        const registrations = await Registration.find({ eventId: request.params.id })
            .populate("userId", "firstName lastName email participantType contactNumber collegeName");

        // Helper: wrap a value in quotes and escape internal quotes for CSV safety
        const esc = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

        // Build dynamic form-field columns for normal events
        const formFields = (event.customForm || [])
            .sort((a, b) => (a.order || 0) - (b.order || 0));

        // Build dynamic merch-item columns for merchandise events
        const merchItems = (event.merchandiseItems || []);

        // --- Header ---
        const staticHeaders = [
            "Name", "Email", "Participant Type", "College/Org",
            "Contact", "Ticket ID", "Registered At",
            "Payment Status", "Amount Paid (Rs.)",
            "Attended", "Attended At",
        ];
        const formHeaders = formFields.map((f) => f.label);
        const merchHeaders = merchItems.map((m) => m.itemName);

        const headerRow = [...staticHeaders, ...formHeaders, ...merchHeaders]
            .map(esc).join(",");

        // --- Rows ---
        const rows = registrations.map((reg) => {
            const u = reg.userId || {};
            const staticCols = [
                `${u.firstName || ""} ${u.lastName || ""}`.trim(),
                u.email || "",
                u.participantType || "",
                u.collegeName || "",
                u.contactNumber || "",
                reg.ticketId || "",
                reg.registeredAt ? new Date(reg.registeredAt).toLocaleString() : "",
                reg.paymentStatus || "",
                reg.amountPaid ?? 0,
                reg.attended ? "Yes" : "No",
                reg.attendedAt ? new Date(reg.attendedAt).toLocaleString() : "",
            ];

            // Form response columns — keyed by field _id
            const formCols = formFields.map((field) => {
                const val = reg.formResponses?.[field._id.toString()];
                if (Array.isArray(val)) return val.join("; ");
                return val ?? "";
            });

            // Merchandise selection columns — keyed by item _id
            const merchCols = merchItems.map((item) => {
                const sel = reg.merchandiseSelections?.[item._id.toString()];
                if (!sel) return "";
                return sel.optionLabel ? `${sel.optionLabel} (Rs.${sel.price})` : "";
            });

            return [...staticCols, ...formCols, ...merchCols].map(esc).join(",");
        });

        const csv = [headerRow, ...rows].join("\n");

        response.setHeader("Content-Type", "text/csv");
        response.setHeader("Content-Disposition", `attachment; filename="${event.name.replace(/[^a-z0-9]/gi, "_")}_participants.csv"`);
        response.send(csv);
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Registration Analytics (organizer) ── */
router.get("/:id/analytics", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const result = await findOrganizerAndEvent(request.user.userId, request.params.id);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        const registrations = await Registration.find({ eventId: request.params.id })
            .populate("userId", "participantType");

        // Count analytics manually
        let totalRegistrations = 0;
        let attended = 0;
        let iiitCount = 0;
        let nonIiitCount = 0;
        let revenue = 0;

        for (const registration of registrations) {
            totalRegistrations = totalRegistrations + 1;

            if (registration.attended) {
                attended = attended + 1;
            }

            if (registration.userId?.participantType === "iiit") {
                iiitCount = iiitCount + 1;
            } else {
                nonIiitCount = nonIiitCount + 1;
            }

            if (registration.paymentStatus === "approved") {
                revenue = revenue + (registration.amountPaid || 0);
            }
        }

        response.json({
            totalRegistrations,
            attended,
            iiitCount,
            nonIiitCount,
            revenue,
        });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Approve/Reject Payment (organizer) ── */
router.patch("/:eventId/registrations/:regId/payment", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const result = await findOrganizerAndEvent(request.user.userId, request.params.eventId);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        const registration = await Registration.findById(request.params.regId).populate("userId", "firstName lastName email");
        if (!registration) {
            return response.status(404).json({ message: "Registration not found" });
        }

        const { action } = request.body;
        const previousStatus = registration.paymentStatus;

        if (action === "approve") {
            if (previousStatus === "approved") {
                return response.status(400).json({ message: "Already approved" });
            }

            registration.paymentStatus = "approved";

            // Generate QR code on approval
            if (!registration.qrCode) {
                const qrCode = await QRCode.toDataURL(registration.ticketId);
                registration.qrCode = qrCode;
            }

            // Stock was already decremented at registration time — nothing to do here
            await registration.save();

            // Send confirmation email with QR on approval
            if (registration.userId?.email) {
                const eventData = await Event.findById(request.params.eventId);
                sendTicketEmail(registration.userId.email, {
                    eventName: eventData?.name || "Event",
                    participantName: `${registration.userId.firstName} ${registration.userId.lastName}`,
                    ticketId: registration.ticketId,
                    qrCode: registration.qrCode,
                    eventDate: eventData?.startDate,
                });
            }
        } else if (action === "reject") {
            if (previousStatus === "rejected") {
                return response.status(400).json({ message: "Already rejected" });
            }

            registration.paymentStatus = "rejected";
            registration.qrCode = "";
            await registration.save();

            // Roll back registrationCount
            await Event.findByIdAndUpdate(request.params.eventId, {
                $inc: { registrationCount: -1 },
            });

            // Restore merch stock — stock was decremented at registration time, so always restore on reject
            const event = await Event.findById(request.params.eventId);
            if (event && event.eventType === "merchandise" && registration.merchandiseSelections) {
                for (const itemId in registration.merchandiseSelections) {
                    const sel = registration.merchandiseSelections[itemId];
                    const optionId = sel.optionId;
                    const merchItem = event.merchandiseItems.find(
                        (item) => item._id.toString() === itemId
                    );
                    if (merchItem && optionId) {
                        const option = merchItem.options.find(
                            (opt) => opt._id.toString() === optionId
                        );
                        if (option) {
                            option.stock = option.stock + 1;
                        }
                    }
                }
                await event.save();
            }
        } else {
            return response.status(400).json({ message: "Invalid action" });
        }

        response.json({ message: `Payment ${action}d`, registration });
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Scan Ticket / Check-in (organizer) ── */
router.post("/:id/scan", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const result = await findOrganizerAndEvent(request.user.userId, request.params.id);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        if (computeStatus(result.event) !== "ongoing") {
            return response.status(400).json({ message: "Attendance can only be taken while the event is ongoing" });
        }

        const { ticketId } = request.body;
        if (!ticketId) {
            return response.status(400).json({ message: "Ticket ID required" });
        }

        // Find the registration by ticket ID and event
        const registration = await Registration.findOne({
            eventId: request.params.id,
            ticketId,
        }).populate("userId", "firstName lastName");

        if (!registration) {
            return response.status(404).json({ message: "Invalid ticket" });
        }

        // Block check-in if payment is not approved
        if (registration.paymentStatus === "pending" || registration.paymentStatus === "rejected") {
            return response.status(400).json({ message: "Payment not approved — cannot check in" });
        }

        if (registration.attended) {
            return response.status(400).json({ message: "Already checked in" });
        }

        // Mark as attended
        registration.attended = true;
        registration.attendedAt = new Date();
        await registration.save();

        const participantName = registration.userId?.firstName + " " + registration.userId?.lastName;
        response.json({ message: "Checked in", participant: participantName });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Manual Check-in Override (organizer) ── */
router.post("/:eventId/registrations/:regId/checkin", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const result = await findOrganizerAndEvent(request.user.userId, request.params.eventId);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        if (computeStatus(result.event) !== "ongoing") {
            return response.status(400).json({ message: "Attendance can only be taken while the event is ongoing" });
        }

        const registration = await Registration.findById(request.params.regId).populate("userId", "firstName lastName");

        if (!registration) {
            return response.status(404).json({ message: "Registration not found" });
        }

        // Block check-in if payment is not approved
        if (registration.paymentStatus === "pending" || registration.paymentStatus === "rejected") {
            return response.status(400).json({ message: "Payment not approved — cannot check in" });
        }

        // Toggle attendance status
        registration.attended = !registration.attended;
        registration.attendedAt = registration.attended ? new Date() : null;
        await registration.save();

        response.json({ message: registration.attended ? "Checked in manually" : "Check-in reverted", participant: `${registration.userId?.firstName} ${registration.userId?.lastName}` });

    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

export default router;
