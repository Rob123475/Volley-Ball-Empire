import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

const serializeMission = (team: any) => ({
  status:               team.youthScoutingStatus   ?? "idle",
  continent:            team.youthScoutingContinent ?? null,
  weeksRemaining:       team.youthScoutingWeeksRemaining ?? 0,
  expectedTalentLevel:  team.youthScoutingContinent
    ? (TALENT_LEVEL[team.youthScoutingContinent as Continent] ?? "Unknown")
    : null,
});

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

  const [updated] = await db.update(teamsTable).set({
    youthScoutingContinent:       continent,
    youthScoutingStatus:          "active",
    youthScoutingWeeksRemaining:  SCOUTING_WEEKS,
  }).where(eq(teamsTable.id, team.id)).returning();

  res.status(201).json(serializeMission(updated));
});

router.post("/youth-scouting/cancel", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const [updated] = await db.update(teamsTable).set({
    youthScoutingStatus:          "idle",
    youthScoutingContinent:       null,
    youthScoutingWeeksRemaining:  0,
  }).where(eq(teamsTable.id, team.id)).returning();

  res.json(serializeMission(updated));
});

export default router;
