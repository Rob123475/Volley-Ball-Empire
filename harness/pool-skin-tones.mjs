/**
 * R-75 — pool pairs' skin tones come from their nation's own distribution.
 *
 * Pool players had no skin tone at all: continental_pool_players had no column
 * for one, and the court never showed them (the away side was two stand-in free
 * agents, R-73). Each pool player now has a tone drawn from her nation's own
 * tone counts among the seeded players. If her nation has no seeded player, the
 * draw uses her continent's counts. There is no hand-made nation→tone table
 * (scripts/src/seed-pool-skin-tones.ts).
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   data     every pool player has one of the five bands the court knows
 *   derived  re-running the seed script's draw against the shipped DB changes
 *            nothing: the stored tones are exactly the counted distribution's
 *            draw, not hand-edited
 *   court    after the World Tour draw, every away pool pair's skinTone in
 *            /unity/match-state is her stored tone, never null
 *   old save a save from before the column gets every tone on boot
 *
 * Usage: node harness/pool-skin-tones.mjs
 */
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-pool-tones-"));
const PORT = 4890;
const BASE = `http://localhost:${PORT}/api`;
const BANDS = ["Light", "Medium Light", "Medium", "Medium Dark", "Dark"];

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-75 POOL PAIRS' SKIN TONES FROM THEIR NATION'S DISTRIBUTION");
console.log("=".repeat(72));

// ── 0. Data ─────────────────────────────────────────────────────────────────
console.log("\n0. EVERY POOL PLAYER HAS A TONE THE COURT KNOWS");
const pool = (() => {
  const d = new DatabaseSync(SHIPPED, { readOnly: true });
  const rows = d.prepare("SELECT id, pool_team_id, name, nationality, skin_tone FROM continental_pool_players ORDER BY pool_team_id, id").all();
  d.close();
  return rows;
})();
const banded = pool.filter((p) => BANDS.includes(p.skin_tone));
check("every pool player has one of the five bands", pool.length === 120 && banded.length === 120, `${banded.length} of ${pool.length}`);
const pairs = new Map();
for (const p of pool) pairs.set(p.pool_team_id, [...(pairs.get(p.pool_team_id) ?? []), p]);
const sameNation = [...pairs.values()].filter((t) => t.length === 2 && t[0].nationality === t[1].nationality);
const sameTone = sameNation.filter((t) => t[0].skin_tone === t[1].skin_tone).length;
console.log(`  REPORT  ${sameNation.length} of ${pairs.size} pairs share a nationality; ${sameTone} of those share a tone; bands ${BANDS.map((b) => `${b} ${pool.filter((p) => p.skin_tone === b).length}`).join(", ")}`);

console.log("\n1. THE STORED TONES ARE THE COUNTED DISTRIBUTION'S OWN DRAW");
{
  const copy = path.join(WORK, "rederive.sqlite");
  fs.copyFileSync(SHIPPED, copy);
  const r = spawnSync("npx", ["tsx", "src/seed-pool-skin-tones.ts", copy], {
    cwd: path.join(REPO, "scripts"), encoding: "utf8", shell: true, env: { ...process.env, ELECTRON_RUN_AS_NODE: "" },
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const m = /R-75 tones: (\d+) of (\d+) pool players; (\d+) changed/.exec(out);
  const cont = /continent's distribution \(nation had no seeded player\): (\d+)/.exec(out);
  check("re-running the draw against the shipped DB changes nothing", r.status === 0 && !!m && m[1] === "120" && m[3] === "0",
    m ? `${m[1]} of ${m[2]} drawn, ${m[3]} changed; ${cont?.[1] ?? "?"} from the continent's distribution` : out.slice(-400));
}

if (!fs.existsSync(SERVER)) { console.error(`[pool-skin-tones] FAILED: ${SERVER} not built.`); process.exit(1); }

function session() {
  let cookie = "";
  return async function api(method, p, body) {
    const res = await fetch(BASE + p, {
      method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

async function boot(dbFile, label, extraEnv = {}) {
  const logFile = path.join(WORK, `${label}.log`);
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "pool-tones", ...extraEnv },
  });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { async stop() { await stopServer(child); try { fs.closeSync(out); } catch { /* closed */ } } };
}

const dbFile = path.join(WORK, "tones.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
let srv = await boot(dbFile, "tones");
try {
  console.log("\n2. THE COURT'S AWAY PAIR CARRIES HER STORED TONE");
  const api = session();
  const prof = await api("POST", "/profiles", { name: "Tones" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? [])[0];
  await api("POST", "/careers", {
    slotNumber: 1, managerName: "Tones", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "underdog", primaryColor: "#223344", secondaryColor: "#FFFFFF", crestShapeIndex: 0,
  });
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const cid = d.prepare("SELECT id FROM career_saves ORDER BY id DESC LIMIT 1").get().id;
  const drawn = () => d.prepare("SELECT COUNT(*) AS n FROM world_tour_fixtures WHERE career_save_id = ? AND match_id IS NOT NULL").get(cid).n;
  for (let day = 0; day < 90 && drawn() === 0; day++) await api("POST", "/calendar/advance", {});
  const matches = ((await api("GET", "/matches/fixture")).data ?? []).filter((m) => m.status !== "bye" && m.round >= 11 && m.round <= 70);
  const toneOf = d.prepare("SELECT skin_tone FROM continental_pool_players WHERE id = ?");
  let away = 0, exact = 0;
  const wrong = [];
  for (const m of matches) {
    const r = await api("GET", `/unity/match-state?matchId=${m.id}`);
    for (const p of (r.data?.players ?? []).slice(2)) {
      away++;
      const stored = p.source === "pool" ? toneOf.get(p.id)?.skin_tone : undefined;
      if (stored && p.skinTone === stored) exact++; else wrong.push(`${p.name} sent ${p.skinTone}, stored ${stored}`);
    }
  }
  d.close();
  check("every away pool player's skinTone is her stored tone, never null", away > 0 && exact === away, wrong.slice(0, 3).join("; ") || `${exact} of ${away} across ${matches.length} matches`);

  console.log("\n3. A SAVE FROM BEFORE THE COLUMN GETS EVERY TONE ON BOOT");
  await srv.stop();
  const oldFile = path.join(WORK, "old.sqlite");
  fs.copyFileSync(SHIPPED, oldFile);
  { const w = new DatabaseSync(oldFile); w.exec("ALTER TABLE continental_pool_players DROP COLUMN skin_tone"); w.close(); }
  srv = await boot(oldFile, "old", { STARTER_DB_PATH: SHIPPED });
  await srv.stop();
  const o = new DatabaseSync(oldFile, { readOnly: true });
  const got = o.prepare("SELECT id, skin_tone FROM continental_pool_players ORDER BY id").all();
  o.close();
  const byId = new Map(pool.map((p) => [p.id, p.skin_tone]));
  const same = got.filter((g) => g.skin_tone && g.skin_tone === byId.get(g.id)).length;
  check("the column is added and every tone is brought forward from the starter DB", same === 120, `${same} of 120`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await srv.stop(); } catch { /* stopped */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
