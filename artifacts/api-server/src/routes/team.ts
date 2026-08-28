import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { loadPlayers, loadPlayer, updatePlayerState, requireCareerSaveId, type PlayerDTO, loadStaff, careerSaveIdForTeamOrThrow } from "../lib/playerDto.js";
import { db } from "@workspace/db";
import { teamsTable, playersTable, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { updateCareerStats, checkAchievements } from "../utils/check-achievements";
import type { Team } from "@workspace/db";

const router = Router();

const serializeTeam = (t: Team) => ({ ...t, budget: Number(t.budget) });

const serializePlayer = (p: PlayerDTO) => ({
  ...p,
  height: Number(p.height),
  salary: Number(p.salary),
  squadRole: p.squadRole ?? "reserve",
});


const buildRosterResponse = (team: any, players: any[], staff: any[]) => {
  const sp = players.map(serializePlayer);
  const starters    = sp.filter(p => p.squadRole === "starter");
  const interchanges = sp.filter(p => p.squadRole === "interchange");
  const reserves    = sp.filter(p => p.squadRole === "reserve");
  return {
    team: serializeTeam(team),
    starters,
    interchanges,
    reserves,
    // legacy fields — keeps match simulation + other pages working unchanged
    activePlayers: [...starters, ...interchanges],
    benchPlayers: reserves,
    staff: staff.map(s => ({ ...s, salary: Number(s.salary) })),
  };
};

router.get("/team", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  res.json(serializeTeam(team));
});

router.post("/team", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, locationId, logoColor, crestShapeIndex } = req.body;
  const [team] = await db.insert(teamsTable).values({
    userId: req.user.id,
    name,
    locationId: Number(locationId),
    logoColor,
    crestShapeIndex: crestShapeIndex ?? null,
  }).returning();
  res.status(201).json(serializeTeam(team));
});

router.patch("/team", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  const { name, locationId, logoColor, crestShapeIndex, trainingPhilosophy } = req.body;
  const updates: Partial<typeof teamsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (locationId !== undefined) updates.locationId = Number(locationId);
  if (logoColor !== undefined) updates.logoColor = logoColor;
  if (crestShapeIndex !== undefined) updates.crestShapeIndex = crestShapeIndex;
  if (trainingPhilosophy !== undefined) updates.trainingPhilosophy = trainingPhilosophy;
  const [updated] = await db.update(teamsTable).set(updates).where(eq(teamsTable.id, team.id)).returning();
  res.json(serializeTeam(updated));
});

router.get("/team/roster", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  const players = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  const staff   = await loadStaff(await careerSaveIdForTeamOrThrow(team.id), { teamId: team.id });
  res.json(buildRosterResponse(team, players, staff));
});

// ── Set a player's squad role ───────────────────────────────────────────────
router.patch("/team/roster/:id/role", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const playerId = Number(req.params.id);
  const { role } = req.body as { role: string };

  if (!["starter", "interchange", "reserve"].includes(role)) {
    res.status(400).json({ error: "role must be starter, interchange, or reserve" });
    return;
  }

  // Youth players under 18 (age 14–17) may not be promoted to starter or interchange
  if (role === "starter" || role === "interchange") {
    const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), playerId);
    if (player && player.age >= 14 && player.age <= 17) {
      res.status(422).json({ error: "Youth players under 18 cannot occupy Match Player or Interchange slots." });
      return;
    }
  }

  // Derive isActive from role for backward-compat with match simulation
  const isActive = role !== "reserve";

  // When an 18-year-old youth player is promoted, their academy contract ends
  const promotedPlayer = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), playerId);
  const endsAcademyContract =
    (role === "starter" || role === "interchange") &&
    promotedPlayer?.age === 18 &&
    promotedPlayer?.academyContractYears != null;

  const isYouthPromotion =
    (role === "starter" || role === "interchange") &&
    promotedPlayer?.academyContractYears != null;

  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), playerId, {
    squadRole: role,
    isActive,
    ...(endsAcademyContract ? { academyContractYears: null } : {}),
  });

  // Track youth promotions for achievements
  if (isYouthPromotion) {
    try {
      await updateCareerStats(team.id, (s) => ({ ...s, youthPromoted: s.youthPromoted + 1 }));
      await checkAchievements(team.id);
    } catch {
      // non-critical
    }
  }

  const players = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  const staff   = await loadStaff(await careerSaveIdForTeamOrThrow(team.id), { teamId: team.id });
  res.json(buildRosterResponse(team, players, staff));
});

