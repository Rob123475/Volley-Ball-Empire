/**
 * Seed 12 South America region draft players with portraits uploaded to object storage.
 * Run: pnpm --filter @workspace/scripts run seed-s-america-players
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
    name: "Laís Ribeiro",
    nationality: "Brazil",
    age: 24,
    heightCm: 176,
    position: "spiker",
    potential: "Elite",
    stats: { speed: 83, power: 88, defense: 65, serve: 75, block: 68, stamina: 79 },
    salary: 15000,
    askingPrice: 180000,
    imageFile: "player_senior_s.america_01_1783395606836.webp",
  },
  {
    name: "Carolina Santos",
    nationality: "Brazil",
    age: 22,
    heightCm: 168,
    position: "defender",
    potential: "High",
    stats: { speed: 84, power: 60, defense: 84, serve: 65, block: 54, stamina: 81 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_s.america_02_1783395616328.webp",
  },
  {
    name: "Sofía Mastrangelo",
    nationality: "Argentina",
    age: 24,
    heightCm: 175,
    position: "setter",
    potential: "High",
    stats: { speed: 77, power: 66, defense: 72, serve: 84, block: 61, stamina: 77 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_s.america_03_1783395626670.webp",
  },
  {
    name: "Camila Barrios",
    nationality: "Argentina",
    age: 27,
    heightCm: 180,
    position: "blocker",
    potential: "High",
    stats: { speed: 67, power: 81, defense: 66, serve: 63, block: 86, stamina: 72 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_s.america_04._1783395636555.webp",
  },
  {
    name: "Valentina Ospina",
    nationality: "Colombia",
    age: 23,
    heightCm: 172,
    position: "spiker",
    potential: "High",
    stats: { speed: 81, power: 82, defense: 63, serve: 72, block: 65, stamina: 77 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_s.america_05_1783395645204.webp",
  },
  {
    name: "Isabella Rodríguez",
    nationality: "Colombia",
    age: 22,
    heightCm: 168,
    position: "defender",
    potential: "Average",
    stats: { speed: 82, power: 58, defense: 81, serve: 64, block: 52, stamina: 78 },
    salary: 8000,
    askingPrice: 96000,
    imageFile: "player_senior_s.america_06_1783395655525.webp",
  },
  {
    name: "Antonia Reyes",
    nationality: "Chile",
    age: 24,
    heightCm: 172,
    position: "setter",
    potential: "Average",
    stats: { speed: 76, power: 63, defense: 70, serve: 79, block: 57, stamina: 73 },
    salary: 8000,
    askingPrice: 96000,
    imageFile: "player_senior_s.america_07_1783395668802.webp",
  },
  {
    name: "Martina Valdés",
    nationality: "Chile",
    age: 22,
    heightCm: 177,
    position: "all_rounder",
    potential: "Average",
    stats: { speed: 73, power: 73, defense: 72, serve: 71, block: 70, stamina: 73 },
    salary: 8000,
    askingPrice: 96000,
    imageFile: "player_senior_s.america_08_1783395677555.webp",
  },
  {
    name: "Camila Torrez",
    nationality: "Bolivia",
    age: 21,
    heightCm: 178,
    position: "spiker",
    potential: "Average",
    stats: { speed: 79, power: 79, defense: 61, serve: 68, block: 63, stamina: 73 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_s.america_09_1783395687582.webp",
  },
  {
    name: "Noelia Zeballos",
    nationality: "Bolivia",
    age: 23,
    heightCm: 175,
    position: "defender",
    potential: "Average",
    stats: { speed: 81, power: 59, defense: 81, serve: 64, block: 53, stamina: 78 },
    salary: 8000,
    askingPrice: 96000,
    imageFile: "player_senior_s.america_10_1783395695389.webp",
  },
  {
    name: "Valeria Rodríguez",
    nationality: "Peru",
    age: 22,
    heightCm: 172,
    position: "defender",
    potential: "Average",
    stats: { speed: 82, power: 57, defense: 82, serve: 63, block: 51, stamina: 78 },
    salary: 7500,
    askingPrice: 90000,
    imageFile: "player_senior_s.america_11_1783395703727.webp",
  },
  {
    name: "Camila Torres",
    nationality: "Peru",
    age: 23,
    heightCm: 180,
    position: "spiker",
    potential: "High",
    stats: { speed: 78, power: 83, defense: 63, serve: 70, block: 67, stamina: 75 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_s.america_12_1783395712966.webp",
  },
];

async function main() {
  console.log("=== Seeding 12 South America draft players ===\n");

  for (const [i, player] of PLAYERS.entries()) {
    console.log(`[${i + 1}/12] ${player.name} (${player.nationality})`);

    const localPath = resolve(WORKSPACE_ROOT, "attached_assets", player.imageFile);
    const entityId = `player-cards/s-america/player-${String(i + 1).padStart(2, "0")}.webp`;

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
      continent: "South America",
      imageUrl,
      teamId: null,
      isDraftPlayer: true,
      isRetired: false,
    });

    console.log(`  inserted → imageUrl=${imageUrl}\n`);
  }

  console.log("=== Done! 12 South America players seeded. ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
