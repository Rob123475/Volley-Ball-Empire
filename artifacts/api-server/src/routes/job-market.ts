/**
 * L-02e — the job market: what a manager does when the club is sold.
 *
 * ── Rob's rule (22 Sep, final) ──────────────────────────────────────────────
 * Five consecutive loss-making seasons and the club is sold. For the manager's
 * own club that means losing the job: they are shown real clubs with vacancies
 * and may take one, keeping everything that is theirs — seasons completed,
 * achievements, reputation. Declining them all is retirement, and the career
 * ends. "Keep it minimal but real — no fake news, no fake clubs."
 *
 * ── What a vacancy is ───────────────────────────────────────────────────────
 * A club of the world that this career's World Tour field does not already
 * contain. There are sixty of them (`continental_pool_teams`) with real names,
 * real continents and real ratings, and eighteen are in the field beside the
 * player's own club — so a vacancy is one of the other forty-two. Taking one
 * puts it in the field in place of the club that was sold, and the field stays
 * nineteen with nobody in it twice.
 *
 * There is no AI-manager model in this game, so no club is "managed" by anyone
 * and none of them is competing with the player for the job. That is stated
 * rather than dressed up: an offer that pretended to be in competition would
 * be exactly the invented news R-43 deleted.
 *
 * ── What the manager brings, and what they leave ────────────────────────────
 * Brought: the career — seasons completed, achievements, reputation, the
 * career's history and its whole world of athletes. ACH moved the manager's
 * record onto the career save for this exact reason.
 *
 * Left behind: everything that was the CLUB's. The squad, the academy, the
 * staff, the trophies and the balance belonged to the club that was sold. The
 * new club starts as a new club does — a starting budget and a squad signed
 * from the free agents (R-04) — because that is what a manager taking over a
 * club with nothing actually faces.
 */
