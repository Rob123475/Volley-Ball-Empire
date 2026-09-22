/**
 * Season rollover, driven through the real HTTP service.
 *
 * Before Phase 1 a career ran off the end of season one: the calendar advanced
 * past endDate, `atSeasonEnd` was returned to the client, and nothing acted on
 * it. This walks a career through its first five season boundaries and asserts
 * on state that MOVES — season number, year, dates, ages, balance — rather than
 * on the endpoint returning 200.
 *
 * L-01 (22 Sep 2026): a career has no last season. The walk used to stop at a
 * "career-complete" result after season 5; now every boundary rolls, and the
 * suite asserts that the career is still going after the fifth. The R-08 arcs
 * below play five full seasons each, and the last section plays ONE
 * established career to season 30 and prints the per-season table Rob's
 * economy decisions (L-04) are read from.
 *
 * Usage: node harness/rollover.mjs [baseUrl]
 */
import { DatabaseSync } from "node:sqlite";
import { healAllSquads } from "./harness-club.mjs";
const BASE = (process.argv[2] ?? "http://localhost:4199") + "/api";

/**
 * R-80: the throwaway database this run is driving, passed by run-all.mjs.
 * Optional - run the suite by hand against any server and the heal below is
 * simply skipped.
 */
const DB_FILE = process.argv[3] ?? null;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

/**
 * L-02a: nobody at a club is there without a contract - still true after thirty
 * seasons, not only on the day a career is created.
 *
 * Thirty seasons of expiry, renewal, retirement, youth promotion and free-agent
 * signings is exactly where a gap would open: one path that attaches a player
 * or a coach to a club without writing a term, run 30 times. Read straight from
 * the throwaway database, because a contract-less person is invisible over HTTP
 * - the squad screen lists them like anyone else.
 */
function contractlessAtClub(label) {
  if (!DB_FILE) return null;
  const db = new DatabaseSync(DB_FILE, { readOnly: true });
  try {
    const save = db.prepare(
      `SELECT id FROM career_saves WHERE manager_name = ? ORDER BY id DESC LIMIT 1`).get(label);
    if (!save) return null;
    const careerSaveId = save.id;
    const players = db.prepare(
      `SELECT COUNT(*) AS n FROM career_player_state ps
         JOIN players p ON p.id = ps.player_id
        WHERE ps.career_save_id = ? AND ps.team_id IS NOT NULL
          AND ps.is_retired = 0
          AND (p.player_type <> 'youth' OR ps.is_promoted = 1)
          AND NOT EXISTS (SELECT 1 FROM contracts c
                           WHERE c.player_id = ps.player_id AND c.team_id = ps.team_id
                             AND c.status = 'active')`).get(careerSaveId).n;
    const staff = db.prepare(
      `SELECT COUNT(*) AS n FROM career_staff_state
        WHERE career_save_id = ? AND team_id IS NOT NULL
          AND (contract_end_date IS NULL OR contract_end_date = '')`).get(careerSaveId).n;
    return { players: Number(players), staff: Number(staff) };
  } finally { db.close(); }
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
  if (DB_FILE) healAllSquads(DB_FILE); // R-80: a forfeit here would be measured as a played match
  const sim = await api("POST", `/matches/${matchId}/simulate`, {});
  if (sim.status < 400) return sim;
  const forfeit = await api("POST", `/matches/${matchId}/forfeit`, {});
  if (forfeit.status >= 400) {
    throw new Error(`match ${matchId}: simulate failed (${sim.status} ${JSON.stringify(sim.data)}) and forfeit failed too (${forfeit.status} ${JSON.stringify(forfeit.data)})`);
  }
  return forfeit;
}

/**
 * R-48: renew every contract that ends within the current season, through the
 * real renewal route (POST /contracts/:id/renew, R-51), before the calendar
 * moves — as a manager would. A starting squad is signed for one season, and
 * without renewal the arc measured a club whose squad walked out on the first
 * day of season 2. Refusals are returned, not hidden: the board's spending block
 * (403) is a legitimate one.
 */
async function renewExpiringContracts(api) {
  const season = (await api("GET", "/seasons/current")).data;
  const contracts = (await api("GET", "/contracts")).data;
  const result = { renewed: 0, refused: [], stale: 0 };
  if (!season?.endDate || !Array.isArray(contracts)) return result;
  for (const c of contracts.filter((k) => k.endDate <= season.endDate)) {
    const r = await api("POST", `/contracts/${c.id}/renew`);
    if (r.status === 200) result.renewed++;
    // L-01 finding: a retired player's contract row stays in GET /contracts
    // and renewing it is refused with "no longer in your squad". That is a
    // stale row, not a spending refusal, and is counted separately so the
    // 30-season run can report it (L-02 owns the fix).
    else if (r.status === 409 && /no longer in your squad/.test(r.data?.error ?? "")) result.stale++;
    else result.refused.push({ status: r.status, error: r.data?.error ?? null });
  }
  return result;
}

/**
 * L-01: the one thing a manager MUST do over a long career that this walk
 * never did — put players on the sand. The starting seniors retire at 40, and
 * an academy graduate is promoted by the rollover (isPromoted) but stays a
 * reserve until the manager gives her a squad role (PATCH /team/roster/:id/role,
 * the Team page's own action). Without this, the first three 30-season
 * attempts were all sacked for abandonment in season 13 (2038): the starting
 * pair, 28 in 2026, turned 40 together, and the club had 25 graduates on its
 * books and not one of them in the side.
 *
 * So, at the start of every season: if fewer than FIELDED players are active,
 * move the best-rated reserves aged 18+ into the side through the real route —
 * starters up to two, then interchange. Nothing else: no signings, no
 * training, no releases. The count is reported per season as "fielded".
 */
