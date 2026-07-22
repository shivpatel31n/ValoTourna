import { Router } from "express";
import crypto from "crypto";
import Tournament from "../models/Tournament.js";
import Registration from "../models/Registration.js";
import User from "../models/User.js";
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
    }

    res.status(200).json({ registration: registration.toJSON(), roster });
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
    if (tournament.teamSize > 1 && rosterSize !== tournament.teamSize) {
      return res.status(400).json({
        message: `This tournament requires teams of exactly ${tournament.teamSize}. You've listed ${rosterSize}.`,
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

export default router;