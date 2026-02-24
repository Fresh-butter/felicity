import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import useApi from "../hooks/useApi";

export default function OrganizerPaymentApprovals() {
    const api = useApi();
    const navigate = useNavigate();

    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [registrations, setRegistrations] = useState([]);
    const [statusMessage, setStatusMessage] = useState("");

    // Load organizers events
    useEffect(() => {
        async function loadEvents() {
            const data = await api.get("/events/my-events");
            if (data) {
                // Show all events that have a registration fee (paid events)
                const paidEvents = data.filter(e => e.registrationFee > 0);
                setEvents(paidEvents);
                if (paidEvents.length > 0) {
                    setSelectedEventId(paidEvents[0]._id);
                }
            }
        }
        loadEvents();
    }, []);

    // Load registrations when an event is selected
    useEffect(() => {
        if (!selectedEventId) return;

        async function loadRegistrations() {
            const data = await api.get(`/events/${selectedEventId}/registrations`);
            if (data) {
                // show all orders — pending, approved, rejected
                setRegistrations(data.filter(r => r.paymentStatus !== "not_required"));
            }
        }
        loadRegistrations();
    }, [selectedEventId]);

    // Accept or reject a payment
    async function handlePaymentAction(registrationId, action) {
        const { ok, data } = await api.patch(`/events/${selectedEventId}/registrations/${registrationId}/payment`, { action });
        if (ok) {
            setStatusMessage(`Payment ${action}d successfully`);
            // Reload registrations to reflect new state
            const regData = await api.get(`/events/${selectedEventId}/registrations`);
            if (regData) {
                setRegistrations(regData.filter(r => r.paymentStatus !== "not_required"));
            }
        } else {
            setStatusMessage(data.message || "Failed to update payment");
        }
    }

    return (
        <div className="page-container">
            <button className="btn-secondary" onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
            <h2 style={{ marginTop: 12 }}>Payment Approvals</h2>
            <p>Review uploaded payment proofs and approve ticket generation.</p>

            {statusMessage && <p className="msg msg-success">{statusMessage}</p>}

            {events.length === 0 ? (
                <p>No paid events found.</p>
            ) : (
                <div style={{ marginBottom: 20 }}>
                    <label style={{ display: "block", marginBottom: 5 }}><strong>Select Event:</strong></label>
                    <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        style={{ padding: "8px", width: "100%", maxWidth: "400px" }}
                    >
                        {events.map(ev => (
                            <option key={ev._id} value={ev._id}>{ev.name} ({ev.eventType} — {ev.status})</option>
                        ))}
                    </select>
                </div>
            )}

            {selectedEventId && registrations.length === 0 && (
                <div className="card">
                    <p style={{ textAlign: "center", color: "#666" }}>No payment orders to review.</p>
                </div>
            )}

            {selectedEventId && registrations.length > 0 && (
                <div className="events-grid">
                    {registrations.map(reg => (
                        <div key={reg._id} className="card">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3>Order: {reg.ticketId}</h3>
                                <span className={`badge badge-${reg.paymentStatus}`}>{reg.paymentStatus}</span>
                            </div>
                            <p><strong>Participant:</strong> {reg.userId?.firstName} {reg.userId?.lastName}</p>
                            <p><strong>Email:</strong> {reg.userId?.email}</p>
                            <p><strong>Amount:</strong> ₹{reg.amountPaid}</p>
                            <p><strong>Registered:</strong> {new Date(reg.registeredAt).toLocaleDateString()}</p>

                            {/* Show selected merchandise items */}
                            {reg.merchandiseSelections && Object.keys(reg.merchandiseSelections).length > 0 && (
                                <div style={{ margin: "8px 0", padding: "8px", background: "#f9f9f9", borderRadius: "4px" }}>
                                    <p style={{ fontWeight: "bold", marginBottom: 4 }}>Items:</p>
                                    {Object.values(reg.merchandiseSelections).map((sel, i) => (
                                        <p key={i} style={{ margin: "2px 0", fontSize: "0.9em" }}>
                                            {sel.itemName}: {sel.optionLabel} — ₹{sel.price}
                                        </p>
                                    ))}
                                </div>
                            )}

                            {reg.paymentProof ? (
                                <div style={{ margin: "10px 0" }}>
                                    <p><strong>Payment Proof:</strong></p>
                                    <img
                                        src={reg.paymentProof}
                                        alt="Payment proof"
                                        style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "4px", border: "1px solid #ddd" }}
                                    />
                                    <a href={reg.paymentProof} target="_blank" rel="noreferrer" style={{ fontSize: "0.9em", display: "inline-block", marginTop: 4 }}>
                                        View Full Image
                                    </a>
                                </div>
                            ) : (
                                <div className="msg msg-error" style={{ margin: "10px 0" }}>No proof uploaded yet.</div>
                            )}

                            {reg.paymentStatus === "pending" && (
                                <div className="btn-row" style={{ marginTop: 15 }}>
                                    <button className="btn-success" onClick={() => handlePaymentAction(reg._id, "approve")}>Approve</button>
                                    <button className="btn-danger" onClick={() => handlePaymentAction(reg._id, "reject")}>Reject</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
