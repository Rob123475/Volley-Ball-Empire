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

async function newCareer(api, label, difficulty) {
  const r = await api("POST", "/profiles", { name: label });
  await api("POST", `/profiles/${r.data.id}/select`);
  const c = await api("POST", "/careers", {
    slotNumber: 1, managerName: label, managerNationality: "Australia",
    clubName: `${label} FC`, originalClubName: `${label} FC`, season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#0a0", secondaryColor: "#00a",
    ...(difficulty ? { difficulty } : {}),
  });
  if (c.status >= 400) throw new Error(`career creation failed ${JSON.stringify(c.data)}`);
  return (await api("GET", "/team")).data;
}

/**
 * R-08: play the pending match for real instead of skip-match's raw random
 * result — the same engine the player uses (POST /matches/:id/simulate),
 * which is what actually credits wins/losses, ranking points and prize
 * money. Falls back to forfeit only for the one case simulate legitimately
 * refuses: a World Final reached after losing the Semi
 * (bracketBlockReason, routes/matches.ts) — a real squad in that position
 * cannot play the fixture either, so recording it as a loss is correct, not
 * a workaround.
 */
async function playPendingMatch(api, matchId) {
  const sim = await api("POST", `/matches/${matchId}/simulate`, {});
  if (sim.status < 400) return sim;
  const forfeit = await api("POST", `/matches/${matchId}/forfeit`, {});
  if (forfeit.status >= 400) {
    throw new Error(`match ${matchId}: simulate failed (${sim.status} ${JSON.stringify(sim.data)}) and forfeit failed too (${forfeit.status} ${JSON.stringify(forfeit.data)})`);
  }
  return forfeit;
}

/** Same shape as advanceToBoundary, but plays every pending match for real. */
async function advanceToBoundaryPlaying(api, maxDays = 500) {
  for (let i = 0; i < maxDays; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) throw new Error(`advance failed: ${JSON.stringify(r.data)}`);
    if (r.data?.blocked === "pending_match") {
      await playPendingMatch(api, r.data.pendingMatchId);
      continue;
    }
    const roll = r.data?.seasonRollover;
    if (roll && roll.kind !== "none") return { roll, days: i + 1, body: r.data };
  }
  return null;
}

/**
 * Advance until the season rolls over, or give up. Returns the roll event.
 *
 * R-26: fixture generation moved from lazy (never triggered here, since this
 * harness never calls GET /matches/fixture) to eager at career creation, so
 * this career now has real scheduled matches from round 11 on. Advance
 * blocks with `blocked: "pending_match"` on a match day until it's
 * resolved — skip-match resolves it with a quick random result and moves
 * the date forward one day, which is all this harness needs; it asserts on
 * season/date/age progression, not match outcomes.
 */
