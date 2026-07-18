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

const API_BASE = "http://localhost:5000/api/teams";
const DISCORD_URL = "https://discord.gg/7RCDt277Y";

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];
const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function TeamsPage({ user, onRequireAuth }) {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [recruitingOnly, setRecruitingOnly] = useState(false);

  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionFilter, roleFilter, recruitingOnly]);

  useEffect(() => {
    if (!user) {
      setMyTeam(null);
      return;
    }
    fetch(`${API_BASE}/mine`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setMyTeam(data.team || null))
      .catch(() => {});
  }, [user]);

  async function fetchTeams() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (regionFilter) params.set("region", regionFilter);
      if (roleFilter) params.set("role", roleFilter);
      if (recruitingOnly) params.set("recruiting", "true");

      const res = await fetch(`${API_BASE}?${params.toString()}`);
      if (!res.ok) throw new Error("Could not load teams.");
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCreateClick() {
    if (!user) {
      onRequireAuth?.();
      return;
    }
    navigate("/teams/new");
  }

  const selectStyle = {
    background: TOKENS.panel,
    border: `1px solid ${TOKENS.steel}`,
    color: TOKENS.off,
    padding: "9px 12px",
    fontSize: 13,
    minWidth: 160,
  };

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
        .tp-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .tp-mono { font-family:'JetBrains Mono', monospace; }
        .tp-select { appearance:none; cursor:pointer; }
        .tp-back { cursor:pointer; transition: color .15s; }
        .tp-back:hover { color: ${TOKENS.cyan}; }
        .tp-card { transition: border-color .15s, transform .15s; cursor: pointer; }
        .tp-card:hover { border-color:${TOKENS.cyan}; transform:translateY(-2px); }
        .tp-btn { cursor:pointer; transition: opacity .15s; border:none; }
        .tp-btn:hover { opacity: 0.85; }
      `}</style>

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          className="tp-mono tp-back"
          onClick={() => navigate("/")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to home
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
          <h1 className="tp-h" style={{ fontSize: 36 }}>Teams</h1>
          {myTeam ? (
            <button className="tp-btn tp-mono" onClick={() => navigate(`/teams/${myTeam.id}`)} style={primaryBtnStyle}>
              View my team →
            </button>
          ) : (
            <button className="tp-btn tp-mono" onClick={handleCreateClick} style={primaryBtnStyle}>
              + Create a team
            </button>
          )}
        </div>

        <p style={{ color: TOKENS.mute, fontSize: 15, marginBottom: 20, maxWidth: 560 }}>
          Rosters that stick together across tournaments. Browse open teams, see who they still need, and send a request to join.
        </p>

        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noreferrer"
          className="tp-mono"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            background: "rgba(62, 214, 197, 0.08)",
            border: `1px solid ${TOKENS.cyan}`,
            color: TOKENS.off,
            padding: "14px 20px",
            marginBottom: 34,
            textDecoration: "none",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>
            Found a team you like? Send a join request here, then{" "}
            <strong style={{ color: TOKENS.cyan }}>join our Discord</strong> to actually coordinate
            scrims and practice with them.
          </span>
          <span
            style={{
              flexShrink: 0,
              background: TOKENS.cyan,
              color: TOKENS.ink,
              padding: "8px 16px",
              fontSize: 12,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            Join Discord →
          </span>
        </a>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 30, alignItems: "flex-end" }}>
          <div>
            <label className="tp-mono" style={{ fontSize: 11, color: TOKENS.mute, display: "block", marginBottom: 6 }}>
              REGION
            </label>
            <select className="tp-select" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={selectStyle}>
              <option value="">All regions</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="tp-mono" style={{ fontSize: 11, color: TOKENS.mute, display: "block", marginBottom: 6 }}>
              ROLE NEEDED
            </label>
            <select className="tp-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle}>
              <option value="">Any role</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={recruitingOnly} onChange={(e) => setRecruitingOnly(e.target.checked)} style={{ width: 16, height: 16 }} />
            <span className="tp-mono" style={{ fontSize: 12, color: TOKENS.mute }}>RECRUITING ONLY</span>
          </label>
          {(regionFilter || roleFilter || recruitingOnly) && (
            <button
              onClick={() => { setRegionFilter(""); setRoleFilter(""); setRecruitingOnly(false); }}
              className="tp-mono tp-back"
              style={{ background: "none", border: "none", color: TOKENS.signal, fontSize: 12, cursor: "pointer" }}
            >
              Clear filters
            </button>
          )}
        </div>

        {loading && <p className="tp-mono" style={{ color: TOKENS.mute }}>Loading teams…</p>}
        {error && <p className="tp-mono" style={{ color: TOKENS.signal }}>{error}</p>}
        {!loading && !error && teams.length === 0 && (
          <p className="tp-mono" style={{ color: TOKENS.mute }}>No teams match those filters yet.</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {teams.map((t) => (
            <div
              key={t.id}
              className="tp-card"
              onClick={() => navigate(`/teams/${t.id}`)}
              style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 20 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <h3 className="tp-h" style={{ fontSize: 18 }}>
                  {t.name} {t.tag && <span style={{ color: TOKENS.mute, fontSize: 13 }}>[{t.tag}]</span>}
                </h3>
                {t.recruiting && (
                  <span
                    className="tp-mono"
                    style={{ fontSize: 10, color: TOKENS.cyan, background: "rgba(62, 214, 197, 0.12)", padding: "3px 8px", textTransform: "uppercase" }}
                  >
                    Recruiting
                  </span>
                )}
              </div>

              <div className="tp-mono" style={{ fontSize: 12, color: TOKENS.mute, marginBottom: 10 }}>
                Captain: {t.captain?.username || "Unknown"}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 10 }}>
                <span className="tp-mono" style={{ color: TOKENS.mute }}>{t.region}</span>
                <span className="tp-mono" style={{ color: TOKENS.off }}>
                  {(t.members?.length || 0) + 1}/{t.maxSize} players
                </span>
              </div>

              {t.rolesNeeded?.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {t.rolesNeeded.map((r) => (
                    <span key={r} className="tp-mono" style={{ fontSize: 11, color: TOKENS.signal, border: `1px solid ${TOKENS.signal}`, padding: "2px 7px" }}>
                      Needs {r}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const primaryBtnStyle = {
  background: TOKENS.cyan,
  color: TOKENS.ink,
  padding: "10px 18px",
  fontSize: 13,
  fontWeight: 600,
  textTransform: "uppercase",
};