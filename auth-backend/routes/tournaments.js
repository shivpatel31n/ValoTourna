import { Router } from "express";
import crypto from "crypto";
import Tournament from "../models/Tournament.js";
import Registration from "../models/Registration.js";
import User from "../models/User.js";
import Match from "../models/Match.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();

// Counts "entries" (teams count as ONE entry regardless of member count)
async function countEntries(tournamentId) {
  const soloCount = await Registration.countDocuments({
    tournament: tournamentId,
    type: "solo",
  });
  const teamIds = await Registration.distinct("teamId", {
    tournament: tournamentId,
    type: "team",
  });
  return soloCount + teamIds.length;
}

// Confirmed roster size for one team (by teamId) within a tournament —
// used to know how many spots are left before a team is full.
async function countConfirmedRoster(tournamentId, teamId) {
  return Registration.countDocuments({
    tournament: tournamentId,
    teamId,
    status: "confirmed",
  });
}

async function withCounts(tournamentDoc) {
  const t = tournamentDoc.toJSON();
  const teamsCount = await countEntries(tournamentDoc._id);
  t.teamsCount = teamsCount;
  t.spotsLeft = Math.max(0, t.maxTeams - teamsCount);
  return t;
}

function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uniqueSlug(title) {
  const base = slugify(title) || "tournament";
  let slug = base;
  let suffix = 2;
  while (await Tournament.findOne({ slug })) {
    slug = `${base}-${suffix}`;
    suffix++;
  }
  return slug;
}

const EDITABLE_FIELDS = [
  "title",
  "status",
  "format",
  "teamSize",
  "startDate",
  "regDeadline",
  "endDate",
  "maxTeams",
  "prizePool",
  "description",
  "rules",
  "champion",
  "runnerUp",
];

// GET /api/tournaments
router.get("/", async (req, res) => {
  try {
    const tournaments = await Tournament.find().sort({ startDate: 1 });
    const withData = await Promise.all(tournaments.map(withCounts));
    res.status(200).json({ tournaments: withData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch tournaments." });
  }
});

// GET /api/tournaments/:slug
router.get("/:slug", async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });
    const data = await withCounts(tournament);
    res.status(200).json({ tournament: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch tournament." });
  }
});

// GET /api/tournaments/:slug/my-registration — requires login
// Returns the current user's own registration (confirmed or pending),
// plus the full team roster if they're on a team.
router.get("/:slug/my-registration", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const registration = await Registration.findOne({
      tournament: tournament._id,
      user: req.user.id,
    });

    if (!registration) {
      return res.status(200).json({ registration: null, roster: [] });
    }

    let roster = [];
    let pendingRequests = [];
    let spotsLeftOnTeam = null;
    if (registration.type === "team" && registration.teamId) {
      const teamDocs = await Registration.find({
        tournament: tournament._id,
        teamId: registration.teamId,
      }).sort({ isCaptain: -1, createdAt: 1 });
      roster = teamDocs.map((d) => ({
        displayName: d.displayName,
        isCaptain: d.isCaptain,
        status: d.status,
      }));

      if (registration.isCaptain) {
        const confirmedCount = teamDocs.filter((d) => d.status === "confirmed").length;
        spotsLeftOnTeam =
          tournament.teamSize > 1 ? Math.max(0, tournament.teamSize - confirmedCount) : null;
        if (registration.pendingRequests.length > 0) {
          const requesterIds = registration.pendingRequests.map((r) => r.user);
          const requesters = await User.find({ _id: { $in: requesterIds } }).select(
            "username riotName riotTag rank role"
          );
          const requesterMap = new Map(requesters.map((u) => [u._id.toString(), u]));
          pendingRequests = registration.pendingRequests.map((r) => {
            const u = requesterMap.get(r.user.toString());
            return {
              userId: r.user.toString(),
              username: u?.username || "Unknown",
              rank: u?.rank || "",
              role: u?.role || "",
              message: r.message,
              requestedAt: r.requestedAt,
            };
          });
        }
      }
    }

    res.status(200).json({
      registration: registration.toJSON(),
      roster,
      recruiting: registration.isCaptain ? registration.recruiting : undefined,
      pendingRequests,
      spotsLeftOnTeam,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch registration." });
  }
});

