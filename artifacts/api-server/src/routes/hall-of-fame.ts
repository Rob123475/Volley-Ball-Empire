/**
 * The club's Hall of Fame — who it honours, and who it should.
 *
 * ── Rob's rule (22 Sep, final) ──────────────────────────────────────────────
 * Every two seasons a club may induct up to six players, current or retired,
 * and may induct nobody. Induction is for ever: a player in the Hall of Fame
 * keeps her career record when she retires, and her name and portrait are never
 * given to anyone else (lib/playerDto.ts, L-02b).
 *
 * ── How the recommendation is ordered ───────────────────────────────────────
 * Honours first, then service, then the numbers — in that order, not blended
 * into a score, because a club that remembers an Olympic champion does not
 * weigh her gold against somebody else's ranking points.
 *
 *   1. Olympic golds she won while this career was running (olympic_medals)
 *   2. World Finals the club won while she was under contract to it (trophies)
 *   3. seasons she spent at the club (the season years her contracts cover)
 *   4. ranking points she earned (player_ranking_points, R-46)
 *
 * Every one of those is a row somebody wrote. Nothing here is a rating and
 * nothing is invented: a Hall of Fame built on a made-up "legend score" would
 * be a Hall of Fame of arithmetic.
 *
 * ── Why there is nothing here for AI clubs ──────────────────────────────────
 * The brief asks for AI clubs to induct automatically. They cannot yet: an AI
 * club's players are `continental_pool_players` rows, not `players`, and this
 * table keys on the latter. More to the point, a pool player has no contract
 * with her club and no record of when she joined it, so there is nothing to
 * rank her service by — an automatic induction would be picking a name. When
 * AI squads gain real rosters, this is the function to call for them.
 */
import { Router } from "express";
import {
  db, clubHallOfFameTable, playerRetirementsTable, contractsTable,
  trophiesTable, olympicMedalsTable, playerRankingPointsTable, seasonsTable,
  teamsTable,
} from "@workspace/db";
import { and, eq, asc, desc } from "drizzle-orm";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { loadPlayers, requireCareerSaveId } from "../lib/playerDto.js";
import { careerStatsFor, updateCareerStats, checkAchievements } from "../utils/check-achievements.js";

const router = Router();

/** Rob's rule: the window opens every other season and takes at most six. */
export const INDUCTION_INTERVAL_SEASONS = 2;
export const MAX_INDUCTIONS_PER_WINDOW = 6;

type Candidate = {
  playerId: number;
  name: string;
  nationality: string | null;
  imageUrl: string | null;
  retired: boolean;
  olympicGolds: number;
  worldTitles: number;
  seasonsAtClub: number;
  rankingPoints: number;
  inducted: boolean;
  seasonInducted: number | null;
};

/**
 * Whether the induction window is open.
 *
 * Counted in seasons completed rather than years: a season is 418-421 days
 * (R-35), and a career has no fixed length (L-01). A window is used up by an
 * induction, so a club that inducts in its second season waits until its
 * fourth; a club that skips can still induct later in the same window.
 */
export function inductionWindow(
  seasonsCompleted: number,
  inducted: readonly number[],
): { open: boolean; windowIndex: number; seasonsUntilNext: number } {
  const windowIndex = Math.floor(seasonsCompleted / INDUCTION_INTERVAL_SEASONS);
  const used = inducted.some((s) => Math.floor(s / INDUCTION_INTERVAL_SEASONS) === windowIndex);
  const open = seasonsCompleted >= INDUCTION_INTERVAL_SEASONS && !used;
  const nextAt = (windowIndex + 1) * INDUCTION_INTERVAL_SEASONS;
  return { open, windowIndex, seasonsUntilNext: Math.max(0, nextAt - seasonsCompleted) };
}

