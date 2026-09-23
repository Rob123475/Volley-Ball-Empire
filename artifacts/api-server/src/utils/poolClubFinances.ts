/**
 * The sixty clubs of this world keep books, on the same rules the player does.
 *
 * ── Rob's rule (23 Sep, final) ──────────────────────────────────────────────
 * "Every AI club gets the same finances as the gamer's club: a balance, wages
 * paid each season under the same 6m/1s/2s contracts, the same running costs,
 * and the same prize money and sponsor income from their real World Tour
 * results. No shortcuts and no separate 'AI economy' — one set of rules for
 * every club. Then the broke-club rule must actually fire for them: 5
 * consecutive loss-making seasons → the AI club is sold."
 *
 * ── What is shared, and what is merely stored here ──────────────────────────
 * Nothing in this file decides anything. Every rule it applies is imported:
 *
 *   what a week costs          utils/clubFinances.ts, utils/runningCosts.ts
 *   what a result pays         utils/prizeDistribution.ts prizeFor()
 *   what purse a club can take utils/tierQualification.ts purseAccessFor()
 *   what tier its points reach utils/tierQualification.ts tierForPoints()
 *   contract lengths and ends  utils/contractTerms.ts
 *   what a loss-making season is, and how many sell a club
 *                              utils/board-confidence.ts
 *
 * What is here is the bookkeeping an AI club needs and the player's club gets
 * from its own tables: a balance (career_pool_team_state.balance), a squad on
 * contracts (pool_player_contracts, because a pool player is not a `players`
 * row and `contracts` cannot hold her) and the chain of season openings
 * (pool_club_seasons, because board_seasons is one row per career).
 *
 * ── Why this was not possible before ────────────────────────────────────────
 * It was, and the report of 22 Sep said otherwise: "an AI club is a
 * continental_pool_teams row with a name, a continent and a rating. It has no
 * balance sheet, so there is no such thing as a loss-making season for it."
 * That was true of the tables and not of the game. The results were already
 * real — every AI-vs-AI fixture is played through the player's own engine and
 * credited to competitor_rankings (utils/worldTour.ts) — so what was missing
 * was somewhere to put the money, not a way to know what the money was.
 */
import {
  careerPoolTeamStateTable, continentalPoolTeamsTable, continentalPoolPlayersTable,
  poolClubSeasonsTable, poolPlayerContractsTable, competitorsTable,
  competitorRankingsTable, worldTourQualificationsTable, careerSavesTable,
  seasonsTable, db,
} from "@workspace/db";
import { and, asc, desc, eq, isNull, isNotNull, lt, sql } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour.js";
import { prizeFor } from "./prizeDistribution.js";
import { purseAccessFor, tierForPoints, type Tier } from "./tierQualification.js";
import {
  weeklyClubOutgoings, sponsorWeeklyIncome, decayedReputation, monthlySalaryFor,
  SPONSOR_REP_BASELINE,
} from "./clubFinances.js";
import { ESTABLISHED_STARTING_BUDGET } from "./careerDifficulty.js";
import {
  CONTRACT_LENGTHS, contractEndDate, renewalEndDate, isContractLength,
  type ContractLength,
} from "./contractTerms.js";
import { isLossMakingSeason, LOSS_MAKING_SEASONS_TO_SALE } from "./board-confidence.js";
import { overallRating } from "./overallRating.js";
import { seasonNumberForYear } from "./seasonRollover.js";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Six clubs play in each continent's regional league, and the regional season
 * is built on that number: thirty fixtures, and it throws on any other.
 * utils/regionalSeason.ts promotes and relegates within it.
 */
export const CLUBS_PER_CONTINENTAL_LEAGUE = 6;

/** Every club in this world starts where an established career starts. */
export const POOL_CLUB_STARTING_BALANCE = ESTABLISHED_STARTING_BUDGET;

/** The purse of every scheduled round, from the one schedule the game has. */
const PURSE_BY_ROUND = new Map<number, number>(WORLD_TOUR.map((e) => [e.round, e.prize]));