// POST /api/tournaments/:slug/register — requires login
router.post("/:slug/register", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    if (tournament.status === "past") {
      return res.status(400).json({ message: "This tournament has already ended." });
    }
    if (new Date(tournament.regDeadline).getTime() <= Date.now()) {
      return res.status(400).json({ message: "Registration for this tournament has closed." });
    }

    const existing = await Registration.findOne({ tournament: tournament._id, user: req.user.id });
    if (existing) {
      return res.status(409).json({ message: "You're already registered for this tournament." });
    }

    const entryCount = await countEntries(tournament._id);
    if (entryCount >= tournament.maxTeams) {
      return res.status(400).json({ message: "This tournament is full." });
    }

    const { type, teamName, teammateUsernames } = req.body;
    if (!["solo", "team"].includes(type)) {
      return res.status(400).json({ message: "Registration type must be 'solo' or 'team'." });
    }

    // ---- SOLO ----
    if (type === "solo") {
      if (tournament.teamSize > 1) {
        return res.status(400).json({ message: "This tournament requires full teams, not solo entries." });
      }
      const registration = await Registration.create({
        tournament: tournament._id,
        user: req.user.id,
        type: "solo",
        displayName: req.user.username,
        status: "confirmed",
      });
      return res.status(201).json({ registration: registration.toJSON() });
    }

    // ---- TEAM ----
    if (!teamName?.trim()) {
      return res.status(400).json({ message: "Team name is required." });
    }

    const usernames = Array.isArray(teammateUsernames)
      ? [...new Set(teammateUsernames.map((u) => u.trim()).filter(Boolean))]
      : [];

    const rosterSize = 1 + usernames.length; // captain + invited teammates
    if (tournament.teamSize > 1 && rosterSize > tournament.teamSize) {
      return res.status(400).json({
        message: `This tournament allows teams of at most ${tournament.teamSize}. You've listed ${rosterSize}.`,
      });
    }

    if (usernames.some((u) => u.toLowerCase() === req.user.username.toLowerCase())) {
      return res.status(400).json({ message: "Don't include yourself in the teammates list." });
    }

    const teammateUsers = await User.find({
      username: { $in: usernames.map((u) => new RegExp(`^${u}$`, "i")) },
    });

    if (teammateUsers.length !== usernames.length) {
      const found = new Set(teammateUsers.map((u) => u.username.toLowerCase()));
      const missing = usernames.filter((u) => !found.has(u.toLowerCase()));
      return res.status(400).json({ message: `Couldn't find these usernames: ${missing.join(", ")}` });
    }

    const alreadyRegistered = await Registration.find({
      tournament: tournament._id,
      user: { $in: teammateUsers.map((u) => u._id) },
    });
    if (alreadyRegistered.length > 0) {
      const ids = new Set(alreadyRegistered.map((r) => r.user.toString()));
      const names = teammateUsers.filter((u) => ids.has(u._id.toString())).map((u) => u.username);
      return res.status(409).json({ message: `Already registered for this tournament: ${names.join(", ")}` });
    }

    const teamId = crypto.randomUUID();

    const captainReg = await Registration.create({
      tournament: tournament._id,
      user: req.user.id,
      type: "team",
      displayName: req.user.username,
      teamName: teamName.trim(),
      teamId,
      isCaptain: true,
      status: "confirmed",
      // Open to join requests by default whenever there's room on the
      // roster — the captain can close it early or reopen it later.
      recruiting: tournament.teamSize > 1,
    });

    await Registration.insertMany(
      teammateUsers.map((u) => ({
        tournament: tournament._id,
        user: u._id,
        type: "team",
        displayName: u.username,
        teamName: teamName.trim(),
        teamId,
        isCaptain: false,
        status: "pending",
        invitedBy: req.user.id,
      }))
    );

    res.status(201).json({ registration: captainReg.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You're already registered for this tournament." });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to register for tournament." });
  }
});

