/**
 * 1.1.3 rebuild (brief A2, Rob 24 Oct): no continental-pool player shares a name with a
 * world-roster player (the Cup podium showed "ALINA KORA, ALINA KORA": world-roster player 81
 * and the AI club senior made from pool player 105). The 28 pool players are renamed in the
 * STARTER DB ONLY (scripts/rename-pool-duplicates.cjs); saves already in play keep the names
 * they have, because a pool player's name no longer follows the starter DB at boot
 * (utils/ensureSchema.ts REFERENCE_UPDATE_ONLY).
 *
 *   1. The starter DB: no pool player's name matches any world-roster player's name; none
 *      matches a staff member's or another pool player's; the 28 renames are in, each with a
 *      surname of her own nation's athletes; a pool player who shares a world-roster player's
 *      card never shares her surname too.
 *   2. The source: the boot no longer copies a pool player's name; 2 Oct's one rename that must
 *      reach saves in play (Salote Taufa) is made by name in utils/referenceRenames.ts.
 *   3. A save in play (a copy of Rob's live save, or of his 2 Oct backup): booted once, every
 *      pool player and every player keeps her name (only a listed 2 Oct correction may change).
 *   4. A new save: its AI clubs' seniors made from the 28 carry the new names, and none of
 *      them shares a name with a world-roster player.
 *
 * Usage: node harness/pool-names.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { createWorld, REPO } from "./night2-world.mjs";

const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const LIVE = path.join(os.homedir(), "AppData", "Roaming", "Beach Volleyball Empire", "volleyball-empire.sqlite");
const ROB = process.env.VBE_ROB_BACKUP ?? path.join(os.homedir(), "Downloads", "volleyball-empire-backup-02oct-0845.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const SRC = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const PORT = 4982;

const W = createWorld("pool-names", PORT);
const { check } = W;
console.log("=".repeat(72));
console.log("  1.1.3 REBUILD A2: NO POOL PLAYER NAMED LIKE A WORLD-ROSTER PLAYER");
console.log("=".repeat(72));

const q = (file, sql, ...a) => { const d = new DatabaseSync(file, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const low = (s) => String(s).trim().toLowerCase();
// Names are written family name first for these nations (as the game's own athletes are).
const FAMILY_FIRST = new Set(["Vietnam", "Taiwan", "China"]);
const surname = (name, nation) => { const t = name.trim().split(/\s+/); return FAMILY_FIRST.has(nation) ? t[0] : t.slice(1).join(" "); };
/** [stable_id, old name, new name], read from the rename script itself. */
const RENAMES = [...SRC("scripts/rename-pool-duplicates.cjs").matchAll(/\["(\w+_P\d)", "([^"]+)", "([^"]+)"\]/g)].map((m) => [m[1], m[2], m[3]]);

