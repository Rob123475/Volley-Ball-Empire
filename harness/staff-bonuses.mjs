/**
 * P-09 — hired staff actually give their bonuses.
 *
 * The staff table stores roles in Title Case ("Head Coach", "Promotional
 * Manager"). Every bonus looked its staff member up with `s.role ===
 * "head_coach"`, which is never true, so a club with four staff hired got
 * nothing from any of them and the Staff page said "Hire staff to unlock
 * bonuses". One normaliser (lib/db/src/schema/staff-roles.ts) now answers
 * "what role is this?" for server and client alike.
 *
 * This suite hires a Title-Case head coach, assistant coach, fitness trainer
 * and promotional manager from the real starter data, then proves each bonus
 * is APPLIED — measured in what the game did, not just what it reports:
 *
 *   xp        the same player, the same program, before and after hiring:
 *             XP awarded per point of base XP rises by exactly the head and
 *             assistant coaches' multiplier
 *   fatigue   the fatigue a Power Camp adds falls by exactly the fitness
 *             trainer's reduction
 *   sponsor   weekly sponsor income is reputation x 200 unboosted; after the
 *             hire it is that times the promotions manager's multiplier
 *   panel     the Staff page's bonus panel looks roles up normalised, and every
 *             Title-Case role the starter data holds lands on a bonus it lists
 *
 * Usage: node harness/staff-bonuses.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { trainThroughCalendar } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-staff-bonuses-"));
const PORT = 4861;
const BASE = `http://localhost:${PORT}/api`;
const SPONSOR_INCOME_PER_REPUTATION = 200;
const HIRE = ["Head Coach", "Assistant Coach", "Fitness Trainer", "Promotional Manager"];
const POWER_CAMP_FATIGUE = 26;

// The shared normaliser itself — Node strips the types from a .ts import.
const roles = await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "staff-roles.ts")).href);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const read = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("=".repeat(72));
console.log("  P-09 HIRED STAFF GIVE THEIR BONUSES");
console.log("=".repeat(72));

// ── 0. One normaliser, and nothing compares a role as stored ───────────────
console.log("\n0. ONE NORMALISER");
{
  const d = new DatabaseSync(SHIPPED, { readOnly: true });
  const stored = d.prepare("SELECT DISTINCT role FROM staff ORDER BY role").all().map((r) => r.role);
  d.close();
  // P-08: the staff renames of 28 Sep swapped names between cards. No two of
  // the starter staff may share a name - "Dr." is a title, not a different name.
  {
    const d2 = new DatabaseSync(SHIPPED, { readOnly: true });
    const names = d2.prepare("SELECT name FROM staff").all().map((r) => r.name.replace(/^Dr\.\s+/, "").trim().toLowerCase());
    d2.close();
    const dupes = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
    check("no two starter staff share a name, ignoring a leading \"Dr.\" (P-08)", names.length === 120 && dupes.length === 0,
      dupes.length ? `duplicates: ${dupes.join(", ")}` : `${names.length} staff, all distinct`);
  }
  const unmapped = stored.filter((r) => roles.normaliseRole(r) === null);
  check("every role the starter data stores normalises to a key", stored.length === 12 && unmapped.length === 0,
    `${stored.length} roles${unmapped.length ? `; unmapped: ${unmapped.join(", ")}` : ""}`);
  check("the four hired here are stored Title Case, which is the bug's premise",
    HIRE.every((r) => stored.includes(r)), HIRE.join(", "));
  const spellings = [
    ["Strength Coach", "strength_conditioner"], ["strength_coach", "strength_conditioner"],
    ["Promotional Manager", "promotions_manager"], ["promotions_manager", "promotions_manager"],
    ["Doctor", "doctor"], ["team_doctor", "doctor"], ["physio", "physiotherapist"], ["head_coach", "head_coach"],
  ];
  const wrong = spellings.filter(([s, k]) => roles.normaliseRole(s) !== k);
  check("both names the DB and the code disagree on land on one key", wrong.length === 0,
    wrong.length ? wrong.map(([s, k]) => `${s} -> ${roles.normaliseRole(s)} (want ${k})`).join("; ") : `${spellings.length} spellings`);

  // A role compared as stored is the bug. Nothing in the server or the client
  // may do it again, and nobody keeps a private copy of the normaliser.
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "generated") walk(p); }
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  } };
  walk(path.join(REPO, "artifacts/api-server/src/routes"));
  walk(path.join(REPO, "artifacts/api-server/src/lib"));
  walk(path.join(REPO, "artifacts/beach-volleyball/src/pages"));
  walk(path.join(REPO, "artifacts/beach-volleyball/src/components"));
  const RAW = /\.role\s*(===|!==)\s*"[A-Za-z_ ]+"|\.includes\([a-z]+\.role\)|ROLE_[A-Z_]+\[(member|s|m)\.role\]|const normaliseRole\s*=/;
  const offenders = files.filter((f) => RAW.test(stripComments(fs.readFileSync(f, "utf8"))))
    .map((f) => path.relative(REPO, f));
  check("no route or page compares a staff role as stored, or keeps its own normaliser", offenders.length === 0,
    offenders.length ? offenders.join(", ") : `${files.length} files`);

  // The panel: keyed by normalised role, and every hired role has a bonus in it.
  const staffPage = read("artifacts/beach-volleyball/src/pages/staff.tsx");
  const bonusKeys = [...staffPage.matchAll(/^  ([a-z_]+):\s*\{ icon:/gm)].map((m) => m[1]);
  check("the Staff page's bonus panel looks roles up normalised",
    /new Set<string \| null>\(staff\.map\(s => normaliseRole\(s\.role\)\)\)/.test(staffPage));
  const listed = HIRE.map((r) => roles.normaliseRole(r)).filter((k) => bonusKeys.includes(k));
  // P-07: the scout mission dialog assigns a Scout, so it lists Scouts - GET
  // /staff is every hired role, and it used to be mapped straight into the list.
  const scouting = stripComments(read("artifacts/beach-volleyball/src/pages/continental-scouting.tsx"));
  check("the scout mission dropdown lists hired Scouts only, and says so when there are none (P-07)",
    /const scouts = \(staff \?\? \[\]\)\.filter\(\(s\) => isRole\(s\.role, "scout"\)\)/.test(scouting)
      && /\{scouts\.map\(/.test(scouting) && !/\{staff\.map\(/.test(scouting)
      && /scouts\.length === 0 && \(\s*<NeedAScoutMessage/.test(scouting));
  check("so all four hired Title-Case roles show a bonus there", listed.length === 4,
    `panel keys: ${bonusKeys.join(", ")}; hired -> ${HIRE.map((r) => roles.normaliseRole(r)).join(", ")}`);
}

if (!fs.existsSync(SERVER)) { console.error(`[staff-bonuses] FAILED: ${SERVER} not built.`); process.exit(1); }

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

const dbFile = path.join(WORK, "bonuses.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "staff-bonuses" },
});

try {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const api = session();
  const prof = await api("POST", "/profiles", { name: "Bonus Tester" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const clubs = (await api("GET", "/club-templates")).data;
  const club = (Array.isArray(clubs) ? clubs : clubs?.clubs ?? [])[0];
  const created = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Bonus Tester", managerNationality: "Australia", clubName: club.name,
    originalClubName: club.name, budget: club.startingBudget, difficulty: "established",
    primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0,
  });
  check("a career is created", created.status < 300, `HTTP ${created.status}`);

  const squad = (r) => [...(r?.starters ?? []), ...(r?.interchanges ?? []), ...(r?.reserves ?? [])];
  const players = squad((await api("GET", "/team/roster")).data).filter((p) => !p.isInjured);
  const player = players.sort((a, b) => (a.fatigue ?? 0) - (b.fatigue ?? 0))[0];

  /** One Power Camp for `player`: what it awarded, and the fatigue it added. */
  async function powerCamp() {
    // Item 19: the session runs its 7 game days; its row records what it gave.
    const { status, result: r } = await trainThroughCalendar(api, { playerId: player.id, type: "Power Camp", durationHours: 2 }, dbFile);
    return {
      status, xpGained: r?.xpGained, baseXp: r?.baseXp,
      staffBonuses: r ? { xpMultiplier: r.staffXpMultiplier, fatigueReduction: r.staffFatigueReduction } : null,
      fatigueAdded: r?.fatigueAfter - r?.fatigueBefore, ratio: r?.xpGained / r?.baseXp,
    };
  }

  // ── 1. Training, before and after ────────────────────────────────────────
  console.log("\n1. TRAINING: HEAD COACH, ASSISTANT COACH, FITNESS TRAINER");
  const bare = await powerCamp();
  check("with no staff, the session reports no staff bonus",
    bare.status === 200 && bare.staffBonuses?.xpMultiplier === 1 && bare.staffBonuses?.fatigueReduction === 0,
    JSON.stringify(bare.staffBonuses));
  check("and a Power Camp adds its full fatigue", Math.abs(bare.fatigueAdded - POWER_CAMP_FATIGUE) < 0.01,
    `+${bare.fatigueAdded}`);

  const hired = {};
  for (const roleName of HIRE) {
    const key = roles.normaliseRole(roleName);
    // An unscouted candidate's skill is hidden on the market (item 7): the test
    // picks the strongest by the database's own skill, and takes the skill it
    // expects the bonus from off the staff list once she is hired.
    const market = (await api("GET", `/staff/market?role=${key}`)).data ?? [];
    const skillOf = (() => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return new Map(d.prepare("SELECT id, skill_level FROM staff").all().map((r) => [r.id, r.skill_level])); } finally { d.close(); } })();
    const pick = market.filter((m) => m.role === roleName).sort((a, b) => (skillOf.get(b.id) ?? 0) - (skillOf.get(a.id) ?? 0))[0];
    const h = pick ? await api("POST", "/staff", { staffId: pick.id, length: "6m" }) : { status: 0 };
    hired[key] = ((await api("GET", "/staff")).data ?? []).find((s) => s.id === pick?.id);
    check(`hired a ${roleName} stored as "${pick?.role}" (the market's ${key} filter found it)`,
      h.status === 201 && pick?.role === roleName && typeof hired[key]?.skillLevel === "number",
      `${pick?.name ?? "none"}, skill ${hired[key]?.skillLevel}, HTTP ${h.status}`);
  }

  const withStaff = await powerCamp();
  const above = (m) => Math.max(0, m.skillLevel - 50);
  const wantXp = (1 + above(hired.head_coach) * (0.15 / 45)) * (1 + above(hired.assistant_coach) * (0.08 / 45));
  const wantFatigue = above(hired.fitness_trainer) * (5 / 45);
  check("the session now reports the coaches' XP multiplier and the trainer's fatigue reduction",
    Math.abs(withStaff.staffBonuses?.xpMultiplier - wantXp) < 1e-9 && Math.abs(withStaff.staffBonuses?.fatigueReduction - wantFatigue) < 1e-9 && wantXp > 1 && wantFatigue > 0,
    `x${withStaff.staffBonuses?.xpMultiplier?.toFixed(4)} (want x${wantXp.toFixed(4)}), -${withStaff.staffBonuses?.fatigueReduction?.toFixed(3)} fatigue (want -${wantFatigue.toFixed(3)})`);
  // XP awarded = round(baseXp x everything). Everything but the staff is the
  // same player on the same program, so the ratio moves by the staff alone.
  // Each ratio carries up to 0.5/baseXp of rounding.
  const tol = 0.5 / bare.baseXp + 0.5 / withStaff.baseXp;
  const measured = withStaff.ratio / bare.ratio;
  check("and XP per point of base XP really rose by that multiplier",
    Math.abs(withStaff.ratio - bare.ratio * wantXp) <= tol * wantXp + 1e-9,
    `${bare.xpGained}/${bare.baseXp} -> ${withStaff.xpGained}/${withStaff.baseXp}: x${measured.toFixed(3)} measured, x${wantXp.toFixed(3)} expected (+/-${(tol * 100).toFixed(1)}%)`);
  // Fatigue is whole points, so the reduction is applied rounded.
  check("and the Power Camp really added less fatigue, by the trainer's reduction (whole points)",
    withStaff.fatigueAdded === Math.round(POWER_CAMP_FATIGUE - wantFatigue) && withStaff.fatigueAdded < bare.fatigueAdded,
    `+${bare.fatigueAdded} -> +${withStaff.fatigueAdded} (expected +${Math.round(POWER_CAMP_FATIGUE - wantFatigue)})`);

  // ── 2. Sponsorship ───────────────────────────────────────────────────────
  console.log("\n2. SPONSORSHIP: PROMOTIONAL MANAGER");
  const wantPromo = 1 + above(hired.promotions_manager) * (0.18 / 45);
  let weekly = null;
  // Only a week paid from here on: since item 19 the training sessions above take
  // game days, so earlier weekly rows (before the manager was hired) are on the ledger.
  const seen = new Set(((await api("GET", "/finances")).data ?? []).map((t) => t.id));
  for (let day = 0; day < 21 && !weekly; day++) {
    await api("POST", "/calendar/advance");
    const txs = (await api("GET", "/finances")).data ?? [];
    weekly = txs.find((t) => !seen.has(t.id) && t.category === "sponsorship" && /^Weekly sponsor & commercial income/.test(t.description));
  }
  const amount = Number(weekly?.amount);
  const base = Math.round(amount / wantPromo / SPONSOR_INCOME_PER_REPUTATION) * SPONSOR_INCOME_PER_REPUTATION;
  check("a week's sponsor income is paid with the manager on the staff", !!weekly, weekly?.description ?? "none in 3 weeks");
  check("and it is the unboosted reputation x 200 times the manager's multiplier",
    !!weekly && base > 0 && Math.round(base * wantPromo) === amount && amount > base,
    `$${amount} = $${base} x ${wantPromo.toFixed(4)}`);
  check("and the ledger says why", new RegExp(`\\(\\+${Math.round((wantPromo - 1) * 100)}% Promotions Manager bonus\\)`).test(weekly?.description ?? ""),
    weekly?.description);

  const offers = (await api("GET", "/finances/sponsor-offers")).data ?? [];
  const offer = offers.find((o) => Number(o.signingBonus) > 0);
  if (offer) {
    const acc = await api("POST", `/finances/sponsor-offers/${offer.id}/accept`);
    check("a sponsor's signing bonus is boosted by the same multiplier",
      acc.status === 200 && acc.data?.signingBonus === Math.round(Number(offer.signingBonus) * wantPromo),
      `$${offer.signingBonus} offered -> $${acc.data?.signingBonus} paid`);
  } else {
    check("a sponsor offer with a signing bonus exists to test", false, `${offers.length} offers`);
  }
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* already stopped */ }
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
