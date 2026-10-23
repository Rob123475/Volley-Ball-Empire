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
  isOlympicYear, nextOlympicsYear, nationalPairsTx, olympicYearsPlayed, olympicDate, nationsCupView, nationsCupDays, olympicTournament,
} from "../utils/olympics.js";
import { careerGameDateTx } from "../utils/gameDate.js";
import { coachedNationTx } from "../utils/nationalCoach.js";

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

/**
 * 1.1.3 (A4a): the Cup day by day: this season's when it is a Cup year and drawn
 * (its fixtures, scheduled, live or decided, with Watch on their day), else the last
 * one finished; and when the next one is.
 */
router.get("/olympics/schedule", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const seasonYear = await seasonYearFor(cid);
  const today = db.transaction((tx) => careerGameDateTx(tx, cid));
  const coached = db.transaction((tx) => coachedNationTx(tx, cid));
  const olympicsYear = nextOlympicsYear(seasonYear);
  const thisCup = isOlympicYear(seasonYear) ? nationsCupView(cid, seasonYear, today, coached) : null;
  const latestYear = olympicYearsPlayed(cid).find((y) => y <= seasonYear) ?? null;
  const cup = thisCup?.drawn ? thisCup : latestYear != null ? nationsCupView(cid, latestYear, today, coached) : null;
  res.json({
    seasonYear,
    today,
    isOlympicYear: isOlympicYear(seasonYear),
    olympicsYear,
    olympicsDate: olympicDate(olympicsYear, cid),
    days: nationsCupDays(olympicsYear, cid),
    coached,
    cup,
    // The last Cup finished (groups, knockout, medals), as the page read it before 1.1.3.
    tournament: latestYear != null ? olympicTournament(cid, latestYear) : null,
  });
});

export default router;
