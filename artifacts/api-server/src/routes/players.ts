import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { playersTable, teamsTable, staffTable, trophiesTable, financeTransactionsTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";

const router = Router();

// Strips the true `potential` before sending to client — always hidden
const serializePlayer = (p: any) => {
  const { potential: _hidden, ...rest } = p;
  return {
    ...rest,
    height:      Number(rest.height),
    salary:      Number(rest.salary),
    askingPrice: rest.askingPrice ? Number(rest.askingPrice) : null,
  };
};


// ── Potential helpers ─────────────────────────────────────────────────────────

const POTENTIAL_TIERS = ["Low", "Average", "High", "Elite", "Generational"] as const;

function assignPotential(): string {
  const rand = Math.random();
  if (rand < 0.15) return "Low";
  if (rand < 0.50) return "Average";
  if (rand < 0.80) return "High";
  if (rand < 0.95) return "Elite";
  return "Generational";
}

function computeScoutedPotential(
  truePotential: string,
  scoutRating: number,
): { scoutedPotential: string; confidence: "uncertain" | "likely" | "confident" } {
  const trueIdx = POTENTIAL_TIERS.indexOf(truePotential as any);
  const idx = trueIdx < 0 ? 2 : trueIdx;

  // accuracy: 0 at rating 30, 1.0 at rating 99
  const accuracy = Math.max(0, Math.min(1, (scoutRating - 30) / 69));
  const rand = Math.random();

  let offset = 0;
  if (rand > accuracy) {
    const direction = Math.random() < 0.55 ? -1 : 1;
    const magnitude = scoutRating < 50 && Math.random() < 0.4 ? 2 : 1;
    offset = direction * magnitude;
  }

  const revealedIdx = Math.max(0, Math.min(4, idx + offset));
  const confidence: "uncertain" | "likely" | "confident" =
    scoutRating < 50 ? "uncertain" :
    scoutRating < 75 ? "likely"    : "confident";

  return { scoutedPotential: POTENTIAL_TIERS[revealedIdx], confidence };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get("/players", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }
  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  res.json(players.map(serializePlayer));
});

router.post("/players", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, nationality, age, height, position, speed, power, defense, serve, block, stamina, salary } = req.body;
  const [player] = await db.insert(playersTable).values({
    name, nationality,
    age: Number(age), height: String(height),
    position,
    speed: Number(speed), power: Number(power),
    defense: Number(defense), serve: Number(serve),
    block: Number(block), stamina: Number(stamina),
    salary: String(salary),
    potential: assignPotential(),
  }).returning();
  res.status(201).json(serializePlayer(player));
});

router.get("/players/free-agents", async (req, res) => {
  const freeAgents = await db.select().from(playersTable)
    .where(and(isNull(playersTable.teamId), eq(playersTable.isRetired, false)));
  // Senior free agents only — youth players have their own pool endpoint
  res.json(
    freeAgents
      .filter(p => !p.isDraftPlayer && p.academyContractYears == null && p.playerType === "senior")
      .map(serializePlayer)
  );
});

// Youth free agent pool — only youth players not on any team
router.get("/players/youth-pool", async (req, res) => {
  const { continent } = req.query;
  const youth = await db.select().from(playersTable)
    .where(and(isNull(playersTable.teamId), eq(playersTable.isRetired, false)));
  let result = youth.filter(p => p.playerType === "youth" && p.academyContractYears == null);
  if (continent && typeof continent === "string") {
    result = result.filter(p => p.continent === continent);
  }
  res.json(result.map(serializePlayer));
});

// Validation endpoint — checks all 120-player rules
router.get("/players/validation", async (req, res) => {
  const all = await db.select().from(playersTable).where(eq(playersTable.isRetired, false));

  const seniors = all.filter(p => p.playerType === "senior");
  const youth   = all.filter(p => p.playerType === "youth");

  const CONTINENTS = ["Africa", "Asia", "Europe", "North America", "South America", "Oceania"];

  const seniorByCont = Object.fromEntries(
    CONTINENTS.map(c => [c, seniors.filter(p => p.continent === c).length])
  );
  const youthByCont = Object.fromEntries(
    CONTINENTS.map(c => [c, youth.filter(p => p.continent === c).length])
  );

  const ageViolations = all.filter(p =>
    (p.playerType === "senior" && (p.age < 18 || p.age > 40)) ||
    (p.playerType === "youth"  && (p.age < 14 || p.age > 18))
  ).map(p => ({ id: p.id, name: p.name, age: p.age, playerType: p.playerType }));

  const errors: string[] = [];
  if (seniors.length !== 60) errors.push(`Senior count is ${seniors.length}, expected 60`);
  if (youth.length   !== 60) errors.push(`Youth count is ${youth.length}, expected 60`);
  CONTINENTS.forEach(c => {
    if (seniorByCont[c] !== 10) errors.push(`Senior ${c}: ${seniorByCont[c]} (expected 10)`);
    if (youthByCont[c]  !== 10) errors.push(`Youth ${c}: ${youthByCont[c]} (expected 10)`);
  });
  if (ageViolations.length > 0) errors.push(`${ageViolations.length} age violation(s)`);

  res.json({
    valid: errors.length === 0,
    totalPlayers: all.length,
    seniorCount:  seniors.length,
    youthCount:   youth.length,
    seniorByCont,
    youthByCont,
    ageViolations,
    errors,
  });
});