/** Everyone this club could honour, ranked as the brief orders it. */
async function candidatesFor(careerSaveId: number, teamId: number): Promise<Candidate[]> {
  const [squad, deals, honours, golds, points, retirees, alreadyIn] = await Promise.all([
    loadPlayers(careerSaveId, { teamId }),
    db.select().from(contractsTable).where(eq(contractsTable.teamId, teamId)),
    db.select().from(trophiesTable).where(eq(trophiesTable.teamId, teamId)),
    db.select().from(olympicMedalsTable).where(and(
      eq(olympicMedalsTable.careerSaveId, careerSaveId),
      eq(olympicMedalsTable.medal, "gold"),
    )),
    db.select().from(playerRankingPointsTable)
      .where(eq(playerRankingPointsTable.careerSaveId, careerSaveId)),
    db.select().from(playerRetirementsTable)
      .where(eq(playerRetirementsTable.careerSaveId, careerSaveId)),
    db.select().from(clubHallOfFameTable).where(and(
      eq(clubHallOfFameTable.careerSaveId, careerSaveId),
      eq(clubHallOfFameTable.teamId, teamId),
    )),
  ]);

  const seasons = await db.select().from(seasonsTable)
    .where(eq(seasonsTable.careerSaveId, careerSaveId))
    .orderBy(asc(seasonsTable.startDate));

  /** The season years a contract covers, so "seasons at the club" is a count of real seasons. */
  const yearsOf = (playerId: number): number[] => {
    const mine = deals.filter((d) => d.playerId === playerId);
    return seasons
      .filter((s) => mine.some((d) => d.startDate <= s.endDate && d.endDate >= s.startDate))
      .map((s) => s.year);
  };

  const titleYears = new Set(
    honours.filter((t) => t.type === "world_championship" && t.year != null).map((t) => t.year as number),
  );
  const goldsFor = (playerId: number) => golds.filter((g) => g.playerId === playerId).length;
  const pointsFor = (playerId: number) =>
    points.filter((p) => p.playerId === playerId).reduce((a, p) => a + p.rankingPoints, 0);
  const inductedById = new Map(alreadyIn.map((r) => [r.playerId, r.seasonInducted]));

  const rows: Candidate[] = [];
  const seen = new Set<number>();

  for (const p of squad) {
    seen.add(p.id);
    const years = yearsOf(p.id);
    rows.push({
      playerId: p.id, name: p.name, nationality: p.nationality, imageUrl: p.imageUrl,
      retired: false,
      olympicGolds: goldsFor(p.id),
      worldTitles: years.filter((y) => titleYears.has(y)).length,
      seasonsAtClub: years.length,
      rankingPoints: pointsFor(p.id),
      inducted: inductedById.has(p.id),
      seasonInducted: inductedById.get(p.id) ?? null,
    });
  }

  // Retirees of this club, including the ones whose career record was deleted
  // (L-02b) — `player_retirements` is what the career keeps of them.
  for (const r of retirees) {
    if (seen.has(r.playerId) || r.lastTeamId !== teamId) continue;
    seen.add(r.playerId);
    const years = yearsOf(r.playerId);
    rows.push({
      playerId: r.playerId, name: r.name, nationality: r.nationality, imageUrl: r.imageUrl,
      retired: true,
      olympicGolds: goldsFor(r.playerId),
      worldTitles: years.filter((y) => titleYears.has(y)).length,
      seasonsAtClub: years.length,
      rankingPoints: pointsFor(r.playerId),
      inducted: inductedById.has(r.playerId),
      seasonInducted: inductedById.get(r.playerId) ?? null,
    });
  }

  // Honours, then service, then the numbers — each only breaking the tie above.
  rows.sort((a, b) =>
    b.olympicGolds - a.olympicGolds ||
    b.worldTitles - a.worldTitles ||
    b.seasonsAtClub - a.seasonsAtClub ||
    b.rankingPoints - a.rankingPoints ||
    a.name.localeCompare(b.name));

  return rows;
}

