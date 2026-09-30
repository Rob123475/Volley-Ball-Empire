/**
 * Overnight brief 30 Sep, C15 — the youth loan market.
 *
 * Rob's rules: a club (the player's or an AI club) lists a contracted youth who
 * is not getting court time; another club takes her on loan for 6 or 12 months.
 * Her wage is split 50/50 between the two clubs for the loan (both ledgers).
 * She plays for the borrower, and develops with the borrower's court time. She
 * returns at the end; the owner cannot recall her early (there is no route for
 * it). AI clubs list and borrow by their own squad needs.
 *
 * What the game needed first, built here:
 *   Court time.  An academy has a youth team of 3 (ACADEMY_YOUTH_TEAM) who play,
 *                and reserves who do not: career_player_state.academy_role. The
 *                youth team develops at the full weekly rate, a reserve at
 *                RESERVE_COURT_SHARE of it (utils/academyDevelopment.ts).
 *   AI academies. AI clubs had no youth at all. Each keeps AI_ACADEMY_SIZE
 *                youth players (a youth team of 3 and a reserve), made by the
 *                intake's own rule (utils/youthIntake.ts youthFactoryTx), held
 *                in career_player_state.pool_team_id. They are billed the
 *                academy wage and develop weekly on the same rule. At 19 an AI
 *                academy player leaves the game (she is not added to the senior
 *                market: sixty academies would flood it).
 *
 * A loan moves where she plays (team_id / pool_team_id) to the borrower for its
 * length; youth_loans keeps who owns her. She counts in both academies' size, so
 * neither club can sign past its cap while she is away.
 */
