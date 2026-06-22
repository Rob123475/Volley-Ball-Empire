import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, financeTransactionsTable, youthProspectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { generateScoutingProspects } from "../utils/prospect-generator";

const router = Router();

const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"] as const;
type Continent = typeof CONTINENTS[number];

const TALENT_LEVEL: Record<Continent, string> = {
  Africa:          "High",
  Asia:            "Average",
  Europe:          "Elite",
  "North America": "High",
  "South America": "High",
  Oceania:         "Average",
};

const SCOUTING_WEEKS = 4;
export const SCOUTING_COST = 15_000;

const getTeamForUser = (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

const serializeMission = (team: any) => ({
  status:              team.youthScoutingStatus    ?? "idle",
  continent:           team.youthScoutingContinent  ?? null,
  weeksRemaining:      team.youthScoutingWeeksRemaining ?? 0,
  expectedTalentLevel: team.youthScoutingContinent
    ? (TALENT_LEVEL[team.youthScoutingContinent as Continent] ?? "Unknown")
    : null,
  scoutingCost: SCOUTING_COST,
});

const serializeProspect = (p: any) => ({
  id:            p.id,
  name:          p.name,
  age:           p.age,
  continent:     p.continent,
  currentRating: p.currentRating,
  potentialStars: p.potentialStars,
  speciality:    p.speciality,
  signingCost:   p.signingCost,
  status:        p.status,
});

// ── Mission endpoints ──────────────────────────────────────────────────────

router.get("/youth-scouting", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  res.json(serializeMission(team));
});

router.post("/youth-scouting/start", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  if (team.youthScoutingStatus === "active") {
    res.status(422).json({ error: "A scouting mission is already in progress." });
    return;
  }

  const { continent } = req.body as { continent: string };
  if (!CONTINENTS.includes(continent as Continent)) {
    res.status(400).json({ error: `continent must be one of: ${CONTINENTS.join(", ")}` });
    return;
  }

  const budget = Number(team.budget ?? 0);
  if (budget < SCOUTING_COST) {
    res.status(422).json({ error: `Insufficient funds. Scouting costs $${SCOUTING_COST.toLocaleString()}.` });
    return;
  }

  const today = new Date().toISOString().split("T")[0]!;

  const [updated] = await db.update(teamsTable).set({
    youthScoutingContinent:      continent,
    youthScoutingStatus:         "active",
    youthScoutingWeeksRemaining: SCOUTING_WEEKS,
    budget:                      String(budget - SCOUTING_COST),
  }).where(eq(teamsTable.id, team.id)).returning();

  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      String(-SCOUTING_COST),
    description: `Youth scouting — ${continent}`,
    category:    "youth_academy",
    date:        today,
  });

  res.status(201).json(serializeMission(updated));
});

router.post("/youth-scouting/cancel", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const [updated] = await db.update(teamsTable).set({
    youthScoutingStatus:         "idle",
    youthScoutingContinent:      null,
    youthScoutingWeeksRemaining: 0,
  }).where(eq(teamsTable.id, team.id)).returning();

  res.json(serializeMission(updated));
});

// ── Prospect endpoints ─────────────────────────────────────────────────────

router.get("/youth-scouting/prospects", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const prospects = await db.select().from(youthProspectsTable).where(
    and(eq(youthProspectsTable.teamId, team.id), eq(youthProspectsTable.status, "pending")),
  );

  res.json(prospects.map(serializeProspect));
});

router.post("/youth-scouting/prospects/:id/sign", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const prospectId = parseInt(req.params.id);
  const prospect = await db.query.youthProspectsTable.findFirst({
    where: and(eq(youthProspectsTable.id, prospectId), eq(youthProspectsTable.teamId, team.id)),
  });

  if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }
  if (prospect.status !== "pending") {
    res.status(422).json({ error: "Prospect is no longer available." });
    return;
  }

  const [updated] = await db.update(youthProspectsTable)
    .set({ status: "reserved" })
    .where(eq(youthProspectsTable.id, prospectId))
    .returning();

  res.json(serializeProspect(updated));
});

router.post("/youth-scouting/prospects/:id/ignore", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const prospectId = parseInt(req.params.id);
  const prospect = await db.query.youthProspectsTable.findFirst({
    where: and(eq(youthProspectsTable.id, prospectId), eq(youthProspectsTable.teamId, team.id)),
  });

  if (!prospect) { res.status(404).json({ error: "Prospect not found" }); return; }

  const [updated] = await db.update(youthProspectsTable)
    .set({ status: "ignored" })
    .where(eq(youthProspectsTable.id, prospectId))
    .returning();

  res.json(serializeProspect(updated));
});

// ── Dev helper — force-complete a mission (for testing) ───────────────────

router.post("/youth-scouting/dev-complete", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  if (team.youthScoutingStatus !== "active") {
    res.status(422).json({ error: "No active mission to complete." });
    return;
  }

  await db.update(teamsTable).set({
    youthScoutingStatus:         "complete",
    youthScoutingWeeksRemaining: 0,
  }).where(eq(teamsTable.id, team.id));

  await generateScoutingProspects(team.id, team.youthScoutingContinent!);

  const updated = await getTeamForUser(req.user.id);
  res.json(serializeMission(updated));
});

export default router;
