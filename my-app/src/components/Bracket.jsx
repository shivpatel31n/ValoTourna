import React, { useEffect, useState } from "react";

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

function authHeaders() {
  const token = localStorage.getItem("cc_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// One entrant slot inside a match card.
function EntrantRow({ entrant, score, isWinner, isDecidedMatch }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        background: isWinner ? "rgba(62, 214, 197, 0.08)" : "transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: 13.5,
            color: !entrant ? TOKENS.mute : isWinner ? TOKENS.cyan : TOKENS.off,
            fontStyle: !entrant ? "italic" : "normal",
          }}
        >
          {entrant ? entrant.name : "TBD"}
        </span>
        {isDecidedMatch && entrant && (
          <span
            className="br-mono"
            style={{ fontSize: 13, color: isWinner ? TOKENS.cyan : TOKENS.mute, fontWeight: isWinner ? 700 : 400 }}
          >
            {score}
          </span>
        )}
      </div>
      {entrant?.type === "team" && entrant.members?.length > 0 && (
        <div className="br-mono" style={{ fontSize: 10.5, color: TOKENS.mute, marginTop: 2, wordBreak: "break-word" }}>
          {entrant.members.join(", ")}
        </div>
      )}
    </div>
  );
}

function ReportForm({ match, onSubmit, submitting, error }) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");

  return (
    <div style={{ padding: "10px 12px", borderTop: `1px solid ${TOKENS.steel}` }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          type="number"
          min={0}
          value={scoreA}
          onChange={(e) => setScoreA(e.target.value)}
          placeholder={match.entrantA?.name || "A"}
          style={reportInputStyle}
        />
        <input
          type="number"
          min={0}
          value={scoreB}
          onChange={(e) => setScoreB(e.target.value)}
          placeholder={match.entrantB?.name || "B"}
          style={reportInputStyle}
        />
      </div>
      {error && <p className="br-mono" style={{ color: TOKENS.signal, fontSize: 11.5, marginBottom: 8 }}>{error}</p>}
      <button
        className="br-mono"
        disabled={submitting || scoreA === "" || scoreB === ""}
        onClick={() => onSubmit(match.id, Number(scoreA), Number(scoreB))}
        style={{
          width: "100%",
          background: TOKENS.cyan,
          color: TOKENS.ink,
          border: "none",
          padding: "8px 0",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          cursor: submitting ? "default" : "pointer",
          opacity: submitting ? 0.6 : 1,
        }}
      >
        {submitting ? "Reporting…" : "Report result"}
      </button>
    </div>
  );
}

function MatchCard({ match, isAdmin, onReport, reportingId, reportError }) {
  const decided = match.status === "completed";
  return (
    <div
      style={{
        background: TOKENS.panel,
        border: `1px solid ${TOKENS.steel}`,
        width: 220,
        marginBottom: 16,
      }}
    >
      <EntrantRow
        entrant={match.entrantA}
        score={match.scoreA}
        isWinner={decided && match.winner === "A"}
        isDecidedMatch={decided}
      />
      <div style={{ height: 1, background: TOKENS.steel }} />
      <EntrantRow
        entrant={match.entrantB}
        score={match.scoreB}
        isWinner={decided && match.winner === "B"}
        isDecidedMatch={decided}
      />
      {match.isBye && (
        <div className="br-mono" style={{ fontSize: 10.5, color: TOKENS.mute, padding: "6px 12px", textTransform: "uppercase" }}>
          Bye — auto-advanced
        </div>
      )}
      {isAdmin && match.status === "ready" && (
        <ReportForm
          match={match}
          onSubmit={onReport}
          submitting={reportingId === match.id}
          error={reportingId === match.id ? reportError : ""}
        />
      )}
    </div>
  );
}

