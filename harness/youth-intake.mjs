/**
 * R-62 — an academy intake at every season boundary.
 *
 * Rob's decisions (15 Sep): the player's club only (AI clubs stay fixed pairs);
 * 3 per intake; ages 16-18; the blank youth template card the 72 shipped youth
 * wear (the 89 unused adult portraits are not for youth); name and nationality
 * from the club's country and region; ratings from the shipped youth's
 * distribution; Club News reports each intake, and says so when the academy
 * finds no one.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 *   code       the seeded distribution in utils/youthIntake.ts IS the 72 shipped
 *              youth, measured again from the starter DB; the template card is on
 *              disk; the rules page says what the intake does; the starter DB owns
 *              no players and has no intakes
 *   intakes    a five-season career: the four boundaries that open a season each
 *              bring one intake of 3 (the fifth boundary ends the career), dated
 *              the new season's first day, none at career creation
 *   players    every new player: the template card, and that file exists on disk;
 *              a youth player aged 16-18, owned by this career, in the club's
 *              academy (reserve, not active, academy contract); every rating inside
 *              the shipped youth's range; a nation of the club's region; a name no
 *              other athlete has, whose first name and surname both belong to real
 *              athletes of that nation
 *   news       Club News reports each intake with its names, on its date
 *   isolation  another career is never seeded with them
 *   dry        with every name taken, the next intake creates no one and Club News
 *              says the academy found no one
 *   pool       reports how many names the club's region holds, and how many
 *              seasons of intakes that is
 *
 * Usage: node harness/youth-intake.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const { nationName, CORE_NATIONS, continentKeyForNationality } =
  await import(pathToFileURL(path.join(REPO, "lib", "db", "src", "schema", "continents.ts")).href);
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PUBLIC = path.join(REPO, "artifacts", "beach-volleyball", "public");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-intake-"));
const PORT = 4820;
const BASE = `http://localhost:${PORT}/api`;
const CLUB_COUNTRY = "Brazil"; // locationId 1, Copacabana Beach
const INTAKE_SIZE = 3;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-62 ACADEMY INTAKE");
console.log("=".repeat(72));

// ── 0. Code and data ────────────────────────────────────────────────────────
console.log("\n0. THE CODE AND THE DATA");
const src = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const intakeSrc = src("artifacts/api-server/src/utils/youthIntake.ts");
const rules = src("artifacts/beach-volleyball/src/pages/rules.tsx");
{
  const starter = new DatabaseSync(SHIPPED, { readOnly: true });
  const youth = starter.prepare("SELECT * FROM players WHERE player_type = 'youth'").all();
  const declared = {};
  for (const m of intakeSrc.matchAll(/(\w+):\s*\{\s*mean:\s*([\d.]+),\s*sd:\s*([\d.]+),\s*min:\s*(\d+),\s*max:\s*(\d+)\s*\}/g)) {
    declared[m[1]] = { mean: Number(m[2]), sd: Number(m[3]), min: Number(m[4]), max: Number(m[5]) };
  }
  const drift = [];
  for (const stat of ["speed", "power", "defense", "serve", "block", "stamina", "height"]) {
    const v = youth.map((r) => r[stat]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
    const d = declared[stat];
    if (!d || Math.abs(d.mean - mean) > 0.006 || Math.abs(d.sd - sd) > 0.006 || d.min !== Math.min(...v) || d.max !== Math.max(...v)) {
      drift.push(`${stat}: declared ${JSON.stringify(d)}, measured mean ${mean.toFixed(2)} sd ${sd.toFixed(2)} ${Math.min(...v)}-${Math.max(...v)}`);
    }
  }
  const tally = (col) => youth.reduce((acc, r) => ({ ...acc, [r[col]]: (acc[r[col]] ?? 0) + 1 }), {});
  const declaredMix = (name) => Object.fromEntries([...(new RegExp(`${name}[^=]*=\\s*\\{([^}]*)\\}`).exec(intakeSrc)?.[1] ?? "")
    .matchAll(/(\w+):\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]));
  const sameMix = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
  check("the intake's ratings are the 72 shipped youth's distribution, measured again from the starter DB",
    youth.length === 72 && drift.length === 0
      && sameMix(declaredMix("SEEDED_YOUTH_POSITIONS"), tally("position"))
      && sameMix(declaredMix("SEEDED_YOUTH_POTENTIAL"), tally("potential")),
    drift.join("; ") || `${youth.length} youth; positions ${JSON.stringify(tally("position"))}; potential ${JSON.stringify(tally("potential"))}`);

  const template = /YOUTH_TEMPLATE_IMAGE = "([^"]+)"/.exec(intakeSrc)?.[1];
  check("the template card is the one every shipped youth wears, and it is on disk",
    !!template && youth.every((r) => r.image_url === template) && fs.existsSync(path.join(PUBLIC, template)),
    template);
  check("the starter DB owns no players and holds no intakes",
    starter.prepare("SELECT COUNT(*) AS n FROM players WHERE origin_career_save_id IS NOT NULL").get().n === 0
      && starter.prepare("SELECT COUNT(*) AS n FROM youth_intakes").get().n === 0);
  starter.close();
}
check("the rules page says what the intake does",
  /three youth players aged 16 to 18 join your club's academy/.test(rules)
    && /half come from your club's country, the rest from the other nations of its region/.test(rules)
    && /same spread as the game's other youth players/.test(rules)
    && /Only your club takes an intake/.test(rules));

if (!fs.existsSync(SERVER)) { console.error(`[intake] FAILED: ${SERVER} not built.`); process.exit(1); }
const dbFile = path.join(WORK, "intake.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "intake-secret" },
});
{
  const deadline = Date.now() + 60000;
  let up = false;
  while (Date.now() < deadline) { try { await fetch(`${BASE}/health`); up = true; break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
  if (!up) { console.error("[intake] server never came up"); process.exit(1); }
}

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
function read(sqlText, ...args) {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const rows = d.prepare(sqlText).all(...args);
  d.close();
  return rows;
}

/** Renew every contract that ends within the current season (R-48), as a manager would. */
async function renewExpiringContracts(api) {
  const season = (await api("GET", "/seasons/current")).data;
  const contracts = (await api("GET", "/contracts")).data;
  if (!season?.endDate || !Array.isArray(contracts)) return;
  for (const c of contracts.filter((k) => k.endDate <= season.endDate)) await api("POST", `/contracts/${c.id}/renew`);
}

