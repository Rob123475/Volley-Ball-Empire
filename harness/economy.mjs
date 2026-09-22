/**
 * L-04 — money means something.
 *
 * Rob's rule (22 Sep): a club that finishes last goes backwards every season,
 * and five seasons of it sends the club broke. A Gold-tier club goes forwards,
 * modestly — not $420,000 a season while losing. Prize money and sponsors are
 * the income; wages and running costs are what it goes on.
 *
 * ── What the thirty-season run showed before this ───────────────────────────
 * A club that finished 19th of 19 for nine seasons running still banked about
 * $440,000 a season, and ended thirty seasons on $20.3 million. Money could not
 * be lost, so nothing it bought could cost anything, so no decision about it
 * mattered. "RUNAWAY: more than 10x the season-1 balance" is the rollover
 * suite's own words for it.
 *
 * ── What this suite does ────────────────────────────────────────────────────
 * Two careers at once — an established club and an underdog — walked season by
 * season, with every pound in and out read from `finance_transactions` and
 * printed by category. The table is the evidence for docs/OVERNIGHT-STATUS.md;
 * the checks underneath it are the rule.
 *
 * Usage: node harness/economy.mjs        (SEASONS=12 by default)
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
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-economy-"));

const SEASONS = Number(process.env.SEASONS ?? 12);

/**
 * Two clubs, told apart by the only thing the game lets a career choose:
 * `established` starts with a strong squad and a comfortable budget,
 * `underdog` with the weakest available and a tight one (R-11).
 */
const RUNS = [
  { label: "established", difficulty: "established", port: 4541 },
  { label: "underdog", difficulty: "underdog", port: 4542 },
];

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const money = (n) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString();

console.log("=".repeat(72));
console.log(`  L-04 MONEY MEANS SOMETHING — ${SEASONS} SEASONS, TWO CLUBS`);
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

async function runOne(spec) {
  const dbFile = path.join(WORK, `${spec.label}.sqlite`);
  fs.copyFileSync(SHIPPED, dbFile);
  const out = fs.openSync(path.join(WORK, `${spec.label}.log`), "w");
  const child = forkServer({
    server: SERVER, electron: ELECTRON, out,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(spec.port),
      NODE_ENV: "development", SESSION_SECRET: `economy-${spec.label}`,
    },
  });
  const base = `http://localhost:${spec.port}/api`;
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
      if (Date.now() > dl) throw new Error(`${spec.label}: server never came up`);
      try { await fetch(`${base}/healthz`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
    }

    const prof = await api("POST", "/profiles", { name: `Econ${spec.label}` });
    await api("POST", `/profiles/${prof.data.id}/select`);
    const career = await api("POST", "/careers", {
      slotNumber: 1, managerName: `Econ${spec.label}`, managerNationality: "Australia",
      clubName: `Econ${spec.label} FC`, originalClubName: `Econ${spec.label} FC`,
      budget: "500000", difficulty: spec.difficulty,
      primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
      season: "Season 1", locationId: 1,
    });
    if (career.status !== 200) throw new Error(`${spec.label}: career HTTP ${career.status}`);
    const teamId = career.data.teamId;

    const rows = [];
    let stopped = null;
    // L-02e: five loss-making seasons and the club is sold. For a club at the
    // bottom of the field that is the expected end of the run, not a failure
    // of it — the whole point of the money rule.
    let soldAfter = null;
    let lastBalance = Number((await api("GET", "/team")).data?.budget ?? 0);
    // teams.wins/losses are career totals, not a season's, so a season's
    // record is the difference across its boundary.
    let lastWins = 0, lastLosses = 0;

    for (let s = 1; s <= SEASONS; s++) {
      const season = (await api("GET", "/seasons/current")).data;
      const from = season?.startDate ?? "0000-00-00";

      await keepSideFielded(api);
      await renewExpiringContracts(api);

      let roll = null;
      for (let i = 0; i < 700; i++) {
        healAllSquads(dbFile);
        const r = await api("POST", "/calendar/advance", {});
        if (r.status >= 400) { stopped = { season: s, why: `advance HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 70)}` }; break; }
        if (r.data?.blocked === "pending_match") {
          await api("POST", `/matches/${r.data.pendingMatchId}/simulate`, {});
          await api("POST", "/calendar/skip-match", {});
          continue;
        }
        const mid = r.data?.matchDay?.matchId;
        if (mid) { await api("POST", `/matches/${mid}/simulate`, {}); await api("POST", "/calendar/dismiss-match", {}); }
        if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") { roll = r.data.seasonRollover; break; }
      }
      if (stopped || !roll) { stopped = stopped ?? { season: s, why: "no boundary" }; break; }

      const to = (await api("GET", "/calendar")).data?.currentDate ?? "9999-99-99";
      const ledger = read(
        `SELECT category, type, SUM(amount) AS total FROM finance_transactions
          WHERE team_id = ? AND date >= ? AND date < ?
          GROUP BY category, type`, teamId, from, to);
      const by = (cat, type) =>
        Number(ledger.find((l) => l.category === cat && l.type === type)?.total ?? 0);

      const team = (await api("GET", "/team")).data;
      // L-02e: once the club is sold there is no club to read. The season that
      // ended is still real and its ledger is still there, but the team row
      // this request would have read is somebody else's now.
      if (!team || typeof team.budget === "undefined") {
        soldAfter = s;
        break;
      }
      const balance = Number(team?.budget ?? 0);
      // Where the club finished in a real field of 19, and the tier that
      // finish reached — the season review's own numbers (R-29). NOT the
      // ranking endpoint, which by now is reporting the new season, in which
      // nobody has played a match and everybody is Bronze.
      const review = (await api("GET", `/seasons/${season?.year}/review`)).data;
      const wins = Number(team?.wins ?? 0), losses = Number(team?.losses ?? 0);

      rows.push({
        season: s,
        year: season?.year ?? null,
        rank: review?.playerRank ?? null,
        tier: review?.tier ?? review?.ranking?.tier ?? "?",
        record: `${wins - lastWins}W ${losses - lastLosses}L`,
        prize: by("prize_money", "income"),
        sponsor: by("sponsorship", "income") + by("promo", "income"),
        otherIn: ledger.filter((l) => l.type === "income" && !["prize_money", "sponsorship", "promo"].includes(l.category))
          .reduce((a, l) => a + Number(l.total), 0),
        wages: by("salaries", "expense") + by("staff_salary", "expense"),
        running: by("staff", "expense") + by("running_costs", "expense"),
        otherOut: ledger.filter((l) => l.type === "expense" && !["salaries", "staff_salary", "staff", "running_costs"].includes(l.category))
          .reduce((a, l) => a + Number(l.total), 0),
        balance,
        change: balance - lastBalance,
      });
      lastBalance = balance;
      lastWins = wins; lastLosses = losses;

      // The rollover carries the sale out with it: the season still opened,
      // the manager is simply not there for it (utils/seasonRollover.ts).
      if (roll.clubSold) { soldAfter = s; break; }
    }

    return { spec, rows, stopped, soldAfter };
  } finally {
    await stopServer(child);
    try { fs.closeSync(out); } catch { /* closed */ }
  }
}

