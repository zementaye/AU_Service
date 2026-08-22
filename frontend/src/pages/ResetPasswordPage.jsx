import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setDone(true);
      setTimeout(() => navigate("/login", { replace: true }), 2500);
    } catch (err) {
      setError(err.message || "Couldn't reset your password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-art">
        <div className="brand">
          <div className="brand-mark">AU</div>
          <div className="brand-title" style={{ color: "#fff", fontSize: 19 }}>
            Service Requests
          </div>
        </div>
        <p className="login-art-quote">
          "One request, tracked from submission to close — across every department."
        </p>
      </div>
      <div className="login-form-side">
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="eyebrow">Account recovery</span>
          <h1>Set a new password</h1>
          <p className="page-sub">Use at least 8 characters.</p>

          {!token && (
            <div className="error-banner">
              This link is missing its reset token. Request a new one from the{" "}
              <Link to="/forgot-password">forgot password</Link> page.
            </div>
          )}
          {error && <div className="error-banner">{error}</div>}

          {done ? (
            <div className="success-banner">
              <span aria-hidden="true">✓</span> Password updated. Redirecting to sign in…
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="newPassword">New password</label>
                <div className="password-field-wrap">
                  <input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    className="input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
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
              </div>
              <div className="field">
                <label htmlFor="confirmPassword">Confirm new password</label>
                <input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  className="input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%" }}
                disabled={loading || !token}
              >
                {loading ? "Updating…" : "Update password"}
              </button>
              <Link to="/login" className="back-link" style={{ display: "block", textAlign: "center", marginTop: 14 }}>
                ← Back to sign in
              </Link>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
