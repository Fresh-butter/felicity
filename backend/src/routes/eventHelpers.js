// eventHelpers.js — Shared utility functions for event routes

import Event from "../models/Event.js";
import Organizer from "../models/Organizer.js";

// Compute the live status of an event based on current time.
// Draft is manually set so we don't override it.
// Published events become "ongoing" when between start and end dates,
// and "completed" when past the end date.
export function computeStatus(event) {
    const now = new Date();

    if (event.status === "draft") {
        return event.status;
    }

    if (now >= event.startDate && now <= event.endDate) {
        return "ongoing";
    }

    if (now > event.endDate) {
        return "completed";
    }

    return event.status;
}

// Apply computeStatus to an array of events and return plain objects
export function withStatus(events) {
    const results = [];

    for (const event of events) {
        const eventObject = typeof event.toObject === "function" ? event.toObject() : { ...event };
        eventObject.status = computeStatus(event);
        results.push(eventObject);
    }

    return results;
}

// Check if a user is eligible for an event based on participantType.
// Returns an error message string if ineligible, or null if eligible.
export function checkEligibility(event, user) {
    if (event.eligibility === "iiit" && user.participantType !== "iiit") {
        return "This event is for IIIT participants only";
    }
    if (event.eligibility === "non-iiit" && user.participantType !== "non-iiit") {
        return "This event is for Non-IIIT participants only";
    }

    return null;
}

// Find the organizer by their userId and verify they own the specified event.
// Returns { organizer, event } on success, or { error, status } on failure.
export async function findOrganizerAndEvent(userId, eventId) {
    const organizer = await Organizer.findOne({ userId });
    const event = await Event.findById(eventId);

    if (!event) {
        return { error: "Event not found", status: 404 };
    }

    if (!organizer || !event.organizerId.equals(organizer._id)) {
        return { error: "Not your event", status: 403 };
    }

    return { organizer, event };
}
