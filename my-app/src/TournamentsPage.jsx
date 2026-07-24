import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import Reveal from "./components/Reveal";

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

function Badge({ status }) {
  const styles = {
    upcoming: { background: "rgba(62, 214, 197, 0.12)", color: TOKENS.cyan },
    live: { background: "rgba(217, 58, 103, 0.14)", color: TOKENS.signal },
    past: { background: "rgba(139, 144, 150, 0.12)", color: TOKENS.mute },
  };
  return (
    <span
      className="tp-mono"
      style={{
        fontSize: 11,
        letterSpacing: "0.05em",
        padding: "4px 10px",
        textTransform: "uppercase",
        ...styles[status],
      }}
    >
      {status}
    </span>
  );
}

export default function TournamentsPage() {
  const navigate = useNavigate();
  // TODO: swap for a real `fetch("/api/tournaments")` call once that
  // endpoint exists. Using local mock data for now so the join flow can be
  // built end to end.
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("http://localhost:5000/api/tournaments")
      .then((res) => res.json())
      .then((data) => setTournaments(data.tournaments || []))
      .catch(() => setError("Could not load tournaments. Is the backend running?"))
      .finally(() => setLoading(false));
  }, []);
  const [tab, setTab] = useState("upcoming"); // "upcoming" | "past"

  const upcoming = tournaments.filter((t) => t.status === "upcoming" || t.status === "live");
  const past = tournaments.filter((t) => t.status === "past");
  const shown = tab === "upcoming" ? upcoming : past;

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
        .tp-back { cursor:pointer; transition: color .15s; }
        .tp-back:hover { color: ${TOKENS.cyan}; }
        .tp-card { cursor:pointer; transition: border-color .15s, transform .15s; }
        .tp-card:hover { border-color:${TOKENS.cyan}; transform:translateY(-2px); }
        .tp-tab { cursor:pointer; transition: color .15s, border-color .15s; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          className="tp-mono tp-back"
          onClick={() => navigate("/")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to home
        </div>

        <h1 className="tp-h" style={{ fontSize: 36, marginBottom: 8 }}>
          Tournaments
        </h1>
        <p style={{ color: TOKENS.mute, fontSize: 15, marginBottom: 34, maxWidth: 520 }}>
          Register a team while spots and the deadline allow, or look back at how past cups played out.
        </p>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: 24,
            marginBottom: 30,
            borderBottom: `1px solid ${TOKENS.steel}`,
          }}
        >
          {[
            { key: "upcoming", label: `Upcoming (${upcoming.length})` },
            { key: "past", label: `Past (${past.length})` },
          ].map((t) => (
            <div
              key={t.key}
              className="tp-tab tp-mono"
              onClick={() => setTab(t.key)}
              style={{
                paddingBottom: 12,
                fontSize: 13,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: tab === t.key ? TOKENS.off : TOKENS.mute,
                borderBottom: `2px solid ${tab === t.key ? TOKENS.signal : "transparent"}`,
              }}
            >
              {t.label}
            </div>
          ))}
        </div>

        {loading && <p style={{ color: TOKENS.mute }}>Loading tournaments…</p>}
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
        {!loading && !error && shown.length === 0 && (
          <p style={{ color: TOKENS.mute }}>
            {tab === "upcoming" ? "No upcoming tournaments right now." : "No past tournaments yet."}
          </p>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          {shown.map((t) => (
            <Reveal
              key={t.id}
              as="div"
              className="tp-card"
              onClick={() => navigate(`/tournaments/${t.id}`)}
              style={{
                background: TOKENS.panel,
                border: `1px solid ${TOKENS.steel}`,
                padding: 24,
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <Badge status={t.status} />
              </div>
              <h3 className="tp-h" style={{ fontSize: 20, marginBottom: 6 }}>
                {t.title}
              </h3>
              <div style={{ color: TOKENS.mute, fontSize: 13, marginBottom: 18 }}>{t.format}</div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderTop: `1px solid ${TOKENS.panel2}`,
                  paddingTop: 14,
                  fontSize: 12,
                }}
              >
                <span className="tp-mono" style={{ color: TOKENS.mute }}>
                   {t.teamsCount}/{t.maxTeams} teams
                </span>
                <span className="tp-mono" style={{ color: TOKENS.cyan }}>
                  {t.status === "past"
                    ? `Ended ${new Date(t.endDate).toLocaleDateString()}`
                    : `Deadline ${new Date(t.regDeadline).toLocaleDateString()}`}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  );
}