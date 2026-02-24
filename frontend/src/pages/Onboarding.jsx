// Onboarding.jsx — Post-signup preferences: interests, contact, college, and club following

import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi";
import { AuthContext } from "../context/AuthContext";

const INTERESTS = ["Technical", "Cultural", "Sports", "Gaming", "Media", "Literary", "Music", "Art", "Dance", "Coding"];

export default function Onboarding() {
    const api = useApi();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    // Determine if the user is an IIIT participant
    const isIiit = user?.participantType === "iiit";

    const [contactNumber, setContactNumber] = useState("");
    const [contactError, setContactError] = useState("");
    const [collegeName, setCollegeName] = useState(isIiit ? "IIIT Hyderabad" : "");
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [allClubs, setAllClubs] = useState([]);
    const [followedClubIds, setFollowedClubIds] = useState([]);

    // Load available clubs on mount
    useEffect(() => {
        api.get("/organizers").then((data) => {
            if (data) {
                setAllClubs(data);
            }
        });
    }, []);

    // Toggle an interest on or off
    function handleToggleInterest(interest) {
        if (selectedInterests.includes(interest)) {
            setSelectedInterests(selectedInterests.filter((item) => item !== interest));
        } else {
            setSelectedInterests([...selectedInterests, interest]);
        }
    }

    // Toggle a club follow on or off
    function handleToggleClub(clubId) {
        if (followedClubIds.includes(clubId)) {
            setFollowedClubIds(followedClubIds.filter((id) => id !== clubId));
        } else {
            setFollowedClubIds([...followedClubIds, clubId]);
        }
    }

    // Save preferences and go to dashboard
    // Allow only digits in contact number
    function handleContactChange(event) {
        const value = event.target.value.replace(/\D/g, "");
        setContactNumber(value);
        if (value && value.length !== 10) {
            setContactError("Contact number must be exactly 10 digits");
        } else {
            setContactError("");
        }
    }

    async function handleSavePreferences() {
        // Validate contact number is exactly 10 digits (if provided)
        if (contactNumber && contactNumber.length !== 10) {
            setContactError("Contact number must be exactly 10 digits");
            return;
        }
        await api.put("/users/profile", {
            contactNumber,
            collegeName,
            areasOfInterest: selectedInterests,
            followedClubs: followedClubIds,
        });
        navigate("/dashboard");
    }

    return (
        <div className="page-container" style={{ maxWidth: 480, margin: "0 auto" }}>
            <div className="card">
                <h2>Set Your Preferences</h2>
                <p className="muted">Fill in your details, pick interests and clubs. Change anytime.</p>

                <h4>Contact Number</h4>
                <input
                    type="tel"
                    placeholder="Enter your 10-digit contact number"
                    value={contactNumber}
                    onChange={handleContactChange}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    style={{ width: "100%", marginBottom: contactError ? 4 : 12 }}
                />
                {contactError && <p style={{ color: "red", fontSize: 12, marginBottom: 12 }}>{contactError}</p>}

                <h4>College Name</h4>
                <input
                    type="text"
                    placeholder="Enter your college name"
                    value={collegeName}
                    onChange={(event) => setCollegeName(event.target.value)}
                    disabled={isIiit}
                    style={{ width: "100%", marginBottom: 12, opacity: isIiit ? 0.6 : 1 }}
                />

                <h4>Interests</h4>
                <div className="chip-container">
                    {INTERESTS.map((interest) => (
                        <button
                            key={interest}
                            className={`chip ${selectedInterests.includes(interest) ? "chip-active" : ""}`}
                            onClick={() => handleToggleInterest(interest)}
                        >
                            {interest}
                        </button>
                    ))}
                </div>

                {allClubs.length > 0 && (
                    <>
                        <h4>Follow Clubs</h4>
                        <div className="chip-container">
                            {allClubs.map((club) => (
                                <button
                                    key={club._id}
                                    className={`chip ${followedClubIds.includes(club._id) ? "chip-active" : ""}`}
                                    onClick={() => handleToggleClub(club._id)}
                                >
                                    {club.name}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                <div className="btn-row" style={{ marginTop: 12 }}>
                    <button className="btn-accent" onClick={handleSavePreferences}>Save</button>
                    <button className="btn-secondary" onClick={() => navigate("/dashboard")}>Skip</button>
                </div>
            </div>
        </div>
    );
}
