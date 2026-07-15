import dotenv from "dotenv";
import { connectDB } from "./config/db.js";
import Tournament from "./models/Tournament.js";

dotenv.config();

const TOURNAMENTS = [
  {
    slug: "weekend-ignition-cup",
    title: "Weekend Ignition Cup",
    status: "upcoming",
    format: "5v5 — Single elimination — Bo1",
    teamSize: 5,
    startDate: "2026-07-20T18:00:00",
    regDeadline: "2026-07-18T23:59:00",
    endDate: null,
    maxTeams: 64,
    prizePool: "$500 in store credit, split top 3",
    description: "A fast, no-frills bracket cup for squads who want a weekend of straight elimination Valorant. Single-elim, best-of-one, so every round matters.",
    rules: [
      "Full 5-player roster required, no substitutes mid-match",
      "Standard competitive ruleset, default agent pool",
      "Check-in closes 30 minutes before your scheduled match time",
      "No smurfing — roster ranks are verified before bracket seeding",
    ],
  },
  {
    slug: "premier-feeder-series",
    title: "Premier Feeder Series",
    status: "live",
    format: "5v5 — Group stage — Bo3",
    teamSize: 5,
    startDate: "2026-07-01T18:00:00",
    regDeadline: "2026-06-28T23:59:00",
    endDate: null,
    maxTeams: 16,
    prizePool: "Winner advances to Premier Circuit qualifiers",
    description: "A five-week group stage feeding the community's Premier circuit. Currently in round 3 of 5 — registration for this season is closed, but the bracket is worth spectating.",
    rules: [
      "Round robin group stage, top 2 per group advance",
      "Best-of-three, map veto standard",
      "Rosters locked for the remainder of the season",
    ],
  },
  {
    slug: "skirmish-ascension",
    title: "Skirmish Ascension",
    status: "upcoming",
    format: "2v2 — Swiss — Bo1",
    teamSize: 2,
    startDate: "2026-07-26T17:00:00",
    regDeadline: "2026-07-24T23:59:00",
    endDate: null,
    maxTeams: 48,
    prizePool: "Top 4 duos get a custom Discord role + shoutout",
    description: "Duo-queue Swiss format — five rounds, matched by record each round. Built for pairs who want a shorter time commitment than a full 5-stack.",
    rules: [
      "2-player rosters only, no subs",
      "Swiss pairing across 5 rounds, single map each",
      "Any rank welcome — this one's about duo synergy, not MMR",
    ],
  },
  {
    slug: "rookie-rush",
    title: "Rookie Rush",
    status: "upcoming",
    format: "5v5 — Under Diamond — Bo1",
    teamSize: 5,
    startDate: "2026-07-23T18:00:00",
    regDeadline: "2026-07-21T23:59:00",
    endDate: null,
    maxTeams: 32,
    prizePool: "Bragging rights + a shot at the Rookie MVP callout",
    description: "A rank-capped cup for teams under Diamond. Built so newer squads get bracket experience without running into stacked Immortal lineups.",
    rules: [
      "Every player on the roster must be Diamond 3 or below at lock-in",
      "Single elimination, best-of-one",
      "Rank is checked against your profile rank at registration",
    ],
  },
  {
    slug: "late-night-customs-cup",
    title: "Late Night Customs Cup",
    status: "upcoming",
    format: "5v5 — Round Robin — Bo1",
    teamSize: 5,
    startDate: "2026-07-22T22:00:00",
    regDeadline: "2026-07-20T23:59:00",
    endDate: null,
    maxTeams: 20,
    prizePool: "Casual — no prize pool, just late-night lobbies",
    description: "Low-stakes round robin for the night-owl crowd. Everyone plays everyone in their group — great if you just want a stack of guaranteed matches.",
    rules: [
      "Starts 10 PM server time — plan accordingly",
      "Round robin within groups of 5",
      "Pistols-only overtime, because it's funnier that way",
    ],
  },
  {
    slug: "off-angle-invitational",
    title: "Off-Angle Invitational",
    status: "past",
    format: "5v5 — Single elimination — Bo3",
    teamSize: 5,
    startDate: "2026-06-18T18:00:00",
    regDeadline: "2026-06-16T23:59:00",
    endDate: "2026-06-21T23:00:00",
    maxTeams: 32,
    prizePool: "$300 in store credit",
    description: "Season's marquee invitational. 32 teams, single elim, best-of-three from quarterfinals on. Nullpoint took it in a 2-1 nail-biter over Ashen Vale.",
    rules: [
      "Full 5-player roster required, no substitutes mid-match",
      "Best-of-three from the quarterfinal round onward",
    ],
    champion: "Nullpoint",
    runnerUp: "Ashen Vale",
  },
  {
    slug: "ranked-rumble-s2",
    title: "Ranked Rumble S2",
    status: "past",
    format: "5v5 — Round Robin — Bo1",
    teamSize: 5,
    startDate: "2026-05-28T18:00:00",
    regDeadline: "2026-05-26T23:59:00",
    endDate: "2026-05-30T22:00:00",
    maxTeams: 24,
    prizePool: "Custom Discord roles for top 3",
    description: "Second season of the community round robin. Kiroshi Vipers went undefeated through the group stage to take the title over Static Frame.",
    rules: [
      "Round robin, single map per matchup",
      "Standings decided by round differential on ties",
    ],
    champion: "Kiroshi Vipers",
    runnerUp: "Static Frame",
  },
];

async function seed() {
  await connectDB();

  for (const t of TOURNAMENTS) {
    await Tournament.findOneAndUpdate({ slug: t.slug }, t, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    console.log(`Upserted: ${t.title}`);
  }

  console.log(`Done. Seeded ${TOURNAMENTS.length} tournaments.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});