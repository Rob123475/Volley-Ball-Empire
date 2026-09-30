/**
 * Overnight brief 30 Sep, item 9 — staff and medical attributes in plain words.
 *
 * Rob, 30 Sep: cards showed the stored keys ("matchPreparation",
 * "deepTissueMassage"). Every card now labels through one function
 * (artifacts/beach-volleyball/src/lib/staff-attributes.ts attributeLabel), and
 * one rule decides which stored numbers are skills (skillAttributes: an older
 * record keeps salary, stars and age beside its skills, and some cards drew
 * them as attribute bars).
 *
 * Asserted: the module, compiled as the UI compiles it, turns every attribute
 * key stored in the shipped database into words (no camelCase, no
 * underscores, each word capitalised, "to"/"and" small), with Rob's examples
 * exact; no bookkeeping number counts as a skill; and the Staff Market,
 * Medical Market, Staff and Medical pages and the staff edit form all label
 * through it, with no card printing a raw key.
 *
 * Usage: node harness/staff-labels.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const REPO = path.join(import.meta.dirname, "..");
const require = createRequire(path.join(REPO, "artifacts", "api-server", "package.json"));
const esbuild = require("esbuild");
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 9: STAFF ATTRIBUTES IN PLAIN WORDS");
console.log("=".repeat(72));

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vbe-labels-")), "staff-attributes.mjs");
esbuild.buildSync({ entryPoints: [path.join(REPO, "artifacts/beach-volleyball/src/lib/staff-attributes.ts")], outfile: out, format: "esm", bundle: true, logLevel: "silent" });
const { attributeLabel, skillAttributes } = await import(pathToFileURL(out).href);

const db = new DatabaseSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), { readOnly: true });
const keys = new Set();
const walk = (o) => { for (const [k, v] of Object.entries(o ?? {})) { if (v && typeof v === "object") walk(v); else if (typeof v === "number") keys.add(k); } };
for (const { attributes } of db.prepare("SELECT attributes FROM staff").all()) { try { walk(JSON.parse(attributes ?? "{}")); } catch { /* not JSON */ } }
db.close();
const bad = [...keys].map((k) => [k, attributeLabel(k)]).filter(([, l]) => !/^[A-Z0-9][A-Za-z0-9]*( ([A-Z0-9][A-Za-z0-9]*|to|and|of|for|in|on|the|a))*$/.test(l) || /[a-z][A-Z]/.test(l) || /_/.test(l));
check("every stored attribute key reads as words", keys.size > 40 && bad.length === 0, `${keys.size} keys; not words: ${bad.map(([k, l]) => `${k} -> ${l}`).join(", ") || "none"}`);
const eg = { matchPreparation: "Match Preparation", deepTissueMassage: "Deep Tissue Massage", returnToPlay: "Return to Play", talentIdentification: "Talent Identification", sportsNutrition: "Sports Nutrition" };
const wrong = Object.entries(eg).filter(([k, want]) => attributeLabel(k) !== want);
check("Rob's examples, exactly", wrong.length === 0, Object.keys(eg).map((k) => `${k} -> ${attributeLabel(k)}`).join("; "));
const flat = skillAttributes({ age: 41, salary: 3200, stars: 4, starRating: 4, experienceYears: 12, medicalKnowledge: 80, injuryDiagnosis: 75 });
const nested = skillAttributes({ coachingAttributes: { tactics: 70, motivation: 66 }, salary: 3000 });
check("only skills are attributes: salary, stars, age are not", JSON.stringify(flat) === JSON.stringify([["medicalKnowledge", 80], ["injuryDiagnosis", 75]]) && nested.length === 2,
  `${JSON.stringify(flat)} / ${JSON.stringify(nested)}`);

const src = (p) => fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages", p), "utf8");
const pages = ["staff-market.tsx", "medical-market.tsx", "staff.tsx", "medical.tsx"];
const raw = pages.filter((p) => { const s = src(p); return !/\{attributeLabel\(name\)\}/.test(s) || /pr-2">\{name\}</.test(s) || /extractSkillAttrs/.test(s) || !/skillAttributes\(member\.attributes\)/.test(s); });
check("every staff and medical card labels through it (no raw key on any card)", raw.length === 0, raw.join(", ") || pages.join(", "));
check("the staff edit form too", /\{attributeLabel\(key\)\}/.test(src("staff.tsx")) && !/key\.replace\(\/_\/g, " "\)/.test(src("staff.tsx")));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
