import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { loadPlayers, loadPlayer, updatePlayerState, updatePlayerReference, createCareerPlayer, requireCareerSaveId, type PlayerDTO, type CareerPlayerFields, loadStaff, careerSaveIdForTeamOrThrow } from "../lib/playerDto.js";
import {
  isSeniorPlayer, isYouthPlayer, isSparePlayer, YOUTH_AGE_MIN, YOUTH_AGE_MAX,
} from "../utils/playerClassification.js";
import { RETIREMENT_AGE } from "../utils/seasonRollover.js";
import { db } from "@workspace/db";
import { playersTable, teamsTable, staffTable, trophiesTable, financeTransactionsTable, calendarStateTable } from "@workspace/db";
import {
  CONTINENT_KEYS, CONTINENT_LABEL, RESERVE_NATIONS, PLAYERS_PER_NATION,
  coreNationsFor, isCoreNation, isReserveNation, isContinentKey, type ContinentKey,
} from "@workspace/db";

// The youngest a senior may be. Not in continents.ts because it is a gameplay
// rule, not a shape-of-the-world one; the old endpoint hardcoded 18 inline.
const SENIOR_AGE_MIN = 18;
import { eq, isNull, isNotNull, and, sql, inArray } from "drizzle-orm";
import { generateDevelopment } from "../utils/player-development";
import { getGameDate } from "../utils/gameDate.js";

const router = Router();

// Strips hidden engine fields before sending to client
const serializePlayer = (p: PlayerDTO) => {
  const { potential: _p, development: _d, ...rest } = p;
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
  const players = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  res.json(players.map(serializePlayer));
});

router.post("/players", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, nationality, age, height, position, speed, power, defense, serve, block, stamina, salary } = req.body;
  const created = await createCareerPlayer(
    requireCareerSaveId(req.activeCareerSaveId),
    {
    name, nationality,
    baseAge: Number(age), height: Number(height),
    position,
    speed: Number(speed), power: Number(power),
    defense: Number(defense), serve: Number(serve),
    block: Number(block), stamina: Number(stamina),
    potential:   assignPotential(),
    development: generateDevelopment(),
  },
    { age: Number(age), salary: Number(salary) },
  );
  res.status(201).json(serializePlayer(created));
});

router.get("/players/free-agents", async (req, res) => {
  const freeAgents = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { freeAgents: true });
  // Senior free agents only — youth players have their own pool endpoint
  res.json(
    freeAgents
      .filter(p => !p.isDraftPlayer && p.academyContractYears == null && isSeniorPlayer(p))
      .map(serializePlayer)
  );
});

// Transfer window — contracted senior players whose contract expires within 6 months
router.get("/players/transfer-window", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(401).json({ error: "No team" }); return; }

  // Get current game date from this user's calendar state
  const calRows = await db.select({ currentDate: calendarStateTable.currentDate })
    .from(calendarStateTable).where(eq(calendarStateTable.teamId, team.id)).limit(1);
  const currentDate = calRows[0]?.currentDate ?? new Date().toISOString().split("T")[0]!;

  // 6-month window cutoff
  const cutoff = new Date(currentDate);
  cutoff.setMonth(cutoff.getMonth() + 6);
  const cutoffStr = cutoff.toISOString().split("T")[0]!;

  // Contracted seniors whose deal expires inside the six-month window.
  const inWindow = (await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { playerType: "senior" }))
    .filter((p) =>
      p.teamId != null &&
      p.contractEndDate != null &&
      p.contractEndDate >= currentDate &&
      p.contractEndDate <= cutoffStr);

  // Attach current team name to each player
  const teamIds = [...new Set(inWindow.map(p => p.teamId!))];
  const teamRows = teamIds.length > 0
    ? await db.select({ id: teamsTable.id, name: teamsTable.name })
        .from(teamsTable).where(inArray(teamsTable.id, teamIds))
    : [];
  const teamMap = Object.fromEntries(teamRows.map(t => [t.id, t.name]));

  res.json(inWindow.map(p => ({
    ...serializePlayer(p),
    currentTeamName: p.teamId ? (teamMap[p.teamId] ?? null) : null,
    currentTeamId: p.teamId ?? null,
  })));
});

