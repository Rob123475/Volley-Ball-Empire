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
      "training_focus|focus_xp|scouted_potential|discovered_by)\\b",
      "gi",
    ),
    msg: "raw SQL naming a column that has moved to career_player_state - " +
         "TypeScript cannot check inside a SQL string, and two of these columns " +
         "still physically exist holding stale data. Read through loadPlayers().",
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