router.get("/players/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, id) });
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(serializePlayer(player));
});

router.patch("/players/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { name, isActive, morale } = req.body;
  const updates: any = {};
  if (name     !== undefined) updates.name     = name;
  if (isActive !== undefined) updates.isActive = isActive;
  if (morale   !== undefined) updates.morale   = morale;
  const [player] = await db.update(playersTable).set(updates).where(eq(playersTable.id, id)).returning();
  res.json(serializePlayer(player));
});

router.patch("/players/:id/outfit", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { outfitId } = req.body;
  const [player] = await db.update(playersTable).set({ outfitId: Number(outfitId) }).where(eq(playersTable.id, id)).returning();
  res.json(serializePlayer(player));
});

router.post("/players/:id/release", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);

  // Fetch before clearing so we can capture teamId and age for the transaction log
  const before = await db.query.playersTable.findFirst({ where: eq(playersTable.id, id) });

  const [player] = await db.update(playersTable).set({ teamId: null, contractEndDate: null, academyContractYears: null }).where(eq(playersTable.id, id)).returning();

  // Record a Youth Academy release transaction so it appears in Transaction History
  if (before?.teamId && before.age >= 14 && before.age <= 18) {
    const today = new Date().toISOString().split("T")[0];
    await db.insert(financeTransactionsTable).values({
      teamId:      before.teamId,
      type:        "expense",
      amount:      "0",
      description: `${before.name} released from Youth Academy`,
      category:    "other",
      date:        today,
    });
  }

  res.json(serializePlayer(player));
});

router.post("/players/:id/retire", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);

  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, id) });
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const team = await getActiveTeam(req);
  if (!team || player.teamId !== team.id) { res.status(403).json({ error: "Not your player" }); return; }

  const peakOverallRating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);

  const trophies = await db.select().from(trophiesTable).where(eq(trophiesTable.teamId, team.id));
  const careerTitles      = trophies.filter(t => ["world_championship", "continental_championship", "grand_final"].includes(t.type)).length;
  const continentalTitles = trophies.filter(t => t.type === "continental_championship").length;
  const worldTitles       = trophies.filter(t => t.type === "world_championship").length;
  const olympicMedalsCount = trophies.filter(t => ["olympic_gold", "olympic_silver", "olympic_bronze"].includes(t.type)).length;

  const legendScore =
    worldTitles * 20 +
    olympicMedalsCount * 15 +
    continentalTitles * 10 +
    careerTitles * 5 +
    Math.max(0, peakOverallRating - 70) * 2;

  const retiredSeasonYear = new Date().getFullYear();

  const [retired] = await db.update(playersTable).set({
    isRetired: true,
    isActive: false,
    contractEndDate: null,
    peakOverallRating,
    careerWins: team.wins,
    careerTitles,
    continentalTitles,
    worldTitles,
    olympicMedalsCount,
    legendScore,
    retiredSeasonYear,
    careerSeasons: 1,
  }).where(eq(playersTable.id, id)).returning();

  res.json(serializePlayer(retired));
});

router.post("/players/:id/scout", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const playerId = parseInt(req.params.id);
  const player   = await db.query.playersTable.findFirst({ where: eq(playersTable.id, playerId) });
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const team = await getActiveTeam(req);
  if (!team)  { res.status(404).json({ error: "No team found" }); return; }

  const allStaff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  const scouts   = allStaff.filter(s =>
    ["head_coach", "assistant_coach", "scout"].includes(s.role)
  );

  if (scouts.length === 0) {
    res.status(400).json({ error: "No Head Coach or Assistant Coach on staff. Hire one to assess player potential." });
    return;
  }

  const bestScout = scouts.reduce((a, b) => a.overallRating > b.overallRating ? a : b);
  const { scoutedPotential, confidence } = computeScoutedPotential(player.potential, bestScout.overallRating);

  const [updated] = await db.update(playersTable)
    .set({ scoutedPotential })
    .where(eq(playersTable.id, playerId))
    .returning();

  res.json({
    player:          serializePlayer(updated),
    scoutedPotential,
    confidence,
    scoutName:   bestScout.name,
    scoutRating: bestScout.overallRating,
  });
});

export default router;
