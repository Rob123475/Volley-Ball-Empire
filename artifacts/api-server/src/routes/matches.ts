import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, teamsTable, playersTable, financeTransactionsTable } from "@workspace/db";
import { eq, desc, gt } from "drizzle-orm";

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
    awayTeamId: Number(awayTeamId),
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
      description: `Prize money for winning match #${id}`,
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
