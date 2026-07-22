import { Router } from "express";
import Team from "../models/Team.js";
import ScrimRequest from "../models/ScrimRequest.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { postToDiscord } from "../services/discordWebhook.js";

const router = Router();

const ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"];
const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];

// Fields safe to expose about a user when they show up on a team roster
const PUBLIC_USER_FIELDS = "username riotName riotTag rank region role";

function populateTeam(query) {
  return query
    .populate("captain", PUBLIC_USER_FIELDS)
    .populate("members.user", PUBLIC_USER_FIELDS)
    .populate("pendingRequests.user", PUBLIC_USER_FIELDS);
}

function findUserTeam(userId) {
  return Team.findOne({
    $or: [{ captain: userId }, { "members.user": userId }],
  });
}

function isCaptain(team, userId) {
  return team.captain.toString() === userId;
}

function isMember(team, userId) {
  return (
    isCaptain(team, userId) ||
    team.members.some((m) => m.user.toString() === userId)
  );
}

// GET /api/teams — browse teams, filter by region/role-needed/recruiting
router.get("/", async (req, res) => {
  try {
    const { region, role, recruiting } = req.query;
    const filter = {};
    if (region) filter.region = region;
    if (role) filter.rolesNeeded = role;
    if (recruiting === "true") filter.recruiting = true;

    const teams = await populateTeam(Team.find(filter).sort({ createdAt: -1 }));
    res.status(200).json({ teams: teams.map((t) => t.toJSON()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch teams." });
  }
});

// GET /api/teams/mine — the current user's own team, if any (requires login)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const team = await populateTeam(findUserTeam(req.user.id));
    res.status(200).json({ team: team ? team.toJSON() : null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch your team." });
  }
});

// GET /api/teams/:id
router.get("/:id", async (req, res) => {
  try {
    const team = await populateTeam(Team.findById(req.params.id));
    if (!team) return res.status(404).json({ message: "Team not found." });
    res.status(200).json({ team: team.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch team." });
  }
});

// POST /api/teams — create a team (requires login, one team per user)
router.post("/", requireAuth, async (req, res) => {
  try {
    const existing = await findUserTeam(req.user.id);
    if (existing) {
      return res.status(409).json({ message: "You're already on a team. Leave it first to create a new one." });
    }

    const { name, tag, region, rolesNeeded, schedule, description, maxSize } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Team name is required." });
    }
    if (!REGIONS.includes(region)) {
      return res.status(400).json({ message: "A valid region is required." });
    }
    const cleanRoles = Array.isArray(rolesNeeded) ? rolesNeeded.filter((r) => ROLES.includes(r)) : [];

    const team = await Team.create({
      name: name.trim(),
      tag: tag?.trim() || "",
      captain: req.user.id,
      region,
      rolesNeeded: cleanRoles,
      schedule: schedule?.trim() || "",
      description: description?.trim() || "",
      maxSize: maxSize ? Math.min(Math.max(Number(maxSize), 1), 10) : 5,
    });

    const populated = await populateTeam(Team.findById(team._id));
    res.status(201).json({ team: populated.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A team with that name already exists." });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to create team." });
  }
});

// PATCH /api/teams/:id — edit team details (captain only)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (!isCaptain(team, req.user.id)) {
      return res.status(403).json({ message: "Only the team captain can edit this team." });
    }

    const { name, tag, region, rolesNeeded, schedule, description, maxSize, recruiting } = req.body;

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "Team name can't be empty." });
      team.name = name.trim();
    }
    if (tag !== undefined) team.tag = tag.trim();
    if (region !== undefined) {
      if (!REGIONS.includes(region)) return res.status(400).json({ message: "Invalid region." });
      team.region = region;
    }
    if (rolesNeeded !== undefined) {
      team.rolesNeeded = Array.isArray(rolesNeeded) ? rolesNeeded.filter((r) => ROLES.includes(r)) : [];
    }
    if (schedule !== undefined) team.schedule = schedule.trim();
    if (description !== undefined) team.description = description.trim();
    if (maxSize !== undefined) {
      const size = Math.min(Math.max(Number(maxSize), 1), 10);
      if (size < team.members.length + 1) {
        return res.status(400).json({ message: "Max size can't be smaller than your current roster." });
      }
      team.maxSize = size;
    }
    if (recruiting !== undefined) team.recruiting = Boolean(recruiting);

    await team.save();
    const populated = await populateTeam(Team.findById(team._id));
    res.status(200).json({ team: populated.toJSON() });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A team with that name already exists." });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    console.error(err);
    res.status(500).json({ message: "Failed to update team." });
  }
});

