import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, teamsTable, playersTable, financeTransactionsTable, locationsTable } from "@workspace/db";
import { eq, desc, gt, and } from "drizzle-orm";

const router = Router();

// ── Weather system ────────────────────────────────────────────────────────────
// Location pools: biased toward the typical climate of each real-world venue.
// Each string appears multiple times to weight probability.
const LOCATION_WEATHER_POOLS: Record<number, string[]> = {
  1:  ["sunny","sunny","hot","hot","stormy","perfect","cloudy"],           // Copacabana – tropical
  2:  ["sunny","sunny","windy","windy","cloudy","perfect","overcast"],     // Bondi – breezy southern
  3:  ["sunny","sunny","sunny","hot","perfect","cloudy","windy"],          // Waikiki – balmy trade-winds
  4:  ["sunny","hot","hot","stormy","cloudy","windy","overcast"],          // Clearwater – Florida heat/storms
  5:  ["hot","hot","sunny","stormy","cloudy","sunny","overcast"],          // Varadero – Caribbean
  6:  ["sunny","hot","hot","perfect","stormy","cloudy","sunny"],           // Ipanema – tropical
  7:  ["hot","hot","stormy","stormy","cloudy","sunny","overcast"],         // Kata Beach – Southeast Asia
  8:  ["sunny","sunny","windy","windy","perfect","cloudy","hot"],          // Mykonos – Mediterranean meltemi
  9:  ["hot","sunny","stormy","cloudy","sunny","overcast","perfect"],      // Bali – tropical
  10: ["cloudy","cloudy","windy","overcast","perfect","sunny","stormy"],   // Nice – Mediterranean, variable
};

// Fallback for unknown location ids
const DEFAULT_POOL = ["sunny","cloudy","windy","hot","overcast","stormy","perfect"];

type WeatherResult = { weather: string; windSpeed: string; temperature: string };

function generateWeather(locId?: number | null): WeatherResult {
  const pool = (locId != null ? LOCATION_WEATHER_POOLS[locId] : null) ?? DEFAULT_POOL;
  const weather = pool[Math.floor(Math.random() * pool.length)];

  // Weather-conditional wind & temperature ranges for realism
  let wind: number, temp: number;
  switch (weather) {
    case "stormy":
      wind = 22 + Math.random() * 32;   // 22–54 km/h — genuinely dangerous
      temp = 17 + Math.random() * 9;    // 17–26°C — cooled by storm
      break;
    case "windy":
      wind = 20 + Math.random() * 24;   // 20–44 km/h
      temp = 16 + Math.random() * 16;   // 16–32°C
      break;
    case "hot":
      wind = Math.random() * 9;         // 0–9 km/h — still & sweltering
      temp = 34 + Math.random() * 13;   // 34–47°C
      break;
    case "perfect":
      wind = 6 + Math.random() * 10;    // 6–16 km/h — pleasant sea breeze
      temp = 22 + Math.random() * 9;    // 22–31°C
      break;
    case "overcast":
      wind = 10 + Math.random() * 18;   // 10–28 km/h
      temp = 15 + Math.random() * 13;   // 15–28°C
      break;
    case "cloudy":
      wind = 6 + Math.random() * 17;    // 6–23 km/h
      temp = 17 + Math.random() * 14;   // 17–31°C
      break;
    case "sunny":
    default:
      wind = Math.random() * 16;        // 0–16 km/h
      temp = 24 + Math.random() * 15;   // 24–39°C
      break;
  }

  // 10% chance of extreme conditions (heatwave spike, gale burst, cold snap)
  if (Math.random() < 0.10) {
    const roll = Math.random();
    if (roll < 0.4) {
      // Heatwave
      temp  = Math.min(temp + 6 + Math.random() * 6, 52);
    } else if (roll < 0.75) {
      // Gale
      wind  = Math.min(wind * 1.8 + Math.random() * 10, 65);
    } else {
      // Cold snap
      temp  = Math.max(temp - 8 - Math.random() * 6, 8);
    }
  }

  return {
    weather,
    windSpeed:   wind.toFixed(1),
    temperature: temp.toFixed(1),
  };
}

