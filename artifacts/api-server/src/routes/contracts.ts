import { Router } from "express";
import { db } from "@workspace/db";
import { contractsTable, playersTable, teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

const serializeContract = (c: any) => ({
  ...c,
  salary: Number(c.salary),
  bonusPerWin: Number(c.bonusPerWin),
});

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
};

router.get("/contracts", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const contracts = await db.select().from(contractsTable).where(
    and(eq(contractsTable.teamId, team.id), eq(contractsTable.status, "active"))
  );
  const withPlayers = await Promise.all(contracts.map(async (c) => {
    const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, c.playerId) });
    return { ...serializeContract(c), player: player ? { ...player, height: Number(player.height), salary: Number(player.salary) } : null };
  }));
  res.json(withPlayers);
});

router.post("/contracts", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { playerId, salary, endDate, bonusPerWin } = req.body;

  const today = new Date().toISOString().split("T")[0];
  const maxEnd = new Date();
  maxEnd.setFullYear(maxEnd.getFullYear() + 1);
  const maxEndStr = maxEnd.toISOString().split("T")[0];
  const actualEnd = endDate > maxEndStr ? maxEndStr : endDate;

  const [contract] = await db.insert(contractsTable).values({
    playerId: Number(playerId),
    teamId: team.id,
    salary: String(salary),
    startDate: today,
    endDate: actualEnd,
    bonusPerWin: String(bonusPerWin ?? 0),
  }).returning();

  await db.update(playersTable).set({
    teamId: team.id,
    salary: String(salary),
    contractEndDate: actualEnd,
    isActive: true,
  }).where(eq(playersTable.id, Number(playerId)));

  res.status(201).json(serializeContract(contract));
});

router.get("/contracts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const contract = await db.query.contractsTable.findFirst({ where: eq(contractsTable.id, id) });
  if (!contract) { res.status(404).json({ error: "Contract not found" }); return; }
  res.json(serializeContract(contract));
});

router.delete("/contracts/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [contract] = await db.update(contractsTable).set({ status: "terminated" }).where(eq(contractsTable.id, id)).returning();
  await db.update(playersTable).set({ teamId: null, contractEndDate: null }).where(eq(playersTable.id, contract.playerId));
  res.json(serializeContract(contract));
});

export default router;
