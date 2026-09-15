import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  matchesTable,
  seasonsTable,
  continentalScoutingMissionsTable,
  facilitiesTable,
  activeCampsTable,
} from "@workspace/db";
import { eq, and, or, desc, asc, isNotNull } from "drizzle-orm";
import { getGameDate } from "../utils/gameDate.js";
import { getActiveSeason, getActiveSeasonForCareer } from "../lib/getActiveSeason.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { isOlympicYear, nextOlympicsYear, olympicDate, olympicTournament } from "../utils/olympics.js";
import { CONTINENTAL_ROUNDS, FINALS_ROUNDS, WORLD_TOUR_ROUNDS, seasonPhase } from "../utils/seasonPhase.js";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

// Measured against the in-game clock, not Date.now(). scheduledAt holds 2026
// in-game dates, so comparing them to the real date made every event read as
// due now: the next match was permanently "Today" and its progress bar pinned
// at 100%.
function daysBetween(from: string, to: Date | string): number {
  const target = typeof to === "string" ? new Date(to) : to;
  const origin = new Date(`${from.slice(0, 10)}T00:00:00.000Z`);
  return Math.ceil((target.getTime() - origin.getTime()) / 86_400_000);
}

function urgency(days: number | null): "critical" | "soon" | "upcoming" | "planning" {
  if (days === null)  return "planning";
  if (days <= 1)      return "critical";
  if (days <= 7)      return "soon";
  if (days <= 30)     return "upcoming";
  return "planning";
}

function formatPrize(amount: string | number | null | undefined): string | null {
  if (!amount) return null;
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n) || n === 0) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

const FACILITY_LABELS: Record<string, string> = {
  training_centre:     "Training Centre",
  medical_facility:    "Medical Facility",
  gym:                 "Gym",
  nutrition_centre:    "Nutrition Centre",
  youth_academy:       "Youth Academy",
  scouting_department: "Scouting Dept",
  performance_lab:     "Performance Lab",
  commercial_ops:      "Commercial Ops",
  beachfront_resort:   "Beachfront Resort",
};

const CONTINENT_FLAGS: Record<string, string> = {
  "South America": "🌎", "North America": "🌎", "Europe": "🌍",
  "Africa": "🌍", "Asia": "🌏", "Oceania": "🌏",
};

// ── Route ────────────────────────────────────────────────────────────────────

