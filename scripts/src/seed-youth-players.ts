/**
 * Seed 72 female youth players (40 from JSON files + 32 generated to balance regions).
 * Clears existing youth players first, then reseeds with exactly 72.
 * Run: pnpm --filter @workspace/scripts run seed-youth-players
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(__dirname, "../../");

// Youth card image already uploaded in GCS
const SHARED_IMAGE_URL = "/objects/youth-cards/youth-card.webp";

type Position = "spiker" | "defender" | "setter" | "blocker" | "all_rounder";
type Potential = "Elite" | "High" | "Average" | "Below Average" | "Poor";

function mapPosition(role: string | undefined): Position {
  if (!role) return "all_rounder";
  const r = role.toLowerCase();
  if (r === "server" || r === "attacker" || r === "spiker") return "spiker";
  if (r === "setter") return "setter";
  if (r === "blocker") return "blocker";
  if (r === "defender" || r === "libero") return "defender";
  return "all_rounder";
}

function mapPotential(p: number): Potential {
  if (p >= 5) return "Elite";
  if (p === 4) return "High";
  if (p === 3) return "Average";
  if (p === 2) return "Below Average";
  return "Poor";
}

function mapContinent(c: string): string {
  if (c === "Africa") return "Africa & Middle East";
  return c;
}

interface YouthRow {
  name: string;
  nationality: string;
  continent: string;
  age: number;
  height: number;
  position: Position;
  potential: Potential;
  speed: number;
  power: number;
  defense: number;
  serve: number;
  block: number;
  stamina: number;
}

// ─── Load unique females from JSON files ─────────────────────────────────────
function loadFromJsonFiles(): YouthRow[] {
  const files = [
    "youthPlayers_1782959799149.json",
    "youthPlayers_international_1782962759015.json",
    "youthPlayers_international_1782962759017.json",
  ];

  const seen = new Set<string>();
  const rows: YouthRow[] = [];

  for (const file of files) {
    const raw: Array<{
      fullName: string; gender: string; nationality: string;
      continent: string; age: number; height: number;
      role?: string; primaryRole?: string;
      attackRating: number; defenceRating: number; serveRating: number;
      speedRating: number; staminaRating: number; potential: number;
    }> = JSON.parse(readFileSync(resolve(WORKSPACE_ROOT, "attached_assets", file), "utf-8"));

    for (const p of raw) {
      if (p.gender !== "Female") continue;
      if (seen.has(p.fullName)) continue;
      seen.add(p.fullName);

      const role = p.primaryRole ?? p.role;
      const block = Math.round((p.attackRating + p.defenceRating) / 2);

      rows.push({
        name: p.fullName,
        nationality: p.nationality,
        continent: mapContinent(p.continent),
        age: p.age,
        height: p.height,
        position: mapPosition(role),
        potential: mapPotential(p.potential),
        speed: p.speedRating,
        power: p.attackRating,
        defense: p.defenceRating,
        serve: p.serveRating,
        block,
        stamina: p.staminaRating,
      });
    }
  }

  return rows;
}

// ─── Generated players to balance to 72 ─────────────────────────────────────
// JSON files yield 40 unique females: Europe 9, Asia 6, Oceania 6, N.America 7, S.America 6, Africa 6
// We need 12 per continent → Europe +3, Asia +6, Oceania +6, N.America +5, S.America +6, Africa +6 = 32
const GENERATED: YouthRow[] = [
  // Europe +3
  { name: "Klara Novotná", nationality: "Czech Republic", continent: "Europe", age: 15, height: 174, position: "setter", potential: "High", speed: 56, power: 44, defense: 58, serve: 61, block: 50, stamina: 52 },
  { name: "Elina Mäkinen", nationality: "Finland", continent: "Europe", age: 14, height: 169, position: "defender", potential: "Average", speed: 63, power: 38, defense: 65, serve: 42, block: 40, stamina: 55 },
  { name: "Ioanna Papadaki", nationality: "Greece", continent: "Europe", age: 16, height: 177, position: "spiker", potential: "High", speed: 58, power: 62, defense: 44, serve: 55, block: 52, stamina: 57 },

  // Asia +6
  { name: "Nurul Ain", nationality: "Malaysia", continent: "Asia", age: 14, height: 162, position: "setter", potential: "Average", speed: 54, power: 41, defense: 52, serve: 58, block: 46, stamina: 50 },
  { name: "Chayanee Prommas", nationality: "Thailand", continent: "Asia", age: 15, height: 165, position: "defender", potential: "High", speed: 67, power: 39, defense: 68, serve: 44, block: 42, stamina: 59 },
  { name: "Kim Min-Ji", nationality: "South Korea", continent: "Asia", age: 16, height: 172, position: "spiker", potential: "High", speed: 60, power: 64, defense: 46, serve: 57, block: 53, stamina: 58 },
  { name: "Pham Thi Lan", nationality: "Vietnam", continent: "Asia", age: 15, height: 163, position: "all_rounder", potential: "Average", speed: 55, power: 47, defense: 53, serve: 50, block: 48, stamina: 52 },
  { name: "Aisha Rahimi", nationality: "Afghanistan", continent: "Asia", age: 14, height: 160, position: "defender", potential: "Below Average", speed: 51, power: 36, defense: 56, serve: 40, block: 38, stamina: 47 },
  { name: "Zara Sultanova", nationality: "Kazakhstan", continent: "Asia", age: 16, height: 175, position: "blocker", potential: "High", speed: 52, power: 60, defense: 48, serve: 50, block: 66, stamina: 54 },

  // Oceania +6
  { name: "Aroha Tane", nationality: "New Zealand", continent: "Oceania", age: 15, height: 171, position: "spiker", potential: "High", speed: 61, power: 63, defense: 46, serve: 54, block: 54, stamina: 58 },
  { name: "Sia Faleolo", nationality: "Samoa", continent: "Oceania", age: 14, height: 178, position: "blocker", potential: "Elite", speed: 55, power: 68, defense: 47, serve: 51, block: 70, stamina: 56 },
  { name: "Mere Rokotuivuna", nationality: "Fiji", continent: "Oceania", age: 16, height: 173, position: "spiker", potential: "High", speed: 59, power: 65, defense: 45, serve: 58, block: 55, stamina: 60 },
  { name: "Tiare Teuruaa", nationality: "Tahiti", continent: "Oceania", age: 15, height: 166, position: "setter", potential: "Average", speed: 57, power: 43, defense: 55, serve: 62, block: 47, stamina: 53 },
  { name: "Niamh Kelly", nationality: "Australia", continent: "Oceania", age: 14, height: 170, position: "defender", potential: "Average", speed: 64, power: 40, defense: 66, serve: 45, block: 42, stamina: 56 },
  { name: "Peni Tuivaga", nationality: "Tonga", continent: "Oceania", age: 16, height: 180, position: "blocker", potential: "High", speed: 50, power: 66, defense: 44, serve: 49, block: 68, stamina: 53 },

  // North America +5
  { name: "Brianna Foster", nationality: "United States", continent: "North America", age: 15, height: 176, position: "spiker", potential: "High", speed: 62, power: 65, defense: 46, serve: 56, block: 55, stamina: 59 },
  { name: "Aaliyah James", nationality: "United States", continent: "North America", age: 14, height: 174, position: "all_rounder", potential: "Elite", speed: 67, power: 62, defense: 58, serve: 60, block: 59, stamina: 64 },
  { name: "Gabrielle Tremblay", nationality: "Canada", continent: "North America", age: 16, height: 169, position: "setter", potential: "Average", speed: 58, power: 42, defense: 56, serve: 64, block: 48, stamina: 54 },
  { name: "Sofía Reyes", nationality: "Mexico", continent: "North America", age: 15, height: 167, position: "defender", potential: "Average", speed: 65, power: 40, defense: 67, serve: 46, block: 43, stamina: 57 },
  { name: "Kezia Williams", nationality: "Jamaica", continent: "North America", age: 14, height: 172, position: "spiker", potential: "High", speed: 63, power: 61, defense: 44, serve: 54, block: 52, stamina: 58 },

  // South America +6
  { name: "Bruna Cavalcanti", nationality: "Brazil", continent: "South America", age: 15, height: 179, position: "spiker", potential: "Elite", speed: 63, power: 70, defense: 47, serve: 59, block: 58, stamina: 62 },
  { name: "Fernanda Quispe", nationality: "Peru", continent: "South America", age: 14, height: 164, position: "setter", potential: "Average", speed: 55, power: 42, defense: 54, serve: 61, block: 47, stamina: 51 },
  { name: "Natalia Escobar", nationality: "Colombia", continent: "South America", age: 16, height: 170, position: "defender", potential: "High", speed: 67, power: 41, defense: 70, serve: 47, block: 44, stamina: 60 },
  { name: "Valentina Acosta", nationality: "Ecuador", continent: "South America", age: 15, height: 168, position: "blocker", potential: "Average", speed: 53, power: 57, defense: 46, serve: 49, block: 62, stamina: 52 },
  { name: "Renata Cárdenas", nationality: "Bolivia", continent: "South America", age: 14, height: 163, position: "all_rounder", potential: "Below Average", speed: 51, power: 44, defense: 50, serve: 47, block: 46, stamina: 49 },
  { name: "Javiera Muñoz", nationality: "Chile", continent: "South America", age: 16, height: 172, position: "spiker", potential: "High", speed: 60, power: 63, defense: 45, serve: 55, block: 53, stamina: 57 },

  // Africa & Middle East +6
  { name: "Asmaa El-Sayed", nationality: "Egypt", continent: "Africa & Middle East", age: 15, height: 170, position: "spiker", potential: "High", speed: 61, power: 62, defense: 45, serve: 56, block: 53, stamina: 58 },
  { name: "Chinonso Eze", nationality: "Nigeria", continent: "Africa & Middle East", age: 14, height: 174, position: "blocker", potential: "Average", speed: 54, power: 59, defense: 47, serve: 50, block: 64, stamina: 53 },
  { name: "Zanele Khumalo", nationality: "Zimbabwe", continent: "Africa & Middle East", age: 16, height: 168, position: "defender", potential: "High", speed: 65, power: 40, defense: 68, serve: 46, block: 43, stamina: 59 },
  { name: "Hiba Benali", nationality: "Tunisia", continent: "Africa & Middle East", age: 15, height: 166, position: "setter", potential: "Average", speed: 57, power: 43, defense: 55, serve: 63, block: 48, stamina: 52 },
  { name: "Nadia Abebe", nationality: "Ethiopia", continent: "Africa & Middle East", age: 14, height: 171, position: "spiker", potential: "Elite", speed: 68, power: 66, defense: 50, serve: 58, block: 57, stamina: 65 },
  { name: "Sara Al-Rashidi", nationality: "Kuwait", continent: "Africa & Middle East", age: 16, height: 165, position: "all_rounder", potential: "Average", speed: 56, power: 49, defense: 54, serve: 51, block: 50, stamina: 53 },
];

async function main() {
  // Clear all existing youth players
  console.log("Clearing existing youth players...");
  const deleted = await db.delete(playersTable).where(eq(playersTable.playerType, "youth"));
  console.log(`  Cleared existing youth records.\n`);

  // Load 40 unique females from JSON files
  const fromJson = loadFromJsonFiles();
  console.log(`Loaded ${fromJson.length} unique females from JSON files.`);

  // Combine with generated players
  const all: YouthRow[] = [...fromJson, ...GENERATED];
  console.log(`Total to seed: ${all.length} (${fromJson.length} from JSON + ${GENERATED.length} generated)\n`);

  // Verify continent balance
  const byContinent: Record<string, number> = {};
  for (const p of all) {
    byContinent[p.continent] = (byContinent[p.continent] ?? 0) + 1;
  }
  console.log("Continent breakdown:", byContinent, "\n");

  // Insert all players
  for (const [i, player] of all.entries()) {
    process.stdout.write(`[${i + 1}/${all.length}] ${player.name} (${player.nationality}) — ${player.position} — pot:${player.potential}\n`);

    await db.insert(playersTable).values({
      name: player.name,
      nationality: player.nationality,
      age: player.age,
      height: String(player.height),
      position: player.position,
      speed: player.speed,
      power: player.power,
      defense: player.defense,
      serve: player.serve,
      block: player.block,
      stamina: player.stamina,
      potential: player.potential,
      salary: "0",
      askingPrice: null,
      continent: player.continent,
      imageUrl: SHARED_IMAGE_URL,
      teamId: null,
      isDraftPlayer: false,
      playerType: "youth",
      isRetired: false,
    });
  }

  console.log(`\n=== Done! ${all.length} female youth players seeded. ===`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