async function newCareer(name) {
  const api = session();
  const prof = await api("POST", "/profiles", { name });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: name, managerNationality: "Brazil", clubName: `${name} FC`, originalClubName: `${name} FC`,
    season: "Season 1", budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a", difficulty: "established",
  });
  if (c.status >= 400) throw new Error(`career ${name}: ${c.status} ${JSON.stringify(c.data)}`);
  // Test setup, on this harness's own DB copy: the seeded squad is made the best
  // in the world so the board has no reason to sack a career this suite needs to
  // play to its end. Nothing about the intake reads squad ratings.
  const w = new DatabaseSync(dbFile);
  w.prepare(`UPDATE career_player_state SET speed = 99, power = 99, defense = 99, serve = 99, block = 99, stamina = 99
             WHERE career_save_id = ? AND team_id = ?`).run(c.data.id, c.data.teamId);
  w.close();
  return { api, careerSaveId: c.data.id, teamId: c.data.teamId };
}

/**
 * Play a career day by day, renewing contracts at each season start, until it
 * has rolled `stopAfter` times or completed. Each boundary that opens a season
 * is recorded with its rollover body, the club's news and roster right after it.
 */
async function play(career, stopAfter) {
  const { api } = career;
  const rolls = [];
  await renewExpiringContracts(api);
  for (let day = 0; day < 4000; day++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) throw new Error(`advance ${r.status} ${JSON.stringify(r.data)}`);
    if (r.data?.fired) return { rolls, sacked: true };
    if (r.data?.blocked === "pending_match") {
      healAllSquads(dbFile); // R-80: a forfeit here would be measured as a played match
      let sim = await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      if (sim.status >= 400) sim = await api("POST", `/matches/${r.data.pendingMatchId}/forfeit`, {});
      if (sim.data?.fired) return { rolls, sacked: true };
      continue;
    }
    const roll = r.data?.seasonRollover;
    if (roll?.kind === "sacked") return { rolls, sacked: true };
    if (roll?.kind === "career-complete") return { rolls, complete: roll };
    if (roll?.kind === "rolled") {
      rolls.push({
        roll,
        news: (await api("GET", "/news")).data?.items ?? [],
        roster: (await api("GET", "/team/roster")).data,
      });
      if (rolls.length >= stopAfter) return { rolls };
      await renewExpiringContracts(api);
    }
  }
  throw new Error("the career never reached its end");
}

