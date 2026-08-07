import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import usePageTitle from "./hooks/usePageTitle";

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

export default function PlayerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [player, setPlayer] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [error, setError] = useState("");

  usePageTitle(player?.username);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Player not found." : "Could not load profile.");
        return res.json();
      })
      .then((data) => setPlayer(data.player))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setMatchesLoading(true);
    fetch(`${API_BASE}/${id}/matches`)
      .then((res) => (res.ok ? res.json() : { matches: [] }))
      .then((data) => setMatches(data.matches || []))
      .catch(() => setMatches([]))
      .finally(() => setMatchesLoading(false));
  }, [id]);

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
        .pvp-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .pvp-mono { font-family:'JetBrains Mono', monospace; }
        .pvp-back { cursor:pointer; transition: color .15s; }
        .pvp-back:hover { color: ${TOKENS.cyan}; }
        .pvp-row { transition: border-color .15s; }
        .pvp-row:hover { border-color: ${TOKENS.cyan}; }
      `}</style>

      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div
          className="pvp-mono pvp-back"
          onClick={() => navigate("/players")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to players
        </div>

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

        {!loading && player && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
              <h1 className="pvp-h" style={{ fontSize: 36 }}>{player.username}</h1>
              {player.lookingForTeam && (
                <span
                  className="pvp-mono"
                  style={{
                    fontSize: 11,
                    color: TOKENS.cyan,
                    background: "rgba(62, 214, 197, 0.12)",
                    padding: "5px 12px",
                    textTransform: "uppercase",
                  }}
                >
                  Looking for team
                </span>
              )}
            </div>

            {/* Note: email is intentionally not part of the public profile
                response at all — nothing to hide here client-side, the
                backend never sends it for this endpoint. */}
            <div
              style={{
                background: TOKENS.panel,
                border: `1px solid ${TOKENS.steel}`,
                padding: 24,
                marginBottom: 32,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 16,
              }}
            >
              <Field
                label="RIOT ID"
                value={player.riotName ? `${player.riotName}#${player.riotTag}` : "Not set"}
              />
              <Field label="RANK" value={player.rank || "Unranked"} accent />
              <Field label="REGION" value={player.region || "Not set"} />
              <Field label="ROLE" value={player.role || "Not set"} />
            </div>

            <h2 className="pvp-h" style={{ fontSize: 18, marginBottom: 16 }}>
              Recent Matches
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
                    className="pvp-row"
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
                        className="pvp-mono"
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
                        <div className="pvp-mono" style={{ fontSize: 11, color: TOKENS.mute }}>
                          {m.agent}
                        </div>
                      </div>
                    </div>

                    <div className="pvp-mono" style={{ fontSize: 13, color: TOKENS.off, minWidth: 90, textAlign: "center" }}>
                      {m.kills}/{m.deaths}/{m.assists}
                    </div>

                    <div className="pvp-mono" style={{ fontSize: 12, color: TOKENS.cyan, minWidth: 100, textAlign: "right" }}>
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
      <div className="pvp-mono" style={{ fontSize: 11, color: TOKENS.mute, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, color: accent ? TOKENS.cyan : TOKENS.off }}>{value}</div>
    </div>
  );
}