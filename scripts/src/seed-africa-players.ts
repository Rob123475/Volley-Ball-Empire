/**
 * Seed 12 Africa region draft players with portraits uploaded to object storage.
 * Run: pnpm --filter @workspace/scripts run seed-africa-players
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { localImageUrl } from "./lib/local-image";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, "../../");

async function uploadPlayerImage(
  _localPath: string,
  _entityId: string,
  sourceFileName: string,
): Promise<string | null> {
  return localImageUrl(sourceFileName);
}

// ---------------------------------------------------------------------------
// Player definitions
// ---------------------------------------------------------------------------

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
  imageFile: string; // relative to attached_assets/
}

const PLAYERS: PlayerDef[] = [
  {
    name: "Zandile Mthethwa",
    nationality: "South Africa",
    age: 24,
    heightCm: 176,
    position: "spiker",
    potential: "High",
    stats: { speed: 78, power: 84, defense: 64, serve: 71, block: 66, stamina: 76 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_africa_01_1783393821470.webp",
  },
  {
    name: "Nompumelelo Dlamini",
    nationality: "South Africa",
    age: 26,
    heightCm: 171,
    position: "defender",
    potential: "Average",
    stats: { speed: 83, power: 58, defense: 85, serve: 67, block: 52, stamina: 79 },
    salary: 9000,
    askingPrice: 108000,
    imageFile: "player_senior_africa_02_1783393830703.webp",
  },
  {
    name: "Chinaza Okoro",
    nationality: "Nigeria",
    age: 24,
    heightCm: 175,
    position: "setter",
    potential: "High",
    stats: { speed: 74, power: 63, defense: 76, serve: 83, block: 59, stamina: 75 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_africa_03_1783393839383.webp",
  },
  {
    name: "Amara Udeh",
    nationality: "Nigeria",
    age: 27,
    heightCm: 182,
    position: "blocker",
    potential: "Average",
    stats: { speed: 66, power: 79, defense: 68, serve: 64, block: 86, stamina: 72 },
    salary: 9500,
    askingPrice: 114000,
    imageFile: "player_senior_africa_04_1783393843180.webp",
  },
  {
    name: "Amira El Mansouri",
    nationality: "Morocco",
    age: 26,
    heightCm: 171,
    position: "defender",
    potential: "Average",
    stats: { speed: 81, power: 60, defense: 83, serve: 66, block: 54, stamina: 78 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_africa_05_1783393853040.webp",
  },
  {
    name: "Laila El Hassani",
    nationality: "Morocco",
    age: 25,
    heightCm: 180,
    position: "spiker",
    potential: "Elite",
    stats: { speed: 76, power: 86, defense: 62, serve: 72, block: 68, stamina: 74 },
    salary: 14000,
    askingPrice: 168000,
    imageFile: "player_senior_africa_06_1783393856209.webp",
  },
  {
    name: "Salma Benyahia",
    nationality: "Egypt",
    age: 27,
    heightCm: 172,
    position: "setter",
    potential: "Average",
    stats: { speed: 72, power: 61, defense: 74, serve: 81, block: 57, stamina: 73 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_africa_07_1783393858960.webp",
  },
  {
    name: "Layla Hassan",
    nationality: "Egypt",
    age: 24,
    heightCm: 178,
    position: "spiker",
    potential: "High",
    stats: { speed: 80, power: 82, defense: 63, serve: 70, block: 65, stamina: 77 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_africa_08_1783393862162.webp",
  },
  {
    name: "Sarah Ben Ammar",
    nationality: "Tunisia",
    age: 24,
    heightCm: 167,
    position: "all_rounder",
    potential: "High",
    stats: { speed: 74, power: 72, defense: 74, serve: 73, block: 71, stamina: 76 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_africa_09_1783393882630.webp",
  },
  {
    name: "Habiba Mzoughi",
    nationality: "Tunisia",
    age: 25,
    heightCm: 188,
    position: "blocker",
    potential: "Elite",
    stats: { speed: 67, power: 81, defense: 65, serve: 62, block: 88, stamina: 70 },
    salary: 14500,
    askingPrice: 174000,
    imageFile: "player_senior_africa_10_1783393885422.webp",
  },
  {
    name: "Wanjiru Kimani",
    nationality: "Kenya",
    age: 25,
    heightCm: 178,
    position: "blocker",
    potential: "High",
    stats: { speed: 70, power: 77, defense: 66, serve: 63, block: 84, stamina: 73 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_africa_11_1783393887533.webp",
  },
  {
    name: "Neema Mwangi",
    nationality: "Kenya",
    age: 24,
    heightCm: 181,
    position: "setter",
    potential: "High",
    stats: { speed: 73, power: 65, defense: 75, serve: 82, block: 61, stamina: 74 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_africa_12_1783393890875.webp",
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Seeding 12 Africa draft players ===\n");

  for (const [i, player] of PLAYERS.entries()) {
    console.log(`[${i + 1}/12] ${player.name} (${player.nationality})`);

    const localPath = resolve(WORKSPACE_ROOT, "attached_assets", player.imageFile);
    const entityId = `player-cards/africa/player-${String(i + 1).padStart(2, "0")}.webp`;

    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadPlayerImage(localPath, entityId, player.imageFile);
    } catch (err) {
      console.error(`  ERROR uploading image: ${err}`);
    }

    await db.insert(playersTable).values({
      name: player.name,
      nationality: player.nationality,
      age: player.age,
      height: player.heightCm,
      position: player.position,
      speed: player.stats.speed,
      power: player.stats.power,
      defense: player.stats.defense,
      serve: player.stats.serve,
      block: player.stats.block,
      stamina: player.stats.stamina,
      potential: player.potential,
      salary: player.salary,
      askingPrice: player.askingPrice,
      continent: "Africa & Middle East",
      imageUrl,
      teamId: null,
      isDraftPlayer: true,
      isRetired: false,
    });

    console.log(`  inserted → imageUrl=${imageUrl}\n`);
  }

  console.log("=== Done! 12 players seeded. ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
