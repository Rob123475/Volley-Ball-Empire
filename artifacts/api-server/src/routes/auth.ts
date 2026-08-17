import { Router, type IRouter, type Request, type Response } from "express";
import { GetCurrentAuthUserResponse } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getSessionId,
  createSession,
  clearSession,
  setSessionCookie,
  type SessionData,
} from "../lib/auth";

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
// Leaves that profile's teams/career saves in place (they're keyed by userId
// and just become unreachable) rather than cascading a destructive delete —
// safer default; can be revisited if you want a full wipe-on-delete.
router.delete("/profiles/:id", async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

// ── GET /logout — clear the session and go home ─────────────────────────────
router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

export default router;
