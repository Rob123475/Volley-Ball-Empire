#!/usr/bin/env node
/**
 * Structural guard: the player and staff tables may only be written through the
 * typed helpers in lib/playerDto.ts.
 *
 * Three separate holes have let untyped data reach a database write in this
 * codebase - `any`, `Record<string, unknown>`, and `as` casts - and the third
 * was introduced while closing the first two. Vigilance is not the fix. If the
 * raw write is unreachable outside one file, none of those tricks has anything
 * left to exploit.
 *
 * ESLint is not installed in this repo, and adding it plus typescript-eslint is
 * a meaningful dependency addition against the minimumReleaseAge supply-chain
 * guard in pnpm-workspace.yaml. This achieves the same "fails the build"
 * outcome with no new dependencies.
 *
 * Run: node scripts/check-write-boundaries.cjs
 */
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const SRC = path.join(REPO, "artifacts", "api-server", "src");
// scripts/src is scanned too: make-starter-db.ts was writing raw SQL to columns
// that no longer exist, and nothing was looking there.
const SCRIPT_SRC = path.join(REPO, "scripts", "src");

// Files permitted to write these tables directly.
const ALLOWED = new Set([
  path.join(SRC, "lib", "playerDto.ts"),          // the sanctioned write path
  path.join(SRC, "utils", "migrateCareerState.ts"), // performs the migration itself
  // Bulk one-shot boot migration over a genuine REFERENCE field (continent is
  // derived from nationality and is the same in every career). Allowed for the
  // same reason as the migration above: it is a single-pass transaction over
  // every row, not an endpoint write.
  path.join(SRC, "utils", "normaliseContinents.ts"),
  path.join(SRC, "seed.ts"),
  path.join(SRC, "seed-world-data.ts"),
  path.join(SRC, "routes", "dev.ts"),             // dev-only, gated off in production
]);

