import { Router } from "express";
import { db } from "@workspace/db";
import { userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const profile = await db.query.userProfilesTable.findFirst({
    where: eq(userProfilesTable.userId, req.user.id),
  });
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json({ ...profile, totalEarnings: Number(profile.totalEarnings) });
});

router.post("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { teamName } = req.body;
  const [profile] = await db.insert(userProfilesTable).values({
    userId: req.user.id,
    teamName,
  }).returning();
  res.status(201).json({ ...profile, totalEarnings: Number(profile.totalEarnings) });
});

router.patch("/profile", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { teamName } = req.body;
  const [profile] = await db.update(userProfilesTable)
    .set({ teamName })
    .where(eq(userProfilesTable.userId, req.user.id))
    .returning();
  res.json({ ...profile, totalEarnings: Number(profile.totalEarnings) });
});

export default router;
