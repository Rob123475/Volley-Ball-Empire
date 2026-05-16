import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/leaderboard", async (req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(desc(teamsTable.wins)).limit(50);
  const entries = await Promise.all(teams.map(async (team, idx) => {
    const user = await db.query.usersTable.findFirst({ where: eq(usersTable.id, team.userId) });
    return {
      rank: idx + 1,
      teamId: team.id,
      teamName: team.name,
      userId: team.userId,
      username: user?.firstName || user?.email || "Unknown",
      wins: team.wins,
      losses: team.losses,
      earnings: Number(team.budget),
      reputation: team.reputation,
    };
  }));
  res.json(entries);
});

export default router;
