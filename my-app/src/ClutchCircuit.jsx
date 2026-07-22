import React, { useState, useEffect, useRef, useCallback } from "react";
import reynaBg from "./assets/reyna.png";
import { Link } from "react-router-dom";
import { TOURNAMENTS } from "./tournamentsData";

// Homepage only teases upcoming/live tournaments — full list + past results
// live on the /tournaments page.
const FEATURED_TOURNAMENTS = TOURNAMENTS.filter((t) => t.status !== "past").slice(0, 6);

const DISCORD_URL = "https://discord.gg/7RCDt277Y";

// ---------- TOKENS (mirrors the original :root variables) ----------
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

// ---------- SMALL PRESENTATIONAL PIECES ----------

function Badge({ status }) {
  const styles = {
    upcoming: { background: "rgba(62, 214, 197, 0.12)", color: TOKENS.cyan },
    live: { background: "rgba(217, 58, 103, 0.14)", color: TOKENS.signal },
    past: { background: "rgba(139, 144, 150, 0.12)", color: TOKENS.mute },
  };
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
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

function TournamentCard({ t }) {
  const [hover, setHover] = useState(false);
  const spotsLabel = `${t.teams.length}/${t.maxTeams} ${t.teamSize === 1 ? "players" : "teams"}`;
  const dateLabel =
    t.status === "live"
      ? "In progress"
      : `Starts ${new Date(t.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  return (
    <Link
      to={`/tournaments/${t.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: TOKENS.panel,
        border: `1px solid ${hover ? TOKENS.cyan : TOKENS.steel}`,
        clipPath:
          "polygon(0 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%)",
        padding: 26,
        transition: "border-color .15s, transform .15s",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 18,
        }}
      >
        <Badge status={t.status} />
      </div>
      <h3 style={{ fontSize: 22, marginBottom: 6 }}>{t.title}</h3>
      <div style={{ color: TOKENS.mute, fontSize: 13, marginBottom: 18 }}>
        {t.format}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: `1px solid ${TOKENS.steel}`,
          paddingTop: 16,
          marginTop: 6,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: TOKENS.mute,
          }}
        >
          {dateLabel}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12,
            color: TOKENS.mute,
          }}
        >
          {spotsLabel}
        </span>
      </div>
    </Link>
  );
}

// ---------- REVEAL-ON-SCROLL WRAPPER (replaces IntersectionObserver JS) ----------
function Reveal({ children, as: Tag = "section", ...rest }) {
  const ref = useRef(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(true);
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      {...rest}
      style={{
        ...rest.style,
        opacity: active ? 1 : 0,
        transform: active ? "translateY(0)" : "translateY(50px)",
        transition: "all .7s ease",
      }}
    >
      {children}
    </Tag>
  );
}

