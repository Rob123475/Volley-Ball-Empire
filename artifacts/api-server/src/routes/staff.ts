import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { staffTable, teamsTable, financeTransactionsTable, careerHistoryEntriesTable, careerSavesTable } from "@workspace/db";
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


const MAX_STAFF = 8;

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
  const team = await getActiveTeam(req);
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
  const team = await getActiveTeam(req);
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

  // Frontend sends snake_case filter keys; DB stores Title Case role names
  const ROLE_FILTER_MAP: Record<string, string> = {
    head_coach:           "Head Coach",
    assistant_coach:      "Assistant Coach",
    fitness_trainer:      "Fitness Trainer",
    strength_conditioner: "Strength Coach",
    massage_therapist:    "Massage Therapist",
    promotions_manager:   "Promotional Manager",
    scout:                "Scout",
  };

  let filtered = available;
  if (role && role !== "all") {
    const dbRole = ROLE_FILTER_MAP[role] ?? role;
    filtered = filtered.filter(s => s.role === dbRole);
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

router.patch("/staff/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  const id = parseInt(req.params.id);
  const member = await db.query.staffTable.findFirst({ where: eq(staffTable.id, id) });
  if (!member) { res.status(404).json({ error: "Staff not found" }); return; }
  if (member.teamId !== team.id) { res.status(403).json({ error: "Not your staff" }); return; }
  const { name, nationality, attributes, personality, specialty, specialTrait } = req.body;
  const updates: any = {};
  if (name        !== undefined) updates.name        = name;
  if (nationality !== undefined) updates.nationality = nationality;
  if (attributes  !== undefined) updates.attributes  = attributes;
  if (personality !== undefined) updates.personality = personality;
  if (specialty   !== undefined) updates.specialty   = specialty;
  if (specialTrait !== undefined) updates.specialTrait = specialTrait;
  const [updated] = await db.update(staffTable).set(updates).where(eq(staffTable.id, id)).returning();
  res.json(serializeStaff(updated));
});

router.delete("/staff/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const id = parseInt(req.params.id, 10);
  const member = await db.query.staffTable.findFirst({ where: eq(staffTable.id, id) });
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  if (member.teamId !== team.id) { res.status(403).json({ error: "Staff member does not belong to your team" }); return; }

  // Termination fee = 50% of remaining contract value
  const monthlySalary  = Number(member.salary);
  const monthsRemaining = member.contractLength;
  const terminationFee  = Math.round(monthlySalary * monthsRemaining * 0.5);
  const teamBudget      = Number(team.budget);

  if (teamBudget < terminationFee) {
    res.status(400).json({
      error: "Insufficient funds",
      terminationFee,
      teamBudget,
    });
    return;
  }

  // Deduct termination fee from club budget
  await db.update(teamsTable)
    .set({ budget: String(teamBudget - terminationFee) })
    .where(eq(teamsTable.id, team.id));

  // Release the staff member back to the market
  const [updated] = await db.update(staffTable)
    .set({ teamId: null, isAvailable: true })
    .where(eq(staffTable.id, id))
    .returning();

  // Finance transaction — staff termination expense
  const today = new Date().toISOString().split("T")[0];
  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      String(terminationFee),
    description: `Contract termination — ${member.name} (${member.role.replace(/_/g, " ")})`,
    category:    "staff_termination",
    date:        today,
  });

  // Career history entry
  if (req.user?.id) {
    const [save] = await db
      .select()
      .from(careerSavesTable)
      .where(eq(careerSavesTable.teamId, team.id));

    await db.insert(careerHistoryEntriesTable).values({
      userId:       req.user.id,
      careerSaveId: save?.id ?? null,
      type:         "staff_fired",
      clubName:     team.name,
      season:       save?.season ?? null,
      description:  `Terminated contract of ${member.name} (${member.role.replace(/_/g, " ")}). Termination fee: $${terminationFee.toLocaleString()}.`,
    });
  }

  res.json({ ...serializeStaff(updated), terminationFee, budgetAfter: teamBudget - terminationFee });
});

const STAFF_SCOUT_COST = 1_000;

router.post("/staff/:id/scout", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const member = await db.query.staffTable.findFirst({ where: eq(staffTable.id, id) });
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  if (member.isScoutRevealed) { res.status(400).json({ error: "Already revealed" }); return; }

  const teamStaff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  // Roles are stored as Title Case ("Head Coach", "Scout") — normalise before comparing.
  const normaliseRole = (r: string) => (r ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const SCOUTING_ROLES = new Set(["head_coach", "assistant_coach", "scout"]);
  const hasCoach = teamStaff.some(s => SCOUTING_ROLES.has(normaliseRole(s.role)));

  if (!hasCoach) {
    res.status(400).json({ error: "You need a Head Coach, Assistant Coach, or Scout to scout staff." });
    return;
  }

  const currentBudget = Number(team.budget ?? 0);
  if (currentBudget < STAFF_SCOUT_COST) {
    res.status(400).json({ error: `Not enough funds. Staff scouting costs $${STAFF_SCOUT_COST.toLocaleString()}.` });
    return;
  }

  await db.update(teamsTable)
    .set({ budget: String(currentBudget - STAFF_SCOUT_COST) })
    .where(eq(teamsTable.id, team.id));

  const [updated] = await db.update(staffTable)
    .set({ isScoutRevealed: true })
    .where(eq(staffTable.id, id))
    .returning();
  res.json(serializeStaff(updated));
});

export default router;
