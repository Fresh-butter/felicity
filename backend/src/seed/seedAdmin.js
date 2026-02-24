// seedAdmin.js — One-time script to create the admin user

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import User from "../models/User.js";

dotenv.config();

async function seedAdmin() {
  try {
    // Connect to the database
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to database");

    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("Admin already exists:", existingAdmin.email);
      process.exit(0);
    }

    // Create admin user with hashed password
    const hashedPassword = await bcrypt.hash("admin123", 10);
    const admin = await User.create({
      firstName: "Admin",
      lastName: "User",
      email: "admin@felicity.com",
      password: hashedPassword,
      role: "admin",
      participantType: "iiit",
    });

    console.log("Admin user created:", admin.email);
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }
}

seedAdmin();
