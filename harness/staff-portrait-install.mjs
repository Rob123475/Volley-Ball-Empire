/**
 * Update 1, 15 Oct (day brief part 6, O-2): ready for Rob's staff portraits.
 *
 *   1. scripts/install-staff-portraits.cjs, on 2 copies of existing staff
 *      portraits in a temp folder (named as Rob's pictures are, "...portrait of
 *      a 52-year-old Brazilian man_..."), writing to a copy of the starter DB
 *      and a temp images folder: a dry run writes nothing and lists a file name
 *      it can't read; --write crops each to 500 x 500 WebP (the existing staff
 *      portraits' size and format) and writes each person into the staff table
 *      at the ids from data/staff-ids.json up, the name from the names file, the
 *      skill inside the role's existing range and the wage off the role's
 *      existing skill -> wage line; a second --write updates, never duplicates
 *   2. a save made before them gets them on its next boot (ensureReferenceData,
 *      Pass 3b): the rows, and this career's state at their wage, on the market
 *   3. the AI staff deal takes them with no code change (marketFloor 5): it
 *      reads every career staff row by role, and they are rows of the existing
 *      roles
 *   4. a save's own new staff (the market top-up) stay below the starter DB's
 *      ids, even after the save has been given people at 10001 up
 * The temp folder, the portrait copies and the DB copies are deleted at the end.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { startCareer } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const INSTALLER = path.join(REPO, "scripts", "install-staff-portraits.cjs");
const STAFF_IMAGES = path.join(REPO, "artifacts", "beach-volleyball", "public", "images", "staff");
const FROM = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "staff-ids.json"), "utf8")).starterOnlyFrom;
const sharp = createRequire(import.meta.url)(path.join(REPO, "scripts", "node_modules", "sharp"));
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-staff-portraits-"));
const SRC = path.join(WORK, "pictures"), IMAGES = path.join(WORK, "images"), STARTER = path.join(WORK, "starter.sqlite");
const NAMES = path.join(WORK, "names.json"), DB = path.join(WORK, "save.sqlite");
const PORT = 4977;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  UPDATE 1, DAY 2 PART 6: READY FOR ROB'S STAFF PORTRAITS");
console.log("=".repeat(72));

let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const query = (file, sql, ...a) => { const d = new DatabaseSync(file, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const run = (file, sql, ...a) => { const d = new DatabaseSync(file); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
const install = (...args) => spawnSync(process.execPath,
  [INSTALLER, SRC, "--db", STARTER, "--images", IMAGES, "--names", NAMES, ...args], { encoding: "utf8" });

async function boot(tag, starter) {
  const out = fs.openSync(path.join(WORK, `server-${tag}.log`), "w");
  const child = forkServer({ server: SERVER, electron: ELECTRON, out,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "staff-portraits", STARTER_DB_PATH: starter } });
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  return child;
}

let child = null;
try {
  // ── 1. The installer, on 2 copies of existing portraits ───────────────────
  console.log("\n1. THE INSTALLER, ON TWO COPIES OF EXISTING STAFF PORTRAITS");
  const coachFile = "Agent Image - portrait of a 52-year-old Brazilian man_ head coach.webp";
  const doctorFile = "Agent Image - portrait of a 45-year-old Australian woman_ team doctor.webp";
  fs.mkdirSync(path.join(SRC, "Head Coach"), { recursive: true });
  fs.mkdirSync(path.join(SRC, "Doctor"), { recursive: true });
  for (const f of ["head_coach", "assistant_coach", "medical_doctor", "physiotherapist", "massage_therapist", "medical_specialist"]) fs.mkdirSync(path.join(IMAGES, f), { recursive: true });
  fs.copyFileSync(path.join(STAFF_IMAGES, "head_coach", "staff-01.webp"), path.join(SRC, "Head Coach", coachFile));
  fs.copyFileSync(path.join(STAFF_IMAGES, "medical_doctor", "staff-01.webp"), path.join(SRC, "Doctor", "a picture with no age in its name.webp"));
  fs.copyFileSync(SHIPPED, STARTER);
  fs.writeFileSync(NAMES, JSON.stringify({ "Head Coach": { "52 Brazilian man": "Test Coach One" }, Doctor: { "45 Australian woman": "Test Doctor One" } }));

  const unreadable = install();
  check("a file name it can't read is listed, and nothing is written",
    unreadable.status !== 0 && /can't read the age, nationality and gender[\s\S]*Doctor\/a picture with no age in its name\.webp/.test(unreadable.stdout)
      && query(STARTER, "SELECT COUNT(*) n FROM staff WHERE id >= ?", FROM)[0].n === 0 && fs.readdirSync(path.join(IMAGES, "head_coach")).length === 0,
    `exit ${unreadable.status}`);

  fs.renameSync(path.join(SRC, "Doctor", "a picture with no age in its name.webp"), path.join(SRC, "Doctor", doctorFile));
  const dry = install();
  check("a dry run reads both names and writes nothing",
    dry.status === 0 && /Test Coach One\s+52 Brazil\s+male/.test(dry.stdout) && /Test Doctor One\s+45 Australia\s+female/.test(dry.stdout)
      && query(STARTER, "SELECT COUNT(*) n FROM staff WHERE id >= ?", FROM)[0].n === 0, dry.stdout.split("\n").filter((l) => /Test /.test(l)).map((l) => l.trim()).join(" | "));

  const wrote = install("--write");
  const rows = query(STARTER, "SELECT * FROM staff WHERE id >= ? ORDER BY id", FROM);
  check("--write adds both, at the ids from data/staff-ids.json up", wrote.status === 0 && rows.length === 2 && rows[0].id === FROM && rows[1].id === FROM + 1,
    rows.map((r) => `${r.id} ${r.name} (${r.role})`).join(", "));
  const coach = rows.find((r) => r.role === "Head Coach"), doctor = rows.find((r) => r.role === "Doctor");
  const roleRange = (role) => query(STARTER, "SELECT min(skill_level) lo, max(skill_level) hi FROM staff WHERE role = ? AND id < ?", role, FROM)[0];
  check("each takes the name from the names file and the age and nationality from the file name",
    coach?.name === "Test Coach One" && coach.base_age === 52 && coach.nationality === "Brazil"
      && doctor?.name === "Test Doctor One" && doctor.base_age === 45 && doctor.nationality === "Australia" && JSON.parse(doctor.attributes).gender === "Female");
  const coachRange = roleRange("Head Coach"), doctorRange = roleRange("Doctor");
  check("one person of a role sits in the middle of the role's existing skill range",
    coach?.skill_level === Math.round((coachRange.lo + coachRange.hi) / 2) && doctor?.skill_level === Math.round((doctorRange.lo + doctorRange.hi) / 2),
    `coach ${coach?.skill_level} (${coachRange.lo}-${coachRange.hi}), doctor ${doctor?.skill_level} (${doctorRange.lo}-${doctorRange.hi})`);
  // Straight between the role's two existing staff either side of the skill.
  const line = (role, skill) => {
    const pts = query(STARTER, "SELECT skill_level s, avg(base_salary) w FROM staff WHERE role = ? AND id < ? GROUP BY skill_level ORDER BY skill_level", role, FROM);
    const hi = pts.find((p) => p.s >= skill), lo = [...pts].reverse().find((p) => p.s <= skill);
    return hi.s === lo.s ? Math.round(hi.w) : Math.round(lo.w + ((hi.w - lo.w) * (skill - lo.s)) / (hi.s - lo.s));
  };
  check("the wage is the role's existing skill -> wage line at that skill",
    coach?.base_salary === line("Head Coach", coach.skill_level) && doctor?.base_salary === line("Doctor", doctor.skill_level),
    `coach $${coach?.base_salary}/mo, doctor $${doctor?.base_salary}/mo`);
  const pics = await Promise.all([coach, doctor].map((r) => sharp(fs.readFileSync(path.join(IMAGES, r.image_url.replace("/images/staff/", "")))).metadata()));
  check("the portraits are 500 x 500 WebP after the role's existing ones (staff-11)",
    coach?.image_url === "/images/staff/head_coach/staff-11.webp" && doctor?.image_url === "/images/staff/medical_doctor/staff-11.webp"
      && pics.every((m) => m.format === "webp" && m.width === 500 && m.height === 500), pics.map((m) => `${m.format} ${m.width}x${m.height}`).join(", "));
  const again = install("--write");
  check("a second --write updates them, never a duplicate", again.status === 0 && /0 added, 2 updated/.test(again.stdout)
    && query(STARTER, "SELECT COUNT(*) n FROM staff WHERE id >= ?", FROM)[0].n === 2);

  // ── 2. A save made before them ─────────────────────────────────────────────
  console.log("\n2. A SAVE MADE BEFORE THEM GETS THEM ON ITS NEXT BOOT (PASS 3b)");
  fs.copyFileSync(SHIPPED, DB);
  child = await boot("first", SHIPPED);
  const prof = await api("POST", "/profiles", { name: "Staff portraits" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? [])[0];
  await startCareer(api, { managerFaceId: 8, slotNumber: 1, managerName: "Portraits Test", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", gameDifficulty: "medium", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const teamId = (await api("GET", "/team")).data?.id;
  const cid = query(DB, "SELECT id FROM career_saves WHERE team_id = ?", teamId)[0]?.id;
  check("the career began without them", cid != null && query(DB, "SELECT COUNT(*) n FROM staff WHERE id >= ?", FROM)[0].n === 0);
  await stopServer(child); child = null;

  // Every staff member hired away (the top-up counts every unhired one), so the next market tops itself up (part 4).
  const hiredAway = run(DB, `UPDATE career_staff_state SET pool_team_id = (SELECT MIN(pool_team_id) FROM career_pool_team_state WHERE career_save_id = ?)
    WHERE career_save_id = ? AND team_id IS NULL AND pool_team_id IS NULL`, cid, cid).changes;
  const maxBefore = query(DB, "SELECT MAX(id) m FROM staff")[0].m;

  child = await boot("second", STARTER);
  await api("POST", `/profiles/${prof.data.id}/select`);
  const given = query(DB, `SELECT st.id, st.name, st.base_salary, s.salary, s.team_id, s.pool_team_id FROM staff st
    JOIN career_staff_state s ON s.staff_id = st.id AND s.career_save_id = ? WHERE st.id >= ? ORDER BY st.id`, cid, FROM);
  check("the save has both, with this career's state at their wage, free to sign",
    given.length === 2 && given.every((g) => g.salary === g.base_salary && g.team_id == null && g.pool_team_id == null),
    given.map((g) => `${g.id} ${g.name} $${g.salary}`).join(", "));
  const medMarket = (await api("GET", "/medical-staff/market")).data;
  const medList = Array.isArray(medMarket) ? medMarket : (medMarket?.staff ?? []);
  check("the new doctor is on the Medical Market", medList.some((s) => s.id === FROM + 1), `${medList.length} on the market`);

  // ── 3. The AI deal ─────────────────────────────────────────────────────────
  console.log("\n3. THE AI STAFF DEAL TAKES THEM WITH NO CODE CHANGE (marketFloor 5)");
  const aiSrc = fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "utils", "aiStaff.ts"), "utf8");
  check("(source) the deal's market is every career staff row of the role (normaliseRole), nothing by id or picture",
    /\.innerJoin\(staffTable, eq\(staffTable\.id, careerStaffStateTable\.staffId\)\)\s*\.where\(eq\(careerStaffStateTable\.careerSaveId, careerSaveId\)\)/.test(aiSrc)
      && /role: normaliseRole\(r\.role\)/.test(aiSrc) && /marketFloor: 5/.test(aiSrc) && !/image_?[uU]rl|staffId\s*[<>]/.test(aiSrc));
  check("they are rows of the existing roles, so the deal counts them in its market",
    query(DB, "SELECT role FROM staff WHERE id >= ? ORDER BY id", FROM).map((r) => r.role).join(",") === "Head Coach,Doctor");

  // ── 4. A save's own new staff ──────────────────────────────────────────────
  console.log("\n4. A SAVE'S OWN NEW STAFF STAY BELOW THE STARTER DB'S IDS");
  const market = (await api("GET", "/staff/market")).data;
  const made = query(DB, "SELECT id FROM staff WHERE id > ? AND id < ?", maxBefore, FROM).map((r) => r.id);
  check("the markets topped themselves up (every member had been hired away)", hiredAway > 0 && made.length > 0,
    `${hiredAway} hired away; ${made.length} made`);
  check("each new one took the next id below the starter DB's (none at 10001 up)",
    made.length > 0 && made[0] === maxBefore + 1 && query(DB, "SELECT COUNT(*) n FROM staff WHERE id >= ?", FROM)[0].n === 2,
    `${made[0]}..${made[made.length - 1]}; ${Array.isArray(market) ? market.length : market?.staff?.length ?? "?"} on the market`);
} catch (err) {
  failures++;
  console.log(`  FAIL  the suite threw: ${err?.stack ?? err}`);
} finally {
  if (child) await stopServer(child);
  try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* the OS cleans tmp */ }
  console.log(`\n  (the portrait copies and the DB copies deleted: ${!fs.existsSync(WORK)})`);
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