let child = null;
try {
  // ── 1. The starter DB ─────────────────────────────────────────────────────
  console.log("\n1. THE STARTER DB");
  const pool = q(SHIPPED, "SELECT stable_id, name, nationality, image_url FROM continental_pool_players");
  const world = q(SHIPPED, "SELECT id, name, nationality, image_url FROM players");
  const staff = q(SHIPPED, "SELECT name FROM staff").map((r) => low(r.name.replace(/^Dr\.\s+/, "")));
  const worldNames = new Map(world.map((r) => [low(r.name), r]));
  const clash = pool.filter((p) => worldNames.has(low(p.name)));
  check("no pool player's name matches any world-roster player's name", pool.length === 120 && world.length > 0 && clash.length === 0,
    clash.length ? clash.map((p) => `${p.stable_id} ${p.name} = world ${worldNames.get(low(p.name)).id}`).join("; ") : `${pool.length} pool players, ${world.length} world-roster players`);
  const staffClash = RENAMES.filter(([, , to]) => staff.includes(low(to)));
  const oldStaffClash = pool.filter((p) => staff.includes(low(p.name)) && !RENAMES.some(([s]) => s === p.stable_id));
  check("and no new name matches a staff member's", staffClash.length === 0, staffClash.map(([, , to]) => to).join(", ")
    + (oldStaffClash.length ? `(older, not one of the 28, reported: ${oldStaffClash.map((p) => `${p.stable_id} ${p.name}`).join(", ")})` : ""));
  const poolDupes = pool.filter((p, i) => pool.findIndex((o) => low(o.name) === low(p.name)) !== i);
  check("and no two pool players share a name", poolDupes.length === 0, poolDupes.map((p) => p.name).join(", "));
  const byStable = new Map(pool.map((p) => [p.stable_id, p]));
  check("the 28 renames are in (the pool player renamed, never the world-roster player)",
    RENAMES.length === 28 && RENAMES.every(([s, , to]) => byStable.get(s)?.name === to) && RENAMES.every(([, from]) => worldNames.has(low(from))),
    `${RENAMES.filter(([s, , to]) => byStable.get(s)?.name === to).length}/${RENAMES.length}; every old name is still a world-roster player's`);
  const athletes = [...world, ...pool.map((p) => ({ ...p, stable: p.stable_id }))];
  const offNation = RENAMES.filter(([s, , to]) => {
    const nation = byStable.get(s).nationality;
    return !athletes.some((a) => a.stable !== s && a.nationality === nation && surname(a.name, nation) === surname(to, nation));
  });
  check("each new name carries a surname of her own nation's athletes", offNation.length === 0, offNation.map(([s, , to]) => `${s} ${to}`).join(", ") || "28 of 28");
  const twins = pool.map((p) => ({ p, w: world.find((x) => x.image_url === p.image_url) })).filter((x) => x.w);
  const sameSurnameTwins = twins.filter(({ p, w }) => surname(p.name, p.nationality) === surname(w.name, w.nationality));
  check("a pool player who shares a world-roster player's card never shares her surname too", sameSurnameTwins.length === 0,
    `${twins.length} share a card (reported, not changed: docs/STATUS-1.1.3-REBUILD.md A2)${sameSurnameTwins.length ? `; ${sameSurnameTwins.map(({ p, w }) => `${p.name} / ${w.name}`).join(", ")}` : ""}`);

  // ── 2. The source ─────────────────────────────────────────────────────────
  console.log("\n2. THE SOURCE: A POOL PLAYER'S NAME DOES NOT FOLLOW THE STARTER DB");
  const ensure = SRC("artifacts/api-server/src/utils/ensureSchema.ts");
  const line = ensure.match(/^\s*continental_pool_players: \[[^\]]*\],/m)?.[0] ?? "";
  check("(source) the boot's reference sync updates a pool player's club and card, not her name",
    /continental_pool_players: \["pool_team_id", "image_url"\]/.test(line) && !/"name"/.test(line), line.trim());
  const renames = SRC("artifacts/api-server/src/utils/referenceRenames.ts");
  check("(source) 2 Oct's Salote Taufa reaches saves in play by name, from referenceRenames.ts's list",
    renames.includes('{ player: "AUS_08_P2", from: "Siosaia Taufa", to: "Salote Taufa" }')
      && /UPDATE continental_pool_players SET name = \$\{p\.to\} WHERE id = \$\{player\} AND name = \$\{p\.from\}/.test(renames));

  // ── 3. A save in play ─────────────────────────────────────────────────────
  console.log("\n3. A SAVE IN PLAY KEEPS ITS NAMES");
  const source = fs.existsSync(LIVE) ? LIVE : fs.existsSync(ROB) ? ROB : null;
  if (!source) check("a save in play to copy (Rob's live save or his 2 Oct backup)", false, `${LIVE}; ${ROB}`);
  else {
    const copy = path.join(W.work, "in-play.sqlite");
    for (const ext of ["", "-wal", "-shm"]) if (fs.existsSync(source + ext)) fs.copyFileSync(source + ext, copy + ext);
    const names = () => ({
      pool: q(copy, "SELECT stable_id, name FROM continental_pool_players ORDER BY stable_id"),
      players: q(copy, "SELECT id, name FROM players ORDER BY id"),
    });
    const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
    const before = names();
    const out = fs.openSync(path.join(W.work, "server-in-play.log"), "w");
    child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: copy, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "pool-names", STARTER_DB_PATH: SHIPPED } });
    let up = false;
    for (let i = 0; i < 480 && !up; i++) { try { up = (await fetch(`http://localhost:${PORT}/api/healthz`)).ok; } catch { await new Promise((r) => setTimeout(r, 250)); } }
    await stopServer(child); child = null;
    const after = names();
    const corrections = new Set(['AUS_08_P2']); // utils/referenceRenames.ts RENAMED_POOL_PLAYERS
    const changed = after.pool.filter((p, i) => before.pool[i]?.name !== p.name);
    check(`booted once on a copy of ${source === LIVE ? "Rob's live save" : "Rob's 2 Oct backup"}`, up);
    check("every pool player keeps her name (only a listed 2 Oct correction may change)",
      after.pool.length === before.pool.length && changed.every((p) => corrections.has(p.stable_id)),
      `pool names ${hash(before.pool)} -> ${hash(after.pool)}; changed: ${changed.map((p) => `${p.stable_id} ${p.name}`).join(", ") || "none"}`);
    const keptOld = RENAMES.filter(([s]) => before.pool.find((p) => p.stable_id === s)?.name === after.pool.find((p) => p.stable_id === s)?.name);
    check("the 28 the starter DB renamed keep this save's names", keptOld.length === RENAMES.length,
      `${keptOld.length}/28, e.g. AUS_09_P1 "${after.pool.find((p) => p.stable_id === "AUS_09_P1")?.name}"`);
    check("every player keeps her name", hash(before.players) === hash(after.players), `players ${hash(before.players)} -> ${hash(after.players)}`);
    W.info(`this save still has its ${keptOld.filter(([, from]) => after.pool.find((p) => p.name === from)).length} duplicates (Rob: anyone already playing keeps them)`);
  }

  // ── 4. A new save ─────────────────────────────────────────────────────────
  console.log("\n4. A NEW SAVE GETS THE NEW NAMES");
  await W.boot();
  const c = await W.newCareer("Pool names");
  const made = () => W.q(`SELECT p.name, cp.stable_id FROM career_player_state s JOIN players p ON p.id = s.player_id
    JOIN continental_pool_players cp ON cp.id = s.pool_player_id WHERE s.career_save_id = ?`, c.cid);
  for (let i = 0; i < 10 && made().length === 0; i++) await W.day();
  const seniors = made();
  const fromRenamed = seniors.filter((s) => RENAMES.some(([st]) => st === s.stable_id));
  check("the AI clubs' seniors made from the 28 carry the new names",
    fromRenamed.length > 0 && fromRenamed.every((s) => RENAMES.find(([st]) => st === s.stable_id)[2] === s.name),
    `${fromRenamed.length} of ${seniors.length} AI seniors made from pool players are among the 28`);
  const worldInCareer = new Set(W.q(`SELECT lower(p.name) n FROM players p WHERE p.id IN (SELECT id FROM players WHERE player_type = 'senior') AND p.id NOT IN
    (SELECT player_id FROM career_player_state WHERE career_save_id = ? AND pool_player_id IS NOT NULL)`, c.cid).map((r) => r.n));
  const twinsInCareer = seniors.filter((s) => worldInCareer.has(low(s.name)));
  check("and none of them shares a name with a world-roster player", seniors.length > 0 && twinsInCareer.length === 0,
    twinsInCareer.map((s) => s.name).join(", ") || `${seniors.length} checked`);
  const page = (await W.api("GET", `/clubs/${W.q("SELECT id FROM continental_pool_teams WHERE stable_id = 'AUS_09'")[0].id}`)).data;
  const shown = (page?.seniors ?? []).map((p) => p.name);
  check("the club page of the Papua New Guinea club shows Grace Bainivalu, not Alina Kora", shown.includes("Grace Bainivalu") && !shown.includes("Alina Kora"), shown.join(", "));
} catch (err) {
  W.fail(err);
} finally {
  if (child) await stopServer(child);
  await W.stop();
}
W.finish();
