/**
 * Guard self-test: every guard must still reject a known-bad input.
 *
 * Each guard in this project was proved to fire ONCE, at the moment it was
 * written. None of them could tell you if it later stopped firing — a changed
 * pattern, an escaping slip, a refactor — and the failure mode is silence, not
 * an error. Every report after that would read green.
 *
 * That is not hypothetical. The pool raw-SQL rule shipped INERT: heredoc
 * escaping emitted `\s` where `\\s` was meant, so the pattern matched nothing
 * and the guard printed OK. It was caught only because each branch was tested
 * by hand that day. This makes that test permanent.
 *
 * Every case below feeds a guard something it MUST reject and fails if the
 * guard accepts it. A guard that stops catching its own known-bad input breaks
 * the build.
 *
 * The bad inputs are synthesised into a temp tree rather than committed into
 * the real source tree, where they would fail the very build they protect.
 *
 * Usage: node harness/guard-selftest.mjs
 */
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const REPO = path.join(import.meta.dirname, "..");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-guards-"));

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

const write = (rel, body) => {
  const p = path.join(WORK, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, body);
  return p;
};

const runGuard = (script, args) =>
  spawnSync(process.execPath, [path.join(REPO, "scripts", script), ...args],
    { encoding: "utf8" });

// ── Fixture tree for the write-boundary guard ───────────────────────────────
//
// One file per rule, so a failure names the rule that stopped working rather
// than just saying "something is wrong".

const API = "artifacts/api-server/src";

// The guard treats this path as the sanctioned write path; it must exist so the
// ALLOWED set resolves, but its contents are irrelevant.
write(`${API}/lib/playerDto.ts`, "export {};\n");

const CASES = [
  {
    id: "raw write to playersTable",
    file: `${API}/routes/bad-raw-write.ts`,
    body: `import { db, playersTable } from "@workspace/db";
export async function bad() {
  await db.update(playersTable).set({ name: "x" });
}
`,
  },
  {
    id: "raw write inside a transaction (tx.)",
    file: `${API}/routes/bad-tx-write.ts`,
    body: `import { db, careerPlayerStateTable } from "@workspace/db";
export function bad() {
  db.transaction((tx) => { tx.update(careerPlayerStateTable).set({ morale: 1 }).run(); });
}
`,
  },
  {
    id: "untyped update object (: any)",
    file: `${API}/routes/bad-any.ts`,
    body: `export function bad() {
  const updates: any = {};
  return updates;
}
`,
  },
  {
    id: "untyped update object (Record<string, unknown>)",
    file: `${API}/routes/bad-record.ts`,
    body: `export function bad() {
  const updates: Record<string, unknown> = { a: 1 };
  return updates;
}
`,
  },
  {
    id: "as-cast onto a career-state patch",
    file: `${API}/routes/bad-cast.ts`,
    body: `export function bad(x: unknown) {
  return x as Partial<CareerPlayerFields>;
}
`,
  },
  {
    // The rule that exists because adding a nullable career_save_id produced
    // ZERO compile errors — there was no type error to catch this class.
    id: "raw query against a regional_league table",
    file: `${API}/routes/bad-league-read.ts`,
    body: `import { db, regionalLeagueSeasonsTable } from "@workspace/db";
export async function bad() {
  return db.select().from(regionalLeagueSeasonsTable);
}
`,
  },
  {
    id: "raw write to a regional_league table",
    file: `${API}/routes/bad-league-write.ts`,
    body: `import { db, regionalLeagueFixturesTable } from "@workspace/db";
export async function bad() {
  await db.update(regionalLeagueFixturesTable).set({ status: "completed" });
}
`,
  },
  // ── raw SQL, BOTH orders per table ──────────────────────────────────────
  // Column-before-table missed once already, so every table is tested in both
  // directions rather than only the one that happened to be written first.
  {
    id: "raw SQL: players moved column, column BEFORE table",
    file: `${API}/routes/bad-sql-players-a.ts`,
    body: `export const q = "SELECT squad_role FROM players WHERE id = ?";\n`,
  },
  {
    id: "raw SQL: players moved column, table BEFORE column",
    file: `${API}/routes/bad-sql-players-b.ts`,
    body: `export const q = "UPDATE players SET training_points = 0";\n`,
  },
  {
    id: "raw SQL: players.team_id, column BEFORE table",
    file: `${API}/routes/bad-sql-playerteam-a.ts`,
    body: `export const q = "SELECT team_id FROM players";\n`,
  },
  {
    id: "raw SQL: players.team_id, table BEFORE column",
    file: `${API}/routes/bad-sql-playerteam-b.ts`,
    body: `export const q = "UPDATE players SET team_id = NULL";\n`,
  },
  {
    id: "raw SQL: staff moved column, column BEFORE table",
    file: `${API}/routes/bad-sql-staff-a.ts`,
    body: `export const q = "SELECT is_available FROM staff";\n`,
  },
  {
    id: "raw SQL: staff moved column, table BEFORE column",
    file: `${API}/routes/bad-sql-staff-b.ts`,
    body: `export const q = "INSERT INTO staff (name, contract_length) VALUES (?, ?)";\n`,
  },
  {
    id: "raw SQL: pool team state, column BEFORE table",
    file: `${API}/routes/bad-sql-pool-a.ts`,
    body: `export const q = "SELECT is_active_in_league FROM continental_pool_teams";\n`,
  },
  {
    id: "raw SQL: pool team state, table BEFORE column",
    file: `${API}/routes/bad-sql-pool-b.ts`,
    body: `export const q = "UPDATE continental_pool_teams SET promotion_count = 1";\n`,
  },
  {
    id: "raw SQL: pool player age, column BEFORE table",
    file: `${API}/routes/bad-sql-poolage-a.ts`,
    body: `export const q = "SELECT age FROM continental_pool_players";\n`,
  },
  {
    id: "raw SQL: pool player age, table BEFORE column",
    file: `${API}/routes/bad-sql-poolage-b.ts`,
    body: `export const q = "INSERT INTO continental_pool_players (name, age) VALUES (?, ?)";\n`,
  },
];

