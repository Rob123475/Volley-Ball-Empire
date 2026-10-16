/**
 * 1.1.1, Part 9: a genuine 1.1.0 save to load with 1.1.1, made by the 1.1.0
 * package's own server (never Rob's save). The packaged 1.1.0 exe runs as Node
 * on a copy of its own starter database; a career is started (Day 1 draft), a
 * Scout hired, an academy youth loaned out and the calendar advanced past the
 * AI clubs' staff day and some matches. The database is checkpointed and copied
 * to <out>.
 *
 * Usage: node scripts/make-110-save.mjs "C:/build/vbe-1.1.0/win-unpacked" <out.sqlite> [days]
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { forkServer, stopServer } from "../harness/server-harness.mjs";
import { startCareer } from "../harness/harness-club.mjs";

const [root, outFile, daysArg] = process.argv.slice(2);
const DAYS = Number(daysArg ?? 45);
const EXE = path.join(root, "Beach Volleyball Empire.exe");
const SERVER = path.join(root, "resources", "server", "dist", "index.mjs");
const STARTER = path.join(root, "resources", "starter-db", "volleyball-empire.sqlite");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-110-save-"));
const db = path.join(work, "save.sqlite");
fs.copyFileSync(STARTER, db);
const PORT = 4991, BASE = `http://localhost:${PORT}/api`;
let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await res.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: res.status, data };
}
const out = fs.openSync(path.join(work, "server.log"), "w");
const child = forkServer({ server: SERVER, electron: EXE, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(PORT), NODE_ENV: "production", SESSION_SECRET: "save-110", STARTER_DB_PATH: STARTER } });
try {
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const prof = await api("POST", "/profiles", { name: "Save 1.1.0" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "Save 110", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", gameDifficulty: "medium", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const scout = ((await api("GET", "/staff/market?role=scout")).data ?? []).find((m) => /scout/i.test(m.role));
  if (scout) await api("POST", "/staff", { staffId: scout.id, length: "1s" });
  let matches = 0;
  for (let i = 0; i < DAYS; i++) {
    const r = await api("POST", "/calendar/advance", {});
    const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
    if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", r.data?.blocked === "pending_match" ? "/calendar/skip-match" : "/calendar/dismiss-match"); matches++; }
  }
  const today = (await api("GET", "/calendar")).data?.currentDate;
  const team = (await api("GET", "/team")).data;
  console.log(JSON.stringify({ version: "1.1.0 package", today, team: team?.name, budget: team?.budget, matches, scout: scout?.name ?? null }));
} finally {
  await stopServer(child);
  fs.closeSync(out);
}
fs.copyFileSync(db, outFile);
console.log(`saved ${outFile} (${fs.statSync(outFile).size} bytes); work ${work}`);
