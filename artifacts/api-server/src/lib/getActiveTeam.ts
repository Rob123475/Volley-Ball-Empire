import { db, teamsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import type { Request } from "express";

/**
 * Returns the team for the current request.
 * If the session has an active career loaded, that career's team is returned.
 * Otherwise falls back to the most recently created team belonging to the
 * authenticated user.
 */
export const getActiveTeam = async (req: Request) => {
  if (req.activeTeamId) {
    return db.query.teamsTable.findFirst({ where: eq(teamsTable.id, req.activeTeamId) });
  }

  if (!req.user?.id) return null;

  return db.query.teamsTable.findFirst({
    where: eq(teamsTable.userId, req.user.id),
    orderBy: desc(teamsTable.createdAt),
  });
};
