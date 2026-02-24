// Navbar.jsx — Top navigation bar with role-based links

import { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

export default function Navbar() {
    const { user, logout } = useContext(AuthContext);

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

                {/* ── Participant: Dashboard, Browse Events, Clubs, Profile, Logout ── */}
                {user?.role === "participant" && (
                    <>
                        <Link to="/dashboard">Dashboard</Link>
                        <Link to="/events">Browse Events</Link>
                        <Link to="/clubs">Clubs</Link>
                        <Link to="/profile">Profile</Link>
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