const serializeMatch = (m: any) => ({
  ...m,
  prizeAmount: m.prizeAmount ? Number(m.prizeAmount) : null,
  windSpeed:   m.windSpeed   ? Number(m.windSpeed)   : null,
  temperature: m.temperature ? Number(m.temperature) : null,
  lineup:     Array.isArray(m.lineup)     ? m.lineup     : [],
  highlights: Array.isArray(m.highlights) ? m.highlights : [],
});

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

const FIXTURE_TEMPLATE = [
  { round: 1,  date: "2026-01-15", locId: 1,  locName: "Copacabana Beach, Brazil",      opponent: "Sand Queens AU",     prize: 5000  },
  { round: 2,  date: "2026-02-12", locId: 2,  locName: "Bondi Beach, Australia",         opponent: "Pacific Storm USA",  prize: 6000  },
  { round: 3,  date: "2026-03-19", locId: 3,  locName: "Waikiki Beach, Hawaii",          opponent: "Tropical Blaze CUB", prize: 7000  },
  { round: 4,  date: "2026-04-16", locId: 4,  locName: "Clearwater Beach, Florida",      opponent: "Rio Serpents BRA",   prize: 8500  },
  { round: 5,  date: "2026-05-21", locId: 5,  locName: "Playa Varadero, Cuba",           opponent: "Sydney Sharks AU",   prize: 10000 },
  { round: 6,  date: "2026-06-18", locId: 6,  locName: "Ipanema Beach, Brazil",          opponent: "Greek Fire GRE",     prize: 12000 },
  { round: 7,  date: "2026-07-16", locId: 7,  locName: "Kata Beach, Thailand",           opponent: "Bali Tigers IDN",    prize: 14000 },
  { round: 8,  date: "2026-08-13", locId: 8,  locName: "Mykonos Super Paradise, Greece", opponent: "Island Aces THA",    prize: 16000 },
  { round: 9,  date: "2026-09-17", locId: 9,  locName: "Bali Kuta Beach, Indonesia",     opponent: "French Riviera FRA", prize: 18000 },
  { round: 10, date: "2026-10-15", locId: 10, locName: "Nice Promenade, France",         opponent: "Storm Queens USA",   prize: 22000 },
  { round: 11, date: "2026-12-10", locId: 1,  locName: "Copacabana Beach, Brazil",       opponent: "World All-Stars",    prize: 50000 },
];

router.get("/matches", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const matches = await db.select().from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(desc(matchesTable.createdAt)).limit(50);
  res.json(matches.map(serializeMatch));
});

router.post("/matches", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { awayTeamId, locationId, season, round, teamSize, scheduledAt, prizeAmount } = req.body;
  const { weather, windSpeed, temperature } = generateWeather(Number(locationId));
  const [match] = await db.insert(matchesTable).values({
    homeTeamId: team.id,
    awayTeamId: team.id,
    locationId: Number(locationId),
    weather,
    windSpeed,
    temperature,
    season:    Number(season),
    round:     Number(round),
    teamSize:  Number(teamSize),
    scheduledAt,
    homeTeamName: team.name,
    prizeAmount: prizeAmount ? String(prizeAmount) : "5000",
  }).returning();
  res.status(201).json(serializeMatch(match));
});

router.get("/matches/upcoming", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const matches = await db.select().from(matchesTable)
    .where(eq(matchesTable.homeTeamId, team.id))
    .orderBy(matchesTable.createdAt).limit(5);
  res.json(matches.filter(m => m.status === "scheduled").map(serializeMatch));
});

// Full season fixture — auto-generates the 11-match schedule on first call
router.get("/matches/fixture", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }

  const existing = await db.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, 1)))
    .orderBy(matchesTable.round);

  const existingRounds = new Set(existing.map(m => m.round));
  const missing = FIXTURE_TEMPLATE.filter(f => !existingRounds.has(f.round));

  for (const f of missing) {
    const { weather, windSpeed, temperature } = generateWeather(f.locId);
    await db.insert(matchesTable).values({
      homeTeamId:   team.id,
      awayTeamId:   team.id,
      locationId:   f.locId,
      locationName: f.locName,
      homeTeamName: team.name,
      awayTeamName: f.opponent,
      weather,
      windSpeed,
      temperature,
      season:      1,
      round:       f.round,
      teamSize:    2,
      scheduledAt: `${f.date}T14:00:00.000Z`,
      prizeAmount: String(f.prize),
      status:      "scheduled",
    });
  }

  const all = await db.select().from(matchesTable)
    .where(and(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.season, 1)))
    .orderBy(matchesTable.round);

  res.json(all.map(serializeMatch));
});

