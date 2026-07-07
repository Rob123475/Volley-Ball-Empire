/**
 * Replaces the 8 auto-generated Sports Scientists with the real 10 from card images.
 * Run: pnpm --filter @workspace/scripts run seed-sports-scientists
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, "../../");
const SIDECAR = "http://127.0.0.1:1106";
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR!;

const gcs = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  } as object,
  projectId: "",
});

async function upload(localFile: string, entityId: string): Promise<string> {
  const privateDir = PRIVATE_OBJECT_DIR.endsWith("/") ? PRIVATE_OBJECT_DIR : `${PRIVATE_OBJECT_DIR}/`;
  const parts = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const slashIdx = parts.indexOf("/");
  const bucketName = slashIdx === -1 ? parts.replace(/\/$/, "") : parts.slice(0, slashIdx);
  const prefix = slashIdx === -1 ? "" : parts.slice(slashIdx + 1);
  await gcs.bucket(bucketName).file(`${prefix}${entityId}`).save(readFileSync(localFile), {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return `/objects/${entityId}`;
}

const SCIENTISTS = [
  { name: "Dr. Matthew Anderson",  nationality: "Australian",    age: 38, exp: 12, specialty: "Team Sports Scientist",        coachSpeciality: "Performance Analysis",    skill: 85, salary: "5800", imageFile: "staff_medical_science_01_1783426769412.webp",  slot: "staff-01" },
  { name: "Dr. Emma Clarke",       nationality: "Australian",    age: 33, exp:  8, specialty: "Team Sports Scientist",        coachSpeciality: "Athlete Monitoring",      skill: 80, salary: "5200", imageFile: "staff_medical_science_02_1783426774476.webp",  slot: "staff-02" },
  { name: "Dr. Zandile Mokwena",   nationality: "South African", age: 36, exp: 11, specialty: "Team Sports Scientist",        coachSpeciality: "Performance Analysis",    skill: 84, salary: "5600", imageFile: "staff_medical_science_03_1783426780943.webp",  slot: "staff-03" },
  { name: "Dr. Luca Moretti",      nationality: "Italian",       age: 33, exp:  8, specialty: "Team Sports Scientist",        coachSpeciality: "Strength & Conditioning", skill: 80, salary: "5200", imageFile: "staff_medical_science_04_1783426790962.webp",  slot: "staff-04" },
  { name: "Dr. Marta García",      nationality: "Spanish",       age: 31, exp:  7, specialty: "Performance Analyst",          coachSpeciality: "Data Analysis",           skill: 78, salary: "5000", imageFile: "staff_medical_science_05_1783426793545.webp",  slot: "staff-05" },
  { name: "Dr. James O'Connor",    nationality: "Australian",    age: 34, exp:  9, specialty: "Performance Specialist",       coachSpeciality: "Athletic Performance",    skill: 82, salary: "5400", imageFile: "staff_medical_science_06_1783426805383.webp",  slot: "staff-06" },
  { name: "Dr. Takashi Mori",      nationality: "Japanese",      age: 38, exp: 12, specialty: "Biomechanics Specialist",      coachSpeciality: "Biomechanics",            skill: 85, salary: "5800", imageFile: "staff_medical_science_07_1783426808116.webp",  slot: "staff-07" },
  { name: "Dr. Emily Thompson",    nationality: "Canadian",      age: 29, exp:  6, specialty: "Exercise Physiologist",        coachSpeciality: "Exercise Physiology",     skill: 77, salary: "4800", imageFile: "staff_medical_science_08_1783426831041.webp",  slot: "staff-08" },
  { name: "Dr. Larissa Almeida",   nationality: "Brazilian",     age: 28, exp:  5, specialty: "Human Performance Specialist", coachSpeciality: "Human Performance",       skill: 75, salary: "4600", imageFile: "staff_medical_science_09_1783426833952.webp",  slot: "staff-09" },
  { name: "Dr. Andrea Bianchi",    nationality: "Italian",       age: 42, exp: 14, specialty: "Data & Analytics Specialist",  coachSpeciality: "Sports Analytics",        skill: 88, salary: "6200", imageFile: "staff_medical_science_10_1783426836339.webp",  slot: "staff-10" },
];

async function main() {
  // ── Step 1: delete the 8 fake auto-generated Sports Scientists ─────────────
  console.log("Removing 8 auto-generated Sports Scientists...");
  const existing = await db
    .select({ id: staffTable.id, name: staffTable.name })
    .from(staffTable)
    .where(eq(staffTable.role, "Sports Scientist"));

  if (existing.length > 0) {
    const ids = existing.map((r) => r.id);
    // Null out any FK references first
    await db.execute(
      `UPDATE training_sessions SET coach_id = NULL WHERE coach_id = ANY(ARRAY[${ids.join(",")}]::int[])` as any
    );
    await db.execute(
      `UPDATE continental_scouting_missions SET assigned_staff_id = NULL WHERE assigned_staff_id = ANY(ARRAY[${ids.join(",")}]::int[])` as any
    );
    await db.delete(staffTable).where(inArray(staffTable.id, ids));
    console.log(`  deleted ${ids.length} rows.\n`);
  }

  // ── Step 2: upload images and insert real 10 ───────────────────────────────
  for (const [i, s] of SCIENTISTS.entries()) {
    console.log(`[${i + 1}/10] ${s.name} (${s.nationality}, ${s.exp} yrs)`);
    const imageUrl = await upload(
      resolve(WORKSPACE_ROOT, "attached_assets", s.imageFile),
      `staff/sports_scientist/${s.slot}.webp`,
    );
    await db.insert(staffTable).values({
      name:           s.name,
      role:           "Sports Scientist",
      specialty:      s.specialty,
      age:            s.age,
      nationality:    s.nationality,
      salary:         s.salary,
      skillLevel:     s.skill,
      overallRating:  s.skill,
      contractLength: 12,
      coachSpeciality:s.coachSpeciality,
      personality:    "Analytical",
      specialTrait:   s.specialty,
      attributes: {
        experience:  s.exp,
        starRating:  4,
        specialties: [s.specialty, s.coachSpeciality],
      },
      imageUrl,
      isAvailable:     true,
      isScoutRevealed: false,
      scoutingRating:  s.skill - 5,
    });
    console.log(`  ✓ inserted → ${imageUrl}`);
  }

  console.log(`\nDone — Sports Scientists now at 10. ✅`);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