console.log("\n1. WRITE-BOUNDARY GUARD — one known-bad input per rule");

// Each case is written alone, checked, then removed, so one rule masking
// another is impossible and every failure names its own rule.
for (const c of CASES) {
  const p = write(c.file, c.body);
  const r = runGuard("check-write-boundaries.cjs", ["--root", WORK]);
  const out = (r.stdout || "") + (r.stderr || "");
  const rejected = r.status !== 0 && out.includes(path.basename(c.file));
  check(c.id, rejected, rejected ? "" : `guard exited ${r.status}`);
  fs.rmSync(p);
}

// And the negative control: with nothing bad present, the guard must PASS.
// A guard that rejects everything is as useless as one that rejects nothing.
{
  const r = runGuard("check-write-boundaries.cjs", ["--root", WORK]);
  check("clean tree is accepted (no false positive)", r.status === 0,
    r.status === 0 ? "" : (r.stdout || "") + (r.stderr || ""));
}

// ── Cascade drift check ─────────────────────────────────────────────────────
console.log("\n2. CASCADE DRIFT CHECK — careerSaveId table missing from deleteProfile");
{
  write("lib/db/src/schema/game.ts", `
export const someScopedTable = sqliteTable("some_scoped", {
  id: integer("id").primaryKey(),
  careerSaveId: integer("career_save_id").references(() => careerSavesTable.id),
});
`);
  write(`${API}/utils/deleteProfile.ts`, "export function deleteProfileCascade() {}\n");
  const r = runGuard("check-write-boundaries.cjs", ["--root", WORK]);
  const out = (r.stdout || "") + (r.stderr || "");
  check("unhandled career-scoped table is rejected",
    r.status !== 0 && out.includes("some_scoped"),
    r.status !== 0 ? "" : "guard accepted it");

  // Negative control: naming the table in deleteProfile clears it.
  write(`${API}/utils/deleteProfile.ts`,
    "import { someScopedTable } from '@workspace/db';\nexport function deleteProfileCascade() { someScopedTable; }\n");
  const r2 = runGuard("check-write-boundaries.cjs", ["--root", WORK]);
  check("handled career-scoped table is accepted", r2.status === 0,
    r2.status === 0 ? "" : (r2.stdout || "") + (r2.stderr || ""));
}

