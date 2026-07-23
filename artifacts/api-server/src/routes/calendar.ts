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
  facilitiesTable,
  contractsTable,
} from "@workspace/db";
import { eq, or, and, ne, sql, lte, inArray, isNotNull, desc } from "drizzle-orm";
import { simulateRegionalRound, resolveRegionalSeason } from "../utils/regionalSeason.js";
import {
  isRegionalSlot, isLastRegionalSlot, getSlotType,
  TOTAL_SLOTS, REGIONAL_START, REGIONAL_END, WORLD_TOUR_START, WORLD_TOUR_END,
  FINALS_START, FINALS_END, HOLIDAY_START, HOLIDAY_END,
} from "../utils/calendarSlots.js";

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

/** Return the schedule round (1-indexed) that best represents a given date. */
function dateToRound(
  dateStr: string,
  startDate: string,
  endDate: string,
  totalRounds: number,
): number {
  const start    = new Date(startDate + "T00:00:00Z");
  const end      = new Date(endDate   + "T00:00:00Z");
  const date     = new Date(dateStr   + "T00:00:00Z");
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000));
  const dayOffset = Math.floor((date.getTime() - start.getTime()) / 86400000);
  if (dayOffset <= 0) return 1;
  if (dayOffset >= totalDays) return totalRounds;
  return Math.min(totalRounds, Math.floor(dayOffset * (totalRounds - 1) / totalDays) + 1);
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

/**
 * Batch-simulate all scheduled AI-vs-NPC World Tour / Finals matches up to
 * (and including) maxRound.  The player's team matches are excluded.
 *
 * Uses a single batch SQL UPDATE for all matches, then per-team wins/losses
 * updates — typically ~18 DB calls even for a full retroactive catchup.
 */
