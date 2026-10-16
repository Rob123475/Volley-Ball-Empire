/**
 * Update 1, item 2 (Rob, 13-14 Oct; docs/UPDATE1-MANAGERS-BRIEF.md): manager
 * faces and specialities.
 *
 *   1. installed   all 69 faces (61, and Rob's 8 spares of 14 Oct) are in
 *                  public/images/managers, 600 x 800 WebP; the Jamaican "(1)"
 *                  duplicate is not; the manifest has one row per face, the
 *                  names file's name on each, eight specialities each used 8-9
 *                  times with men and women in every one
 *   2. new career  the player's chosen face is stored; all 60 AI clubs have a
 *                  face, named by it; no face is used twice; the faces left over
 *                  are out of work from the first day; no face, no career
 *   3. deals       two new careers get different AI deals; each deal survives a
 *                  restart; a career made before the faces is dealt them once at
 *                  boot, and never again
 *   4. specialities each of the eight moves its number by its amount for the
 *                  player's club, and an AI manager's speciality is not used
 *   5. sacking     a club whose manager was sacked appoints the free face out of
 *                  work longest, never the one it sacked; no face used twice
 *   6. pronouns    a job offer over a man's face says "him", over a woman's "her"
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, renewExpiringContracts, keepSideFielded, trainThroughCalendar, makeCapRoom, startCareer, freeSquadPlace } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-manager-faces-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4981;
const BASE = `http://localhost:${PORT}/api`;
const FACES_DIR = path.join(REPO, "artifacts", "beach-volleyball", "public", "images", "managers");
const MANIFEST = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "manager-faces.json"), "utf8"));
const NAMES = JSON.parse(fs.readFileSync(path.join(REPO, "docs", "manager-face-names.json"), "utf8"));
const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const { potentialMultiplier } = await import(pathToFileURL(path.join(REPO, "artifacts", "api-server", "src", "utils", "potential.ts")).href);
const { RESERVE_COURT_SHARE } = await import(pathToFileURL(path.join(REPO, "artifacts", "api-server", "src", "utils", "squadRules.ts")).href);
const sharp = createRequire(import.meta.url)(path.join(REPO, "scripts", "node_modules", "sharp"));

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const $ = (n) => "$" + Math.round(Number(n)).toLocaleString("en-US");
console.log("=".repeat(72));
console.log("  UPDATE 1, ITEM 2: MANAGER FACES AND SPECIALITIES");
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

const FACES = MANIFEST.faces;
const byId = new Map(FACES.map((f) => [f.id, f]));
const faceOf = (speciality, not = []) => FACES.find((f) => f.speciality === speciality && !not.includes(f.id));
const BASELINE = 8;   // the harness's face (a Fitness Guru), as every suite's career has

let child = null;
async function start() {
  const out = fs.openSync(path.join(WORK, "server.log"), "a");
  child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "manager-faces", STARTER_DB_PATH: SHIPPED } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) return; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
}
async function restart() { await stopServer(child); child = null; await start(); }

/** Each AI club's manager face in a career, by club. */
const dealOf = (cid) => new Map(q(`SELECT pool_team_id AS club, manager_face_id AS face FROM career_pool_team_state WHERE career_save_id = ? ORDER BY pool_team_id`, cid).map((r) => [r.club, r.face]));
/** The faces in post in a career: the player's and every AI manager's. */
function inPost(cid) {
  const mine = q(`SELECT manager_face_id AS f FROM career_saves WHERE id = ?`, cid)[0]?.f;
  const ai = q(`SELECT manager_face_id AS f FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL AND manager_name IS NOT NULL`, cid).map((r) => r.f);
  return [mine, ...ai];
}
const setFace = (cid, faceId) => w(`UPDATE career_saves SET manager_face_id = ? WHERE id = ?`, faceId, cid);

async function newCareer(api, name, faceId) {
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  const body = { slotNumber: 1, managerName: name, managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 };
  const r = await startCareer(api, faceId == null ? body : { ...body, managerFaceId: faceId });
  const team = (await api("GET", "/team")).data;
  const cid = team?.id != null ? q(`SELECT id FROM career_saves WHERE team_id = ?`, team.id)[0]?.id : null;
  return { r, team, cid };
}

async function day(api) {
  const r = await api("POST", "/calendar/advance", {});
  const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
  if (id) { await api("POST", `/matches/${id}/simulate`); await api("POST", "/calendar/dismiss-match"); }
  return r;
}

