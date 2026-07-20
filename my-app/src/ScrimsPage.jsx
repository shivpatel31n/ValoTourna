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

const API_BASE = "http://localhost:5000/api/scrims";
const TEAMS_API_BASE = "http://localhost:5000/api/teams";
const DISCORD_URL = "https://discord.gg/7RCDt277Y";

const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];
const RANKS = [
  "Iron 1", "Iron 2", "Iron 3",
  "Bronze 1", "Bronze 2", "Bronze 3",
  "Silver 1", "Silver 2", "Silver 3",
  "Gold 1", "Gold 2", "Gold 3",
  "Platinum 1", "Platinum 2", "Platinum 3",
  "Diamond 1", "Diamond 2", "Diamond 3",
  "Ascendant 1", "Ascendant 2", "Ascendant 3",
  "Immortal 1", "Immortal 2", "Immortal 3",
  "Radiant",
];

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ScrimsPage({ user, onRequireAuth }) {
  const navigate = useNavigate();
  const [scrims, setScrims] = useState([]);
  const [myTeam, setMyTeam] = useState(null);
  const [myOpenScrim, setMyOpenScrim] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [rankFilter, setRankFilter] = useState("");

  useEffect(() => {
    fetchScrims();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionFilter, rankFilter]);

  useEffect(() => {
    if (!user) {
      setMyTeam(null);
      setMyOpenScrim(null);
      return;
    }
    fetch(`${TEAMS_API_BASE}/mine`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setMyTeam(data.team || null))
      .catch(() => {});
    fetch(`${API_BASE}/mine`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => setMyOpenScrim((data.scrims || []).find((s) => s.status === "open") || null))
      .catch(() => {});
  }, [user]);

  async function fetchScrims() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (regionFilter) params.set("region", regionFilter);
      if (rankFilter) params.set("rank", rankFilter);

      const res = await fetch(`${API_BASE}?${params.toString()}`);
      if (!res.ok) throw new Error("Could not load scrims.");
      const data = await res.json();
      setScrims(data.scrims || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handlePostClick() {
    if (!user) return onRequireAuth?.();
    navigate("/scrims/new");
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
        .sp-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .sp-mono { font-family:'JetBrains Mono', monospace; }
        .sp-select { appearance:none; cursor:pointer; }
        .sp-back { cursor:pointer; transition: color .15s; }
        .sp-back:hover { color: ${TOKENS.cyan}; }
        .sp-card { transition: border-color .15s, transform .15s; cursor: pointer; }
        .sp-card:hover { border-color:${TOKENS.cyan}; transform:translateY(-2px); }
        .sp-btn { cursor:pointer; transition: opacity .15s; border:none; }
        .sp-btn:hover { opacity: 0.85; }
      `}</style>

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          className="sp-mono sp-back"
          onClick={() => navigate("/")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to home
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
          <h1 className="sp-h" style={{ fontSize: 36 }}>Scrim Finder</h1>
          {myOpenScrim ? (
            <button className="sp-btn sp-mono" onClick={() => navigate(`/scrims/${myOpenScrim.id}`)} style={primaryBtnStyle}>
              View my scrim post →
            </button>
          ) : (
            <button className="sp-btn sp-mono" onClick={handlePostClick} style={primaryBtnStyle}>
              + Post a scrim
            </button>
          )}
        </div>

        <p style={{ color: TOKENS.mute, fontSize: 15, marginBottom: 20, maxWidth: 560 }}>
          Post your team's rank range and availability, or browse other teams looking for a practice match.
        </p>

        {user && !myTeam && (
          <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 16, marginBottom: 20 }}>
            <p className="sp-mono" style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 10 }}>
              You need to be on a team to post or request a scrim.
            </p>
            <button className="sp-btn sp-mono" onClick={() => navigate("/teams/new")} style={secondaryBtnStyle}>
              Start a team
            </button>
          </div>
        )}

        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noreferrer"
          className="sp-mono"
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
            Matched with a team? <strong style={{ color: TOKENS.cyan }}>Join our Discord</strong> to
            actually schedule and play the scrim.
          </span>
          <span style={{ flexShrink: 0, background: TOKENS.cyan, color: TOKENS.ink, padding: "8px 16px", fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
            Join Discord →
          </span>
        </a>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 30, alignItems: "flex-end" }}>
          <div>
            <label className="sp-mono" style={{ fontSize: 11, color: TOKENS.mute, display: "block", marginBottom: 6 }}>
              REGION
            </label>
            <select className="sp-select" value={regionFilter} onChange={(e) => setRegionFilter(e.target.value)} style={selectStyle}>
              <option value="">All regions</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="sp-mono" style={{ fontSize: 11, color: TOKENS.mute, display: "block", marginBottom: 6 }}>
              YOUR RANK
            </label>
            <select className="sp-select" value={rankFilter} onChange={(e) => setRankFilter(e.target.value)} style={selectStyle}>
              <option value="">Any rank</option>
              {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {(regionFilter || rankFilter) && (
            <button
              onClick={() => { setRegionFilter(""); setRankFilter(""); }}
              className="sp-mono sp-back"
              style={{ background: "none", border: "none", color: TOKENS.signal, fontSize: 12, cursor: "pointer" }}
            >
              Clear filters
            </button>
          )}
        </div>

        {loading && <p className="sp-mono" style={{ color: TOKENS.mute }}>Loading scrims…</p>}
        {error && <p className="sp-mono" style={{ color: TOKENS.signal }}>{error}</p>}
        {!loading && !error && scrims.length === 0 && (
          <p className="sp-mono" style={{ color: TOKENS.mute }}>No open scrim posts match those filters yet.</p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {scrims.map((s) => (
            <div
              key={s.id}
              className="sp-card"
              onClick={() => navigate(`/scrims/${s.id}`)}
              style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 20 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <h3 className="sp-h" style={{ fontSize: 18 }}>
                  {s.team?.name} {s.team?.tag && <span style={{ color: TOKENS.mute, fontSize: 13 }}>[{s.team.tag}]</span>}
                </h3>
                <span className="sp-mono" style={{ fontSize: 12, color: TOKENS.cyan }}>{s.region}</span>
              </div>

              <div className="sp-mono" style={{ fontSize: 13, color: TOKENS.off, marginBottom: 10 }}>
                {s.minRank}{s.minRank !== s.maxRank ? ` – ${s.maxRank}` : ""}
              </div>

              <p style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 10 }}>{s.availability}</p>

              {s.notes && (
                <p style={{ fontSize: 12, color: TOKENS.mute, fontStyle: "italic" }}>"{s.notes}"</p>
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
const secondaryBtnStyle = {
  background: "transparent",
  color: TOKENS.off,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  border: `1px solid ${TOKENS.steel}`,
};