export function purseForRound(round: number | null | undefined): number {
  if (round == null) return 0;
  return PURSE_BY_ROUND.get(round) ?? 0;
}

// ── Opening the books ────────────────────────────────────────────────────────

/**
 * Give every club of this career a balance and a squad under contract, once.
 *
 * Idempotent: a club that already has a live contract is left alone, so this is
 * safe at career creation, at every boot and at every season boundary. A save
 * made before AI clubs had books gets them the first time it is opened, with
 * every club on the same opening balance — there is no history to reconstruct
 * and inventing one would be inventing the numbers the rule is made of.
 */
export function openPoolClubBooksTx(
  tx: Tx, careerSaveId: number, today: string, seasonEnds: readonly string[],
): { clubs: number; contracts: number } {
  const states = tx.select({
    poolTeamId: careerPoolTeamStateTable.poolTeamId,
    balance:    careerPoolTeamStateTable.balance,
  }).from(careerPoolTeamStateTable)
    .where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).all();
  if (states.length === 0) return { clubs: 0, contracts: 0 };

  let clubs = 0;
  for (const st of states) {
    if (Number(st.balance) !== 0) continue;
    tx.update(careerPoolTeamStateTable)
      .set({ balance: POOL_CLUB_STARTING_BALANCE, updatedAt: new Date() })
      .where(and(
        eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
        eq(careerPoolTeamStateTable.poolTeamId, st.poolTeamId),
      )).run();
    clubs++;
  }

  const contracts = signMissingPoolContractsTx(tx, careerSaveId, today, seasonEnds);
  return { clubs, contracts };
}

/**
 * Everyone at an AI club is on one of the three lengths, like everyone else.
 *
 * A club signs its own players on the same terms the player's club can offer,
 * and the term is picked from the three by the club's rating rather than at
 * random: a stronger club ties its pair down for longer. That is a rule, not a
 * dice roll, so a run is repeatable and a table of it means something.
 */
export function signMissingPoolContractsTx(
  tx: Tx, careerSaveId: number, today: string, seasonEnds: readonly string[],
): number {
  const players = tx.select({
    id:         continentalPoolPlayersTable.id,
    poolTeamId: continentalPoolPlayersTable.poolTeamId,
    speed:      continentalPoolPlayersTable.speed,
    power:      continentalPoolPlayersTable.power,
    defense:    continentalPoolPlayersTable.defense,
    serve:      continentalPoolPlayersTable.serve,
    block:      continentalPoolPlayersTable.block,
    stamina:    continentalPoolPlayersTable.stamina,
    rating:     continentalPoolTeamsTable.rating,
  })
    .from(continentalPoolPlayersTable)
    .innerJoin(continentalPoolTeamsTable,
      eq(continentalPoolTeamsTable.id, continentalPoolPlayersTable.poolTeamId))
    .all();

  const live = new Set(
    tx.select({ poolPlayerId: poolPlayerContractsTable.poolPlayerId })
      .from(poolPlayerContractsTable)
      .where(and(
        eq(poolPlayerContractsTable.careerSaveId, careerSaveId),
        eq(poolPlayerContractsTable.status, "active"),
      )).all().map((r) => r.poolPlayerId),
  );

  let signed = 0;
  for (const p of players) {
    if (live.has(p.id)) continue;
    const length = lengthForRating(p.rating);
    tx.insert(poolPlayerContractsTable).values({
      careerSaveId,
      poolPlayerId: p.id,
      poolTeamId:   p.poolTeamId,
      length,
      startDate:    today,
      endDate:      contractEndDate(length, today, seasonEnds),
      salary:       monthlySalaryFor(overallRating(p)),
      status:       "active",
    }).onConflictDoNothing().run();
    signed++;
  }
  return signed;
}

/**
 * The term a club offers: the better the club, the longer it ties a player to
 * it. Only the three lengths exist, so this picks between them and invents
 * nothing.
 */
export function lengthForRating(clubRating: number): ContractLength {
  if (clubRating >= 78) return "2s";
  if (clubRating >= 70) return "1s";
  return CONTRACT_LENGTHS[0];
}

