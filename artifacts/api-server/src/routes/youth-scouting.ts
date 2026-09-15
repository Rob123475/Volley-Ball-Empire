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
import { refusalReason } from "../utils/squadRules.js";
import { academySize, academyMonthlySalary } from "../utils/academy.js";
import type { Team, YouthProspect } from "@workspace/db";
import {
  CONTINENT_KEYS, continentKeyFrom, continentLabel, isContinentKey, type ContinentKey,
} from "@workspace/db";

const router = Router();

// Keyed by the canonical continent KEY. This file used to spell Africa
// "Africa" while the database said "Africa and Middle East", so scouting there
// silently fell through to "Unknown" talent and an empty nationality pool.
// `Record<ContinentKey, ...>` means a missing or misspelt key is now a compile
// error rather than an undefined at runtime.
const TALENT_LEVEL: Record<ContinentKey, string> = {
  africa_middle_east: "High",
  asia:               "Average",
  europe:             "Elite",
  north_america:      "High",
  south_america:      "High",
  oceania:            "Average",
};

const SCOUTING_WEEKS = 4;
export const SCOUTING_COST = 15_000;

// ── Nationality pools by continent ────────────────────────────────────────

const NATIONALITIES: Record<ContinentKey, string[]> = {
  europe:             ["Germany", "France", "Italy", "Spain", "Norway", "Sweden", "Netherlands",
                       "Poland", "Denmark", "Switzerland", "Greece", "Portugal", "Austria", "Belgium",
                       "Russia", "Czech Republic", "Finland", "Croatia", "Serbia", "Ukraine",
                       "Hungary", "England", "Ireland", "Malta", "Monaco"],
  africa_middle_east: ["Ghana", "Nigeria", "Kenya", "South Africa", "Senegal", "Egypt", "Morocco",
                       "Tunisia", "Tanzania", "Zimbabwe", "Mozambique", "Madagascar", "Cameroon",
                       "Algeria", "Burkina Faso", "Ivory Coast", "Guinea"],
  north_america:      ["USA", "Canada", "Mexico", "Cuba", "Jamaica", "Dominican Republic",
                       "Puerto Rico", "Panama", "Costa Rica", "Bahamas"],
  south_america:      ["Brazil", "Colombia", "Argentina", "Chile", "Peru", "Venezuela",
                       "Ecuador", "Bolivia", "Uruguay", "Guyana"],
  asia:               ["Japan", "South Korea", "China", "India", "Thailand", "Indonesia",
                       "Philippines", "Vietnam", "Malaysia", "Taiwan", "Laos", "Maldives"],
  oceania:            ["Australia", "New Zealand", "Fiji", "Samoa", "Tahiti",
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
    ? (TALENT_LEVEL[team.youthScoutingContinent as ContinentKey] ?? "Unknown")
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
  const continentKey = continentKeyFrom(continent);
  if (!continentKey) {
    res.status(400).json({ error: `continent must be one of: ${CONTINENT_KEYS.join(", ")}` });
    return;
  }

  const budget = Number(team.budget ?? 0);
  if (budget < SCOUTING_COST) {
    res.status(422).json({ error: `Insufficient funds. Scouting costs $${SCOUTING_COST.toLocaleString()}.` });
    return;
  }

  const today = await getGameDate(team.id);

  const [updated] = await db.update(teamsTable).set({
    youthScoutingContinent:      continentKey,
    youthScoutingStatus:         "active",
    youthScoutingWeeksRemaining: SCOUTING_WEEKS,
    budget:                      budget - SCOUTING_COST,
  }).where(eq(teamsTable.id, team.id)).returning();

  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      SCOUTING_COST,
    description: `Youth scouting — ${continentLabel(continentKey)}`,
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

  // R-63: the academy's limit is ACADEMY_CAP, asked of the same signing rule
  // POST /contracts uses and counted the way the intake counts it.
  const squad = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  const academyFull = refusalReason(
    { starters: 0, interchange: 0, seniors: 0, youth: academySize(squad) },
    { isYouth: true, squadRole: "reserve" },
  );
  if (academyFull) {
    res.status(422).json({ error: academyFull });
    return;
  }

  // Build player stats from prospect rating + speciality
  const stats = buildStats(prospect.currentRating, prospect.speciality);

  // Pick nationality from continent pool
  const natPool    = isContinentKey(prospect.continent)
    ? NATIONALITIES[prospect.continent]
    : ["USA"];
  const nationality = natPool[Math.floor(Math.random() * natPool.length)]!;

  // Position: Setters favour serve/defense; Spikers favour power/speed/block
  const position = ["Serve", "Defense"].includes(prospect.speciality) ? "setter" : "spiker";

  // R-63: the academy wage for her potential (utils/academy.ts), stored as its
  // monthly figure and billed once a week in the weekly wage run.
  const salary = academyMonthlySalary(prospect.potentialStars);

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
      // player_type defaults to "senior", so omitting it created every scouted
      // 16-year-old as a SENIOR with an academy contract — they never entered
      // the youth pool at all, and the academy had no pipeline whatsoever.
      playerType:    "youth",
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
