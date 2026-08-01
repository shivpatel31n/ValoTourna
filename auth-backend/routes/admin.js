import { Router } from "express";
import User from "../models/User.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";

const router = Router();

// Every route here requires both a valid login and isAdmin — requireAdmin
// re-checks isAdmin fresh from the DB on each request (see authMiddleware.js).
router.use(requireAuth, requireAdmin);

// GET /api/admin/users?search=&page=&limit=
router.get("/users", async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
    const search = (req.query.search || "").trim();

    const filter = search
      ? {
          $or: [
            { username: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { riotName: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    res.status(200).json({
      users: users.map((u) => u.toJSON()),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch users." });
  }
});

// POST /api/admin/users/:id/ban { reason }
router.post("/users/:id/ban", async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You can't ban your own account." });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });

    // Prevents one admin from locking out another by mistake or dispute —
    // revoking admin access (a DB-only action, by design) is the
    // intentional path for that, not a ban.
    if (target.isAdmin) {
      return res.status(400).json({ message: "Admins can't be banned through this panel." });
    }

    target.banned = true;
    target.banReason = (req.body?.reason || "").trim();
    target.bannedAt = new Date();
    await target.save();

    res.status(200).json({ user: target.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to ban user." });
  }
});

// POST /api/admin/users/:id/unban
router.post("/users/:id/unban", async (req, res) => {
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: "User not found." });

    target.banned = false;
    target.banReason = "";
    target.bannedAt = null;
    await target.save();

    res.status(200).json({ user: target.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to unban user." });
  }
});

export default router;