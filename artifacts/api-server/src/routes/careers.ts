import { Router } from "express";
import { db } from "@workspace/db";
import { careerSavesTable, teamsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";

const router = Router();

// GET /careers — list save slots for current user
router.get("/careers", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const saves = await db
    .select()
    .from(careerSavesTable)
    .where(eq(careerSavesTable.userId, req.user.id))
    .orderBy(careerSavesTable.slotNumber);

  // Resolve which save (if any) is currently active in this session
  const activeTeamId = req.activeTeamId ?? null;
  const activeSave   = activeTeamId ? saves.find(s => s.teamId === activeTeamId) : null;

  res.json({
    saves: saves.map(s => ({
      id:               s.id,
      teamId:           s.teamId ?? null,
      slotNumber:       s.slotNumber,
      managerName:      s.managerName,
      clubName:         s.clubName,
      originalClubName: s.originalClubName ?? null,
      season:           s.season,
      worldRanking:     s.worldRanking,
      budget:           s.budget,
      lastPlayedAt:     s.lastPlayedAt.toISOString(),
      createdAt:        s.createdAt.toISOString(),
    })),
    activeCareerSaveId: activeSave?.id ?? null,
  });
});

// POST /careers — create or overwrite a slot
router.post("/careers", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { slotNumber, managerName, clubName, originalClubName, season, worldRanking, budget } = req.body as {
    slotNumber:        number;
    managerName:       string;
    clubName:          string;
    originalClubName?: string | null;
    season?:           string;
    worldRanking?:     number | null;
    budget?:           string | null;
  };

  if (
    typeof slotNumber !== "number" || slotNumber < 1 || slotNumber > 3 ||
    typeof managerName !== "string" || managerName.trim().length === 0 ||
    typeof clubName !== "string"    || clubName.trim().length === 0
  ) {
    res.status(400).json({ error: "Invalid body" }); return;
  }

  // Delete any existing save (and its team) in this slot for this user first
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

  // Create a fresh team for this career
  const [newTeam] = await db
    .insert(teamsTable)
    .values({
      userId:     req.user.id,
      name:       clubName.trim(),
      budget:     budget ?? "500000",
      reputation: 50,
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

  // Automatically activate this new career in the session
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

// POST /careers/end — clear active career from session (does NOT delete the save)
router.post("/careers/end", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

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

  // Update session with the active team
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) await updateSession(sid, { ...session, activeTeamId: save.teamId });
  }

  // Update lastPlayedAt
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

  // Delete the associated team (cascades to all game data)
  if (save.teamId) {
    await db.delete(teamsTable).where(eq(teamsTable.id, save.teamId));
  }

  // If this was the active career, clear it from session
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

export default router;
