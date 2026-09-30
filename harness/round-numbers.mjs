/**
 * Overnight brief 30 Sep, item 27 — one round numbering players see.
 *
 * Rob, 30 Sep: after his 5th match the top bar said "R4/57", the Match Day box
 * "R5", the ledger "Round 15". All three were the same match, in schedule
 * slot 15: the ledger printed the raw slot, and the top bar was a round behind
 * (dateToRound was not the inverse of roundToDate, so on most match days it
 * gave the slot before the match's).
 *
 * Asserted on a starter-DB copy, over a new career's first five matches: on
 * each match day the top bar's round is the Match Day box's round (both from
 * the event's own numbering); after the match it still is; the prize line on
 * the ledger names the same round ("World Tour R5"), and so do the news and
 * the next-match event, never "Round 15". On a copy of Rob's 30 Sep save
 * (skipped when absent) the old prize lines ("Round 11") are renamed at boot.
 * The Matches page shows the event's round, not the slot.
 *
 * Usage: node harness/round-numbers.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const ROB = path.join(os.homedir(), "Downloads", "volleyball-empire-backup-30sep-0921.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PORT = 4939;
const BASE = `http://localhost:${PORT}/api`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-rounds-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 27: ONE ROUND NUMBERING PLAYERS SEE");
console.log("=".repeat(72));

let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await res.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: res.status, data };
}
async function withServer(dbFile, log, fn) {
  const fd = fs.openSync(path.join(WORK, log), "w");
  const child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out: fd,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "rounds", STARTER_DB_PATH: SHIPPED } });
  try {
    for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
    await fn();
  } finally { try { await stopServer(child); } catch { /* stopped */ } try { fs.closeSync(fd); } catch { /* closed */ } }
}

try {
  const dbFile = path.join(WORK, "rounds.sqlite");
  fs.copyFileSync(SHIPPED, dbFile);
  await withServer(dbFile, "server.log", async () => {
    const prof = await api("POST", "/profiles", { name: "Rounds" });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
    await api("POST", "/careers", { slotNumber: 1, managerName: "Rounds", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
      budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
    const names = (await api("GET", "/calendar/round-names")).data?.names ?? {};
    const topRound = (cal) => /R(\d+)\//.exec(cal?.seasonPhase?.label ?? "")?.[1];
    const rows = [];
    for (let n = 0; n < 5; n++) {
      healAllSquads(dbFile);
      const md = (await api("POST", "/calendar/next-match")).data?.matchDay;
      const cal = (await api("GET", "/calendar")).data;
      const slot = cal?.pendingMatch?.round ?? md?.round;
      const box = names[String(slot)]?.name;
      const onDay = topRound(cal);
      const events = (await api("GET", "/events/upcoming")).data;
      await api("POST", `/matches/${md.matchId}/simulate`);
      await api("POST", "/calendar/dismiss-match");
      const after = topRound((await api("GET", "/calendar")).data);
      rows.push({ slot, box, onDay, after, events });
    }
    const ok = rows.every((r) => r.box === `World Tour R${r.onDay}` && r.after === r.onDay);
    check("on each of the first five match days the top bar shows the Match Day box's round, and still does after the match",
      rows.length === 5 && ok, rows.map((r) => `slot ${r.slot}: box "${r.box}", bar R${r.onDay} -> R${r.after}`).join(" | "));
    const prize = ((await api("GET", "/finances")).data ?? []).filter((t) => t.category === "prize_money").map((t) => t.description);
    check("the ledger's prize lines name the event's round, never the slot", prize.length > 0 && prize.every((d) => /World Tour R\d+ vs /.test(d) && !/Round \d+/.test(d)), prize.slice(0, 3).join(" | "));
    const news = ((await api("GET", "/news")).data?.items ?? []).filter((i) => i.type === "result");
    check("the news names it the same way", news.length > 0 && news.every((i) => /^World Tour R\d+/.test(i.detail)), news.slice(0, 2).map((i) => i.detail).join(" | "));
    const ev = JSON.stringify((await api("GET", "/events/upcoming")).data ?? {});
    check("and so does the next-match event", !/"Round \d+/.test(ev), ev.slice(0, 160));
  });

  if (!fs.existsSync(ROB)) console.log(`  NOTE  ${ROB} not on this machine: the rename check is skipped`);
  else {
    const robFile = path.join(WORK, "rob.sqlite");
    fs.copyFileSync(ROB, robFile);
    const q = () => { const d = new DatabaseSync(robFile, { readOnly: true }); try { return d.prepare(`SELECT description FROM finance_transactions WHERE category = 'prize_money' ORDER BY id`).all().map((r) => r.description); } finally { d.close(); } };
    const before = q();
    await withServer(robFile, "rob.log", async () => { await new Promise((r) => setTimeout(r, 800)); });
    const after = q();
    check("Rob's save: his old prize lines are renamed to the event's round at boot",
      before.some((d) => /Round 11 vs/.test(d)) && after.every((d) => !/Round \d+ vs/.test(d)) && after.some((d) => /World Tour R1 vs/.test(d)),
      `${before[0]}  ->  ${after[0]}`);
  }

  const page = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/matches.tsx"), "utf8");
  check("the Matches page shows the event's round, not the slot", !/\{match\.round\}<\/span>/.test(page) && !/`Round \$\{match\.round\}/.test(page) && (page.match(/roundName\(match\.round, "round"\)/g) ?? []).length === 2);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
