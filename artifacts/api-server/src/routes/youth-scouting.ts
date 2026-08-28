import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  financeTransactionsTable,
  youthProspectsTable,
  playersTable,
  contractsTable,
} from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { generateScoutingProspects } from "../utils/prospect-generator";
import { updateCareerStats, checkAchievements } from "../utils/check-achievements";
import { generateDevelopment } from "../utils/player-development";
import { getGameDate } from "../utils/gameDate.js";
import { loadPlayers, createCareerPlayer, requireCareerSaveId } from "../lib/playerDto.js";
import type { Team, YouthProspect } from "@workspace/db";

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

// ── Nationality pools by continent ────────────────────────────────────────

const NATIONALITIES: Record<string, string[]> = {
  Europe:          ["Germany", "France", "Italy", "Spain", "Norway", "Sweden", "Netherlands",
                    "Poland", "Denmark", "Switzerland", "Greece", "Portugal", "Austria", "Belgium",
                    "Russia", "Czech Republic", "Finland", "Croatia", "Serbia", "Ukraine",
                    "Hungary", "England", "Ireland", "Malta", "Monaco"],
  Africa:          ["Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Egypt", "Morocco",
                    "Tunisia", "Tanzania", "Zimbabwe", "Mozambique", "Madagascar", "Cameroon",
                    "Algeria", "Burkina Faso", "Ivory Coast", "Guinea"],
  "North America": ["USA", "Canada", "Mexico", "Cuba", "Jamaica", "Dominican Republic",
                    "Puerto Rico", "Panama", "Costa Rica", "Bahamas"],
  "South America": ["Brazil", "Colombia", "Argentina", "Chile", "Peru", "Venezuela",
                    "Ecuador", "Bolivia", "Uruguay", "Guyana"],
  Asia:            ["Japan", "South Korea", "China", "India", "Thailand", "Indonesia",
                    "Philippines", "Vietnam", "Malaysia", "Taiwan", "Laos", "Maldives"],
  Oceania:         ["Australia", "New Zealand", "Fiji", "Samoa", "Tahiti",
                    "Papua New Guinea", "Tonga", "Vanuatu"],
};

// ── Speciality → primary stat boost ─────────────────────────────────────

const SPECIALITY_STAT: Record<string, keyof typeof BASE_STATS> = {
  Power:   "power",
  Defense: "defense",
  Serve:   "serve",
  Speed:   "speed",
  Block:   "block",
};
// (referenced below; define dummy for TS)
const BASE_STATS = { speed: 0, power: 0, defense: 0, serve: 0, block: 0, stamina: 0 };

function buildStats(currentRating: number, speciality: string): typeof BASE_STATS {
  const rand = (base: number) => Math.max(30, Math.min(99, base + Math.floor(Math.random() * 11) - 5));
  const stats: typeof BASE_STATS = {
    speed:   rand(currentRating),
    power:   rand(currentRating),
    defense: rand(currentRating),
    serve:   rand(currentRating),
    block:   rand(currentRating),
    stamina: rand(currentRating),
  };
  const primary = SPECIALITY_STAT[speciality];
  if (primary) stats[primary] = Math.min(99, stats[primary] + 8);
  return stats;
}

// ── Helpers ───────────────────────────────────────────────────────────────


const serializeMission = (team: Team) => ({
  status:              team.youthScoutingStatus    ?? "idle",
  continent:           team.youthScoutingContinent  ?? null,
  weeksRemaining:      team.youthScoutingWeeksRemaining ?? 0,
  expectedTalentLevel: team.youthScoutingContinent
    ? (TALENT_LEVEL[team.youthScoutingContinent as Continent] ?? "Unknown")
    : null,
  scoutingCost: SCOUTING_COST,
});

const serializeProspect = (p: YouthProspect) => ({
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
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  res.json(serializeMission(team));
});

router.post("/youth-scouting/start", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
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

  const today = await getGameDate(team.id);

  const [updated] = await db.update(teamsTable).set({
    youthScoutingContinent:      continent,
    youthScoutingStatus:         "active",
    youthScoutingWeeksRemaining: SCOUTING_WEEKS,
    budget:                      budget - SCOUTING_COST,
  }).where(eq(teamsTable.id, team.id)).returning();

  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      SCOUTING_COST,
    description: `Youth scouting — ${continent}`,
    category:    "youth_academy",
    date:        today,
  });

  res.status(201).json(serializeMission(updated));
});

