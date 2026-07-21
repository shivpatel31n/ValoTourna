import { Router } from "express";
import ScrimRequest, { RANK_ORDER } from "../models/ScrimRequest.js";
import Team from "../models/Team.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { postToDiscord } from "../services/discordWebhook.js";

const router = Router();

const REGIONS = ["NA", "EU", "APAC", "KR", "LATAM", "BR"];
const PUBLIC_USER_FIELDS = "username riotName riotTag rank region role";
const PUBLIC_TEAM_FIELDS = "name tag region";

function populateScrim(query) {
  return query
    .populate("team", PUBLIC_TEAM_FIELDS)
    .populate("postedBy", PUBLIC_USER_FIELDS)
    .populate("matchedWith", PUBLIC_TEAM_FIELDS)
    .populate("requests.team", PUBLIC_TEAM_FIELDS)
    .populate("requests.requestedBy", PUBLIC_USER_FIELDS);
}

function rankIndex(rank) {
  return RANK_ORDER.indexOf(rank);
}

function findCaptainedTeam(userId) {
  return Team.findOne({ captain: userId });
}

// GET /api/scrims — browse open scrim posts, filter by region/rank
router.get("/", async (req, res) => {
  try {
    const { region, rank } = req.query;
    const filter = { status: "open" };
    if (region) filter.region = region;

    let scrims = await populateScrim(ScrimRequest.find(filter).sort({ createdAt: -1 }));

    if (rank && RANK_ORDER.includes(rank)) {
      const idx = rankIndex(rank);
      scrims = scrims.filter((s) => rankIndex(s.minRank) <= idx && idx <= rankIndex(s.maxRank));
    }

    res.status(200).json({ scrims: scrims.map((s) => s.toJSON()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch scrims." });
  }
});

// GET /api/scrims/mine — scrim posts belonging to the current user's team (requires login)
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const team = await findCaptainedTeam(req.user.id);
    if (!team) return res.status(200).json({ scrims: [], team: null });

    const scrims = await populateScrim(ScrimRequest.find({ team: team._id }).sort({ createdAt: -1 }));
    res.status(200).json({ scrims: scrims.map((s) => s.toJSON()), team: team.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch your scrims." });
  }
});

// GET /api/scrims/:id
router.get("/:id", async (req, res) => {
  try {
    const scrim = await populateScrim(ScrimRequest.findById(req.params.id));
    if (!scrim) return res.status(404).json({ message: "Scrim post not found." });
    res.status(200).json({ scrim: scrim.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch scrim post." });
  }
});

// POST /api/scrims — post a scrim request (captain only, one open post per team)
router.post("/", requireAuth, async (req, res) => {
  try {
    const team = await findCaptainedTeam(req.user.id);
    if (!team) {
      return res.status(403).json({ message: "Only a team captain can post a scrim request. Create a team first." });
    }

    const existing = await ScrimRequest.findOne({ team: team._id, status: "open" });
    if (existing) {
      return res.status(409).json({ message: "Your team already has an open scrim post. Cancel it first to post a new one." });
    }

    const { minRank, maxRank, availability, notes } = req.body;
    const region = req.body.region || team.region;

    if (!REGIONS.includes(region)) {
      return res.status(400).json({ message: "A valid region is required." });
    }
    if (!RANK_ORDER.includes(minRank) || !RANK_ORDER.includes(maxRank)) {
      return res.status(400).json({ message: "A valid rank range is required." });
    }
    if (rankIndex(minRank) > rankIndex(maxRank)) {
      return res.status(400).json({ message: "Minimum rank can't be higher than maximum rank." });
    }
    if (!availability?.trim()) {
      return res.status(400).json({ message: "Let other teams know your availability." });
    }

    const scrim = await ScrimRequest.create({
      team: team._id,
      postedBy: req.user.id,
      region,
      minRank,
      maxRank,
      availability: availability.trim(),
      notes: notes?.trim() || "",
    });

    const populated = await populateScrim(ScrimRequest.findById(scrim._id));
    res.status(201).json({ scrim: populated.toJSON() });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Failed to create scrim post." });
  }
});

// PATCH /api/scrims/:id — edit (posting team's captain only, only while open)
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const scrim = await ScrimRequest.findById(req.params.id);
    if (!scrim) return res.status(404).json({ message: "Scrim post not found." });

    const team = await Team.findById(scrim.team);
    if (!team || team.captain.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the posting team's captain can edit this." });
    }
    if (scrim.status !== "open") {
      return res.status(400).json({ message: "This scrim post is no longer open." });
    }

    const { region, minRank, maxRank, availability, notes } = req.body;

    if (region !== undefined) {
      if (!REGIONS.includes(region)) return res.status(400).json({ message: "Invalid region." });
      scrim.region = region;
    }
    if (minRank !== undefined || maxRank !== undefined) {
      const newMin = minRank ?? scrim.minRank;
      const newMax = maxRank ?? scrim.maxRank;
      if (!RANK_ORDER.includes(newMin) || !RANK_ORDER.includes(newMax)) {
        return res.status(400).json({ message: "Invalid rank." });
      }
      if (rankIndex(newMin) > rankIndex(newMax)) {
        return res.status(400).json({ message: "Minimum rank can't be higher than maximum rank." });
      }
      scrim.minRank = newMin;
      scrim.maxRank = newMax;
    }
    if (availability !== undefined) {
      if (!availability.trim()) return res.status(400).json({ message: "Availability can't be empty." });
      scrim.availability = availability.trim();
    }
    if (notes !== undefined) scrim.notes = notes.trim();

    await scrim.save();
    const populated = await populateScrim(ScrimRequest.findById(scrim._id));
    res.status(200).json({ scrim: populated.toJSON() });
  } catch (err) {
    if (err.name === "ValidationError") return res.status(400).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: "Failed to update scrim post." });
  }
});

