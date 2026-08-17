import { Router } from "express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// Generate a deterministic 6-digit save PIN from the userId
const makeSavePin = (userId: string) => {
  const n = Math.abs(userId.split("").reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0));
  return String(n % 900000 + 100000); // always 6 digits
};

const serialize = (p: any) => ({
  ...p,
  totalEarnings: Number(p.totalEarnings),
  savePin: p.savePin ?? makeSavePin(p.userId),
  coachName: p.coachName ?? null,
});

router.get("/profile", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const profile = await db.query.userProfilesTable.findFirst({
    where: eq(userProfilesTable.userId, req.user.id),
  });
  if (!profile) { res.status(404).json({ error: "Profile not found" }); return; }

  // Auto-seed save PIN on first fetch if missing
  if (!profile.savePin) {
    const pin = makeSavePin(req.user.id);
    await db.update(userProfilesTable)
      .set({ savePin: pin })
      .where(eq(userProfilesTable.userId, req.user.id));
    res.json(serialize({ ...profile, savePin: pin }));
    return;
  }

  res.json(serialize(profile));
});

router.post("/profile", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { teamName, coachName } = req.body;
  const savePin = makeSavePin(req.user.id);
  const [profile] = await db.insert(userProfilesTable).values({
    userId: req.user.id,
    teamName,
    savePin,
    coachName: coachName ?? null,
  }).returning();
  res.status(201).json(serialize(profile));
});

router.patch("/profile", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { teamName, coachName, savePin } = req.body;
  const updates: Partial<typeof userProfilesTable.$inferInsert> = {};
  if (teamName  !== undefined) updates.teamName  = teamName;
  if (coachName !== undefined) updates.coachName = coachName;
  if (savePin   !== undefined) updates.savePin   = savePin;
  const [profile] = await db.update(userProfilesTable)
    .set(updates)
    .where(eq(userProfilesTable.userId, req.user.id))
    .returning();
  res.json(serialize(profile));
});

export default router;
