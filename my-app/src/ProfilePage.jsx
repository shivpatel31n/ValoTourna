import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

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

const API_BASE = "http://localhost:5000/api/players";
const TOURNAMENTS_API_BASE = "http://localhost:5000/api/tournaments";

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ProfilePage({ user, onRequireAuth, onLogout }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState({ username: "", role: "", lookingForTeam: true });
  const [respondingSlug, setRespondingSlug] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const [profileRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/me`, { headers: authHeaders() }),
        fetch(`${API_BASE}/me/history`, { headers: authHeaders() }),
      ]);

      if (!profileRes.ok) throw new Error("Could not load profile.");
      if (!historyRes.ok) throw new Error("Could not load tournament history.");

      const profileData = await profileRes.json();
      const historyData = await historyRes.json();

      setProfile(profileData.player);
      setForm({
        username: profileData.player.username || "",
        role: profileData.player.role || "",
        lookingForTeam: profileData.player.lookingForTeam,
      });
      setHistory(historyData.history || []);
      loadMatches(profileData.player.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function loadMatches(playerId) {
    setMatchesLoading(true);
    fetch(`${API_BASE}/${playerId}/matches`)
      .then((res) => (res.ok ? res.json() : { matches: [] }))
      .then((data) => setMatches(data.matches || []))
      .catch(() => setMatches([]))
      .finally(() => setMatchesLoading(false));
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not update profile.");
      setProfile(data.player);
      // Keep the cached user (used for the "username · email" line at the
      // top, and anywhere else in the app that reads localStorage) in sync
      // with the new username right away, instead of waiting on a refresh.
      const cachedUser = JSON.parse(localStorage.getItem("cc_user") || "null");
      if (cachedUser) {
        localStorage.setItem("cc_user", JSON.stringify({ ...cachedUser, username: data.player.username }));
      }
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRefreshRank() {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/me/refresh-rank`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not refresh rank.");
      setProfile(data.player);
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleInviteResponse(slug, accept) {
    setRespondingSlug(slug);
    setError("");
    try {
      const res = await fetch(`${TOURNAMENTS_API_BASE}/${slug}/register/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ accept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not respond to invite.");
      loadProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setRespondingSlug(null);
    }
  }

  // ---------- LOGGED-OUT VIEW ----------
  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: TOKENS.ink,
          color: TOKENS.off,
          fontFamily: "'Inter', sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
          textAlign: "center",
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&display=swap');
          .pf-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        `}</style>
        <h1 className="pf-h" style={{ fontSize: 32, marginBottom: 12 }}>
          Log in to view your profile
        </h1>
        <p style={{ color: TOKENS.mute, fontSize: 15, marginBottom: 28, maxWidth: 380 }}>
          You need an account to see your rank, role, and tournament history.
        </p>
        <button
          onClick={onRequireAuth}
          style={{
            padding: "13px 28px",
            fontSize: 14,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            border: `1px solid ${TOKENS.signal}`,
            background: TOKENS.signal,
            color: "#0B0D0F",
            cursor: "pointer",
          }}
        >
          Log In / Sign Up
        </button>
      </div>
    );
  }

  // ---------- LOGGED-IN VIEW ----------
  return (
    <div
      style={{
        minHeight: "100vh",
        background: TOKENS.ink,
        color: TOKENS.off,
        fontFamily: "'Inter', sans-serif",
        padding: "60px 32px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .pf-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .pf-mono { font-family:'JetBrains Mono', monospace; }
        .pf-back { cursor:pointer; transition: color .15s; }
        .pf-back:hover { color: ${TOKENS.cyan}; }
        .pf-select, .pf-input { appearance:none; }
        .pf-card { transition: border-color .15s; }
        .pf-card:hover { border-color:${TOKENS.cyan}; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div
          className="pf-mono pf-back"
          onClick={() => navigate("/")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to home
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 8,
          }}
        >
          <h1 className="pf-h" style={{ fontSize: 36 }}>
            My Profile
          </h1>
          <button
            onClick={onLogout}
            style={{
              padding: "9px 18px",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              border: `1px solid ${TOKENS.steel}`,
              background: "transparent",
              color: TOKENS.mute,
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Log Out
          </button>
        </div>

        <p style={{ color: TOKENS.mute, fontSize: 15, marginBottom: 34 }}>
          {profile ? profile.username : user.username} · {user.email}
        </p>

        {loading && <p style={{ color: TOKENS.mute }}>Loading profile…</p>}

        {error && (
          <div
            style={{
              background: "rgba(217, 58, 103, 0.12)",
              border: `1px solid ${TOKENS.signal}`,
              color: TOKENS.signal,
              fontSize: 14,
              padding: "12px 16px",
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {!loading && profile && (
          <>
            <div
              className="pf-card"
              style={{
                background: TOKENS.panel,
                border: `1px solid ${TOKENS.steel}`,
                padding: 24,
                marginBottom: 32,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 className="pf-h" style={{ fontSize: 18 }}>Player Info</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleRefreshRank} disabled={refreshing} style={editButtonStyle}>
                    {refreshing ? "Refreshing…" : "Refresh Rank"}
                  </button>
                  {!editing && (
                    <button onClick={() => setEditing(true)} style={editButtonStyle}>
                      Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Rank and region come from the player's Riot ID (fetched via
                  the Riot lookup service) and can't be edited by hand — use
                  "Refresh Rank" to re-pull the latest value. */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: editing ? 20 : 0 }}>
                <Field label="USERNAME" value={profile.username} />
                <Field label="RIOT ID" value={profile.riotName ? `${profile.riotName}#${profile.riotTag}` : "Not set"} />
                <Field label="RANK" value={profile.rank || "Unranked"} accent />
                <Field label="REGION" value={profile.region || "Not set"} />
              </div>

              {!editing ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginTop: 16 }}>
                  <Field label="ROLE" value={profile.role || "Not set"} />
                  <Field label="LOOKING FOR TEAM" value={profile.lookingForTeam ? "Yes" : "No"} />
                </div>
              ) : (
                <form onSubmit={handleSave}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 20 }}>
                    <div>
                      <label className="pf-mono" style={labelStyle}>USERNAME</label>
                      <input
                        type="text"
                        name="username"
                        value={form.username}
                        onChange={handleChange}
                        minLength={3}
                        maxLength={24}
                        required
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="pf-mono" style={labelStyle}>ROLE</label>
                      <select className="pf-select" name="role" value={form.role} onChange={handleChange} style={inputStyle}>
                        <option value="">Not set</option>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                      <input
                        type="checkbox"
                        id="lookingForTeam"
                        name="lookingForTeam"
                        checked={form.lookingForTeam}
                        onChange={handleChange}
                        style={{ width: 16, height: 16 }}
                      />
                      <label htmlFor="lookingForTeam" className="pf-mono" style={{ fontSize: 12, color: TOKENS.mute }}>
                        LOOKING FOR TEAM
                      </label>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12 }}>
                    <button type="submit" disabled={saving} style={saveButtonStyle}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button type="button" onClick={() => setEditing(false)} style={cancelButtonStyle}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {history.some((h) => h.registration.status === "pending") && (
              <>
                <h2 className="pf-h" style={{ fontSize: 18, marginBottom: 16 }}>
                  Pending Invites
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
                  {history
                    .filter((h) => h.registration.status === "pending")
                    .map((h) => (
                      <div
                        key={h.registration.id}
                        className="pf-card"
                        style={{
                          background: TOKENS.panel,
                          border: `1px solid ${TOKENS.signal}`,
                          padding: 18,
                        }}
                      >
                        <div className="pf-h" style={{ fontSize: 16, marginBottom: 4 }}>
                          {h.tournament.title}
                        </div>
                        <div className="pf-mono" style={{ fontSize: 12, color: TOKENS.mute, marginBottom: 14 }}>
                          Invited to team "{h.registration.teamName}"
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <button
                            onClick={() => handleInviteResponse(h.tournament.id, true)}
                            disabled={respondingSlug === h.tournament.id}
                            style={saveButtonStyle}
                          >
                            {respondingSlug === h.tournament.id ? "Please wait…" : "Accept"}
                          </button>
                          <button
                            onClick={() => handleInviteResponse(h.tournament.id, false)}
                            disabled={respondingSlug === h.tournament.id}
                            style={cancelButtonStyle}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}

            <h2 className="pf-h" style={{ fontSize: 18, marginBottom: 16 }}>
              Tournament History
            </h2>

            {history.filter((h) => h.registration.status !== "pending").length === 0 && (
              <p style={{ color: TOKENS.mute, fontSize: 14 }}>
                You haven't joined any tournaments yet.
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {history
                .filter((h) => h.registration.status !== "pending")
                .map((h) => (
                  <div
                    key={h.registration.id}
                    className="pf-card"
                    style={{
                      background: TOKENS.panel,
                      border: `1px solid ${TOKENS.steel}`,
                      padding: 18,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        className="pf-h"
                        style={{ fontSize: 16, cursor: "pointer" }}
                        onClick={() => navigate(`/tournaments/${h.tournament.id}`)}
                      >
                        {h.tournament.title}
                      </div>
                      <div className="pf-mono" style={{ fontSize: 12, color: TOKENS.mute, marginTop: 4 }}>
                        {h.registration.type === "team" ? h.registration.teamName || "Team entry" : "Solo entry"}
                        {" · "}
                        {new Date(h.tournament.startDate).toLocaleDateString()}
                      </div>
                    </div>
                    <span
                      className="pf-mono"
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        color:
                          h.tournament.status === "live"
                            ? TOKENS.signal
                            : h.tournament.status === "upcoming"
                            ? TOKENS.cyan
                            : TOKENS.mute,
                        border: `1px solid ${TOKENS.steel}`,
                        padding: "4px 10px",
                      }}
                    >
                      {h.tournament.status}
                    </span>
                  </div>
                ))}
            </div>

            <h2 className="pf-h" style={{ fontSize: 18, margin: "32px 0 16px" }}>
              Match History
            </h2>

            {matchesLoading && <p style={{ color: TOKENS.mute, fontSize: 14 }}>Loading match history…</p>}

            {!matchesLoading && matches.length === 0 && (
              <p style={{ color: TOKENS.mute, fontSize: 14 }}>
                No recent competitive matches found.
              </p>
            )}

            {!matchesLoading && matches.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {matches.map((m) => (
                  <div
                    key={m.matchId}
                    className="pf-card"
                    style={{
                      background: TOKENS.panel,
                      border: `1px solid ${TOKENS.steel}`,
                      padding: "14px 18px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 200 }}>
                      <span
                        className="pf-mono"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: m.result === "W" ? TOKENS.cyan : m.result === "L" ? TOKENS.signal : TOKENS.mute,
                          width: 18,
                        }}
                      >
                        {m.result || "—"}
                      </span>
                      <div>
                        <div style={{ fontSize: 14 }}>{m.map}</div>
                        <div className="pf-mono" style={{ fontSize: 11, color: TOKENS.mute }}>
                          {m.agent}
                        </div>
                      </div>
                    </div>

                    <div className="pf-mono" style={{ fontSize: 13, color: TOKENS.off, minWidth: 90, textAlign: "center" }}>
                      {m.kills}/{m.deaths}/{m.assists}
                    </div>

                    <div className="pf-mono" style={{ fontSize: 12, color: TOKENS.cyan, minWidth: 100, textAlign: "right" }}>
                      {m.rankAtTime || "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, accent }) {
  return (
    <div>
      <div className="pf-mono" style={{ fontSize: 11, color: TOKENS.mute, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, color: accent ? TOKENS.cyan : TOKENS.off }}>{value}</div>
    </div>
  );
}

const labelStyle = { fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em", display: "block", marginBottom: 8 };

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  background: TOKENS.panel2,
  border: `1px solid ${TOKENS.steel}`,
  color: TOKENS.off,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
};

const editButtonStyle = {
  background: "transparent",
  border: `1px solid ${TOKENS.steel}`,
  color: TOKENS.cyan,
  fontSize: 12,
  padding: "8px 16px",
  cursor: "pointer",
  textTransform: "uppercase",
  fontFamily: "'JetBrains Mono', monospace",
};

const saveButtonStyle = {
  padding: "10px 20px",
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
  border: `1px solid ${TOKENS.signal}`,
  background: TOKENS.signal,
  color: "#0B0D0F",
  cursor: "pointer",
};

const cancelButtonStyle = {
  padding: "10px 20px",
  fontSize: 13,
  textTransform: "uppercase",
  border: `1px solid ${TOKENS.steel}`,
  background: "transparent",
  color: TOKENS.mute,
  cursor: "pointer",
};