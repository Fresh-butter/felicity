// Signup.jsx — New participant registration page

import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import useApi from "../hooks/useApi";
import FormField from "../components/FormField";

export default function Signup() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const api = useApi();

  // Individual state for each form field
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [participantType, setParticipantType] = useState("non-iiit");

  const [errorMessage, setErrorMessage] = useState("");

  async function handleSignup(event) {
    event.preventDefault();

    const signupData = {
      firstName,
      lastName,
      email,
      password,
      participantType,
    };

    const { ok, data } = await api.post("/users/signup", signupData);

    if (ok) {
      // Use AuthContext login for proper SPA state management
      login(data.user, data.token);
      navigate("/onboarding");
    } else {
      setErrorMessage(data.message || "Signup failed");
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Sign Up</h2>
        {errorMessage && <p className="error-msg">{errorMessage}</p>}
        <form onSubmit={handleSignup}>
          <FormField label="First Name" required>
            <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
          </FormField>
          <FormField label="Last Name" required>
            <input value={lastName} onChange={(event) => setLastName(event.target.value)} required />
          </FormField>
          <FormField label="Email" required>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </FormField>
          <FormField label="Password" required>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
          </FormField>
          <FormField label="Participant Type">
            <select value={participantType} onChange={(event) => setParticipantType(event.target.value)}>
              <option value="non-iiit">Non-IIIT</option>
              <option value="iiit">IIIT Student</option>
            </select>
          </FormField>

          <button type="submit" className="btn-accent">Sign Up</button>
        </form>
        <p className="auth-link">Have an account? <Link to="/login">Login</Link></p>
      </div>
    </div>
  );
}
