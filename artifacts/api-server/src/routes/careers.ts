import { Router } from "express";
import { db } from "@workspace/db";
import {
  careerSavesTable,
  teamsTable,
  trophiesTable,
  achievementsTable,
  hallOfFameTable,
  careerHistoryEntriesTable,
  seasonsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";
import { seedCareerState } from "../utils/migrateCareerState.js";
import { deleteCareerSave } from "../utils/deleteCareerSave.js";

const router = Router();

// ── Helper: compute career summary from active team ────────────────────────────

async function buildCareerSummary(teamId: number, userId: string) {
  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(and(eq(careerSavesTable.teamId, teamId), eq(careerSavesTable.userId, userId)));

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));

  const trophies = await db.select().from(trophiesTable).where(eq(trophiesTable.teamId, teamId));
  const unlocked = await db.select().from(achievementsTable).where(eq(achievementsTable.teamId, teamId));

  const worldTitles  = trophies.filter(t => t.type === "world_championship").length;
  const olympicMedals = trophies.filter(t => ["olympic_gold", "olympic_silver", "olympic_bronze"].includes(t.type)).length;

  const TOTAL_ACHIEVEMENTS = 25;

  return {
    managerName:          save?.managerName ?? "Unknown",
    // The wizard collects a nationality and the API stores it, but nothing
    // ever sent it back, so the profile page hardcoded "Not set".
    managerNationality:   save?.managerNationality ?? null,
    clubName:             save?.clubName    ?? "Unknown",
    season:               save?.season      ?? "Season 1",
    worldRanking:         save?.worldRanking ?? null,
    worldTitles,
    olympicMedals,
    achievementsCompleted: unlocked.length,
    totalAchievements:    TOTAL_ACHIEVEMENTS,
    totalWins:            team?.wins   ?? 0,
    totalLosses:          team?.losses ?? 0,
    managerReputation:    save?.managerReputation ?? 50,
  };
}

// GET /careers — list save slots for current user
router.get("/careers", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      id:                careerSavesTable.id,
      teamId:            careerSavesTable.teamId,
      slotNumber:        careerSavesTable.slotNumber,
      managerName:       careerSavesTable.managerName,
      clubName:          careerSavesTable.clubName,
      originalClubName:  careerSavesTable.originalClubName,
      season:            careerSavesTable.season,
      worldRanking:      careerSavesTable.worldRanking,
      budget:            careerSavesTable.budget,
      managerReputation: careerSavesTable.managerReputation,
      retiredAt:         careerSavesTable.retiredAt,
      lastPlayedAt:      careerSavesTable.lastPlayedAt,
      createdAt:         careerSavesTable.createdAt,
      primaryColor:      teamsTable.logoColor,
      secondaryColor:    teamsTable.secondaryLogoColor,
      crestShapeIndex:   teamsTable.crestShapeIndex,
    })
    .from(careerSavesTable)
    .leftJoin(teamsTable, eq(teamsTable.id, careerSavesTable.teamId))
    .where(eq(careerSavesTable.userId, req.user.id))
    .orderBy(careerSavesTable.slotNumber);

  const activeTeamId       = req.activeTeamId ?? null;
  const activeCareerSaveId = req.activeCareerSaveId ?? null;

  const activeSave = activeCareerSaveId
    ? rows.find(s => s.id === activeCareerSaveId)
    : activeTeamId ? rows.find(s => s.teamId === activeTeamId) : null;

  res.json({
    saves: rows.map(s => ({
      id:                s.id,
      teamId:            s.teamId ?? null,
      slotNumber:        s.slotNumber,
      managerName:       s.managerName,
      clubName:          s.clubName,
      originalClubName:  s.originalClubName ?? null,
      season:            s.season,
      worldRanking:      s.worldRanking,
      budget:            s.budget,
      managerReputation: s.managerReputation ?? 50,
      primaryColor:      s.primaryColor ?? null,
      secondaryColor:    s.secondaryColor ?? null,
      crestShapeIndex:   s.crestShapeIndex ?? null,
      retiredAt:         s.retiredAt ? s.retiredAt.toISOString() : null,
      lastPlayedAt:      s.lastPlayedAt.toISOString(),
      createdAt:         s.createdAt.toISOString(),
    })),
    activeCareerSaveId: activeSave?.id ?? null,
  });
});

