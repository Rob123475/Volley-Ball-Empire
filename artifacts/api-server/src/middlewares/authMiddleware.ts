import { type Request, type Response, type NextFunction } from "express";
import {
  getSessionId,
  getSession,
  updateSession,
  clearSession,
  type SessionData,
  type LocalProfile,
} from "../lib/auth";
import { db, careerSavesTable, usersTable } from "@workspace/db";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends LocalProfile {}
    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
      activeTeamId?: number;
      activeCareerSaveId?: number;
    }
    export interface AuthedRequest {
      user: User;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  const session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Verify the profile still exists before trusting the session
  const [profileExists] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
    .limit(1);

  if (!profileExists) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = session.user;
  if (session.activeTeamId) req.activeTeamId = session.activeTeamId;
  if (session.activeCareerSaveId) req.activeCareerSaveId = session.activeCareerSaveId;

  // Session restore: if no active career in session, look up the DB once per
  // session. Protects returning players whose sid cookie is a fresh session
  // (e.g. cookie cleared, new machine) but who already have a career going.
  if (!session.activeTeamId && !session.careerSessionRestored) {
    try {
      // L-02e: the newest career that has not ended, WITH OR WITHOUT a club.
      //
      // This used to require a club (`isNotNull(teamId)`), which was true of
      // every live career until a club could be sold out from under a manager.
      // After a sale the career is alive and clubless on purpose, so requiring
      // a club skipped it — and a player with a second career would have been
      // dropped silently into that one instead of into the job market, with
      // the sold career stranded.
      const [latestSave] = await db
        .select({
          id: careerSavesTable.id,
          teamId: careerSavesTable.teamId,
          seekingClubSince: careerSavesTable.seekingClubSince,
        })
        .from(careerSavesTable)
        .where(and(
          eq(careerSavesTable.userId, session.user.id),
          isNull(careerSavesTable.retiredAt),
        ))
        .orderBy(desc(careerSavesTable.lastPlayedAt))
        .limit(1);
      if (!latestSave?.teamId && latestSave?.seekingClubSince) {
        // Between clubs: the career is restored, the club is not, and every
        // club route keeps saying "no team" until one is taken.
        const restored: SessionData = {
          ...session,
          activeCareerSaveId: latestSave.id,
          careerSessionRestored: true,
        };
        await updateSession(sid, restored);
        req.activeCareerSaveId = latestSave.id;
      } else if (latestSave?.teamId) {
        const restored: SessionData = {
          ...session,
          activeTeamId: latestSave.teamId,
          activeCareerSaveId: latestSave.id,
          careerSessionRestored: true,
        };
        await updateSession(sid, restored);
        req.activeTeamId = latestSave.teamId;
        req.activeCareerSaveId = latestSave.id;
      } else {
        // Mark so we don't query DB on every subsequent request for this session.
        await updateSession(sid, { ...session, careerSessionRestored: true });
      }
    } catch {
      // Non-fatal — continue without restoration.
    }
  }
  next();
}