// Youth free agent pool — only youth players not on any team
router.get("/players/youth-pool", async (req, res) => {
  const { continent } = req.query;
  const youth = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { freeAgents: true });
  let result = youth.filter(p => isYouthPlayer(p) && p.academyContractYears == null);
  if (continent && typeof continent === "string") {
    result = result.filter(p => p.continent === continent);
  }
  res.json(result.map(serializePlayer));
});

/**
 * World integrity check for THIS career.
 *
 * ── What was wrong with the old version ─────────────────────────────────────
 * It asserted 60 seniors, 60 youth, and ten of each per continent. Reality is
 * 192 and 72, so it reported a world a third of the size and had been failing
 * against nothing for as long as anyone had bothered to call it — which,
 * judging by the frontend, is never. It was noise wearing a validator's name.
 *
 * The numbers were not merely stale, they were the wrong KIND of assertion.
 * This endpoint runs against a career in progress, where seniors retire, youth
 * are promoted into the senior pool, and everyone ages a year at each boundary.
 * Totals are SUPPOSED to move. A fixed expected count could only ever be right
 * on the first day of a new save.
 *
 * ── What it asserts now ─────────────────────────────────────────────────────
 * Only things that must hold at every point in a career, every one of them
 * derived from what lib/db/src/schema/continents.ts DECLARES rather than
 * restated here. Nothing below hardcodes "ten" or "three"; adding a nation or
 * changing squad depth needs no edit to this file.
 *
 *   - every continent value is a canonical key
 *   - every nationality belongs to the declared world (core or reserve)
 *   - a youth's nationality is a core nation OF HER OWN REGION. This is the
 *     season-two trap check-roster.cjs exists for: promotion turns her into a
 *     senior of that nationality, silently widening the world and stranding
 *     her without team-mates, months after the save was made.
 *   - ages sit in their band, and no ACTIVE senior is at or past RETIREMENT_AGE
 *
 * Counts are REPORTED, not asserted, for the reason above. A nation dropping
 * below PLAYERS_PER_NATION after a retirement is normal, so it surfaces as an
 * observation rather than an error — the starter database is where that has to
 * be exact, and scripts/check-roster.cjs already holds it there on every build.
 */