// GET /careers/summary — end-career stats for the active career
router.get("/careers/summary", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const teamId = req.activeTeamId;
  if (!teamId)   { res.status(404).json({ error: "No active career" }); return; }

  const summary = await buildCareerSummary(teamId, req.user.id);
  res.json(summary);
});

// POST /careers — create or overwrite a slot
router.post("/careers", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { slotNumber, managerName, managerNationality, clubName, originalClubName, season, worldRanking, budget, locationId, primaryColor, secondaryColor, crestShapeIndex } = req.body as {
    slotNumber:           number;
    managerName:          string;
    managerNationality?:  string | null;
    clubName:             string;
    originalClubName?:    string | null;
    season?:              string;
    worldRanking?:        number | null;
    budget?:              number | null;
    locationId?:          number | null;
    primaryColor?:        string | null;
    secondaryColor?:      string | null;
    crestShapeIndex?:     number | null;
  };

  if (
    typeof slotNumber !== "number" || slotNumber < 1 || slotNumber > 3 ||
    typeof managerName !== "string" || managerName.trim().length === 0 ||
    typeof clubName !== "string"    || clubName.trim().length === 0
  ) {
    res.status(400).json({ error: "Invalid body" }); return;
  }

  const [existing] = await db
    .select()
    .from(careerSavesTable)
    .where(and(
      eq(careerSavesTable.userId,     req.user.id),
      eq(careerSavesTable.slotNumber, slotNumber),
    ));

  if (existing) {
    // Overwriting a slot must only remove save-slot-owned data, the same
    // scope as DELETE /careers/:id below — deleteCareerSave is the one place
    // that knows every table with a non-cascading FK to career_saves. The old
    // team is GLOBAL world data (referenced by 25 other tables) and must NOT
    // be deleted — it's left orphaned, same as DELETE /careers/:id does.
    try {
      deleteCareerSave(existing.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      req.log.error({ err, saveId: existing.id, userId: req.user.id }, "POST /careers overwrite failed");
      res.status(500).json({ error: `Database error while overwriting save slot: ${message}` });
      return;
    }
  }

  // Seasons are global (shared across every save/team), not per-career, so
  // this only creates one the very first time any career is started. Without
  // it, nothing ever populates seasonsTable — /api/calendar, the annual
  // calendar, and getOrCreateCalendar() all depend on an active season and
  // silently fail/return empty without one. Bounds are chosen so the
  // existing hardcoded World Tour match dates (worldTour.ts) land exactly
  // where the linear round→date interpolation in calendar.ts expects them
  // (round 11 → 2026-02-17, round 72 → 2026-12-02).

  const [newTeam] = await db
    .insert(teamsTable)
    .values({
      userId:             req.user.id,
      name:               clubName.trim(),
      budget:             budget ?? 500000,
      reputation:         50,
      ...(locationId   ? { locationId }                   : {}),
      ...(primaryColor ? { logoColor: primaryColor }      : {}),
      ...(secondaryColor ? { secondaryLogoColor: secondaryColor } : {}),
      ...(crestShapeIndex != null ? { crestShapeIndex } : {}),
    })
    .returning();

  const [inserted] = await db
    .insert(careerSavesTable)
    .values({
      userId:              req.user.id,
      teamId:              newTeam.id,
      slotNumber,
      managerName:         managerName.trim(),
      managerNationality:  managerNationality?.trim() ?? null,
      clubName:            clubName.trim(),
      originalClubName:    originalClubName?.trim() ?? null,
      season:              season ?? "Season 1",
      worldRanking:        worldRanking ?? null,
      budget:              budget ?? null,
      lastPlayedAt:        new Date(),
    })
    .returning();

  // Per-career player and staff state. Without this a new career has no rows in
  // career_player_state, so its transfer market is empty and nothing can be
  // signed — players are global reference data and the career half must exist.
  seedCareerState(inserted!.id);

  // This career's own season timeline. Previously one global season row was
  // created on the first career and every later career reused it, so a second
  // career inherited the first one's currentRound and could start mid-season or
  // immediately at season end. Multiple careers per install is a shipped
  // feature, so that was a live bug, not just a harness artifact.
  //
  // Bounds are chosen so the hardcoded World Tour dates (worldTour.ts) land
  // where calendar.ts's round->date interpolation expects them
  // (round 11 -> 2026-02-17, round 72 -> 2026-12-02).
  await db.insert(seasonsTable).values({
    careerSaveId:            inserted!.id,
    year:                    2026,
    name:                    "Season 1",
    status:                  "active",
    totalRounds:             78,
    currentRound:            1,
    startDate:               "2026-01-01",
    endDate:                 "2026-12-31",
    isOlympicSeason:         false,
    regionalRoundsProcessed: 0,
  });

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) await updateSession(sid, { ...session, activeTeamId: newTeam.id, activeCareerSaveId: inserted.id });
  }

  res.json({
    id:               inserted.id,
    teamId:           inserted.teamId ?? null,
    slotNumber:       inserted.slotNumber,
    managerName:      inserted.managerName,
    clubName:         inserted.clubName,
    originalClubName: inserted.originalClubName ?? null,
    season:           inserted.season,
    worldRanking:     inserted.worldRanking,
    budget:           inserted.budget,
    lastPlayedAt:     inserted.lastPlayedAt.toISOString(),
    createdAt:        inserted.createdAt.toISOString(),
  });
});