// POST /api/tournaments/:slug/register/respond — accept/decline a team invite
router.post("/:slug/register/respond", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const registration = await Registration.findOne({
      tournament: tournament._id,
      user: req.user.id,
    });

    if (!registration || registration.status !== "pending") {
      return res.status(400).json({ message: "No pending invite found." });
    }

    const { accept } = req.body;
    if (accept) {
      registration.status = "confirmed";
      await registration.save();
      return res.status(200).json({ registration: registration.toJSON() });
    } else {
      await registration.deleteOne();
      return res.status(200).json({ message: "Invite declined." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to respond to invite." });
  }
});

// GET /api/tournaments/:slug/teams — browse team entries registered for
// this tournament, for players looking to join one instead of typing
// teammate usernames themselves. Public (no login required to browse).
router.get("/:slug/teams", async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const captainRegs = await Registration.find({
      tournament: tournament._id,
      type: "team",
      isCaptain: true,
    }).sort({ createdAt: -1 });

    const teams = await Promise.all(
      captainRegs.map(async (r) => {
        const confirmedCount = await countConfirmedRoster(tournament._id, r.teamId);
        const spotsLeft = tournament.teamSize > 1 ? Math.max(0, tournament.teamSize - confirmedCount) : 0;
        return {
          teamId: r.teamId,
          teamName: r.teamName,
          captain: r.displayName,
          rosterSize: confirmedCount,
          maxSize: tournament.teamSize,
          spotsLeft,
          recruiting: r.recruiting && spotsLeft > 0,
        };
      })
    );

    res.status(200).json({ teams });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch teams." });
  }
});

// POST /api/tournaments/:slug/teams/:teamId/request-join — ask to join a
// team that's already registered for this tournament (requires login)
router.post("/:slug/teams/:teamId/request-join", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    if (tournament.status === "past") {
      return res.status(400).json({ message: "This tournament has already ended." });
    }
    if (new Date(tournament.regDeadline).getTime() <= Date.now()) {
      return res.status(400).json({ message: "Registration for this tournament has closed." });
    }

    const captainReg = await Registration.findOne({
      tournament: tournament._id,
      teamId: req.params.teamId,
      isCaptain: true,
    });
    if (!captainReg) return res.status(404).json({ message: "Team not found for this tournament." });

    if (!captainReg.recruiting) {
      return res.status(400).json({ message: "This team isn't accepting join requests right now." });
    }

    const existing = await Registration.findOne({ tournament: tournament._id, user: req.user.id });
    if (existing) {
      return res.status(409).json({ message: "You're already registered for this tournament." });
    }

    const confirmedCount = await countConfirmedRoster(tournament._id, captainReg.teamId);
    if (tournament.teamSize > 1 && confirmedCount >= tournament.teamSize) {
      return res.status(400).json({ message: "This team's roster is already full." });
    }

    if (captainReg.pendingRequests.some((r) => r.user.toString() === req.user.id)) {
      return res.status(409).json({ message: "You've already requested to join this team." });
    }

    const message = (req.body?.message || "").trim();
    captainReg.pendingRequests.push({ user: req.user.id, message });
    await captainReg.save();

    res.status(201).json({ message: "Join request sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send join request." });
  }
});

// POST /api/tournaments/:slug/teams/:teamId/requests/:userId/accept —
// captain accepts a join request, confirming that player onto the roster
router.post("/:slug/teams/:teamId/requests/:userId/accept", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const captainReg = await Registration.findOne({
      tournament: tournament._id,
      teamId: req.params.teamId,
      isCaptain: true,
    });
    if (!captainReg) return res.status(404).json({ message: "Team not found for this tournament." });
    if (captainReg.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the team captain can accept requests." });
    }

    const request = captainReg.pendingRequests.find((r) => r.user.toString() === req.params.userId);
    if (!request) return res.status(404).json({ message: "Join request not found." });

    const confirmedCount = await countConfirmedRoster(tournament._id, captainReg.teamId);
    if (tournament.teamSize > 1 && confirmedCount >= tournament.teamSize) {
      return res.status(400).json({ message: "This team's roster is already full." });
    }

    // The requester might have registered elsewhere in the meantime.
    const alreadyRegistered = await Registration.findOne({
      tournament: tournament._id,
      user: req.params.userId,
    });
    if (alreadyRegistered) {
      captainReg.pendingRequests = captainReg.pendingRequests.filter(
        (r) => r.user.toString() !== req.params.userId
      );
      await captainReg.save();
      return res.status(409).json({ message: "That player has since registered elsewhere." });
    }

    const requester = await User.findById(req.params.userId);
    if (!requester) return res.status(404).json({ message: "That player no longer exists." });

    await Registration.create({
      tournament: tournament._id,
      user: requester._id,
      type: "team",
      displayName: requester.username,
      teamName: captainReg.teamName,
      teamId: captainReg.teamId,
      isCaptain: false,
      status: "confirmed",
    });

    captainReg.pendingRequests = captainReg.pendingRequests.filter(
      (r) => r.user.toString() !== req.params.userId
    );
    const newConfirmedCount = confirmedCount + 1;
    if (tournament.teamSize > 1 && newConfirmedCount >= tournament.teamSize) {
      captainReg.recruiting = false;
    }
    await captainReg.save();

    res.status(200).json({ message: "Player added to your roster." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "That player is already registered for this tournament." });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to accept request." });
  }
});

