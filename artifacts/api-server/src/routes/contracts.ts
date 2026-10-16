import { Router } from "express";
import { afterSquadChange } from "../utils/injuredList.js";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { refusalReason } from "../utils/squadRules.js";
import { isYouthPlayer } from "../utils/playerClassification.js";
import { loadPlayers, loadPlayer, updatePlayerState, requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { academyCountTx, placeSignedYouthTx } from "../utils/youthLoans.js";
import { canSellTx } from "../utils/aiSquads.js";
import { bidTx, renewalRefusalTx, releaseRefusalTx } from "../utils/transfers.js";
import { contractEndFrom } from "../utils/transferWindow.js";
import { academyMonthlySalary } from "../utils/academy.js";
import { db } from "@workspace/db";
import { contractsTable, playersTable, teamsTable, continentalPoolTeamsTable, perksText, perksMonthly } from "@workspace/db";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import type { Contract } from "@workspace/db";
import { checkSpendingAllowed } from "../utils/board-confidence.js";
import { getGameDate, gameDateText } from "../utils/gameDate.js";
import { getActiveSeason } from "../lib/getActiveSeason.js";
import { seasonEndsFrom } from "../utils/seasonDates.js";
import {
  renewalEndDate, terminationPayout, readContractLength,
} from "../utils/contractTerms.js";
import { financeTransactionsTable } from "@workspace/db";
import { marketPrice, youthPrice, isRevealed } from "../utils/marketScouting.js";
import { askingWage, freeAgentInjuryWeeks } from "../utils/wageCurve.js";
import { monthlySalaryFor } from "../utils/clubFinances.js";
import { overallRating } from "../utils/overallRating.js";
import { seniorWageBill, committedWageBill, wageCapRefusal, wageCapView, renewalCapRefusal } from "../utils/salaryCap.js";
import { day1DraftOpen, undoDraftPickTx } from "../utils/day1Draft.js";
import { specialityFactor } from "../utils/managerFaces.js";

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
  // Update 1, item 4a (C-4): what each senior asks to renew (the wage for her
  // current rating) and whether it fits under the cap, so the page never offers
  // a renewal the server then refuses.
  const contractsExpert = specialityFactor(team.id, "Contracts Expert");
  const withPlayers = await Promise.all(contracts.map(async (c) => {
    const player = await loadPlayer(cid, c.playerId);
    const ask = player && !isYouthPlayer(player) ? renewalAsk(player, contractsExpert) : null;
    return {
      ...serializeContract(c),
      player: player ? { ...player, height: Number(player.height), salary: Number(player.salary) } : null,
      renewal: ask == null ? null : { wage: ask, capRefusal: renewalCapRefusal(cid, { teamId: team.id }, c.endDate ?? null, Number(c.salary) + perksMonthly(player?.perks ?? ""), ask + perksMonthly(player?.perks ?? "")) },
    };
  }));
  res.json(withPlayers);
});

/** Update 1, item 4a: "Senior wages $X of $60,000", and the room left, for the screens. */
router.get("/contracts/wage-cap", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  res.json(wageCapView(seniorWageBill(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id })));
});

/**
 * Update 1, item 4a (C-4): what a senior asks at renewal: the wage for her
 * CURRENT rating (utils/clubFinances.ts monthlySalaryFor, the AI clubs' rule
 * too), less 10% at a Contracts Expert's club. A player who has improved asks more.
 */