/**
 * Renew every AI deal that has run out, on the same three lengths.
 *
 * The row MOVES rather than being closed and replaced: a pool player never
 * changes club, so her contract row is the deal she is on. The new term is
 * measured from the day the old one ended, which is renewalEndDate's rule, the
 * same one the player's club renews on (utils/contractTerms.ts).
 */
export function renewExpiredPoolContractsTx(
  tx: Tx, careerSaveId: number, today: string, seasonEnds: readonly string[],
): number {
  const expired = tx.select({
    id:      poolPlayerContractsTable.id,
    length:  poolPlayerContractsTable.length,
    endDate: poolPlayerContractsTable.endDate,
  })
    .from(poolPlayerContractsTable)
    .where(and(
      eq(poolPlayerContractsTable.careerSaveId, careerSaveId),
      eq(poolPlayerContractsTable.status, "active"),
      lt(poolPlayerContractsTable.endDate, today),
    )).all();
  if (expired.length === 0) return 0;

  for (const c of expired) {
    const length = isContractLength(c.length) ? c.length : CONTRACT_LENGTHS[0];
    tx.update(poolPlayerContractsTable).set({
      startDate: c.endDate,
      endDate:   renewalEndDate(length, c.endDate, seasonEnds),
    }).where(eq(poolPlayerContractsTable.id, c.id)).run();
  }
  return expired.length;
}

// ── A week of being a club ───────────────────────────────────────────────────

/**
 * Which pool clubs are in this season's World Tour field.
 *
 * `world_tour_qualifications.season_year` holds the season NUMBER, not the
 * year - utils/worldTour.ts converts before it reads the same table, and this
 * has to convert the same way. Reading it with the year matched nothing, so
 * every club in the world looked like a club with no tour to pay for, and a
 * Gold club banked Gold purses on a regional club's costs.
 */
function fieldPoolIdsTx(tx: Tx, careerSaveId: number, seasonYear: number): Set<number> {
  const leagueSeason = seasonNumberForYear(seasonYear);
  return new Set(
    tx.select({ poolTeamId: worldTourQualificationsTable.poolTeamId })
      .from(worldTourQualificationsTable)
      .where(and(
        eq(worldTourQualificationsTable.careerSaveId, careerSaveId),
        eq(worldTourQualificationsTable.seasonYear, leagueSeason),
      )).all().map((r) => r.poolTeamId),
  );
}

/** The tier each pool club is paid in full at this season, from last season's points. */
function accessTierByPoolIdTx(tx: Tx, careerSaveId: number, seasonYear: number): Map<number, Tier> {
  const rows = tx.select({
    poolTeamId: competitorsTable.poolTeamId,
    points:     competitorRankingsTable.rankingPoints,
  })
    .from(competitorRankingsTable)
    .innerJoin(competitorsTable, eq(competitorsTable.id, competitorRankingsTable.competitorId))
    .where(and(
      eq(competitorRankingsTable.careerSaveId, careerSaveId),
      eq(competitorRankingsTable.seasonYear, seasonYear - 1),
      isNotNull(competitorsTable.poolTeamId),
    )).all();
  const map = new Map<number, Tier>();
  for (const r of rows) if (r.poolTeamId != null) map.set(r.poolTeamId, tierForPoints(r.points));
  return map;
}

/**
 * Charge every AI club its week, and pay it its sponsors.
 *
 * Runs in the same weekly block that charges the player's club
 * (routes/calendar.ts), on the same day, through the same functions. A club
 * that has been sold is not charged: it is not a club any more.
 */
