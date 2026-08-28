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
// slot number so both trainers still resolve to a real local portrait.
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

const findExistingStmt = sqlite.prepare(`SELECT id FROM staff WHERE name = ? AND role = ?`);
const insertStmt = sqlite.prepare(`
  INSERT INTO staff (
    name, role, specialty, base_salary, skill_level, nationality, image_url,
    base_age, overall_rating, coach_speciality, personality,
    attributes, special_trait, scouting_rating, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Idempotent: skip a trainer that's already in the DB rather than inserting a
// duplicate on a second run.
function insertIfMissing(row: {
  name: string; specialty: string; age: number; nationality: string; salary: number;
  skillLevel: number; coachSpeciality: string; personality: string; specialTrait: string;
  attributes: Record<string, unknown>; imageUrl: string; scoutingRating: number;
}): boolean {
  const already = findExistingStmt.get(row.name, "Fitness Trainer") as { id: number } | undefined;
  if (already) {
    console.log(`  already seeded (id=${already.id}), skipping`);
    return false;
  }
  insertStmt.run(
    row.name,
    "Fitness Trainer",
    row.specialty,
    row.salary,
    row.skillLevel,
    row.nationality,
    row.imageUrl,
    row.age,
    row.skillLevel,
    row.coachSpeciality,
    row.personality,
    JSON.stringify(row.attributes),
    row.specialTrait,
    row.scoutingRating,
    Math.floor(Date.now() / 1000),
  );
  return true;
}

async function main() {
  // ── Emily Carter ─────────────────────────────────────────────────────────
  console.log("[1/2] Emily Carter");
  const emilyLocalPath = resolveLocalImagePath("fitness_trainer", "staff_fitness_trainer_03_1783426200690.webp");
  const emilyUrl = await upload(emilyLocalPath, "staff/fitness_trainer/staff-09.webp");
  const emilyInserted = insertIfMissing({
    name: "Emily Carter",
    specialty: "Strength Training & Conditioning",
    age: 32,
    nationality: "Australian",
    salary: 5200,
    skillLevel: 80,
    coachSpeciality: "Strength Training",
    personality: "Motivator",
    specialTrait: "Flexibility & Mobility Expert",
    attributes: {
      experience: 6,
      specialties: ["Strength Training", "Conditioning", "Flexibility & Mobility", "Nutrition Coaching"],
      starRating: 4,
    },
    imageUrl: emilyUrl,
    scoutingRating: 75,
  });
  if (emilyInserted) console.log(`  inserted → ${emilyUrl}\n`);

  // ── Sofia Bianchi ─────────────────────────────────────────────────────────
  console.log("[2/2] Sofia Bianchi");
  const sofiaLocalPath = resolveLocalImagePath("fitness_trainer", "staff_fitness_trainer_04_1783426208396.webp");
  const sofiaUrl = await upload(sofiaLocalPath, "staff/fitness_trainer/staff-10.webp");
  const sofiaInserted = insertIfMissing({
    name: "Sofia Bianchi",
    specialty: "HIIT Training & Core Strength",
    age: 29,
    nationality: "Italian",
    salary: 4800,
    skillLevel: 78,
    coachSpeciality: "HIIT Training",
    personality: "Disciplined",
    specialTrait: "Recovery & Rehab Specialist",
    attributes: {
      experience: 4,
      specialties: ["HIIT Training", "Core Strength", "Recovery & Rehab", "Performance Testing"],
      starRating: 4,
    },
    imageUrl: sofiaUrl,
    scoutingRating: 72,
  });
  if (sofiaInserted) console.log(`  inserted → ${sofiaUrl}\n`);

  const final = sqlite
    .prepare(`SELECT COUNT(*) c FROM staff WHERE role = ?`)
    .get("Fitness Trainer") as { c: number };
  console.log(`Done — Fitness Trainers now at ${final.c}.`);
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  sqlite.close();
  process.exitCode = 1;
});
