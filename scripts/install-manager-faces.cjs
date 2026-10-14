#!/usr/bin/env node
/**
 * Update 1, item 2 (Rob, 13 Oct; docs/UPDATE1-MANAGERS-BRIEF.md): install the
 * manager faces (61 on 13 Oct; 69 since Rob's 8 spares, 14 Oct) and write
 * their manifest.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 *   1. reads Rob's folder of manager pictures (PNGs, 2560 x 1440 with the face
 *      roughly centred, or 1920 x 2560 portraits already 3:4). A file whose name ends "(1)" is skipped once it is
 *      proved byte-identical to the file without it (the Jamaican duplicate)
 *   2. reads each file name for the age, nationality and gender ("...portrait
 *      of a 42-year-old Nigerian woman_ ...") and looks the face up in
 *      docs/manager-face-names.json (Rob's one fixed name per face). A file
 *      that matches no key, or a key no file matches, stops the run
 *   3. crops the centre to a 3:4 portrait (a 3:4 picture is taken whole),
 *      resizes it to 600 x 800 and writes
 *      WebP at q=82, the setting the player cards use (install-player-cards.cjs)
 *      into public/images/managers/
 *   4. deals the eight specialities round-robin over the faces in a fixed order
 *      (by age, then nationality: the names file's order) and writes the
 *      manifest, artifacts/api-server/src/data/manager-faces.json: one row per
 *      face with id, file, name, gender, age, nationality and speciality
 *
 * A face is a character: face + name + speciality, always together, wherever
 * it is dealt (Addendum point 1).
 *
 * Usage:
 *   node scripts/install-manager-faces.cjs "<folder>"           dry run
 *   node scripts/install-manager-faces.cjs "<folder>" --write
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const REPO = path.resolve(__dirname, "..");
const OUT_DIR = path.join(REPO, "artifacts/beach-volleyball/public/images/managers");
const MANIFEST = path.join(REPO, "artifacts/api-server/src/data/manager-faces.json");
const NAMES = path.join(REPO, "docs/manager-face-names.json");
const QUALITY = 82;
const W = 600, H = 800;
const TAG = "[install-manager-faces]";

/** M-1, in the brief's order: the order they are dealt in. */
const SPECIALITIES = [
  "Talent Recruiter", "Negotiator", "Contracts Expert", "Sponsor Magnet",
  "Leader", "Coach", "Youth Developer", "Fitness Guru",
];

const { COUNTRY } = require("./lib/nationality-words.cjs");

const srcDir = process.argv[2];
const write = process.argv.includes("--write");
if (!srcDir || !fs.existsSync(srcDir)) {
  console.error(`${TAG} usage: node scripts/install-manager-faces.cjs <folder-with-the-pictures> [--write]`);
  process.exit(1);
}

let sharp;
try {
  sharp = require(path.join(REPO, "scripts/node_modules/sharp"));
} catch {
  console.error(`${TAG} sharp is not installed. Run \`pnpm install\` in the repo first.`);
  process.exit(1);
}

const sha1 = (f) => crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex");
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

