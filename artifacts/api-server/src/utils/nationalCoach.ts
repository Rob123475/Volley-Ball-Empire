/**
 * 1.1.3 (Rob, 23 Oct; brief A4c): the player coaches a nation on top of his club
 * job. The numbers are NATIONAL_COACH, NATIONAL_COACH_PAY and NATIONAL_CAMP (lib/db
 * schema/national-coach.ts).
 *
 *   offers     whenever he has no national job: 1 to 3 nations offer, in the six
 *              months before a Cup (its group day), and as soon as his national
 *              contract ends, so a job can come up before or after a Cup. Better
 *              manager record (his level), better nations: his level picks a band
 *              of the nations ranked by strength. They wait on the Career page and
 *              the job market (and a Dashboard notice) until he accepts one or
 *              declines them all.
 *   contract   3 or 5 years, his only choice. The pay is fixed when offered, against
 *              the nation's strength (the weakest pay the most), and is his own: it
 *              is paid to him day by day (national_coach_jobs.paid), never through
 *              the club's books, and counts in his career earnings.
 *   the team   the National Team page: every player of his nation at any club
 *              (never a free agent), injuries and fitness shown; he picks the pair
 *              for the next Cup (two fit players; by the Cup's first day, else the
 *              best two fit play) and a short camp (training or recovery). Locked
 *              once the Cup is drawn. In the Cup he may play his nation's matches
 *              in Manual or Auto; every other match is Auto only.
 *
 * Strength: a nation's best two fit players' average rating (nationalPlayersTx),
 * among the nations that can field a pair; share 0 = the strongest, 1 = the weakest.
 */
