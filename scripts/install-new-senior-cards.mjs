#!/usr/bin/env node
/**
 * 1.1.1 (Rob, 18 Oct; Downloads/NEW-SENIORS-BRIEF-18OCT.md): install Rob's new senior pictures.
 *
 * Run with tsx (it reads the game's own nation rules from lib/db/src/schema/continents.ts):
 *   npx tsx scripts/install-new-senior-cards.mjs "<Desktop>\new senior cards"            dry run
 *   npx tsx scripts/install-new-senior-cards.mjs "<Desktop>\new senior cards" --write
 *   options (a test run): --images <public/images/players copy> --data <manifest json> --skip "<continent>/<nation>/<file>"
 *
 * ── What it does ────────────────────────────────────────────────────────────
 *   1. reads <root>\<continent>\<nation>\<any file names>. THE FOLDER NAME IS THE NATION, never the
 *      file name. The continent folder may be "North America", "Africa & Middle East", "Oceania"...
 *      (continentKeyFrom). A nation folder must resolve: nationName, countryCode (its flag), and
 *      continentKeyForNationality must equal its continent folder. One that doesn't is reported and
 *      skipped, never guessed. So is one with no names the game can give her (no athletes of that
 *      nation in the starter database and no list in artifacts/api-server/src/data/nationNames.ts).
 *   2. checks every picture against every other and against every picture the game already has
 *      (players: seniors, graduates, youth; staff; managers): the same file (sha1) or the same
 *      picture at 64 x 64 (mean difference under DUPLICATE_AT of 255) is a duplicate, and the later
 *      one is skipped; pairs under NEAR_AT are listed for a look.
 *   3. copies (never moves) each into public/images/players/new-seniors/<continent>/<nation>/,
 *      600 x 800 WebP at q=82 (the graduate pictures' size and format), cropped from the top.
 *   4. writes artifacts/api-server/src/data/new-senior-pictures.json: { url, nation, continent } each,
 *      the list utils/newSeniors.ts draws from. A re-run rebuilds the folder and the list.
 *   5. reports pictures per continent and per nation, and how many seasons the set lasts.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";
import {
  continentKeyFrom, continentKeyForNationality, nationName, countryFlag, CONTINENT_LABEL,
} from "../lib/db/src/schema/continents.ts";
import { NATION_NAMES } from "../artifacts/api-server/src/data/nationNames.ts";

const REPO = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const sharp = require(path.join(REPO, "scripts/node_modules/sharp"));
const TAG = "[install-new-senior-cards]";
const QUALITY = 82, WIDTH = 600, HEIGHT = 800;
const DUPLICATE_AT = 3, NEAR_AT = 8;
const PER_SEASON = 10;

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const root = args[0];
const write = args.includes("--write");
const IMAGES = opt("--images") ?? path.join(REPO, "artifacts/beach-volleyball/public/images");
const DATA = opt("--data") ?? path.join(REPO, "artifacts/api-server/src/data/new-senior-pictures.json");
const skip = new Set(args.flatMap((a, i) => (a === "--skip" ? [args[i + 1].replace(/\\/g, "/").toLowerCase()] : [])));
if (!root || !fs.existsSync(root)) { console.error(`${TAG} usage: npx tsx scripts/install-new-senior-cards.mjs <new senior cards folder> [--write]`); process.exit(1); }

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const IMAGE = /\.(png|jpe?g|webp)$/i;

// Nations the game can name: its shipped athletes' and pool players', and data/nationNames.ts.
const starter = new DatabaseSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), { readOnly: true });
const named = new Set([
  ...starter.prepare(`SELECT nationality n FROM players WHERE origin_career_save_id IS NULL`).all(),
  ...starter.prepare(`SELECT nationality n FROM continental_pool_players`).all(),
].map((r) => nationName(r.n)).filter(Boolean));
for (const n of Object.keys(NATION_NAMES)) named.add(nationName(n) ?? n);
starter.close();

// ── 1. Read the folders ─────────────────────────────────────────────────────
const problems = [];
const found = [];
for (const cDir of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const continent = continentKeyFrom(cDir.name);
  if (!continent) { problems.push(`continent folder "${cDir.name}": not a continent the game knows; skipped`); continue; }
  for (const nDir of fs.readdirSync(path.join(root, cDir.name), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const nation = nationName(nDir.name);
    const files = fs.readdirSync(path.join(root, cDir.name, nDir.name)).filter((f) => IMAGE.test(f));
    const where = `${cDir.name}\\${nDir.name}`;
    // A flag the game can draw: an ISO country, or England/Scotland/Wales (subdivision flags, no ISO code).
    if (!nation || countryFlag(nation) === "\u{1F30D}") { problems.push(`${where}: "${nDir.name}" is not a nation the game knows (no name or flag); ${files.length} skipped`); continue; }
    const home = continentKeyForNationality(nation);
    if (home !== continent) { problems.push(`${where}: ${nation} is in ${home ? CONTINENT_LABEL[home] : "no continent"} in the game, not ${CONTINENT_LABEL[continent]}; ${files.length} skipped`); continue; }
    if (!named.has(nation)) { problems.push(`${where}: the game has no names for ${nation} (add a list to data/nationNames.ts); ${files.length} skipped`); continue; }
    if (files.length === 0) { problems.push(`${where}: no pictures`); continue; }
    for (const f of files.sort()) {
      const rel = `${cDir.name}/${nDir.name}/${f}`;
      if (skip.has(rel.toLowerCase())) { problems.push(`${rel}: skipped (--skip)`); continue; }
      found.push({ src: path.join(root, cDir.name, nDir.name, f), rel, continent, nation });
    }
  }
}

// ── 2. Duplicates ───────────────────────────────────────────────────────────
async function thumb(file) {
  const input = fs.readFileSync(file);
  const px = await sharp(input).resize(64, 64, { fit: "fill" }).greyscale().raw().toBuffer();
  return { sha: crypto.createHash("sha1").update(input).digest("hex"), px };
}
const diff = (a, b) => { let t = 0; for (let i = 0; i < a.length; i++) t += Math.abs(a[i] - b[i]); return t / a.length; };
const existing = [];
const walk = (dir) => { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) { if (!p.includes(`${path.sep}new-seniors`)) walk(p); } else if (IMAGE.test(e.name)) existing.push(p);
} };
for (const d of ["players", "staff", "managers"]) walk(path.join(IMAGES, d));
const known = [];
for (const file of existing) known.push({ name: path.relative(IMAGES, file), ...(await thumb(file)) });
const near = [];
const pictures = [];
for (const p of found) {
  const t = await thumb(p.src);
  let dup = null;
  for (const k of [...known, ...pictures.map((x) => ({ name: x.rel, sha: x.sha, px: x.px }))]) {
    const d = k.sha === t.sha ? 0 : diff(k.px, t.px);
    if (d < DUPLICATE_AT) { dup = `${k.name} (${d.toFixed(1)})`; break; }
    if (d < NEAR_AT) near.push(`${p.rel} ~ ${k.name} (${d.toFixed(1)})`);
  }
  if (dup) { problems.push(`${p.rel}: the same picture as ${dup}; skipped`); continue; }
  pictures.push({ ...p, ...t });
}

// ── 3 and 4. Copy and list ──────────────────────────────────────────────────
const OUT = path.join(IMAGES, "players", "new-seniors");
const manifest = [];
const counter = new Map();
for (const p of pictures) {
  const dir = `${slug(CONTINENT_LABEL[p.continent])}/${slug(p.nation)}`;
  const n = (counter.get(dir) ?? 0) + 1; counter.set(dir, n);
  const file = `${dir}/${slug(p.nation)}_${String(n).padStart(2, "0")}.webp`;
  manifest.push({ url: `/images/players/new-seniors/${file}`, nation: p.nation, continent: p.continent, source: p.rel, out: file });
}
if (write) {
  fs.rmSync(OUT, { recursive: true, force: true });
  for (const m of manifest) {
    const dest = path.join(OUT, m.out);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await sharp(fs.readFileSync(path.join(root, m.source))).resize(WIDTH, HEIGHT, { fit: "cover", position: "top" }).webp({ quality: QUALITY }).toFile(dest);
  }
  fs.writeFileSync(DATA, JSON.stringify({ pictures: manifest.map(({ url, nation, continent }) => ({ url, nation, continent })) }, null, 2) + "\n");
}

// ── 5. Report ───────────────────────────────────────────────────────────────
const byContinent = new Map(), byNation = new Map();
for (const m of manifest) {
  byContinent.set(m.continent, (byContinent.get(m.continent) ?? 0) + 1);
  byNation.set(`${CONTINENT_LABEL[m.continent]} / ${m.nation}`, (byNation.get(`${CONTINENT_LABEL[m.continent]} / ${m.nation}`) ?? 0) + 1);
}
console.log(`${TAG} ${write ? "INSTALLED" : "dry run (nothing written; add --write)"}: ${manifest.length} pictures from ${found.length} found; checked against ${known.length} existing pictures`);
for (const [c, n] of [...byContinent].sort()) console.log(`  ${CONTINENT_LABEL[c]}: ${n}`);
for (const [k, n] of [...byNation].sort()) console.log(`    ${k}: ${n}`);
console.log(`  lasts ${(manifest.length / PER_SEASON).toFixed(1)} seasons at ${PER_SEASON} a season`);
if (problems.length) { console.log(`${TAG} reported (${problems.length}):`); for (const p of problems) console.log(`  - ${p}`); }
if (near.length) { console.log(`${TAG} close pairs to look at (${near.length}):`); for (const p of near.slice(0, 40)) console.log(`  ~ ${p}`); }
