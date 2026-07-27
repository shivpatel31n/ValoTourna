import cron from "node-cron";
import User from "../models/User.js";
import { fetchRiotRank } from "./riotRank.js";

// HenrikDev rate limit budget:
// - Basic key: 30 requests/min. Advanced key: 90 requests/min.
// - Each user refresh costs 2 requests (account lookup + MMR lookup), not 1.
// - Assuming Basic (safer default): 30/min ÷ 2 calls per user = 15 users/min max.
// Read lazily inside the function (not as a module-level constant) so it
// picks up .env correctly regardless of import order — see discordWebhook.js
// for the exact bug this avoids.
function getDelayMs() {
  return Number(process.env.RANK_REFRESH_DELAY_MS) || 4500; // ~13 users/min
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Refreshes every user's rank, one at a time, with a delay between each to
// respect the shared HenrikDev rate limit. Never throws — a failure on one
// user is logged and skipped, the run continues for everyone else.
export async function runRankRefresh() {
  const startedAt = Date.now();
  let succeeded = 0;
  let failed = 0;

  console.log("[rank-refresh] Starting nightly rank refresh...");

  let users;
  try {
    users = await User.find({}, "_id riotName riotTag username");
  } catch (err) {
    console.error("[rank-refresh] Could not load users, aborting run:", err.message);
    return;
  }

  for (const user of users) {
    try {
      const { rank, region } = await fetchRiotRank(user.riotName, user.riotTag);
      await User.findByIdAndUpdate(user._id, {
        rank,
        region,
        rankUpdatedAt: new Date(),
      });
      succeeded++;
    } catch (err) {
      failed++;
      console.error(
        `[rank-refresh] Failed for ${user.username} (${user.riotName}#${user.riotTag}):`,
        err.message
      );
    }

    await sleep(getDelayMs());
  }

  const seconds = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `[rank-refresh] Done in ${seconds}s — ${succeeded} succeeded, ${failed} failed, ${users.length} total.`
  );
}

// Schedules the job to run once a day. Wrapped so a crash inside the job
// can never take down the rest of the server — this runs in-process
// alongside the live site, not as a separate worker.
export function scheduleRankRefresh() {
  const schedule = process.env.RANK_REFRESH_CRON || "0 4 * * *"; // 4am daily by default
  const timezone = process.env.RANK_REFRESH_TIMEZONE || "UTC";

  cron.schedule(
    schedule,
    () => {
      runRankRefresh().catch((err) => {
        // Belt-and-suspenders: runRankRefresh already catches per-user
        // errors internally, but this guarantees an unexpected bug in the
        // job itself still can't crash the server.
        console.error("[rank-refresh] Unexpected error during scheduled run:", err);
      });
    },
    { timezone }
  );

  console.log(`[rank-refresh] Scheduled: "${schedule}" (${timezone})`);
}