// DELETE /api/scrims/:id — cancel (posting team's captain only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const scrim = await ScrimRequest.findById(req.params.id);
    if (!scrim) return res.status(200).json({ message: "Scrim post not found." });

    const team = await Team.findById(scrim.team);
    if (!team || team.captain.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the posting team's captain can cancel this." });
    }

    await scrim.deleteOne();
    res.status(200).json({ message: "Scrim post cancelled." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to cancel scrim post." });
  }
});

// POST /api/scrims/:id/request — another team's captain challenges this post
router.post("/:id/request", requireAuth, async (req, res) => {
  try {
    const scrim = await ScrimRequest.findById(req.params.id);
    if (!scrim) return res.status(404).json({ message: "Scrim post not found." });
    if (scrim.status !== "open") {
      return res.status(400).json({ message: "This scrim post is no longer open." });
    }

    const myTeam = await findCaptainedTeam(req.user.id);
    if (!myTeam) {
      return res.status(403).json({ message: "Only a team captain can request a scrim." });
    }
    if (myTeam._id.toString() === scrim.team.toString()) {
      return res.status(400).json({ message: "You can't request a scrim against your own team." });
    }
    if (scrim.requests.some((r) => r.team.toString() === myTeam._id.toString())) {
      return res.status(409).json({ message: "You've already requested this scrim." });
    }

    const message = (req.body?.message || "").trim();
    scrim.requests.push({
      team: myTeam._id,
      requestedBy: req.user.id,
      message,
    });
    await scrim.save();

    const populated = await populateScrim(ScrimRequest.findById(scrim._id));

    // Best-effort notification — never blocks or fails the actual request.
    const postingTeam = await Team.findById(scrim.team).select("name tag").catch(() => null);
    const rankRange = scrim.minRank === scrim.maxRank ? scrim.minRank : `${scrim.minRank}–${scrim.maxRank}`;
    postToDiscord(
      `🎯 **${myTeam.name}** requested a scrim against **${postingTeam?.name || "a team"}** ` +
        `(${scrim.region}, ${rankRange}).` +
        (message ? `\n> "${message}"` : "")
    );

    res.status(201).json({ scrim: populated.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send scrim request." });
  }
});

// POST /api/scrims/:id/requests/:teamId/accept — posting captain accepts a challenger
router.post("/:id/requests/:teamId/accept", requireAuth, async (req, res) => {
  try {
    const scrim = await ScrimRequest.findById(req.params.id);
    if (!scrim) return res.status(404).json({ message: "Scrim post not found." });

    const team = await Team.findById(scrim.team);
    if (!team || team.captain.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the posting team's captain can accept a scrim request." });
    }
    if (scrim.status !== "open") {
      return res.status(400).json({ message: "This scrim post is no longer open." });
    }

    const request = scrim.requests.find((r) => r.team.toString() === req.params.teamId);
    if (!request) return res.status(404).json({ message: "Scrim request not found." });

    scrim.status = "matched";
    scrim.matchedWith = req.params.teamId;
    scrim.requests = [];
    await scrim.save();

    const populated = await populateScrim(ScrimRequest.findById(scrim._id));
    res.status(200).json({ scrim: populated.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to accept scrim request." });
  }
});

// POST /api/scrims/:id/requests/:teamId/reject — posting captain declines a challenger
router.post("/:id/requests/:teamId/reject", requireAuth, async (req, res) => {
  try {
    const scrim = await ScrimRequest.findById(req.params.id);
    if (!scrim) return res.status(404).json({ message: "Scrim post not found." });

    const team = await Team.findById(scrim.team);
    if (!team || team.captain.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the posting team's captain can decline a scrim request." });
    }

    scrim.requests = scrim.requests.filter((r) => r.team.toString() !== req.params.teamId);
    await scrim.save();

    const populated = await populateScrim(ScrimRequest.findById(scrim._id));
    res.status(200).json({ scrim: populated.toJSON() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to decline scrim request." });
  }
});

export default router;