// OrganizerEventDetail.jsx — Detailed event management: participants, analytics, scanning, feedback

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import useApi from "../hooks/useApi";
import EventForm from "../components/EventForm";

export default function OrganizerEventDetail() {
    const { id: eventId } = useParams();
    const navigate = useNavigate();
    const api = useApi();

    const [event, setEvent] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [analytics, setAnalytics] = useState({});
    const [feedbackStats, setFeedbackStats] = useState(null);
    const [feedbacks, setFeedbacks] = useState([]);
    const [feedbackRatingFilter, setFeedbackRatingFilter] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [paymentFilter, setPaymentFilter] = useState("");
    const [attendanceFilter, setAttendanceFilter] = useState("");
    const [scanTicketId, setScanTicketId] = useState("");
    const [statusMessage, setStatusMessage] = useState("");

    const [isEditing, setIsEditing] = useState(false);
    const [expandedParticipant, setExpandedParticipant] = useState(null);

    // QR scanner state
    const [scannerMode, setScannerMode] = useState("text"); // "text" | "camera" | "file"
    const [cameraActive, setCameraActive] = useState(false);
    const html5QrRef = useRef(null);
    const scannerContainerRef = useRef(null);

    // Registration toggle state
    const [showRegForm, setShowRegForm] = useState(false);
    const [regDeadline, setRegDeadline] = useState("");
    const [showFullWarning, setShowFullWarning] = useState(false);

    useEffect(() => {
        loadData();
    }, [eventId]);

    // Load event details, participants, analytics, and feedback
    async function loadData() {
        const eventData = await api.get(`/events/${eventId}`);
        const participantData = await api.get(`/events/${eventId}/registrations`);
        const analyticsData = await api.get(`/events/${eventId}/analytics`);
        const feedbackData = await api.get(`/events/${eventId}/feedback`);

        if (eventData) setEvent(eventData);
        if (participantData) setParticipants(participantData);
        if (analyticsData) setAnalytics(analyticsData);
        if (feedbackData) {
            setFeedbackStats(feedbackData.stats);
            setFeedbacks(feedbackData.feedbacks || []);
        }
    }

    // Load feedback with optional rating filter
    async function loadFeedback(rating) {
        const query = rating ? `?rating=${rating}` : "";
        const feedbackData = await api.get(`/events/${eventId}/feedback${query}`);
        if (feedbackData) {
            setFeedbackStats(feedbackData.stats);
            setFeedbacks(feedbackData.feedbacks || []);
        }
    }

    function handleFeedbackRatingFilter(rating) {
        setFeedbackRatingFilter(rating);
        loadFeedback(rating);
    }

    // Handle payment approval/rejection
    async function handlePaymentAction(registrationId, action) {
        await api.patch(`/events/${eventId}/registrations/${registrationId}/payment`, { action });
        loadData();
    }

    // Handle ticket scanning for attendance
    async function handleScanTicket() {
        if (!scanTicketId.trim()) return;

        const { ok, data } = await api.post(`/events/${eventId}/scan`, {
            ticketId: scanTicketId.trim(),
        });

        if (ok) {
            setStatusMessage(`✅ Checked in: ${data.participant}`);
        } else {
            setStatusMessage(`❌ ${data.message || "Scan failed"}`);
        }

        setScanTicketId("");
        loadData();
    }

    // Manual checkin override
    async function handleManualCheckIn(regId) {
        const { ok, data } = await api.post(`/events/${eventId}/registrations/${regId}/checkin`, {});
        if (ok) {
            setStatusMessage(data.message);
            loadData();
        } else {
            setStatusMessage(data.message || "Failed to override check-in");
        }
    }

    // Start camera QR scanner
    async function startCameraScanner() {
        if (html5QrRef.current) return; // already running
        const html5Qr = new Html5Qrcode("qr-scanner-container");
        html5QrRef.current = html5Qr;
        try {
            await html5Qr.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                async (decodedText) => {
                    // Stop camera after successful scan
                    await stopCameraScanner();
                    // Auto-submit the scanned ticket
                    const { ok, data: scanData } = await api.post(`/events/${eventId}/scan`, { ticketId: decodedText.trim() });
                    if (ok) {
                        setStatusMessage(`✅ Checked in: ${scanData.participant}`);
                    } else {
                        setStatusMessage(`❌ ${scanData.message || "Scan failed"}`);
                    }
                    loadData();
                },
                () => { } // ignore scan errors (no QR found per frame)
            );
            setCameraActive(true);
        } catch (err) {
            setStatusMessage(`❌ Camera error: ${err.message || err}`);
            html5QrRef.current = null;
        }
    }

    // Stop camera QR scanner
    async function stopCameraScanner() {
        if (html5QrRef.current) {
            try {
                await html5QrRef.current.stop();
            } catch (e) { /* already stopped */ }
            html5QrRef.current = null;
        }
        setCameraActive(false);
    }

    // Handle file-based QR scan
    async function handleFileScan(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const html5Qr = new Html5Qrcode("qr-file-temp");
        try {
            const decodedText = await html5Qr.scanFile(file, true);
            // Auto-submit the scanned ticket
            const { ok, data: scanData } = await api.post(`/events/${eventId}/scan`, { ticketId: decodedText.trim() });
            if (ok) {
                setStatusMessage(`✅ Checked in: ${scanData.participant}`);
            } else {
                setStatusMessage(`❌ ${scanData.message || "Scan failed"}`);
            }
            loadData();
        } catch (err) {
            setStatusMessage("❌ Could not read QR code from image");
        }
        // Reset file input
        e.target.value = "";
    }

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (html5QrRef.current) {
                html5QrRef.current.stop().catch(() => { });
                html5QrRef.current = null;
            }
        };
    }, []);

    // Export participants as CSV download
    async function handleExportCSV() {
        const blob = await api.getBlob(`/events/${eventId}/registrations/export`);
        if (blob) {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "participants.csv";
            link.click();
        }
    }

    // Save event edits
    async function handleEditSubmit(updatedData) {
        const { ok, data } = await api.patch(`/events/${eventId}`, updatedData);
        if (ok) {
            setStatusMessage("Event updated successfully");
            setIsEditing(false);
            loadData();
        } else {
            setStatusMessage(data.message || "Failed to update event");
        }
    }

    // Publish a draft event
    async function handlePublish() {
        const { ok, data } = await api.patch(`/events/${eventId}/publish`, {});
        if (ok) {
            setStatusMessage("Event published!");
            loadData();
        } else {
            setStatusMessage(data.message || "Failed to publish");
        }
    }

    // Mark an ongoing event as completed
    async function handleMarkCompleted() {
        const { ok, data } = await api.patch(`/events/${eventId}`, { status: "completed" });
        if (ok) {
            setStatusMessage("Event marked as completed");
            loadData();
        } else {
            setStatusMessage(data.message || "Failed to update status");
        }
    }

    // Open registration with a deadline
    async function handleOpenRegistration() {
        if (!regDeadline) {
            setStatusMessage("Please set a registration deadline");
            return;
        }
        if (new Date(regDeadline) <= new Date()) {
            setStatusMessage("Registration deadline must be in the future");
            return;
        }
        const { ok, data } = await api.patch(`/events/${eventId}/registration`, {
            action: "open",
            registrationDeadline: regDeadline,
        });
        if (ok) {
            setStatusMessage("Registration opened!");
            setShowRegForm(false);
            setRegDeadline("");
            loadData();
        } else {
            setStatusMessage(data.message || "Failed to open registration");
        }
    }

    // Close registration
    async function handleCloseRegistration() {
        const { ok, data } = await api.patch(`/events/${eventId}/registration`, {
            action: "close",
        });
        if (ok) {
            setStatusMessage("Registration closed");
            loadData();
        } else {
            setStatusMessage(data.message || "Failed to close registration");
        }
    }

    // Filter participants by name/ticket search, payment status, and attendance
    const filteredParticipants = participants.filter((participant) => {
        const fullName = `${participant.userId?.firstName || ""} ${participant.userId?.lastName || ""}`.toLowerCase();
        const matchesSearch = !searchQuery || fullName.includes(searchQuery.toLowerCase()) || (participant.ticketId || "").includes(searchQuery);
        const matchesPayment = !paymentFilter || participant.paymentStatus === paymentFilter;
        const matchesAttendance = !attendanceFilter || (attendanceFilter === "attended" ? participant.attended : !participant.attended);
        return matchesSearch && matchesPayment && matchesAttendance;
    });

    // Live attendance stats
    const attendedCount = participants.filter(p => p.attended).length;
    const notAttendedCount = participants.filter(p => !p.attended).length;

    if (!event) return <p className="page-container">Loading...</p>;

    // Compute registration display text
    const isRegistrationEffectivelyOpen = event.registrationOpen && new Date() < new Date(event.registrationDeadline);

    const regDisplay = (() => {
        if (event.status === "draft") return null; // don't show for drafts
        if (event.status === "completed") return { text: "Closed", className: "badge-rejected" };
        // published or ongoing
        if (isRegistrationEffectivelyOpen) {
            if (event.registrationCount >= event.registrationLimit) {
                return { text: "Full", className: "badge-rejected" };
            }
            return {
                text: `Open till ${new Date(event.registrationDeadline).toLocaleString()}`,
                className: "badge-published",
            };
        }
        return { text: "Closed", className: "badge-rejected" };
    })();

    // Which statuses allow editing
    const canEdit = event.status !== "completed";
    // Registration can be toggled for published/ongoing
    const canToggleReg = event.status === "published" || event.status === "ongoing";

    return (
        <div className="page-container">
            <button className="btn-secondary" onClick={() => navigate("/organizer/events")}>Back</button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, flexWrap: "wrap", gap: 8 }}>
                <h2 style={{ margin: 0 }}>{event.name}</h2>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <span className={`badge badge-${event.status}`}>{event.status}</span>
                    {regDisplay && (
                        <span className={`badge ${regDisplay.className}`}>
                            Registrations: {regDisplay.text}
                        </span>
                    )}
                    {/* Action buttons based on status */}
                    {event.status === "draft" && (
                        <button className="btn-accent" onClick={handlePublish}>Publish</button>
                    )}
                    {event.status === "ongoing" && (
                        <button className="btn-secondary" onClick={handleMarkCompleted}>Mark Completed</button>
                    )}
                    {canToggleReg && !isRegistrationEffectivelyOpen && (
                        <button className="btn-accent" onClick={() => {
                            if (showRegForm) {
                                // Cancel — reset everything
                                setShowRegForm(false);
                                setShowFullWarning(false);
                                return;
                            }
                            if (event.registrationCount >= event.registrationLimit) {
                                // Event is full — show warning first, don't open the form yet
                                setShowFullWarning(true);
                                setShowRegForm(false);
                            } else {
                                // Not full — open form directly with default deadline
                                setShowFullWarning(false);
                                const defaultDeadline = new Date(Date.now() + 10 * 60 * 1000);
                                const local = new Date(defaultDeadline.getTime() - defaultDeadline.getTimezoneOffset() * 60000)
                                    .toISOString().slice(0, 16);
                                setRegDeadline(local);
                                setShowRegForm(true);
                            }
                        }}>
                            {showRegForm || showFullWarning ? "Cancel" : "Open Registration"}
                        </button>
                    )}
                    {canToggleReg && isRegistrationEffectivelyOpen && (
                        <button className="btn-danger-sm" style={{ padding: "6px 14px", fontSize: "0.9em" }} onClick={handleCloseRegistration}>
                            Close Registration
                        </button>
                    )}
                    {canEdit && (
                        <button className="btn-secondary" onClick={() => setIsEditing(!isEditing)}>
                            {isEditing ? "Cancel Edit" : "Edit Event"}
                        </button>
                    )}
                </div>
            </div>

            {statusMessage && <p className="msg msg-success">{statusMessage}</p>}

            {/* Full-event warning — shown instead of the deadline form when event is at capacity */}
            {showFullWarning && (
                <div className="card" style={{ marginBottom: 14, background: "#fff8e1", border: "1px solid #f59e0b" }}>
                    <h4 style={{ margin: "0 0 8px", color: "#b45309" }}>⚠️ Cannot Open Registration — Event is Full</h4>
                    <p style={{ margin: "0 0 12px" }}>
                        This event has reached its registration limit ({event.registrationCount}/{event.registrationLimit} spots taken).
                        Please increase the registration limit/review pending requests.
                    </p>
                    <button className="btn-secondary" onClick={() => setShowFullWarning(false)}>Dismiss</button>
                </div>
            )}

            {/* Registration open form — asks for deadline */}
            {showRegForm && (
                <div className="card" style={{ marginBottom: 14, background: "#f0fff4", border: "1px solid var(--success)" }}>
                    <h4 style={{ margin: "0 0 8px" }}>Open Registration</h4>
                    <p className="muted" style={{ margin: "0 0 8px" }}>Set the deadline until which registration will stay open.</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                            type="datetime-local"
                            className="form-input datetime-input"
                            value={regDeadline}
                            onChange={(e) => setRegDeadline(e.target.value)}
                            style={{ flex: 1, minWidth: 200 }}
                        />
                        <button className="btn-accent" onClick={handleOpenRegistration}>Confirm Open</button>
                    </div>
                </div>
            )}

            {!isEditing && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <h3>Overview</h3>
                    <p><strong>Type:</strong> {event.eventType} | <strong>Eligibility:</strong> {event.eligibility}</p>
                    <p><strong>Start:</strong> {new Date(event.startDate).toLocaleString()} — <strong>End:</strong> {new Date(event.endDate).toLocaleString()}</p>
                    <p><strong>Pricing:</strong> ₹{event.registrationFee} | <strong>Limit:</strong> {event.registrationLimit}</p>
                    <p><strong>Registrations:</strong> {event.registrationCount}/{event.registrationLimit}</p>
                    {event.description && <p style={{ marginTop: 6 }}><strong>Description:</strong> {event.description}</p>}
                </div>
            )}

            {isEditing && (
                <EventForm
                    initialData={event}
                    onSubmit={handleEditSubmit}
                    onCancel={() => setIsEditing(false)}
                />
            )}

            {/* Analytics summary */}
            <div className="stats-grid" style={{ margin: "10px 0" }}>
                <div className="stat-card"><h3>{analytics.totalRegistrations || 0}</h3><p>Registered</p></div>
                <div className="stat-card"><h3>{analytics.attended || 0}</h3><p>Attended</p></div>
                <div className="stat-card"><h3>{analytics.iiitCount || 0}</h3><p>IIIT</p></div>
                <div className="stat-card"><h3>{analytics.nonIiitCount || 0}</h3><p>Non-IIIT</p></div>
                {analytics.revenue > 0 && <div className="stat-card"><h3>₹{analytics.revenue}</h3><p>Revenue</p></div>}
            </div>

            {/* Live Attendance Dashboard */}
            <div className="card" style={{ marginBottom: 14, background: "#f0f8ff" }}>
                <h3 style={{ marginBottom: 6 }}>Live Attendance</h3>
                <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                    <div style={{ textAlign: "center" }}>
                        <h2 style={{ margin: 0, color: "var(--success)" }}>{attendedCount}</h2>
                        <p className="muted">Scanned</p>
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <h2 style={{ margin: 0, color: "var(--danger)" }}>{notAttendedCount}</h2>
                        <p className="muted">Not Yet Scanned</p>
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ background: "#e0e0e0", height: 12, position: "relative" }}>
                            <div style={{
                                background: "var(--success)",
                                height: "100%",
                                width: participants.length > 0 ? `${(attendedCount / participants.length) * 100}%` : "0%",
                            }} />
                        </div>
                        <p className="muted" style={{ marginTop: 2 }}>
                            {participants.length > 0 ? Math.round((attendedCount / participants.length) * 100) : 0}% checked in
                        </p>
                    </div>
                </div>
            </div>

            {/* Feedback Stats with filter */}
            {feedbackStats && feedbackStats.total > 0 && (
                <div className="card" style={{ marginBottom: 14, background: "#f9f9fe" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <h3 style={{ margin: "0 0 4px 0" }}>Attendee Feedback</h3>
                            <p className="muted" style={{ margin: 0 }}>Average rating from participants</p>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <h2 style={{ margin: 0, color: "var(--accent)" }}>{feedbackStats.avgRating} <span style={{ fontSize: "0.6em", color: "#666" }}>/ 5</span></h2>
                            <p style={{ margin: 0, fontSize: "0.9em" }}>Based on {feedbackStats.total} reviews</p>
                        </div>
                    </div>
                    {/* Filter by rating */}
                    <div style={{ marginTop: 8, display: "flex", gap: 4, alignItems: "center" }}>
                        <span className="muted" style={{ fontSize: "0.85em" }}>Filter:</span>
                        <button
                            className={`btn-sm ${feedbackRatingFilter === "" ? "btn-accent" : ""}`}
                            onClick={() => handleFeedbackRatingFilter("")}
                        >All</button>
                        {[5, 4, 3, 2, 1].map(star => (
                            <button
                                key={star}
                                className={`btn-sm ${feedbackRatingFilter === String(star) ? "btn-accent" : ""}`}
                                onClick={() => handleFeedbackRatingFilter(String(star))}
                            >{star}★</button>
                        ))}
                    </div>
                    {/* Display feedback comments */}
                    <div style={{ marginTop: 8, maxHeight: 200, overflowY: "auto" }}>
                        {feedbacks.map((fb) => (
                            <div key={fb._id} className="feedback-item">
                                <span style={{ color: "var(--accent)" }}>
                                    {"★".repeat(fb.rating)}{"☆".repeat(5 - fb.rating)}
                                </span>
                                {fb.comment && <p>{fb.comment}</p>}
                            </div>
                        ))}
                        {feedbacks.length === 0 && <p className="muted">No feedback for this filter.</p>}
                    </div>
                </div>
            )}

            {/* Ticket scanner */}
            <div className="card" style={{ marginBottom: 14 }}>
                <h3>Ticket Scanner</h3>
                {event?.status !== "ongoing" ? (
                    <p className="muted" style={{ color: "var(--danger)" }}>
                        ⚠️ Attendance can only be taken while the event is ongoing.
                    </p>
                ) : (
                    <>
                        {/* Scanner mode tabs */}
                        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                            <button className={`btn-sm ${scannerMode === "text" ? "btn-accent" : ""}`} onClick={() => { stopCameraScanner(); setScannerMode("text"); }}>
                                ⌨ Text Input
                            </button>
                            <button className={`btn-sm ${scannerMode === "camera" ? "btn-accent" : ""}`} onClick={() => { setScannerMode("camera"); }}>
                                📷 Camera Scan
                            </button>
                            <button className={`btn-sm ${scannerMode === "file" ? "btn-accent" : ""}`} onClick={() => { stopCameraScanner(); setScannerMode("file"); }}>
                                📁 Upload QR Image
                            </button>
                        </div>

                        {/* Text input mode */}
                        {scannerMode === "text" && (
                            <div style={{ display: "flex", gap: 6 }}>
                                <input
                                    placeholder="Enter Ticket ID"
                                    value={scanTicketId}
                                    onChange={(event) => setScanTicketId(event.target.value)}
                                    onKeyDown={(event) => event.key === "Enter" && handleScanTicket()}
                                />
                                <button className="btn-accent" onClick={handleScanTicket}>Scan</button>
                            </div>
                        )}

                        {/* Camera mode */}
                        {scannerMode === "camera" && (
                            <div>
                                <div id="qr-scanner-container" style={{ width: "100%", maxWidth: 400, margin: "0 auto" }} />
                                {!cameraActive ? (
                                    <button className="btn-accent" style={{ marginTop: 8 }} onClick={startCameraScanner}>Start Camera</button>
                                ) : (
                                    <button className="btn-danger" style={{ marginTop: 8 }} onClick={stopCameraScanner}>Stop Camera</button>
                                )}
                            </div>
                        )}

                        {/* File upload mode */}
                        {scannerMode === "file" && (
                            <div>
                                <p className="muted" style={{ marginBottom: 6 }}>Upload a QR code image to scan the ticket.</p>
                                <input type="file" accept="image/*" onChange={handleFileScan} />
                                <div id="qr-file-temp" style={{ display: "none" }} />
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Participants header with export */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <h3>Participants ({filteredParticipants.length})</h3>
                <button className="btn-sm" onClick={handleExportCSV}>Export CSV</button>
            </div>

            {/* Search and filter */}
            <div className="filters-bar">
                <input
                    placeholder="Search by name or ticket..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                />
                <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                    <option value="">All Payments</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="not_required">Not Required</option>
                </select>
                <select value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value)}>
                    <option value="">All Attendance</option>
                    <option value="attended">Attended</option>
                    <option value="not_attended">Not Attended</option>
                </select>
            </div>

            {/* Participants table */}
            <table className="data-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Reg Date</th>
                        <th>Ticket</th>
                        <th>Payment</th>
                        <th>Attended</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredParticipants.map((participant) => {
                        const isExpanded = expandedParticipant === participant._id;
                        const hasFormResponses = participant.formResponses && Object.keys(participant.formResponses).length > 0;
                        const hasMerchSelections = participant.merchandiseSelections && Object.keys(participant.merchandiseSelections).length > 0;
                        const hasDetails = hasFormResponses || hasMerchSelections || participant.paymentProof;
                        return (
                            <>
                                <tr key={participant._id}>
                                    <td style={{ width: 30, textAlign: "center", cursor: hasDetails ? "pointer" : "default" }}
                                        onClick={() => hasDetails && setExpandedParticipant(isExpanded ? null : participant._id)}>
                                        {hasDetails ? (isExpanded ? "▼" : "▶") : ""}
                                    </td>
                                    <td>{participant.userId?.firstName} {participant.userId?.lastName}</td>
                                    <td>{participant.userId?.email}</td>
                                    <td>{new Date(participant.registeredAt).toLocaleDateString()}</td>
                                    <td className="ticket-id">{participant.ticketId}</td>
                                    <td><span className={`badge badge-${participant.paymentStatus}`}>{participant.paymentStatus}</span></td>
                                    <td>
                                        {participant.attended ? (
                                            <span style={{ color: "var(--success)" }}>Yes{participant.attendedAt ? ` (${new Date(participant.attendedAt).toLocaleTimeString()})` : ""}</span>
                                        ) : "No"}
                                    </td>
                                    <td className="action-cell">
                                        {participant.paymentStatus === "pending" && (
                                            <>
                                                <button className="btn-sm btn-success" onClick={() => handlePaymentAction(participant._id, "approve")}>Approve</button>
                                                <button className="btn-sm btn-danger" onClick={() => handlePaymentAction(participant._id, "reject")}>Reject</button>
                                            </>
                                        )}
                                        <button
                                            className="btn-sm btn-secondary"
                                            style={{ marginLeft: "4px" }}
                                            disabled={
                                                event?.status !== "ongoing" ||
                                                participant.paymentStatus === "pending" ||
                                                participant.paymentStatus === "rejected"
                                            }
                                            title={
                                                event?.status !== "ongoing"
                                                    ? "Attendance can only be taken while the event is ongoing"
                                                    : participant.paymentStatus === "pending" || participant.paymentStatus === "rejected"
                                                        ? "Payment not approved"
                                                        : ""
                                            }
                                            onClick={() => handleManualCheckIn(participant._id)}
                                        >
                                            {participant.attended ? "Un-checkin" : "Check-in"}
                                        </button>
                                    </td>
                                </tr>
                                {isExpanded && (
                                    <tr key={`${participant._id}-detail`}>
                                        <td colSpan={8} style={{ background: "#f8f9fa", padding: "12px 20px" }}>
                                            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                                                {/* Form Responses */}
                                                {hasFormResponses && (
                                                    <div style={{ flex: 1, minWidth: 200 }}>
                                                        <h4 style={{ margin: "0 0 6px" }}>Form Responses</h4>
                                                        {Object.entries(participant.formResponses).map(([fieldId, value]) => {
                                                            // Resolve field ID to label from the event's customForm
                                                            const field = event.customForm?.find(f => f._id === fieldId);
                                                            const label = field?.label || fieldId;
                                                            return (
                                                                <p key={fieldId} style={{ margin: "2px 0", fontSize: "0.9em" }}>
                                                                    <strong>{label}:</strong> {typeof value === "string" && (value.startsWith("http://") || value.startsWith("https://"))
                                                                        ? <a href={value} target="_blank" rel="noreferrer">View File</a>
                                                                        : Array.isArray(value) ? value.join(", ") : String(value)}
                                                                </p>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {/* Merchandise Selections */}
                                                {hasMerchSelections && (
                                                    <div style={{ flex: 1, minWidth: 200 }}>
                                                        <h4 style={{ margin: "0 0 6px" }}>Merchandise Selections</h4>
                                                        {Object.values(participant.merchandiseSelections).map((sel, i) => (
                                                            <p key={i} style={{ margin: "2px 0", fontSize: "0.9em" }}>
                                                                <strong>{sel.itemName}:</strong> {sel.optionLabel} — ₹{sel.price}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Payment Proof */}
                                                {participant.paymentProof && (
                                                    <div style={{ flex: 1, minWidth: 200 }}>
                                                        <h4 style={{ margin: "0 0 6px" }}>Payment Proof</h4>
                                                        <img
                                                            src={participant.paymentProof}
                                                            alt="Payment proof"
                                                            style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd", cursor: "pointer" }}
                                                            onClick={() => window.open(participant.paymentProof, "_blank")}
                                                        />
                                                        <br />
                                                        <a href={participant.paymentProof} target="_blank" rel="noreferrer" style={{ fontSize: "0.85em" }}>View Full Image</a>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
