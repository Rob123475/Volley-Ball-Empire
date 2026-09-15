/**
 * The Olympics — R-46 qualification, R-61 the tournament itself.
 *
 *   GET /olympics/qualifiers  national standings on this season's World Tour points
 *   GET /olympics/pairs       every nation's pair right now: its two highest-rated
 *                             real players at any club, and whether it can field one
 *   GET /olympics/schedule    the tournament this career played — groups, knockout,
 *                             medals — or, before one is played, when the next is
 *
 * Nothing here draws, projects or rolls anything. The tournament is played once,
 * by the calendar, in utils/olympics.ts; these routes only read what happened.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { getActiveSeasonForCareer } from "../lib/getActiveSeason.js";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { olympicQualification } from "../utils/olympicQualification.js";
import {
  isOlympicYear, nextOlympicsYear, nationalPairsTx, olympicTournament, olympicYearsPlayed, olympicDate,
} from "../utils/olympics.js";

const router = Router();

async function seasonYearFor(careerSaveId: number): Promise<number> {
  return (await getActiveSeasonForCareer(careerSaveId))?.year ?? 2026;
}

router.get("/olympics/qualifiers", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const gameYear = await seasonYearFor(cid);
  const q = olympicQualification(cid, gameYear);
  res.json({ olympicsYear: nextOlympicsYear(gameYear), seasonYear: q.seasonYear, totalSpots: q.spots, countries: q.countries });
});

router.get("/olympics/pairs", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No active career" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const nations = db.transaction((tx) => nationalPairsTx(tx, cid, team.id));
  res.json({
    nations,
    canField: nations.filter((n) => n.pair.length === 2).length,
    cannotField: nations.filter((n) => n.pair.length < 2).length,
  });
});

router.get("/olympics/schedule", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const seasonYear = await seasonYearFor(cid);
  const olympicsYear = nextOlympicsYear(seasonYear);
  const latestYear = olympicYearsPlayed(cid).find((y) => y <= seasonYear) ?? null;
  res.json({
    seasonYear,
    isOlympicYear: isOlympicYear(seasonYear),
    olympicsYear,
    olympicsDate: olympicDate(olympicsYear),
    tournament: latestYear != null ? olympicTournament(cid, latestYear) : null,
  });
});

export default router;