import { Router } from "express";
import {
  db, careerSavesTable, teamsTable, competitorsTable, continentalPoolTeamsTable, contractsTable, boardSeasonsTable,
  careerPoolTeamStateTable, locationsTable, seasonsTable, achievementsTable,
  worldTourQualificationsTable, CONTINENT_LABEL, continentKeyForNationality, managerLevelFor, careerHistoryEntriesTable,
  type ContinentKey,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { seedStartingSquad, oneSeasonContract } from "../utils/seedStartingSquad.js";
import { ensureSeasonFixtureRows } from "../utils/seasonFixture.js";
import { ensureBoardSeason } from "../utils/board-confidence.js";
import { startingBudgetFor } from "../utils/careerDifficulty.js";
import { endCareer, loseClub } from "../utils/careerLifecycle.js";
import { ensureAiManagersTx, vacanciesTx, decideApplication } from "../utils/aiManagers.js";
import { LEAVE_MID_SEASON, activeSeasonYearOf, seasonOverFor, boardVerdict, offersTx, destinationTx, swapOutOfFieldTx, repPointsOf } from "../utils/managerMoves.js";
import { aiSquadsTx } from "../utils/aiSquads.js";
import { academyAtTx } from "../utils/youthLoans.js";
import { worldTourFieldTx } from "../utils/worldTour.js";
import { withCareerStateTx, loadPlayers, updatePlayerState } from "../lib/playerDto.js";
import { overallRating } from "../utils/overallRating.js";
import { updateCareerStats, checkAchievements } from "../utils/check-achievements.js";
import { getSessionId, getSession, updateSession } from "../lib/auth.js";

const router = Router();

/** How many vacancies a manager is shown. Enough to choose from, few enough to read. */
export const VACANCIES_OFFERED = 6;

/**
 * The career this request belongs to, whether or not it currently has a club.
 *
 * The session's own answer first: `activeCareerSaveId` survives a club being
 * sold (only the team is cleared), and the middleware restores it for a fresh
 * session too. The newest unfinished career is the fallback, for a session
 * that has neither — a career is only ambiguous when the player has more than
 * one, and the one they last loaded is the one they mean.
 */
async function seekingCareer(
  req: Parameters<typeof getSessionId>[0] & {
    user?: { id: string };
    activeCareerSaveId?: number;
  },
) {
  if (!req.user?.id) return null;

  if (req.activeCareerSaveId) {
    const [byId] = await db.select().from(careerSavesTable).where(and(
      eq(careerSavesTable.id, req.activeCareerSaveId),
      eq(careerSavesTable.userId, req.user.id),
      isNull(careerSavesTable.retiredAt),
    )).limit(1);
    if (byId) return byId;
  }

  const [save] = await db.select().from(careerSavesTable).where(and(
    eq(careerSavesTable.userId, req.user.id),
    isNull(careerSavesTable.retiredAt),
  )).orderBy(desc(careerSavesTable.lastPlayedAt)).limit(1);
  return save ?? null;
}

/** The season the career is in (a career between clubs still has one). */
async function activeSeasonYear(careerSaveId: number): Promise<number | null> {
  const [season] = await db.select({ year: seasonsTable.year }).from(seasonsTable)
    .where(and(eq(seasonsTable.careerSaveId, careerSaveId), eq(seasonsTable.status, "active")))
    .orderBy(desc(seasonsTable.year)).limit(1);
  return season?.year ?? null;
}

/**
 * Daytime 2 Oct, U-3 (try): the vacancies are REAL. A vacancy is an AI club
 * whose manager its board sacked (utils/aiManagers.ts: two failed seasons
 * running, by the player's board's own bands) and that has not appointed
 * another. The old rule (any club outside the World Tour field) is gone: every
 * AI club has a manager now, so a job is open only where one has lost it.
 *
 * A club in THIS season's World Tour field cannot change hands mid-season (its
 * World Tour seat and fixtures are shared by the world), so it is listed,
 * marked, and can be taken once its season is over; the rest can be taken now.
 */
async function vacanciesFor(careerSaveId: number) {
  const year = await activeSeasonYear(careerSaveId);
  if (year == null) return [];
  return db.transaction((tx) => {
    ensureAiManagersTx(tx, careerSaveId, year);
    const inField = new Set(worldTourFieldTx(tx, careerSaveId, year).map((f) => f.poolTeamId));
    return vacanciesTx(tx, careerSaveId, year).map((v) => ({ ...v, inWorldTourNow: inField.has(v.poolTeamId) }));
  });
}

/** The manager's level: the one measure (manager_rep_points of his club, now or last). */
async function managerLevelOf(save: typeof careerSavesTable.$inferSelect) {
  const teamId = save.teamId ?? save.formerTeamId;
  const [team] = teamId == null ? [] : await db.select({ p: teamsTable.managerRepPoints }).from(teamsTable).where(eq(teamsTable.id, teamId));
  return { ...managerLevelFor(team?.p ?? 0), points: team?.p ?? 0 };
}

router.get("/job-market", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const save = await seekingCareer(req as never);
  if (!save) { res.status(404).json({ error: "No career" }); return; }
  const w = await windowOf(save);
  const level = await managerLevelOf(save);
  const vacancies = (await vacanciesFor(save.id)).map((v) => { const d = decideApplication(v, save.managerName, level); return { ...v, accepted: d.accepted, answer: d.reason }; });
  const offers = w.open && w.year != null
    ? db.transaction((tx) => offersTx(tx, save.id, w.year!, save.managerName, level.points, w.seasonFailed, declinedOf(save)))
    : [];
  const [pending] = save.pendingPoolTeamId == null ? [] : await db.select({ name: continentalPoolTeamsTable.teamName }).from(continentalPoolTeamsTable).where(eq(continentalPoolTeamsTable.id, save.pendingPoolTeamId));
  res.json({
    employed: save.teamId != null,
    // Afternoon 2 Oct (J-3): moves happen only once the club's season is over.
    window: w.open,
    windowText: w.open ? "Your season is over: the off-season window is open until the next season starts. Moves take effect then." : LEAVE_MID_SEASON,
    seeking: false,
    managerName: save.managerName,
    formerClub: save.clubName,
    managerLevel: level.level,
    managerLevelName: level.name,
    verdict: w.verdict,
    leaving: save.leavingReason,
    pending: save.pendingPoolTeamId == null ? null : { poolTeamId: save.pendingPoolTeamId, name: pending?.name ?? "" },
    offers,
    vacancies,
  });
});

/** The off-season window for this career, and what the board has said. */
async function windowOf(save: typeof careerSavesTable.$inferSelect) {
  const year = await activeSeasonYearOf(save.id);
  const open = save.teamId != null && year != null && await seasonOverFor(save.teamId, year);
  const verdict = open ? await boardVerdict(save.id, year!, save.teamId!) : null;
  const [row] = year == null || save.teamId == null ? [] : await db.select({ g: boardSeasonsTable.grade, p: boardSeasonsTable.projectedGrade }).from(boardSeasonsTable)
    .where(and(eq(boardSeasonsTable.careerSaveId, save.id), eq(boardSeasonsTable.seasonYear, year), eq(boardSeasonsTable.teamId, save.teamId)));
  return { open, year, verdict, seasonFailed: (row?.g ?? row?.p) === "failed" };
}
const declinedOf = (save: typeof careerSavesTable.$inferSelect): number[] => { try { return JSON.parse(save.declinedOffers ?? "[]"); } catch { return []; } };

