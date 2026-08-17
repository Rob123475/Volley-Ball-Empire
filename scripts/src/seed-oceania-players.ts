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
