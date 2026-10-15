/**
 * Probe endpoints the harness needs, and nothing else.
 *
 * Mounted only when NODE_ENV !== "production" (routes/index.ts), so none of
 * this exists in a shipped desktop build — electron/main.js forks the server
 * with NODE_ENV=production.
 *
 * ── R-80 gate 4: what used to be here, and why it went ──────────────────────
 * This file was 690 lines and seven routes. Five of them are deleted:
 *
 *   /dev/generate-test                     its ONLY caller was the frontend
 *                                          page pages/dev-generation-test.tsx,
 *                                          deleted in the same commit. The
 *                                          page was still routed in the
 *                                          production bundle with this dead
 *                                          API behind it (R-10 audit finding
 *                                          9): in a shipped build the route
 *                                          resolved, the page rendered, and
 *                                          every button 404'd.
 *   /dev/migrate-season-78                 no caller anywhere in the repo, and
 *                                          destructive — it deleted every
 *                                          scheduled match for the active
 *                                          season. The still-live thing of
 *                                          that name is the separate CLI
 *                                          script scripts/src/migrate-season-78.ts,
 *                                          which is untouched.
 *   /dev/ensure-continental-pool-extension no caller anywhere in the repo.
 *   /dev/fix-youth-data                    no caller anywhere in the repo.
 *   /dev/ensure-global-youth-pool          no caller anywhere in the repo.
 *
 * With them went the two name pools, the nationality pools, the weather
 * helper, rand/pick, and the drizzle/schema/staff-generator imports that only
 * they used. What is left is the two routes the harness actually calls, and
 * they read and write nothing.
 */
import { Router } from "express";
import { rollInjuryType, treatmentFactor, startInjuryTx } from "../utils/injuries.js";
import { injuryInfo } from "@workspace/db";
import { loadPlayer, requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { getGameDate } from "../utils/gameDate.js";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { checkAchievements } from "../utils/check-achievements.js";
import {
  boardReviewTable, boardProjection,
  type BoardTableCareer, type BoardProjectionInput,
} from "../utils/board-confidence.js";
import { pairSideRating } from "../utils/condition.js";
import { pointProbability, simulateMatch, type RatedPlayer } from "../utils/matchEngine.js";

const router = Router();

/**
 * R-53: the board's rules over fixed inputs, through the same functions the
 * rollover and the monthly check call. harness/board-review.mjs asserts every
 * row of docs/r53-design.md §5 with it. Reads and writes nothing.
 */
router.post("/dev/board/review-table", (req, res) => {
  const body = req.body as { careers?: BoardTableCareer[]; projections?: BoardProjectionInput[] };
  if (!Array.isArray(body?.careers) && !Array.isArray(body?.projections)) {
    res.status(400).json({ error: "careers and/or projections required" });
    return;
  }
  res.json({
    careers: (body.careers ?? []).map((c) => boardReviewTable(c)),
    projections: (body.projections ?? []).map((p) => boardProjection(p)),
  });
});

/**
 * R-50: the same pair at different fitness, played many times through the
 * match engine with the rating /simulate uses (pairSideRating). Lets
 * harness/condition.mjs measure what fitness does over a sample far larger
 * than a season. Reads and writes nothing.
 */
router.post("/dev/condition/win-rate", (req, res) => {
  const body = req.body as { pair?: RatedPlayer[]; opponentRating?: number; samples?: number; fitness?: number[] };
  if (!Array.isArray(body?.pair) || body.pair.length !== 2 || !Number.isFinite(body.opponentRating)) {
    res.status(400).json({ error: "pair (two players' six stats) and opponentRating are required" });
    return;
  }
  const samples = Math.min(20000, Math.max(100, Math.round(body.samples ?? 2000)));
  const results = (body.fitness ?? [100, 0]).map((fitness) => {
    const rating = pairSideRating(body.pair!.map((p, i) => ({
      ...p, id: i + 1, isActive: true, isInjured: false, injuryStatus: "Healthy", squadRole: "starter", fitness,
    })));
    let wins = 0;
    for (let n = 0; n < samples; n++) {
      if (simulateMatch(pointProbability(rating, body.opponentRating!, { homeAdvantage: false })).homeWon) wins++;
    }
    return { fitness, rating, wins, winRate: wins / samples };
  });
  res.json({ samples, opponentRating: body.opponentRating, results });
});

/**
 * Night 2 (O-7, O-8): the injury system's probes for harness/injury-treatment.mjs
 * and harness/reconstruction.mjs.
 *   /dev/injuries/roll    the named roll over many samples (reads and writes nothing)
 *   /dev/injuries/factor  the treatment factor of an injury for a medical team of
 *                         given skills (reads and writes nothing)
 *   /dev/injuries/start   a player of this career is hurt now, through the game's
 *                         own startInjuryTx (her club's staff, her history), with
 *                         the injury named, so a test can make a third ankle on purpose
 */
router.post("/dev/injuries/roll", (req, res) => {
  const samples = Math.min(200000, Math.max(100, Math.round(Number(req.body?.samples ?? 10000))));
  const counts: Record<string, number> = {};
  for (let i = 0; i < samples; i++) { const t = rollInjuryType(); counts[t.name] = (counts[t.name] ?? 0) + 1; }
  res.json({ samples, counts });
});

router.post("/dev/injuries/factor", (req, res) => {
  const b = req.body as { injury?: string; doctor?: number; physiotherapist?: number; specialist?: number };
  const m = (skillLevel?: number) => (skillLevel == null ? undefined : { role: "x", skillLevel });
  const factor = treatmentFactor(b.injury, { doctor: m(b.doctor), physiotherapist: m(b.physiotherapist), specialist: m(b.specialist) });
  res.json({ injury: b.injury, factor, weeks: (injuryInfo(b.injury)?.baseWeeks ?? 0) * factor });
});

router.post("/dev/injuries/start", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const player = await loadPlayer(cid, Number(req.body?.playerId));
  if (!player) { res.status(404).json({ error: "No such player" }); return; }
  const club = player.teamId != null ? { teamId: player.teamId } : player.poolTeamId != null ? { poolTeamId: player.poolTeamId } : "free agents" as const;
  const today = await getGameDate(team.id);
  res.json(withCareerStateTx((w) => startInjuryTx(w, cid, club, player, today, Math.random, req.body?.injury)));
});

// Unity brief item 21: run the achievement check for the active team, as the
// game does after a match or a season boundary, without playing one. Lets a
// harness prove each of the 29 rules unlocks at its threshold (and not below).
router.post("/dev/achievements/check", async (req, res) => {
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  res.json({ newlyUnlocked: await checkAchievements(team.id) });
});

export default router;
