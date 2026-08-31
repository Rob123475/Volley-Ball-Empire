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
  // Baseline BOTH pools: promotion moves 72 academy players into the senior
  // list during the arc, so a senior-only baseline would report them as wrong
  // simply for not having existed in it at the start.
  const roster0 = (await A("GET", "/players/market-all?playerType=senior")).data;
  const youth0 = (await A("GET", "/players/youth-pool")).data;
  const ages0 = new Map([
    ...(Array.isArray(roster0) ? roster0 : []),
    ...(Array.isArray(youth0) ? youth0 : (youth0?.players ?? [])),
  ].map((p) => [p.id, p.age]));

  const s0 = (await A("GET", "/seasons/current")).data;
  check("career starts in season 1", s0 && Number(s0.year) === 2026,
    `year ${s0?.year}, name ${s0?.name}`);

  // ── Walk every boundary to the terminal one ──────────────────────────────
  const seen = [];
  const seenBodies = [];
  let complete = null;
  for (let season = 1; season <= 6; season++) {
    const hit = await advanceToBoundary(A);
    if (!hit) { check(`reached boundary ${season}`, false, "never rolled over"); break; }
    if (hit.roll.kind === "career-complete") { complete = hit; break; }
    seen.push(hit.roll);
    seenBodies.push(hit.body);

    const s = (await A("GET", "/seasons/current")).data;
    check(`season ${hit.roll.fromSeason} -> ${hit.roll.toSeason}`,
      Number(s?.year) === 2026 + hit.roll.toSeason - 1,
      `now year ${s?.year}, name ${s?.name}, ${hit.days} days`);
  }

  // Ageing: everyone should be exactly one year older per boundary crossed.
  const rosterN = (await A("GET", "/players/market-all?playerType=senior")).data;
  const list = Array.isArray(rosterN) ? rosterN : [];
  const boundaries = seen.length + (complete ? 1 : 0);
  const known = list.filter((p) => ages0.has(p.id));
  const correct = known.filter((p) => p.age === ages0.get(p.id) + boundaries);
  check("every player aged exactly one year per season boundary",
    known.length > 0 && correct.length === known.length,
    `${correct.length}/${known.length} with a baseline, after ${boundaries} boundaries`);
  check("every senior has a baseline (nobody appeared from nowhere)",
    known.length === list.length, `${known.length}/${list.length} traceable`);

  check("rolled through four boundaries", seen.length === 4,
    seen.map((r) => `${r.fromSeason}->${r.toSeason}`).join(", "));
  check("career terminates after season 5", complete !== null,
    complete ? `finalSeason ${complete.roll.finalSeason}` : "never completed");
  if (complete) {
    check("terminal season is 5", complete.roll.finalSeason === 5);
    check("careerComplete flag returned", complete.body.careerComplete === true);
    check("the final season is reviewable too",
      complete.body.reviewYear === 2026 + complete.roll.finalSeason - 1,
      `reviewYear ${complete.body.reviewYear}`);
  }

  // The season review has to REACH the client. The rollover returned
  // seasonRollover and careerComplete for weeks and the client read neither, so
  // asserting the rollover happened is not the same as asserting it is visible.
  // reviewYear is what opens the screen; without it the dialog never fires.
  const withYear = seenBodies.filter((b) => Number.isFinite(b?.reviewYear));
  check("every rollover names the season to review",
    withYear.length === seenBodies.length,
    `${withYear.length}/${seenBodies.length} carry reviewYear`);
  check("reviewYear is the season that ENDED, not the one starting",
    seen.every((r, i) => seenBodies[i]?.reviewYear === 2026 + r.fromSeason - 1),
    seen.map((r, i) => `${r.fromSeason}->${seenBodies[i]?.reviewYear}`).join(", "));

  if (withYear.length > 0) {
    const y = withYear[0].reviewYear;
    const rev = await A("GET", `/seasons/${y}/review`);
    check("the year the client is handed actually resolves",
      rev.status === 200 && rev.data?.seasonYear === y,
      `GET /seasons/${y}/review -> HTTP ${rev.status}`);
  }

  // ── Carry-forward: history and standings ────────────────────────────────
  const hist = (await A("GET", "/careers/history")).data;
  const entries = Array.isArray(hist) ? hist : (hist?.entries ?? []);
  const seasonEntries = entries.filter((e) => e.type === "season_completed");
  check("a history entry per completed season", seasonEntries.length === 5,
    `${seasonEntries.length} season_completed entries`);

  // Retirement: nobody left alive may be at or past the threshold, and the
  // arc must actually retire somebody — a rule that fires zero times is not a
  // rule, it is dead code.
  const alive = (await A("GET", "/players/market-all?playerType=senior")).data;
  const aliveList = Array.isArray(alive) ? alive : [];
  const tooOld = aliveList.filter((p) => p.age >= 34);
  check("no active player is at or past the retirement age", tooOld.length === 0,
    `${tooOld.length} over-age still active`);
  // Promotion. All 72 youth cross 19 during the arc, so the academy should be
  // largely emptied into the senior pool and the two views must AGREE — a
  // player counted in both, or in neither, is the failure this chunk is about.
  const seniorsNow = (await A("GET", "/players/market-all?playerType=senior")).data;
  const youthNow = (await A("GET", "/players/youth-pool")).data;
  const seniorList = Array.isArray(seniorsNow) ? seniorsNow : [];
  const youthList = Array.isArray(youthNow) ? youthNow : (youthNow?.players ?? []);
  const promotedInSenior = seniorList.filter((p) => p.isPromoted);
  check("the academy promoted players into the senior pool",
    promotedInSenior.length > 0, `${promotedInSenior.length} promoted seniors`);

  const seniorIds = new Set(seniorList.map((p) => p.id));
  const bothLists = youthList.filter((p) => seniorIds.has(p.id));
  check("no player appears as BOTH youth and senior", bothLists.length === 0,
    `${bothLists.length} in both`);
  const youthStillPromoted = youthList.filter((p) => p.isPromoted);
  check("no promoted player is still listed as youth", youthStillPromoted.length === 0,
    `${youthStillPromoted.length} promoted but still in the academy`);

  const mentions = seasonEntries.filter((e) => /retired/.test(e.description ?? ""));
  check("the arc retired somebody", mentions.length > 0,
    mentions.map((e) => e.description.match(/(\d+) players? retired/)?.[1] ?? "?").join(", ") + " per season");

  // ── Season Review (Phase 8 row 6) ────────────────────────────────────────
  // The rollover has returned seasonRollover and careerComplete since 1.1 and
  // nothing consumed either, so five boundaries passed with nothing to show.
  const review = await A("GET", "/seasons/2027/review");
  check("season review responds for a completed season", review.status === 200,
    `HTTP ${review.status}`);
  if (review.status === 200) {
    const r = review.data;
    check("review knows which season it is", r.seasonNumber === 2,
      `season ${r.seasonNumber} (${r.seasonYear})`);
    check("review carries a final table",
      Array.isArray(r.standings) && r.standings.length > 0,
      `${r.standings?.length} rows, player rank ${r.playerRank}`);
    check("review carries the ranking", r.ranking !== undefined,
      `${r.ranking?.rankingPoints} pts, ${r.ranking?.eventsEntered} entered`);
    check("review carries a written summary",
      typeof r.summary === "string" && r.summary.length > 0,
      r.summary ? r.summary.slice(0, 55) : "none");
    check("review reports retirements", Array.isArray(r.retired),
      `${r.retired?.length} retired that season`);
  }
  const finalReview = await A("GET", "/seasons/2030/review");
  check("final season is flagged as final",
    finalReview.status === 200 && finalReview.data?.isFinalSeason === true);

  console.log(`\n=== ${checks - failures}/${checks} passed ===`);
  process.exit(failures > 0 ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
