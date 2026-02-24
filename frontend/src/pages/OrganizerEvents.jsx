// OrganizerEvents.jsx — Organizer's event management page

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi";

export default function OrganizerEvents() {
  const navigate = useNavigate();
  const api = useApi();
  const [events, setEvents] = useState([]);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    loadEvents();
  }, []);

  function loadEvents() {
    api.get("/events/my-events").then((data) => {
      if (data) setEvents(data);
    });
  }

  // Publish a draft event
  async function handlePublish(eventId) {
    const { ok } = await api.patch(`/events/${eventId}/publish`);
    if (ok) {
      setStatusMessage("Published");
      loadEvents();
    }
  }

  return (
    <div className="page-container">
      <h2>My Events</h2>
      {statusMessage && <p className="msg msg-success">{statusMessage}</p>}
      <button className="btn-accent" onClick={() => navigate("/organizer/create")} style={{ marginBottom: 10 }}>
        + Create Event
      </button>

      {events.length === 0 ? (
        <p className="muted">No events.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Start</th>
              <th>Status</th>
              <th>Reg</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event._id}>
                <td>{event.name}</td>
                <td>{event.eventType}</td>
                <td>{new Date(event.startDate).toLocaleDateString()}</td>
                <td>
                  <span className={`badge badge-${event.status}`}>{event.status}</span>
                  {" "}
                  {(event.status === "published" || event.status === "ongoing") && (() => {
                    const effectivelyOpen = event.registrationOpen && new Date() < new Date(event.registrationDeadline);
                    const isFull = event.registrationCount >= event.registrationLimit;
                    const label = !effectivelyOpen ? "Closed" : isFull ? "Full" : "Open";
                    const cls = effectivelyOpen && !isFull ? "badge-published" : "badge-closed";
                    return <span className={`badge ${cls}`}>{label}</span>;
                  })()}
                </td>
                <td>{event.registrationCount}/{event.registrationLimit}</td>
                <td className="action-cell">
                  {event.status === "draft" && (
                    <button className="btn-sm" onClick={() => handlePublish(event._id)}>Publish</button>
                  )}
                  <button className="btn-sm" onClick={() => navigate(`/organizer/events/${event._id}`)}>Details</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
