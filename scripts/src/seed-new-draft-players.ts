/**
 * Seed 40 new draft players (with portraits) into the draft pool.
 * Stats, salary and potential derived from player card images.
 * Run: pnpm --filter @workspace/scripts run seed-new-draft-players
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
    nationality: "United States",
    continent: "North America",
    age: 29, heightCm: 173, position: "all_rounder", potential: "High",
    speed: 78, power: 77, defense: 74, serve: 76, block: 68, stamina: 75,
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_america_03_1783400328506.webp",
  },
  {
    name: "Mia Anderson",
    nationality: "Australia",
    continent: "Oceania",
    age: 22, heightCm: 176, position: "setter", potential: "Elite",
    speed: 80, power: 60, defense: 74, serve: 86, block: 56, stamina: 78,
    salary: 14000, askingPrice: 168000,
    imageFile: "player_senior_australia_03_1783400334838.webp",
  },
  {
    name: "Tessa Lane",
    nationality: "Australia",
    continent: "Oceania",
    age: 22, heightCm: 174, position: "spiker", potential: "High",
    speed: 79, power: 82, defense: 62, serve: 70, block: 65, stamina: 76,
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_australia_04_1783400343860.webp",
  },
  {
    name: "Kamila Torrez",
    nationality: "Bolivia",
    continent: "South America",
    age: 20, heightCm: 162, position: "defender", potential: "High",
    speed: 82, power: 52, defense: 83, serve: 63, block: 48, stamina: 80,
    salary: 9000, askingPrice: 108000,
    imageFile: "player_senior_bolivia_03_1783400350415.webp",
  },
  {
    name: "Julia Fernandes",
    nationality: "Brazil",
    continent: "South America",
    age: 24, heightCm: 174, position: "all_rounder", potential: "High",
    speed: 77, power: 79, defense: 73, serve: 75, block: 68, stamina: 76,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_brazil_03_1783400360369.webp",
  },
  {
    name: "Emily Roy",
    nationality: "Canada",
    continent: "North America",
    age: 21, heightCm: 168, position: "defender", potential: "High",
    speed: 83, power: 54, defense: 84, serve: 65, block: 50, stamina: 79,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_canada_03_1783400363805.webp",
  },
  {
    name: "Wang Yun",
    nationality: "China",
    continent: "Asia",
    age: 21, heightCm: 175, position: "setter", potential: "Elite",
    speed: 79, power: 62, defense: 75, serve: 87, block: 58, stamina: 77,
    salary: 14500, askingPrice: 174000,
    imageFile: "player_senior_china_03_1783400374542.webp",
  },
  {
    name: "Isabella Moreira",
    nationality: "Costa Rica",
    continent: "North America",
    age: 21, heightCm: 164, position: "setter", potential: "High",
    speed: 78, power: 57, defense: 72, serve: 82, block: 54, stamina: 76,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_costa_rico_03_1783400377093.webp",
  },
  {
    name: "Ava Patel",
    nationality: "England",
    continent: "Europe",
    age: 19, heightCm: 174, position: "setter", potential: "High",
    speed: 76, power: 58, defense: 70, serve: 80, block: 52, stamina: 74,
    salary: 9000, askingPrice: 108000,
    imageFile: "player_senior_england_03_1783400426244.webp",
  },
  {
    name: "Litia Naivakalou",
    nationality: "Fiji",
    continent: "Oceania",
    age: 23, heightCm: 176, position: "defender", potential: "Average",
    speed: 79, power: 54, defense: 80, serve: 62, block: 48, stamina: 77,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_fiji_03_1783400431166.webp",
  },
  {
    name: "Charlotte Moreau",
    nationality: "France",
    continent: "Europe",
    age: 24, heightCm: 182, position: "blocker", potential: "High",
    speed: 65, power: 80, defense: 64, serve: 68, block: 86, stamina: 72,
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_france_02_1783400433154.webp",
  },
  {
    name: "Leila Amiri",
    nationality: "France",
    continent: "Europe",
    age: 26, heightCm: 179, position: "defender", potential: "Average",
    speed: 81, power: 56, defense: 82, serve: 66, block: 52, stamina: 80,
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_france_03_1783400442828.webp",
  },
  {
    name: "Clémence Dubois",
    nationality: "France",
    continent: "Europe",
    age: 25, heightCm: 178, position: "spiker", potential: "High",
    speed: 78, power: 83, defense: 63, serve: 71, block: 67, stamina: 76,
    salary: 10500, askingPrice: 126000,
    imageFile: "player_senior_france_04_1783400448832.webp",
  },
  {
    name: "Anna Köhler",
    nationality: "Germany",
    continent: "Europe",
    age: 28, heightCm: 180, position: "defender", potential: "High",
    speed: 80, power: 58, defense: 84, serve: 67, block: 55, stamina: 79,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_germany_01_1783400456113.webp",
  },
  {
    name: "Eleni Papadopoulou",
    nationality: "Greece",
    continent: "Europe",
    age: 26, heightCm: 178, position: "spiker", potential: "Average",
    speed: 74, power: 78, defense: 60, serve: 68, block: 63, stamina: 72,
    salary: 8000, askingPrice: 96000,
    imageFile: "player_senior_greece_01_1783400462061.webp",
  },
  {
    name: "Anastasia Kalogirou",
    nationality: "Greece",
    continent: "Europe",
    age: 31, heightCm: 182, position: "blocker", potential: "Average",
    speed: 62, power: 77, defense: 62, serve: 66, block: 83, stamina: 68,
    salary: 7500, askingPrice: 90000,
    imageFile: "player_senior_greece_02_1783400468258.webp",
  },
  // ── BATCH 2 ──────────────────────────────────────────────────────────────
  {
    // renamed from Eleni to avoid duplicate
    name: "Elena Papadopoulou",
    nationality: "Greece",
    continent: "Europe",
    age: 23, heightCm: 190, position: "spiker", potential: "Elite",
    speed: 72, power: 88, defense: 60, serve: 70, block: 74, stamina: 74,
    salary: 14000, askingPrice: 168000,
    imageFile: "player_senior_greece_03_1783400545309.webp",
  },
  {
    name: "Giulia Rossi",
    nationality: "Italy",
    continent: "Europe",
    age: 24, heightCm: 182, position: "spiker", potential: "High",
    speed: 77, power: 84, defense: 62, serve: 71, block: 69, stamina: 75,
    salary: 11000, askingPrice: 132000,
    imageFile: "player_senior_italy_01_1783400548345.webp",
  },
  {
    name: "Martina Bianchi",
    nationality: "Italy",
    continent: "Europe",
    age: 23, heightCm: 180, position: "defender", potential: "High",
    speed: 82, power: 56, defense: 83, serve: 67, block: 53, stamina: 80,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_italy_02_1783400556596.webp",
  },
  {
    name: "Sofia Romano",
    nationality: "Italy",
    continent: "Europe",
    age: 22, heightCm: 162, position: "spiker", potential: "Average",
    speed: 77, power: 76, defense: 60, serve: 68, block: 58, stamina: 73,
    salary: 7500, askingPrice: 90000,
    imageFile: "player_senior_italy_03_1783400562072.webp",
  },
  {
    name: "Kayla Thompson",
    nationality: "Jamaica",
    continent: "North America",
    age: 23, heightCm: 171, position: "all_rounder", potential: "High",
    speed: 80, power: 75, defense: 74, serve: 73, block: 65, stamina: 78,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_jamaica_01_1783400568028.webp",
  },
  {
    name: "Chinenye Okafor",
    nationality: "Nigeria",
    continent: "Africa & Middle East",
    age: 24, heightCm: 178, position: "defender", potential: "High",
    speed: 83, power: 57, defense: 85, serve: 65, block: 51, stamina: 81,
    salary: 9000, askingPrice: 108000,
    imageFile: "player_senior_kenya_03_1783400574311.webp",
  },
  {
    name: "Nurul Ain",
    nationality: "Malaysia",
    continent: "Asia",
    age: 28, heightCm: 173, position: "setter", potential: "Average",
    speed: 74, power: 55, defense: 70, serve: 78, block: 52, stamina: 73,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_malaysia_01_1783400580692.webp",
  },
  {
    name: "Qistina Zulkifli",
    nationality: "Malaysia",
    continent: "Asia",
    age: 26, heightCm: 168, position: "defender", potential: "Average",
    speed: 78, power: 52, defense: 79, serve: 62, block: 47, stamina: 76,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_malaysia_02_1783400586388.webp",
  },
  {
    name: "Aishath Nazeema",
    nationality: "Maldives",
    continent: "Asia",
    age: 25, heightCm: 165, position: "defender", potential: "Average",
    speed: 77, power: 50, defense: 78, serve: 61, block: 45, stamina: 75,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_maldives_01_1783400616542.webp",
  },
  {
    name: "Fathimath Shiuna",
    nationality: "Maldives",
    continent: "Asia",
    age: 24, heightCm: 163, position: "defender", potential: "Average",
    speed: 76, power: 49, defense: 77, serve: 60, block: 44, stamina: 74,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_maldives_02_1783400620105.webp",
  },
  {
    name: "Hinemoa Waikato",
    nationality: "New Zealand",
    continent: "Oceania",
    age: 29, heightCm: 177, position: "defender", potential: "Average",
    speed: 79, power: 55, defense: 81, serve: 64, block: 50, stamina: 77,
    salary: 7500, askingPrice: 90000,
    imageFile: "player_senior_newzealand_03_1783400628383.webp",
  },
  {
    // 5★ on card
    name: "Lucía Martínez",
    nationality: "Peru",
    continent: "South America",
    age: 20, heightCm: 165, position: "defender", potential: "Elite",
    speed: 85, power: 56, defense: 88, serve: 66, block: 52, stamina: 83,
    salary: 13500, askingPrice: 162000,
    imageFile: "player_senior_peru_03_1783400630710.webp",
  },
  {
    // 3★ on card
    name: "Diana Kumul",
    nationality: "Papua New Guinea",
    continent: "Oceania",
    age: 20, heightCm: 158, position: "all_rounder", potential: "Average",
    speed: 73, power: 67, defense: 68, serve: 67, block: 58, stamina: 71,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_png_03_1783400645172.webp",
  },
  {
    name: "Matilde Costa",
    nationality: "Portugal",
    continent: "Europe",
    age: 22, heightCm: 165, position: "defender", potential: "Average",
    speed: 78, power: 52, defense: 79, serve: 63, block: 47, stamina: 76,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_portugal_03_1783400648088.webp",
  },
  {
    // 4★ on card
    name: "Leilani Tufaga",
    nationality: "Samoa",
    continent: "Oceania",
    age: 21, heightCm: 159, position: "setter", potential: "High",
    speed: 76, power: 55, defense: 70, serve: 81, block: 51, stamina: 74,
    salary: 9000, askingPrice: 108000,
    imageFile: "player_senior_samoa_03_1783400660182.webp",
  },
  {
    name: "Lize van der Merwe",
    nationality: "South Africa",
    continent: "Africa & Middle East",
    age: 20, heightCm: 172, position: "setter", potential: "High",
    speed: 77, power: 57, defense: 71, serve: 80, block: 53, stamina: 75,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_south_africa_03_1783400669590.webp",
  },
  // ── BATCH 3 ──────────────────────────────────────────────────────────────
  {
    name: "Sofia Lindström",
    nationality: "Sweden",
    continent: "Europe",
    age: 27, heightCm: 172, position: "setter", potential: "High",
    speed: 78, power: 60, defense: 73, serve: 83, block: 56, stamina: 77,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_sweden_01_1783401093798.webp",
  },
  {
    // very tall all-rounder
    name: "Ella Andersson",
    nationality: "Sweden",
    continent: "Europe",
    age: 22, heightCm: 188, position: "all_rounder", potential: "Elite",
    speed: 76, power: 84, defense: 72, serve: 75, block: 78, stamina: 75,
    salary: 14000, askingPrice: 168000,
    imageFile: "player_senior_sweden_02_1783401097245.webp",
  },
  {
    // very tall defender
    name: "Linnea Sjöström",
    nationality: "Sweden",
    continent: "Europe",
    age: 21, heightCm: 186, position: "defender", potential: "High",
    speed: 80, power: 58, defense: 83, serve: 66, block: 60, stamina: 79,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_sweden_03_1783401103605.webp",
  },
  {
    // 3★ on card
    name: "Moearii Tetuanui",
    nationality: "Tahiti",
    continent: "Oceania",
    age: 20, heightCm: 168, position: "spiker", potential: "Average",
    speed: 75, power: 73, defense: 58, serve: 67, block: 60, stamina: 71,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_tahiti_03_1783401110267.webp",
  },
  {
    name: "Kanokwan P.",
    nationality: "Thailand",
    continent: "Asia",
    age: 24, heightCm: 168, position: "defender", potential: "Average",
    speed: 78, power: 51, defense: 79, serve: 62, block: 46, stamina: 76,
    salary: 6500, askingPrice: 78000,
    imageFile: "player_senior_thailand_03_1783401112391.webp",
  },
  {
    name: "Maheli Fotu",
    nationality: "Tonga",
    continent: "Oceania",
    age: 25, heightCm: 175, position: "all_rounder", potential: "Average",
    speed: 73, power: 74, defense: 70, serve: 68, block: 65, stamina: 72,
    salary: 7000, askingPrice: 84000,
    imageFile: "player_senior_tonga_01_1783401122600.webp",
  },
  {
    // very tall blocker, purple text = High
    name: "Mele Taufua",
    nationality: "Tonga",
    continent: "Oceania",
    age: 22, heightCm: 188, position: "blocker", potential: "High",
    speed: 62, power: 80, defense: 60, serve: 64, block: 88, stamina: 70,
    salary: 10000, askingPrice: 120000,
    imageFile: "player_senior_tonga_02_1783401125010.webp",
  },
  {
    // 4★ on card
    name: "Mahela Fotu",
    nationality: "Tonga",
    continent: "Oceania",
    age: 20, heightCm: 171, position: "blocker", potential: "High",
    speed: 65, power: 76, defense: 59, serve: 63, block: 84, stamina: 69,
    salary: 9500, askingPrice: 114000,
    imageFile: "player_senior_tonga_03_1783401127556.webp",
  },
];

async function main() {
  console.log(`=== Seeding ${PLAYERS.length} new draft players ===\n`);

  for (const [i, player] of PLAYERS.entries()) {
    console.log(`[${i + 1}/${PLAYERS.length}] ${player.name} (${player.nationality}) — ${player.position} — ${player.potential}`);

    const localPath = resolve(WORKSPACE_ROOT, "attached_assets", player.imageFile);
    const entityId = `player-cards/new-draft/player-${String(i + 1).padStart(2, "0")}.webp`;

    let imageUrl: string | null = null;
    try {
      imageUrl = await uploadPlayerImage(localPath, entityId);
    } catch (err) {
      console.error(`  ERROR uploading image: ${err}`);
    }

    await db.insert(playersTable).values({
      name: player.name,
      nationality: player.nationality,
      continent: player.continent,
      age: player.age,
      height: String(player.heightCm),
      position: player.position,
      speed: player.speed,
      power: player.power,
      defense: player.defense,
      serve: player.serve,
      block: player.block,
      stamina: player.stamina,
      potential: player.potential,
      salary: String(player.salary),
      askingPrice: String(player.askingPrice),
      imageUrl,
      teamId: null,
      isDraftPlayer: true,
      isRetired: false,
    });

    console.log(`  inserted → imageUrl=${imageUrl}\n`);
  }

  console.log(`=== Done! ${PLAYERS.length} draft players seeded. ===`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
