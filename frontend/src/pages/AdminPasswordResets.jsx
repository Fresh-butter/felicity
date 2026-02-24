// AdminPasswordResets.jsx — Admin page for managing organizer password reset requests

import { useState, useEffect } from "react";
import useApi from "../hooks/useApi";

export default function AdminPasswordResets() {
    const api = useApi();
    const [resetRequests, setResetRequests] = useState([]);
    const [statusMessage, setStatusMessage] = useState("");

    useEffect(() => {
        loadResetRequests();
    }, []);

    function loadResetRequests() {
        api.get("/admin/password-resets").then((data) => {
            if (data) setResetRequests(data);
        });
    }

    // Handle approve or reject action
    async function handleResetAction(requestId, action) {
        // Prompt admin for a comment for both approve and reject
        let adminComment = prompt(`Comment for ${action} (optional):`) || "";

        const { ok, data } = await api.patch(`/admin/password-resets/${requestId}`, {
            action,
            adminComment,
        });

        if (ok && action === "approve") {
            setStatusMessage(`Request Approved. New password: ${data.newPassword}`);
        } else if (ok && action === "reject") {
            setStatusMessage("Request Rejected.");
        } else {
            setStatusMessage(data.message);
        }

        loadResetRequests();
    }

    return (
        <div className="page-container">
            <h2>Password Resets</h2>
            {statusMessage && <p className="msg msg-success">{statusMessage}</p>}

            {resetRequests.length === 0 ? (
                <p className="muted">None.</p>
            ) : (
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Organizer</th>
                            <th>Reason</th>
                            <th>Status</th>
                            <th>Admin Comment</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resetRequests.map((request) => (
                            <tr key={request._id}>
                                <td>{request.organizerId?.name || "?"}</td>
                                <td style={{ maxWidth: 250, whiteSpace: "normal" }}>{request.reason}</td>
                                <td><span className={`badge badge-${request.status}`}>{request.status}</span></td>
                                <td style={{ maxWidth: 200, whiteSpace: "normal" }}>{request.adminComment || "-"}</td>
                                <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                                <td className="action-cell">
                                    {request.status === "pending" && (
                                        <div style={{ display: "flex", gap: "4px" }}>
                                            <button className="btn-sm btn-success" onClick={() => handleResetAction(request._id, "approve")}>Approve</button>
                                            <button className="btn-sm btn-danger" onClick={() => handleResetAction(request._id, "reject")}>Reject</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}
