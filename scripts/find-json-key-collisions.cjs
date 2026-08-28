#!/usr/bin/env node
/**
 * Find JSON/attributes-blob keys that collide with column names.
 *
 * This is a hazard class nothing else can see. A key inside a free-form JSON
 * payload — `attributes`, `development`, `player_v4` — looks identical to a
 * column assignment at the character level:
 *
 *     age: p.age,        // inside db.insert(...).values({ ... })  -> a COLUMN
 *     age: p.age,        // inside const attributes = { ... }      -> a JSON KEY
 *
 * TypeScript cannot tell them apart, the write-boundary guard cannot, and the
 * starter-DB drift check cannot. During the staff split four seeders were caught
 * only because the FILE COUNT came out at 13 against an expected 7. Had one of
 * those blobs sat inside a file that genuinely needed the rename, the count
 * would have matched and the transform would have silently rewritten stored
 * JSON with nothing to catch it.
 *
 * So the exclusions are produced by construction, before the transform runs,
 * rather than by reviewing what it did afterwards.
 *
 * Usage: node scripts/find-json-key-collisions.cjs <key> [<key> ...]
 * Prints file:line for every occurrence, classified BLOB or COLUMN.
 */
const fs = require("fs");
const path = require("path");

const REPO = path.join(__dirname, "..");
const ROOTS = [
  path.join(REPO, "artifacts", "api-server", "src"),
  path.join(REPO, "scripts", "src"),
];

const KEYS = process.argv.slice(2);
if (KEYS.length === 0) {
  console.error("Usage: node scripts/find-json-key-collisions.cjs <key> [<key> ...]");
  process.exit(1);
}

const NL = String.fromCharCode(10);

function walk(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

/**
 * Walk backwards from a line to the statement that opened its object literal,
 * and decide whether that object is destined for a DB column list or for a JSON
 * blob. Brace-depth aware so a nested object inside `.values({...})` is still
 * attributed to the insert.
 */
const BLOB_OPENERS = [
  /const\s+attributes\s*=\s*\{/,
  /const\s+\w*[Aa]ttributes\w*\s*=\s*\{/,
  /const\s+dev\w*\s*=\s*\{/,
  /const\s+\w*[Dd]evelopment\w*\s*=\s*\{/,
  /\battributes\s*:\s*\{/,
  /\bdevelopment\s*:\s*\{/,
  /\bplayerV4\s*:\s*\{/,
  /return\s*\{/,               // builder functions returning a JSON payload
  /const\s+\w+\s*=\s*\{\s*$/,  // a bare object literal, not a query
];

// API response shaping. Not a DB write and not a stored blob — renaming one of
// these changes the API contract the frontend reads, which is a separate
// decision from a column rename and must never be swept up in one.
const RESPONSE_OPENERS = [
  // `[^)]*` could not cross the parens in `(p) => ({`, so every arrow taking a
  // parenthesised parameter fell through to UNKNOWN. Match lazily instead.
  /\.map\(.*?=>\s*\(?\{/,
  /\.filter\(.*?=>\s*\(?\{/,
  /=\s*\(.*?\)\s*=>\s*\(\{/,   // const serializeX = (p: T) => ({
  /\w+\.push\(\{/,
  /res\.json\(\{/,
];

const COLUMN_OPENERS = [
  /\.values\(\s*\{/,
  /\.set\(\s*\{/,
  /\.select\(\s*\{/,
  /INSERT\s+INTO/i,
];

function classify(lines, idx) {
  let depth = 0;
  for (let i = idx; i >= 0; i--) {
    const line = lines[i];
    for (let c = line.length - 1; c >= 0; c--) {
      if (line[c] === "}") depth++;
      else if (line[c] === "{") {
        if (depth === 0) {
          const head = line.slice(0, c + 1);
          if (COLUMN_OPENERS.some((r) => r.test(head))) return "COLUMN";
          if (RESPONSE_OPENERS.some((r) => r.test(head))) return "RESPONSE";
          if (BLOB_OPENERS.some((r) => r.test(head))) return "BLOB";
          return "UNKNOWN";
        }
        depth--;
      }
    }
  }
  return "UNKNOWN";
}

let blob = 0, column = 0, unknown = 0, data = 0, response = 0;
const rows = [];

for (const key of KEYS) {
  const re = new RegExp("^\\s*" + key + "\\s*:\\s*[^,]+,\\s*$");
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const lines = fs.readFileSync(file, "utf8").split(NL);
      lines.forEach((line, i) => {
        if (!re.test(line)) return;
        // A literal value (`age: 38,`) is never a rename target: every transform
        // in this project matches `key: <expression>` precisely so the data
        // arrays are out of reach. Classify separately to keep the report about
        // the cases that actually matter.
        const value = line.slice(line.indexOf(":") + 1).replace(/,\s*$/, "").trim();
        const isLiteral = /^(?:-?\d+(?:\.\d+)?|"[^"]*"|'[^']*'|true|false|null)$/.test(value);
        const kind = isLiteral ? "DATA" : classify(lines, i);
        if (kind === "BLOB") blob++;
        else if (kind === "COLUMN") column++;
        else if (kind === "DATA") { data++; return; }   // out of reach, not listed
        else if (kind === "RESPONSE") response++;
        else unknown++;
        rows.push({
          key,
          kind,
          file: path.relative(REPO, file).split(path.sep).join("/"),
          line: i + 1,
          text: line.trim(),
        });
      });
    }
  }
}

rows.sort((a, b) => (a.kind === b.kind ? a.file.localeCompare(b.file) : a.kind.localeCompare(b.kind)));

const bar = "=".repeat(78);
console.log(bar);
console.log(`  JSON-KEY COLLISION SCAN for: ${KEYS.join(", ")}`);
console.log(bar);
for (const r of rows) {
  console.log(`  ${r.kind.padEnd(8)} ${r.file}:${r.line}`);
  console.log(`           ${r.text}`);
}
console.log(bar);
console.log(`  COLUMN (rename these): ${column}`);
console.log(`  BLOB   (MUST NOT touch): ${blob}`);
console.log(`  RESPONSE (API shape, do not rename): ${response}`);
console.log(`  UNKNOWN (inspect by hand): ${unknown}`);
console.log(`  DATA   (literal values, unreachable by transform): ${data}`);
console.log(bar);

// Emit the blob+unknown lines as an exclusion list a transform can consume, so
// the exclusions are produced before the edit rather than reviewed after it.
const excl = rows.filter((r) => r.kind !== "COLUMN").map((r) => `${r.file}:${r.line}`);
fs.writeFileSync(
  path.join(REPO, "scripts", ".json-key-exclusions.txt"),
  excl.join(NL) + NL,
);
console.log(`  exclusion list -> scripts/.json-key-exclusions.txt (${excl.length} lines)`);