// DELETE /api/teams/:id — disband team (captain only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(200).json({ message: "Team not found." });
    if (!isCaptain(team, req.user.id)) {
      return res.status(403).json({ message: "Only the team captain can disband this team." });
    }

    await team.deleteOne();

    // Clean up any scrim data that referenced this team so nothing is left
    // pointing at a team that no longer exists. The disband itself already
    // succeeded above, so a failure here shouldn't be reported as a failed
    // disband — just log it.
    try {
      await Promise.all([
        // This team's own scrim posts (open or matched) are no longer valid.
        ScrimRequest.deleteMany({ team: team._id }),
        // If this team was accepted as someone else's opponent, reopen that
        // post instead of leaving it "matched" against a team that's gone.
        ScrimRequest.updateMany(
          { matchedWith: team._id },
          { $set: { status: "open", matchedWith: null } }
        ),
        // Remove any pending challenge this team had sent on other teams' posts.
        ScrimRequest.updateMany(
          { "requests.team": team._id },
          { $pull: { requests: { team: team._id } } }
        ),
      ]);
    } catch (cleanupErr) {
      console.error("Scrim cleanup after team disband failed:", cleanupErr);
    }

    res.status(200).json({ message: "Team disbanded." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to disband team." });
  }
});

// POST /api/teams/:id/request-join — ask to join a team (requires login)
router.post("/:id/request-join", requireAuth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found." });

    if (!team.recruiting) {
      return res.status(400).json({ message: "This team isn't recruiting right now." });
    }
    if (isMember(team, req.user.id)) {
      return res.status(400).json({ message: "You're already on this team." });
    }
    if (team.members.length + 1 >= team.maxSize) {
      return res.status(400).json({ message: "This team's roster is full." });
    }
    const alreadyOnTeam = await findUserTeam(req.user.id);
    if (alreadyOnTeam) {
      return res.status(409).json({ message: "You're already on a different team. Leave it first." });
    }
    if (team.pendingRequests.some((r) => r.user.toString() === req.user.id)) {
      return res.status(409).json({ message: "You've already requested to join this team." });
    }

    const message = (req.body?.message || "").trim();
    team.pendingRequests.push({ user: req.user.id, message });
    await team.save();

    const populated = await populateTeam(Team.findById(team._id));

    // Best-effort notification — never blocks or fails the actual request.
    // Uses a separate webhook/channel from scrim requests.
    postToDiscord(
      `🙋 **${req.user.username}** requested to join **${team.name}**` +
        (message ? `\n> "${message}"` : ""),
      process.env.DISCORD_TEAM_WEBHOOK_URL
    );

    res.status(201).json({ team: populated.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send join request." });
  }
});

// POST /api/teams/:id/requests/:userId/accept — captain accepts a join request
router.post("/:id/requests/:userId/accept", requireAuth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (!isCaptain(team, req.user.id)) {
      return res.status(403).json({ message: "Only the team captain can accept requests." });
    }

    const request = team.pendingRequests.find((r) => r.user.toString() === req.params.userId);
    if (!request) return res.status(404).json({ message: "Join request not found." });

    if (team.members.length + 1 >= team.maxSize) {
      return res.status(400).json({ message: "This team's roster is full." });
    }

    // The requester might have joined another team in the meantime.
    const otherTeam = await findUserTeam(req.params.userId);
    if (otherTeam) {
      team.pendingRequests = team.pendingRequests.filter((r) => r.user.toString() !== req.params.userId);
      await team.save();
      return res.status(409).json({ message: "That player has since joined another team." });
    }

    team.members.push({ user: req.params.userId });
    team.pendingRequests = team.pendingRequests.filter((r) => r.user.toString() !== req.params.userId);
    await team.save();

    const populated = await populateTeam(Team.findById(team._id));
    res.status(200).json({ team: populated.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to accept request." });
  }
});

// POST /api/teams/:id/requests/:userId/reject — captain rejects a join request
router.post("/:id/requests/:userId/reject", requireAuth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found." });
    if (!isCaptain(team, req.user.id)) {
      return res.status(403).json({ message: "Only the team captain can reject requests." });
    }

    team.pendingRequests = team.pendingRequests.filter((r) => r.user.toString() !== req.params.userId);
    await team.save();

    const populated = await populateTeam(Team.findById(team._id));
    res.status(200).json({ team: populated.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to reject request." });
  }
});

// DELETE /api/teams/:id/members/:userId — leave (self) or kick (captain only)
router.delete("/:id/members/:userId", requireAuth, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: "Team not found." });

    const targetId = req.params.userId;
    const isSelf = targetId === req.user.id;

    if (isCaptain(team, targetId)) {
      return res.status(400).json({ message: "The captain can't leave — disband the team instead." });
    }
    if (!isSelf && !isCaptain(team, req.user.id)) {
      return res.status(403).json({ message: "Only the captain can remove other members." });
    }

    const before = team.members.length;
    team.members = team.members.filter((m) => m.user.toString() !== targetId);
    if (team.members.length === before) {
      return res.status(404).json({ message: "That player isn't on this team." });
    }

    await team.save();
    const populated = await populateTeam(Team.findById(team._id));
    res.status(200).json({ team: populated.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update roster." });
  }
});

export default router;