import {
  nationalCoachJobsTable, nationalCoachOffersTable, nationsCupPrepTable, olympicTournamentsTable, teamsTable, careerSavesTable,
  NATIONAL_COACH, nationalCoachPay, managerLevelFor, type NationalCampChoice, type NationalCoachJob,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { nationalPlayersTx, nationsCupDays, nextOlympicsYear, type NationalPlayer } from "./olympics.js";

type Tx = CareerStateTx["tx"];

const addDays = (date: string, days: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const addMonths = (date: string, months: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + months); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** A fixed number in [0, 1) for this career and key (FNV-1a): offers are the same on every reload. */
function roll(careerSaveId: number, key: string): number {
  let h = 0x811c9dc5;
  for (const ch of `${careerSaveId}:${key}:national-coach`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h / 0x100000000;
}

/** His national job, if one is running. */
export function activeNationalJobTx(tx: Tx, careerSaveId: number): NationalCoachJob | null {
  return tx.select().from(nationalCoachJobsTable)
    .where(and(eq(nationalCoachJobsTable.careerSaveId, careerSaveId), eq(nationalCoachJobsTable.status, "active")))
    .orderBy(desc(nationalCoachJobsTable.id)).get() ?? null;
}

/** The nation he coaches today, or null. */
export function coachedNationTx(tx: Tx, careerSaveId: number): string | null {
  return activeNationalJobTx(tx, careerSaveId)?.nation ?? null;
}

export type NationStrength = { nation: string; rating: number; eligible: number; rank: number; share: number };

/** The nations that can field a pair, strongest first, with each one's share (0 strongest .. 1 weakest). */
export function nationStrengthsTx(tx: Tx, careerSaveId: number, playerTeamId: number | null): NationStrength[] {
  const ranked = [...nationalPlayersTx(tx, careerSaveId, playerTeamId)]
    .map(([nation, players]) => { const fit = players.filter((p) => !p.injured); return { nation, fit }; })
    .filter((n) => n.fit.length >= NATIONAL_COACH.minEligible)
    .map((n) => ({ nation: n.nation, rating: (n.fit[0]!.rating + n.fit[1]!.rating) / 2, eligible: n.fit.length }))
    .sort((a, b) => b.rating - a.rating || a.nation.localeCompare(b.nation));
  return ranked.map((n, i) => ({ ...n, rank: i + 1, share: ranked.length <= 1 ? 0 : i / (ranked.length - 1) }));
}

/** His manager level (1 Local Coach .. 5 Legend): the one measure of his record (teams.manager_rep_points). */
function managerLevelTx(tx: Tx, careerSaveId: number): number {
  const save = tx.select({ teamId: careerSavesTable.teamId, formerTeamId: careerSavesTable.formerTeamId }).from(careerSavesTable).where(eq(careerSavesTable.id, careerSaveId)).get();
  const teamId = save?.teamId ?? save?.formerTeamId ?? null;
  const points = teamId == null ? 0 : tx.select({ p: teamsTable.managerRepPoints }).from(teamsTable).where(eq(teamsTable.id, teamId)).get()?.p ?? 0;
  return managerLevelFor(points).level;
}

/** The next Cup whose group day is today or later: its year and days. */
export function nextCupTx(tx: Tx, careerSaveId: number, today: string) {
  let year = nextOlympicsYear(Number(today.slice(0, 4)));
  let days = nationsCupDays(year, careerSaveId, tx);
  if (days.group < today) { year = nextOlympicsYear(year + 1); days = nationsCupDays(year, careerSaveId, tx); }
  return { year, days };
}

export function openOffersTx(tx: Tx, careerSaveId: number) {
  return tx.select().from(nationalCoachOffersTable)
    .where(and(eq(nationalCoachOffersTable.careerSaveId, careerSaveId), eq(nationalCoachOffersTable.status, "open")))
    .orderBy(asc(nationalCoachOffersTable.strengthRank)).all();
}

/**
 * Make his offers: 1 to 3 nations from the band of the strength ranking his level opens
 * (NATIONAL_COACH.levelBands), each at its fixed pay. None if no nation can field a pair.
 */
export function makeNationalOffersTx(tx: Tx, careerSaveId: number, playerTeamId: number | null, today: string, reason: "cup_window" | "contract_end", cupYear: number) {
  const ranked = nationStrengthsTx(tx, careerSaveId, playerTeamId);
  if (ranked.length === 0) return [];
  const [lo, hi] = NATIONAL_COACH.levelBands[managerLevelTx(tx, careerSaveId)] ?? NATIONAL_COACH.levelBands[1]!;
  let band = ranked.filter((n) => n.share >= lo && n.share <= hi);
  if (band.length === 0) band = ranked;
  const span = NATIONAL_COACH.offersMax - NATIONAL_COACH.offersMin + 1;
  const count = Math.min(band.length, NATIONAL_COACH.offersMin + Math.floor(roll(careerSaveId, `${today}:${reason}:count`) * span));
  const picked = band.map((n) => ({ n, k: roll(careerSaveId, `${today}:${reason}:${n.nation}`) })).sort((a, b) => a.k - b.k).slice(0, count).map((x) => x.n);
  const rows = picked.sort((a, b) => a.rank - b.rank).map((n) => tx.insert(nationalCoachOffersTable).values({
    careerSaveId, nation: n.nation, monthly: nationalCoachPay(n.share), strengthRank: n.rank, ranked: ranked.length,
    offeredOn: today, reason, cupYear,
  }).returning().get());
  return rows;
}

/**
 * The calendar's day for the national job (routes/calendar.ts): a contract that ends today
 * ends (and offers come at once); with no job and no offer waiting, the window before the
 * next Cup opens its offers; a running job is paid for the day. Returns Club News lines.
 */
export function nationalCoachDayTx(w: CareerStateTx, careerSaveId: number, playerTeamId: number | null, today: string): string[] {
  const tx = w.tx;
  const events: string[] = [];
  let job = activeNationalJobTx(tx, careerSaveId);
  if (job && job.endsOn <= today) {
    payJobTx(tx, job, job.endsOn);
    tx.update(nationalCoachJobsTable).set({ status: "ended" }).where(eq(nationalCoachJobsTable.id, job.id)).run();
    events.push(`Your contract as ${job.nation}'s national coach has ended`);
    const made = makeNationalOffersTx(tx, careerSaveId, playerTeamId, today, "contract_end", nextCupTx(tx, careerSaveId, today).year);
    if (made.length) events.push(offerNews(made.map((o) => o.nation)));
    job = null;
  }
  if (job) { payJobTx(tx, job, today); return events; }
  if (openOffersTx(tx, careerSaveId).length > 0) return events;
  const next = nextCupTx(tx, careerSaveId, today);
  const windowOpens = addMonths(next.days.group, -NATIONAL_COACH.offerWindowMonths);
  if (today < windowOpens || today >= next.days.group) return events;
  const already = tx.select({ id: nationalCoachOffersTable.id }).from(nationalCoachOffersTable).where(and(
    eq(nationalCoachOffersTable.careerSaveId, careerSaveId), eq(nationalCoachOffersTable.cupYear, next.year), eq(nationalCoachOffersTable.reason, "cup_window"),
  )).limit(1).get();
  if (already) return events;
  const made = makeNationalOffersTx(tx, careerSaveId, playerTeamId, today, "cup_window", next.year);
  if (made.length) events.push(offerNews(made.map((o) => o.nation)));
  return events;
}

function offerNews(nations: string[]): string {
  return nations.length === 1
    ? `${nations[0]} want you as their national coach: see Career`
    : `${nations.slice(0, -1).join(", ")} and ${nations.at(-1)} want you as their national coach: see Career`;
}

/** Pay a running job up to `through`: its monthly pay a day (x 12 / 365), his own money. */
function payJobTx(tx: Tx, job: NationalCoachJob, through: string): void {
  const from = job.paidTo ?? addDays(job.startedOn, -1);
  const days = Math.max(0, daysBetween(from, through));
  if (days === 0) return;
  const paid = Number(job.paid) + (Number(job.monthly) * 12 / 365) * days;
  tx.update(nationalCoachJobsTable).set({ paid, paidTo: through }).where(eq(nationalCoachJobsTable.id, job.id)).run();
  job.paid = paid; job.paidTo = through;
}

/** Accept one offer for 3 or 5 years: the job starts today; every other open offer is declined. */
export function acceptNationalOfferTx(tx: Tx, careerSaveId: number, offerId: number, years: number, today: string): { ok: true; job: NationalCoachJob } | { ok: false; error: string } {
  if (!(NATIONAL_COACH.contractYears as readonly number[]).includes(years)) return { ok: false, error: `A national contract is ${NATIONAL_COACH.contractYears.join(" or ")} years.` };
  if (activeNationalJobTx(tx, careerSaveId)) return { ok: false, error: "You already coach a nation." };
  const offers = openOffersTx(tx, careerSaveId);
  const offer = offers.find((o) => o.id === offerId);
  if (!offer) return { ok: false, error: "That offer is not open." };
  const job = tx.insert(nationalCoachJobsTable).values({
    careerSaveId, nation: offer.nation, years, monthly: offer.monthly, startedOn: today, endsOn: addMonths(today, 12 * years), status: "active",
  }).returning().get();
  for (const o of offers) {
    tx.update(nationalCoachOffersTable).set({ status: o.id === offerId ? "accepted" : "declined", answeredOn: today }).where(eq(nationalCoachOffersTable.id, o.id)).run();
  }
  return { ok: true, job };
}

/** Decline every open offer (the next come with the next Cup's window, or when a contract ends). */
export function declineNationalOffersTx(tx: Tx, careerSaveId: number, today: string): number {
  const offers = openOffersTx(tx, careerSaveId);
  for (const o of offers) tx.update(nationalCoachOffersTable).set({ status: "declined", answeredOn: today }).where(eq(nationalCoachOffersTable.id, o.id)).run();
  return offers.length;
}

/** What he has been paid as a national coach, in all (his career earnings). */
export function nationalCoachEarnedTx(tx: Tx, careerSaveId: number): number {
  return tx.select({ p: nationalCoachJobsTable.paid }).from(nationalCoachJobsTable).where(eq(nationalCoachJobsTable.careerSaveId, careerSaveId)).all()
    .reduce((t, r) => t + Number(r.p), 0);
}

export type NationalTeamView = {
  job: (NationalCoachJob & { yearsLeft: number; daysLeft: number }) | null;
  players: NationalPlayer[];
  cupYear: number; cupStartsOn: string; locked: boolean;
  pair: Array<{ kind: "player" | "pool"; id: number }> | null;
  camp: NationalCampChoice | null;
};

/** The National Team page: his job, his nation's players at clubs, and his picks for the next Cup. */
export function nationalTeamViewTx(tx: Tx, careerSaveId: number, playerTeamId: number | null, today: string): NationalTeamView | null {
  const job = activeNationalJobTx(tx, careerSaveId);
  if (!job) return null;
  const { year, days } = nextCupTx(tx, careerSaveId, today);
  const drawnThisYear = tx.select({ id: olympicTournamentsTable.id }).from(olympicTournamentsTable)
    .where(and(eq(olympicTournamentsTable.careerSaveId, careerSaveId), eq(olympicTournamentsTable.seasonYear, Number(today.slice(0, 4))))).get();
  // While this year's Cup is drawn and being played, the page shows it (locked); after it, the next one.
  const cupYear = drawnThisYear && today <= nationsCupDays(Number(today.slice(0, 4)), careerSaveId, tx).medal ? Number(today.slice(0, 4)) : year;
  const cupStartsOn = cupYear === year ? days.group : nationsCupDays(cupYear, careerSaveId, tx).group;
  const locked = !!tx.select({ id: olympicTournamentsTable.id }).from(olympicTournamentsTable)
    .where(and(eq(olympicTournamentsTable.careerSaveId, careerSaveId), eq(olympicTournamentsTable.seasonYear, cupYear))).get();
  const prep = tx.select().from(nationsCupPrepTable).where(and(eq(nationsCupPrepTable.careerSaveId, careerSaveId), eq(nationsCupPrepTable.seasonYear, cupYear))).get();
  const daysLeft = Math.max(0, daysBetween(today, job.endsOn));
  return {
    job: { ...job, daysLeft, yearsLeft: Math.round((daysLeft / 365) * 10) / 10 },
    players: nationalPlayersTx(tx, careerSaveId, playerTeamId).get(job.nation) ?? [],
    cupYear, cupStartsOn, locked,
    pair: prep?.nation === job.nation ? prep.pair ?? null : null,
    camp: prep?.nation === job.nation ? (prep.camp as NationalCampChoice | null) : null,
  };
}

function upsertPrepTx(tx: Tx, careerSaveId: number, seasonYear: number, nation: string, patch: { pair?: Array<{ kind: "player" | "pool"; id: number }>; camp?: NationalCampChoice }) {
  const prep = tx.select().from(nationsCupPrepTable).where(and(eq(nationsCupPrepTable.careerSaveId, careerSaveId), eq(nationsCupPrepTable.seasonYear, seasonYear))).get();
  if (prep) {
    tx.update(nationsCupPrepTable).set({ nation, ...(prep.nation !== nation ? { pair: null, camp: null } : {}), ...patch }).where(eq(nationsCupPrepTable.id, prep.id)).run();
  } else {
    tx.insert(nationsCupPrepTable).values({ careerSaveId, seasonYear, nation, pair: patch.pair ?? null, camp: patch.camp ?? null }).run();
  }
}

/** Pick the pair for the next Cup: two different fit players of his nation at clubs. */
export function pickNationalPairTx(tx: Tx, careerSaveId: number, playerTeamId: number | null, today: string, pair: Array<{ kind: string; id: number }>): { ok: true } | { ok: false; error: string } {
  const view = nationalTeamViewTx(tx, careerSaveId, playerTeamId, today);
  if (!view?.job) return { ok: false, error: "You don't coach a nation." };
  if (view.locked) return { ok: false, error: `The ${view.cupYear} Nations Cup has been drawn: the pairs are set.` };
  if (pair.length !== 2 || (pair[0]!.kind === pair[1]!.kind && pair[0]!.id === pair[1]!.id)) return { ok: false, error: "Pick two different players." };
  const found = pair.map((c) => view.players.find((p) => p.kind === c.kind && p.id === c.id));
  if (found.some((p) => !p)) return { ok: false, error: `Both must be ${view.job.nation} players at a club.` };
  const injured = found.filter((p) => p!.injured);
  if (injured.length) return { ok: false, error: `${injured.map((p) => p!.name).join(" and ")} ${injured.length === 1 ? "is" : "are"} injured: an injured player can't be picked.` };
  upsertPrepTx(tx, careerSaveId, view.cupYear, view.job.nation, { pair: found.map((p) => ({ kind: p!.kind, id: p!.id })) });
  return { ok: true };
}

/** Choose the short pre-Cup camp: training or recovery. */
export function chooseNationalCampTx(tx: Tx, careerSaveId: number, playerTeamId: number | null, today: string, camp: string): { ok: true } | { ok: false; error: string } {
  if (camp !== "training" && camp !== "recovery") return { ok: false, error: "The camp is training or recovery." };
  const view = nationalTeamViewTx(tx, careerSaveId, playerTeamId, today);
  if (!view?.job) return { ok: false, error: "You don't coach a nation." };
  if (view.locked) return { ok: false, error: `The ${view.cupYear} Nations Cup has been drawn: the camp is over.` };
  upsertPrepTx(tx, careerSaveId, view.cupYear, view.job.nation, { camp });
  return { ok: true };
}
