/**
 * Overnight brief 30 Sep, item 10 — market cards follow the role buttons.
 *
 * Rob, 30 Sep: the Medical Market's cards were in no order; they should run
 * Team Doctor, Medical Specialist, Physiotherapist, Nutritionist, Sports
 * Scientist, Massage Therapist, as its role buttons do; the Staff Market the
 * same by its buttons.
 *
 * Asserted: both pages' role buttons are in that order (Medical exactly Rob's
 * list); both render their cards through inButtonOrder (role button order,
 * then name); every role stored in the shipped database or written by the
 * market generators maps (by the shared normaliseRole, compiled as the UI
 * compiles it) to one of its page's buttons, so no card sorts to the end for
 * an unrecognised spelling; and the order function, run on a shuffled market,
 * gives Rob's order.
 *
 * Usage: node harness/market-order.mjs
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
console.log("  OVERNIGHT 30 SEP, 10: MARKET CARDS IN THE ORDER OF THE ROLE BUTTONS");
console.log("=".repeat(72));

const page = (p) => fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages", p), "utf8");
const buttons = (s) => JSON.parse(`[${/const ROLE_FILTERS = \[([^\]]*)\] as const;/.exec(s)[1]}]`).filter((r) => r !== "all");
const med = page("medical-market.tsx"), staff = page("staff-market.tsx");
const medButtons = buttons(med), staffButtons = buttons(staff);
const ROB = ["doctor", "medical_specialist", "physiotherapist", "nutritionist", "sports_scientist", "massage_therapist"];
check("the Medical Market's buttons run Team Doctor, Medical Specialist, Physiotherapist, Nutritionist, Sports Scientist, Massage Therapist",
  JSON.stringify(medButtons) === JSON.stringify(ROB), medButtons.join(", "));
check("both pages render their cards in button order, then name",
  [med, staff].every((s) => /\{inButtonOrder\(marketStaff\)\.map\(/.test(s) && /\(ROLE_FILTERS as readonly string\[\]\)\.indexOf\(normaliseRole\(m\.role\) \?\? ""\)/.test(s) && /at\(a\) - at\(b\) \|\| a\.name\.localeCompare\(b\.name\)/.test(s)));

const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vbe-order-")), "roles.mjs");
esbuild.buildSync({ entryPoints: [path.join(REPO, "lib/db/src/schema/staff-roles.ts")], outfile: out, format: "esm", bundle: true, logLevel: "silent" });
const { normaliseRole, isMedicalRole } = await import(pathToFileURL(out).href);

const db = new DatabaseSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), { readOnly: true });
const stored = db.prepare("SELECT DISTINCT role FROM staff").all().map((r) => r.role);
db.close();
const gen = [
  ...fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/staff-generator.ts"), "utf8").matchAll(/role:\s*"([^"]+)"/g),
  ...fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/medical-staff-generator.ts"), "utf8").matchAll(/role:\s*"([^"]+)"/g),
].map((m) => m[1]);
const roles = [...new Set([...stored, ...gen])];
const lost = roles.filter((r) => { const k = normaliseRole(r); const list = isMedicalRole(r) ? medButtons : staffButtons; return !k || !list.includes(k); });
check("every role in the database and the generators has a button on its page (none sorts to the end)", roles.length > 8 && lost.length === 0,
  `${roles.length} spellings; without a button: ${lost.join(", ") || "none"}`);

// The order function itself, as the pages define it, on a shuffled market.
const start = med.indexOf("function inButtonOrder");
const fnTs = med.slice(start, med.indexOf("\n}\n", start) + 2);
const fnJs = esbuild.transformSync(fnTs, { loader: "ts" }).code;
const orderWith = new Function("ROLE_FILTERS", "normaliseRole", `${fnJs}; return inButtonOrder;`);
const shuffled = ["Massage Therapist", "Nutritionist", "Team Doctor", "Sports Scientist", "Physiotherapist", "Medical Specialist", "nutritionist", "team_doctor"]
  .map((role, i) => ({ role, name: `P${8 - i}` }));
const got = orderWith(["all", ...medButtons], normaliseRole)(shuffled).map((m) => normaliseRole(m.role));
check("run on a shuffled Medical Market, the cards come out in Rob's order",
  JSON.stringify(got) === JSON.stringify(["doctor", "doctor", "medical_specialist", "physiotherapist", "nutritionist", "nutritionist", "sports_scientist", "massage_therapist"]), got.join(", "));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
