import * as oidc from "openid-client";
import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  getSession,
  updateSession,
  type SessionData,
} from "../lib/auth";
import { db, careerSavesTable } from "@workspace/db";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends AuthUser {}

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

async function refreshIfExpired(
  sid: string,
  session: SessionData,
): Promise<SessionData | null> {
  const now = Math.floor(Date.now() / 1000);
  if (!session.expires_at || now <= session.expires_at) return session;

  if (!session.refresh_token) return null;

  try {
    const config = await getOidcConfig();
    const tokens = await oidc.refreshTokenGrant(
      config,
      session.refresh_token,
    );
    session.access_token = tokens.access_token;
    session.refresh_token = tokens.refresh_token ?? session.refresh_token;
    session.expires_at = tokens.expiresIn()
      ? now + tokens.expiresIn()!
      : session.expires_at;
    await updateSession(sid, session);
    return session;
  } catch {
    return null;
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

  const refreshed = await refreshIfExpired(sid, session);
  if (!refreshed) {
    await clearSession(res, sid);
    next();
    return;
  }

  req.user = refreshed.user;
  if (refreshed.activeTeamId)       req.activeTeamId       = refreshed.activeTeamId;
  if (refreshed.activeCareerSaveId) req.activeCareerSaveId = refreshed.activeCareerSaveId;

  // Session restore: if no active career in session, look up the DB once per session.
  // Protects returning users whose SID cookie expired or who re-logged via OIDC.
  if (!refreshed.activeTeamId && !refreshed.careerSessionRestored) {
    try {
      const [latestSave] = await db
        .select({ id: careerSavesTable.id, teamId: careerSavesTable.teamId })
        .from(careerSavesTable)
        .where(and(
          eq(careerSavesTable.userId, refreshed.user.id),
          isNotNull(careerSavesTable.teamId),
          isNull(careerSavesTable.retiredAt),
        ))
        .orderBy(desc(careerSavesTable.lastPlayedAt))
        .limit(1);

      if (latestSave?.teamId) {
        const restored: SessionData = {
          ...refreshed,
          activeTeamId:          latestSave.teamId,
          activeCareerSaveId:    latestSave.id,
          careerSessionRestored: true,
        };
        await updateSession(sid, restored);
        req.activeTeamId       = latestSave.teamId;
        req.activeCareerSaveId = latestSave.id;
      } else {
        // Mark so we don't query DB on every subsequent request for this session.
        await updateSession(sid, { ...refreshed, careerSessionRestored: true });
      }
    } catch {
      // Non-fatal — continue without restoration.
    }
  }

  next();
}
