import React, { useState, useEffect, useRef } from "react";

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

// Point this at wherever your Express server runs
const API_BASE = "http://localhost:5000/api/auth";
// Set VITE_GOOGLE_CLIENT_ID in my-app/.env — create one at
// https://console.cloud.google.com/apis/credentials (OAuth client ID, Web
// application type; add this app's origin under "Authorized JavaScript
// origins"). The Google button silently doesn't render without this set.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];

export default function AuthPage({ onAuthSuccess, onClose }) {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    riotName: "",
    riotTag: "",
    role: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Set once Google hands back a credential for an account that doesn't
  // exist here yet — while this is non-null, the form below switches into
  // "finish creating your account" mode instead of login/signup.
  const [googleProfile, setGoogleProfile] = useState(null); // { credential, email, suggestedUsername }
  const googleButtonRef = useRef(null);

  const isSignup = mode === "signup";

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    function renderButton() {
      if (!window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "filled_black",
        size: "large",
        width: 340,
        text: "continue_with",
      });
    }

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function finishAuth(data) {
    // Store the JWT — swap for a more secure storage strategy in production
    localStorage.setItem("cc_token", data.token);
    localStorage.setItem("cc_user", JSON.stringify(data.user));
    if (onAuthSuccess) onAuthSuccess(data.user, data.token);
    if (onClose) onClose();
  }

  async function handleGoogleCredential(response) {
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Google sign-in failed.");

      if (data.needsProfile) {
        // Not a full account yet — collect the Riot ID/username Google
        // doesn't provide, then finish via /google/complete-profile.
        setGoogleProfile({
          credential: response.credential,
          email: data.email,
        });
        setForm((f) => ({ ...f, username: data.suggestedUsername || "", email: data.email }));
        return;
      }

      finishAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteGoogleProfile(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/google/complete-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credential: googleProfile.credential,
          username: form.username,
          riotName: form.riotName,
          riotTag: form.riotTag,
          role: form.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Couldn't finish creating your account.");
      finishAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isSignup ? "/signup" : "/login";
      const payload = isSignup
        ? form
        : { email: form.email, password: form.password };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      finishAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(11, 13, 15, 0.85)",
        backdropFilter: "blur(4px)",
        color: TOKENS.off,
        fontFamily: "'Inter', sans-serif",
        padding: 20,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .cc-auth-h1 { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .cc-auth-mono { font-family:'JetBrains Mono', monospace; }
        .cc-auth-input::placeholder { color: ${TOKENS.mute}; }
        .cc-auth-input:focus { outline:none; border-color:${TOKENS.cyan}; }
        .cc-auth-tab { cursor:pointer; transition: color .15s, border-color .15s; }
        .cc-auth-close:hover { color: ${TOKENS.off} !important; border-color: ${TOKENS.cyan} !important; }
      `}</style>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 420,
          background: TOKENS.panel,
          border: `1px solid ${TOKENS.steel}`,
          clipPath: "polygon(24px 0, 100% 0, 100% 100%, 0 100%, 0 24px)",
          padding: 40,
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close"
            className="cc-auth-close"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: `1px solid ${TOKENS.steel}`,
              color: TOKENS.mute,
              fontSize: 16,
              cursor: "pointer",
              transition: "all .15s",
            }}
          >
            ✕
          </button>
        )}
        {/* Logo */}
        <div
          className="cc-auth-h1"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontWeight: 700,
            fontSize: 20,
            marginBottom: 30,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              background: TOKENS.signal,
              clipPath: "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
              display: "inline-block",
            }}
          />
          Clutch Circuit
        </div>

        {googleProfile ? (
          <>
            <h2 className="cc-auth-h1" style={{ fontSize: 24, marginBottom: 6 }}>
              Almost there
            </h2>
            <p style={{ color: TOKENS.mute, fontSize: 14, marginBottom: 26 }}>
              Signed in as <strong style={{ color: TOKENS.off }}>{googleProfile.email}</strong> via
              Google — just need your Riot ID to finish setting up your account.
            </p>

            <form onSubmit={handleCompleteGoogleProfile}>
              <div style={{ marginBottom: 16 }}>
                <label className="cc-auth-mono" style={labelStyle}>USERNAME</label>
                <input
                  className="cc-auth-input"
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="kessu"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="cc-auth-mono" style={labelStyle}>RIOT ID</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    className="cc-auth-input"
                    type="text"
                    name="riotName"
                    value={form.riotName}
                    onChange={handleChange}
                    placeholder="kessu"
                    required
                    style={{ ...inputStyle, flex: 2 }}
                  />
                  <span style={{ color: TOKENS.mute, fontSize: 16 }}>#</span>
                  <input
                    className="cc-auth-input"
                    type="text"
                    name="riotTag"
                    value={form.riotTag}
                    onChange={handleChange}
                    placeholder="1234"
                    required
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
                <p style={{ fontSize: 11, color: TOKENS.mute, marginTop: 6 }}>
                  We'll fetch your current rank automatically from this.
                </p>
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="cc-auth-mono" style={labelStyle}>ROLE</label>
                <select
                  className="cc-auth-input"
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  required
                  style={inputStyle}
                >
                  <option value="" disabled>Select role</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
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
                  clipPath:
                    "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Please wait…" : "Finish creating account"}
              </button>
            </form>
          </>
        ) : (
          <>
        {GOOGLE_CLIENT_ID && (
          <div style={{ marginBottom: 22 }}>
            <div ref={googleButtonRef} style={{ display: "flex", justifyContent: "center" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "18px 0" }}>
              <div style={{ flex: 1, height: 1, background: TOKENS.steel }} />
              <span className="cc-auth-mono" style={{ fontSize: 11, color: TOKENS.mute }}>OR</span>
              <div style={{ flex: 1, height: 1, background: TOKENS.steel }} />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 28,
            borderBottom: `1px solid ${TOKENS.steel}`,
          }}
        >
          {["login", "signup"].map((m) => (
            <div
              key={m}
              className="cc-auth-tab cc-auth-mono"
              onClick={() => {
                setMode(m);
                setError("");
              }}
              style={{
                paddingBottom: 12,
                fontSize: 13,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: mode === m ? TOKENS.off : TOKENS.mute,
                borderBottom: `2px solid ${mode === m ? TOKENS.signal : "transparent"}`,
              }}
            >
              {m === "login" ? "Log In" : "Sign Up"}
            </div>
          ))}
        </div>

        <h2 className="cc-auth-h1" style={{ fontSize: 24, marginBottom: 6 }}>
          {isSignup ? "Create your account" : "Welcome back"}
        </h2>
        <p style={{ color: TOKENS.mute, fontSize: 14, marginBottom: 26 }}>
          {isSignup
            ? "Join the circuit and start squading up."
            : "Log in to manage your teams and tournaments."}
        </p>

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div style={{ marginBottom: 16 }}>
              <label
                className="cc-auth-mono"
                style={{ fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}
              >
                USERNAME
              </label>
              <input
                className="cc-auth-input"
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="kessu"
                required
                style={inputStyle}
              />
            </div>
          )}

          {isSignup && (
            <div style={{ marginBottom: 16 }}>
              <label
                className="cc-auth-mono"
                style={{ fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}
              >
                RIOT ID
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  className="cc-auth-input"
                  type="text"
                  name="riotName"
                  value={form.riotName}
                  onChange={handleChange}
                  placeholder="kessu"
                  required
                  style={{ ...inputStyle, flex: 2 }}
                />
                <span style={{ color: TOKENS.mute, fontSize: 16 }}>#</span>
                <input
                  className="cc-auth-input"
                  type="text"
                  name="riotTag"
                  value={form.riotTag}
                  onChange={handleChange}
                  placeholder="1234"
                  required
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
              <p style={{ fontSize: 11, color: TOKENS.mute, marginTop: 6 }}>
                We'll fetch your current rank automatically from this.
              </p>
            </div>
          )}

          {isSignup && (
            <div style={{ marginBottom: 16 }}>
              <label
                className="cc-auth-mono"
                style={{ fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}
              >
                ROLE
              </label>
              <select
                className="cc-auth-input"
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                style={inputStyle}
              >
                <option value="" disabled>Select role</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label
              className="cc-auth-mono"
              style={{ fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}
            >
              EMAIL
            </label>
            <input
              className="cc-auth-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: isSignup ? 24 : 12 }}>
            <label
              className="cc-auth-mono"
              style={{ fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}
            >
              PASSWORD
            </label>
            <input
              className="cc-auth-input"
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              minLength={6}
              style={inputStyle}
            />
          </div>

          {!isSignup && (
            <div style={{ textAlign: "right", marginBottom: 20 }}>
              <a
                href="#"
                className="cc-auth-mono"
                style={{ fontSize: 12, color: TOKENS.cyan, textDecoration: "none" }}
              >
                Forgot password?
              </a>
            </div>
          )}

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
              clipPath:
                "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Please wait…" : isSignup ? "Create Account" : "Log In"}
          </button>
        </form>

        <p style={{ marginTop: 22, fontSize: 13, color: TOKENS.mute, textAlign: "center" }}>
          {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
          <span
            className="cc-auth-tab"
            onClick={() => {
              setMode(isSignup ? "login" : "signup");
              setError("");
            }}
            style={{ color: TOKENS.cyan, fontWeight: 500 }}
          >
            {isSignup ? "Log in" : "Sign up"}
          </span>
        </p>
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