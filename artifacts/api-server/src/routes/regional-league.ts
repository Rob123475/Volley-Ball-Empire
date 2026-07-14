import { Router } from "express";
import { db } from "@workspace/db";
import {
  continentalPoolTeamsTable,
  continentalPoolPlayersTable,
  regionalLeagueSeasonsTable,
  regionalLeagueFixturesTable,
  regionalLeagueResultsTable,
  worldTourQualificationsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { generateDoubleRoundRobin } from "../utils/fixtures.js";
import {
  computeLadder,
  resolveRegionalSeason,
} from "../utils/regionalSeason.js";

const router = Router();

export const CONTINENTS = [
  "Europe",
  "Asia",
  "North America",
  "South America",
  "Africa and Middle East",
  "Australia and Pacific Islands",
] as const;

export type Continent = (typeof CONTINENTS)[number];

// ── GET /regional-league/pool-teams ──────────────────────────────────────────
// All continental pool teams with their players
router.get("/regional-league/pool-teams", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const teams = await db
    .select()
    .from(continentalPoolTeamsTable)
    .orderBy(
      continentalPoolTeamsTable.continent,
      continentalPoolTeamsTable.seededIndex,
    );

  const players = await db.select().from(continentalPoolPlayersTable);

  const playersByTeam = new Map<number, typeof players>();
  for (const p of players) {
    if (!playersByTeam.has(p.poolTeamId)) playersByTeam.set(p.poolTeamId, []);
    playersByTeam.get(p.poolTeamId)!.push(p);
  }

  res.json(
    teams.map((t) => ({
      ...t,
      players: playersByTeam.get(t.id) ?? [],
    })),
  );
});

// ── GET /regional-league/seasons ──────────────────────────────────────────────
// All regional league seasons for the active team
router.get("/regional-league/seasons", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const team = await getActiveTeam(req);
  if (!team) {
    res.json([]);
    return;
  }

  const seasons = await db
    .select()
    .from(regionalLeagueSeasonsTable)
    .where(eq(regionalLeagueSeasonsTable.teamId, team.id))
    .orderBy(
      regionalLeagueSeasonsTable.season,
      regionalLeagueSeasonsTable.continent,
    );

  res.json(seasons);
});

// ── POST /regional-league/seasons/init ───────────────────────────────────────
// Initialise all 6 continental seasons for the given game season number.
// Creates fixture lists — results are filled separately.
// Body: { season: number, continent?: string }
router.post("/regional-league/seasons/init", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const team = await getActiveTeam(req);
  if (!team) {
    res.status(404).json({ error: "No active team" });
    return;
  }

  const season = Number(req.body?.season ?? 1);
  const continentFilter = req.body?.continent as string | undefined;

  const targets = continentFilter
    ? CONTINENTS.filter((c) => c === continentFilter)
    : [...CONTINENTS];

  if (targets.length === 0) {
    res.status(400).json({ error: "Invalid continent" });
    return;
  }

  const created: Array<{ continent: string; seasonId: number; fixtures: number }> = [];

  for (const continent of targets) {
    // Skip if already initialised for this team+season+continent
    const [existing] = await db
      .select()
      .from(regionalLeagueSeasonsTable)
      .where(
        and(
          eq(regionalLeagueSeasonsTable.teamId, team.id),
          eq(regionalLeagueSeasonsTable.season, season),
          eq(regionalLeagueSeasonsTable.continent, continent),
        ),
      );
    if (existing) {
      created.push({ continent, seasonId: existing.id, fixtures: 0 });
      continue;
    }

    // Fetch active pool teams for this continent, ordered by seededIndex
    const poolTeams = await db
      .select()
      .from(continentalPoolTeamsTable)
      .where(
        and(
          eq(continentalPoolTeamsTable.continent, continent),
          eq(continentalPoolTeamsTable.tier, "active"),
        ),
      )
      .orderBy(continentalPoolTeamsTable.seededIndex);

    // We need exactly 6 active pool teams (user fills slot 0 if participating,
    // otherwise all 6 are AI teams).
    // For now the user's team is always participating; pick first 5 AI teams.
    const aiTeams = poolTeams.slice(0, 5);

    // Insert season record
    const [leagueSeason] = await db
      .insert(regionalLeagueSeasonsTable)
      .values({ continent, season, teamId: team.id, status: "active" })
      .returning();

    if (!leagueSeason) continue;

    // Generate fixture slots where index 0 = user, indices 1–5 = AI pool teams
    const slots = generateDoubleRoundRobin();

    const fixtureValues = slots.map((slot) => {
      const homeIsUser = slot.homeIdx === 0;
      const awayIsUser = slot.awayIdx === 0;
      const homeTeam = homeIsUser ? null : (aiTeams[slot.homeIdx - 1] ?? null);
      const awayTeam = awayIsUser ? null : (aiTeams[slot.awayIdx - 1] ?? null);
      return {
        seasonId: leagueSeason.id,
        round: slot.round,
        homePoolTeamId: homeTeam?.id ?? null,
        awayPoolTeamId: awayTeam?.id ?? null,
        homeIsUser,
        awayIsUser,
        status: "scheduled" as const,
      };
    });

    await db.insert(regionalLeagueFixturesTable).values(fixtureValues);

    created.push({
      continent,
      seasonId: leagueSeason.id,
      fixtures: fixtureValues.length,
    });
  }

  res.status(201).json({ ok: true, created });
});

