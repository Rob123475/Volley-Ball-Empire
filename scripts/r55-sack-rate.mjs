/**
 * R-55: how often the board sacks a club that does nothing but play.
 *
 * More careers than the rollover arc's three per difficulty, walked the same
 * way (renew every season on the same terms, play every match through
 * /simulate, no signings, no training) through four season reviews — the
 * reviews that can sack; season 5's is a verdict. Runs on a COPY of the
 * starter DB and prints every review and the sack rate per difficulty.
 *
 * Usage: node scripts/r55-sack-rate.mjs [careersPerDifficulty=8]   (needs the api-server build)
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const REPO = path.join(import.meta.dirname, "..");
const PER = Number(process.argv[2] ?? 8);
const { forkServer, stopServer } = await import(pathToFileURL(path.join(REPO, "harness/server-harness.mjs")).href);
const { requireElectronBinary } = await import(pathToFileURL(path.join(REPO, "harness/electron-binary.mjs")).href);

const work = fs.mkdtempSync(path.join(os.tmpdir(), "r55-sack-rate-"));
const dbFile = path.join(work, "sack-rate.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const PORT = 4462, BASE = `http://localhost:${PORT}/api`;
const out = fs.openSync(path.join(work, "server.log"), "w");
const child = forkServer({
  server: path.join(REPO, "artifacts/api-server/dist/index.mjs"), electron: requireElectronBinary(REPO), out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "r55-sack-rate" },
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
async function renew(api) {
  const season = (await api("GET", "/seasons/current")).data;
  const contracts = (await api("GET", "/contracts")).data;
  if (!season?.endDate || !Array.isArray(contracts)) return;
  for (const c of contracts.filter((k) => k.endDate <= season.endDate)) await api("POST", `/contracts/${c.id}/renew`);
}
/** One season: returns { review, sacked, why }. */
async function season(api) {
  await renew(api);
  for (let i = 0; i < 500; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) throw new Error(`advance ${r.status} ${JSON.stringify(r.data)}`);
    if (r.data?.blocked === "pending_match") {
      let played = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      if (played.status >= 400) played = await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
      if (played.data?.fired) return { review: null, sacked: true, why: "abandonment" };
      continue;
    }
    const roll = r.data?.seasonRollover;
    if (roll && roll.kind !== "none") return { review: roll.review, sacked: roll.kind === "sacked", why: roll.kind === "sacked" ? "review" : null };
  }
  throw new Error("no boundary");
}

const careers = [];
try {
  for (const difficulty of ["established", "underdog"]) {
    for (let k = 1; k <= PER; k++) {
      const api = session();
      const name = `${difficulty === "established" ? "Est" : "Und"}${k}`;
      const prof = await api("POST", "/profiles", { name });
      await api("POST", `/profiles/${prof.data.id}/select`);
      await api("POST", "/careers", { slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: `${name} FC`, originalClubName: `${name} FC`, season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty });
      const reviews = [];
      let sacked = null;
      for (let n = 1; n <= 4; n++) {
        const s = await season(api);
        if (s.review) reviews.push(s.review);
        if (s.sacked) { sacked = { season: n, why: s.why }; break; }
      }
      const line = reviews.map((r) => `S${seasonOf(r)} R${r.strengthRank} #${r.finish} ${r.grade} ${r.confidenceAfter}${r.strikes ? ` (${r.strikes} strike)` : ""}`).join(" | ");
      console.log(`${name.padEnd(6)} ${line}${sacked ? `  ->  SACKED (${sacked.why}) in season ${sacked.season}` : ""}`);
      careers.push({ name, difficulty, reviews, sacked });
    }
  }
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}
function seasonOf(r) { return r.seasonYear - 2025; }

console.log("");
for (const difficulty of ["established", "underdog"]) {
  const arc = careers.filter((c) => c.difficulty === difficulty);
  const all = arc.flatMap((c) => c.reviews);
  const count = (g) => all.filter((r) => r.grade === g).length;
  const sacked = arc.filter((c) => c.sacked);
  const finishes = all.map((r) => r.finish).sort((a, b) => a - b);
  console.log(`${difficulty}: sacked in ${sacked.length} of ${arc.length} careers over four reviews (${Math.round(100 * sacked.length / arc.length)}%)` +
    `; ${all.length} seasons reviewed: ${count("met")} met, ${count("below")} below, ${count("failed")} failed; finishes ${finishes.join(",")}`);
}
fs.writeFileSync(path.join(work, "r55-sack-rate.json"), JSON.stringify(careers, null, 1));
console.log(`data: ${path.join(work, "r55-sack-rate.json")}`);
