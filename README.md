# Felicity — Event Management System

A full-stack event management platform built with the **MERN stack** (MongoDB, Express, React, Node.js). Felicity allows organisers to create and manage events (workshops, hackathons, cultural fests, etc.), participants to browse, register, and provide feedback, and admins to oversee the entire system.

## Deployment

| Layer | URL |
|----------|------|
| Frontend | <https://felicity-neon.vercel.app/> |
| Backend | <https://felicity-ovcd.onrender.com> |

---

## Table of Contents

1. [Libraries & Justifications](#libraries--justifications)
2. [Advanced Features](#advanced-features)
3. [Project Structure](#project-structure)
4. [Setup & Installation](#setup--installation)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [Default Credentials](#default-credentials)
8. [Design Decisions](#design-decisions)

---

## Libraries & Justifications

### Backend

| Library | Version | Justification |
|---------|---------|---------------|
| **express** | 5.2.1 | Industry-standard Node.js web framework; minimal, fast, and well-documented for building REST APIs. |
| **mongoose** | 9.2.1 | Elegant MongoDB ODM with schema validation, middleware hooks, and population — simplifies data modelling for Users, Events, Registrations, etc. |
| **bcrypt** | 6.0.0 | Secure password hashing using the bcrypt algorithm with configurable salt rounds; protects stored credentials. |
| **jsonwebtoken** | 9.0.3 | Stateless JWT-based authentication; allows the server to verify users without session storage, fitting a decoupled SPA architecture. |
| **cors** | 2.8.6 | Enables Cross-Origin Resource Sharing so the Vite-hosted frontend can communicate with the Express backend on a different origin. |
| **dotenv** | 17.3.1 | Loads environment variables from `.env` files, keeping secrets (DB URI, JWT secret, email credentials) out of source code. |
| **fuse.js** | 7.1.0 | Lightweight client/server-side fuzzy search library; powers the event search feature with typo-tolerance and relevance scoring, without requiring an external search service. |
| **nodemailer** | 8.0.1 | Sends transactional emails (registration confirmations, QR codes, password-reset OTPs) via SMTP; well-maintained and supports attachments. |
| **qrcode** | 1.5.4 | Generates QR code images (as data URLs) encoding registration IDs; these are emailed to participants and scanned at venue entry for attendance tracking. |
| **socket.io** | 4.8.3 | Provides real-time, bidirectional WebSocket communication for the live discussion forum; falls back to polling for broad browser support. |
| **node-fetch** | 3.3.2 | Lightweight HTTP client for making server-side fetch requests (e.g., Cloudinary interactions). |
| **nodemon** | 3.1.14 *(dev)* | Auto-restarts the server on file changes during development, improving the dev feedback loop. |

### Frontend

| Library | Version | Justification |
|---------|---------|---------------|
| **react** | 19.2.0 | Component-based UI library; enables declarative views, efficient reconciliation, and a rich ecosystem. |
| **react-dom** | 19.2.0 | React renderer for the browser DOM. |
| **react-router-dom** | 7.13.0 | Declarative client-side routing with nested routes and protected-route wrappers; essential for SPA navigation across dashboards, event pages, and admin panels. |
| **socket.io-client** | 4.8.3 | Pairs with the Socket.IO server to provide real-time discussion forum updates on the frontend. |
| **html5-qrcode** | 2.3.8 | In-browser QR code scanning from camera or image files; used by organisers to scan participant QR codes for attendance without any native app. |
| **vite** | 7.3.1 *(dev)* | Lightning-fast build tool with HMR; significantly faster than CRA for development and produces optimised production bundles. |
| **@vitejs/plugin-react** | 5.1.1 *(dev)* | Vite plugin providing React Fast Refresh and JSX transform support. |
| **eslint** | 9.39.1 *(dev)* | Static analysis for code quality and consistency. |

### External Services

| Service | Usage |
|---------|-------|
| **Cloudinary** | Unsigned image uploads for event posters and profile pictures; avoids storing large binaries in MongoDB. |
| **MongoDB Atlas** | Cloud-hosted MongoDB database; free tier used for development and deployment. |
| **Render** | Backend deployment with automatic Git-based deploys. |
| **Vercel** | Frontend deployment with edge CDN and automatic preview deployments. |

---

## Advanced Features

### Tier A — Merchandise Payment Approval + QR Scanner / Attendance

**Merchandise Payment Approval:**
- Events can include merchandise items (t-shirts, mugs, etc.) with configurable names and prices.
- When a participant registers for an event with merchandise, they upload a payment screenshot via Cloudinary.
- The registration is created with `paymentStatus: "pending"`.
- Organisers see a dedicated **Payment Approvals** page listing all pending merchandise registrations with the uploaded screenshot.
- Organisers can **approve** or **reject** each payment. On approval, a confirmation email with a QR code is sent to the participant.

**QR Code Attendance System:**
- Upon successful registration (or payment approval for merchandise events), a QR code encoding the registration ID is generated using the `qrcode` library and emailed to the participant as an inline attachment.
- Organisers can scan QR codes on the **Event Detail** page using the `html5-qrcode` library — either via the device camera or by uploading an image file.
- The backend validates that: (a) the registration exists for that event, (b) the event is currently **ongoing** (computed dynamically from start/end dates using `computeStatus()`), and (c) the participant has not already been checked in.
- Organisers can also manually check in participants from the registrations list.
- Attendance counts are shown in real-time on the organiser dashboard.

**Design decisions:**
- `computeStatus()` dynamically derives event status from date fields rather than relying on a mutable `status` field, ensuring QR scanning only works during the actual event window.
- QR codes are embedded as `cid`-referenced inline attachments in emails so they render reliably across mail clients.

---

### Tier B — Real-Time Discussion Forum + Organiser Password Reset

**Real-Time Discussion Forum:**
- Each event has a dedicated discussion forum accessible to registered participants and the event organiser.
- Messages are sent and received in **real-time** using **Socket.IO** WebSockets.
- The backend groups connections by event room (`event:<eventId>`), so messages are only broadcast to users in the same event discussion.
- The `ChatBox` component auto-scrolls to the latest message and displays sender names with timestamps.
- When an organiser posts a message, **in-app notifications** are created for all registered participants of that event via `Notification.insertMany()`.
- The `Navbar` component displays a notification bell icon with an **unread badge** (polled every 15 seconds). Clicking the bell opens a dropdown showing notifications; clicking a notification navigates to the event's detail page and marks it as read.

**Organiser Password Reset (Admin-Approved):**
- Organisers can request a password reset from their profile page.
- The request is stored as a `PasswordResetRequest` document with status `"pending"`.
- Admins see all pending reset requests on the **Admin Password Resets** page.
- When an admin approves a request, a one-time password (OTP) is generated and emailed to the organiser.
- The organiser then enters the OTP on the reset form to set a new password.
- The OTP is hashed with bcrypt before storage and verified on submission.

**Design decisions:**
- Socket.IO rooms provide natural event-scoped isolation without custom pub/sub infrastructure.
- Notifications use a polling approach (15s interval) rather than a dedicated WebSocket channel to keep complexity low; the bell badge gives sufficient real-time feel.
- Password reset uses an admin-approval gate to prevent unauthorized resets, and the OTP is hashed at rest for security.

---

### Tier C — Anonymous Feedback System

- Participants can submit feedback (rating 1–5 + optional text comment) for events they attended, but only **after the event has ended**.
- Feedback is **fully anonymous**: the `Feedback` model stores only `eventId`, `rating`, and `comment` — no `userId` reference.
- To prevent duplicate submissions while maintaining anonymity, the participant's `Registration` document has a `feedbackSubmitted` boolean flag. The backend checks this flag before accepting feedback, then sets it to `true` — so the system knows *a* registration submitted feedback, but the feedback document itself cannot be traced back to any user.
- Organisers see aggregated feedback (average rating + all comments) on their event detail page, with no way to identify who left which comment.

**Design decisions:**
- Separating the "has submitted" flag from the feedback content is the key to achieving both duplicate prevention and true anonymity.
- The feedback form only appears for events with status `"completed"` (computed dynamically), ensuring feedback is collected post-event.

---

## Project Structure

```
felicity/
├── README.md
├── deployment.txt
├── backend/
│   ├── package.json
│   ├── .env                    # (not committed)
│   └── src/
│       ├── server.js           # Express app + Socket.IO setup
│       ├── middleware/
│       │   └── authMiddleware.js  # JWT verification + role guards
│       ├── models/
│       │   ├── User.js
│       │   ├── Organizer.js
│       │   ├── Event.js
│       │   ├── Registration.js
│       │   ├── Feedback.js
│       │   ├── Discussion.js
│       │   ├── Notification.js
│       │   └── PasswordResetRequest.js
│       ├── routes/
│       │   ├── userRoutes.js           # Auth (signup/login) + profile
│       │   ├── eventCrud.js            # Public event listing, detail, feedback
│       │   ├── eventHelpers.js         # computeStatus(), date utilities
│       │   ├── registrationRoutes.js   # QR scan + manual check-in
│       │   ├── normalRegistration.js   # Free-event registration
│       │   ├── merchandiseRegistration.js  # Paid-event registration
│       │   ├── organizerRoutes.js      # Organizer CRUD + password reset
│       │   ├── adminRoutes.js          # Admin organizer/reset management
│       │   ├── discussionRoutes.js     # Real-time forum messages
│       │   └── notificationRoutes.js   # In-app notifications
│       ├── seed/
│       │   └── seedAdmin.js            # Seeds default admin user
│       └── utils/
│           └── mailer.js               # Nodemailer transporter
└── frontend/
    ├── package.json
    ├── index.html
    ├── vite.config.js
    ├── .env                    # (not committed)
    └── src/
        ├── main.jsx
        ├── App.jsx             # Route definitions
        ├── index.css           # Global styles
        ├── context/
        │   └── AuthContext.jsx # JWT auth state + role management
        ├── hooks/
        │   └── useApi.js       # Axios-like fetch wrapper with auth
        ├── utils/
        │   └── cloudinaryUpload.js  # Unsigned Cloudinary upload helper
        ├── components/
        │   ├── Navbar.jsx          # Navigation + notification bell
        │   ├── ProtectedRoute.jsx  # Role-based route guard
        │   ├── ChatBox.jsx         # Socket.IO discussion forum UI
        │   ├── EventForm.jsx       # Event creation/edit form
        │   ├── FormField.jsx       # Dynamic custom-field builder
        │   ├── FormFieldRenderer.jsx  # Renders custom fields in registration
        │   └── MerchSelector.jsx   # Merchandise item selector
        └── pages/
            ├── Login.jsx
            ├── Signup.jsx
            ├── Onboarding.jsx          # Post-signup interest selection
            ├── Dashboard.jsx           # Participant home (recommended events)
            ├── Events.jsx              # Browse/search all events
            ├── EventDetail.jsx         # Event info, registration, feedback
            ├── Profile.jsx             # Participant profile + registrations
            ├── ClubsList.jsx           # Browse organiser clubs
            ├── ClubDetail.jsx          # Club page with events
            ├── OrganizerEvents.jsx     # Organiser's event list
            ├── OrganizerCreateEvent.jsx  # Create/edit event
            ├── OrganizerEventDetail.jsx  # Registrations, QR scan, attendance
            ├── OrganizerProfile.jsx      # Organiser profile + password reset
            ├── OrganizerPaymentApprovals.jsx  # Approve/reject merch payments
            ├── AdminOrganizers.jsx     # Admin: manage organisers
            └── AdminPasswordResets.jsx # Admin: approve password resets
```

---

## Setup & Installation

### Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **MongoDB** (local instance or MongoDB Atlas URI)
- **Cloudinary** account (for image uploads — free tier works)

### 1. Clone the repository

```bash
git clone <repository-url>
cd felicity
```

### 2. Backend setup

```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:

```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/felicity
JWT_SECRET=your_jwt_secret_here
PORT=5000
ENABLE_MAILS=true
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

Seed the admin user:

```bash
npm run seed:admin
```

Start the development server:

```bash
npm run dev
```

### 3. Frontend setup

```bash
cd ../frontend
npm install
```

Create a `.env` file in `frontend/`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_BACKEND_URL=http://localhost:5000
VITE_CLOUD_NAME=your_cloudinary_cloud_name
VITE_UPLOAD_PRESET=your_unsigned_upload_preset
```

Start the development server:

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173` by default.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Secret key for signing JWTs |
| `PORT` | ❌ | Server port (default: `5000`) |
| `ENABLE_MAILS` | ❌ | Set to `"true"` to enable email sending; if unset or false, emails are skipped (useful for local dev) |
| `EMAIL_USER` | ⚠️ | Gmail address for sending emails (required if `ENABLE_MAILS=true`) |
| `EMAIL_PASS` | ⚠️ | Gmail App Password (required if `ENABLE_MAILS=true`) |

### Frontend (`frontend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | ✅ | Backend API base URL (e.g., `http://localhost:5000/api`) |
| `VITE_BACKEND_URL` | ✅ | Backend base URL for Socket.IO (e.g., `http://localhost:5000`) |
| `VITE_CLOUD_NAME` | ✅ | Cloudinary cloud name for image uploads |
| `VITE_UPLOAD_PRESET` | ✅ | Cloudinary unsigned upload preset name |

---

## Running the Application

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

For production builds:

```bash
# Frontend
cd frontend
npm run build      # outputs to dist/
npm run preview    # preview production build locally
```

---

## Default Credentials

After running the seed script (`npm run seed:admin`), the following accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@felicity.com` | `admin123` |

Organiser accounts are created by the admin through the **Admin → Manage Organisers** page. Participant accounts are self-registered via the signup page.

---

## Design Decisions

1. **Dynamic Event Status** — Rather than storing a mutable `status` field that requires cron jobs or manual updates, `computeStatus()` derives status (`"upcoming"`, `"ongoing"`, `"completed"`) from `startDate` and `endDate` at query time. This ensures consistency and eliminates race conditions.

2. **Stateless Authentication** — JWT tokens stored in `localStorage` with role-based claims (`role: "user" | "organizer" | "admin"`) enable stateless auth. The `ProtectedRoute` component on the frontend and `authMiddleware` on the backend enforce role-based access.

3. **Anonymous Feedback Architecture** — The feedback model intentionally omits any user reference. Duplicate prevention uses a `feedbackSubmitted` flag on the Registration document — this flag links to the *registration*, not the feedback, so there's no way to join feedback back to a user.

4. **Real-Time via Socket.IO** — The discussion forum uses Socket.IO with room-based isolation (`event:<id>`). Messages are persisted to MongoDB before broadcast, so the chat history loads on page open and new messages arrive in real-time.

5. **Cloudinary for Media** — Event posters and profile images use unsigned Cloudinary uploads directly from the browser. This offloads bandwidth and storage from the backend and provides automatic CDN delivery with transformation capabilities.

6. **Fuzzy Search with Fuse.js** — Event search uses Fuse.js for client-tolerant fuzzy matching on event names and descriptions, providing a better UX than exact-match database queries.

7. **Email as Attachment** — QR codes are generated as data URLs, converted to buffers, and sent as inline `cid`-referenced email attachments rather than as external links. This ensures QR codes display reliably in all email clients without requiring the image to be hosted.
