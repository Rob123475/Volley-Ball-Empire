#!/usr/bin/env node
/**
 * 1.1.3 (AI market brief item 6, Rob 25 Oct): the staff member who shares a name with pool player
 * SAM_04_P1 Lucía Quispe (staff 10172, a Peruvian Doctor) takes another first name; the pool player
 * keeps Lucía. Rob asked for Rosa, but Rosa Quispe is already a staff member (10078, a Massage
 * Therapist), so she is Rosario Quispe (Rosa is its short form): a name no player, pool player,
 * staff member, youth or AI manager has (harness/pool-names.mjs walks the starter DB).
 *
 * STARTER DB ONLY. A staff name follows the starter DB into a save only when the save still has a
 * name the starter DB itself once shipped for that id (utils/ensureSchema.ts Pass 4,
 * PREVIOUS_STAFF_NAMES); Lucía is not added there, so saves in play keep her.
 *
 * Idempotent. Usage: node scripts/rename-staff-quispe.cjs [--db <starter db copy>] [--write]
 */
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const REPO = path.resolve(__dirname, "..");
const i = process.argv.indexOf("--db");
const DB = i > 0 ? process.argv[i + 1] : path.join(REPO, "lib/db/volleyball-empire.sqlite");
const write = process.argv.includes("--write");
const ID = 10172, FROM = "Lucía Quispe", TO = "Rosario Quispe";

const d = new DatabaseSync(DB, { readOnly: !write });
const row = d.prepare("SELECT id, name, role FROM staff WHERE id = ?").get(ID);
const taken = [["players", "name"], ["continental_pool_players", "name"], ["staff", "name"]]
  .flatMap(([t, c]) => d.prepare(`SELECT '${t}' AS t, ${c} AS n FROM ${t} WHERE lower(${c}) = lower(?)`).all(TO));
if (row?.name === FROM) {
  if (taken.length) { console.log(`not renamed: ${TO} is taken (${taken.map((r) => r.t).join(", ")})`); process.exit(1); }
  if (write) d.prepare("UPDATE staff SET name = ? WHERE id = ? AND name = ?").run(TO, ID, FROM);
  console.log(`staff ${ID} (${row.role}): ${FROM} -> ${TO}${write ? "" : " (dry run: --write to apply)"}`);
} else console.log(`staff ${ID} is ${row?.name ?? "missing"}: nothing to do`);
d.close();