export default function Bracket({ tournamentSlug, isAdmin }) {
  const [state, setState] = useState({ loading: true, generated: false, totalRounds: 0, matches: [] });
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reportingId, setReportingId] = useState(null);
  const [reportError, setReportError] = useState("");

  function load() {
    setState((s) => ({ ...s, loading: true }));
    fetch(`${API_BASE}/${tournamentSlug}/bracket`)
      .then((res) => res.json())
      .then((data) =>
        setState({
          loading: false,
          generated: data.generated,
          totalRounds: data.totalRounds,
          matches: data.matches || [],
        })
      )
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }

  useEffect(load, [tournamentSlug]);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${tournamentSlug}/bracket/generate`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not generate bracket.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset the bracket? All reported results will be lost. This can't be undone.")) return;
    setResetting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/${tournamentSlug}/bracket`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not reset bracket.");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  async function handleReport(matchId, scoreA, scoreB) {
    setReportingId(matchId);
    setReportError("");
    try {
      const res = await fetch(`${API_BASE}/${tournamentSlug}/bracket/matches/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ scoreA, scoreB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not report result.");
      load();
    } catch (err) {
      setReportError(err.message);
    } finally {
      setReportingId(null);
    }
  }

  if (state.loading) {
    return <p style={{ color: TOKENS.mute, fontSize: 14 }}>Loading bracket…</p>;
  }

  if (!state.generated) {
    return (
      <div>
        <style>{bracketStyles}</style>
        <p style={{ color: TOKENS.mute, fontSize: 14, marginBottom: isAdmin ? 14 : 0 }}>
          {isAdmin
            ? "Bracket hasn't been generated yet. This will randomly seed every confirmed entrant into a single-elimination bracket."
            : "Bracket hasn't been generated yet — check back once the tournament starts."}
        </p>
        {isAdmin && (
          <>
            <button className="br-mono" onClick={handleGenerate} disabled={generating} style={generateBtnStyle}>
              {generating ? "Generating…" : "Generate bracket (random seeding)"}
            </button>
            {error && <p className="br-mono" style={{ color: TOKENS.signal, fontSize: 12.5, marginTop: 10 }}>{error}</p>}
          </>
        )}
      </div>
    );
  }

  const rounds = Array.from({ length: state.totalRounds }, (_, i) => i + 1);

  return (
    <div>
      <style>{bracketStyles}</style>
      {isAdmin && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button className="br-mono" onClick={handleReset} disabled={resetting} style={resetBtnStyle}>
            {resetting ? "Resetting…" : "Reset bracket"}
          </button>
        </div>
      )}
      {error && <p className="br-mono" style={{ color: TOKENS.signal, fontSize: 12.5, marginBottom: 14 }}>{error}</p>}
      <div style={{ display: "flex", gap: 28, overflowX: "auto", paddingBottom: 8 }}>
        {rounds.map((round) => (
          <div key={round} style={{ display: "flex", flexDirection: "column", justifyContent: "space-around", flexShrink: 0 }}>
            <div className="br-mono" style={{ fontSize: 11, color: TOKENS.mute, marginBottom: 12, textTransform: "uppercase" }}>
              {round === state.totalRounds ? "Final" : round === state.totalRounds - 1 ? "Semifinal" : `Round ${round}`}
            </div>
            {state.matches
              .filter((m) => m.round === round)
              .map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  isAdmin={isAdmin}
                  onReport={handleReport}
                  reportingId={reportingId}
                  reportError={reportError}
                />
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const bracketStyles = `
  .br-mono { font-family: 'JetBrains Mono', monospace; }
`;

const reportInputStyle = {
  flex: 1,
  minWidth: 0,
  background: TOKENS.panel2,
  border: `1px solid ${TOKENS.steel}`,
  color: TOKENS.off,
  padding: "6px 8px",
  fontSize: 13,
  boxSizing: "border-box",
};

const generateBtnStyle = {
  background: TOKENS.cyan,
  color: TOKENS.ink,
  border: "none",
  padding: "11px 20px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  cursor: "pointer",
};

const resetBtnStyle = {
  background: "transparent",
  color: TOKENS.signal,
  border: `1px solid ${TOKENS.signal}`,
  padding: "8px 16px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  cursor: "pointer",
};