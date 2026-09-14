import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, olympicSelectionsTable, seasonsTable } from "@workspace/db";
import type { OlympicPlayerData } from "@workspace/db";
import { continentKeyForNationality } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { loadPlayers, requireCareerSaveId } from "../lib/playerDto.js";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";
import { olympicQualification, OLYMPIC_SPOTS } from "../utils/olympicQualification.js";

const router = Router();

// ── Country flags ─────────────────────────────────────────────────────────────

const COUNTRY_FLAGS: Record<string, string> = {
  // Asia
  "Japan":          "🇯🇵",
  "China":          "🇨🇳",
  "South Korea":    "🇰🇷",
  "India":          "🇮🇳",
  "Thailand":       "🇹🇭",
  "Indonesia":      "🇮🇩",
  "Philippines":    "🇵🇭",
  "Vietnam":        "🇻🇳",
  "Malaysia":       "🇲🇾",
  "Taiwan":         "🇹🇼",
  "Laos":           "🇱🇦",
  "Maldives":       "🇲🇻",
  // Europe
  "Germany":        "🇩🇪",
  "France":         "🇫🇷",
  "Italy":          "🇮🇹",
  "Spain":          "🇪🇸",
  "Norway":         "🇳🇴",
  "Sweden":         "🇸🇪",
  "Denmark":        "🇩🇰",
  "Netherlands":    "🇳🇱",
  "Switzerland":    "🇨🇭",
  "Austria":        "🇦🇹",
  "Poland":         "🇵🇱",
  "Czech Republic": "🇨🇿",
  "Hungary":        "🇭🇺",
  "Ukraine":        "🇺🇦",
  "Russia":         "🇷🇺",
  "Greece":         "🇬🇷",
  "Portugal":       "🇵🇹",
  "Finland":        "🇫🇮",
  "Croatia":        "🇭🇷",
  "Serbia":         "🇷🇸",
  "Belgium":        "🇧🇪",
  "England":        "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Ireland":        "🇮🇪",
  "Malta":          "🇲🇹",
  "Monaco":         "🇲🇨",
  // North America
  "USA":            "🇺🇸",
  "Canada":         "🇨🇦",
  "Mexico":         "🇲🇽",
  "Cuba":           "🇨🇺",
  "Jamaica":        "🇯🇲",
  "Costa Rica":     "🇨🇷",
  "Dominican Republic": "🇩🇴",
  "Puerto Rico":    "🇵🇷",
  "Panama":         "🇵🇦",
  "Bahamas":        "🇧🇸",
  // South America
  "Brazil":         "🇧🇷",
  "Argentina":      "🇦🇷",
  "Colombia":       "🇨🇴",
  "Chile":          "🇨🇱",
  "Peru":           "🇵🇪",
  "Venezuela":      "🇻🇪",
  "Ecuador":        "🇪🇨",
  "Bolivia":        "🇧🇴",
  "Uruguay":        "🇺🇾",
  "Guyana":         "🇬🇾",
  // Africa and Middle East
  "Nigeria":        "🇳🇬",
  "Egypt":          "🇪🇬",
  "Kenya":          "🇰🇪",
  "Morocco":        "🇲🇦",
  "Tunisia":        "🇹🇳",
  "South Africa":   "🇿🇦",
  "Tanzania":       "🇹🇿",
  "Zimbabwe":       "🇿🇼",
  "Mozambique":     "🇲🇿",
  "Madagascar":     "🇲🇬",
  "Ghana":          "🇬🇭",
  "Senegal":        "🇸🇳",
  "Cameroon":       "🇨🇲",
  "Algeria":        "🇩🇿",
  // Oceania
  "Australia":      "🇦🇺",
  "New Zealand":    "🇳🇿",
  "Fiji":           "🇫🇯",
  "Samoa":          "🇼🇸",
  "Tahiti":         "🇵🇫",
  "Papua New Guinea": "🇵🇬",
  "Tonga":          "🇹🇴",
  "Vanuatu":        "🇻🇺",
  "Cook Islands":   "🇨🇰",
  "Solomon Islands":"🇸🇧",
};

