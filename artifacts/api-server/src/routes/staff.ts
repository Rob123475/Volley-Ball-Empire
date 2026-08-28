import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { staffTable, teamsTable, financeTransactionsTable, careerHistoryEntriesTable, careerSavesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { generateStaffMarket, generateAttributesForRole, pickTraitForRole, type StaffRole } from "../utils/staff-generator";
import { getGameDate } from "../utils/gameDate.js";
import {
  loadStaff, loadStaffMember, updateStaffState, updateStaffReference,
  createCareerStaff, countTeamStaff, requireCareerSaveId, withCareerStateTx,
  type StaffDTO, type StaffReferenceFields,
} from "../lib/playerDto.js";

const router = Router();

const serializeStaff = (s: StaffDTO) => ({
  ...s,
  salary:     Number(s.salary),
  attributes: s.attributes ?? {},
  specialTrait:    s.specialTrait ?? "",
  isScoutRevealed: s.isScoutRevealed ?? false,
});


const MAX_STAFF = 8;

// attributes and specialTrait are REFERENCE fields — what a staff member is,
// identical in every career — so this backfill writes the reference row.
async function backfillStaffAttributes(staffList: StaffDTO[]): Promise<void> {
  const empty = staffList.filter(s => !s.attributes || Object.keys(s.attributes).length === 0);
  if (empty.length === 0) return;
  await Promise.all(empty.map(s => updateStaffReference(s.id, {
    attributes:   generateAttributesForRole(s.role, s.skillLevel ?? 70),
    specialTrait: s.specialTrait || pickTraitForRole(s.role),
  })));
}

router.get("/staff", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }
  const staff = await loadStaff(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
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

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const staffCount = await countTeamStaff(cid, team.id);

  if (staffCount >= MAX_STAFF) {
    res.status(400).json({ error: `You can only have ${MAX_STAFF} staff members. Fire one before hiring another.` });
    return;
  }

  const { staffId } = req.body;
  const member = await loadStaffMember(cid, Number(staffId));
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  if (member.teamId !== null) { res.status(400).json({ error: "Staff member already hired" }); return; }

  // Hiring costs the first month up front. Without this the staff market was
  // free: the budget never moved no matter who you signed.
  const signingCost = Math.round(Number(member.salary));
  const signingDate = await getGameDate(team.id);

  if (Number(team.budget) < signingCost) {
    res.status(400).json({
      error: `Not enough budget to hire ${member.name}. Needs $${signingCost.toLocaleString()}, you have $${Math.round(Number(team.budget)).toLocaleString()}.`,
    });
    return;
  }

  // One transaction: the hire and the money move together or not at all.
  withCareerStateTx(({ tx, setStaffState }) => {
    setStaffState(cid, Number(staffId), { teamId: team.id, isAvailable: false });

    tx.update(teamsTable)
      .set({ budget: Number(team.budget) - signingCost })
      .where(eq(teamsTable.id, team.id))
      .run();

    tx.insert(financeTransactionsTable).values({
      teamId:      team.id,
      type:        "expense",
      amount:      signingCost,
      description: `Signed ${member.name} (${member.role}) — first month's salary`,
      category:    "staff_salary",
      date:        signingDate,
    }).run();
  });

  res.status(201).json(serializeStaff({ ...member, teamId: team.id, isAvailable: false }));
});

router.get("/staff/market", async (req, res) => {
  const { role, search } = req.query as Record<string, string>;

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  let available = await loadStaff(cid, { unhired: true });

  if (available.length < 20) {
    // createCareerStaff writes the reference row AND this career's state,
    // seeding the live wage from baseSalary. A bare insert into `staff` would
    // add someone no career can see, and with no wage if it could.
    for (const fresh of generateStaffMarket(30)) {
      await createCareerStaff(cid, fresh as typeof staffTable.$inferInsert);
    }
    available = await loadStaff(cid, { unhired: true });
  }

  // Massage Therapist moved to the Medical Market — no longer listed here.
  // (auto-refilled market rows use snake_case roles, real seeded rows use
  // Title Case — exclude both so this actually holds regardless of source.)
  available = available.filter(s => s.role !== "Massage Therapist" && s.role !== "massage_therapist");

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
  const staff = await loadStaff(requireCareerSaveId(req.activeCareerSaveId), { unhired: true });
  res.json(staff.map(serializeStaff));
});

router.patch("/staff/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const id = parseInt(req.params.id);
  const member = await loadStaffMember(cid, id);
  if (!member) { res.status(404).json({ error: "Staff not found" }); return; }
  if (member.teamId !== team.id) { res.status(403).json({ error: "Not your staff" }); return; }
  const { name, nationality, attributes, personality, specialty, specialTrait } = req.body;
  // Every editable field here is REFERENCE data — who the person is, not what
  // this career has done with them — so it goes to the athlete row.
  const updates: StaffReferenceFields = {};
  if (name        !== undefined) updates.name        = name;
  if (nationality !== undefined) updates.nationality = nationality;
  if (attributes  !== undefined) updates.attributes  = attributes;
  if (personality !== undefined) updates.personality = personality;
  if (specialty   !== undefined) updates.specialty   = specialty;
  if (specialTrait !== undefined) updates.specialTrait = specialTrait;
  await updateStaffReference(id, updates);
  const updated = await loadStaffMember(cid, id);
  if (!updated) { res.status(404).json({ error: "Staff not found" }); return; }
  res.json(serializeStaff(updated));
});

router.delete("/staff/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const id = parseInt(req.params.id, 10);
  const member = await loadStaffMember(cid, id);
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
    .set({ budget: teamBudget - terminationFee })
    .where(eq(teamsTable.id, team.id));

  // Release the staff member back to THIS career's market
  await updateStaffState(cid, id, { teamId: null, isAvailable: true });
  const updated: StaffDTO = { ...member, teamId: null, isAvailable: true };

  // Finance transaction — staff termination expense
  const today = await getGameDate(team.id);
  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      terminationFee,
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

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const member = await loadStaffMember(cid, id);
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  if (member.isScoutRevealed) { res.status(400).json({ error: "Already revealed" }); return; }

  const teamStaff = await loadStaff(cid, { teamId: team.id });
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
    .set({ budget: currentBudget - STAFF_SCOUT_COST })
    .where(eq(teamsTable.id, team.id));

  // Scouting is per-career knowledge: revealing someone in one save must not
  // reveal them in another.
  await updateStaffState(cid, id, { isScoutRevealed: true });
  res.json(serializeStaff({ ...member, isScoutRevealed: true }));
});

export default router;
