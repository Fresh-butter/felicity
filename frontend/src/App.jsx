import { Routes, Route, Navigate } from "react-router-dom";
import { useContext } from "react";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthContext } from "./context/AuthContext";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Events from "./pages/Events";
import EventDetail from "./pages/EventDetail";
import Profile from "./pages/Profile";
import OrganizerEvents from "./pages/OrganizerEvents";
import OrganizerEventDetail from "./pages/OrganizerEventDetail";
import OrganizerCreateEvent from "./pages/OrganizerCreateEvent";
import OrganizerProfile from "./pages/OrganizerProfile";
import OrganizerPaymentApprovals from "./pages/OrganizerPaymentApprovals";
import AdminOrganizers from "./pages/AdminOrganizers";
import AdminPasswordResets from "./pages/AdminPasswordResets";
import ClubsList from "./pages/ClubsList";
import ClubDetail from "./pages/ClubDetail";

function App() {
  const { user } = useContext(AuthContext);

  return (
    <>
      <Navbar />
      <Routes>
        {/* Public — redirect to dashboard if already logged in */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <Signup />} />

        {/* Protected — all authenticated roles can browse events and clubs */}
        <Route path="/events" element={<ProtectedRoute roles={["participant", "organizer", "admin"]}><Events /></ProtectedRoute>} />
        <Route path="/events/:id" element={<ProtectedRoute roles={["participant", "organizer", "admin"]}><EventDetail /></ProtectedRoute>} />
        <Route path="/clubs" element={<ProtectedRoute roles={["participant", "organizer", "admin"]}><ClubsList /></ProtectedRoute>} />
        <Route path="/clubs/:id" element={<ProtectedRoute roles={["participant", "organizer", "admin"]}><ClubDetail /></ProtectedRoute>} />

        {/* Participant */}
        <Route path="/onboarding" element={<ProtectedRoute roles={["participant"]}><Onboarding /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute roles={["participant"]}><Profile /></ProtectedRoute>} />

        {/* Organizer */}
        <Route path="/organizer/events" element={<ProtectedRoute roles={["organizer"]}><OrganizerEvents /></ProtectedRoute>} />
        <Route path="/organizer/events/:id" element={<ProtectedRoute roles={["organizer"]}><OrganizerEventDetail /></ProtectedRoute>} />
        <Route path="/organizer/create" element={<ProtectedRoute roles={["organizer"]}><OrganizerCreateEvent /></ProtectedRoute>} />
        <Route path="/organizer/profile" element={<ProtectedRoute roles={["organizer"]}><OrganizerProfile /></ProtectedRoute>} />
        <Route path="/organizer/payments" element={<ProtectedRoute roles={["organizer"]}><OrganizerPaymentApprovals /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin/organizers" element={<ProtectedRoute roles={["admin"]}><AdminOrganizers /></ProtectedRoute>} />
        <Route path="/admin/password-resets" element={<ProtectedRoute roles={["admin"]}><AdminPasswordResets /></ProtectedRoute>} />

        {/* Dashboard — all roles */}
        <Route path="/dashboard" element={<ProtectedRoute roles={["participant", "organizer", "admin"]}><Dashboard /></ProtectedRoute>} />

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

export default App;
