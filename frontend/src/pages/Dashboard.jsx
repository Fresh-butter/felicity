// Dashboard.jsx — Role-specific dashboard (admin, organizer, participant)

import { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi";

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const api = useApi();
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState("normal");

  useEffect(() => {
    if (!user) return;

    if (user.role === "participant") {
      api.get("/users/my-registrations").then((data) => {
        if (data) setRegistrations(data);
      });
    }

    if (user.role === "admin") {
      api.get("/admin/stats").then((data) => {
        if (data) setStats(data);
      });
    }

    if (user.role === "organizer") {
      api.get("/events/my-events").then((data) => {
        if (data) setEvents(data);
      });
      api.get("/events/organizer-stats").then((data) => {
        if (data) setStats(data);
      });
    }
  }, [user]);

  if (!user) return null;

  // Filter registrations into categories for participant dashboard
  const now = new Date();

  // Normal: upcoming normal events (not ended, payment not rejected)
  const normalRegistrations = registrations.filter((registration) => {
    const hasEvent = registration.eventId !== null;
    const isNormal = registration.eventId?.eventType === "normal";
    const isUpcoming = new Date(registration.eventId?.endDate) >= now;
    const notRejected = registration.paymentStatus !== "rejected";
    return hasEvent && isNormal && isUpcoming && notRejected;
  });

  // Merchandise: upcoming merchandise events (not ended, payment not rejected)
  const merchandiseRegistrations = registrations.filter((registration) => {
    const hasEvent = registration.eventId !== null;
    const isMerch = registration.eventId?.eventType === "merchandise";
    const isUpcoming = new Date(registration.eventId?.endDate) >= now;
    const notRejected = registration.paymentStatus !== "rejected";
    return hasEvent && isMerch && isUpcoming && notRejected;
  });

  // Completed: events that have ended
  const completedRegistrations = registrations.filter((registration) => {
    const hasEvent = registration.eventId !== null;
    const isPast = new Date(registration.eventId?.endDate) < now;
    const notRejected = registration.paymentStatus !== "rejected";
    return hasEvent && isPast && notRejected;
  });

  // Cancelled/Rejected: payment was rejected by organizer
  const cancelledRegistrations = registrations.filter((registration) => {
    return registration.paymentStatus === "rejected";
  });

  // Tab definitions for participant dashboard
  const tabData = {
    normal: normalRegistrations,
    merchandise: merchandiseRegistrations,
    completed: completedRegistrations,
    cancelled: cancelledRegistrations,
  };

  return (
    <div className="page-container">
      <h1>Welcome, {user.firstName}</h1>

      {/* Admin Dashboard */}
      {user.role === "admin" && stats && (
        <>
          <div className="stats-grid" style={{ margin: "10px 0" }}>
            <div className="stat-card"><h3>{stats.totalOrganizers}</h3><p>Clubs</p></div>
            <div className="stat-card"><h3>{stats.activeOrganizers}</h3><p>Active Clubs</p></div>
            <div className="stat-card"><h3>{stats.totalParticipants}</h3><p>Participants</p></div>
            <div className="stat-card"><h3>{stats.totalEvents}</h3><p>Events</p></div>
            <div className="stat-card"><h3>{stats.upcomingEvents}</h3><p>Upcoming Events</p></div>
            <div className="stat-card"><h3>{stats.totalRegistrations}</h3><p>Registrations</p></div>
            <div className="stat-card"><h3>{stats.pendingResets}</h3><p>Pending Resets</p></div>
          </div>
          <div className="btn-row">
            <button className="btn-accent" onClick={() => navigate("/admin/organizers")}>Manage Clubs</button>
            <button className="btn-secondary" onClick={() => navigate("/admin/password-resets")}>Password Resets</button>
          </div>
        </>
      )}

      {/* Organizer Dashboard */}
      {user.role === "organizer" && (
        <>
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <button className="btn-accent" onClick={() => navigate("/organizer/events")}>Manage Events</button>
            <button className="btn-secondary" onClick={() => navigate("/organizer/profile")}>Profile</button>
            <button className="btn-secondary" onClick={() => navigate("/organizer/payments")}>Merchandise Approvals</button>
          </div>

          {stats && (
            <>
              <h3 style={{ marginTop: 24, marginBottom: 8 }}>Analytics (Completed Events)</h3>
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card"><h3>{stats.completedEventCount}</h3><p>Completed Events</p></div>
                <div className="stat-card"><h3>{stats.totalRegistrations}</h3><p>Registrations</p></div>
                <div className="stat-card"><h3>{stats.totalAttended}</h3><p>Attendance</p></div>
                <div className="stat-card"><h3>₹{stats.totalRevenue}</h3><p>Revenue</p></div>
              </div>
            </>
          )}

          <h3 style={{ marginTop: 12, marginBottom: 8 }}>My Events</h3>
          <div className="events-grid">
            {events.map((event) => (
              <div key={event._id} className="card event-card" onClick={() => navigate(`/organizer/events/${event._id}`)}>
                <h4>{event.name}</h4>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
                  <span className={`badge badge-${event.status}`}>{event.status}</span>
                  {(event.status === "published" || event.status === "ongoing") && (() => {
                    const effectivelyOpen = event.registrationOpen && new Date() < new Date(event.registrationDeadline);
                    const isFull = event.registrationCount >= event.registrationLimit;
                    const label = !effectivelyOpen ? "Reg Closed" : isFull ? "Full" : "Reg Open";
                    const cls = effectivelyOpen && !isFull ? "badge-published" : "badge-closed";
                    return <span className={`badge ${cls}`}>{label}</span>;
                  })()}
                </div>
                <p className="muted">
                  {event.eventType} | {new Date(event.startDate).toLocaleDateString()} | {event.registrationCount}/{event.registrationLimit}
                </p>
              </div>
            ))}
            {events.length === 0 && <p className="muted">No events yet.</p>}
          </div>
        </>
      )}

      {/* Participant Dashboard */}
      {user.role === "participant" && (
        <>
          <div className="btn-row" style={{ marginBottom: 10 }}>
            <button className="btn-accent" onClick={() => navigate("/events")}>Browse Events</button>
            <button className="btn-secondary" onClick={() => navigate("/clubs")}>Clubs</button>
          </div>

          {/* ── Upcoming Events (all registered upcoming, regardless of type) ── */}
          <h3 style={{ marginTop: 10, marginBottom: 6 }}>Upcoming Events</h3>
          {(() => {
            const upcomingAll = registrations.filter((r) => {
              const hasEvent = r.eventId !== null;
              const isUpcoming = new Date(r.eventId?.endDate) >= now;
              const notRejected = r.paymentStatus !== "rejected";
              return hasEvent && isUpcoming && notRejected;
            });
            if (upcomingAll.length === 0) return <p className="muted" style={{ marginBottom: 14 }}>No upcoming events.</p>;
            return (
              <div className="events-grid" style={{ marginBottom: 14 }}>
                {upcomingAll.map((registration) => (
                  <div
                    key={registration._id}
                    className="card event-card"
                    onClick={() => navigate(`/events/${registration.eventId?._id}`)}
                  >
                    <h4 style={{ fontSize: 14 }}>{registration.eventId?.name || "Deleted"}</h4>
                    <div className="badge-row">
                      <span className={`badge badge-${registration.eventId?.eventType}`}>{registration.eventId?.eventType}</span>
                      {registration.paymentStatus !== "not_required" && (
                        <span className={`badge badge-${registration.paymentStatus}`}>{registration.paymentStatus}</span>
                      )}
                    </div>
                    <p className="muted">
                      {registration.eventId?.organizerId?.name || "?"}
                      {" | "}{new Date(registration.eventId?.startDate).toLocaleDateString()}
                      {" — "}{new Date(registration.eventId?.endDate).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* ── Participation History (tabs) ── */}
          <h3 style={{ marginTop: 6, marginBottom: 6 }}>Participation History</h3>

          {/* Tab buttons */}
          <div className="tabs">
            <button
              className={`tab ${activeTab === "normal" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("normal")}
            >
              Normal ({normalRegistrations.length})
            </button>
            <button
              className={`tab ${activeTab === "merchandise" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("merchandise")}
            >
              Merchandise ({merchandiseRegistrations.length})
            </button>
            <button
              className={`tab ${activeTab === "completed" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("completed")}
            >
              Completed ({completedRegistrations.length})
            </button>
            <button
              className={`tab ${activeTab === "cancelled" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("cancelled")}
            >
              Cancelled ({cancelledRegistrations.length})
            </button>
          </div>

          {/* Tab content — list of registrations */}
          {tabData[activeTab].length === 0 ? (
            <p className="muted">Nothing here.</p>
          ) : (
            tabData[activeTab].map((registration) => (
              <div
                key={registration._id}
                className="card"
                style={{ marginBottom: 6, cursor: "pointer" }}
                onClick={() => navigate(`/events/${registration.eventId?._id}`)}
              >
                <strong>{registration.eventId?.name || "Deleted"}</strong>
                <p className="muted">
                  {registration.eventId?.eventType} | {registration.eventId?.organizerId?.name || "?"}
                  {" | "}{new Date(registration.eventId?.startDate).toLocaleDateString()}
                  {registration.paymentStatus !== "not_required" && ` | Payment: ${registration.paymentStatus}`}
                  {" | "}<span className="ticket-id">{registration.ticketId}</span>
                </p>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
