// discussionRoutes.js — Real-time event discussion messages with threading, pinning, reactions

import express from "express";
import mongoose from "mongoose";
import Discussion from "../models/Discussion.js";
import Notification from "../models/Notification.js";
import Registration from "../models/Registration.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

// Helper: check if user is the organizer of the event
async function isEventOrganizer(userId, eventId) {
    const event = await mongoose.model("Event").findById(eventId);
    if (!event) return false;
    const organizer = await mongoose.model("Organizer").findOne({ userId });
    if (!organizer) return false;
    return event.organizerId.toString() === organizer._id.toString();
}

/* ── Get Messages for Event ── */
router.get("/:eventId", authenticate, async (request, response) => {
    try {
        const messages = await Discussion.find({ eventId: request.params.eventId })
            .populate("userId", "firstName lastName role")
            .sort({ createdAt: 1 });

        response.json(messages);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Post a Message (registered participants + organizer of event) ── */
router.post("/:eventId", authenticate, async (request, response) => {
    try {
        const messageData = {
            eventId: request.params.eventId,
            userId: request.user.userId,
            message: request.body.message,
        };

        // Support threading: if parentId is provided, attach it
        if (request.body.parentId) {
            messageData.parentId = request.body.parentId;
        }

        const message = await Discussion.create(messageData);
        const populated = await message.populate("userId", "firstName lastName role");

        // If the sender is an organizer of this event, notify all registered participants
        const isOrg = await isEventOrganizer(request.user.userId, request.params.eventId);
        if (isOrg) {
            const event = await mongoose.model("Event").findById(request.params.eventId);
            const eventName = event?.name || "Event";

            // Find all registered participants for this event
            const registrations = await Registration.find({ eventId: request.params.eventId })
                .select("userId");

            const notificationDocs = [];
            for (const reg of registrations) {
                // Don't notify the organizer themselves
                if (reg.userId.toString() === request.user.userId) continue;
                notificationDocs.push({
                    userId: reg.userId,
                    eventId: request.params.eventId,
                    message: `New message from organizer in "${eventName}": ${request.body.message.substring(0, 100)}`,
                });
            }

            if (notificationDocs.length > 0) {
                await Notification.insertMany(notificationDocs);
            }
        }

        response.status(201).json(populated);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Delete a Message (Organizer of event or Admin only) ── */
router.delete("/:eventId/:messageId", authenticate, async (request, response) => {
    try {
        const event = await mongoose.model("Event").findById(request.params.eventId);
        if (!event) {
            return response.status(404).json({ message: "Event not found" });
        }

        // Only allow organizers of this event or admins to delete
        if (request.user.role !== "admin") {
            const organizer = await mongoose.model("Organizer").findOne({ userId: request.user.userId });
            if (!organizer || event.organizerId.toString() !== organizer._id.toString()) {
                return response.status(403).json({ message: "Not authorized to moderate this event" });
            }
        }

        await Discussion.findByIdAndDelete(request.params.messageId);
        response.json({ message: "Message deleted" });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Pin/Unpin a Message (Organizer of event or Admin only) ── */
router.patch("/:eventId/:messageId/pin", authenticate, async (request, response) => {
    try {
        if (request.user.role !== "admin") {
            const isOrg = await isEventOrganizer(request.user.userId, request.params.eventId);
            if (!isOrg) {
                return response.status(403).json({ message: "Not authorized" });
            }
        }

        const message = await Discussion.findById(request.params.messageId);
        if (!message) {
            return response.status(404).json({ message: "Message not found" });
        }

        message.pinned = !message.pinned;
        await message.save();

        response.json({ message: message.pinned ? "Message pinned" : "Message unpinned", discussion: message });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── React to a Message ── */
router.post("/:eventId/:messageId/react", authenticate, async (request, response) => {
    try {
        const { emoji } = request.body;
        if (!emoji) {
            return response.status(400).json({ message: "Emoji required" });
        }

        const message = await Discussion.findById(request.params.messageId);
        if (!message) {
            return response.status(404).json({ message: "Message not found" });
        }

        const userId = request.user.userId;

        // Get existing users who reacted with this emoji
        const existingReactions = message.reactions.get(emoji) || [];
        const alreadyReacted = existingReactions.some((id) => id.toString() === userId);

        if (alreadyReacted) {
            // Remove the reaction (toggle off)
            message.reactions.set(
                emoji,
                existingReactions.filter((id) => id.toString() !== userId)
            );
        } else {
            // Add the reaction
            existingReactions.push(userId);
            message.reactions.set(emoji, existingReactions);
        }

        await message.save();
        response.json({ message: "Reaction updated", discussion: message });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

export default router;
