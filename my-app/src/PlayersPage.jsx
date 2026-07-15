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

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];
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

export default function PlayersPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rankFilter, setRankFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankFilter, roleFilter]);

  async function fetchPlayers() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (rankFilter) params.set("rank", rankFilter);
      if (roleFilter) params.set("role", roleFilter);

      const res = await fetch(`${API_BASE}?${params.toString()}`);
      if (!res.ok) throw new Error("Could not load players.");
      const data = await res.json();
      setPlayers(data.players || []);
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
        padding: "60px 32px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .pp-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .pp-mono { font-family:'JetBrains Mono', monospace; }
        .pp-select { appearance:none; cursor:pointer; }
        .pp-back { cursor:pointer; transition: color .15s; }
        .pp-back:hover { color: ${TOKENS.cyan}; }
        .pp-card { transition: border-color .15s, transform .15s; }
        .pp-card:hover { border-color:${TOKENS.cyan}; transform:translateY(-2px); }
      `}</style>

      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div
          className="pp-mono pp-back"
          onClick={() => navigate("/")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to home
        </div>

        <h1 className="pp-h" style={{ fontSize: 36, marginBottom: 8 }}>
          Find Players
        </h1>
        <p style={{ color: TOKENS.mute, fontSize: 15, marginBottom: 34, maxWidth: 520 }}>
          Browse the community by rank and role to find teammates who match your level.
        </p>

        {/* Filters */}
        <div style={{ display: "flex", gap: 16, marginBottom: 34, flexWrap: "wrap" }}>
          <div>
            <label className="pp-mono" style={{ fontSize: 11, color: TOKENS.mute, display: "block", marginBottom: 6 }}>
              RANK
            </label>
            <select
              className="pp-select"
              value={rankFilter}
              onChange={(e) => setRankFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">All ranks</option>
              {RANKS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="pp-mono" style={{ fontSize: 11, color: TOKENS.mute, display: "block", marginBottom: 6 }}>
              ROLE
            </label>
            <select
              className="pp-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {(rankFilter || roleFilter) && (
            <button
              onClick={() => {
                setRankFilter("");
                setRoleFilter("");
              }}
              className="pp-mono"
              style={{
                alignSelf: "flex-end",
                background: "transparent",
                border: `1px solid ${TOKENS.steel}`,
                color: TOKENS.mute,
                fontSize: 12,
                padding: "10px 16px",
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Results */}
        {loading && <p style={{ color: TOKENS.mute }}>Loading players…</p>}
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
        {!loading && !error && players.length === 0 && (
          <p style={{ color: TOKENS.mute }}>No players match these filters yet.</p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {players.map((p) => (
            <div
              key={p.id}
              className="pp-card"
              style={{
                background: TOKENS.panel,
                border: `1px solid ${TOKENS.steel}`,
                padding: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <h3 className="pp-h" style={{ fontSize: 18 }}>{p.username}</h3>
                {p.lookingForTeam && (
                  <span
                    className="pp-mono"
                    style={{
                      fontSize: 10,
                      color: TOKENS.cyan,
                      background: "rgba(62, 214, 197, 0.12)",
                      padding: "3px 8px",
                      textTransform: "uppercase",
                    }}
                  >
                    LFT
                  </span>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span className="pp-mono" style={{ color: TOKENS.mute }}>
                  {p.role || "No role set"}
                </span>
                <span className="pp-mono" style={{ color: TOKENS.cyan }}>
                  {p.rank || "Unranked"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const selectStyle = {
  padding: "10px 14px",
  background: TOKENS.panel2,
  border: `1px solid ${TOKENS.steel}`,
  color: TOKENS.off,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  minWidth: 160,
};