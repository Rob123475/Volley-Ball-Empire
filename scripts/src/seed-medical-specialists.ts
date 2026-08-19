/**
 * Replaces all existing Medical Specialists with the real 10 from card images.
 * Run: pnpm --filter @workspace/scripts run seed-medical-specialists
 */
import { copyFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { DatabaseSync } from "node:sqlite";

// NOTE: writes via Node's built-in node:sqlite instead of the shared
// @workspace/db (better-sqlite3) client — same crash (native Statement
// destructor firing during isolate/env teardown, SIGABRT) that seed-staff.ts
// hit under Node 24 on Windows. See seed-staff.ts for the full writeup.
if (!process.env.DB_PATH) {
  throw new Error("DB_PATH must be set. Did you forget to pass the SQLite file path?");
}
const sqlite = new DatabaseSync(process.env.DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = process.env.SEED_WORKSPACE_ROOT
  ? resolve(process.env.SEED_WORKSPACE_ROOT)
  : resolve(__dirname, "../../");
const PUBLIC_IMAGES_ROOT = resolve(WORKSPACE_ROOT, "artifacts/beach-volleyball/public/images");
const ATTACHED_ASSETS_ROOT = resolve(WORKSPACE_ROOT, "attached_assets");
const ATTACHED_ASSETS_FILES = readdirSync(ATTACHED_ASSETS_ROOT);

// Same stale-filename problem as seed-staff.ts: the imageFile timestamps
// recorded below don't match what's actually on disk (portraits were
// re-uploaded/renamed since). Fall back to a prefix match on the recorded
// slot number so every specialist still resolves to a real local portrait.
function resolveLocalImagePath(roleSlug: string, imageFile: string): string {
  const exact = resolve(ATTACHED_ASSETS_ROOT, imageFile);
  if (existsSync(exact)) return exact;

  const match = imageFile.match(/_(\d{2})(?:_\d+)?\.\w+$/);
  if (!match) {
    throw new Error(`Could not parse slot index from imageFile "${imageFile}"`);
  }
  const idx = match[1];
  const candidates = ATTACHED_ASSETS_FILES.filter((f) => f.startsWith(`staff_${roleSlug}_${idx}`)).sort();

  if (candidates.length === 0) {
    throw new Error(`No local image found for ${roleSlug} #${idx} (expected ${imageFile})`);
  }
  const chosen = candidates[candidates.length - 1];
  console.log(`  (image mismatch: "${imageFile}" not found, using "${chosen}" instead)`);
  return resolve(ATTACHED_ASSETS_ROOT, chosen);
}

async function upload(localFile: string, entityId: string): Promise<string> {
  const destPath = join(PUBLIC_IMAGES_ROOT, entityId);
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(localFile, destPath);
  console.log(`  copied → /images/${entityId}`);
  return `/images/${entityId}`;
}

function skillFromStarsExp(stars: number, exp: number): number {
  const base = { 3: 68, 4: 78, 5: 90 }[stars] ?? 75;
  return Math.min(96, Math.round(base + exp * 0.55));
}
// Shared salary scale across all 5 medical seed scripts (Doctor, Physiotherapist,
// Nutritionist, Sports Scientist, Medical Specialist) — one linear map from skill
// level to salary so the same skill level pays the same regardless of which
// script/role generated it. Bounds are the global min/max skill_level across all
// 50 medical staff as seeded by these 5 scripts combined (currently 55-97).
const MEDICAL_SALARY_SKILL_MIN = 55;
const MEDICAL_SALARY_SKILL_MAX = 97;
function medicalSalaryFromSkill(skill: number): number {
  const t = (skill - MEDICAL_SALARY_SKILL_MIN) / (MEDICAL_SALARY_SKILL_MAX - MEDICAL_SALARY_SKILL_MIN);
  return Math.round((100000 + t * 100000) / 1000) * 1000;
}

type AttrKey = "sportsMedicine"|"injuryAssessment"|"concussionManagement"|"rehabilitationPlanning"|"returnToPlay"|"playerWellbeing"|"medicalResearch"|"professionalism";

function attrs(stars: number, exp: number, overrides: Partial<Record<AttrKey, number>>) {
  const base = { 3: 64, 4: 76, 5: 88 }[stars] ?? 76;
  const bExp = Math.round(exp * 0.45);
  const cap = (v: number) => Math.min(97, v);
  return {
    sportsMedicine:         cap(overrides.sportsMedicine         ?? base + bExp + 2),
    injuryAssessment:       cap(overrides.injuryAssessment       ?? base + bExp + 1),
    concussionManagement:   cap(overrides.concussionManagement   ?? base + bExp),
    rehabilitationPlanning: cap(overrides.rehabilitationPlanning ?? base + bExp),
    returnToPlay:           cap(overrides.returnToPlay           ?? base + bExp + 1),
    playerWellbeing:        cap(overrides.playerWellbeing        ?? base + bExp),
    medicalResearch:        cap(overrides.medicalResearch        ?? base + bExp),
    professionalism:        cap(overrides.professionalism        ?? base + bExp + 2),
  };
}

const SPECIALISTS = [
  {
    name: "Dr. James Carter", nationality: "British", gender: "Male",
    age: 52, stars: 4, experienceYears: 20,
    specialty: "Back Specialist",
    coachSpeciality: "Spinal & Back Medicine",
    specialties: ["Spinal Rehabilitation", "Back Injury Management", "Return to Play Protocols"],
    description: "A highly regarded British back specialist with 20 years in elite sport. Dr. Carter is one of the leading spinal rehabilitation experts on the World Tour, trusted by coaches and athletes alike.",
    attributes: attrs(4, 20, { injuryAssessment: 93, rehabilitationPlanning: 92, returnToPlay: 93 }),
    imageFile: "staff_medical_specialist_01_1783428591843.webp", slot: "staff-01",
  },
  {
    name: "Dr. Sarah Mitchell", nationality: "Australian", gender: "Female",
    age: 48, stars: 4, experienceYears: 18,
    specialty: "Shoulder Specialist",
    coachSpeciality: "Shoulder & Upper Limb Medicine",
    specialties: ["Shoulder Injury Rehabilitation", "Upper Limb Medicine", "Return to Play"],
    description: "An accomplished Australian shoulder specialist with 18 years of elite sports experience. Dr. Mitchell's expertise in upper limb medicine makes her indispensable for beach volleyball rosters.",
    attributes: attrs(4, 18, { injuryAssessment: 92, rehabilitationPlanning: 91, returnToPlay: 92 }),
    imageFile: "staff_medical_specialist_02_1783428594971.webp", slot: "staff-02",
  },
  {
    name: "Dr. David Thompson", nationality: "Canadian", gender: "Male",
    age: 46, stars: 4, experienceYears: 17,
    specialty: "Ankle Specialist",
    coachSpeciality: "Ankle & Lower Limb Medicine",
    specialties: ["Ankle Injury Management", "Lower Limb Rehabilitation", "Sports Injury Assessment"],
    description: "A trusted Canadian ankle specialist with 17 years on the elite circuit. Dr. Thompson's lower limb rehabilitation programmes have helped countless athletes return to peak performance.",
    attributes: attrs(4, 17, { injuryAssessment: 91, rehabilitationPlanning: 90, returnToPlay: 91 }),
    imageFile: "staff_medical_specialist_03_1783428597295.webp", slot: "staff-03",
  },
  {
    name: "Dr. Benjamin Harris", nationality: "British", gender: "Male",
    age: 50, stars: 4, experienceYears: 19,
    specialty: "Hand Specialist",
    coachSpeciality: "Hand & Wrist Medicine",
    specialties: ["Hand & Wrist Rehabilitation", "Fine Motor Recovery", "Return to Play"],
    description: "A meticulous British hand specialist with 19 years in professional sport. Dr. Harris is widely recognised for his precision rehabilitation of hand and wrist injuries that affect setting and attacking mechanics.",
    attributes: attrs(4, 19, { injuryAssessment: 92, rehabilitationPlanning: 92, sportsMedicine: 91 }),
    imageFile: "staff_medical_specialist_04_1783428599354.webp", slot: "staff-04",
  },
  {
    name: "Dr. Andrew Wilson", nationality: "Australian", gender: "Male",
    age: 45, stars: 4, experienceYears: 18,
    specialty: "Knee Specialist",
    coachSpeciality: "Knee & Lower Limb Medicine",
    specialties: ["Knee Injury Rehabilitation", "ACL & Ligament Recovery", "Return to Play"],
    description: "A respected Australian knee specialist with 18 years of elite experience. Dr. Wilson is the go-to expert for ACL and ligament rehabilitation, a critical skill in beach volleyball.",
    attributes: attrs(4, 18, { injuryAssessment: 92, rehabilitationPlanning: 93, returnToPlay: 94 }),
    imageFile: "staff_medical_specialist_05_1783428612997.webp", slot: "staff-05",
  },
  {
    // ★5
    name: "Dr. Meera Kapoor", nationality: "Indian", gender: "Female",
    age: 53, stars: 5, experienceYears: 21,
    specialty: "Neck Specialist",
    coachSpeciality: "Cervical & Neck Medicine",
    specialties: ["Cervical Spine Rehabilitation", "Neck Injury Management", "Concussion Management"],
    description: "A 5-star Indian neck and cervical spine specialist with 21 years at the elite level. Dr. Kapoor's expertise in concussion management and cervical rehabilitation makes her one of the most complete medical specialists on the market.",
    attributes: attrs(5, 21, { concussionManagement: 96, injuryAssessment: 95, rehabilitationPlanning: 95, professionalism: 96 }),
    imageFile: "staff_medical_specialist_06_1783428614658.webp", slot: "staff-06",
  },
  {
    // ★3 — younger, lower tier
    name: "Dr. Sofia Martinez", nationality: "Spanish", gender: "Female",
    age: 27, stars: 3, experienceYears: 4,
    specialty: "Sports Scientist",
    coachSpeciality: "Performance Analysis",
    specialties: ["Performance Analysis", "Sports Science", "Athletic Wellbeing"],
    description: "A talented young Spanish sports scientist and performance analyst with 4 years in elite sport. Dr. Martinez brings fresh analytical thinking and modern sports science methodology to her role.",
    attributes: attrs(3, 4, { medicalResearch: 72, playerWellbeing: 70, sportsMedicine: 68 }),
    imageFile: "staff_medical_specialist_07_1783428616973.webp", slot: "staff-07",
  },
  {
    name: "Dr. Daniel Thompson", nationality: "Australian", gender: "Male",
    age: 41, stars: 4, experienceYears: 13,
    specialty: "Orthopaedic Specialist",
    coachSpeciality: "Orthopaedic Medicine",
    specialties: ["Orthopaedic Rehabilitation", "Sports Injury Assessment", "Return to Play"],
    description: "A skilled Australian orthopaedic specialist and sports injury expert with 13 years of elite experience. Dr. Thompson's holistic approach to assessment and rehabilitation makes him a valued addition to any squad.",
    attributes: attrs(4, 13, { injuryAssessment: 89, rehabilitationPlanning: 89, returnToPlay: 90 }),
    imageFile: "staff_medical_specialist_08_1783428619535.webp", slot: "staff-08",
  },
  {
    name: "Dr. Alessandro Rossi", nationality: "Italian", gender: "Male",
    age: 35, stars: 4, experienceYears: 10,
    specialty: "Cardiology Specialist",
    coachSpeciality: "Cardiology & Performance Medicine",
    specialties: ["Cardiovascular Health", "Performance Medicine", "Player Wellbeing"],
    description: "An innovative Italian cardiology specialist with 10 years in elite sports performance medicine. Dr. Rossi focuses on heart health optimisation and cardiovascular performance enhancement for elite athletes.",
    attributes: attrs(4, 10, { sportsMedicine: 86, playerWellbeing: 88, medicalResearch: 86 }),
    imageFile: "staff_medical_specialist_09_1783428650582.webp", slot: "staff-09",
  },
  {
    name: "Dr. Nathaniel Goodwin", nationality: "New Zealander", gender: "Male",
    age: 46, stars: 4, experienceYears: 16,
    specialty: "Neurology Specialist",
    coachSpeciality: "Neurology & Brain Medicine",
    specialties: ["Neurological Assessment", "Concussion Management", "Brain & Nervous System Medicine"],
    description: "A distinguished New Zealand neurology specialist with 16 years in elite sport. Dr. Goodwin's expertise in concussion protocols and neurological assessment makes him an essential component of any top-tier medical team.",
    attributes: attrs(4, 16, { concussionManagement: 93, injuryAssessment: 91, medicalResearch: 90 }),
    imageFile: "staff_medical_specialist_10_1783428652885.webp", slot: "staff-10",
  },
];

const insertStmt = sqlite.prepare(`
  INSERT INTO staff (
    name, role, specialty, salary, skill_level, team_id, nationality, image_url,
    is_available, age, overall_rating, contract_length, coach_speciality, personality,
    attributes, special_trait, is_scout_revealed, scouting_rating, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

async function main() {
  console.log("Removing existing Medical Specialists...");
  const existing = sqlite
    .prepare(`SELECT id, name FROM staff WHERE role = ?`)
    .all("Medical Specialist") as { id: number; name: string }[];

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    sqlite.prepare(`UPDATE training_sessions SET coach_id = NULL WHERE coach_id IN (${placeholders})`).run(...ids);
    sqlite
      .prepare(`UPDATE continental_scouting_missions SET assigned_staff_id = NULL WHERE assigned_staff_id IN (${placeholders})`)
      .run(...ids);
    sqlite.prepare(`DELETE FROM staff WHERE id IN (${placeholders})`).run(...ids);
    console.log(`  deleted ${ids.length} rows.\n`);
  }

  for (const [i, s] of SPECIALISTS.entries()) {
    const skill = skillFromStarsExp(s.stars, s.experienceYears);
    const salary = medicalSalaryFromSkill(skill);
    console.log(`[${i + 1}/10] ${s.name} (${s.nationality}, ★${s.stars}, ${s.experienceYears} yrs) — skill ${skill}`);

    const localPath = resolveLocalImagePath("medical_specialist", s.imageFile);
    const imageUrl = await upload(localPath, `staff/medical_specialist/${s.slot}.webp`);

    const attributes = {
      schema:                 "beach_volleyball_staff",
      version:                "1.0",
      staffType:              "Medical Specialist",
      regenerationSeed:       "BVM_MEDICAL_SPECIALIST_V1_2026_07_07",
      nationality:            s.nationality,
      age:                    s.age,
      gender:                 s.gender,
      stars:                  s.stars,
      experienceYears:        s.experienceYears,
      salary,
      specialties:            s.specialties,
      description:            s.description,
      ...s.attributes,
    };

    insertStmt.run(
      s.name,
      "Medical Specialist",
      s.specialty,
      salary,
      skill,
      null,
      s.nationality,
      imageUrl,
      1,
      s.age,
      skill,
      12,
      s.coachSpeciality,
      "Analytical",
      JSON.stringify(attributes),
      s.specialties[0],
      0,
      skill - 5,
      Math.floor(Date.now() / 1000),
    );

    console.log(`  ✓ inserted → ${imageUrl}`);
  }

  const final = sqlite
    .prepare(`SELECT name, skill_level FROM staff WHERE role = ?`)
    .all("Medical Specialist") as { name: string; skill_level: number }[];

  console.log(`\nDone — ${final.length} Medical Specialists now in DB:`);
  final.forEach((r) => console.log(`  ${r.name} (skill ${r.skill_level})`));
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  sqlite.close();
  process.exitCode = 1;
});