// Apply for a vacancy, in the window. Accepted, the move is agreed and takes
// effect at the start of next season.
router.post("/job-market/apply", async (req, res) => {
  if (!req.isAuthenticated() || !req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const save = await seekingCareer(req as never);
  if (!save) { res.status(404).json({ error: "No career" }); return; }
  const w = await windowOf(save);
  if (!w.open) { res.status(409).json({ error: LEAVE_MID_SEASON }); return; }
  const v = (await vacanciesFor(save.id)).find((x) => x.poolTeamId === Number(req.body?.poolTeamId));
  if (!v) { res.status(422).json({ error: "That club has no vacancy." }); return; }
  const answer = decideApplication(v, save.managerName, await managerLevelOf(save));
  if (answer.accepted) await db.update(careerSavesTable).set({ pendingPoolTeamId: v.poolTeamId }).where(eq(careerSavesTable.id, save.id));
  res.json({ ...answer, takesEffect: answer.accepted ? "at the start of next season" : null });
});

// An AI club's offer (poaching), accepted or declined, in the window.
router.post("/job-market/offers/:poolTeamId/:answer", async (req, res) => {
  if (!req.isAuthenticated() || !req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const save = await seekingCareer(req as never);
  if (!save) { res.status(404).json({ error: "No career" }); return; }
  const w = await windowOf(save);
  if (!w.open || w.year == null) { res.status(409).json({ error: LEAVE_MID_SEASON }); return; }
  const id = Number(req.params.poolTeamId);
  const level = await managerLevelOf(save);
  const offer = db.transaction((tx) => offersTx(tx, save.id, w.year!, save.managerName, level.points, w.seasonFailed, declinedOf(save))).find((o) => o.poolTeamId === id);
  if (!offer) { res.status(422).json({ error: "No such offer." }); return; }
  if (req.params.answer === "accept") {
    await db.update(careerSavesTable).set({ pendingPoolTeamId: id }).where(eq(careerSavesTable.id, save.id));
    res.json({ accepted: true, club: offer.name, takesEffect: "at the start of next season" });
  } else {
    await db.update(careerSavesTable).set({ declinedOffers: JSON.stringify([...declinedOf(save), id]), ...(save.pendingPoolTeamId === id ? { pendingPoolTeamId: null } : {}) }).where(eq(careerSavesTable.id, save.id));
    res.json({ declined: true, club: offer.name });
  }
});

// Retire: in the window, or when he is leaving or has been told he is sacked.
router.post("/job-market/retire", async (req, res) => {
  if (!req.isAuthenticated() || !req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const save = await seekingCareer(req as never);
  if (!save) { res.status(404).json({ error: "No career" }); return; }
  const teamId = save.teamId ?? save.formerTeamId;
  const w = await windowOf(save);
  if (!w.open && save.seekingClubSince == null) { res.status(409).json({ error: "You can retire once your season is over." }); return; }
  if (teamId == null) { res.status(409).json({ error: "No club to retire from." }); return; }
  await endCareer(req as never, teamId, req.user.id, {
    type: "retirement", careerSaveId: save.id,
    description: (sum) => save.seekingClubSince != null
      ? `${sum.managerName} retired rather than take another club after ${save.clubName} was sold.`
      : `${sum.managerName} retired at the end of the season with ${save.clubName}.`,
  });
  res.json({ retired: true, managerName: save.managerName, formerClub: save.clubName });
});

/**
 * Afternoon 2 Oct (J-3, J-4): the season has rolled over; any move happens
 * now. Run by the calendar right after the rollover commits. Returns what
 * happened, or null when he stays.
 */
export async function executeSeasonStartMove(req: any, team: { id: number; name: string }, flags: { sold: boolean; sacked: boolean; reviewText: string }) {
  const [save] = await db.select().from(careerSavesTable).where(eq(careerSavesTable.teamId, team.id));
  if (!save) return null;
  const mustGo = flags.sold || flags.sacked || save.leavingReason != null;
  const year = await activeSeasonYearOf(save.id);
  if (year == null) return null;
  const repPoints = await repPointsOf(team.id);
  const dest = db.transaction((tx) => destinationTx(tx, save.id, year, save.managerName, repPoints, save.pendingPoolTeamId, mustGo));
  if (!dest) {
    await db.update(careerSavesTable).set({ declinedOffers: null }).where(eq(careerSavesTable.id, save.id));
    return null;
  }
  const type = flags.sacked ? "dismissal" : flags.sold ? "club_sold" : save.leavingReason ?? "resignation";
  const words: Record<string, string> = {
    dismissal: `${save.managerName} was sacked by ${team.name}: a second failed season running.`,
    resignation: `${save.managerName} left ${team.name} at the end of the season.`,
    contract_break: `${save.managerName} left ${team.name} at the end of the season, having broken the contract.`,
  };
  await loseClub(req, team.id, flags.sold ? flags.reviewText : { type, text: words[type] ?? words.resignation! });
  const swapped = db.transaction((tx) => swapOutOfFieldTx(tx, save.id, year, dest.poolTeamId));
  const [fresh] = await db.select().from(careerSavesTable).where(eq(careerSavesTable.id, save.id));
  const took = await takeOverClub(req, fresh!, dest.poolTeamId, dest.why, repPoints);
  await db.update(careerSavesTable).set({ pendingPoolTeamId: null, leavingReason: null, declinedOffers: null, seekingClubSince: null }).where(eq(careerSavesTable.id, save.id));
  return { from: team.name, to: took?.clubName ?? null, why: dest.why + (swapped ? ` ${swapped} takes its place in this season's World Tour field.` : ""), type };
}

/**
 * Take over an AI club: a new club of the player's from it, with its players,
 * academy, balance and World Tour seat (the seat of the club he leaves); his
 * record, achievements and level come with him. Afternoon 2 Oct (J-3): only
 * ever at a season's start (executeSeasonStartMove).
 */
async function takeOverClub(req: any, save: typeof careerSavesTable.$inferSelect, poolTeamId: number, note: string | null, repPoints: number) {
  const [pool] = await db.select().from(continentalPoolTeamsTable)
    .where(eq(continentalPoolTeamsTable.id, poolTeamId)).limit(1);
  if (!pool) return null;

  // A home for it. The game ships eleven locations, and the club takes the
  // first one on its OWN continent — Tokyo Surf Samurai playing out of
  // Copacabana Beach is the kind of thing a player notices immediately. Six
  // continents, eleven beaches: every continent the pool clubs come from has
  // one, and the first location is the fallback for any that does not.
  const locations = await db.select().from(locationsTable).orderBy(asc(locationsTable.id));
  const home =
    locations.find((l) => continentKeyForNationality(l.country) === pool.continent)
    ?? locations[0];

  // U-3: the club comes with what it has: its bank balance (and, below, its squad).
  const [aiState] = await db.select().from(careerPoolTeamStateTable).where(and(
    eq(careerPoolTeamStateTable.careerSaveId, save.id), eq(careerPoolTeamStateTable.poolTeamId, poolTeamId)));
  const budget = Math.round(Number(aiState?.balance ?? startingBudgetFor("underdog")));

  const [newTeam] = await db.insert(teamsTable).values({
    userId: req.user.id,
    name: pool.teamName,
    budget,
    reputation: 50,
    // U-3: the manager's standing comes with the manager.
    managerRepPoints: repPoints,
    ...(home ? { locationId: home.id } : {}),
    ...(pool.primaryColor ? { logoColor: pool.primaryColor } : {}),
    ...(pool.secondaryColor ? { secondaryLogoColor: pool.secondaryColor } : {}),
  }).returning();

  // The field keeps its nineteen: the sold club's seat becomes this club's.
  // If the career has no seat (an older save), one is added for it.
  const [seat] = await db.select().from(competitorsTable)
    .where(eq(competitorsTable.teamId, save.formerTeamId ?? -1)).limit(1);
  if (seat) {
    await db.update(competitorsTable).set({ teamId: newTeam!.id }).where(eq(competitorsTable.id, seat.id));
  } else {
    await db.insert(competitorsTable).values({ teamId: newTeam!.id });
  }

  // And the club the manager has taken over stops being one of the world's own:
  // it is out of the regional league, because it is not an AI club any more.
  await db.update(careerPoolTeamStateTable)
    .set({ isActiveInLeague: false, takenOverAt: new Date(), managerName: save.managerName, vacantSince: null })
    .where(and(
      eq(careerPoolTeamStateTable.careerSaveId, save.id),
      eq(careerPoolTeamStateTable.poolTeamId, poolTeamId),
    ));

  await db.update(careerSavesTable).set({
    teamId: newTeam!.id,
    clubName: pool.teamName,
    budget,
    seekingClubSince: null,
    formerTeamId: null,
    lastPlayedAt: new Date(),
  }).where(eq(careerSavesTable.id, save.id));

  // The season the career is now in — the rollover opened it before the
  // manager was detached, which is why it is here to join. The new club gets
  // what any club needs to play one: a fixture, a board opening on its balance,
  // and a squad signed from the free agents (R-04, R-48).
  const [season] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.careerSaveId, save.id), eq(seasonsTable.status, "active")))
    .orderBy(desc(seasonsTable.year)).limit(1);
  if (season) {
    db.transaction((tx) => {
      ensureSeasonFixtureRows(tx, { id: newTeam!.id, name: pool.teamName }, season.year);
    });
    ensureBoardSeason(save.id, season.year, newTeam!.id);
    // U-3: the club's own players come with it (utils/aiSquads.ts); only a
    // club with fewer than two is topped up from the free agents.
    const squad = withCareerStateTx((w) => {
      const mine = (aiSquadsTx(w.tx, save.id).get(poolTeamId) ?? []).filter((m) => m.kind === "player");
      mine.forEach((m, i) => w.setPlayerState(save.id, m.id, {
        teamId: newTeam!.id, poolTeamId: null, squadRole: i < 2 ? "starter" : "interchange", isActive: true,
      }));
      // Its academy comes too: the youths it holds, in the places they had.
      for (const y of academyAtTx(w.tx, save.id, { poolTeamId })) {
        if (y.poolTeamId === poolTeamId) w.setPlayerState(save.id, y.playerId, { teamId: newTeam!.id, poolTeamId: null });
      }
      return mine.length;
    });
    // Their deals carry over to the new club's books: a contract each, on the
    // wage and to the date they were on (without one a player is not "contracted"
    // and the club cannot field her).
    {
      const term = oneSeasonContract(season);
      for (const p of (await loadPlayers(save.id, { teamId: newTeam!.id }))) {
        await db.insert(contractsTable).values({ playerId: p.id, teamId: newTeam!.id, salary: p.salary, startDate: term.startDate, endDate: p.contractEndDate ?? term.endDate, bonusPerWin: 0 });
        if (!p.contractEndDate) await updatePlayerState(save.id, p.id, { contractEndDate: term.endDate });
      }
    }
    if (squad < 2) await seedStartingSquad(save.id, newTeam!.id, oneSeasonContract(season), "underdog");
    else if (squad < 3) {
      // Two on the sand and an interchange, as every club starts: a club that
      // brings only its pair signs the best free agent as its interchange.
      const term = oneSeasonContract(season);
      const [fa] = (await loadPlayers(save.id, { freeAgents: true, playerType: "senior" }))
        .sort((a, b) => overallRating(b) - overallRating(a) || a.id - b.id);
      if (fa) {
        await db.insert(contractsTable).values({ playerId: fa.id, teamId: newTeam!.id, salary: fa.salary, startDate: term.startDate, endDate: term.endDate, bonusPerWin: 0 });
        await updatePlayerState(save.id, fa.id, { teamId: newTeam!.id, salary: fa.salary, contractEndDate: term.endDate, squadRole: "interchange", isActive: true });
      }
    }
  }
  await db.insert(careerHistoryEntriesTable).values({
    userId: req.user.id, careerSaveId: save.id, type: "joined_club", clubName: pool.teamName, season: save.season,
    description: `${save.managerName} took over ${pool.teamName}${note ? ` (${note})` : ""}.`,
  });

  const sid = getSessionId(req as never);
  if (sid) {
    const session = await getSession(sid);
    if (session) await updateSession(sid, { ...session, activeTeamId: newTeam!.id, activeCareerSaveId: save.id });
  }

  // ACH, L-02e: the manager's thirty achievements are the MANAGER's, and
  // they are stored against a team id. Taking over a new club leaves them
  // behind with the sold one unless they are moved: the cabinet reads empty,
  // the career-end screen counts nought, and `checkAchievements` below — a
  // team with nothing unlocked - pops every achievement the manager already
  // holds a second time. The rows come with the manager. Trophies do not:
  // they were won by the club that was sold and they stay with it.
  if (save.formerTeamId != null) {
    await db.update(achievementsTable)
      .set({ teamId: newTeam!.id })
      .where(eq(achievementsTable.teamId, save.formerTeamId));
  }

  // ACH: `sold_on` — lost a club to a sale, took another, still managing.
  try {
    await updateCareerStats(newTeam!.id, (s) => ({
      ...s, clubsSoldFromUnder: (s.clubsSoldFromUnder ?? 0) + 1,
    }));
    await checkAchievements(newTeam!.id);
  } catch (err) {
    req.log.error({ err }, "job market achievement counters failed");
  }

  return { teamId: newTeam!.id, clubName: pool.teamName, budget, continent: pool.continent };
}

export default router;
