// Navbar.jsx — Top navigation bar with role-based links and notification bell

import { useContext, useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import useApi from "../hooks/useApi";

export default function Navbar() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const api = useApi();

    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const dropdownRef = useRef(null);

    // Poll unread count every 15 seconds for logged-in participants
    useEffect(() => {
        if (!user || user.role !== "participant") return;

        function fetchCount() {
            api.get("/notifications/unread-count").then((data) => {
                if (data) setUnreadCount(data.count);
            });
        }

        fetchCount();
        const interval = setInterval(fetchCount, 15000);
        return () => clearInterval(interval);
    }, [user]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Load notifications when dropdown is opened
    async function handleBellClick() {
        if (!showDropdown) {
            const data = await api.get("/notifications");
            if (data) setNotifications(data);
        }
        setShowDropdown(!showDropdown);
    }

    // Mark all as read
    async function handleMarkAllRead() {
        await api.patch("/notifications/read-all");
        setUnreadCount(0);
        setNotifications(notifications.map((n) => ({ ...n, read: true })));
    }

    // Click a notification — mark as read and navigate to the event
    async function handleNotificationClick(notification) {
        if (!notification.read) {
            await api.patch(`/notifications/${notification._id}/read`);
            setUnreadCount((prev) => Math.max(0, prev - 1));
            setNotifications(notifications.map((n) =>
                n._id === notification._id ? { ...n, read: true } : n
            ));
        }
        setShowDropdown(false);
        if (notification.eventId?._id) {
            navigate(`/events/${notification.eventId._id}`);
        }
    }

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to={user ? "/dashboard" : "/login"}>Felicity</Link>
            </div>
            <div className="navbar-links">
                {/* ── Guest (not logged in) ── */}
                {!user && (
                    <>
                        <Link to="/login">Login</Link>
                        <Link to="/signup">Sign Up</Link>
                    </>
                )}

                {/* ── Participant: Dashboard, Browse Events, Clubs, Profile, Notifications, Logout ── */}
                {user?.role === "participant" && (
                    <>
                        <Link to="/dashboard">Dashboard</Link>
                        <Link to="/events">Browse Events</Link>
                        <Link to="/clubs">Clubs</Link>
                        <Link to="/profile">Profile</Link>

                        {/* Notification bell */}
                        <div className="notif-wrapper" ref={dropdownRef}>
                            <button className="notif-bell" onClick={handleBellClick} title="Notifications">
                                🔔
                                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                            </button>
                            {showDropdown && (
                                <div className="notif-dropdown">
                                    <div className="notif-dropdown-header">
                                        <strong>Notifications</strong>
                                        {unreadCount > 0 && (
                                            <button className="btn-sm" onClick={handleMarkAllRead}>Mark all read</button>
                                        )}
                                    </div>
                                    <div className="notif-dropdown-list">
                                        {notifications.length === 0 && (
                                            <p className="muted" style={{ padding: "12px", textAlign: "center" }}>No notifications.</p>
                                        )}
                                        {notifications.map((n) => (
                                            <div
                                                key={n._id}
                                                className={`notif-item ${n.read ? "" : "notif-unread"}`}
                                                onClick={() => handleNotificationClick(n)}
                                            >
                                                <p className="notif-text">{n.message}</p>
                                                <span className="notif-time">
                                                    {n.eventId?.name || ""} · {new Date(n.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button className="btn-logout" onClick={logout}>Logout</button>
                    </>
                )}

                {/* ── Organizer: Dashboard, Create Event, Manage Events, Payments, Profile, Logout ── */}
                {user?.role === "organizer" && (
                    <>
                        <Link to="/dashboard">Dashboard</Link>
                        <Link to="/organizer/create">Create Event</Link>
                        <Link to="/organizer/events">Manage Events</Link>
                        <Link to="/organizer/payments">Payments</Link>
                        <Link to="/organizer/profile">Profile</Link>
                        <button className="btn-logout" onClick={logout}>Logout</button>
                    </>
                )}

                {/* ── Admin: Dashboard, Manage Clubs, Password Resets, Logout ── */}
                {user?.role === "admin" && (
                    <>
                        <Link to="/dashboard">Dashboard</Link>
                        <Link to="/admin/organizers">Manage Clubs</Link>
                        <Link to="/admin/password-resets">Password Resets</Link>
                        <button className="btn-logout" onClick={logout}>Logout</button>
                    </>
                )}
            </div>
        </nav>
    );
}