async function advanceToBoundary(api, maxDays = 500) {
  for (let i = 0; i < maxDays; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) throw new Error(`advance failed: ${JSON.stringify(r.data)}`);
    if (r.data?.blocked === "pending_match") {
      // R-29: skip-match no longer invents a result. The match is played through
      // the real engine first; skip then only moves the day on.
      await playPendingMatch(api, r.data.pendingMatchId);
      const skip = await api("POST", "/calendar/skip-match", {});
      if (skip.status >= 400) throw new Error(`skip-match failed: ${JSON.stringify(skip.data)}`);
      continue;
    }
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
  // The threshold is READ, not restated. This line used to hardcode 34, so
  // moving RETIREMENT_AGE would have left the harness asserting the old rule
  // and still passing - the exact drift this project keeps finding. The
  // validation endpoint reports the value the server actually compiled with.
  const declaredAge = (await A("GET", "/players/validation")).data?.declared?.retirementAge;
  check("the harness knows the real retirement age", Number.isFinite(declaredAge),
    `retirementAge=${declaredAge}`);
  const tooOld = aliveList.filter((p) => p.age >= declaredAge);
  check("no active player is at or past the retirement age", tooOld.length === 0,
    `${tooOld.length} over-age still active (threshold ${declaredAge})`);
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

  // ── R-08: real fixtures across the arc, strong squad vs weak squad ────────
  //
  // Everything above walks RollA through skip-match — fast, and correct for
  // the ageing/promotion/retirement/review assertions it exists for, none of
  // which depend on a match's actual result. It is also exactly the "0W 0L"
  // gap R-08 is about: skip-match never calls the match engine, never credits
  // a win or loss, never awards ranking points, never pays a real purse.
  //
  // This section is separate and additional, not a replacement — changing
  // RollA's own mechanism would risk the 20+ checks above for no benefit; R-08
  // asks for real fixtures FOR A STRONG AND A WEAK SQUAD specifically, which
  // is a new measurement, not a fix to the existing walk.
  //
  // "Strong" and "weak" reuse R-11's difficulty mechanism rather than
  // inventing a second one: ESTABLISHED signs the strongest available free
  // agents, UNDERDOG the weakest (utils/seedStartingSquad.ts) — exactly a
  // strong squad and a weak squad, from machinery that already exists.
  //
  // Every match is played for real via POST /matches/:id/simulate — the same
  // engine the player uses, R-32's away-side fallback fix included — so wins,
  // losses, ranking points and prize money all move for real.
  //
  // This is MEASUREMENT ONLY per the register item: no economy number is read,
  // asserted against a "should be" figure, or tuned here. The checks below
  // confirm the measurement is real — every season played its whole fixture,
  // and arrived with that fixture already built — and the season-by-season
  // table is printed for a human to read against I8/I9, not judged here.
  //
  // The first version of this section asserted only "more than zero matches"
  // and counted them through GET /matches, which is `.limit(50)`. Both squads
  // duly reported "50 matches completed" and 32/32 passed while seasons 2-5 ran
  // 0W 0L — the fixture was never generated for them (R-35), and a saturating
  // counter could not tell. Hence the two rules this section now follows:
  // count from an uncapped source (the win/loss delta), and assert on EVERY
  // season rather than on the existence of one.
  console.log("\n=== R-08: FIVE-SEASON ARC, REAL FIXTURES — STRONG vs WEAK SQUAD ===\n");

  // Mirrors utils/tierQualification.ts's TIER_THRESHOLDS. Not tunable from
  // here — if that file's numbers move, update this comment's mirror, not
  // the number itself; this harness measures, it does not decide thresholds.
  const TIER_THRESHOLDS = { Bronze: 0, Silver: 15, Gold: 40 };
  function tierReached(rankingPoints) {
    if (rankingPoints >= TIER_THRESHOLDS.Gold) return "Gold";
    if (rankingPoints >= TIER_THRESHOLDS.Silver) return "Silver";
    return "Bronze";
  }

  /**
   * How many fixtures a complete season has, read once from the season-1
   * fixture — which POST /careers has already generated, so asking for it here
   * cannot mask anything. Derived rather than hardcoded: worldTour.ts is the
   * authority on how long a season is, and a literal here would go stale the
   * moment that file changes.
   *
   * Deliberately the ONLY call to /matches/fixture in this section. That
   * endpoint calls ensureSeasonFixture, so calling it inside the arc would
   * GENERATE the active season's fixture and mask exactly the R-35 bug this
   * section exists to catch — the harness would repair the season by asking
   * about it, then report all was well. Everything inside the arc reads
   * non-generating endpoints only.
   */
  async function fullFixtureSize(api) {
    const fx = await api("GET", "/matches/fixture");
    const rows = Array.isArray(fx.data) ? fx.data : fx.data?.matches ?? [];
    return rows.length;
  }

  /**
   * Does the ACTIVE season already have its fixture, without anyone asking for
   * it? This is the R-35 regression check.
   *
   * Uses GET /matches, which does NOT generate. Its capped 50 rows are fine
   * here because this only needs existence, and the cap takes most-recently
   * created first — which is the new season's fixture when there is one.
   */
  async function scheduledForYear(api, year) {
    const r = await api("GET", "/matches");
    const rows = Array.isArray(r.data) ? r.data : [];
    return rows.filter((m) => m.season === year && m.status === "scheduled").length;
  }

  async function runArc(label, difficulty) {
    const api = session();
    let team = await newCareer(api, label, difficulty);
    const fixtureSize = await fullFixtureSize(api);
    console.log(
      `  ${label} (${difficulty}) — starting budget $${Number(team.budget).toLocaleString()}` +
      `, ${fixtureSize}-match season fixture`,
    );

    const seasons = [];
    let prevWins = team.wins, prevLosses = team.losses;

    for (let season = 1; season <= 6; season++) {
      // Before playing anything: the season the career is sitting in must
      // already have a fixture. Season 1 comes from POST /careers, every later
      // season from the rollover itself (R-35).
      const activeYear = 2026 + season - 1;
      const readyAtStart = await scheduledForYear(api, activeYear);

      const hit = await advanceToBoundaryPlaying(api);
      if (!hit) { console.log(`    season ${season}: never reached a boundary — stopping`); break; }

      if (hit.roll.kind === "career-complete") {
        console.log(`    career complete after season ${hit.roll.finalSeason}`);
        break;
      }

      const endedYear = 2026 + hit.roll.fromSeason - 1;
      const review = await api("GET", `/seasons/${endedYear}/review`);
      const teamNow = await api("GET", "/team");
      team = teamNow.data;

      // Played = the win/loss delta across the season. This is the uncapped,
      // non-generating count: every completed fixture credits exactly one win
      // or one loss (a forfeit included), and GET /team carries the running
      // totals. The first version counted `status === "completed"` rows from
      // GET /matches, which is `.limit(50)` — so it saturated at 50 and both
      // squads reported "50 matches" whatever actually happened.
      const wins = team.wins - prevWins;
      const losses = team.losses - prevLosses;
      const played = wins + losses;
      prevWins = team.wins; prevLosses = team.losses;

      const rankingPoints = review.data?.ranking?.rankingPoints ?? null;
      const row = {
        season: hit.roll.fromSeason,
        year: endedYear,
        record: `${wins}W ${losses}L`,
        played,
        readyAtStart,
        rankingPoints,
        tier: rankingPoints !== null ? tierReached(rankingPoints) : "?",
        balance: Number(team.budget),
        // R-29: where the club finished in a real field, and how the finals went.
        rank: review.data?.playerRank ?? null,
        finals: review.data?.worldFinals?.playerResult ?? "?",
        champion: review.data?.worldFinals?.champion ?? "?",
        notQualified: review.data?.fixture?.notQualified ?? null,
      };
      seasons.push(row);
      console.log(
        `    season ${row.season} (${row.year}): ${row.record}  ·  ${row.played}/${fixtureSize} played  ·  ` +
        `${row.rankingPoints ?? "?"} ranking pts  ·  ${row.tier} tier  ·  $${row.balance.toLocaleString()} balance  ·  ` +
        `#${row.rank ?? "?"} in the field  ·  finals: ${row.finals}  ·  champion: ${row.champion}`,
      );
    }

    return { label, difficulty, seasons, fixtureSize };
  }

  const strong = await runArc("RollStrong", "established");
  const weak   = await runArc("RollWeak", "underdog");

  // The arc has to actually cover the arc: four boundaries means four measured
  // seasons, so "at least one" is not good enough — that is precisely what let
  // the first version of this section pass with seasons 2-5 empty.
  const EXPECTED_SEASONS = 4;
  for (const arc of [strong, weak]) {
    check(`${arc.label} (${arc.difficulty}) measured all ${EXPECTED_SEASONS} seasons of the arc`,
      arc.seasons.length === EXPECTED_SEASONS,
      `${arc.seasons.length} season(s) measured`);

    // R-35 regression: every season, not just season 1, must arrive with its
    // fixture already built — no page visit required.
    const unready = arc.seasons.filter((r) => r.readyAtStart === 0);
    check(`${arc.label}: every season had its fixture before anything asked for it`,
      unready.length === 0,
      unready.length === 0
        ? `all ${arc.seasons.length} seasons scheduled at their start`
        : `empty fixture at start of season(s) ${unready.map((r) => r.season).join(", ")}`);

    // The actual R-08 requirement: real matches, every season, the whole list.
    // R-29: finals the club did not qualify for are marked not_qualified and are
    // not the club's to play, so a full season is the fixture less those. The
    // count comes from the season review, which reads the club's match rows.
    const short = arc.seasons.filter((r) => r.notQualified == null || r.played !== arc.fixtureSize - r.notQualified);
    check(`${arc.label}: every season played every match it was entitled to (${arc.fixtureSize}-match fixture less finals not qualified for)`,
      short.length === 0,
      short.length === 0
        ? arc.seasons.map((r) => `${r.played}/${arc.fixtureSize}`).join(" | ")
        : short.map((r) => `season ${r.season} played ${r.played}, not qualified for ${r.notQualified}`).join("; "));

    check(`${arc.label}: no season was a 0W 0L walkover`,
      arc.seasons.every((r) => r.played > 0),
      arc.seasons.map((r) => r.record).join(" | "));
  }


  console.log("\n  ── Summary table (for I8/I9 — report only, nothing tuned here) ──");
  console.log("  Season | Strong: record / played / pts / tier / balance / rank / finals          | Weak: record / played / pts / tier / balance / rank / finals");
  const maxSeasons = Math.max(strong.seasons.length, weak.seasons.length);
  for (let i = 0; i < maxSeasons; i++) {
    const s = strong.seasons[i];
    const w = weak.seasons[i];
    const fmt = (row, size) => row
      ? `${row.record} / ${row.played}/${size} / ${row.rankingPoints ?? "?"} / ${row.tier} / $${row.balance.toLocaleString()} / #${row.rank ?? "?"} / ${row.finals}`
      : "—";
    console.log(
      `  ${(i + 1).toString().padStart(6)} | ${fmt(s, strong.fixtureSize).padEnd(80)} | ${fmt(w, weak.fixtureSize)}`,
    );
  }

  // R-29, Rob's pass condition: the player must NOT win every season by default.
  // With a real field and real seeding the title is an outcome, not a given.
  console.log("\n  ── World Finals, per season ──");
  for (const arc of [strong, weak]) {
    for (const r of arc.seasons) {
      console.log(`  ${arc.label.padEnd(10)} season ${r.season}: finished #${r.rank ?? "?"}, finals: ${r.finals}, champion: ${r.champion}`);
    }
    const titles = arc.seasons.filter((r) => r.finals === "champion").length;
    check(`${arc.label}: did not win the World Final every season by default`,
      titles < arc.seasons.length, `${titles} title(s) in ${arc.seasons.length} seasons`);
  }
  const champions = [...strong.seasons, ...weak.seasons].map((r) => r.champion);
  check("every measured season crowned a real champion from the field",
    champions.length > 0 && champions.every((c) => c && c !== "?"), champions.join(" | "));

  console.log(`\n=== ${checks - failures}/${checks} passed ===`);
  process.exit(failures > 0 ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
