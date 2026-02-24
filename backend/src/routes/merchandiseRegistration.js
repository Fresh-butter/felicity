// merchandiseRegistration.js — Registration route for merchandise events
// Merchandise items work like dropdown form fields: each item has options (variants)
// with individual prices and stock. User selects one option per item (or skips optional items).
// Total = registrationFee + sum of selected option prices.
// Payment proof is uploaded to Cloudinary; URL is stored in the database.

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

/* ── Register for a Merchandise Event (participant only) ── */
router.post("/merch/:id/register", authenticate, authorizeRoles("participant"), async (request, response) => {
    try {
        // Step 1: Find the event and ensure it exists and registration is open
        const event = await Event.findById(request.params.id);
        if (!event) {
            return response.status(404).json({ message: "Event not found" });
        }
        if (!event.registrationOpen) {
            return response.status(400).json({ message: "Registration is not open for this event" });
        }

        // Step 2: Verify this is a merchandise event
        if (event.eventType !== "merchandise") {
            return response.status(400).json({ message: "This route is for merchandise events only" });
        }

        // Step 3: Check eligibility
        const user = await User.findById(request.user.userId);
        const eligibilityError = checkEligibility(event, user);
        if (eligibilityError) {
            return response.status(403).json({ message: eligibilityError });
        }

        // Step 4: Check registration deadline
        if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
            return response.status(400).json({ message: "Registration deadline passed" });
        }

        // Step 5: Check for duplicate registration (before reserving a slot)
        const existingRegistration = await Registration.findOne({
            eventId: event._id,
            userId: request.user.userId,
        });
        if (existingRegistration) {
            return response.status(400).json({ message: "Already registered" });
        }

        // Step 6: Pre-check — if any required item has ALL options out of stock, reject early
        // Re-fetch the event fresh from DB to get live stock values
        const freshEvent = await Event.findById(event._id);
        for (const merchItem of freshEvent.merchandiseItems) {
            if (merchItem.required) {
                const hasAvailableOption = merchItem.options.some((opt) => opt.stock > 0);
                if (!hasAvailableOption) {
                    return response.status(400).json({
                        message: `Required item "${merchItem.itemName}" is completely sold out`,
                    });
                }
            }
        }

        // Step 7: Atomically reserve a slot — prevents race conditions
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

        // Step 8: Process merchandise selections and atomically decrement stock.
        // For each selected option we do a findOneAndUpdate with stock > 0 guard
        // so two concurrent requests can never both decrement the last unit.
        const selections = request.body.merchandiseSelections || {};
        const processedSelections = {};
        let merchTotal = 0;
        const decrementedOptions = []; // track for rollback on later failure

        for (const merchItem of event.merchandiseItems) {
            const itemId = merchItem._id.toString();
            const selectedOptionId = selections[itemId];

            if (merchItem.required && !selectedOptionId) {
                // Roll back any stock already decremented before returning
                for (const d of decrementedOptions) {
                    await Event.findOneAndUpdate(
                        { _id: event._id, "merchandiseItems._id": d.itemId },
                        { $inc: { "merchandiseItems.$.options.$[opt].stock": 1 } },
                        { arrayFilters: [{ "opt._id": d.optionId }] }
                    );
                }
                await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: -1 } });
                return response.status(400).json({
                    message: `Required item not selected: ${merchItem.itemName}`,
                });
            }

            if (selectedOptionId) {
                // Validate option exists
                const option = merchItem.options.find(
                    (opt) => opt._id.toString() === selectedOptionId
                );
                if (!option) {
                    for (const d of decrementedOptions) {
                        await Event.findOneAndUpdate(
                            { _id: event._id, "merchandiseItems._id": d.itemId },
                            { $inc: { "merchandiseItems.$.options.$[opt].stock": 1 } },
                            { arrayFilters: [{ "opt._id": d.optionId }] }
                        );
                    }
                    await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: -1 } });
                    return response.status(400).json({ message: `Invalid option for ${merchItem.itemName}` });
                }

                // Atomically decrement stock only if stock > 0
                const stockResult = await Event.findOneAndUpdate(
                    {
                        _id: event._id,
                        "merchandiseItems._id": merchItem._id,
                        "merchandiseItems.options._id": option._id,
                        "merchandiseItems.options.stock": { $gt: 0 },
                    },
                    { $inc: { "merchandiseItems.$[item].options.$[opt].stock": -1 } },
                    {
                        arrayFilters: [
                            { "item._id": merchItem._id },
                            { "opt._id": option._id },
                        ],
                        new: true,
                    }
                );

                if (!stockResult) {
                    // Out of stock — roll back previous decrements and the slot
                    for (const d of decrementedOptions) {
                        await Event.findOneAndUpdate(
                            { _id: event._id, "merchandiseItems._id": d.itemId },
                            { $inc: { "merchandiseItems.$[item].options.$[opt].stock": 1 } },
                            { arrayFilters: [{ "item._id": d.itemId }, { "opt._id": d.optionId }] }
                        );
                    }
                    await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: -1 } });
                    return response.status(400).json({
                        message: `Out of stock: ${merchItem.itemName} — ${option.label}`,
                    });
                }

                decrementedOptions.push({ itemId: merchItem._id, optionId: option._id });
                merchTotal += option.price;
                processedSelections[itemId] = {
                    itemName: merchItem.itemName,
                    optionId: option._id.toString(),
                    optionLabel: option.label,
                    price: option.price,
                };
            }
        }

        // Step 9: Calculate total amount (registration fee + merch total)
        const amountPaid = (event.registrationFee || 0) + merchTotal;

        // Step 10: Generate ticket ID
        const ticketId = "FEL-" + crypto.randomBytes(4).toString("hex");

        // Step 11: Determine payment status
        let paymentStatus = "not_required";
        let qrCode = "";
        if (amountPaid > 0) {
            paymentStatus = "pending";
            // QR is NOT generated while payment is pending
        } else {
            // Free — generate QR immediately
            qrCode = await QRCode.toDataURL(ticketId);
        }

        // Step 12: Create registration — if it fails, roll back slot + stock
        let registration;
        try {
            registration = await Registration.create({
                eventId: event._id,
                userId: request.user.userId,
                ticketId,
                qrCode,
                paymentStatus,
                merchandiseSelections: processedSelections,
                amountPaid,
            });
        } catch (createError) {
            // Roll back registration slot
            await Event.findByIdAndUpdate(event._id, { $inc: { registrationCount: -1 } });
            // Roll back all stock decrements
            for (const d of decrementedOptions) {
                await Event.findOneAndUpdate(
                    { _id: event._id },
                    { $inc: { "merchandiseItems.$[item].options.$[opt].stock": 1 } },
                    { arrayFilters: [{ "item._id": d.itemId }, { "opt._id": d.optionId }] }
                );
            }
            if (createError.code === 11000) {
                return response.status(400).json({ message: "Already registered" });
            }
            throw createError;
        }

        // Step 13: Slot and stock were already handled atomically — nothing more to do.

        // Step 14: Send confirmation email if free
        if (paymentStatus === "not_required") {
            sendTicketEmail(user.email, {
                eventName: event.name,
                participantName: user.firstName + " " + user.lastName,
                ticketId,
                qrCode,
                eventDate: event.startDate,
            });
        }

        // Step 15: Respond
        response.status(201).json(registration);
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: "Server error" });
    }
});

export default router;