export function chargePoolClubsWeekTx(
  tx: Tx, careerSaveId: number, seasonYear: number,
): { clubs: number; charged: number; paid: number } {
  const states = tx.select({
    poolTeamId: careerPoolTeamStateTable.poolTeamId,
    balance:    careerPoolTeamStateTable.balance,
    reputation: careerPoolTeamStateTable.sponsorReputation,
  }).from(careerPoolTeamStateTable)
    .where(and(
      eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
      // A club the PLAYER took over is the player's club and is charged there.
      // A club that has been sold is still a club: new owners, same costs.
      isNull(careerPoolTeamStateTable.takenOverAt),
    )).all();
  if (states.length === 0) return { clubs: 0, charged: 0, paid: 0 };

  const inField = fieldPoolIdsTx(tx, careerSaveId, seasonYear);
  const access = accessTierByPoolIdTx(tx, careerSaveId, seasonYear);
  const squads = squadsByPoolIdTx(tx, careerSaveId);

  let charged = 0, paid = 0;
  for (const st of states) {
    const squad = squads.get(st.poolTeamId) ?? [];
    const { total } = weeklyClubOutgoings({
      monthlySalaries: squad,
      squadSize:       squad.length,
      // A club outside the field plays its regional league and pays no tour.
      tier:            inField.has(st.poolTeamId) ? (access.get(st.poolTeamId) ?? "Bronze") : null,
    });
    const reputation = decayedReputation(st.reputation);
    const income = sponsorWeeklyIncome(reputation);
    charged += total;
    paid += income;
    tx.update(careerPoolTeamStateTable).set({
      balance:           Number(st.balance) + income - total,
      sponsorReputation: reputation,
      updatedAt:         new Date(),
    }).where(and(
      eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
      eq(careerPoolTeamStateTable.poolTeamId, st.poolTeamId),
    )).run();
  }
  return { clubs: states.length, charged, paid };
}

/** Every AI club's wage bill, as the monthly salaries its contracts carry. */
function squadsByPoolIdTx(tx: Tx, careerSaveId: number): Map<number, number[]> {
  const rows = tx.select({
    poolTeamId: poolPlayerContractsTable.poolTeamId,
    salary:     poolPlayerContractsTable.salary,
  }).from(poolPlayerContractsTable)
    .where(and(
      eq(poolPlayerContractsTable.careerSaveId, careerSaveId),
      eq(poolPlayerContractsTable.status, "active"),
    )).all();
  const map = new Map<number, number[]>();
  for (const r of rows) {
    const list = map.get(r.poolTeamId) ?? [];
    list.push(Number(r.salary));
    map.set(r.poolTeamId, list);
  }
  return map;
}

// ── What a result pays ───────────────────────────────────────────────────────

/**
 * Bank an AI club's share of an event, and move its reputation on the result.
 *
 * Called from utils/rankingPoints.ts creditCompetitorTx — the one place a
 * result becomes ranking points for any competitor — so an AI club is paid by
 * the same event, in the same instant, as it is scored. The player's club is
 * paid in routes/matches.ts and is never a pool club, so nothing is paid twice.
 */
export function creditPoolClubResultTx(tx: Tx, args: {
  careerSaveId: number;
  seasonYear: number;
  poolTeamId: number;
  eventTier: string | null;
  round: number | null;
  won: boolean;
}): number {
  const st = tx.select({
    balance:    careerPoolTeamStateTable.balance,
    reputation: careerPoolTeamStateTable.sponsorReputation,
  }).from(careerPoolTeamStateTable).where(and(
    eq(careerPoolTeamStateTable.careerSaveId, args.careerSaveId),
    eq(careerPoolTeamStateTable.poolTeamId, args.poolTeamId),
  )).get();
  if (!st) return 0;

  const access = accessTierByPoolIdTx(tx, args.careerSaveId, args.seasonYear).get(args.poolTeamId) ?? "Bronze";
  const purse = purseAccessFor(args.eventTier, access);
  const prize = prizeFor(purseForRound(args.round), args.won, purse.multiplier);

  // The same +1 a win and -1 a loss the player's club moves by (routes/matches.ts).
  const reputation = Math.max(0, Math.min(100, st.reputation + (args.won ? 1 : -1)));

  tx.update(careerPoolTeamStateTable).set({
    balance:           Number(st.balance) + prize,
    sponsorReputation: reputation,
    updatedAt:         new Date(),
  }).where(and(
    eq(careerPoolTeamStateTable.careerSaveId, args.careerSaveId),
    eq(careerPoolTeamStateTable.poolTeamId, args.poolTeamId),
  )).run();
  return prize;
}

