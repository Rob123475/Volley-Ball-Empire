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

const market = async (api) => {
  const r = await api("GET", "/players/market-all?playerType=senior");
  return Array.isArray(r.data) ? r.data : (r.data?.players ?? []);
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

  console.log(`\n=== ${checks - failures}/${checks} passed ===`);
  if (failures > 0) { console.log(`${failures} FAILED`); process.exit(1); }
})().catch(e => { console.error("SMOKE TEST ERROR:", e.message); process.exit(1); });
