import { Router } from "express";
import { db } from "@workspace/db";
import {
  youthLeagueResultsTable,
  youthLadderTable,
  youthChampionshipTrophiesTable,
  playersTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { teamsTable } from "@workspace/db";

const router = Router();

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

// ── GET /youth-league/results ─────────────────────────────────────────────────

router.get("/youth-league/results", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }

  const results = await db.select()
    .from(youthLeagueResultsTable)
    .where(eq(youthLeagueResultsTable.teamId, team.id))
    .orderBy(desc(youthLeagueResultsTable.weekNumber), desc(youthLeagueResultsTable.id))
    .limit(50);

  res.json(results);
});

// ── GET /youth-league/ladder ──────────────────────────────────────────────────

router.get("/youth-league/ladder", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }

  const ladder = await db.select()
    .from(youthLadderTable)
    .where(eq(youthLadderTable.teamId, team.id))
    .orderBy(desc(youthLadderTable.points), desc(youthLadderTable.wins));

  if (ladder.length === 0) {
    // Seed a fresh ladder for this team
    const seeded = await seedYouthLadder(team.id, 1, team.name);
    res.json(seeded);
    return;
  }

  res.json(ladder);
});

// ── GET /youth-league/stars ───────────────────────────────────────────────────

router.get("/youth-league/stars", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }

  const youthPlayers = await db.select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.teamId, team.id),
        gte(playersTable.age, 14),
        lte(playersTable.age, 18),
        eq(playersTable.isRetired, false),
      )
    )
    .orderBy(asc(playersTable.age));

  const stars = youthPlayers.map(p => ({
    id: p.id,
    name: p.name,
    age: p.age,
    rating: Math.round((p.power + p.speed + p.defense + p.serve + p.block) / 5),
    potential: p.potential,
    speciality: p.trainingFocus ?? p.position,
    nationality: p.nationality,
  }));

  // Sort by rating descending
  stars.sort((a, b) => b.rating - a.rating);

  res.json(stars);
});

// ── GET /youth-league/championship ───────────────────────────────────────────

router.get("/youth-league/championship", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }

  const trophies = await db.select()
    .from(youthChampionshipTrophiesTable)
    .where(eq(youthChampionshipTrophiesTable.teamId, team.id))
    .orderBy(desc(youthChampionshipTrophiesTable.season));

  res.json(trophies);
});

export default router;

// ── AI team names for ladder ──────────────────────────────────────────────────

const AI_LADDER_TEAMS = [
  "Valley Smashers",
  "Coastal Waves",
  "Desert Hawks",
  "Mountain Eagles",
  "City Heat",
  "Ocean Breakers",
  "Storm Riders",
  "Sand Tigers",
];

// ── seedYouthLadder — creates ladder entries for a new season ─────────────────

export async function seedYouthLadder(teamId: number, season: number, playerTeamName: string): Promise<typeof youthLadderTable.$inferSelect[]> {
  // Check if already seeded
  const existing = await db.select()
    .from(youthLadderTable)
    .where(and(eq(youthLadderTable.teamId, teamId), eq(youthLadderTable.season, season)));

  if (existing.length > 0) return existing;

  const entries = [
    { teamId, season, competitorName: playerTeamName + " Academy", isPlayer: true, wins: 0, losses: 0, points: 0 },
    ...AI_LADDER_TEAMS.map(name => ({
      teamId, season, competitorName: name,
      isPlayer: false,
      wins: Math.floor(Math.random() * 6),
      losses: Math.floor(Math.random() * 4),
      points: 0,
    })),
  ];
  // Set initial points for AI (3 per win, 1 per draw)
  for (const e of entries) {
    if (!e.isPlayer) {
      e.points = e.wins * 3;
    }
  }

  await db.insert(youthLadderTable).values(entries);

  return db.select()
    .from(youthLadderTable)
    .where(and(eq(youthLadderTable.teamId, teamId), eq(youthLadderTable.season, season)))
    .orderBy(desc(youthLadderTable.points), desc(youthLadderTable.wins));
}

// ── simulateYouthLeagueChampionship — end-of-season youth knockout ────────────

