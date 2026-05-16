import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, staffTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

const serializeTeam = (t: any) => ({
  ...t,
  budget: Number(t.budget),
});

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
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
  const { name, locationId, logoColor } = req.body;
  const updates: any = {};
  if (name !== undefined) updates.name = name;
  if (locationId !== undefined) updates.locationId = Number(locationId);
  if (logoColor !== undefined) updates.logoColor = logoColor;
  const [updated] = await db.update(teamsTable).set(updates).where(eq(teamsTable.id, team.id)).returning();
  res.json(serializeTeam(updated));
});

router.get("/team/roster", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  const activePlayers = players.filter(p => p.isActive).map(p => ({ ...p, height: Number(p.height), salary: Number(p.salary) }));
  const benchPlayers = players.filter(p => !p.isActive).map(p => ({ ...p, height: Number(p.height), salary: Number(p.salary) }));

  res.json({
    team: serializeTeam(team),
    activePlayers,
    benchPlayers,
    staff: staff.map(s => ({ ...s, salary: Number(s.salary) })),
  });
});

router.post("/team/swap-player", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const { playerInId, playerOutId } = req.body;
  await db.update(playersTable).set({ isActive: true }).where(eq(playersTable.id, Number(playerInId)));
  await db.update(playersTable).set({ isActive: false }).where(eq(playersTable.id, Number(playerOutId)));

  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));

  res.json({
    team: serializeTeam(team),
    activePlayers: players.filter(p => p.isActive).map(p => ({ ...p, height: Number(p.height), salary: Number(p.salary) })),
    benchPlayers: players.filter(p => !p.isActive).map(p => ({ ...p, height: Number(p.height), salary: Number(p.salary) })),
    staff: staff.map(s => ({ ...s, salary: Number(s.salary) })),
  });
});

export default router;