// POST /api/tournaments/:slug/teams/:teamId/requests/:userId/reject —
// captain declines a join request
router.post("/:slug/teams/:teamId/requests/:userId/reject", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const captainReg = await Registration.findOne({
      tournament: tournament._id,
      teamId: req.params.teamId,
      isCaptain: true,
    });
    if (!captainReg) return res.status(404).json({ message: "Team not found for this tournament." });
    if (captainReg.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the team captain can reject requests." });
    }

    captainReg.pendingRequests = captainReg.pendingRequests.filter(
      (r) => r.user.toString() !== req.params.userId
    );
    await captainReg.save();

    res.status(200).json({ message: "Request declined." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reject request." });
  }
});

// PATCH /api/tournaments/:slug/teams/:teamId/recruiting — captain opens or
// closes their roster to unsolicited join requests
router.patch("/:slug/teams/:teamId/recruiting", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const captainReg = await Registration.findOne({
      tournament: tournament._id,
      teamId: req.params.teamId,
      isCaptain: true,
    });
    if (!captainReg) return res.status(404).json({ message: "Team not found for this tournament." });
    if (captainReg.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the team captain can change this." });
    }

    captainReg.recruiting = Boolean(req.body?.recruiting);
    await captainReg.save();

    res.status(200).json({ recruiting: captainReg.recruiting });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update recruiting status." });
  }
});

// DELETE /api/tournaments/:slug/register — requires login
router.delete("/:slug/register", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const registration = await Registration.findOne({
      tournament: tournament._id,
      user: req.user.id,
    });
    if (!registration) return res.status(200).json({ message: "Not registered." });

    if (registration.type === "team" && registration.isCaptain && registration.teamId) {
      // captain leaving disbands the whole team
      await Registration.deleteMany({ tournament: tournament._id, teamId: registration.teamId });
    } else {
      await registration.deleteOne();
    }

    res.status(200).json({ message: "Left tournament." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to leave tournament." });
  }
});

// POST /api/tournaments — create a tournament (admin only)
router.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, status, format, teamSize, startDate, regDeadline, endDate, maxTeams, prizePool, description, rules } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: "Title is required." });
    if (!teamSize || teamSize < 1) return res.status(400).json({ message: "A valid team size is required." });
    if (!startDate) return res.status(400).json({ message: "Start date is required." });
    if (!regDeadline) return res.status(400).json({ message: "Registration deadline is required." });
    if (!maxTeams || maxTeams < 1) return res.status(400).json({ message: "A valid max teams is required." });

    const slug = await uniqueSlug(title);

    const tournament = await Tournament.create({
      slug,
      title: title.trim(),
      status: status || "upcoming",
      format: format || "",
      teamSize,
      startDate,
      regDeadline,
      endDate: endDate || null,
      maxTeams,
      prizePool: prizePool || "",
      description: description || "",
      rules: Array.isArray(rules) ? rules : [],
    });

    const data = await withCounts(tournament);
    res.status(201).json({ tournament: data });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Failed to create tournament." });
  }
});

// PATCH /api/tournaments/:slug — edit a tournament (admin only)
router.patch("/:slug", requireAuth, requireAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) tournament[field] = req.body[field];
    }

    await tournament.save();
    const data = await withCounts(tournament);
    res.status(200).json({ tournament: data });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Failed to update tournament." });
  }
});

// DELETE /api/tournaments/:slug — delete a tournament (admin only)
// Also cleans up every registration tied to it, so nothing is left
// pointing at a tournament that no longer exists.
router.delete("/:slug", requireAuth, requireAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(200).json({ message: "Tournament not found." });

    await tournament.deleteOne();

    try {
      await Registration.deleteMany({ tournament: tournament._id });
    } catch (cleanupErr) {
      console.error("Registration cleanup after tournament delete failed:", cleanupErr);
    }

    res.status(200).json({ message: "Tournament deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete tournament." });
  }
});

// ---------------------------------------------------------------------------
// Bracket (single elimination)
// ---------------------------------------------------------------------------