try {
  // ── 1. A five-season career ───────────────────────────────────────────────
  console.log("\n1. A FIVE-SEASON CAREER");
  let career, run;
  for (let attempt = 1; attempt <= 3; attempt++) {
    career = await newCareer(`Academy${attempt}`);
    run = await play(career, 99);
    if (!run.sacked) break;
    console.log(`  (career ${attempt} was sacked before season 5; starting another)`);
  }
  const { careerSaveId, teamId } = career;
  check("the career played all five seasons", !!run.complete && run.complete.finalSeason === 5,
    run.complete ? `final season ${run.complete.finalSeason}` : "sacked three times");

  // ── 2. The intakes ────────────────────────────────────────────────────────
  console.log("\n2. THE INTAKES");
  const rows = read(`SELECT season_year, intake_on, player_ids, team_id FROM youth_intakes WHERE career_save_id = ? ORDER BY season_year`, careerSaveId)
    .map((r) => ({ ...r, ids: JSON.parse(r.player_ids) }));
  console.log(`  REPORT  a five-season career crosses 5 boundaries: 4 open a season (2027-2030) and bring an intake; the 5th ends the career`);
  check("four intakes, one for each season the career opened (2027-2030), none at career creation",
    rows.length === 4 && JSON.stringify(rows.map((r) => r.season_year)) === JSON.stringify([2027, 2028, 2029, 2030]),
    JSON.stringify(rows.map((r) => r.season_year)));
  check(`each intake is ${INTAKE_SIZE} players, for the player's club, dated the new season's first day`,
    rows.every((r) => r.ids.length === INTAKE_SIZE && r.team_id === teamId && r.intake_on === `${r.season_year}-01-01`),
    rows.map((r) => `${r.season_year}: ${r.ids.length} on ${r.intake_on}`).join(" | "));
  check("each rollover reports the intake it made",
    run.rolls.length === 4 && run.rolls.every((x, i) => JSON.stringify(x.roll.intake?.players.map((p) => p.id)) === JSON.stringify(rows[i]?.ids)));
  check("each intake joined the club's academy the day it arrived",
    run.rolls.every((x, i) => (rows[i]?.ids ?? []).every((id) => (x.roster?.reserves ?? []).some((p) => p.id === id && p.squadRole === "reserve"))),
    run.rolls.map((x) => `${(x.roster?.reserves ?? []).length} reserves`).join(" | "));

  // ── 3. The players ────────────────────────────────────────────────────────
  console.log("\n3. THE NEW PLAYERS");
  const ids = rows.flatMap((r) => r.ids);
  const players = ids.map((id) => read(`SELECT p.*, s.team_id AS state_team, s.academy_contract_years AS academy_years
    FROM players p JOIN career_player_state s ON s.player_id = p.id AND s.career_save_id = ? WHERE p.id = ?`, careerSaveId, id)[0]).filter(Boolean);
  const template = /YOUTH_TEMPLATE_IMAGE = "([^"]+)"/.exec(intakeSrc)?.[1];
  check("every new player has a card, and the file exists on disk",
    players.length === ids.length && players.every((p) => p.image_url && fs.existsSync(path.join(PUBLIC, p.image_url))),
    `${players.length} players`);
  check("every card is the youth template card, as for the 72 shipped youth (Rob: the adult portraits are not for youth)",
    players.every((p) => p.image_url === template));
  check("every one a youth player aged 16-18 at intake, owned by this career",
    players.every((p) => p.player_type === "youth" && p.base_age >= 16 && p.base_age <= 18 && p.origin_career_save_id === careerSaveId),
    `ages ${players.map((p) => p.base_age).join(",")}`);
  check("every one still at the club with an academy contract at the end of the career",
    players.every((p) => p.state_team === teamId && p.academy_years != null));
  const RANGE = { speed: [44, 64], power: [34, 74], defense: [34, 64], serve: [36, 68], block: [32, 76], stamina: [40, 66], height: [163, 193] };
  const outOfRange = players.filter((p) => Object.entries(RANGE).some(([k, [lo, hi]]) => p[k] < lo || p[k] > hi));
  const avg = (k) => (players.reduce((a, p) => a + p[k], 0) / players.length).toFixed(1);
  check("every rating inside the range the shipped youth span",
    outOfRange.length === 0, outOfRange.map((p) => p.name).join(", ") || `means: ${Object.keys(RANGE).map((k) => `${k} ${avg(k)}`).join(", ")}`);

  const region = continentKeyForNationality(CLUB_COUNTRY);
  const regionNations = CORE_NATIONS[region];
  const home = players.filter((p) => p.nationality === CLUB_COUNTRY).length;
  check(`every nationality is a nation of the club's region (${region})`,
    players.every((p) => regionNations.includes(p.nationality)),
    `${home} of ${players.length} from ${CLUB_COUNTRY}; others ${players.filter((p) => p.nationality !== CLUB_COUNTRY).map((p) => p.nationality).join(", ")}`);

  const athletes = [
    ...read(`SELECT id, name, nationality FROM players WHERE origin_career_save_id IS NULL`),
    ...read(`SELECT NULL AS id, name, nationality FROM continental_pool_players`),
  ];
  const everyName = [...read(`SELECT id, name FROM players`), ...read(`SELECT NULL AS id, name FROM continental_pool_players`)];
  const clash = players.filter((p) => everyName.some((a) => a.name === p.name && a.id !== p.id));
  check("every name is new: no other athlete, shipped, pool or created, has it", clash.length === 0,
    clash.map((p) => p.name).join(", ") || players.map((p) => `${p.name} (${p.nationality})`).join(", "));
  const unfit = players.filter((p) => {
    const [first, ...rest] = p.name.split(" ");
    const last = rest.join(" ");
    const ofNation = athletes.filter((a) => a.nationality && nationName(a.nationality) === nationName(p.nationality));
    return !ofNation.some((a) => a.name.split(" ")[0] === first) || !ofNation.some((a) => a.name.split(" ").slice(1).join(" ") === last);
  });
  check("every first name and surname belongs to a real athlete of that nation", unfit.length === 0,
    unfit.map((p) => `${p.name} (${p.nationality})`).join(", "));

  // ── 4. Club News ──────────────────────────────────────────────────────────
  console.log("\n4. CLUB NEWS");
  const newsOk = run.rolls.map((x, i) => {
    const r = rows[i];
    const item = x.news.find((n) => n.id === `academy-${r?.season_year}`);
    const names = players.filter((p) => r?.ids.includes(p.id)).map((p) => p.name);
    const ok = !!item && !!r && item.type === "academy" && item.date === r.intake_on
      && /^3 youth players join the .+ academy$/.test(item.headline)
      && names.length === INTAKE_SIZE && names.every((n) => item.detail.includes(n));
    return { year: r?.season_year, ok, item };
  });
  check("Club News reports each intake, with its three names, on its date",
    newsOk.length === 4 && newsOk.every((n) => n.ok), newsOk.map((n) => `${n.year}: ${n.item ? `"${n.item.headline}"` : "missing"}`).join(" | "));

  // ── 5. Another career, and a dry academy ──────────────────────────────────
  console.log("\n5. ANOTHER CAREER NEVER SEES THEM; A DRY ACADEMY SAYS SO");
  const other = await newCareer("Elsewhere");
  const leaked = read(`SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ? AND player_id IN (${ids.join(",")})`, other.careerSaveId)[0].n;
  const pool = (await other.api("GET", "/players/youth-pool")).data ?? [];
  check("a new career is not seeded with another career's intake", leaked === 0 && !pool.some((p) => ids.includes(p.id)),
    `${leaked} state rows; ${pool.length} in the new career's youth pool`);

  // Pool size, from the same rule the intake applies (first name x surname of a
  // nation's real athletes, less every name already in use).
  const taken = new Set(everyName.map((a) => a.name));
  let regionNames = 0;
  const perNation = [];
  for (const nation of regionNations) {
    const firsts = new Set(), lasts = new Set();
    for (const a of athletes) {
      if (!a.nationality || nationName(a.nationality) !== nationName(nation)) continue;
      const parts = a.name.trim().split(/\s+/);
      if (parts.length < 2 || parts.slice(1).join(" ").includes(".")) continue;
      firsts.add(parts[0]); lasts.add(parts.slice(1).join(" "));
    }
    let n = 0;
    for (const f of firsts) for (const l of lasts) if (!taken.has(`${f} ${l}`)) n++;
    regionNames += n;
    perNation.push(`${nation} ${n}`);
  }
  console.log(`  REPORT  the club's region (${region}) still holds ${regionNames} unused names after this career's ${ids.length}: ` +
    `${Math.floor(regionNames / INTAKE_SIZE)} more seasons of intakes of ${INTAKE_SIZE} (${perNation.join(", ")}). The card is a template, so cards never run out.`);
  check("the academy never ran dry in five seasons, and the region holds names for many more",
    rows.every((r) => r.ids.length === INTAKE_SIZE) && regionNames >= 5 * INTAKE_SIZE, `${regionNames} names left`);

  // Test setup on this harness's own DB copy: every first name x surname in the
  // world is given to a parked athlete (player_type 'spare', owned by no real
  // career), so the next intake has no name left to give anyone.
  {
    const firsts = new Set(), lasts = new Set();
    for (const a of athletes) {
      const parts = a.name.trim().split(/\s+/);
      if (parts.length < 2) continue;
      firsts.add(parts[0]); lasts.add(parts.slice(1).join(" "));
    }
    const w = new DatabaseSync(dbFile);
    const ins = w.prepare(`INSERT INTO players (name, nationality, base_age, player_type, origin_career_save_id, created_at)
                           VALUES (?, 'Brazil', 30, 'spare', -1, 0)`);
    w.exec("BEGIN");
    let n = 0;
    for (const f of firsts) for (const l of lasts) { const full = `${f} ${l}`; if (!taken.has(full)) { ins.run(full); n++; } }
    w.exec("COMMIT");
    w.close();
    console.log(`  (took ${n} names: ${firsts.size} first names x ${lasts.size} surnames)`);
  }
  const before = read(`SELECT COUNT(*) AS n FROM players WHERE origin_career_save_id = ?`, other.careerSaveId)[0].n;
  const dry = await play(other, 1);
  const dryRow = read(`SELECT season_year, player_ids FROM youth_intakes WHERE career_save_id = ?`, other.careerSaveId);
  const after = read(`SELECT COUNT(*) AS n FROM players WHERE origin_career_save_id = ?`, other.careerSaveId)[0].n;
  const dryNews = dry.rolls[0]?.news.find((n) => n.id === "academy-2027");
  check("with no name left, the intake creates no one: never a player without a real name",
    !dry.sacked && dryRow.length === 1 && JSON.parse(dryRow[0].player_ids).length === 0 && after === before && dry.rolls[0]?.roll.intake?.players.length === 0,
    `${dryRow.length} intake row(s), ${dryRow[0] ? JSON.parse(dryRow[0].player_ids).length : "-"} players; ${after - before} created`);
  check("Club News says the academy found no one that year",
    !!dryNews && /academy found no one this year$/.test(dryNews.headline) && dryNews.date === "2027-01-01",
    dryNews ? `"${dryNews.headline}" ${dryNews.date}` : "no academy-2027 item");
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