// ── GET /regional-league/seasons/:seasonId/fixtures ───────────────────────────
router.get("/regional-league/seasons/:seasonId/fixtures", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const seasonId = parseInt(req.params.seasonId, 10);
  if (isNaN(seasonId)) {
    res.status(400).json({ error: "Invalid seasonId" });
    return;
  }

  const team = await getActiveTeam(req);
  if (!team) {
    res.status(404).json({ error: "No active team" });
    return;
  }

  // Verify this season belongs to the team
  const [season] = await db
    .select()
    .from(regionalLeagueSeasonsTable)
    .where(
      and(
        eq(regionalLeagueSeasonsTable.id, seasonId),
        eq(regionalLeagueSeasonsTable.teamId, team.id),
      ),
    );
  if (!season) {
    res.status(404).json({ error: "Season not found" });
    return;
  }

  const fixtures = await db
    .select()
    .from(regionalLeagueFixturesTable)
    .where(eq(regionalLeagueFixturesTable.seasonId, seasonId))
    .orderBy(regionalLeagueFixturesTable.round);

  const completedFixtures = fixtures.filter((f) => f.status === "completed");
  const resultIds = completedFixtures.map((f) => f.id);
  const results =
    resultIds.length > 0
      ? await db
          .select()
          .from(regionalLeagueResultsTable)
          .where(inArray(regionalLeagueResultsTable.fixtureId, resultIds))
      : [];

  const resultMap = new Map(results.map((r) => [r.fixtureId, r]));

  res.json(
    fixtures.map((f) => ({
      ...f,
      result: resultMap.get(f.id) ?? null,
    })),
  );
});

// ── POST /regional-league/seasons/:seasonId/fixtures/:fixtureId/result ───────
// Submit a result for a fixture (AI-vs-AI or user-involved)
// Body: { homeSetWins, awaySetWins, homeMatchPoints, awayMatchPoints }
router.post(
  "/regional-league/seasons/:seasonId/fixtures/:fixtureId/result",
  async (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const seasonId = parseInt(req.params.seasonId, 10);
    const fixtureId = parseInt(req.params.fixtureId, 10);
    if (isNaN(seasonId) || isNaN(fixtureId)) {
      res.status(400).json({ error: "Invalid params" });
      return;
    }

    const team = await getActiveTeam(req);
    if (!team) {
      res.status(404).json({ error: "No active team" });
      return;
    }

    const [season] = await db
      .select()
      .from(regionalLeagueSeasonsTable)
      .where(
        and(
          eq(regionalLeagueSeasonsTable.id, seasonId),
          eq(regionalLeagueSeasonsTable.teamId, team.id),
        ),
      );
    if (!season) {
      res.status(404).json({ error: "Season not found" });
      return;
    }

    const [fixture] = await db
      .select()
      .from(regionalLeagueFixturesTable)
      .where(
        and(
          eq(regionalLeagueFixturesTable.id, fixtureId),
          eq(regionalLeagueFixturesTable.seasonId, seasonId),
        ),
      );
    if (!fixture) {
      res.status(404).json({ error: "Fixture not found" });
      return;
    }
    if (fixture.status === "completed") {
      res.status(409).json({ error: "Fixture already completed" });
      return;
    }

    const { homeSetWins, awaySetWins, homeMatchPoints, awayMatchPoints } =
      req.body as {
        homeSetWins: number;
        awaySetWins: number;
        homeMatchPoints: number;
        awayMatchPoints: number;
      };

    if (
      typeof homeSetWins !== "number" ||
      typeof awaySetWins !== "number" ||
      typeof homeMatchPoints !== "number" ||
      typeof awayMatchPoints !== "number"
    ) {
      res.status(400).json({ error: "Invalid result body" });
      return;
    }

    const [result] = await db
      .insert(regionalLeagueResultsTable)
      .values({ fixtureId, homeSetWins, awaySetWins, homeMatchPoints, awayMatchPoints })
      .returning();

    await db
      .update(regionalLeagueFixturesTable)
      .set({ status: "completed" })
      .where(eq(regionalLeagueFixturesTable.id, fixtureId));

    res.status(201).json({ ok: true, result });
  },
);

