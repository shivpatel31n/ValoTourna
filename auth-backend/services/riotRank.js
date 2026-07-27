// Looks up a player's current competitive rank via HenrikDev's unofficial
// Valorant API (https://docs.henrikdev.xyz), given only a Riot ID
// (name + tagline) — no manual region selection required.
//
// NOTE: this is an unofficial, community-run API — not affiliated with Riot
// Games. It requires a free API key from https://api.henrikdev.xyz/dashboard/
// (join their Discord first, then generate a key), set as HENRIKDEV_API_KEY.

const BASE_URL = "https://api.henrikdev.xyz/valorant";

function authHeaders() {
  return process.env.HENRIKDEV_API_KEY
    ? { Authorization: process.env.HENRIKDEV_API_KEY }
    : {};
}

async function henrikGet(path) {
  let response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: authHeaders(),
    });
  } catch (networkErr) {
    throw new Error(
      "Couldn't reach the rank lookup service. Please try again."
    );
  }

  const json = await response.json().catch(() => null);

  if (response.status === 404 || json?.status === 404) {
    return { notFound: true };
  }

  if (!response.ok || !json || (json.status && json.status !== 200)) {
    const message = json?.errors?.[0]?.message;
    throw new Error(
      message || "Couldn't verify that Riot ID right now. Please try again."
    );
  }

  return { data: json.data };
}

/**
 * @param {string} riotName - the part before the '#' (e.g. "kessu")
 * @param {string} riotTag - the part after the '#' (e.g. "1234")
 * @returns {Promise<{ rank: string, region: string }>}
 */
