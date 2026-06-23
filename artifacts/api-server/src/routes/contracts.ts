import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { contractsTable, playersTable, teamsTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";

const router = Router();

const serializeContract = (c: any) => ({
  ...c,
  salary: Number(c.salary),
  bonusPerWin: Number(c.bonusPerWin),
});


router.get("/contracts", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
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
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { playerId, salary, endDate, bonusPerWin } = req.body;

  // Youth academy capacity check (max 6 players aged 14–18)
  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, Number(playerId)) });
  if (player && player.age >= 14 && player.age <= 18) {
    const existingYouths = await db.select()
      .from(playersTable)
      .where(and(
        eq(playersTable.teamId, team.id),
        gte(playersTable.age, 14),
        lte(playersTable.age, 18),
        eq(playersTable.isRetired, false),
      ));
    if (existingYouths.length >= 6) {
      res.status(422).json({ error: "Youth Academy is full (6/6). Promote, draft, sell, or release a youth player before signing another." });
      return;
    }
  }

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

  // Resolve the player before mutating anything
  const contract = await db.query.contractsTable.findFirst({ where: eq(contractsTable.id, id) });
  if (!contract) { res.status(404).json({ error: "Contract not found" }); return; }

  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, contract.playerId) });

  // Development Rights Protection: academy players cannot have their contract terminated directly.
  // They may only leave via Promotion, Sale, Draft Entry, or Release.
  if (player?.academyContractYears != null) {
    res.status(403).json({
      error: "Development Rights Protection: this player is under an academy contract and cannot be approached or released via contract termination. Use Promotion, Sale, Draft Entry, or Release instead.",
    });
    return;
  }

  const [terminated] = await db.update(contractsTable).set({ status: "terminated" }).where(eq(contractsTable.id, id)).returning();
  await db.update(playersTable).set({ teamId: null, contractEndDate: null }).where(eq(playersTable.id, contract.playerId));
  res.json(serializeContract(terminated));
});

export default router;