(async () => {
  const names = JSON.parse(fs.readFileSync(NAMES, "utf8"));
  const keys = Object.keys(names).filter((k) => !k.startsWith("_"));
  const files = fs.readdirSync(srcDir).filter((f) => /\.png$/i.test(f)).sort();

  // ── The duplicates ─────────────────────────────────────────────────────────
  const skipped = [];
  const faces = [];
  const problems = [];
  for (const f of files) {
    const dup = f.match(/^(.*) \(\d+\)(\.png)$/i);
    if (dup) {
      const original = dup[1] + dup[2];
      if (!files.includes(original)) { problems.push(`${f}: a "(n)" copy with no original beside it`); continue; }
      if (sha1(path.join(srcDir, f)) !== sha1(path.join(srcDir, original))) { problems.push(`${f}: differs from ${original}, so it is not a duplicate`); continue; }
      skipped.push(f);
      continue;
    }
    // ── Age, nationality and gender, from the file name ─────────────────────
    const m = f.match(/portrait of an? (\d+)-year-old (.+?) (man|woman)(?: from [^_]+)?_/);
    if (!m) { problems.push(`${f}: no "<age>-year-old <nationality> man|woman" in the name`); continue; }
    const [, age, word, gender] = m;
    const key = `${age} ${word} ${gender}`;
    if (!(key in names)) { problems.push(`${f}: no entry "${key}" in docs/manager-face-names.json`); continue; }
    if (!(word in COUNTRY)) { problems.push(`${f}: no country known for "${word}"`); continue; }
    faces.push({ src: path.join(srcDir, f), key, age: Number(age), word, gender: gender === "man" ? "male" : "female" });
  }
  for (const k of keys) if (!faces.some((x) => x.key === k)) problems.push(`names file entry "${k}" matches no picture`);
  const seen = new Set();
  for (const x of faces) { if (seen.has(x.key)) problems.push(`two pictures for "${x.key}"`); seen.add(x.key); }
  if (problems.length) {
    console.error(`${TAG} FAILED, nothing written:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }

  // ── The fixed order (the names file's) and the specialities ────────────────
  faces.sort((a, b) => keys.indexOf(a.key) - keys.indexOf(b.key));
  const rows = faces.map((x, i) => ({
    id: i + 1,
    file: `images/managers/manager_${String(i + 1).padStart(2, "0")}_${slug(`${x.word} ${x.gender === "male" ? "man" : "woman"}`)}.webp`,
    name: names[x.key],
    gender: x.gender,
    age: x.age,
    nationality: COUNTRY[x.word],
    speciality: SPECIALITIES[i % SPECIALITIES.length],
    source: path.basename(x.src),
  }));

  console.log(`${TAG} ${files.length} picture(s) in ${srcDir}; ${skipped.length} duplicate(s) skipped: ${skipped.join(", ") || "none"}`);
  console.log(`${TAG} ${rows.length} faces: ${rows.filter((r) => r.gender === "female").length} women, ${rows.filter((r) => r.gender === "male").length} men`);
  for (const s of SPECIALITIES) {
    const of = rows.filter((r) => r.speciality === s);
    console.log(`  ${s.padEnd(17)} ${of.length}  (${of.filter((r) => r.gender === "female").length} women, ${of.filter((r) => r.gender === "male").length} men)`);
  }
  if (!write) {
    for (const r of rows) console.log(`  ${String(r.id).padStart(2)} ${r.name.padEnd(22)} ${r.nationality.padEnd(14)} ${r.gender.padEnd(6)} ${r.speciality.padEnd(17)} ${r.file}`);
    console.log(`\n${TAG} dry run: nothing written. Re-run with --write.`);
    return;
  }

  // ── Crop, resize, convert ──────────────────────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let total = 0;
  for (const r of rows) {
    const src = path.join(srcDir, r.source);
    const meta = await sharp(src).metadata();
    const cropW = Math.min(meta.width, Math.round((meta.height * 3) / 4));
    const cropH = Math.min(meta.height, Math.round((cropW * 4) / 3));
    const left = Math.round((meta.width - cropW) / 2), top = Math.round((meta.height - cropH) / 2);
    const buf = await sharp(src).extract({ left, top, width: cropW, height: cropH })
      .resize(W, H, { kernel: "lanczos3" }).webp({ quality: QUALITY, effort: 6 }).toBuffer();
    fs.writeFileSync(path.join(REPO, "artifacts/beach-volleyball/public", r.file), buf);
    total += buf.length;
  }
  console.log(`${TAG} ${rows.length} WebP files written to ${path.relative(REPO, OUT_DIR)} (${Math.round(total / 1024)} KB, ${Math.round(total / 1024 / rows.length)} KB each on average)`);

  const manifest = {
    about: "Update 1, item 2 (Rob, 13 Oct 2026; 8 spares added 14 Oct): the manager faces. A face is a character: face, name and speciality always together, wherever it is dealt. Names: docs/manager-face-names.json. Specialities dealt round-robin in this order over the faces in this order. Written by scripts/install-manager-faces.cjs.",
    specialityOrder: SPECIALITIES,
    faces: rows.map(({ source, ...r }) => r),
  };
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`${TAG} manifest: ${path.relative(REPO, MANIFEST)} (${rows.length} rows)`);
})();
