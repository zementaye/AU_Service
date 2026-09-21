import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function initials(name = "") {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from your current password.");
      return;
    }

    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setSuccess("Password updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Couldn't update your password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <span className="eyebrow">Account</span>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Manage your account details.</p>
        </div>
      </div>

      <div className="card settings-card" style={{ maxWidth: 480 }}>
        <div className="settings-profile">
          <div className="settings-avatar">{initials(user?.name)}</div>
          <div>
            <div className="settings-name">{user?.name}</div>
            <div className="settings-email">{user?.email}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div>
              <h3 style={{ marginBottom: 4 }}>Change password</h3>
              <p className="page-sub settings-section-sub">Use at least 8 characters.</p>
            </div>
            <button
              type="button"
              className="password-toggle"
              style={{ position: "static", marginBottom: 18 }}
              onClick={() => setShowPasswords((v) => !v)}
            >
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>
          </div>

          {error && (
            <div className="error-banner">
              <span aria-hidden="true">⚠</span> {error}
            </div>
          )}
          {success && (
            <div className="success-banner">
              <span aria-hidden="true">✓</span> {success}
            </div>
          )}

          <div className="field">
            <label htmlFor="currentPassword">Current password</label>
            <input
              id="currentPassword"
              type={showPasswords ? "text" : "password"}
              className="input"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type={showPasswords ? "text" : "password"}
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <input
              id="confirmPassword"
              type={showPasswords ? "text" : "password"}
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
