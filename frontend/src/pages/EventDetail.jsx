// EventDetail.jsx — Detailed event view with registration, feedback, and discussion

import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import useApi from "../hooks/useApi";
import ChatBox from "../components/ChatBox";
import FormFieldRenderer from "../components/FormFieldRenderer";
import MerchSelector from "../components/MerchSelector";

export default function EventDetail() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useContext(AuthContext);
  const api = useApi();

  const [event, setEvent] = useState(null);
  const [myRegistration, setMyRegistration] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [formResponses, setFormResponses] = useState({});
  const [merchSelections, setMerchSelections] = useState({});
  const [feedbacks, setFeedbacks] = useState([]);
  const [feedbackStats, setFeedbackStats] = useState({});
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isUploadingProof, setIsUploadingProof] = useState(false);

  // Load event details, feedback, and user's registration on mount
  useEffect(() => {
    api.get(`/events/${eventId}`).then((data) => {
      if (data) setEvent(data);
    });

    api.get(`/events/${eventId}/feedback`).then((data) => {
      if (data) {
        setFeedbacks(data.feedbacks);
        setFeedbackStats(data.stats);
      }
    });

    // Check if current user is already registered
    if (token && user?.role === "participant") {
      api.get(`/events/${eventId}/my-registration`).then((data) => {
        if (data && data._id) setMyRegistration(data);
      });
    }
  }, [eventId]);

  // Update a single custom form field response (keyed by field._id — Bug 6 fix)
  function updateFormResponse(fieldId, value) {
    setFormResponses({ ...formResponses, [fieldId]: value });
  }

  // Update a merchandise item selection (user picks one option per item)
  function updateMerchSelection(itemId, optionId) {
    setMerchSelections({
      ...merchSelections,
      [itemId]: optionId || undefined,
    });
  }

  // Compute the total price for merchandise selections
  function computeMerchTotal() {
    let total = event?.registrationFee || 0;
    if (event?.merchandiseItems) {
      for (const item of event.merchandiseItems) {
        const selectedOptId = merchSelections[item._id];
        if (selectedOptId) {
          const opt = item.options?.find((o) => o._id === selectedOptId);
          if (opt) total += opt.price;
        }
      }
    }
    return total;
  }

  // Check if any required merchandise item has ALL options sold out
  function hasMerchStockIssue() {
    if (!event || event.eventType !== "merchandise") return false;
    for (const item of event.merchandiseItems || []) {
      if (item.required && item.options.every((opt) => opt.stock <= 0)) {
        return true;
      }
    }
    return false;
  }

  // Handle event registration
  async function handleRegister() {
    if (!token) {
      navigate("/login");
      return;
    }

    // Use different API endpoints based on event type
    let url = "";
    let body = {};

    if (event.eventType === "normal") {
      // Normal events use the normal registration route
      url = `/events/normal/${eventId}/register`;
      body = { formResponses };
    } else {
      // Merchandise events use the merchandise registration route
      url = `/events/merch/${eventId}/register`;
      body = { merchandiseSelections: merchSelections };
    }

    const { ok, data } = await api.post(url, body);

    if (ok) {
      setStatusMessage(`Registered! Ticket: ${data.ticketId}`);
      setMyRegistration(data);
      // Refresh event data so registration count updates
      const refreshedEvent = await api.get(`/events/${eventId}`);
      if (refreshedEvent) setEvent(refreshedEvent);
    } else {
      setStatusMessage(data.message || "Registration failed");
    }
  }

  // Handle payment proof upload
  async function handleUploadPaymentProof(fileEvent) {
    const file = fileEvent.target.files[0];
    if (!file) return;

    setIsUploadingProof(true);
    try {
      const { default: cloudinaryUpload } = await import("../utils/cloudinaryUpload");
      const imageUrl = await cloudinaryUpload(file);

      const { ok, data } = await api.patch(`/events/${eventId}/payment-proof`, { paymentProof: imageUrl });
      if (ok) {
        setStatusMessage("Payment proof uploaded successfully");
        setMyRegistration(data.registration);
      } else {
        setStatusMessage(data.message || "Upload failed");
      }
    } catch (error) {
      setStatusMessage("File upload failed. Please try again.");
    }
    setIsUploadingProof(false);
  }

  // Handle feedback submission
  async function handleSubmitFeedback() {
    if (!rating) return;

    const { ok, data } = await api.post(`/events/${eventId}/feedback`, { rating, comment });

    if (ok) {
      setStatusMessage("Feedback submitted");
      // Refresh feedback data
      const feedbackData = await api.get(`/events/${eventId}/feedback`);
      if (feedbackData) {
        setFeedbacks(feedbackData.feedbacks);
        setFeedbackStats(feedbackData.stats);
      }
      // Refresh registration to update feedbackSubmitted flag
      const regData = await api.get(`/events/${eventId}/my-registration`);
      if (regData && regData._id) setMyRegistration(regData);
    } else {
      setStatusMessage(data.message);
    }
  }

  if (!event) return <p className="page-container">Loading...</p>;

  // Determine if registration is open (uses the dedicated boolean field)
  const registrationIsOpen = event.registrationOpen
    && new Date() < new Date(event.registrationDeadline)
    && event.registrationCount < event.registrationLimit;

  // Determine if event is completed (for feedback)
  const eventIsCompleted = event.status === "completed" || new Date() > new Date(event.endDate);

  // Compute registration display text for participants
  const regDisplay = (() => {
    if (event.status === "draft") return null;
    if (event.status === "completed") return { text: "Closed", className: "badge-rejected" };
    // published or ongoing
    if (event.registrationOpen && new Date() < new Date(event.registrationDeadline)) {
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

  // Sort form fields by their order value (Bug 7 fix)
  const sortedFormFields = [...(event.customForm || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );

  return (
    <div className="page-container" style={{ maxWidth: 700, margin: "0 auto" }}>
      <button className="btn-secondary" onClick={() => navigate("/events")}>Back</button>
      <h1 style={{ marginTop: 6 }}>{event.name}</h1>
      {statusMessage && <p className="msg msg-success">{statusMessage}</p>}

      {/* Status badges */}
      <div className="badge-row">
        <span className={`badge badge-${event.status}`}>{event.status}</span>
        <span className={`badge badge-${event.eventType}`}>{event.eventType}</span>
        {regDisplay && (
          <span className={`badge ${regDisplay.className}`}>
            Registrations: {regDisplay.text}
          </span>
        )}
      </div>

      {/* Event info */}
      <div className="event-details">
        <p><strong>Organizer:</strong> {event.organizerId?.name || "?"}</p>
        <p>{event.description}</p>
        <hr />
        <p>
          <strong>Start:</strong> {new Date(event.startDate).toLocaleString()} |{" "}
          <strong>End:</strong> {new Date(event.endDate).toLocaleString()}
        </p>
        <p>
          <strong>Eligibility:</strong> {event.eligibility}
        </p>
        <p>
          <strong>Spots:</strong> {event.registrationCount || 0}/{event.registrationLimit}
          {event.registrationFee > 0 && ` | Fee: Rs.${event.registrationFee}`}
        </p>
        {event.tags?.length > 0 && (
          <div className="tags">
            {event.tags.map((tag, index) => <span key={index} className="tag">{tag}</span>)}
          </div>
        )}
      </div>

      {/* Custom registration form (normal events) — uses FormFieldRenderer component */}
      {user?.role === "participant" && !myRegistration && event.eventType === "normal" && sortedFormFields.length > 0 && registrationIsOpen && (
        <div className="card section">
          <h3>Registration Form</h3>
          {sortedFormFields.map((field) => (
            <FormFieldRenderer
              key={field._id}
              field={field}
              value={formResponses[field._id]}
              onChange={(newValue) => updateFormResponse(field._id, newValue)}
            />
          ))}
        </div>
      )}

      {/* Merchandise item selection — dropdown per item */}
      {user?.role === "participant" && !myRegistration && event.eventType === "merchandise" && event.merchandiseItems?.length > 0 && registrationIsOpen && (
        <div className="card section">
          <h3>Select Items</h3>
          {hasMerchStockIssue() && (
            <p className="msg msg-error" style={{ marginBottom: 10 }}>
              One or more required items are completely sold out. Registration is currently unavailable.
            </p>
          )}
          {[...(event.merchandiseItems || [])].sort((a, b) => (a.order || 0) - (b.order || 0)).map((item) => (
            <MerchSelector
              key={item._id}
              item={item}
              selectedOptionId={merchSelections[item._id] || ""}
              onChange={updateMerchSelection}
            />
          ))}
          <hr />
          <p style={{ fontWeight: "bold", fontSize: "1.1em" }}>
            Total: ₹{computeMerchTotal()}
          </p>
        </div>
      )}

      {/* Register button — only show if not already registered */}
      {user?.role === "participant" && !myRegistration && (
        registrationIsOpen
          ? <button
            className="btn-accent"
            onClick={handleRegister}
            style={{ marginTop: 10 }}
            disabled={event.eventType === "merchandise" && hasMerchStockIssue()}
            title={event.eventType === "merchandise" && hasMerchStockIssue() ? "Required items are sold out" : ""}
          >Register</button>
          : <p className="muted" style={{ marginTop: 10 }}>
              {event.registrationCount >= event.registrationLimit
                ? "Event is full."
                : "Registration closed."}
            </p>
      )}
      {!user && <button className="btn-accent" onClick={() => navigate("/login")} style={{ marginTop: 10 }}>Login to Register</button>}

      {/* Registration Status & Payment Proof Upload */}
      {myRegistration && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Your Registration</h3>
          <p><strong>Ticket:</strong> <span className="ticket-id">{myRegistration.ticketId}</span></p>
          <p><strong>Status:</strong> <span className={`badge badge-${myRegistration.paymentStatus}`}>{myRegistration.paymentStatus}</span></p>

          {/* Show QR code if available */}
          {myRegistration.qrCode && (
            <div style={{ marginTop: 8 }}>
              <p><strong>Your QR Code:</strong></p>
              <img src={myRegistration.qrCode} alt="QR Code" style={{ width: 180 }} />
            </div>
          )}

          {/* Payment proof upload — show for pending/rejected payments */}
          {(myRegistration.paymentStatus === "pending" || myRegistration.paymentStatus === "rejected") && (
            <div style={{ marginTop: 10 }}>
              {myRegistration.paymentStatus === "rejected" && (
                <p className="msg msg-error">Your payment was rejected. Please upload a new proof.</p>
              )}
              <p><strong>Upload Payment Proof:</strong></p>
              {myRegistration.paymentProof && (
                <div style={{ marginBottom: 6 }}>
                  <img src={myRegistration.paymentProof} alt="Current proof" style={{ maxHeight: 120, border: "1px solid var(--border)" }} />
                  <p className="muted">Current proof uploaded</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleUploadPaymentProof} />
              {isUploadingProof && <span className="muted">Uploading...</span>}
            </div>
          )}

          {myRegistration.paymentStatus === "approved" && !myRegistration.qrCode && (
            <p className="muted" style={{ marginTop: 6 }}>Payment approved — QR code will appear shortly.</p>
          )}
        </div>
      )}

      {/* Discussion */}
      <ChatBox
        eventId={eventId}
        canPost={!!token}
        isModerator={user?.role === "admin" || (user?.role === "organizer" && event.organizerId?._id?.toString() === user.organizerId?.toString())}
      />

      {/* Feedback section (visible after event ends) */}
      {eventIsCompleted && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3>Feedback {feedbackStats.total > 0 && `(${feedbackStats.avgRating}/5, ${feedbackStats.total} reviews)`}</h3>

          {/* Submit feedback — only if not already submitted */}
          {user?.role === "participant" && myRegistration && !myRegistration.feedbackSubmitted && (
            <div style={{ marginBottom: 10 }}>
              <div>
                {[1, 2, 3, 4, 5].map((starNumber) => (
                  <span
                    key={starNumber}
                    onClick={() => setRating(starNumber)}
                    style={{ cursor: "pointer", fontSize: 18, color: starNumber <= rating ? "var(--accent)" : "#ccc" }}
                  >
                    &#9733;
                  </span>
                ))}
              </div>
              <textarea
                placeholder="Comment (optional)"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                style={{ marginTop: 4 }}
              />
              <button className="btn-accent" onClick={handleSubmitFeedback} style={{ marginTop: 4 }}>Submit</button>
            </div>
          )}
          {user?.role === "participant" && myRegistration?.feedbackSubmitted && (
            <p className="muted">You have already submitted feedback for this event.</p>
          )}

          {/* Display existing feedback */}
          {feedbacks.map((feedbackItem) => (
            <div key={feedbackItem._id} className="feedback-item">
              <span style={{ color: "var(--accent)" }}>
                {"★".repeat(feedbackItem.rating)}{"☆".repeat(5 - feedbackItem.rating)}
              </span>
              {feedbackItem.comment && <p>{feedbackItem.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