// ── The season, and the five that sell a club ────────────────────────────────

/** Open this season's row for every club, on the balance it carries into it. */
export function openPoolClubSeasonsTx(
  tx: Tx, careerSaveId: number, seasonYear: number,
): number {
  const states = tx.select({
    poolTeamId: careerPoolTeamStateTable.poolTeamId,
    balance:    careerPoolTeamStateTable.balance,
  }).from(careerPoolTeamStateTable)
    .where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).all();

  const inField = fieldPoolIdsTx(tx, careerSaveId, seasonYear);
  let opened = 0;
  for (const st of states) {
    const existing = tx.select({ id: poolClubSeasonsTable.id }).from(poolClubSeasonsTable).where(and(
      eq(poolClubSeasonsTable.careerSaveId, careerSaveId),
      eq(poolClubSeasonsTable.poolTeamId, st.poolTeamId),
      eq(poolClubSeasonsTable.seasonYear, seasonYear),
    )).get();
    if (existing) continue;
    tx.insert(poolClubSeasonsTable).values({
      careerSaveId,
      poolTeamId:         st.poolTeamId,
      seasonYear,
      seasonStartBalance: Number(st.balance),
      inField:            inField.has(st.poolTeamId),
    }).onConflictDoNothing().run();
    opened++;
  }
  return opened;
}

export type PoolClubSale = {
  poolTeamId: number;
  name: string;
  seasonYear: number;
  balance: number;
  replacementPoolTeamId: number | null;
  replacementName: string | null;
};

/**
 * How many seasons in a row, ending with this one, the club finished below what
 * it opened on.
 *
 * The chain of openings IS the history, exactly as it is for the player's club
 * — and `isLossMakingSeason` is board-confidence.ts's, not a second opinion.
 */
export function poolLossMakingRunTx(
  tx: Tx, careerSaveId: number, poolTeamId: number, seasonYear: number, endBalance: number,
): number {
  const opens = new Map<number, number>(
    tx.select({
      year:  poolClubSeasonsTable.seasonYear,
      start: poolClubSeasonsTable.seasonStartBalance,
    }).from(poolClubSeasonsTable).where(and(
      eq(poolClubSeasonsTable.careerSaveId, careerSaveId),
      eq(poolClubSeasonsTable.poolTeamId, poolTeamId),
    )).all().map((r) => [r.year, Number(r.start)] as [number, number]),
  );

  const thisStart = opens.get(seasonYear);
  if (thisStart === undefined || !isLossMakingSeason(thisStart, endBalance)) return 0;

  let run = 1;
  for (let y = seasonYear - 1; ; y--) {
    const opened = opens.get(y);
    const closed = opens.get(y + 1);
    if (opened === undefined || closed === undefined) break;
    if (!isLossMakingSeason(opened, closed)) break;
    run++;
  }
  return run;
}

/**
 * The season is over: judge every AI club's books, and sell the broke ones.
 *
 * Rob's rule is the same one that sells the player's club — five consecutive
 * loss-making seasons — and it is the same constant and the same test. A club
 * that is sold leaves the world's league; its place in the field is taken by
 * the best club of this world that is not already in it, which is the same
 * rule the job market offers the player (routes/job-market.ts). The replacement
 * is a real club with a real name: nothing is invented.
 */
