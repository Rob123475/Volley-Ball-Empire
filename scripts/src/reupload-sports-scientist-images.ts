/**
 * Re-uploads updated sports scientist portrait images to GCS (same paths, overwrites).
 * Run: pnpm --filter @workspace/scripts run reupload-sports-scientist-images
 */
import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

async function upload(localFile: string, entityId: string): Promise<void> {
  const privateDir = PRIVATE_OBJECT_DIR.endsWith("/") ? PRIVATE_OBJECT_DIR : `${PRIVATE_OBJECT_DIR}/`;
  const parts = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const slashIdx = parts.indexOf("/");
  const bucketName = slashIdx === -1 ? parts.replace(/\/$/, "") : parts.slice(0, slashIdx);
  const prefix = slashIdx === -1 ? "" : parts.slice(slashIdx + 1);
  await gcs.bucket(bucketName).file(`${prefix}${entityId}`).save(readFileSync(localFile), {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
}

const IMAGES = [
  { name: "Dr. Matthew Anderson",  file: "staff_medical_science_01_1783429128521.webp", slot: "staff-01" },
  { name: "Dr. Emma Clarke",       file: "staff_medical_science_02_1783429130327.webp", slot: "staff-02" },
  { name: "Dr. Zandile Mokwena",   file: "staff_medical_science_03_1783429132489.webp", slot: "staff-03" },
  { name: "Dr. Luca Moretti",      file: "staff_medical_science_04_1783429134240.webp", slot: "staff-04" },
  { name: "Dr. Marta García",      file: "staff_medical_science_05_1783429146412.webp", slot: "staff-05" },
  { name: "Dr. James O'Connor",    file: "staff_medical_science_06_1783429148278.webp", slot: "staff-06" },
  { name: "Dr. Takashi Mori",      file: "staff_medical_science_07_1783429150438.webp", slot: "staff-07" },
  { name: "Dr. Emily Thompson",    file: "staff_medical_science_08_1783429152793.webp", slot: "staff-08" },
  { name: "Dr. Larissa Almeida",   file: "staff_medical_science_09_1783429154831.webp", slot: "staff-09" },
  { name: "Dr. Andrea Bianchi",    file: "staff_medical_science_10_1783429156985.webp", slot: "staff-10" },
];

async function main() {
  console.log("Re-uploading updated sports scientist portraits...\n");
  for (const [i, img] of IMAGES.entries()) {
    const gcsPath = `staff/sports_scientist/${img.slot}.webp`;
    console.log(`[${i + 1}/10] ${img.name}`);
    await upload(resolve(WORKSPACE_ROOT, "attached_assets", img.file), gcsPath);
    console.log(`  ✓ → /objects/${gcsPath}`);
  }
  console.log("\nDone — all 10 portraits updated.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
