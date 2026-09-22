/**
 * L-02d — a club keeps four of its own graduates, and can trade them.
 *
 * Rob's rule (22 Sep): max 4 graduates held per club; a club over the cap
 * releases down to four at the season boundary; graduates can be bought and
 * sold through the ordinary market without ever having played a match; and a
 * graduate's contract has an end date, so an unused one goes back to the pool
 * when it runs out.
 *
 * Nothing capped promotion before this. A signing is refused past MAX_SENIORS
 * (three), but the rollover's own promotion at 19 and the Team page's role
 * change both wrote straight past it. The thirty-season runs show what that
 * does: by season sixteen a club was carrying ninety-odd players on its books
 * and paying every one of them every week.
 *
 * Own database, own server on port 4525. Academy players are put in place with
 * a direct write — they arrive through a season's intake, and walking a career
 * to three intakes would take ten minutes to set up what one insert sets up.
 *
 * Usage: node harness/graduates.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-graduates-"));
const PORT = 4525;

/** Read from the source so the suite cannot disagree with the game about the cap. */
const GRADUATE_CAP = Number(
  /GRADUATE_CAP = (\d+)/.exec(
    fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/squadRules.ts"), "utf8"),
  )?.[1],
);

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log(`  L-02d A CLUB KEEPS ${GRADUATE_CAP} OF ITS OWN GRADUATES, AND CAN TRADE THEM`);
console.log("=".repeat(72));

const dbFile = path.join(WORK, "graduates.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");

const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "graduates-secret",
  },
});