try {
  // ── 1. Installed ───────────────────────────────────────────────────────────
  console.log("\n1. THE FACES ARE INSTALLED");
  const files = fs.readdirSync(FACES_DIR).filter((f) => f.endsWith(".webp")).sort();
  const nameKeys = Object.keys(NAMES).filter((k) => !k.startsWith("_"));
  check("the manifest has one row per face, 69 (Rob's 61 and his 8 spares), with ids 1-69",
    FACES.length === 69 && FACES.every((f, i) => f.id === i + 1) && nameKeys.length === 69, `${FACES.length} rows, ${nameKeys.length} names`);
  check("the folder holds exactly the manifest's 69 files", files.length === 69 && FACES.every((f) => files.includes(path.basename(f.file))), `${files.length} files`);
  const sizes = await Promise.all(FACES.map(async (f) => { const m = await sharp(path.join(REPO, "artifacts", "beach-volleyball", "public", f.file)).metadata(); return `${m.format} ${m.width}x${m.height}`; }));
  const kb = FACES.map((f) => fs.statSync(path.join(REPO, "artifacts", "beach-volleyball", "public", f.file)).size / 1024);
  check("every face is a 600 x 800 WebP, and small (not the 5 MB source)", sizes.every((s) => s === "webp 600x800") && Math.max(...kb) < 200,
    `${[...new Set(sizes)].join(", ")}; largest ${Math.round(Math.max(...kb))} KB`);
  const hashes = new Set(FACES.map((f) => crypto.createHash("sha1").update(fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "public", f.file))).digest("hex")));
  check("the Jamaican \"(1)\" duplicate is not installed: one 39-year-old Jamaican woman, and no two faces the same picture",
    FACES.filter((f) => f.nationality === "Jamaica" && f.age === 39 && f.gender === "female").length === 1 && hashes.size === 69);
  check("35 women and 34 men", FACES.filter((f) => f.gender === "female").length === 35 && FACES.filter((f) => f.gender === "male").length === 34);
  check("each face carries the name the names file gives it",
    nameKeys.every((k) => FACES.some((f) => f.name === NAMES[k])) && new Set(FACES.map((f) => f.name)).size === 69);
  const specs = MANIFEST.specialityOrder;
  const perSpec = specs.map((s) => FACES.filter((f) => f.speciality === s));
  check("eight specialities, dealt round-robin in the brief's order, each used 8-9 times with men and women in every one",
    specs.length === 8 && FACES.every((f, i) => f.speciality === specs[i % 8]) && perSpec.every((l) => l.length >= 8 && l.length <= 9 && l.some((f) => f.gender === "male") && l.some((f) => f.gender === "female")),
    perSpec.map((l, i) => `${specs[i]} ${l.length}`).join(", "));

  fs.copyFileSync(SHIPPED, DB);
  await start();
  const A = session(), B = session(), C = session();

  // ── 2. A new career ────────────────────────────────────────────────────────
  console.log("\n2. A NEW CAREER: THE PLAYER'S FACE, AND THE AI CLUBS' DEAL");
  const noProfile = (await fetch(`${BASE}/manager-faces`)).status;
  const noFace = await newCareer(A, "Faces A", null);
  check("a career without a face is refused (the wizard always sends one)", noFace.r.status === 400 && /managerFaceId/.test(noFace.r.data?.error ?? ""), `HTTP ${noFace.r.status} ${noFace.r.data?.error}`);
  const list = (await A("GET", "/manager-faces")).data?.faces ?? [];
  check("GET /manager-faces gives all 69 faces, each with its speciality and effect, to a profile only",
    list.length === 69 && list.every((f) => f.image === `/${byId.get(f.id).file}` && f.speciality === byId.get(f.id).speciality && f.effect.length > 10) && noProfile === 401,
    `${list.length}; e.g. ${list[0]?.speciality}: ${list[0]?.effect}; no profile: HTTP ${noProfile}`);
  const a = await newCareer(A, "Faces A", BASELINE);
  const cidA = a.cid;
  const saveA = q(`SELECT manager_face_id AS f, manager_name AS n FROM career_saves WHERE id = ?`, cidA)[0];
  check("the player's chosen face is stored on the career, and the name stays the one typed", a.r.status < 300 && saveA?.f === BASELINE && saveA?.n === "Faces A", JSON.stringify(saveA));
  const clubsA = q(`SELECT pool_team_id AS club, manager_face_id AS face, manager_name AS name FROM career_pool_team_state WHERE career_save_id = ?`, cidA);
  check("all 60 AI clubs have a face, and each manager's name is the face's",
    clubsA.length === 60 && clubsA.every((c) => c.face != null && byId.get(c.face)?.name === c.name), `${clubsA.length} clubs; e.g. ${clubsA[0]?.name}`);
  const postA = inPost(cidA);
  check("no face is used twice (the player's and the 60 AI managers': 61 different faces)", new Set(postA).size === 61 && postA.length === 61);
  const freeA = q(`SELECT face_id AS f, out_of_work_since AS since FROM career_manager_faces WHERE career_save_id = ?`, cidA);
  check("the 8 faces left over are out of work from the career's first day",
    freeA.length === 8 && freeA.every((r) => r.since === "2026-01-01" && !postA.includes(r.f)), freeA.map((r) => `${r.f}@${r.since}`).join(", "));
  const slot = ((await A("GET", "/careers")).data?.saves ?? [])[0];
  check("the save slot card gets the manager's face and speciality", slot?.manager?.faceId === BASELINE && slot?.manager?.image === `/${byId.get(BASELINE).file}` && slot?.manager?.speciality === "Fitness Guru",
    JSON.stringify(slot?.manager));
  const me = (await A("GET", "/manager")).data;
  check("GET /manager (the Profile page) gives the player's face, typed name and speciality", me?.faceId === BASELINE && me?.name === "Faces A" && me?.isPlayer === true, `${me?.name}, ${me?.speciality}`);

  // ── 3. Deals: random, kept, and dealt once to older saves ──────────────────
  console.log("\n3. EVERY CAREER A DIFFERENT DEAL, KEPT ACROSS A RESTART");
  const LEAD = faceOf("Leader").id;
  const b = await newCareer(B, "Faces B", LEAD);
  const c = await newCareer(C, "Faces C", BASELINE);
  const dealA = dealOf(cidA), dealB = dealOf(b.cid);
  const same = [...dealA.keys()].filter((k) => dealA.get(k) === dealB.get(k)).length;
  check("two new careers get different AI deals (random)", same < 30, `${same} of 60 clubs have the same face in both`);
  // Career C as a save made before the faces: no face anywhere, its managers' old names.
  w(`UPDATE career_saves SET manager_face_id = NULL WHERE id = ?`, c.cid);
  w(`UPDATE career_pool_team_state SET manager_face_id = NULL, manager_name = 'Old Manager ' || pool_team_id WHERE career_save_id = ?`, c.cid);
  w(`DELETE FROM career_manager_faces WHERE career_save_id = ?`, c.cid);
  await restart();
  const dealA2 = dealOf(cidA), dealB2 = dealOf(b.cid);
  check("each career's deal survives a restart, the player's face too",
    [...dealA.keys()].every((k) => dealA.get(k) === dealA2.get(k)) && [...dealB.keys()].every((k) => dealB.get(k) === dealB2.get(k))
      && q(`SELECT manager_face_id AS f FROM career_saves WHERE id = ?`, cidA)[0].f === BASELINE);
  const clubsC = q(`SELECT manager_face_id AS face, manager_name AS name FROM career_pool_team_state WHERE career_save_id = ?`, c.cid);
  const postC = inPost(c.cid);
  check("a career made before the faces is dealt them at boot: the player one, every AI manager one, named by it",
    postC[0] != null && clubsC.every((r) => r.face != null && byId.get(r.face)?.name === r.name) && new Set(postC).size === 61,
    `player face ${postC[0]}; e.g. ${clubsC[0]?.name}`);
  check("and its faces left over are out of work from its season's start",
    q(`SELECT COUNT(*) AS n FROM career_manager_faces WHERE career_save_id = ? AND out_of_work_since = '2026-01-01'`, c.cid)[0].n === 8);
  const dealC = dealOf(c.cid), playerC = postC[0];
  await restart();
  const dealC2 = dealOf(c.cid);
  check("and it is never dealt again: the next boot leaves it as it is",
    [...dealC.keys()].every((k) => dealC.get(k) === dealC2.get(k)) && q(`SELECT manager_face_id AS f FROM career_saves WHERE id = ?`, c.cid)[0].f === playerC);

  // ── 4. The specialities ────────────────────────────────────────────────────
  console.log("\n4. EACH SPECIALITY MOVES ITS NUMBER, FOR THE PLAYER'S CLUB ONLY");
  const teamA = a.team.id;
  w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, teamA);
  makeCapRoom(DB, teamA);   // Update 1, item 4a: the cap is salary-cap.mjs's subject, not this suite's
  const TR = faceOf("Talent Recruiter").id, NEG = faceOf("Negotiator").id, CE = faceOf("Contracts Expert").id, SM = faceOf("Sponsor Magnet").id;
  const COACH = faceOf("Coach").id, YD = faceOf("Youth Developer").id, FG = BASELINE;

  // Talent Recruiter
  const costs = async () => (await A("GET", "/continental-scouting/regions")).data?.[0]?.costs ?? {};
  setFace(cidA, BASELINE); const c0 = await costs();
  setFace(cidA, TR); const c1 = await costs();
  check("Talent Recruiter: scouting missions cost 25% less (the page's figures are the server's)",
    c0[1] === 20000 && c0[3] === 45000 && c0[6] === 75000 && c1[1] === 15000 && c1[3] === 33750 && c1[6] === 56250, `${JSON.stringify(c0)} -> ${JSON.stringify(c1)}`);
  const region = (await A("GET", "/continental-scouting/regions")).data?.[0]?.id;
  // A mission is a Scout's job: hire one, on duty.
  const scoutOffer = ((await A("GET", "/staff/market?role=scout")).data ?? []).find((m) => /scout/i.test(m.role));
  await A("POST", "/staff", { staffId: scoutOffer?.id, length: "2s" });
  const scout = ((await A("GET", "/staff")).data ?? []).find((x) => /^scout$/i.test(x.role));
  w(`DELETE FROM staff_absences WHERE staff_id = ?`, scout?.id ?? -1);
  const bud0 = Number((await A("GET", "/team")).data.budget);
  const sent = await A("POST", "/continental-scouting/start", { region, durationMonths: 1, staffId: scout?.id });
  const bud1 = Number((await A("GET", "/team")).data.budget);
  check("and the mission sent is charged the figure shown", sent.status === 201 && Math.round(bud0 - bud1) === 15000, `HTTP ${sent.status} ${sent.data?.error ?? ""}: ${$(bud0)} -> ${$(bud1)}`);

  // Negotiator
  const market = async () => ((await A("GET", "/players/market-all")).data ?? []).filter((p) => p.status === "free_agent" && p.priceRange);
  const youthMarket = async () => ((await A("GET", "/players/youth-pool")).data ?? []).filter((p) => p.priceRange);
  setFace(cidA, BASELINE); const m0 = await market(), y0 = await youthMarket();
  setFace(cidA, NEG); const m1 = await market(), y1 = await youthMarket();
  const moved = (l0, l1) => l0.length > 5 && l0.every((p) => { const n = l1.find((x) => x.id === p.id);
    return n && n.priceRange.low === Math.round(p.priceRange.low * 0.9) && n.priceRange.high === Math.round(p.priceRange.high * 0.9); });
  check("Negotiator: every senior's price on the market is 10% lower", moved(m0, m1), `e.g. ${m0[0]?.name}: ${$(m0[0]?.priceRange.low)}-${$(m0[0]?.priceRange.high)} -> ${$(m1[0]?.priceRange.low)}-${$(m1[0]?.priceRange.high)}`);
  check("and so is every youth's", moved(y0, y1), `e.g. ${$(y0[0]?.priceRange.low)}-${$(y0[0]?.priceRange.high)} -> ${$(y1[0]?.priceRange.low)}-${$(y1[0]?.priceRange.high)}`);
  const inter = q(`SELECT s.player_id AS id FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior' AND s.squad_role = 'interchange'`, cidA, teamA)[0]?.id;
  if (inter) freeSquadPlace(DB, inter);   // 1.1.1 (no dumping): the place is freed in this suite's own database
  const target = m1[0];
  const confirmStep = await A("POST", "/contracts", { playerId: target.id, salary: target.salary, bonusPerWin: 0, squadRole: "interchange", length: "1s" });
  check("and the signing's confirm step names the same, lower range (shown = charged)",
    confirmStep.status === 400 && confirmStep.data?.priceRange?.low === target.priceRange.low && confirmStep.data?.priceRange?.high === target.priceRange.high,
    `HTTP ${confirmStep.status} ${JSON.stringify(confirmStep.data?.priceRange)}`);

  // Contracts Expert (and Rob's B: no signing below her asking wage)
  setFace(cidA, BASELINE); const s0 = await market();
  setFace(cidA, CE); const s1 = await market();
  check("Contracts Expert: every senior asks 10% less in wages on the market",
    s0.length > 5 && s0.every((p) => s1.find((x) => x.id === p.id)?.salary === Math.round(p.salary * 0.9)), `e.g. ${s0[0]?.name}: ${$(s0[0]?.salary)} -> ${$(s1[0]?.salary)}`);
  const her = s1[0];
  const below = await A("POST", "/contracts", { playerId: her.id, salary: her.salary - 100, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("an offer below her asking wage is refused, and says what she asks", below.status === 422 && below.data?.asks === her.salary && /asks \$[\d,]+ a month/.test(below.data?.error ?? ""),
    `HTTP ${below.status} ${below.data?.error}`);
  setFace(cidA, BASELINE);
  const withoutCE = await A("POST", "/contracts", { playerId: her.id, salary: her.salary, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("without the Contracts Expert that same offer is below her ask too", withoutCE.status === 422 && withoutCE.data?.asks === s0.find((p) => p.id === her.id)?.salary,
    `HTTP ${withoutCE.status}, she asks ${$(withoutCE.data?.asks)}`);
  setFace(cidA, CE);
  const signed = await A("POST", "/contracts", { playerId: her.id, salary: her.salary, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  const onBooks = q(`SELECT salary FROM contracts WHERE player_id = ? AND team_id = ? AND status = 'active'`, her.id, teamA)[0]?.salary;
  check("with the Contracts Expert she signs at the lower ask, on that wage", signed.status === 201 && Number(onBooks) === her.salary, `HTTP ${signed.status}, contract ${$(onBooks)}`);

  // Sponsor Magnet
  const offers = async () => { w(`DELETE FROM promo_deals WHERE team_id = ? AND status = 'available'`, teamA); return (await A("GET", "/finances/sponsor-offers")).data ?? []; };
  setFace(cidA, BASELINE); const o0 = await offers();
  setFace(cidA, SM); const o1 = await offers();
  const hundreds = (n) => Number(n) % 100 === 0;
  const timesTen11 = (n) => Math.abs(Number(n) / 1.1 - Math.round(Number(n) / 1.1)) < 1e-6 && hundreds(Math.round(Number(n) / 1.1));
  check("Sponsor Magnet: every offer is the sponsor's figure (whole hundreds) x 1.1; without it, whole hundreds",
    o0.length > 0 && o0.every((o) => hundreds(o.monthlyPayment) && hundreds(o.signingBonus))
      && o1.length > 0 && o1.every((o) => timesTen11(o.monthlyPayment) && timesTen11(o.signingBonus))
      && o1.some((o) => !hundreds(o.monthlyPayment)),
    `e.g. ${$(o0[0]?.monthlyPayment)}/month -> ${$(o1[0]?.monthlyPayment)}/month (${$(Math.round(o1[0]?.monthlyPayment / 1.1))} x 1.1)`);

  // Leader
  const confB = q(`SELECT board_confidence AS c FROM teams WHERE id = ?`, b.team.id)[0]?.c;
  const confA = q(`SELECT board_confidence AS c FROM teams WHERE id = ?`, teamA)[0]?.c;
  check("Leader: a Leader's board starts at 70; anyone else's at 60", confB === 70 && confA === 60, `Leader career ${confB}, Fitness Guru career ${confA}`);

  // Coach
  const squadA = q(`SELECT s.player_id AS id, p.player_type AS type, s.is_promoted AS promoted FROM career_player_state s JOIN players p ON p.id = s.player_id
                    WHERE s.career_save_id = ? AND s.team_id = ?`, cidA, teamA);
  const senior = squadA.find((p) => p.type === "senior" && p.id !== her.id)?.id ?? her.id;
  setFace(cidA, BASELINE);
  const plain = await trainThroughCalendar(A, { playerId: senior, type: "Power Camp", durationHours: 2 }, DB);
  setFace(cidA, COACH);
  const coached = await trainThroughCalendar(A, { playerId: senior, type: "Power Camp", durationHours: 2 }, DB);
  const r0 = plain.result, r1 = coached.result;
  const tol = 0.5 / (r0?.baseXp ?? 1) + 0.5 / (r1?.baseXp ?? 1);
  check("Coach: a senior's session records the Coach's x1.1 (x1 without)", r0?.managerXpMultiplier === 1 && r1?.managerXpMultiplier === 1.1, `${r0?.managerXpMultiplier} -> ${r1?.managerXpMultiplier}`);
  check("and her XP per point of base XP rises by 10%", r0 && r1 && Math.abs(r1.xpGained / r1.baseXp - (r0.xpGained / r0.baseXp) * 1.1) <= tol * 1.1 + 1e-9,
    `${r0?.xpGained}/${r0?.baseXp} -> ${r1?.xpGained}/${r1?.baseXp}`);

  // Youth Developer: one academy week, worked out by the game's own rule.
  console.log("  (the academy week: academyXpFor's bands, the potential multiplier and court time, as utils/academyDevelopment.ts has them)");
  check("(source) academyXpFor still gives 21 / 19 / 16 by rating band", /return rating >= 75 \? 21 : rating >= 60 \? 19 : 16;/.test(src("artifacts/api-server/src/utils/academyDevelopment.ts")));
  const academy = () => q(`SELECT s.player_id AS id, s.training_points AS tp, s.power, s.speed, s.defense, s.serve, s.block, s.academy_role AS role, p.potential
    FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0`, cidA, teamA);
  if (academy().length === 0) {
    const yp = (await youthMarket())[0];
    const sy = await A("POST", "/contracts", { playerId: yp?.id, salary: 0, bonusPerWin: 0, squadRole: "reserve", academyRole: "youth_team", length: "1s", confirm: true });
    console.log(`  (set-up) the academy was empty: a market youth signed, HTTP ${sy.status} ${sy.data?.error ?? ""}`);
  }
  console.log(`  (set-up) ${academy().length} academy player(s)`);
  const band = (r) => (r >= 75 ? 21 : r >= 60 ? 19 : 16);
  async function academyWeek(faceId, factor) {
    setFace(cidA, faceId);
    for (let i = 0; i < 120; i++) {
      healAllSquads(DB);
      const r = await A("POST", "/calendar/advance", {});
      const id = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
      if (!id) continue;
      const before = academy();
      await A("POST", `/matches/${id}/simulate`);
      let after = academy();
      for (let k = 0; k < 40 && after.every((p) => p.tp === before.find((x) => x.id === p.id)?.tp); k++) { await new Promise((res) => setTimeout(res, 100)); after = academy(); }
      await A("POST", "/calendar/dismiss-match");
      return before.map((p) => {
        const rating = Math.round((p.power + p.speed + p.defense + p.serve + p.block) / 5);
        const share = p.role === "reserve" ? RESERVE_COURT_SHARE : 1;
        const want = Math.round(Math.round(band(rating) * factor * potentialMultiplier(p.potential)) * share);
        return { id: p.id, got: (after.find((x) => x.id === p.id)?.tp ?? p.tp) - p.tp, want };
      });
    }
    return [];
  }
  const weekPlain = await academyWeek(BASELINE, 1);
  const weekYD = await academyWeek(YD, 1.15);
  check("Youth Developer: without one, each academy player's week is academyXpFor x her potential x court time",
    weekPlain.length > 0 && weekPlain.every((p) => p.got === p.want), weekPlain.map((p) => `${p.got}/${p.want}`).join(" "));
  check("with one, it is academyXpFor x 1.15 x her potential x court time", weekYD.length > 0 && weekYD.every((p) => p.got === p.want), weekYD.map((p) => `${p.got}/${p.want}`).join(" "));

  // Fitness Guru: injury chance is random; its number is the risk, x0.8.
  setFace(cidA, FG); const fg = (await A("GET", "/manager")).data?.injuryRiskFactor;
  setFace(cidA, COACH); const nfg = (await A("GET", "/manager")).data?.injuryRiskFactor;
  const matchesSrc = src("artifacts/api-server/src/routes/matches.ts");
  // Item 4c: the roll is the shared matchInjuryRoll (utils/condition.ts), the AI clubs' too.
  check("Fitness Guru: match injury risk x0.8 (x1 for anyone else), through the one injury roll",
    fg === 0.8 && nfg === 1 && /const fitnessGuru = specialityFactor\(teamId, "Fitness Guru"\);/.test(matchesSrc)
      // 15 Oct and night 2: the club's staff factor (now its sports scientist) rides in the same roll.
      && matchesSrc.includes("matchInjuryRoll(player, { sportsLabLevel, hasRecoveryCamp, weatherMultiplier: wx.injuryRiskMultiplier, fitnessGuru, staffFactor })")
      && /\* \(ctx\.weatherMultiplier \?\? 1\) \* \(ctx\.fitnessGuru \?\? 1\)/.test(src("artifacts/api-server/src/utils/condition.ts")),
    `factor ${fg} / ${nfg}`);
  check("and the Medical page's injury risk takes the same factor", /calcInjuryRisk\(fitness, fatigue, riskFactor\)/.test(src("artifacts/beach-volleyball/src/pages/medical.tsx")));

  // M-6: an AI manager's speciality is shown, not used, but for Coach and
  // Youth Developer since item 3 (harness/ai-training.mjs tests those two), and
  // Fitness Guru since item 4c (harness/ai-injuries.mjs).
  const facesSrc = src("artifacts/api-server/src/utils/managerFaces.ts");
  check("(source) the one multiplier reads the player's manager by the club's teams row, and for an AI club only Coach, Youth Developer and Fitness Guru count",
    /if \(typeof club === "number"\) \{[\s\S]*?careerSavesTable\.teamId, club\)/.test(facesSrc)
      && /export const AI_CLUB_SPECIALITIES: readonly Speciality\[\] = \["Coach", "Youth Developer", "Fitness Guru"\];/.test(facesSrc)
      && /if \(club != null && typeof club === "object" && !AI_CLUB_SPECIALITIES\.includes\(speciality\)\) return 1;/.test(facesSrc));
  // 1.1.1: an AI club's buy is a bid (aiTransfersWeekTx), and its youth buys ask her club with no price factor.
  check("(source) an AI club's purchases take no speciality; an AI academy's week only its Youth Developer",
    /priced: \{ \.\.\.m, askingPrice: null \}/.test(src("artifacts/api-server/src/utils/aiSquads.ts"))
      && /marketPrice\(careerSaveId, m\.priced as Parameters<typeof marketPrice>\[1\]\)\.price/.test(src("artifacts/api-server/src/utils/aiSquads.ts"))
      && /youthDealTx\(w, careerSaveId, club, best\.playerId, "buy", today\)/.test(src("artifacts/api-server/src/utils/youthDeals.ts"))
      && /academyWeek\(youthRating\(r\), r\.potential, Math\.floor\(Math\.random\(\) \* 5\), youthDeveloper\.get\(club\)\)/.test(src("artifacts/api-server/src/utils/youthLoans.ts"))
      && /specialityFactor\(\{ careerSaveId, poolTeamId: club \}, "Youth Developer"\)/.test(src("artifacts/api-server/src/utils/youthLoans.ts")));
  setFace(cidA, BASELINE);
  const before6 = await market();
  w(`UPDATE career_pool_team_state SET manager_face_id = ? WHERE career_save_id = ?`, NEG, cidA);
  const after6 = await market();
  for (const [club, face] of dealA2) w(`UPDATE career_pool_team_state SET manager_face_id = ? WHERE career_save_id = ? AND pool_team_id = ?`, face, cidA, club);
  check("(run) every AI manager a Negotiator changes no price the player's club is shown",
    before6.length > 5 && before6.every((p) => { const n = after6.find((x) => x.id === p.id); return n && n.priceRange.low === p.priceRange.low && n.priceRange.high === p.priceRange.high; }));

  // ── 5 and 6. The off-season window: a sacked manager's club, and job offers ─
  console.log("\n5. A CLUB THAT SACKED ITS MANAGER APPOINTS THE FACE OUT OF WORK LONGEST, NEVER THE SACKED ONE");
  // The sacking exactly as the board writes it (aiManagers judgeAiManagersTx),
  // a season earlier, so the club appoints at this window (appointOldVacanciesTx).
  const V = q(`SELECT pool_team_id AS club, manager_face_id AS face, manager_name AS name FROM career_pool_team_state WHERE career_save_id = ? ORDER BY pool_team_id LIMIT 1`, cidA)[0];
  w(`UPDATE career_pool_team_state SET manager_name = NULL, vacant_since = '2025-12-01', vacancy_reason = 'Planted: sacked by its board (harness).' WHERE career_save_id = ? AND pool_team_id = ?`, cidA, V.club);
  w(`INSERT INTO career_manager_faces (career_save_id, face_id, out_of_work_since, sacked_by) VALUES (?, ?, '2025-05-01', ?)`, cidA, V.face, JSON.stringify([V.club]));
  const spares = q(`SELECT face_id AS f FROM career_manager_faces WHERE career_save_id = ? AND out_of_work_since = '2026-01-01' ORDER BY face_id`, cidA).map((r) => r.f);
  const longest = spares[3];
  w(`UPDATE career_manager_faces SET out_of_work_since = '2025-06-01' WHERE career_save_id = ? AND face_id = ?`, cidA, longest);
  console.log(`  (set-up) ${V.name} (face ${V.face}) sacked by club ${V.club}, out of work since 2025-05-01; face ${longest} (${byId.get(longest).name}) out of work since 2025-06-01, the rest since 2026-01-01`);
  const jm0 = (await A("GET", "/job-market")).data;
  const vac = jm0?.vacancies?.find((v) => v.poolTeamId === V.club);
  check("the Job Market shows the vacancy with the manager being replaced: the sacked one's face and name",
    vac?.replacing?.faceId === V.face && vac?.replacing?.name === V.name && vac?.replacing?.image === `/${byId.get(V.face).file}`, JSON.stringify(vac?.replacing));
  // Play to the off-season window (the player's last match).
  await keepSideFielded(A);
  await renewExpiringContracts(A);
  // The window opens (the boards judge, the old vacancies are filled) on the
  // calendar day after the club's last match: career_saves.window_season says so.
  const year0 = q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cidA)[0].year;
  let window = false;
  for (let i = 0; i < 900 && !window; i++) {
    healAllSquads(DB);
    const r = await day(A);
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") break;
    window = q(`SELECT window_season AS y FROM career_saves WHERE id = ?`, cidA)[0]?.y === year0;
  }
  check("(set-up) the off-season window opens", window);
  const vNow = q(`SELECT manager_face_id AS face, manager_name AS name, vacant_since AS vac FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`, cidA, V.club)[0];
  check("the club appoints the free face out of work longest", vNow?.vac == null && vNow?.face === longest && vNow?.name === byId.get(longest).name, JSON.stringify(vNow));
  check("not the manager it sacked, though she has been out of work longer still", vNow?.face !== V.face
    && q(`SELECT sacked_by AS s, out_of_work_since AS since FROM career_manager_faces WHERE career_save_id = ? AND face_id = ?`, cidA, V.face)[0]?.s === JSON.stringify([V.club]));
  check("the appointed face is in post (no longer out of work)", q(`SELECT out_of_work_since AS s FROM career_manager_faces WHERE career_save_id = ? AND face_id = ?`, cidA, longest)[0]?.s === null);
  const sackedNow = q(`SELECT pool_team_id AS club, manager_face_id AS face, vacant_since AS since FROM career_pool_team_state WHERE career_save_id = ? AND vacant_since IS NOT NULL`, cidA);
  const sackRecords = sackedNow.map((s) => q(`SELECT out_of_work_since AS since, sacked_by AS by FROM career_manager_faces WHERE career_save_id = ? AND face_id = ?`, cidA, s.face)[0]);
  check("every manager the boards sacked at this window is out of work from the sacking, and on her club's sacked-by list",
    sackedNow.every((s, i) => sackRecords[i]?.since === s.since && JSON.parse(sackRecords[i]?.by ?? "[]").includes(s.club)), `${sackedNow.length} sacked at this window`);
  const postNow = inPost(cidA);
  check("still no face used twice", new Set(postNow).size === postNow.length, `${postNow.length} in post`);
  const quals = (await A("GET", "/regional-league/qualifications")).data?.qualifications ?? [];
  check("Qualified Teams: each club shows its manager's face, name and speciality",
    quals.length > 0 && quals.every((x) => x.manager == null ? vacantClub(x.poolTeamId) : x.manager.image.startsWith("/images/managers/") && x.manager.speciality && x.manager.name),
    `${quals.length} clubs; e.g. ${quals[0]?.teamName}: ${quals[0]?.manager?.name}, ${quals[0]?.manager?.speciality}`);
  function vacantClub(club) { return q(`SELECT vacant_since AS v FROM career_pool_team_state WHERE career_save_id = ? AND pool_team_id = ?`, cidA, club)[0]?.v != null; }

  console.log("\n6. A JOB OFFER SAYS HIM OR HER, FROM THE FACE");
  const year = q(`SELECT year FROM seasons WHERE career_save_id = ? AND status = 'active'`, cidA)[0].year;
  w(`UPDATE teams SET manager_rep_points = 100000 WHERE id = ?`, teamA);
  w(`UPDATE board_seasons SET projected_grade = 'met' WHERE career_save_id = ? AND season_year = ? AND team_id = ?`, cidA, year, teamA);
  w(`UPDATE career_pool_team_state SET manager_failed_seasons = 0 WHERE career_save_id = ?`, cidA);
  const top = q(`SELECT s.pool_team_id AS club FROM career_pool_team_state s JOIN continental_pool_teams t ON t.id = s.pool_team_id
    WHERE s.career_save_id = ? AND s.taken_over_at IS NULL AND s.vacant_since IS NULL AND s.manager_name IS NOT NULL ORDER BY t.rating DESC LIMIT 2`, cidA);
  const used6 = inPost(cidA);
  const man = FACES.find((f) => f.gender === "male" && !used6.includes(f.id)), woman = FACES.find((f) => f.gender === "female" && !used6.includes(f.id) && f.id !== man.id);
  for (const [t, f] of [[top[0].club, man], [top[1].club, woman]]) {
    w(`UPDATE career_pool_team_state SET manager_face_id = ?, manager_name = ?, manager_failed_seasons = 1 WHERE career_save_id = ? AND pool_team_id = ?`, f.id, f.name, cidA, t);
  }
  // Every other club's offer declined, so the two planted ones are the offers made.
  const others = q(`SELECT pool_team_id AS club FROM career_pool_team_state WHERE career_save_id = ?`, cidA).map((r) => r.club).filter((x) => x !== top[0].club && x !== top[1].club);
  w(`UPDATE career_saves SET declined_offers = ? WHERE id = ?`, JSON.stringify(others), cidA);
  const jm = (await A("GET", "/job-market")).data;
  const oMan = jm?.offers?.find((o) => o.poolTeamId === top[0].club), oWoman = jm?.offers?.find((o) => o.poolTeamId === top[1].club);
  check("an offer over a man's face: \"a failed season behind him\"", /than .+ \(a failed season behind him\)/.test(oMan?.why ?? "") && oMan?.why.includes(man.name), oMan?.why);
  check("an offer over a woman's face: \"a failed season behind her\"", /than .+ \(a failed season behind her\)/.test(oWoman?.why ?? "") && oWoman?.why.includes(woman.name), oWoman?.why);
  check("and each offer shows the manager being replaced", oMan?.replacing?.faceId === man.id && oWoman?.replacing?.faceId === woman.id);

  // ── The screens (source) ───────────────────────────────────────────────────
  console.log("\n7. THE SCREENS");
  check("both new-career wizards show the face picker and send the face",
    ["artifacts/beach-volleyball/src/pages/new-career.tsx", "artifacts/beach-volleyball/src/pages/career-management.tsx"].every((p) => /<ManagerFacePicker /.test(src(p)) && /managerFaceId:/.test(src(p))));
  check("Profile shows the face; the purple UserCog icon is gone", !/UserCog/.test(src("artifacts/beach-volleyball/src/pages/profile.tsx")) && /profile-manager-face/.test(src("artifacts/beach-volleyball/src/pages/profile.tsx")));
  check("Qualified Teams and the Job Market show the managers", /q\.manager\?\.image/.test(src("artifacts/beach-volleyball/src/pages/competition/qualified-teams.tsx"))
    && /<ReplacingLine m=\{o\.replacing\}/.test(src("artifacts/beach-volleyball/src/pages/job-market.tsx")) && /<ReplacingLine m=\{v\.replacing\}/.test(src("artifacts/beach-volleyball/src/pages/job-market.tsx")));
  check("the old mixed FIRST/LAST name lists and aiManagerName are gone", !/aiManagerName|const FIRST = \[|const LAST = \[/.test(src("artifacts/api-server/src/utils/aiManagers.ts")));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  if (child) await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
