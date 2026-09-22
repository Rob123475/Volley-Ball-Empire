import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { refusalReason } from "../utils/squadRules.js";
import { isYouthPlayer } from "../utils/playerClassification.js";
import { loadPlayers, loadPlayer, updatePlayerState, requireCareerSaveId } from "../lib/playerDto.js";
import { db } from "@workspace/db";
import { contractsTable, playersTable, teamsTable, calendarStateTable } from "@workspace/db";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import type { Contract } from "@workspace/db";
import { checkSpendingAllowed } from "../utils/board-confidence.js";
import { getGameDate } from "../utils/gameDate.js";
import { getActiveSeason } from "../lib/getActiveSeason.js";
import { seasonEndsFrom } from "../utils/seasonDates.js";
import {
  contractEndDate, renewalEndDate, terminationPayout, readContractLength,
} from "../utils/contractTerms.js";
import { financeTransactionsTable } from "@workspace/db";

const router = Router();



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

  const { playerId, salary, bonusPerWin, squadRole: rawSquadRole } = req.body;
  const wanted = readContractLength(req.body);
  if ("error" in wanted) { res.status(400).json({ error: wanted.error }); return; }

  const player = await loadPlayer(requireCareerSaveId(req.activeCareerSaveId), Number(playerId));
  if (!player) { res.status(404).json({ error: "Player not found." }); return; }
  // R-63: an academy player is a youth player not yet promoted — the same test
  // the intake and the Team page use.
  const isYouth = isYouthPlayer(player);

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
  // Two on the sand, one interchange, and an academy of ACADEMY_CAP. The limits
  // live in utils/squadRules.ts so the numbers are stated once; this route only
  // counts what is already signed and asks whether one more is allowed. R-63:
  // academy players are counted as the intake and the Team page count them —
  // youth players not yet promoted — not by an age guess.
  {
    const squad = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
    const youthNow = squad.filter(isYouthPlayer);
    const seniorNow = squad.filter((p) => !isYouthPlayer(p));
    // L-02d: a club's own graduates are held on top of the squad, under their
    // own cap of GRADUATE_CAP. They still take a place on the sand like anybody
    // else, so they count toward the starter and interchange slots — but they
    // do not fill the three signing places, or a club that developed four
    // players could never sign another.
    const signedSeniors = seniorNow.filter((p) => !(p.playerType === "youth" && p.isPromoted));
    const refusal = refusalReason(
      {
        starters:    seniorNow.filter((p) => p.squadRole === "starter").length,
        interchange: seniorNow.filter((p) => p.squadRole === "interchange").length,
        seniors:     signedSeniors.length,
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
  // computer's date, so a contract signed in an in-game season could start and
  // end in whatever year the machine was in.
  // L-02a: the end date is the length Rob allows, resolved against the real
  // seasons — the caller no longer supplies a date at all.
  const today = await getGameDate(team.id);
  const cidForTerm = requireCareerSaveId(req.activeCareerSaveId);
  const actualEnd = contractEndDate(wanted.length, today, await seasonEndsFrom(cidForTerm, today));

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

  const wantedRenewal = readContractLength(req.body);
  if ("error" in wantedRenewal) { res.status(400).json({ error: wantedRenewal.error }); return; }

  // The new term runs on from where the old one ends, not from today — and it
  // must run PAST it. A contract that already ends on the last day of the
  // season is the normal case here (the guard above only lets a deal be renewed
  // in its final season), and a renewal measured from a list that still
  // contains that very date handed back the same date: the renewal appeared to
  // succeed, changed nothing, and the player walked at the boundary anyway.
  // Thirty-season runs then lost whole squads to R-48 abandonment.
  const newEnd = renewalEndDate(
    wantedRenewal.length, contract.endDate, await seasonEndsFrom(cid, contract.endDate),
  );
  if (newEnd <= contract.endDate) {
    res.status(409).json({ error: "A renewal must end after the contract it renews." });
    return;
  }
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

  // L-02a, Rob's rule: "Club ends a contract early -> the remainder of the
  // contract is paid out from the club balance." Before this, tearing up a deal
  // cost the club nothing at all, so there was no reason not to.
  const team = await getActiveTeam(req);
  const today = team ? await getGameDate(team.id) : contract.startDate;
  const payout = terminationPayout(Number(contract.salary), today, contract.endDate);

  const [terminated] = await db.update(contractsTable).set({ status: "terminated" }).where(eq(contractsTable.id, id)).returning();
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), contract.playerId, { teamId: null, contractEndDate: null, isActive: false, squadRole: "reserve" });

  if (team && payout > 0) {
    await db.update(teamsTable)
      .set({ budget: Number(team.budget) - payout })
      .where(eq(teamsTable.id, team.id));
    await db.insert(financeTransactionsTable).values({
      teamId:      team.id,
      type:        "expense",
      amount:      payout,
      description: `Contract paid out — ${player?.name ?? "player"} released to ${contract.endDate}`,
      category:    "player_salary",
      date:        today,
    });
  }

  res.json({ ...serializeContract(terminated), payout });
});

export default router;
