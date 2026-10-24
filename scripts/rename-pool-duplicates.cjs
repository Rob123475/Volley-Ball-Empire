#!/usr/bin/env node
/**
 * 1.1.3 rebuild (brief A2, Rob 24 Oct): the 28 continental-pool players who carried the same
 * name as a world-roster player (seen on the Cup podium as "ALINA KORA, ALINA KORA") get names
 * of their own. The POOL player is renamed, never the world-roster player. New names follow the
 * same nation's athletes' surnames and collide with no player, pool player, staff member or youth
 * name (harness/pool-names.mjs walks the starter DB and asserts it).
 *
 * STARTER DB ONLY. Rob: do not reach into existing saves. A pool player's name no longer follows
 * the starter DB at boot (utils/ensureSchema.ts REFERENCE_UPDATE_ONLY), so saves already in play
 * keep the names they have; new saves get these.
 *
 * Idempotent: a row is renamed only while it still has its old name.
 *
 * Usage: node scripts/rename-pool-duplicates.cjs [--db <starter db copy>] [--write]
 */
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const REPO = path.resolve(__dirname, "..");
const i = process.argv.indexOf("--db");
const DB = i > 0 ? process.argv[i + 1] : path.join(REPO, "lib/db/volleyball-empire.sqlite");
const write = process.argv.includes("--write");

/** [stable_id, old name, new name] */
const RENAMES = [
  ["ASI_01_P1", "Yuki Tanaka", "Haruka Mori"],   // Japan
  ["ASI_05_P1", "Priya Sharma", "Kavya Mehta"],   // India
  ["AFM_05_P1", "Wanjiru Kamau", "Akinyi Odhiambo"],   // Kenya
  ["AUS_03_P1", "Aroha Tane", "Kahurangi Ngata"],   // New Zealand
  ["AFM_09_P1", "Sarah Ben Ammar", "Yasmine Mzoughi"],   // Tunisia
  ["AFM_09_P2", "Habiba Mzoughi", "Amira Bouazizi"],   // Tunisia
  ["AFM_10_P1", "Zawadi Kimaro", "Rehema Mollel"],   // Tanzania
  ["AFM_10_P2", "Asha Msuya", "Upendo Mwakalinga"],   // Tanzania
  ["ASI_09_P1", "Nguyen Mai Anh", "Tran Thu Trang"],   // Vietnam
  ["ASI_09_P2", "Le Minh Anh", "Le Ngoc Han"],   // Vietnam
  ["ASI_10_P1", "Chen Yu-Hsin", "Lin Pei-Shan"],   // Taiwan
  ["ASI_10_P2", "Huang Yi-Ting", "Hsu Wan-Ting"],   // Taiwan
  ["AUS_09_P1", "Alina Kora", "Grace Bainivalu"],   // Papua New Guinea
  ["AUS_09_P2", "Kiriwina Tau", "Lahui Kaupa"],   // Papua New Guinea
  ["AUS_10_P1", "Zoe Walker", "Ruby Mackenzie"],   // New Zealand
  ["AUS_10_P2", "Lily Mackenzie", "Isla Walker"],   // New Zealand
  ["EUR_09_P1", "Sofia Almeida", "Carolina Moreira"],   // Portugal
  ["EUR_09_P2", "Aoife O'Sullivan", "Niamh Kavanagh"],   // Ireland
  ["EUR_10_P1", "Sara Borg", "Maria Caruana"],   // Malta
  ["EUR_10_P2", "Yasmin Grech", "Nicole Borg"],   // Malta
  ["NAM_09_P1", "Kayla Thompson", "Tanisha Brown"],   // Jamaica
  ["NAM_09_P2", "Niah Myers", "Keisha Beckford"],   // Jamaica
  ["NAM_10_P1", "Aaliyah Rolle", "Shante Bethel"],   // Bahamas
  ["NAM_10_P2", "Jada Knowles", "Tiara Ferguson"],   // Bahamas
  ["SAM_09_P1", "Nia Campbell", "Anjali Persaud"],   // Guyana
  ["SAM_09_P2", "Amara James", "Keziah Campbell"],   // Guyana
  ["SAM_10_P1", "Valeria Mamani", "Ximena Zeballos"],   // Bolivia
  ["SAM_10_P2", "Camila Torrez", "Daniela Mamani"],   // Bolivia
];

const db = new DatabaseSync(DB, write ? {} : { readOnly: true });
const get = db.prepare("SELECT name FROM continental_pool_players WHERE stable_id = ?");
const set = db.prepare("UPDATE continental_pool_players SET name = ? WHERE stable_id = ? AND name = ?");
let renamed = 0, already = 0;
if (write) db.exec("BEGIN");
for (const [stable, from, to] of RENAMES) {
  const now = get.get(stable)?.name;
  if (now === to) { already++; continue; }
  if (now !== from) throw new Error(`${stable} is "${now}", expected "${from}"`);
  console.log(`  ${stable}  ${from}  ->  ${to}`);
  if (write) set.run(to, stable, from);
  renamed++;
}
if (write) db.exec("COMMIT");
console.log(`[rename-pool-duplicates] ${renamed} ${write ? "renamed" : "to rename (dry run)"}, ${already} already renamed`);
