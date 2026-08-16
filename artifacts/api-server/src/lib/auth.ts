import crypto from "crypto";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Local desktop auth ───────────────────────────────────────────────────────
// Replaces the old Replit-OIDC login. There is no external identity provider:
// a "profile" is just a row in usersTable, picked from a local list at
// startup. Session storage (sessionsTable + "sid" cookie) is unchanged from
// before — that part was already well designed — only the identity/token
// fields go away, since there's no OIDC token to refresh anymore.
//
// NOTE: the old code imported a type called `AuthUser` from @workspace/api-zod
// and used it for SessionData.user — but that generated type is actually the
// *API response DTO* shape ({id, username, profileImage, hasProfile}), not
// the raw DB row shape ({id, email, firstName, lastName, profileImageUrl})
// this field was actually ever assigned at runtime. It only "worked" because
// the build doesn't type-check strictly. LocalProfile below is the real,
// honest shape.

export interface LocalProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
}

export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 365 * 24 * 60 * 60 * 1000; // 1 year — local single-player, no reason to expire

export interface SessionData {
  user: LocalProfile;
  activeTeamId?: number;
  activeCareerSaveId?: number;
  careerSessionRestored?: boolean;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  await db.insert(sessionsTable).values({
    sid,
    sess: data as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

export async function clearSession(
  res: Response,
  sid?: string,
): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}

// The desktop app is always served over plain http://localhost:<port> — never
// HTTPS — so `secure: true` (required for the old Replit-OIDC cookie) would
// cause Chromium to silently drop the cookie, which is exactly what was
// breaking "Start Career" always bouncing back to the title screen.
export function setSessionCookie(res: Response, sid: string): void {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}
