import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { refusalReason } from "../utils/squadRules.js";
import { loadPlayers, loadPlayer, updatePlayerState, requireCareerSaveId } from "../lib/playerDto.js";
import { db } from "@workspace/db";
import { contractsTable, playersTable, teamsTable, calendarStateTable } from "@workspace/db";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import type { Contract } from "@workspace/db";
import { checkSpendingAllowed } from "../utils/board-confidence.js";
import { getGameDate } from "../utils/gameDate.js";
import { getActiveSeason } from "../lib/getActiveSeason.js";

const router = Router();

/** One year after a `YYYY-MM-DD` date; 29 February lands on 28 February. */
function addOneYear(date: string): string {
  const [y, m, d] = date.split("-");
  const day = m === "02" && d === "29" ? "28" : d;
  return `${Number(y) + 1}-${m}-${day}`;
}

const serializeContract = (c: Contract) => ({
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
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const withPlayers = await Promise.all(contracts.map(async (c) => {
    const player = await loadPlayer(cid, c.playerId);
    return {
      ...serializeContract(c),
      player: player ? { ...player, height: Number(player.height), salary: Number(player.salary) } : null,
    };
  }));
  res.json(withPlayers);
});

router.post("/contracts", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const spendingBlocked = await checkSpendingAllowed(requireCareerSaveId(req.activeCareerSaveId));
  if (spendingBlocked) { res.status(403).json({ error: spendingBlocked }); return; }

  const { playerId, salary, endDate, bonusPerWin, squadRole: rawSquadRole } = req.body;

  const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), Number(playerId));
  if (!player) { res.status(404).json({ error: "Player not found." }); return; }
  const isYouth = player.age >= 14 && player.age <= 18;

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

  // ── Squad size ──────────────────────────────────────────────────────────
  // Two on the sand, one interchange, one in the academy. The limits live in
  // utils/squadRules.ts so the numbers are stated once; this route only counts
  // what is already signed and asks whether one more is allowed.
  {
    const squad = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
    const youthNow = squad.filter((p) => p.age >= 14 && p.age <= 18);
    const seniorNow = squad.filter((p) => !(p.age >= 14 && p.age <= 18));
    const refusal = refusalReason(
      {
        starters:    seniorNow.filter((p) => p.squadRole === "starter").length,
        interchange: seniorNow.filter((p) => p.squadRole === "interchange").length,
        seniors:     seniorNow.length,
        youth:       youthNow.length,
      },
      { isYouth, squadRole },
    );
    if (refusal) { res.status(422).json({ error: refusal }); return; }
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

  // R-51: dated on the GAME clock. `new Date()` stamped a contract with the
  // computer's date and capped it a year after THAT, so a contract signed in an
  // in-game season could start and end in whatever year the machine was in.
  const today = await getGameDate(team.id);
  const maxEndStr = addOneYear(today);
  const actualEnd = endDate > maxEndStr ? maxEndStr : endDate;

  const [contract] = await db.insert(contractsTable).values({
    playerId: Number(playerId),
    teamId: team.id,
    salary: Number(salary),
    startDate: today,
    endDate: actualEnd,
    bonusPerWin: Number(bonusPerWin ?? 0),
  }).returning();

  // Squad membership is career state, not a property of the athlete.
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), Number(playerId), {
    teamId: team.id,
    salary: Number(salary),
    contractEndDate: actualEnd,
    isActive: squadRole === "starter" || squadRole === "interchange",
    squadRole,
  });

  res.status(201).json(serializeContract(contract));
});

/**
 * R-51: renew a contract for one more season, on the same terms.
 *
 * There was no renewal anywhere: signing a player already in the squad was
 * refused with "use the Contracts page to renew", and that page could only
 * terminate. A squad could therefore only ever run out of contract.
 *
 * - allowed once the contract ends within the current season (its final
 *   season), so renewals cannot be stacked years ahead
 * - the new end date is one year after the old one; salary and bonus unchanged
 * - R-52: a spending freeze blocks NEW spending, not keeping the squad you
 *   have on the same terms. Renewing at the current salary (the default) or
 *   less goes through a freeze; a raise is new spending and needs the board,
 *   exactly as a signing does. (It used to gate every renewal, so a frozen
 *   club with money in the bank lost its whole squad at the next boundary
 *   and forfeited season after season.)
 */
router.post("/contracts/:id/renew", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid contract id" }); return; }

  const contract = await db.query.contractsTable.findFirst({ where: eq(contractsTable.id, id) });
  if (!contract || contract.teamId !== team.id) { res.status(404).json({ error: "Contract not found" }); return; }
  if (contract.status !== "active") {
    res.status(409).json({ error: "Only an active contract can be renewed." });
    return;
  }

  const currentSalary = Number(contract.salary);
  const rawSalary = (req.body ?? {}).salary;
  const newSalary = rawSalary == null ? currentSalary : Number(rawSalary);
  if (!Number.isFinite(newSalary) || newSalary < 0) {
    res.status(400).json({ error: "salary must be a non-negative number" });
    return;
  }
  // R-52: only a raise is new spending, so only a raise meets the freeze.
  if (newSalary > currentSalary) {
    const spendingBlocked = await checkSpendingAllowed(requireCareerSaveId(req.activeCareerSaveId));
    if (spendingBlocked) {
      res.status(403).json({ error: `${spendingBlocked} A renewal on the same terms is still allowed.` });
      return;
    }
  }

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const player = await loadPlayer(cid, contract.playerId);
  if (!player || player.teamId !== team.id) {
    res.status(409).json({ error: "This player is no longer in your squad." });
    return;
  }
  if (player.academyContractYears != null) {
    res.status(403).json({ error: "Academy contracts are managed by the youth academy, not renewed here." });
    return;
  }

  const season = await getActiveSeason(req);
  if (!season) { res.status(409).json({ error: "No active season" }); return; }
  if (contract.endDate > season.endDate) {
    res.status(409).json({
      error: `This contract already runs past this season (to ${contract.endDate}). It can be renewed in its final season.`,
    });
    return;
  }

  const newEnd = addOneYear(contract.endDate);
  const [renewed] = await db.update(contractsTable)
    .set({ endDate: newEnd, salary: newSalary })
    .where(eq(contractsTable.id, id))
    .returning();
  await updatePlayerState(cid, contract.playerId, { contractEndDate: newEnd, salary: newSalary });

  res.json(serializeContract(renewed));
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

  const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), contract.playerId);

  // Development Rights Protection: academy players cannot have their contract terminated directly.
  // They may only leave via Promotion, Sale, Draft Entry, or Release.
  if (player?.academyContractYears != null) {
    res.status(403).json({
      error: "Development Rights Protection: this player is under an academy contract and cannot be approached or released via contract termination. Use Promotion, Sale, Draft Entry, or Release instead.",
    });
    return;
  }

  const [terminated] = await db.update(contractsTable).set({ status: "terminated" }).where(eq(contractsTable.id, id)).returning();
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), contract.playerId, { teamId: null, contractEndDate: null, isActive: false, squadRole: "reserve" });
  res.json(serializeContract(terminated));
});

export default router;