// POST /careers/end — retire career, archive to Hall of Fame, clear session
router.post("/careers/end", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const teamId = req.activeTeamId;

  if (teamId) {
    // Build summary and save to Hall of Fame before clearing
    const summary = await buildCareerSummary(teamId, req.user.id);
    await db.insert(hallOfFameTable).values({
      userId:               req.user.id,
      managerName:          summary.managerName,
      clubName:             summary.clubName,
      season:               summary.season,
      worldRanking:         summary.worldRanking ?? null,
      worldTitles:          summary.worldTitles,
      olympicMedals:        summary.olympicMedals,
      achievementsCompleted: summary.achievementsCompleted,
      totalWins:            summary.totalWins,
      totalLosses:          summary.totalLosses,
    });

    // Find the active career save to write a retirement history entry
    const [activeSave] = await db
      .select()
      .from(careerSavesTable)
      .where(and(eq(careerSavesTable.teamId, teamId), eq(careerSavesTable.userId, req.user.id)));

    if (activeSave) {
      await db.insert(careerHistoryEntriesTable).values({
        userId:       req.user.id,
        careerSaveId: activeSave.id,
        type:         "retirement",
        clubName:     summary.clubName,
        season:       summary.season,
        description:  `${summary.managerName} retired after a career spanning ${summary.totalWins + summary.totalLosses} matches, ${summary.worldTitles} title${summary.worldTitles !== 1 ? "s" : ""}, and ${summary.olympicMedals} Olympic medal${summary.olympicMedals !== 1 ? "s" : ""}.`,
      });
    }
  }

  // Mark the career save as retired so session restore doesn't pick it back up
  if (teamId) {
    await db
      .update(careerSavesTable)
      .set({ retiredAt: new Date() })
      .where(and(eq(careerSavesTable.teamId, teamId), eq(careerSavesTable.userId, req.user.id)));
  }

  // Clear active career from session
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, activeCareerSaveId: __, careerSessionRestored: ___, ...rest } = session;
      await updateSession(sid, { ...rest, careerSessionRestored: true });
    }
  }

  res.json({ ok: true });
});

// POST /careers/quit — clear session without writing to Hall of Fame
router.post("/careers/quit", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Mark the career save as retired
  const teamId = req.activeTeamId;
  if (teamId) {
    await db
      .update(careerSavesTable)
      .set({ retiredAt: new Date() })
      .where(and(eq(careerSavesTable.teamId, teamId), eq(careerSavesTable.userId, req.user.id)));
  }

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, activeCareerSaveId: __, careerSessionRestored: ___, ...rest } = session;
      await updateSession(sid, { ...rest, careerSessionRestored: true });
    }
  }
  res.json({ ok: true });
});

// POST /careers/:id/load — activate a career save for this session
router.post("/careers/:id/load", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(and(
      eq(careerSavesTable.id,     id),
      eq(careerSavesTable.userId, req.user.id),
    ));

  if (!save)        { res.status(404).json({ error: "Not found" }); return; }
  if (!save.teamId) { res.status(400).json({ error: "Career has no team" }); return; }

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) await updateSession(sid, { ...session, activeTeamId: save.teamId, activeCareerSaveId: save.id });
  }

  await db
    .update(careerSavesTable)
    .set({ lastPlayedAt: new Date() })
    .where(eq(careerSavesTable.id, id));

  res.json({ ok: true, careerSaveId: save.id, teamId: save.teamId });
});

