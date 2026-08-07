import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Bracket from "./components/Bracket";
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

const API_BASE = "http://localhost:5000/api/tournaments";
const TOURNAMENT_REGISTRATION_DISCORD_URL = "https://discord.gg/KFaGdfd2E";

function RegistrationError({ message }) {
  if (!message) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color: TOKENS.signal, fontSize: 13, marginBottom: 4 }}>{message}</div>
      <a
        href={TOURNAMENT_REGISTRATION_DISCORD_URL}
        target="_blank"
        rel="noreferrer"
        style={{ color: TOKENS.cyan, fontSize: 12.5 }}
      >
        Still stuck? Ask in #tournament-registration →
      </a>
    </div>
  );
}

function Badge({ status }) {
  const styles = {
    upcoming: { background: "rgba(62, 214, 197, 0.12)", color: TOKENS.cyan },
    live: { background: "rgba(217, 58, 103, 0.14)", color: TOKENS.signal },
    past: { background: "rgba(139, 144, 150, 0.12)", color: TOKENS.mute },
  };
  return (
    <span
      className="td-mono"
      style={{
        fontSize: 11,
        letterSpacing: "0.05em",
        padding: "5px 12px",
        textTransform: "uppercase",
        ...styles[status],
      }}
    >
      {status}
    </span>
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function deadlineCountdown(iso) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diffMs / (1000 * 60)) % 60);
  if (days > 0) return `${days}d ${hours}h left to register`;
  if (hours > 0) return `${hours}h ${mins}m left to register`;
  return `${mins}m left to register`;
}

