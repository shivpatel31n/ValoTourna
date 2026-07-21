import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const TOKENS = {
  ink: "#0B0D0F",
  panel: "#14171A",
  steel: "#2A2E33",
  signal: "#D93A67",
  cyan: "#3ED6C5",
  off: "#E9EAEA",
  mute: "#8B9096",
};

const API_BASE = "http://localhost:5000/api/notifications";
const POLL_INTERVAL_MS = 30000;

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function NotificationBell({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [summary, setSummary] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setSummary(null);
      return;
    }

    let cancelled = false;
    function poll() {
      fetch(`${API_BASE}/summary`, { headers: authHeaders() })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data) setSummary(data);
        })
        .catch(() => {});
    }

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [user]);

  // Close the dropdown whenever the user navigates somewhere
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const count = summary?.count || 0;

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, fontFamily: "'JetBrains Mono', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        .nb-item { transition: color .15s; }
        .nb-item:hover { color: ${TOKENS.cyan} !important; }
        .nb-bell {
          display:flex; align-items:center; gap:8px;
          padding: 12px 18px;
          font-size: 12px; font-weight:600; letter-spacing:0.08em; text-transform:uppercase;
          border: 1px solid ${count > 0 ? TOKENS.signal : TOKENS.steel};
          background: ${TOKENS.panel};
          color: ${count > 0 ? TOKENS.signal : TOKENS.off};
          clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
          cursor: pointer;
          transition: all .15s;
        }
        .nb-bell:hover { border-color: ${TOKENS.cyan}; color: ${TOKENS.cyan}; }
      `}</style>

      {open && (
        <div
          style={{
            position: "absolute",
            bottom: 56,
            right: 0,
            width: 260,
            background: TOKENS.panel,
            border: `1px solid ${TOKENS.steel}`,
            padding: 18,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          {count === 0 ? (
            <p style={{ fontSize: 12, color: TOKENS.mute, margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              No pending requests.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {summary.teamJoinRequests > 0 && (
                <button
                  className="nb-item"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/teams/${summary.teamId}`);
                  }}
                  style={itemStyle}
                >
                  {summary.teamJoinRequests} pending join request{summary.teamJoinRequests > 1 ? "s" : ""} →
                </button>
              )}
              {summary.scrimRequests > 0 && (
                <button
                  className="nb-item"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/scrims/${summary.openScrimId}`);
                  }}
                  style={itemStyle}
                >
                  {summary.scrimRequests} pending scrim request{summary.scrimRequests > 1 ? "s" : ""} →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <button
        className="nb-bell"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
      >
        Alerts
        {count > 0 && <span>[{count}]</span>}
      </button>
    </div>
  );
}

const itemStyle = {
  background: "transparent",
  border: "none",
  color: TOKENS.off,
  fontSize: 12,
  textAlign: "left",
  cursor: "pointer",
  padding: 0,
};