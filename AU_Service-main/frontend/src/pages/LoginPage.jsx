import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginArtPanel from "../components/LoginArtPanel";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      const dest = location.state?.from?.pathname || "/";
      navigate(dest, { replace: true });
    } catch (err) {
      setError(err.message || "Couldn't sign in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <LoginArtPanel quote="One request, tracked from submission to close — across every department." />
      <div className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="eyebrow">Sign in</span>
          <h1>Welcome back</h1>
          <p className="page-sub">Enter your credentials to access your department's requests.</p>

          {error && <div className="error-banner">{error}</div>}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-field-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <Link to="/forgot-password" style={{ fontSize: 12.5, alignSelf: "flex-end", marginTop: 6 }}>
              Forgot password?
            </Link>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
