import React, { useEffect, useState } from "react";
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

const API_BASE = "http://localhost:5000/api/admin";

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminUsersPage({ user }) {
  usePageTitle("Admin · Users");
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);
  const [banTarget, setBanTarget] = useState(null); // user being banned (for the reason prompt)
  const [banReason, setBanReason] = useState("");

  useEffect(() => {
    if (!user?.isAdmin) return;
    fetchUsers(1, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function fetchUsers(pageNum, searchTerm) {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: pageNum, limit: 20 });
    if (searchTerm) params.set("search", searchTerm);

    fetch(`${API_BASE}/users?${params}`, { headers: authHeaders() })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.message || "Failed to load users.");
        setUsers(data.users);
        setTotal(data.total);
        setPage(data.page);
        setPages(data.pages);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    fetchUsers(1, search);
  }

  async function handleUnban(targetUser) {
    setActioningId(targetUser.id);
    try {
      const res = await fetch(`${API_BASE}/users/${targetUser.id}/unban`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to unban.");
      setUsers((list) => list.map((u) => (u.id === targetUser.id ? data.user : u)));
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  }

  async function submitBan(e) {
    e.preventDefault();
    if (!banTarget) return;
    setActioningId(banTarget.id);
    try {
      const res = await fetch(`${API_BASE}/users/${banTarget.id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ reason: banReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to ban.");
      setUsers((list) => list.map((u) => (u.id === banTarget.id ? data.user : u)));
      setBanTarget(null);
      setBanReason("");
    } catch (err) {
      setError(err.message);
    } finally {
      setActioningId(null);
    }
  }

  if (!user) {
    return (
      <Shell>
        <p className="au-mono" style={{ color: TOKENS.mute }}>Log in to access this page.</p>
      </Shell>
    );
  }

  if (!user.isAdmin) {
    return (
      <Shell>
        <p className="au-mono" style={{ color: TOKENS.signal }}>Admins only.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <h1 className="au-h" style={{ fontSize: 28 }}>Manage Users</h1>
        <button
          className="au-btn"
          onClick={() => navigate("/admin/tournaments")}
          style={secondaryBtnStyle}
        >
          Manage Tournaments
        </button>
      </div>

      <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search username, email, or Riot ID…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button type="submit" className="au-btn" style={secondaryBtnStyle}>Search</button>
      </form>

      {error && (
        <div style={{ background: "rgba(217,58,103,0.12)", border: `1px solid ${TOKENS.signal}`, color: TOKENS.signal, fontSize: 13, padding: "10px 14px", marginBottom: 18 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="au-mono" style={{ color: TOKENS.mute }}>Loading…</p>
      ) : (
        <>
          <p className="au-mono" style={{ color: TOKENS.mute, fontSize: 12, marginBottom: 14 }}>
            {total} user{total === 1 ? "" : "s"}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {users.map((u) => (
              <div
                key={u.id}
                style={{
                  background: TOKENS.panel,
                  border: `1px solid ${u.banned ? TOKENS.signal : TOKENS.steel}`,
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
                    {u.username}
                    {u.isAdmin && (
                      <span className="au-mono" style={{ fontSize: 10, color: TOKENS.cyan, border: `1px solid ${TOKENS.cyan}`, padding: "1px 6px" }}>
                        ADMIN
                      </span>
                    )}
                    {u.banned && (
                      <span className="au-mono" style={{ fontSize: 10, color: TOKENS.signal, border: `1px solid ${TOKENS.signal}`, padding: "1px 6px" }}>
                        BANNED
                      </span>
                    )}
                  </div>
                  <div className="au-mono" style={{ fontSize: 12, color: TOKENS.mute, marginTop: 4 }}>
                    {u.email} · {u.riotName}#{u.riotTag} · {u.rank || "Unranked"} · via {u.authProvider}
                  </div>
                  {u.banned && u.banReason && (
                    <div className="au-mono" style={{ fontSize: 12, color: TOKENS.signal, marginTop: 4 }}>
                      Reason: {u.banReason}
                    </div>
                  )}
                </div>

                {!u.isAdmin && (
                  <div>
                    {u.banned ? (
                      <button
                        className="au-btn"
                        onClick={() => handleUnban(u)}
                        disabled={actioningId === u.id}
                        style={secondaryBtnStyle}
                      >
                        {actioningId === u.id ? "…" : "Unban"}
                      </button>
                    ) : (
                      <button
                        className="au-btn"
                        onClick={() => {
                          setBanTarget(u);
                          setBanReason("");
                        }}
                        disabled={actioningId === u.id}
                        style={dangerBtnStyle}
                      >
                        Ban
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {pages > 1 && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center" }}>
              <button className="au-btn" disabled={page <= 1} onClick={() => fetchUsers(page - 1, search)} style={secondaryBtnStyle}>
                ← Prev
              </button>
              <span className="au-mono" style={{ fontSize: 12, color: TOKENS.mute }}>
                Page {page} of {pages}
              </span>
              <button className="au-btn" disabled={page >= pages} onClick={() => fetchUsers(page + 1, search)} style={secondaryBtnStyle}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {banTarget && (
        <div
          onClick={(e) => e.target === e.currentTarget && setBanTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(11,13,15,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <form
            onSubmit={submitBan}
            style={{ width: "100%", maxWidth: 420, background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 28 }}
          >
            <h3 className="au-h" style={{ fontSize: 20, marginBottom: 16 }}>
              Ban {banTarget.username}?
            </h3>
            <p style={{ color: TOKENS.mute, fontSize: 13, marginBottom: 16 }}>
              They'll be logged out immediately and unable to log back in until unbanned.
            </p>
            <label className="au-mono" style={{ fontSize: 11, color: TOKENS.mute, display: "block", marginBottom: 8 }}>
              REASON (optional, shown to them)
            </label>
            <input
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="e.g. harassment in tournament chat"
              style={{ ...inputStyle, marginBottom: 20 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setBanTarget(null)} className="au-btn" style={{ ...secondaryBtnStyle, flex: 1 }}>
                Cancel
              </button>
              <button type="submit" className="au-btn" disabled={actioningId === banTarget.id} style={{ ...dangerBtnStyle, flex: 1 }}>
                {actioningId === banTarget.id ? "Banning…" : "Confirm ban"}
              </button>
            </div>
          </form>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: TOKENS.ink, color: TOKENS.off, fontFamily: "'Inter', sans-serif", padding: "60px 32px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .au-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
        .au-mono { font-family:'JetBrains Mono', monospace; }
        .au-btn { cursor:pointer; transition: opacity .15s; }
        .au-btn:hover { opacity: 0.85; }
        .au-back { cursor:pointer; transition: color .15s; }
        .au-back:hover { color: ${TOKENS.cyan}; }
      `}</style>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div
          className="au-mono au-back"
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

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  background: TOKENS.panel2,
  border: `1px solid ${TOKENS.steel}`,
  color: TOKENS.off,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
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
  background: TOKENS.signal,
  color: TOKENS.ink,
  padding: "8px 16px",
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  border: "none",
};