import { db, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

/**
 * Returns the team for the current request's active career, or null.
 *
 * R-20: this used to fall back to "the most recently created team belonging
 * to the authenticated user" whenever `req.activeTeamId` was unset. A profile
 * with more than one career (e.g. one retired, one active) has more than one
 * team, and "most recently created" is not "the one you have open" — it
 * silently served one career's data (wrong round, wrong ladder, wrong
 * manager name) under another career's session. authMiddleware already
 * restores `req.activeTeamId` from the session, or from the DB once per
 * session if the cookie is fresh, so a request that still has no
 * activeTeamId genuinely has no active career: every caller already checks
 * for `null` and 404s, which is the correct behaviour, not a fallback guess.
 */
export const getActiveTeam = async (req: Request) => {
  if (!req.activeTeamId) return null;
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.id, req.activeTeamId) });
};
