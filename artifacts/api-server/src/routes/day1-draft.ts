/**
 * Update 1, item 4b (Rob, 14 Oct, C-5 B): the Day 1 draft (utils/day1Draft.ts).
 *
 *   GET  /day1-draft          whether it is open; his picks so far; every senior
 *                             in the world he can pick, with her rating,
 *                             nationality, age and wage; the salary cap figure
 *   POST /day1-draft/finish   close it once he has 2 or 3 (the AI clubs fill
 *                             their gaps, the AI managers' faces are dealt)
 *
 * A pick signs through POST /contracts (no fee while the draft is open); a pick
 * taken back is a release (free: it is the starting squad's first week).
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { loadPlayers, requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { isYouthPlayer } from "../utils/playerClassification.js";
import { overallRating } from "../utils/overallRating.js";
import { day1DraftOpen, day1DraftListTx, finishDay1DraftTx, DRAFT_MIN, DRAFT_MAX } from "../utils/day1Draft.js";
import { seniorWageBill, wageCapView } from "../utils/salaryCap.js";
import { developedPlayers } from "../utils/check-achievements.js";

const router = Router();

router.get("/day1-draft", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team || req.activeCareerSaveId == null) { res.json({ open: false }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  if (!day1DraftOpen(cid)) { res.json({ open: false }); return; }
  const picks = (await loadPlayers(cid, { teamId: team.id })).filter((p) => !isYouthPlayer(p))
    .map((p) => ({ id: p.id, name: p.name, nationality: p.nationality, age: p.age, rating: overallRating(p), wage: Number(p.salary), squadRole: p.squadRole, imageUrl: p.imageUrl ?? null }));
  res.json({
    open: true, min: DRAFT_MIN, max: DRAFT_MAX, picks,
    players: db.transaction((tx) => day1DraftListTx(tx, cid, team.id)),
    wageCap: wageCapView(seniorWageBill(cid, { teamId: team.id })),
  });
});

router.post("/day1-draft/finish", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team || req.activeCareerSaveId == null) { res.status(404).json({ error: "No career" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  if (!day1DraftOpen(cid)) { res.status(409).json({ error: "The Day 1 draft is closed." }); return; }
  const refused = withCareerStateTx((w) => finishDay1DraftTx(w, cid, team.id));
  if (refused) { res.status(422).json({ error: refused }); return; }
  // Item 21: the starting squad's ratings as they join, so a player the club
  // already had at 90 is not "developed" (Future Superstar).
  await developedPlayers(team.id);
  res.json({ ok: true });
});

export default router;