import {
  careerPlayerStateTable, playersTable, youthLoansTable, careerPoolTeamStateTable,
  continentalPoolTeamsTable, teamsTable, CORE_NATIONS, type ContinentKey,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { ACADEMY_CAP, ACADEMY_YOUTH_TEAM, RESERVE_COURT_SHARE } from "./squadRules.js";
import { academyWeeklyWage } from "./academy.js";
import { academyWeek } from "./academyDevelopment.js";
import { youthFactoryTx } from "./youthIntake.js";

type Tx = CareerStateTx["tx"];

/** Loan lengths, in months (Rob: 6 or 12). */
export const LOAN_MONTHS = [6, 12] as const;
export { RESERVE_COURT_SHARE };
/** An AI club's academy: a youth team of 3 and one reserve. */
export const AI_ACADEMY_SIZE = ACADEMY_YOUTH_TEAM + 1;
/** An AI club borrows a youth who is at least this much better than its weakest youth-team player. */
export const AI_BORROW_GAP = 5;
/** At most this many AI loans start in a week, so the market moves rather than empties at once. */
export const AI_BORROWS_PER_WEEK = 3;
/** The age an academy player leaves the academy at the season boundary. */
const GRADUATION_AGE = 19;

export type Club = { teamId: number } | { poolTeamId: number };
const isTeam = (c: Club): c is { teamId: number } => "teamId" in c;
const sameClub = (a: Club, b: Club) => isTeam(a) ? isTeam(b) && a.teamId === b.teamId : !isTeam(b) && a.poolTeamId === b.poolTeamId;

export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Her rating as the academy reads it: the five skills' mean. */
export function youthRating(p: { power: number; speed: number; defense: number; serve: number; block: number }): number {
  return Math.round((p.power + p.speed + p.defense + p.serve + p.block) / 5);
}

/** The two halves of a week's wage: the owner pays the odd dollar, and the halves add to the wage. */
export function loanHalves(weeklyWage: number): { owner: number; borrower: number } {
  const owner = Math.ceil(weeklyWage / 2);
  return { owner, borrower: weeklyWage - owner };
}

/**
 * The loan lengths she can go for from `today`: an 18-year-old leaves the
 * academy at the season boundary (1 January), so her loan must end by 31
 * December; a younger one can go for either.
 */
export function allowedMonths(age: number, today: string): number[] {
  const seasonEnd = `${today.slice(0, 4)}-12-31`;
  return LOAN_MONTHS.filter((m) => age < GRADUATION_AGE - 1 || addMonths(today, m) <= seasonEnd);
}

type AcademyRow = {
  playerId: number; name: string; age: number; potential: string | null; academyRole: string | null;
  teamId: number | null; poolTeamId: number | null;
  power: number; speed: number; defense: number; serve: number; block: number;
  trainingPoints: number; focusXp: number;
};

function academyRowsTx(tx: Tx, careerSaveId: number, where: { teamIds?: number[]; poolTeamIds?: number[]; playerIds?: number[] }): AcademyRow[] {
  const conds = [
    eq(careerPlayerStateTable.careerSaveId, careerSaveId),
    eq(careerPlayerStateTable.isRetired, false),
    eq(careerPlayerStateTable.isPromoted, false),
    eq(playersTable.playerType, "youth"),
  ];
  const any = [];
  if (where.teamIds?.length) any.push(inArray(careerPlayerStateTable.teamId, where.teamIds));
  if (where.poolTeamIds?.length) any.push(inArray(careerPlayerStateTable.poolTeamId, where.poolTeamIds));
  if (where.playerIds?.length) any.push(inArray(careerPlayerStateTable.playerId, where.playerIds));
  if (any.length === 0) return [];
  return tx.select({
    playerId: careerPlayerStateTable.playerId, name: playersTable.name, age: careerPlayerStateTable.age,
    potential: playersTable.potential, academyRole: careerPlayerStateTable.academyRole,
    teamId: careerPlayerStateTable.teamId, poolTeamId: careerPlayerStateTable.poolTeamId,
    power: careerPlayerStateTable.power, speed: careerPlayerStateTable.speed, defense: careerPlayerStateTable.defense,
    serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block,
    trainingPoints: careerPlayerStateTable.trainingPoints, focusXp: careerPlayerStateTable.focusXp,
  }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(...conds, or(...any)!))
    .all() as AcademyRow[];
}

/** Who plays where: the academy players at a club (hers or on loan to it). */
export function academyAtTx(tx: Tx, careerSaveId: number, club: Club): AcademyRow[] {
  return academyRowsTx(tx, careerSaveId, isTeam(club) ? { teamIds: [club.teamId] } : { poolTeamIds: [club.poolTeamId] });
}

export function loansTx(tx: Tx, careerSaveId: number, status: "listed" | "active" | Array<"listed" | "active">) {
  const statuses = Array.isArray(status) ? status : [status];
  return tx.select().from(youthLoansTable)
    .where(and(eq(youthLoansTable.careerSaveId, careerSaveId), inArray(youthLoansTable.status, statuses)))
    .all();
}

const ownerOf = (l: typeof youthLoansTable.$inferSelect): Club =>
  l.ownerTeamId != null ? { teamId: l.ownerTeamId } : { poolTeamId: l.ownerPoolTeamId! };
const borrowerOf = (l: typeof youthLoansTable.$inferSelect): Club | null =>
  l.borrowerTeamId != null ? { teamId: l.borrowerTeamId } : l.borrowerPoolTeamId != null ? { poolTeamId: l.borrowerPoolTeamId } : null;

/**
 * The academy's size for the cap: everyone at the club, plus her own players out
 * on loan (they come back). A youth on loan in counts at the borrower as well,
 * while she is there.
 */
export function academyCountTx(tx: Tx, careerSaveId: number, club: Club): number {
  const here = academyAtTx(tx, careerSaveId, club).length;
  const away = loansTx(tx, careerSaveId, "active").filter((l) => sameClub(ownerOf(l), club)).length;
  return here + away;
}

/**
 * The youth team is 3. A club's own choice stands; an empty place is filled by
 * its best reserve, and a youth team over 3 (a loan arriving) sends its weakest
 * to the reserves. An academy player with no role yet is a reserve until then.
 */
export function ensureYouthTeamTx(w: CareerStateTx, careerSaveId: number, club: Club): void {
  const rows = academyAtTx(w.tx, careerSaveId, club);
  const setRole = (playerId: number, academyRole: string) => w.setPlayerState(careerSaveId, playerId, { academyRole });
  for (const r of rows) if (r.academyRole !== "youth_team" && r.academyRole !== "reserve") { setRole(r.playerId, "reserve"); r.academyRole = "reserve"; }
  const team = rows.filter((r) => r.academyRole === "youth_team").sort((a, b) => youthRating(b) - youthRating(a));
  const reserves = rows.filter((r) => r.academyRole === "reserve").sort((a, b) => youthRating(b) - youthRating(a));
  while (team.length > ACADEMY_YOUTH_TEAM) { const out = team.pop()!; setRole(out.playerId, "reserve"); }
  while (team.length < ACADEMY_YOUTH_TEAM && reserves.length > 0) { const inn = reserves.shift()!; setRole(inn.playerId, "youth_team"); team.push(inn); }
}

/** Put her in the youth team (in place of `swapOut` when it is full) or the reserves. */
export function setAcademyRoleTx(w: CareerStateTx, careerSaveId: number, teamId: number, playerId: number, role: "youth_team" | "reserve", swapOut?: number): string | null {
  const { tx } = w;
  const rows = academyAtTx(tx, careerSaveId, { teamId });
  const me = rows.find((r) => r.playerId === playerId);
  if (!me) return "She is not in your academy.";
  if (loansTx(tx, careerSaveId, "listed").some((l) => l.playerId === playerId) && role === "youth_team") return "She is listed for loan: take her off the list first.";
  const setRole = (id: number, academyRole: string) => w.setPlayerState(careerSaveId, id, { academyRole });
  if (role === "youth_team") {
    const team = rows.filter((r) => r.academyRole === "youth_team" && r.playerId !== playerId);
    if (team.length >= ACADEMY_YOUTH_TEAM) {
      const out = team.find((r) => r.playerId === swapOut);
      if (!out) return `The youth team is full (${ACADEMY_YOUTH_TEAM}): choose who drops to the reserves.`;
      setRole(out.playerId, "reserve");
    }
  }
  setRole(playerId, role);
  return null;
}

// ── Listing and borrowing ────────────────────────────────────────────────────

/** List a reserve for loan. Returns an error message, or null. */
export function listForLoanTx(tx: Tx, careerSaveId: number, owner: Club, playerId: number, today: string): string | null {
  const me = academyAtTx(tx, careerSaveId, owner).find((r) => r.playerId === playerId);
  if (!me) return "Only a youth in your own academy can be listed.";
  const open = loansTx(tx, careerSaveId, ["listed", "active"]);
  if (open.some((l) => l.playerId === playerId)) {
    return open.find((l) => l.playerId === playerId)!.status === "active" ? "She is on loan: only her own club can list her, once she is back." : "She is already listed.";
  }
  if (me.academyRole === "youth_team") return "She plays in your youth team. Only a reserve (no court time) can be listed.";
  if (allowedMonths(me.age, today).length === 0) return "She leaves the academy at the season's end: too late for a loan of 6 months.";
  tx.insert(youthLoansTable).values({
    careerSaveId, playerId, status: "listed", listedOn: today,
    ownerTeamId: isTeam(owner) ? owner.teamId : null, ownerPoolTeamId: isTeam(owner) ? null : owner.poolTeamId,
  }).run();
  return null;
}

export function unlistTx(tx: Tx, careerSaveId: number, owner: Club, playerId: number): string | null {
  const l = loansTx(tx, careerSaveId, "listed").find((x) => x.playerId === playerId && sameClub(ownerOf(x), owner));
  if (!l) return "She is not on your loan list.";
  tx.update(youthLoansTable).set({ status: "withdrawn" }).where(eq(youthLoansTable.id, l.id)).run();
  return null;
}

/** Borrow a listed youth. Returns an error message, or the loan. */
export function borrowTx(w: CareerStateTx, careerSaveId: number, borrower: Club, loanId: number, months: number, today: string):
  { error: string } | { loan: typeof youthLoansTable.$inferSelect; halves: { owner: number; borrower: number } } {
  const { tx } = w;
  const l = loansTx(tx, careerSaveId, "listed").find((x) => x.id === loanId);
  if (!l) return { error: "That youth is no longer on the loan list." };
  if (sameClub(ownerOf(l), borrower)) return { error: "She is your own player." };
  if (!(LOAN_MONTHS as readonly number[]).includes(months)) return { error: "A loan is for 6 or 12 months." };
  const [me] = academyRowsTx(tx, careerSaveId, { playerIds: [l.playerId] });
  if (!me) return { error: "That youth is no longer in an academy." };
  if (!allowedMonths(me.age, today).includes(months)) {
    return { error: `She leaves the academy on 1 January: a loan of ${months} months would run past it.` };
  }
  if (academyCountTx(tx, careerSaveId, borrower) >= ACADEMY_CAP) return { error: `Your academy is full (${ACADEMY_CAP}).` };
  const weeklyWage = academyWeeklyWage(me.potential);
  const endsOn = addMonths(today, months);
  tx.update(youthLoansTable).set({
    status: "active", startsOn: today, endsOn, months, weeklyWage,
    borrowerTeamId: isTeam(borrower) ? borrower.teamId : null,
    borrowerPoolTeamId: isTeam(borrower) ? null : borrower.poolTeamId,
  }).where(eq(youthLoansTable.id, l.id)).run();
  // She plays for the borrower. An AI club borrowed her for its youth team (she
  // beats its weakest, who drops to the reserves); the player's club puts her in
  // its youth team if it has a place, otherwise the reserves, and the manager
  // chooses who plays.
  const youthTeamNow = academyAtTx(tx, careerSaveId, borrower).filter((r) => r.academyRole === "youth_team").length;
  w.setPlayerState(careerSaveId, l.playerId, {
    teamId: isTeam(borrower) ? borrower.teamId : null,
    poolTeamId: isTeam(borrower) ? null : borrower.poolTeamId,
    academyRole: !isTeam(borrower) || youthTeamNow < ACADEMY_YOUTH_TEAM ? "youth_team" : "reserve",
  });
  ensureYouthTeamTx(w, careerSaveId, borrower);
  ensureYouthTeamTx(w, careerSaveId, ownerOf(l));
  const loan = tx.select().from(youthLoansTable).where(eq(youthLoansTable.id, l.id)).all()[0]!;
  return { loan, halves: loanHalves(weeklyWage) };
}

/** Every loan whose end date has come: she goes back to her club, as a reserve. */
export function returnDueLoansTx(w: CareerStateTx, careerSaveId: number, today: string): Array<{ playerId: number; loanId: number }> {
  const { tx } = w;
  const due = loansTx(tx, careerSaveId, "active").filter((l) => l.endsOn != null && l.endsOn <= today);
  for (const l of due) {
    const owner = ownerOf(l);
    w.setPlayerState(careerSaveId, l.playerId, {
      teamId: isTeam(owner) ? owner.teamId : null,
      poolTeamId: isTeam(owner) ? null : owner.poolTeamId,
      academyRole: "reserve",
    });
    tx.update(youthLoansTable).set({ status: "returned" }).where(eq(youthLoansTable.id, l.id)).run();
    ensureYouthTeamTx(w, careerSaveId, owner);
    const b = borrowerOf(l);
    if (b) ensureYouthTeamTx(w, careerSaveId, b);
  }
  return due.map((l) => ({ playerId: l.playerId, loanId: l.id }));
}

/**
 * The player's club's share of this week's loans: half of each loaned youth's
 * wage, whichever side it is on. The main wage line leaves loaned-in youths out.
 */
export function teamLoanWeekTx(tx: Tx, careerSaveId: number, teamId: number) {
  const active = loansTx(tx, careerSaveId, "active");
  const mine = active.filter((l) => l.ownerTeamId === teamId || l.borrowerTeamId === teamId);
  const names = new Map(academyRowsTx(tx, careerSaveId, { playerIds: mine.map((l) => l.playerId) }).map((r) => [r.playerId, r.name]));
  const lines = mine.map((l) => {
    const halves = loanHalves(l.weeklyWage ?? 0);
    const out = l.ownerTeamId === teamId;
    const other = out ? borrowerOf(l) : ownerOf(l);
    return {
      loanId: l.id, playerId: l.playerId, out, amount: out ? halves.owner : halves.borrower, weeklyWage: l.weeklyWage ?? 0,
      description: `Youth loan: half of ${names.get(l.playerId) ?? "a youth"}'s academy wage ($${(out ? halves.owner : halves.borrower).toLocaleString()} of $${(l.weeklyWage ?? 0).toLocaleString()}), on loan ${out ? "to" : "from"} ${clubName(tx, other)}`,
    };
  });
  return { lines, loanedIn: new Set(mine.filter((l) => l.borrowerTeamId === teamId).map((l) => l.playerId)) };
}

/** The player's club paid its half of each of its loans this week (its ledger line): count it on the loan. */
export function recordTeamLoanWeekTx(tx: Tx, careerSaveId: number, teamId: number): void {
  for (const l of loansTx(tx, careerSaveId, "active")) {
    const h = loanHalves(l.weeklyWage ?? 0);
    if (l.ownerTeamId === teamId) tx.update(youthLoansTable).set({ ownerPaid: l.ownerPaid + h.owner }).where(eq(youthLoansTable.id, l.id)).run();
    else if (l.borrowerTeamId === teamId) tx.update(youthLoansTable).set({ borrowerPaid: l.borrowerPaid + h.borrower }).where(eq(youthLoansTable.id, l.id)).run();
  }
}

export function clubName(tx: Tx, club: Club | null): string {
  if (!club) return "another club";
  if (isTeam(club)) return tx.select({ name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, club.teamId)).all()[0]?.name ?? "your club";
  return tx.select({ name: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable)
    .where(eq(continentalPoolTeamsTable.id, club.poolTeamId)).all()[0]?.name ?? "an AI club";
}

// ── The AI clubs' week ──────────────────────────────────────────────────────

function aiClubsTx(tx: Tx, careerSaveId: number): Array<{ poolTeamId: number; continent: string; balance: number }> {
  return tx.select({
    poolTeamId: careerPoolTeamStateTable.poolTeamId, continent: continentalPoolTeamsTable.continent,
    balance: careerPoolTeamStateTable.balance,
  }).from(careerPoolTeamStateTable)
    .innerJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, careerPoolTeamStateTable.poolTeamId))
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), isNull(careerPoolTeamStateTable.takenOverAt)))
    .all()
    .map((r) => ({ ...r, balance: Number(r.balance) }));
}

