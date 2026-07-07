/**
 * Seed female youth players from the most recent international file.
 * Run: pnpm --filter @workspace/scripts run seed-youth-players
 */

import { Storage } from "@google-cloud/storage";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, "../../");

const SIDECAR = "http://127.0.0.1:1106";
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR!;

if (!PRIVATE_OBJECT_DIR) {
  console.error("Missing PRIVATE_OBJECT_DIR");
  process.exit(1);
}

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

async function uploadImage(localPath: string, entityId: string): Promise<string> {
  const privateDir = PRIVATE_OBJECT_DIR.endsWith("/")
    ? PRIVATE_OBJECT_DIR
    : `${PRIVATE_OBJECT_DIR}/`;

  const parts = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const slashIdx = parts.indexOf("/");
  const bucketName = slashIdx === -1 ? parts.replace(/\/$/, "") : parts.slice(0, slashIdx);
  const prefix = slashIdx === -1 ? "" : parts.slice(slashIdx + 1);

  const objectName = `${prefix}${entityId}`;
  const bucket = gcs.bucket(bucketName);
  const file = bucket.file(objectName);

  const content = readFileSync(localPath);
  await file.save(content, {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  console.log(`  uploaded → gs://${bucketName}/${objectName}`);
  return `/objects/${entityId}`;
}

interface RawYouthPlayer {
  id: string;
  fullName: string;
  gender: string;
  nationality: string;
  continent: string;
  age: number;
  height: number;
  primaryRole?: string;
  role?: string;
  attackRating: number;
  defenceRating: number;
  serveRating: number;
  speedRating: number;
  staminaRating: number;
  potential: number;
}

type Position = "spiker" | "defender" | "setter" | "blocker" | "all_rounder";
type Potential = "Elite" | "High" | "Average" | "Below Average" | "Poor";

function mapPosition(role: string | undefined): Position {
  if (!role) return "all_rounder";
  const r = role.toLowerCase();
  if (r === "server" || r === "attacker") return "spiker";
  if (r === "setter") return "setter";
  if (r === "blocker") return "blocker";
  if (r === "defender" || r === "libero") return "defender";
  return "all_rounder";
}

function mapPotential(p: number): Potential {
  if (p >= 5) return "Elite";
  if (p === 4) return "High";
  if (p === 3) return "Average";
  if (p === 2) return "Below Average";
  return "Poor";
}

function mapContinent(c: string): string {
  if (c === "Africa") return "Africa & Middle East";
  return c;
}

async function main() {
  // Load the most recent international youth JSON file
  const jsonPath = resolve(
    WORKSPACE_ROOT,
    "attached_assets",
    "youthPlayers_international_1782962759017.json"
  );
  const raw: RawYouthPlayer[] = JSON.parse(readFileSync(jsonPath, "utf-8"));

  // Filter to female only
  const rawAll = JSON.parse(readFileSync(jsonPath, "utf-8")) as Array<RawYouthPlayer & { gender: string }>;
  const females = rawAll.filter((p) => p.gender === "Female");

  console.log(`=== Seeding ${females.length} female youth players ===\n`);

  // Upload the shared youth card image once
  const youthCardLocal = resolve(
    WORKSPACE_ROOT,
    "attached_assets",
    "player_youth_card_01_1782960894655.webp"
  );
  const youthCardEntityId = "youth-cards/youth-card.webp";

  console.log("Uploading shared youth card image...");
  let sharedImageUrl: string | null = null;
  try {
    sharedImageUrl = await uploadImage(youthCardLocal, youthCardEntityId);
    console.log(`  shared image URL: ${sharedImageUrl}\n`);
  } catch (err) {
    console.error(`ERROR uploading youth card image: ${err}`);
  }

  let inserted = 0;

  for (const [i, player] of females.entries()) {
    const role = player.primaryRole ?? player.role;
    const position = mapPosition(role);
    const potential = mapPotential(player.potential);
    const continent = mapContinent(player.continent);

    // Derive block from average of attack and defence (no explicit block stat)
    const block = Math.round((player.attackRating + player.defenceRating) / 2);

    console.log(`[${i + 1}/${females.length}] ${player.fullName} (${player.nationality}) — ${role} — pot:${potential}`);

    await db.insert(playersTable).values({
      name: player.fullName,
      nationality: player.nationality,
      age: player.age,
      height: String(player.height),
      position,
      speed: player.speedRating,
      power: player.attackRating,
      defense: player.defenceRating,
      serve: player.serveRating,
      block,
      stamina: player.staminaRating,
      potential,
      salary: "0",
      askingPrice: null,
      continent,
      imageUrl: sharedImageUrl,
      teamId: null,
      isDraftPlayer: false,
      playerType: "youth",
      isRetired: false,
    });

    inserted++;
  }

  console.log(`\n=== Done! ${inserted} female youth players seeded. ===`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
