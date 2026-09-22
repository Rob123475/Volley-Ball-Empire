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
  db, careerSavesTable, teamsTable, competitorsTable, continentalPoolTeamsTable,
  careerPoolTeamStateTable, locationsTable, seasonsTable, achievementsTable,
  worldTourQualificationsTable, CONTINENT_LABEL, continentKeyForNationality,
  type ContinentKey,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { seedStartingSquad, oneSeasonContract } from "../utils/seedStartingSquad.js";
import { ensureSeasonFixtureRows } from "../utils/seasonFixture.js";
import { ensureBoardSeason } from "../utils/board-confidence.js";
import { startingBudgetFor } from "../utils/careerDifficulty.js";
import { endCareer } from "../utils/careerLifecycle.js";
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

/**
 * Clubs of the world with a vacancy.
 *
 * A vacancy is a club this career's World Tour field does not hold. There are
 * sixty clubs and the field is nineteen — eighteen qualifiers and the player's
 * own — so the other clubs are the ones a manager can go to without any club
 * being in the world twice. They are real: their names, continents and ratings
 * are the rows the rest of the game plays against.
 *
 * Offered strongest first. There is no AI-manager model in this game, so
 * nothing is competing with the player for the job; a shortlist that pretended
 * otherwise would be the invented news R-43 deleted.
 */
async function vacanciesFor(careerSaveId: number) {
  const seasons = await db.select({ year: seasonsTable.year }).from(seasonsTable)
    .where(eq(seasonsTable.careerSaveId, careerSaveId))
    .orderBy(desc(seasonsTable.year)).limit(1);
  const latest = seasons[0]?.year ?? null;

  const inField = latest == null ? [] : (await db
    .select({ poolTeamId: worldTourQualificationsTable.poolTeamId })
    .from(worldTourQualificationsTable)
    .where(eq(worldTourQualificationsTable.careerSaveId, careerSaveId)))
    .map((r) => r.poolTeamId);

  // A club the manager has already taken over is never offered again. Without
  // this, a second sale sells the club and then lists it among the jobs going:
  // the vacancies are the highest-rated clubs outside the field, and the club
  // just lost is exactly that. `is_active_in_league` cannot answer this — a
  // club leaves and re-enters the regional league by relegation and promotion.
  const takenOver = new Set(
    (await db.select({ poolTeamId: careerPoolTeamStateTable.poolTeamId })
      .from(careerPoolTeamStateTable)
      .where(and(
        eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
        isNotNull(careerPoolTeamStateTable.takenOverAt),
      ))).map((r) => r.poolTeamId),
  );

  const inLeague = new Set(
    (await db.select({ poolTeamId: careerPoolTeamStateTable.poolTeamId })
      .from(careerPoolTeamStateTable)
      .where(and(
        eq(careerPoolTeamStateTable.careerSaveId, careerSaveId),
        eq(careerPoolTeamStateTable.isActiveInLeague, true),
      ))).map((r) => r.poolTeamId),
  );

  const clubs = await db.select().from(continentalPoolTeamsTable)
    .orderBy(desc(continentalPoolTeamsTable.rating));

  return clubs
    .filter((c) => !inField.includes(c.id) && !takenOver.has(c.id))
    .slice(0, VACANCIES_OFFERED)
    .map((c) => ({
      poolTeamId: c.id,
      name: c.teamName,
      continent: c.continent,
      continentName: CONTINENT_LABEL[c.continent as ContinentKey] ?? c.continent,
      rating: c.rating,
      inRegionalLeague: inLeague.has(c.id),
    }));
}

router.get("/job-market", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const save = await seekingCareer(req as never);
  if (!save) { res.status(404).json({ error: "No career" }); return; }

  res.json({
    seeking: save.seekingClubSince != null && save.teamId == null,
    managerName: save.managerName,
    formerClub: save.clubName,
    vacancies: save.seekingClubSince != null && save.teamId == null
      ? await vacanciesFor(save.id)
      : [],
  });
});

router.post("/job-market/accept", async (req, res) => {
  if (!req.isAuthenticated() || !req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const save = await seekingCareer(req as never);
  if (!save) { res.status(404).json({ error: "No career" }); return; }
  if (save.teamId != null || save.seekingClubSince == null) {
    res.status(409).json({ error: "You already have a club." });
    return;
  }

  const poolTeamId = Number(req.body?.poolTeamId);
  const offered = await vacanciesFor(save.id);
  const pick = offered.find((v) => v.poolTeamId === poolTeamId);
  if (!pick) { res.status(422).json({ error: "That club is not one of the vacancies on offer." }); return; }

  const [pool] = await db.select().from(continentalPoolTeamsTable)
    .where(eq(continentalPoolTeamsTable.id, poolTeamId)).limit(1);
  if (!pool) { res.status(404).json({ error: "No such club" }); return; }

  // A home for it. The game ships eleven locations, and the club takes the
  // first one on its OWN continent — Tokyo Surf Samurai playing out of
  // Copacabana Beach is the kind of thing a player notices immediately. Six
  // continents, eleven beaches: every continent the pool clubs come from has
  // one, and the first location is the fallback for any that does not.
  const locations = await db.select().from(locationsTable).orderBy(asc(locationsTable.id));
  const home =
    locations.find((l) => continentKeyForNationality(l.country) === pool.continent)
    ?? locations[0];

  // A club that has just changed hands is not a rich one: the underdog budget
  // is the game's own number for a club starting with nothing to spare.
  const budget = startingBudgetFor("underdog");

  const [newTeam] = await db.insert(teamsTable).values({
    userId: req.user.id,
    name: pool.teamName,
    budget,
    reputation: 50,
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
    .set({ isActiveInLeague: false, takenOverAt: new Date() })
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
    await seedStartingSquad(save.id, newTeam!.id, oneSeasonContract(season), "underdog");
  }

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

  res.status(201).json({
    teamId: newTeam!.id,
    clubName: pool.teamName,
    budget,
    continent: pool.continent,
  });
});

router.post("/job-market/retire", async (req, res) => {
  if (!req.isAuthenticated() || !req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const save = await seekingCareer(req as never);
  if (!save) { res.status(404).json({ error: "No career" }); return; }
  if (save.seekingClubSince == null) {
    res.status(409).json({ error: "You are not looking for a club." });
    return;
  }

  // Declining every vacancy is retirement, and retirement ends a career the
  // way every other ending does: archived to the Hall of Fame, with a history
  // entry in the game's own words, so the career-end screen can say what
  // happened. It is built from the club the manager last had — there is no
  // current one — and the save is named explicitly, because a career between
  // clubs cannot be found by its club.
  //
  // Without this the save was simply stamped retired: no archive, no history,
  // and a career-end screen that fell back to its default and told a manager
  // who had CHOSEN to stop that they had been sacked.
  const summary = save.formerTeamId
    ? await endCareer(req as never, save.formerTeamId, req.user.id, {
        type: "retirement",
        careerSaveId: save.id,
        description: (sum) =>
          `${sum.managerName} retired rather than take another club after ` +
          `${save.clubName} was sold.`,
      })
    : null;

  if (!summary) {
    await db.update(careerSavesTable)
      .set({ retiredAt: new Date(), seekingClubSince: null, formerTeamId: null })
      .where(eq(careerSavesTable.id, save.id));
  }

  res.json({ retired: true, managerName: save.managerName, formerClub: save.clubName });
});

export default router;
