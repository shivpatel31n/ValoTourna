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

const API_BASE = "http://localhost:5000/api/teams";
const DISCORD_URL = "https://discord.gg/7RCDt277Y";
const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];
const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function TeamDetailPage({ user, onRequireAuth }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [joinMessage, setJoinMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  usePageTitle(team?.name);

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadTeam() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${id}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not load team.");
      setTeam(data.team);
      setForm({
        name: data.team.name,
        tag: data.team.tag,
        region: data.team.region,
        rolesNeeded: data.team.rolesNeeded || [],
        schedule: data.team.schedule,
        description: data.team.description,
        maxSize: data.team.maxSize,
        recruiting: data.team.recruiting,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Shell><p className="td-mono" style={{ color: TOKENS.mute }}>Loading team…</p></Shell>;
  if (error) return <Shell><p className="td-mono" style={{ color: TOKENS.signal }}>{error}</p></Shell>;
  if (!team) return null;

  const captainId = team.captain?.id;
  const isCaptain = user && captainId === user.id;
  const isMember = user && (isCaptain || team.members.some((m) => m.user?.id === user.id));
  const memberCount = team.memberCount ?? team.members.length;
  const rosterFull = memberCount + 1 >= team.maxSize;
  const alreadyRequested = user && !isCaptain && team.myRequestPending;

  async function callAction(path, options = {}) {
    setBusy(true);
    setActionError("");
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: options.method || "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Something went wrong.");
      if (data.team) setTeam(data.team);
      return true;
    } catch (err) {
      setActionError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function handleJoinClick() {
    if (!user) return onRequireAuth?.();
    callAction(`/${id}/request-join`, { body: { message: joinMessage } }).then((ok) => {
      if (ok) setJoinMessage("");
    });
  }

  function handleAccept(userId) {
    callAction(`/${id}/requests/${userId}/accept`);
  }
  function handleReject(userId) {
    callAction(`/${id}/requests/${userId}/reject`);
  }
  function handleRemove(userId) {
    callAction(`/${id}/members/${userId}`, { method: "DELETE" });
  }
  function handleTransferCaptain(userId, username) {
    if (!confirm(`Make ${username} the team captain? You'll become a regular member.`)) return;
    callAction(`/${id}/transfer-captain/${userId}`);
  }
  function handleLeave() {
    if (!confirm("Leave this team?")) return;
    callAction(`/${id}/members/${user.id}`, { method: "DELETE" }).then((ok) => {
      if (ok) navigate("/teams");
    });
  }
  function handleDisband() {
    if (!confirm("Disband this team? This can't be undone.")) return;
    callAction(`/${id}`, { method: "DELETE" }).then((ok) => {
      if (ok) navigate("/teams");
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    const ok = await callAction(`/${id}`, { method: "PATCH", body: form });
    if (ok) setEditing(false);
  }

  function toggleRole(role) {
    setForm((f) => ({
      ...f,
      rolesNeeded: f.rolesNeeded.includes(role)
        ? f.rolesNeeded.filter((r) => r !== role)
        : [...f.rolesNeeded, role],
    }));
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
      <div
        className="td-mono td-back"
        onClick={() => navigate("/teams")}
        style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "inline-block" }}
      >
        ← Back to teams
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
        <h1 className="td-h" style={{ fontSize: 34 }}>
          {team.name} {team.tag && <span style={{ color: TOKENS.mute, fontSize: 20 }}>[{team.tag}]</span>}
        </h1>
        {isCaptain && !editing && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className="td-btn td-mono" onClick={() => setEditing(true)} style={secondaryBtnStyle}>
              Edit
            </button>
            <button className="td-btn td-mono" onClick={handleDisband} style={dangerBtnStyle}>
              Disband
            </button>
          </div>
        )}
        {isMember && !isCaptain && (
          <button className="td-btn td-mono" onClick={handleLeave} style={dangerBtnStyle}>
            Leave team
          </button>
        )}
      </div>

      <div className="td-mono" style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 24, display: "flex", gap: 16, flexWrap: "wrap" }}>
        <span>{team.region}</span>
        <span>{memberCount + 1}/{team.maxSize} players</span>
        <span style={{ color: team.recruiting ? TOKENS.cyan : TOKENS.mute }}>
          {team.recruiting ? "Recruiting" : "Not recruiting"}
        </span>
      </div>

      {editing ? (
        <form onSubmit={handleSaveEdit} style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 24, marginBottom: 30 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 3 }}>
              <label className="td-mono" style={labelStyle}>TEAM NAME</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="td-mono" style={labelStyle}>TAG</label>
              <input value={form.tag} onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))} maxLength={5} style={inputStyle} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <label className="td-mono" style={labelStyle}>REGION</label>
              <select value={form.region} onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))} style={inputStyle}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="td-mono" style={labelStyle}>MAX ROSTER SIZE</label>
              <input type="number" min={1} max={10} value={form.maxSize} onChange={(e) => setForm((f) => ({ ...f, maxSize: e.target.value }))} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="td-mono" style={labelStyle}>ROLES NEEDED</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ROLES.map((r) => {
                const active = form.rolesNeeded.includes(r);
                return (
                  <span
                    key={r}
                    className="td-mono td-chip"
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
            <label className="td-mono" style={labelStyle}>PLAY SCHEDULE</label>
            <input value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="td-mono" style={labelStyle}>DESCRIPTION</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24, cursor: "pointer" }}>
            <input type="checkbox" checked={form.recruiting} onChange={(e) => setForm((f) => ({ ...f, recruiting: e.target.checked }))} style={{ width: 16, height: 16 }} />
            <span className="td-mono" style={{ fontSize: 12, color: TOKENS.mute }}>RECRUITING</span>
          </label>
          {actionError && <p className="td-mono" style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 16 }}>{actionError}</p>}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="submit" disabled={busy} className="td-mono" style={primaryBtnStyle}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="td-mono" style={secondaryBtnStyle}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {team.description && (
            <p style={{ color: TOKENS.off, fontSize: 14, lineHeight: 1.6, marginBottom: 20, maxWidth: 640 }}>
              {team.description}
            </p>
          )}
          {team.schedule && (
            <p className="td-mono" style={{ color: TOKENS.mute, fontSize: 13, marginBottom: 20 }}>
              Schedule: <span style={{ color: TOKENS.off }}>{team.schedule}</span>
            </p>
          )}
          {team.rolesNeeded?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 30 }}>
              {team.rolesNeeded.map((r) => (
                <span key={r} className="td-mono" style={{ fontSize: 12, color: TOKENS.signal, border: `1px solid ${TOKENS.signal}`, padding: "4px 10px" }}>
                  Needs {r}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Roster */}
      <h2 className="td-h" style={{ fontSize: 20, marginBottom: 16 }}>Roster</h2>
      <div style={{ display: "grid", gap: 10, marginBottom: 30 }}>
        <RosterRow player={team.captain} tag="Captain" />
        {team.members.map((m) => (
          <RosterRow
            key={m.user?.id}
            player={m.user}
            tag={m.role}
            onRemove={isCaptain ? () => handleRemove(m.user.id) : null}
            onMakeCaptain={isCaptain ? () => handleTransferCaptain(m.user.id, m.user.username) : null}
          />
        ))}
        {team.members.length === 0 && (
          <p className="td-mono" style={{ color: TOKENS.mute, fontSize: 13 }}>No teammates yet.</p>
        )}
      </div>

      {/* Captain: pending requests */}
      {isCaptain && team.pendingRequests?.length > 0 && (
        <>
          <h2 className="td-h" style={{ fontSize: 20, marginBottom: 16 }}>Join requests</h2>
          {actionError && (
            <p className="td-mono" style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 12 }}>
              {actionError}
            </p>
          )}
          <div style={{ display: "grid", gap: 10, marginBottom: 30 }}>
            {team.pendingRequests.map((r) => (
              <div key={r.user?.id} style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div className="td-mono" style={{ fontSize: 14, color: TOKENS.off, marginBottom: 4 }}>
                    {r.user?.username} {r.user?.riotName && <span style={{ color: TOKENS.mute }}>({r.user.riotName}#{r.user.riotTag})</span>}
                  </div>
                  <div className="td-mono" style={{ fontSize: 12, color: TOKENS.mute }}>
                    {r.user?.rank || "Unranked"} · {r.user?.role || "No role"}
                  </div>
                  {r.message && <div style={{ fontSize: 13, color: TOKENS.off, marginTop: 6 }}>"{r.message}"</div>}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="td-btn td-mono" disabled={busy} onClick={() => handleAccept(r.user.id)} style={primaryBtnStyle}>Accept</button>
                  <button className="td-btn td-mono" disabled={busy} onClick={() => handleReject(r.user.id)} style={secondaryBtnStyle}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Non-member: request to join */}
      {!isMember && (
        <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 20, marginBottom: 30 }}>
          {!team.recruiting ? (
            <p className="td-mono" style={{ color: TOKENS.mute, fontSize: 13 }}>This team isn't recruiting right now.</p>
          ) : rosterFull ? (
            <p className="td-mono" style={{ color: TOKENS.mute, fontSize: 13 }}>This roster is full.</p>
          ) : alreadyRequested ? (
            <p className="td-mono" style={{ color: TOKENS.cyan, fontSize: 13 }}>Your join request is pending.</p>
          ) : (
            <>
              <label className="td-mono" style={labelStyle}>MESSAGE TO THE CAPTAIN (optional)</label>
              <textarea
                value={joinMessage}
                onChange={(e) => setJoinMessage(e.target.value)}
                placeholder="Say a bit about your rank, role, and availability"
                rows={2}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", marginBottom: 12 }}
              />
              {actionError && <p className="td-mono" style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 12 }}>{actionError}</p>}
              <button className="td-btn td-mono" disabled={busy} onClick={handleJoinClick} style={primaryBtnStyle}>
                {busy ? "Sending…" : "Request to join"}
              </button>
            </>
          )}
        </div>
      )}

      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noreferrer"
        className="td-mono"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          background: "rgba(62, 214, 197, 0.08)",
          border: `1px solid ${TOKENS.cyan}`,
          color: TOKENS.off,
          padding: "14px 20px",
          textDecoration: "none",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1.5 }}>
          On the roster? <strong style={{ color: TOKENS.cyan }}>Join our Discord</strong> to actually coordinate scrims and practice with your team.
        </span>
        <span style={{ flexShrink: 0, background: TOKENS.cyan, color: TOKENS.ink, padding: "8px 16px", fontSize: 12, textTransform: "uppercase", fontWeight: 600 }}>
          Join Discord →
        </span>
      </a>
    </Shell>
  );
}

