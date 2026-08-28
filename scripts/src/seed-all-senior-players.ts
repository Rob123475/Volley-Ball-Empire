/**
 * Reseed all 72 senior free-agent players with GCS images and full data.
 *
 * Steps:
 *   1. Delete existing free agents whose imageUrl starts with `/players/`
 *      (old static paths that are broken) or have no image.
 *   2. Upload all 72 portrait .webp files to GCS.
 *   3. Insert fresh rows with /objects/player-cards/... image URLs.
 *   4. After this, run fill-all-player-development to populate development jsonb.
 *
 * Run: pnpm --filter @workspace/scripts run seed-all-senior-players
 */

import { Storage } from "@google-cloud/storage";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { db } from "@workspace/db";
import { playersTable, careerPlayerStateTable } from "@workspace/db/schema";
import { isNull, like, or, and, eq, isNotNull, notExists, sql } from "drizzle-orm";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const WORKSPACE  = resolve(__dirname, "../../");
const ASSETS     = resolve(WORKSPACE, "attached_assets");

const SIDECAR         = "http://127.0.0.1:1106";
const BUCKET_ID       = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
const PRIVATE_OBJ_DIR = process.env.PRIVATE_OBJECT_DIR!;

if (!BUCKET_ID || !PRIVATE_OBJ_DIR) {
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

async function uploadImage(localFile: string, entityId: string): Promise<string> {
  const dir  = PRIVATE_OBJ_DIR.endsWith("/") ? PRIVATE_OBJ_DIR : `${PRIVATE_OBJ_DIR}/`;
  const parts = dir.startsWith("/") ? dir.slice(1) : dir;
  const slash = parts.indexOf("/");
  const bucket = slash === -1 ? parts.replace(/\/$/, "") : parts.slice(0, slash);
  const prefix = slash === -1 ? "" : parts.slice(slash + 1);
  const obj    = `${prefix}${entityId}`;

  const content = readFileSync(localFile);
  await gcs.bucket(bucket).file(obj).save(content, {
    contentType: "image/webp",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  console.log(`    ↑ gs://${bucket}/${obj}`);
  return `/objects/${entityId}`;
}

// ---------------------------------------------------------------------------
// Player definitions — 72 total, 12 per region
// ---------------------------------------------------------------------------

type Position  = "spiker" | "defender" | "setter" | "blocker" | "all_rounder";
type Potential = "Elite" | "High" | "Average";

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
  entityId:    string;  // GCS path
}

const PLAYERS: PlayerDef[] = [
  // ── Africa (12) ──────────────────────────────────────────────────────────
  { name: "Zandile Mthethwa",     nationality: "South Africa", age: 24, heightCm: 176, position: "spiker",      potential: "High",    stats: { speed: 78, power: 84, defense: 64, serve: 71, block: 66, stamina: 76 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_africa_01_1783393821470.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-01.webp" },
  { name: "Nompumelelo Dlamini",  nationality: "South Africa", age: 26, heightCm: 171, position: "defender",    potential: "Average", stats: { speed: 83, power: 58, defense: 85, serve: 67, block: 52, stamina: 79 }, salary:  9000, askingPrice: 108000, imageFile: "player_senior_africa_02_1783393830703.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-02.webp" },
  { name: "Chinaza Okoro",        nationality: "Nigeria",      age: 24, heightCm: 175, position: "setter",      potential: "High",    stats: { speed: 74, power: 63, defense: 76, serve: 83, block: 59, stamina: 75 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_africa_03_1783393839383.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-03.webp" },
  { name: "Amara Udeh",           nationality: "Nigeria",      age: 27, heightCm: 182, position: "blocker",     potential: "Average", stats: { speed: 66, power: 79, defense: 68, serve: 64, block: 86, stamina: 72 }, salary:  9500, askingPrice: 114000, imageFile: "player_senior_africa_04_1783393843180.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-04.webp" },
  { name: "Amira El Mansouri",    nationality: "Morocco",      age: 26, heightCm: 171, position: "defender",    potential: "Average", stats: { speed: 81, power: 60, defense: 83, serve: 66, block: 54, stamina: 78 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_africa_05_1783393853040.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-05.webp" },
  { name: "Laila El Hassani",     nationality: "Morocco",      age: 25, heightCm: 180, position: "spiker",      potential: "Elite",   stats: { speed: 76, power: 86, defense: 62, serve: 72, block: 68, stamina: 74 }, salary: 14000, askingPrice: 168000, imageFile: "player_senior_africa_06_1783393856209.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-06.webp" },
  { name: "Salma Benyahia",       nationality: "Egypt",        age: 27, heightCm: 172, position: "setter",      potential: "Average", stats: { speed: 72, power: 61, defense: 74, serve: 81, block: 57, stamina: 73 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_africa_07_1783393858960.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-07.webp" },
  { name: "Layla Hassan",         nationality: "Egypt",        age: 24, heightCm: 178, position: "spiker",      potential: "High",    stats: { speed: 80, power: 82, defense: 63, serve: 70, block: 65, stamina: 77 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_africa_08_1783393862162.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-08.webp" },
  { name: "Sarah Ben Ammar",      nationality: "Tunisia",      age: 24, heightCm: 167, position: "all_rounder", potential: "High",    stats: { speed: 74, power: 72, defense: 74, serve: 73, block: 71, stamina: 76 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_africa_09_1783393882630.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-09.webp" },
  { name: "Habiba Mzoughi",       nationality: "Tunisia",      age: 25, heightCm: 188, position: "blocker",     potential: "Elite",   stats: { speed: 67, power: 81, defense: 65, serve: 62, block: 88, stamina: 70 }, salary: 14500, askingPrice: 174000, imageFile: "player_senior_africa_10_1783393885422.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-10.webp" },
  { name: "Wanjiru Kimani",       nationality: "Kenya",        age: 25, heightCm: 178, position: "blocker",     potential: "High",    stats: { speed: 70, power: 77, defense: 66, serve: 63, block: 84, stamina: 73 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_africa_11_1783393887533.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-11.webp" },
  { name: "Neema Mwangi",         nationality: "Kenya",        age: 24, heightCm: 181, position: "setter",      potential: "High",    stats: { speed: 73, power: 65, defense: 75, serve: 82, block: 61, stamina: 74 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_africa_12_1783393890875.webp", continent: "Africa & Middle East", entityId: "player-cards/africa/player-12.webp" },

  // ── Asia (12) ─────────────────────────────────────────────────────────────
  { name: "Liu Yi",               nationality: "China",        age: 24, heightCm: 179, position: "spiker",      potential: "High",    stats: { speed: 80, power: 85, defense: 63, serve: 72, block: 67, stamina: 77 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_asia_01_1783394415403.webp",   continent: "Asia",                entityId: "player-cards/asia/player-01.webp" },
  { name: "Zhang Wei",            nationality: "China",        age: 22, heightCm: 177, position: "all_rounder", potential: "High",    stats: { speed: 75, power: 71, defense: 73, serve: 72, block: 69, stamina: 74 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_asia_02_1783394425596.webp",   continent: "Asia",                entityId: "player-cards/asia/player-02.webp" },
  { name: "Nuttanan Srisung",     nationality: "Thailand",     age: 24, heightCm: 168, position: "defender",    potential: "Average", stats: { speed: 84, power: 57, defense: 83, serve: 66, block: 51, stamina: 80 }, salary:  9000, askingPrice: 108000, imageFile: "player_senior_asia_03_1783394434811.webp",   continent: "Asia",                entityId: "player-cards/asia/player-03.webp" },
  { name: "Kanlaya Pornpun",      nationality: "Thailand",     age: 22, heightCm: 161, position: "spiker",      potential: "High",    stats: { speed: 82, power: 78, defense: 60, serve: 69, block: 62, stamina: 75 }, salary:  9500, askingPrice: 114000, imageFile: "player_senior_asia_04_1783394442768.webp",   continent: "Asia",                entityId: "player-cards/asia/player-04.webp" },
  { name: "Tran Thi Bich",        nationality: "Vietnam",      age: 23, heightCm: 173, position: "defender",    potential: "Average", stats: { speed: 82, power: 58, defense: 82, serve: 65, block: 52, stamina: 79 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_asia_05_1783394452039.webp",   continent: "Asia",                entityId: "player-cards/asia/player-05.webp" },
  { name: "Le Minh Anh",          nationality: "Vietnam",      age: 21, heightCm: 171, position: "all_rounder", potential: "High",    stats: { speed: 76, power: 70, defense: 73, serve: 71, block: 68, stamina: 73 }, salary:  9000, askingPrice: 108000, imageFile: "player_senior_asia_06_1783394460812.webp",   continent: "Asia",                entityId: "player-cards/asia/player-06.webp" },
  { name: "Alyssa Valdez",        nationality: "Philippines",  age: 24, heightCm: 170, position: "setter",      potential: "Average", stats: { speed: 73, power: 62, defense: 75, serve: 82, block: 58, stamina: 74 }, salary:  9000, askingPrice: 108000, imageFile: "player_senior_asia_07_1783394486242.webp",   continent: "Asia",                entityId: "player-cards/asia/player-07.webp" },
  { name: "Mika Reyes",           nationality: "Philippines",  age: 22, heightCm: 176, position: "spiker",      potential: "High",    stats: { speed: 79, power: 81, defense: 62, serve: 70, block: 64, stamina: 75 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_asia_08_1783394496466.webp",   continent: "Asia",                entityId: "player-cards/asia/player-08.webp" },
  { name: "Priya Sharma",         nationality: "India",        age: 21, heightCm: 165, position: "all_rounder", potential: "Average", stats: { speed: 74, power: 69, defense: 72, serve: 72, block: 67, stamina: 73 }, salary:  9000, askingPrice: 108000, imageFile: "player_senior_asia_09_1783394509793.webp",   continent: "Asia",                entityId: "player-cards/asia/player-09.webp" },
  { name: "Ananya Iyer",          nationality: "India",        age: 25, heightCm: 174, position: "spiker",      potential: "High",    stats: { speed: 77, power: 87, defense: 63, serve: 73, block: 69, stamina: 76 }, salary: 14000, askingPrice: 168000, imageFile: "player_senior_asia_10_1783394518034.webp",   continent: "Asia",                entityId: "player-cards/asia/player-10.webp" },
  { name: "Yui Tanaka",           nationality: "Japan",        age: 21, heightCm: 168, position: "defender",    potential: "High",    stats: { speed: 85, power: 59, defense: 84, serve: 67, block: 53, stamina: 81 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_asia_11_1783394527837.webp",   continent: "Asia",                entityId: "player-cards/asia/player-11.webp" },
  { name: "Ayaka Mori",           nationality: "Japan",        age: 24, heightCm: 165, position: "defender",    potential: "Average", stats: { speed: 83, power: 56, defense: 82, serve: 65, block: 50, stamina: 79 }, salary:  9000, askingPrice: 108000, imageFile: "player_senior_asia_12_1783394537853.webp",   continent: "Asia",                entityId: "player-cards/asia/player-12.webp" },

  // ── Europe (12) ───────────────────────────────────────────────────────────
  { name: "Georgia Mears",        nationality: "England",      age: 24, heightCm: 178, position: "spiker",      potential: "High",    stats: { speed: 79, power: 83, defense: 64, serve: 72, block: 66, stamina: 76 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_europe_01_1783394597415.webp", continent: "Europe",              entityId: "player-cards/europe/player-01.webp" },
  { name: "Emily Harrison",       nationality: "England",      age: 24, heightCm: 175, position: "blocker",     potential: "High",    stats: { speed: 67, power: 80, defense: 66, serve: 63, block: 85, stamina: 72 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_europe_02_1783394605016.webp", continent: "Europe",              entityId: "player-cards/europe/player-02.webp" },
  { name: "Lucía Martínez",       nationality: "Spain",        age: 25, heightCm: 175, position: "spiker",      potential: "High",    stats: { speed: 77, power: 82, defense: 63, serve: 71, block: 65, stamina: 75 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_europe_03_1783394612466.webp", continent: "Europe",              entityId: "player-cards/europe/player-03.webp" },
  { name: "Marta Hernández",      nationality: "Spain",        age: 26, heightCm: 172, position: "defender",    potential: "Average", stats: { speed: 83, power: 59, defense: 84, serve: 67, block: 53, stamina: 80 }, salary:  9000, askingPrice: 108000, imageFile: "player_senior_europe_04_1783394619604.webp", continent: "Europe",              entityId: "player-cards/europe/player-04.webp" },
  { name: "Inês Moreira",         nationality: "Portugal",     age: 24, heightCm: 173, position: "defender",    potential: "Average", stats: { speed: 82, power: 57, defense: 83, serve: 65, block: 51, stamina: 79 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_europe_05_1783394629148.webp", continent: "Europe",              entityId: "player-cards/europe/player-05.webp" },
  { name: "Beatriz Almeida",      nationality: "Portugal",     age: 27, heightCm: 178, position: "all_rounder", potential: "Average", stats: { speed: 71, power: 74, defense: 73, serve: 72, block: 70, stamina: 73 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_europe_06_1783394641072.webp", continent: "Europe",              entityId: "player-cards/europe/player-06.webp" },
  { name: "Sanne Keizer",         nationality: "Netherlands",  age: 24, heightCm: 183, position: "spiker",      potential: "Elite",   stats: { speed: 76, power: 88, defense: 62, serve: 73, block: 70, stamina: 75 }, salary: 14500, askingPrice: 174000, imageFile: "player_senior_europe_07_1783394651676.webp", continent: "Europe",              entityId: "player-cards/europe/player-07.webp" },
  { name: "Lieke Jansen",         nationality: "Netherlands",  age: 25, heightCm: 168, position: "spiker",      potential: "High",    stats: { speed: 81, power: 80, defense: 63, serve: 71, block: 64, stamina: 77 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_europe_08_1783394660037.webp", continent: "Europe",              entityId: "player-cards/europe/player-08.webp" },
  { name: "Léa Giraud",           nationality: "Monaco",       age: 22, heightCm: 165, position: "defender",    potential: "High",    stats: { speed: 84, power: 57, defense: 82, serve: 66, block: 52, stamina: 80 }, salary:  9500, askingPrice: 114000, imageFile: "player_senior_europe_09_1783394678162.webp", continent: "Europe",              entityId: "player-cards/europe/player-09.webp" },
  { name: "Alice Marchand",       nationality: "Monaco",       age: 24, heightCm: 178, position: "spiker",      potential: "High",    stats: { speed: 78, power: 84, defense: 63, serve: 71, block: 67, stamina: 76 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_europe_10_1783394686612.webp", continent: "Europe",              entityId: "player-cards/europe/player-10.webp" },
  { name: "Lena Schneider",       nationality: "Germany",      age: 27, heightCm: 179, position: "spiker",      potential: "Elite",   stats: { speed: 78, power: 87, defense: 64, serve: 74, block: 68, stamina: 77 }, salary: 14000, askingPrice: 168000, imageFile: "player_senior_europe_11_1783394695184.webp", continent: "Europe",              entityId: "player-cards/europe/player-11.webp" },
  { name: "Leonie Müller",        nationality: "Germany",      age: 23, heightCm: 176, position: "spiker",      potential: "High",    stats: { speed: 80, power: 82, defense: 63, serve: 71, block: 65, stamina: 76 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_europe_12_1783394707136.webp", continent: "Europe",              entityId: "player-cards/europe/player-12.webp" },

  // ── North America (12) ────────────────────────────────────────────────────
  { name: "Kelsey Anderson",      nationality: "USA",          age: 24, heightCm: 180, position: "spiker",      potential: "Elite",   stats: { speed: 82, power: 89, defense: 64, serve: 75, block: 70, stamina: 78 }, salary: 15000, askingPrice: 180000, imageFile: "player_senior_n.america_01_1783394785140.webp",  continent: "North America",       entityId: "player-cards/n-america/player-01.webp" },
  { name: "Hailey Carter",        nationality: "USA",          age: 22, heightCm: 175, position: "defender",    potential: "High",    stats: { speed: 83, power: 60, defense: 84, serve: 65, block: 55, stamina: 81 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_n.america_02_1783394793117.webp",  continent: "North America",       entityId: "player-cards/n-america/player-02.webp" },
  { name: "Sofía Ramírez",        nationality: "Mexico",       age: 23, heightCm: 171, position: "setter",      potential: "High",    stats: { speed: 78, power: 65, defense: 72, serve: 84, block: 60, stamina: 77 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_n.america_03_1783394801689.webp",  continent: "North America",       entityId: "player-cards/n-america/player-03.webp" },
  { name: "Valeria Gómez",        nationality: "Mexico",       age: 21, heightCm: 168, position: "all_rounder", potential: "Average", stats: { speed: 72, power: 71, defense: 72, serve: 71, block: 68, stamina: 72 }, salary:  8000, askingPrice:  96000, imageFile: "player_senior_n.america_04_(2)_1783394810833.webp", continent: "North America",       entityId: "player-cards/n-america/player-04.webp" },
  { name: "Jessica Morris",       nationality: "Canada",       age: 25, heightCm: 182, position: "spiker",      potential: "Elite",   stats: { speed: 74, power: 88, defense: 63, serve: 73, block: 74, stamina: 76 }, salary: 14500, askingPrice: 174000, imageFile: "player_senior_n.america_05_1783394820859.webp",  continent: "North America",       entityId: "player-cards/n-america/player-05.webp" },
  { name: "Olivia MacLean",       nationality: "Canada",       age: 22, heightCm: 176, position: "defender",    potential: "High",    stats: { speed: 82, power: 60, defense: 83, serve: 66, block: 54, stamina: 80 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_n.america_06_1783394828801.webp",  continent: "North America",       entityId: "player-cards/n-america/player-06.webp" },
  { name: "Lissette Morejón",     nationality: "Cuba",         age: 24, heightCm: 175, position: "all_rounder", potential: "High",    stats: { speed: 76, power: 76, defense: 75, serve: 74, block: 72, stamina: 77 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_n.america_07_1783394836605.webp",  continent: "North America",       entityId: "player-cards/n-america/player-07.webp" },
  { name: "Yarisley Silva",       nationality: "Cuba",         age: 21, heightCm: 170, position: "spiker",      potential: "Average", stats: { speed: 79, power: 78, defense: 61, serve: 69, block: 62, stamina: 74 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_n.america_08_1783394844445.webp",  continent: "North America",       entityId: "player-cards/n-america/player-08.webp" },
  { name: "María José Alpízar",   nationality: "Costa Rica",   age: 23, heightCm: 169, position: "setter",      potential: "Average", stats: { speed: 76, power: 63, defense: 71, serve: 80, block: 57, stamina: 74 }, salary:  8000, askingPrice:  96000, imageFile: "player_senior_n.america_09_1783394851900.webp",  continent: "North America",       entityId: "player-cards/n-america/player-09.webp" },
  { name: "Daniela Rivera",       nationality: "Costa Rica",   age: 22, heightCm: 167, position: "setter",      potential: "Average", stats: { speed: 75, power: 61, defense: 70, serve: 79, block: 56, stamina: 73 }, salary:  7500, askingPrice:  90000, imageFile: "player_senior_n.america_10_1783394860016.webp",  continent: "North America",       entityId: "player-cards/n-america/player-10.webp" },
  { name: "Niah Myers",           nationality: "Jamaica",      age: 22, heightCm: 169, position: "spiker",      potential: "High",    stats: { speed: 84, power: 80, defense: 62, serve: 70, block: 63, stamina: 79 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_n.america_11_1783395303562.webp",  continent: "North America",       entityId: "player-cards/n-america/player-11.webp" },
  { name: "Jayda Brown",          nationality: "Jamaica",      age: 21, heightCm: 170, position: "blocker",     potential: "Average", stats: { speed: 68, power: 78, defense: 64, serve: 62, block: 82, stamina: 70 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_n.america_12_1783395311267.webp",  continent: "North America",       entityId: "player-cards/n-america/player-12.webp" },

  // ── Oceania (12) ──────────────────────────────────────────────────────────
  { name: "Charlotte Wade",       nationality: "Australia",       age: 26, heightCm: 178, position: "spiker",      potential: "High",    stats: { speed: 80, power: 84, defense: 65, serve: 73, block: 67, stamina: 76 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_oceania_01_1783395436468.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-01.webp" },
  { name: "Tiare Morrison",       nationality: "Australia",       age: 24, heightCm: 180, position: "spiker",      potential: "Elite",   stats: { speed: 82, power: 88, defense: 64, serve: 74, block: 70, stamina: 78 }, salary: 14500, askingPrice: 174000, imageFile: "player_senior_oceania_02_1783395442853.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-02.webp" },
  { name: "Zoe Walker",           nationality: "New Zealand",     age: 25, heightCm: 181, position: "blocker",     potential: "High",    stats: { speed: 68, power: 82, defense: 67, serve: 64, block: 86, stamina: 73 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_oceania_03_1783395452770.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-03.webp" },
  { name: "Lily Mackenzie",       nationality: "New Zealand",     age: 23, heightCm: 174, position: "defender",    potential: "High",    stats: { speed: 84, power: 59, defense: 85, serve: 66, block: 53, stamina: 82 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_oceania_04_1783395460200.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-04.webp" },
  { name: "Aria Nasevui",         nationality: "Fiji",            age: 24, heightCm: 180, position: "defender",    potential: "Average", stats: { speed: 80, power: 61, defense: 80, serve: 63, block: 56, stamina: 77 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_oceania_05_1783395472331.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-05.webp" },
  { name: "Lena Raitoga",         nationality: "Fiji",            age: 23, heightCm: 176, position: "spiker",      potential: "Average", stats: { speed: 78, power: 78, defense: 62, serve: 68, block: 63, stamina: 73 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_oceania_06_1783395504661.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-06.webp" },
  { name: "Tiafafine Leota",      nationality: "Samoa",           age: 22, heightCm: 168, position: "setter",      potential: "Average", stats: { speed: 75, power: 63, defense: 70, serve: 80, block: 56, stamina: 73 }, salary:  7500, askingPrice:  90000, imageFile: "player_senior_oceania_07_1783395520898.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-07.webp" },
  { name: "Leilani Fa'asamoa",    nationality: "Samoa",           age: 24, heightCm: 185, position: "spiker",      potential: "High",    stats: { speed: 71, power: 86, defense: 62, serve: 70, block: 73, stamina: 72 }, salary: 11500, askingPrice: 138000, imageFile: "player_senior_oceania_08_1783395530031.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-08.webp" },
  { name: "Kiriwina Tau",         nationality: "Papua New Guinea",age: 21, heightCm: 162, position: "all_rounder", potential: "Average", stats: { speed: 75, power: 70, defense: 70, serve: 69, block: 65, stamina: 72 }, salary:  7500, askingPrice:  90000, imageFile: "player_senior_oceania_09_1783395536317.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-09.webp" },
  { name: "Mere Bainivalu",       nationality: "Papua New Guinea",age: 21, heightCm: 190, position: "spiker",      potential: "High",    stats: { speed: 73, power: 83, defense: 68, serve: 70, block: 77, stamina: 72 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_oceania_10_1783395542597.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-10.webp" },
  { name: "Mahina Teheiura",      nationality: "Tahiti",          age: 22, heightCm: 168, position: "defender",    potential: "Average", stats: { speed: 81, power: 57, defense: 82, serve: 64, block: 52, stamina: 79 }, salary:  8000, askingPrice:  96000, imageFile: "player_senior_oceania_11_1783395548644.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-11.webp" },
  { name: "Vahiné Maohi",         nationality: "Tahiti",          age: 24, heightCm: 187, position: "spiker",      potential: "High",    stats: { speed: 73, power: 87, defense: 63, serve: 71, block: 74, stamina: 74 }, salary: 12000, askingPrice: 144000, imageFile: "player_senior_oceania_12_1783395555449.webp", continent: "Oceania",             entityId: "player-cards/oceania/player-12.webp" },

  // ── South America (12) ────────────────────────────────────────────────────
  { name: "Laís Ribeiro",         nationality: "Brazil",       age: 24, heightCm: 176, position: "spiker",      potential: "Elite",   stats: { speed: 83, power: 88, defense: 65, serve: 75, block: 68, stamina: 79 }, salary: 15000, askingPrice: 180000, imageFile: "player_senior_s.america_01_1783395606836.webp", continent: "South America",       entityId: "player-cards/s-america/player-01.webp" },
  { name: "Carolina Santos",      nationality: "Brazil",       age: 22, heightCm: 168, position: "defender",    potential: "High",    stats: { speed: 84, power: 60, defense: 84, serve: 65, block: 54, stamina: 81 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_s.america_02_1783395616328.webp", continent: "South America",       entityId: "player-cards/s-america/player-02.webp" },
  { name: "Sofía Mastrangelo",    nationality: "Argentina",    age: 24, heightCm: 175, position: "setter",      potential: "High",    stats: { speed: 77, power: 66, defense: 72, serve: 84, block: 61, stamina: 77 }, salary: 10000, askingPrice: 120000, imageFile: "player_senior_s.america_03_1783395626670.webp", continent: "South America",       entityId: "player-cards/s-america/player-03.webp" },
  { name: "Camila Barrios",       nationality: "Argentina",    age: 27, heightCm: 180, position: "blocker",     potential: "High",    stats: { speed: 67, power: 81, defense: 66, serve: 63, block: 86, stamina: 72 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_s.america_04._1783395636555.webp", continent: "South America",      entityId: "player-cards/s-america/player-04.webp" },
  { name: "Valentina Ospina",     nationality: "Colombia",     age: 23, heightCm: 172, position: "spiker",      potential: "High",    stats: { speed: 81, power: 82, defense: 63, serve: 72, block: 65, stamina: 77 }, salary: 10500, askingPrice: 126000, imageFile: "player_senior_s.america_05_1783395645204.webp", continent: "South America",       entityId: "player-cards/s-america/player-05.webp" },
  { name: "Isabella Rodríguez",   nationality: "Colombia",     age: 22, heightCm: 168, position: "defender",    potential: "Average", stats: { speed: 82, power: 58, defense: 81, serve: 64, block: 52, stamina: 78 }, salary:  8000, askingPrice:  96000, imageFile: "player_senior_s.america_06_1783395655525.webp", continent: "South America",       entityId: "player-cards/s-america/player-06.webp" },
  { name: "Antonia Reyes",        nationality: "Chile",        age: 24, heightCm: 172, position: "setter",      potential: "Average", stats: { speed: 76, power: 63, defense: 70, serve: 79, block: 57, stamina: 73 }, salary:  8000, askingPrice:  96000, imageFile: "player_senior_s.america_07_1783395668802.webp", continent: "South America",       entityId: "player-cards/s-america/player-07.webp" },
  { name: "Martina Valdés",       nationality: "Chile",        age: 22, heightCm: 177, position: "all_rounder", potential: "Average", stats: { speed: 73, power: 73, defense: 72, serve: 71, block: 70, stamina: 73 }, salary:  8000, askingPrice:  96000, imageFile: "player_senior_s.america_08_1783395677555.webp", continent: "South America",       entityId: "player-cards/s-america/player-08.webp" },
  { name: "Camila Torrez",        nationality: "Bolivia",      age: 21, heightCm: 178, position: "spiker",      potential: "Average", stats: { speed: 79, power: 79, defense: 61, serve: 68, block: 63, stamina: 73 }, salary:  8500, askingPrice: 102000, imageFile: "player_senior_s.america_09_1783395687582.webp", continent: "South America",       entityId: "player-cards/s-america/player-09.webp" },
  { name: "Noelia Zeballos",      nationality: "Bolivia",      age: 23, heightCm: 175, position: "defender",    potential: "Average", stats: { speed: 81, power: 59, defense: 81, serve: 64, block: 53, stamina: 78 }, salary:  8000, askingPrice:  96000, imageFile: "player_senior_s.america_10_1783395695389.webp", continent: "South America",       entityId: "player-cards/s-america/player-10.webp" },
  { name: "Valeria Rodríguez",    nationality: "Peru",         age: 22, heightCm: 172, position: "defender",    potential: "Average", stats: { speed: 82, power: 57, defense: 82, serve: 63, block: 51, stamina: 78 }, salary:  7500, askingPrice:  90000, imageFile: "player_senior_s.america_11_1783395703727.webp", continent: "South America",       entityId: "player-cards/s-america/player-11.webp" },
  { name: "Camila Torres",        nationality: "Peru",         age: 23, heightCm: 180, position: "spiker",      potential: "High",    stats: { speed: 78, power: 83, defense: 63, serve: 70, block: 67, stamina: 75 }, salary: 11000, askingPrice: 132000, imageFile: "player_senior_s.america_12_1783395712966.webp", continent: "South America",       entityId: "player-cards/s-america/player-12.webp" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ovr(s: PlayerDef["stats"]): number {
  return Math.round((s.speed + s.power + s.defense + s.serve + s.block + s.stamina) / 6);
}

function contractYears(age: number): number {
  return age <= 21 ? 3 : age <= 25 ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Step 1: Remove old free-agent rows with broken image paths ===\n");

  // Delete free agents whose image URL is the old static /players/ paths,
  // or those that have no image at all and no team.
  const deleted = await db
    .delete(playersTable)
    .where(
      and(
        // Team membership is career state now — exclude any player some
        // career has signed to a club.
        notExists(
          db.select({ one: sql`1` })
            .from(careerPlayerStateTable)
            .where(and(
              eq(careerPlayerStateTable.playerId, playersTable.id),
              isNotNull(careerPlayerStateTable.teamId),
            )),
        ),
        eq(playersTable.isDraftPlayer, false),
        or(
          like(playersTable.imageUrl, "/players/%"),
          isNull(playersTable.imageUrl),
        ),
      ),
    )
    .returning({ id: playersTable.id });

  console.log(`  Removed ${deleted.length} old free-agent rows.\n`);

  console.log("=== Step 2: Upload images + insert 72 senior players ===\n");

  let ok = 0;
  let fail = 0;

  for (const [i, player] of PLAYERS.entries()) {
    const n = String(i + 1).padStart(2, " ");
    console.log(`[${n}/72] ${player.name} (${player.nationality})`);

    const localPath = resolve(ASSETS, player.imageFile);
    if (!existsSync(localPath)) {
      console.error(`  ⚠  Image not found: ${localPath} — inserting without image`);
    }

    let imageUrl: string | null = null;
    try {
      if (existsSync(localPath)) {
        imageUrl = await uploadImage(localPath, player.entityId);
      }
    } catch (err) {
      console.error(`  ✗ Upload failed: ${err}`);
      fail++;
    }

    const overall = ovr(player.stats);

    await db.insert(playersTable).values({
      name:           player.name,
      nationality:    player.nationality,
      baseAge:            player.age,
      height:         player.heightCm,
      position:       player.position,
      speed:          player.stats.speed,
      power:          player.stats.power,
      defense:        player.stats.defense,
      serve:          player.stats.serve,
      block:          player.stats.block,
      stamina:        player.stats.stamina,
      potential:      player.potential,
      askingPrice:    player.askingPrice,
      continent:      player.continent,
      imageUrl,
      isDraftPlayer:  false,
      playerType:     "senior",
    });

    console.log(`  ✓ inserted (OVR ${overall})\n`);
    ok++;
  }

  console.log(`=== Done! ${ok} inserted, ${fail} image upload failures. ===`);
  console.log("\nNext: run  pnpm --filter @workspace/scripts run fill-all-player-development");
  console.log("      to populate the extended attribute data (development jsonb).\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