router.post("/youth-scouting/cancel", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
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
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const prospects = await db.select().from(youthProspectsTable).where(
    and(eq(youthProspectsTable.teamId, team.id), eq(youthProspectsTable.status, "pending")),
  );

  res.json(prospects.map(serializeProspect));
});

router.post("/youth-scouting/prospects/:id/sign", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
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

  // Budget check
  const budget = Number(team.budget ?? 0);
  if (budget < prospect.signingCost) {
    res.status(422).json({
      error: `Insufficient funds. Signing ${prospect.name} costs $${prospect.signingCost.toLocaleString()}.`,
    });
    return;
  }

  // Youth Academy capacity check (max 6 players age 14–18)
  const youthPlayers = (await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id }))
    .filter((p) => p.age >= 14 && p.age <= 18);
  if (youthPlayers.length >= 6) {
    res.status(422).json({
      error: "Youth Academy is full (6/6). Release a youth player before signing a new one.",
    });
    return;
  }

  // Build player stats from prospect rating + speciality
  const stats = buildStats(prospect.currentRating, prospect.speciality);

  // Pick nationality from continent pool
  const natPool    = NATIONALITIES[prospect.continent] ?? ["USA"];
  const nationality = natPool[Math.floor(Math.random() * natPool.length)]!;

  // Position: Setters favour serve/defense; Spikers favour power/speed/block
  const position = ["Serve", "Defense"].includes(prospect.speciality) ? "setter" : "spiker";

  // Youth salary: based on potential stars per academy contract rules
  const YOUTH_WEEKLY_WAGE: Record<string, number> = {
    Low: 50, Average: 75, High: 100, Elite: 150, Generational: 250,
  };
  const salary = YOUTH_WEEKLY_WAGE[prospect.potentialStars] ?? 75;

  const today = new Date().toISOString().split("T")[0]!;
  const contractEnd = new Date();
  contractEnd.setFullYear(contractEnd.getFullYear() + 3);
  const endDate = contractEnd.toISOString().split("T")[0]!;

  // Insert the player into the youth squad (reserve role, not active)
  const newPlayer = await createCareerPlayer(
    requireCareerSaveId(req.activeCareerSaveId),
    {
      name:          prospect.name,
      nationality,
      baseAge:       prospect.age,
      height:        Number((1.60 + Math.random() * 0.18).toFixed(1)),
      position,
      continent:     prospect.continent,
      potential:     prospect.potentialStars,
      eliteEventType: prospect.eliteEventType ?? undefined,
      ...stats,
      imageUrl:    "/objects/youth-cards/youth-card.webp",
      development: generateDevelopment(),
    },
    {
      age:           prospect.age,
      teamId:        team.id,
      isActive:      false,
      squadRole:     "reserve",
      isDraftPlayer: false,
      isRetired:     false,
      injuryStatus:  "Healthy",
      salary,
      academyContractYears: 2.0,
      morale:        75 + Math.floor(Math.random() * 16),
      fatigue:       0,
      fitness:       100,
      discoveredBy:  prospect.discoveredBy ?? null,
    },
  );

  // Contract (3-year youth deal)
  await db.insert(contractsTable).values({
    playerId:    newPlayer.id,
    teamId:      team.id,
    salary,
    startDate:   today,
    endDate,
    bonusPerWin: 250,
  });

  // Deduct signing fee
  await db.update(teamsTable)
    .set({ budget: budget - prospect.signingCost })
    .where(eq(teamsTable.id, team.id));

  // Finance transaction
  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      prospect.signingCost,
    description: `Youth signing — ${prospect.name}`,
    category:    "youth_academy",
    date:        today,
  });

  // Mark prospect as signed → removes from pending list
  const [updated] = await db.update(youthProspectsTable)
    .set({ status: "signed" })
    .where(eq(youthProspectsTable.id, prospectId))
    .returning();

  // Update career stats and check achievements
  try {
    await updateCareerStats(team.id, (s) => ({ ...s, youthSigned: s.youthSigned + 1 }));
    await checkAchievements(team.id);
  } catch {
    // non-critical
  }

  res.json(serializeProspect(updated));
});

router.post("/youth-scouting/prospects/:id/ignore", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
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
  const team = await getActiveTeam(req);
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

  const updated = await getActiveTeam(req);
  if (!updated) { res.status(404).json({ error: "No team" }); return; }
  res.json(serializeMission(updated));
});

export default router;
