/**
 * Daytime brief 2 Oct, N-46 (Rob): Valentino Greco's card showed "JAMES
 * WHITMORE" printed in the picture, Ana Vieira's "SOFIA PETROVA" and a flag.
 * The staff and medical portraits were cut from finished card images, with the
 * name, flag, card text and frame baked in. Every one is now the person alone:
 * head and shoulders above the old name band, the scenery behind blurred,
 * 500 x 500 (scripts/portraits/crop-staff-portraits.py, run once on the source
 * cards; the before/after sheets are docs/proof-02oct-pm/n46-*).
 *
 * Asserted: every staff portrait file is one of the new 500 x 500 pictures;
 * every picture the server can give a staff member (the two generators and the
 * staff data files) is such a file; and every staff row's picture in the
 * starter DB and in a copy of Rob's 2 Oct save is one too (so existing saves
 * show the new pictures with nothing to migrate: the files kept their names).
 *
 * Usage: node harness/staff-portraits.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REPO = path.join(import.meta.dirname, "..");
const PUBLIC = path.join(REPO, "artifacts", "beach-volleyball", "public");
const STAFF_DIR = path.join(PUBLIC, "images", "staff");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-02oct-0845.sqlite");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  DAYTIME 2 OCT, N-46: STAFF PORTRAITS ARE THE PERSON ALONE");
console.log("=".repeat(72));

/** Width and height of a WebP, from its header (VP8, VP8L or VP8X). */
function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === "VP8L") { const n = b.readUInt32LE(21); return { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }; }
  return null;
}
const isPortrait = (rel) => {
  const f = path.join(PUBLIC, rel.replace(/^\//, ""));
  if (!fs.existsSync(f)) return "missing";
  const s = webpSize(f);
  return s && s.w === 500 && s.h === 500 ? true : `${s?.w} x ${s?.h}`;
};
const bad = (list) => list.map((r) => [r, isPortrait(r)]).filter(([, v]) => v !== true);

console.log("\n1. THE FILES");
const files = [];
for (const e of fs.readdirSync(STAFF_DIR, { withFileTypes: true, recursive: true })) {
  if (e.isFile() && e.name.endsWith(".webp")) files.push(path.relative(PUBLIC, path.join(e.parentPath ?? e.path, e.name)).replace(/\\/g, "/"));
}
const wrongFiles = bad(files);
check("every staff portrait file is a 500 x 500 picture of the person", files.length >= 199 && wrongFiles.length === 0,
  `${files.length} files${wrongFiles.length ? "; not: " + wrongFiles.slice(0, 5).map(([r, v]) => `${r} (${v})`).join(", ") : ""}`);

console.log("\n2. WHAT THE SERVER HANDS OUT");
const SRC = path.join(REPO, "artifacts", "api-server", "src");
const sources = ["utils/staff-generator.ts", "utils/medical-staff-generator.ts",
  ...fs.readdirSync(path.join(SRC, "data")).filter((f) => /^staff_.*\.json$/.test(f)).map((f) => "data/" + f)];
const named = new Set();
for (const s of sources) for (const m of fs.readFileSync(path.join(SRC, s), "utf8").matchAll(/images\/staff\/[\w/-]+\.webp/g)) named.add(m[0]);
const wrongNamed = bad([...named]);
check("every picture the generators and staff data name is one of them", named.size > 0 && wrongNamed.length === 0,
  `${named.size} pictures named in ${sources.length} files${wrongNamed.length ? "; not: " + wrongNamed.slice(0, 5).map(([r, v]) => `${r} (${v})`).join(", ") : ""}`);

console.log("\n3. SAVES");
const rowsOf = (dbFile) => {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  try { return d.prepare(`SELECT name, image_url AS url FROM staff WHERE image_url IS NOT NULL AND image_url <> ''`).all(); } finally { d.close(); }
};
const starter = rowsOf(path.join(REPO, "lib", "db", "volleyball-empire.sqlite"));
const wrongStarter = bad(starter.map((r) => r.url));
check("every staff row of the starter DB shows one of them", starter.length > 0 && wrongStarter.length === 0,
  `${starter.length} rows${wrongStarter.length ? "; not: " + wrongStarter.slice(0, 5).join(", ") : ""}`);
if (fs.existsSync(ROB)) {
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vbe-staff-portraits-")), "rob.sqlite");
  fs.copyFileSync(ROB, copy);
  const rob = rowsOf(copy);
  const wrongRob = bad(rob.map((r) => r.url));
  const vg = rob.find((r) => r.name === "Valentino Greco"), av = rob.find((r) => r.name === "Ana Vieira");
  check("every staff row of Rob's 2 Oct save (a copy) shows one of them, with nothing to migrate", rob.length > 0 && wrongRob.length === 0,
    `${rob.length} rows${wrongRob.length ? "; not: " + wrongRob.slice(0, 5).join(", ") : ""}`);
  check("Valentino Greco's and Ana Vieira's pictures are among them", vg && av && isPortrait(vg.url) === true && isPortrait(av.url) === true,
    `${vg?.url}, ${av?.url}`);
  fs.rmSync(path.dirname(copy), { recursive: true, force: true });
} else check("Rob's 2 Oct backup is on this machine", false, ROB);

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
