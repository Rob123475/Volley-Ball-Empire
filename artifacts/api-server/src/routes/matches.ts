import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, teamsTable, playersTable, financeTransactionsTable, locationsTable } from "@workspace/db";
import { eq, desc, gt, and } from "drizzle-orm";

const router = Router();

const WEATHERS = ["sunny", "cloudy", "windy", "hot", "overcast", "stormy", "perfect"];

const serializeMatch = (m: any) => ({
  ...m,
  prizeAmount: m.prizeAmount ? Number(m.prizeAmount) : null,
  windSpeed: m.windSpeed ? Number(m.windSpeed) : null,
  temperature: m.temperature ? Number(m.temperature) : null,
  lineup: Array.isArray(m.lineup) ? m.lineup : [],
  highlights: Array.isArray(m.highlights) ? m.highlights : [],
});

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
};

const FIXTURE_TEMPLATE = [
  { round: 1,  date: "2026-01-15", locId: 1, locName: "Copacabana Beach, Brazil",       opponent: "Sand Queens AU",      prize: 5000  },
  { round: 2,  date: "2026-02-12", locId: 2, locName: "Bondi Beach, Australia",          opponent: "Pacific Storm USA",   prize: 6000  },
  { round: 3,  date: "2026-03-19", locId: 3, locName: "Waikiki Beach, Hawaii",           opponent: "Tropical Blaze CUB",  prize: 7000  },
  { round: 4,  date: "2026-04-16", locId: 4, locName: "Clearwater Beach, Florida",       opponent: "Rio Serpents BRA",    prize: 8500  },
  { round: 5,  date: "2026-05-21", locId: 5, locName: "Playa Varadero, Cuba",            opponent: "Sydney Sharks AU",    prize: 10000 },
  { round: 6,  date: "2026-06-18", locId: 6, locName: "Ipanema Beach, Brazil",           opponent: "Greek Fire GRE",      prize: 12000 },
  { round: 7,  date: "2026-07-16", locId: 7, locName: "Kata Beach, Thailand",            opponent: "Bali Tigers IDN",     prize: 14000 },
  { round: 8,  date: "2026-08-13", locId: 8, locName: "Mykonos Super Paradise, Greece",  opponent: "Island Aces THA",     prize: 16000 },
  { round: 9,  date: "2026-09-17", locId: 9, locName: "Bali Kuta Beach, Indonesia",      opponent: "French Riviera FRA",  prize: 18000 },
  { round: 10, date: "2026-10-15", locId: 10, locName: "Nice Promenade, France",         opponent: "Storm Queens USA",    prize: 22000 },
  { round: 11, date: "2026-12-10", locId: 1,  locName: "Copacabana Beach, Brazil",       opponent: "World All-Stars",     prize: 50000 },
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
  const weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
  const [match] = await db.insert(matchesTable).values({
    homeTeamId: team.id,
    awayTeamId: team.id,
    locationId: Number(locationId),
    weather,
    windSpeed: String((Math.random() * 30).toFixed(1)),
    temperature: String((20 + Math.random() * 20).toFixed(1)),
    season: Number(season),
    round: Number(round),
    teamSize: Number(teamSize),
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
    await db.insert(matchesTable).values({
      homeTeamId: team.id,
      awayTeamId: team.id,
      locationId: f.locId,
      locationName: f.locName,
      homeTeamName: team.name,
      awayTeamName: f.opponent,
      weather: WEATHERS[Math.floor(Math.random() * WEATHERS.length)],
      windSpeed: String((5 + Math.random() * 25).toFixed(1)),
      temperature: String((20 + Math.random() * 15).toFixed(1)),
      season: 1,
      round: f.round,
      teamSize: 2,
      scheduledAt: `${f.date}T14:00:00.000Z`,
      prizeAmount: String(f.prize),
      status: "scheduled",
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

  const isFinal = match.round === 11;
  const homeScore = Math.floor(Math.random() * 3) + (avgStat > 70 ? 2 : 1);
  const awayScore = Math.floor(Math.random() * 3) + 1;
  const homeWon = homeScore > awayScore;

  const highlightTemplates = [
    "Spectacular dive save keeps the rally alive!",
    "Thunderous spike from the back row!",
    "Perfect set leads to a crushing attack!",
    "A powerful jump serve aces the opposition!",
    "Incredible block at the net turns the momentum!",
    "The team battles back from match point!",
    "A pinpoint drop shot catches everyone off guard!",
    isFinal ? "The crowd erupts as the championship is decided!" : "The home crowd goes wild!",
    isFinal ? "History is made on the sands of Copacabana!" : "A defining moment in the season!",
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
    await db.update(teamsTable).set({ wins: team.wins + 1, budget: String(Number(team.budget) + prizeEarned) })
      .where(eq(teamsTable.id, team.id));
    const today = new Date().toISOString().split("T")[0];
    await db.insert(financeTransactionsTable).values({
      teamId: team.id,
      type: "income",
      amount: String(prizeEarned),
      description: `Prize money: ${isFinal ? "GRAND FINAL" : `Round ${match.round}`} vs ${match.awayTeamName ?? "Opponent"}`,
      category: "prize_money",
      date: today,
    });
  } else {
    await db.update(teamsTable).set({ losses: team.losses + 1 }).where(eq(teamsTable.id, team.id));
  }

  res.json({
    match: serializeMatch(updatedMatch),
    highlights,
    homeScore,
    awayScore,
    winner: homeWon ? "home" : "away",
    prizeEarned,
    mvp: mvp ? { ...mvp, height: Number(mvp.height), salary: Number(mvp.salary) } : null,
    isFinal,
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
