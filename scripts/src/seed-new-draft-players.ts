/**
 * Seed 40 new draft players (with portraits) into the draft pool.
 * Stats, salary and potential derived from player card images.
 * Run: pnpm --filter @workspace/scripts run seed-new-draft-players
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
type Potential = "Elite" | "High" | "Average" | "Below Average" | "Poor";

interface PlayerDef {
  name: string;
  nationality: string;
  continent: string;
  age: number;
  heightCm: number;
  position: Position;
  potential: Potential;
  speed: number;
  power: number;
  defense: number;
  serve: number;
  block: number;
  stamina: number;
  salary: number;
  askingPrice: number;
  imageFile: string;
}

// All 40 players — stats derived from card positions, heights, ages and visible star ratings.
// Potential key: Elite(5★), High(4★), Average(3★), Below Average(2★)
const PLAYERS: PlayerDef[] = [
  // ── BATCH 1 ──────────────────────────────────────────────────────────────
  {
    name: "Jessica Madison",
    nationality: "USA",
    continent: "North America",
    age: 29, heightCm: 173, position: "all_rounder", potential: "High",
    speed: 78, power: 77, defense: 74, serve: 76, block: 68, stamina: 75,
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_america_03_1783465720533.webp",
  },
  {
    name: "Mia Anderson",
    nationality: "Australia",
    continent: "Oceania",
    age: 22, heightCm: 176, position: "setter", potential: "Elite",
    speed: 80, power: 60, defense: 74, serve: 86, block: 56, stamina: 78,
    salary: 14000, askingPrice: 168000,
    imageFile: "player_senior_australia_03_1783465720534.webp",
  },
  {
    name: "Tessa Lane",
    nationality: "Australia",
    continent: "Oceania",
    age: 22, heightCm: 174, position: "spiker", potential: "High",
    speed: 79, power: 82, defense: 62, serve: 70, block: 65, stamina: 76,
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_australia_04_1783465720534.webp",
  },
  {
    name: "Kamila Torrez",
    nationality: "Bolivia",
    continent: "South America",
    age: 20, heightCm: 162, position: "defender", potential: "High",
    speed: 82, power: 52, defense: 83, serve: 63, block: 48, stamina: 80,
    salary: 9000, askingPrice: 108000,
    imageFile: "player_senior_bolivia_03_1783465720535.webp",
  },
  {
    name: "Julia Fernandes",
    nationality: "Brazil",
    continent: "South America",
    age: 24, heightCm: 174, position: "all_rounder", potential: "High",
    speed: 77, power: 79, defense: 73, serve: 75, block: 68, stamina: 76,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_brazil_03_1783465720535.webp",
  },
  {
    name: "Emily Roy",
    nationality: "Canada",
    continent: "North America",
    age: 21, heightCm: 168, position: "defender", potential: "High",
    speed: 83, power: 54, defense: 84, serve: 65, block: 50, stamina: 79,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_canada_03_1783465720536.webp",
  },
  {
    name: "Wang Yun",
    nationality: "China",
    continent: "Asia",
    age: 21, heightCm: 175, position: "setter", potential: "Elite",
    speed: 79, power: 62, defense: 75, serve: 87, block: 58, stamina: 77,
    salary: 14500, askingPrice: 174000,
    imageFile: "player_senior_china_03_1783465720536.webp",
  },
  {
    name: "Isabella Moreira",
    nationality: "Costa Rica",
    continent: "North America",
    age: 21, heightCm: 164, position: "setter", potential: "High",
    speed: 78, power: 57, defense: 72, serve: 82, block: 54, stamina: 76,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_costa_rico_03_1783465720537.webp",
  },
  {
    name: "Ava Patel",
    nationality: "England",
    continent: "Europe",
    age: 19, heightCm: 174, position: "setter", potential: "High",
    speed: 76, power: 58, defense: 70, serve: 80, block: 52, stamina: 74,
    salary: 9000, askingPrice: 108000,
    imageFile: "player_senior_england_03_1783465720537.webp",
  },
  {
    name: "Litia Naivakalou",
    nationality: "Fiji",
    continent: "Oceania",
    age: 23, heightCm: 176, position: "defender", potential: "Average",
    speed: 79, power: 54, defense: 80, serve: 62, block: 48, stamina: 77,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_fiji_03_1783465720537.webp",
  },
  {
    name: "Charlotte Moreau",
    nationality: "France",
    continent: "Europe",
    age: 24, heightCm: 182, position: "blocker", potential: "High",
    speed: 65, power: 80, defense: 64, serve: 68, block: 86, stamina: 72,
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_france_02_1783465781449.webp",
  },
  {
    name: "Leila Amiri",
    nationality: "France",
    continent: "Europe",
    age: 26, heightCm: 179, position: "defender", potential: "Average",
    speed: 81, power: 56, defense: 82, serve: 66, block: 52, stamina: 80,
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_france_03_1783465781449.webp",
  },
  {
    name: "Clémence Dubois",
    nationality: "France",
    continent: "Europe",
    age: 25, heightCm: 178, position: "spiker", potential: "High",
    speed: 78, power: 83, defense: 63, serve: 71, block: 67, stamina: 76,
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_france_04_1783465781450.webp",
  },
  {
    name: "Anna Köhler",
    nationality: "Germany",
    continent: "Europe",
    age: 28, heightCm: 180, position: "defender", potential: "High",
    speed: 80, power: 58, defense: 84, serve: 67, block: 55, stamina: 79,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_germany_01_1783465781450.webp",
  },
  {
    name: "Eleni Papadopoulou",
    nationality: "Greece",
    continent: "Europe",
    age: 26, heightCm: 178, position: "spiker", potential: "Average",
    speed: 74, power: 78, defense: 60, serve: 68, block: 63, stamina: 72,
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_greece_01_1783465781451.webp",
  },
  {
    name: "Anastasia Kalogirou",
    nationality: "Greece",
    continent: "Europe",
    age: 31, heightCm: 182, position: "blocker", potential: "Average",
    speed: 62, power: 77, defense: 62, serve: 66, block: 83, stamina: 68,
    salary: 7500, askingPrice: 90000,
    imageFile: "player_senior_greece_02_1783465781451.webp",
  },
  // ── BATCH 2 ──────────────────────────────────────────────────────────────
  {
    // renamed from Eleni to avoid duplicate
    name: "Eleni Papadopoulou",  // same name as greece_01 by design: her card reads ELENI
    nationality: "Greece",
    continent: "Europe",
    age: 23, heightCm: 190, position: "spiker", potential: "Elite",
    speed: 72, power: 88, defense: 60, serve: 70, block: 74, stamina: 74,
    salary: 14000, askingPrice: 168000,
    imageFile: "player_senior_greece_03_1783465781451.webp",
  },
  {
    name: "Giulia Rossi",
    nationality: "Italy",
    continent: "Europe",
    age: 24, heightCm: 182, position: "spiker", potential: "High",
    speed: 77, power: 84, defense: 62, serve: 71, block: 69, stamina: 75,
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_italy_01_1783465781452.webp",
  },
  {
    name: "Martina Bianchi",
    nationality: "Italy",
    continent: "Europe",
    age: 23, heightCm: 180, position: "defender", potential: "High",
    speed: 82, power: 56, defense: 83, serve: 67, block: 53, stamina: 80,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_italy_02_1783465781452.webp",
  },
  {
    name: "Sofia Romano",
    nationality: "Italy",
    continent: "Europe",
    age: 22, heightCm: 162, position: "spiker", potential: "Average",
    speed: 77, power: 76, defense: 60, serve: 68, block: 58, stamina: 73,
    salary: 7500, askingPrice: 90000,
    imageFile: "player_senior_italy_03_1783465781453.webp",
  },
  {
    name: "Kayla Thompson",
    nationality: "Jamaica",
    continent: "North America",
    age: 23, heightCm: 171, position: "all_rounder", potential: "High",
    speed: 80, power: 75, defense: 74, serve: 73, block: 65, stamina: 78,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_jamaica_01_1783465811460.webp",
  },
  {
    name: "Chinenye Okafor",
    nationality: "Nigeria",
    continent: "Africa & Middle East",
    age: 24, heightCm: 178, position: "defender", potential: "High",
    speed: 83, power: 57, defense: 85, serve: 65, block: 51, stamina: 81,
    salary: 9000, askingPrice: 108000,
    imageFile: "player_senior_kenya_03_1783465811461.webp",
  },
  {
    name: "Nurul Ain",
    nationality: "Malaysia",
    continent: "Asia",
    age: 28, heightCm: 173, position: "setter", potential: "Average",
    speed: 74, power: 55, defense: 70, serve: 78, block: 52, stamina: 73,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_malaysia_01_1783465811462.webp",
  },
  {
    name: "Qistina Zulkifli",
    nationality: "Malaysia",
    continent: "Asia",
    age: 26, heightCm: 168, position: "defender", potential: "Average",
    speed: 78, power: 52, defense: 79, serve: 62, block: 47, stamina: 76,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_malaysia_02_1783465811463.webp",
  },
  {
    name: "Aishath Nazeema",
    nationality: "Maldives",
    continent: "Asia",
    age: 25, heightCm: 165, position: "defender", potential: "Average",
    speed: 77, power: 50, defense: 78, serve: 61, block: 45, stamina: 75,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_maldives_01_1783465811463.webp",
  },
  {
    name: "Fathimath Shiuna",
    nationality: "Maldives",
    continent: "Asia",
    age: 24, heightCm: 163, position: "defender", potential: "Average",
    speed: 76, power: 49, defense: 77, serve: 60, block: 44, stamina: 74,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_maldives_02_1783465811464.webp",
  },
  {
    name: "Hinemoa Waikato",
    nationality: "New Zealand",
    continent: "Oceania",
    age: 29, heightCm: 177, position: "defender", potential: "Average",
    speed: 79, power: 55, defense: 81, serve: 64, block: 50, stamina: 77,
    salary: 7500, askingPrice: 90000,
    imageFile: "player_senior_newzealand_03_1783465811465.webp",
  },
  {
    // 5★ on card
    name: "Lucía Martínez",
    nationality: "Peru",
    continent: "South America",
    age: 20, heightCm: 165, position: "defender", potential: "Elite",
    speed: 85, power: 56, defense: 88, serve: 66, block: 52, stamina: 83,
    salary: 13500, askingPrice: 162000,
    imageFile: "player_senior_peru_03_1783465811465.webp",
  },
  {
    // 3★ on card
    name: "Diana Kumul",
    nationality: "Papua New Guinea",
    continent: "Oceania",
    age: 20, heightCm: 158, position: "all_rounder", potential: "Average",
    speed: 73, power: 67, defense: 68, serve: 67, block: 58, stamina: 71,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_png_03_1783465811466.webp",
  },
  {
    name: "Matilde Costa",
    nationality: "Portugal",
    continent: "Europe",
    age: 22, heightCm: 165, position: "defender", potential: "Average",
    speed: 78, power: 52, defense: 79, serve: 63, block: 47, stamina: 76,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_portugal_03_1783465811467.webp",
  },
  {
    // 4★ on card
    name: "Leilani Tufaga",
    nationality: "Samoa",
    continent: "Oceania",
    age: 21, heightCm: 159, position: "setter", potential: "High",
    speed: 76, power: 55, defense: 70, serve: 81, block: 51, stamina: 74,
    salary: 9000, askingPrice: 108000,
    imageFile: "player_senior_samoa_03_1783465869842.webp",
  },
  {
    name: "Lize van der Merwe",
    nationality: "South Africa",
    continent: "Africa & Middle East",
    age: 20, heightCm: 172, position: "setter", potential: "High",
    speed: 77, power: 57, defense: 71, serve: 80, block: 53, stamina: 75,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_south_africa_03_1783465869843.webp",
  },
  // ── BATCH 3 ──────────────────────────────────────────────────────────────
  {
    name: "Sofia Lindström",
    nationality: "Sweden",
    continent: "Europe",
    age: 27, heightCm: 172, position: "setter", potential: "High",
    speed: 78, power: 60, defense: 73, serve: 83, block: 56, stamina: 77,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_sweden_01_1783465869844.webp",
  },
  {
    // very tall all-rounder
    name: "Ella Andersson",
    nationality: "Sweden",
    continent: "Europe",
    age: 22, heightCm: 188, position: "all_rounder", potential: "Elite",
    speed: 76, power: 84, defense: 72, serve: 75, block: 78, stamina: 75,
    salary: 14000, askingPrice: 168000,
    imageFile: "player_senior_sweden_02_1783465869844.webp",
  },
  {
    // very tall defender
    name: "Linnea Sjöström",
    nationality: "Sweden",
    continent: "Europe",
    age: 21, heightCm: 186, position: "defender", potential: "High",
    speed: 80, power: 58, defense: 83, serve: 66, block: 60, stamina: 79,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_sweden_03_1783465869845.webp",
  },
  {
    // 3★ on card
    name: "Moearii Tetuanui",
    nationality: "Tahiti",
    continent: "Oceania",
    age: 20, heightCm: 168, position: "spiker", potential: "Average",
    speed: 75, power: 73, defense: 58, serve: 67, block: 60, stamina: 71,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_tahiti_03_1783465869846.webp",
  },
  {
    name: "Kanokwan P.",
    nationality: "Thailand",
    continent: "Asia",
    age: 24, heightCm: 168, position: "defender", potential: "Average",
    speed: 78, power: 51, defense: 79, serve: 62, block: 46, stamina: 76,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_thailand_03_1783465869846.webp",
  },
  {
    name: "Maheli Fotu",
    nationality: "Tonga",
    continent: "Oceania",
    age: 25, heightCm: 175, position: "all_rounder", potential: "Average",
    speed: 73, power: 74, defense: 70, serve: 68, block: 65, stamina: 72,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_tonga_01_1783465869847.webp",
  },
  {
    // very tall blocker, purple text = High
    name: "Mele Taufua",
    nationality: "Tonga",
    continent: "Oceania",
    age: 22, heightCm: 188, position: "blocker", potential: "High",
    speed: 62, power: 80, defense: 60, serve: 64, block: 88, stamina: 70,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_tonga_02_1783465869847.webp",
  },
  {
    // 4★ on card
    name: "Mahela Fotu",
    nationality: "Tonga",
    continent: "Oceania",
    age: 20, heightCm: 171, position: "blocker", potential: "High",
    speed: 65, power: 76, defense: 59, serve: 63, block: 84, stamina: 69,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_tonga_03_1783465869848.webp",
  },
];

async function main() {
  const batchStart = process.env.BATCH_START ? parseInt(process.env.BATCH_START) - 1 : 0;
  const batchEnd   = process.env.BATCH_END   ? parseInt(process.env.BATCH_END)       : PLAYERS.length;
  const batch = PLAYERS.slice(batchStart, batchEnd);
  console.log(`=== Seeding draft players ${batchStart + 1}–${batchStart + batch.length} of ${PLAYERS.length} ===\n`);

  for (const [bi, player] of batch.entries()) {
    const i = batchStart + bi;
    console.log(`[${i + 1}/${PLAYERS.length}] ${player.name} (${player.nationality}) — ${player.position} — ${player.potential}`);

    const localPath = resolve(WORKSPACE_ROOT, "attached_assets", player.imageFile);
    const entityId = `player-cards/new-draft/player-${String(i + 1).padStart(2, "0")}.webp`;

    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadPlayerImage(localPath, entityId, player.imageFile);
    } catch (err) {
      console.error(`  ERROR uploading image: ${err}`);
    }

    await db.insert(playersTable).values({
      name: player.name,
      nationality: player.nationality,
      continent: player.continent,
      baseAge: player.age,
      height: player.heightCm,
      position: player.position,
      speed: player.speed,
      power: player.power,
      defense: player.defense,
      serve: player.serve,
      block: player.block,
      stamina: player.stamina,
      potential: player.potential,
      askingPrice: player.askingPrice,
      imageUrl,
      isDraftPlayer: true,
    });

    console.log(`  inserted → imageUrl=${imageUrl}\n`);
  }

  console.log(`=== Done! ${batch.length} draft players seeded (${batchStart + 1}–${batchStart + batch.length}). ===`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
