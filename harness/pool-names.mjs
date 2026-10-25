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
 * 1.1.3 (Rob, 25 Oct; AI market brief item 2), their pictures too. 24 pool players carried a
 * world-roster player's card; 22 now have an unused new-senior picture of their own nation
 * (scripts/repoint-pool-shared-faces.cjs), STARTER DB ONLY, and Malta's two are reported (Rob made
 * no Malta picture):
 *   1b. The starter DB: no two players share a picture (the world roster, its spares and the pool;
 *      the academy youths' one generic youth card apart), and no two different files are the same
 *      picture; the 22 old -> new are in, each from her own nation's folder; Malta's two reported.
 *   2b. The source: a pool player's card is filled from the starter DB only where a save has none;
 *      a new senior is never given a picture a pool or world-roster player carries.
 *   3b. The save in play keeps every pool player's card.
 *   4b. The new save: the AI seniors made from the 22 carry the new pictures; and at its first turn,
 *      with every other new-senior picture planted as given, no new senior gets one of the 22.
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
const PUBLIC = path.join(REPO, "artifacts", "beach-volleyball", "public");
const CARDS = JSON.parse(SRC("scripts/portraits/ai-senior-cards.json")).players;
const REPOINTED = CARDS.filter((c) => c.kind === "repointed");
const NEW_SENIOR = [JSON.parse(SRC("artifacts/api-server/src/data/new-senior-pictures.json"))].map((j) => (Array.isArray(j) ? j : j.pictures))[0];
const YOUTH_CARD = /\/images\/players\/youth\/player_youth_all_01_/;

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
    `${twins.length} share a card (Malta's two, below)${sameSurnameTwins.length ? `; ${sameSurnameTwins.map(({ p, w }) => `${p.name} / ${w.name}`).join(", ")}` : ""}`);

  // ── 1b. The starter DB's pictures (25 Oct) ────────────────────────────────
  console.log("\n1b. THE STARTER DB: NO TWO PLAYERS SHARE A PICTURE");
  const cards = [...world.map((r) => ({ who: `player ${r.id} ${r.name}`, url: r.image_url })), ...pool.map((p) => ({ who: `pool ${p.stable_id} ${p.name}`, url: p.image_url }))]
    .filter((c) => c.url);
  const youthCard = cards.filter((c) => YOUTH_CARD.test(c.url));
  const byUrl = new Map(); for (const c of cards.filter((x) => !YOUTH_CARD.test(x.url))) byUrl.set(c.url, [...(byUrl.get(c.url) ?? []), c.who]);
  const sharedNow = [...byUrl].filter(([, l]) => l.length > 1);
  const malta = sharedNow.filter(([u]) => /malta/.test(u));
  check("no two players share a picture but Malta's two pool players, reported (no Malta new-senior picture)",
    sharedNow.length === 2 && malta.length === 2, `${byUrl.size} cards; shared: ${sharedNow.map(([u, l]) => `${u.split("/").pop()} (${l.join(" / ")})`).join("; ")}`);
  W.info(`the academy youths' generic youth card is the one card many players show, by design: ${youthCard.length} youths`);
  const md5 = (u) => crypto.createHash("md5").update(fs.readFileSync(path.join(PUBLIC, u))).digest("hex");
  const missing = [...byUrl.keys()].filter((u) => !fs.existsSync(path.join(PUBLIC, u)));
  const byHash = new Map(); for (const u of [...byUrl.keys()].filter((x) => !missing.includes(x))) byHash.set(md5(u), [...(byHash.get(md5(u)) ?? []), u]);
  const sameFile = [...byHash.values()].filter((l) => l.length > 1);
  check("every card's file exists, and no two different files are the same picture", missing.length === 0 && sameFile.length === 0,
    `${byUrl.size} files${missing.length ? `; missing ${missing.slice(0, 3).join(", ")}` : ""}${sameFile.length ? `; same picture: ${sameFile.slice(0, 3).map((l) => l.join(" = ")).join("; ")}` : ""}`);
  const repointedIn = REPOINTED.filter((c) => byStable.get(c.stableId)?.image_url === c.card);
  const folder = (n) => `/${n.toLowerCase().replace(/ /g, "-")}/`;
  check("the 22 are repointed in the starter DB, each to a new-senior picture of her own nation, none another row's",
    REPOINTED.length === 22 && repointedIn.length === 22 && REPOINTED.every((c) => NEW_SENIOR.some((p) => p.url === c.card && p.nation === byStable.get(c.stableId).nationality) && c.card.includes(folder(c.country)))
      && REPOINTED.every((c) => byUrl.get(c.card)?.length === 1),
    `${repointedIn.length}/22`);
  for (const c of REPOINTED) W.info(`${c.stableId} ${c.name} (${c.country}): ${c.cardBefore25Oct.split("/").pop()} (${world.find((w) => w.image_url === c.cardBefore25Oct)?.name ?? "?"}'s) -> ${c.card.replace("/images/players/new-seniors/", "")}`);
  const maltaPool = pool.filter((p) => p.nationality === "Malta" && world.some((w) => w.image_url === p.image_url));
  check("Malta's two are reported, not given another nation's face: no Malta picture among Rob's new-senior pictures",
    maltaPool.length === 2 && !NEW_SENIOR.some((p) => p.nation === "Malta"), maltaPool.map((p) => `${p.stable_id} ${p.name}`).join(", "));

  // ── 2. The source ─────────────────────────────────────────────────────────
  console.log("\n2. THE SOURCE: A POOL PLAYER'S NAME DOES NOT FOLLOW THE STARTER DB");
  const ensure = SRC("artifacts/api-server/src/utils/ensureSchema.ts");
  const line = ensure.match(/^\s*continental_pool_players: \[[^\]]*\],/m)?.[0] ?? "";
  check("(source) the boot's reference sync updates a pool player's club, not her name, nor her card (25 Oct)",
    /continental_pool_players: \["pool_team_id"\]/.test(line) && !/"name"/.test(line), line.trim());
  check("(source) her card is filled from the starter DB only where a save has none (as her skin tone)",
    /const REFERENCE_FILL_ONLY: Record<string, readonly string\[\]> = \{\s*continental_pool_players: \["skin_tone", "image_url"\],/.test(ensure));
  const ns = SRC("artifacts/api-server/src/utils/newSeniors.ts");
  check("(source) a new senior is never given a picture a pool player, a world-roster player or this career's player carries",
    /for \(const r of tx\.select\(\{ u: continentalPoolPlayersTable\.imageUrl \}\)\.from\(continentalPoolPlayersTable\)\.all\(\)\) if \(r\.u\) used\.add\(r\.u\);/.test(ns)
      && /\.where\(or\(isNull\(playersTable\.originCareerSave\), eq\(playersTable\.originCareerSave, careerSaveId\)\)\)/.test(ns));
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
      cards: q(copy, "SELECT stable_id, image_url FROM continental_pool_players ORDER BY stable_id"),
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
    check("every pool player keeps her card (the 22 repointed in the starter DB too)", hash(before.cards) === hash(after.cards)
      && REPOINTED.every((c) => after.cards.find((x) => x.stable_id === c.stableId)?.image_url === before.cards.find((x) => x.stable_id === c.stableId)?.image_url),
      `pool cards ${hash(before.cards)} -> ${hash(after.cards)}; e.g. EUR_09_P2 ${after.cards.find((x) => x.stable_id === "EUR_09_P2")?.image_url?.split("/").pop()}`);
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

  // 4b. Their pictures: the AI seniors made from the 22 carry them.
  const madeCards = W.q(`SELECT p.image_url u, cp.stable_id s FROM career_player_state st JOIN players p ON p.id = st.player_id
    JOIN continental_pool_players cp ON cp.id = st.pool_player_id WHERE st.career_save_id = ?`, c.cid);
  const fromRepointed = madeCards.filter((m) => REPOINTED.some((r) => r.stableId === m.s));
  check("the AI club seniors made from the 22 carry their new pictures",
    fromRepointed.length === 22 && fromRepointed.every((m) => REPOINTED.find((r) => r.stableId === m.s).card === m.u),
    `${fromRepointed.length} of 22, e.g. ${fromRepointed[0]?.s} ${fromRepointed[0]?.u}`);
  // Planted: every other new-senior picture given already in this career, so the only ones a turn could hand out are
  // the 22 the pool players carry. At the turn, no new senior gets one of them.
  const held = new Set(REPOINTED.map((r) => r.card));
  let k = 0;
  for (const p of NEW_SENIOR.filter((x) => !held.has(x.url))) {
    W.w(`INSERT INTO career_graduate_portraits (career_save_id, player_id, image_url, continent, assigned_on, created_at) VALUES (?, ?, ?, ?, '2026-01-01', strftime('%s', 'now'))`,
      c.cid, -(++k), p.url, p.continent);
  }
  let turned = false;
  for (let i = 0; i < 420 && !turned; i++) {
    const r = await W.day();
    if (r.status >= 400) break;
    turned = !!(r.data?.seasonRollover && r.data.seasonRollover.kind !== "none");
  }
  const arrivals = W.q(`SELECT kind, picture, image_url u FROM career_new_seniors WHERE career_save_id = ?`, c.cid);
  const poolCards = new Set(W.q(`SELECT image_url u FROM continental_pool_players WHERE image_url IS NOT NULL`).map((r) => r.u));
  const worldCards = new Set(W.q(`SELECT image_url u FROM players WHERE origin_career_save_id IS NULL AND image_url IS NOT NULL`).map((r) => r.u));
  const cardClash = arrivals.filter((a) => a.u && (poolCards.has(a.u) || worldCards.has(a.u)));
  check("planted (every other new-senior picture given): at the first turn no new senior gets a pool or world-roster player's picture",
    turned && arrivals.length > 0 && cardClash.length === 0,
    `${k} pictures planted as given; ${arrivals.length} new seniors (${arrivals.filter((a) => a.kind === "picture").length} picture players, ${arrivals.filter((a) => a.picture === "graduate").length} on graduate pictures, ${arrivals.filter((a) => a.picture === "flag").length} on flag cards)${cardClash.length ? `; CLASH ${cardClash.map((a) => a.u).join(", ")}` : ""}`);
} catch (err) {
  W.fail(err);
} finally {
  if (child) await stopServer(child);
  await W.stop();
}
W.finish();
