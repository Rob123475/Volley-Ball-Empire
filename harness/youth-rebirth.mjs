/**
 * L-02c — the academy refills itself for thirty seasons, in three regions.
 *
 * Rob's rule (22 Sep): whoever graduates out of the youth pool is replaced, so
 * the youth count does not move; the academy is never dry; and no player is
 * ever without a portrait.
 *
 * The old intake took three a season and no more. At the cap that happened to
 * replace the graduates exactly — but a season that promoted four left the
 * academy one short with nothing to bring it back, and a career that ran long
 * enough drained it. The thirty-season run (L-01) is the only thing that shows
 * this: four seasons look perfect.
 *
 * ── Why three careers at once ───────────────────────────────────────────────
 * The brief asks for three seeds, and a region is the seed that matters: the
 * names an intake can use come from the club's own country and the other
 * nations of its region (R-62), so South America, Oceania and Europe exercise
 * three different name pools of three different sizes. Thirty seasons each,
 * one after the other, is three quarters of an hour; run together it is the
 * length of the longest one.
 *
 * Usage: node harness/youth-rebirth.mjs   (SEASONS=30 by default)
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads, renewExpiringContracts, keepSideFielded } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PUBLIC = path.join(REPO, "artifacts", "beach-volleyball", "public");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-youth-rebirth-"));

const SEASONS = Number(process.env.SEASONS ?? 30);
const ACADEMY_CAP = 12;
/** Read from the source, so this suite cannot disagree with the game. */
const GRADUATE_CAP = Number(
  /GRADUATE_CAP = (\d+)/.exec(
    fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/squadRules.ts"), "utf8"),
  )?.[1],
);

/** Three clubs, three regions, three name pools. */
const SEEDS = [
  { label: "Brazil", locationId: 1, port: 4531 },
  { label: "Australia", locationId: 2, port: 4532 },
  { label: "Spain", locationId: 4, port: 4533 },
];

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log(`  L-02c THE ACADEMY REFILLS ITSELF — ${SEASONS} SEASONS x ${SEEDS.length} REGIONS`);
console.log("=".repeat(72));

function session(base) {
  let cookie = "";
  return async function api(method, p, body) {
    const res = await fetch(base + p, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get("set-cookie");
    if (sc) cookie = sc.split(";")[0];
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data };
  };
}

/** Walk one career to the next boundary, playing whatever the calendar blocks on. */
async function toBoundary(api, dbFile, maxDays = 600) {
  await keepSideFielded(api);
  await renewExpiringContracts(api);
  for (let i = 0; i < maxDays; i++) {
    healAllSquads(dbFile);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) return { stopped: `advance HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 90)}` };
    if (r.data?.blocked === "pending_match") {
      await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      await api("POST", "/calendar/skip-match", {});
      continue;
    }
    const mid = r.data?.matchDay?.matchId;
    if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
    const roll = r.data?.seasonRollover;
    if (roll && roll.kind !== "none") return { roll };
  }
  return { stopped: `no boundary in ${maxDays} days` };
}

