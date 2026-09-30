import { withStaffScouting } from "../utils/marketScouting.js";
import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import { staffTable, teamsTable, isMedicalRole, normaliseRole, MAX_STAFF, MAX_MEDICAL_STAFF } from "@workspace/db";
import { eq } from "drizzle-orm";
import { readContractLength } from "../utils/contractTerms.js";
import { staffContractPatch } from "../utils/seasonDates.js";
import { getGameDate } from "../utils/gameDate.js";
import {
  loadStaff, loadStaffMember, updateStaffState, updateStaffReference,
  createCareerStaff, requireCareerSaveId, type StaffDTO,
} from "../lib/playerDto.js";
import {
  generateMedicalMarket,
  generateMedicalAttributesForRole,
  pickMedicalTraitForRole,
  MEDICAL_ROLES,
  type MedicalRole,
} from "../utils/medical-staff-generator";

const router = Router();


const serializeStaff = (s: StaffDTO) => ({
  ...s,
  salary:          Number(s.salary),
  attributes:      s.attributes ?? {},
  specialTrait:    s.specialTrait ?? "",
  isScoutRevealed: s.isScoutRevealed ?? false,
});


// attributes / specialTrait are REFERENCE fields, same as in staff.ts.
async function backfillMedicalAttributes(staffList: StaffDTO[]): Promise<void> {
  const empty = staffList.filter(s => !s.attributes || Object.keys(s.attributes).length === 0);
  if (empty.length === 0) return;
  await Promise.all(empty.map(s => updateStaffReference(s.id, {
    attributes:   generateMedicalAttributesForRole(s.role, s.skillLevel ?? 70),
    specialTrait: s.specialTrait || pickMedicalTraitForRole(s.role),
  })));
}

router.get("/medical-staff", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json([]); return; }

  const staff = await loadStaff(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id });
  const medStaff = staff.filter(s => isMedicalRole(s.role));
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

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const allStaff = await loadStaff(cid, { teamId: team.id });
  const medCount = allStaff.filter(s => isMedicalRole(s.role)).length;

  if (medCount >= MAX_MEDICAL_STAFF) {
    res.status(400).json({ error: `You can only have ${MAX_MEDICAL_STAFF} medical staff. Release one before hiring another.` });
    return;
  }
  // Item 16: medical staff are staff; the club-wide limit counts them too, as
  // POST /staff always has (it counts every member of staff).
  if (allStaff.length >= MAX_STAFF) {
    res.status(400).json({ error: `You can only have ${MAX_STAFF} staff members, medical staff included. Release one before hiring another.` });
    return;
  }

  const { staffId } = req.body;
  const member = await loadStaffMember(cid, Number(staffId));
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  if (!isMedicalRole(member.role)) { res.status(400).json({ error: "Not a medical staff member" }); return; }
  if (member.teamId !== null) { res.status(400).json({ error: "Staff member already hired" }); return; }

  // L-02a: medical staff get a contract on the same three lengths, and it
  // expires on the calendar tick like any other.
  const wantedTerm = readContractLength(req.body);
  if ("error" in wantedTerm) { res.status(400).json({ error: wantedTerm.error }); return; }
  const hireDate = await getGameDate(team.id);
  const termPatch = await staffContractPatch(cid, wantedTerm.length, hireDate);
  await updateStaffState(cid, Number(staffId), { teamId: team.id, isAvailable: false, ...termPatch });
  res.status(201).json(serializeStaff({ ...member, teamId: team.id, isAvailable: false }));
});

router.get("/medical-staff/market", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { role, search } = req.query as Record<string, string>;

  const cid = requireCareerSaveId(req.activeCareerSaveId);
  let available = await loadStaff(cid, { unhired: true });
  let medAvailable = available.filter(s => isMedicalRole(s.role));

  if (medAvailable.length < 15) {
    for (const fresh of generateMedicalMarket(30)) {
      await createCareerStaff(cid, fresh as typeof staffTable.$inferInsert);
    }
    available = await loadStaff(cid, { unhired: true });
    medAvailable = available.filter(s => isMedicalRole(s.role));
  }

  await backfillMedicalAttributes(medAvailable);

  let filtered = medAvailable;
  if (role && role !== "all") {
    const key = normaliseRole(role);
    filtered = filtered.filter(s => key !== null && normaliseRole(s.role) === key);
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

  // Item 4: the scouting clock, as on the Staff Market.
  const team = await getActiveTeam(req);
  const today = team ? await getGameDate(team.id) : "0000-01-01";
  res.json(filtered.map((s) => withStaffScouting(serializeStaff(s), today)));
});

router.delete("/medical-staff/:id", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const id = parseInt(req.params.id);
  const member = await loadStaffMember(cid, id);
  if (!member) { res.status(404).json({ error: "Staff member not found" }); return; }
  await updateStaffState(cid, id, { teamId: null, isAvailable: true });
  res.json(serializeStaff({ ...member, teamId: null, isAvailable: true }));
});

export default router;
