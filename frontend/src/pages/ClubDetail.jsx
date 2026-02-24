// ClubDetail.jsx — Single club detail page with upcoming and past events

import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import useApi from "../hooks/useApi";

export default function ClubDetail() {
    const { id: clubId } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const api = useApi();
    const [clubData, setClubData] = useState(null);
    const [isFollowing, setIsFollowing] = useState(false);

    useEffect(() => {
        // Load club details with upcoming and past events
        api.get(`/organizers/${clubId}`).then((data) => {
            if (data) setClubData(data);
        });

        // Check if the current user follows this club
        if (user?.role === "participant") {
            api.get("/users/profile").then((profileData) => {
                if (profileData) {
                    const isFollowed = profileData.followedClubs?.some(
                        (club) => (club._id || club) === clubId
                    );
                    setIsFollowing(isFollowed);
                }
            });
        }
    }, [clubId]);

    // Toggle follow/unfollow
    async function handleToggleFollow() {
        const endpoint = isFollowing ? "unfollow" : "follow";
        await api.post(`/users/${endpoint}/${clubId}`, {});
        setIsFollowing(!isFollowing);
    }

    if (!clubData) return <p className="page-container">Loading...</p>;

    return (
        <div className="page-container" style={{ maxWidth: 650, margin: "0 auto" }}>
            <button className="btn-secondary" onClick={() => navigate("/clubs")}>Back</button>
            <h1 style={{ marginTop: 10 }}>{clubData.organizer.name}</h1>
            <span className="tag">{clubData.organizer.category}</span>
            <p className="muted" style={{ marginTop: 4 }}>
                {clubData.organizer.description || "No description"}
            </p>
            {clubData.organizer.contactEmail && (
                <p style={{ marginTop: 4 }}><strong>Contact:</strong> {clubData.organizer.contactEmail}</p>
            )}

            {user?.role === "participant" && (
                <button
                    className={isFollowing ? "btn-sm btn-danger" : "btn-accent"}
                    onClick={handleToggleFollow}
                    style={{ marginTop: 6 }}
                >
                    {isFollowing ? "Unfollow" : "Follow"}
                </button>
            )}

            {/* Upcoming Events */}
            {clubData.upcoming?.length > 0 && (
                <div>
                    <h3 style={{ marginTop: 16 }}>Upcoming</h3>
                    <div className="events-grid">
                        {clubData.upcoming.map((event) => (
                            <div key={event._id} className="card event-card" onClick={() => navigate(`/events/${event._id}`)}>
                                <h4 style={{ fontSize: 14 }}>{event.name}</h4>
                                <div className="badge-row">
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
                                    {new Date(event.startDate).toLocaleDateString()} | {event.registrationCount}/{event.registrationLimit}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Past Events */}
            {clubData.past?.length > 0 && (
                <div>
                    <h3 style={{ marginTop: 16 }}>Past</h3>
                    <div className="events-grid">
                        {clubData.past.map((event) => (
                            <div key={event._id} className="card event-card" onClick={() => navigate(`/events/${event._id}`)}>
                                <h4 style={{ fontSize: 14 }}>{event.name}</h4>
                                <div className="badge-row">
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
                                    {new Date(event.startDate).toLocaleDateString()} | {event.registrationCount}/{event.registrationLimit}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
