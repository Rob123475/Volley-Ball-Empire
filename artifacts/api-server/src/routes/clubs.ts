/**
 * 1.1.1, Part 1 (Rob, 16 Oct): the Clubs page. Every club in the career, the
 * player's included, and each AI club's players and staff.
 *
 *   GET /clubs           every club: badge, continent, tier, World Tour ladder
 *                        position and record, balance, senior wages against the
 *                        cap, injuries this season
 *   GET /clubs/:id       one AI club (its pool team id): manager, record, last 5
 *                        World Tour results, its seniors and academy youths, its
 *                        staff and medical team
 *
 * Two ladders: the World Tour's (worldTourStandingsTx), for the clubs in this
 * season's field (the player's club plays only this one), and each AI club's
 * regional league (computeLadderForSeason, this year's season of its
 * continent). Tier is the Dashboard's (shownTier: the higher of this season's
 * points' tier and the tier the club is paid at this season). A player's attributes are
 * hidden until scouted, by the Player Market's own rule (isRevealed); the page
 * shows each senior through her Player Market card (GET /players/market-all).
 */
import { Router } from "express";
import {
  db, careerSavesTable, careerPoolTeamStateTable, continentalPoolTeamsTable, teamsTable, clubTemplatesTable,
  careerInjuriesTable, competitorsTable, worldTourFixturesTable,
} from "@workspace/db";
import { and, desc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { loadPlayers, loadStaffTx, requireCareerSaveId, withCareerStateTx, type PlayerDTO } from "../lib/playerDto.js";
import { careerGameDateTx } from "../utils/gameDate.js";
import { worldTourStandingsTx, type StandingRow } from "../utils/worldTour.js";
import { tierForPoints, shownTier } from "../utils/tierQualification.js";
import { purseAccessTierFor } from "../utils/rankingPoints.js";
import { accessTierByPoolIdTx } from "../utils/poolClubFinances.js";
import { seniorWageBillTx, wageCapView } from "../utils/salaryCap.js";
import { clubManagersOf, playerManagerCard } from "../utils/managerFaces.js";
import { materializeAiSeniorsTx } from "../utils/aiSquads.js";
import { isRevealed, scoutState } from "../utils/marketScouting.js";
import { overallRating } from "../utils/overallRating.js";
import { youthRating } from "../utils/youthLoans.js";
import { watchedTx } from "../utils/scoutReports.js";
import { academyWeeklyWage } from "../utils/academy.js";
import { loadLeagueSeasons } from "../lib/regionalLeague.js";
import { computeLadderForSeason } from "../utils/regionalSeason.js";
import { isYouthPlayer } from "../utils/playerClassification.js";

const router = Router();

/** The season year of a game date (seasons run Jan 1 to Dec 31). */
const yearOf = (date: string) => Number(date.slice(0, 4));

function careerContext(careerSaveId: number) {
  return db.transaction((tx) => {
    const today = careerGameDateTx(tx, careerSaveId);
    const year = yearOf(today);
    const standings = worldTourStandingsTx(tx, careerSaveId, year);
    return { today, year, standings };
  });
}

/**
 * Each AI club's position in its regional league: its continent's most recent
 * league season with results (a league season's number is not the calendar
 * year, and the next one is drawn before it is played). Null before any.
 */
async function regionalPositions(careerSaveId: number): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  const seasons = (await loadLeagueSeasons(careerSaveId, {})).sort((a, b) => b.seasonYear - a.seasonYear);
  const done = new Set<string>();
  for (const s of seasons) {
    if (done.has(s.continent)) continue;
    const ladder = await computeLadderForSeason(s.id, careerSaveId);
    if (ladder.length === 0) continue;
    ladder.forEach((e, i) => out.set(e.poolTeamId, i + 1));
    done.add(s.continent);
  }
  return out;
}

function standingFor(standings: StandingRow[], club: { teamId?: number; poolTeamId?: number }): StandingRow | null {
  return standings.find((s) => (club.teamId != null ? s.teamId === club.teamId : s.poolTeamId === club.poolTeamId)) ?? null;
}

