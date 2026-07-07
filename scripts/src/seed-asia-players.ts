/**
 * Seed 12 Asia region draft players with portraits uploaded to object storage.
 * Run: pnpm --filter @workspace/scripts run seed-asia-players
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
    name: "Liu Yi",
    nationality: "China",
    age: 24,
    heightCm: 179,
    position: "spiker",
    potential: "High",
    stats: { speed: 80, power: 85, defense: 63, serve: 72, block: 67, stamina: 77 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_asia_01_1783394415403.webp",
  },
  {
    name: "Zhang Wei",
    nationality: "China",
    age: 22,
    heightCm: 177,
    position: "all_rounder",
    potential: "High",
    stats: { speed: 75, power: 71, defense: 73, serve: 72, block: 69, stamina: 74 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_asia_02_1783394425596.webp",
  },
  {
    name: "Nuttanan Srisung",
    nationality: "Thailand",
    age: 24,
    heightCm: 168,
    position: "defender",
    potential: "Average",
    stats: { speed: 84, power: 57, defense: 83, serve: 66, block: 51, stamina: 80 },
    salary: 9000,
    askingPrice: 108000,
    imageFile: "player_senior_asia_03_1783394434811.webp",
  },
  {
    name: "Kanlaya Pornpun",
    nationality: "Thailand",
    age: 22,
    heightCm: 161,
    position: "spiker",
    potential: "High",
    stats: { speed: 82, power: 78, defense: 60, serve: 69, block: 62, stamina: 75 },
    salary: 9500,
    askingPrice: 114000,
    imageFile: "player_senior_asia_04_1783394442768.webp",
  },
  {
    name: "Tran Thi Bich",
    nationality: "Vietnam",
    age: 23,
    heightCm: 173,
    position: "defender",
    potential: "Average",
    stats: { speed: 82, power: 58, defense: 82, serve: 65, block: 52, stamina: 79 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_asia_05_1783394452039.webp",
  },
  {
    name: "Le Minh Anh",
    nationality: "Vietnam",
    age: 21,
    heightCm: 171,
    position: "all_rounder",
    potential: "High",
    stats: { speed: 76, power: 70, defense: 73, serve: 71, block: 68, stamina: 73 },
    salary: 9000,
    askingPrice: 108000,
    imageFile: "player_senior_asia_06_1783394460812.webp",
  },
  {
    name: "Alyssa Valdez",
    nationality: "Philippines",
    age: 24,
    heightCm: 170,
    position: "setter",
    potential: "Average",
    stats: { speed: 73, power: 62, defense: 75, serve: 82, block: 58, stamina: 74 },
    salary: 9000,
    askingPrice: 108000,
    imageFile: "player_senior_asia_07_1783394486242.webp",
  },
  {
    name: "Mika Reyes",
    nationality: "Philippines",
    age: 22,
    heightCm: 176,
    position: "spiker",
    potential: "High",
    stats: { speed: 79, power: 81, defense: 62, serve: 70, block: 64, stamina: 75 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_asia_08_1783394496466.webp",
  },
  {
    name: "Priya Sharma",
    nationality: "India",
    age: 21,
    heightCm: 165,
    position: "all_rounder",
    potential: "High",
    stats: { speed: 74, power: 69, defense: 72, serve: 72, block: 67, stamina: 73 },
    salary: 9000,
    askingPrice: 108000,
    imageFile: "player_senior_asia_09_1783394509793.webp",
  },
  {
    name: "Ananya Iyer",
    nationality: "India",
    age: 25,
    heightCm: 174,
    position: "spiker",
    potential: "Elite",
    stats: { speed: 77, power: 87, defense: 63, serve: 73, block: 69, stamina: 76 },
    salary: 14000,
    askingPrice: 168000,
    imageFile: "player_senior_asia_10_1783394518034.webp",
  },
  {
    name: "Yui Tanaka",
    nationality: "Japan",
    age: 21,
    heightCm: 168,
    position: "defender",
    potential: "High",
    stats: { speed: 85, power: 59, defense: 84, serve: 67, block: 53, stamina: 81 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_asia_11_1783394527837.webp",
  },
  {
    name: "Ayaka Mori",
    nationality: "Japan",
    age: 24,
    heightCm: 165,
    position: "defender",
    potential: "Average",
    stats: { speed: 83, power: 56, defense: 82, serve: 65, block: 50, stamina: 79 },
    salary: 9000,
    askingPrice: 108000,
    imageFile: "player_senior_asia_12_1783394537853.webp",
  },
];

async function main() {
  console.log("=== Seeding 12 Asia draft players ===\n");

  for (const [i, player] of PLAYERS.entries()) {
    console.log(`[${i + 1}/12] ${player.name} (${player.nationality})`);

    const localPath = resolve(WORKSPACE_ROOT, "attached_assets", player.imageFile);
    const entityId = `player-cards/asia/player-${String(i + 1).padStart(2, "0")}.webp`;

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
      continent: "Asia",
      imageUrl,
      teamId: null,
      isDraftPlayer: true,
      isRetired: false,
    });

    console.log(`  inserted → imageUrl=${imageUrl}\n`);
  }

  console.log("=== Done! 12 Asia players seeded. ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
