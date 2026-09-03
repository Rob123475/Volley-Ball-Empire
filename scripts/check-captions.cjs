#!/usr/bin/env node
/**
 * Build gate for player card captions.
 *
 * Every senior portrait has the player's name, nationality, age and height
 * PRINTED INSIDE THE IMAGE. That caption is the only real evidence of who is
 * in a picture - the filename is not. Four separate mislabellings (Morocco,
 * Venezuela, Papua New Guinea, ten fitness trainers) were all found by opening
 * an image, and none of them by inspecting a name.
 *
 * On 3 September 2026 all 204 senior and spare cards were opened and read. The
 * result is scripts/captions.json: for each file, what the card actually says,
 * pinned to that file's sha1.
 *
 * ── What this guard can and cannot do ───────────────────────────────────────
 * It cannot read an image. It holds the database to a HUMAN-VERIFIED reading,
 * and it fails the moment either side moves:
 *
 *   - a row's name/nationality/age/height drifts from what its card prints
 *   - a card is regenerated or swapped (its sha1 changes), so the recorded
 *     reading no longer describes the file and the new card must be read
 *   - a row points at a file nobody has ever read
 *   - a row points at a file that is not on disk
 *
 * That last one is why the sha1 matters. Without it, replacing a portrait with
 * a different woman's render would sail straight through - which is exactly
 * how indonesia_02 and laos_02 got in.
 *
 * ── Positions are deliberately NOT checked ──────────────────────────────────
 * The cards use FIVB vocabulary (Outside Hitter, Opposite Hitter, Middle
 * Blocker, Libero, Defensive Specialist) that does not map onto the five
 * database positions. Comparing the two strings would fail on about thirty
 * correct cards. Do not add it.
 *
 * ── Known-wrong art ─────────────────────────────────────────────────────────
 * Three cards genuinely show the wrong person and no correct art exists in the
 * repo. They are recorded in captions.json with what the card DOES show, and
 * this guard asserts that each is still exactly the known problem - so they
 * cannot quietly become a different problem. They are reported, not fatal.
 * Fixing them needs new renders, not a code change. See docs/caption-audit.md.
 *
 * Run: node scripts/check-captions.cjs [path-to-db]
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const DB = process.argv[2] || path.join(ROOT, "lib/db/volleyball-empire.sqlite");
const PUBLIC = path.join(ROOT, "artifacts/beach-volleyball/public");
const FIXTURE = path.join(__dirname, "captions.json");

const TAG = "[check-captions]";
const fail = [];
const known = [];

const { cards } = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));

const db = new DatabaseSync(DB, { readOnly: true });
const rows = db
  .prepare(
    `select name, nationality, base_age, height, image_url, player_type
       from players
      where player_type in ('senior','spare')
      order by image_url`
  )
  .all();

console.log(`${TAG} ${rows.length} senior/spare rows, ${Object.keys(cards).length} audited cards`);

for (const r of rows) {
  const file = path.basename(r.image_url || "");
  const where = `${file} (${r.name})`;

  if (!r.image_url) {
    fail.push(`${r.name}: no image_url`);
    continue;
  }

  const onDisk = path.join(PUBLIC, r.image_url);
  if (!fs.existsSync(onDisk)) {
    fail.push(`${where}: image_url points at a file that is not on disk`);
    continue;
  }

  const entry = cards[file];
  if (!entry) {
    fail.push(
      `${where}: no audited caption for this file. Open the image, read the ` +
        `caption, and add it to scripts/captions.json.`
    );
    continue;
  }

  const sha1 = crypto.createHash("sha1").update(fs.readFileSync(onDisk)).digest("hex");
  if (sha1 !== entry.sha1) {
    fail.push(
      `${where}: the ARTWORK CHANGED since it was read (sha1 ${entry.sha1.slice(0, 12)} ` +
        `-> ${sha1.slice(0, 12)}). The recorded caption no longer describes this file. ` +
        `Open it, read the caption, update scripts/captions.json.`
    );
    continue;
  }

  // Art already known to show the wrong person: assert it is still THAT problem.
  if (entry.artWrong) {
    const s = entry.artWrong.cardShows;
    known.push(
      `${file}: row is ${r.name} (${r.nationality}, ${r.base_age}, ${r.height}cm) ` +
        `but the card shows ${s.name} (${s.nationality}, ${s.age}, ${s.height}cm)\n` +
        `      ${entry.artWrong.why}`
    );
    if (r.name === s.name) {
      fail.push(`${where}: recorded as art-wrong, but the row now matches the card. Re-audit and update captions.json.`);
    }
    continue;
  }

  const c = entry.caption;
  if (r.name !== c.name) fail.push(`${where}: card prints "${c.name}", row says "${r.name}"`);
  if (r.nationality !== c.nationality)
    fail.push(`${where}: card prints "${c.nationality}", row says "${r.nationality}"`);

  if (entry.captionOmitsAgeHeight) {
    // portugal_03, spain_02, spain_03 print no age/height line; nothing to compare.
    continue;
  }
  if (r.base_age !== c.age) fail.push(`${where}: card prints ${c.age} yrs, row says ${r.base_age}`);
  if (r.height !== c.height) fail.push(`${where}: card prints ${c.height}cm, row says ${r.height}`);
}

// Every audited card should still be claimed by a row; an orphan means art was
// unhooked without the audit being updated.
const claimed = new Set(rows.map((r) => path.basename(r.image_url || "")));
for (const file of Object.keys(cards)) {
  if (!claimed.has(file)) fail.push(`${file}: audited, but no player row points at it any more`);
}

if (known.length) {
  console.log(`\n${TAG} ${known.length} card(s) known to show the wrong person - need new renders, not code:`);
  for (const k of known) console.log(`  - ${k}`);
}

if (fail.length) {
  console.error(`\n${TAG} FAILED - ${fail.length} problem(s):`);
  for (const f of fail) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `\n${TAG} OK - every row matches the caption printed on its card, ` +
    `and no artwork has changed since it was read.`
);
