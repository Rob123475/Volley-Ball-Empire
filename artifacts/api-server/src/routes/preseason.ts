/**
 * Update 1, overnight brief part 5 (Rob, 14 Oct, item 5): the pre-season
 * choice (utils/preseasonCamp.ts; the numbers in lib/db/src/schema/preseason.ts).
 *
 *   GET  /preseason   whether it is the off-season, the day the choice opens,
 *                     the club's first match of next season, what was chosen,
 *                     and each camp length with whether it can be booked today
 *   POST /preseason   { choice: "camp", location, length } | { choice: "rest" } | { choice: "skip" }
 */
import { Router } from "express";
import { PRESEASON } from "@workspace/db";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { getGameDate } from "../utils/gameDate.js";
import { preseasonStateTx, choosePreseasonTx } from "../utils/preseasonCamp.js";

const router = Router();

router.get("/preseason", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team || req.activeCareerSaveId == null) { res.json({ offseason: false }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const today = await getGameDate(team.id);
  const st = withCareerStateTx((w) => preseasonStateTx(w.tx, cid, team.id, today));
  res.json(st ? { offseason: true, today, ...st, locations: PRESEASON.locations, lengthTable: PRESEASON.lengths, rest: PRESEASON.rest } : { offseason: false, today });
});

router.post("/preseason", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const today = await getGameDate(team.id);
  const choice = req.body?.choice;
  if (choice !== "camp" && choice !== "rest" && choice !== "skip") { res.status(400).json({ error: "Choose a camp, Rest or Skip." }); return; }
  const refused = withCareerStateTx((w) => choosePreseasonTx(w, cid, team.id, today, { choice, location: req.body?.location, length: req.body?.length }));
  if (refused) { res.status(409).json({ error: refused }); return; }
  res.json(withCareerStateTx((w) => preseasonStateTx(w.tx, cid, team.id, today)));
});

export default router;
