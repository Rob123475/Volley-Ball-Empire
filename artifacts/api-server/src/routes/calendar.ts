import { Router, type Request, type Response, type NextFunction } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  calendarStateTable,
  matchesTable,
  seasonsTable,
  playersTable,
  teamsTable,
  financeTransactionsTable,
  regionalLeagueSeasonsTable,
} from "@workspace/db";
import { eq, or, and, ne, sql, inArray } from "drizzle-orm";
import { simulateRegionalRound, resolveRegionalSeason } from "../utils/regionalSeason.js";
import { isRegionalSlot, isLastRegionalSlot, getSlotType } from "../utils/calendarSlots.js";

const router = Router();

// Guard — all calendar routes require an authenticated session
router.use((_req: Request, res: Response, next: NextFunction) => {
  if (!_req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function roundToDate(
  startDate: string,
  endDate: string,
  round: number,
  totalRounds: number,
): string {
  const start = new Date(startDate + "T00:00:00Z");
  const end   = new Date(endDate   + "T00:00:00Z");
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const offset = totalRounds <= 1 ? 0 : Math.floor((round - 1) * totalDays / (totalRounds - 1));
  const d = new Date(start.getTime() + offset * 86400000);
  return d.toISOString().split("T")[0]!;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0]!;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z");
  const db_ = new Date(b + "T00:00:00Z");
  return Math.floor((db_.getTime() - da.getTime()) / 86400000);
}

function todayRoundsForDate(
  date: string,
  startDate: string,
  endDate: string,
  totalRounds: number,
): number[] {
  const rounds: number[] = [];
  for (let r = 1; r <= totalRounds; r++) {
    if (roundToDate(startDate, endDate, r, totalRounds) === date) {
      rounds.push(r);
    }
  }
  return rounds;
}

async function getOrCreateCalendar(teamId: number, season: typeof seasonsTable.$inferSelect) {
  const rows = await db.select().from(calendarStateTable).where(eq(calendarStateTable.teamId, teamId));
  if (rows[0]) return rows[0];

  const lastRound = Math.max(0, season.currentRound);
  const nextRound = Math.min(lastRound + 1, season.totalRounds);
  const initDate  = roundToDate(season.startDate, season.endDate, nextRound, season.totalRounds);

  const [created] = await db.insert(calendarStateTable).values({
    teamId,
    currentDate:   initDate,
    calendarSpeed: "pause",
    lastSalaryDate: season.startDate,
  }).returning();
  return created!;
}

// ── GET /api/calendar ──────────────────────────────────────────────────────

router.get("/calendar", async (req, res) => {
  const team = await getActiveTeam(req);
  if (!team) { res.status(401).json({ error: "No active team" }); return; }

  const seasonRows = await db.select().from(seasonsTable).where(eq(seasonsTable.status, "active")).limit(1);
  const season = seasonRows[0];
  if (!season) { res.status(400).json({ error: "No active season" }); return; }

  let calendar = await getOrCreateCalendar(team.id, season);

  // Auto-dismiss if pending match was completed elsewhere
  if (calendar.pendingMatchId) {
    const matchRows = await db.select().from(matchesTable).where(eq(matchesTable.id, calendar.pendingMatchId)).limit(1);
    if (matchRows[0]?.status === "completed") {
      const updated = await db.update(calendarStateTable)
        .set({ pendingMatchId: null, updatedAt: new Date() })
        .where(eq(calendarStateTable.teamId, team.id))
        .returning();
      if (updated[0]) calendar = updated[0];
    }
  }

  // Next match for the user's team
  const scheduledMatches = await db.select().from(matchesTable).where(
    and(
      eq(matchesTable.season, season.year),
      eq(matchesTable.status, "scheduled"),
      or(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.awayTeamId, team.id)),
    )
  );
  scheduledMatches.sort((a, b) => a.round - b.round);

  let nextMatch = null;
  let nextMatchDate: string | null = null;
  let daysToNextMatch: number | null = null;

  for (const m of scheduledMatches) {
    const mDate = roundToDate(season.startDate, season.endDate, m.round, season.totalRounds);
    if (mDate >= calendar.currentDate) {
      nextMatch       = m;
      nextMatchDate   = mDate;
      daysToNextMatch = daysBetween(calendar.currentDate, mDate);
      break;
    }
  }

  // Team fitness summary
  const players = await db.select({
    fitness:      playersTable.fitness,
    fatigue:      playersTable.fatigue,
    injuryStatus: playersTable.injuryStatus,
    isActive:     playersTable.isActive,
  }).from(playersTable).where(eq(playersTable.teamId, team.id));

  const active = players.filter(p => p.isActive);
  const avgFitness   = active.length ? Math.round(active.reduce((s, p) => s + p.fitness, 0) / active.length) : 0;
  const avgFatigue   = active.length ? Math.round(active.reduce((s, p) => s + p.fatigue, 0) / active.length) : 0;
  const injuredCount = players.filter(p => p.injuryStatus !== "Healthy").length;

  // Today's events
  const todayRounds = todayRoundsForDate(calendar.currentDate, season.startDate, season.endDate, season.totalRounds);
  const todayUserMatches = scheduledMatches.filter(m => todayRounds.includes(m.round));

  // Regional info for today
  const todaySlotTypes = todayRounds.map(r => ({ round: r, type: getSlotType(r) }));
  const todayIsRegional = todaySlotTypes.some(s => s.type === "regional");

  // Pending match details
  let pendingMatch = null;
  if (calendar.pendingMatchId) {
    const rows = await db.select().from(matchesTable).where(eq(matchesTable.id, calendar.pendingMatchId)).limit(1);
    pendingMatch = rows[0] ?? null;
  }

  res.json({
    currentDate:       calendar.currentDate,
    calendarSpeed:     calendar.calendarSpeed,
    pendingMatchId:    calendar.pendingMatchId,
    pendingMatch,
    nextMatch,
    nextMatchDate,
    daysToNextMatch,
    seasonYear:        season.year,
    seasonRound:       season.currentRound,
    seasonTotalRounds: season.totalRounds,
    regionalRoundsProcessed: season.regionalRoundsProcessed,
    isOlympicSeason:   season.isOlympicSeason,
    teamFitness: { avgFitness, avgFatigue, injuredCount, totalActive: active.length },
    todayEvents: todayUserMatches.map(m => ({
      type:     "match",
      round:    m.round,
      slotType: getSlotType(m.round),
      opponent: m.homeTeamId === team.id ? m.awayTeamName : m.homeTeamName,
      isHome:   m.homeTeamId === team.id,
    })),
    todayIsRegional,
    todaySlots: todaySlotTypes,
  });
});

// ── PATCH /api/calendar/speed ──────────────────────────────────────────────

router.patch("/calendar/speed", async (req, res) => {
  const team = await getActiveTeam(req);
  if (!team) { res.status(401).json({ error: "No active team" }); return; }

  const { speed } = req.body as { speed: string };
  if (!["pause", "slow", "medium", "fast"].includes(speed)) {
    res.status(400).json({ error: "Invalid speed" }); return;
  }

  const seasonRows = await db.select().from(seasonsTable).where(eq(seasonsTable.status, "active")).limit(1);
  const season = seasonRows[0];
  if (season) await getOrCreateCalendar(team.id, season);

  await db.update(calendarStateTable)
    .set({ calendarSpeed: speed, updatedAt: new Date() })
    .where(eq(calendarStateTable.teamId, team.id));

  res.json({ speed });
});

// ── POST /api/calendar/advance ─────────────────────────────────────────────

router.post("/calendar/advance", async (req, res) => {
  const team = await getActiveTeam(req);
  if (!team) { res.status(401).json({ error: "No active team" }); return; }

  const seasonRows = await db.select().from(seasonsTable).where(eq(seasonsTable.status, "active")).limit(1);
  const season = seasonRows[0];
  if (!season) { res.status(400).json({ error: "No active season" }); return; }

  let calendar = await getOrCreateCalendar(team.id, season);

  if (calendar.currentDate > season.endDate) {
    res.json({ blocked: "season_end", currentDate: calendar.currentDate, events: [] });
    return;
  }

  // Check pending match
  if (calendar.pendingMatchId) {
    const matchRows = await db.select().from(matchesTable).where(eq(matchesTable.id, calendar.pendingMatchId)).limit(1);
    if (matchRows[0]?.status !== "completed") {
      res.json({ blocked: "pending_match", pendingMatchId: calendar.pendingMatchId, currentDate: calendar.currentDate });
      return;
    }
    const updated = await db.update(calendarStateTable)
      .set({ pendingMatchId: null, updatedAt: new Date() })
      .where(eq(calendarStateTable.teamId, team.id))
      .returning();
    if (updated[0]) calendar = updated[0];
  }

  // Determine which schedule slots fall on today's date
  const todayRounds = todayRoundsForDate(calendar.currentDate, season.startDate, season.endDate, season.totalRounds);

  const events: string[] = [];

  // ── Regional period processing ──────────────────────────────────────────
  // For each regional slot (1–10) that falls on today's date and hasn't yet
  // been auto-simulated, simulate all 6 continents' fixtures for that round.
  if (todayRounds.some(r => isRegionalSlot(r))) {
    for (const round of todayRounds.filter(r => isRegionalSlot(r))) {
      if (round > season.regionalRoundsProcessed) {
        // Auto-simulate this regional round across all continents
        try {
          const summary = await simulateRegionalRound(round, season.year);
          const totalFixtures = summary.reduce((s, c) => s + c.simulated, 0);
          if (totalFixtures > 0) {
            events.push(`Regional Round ${round}: ${totalFixtures} continental fixtures auto-simulated`);
          }
        } catch {
          // Non-fatal — fixtures may already be simulated or seasons not found
        }

        // Update season.regionalRoundsProcessed
        await db.update(seasonsTable)
          .set({ regionalRoundsProcessed: round })
          .where(eq(seasonsTable.id, season.id));

        // If this was the final regional round, resolve all 6 continental seasons
        if (isLastRegionalSlot(round)) {
          const activeSeasons = await db
            .select({ id: regionalLeagueSeasonsTable.id, continent: regionalLeagueSeasonsTable.continent })
            .from(regionalLeagueSeasonsTable)
            .where(
              and(
                eq(regionalLeagueSeasonsTable.seasonYear, season.year),
                eq(regionalLeagueSeasonsTable.status, "active"),
              ),
            );

          const resolvedContinents: string[] = [];
          for (const rs of activeSeasons) {
            try {
              await resolveRegionalSeason(rs.id);
              resolvedContinents.push(rs.continent);
            } catch {
              // Skip continents whose season cannot yet be resolved (incomplete fixtures)
            }
          }
          if (resolvedContinents.length > 0) {
            events.push(`Regional season resolved: ${resolvedContinents.join(", ")} — World Tour qualifiers confirmed`);
          }
        }
      }
    }

    // Regional days do NOT create pendingMatch for the user's team
    // (the user's club is a World Tour entrant, not in the regional leagues)
  }

  // ── World Tour / Finals match check ────────────────────────────────────
  // Only check for user matches on non-regional slots
  if (todayRounds.some(r => !isRegionalSlot(r))) {
    const wtRounds = todayRounds.filter(r => !isRegionalSlot(r));
    const todayMatches = await db.select().from(matchesTable).where(
      and(
        eq(matchesTable.season, season.year),
        eq(matchesTable.status, "scheduled"),
        or(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.awayTeamId, team.id)),
      )
    );
    const matchToday = todayMatches.find(m => wtRounds.includes(m.round));

    if (matchToday) {
      await db.update(calendarStateTable)
        .set({ pendingMatchId: matchToday.id, calendarSpeed: "pause", updatedAt: new Date() })
        .where(eq(calendarStateTable.teamId, team.id));

      res.json({
        matchDay: {
          matchId:     matchToday.id,
          round:       matchToday.round,
          slotType:    getSlotType(matchToday.round),
          isHome:      matchToday.homeTeamId === team.id,
          opponent:    matchToday.homeTeamId === team.id ? matchToday.awayTeamName : matchToday.homeTeamName,
          location:    matchToday.locationName,
          prizeAmount: matchToday.prizeAmount,
          tier:        matchToday.tier,
        },
        currentDate: calendar.currentDate,
        events: ["Match day — your team plays today!"],
      });
      return;
    }
  }

  // ── Holiday period note ─────────────────────────────────────────────────
  if (todayRounds.some(r => getSlotType(r) === "holiday")) {
    events.push("Off-season rest period — no matches scheduled");
  }

  // ── Daily processing ──────────────────────────────────────────

  // 1. Fatigue recovery — healthy players
  await db.update(playersTable)
    .set({ fatigue: sql`GREATEST(0, fatigue - 4)` })
    .where(and(eq(playersTable.teamId, team.id), eq(playersTable.injuryStatus, "Healthy")));

  // 2. Fatigue recovery — injured players (slower, bed rest)
  await db.update(playersTable)
    .set({ fatigue: sql`GREATEST(0, fatigue - 2)` })
    .where(and(eq(playersTable.teamId, team.id), ne(playersTable.injuryStatus, "Healthy")));

  // 3. Fitness recovery for well-rested healthy players
  await db.update(playersTable)
    .set({ fitness: sql`LEAST(100, fitness + 1)` })
    .where(and(
      eq(playersTable.teamId, team.id),
      eq(playersTable.injuryStatus, "Healthy"),
      sql`fatigue < 30`,
    ));

  // 4. Weekly salary & sponsor income (every 7 calendar days)
  const lastSalary = calendar.lastSalaryDate ?? season.startDate;
  const nextDate   = addDays(calendar.currentDate, 1);

  if (daysBetween(lastSalary, nextDate) >= 7) {
    const teamPlayers = await db.select({ salary: playersTable.salary })
      .from(playersTable).where(eq(playersTable.teamId, team.id));

    const teamRow = await db.select({ sponsorReputation: teamsTable.sponsorReputation })
      .from(teamsTable).where(eq(teamsTable.id, team.id)).limit(1);

    const weeklySalary  = Math.round(teamPlayers.reduce((s, p) => s + Number(p.salary), 0));
    const weeklyStaff   = Math.round(weeklySalary * 0.2);
    const sponsorRep    = teamRow[0]?.sponsorReputation ?? 50;
    const sponsorIncome = Math.round(sponsorRep * 200);
    const net           = sponsorIncome - weeklySalary - weeklyStaff;

    await db.update(teamsTable)
      .set({ budget: sql`budget + ${net}` })
      .where(eq(teamsTable.id, team.id));

    await db.insert(financeTransactionsTable).values([
      {
        teamId:      team.id,
        type:        "income",
        amount:      String(sponsorIncome),
        description: "Weekly sponsor & commercial income",
        category:    "sponsorship",
        date:        nextDate,
      },
      {
        teamId:      team.id,
        type:        "expense",
        amount:      String(weeklySalary),
        description: `Weekly player salaries (${teamPlayers.length} players)`,
        category:    "salaries",
        date:        nextDate,
      },
      {
        teamId:      team.id,
        type:        "expense",
        amount:      String(weeklyStaff),
        description: "Weekly staff & operational costs",
        category:    "staff",
        date:        nextDate,
      },
    ]);

    await db.update(calendarStateTable)
      .set({ lastSalaryDate: nextDate })
      .where(eq(calendarStateTable.teamId, team.id));

    events.push(
      `Salary week: €${weeklySalary.toLocaleString()} wages, €${sponsorIncome.toLocaleString()} sponsor income`
    );
  }

  // 5. Advance the date
  await db.update(calendarStateTable)
    .set({ currentDate: nextDate, updatedAt: new Date() })
    .where(eq(calendarStateTable.teamId, team.id));

  const isQuietDay    = events.length === 0;
  const atSeasonEnd   = nextDate >= season.endDate;

  res.json({ newDate: nextDate, events, isQuietDay, atSeasonEnd });
});