router.get("/clubs", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { today, year, standings } = careerContext(cid);
  const managers = clubManagersOf(cid);
  const regional = await regionalPositions(cid);
  // The tier each club is paid at this season (shownTier): his by his difficulty or last season, an AI club's by last season.
  const myPaidTier = await purseAccessTierFor(cid, team.id, year);

  const rows = db.transaction((tx) => {
    const aiPaidTier = accessTierByPoolIdTx(tx, cid, year);
    const injuries = tx.select({ teamId: careerInjuriesTable.teamId, poolTeamId: careerInjuriesTable.poolTeamId }).from(careerInjuriesTable)
      .where(and(eq(careerInjuriesTable.careerSaveId, cid), gte(careerInjuriesTable.gameDate, `${year}-01-01`))).all();
    const injuriesOf = (c: { teamId?: number; poolTeamId?: number }) =>
      injuries.filter((i) => (c.teamId != null ? i.teamId === c.teamId : i.poolTeamId === c.poolTeamId)).length;
    const line = (c: { teamId?: number; poolTeamId?: number }) => {
      const s = standingFor(standings, c);
      const bill = seniorWageBillTx(tx, cid, c.teamId != null ? { teamId: c.teamId } : { poolTeamId: c.poolTeamId! });
      return {
        tier: shownTier(tierForPoints(s?.points ?? 0), c.teamId != null ? myPaidTier : (aiPaidTier.get(c.poolTeamId!) ?? "Bronze")),
        ladderPosition: s?.rank ?? null, points: s?.points ?? 0,
        regionalPosition: c.poolTeamId != null ? (regional.get(c.poolTeamId) ?? null) : null,
        wins: s?.wins ?? 0, losses: s?.losses ?? 0, form: s?.form ?? [],
        wages: wageCapView(bill), injuries: injuriesOf(c),
      };
    };

    // The player's club: its continent is its template's (the club he started with); else not known.
    const save = tx.select({ original: careerSavesTable.originalClubName }).from(careerSavesTable).where(eq(careerSavesTable.id, cid)).get();
    const template = save?.original
      ? tx.select({ continent: clubTemplatesTable.continent }).from(clubTemplatesTable).where(eq(clubTemplatesTable.name, save.original)).get() : undefined;
    const mine = {
      kind: "mine" as const, id: team.id, name: team.name, continent: template?.continent ?? null,
      primaryColor: team.logoColor, secondaryColor: team.secondaryLogoColor, crestShapeIndex: team.crestShapeIndex,
      balance: Math.round(Number(team.budget)), manager: playerManagerCard(cid), ...line({ teamId: team.id }),
    };

    const pool = tx.select({
      id: continentalPoolTeamsTable.id, name: continentalPoolTeamsTable.teamName, continent: continentalPoolTeamsTable.continent,
      primaryColor: continentalPoolTeamsTable.primaryColor, secondaryColor: continentalPoolTeamsTable.secondaryColor,
      balance: careerPoolTeamStateTable.balance,
    }).from(careerPoolTeamStateTable)
      .innerJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, careerPoolTeamStateTable.poolTeamId))
      .where(and(eq(careerPoolTeamStateTable.careerSaveId, cid), isNull(careerPoolTeamStateTable.takenOverAt))).all();
    const ai = pool.map((p) => ({
      kind: "ai" as const, id: p.id, name: p.name, continent: p.continent,
      primaryColor: p.primaryColor, secondaryColor: p.secondaryColor, crestShapeIndex: null,
      balance: Math.round(Number(p.balance)), manager: managers.get(p.id) ?? null, ...line({ poolTeamId: p.id }),
    }));
    return [mine, ...ai];
  });
  res.json({ today, seasonYear: year, clubs: rows });
});

