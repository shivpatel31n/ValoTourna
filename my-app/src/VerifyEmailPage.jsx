import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";

const TOKENS = {
  ink: "#0B0D0F",
  panel: "#14171A",
  steel: "#2A2E33",
  signal: "#D93A67",
  cyan: "#3ED6C5",
  off: "#E9EAEA",
  mute: "#8B9096",
};

const API_BASE = "http://localhost:5000/api/auth";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [status, setStatus] = useState("verifying"); // "verifying" | "done" | "error"
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token || !email) {
      setStatus("error");
      setMessage("This verification link looks incomplete.");
      return;
    }

    fetch(`${API_BASE}/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email }),
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        setStatus(ok ? "done" : "error");
        setMessage(data.message || (ok ? "Email verified." : "Couldn't verify that link."));
      })
      .catch(() => {
        setStatus("error");
        setMessage("Something went wrong — please try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.02em" }}>
          Email verification
        </h1>

        {status === "verifying" && (
          <p style={{ color: TOKENS.mute, fontSize: 14 }}>Verifying…</p>
        )}

        {status !== "verifying" && (
          <>
            <p
              style={{
                color: status === "done" ? TOKENS.cyan : TOKENS.signal,
                fontSize: 14,
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              {message}
            </p>
            <Link
              to="/"
              style={{
                display: "block",
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
              Go to ClutchCircuit
            </Link>
          </>
        )}
      </div>
    </div>
  );
}