async function autoSimulateAIMatches(
  seasonYear: number,
  maxRound: number,
  excludeTeamId: number,
): Promise<number> {
  const pending = await db
    .select({ id: matchesTable.id, homeTeamId: matchesTable.homeTeamId })
    .from(matchesTable)
    .where(and(
      eq(matchesTable.season, seasonYear),
      eq(matchesTable.status, "scheduled"),
      lte(matchesTable.round, maxRound),
      ne(matchesTable.homeTeamId, excludeTeamId),
    ));

  if (pending.length === 0) return 0;

  // Generate results: 55% home win probability, losers get 0 or 1 sets randomly
  const results = pending.map(m => {
    const homeWins = Math.random() < 0.55;
    const loserSets = Math.random() < 0.40 ? 0 : 1;
    return {
      id:         m.id,
      homeTeamId: m.homeTeamId,
      homeScore:  homeWins ? 2 : loserSets,
      awayScore:  homeWins ? loserSets : 2,
    };
  });

  // Single batch SQL UPDATE — scores are integers 0-2, IDs are from our own DB query
  const caseHS = results.map(r => `WHEN ${r.id} THEN ${r.homeScore}`).join(" ");
  const caseAS = results.map(r => `WHEN ${r.id} THEN ${r.awayScore}`).join(" ");
  const idList = results.map(r => r.id).join(",");
  await db.execute(sql.raw(`
    UPDATE matches
    SET status     = 'completed',
        home_score = CASE id ${caseHS} ELSE home_score END,
        away_score = CASE id ${caseAS} ELSE away_score END
    WHERE id IN (${idList})
  `));

  // Update wins / losses per AI home team (typically ≤16 unique teams)
  const teamStats = new Map<number, { wins: number; losses: number }>();
  for (const r of results) {
    if (!teamStats.has(r.homeTeamId)) teamStats.set(r.homeTeamId, { wins: 0, losses: 0 });
    const s = teamStats.get(r.homeTeamId)!;
    if (r.homeScore > r.awayScore) s.wins++; else s.losses++;
  }
  for (const [teamId, stats] of teamStats) {
    await db.execute(sql.raw(
      `UPDATE teams SET wins = wins + ${stats.wins}, losses = losses + ${stats.losses} WHERE id = ${teamId}`
    ));
  }

  return results.length;
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
    calendarSpeed: "medium",
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
      const restoreSpeed = (calendar.preMatchSpeed ?? "medium") as "slow" | "medium" | "fast";
      const updated = await db.update(calendarStateTable)
        .set({ pendingMatchId: null, calendarSpeed: restoreSpeed, preMatchSpeed: null, updatedAt: new Date() })
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
    const advRestoreSpeed = (calendar.preMatchSpeed ?? "medium") as "slow" | "medium" | "fast";
    const updated = await db.update(calendarStateTable)
      .set({ pendingMatchId: null, calendarSpeed: advRestoreSpeed, preMatchSpeed: null, updatedAt: new Date() })
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
  // Non-regional slots: auto-sim AI matches first, then pause if the player's
  // team has a match today.
  if (todayRounds.some(r => !isRegionalSlot(r))) {
    const wtRounds = todayRounds.filter(r => !isRegionalSlot(r));
    const maxAIRound = Math.max(...wtRounds);

    // Auto-simulate all AI World Tour / Finals matches up to today's round.
    // This also retroactively catches up any rounds that were missed on prior
    // days (e.g. the first time the user reaches a WT round after season start).
    try {
      const simCount = await autoSimulateAIMatches(season.year, maxAIRound, team.id);
      if (simCount > 0) {
        events.push(
          `${simCount} AI World Tour match${simCount === 1 ? "" : "es"} auto-simulated`
        );
      }
    } catch {
      // Non-fatal — never block calendar advance due to AI sim errors
    }

    // Check whether the player's team has a match scheduled today
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
        .set({ pendingMatchId: matchToday.id, calendarSpeed: "pause", preMatchSpeed: calendar.calendarSpeed, updatedAt: new Date() })
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

  // 5. Expire contracts globally — any contracted player whose contractEndDate < nextDate
  //    is freed back to the pool (teamId → null). This runs for ALL teams, not just user's.
  const expired = await db
    .select({ id: playersTable.id, name: playersTable.name, teamId: playersTable.teamId })
    .from(playersTable)
    .where(and(
      isNotNull(playersTable.teamId),
      isNotNull(playersTable.contractEndDate),
      eq(playersTable.isRetired, false),
      sql`${playersTable.contractEndDate} < ${nextDate}`,
    ));

  if (expired.length > 0) {
    const expiredIds = expired.map(p => p.id);
    await db.update(playersTable)
      .set({ teamId: null, contractEndDate: null, isActive: false, salary: "0" })
      .where(sql`${playersTable.id} = ANY(ARRAY[${sql.join(expiredIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
    await db.update(contractsTable)
      .set({ status: "terminated" })
      .where(and(
        sql`${contractsTable.playerId} = ANY(ARRAY[${sql.join(expiredIds.map(id => sql`${id}`), sql`, `)}]::int[])`,
        eq(contractsTable.status, "active"),
      ));
    // Only push an event if the user's own players expired (captured before nulling teamId)
    const userExpiredCount = expired.filter(p => p.teamId === team.id).length;
    if (userExpiredCount > 0) {
      events.push(`${userExpiredCount} contract${userExpiredCount > 1 ? "s" : ""} expired — player${userExpiredCount > 1 ? "s" : ""} returned to free agency`);
    }
  }

  // 6. Advance the date
  await db.update(calendarStateTable)
    .set({ currentDate: nextDate, updatedAt: new Date() })
    .where(eq(calendarStateTable.teamId, team.id));

  // 7. Keep season.currentRound in sync with the game date
  const newRound = dateToRound(nextDate, season.startDate, season.endDate, season.totalRounds);
  if (newRound > season.currentRound) {
    await db.update(seasonsTable)
      .set({ currentRound: newRound })
      .where(eq(seasonsTable.id, season.id));
  }

  const isQuietDay    = events.length === 0;
  const atSeasonEnd   = nextDate >= season.endDate;

  res.json({ newDate: nextDate, events, isQuietDay, atSeasonEnd });
});

// ── POST /api/calendar/dismiss-match ──────────────────────────────────────

router.post("/calendar/dismiss-match", async (req, res) => {
  const team = await getActiveTeam(req);
  if (!team) { res.status(401).json({ error: "No active team" }); return; }

  const calRows = await db.select().from(calendarStateTable).where(eq(calendarStateTable.teamId, team.id)).limit(1);
  const restoreSpeed = (calRows[0]?.preMatchSpeed ?? "medium") as "slow" | "medium" | "fast";

  await db.update(calendarStateTable)
    .set({ pendingMatchId: null, calendarSpeed: restoreSpeed, preMatchSpeed: null, updatedAt: new Date() })
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

  // Advance date by 1, clear pending, restore pre-match speed
  const nextDate = addDays(calendar.currentDate, 1);
  const restoreSpeed = (calendar.preMatchSpeed ?? "medium") as "slow" | "medium" | "fast";
  await db.update(calendarStateTable)
    .set({ pendingMatchId: null, currentDate: nextDate, calendarSpeed: restoreSpeed, preMatchSpeed: null, updatedAt: new Date() })
    .where(eq(calendarStateTable.teamId, team.id));

  res.json({ success: true, newDate: nextDate });
});

// ── GET /api/calendar/season-structure ────────────────────────────────────
// Returns the full 78-slot season structure for UI display

router.get("/calendar/season-structure", (_req, res) => {
  res.json({
    totalSlots: TOTAL_SLOTS,
    phases: [
      { name: "Regional Period",      slots: `${REGIONAL_START}–${REGIONAL_END}`,     count: 10, description: "All 6 continents play one round per slot" },
      { name: "World Tour",           slots: `${WORLD_TOUR_START}–${WORLD_TOUR_END}`, count: 60, description: "60 events, 10 per continent" },
      { name: "World Finals",         slots: `${FINALS_START}–${FINALS_END}`,          count: 2,  description: "Semifinals + World Final" },
      { name: "Holiday / Off-Season", slots: `${HOLIDAY_START}–${HOLIDAY_END}`,       count: 6,  description: "Rest & preparation for next season" },
    ],
  });
});

// ── GET /api/calendar/annual ───────────────────────────────────────────────
// Returns all events for every day of the requested in-game year.
// Works even when the in-game year has no exact season record (e.g. between
// seasons or a future year): contracts/facilities are queried by real date.

router.get("/calendar/annual", async (req, res) => {
  const team = await getActiveTeam(req);
  if (!team) { res.status(401).json({ error: "No active team" }); return; }

  const calRows = await db.select().from(calendarStateTable).where(eq(calendarStateTable.teamId, team.id)).limit(1);
  const calState = calRows[0];
  const currentDate    = calState?.currentDate ?? new Date().toISOString().split("T")[0]!;
  const currentInGameYear = parseInt(currentDate.split("-")[0]!, 10);

  const yearParam = req.query["year"];
  const year = yearParam ? parseInt(String(yearParam), 10) : currentInGameYear;
  if (isNaN(year)) { res.status(400).json({ error: "Invalid year" }); return; }

  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;

  // Find the season that best covers the requested year.
  // Priority 1: exact year match.
  // Priority 2: season whose date range overlaps this calendar year.
  // Priority 3: most-recent season ending before this year (provides context).
  let seasonRows = await db.select().from(seasonsTable).where(eq(seasonsTable.year, year)).limit(1);
  if (!seasonRows[0]) {
    seasonRows = await db.select().from(seasonsTable)
      .where(and(
        sql`${seasonsTable.startDate} <= ${yearEnd}`,
        sql`${seasonsTable.endDate}   >= ${yearStart}`,
      ))
      .orderBy(desc(seasonsTable.year))
      .limit(1);
  }
  const season = seasonRows[0] ?? null;

  type EvType = "regional" | "world_tour" | "finals" | "holiday" | "financial" | "contract" | "facility";
  const events: {
    date: string; type: EvType; title: string; subtitle?: string; link: string; round?: number;
  }[] = [];

  if (season) {
    // 1. Season slot events (regional, finals, holiday) — filter to requested year
    for (let slot = 1; slot <= season.totalRounds; slot++) {
      const date = roundToDate(season.startDate, season.endDate, slot, season.totalRounds);
      if (date < yearStart || date > yearEnd) continue;
      if (slot <= REGIONAL_END) {
        events.push({ date, type: "regional", title: `Regional & Pool Round ${slot}`, subtitle: "Continental leagues play simultaneously", link: "/continental", round: slot });
      } else if (slot >= FINALS_START && slot <= FINALS_END) {
        const label = slot === FINALS_START ? "World Finals — Semi-Finals" : "World Finals — Grand Final";
        events.push({ date, type: "finals", title: label, subtitle: "Top teams compete for the title", link: "/world-tour", round: slot });
      } else if (slot >= HOLIDAY_START && slot <= HOLIDAY_END) {
        events.push({ date, type: "holiday", title: "Off-Season Rest", subtitle: "Preparation for next season", link: "/career", round: slot });
      }
    }

    // 2. User's matches this season (World Tour) — filter to requested year
    const userMatches = await db.select().from(matchesTable).where(
      and(
        eq(matchesTable.season, season.year),
        or(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.awayTeamId, team.id)),
      )
    );
    for (const m of userMatches) {
      const date = roundToDate(season.startDate, season.endDate, m.round, season.totalRounds);
      if (date < yearStart || date > yearEnd) continue;
      const isHome    = m.homeTeamId === team.id;
      const opponent  = isHome ? m.awayTeamName : m.homeTeamName;
      const phase     = getSlotType(m.round);
      const evType: EvType = phase === "finals" ? "finals" : phase === "regional" ? "regional" : "world_tour";
      const completed = m.status === "completed";
      const location  = m.locationName ?? "TBD";
      events.push({
        date,
        type: evType,
        title: `${phase === "world_tour" ? "WT" : phase === "finals" ? "Finals" : "Regional"} R${m.round} · ${location}`,
        subtitle: `vs ${opponent ?? "TBD"} · ${completed ? "Completed" : "Scheduled"}`,
        link: "/world-tour",
        round: m.round,
      });
    }

    // 3. Weekly financial events (every 7 days from season start, filtered to requested year)
    {
      const start = new Date(season.startDate + "T00:00:00Z");
      const end   = new Date(season.endDate   + "T00:00:00Z");
      let d = new Date(start);
      d.setUTCDate(d.getUTCDate() + 7);
      while (d <= end) {
        const dateStr = d.toISOString().split("T")[0]!;
        if (dateStr >= yearStart && dateStr <= yearEnd) {
          events.push({ date: dateStr, type: "financial", title: "Salary Week", subtitle: "Weekly wages & sponsor income processed", link: "/finances" });
        }
        d.setUTCDate(d.getUTCDate() + 7);
      }
    }

    // 4. Facility upgrades completing this season (filter to requested year)
    const upgrades = await db
      .select({ type: facilitiesTable.type, upgradeCompletesAtRound: facilitiesTable.upgradeCompletesAtRound, upgradingToLevel: facilitiesTable.upgradingToLevel })
      .from(facilitiesTable)
      .where(and(eq(facilitiesTable.teamId, team.id), isNotNull(facilitiesTable.upgradeCompletesAtRound)));
    for (const f of upgrades) {
      if (f.upgradeCompletesAtRound && f.upgradeCompletesAtRound <= season.totalRounds) {
        const date = roundToDate(season.startDate, season.endDate, f.upgradeCompletesAtRound, season.totalRounds);
        if (date < yearStart || date > yearEnd) continue;
        events.push({ date, type: "facility", title: `Upgrade Complete: ${f.type.replace(/_/g, " ")}`, subtitle: `Level ${f.upgradingToLevel ?? "?"} ready`, link: "/club" });
      }
    }
  }

  // 5. Player/staff contracts expiring in the requested calendar year.
  //    Queried by real end_date so this works even when there is no matching season.
  const expiringContracts = await db
    .select({ id: contractsTable.id, endDate: contractsTable.endDate, playerId: contractsTable.playerId })
    .from(contractsTable)
    .where(and(
      eq(contractsTable.teamId, team.id),
      eq(contractsTable.status, "active"),
      sql`${contractsTable.endDate} >= ${yearStart}`,
      sql`${contractsTable.endDate} <= ${yearEnd}`,
    ));
  for (const c of expiringContracts) {
    const playerRows = await db.select({ name: playersTable.name }).from(playersTable).where(eq(playersTable.id, c.playerId)).limit(1);
    const name = playerRows[0]?.name ?? "Player";
    events.push({ date: c.endDate, type: "contract", title: `Contract Expires: ${name}`, subtitle: "Review and renew if needed", link: "/team" });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  // hasSeasonData = a season record exists and overlaps this year
  const hasSeasonData = season !== null &&
    season.startDate <= yearEnd && season.endDate >= yearStart;

  res.json({
    year,
    seasonStart:     season?.startDate ?? null,
    seasonEnd:       season?.endDate   ?? null,
    currentDate,
    calendarSpeed:   calState?.calendarSpeed ?? "medium",
    isOlympicSeason: season?.isOlympicSeason ?? false,
    hasSeasonData,
    events,
  });
});

export default router;