router.get("/clubs/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const poolTeamId = Number(req.params.id);
  const club = db.select({
    id: continentalPoolTeamsTable.id, name: continentalPoolTeamsTable.teamName, continent: continentalPoolTeamsTable.continent,
    primaryColor: continentalPoolTeamsTable.primaryColor, secondaryColor: continentalPoolTeamsTable.secondaryColor,
    balance: careerPoolTeamStateTable.balance, takenOverAt: careerPoolTeamStateTable.takenOverAt,
  }).from(careerPoolTeamStateTable)
    .innerJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, careerPoolTeamStateTable.poolTeamId))
    .where(and(eq(careerPoolTeamStateTable.careerSaveId, cid), eq(careerPoolTeamStateTable.poolTeamId, poolTeamId))).get();
  if (!club || club.takenOverAt != null) { res.status(404).json({ error: "No such AI club in this career" }); return; }

  // Its seniors are career players, scouted and signed through the market like anyone (U-6).
  withCareerStateTx((w) => materializeAiSeniorsTx(w, cid));
  const { today, year, standings } = careerContext(cid);
  const s = standingFor(standings, { poolTeamId });
  const regionalPosition = (await regionalPositions(cid)).get(poolTeamId) ?? null;
  const players = (await loadPlayers(cid, { includeRetired: false })).filter((p) => p.poolTeamId === poolTeamId && p.teamId == null);

  const detail = db.transaction((tx) => {
    // The last 5 World Tour results, with the scores and the other club.
    const comp = tx.select({ id: competitorsTable.id }).from(competitorsTable).where(eq(competitorsTable.poolTeamId, poolTeamId)).get();
    const fixtures = comp ? tx.select().from(worldTourFixturesTable).where(and(
      eq(worldTourFixturesTable.careerSaveId, cid), eq(worldTourFixturesTable.status, "completed"),
      or(eq(worldTourFixturesTable.homeCompetitorId, comp.id), eq(worldTourFixturesTable.awayCompetitorId, comp.id)),
    )).orderBy(desc(worldTourFixturesTable.seasonYear), desc(worldTourFixturesTable.round)).limit(5).all() : [];
    const otherIds = fixtures.map((f) => (f.homeCompetitorId === comp!.id ? f.awayCompetitorId : f.homeCompetitorId));
    const others = otherIds.length ? tx.select({
      id: competitorsTable.id, teamName: teamsTable.name, poolName: continentalPoolTeamsTable.teamName,
    }).from(competitorsTable)
      .leftJoin(teamsTable, eq(teamsTable.id, competitorsTable.teamId))
      .leftJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, competitorsTable.poolTeamId))
      .where(inArray(competitorsTable.id, otherIds)).all() : [];
    const nameOf = new Map(others.map((o) => [o.id, o.teamName ?? o.poolName ?? "?"]));
    const lastFive = fixtures.map((f) => {
      const home = f.homeCompetitorId === comp!.id;
      const mineSets = home ? f.homeSets : f.awaySets, theirSets = home ? f.awaySets : f.homeSets;
      return { seasonYear: f.seasonYear, round: f.round, tier: f.tier, opponent: nameOf.get(home ? f.awayCompetitorId : f.homeCompetitorId) ?? "?",
        won: (mineSets ?? 0) > (theirSets ?? 0), score: `${mineSets ?? 0}-${theirSets ?? 0}` };
    });
    const staff = loadStaffTx(tx, cid, { poolTeamId }).map((m) => ({
      id: m.id, name: m.name, role: m.role, imageUrl: m.imageUrl, skill: m.skillLevel, wage: Math.round(Number(m.salary)),
      contractEndDate: m.contractEndDate ?? null,
    }));
    return { lastFive, staff, wages: wageCapView(seniorWageBillTx(tx, cid, { poolTeamId })) };
  });

  const watched = db.transaction((tx) => watchedTx(tx, cid));
  const playerRow = (p: PlayerDTO) => {
    const youth = isYouthPlayer(p);
    // The Player Market's rule: unscouted, her rating and attributes are hidden ("?").
    const revealed = isRevealed(p, team.id, today);
    return {
      id: p.id, name: p.name, imageUrl: p.imageUrl, nationality: p.nationality, continent: p.continent, age: p.age,
      youth, role: youth ? (p.academyRole ?? "youth_team") : (p.onInjuredList ? "injured" : p.squadRole ?? "starter"),
      rating: revealed ? (youth ? youthRating(p) : overallRating(p)) : null, revealed,
      scouting: scoutState(p, today),
      // A youth's wage is her academy wage a week; a senior's is a month.
      wage: youth ? academyWeeklyWage(p.potential) : Math.round(Number(p.salary)), wagePer: youth ? "week" : "month",
      contractEndDate: youth ? null : (p.contractEndDate ?? null),
      // 1.1.1, Part 10: the Watch List's star (seniors carry it on their market card).
      watched: watched.has(p.id),
      injury: p.isInjured || (p.injuryStatus ?? "Healthy") !== "Healthy"
        ? { name: p.injuryStatus, weeksOut: Math.ceil(Number(p.injuryWeeksRemaining ?? 0)) } : null,
    };
  };

  res.json({
    club: { id: club.id, name: club.name, continent: club.continent, primaryColor: club.primaryColor, secondaryColor: club.secondaryColor,
      balance: Math.round(Number(club.balance)) },
    manager: clubManagersOf(cid).get(poolTeamId) ?? null,
    tier: shownTier(tierForPoints(s?.points ?? 0), db.transaction((tx) => accessTierByPoolIdTx(tx, cid, year)).get(poolTeamId) ?? "Bronze"),
    ladderPosition: s?.rank ?? null, regionalPosition, points: s?.points ?? 0, wins: s?.wins ?? 0, losses: s?.losses ?? 0,
    seasonYear: year,
    lastFive: detail.lastFive,
    wages: detail.wages,
    seniors: players.filter((p) => !isYouthPlayer(p)).map(playerRow).sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1)),
    youths: players.filter((p) => isYouthPlayer(p)).map(playerRow).sort((a, b) => b.age - a.age),
    staff: detail.staff,
  });
});

export default router;
