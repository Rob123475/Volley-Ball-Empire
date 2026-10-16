/**
 * 1.1.1, Part 6 (Rob, 16 Oct: "Is the calendar up to date with all our
 * changes?"): the dated rules the annual calendar (GET /calendar/annual) did
 * not show, for one calendar year of the player's career:
 *
 *   club       the Day 1 draft (1 January of the career's first season); the
 *              AI clubs' staff day (8 January, AI_STAFF_DEAL_DAY) and the
 *              reminder from 1 January; the pre-season choice day (day
 *              PRESEASON.choiceDay of his off-season: expected, from his last
 *              match, until the off-season starts) and his camp's dates
 *   transfer   the window opening and closing (the Off-Season slots); each
 *              player he has bought ahead arriving, each player sold ahead
 *              leaving; each bid's 14-day answer deadline
 *   contract   his staff's contract end dates (his players' were already there)
 *   transfer   each youth loan of his ending (she goes back to her club)
 *   club       the season boundary (1 January after his first season): ages
 *              move on, the board reviews the season, the academy intake and
 *              its graduates
 */
import {
  careerSavesTable, seasonsTable, matchesTable, preseasonChoicesTable, transferDealsTable, playersTable, youthLoansTable,
  AI_STAFF_DEAL_DAY, PRESEASON, type PreseasonLocation,
} from "@workspace/db";
import { and, eq, inArray, or } from "drizzle-orm";
import { loadStaffTx, type CareerStateTx } from "../lib/playerDto.js";
import { transferWindowFor } from "./transferWindow.js";
import { roundToDate } from "./roundDates.js";
import { preseasonStateTx, addDays } from "./preseasonCamp.js";
import { clubNameTx } from "./transfers.js";

type Tx = CareerStateTx["tx"];
export type DatedEvent = { date: string; type: "facility" | "transfer" | "contract"; title: string; subtitle?: string; link: string };

