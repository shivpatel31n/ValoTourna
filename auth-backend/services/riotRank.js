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
    response = await fetch(`${BASE_URL}${path}`, { headers: authHeaders() });
  } catch (networkErr) {
    throw new Error("Couldn't reach the rank lookup service. Please try again.");
  }

  const json = await response.json().catch(() => null);

  if (response.status === 404 || json?.status === 404) {
    return { notFound: true };
  }

  if (!response.ok || !json || (json.status && json.status !== 200)) {
    const message = json?.errors?.[0]?.message;
    throw new Error(message || "Couldn't verify that Riot ID right now. Please try again.");
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

  // Step 1: resolve the account to find which shard/region it lives on.
  const accountRes = await henrikGet(
    `/v1/account/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`
  );
  if (accountRes.notFound) {
    throw new Error(`No Valorant account found for ${cleanName}#${cleanTag}.`);
  }
  const region = accountRes.data?.region;
  if (!region) {
    throw new Error("Couldn't determine that account's region. Please try again.");
  }

  // Step 2: fetch current competitive rank for that shard.
  const mmrRes = await henrikGet(
    `/v2/mmr/${region}/${encodeURIComponent(cleanName)}/${encodeURIComponent(cleanTag)}`
  );
  if (mmrRes.notFound) {
    throw new Error(`No ranked data found for ${cleanName}#${cleanTag}.`);
  }

  const rank = mmrRes.data?.current_data?.currenttierpatched || "Unranked";
  return { rank, region: toAppRegion(region) };
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
  return HENRIK_TO_APP_REGION[henrikRegion?.toLowerCase()] || henrikRegion?.toUpperCase();
}