import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { contractsTable, playersTable, teamsTable, calendarStateTable } from "@workspace/db";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";

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
  const { playerId, salary, endDate, bonusPerWin, squadRole: rawSquadRole } = req.body;

  // Youth academy capacity check (max 6 players aged 14–18)
  const player = await db.query.playersTable.findFirst({ where: eq(playersTable.id, Number(playerId)) });
  if (!player) { res.status(404).json({ error: "Player not found." }); return; }
  const isYouth = player.age >= 14 && player.age <= 18;

  if (isYouth) {
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

  // Resolve squad role: validate and apply age guards
  const validRoles = ["starter", "interchange", "reserve"] as const;
  type SquadRole = typeof validRoles[number];
  let squadRole: SquadRole;

  if (rawSquadRole && validRoles.includes(rawSquadRole as SquadRole)) {
    squadRole = rawSquadRole as SquadRole;
  } else {
    // Sensible default if omitted
    squadRole = isYouth ? "reserve" : "interchange";
  }

  // Guard: senior players (age 19+) cannot be placed in youth reserve
  if (!isYouth && squadRole === "reserve") {
    res.status(422).json({ error: "Players aged 19 or older cannot be assigned to the Youth Team." });
    return;
  }

  // Transfer window enforcement — if player is already contracted to another team,
  // they can only be approached in the last 6 months of their contract.
  if (player.teamId !== null) {
    if (player.teamId === team.id) {
      res.status(422).json({ error: "This player is already on your team. Use the Contracts page to renew their contract." });
      return;
    }
    const calRows = await db.select({ currentDate: calendarStateTable.currentDate })
      .from(calendarStateTable).where(eq(calendarStateTable.teamId, team.id)).limit(1);
    const currentDate = calRows[0]?.currentDate ?? new Date().toISOString().split("T")[0]!;
    const windowEnd = new Date(currentDate);
    windowEnd.setMonth(windowEnd.getMonth() + 6);
    const windowEndStr = windowEnd.toISOString().split("T")[0]!;

    if (!player.contractEndDate || player.contractEndDate > windowEndStr) {
      res.status(422).json({
        error: "This player is under contract and cannot be approached until the last 6 months of their contract.",
      });
      return;
    }
    // In transfer window — terminate existing contract so player can be signed
    await db.update(contractsTable).set({ status: "terminated" })
      .where(and(eq(contractsTable.playerId, player.id), eq(contractsTable.status, "active")));
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
    isActive: squadRole === "starter" || squadRole === "interchange",
    squadRole,
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
