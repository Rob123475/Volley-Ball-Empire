import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const serializeTeam = (t: any) => ({ ...t, budget: Number(t.budget) });

const serializePlayer = (p: any) => ({
  ...p,
  height: Number(p.height),
  salary: Number(p.salary),
  squadRole: p.squadRole ?? "reserve",
});

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

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
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  res.json(serializeTeam(team));
});

router.post("/team", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, locationId, logoColor } = req.body;
  const [team] = await db.insert(teamsTable).values({
    userId: req.user.id,
    name,
    locationId: Number(locationId),
    logoColor,
  }).returning();
  res.status(201).json(serializeTeam(team));
});

router.patch("/team", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  const { name, locationId, logoColor, trainingPhilosophy } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (locationId !== undefined) updates.locationId = Number(locationId);
  if (logoColor !== undefined) updates.logoColor = logoColor;
  if (trainingPhilosophy !== undefined) updates.trainingPhilosophy = trainingPhilosophy;
  const [updated] = await db.update(teamsTable).set(updates).where(eq(teamsTable.id, team.id)).returning();
  res.json(serializeTeam(updated));
});

router.get("/team/roster", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  const players = await db.select().from(playersTable).where(and(eq(playersTable.teamId, team.id), eq(playersTable.isRetired, false)));
  const staff   = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  res.json(buildRosterResponse(team, players, staff));
});

// ── Set a player's squad role ───────────────────────────────────────────────
router.patch("/team/roster/:id/role", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const playerId = Number(req.params.id);
  const { role } = req.body as { role: string };

  if (!["starter", "interchange", "reserve"].includes(role)) {
    res.status(400).json({ error: "role must be starter, interchange, or reserve" });
    return;
  }

  // Derive isActive from role for backward-compat with match simulation
  const isActive = role !== "reserve";

  await db.update(playersTable)
    .set({ squadRole: role, isActive })
    .where(eq(playersTable.id, playerId));

  const players = await db.select().from(playersTable).where(and(eq(playersTable.teamId, team.id), eq(playersTable.isRetired, false)));
  const staff   = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  res.json(buildRosterResponse(team, players, staff));
});

// ── Legacy swap endpoint (kept for any remaining callers) ───────────────────
router.post("/team/swap-player", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const { playerInId, playerOutId } = req.body;
  await db.update(playersTable).set({ isActive: true,  squadRole: "starter" }).where(eq(playersTable.id, Number(playerInId)));
  await db.update(playersTable).set({ isActive: false, squadRole: "reserve"  }).where(eq(playersTable.id, Number(playerOutId)));

  const players = await db.select().from(playersTable).where(and(eq(playersTable.teamId, team.id), eq(playersTable.isRetired, false)));
  const staff   = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  res.json(buildRosterResponse(team, players, staff));
});

export default router;