export function datedRulesTx(tx: Tx, careerSaveId: number, teamId: number, year: number, today: string): DatedEvent[] {
  const yearStart = `${year}-01-01`, yearEnd = `${year}-12-31`;
  const inYear = (d: string | null | undefined): d is string => !!d && d >= yearStart && d <= yearEnd;
  const out: DatedEvent[] = [];

  // ── The club's year ────────────────────────────────────────────────────────
  const save = tx.select({ draft: careerSavesTable.day1Draft }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get();
  const firstSeason = tx.select({ y: seasonsTable.year }).from(seasonsTable).where(eq(seasonsTable.careerSaveId, careerSaveId)).all()
    .reduce((lo, r) => Math.min(lo, r.y), Infinity);
  if (save?.draft != null && firstSeason === year) {
    out.push({ date: yearStart, type: "facility", title: "Day 1 draft", subtitle: "Pick your 2 or 3 seniors from every senior in the world, wage only", link: "/day1-draft" });
  }
  if (Number.isFinite(firstSeason) && year > firstSeason) {
    out.push({ date: yearStart, type: "facility", title: "New season", subtitle: "Ages move on, the board reviews last season, the academy intake arrives and 19-year-olds leave it", link: "/career" });
  }
  const staffDay = `${year}-01-${String(AI_STAFF_DEAL_DAY).padStart(2, "0")}`;
  out.push({ date: yearStart, type: "facility", title: "Staff: the AI clubs hire on 8 January", subtitle: "Hire your staff first: the market's best go on the 8th", link: "/staff-market" });
  out.push({ date: staffDay, type: "facility", title: "AI clubs hire staff", subtitle: "Every AI club with a gap takes a coach and a medic from the market", link: "/staff-market" });

  // The pre-season choice: known once his off-season has started, expected before that.
  const pre = preseasonStateTx(tx, careerSaveId, teamId, today);
  if (pre && pre.seasonYear === year && pre.offseasonStartedOn) {
    if (inYear(pre.choiceOn)) out.push({ date: pre.choiceOn, type: "facility", title: "Pre-season choice", subtitle: "A camp, Rest or Skip", link: "/preseason" });
  } else {
    const rounds = tx.select({ round: matchesTable.round }).from(matchesTable)
      .where(and(eq(matchesTable.season, year), or(eq(matchesTable.homeTeamId, teamId), eq(matchesTable.awayTeamId, teamId)))).all();
    const season = tx.select().from(seasonsTable).where(and(eq(seasonsTable.careerSaveId, careerSaveId), eq(seasonsTable.year, year))).get();
    if (rounds.length && season) {
      const last = roundToDate(season.startDate, season.endDate, Math.max(...rounds.map((r) => r.round)), season.totalRounds);
      const choiceOn = addDays(last, PRESEASON.choiceDay - 1);
      if (inYear(choiceOn)) out.push({ date: choiceOn, type: "facility", title: "Pre-season choice (expected)", subtitle: `Day ${PRESEASON.choiceDay} of your off-season, which starts after your last match`, link: "/preseason" });
    }
  }
  // His camp: it can start in one calendar year and end in the next.
  const camps = tx.select().from(preseasonChoicesTable).where(and(
    eq(preseasonChoicesTable.careerSaveId, careerSaveId), eq(preseasonChoicesTable.teamId, teamId),
    inArray(preseasonChoicesTable.seasonYear, [year - 1, year]), eq(preseasonChoicesTable.choice, "camp"),
  )).all();
  for (const c of camps) {
    const name = PRESEASON.locations[c.location as PreseasonLocation]?.name ?? "Pre-season camp";
    if (inYear(c.startsOn)) out.push({ date: c.startsOn, type: "facility", title: `${name} starts`, subtitle: `${c.length ?? ""} pre-season camp`.trim(), link: "/preseason" });
    if (inYear(c.endsOn)) out.push({ date: c.endsOn, type: "facility", title: `${name} ends`, subtitle: "The squad is back from camp", link: "/preseason" });
  }

  // ── Transfers ──────────────────────────────────────────────────────────────
  const win = transferWindowFor(year);
  out.push({ date: win.opens, type: "transfer", title: "Transfer window opens", subtitle: "Players bought ahead arrive; seniors can be released or sold", link: "/team?tab=transfers" });
  out.push({ date: win.closes, type: "transfer", title: "Transfer window closes", subtitle: "Last day to release or sell a senior until next December", link: "/team?tab=transfers" });
  const deals = tx.select().from(transferDealsTable).where(and(
    eq(transferDealsTable.careerSaveId, careerSaveId), inArray(transferDealsTable.status, ["offered", "agreed"]),
    or(eq(transferDealsTable.toTeamId, teamId), eq(transferDealsTable.fromTeamId, teamId)),
  )).all();
  const names = new Map(deals.length === 0 ? [] : tx.select({ id: playersTable.id, name: playersTable.name }).from(playersTable)
    .where(inArray(playersTable.id, deals.map((d) => d.playerId))).all().map((p) => [p.id, p.name]));
  for (const d of deals) {
    const name = names.get(d.playerId) ?? "A player";
    const from = clubNameTx(tx, d.fromTeamId != null ? { teamId: d.fromTeamId } : { poolTeamId: d.fromPoolTeamId! });
    const to = clubNameTx(tx, d.toTeamId != null ? { teamId: d.toTeamId } : { poolTeamId: d.toPoolTeamId! });
    if (d.status === "offered" && d.fromTeamId === teamId && inYear(d.answerBy)) {
      out.push({ date: d.answerBy, type: "transfer", title: `Answer the bid for ${name}`, subtitle: `${to} bid for her: counter by today or she goes`, link: "/team?tab=transfers" });
    } else if (d.status === "agreed" && d.toTeamId === teamId && inYear(d.arrivesOn)) {
      out.push({ date: d.arrivesOn, type: "transfer", title: `${name} arrives`, subtitle: `Bought ahead from ${from}`, link: "/team?tab=transfers" });
    } else if (d.status === "agreed" && d.fromTeamId === teamId && inYear(d.arrivesOn)) {
      out.push({ date: d.arrivesOn, type: "transfer", title: `${name} leaves`, subtitle: `Sold ahead to ${to}`, link: "/team?tab=transfers" });
    }
  }

  // Youth loans of his ending: she goes back to her club.
  const loans = tx.select().from(youthLoansTable).where(and(eq(youthLoansTable.careerSaveId, careerSaveId), eq(youthLoansTable.status, "active"),
    or(eq(youthLoansTable.ownerTeamId, teamId), eq(youthLoansTable.borrowerTeamId, teamId)))).all();
  const loanNames = new Map(loans.length === 0 ? [] : tx.select({ id: playersTable.id, name: playersTable.name }).from(playersTable)
    .where(inArray(playersTable.id, loans.map((l) => l.playerId))).all().map((p) => [p.id, p.name]));
  for (const l of loans) {
    if (!inYear(l.endsOn)) continue;
    const mineOut = l.ownerTeamId === teamId;
    out.push({ date: l.endsOn, type: "transfer", title: `${loanNames.get(l.playerId) ?? "A youth"}'s loan ends`,
      subtitle: mineOut ? "She comes back to your academy" : "She goes back to her club", link: "/team?tab=loans" });
  }

  // ── His staff's contracts ─────────────────────────────────────────────────
  for (const m of loadStaffTx(tx, careerSaveId, { teamId })) {
    if (inYear(m.contractEndDate)) {
      out.push({ date: m.contractEndDate, type: "contract", title: `Staff contract expires: ${m.name}`, subtitle: `${m.role ?? "Staff"}: renew or replace`, link: "/staff" });
    }
  }
  return out;
}
