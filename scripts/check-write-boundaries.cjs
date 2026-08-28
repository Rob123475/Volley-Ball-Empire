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
  },
  {
    re: /(?:db|tx)\.(update|insert)\(\s*careerPlayerStateTable\s*\)/g,
    msg: "raw write to careerPlayerStateTable - use updatePlayerState() or updateTeamPlayerState()",
  },
  {
    re: /(?:db|tx)\.(update|insert)\(\s*careerStaffStateTable\s*\)/g,
    msg: "raw write to careerStaffStateTable - use updateStaffState()",
  },
  {
    re: /const\s+\w+\s*:\s*any\s*=\s*\{\s*\}/g,
    msg: "untyped update object (`: any`) - type it, or it can carry fields to the wrong table",
  },
  {
    re: /:\s*Record<string,\s*(?:unknown|any)>\s*=\s*\{/g,
    msg: "untyped update object (Record<string, unknown>) - type it",
  },
  {
    re: /as\s+Partial<Career(?:Player|Staff)Fields>/g,
    msg: "`as` cast onto a career-state patch - the cast defeats the check; build the object typed",
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

for (const file of walk(SRC)) {
  if (ALLOWED.has(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  const text = stripComments(raw);
  const lines = raw.split(NL);

  for (const rule of RULES) {
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