router.get("/hall-of-fame", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const careerSaveId = requireCareerSaveId(req.activeCareerSaveId);

  const inducted = await db.select().from(clubHallOfFameTable).where(and(
    eq(clubHallOfFameTable.careerSaveId, careerSaveId),
    eq(clubHallOfFameTable.teamId, team.id),
  )).orderBy(desc(clubHallOfFameTable.seasonInducted));

  const stats = await careerStatsFor(team.id);
  const window = inductionWindow(stats.seasonsCompleted, inducted.map((r) => r.seasonInducted));
  const candidates = await candidatesFor(careerSaveId, team.id);

  res.json({
    clubName: team.name,
    seasonsCompleted: stats.seasonsCompleted,
    window: {
      open: window.open,
      seasonsUntilNext: window.seasonsUntilNext,
      maxThisWindow: MAX_INDUCTIONS_PER_WINDOW,
      everySeasons: INDUCTION_INTERVAL_SEASONS,
    },
    inducted: inducted.map((r) => ({
      playerId: r.playerId, name: r.playerName, seasonInducted: r.seasonInducted,
    })),
    // The ones the club is being asked about, and then everybody else it could
    // honour — the brief asks for both lists, not just the recommendation.
    recommendations: candidates.filter((c) => !c.inducted).slice(0, MAX_INDUCTIONS_PER_WINDOW),
    eligible: candidates.filter((c) => !c.inducted),
  });
});

router.post("/hall-of-fame/induct", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const careerSaveId = requireCareerSaveId(req.activeCareerSaveId);

  const sent = Array.isArray(req.body?.playerIds) ? req.body.playerIds.map(Number) : null;
  if (!sent || sent.some((n: number) => !Number.isInteger(n))) {
    res.status(400).json({ error: "playerIds must be a list of player ids." });
    return;
  }
  // The same player twice is one induction, not two. The honour board has a
  // unique index on (career, club, player), so a repeated id would have been a
  // constraint violation and a 500 rather than a 201 — and a player cannot be
  // honoured twice by the same club anyway.
  const ids = [...new Set<number>(sent)];
  if (ids.length > MAX_INDUCTIONS_PER_WINDOW) {
    res.status(422).json({
      error: `A club may induct ${MAX_INDUCTIONS_PER_WINDOW} players in a window; you chose ${ids.length}.`,
    });
    return;
  }

  const inducted = await db.select().from(clubHallOfFameTable).where(and(
    eq(clubHallOfFameTable.careerSaveId, careerSaveId),
    eq(clubHallOfFameTable.teamId, team.id),
  ));
  const stats = await careerStatsFor(team.id);
  const window = inductionWindow(stats.seasonsCompleted, inducted.map((r) => r.seasonInducted));
  if (!window.open) {
    res.status(409).json({
      error: window.seasonsUntilNext > 0
        ? `The Hall of Fame opens every ${INDUCTION_INTERVAL_SEASONS} seasons — ${window.seasonsUntilNext} to go.`
        : "This club has already inducted in this window.",
    });
    return;
  }

  // Skipping is a choice the manager is allowed to make, and it costs the
  // window: an empty induction is recorded as nothing at all.
  if (ids.length === 0) { res.json({ inducted: [], skipped: true }); return; }

  const candidates = await candidatesFor(careerSaveId, team.id);
  const byId = new Map(candidates.map((c) => [c.playerId, c]));
  const unknown = ids.filter((id: number) => !byId.has(id) || byId.get(id)!.inducted);
  if (unknown.length > 0) {
    res.status(422).json({
      error: "One of those players is not eligible, or is already in the Hall of Fame.",
    });
    return;
  }

  const season = stats.seasonsCompleted;
  await db.insert(clubHallOfFameTable).values(ids.map((id: number) => ({
    careerSaveId, teamId: team.id, playerId: id,
    playerName: byId.get(id)!.name, seasonInducted: season,
  })));

  // ACH: the club's first inductee is an achievement (first_inductee).
  try {
    await updateCareerStats(team.id, (s) => ({
      ...s, hallOfFameInductions: (s.hallOfFameInductions ?? 0) + ids.length,
    }));
    await checkAchievements(team.id);
  } catch (err) {
    req.log.error({ err }, "hall of fame achievement counters failed");
  }

  res.status(201).json({
    inducted: ids.map((id: number) => ({ playerId: id, name: byId.get(id)!.name, seasonInducted: season })),
    skipped: false,
  });
});

export default router;
