/**
 * Uploads the new Jessica Morris portrait to GCS, overwriting the existing
 * player-cards/n-america/player-05.webp at the same path.
 * Run: pnpm --filter @workspace/scripts run upload-jessica-morris
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
  const fullPath = `${prefix}${entityId}`;
  console.log(`  Uploading to bucket=${bucketName} path=${fullPath}`);
  await gcs.bucket(bucketName).file(fullPath).save(readFileSync(localFile), {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  return `/objects/${entityId}`;
}

async function main() {
  const localFile = resolve(WORKSPACE_ROOT, "attached_assets/player_senior_n.america_05_1783471477162.webp");
  const entityId  = "player-cards/n-america/player-05.webp";

  console.log(`⏳  Uploading Jessica Morris portrait…`);
  console.log(`  Source : ${localFile}`);
  const objectPath = await upload(localFile, entityId);
  console.log(`✅  Uploaded → ${objectPath}`);
  console.log("   DB image_url unchanged — both Jessica Morris records already point to this path.");
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
