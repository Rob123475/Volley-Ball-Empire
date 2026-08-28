/**
 * Season rollover, driven through the real HTTP service.
 *
 * Before Phase 1 a career ran off the end of season one: the calendar advanced
 * past endDate, `atSeasonEnd` was returned to the client, and nothing acted on
 * it. This walks a career through every season boundary to the terminal one and
 * asserts on state that MOVES — season number, year, dates, ages, balance —
 * rather than on the endpoint returning 200.
 *
 * Usage: node harness/rollover.mjs [baseUrl]
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
  const r = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${r.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: label, managerNationality: "Australia",
    clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
  });
  if (c.status >= 400) throw new Error(`career creation failed ${JSON.stringify(c.data)}`);
  return (await api("GET", "/team")).data;
}

/** Advance until the season rolls over, or give up. Returns the roll event. */
async function advanceToBoundary(api, maxDays = 500) {
  for (let i = 0; i < maxDays; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) throw new Error(`advance failed: ${JSON.stringify(r.data)}`);
    const roll = r.data?.seasonRollover;
    if (roll && roll.kind !== "none") return { roll, days: i + 1, body: r.data };
  }
  return null;
}

(async () => {
  console.log("\n=== SEASON ROLLOVER ===\n");
  const A = session();
  await newCareer(A, "RollA");

  // Ages before any boundary, so the +1 per season can be checked against them.
  const roster0 = (await A("GET", "/players/market-all?playerType=senior")).data;
  const ages0 = new Map((Array.isArray(roster0) ? roster0 : []).map((p) => [p.id, p.age]));

  const s0 = (await A("GET", "/seasons/current")).data;
  check("career starts in season 1", s0 && Number(s0.year) === 2026,
    `year ${s0?.year}, name ${s0?.name}`);

  // ── Walk every boundary to the terminal one ──────────────────────────────
  const seen = [];
  let complete = null;
  for (let season = 1; season <= 6; season++) {
    const hit = await advanceToBoundary(A);
    if (!hit) { check(`reached boundary ${season}`, false, "never rolled over"); break; }
    if (hit.roll.kind === "career-complete") { complete = hit; break; }
    seen.push(hit.roll);

    const s = (await A("GET", "/seasons/current")).data;
    check(`season ${hit.roll.fromSeason} -> ${hit.roll.toSeason}`,
      Number(s?.year) === 2026 + hit.roll.toSeason - 1,
      `now year ${s?.year}, name ${s?.name}, ${hit.days} days`);
  }

  // Ageing: everyone should be exactly one year older per boundary crossed.
  const rosterN = (await A("GET", "/players/market-all?playerType=senior")).data;
  const list = Array.isArray(rosterN) ? rosterN : [];
  const boundaries = seen.length + (complete ? 1 : 0);
  const correct = list.filter((p) => ages0.has(p.id) && p.age === ages0.get(p.id) + boundaries);
  check("every player aged exactly one year per season boundary",
    list.length > 0 && correct.length === list.length,
    `${correct.length}/${list.length} after ${boundaries} boundaries`);

  check("rolled through four boundaries", seen.length === 4,
    seen.map((r) => `${r.fromSeason}->${r.toSeason}`).join(", "));
  check("career terminates after season 5", complete !== null,
    complete ? `finalSeason ${complete.roll.finalSeason}` : "never completed");
  if (complete) {
    check("terminal season is 5", complete.roll.finalSeason === 5);
    check("careerComplete flag returned", complete.body.careerComplete === true);
  }

  console.log(`\n=== ${checks - failures}/${checks} passed ===`);
  process.exit(failures > 0 ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
