/**
 * Gameplay smoke test — drives a career through the REAL HTTP service layer and
 * asserts on state that MOVES.
 *
 * The A/B isolation and save-preservation tests only prove a career starts clean
 * and a squad survives a migration. Neither touches training, injuries, fitness,
 * morale, or the transfer market — which is most of what the per-career state
 * migration actually changes. This closes that gap, and is reused by the Phase 7
 * invariant sweep.
 *
 * Usage: node harness/smoke.mjs [baseUrl]
 * Exits non-zero on any failed assertion.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = (process.argv[2] ?? "http://localhost:4199") + "/api";

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

function session() {
  let cookie = "";
  return async function api(method, path, body) {
    const res = await fetch(BASE + path, {
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

async function newCareer(api, label) {
  let r = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${r.data.id}/select`);
  r = await api("POST", "/careers", {
    slotNumber: 1, managerName: label, managerNationality: "Australia",
    clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  if (r.status >= 400) throw new Error(`${label}: career creation failed ${JSON.stringify(r.data)}`);
  return (await api("GET", "/team")).data;
}

// market-all is a BROWSER: it lists every senior and attaches a team name to
// the signed ones. The free pool is the subset with no team in this career.
const market = async (api) => {
  const r = await api("GET", "/players/market-all?playerType=senior");
  const all = Array.isArray(r.data) ? r.data : (r.data?.players ?? []);
  return all.filter((p) => !p.teamId && !p.currentTeamId);
};
const roster = async (api) => {
  const r = await api("GET", "/team/roster");
  return [...(r.data?.activePlayers ?? []), ...(r.data?.benchPlayers ?? [])];
};

(async () => {
  console.log("\n=== GAMEPLAY SMOKE TEST ===\n");

  const A = session(), B = session();
  const teamA = await newCareer(A, "SmokeA");
  const teamB = await newCareer(B, "SmokeB");
  console.log(`careers: A team ${teamA.id}, B team ${teamB.id}\n`);

  // ── 1. Sign a free agent ──────────────────────────────────────────────────
  console.log("1. SIGN A FREE AGENT");
  const marketA0 = await market(A);
  const marketB0 = await market(B);
  const target = marketA0[0];
  check("market non-empty", marketA0.length > 0, `${marketA0.length} free agents`);

  const signRes = await A("POST", "/contracts", {
    playerId: target.id, salary: target.salary ?? 8000,
    endDate: "2026-12-31", bonusPerWin: 0, squadRole: "starter",
  });
  check("sign succeeds", signRes.status < 400, `HTTP ${signRes.status}`);

  const rosterA1 = await roster(A);
  check("appears in squad", rosterA1.some(p => p.id === target.id));

  const marketA1 = await market(A);
  check("leaves A's free pool", !marketA1.some(p => p.id === target.id),
        `${marketA0.length} -> ${marketA1.length}`);

  const marketB1 = await market(B);
  check("STILL in B's free pool (no cross-career bleed)",
        marketB1.some(p => p.id === target.id),
        `B pool ${marketB0.length} -> ${marketB1.length}`);

  // ── 2. Train ──────────────────────────────────────────────────────────────
  console.log("\n2. TRAIN");
  const before = (await roster(A)).find(p => p.id === target.id);
  const tRes = await A("POST", "/training", {
    playerId: target.id, type: "strength", focus: "power",
    durationHours: 2, scheduledAt: "2026-02-01",
  });
  let trained = null;
  if (tRes.status < 400 && tRes.data?.id) {
    await A("POST", `/training/${tRes.data.id}/complete`, {});
    trained = (await roster(A)).find(p => p.id === target.id);
  }
  if (trained) {
    check("training moved fatigue or points",
      trained.fatigue !== before.fatigue ||
      trained.trainingPoints !== before.trainingPoints ||
      trained.focusXp !== before.focusXp,
      `fatigue ${before.fatigue}->${trained.fatigue}, pts ${before.trainingPoints}->${trained.trainingPoints}`);
  } else {
    check("training endpoint reachable", tRes.status < 500, `HTTP ${tRes.status} (skipped state check)`);
  }

  // ── 3. Condition changes over played matches ──────────────────────────────
  console.log("\n3. CONDITION MOVES WHEN MATCHES ARE PLAYED");
  const condBefore = (await roster(A)).find(p => p.id === target.id);
  await A("GET", "/matches/fixture");
  await A("PATCH", "/calendar/speed", { speed: "pause" });
  let played = 0;
  for (let d = 0; d < 120 && played < 6; d++) {
    const r = await A("POST", "/calendar/advance", {});
    if (r.status >= 400 || r.data?.blocked === "season_end") break;
    const mid = r.data?.pendingMatchId ?? r.data?.matchDay?.id;
    if (mid) { await A("POST", `/matches/${mid}/simulate`, {}); played++; await A("POST", "/calendar/dismiss-match", {}); }
  }
  const condAfter = (await roster(A)).find(p => p.id === target.id);
  check("matches were played", played > 0, `${played} matches`);
  check("fitness/fatigue/morale moved",
    condAfter.fitness !== condBefore.fitness ||
    condAfter.fatigue !== condBefore.fatigue ||
    condAfter.morale  !== condBefore.morale,
    `fit ${condBefore.fitness}->${condAfter.fitness}, fat ${condBefore.fatigue}->${condAfter.fatigue}, mor ${condBefore.morale}->${condAfter.morale}`);
  check("injuryStatus is a real value", typeof condAfter.injuryStatus === "string" && condAfter.injuryStatus.length > 0,
    `"${condAfter.injuryStatus}"`);
  check("B's copy of that player is untouched",
    (await market(B)).some(p => p.id === target.id));

  // ── 4. Contract / age fields are present and sane ─────────────────────────
  console.log("\n4. CONTRACT AND AGE FIELDS");
  check("age is a number", Number.isFinite(condAfter.age), `age ${condAfter.age}`);
  check("salary is a number", Number.isFinite(condAfter.salary), `$${condAfter.salary}`);
  check("contractEndDate set", !!condAfter.contractEndDate, String(condAfter.contractEndDate));

  // ── 5. Release ────────────────────────────────────────────────────────────
  console.log("\n5. RELEASE");
  const relRes = await A("POST", `/players/${target.id}/release`, {});
  check("release succeeds", relRes.status < 400, `HTTP ${relRes.status}`);
  const rosterA2 = await roster(A);
  check("leaves the squad", !rosterA2.some(p => p.id === target.id));
  const marketA2 = await market(A);
  check("returns to A's free pool", marketA2.some(p => p.id === target.id));
  const marketB2 = await market(B);
  check("B's pool unchanged throughout", marketB2.length === marketB0.length,
    `B ${marketB0.length} -> ${marketB2.length}`);

  // ── 6. Ranking points accrue from results ────────────────────────────────
  // competitor_rankings existed since Phase 0 with nothing writing to it, so
  // the value tier qualification is meant to gate on was always zero. A value
  // nothing can observe is indistinguishable from one nothing writes.
  console.log("\n6. RANKING POINTS");
  const rank = await A("GET", "/seasons/ranking");
  check("ranking endpoint responds", rank.status === 200, `HTTP ${rank.status}`);
  if (rank.status === 200) {
    check("events entered were counted", (rank.data?.eventsEntered ?? 0) > 0,
      `${rank.data?.eventsEntered} entered, ${rank.data?.wins}W ${rank.data?.losses}L`);
    check("points accrued whenever a match was won",
      (rank.data?.wins ?? 0) === 0 || (rank.data?.rankingPoints ?? 0) > 0,
      `${rank.data?.rankingPoints} points from ${rank.data?.wins} wins`);
  }

  // ── 7. Tier qualification is visible on every fixture ────────────────────
  // Eligibility travels WITH the fixture. A rejection on click is too late —
  // the player has already chosen by then.
  console.log("\n7. TIER QUALIFICATION");
  const fixtures = await A("GET", "/matches");
  const fx = Array.isArray(fixtures.data) ? fixtures.data : [];
  check("fixtures carry eligibility", fx.length > 0 && fx.every((m) => m.eligibility),
    `${fx.filter((m) => m.eligibility).length}/${fx.length}`);

  const bronze = fx.filter((m) => m.tier === "Bronze");
  const gold   = fx.filter((m) => m.tier === "Gold");
  check("Bronze is open to a new club",
    bronze.length === 0 || bronze.every((m) => m.eligibility.eligible),
    `${bronze.length} Bronze fixtures`);
  check("Gold is locked, with the threshold and gap stated",
    gold.length === 0 || gold.every((m) =>
      !m.eligibility.eligible
      && m.eligibility.reason === "below_threshold"
      && m.eligibility.threshold === 40
      && typeof m.eligibility.gap === "number"),
    gold.length ? `gap ${gold[0].eligibility.gap} to ${gold[0].eligibility.threshold}` : "no Gold fixtures");
  const finals = fx.filter((m) => m.tier === "World Final");
  check("finals are qualification-gated, not ranking-gated",
    finals.length === 0 || finals.every((m) => m.eligibility.reason === "qualification"),
    `${finals.length} finals`);

  // ── 8. The club picker actually renders every club ──────────────────────
  // This suite used to stop at the API. The picker read /club-templates
  // correctly and then dropped three of the ten clubs on the floor, because it
  // grouped by a display string it did not recognise — a screen-only failure
  // that every API-level assertion passed straight through.
  //
  // So this asserts on what the PICKER would draw, not on what the DB holds:
  // it repeats the screen's own partition (canonical key -> group, everything
  // else -> "unrecognised") and requires the two to reconcile.
  console.log("\n8. CLUB PICKER COVERAGE");

  // Parsed from the single source of truth rather than restated here — a second
  // copy of this list inside the harness would be the very bug under test.
  const continentsSrc = fs.readFileSync(
    path.join(import.meta.dirname, "..", "lib", "db", "src", "schema", "continents.ts"),
    "utf8",
  );
  const keyBlock = continentsSrc.match(/export const CONTINENT_KEYS = \[([\s\S]*?)\] as const;/);
  const CANONICAL = keyBlock ? [...keyBlock[1].matchAll(/"([a-z_]+)"/g)].map((m) => m[1]) : [];
  check("canonical continent keys parsed from lib/db", CANONICAL.length > 0,
    `${CANONICAL.length} keys: ${CANONICAL.join(", ")}`);

  const templates = await A("GET", "/club-templates");
  const clubs = templates.data?.clubs ?? [];
  check("club-templates responds", templates.status === 200, `HTTP ${templates.status}`);

  // The picker's partition, repeated exactly: every club lands in one bucket.
  const canonSet = new Set(CANONICAL);
  const grouped = new Map();
  const unrecognised = [];
  for (const c of clubs) {
    if (canonSet.has(c.continent)) grouped.set(c.continent, [...(grouped.get(c.continent) ?? []), c]);
    else unrecognised.push(c);
  }
  const drawn = [...grouped.values()].reduce((n, g) => n + g.length, 0) + unrecognised.length;

  check("every club the API returns is drawn by the picker", drawn === clubs.length,
    `${drawn} drawn of ${clubs.length} returned`);
  check("no club falls into the unrecognised bucket", unrecognised.length === 0,
    unrecognised.length
      ? `${unrecognised.length}: ${[...new Set(unrecognised.map((c) => JSON.stringify(c.continent)))].join(", ")}`
      : "all continents canonical");

  // The regression that started this: three Oceania clubs vanished, leaving 7
  // clubs in 4 groups where the database held 10.
  check("all 10 club templates reach the picker", clubs.length === 10, `${clubs.length} clubs`);
  check("oceania clubs are present and grouped",
    (grouped.get("oceania") ?? []).length === 3,
    `${(grouped.get("oceania") ?? []).length} oceania clubs`);

  // Groups the picker will actually show, compared against the regions present
  // in the data rather than against the canonical six: a region with no club is
  // a content gap, and asserting 6 here would fail for a reason that has
  // nothing to do with the picker dropping rows.
  const distinctInData = new Set(clubs.map((c) => c.continent)).size;
  check("picker shows a group for every region that has clubs",
    grouped.size === distinctInData,
    `${grouped.size} groups, ${distinctInData} regions in data`);

  const emptyRegions = CANONICAL.filter((k) => !grouped.has(k));
  if (emptyRegions.length > 0) {
    console.log(`  NOTE  ${grouped.size}/${CANONICAL.length} regions have a club — none in: ${emptyRegions.join(", ")}`);
  }

  // ── 9. Squad size is enforced ────────────────────────────────────────────
  // Two on the sand, one interchange, one in the academy. A limit that has
  // never been shown to refuse anything is not a limit, so this signs right up
  // to each cap and requires the next signing to be REJECTED - and to say why,
  // because "422" on its own leaves the player guessing.
  console.log("\n9. SQUAD SIZE");
  const C = session();
  await newCareer(C, "SmokeC");
  const poolC = (await market(C)).filter((p) => (p.age ?? 99) >= 19);
  const signC = (p, squadRole) =>
    C("POST", "/contracts", {
      playerId: p.id, salary: p.salary ?? 8000, endDate: "2026-12-31",
      bonusPerWin: 0, squadRole,
    });

  check("enough free agents to test the cap", poolC.length >= 5, `${poolC.length} seniors free`);

  const s1 = await signC(poolC[0], "starter");
  const s2 = await signC(poolC[1], "starter");
  check("two starters can be signed", s1.status < 400 && s2.status < 400,
    `${s1.status}, ${s2.status}`);

  const s3 = await signC(poolC[2], "starter");
  check("a THIRD starter is refused", s3.status === 422, `HTTP ${s3.status}`);
  check("the refusal names the starter limit",
    typeof s3.data?.error === "string" && /starter/i.test(s3.data.error),
    JSON.stringify(s3.data?.error ?? null).slice(0, 90));

  const i1 = await signC(poolC[2], "interchange");
  check("one interchange can be signed", i1.status < 400, `HTTP ${i1.status}`);

  const i2 = await signC(poolC[3], "interchange");
  check("a fourth senior is refused", i2.status === 422, `HTTP ${i2.status}`);
  check("the refusal says the squad is full",
    typeof i2.data?.error === "string" && /full/i.test(i2.data.error),
    JSON.stringify(i2.data?.error ?? null).slice(0, 90));

  const squadC = await roster(C);
  check("squad settled at 3 seniors", squadC.length === 3, `${squadC.length} signed`);

  console.log(`\n=== ${checks - failures}/${checks} passed ===`);
  if (failures > 0) { console.log(`${failures} FAILED`); process.exit(1); }
})().catch(e => { console.error("SMOKE TEST ERROR:", e.message); process.exit(1); });
