import { Router } from "express";
import { db } from "@workspace/db";
import { youthLeagueResultsTable, playersTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
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

export default router;

// ── simulateYouthLeague — called from match simulate tick ─────────────────────

const OPPOSITION_NAMES = [
  "Valley Smashers", "Coastal Waves", "Desert Hawks", "Mountain Eagles",
  "City Heat", "Ocean Breakers", "Storm Riders", "Sand Tigers",
  "Pacific Aces", "Atlantic Spikers", "Riverside Aces", "Highland Flyers",
  "Sunset Spikes", "Bayshore Blockers", "Northwind Setters",
];

const FOCUS_STAT_MAP: Record<string, string> = {
  Attack:      "power",
  Defence:     "defense",
  Serving:     "serve",
  Blocking:    "block",
  Athleticism: "speed",
};

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
  }
}
