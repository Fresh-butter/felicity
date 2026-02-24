// Login.jsx — User login page

import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import useApi from "../hooks/useApi";

export default function Login() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const api = useApi();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event) {
    event.preventDefault();

    const { ok, data } = await api.post("/users/login", { email, password });

    if (ok) {
      login(data.user, data.token);
      navigate("/dashboard");
    } else {
      setErrorMessage(data.message || "Login failed");
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login</h2>
        {errorMessage && <p className="error-msg">{errorMessage}</p>}
        <form onSubmit={handleLogin}>
          <label className="form-label">Email <span className="form-required">*</span></label>
          <input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <label className="form-label">Password <span className="form-required">*</span></label>
          <input placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button type="submit" className="btn-accent">Login</button>
        </form>
        <p className="auth-link">No account? <Link to="/signup">Sign up</Link></p>
      </div>
    </div>
  );
}
