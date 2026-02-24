// Events.jsx — Browse and filter events

import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import useApi from "../hooks/useApi";

export default function Events() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const api = useApi();
  const [events, setEvents] = useState([]);

  // Individual filter states instead of a single object
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterEligibility, setFilterEligibility] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showTrending, setShowTrending] = useState(false);
  const [showFollowed, setShowFollowed] = useState(false);

  // Reload events whenever any filter changes
  useEffect(() => {
    loadEvents();
  }, [search, filterType, filterEligibility, dateFrom, dateTo, showTrending, showFollowed]);

  async function loadEvents() {
    const params = new URLSearchParams();

    if (showTrending) {
      // Trending mode: only send the trending flag
      params.append("trending", "true");
    } else {
      // Normal mode: add all active filters
      if (search) params.append("search", search);
      if (filterType) params.append("type", filterType);
      if (filterEligibility) params.append("eligibility", filterEligibility);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      if (showFollowed) {
        // Fetch user's followed clubs and filter by them
        const profile = await api.get("/users/profile");
        if (profile?.followedClubs?.length) {
          const clubIds = profile.followedClubs.map((club) => club._id || club);
          params.append("followedClubs", clubIds.join(","));
        }
      }
    }

    const data = await api.get(`/events?${params}`);
    if (data) {
      setEvents(data);
    }
  }

  return (
    <div className="page-container">
      <h2>Events</h2>

      {/* Filter controls */}
      <div className="filters-bar">
        <input placeholder="Search..." value={search} onChange={(event) => setSearch(event.target.value)} />
        <select value={filterType} onChange={(event) => setFilterType(event.target.value)}>
          <option value="">All Types</option>
          <option value="normal">Normal</option>
          <option value="merchandise">Merchandise</option>
        </select>
        <select value={filterEligibility} onChange={(event) => setFilterEligibility(event.target.value)}>
          <option value="">All</option>
          <option value="all">Open</option>
          <option value="iiit">IIIT</option>
          <option value="non-iiit">Non-IIIT</option>
        </select>
        <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <button
          className={showTrending ? "btn-accent" : "btn-secondary"}
          onClick={() => setShowTrending(!showTrending)}
        >
          Trending
        </button>
        {user && (
          <button
            className={showFollowed ? "btn-accent" : "btn-secondary"}
            onClick={() => setShowFollowed(!showFollowed)}
          >
            Followed
          </button>
        )}
      </div>

      {/* Event cards grid */}
      {events.length === 0 ? (
        <p className="muted">No events found.</p>
      ) : (
        <div className="events-grid">
          {events.map((event) => (
            <div key={event._id} className="card event-card" onClick={() => navigate(`/events/${event._id}`)}>
              <h3 style={{ fontSize: 15 }}>{event.name}</h3>
              <div className="badge-row">
                <span className={`badge badge-${event.eventType}`}>{event.eventType}</span>
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
                {event.organizerId?.name || "?"} | {new Date(event.startDate).toLocaleDateString()} | {event.registrationCount || 0}/{event.registrationLimit}
              </p>
              {event.tags?.length > 0 && (
                <div className="tags">
                  {event.tags.map((tag, index) => (
                    <span key={index} className="tag">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
