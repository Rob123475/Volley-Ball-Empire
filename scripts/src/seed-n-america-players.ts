/**
 * Seed 12 North America region draft players with portraits uploaded to object storage.
 * Run: pnpm --filter @workspace/scripts run seed-n-america-players
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
    name: "Kelsey Anderson",
    nationality: "USA",
    age: 24,
    heightCm: 180,
    position: "spiker",
    potential: "Elite",
    stats: { speed: 82, power: 89, defense: 64, serve: 75, block: 70, stamina: 78 },
    salary: 15000,
    askingPrice: 180000,
    imageFile: "player_senior_n.america_01_1783394785140.webp",
  },
  {
    name: "Hailey Carter",
    nationality: "USA",
    age: 22,
    heightCm: 175,
    position: "defender",
    potential: "High",
    stats: { speed: 83, power: 60, defense: 84, serve: 65, block: 55, stamina: 81 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_n.america_02_1783394793117.webp",
  },
  {
    name: "Sofía Ramírez",
    nationality: "Mexico",
    age: 23,
    heightCm: 171,
    position: "setter",
    potential: "High",
    stats: { speed: 78, power: 65, defense: 72, serve: 84, block: 60, stamina: 77 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_n.america_03_1783394801689.webp",
  },
  {
    name: "Valeria Gómez",
    nationality: "Mexico",
    age: 21,
    heightCm: 168,
    position: "all_rounder",
    potential: "Average",
    stats: { speed: 72, power: 71, defense: 72, serve: 71, block: 68, stamina: 72 },
    salary: 8000,
    askingPrice: 96000,
    imageFile: "player_senior_n.america_04_(2)_1783394810833.webp",
  },
  {
    name: "Jessica Morris",
    nationality: "Canada",
    age: 25,
    heightCm: 182,
    position: "spiker",
    potential: "Elite",
    stats: { speed: 74, power: 88, defense: 63, serve: 73, block: 74, stamina: 76 },
    salary: 14500,
    askingPrice: 174000,
    imageFile: "player_senior_n.america_05_1783394820859.webp",
  },
  {
    name: "Olivia MacLean",
    nationality: "Canada",
    age: 22,
    heightCm: 176,
    position: "defender",
    potential: "High",
    stats: { speed: 82, power: 60, defense: 83, serve: 66, block: 54, stamina: 80 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_n.america_06_1783394828801.webp",
  },
  {
    name: "Lissette Morejón",
    nationality: "Cuba",
    age: 24,
    heightCm: 175,
    position: "all_rounder",
    potential: "High",
    stats: { speed: 76, power: 76, defense: 75, serve: 74, block: 72, stamina: 77 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_n.america_07_1783394836605.webp",
  },
  {
    name: "Yarisley Silva",
    nationality: "Cuba",
    age: 21,
    heightCm: 170,
    position: "spiker",
    potential: "Average",
    stats: { speed: 79, power: 78, defense: 61, serve: 69, block: 62, stamina: 74 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_n.america_08_1783394844445.webp",
  },
  {
    name: "María José Alpízar",
    nationality: "Costa Rica",
    age: 23,
    heightCm: 169,
    position: "setter",
    potential: "Average",
    stats: { speed: 76, power: 63, defense: 71, serve: 80, block: 57, stamina: 74 },
    salary: 8000,
    askingPrice: 96000,
    imageFile: "player_senior_n.america_09_1783394851900.webp",
  },
  {
    name: "Daniela Rivera",
    nationality: "Costa Rica",
    age: 22,
    heightCm: 167,
    position: "setter",
    potential: "Average",
    stats: { speed: 75, power: 61, defense: 70, serve: 79, block: 56, stamina: 73 },
    salary: 7500,
    askingPrice: 90000,
    imageFile: "player_senior_n.america_10_1783394860016.webp",
  },
  {
    name: "Niah Myers",
    nationality: "Jamaica",
    age: 22,
    heightCm: 169,
    position: "spiker",
    potential: "High",
    stats: { speed: 84, power: 80, defense: 62, serve: 70, block: 63, stamina: 79 },
    salary: 10000,
    askingPrice: 120000,
    imageFile: "player_senior_n.america_11_1783395303562.webp",
  },
  {
    name: "Jayda Brown",
    nationality: "Jamaica",
    age: 21,
    heightCm: 170,
    position: "blocker",
    potential: "Average",
    stats: { speed: 68, power: 78, defense: 64, serve: 62, block: 82, stamina: 70 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_n.america_12_1783395311267.webp",
  },
];

async function main() {
  console.log("=== Seeding 12 North America draft players ===\n");

  for (const [i, player] of PLAYERS.entries()) {
    console.log(`[${i + 1}/12] ${player.name} (${player.nationality})`);

    const localPath = resolve(WORKSPACE_ROOT, "attached_assets", player.imageFile);
    const entityId = `player-cards/n-america/player-${String(i + 1).padStart(2, "0")}.webp`;

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
      askingPrice: player.askingPrice,
      continent: "North America",
      imageUrl,
      isDraftPlayer: true,
    });

    console.log(`  inserted → imageUrl=${imageUrl}\n`);
  }

  console.log("=== Done! 12 North America players seeded. ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
