/**
 * Update 1, item 4b (Rob, 14 Oct, C-5 B; docs/UPDATE1-SALARY-CAP-BRIEF.md):
 * the Day 1 draft.
 *
 *   1. a new career has no automatic squad, and the calendar won't move on
 *      from Day 1 until he has 2 or 3 (the screen is not forced: the
 *      Dashboard warns); playing on then closes the draft (Rob, 14 Oct)
 *   2. the draft list holds every senior in the world: the free agents and every
 *      AI club's seniors, each with her rating, nationality, age and wage (10%
 *      less for a Contracts Expert)
 *   3. a pick over the salary cap is refused; more than three, or closing with
 *      fewer than two, too; a pick taken back while the draft is open is a free
 *      undo, and one from an AI club goes back to it (Rob, 14 Oct); after Day 1
 *      a release pays out as normal (the old free first week is gone)
 *   4. he can take an AI club's star, for her wage and no fee; that club then
 *      fills its gap from the free agents
 *   5. no player ends up at two clubs
 *   6. every AI club ends with at least 2 seniors and under the cap (a club that
 *      started a career over it, C-5, keeps its own and adds nobody)
 *   7. a career made before the draft never sees it
 *
 * This suite drives the draft itself, so it creates its careers with a raw
 * POST /careers (not harness-club.mjs startCareer, which drafts for a suite).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-day1-draft-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4987;
const BASE = `http://localhost:${PORT}/api`;
const { MONEY } = await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "money.ts")).href);
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "manager-faces.json"), "utf8"));
const CAP = MONEY.salaryCap.monthlyCap;
const $ = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
const refusal = (after) => `That takes your wages to ${$(after)}. The cap is ${$(CAP)}. Free up ${$(after - CAP)} first.`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UPDATE 1, ITEM 4b: THE DAY 1 DRAFT");
console.log("=".repeat(72));

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
const q = (sql, ...a) => { const d = new DatabaseSync(DB, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(DB); try { return d.prepare(sql).run(...a); } finally { d.close(); } };

async function newCareer(api, name, faceId = 8) {
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  const r = await api("POST", "/careers", { managerFaceId: faceId, slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const teamId = (await api("GET", "/team")).data?.id;
  return { r, teamId, cid: q(`SELECT id FROM career_saves WHERE team_id = ?`, teamId)[0]?.id };
}
const seniorsAt = (cid, teamId) => q(`SELECT s.player_id AS id, s.salary FROM career_player_state s JOIN players p ON p.id = s.player_id
  WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid, teamId);
const aiSquads = (cid) => {
  const rows = q(`SELECT s.pool_team_id AS club, s.player_id AS id, s.salary, s.pool_joined_on AS joined, p.player_type AS ptype FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid);
  const m = new Map();
  for (const r of rows) m.set(r.club, [...(m.get(r.club) ?? []), r]);
  return m;
};
const pick = (api, p, role, length = "1s") => api("POST", "/contracts", { playerId: p.id, salary: p.wage, bonusPerWin: 0, squadRole: role, length, confirm: true });

let child = null;
try {
  fs.copyFileSync(SHIPPED, DB);
  const out = fs.openSync(path.join(WORK, "server.log"), "w");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "day1-draft", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const A = session();

  // ── 1. No automatic squad ──────────────────────────────────────────────────
  console.log("\n1. A NEW CAREER HAS NO AUTOMATIC SQUAD");
  const a = await newCareer(A, "Draft A");
  check("a new career opens with no seniors at the club, and the draft open", a.r.status === 200 && seniorsAt(a.cid, a.teamId).length === 0
    && q(`SELECT day1_draft AS d FROM career_saves WHERE id = ?`, a.cid)[0].d === "open", `${seniorsAt(a.cid, a.teamId).length} seniors`);
  const adv = await A("POST", "/calendar/advance", {});
  check("no day is played until he has drafted", adv.status === 409 && adv.data?.day1Draft === true, `HTTP ${adv.status} ${adv.data?.error}`);
  check("(source) the automatic picks are gone", !fs.existsSync(path.join(REPO, "artifacts", "api-server", "src", "utils", "seedStartingSquad.ts"))
    && !/seedStartingSquad/.test(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "routes", "careers.ts"), "utf8")));

  // ── 2. The list ────────────────────────────────────────────────────────────
  console.log("\n2. THE LIST HOLDS EVERY SENIOR IN THE WORLD");
  const d0 = (await A("GET", "/day1-draft")).data;
  const world = q(`SELECT s.player_id AS id, s.pool_team_id AS club, s.salary FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, a.cid);
  const aiCount = world.filter((p) => p.club != null).length;
  check("every senior in the world is on it: the free agents and every AI club's seniors",
    d0?.open === true && d0.players.length === world.length && world.every((p) => d0.players.some((c) => c.id === p.id)) && aiCount >= 120 && world.length - aiCount > 100,
    `${d0?.players?.length} on the list: ${world.length - aiCount} free agents, ${aiCount} at AI clubs`);
  check("each card has her rating, nationality, age, wage and club (or free agent)",
    d0.players.every((c) => c.rating > 0 && c.nationality && c.age >= 18 && c.wage > 0 && (c.club === null || typeof c.club === "string")));
  check("the wage is her asking wage", d0.players.every((c) => c.wage === Math.round(Number(world.find((p) => p.id === c.id).salary))));
  check("with a running \"Senior wages $X of $60,000\"", d0.wageCap?.seniorWages === 0 && d0.wageCap?.cap === CAP);

  // ── 3. The cap and the numbers ─────────────────────────────────────────────
  console.log("\n3. A PICK OVER THE CAP IS REFUSED; TWO OR THREE ONLY");
  const byWage = [...d0.players].filter((c) => c.club == null).sort((x, y) => y.wage - x.wage);
  const big1 = byWage[0];
  const big2 = byWage.find((c) => c.id !== big1.id && c.wage <= CAP - big1.wage - 1_000);   // leaves little room
  check("(set-up) two dear free agents signed, no fee", (await pick(A, big1, "starter")).status === 201 && (await pick(A, big2, "starter")).status === 201,
    `${big1.name} ${$(big1.wage)}, ${big2.name} ${$(big2.wage)}`);
  const room = CAP - big1.wage - big2.wage;
  const third = [...d0.players].filter((c) => c.club == null && c.id !== big1.id && c.id !== big2.id && c.wage > room).sort((x, y) => x.wage - y.wage)[0];
  const over = await pick(A, third, "interchange");
  check("a pick that would break the cap is refused, in Rob's words", over.status === 422 && over.data?.error === refusal(big1.wage + big2.wage + third.wage),
    `${third.name} ${$(third.wage)}: "${over.data?.error}"`);
  const budget0 = Number((await A("GET", "/team")).data.budget);
  check("no transfer fee on Day 1: the budget is untouched by the picks", q(`SELECT COUNT(*) AS n FROM finance_transactions WHERE team_id = ? AND category = 'signing_fee'`, a.teamId)[0].n === 0);
  await A("POST", `/players/${big2.id}/release`, {});
  check("a pick taken back while the draft is open is an undo: free, and she is back on the list",
    Number((await A("GET", "/team")).data.budget) === budget0 && (await A("GET", "/day1-draft")).data.players.some((c) => c.id === big2.id));
  // Rob, 14 Oct (4b-1): one taken from an AI club goes back to that club, on her wage there.
  const aiPick = [...d0.players].filter((c) => c.club != null && c.wage <= CAP - big1.wage).sort((x, y) => x.wage - y.wage)[0];
  const aiPickWas = world.find((p) => p.id === aiPick.id);
  await pick(A, aiPick, "starter");
  await A("DELETE", `/contracts/${((await A("GET", "/contracts")).data ?? []).find((c) => c.playerId === aiPick.id)?.id}`);
  const aiPickNow = q(`SELECT team_id AS team, pool_team_id AS club, salary FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, a.cid, aiPick.id)[0];
  check("a pick taken back from an AI club goes back to that club, on her wage there, free (Terminate on the Contracts page too)",
    aiPickNow.team == null && aiPickNow.club === aiPickWas.club && Number(aiPickNow.salary) === Number(aiPickWas.salary) && Number((await A("GET", "/team")).data.budget) === budget0,
    `${aiPick.name}: club ${aiPickWas.club} -> ${aiPickNow.club}, ${$(aiPickNow.salary)}`);
  const shortFinish = await A("POST", "/day1-draft/finish", {});
  check("closing with fewer than two is refused", shortFinish.status === 422 && /Pick 2 or 3/.test(shortFinish.data?.error ?? ""), shortFinish.data?.error);
  const shortDay = await A("POST", "/calendar/advance", {});
  check("and the calendar won't move on from Day 1 with fewer than two", shortDay.status === 409 && shortDay.data?.day1Draft === true && /Pick 2 or 3/.test(shortDay.data?.error ?? ""), shortDay.data?.error);
  const shellSrc = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "components", "layout", "shell.tsx"), "utf8");
  const dashSrc = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "dashboard.tsx"), "utf8");
  check("(source) the draft screen is not forced; the Dashboard warns, with a button to it",
    !/day1-draft/.test(shellSrc) && /data-testid="day1-draft-warning"/.test(dashSrc) && /navigate\("\/day1-draft"\)/.test(dashSrc));

  // ── 4. An AI club's star ───────────────────────────────────────────────────
  console.log("\n4. HE CAN TAKE AN AI CLUB'S STAR; HER CLUB FILLS ITS GAP FROM THE FREE AGENTS");
  const list1 = (await A("GET", "/day1-draft")).data;
  const star = [...list1.players].filter((c) => c.club != null && c.wage <= CAP - big1.wage).sort((x, y) => y.rating - x.rating)[0];
  const starClub = world.find((p) => p.id === star.id).club;
  const starBefore = aiSquads(a.cid).get(starClub).map((p) => p.id);
  const took = await pick(A, star, "starter");
  check("he signs an AI club's best senior he can fit, for her wage and no fee",
    took.status === 201 && seniorsAt(a.cid, a.teamId).some((p) => p.id === star.id)
      && q(`SELECT COUNT(*) AS n FROM finance_transactions WHERE category IN ('signing_fee', 'transfer_fee')`)[0].n === 0,
    `${star.name} (${star.rating}) from ${star.club}, ${$(star.wage)}`);
  const finished = await A("POST", "/day1-draft/finish", {});
  check("the draft closes with two", finished.status === 200 && q(`SELECT day1_draft AS d FROM career_saves WHERE id = ?`, a.cid)[0].d === "done", `HTTP ${finished.status} ${finished.data?.error ?? ""}`);
  const starClubNow = aiSquads(a.cid).get(starClub) ?? [];
  const filler = starClubNow.find((p) => !starBefore.includes(p.id));
  check("her club filled its gap from the free agents (she is not there)",
    starClubNow.length >= 2 && !starClubNow.some((p) => p.id === star.id) && !!filler && world.find((p) => p.id === filler.id)?.club == null,
    `club now ${starClubNow.length} seniors, the new one ${filler?.id}`);
  check("and the calendar runs now", (await A("POST", "/calendar/advance", {})).status === 200);
  // After Day 1 the normal release rules apply (the old free first week is gone). 1.1.1 (no dumping):
  // outside the transfer window a senior can't be released at all.
  const release = await A("POST", `/players/${big1.id}/release`, {});
  check("after the draft, a pick can't be released until the transfer window (no dumping)", release.status === 409 && /transfer window/i.test(release.data?.error ?? ""), `HTTP ${release.status} ${release.data?.error ?? ""}`);
  check("the AI managers' faces were dealt after the draft", q(`SELECT COUNT(*) AS n FROM career_pool_team_state WHERE career_save_id = ? AND manager_face_id IS NOT NULL AND manager_name IS NOT NULL`, a.cid)[0].n === 60);

  // ── 5 and 6. The world after ───────────────────────────────────────────────
  console.log("\n5-6. NO PLAYER AT TWO CLUBS; EVERY AI CLUB AT LEAST TWO, UNDER THE CAP");
  const both = q(`SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ? AND team_id IS NOT NULL AND pool_team_id IS NOT NULL`, a.cid)[0].n;
  const livePool = q(`SELECT COUNT(*) AS n FROM pool_player_contracts WHERE career_save_id = ? AND status = 'active'`, a.cid)[0].n;
  check("no player ends up at two clubs (nobody at the player's club and an AI club; no pool contract still live beside a career senior)", both === 0 && livePool === 0, `${both} at two clubs, ${livePool} live pool contracts`);
  const squads = aiSquads(a.cid);
  // A club over the cap must be one that has added nobody (C-5: it keeps its own). 1.1.3 (25 Oct): a youth promoted
  // as cover by a club left with fewer than two is never blocked (C-5) and is not an addition; the AI academies are
  // filled on Day 1 now, so one may be there by the first game day.
  const bad = [...squads.entries()].filter(([, l]) => {
    const signed = l.filter((p) => p.ptype === "senior");
    const bill = signed.reduce((t, p) => t + Number(p.salary), 0);
    return l.length < 2 || (bill > CAP && signed.some((p) => p.joined != null));
  });
  const overStart = [...squads.entries()].filter(([, l]) => l.reduce((t, p) => t + Number(p.salary), 0) > CAP).length;
  check("every AI club has at least 2 seniors, and none is over the cap except one that started over it with its own (C-5)", squads.size === 60 && bad.length === 0,
    `${squads.size} clubs; ${overStart} over the cap with their own seniors only; problems: ${bad.map(([c]) => c).join(",") || "none"}`);

  // ── A Contracts Expert's card ──────────────────────────────────────────────
  const B = session();
  const b = await newCareer(B, "Draft B", MANIFEST.faces.find((f) => f.speciality === "Contracts Expert").id);
  const dB = (await B("GET", "/day1-draft")).data;
  const worldB = new Map(q(`SELECT player_id AS id, salary FROM career_player_state WHERE career_save_id = ?`, b.cid).map((r) => [r.id, Number(r.salary)]));
  check("a Contracts Expert's draft shows every wage 10% lower", dB.players.length > 100 && dB.players.every((c) => c.wage === Math.round(worldB.get(c.id) * 0.9)));
  const cheap3 = [...dB.players].filter((c) => c.club == null).sort((x, y) => x.wage - y.wage).slice(0, 4);
  for (const [i, p] of cheap3.slice(0, 3).entries()) await pick(B, p, i < 2 ? "starter" : "interchange", ["6m", "1s", "2s"][i]);
  const fourth = await pick(B, cheap3[3], "interchange");
  check("he chooses each pick's length (6m / 1s / 2s), and a fourth senior is refused",
    fourth.status === 422 && new Set(q(`SELECT end_date AS e FROM contracts WHERE team_id = ? AND status = 'active'`, b.teamId).map((r) => r.e)).size === 3,
    `fourth: HTTP ${fourth.status} ${fourth.data?.error ?? ""}`);

  // ── 7. An old save ─────────────────────────────────────────────────────────
  // ── Playing on closes the draft (Rob, 14 Oct) ──────────────────────────────
  console.log("\n6b. PLAYING ON FROM DAY 1 CLOSES THE DRAFT");
  const C = session();
  const c = await newCareer(C, "Draft C");
  const dC = (await C("GET", "/day1-draft")).data;
  for (const [i, p] of [...dC.players].filter((x) => x.club == null).sort((x, y) => x.wage - y.wage).slice(0, 2).entries()) await pick(C, p, i < 2 ? "starter" : "interchange");
  const day2 = await C("POST", "/calendar/advance", {});
  const squadsC = aiSquads(c.cid);
  check("with two drafted, the calendar moves on to Day 2 and that closes the draft: the AI clubs fill, the faces are dealt",
    day2.status === 200 && q(`SELECT day1_draft AS d FROM career_saves WHERE id = ?`, c.cid)[0].d === "done" && [...squadsC.values()].every((l) => l.length >= 2)
      && q(`SELECT COUNT(*) AS n FROM career_pool_team_state WHERE career_save_id = ? AND manager_face_id IS NOT NULL`, c.cid)[0].n === 60,
    `HTTP ${day2.status} ${day2.data?.error ?? ""}`);

  console.log("\n7. A CAREER MADE BEFORE THE DRAFT NEVER SEES IT");
  w(`UPDATE career_saves SET day1_draft = NULL WHERE id = ?`, b.cid);
  check("its draft is closed to it, and its calendar runs", (await B("GET", "/day1-draft")).data?.open === false && (await B("POST", "/calendar/advance", {})).status === 200);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  if (child) await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
