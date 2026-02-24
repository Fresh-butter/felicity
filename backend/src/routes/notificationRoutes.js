// notificationRoutes.js — In-app notification endpoints

import express from "express";
import Notification from "../models/Notification.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ── Get My Notifications ── */
router.get("/", authenticate, async (request, response) => {
    try {
        const notifications = await Notification.find({ userId: request.user.userId })
            .populate("eventId", "name")
            .sort({ createdAt: -1 })
            .limit(50);

        response.json(notifications);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Get Unread Count ── */
router.get("/unread-count", authenticate, async (request, response) => {
    try {
        const count = await Notification.countDocuments({
            userId: request.user.userId,
            read: false,
        });
        response.json({ count });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Mark All as Read ── */
router.patch("/read-all", authenticate, async (request, response) => {
    try {
        await Notification.updateMany(
            { userId: request.user.userId, read: false },
            { read: true }
        );
        response.json({ message: "All notifications marked as read" });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Mark Single as Read ── */
router.patch("/:id/read", authenticate, async (request, response) => {
    try {
        await Notification.findByIdAndUpdate(request.params.id, { read: true });
        response.json({ message: "Notification marked as read" });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

export default router;
