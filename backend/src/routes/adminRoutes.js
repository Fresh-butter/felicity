// adminRoutes.js — Admin endpoints for managing organizers and password resets

import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import User from "../models/User.js";
import Organizer from "../models/Organizer.js";
import Event from "../models/Event.js";
import Registration from "../models/Registration.js";
import PasswordResetRequest from "../models/PasswordResetRequest.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ── Create Organizer ── */
router.post("/organizers", authenticate, authorizeRoles("admin"), async (request, response) => {
  try {
    const { name, category, description, contactEmail } = request.body;

    if (!name || !category || !contactEmail) {
      return response.status(400).json({ message: "Missing required fields" });
    }

    // Generate a login email from the club name (e.g., "Tech Club" -> "tech-club@clubs.felicity.com")
    const loginEmail = name.toLowerCase().replace(/\s+/g, "-") + "@clubs.felicity.com";

    // Check if organizer already exists
    const existingUser = await User.findOne({ email: loginEmail });
    if (existingUser) {
      return response.status(400).json({ message: "Organizer with this name already exists" });
    }

    // Generate a random password for the organizer
    const plainPassword = crypto.randomBytes(4).toString("hex");
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Create a user account for the organizer
    const user = await User.create({
      firstName: name,
      lastName: "Organizer",
      email: loginEmail,
      password: hashedPassword,
      role: "organizer",
      participantType: "iiit",
    });

    // Create the organizer profile linked to the user
    await Organizer.create({
      userId: user._id,
      name,
      category,
      description,
      contactEmail,
    });

    // Return credentials so admin can share them with the organizer
    response.status(201).json({
      message: "Organizer created",
      loginEmail,
      password: plainPassword,
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Server error" });
  }
});

/* ── List Organizers ── */
router.get("/organizers", authenticate, authorizeRoles("admin"), async (request, response) => {
  try {
    const organizers = await Organizer.find()
      .populate("userId", "email")
      .lean();

    // Map to a clean response format
    const result = [];
    for (const organizer of organizers) {
      result.push({
        id: organizer._id,
        name: organizer.name,
        category: organizer.category,
        contactEmail: organizer.contactEmail,
        loginEmail: organizer.userId?.email || "",
        isActive: organizer.isActive,
        isArchived: organizer.isArchived || false,
      });
    }

    response.json(result);
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Toggle Organizer Active/Inactive ── */
router.patch("/organizers/:id/toggle", authenticate, authorizeRoles("admin"), async (request, response) => {
  try {
    const organizer = await Organizer.findById(request.params.id);
    if (!organizer) {
      return response.status(404).json({ message: "Organizer not found" });
    }

    // Flip the active status
    organizer.isActive = !organizer.isActive;
    await organizer.save();

    response.json({ message: "Organizer status updated", isActive: organizer.isActive });
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Toggle Organizer Archive Status ── */
router.patch("/organizers/:id/archive", authenticate, authorizeRoles("admin"), async (request, response) => {
  try {
    const organizer = await Organizer.findById(request.params.id);
    if (!organizer) {
      return response.status(404).json({ message: "Organizer not found" });
    }

    // Flip the archive status
    organizer.isArchived = !organizer.isArchived;
    await organizer.save();

    response.json({ message: "Organizer archive status updated", isArchived: organizer.isArchived });
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Delete Organizer (with cascade) ── */
router.delete("/organizers/:id", authenticate, authorizeRoles("admin"), async (request, response) => {
  try {
    const organizer = await Organizer.findById(request.params.id);
    if (!organizer) {
      return response.status(404).json({ message: "Organizer not found" });
    }

    // Find all events by this organizer
    const events = await Event.find({ organizerId: organizer._id });
    const eventIds = [];
    for (const event of events) {
      eventIds.push(event._id);
    }

    // Delete all registrations for those events
    await Registration.deleteMany({ eventId: { $in: eventIds } });

    // Delete all events
    await Event.deleteMany({ organizerId: organizer._id });

    // Delete the user login account and organizer profile
    await User.findByIdAndDelete(organizer.userId);
    await Organizer.findByIdAndDelete(request.params.id);

    response.json({ message: "Organizer and all associated data deleted" });
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Dashboard Stats ── */
router.get("/stats", authenticate, authorizeRoles("admin"), async (request, response) => {
  try {
    const totalOrganizers = await Organizer.countDocuments();
    const activeOrganizers = await Organizer.countDocuments({ isActive: true });
    const totalEvents = await Event.countDocuments();
    const upcomingEvents = await Event.countDocuments({ endDate: { $gte: new Date() } });
    const totalParticipants = await User.countDocuments({ role: "participant" });
    const totalRegistrations = await Registration.countDocuments();
    const pendingResets = await PasswordResetRequest.countDocuments({ status: "pending" });

    response.json({
      totalOrganizers,
      activeOrganizers,
      totalEvents,
      upcomingEvents,
      totalParticipants,
      totalRegistrations,
      pendingResets,
    });
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── List Password Reset Requests ── */
router.get("/password-resets", authenticate, authorizeRoles("admin"), async (request, response) => {
  try {
    const requests = await PasswordResetRequest.find()
      .populate("organizerId", "name category")
      .sort({ createdAt: -1 });

    response.json(requests);
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Handle Password Reset Request (approve/reject) ── */
router.patch("/password-resets/:id", authenticate, authorizeRoles("admin"), async (request, response) => {
  try {
    const { action, adminComment } = request.body;

    const resetRequest = await PasswordResetRequest.findById(request.params.id)
      .populate("organizerId");

    if (!resetRequest) {
      return response.status(404).json({ message: "Request not found" });
    }

    if (action === "approve") {
      // Generate new password
      const newPassword = crypto.randomBytes(4).toString("hex");
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the organizer's user account with new password
      await User.findByIdAndUpdate(resetRequest.organizerId.userId, {
        password: hashedPassword,
      });

      // Update the request status
      resetRequest.status = "approved";
      resetRequest.newPassword = newPassword;
      resetRequest.adminComment = adminComment || "";
      await resetRequest.save();

      response.json({ message: "Password reset approved", newPassword });
    } else if (action === "reject") {
      resetRequest.status = "rejected";
      resetRequest.adminComment = adminComment || "";
      await resetRequest.save();

      response.json({ message: "Password reset rejected" });
    } else {
      response.status(400).json({ message: "Invalid action" });
    }
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Server error" });
  }
});

export default router;
