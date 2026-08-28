#!/usr/bin/env node
/**
 * Drift guard for the committed starter database.
 *
 * lib/db/volleyball-empire.sqlite is a shipped ARTIFACT: electron/main.js copies
 * it into userData on first launch and it is the schema every new player gets.
 * It had drifted 11 columns behind the model without anyone noticing, because
 * the drops were only ever applied to copies. Regenerating it by hand is a step
 * that will be forgotten, and then a stale artifact ships silently.
 *
 * Everything below is DERIVED. There is no list of expected columns to maintain:
 * the drizzle schema is parsed for what the model declares, the database is read
 * for what it has, and the two must agree.
 *
 * The one permitted difference is a column SQLite physically refuses to drop
 * because a foreign key depends on it (players.outfit_id). That is detected from
 * the table's own CREATE TABLE text, not from an allowlist.
 *
 * Run: node scripts/check-starter-db.cjs [path-to-db]
 */
const fs = require("fs");
const path = require("path");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  console.error(
    "[check-starter-db] FAILED: node:sqlite unavailable (needs Node >= 22).\n" +
    "  This check reads the shipped database and must not be skipped silently —\n" +
    "  a skipped check is how the artifact drifted in the first place.",
  );
  process.exit(1);
}

const REPO = path.join(__dirname, "..");
const SCHEMA_DIR = path.join(REPO, "lib", "db", "src", "schema");
const DB = process.argv[2] || path.join(REPO, "lib", "db", "volleyball-empire.sqlite");

// ── What the model declares ─────────────────────────────────────────────────
function readModel() {
  let src = "";
  for (const f of fs.readdirSync(SCHEMA_DIR)) {
    if (f.endsWith(".ts")) src += fs.readFileSync(path.join(SCHEMA_DIR, f), "utf8") + "\n";
  }
  const tables = new Map();
  const decl = /export const \w+\s*=\s*sqliteTable\(\s*["']([a-z_0-9]+)["']\s*,\s*\{/g;
  let m;
  while ((m = decl.exec(src)) !== null) {
    const rest = src.slice(m.index + m[0].length);
    const end = rest.search(/\nexport const /);
    const body = end === -1 ? rest : rest.slice(0, end);
    const cols = new Set();
    // `integer("column_name")`, `text("column_name")`, ...
    for (const c of body.matchAll(/\b(?:integer|text|real|blob|numeric)\(\s*["']([a-z_0-9]+)["']/g)) {
      cols.add(c[1]);
    }
    tables.set(m[1], cols);
  }
  return tables;
}

// ── What the database has ───────────────────────────────────────────────────
function readDb(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  const tables = new Map();
  for (const r of db.prepare(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
  ).all()) {
    tables.set(r.name, {
      cols: new Set(db.prepare(`PRAGMA table_info(\`${r.name}\`)`).all().map((c) => c.name)),
      sql: r.sql || "",
    });
  }
  const count = (t) => {
    try { return db.prepare(`SELECT COUNT(*) n FROM \`${t}\``).get().n; } catch { return -1; }
  };
  const counts = {
    players: count("players"),
    staff: count("staff"),
    users: count("users"),
    careers: count("career_saves"),
    teams: count("teams"),
  };
  db.close();
  return { tables, counts };
}

/** Is this column named in a FOREIGN KEY clause? SQLite cannot drop it if so. */
function isForeignKeyBound(createSql, column) {
  const re = new RegExp("FOREIGN\\s+KEY\\s*\\(\\s*[`\"']?" + column + "[`\"']?\\s*\\)", "i");
  return re.test(createSql);
}

if (!fs.existsSync(DB)) {
  console.error(`[check-starter-db] FAILED: no database at ${DB}`);
  process.exit(1);
}

const model = readModel();
const { tables: dbTables, counts } = readDb(DB);
const problems = [];

for (const [table, cols] of model) {
  const got = dbTables.get(table);
  if (!got) {
    problems.push(`table \`${table}\` is in the model but NOT in the shipped database`);
    continue;
  }
  for (const c of cols) {
    if (!got.cols.has(c)) {
      problems.push(`\`${table}\`.\`${c}\` is in the model but NOT in the shipped database`);
    }
  }
}

for (const [table, got] of dbTables) {
  const cols = model.get(table);
  if (!cols) {
    problems.push(`table \`${table}\` is in the shipped database but NOT in the model`);
    continue;
  }
  for (const c of got.cols) {
    if (cols.has(c)) continue;
    if (isForeignKeyBound(got.sql, c)) continue;   // SQLite refuses to drop it
    problems.push(
      `\`${table}\`.\`${c}\` is in the shipped database but NOT in the model — ` +
      `the artifact is STALE. Regenerate it (see docs/packaging.md).`,
    );
  }
}

// A starter database must be pristine. Committing a played save is the other way
// this artifact goes wrong, and it is easy to do while testing against copies.
if (counts.users > 0)   problems.push(`starter database has ${counts.users} user(s) — it must be pristine`);
if (counts.careers > 0) problems.push(`starter database has ${counts.careers} career save(s) — it must be pristine`);
if (counts.teams > 0)   problems.push(`starter database has ${counts.teams} team(s) — it must be pristine`);
if (counts.players <= 0) problems.push(`starter database has no players`);
if (counts.staff <= 0)   problems.push(`starter database has no staff`);

if (problems.length === 0) {
  console.log(
    `[check-starter-db] OK - shipped database matches the model ` +
    `(${model.size} tables, ${counts.players} players, ${counts.staff} staff)`,
  );
  process.exit(0);
}

const bar = "!".repeat(72);
console.error("");
console.error(bar);
console.error(`  STARTER DATABASE DRIFT: ${problems.length}`);
console.error(bar);
console.error(`  ${DB}`);
for (const p of problems) console.error(`   - ${p}`);
console.error(bar);
process.exit(1);