const FIELDED = 4;
async function keepSideFielded(api) {
  const roster = (await api("GET", "/team/roster")).data;
  if (!roster) return { moved: 0, refused: [] };
  let starters = (roster.starters ?? []).length;
  let active = starters + (roster.interchanges ?? []).length;
  const bench = (roster.reserves ?? [])
    .filter((p) => p.age >= 18 && !p.isRetired && !p.isInjured)
    .sort((a, b) => (b.overallRating ?? b.rating ?? 0) - (a.overallRating ?? a.rating ?? 0));
  const result = { moved: 0, refused: [] };
  for (const p of bench) {
    if (active >= FIELDED) break;
    const role = starters < 2 ? "starter" : "interchange";
    const r = await api("PATCH", `/team/roster/${p.id}/role`, { role });
    if (r.status === 200) { result.moved++; active++; if (role === "starter") starters++; }
    else result.refused.push({ status: r.status, error: r.data?.error ?? null });
  }
  return result;
}

/**
 * Same shape as advanceToBoundary, but plays every pending match for real.
 *
 * R-47: a sacking is a result, not a harness failure. R-53: the board sacks in
 * two places only — at the season review (the boundary comes back as
 * `seasonRollover.kind === "sacked"` with the review), or for abandonment at a
 * forfeit (`fired: true`). Either way the season stops there and is returned as
 * `sacked`. The career's session no longer has an active team, so the season's
 * record is counted here from the results themselves rather than read from
 * GET /team afterwards.
 */