// ── Youth training focus ──────────────────────────────────────────────────────

const VALID_FOCUSES = ["Attack", "Defence", "Serving", "Blocking", "Athleticism", "Leadership"];

router.patch("/players/:id/training-focus", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const playerId = Number(req.params.id);
  const { focus } = req.body as { focus: string };

  const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), playerId);
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  if (player.teamId !== team.id) { res.status(403).json({ error: "Not your player" }); return; }
  if (player.age < 14 || player.age > 18) {
    res.status(400).json({ error: "Training focus can only be set for youth players aged 14–18." });
    return;
  }

  const newFocus = focus && VALID_FOCUSES.includes(focus) ? focus : null;
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), playerId, {
    trainingFocus: newFocus,
  });
  const updated = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), playerId);
  if (!updated) { res.status(404).json({ error: "Player not found" }); return; }

  res.json({ ...updated, height: Number(updated.height), salary: Number(updated.salary) });
});

// ── Team Strength Overview ───────────────────────────────────────────────────
const POSITIONS = ["setter", "spiker", "defender", "blocker", "all_rounder"] as const;

const playerOvr = (p: { power: number; speed: number; defense: number; serve: number; block: number }) =>
  Math.round((p.power + p.speed + p.defense + p.serve + p.block) / 5);

router.get("/team/strength", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const allPlayers = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });

  const activePlayers = allPlayers.filter(p => p.squadRole === "starter" || p.squadRole === "interchange");
  const evalPlayers   = activePlayers.length > 0 ? activePlayers : allPlayers;

  const positions: Record<string, { rating: number; playerCount: number; topPlayer: string | null }> = {};

  for (const pos of POSITIONS) {
    const group = evalPlayers.filter(p => p.position === pos);
    if (group.length === 0) {
      positions[pos] = { rating: 0, playerCount: 0, topPlayer: null };
    } else {
      const sorted = [...group].sort((a, b) => playerOvr(b) - playerOvr(a));
      const avgRating = Math.round(group.reduce((sum, p) => sum + playerOvr(p), 0) / group.length);
      positions[pos] = { rating: avgRating, playerCount: group.length, topPlayer: sorted[0].name };
    }
  }

  const ratedPositions = POSITIONS.filter(p => positions[p].playerCount > 0);
  const strongestPosition = ratedPositions.length > 0
    ? ratedPositions.reduce((a, b) => positions[a].rating >= positions[b].rating ? a : b)
    : null;
  const weakestPosition = ratedPositions.length > 0
    ? ratedPositions.reduce((a, b) => positions[a].rating <= positions[b].rating ? a : b)
    : null;

  const overallRating = evalPlayers.length > 0
    ? Math.round(evalPlayers.reduce((sum, p) => sum + playerOvr(p), 0) / evalPlayers.length)
    : 0;

  res.json({
    overallRating,
    totalActivePlayers: activePlayers.length,
    strongestPosition,
    weakestPosition,
    positions,
  });
});

// ── Legacy swap endpoint (kept for any remaining callers) ───────────────────
router.post("/team/swap-player", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const { playerInId, playerOutId } = req.body;
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), Number(playerInId),  { isActive: true,  squadRole: "starter" });
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), Number(playerOutId), { isActive: false, squadRole: "reserve"  });

  const players = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  const staff   = await loadStaff(await careerSaveIdForTeamOrThrow(team.id), { teamId: team.id });
  res.json(buildRosterResponse(team, players, staff));
});

export default router;