export function sellBrokePoolClubsTx(
  tx: Tx, careerSaveId: number, seasonYear: number,
): PoolClubSale[] {
  const states = tx.select({
    poolTeamId: careerPoolTeamStateTable.poolTeamId,
    balance:    careerPoolTeamStateTable.balance,
    name:       continentalPoolTeamsTable.teamName,
    continent:  continentalPoolTeamsTable.continent,
    inLeague:   careerPoolTeamStateTable.isActiveInLeague,
  }).from(careerPoolTeamStateTable)
    .innerJoin(continentalPoolTeamsTable,
      eq(continentalPoolTeamsTable.id, careerPoolTeamStateTable.poolTeamId))
    .where(and(
      eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
      isNull(careerPoolTeamStateTable.takenOverAt),
    )).all();

  const broke = states.filter((st) =>
    poolLossMakingRunTx(tx, careerSaveId, st.poolTeamId, seasonYear, Number(st.balance))
      >= LOSS_MAKING_SEASONS_TO_SALE);
  if (broke.length === 0) return [];

  // One mechanism, not two. The first version swapped each broke club for a
  // replacement AND then restored the six-a-continent count, and on a boundary
  // that sold three clubs in one continent the two fought: the swap promoted a
  // club and the count-restore sent it back down, so the club named as taking
  // the place was often not the club that took it.
  //
  // So the sale only does the half that is its business - the club changes
  // hands and gives up its league place - and the league's own count rule
  // fills the gap, which is what decides who comes up anyway. Whoever is in
  // the league afterwards and was not before IS the replacement, by
  // observation rather than by assertion.
  const before = new Set(states.filter((st) => st.inLeague).map((st) => st.poolTeamId));

  for (const st of broke) {
    // New owners. The club does not vanish - there are sixty in this world and
    // no more are written - it changes hands and opens on what any club of this
    // world opens on. The chain the rule reads breaks here of its own accord,
    // because next season opens far above the one that sold it.
    tx.update(careerPoolTeamStateTable).set({
      soldAt:            new Date(),
      soldInSeason:      seasonYear,
      balance:           POOL_CLUB_STARTING_BALANCE,
      sponsorReputation: SPONSOR_REP_BASELINE,
      isActiveInLeague:  false,
      updatedAt:         new Date(),
    }).where(and(
      eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
      eq(careerPoolTeamStateTable.poolTeamId, st.poolTeamId),
    )).run();
  }

  reconcileLeagueSizesTx(tx, careerSaveId, new Set(broke.map((st) => st.poolTeamId)));

  const after = tx.select({
    poolTeamId: careerPoolTeamStateTable.poolTeamId,
    name:       continentalPoolTeamsTable.teamName,
    continent:  continentalPoolTeamsTable.continent,
  }).from(careerPoolTeamStateTable)
    .innerJoin(continentalPoolTeamsTable,
      eq(continentalPoolTeamsTable.id, careerPoolTeamStateTable.poolTeamId))
    .where(and(
      eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
      eq(careerPoolTeamStateTable.isActiveInLeague, true),
    )).all();

  // Who came up, per continent, in the order the count rule took them.
  const cameUp = new Map<string, Array<{ poolTeamId: number; name: string }>>();
  for (const r of after) {
    if (before.has(r.poolTeamId)) continue;
    const list = cameUp.get(r.continent) ?? [];
    list.push({ poolTeamId: r.poolTeamId, name: r.name });
    cameUp.set(r.continent, list);
  }

  return broke.map((st) => {
    const replacement = st.inLeague ? cameUp.get(st.continent)?.shift() ?? null : null;
    return {
      poolTeamId: st.poolTeamId,
      name:       st.name,
      seasonYear,
      balance:    Number(st.balance),
      replacementPoolTeamId: replacement?.poolTeamId ?? null,
      replacementName:       replacement?.name ?? null,
    };
  });
}

/**
 * Six clubs to a continent, always.
 *
 * The regional season is built on it: thirty fixtures a continent, and it
 * throws outright if it counts any other number. Clubs leave the league by
 * relegation (utils/regionalSeason.ts) and now by going broke, and they come
 * back by promotion - so the count is not reasoned about here, it is restored.
 * Too many and the worst-ranked go back to the bench, too few and the best of
 * the bench come up, by the same pool ranking the regional season promotes by,
 * so this cannot disagree with it about who belongs.
 */
