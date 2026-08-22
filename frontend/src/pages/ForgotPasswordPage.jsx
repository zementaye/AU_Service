import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setResult(res);
    } catch (err) {
      setError(err.message || "Couldn't send a reset link. Try again.");
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
          <h1>Forgot your password?</h1>
          <p className="page-sub">
            Enter the email on your account and we'll send a link to reset it.
          </p>

          {error && <div className="error-banner">{error}</div>}

          {result ? (
            <>
              <div className="success-banner">
                <span aria-hidden="true">✓</span> {result.message}
              </div>
              {result.devResetLink && (
                <div className="card card-pad" style={{ marginBottom: 18, fontSize: 13 }}>
                  <strong>Dev mode:</strong> no email provider is configured yet, so here's
                  the link directly — <a href={result.devResetLink}>open reset link</a>.
                </div>
              )}
              <Link to="/login" className="btn btn-ghost" style={{ width: "100%", textAlign: "center" }}>
                Back to sign in
              </Link>
            </>
          ) : (
            <>
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

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
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
