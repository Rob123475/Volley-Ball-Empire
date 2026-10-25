#!/usr/bin/env node
/**
 * 1.1.3 (AI market brief item 2, Rob 25 Oct): the 24 continental-pool players whose card picture is
 * a world-roster player's (EUR_09_P2 and Aoife O'Sullivan both ireland_01, and so on) get a picture
 * of their own: an unused picture of HER OWN nation from Rob's new-senior pictures
 * (images/players/new-seniors/<continent>/<nation>/, artifacts/api-server/src/data/
 * new-senior-pictures.json: 331 pictures, 74 nations, Malta added 26 Oct). The pool player's picture changes, never
 * the world-roster player's.
 *
 * Unused means on no row of the starter DB: walked table by table (every table with a picture
 * column that a player can carry: players, the world roster and anyone else; continental_pool_players;
 * career_graduate_portraits; career_new_seniors; player_retirements), and not given to another of
 * the 24 in this run. The picture's file must be on disk. A nation with none left: the player is
 * reported and keeps her card (a face is never reused).
 *
 * STARTER DB ONLY. A pool player's card no longer follows the starter DB at boot when the save has
 * one (utils/ensureSchema.ts REFERENCE_FILL_ONLY), so saves already in play keep theirs; new saves
 * get these. The game never gives a new senior a picture a pool player or a world-roster player
 * holds (utils/newSeniors.ts usedPicturesTx).
 *
 * Idempotent: a player is repointed only while she still shares a world-roster player's card.
 *
 * Usage: node scripts/repoint-pool-shared-faces.cjs [--db <starter db copy>] [--write]
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const REPO = path.resolve(__dirname, "..");
const i = process.argv.indexOf("--db");
const DB = i > 0 ? process.argv[i + 1] : path.join(REPO, "lib/db/volleyball-empire.sqlite");
const write = process.argv.includes("--write");
const PUBLIC = path.join(REPO, "artifacts/beach-volleyball/public");
const PICTURES = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts/api-server/src/data/new-senior-pictures.json"), "utf8"));
const list = Array.isArray(PICTURES) ? PICTURES : PICTURES.pictures;

const d = new DatabaseSync(DB, { readOnly: !write });
// Every picture any row carries, table by table.
const PICTURE_COLUMNS = [["players", "image_url"], ["continental_pool_players", "image_url"], ["career_graduate_portraits", "image_url"],
  ["career_new_seniors", "image_url"], ["player_retirements", "image_url"]];
const used = new Set();
for (const [t, c] of PICTURE_COLUMNS) {
  if (!d.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t)) continue;
  for (const r of d.prepare(`SELECT ${c} AS u FROM ${t} WHERE ${c} IS NOT NULL AND ${c} <> ''`).all()) used.add(r.u);
}
const world = new Map(d.prepare("SELECT name, image_url FROM players WHERE image_url IS NOT NULL").all().map((r) => [r.image_url, r.name]));
const shared = d.prepare("SELECT id, stable_id, name, nationality, image_url FROM continental_pool_players ORDER BY stable_id").all()
  .filter((p) => p.image_url && world.has(p.image_url));

const done = [], reported = [];
for (const p of shared) {
  const pic = list.find((x) => x.nation === p.nationality && !used.has(x.url) && fs.existsSync(path.join(PUBLIC, x.url)));
  if (!pic) { reported.push(p); continue; }
  used.add(pic.url);
  done.push({ ...p, to: pic.url });
  if (write) d.prepare("UPDATE continental_pool_players SET image_url = ? WHERE id = ? AND image_url = ?").run(pic.url, p.id, p.image_url);
}
for (const p of done) console.log(`${p.stable_id} ${p.name} (${p.nationality}): ${p.image_url} (shared with ${world.get(p.image_url)}) -> ${p.to}`);
for (const p of reported) console.log(`REPORTED ${p.stable_id} ${p.name} (${p.nationality}): no unused new-senior picture of her nation; keeps ${p.image_url} (shared with ${world.get(p.image_url)})`);
console.log(`${shared.length} shared a world-roster player's card; ${done.length} ${write ? "repointed" : "to repoint (dry run: --write to apply)"}; ${reported.length} reported`);
d.close();
