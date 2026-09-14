/**
 * R-54: the data behind the tier thresholds (Silver 55 / Gold 63).
 *
 * Plays fresh careers season 1 through the real API on a COPY of the starter DB
 * (never a save), then scores every club in every drawn field from
 * world_tour_fixtures with every win counted — Bronze 1, Silver 2, Gold 4,
 * World Semi Final 8, World Final 15 — ranks them by points, then wins, then set
 * difference, and prints the points by finishing position and the threshold
 * pairs that best match "top 4 Gold, 5-10 Silver, 11-19 Bronze".
 *
 * Run 14 Sep 2026 before R-54 changed the server: 12 careers, 10 complete
 * seasons (2 underdogs sacked by the old board), 190 club-seasons. Match results
 * never depended on points, so scoring the fixtures afterwards is exact.
 *
 * Usage: node scripts/r54-tier-thresholds.mjs   (needs the api-server build)
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const REPO = path.join(import.meta.dirname, "..");
const { forkServer, stopServer } = await import(pathToFileURL(path.join(REPO, "harness/server-harness.mjs")).href);
const { requireElectronBinary } = await import(pathToFileURL(path.join(REPO, "harness/electron-binary.mjs")).href);

const work = fs.mkdtempSync(path.join(os.tmpdir(), "r54-tiers-"));
const dbFile = path.join(work, "seasons.sqlite");
const OUT = path.join(work, "r54_seasons.json");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const PORT = 4460, BASE = `http://localhost:${PORT}/api`;
const out = fs.openSync(path.join(work, "server.log"), "w");
const child = forkServer({
  server: path.join(REPO, "artifacts/api-server/dist/index.mjs"), electron: requireElectronBinary(REPO), out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "r54-tiers" },
});
for (let i = 0, up = false; i < 240 && !up; i++) { try { await fetch(`${BASE}/health`); up = true; } catch { await new Promise((r) => setTimeout(r, 250)); } }

function session() {
  let cookie = "";
  return async (method, p, body) => {
    const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
    const t = await res.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
    return { status: res.status, data };
  };
}

const plan = ["established", "underdog", "established", "established", "underdog", "established",
  "established", "underdog", "established", "established", "underdog", "established"];
const careers = [];
try {
  for (const [i, difficulty] of plan.entries()) {
    const api = session();
    const name = `Gate${i + 1}`;
    const prof = await api("POST", "/profiles", { name });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const c = await api("POST", "/careers", { slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: `${name} FC`, originalClubName: `${name} FC`, season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty });
    let outcome = "incomplete";
    for (let day = 0; day < 500; day++) {
      const r = await api("POST", "/calendar/advance", {});
      if (r.status >= 400) { outcome = `advance ${r.status}`; break; }
      if (r.data?.blocked === "pending_match") {
        let sim = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
        if (sim.status >= 400) sim = await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
        if (sim.data?.fired) { outcome = "sacked"; break; }
        continue;
      }
      const roll = r.data?.seasonRollover;
      if (roll && roll.kind !== "none") { outcome = roll.kind; break; }
    }
    careers.push({ name, difficulty, careerSaveId: c.data.id, teamId: c.data.teamId, outcome });
    console.log(`${name} (${difficulty}): ${outcome}`);
  }
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

const POINTS = { "Bronze": 1, "Silver": 2, "Gold": 4, "World Semi Final": 8, "World Final": 15 };
const d = new DatabaseSync(dbFile, { readOnly: true });
const seasons = [];
for (const c of careers.filter((x) => x.outcome === "rolled")) {
  const fixtures = d.prepare(`SELECT round, tier, home_competitor_id AS h, away_competitor_id AS a, home_sets AS hs, away_sets AS aw
    FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = 2026 AND status = 'completed'`).all(c.careerSaveId);
  const clubs = new Map();
  const get = (id) => { if (!clubs.has(id)) clubs.set(id, { id, pts: 0, wins: 0, losses: 0, setDiff: 0 }); return clubs.get(id); };
  for (const f of fixtures) {
    const homeWon = f.hs > f.aw;
    for (const [id, won, sf, sa] of [[f.h, homeWon, f.hs, f.aw], [f.a, !homeWon, f.aw, f.hs]]) {
      const k = get(id);
      k.setDiff += sf - sa;
      if (won) { k.wins++; k.pts += POINTS[f.tier] ?? 0; } else k.losses++;
    }
  }
  const player = d.prepare(`SELECT id FROM competitors WHERE team_id = ?`).get(c.teamId)?.id;
  const table = [...clubs.values()].sort((x, y) => y.pts - x.pts || y.wins - x.wins || y.setDiff - x.setDiff)
    .map((k, i) => ({ rank: i + 1, pts: k.pts, wins: k.wins, losses: k.losses, isPlayer: k.id === player }));
  seasons.push({ career: c.name, difficulty: c.difficulty, table });
}
d.close();
fs.writeFileSync(OUT, JSON.stringify({ careers, seasons }, null, 1));

console.log(`\n${seasons.length} complete seasons, ${seasons.reduce((s, x) => s + x.table.length, 0)} club-seasons (data: ${OUT})`);
const at = (r) => seasons.map((s) => s.table.find((t) => t.rank === r)?.pts).filter((v) => v != null).sort((a, b) => a - b);
const median = (xs) => xs.length ? (xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2) : null;
for (const r of [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 19]) {
  const xs = at(r);
  console.log(`rank ${String(r).padStart(2)}: points median ${median(xs)}, range ${xs[0]}-${xs[xs.length - 1]}  [${xs.join(",")}]`);
}
const wanted = (rank) => (rank <= 4 ? "Gold" : rank <= 10 ? "Silver" : "Bronze");
const best = [];
for (let gold = 10; gold <= 120; gold++) {
  for (let silver = 5; silver < gold; silver++) {
    let hit = 0, n = 0, top4Gold = 0;
    for (const s of seasons) for (const t of s.table) {
      n++;
      const tier = t.pts >= gold ? "Gold" : t.pts >= silver ? "Silver" : "Bronze";
      if (tier === wanted(t.rank)) hit++;
      if (t.rank <= 4 && tier === "Gold") top4Gold++;
    }
    best.push({ gold, silver, acc: hit / n, n, top4Gold });
  }
}
best.sort((a, b) => b.acc - a.acc || a.gold - b.gold);
console.log("\nbest threshold pairs by agreement with (top-4 Gold, 5-10 Silver, 11-19 Bronze):");
for (const b of best.slice(0, 12)) console.log(`  Gold ${b.gold}, Silver ${b.silver}: ${(100 * b.acc).toFixed(1)}% of ${b.n} club-seasons; top-4 clubs Gold ${b.top4Gold}/${seasons.length * 4}`);