async function advanceToBoundaryPlaying(api, maxDays = 500) {
  const renewal = await renewExpiringContracts(api);
  let wins = 0, losses = 0;
  for (let i = 0; i < maxDays; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) throw new Error(`advance failed: ${JSON.stringify(r.data)}`);
    if (r.data?.blocked === "pending_match") {
      const played = await playPendingMatch(api, r.data.pendingMatchId);
      if ((played.data?.homeScore ?? 0) > (played.data?.awayScore ?? 0)) wins++; else losses++;
      if (played.data?.fired) {
        return { sacked: { club: played.data.dismissalClubName ?? null, record: `${wins}W ${losses}L`, why: "abandonment" }, days: i + 1, renewal };
      }
      continue;
    }
    const roll = r.data?.seasonRollover;
    if (roll?.kind === "sacked") {
      return { sacked: { club: r.data.dismissalClubName ?? null, record: `${wins}W ${losses}L`, why: "review", review: roll.review }, days: i + 1, renewal };
    }
    if (roll && roll.kind !== "none") return { roll, days: i + 1, body: r.data, renewal };
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
  await renewExpiringContracts(api);   // R-48: keep the squad under contract
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
  // Established, the default. R-54 briefly made this walk an underdog after an
  // established club finishing #7, #7 was sacked against R-53's #2 target;
  // R-55's bands (top-4 met, 5th-8th a warning, 9th or worse a strike) fixed
  // the rule instead, so the walk is back to the club it always was.
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

  // ── Walk the first five boundaries; every one of them must roll ─────────
  const WALK_BOUNDARIES = 5;
  const seen = [];
  const seenBodies = [];
  for (let season = 1; season <= WALK_BOUNDARIES; season++) {
    const hit = await advanceToBoundary(A);
    if (!hit) { check(`reached boundary ${season}`, false, "never rolled over"); break; }
    // R-53: a sacking at the review is a legitimate board result, but this walk
    // exists to cross all five boundaries, so it cannot continue past one.
    if (hit.roll.kind === "sacked") {
      check(`RollA crossed boundary ${season}`, false, `sacked at the season ${hit.roll.fromSeason} review: ${hit.roll.review?.text}`);
      break;
    }
    if (hit.roll.kind !== "rolled") {
      check(`boundary ${season} rolled into a new season`, false, `unexpected rollover kind "${hit.roll.kind}"`);
      break;
    }
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
  const boundaries = seen.length;
  const known = list.filter((p) => ages0.has(p.id));
  const correct = known.filter((p) => p.age === ages0.get(p.id) + boundaries);
  // R-62: each boundary that opens a season brings an academy intake. Those
  // players are traced to the intake that created them (boundary i + 1) and age
  // from the age they arrived at; a promoted one is a senior within five seasons.
  const intakeAge = new Map();
  seen.forEach((r, i) => { for (const p of r.intake?.players ?? []) intakeAge.set(p.id, { age: p.age, boundary: i + 1 }); });
  const fromIntake = list.filter((p) => !ages0.has(p.id) && intakeAge.has(p.id));
  const intakeCorrect = fromIntake.filter((p) => p.age === intakeAge.get(p.id).age + boundaries - intakeAge.get(p.id).boundary);
  check("every player aged exactly one year per season boundary",
    known.length > 0 && correct.length === known.length && intakeCorrect.length === fromIntake.length,
    `${correct.length}/${known.length} with a baseline, ${intakeCorrect.length}/${fromIntake.length} from an academy intake, after ${boundaries} boundaries`);
  check("every senior has a baseline or came from an academy intake (nobody appeared from nowhere)",
    known.length + fromIntake.length === list.length,
    `${known.length} + ${fromIntake.length} intake of ${list.length} traceable`);

  check(`rolled through ${WALK_BOUNDARIES} boundaries`, seen.length === WALK_BOUNDARIES,
    seen.map((r) => `${r.fromSeason}->${r.toSeason}`).join(", "));
  // L-01: the fifth boundary used to end the career. Now it opens season 6
  // like any other, and nothing in the response says the career is over.
  const s6 = (await A("GET", "/seasons/current")).data;
  check("the career keeps going past season 5: season 6 (2031) is active", 
    Number(s6?.year) === 2031 && s6?.status === "active", `year ${s6?.year}, ${s6?.name}, ${s6?.status}`);
  check("no rollover ever reported the career complete (careerComplete is gone from the response)",
    seenBodies.every((b) => !("careerComplete" in (b ?? {})) && b?.seasonRollover?.kind === "rolled"),
    seenBodies.map((b) => b?.seasonRollover?.kind).join(", "));
  const savesNow = (await A("GET", "/careers")).data?.saves;
  const saveNow = (Array.isArray(savesNow) ? savesNow : []).find((c) => c.slotNumber === 1) ?? null;
  check("the save is not retired after five boundaries", saveNow ? saveNow.retiredAt == null : false,
    saveNow ? `retiredAt ${saveNow.retiredAt}` : "career slot not found");

  // The season review has to REACH the client. The rollover returned
  // seasonRollover for weeks and the client never read it, so
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
  check("a history entry per completed season", seasonEntries.length === WALK_BOUNDARIES,
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
  // Promotion. All 72 youth cross 19 within five seasons, so the academy should be
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
  // The rollover has returned seasonRollover since 1.1 and nothing consumed
  // it, so season boundaries passed with nothing to show.
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
  // L-01: season 5's review is an ordinary season review — no "final" flag.
  const fifthReview = await A("GET", "/seasons/2030/review");
  check("season 5's review is an ordinary review with no final-season flag",
    fifthReview.status === 200 && !("isFinalSeason" in (fifthReview.data ?? {})),
    `HTTP ${fifthReview.status}, keys ${Object.keys(fifthReview.data ?? {}).length}`);

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
  console.log("\n=== R-08: FIVE SEASONS, REAL FIXTURES — STRONG vs WEAK SQUAD ===\n");

  // Mirrors utils/tierQualification.ts's TIER_THRESHOLDS (R-54: derived from
  // real seasons, every win scored). Not tunable from here — this harness
  // measures, it does not decide thresholds.
  const TIER_THRESHOLDS = { Bronze: 0, Silver: 55, Gold: 63 };
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

  /**
   * Play `arcSeasons` full seasons of one career and measure each. Used for
   * the R-08 strong/weak arcs (five seasons) and for the L-01 thirty-season
   * run. Stops early only on a sacking — L-01: nothing else ends a career.
   */
  async function runArc(label, difficulty, arcSeasons = ARC_SEASONS) {
    const api = session();
    let team = await newCareer(api, label, difficulty);
    const fixtureSize = await fullFixtureSize(api);
    console.log(
      `  ${label} (${difficulty}) — starting budget $${Number(team.budget).toLocaleString()}` +
      `, ${fixtureSize}-match season fixture`,
    );

    const seasons = [];
    let sacked = null;
    const renewals = [];
    let prevWins = team.wins, prevLosses = team.losses;
    // L-01: the squad the club started with, so squad size, average age and
    // retirements can be reported per season. GET /players is the club's own
    // list — seniors and the academy — and does not generate anything.
    const squadOf = (list) => (Array.isArray(list) ? list : []).filter((p) => !p.isRetired);
    const isAcademy = (p) => p.playerType === "youth" && !p.isPromoted;
    let prevSquadIds = new Set(squadOf((await api("GET", "/players")).data).filter((p) => !isAcademy(p)).map((p) => p.id));

    for (let season = 1; season <= arcSeasons; season++) {
      // Before playing anything: the season the career is sitting in must
      // already have a fixture. Season 1 comes from POST /careers, every later
      // season from the rollover itself (R-35).
      const activeYear = 2026 + season - 1;
      const readyAtStart = await scheduledForYear(api, activeYear);
      const fielded = await keepSideFielded(api);

      const hit = await advanceToBoundaryPlaying(api);
      if (!hit) { console.log(`    season ${season}: never reached a boundary — stopping`); break; }

      // R-47: sacked by the board — the career ends here, and that is the result.
      renewals.push({ season, ...hit.renewal });
      if (hit.sacked) {
        sacked = { season, year: activeYear, record: hit.sacked.record, club: hit.sacked.club, why: hit.sacked.why, review: hit.sacked.review ?? null };
        console.log(hit.sacked.why === "review"
          ? `    season ${season} (${activeYear}): SACKED at the season review after ${hit.sacked.record} — ${hit.sacked.review?.text}`
          : `    season ${season} (${activeYear}): SACKED for abandonment after ${hit.sacked.record} — 30 game days without two contracted players`);
        break;
      }

      if (hit.roll.kind !== "rolled") {
        console.log(`    season ${season}: unexpected rollover kind "${hit.roll.kind}" — stopping`);
        break;
      }

      const endedYear = 2026 + hit.roll.fromSeason - 1;
      const review = await api("GET", `/seasons/${endedYear}/review`);
      const teamNow = await api("GET", "/team");
      team = teamNow.data;

      // L-01: the squad after the boundary — ageing, retirement and promotion
      // have all run. "Retired" is read from the review (the rollover wrote it).
      const everyone = squadOf((await api("GET", "/players")).data);
      const squad = everyone.filter((p) => !isAcademy(p));
      const academy = everyone.filter(isAcademy);
      const squadIds = new Set(squad.map((p) => p.id));
      const promotedThisSeason = squad.filter((p) => p.isPromoted && !prevSquadIds.has(p.id)).length;
      prevSquadIds = squadIds;
      const avgAge = squad.length ? squad.reduce((a, p) => a + (p.age ?? 0), 0) / squad.length : 0;

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
      // R-54: the season that just opened pays full purses up to the tier this
      // one reached — read from the new season's own fixtures.
      const opened = (await api("GET", "/matches")).data;
      const openedFixture = (Array.isArray(opened) ? opened : []).find((m) => m.season === endedYear + 1 && m.purse);
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
        byes: review.data?.fixture?.byes ?? null,
        // R-53: the board's review of this season, as the rollover returned it.
        board: hit.roll.review ?? null,
        nextAccess: openedFixture?.purse?.accessTier ?? null,
        // L-01: the squad after the boundary.
        squadSize: squad.length,
        avgAge: Math.round(avgAge * 10) / 10,
        academy: academy.length,
        retired: Array.isArray(review.data?.retired) ? review.data.retired.length : null,
        promoted: promotedThisSeason,
        intake: hit.roll.intake?.players?.length ?? 0,
        fielded: fielded.moved,
        fieldedRefused: fielded.refused,
      };
      seasons.push(row);
      console.log(
        `    season ${row.season} (${row.year}): ${row.record}  ·  ${row.played}/${fixtureSize} played  ·  ` +
        `${row.rankingPoints ?? "?"} ranking pts  ·  ${row.tier} tier  ·  $${row.balance.toLocaleString()} balance  ·  ` +
        `#${row.rank ?? "?"} in the field  ·  finals: ${row.finals}  ·  champion: ${row.champion}  ·  ` +
        `squad ${row.squadSize} (avg age ${row.avgAge})  ·  academy ${row.academy}  ·  retired ${row.retired ?? "?"}  ·  promoted ${row.promoted}  ·  intake ${row.intake}  ·  fielded ${row.fielded}`,
      );
      console.log(`      board: ${row.board?.text ?? "NO REVIEW"}`);
    }

    // R-77: every season boundary counts a completed season. Read once the
    // arc is over, for the Local Legend check below.
    const careerEnd = sacked ? null : {
      seasonsCompleted: (await api("GET", "/achievements/career-stats")).data?.seasonsCompleted ?? null,
      localLegend: ((await api("GET", "/achievements")).data ?? []).find((a) => a.key === "local_legend")?.unlocked ?? null,
    };

    // L-02a: read after the last boundary, so it covers every rollover above.
    const contractless = contractlessAtClub(label);

    return { label, difficulty, seasons, fixtureSize, sacked, renewals, careerEnd, contractless };
  }

  // R-47: a sacking is a legitimate result, so one career per arc could only say
  // "sacked" or "not sacked". Each arc runs ARC_CAREERS careers, each to the end
  // of the arc or to its sacking, and reports how many were sacked. The first
  // career of each arc is the one the summary table shows.
  const ARC_CAREERS = 3;
  // L-01: five full seasons each, every boundary a rollover. Before L-01 the
  // arc measured four seasons and the fifth boundary ended the career.
  const ARC_SEASONS = 5;
  const strongRuns = [], weakRuns = [];
  for (let i = 1; i <= ARC_CAREERS; i++) strongRuns.push(await runArc(i === 1 ? "RollStrong" : `RollStrong${i}`, "established"));
  for (let i = 1; i <= ARC_CAREERS; i++) weakRuns.push(await runArc(i === 1 ? "RollWeak" : `RollWeak${i}`, "underdog"));
  const strong = strongRuns[0];
  const weak   = weakRuns[0];

  // The arc has to actually cover the arc: five boundaries means five measured
  // seasons, so "at least one" is not good enough — that is precisely what let
  // the first version of this section pass with seasons 2-5 empty.
  const EXPECTED_SEASONS = ARC_SEASONS;
  for (const arc of [...strongRuns, ...weakRuns]) {
    // R-47: every season the career played is measured — all five, or every
    // season before the one it was sacked in.
    const sackedAfterMeasured = !!arc.sacked && arc.sacked.season === arc.seasons.length + 1;
    check(`${arc.label} (${arc.difficulty}) measured every season it played: all ${EXPECTED_SEASONS}, or up to its sacking`,
      arc.seasons.length === EXPECTED_SEASONS || sackedAfterMeasured,
      arc.sacked
        ? `${arc.seasons.length} full season(s), sacked in season ${arc.sacked.season}`
        : `${arc.seasons.length} season(s) measured`);

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
    // R-44: a bye is not a match either.
    const short = arc.seasons.filter((r) => r.notQualified == null || r.byes == null
      || r.played !== arc.fixtureSize - r.notQualified - r.byes);
    check(`${arc.label}: every season played every match it was entitled to (fixture of ${arc.fixtureSize} less byes and finals not qualified for)`,
      short.length === 0,
      short.length === 0
        ? arc.seasons.map((r) => `${r.played}/${arc.fixtureSize}`).join(" | ")
        : short.map((r) => `season ${r.season} played ${r.played}, byes ${r.byes}, not qualified for ${r.notQualified}`).join("; "));

    // R-48/R-52: the squad is renewed through the real route at the start of
    // every season, on the same terms. A spending freeze no longer blocks that,
    // so no renewal may be refused and every season renews someone.
    const refusals = arc.renewals.flatMap((r) => r.refused.map((x) => `season ${r.season}: ${x.status} ${x.error}`));
    check(`${arc.label}: its contracts were renewed at the start of every season, none refused`,
      arc.renewals.length > 0 && arc.renewals.every((r) => r.renewed > 0) && refusals.length === 0,
      refusals.join("; ") || arc.renewals.map((r) => `S${r.season} ${r.renewed} renewed`).join(" | "));

    check(`${arc.label}: no season was a 0W 0L walkover`,
      arc.seasons.every((r) => r.played > 0),
      arc.seasons.map((r) => r.record).join(" | "));

    // R-53: every season the board closed carries its review — each measured
    // season and the season a review sacked in. L-01: no review is a verdict.
    const reviews = [...arc.seasons.map((r) => r.board), ...(arc.sacked?.why === "review" ? [arc.sacked.review] : [])];
    const expectedReviews = arc.seasons.length + (arc.sacked?.why === "review" ? 1 : 0);
    check(`${arc.label}: the board reviewed every season it closed, and none of them was a "verdict"`,
      reviews.length === expectedReviews && reviews.every((v) => v && typeof v.text === "string" && v.outcome && v.outcome !== "verdict"),
      `${reviews.filter(Boolean).length}/${expectedReviews} reviews: ${reviews.map((v) => v?.outcome).join(", ")}`);

    // R-77: seasons are counted at every season boundary, so a career that
    // plays five seasons has completed five and unlocks Local Legend — and
    // L-01: it is still going.
    if (!arc.sacked) {
      check(`${arc.label}: five seasons played counts five completed seasons and unlocks Local Legend`,
        arc.careerEnd?.seasonsCompleted === 5 && arc.careerEnd?.localLegend === true,
        `seasonsCompleted ${arc.careerEnd?.seasonsCompleted}, Local Legend ${arc.careerEnd?.localLegend}`);
    }

    // R-54: purse access is the tier the club finished last season.
    check(`${arc.label}: each next season pays full purses up to the tier this season reached`,
      arc.seasons.length > 0 && arc.seasons.every((r) => r.nextAccess === r.tier),
      arc.seasons.map((r) => `S${r.season} ${r.rankingPoints}pts ${r.tier} -> S${r.season + 1} access ${r.nextAccess}`).join(" | "));
  }


  console.log("\n  ── Summary table (for I8/I9 — report only, nothing tuned here) ──");
  console.log("  Season | Strong: record / played / pts / tier / balance / rank / finals          | Weak: record / played / pts / tier / balance / rank / finals");
  const span = (arc) => arc.seasons.length + (arc.sacked ? 1 : 0);
  const maxSeasons = Math.max(span(strong), span(weak));
  for (let i = 0; i < maxSeasons; i++) {
    const fmt = (arc) => {
      const row = arc.seasons[i];
      if (row) {
        return `${row.record} / ${row.played}/${arc.fixtureSize} / ${row.rankingPoints ?? "?"} / ${row.tier} / $${row.balance.toLocaleString()} / #${row.rank ?? "?"} / ${row.finals}`;
      }
      if (arc.sacked && arc.sacked.season === i + 1) return `SACKED (${arc.sacked.why}) after ${arc.sacked.record}`;
      return "—";
    };
    console.log(`  ${(i + 1).toString().padStart(6)} | ${fmt(strong).padEnd(80)} | ${fmt(weak)}`);
  }

  // R-47: the sack rate per arc, over every career it ran.
  console.log(`\n  ── Sackings per arc (R-47: a legitimate result — reported, not failed; ${ARC_CAREERS} careers each) ──`);
  for (const [label, runs] of [["Strong (established)", strongRuns], ["Weak (underdog)", weakRuns]]) {
    const sackedRuns = runs.filter((r) => r.sacked);
    console.log(`  ${label}: sacked in ${sackedRuns.length} of ${runs.length} careers (${Math.round(100 * sackedRuns.length / runs.length)}%)`);
    for (const r of runs) {
      const seasonsText = r.seasons.map((x) => x.record).join(" | ");
      console.log(`    ${r.label.padEnd(12)} ${seasonsText || "(no full season)"}${r.sacked ? `  ->  SACKED (${r.sacked.why}) in season ${r.sacked.season} after ${r.sacked.record}` : `  ->  still in the job after ${r.seasons.length} seasons`}`);
      // R-48: a refused renewal lapses the squad at the FOLLOWING season boundary.
      const refusedSeasons = (r.renewals ?? []).filter((x) => x.refused.length > 0).map((x) => x.season);
      if (refusedSeasons.length > 0) {
        console.log(`      renewal refused at the start of season(s) ${refusedSeasons.join(", ")}: the squad lapses at the following season boundary`);
      }
    }
  }

  // R-53: the board's review of every season, in its own words.
  console.log("\n  ── Board reviews, per season (R-53) ──");
  for (const arc of [...strongRuns, ...weakRuns]) {
    const lines = [
      ...arc.seasons.map((r) => r.board?.text ?? `Season ${r.season}: NO REVIEW`),
      ...(arc.sacked?.why === "review" ? [arc.sacked.review?.text] : []),
      ...(arc.sacked?.why === "abandonment" ? [`Season ${arc.sacked.season}: sacked for abandonment after ${arc.sacked.record}`] : []),
    ];
    for (const line of lines) console.log(`  ${arc.label.padEnd(12)} ${line}`);
  }

  // R-29, Rob's pass condition: the player must NOT win every season by default.
  // With a real field and real seeding the title is an outcome, not a given.
  console.log("\n  ── World Finals, per season ──");
  for (const arc of [...strongRuns, ...weakRuns]) {
    for (const r of arc.seasons) {
      console.log(`  ${arc.label.padEnd(12)} season ${r.season}: finished #${r.rank ?? "?"}, finals: ${r.finals}, champion: ${r.champion}`);
    }
    const titles = arc.seasons.filter((r) => r.finals === "champion").length;
    console.log(`  REPORT  ${arc.label.padEnd(12)} ${titles} title(s) in ${arc.seasons.length} seasons`);
  }

  // R-80: this used to assert, PER ARC, that the club dropped at least one
  // title — and it failed a Gate 3 run when RollStrong won 4 of 4. That is not
  // a bug. A deliberately strong squad sweeping four seasons is the engine
  // working. Measured across three full runs, the three strong arcs returned
  // 4,3,3 · 0,1,1 · 2,2,1 titles in 4 seasons: the whole range, so "this arc
  // must drop one" is a coin toss, not a property of the game.
  //
  // What R-29 actually guards is that the title is not GIVEN to the player.
  // Under that bug every arc wins every season, weak ones included. So the
  // assertion is made over the whole measured population instead, where it is
  // deterministic: the underdog arcs finish ~#18 and never qualify, returning
  // 0 titles in every run, so this holds whenever the engine is honest and
  // fails the moment the title is handed out by default.
  const measured = [...strongRuns, ...weakRuns].flatMap((arc) => arc.seasons);
  const playerTitles = measured.filter((r) => r.finals === "champion").length;
  check("the title is contested — the player's clubs did not win every measured season",
    measured.length > 0 && playerTitles < measured.length,
    `${playerTitles} of ${measured.length} measured seasons won by the player's club`);

  // R-80, second pass: "an underdog never wins the World Final" was measured at
  // 0 failures in 72 underdog seasons (best finish #9 of 19, never qualified) -
  // but it is a PROBABILITY, not a guarantee. A season is simulated, so nothing
  // about its outcome can be certain. Asserting it would leave a check that can
  // fail on correct behaviour, which is the fault this whole gate exists to
  // remove.
  //
  // So the property is asserted structurally instead, over two records that are
  // produced independently: the standings rank, and the finals bracket. Only
  // four clubs reach the semi-finals (worldFinalsSummaryTx: a club qualifies by
  // appearing in a semi-final fixture), and the champion is read off the final
  // match own set scores. A club crowned champion from outside the top four
  // therefore cannot happen while the engine is honest, and must happen the
  // moment a title is handed out by standing rather than played for. No dice.
  //
  // The "results follow ratings, not default" property itself is proven far
  // more strongly, and deterministically, by condition.mjs: 5,000 matches per
  // fitness level, win rate 65.6% / 37.3% / 14.0%, z = 52.8.
  const FINALS_QUALIFIERS = 4;
  const crowned = measured.filter((r) => r.finals === "champion");
  const unqualifiedChampions = crowned.filter((r) => r.rank == null || r.rank > FINALS_QUALIFIERS);
  check("a club is only crowned champion in a season it finished inside the finals places",
    unqualifiedChampions.length === 0,
    unqualifiedChampions.length
      ? unqualifiedChampions.map((r) => `season ${r.season} champion from #${r.rank}`).join("; ")
      : `${crowned.length} title(s), every one from inside the top ${FINALS_QUALIFIERS}`);

  const weakSeasons = weakRuns.flatMap((arc) => arc.seasons);
  const weakTitles = weakSeasons.filter((r) => r.finals === "champion").length;
  console.log(`  REPORT  underdog arcs: ${weakTitles} title(s) across ${weakSeasons.length} seasons, best finish #${Math.min(...weakSeasons.map((r) => r.rank ?? 99))}`);
  const champions = [...strongRuns, ...weakRuns].flatMap((arc) => arc.seasons.map((r) => r.champion));
  check("every measured season crowned a real champion from the field",
    champions.length > 0 && champions.every((c) => c && c !== "?"), `${champions.length} seasons: ${champions.join(" | ")}`);

  // ── L-01: thirty seasons, one established career ─────────────────────────
  //
  // Rob's decision, 22 Sep 2026: a career must be able to run 30-40 seasons.
  // This plays ONE established career, real fixtures, through thirty season
  // boundaries and prints the per-season table Rob reads before any economy
  // decision (L-04). It is MEASUREMENT: nothing here is tuned or judged
  // against a "should be" figure. What IS asserted is the L-01 rule itself —
  // a career that is not sacked keeps rolling — and that the run reached
  // season 30 with every season played and its fixture in place.
  //
  // A sacking is a legitimate board result, not a bug, so the run starts
  // another career if one is sacked, up to LONG_ATTEMPTS. Every attempt is
  // reported. If every attempt is sacked the check fails, because then nothing
  // has proven thirty seasons.
  const LONG_SEASONS = Number(process.env.LONG_SEASONS ?? 30);
  const LONG_ATTEMPTS = 3;
  console.log(`\n=== L-01: ${LONG_SEASONS} SEASONS, ONE ESTABLISHED CAREER, REAL FIXTURES ===\n`);
  let long = null;
  const longAttempts = [];
  for (let attempt = 1; attempt <= LONG_ATTEMPTS; attempt++) {
    const run = await runArc(attempt === 1 ? "Long" : `Long${attempt}`, "established", LONG_SEASONS);
    longAttempts.push(run);
    if (!run.sacked) { long = run; break; }
    console.log(`  (${run.label} was sacked in season ${run.sacked.season}; starting another career)`);
  }
  const longRun = long ?? longAttempts[longAttempts.length - 1];

  check(`one established career played ${LONG_SEASONS} seasons and is still in the job`,
    long !== null && long.seasons.length === LONG_SEASONS,
    long ? `${long.label}: ${long.seasons.length} seasons, no sacking` : `every one of ${LONG_ATTEMPTS} careers was sacked: ${longAttempts.map((r) => `${r.label} in season ${r.sacked?.season}`).join(", ")}`);
  check(`every one of its ${LONG_SEASONS} boundaries rolled into a new season (a career ends only by sacking)`,
    longRun.seasons.length > 0 && longRun.seasons.every((r) => r.board && r.board.outcome !== "verdict"),
    `${longRun.seasons.length} rollovers`);
  const longUnready = longRun.seasons.filter((r) => r.readyAtStart === 0);
  check(`${longRun.label}: every season had its fixture before anything asked for it`,
    longUnready.length === 0,
    longUnready.length === 0 ? `all ${longRun.seasons.length} seasons scheduled at their start` : `empty fixture at start of season(s) ${longUnready.map((r) => r.season).join(", ")}`);
  const longShort = longRun.seasons.filter((r) => r.notQualified == null || r.byes == null || r.played !== longRun.fixtureSize - r.notQualified - r.byes);
  check(`${longRun.label}: every season played every match it was entitled to`,
    longShort.length === 0,
    longShort.length === 0 ? `${longRun.seasons.length} full seasons` : longShort.map((r) => `season ${r.season} played ${r.played}, byes ${r.byes}, not qualified for ${r.notQualified}`).join("; "));
  const longRefusals = longRun.renewals.flatMap((r) => r.refused.map((x) => `season ${r.season}: ${x.status} ${x.error}`));
  check(`${longRun.label}: contracts renewed at the start of every season, none refused`,
    longRun.renewals.length > 0 && longRefusals.length === 0, longRefusals.slice(0, 5).join("; ") || `${longRun.renewals.length} seasons renewed`);
  // L-02b: a retired player used to keep an active contract row for ever, so
  // every season opened with renewals refused as "no longer in your squad" —
  // 53 of them across the thirty-season run, and the club carrying a wage for
  // somebody who had left the game. Retirement closes the contract now.
  {
    const staleTotal = longRun.renewals.reduce((a, r) => a + (r.stale ?? 0), 0);
    const staleSeasons = longRun.renewals.filter((r) => (r.stale ?? 0) > 0).map((r) => `S${r.season}:${r.stale}`);
    check(`${longRun.label}: no renewal over ${longRun.seasons.length} seasons was refused as "no longer in your squad"`,
      staleTotal === 0,
      staleTotal === 0 ? "0 stale contract rows" : `${staleTotal} refused (${staleSeasons.join(" ")})`);
  }

  // L-02a: Rob's rule is "EVERY player, staff member and medical staff member
  // has a contract". A fresh career proves it on day one (contract-terms.mjs);
  // this proves it survives thirty seasons of expiry, renewal, retirement,
  // promotion and signing.
  if (longRun.contractless) {
    const cl = longRun.contractless;
    check(`${longRun.label}: after ${longRun.seasons.length} seasons, nobody at the club is there without a contract`,
      cl.players === 0 && cl.staff === 0,
      `${cl.players} player(s), ${cl.staff} staff without one`);
  }

  if (long) {
    const lastYear = 2026 + LONG_SEASONS;
    check(`${long.label}: season ${LONG_SEASONS + 1} (${lastYear}) opened after the ${LONG_SEASONS}th boundary`,
      long.seasons[long.seasons.length - 1]?.year === lastYear - 1 && long.careerEnd?.seasonsCompleted === LONG_SEASONS,
      `last measured season ${long.seasons[long.seasons.length - 1]?.year}, seasonsCompleted ${long.careerEnd?.seasonsCompleted}`);
  }

  // The table. Every column is read, none is judged.
  console.log(`\n  ── ${longRun.label}: per-season table (L-01 — report only, nothing tuned; the input to L-04) ──`);
  console.log("  Squad = the club's non-academy players after the boundary; Retired = retirements that season across the whole career world (the review's list), not only the club's.");
  console.log("  Season  Year  Record   Played  Pts  Tier    Finish  Finals            Balance        Squad  AvgAge  Academy  Retired  Promoted  Intake  Fielded  Board");
  for (const r of longRun.seasons) {
    console.log(
      `  ${String(r.season).padStart(6)}  ${r.year}  ${r.record.padEnd(8)} ${String(r.played).padStart(6)}  ${String(r.rankingPoints ?? "?").padStart(3)}  ${String(r.tier).padEnd(7)} ${("#" + (r.rank ?? "?")).padStart(6)}  ${String(r.finals).padEnd(17)} ${("$" + r.balance.toLocaleString()).padStart(14)}  ${String(r.squadSize).padStart(5)}  ${String(r.avgAge).padStart(6)}  ${String(r.academy).padStart(7)}  ${String(r.retired ?? "?").padStart(7)}  ${String(r.promoted).padStart(8)}  ${String(r.intake).padStart(6)}  ${String(r.fielded).padStart(7)}  ${r.board?.outcome ?? "?"} (${r.board?.confidenceBefore ?? "?"}->${r.board?.confidenceAfter ?? "?"})`,
    );
  }
  if (longRun.sacked) console.log(`  ${String(longRun.sacked.season).padStart(6)}  ${longRun.sacked.year}  SACKED (${longRun.sacked.why}) after ${longRun.sacked.record} — ${longRun.sacked.review?.text ?? ""}`);

  // What goes wrong over thirty years — said plainly, from the numbers above.
  // These are observations for Rob, not pass/fail checks: the brief says the
  // run does not have to look good, it has to run and the report has to be
  // honest about what it found.
  console.log(`\n  ── ${longRun.label}: what the ${longRun.seasons.length}-season run shows (observations, not checks) ──`);
  const rows = longRun.seasons;
  if (rows.length > 0) {
    const first = rows[0], last = rows[rows.length - 1];
    const peakBal = rows.reduce((m, r) => Math.max(m, r.balance), -Infinity);
    const minBal = rows.reduce((m, r) => Math.min(m, r.balance), Infinity);
    const perSeason = rows.length > 1 ? (last.balance - first.balance) / (rows.length - 1) : 0;
    console.log(`  MONEY    balance $${first.balance.toLocaleString()} after season 1 -> $${last.balance.toLocaleString()} after season ${last.season}; ` +
      `peak $${peakBal.toLocaleString()}, low $${minBal.toLocaleString()}; average change $${Math.round(perSeason).toLocaleString()} per season` +
      (minBal < 0 ? " — WENT INTO DEBT" : "") +
      (last.balance > 10 * Math.max(1, first.balance) ? " — RUNAWAY: more than 10x the season-1 balance, money stops meaning anything" : "") +
      (last.balance < first.balance ? " — DECLINING" : ""));
    const ages = rows.map((r) => r.avgAge);
    const sizes = rows.map((r) => r.squadSize);
    console.log(`  SQUAD    size ${first.squadSize} -> ${last.squadSize} (min ${Math.min(...sizes)}, max ${Math.max(...sizes)}); average age ${first.avgAge} -> ${last.avgAge} (min ${Math.min(...ages)}, max ${Math.max(...ages)})` +
      (Math.min(...sizes) < 2 ? " — FELL BELOW A PAIR: the club could not field a side" : "") +
      (Math.max(...ages) >= 34 ? " — AGEING OUT: average age reached the mid-thirties" : ""));
    const retiredTotal = rows.reduce((a, r) => a + (r.retired ?? 0), 0);
    const retireWave = rows.filter((r) => (r.retired ?? 0) >= 3).map((r) => `S${r.season}:${r.retired}`);
    console.log(`  RETIRED  ${retiredTotal} players retired across ${rows.length} seasons` + (retireWave.length ? `; seasons with 3+ retirements: ${retireWave.join(" ")}` : "; never more than 2 in a season"));
    const promotedTotal = rows.reduce((a, r) => a + r.promoted, 0);
    const intakeTotal = rows.reduce((a, r) => a + r.intake, 0);
    const emptyAcademy = rows.filter((r) => r.academy === 0).map((r) => r.season);
    const noIntake = rows.filter((r) => r.intake === 0).map((r) => r.season);
    console.log(`  ACADEMY  ${intakeTotal} youth taken in, ${promotedTotal} promoted to the senior squad; academy size ${first.academy} -> ${last.academy}` +
      (emptyAcademy.length ? ` — EMPTY in season(s) ${emptyAcademy.join(", ")}` : "; never empty") +
      (noIntake.length ? `; no intake in season(s) ${noIntake.join(", ")}` : ""));
    const tiers = {}; for (const r of rows) tiers[r.tier] = (tiers[r.tier] ?? 0) + 1;
    const titles = rows.filter((r) => r.finals === "champion").length;
    const finishes = rows.map((r) => r.rank ?? 99);
    console.log(`  RESULTS  ${titles} World Final title(s) in ${rows.length} seasons; finishes #${Math.min(...finishes)} to #${Math.max(...finishes)}; tiers ${Object.entries(tiers).map(([t, n]) => `${t} x${n}`).join(", ")}` +
      (titles === rows.length ? " — WON EVERY SEASON: the field never catches up" : "") +
      (titles >= 0.8 * rows.length && rows.length >= 10 ? " — dominant: the AI field does not age or turn over (L-03)" : ""));
    const odd = rows.filter((r) => r.rank == null || r.rankingPoints == null || r.champion === "?" || r.champion == null);
    console.log(`  STANDINGS ${odd.length === 0 ? "every season had a rank, ranking points and a real champion" : `ANOMALIES in season(s) ${odd.map((r) => r.season).join(", ")}: missing rank, points or champion`}`);
    console.log(`  CONTRACTS see the retirement check above`);
    const fieldedTotal = rows.reduce((a, r) => a + r.fielded, 0);
    const fieldRefusals = rows.flatMap((r) => r.fieldedRefused.map((x) => `S${r.season}: ${x.status} ${x.error}`));
    console.log(`  SIDE     ${fieldedTotal} reserve(s) moved into the side by the harness over the run (the manager's minimum: keep ${FIELDED} active)` +
      (fieldRefusals.length ? `; refused: ${fieldRefusals.slice(0, 5).join("; ")}` : ""));
    const outcomes = {}; for (const r of rows) outcomes[r.board?.outcome ?? "?"] = (outcomes[r.board?.outcome ?? "?"] ?? 0) + 1;
    const lastPlace = rows.filter((r) => (r.rank ?? 0) >= 18).length;
    console.log(`  BOARD    ${Object.entries(outcomes).map(([o, n]) => `${o} x${n}`).join(", ")}; confidence ended at ${last.board?.confidenceAfter ?? "?"}` +
      (lastPlace >= 5 && !outcomes.final_warning && !outcomes.sacked
        ? ` — ${lastPlace} seasons finished 18th or 19th and the board never went past a warning: a squad ranked weakest in the field cannot fail on position (R-55 bands), so a collapsed club is never at risk`
        : ""));
  }

  console.log(`\n=== ${checks - failures}/${checks} passed ===`);
  process.exit(failures > 0 ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
