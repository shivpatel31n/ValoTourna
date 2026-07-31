import { Router } from "express";
import Team from "../models/Team.js";
import ScrimRequest from "../models/ScrimRequest.js";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// GET /api/notifications/summary — a combined badge count: pending items
// needing this user's attention as a captain (team join requests, scrim
// requests), plus unread outcome notifications (accepted/rejected/matched)
// from decisions others made about their own requests. Polled by the bell.
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const team = await Team.findOne({ captain: req.user.id });

    let teamJoinRequests = 0;
    let scrimRequests = 0;
    let teamId = null;
    let openScrimId = null;

    if (team) {
      teamJoinRequests = team.pendingRequests.length;
      teamId = team._id.toString();

      // A team can only have one open scrim post at a time (enforced on
      // creation), so this is safe to link directly to.
      const openScrim = await ScrimRequest.findOne({ team: team._id, status: "open" }).select("requests");
      scrimRequests = openScrim?.requests.length || 0;
      openScrimId = openScrim ? openScrim._id.toString() : null;
    }

    const unreadNotifications = await Notification.countDocuments({ user: req.user.id, read: false });

    res.status(200).json({
      count: teamJoinRequests + scrimRequests + unreadNotifications,
      teamJoinRequests,
      scrimRequests,
      unreadNotifications,
      teamId,
      openScrimId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications." });
  }
});

// GET /api/notifications — recent outcome notifications (accepted,
// rejected, matched) for the dropdown feed, newest first.
router.get("/", requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.status(200).json({ notifications: notifications.map((n) => n.toJSON()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications." });
  }
});

// POST /api/notifications/read-all — clears the unread badge once the
// person has opened the dropdown and seen what's there.
router.post("/read-all", requireAuth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.status(200).json({ message: "Marked all as read." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update notifications." });
  }
});

export default router;