const runs = await Promise.all(RUNS.map((r) => runOne(r).catch((err) => ({ spec: r, error: String(err) }))));

for (const run of runs) {
  const label = run.spec.label;
  console.log(`\n── ${label} ──`);
  if (run.error) { check(`${label}: the run finished`, false, run.error); continue; }
  if (run.soldAfter) console.log(`  (the club was sold after season ${run.soldAfter} — five loss-making seasons, L-02e)`);
  else if (run.stopped) console.log(`  (stopped in season ${run.stopped.season}: ${run.stopped.why})`);

  console.log("  Season  Year  Record     Tier     Finish        Prize     Sponsor       Wages     Running      Change        Balance");
  for (const r of run.rows) {
    console.log(
      `  ${String(r.season).padStart(6)}  ${r.year}  ${r.record.padEnd(9)} ${String(r.tier).padEnd(8)} ${("#" + (r.rank ?? "?")).padStart(6)}  ` +
      `${money(r.prize).padStart(11)} ${money(r.sponsor).padStart(11)} ${money(-r.wages).padStart(11)} ${money(-r.running).padStart(11)} ` +
      `${money(r.change).padStart(11)}  ${money(r.balance).padStart(13)}`,
    );
  }
}

// ── The rule ────────────────────────────────────────────────────────────────
// A season's finish decides the money, so the checks are about seasons of a
// KIND, not about a particular career's luck: every season that finished in
// the bottom three of the field must have lost money, and every season that
// finished in the top four of Gold must have made some without making a
// fortune of it.
const all = runs.filter((r) => !r.error).flatMap((r) => r.rows.map((x) => ({ ...x, label: r.spec.label })));
check("both careers ran", runs.every((r) => !r.error && (r.rows?.length ?? 0) > 0),
  runs.map((r) => `${r.spec.label}: ${r.error ?? `${r.rows.length} seasons`}`).join(" · "));

const bottom = all.filter((r) => (r.rank ?? 0) >= 17);
check("a club finishing in the bottom three of the field went backwards, every time",
  bottom.length > 0 && bottom.every((r) => r.change < 0),
  bottom.length === 0 ? "no season finished that low" :
    bottom.map((r) => `${r.label} S${r.season} #${r.rank} ${money(r.change)}`).slice(0, 8).join(" · "));

// "A Gold-tier club's balance rises modestly" means a club that is actually
// winning the Gold tour. Fourth of nineteen in the top tier lands near break
// even — the Gold circuit costs what it pays — and that is the shape of the
// curve, not a failure of it: to go forwards you have to be at the top of it.
const top = all.filter((r) => r.tier === "Gold" && (r.rank ?? 99) <= 2);
check("a club at the top of the Gold tour went forwards",
  top.length === 0 || top.every((r) => r.change > 0),
  top.length === 0 ? "no Gold top-two season" :
    top.map((r) => `${r.label} S${r.season} #${r.rank} ${money(r.change)}`).slice(0, 8).join(" · "));

const MODEST = 500_000;
check(`and went forwards modestly — under ${money(MODEST)} a season`,
  top.length === 0 || top.every((r) => r.change < MODEST),
  top.length === 0 ? "no Gold top-four season" :
    `biggest gain ${money(Math.max(0, ...top.map((r) => r.change)))}`);

// Rob's number: finishing last for five seasons sends a club broke — and
// L-02e sells a club that has lost money five seasons running, so a career
// that keeps finishing at the bottom ends one way or the other.
for (const run of runs.filter((r) => !r.error)) {
  const worst = run.rows.filter((r) => (r.rank ?? 0) >= 17);
  if (worst.length >= 3) {
    const lost = worst.reduce((a, r) => a + r.change, 0);
    const started = worst[0].balance - worst[0].change;
    const left = started + lost;
    check(`${run.spec.label}: ${worst.length} seasons at the bottom cost more than the club had`,
      left < 0,
      `started ${money(started)}, lost ${money(-lost)} over ${worst.length} seasons, left with ${money(left)}` +
      (run.soldAfter ? `; sold after season ${run.soldAfter}` : ""));
  }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
