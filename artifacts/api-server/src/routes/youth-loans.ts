/**
 * Overnight brief 30 Sep, C15 — the Team page's Youth Loans tab.
 *
 *   GET  /youth-loans          the academy (youth team and reserves), youths on
 *                              loan out and in, and the other clubs' listed youths
 *   POST /youth-loans/role     youth team or reserve (court time)
 *   POST /youth-loans/list     offer a reserve for loan
 *   POST /youth-loans/unlist   take her off the list (before anyone borrows her)
 *   POST /youth-loans/borrow   take a listed youth for 6 or 12 months (confirm)
 *
 * There is deliberately no recall: a loan runs to its end date (Rob, 30 Sep).
 */
import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { getGameDate } from "../utils/gameDate.js";
import { ACADEMY_CAP, ACADEMY_YOUTH_TEAM, RESERVE_COURT_SHARE } from "../utils/squadRules.js";
import { academyWeeklyWage } from "../utils/academy.js";
import {
  LOAN_MONTHS, academyAtTx, academyCountTx, allowedMonths, borrowTx, clubName, listForLoanTx,
  loanHalves, loansTx, setAcademyRoleTx, unlistTx, youthRating, ensureYouthTeamTx,
} from "../utils/youthLoans.js";
import { careerPlayerStateTable, playersTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

const router = Router();

async function context(req: Parameters<Parameters<typeof router.get>[1]>[0], res: Parameters<Parameters<typeof router.get>[1]>[1]) {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return null; }
  const careerSaveId = requireCareerSaveId(req.activeCareerSaveId);
  return { team, careerSaveId, today: await getGameDate(team.id) };
}

router.get("/youth-loans", async (req, res) => {
  const ctx = await context(req, res);
  if (!ctx) return;
  const { team, careerSaveId, today } = ctx;
  const body = withCareerStateTx((w) => {
    const { tx } = w;
    ensureYouthTeamTx(w, careerSaveId, { teamId: team.id });
    const open = loansTx(tx, careerSaveId, ["listed", "active"]);
    const ids = open.map((l) => l.playerId);
    const people = new Map(ids.length === 0 ? [] : tx.select({
      id: careerPlayerStateTable.playerId, name: playersTable.name, age: careerPlayerStateTable.age, position: playersTable.position,
      potential: playersTable.potential, imageUrl: playersTable.imageUrl, nationality: playersTable.nationality,
      power: careerPlayerStateTable.power, speed: careerPlayerStateTable.speed, defense: careerPlayerStateTable.defense,
      serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block,
    }).from(careerPlayerStateTable).innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
      .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), inArray(careerPlayerStateTable.playerId, ids))).all()
      .map((p) => [p.id, p]));
    const card = (id: number) => {
      const p = people.get(id);
      return p ? { playerId: id, name: p.name, age: p.age, position: p.position, nationality: p.nationality, imageUrl: p.imageUrl, rating: youthRating(p) } : null;
    };
    const owner = (l: (typeof open)[number]) => l.ownerTeamId != null ? { teamId: l.ownerTeamId } : { poolTeamId: l.ownerPoolTeamId! };
    const borrower = (l: (typeof open)[number]) => l.borrowerTeamId != null ? { teamId: l.borrowerTeamId } : l.borrowerPoolTeamId != null ? { poolTeamId: l.borrowerPoolTeamId } : null;

    const loanedIn = new Map(open.filter((l) => l.status === "active" && l.borrowerTeamId === team.id).map((l) => [l.playerId, l]));
    const listed = new Set(open.filter((l) => l.status === "listed" && l.ownerTeamId === team.id).map((l) => l.playerId));
    const academy = academyAtTx(tx, careerSaveId, { teamId: team.id })
      .map((r) => {
        const inLoan = loanedIn.get(r.playerId);
        return {
          playerId: r.playerId, name: r.name, age: r.age, rating: youthRating(r), academyRole: r.academyRole ?? "reserve",
          listed: listed.has(r.playerId),
          onLoanFrom: inLoan ? { club: clubName(tx, owner(inLoan)), endsOn: inLoan.endsOn } : null,
          allowedMonths: allowedMonths(r.age, today),
        };
      })
      .sort((a, b) => (a.academyRole === b.academyRole ? b.rating - a.rating : a.academyRole === "youth_team" ? -1 : 1));

    const active = open.filter((l) => l.status === "active");
    const loan = (l: (typeof open)[number], side: "out" | "in") => ({
      loanId: l.id, ...card(l.playerId), club: clubName(tx, side === "out" ? borrower(l) : owner(l)),
      startsOn: l.startsOn, endsOn: l.endsOn, months: l.months, weeklyWage: l.weeklyWage,
      yourHalf: side === "out" ? loanHalves(l.weeklyWage ?? 0).owner : loanHalves(l.weeklyWage ?? 0).borrower,
      ownerPaid: l.ownerPaid, borrowerPaid: l.borrowerPaid,
    });
    const available = open.filter((l) => l.status === "listed" && l.ownerTeamId !== team.id)
      .map((l) => {
        const c = card(l.playerId);
        const p = people.get(l.playerId);
        if (!c || !p) return null;
        const wage = academyWeeklyWage(p.potential);
        return { loanId: l.id, ...c, club: clubName(tx, owner(l)), listedOn: l.listedOn, weeklyWage: wage,
          yourHalf: loanHalves(wage).borrower, allowedMonths: allowedMonths(p.age, today) };
      })
      .filter((x) => x != null && x.allowedMonths.length > 0)
      .sort((a, b) => b!.rating - a!.rating);

    return {
      today, youthTeamSize: ACADEMY_YOUTH_TEAM, cap: ACADEMY_CAP, reserveShare: RESERVE_COURT_SHARE, months: LOAN_MONTHS,
      academySize: academyCountTx(tx, careerSaveId, { teamId: team.id }),
      academy,
      out: active.filter((l) => l.ownerTeamId === team.id).map((l) => loan(l, "out")),
      in: active.filter((l) => l.borrowerTeamId === team.id).map((l) => loan(l, "in")),
      available,
    };
  });
  res.json(body);
});

