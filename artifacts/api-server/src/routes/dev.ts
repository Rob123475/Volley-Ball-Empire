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

export default router;