// ── Starter-DB drift check ──────────────────────────────────────────────────
console.log("\n3. STARTER-DB DRIFT CHECK");
{
  const shipped = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");

  // (a) a stale artifact: a column the model no longer declares.
  const stale = path.join(WORK, "stale.sqlite");
  fs.copyFileSync(shipped, stale);
  {
    const db = new DatabaseSync(stale);
    db.exec("ALTER TABLE players ADD COLUMN squad_role text DEFAULT 'reserve'");
    db.close();
  }
  const rStale = runGuard("check-starter-db.cjs", [stale]);
  check("stale column is rejected", rStale.status !== 0,
    rStale.status !== 0 ? "" : "guard accepted a stale artifact");

  // (b) a played save committed by accident.
  const played = path.join(WORK, "played.sqlite");
  fs.copyFileSync(shipped, played);
  {
    const db = new DatabaseSync(played);
    db.exec(
      "INSERT INTO users (id, email, created_at, updated_at) " +
      "VALUES ('selftest', 'selftest@example.invalid', 0, 0)");
    db.close();
  }
  const rPlayed = runGuard("check-starter-db.cjs", [played]);
  check("non-pristine database is rejected", rPlayed.status !== 0,
    rPlayed.status !== 0 ? "" : "guard accepted a save with users");

  // (c) negative control: the real shipped artifact must pass.
  const rGood = runGuard("check-starter-db.cjs", [shipped]);
  check("the real starter DB is accepted", rGood.status === 0,
    rGood.status === 0 ? "" : (rGood.stdout || "") + (rGood.stderr || ""));
}

// ── JSON collision scan ─────────────────────────────────────────────────────
console.log("\n4. JSON COLLISION SCAN — colliding attributes key");
{
  const scanRoot = path.join(WORK, "scan");
  fs.mkdirSync(path.join(scanRoot, "scripts", "src"), { recursive: true });
  fs.mkdirSync(path.join(scanRoot, "artifacts", "api-server", "src"), { recursive: true });
  fs.writeFileSync(path.join(scanRoot, "scripts", "src", "bad-seeder.ts"), `
export function seed(p: { age: number }) {
  const attributes = {
    schema: "test",
    age: p.age,
  };
  return attributes;
}
`);
  const r = runGuard("find-json-key-collisions.cjs", ["age", "--root", scanRoot]);
  const out = (r.stdout || "") + (r.stderr || "");
  check("attributes-blob key is classified BLOB, not COLUMN",
    /BLOB\s+scripts\/src\/bad-seeder\.ts/.test(out),
    /BLOB/.test(out) ? "" : out.split("\n").slice(-8).join(" | "));
  check("it is NOT classified as a column",
    !/COLUMN\s+scripts\/src\/bad-seeder\.ts/.test(out));

  // Negative control: the same key inside a .values({}) IS a column.
  fs.writeFileSync(path.join(scanRoot, "scripts", "src", "good-seeder.ts"), `
export async function seed(db: any, t: any, p: { age: number }) {
  await db.insert(t).values({
    name: "x",
    age: p.age,
  });
}
`);
  const r2 = runGuard("find-json-key-collisions.cjs", ["age", "--root", scanRoot]);
  const out2 = (r2.stdout || "") + (r2.stderr || "");
  check("a real column write is classified COLUMN",
    /COLUMN\s+scripts\/src\/good-seeder\.ts/.test(out2),
    /COLUMN/.test(out2) ? "" : out2.split("\n").slice(-8).join(" | "));
}


