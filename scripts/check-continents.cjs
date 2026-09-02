#!/usr/bin/env node
/**
 * Build gate for continent values.
 *
 * A club whose continent the UI does not recognise used to vanish from the club
 * picker in silence: the picker walked a hardcoded list of six labels and drew
 * nothing for anything else. Three Oceania clubs were missing from character
 * creation for weeks and every guard in the repo passed, because no guard
 * renders a screen.
 *
 * The screen-level half of the fix is in the picker (unrecognised rows are now
 * drawn in red rather than skipped). This is the data half: no build ships with
 * a continent value outside the canonical set.
 *
 * Everything is DERIVED. The canonical keys are parsed out of
 * lib/db/src/schema/continents.ts rather than restated here — a second copy of
 * that list in this file would be the eighth vocabulary and exactly the bug
 * being guarded against. The columns are discovered from the database's own
 * schema, so a table added later is covered without anyone remembering.
 *
 * Run: node scripts/check-continents.cjs [path-to-db]
 */
const fs = require("fs");
const path = require("path");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  console.error(
    "[check-continents] FAILED: node:sqlite unavailable (needs Node >= 22).\n" +
      "  This check reads the shipped database and must not be skipped silently —\n" +
      "  a skipped check is how the club picker lost three clubs unnoticed.",
  );
  process.exit(1);
}

const REPO = path.join(__dirname, "..");
const CONTINENTS_TS = path.join(REPO, "lib", "db", "src", "schema", "continents.ts");
const DB = process.argv[2] || path.join(REPO, "lib", "db", "volleyball-empire.sqlite");

// ── The canonical keys, read from the single source of truth ────────────────
function readCanonicalKeys() {
  const src = fs.readFileSync(CONTINENTS_TS, "utf8");
  const m = src.match(/export const CONTINENT_KEYS = \[([\s\S]*?)\] as const;/);
  if (!m) {
    console.error(
      `[check-continents] FAILED: could not find CONTINENT_KEYS in ${CONTINENTS_TS}.\n` +
        "  The check cannot verify anything without it, and passing by default is\n" +
        "  the exact failure mode this guard exists to prevent.",
    );
    process.exit(1);
  }
  const keys = [...m[1].matchAll(/"([a-z_]+)"/g)].map((k) => k[1]);
  if (keys.length === 0) {
    console.error("[check-continents] FAILED: CONTINENT_KEYS parsed as empty.");
    process.exit(1);
  }
  return keys;
}

function main() {
  if (!fs.existsSync(DB)) {
    console.error(`[check-continents] FAILED: database not found at ${DB}`);
    process.exit(1);
  }

  const canonical = readCanonicalKeys();
  const canonicalSet = new Set(canonical);
  const db = new DatabaseSync(DB, { readOnly: true });

  // ── Discover every column that holds a continent ──────────────────────────
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all()
    .map((r) => r.name);

  const columns = [];
  for (const table of tables) {
    for (const col of db.prepare(`PRAGMA table_info("${table}")`).all()) {
      if (col.name === "continent" || col.name.endsWith("_continent")) {
        columns.push({ table, column: col.name });
      }
    }
  }

  console.log(`[check-continents] canonical keys: ${canonical.join(", ")}`);
  console.log(`[check-continents] ${columns.length} continent column(s) in ${path.basename(DB)}\n`);

  const violations = [];

  for (const { table, column } of columns) {
    const rows = db
      .prepare(
        `SELECT "${column}" AS value, COUNT(*) AS rows FROM "${table}"
          WHERE "${column}" IS NOT NULL GROUP BY "${column}" ORDER BY rows DESC`,
      )
      .all();

    const total = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
    if (total === 0) {
      console.log(`  ${table}.${column}  (empty)`);
      continue;
    }

    const parts = rows.map((r) => {
      const ok = canonicalSet.has(r.value);
      if (!ok) violations.push({ table, column, value: r.value, rows: r.rows });
      return `${ok ? "" : "!! "}${JSON.stringify(r.value)}=${r.rows}`;
    });
    console.log(`  ${table}.${column}  ${parts.join("  ")}`);
  }

  // ── Club templates: the picker's own data, reported explicitly ────────────
  // Not a failure when a region has no club — that is a content gap, not
  // corruption — but it is the number that made the picker look broken, so it
  // is printed on every build rather than left to be discovered on a screen.
  if (tables.includes("club_templates")) {
    const byKey = new Map(
      db
        .prepare(`SELECT continent AS k, COUNT(*) AS n FROM club_templates GROUP BY continent`)
        .all()
        .map((r) => [r.k, r.n]),
    );
    const totalClubs = db.prepare(`SELECT COUNT(*) AS n FROM club_templates`).get().n;
    const populated = canonical.filter((k) => (byKey.get(k) ?? 0) > 0);
    const empty = canonical.filter((k) => (byKey.get(k) ?? 0) === 0);

    console.log(
      `\n[check-continents] club templates: ${totalClubs} clubs across ` +
        `${populated.length}/${canonical.length} regions`,
    );
    for (const k of canonical) console.log(`    ${k.padEnd(20)} ${byKey.get(k) ?? 0}`);
    if (empty.length > 0) {
      console.log(
        `\n  NOTE: no club template in ${empty.join(", ")}. The picker will show ` +
          `${populated.length} regions, not ${canonical.length}. That is a content gap, not a bug —\n` +
          `        add a club template for that region if all ${canonical.length} should be selectable.`,
      );
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n[check-continents] FAILED: ${violations.length} continent value(s) outside the canonical set.`,
    );
    for (const v of violations) {
      console.error(`  ${v.table}.${v.column} = ${JSON.stringify(v.value)}  (${v.rows} row(s))`);
    }
    console.error(
      "\n  Screens group by these values. Anything unrecognised is at best drawn in\n" +
        "  the picker's red 'unrecognised' bucket and at worst missing from a screen\n" +
        "  that has not been taught to surface it.\n" +
        "\n  Fix: add the spelling to KEY_ALIASES in lib/db/src/schema/continents.ts so\n" +
        "  the boot migration converts it, then restart the server to apply it.",
    );
    process.exit(1);
  }

  console.log("\n[check-continents] OK — every continent value is a canonical key.");
}

main();