router.post("/youth-loans/role", async (req, res) => {
  const ctx = await context(req, res);
  if (!ctx) return;
  const { playerId, role, swapOut } = req.body ?? {};
  if (role !== "youth_team" && role !== "reserve") { res.status(400).json({ error: "role is youth_team or reserve" }); return; }
  const error = withCareerStateTx((w) => setAcademyRoleTx(w, ctx.careerSaveId, ctx.team.id, Number(playerId), role, swapOut != null ? Number(swapOut) : undefined));
  if (error) { res.status(400).json({ error }); return; }
  res.json({ ok: true });
});

router.post("/youth-loans/list", async (req, res) => {
  const ctx = await context(req, res);
  if (!ctx) return;
  const error = withCareerStateTx((w) => listForLoanTx(w.tx, ctx.careerSaveId, { teamId: ctx.team.id }, Number(req.body?.playerId), ctx.today));
  if (error) { res.status(400).json({ error }); return; }
  res.status(201).json({ ok: true });
});

router.post("/youth-loans/unlist", async (req, res) => {
  const ctx = await context(req, res);
  if (!ctx) return;
  const error = withCareerStateTx((w) => unlistTx(w.tx, ctx.careerSaveId, { teamId: ctx.team.id }, Number(req.body?.playerId)));
  if (error) { res.status(400).json({ error }); return; }
  res.json({ ok: true });
});

router.post("/youth-loans/borrow", async (req, res) => {
  const ctx = await context(req, res);
  if (!ctx) return;
  const { loanId, months, confirm } = req.body ?? {};
  if (confirm !== true) {
    res.status(400).json({ error: "Confirm the loan: she plays for you until it ends, and you pay half her wage each week." });
    return;
  }
  const result = withCareerStateTx((w) => borrowTx(w, ctx.careerSaveId, { teamId: ctx.team.id }, Number(loanId), Number(months), ctx.today));
  if ("error" in result) { res.status(400).json({ error: result.error }); return; }
  res.status(201).json({ loanId: result.loan.id, playerId: result.loan.playerId, startsOn: result.loan.startsOn, endsOn: result.loan.endsOn,
    months: result.loan.months, weeklyWage: result.loan.weeklyWage, yourHalf: result.halves.borrower });
});

export default router;
