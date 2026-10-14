/**
 * Update 1, item 2 (Rob, 13 Oct; M-4, M-5): the manager faces on screen.
 *
 *   GET /manager-faces   the 61 faces the new-career wizard offers: the face,
 *                        its speciality and the speciality's one-line effect
 *   GET /manager         the player's manager in the active career (Profile),
 *                        with the multipliers his speciality puts on numbers a
 *                        page works out for itself (the Medical page's injury risk)
 */
import { Router } from "express";
import { MANAGER_FACES, SPECIALITY_EFFECTS, playerManagerCard, specialityFactor } from "../utils/managerFaces.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { db, careerSavesTable, GAME_DIFFICULTY, gameDifficultyOf } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/manager-faces", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  res.json({
    faces: MANAGER_FACES.map((f) => ({
      id: f.id, image: `/${f.file}`, gender: f.gender, age: f.age, nationality: f.nationality,
      speciality: f.speciality, effect: SPECIALITY_EFFECTS[f.speciality].effect,
    })),
  });
});

router.get("/manager", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.activeCareerSaveId == null) { res.status(404).json({ error: "No active career" }); return; }
  const card = playerManagerCard(requireCareerSaveId(req.activeCareerSaveId));
  if (!card) { res.status(404).json({ error: "No manager" }); return; }
  // Update 1, overnight part 6: the career's difficulty, shown on Profile beside the manager.
  const level = gameDifficultyOf(db.select({ d: careerSavesTable.gameDifficulty }).from(careerSavesTable).where(eq(careerSavesTable.id, requireCareerSaveId(req.activeCareerSaveId))).get()?.d);
  res.json({ ...card, injuryRiskFactor: specialityFactor(req.activeTeamId, "Fitness Guru"), gameDifficulty: level, gameDifficultyLabel: GAME_DIFFICULTY[level].label, gameDifficultyBlurb: GAME_DIFFICULTY[level].blurb });
});

export default router;