// ── POST /api/calendar/dismiss-match ──────────────────────────────────────

router.post("/calendar/dismiss-match", async (req, res) => {
  const team = await getActiveTeam(req);
  if (!team) { res.status(401).json({ error: "No active team" }); return; }

  await db.update(calendarStateTable)
    .set({ pendingMatchId: null, updatedAt: new Date() })
    .where(eq(calendarStateTable.teamId, team.id));

  res.json({ success: true });
});

// ── POST /api/calendar/skip-match ─────────────────────────────────────────
// Auto-sim the pending match silently and advance past match day

router.post("/calendar/skip-match", async (req, res) => {
  const team = await getActiveTeam(req);
  if (!team) { res.status(401).json({ error: "No active team" }); return; }

  const rows = await db.select().from(calendarStateTable).where(eq(calendarStateTable.teamId, team.id)).limit(1);
  const calendar = rows[0];
  if (!calendar?.pendingMatchId) { res.json({ success: true }); return; }

  // Mark match as simulated (simple win/loss result)
  const matchRows = await db.select().from(matchesTable).where(eq(matchesTable.id, calendar.pendingMatchId)).limit(1);
  const match = matchRows[0];
  if (match && match.status === "scheduled") {
    const homeScore = Math.floor(Math.random() * 2) + 1;
    const awayScore = homeScore === 2 ? 1 : 2;
    await db.update(matchesTable)
      .set({ status: "completed", homeScore, awayScore })
      .where(eq(matchesTable.id, calendar.pendingMatchId));
  }

  // Advance date by 1 and clear pending
  const nextDate = addDays(calendar.currentDate, 1);
  await db.update(calendarStateTable)
    .set({ pendingMatchId: null, currentDate: nextDate, updatedAt: new Date() })
    .where(eq(calendarStateTable.teamId, team.id));

  res.json({ success: true, newDate: nextDate });
});

// ── GET /api/calendar/season-structure ────────────────────────────────────
// Returns the full 78-slot season structure for UI display

router.get("/calendar/season-structure", async (_req, res) => {
  const { TOTAL_SLOTS, REGIONAL_START, REGIONAL_END, WORLD_TOUR_START, WORLD_TOUR_END,
          FINALS_START, FINALS_END, HOLIDAY_START, HOLIDAY_END } = await import("../utils/calendarSlots.js");

  res.json({
    totalSlots: TOTAL_SLOTS,
    phases: [
      { name: "Regional Period",   slots: `${REGIONAL_START}–${REGIONAL_END}`,    count: 10, description: "All 6 continents play one round per slot" },
      { name: "World Tour",        slots: `${WORLD_TOUR_START}–${WORLD_TOUR_END}`, count: 60, description: "60 events, 10 per continent" },
      { name: "World Finals",      slots: `${FINALS_START}–${FINALS_END}`,         count: 2,  description: "Semifinals + World Final" },
      { name: "Holiday / Off-Season", slots: `${HOLIDAY_START}–${HOLIDAY_END}`,  count: 6,  description: "Rest & preparation for next season" },
    ],
  });
});

export default router;