router.get("/matches/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, id) });
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(serializeMatch(match));
});

router.post("/matches/:id/simulate", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const match = await db.query.matchesTable.findFirst({ where: eq(matchesTable.id, id) });
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  const activePlayers = players.filter(p => p.isActive);
  const avgStat = activePlayers.length > 0
    ? activePlayers.reduce((acc, p) => acc + p.power + p.defense + p.serve, 0) / (activePlayers.length * 3)
    : 65;

  // Weather impact on match difficulty
  const windPenalty = Math.min(Number(match.windSpeed ?? 0) / 50, 0.3); // up to 30% disadvantage in gales
  const heatPenalty = match.weather === "hot" ? 0.08 : 0;
  const weatherFactor = 1 - windPenalty - heatPenalty;

  const isFinal  = match.round === 11;
  const homeScore = Math.floor(Math.random() * 3) + (avgStat * weatherFactor > 70 ? 2 : 1);
  const awayScore = Math.floor(Math.random() * 3) + 1;
  const homeWon   = homeScore > awayScore;

  const weatherHighlights: Record<string, string> = {
    stormy:   "Players battle through gusting winds and dramatic conditions!",
    windy:    "A powerful gust deflects the serve at a crucial moment!",
    hot:      "The searing heat takes its toll — fatigue is a real factor today!",
    overcast: "Cool overcast conditions let both teams play at full intensity.",
    perfect:  "Perfect beach volleyball weather produces spectacular play!",
  };

  const highlightTemplates = [
    "Spectacular dive save keeps the rally alive!",
    "Thunderous spike from the back row!",
    "Perfect set leads to a crushing attack!",
    "A powerful jump serve aces the opposition!",
    "Incredible block at the net turns the momentum!",
    "The team battles back from match point!",
    "A pinpoint drop shot catches everyone off guard!",
    weatherHighlights[match.weather] ?? "The crowd erupts — what a match!",
    isFinal ? "The crowd erupts as the championship is decided!" : "The home crowd goes wild!",
    isFinal ? "History is made on the sands!" : "A defining moment in the season!",
  ];
  const highlights = Array.from({ length: 4 }, () =>
    highlightTemplates[Math.floor(Math.random() * highlightTemplates.length)]
  );

  const mvp = activePlayers.length > 0
    ? activePlayers.reduce((best, p) => (p.power + p.serve) > (best.power + best.serve) ? p : best, activePlayers[0])
    : null;

  const prizeEarned = homeWon ? Number(match.prizeAmount || 5000) : 0;

  const [updatedMatch] = await db.update(matchesTable).set({
    homeScore,
    awayScore,
    status: "completed",
    highlights,
  }).where(eq(matchesTable.id, id)).returning();

  if (homeWon) {
    const isChampionship = isFinal && homeWon;
    await db.update(teamsTable).set({
      wins:      team.wins + 1,
      budget:    String(Number(team.budget) + prizeEarned),
      ...(isChampionship ? { titlesWon: team.titlesWon + 1 } : {}),
    }).where(eq(teamsTable.id, team.id));
    const today = new Date().toISOString().split("T")[0];
    await db.insert(financeTransactionsTable).values({
      teamId:      team.id,
      type:        "income",
      amount:      String(prizeEarned),
      description: `Prize money: ${isFinal ? "GRAND FINAL" : `Round ${match.round}`} vs ${match.awayTeamName ?? "Opponent"}`,
      category:    "prize_money",
      date:        today,
    });
  } else {
    await db.update(teamsTable).set({ losses: team.losses + 1 }).where(eq(teamsTable.id, team.id));
  }

  res.json({
    match: serializeMatch(updatedMatch),
    highlights,
    homeScore,
    awayScore,
    winner:      homeWon ? "home" : "away",
    prizeEarned,
    mvp: mvp ? { ...mvp, height: Number(mvp.height), salary: Number(mvp.salary) } : null,
    isFinal,
    weatherImpact: windPenalty > 0.1 || heatPenalty > 0 ? match.weather : null,
  });
});

router.patch("/matches/:id/lineup", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { playerIds } = req.body;
  const [match] = await db.update(matchesTable).set({ lineup: playerIds })
    .where(eq(matchesTable.id, id)).returning();
  res.json(serializeMatch(match));
});

export default router;
