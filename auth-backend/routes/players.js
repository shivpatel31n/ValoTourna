import { Router } from "express";
import User from "../models/User.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];

// GET /api/players?rank=Immortal 1&role=Duelist
router.get("/", async (req, res) => {
  try {
    const filter = {};
    if (req.query.rank) filter.rank = req.query.rank;
    if (req.query.role) filter.role = req.query.role;

    const users = await User.find(filter).sort({ createdAt: -1 });
    const players = users.map((u) => u.toJSON());

    res.status(200).json({ players });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch players." });
  }
});

// GET /api/players/me — get your own profile (requires login)
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.status(200).json({ player: user.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch profile." });
  }
});

// PATCH /api/players/me — update your own rank/role/looking-for-team (requires login)
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { rank, role, lookingForTeam } = req.body;

    if (role !== undefined && role !== "" && !ROLES.includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const updates = {};
    if (rank !== undefined) updates.rank = rank;
    if (role !== undefined) updates.role = role;
    if (lookingForTeam !== undefined) updates.lookingForTeam = Boolean(lookingForTeam);

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({ player: user.toJSON() });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to update profile." });
  }
});

export default router;