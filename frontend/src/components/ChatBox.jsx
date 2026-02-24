// ChatBox.jsx — Real-time event discussion chat with threading, pinning, and reactions

import { useState, useEffect, useRef, useContext } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "../context/AuthContext";
import useApi from "../hooks/useApi";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "🤔"];

export default function ChatBox({ eventId, canPost, isModerator }) {
    const api = useApi();
    const { user } = useContext(AuthContext);
    const [messages, setMessages] = useState([]);
    const [messageInput, setMessageInput] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const socketRef = useRef(null);
    const scrollEndRef = useRef(null);

    // Connect to socket and load existing messages
    useEffect(() => {
        // Load existing messages from the server
        api.get(`/discussions/${eventId}`).then((data) => {
            if (data) {
                setMessages(data);
            }
        });

        // Connect to the Socket.IO server
        const socket = io("http://localhost:5000");
        socketRef.current = socket;

        // Join the event's discussion room
        socket.emit("joinEvent", eventId);

        // Listen for new messages from other users
        socket.on("message", (newMessage) => {
            setMessages((previousMessages) => [...previousMessages, newMessage]);
        });

        // Cleanup: leave room and disconnect when component unmounts
        return () => {
            socket.emit("leaveEvent", eventId);
            socket.disconnect();
        };
    }, [eventId]);

    // Auto-scroll to the bottom when new messages arrive
    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Send a message to the discussion
    async function handleSendMessage() {
        if (!messageInput.trim()) {
            return;
        }

        const body = { message: messageInput.trim() };
        if (replyTo) {
            body.parentId = replyTo._id;
        }

        const { ok, data } = await api.post(`/discussions/${eventId}`, body);

        if (ok) {
            // Broadcast the message to other users in the room
            socketRef.current?.emit("newMessage", { ...data, eventId });
            setMessageInput("");
            setReplyTo(null);
        }
    }

    // Delete a message as a moderator
    async function handleDeleteMessage(messageId) {
        if (!isModerator) return;

        const { ok } = await api.del(`/discussions/${eventId}/${messageId}`);
        if (ok) {
            setMessages(messages.filter(m => m._id !== messageId));
        }
    }

    // Pin/unpin a message as a moderator
    async function handlePinMessage(messageId) {
        if (!isModerator) return;

        const { ok, data } = await api.patch(`/discussions/${eventId}/${messageId}/pin`);
        if (ok) {
            setMessages(messages.map(m =>
                m._id === messageId ? { ...m, pinned: !m.pinned } : m
            ));
        }
    }

    // React to a message
    async function handleReact(messageId, emoji) {
        const { ok, data } = await api.post(`/discussions/${eventId}/${messageId}/react`, { emoji });
        if (ok && data.discussion) {
            setMessages(messages.map(m =>
                m._id === messageId ? { ...m, reactions: data.discussion.reactions } : m
            ));
        }
    }

    // Separate pinned and regular messages
    const pinnedMessages = messages.filter(m => m.pinned);
    // Get top-level messages (no parentId)
    const topLevelMessages = messages.filter(m => !m.parentId);
    // Get replies map
    const repliesMap = {};
    for (const m of messages) {
        if (m.parentId) {
            if (!repliesMap[m.parentId]) repliesMap[m.parentId] = [];
            repliesMap[m.parentId].push(m);
        }
    }

    function renderMessage(message, depth = 0) {
        const reactionMap = message.reactions || {};
        const marginLeft = depth * 20;
        return (
            <div key={message._id || Math.random()} className="chat-msg" style={{
                marginLeft,
                borderLeft: depth > 0 ? "2px solid var(--border)" : "none",
                paddingLeft: depth > 0 ? 8 : 0,
            }}>
                {message.pinned && <span style={{ fontSize: "0.7em", color: "var(--accent)", fontWeight: 600 }}>📌 PINNED</span>}
                <span className="chat-author">
                    {message.userId?.firstName || "User"}
                </span>
                <span className="chat-time">
                    {message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : ""}
                </span>
                {isModerator && message._id && (
                    <>
                        <button
                            className="btn-danger-sm"
                            style={{ marginLeft: 8, padding: "2px 6px", fontSize: "0.7em" }}
                            onClick={() => handleDeleteMessage(message._id)}
                        >
                            Delete
                        </button>
                        <button
                            className="btn-sm"
                            style={{ marginLeft: 4, padding: "2px 6px", fontSize: "0.7em" }}
                            onClick={() => handlePinMessage(message._id)}
                        >
                            {message.pinned ? "Unpin" : "Pin"}
                        </button>
                    </>
                )}
                <div className="chat-text">{message.message}</div>
                {/* Reactions */}
                <div style={{ display: "flex", gap: 4, marginTop: 2, flexWrap: "wrap", alignItems: "center" }}>
                    {Object.entries(reactionMap).map(([emoji, users]) => {
                        const userList = Array.isArray(users) ? users : [];
                        if (userList.length === 0) return null;
                        return (
                            <button
                                key={emoji}
                                onClick={() => canPost && handleReact(message._id, emoji)}
                                style={{
                                    background: "var(--accent-bg)", border: "1px solid var(--border)",
                                    padding: "1px 5px", fontSize: "0.75em", cursor: canPost ? "pointer" : "default",
                                }}
                            >
                                {emoji} {userList.length}
                            </button>
                        );
                    })}
                    {canPost && message._id && (
                        <div style={{ display: "inline-flex", gap: 2 }}>
                            {REACTION_EMOJIS.map(emoji => (
                                <button
                                    key={emoji}
                                    onClick={() => handleReact(message._id, emoji)}
                                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8em", padding: "0 2px" }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Reply button — available at any depth */}
                {canPost && message._id && (
                    <button
                        className="btn-sm"
                        style={{ fontSize: "0.7em", marginTop: 2, padding: "1px 5px" }}
                        onClick={() => setReplyTo(message)}
                    >
                        Reply
                    </button>
                )}
                {/* Render nested replies recursively */}
                {repliesMap[message._id]?.map(reply => renderMessage(reply, depth + 1))}
            </div>
        );
    }

    return (
        <div className="chat-container">
            <div className="chat-header">Discussion</div>
            {/* Pinned messages at top */}
            {pinnedMessages.length > 0 && (
                <div style={{ background: "var(--accent-bg)", padding: "6px 10px", borderBottom: "1px solid var(--border)" }}>
                    <strong style={{ fontSize: "0.75em", color: "var(--accent)" }}>📌 Pinned Messages</strong>
                    {pinnedMessages.map(m => (
                        <div key={m._id} style={{ fontSize: "0.85em", marginTop: 2 }}>
                            <strong>{m.userId?.firstName || "User"}:</strong> {m.message}
                        </div>
                    ))}
                </div>
            )}
            <div className="chat-messages">
                {messages.length === 0 && <p className="muted">No messages yet.</p>}
                {topLevelMessages.map((message) => renderMessage(message))}
                <div ref={scrollEndRef} />
            </div>
            {replyTo && (
                <div style={{ padding: "4px 10px", background: "var(--accent-bg)", borderTop: "1px solid var(--border)", fontSize: "0.8em", display: "flex", justifyContent: "space-between" }}>
                    <span>Replying to <strong>{replyTo.userId?.firstName || "User"}</strong>: {replyTo.message.substring(0, 50)}...</span>
                    <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>✕</button>
                </div>
            )}
            {canPost && (
                <div className="chat-input">
                    <input
                        placeholder={replyTo ? "Type a reply..." : "Type a message..."}
                        value={messageInput}
                        onChange={(event) => setMessageInput(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && handleSendMessage()}
                    />
                    <button className="btn-accent" onClick={handleSendMessage}>Send</button>
                </div>
            )}
        </div>
    );
}