// Nationality -> continent now comes from @workspace/db. This file used to
// carry its own 45-entry copy; it was one of the seven vocabularies that
// drifted, and the "Other" fallback below meant a nationality it had never
// heard of was quietly bucketed instead of reported.

// ── Eligibility constants ─────────────────────────────────────────────────────

/** Minimum number of real eligible players a country must have. */
const MIN_PLAYERS = 3;

// ── Route: GET /olympics/countries ────────────────────────────────────────────
// Returns all nationalities that have at least one active senior player,
// labelled ELIGIBLE (≥ MIN_PLAYERS real players) or INELIGIBLE (< MIN_PLAYERS).
// No wildcard or generated players are ever included.

router.get("/olympics/countries", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Senior players only — youth players must not count toward Olympic eligibility
  const allPlayers = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { isActive: true, playerType: "senior" });

  const byNationality = new Map<string, typeof allPlayers>();
  for (const p of allPlayers) {
    if (!p.nationality) continue;
    const group = byNationality.get(p.nationality) ?? [];
    group.push(p);
    byNationality.set(p.nationality, group);
  }

  const countries: Array<{
    country: string;
    flag: string;
    continent: string;
    playerCount: number;
    eligibilityStatus: "eligible" | "ineligible";
    eligibilityReason?: string;
    squad: OlympicPlayerData[];
  }> = [];

  for (const [nationality, players] of byNationality.entries()) {
    const eligible = players.length >= MIN_PLAYERS;
    const continent = continentKeyForNationality(nationality) ?? "unknown";

    // Sort best players first by average rating
    const scored = [...players].sort((a, b) => {
      const avg = (p: typeof players[number]) =>
        (p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6;
      return avg(b) - avg(a);
    });

    // Squad: top 2 starters + 1 reserve — only built for eligible countries.
    // All three are real players from the permanent DB (no generated players).
    const squad: OlympicPlayerData[] = eligible
      ? scored.slice(0, MIN_PLAYERS).map((p, i) => ({
          id: p.id,
          name: p.name,
          nationality: p.nationality,
          age: p.age,
          speed: p.speed,
          power: p.power,
          defense: p.defense,
          serve: p.serve,
          block: p.block,
          stamina: p.stamina,
          isReserve: i === 2,   // third player is the reserve
          imageUrl: p.imageUrl ?? null,
        }))
      : [];

    countries.push({
      country: nationality,
      flag: COUNTRY_FLAGS[nationality] ?? "🌍",
      continent,
      playerCount: players.length,
      eligibilityStatus: eligible ? "eligible" : "ineligible",
      ...(eligible ? {} : {
        eligibilityReason: `Requires ${MIN_PLAYERS} eligible players of national origin (has ${players.length}).`,
      }),
      squad,
    });
  }

  // Eligible countries first, then ineligible; alphabetical within each group
  countries.sort((a, b) => {
    if (a.eligibilityStatus !== b.eligibilityStatus) {
      return a.eligibilityStatus === "eligible" ? -1 : 1;
    }
    return b.playerCount - a.playerCount || a.country.localeCompare(b.country);
  });

  res.json(countries);
});

// ── Route: GET /olympics/selection ────────────────────────────────────────────

router.get("/olympics/selection", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const selection = await db.query.olympicSelectionsTable.findFirst({
    where: eq(olympicSelectionsTable.userId, req.user.id),
  });

  if (!selection) { res.status(404).json({ error: "No selection made" }); return; }

  res.json({
    country: selection.selectedCountry,
    flag: selection.selectedFlag,
    squad: selection.squad,
  });
});

// ── Route: POST /olympics/selection ───────────────────────────────────────────
// Saves the user's chosen country + squad.
// All three squad members must be real players (id must not be null).

