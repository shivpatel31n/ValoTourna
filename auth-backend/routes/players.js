import { Router } from "express";
import User from "../models/User.js";
import Registration from "../models/Registration.js";
import Tournament from "../models/Tournament.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { fetchRiotRank } from "../services/riotRank.js";

const router = Router();

function serializeUser(user) {
  return {
    id: user._id.toString(),
    username: user.username,
    email: user.email,
    riotName: user.riotName,
    riotTag: user.riotTag,
    region: user.region,
    rank: user.rank,
    rankUpdatedAt: user.rankUpdatedAt,
    role: user.role,
    lookingForTeam: user.lookingForTeam,
  };
}

// GET /api/players?rank=Immortal 1&role=Duelist&region=NA
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.rank) filter.rank = req.query.rank;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.region) filter.region = req.query.region;

    const users = await User.find(filter).sort({ createdAt: -1 });
    const players = users.map(serializeUser);

    res.status(200).json({ players });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch players." });
  }
});

// GET /api/players/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Player not found." });
    }
    return res.json({ player: serializeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not load profile." });
  }
});

// PATCH /api/players/me
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { role, lookingForTeam } = req.body;
    const update = {};
    if (role !== undefined) update.role = role;
    if (lookingForTeam !== undefined) update.lookingForTeam = lookingForTeam;

    const user = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({ message: "Player not found." });
    }
    return res.json({ player: serializeUser(user) });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    return res.status(500).json({ message: "Could not update profile." });
  }
});

// POST /api/players/me/refresh-rank
router.post("/me/refresh-rank", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Player not found." });
    }

    let rank, region;
    try {
      ({ rank, region } = await fetchRiotRank(user.riotName, user.riotTag));
    } catch (riotErr) {
      return res.status(400).json({ message: riotErr.message });
    }

    user.rank = rank;
    user.region = region;
    user.rankUpdatedAt = new Date();
    await user.save();

    return res.json({ player: serializeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not refresh rank." });
  }
});

// GET /api/players/me/history
router.get("/me/history", requireAuth, async (req, res) => {
  try {
    const registrations = await Registration.find({ user: req.user.id }).lean();

    const tournamentIds = registrations.map((r) => r.tournament);
    const tournaments = await Tournament.find({ _id: { $in: tournamentIds } }).lean();
    const tournamentMap = new Map(tournaments.map((t) => [t._id.toString(), t]));

    const history = registrations
      .map((r) => {
        const t = tournamentMap.get(r.tournament.toString());
        if (!t) return null;
        return {
          registration: {
            id: r._id.toString(),
            type: r.type,
            teamName: r.teamName,
            status: r.status,
          },
          tournament: {
            id: t.slug,
            title: t.title,
            status: t.status,
            startDate: t.startDate,
          },
        };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.tournament.startDate) - new Date(a.tournament.startDate));

    return res.json({ history });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not load tournament history." });
  }
});

export default router;