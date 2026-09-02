import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, olympicSelectionsTable, seasonsTable } from "@workspace/db";
import type { OlympicPlayerData } from "@workspace/db";
import { continentKeyForNationality } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { loadPlayers, requireCareerSaveId } from "../lib/playerDto.js";

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

/** Spots per continent in the Olympic tournament (12 total). */
const CONTINENT_SPOTS: Record<string, number> = {
  "Europe":              3,
  "Asia":                2,
  "North America":       2,
  "South America":       2,
  "Africa & Middle East":2,
  "Oceania":             1,
};
const CONTINENT_ORDER = ["Europe", "Asia", "North America", "South America", "Africa & Middle East", "Oceania"];

/** Compute per-nationality team ratings from the player table. */
async function buildQualifierStandings(careerSaveId: number) {
  // Stats are career-scoped now, so qualifier ratings must be read per career:
  // another save's training would otherwise change this save's standings.
  const allPlayers = await loadPlayers(careerSaveId, { isActive: true, playerType: "senior" });

  // Group by nationality
  const byNat = new Map<string, { continent: string; players: { name: string; rating: number; imageUrl: string | null }[] }>();
  for (const p of allPlayers) {
    if (!p.nationality) continue;
    const rating = Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
    if (!byNat.has(p.nationality)) byNat.set(p.nationality, { continent: p.continent ?? "Unknown", players: [] });
    byNat.get(p.nationality)!.players.push({ name: p.name, rating, imageUrl: p.imageUrl ?? null });
  }

  // Compute team rating (avg of top-2 best players) and group by continent
  const continentMap = new Map<string, { country: string; flag: string; teamRating: number; topPlayers: {name:string;rating:number;imageUrl:string|null}[] }[]>();
  for (const [country, { continent, players }] of byNat.entries()) {
    if (players.length < 2) continue;
    const sorted = [...players].sort((a, b) => b.rating - a.rating);
    const top2 = sorted.slice(0, 2);
    const teamRating = Math.round((top2[0]!.rating + top2[1]!.rating) / 2);
    if (!continentMap.has(continent)) continentMap.set(continent, []);
    continentMap.get(continent)!.push({ country, flag: COUNTRY_FLAGS[country] ?? "🌍", teamRating, topPlayers: top2 });
  }

  // Sort within each continent and apply qualification status
  return CONTINENT_ORDER.map(name => {
    const teams = [...(continentMap.get(name) ?? [])].sort((a, b) => b.teamRating - a.teamRating);
    const spots = CONTINENT_SPOTS[name] ?? 1;
    return {
      continent: name,
      spots,
      teams: teams.map((t, i) => ({
        ...t,
        rank: i + 1,
        qualStatus: i < spots ? "qualified" : i < spots + 2 ? "bubble" : "not_qualified",
      })),
    };
  }).filter(c => c.teams.length > 0);
}

async function getOlympicsYear(): Promise<{ gameYear: number; olympicsYear: number; isOlympicYear: boolean }> {
  const rows = await db.select({ year: seasonsTable.year, isOlympicSeason: seasonsTable.isOlympicSeason })
    .from(seasonsTable).orderBy(desc(seasonsTable.year)).limit(1);
  const gameYear = rows[0]?.year ?? 2026;
  const isOlympicYear = rows[0]?.isOlympicSeason ?? (gameYear % 4 === 0);
  let olympicsYear = gameYear;
  if (!isOlympicYear) while (olympicsYear % 4 !== 0) olympicsYear++;
  return { gameYear, olympicsYear, isOlympicYear };
}

// ── Route: GET /olympics/qualifiers ──────────────────────────────────────────
// Live per-continent qualification standings based on player ratings.

router.get("/olympics/qualifiers", async (_req, res) => {
  const continents = await buildQualifierStandings(requireCareerSaveId(_req.activeCareerSaveId));
  const { olympicsYear } = await getOlympicsYear();
  res.json({ olympicsYear, totalSpots: 12, continents });
});

// ── Route: GET /olympics/schedule ────────────────────────────────────────────
// Olympic tournament bracket: group draw + knockout rounds.
// Non-Olympic years → projected (no results). Olympic years → simulated results.

