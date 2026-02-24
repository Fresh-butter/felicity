// OrganizerCreateEvent.jsx — Dedicated page for creating a new event

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi";
import EventForm from "../components/EventForm";

export default function OrganizerCreateEvent() {
    const navigate = useNavigate();
    const api = useApi();
    const [statusMessage, setStatusMessage] = useState("");

    async function handleCreateEvent(body) {
        const { ok, data } = await api.post("/events", body);

        if (ok) {
            setStatusMessage("Event created successfully!");
            // Navigate to the new event's detail page after a short delay
            setTimeout(() => navigate(`/organizer/events/${data._id}`), 800);
        } else {
            setStatusMessage(data.message || "Failed to create event");
        }
    }

    return (
        <div className="page-container" style={{ maxWidth: 700, margin: "0 auto" }}>
            <button className="btn-secondary" onClick={() => navigate("/organizer/events")}>Back to Events</button>
            <h2 style={{ marginTop: 10 }}>Create New Event</h2>
            {statusMessage && <p className="msg msg-success">{statusMessage}</p>}
            <EventForm onSubmit={handleCreateEvent} onCancel={() => navigate("/organizer/events")} />
        </div>
    );
}