router.get("/events/upcoming", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userId = req.user.id;

  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const gameDate = await getGameDate(team.id);

  type EventItem = {
    id: string;
    type: string;
    title: string;
    subtitle: string;
    location: string | null;
    daysRemaining: number | null;
    prizeMoney: string | null;
    urgency: string;
    detail: string | null;
  };

  const items: EventItem[] = [];

  // ── 1. Next scheduled match ─────────────────────────────────────────────
  const scheduledMatches = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        or(
          eq(matchesTable.homeTeamId, team.id),
          eq(matchesTable.awayTeamId, team.id),
        ),
        eq(matchesTable.status, "scheduled"),
      ),
    )
    .orderBy(asc(matchesTable.round))
    .limit(3);

  if (scheduledMatches.length > 0) {
    const m = scheduledMatches[0];
    const opponent =
      m.homeTeamId === team.id
        ? (m.awayTeamName ?? "Opponent")
        : (m.homeTeamName ?? "Opponent");
    const days = m.scheduledAt ? daysBetween(gameDate, m.scheduledAt) : null;
    const tier = m.tier ? ` · ${m.tier.charAt(0).toUpperCase() + m.tier.slice(1)} Tier` : "";
    items.push({
      id: `match_${m.id}`,
      type: "match",
      title: `vs ${opponent}`,
      subtitle: `Round ${m.round}${tier}`,
      location: m.locationName ?? null,
      daysRemaining: days,
      prizeMoney: formatPrize(m.prizeAmount),
      urgency: urgency(days),
      detail: scheduledMatches.length > 1
        ? `${scheduledMatches.length} matches queued this season`
        : null,
    });
  }

  // ── 2. Current season end ────────────────────────────────────────────────
  const activeSeason = await getActiveSeason(req);

  if (activeSeason) {
    // R-70: rounds of the season being played, not the schedule's 78 slots.
    const phase = seasonPhase(activeSeason.currentRound);
    const roundsLeft = phase.length - phase.played;
    const days = activeSeason.endDate ? daysBetween(gameDate, activeSeason.endDate) : null;
    items.push({
      id: `season_${activeSeason.id}`,
      type: "season_end",
      title: `${activeSeason.name} — Season End`,
      subtitle: `${roundsLeft} round${roundsLeft !== 1 ? "s" : ""} remaining`,
      location: null,
      daysRemaining: days,
      prizeMoney: null,
      urgency: urgency(days),
      detail: `Season ${activeSeason.year}: ${phase.length} rounds — ${CONTINENTAL_ROUNDS} continental, ${WORLD_TOUR_ROUNDS} World Tour, ${FINALS_ROUNDS} World Finals days`,
    });
  }

  // ── 3. Scouting missions returning ──────────────────────────────────────
  const activeMissions = await db
    .select()
    .from(continentalScoutingMissionsTable)
    .where(
      and(
        eq(continentalScoutingMissionsTable.teamId, team.id),
        eq(continentalScoutingMissionsTable.status, "active"),
      ),
    )
    .orderBy(asc(continentalScoutingMissionsTable.endDate));

  for (const mission of activeMissions.slice(0, 2)) {
    const days = daysBetween(gameDate, mission.endDate);
    const flag = CONTINENT_FLAGS[mission.region] ?? "🌐";
    items.push({
      id: `scout_${mission.id}`,
      type: "scouting_return",
      title: `${flag} ${mission.region} Scout Returns`,
      subtitle: `${mission.durationMonths}-month mission`,
      location: mission.region,
      daysRemaining: days,
      prizeMoney: null,
      urgency: urgency(days),
      detail: mission.prospectsFound > 0
        ? `${mission.prospectsFound} prospect${mission.prospectsFound !== 1 ? "s" : ""} already found`
        : "No prospects found yet — check back on return",
    });
  }

  // ── 4. The Olympic Games (R-61) ──────────────────────────────────────────
  // Olympic years only, after the last regular World Tour round and before the
  // World Finals. Nations qualify, not clubs; this says when, and what happened.
  {
    const careerSaveId = requireCareerSaveId(req.activeCareerSaveId);
    const seasonYear = (await getActiveSeasonForCareer(careerSaveId))?.year ?? Number(gameDate.slice(0, 4));
    const olympicsYear = nextOlympicsYear(seasonYear);
    const played = isOlympicYear(seasonYear) ? olympicTournament(careerSaveId, seasonYear) : null;
    const date = olympicDate(olympicsYear);
    const days = played ? null : daysBetween(gameDate, date);
    items.push({
      id: `olympics_${olympicsYear}`,
      type: "olympic",
      title: `🏅 Olympic Games ${olympicsYear}`,
      subtitle: played
        ? `Played — gold to ${played.medals.gold.nation}`
        : isOlympicYear(seasonYear) ? "This season, before the World Finals" : `Qualification on the ${olympicsYear} World Tour`,
      location: null,
      daysRemaining: days != null && days >= 0 ? days : null,
      prizeMoney: null,
      urgency: played ? "planning" : urgency(days != null && days >= 0 ? days : null),
      detail: played
        ? `Silver to ${played.medals.silver.nation}, bronze to ${played.medals.bronze.nation}.`
        : "The 12 nations with the most World Tour ranking points that season, each represented by its two highest-rated players at any club.",
    });
  }

  // ── 6. Facility upgrades in progress ────────────────────────────────────
  const currentRound = activeSeason
    ? (activeSeason.year - 2026) * 70 + activeSeason.currentRound
    : 0;

  const facilities = await db
    .select()
    .from(facilitiesTable)
    .where(and(eq(facilitiesTable.teamId, team.id), isNotNull(facilitiesTable.upgradingToLevel)));

  for (const fac of facilities) {
    if (!fac.upgradingToLevel || !fac.upgradeCompletesAtRound) continue;
    const roundsLeft = Math.max(0, fac.upgradeCompletesAtRound - currentRound);
    const facLabel = fac.type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    items.push({
      id: `upgrade_${fac.id}`,
      type: "facility_upgrade",
      title: `🏗️ ${facLabel} Upgrading`,
      subtitle: `Level ${fac.level} → ${fac.upgradingToLevel}`,
      location: null,
      daysRemaining: null,
      prizeMoney: null,
      urgency: roundsLeft <= 2 ? "soon" : roundsLeft <= 8 ? "upcoming" : "planning",
      detail: roundsLeft === 0
        ? "Upgrade complete — visit Facilities to collect"
        : `${roundsLeft} round${roundsLeft !== 1 ? "s" : ""} remaining until upgrade completes`,
    });
  }

  // ── 7. Active wellbeing camp ─────────────────────────────────────────────
  const [activeCamp] = await db
    .select()
    .from(activeCampsTable)
    .where(eq(activeCampsTable.teamId, team.id))
    .limit(1);

  if (activeCamp) {
    const roundsLeft = Math.max(0, activeCamp.completesAtRound - currentRound);
    items.push({
      id: `camp_${activeCamp.id}`,
      type: "wellbeing_camp",
      title: `⛺ ${activeCamp.campName} Underway`,
      subtitle: roundsLeft === 0 ? "Ready to apply effects" : `${roundsLeft} round${roundsLeft !== 1 ? "s" : ""} remaining`,
      location: null,
      daysRemaining: null,
      prizeMoney: null,
      urgency: roundsLeft <= 1 ? "soon" : roundsLeft <= 4 ? "upcoming" : "planning",
      detail: roundsLeft === 0
        ? "Camp complete — visit Wellbeing to collect effects"
        : `Effects will be applied to all active players in ${roundsLeft} round${roundsLeft !== 1 ? "s" : ""}`,
    });
  }

  // Sort: critical first, then soon, upcoming, planning; within tier by daysRemaining
  const urgencyOrder = { critical: 0, soon: 1, upcoming: 2, planning: 3 };
  items.sort((a, b) => {
    const ua = urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 3;
    const ub = urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 3;
    if (ua !== ub) return ua - ub;
    if (a.daysRemaining !== null && b.daysRemaining !== null)
      return a.daysRemaining - b.daysRemaining;
    if (a.daysRemaining !== null) return -1;
    if (b.daysRemaining !== null) return 1;
    return 0;
  });

  res.json({ items });
});

export default router;
