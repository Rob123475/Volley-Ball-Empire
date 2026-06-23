import { Router } from "express";
import { db } from "@workspace/db";
import { careerSavesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// GET /careers — list save slots for current user
router.get("/careers", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const saves = await db
    .select()
    .from(careerSavesTable)
    .where(eq(careerSavesTable.userId, req.user.id))
    .orderBy(careerSavesTable.slotNumber);

  res.json({
    saves: saves.map(s => ({
      id:               s.id,
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

  // Delete any existing save in this slot for this user first
  await db
    .delete(careerSavesTable)
    .where(
      and(
        eq(careerSavesTable.userId,     req.user.id),
        eq(careerSavesTable.slotNumber, slotNumber),
      ),
    );

  const [inserted] = await db
    .insert(careerSavesTable)
    .values({
      userId:           req.user.id,
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

  res.json({
    id:               inserted.id,
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

// DELETE /careers/:id
router.delete("/careers/:id", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const deleted = await db
    .delete(careerSavesTable)
    .where(
      and(
        eq(careerSavesTable.id,     id),
        eq(careerSavesTable.userId, req.user.id),
      ),
    )
    .returning();

  if (deleted.length === 0) { res.status(404).json({ error: "Not found" }); return; }

  res.json({ ok: true });
});

export default router;
