// eventCrud.js — Event creation, editing, browsing, and feedback endpoints

import express from "express";
import Fuse from "fuse.js";
import Event from "../models/Event.js";
import Organizer from "../models/Organizer.js";
import Registration from "../models/Registration.js";
import Feedback from "../models/Feedback.js";
import User from "../models/User.js";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware.js";
import { sendDiscordWebhook } from "../utils/mailer.js";
import { computeStatus, withStatus, findOrganizerAndEvent } from "./eventHelpers.js";

const router = express.Router();

/* ── Create Event (organizer) ── */
router.post("/", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        // Find the organizer profile linked to the logged-in user
        const organizer = await Organizer.findOne({ userId: request.user.userId });
        if (!organizer) {
            return response.status(404).json({ message: "Organizer not found" });
        }

        // Determine status: default to "draft" unless explicitly set to "published"
        const eventStatus = request.body.status === "published" ? "published" : "draft";

        // Create event with all fields from the request body
        const event = await Event.create({
            name: request.body.name,
            description: request.body.description,
            eventType: request.body.eventType,
            eligibility: request.body.eligibility,
            startDate: request.body.startDate,
            endDate: request.body.endDate,
            registrationLimit: request.body.registrationLimit,
            registrationFee: request.body.registrationFee,
            tags: request.body.tags,
            customForm: request.body.customForm,
            merchandiseItems: request.body.merchandiseItems,
            organizerId: organizer._id,
            status: eventStatus,
            registrationOpen: false, // always closed at creation — organizer opens explicitly
        });

        // Send Discord notification if webhook is configured and event is published
        if (event.status === "published" && organizer.discordWebhookUrl) {
            await sendDiscordWebhook(organizer.discordWebhookUrl, event);
        }

        response.status(201).json(event);
    } catch (error) {
        if (error.name === "ValidationError") {
            return response.status(400).json({ message: error.message });
        }
        console.error(error);
        response.status(500).json({ message: "Server error" });
    }
});