// Fisher–Yates shuffle — used to randomly seed entrants into round 1.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// One entrant per solo registration, one entrant per distinct team (using
// the captain's registration for the team's display name/id) — mirrors the
// same counting rule as countEntries() above so "spotsLeft" and the actual
// bracket always agree on who counts as an entry.
async function buildEntrants(tournamentId) {
  const soloRegs = await Registration.find({ tournament: tournamentId, type: "solo" });
  const captainRegs = await Registration.find({
    tournament: tournamentId,
    type: "team",
    isCaptain: true,
  });

  const soloEntrants = soloRegs.map((r) => ({
    type: "solo",
    refId: r.user.toString(),
    name: r.displayName,
  }));
  const teamEntrants = captainRegs.map((r) => ({
    type: "team",
    refId: r.teamId,
    name: r.teamName,
  }));

  return [...soloEntrants, ...teamEntrants];
}

// Places shuffled entrants into round-1 slots such that no match ends up
// with two byes (possible if byes were simply appended at the end — see
// PR discussion). Filling slot A from the first `pairs` entrants guarantees
// slot A is always a real entrant (byesNeeded is always < pairs), so every
// bye pairs with a real opponent instead of clustering.
function seedRoundOne(entrants, pairs) {
  const shuffled = shuffle(entrants);
  const slotsA = shuffled.slice(0, pairs);
  const slotsB = shuffled.slice(pairs);
  return Array.from({ length: pairs }, (_, i) => ({
    entrantA: slotsA[i] || null,
    entrantB: slotsB[i] || null,
  }));
}

// Advances a completed/bye match's winner into the next round's match,
// filling slot A or B depending on whether this match was even/odd indexed.
// If that next match now has both slots filled, flips it from "pending" to
// "ready" so it shows up as playable.
async function propagateWinner(match) {
  const totalRounds = await Match.findOne({ tournament: match.tournament })
    .sort({ round: -1 })
    .select("round");
  if (!totalRounds || match.round >= totalRounds.round) return; // final match, nothing to propagate to

  const winningEntrant = match.winner === "A" ? match.entrantA : match.entrantB;
  const nextMatch = await Match.findOne({
    tournament: match.tournament,
    round: match.round + 1,
    matchIndex: Math.floor(match.matchIndex / 2),
  });
  if (!nextMatch) return;

  if (match.matchIndex % 2 === 0) {
    nextMatch.entrantA = winningEntrant;
  } else {
    nextMatch.entrantB = winningEntrant;
  }
  if (nextMatch.entrantA && nextMatch.entrantB) {
    nextMatch.status = "ready";
  }
  await nextMatch.save();
}

// Attaches each team entrant's confirmed roster (just display names — full
// player identity isn't needed here) so the bracket can show who's playing,
// not just the team name. Solo entrants don't need this; the entrant name
// already is the player.
async function attachRosters(matches, tournamentId) {
  const teamIds = new Set();
  for (const m of matches) {
    if (m.entrantA?.type === "team") teamIds.add(m.entrantA.refId);
    if (m.entrantB?.type === "team") teamIds.add(m.entrantB.refId);
  }
  if (teamIds.size === 0) return matches.map((m) => m.toJSON());

  const rosterRegs = await Registration.find({
    tournament: tournamentId,
    teamId: { $in: Array.from(teamIds) },
    status: "confirmed",
  }).sort({ isCaptain: -1, createdAt: 1 });

  const rosterByTeam = new Map();
  for (const r of rosterRegs) {
    if (!rosterByTeam.has(r.teamId)) rosterByTeam.set(r.teamId, []);
    rosterByTeam.get(r.teamId).push(r.displayName);
  }

  return matches.map((m) => {
    const json = m.toJSON();
    if (json.entrantA?.type === "team") json.entrantA.members = rosterByTeam.get(json.entrantA.refId) || [];
    if (json.entrantB?.type === "team") json.entrantB.members = rosterByTeam.get(json.entrantB.refId) || [];
    return json;
  });
}

// GET /api/tournaments/:slug/bracket
router.get("/:slug/bracket", async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const matches = await Match.find({ tournament: tournament._id }).sort({ round: 1, matchIndex: 1 });
    const totalRounds = matches.reduce((max, m) => Math.max(max, m.round), 0);

    res.status(200).json({
      generated: matches.length > 0,
      totalRounds,
      matches: await attachRosters(matches, tournament._id),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch bracket." });
  }
});

