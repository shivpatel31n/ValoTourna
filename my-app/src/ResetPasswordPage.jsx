import React, { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";

const TOKENS = {
  ink: "#0B0D0F",
  panel: "#14171A",
  panel2: "#191D21",
  steel: "#2A2E33",
  signal: "#D93A67",
  cyan: "#3ED6C5",
  off: "#E9EAEA",
  mute: "#8B9096",
};

const API_BASE = "http://localhost:5000/api/auth";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const missingLinkParams = !token || !email;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't reset your password.");
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: TOKENS.ink,
        color: TOKENS.off,
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: TOKENS.panel,
          border: `1px solid ${TOKENS.steel}`,
          padding: 36,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.02em" }}>
          Reset password
        </h1>

        {missingLinkParams ? (
          <p style={{ color: TOKENS.mute, fontSize: 14, lineHeight: 1.6 }}>
            This reset link looks incomplete. Head back to the login page and request a new one from
            "Forgot password?".
          </p>
        ) : done ? (
          <>
            <p style={{ color: TOKENS.mute, fontSize: 14, marginBottom: 22, lineHeight: 1.6 }}>
              Your password has been updated. You can log in with it now.
            </p>
            <Link
              to="/"
              style={{
                display: "block",
                textAlign: "center",
                padding: "13px 22px",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                border: `1px solid ${TOKENS.signal}`,
                background: TOKENS.signal,
                color: "#0B0D0F",
                textDecoration: "none",
              }}
            >
              Go to login
            </Link>
          </>
        ) : (
          <>
            <p style={{ color: TOKENS.mute, fontSize: 13, marginBottom: 24 }}>
              For <strong style={{ color: TOKENS.off }}>{email}</strong>
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>NEW PASSWORD</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>CONFIRM NEW PASSWORD</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  style={inputStyle}
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "rgba(217, 58, 103, 0.12)",
                    border: `1px solid ${TOKENS.signal}`,
                    color: TOKENS.signal,
                    fontSize: 13,
                    padding: "10px 14px",
                    marginBottom: 18,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  padding: "13px 22px",
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: "0.03em",
                  textTransform: "uppercase",
                  border: `1px solid ${TOKENS.signal}`,
                  background: TOKENS.signal,
                  color: "#0B0D0F",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Saving…" : "Set new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const labelStyle = {
  fontSize: 11,
  color: TOKENS.mute,
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: 8,
};

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  background: TOKENS.panel2,
  border: `1px solid ${TOKENS.steel}`,
  color: TOKENS.off,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
};