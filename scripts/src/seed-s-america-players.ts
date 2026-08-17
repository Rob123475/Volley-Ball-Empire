/**
 * Seed 12 South America region draft players with portraits uploaded to object storage.
 * Run: pnpm --filter @workspace/scripts run seed-s-america-players
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