/* ── My Events (organizer dashboard) ── */
router.get("/my-events", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const organizer = await Organizer.findOne({ userId: request.user.userId });
        if (!organizer) {
            return response.status(404).json({ message: "Organizer not found" });
        }

        const events = await Event.find({ organizerId: organizer._id }).sort({ createdAt: -1 });
        response.json(withStatus(events));
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Organizer Dashboard Stats (Completed Events Only) ── */
router.get("/organizer-stats", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const organizer = await Organizer.findOne({ userId: request.user.userId });
        if (!organizer) {
            return response.status(404).json({ message: "Organizer not found" });
        }

        // Fetch events authored by this organizer that are "completed"
        const completedEvents = await Event.find({
            organizerId: organizer._id,
            status: "completed"
        });

        let totalRegistrations = 0;
        let totalRevenue = 0;
        let totalAttended = 0;

        for (const event of completedEvents) {
            totalRegistrations += event.registrationCount;

            // Find all registrations for this completed event
            const registrations = await Registration.find({ eventId: event._id });
            for (const reg of registrations) {
                if (reg.attended) {
                    totalAttended += 1;
                }
                if (reg.paymentStatus === "approved" || reg.paymentStatus === "not_required") {
                    totalRevenue += reg.amountPaid || 0;
                }
            }
        }

        response.json({
            completedEventCount: completedEvents.length,
            totalRegistrations,
            totalAttended,
            totalRevenue,
        });

    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Edit Event (organizer) ── */
router.patch("/:id", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        // Verify the organizer owns this event
        const result = await findOrganizerAndEvent(request.user.userId, request.params.id);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        const { event } = result;
        const updates = request.body;
        const liveStatus = computeStatus(event);

        // Don't allow custom form or merchandise changes once registrations exist
        if (updates.customForm && event.registrationCount > 0) {
            return response.status(400).json({ message: "Cannot edit form after registrations" });
        }
        if (updates.merchandiseItems && event.registrationCount > 0) {
            return response.status(400).json({ message: "Cannot edit merchandise items after registrations" });
        }

        // Apply edits based on event's live status
        if (liveStatus === "draft") {
            // Draft events can be fully edited (except registrationOpen — separate action)
            const { registrationOpen, ...safeUpdates } = updates;
            Object.assign(event, safeUpdates);
        } else if (liveStatus === "published") {
            // Published: description, increase limit, tags
            if (updates.description !== undefined) {
                event.description = updates.description;
            }
            if (updates.registrationLimit !== undefined && updates.registrationLimit >= event.registrationLimit) {
                event.registrationLimit = updates.registrationLimit;
            }
            if (updates.tags !== undefined) {
                event.tags = updates.tags;
            }
        } else if (liveStatus === "ongoing") {
            // Ongoing: only mark completed
            if (updates.status === "completed") {
                event.status = "completed";
                event.registrationOpen = false;
            }
        }
        // Completed: no edits allowed

        await event.save();
        response.json(event);
    } catch (error) {
        // Return Mongoose validation errors as 400 instead of 500
        if (error.name === "ValidationError") {
            return response.status(400).json({ message: error.message });
        }
        console.error(error);
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Publish Event ── */
router.patch("/:id/publish", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const result = await findOrganizerAndEvent(request.user.userId, request.params.id);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        const { organizer, event } = result;

        if (event.status !== "draft") {
            return response.status(400).json({ message: "Only draft events can be published" });
        }

        event.status = "published";
        // Registration stays closed — organizer must explicitly open it
        await event.save();

        // Send Discord webhook notification
        if (organizer.discordWebhookUrl) {
            await sendDiscordWebhook(organizer.discordWebhookUrl, event);
        }

        response.json({ message: "Event published", event });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Toggle Registration Open/Close (organizer) ── */
// Open: requires a registrationDeadline in the body
// Close: no deadline needed
router.patch("/:id/registration", authenticate, authorizeRoles("organizer"), async (request, response) => {
    try {
        const result = await findOrganizerAndEvent(request.user.userId, request.params.id);
        if (result.error) {
            return response.status(result.status).json({ message: result.error });
        }

        const { event } = result;
        const liveStatus = computeStatus(event);

        // Only published or ongoing events can toggle registration
        if (liveStatus !== "published" && liveStatus !== "ongoing") {
            return response.status(400).json({ message: "Can only toggle registration for published or ongoing events" });
        }

        const { action, registrationDeadline } = request.body;

        if (action === "open") {
            if (!registrationDeadline) {
                return response.status(400).json({ message: "Registration deadline is required when opening registration" });
            }
            if (new Date(registrationDeadline) <= new Date()) {
                return response.status(400).json({ message: "Registration deadline must be in the future" });
            }
            event.registrationOpen = true;
            event.registrationDeadline = registrationDeadline;
        } else if (action === "close") {
            event.registrationOpen = false;
        } else {
            return response.status(400).json({ message: "Invalid action. Use 'open' or 'close'" });
        }

        await event.save();
        response.json({ message: `Registration ${action === "open" ? "opened" : "closed"}`, event });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Browse Events (authenticated) ── */
router.get("/", authenticate, async (request, response) => {
    try {
        const search = request.query.search;
        const type = request.query.type;
        const eligibility = request.query.eligibility;
        const dateFrom = request.query.dateFrom;
        const dateTo = request.query.dateTo;
        const trending = request.query.trending;
        const followedClubs = request.query.followedClubs;
        const page = request.query.page || 1;
        const limit = request.query.limit || 20;

        // Trending: top 5 events by registrations in last 24 hours
        if (trending === "true") {
            const oneDayAgo = new Date(Date.now() - 86400000);
            const pipeline = [
                { $match: { registeredAt: { $gte: oneDayAgo } } },
                { $group: { _id: "$eventId", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ];
            const trendingResults = await Registration.aggregate(pipeline);
            const trendingIds = [];
            for (const item of trendingResults) {
                trendingIds.push(item._id);
            }

            const events = await Event.find({
                _id: { $in: trendingIds },
                status: { $in: ["published", "ongoing"] },
            }).populate("organizerId", "name");

            return response.json(withStatus(events));
        }

        // Build filter query
        const query = { status: { $in: ["published", "ongoing"] } };

        // Apply non-search filters first
        if (type) {
            query.eventType = type;
        }
        if (eligibility) {
            query.eligibility = eligibility;
        }
        if (dateFrom || dateTo) {
            query.startDate = {};
            if (dateFrom) {
                query.startDate.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                query.startDate.$lte = new Date(dateTo);
            }
        }
        if (followedClubs) {
            query.organizerId = { $in: followedClubs.split(",") };
        }

        // Fetch events matching the non-search filters
        let events = await Event.find(query)
            .populate("organizerId", "name")
            .sort({ startDate: 1 });

        // Apply fuzzy search using Fuse.js (searches event name, tags, and organizer name)
        if (search) {
            const fuseData = events.map((event) => ({
                ...event.toObject(),
                _organizerName: event.organizerId?.name || "",
            }));

            const fuse = new Fuse(fuseData, {
                keys: ["name", "tags", "_organizerName"],
                threshold: 0.4,
                ignoreLocation: true,
            });

            const results = fuse.search(search);
            events = results.map((result) => result.item);
        }

        // Preference-based scoring for participants
        if (request.user.role === "participant") {
            const participant = await User.findById(request.user.userId).select("areasOfInterest followedClubs");
            if (participant) {
                const interests = (participant.areasOfInterest || []).map(i => i.toLowerCase());
                const followed = (participant.followedClubs || []).map(id => id.toString());

                events = events.map(e => {
                    const eventObj = e.toObject ? e.toObject() : e;
                    let score = 0;
                    // +2 if the event's organizer is in followedClubs
                    const orgId = eventObj.organizerId?._id?.toString() || eventObj.organizerId?.toString() || "";
                    if (followed.includes(orgId)) score += 2;
                    // +1 per matching tag in areasOfInterest
                    const eventTags = (eventObj.tags || []).map(t => t.toLowerCase());
                    for (const tag of eventTags) {
                        if (interests.includes(tag)) score += 1;
                    }
                    return { ...eventObj, _prefScore: score };
                });

                // Sort by preference score descending, then startDate ascending
                events.sort((a, b) => {
                    if (b._prefScore !== a._prefScore) return b._prefScore - a._prefScore;
                    return new Date(a.startDate) - new Date(b.startDate);
                });
            }
        }

        // Apply pagination
        const skip = (page - 1) * limit;
        events = events.slice(skip, skip + Number(limit));

        response.json(withStatus(events));
    } catch (error) {
        console.error(error);
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Get Single Event (authenticated) ── */
router.get("/:id", authenticate, async (request, response) => {
    try {
        const event = await Event.findById(request.params.id)
            .populate("organizerId", "name category contactEmail");

        if (!event) {
            return response.status(404).json({ message: "Event not found" });
        }

        // Convert to plain object and compute live status
        const eventData = event.toObject();
        eventData.status = computeStatus(event);
        response.json(eventData);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Submit Feedback (participant) ── */
router.post("/:id/feedback", authenticate, authorizeRoles("participant"), async (request, response) => {
    try {
        const { rating, comment } = request.body;

        if (!rating || rating < 1 || rating > 5) {
            return response.status(400).json({ message: "Rating must be 1-5" });
        }

        // Check that user is registered for this event and has attended
        const registration = await Registration.findOne({
            eventId: request.params.id,
            userId: request.user.userId,
        });
        if (!registration) {
            return response.status(403).json({ message: "You must be registered for this event" });
        }
        if (!registration.attended) {
            return response.status(403).json({ message: "You must have attended this event to submit feedback" });
        }

        // Prevent duplicate feedback using the registration flag (not userId in Feedback)
        if (registration.feedbackSubmitted) {
            return response.status(400).json({ message: "Already submitted feedback" });
        }

        // Create truly anonymous feedback — no userId stored
        const feedback = await Feedback.create({
            eventId: request.params.id,
            rating,
            comment,
        });

        // Mark that this participant has submitted feedback
        registration.feedbackSubmitted = true;
        await registration.save();

        response.status(201).json(feedback);
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

/* ── Get Feedback for Event (authenticated) ── */
router.get("/:id/feedback", authenticate, async (request, response) => {
    try {
        const query = { eventId: request.params.id };

        // Support filtering by rating
        if (request.query.rating) {
            query.rating = Number(request.query.rating);
        }

        const feedbacks = await Feedback.find(query)
            .sort({ createdAt: -1 });

        // Calculate average rating (always from all feedbacks, not filtered)
        const allFeedbacks = await Feedback.find({ eventId: request.params.id });
        const totalCount = allFeedbacks.length;
        let averageRating = 0;
        if (totalCount > 0) {
            let ratingSum = 0;
            for (const feedbackItem of allFeedbacks) {
                ratingSum = ratingSum + feedbackItem.rating;
            }
            averageRating = +(ratingSum / totalCount).toFixed(1);
        }

        response.json({ feedbacks, stats: { total: totalCount, avgRating: averageRating } });
    } catch (error) {
        response.status(500).json({ message: "Server error" });
    }
});

export default router;
