// normalRegistration.js — Registration route for normal (non-merchandise) events
// Handles form validation, ticket generation, and confirmation email

import express from "express";
import QRCode from "qrcode";
import crypto from "crypto";
import Registration from "../models/Registration.js";
import Event from "../models/Event.js";
import User from "../models/User.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import { sendTicketEmail } from "../utils/mailer.js";
import { checkEligibility } from "./eventHelpers.js";

const router = express.Router();

/* ── Register for a Normal Event (participant only) ── */
router.post("/normal/:id/register", authenticate, authorizeRoles("participant"), async (request, response) => {
    try {
        // Step 1: Find the event and make sure it exists and registration is open
        const event = await Event.findById(request.params.id);
        if (!event) {
            return response.status(404).json({ message: "Event not found" });
        }
        if (!event.registrationOpen) {
            return response.status(400).json({ message: "Registration is not open for this event" });
        }

        // Step 2: Verify this is actually a normal event
        if (event.eventType !== "normal") {
            return response.status(400).json({ message: "This route is for normal events only" });
        }

        // Step 3: Check if the participant is eligible (IIIT vs non-IIIT)
        const user = await User.findById(request.user.userId);
        const eligibilityError = checkEligibility(event, user);
        if (eligibilityError) {
            return response.status(403).json({ message: eligibilityError });
        }

        // Step 4: Check if registration deadline has passed
        if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
            return response.status(400).json({ message: "Registration deadline passed" });
        }

        // Step 5: Check if the user has already registered (before reserving a slot)
        const existingRegistration = await Registration.findOne({
            eventId: event._id,
            userId: request.user.userId,
        });
        if (existingRegistration) {
            return response.status(400).json({ message: "Already registered" });
        }

        // Step 6: Atomically check capacity and reserve a slot.
        // The $inc only executes if registrationCount is still below the limit,
        // making the check-and-increment a single atomic operation that prevents
        // any race condition between concurrent requests.
        const updatedEvent = await Event.findOneAndUpdate(
            {
                _id: event._id,
                registrationCount: { $lt: event.registrationLimit },
            },
            { $inc: { registrationCount: 1 } },
            { new: true }
        );
        if (!updatedEvent) {
            return response.status(400).json({ message: "Event is full" });
        }

        // Step 7: Validate required form fields (Bug 5 fix)
        // Each form field has a unique _id (Bug 6 fix), and we use that as the key
        const submittedResponses = request.body.formResponses || {};

        if (event.customForm && event.customForm.length > 0) {
            for (const field of event.customForm) {
                // Use the field's unique _id as the key (not the label)
                const fieldId = field._id.toString();
                const value = submittedResponses[fieldId];

                // If the field is marked as required, make sure it has a value
                if (field.required) {
                    const isEmpty = (value === undefined || value === null || value === "");
                    const isEmptyArray = (Array.isArray(value) && value.length === 0);

                    if (isEmpty || isEmptyArray) {
                        return response.status(400).json({
                            message: `Required field missing: ${field.label}`,
                        });
                    }
                }
            }
        }

        // Step 8: Copy form responses into a clean object
        const formResponses = {};
        for (const fieldKey in submittedResponses) {
            formResponses[fieldKey] = submittedResponses[fieldKey];
        }

        // Step 9: Generate a unique ticket ID with a recognizable prefix (Bug 9 fix)
        const ticketId = "FEL-" + crypto.randomBytes(4).toString("hex");

        // Step 10: Generate QR code only for free events — paid events get QR on payment approval
        let qrCode = "";
        if (event.registrationFee === 0) {
            qrCode = await QRCode.toDataURL(ticketId);
        }

        // Step 11: Determine payment status based on registration fee
        let paymentStatus = "not_required";
        if (event.registrationFee > 0) {
            paymentStatus = "pending";
        }

        // Step 12: Compute the amount to be paid
        const amountPaid = event.registrationFee || 0;

        // Step 13: Create the registration record in the database.
        // If this fails (e.g. duplicate key), roll back the slot we reserved.
        let registration;
        try {
            registration = await Registration.create({
                eventId: event._id,
                userId: request.user.userId,
                ticketId,
                qrCode,
                paymentStatus,
                formResponses,
                amountPaid,
            });
        } catch (createError) {
            // Roll back the reserved slot
            await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: -1 } });
            if (createError.code === 11000) {
                return response.status(400).json({ message: "Already registered" });
            }
            throw createError;
        }

        // Step 14: Registration count was already atomically incremented above.
        // Send confirmation email only for free events (paid events get email on approval)
        if (paymentStatus === "not_required") {
            sendTicketEmail(user.email, {
                eventName: event.name,
                participantName: user.firstName + " " + user.lastName,
                ticketId,
                qrCode,
                eventDate: event.startDate,
            });
        }

        // Step 16: Respond with the created registration
        response.status(201).json(registration);
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Get My Registration for an Event (participant) ── */
router.get("/:id/my-registration", authenticate, authorizeRoles("participant"), async (request, response) => {
    try {
        const registration = await Registration.findOne({
            eventId: request.params.id,
            userId: request.user.userId,
        });

        if (!registration) {
            return response.status(404).json({ message: "Not registered" });
        }

        response.json(registration);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Upload Payment Proof (participant) ── */
router.patch("/:id/payment-proof", authenticate, authorizeRoles("participant"), async (request, response) => {
    try {
        const { paymentProof } = request.body;

        if (!paymentProof) {
            return response.status(400).json({ message: "Payment proof image required" });
        }

        const registration = await Registration.findOne({
            eventId: request.params.id,
            userId: request.user.userId,
        });

        if (!registration) {
            return response.status(404).json({ message: "Not registered" });
        }

        if (registration.paymentStatus !== "pending" && registration.paymentStatus !== "rejected") {
            return response.status(400).json({ message: "Payment proof cannot be uploaded for this registration" });
        }

        registration.paymentProof = paymentProof;
        // If the payment was previously rejected, set it back to pending for re-review
        if (registration.paymentStatus === "rejected") {
            registration.paymentStatus = "pending";
        }
        await registration.save();

        response.json({ message: "Payment proof uploaded", registration });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

export default router;
