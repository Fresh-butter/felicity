// authMiddleware.js — JWT authentication and role-based authorization

import jwt from "jsonwebtoken";

// Middleware: verify JWT token from Authorization header
export const authenticate = (request, response, next) => {
  const authHeader = request.headers.authorization;

  // Check that the header exists and uses Bearer scheme
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return response.status(401).json({ message: "No token provided" });
  }

  // Extract the token after "Bearer "
  const token = authHeader.split(" ")[1];

  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Attach user info (userId, role) to the request for downstream use
    request.user = decoded;

    next();
  } catch (error) {
    return response.status(401).json({ message: "Invalid token" });
  }
};

// Middleware factory: restrict access to specific roles
export const authorizeRoles = (...allowedRoles) => {
  return (request, response, next) => {
    if (!allowedRoles.includes(request.user.role)) {
      return response.status(403).json({ message: "Not authorized" });
    }

    next();
  };
};
