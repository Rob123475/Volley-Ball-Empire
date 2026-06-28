import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  matchesTable,
  seasonsTable,
  continentalScoutingMissionsTable,
  olympicSelectionsTable,
  facilitiesTable,
  youthLadderTable,
  activeCampsTable,
} from "@workspace/db";
import { eq, and, or, desc, asc, isNotNull } from "drizzle-orm";

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysFrom(date: Date | string): number {
  const target = typeof date === "string" ? new Date(date) : date;
  const diff = target.getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
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
    const days = m.scheduledAt ? daysFrom(m.scheduledAt) : null;
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
  const [activeSeason] = await db
    .select()
    .from(seasonsTable)
    .where(eq(seasonsTable.status, "active"))
    .orderBy(desc(seasonsTable.year))
    .limit(1);

  if (activeSeason) {
    const roundsLeft = activeSeason.totalRounds - activeSeason.currentRound;
    const days = activeSeason.endDate ? daysFrom(activeSeason.endDate) : null;
    items.push({
      id: `season_${activeSeason.id}`,
      type: "season_end",
      title: `${activeSeason.name} — Season End`,
      subtitle: `${roundsLeft} round${roundsLeft !== 1 ? "s" : ""} remaining`,
      location: null,
      daysRemaining: days,
      prizeMoney: null,
      urgency: urgency(days),
      detail: `Season ${activeSeason.year} concludes after round ${activeSeason.totalRounds}`,
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
    const days = daysFrom(mission.endDate);
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

  // ── 4. Olympic status ────────────────────────────────────────────────────
  const [olympicSel] = await db
    .select()
    .from(olympicSelectionsTable)
    .where(eq(olympicSelectionsTable.userId, userId));

  if (olympicSel) {
    items.push({
      id: "olympic_qualified",
      type: "olympic",
      title: `${olympicSel.selectedFlag} Olympic Campaign`,
      subtitle: `Representing ${olympicSel.selectedCountry}`,
      location: "International",
      daysRemaining: null,
      prizeMoney: null,
      urgency: "upcoming",
      detail: "Your squad is registered for the Olympic programme. Maintain form and fitness.",
    });
  } else {
    items.push({
      id: "olympic_qualification",
      type: "olympic",
      title: "🏅 Olympic Qualification",
      subtitle: "Not yet qualified",
      location: null,
      daysRemaining: null,
      prizeMoney: null,
      urgency: "planning",
      detail: "Win continental titles or achieve top World Tour rankings to qualify for Olympic selection.",
    });
  }

  // ── 5. Youth league ──────────────────────────────────────────────────────
  const youthEntries = await db
    .select()
    .from(youthLadderTable)
    .where(and(eq(youthLadderTable.teamId, team.id), eq(youthLadderTable.isPlayer, true)))
    .orderBy(desc(youthLadderTable.season))
    .limit(1);

  if (youthEntries.length > 0) {
    const y = youthEntries[0];
    const played = y.wins + y.losses;
    items.push({
      id: `youth_${y.id}`,
      type: "youth_league",
      title: "Youth League — Active Season",
      subtitle: `Season ${y.season} · ${y.wins}W ${y.losses}L`,
      location: null,
      daysRemaining: null,
      prizeMoney: null,
      urgency: played < 3 ? "soon" : "upcoming",
      detail: `${y.points} point${y.points !== 1 ? "s" : ""} accumulated. Keep developing your youth prospects.`,
    });
  } else {
    items.push({
      id: "youth_league_setup",
      type: "youth_league",
      title: "Youth League",
      subtitle: "No active campaign",
      location: null,
      daysRemaining: null,
      prizeMoney: null,
      urgency: "planning",
      detail: "Develop youth players to enter the Youth League and build your future squad.",
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
