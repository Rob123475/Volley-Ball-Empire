/**
 * Insert 80 new-batch senior free-agent players. Portrait source files live in
 * attached_assets/ and get copied into the served public assets directory:
 *   artifacts/beach-volleyball/public/images/players/seniors/
 *
 * No GCS upload needed — imageUrl points directly at the served public path.
 *
 * Run: pnpm --filter @workspace/scripts run seed-new-batch-players
 * Then: pnpm --filter @workspace/scripts run fill-all-player-development
 *       (to populate the development JSONB for these new rows)
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { localImageUrl } from "./lib/local-image";

type Position  = "spiker" | "defender" | "setter" | "blocker" | "all_rounder";
type Potential = "Elite" | "High" | "Average" | "Below Average" | "Poor";

interface PlayerDef {
  name:        string;
  nationality: string;
  age:         number;
  heightCm:    number;
  position:    Position;
  potential:   Potential;
  stats:       { speed: number; power: number; defense: number; serve: number; block: number; stamina: number };
  salary:      number;
  askingPrice: number;
  imageFile:   string;
  continent:   string;
}

// Stars → potential label
// 5★ = Elite, 4★ = High, 3★ = Average, 2★ = Below Average, 1★ = Poor
//
// Salary bands (approximate, per existing seed convention):
//   Elite  → 14 000 – 15 000
//   High   →  9 500 – 12 000
//   Average→  7 500 –  9 500
//   Below  →  7 000
//   Poor   →  5 500
//
// Contract end: age≤21 → 2029-06-30 | age≤25 → 2028-06-30 | else → 2027-06-30

const PLAYERS: PlayerDef[] = [
  // ── Argentina ────────────────────────────────────────────────────────────────
  {
    name: "Valentina Sosa", nationality: "Argentina", age: 25, heightCm: 188,
    position: "spiker", potential: "Below Average",
    stats: { speed: 75, power: 76, defense: 61, serve: 68, block: 61, stamina: 72 },
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_argentina_03_1784380539808.webp", continent: "South America",
  },

  // ── Bahamas ──────────────────────────────────────────────────────────────────
  {
    name: "Aaliyah Rolle", nationality: "Bahamas", age: 25, heightCm: 178,
    position: "all_rounder", potential: "High",
    stats: { speed: 76, power: 72, defense: 74, serve: 73, block: 70, stamina: 75 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_bahamas_01_1784380539809.webp", continent: "North America",
  },
  {
    name: "Jada Knowles", nationality: "Bahamas", age: 22, heightCm: 173,
    position: "setter", potential: "Average",
    stats: { speed: 74, power: 64, defense: 73, serve: 81, block: 59, stamina: 74 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_bahamas_02_1784380539809.webp", continent: "North America",
  },
  {
    name: "Chloe Bethel", nationality: "Bahamas", age: 27, heightCm: 175,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 59, defense: 84, serve: 66, block: 53, stamina: 80 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_bahamas_03_1784380539810.webp", continent: "North America",
  },

  // ── Bolivia ───────────────────────────────────────────────────────────────────
  {
    name: "Valeria Mamani", nationality: "Bolivia", age: 26, heightCm: 186,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 79, defense: 66, serve: 62, block: 85, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_bolivia_03_1784380539810.webp", continent: "South America",
  },

  // ── Canada ────────────────────────────────────────────────────────────────────
  {
    name: "Maya Thompson", nationality: "Canada", age: 27, heightCm: 190,
    position: "blocker", potential: "High",
    stats: { speed: 67, power: 81, defense: 66, serve: 63, block: 86, stamina: 72 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_canada_03_1784380539810.webp", continent: "North America",
  },

  // ── Chile ─────────────────────────────────────────────────────────────────────
  {
    name: "Isabella Rojas", nationality: "Chile", age: 26, heightCm: 187,
    position: "spiker", potential: "High",
    stats: { speed: 79, power: 83, defense: 63, serve: 71, block: 66, stamina: 76 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_chiile_03_1784380539811.webp", continent: "South America",
  },

  // ── Colombia ──────────────────────────────────────────────────────────────────
  {
    name: "Mariana Torres", nationality: "Colombia", age: 28, heightCm: 186,
    position: "blocker", potential: "Below Average",
    stats: { speed: 64, power: 75, defense: 62, serve: 60, block: 80, stamina: 69 },
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_columbia_03_1784380539811.webp", continent: "South America",
  },

  // ── Cook Islands ─────────────────────────────────────────────────────────────
  {
    name: "Teura Ngaro", nationality: "Cook Islands", age: 25, heightCm: 177,
    position: "all_rounder", potential: "High",
    stats: { speed: 75, power: 72, defense: 74, serve: 72, block: 70, stamina: 75 },
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_cook_island_01_1784380539812.webp", continent: "Oceania",
  },
  {
    name: "Moana Puna", nationality: "Cook Islands", age: 23, heightCm: 171,
    position: "setter", potential: "Average",
    stats: { speed: 74, power: 63, defense: 73, serve: 80, block: 58, stamina: 74 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_cook_island_02_1784380539812.webp", continent: "Oceania",
  },
  {
    name: "Ariana Tere", nationality: "Cook Islands", age: 26, heightCm: 186,
    position: "blocker", potential: "High",
    stats: { speed: 67, power: 80, defense: 66, serve: 63, block: 85, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_cook_island_03_1784380628809.webp", continent: "Oceania",
  },

  // ── Costa Rica ───────────────────────────────────────────────────────────────
  {
    name: "Daniela Vargas", nationality: "Costa Rica", age: 26, heightCm: 184,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 78, defense: 66, serve: 62, block: 84, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_costa_rico_03_1784380628810.webp", continent: "North America",
  },

  // ── Cuba ──────────────────────────────────────────────────────────────────────
  {
    name: "Daniela Perez", nationality: "Cuba", age: 25, heightCm: 185,
    position: "defender", potential: "Below Average",
    stats: { speed: 78, power: 56, defense: 78, serve: 62, block: 49, stamina: 75 },
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_cuba_03_1784380628810.webp", continent: "North America",
  },

  // ── Ecuador ───────────────────────────────────────────────────────────────────
  {
    name: "María José Cedeño", nationality: "Ecuador", age: 26, heightCm: 178,
    position: "all_rounder", potential: "High",
    stats: { speed: 75, power: 72, defense: 74, serve: 73, block: 70, stamina: 76 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_ecuador_01_1784380628811.webp", continent: "South America",
  },
  {
    name: "Daniela Zambrano", nationality: "Ecuador", age: 29, heightCm: 185,
    position: "blocker", potential: "Elite",
    stats: { speed: 67, power: 86, defense: 65, serve: 62, block: 89, stamina: 73 },
    salary: 14500, askingPrice: 174000,
    imageFile: "player_senior_ecuador_02_1784380628811.webp", continent: "South America",
  },
  {
    name: "Karla Paredes", nationality: "Ecuador", age: 31, heightCm: 187,
    position: "spiker", potential: "High",
    stats: { speed: 78, power: 83, defense: 63, serve: 71, block: 67, stamina: 76 },
    salary: 11500, askingPrice: 138000,
    imageFile: "player_senior_ecuador_03_1784380628812.webp", continent: "South America",
  },

  // ── Egypt ─────────────────────────────────────────────────────────────────────
  {
    name: "Nour El-Sayed", nationality: "Egypt", age: 27, heightCm: 184,
    position: "blocker", potential: "High",
    stats: { speed: 68, power: 80, defense: 66, serve: 63, block: 85, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_egypt_03_1784380628812.webp", continent: "Africa & Middle East",
  },

  // ── Fiji ──────────────────────────────────────────────────────────────────────
  {
    name: "Ana Naisoro", nationality: "Fiji", age: 27, heightCm: 186,
    position: "blocker", potential: "High",
    stats: { speed: 67, power: 81, defense: 65, serve: 63, block: 86, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_fiji_03_1784380628813.webp", continent: "Oceania",
  },

  // ── India ─────────────────────────────────────────────────────────────────────
  {
    name: "Ananya Rao", nationality: "India", age: 25, heightCm: 181,
    position: "blocker", potential: "High",
    stats: { speed: 68, power: 79, defense: 66, serve: 63, block: 84, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_india_03_1784380628813.webp", continent: "Asia",
  },

  // ── Indonesia ─────────────────────────────────────────────────────────────────
  {
    name: "Sinta Wulandari", nationality: "Indonesia", age: 21, heightCm: 165,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 58, defense: 83, serve: 66, block: 52, stamina: 80 },
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_indonesian_01_1784380628813.webp", continent: "Asia",
  },
  {
    name: "Novi Anggraini", nationality: "Indonesia", age: 23, heightCm: 168,
    position: "setter", potential: "Average",
    stats: { speed: 72, power: 63, defense: 71, serve: 80, block: 57, stamina: 73 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_indonesian_02_1784380742425.webp", continent: "Asia",
  },
  {
    name: "Putri Meilani", nationality: "Indonesia", age: 19, heightCm: 158,
    position: "setter", potential: "High",
    stats: { speed: 77, power: 64, defense: 75, serve: 83, block: 60, stamina: 76 },
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_indonesian_03_1784380742426.webp", continent: "Asia",
  },

  // ── Ireland ───────────────────────────────────────────────────────────────────
  {
    name: "Aoife O'Sullivan", nationality: "Ireland", age: 22, heightCm: 169,
    position: "all_rounder", potential: "High",
    stats: { speed: 75, power: 71, defense: 74, serve: 72, block: 70, stamina: 74 },
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_ireland_01_1784380742427.webp", continent: "Europe",
  },
  {
    name: "Megan Donnelly", nationality: "Ireland", age: 24, heightCm: 169,
    position: "blocker", potential: "High",
    stats: { speed: 68, power: 79, defense: 66, serve: 62, block: 84, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_ireland_02_1784380742428.webp", continent: "Europe",
  },
  {
    name: "Emma Kavanagh", nationality: "Ireland", age: 21, heightCm: 164,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 58, defense: 83, serve: 65, block: 52, stamina: 80 },
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_ireland_03_1784380742429.webp", continent: "Europe",
  },

  // ── Japan ─────────────────────────────────────────────────────────────────────
  {
    name: "Rina Takahashi", nationality: "Japan", age: 28, heightCm: 181,
    position: "blocker", potential: "High",
    stats: { speed: 68, power: 80, defense: 66, serve: 63, block: 85, stamina: 72 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_japan_03_1784380742429.webp", continent: "Asia",
  },

  // ── Laos ──────────────────────────────────────────────────────────────────────
  {
    name: "Keovilay Phommachanh", nationality: "Laos", age: 20, heightCm: 165,
    position: "setter", potential: "High",
    stats: { speed: 76, power: 64, defense: 74, serve: 83, block: 60, stamina: 75 },
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_laos_01_1784380742430.webp", continent: "Asia",
  },
  {
    name: "Bouavanh Sisouvanh", nationality: "Laos", age: 24, heightCm: 172,
    position: "defender", potential: "Average",
    stats: { speed: 80, power: 57, defense: 80, serve: 63, block: 50, stamina: 77 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_laos_02_1784380742430.webp", continent: "Asia",
  },
  {
    name: "Mali Khampheng", nationality: "Laos", age: 26, heightCm: 182,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 79, defense: 65, serve: 62, block: 84, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_laos_03_1784380742431.webp", continent: "Asia",
  },

  // ── Madagascar ────────────────────────────────────────────────────────────────
  {
    name: "Fara Andriamihaja", nationality: "Madagascar", age: 29, heightCm: 184,
    position: "blocker", potential: "High",
    stats: { speed: 67, power: 81, defense: 66, serve: 63, block: 86, stamina: 72 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_madagascar_01_1784380742431.webp", continent: "Africa & Middle East",
  },
  {
    name: "Mialy Rakotoarisoa", nationality: "Madagascar", age: 24, heightCm: 176,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 59, defense: 84, serve: 66, block: 53, stamina: 81 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_madagascar_02_1784380878138.webp", continent: "Africa & Middle East",
  },
  {
    name: "Soa Razafindranaivo", nationality: "Madagascar", age: 26, heightCm: 187,
    position: "spiker", potential: "Elite",
    stats: { speed: 82, power: 89, defense: 64, serve: 74, block: 70, stamina: 78 },
    salary: 15000, askingPrice: 180000,
    imageFile: "player_senior_madagascar_03_1784380878138.webp", continent: "Africa & Middle East",
  },

  // ── Malaysia ──────────────────────────────────────────────────────────────────
  {
    name: "Alya Rahman", nationality: "Malaysia", age: 24, heightCm: 181,
    position: "blocker", potential: "High",
    stats: { speed: 68, power: 79, defense: 66, serve: 62, block: 84, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_malaysia_03_1784380878139.webp", continent: "Asia",
  },

  // ── Maldives ─────────────────────────────────────────────────────────────────
  {
    name: "Mariyam Zoya", nationality: "Maldives", age: 27, heightCm: 180,
    position: "spiker", potential: "High",
    stats: { speed: 79, power: 83, defense: 63, serve: 71, block: 66, stamina: 76 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_maldives_03_1784380878139.webp", continent: "Asia",
  },

  // ── Malta ─────────────────────────────────────────────────────────────────────
  {
    name: "Yasmin Grech", nationality: "Malta", age: 24, heightCm: 186,
    position: "blocker", potential: "High",
    stats: { speed: 68, power: 80, defense: 66, serve: 63, block: 85, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_malta_01_1784380878139.webp", continent: "Europe",
  },
  {
    name: "Sara Borg", nationality: "Malta", age: 22, heightCm: 162,
    position: "all_rounder", potential: "High",
    stats: { speed: 75, power: 71, defense: 74, serve: 72, block: 70, stamina: 74 },
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_malta_02_1784380878140.webp", continent: "Europe",
  },
  {
    name: "Elena Caruana", nationality: "Malta", age: 22, heightCm: 163,
    position: "spiker", potential: "High",
    stats: { speed: 79, power: 81, defense: 62, serve: 71, block: 65, stamina: 76 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_malta_03_1784380878140.webp", continent: "Europe",
  },

  // ── Mexico ────────────────────────────────────────────────────────────────────
  {
    name: "Valeria Cruz", nationality: "Mexico", age: 26, heightCm: 184,
    position: "blocker", potential: "High",
    stats: { speed: 67, power: 80, defense: 66, serve: 63, block: 85, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_mexico_03_1784380878141.webp", continent: "North America",
  },

  // ── Monaco ────────────────────────────────────────────────────────────────────
  {
    name: "Camille Rossi", nationality: "Monaco", age: 25, heightCm: 182,
    position: "spiker", potential: "Below Average",
    stats: { speed: 75, power: 76, defense: 61, serve: 68, block: 61, stamina: 72 },
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_monaco_03_1784380878141.webp", continent: "Europe",
  },

  // ── Morocco ───────────────────────────────────────────────────────────────────
  {
    name: "Salma El Idrissi", nationality: "Morocco", age: 24, heightCm: 183,
    position: "blocker", potential: "High",
    stats: { speed: 68, power: 79, defense: 66, serve: 63, block: 85, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_morocco_03_1784380878141.webp", continent: "Africa & Middle East",
  },
  {
    name: "Zineb Ouadi", nationality: "Morocco", age: 22, heightCm: 170,
    position: "setter", potential: "Average",
    stats: { speed: 73, power: 62, defense: 72, serve: 80, block: 57, stamina: 73 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_morocco_03_1784381592100.webp", continent: "Africa & Middle East",
  },

  // ── Mozambique ────────────────────────────────────────────────────────────────
  {
    name: "Amélia Mucavele", nationality: "Mozambique", age: 25, heightCm: 179,
    position: "defender", potential: "Average",
    stats: { speed: 82, power: 58, defense: 82, serve: 65, block: 52, stamina: 79 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_mozambique_01_1784381291875.webp", continent: "Africa & Middle East",
  },
  {
    name: "Lídia Matola", nationality: "Mozambique", age: 28, heightCm: 181,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 78, defense: 66, serve: 62, block: 84, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_mozambique_02_1784381291876.webp", continent: "Africa & Middle East",
  },
  {
    name: "Rosa Nhantumbo", nationality: "Mozambique", age: 22, heightCm: 174,
    position: "setter", potential: "Average",
    stats: { speed: 74, power: 63, defense: 73, serve: 80, block: 58, stamina: 74 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_mozambique_03_1784381291876.webp", continent: "Africa & Middle East",
  },

  // ── Netherlands ───────────────────────────────────────────────────────────────
  {
    name: "Femke de Vries", nationality: "Netherlands", age: 26, heightCm: 190,
    position: "blocker", potential: "High",
    stats: { speed: 67, power: 82, defense: 66, serve: 63, block: 87, stamina: 72 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_netherlands_03_1784381291877.webp", continent: "Europe",
  },

  // ── Panama ────────────────────────────────────────────────────────────────────
  {
    name: "Isabella González", nationality: "Panama", age: 24, heightCm: 176,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 59, defense: 84, serve: 66, block: 53, stamina: 81 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_panama_01_1784381291877.webp", continent: "North America",
  },
  {
    name: "Gabriela Castillo", nationality: "Panama", age: 28, heightCm: 180,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 78, defense: 65, serve: 62, block: 84, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_panama_02_1784381291878.webp", continent: "North America",
  },
  {
    name: "Marisol Vega", nationality: "Panama", age: 30, heightCm: 183,
    position: "spiker", potential: "High",
    stats: { speed: 78, power: 83, defense: 63, serve: 71, block: 67, stamina: 76 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_panama_03_1784381291878.webp", continent: "North America",
  },

  // ── Peru ──────────────────────────────────────────────────────────────────────
  {
    name: "Camila Quispe", nationality: "Peru", age: 27, heightCm: 185,
    position: "spiker", potential: "Below Average",
    stats: { speed: 75, power: 75, defense: 61, serve: 67, block: 60, stamina: 72 },
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_peru_03_1784381291879.webp", continent: "South America",
  },

  // ── Philippines ───────────────────────────────────────────────────────────────
  {
    name: "Carla Villanueva", nationality: "Philippines", age: 27, heightCm: 183,
    position: "blocker", potential: "High",
    stats: { speed: 68, power: 80, defense: 66, serve: 63, block: 85, stamina: 72 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_phillipines_03_1784381291879.webp", continent: "Asia",
  },

  // ── Papua New Guinea ─────────────────────────────────────────────────────────
  {
    name: "Alina Kora", nationality: "Papua New Guinea", age: 25, heightCm: 185,
    position: "spiker", potential: "Elite",
    stats: { speed: 82, power: 88, defense: 64, serve: 75, block: 70, stamina: 78 },
    salary: 14500, askingPrice: 174000,
    imageFile: "player_senior_png_03_1784381291879.webp", continent: "Oceania",
  },

  // ── Portugal ─────────────────────────────────────────────────────────────────
  {
    name: "Sofia Almeida", nationality: "Portugal", age: 28, heightCm: 185,
    position: "spiker", potential: "High",
    stats: { speed: 79, power: 83, defense: 63, serve: 71, block: 67, stamina: 76 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_portugal_03_1784381358528.webp", continent: "Europe",
  },

  // ── Russia ────────────────────────────────────────────────────────────────────
  {
    name: "Anastasia Morozova", nationality: "Russia", age: 25, heightCm: 192,
    position: "blocker", potential: "High",
    stats: { speed: 67, power: 82, defense: 66, serve: 63, block: 87, stamina: 72 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_russia_01_1784381358529.webp", continent: "Europe",
  },
  {
    name: "Daria Fedorova", nationality: "Russia", age: 25, heightCm: 192,
    position: "setter", potential: "Average",
    stats: { speed: 74, power: 64, defense: 73, serve: 81, block: 59, stamina: 74 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_russia_02_1784381358530.webp", continent: "Europe",
  },
  {
    name: "Elena Smirnova", nationality: "Russia", age: 25, heightCm: 192,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 59, defense: 84, serve: 66, block: 53, stamina: 80 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_russia_03_1784381358530.webp", continent: "Europe",
  },

  // ── Samoa ─────────────────────────────────────────────────────────────────────
  {
    name: "Lani Faumuina", nationality: "Samoa", age: 26, heightCm: 184,
    position: "blocker", potential: "Poor",
    stats: { speed: 62, power: 72, defense: 60, serve: 58, block: 77, stamina: 67 },
    salary: 5500, askingPrice: 66000,
    imageFile: "player_senior_samoa_03_1784381358531.webp", continent: "Oceania",
  },

  // ── Solomon Islands ───────────────────────────────────────────────────────────
  {
    name: "Selina Kwanairara", nationality: "Solomon Islands", age: 24, heightCm: 179,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 59, defense: 84, serve: 66, block: 53, stamina: 81 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_solomon_island_01_1784381358532.webp", continent: "Oceania",
  },
  {
    name: "Martha Kera", nationality: "Solomon Islands", age: 37, heightCm: 181,
    position: "blocker", potential: "Elite",
    stats: { speed: 66, power: 87, defense: 65, serve: 62, block: 90, stamina: 72 },
    salary: 14000, askingPrice: 168000,
    imageFile: "player_senior_solomon_island_02_1784381358532.webp", continent: "Oceania",
  },
  {
    name: "Naomi Talo", nationality: "Solomon Islands", age: 22, heightCm: 174,
    position: "setter", potential: "Poor",
    stats: { speed: 70, power: 59, defense: 70, serve: 75, block: 55, stamina: 69 },
    salary: 5500, askingPrice: 66000,
    imageFile: "player_senior_solomon_island_03_1784381358533.webp", continent: "Oceania",
  },

  // ── Spain ─────────────────────────────────────────────────────────────────────
  {
    name: "Lucia Navarro", nationality: "Spain", age: 26, heightCm: 184,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 79, defense: 65, serve: 62, block: 84, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_spain_03_1784381358534.webp", continent: "Europe",
  },

  // ── Switzerland ───────────────────────────────────────────────────────────────
  {
    name: "Lena Müller", nationality: "Switzerland", age: 24, heightCm: 186,
    position: "all_rounder", potential: "High",
    stats: { speed: 75, power: 72, defense: 74, serve: 73, block: 70, stamina: 75 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_swiss_01_1784381358534.webp", continent: "Europe",
  },
  {
    name: "Lara Meier", nationality: "Switzerland", age: 24, heightCm: 178,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 59, defense: 84, serve: 66, block: 53, stamina: 81 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_swiss_02_1784381506891.webp", continent: "Europe",
  },
  {
    name: "Anja Keller", nationality: "Switzerland", age: 22, heightCm: 174,
    position: "spiker", potential: "High",
    stats: { speed: 80, power: 81, defense: 62, serve: 71, block: 65, stamina: 76 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_swiss_03_1784381506891.webp", continent: "Europe",
  },

  // ── Tahiti ────────────────────────────────────────────────────────────────────
  {
    name: "Vaea Teriitahi", nationality: "Tahiti", age: 25, heightCm: 184,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 78, defense: 65, serve: 62, block: 84, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_tahiti_03_1784381506892.webp", continent: "Oceania",
  },

  // ── Taiwan ────────────────────────────────────────────────────────────────────
  {
    name: "Huang Yi-Ting", nationality: "Taiwan", age: 22, heightCm: 166,
    position: "spiker", potential: "High",
    stats: { speed: 81, power: 80, defense: 62, serve: 70, block: 64, stamina: 76 },
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_taiwan_01_1784381506892.webp", continent: "Asia",
  },
  {
    name: "Chen Yu-Hsin", nationality: "Taiwan", age: 23, heightCm: 167,
    position: "spiker", potential: "High",
    stats: { speed: 80, power: 81, defense: 62, serve: 70, block: 65, stamina: 76 },
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_taiwan_02_1784381506893.webp", continent: "Asia",
  },
  {
    name: "Lin Ya-Xuan", nationality: "Taiwan", age: 27, heightCm: 181,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 79, defense: 65, serve: 62, block: 84, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_taiwan_03_1784381506894.webp", continent: "Asia",
  },

  // ── Tanzania ─────────────────────────────────────────────────────────────────
  {
    name: "Asha Msuya", nationality: "Tanzania", age: 25, heightCm: 178,
    position: "blocker", potential: "Average",
    stats: { speed: 66, power: 78, defense: 65, serve: 62, block: 83, stamina: 71 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_tanzania_01_1784381506895.webp", continent: "Africa & Middle East",
  },
  {
    name: "Neema Mollel", nationality: "Tanzania", age: 23, heightCm: 172,
    position: "defender", potential: "Average",
    stats: { speed: 81, power: 57, defense: 81, serve: 64, block: 51, stamina: 78 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_tanzania_02_1784381506896.webp", continent: "Africa & Middle East",
  },
  {
    name: "Zawadi Kimaro", nationality: "Tanzania", age: 27, heightCm: 180,
    position: "all_rounder", potential: "Average",
    stats: { speed: 72, power: 71, defense: 72, serve: 71, block: 69, stamina: 72 },
    salary: 8500, askingPrice: 102000,
    imageFile: "player_senior_tanzania_03_1784381506896.webp", continent: "Africa & Middle East",
  },

  // ── Thailand ─────────────────────────────────────────────────────────────────
  {
    name: "Pimchanok Rattanakorn", nationality: "Thailand", age: 22, heightCm: 160,
    position: "setter", potential: "Average",
    stats: { speed: 74, power: 63, defense: 73, serve: 80, block: 58, stamina: 74 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_thailand_03_1784381506897.webp", continent: "Asia",
  },

  // ── Tonga ─────────────────────────────────────────────────────────────────────
  {
    name: "Salote Fifita", nationality: "Tonga", age: 24, heightCm: 170,
    position: "defender", potential: "Average",
    stats: { speed: 81, power: 57, defense: 81, serve: 64, block: 51, stamina: 78 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_tonga_03_1784381592101.webp", continent: "Oceania",
  },

  // ── Tunisia ───────────────────────────────────────────────────────────────────
  {
    name: "Ines Trabelsi", nationality: "Tunisia", age: 27, heightCm: 183,
    position: "spiker", potential: "High",
    stats: { speed: 79, power: 82, defense: 63, serve: 71, block: 66, stamina: 76 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_tunisia_03_1784381592101.webp", continent: "Africa & Middle East",
  },

  // ── Uruguay ───────────────────────────────────────────────────────────────────
  {
    name: "Lucía Fernández", nationality: "Uruguay", age: 25, heightCm: 176,
    position: "all_rounder", potential: "High",
    stats: { speed: 75, power: 72, defense: 74, serve: 72, block: 70, stamina: 75 },
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_uruguay_01_1784381592102.webp", continent: "South America",
  },
  {
    name: "Sofía Martínez", nationality: "Uruguay", age: 28, heightCm: 180,
    position: "spiker", potential: "High",
    stats: { speed: 79, power: 83, defense: 63, serve: 71, block: 67, stamina: 76 },
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_uruguay_02_1784381592102.webp", continent: "South America",
  },
  {
    name: "Martina Silva", nationality: "Uruguay", age: 23, heightCm: 173,
    position: "defender", potential: "High",
    stats: { speed: 84, power: 59, defense: 84, serve: 66, block: 53, stamina: 80 },
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_uruguay_03_1784381592103.webp", continent: "South America",
  },

  // ── Venezuela ─────────────────────────────────────────────────────────────────
  {
    name: "Valentina Rojas", nationality: "Venezuela", age: 24, heightCm: 175,
    position: "defender", potential: "Average",
    stats: { speed: 81, power: 57, defense: 81, serve: 64, block: 51, stamina: 78 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_venezuela_01_1784381592103.webp", continent: "South America",
  },
  {
    name: "Camila Pérez", nationality: "Venezuela", age: 21, heightCm: 170,
    position: "setter", potential: "Average",
    stats: { speed: 74, power: 63, defense: 73, serve: 80, block: 58, stamina: 74 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_venezuela_02_1784381592104.webp", continent: "South America",
  },
  {
    name: "Adriana Herrera", nationality: "Venezuela", age: 26, heightCm: 173,
    position: "spiker", potential: "Average",
    stats: { speed: 77, power: 74, defense: 63, serve: 68, block: 62, stamina: 73 },
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_venezuela_03_1784381592105.webp", continent: "South America",
  },

  // ── Vietnam ───────────────────────────────────────────────────────────────────
  {
    name: "Nguyen Mai Anh", nationality: "Vietnam", age: 21, heightCm: 160,
    position: "setter", potential: "High",
    stats: { speed: 77, power: 64, defense: 75, serve: 83, block: 60, stamina: 76 },
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_vietnam_03_1784381592105.webp", continent: "Asia",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ovr(s: PlayerDef["stats"]): number {
  return Math.round(
    (s.speed + s.power + s.defense + s.serve + s.block + s.stamina) / 6,
  );
}

function contractYears(age: number): number {
  return age <= 21 ? 3 : age <= 25 ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const total = PLAYERS.length;
  console.log(`=== Seeding ${total} new-batch senior players (idempotent) ===\n`);

  let inserted = 0;
  let skipped  = 0;

  for (const [i, player] of PLAYERS.entries()) {
    const n        = String(i + 1).padStart(2, " ");
    const imageUrl = localImageUrl(player.imageFile) ?? `/images/players/seniors/${player.imageFile}`;
    const overall  = ovr(player.stats);
    const endYear  = 2026 + contractYears(player.age);

    // Idempotency guard — skip if a record with this image path already exists
    const existing = await db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(eq(playersTable.imageUrl, imageUrl))
      .limit(1);

    if (existing.length > 0) {
      console.log(`[${n}/${total}] SKIP ${player.name} (${player.nationality}) — already in DB (id=${existing[0].id})`);
      skipped++;
      continue;
    }

    await db.insert(playersTable).values({
      name:            player.name,
      nationality:     player.nationality,
      age:             player.age,
      height:          player.heightCm,
      position:        player.position,
      speed:           player.stats.speed,
      power:           player.stats.power,
      defense:         player.stats.defense,
      serve:           player.stats.serve,
      block:           player.stats.block,
      stamina:         player.stats.stamina,
      potential:       player.potential,
      askingPrice:     player.askingPrice,
      continent:       player.continent,
      imageUrl,
      isDraftPlayer:   false,
      isRetired:       false,
      playerType:      "senior",
    });

    console.log(`[${n}/${total}] ✓ ${player.name} (${player.nationality}) — OVR ${overall}, ${player.potential}`);
    inserted++;
  }

  console.log(`\n=== Done! ${inserted} inserted, ${skipped} skipped (already existed). ===`);
  console.log("\nNext: pnpm --filter @workspace/scripts run fill-all-player-development");
  console.log("      to populate the development JSONB for these new rows.\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