function renewalAsk(player: Parameters<typeof overallRating>[0], contractsExpert: number): number {
  return askingWage(monthlySalaryFor(overallRating(player)), contractsExpert);
}

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
  // C15: a youth at an AI club's academy (hers, or on loan there) is not on the
  // market. 1.1.1, Part 5: she is asked for from her club, on loan or to buy
  // (the Clubs page; POST /youth-deals).
  if (player.poolTeamId != null && isYouth) {
    res.status(422).json({ error: `${player.name} is at an AI club's academy: ask her club for her on loan or to buy (Clubs page).` });
    return;
  }
  // Daytime 2 Oct, U-6: a senior at an AI club is bought from it, on the same
  // market rules; the club takes the fee and only sells if it can still play.
  const aiSeller = !isYouth && player.poolTeamId != null && player.teamId == null ? player.poolTeamId : null;
  const aiSellerName = aiSeller == null ? null
    : (await db.select({ n: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, aiSeller)))[0]?.n ?? "Her club";
  // Update 1, item 4b (C-5 B): the Day 1 draft. No club owns anyone yet, so a
  // senior (a free agent or an AI club's) costs no fee, only her wage; the AI
  // club she leaves fills its gap when the draft closes (utils/day1Draft.ts).
  const draftOpen = day1DraftOpen(requireCareerSaveId(req.activeCareerSaveId));
  if (player.teamId === team.id) {
    res.status(422).json({ error: "This player is already on your team. Use the Contracts page to renew their contract." });
    return;
  }
  // 1.1.1, Part 2 (Rob, 16 Oct): a senior under contract at another club is
  // bought with a bid, at any time of year; she moves when the transfer window
  // opens (utils/transfers.ts). The old "last 6 months of her contract" rule is gone.
  const isBid = !isYouth && !draftOpen && (aiSeller != null || player.teamId != null);
  // 1.1.1, Part 4: any senior contract can carry perks (schema/transfers.ts).
  const perks = isYouth ? "" : perksText(Array.isArray(req.body?.perks) ? req.body.perks : String(req.body?.perks ?? "").split(","));
  if (aiSeller != null && !draftOpen) {
    const can = db.transaction((tx) => canSellTx(tx, requireCareerSaveId(req.activeCareerSaveId), aiSeller, aiSellerName!, Number(player.salary)));
    if (!can.ok) { res.status(409).json({ error: can.reason }); return; }
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

  // ── Squad size ──────────────────────────────────────────────────────────
  // 1.1.1: a bid's player arrives later, in the window, where room can be made.
  // Two on the sand, one interchange, and an academy of ACADEMY_CAP. The limits
  // live in utils/squadRules.ts so the numbers are stated once; this route only
  // counts what is already signed and asks whether one more is allowed. R-63:
  // academy players are counted as the intake and the Team page count them —
  // youth players not yet promoted — not by an age guess.
  if (!isBid) {
    const squad = await loadPlayers(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
    const youthNow = squad.filter(isYouthPlayer);
    // Night 2 (O-10): a senior on the injured list does not take one of the places.
    const seniorNow = squad.filter((p) => !isYouthPlayer(p) && !p.onInjuredList);
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
  // Update 1, item 2: a Negotiator's club pays 10% less (the market shows the same figure).
  const negotiator = specialityFactor(team.id, "Negotiator");
  const fee = isYouth ? (player.teamId == null ? youthPrice(cid, player, negotiator) : null) : draftOpen ? null : marketPrice(cid, player, negotiator);
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

  // Update 1, item 2 (Rob, 14 Oct, B): a senior refuses an offer below her
  // asking wage (her wage, less 10% at a Contracts Expert's club: the figure
  // the market shows and the offer starts at).
  if (!isYouth) {
    // Item 4c (C-6): an injured free agent asks her injured wage, and signs on it for the whole contract.
    const asks = askingWage(player.salary, specialityFactor(team.id, "Contracts Expert"), freeAgentInjuryWeeks(player));
    const offered = Number(salary);
    if (!Number.isFinite(offered) || offered < asks) {
      const turned = Number.isFinite(offered) ? `$${Math.round(offered).toLocaleString()}` : "an offer with no wage";
      res.status(422).json({ error: `${player.name} asks $${asks.toLocaleString()} a month and turns down ${turned}. Offer at least her asking wage.`, asks });
      return;
    }
    // Update 1, item 4a (C-3 A): a signing that takes the senior wages over the cap is refused.
    // 1.1.1: her perks count with her wage; a bid is checked on her arrival date (bidTx).
    const overCap = isBid ? null : wageCapRefusal(committedWageBill(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id }), offered + perksMonthly(perks));
    if (overCap) { res.status(422).json({ error: overCap, wageCap: true }); return; }
  }

  // ── A bid (1.1.1) ─────────────────────────────────────────────────────────
  if (isBid && fee) {
    const today = await getGameDate(team.id);
    const squadRole = rawSquadRole === "interchange" ? "interchange" : "starter";
    const r = withCareerStateTx((w) => bidTx(w, cid, { teamId: team.id }, player.id, { wage: Number(salary), length: wanted.length, perks, squadRole }, fee.price, today));
    if (!r.ok) { res.status(422).json({ error: r.reason }); return; }
    const paid = r.outcome === "agreed" || r.outcome === "moved";
    const after = paid ? await loadPlayer(cid, player.id) : null;
    res.status(201).json({
      transfer: { id: r.deal.id, outcome: r.outcome, arrivesOn: r.deal.arrivesOn, answerBy: r.deal.answerBy, from: aiSellerName ?? null },
      fee: paid ? fee.price : 0,
      priceRange: { low: fee.low, high: fee.high },
      signedBlind: paid && blind,
      player: after ? { name: after.name, power: after.power, speed: after.speed, defense: after.defense, serve: after.serve, block: after.block, stamina: after.stamina } : { name: player.name },
    });
    return;
  }

  // R-51: dated on the GAME clock. `new Date()` stamped a contract with the
  // computer's date, so a contract signed in an in-game season could start and
  // end in whatever year the machine was in.
  // L-02a: the end date is the length Rob allows, resolved against the real
  // seasons — the caller no longer supplies a date at all.
  const today = await getGameDate(team.id);
  const cidForTerm = requireCareerSaveId(req.activeCareerSaveId);
  // 1.1.1: a contract signed in the transfer window runs from the next season (utils/transferWindow.ts).
  const actualEnd = contractEndFrom(wanted.length, today, await seasonEndsFrom(cidForTerm, today));
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
    perks,
    // U-6: she leaves the AI club (a Day 1 draft pick); her wage is on this club's books from now.
    ...(aiSeller != null ? { poolTeamId: null } : {}),
  });
  // N-44 (b): a youth goes to the academy's youth team or its reserves, as the box chose.
  const academyPlace = isYouth
    ? withCareerStateTx((w) => placeSignedYouthTx(w, cidForTerm, team.id, Number(playerId), req.body?.academyRole === "reserve" ? "reserve" : "youth_team"))
    : null;

  // Item 15: her price, charged and on the ledger.
  if (fee) {
    await db.insert(financeTransactionsTable).values({
      teamId: team.id, type: "expense", amount: fee.price, category: "signing_fee", date: today,
      description: `Signing fee: ${player.name}${aiSeller != null ? ` from ${aiSellerName}` : ""}${blind ? ` (signed unscouted: $${fee.low.toLocaleString()}-$${fee.high.toLocaleString()})` : ""}`,
    });
    await db.update(teamsTable).set({ budget: Number(team.budget) - fee.price }).where(eq(teamsTable.id, team.id));
  }
  const signed = await loadPlayer(cid, Number(playerId));

  res.status(201).json({
    ...serializeContract(contract),
    // What signing her revealed: her price, and (blind) her attributes.
    fee: fee ? fee.price : 0,
    priceRange: fee ? { low: fee.low, high: fee.high } : null,
    signedBlind: blind,
    // N-44 (b): where a youth went: the youth team, or the reserves (asked for, or the youth team was full).
    academyPlace,
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

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const player = await loadPlayer(cid, contract.playerId);
  if (!player || player.teamId !== team.id) {
    res.status(409).json({ error: "This player is no longer in your squad." });
    return;
  }

  // BVE update 1, Rob 13 Oct (option A): a youth signed off the market renews
  // like everyone else. She used to be refused here ("Academy contracts are
  // managed by the youth academy") while the calendar still expired her
  // contract at its end date, so a youth the club had signed and paid for could
  // not be kept: the Contracts page offered Renew, the server said no, and she
  // walked to free agency. Rob's rule stands for her too: every player holds a
  // contract, it can be renewed, and only a deal that is not renewed ends.
  // She stays on the academy's wage for her talent (what the weekly run bills
  // her); a raise is not something a youth renewal offers.
  const isAcademyYouth = isYouthPlayer(player);
  // 1.1.1: once she has agreed to join another club (her fee is paid) she can't be renewed.
  const sold = withCareerStateTx((w) => renewalRefusalTx(w.tx, cid, player.id));
  if (sold) { res.status(409).json({ error: sold }); return; }
  // 1.1.1, Part 4: a renewal can carry perks (her new contract's; none for an academy youth).
  const newPerks = isAcademyYouth ? "" : perksText(Array.isArray(req.body?.perks) ? req.body.perks : String(req.body?.perks ?? "").split(","));

  // Update 1, item 4a (C-4): a senior asks the wage for her CURRENT rating
  // (renewalAsk), and refuses less (rule B, item 2). No salary named: her ask.
  const currentSalary = Number(contract.salary);
  const rawSalary = (req.body ?? {}).salary;
  const ask = isAcademyYouth ? null : renewalAsk(player, specialityFactor(team.id, "Contracts Expert"));
  const newSalary = isAcademyYouth
    ? academyMonthlySalary(player.potential)
    : rawSalary == null ? ask! : Number(rawSalary);
  if (!Number.isFinite(newSalary) || newSalary < 0) {
    res.status(400).json({ error: "salary must be a non-negative number" });
    return;
  }
  if (ask != null && newSalary < ask) {
    res.status(422).json({ error: `${player.name} asks $${ask.toLocaleString()} a month to renew (the wage for her rating now) and turns down $${Math.round(newSalary).toLocaleString()}.`, asks: ask });
    return;
  }
  // R-52: only a raise is new spending, so only a raise meets the freeze.
  // 1.1.1: her perks count with her wage (a renewal adding perks is a raise).
  const costNow = currentSalary + perksMonthly(player.perks), costAfter = newSalary + perksMonthly(newPerks);
  if (!isAcademyYouth && costAfter > costNow) {
    const spendingBlocked = await checkSpendingAllowed(cid);
    if (spendingBlocked) {
      res.status(403).json({ error: `${spendingBlocked} A renewal at no more than her current wage is still allowed.` });
      return;
    }
  }
  // Update 1, item 4a (C-3 A, C-4): a renewal at a higher wage that breaks the cap is refused; 1.1.1: one whose
  // contract ends before a player bought ahead arrives must fit on that day (renewalCapRefusalTx).
  if (!isAcademyYouth) {
    const overCap = renewalCapRefusal(cid, { teamId: team.id }, player.contractEndDate ?? null, costNow, costAfter);
    if (overCap) { res.status(422).json({ error: overCap, wageCap: true }); return; }
  }

  const season = await getActiveSeason(req);
  if (!season) { res.status(409).json({ error: "No active season" }); return; }
  if (contract.endDate > season.endDate) {
    res.status(409).json({
      error: `This contract already runs past this season (to ${gameDateText(contract.endDate)}). It can be renewed in its final season.`,
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
  // The Team page's academy card counts down `academyContractYears`; after a
  // renewal it has to show the new deal, not the old one running out.
  const academyYears = isAcademyYouth
    ? Number(Math.max(0, (Date.parse(`${newEnd}T00:00:00Z`) - Date.parse(`${await getGameDate(team.id)}T00:00:00Z`)) / (365 * 86_400_000)).toFixed(2))
    : undefined;
  await updatePlayerState(cid, contract.playerId, {
    contractEndDate: newEnd,
    salary: newSalary,
    perks: newPerks,
    ...(academyYears != null ? { academyContractYears: academyYears } : {}),
  });

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
  // cost the club nothing at all, so there was no reason not to. Update 1, item
  // 4b (Rob, 14 Oct): the one exception is a Day 1 draft pick taken back while
  // the draft is open, an undo (and a player from an AI club goes back to it).
  const today = await getGameDate(team.id);
  const draftUndo = day1DraftOpen(requireCareerSaveId(req.activeCareerSaveId));
  // 1.1.1 (no dumping): outside the transfer window a senior can't be let go.
  const kept = withCareerStateTx((w) => releaseRefusalTx(w.tx, requireCareerSaveId(req.activeCareerSaveId), team.id, contract.playerId, today, draftUndo));
  if (kept) { res.status(409).json({ error: kept }); return; }
  const payout = draftUndo ? 0 : terminationPayout(Number(contract.salary), today, contract.endDate);

  const [terminated] = await db.update(contractsTable).set({ status: "terminated" }).where(eq(contractsTable.id, id)).returning();
  await updatePlayerState(requireCareerSaveId(req.activeCareerSaveId), contract.playerId, { teamId: null, contractEndDate: null, isActive: false, squadRole: "reserve", perks: "" });
  if (draftUndo) withCareerStateTx((w) => undoDraftPickTx(w, requireCareerSaveId(req.activeCareerSaveId), contract.playerId));

  if (payout > 0) {
    await db.update(teamsTable)
      .set({ budget: Number(team.budget) - payout })
      .where(eq(teamsTable.id, team.id));
    await db.insert(financeTransactionsTable).values({
      teamId:      team.id,
      type:        "expense",
      amount:      payout,
      description: `Contract paid out — ${player?.name ?? "player"} released to ${gameDateText(contract.endDate)}`,
      category:    "player_salary",
      date:        today,
    });
  }

  // Night 2 (O-10): letting the cover go gives a fit player on the injured list her place back at once.
  afterSquadChange(requireCareerSaveId(req.activeCareerSaveId), team.id);
  res.json({ ...serializeContract(terminated), payout });
});

export default router;
