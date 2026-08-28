/**
 * Seed 12 Europe region draft players with portraits uploaded to object storage.
 * Run: pnpm --filter @workspace/scripts run seed-europe-players
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
    name: "Georgia Mears",
    nationality: "England",
    age: 24,
    heightCm: 178,
    position: "spiker",
    potential: "High",
    stats: { speed: 79, power: 83, defense: 64, serve: 72, block: 66, stamina: 76 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_europe_01_1783394597415.webp",
  },
  {
    name: "Emily Harrison",
    nationality: "England",
    age: 24,
    heightCm: 175,
    position: "blocker",
    potential: "High",
    stats: { speed: 67, power: 80, defense: 66, serve: 63, block: 85, stamina: 72 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_europe_02_1783394605016.webp",
  },
  {
    // Age/height not shown on card — assigned reasonable values
    name: "Lucía Martínez",
    nationality: "Spain",
    age: 25,
    heightCm: 175,
    position: "spiker",
    potential: "High",
    stats: { speed: 77, power: 82, defense: 63, serve: 71, block: 65, stamina: 75 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_europe_03_1783394612466.webp",
  },
  {
    // Age/height not shown on card — assigned reasonable values
    name: "Marta Hernández",
    nationality: "Spain",
    age: 26,
    heightCm: 172,
    position: "defender",
    potential: "Average",
    stats: { speed: 83, power: 59, defense: 84, serve: 67, block: 53, stamina: 80 },
    salary: 9000,
    askingPrice: 108000,
    imageFile: "player_senior_europe_04_1783394619604.webp",
  },
  {
    // Age/height not shown on card — assigned reasonable values
    name: "Inês Moreira",
    nationality: "Portugal",
    age: 24,
    heightCm: 173,
    position: "defender",
    potential: "Average",
    stats: { speed: 82, power: 57, defense: 83, serve: 65, block: 51, stamina: 79 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_europe_05_1783394629148.webp",
  },
  {
    // Age/height not shown on card — assigned reasonable values
    name: "Beatriz Almeida",
    nationality: "Portugal",
    age: 27,
    heightCm: 178,
    position: "all_rounder",
    potential: "Average",
    stats: { speed: 71, power: 74, defense: 73, serve: 72, block: 70, stamina: 73 },
    salary: 8500,
    askingPrice: 102000,
    imageFile: "player_senior_europe_06_1783394641072.webp",
  },
  {
    name: "Sanne Keizer",
    nationality: "Netherlands",
    age: 24,
    heightCm: 183,
    position: "spiker",
    potential: "Elite",
    stats: { speed: 76, power: 88, defense: 62, serve: 73, block: 70, stamina: 75 },
    salary: 14500,
    askingPrice: 174000,
    imageFile: "player_senior_europe_07_1783394651676.webp",
  },
  {
    name: "Lieke Jansen",
    nationality: "Netherlands",
    age: 25,
    heightCm: 168,
    position: "spiker",
    potential: "High",
    stats: { speed: 81, power: 80, defense: 63, serve: 71, block: 64, stamina: 77 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_europe_08_1783394660037.webp",
  },
  {
    name: "Léa Giraud",
    nationality: "Monaco",
    age: 22,
    heightCm: 165,
    position: "defender",
    potential: "High",
    stats: { speed: 84, power: 57, defense: 82, serve: 66, block: 52, stamina: 80 },
    salary: 9500,
    askingPrice: 114000,
    imageFile: "player_senior_europe_09_1783394678162.webp",
  },
  {
    name: "Alice Marchand",
    nationality: "Monaco",
    age: 24,
    heightCm: 178,
    position: "spiker",
    potential: "High",
    stats: { speed: 78, power: 84, defense: 63, serve: 71, block: 67, stamina: 76 },
    salary: 11000,
    askingPrice: 132000,
    imageFile: "player_senior_europe_10_1783394686612.webp",
  },
  {
    name: "Lena Schneider",
    nationality: "Germany",
    age: 27,
    heightCm: 179,
    position: "spiker",
    potential: "Elite",
    stats: { speed: 78, power: 87, defense: 64, serve: 74, block: 68, stamina: 77 },
    salary: 14000,
    askingPrice: 168000,
    imageFile: "player_senior_europe_11_1783394695184.webp",
  },
  {
    name: "Leonie Müller",
    nationality: "Germany",
    age: 23,
    heightCm: 176,
    position: "spiker",
    potential: "High",
    stats: { speed: 80, power: 82, defense: 63, serve: 71, block: 65, stamina: 76 },
    salary: 10500,
    askingPrice: 126000,
    imageFile: "player_senior_europe_12_1783394707136.webp",
  },
];

async function main() {
  console.log("=== Seeding 12 Europe draft players ===\n");

  for (const [i, player] of PLAYERS.entries()) {
    console.log(`[${i + 1}/12] ${player.name} (${player.nationality})`);

    const localPath = resolve(WORKSPACE_ROOT, "attached_assets", player.imageFile);
    const entityId = `player-cards/europe/player-${String(i + 1).padStart(2, "0")}.webp`;

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
      continent: "Europe",
      imageUrl,
      isDraftPlayer: true,
      isRetired: false,
    });

    console.log(`  inserted → imageUrl=${imageUrl}\n`);
  }

  console.log("=== Done! 12 Europe players seeded. ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