export async function fetchRiotRank(riotName, riotTag) {
  const cleanName = riotName.trim();
  const cleanTag = riotTag.trim().replace(/^#/, "");

  if (!cleanName || !cleanTag) {
    throw new Error("Riot ID name and tagline are required.");
  }

  // Step 1: Resolve the Riot account to determine its region.
  const accountRes = await henrikGet(
    `/v1/account/${encodeURIComponent(cleanName)}/${encodeURIComponent(
      cleanTag
    )}`
  );

  if (accountRes.notFound) {
    throw new Error(
      `No Valorant account found for ${cleanName}#${cleanTag}.`
    );
  }

  const region = accountRes.data?.region;

  if (!region) {
    throw new Error(
      "Couldn't determine that account's region. Please try again."
    );
  }

  // Step 2: Fetch the player's competitive rank.
  const mmrRes = await henrikGet(
    `/v2/mmr/${region}/${encodeURIComponent(cleanName)}/${encodeURIComponent(
      cleanTag
    )}`
  );

  // If the account has never played Competitive (or Competitive is locked),
  // HenrikDev returns 404. Treat this as "Unranked" instead of an error.
  if (mmrRes.notFound) {
    return {
      rank: "Unranked",
      region: toAppRegion(region),
    };
  }

  const rank =
    mmrRes.data?.current_data?.currenttierpatched ?? "Unranked";

  return {
    rank,
    region: toAppRegion(region),
  };
}

// HenrikDev shard codes -> this app's User.region enum values.
const HENRIK_TO_APP_REGION = {
  na: "NA",
  eu: "EU",
  ap: "APAC",
  kr: "KR",
  latam: "LATAM",
  br: "BR",
};

function toAppRegion(henrikRegion) {
  return (
    HENRIK_TO_APP_REGION[henrikRegion?.toLowerCase()] ||
    henrikRegion?.toUpperCase()
  );
}

// Reverse of the above, for calls that need HenrikDev's lowercase shard
// code given this app's stored region value (e.g. "NA" -> "na").
const APP_TO_HENRIK_REGION = {
  NA: "na",
  EU: "eu",
  APAC: "ap",
  KR: "kr",
  LATAM: "latam",
  BR: "br",
};

/**
 * Recent match history for a Riot ID, for the public player profile page.
 * Each entry covers what a glance-view needs: map, agent, K/D/A, win/loss,
 * and (for competitive matches only) the player's rank at the time.
 *
 * Rank-at-the-time isn't part of the match data itself — HenrikDev's match
 * list doesn't include per-match rank — so this cross-references the MMR
 * History endpoint (keyed by match_id) and attaches it where available.
 * If that lookup fails for any reason, matches are still returned without
 * a rank rather than failing the whole request over a nice-to-have.
 *
 * @param {string} riotName
 * @param {string} riotTag
 * @param {string} appRegion - this app's region enum value (e.g. "NA")
 * @param {number} size - how many recent matches to return (default 10)
 */
export async function fetchRecentMatches(riotName, riotTag, appRegion, size = 10) {
  const cleanName = riotName.trim();
  const cleanTag = riotTag.trim().replace(/^#/, "");
  const henrikRegion = APP_TO_HENRIK_REGION[appRegion?.toUpperCase()] || "na";

  const matchesRes = await henrikGet(
    `/v4/matches/${henrikRegion}/pc/${encodeURIComponent(cleanName)}/${encodeURIComponent(
      cleanTag
    )}?size=${size}&mode=competitive`
  );

  if (matchesRes.notFound || !Array.isArray(matchesRes.data)) {
    return [];
  }

  // Best-effort rank-at-the-time lookup — never lets a failure here block
  // the match list itself from being returned.
  //
  // NOTE: the v1 mmr-history endpoint (by name/tag, no platform segment) is
  // being deprecated by HenrikDev in favor of v2, which requires a platform
  // segment just like the v4 matches endpoint does. Calling v1 was silently
  // failing here (caught below) and made every rankAtTime look like nothing
  // was found, rather than surfacing that the endpoint itself had moved.
  const rankByMatchId = new Map();
  try {
    const historyRes = await henrikGet(
      `/v2/mmr-history/${henrikRegion}/pc/${encodeURIComponent(cleanName)}/${encodeURIComponent(
        cleanTag
      )}`
    );
    // Confirmed against a live response: unlike v1 (a flat array), v2 wraps
    // the history list under `data.history`, and each entry's rank name is
    // nested at `tier.name` rather than a flat `currenttier_patched` string.
    const history = historyRes.data?.history;
    if (Array.isArray(history)) {
      for (const entry of history) {
        if (entry.match_id) rankByMatchId.set(entry.match_id, entry.tier?.name);
      }
    }
  } catch (historyErr) {
    // Rank-at-the-time is a nice-to-have — swallow and continue, but log so
    // this isn't invisible if the endpoint moves again.
    console.error("mmr-history lookup failed:", historyErr.message);
  }

  return matchesRes.data.map((match) => {
    const me = match.players?.find(
      (p) =>
        p.name?.toLowerCase() === cleanName.toLowerCase() &&
        p.tag?.toLowerCase() === cleanTag.toLowerCase()
    );

    // Confirmed against a live response: `teams` is an ARRAY of per-team
    // objects (not an object keyed by "red"/"blue"), and the win flag is
    // `won`, not `has_won`. e.g.
    // [{ team_id: "Red", won: false, rounds: {...} }, { team_id: "Blue", won: true, ... }]
    const myTeam = match.teams?.find(
      (t) => t.team_id?.toLowerCase() === me?.team_id?.toLowerCase()
    );
    const won = myTeam?.won;

    return {
      matchId: match.metadata?.match_id,
      map: match.metadata?.map?.name || "Unknown",
      startedAt: match.metadata?.started_at || null,
      agent: me?.agent?.name || "Unknown",
      kills: me?.stats?.kills ?? 0,
      deaths: me?.stats?.deaths ?? 0,
      assists: me?.stats?.assists ?? 0,
      result: won === undefined ? null : won ? "W" : "L",
      rankAtTime: rankByMatchId.get(match.metadata?.match_id) || null,
    };
  });
}