const FOCUS: Array<"power" | "defense" | "serve" | "block" | "speed"> = ["power", "defense", "serve", "block", "speed"];

/**
 * The AI clubs' academies for a week, in the weekly block that charges the
 * player's club: fill each to AI_ACADEMY_SIZE by the intake's rule, develop them
 * (youth team full, reserves at RESERVE_COURT_SHARE; an AI youth works on her
 * weakest skill), bill them (the academy wage; half of it for a loan, either
 * side), list the reserves, and borrow where a club's youth team needs it.
 */
export function aiAcademiesWeekTx(w: CareerStateTx, careerSaveId: number, today: string):
  { made: number; listed: number; borrowed: Array<{ loanId: number; playerId: number; poolTeamId: number }>; charged: number } {
  const { tx } = w;
  const clubs = aiClubsTx(tx, careerSaveId);
  let made = 0, listed = 0, charged = 0;

  // 1. Fill: every graduate replaced, up to the academy's size. One factory per
  //    region (the name pool is the region's), made only when a club needs one.
  const factories = new Map<string, ReturnType<typeof youthFactoryTx>>();
  for (const c of clubs) {
    // Its own youths: those at the club less any on loan to it, plus its own away
    // on loan. A club that has borrowed keeps its own four, inside the cap.
    const club = { poolTeamId: c.poolTeamId };
    const borrowedIn = loansTx(tx, careerSaveId, "active").filter((l) => l.borrowerPoolTeamId === c.poolTeamId).length;
    const count = academyCountTx(tx, careerSaveId, club);
    const places = Math.min(AI_ACADEMY_SIZE - (count - borrowedIn), ACADEMY_CAP - count);
    if (places <= 0) continue;
    if (!factories.has(c.continent)) {
      const nations = [...(CORE_NATIONS[c.continent as ContinentKey] ?? Object.values(CORE_NATIONS).flat())];
      factories.set(c.continent, youthFactoryTx(w, careerSaveId, { home: null, nations }));
    }
    const youth = factories.get(c.continent)!;
    for (let i = 0; i < places; i++) { if (youth.make({ poolTeamId: c.poolTeamId })) made++; }
    ensureYouthTeamTx(w, careerSaveId, { poolTeamId: c.poolTeamId });
  }
  for (const f of factories.values()) f.stamp();

  // 2. Develop: the same week the player's academy has, by court time.
  const ids = clubs.map((c) => c.poolTeamId);
  const rows = academyRowsTx(tx, careerSaveId, { poolTeamIds: ids });
  for (const r of rows) {
    const share = r.academyRole === "reserve" ? RESERVE_COURT_SHARE : 1;
    const week = academyWeek(youthRating(r), r.potential, Math.floor(Math.random() * 5));
    const focus = FOCUS.reduce((lo, k) => (r[k] < r[lo] ? k : lo), FOCUS[0]!);
    const prev = r.focusXp ?? 0, next = prev + Math.round(week.focusXp * share);
    const gain = Math.floor(next / 100) - Math.floor(prev / 100);
    w.setPlayerState(careerSaveId, r.playerId, {
      trainingPoints: r.trainingPoints + Math.round(week.xp * share), focusXp: next,
      ...(gain > 0 ? { [focus]: Math.min(99, r[focus] + gain) } : {}),
    });
  }

  // 3. Bill: her wage to the club that holds her; a loan's wage split in half.
  const active = loansTx(tx, careerSaveId, "active");
  const onLoan = new Set(active.map((l) => l.playerId));
  const bill = new Map<number, number>();
  const add = (id: number, n: number) => bill.set(id, (bill.get(id) ?? 0) + n);
  for (const r of rows) if (!onLoan.has(r.playerId) && r.poolTeamId != null) add(r.poolTeamId, academyWeeklyWage(r.potential));
  for (const l of active) {
    const h = loanHalves(l.weeklyWage ?? 0);
    if (l.ownerPoolTeamId != null) add(l.ownerPoolTeamId, h.owner);
    if (l.borrowerPoolTeamId != null) add(l.borrowerPoolTeamId, h.borrower);
    tx.update(youthLoansTable).set({
      ownerPaid: l.ownerPaid + (l.ownerPoolTeamId != null ? h.owner : 0),
      borrowerPaid: l.borrowerPaid + (l.borrowerPoolTeamId != null ? h.borrower : 0),
    }).where(eq(youthLoansTable.id, l.id)).run();
  }
  for (const c of clubs) {
    const n = bill.get(c.poolTeamId) ?? 0;
    if (n === 0) continue;
    charged += n;
    tx.update(careerPoolTeamStateTable).set({ balance: c.balance - n, updatedAt: new Date() })
      .where(and(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId), eq(careerPoolTeamStateTable.poolTeamId, c.poolTeamId))).run();
  }

  // 4. List: a reserve gets no court time, so an AI club offers her.
  const open = new Set(loansTx(tx, careerSaveId, ["listed", "active"]).map((l) => l.playerId));
  for (const r of academyRowsTx(tx, careerSaveId, { poolTeamIds: ids })) {
    if (r.academyRole !== "reserve" || open.has(r.playerId) || r.poolTeamId == null) continue;
    if (listForLoanTx(tx, careerSaveId, { poolTeamId: r.poolTeamId }, r.playerId, today) == null) listed++;
  }

  // 5. Borrow, by need: a club with room, not already borrowing, whose weakest
  //    youth-team player a listed youth beats by AI_BORROW_GAP or more.
  const borrowed: Array<{ loanId: number; playerId: number; poolTeamId: number }> = [];
  const borrowing = new Set(loansTx(tx, careerSaveId, "active").map((l) => l.borrowerPoolTeamId).filter((x): x is number => x != null));
  const order = [...clubs].sort(() => Math.random() - 0.5);
  for (const c of order) {
    if (borrowed.length >= AI_BORROWS_PER_WEEK) break;
    if (borrowing.has(c.poolTeamId)) continue;
    const club = { poolTeamId: c.poolTeamId };
    if (academyCountTx(tx, careerSaveId, club) >= ACADEMY_CAP) continue;
    const team = academyAtTx(tx, careerSaveId, club).filter((r) => r.academyRole === "youth_team");
    const weakest = team.length < ACADEMY_YOUTH_TEAM ? 0 : Math.min(...team.map(youthRating));
    const listings = loansTx(tx, careerSaveId, "listed").filter((l) => !sameClub(ownerOf(l), club));
    const who = academyRowsTx(tx, careerSaveId, { playerIds: listings.map((l) => l.playerId) });
    const best = listings
      .map((l) => ({ l, r: who.find((x) => x.playerId === l.playerId) }))
      .filter((x): x is { l: typeof x.l; r: AcademyRow } => !!x.r && youthRating(x.r) >= weakest + AI_BORROW_GAP && allowedMonths(x.r.age, today).length > 0)
      .sort((a, b) => youthRating(b.r) - youthRating(a.r))[0];
    if (!best) continue;
    const months = Math.max(...allowedMonths(best.r.age, today));
    const res = borrowTx(w, careerSaveId, club, best.l.id, months, today);
    if ("loan" in res) { borrowed.push({ loanId: res.loan.id, playerId: res.loan.playerId, poolTeamId: c.poolTeamId }); borrowing.add(c.poolTeamId); }
  }
  return { made, listed, borrowed, charged };
}

