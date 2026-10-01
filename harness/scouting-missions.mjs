/**
 * Overnight brief 30 Sep, item 13 — scouting missions find youth, by Rob's odds.
 *
 * Rob, 30 Sep: missions target youth only. Found per mission for an average
 * scout: 0 ~12%, 1 ~35%, 2 ~30%, 3 ~15%, 4 ~8%, never more than 4; scout
 * rating and Scouting Department level shift it (top: blank ~5%, more 3-4;
 * weak: blank ~20%); a blank explains itself; found youths are signed (confirm,
 * price shown) or rejected one by one.
 *
 * Asserted:
 *   - the odds module (utils/missionFinds.ts, compiled as the server compiles
 *     it) gives Rob's table exactly for an average scout with a level-1
 *     department; 40,000 rolls each for average, top and weak land on it; the
 *     top blanks ~5% with more 3s and 4s, the weak ~20%; never more than 4;
 *   - on the server (starter-DB copy): a mission cannot go without one of the
 *     club's Scouts; missions come back with 0-4 youths, all 14-18, each priced
 *     $500-$2,000; every collected mission carries its report, a blank one in
 *     Rob's words; signing a youth charges her shown price; rejecting one takes
 *     her off the list.
 * Prints the odds used and the measured rates for the status file.
 *
 * Usage: node harness/scouting-missions.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PORT = 4935;
const BASE = `http://localhost:${PORT}/api`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-missions-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 13: SCOUTING MISSIONS FIND YOUTH, BY ROB'S ODDS");
console.log("=".repeat(72));

const esbuild = createRequire(path.join(REPO, "artifacts", "api-server", "package.json"))("esbuild");
const out = path.join(WORK, "missionFinds.mjs");
esbuild.buildSync({ entryPoints: [path.join(REPO, "artifacts/api-server/src/utils/missionFinds.ts")], outfile: out, format: "esm", bundle: true, logLevel: "silent" });
const { missionQuality, findOdds, rollFound, blankReport, MAX_FOUND } = await import(pathToFileURL(out).href);

const pct = (a) => a.map((x) => `${(x * 100).toFixed(1)}%`).join(" / ");
const ROB = [0.12, 0.35, 0.30, 0.15, 0.08];
const avg = findOdds(missionQuality(60, 1, 1));
check("an average scout (60) with a level-1 department, 1 month: exactly Rob's odds", avg.every((x, i) => Math.abs(x - ROB[i]) < 1e-9), `0/1/2/3/4 found: ${pct(avg)}`);
const cases = [["average (scout 60, dept L1, 1 month)", 60, 1, 1], ["top (scout 90, dept L10, 1 month)", 90, 10, 1], ["weak (scout 30, dept L1, 1 month)", 30, 1, 1],
  ["good scout (75), dept L1", 75, 1, 1], ["average scout, dept L5", 60, 5, 1], ["average scout, 6 months", 60, 1, 6]];
const measured = {};
for (const [name, r, l, m] of cases) {
  const odds = findOdds(missionQuality(r, l, m));
  const n = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 40000; i++) n[rollFound(odds, Math.random())]++;
  measured[name] = n.slice(0, 5).map((x) => x / 40000);
  console.log(`  odds ${name.padEnd(40)} ${pct(odds)}   measured ${pct(measured[name])}   (q ${missionQuality(r, l, m).toFixed(2)})`);
  if (n[5] > 0) check(`never more than ${MAX_FOUND}`, false, name);
}
const A = measured[cases[0][0]], T = measured[cases[1][0]], W = measured[cases[2][0]];
check("40,000 average missions land on Rob's table (within 1 point each)", A.every((x, i) => Math.abs(x - ROB[i]) < 0.01), pct(A));
check("the top scout and department: a blank about 5%, more 3s and 4s", Math.abs(T[0] - 0.05) < 0.01 && T[3] + T[4] > A[3] + A[4] + 0.15, `blank ${(T[0] * 100).toFixed(1)}%, 3-4 ${((T[3] + T[4]) * 100).toFixed(1)}% (average ${((A[3] + A[4]) * 100).toFixed(1)}%)`);
check("a weak scout: a blank about 20%", Math.abs(W[0] - 0.20) < 0.01, `blank ${(W[0] * 100).toFixed(1)}%`);
check("a blank explains itself, in Rob's words", blankReport("Ana Vieira", 14, "Europe") === "Ana Vieira watched 14 players in Europe; none were good enough to recommend.");

// ── On the server ─────────────────────────────────────────────────────────
const dbFile = path.join(WORK, "missions.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { d.prepare(sql).run(...a); } finally { d.close(); } };
let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await res.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: res.status, data };
}
const logFd = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out: logFd,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "missions" } });
try {
  for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const prof = await api("POST", "/profiles", { name: "Missions" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Missions", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const teamId = (await api("GET", "/team")).data?.id;
  w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, teamId);
  const regions = ((await api("GET", "/continental-scouting/regions")).data ?? []).map((r) => r.id ?? r.region?.id).filter(Boolean);

  const noScout = await api("POST", "/continental-scouting/start", { region: regions[0], durationMonths: 1 });
  check("a mission cannot go without one of the club's Scouts", noScout.status === 400 && /Scout/.test(noScout.data?.error ?? ""), `${noScout.status}: ${noScout.data?.error}`);
  const offer = ((await api("GET", "/staff/market?role=scout")).data ?? []).find((m) => /scout/i.test(m.role));
  await api("POST", "/staff", { staffId: offer?.id, length: "2s" });
  const scout = ((await api("GET", "/staff")).data ?? []).find((s) => /^scout$/i.test(s.role));

  const results = [];
  for (let round = 0; round < 4; round++) {
    for (const region of regions) {
      const st = await api("POST", "/continental-scouting/start", { region, durationMonths: 1, staffId: scout.id });
      if (st.status !== 201) { results.push({ error: `${region}: ${st.status} ${st.data?.error}` }); continue; }
      await api("POST", `/continental-scouting/missions/${st.data.id}/dev-complete`);
      const col = await api("POST", `/continental-scouting/missions/${st.data.id}/collect`);
      results.push({ region, found: col.data?.prospectsFound, report: col.data?.report, prospects: col.data?.prospects ?? [], stored: q(`SELECT report FROM continental_scouting_missions WHERE id = ?`, st.data.id)[0]?.report });
    }
  }
  const errs = results.filter((r) => r.error);
  const all = results.filter((r) => !r.error);
  const found = all.map((r) => r.found);
  check(`${all.length} missions (scout ${scout?.name}, scouting ${scout?.scoutingRating}): each found 0-4`, errs.length === 0 && all.length >= 16 && found.every((n) => n >= 0 && n <= 4),
    `found ${found.join(",")}${errs.length ? `; errors ${errs.map((e) => e.error).join("; ")}` : ""}`);
  const youths = all.flatMap((r) => r.prospects);
  check("every find is a youth (14-18) priced $500-$2,000", youths.length > 0 && youths.every((p) => p.age >= 14 && p.age <= 18 && p.signingCost >= 500 && p.signingCost <= 2000),
    `${youths.length} youths; ages ${Math.min(...youths.map((p) => p.age))}-${Math.max(...youths.map((p) => p.age))}; prices $${Math.min(...youths.map((p) => p.signingCost))}-$${Math.max(...youths.map((p) => p.signingCost))}`);
  const blanks = all.filter((r) => r.found === 0);
  check("every mission carries its report; a blank one says how many she watched and that none were good enough",
    all.every((r) => r.report && r.stored === r.report) && blanks.every((r) => new RegExp(`^${scout.name} watched \\d+ players in ${r.region}; none were good enough to recommend\\.$`).test(r.report)),
    blanks.length ? `e.g. "${blanks[0].report}"` : `no blank in ${all.length}; e.g. "${all[0]?.report}"`);

  const [toSign, toReject] = youths;
  const b0 = Number((await api("GET", "/team")).data?.budget);
  // N-44 (b): a find signs through the contract box: a length, the youth team or reserves, and the confirm.
  const signed = await api("POST", `/youth-scouting/prospects/${toSign.id}/sign`, { length: "1s", academyRole: "youth_team", confirm: true });
  const b1 = Number((await api("GET", "/team")).data?.budget);
  check("signing a found youth charges exactly her shown price", signed.status < 300 && b0 - b1 === toSign.signingCost, `HTTP ${signed.status} ${signed.data?.error ?? ""}; -$${b0 - b1} for $${toSign.signingCost}`);
  if (toReject) {
    await api("POST", `/youth-scouting/prospects/${toReject.id}/ignore`);
    const left = ((await api("GET", "/continental-scouting/prospects")).data ?? []);
    const still = (Array.isArray(left) ? left : left.prospects ?? []).some((p) => p.id === toReject.id && p.status === "pending");
    check("rejecting one takes her off the list", !still);
  }
  const page = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/continental-scouting.tsx"), "utf8");
  // Overnight 1 Oct, N-44 (b): Sign opens the shared contract box, whose confirm names her price.
  check("the page: Sign opens the contract box with her price, Reject, the report shown, a Scout must be chosen",
    /<ContractModal\s+player=\{findAsSigning\(prospect\)\}/.test(page) && /Reject/.test(page) && /mission\?\.report/.test(page)
    && /disabled=\{startMission\.isPending \|\| !scouts\.some/.test(page) && !/No scout assigned/.test(page));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(logFd); } catch { /* closed */ }
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
