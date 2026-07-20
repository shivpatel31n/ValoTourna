import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const TOKENS = {
  ink: "#0B0D0F",
  panel: "#14171A",
  steel: "#2A2E33",
  signal: "#D93A67",
  cyan: "#3ED6C5",
  off: "#E9EAEA",
  mute: "#8B9096",
};

const SCRIMS_API_BASE = "http://localhost:5000/api/scrims";
const TEAMS_API_BASE = "http://localhost:5000/api/teams";
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

export default function ScrimPostPage({ user, onRequireAuth }) {
  const navigate = useNavigate();
  const [myTeam, setMyTeam] = useState(undefined); // undefined = loading, null = no team
  const [form, setForm] = useState({
    region: "",
    minRank: "",
    maxRank: "",
    availability: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    fetch(`${TEAMS_API_BASE}/mine`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        const team = data.team || null;
        setMyTeam(team);
        if (team) setForm((f) => ({ ...f, region: team.region }));
      })
      .catch(() => setMyTeam(null));
  }, [user]);

  if (!user) {
    onRequireAuth?.();
    return null;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.region) return setError("Pick a region.");
    if (!form.minRank || !form.maxRank) return setError("Set a rank range.");
    if (RANKS.indexOf(form.minRank) > RANKS.indexOf(form.maxRank)) {
      return setError("Minimum rank can't be higher than maximum rank.");
    }
    if (!form.availability.trim()) return setError("Let other teams know when you're free.");

    setSaving(true);
    setError("");
    try {
      const res = await fetch(SCRIMS_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not post scrim.");
      navigate(`/scrims/${data.scrim.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: "100%",
    background: TOKENS.panel,
    border: `1px solid ${TOKENS.steel}`,
    color: TOKENS.off,
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em", display: "block", marginBottom: 8 };

  return (
    <div style={{ minHeight: "100vh", background: TOKENS.ink, color: TOKENS.off, fontFamily: "'Inter', sans-serif", padding: "60px 32px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .sc-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .sc-mono { font-family:'JetBrains Mono', monospace; }
        .sc-back { cursor:pointer; transition: color .15s; }
        .sc-back:hover { color: ${TOKENS.cyan}; }
      `}</style>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          className="sc-mono sc-back"
          onClick={() => navigate("/scrims")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to scrims
        </div>

        <h1 className="sc-h" style={{ fontSize: 32, marginBottom: 8 }}>Post a scrim</h1>

        {myTeam === undefined ? (
          <p className="sc-mono" style={{ color: TOKENS.mute, fontSize: 14 }}>Loading…</p>
        ) : myTeam === null ? (
          <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 20 }}>
            <p style={{ color: TOKENS.off, fontSize: 14, marginBottom: 16 }}>
              You need to be a team captain to post a scrim request. Create a team first.
            </p>
            <button
              className="sc-mono"
              onClick={() => navigate("/teams/new")}
              style={{ background: TOKENS.cyan, color: TOKENS.ink, padding: "10px 18px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", border: "none", cursor: "pointer" }}
            >
              Start a team
            </button>
          </div>
        ) : (
          <>
            <p style={{ color: TOKENS.mute, fontSize: 14, marginBottom: 34 }}>
              Posting on behalf of <strong style={{ color: TOKENS.off }}>{myTeam.name}</strong>. Other captains
              will be able to request a scrim against you.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label className="sc-mono" style={labelStyle}>REGION</label>
                  <select name="region" value={form.region} onChange={handleChange} style={inputStyle} required>
                    <option value="" disabled>Select region</option>
                    {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1 }}>
                  <label className="sc-mono" style={labelStyle}>MIN RANK</label>
                  <select name="minRank" value={form.minRank} onChange={handleChange} style={inputStyle} required>
                    <option value="" disabled>Select rank</option>
                    {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label className="sc-mono" style={labelStyle}>MAX RANK</label>
                  <select name="maxRank" value={form.maxRank} onChange={handleChange} style={inputStyle} required>
                    <option value="" disabled>Select rank</option>
                    {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="sc-mono" style={labelStyle}>AVAILABILITY</label>
                <input
                  name="availability"
                  value={form.availability}
                  onChange={handleChange}
                  placeholder="e.g. Tonight 8-10pm EST, or weeknights this week"
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ marginBottom: 28 }}>
                <label className="sc-mono" style={labelStyle}>NOTES (optional)</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Best of 1 or 3? Map preferences? Anything else teams should know."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </div>

              {error && <p className="sc-mono" style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 16 }}>{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="sc-mono"
                style={{
                  background: TOKENS.cyan,
                  color: TOKENS.ink,
                  padding: "12px 24px",
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  border: "none",
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? "Posting…" : "Post scrim"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}