/**
 * At the season boundary, after the ages move on: an AI academy player who has
 * reached 19 leaves the game. This career's record of her goes, as a retiree's
 * does (the athlete row is reference data and stays, owned by this career, so
 * no other career is seeded with her); the AI club's academy refills in the
 * next weekly block.
 */
export function releaseAiAcademyGraduatesTx(tx: Tx, careerSaveId: number): number {
  const going = tx.select({ playerId: careerPlayerStateTable.playerId }).from(careerPlayerStateTable)
    .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
    .where(and(
      eq(careerPlayerStateTable.careerSaveId, careerSaveId),
      isNotNull(careerPlayerStateTable.poolTeamId),
      eq(playersTable.playerType, "youth"),
      eq(careerPlayerStateTable.isPromoted, false),
    )).all()
    .map((r) => r.playerId);
  // Never one of the player's own youths out on loan at an AI club.
  const theirs = new Set(loansTx(tx, careerSaveId, "active").filter((l) => l.ownerTeamId != null).map((l) => l.playerId));
  const aged = going.length === 0 ? [] : tx.select({ playerId: careerPlayerStateTable.playerId, age: careerPlayerStateTable.age })
    .from(careerPlayerStateTable)
    .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), inArray(careerPlayerStateTable.playerId, going)))
    .all().filter((r) => r.age >= GRADUATION_AGE && !theirs.has(r.playerId)).map((r) => r.playerId);
  for (const id of aged) {
    tx.delete(careerPlayerStateTable)
      .where(and(eq(careerPlayerStateTable.careerSaveId, careerSaveId), eq(careerPlayerStateTable.playerId, id))).run();
    tx.delete(youthLoansTable).where(and(eq(youthLoansTable.careerSaveId, careerSaveId), eq(youthLoansTable.playerId, id))).run();
  }
  return aged.length;
}

/** At the season boundary: a listed youth who has just left the academy is off the list. */
export function withdrawGraduatedListingsTx(tx: Tx, careerSaveId: number, playerIds: number[]): void {
  if (playerIds.length === 0) return;
  tx.update(youthLoansTable).set({ status: "withdrawn" }).where(and(
    eq(youthLoansTable.careerSaveId, careerSaveId), eq(youthLoansTable.status, "listed"),
    inArray(youthLoansTable.playerId, playerIds),
  )).run();
}
