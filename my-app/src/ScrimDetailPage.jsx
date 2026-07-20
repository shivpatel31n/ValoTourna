import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const TOKENS = {
  ink: "#0B0D0F",
  panel: "#14171A",
  steel: "#2A2E33",
  signal: "#D93A67",
  cyan: "#3ED6C5",
  off: "#E9EAEA",
  mute: "#8B9096",
};

const API_BASE = "http://localhost:5000/api/scrims";
const TEAMS_API_BASE = "http://localhost:5000/api/teams";
const DISCORD_URL = "https://discord.gg/7RCDt277Y";

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ScrimDetailPage({ user, onRequireAuth }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scrim, setScrim] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [challengeMessage, setChallengeMessage] = useState("");

  useEffect(() => {
    loadScrim();
    if (user) {
      fetch(`${TEAMS_API_BASE}/mine`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((data) => setMyTeam(data.team || null))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  async function loadScrim() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not load scrim post.");
      setScrim(data.scrim);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function callAction(path, options = {}) {
    setBusy(true);
    setActionError("");
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: options.method || "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Something went wrong.");
      if (data.scrim) setScrim(data.scrim);
      return true;
    } catch (err) {
      setActionError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Shell><p className="sd-mono" style={{ color: TOKENS.mute }}>Loading scrim post…</p></Shell>;
  if (error) return <Shell><p className="sd-mono" style={{ color: TOKENS.signal }}>{error}</p></Shell>;
  if (!scrim) return null;

  const isCaptain = user && myTeam && myTeam.id === scrim.team?.id;
  const isOwnTeam = isCaptain;
  const alreadyRequested = myTeam && scrim.requests?.some((r) => r.team?.id === myTeam.id);

  function handleChallengeClick() {
    if (!user) return onRequireAuth?.();
    callAction(`/${id}/request`, { body: { message: challengeMessage } }).then((ok) => {
      if (ok) setChallengeMessage("");
    });
  }
  function handleAccept(teamId) {
    callAction(`/${id}/requests/${teamId}/accept`);
  }
  function handleReject(teamId) {
    callAction(`/${id}/requests/${teamId}/reject`);
  }
  function handleCancel() {
    if (!confirm("Cancel this scrim post?")) return;
    callAction(`/${id}`, { method: "DELETE" }).then((ok) => {
      if (ok) navigate("/scrims");
    });
  }

  return (
    <Shell>
      <div
        className="sd-mono sd-back"
        onClick={() => navigate("/scrims")}
        style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
      >
        ← Back to scrims
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
        <h1 className="sd-h" style={{ fontSize: 32 }}>
          {scrim.team?.name} {scrim.team?.tag && <span style={{ color: TOKENS.mute, fontSize: 18 }}>[{scrim.team.tag}]</span>}
        </h1>
        {isCaptain && scrim.status === "open" && (
          <button className="sd-btn sd-mono" onClick={handleCancel} style={dangerBtnStyle}>
            Cancel post
          </button>
        )}
      </div>

      <div className="sd-mono" style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>{scrim.region}</span>
        <span>{scrim.minRank}{scrim.minRank !== scrim.maxRank ? ` – ${scrim.maxRank}` : ""}</span>
        <span
          style={{
            color: scrim.status === "open" ? TOKENS.cyan : scrim.status === "matched" ? TOKENS.off : TOKENS.mute,
            textTransform: "capitalize",
          }}
        >
          {scrim.status}
        </span>
      </div>

      <p style={{ color: TOKENS.off, fontSize: 14, marginBottom: 8 }}>{scrim.availability}</p>
      {scrim.notes && (
        <p style={{ color: TOKENS.mute, fontSize: 13, fontStyle: "italic", marginBottom: 30 }}>"{scrim.notes}"</p>
      )}

      {scrim.status === "matched" && scrim.matchedWith && (
        <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.cyan}`, padding: 20, marginBottom: 30 }}>
          <p className="sd-mono" style={{ fontSize: 13, color: TOKENS.cyan, marginBottom: 6 }}>MATCHED</p>
          <p style={{ color: TOKENS.off, fontSize: 15 }}>
            Scrimming against <strong>{scrim.matchedWith.name}</strong>
            {scrim.matchedWith.tag && ` [${scrim.matchedWith.tag}]`} — {scrim.matchedWith.region}
          </p>
        </div>
      )}

      {isCaptain && scrim.status === "open" && scrim.requests?.length > 0 && (
        <>
          <h2 className="sd-h" style={{ fontSize: 20, marginBottom: 16 }}>Scrim requests</h2>
          {actionError && (
            <p className="sd-mono" style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 12 }}>{actionError}</p>
          )}
          <div style={{ display: "grid", gap: 10, marginBottom: 30 }}>
            {scrim.requests.map((r) => (
              <div key={r.team?.id} style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div className="sd-mono" style={{ fontSize: 14, color: TOKENS.off, marginBottom: 4 }}>
                    {r.team?.name} {r.team?.tag && `[${r.team.tag}]`} <span style={{ color: TOKENS.mute }}>· {r.team?.region}</span>
                  </div>
                  <div className="sd-mono" style={{ fontSize: 12, color: TOKENS.mute }}>
                    Requested by {r.requestedBy?.username}
                  </div>
                  {r.message && <div style={{ fontSize: 13, color: TOKENS.off, marginTop: 6 }}>"{r.message}"</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="sd-btn sd-mono" disabled={busy} onClick={() => handleAccept(r.team.id)} style={primaryBtnStyle}>Accept</button>
                  <button className="sd-btn sd-mono" disabled={busy} onClick={() => handleReject(r.team.id)} style={secondaryBtnStyle}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isOwnTeam && scrim.status === "open" && (
        <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 20, marginBottom: 30 }}>
          {!user ? (
            <button className="sd-btn sd-mono" onClick={() => onRequireAuth?.()} style={primaryBtnStyle}>
              Log in to request a scrim
            </button>
          ) : !myTeam ? (
            <p className="sd-mono" style={{ color: TOKENS.mute, fontSize: 13 }}>
              You need to be a team captain to request a scrim.
            </p>
          ) : alreadyRequested ? (
            <p className="sd-mono" style={{ color: TOKENS.cyan, fontSize: 13 }}>Your scrim request is pending.</p>
          ) : (
            <>
              <label className="sd-mono" style={{ fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em", display: "block", marginBottom: 8 }}>
                MESSAGE (optional)
              </label>
              <textarea
                value={challengeMessage}
                onChange={(e) => setChallengeMessage(e.target.value)}
                placeholder="Say a bit about your team's rank and preferred format"
                rows={2}
                style={{
                  width: "100%",
                  background: TOKENS.ink,
                  border: `1px solid ${TOKENS.steel}`,
                  color: TOKENS.off,
                  padding: "10px 12px",
                  fontSize: 14,
                  boxSizing: "border-box",
                  resize: "vertical",
                  fontFamily: "inherit",
                  marginBottom: 12,
                }}
              />
              {actionError && <p className="sd-mono" style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 12 }}>{actionError}</p>}
              <button className="sd-btn sd-mono" disabled={busy} onClick={handleChallengeClick} style={primaryBtnStyle}>
                {busy ? "Sending…" : "Request this scrim"}
              </button>
            </>
          )}
        </div>
      )}

      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noreferrer"
        className="sd-mono"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "rgba(62, 214, 197, 0.08)",
          border: `1px solid ${TOKENS.cyan}`,
          color: TOKENS.off,
          padding: "14px 20px",
          textDecoration: "none",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1.5 }}>
          Matched up? <strong style={{ color: TOKENS.cyan }}>Join our Discord</strong> to lock in the time and play.
        </span>
        <span style={{ flexShrink: 0, background: TOKENS.cyan, color: TOKENS.ink, padding: "8px 16px", fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          Join Discord →
        </span>
      </a>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: TOKENS.ink, color: TOKENS.off, fontFamily: "'Inter', sans-serif", padding: "60px 32px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .sd-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .sd-mono { font-family:'JetBrains Mono', monospace; }
        .sd-back { cursor:pointer; transition: color .15s; }
        .sd-back:hover { color: ${TOKENS.cyan}; }
        .sd-btn { cursor:pointer; transition: opacity .15s; }
        .sd-btn:hover { opacity: 0.85; }
      `}</style>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

const primaryBtnStyle = {
  background: TOKENS.cyan,
  color: TOKENS.ink,
  padding: "10px 18px",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  border: "none",
};
const secondaryBtnStyle = {
  background: "transparent",
  color: TOKENS.off,
  padding: "10px 18px",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  border: `1px solid ${TOKENS.steel}`,
};
const dangerBtnStyle = {
  background: "transparent",
  color: TOKENS.signal,
  padding: "10px 18px",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  border: `1px solid ${TOKENS.signal}`,
};