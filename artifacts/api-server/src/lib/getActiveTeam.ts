import { db, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

/**
 * Returns the team for the current request.
 * If the session has an active career loaded, that career's team is returned.
 * Otherwise falls back to the first team belonging to the authenticated user.
 */
export const getActiveTeam = async (req: Request) => {
  if (req.activeTeamId) {
    return db.query.teamsTable.findFirst({ where: eq(teamsTable.id, req.activeTeamId) });
  }
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, req.user!.id) });
};
