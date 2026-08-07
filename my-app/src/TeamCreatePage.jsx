import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
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

const API_BASE = "http://localhost:5000/api/teams";
const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];
const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function TeamCreatePage({ user, onRequireAuth }) {
  usePageTitle("Create Team");
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    tag: "",
    region: "",
    rolesNeeded: [],
    schedule: "",
    description: "",
    maxSize: 5,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    onRequireAuth?.();
    return null;
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function toggleRole(role) {
    setForm((f) => ({
      ...f,
      rolesNeeded: f.rolesNeeded.includes(role)
        ? f.rolesNeeded.filter((r) => r !== role)
        : [...f.rolesNeeded, role],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Give your team a name.");
    if (!form.region) return setError("Pick a region.");

    setSaving(true);
    setError("");
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not create team.");
      navigate(`/teams/${data.team.id}`);
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
  const labelStyle = {
    fontSize: 11,
    color: TOKENS.mute,
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: 8,
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
        .tc-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .tc-mono { font-family:'JetBrains Mono', monospace; }
        .tc-back { cursor:pointer; transition: color .15s; }
        .tc-back:hover { color: ${TOKENS.cyan}; }
        .tc-chip { cursor:pointer; transition: all .15s; user-select:none; }
      `}</style>

      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div
          className="tc-mono tc-back"
          onClick={() => navigate("/teams")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to teams
        </div>

        <h1 className="tc-h" style={{ fontSize: 32, marginBottom: 8 }}>Start a team</h1>
        <p style={{ color: TOKENS.mute, fontSize: 14, marginBottom: 34 }}>
          You'll be the captain. You can edit these details, review join requests, and manage the roster later.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 3 }}>
              <label className="tc-mono" style={labelStyle}>TEAM NAME</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Clutch Circuit"
                style={inputStyle}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="tc-mono" style={labelStyle}>TAG</label>
              <input
                name="tag"
                value={form.tag}
                onChange={handleChange}
                placeholder="CC"
                maxLength={5}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label className="tc-mono" style={labelStyle}>REGION</label>
              <select name="region" value={form.region} onChange={handleChange} style={inputStyle} required>
                <option value="" disabled>Select region</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="tc-mono" style={labelStyle}>MAX ROSTER SIZE</label>
              <input
                type="number"
                name="maxSize"
                value={form.maxSize}
                onChange={handleChange}
                min={1}
                max={10}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="tc-mono" style={labelStyle}>ROLES YOU STILL NEED (optional)</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ROLES.map((r) => {
                const active = form.rolesNeeded.includes(r);
                return (
                  <span
                    key={r}
                    className="tc-mono tc-chip"
                    onClick={() => toggleRole(r)}
                    style={{
                      fontSize: 12,
                      padding: "6px 12px",
                      border: `1px solid ${active ? TOKENS.cyan : TOKENS.steel}`,
                      color: active ? TOKENS.cyan : TOKENS.mute,
                      background: active ? "rgba(62, 214, 197, 0.08)" : "transparent",
                    }}
                  >
                    {r}
                  </span>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label className="tc-mono" style={labelStyle}>PLAY SCHEDULE</label>
            <input
              name="schedule"
              value={form.schedule}
              onChange={handleChange}
              placeholder="e.g. Weeknights 8-11pm EST, scrims Sat afternoon"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label className="tc-mono" style={labelStyle}>DESCRIPTION (optional)</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="What are you looking for in teammates? What's the vibe?"
              rows={4}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          {error && (
            <p className="tc-mono" style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 16 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="tc-mono"
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
            {saving ? "Creating…" : "Create team"}
          </button>
        </form>
      </div>
    </div>
  );
}