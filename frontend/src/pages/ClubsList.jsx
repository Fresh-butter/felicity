// ClubsList.jsx — Browse and follow/unfollow clubs

import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import useApi from "../hooks/useApi";

export default function ClubsList() {
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);
    const api = useApi();
    const [clubs, setClubs] = useState([]);
    const [followedClubIds, setFollowedClubIds] = useState([]);

    useEffect(() => {
        // Load all clubs
        api.get("/organizers").then((data) => {
            if (data) setClubs(data);
        });

        // Load followed clubs for logged-in participants
        if (user) {
            api.get("/users/profile").then((profileData) => {
                if (profileData) {
                    const ids = profileData.followedClubs?.map((club) => club._id || club) || [];
                    setFollowedClubIds(ids);
                }
            });
        }
    }, []);

    // Toggle follow/unfollow for a club
    async function handleToggleFollow(clubId) {
        const isCurrentlyFollowed = followedClubIds.includes(clubId);
        const endpoint = isCurrentlyFollowed ? "unfollow" : "follow";

        await api.post(`/users/${endpoint}/${clubId}`, {});

        // Refresh followed clubs from server
        const profileData = await api.get("/users/profile");
        if (profileData) {
            const updatedIds = profileData.followedClubs?.map((club) => club._id || club) || [];
            setFollowedClubIds(updatedIds);
        }
    }

    return (
        <div className="page-container">
            <h2>Clubs</h2>
            <div className="events-grid">
                {clubs.map((club) => (
                    <div key={club._id} className="card event-card">
                        <h3 style={{ fontSize: 15 }}>{club.name}</h3>
                        <span className="tag">{club.category}</span>
                        <p className="muted">{club.description || "No description"}</p>
                        <div className="btn-row">
                            <button className="btn-sm" onClick={() => navigate(`/clubs/${club._id}`)}>View</button>
                            {user?.role === "participant" && (
                                <button
                                    className={followedClubIds.includes(club._id) ? "btn-sm btn-danger" : "btn-sm btn-success"}
                                    onClick={() => handleToggleFollow(club._id)}
                                >
                                    {followedClubIds.includes(club._id) ? "Unfollow" : "Follow"}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {clubs.length === 0 && <p className="muted">No clubs yet.</p>}
            </div>
        </div>
    );
}