export async function simulateYouthLeagueChampionship(teamId: number, season: number, playerTeamName: string): Promise<void> {
  // Avoid duplicate championships per season
  const existing = await db.select()
    .from(youthChampionshipTrophiesTable)
    .where(and(
      eq(youthChampionshipTrophiesTable.teamId, teamId),
      eq(youthChampionshipTrophiesTable.season, season),
    ));
  if (existing.length > 0) return;

  // Get ladder to determine qualifiers (top 4)
  const ladder = await db.select()
    .from(youthLadderTable)
    .where(and(eq(youthLadderTable.teamId, teamId), eq(youthLadderTable.season, season)))
    .orderBy(desc(youthLadderTable.points), desc(youthLadderTable.wins));

  const qualifiers = ladder.slice(0, 4).map(e => ({ name: e.competitorName, isPlayer: e.isPlayer }));

  // Simulate knockout: SF1 (1v4), SF2 (2v3)
  const winnerOf = (a: { name: string; isPlayer: boolean }, b: { name: string; isPlayer: boolean }) => {
    // Player gets a slight advantage based on ladder position
    const rand = Math.random();
    return rand < 0.5 ? a : b;
  };

  if (qualifiers.length < 2) {
    // Fallback: player's team wins if only 1 qualifier
    const winner = qualifiers[0] ?? { name: playerTeamName + " Academy", isPlayer: true };
    await db.insert(youthChampionshipTrophiesTable).values({
      teamId,
      season,
      year: new Date().getFullYear(),
      winningTeamName: winner.name,
      isPlayerWin: winner.isPlayer,
    });
    return;
  }

  const sf1Winner = winnerOf(qualifiers[0], qualifiers[3] ?? qualifiers[1]);
  const sf2Winner = winnerOf(qualifiers[1], qualifiers[2] ?? qualifiers[0]);
  const champion = winnerOf(sf1Winner, sf2Winner);

  await db.insert(youthChampionshipTrophiesTable).values({
    teamId,
    season,
    year: new Date().getFullYear(),
    winningTeamName: champion.name,
    isPlayerWin: champion.isPlayer,
  });
}

// ── tickAcademyContracts — called from match simulate tick ────────────────────

const YOUTH_WEEKLY_WAGE_MAP: Record<string, number> = {
  Low: 50, Average: 75, High: 100, Elite: 150, Generational: 250,
};

export async function tickAcademyContracts(teamId: number): Promise<{ totalWeeklyWages: number; playerCount: number }> {
  const youthPlayers = await db.select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.teamId, teamId),
        gte(playersTable.age, 14),
        lte(playersTable.age, 18),
        eq(playersTable.isRetired, false),
      )
    );

  if (youthPlayers.length === 0) return { totalWeeklyWages: 0, playerCount: 0 };

  let totalWeeklyWages = 0;

  for (const player of youthPlayers) {
    const currentYears = player.academyContractYears != null
      ? Number(player.academyContractYears)
      : 2.0;

    const newYears = Math.max(0, currentYears - 1 / 52);

    await db.update(playersTable)
      .set({ academyContractYears: newYears.toFixed(2) })
      .where(eq(playersTable.id, player.id));

    totalWeeklyWages += YOUTH_WEEKLY_WAGE_MAP[player.potential] ?? 75;
  }

  return { totalWeeklyWages, playerCount: youthPlayers.length };
}

// ── FOCUS_STAT_MAP ────────────────────────────────────────────────────────────

const FOCUS_STAT_MAP: Record<string, string> = {
  Attack:      "power",
  Defence:     "defense",
  Serving:     "serve",
  Blocking:    "block",
  Athleticism: "speed",
};

// ── OPPOSITION_NAMES ──────────────────────────────────────────────────────────

const OPPOSITION_NAMES = [
  "Valley Smashers", "Coastal Waves", "Desert Hawks", "Mountain Eagles",
  "City Heat", "Ocean Breakers", "Storm Riders", "Sand Tigers",
  "Pacific Aces", "Atlantic Spikers", "Riverside Aces", "Highland Flyers",
  "Sunset Spikes", "Bayshore Blockers", "Northwind Setters",
];

// ── simulateYouthLeague — called from match simulate tick ─────────────────────

