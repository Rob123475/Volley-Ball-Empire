import { Router } from "express";
import { db } from "@workspace/db";
import { staffTable, teamsTable } from "@workspace/db";
import { eq, isNull, and, ilike, count } from "drizzle-orm";
import { generateStaffMarket, generateAttributesForRole, pickTraitForRole, type StaffRole } from "../utils/staff-generator";

const router = Router();

const serializeStaff = (s: any) => ({
  ...s,
  salary:     Number(s.salary),
  attributes: s.attributes ?? {},
  specialTrait:    s.specialTrait ?? "",
  isScoutRevealed: s.isScoutRevealed ?? false,
});

const getTeamForUser = async (userId: string) =>
  db.query.teamsTable.findFirst({ where: eq(teamsTable.userId, userId) });

const MAX_STAFF = 4;

async function backfillStaffAttributes(staffList: any[]): Promise<void> {
  const empty = staffList.filter(s => !s.attributes || Object.keys(s.attributes).length === 0);
  if (empty.length === 0) return;
  await Promise.all(empty.map(s => {
    const attributes = generateAttributesForRole(s.role, s.skillLevel ?? 70);
    const specialTrait = s.specialTrait || pickTraitForRole(s.role);
    return db.update(staffTable).set({ attributes, specialTrait }).where(eq(staffTable.id, s.id));
  }));
}

router.get("/staff", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.json([]); return; }
  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  await backfillStaffAttributes(staff);
  const refreshed = staff.map(s =>
    Object.keys(s.attributes ?? {}).length === 0
      ? { ...s, attributes: generateAttributesForRole(s.role, s.skillLevel ?? 70), specialTrait: s.specialTrait || pickTraitForRole(s.role) }
      : s
  );
  res.json(refreshed.map(serializeStaff));
});

router.post("/staff", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const [{ staffCount }] = await db
    .select({ staffCount: count() })
    .from(staffTable)
    .where(eq(staffTable.teamId, team.id));

  if (Number(staffCount) >= MAX_STAFF) {
    res.status(400).json({ error: `You can only have ${MAX_STAFF} staff members. Fire one before hiring another.` });
    return;
  }

  const { staffId } = req.body;
  const member = await db.query.staffTable.findFirst({ where: eq(staffTable.id, Number(staffId)) });
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  if (member.teamId !== null) { res.status(400).json({ error: "Staff member already hired" }); return; }

  const [updated] = await db.update(staffTable)
    .set({ teamId: team.id, isAvailable: false })
    .where(eq(staffTable.id, Number(staffId)))
    .returning();
  res.status(201).json(serializeStaff(updated));
});

router.get("/staff/market", async (req, res) => {
  const { role, search } = req.query as Record<string, string>;

  let available = await db.select().from(staffTable).where(isNull(staffTable.teamId));

  if (available.length < 20) {
    const fresh = generateStaffMarket(30);
    await db.insert(staffTable).values(fresh as any);
    available = await db.select().from(staffTable).where(isNull(staffTable.teamId));
  }

  await backfillStaffAttributes(available);

  let filtered = available;
  if (role && role !== "all") {
    filtered = filtered.filter(s => s.role === role);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.specialty.toLowerCase().includes(q) ||
      (s.nationality ?? "").toLowerCase().includes(q) ||
      s.specialTrait.toLowerCase().includes(q)
    );
  }

  res.json(filtered.map(serializeStaff));
});

router.get("/staff/available", async (req, res) => {
  const staff = await db.select().from(staffTable).where(isNull(staffTable.teamId));
  res.json(staff.map(serializeStaff));
});

router.delete("/staff/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [updated] = await db.update(staffTable)
    .set({ teamId: null, isAvailable: true })
    .where(eq(staffTable.id, id))
    .returning();
  res.json(serializeStaff(updated));
});

router.post("/staff/:id/scout", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const team = await getTeamForUser(req.user.id);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const member = await db.query.staffTable.findFirst({ where: eq(staffTable.id, id) });
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  if (member.isScoutRevealed) { res.status(400).json({ error: "Already revealed" }); return; }

  const teamStaff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  const headCoach = teamStaff.find(s => s.role === "head_coach");
  const assistantCoach = teamStaff.find(s => s.role === "assistant_coach");

  if (!headCoach && !assistantCoach) {
    res.status(400).json({ error: "You need a Head Coach or Assistant Coach to scout staff." });
    return;
  }

  const [updated] = await db.update(staffTable)
    .set({ isScoutRevealed: true })
    .where(eq(staffTable.id, id))
    .returning();
  res.json(serializeStaff(updated));
});

export default router;