router.post("/olympics/selection", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { country, flag, squad } = req.body as {
    country: string;
    flag: string;
    squad: OlympicPlayerData[];
  };

  if (!country || !flag || !Array.isArray(squad) || squad.length !== 3) {
    res.status(400).json({ error: "country, flag, and a squad of exactly 3 players are required" });
    return;
  }

  // Reject any squad that contains a generated (id: null) player
  const hasGeneratedPlayer = squad.some((p) => p.id === null);
  if (hasGeneratedPlayer) {
    res.status(400).json({ error: "All squad members must be real players with a permanent player ID." });
    return;
  }

  const existing = await db.query.olympicSelectionsTable.findFirst({
    where: eq(olympicSelectionsTable.userId, req.user.id),
  });

  if (existing) {
    await db.update(olympicSelectionsTable)
      .set({ selectedCountry: country, selectedFlag: flag, squad })
      .where(eq(olympicSelectionsTable.userId, req.user.id));
  } else {
    await db.insert(olympicSelectionsTable).values({
      userId: req.user.id,
      selectedCountry: country,
      selectedFlag: flag,
      squad,
    });
  }

  res.json({ country, flag, squad });
});

// ── Route: DELETE /olympics/selection ─────────────────────────────────────────
// Called when the Olympic tournament concludes.
// Removes the row; real players in the squad are unaffected (they remain in playersTable).

router.delete("/olympics/selection", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const existing = await db.query.olympicSelectionsTable.findFirst({
    where: eq(olympicSelectionsTable.userId, req.user.id),
  });

  if (!existing) { res.status(404).json({ error: "No selection to clear" }); return; }

  await db.delete(olympicSelectionsTable)
    .where(eq(olympicSelectionsTable.userId, req.user.id));

  res.status(204).send();
});

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * The season qualification is decided on, and the Olympics it leads to, for
 * THIS career. This used to read the newest season row in the whole database,
 * so a second career on the same machine saw the first one's year.
 */
async function getOlympicsYear(careerSaveId: number): Promise<{ gameYear: number; olympicsYear: number; isOlympicYear: boolean }> {
  const season = await getActiveSeasonForCareer(careerSaveId);
  const gameYear = season?.year ?? 2026;
  const isOlympicYear = season?.isOlympicSeason ?? (gameYear % 4 === 0);
  let olympicsYear = gameYear;
  if (!isOlympicYear) while (olympicsYear % 4 !== 0) olympicsYear++;
  return { gameYear, olympicsYear, isOlympicYear };
}

// ── Route: GET /olympics/qualifiers ──────────────────────────────────────────
// R-46: national qualification on this season's World Tour ranking points —
// see utils/olympicQualification.ts. Player ratings play no part. This replaced
// per-continent spots decided by the average rating of each nation's best two.

router.get("/olympics/qualifiers", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const { gameYear, olympicsYear } = await getOlympicsYear(cid);
  const q = olympicQualification(cid, gameYear);
  res.json({ olympicsYear, seasonYear: q.seasonYear, totalSpots: q.spots, countries: q.countries });
});

// ── Route: GET /olympics/schedule ────────────────────────────────────────────
// The Olympic draw: the qualified nations in groups, and the knockout path.
// R-43: projected only. This build plays no Olympic tournament. In an Olympic
// year this used to fill in scores from a roll made on every request, so a page
// reload could change who won gold. No result exists until a real tournament does.