export async function simulateYouthLeague(teamId: number): Promise<void> {
  const youthPlayers = await db.select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.teamId, teamId),
        gte(playersTable.age, 14),
        lte(playersTable.age, 18),
        eq(playersTable.isRetired, false),
      )
    );

  if (youthPlayers.length === 0) return;

  const latestResult = await db.query.youthLeagueResultsTable.findFirst({
    where: eq(youthLeagueResultsTable.teamId, teamId),
    orderBy: [desc(youthLeagueResultsTable.weekNumber)],
  });
  const weekNumber = (latestResult?.weekNumber ?? 0) + 1;

  // Derive season from weekNumber (each season = 38 weeks)
  const season = Math.ceil(weekNumber / 38);

  // Ensure ladder exists for this season (seed AI teams + player academy)
  const team = await db.query.teamsTable.findFirst({ where: eq(teamsTable.id, teamId) });
  const playerTeamName = team?.name ?? "Player";
  await seedYouthLadder(teamId, season, playerTeamName);

  let playerWins = 0;
  let playerLosses = 0;

  for (const player of youthPlayers) {
    const rating = Math.round(
      (player.power + player.speed + player.defense + player.serve + player.block) / 5
    );

    const winChance   = rating >= 75 ? 0.65 : rating >= 60 ? 0.50 : 0.35;
    const rand        = Math.random();
    const result      = rand < winChance ? "win" : rand < winChance + 0.20 ? "draw" : "loss";

    const xpGained =
      result === "win"  ? 20 + Math.floor(Math.random() * 11) :
      result === "draw" ? 12 + Math.floor(Math.random() * 7)  :
                          8  + Math.floor(Math.random() * 5);

    const devPointsGained = 8 + Math.floor(Math.random() * 5);
    const moraleChange    = result === "win" ? 3 : result === "draw" ? 1 : -1;
    const oppositionName  = OPPOSITION_NAMES[Math.floor(Math.random() * OPPOSITION_NAMES.length)];

    await db.insert(youthLeagueResultsTable).values({
      teamId,
      playerId:           player.id,
      playerName:         player.name,
      weekNumber,
      result,
      oppositionName,
      xpGained,
      devPointsGained,
      moraleChange,
      playerRatingAtTime: rating,
    });

    const updates: Record<string, unknown> = {
      trainingPoints: player.trainingPoints + xpGained,
      morale:         Math.min(100, Math.max(0, player.morale + moraleChange)),
    };

    if (player.trainingFocus) {
      if (player.trainingFocus === "Leadership") {
        updates.morale = Math.min(100, (updates.morale as number) + 2);
      } else {
        const focusStat = FOCUS_STAT_MAP[player.trainingFocus];
        if (focusStat) {
          const prevFocusXp = player.focusXp ?? 0;
          const newFocusXp  = prevFocusXp + devPointsGained;
          updates.focusXp   = newFocusXp;
          const focusGain   = Math.floor(newFocusXp / 100) - Math.floor(prevFocusXp / 100);
          if (focusGain > 0) {
            updates[focusStat] = Math.min(
              99,
              (player[focusStat as keyof typeof player] as number) + focusGain
            );
          }
        }
      }
    }

    await db.update(playersTable).set(updates).where(eq(playersTable.id, player.id));

    if (result === "win") playerWins++;
    else if (result === "loss") playerLosses++;
  }

  // Update player's academy ladder entry (aggregate across all players — use majority outcome)
  const playerWon = playerWins > playerLosses;
  const playerDrew = playerWins === playerLosses && playerWins > 0;
  const pointsGained = playerWon ? 3 : playerDrew ? 1 : 0;

  const playerEntry = await db.query.youthLadderTable.findFirst({
    where: and(
      eq(youthLadderTable.teamId, teamId),
      eq(youthLadderTable.season, season),
      eq(youthLadderTable.isPlayer, true),
    ),
  });

  if (playerEntry) {
    await db.update(youthLadderTable)
      .set({
        wins:   playerEntry.wins   + (playerWon ? 1 : 0),
        losses: playerEntry.losses + (!playerWon && !playerDrew ? 1 : 0),
        points: playerEntry.points + pointsGained,
      })
      .where(eq(youthLadderTable.id, playerEntry.id));
  }

  // Also randomly tick AI teams' ladder
  const aiEntries = await db.select()
    .from(youthLadderTable)
    .where(and(
      eq(youthLadderTable.teamId, teamId),
      eq(youthLadderTable.season, season),
      eq(youthLadderTable.isPlayer, false),
    ));

  for (const aiEntry of aiEntries) {
    const aiWins = Math.random() < 0.5 ? 1 : 0;
    const aiLosses = aiWins === 0 ? 1 : 0;
    await db.update(youthLadderTable)
      .set({
        wins:   aiEntry.wins   + aiWins,
        losses: aiEntry.losses + aiLosses,
        points: aiEntry.points + aiWins * 3,
      })
      .where(eq(youthLadderTable.id, aiEntry.id));
  }

  // End-of-season championship at week 38
  if (weekNumber % 38 === 0) {
    await simulateYouthLeagueChampionship(teamId, season, playerTeamName);
  }
}