// POST /api/tournaments/:slug/bracket/generate — admin only
router.post("/:slug/bracket/generate", requireAuth, requireAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const existing = await Match.exists({ tournament: tournament._id });
    if (existing) {
      return res.status(409).json({ message: "Bracket already generated. Reset it first to regenerate." });
    }

    const entrants = await buildEntrants(tournament._id);
    if (entrants.length < 2) {
      return res.status(400).json({ message: "Need at least 2 confirmed entrants to generate a bracket." });
    }

    const bracketSize = nextPowerOfTwo(entrants.length);
    const pairs = bracketSize / 2;
    const totalRounds = Math.log2(bracketSize);

    const roundOneSlots = seedRoundOne(entrants, pairs);

    const docs = [];
    // Round 1 — real matches, with byes auto-resolved.
    roundOneSlots.forEach((slot, i) => {
      const isBye = !slot.entrantB;
      docs.push({
        tournament: tournament._id,
        round: 1,
        matchIndex: i,
        entrantA: slot.entrantA,
        entrantB: slot.entrantB,
        isBye,
        winner: isBye ? "A" : null,
        status: isBye ? "completed" : "ready",
      });
    });
    // Rounds 2..totalRounds — empty placeholders, filled in as earlier
    // rounds complete.
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = bracketSize / 2 ** round;
      for (let i = 0; i < matchesInRound; i++) {
        docs.push({
          tournament: tournament._id,
          round,
          matchIndex: i,
          entrantA: null,
          entrantB: null,
          status: "pending",
        });
      }
    }

    await Match.insertMany(docs);

    // Propagate any round-1 byes up the bracket now that every round's
    // placeholder rows exist to receive them.
    const byeMatches = await Match.find({ tournament: tournament._id, round: 1, isBye: true });
    for (const m of byeMatches) {
      await propagateWinner(m);
    }

    const matches = await Match.find({ tournament: tournament._id }).sort({ round: 1, matchIndex: 1 });
    res.status(201).json({ generated: true, totalRounds, matches: matches.map((m) => m.toJSON()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate bracket." });
  }
});

// DELETE /api/tournaments/:slug/bracket — admin only, resets the bracket
// entirely (e.g. entrants changed, or seeding needs to be redone) and
// clears any champion/runnerUp that had been set from a completed final.
router.delete("/:slug/bracket", requireAuth, requireAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    await Match.deleteMany({ tournament: tournament._id });
    tournament.champion = null;
    tournament.runnerUp = null;
    await tournament.save();

    res.status(200).json({ message: "Bracket reset." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reset bracket." });
  }
});

// PATCH /api/tournaments/:slug/bracket/matches/:matchId — admin only,
// reports a score and advances the winner up the bracket. If this was the
// final match, also sets the tournament's champion/runnerUp.
router.patch("/:slug/bracket/matches/:matchId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) return res.status(404).json({ message: "Tournament not found." });

    const match = await Match.findOne({ _id: req.params.matchId, tournament: tournament._id });
    if (!match) return res.status(404).json({ message: "Match not found." });

    if (match.status !== "ready") {
      return res.status(400).json({
        message:
          match.status === "completed"
            ? "This match has already been reported."
            : "This match isn't ready yet — one or both entrants haven't been decided.",
      });
    }

    const { scoreA, scoreB } = req.body;
    if (
      typeof scoreA !== "number" ||
      typeof scoreB !== "number" ||
      scoreA < 0 ||
      scoreB < 0 ||
      scoreA === scoreB
    ) {
      return res.status(400).json({ message: "Scores must be two different non-negative numbers." });
    }

    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.winner = scoreA > scoreB ? "A" : "B";
    match.status = "completed";
    await match.save();

    const totalRoundDoc = await Match.findOne({ tournament: tournament._id }).sort({ round: -1 }).select("round");
    const isFinal = totalRoundDoc && match.round === totalRoundDoc.round;

    if (isFinal) {
      const winnerEntrant = match.winner === "A" ? match.entrantA : match.entrantB;
      const loserEntrant = match.winner === "A" ? match.entrantB : match.entrantA;
      tournament.champion = winnerEntrant?.name || null;
      tournament.runnerUp = loserEntrant?.name || null;
      if (tournament.status !== "past") tournament.status = "past";
      await tournament.save();
    } else {
      await propagateWinner(match);
    }

    const data = await withCounts(tournament);
    res.status(200).json({ tournament: data, match: match.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to report match result." });
  }
});

export default router;