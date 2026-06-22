import { Router } from "express";
import { db, teamsTable, achievementsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ACHIEVEMENT_DEFS } from "../utils/achievement-definitions";
import { getCareerStats } from "../utils/check-achievements";

const getTeamForUser = (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

const router = Router();

router.get("/achievements", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const unlocked = await db
    .select()
    .from(achievementsTable)
    .where(eq(achievementsTable.teamId, team.id));

  const unlockedMap = new Map(unlocked.map((a) => [a.achievementKey, a]));
  const stats = getCareerStats(team.careerStats);

  const result = ACHIEVEMENT_DEFS.map((def) => {
    const record = unlockedMap.get(def.key);
    const prog = def.progress(team, stats);
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      category: def.category,
      unlocked: !!record,
      unlockedAt: record?.unlockedAt?.toISOString() ?? null,
      seasonUnlocked: record?.seasonUnlocked ?? null,
      progress: prog,
    };
  });

  res.json(result);
});

router.get("/achievements/career-stats", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }

  const team = await db.query.teamsTable.findFirst({
    where: eq(teamsTable.userId, req.user.id),
  });
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  res.json(getCareerStats(team.careerStats));
});

export default router;