router.get("/players/validation", async (req, res) => {
  const all = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId));

  const seniors = all.filter(p => isSeniorPlayer(p));
  const youth   = all.filter(p => isYouthPlayer(p));
  const spares  = all.filter(p => isSparePlayer(p));

  // Counted per canonical KEY. This endpoint used to carry its own list of
  // label strings — one of the seven vocabularies that drifted apart — so a
  // player stored as "Africa and Middle East" counted zero against
  // "Africa & Middle East" and the validator reported a phantom shortfall.
  const seniorByCont = Object.fromEntries(
    CONTINENT_KEYS.map(c => [c, seniors.filter(p => p.continent === c).length])
  );
  const youthByCont = Object.fromEntries(
    CONTINENT_KEYS.map(c => [c, youth.filter(p => p.continent === c).length])
  );

  const errors: string[] = [];
  const where = (p: PlayerDTO) => `${p.name} (#${p.id})`;

  // ── invariant: continent is a canonical key ───────────────────────────────
  for (const p of all) {
    if (!isContinentKey(p.continent)) {
      errors.push(`${where(p)}: continent "${p.continent}" is not a canonical key`);
    }
  }

  // ── invariant: nationality belongs to the declared world ──────────────────
  for (const p of all) {
    if (!isCoreNation(p.nationality) && !isReserveNation(p.nationality)) {
      errors.push(
        `${where(p)}: nationality "${p.nationality}" is in neither CORE_NATIONS ` +
        `nor RESERVE_NATIONS`
      );
    }
  }

  // ── invariant: a youth belongs to a core nation of HER OWN region ─────────
  for (const p of youth) {
    const core = coreNationsFor(p.continent);
    if (!core.includes(p.nationality)) {
      errors.push(
        `${where(p)}: youth from ${p.nationality}, which is not a core nation of ` +
        `${CONTINENT_LABEL[p.continent as ContinentKey] ?? p.continent}. On promotion ` +
        `she becomes a senior of that nation with no team-mates.`
      );
    }
  }

  // ── invariant: ages sit in their band ─────────────────────────────────────
  //
  // Being at or past RETIREMENT_AGE is deliberately NOT in here. The season
  // boundary retires those players by design, so a veteran in the starter data
  // is a one-season character rather than a broken row. It is reported below
  // instead, because it is still worth seeing.
  const ageViolations = all
    .filter(p =>
      (isSeniorPlayer(p) && p.age < SENIOR_AGE_MIN) ||
      (isYouthPlayer(p)  && (p.age < YOUTH_AGE_MIN || p.age > YOUTH_AGE_MAX))
    )
    .map(p => ({
      id: p.id, name: p.name, age: p.age,
      // The EFFECTIVE type, not the reference one: reporting a promoted player
      // as "youth" here is what made the mismatch invisible in the first place.
      playerType: isYouthPlayer(p) ? "youth" : "senior",
      isRetired: p.isRetired,
    }));
  for (const v of ageViolations) {
    errors.push(
      `${v.name} (#${v.id}): ${v.playerType} aged ${v.age} is outside the permitted band`
    );
  }

  // ── observations: counts move legitimately, so they only ever report ──────
  const activeSeniors = seniors.filter(p => !p.isRetired);
  // Active, and already old enough that the next boundary retires them. Normal
  // mid-career; in the STARTER data it means a nation loses a player at the end
  // of season one. Martha Kera (Solomon Islands, 37) is the shipped example —
  // six years older than any other senior, and her card says 37, so the age is
  // what the artwork claims rather than a typo. Reported, not failed: whether
  // she is a deliberate one-season veteran is a design question.
  const activePastRetirementAge = seniors
    .filter(p => !p.isRetired && p.age >= RETIREMENT_AGE)
    .map(p => ({ id: p.id, name: p.name, nationality: p.nationality, age: p.age }));

  const shortNations = CONTINENT_KEYS.flatMap(c =>
    coreNationsFor(c)
      .map(nation => ({
        continent: c,
        nation,
        active: activeSeniors.filter(p => p.nationality === nation).length,
      }))
      .filter(n => n.active < PLAYERS_PER_NATION)
  );

  res.json({
    valid: errors.length === 0,
    // What the world is DECLARED to be, so a caller can see the rule rather
    // than having to know it.
    declared: {
      continents: CONTINENT_KEYS.length,
      coreNationsPerContinent: Object.fromEntries(
        CONTINENT_KEYS.map(c => [c, coreNationsFor(c).length])
      ),
      reserveNations: RESERVE_NATIONS.length,
      playersPerNation: PLAYERS_PER_NATION,
      retirementAge: RETIREMENT_AGE,
      youthAgeBand: [YOUTH_AGE_MIN, YOUTH_AGE_MAX],
    },
    totalPlayers: all.length,
    seniorCount:  seniors.length,
    activeSeniorCount: activeSeniors.length,
    youthCount:   youth.length,
    spareCount:   spares.length,
    seniorByCont,
    youthByCont,
    ageViolations,
    // Not errors: the season boundary handles both by design.
    activePastRetirementAge,
    // Not an error: retirement legitimately takes a nation below full strength
    // mid-career. The starter database is held exact by check-roster.cjs.
    nationsBelowFullStrength: shortNations,
    errors,
  });
});

