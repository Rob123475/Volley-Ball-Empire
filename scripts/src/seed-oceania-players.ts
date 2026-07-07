/**
 * Seed 12 Oceania region draft players with portraits uploaded to object storage.
 * Run: pnpm --filter @workspace/scripts run seed-oceania-players
 *
 * Position mapping from card labels → DB enum:
 *   Outside Hitter / Opposite Hitter → spiker
 *   Middle Blocker                   → blocker
 *   Libero / Defensive Specialist    → defender
 *   Setter                           → setter
 *   All-Rounder                      → all_rounder
 *
 * Note: Cards 09 & 10 both show "Kiriwina Tau" (PNG) at different heights
 * (162cm vs 190cm) — two renders of the same card slot. Both are seeded as-is.
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
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
const PRIVATE_OBJECT_DIR = process.env.PRIVATE_OBJECT_DIR!;

if (!BUCKET_ID || !PRIVATE_OBJECT_DIR) {
  console.error("Missing DEFAULT_OBJECT_STORAGE_BUCKET_ID or PRIVATE_OBJECT_DIR");
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

async function uploadPlayerImage(localPath: string, entityId: string): Promise<string> {
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

type Position = "spiker" | "defender" | "setter" | "blocker" | "all_rounder";
type Potential = "Elite" | "High" | "Average";

interface PlayerDef {
  name: string;
  nationality: string;
  age: number;
  heightCm: number;
  position: Position;
  potential: Potential;
  stats: {
    speed: number;
    power: number;
    defense: number;
    serve: number;
    block: number;
    stamina: number;
  };
  salary: number;
  askingPrice: number;
  imageFile: string;
}

const PLAYERS: PlayerDef[] = [
  {
    name: "Charlotte Wade",
    nationality: "Australia",
    age: 26,
    heightCm: 178,
    position: "spiker",
    potential: "High",
    stats: { speed: 80, power: 84, defense: 65, serve: 73, block: 67, stamina: 76 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_oceania_01_1783395436468.webp",
  },
  {
    name: "Tiare Morrison",
    nationality: "Australia",
    age: 24,
    heightCm: 180,
    position: "spiker",
    potential: "Elite",
    stats: { speed: 82, power: 88, defense: 64, serve: 74, block: 70, stamina: 78 },
    salary: 14500,
    askingPrice: 174000,
    imageFile: "player_senior_oceania_02_1783395442853.webp",
  },
  {
    name: "Zoe Walker",
    nationality: "New Zealand",
    age: 25,
    heightCm: 181,
    position: "blocker",
    potential: "High",
    stats: { speed: 68, power: 82, defense: 67, serve: 64, block: 86, stamina: 73 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_oceania_03_1783395452770.webp",
  },
  {
    name: "Lily Mackenzie",
    nationality: "New Zealand",
    age: 23,
    heightCm: 174,
    position: "defender",
    potential: "High",
    stats: { speed: 84, power: 59, defense: 85, serve: 66, block: 53, stamina: 82 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_oceania_04_1783395460200.webp",
  },
  {
    name: "Aria Nasevui",
    nationality: "Fiji",
    age: 24,
    heightCm: 180,
    position: "defender",
    potential: "Average",
    stats: { speed: 80, power: 61, defense: 80, serve: 63, block: 56, stamina: 77 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_oceania_05_1783395472331.webp",
  },
  {
    name: "Lena Raitoga",
    nationality: "Fiji",
    age: 23,
    heightCm: 176,
    position: "spiker",
    potential: "Average",
    stats: { speed: 78, power: 78, defense: 62, serve: 68, block: 63, stamina: 73 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_oceania_06_1783395504661.webp",
  },
  {
    name: "Tiafafine Leota",
    nationality: "Samoa",
    age: 22,
    heightCm: 168,
    position: "setter",
    potential: "Average",
    stats: { speed: 75, power: 63, defense: 70, serve: 80, block: 56, stamina: 73 },
    salary: 7500,
    askingPrice: 90000,
    imageFile: "player_senior_oceania_07_1783395520898.webp",
  },
  {
    name: "Leilani Fa'asamoa",
    nationality: "Samoa",
    age: 24,
    heightCm: 185,
    position: "spiker",
    potential: "High",
    stats: { speed: 71, power: 86, defense: 62, serve: 70, block: 73, stamina: 72 },
    salary: 11500,
    askingPrice: 138000,
    imageFile: "player_senior_oceania_08_1783395530031.webp",
  },
  {
    // Card label shows height 162cm; alternate render at 190cm is player 10
    name: "Kiriwina Tau",
    nationality: "Papua New Guinea",
    age: 21,
    heightCm: 162,
    position: "all_rounder",
    potential: "Average",
    stats: { speed: 75, power: 70, defense: 70, serve: 69, block: 65, stamina: 72 },
    salary: 7500,
    askingPrice: 90000,
    imageFile: "player_senior_oceania_09_1783395536317.webp",
  },
  {
    // Second render of same card slot — 190cm build, treated as separate entry
    name: "Kiriwina Tau",
    nationality: "Papua New Guinea",
    age: 21,
    heightCm: 190,
    position: "all_rounder",
    potential: "High",
    stats: { speed: 73, power: 83, defense: 68, serve: 70, block: 77, stamina: 72 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_oceania_10_1783395542597.webp",
  },
  {
    name: "Mahina Teheiura",
    nationality: "Tahiti",
    age: 22,
    heightCm: 168,
    position: "defender",
    potential: "Average",
    stats: { speed: 81, power: 57, defense: 82, serve: 64, block: 52, stamina: 79 },
    salary: 8000,
    askingPrice: 96000,
    imageFile: "player_senior_oceania_11_1783395548644.webp",
  },
  {
    name: "Vahiné Maohi",
    nationality: "Tahiti",
    age: 24,
    heightCm: 187,
    position: "spiker",
    potential: "High",
    stats: { speed: 73, power: 87, defense: 63, serve: 71, block: 74, stamina: 74 },
    salary: 12000,
    askingPrice: 144000,
    imageFile: "player_senior_oceania_12_1783395555449.webp",
  },
];

async function main() {
  console.log("=== Seeding 12 Oceania draft players ===\n");

  for (const [i, player] of PLAYERS.entries()) {
    console.log(`[${i + 1}/12] ${player.name} (${player.nationality})`);

    const localPath = resolve(WORKSPACE_ROOT, "attached_assets", player.imageFile);
    const entityId = `player-cards/oceania/player-${String(i + 1).padStart(2, "0")}.webp`;

    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadPlayerImage(localPath, entityId);
    } catch (err) {
      console.error(`  ERROR uploading image: ${err}`);
    }

    await db.insert(playersTable).values({
      name: player.name,
      nationality: player.nationality,
      age: player.age,
      height: String(player.heightCm),
      position: player.position,
      speed: player.stats.speed,
      power: player.stats.power,
      defense: player.stats.defense,
      serve: player.stats.serve,
      block: player.stats.block,
      stamina: player.stats.stamina,
      potential: player.potential,
      salary: String(player.salary),
      askingPrice: String(player.askingPrice),
      continent: "Oceania",
      imageUrl,
      teamId: null,
      isDraftPlayer: true,
      isRetired: false,
    });

    console.log(`  inserted → imageUrl=${imageUrl}\n`);
  }

  console.log("=== Done! 12 Oceania players seeded. ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