function RosterRow({ player, tag, onRemove, onMakeCaptain }) {
  if (!player) return null;
  return (
    <div style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div>
        <span className="td-mono" style={{ fontSize: 14, color: TOKENS.off }}>{player.username}</span>
        {player.riotName && (
          <span className="td-mono" style={{ fontSize: 12, color: TOKENS.mute, marginLeft: 8 }}>
            {player.riotName}#{player.riotTag}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="td-mono" style={{ fontSize: 12, color: TOKENS.cyan }}>{player.rank || "Unranked"}</span>
        {tag && <span className="td-mono" style={{ fontSize: 11, color: TOKENS.mute, textTransform: "uppercase" }}>{tag}</span>}
        {onMakeCaptain && (
          <button onClick={onMakeCaptain} className="td-btn td-mono" style={{ ...secondaryBtnStyle, padding: "4px 10px", fontSize: 11 }}>
            Make captain
          </button>
        )}
        {onRemove && (
          <button onClick={onRemove} className="td-btn td-mono" style={{ ...dangerBtnStyle, padding: "4px 10px", fontSize: 11 }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: TOKENS.ink, color: TOKENS.off, fontFamily: "'Inter', sans-serif", padding: "60px 32px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .td-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .td-mono { font-family:'JetBrains Mono', monospace; }
        .td-back { cursor:pointer; transition: color .15s; }
        .td-back:hover { color: ${TOKENS.cyan}; }
        .td-btn { cursor:pointer; transition: opacity .15s; }
        .td-btn:hover { opacity: 0.85; }
        .td-chip { cursor:pointer; }
      `}</style>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>{children}</div>
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