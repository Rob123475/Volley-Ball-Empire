import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getSessionId,
  getSession,
  createSession,
  clearSession,
  setSessionCookie,
  type SessionData,
} from "../lib/auth";
import { deleteProfileCascade } from "../utils/deleteProfile";

const router: IRouter = Router();

// ── GET /auth/user — unchanged response shape, so the frontend doesn't care
//    whether the profile came from Replit OIDC or a local picker ────────────
router.get("/auth/user", (req: Request, res: Response) => {
  if (!req.isAuthenticated() || !req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const user = req.user;
  res.json(
    GetCurrentAuthUserResponse.parse({
      id: user.id,
      username: user.firstName || user.email || user.id,
      profileImage: user.profileImageUrl ?? null,
      hasProfile: false,
    }),
  );
});

// ── GET /profiles — list local profiles to show on the picker screen ────────
router.get("/profiles", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      profileImageUrl: usersTable.profileImageUrl,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json({
    profiles: rows.map((r) => ({
      id: r.id,
      name: r.firstName || "Unnamed Manager",
      profileImage: r.profileImageUrl ?? null,
    })),
  });
});

// ── POST /profiles — create a new local profile ({ name }) ──────────────────
router.post("/profiles", async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  const trimmed = (name ?? "").trim();
  if (!trimmed) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (trimmed.length > 50) {
    res.status(400).json({ error: "name must be 50 characters or fewer" });
    return;
  }

  const [created] = await db
    .insert(usersTable)
    .values({ firstName: trimmed })
    .returning();

  res.status(201).json({
    id: created.id,
    name: created.firstName,
    profileImage: created.profileImageUrl ?? null,
  });
});

// ── POST /profiles/:id/select — activate a profile for this session ─────────
router.post("/profiles/:id/select", async (req: Request, res: Response) => {
  const id = String(req.params.id);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.json({ ok: true, id: user.id });
});

// ── DELETE /profiles/:id — remove a local profile ────────────────────────────
// Deletes the profile and everything it owns. Leaving the dependent rows
// behind is not an option: every user_id column is NOT NULL, so with foreign
// keys enforced the bare users-row delete failed for any profile that had
// ever started a career. See utils/deleteProfile.ts.
router.delete("/profiles/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "Profile not found" }); return; }

  try {
    deleteProfileCascade(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log?.error({ err, profileId: id }, "DELETE /profiles/:id failed");
    res.status(500).json({ error: `Could not delete profile: ${message}` });
    return;
  }

  // If the deleted profile was the one signed in, drop the session too.
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session?.user?.id === id) await clearSession(res, sid);
  }

  res.json({ ok: true });
});

// ── GET /logout — clear the session and go home ─────────────────────────────
router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

export default router;