/**
 * Market summary counts.
 *
 * This read the reference table directly and had been quietly wrong since
 * squad membership moved to career state: `hasteam` was hardcoded to 0, so
 * signedCount was ALWAYS 0 and every signed player was counted as a free
 * agent. It compiled, so nothing caught it. Retirement and draft status have
 * now moved too, which is what finally broke the build.
 *
 * Counting from the career's own merged view fixes all three at once.
 */
router.get("/players/summary", async (req, res) => {
  const all = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), {
    playerType: "senior",
  });

  const totalSenior    = all.length;
  const freeAgentCount = all.filter(p => !p.teamId && !p.isDraftPlayer).length;
  const draftPoolCount = all.filter(p => p.isDraftPlayer && !p.teamId).length;
  const signedCount    = all.filter(p => p.teamId).length;

  res.json({ totalSenior, freeAgentCount, draftPoolCount, signedCount });
});

// All senior players with status — powers the Player Market filter pills
router.get("/players/market-all", async (req, res) => {
  const all = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { playerType: "senior" });

  // Build team name lookup for signed players
  const teamIdSet = [...new Set(all.filter(p => p.teamId).map(p => p.teamId!))];
  const teamMap: Record<number, string> = {};
  if (teamIdSet.length > 0) {
    const teams = await db.select({ id: teamsTable.id, name: teamsTable.name })
      .from(teamsTable)
      .where(inArray(teamsTable.id, teamIdSet));
    for (const t of teams) teamMap[t.id] = t.name;
  }

  // Compute 6-month transfer window from authenticated user's game date
  let currentDate = new Date().toISOString().split("T")[0]!;
  let transferCutoff: string | null = null;
  if (req.isAuthenticated()) {
    const team = await getActiveTeam(req);
    if (team) {
      const calRows = await db.select({ currentDate: calendarStateTable.currentDate })
        .from(calendarStateTable).where(eq(calendarStateTable.teamId, team.id)).limit(1);
      if (calRows[0]?.currentDate) {
        currentDate = calRows[0].currentDate;
        const cutoff = new Date(currentDate);
        cutoff.setMonth(cutoff.getMonth() + 6);
        transferCutoff = cutoff.toISOString().split("T")[0]!;
      }
    }
  }

  const result = all.map(p => {
    let status: "signed" | "free_agent" | "player_pool" | "transfer_available";
    if (p.teamId) {
      const inWindow = transferCutoff && p.contractEndDate
        && p.contractEndDate >= currentDate
        && p.contractEndDate <= transferCutoff;
      status = inWindow ? "transfer_available" : "signed";
    } else if (p.isDraftPlayer) {
      status = "player_pool";
    } else {
      status = "free_agent";
    }
    return {
      ...serializePlayer(p),
      status,
      currentTeamName: p.teamId ? (teamMap[p.teamId] ?? null) : null,
      currentTeamId: p.teamId ?? null,
      isDraftPlayer: p.isDraftPlayer,
    };
  });

  res.json(result);
});

router.get("/players/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), id);
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(serializePlayer(player));
});

