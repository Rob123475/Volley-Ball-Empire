import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, teamsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";

const router = Router();

const serializePlayer = (p: any) => ({
  ...p,
  height: Number(p.height),
  salary: Number(p.salary),
  askingPrice: p.askingPrice ? Number(p.askingPrice) : null,
});

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
};

router.get("/players", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
  res.json(players.map(serializePlayer));
});

router.post("/players", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { name, nationality, age, height, position, speed, power, defense, serve, block, stamina, salary } = req.body;
  const [player] = await db.insert(playersTable).values({
    name, nationality, age: Number(age), height: String(height),
    position, speed: Number(speed), power: Number(power),
    defense: Number(defense), serve: Number(serve), block: Number(block),
    stamina: Number(stamina), salary: String(salary),
  }).returning();
  res.status(201).json(serializePlayer(player));
});

router.get("/players/free-agents", async (req, res) => {
  const freeAgents = await db.select().from(playersTable)
    .where(isNull(playersTable.teamId));
  res.json(freeAgents.filter(p => !p.isDraftPlayer).map(serializePlayer));
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
  if (name !== undefined) updates.name = name;
  if (isActive !== undefined) updates.isActive = isActive;
  if (morale !== undefined) updates.morale = morale;
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
  const [player] = await db.update(playersTable).set({ teamId: null, contractEndDate: null }).where(eq(playersTable.id, id)).returning();
  res.json(serializePlayer(player));
});

export default router;