// ── Continent canonicalisation guard ────────────────────────────────────────
console.log("\n5. CONTINENT GUARD — a non-canonical continent value");
{
  const shipped = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");

  // (a) a club carrying a display label instead of a key. This is the exact
  //     shape of the bug: the picker grouped by label, the label did not match,
  //     and three clubs silently disappeared from character creation.
  const drifted = path.join(WORK, "drifted.sqlite");
  fs.copyFileSync(shipped, drifted);
  {
    const db = new DatabaseSync(drifted);
    db.exec(`UPDATE club_templates SET continent = 'Oceania' WHERE continent = 'oceania'`);
    db.close();
  }
  const rDrift = runGuard("check-continents.cjs", [drifted]);
  check("a display label in club_templates is rejected", rDrift.status !== 0,
    rDrift.status !== 0 ? "" : "guard accepted a non-canonical continent");

  // (b) an outright unknown value in a different table, to prove the guard is
  //     discovering columns rather than only ever checking club_templates.
  const alien = path.join(WORK, "alien.sqlite");
  fs.copyFileSync(shipped, alien);
  {
    const db = new DatabaseSync(alien);
    db.exec(`UPDATE players SET continent = 'Antarctica' WHERE id = (SELECT MIN(id) FROM players)`);
    db.close();
  }
  const rAlien = runGuard("check-continents.cjs", [alien]);
  check("an unknown continent in players is rejected", rAlien.status !== 0,
    rAlien.status !== 0 ? "" : "guard only checks club_templates");

  // (c) negative control: the real shipped artifact must pass.
  const rGood = runGuard("check-continents.cjs", [shipped]);
  check("the real starter DB is accepted", rGood.status === 0,
    rGood.status === 0 ? "" : (rGood.stdout || "") + (rGood.stderr || ""));
}


// ── World roster guard ──────────────────────────────────────────────────────
console.log("\n6. ROSTER GUARD — an off-roster player, and a half-landed expansion");
{
  const shipped = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");

  // (a) a youth from a nation outside her region's roster. This is the exact
  //     season-two trap: promotion turns her into a senior of that nation,
  //     widening the world months after the save was made.
  const strayYouth = path.join(WORK, "stray-youth.sqlite");
  fs.copyFileSync(shipped, strayYouth);
  {
    const db = new DatabaseSync(strayYouth);
    db.exec(`UPDATE players SET nationality = 'Croatia'
              WHERE player_type = 'youth' AND continent = 'europe'
              AND id = (SELECT MIN(id) FROM players WHERE player_type='youth' AND continent='europe')`);
    db.close();
  }
  const rYouth = runGuard("check-roster.cjs", [strayYouth]);
  check("a youth from an undeclared nation is rejected", rYouth.status !== 0,
    rYouth.status !== 0 ? "" : "guard accepted an off-roster youth");

  // (b) a nation left one player short - a partially applied expansion.
  const short = path.join(WORK, "short-nation.sqlite");
  fs.copyFileSync(shipped, short);
  {
    const db = new DatabaseSync(short);
    db.exec(`DELETE FROM players WHERE player_type='senior' AND nationality='Fiji'
              AND id = (SELECT MAX(id) FROM players WHERE player_type='senior' AND nationality='Fiji')`);
    db.close();
  }
  const rShort = runGuard("check-roster.cjs", [short]);
  check("a nation one player short is rejected", rShort.status !== 0,
    rShort.status !== 0 ? "" : "guard accepted an incomplete nation");

  // (c) negative control: the real shipped artifact must pass.
  const rGood = runGuard("check-roster.cjs", [shipped]);
  check("the real starter DB is accepted", rGood.status === 0,
    rGood.status === 0 ? "" : (rGood.stdout || "") + (rGood.stderr || ""));
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nFixtures kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