const RULES = [
  {
    // `tx.` as well as `db.` — a write inside a transaction is still a write,
    // and matching only `db.` left exactly that gap.
    re: /(?:db|tx)\.(update|insert|delete)\(\s*playersTable\s*\)/g,
    msg: "raw write to playersTable - use updatePlayerReference() or createCareerPlayer()",
    scope: "api",
  },
  {
    re: /(?:db|tx)\.(update|insert)\(\s*careerPlayerStateTable\s*\)/g,
    msg: "raw write to careerPlayerStateTable - use updatePlayerState() or updateTeamPlayerState()",
    scope: "api",
  },
  {
    re: /(?:db|tx)\.(update|insert)\(\s*careerStaffStateTable\s*\)/g,
    msg: "raw write to careerStaffStateTable - use updateStaffState()",
    scope: "api",
  },
  {
    re: /const\s+\w+\s*:\s*any\s*=\s*\{\s*\}/g,
    msg: "untyped update object (`: any`) - type it, or it can carry fields to the wrong table",
    scope: "api",
  },
  {
    re: /:\s*Record<string,\s*(?:unknown|any)>\s*=\s*\{/g,
    msg: "untyped update object (Record<string, unknown>) - type it",
    scope: "api",
  },
  {
    re: /as\s+Partial<Career(?:Player|Staff)Fields>/g,
    msg: "`as` cast onto a career-state patch - the cast defeats the check; build the object typed",
    scope: "api",
  },
  {
    // Raw SQL naming a column that has moved off `players`.
    //
    // TypeScript cannot see inside a SQL string, so this is the one place the
    // compile-error net has no reach.
    //
    // players.outfit_id is the sharp case: SQLite refuses to drop it because a
    // foreign key depends on it, so it PHYSICALLY REMAINS in every database
    // holding whatever it held before the split, while the drizzle schema no
    // longer declares it and nothing writes it. A raw query naming it returns a
    // plausible answer that is silently wrong — exactly what someone writes six
    // months from now without knowing the column is a ghost.
    //
    // staff.team_id is NOT in this list and is not a ghost: `staff` has not been
    // split yet, so that column is still live, declared, and read from. It will
    // refuse to drop for the same foreign-key reason when the staff chunk lands,
    // and belongs here on that day, not before.
    re: new RegExp(
      "(?:UPDATE|SELECT|INSERT|DELETE|FROM|SET|WHERE)[^;`'\"]{0,400}?" +
      "\\b(?:p\\.|players\\.)?(?:squad_role|is_active|contract_end_date|" +
      "academy_contract_years|outfit_id|injury_weeks_remaining|" +
      "consecutive_matches_played|doctor_quality|training_points|" +
      "training_focus|focus_xp|scouted_potential|discovered_by|" +
      // chunk 6. is_draft_player is NOT here: it stays on `players` as the
      // reference seed for who starts in the draft pool.
      "is_retired|retired_season_year|career_wins)\\b",
      "gi",
    ),
    msg: "raw SQL naming a column that has moved to career_player_state - " +
         "TypeScript cannot check inside a SQL string, and two of these columns " +
         "still physically exist holding stale data. Read through loadPlayers().",
  },
  {
    // players.team_id specifically.
    //
    // team_id is deliberately absent from the list above because staff.team_id
    // is still live and declared — banning the bare name would flag every
    // legitimate staff query. But players.team_id IS gone, and leaving it out
    // entirely left a hole: make-starter-db.ts had
    // `SELECT ... FROM players WHERE team_id IS NOT NULL` in a sanity check that
    // the broader rule could not see, and it threw the moment the column went.
    // So match it only when `players` is named in the same statement.
    re: new RegExp(
      "(?:FROM|UPDATE|INTO|JOIN)\\s+`?players`?\\b[^;]{0,300}?\\bteam_id\\b" +
      "|\\bteam_id\\b[^;]{0,300}?(?:FROM|UPDATE|INTO|JOIN)\\s+`?players`?\\b",
      "gi",
    ),
    msg: "raw SQL reading players.team_id - squad membership moved to " +
         "career_player_state; the reference column no longer exists",
  },
  {
    // Raw SQL naming a column that has moved off `staff`.
    //
    // Seven seeders had `INSERT INTO staff (... salary, team_id, is_available,
    // age, contract_length, is_scout_revealed ...)` and TypeScript could not see
    // any of it. `age` and `salary` are renamed rather than dropped, so those
    // are matched only next to `staff` to avoid flagging the many other tables
    // that legitimately still have them.
    re: new RegExp(
      "(?:INTO|FROM|UPDATE|JOIN)\\s+`?staff`?\\b[^;]{0,600}?" +
      "\\b(?:is_available|contract_length|is_scout_revealed|team_id|\\bage\\b|\\bsalary\\b)" +
      "|\\b(?:is_available|contract_length|is_scout_revealed)\\b[^;]{0,300}?" +
      "(?:INTO|FROM|UPDATE|JOIN)\\s+`?staff`?\\b",
      "gi",
    ),
    msg: "raw SQL naming a column that has moved off `staff` - salary is now " +
         "base_salary and age is base_age (both REFERENCE); team_id, " +
         "is_available, contract_length and is_scout_revealed are career state",
  },
];

const NL = String.fromCharCode(10);

function walk(dir, out) {
  out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/** Blank out comment lines, preserving line offsets, so the guard never flags
 *  prose that merely describes a banned pattern. */
function stripComments(source) {
  return source
    .split(NL)
    .map((ln) => {
      const t = ln.trim();
      const isComment =
        t.indexOf("//") === 0 || t.indexOf("*") === 0 || t.indexOf("/*") === 0;
      return isComment ? "" : ln;
    })
    .join(NL);
}

const violations = [];

// scope "api" rules apply only to the server. The one-off content scripts in
// scripts/src are seeders: building reference rows directly is their whole job,
// and routing them through the DTO would be wrong. The raw-SQL rule has no
// scope and applies everywhere, because a moved column named in a SQL string is
// silently wrong no matter who writes it.
const scanned = [
  ...walk(SRC).map((f) => ({ file: f, scope: "api" })),
  ...(fs.existsSync(SCRIPT_SRC) ? walk(SCRIPT_SRC).map((f) => ({ file: f, scope: "scripts" })) : []),
];

for (const { file, scope } of scanned) {
  if (ALLOWED.has(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  const text = stripComments(raw);
  const lines = raw.split(NL);

  for (const rule of RULES) {
    if (rule.scope && rule.scope !== scope) continue;
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split(NL).length;
      violations.push({
        file: path.relative(REPO, file).split(path.sep).join("/"),
        line,
        msg: rule.msg,
        snippet: (lines[line - 1] || "").trim().slice(0, 90),
      });
    }
  }
}

// ── Cascade drift: every career-scoped table must be handled on delete ──────
//
// deleteProfileCascade enumerates tables by hand. That list went stale exactly
// the way the snapshot's column list did: `seasons` and `competitor_rankings`
// both gained career_save_id during this work and neither was cleaned, so
// deleting a profile returned 200 and left orphans behind. seasons has no
// foreign key on that column (deliberately, so pre-migration rows survive), so
// nothing failed loudly to reveal it.
//
// Rather than trust the next person to remember, derive the requirement from
// the schema: any table declaring careerSaveId must be named in deleteProfile.
{
  const schemaDir = path.join(REPO, "lib", "db", "src", "schema");
  const deleteProfile = path.join(SRC, "utils", "deleteProfile.ts");

  if (fs.existsSync(schemaDir) && fs.existsSync(deleteProfile)) {
    const cascadeSrc = fs.readFileSync(deleteProfile, "utf8");
    let schema = "";
    for (const f of fs.readdirSync(schemaDir)) {
      if (f.endsWith(".ts")) schema += fs.readFileSync(path.join(schemaDir, f), "utf8") + NL;
    }

    // export const fooTable = sqliteTable("foo", { ... careerSaveId ... })
    const decl = /export const (\w+)\s*=\s*sqliteTable\(\s*"([a-z_]+)"\s*,\s*\{/g;
    let d;
    while ((d = decl.exec(schema)) !== null) {
      const [, exportName, tableName] = d;
      // Body runs to the next top-level `export const`, which is close enough
      // to bound one table declaration.
      const rest = schema.slice(d.index + d[0].length);
      const end = rest.search(/\nexport const /);
      const body = end === -1 ? rest : rest.slice(0, end);
      if (!/\bcareerSaveId\b/.test(body)) continue;
      if (cascadeSrc.includes(exportName)) continue;
      violations.push({
        file: "artifacts/api-server/src/utils/deleteProfile.ts",
        line: 1,
        msg: `${tableName} is career-scoped (declares careerSaveId) but deleteProfileCascade never deletes from it - deleting a profile would leave orphans`,
        snippet: `missing: ${exportName}`,
      });
    }
  }
}

if (violations.length === 0) {
  console.log(
    "[check-write-boundaries] OK - no raw writes or untyped update objects outside lib/playerDto.ts",
  );
  process.exit(0);
}

const bar = "!".repeat(72);
console.error("");
console.error(bar);
console.error("  WRITE BOUNDARY VIOLATIONS: " + violations.length);
console.error(bar);
for (const v of violations) {
  console.error("  " + v.file + ":" + v.line);
  console.error("     " + v.msg);
  console.error("     > " + v.snippet);
}
console.error(bar);
console.error("  These are the paths that let untyped data reach a database write.");
console.error(bar);
process.exit(1);
