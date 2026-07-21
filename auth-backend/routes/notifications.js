import { Router } from "express";
import Team from "../models/Team.js";
import ScrimRequest from "../models/ScrimRequest.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// GET /api/notifications/summary — pending items needing this user's
// attention: team join requests and scrim requests on anything they
// captain. Polled by the notification bell in the UI.
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const team = await Team.findOne({ captain: req.user.id });

    if (!team) {
      return res.status(200).json({
        count: 0,
        teamJoinRequests: 0,
        scrimRequests: 0,
        teamId: null,
        openScrimId: null,
      });
    }

    const teamJoinRequests = team.pendingRequests.length;

    // A team can only have one open scrim post at a time (enforced on
    // creation), so this is safe to link directly to.
    const openScrim = await ScrimRequest.findOne({ team: team._id, status: "open" }).select("requests");
    const scrimRequests = openScrim?.requests.length || 0;

    res.status(200).json({
      count: teamJoinRequests + scrimRequests,
      teamJoinRequests,
      scrimRequests,
      teamId: team._id.toString(),
      openScrimId: openScrim ? openScrim._id.toString() : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch notifications." });
  }
});

export default router;