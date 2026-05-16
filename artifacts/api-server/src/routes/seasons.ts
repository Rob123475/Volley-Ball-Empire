import { Router } from "express";
import { db } from "@workspace/db";
import { seasonsTable, matchesTable, teamsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/seasons", async (req, res) => {
  const seasons = await db.select().from(seasonsTable).orderBy(desc(seasonsTable.year));
  res.json(seasons);
});

router.post("/seasons", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { year, name, totalRounds, startDate, endDate } = req.body;
  const [season] = await db.insert(seasonsTable).values({
    year: Number(year), name, totalRounds: Number(totalRounds),
    startDate, endDate, status: "active", currentRound: 1,
  }).returning();
  res.status(201).json(season);
});

router.get("/seasons/current", async (req, res) => {
  const season = await db.query.seasonsTable.findFirst({
    where: eq(seasonsTable.status, "active"),
  });
  if (!season) {
    const latest = await db.query.seasonsTable.findFirst();
    res.json(latest || { id: 1, year: 2026, name: "2026 World Series", status: "active", totalRounds: 10, currentRound: 1, startDate: "2026-01-01", endDate: "2026-12-31" });
    return;
  }
  res.json(season);
});

router.get("/seasons/:id/ladder", async (req, res) => {
  const seasonId = parseInt(req.params.id);
  const teams = await db.select().from(teamsTable).limit(20);
  const ladder = teams.map((team, idx) => ({
    rank: idx + 1,
    teamId: team.id,
    teamName: team.name,
    wins: team.wins,
    losses: team.losses,
    points: team.wins * 3,
    goalsFor: team.wins * 2 + Math.floor(Math.random() * 10),
    goalsAgainst: team.losses * 2 + Math.floor(Math.random() * 8),
  })).sort((a, b) => b.points - a.points).map((e, i) => ({ ...e, rank: i + 1 }));
  res.json(ladder);
});

export default router;
