/**
 * Replaces all existing Nutritionists with the real 10 from card images.
 * Run: pnpm --filter @workspace/scripts run seed-nutritionists
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
// slot number so every nutritionist still resolves to a real local portrait.
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
  const base = { 2: 52, 3: 66, 3.5: 73, 4: 78, 4.5: 86, 5: 92 }[stars] ?? 75;
  return Math.min(97, Math.round(base + exp * 0.5));
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

type AttrKey = "sportsNutrition"|"mealPlanning"|"hydrationManagement"|"supplementKnowledge"|"bodyComposition"|"recoveryNutrition"|"playerEducation"|"professionalism";

function attrs(stars: number, exp: number, overrides: Partial<Record<AttrKey, number>>) {
  const base = { 2: 50, 3: 63, 3.5: 71, 4: 77, 4.5: 85, 5: 91 }[stars] ?? 77;
  const bExp = Math.round(exp * 0.4);
  const cap = (v: number) => Math.min(97, v);
  return {
    sportsNutrition:      cap(overrides.sportsNutrition      ?? base + bExp + 2),
    mealPlanning:         cap(overrides.mealPlanning         ?? base + bExp + 1),
    hydrationManagement:  cap(overrides.hydrationManagement  ?? base + bExp),
    supplementKnowledge:  cap(overrides.supplementKnowledge  ?? base + bExp),
    bodyComposition:      cap(overrides.bodyComposition      ?? base + bExp),
    recoveryNutrition:    cap(overrides.recoveryNutrition    ?? base + bExp + 1),
    playerEducation:      cap(overrides.playerEducation      ?? base + bExp),
    professionalism:      cap(overrides.professionalism      ?? base + bExp + 2),
  };
}

const NUTRITIONISTS = [
  {
    // 01 — ★4, 9 yrs
    name: "Dr. Lucy Mitchell", nationality: "Australian", gender: "Female",
    age: 34, stars: 4, experienceYears: 9,
    specialty: "Team Nutritionist",
    coachSpeciality: "Sports Nutrition",
    specialties: ["Sports Nutrition", "Plant-Based Nutrition", "Hydration Strategy"],
    description: "A passionate Australian sports nutritionist with 9 years on the elite circuit. Dr. Mitchell is known for her plant-based nutrition expertise and holistic approach to fuelling beach volleyball athletes for peak performance.",
    attributes: attrs(4, 9, { sportsNutrition: 85, mealPlanning: 84, hydrationManagement: 83 }),
    imageFile: "staff_medical_nutritionist_01_1783428715701.webp", slot: "staff-01",
  },
  {
    // 02 — ★4, 14 yrs
    name: "Dr. James O'Connor", nationality: "Australian", gender: "Male",
    age: 41, stars: 4, experienceYears: 14,
    specialty: "Team Nutritionist",
    coachSpeciality: "Sports Nutrition",
    specialties: ["Sports Nutrition", "Performance Nutrition", "Body Composition"],
    description: "An experienced Australian team nutritionist with 14 years working with elite athletes. Dr. O'Connor specialises in performance nutrition and body composition management for beach volleyball professionals.",
    attributes: attrs(4, 14, { sportsNutrition: 88, bodyComposition: 88, recoveryNutrition: 87 }),
    imageFile: "staff_medical_nutritionist_02_1783428719701.webp", slot: "staff-02",
  },
  {
    // 03 — ★4, 8 yrs
    name: "Dr. Ingrid Nilsen", nationality: "Norwegian", gender: "Female",
    age: 33, stars: 4, experienceYears: 8,
    specialty: "Team Nutritionist",
    coachSpeciality: "Sports Nutrition",
    specialties: ["Sports Nutrition", "Gut Health & Digestion", "Nutrition Education"],
    description: "A dedicated Norwegian sports nutritionist with 8 years of elite experience. Dr. Nilsen is praised for her gut health expertise and ability to educate athletes on evidence-based nutrition habits.",
    attributes: attrs(4, 8, { playerEducation: 85, mealPlanning: 84, sportsNutrition: 83 }),
    imageFile: "staff_medical_nutritionist_03_1783428721922.webp", slot: "staff-03",
  },
  {
    // 04 — ★2, 6 yrs
    name: "Dr. Anastasia Petrova", nationality: "Russian", gender: "Female",
    age: 33, stars: 2, experienceYears: 6,
    specialty: "Team Nutritionist",
    coachSpeciality: "Sports Nutrition",
    specialties: ["Sports Nutrition", "Performance Nutrition", "Recovery Nutrition"],
    description: "A developing Russian nutritionist with 6 years of experience in elite sport. Dr. Petrova is building her career on the World Tour and brings energy and modern nutritional science to her role.",
    attributes: attrs(2, 6, { sportsNutrition: 58, recoveryNutrition: 57, mealPlanning: 56 }),
    imageFile: "staff_medical_nutritionist_04_1783428724280.webp", slot: "staff-04",
  },
  {
    // 05 — ★2 Extra Specialities, 7 yrs
    name: "Dr. Sipho Ndlovu", nationality: "South African", gender: "Male",
    age: 35, stars: 2, experienceYears: 7,
    specialty: "Team Nutritionist",
    coachSpeciality: "Sports Nutrition",
    specialties: ["Micronutrient Analysis", "Gut Health & Biome", "Mental Nutrition"],
    description: "A South African nutritionist with 7 years of experience and a rich set of specialist skills. Though rated ★2, Dr. Ndlovu's focus on micronutrient analysis, mental nutrition and gut health biome sets him apart as an unconventional find.",
    attributes: attrs(2, 7, { supplementKnowledge: 64, hydrationManagement: 62, bodyComposition: 61 }),
    imageFile: "staff_medical_nutritionist_05_1783428735209.webp", slot: "staff-05",
  },
  {
    // 06 — ★5, 15+ yrs — Head of Performance Nutrition
    name: "Dr. Elena Sokolova", nationality: "Russian", gender: "Female",
    age: 42, stars: 5, experienceYears: 16,
    specialty: "Head of Performance Nutrition",
    coachSpeciality: "Performance Nutrition",
    specialties: ["Performance Optimisation", "Micronutrient Analysis", "Mental Nutrition"],
    description: "A world-class Russian head of performance nutrition with over 15 years at the elite level. Dr. Sokolova is one of the top nutritionists available on the market, renowned for her micronutrient analysis, mental nutrition strategies and performance optimisation systems.",
    attributes: attrs(5, 16, { sportsNutrition: 95, mealPlanning: 94, supplementKnowledge: 95, recoveryNutrition: 94, professionalism: 96 }),
    imageFile: "staff_medical_nutritionist_06_1783428737131.webp", slot: "staff-06",
  },
  {
    // 07 — ★3.5, 4 yrs
    name: "Larissa Mendes", nationality: "Brazilian", gender: "Female",
    age: 27, stars: 3.5, experienceYears: 4,
    specialty: "Nutritionist",
    coachSpeciality: "Sports Nutrition",
    specialties: ["Sports Nutrition", "Weight Management", "Recovery Nutrition"],
    description: "A vibrant Brazilian nutritionist with 4 years in elite sport. Larissa Mendes's smart approach to fuelling athletes — combining weight management, micronutrient planning and hydration strategy — makes her a bright prospect at ★3.5.",
    attributes: attrs(3.5, 4, { sportsNutrition: 75, mealPlanning: 74, hydrationManagement: 73 }),
    imageFile: "staff_medical_nutritionist_07_1783428739306.webp", slot: "staff-07",
  },
  {
    // 08 — ★4, 13 yrs
    name: "Sophie Nguyen", nationality: "Canadian", gender: "Female",
    age: 42, stars: 4, experienceYears: 13,
    specialty: "Nutritionist",
    coachSpeciality: "Sports Nutrition",
    specialties: ["Performance Nutrition", "Plant-Based Nutrition", "Body Composition & Weight Management"],
    description: "An accomplished Canadian nutritionist with 13 years of elite sports experience. Sophie Nguyen excels at plant-based performance nutrition and comprehensive body composition management for high-performance athletes.",
    attributes: attrs(4, 13, { sportsNutrition: 87, bodyComposition: 88, mealPlanning: 87 }),
    imageFile: "staff_medical_nutritionist_08_1783428741769.webp", slot: "staff-08",
  },
  {
    // 09 — ★4.5, 6 yrs
    name: "Emilie Dupont", nationality: "French", gender: "Female",
    age: 29, stars: 4.5, experienceYears: 6,
    specialty: "Nutritionist",
    coachSpeciality: "Sports Nutrition",
    specialties: ["Sports Nutrition", "Plant-Based Nutrition", "Body Composition & Weight Management"],
    description: "A highly promising French nutritionist with 6 years in elite sport and a ★4.5 rating. Emilie Dupont combines performance nutrition science with plant-based expertise and strong gut health knowledge to deliver outstanding results.",
    attributes: attrs(4.5, 6, { sportsNutrition: 89, hydrationManagement: 88, recoveryNutrition: 89, playerEducation: 88 }),
    imageFile: "staff_medical_nutritionist_09_1783428821497.webp", slot: "staff-09",
  },
  {
    // 10 — ★5 Extra Specialist, 18 yrs
    name: "Isabella Moretti", nationality: "Italian", gender: "Female",
    age: 46, stars: 5, experienceYears: 18,
    specialty: "Nutritionist",
    coachSpeciality: "Performance Nutrition",
    specialties: ["Body Composition Optimisation", "Gut Health Expert", "Micronutrient Strategy"],
    description: "An exceptional Italian ★5 extra specialist nutritionist with 18 years at the elite level. Isabella Moretti is one of the finest nutritionists in the game, with mastery of body composition, gut health, hydration and micronutrient strategy backed by decades of elite-level impact.",
    attributes: attrs(5, 18, { sportsNutrition: 96, bodyComposition: 96, supplementKnowledge: 95, hydrationManagement: 95, mealPlanning: 96, professionalism: 96 }),
    imageFile: "staff_medical_nutritionist_10_1783428781560.webp", slot: "staff-10",
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
  console.log("Removing existing Nutritionists...");
  const existing = sqlite
    .prepare(`SELECT id, name FROM staff WHERE role = ?`)
    .all("Nutritionist") as { id: number; name: string }[];

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

  for (const [i, n] of NUTRITIONISTS.entries()) {
    const skill = skillFromStarsExp(n.stars, n.experienceYears);
    const salary = medicalSalaryFromSkill(skill);
    console.log(`[${i + 1}/10] ${n.name} (${n.nationality}, ★${n.stars}, ${n.experienceYears} yrs) — skill ${skill}`);

    const localPath = resolveLocalImagePath("medical_nutritionist", n.imageFile);
    const imageUrl = await upload(localPath, `staff/medical_nutritionist/${n.slot}.webp`);

    const attributes = {
      schema:               "beach_volleyball_staff",
      version:              "1.0",
      staffType:            "Nutritionist",
      regenerationSeed:     "BVM_NUTRITIONIST_V1_2026_07_07",
      nationality:          n.nationality,
      age:                  n.age,
      gender:               n.gender,
      stars:                n.stars,
      experienceYears:      n.experienceYears,
      salary,
      specialties:          n.specialties,
      description:          n.description,
      ...n.attributes,
    };

    insertStmt.run(
      n.name,
      "Nutritionist",
      n.specialty,
      salary,
      skill,
      null,
      n.nationality,
      imageUrl,
      1,
      n.age,
      skill,
      12,
      n.coachSpeciality,
      "Analytical",
      JSON.stringify(attributes),
      n.specialties[0],
      0,
      skill - 5,
      Math.floor(Date.now() / 1000),
    );

    console.log(`  ✓ inserted → ${imageUrl}`);
  }

  const final = sqlite
    .prepare(`SELECT name, skill_level FROM staff WHERE role = ?`)
    .all("Nutritionist") as { name: string; skill_level: number }[];

  console.log(`\nDone — ${final.length} Nutritionists now in DB:`);
  final.forEach((r) => console.log(`  ${r.name} (skill ${r.skill_level})`));
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  sqlite.close();
  process.exitCode = 1;
});