router.patch("/players/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  const id = parseInt(req.params.id);
  const existing = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), id);
  if (!existing) { res.status(404).json({ error: "Player not found" }); return; }
  if (existing.teamId !== team.id) { res.status(403).json({ error: "Not your player" }); return; }
  const {
    name, nationality, continent, age, position,
    speed, power, defense, serve, block, stamina,
    potential, scoutedPotential,
    isActive, morale,
  } = req.body;
  const updates: Partial<CareerPlayerFields> = {};


  if (age             !== undefined) updates.age             = Number(age);

  if (speed           !== undefined) updates.speed           = Number(speed);
  if (power           !== undefined) updates.power           = Number(power);
  if (defense         !== undefined) updates.defense         = Number(defense);
  if (serve           !== undefined) updates.serve           = Number(serve);
  if (block           !== undefined) updates.block           = Number(block);
  if (stamina         !== undefined) updates.stamina         = Number(stamina);
  if (scoutedPotential !== undefined) updates.scoutedPotential = scoutedPotential ?? null;
  if (isActive        !== undefined) updates.isActive        = isActive;
  if (morale          !== undefined) updates.morale          = morale;

  // Reference fields go to the athlete, career fields to this career's state.
  // These used to share one object cast `as Partial<CareerPlayerFields>` — the
  // cast defeated the check and let reference fields through into a
  // career-state write.
  const refUpdates: Partial<typeof playersTable.$inferInsert> = {};
  if (name        !== undefined) refUpdates.name        = name;
  if (nationality !== undefined) refUpdates.nationality = nationality;
  if (position !== undefined) refUpdates.position = position;
  if (potential !== undefined) refUpdates.potential = potential;
  if (continent !== undefined) refUpdates.continent = continent;
  await updatePlayerReference(id, refUpdates);

  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), id, updates);
  const updated = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), id);
  if (!updated) { res.status(404).json({ error: "Player not found" }); return; }
  res.json({ ...serializePlayer(updated), potential: updated.potential, scoutedPotential: updated.scoutedPotential });
});

router.patch("/players/:id/outfit", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const { outfitId } = req.body;
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), id, { outfitId: Number(outfitId) });
  const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), id);
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(serializePlayer(player));
});

router.post("/players/:id/release", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);

  // Fetch before clearing so we can capture teamId and age for the transaction log
  const before = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), id);

  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), id, { teamId: null, contractEndDate: null, academyContractYears: null, isActive: false, squadRole: "reserve" });
  const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), id);

  // Record a Youth Academy release transaction so it appears in Transaction History
  if (before?.teamId && before.age >= 14 && before.age <= 18) {
    const today = await getGameDate(before.teamId);
    await db.insert(financeTransactionsTable).values({
      teamId:      before.teamId,
      type:        "expense",
      amount:      0,
      description: `${before.name} released from Youth Academy`,
      category:    "other",
      date:        today,
    });
  }

  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(serializePlayer(player));
});

router.post("/players/:id/retire", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);

  const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), id);
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

  // Retirement is career state; the legend fields that belong to the athlete
  // (peak rating, honours, legend score) stay on the reference row.
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), id, {
    isRetired: true,
    isActive: false,
    contractEndDate: null,
    careerWins: team.wins,
    retiredSeasonYear,
    // Achieved inside THIS career, counted from THIS career's trophies.
    peakOverallRating,
    careerTitles,
    continentalTitles,
    worldTitles,
    olympicMedalsCount,
    legendScore,
    careerSeasons: 1,
  });

  const retired = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), id);
  if (!retired) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(serializePlayer(retired));
});

router.post("/players/:id/scout", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const playerId = parseInt(req.params.id);
  const player   = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), playerId);
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const team = await getActiveTeam(req);
  if (!team)  { res.status(404).json({ error: "No team found" }); return; }

  const allStaff = await loadStaff(await careerSaveIdForTeamOrThrow(team.id), { teamId: team.id });
  const scouts   = allStaff.filter(s =>
    ["head_coach", "assistant_coach", "scout"].includes(s.role)
  );

  if (scouts.length === 0) {
    res.status(400).json({ error: "No Head Coach or Assistant Coach on staff. Hire one to assess player potential." });
    return;
  }

  const bestScout = scouts.reduce((a, b) => a.overallRating > b.overallRating ? a : b);
  const { scoutedPotential, confidence } = computeScoutedPotential(player.potential, bestScout.overallRating);

  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), playerId, { scoutedPotential });
  const updated = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), playerId);
  if (!updated) { res.status(404).json({ error: "Player not found" }); return; }

  res.json({
    player:          serializePlayer(updated),
    scoutedPotential,
    confidence,
    scoutName:   bestScout.name,
    scoutRating: bestScout.overallRating,
  });
});

export default router;
