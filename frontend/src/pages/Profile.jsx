// Profile.jsx — View, edit profile, and change password

import { useState, useEffect, useContext } from "react";
import useApi from "../hooks/useApi";
import FormField from "../components/FormField";
import { AuthContext } from "../context/AuthContext";

const INTERESTS = ["Technical", "Cultural", "Sports", "Gaming", "Media", "Literary", "Music", "Art", "Dance", "Coding"];

export default function Profile() {
  const api = useApi();
  const { user } = useContext(AuthContext);

  // Determine if the user is an IIIT participant
  const isIiit = user?.participantType === "iiit";
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Editable form fields
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editContact, setEditContact] = useState("");
  const [contactError, setContactError] = useState("");
  const [editCollege, setEditCollege] = useState("");
  const [editInterests, setEditInterests] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [editFollowedClubs, setEditFollowedClubs] = useState([]);

  // Password form fields
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    loadProfile();
    // Load available clubs
    api.get("/organizers").then((data) => {
      if (data) setAllClubs(data);
    });
  }, []);

  async function loadProfile() {
    const data = await api.get("/users/profile");
    if (data) {
      setProfile(data);
      setEditFirstName(data.firstName || "");
      setEditLastName(data.lastName || "");
      setEditContact(data.contactNumber || "");
      // IIIT participants always have "IIIT Hyderabad" as college name
      setEditCollege(data.participantType === "iiit" ? "IIIT Hyderabad" : (data.collegeName || ""));
      setEditInterests(data.areasOfInterest || []);
      // followedClubs may be populated objects or IDs
      const clubIds = (data.followedClubs || []).map((club) =>
        typeof club === "object" ? club._id : club
      );
      setEditFollowedClubs(clubIds);
    }
  }

  // Allow only digits in contact number
  function handleContactChange(event) {
    const value = event.target.value.replace(/\D/g, "");
    setEditContact(value);
    if (value && value.length !== 10) {
      setContactError("Contact number must be exactly 10 digits");
    } else {
      setContactError("");
    }
  }

  async function handleSave() {
    // Validate contact number is exactly 10 digits (if provided)
    if (editContact && editContact.length !== 10) {
      setContactError("Contact number must be exactly 10 digits");
      return;
    }
    const { ok, data } = await api.put("/users/profile", {
      firstName: editFirstName,
      lastName: editLastName,
      contactNumber: editContact,
      collegeName: editCollege,
      areasOfInterest: editInterests,
      followedClubs: editFollowedClubs,
    });

    if (ok) {
      setProfile(data);
      setEditing(false);
      setStatusMessage("Profile saved");
    }
  }

  async function handleChangePassword() {
    const { ok, data } = await api.post("/users/change-password", {
      oldPassword,
      newPassword,
    });

    setStatusMessage(data.message);

    if (ok) {
      setOldPassword("");
      setNewPassword("");
      setShowPasswordForm(false);
    }
  }

  function handleToggleInterest(interest) {
    if (editInterests.includes(interest)) {
      setEditInterests(editInterests.filter((item) => item !== interest));
    } else {
      setEditInterests([...editInterests, interest]);
    }
  }

  function handleToggleClub(clubId) {
    if (editFollowedClubs.includes(clubId)) {
      setEditFollowedClubs(editFollowedClubs.filter((id) => id !== clubId));
    } else {
      setEditFollowedClubs([...editFollowedClubs, clubId]);
    }
  }

  if (!profile) return <p className="page-container">Loading...</p>;

  return (
    <div className="page-container" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h2>Profile</h2>
      {statusMessage && <p className="msg msg-success">{statusMessage}</p>}

      {/* View mode */}
      {!editing ? (
        <div className="card">
          <p><strong>Name:</strong> {profile.firstName} {profile.lastName}</p>
          <p><strong>Email:</strong> {profile.email}</p>
          <p><strong>Type:</strong> {profile.participantType}</p>
          <p><strong>Contact:</strong> {profile.contactNumber || "N/A"}</p>
          <p><strong>College:</strong> {profile.participantType === "iiit" ? "IIIT Hyderabad" : (profile.collegeName || "N/A")}</p>
          <p><strong>Interests:</strong> {profile.areasOfInterest?.join(", ") || "None"}</p>
          <p><strong>Following:</strong> {profile.followedClubs?.length > 0
            ? profile.followedClubs.map((club) => typeof club === "object" ? club.name : club).join(", ")
            : "None"}
          </p>
          <div className="btn-row">
            <button className="btn-accent" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn-secondary" onClick={() => setShowPasswordForm(!showPasswordForm)}>Change Password</button>
          </div>
        </div>
      ) : (
        /* Edit mode */
        <div className="card">
          <FormField label="First Name" required>
            <input value={editFirstName} onChange={(event) => setEditFirstName(event.target.value)} />
          </FormField>
          <FormField label="Last Name" required>
            <input value={editLastName} onChange={(event) => setEditLastName(event.target.value)} />
          </FormField>
          <FormField label="Contact">
            <input
              type="tel"
              value={editContact}
              onChange={handleContactChange}
              maxLength={10}
              pattern="[0-9]{10}"
              placeholder="10-digit number"
            />
            {contactError && <p style={{ color: "red", fontSize: 12, margin: "4px 0 0" }}>{contactError}</p>}
          </FormField>
          <FormField label="College">
            <input
              value={editCollege}
              onChange={(event) => setEditCollege(event.target.value)}
              disabled={isIiit}
              style={isIiit ? { opacity: 0.6 } : {}}
            />
          </FormField>
          <h4>Interests</h4>
          <div className="chip-container">
            {INTERESTS.map((interest) => (
              <button
                key={interest}
                className={`chip ${editInterests.includes(interest) ? "chip-active" : ""}`}
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
                    className={`chip ${editFollowedClubs.includes(club._id) ? "chip-active" : ""}`}
                    onClick={() => handleToggleClub(club._id)}
                  >
                    {club.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="btn-row">
            <button className="btn-accent" onClick={handleSave}>Save</button>
            <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Password change form */}
      {showPasswordForm && (
        <div className="card" style={{ marginTop: 10 }}>
          <h3>Change Password</h3>
          <FormField label="Current Password" required>
            <input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} />
          </FormField>
          <FormField label="New Password" required>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </FormField>
          <button className="btn-accent" onClick={handleChangePassword}>Change</button>
        </div>
      )}
    </div>
  );
}