export default function TournamentDetailPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState(null);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [notFound, setNotFound] = useState(false);

  usePageTitle(tournament?.title);

  const [registration, setRegistration] = useState(null);
  const [roster, setRoster] = useState([]);
  const [loadingRegistration, setLoadingRegistration] = useState(false);
  const [recruiting, setRecruiting] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [spotsLeftOnTeam, setSpotsLeftOnTeam] = useState(null);
  const [requestActionId, setRequestActionId] = useState(null);
  const [togglingRecruiting, setTogglingRecruiting] = useState(false);

  const [teams, setTeams] = useState([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [participants, setParticipants] = useState({ players: [], teams: [] });
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [joinRequestTarget, setJoinRequestTarget] = useState(null);
  const [joinRequestMessage, setJoinRequestMessage] = useState("");
  const [sendingJoinRequest, setSendingJoinRequest] = useState(false);
  const [joinRequestError, setJoinRequestError] = useState("");
  const [joinRequestSent, setJoinRequestSent] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [joinType, setJoinType] = useState("solo");
  const [teamName, setTeamName] = useState("");
  const [teammateInput, setTeammateInput] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [respondingInvite, setRespondingInvite] = useState(false);

  const [, forceRefresh] = useState(0);

  const token = localStorage.getItem("cc_token");

  function loadTournament() {
    setLoadingTournament(true);
    setNotFound(false);
    fetch(`${API_BASE}/${id}`)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setTournament(data.tournament);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoadingTournament(false));
  }

  function loadRegistration() {
    if (!user || !token) {
      setRegistration(null);
      setRoster([]);
      setPendingRequests([]);
      setRecruiting(false);
      setSpotsLeftOnTeam(null);
      return;
    }
    setLoadingRegistration(true);
    fetch(`${API_BASE}/${id}/my-registration`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setRegistration(data.registration);
        setRoster(data.roster || []);
        setPendingRequests(data.pendingRequests || []);
        setRecruiting(!!data.recruiting);
        setSpotsLeftOnTeam(data.spotsLeftOnTeam ?? null);
      })
      .catch(() => {
        setRegistration(null);
        setRoster([]);
        setPendingRequests([]);
        setRecruiting(false);
        setSpotsLeftOnTeam(null);
      })
      .finally(() => setLoadingRegistration(false));
  }

  function loadTeams() {
    setLoadingTeams(true);
    fetch(`${API_BASE}/${id}/teams`)
      .then((res) => res.json())
      .then((data) => setTeams(data.teams || []))
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
  }

  function loadParticipants() {
    setLoadingParticipants(true);
    fetch(`${API_BASE}/${id}/participants`)
      .then((res) => res.json())
      .then((data) => setParticipants({ players: data.players || [], teams: data.teams || [] }))
      .catch(() => setParticipants({ players: [], teams: [] }))
      .finally(() => setLoadingParticipants(false));
  }

  useEffect(() => {
    loadTournament();
    loadRegistration();
    loadTeams();
    loadParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  // Ticks every 30s so the "time left to register" countdown stays live.
  useEffect(() => {
    const interval = setInterval(() => forceRefresh((v) => v + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loadingTournament) {
    return (
      <div className="td-page-wrap" style={pageWrap}>
        <style>{fontImport}</style>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
          <p style={{ color: TOKENS.mute }}>Loading tournament…</p>
        </div>
      </div>
    );
  }

  if (notFound || !tournament) {
    return (
      <div className="td-page-wrap" style={pageWrap}>
        <style>{fontImport}</style>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center", paddingTop: 80 }}>
          <h1 className="td-h" style={{ fontSize: 28, marginBottom: 12 }}>
            Tournament not found
          </h1>
          <p style={{ color: TOKENS.mute, marginBottom: 24 }}>
            This one doesn't exist, or it's been taken down.
          </p>
          <Link to="/tournaments" className="td-link" style={{ color: TOKENS.cyan }}>
            ← Back to all tournaments
          </Link>
        </div>
      </div>
    );
  }

  const spotsFilled = tournament.teamsCount;
  const spotsLeft = tournament.spotsLeft;
  const isFull = spotsLeft <= 0;
  const deadlinePassed = new Date(tournament.regDeadline).getTime() <= Date.now();
  const isPast = tournament.status === "past";
  const canJoin = !isPast && !deadlinePassed && !isFull && !registration;
  const countdown = !isPast ? deadlineCountdown(tournament.regDeadline) : null;
  const requiredTeamSize = tournament.teamSize;
  const isPendingInvite = registration && registration.status === "pending";

  function openModal() {
    setJoinType("solo");
    setTeamName("");
    setTeammateInput("");
    setFormError("");
    setModalOpen(true);
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (joinType === "team" && !teamName.trim()) {
      setFormError("Give your team a name.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const body =
        joinType === "solo"
          ? { type: "solo" }
          : {
              type: "team",
              teamName: teamName.trim(),
              teammateUsernames: teammateInput
                .split(",")
                .map((n) => n.trim())
                .filter(Boolean),
            };

      const res = await fetch(`${API_BASE}/${id}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not join this tournament.");

      setModalOpen(false);
      loadTournament();
      loadRegistration();
      loadTeams();
      loadParticipants();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeave() {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/${id}/register`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setRegistration(null);
      setRoster([]);
      loadTournament();
      loadTeams();
      loadParticipants();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInviteResponse(accept) {
    setRespondingInvite(true);
    try {
      const res = await fetch(`${API_BASE}/${id}/register/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accept }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not respond to invite.");
      loadTournament();
      loadRegistration();
      loadTeams();
      loadParticipants();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setRespondingInvite(false);
    }
  }

  function openJoinRequest(team) {
    setJoinRequestTarget(team);
    setJoinRequestMessage("");
    setJoinRequestError("");
    setJoinRequestSent(false);
  }

  async function handleSendJoinRequest(e) {
    e.preventDefault();
    if (!joinRequestTarget) return;
    setSendingJoinRequest(true);
    setJoinRequestError("");
    try {
      const res = await fetch(`${API_BASE}/${id}/teams/${joinRequestTarget.teamId}/request-join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: joinRequestMessage.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not send join request.");
      setJoinRequestSent(true);
    } catch (err) {
      setJoinRequestError(err.message);
    } finally {
      setSendingJoinRequest(false);
    }
  }

  async function handleRequestDecision(requesterUserId, accept) {
    if (!registration?.teamId) return;
    setRequestActionId(requesterUserId);
    try {
      const res = await fetch(
        `${API_BASE}/${id}/teams/${registration.teamId}/requests/${requesterUserId}/${accept ? "accept" : "reject"}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not update that request.");
      loadRegistration();
      loadTeams();
      loadParticipants();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setRequestActionId(null);
    }
  }

  async function handleToggleRecruiting() {
    if (!registration?.teamId) return;
    setTogglingRecruiting(true);
    try {
      const res = await fetch(`${API_BASE}/${id}/teams/${registration.teamId}/recruiting`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recruiting: !recruiting }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not update recruiting status.");
      setRecruiting(data.recruiting);
      loadTeams();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setTogglingRecruiting(false);
    }
  }

  return (
    <div className="td-page-wrap" style={pageWrap}>
      <style>{fontImport}</style>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div
          className="td-mono td-link"
          onClick={() => navigate("/tournaments")}
          style={{ fontSize: 13, color: TOKENS.mute, marginBottom: 28, cursor: "pointer", display: "inline-block" }}
        >
          ← Back to all tournaments
        </div>

        {/* Header */}
        <div style={{ marginBottom: 34 }}>
          <div style={{ marginBottom: 14 }}>
            <Badge status={tournament.status} />
          </div>
          <h1 className="td-h" style={{ fontSize: 38, marginBottom: 10 }}>
            {tournament.title}
          </h1>
          <p style={{ color: TOKENS.mute, fontSize: 15 }}>{tournament.format}</p>
        </div>

        {/* Info strip */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 1,
            background: TOKENS.steel,
            marginBottom: 34,
            border: `1px solid ${TOKENS.steel}`,
          }}
        >
          <InfoCell label="Starts" value={formatDate(tournament.startDate)} />
          <InfoCell
            label={isPast ? "Ended" : "Registration deadline"}
            value={isPast ? formatDate(tournament.endDate) : formatDate(tournament.regDeadline)}
            accent={!isPast && !deadlinePassed}
          />
          <InfoCell
            label="Spots"
            value={`${spotsFilled}/${tournament.maxTeams} ${tournament.teamSize === 1 ? "players" : "teams"}`}
          />
          <InfoCell label="Prize" value={tournament.prizePool} />
        </div>

        {/* Spots progress bar */}
        {!isPast && (
          <div style={{ marginBottom: 34 }}>
            <div style={{ height: 6, background: TOKENS.panel2, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (spotsFilled / tournament.maxTeams) * 100)}%`,
                  background: isFull ? TOKENS.signal : TOKENS.cyan,
                  transition: "width .3s ease",
                }}
              />
            </div>
            <div
              className="td-mono"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 8,
                fontSize: 12,
                color: TOKENS.mute,
              }}
            >
              <span>{isFull ? "Full" : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`}</span>
              {countdown && <span style={{ color: TOKENS.cyan }}>{countdown}</span>}
              {!countdown && !isPast && <span style={{ color: TOKENS.signal }}>Registration closed</span>}
            </div>
          </div>
        )}

        {/* Result banner for past tournaments */}
        {isPast && (
          <div
            style={{
              background: TOKENS.panel,
              border: `1px solid ${TOKENS.steel}`,
              padding: "20px 24px",
              marginBottom: 34,
              display: "flex",
              gap: 40,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="td-mono" style={{ fontSize: 11, color: TOKENS.mute, marginBottom: 6 }}>
                CHAMPION
              </div>
              <div className="td-h" style={{ fontSize: 20, color: TOKENS.signal }}>
                {tournament.champion}
              </div>
            </div>
            {tournament.runnerUp && (
              <div>
                <div className="td-mono" style={{ fontSize: 11, color: TOKENS.mute, marginBottom: 6 }}>
                  RUNNER-UP
                </div>
                <div className="td-h" style={{ fontSize: 20 }}>
                  {tournament.runnerUp}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div style={{ marginBottom: 34 }}>
          <h2 className="td-h" style={{ fontSize: 18, marginBottom: 12 }}>
            About
          </h2>
          <p style={{ color: TOKENS.mute, lineHeight: 1.7, fontSize: 15 }}>{tournament.description}</p>
        </div>

        {/* Rules */}
        <div style={{ marginBottom: 40 }}>
          <h2 className="td-h" style={{ fontSize: 18, marginBottom: 12 }}>
            Rules
          </h2>
          <ul style={{ listStyle: "none" }}>
            {tournament.rules.map((r) => (
              <li
                key={r}
                style={{
                  padding: "10px 0",
                  borderBottom: `1px solid ${TOKENS.panel2}`,
                  color: TOKENS.off,
                  fontSize: 14,
                  display: "flex",
                  gap: 10,
                }}
              >
                <span style={{ color: TOKENS.cyan }}>—</span>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* Bracket */}
        <div style={{ marginBottom: 40 }}>
          <h2 className="td-h" style={{ fontSize: 18, marginBottom: 16 }}>
            Bracket
          </h2>
          <Bracket tournamentSlug={id} isAdmin={!!user?.isAdmin} />
        </div>

        {/* Registered players / teams — public list of everyone confirmed */}
        <div style={{ marginBottom: 40 }}>
          <h2 className="td-h" style={{ fontSize: 18, marginBottom: 6 }}>
            {requiredTeamSize === 1 ? "Registered players" : "Registered teams"}
          </h2>
          <p style={{ color: TOKENS.mute, fontSize: 13.5, marginBottom: 18 }}>
            {requiredTeamSize === 1
              ? "Everyone locked in for this tournament so far."
              : "Every team currently confirmed for this tournament."}
          </p>

          {loadingParticipants && <p style={{ color: TOKENS.mute, fontSize: 14 }}>Loading…</p>}

          {!loadingParticipants &&
            requiredTeamSize === 1 &&
            participants.players.length === 0 && (
              <p style={{ color: TOKENS.mute, fontSize: 14 }}>No one has registered yet.</p>
            )}

          {!loadingParticipants &&
            requiredTeamSize > 1 &&
            participants.teams.length === 0 && (
              <p style={{ color: TOKENS.mute, fontSize: 14 }}>No teams have registered yet.</p>
            )}

          {!loadingParticipants && requiredTeamSize === 1 && participants.players.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {participants.players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: TOKENS.panel,
                    border: `1px solid ${TOKENS.steel}`,
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ color: TOKENS.off, fontSize: 14.5 }}>{p.displayName}</span>
                  <span className="td-mono" style={{ fontSize: 10.5, color: TOKENS.cyan, textTransform: "uppercase" }}>
                    Confirmed
                  </span>
                </div>
              ))}
            </div>
          )}

          {!loadingParticipants && requiredTeamSize > 1 && participants.teams.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
              {participants.teams.map((t) => (
                <div key={t.teamId} style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 18 }}>
                  <div className="td-h" style={{ fontSize: 16, marginBottom: 6 }}>
                    {t.teamName}
                  </div>
                  <div className="td-mono" style={{ fontSize: 12, color: TOKENS.mute, marginBottom: 4 }}>
                    Captain: {t.captain}
                  </div>
                  <div className="td-mono" style={{ fontSize: 12, color: TOKENS.cyan }}>
                    {t.rosterSize}/{t.maxSize} players
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Join panel */}
        {!isPast && (
          <div
            style={{
              background: TOKENS.panel,
              border: `1px solid ${TOKENS.steel}`,
              padding: 28,
              marginBottom: 60,
            }}
          >
            {loadingRegistration ? (
              <p style={{ color: TOKENS.mute, fontSize: 14 }}>Checking your registration…</p>
            ) : isPendingInvite ? (
              <div>
                <div className="td-mono" style={{ fontSize: 12, color: TOKENS.signal, marginBottom: 10 }}>
                  TEAM INVITE PENDING
                </div>
                <p style={{ color: TOKENS.off, fontSize: 15, marginBottom: 4 }}>
                  You've been invited to join <strong>"{registration.teamName}"</strong>.
                </p>
                {roster.length > 0 && (
                  <RosterList roster={roster} style={{ marginTop: 14, marginBottom: 18 }} />
                )}
                <RegistrationError message={formError} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleInviteResponse(true)}
                    className="td-btn td-btn-primary"
                    disabled={respondingInvite}
                  >
                    {respondingInvite ? "Please wait…" : "Accept invite"}
                  </button>
                  <button
                    onClick={() => handleInviteResponse(false)}
                    className="td-btn"
                    disabled={respondingInvite}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ) : registration ? (
              <div>
                <div className="td-mono" style={{ fontSize: 12, color: TOKENS.cyan, marginBottom: 10 }}>
                  YOU'RE REGISTERED
                </div>
                <p style={{ color: TOKENS.off, fontSize: 15, marginBottom: 4 }}>
                  {registration.type === "solo"
                    ? `Registered as a free agent (${registration.displayName})`
                    : `Team "${registration.teamName}"${registration.isCaptain ? " — you're the captain" : ""}`}
                </p>
                <p style={{ color: TOKENS.mute, fontSize: 13, marginBottom: 14 }}>
                  Joined {formatDate(registration.joinedAt)}
                </p>
                {roster.length > 0 && <RosterList roster={roster} style={{ marginBottom: 18 }} />}

                {registration.type === "team" && registration.isCaptain && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                      <div className="td-mono" style={{ fontSize: 11, color: TOKENS.mute, letterSpacing: "0.05em" }}>
                        RECRUITING
                      </div>
                      <button
                        onClick={handleToggleRecruiting}
                        className="td-mono"
                        disabled={togglingRecruiting || spotsLeftOnTeam === 0}
                        style={{
                          fontSize: 11,
                          padding: "5px 12px",
                          textTransform: "uppercase",
                          cursor: spotsLeftOnTeam === 0 ? "not-allowed" : "pointer",
                          border: `1px solid ${recruiting ? TOKENS.cyan : TOKENS.steel}`,
                          background: recruiting ? "rgba(62, 214, 197, 0.1)" : "transparent",
                          color: recruiting ? TOKENS.cyan : TOKENS.mute,
                        }}
                      >
                        {togglingRecruiting ? "…" : recruiting ? "Open — turn off" : "Closed — turn on"}
                      </button>
                    </div>

                    {pendingRequests.length > 0 && (
                      <>
                        <div className="td-mono" style={{ fontSize: 11, color: TOKENS.mute, marginBottom: 8, letterSpacing: "0.05em" }}>
                          JOIN REQUESTS
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {pendingRequests.map((r) => (
                            <div
                              key={r.userId}
                              style={{
                                background: TOKENS.panel2,
                                padding: "10px 14px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                flexWrap: "wrap",
                                gap: 8,
                              }}
                            >
                              <div>
                                <div style={{ color: TOKENS.off, fontSize: 13.5 }}>
                                  {r.username}
                                  {r.rank && (
                                    <span className="td-mono" style={{ color: TOKENS.cyan, fontSize: 11, marginLeft: 8 }}>
                                      {r.rank}
                                    </span>
                                  )}
                                </div>
                                {r.message && (
                                  <div style={{ color: TOKENS.mute, fontSize: 12.5, marginTop: 2 }}>"{r.message}"</div>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button
                                  onClick={() => handleRequestDecision(r.userId, true)}
                                  className="td-btn td-btn-primary"
                                  disabled={requestActionId === r.userId}
                                  style={{ padding: "6px 14px", fontSize: 12 }}
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRequestDecision(r.userId, false)}
                                  className="td-btn"
                                  disabled={requestActionId === r.userId}
                                  style={{ padding: "6px 14px", fontSize: 12 }}
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                <button onClick={handleLeave} className="td-btn" disabled={submitting}>
                  {submitting
                    ? "Leaving…"
                    : registration.type === "team" && registration.isCaptain
                    ? "Disband team"
                    : "Leave tournament"}
                </button>
              </div>
            ) : !user ? (
              <div>
                <p style={{ color: TOKENS.off, fontSize: 15, marginBottom: 4 }}>Log in to join this tournament.</p>
                <p style={{ color: TOKENS.mute, fontSize: 13 }}>
                  Use the Profile button in the top nav to sign in or create an account.
                </p>
              </div>
            ) : canJoin ? (
              <div>
                <p style={{ color: TOKENS.off, fontSize: 15, marginBottom: 18 }}>
                  Ready to lock in? Join solo as a free agent or invite your team.
                </p>
                <button onClick={openModal} className="td-btn td-btn-primary">
                  Join tournament
                </button>
              </div>
            ) : (
              <p style={{ color: TOKENS.mute, fontSize: 14 }}>
                {isFull ? "This tournament is full." : "Registration for this tournament has closed."}
              </p>
            )}
          </div>
        )}

        {/* Teams looking for players */}
        {!isPast && requiredTeamSize > 1 && (
          <div style={{ marginBottom: 60 }}>
            <h2 className="td-h" style={{ fontSize: 18, marginBottom: 6 }}>
              Teams looking for players
            </h2>
            <p style={{ color: TOKENS.mute, fontSize: 13.5, marginBottom: 18 }}>
              Don't have a full squad? Request to join one of these teams already registered for this
              tournament.
            </p>

            {loadingTeams && <p style={{ color: TOKENS.mute, fontSize: 14 }}>Loading teams…</p>}

            {!loadingTeams && teams.filter((t) => t.recruiting).length === 0 && (
              <p style={{ color: TOKENS.mute, fontSize: 14 }}>No teams are recruiting right now.</p>
            )}

            {!loadingTeams && teams.filter((t) => t.recruiting).length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
                {teams
                  .filter((t) => t.recruiting)
                  .map((t) => (
                    <div
                      key={t.teamId}
                      style={{ background: TOKENS.panel, border: `1px solid ${TOKENS.steel}`, padding: 18 }}
                    >
                      <div className="td-h" style={{ fontSize: 16, marginBottom: 6 }}>
                        {t.teamName}
                      </div>
                      <div className="td-mono" style={{ fontSize: 12, color: TOKENS.mute, marginBottom: 4 }}>
                        Captain: {t.captain}
                      </div>
                      <div className="td-mono" style={{ fontSize: 12, color: TOKENS.cyan, marginBottom: 14 }}>
                        {t.rosterSize}/{t.maxSize} players · {t.spotsLeft} spot{t.spotsLeft === 1 ? "" : "s"} left
                      </div>
                      {user ? (
                        <button
                          onClick={() => openJoinRequest(t)}
                          className="td-btn"
                          style={{ width: "100%" }}
                          disabled={!!registration}
                        >
                          {registration ? "Already registered" : "Request to join"}
                        </button>
                      ) : (
                        <p style={{ color: TOKENS.mute, fontSize: 12.5, textAlign: "center", margin: 0 }}>
                          Log in via the Profile button to request to join.
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Join modal */}
      {modalOpen && (
        <div
          onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(11,13,15,0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <form
            onSubmit={handleJoin}
            className="td-modal-card"
            style={{
              width: "100%",
              maxWidth: 420,
              background: TOKENS.panel,
              border: `1px solid ${TOKENS.steel}`,
            }}
          >
            <h3 className="td-h" style={{ fontSize: 20, marginBottom: 20 }}>
              Join {tournament.title}
            </h3>

            <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
              {["solo", "team"].map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setJoinType(t)}
                  className="td-mono"
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    fontSize: 12,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                    border: `1px solid ${joinType === t ? TOKENS.cyan : TOKENS.steel}`,
                    background: joinType === t ? "rgba(62, 214, 197, 0.1)" : "transparent",
                    color: joinType === t ? TOKENS.cyan : TOKENS.mute,
                  }}
                >
                  {t === "solo" ? "Join solo" : "Invite team"}
                </button>
              ))}
            </div>

            {joinType === "solo" ? (
              <p style={{ color: TOKENS.mute, fontSize: 14, marginBottom: 22, lineHeight: 1.6 }}>
                You'll be registered as a free agent under <strong style={{ color: TOKENS.off }}>{user?.username}</strong>.
                Organizers can slot free agents into a team that needs players.
              </p>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label className="td-mono" style={labelStyle}>
                    TEAM NAME
                  </label>
                  <input
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Nullpoint"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label className="td-mono" style={labelStyle}>
                    TEAMMATE USERNAMES (optional, comma separated)
                  </label>
                  <input
                    value={teammateInput}
                    onChange={(e) => setTeammateInput(e.target.value)}
                    placeholder="playerTwo, playerThree, playerFour"
                    style={inputStyle}
                  />
                </div>
                <p style={{ color: TOKENS.mute, fontSize: 12.5, marginBottom: 22, lineHeight: 1.6 }}>
                  Know who you're playing with? Add their usernames and they'll get a pending invite.
                  Otherwise, leave this blank — your team will show up on this page as recruiting, so
                  other players can send you a request to join, and you can accept the ones you want.
                  {requiredTeamSize > 1 && (
                    <> This tournament allows up to <strong style={{ color: TOKENS.off }}>{requiredTeamSize}</strong> players total (including you).</>
                  )}
                </p>
              </>
            )}

            <RegistrationError message={formError} />

            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={() => setModalOpen(false)} className="td-btn" style={{ flex: 1 }}>
                Cancel
              </button>
              <button type="submit" className="td-btn td-btn-primary" style={{ flex: 1 }} disabled={submitting}>
                {submitting ? "Sending…" : "Confirm"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Join-request modal */}
      {joinRequestTarget && (
        <div
          onClick={(e) => e.target === e.currentTarget && setJoinRequestTarget(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(11,13,15,0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <form
            onSubmit={handleSendJoinRequest}
            className="td-modal-card"
            style={{
              width: "100%",
              maxWidth: 420,
              background: TOKENS.panel,
              border: `1px solid ${TOKENS.steel}`,
            }}
          >
            <h3 className="td-h" style={{ fontSize: 20, marginBottom: 20 }}>
              Request to join {joinRequestTarget.teamName}
            </h3>

            {joinRequestSent ? (
              <>
                <p style={{ color: TOKENS.off, fontSize: 15, marginBottom: 22, lineHeight: 1.6 }}>
                  Sent! The captain will see your request and can accept you onto the roster.
                </p>
                <button type="button" onClick={() => setJoinRequestTarget(null)} className="td-btn td-btn-primary" style={{ width: "100%" }}>
                  Done
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label className="td-mono" style={labelStyle}>
                    MESSAGE TO CAPTAIN (optional)
                  </label>
                  <input
                    value={joinRequestMessage}
                    onChange={(e) => setJoinRequestMessage(e.target.value)}
                    placeholder="I main Sentinel, available evenings"
                    style={inputStyle}
                  />
                </div>

                <RegistrationError message={joinRequestError} />

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setJoinRequestTarget(null)} className="td-btn" style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="td-btn td-btn-primary" style={{ flex: 1 }} disabled={sendingJoinRequest}>
                    {sendingJoinRequest ? "Sending…" : "Send request"}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

function RosterList({ roster, style }) {
  return (
    <div style={{ ...style }}>
      <div className="td-mono" style={{ fontSize: 11, color: TOKENS.mute, marginBottom: 8, letterSpacing: "0.05em" }}>
        ROSTER
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {roster.map((m) => (
          <div
            key={m.displayName}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              background: TOKENS.panel2,
              fontSize: 13.5,
            }}
          >
            <span style={{ color: TOKENS.off }}>
              {m.displayName}
              {m.isCaptain && (
                <span className="td-mono" style={{ color: TOKENS.cyan, fontSize: 11, marginLeft: 8 }}>
                  CAPTAIN
                </span>
              )}
            </span>
            <span
              className="td-mono"
              style={{
                fontSize: 10.5,
                textTransform: "uppercase",
                color: m.status === "confirmed" ? TOKENS.cyan : TOKENS.mute,
              }}
            >
              {m.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoCell({ label, value, accent }) {
  return (
    <div style={{ background: TOKENS.panel, padding: "18px 20px" }}>
      <div className="td-mono" style={{ fontSize: 11, color: TOKENS.mute, marginBottom: 8, letterSpacing: "0.05em" }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 15, color: accent ? TOKENS.cyan : TOKENS.off, fontWeight: 500 }}>{value}</div>
    </div>
  );
}

const pageWrap = {
  minHeight: "100vh",
  background: TOKENS.ink,
  color: TOKENS.off,
  fontFamily: "'Inter', sans-serif",
};

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
  .td-h { font-family:'Rajdhani', sans-serif; text-transform:uppercase; letter-spacing:0.02em; }
  .td-mono { font-family:'JetBrains Mono', monospace; }
  .td-link:hover { color: ${TOKENS.cyan} !important; }
  .td-btn { display:inline-flex; align-items:center; gap:8px; padding:11px 22px; font-size:14px; font-weight:600; letter-spacing:0.03em; text-transform:uppercase; border:1px solid ${TOKENS.steel}; background:transparent; color:${TOKENS.off}; cursor:pointer; transition: all .15s; }
  .td-btn:hover { border-color:${TOKENS.cyan}; color:${TOKENS.cyan}; }
  .td-btn-primary { background:${TOKENS.signal}; border-color:${TOKENS.signal}; color:#0B0D0F; }
  .td-btn-primary:hover { background:#ff5a6b; color:#0B0D0F; }
  .td-page-wrap { padding: 60px 32px 40px; }
  .td-modal-card { padding: 32px; }
  @media (max-width: 480px) {
    .td-page-wrap { padding: 40px 16px 32px; }
    .td-modal-card { padding: 20px; }
  }
`;

const labelStyle = {
  fontSize: 11,
  color: TOKENS.mute,
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: 8,
};

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  background: TOKENS.panel2,
  border: `1px solid ${TOKENS.steel}`,
  color: TOKENS.off,
  fontSize: 14,
  fontFamily: "'Inter', sans-serif",
  boxSizing: "border-box",
};