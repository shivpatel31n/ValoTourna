import express from "express";
import User from "../models/User.js";
import Team from "../models/Team.js";
import Tournament from "../models/Tournament.js";

const router = express.Router();

// Simple in-memory cache so a burst of page loads doesn't hammer Discord's
// API -- presence counts don't need to be more real-time than this anyway.
let discordCache = { data: null, fetchedAt: 0 };
const DISCORD_CACHE_TTL_MS = 60_000;

async function getDiscordOnlineCount() {
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) return null;

  const now = Date.now();
  if (discordCache.data !== null && now - discordCache.fetchedAt < DISCORD_CACHE_TTL_MS) {
    return discordCache.data;
  }

  try {
    const res = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`);
    if (!res.ok) {
      // e.g. widget disabled, bad guild id -- don't cache failures as hard
      // 0s, just report unavailable so the frontend can hide the stat.
      discordCache = { data: null, fetchedAt: now };
      return null;
    }
    const data = await res.json();
    const count = typeof data.presence_count === "number" ? data.presence_count : null;
    discordCache = { data: count, fetchedAt: now };
    return count;
  } catch (err) {
    console.error("Discord widget fetch failed:", err.message);
    discordCache = { data: null, fetchedAt: now };
    return null;
  }
}

router.get("/", async (req, res) => {
  try {
    const [members, activeTeams, openTournaments, discordOnline] = await Promise.all([
      User.countDocuments(),
      Team.countDocuments(),
      Tournament.countDocuments({
        status: "upcoming",
        regDeadline: { $gte: new Date() },
      }),
      getDiscordOnlineCount(),
    ]);

    res.json({ members, activeTeams, openTournaments, discordOnline });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

export default router;