import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { refusalReason } from "../utils/squadRules.js";
import { isYouthPlayer } from "../utils/playerClassification.js";
import { loadPlayers, loadPlayer, updatePlayerState, requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { academyCountTx } from "../utils/youthLoans.js";
import { academyMonthlySalary } from "../utils/academy.js";
import { db } from "@workspace/db";
import { contractsTable, playersTable, teamsTable, calendarStateTable } from "@workspace/db";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import type { Contract } from "@workspace/db";
import { checkSpendingAllowed } from "../utils/board-confidence.js";
import { getGameDate } from "../utils/gameDate.js";
import { getActiveSeason } from "../lib/getActiveSeason.js";
import { seasonEndsFrom } from "../utils/seasonDates.js";
import {
  contractEndDate, renewalEndDate, releasePayout, readContractLength,
} from "../utils/contractTerms.js";
import { financeTransactionsTable } from "@workspace/db";
import { marketPrice, youthPrice, isRevealed } from "../utils/marketScouting.js";

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
  // C15: a youth at an AI club's academy (hers, or on loan there) is not on the
  // market; she can only come on loan, from Team > Youth Loans.
  if (player.poolTeamId != null) {
    res.status(422).json({ error: `${player.name} is at an AI club's academy: she can only join you on loan (Team > Youth Loans).` });
    return;
  }
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
        // C15: her own youths out on loan still count: they come back.
        youth:       withCareerStateTx((w) => academyCountTx(w.tx, requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id })),
      },
      { isYouth, squadRole },
    );
    if (refusal) { res.status(422).json({ error: refusal }); return; }
  }

  // ── Her price (Unity brief item 15, Rob's design) ──────────────────────────
  // A senior signed off the market costs her price, once, on top of her wage.
  // The caller must confirm it (the page's confirm step): the exact price if
  // this club has scouted her, otherwise the range, and the exact price is then
  // revealed and charged. Overnight 30 Sep, item 12: a youth player off the
  // market (no club) has a price too ($500-$2,000 by talent), by the same
  // rules and the same confirm step.
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const priceDay = await getGameDate(team.id);
  const fee = isYouth ? (player.teamId == null ? youthPrice(cid, player) : null) : marketPrice(cid, player);
  const blind = fee != null && !isRevealed(player, team.id, priceDay);
  if (fee) {
    if (req.body?.confirm !== true) {
      res.status(400).json({
        error: blind
          ? `Confirm the price first: ${player.name} costs between $${fee.low.toLocaleString()} and $${fee.high.toLocaleString()}; the exact price is revealed when she signs.`
          : `Confirm the price first: ${player.name} costs $${fee.price.toLocaleString()}.`,
        needsConfirm: true,
        priceRange: { low: fee.low, high: fee.high },
        price: blind ? null : fee.price,
      });
      return;
    }
    // Blind, the club must be able to pay the top of the range: whether it can
    // pay the exact price would give the price away.
    const mustHave = blind ? fee.high : fee.price;
    if (Number(team.budget) < mustHave) {
      res.status(422).json({ error: `Not enough money: ${player.name} costs ${blind ? `up to $${fee.high.toLocaleString()}` : `$${fee.price.toLocaleString()}`}, the club has $${Math.round(Number(team.budget)).toLocaleString()}.` });
      return;
    }
  }

  // Overnight brief 30 Sep, item 32 (Rob, Q-8): the club she leaves is paid her price.
  const sellingTeamId = player.teamId != null && player.teamId !== team.id ? player.teamId : null;

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
  // Overnight 1 Oct, N-33: a youth is paid the academy's wage for her talent
  // (utils/academy.ts, about $325-$650 a month; it is what the weekly run bills
  // her), whatever the box sends: the offer used to default to $5,000 a month.
  const wage = isYouth ? academyMonthlySalary(player.potential) : Number(salary);

  const [contract] = await db.insert(contractsTable).values({
    playerId: Number(playerId),
    teamId: team.id,
    salary: wage,
    startDate: today,
    endDate: actualEnd,
    bonusPerWin: Number(bonusPerWin ?? 0),
  }).returning();

  // Squad membership is career state, not a property of the athlete.
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), Number(playerId), {
    teamId: team.id,
    salary: wage,
    contractEndDate: actualEnd,
    isActive: squadRole === "starter" || squadRole === "interchange",
    squadRole,
  });

  // Item 15: her price, charged and on the ledger.
  if (fee) {
    await db.insert(financeTransactionsTable).values({
      teamId: team.id, type: "expense", amount: fee.price, category: "signing_fee", date: today,
      description: `Signing fee: ${player.name}${blind ? ` (signed unscouted: $${fee.low.toLocaleString()}-$${fee.high.toLocaleString()})` : ""}`,
    });
    await db.update(teamsTable).set({ budget: Number(team.budget) - fee.price }).where(eq(teamsTable.id, team.id));
    // Item 32: bought from another club in the transfer window, the fee is that
    // club's: on its balance and its ledger. (It was charged and paid to nobody.)
    if (sellingTeamId != null) {
      const [seller] = await db.select().from(teamsTable).where(eq(teamsTable.id, sellingTeamId));
      if (seller) {
        await db.update(teamsTable).set({ budget: Number(seller.budget) + fee.price }).where(eq(teamsTable.id, seller.id));
        await db.insert(financeTransactionsTable).values({
          teamId: seller.id, type: "income", amount: fee.price, category: "transfer_fee", date: today,
          description: `Transfer fee: ${player.name} sold to ${team.name}`,
        });
      }
    }
  }
  const signed = await loadPlayer(cid, Number(playerId));

  res.status(201).json({
    ...serializeContract(contract),
    // What signing her revealed: her price, and (blind) her attributes.
    fee: fee ? fee.price : 0,
    priceRange: fee ? { low: fee.low, high: fee.high } : null,
    signedBlind: blind,
    player: signed ? {
      id: signed.id, name: signed.name, speed: signed.speed, power: signed.power, defense: signed.defense,
      serve: signed.serve, block: signed.block, stamina: signed.stamina,
    } : null,
  });
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
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid contract id" }); return; }

  // The contract has to be YOURS. Every other route on this file checks it and
  // this one did not: it took the id it was given, released that player from
  // this career's squad and charged the payout to whichever club was active.
  // Nothing could reach it, because the only list of contract ids a client
  // ever sees is its own club's (GET /contracts is team-scoped) - but "no
  // caller does that today" is not the same as a rule, and terminating
  // somebody else's contract is not a thing this route should be able to do.
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  // Resolve the player before mutating anything
  const contract = await db.query.contractsTable.findFirst({ where: eq(contractsTable.id, id) });
  if (!contract || contract.teamId !== team.id) {
    res.status(404).json({ error: "Contract not found" });
    return;
  }

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
  // cost the club nothing at all, so there was no reason not to. P-05: except
  // the starting squad in a new career's first game week (releasePayout).
  const today = await getGameDate(team.id);
  const payout = releasePayout(contract, today);

  const [terminated] = await db.update(contractsTable).set({ status: "terminated" }).where(eq(contractsTable.id, id)).returning();
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), contract.playerId, { teamId: null, contractEndDate: null, isActive: false, squadRole: "reserve" });

  if (payout > 0) {
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
