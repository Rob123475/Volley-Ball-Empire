/**
 * 1.1.3 (brief A2): real flags on every screen.
 *
 *   1. every distinct nationality in the starter database (players, staff,
 *      pool players, youths, retirements, managers), every nation the new
 *      seniors' pictures and the nation name lists bring (1.1.2), every
 *      manager face's nation and every nationality a picker or generator
 *      offers resolves through flagCode() (continents.ts, compiled as the
 *      server compiles it) to a flag file in public/images/flags/
 *   2. the flag files are the MIT flag-icons set, its licence beside them
 *   3. (source) no emoji flag is left in the frontend or the server, and
 *      countryFlag() is gone; the frontend draws flags only through
 *      components/flag.tsx's <Flag nation=... />
 *   4. Unity's podium flags (A5): a PNG for every code the game can ask for
 *
 * Usage: node harness/flags.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const FLAGS = path.join(REPO, "artifacts", "beach-volleyball", "public", "images", "flags");
const FRONT = path.join(REPO, "artifacts", "beach-volleyball", "src");
const SERVER_SRC = path.join(REPO, "artifacts", "api-server", "src");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-flags-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  1.1.3 (A2): REAL FLAGS ON EVERY SCREEN");
console.log("=".repeat(72));

const esbuild = createRequire(path.join(REPO, "artifacts", "api-server", "package.json"))("esbuild");
const out = path.join(WORK, "continents.mjs");
esbuild.buildSync({ entryPoints: [path.join(REPO, "lib/db/src/schema/continents.ts")], outfile: out, format: "esm", bundle: true, logLevel: "silent" });
const C = await import(pathToFileURL(out).href);

// ── 1. Every nationality the game holds or offers ────────────────────────────
console.log("\n1. EVERY NATIONALITY RESOLVES TO A FLAG FILE");
const sources = new Map(); // nationality -> where it came from
const add = (v, where) => { if (v && !sources.has(v)) sources.set(v, where); };
const COLS = [["players", "nationality"], ["staff", "nationality"], ["continental_pool_players", "nationality"], ["youth_prospects", "nationality"], ["player_retirements", "nationality"], ["career_saves", "manager_nationality"]];
const db = new DatabaseSync(SHIPPED, { readOnly: true });
let dbCount = 0;
for (const [t, c] of COLS) {
  if (!db.prepare(`PRAGMA table_info("${t}")`).all().some((x) => x.name === c)) continue;
  for (const { v } of db.prepare(`SELECT DISTINCT "${c}" AS v FROM "${t}" WHERE "${c}" IS NOT NULL AND "${c}" <> ''`).all()) { add(v, `starter DB ${t}`); dbCount++; }
}
db.close();
const pictures = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts/api-server/src/data/new-senior-pictures.json"), "utf8"));
const pictureNations = new Set(JSON.stringify(pictures).match(/"nation":\s*"([^"]+)"/g)?.map((m) => m.replace(/"nation":\s*"/, "").slice(0, -1)) ?? []);
for (const n of pictureNations) add(n, "new-senior pictures");
const nationNames = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/data/nationNames.ts"), "utf8");
for (const m of nationNames.matchAll(/^ {2}(?:"([^"]+)"|([A-Z][A-Za-z ]+)): \{/gm)) add(m[1] ?? m[2], "data/nationNames.ts");
const faces = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts/api-server/src/data/manager-faces.json"), "utf8"));
for (const f of (Array.isArray(faces) ? faces : faces.faces ?? Object.values(faces))) if (f && typeof f === "object") add(f.nationality ?? f.nation, "manager faces");
for (const n of C.ALL_NATIONS) add(n, "continents.ts roster");
const listed = (file, re) => [...(re.exec(fs.readFileSync(file, "utf8"))?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const pickers = [
  [path.join(FRONT, "components/career/career-wizard-fields.tsx"), /export const NATIONALITIES = \[([\s\S]*?)\];/, "the manager's nationality picker"],
  [path.join(FRONT, "pages/team.tsx"), /const NATIONALITIES = \[([\s\S]*?)\];/, "a player's nationality list"],
  [path.join(FRONT, "pages/staff.tsx"), /const STAFF_NATIONALITIES = \[([\s\S]*?)\];/, "a staff member's nationality list"],
  [path.join(SERVER_SRC, "utils/staff-generator.ts"), /const NATIONALITIES = \[([\s\S]*?)\];/, "the staff generator"],
  [path.join(SERVER_SRC, "utils/medical-staff-generator.ts"), /const NATIONALITIES = \[([\s\S]*?)\];/, "the medical staff generator"],
];
for (const [file, re, where] of pickers) {
  const names = listed(file, re).filter((n) => n !== "Other" && !/^name$/.test(n));
  check(`(source) ${where} lists nationalities`, names.length > 5, `${names.length}`);
  for (const n of names) add(n, where);
}
const unresolved = [], noFile = [];
for (const [v, where] of sources) {
  const code = C.flagCode(v);
  if (!code) unresolved.push(`${v} (${where})`);
  else if (!fs.existsSync(path.join(FLAGS, `${code}.svg`))) noFile.push(`${v} -> ${code}.svg (${where})`);
}
check(`every one of the ${sources.size} nationalities has a flag code`, unresolved.length === 0, unresolved.join(", ") || `${dbCount} distinct in the starter DB, ${pictureNations.size} picture nations`);
check("and a flag file for that code", noFile.length === 0, noFile.join(", "));
check("England, Scotland and Wales have their own flags", C.flagCode("Scotland") === "gb-sct" && C.flagCode("English") === "gb-eng" && C.flagCode("Wales") === "gb-wls");
check("a demonym finds the same flag as the country", C.flagCode("Brazilian") === "br" && C.flagCode("Filipino") === "ph" && C.flagCode("Trinidad and Tobago") === "tt");
check("an unknown nationality has no code (the frontend then draws a globe, never letters)", C.flagCode("Atlantis") === null && C.flagCode("") === null);

// ── 2. The set ───────────────────────────────────────────────────────────────
console.log("\n2. THE MIT FLAG-ICONS SET, WITH ITS LICENCE");
const svgs = fs.readdirSync(FLAGS).filter((f) => f.endsWith(".svg"));
const licence = fs.existsSync(path.join(FLAGS, "LICENSE.txt")) ? fs.readFileSync(path.join(FLAGS, "LICENSE.txt"), "utf8") : "";
check("the 4x3 flags are in public/images/flags with the MIT licence", svgs.length >= 250 && /flag-icons/.test(licence) && /MIT License/.test(licence), `${svgs.length} SVGs`);
check("each is an SVG of 4:3", svgs.every((f) => /viewBox="0 0 640 480"/.test(fs.readFileSync(path.join(FLAGS, f), "utf8"))));

// ── 3. Source ────────────────────────────────────────────────────────────────
console.log("\n3. (SOURCE) NO EMOJI FLAGS, ONE <Flag> COMPONENT");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(tsx?|mjs)$/.test(e.name) ? [path.join(dir, e.name)] : []);
const files = [...walk(FRONT), ...walk(SERVER_SRC), path.join(REPO, "lib/db/src/schema/continents.ts")];
const REGIONAL = /[\u{1F1E6}-\u{1F1FF}]{2}|\u{1F3F4}\u{E0067}/u;
const emoji = files.filter((f) => REGIONAL.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(REPO, f));
check("no emoji flag in the frontend, the server or continents.ts", emoji.length === 0, emoji.join(", "));
const old = files.filter((f) => /countryFlag\b/.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(REPO, f));
check("countryFlag() is gone", old.length === 0, old.join(", "));
// (lucide-react's Flag icon, a forfeit button's, is not a nation's flag)
const users = walk(FRONT).filter((f) => { const s = fs.readFileSync(f, "utf8"); return /<Flag\b/.test(s) && !/import \{[^}]*\bFlag\b[^}]*\} from "lucide-react"/.test(s); });
const noImport = users.filter((f) => !f.endsWith("flag.tsx") && !/import \{ Flag \} from "@\/components\/flag";/.test(fs.readFileSync(f, "utf8")));
check("every page that draws a flag uses components/flag.tsx", users.length >= 15 && noImport.length === 0, `${users.length} files${noImport.length ? "; no import: " + noImport.map((f) => path.relative(FRONT, f)).join(", ") : ""}`);
const comp = fs.readFileSync(path.join(FRONT, "components/flag.tsx"), "utf8");
check("<Flag> is built on flagCode() -> countryCode() and draws images/flags/<code>.svg", /flagCode\(nation\)/.test(comp) && /images\/flags\/\$\{code\}\.svg/.test(comp)
  && /countryCode\(nationality\)\?\.toLowerCase\(\)/.test(fs.readFileSync(path.join(REPO, "lib/db/src/schema/continents.ts"), "utf8")));
const named = ["components/youth-player-card.tsx", "components/player-portrait.tsx", "pages/staff-market.tsx", "pages/medical-market.tsx", "pages/players.tsx",
  "pages/team.tsx", "pages/competition/national-squads.tsx", "pages/competition/olympic-schedule.tsx", "pages/competition/olympic-qualifiers.tsx", "pages/dashboard.tsx"];
const missing = named.filter((f) => !/<Flag\b/.test(fs.readFileSync(path.join(FRONT, f), "utf8")));
check("youth cards, player and staff cards, the Nations Cup pages and the dashboard draw <Flag>", missing.length === 0, missing.join(", "));

// ── 4. Unity ─────────────────────────────────────────────────────────────────
console.log("\n4. UNITY'S FLAG TEXTURES (A5)");
const unityProject = process.env.VBE_UNITY_PROJECT ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball";
const codes = [...new Set([...sources.keys()].map((v) => C.flagCode(v)).filter(Boolean))];
const unityDir = path.join(unityProject, "Assets", "Resources", "Flags");
if (fs.existsSync(unityDir)) {
  const pngs = new Set(fs.readdirSync(unityDir).filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4)));
  const gone = codes.filter((c) => !pngs.has(c));
  check("the Unity project has a PNG flag for every nation in the game", gone.length === 0, gone.join(", ") || `${codes.length} nations, ${pngs.size} PNGs`);
} else {
  console.log(`  NOTE  the Unity project is not on this machine (${unityDir}); the textures are checked where it is`);
}

fs.rmSync(WORK, { recursive: true, force: true });
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
