import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { staffTable, teamsTable } from "@workspace/db";
import { eq, isNull, count } from "drizzle-orm";
import {
  generateMedicalMarket,
  generateMedicalAttributesForRole,
  pickMedicalTraitForRole,
  MEDICAL_ROLES,
  type MedicalRole,
} from "../utils/medical-staff-generator";

const router = Router();

// Include both legacy snake_case names and current Title Case DB names
const MEDICAL_ROLE_SET = new Set<string>([
  ...MEDICAL_ROLES,
  "Doctor", "Medical Specialist", "Physiotherapist", "Nutritionist", "Sports Scientist", "Massage Therapist",
  "sports_chemist", // legacy rows already migrated but guard against stragglers
]);

// Map snake_case filter pill values → Title Case DB role names
const ROLE_FILTER_MAP: Record<string, string> = {
  team_doctor:        "Doctor",
  medical_specialist: "Medical Specialist",
  physiotherapist:    "Physiotherapist",
  nutritionist:       "Nutritionist",
  sports_scientist:   "Sports Scientist",
  sports_chemist:     "Sports Scientist",
  massage_therapist:  "Massage Therapist",
};
const MAX_MEDICAL_STAFF = 4;

const serializeStaff = (s: any) => ({
  ...s,
  salary:          Number(s.salary),
  attributes:      s.attributes ?? {},
  specialTrait:    s.specialTrait ?? "",
  isScoutRevealed: s.isScoutRevealed ?? false,
});


async function backfillMedicalAttributes(staffList: any[]): Promise<void> {
  const empty = staffList.filter(s => !s.attributes || Object.keys(s.attributes).length === 0);
  if (empty.length === 0) return;
  await Promise.all(empty.map(s => {
    const attributes  = generateMedicalAttributesForRole(s.role, s.skillLevel ?? 70);
    const specialTrait = s.specialTrait || pickMedicalTraitForRole(s.role);
    return db.update(staffTable).set({ attributes, specialTrait }).where(eq(staffTable.id, s.id));
  }));
}

router.get("/medical-staff", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }

  const staff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  const medStaff = staff.filter(s => MEDICAL_ROLE_SET.has(s.role));
  await backfillMedicalAttributes(medStaff);

  const refreshed = medStaff.map(s =>
    !s.attributes || Object.keys(s.attributes).length === 0
      ? { ...s, attributes: generateMedicalAttributesForRole(s.role, s.skillLevel ?? 70), specialTrait: s.specialTrait || pickMedicalTraitForRole(s.role) }
      : s
  );
  res.json(refreshed.map(serializeStaff));
});

router.post("/medical-staff", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }

  const allStaff = await db.select().from(staffTable).where(eq(staffTable.teamId, team.id));
  const medCount = allStaff.filter(s => MEDICAL_ROLE_SET.has(s.role)).length;

  if (medCount >= MAX_MEDICAL_STAFF) {
    res.status(400).json({ error: `You can only have ${MAX_MEDICAL_STAFF} medical staff. Release one before hiring another.` });
    return;
  }

  const { staffId } = req.body;
  const member = await db.query.staffTable.findFirst({ where: eq(staffTable.id, Number(staffId)) });
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  if (!MEDICAL_ROLE_SET.has(member.role)) { res.status(400).json({ error: "Not a medical staff member" }); return; }
  if (member.teamId !== null) { res.status(400).json({ error: "Staff member already hired" }); return; }

  const [updated] = await db.update(staffTable)
    .set({ teamId: team.id, isAvailable: false })
    .where(eq(staffTable.id, Number(staffId)))
    .returning();
  res.status(201).json(serializeStaff(updated));
});

router.get("/medical-staff/market", async (req, res) => {
  const { role, search } = req.query as Record<string, string>;

  let available = await db.select().from(staffTable).where(isNull(staffTable.teamId));
  let medAvailable = available.filter(s => MEDICAL_ROLE_SET.has(s.role));

  if (medAvailable.length < 15) {
    const fresh = generateMedicalMarket(30);
    await db.insert(staffTable).values(fresh as any);
    available = await db.select().from(staffTable).where(isNull(staffTable.teamId));
    medAvailable = available.filter(s => MEDICAL_ROLE_SET.has(s.role));
  }

  await backfillMedicalAttributes(medAvailable);

  let filtered = medAvailable;
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

router.delete("/medical-staff/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [updated] = await db.update(staffTable)
    .set({ teamId: null, isAvailable: true })
    .where(eq(staffTable.id, id))
    .returning();
  res.json(serializeStaff(updated));
});

export default router;