router.get("/olympics/schedule", async (_req, res) => {
  const continents = await buildQualifierStandings(requireCareerSaveId(_req.activeCareerSaveId));
  const { olympicsYear, isOlympicYear } = await getOlympicsYear();

  // Collect the 12 qualified teams (top N per continent)
  const qualified: { country: string; flag: string; continent: string; teamRating: number }[] = [];
  for (const cont of continents) {
    for (const t of cont.teams.filter(t => t.qualStatus === "qualified")) {
      qualified.push({ country: t.country, flag: t.flag, continent: cont.continent, teamRating: t.teamRating });
    }
  }
  // Sort by rating (highest-rated seeded first)
  qualified.sort((a, b) => b.teamRating - a.teamRating);
  // Pad to 12 if needed
  while (qualified.length < 12) {
    qualified.push({ country: "TBD", flag: "🏳️", continent: "TBD", teamRating: 0 });
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

  // Simulate match result: higher-rated team wins 70% of the time
  function simResult(a: number, b: number, seed: number): [number, number] {
    const rand = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const aWins = rand < (a > b ? 0.70 : 0.30);
    return aWins ? [2, Math.random() < 0.4 ? 0 : 1] : [Math.random() < 0.4 ? 0 : 1, 2];
  }

  // Build group stage matches
  type GSMatch = { home: string; homeflag: string; away: string; awayflag: string; homeScore: number|null; awayScore: number|null; status: "projected"|"completed"; day: number };
  const groupStage = groups.map((g, gi) => {
    const [t0, t1, t2] = g.teams;
    const matches: GSMatch[] = [
      { home: t0?.country ?? "TBD", homeflag: t0?.flag ?? "🏳️", away: t1?.country ?? "TBD", awayflag: t1?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: gi < 2 ? 1 : 2 },
      { home: t0?.country ?? "TBD", homeflag: t0?.flag ?? "🏳️", away: t2?.country ?? "TBD", awayflag: t2?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: gi < 2 ? 2 : 3 },
      { home: t1?.country ?? "TBD", homeflag: t1?.flag ?? "🏳️", away: t2?.country ?? "TBD", awayflag: t2?.flag ?? "🏳️", homeScore: null, awayScore: null, status: "projected", day: gi < 2 ? 3 : 4 },
    ];
    if (isOlympicYear) {
      matches.forEach((m, mi) => {
        const homeTeam = g.teams.find(t => t.country === m.home);
        const awayTeam = g.teams.find(t => t.country === m.away);
        const [hs, as_] = simResult(homeTeam?.teamRating ?? 70, awayTeam?.teamRating ?? 70, gi * 10 + mi);
        m.homeScore = hs; m.awayScore = as_; m.status = "completed";
      });
    }
    return { ...g, matches };
  });

  // Compute group standings (wins = 3pts, losses = 0)
  const groupStandings = groupStage.map(g => {
    const pts: Record<string, number> = {};
    const wins: Record<string, number> = {};
    for (const t of g.teams) { pts[t.country] = 0; wins[t.country] = 0; }
    for (const m of g.matches) {
      if (m.status === "completed" && m.homeScore !== null && m.awayScore !== null) {
        if (m.homeScore > m.awayScore) { pts[m.home] = (pts[m.home] ?? 0) + 3; wins[m.home] = (wins[m.home] ?? 0) + 1; }
        else { pts[m.away] = (pts[m.away] ?? 0) + 3; wins[m.away] = (wins[m.away] ?? 0) + 1; }
      }
    }
    return {
      group: g.name,
      standings: g.teams.map(t => ({
        country: t.country, flag: t.flag, continent: t.continent,
        played: isOlympicYear ? 2 : 0,
        won: wins[t.country] ?? 0,
        lost: isOlympicYear ? (2 - (wins[t.country] ?? 0)) : 0,
        points: pts[t.country] ?? 0,
      })).sort((a, b) => b.points - a.points || b.won - a.won),
    };
  });

  // Quarter finalists: top 2 from each group (by points)
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

  if (isOlympicYear) {
    // Simulate QF
    qf.forEach((m, i) => {
      const h = qfTeams.find(t => t.country === m.home);
      const a = qfTeams.find(t => t.country === m.away);
      const [hs, as_] = simResult(h?.points ?? 70, a?.points ?? 70, 100 + i);
      m.homeScore = hs; m.awayScore = as_; m.status = "completed";
    });
    // Simulate SF using QF winners
    const qfWinners = qf.map(m => (m.homeScore ?? 0) > (m.awayScore ?? 0) ? { country: m.home, flag: m.homeflag } : { country: m.away, flag: m.awayflag });
    sf[0]!.home = qfWinners[0]?.country ?? "TBD"; sf[0]!.homeflag = qfWinners[0]?.flag ?? "🏳️";
    sf[0]!.away = qfWinners[1]?.country ?? "TBD"; sf[0]!.awayflag = qfWinners[1]?.flag ?? "🏳️";
    sf[1]!.home = qfWinners[2]?.country ?? "TBD"; sf[1]!.homeflag = qfWinners[2]?.flag ?? "🏳️";
    sf[1]!.away = qfWinners[3]?.country ?? "TBD"; sf[1]!.awayflag = qfWinners[3]?.flag ?? "🏳️";
    sf.forEach((m, i) => {
      const [hs, as_] = simResult(70, 70, 200 + i);
      m.homeScore = hs; m.awayScore = as_; m.status = "completed";
    });
    const sfWinners  = sf.map(m => (m.homeScore ?? 0) > (m.awayScore ?? 0) ? { country: m.home, flag: m.homeflag } : { country: m.away, flag: m.awayflag });
    const sfLosers   = sf.map(m => (m.homeScore ?? 0) > (m.awayScore ?? 0) ? { country: m.away, flag: m.awayflag } : { country: m.home, flag: m.homeflag });
    finals[0]!.home = sfLosers[0]?.country ?? "TBD";  finals[0]!.homeflag = sfLosers[0]?.flag ?? "🏳️";
    finals[0]!.away = sfLosers[1]?.country ?? "TBD";  finals[0]!.awayflag = sfLosers[1]?.flag ?? "🏳️";
    finals[1]!.home = sfWinners[0]?.country ?? "TBD"; finals[1]!.homeflag = sfWinners[0]?.flag ?? "🏳️";
    finals[1]!.away = sfWinners[1]?.country ?? "TBD"; finals[1]!.awayflag = sfWinners[1]?.flag ?? "🏳️";
    finals.forEach((m, i) => {
      const [hs, as_] = simResult(70, 70, 300 + i);
      m.homeScore = hs; m.awayScore = as_; m.status = "completed";
    });
  }

  res.json({ olympicsYear, isOlympicYear, groupStage, groupStandings, knockout: { qf, sf, finals } });
});

export default router;
