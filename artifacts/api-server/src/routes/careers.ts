import { Router } from "express";
import { db } from "@workspace/db";
import { careerSavesTable, teamsTable, trophiesTable, achievementsTable, hallOfFameTable, careerHistoryEntriesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";

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

  const saves = await db
    .select()
    .from(careerSavesTable)
    .where(eq(careerSavesTable.userId, req.user.id))
    .orderBy(careerSavesTable.slotNumber);

  const activeTeamId      = req.activeTeamId ?? null;
  const activeCareerSaveId = req.activeCareerSaveId ?? null;

  // Prefer session-tracked career save id; fall back to matching by activeTeamId
  const activeSave = activeCareerSaveId
    ? saves.find(s => s.id === activeCareerSaveId)
    : activeTeamId ? saves.find(s => s.teamId === activeTeamId) : null;

  res.json({
    saves: saves.map(s => ({
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

  const { slotNumber, managerName, clubName, originalClubName, season, worldRanking, budget, locationId, primaryColor, secondaryColor } = req.body as {
    slotNumber:        number;
    managerName:       string;
    clubName:          string;
    originalClubName?: string | null;
    season?:           string;
    worldRanking?:     number | null;
    budget?:           string | null;
    locationId?:       number | null;
    primaryColor?:     string | null;
    secondaryColor?:   string | null;
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
    await db.delete(careerSavesTable).where(eq(careerSavesTable.id, existing.id));
    if (existing.teamId) {
      await db.delete(teamsTable).where(eq(teamsTable.id, existing.teamId));
    }
  }

  const [newTeam] = await db
    .insert(teamsTable)
    .values({
      userId:             req.user.id,
      name:               clubName.trim(),
      budget:             budget ?? "500000",
      reputation:         50,
      ...(locationId   ? { locationId }                   : {}),
      ...(primaryColor ? { logoColor: primaryColor }      : {}),
      ...(secondaryColor ? { secondaryLogoColor: secondaryColor } : {}),
    })
    .returning();

  const [inserted] = await db
    .insert(careerSavesTable)
    .values({
      userId:           req.user.id,
      teamId:           newTeam.id,
      slotNumber,
      managerName:      managerName.trim(),
      clubName:         clubName.trim(),
      originalClubName: originalClubName?.trim() ?? null,
      season:           season ?? "Season 1",
      worldRanking:     worldRanking ?? null,
      budget:           budget ?? null,
      lastPlayedAt:     new Date(),
    })
    .returning();

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) await updateSession(sid, { ...session, activeTeamId: newTeam.id });
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

  // Clear active career from session
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, ...rest } = session;
      await updateSession(sid, rest);
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
router.delete("/careers/:id", async (req, res) => {
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

  if (!save) { res.status(404).json({ error: "Not found" }); return; }

  await db.delete(careerSavesTable).where(eq(careerSavesTable.id, id));

  if (save.teamId) {
    await db.delete(teamsTable).where(eq(teamsTable.id, save.teamId));
  }

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
      budget:     transferBudget.toFixed(2),
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
  const oldBudget  = parseFloat(team.budget ?? "0");
  const newBudget  = oldBudget - BREAK_CONTRACT_FEE;

  // Deduct release clause from team budget
  await db
    .update(teamsTable)
    .set({ budget: newBudget.toFixed(2) })
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