export function reconcileLeagueSizesTx(
  tx: Tx, careerSaveId: number, lastInLine: ReadonlySet<number> = new Set(),
): number {
  const rows = tx.select({
    poolTeamId:  careerPoolTeamStateTable.poolTeamId,
    inLeague:    careerPoolTeamStateTable.isActiveInLeague,
    takenOverAt: careerPoolTeamStateTable.takenOverAt,
    continent:   continentalPoolTeamsTable.continent,
    poolRanking: continentalPoolTeamsTable.poolRanking,
  }).from(careerPoolTeamStateTable)
    .innerJoin(continentalPoolTeamsTable,
      eq(continentalPoolTeamsTable.id, careerPoolTeamStateTable.poolTeamId))
    .where(eq(careerPoolTeamStateTable.careerSaveId, careerSaveId)).all();

  const byContinent = new Map<string, typeof rows>();
  for (const r of rows) {
    // A club the player took over is their club, not one of the world's.
    if (r.takenOverAt != null) continue;
    const list = byContinent.get(r.continent) ?? [];
    list.push(r);
    byContinent.set(r.continent, list);
  }

  let moved = 0;
  for (const [, list] of byContinent) {
    const inLeague = list.filter((r) => r.inLeague)
      .sort((a, b) => a.poolRanking - b.poolRanking);
    // `lastInLine` are the clubs that have just gone broke. They are not barred
    // from coming back - a continent short of six would break the regional
    // season, and that matters more - they simply go to the back of the queue,
    // so a club is not sold and promoted again on the same day while somebody
    // else was waiting.
    const bench = list.filter((r) => !r.inLeague)
      .sort((a, b) =>
        (lastInLine.has(a.poolTeamId) ? 1 : 0) - (lastInLine.has(b.poolTeamId) ? 1 : 0)
        || a.poolRanking - b.poolRanking);

    for (const r of inLeague.slice(CLUBS_PER_CONTINENTAL_LEAGUE)) {
      tx.update(careerPoolTeamStateTable).set({ isActiveInLeague: false, updatedAt: new Date() })
        .where(and(
          eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
          eq(careerPoolTeamStateTable.poolTeamId, r.poolTeamId),
        )).run();
      moved++;
    }
    for (const r of bench.slice(0, Math.max(0, CLUBS_PER_CONTINENTAL_LEAGUE - inLeague.length))) {
      tx.update(careerPoolTeamStateTable).set({
        isActiveInLeague: true,
        promotionCount:   sql`${careerPoolTeamStateTable.promotionCount} + 1`,
        updatedAt:        new Date(),
      }).where(and(
        eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
        eq(careerPoolTeamStateTable.poolTeamId, r.poolTeamId),
      )).run();
      moved++;
    }
  }
  return moved;
}

// ── Saves made before the sixty had books ────────────────────────────────────

/**
 * Open the books of every career on this save, once, at boot.
 *
 * A save made before this build has sixty clubs with a balance of nought and no
 * contracts, which would read as sixty broke clubs the moment the rule was
 * applied. They open on the same balance a new career's clubs open on and their
 * pairs sign the same deals; the season they are in is opened on that balance,
 * so the chain the rule reads starts today rather than pretending to a history
 * nobody recorded.
 *
 * Idempotent: a club with a balance already, or a live contract, is left alone.
 */
export function backfillPoolClubBooks(): { careers: number; clubs: number; contracts: number } {
  return db.transaction((tx) => {
    const saves = tx.select({ id: careerSavesTable.id }).from(careerSavesTable).all();
    let careers = 0, clubs = 0, contracts = 0;
    for (const save of saves) {
      const season = tx.select({ year: seasonsTable.year, startDate: seasonsTable.startDate })
        .from(seasonsTable)
        .where(eq(seasonsTable.careerSaveId, save.id))
        .orderBy(desc(seasonsTable.year)).limit(1).get();
      if (!season) continue;
      const ends = tx.select({ endDate: seasonsTable.endDate }).from(seasonsTable)
        .where(eq(seasonsTable.careerSaveId, save.id))
        .orderBy(asc(seasonsTable.endDate)).all().map((r) => r.endDate);

      const opened = openPoolClubBooksTx(tx, save.id, season.startDate, ends);
      openPoolClubSeasonsTx(tx, save.id, season.year);
      if (opened.clubs > 0 || opened.contracts > 0) careers++;
      clubs += opened.clubs;
      contracts += opened.contracts;
    }
    return { careers, clubs, contracts };
  });
}