// ── GET /regional-league/seasons/:seasonId/ladder ─────────────────────────────
router.get("/regional-league/seasons/:seasonId/ladder", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const seasonId = parseInt(req.params.seasonId, 10);
  if (isNaN(seasonId)) {
    res.status(400).json({ error: "Invalid seasonId" });
    return;
  }

  const team = await getActiveTeam(req);
  if (!team) {
    res.status(404).json({ error: "No active team" });
    return;
  }

  const [season] = await db
    .select()
    .from(regionalLeagueSeasonsTable)
    .where(
      and(
        eq(regionalLeagueSeasonsTable.id, seasonId),
        eq(regionalLeagueSeasonsTable.teamId, team.id),
      ),
    );
  if (!season) {
    res.status(404).json({ error: "Season not found" });
    return;
  }

  const ladder = await computeLadder(seasonId);

  // Enrich with pool team names
  const poolIds = ladder
    .filter((e) => e.poolTeamId != null)
    .map((e) => e.poolTeamId!);

  const poolTeams =
    poolIds.length > 0
      ? await db
          .select()
          .from(continentalPoolTeamsTable)
          .where(inArray(continentalPoolTeamsTable.id, poolIds))
      : [];

  const nameMap = new Map(poolTeams.map((t) => [t.id, t.name]));

  res.json(
    ladder.map((entry, idx) => ({
      position: idx + 1,
      name: entry.isUser ? team.name : (nameMap.get(entry.poolTeamId!) ?? "Unknown"),
      isUser: entry.isUser,
      poolTeamId: entry.poolTeamId,
      played: entry.played,
      wins: entry.wins,
      losses: entry.losses,
      points: entry.points,
      setDiff: entry.setDiff,
      matchPointDiff: entry.matchPointDiff,
    })),
  );
});

// ── POST /regional-league/seasons/:seasonId/resolve ───────────────────────────
// Resolve the season: insert qualification records, handle relegation/promotion
router.post(
  "/regional-league/seasons/:seasonId/resolve",
  async (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const seasonId = parseInt(req.params.seasonId, 10);
    if (isNaN(seasonId)) {
      res.status(400).json({ error: "Invalid seasonId" });
      return;
    }

    const team = await getActiveTeam(req);
    if (!team) {
      res.status(404).json({ error: "No active team" });
      return;
    }

    const [season] = await db
      .select()
      .from(regionalLeagueSeasonsTable)
      .where(
        and(
          eq(regionalLeagueSeasonsTable.id, seasonId),
          eq(regionalLeagueSeasonsTable.teamId, team.id),
        ),
      );
    if (!season) {
      res.status(404).json({ error: "Season not found" });
      return;
    }
    if (season.status === "completed") {
      res.status(409).json({ error: "Season already resolved" });
      return;
    }

    await resolveRegionalSeason(seasonId);

    const qualifications = await db
      .select()
      .from(worldTourQualificationsTable)
      .where(eq(worldTourQualificationsTable.seasonId, seasonId));

    res.json({ ok: true, qualifications });
  },
);

// ── GET /regional-league/seasons/:seasonId/qualifications ────────────────────
router.get(
  "/regional-league/seasons/:seasonId/qualifications",
  async (req, res) => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const seasonId = parseInt(req.params.seasonId, 10);
    if (isNaN(seasonId)) {
      res.status(400).json({ error: "Invalid seasonId" });
      return;
    }

    const qualifications = await db
      .select()
      .from(worldTourQualificationsTable)
      .where(eq(worldTourQualificationsTable.seasonId, seasonId))
      .orderBy(worldTourQualificationsTable.position);

    res.json(qualifications);
  },
);

export default router;
