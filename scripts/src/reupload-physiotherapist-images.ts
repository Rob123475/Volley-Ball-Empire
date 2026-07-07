/**
 * Re-uploads updated physiotherapist portrait images to GCS (same paths, overwrites).
 * Run: pnpm --filter @workspace/scripts run reupload-physiotherapist-images
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

const IMAGES = [
  { name: "Dr. Isabella Conti",    file: "staff_medical_physiotherapist_01_1783428952557.webp", slot: "staff-01" },
  { name: "Dr. Sipho Dlamini",     file: "staff_medical_physiotherapist_02_1783428954796.webp", slot: "staff-02" },
  { name: "Dr. Anastasia Ivanova", file: "staff_medical_physiotherapist_03_1783428956981.webp", slot: "staff-03" },
  { name: "Dr. Nattaya Somboon",   file: "staff_medical_physiotherapist_04_1783428959298.webp", slot: "staff-04" },
  { name: "Dr. Anita Sharma",      file: "staff_medical_physiotherapist_05_1783428970637.webp", slot: "staff-05" },
  { name: "Dr. Emily Harrison",    file: "staff_medical_physiotherapist_06_1783428972329.webp", slot: "staff-06" },
  { name: "Irina Morozova",        file: "staff_medical_physiotherapist_07_1783428974450.webp", slot: "staff-07" },
  { name: "Alexei Mironov",        file: "staff_medical_physiotherapist_08_1783428978628.webp", slot: "staff-08" },
  { name: "Mei Ling Tan",          file: "staff_medical_physiotherapist_09_1783428981216.webp", slot: "staff-09" },
  { name: "Nikita Belyakov",       file: "staff_medical_physiotherapist_10_1783428983006.webp", slot: "staff-10" },
];

async function main() {
  console.log("Re-uploading updated physiotherapist portraits...\n");
  for (const [i, img] of IMAGES.entries()) {
    const gcsPath = `staff/physiotherapist/${img.slot}.webp`;
    console.log(`[${i + 1}/10] ${img.name}`);
    await upload(resolve(WORKSPACE_ROOT, "attached_assets", img.file), gcsPath);
    console.log(`  ✓ → /objects/${gcsPath}`);
  }
  console.log("\nDone — all 10 portraits updated.");
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