// ---------- MAIN COMPONENT ----------
export default function ClutchCircuit({ user, onProfileClick, onRequireAuth }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [onlineMembers, setOnlineMembers] = useState(null);

  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  useEffect(() => {
    const fetchOnlineMembers = async () => {
      try {
        const res = await fetch("https://discord.com/api/guilds/1521820339577819239/widget.json");
        const data = await res.json();
        setOnlineMembers(data.presence_count);
      } catch (err) {
        console.error("Failed to fetch Discord widget:", err);
      }
    };
    fetchOnlineMembers();
    const interval = setInterval(fetchOnlineMembers,30000);
    return ()=>clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        background: TOKENS.ink,
        color: TOKENS.off,
        fontFamily: "'Inter', sans-serif",
        overflowX: "hidden",
        minHeight: "100vh",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .cc-h1, .cc-h2, .cc-h3 { font-family: 'Rajdhani', sans-serif; text-transform: uppercase; letter-spacing: 0.02em; }
        .cc-mono { font-family: 'JetBrains Mono', monospace; }
        .cc-link { color: inherit; text-decoration: none; }
        .cc-btn { display:inline-flex; align-items:center; gap:8px; padding:11px 22px; font-size:14px; font-weight:600; text-decoration: none; letter-spacing:0.03em; text-transform:uppercase; border:1px solid ${TOKENS.steel}; background:transparent; color:${TOKENS.off}; clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px); transition: all .15s; cursor:pointer; }
        .cc-btn-primary { background:${TOKENS.signal}; border-color:${TOKENS.signal}; color:#0B0D0F; }
        .cc-btn-primary:hover { background:#ff5a6b; }
        .cc-btn:not(.cc-btn-primary):hover { border-color:${TOKENS.cyan}; color:${TOKENS.cyan}; }
        .cc-nav-links a { font-size:14px; font-weight:500; color:${TOKENS.mute}; letter-spacing:0.03em; text-transform:uppercase; transition:color .15s; }
        .cc-nav-links a:hover { color:${TOKENS.off}; }
        @keyframes cc-pulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }
        .cc-grid { display:grid; grid-template-columns: repeat(3, 1fr); gap:20px; }
        .cc-customs-grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; }
        .cc-split { display:grid; grid-template-columns: 1fr 1fr; gap:60px; align-items:center; }
        @media (max-width: 860px) {
          .cc-nav-links { display:none; }
          .cc-menu-btn { display:block !important; }
          .cc-grid { grid-template-columns: 1fr; }
          .cc-customs-grid { grid-template-columns: 1fr; }
          .cc-split { grid-template-columns: 1fr; gap:36px; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>

      {/* ---------- HEADER ---------- */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(11, 13, 15, 0.9)",
          backdropFilter: "blur(8px)",
          borderBottom: `1px solid ${TOKENS.steel}`,
        }}
      >
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 32px",
            maxWidth: 1180,
            margin: "0 auto",
          }}
        >
          <button
            className="cc-menu-btn"
            aria-label="Open Menu"
            onClick={toggleMenu}
            style={{
              display: "none",
              background: "none",
              border: "none",
              color: "white",
              fontSize: 28,
            }}
          >
            ☰
          </button>

          <div
            className="cc-h3"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontWeight: 700,
              fontSize: 20,
              letterSpacing: "0.04em",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                background: TOKENS.signal,
                clipPath: "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
                display: "inline-block",
              }}
            />
            Clutch Circuit
          </div>

          <div className="cc-nav-links" style={{ display: "flex", gap: 36, alignItems: "center" }}>
            <a className="cc-link" href="#tournaments">Tournaments</a>
            <Link className="cc-link" to="/teams">Teams</Link>
            <Link className="cc-link" to="/scrims">Scrims</Link>
            <a className="cc-link" href="#customs">Customs</a>
            <a className="cc-link" href="#discord">Discord</a>
            <Link className="cc-link" to="/players">Find Players</Link>
          </div>

          {/* <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="cc-btn cc-btn-primary"
          >
            Join Discord
          </a> */}

          <button
            onClick={onProfileClick}
            className="cc-btn"
            style={{ marginLeft: 12 }}
          >
            {user ? user.username : "Profile"}
          </button>

        </nav>

        {menuOpen && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              background: TOKENS.panel,
              borderTop: `1px solid ${TOKENS.steel}`,
            }}
          >
            {["tournaments", "teams", "scrims", "customs", "discord"].map((id) =>
              id === "teams" || id === "scrims" ? (
                <Link
                  key={id}
                  className="cc-link"
                  to={`/${id}`}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "18px 32px",
                    borderBottom: `1px solid ${TOKENS.steel}`,
                    textTransform: "capitalize",
                  }}
                >
                  {id}
                </Link>
              ) : (
                <a
                  key={id}
                  className="cc-link"
                  href={`#${id}`}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "18px 32px",
                    borderBottom: `1px solid ${TOKENS.steel}`,
                    textTransform: "capitalize",
                  }}
                >
                  {id}
                </a>
              )
            )}
          </div>
        )}
      </header>

      {/* ---------- HERO ---------- */}
      <section
        style={{
          position: "relative",
          padding: "120px 32px 100px",
          overflow: "hidden",
          borderBottom: `1px solid rgba(42, 46, 51, 0.4)`,
          backgroundImage: `linear-gradient(to right, rgba(11,13,15,0.97) 0%, rgba(11,13,15,0.90) 30%, rgba(11,13,15,0.65) 60%, rgba(11,13,15,0.35) 100%), url(${reynaBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center right",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* bottom fade so hero blends into the next section, like .hero::after */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 180,
            background: `linear-gradient(to bottom, rgba(11,13,15,0), ${TOKENS.ink})`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ position: "relative", zIndex: 2, maxWidth: 640 }}>
            <div
              className="cc-mono"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: TOKENS.cyan,
                letterSpacing: "0.08em",
                marginBottom: 22,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  background: TOKENS.cyan,
                  borderRadius: "50%",
                  animation: "cc-pulse 1.6s ease-in-out infinite",
                  display: "inline-block",
                }}
              />
              VALORANT COMMUNITY HUB
            </div>

            <h1
              className="cc-h1"
              style={{
                fontSize: "clamp(40px, 6vw, 68px)",
                lineHeight: 1.02,
                fontWeight: 700,
                marginBottom: 22,
              }}
            >
              Find your squad.
              <br />
              Climb the <span style={{ color: TOKENS.signal }}>circuit.</span>
            </h1>

            <p
              style={{
                fontSize: 17,
                color: TOKENS.mute,
                lineHeight: 1.6,
                marginBottom: 34,
                maxWidth: 480,
              }}
            >
              A community hub for Valorant players who want more than solo
              queue — build a Premier team, enter tournaments, or drop into
              customs with people who actually show up.
            </p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 44 }}>
              {!user ? (
                <button onClick={onRequireAuth} className="cc-btn cc-btn-primary" style={{ fontFamily: "inherit" }}>
                  Get started
                </button>
              ) : (
                <a href="#tournaments" className="cc-btn cc-btn-primary">
                  Browse tournaments
                </a>
              )}
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="cc-btn">
                Join the Discord
              </a>
            </div>

            <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
              {[
                { num: "2,140", label: "Members" },
                { num: "86", label: "Active teams" },
                { num: "14", label: "Open tournaments" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="cc-h3" style={{ fontSize: 28, fontWeight: 700, color: TOKENS.off }}>
                    {s.num}
                  </div>
                  <div
                    className="cc-mono"
                    style={{
                      fontSize: 11,
                      color: TOKENS.mute,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- TOURNAMENTS ---------- */}
      <section
        id="tournaments"
        style={{
          padding: "90px 0",
          borderBottom: `1px solid ${TOKENS.steel}`,
          background: `linear-gradient(to bottom, #0B0D0F, #111417)`,
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 32px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 46,
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <span
                className="cc-mono"
                style={{
                  fontSize: 12,
                  color: TOKENS.signal,
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                  display: "block",
                }}
              >
                // COMPETE
              </span>
              <h2 className="cc-h2" style={{ fontSize: 32, fontWeight: 700 }}>
                Tournaments
              </h2>
            </div>
            <p style={{ color: TOKENS.mute, maxWidth: 420, fontSize: 15, lineHeight: 1.6 }}>
              Bracketed cups and Premier-affiliated events. Solo sign-up or
              bring your full roster.
            </p>
          </div>

          <div className="cc-grid">
            {FEATURED_TOURNAMENTS.map((t) => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <Link to="/tournaments" className="cc-btn">
              View all tournaments
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- TEAMS / PREMIER ---------- */}
      <Reveal
        id="teams"
        style={{
          padding: "90px 0",
          borderBottom: `1px solid ${TOKENS.steel}`,
          background: `linear-gradient(to bottom, #0B0D0F, #111417)`,
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 32px" }}>
          <div className="cc-split">
            <div>
              <span
                className="cc-mono"
                style={{
                  fontSize: 12,
                  color: TOKENS.signal,
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                  display: "block",
                }}
              >
                // PREMIER
              </span>
              <h2 className="cc-h2" style={{ fontSize: 32, marginBottom: 18 }}>
                Build a team that actually sticks together
              </h2>
              <p style={{ color: TOKENS.mute, lineHeight: 1.7, marginBottom: 26, fontSize: 15 }}>
                Premier rewards consistency more than raw aim. Find teammates
                who play your schedule, fill your role gaps, and stay for the
                season — not just for one lobby.
              </p>
              <ul style={{ listStyle: "none", marginBottom: 30 }}>
                {[
                  "Create a team page with your rank, roles needed, and play schedule",
                  "Browse open rosters or post yourself as a free agent",
                  "Lock your roster and register it for Premier-affiliated cups",
                ].map((item, i) => (
                  <li
                    key={item}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: "12px 0",
                      borderTop: `1px solid ${TOKENS.steel}`,
                      borderBottom: i === 2 ? `1px solid ${TOKENS.steel}` : "none",
                      fontSize: 14,
                      color: TOKENS.off,
                    }}
                  >
                    <span
                      className="cc-mono"
                      style={{ color: TOKENS.signal, fontSize: 13, flexShrink: 0 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link to="/teams/new" className="cc-btn cc-btn-primary">
                Start a team
              </Link>
            </div>

            <div
              style={{
                background: TOKENS.panel,
                border: `1px solid ${TOKENS.steel}`,
                clipPath: "polygon(24px 0, 100% 0, 100% 100%, 0 100%, 0 24px)",
                padding: 28,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${TOKENS.steel}`,
                }}
              >
                <div>
                  <h3 className="cc-h3" style={{ fontSize: 18 }}>
                    Nullpoint Academy
                  </h3>
                  <span
                    className="cc-mono"
                    style={{ fontSize: 12, color: TOKENS.cyan, letterSpacing: "0.05em" }}
                  >
                    PREMIER — DIVISION 2
                  </span>
                </div>
                <span
                  className="cc-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.05em",
                    padding: "4px 10px",
                    textTransform: "uppercase",
                    background: "rgba(62, 214, 197, 0.12)",
                    color: TOKENS.cyan,
                  }}
                >
                  2 open
                </span>
              </div>

              {[
                { role: "DUELIST", name: "kessu", rank: "Immortal 1" },
                { role: "CONTROLLER", name: "vane.gg", rank: "Ascendant 3" },
                { role: "INITIATOR", name: "brix", rank: "Ascendant 2" },
                { role: "SENTINEL", name: "Open slot", rank: "—", empty: true },
                { role: "FLEX", name: "Open slot", rank: "—", empty: true },
              ].map((r) => (
                <div
                  key={r.role}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "11px 0",
                    borderBottom: `1px solid ${TOKENS.panel2}`,
                    fontSize: 14,
                    color: r.empty ? TOKENS.mute : TOKENS.off,
                  }}
                >
                  <span className="cc-mono" style={{ fontSize: 11, color: TOKENS.mute }}>
                    {r.role}
                  </span>
                  <span style={{ fontWeight: 500, fontStyle: r.empty ? "italic" : "normal", color: r.empty ? TOKENS.mute : TOKENS.off }}>
                    {r.name}
                  </span>
                  <span className="cc-mono" style={{ color: TOKENS.cyan, fontSize: 12 }}>
                    {r.rank}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------- CUSTOMS ---------- */}
      <section
        id="customs"
        style={{
          padding: "90px 0",
          borderBottom: `1px solid ${TOKENS.steel}`,
          background: `linear-gradient(to bottom, #0B0D0F, #111417)`,
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 32px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 46,
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <span
                className="cc-mono"
                style={{
                  fontSize: 12,
                  color: TOKENS.signal,
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                  display: "block",
                }}
              >
                // CASUAL
              </span>
              <h2 className="cc-h2" style={{ fontSize: 32, fontWeight: 700 }}>
                Customs, no pressure
              </h2>
            </div>
            <p style={{ color: TOKENS.mute, maxWidth: 420, fontSize: 15, lineHeight: 1.6 }}>
              Not every night needs to be ranked. Drop into a lobby for the
              fun of it.
            </p>
          </div>

          <div className="cc-customs-grid">
            {[
              {
                n: "01",
                title: "Pick-up lobbies",
                body: "Post your rank and role in the queue channel and get matched into a 10-stack — no waiting on a full tournament bracket.",
                link: "https://discord.gg/x2AGYXjJw",
                linkLabel: "Join the queue →",
                external: true,
              },
              {
                n: "02",
                title: "Scrim finder",
                body: "Post your team's rank range and availability, or browse open scrim posts from other squads looking for a practice match.",
                link: "/scrims",
                linkLabel: "Find a scrim →",
              },
            ].map((c) => (
              <div
                key={c.n}
                style={{
                  padding: 26,
                  border: `1px solid ${TOKENS.steel}`,
                  background: TOKENS.panel2,
                }}
              >
                <span
                  className="cc-mono"
                  style={{
                    color: TOKENS.signal,
                    fontSize: 13,
                    marginBottom: 14,
                    display: "block",
                  }}
                >
                  {c.n}
                </span>
                <h3 className="cc-h3" style={{ fontSize: 19, marginBottom: 10 }}>
                  {c.title}
                </h3>
                <p style={{ color: TOKENS.mute, fontSize: 14, lineHeight: 1.6 }}>
                  {c.body}
                </p>
                {c.link && (
                  c.external ? (
                    <a
                      href={c.link}
                      target="_blank"
                      rel="noreferrer"
                      className="cc-link"
                      style={{ fontSize: 13, color: TOKENS.cyan, display: "inline-block", marginTop: 14 }}
                    >
                      {c.linkLabel}
                    </a>
                  ) : (
                    <Link
                      to={c.link}
                      className="cc-link"
                      style={{ fontSize: 13, color: TOKENS.cyan, display: "inline-block", marginTop: 14 }}
                    >
                      {c.linkLabel}
                    </Link>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- DISCORD CTA ---------- */}
      <section
        id="discord"
        style={{
          position: "relative",
          padding: "80px 32px",
          background: TOKENS.panel,
          borderTop: `1px solid ${TOKENS.steel}`,
          borderBottom: `1px solid ${TOKENS.steel}`,
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(${TOKENS.steel} 1px, transparent 1px), linear-gradient(90deg, ${TOKENS.steel} 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
            opacity: 0.15,
            WebkitMaskImage: "radial-gradient(ellipse at center, black, transparent 70%)",
            maskImage: "radial-gradient(ellipse at center, black, transparent 70%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 2, maxWidth: 560, margin: "0 auto" }}>
          <div
            className="cc-mono"
            style={{
              display: "inline-flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: TOKENS.cyan,
              letterSpacing: "0.08em",
              marginBottom: 22,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                background: TOKENS.cyan,
                borderRadius: "50%",
                animation: "cc-pulse 1.6s ease-in-out infinite",
                display: "inline-block",
              }}
            />
            COORDINATE IN DISCORD
          </div>
          <h2 className="cc-h2" style={{ fontSize: 34, marginBottom: 14 }}>
            The site finds it. Discord is where you play it.
          </h2>
          <p style={{ color: TOKENS.mute, marginBottom: 32, fontSize: 15 }}>
            Build a team, post a scrim, or register for a tournament — all
            right here on the site, with your rank pulled straight from your
            Riot ID. Once you're matched up, Discord is where you actually
            schedule the match, hop in voice, and meet the rest of the
            community.
          </p>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="cc-btn cc-btn-primary">
            Join the Discord server
          </a>
          <div
            className="cc-mono"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: TOKENS.mute,
              marginTop: 26,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                background: TOKENS.cyan,
                borderRadius: "50%",
                animation: "cc-pulse 1.6s ease-in-out infinite",
                display: "inline-block",
              }}
            />
            {onlineMembers === null ? "Loading..." : `${onlineMembers} members online now`}
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer style={{ padding: "40px 32px" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span className="cc-mono" style={{ fontSize: 12, color: TOKENS.mute }}>
            CLUTCH CIRCUIT — fan-run community, not affiliated with Riot Games
          </span>
          <div style={{ display: "flex", gap: 24 }}>
            <a className="cc-link" href="#tournaments" style={{ fontSize: 13, color: TOKENS.mute }}>
              Tournaments
            </a>
            <a className="cc-link" href="#teams" style={{ fontSize: 13, color: TOKENS.mute }}>
              Teams
            </a>
            <a className="cc-link" href="#customs" style={{ fontSize: 13, color: TOKENS.mute }}>
              Customs
            </a>
            <a
              className="cc-link"
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 13, color: TOKENS.mute }}
            >
              Discord
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}