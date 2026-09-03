#!/usr/bin/env node
/**
 * Install replacement player cards, and update BOTH databases.
 *
 * ── Why this is a script and not something done for you ─────────────────────
 * The cards live on your machine and so does the live save. A cloud session has
 * a git clone and nothing else - no route to C:\\Users\\...\\Downloads or to
 * AppData. This does the machine-local half so the result is identical.
 *
 * ── What it does ────────────────────────────────────────────────────────────
 *   1. finds the live save the way electron/main.js finds it, legacy folders
 *      and all
 *   2. BACKS IT UP FIRST - .sqlite plus the -wal and -shm sidecars - and
 *      verifies every copy against its SOURCE SIZE before touching anything.
 *      A short or missing copy aborts the run with nothing written. Sidecars
 *      are compared, not required to be non-empty: an empty -wal just means
 *      SQLite has checkpointed, and rejecting it would block a healthy save.
 *   3. converts each PNG to WebP at q=82, the setting the other 204 cards use
 *   4. writes them over the four existing slots in
 *      public/images/players/seniors/
 *   5. renames the rows that need renaming, in the repo starter DB AND the
 *      live save
 *   6. prints the four rows from both databases
 *
 * ── The four slots ──────────────────────────────────────────────────────────
 * All four already exist, so the files are replaced IN PLACE and no image_url
 * changes: the slot is the identity, and a new filename would orphan the old
 * file and churn every reference for nothing.
 *
 *   Dewi Lestari        -> player_senior_indonesia_02.webp
 *   Bouavanh Sisouvanh  -> player_senior_laos_02.webp
 *   Zineb Ouadi         -> player_senior_morocco_02.webp
 *   Thalia Vasilakis    -> player_senior_greece_03.webp   (id 187, renamed)
 *
 * Rows are matched on image_url, not on id or name: the slot is stable, while
 * a live save copied before recent work may still say "Novi Anggraini" and
 * "Elena Papadopoulou". Both old spellings are handled.
 *
 * ── CLOSE THE GAME FIRST ────────────────────────────────────────────────────
 * SQLite holds a lock and keeps recent writes in the -wal sidecar. Writing to a
 * save while Electron has it open risks losing the newest progress.
 *
 * Usage:
 *   node scripts/install-player-cards.cjs "C:\\Users\\rbonn\\Downloads\\cards"
 *   node scripts/install-player-cards.cjs "C:\\Users\\rbonn\\Downloads\\cards" --write
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { DatabaseSync } = require("node:sqlite");

const REPO = path.resolve(__dirname, "..");
const SENIORS = path.join(REPO, "artifacts/beach-volleyball/public/images/players/seniors");
const REPO_DB = path.join(REPO, "lib/db/volleyball-empire.sqlite");
const QUALITY = 82;
const TAG = "[install-player-cards]";

const srcDir = process.argv[2];
const write = process.argv.includes("--write");

if (!srcDir) {
  console.error(`${TAG} usage: node scripts/install-player-cards.cjs <folder-with-the-4-pngs> [--write]`);
  process.exit(1);
}

let sharp;
try {
  sharp = require(path.join(REPO, "scripts/node_modules/sharp"));
} catch {
  console.error(`${TAG} sharp is not installed. Run \`pnpm install\` in the repo first.`);
  process.exit(1);
}

// ── The four slots ───────────────────────────────────────────────────────────
// `match` is tested against the lowercased source filename, so the PNGs can be
// called anything as long as the player's name or country is in there.
const SLOTS = [
  { file: "player_senior_indonesia_02.webp", name: "Dewi Lestari",
    oldNames: ["Dewi Lestari", "Novi Anggraini"],
    match: /dewi|lestari|indonesia|ina/ },
  { file: "player_senior_laos_02.webp", name: "Bouavanh Sisouvanh",
    oldNames: ["Bouavanh Sisouvanh"],
    match: /bouavanh|sisouvanh|laos|lao/ },
  { file: "player_senior_morocco_02.webp", name: "Zineb Ouadi",
    oldNames: ["Zineb Ouadi"],
    match: /zineb|ouadi|morocco|mar/ },
  { file: "player_senior_greece_03.webp", name: "Thalia Vasilakis",
    oldNames: ["Thalia Vasilakis", "Eleni Papadopoulou", "Elena Papadopoulou"],
    match: /thalia|vasilakis|greece|gre/ },
];
const urlFor = (f) => `/images/players/seniors/${f}`;

// ── Find the live save exactly the way electron/main.js does ─────────────────
function findLiveDb() {
  const appDataRoot =
    process.platform === "win32"
      ? process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming")
      : process.platform === "darwin"
        ? path.join(os.homedir(), "Library", "Application Support")
        : path.join(os.homedir(), ".config");

  // Newest first, mirroring main.js's APP_NAME + LEGACY_APP_DIRS.
  const dirs = ["Volleyball Empire", "Volley-Ball-Empire", "Volley-Ball Empire", "Volleyball-Empire", "workspace"];
  const found = [];
  for (const d of dirs) {
    const p = path.join(appDataRoot, d, "volleyball-empire.sqlite");
    if (!fs.existsSync(p)) continue;
    // Newest write may still be in the -wal sidecar, so take the later mtime.
    let mtime = fs.statSync(p).mtimeMs;
    if (fs.existsSync(`${p}-wal`)) mtime = Math.max(mtime, fs.statSync(`${p}-wal`).mtimeMs);
    found.push({ dir: d, path: p, mtime });
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found[0] ?? null;
}

function backup(dbPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(path.dirname(dbPath), `backup-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  const copied = [];
  const problems = [];
  for (const suffix of ["", "-wal", "-shm"]) {
    const src = `${dbPath}${suffix}`;
    if (!fs.existsSync(src)) continue;
    const dst = path.join(dir, path.basename(src));
    fs.copyFileSync(src, dst);
    copied.push(dst);

    // Verified against the SOURCE size, not against zero. An empty -wal is
    // normal - it means SQLite has checkpointed - and rejecting it would block
    // the run on a healthy save. What matters is that the copy is not short.
    if (!fs.existsSync(dst)) { problems.push(`${dst} does not exist after copy`); continue; }
    const a = fs.statSync(src).size, b = fs.statSync(dst).size;
    if (a !== b) problems.push(`${path.basename(dst)} is ${b} bytes, source is ${a}`);
  }

  // The database itself must be there and must not be empty; the sidecars may
  // legitimately be either.
  const mainCopy = path.join(dir, path.basename(dbPath));
  if (!copied.includes(mainCopy)) problems.push(`the .sqlite itself was not copied`);
  else if (fs.statSync(mainCopy).size === 0) problems.push(`the backed-up .sqlite is zero bytes`);

  return { dir, copied, problems };
}

function showRows(label, dbPath) {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  console.log(`\n  ${label}\n  ${"".padEnd(74, "-")}`);
  for (const s of SLOTS) {
    const r = db.prepare(
      "SELECT id, name, nationality, position, player_type, image_url FROM players WHERE image_url = ?",
    ).get(urlFor(s.file));
    if (!r) { console.log(`  (no row for ${s.file})`); continue; }
    console.log(
      `  id=${String(r.id).padEnd(4)} ${String(r.name).padEnd(22)} ${String(r.nationality).padEnd(10)} ` +
      `${String(r.position).padEnd(11)} ${String(r.player_type).padEnd(7)} ${r.image_url}`,
    );
  }
  db.close();
}

(async () => {
  // ── Match the PNGs ─────────────────────────────────────────────────────────
  if (!fs.existsSync(srcDir)) {
    console.error(`${TAG} source folder not found: ${srcDir}`);
    process.exit(1);
  }
  const pngs = fs.readdirSync(srcDir).filter((f) => /\.(png|webp|jpe?g)$/i.test(f));
  const plan = [];
  const unmatched = [];
  for (const s of SLOTS) {
    const hit = pngs.find((f) => s.match.test(f.toLowerCase()));
    if (hit) plan.push({ ...s, src: path.join(srcDir, hit) });
    else unmatched.push(s);
  }

  console.log(`${TAG} ${pngs.length} image(s) in ${srcDir}`);
  for (const p of plan) console.log(`  ${path.basename(p.src).padEnd(38)} -> ${p.file}   (${p.name})`);
  if (unmatched.length) {
    console.error(`\n${TAG} FAILED: no source image matched ${unmatched.length} slot(s):`);
    for (const s of unmatched) console.error(`  - ${s.name} (${s.file}) — expected the filename to contain ${s.match}`);
    console.error(`\n  Rename the files so each contains the player's name or country, then re-run.`);
    process.exit(1);
  }

  const live = findLiveDb();
  console.log(`\n${TAG} repo starter DB : ${REPO_DB}`);
  console.log(`${TAG} live save       : ${live ? live.path : "NOT FOUND"}`);
  if (!live) {
    console.error(`\n${TAG} FAILED: no live save found. Launch the game once, or pass the folder yourself.`);
    process.exit(1);
  }

  if (!write) {
    console.log(`\n${TAG} dry run — nothing written. Re-run with --write to apply.`);
    console.log(`${TAG} CLOSE THE GAME before writing: SQLite holds a lock and the newest`);
    console.log(`${TAG} progress may still be sitting in the -wal sidecar.`);
    showRows("repo starter DB — BEFORE", REPO_DB);
    showRows("live save — BEFORE", live.path);
    return;
  }

  // ── Back up the live save, and prove it ────────────────────────────────────
  const b = backup(live.path);
  console.log(`\n${TAG} backup -> ${b.dir}`);
  for (const f of b.copied) console.log(`  ${String(fs.statSync(f).size).padStart(10)} bytes  ${path.basename(f)}`);
  if (b.problems.length) {
    console.error(`\n${TAG} ABORTED — the backup did not verify:`);
    for (const p of b.problems) console.error(`  - ${p}`);
    console.error(`\n  Nothing was written. Fix the backup location and re-run.`);
    process.exit(1);
  }
  console.log(`${TAG} backup verified on disk. Proceeding.`);

  // ── Convert and install ────────────────────────────────────────────────────
  console.log(`\n${TAG} converting to WebP q=${QUALITY}`);
  for (const p of plan) {
    const buf = await sharp(p.src).webp({ quality: QUALITY, effort: 6 }).toBuffer();
    const dst = path.join(SENIORS, p.file);
    const wasKb = fs.existsSync(dst) ? Math.round(fs.statSync(dst).size / 1024) : 0;
    fs.writeFileSync(dst, buf);
    console.log(`  ${p.file.padEnd(38)} ${wasKb}KB -> ${Math.round(buf.length / 1024)}KB`);
  }

  // ── Rename rows in BOTH databases ──────────────────────────────────────────
  for (const [label, dbPath] of [["repo starter DB", REPO_DB], ["live save", live.path]]) {
    const db = new DatabaseSync(dbPath);
    let n = 0;
    for (const s of plan) {
      const r = db.prepare("UPDATE players SET name = ? WHERE image_url = ? AND name != ?")
        .run(s.name, urlFor(s.file), s.name);
      n += Number(r.changes ?? 0);
    }
    db.close();
    console.log(`${TAG} ${label}: ${n} row(s) renamed`);
  }

  showRows("repo starter DB — AFTER", REPO_DB);
  showRows("live save — AFTER", live.path);

  console.log(`\n${TAG} Done. Backup kept at:\n  ${b.dir}`);
  console.log(`\n${TAG} Next: commit and push the repo changes so the cards and the`);
  console.log(`${TAG} starter DB are recorded, then check-captions can be re-pinned.`);
})();