// DELETE /careers/:id
// Deletes only save-slot-owned data. Teams, players, and all other world
// data are global and must NOT be deleted.
router.delete("/careers/:id", async (req, res) => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized: no authenticated user" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid save slot id: must be a number" });
    return;
  }

  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(and(
      eq(careerSavesTable.id,     id),
      eq(careerSavesTable.userId, req.user.id),
    ));

  if (!save) {
    res.status(404).json({ error: `Save slot ${id} not found or does not belong to this user` });
    return;
  }

  req.log.info({ saveId: id, userId: req.user.id, slotNumber: save.slotNumber }, "DELETE /careers/:id — starting");

  try {
    // Teams, players, facilities, matches, finances, etc. are GLOBAL world
    // data and must not be touched — deleteCareerSave only removes rows that
    // reference this career save, then the career_saves row itself.
    deleteCareerSave(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err, saveId: id, userId: req.user.id }, "DELETE /careers/:id failed");
    res.status(500).json({ error: `Database error while deleting save slot: ${message}` });
    return;
  }

  req.log.info({ saveId: id }, "DELETE /careers/:id — success");

  // Clear session if this save's team was the active one
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session?.activeTeamId === save.teamId) {
      const { activeTeamId: _, ...rest } = session;
      await updateSession(sid, rest);
    }
  }

  res.json({ ok: true });
});

// ── Shared constant: release clause (matches frontend placeholder) ─────────────

// Quoted to the player before they commit — pages/manager-contract.tsx shows
// this figure as the release clause and on the confirm button. Keep the two in
// sync, or the game charges a price it did not quote.
const BREAK_CONTRACT_FEE = 25_000;

// ── POST /careers/apply-job — apply for a job market position ─────────────────

router.post("/careers/apply-job", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const {
    clubName, continent, country, city, competition,
    salary, transferBudget, clubReputation, requiredReputation, logoColor,
  } = req.body as {
    clubName:           string;
    continent:          string;
    country:            string;
    city:               string;
    competition:        string;
    salary:             number;
    transferBudget:     number;
    clubReputation:     number;
    requiredReputation: number;
    logoColor:          string;
  };

  if (!clubName || typeof requiredReputation !== "number") {
    res.status(400).json({ error: "Invalid body" }); return;
  }

  // Find the active career save: prefer session-tracked id, fall back to most recent
  const sid     = getSessionId(req);
  const session = sid ? await getSession(sid) : null;

  let save: typeof careerSavesTable.$inferSelect | undefined;

  if (session?.activeCareerSaveId) {
    const [found] = await db
      .select()
      .from(careerSavesTable)
      .where(and(
        eq(careerSavesTable.id,     session.activeCareerSaveId),
        eq(careerSavesTable.userId, req.user.id),
      ));
    save = found;
  }

  if (!save) {
    const saves = await db
      .select()
      .from(careerSavesTable)
      .where(eq(careerSavesTable.userId, req.user.id))
      .orderBy(desc(careerSavesTable.lastPlayedAt));
    save = saves[0];
  }

  if (!save) { res.status(404).json({ error: "Career save not found" }); return; }

  const currentReputation = save.managerReputation ?? 50;

  // Reputation check
  if (currentReputation < requiredReputation) {
    res.json({ accepted: false, required: requiredReputation, current: currentReputation });
    return;
  }

  // ── Accept: create a new team record for this club ────────────────────────
  const [newTeam] = await db
    .insert(teamsTable)
    .values({
      userId:     req.user.id,
      name:       clubName.trim(),
      budget:     transferBudget,
      reputation: clubReputation,
      logoColor:  logoColor ?? null,
    })
    .returning();

  // Link career save to new team, update club name and manager reputation
  await db
    .update(careerSavesTable)
    .set({
      teamId:            newTeam.id,
      clubName:          clubName.trim(),
      managerReputation: clubReputation,
      lastPlayedAt:      new Date(),
    })
    .where(eq(careerSavesTable.id, save.id));

  // Career history: "Joined [club]"
  await db.insert(careerHistoryEntriesTable).values({
    userId:       req.user.id,
    careerSaveId: save.id,
    type:         "appointment",
    clubName:     clubName.trim(),
    season:       save.season,
    description:  `Joined ${clubName.trim()} as head coach`,
  });

  // Activate the new team in session
  if (sid && session) {
    await updateSession(sid, {
      ...session,
      activeTeamId:       newTeam.id,
      activeCareerSaveId: save.id,
    });
  }

  res.json({
    accepted:  true,
    teamId:    newTeam.id,
    clubName:  clubName.trim(),
    season:    save.season,
    current:   currentReputation,
    required:  requiredReputation,
  });
});

