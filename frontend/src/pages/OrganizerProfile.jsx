// OrganizerProfile.jsx — Organizer club profile editor and password reset requests

import { useState, useEffect } from "react";
import useApi from "../hooks/useApi";
import FormField from "../components/FormField";

export default function OrganizerProfile() {
    const api = useApi();
    const [statusMessage, setStatusMessage] = useState("");
    const [resetReason, setResetReason] = useState("");
    const [resetHistory, setResetHistory] = useState([]);

    // Individual state for each editable profile field
    const [loginEmail, setLoginEmail] = useState("");
    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [description, setDescription] = useState("");
    const [contactEmail, setContactEmail] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [contactError, setContactError] = useState("");
    const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");

    // Load organizer profile on mount
    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const data = await api.get("/organizers/me/profile");
        if (data) {
            setLoginEmail(data.userId?.email || data.contactEmail || "");
            setName(data.name || "");
            setCategory(data.category || "");
            setDescription(data.description || "");
            setContactEmail(data.contactEmail || "");
            setContactNumber(data.contactNumber || "");
            setDiscordWebhookUrl(data.discordWebhookUrl || "");
        }

        // Fetch reset history
        const historyData = await api.get("/organizers/me/password-resets");
        if (historyData) setResetHistory(historyData);
    }

    // Save profile changes
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

    async function handleSave() {
        // Validation Reset
        setContactError("");
        setStatusMessage("");

        // Validate contact number is exactly 10 digits (if provided)
        if (contactNumber && contactNumber.length !== 10) {
            setContactError("Contact number must be exactly 10 digits");
            return;
        }

        // Validate Contact Email (basic regex)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(contactEmail)) {
            setStatusMessage("Invalid Contact Email format.");
            return;
        }

        // Validate Discord Webhook URL (if provided)
        if (discordWebhookUrl) {
            try {
                const url = new URL(discordWebhookUrl);
                if (url.protocol !== "http:" && url.protocol !== "https:") {
                    setStatusMessage("Discord Webhook must be a valid HTTP/HTTPS URL.");
                    return;
                }
            } catch (err) {
                setStatusMessage("Invalid Discord Webhook URL format.");
                return;
            }
        }

        const profileData = {
            name,
            category,
            description,
            contactEmail,
            contactNumber,
            discordWebhookUrl,
        };

        const { ok } = await api.put("/organizers/me/profile", profileData);
        setStatusMessage(ok ? "Profile saved successfully." : "Failed to save profile.");
    }

    // Request password reset from admin
    async function handleResetRequest() {
        if (!resetReason.trim()) return;

        const { ok, data } = await api.post("/organizers/me/request-password-reset", {
            reason: resetReason,
        });

        setStatusMessage(ok ? "Reset request sent" : data.message);
        setResetReason("");
        if (ok) loadData(); // refresh history
    }

    return (
        <div className="page-container" style={{ maxWidth: 480, margin: "0 auto" }}>
            <h2>Club Profile</h2>
            {statusMessage && <p className="msg msg-success">{statusMessage}</p>}

            <div className="card">
                <FormField label="Login Email (Read-Only)">
                    <input value={loginEmail} readOnly disabled />
                </FormField>
                <FormField label="Name" required>
                    <input value={name} onChange={(event) => setName(event.target.value)} />
                </FormField>
                <FormField label="Category">
                    <input value={category} onChange={(event) => setCategory(event.target.value)} />
                </FormField>
                <FormField label="Contact Email" required>
                    <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
                </FormField>
                <FormField label="Contact Number">
                    <input
                        type="tel"
                        value={contactNumber}
                        onChange={handleContactChange}
                        maxLength={10}
                        pattern="[0-9]{10}"
                        placeholder="10-digit number"
                    />
                    {contactError && <p style={{ color: "red", fontSize: 12, margin: "4px 0 0" }}>{contactError}</p>}
                </FormField>
                <FormField label="Discord Webhook URL">
                    <input value={discordWebhookUrl} onChange={(event) => setDiscordWebhookUrl(event.target.value)} />
                </FormField>
                <FormField label="Description">
                    <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
                </FormField>
                <button className="btn-accent" onClick={handleSave}>Save</button>
            </div>

            <div className="card" style={{ marginTop: 14 }}>
                <h3>Request Password Reset</h3>
                <p className="muted">Admin reviews and provides new credentials.</p>
                <FormField label="Reason" required>
                    <textarea value={resetReason} onChange={(event) => setResetReason(event.target.value)} />
                </FormField>
                <button className="btn-secondary" onClick={handleResetRequest}>Send Request</button>

                {resetHistory.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                        <h4>Request History</h4>
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Reason</th>
                                        <th>Status</th>
                                        <th>Admin Comment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resetHistory.map((req) => (
                                        <tr key={req._id}>
                                            <td>{new Date(req.createdAt).toLocaleDateString()}</td>
                                            <td style={{ maxWidth: 200, whiteSpace: "normal" }}>{req.reason}</td>
                                            <td><span className={`badge badge-${req.status}`}>{req.status}</span></td>
                                            <td>{req.adminComment || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