async function runSeed(seed) {
  const dbFile = path.join(WORK, `${seed.label}.sqlite`);
  fs.copyFileSync(SHIPPED, dbFile);
  const out = fs.openSync(path.join(WORK, `${seed.label}.log`), "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(seed.port),
      NODE_ENV: "development", SESSION_SECRET: `youth-${seed.label}`,
    },
  });
  const base = `http://localhost:${seed.port}/api`;
  const api = session(base);
  const read = (q, ...a) => {
    const d = new DatabaseSync(dbFile, { readOnly: true });
    const r = d.prepare(q).all(...a);
    d.close();
    return r;
  };

  try {
    const dl = Date.now() + 40000;
    for (;;) {
      if (Date.now() > dl) throw new Error(`${seed.label}: server never came up`);
      try { await fetch(`${base}/healthz`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }

    const prof = await api("POST", "/profiles", { name: `Youth${seed.label}` });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const career = await api("POST", "/careers", {
      slotNumber: 1, managerName: `Youth${seed.label}`, managerNationality: "Australia",
      clubName: `Youth${seed.label} FC`, originalClubName: `Youth${seed.label} FC`,
      budget: "500000", difficulty: "established",
      primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
      season: "Season 1", locationId: seed.locationId,
    });
    if (career.status !== 200) throw new Error(`${seed.label}: career HTTP ${career.status}`);
    const careerSaveId = career.data.id;
    const teamId = career.data.teamId;

    const census = [];
    let sacked = null, stopped = null;
    for (let s = 1; s <= SEASONS; s++) {
      const step = await toBoundary(api, dbFile);
      if (step.stopped) { stopped = { season: s, why: step.stopped }; break; }
      if (step.roll?.review?.dismissed || step.roll?.kind === "career_over") { sacked = { season: s }; break; }

      // The academy, straight from the database: youth players at the club this
      // career has not promoted — the same definition the game uses.
      const [row] = read(
        `SELECT COUNT(*) AS n FROM career_player_state ps
           JOIN players p ON p.id = ps.player_id
          WHERE ps.career_save_id = ? AND ps.team_id = ? AND ps.is_retired = 0
            AND p.player_type = 'youth' AND ps.is_promoted = 0`, careerSaveId, teamId);
      // L-02d: and what the club is holding of its own graduates, which is the
      // other half of the same rule — an academy that refills for thirty
      // seasons into a club that never lets anybody go is how a squad of
      // ninety-three happens.
      const [grad] = read(
        `SELECT COUNT(*) AS n FROM career_player_state ps
           JOIN players p ON p.id = ps.player_id
          WHERE ps.career_save_id = ? AND ps.team_id = ? AND ps.is_retired = 0
            AND p.player_type = 'youth' AND ps.is_promoted = 1`, careerSaveId, teamId);
      const [squadRow] = read(
        `SELECT COUNT(*) AS n FROM career_player_state
          WHERE career_save_id = ? AND team_id = ? AND is_retired = 0`, careerSaveId, teamId);
      const intake = step.roll?.intake?.players?.length ?? 0;
      census.push({
        season: s, academy: Number(row?.n ?? 0), intake,
        graduates: Number(grad?.n ?? 0), squad: Number(squadRow?.n ?? 0),
      });
    }

    // Every athlete this career owns, portrait and all.
    const faceless = read(
      `SELECT p.id, p.name, p.image_url AS url FROM players p
         JOIN career_player_state ps ON ps.player_id = p.id
        WHERE ps.career_save_id = ? AND (p.image_url IS NULL OR p.image_url = '')`, careerSaveId);
    const created = read(
      `SELECT p.name, p.image_url AS url FROM players p
        WHERE p.origin_career_save_id = ?`, careerSaveId);
    const missingFile = created.filter((p) => !p.url || !fs.existsSync(path.join(PUBLIC, p.url)));
    const reused = read(
      `SELECT COUNT(*) AS n FROM player_retirements
        WHERE career_save_id = ? AND name_reused_at IS NOT NULL`, careerSaveId)[0]?.n ?? 0;
    const retired = read(
      `SELECT COUNT(*) AS n FROM player_retirements WHERE career_save_id = ?`, careerSaveId)[0]?.n ?? 0;

    return { seed, census, sacked, stopped, faceless, created: created.length, missingFile, reused: Number(reused), retired: Number(retired) };
  } finally {
    await stopServer(child);
    try { fs.closeSync(out); } catch { /* closed */ }
  }
}

const runs = await Promise.all(SEEDS.map((s) => runSeed(s).catch((err) => ({ seed: s, error: String(err) }))));

for (const run of runs) {
  const label = run.seed.label;
  console.log(`\n── ${label} (club in ${label}, ${run.census?.length ?? 0} seasons) ──`);
  if (run.error) { check(`${label}: the run finished`, false, run.error); continue; }

  const reached = run.census.length;
  check(`${label}: played ${SEASONS} seasons`, reached === SEASONS,
    run.sacked ? `sacked in season ${run.sacked.season}` : run.stopped ? `stopped in season ${run.stopped.season}: ${run.stopped.why}` : `${reached} seasons`);

  console.log(`  Season  Academy  Intake  Graduates  Squad`);
  for (const c of run.census) {
    console.log(`  ${String(c.season).padStart(6)}  ${String(c.academy).padStart(7)}  ${String(c.intake).padStart(6)}  ${String(c.graduates).padStart(9)}  ${String(c.squad).padStart(5)}`);
  }

  // Never dry. An academy at zero is a club with no future, and the fill rule
  // is the only thing standing between a long career and exactly that.
  const dry = run.census.filter((c) => c.academy === 0).map((c) => c.season);
  check(`${label}: the academy was never empty`, dry.length === 0,
    dry.length === 0 ? `smallest ${Math.min(...run.census.map((c) => c.academy))}` : `empty in season(s) ${dry.join(", ")}`);

  // The count does not move. It climbs to the cap over the first seasons —
  // a career starts with no academy at all — and from the season it gets there
  // it must never fall back, because every graduate is replaced.
  const atCap = run.census.findIndex((c) => c.academy >= ACADEMY_CAP);
  const after = atCap === -1 ? [] : run.census.slice(atCap);
  const dipped = after.filter((c) => c.academy !== ACADEMY_CAP);
  check(`${label}: once full, the youth count is the same every season after it`,
    atCap !== -1 && dipped.length === 0,
    atCap === -1 ? "never reached the cap" :
      dipped.length === 0 ? `${ACADEMY_CAP} from season ${run.census[atCap].season} to ${run.census[run.census.length - 1].season}` :
        dipped.map((c) => `S${c.season}:${c.academy}`).join(" "));

  // L-02d: the cap is a rule about what a club HOLDS, so the place to prove it
  // is a career that ran long enough to want to break it.
  const overCap = run.census.filter((c) => c.graduates > GRADUATE_CAP);
  check(`${label}: never held more than ${GRADUATE_CAP} of its own graduates`,
    overCap.length === 0,
    overCap.length === 0
      ? `most ${Math.max(...run.census.map((c) => c.graduates))}, biggest squad ${Math.max(...run.census.map((c) => c.squad))}`
      : overCap.map((c) => `S${c.season}:${c.graduates}`).join(" "));

  check(`${label}: no athlete in the career is without a portrait`,
    run.faceless.length === 0, run.faceless.map((p) => p.name).join(", ") || "every one has a card");
  check(`${label}: every card this career drew exists on disk`,
    run.missingFile.length === 0,
    run.missingFile.map((p) => `${p.name}: ${p.url ?? "none"}`).join(", ") || `${run.created} created athletes`);

  console.log(`  REPORT  ${run.retired} retirement(s); ${run.reused} of their names taken by a later intake`);
}

// The point of three seeds: the rule is the rule, not a property of Brazil.
const ok = runs.filter((r) => !r.error && r.census?.length === SEASONS).length;
check(`all ${SEEDS.length} regions ran the full ${SEASONS} seasons`, ok === SEEDS.length, `${ok} of ${SEEDS.length}`);

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
