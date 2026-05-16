import { Router } from "express";
import { db } from "@workspace/db";
import { staffTable, teamsTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";

const router = Router();

const serializeStaff = (s: any) => ({ ...s, salary: Number(s.salary) });

const getTeamForUser = async (userId: string) => {
  return db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });
};

router.get("/staff", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  res.json(staff.map(serializeStaff));
});

router.post("/staff", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const { staffId } = req.body;
  const [updated] = await db.update(staffTable).set({ teamId: team.id, isAvailable: false })
    .where(eq(staffTable.id, Number(staffId))).returning();
  res.status(201).json(serializeStaff(updated));
});

router.get("/staff/available", async (req, res) => {
  const staff = await db.select().from(staffTable).where(isNull(staffTable.teamId));
  res.json(staff.map(serializeStaff));
});

router.delete("/staff/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [updated] = await db.update(staffTable).set({ teamId: null, isAvailable: true })
    .where(eq(staffTable.id, id)).returning();
  res.json(serializeStaff(updated));
});

export default router;
