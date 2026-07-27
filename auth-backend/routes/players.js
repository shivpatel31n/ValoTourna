import { Router } from "express";
import User from "../models/User.js";
import Registration from "../models/Registration.js";
import Tournament from "../models/Tournament.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { fetchRiotRank, fetchRecentMatches } from "../services/riotRank.js";

const router = Router();

// Includes email — only ever used for a user's OWN profile (the /me
// routes), never for anything another visitor can see.
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

// Same shape, minus email — used anywhere another visitor can see this
// user's data: the players list and individual public profiles.
function serializePublicUser(user) {
  const { email, ...rest } = serializeUser(user);
  return rest;
}

// Very small in-memory cache for match history lookups — keeps repeat
// profile views within a short window from re-hitting HenrikDev's shared
// rate limit. Fine for a single-server app; would need a real cache
// (Redis etc.) if this ever runs across multiple instances.
const MATCH_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const matchCache = new Map(); // userId -> { data, expiresAt }

// GET /api/players?rank=Immortal 1&role=Duelist&region=NA
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.rank) filter.rank = req.query.rank;
    if (req.query.role) filter.role = req.query.role;
    if (req.query.region) filter.region = req.query.region;

    const users = await User.find(filter).sort({ createdAt: -1 });
    const players = users.map(serializePublicUser);

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
    // isAdmin is deliberately left out of serializeUser() since that's
    // shared with the public players list — only include it here, on the
    // user's own private profile fetch.
    return res.json({ player: { ...serializeUser(user), isAdmin: user.isAdmin } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not load profile." });
  }
});

// PATCH /api/players/me
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { username, role, lookingForTeam } = req.body;
    const update = {};

    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 24) {
        return res.status(400).json({ message: "Username must be 3–24 characters." });
      }
      // Case-insensitive uniqueness check, excluding the current user, so
      // saving your own unchanged username doesn't falsely collide.
      const existing = await User.findOne({
        _id: { $ne: req.user.id },
        username: trimmed,
      }).collation({ locale: "en", strength: 2 });
      if (existing) {
        return res.status(409).json({ message: "That username is already taken." });
      }
      update.username = trimmed;
    }
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
    if (err.code === 11000) {
      return res.status(409).json({ message: "That username is already taken." });
    }
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

// GET /api/players/:id — public profile (no email), for anyone clicking
// through from the Find Players page.
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Player not found." });
    }
    return res.json({ player: serializePublicUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Could not load player." });
  }
});

// GET /api/players/:id/matches — recent competitive match history for the
// public profile page. Cached briefly per user to avoid hammering
// HenrikDev's shared rate limit on repeat/refresh visits.
router.get("/:id/matches", async (req, res) => {
  try {
    const cached = matchCache.get(req.params.id);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ matches: cached.data });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "Player not found." });
    }
    if (!user.riotName || !user.riotTag) {
      return res.json({ matches: [] });
    }

    const matches = await fetchRecentMatches(user.riotName, user.riotTag, user.region, 10);

    matchCache.set(req.params.id, { data: matches, expiresAt: Date.now() + MATCH_CACHE_TTL_MS });

    return res.json({ matches });
  } catch (err) {
    console.error(err);
    // A failed match-history fetch shouldn't feel like a broken page —
    // return an empty list so the profile still renders everything else.
    return res.json({ matches: [] });
  }
});

export default router;