// ── GET /careers/history — career history entries for this user ────────────────

router.get("/careers/history", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const entries = await db
    .select()
    .from(careerHistoryEntriesTable)
    .where(eq(careerHistoryEntriesTable.userId, req.user.id))
    .orderBy(desc(careerHistoryEntriesTable.occurredAt));

  res.json(entries.map(e => ({
    id:          e.id,
    type:        e.type,
    clubName:    e.clubName,
    season:      e.season ?? null,
    description: e.description,
    occurredAt:  e.occurredAt.toISOString(),
  })));
});

// ── POST /careers/resign — leave current club voluntarily ─────────────────────

router.post("/careers/resign", async (req, res) => {
  if (!req.user?.id)   { res.status(401).json({ error: "Unauthorized" }); return; }

  const teamId = req.activeTeamId;
  if (!teamId) { res.status(400).json({ error: "No active career to resign from" }); return; }

  // Find the career save linked to this team
  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(and(
      eq(careerSavesTable.teamId,  teamId),
      eq(careerSavesTable.userId,  req.user.id),
    ));

  if (!save) { res.status(404).json({ error: "Career save not found" }); return; }

  const clubName = save.clubName;
  const season   = save.season;

  // Record career history entry
  await db.insert(careerHistoryEntriesTable).values({
    userId:       req.user.id,
    careerSaveId: save.id,
    type:         "resignation",
    clubName,
    season,
    description:  `Resigned from ${clubName}`,
  });

  // Disconnect career save from team (unemployed — team record stays intact)
  await db
    .update(careerSavesTable)
    .set({ teamId: null, lastPlayedAt: new Date() })
    .where(eq(careerSavesTable.id, save.id));

  // Clear session's active team
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, ...rest } = session;
      await updateSession(sid, rest);
    }
  }

  res.json({ ok: true, clubName });
});

// ── POST /careers/break-contract — exit early, pay release clause ─────────────

router.post("/careers/break-contract", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const teamId = req.activeTeamId;
  if (!teamId) { res.status(400).json({ error: "No active career" }); return; }

  // Find career save and team in parallel
  const [[save], [team]] = await Promise.all([
    db.select().from(careerSavesTable).where(and(
      eq(careerSavesTable.teamId,  teamId),
      eq(careerSavesTable.userId,  req.user.id),
    )),
    db.select().from(teamsTable).where(eq(teamsTable.id, teamId)),
  ]);

  if (!save) { res.status(404).json({ error: "Career save not found" }); return; }
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const clubName   = save.clubName;
  const season     = save.season;
  const oldBudget  = team.budget;
  const newBudget  = oldBudget - BREAK_CONTRACT_FEE;

  // Deduct release clause from team budget
  await db
    .update(teamsTable)
    .set({ budget: newBudget })
    .where(eq(teamsTable.id, teamId));

  // Record career history entry
  await db.insert(careerHistoryEntriesTable).values({
    userId:       req.user.id,
    careerSaveId: save.id,
    type:         "contract_break",
    clubName,
    season,
    description:  `Broke contract with ${clubName} (paid $${BREAK_CONTRACT_FEE.toLocaleString()} release clause)`,
  });

  // Disconnect career save from team
  await db
    .update(careerSavesTable)
    .set({ teamId: null, lastPlayedAt: new Date() })
    .where(eq(careerSavesTable.id, save.id));

  // Clear session
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, ...rest } = session;
      await updateSession(sid, rest);
    }
  }

  res.json({ ok: true, feePaid: BREAK_CONTRACT_FEE, newBudget: newBudget.toFixed(2), clubName });
});

export default router;
