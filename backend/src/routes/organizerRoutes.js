// organizerRoutes.js — Public organizer listing and organizer profile management

import express from "express";
import Organizer from "../models/Organizer.js";
import Event from "../models/Event.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import { withStatus } from "./eventHelpers.js";

const router = express.Router();

/* ── List All Active Organizers (authenticated) ── */
router.get("/", authenticate, async (request, response) => {
    try {
        const organizers = await Organizer.find({ isActive: true })
            .select("name category description");
        response.json(organizers);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Get Organizer Detail with Events (authenticated) ── */
router.get("/:id", authenticate, async (request, response) => {
    try {
        const organizer = await Organizer.findById(request.params.id)
            .select("name category description contactEmail");

        if (!organizer) {
            return response.status(404).json({ message: "Organizer not found" });
        }

        const now = new Date();

        // Upcoming events: start date in the future, published
        const upcomingEvents = await Event.find({
            organizerId: organizer._id,
            status: { $in: ["published", "ongoing"] },
            startDate: { $gt: now },
        }).sort({ startDate: 1 });

        // Past events: end date in the past or completed
        const pastEvents = await Event.find({
            organizerId: organizer._id,
            $or: [
                { endDate: { $lt: now } },
                { status: "completed" },
            ],
        }).sort({ endDate: -1 }).limit(10);

        response.json({
            organizer,
            upcoming: withStatus(upcomingEvents),
            past: withStatus(pastEvents),
        });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Get My Profile (organizer) ── */
router.get("/me/profile", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const organizer = await Organizer.findOne({ userId: request.user.userId })
            .populate("userId", "email");
        if (!organizer) {
            return response.status(404).json({ message: "Organizer not found" });
        }
        response.json(organizer);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Update My Profile (organizer) ── */
router.put("/me/profile", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const organizer = await Organizer.findOne({ userId: request.user.userId });
        if (!organizer) {
            return response.status(404).json({ message: "Organizer not found" });
        }

        // Update allowed fields (use hasOwnProperty to allow clearing values)
        if (request.body.name !== undefined) organizer.name = request.body.name;
        if (request.body.category !== undefined) organizer.category = request.body.category;
        if (request.body.description !== undefined) organizer.description = request.body.description;
        if (request.body.contactEmail !== undefined) organizer.contactEmail = request.body.contactEmail;
        if (request.body.contactNumber !== undefined) organizer.contactNumber = request.body.contactNumber;
        if (request.body.discordWebhookUrl !== undefined) organizer.discordWebhookUrl = request.body.discordWebhookUrl;

        await organizer.save();
        response.json(organizer);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Request Password Reset (organizer) ── */
router.post("/me/request-password-reset", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const organizer = await Organizer.findOne({ userId: request.user.userId });
        if (!organizer) {
            return response.status(404).json({ message: "Organizer not found" });
        }

        // Check for existing pending request
        const existingRequest = await PasswordResetRequest.findOne({
            organizerId: organizer._id,
            status: "pending",
        });
        if (existingRequest) {
            return response.status(400).json({ message: "A pending request already exists" });
        }

        await PasswordResetRequest.create({
            organizerId: organizer._id,
            reason: request.body.reason,
        });

        response.status(201).json({ message: "Password reset request submitted" });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Retrieve Password Reset Request History for the Organizer ── */
router.get("/me/password-resets", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const organizer = await Organizer.findOne({ userId: request.user.userId });
        if (!organizer) {
            return response.status(404).json({ message: "Organizer not found" });
        }

        const history = await PasswordResetRequest.find({ organizerId: organizer._id })
            .sort({ createdAt: -1 });

        response.json(history);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

export default router;