router.get("/olympics/schedule", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const { gameYear, olympicsYear, isOlympicYear } = await getOlympicsYear(cid);

  // The qualified nations in qualifying order (R-46): seeded by the same World
  // Tour points that qualified them, never by ratings.
  const qualified: { country: string; flag: string; continent: string; points: number }[] =
    olympicQualification(cid, gameYear).countries
      .filter((c) => c.qualified)
      .map((c) => ({ country: c.country, flag: c.flag, continent: c.continent ?? "unknown", points: c.points }));
  while (qualified.length < OLYMPIC_SPOTS) {
    qualified.push({ country: "TBD", flag: "🏳️", continent: "TBD", points: 0 });
  }

  // Serpentine group draw: A-B-C-D-D-C-B-A-A-B-C-D
  const groupAssign = [0,1,2,3,3,2,1,0,0,1,2,3];
  const groups: { name: string; teams: typeof qualified }[] = [
    { name: "A", teams: [] }, { name: "B", teams: [] },
    { name: "C", teams: [] }, { name: "D", teams: [] },
  ];
  qualified.slice(0,12).forEach((t, i) => {
    const g = groupAssign[i] ?? 0;
    groups[g]!.teams.push(t);
  });

  // Build group stage matches
  type GSMatch = { home: string; homeflag: string; away: string; awayflag: string; homeScore: number|null; awayScore: number|null; status: "projected"|"completed"; day: number };
  const groupStage = groups.map((g, gi) => {
    const [t0, t1, t2] = g.teams;
    const matches: GSMatch[] = [
      { home: t0?.country ?? "TBD", homeflag: t0?.flag ?? "🏳️", away: t1?.country ?? "TBD", awayflag: t1?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: gi < 2 ? 1 : 2 },
      { home: t0?.country ?? "TBD", homeflag: t0?.flag ?? "🏳️", away: t2?.country ?? "TBD", awayflag: t2?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: gi < 2 ? 2 : 3 },
      { home: t1?.country ?? "TBD", homeflag: t1?.flag ?? "🏳️", away: t2?.country ?? "TBD", awayflag: t2?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: gi < 2 ? 3 : 4 },
    ];
    return { ...g, matches };
  });

  // Group tables: the drawn nations in seeding order, nothing played.
  const groupStandings = groupStage.map(g => ({
    group: g.name,
    standings: g.teams.map(t => ({
      country: t.country, flag: t.flag, continent: t.continent,
      played: 0, won: 0, lost: 0, points: 0,
    })),
  }));

  // Projected quarter-finalists: the top two seeds of each group
  const qfTeams = groupStandings.flatMap(g => g.standings.slice(0, 2));

  type KOMatch = { label: string; home: string; homeflag: string; away: string; awayflag: string; homeScore: number|null; awayScore: number|null; status: "projected"|"completed"; day: number };
  const qf: KOMatch[] = [
    { label: "QF1", home: qfTeams[0]?.country ?? "TBD", homeflag: qfTeams[0]?.flag ?? "🏳️", away: qfTeams[5]?.country ?? "TBD", awayflag: qfTeams[5]?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: 5 },
    { label: "QF2", home: qfTeams[2]?.country ?? "TBD", homeflag: qfTeams[2]?.flag ?? "🏳️", away: qfTeams[7]?.country ?? "TBD", awayflag: qfTeams[7]?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: 5 },
    { label: "QF3", home: qfTeams[1]?.country ?? "TBD", homeflag: qfTeams[1]?.flag ?? "🏳️", away: qfTeams[4]?.country ?? "TBD", awayflag: qfTeams[4]?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: 5 },
    { label: "QF4", home: qfTeams[3]?.country ?? "TBD", homeflag: qfTeams[3]?.flag ?? "🏳️", away: qfTeams[6]?.country ?? "TBD", awayflag: qfTeams[6]?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: 5 },
  ];

  const sf: KOMatch[] = [
    { label: "SF1", home: "W-QF1", homeflag: "🏳️", away: "W-QF2", awayflag: "🏳️", homeScore: null, awayScore: null, status: "projected", day: 6 },
    { label: "SF2", home: "W-QF3", homeflag: "🏳️", away: "W-QF4", awayflag: "🏳️", homeScore: null, awayScore: null, status: "projected", day: 6 },
  ];

  const finals: KOMatch[] = [
    { label: "Bronze", home: "L-SF1", homeflag: "🏳️", away: "L-SF2", awayflag: "🏳️", homeScore: null, awayScore: null, status: "projected", day: 7 },
    { label: "Gold",   home: "W-SF1", homeflag: "🏳️", away: "W-SF2", awayflag: "🏳️", homeScore: null, awayScore: null, status: "projected", day: 7 },
  ];

  res.json({ olympicsYear, isOlympicYear, groupStage, groupStandings, knockout: { qf, sf, finals } });
});

export default router;
