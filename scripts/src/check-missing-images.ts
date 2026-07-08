/**
 * Checks which player-card images are missing from GCS for s-america and oceania.
 * Run: pnpm --filter @workspace/scripts run check-missing-images
 */
import { Storage } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR!;

const gcs = new Storage({
  credentials: {
    audience: "replit", subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`, type: "external_account",
    credential_source: { url: `${SIDECAR}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  } as object,
  projectId: "",
});

const raw = PRIVATE_OBJECT_DIR.replace(/\/$/, "").replace(/^\//, "");
const slashIdx = raw.indexOf("/");
const bucketName = slashIdx === -1 ? raw : raw.slice(0, slashIdx);
const prefix = slashIdx === -1 ? "" : raw.slice(slashIdx + 1) + "/";

const PATHS = [
  ...Array.from({ length: 12 }, (_, i) => `player-cards/s-america/player-${String(i + 1).padStart(2, "0")}.webp`),
  ...Array.from({ length: 12 }, (_, i) => `player-cards/oceania/player-${String(i + 1).padStart(2, "0")}.webp`),
];

async function main() {
  console.log(`Bucket: ${bucketName}  Prefix: ${prefix}\n`);
  const missing: string[] = [];
  for (const p of PATHS) {
    const [exists] = await gcs.bucket(bucketName).file(`${prefix}${p}`).exists();
    console.log(`${exists ? "✅" : "❌  MISSING"} ${p}`);
    if (!exists) missing.push(p);
  }
  console.log(`\nTotal missing: ${missing.length}`);
  if (missing.length) console.log(missing.map(m => `  • ${m}`).join("\n"));
}

main().catch(err => { console.error(err); process.exit(1); });
