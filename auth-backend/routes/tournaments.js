import { Router } from "express";
import Tournament from "../models/Tournament.js";
import Registration from "../models/Registration.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// Adds a live registration count + spots-left to a tournament, matching the
// shape the frontend used to get from the old hardcoded `teams` array.
async function withCounts(tournamentDoc) {
  const t = tournamentDoc.toJSON();
  const teamsCount = await Registration.countDocuments({ tournament: tournamentDoc._id });
  t.teamsCount = teamsCount;
  t.spotsLeft = Math.max(0, t.maxTeams - teamsCount);
  return t;
}

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
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found." });
    }
    const data = await withCounts(tournament);
    res.status(200).json({ tournament: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch tournament." });
  }
});

// GET /api/tournaments/:slug/my-registration — requires login
router.get("/:slug/my-registration", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found." });
    }
    const registration = await Registration.findOne({
      tournament: tournament._id,
      user: req.user.id,
    });
    res.status(200).json({ registration: registration ? registration.toJSON() : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch registration." });
  }
});

// POST /api/tournaments/:slug/register — requires login
router.post("/:slug/register", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found." });
    }

    if (tournament.status === "past") {
      return res.status(400).json({ message: "This tournament has already ended." });
    }
    if (new Date(tournament.regDeadline).getTime() <= Date.now()) {
      return res.status(400).json({ message: "Registration for this tournament has closed." });
    }

    const currentCount = await Registration.countDocuments({ tournament: tournament._id });
    if (currentCount >= tournament.maxTeams) {
      return res.status(400).json({ message: "This tournament is full." });
    }

    const existing = await Registration.findOne({ tournament: tournament._id, user: req.user.id });
    if (existing) {
      return res.status(409).json({ message: "You're already registered for this tournament." });
    }

    const { type, teamName, members } = req.body;
    if (!["solo", "team"].includes(type)) {
      return res.status(400).json({ message: "Registration type must be 'solo' or 'team'." });
    }
    if (type === "team" && !teamName?.trim()) {
      return res.status(400).json({ message: "Team name is required." });
    }

    const registration = await Registration.create({
      tournament: tournament._id,
      user: req.user.id,
      type,
      displayName: type === "solo" ? req.user.username : "",
      teamName: type === "team" ? teamName.trim() : "",
      members: type === "team" && Array.isArray(members) ? members.filter(Boolean) : [],
    });

    res.status(201).json({ registration: registration.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You're already registered for this tournament." });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to register for tournament." });
  }
});

// DELETE /api/tournaments/:slug/register — requires login
router.delete("/:slug/register", requireAuth, async (req, res) => {
  try {
    const tournament = await Tournament.findOne({ slug: req.params.slug });
    if (!tournament) {
      return res.status(404).json({ message: "Tournament not found." });
    }
    await Registration.findOneAndDelete({ tournament: tournament._id, user: req.user.id });
    res.status(200).json({ message: "Left tournament." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to leave tournament." });
  }
});

export default router;