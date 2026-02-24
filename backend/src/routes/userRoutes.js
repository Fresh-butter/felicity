// userRoutes.js — Participant signup, login, profile, follow/unfollow, registrations

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Organizer from "../models/Organizer.js";
import Registration from "../models/Registration.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ── Signup ── */
router.post("/signup", async (request, response) => {
  try {
    const { firstName, lastName, email, password, participantType } = request.body;

    if (!firstName || !lastName || !email || !password || !participantType) {
      return response.status(400).json({ message: "All fields required" });
    }

    // IIIT students must use their college email
    if (participantType === "iiit") {
      const validDomains = ["@iiit.ac.in", "@students.iiit.ac.in", "@research.iiit.ac.in", "@navneet.iiit.ac.in"];
      const hasValidDomain = validDomains.some((domain) => email.endsWith(domain));
      if (!hasValidDomain) {
        return response.status(400).json({ message: "IIIT participants must use IIIT email" });
      }
    }

    // Check if email is already registered
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return response.status(400).json({ message: "Email already registered" });
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      participantType,
      role: "participant",
    };

    // IIIT participants automatically get "IIIT Hyderabad" as college name
    if (participantType === "iiit") {
      userData.collegeName = "IIIT Hyderabad";
    }

    const user = await User.create(userData);

    // Generate JWT token for auto-login after signup
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    response.status(201).json({
      message: "Signup successful",
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        participantType: user.participantType,
      },
    });
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Login ── */
router.post("/login", async (request, response) => {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return response.status(400).json({ message: "Email and password required" });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return response.status(401).json({ message: "Invalid credentials" });
    }

    // If user is an organizer, check if their account is active
    if (user.role === "organizer") {
      const organizer = await Organizer.findOne({ userId: user._id });
      if (!organizer) {
        return response.status(403).json({ message: "Organizer account not found" });
      }
      if (!organizer.isActive) {
        return response.status(403).json({ message: "Organizer account disabled" });
      }
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return response.status(401).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Build user data to return
    const userData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      participantType: user.participantType,
    };

    // Include organizerId for organizer users
    if (user.role === "organizer") {
      const organizer = await Organizer.findOne({ userId: user._id });
      if (organizer) {
        userData.organizerId = organizer._id;
      }
    }

    response.json({ message: "Login successful", token, user: userData });
  } catch (error) {
    console.error(error);
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Get Profile ── */
router.get("/profile", authenticate, async (request, response) => {
  try {
    const user = await User.findById(request.user.userId)
      .select("-password")
      .populate("followedClubs", "name category");
    response.json(user);
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Update Profile ── */
router.put("/profile", authenticate, async (request, response) => {
  try {
    // Fetch the current user to check their participant type
    const user = await User.findById(request.user.userId);
    if (!user) {
      return response.status(404).json({ message: "User not found" });
    }

    // Only allow updating specific fields (not email, role, etc.)
    const allowedFields = ["firstName", "lastName", "contactNumber", "collegeName", "areasOfInterest", "followedClubs"];
    const updates = {};
    for (const key of allowedFields) {
      if (request.body[key] !== undefined) {
        // IIIT participants cannot change their college name
        if (key === "collegeName" && user.participantType === "iiit") {
          continue; // Skip this field for IIIT participants
        }
        updates[key] = request.body[key];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      request.user.userId,
      updates,
      { new: true }
    ).select("-password");

    response.json(updatedUser);
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Change Password ── */
router.post("/change-password", authenticate, async (request, response) => {
  try {
    const { oldPassword, newPassword } = request.body;

    if (!oldPassword || !newPassword) {
      return response.status(400).json({ message: "Both passwords required" });
    }

    // Verify old password
    const user = await User.findById(request.user.userId);
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return response.status(400).json({ message: "Old password is incorrect" });
    }

    // Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    response.json({ message: "Password changed successfully" });
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Follow Club ── */
router.post("/follow/:organizerId", authenticate, authorizeRoles("participant"), async (request, response) => {
  try {
    const user = await User.findById(request.user.userId);

    // Only add if not already following
    if (!user.followedClubs.includes(request.params.organizerId)) {
      user.followedClubs.push(request.params.organizerId);
      await user.save();
    }

    response.json({ message: "Followed", followedClubs: user.followedClubs });
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── Unfollow Club ── */
router.post("/unfollow/:organizerId", authenticate, authorizeRoles("participant"), async (request, response) => {
  try {
    const user = await User.findById(request.user.userId);

    // Remove the organizer from followed list
    user.followedClubs = user.followedClubs.filter(
      (id) => id.toString() !== request.params.organizerId
    );
    await user.save();

    response.json({ message: "Unfollowed", followedClubs: user.followedClubs });
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

/* ── My Registrations ── */
router.get("/my-registrations", authenticate, authorizeRoles("participant"), async (request, response) => {
  try {
    const registrations = await Registration.find({ userId: request.user.userId })
      .populate({
        path: "eventId",
        populate: { path: "organizerId", select: "name" },
      })
      .sort({ registeredAt: -1 });

    response.json(registrations);
  } catch (error) {
    response.status(500).json({ message: "Server error" });
  }
});

export default router;
