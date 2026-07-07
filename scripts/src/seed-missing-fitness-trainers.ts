import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { staffTable } from "@workspace/db/schema";

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
  const objectName = `${prefix}${entityId}`;
  await gcs.bucket(bucketName).file(objectName).save(readFileSync(localFile), {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  console.log(`  uploaded → gs://${bucketName}/${objectName}`);
  return `/objects/${entityId}`;
}

async function main() {
  // ── Emily Carter ─────────────────────────────────────────────────────────
  console.log("[1/2] Emily Carter");
  const emilyUrl = await upload(
    resolve(WORKSPACE_ROOT, "attached_assets/staff_fitness_trainer_03_1783426200690.webp"),
    "staff/fitness_trainer/staff-09.webp",
  );
  await db.insert(staffTable).values({
    name: "Emily Carter",
    role: "Fitness Trainer",
    specialty: "Strength Training & Conditioning",
    age: 32,
    nationality: "Australian",
    salary: "5200",
    skillLevel: 80,
    overallRating: 80,
    contractLength: 12,
    coachSpeciality: "Strength Training",
    personality: "Motivator",
    specialTrait: "Flexibility & Mobility Expert",
    attributes: {
      experience: 6,
      specialties: ["Strength Training", "Conditioning", "Flexibility & Mobility", "Nutrition Coaching"],
      starRating: 4,
    },
    imageUrl: emilyUrl,
    isAvailable: true,
    isScoutRevealed: false,
    scoutingRating: 75,
  });
  console.log(`  inserted → ${emilyUrl}\n`);

  // ── Sofia Bianchi ─────────────────────────────────────────────────────────
  console.log("[2/2] Sofia Bianchi");
  const sofiaUrl = await upload(
    resolve(WORKSPACE_ROOT, "attached_assets/staff_fitness_trainer_04_1783426208396.webp"),
    "staff/fitness_trainer/staff-10.webp",
  );
  await db.insert(staffTable).values({
    name: "Sofia Bianchi",
    role: "Fitness Trainer",
    specialty: "HIIT Training & Core Strength",
    age: 29,
    nationality: "Italian",
    salary: "4800",
    skillLevel: 78,
    overallRating: 78,
    contractLength: 12,
    coachSpeciality: "HIIT Training",
    personality: "Disciplined",
    specialTrait: "Recovery & Rehab Specialist",
    attributes: {
      experience: 4,
      specialties: ["HIIT Training", "Core Strength", "Recovery & Rehab", "Performance Testing"],
      starRating: 4,
    },
    imageUrl: sofiaUrl,
    isAvailable: true,
    isScoutRevealed: false,
    scoutingRating: 72,
  });
  console.log(`  inserted → ${sofiaUrl}\n`);

  console.log("Done — Fitness Trainers now at 10.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
