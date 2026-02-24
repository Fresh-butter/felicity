// server.js — Entry point for the Felicity backend

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import userRoutes from "./routes/userRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import eventCrud from "./routes/eventCrud.js";
import registrationRoutes from "./routes/registrationRoutes.js";
import normalRegistration from "./routes/normalRegistration.js";
import merchandiseRegistration from "./routes/merchandiseRegistration.js";
import organizerRoutes from "./routes/organizerRoutes.js";
import discussionRoutes from "./routes/discussionRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: function (origin, callback) {
    // Reflects the requesting origin to fully allow all cross-origin requests
    callback(null, true);
  },
  credentials: true // Optional but useful if you ever switch to cookies
};

// Socket.IO for real-time discussion
const io = new Server(server, { cors: corsOptions });

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));

// Socket.IO event handlers for discussion rooms
io.on("connection", function handleSocketConnection(socket) {
  // When a user opens an event page, they join that event's room
  socket.on("joinEvent", function handleJoinEvent(eventId) {
    socket.join(eventId);
  });

  // When a user leaves an event page, they leave that event's room
  socket.on("leaveEvent", function handleLeaveEvent(eventId) {
    socket.leave(eventId);
  });

  // When a user sends a message, broadcast it to everyone in that event's room
  socket.on("newMessage", function handleNewMessage(data) {
    io.to(data.eventId).emit("message", data);
  });
});

// Connect to MongoDB and start the server
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected");
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }

  // Mount API routes
  app.use("/api/users", userRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/events", eventCrud);
  app.use("/api/events", registrationRoutes);
  app.use("/api/events", normalRegistration);
  app.use("/api/events", merchandiseRegistration);
  app.use("/api/organizers", organizerRoutes);
  app.use("/api/discussions", discussionRoutes);
  app.use("/api/notifications", notificationRoutes);

  // Health check
  app.get("/", function handleHealthCheck(request, response) {
    response.send("Server running");
  });

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Server started on port ${PORT}`));
};

start();