const BASE = `http://localhost:${PORT}/api`;
let cookie = "";
const api = async (method, p, body) => {
  const res = await fetch(BASE + p, {
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

const read = (q, ...a) => {
  const d = new DatabaseSync(dbFile, { readOnly: true });
  const r = d.prepare(q).all(...a);
  d.close();
  return r;
};
const write = (q, ...a) => {
  const d = new DatabaseSync(dbFile);
  d.prepare(q).run(...a);
  d.close();
};

try {
  const dl = Date.now() + 30000;
  for (;;) {
    if (Date.now() > dl) throw new Error("server never came up");
    try { await fetch(`${BASE}/healthz`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  const prof = await api("POST", "/profiles", { name: "Graduates" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const career = await api("POST", "/careers", {
    slotNumber: 1, managerName: "Graduates", managerNationality: "Australia",
    clubName: "Graduates FC", originalClubName: "Graduates FC",
    budget: "500000", difficulty: "established",
    primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
    season: "Season 1", locationId: 1,
  });
  check("a career was created", career.status === 200, `HTTP ${career.status}`);
  const careerSaveId = career.data?.id;
  const teamId = career.data?.teamId;

  // ── An academy to promote out of ──────────────────────────────────────────
  // Eight 18-year-olds on academy terms. An intake would give three a season;
  // this is the same state, three seasons sooner.
  const youth = read(
    `SELECT ps.player_id AS id, p.name FROM career_player_state ps
       JOIN players p ON p.id = ps.player_id
      WHERE ps.career_save_id = ? AND ps.team_id IS NULL AND p.player_type = 'youth'
        AND ps.is_promoted = 0
      LIMIT 8`, careerSaveId);
  check("there are youth players to put in the academy", youth.length === 8, `${youth.length}`);
  for (const y of youth) {
    write(`UPDATE career_player_state
              SET team_id = ?, age = 18, academy_contract_years = 2,
                  squad_role = 'reserve', is_active = 0
            WHERE career_save_id = ? AND player_id = ?`, teamId, careerSaveId, y.id);
  }

  // ── 1. The cap, at the moment of promotion ────────────────────────────────
  console.log(`\n1. A CLUB MAY PROMOTE ${GRADUATE_CAP}, AND IS TOLD WHY NOT THE FIFTH`);
  const results = [];
  for (const y of youth.slice(0, GRADUATE_CAP + 2)) {
    const r = await api("PATCH", `/team/roster/${y.id}/role`, { role: "interchange", length: "1s" });
    results.push({ name: y.name, status: r.status, error: r.data?.error ?? null });
  }
  const accepted = results.filter((r) => r.status === 200);
  const refused = results.filter((r) => r.status !== 200);
  check(`exactly ${GRADUATE_CAP} promotions were accepted`, accepted.length === GRADUATE_CAP,
    results.map((r) => `${r.name}:${r.status}`).join(" "));
  check("the rest were refused, and the message says what to do",
    refused.length === results.length - GRADUATE_CAP &&
    refused.every((r) => r.status === 422 && /release/i.test(r.error ?? "")),
    refused.map((r) => `${r.status} ${r.error}`).join(" | ") || "none refused");

  const held = () => read(
    `SELECT ps.player_id AS id, p.name FROM career_player_state ps
       JOIN players p ON p.id = ps.player_id
      WHERE ps.career_save_id = ? AND ps.team_id = ? AND ps.is_retired = 0
        AND p.player_type = 'youth' AND ps.is_promoted = 1`, careerSaveId, teamId);
  check(`the club holds ${GRADUATE_CAP} graduates`, held().length === GRADUATE_CAP, `${held().length}`);

  // Every one of them signed a senior contract on promotion (L-02a).
  const deals = read(
    `SELECT COUNT(*) AS n FROM contracts
      WHERE team_id = ? AND status = 'active' AND end_date IS NOT NULL
        AND player_id IN (${held().map((g) => g.id).join(",")})`, teamId)[0].n;
  check("each graduate holds a contract with an end date on it", deals === GRADUATE_CAP, `${deals}`);

  // ── 2. A graduate is a player like any other ──────────────────────────────
  console.log("\n2. A GRADUATE CAN BE SOLD WITHOUT EVER HAVING PLAYED");
  const sold = held()[0];
  if (!sold) throw new Error("no graduate to sell — section 1 left the club with none");
  const played = read(
    `SELECT COUNT(*) AS n FROM unity_match_stats WHERE player_id = ?`, sold.id)[0]?.n ?? 0;
  check("the one being sold has never played a match", Number(played) === 0, `${played} appearances`);

  const release = await api("POST", `/players/${sold.id}/release`, {});
  check("releasing her is accepted", release.status === 200, `HTTP ${release.status}`);

  const market = (await api("GET", "/players/market-all?playerType=senior")).data ?? [];
  const onMarket = (Array.isArray(market) ? market : []).find((p) => p.id === sold.id);
  check("she is on the market as a free agent, with no matches behind her",
    !!onMarket && onMarket.status === "free_agent",
    onMarket ? `${onMarket.name}: ${onMarket.status}` : "not listed at all");

  // A club signs into its three senior places (MAX_SENIORS), which this one
  // filled at career creation, so one is freed first — the buying club always
  // has to make room for a signing, graduate or not.
  const signed = (await api("GET", "/team/roster")).data ?? {};
  const spare = (signed.starters ?? []).find((p) => !(p.playerType === "youth" && p.isPromoted));
  await api("POST", `/players/${spare?.id}/release`, {});

  const resign = await api("POST", "/contracts", {
    playerId: sold.id, salary: 4000, bonusPerWin: 0, squadRole: "starter", length: "1s",
  });
  check("and a club with a place free can sign her straight back", resign.status === 201,
    `HTTP ${resign.status} ${JSON.stringify(resign.data).slice(0, 90)}`);
  check("the graduate the club let go left no contract open behind her",
    read(`SELECT COUNT(*) AS n FROM contracts
           WHERE player_id = ? AND team_id = ? AND status = 'active'`, spare?.id, teamId)[0].n === 0,
    `${spare?.name ?? "?"} released`);

  // ── 3. The boundary takes back what forced promotion pushes over ──────────
  // The rollover promotes every academy player who turns 19, cap or no cap —
  // she is too old for the academy. That is the one way a club ends up holding
  // more than four, and the boundary is where it is put right.
  console.log(`\n3. THE SEASON BOUNDARY RELEASES WHATEVER IS OVER ${GRADUATE_CAP}`);
  for (const y of youth.slice(GRADUATE_CAP)) {
    write(`UPDATE career_player_state
              SET team_id = ?, is_promoted = 1, academy_contract_years = NULL,
                  squad_role = 'reserve', is_active = 0
            WHERE career_save_id = ? AND player_id = ?`, teamId, careerSaveId, y.id);
  }
  const before = held().length;
  check(`the club is over the cap on purpose: ${before} graduates`, before > GRADUATE_CAP, `${before}`);

  let rolled = null, stopped = "";
  for (let i = 0; i < 500; i++) {
    healAllSquads(dbFile);
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) { stopped = `advance HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`; break; }
    if (r.data?.blocked === "pending_match") {
      await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
      await api("POST", "/calendar/skip-match", {});
      continue;
    }
    const mid = r.data?.matchDay?.matchId;
    if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
    const roll = r.data?.seasonRollover;
    if (roll && roll.kind !== "none") { rolled = roll; break; }
  }
  check("the season rolled over", rolled !== null, stopped || "reached the boundary");

  const after = held();
  check(`the club came out of the boundary holding ${GRADUATE_CAP}`,
    after.length === GRADUATE_CAP, `${before} -> ${after.length}`);
  check("the rollover says who it let go",
    Array.isArray(rolled?.releasedGraduates) && rolled.releasedGraduates.length === before - GRADUATE_CAP,
    (rolled?.releasedGraduates ?? []).map((g) => `${g.name} (${g.overall})`).join(", ") || "reported nobody");

  // The weakest go, not whoever happened to be first.
  const keptRatings = read(
    `SELECT (speed + power + defense + serve + block + stamina) / 6.0 AS ovr
       FROM career_player_state WHERE career_save_id = ? AND player_id IN (${after.map((g) => g.id).join(",")})`,
    careerSaveId).map((r) => r.ovr);
  const goneRatings = (rolled?.releasedGraduates ?? []).map((g) => g.overall);
  check("the ones it let go are its weakest",
    goneRatings.length === 0 || Math.max(...goneRatings) <= Math.min(...keptRatings) + 0.5,
    `kept ${keptRatings.map((r) => r.toFixed(1)).join(", ")} · released ${goneRatings.join(", ")}`);

  const freed = read(
    `SELECT COUNT(*) AS n FROM career_player_state
      WHERE career_save_id = ? AND team_id IS NULL AND is_promoted = 1`, careerSaveId)[0].n;
  check("and the released graduates are back in the pool", freed >= before - GRADUATE_CAP, `${freed} free`);

  const loose = read(
    `SELECT COUNT(*) AS n FROM contracts c
       JOIN career_player_state ps ON ps.player_id = c.player_id AND ps.career_save_id = ?
      WHERE c.team_id = ? AND c.status = 'active' AND ps.team_id IS NULL`, careerSaveId, teamId)[0].n;
  check("with no contract left open behind them", loose === 0, `${loose} open`);

} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
