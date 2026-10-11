/**
 * Serve brief 11 Oct, item 3: how quickly can a player's serve reach the ace
 * ability (95)? Measured, not guessed.
 *
 * Boots the built api-server on a COPY of the starter DB, makes a new Sydney
 * Riptide career and trains its best server, Yaritza Mendez (serve 88 at the
 * start, the best national senior), with the Serving Academy back to back,
 * the way a player who wants the ace would: a new 5-day session the day the
 * last one finishes, every match simulated as it comes. Records her serve each
 * time it changes, the game date she reaches 95, and her age then. Also reads
 * the serve /unity/match-state sends for her before and after, to show the
 * court gets the career's current rating, not the starter value.
 *
 * Usage: node scripts/webgl-proof/serve-growth-measure.mjs <out.json> [maxDays]
 */
import { fork } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const REPO = path.resolve(import.meta.dirname, "..", "..");
const out = path.resolve(process.argv[2] ?? "serve-growth.json");
const MAX_DAYS = Number(process.argv[3] ?? 900);
const ELECTRON = path.join(REPO, "node_modules/electron/dist/electron.exe");
const SERVER = path.join(REPO, "artifacts/api-server/dist/index.mjs");
const PORT = 4231, BASE = `http://localhost:${PORT}/api`;
const TARGET = 95;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = fs.mkdtempSync(path.join(os.tmpdir(), "serve-growth-"));
const dbFile = path.join(work, "save.sqlite");
fs.copyFileSync(path.join(REPO, "lib/db/volleyball-empire.sqlite"), dbFile);
const log = fs.openSync(path.join(work, "server.log"), "w");
const server = fork(SERVER, [], {
  execPath: ELECTRON,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "development", DB_PATH: dbFile, PORT: String(PORT), SESSION_SECRET: "serve-growth", VBE_STAFF_ABSENCES: "off" },
  stdio: ["ignore", log, log, "ipc"],
});
let cookie = "";
const api = async (m, p, b) => {
  const r = await fetch(BASE + p, { method: m, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await r.text(); try { return { status: r.status, data: JSON.parse(t) }; } catch { return { status: r.status, data: t }; }
};
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const result = { player: null, start: null, steps: [], reached: null, sessions: 0, matchesSimulated: 0, courtServeBefore: null, courtServeAfter: null };

try {
  for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await sleep(250); }
  const prof = await api("POST", "/profiles", { name: "Serve Growth" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = (await api("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Serve Growth", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const cid = q(`SELECT id FROM career_saves ORDER BY id DESC LIMIT 1`)[0].id;
  const squad = (await api("GET", "/players")).data;
  const her = squad.reduce((a, b) => (b.serve > a.serve ? b : a));
  const potential = q(`SELECT potential FROM players WHERE id = ?`, her.id)[0]?.potential ?? null;
  result.player = { id: her.id, name: her.name, age: her.age, potential };
  const today = async () => (await api("GET", "/calendar")).data?.currentDate;
  result.start = { date: await today(), serve: her.serve };
  const courtServe = async () => {
    const fx = ((await api("GET", "/matches/fixture")).data ?? []).find((m) => m.status === "scheduled");
    if (!fx) return null;
    const ms = (await api("GET", `/unity/match-state?matchId=${fx.id}`)).data;
    return (ms?.players ?? []).find((p) => p.name === her.name)?.serve ?? "(not in the pair)";
  };
  result.courtServeBefore = await courtServe();

  let serve = her.serve, running = false;
  for (let d = 0; d < MAX_DAYS && serve < TARGET; d++) {
    if (!running) {
      const s = await api("POST", "/training", { playerId: her.id, type: "Serving Academy", durationHours: 2 });
      if (s.status === 201) { running = true; result.sessions++; }
    }
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") {
      await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {}); await api("POST", "/calendar/skip-match", {}); result.matchesSimulated++;
    } else if (r.data?.matchDay?.matchId) {
      await api("POST", `/matches/${r.data.matchDay.matchId}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); result.matchesSimulated++;
    }
    const open = ((await api("GET", "/training")).data ?? []).filter((s) => s.playerId === her.id && s.status === "scheduled");
    running = open.length > 0;
    const now = q(`SELECT serve, age FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, her.id)[0];
    if (now.serve !== serve) { serve = now.serve; result.steps.push({ date: await today(), serve, age: now.age, sessions: result.sessions }); }
  }
  if (serve >= TARGET) {
    const last = result.steps[result.steps.length - 1];
    const days = Math.round((Date.parse(last.date) - Date.parse(result.start.date)) / 86400000);
    result.reached = { date: last.date, days, age: last.age, sessions: result.sessions };
  }
  // Put her in the pair (the others to Interchange), so the court's read includes her.
  for (const p of (await api("GET", "/players")).data) if (p.id !== her.id && p.squadRole === "starter") await api("PATCH", `/team/roster/${p.id}/role`, { role: "interchange" });
  await api("PATCH", `/team/roster/${her.id}/role`, { role: "starter" });
  result.courtServeAfter = await courtServe();
} catch (e) {
  result.error = String(e?.stack ?? e);
} finally {
  try { server.send({ type: "shutdown" }); } catch { /* gone */ }
  await sleep(1500);
  try { server.kill(); } catch { /* gone */ }
}
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
