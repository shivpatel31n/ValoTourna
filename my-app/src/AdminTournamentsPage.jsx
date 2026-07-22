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

const API_BASE = "http://localhost:5000/api/tournaments";
const STATUSES = ["upcoming", "live", "past"];

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const emptyForm = {
  title: "",
  status: "upcoming",
  format: "",
  teamSize: 5,
  startDate: "",
  regDeadline: "",
  endDate: "",
  maxTeams: 16,
  prizePool: "",
  description: "",
  rules: "", // one per line in the textarea, split into an array on submit
  champion: "",
  runnerUp: "",
};

// Tournament dates come back as ISO strings; <input type="datetime-local">
// needs "YYYY-MM-DDTHH:mm" with no timezone suffix.
function toLocalInputValue(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminTournamentsPage({ user }) {
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingSlug, setEditingSlug] = useState(null); // null = not editing; "" = creating new
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    fetchTournaments();
  }, []);

  async function fetchTournaments() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(API_BASE);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not load tournaments.");
      setTournaments(data.tournaments || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return (
      <Shell>
        <p className="at-mono" style={{ color: TOKENS.mute }}>
          Log in to access this page.
        </p>
      </Shell>
    );
  }

  if (!user.isAdmin) {
    return (
      <Shell>
        <p className="at-mono" style={{ color: TOKENS.signal }}>
          Admins only.
        </p>
      </Shell>
    );
  }

  function startCreate() {
    setForm(emptyForm);
    setFormError("");
    setEditingSlug("");
  }

  function startEdit(t) {
    setForm({
      title: t.title || "",
      status: t.status || "upcoming",
      format: t.format || "",
      teamSize: t.teamSize || 5,
      startDate: toLocalInputValue(t.startDate),
      regDeadline: toLocalInputValue(t.regDeadline),
      endDate: toLocalInputValue(t.endDate),
      maxTeams: t.maxTeams || 16,
      prizePool: t.prizePool || "",
      description: t.description || "",
      rules: (t.rules || []).join("\n"),
      champion: t.champion || "",
      runnerUp: t.runnerUp || "",
    });
    setFormError("");
    setEditingSlug(t.id);
  }

  function cancelForm() {
    setEditingSlug(null);
    setForm(emptyForm);
    setFormError("");
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function buildPayload() {
    return {
      title: form.title.trim(),
      status: form.status,
      format: form.format.trim(),
      teamSize: Number(form.teamSize),
      startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
      regDeadline: form.regDeadline ? new Date(form.regDeadline).toISOString() : null,
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      maxTeams: Number(form.maxTeams),
      prizePool: form.prizePool.trim(),
      description: form.description.trim(),
      rules: form.rules.split("\n").map((r) => r.trim()).filter(Boolean),
      champion: form.champion.trim() || null,
      runnerUp: form.runnerUp.trim() || null,
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return setFormError("Title is required.");
    if (!form.startDate) return setFormError("Start date is required.");
    if (!form.regDeadline) return setFormError("Registration deadline is required.");
    if (!form.teamSize || Number(form.teamSize) < 1) return setFormError("Valid team size is required.");
    if (!form.maxTeams || Number(form.maxTeams) < 1) return setFormError("Valid max teams is required.");

    setSaving(true);
    setFormError("");
    try {
      const isNew = editingSlug === "";
      const url = isNew ? API_BASE : `${API_BASE}/${editingSlug}`;
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not save tournament.");
      await fetchTournaments();
      cancelForm();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(t) {
    if (!confirm(`Delete "${t.title}"? This also removes everyone's registrations for it. This can't be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/${t.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not delete tournament.");
      await fetchTournaments();
    } catch (err) {
      setError(err.message);
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
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
        <h1 className="at-h" style={{ fontSize: 34 }}>Manage Tournaments</h1>
        {editingSlug === null && (
          <button className="at-btn at-mono" onClick={startCreate} style={primaryBtnStyle}>
            + New tournament
          </button>
        )}
      </div>
      <p style={{ color: TOKENS.mute, fontSize: 14, marginBottom: 30 }}>Admin only. Changes are live immediately.</p>

      {editingSlug !== null && (
        <form onSubmit={handleSubmit} style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 24, marginBottom: 34 }}>
          <h2 className="at-h" style={{ fontSize: 20, marginBottom: 20 }}>
            {editingSlug === "" ? "New tournament" : `Editing: ${form.title}`}
          </h2>

          <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 3 }}>
              <label className="at-mono" style={labelStyle}>TITLE</label>
              <input name="title" value={form.title} onChange={handleChange} style={inputStyle} required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="at-mono" style={labelStyle}>STATUS</label>
              <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="at-mono" style={labelStyle}>FORMAT</label>
            <input name="format" value={form.format} onChange={handleChange} placeholder="e.g. 5v5 — Single elimination — Bo1" style={inputStyle} />
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <label className="at-mono" style={labelStyle}>TEAM SIZE</label>
              <input type="number" name="teamSize" value={form.teamSize} onChange={handleChange} min={1} style={inputStyle} required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="at-mono" style={labelStyle}>MAX TEAMS</label>
              <input type="number" name="maxTeams" value={form.maxTeams} onChange={handleChange} min={1} style={inputStyle} required />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
            <div style={{ flex: 1 }}>
              <label className="at-mono" style={labelStyle}>START DATE</label>
              <input type="datetime-local" name="startDate" value={form.startDate} onChange={handleChange} style={inputStyle} required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="at-mono" style={labelStyle}>REGISTRATION DEADLINE</label>
              <input type="datetime-local" name="regDeadline" value={form.regDeadline} onChange={handleChange} style={inputStyle} required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="at-mono" style={labelStyle}>END DATE (optional)</label>
              <input type="datetime-local" name="endDate" value={form.endDate} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="at-mono" style={labelStyle}>PRIZE POOL</label>
            <input name="prizePool" value={form.prizePool} onChange={handleChange} placeholder="e.g. $500 in store credit, split top 3" style={inputStyle} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="at-mono" style={labelStyle}>DESCRIPTION</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="at-mono" style={labelStyle}>RULES (one per line)</label>
            <textarea name="rules" value={form.rules} onChange={handleChange} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>

          {form.status === "past" && (
            <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1 }}>
                <label className="at-mono" style={labelStyle}>CHAMPION</label>
                <input name="champion" value={form.champion} onChange={handleChange} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="at-mono" style={labelStyle}>RUNNER-UP</label>
                <input name="runnerUp" value={form.runnerUp} onChange={handleChange} style={inputStyle} />
              </div>
            </div>
          )}

          {formError && <p className="at-mono" style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 16 }}>{formError}</p>}

          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" disabled={saving} className="at-mono" style={primaryBtnStyle}>
              {saving ? "Saving…" : editingSlug === "" ? "Create tournament" : "Save changes"}
            </button>
            <button type="button" onClick={cancelForm} className="at-mono" style={secondaryBtnStyle}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="at-mono" style={{ color: TOKENS.mute }}>Loading…</p>}
      {error && <p className="at-mono" style={{ color: TOKENS.signal }}>{error}</p>}

      <div style={{ display: "grid", gap: 12 }}>
        {tournaments.map((t) => (
          <div key={t.id} style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span className="at-h" style={{ fontSize: 17 }}>{t.title}</span>
                <span className="at-mono" style={{ fontSize: 11, color: TOKENS.cyan, textTransform: "uppercase" }}>{t.status}</span>
              </div>
              <span className="at-mono" style={{ fontSize: 12, color: TOKENS.mute }}>
                {t.teamsCount}/{t.maxTeams} teams · {t.format || "no format set"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="at-btn at-mono" onClick={() => startEdit(t)} style={secondaryBtnStyle}>Edit</button>
              <button className="at-btn at-mono" onClick={() => handleDelete(t)} style={dangerBtnStyle}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: TOKENS.ink, color: TOKENS.off, fontFamily: "'Inter', sans-serif", padding: "60px 32px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .at-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .at-mono { font-family:'JetBrains Mono', monospace; }
        .at-back { cursor:pointer; transition: color .15s; }
        .at-back:hover { color: ${TOKENS.cyan}; }
        .at-btn { cursor:pointer; transition: opacity .15s; }
        .at-btn:hover { opacity: 0.85; }
      `}</style>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div
          className="at-mono at-back"
          onClick={() => navigate("/tournaments")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
        >
          ← Back to tournaments
        </div>
        {children}
      </div>
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