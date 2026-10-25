/**
 * 1.1.3 (Rob, 23 Oct; brief A4): the Empire Nations Cup played over days, watched
 * on the 3D court, and the player as a national coach.
 *
 *   1. (source) the one-shot Cup is gone; the calendar plays it day by day; the
 *      pay table runs against strength; every nation has a national kit
 *   2. offers, first window: none before the six months before the Cup, 1 to 3
 *      on its first day (Career page and Dashboard data); a contract is 3 or 5
 *      years (4 is refused); accepting declines the rest
 *   3. pay: fixed when offered, paid to him day by day, never on the club's books
 *   4. the National Team page: his nation's players at clubs, injuries shown, an
 *      injured player can't be picked; he picks a pair (not the best two) and
 *      the training camp
 *   5. the draw (end of round 70's day): his picked pair plays, with the camp's
 *      bonus and fatigue; every other nation plays its best two fit (unpicked:
 *      the default); 12 group fixtures on group day
 *   6. watched on the court: his nation's match is live, in national colours,
 *      Nations Cup boards, Manual allowed (another nation's: Auto only); the
 *      court's result decides it (and a match left part-way is finished by the
 *      engine from its last score); every match not watched is decided by the
 *      engine at the end of its day; each stage made from the one before
 *   7. medals as before (the same tables), the A5 ceremony queued, Club News
 *   8. offers, second window: as soon as his contract ends; a better record,
 *      stronger nations, and they pay less; a 5-year contract; decline them all
 *
 * Usage: node harness/nations-cup.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createWorld, REPO } from "./night2-world.mjs";
import { keepSideFielded, renewExpiringContracts, healSquadByTeam, turnDownBids } from "./harness-club.mjs";

const W = createWorld("nations-cup", 4992);
const { check, info } = W;
const CUP = 2028;
const SRC = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const { NATIONAL_COACH_PAY, nationalCoachPay, NATIONAL_CAMP } = await import(pathToFileURL(path.join(REPO, "lib/db/src/schema/national-coach.ts")).href);
const { NATIONAL_KITS } = await import(pathToFileURL(path.join(REPO, "lib/db/src/schema/national-kits.ts")).href);
console.log("=".repeat(72));
console.log("  1.1.3 (A4): THE EMPIRE NATIONS CUP OVER DAYS, AND THE NATIONAL COACH");
console.log("=".repeat(72));

try {
  // ── 1. Source ──────────────────────────────────────────────────────────────
  console.log("\n1. (SOURCE)");
  const engine = SRC("artifacts/api-server/src/utils/olympics.ts"), cal = SRC("artifacts/api-server/src/routes/calendar.ts"), wt = SRC("artifacts/api-server/src/utils/worldTour.ts");
  check("the one-shot Cup is gone: the World Tour no longer plays it, the calendar's day does",
    !/playOlympicsTx/.test(engine + wt) && /nationsCupDayTx\(w, expiryCareerId, season\.year, team\.id, calendar\.currentDate/.test(cal));
  const pays = NATIONAL_COACH_PAY.map((b) => b.monthly);
  check("the pay runs against strength: the strongest pay least, the weakest most (a named table)",
    pays.every((p, i) => i === 0 || p > pays[i - 1]) && nationalCoachPay(0) < nationalCoachPay(1), pays.map((p) => `$${p}`).join(" < "));
  const nations = [...SRC("lib/db/src/schema/continents.ts").matchAll(/^iso\("[A-Z]{2}", \["([^"]+)"/gm)].map((m) => m[1]).concat(["England", "Scotland", "Wales"]);
  const noKit = nations.filter((n) => !NATIONAL_KITS[n]);
  check("every nation the game knows has a national kit", noKit.length === 0, noKit.join(", ") || `${nations.length} nations`);
  const rules = SRC("artifacts/beach-volleyball/src/pages/rules.tsx");
  check("the rules page explains the national coach job", /National coach/.test(rules) && rules.includes('NATIONAL_COACH.contractYears.join(" or ")} years, your only choice') && /the weakest nations pay the most/.test(rules) && /The Empire Nations Cup, day by day/.test(rules));

  await W.boot();
  const { profileId, teamId, cid } = await W.newCareer("National Coach");
  const today = () => W.q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d ?? "";
  const offers = (status = "open") => W.q(`SELECT * FROM national_coach_offers WHERE career_save_id = ? AND status = ? ORDER BY id`, cid, status);
  const job = () => W.q(`SELECT * FROM national_coach_jobs WHERE career_save_id = ? AND status = 'active'`, cid)[0] ?? null;
  let guard = 0, offersBeforeWindow = 0;
  const windowOpens = `${CUP}-05-24`;
  async function playTo(date, each) {
    while (today() < date && guard++ < 1600) {
      healSquadByTeam(W.db, teamId);
      turnDownBids(W.db, teamId);
      if (guard % 7 === 1) { await keepSideFielded(W.api); await renewExpiringContracts(W.api); }
      const r = await W.day();
      if (r.status >= 400) throw new Error(`advance ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") W.w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
      if (each) await each();
    }
  }

  // ── 2. First window ────────────────────────────────────────────────────────
  console.log("\n2. OFFERS IN THE SIX MONTHS BEFORE THE CUP");
  await playTo(`${CUP}-05-23`, async () => { if (today() < windowOpens) offersBeforeWindow += offers().length; });
  check(`no offer before ${windowOpens} (six months before the Cup's group day)`, offersBeforeWindow === 0 && W.q(`SELECT COUNT(*) n FROM national_coach_offers WHERE career_save_id = ?`, cid)[0].n === 0, today());
  // His record then (the manager level picks the band the offers come from): Local Coach, for this suite.
  W.w(`UPDATE teams SET manager_rep_points = 0 WHERE id = ?`, teamId);
  await playTo(`${CUP}-05-25`);
  const first = offers();
  check("on that day 1 to 3 nations offer, for the coming Cup", first.length >= 1 && first.length <= 3 && first.every((o) => o.reason === "cup_window" && o.cup_year === CUP && o.offered_on === windowOpens),
    first.map((o) => `${o.nation} #${o.strength_rank}/${o.ranked} $${o.monthly}`).join(", "));
  const status = (await W.api("GET", "/national-coach")).data;
  check("the Career page and the Dashboard read them (GET /national-coach)", status?.offers?.length === first.length && status?.job == null);
  const bad = await W.api("POST", `/national-coach/offers/${first[0].id}/accept`, { years: 4 });
  check("a contract of 4 years is refused (3 or 5 only)", bad.status === 400 && /3 or 5 years/.test(bad.data?.error ?? ""), bad.data?.error);
  const ok = await W.api("POST", `/national-coach/offers/${first[0].id}/accept`, { years: 3 });
  const j = job();
  check("accepting for 3 years: the job runs 3 years from today at the offer's pay", ok.status === 200 && j?.nation === first[0].nation && j.years === 3
    && j.ends_on === `${CUP + 3}${j.started_on.slice(4)}` && j.monthly === first[0].monthly, `${j?.nation} ${j?.started_on} to ${j?.ends_on}, $${j?.monthly}/mo`);
  check("the other offers are declined", offers().length === 0 && offers("declined").length === first.length - 1);

  // ── 3. Pay ────────────────────────────────────────────────────────────────
  console.log("\n3. HIS OWN PAY, NEVER THE CLUB'S BOOKS");
  const started = j.started_on;
  await playTo(`${CUP}-06-24`);
  const paid = job();
  const days = Math.round((Date.parse(paid.paid_to) - Date.parse(started)) / 86_400_000) + 1;
  check("paid day by day: the monthly pay x 12 / 365 a day", Math.abs(paid.paid - paid.monthly * 12 / 365 * days) < 1, `$${Math.round(paid.paid)} for ${days} days at $${paid.monthly}/mo`);
  const ledger = W.q(`SELECT COUNT(*) n FROM finance_transactions WHERE team_id = ? AND (category LIKE '%national%' OR description LIKE '%ational coach%')`, teamId)[0].n;
  check("nothing of it is on the club's ledger", ledger === 0);
  const summary = (await W.api("GET", "/careers/summary")).data;
  check("it counts in his career earnings, and his profile shows the national pay", summary?.nationalCoach?.nation === paid.nation && summary?.nationalCoach?.monthly === paid.monthly,
    JSON.stringify(summary?.nationalCoach ?? null));

  // ── 4. The National Team page ─────────────────────────────────────────────
  console.log("\n4. THE NATIONAL TEAM PAGE");
  await playTo(`${CUP}-11-10`);
  // A nation sure to be in the Cup, for this suite (the offers came from the weak end, which may not qualify).
  const quals = (await W.api("GET", "/olympics/qualifiers")).data?.countries ?? [];
  let mine = null;
  for (const c of quals.slice(0, 8)) {
    W.w(`UPDATE national_coach_jobs SET nation = ? WHERE id = ?`, c.country, paid.id);
    const v = (await W.api("GET", "/national-team")).data;
    if ((v?.players ?? []).filter((p) => !p.injured).length >= 4) { mine = c.country; break; }
  }
  check("(set-up) he coaches a nation in the qualifying top 8 with 4 fit players or more", !!mine, mine ?? quals.slice(0, 8).map((c) => c.country).join(", "));
  let page = (await W.api("GET", "/national-team")).data;
  const free = W.q(`SELECT COUNT(*) n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND p.nationality = ?`, cid, mine)[0].n;
  check("every listed player is at a club, never a free agent", page.players.every((p) => p.club && (p.teamId != null || p.poolTeamId != null)), `${page.players.length} listed, ${free} free agents of ${mine} not listed`);
  const careerOne = page.players.find((p) => p.kind === "player" && !p.injured && p !== page.players[0] && p !== page.players[1]);
  if (careerOne) W.w(`UPDATE career_player_state SET is_injured = 1, injury_status = 'Hamstring Strain', injury_weeks_remaining = 3 WHERE career_save_id = ? AND player_id = ?`, cid, careerOne.id);
  page = (await W.api("GET", "/national-team")).data;
  const hurt = page.players.find((p) => p.injured);
  check("injuries are shown", !!hurt, hurt ? `${hurt.name} injured, ${hurt.injuryWeeks} wk` : "none injured");
  const fitNow = page.players.filter((p) => !p.injured);
  const refuse = hurt ? await W.api("POST", "/national-team/pair", { pair: [{ kind: hurt.kind, id: hurt.id }, { kind: fitNow[0].kind, id: fitNow[0].id }] }) : { status: 400, data: { error: "injured" } };
  check("an injured player can't be picked", refuse.status === 400 && /injured/i.test(refuse.data?.error ?? ""), refuse.data?.error);
  let picked = [fitNow[1], fitNow[2]];
  const pick = await W.api("POST", "/national-team/pair", { pair: picked.map((p) => ({ kind: p.kind, id: p.id })) });
  const camp = await W.api("POST", "/national-team/camp", { camp: "training" });
  page = (await W.api("GET", "/national-team")).data;
  check("he picks a pair that is not the best two, and the training camp", pick.status === 200 && camp.status === 200 && page.camp === "training"
    && JSON.stringify(page.pair) === JSON.stringify(picked.map((p) => ({ kind: p.kind, id: p.id }))), picked.map((p) => `${p.name} ${Math.round(p.rating)}`).join(" & "));

  // ── 5. The draw ───────────────────────────────────────────────────────────
  console.log("\n5. THE DRAW, AT THE END OF ROUND 70'S DAY");
  const next = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  // The camp's fatigue is measured on the draw's own day: her fatigue set to 50 that morning, the day's rest
  // takes 5 off (utils/condition.ts REST_RECOVERY), the camp adds its 10 at the draw: 55.
  await playTo(`${CUP}-11-23`);
  // 1.1.3 (25 Oct): a player picked a fortnight ahead may have left her club or been hurt by the eve of the draw (an AI
  // club's weakest goes when its listed senior comes back fit); the page drops her, and he picks again from who is there.
  const eve = (await W.api("GET", "/national-team")).data;
  if (!picked.every((p) => (eve?.players ?? []).some((x) => x.kind === p.kind && x.id === p.id && !x.injured))) {
    const fitEve = (eve?.players ?? []).filter((x) => !x.injured);
    W.info(`on the eve of the draw ${picked.filter((p) => !fitEve.some((x) => x.kind === p.kind && x.id === p.id)).map((p) => p.name).join(" & ")} no longer there: he picks again`);
    picked = [fitEve[1], fitEve[2]];
    await W.api("POST", "/national-team/pair", { pair: picked.map((p) => ({ kind: p.kind, id: p.id })) });
  }
  const careerInPair = picked.filter((p) => p.kind === "player");
  for (const p of careerInPair) W.w(`UPDATE career_player_state SET fatigue = 50 WHERE career_save_id = ? AND player_id = ?`, cid, p.id);
  await playTo(`${CUP}-11-24`);
  const pairsAtDraw = (await W.api("GET", "/olympics/pairs")).data;
  const t = W.q(`SELECT * FROM olympic_tournaments WHERE career_save_id = ? AND season_year = ?`, cid, CUP)[0];
  check(`drawn at the end of round 70's day: group day ${CUP}-11-24`, t?.played_on === `${CUP}-11-24` && today() === `${CUP}-11-24`, `today ${today()}, group day ${t?.played_on}`);
  const field = JSON.parse(t.field);
  const minePair = field.find((e) => e.nation === mine);
  check(`${mine} plays the pair he picked`, !!minePair && JSON.stringify(minePair.pair.map((p) => `${p.kind}:${p.id}`)) === JSON.stringify(picked.map((p) => `${p.kind}:${p.id}`)),
    minePair?.pair.map((p) => p.name).join(" & "));
  check(`the training camp: the pair plays ${NATIONAL_CAMP.trainingBonus} better`, !!minePair && Math.abs(minePair.rating - ((minePair.pair[0].rating + minePair.pair[1].rating) / 2 + NATIONAL_CAMP.trainingBonus)) < 1e-9,
    `${minePair?.rating.toFixed(2)} against ${((minePair?.pair[0].rating + minePair?.pair[1].rating) / 2).toFixed(2)}`);
  const fatigueNow = careerInPair.map((p) => W.q(`SELECT fatigue FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, p.id)[0]?.fatigue ?? 0);
  check(`and comes out of it more tired: fatigue 50, less the day's rest, plus the camp's ${NATIONAL_CAMP.trainingFatigue}`,
    // (an AI club's player has no rest on the player's clock, item 4c: 60 for her)
    fatigueNow.every((f) => f >= 50 - 5 + NATIONAL_CAMP.trainingFatigue - 0.5 && f <= 50 + NATIONAL_CAMP.trainingFatigue + 0.5), `${careerInPair.length} career player(s) in the pair: ${fatigueNow.join(", ")}`);
  const atDraw = new Map((pairsAtDraw?.nations ?? []).map((n) => [n.nation, n.pair.map((p) => `${p.kind}:${p.id}`).join(",")]));
  const wrong = field.filter((e) => e.nation !== mine && e.pair.map((p) => `${p.kind}:${p.id}`).join(",") !== atDraw.get(e.nation));
  check("every other nation (unpicked) plays its best two fit players", wrong.length === 0 && field.length === 12, wrong.map((e) => e.nation).join(", ") || "11 of 11");
  check("the pairs are set: the National Team page is locked", (await W.api("GET", "/national-team")).data?.locked === true);

  // ── 6. Group day on the court, and the day's end ──────────────────────────
  console.log("\n6. GROUP DAY: WATCHED ON THE COURT; THE REST DECIDED AT THE DAY'S END");
  const todays = (await W.api("GET", "/national-coach")).data?.todayCup ?? [];
  check("today's 12 Cup matches are on the Dashboard's data, each watchable, his nation's marked", todays.length === 12 && todays.every((f) => f.watchable && f.status === "scheduled") && todays.some((f) => f.yourNation));
  const minesFx = todays.find((f) => f.yourNation), other = todays.find((f) => !f.yourNation);
  const st = (await W.api("GET", `/unity/match-state?careerSaveId=${cid}&nationsMatchId=${minesFx.id}`)).data;
  const swapped = st.sidesSwapped === true;
  check("his nation's match on the court: live, his nation as the court's home pair, Manual allowed",
    st.watchable && st.fixtureStatus === "live" && st.manualAllowed === true && st.homeTeam === mine && st.players.length === 4, `home ${st.homeTeam}, swapped ${swapped}`);
  check("each pair in its nation's colours, the Nations Cup boards", st.kitSource === "national" && st.courtsideBoards === "nations_cup" && st.boardText === `EMPIRE NATIONS CUP ${CUP}`
    && st.players.slice(0, 2).every((p) => p.primaryColor === NATIONAL_KITS[mine][0]), `${st.players[0].primaryColor} for ${mine}; boards '${st.boardText}'`);
  const stOther = (await W.api("GET", `/unity/match-state?careerSaveId=${cid}&nationsMatchId=${other.id}`)).data;
  check("another nation's match: Auto only", stOther.manualAllowed === false && stOther.homeTeam === other.home.nation);
  const prog = await W.api("POST", "/unity/match-progress", { careerSaveId: cid, nationsMatchId: minesFx.id, sets: [{ home: 11, away: 8 }], current: { home: 4, away: 2 } });
  const res = await W.api("POST", "/unity/match-result", { careerSaveId: cid, nationsMatchId: minesFx.id, sets: [{ home: 11, away: 8 }, { home: 11, away: 9 }] });
  const fxMine = W.q(`SELECT f.decided_by, m.home_sets, m.away_sets, m.sets, m.winner_nation FROM nations_cup_fixtures f JOIN olympic_matches m ON m.id = f.match_id WHERE f.id = ?`, minesFx.id)[0];
  check("the court's result decides it: his nation (the court's home pair) won 2-0", prog.status === 200 && res.status === 200 && fxMine?.decided_by === "court" && fxMine.winner_nation === mine
    && (swapped ? fxMine.away_sets === 2 && fxMine.home_sets === 0 : fxMine.home_sets === 2), `${fxMine?.home_sets}-${fxMine?.away_sets} ${fxMine?.sets}, winner ${fxMine?.winner_nation}`);
  const again = await W.api("POST", "/unity/match-result", { careerSaveId: cid, nationsMatchId: minesFx.id, sets: [{ home: 11, away: 8 }, { home: 11, away: 9 }] });
  check("sent twice, the second changes nothing", again.status === 200 && again.data?.alreadyRecorded === true);
  // Another match opened on the court and left part-way: the day's end finishes it from its last score.
  await W.api("POST", "/unity/match-progress", { careerSaveId: cid, nationsMatchId: other.id, sets: [{ home: 11, away: 3 }], current: { home: 6, away: 1 } });
  const notWatched = todays.filter((f) => f.id !== minesFx.id && f.id !== other.id).map((f) => f.id);
  check("before the day's end the others are still to play", notWatched.every((id) => W.q(`SELECT status FROM nations_cup_fixtures WHERE id = ?`, id)[0].status === "scheduled"));
  await W.day();
  const after = W.q(`SELECT id, status, decided_by FROM nations_cup_fixtures WHERE career_save_id = ? AND scheduled_on = ?`, cid, `${CUP}-11-24`);
  const leftFx = W.q(`SELECT m.sets FROM nations_cup_fixtures f JOIN olympic_matches m ON m.id = f.match_id WHERE f.id = ?`, other.id)[0];
  check("at the day's end every match not watched is decided by the engine", notWatched.every((id) => after.find((f) => f.id === id)?.decided_by === "engine"), `${notWatched.length} not watched`);
  check("the one left part-way is finished from its last score (its first set as the court left it)", JSON.parse(leftFx?.sets ?? "[]")[0]?.home === 11 && JSON.parse(leftFx.sets)[0].away === 3, leftFx?.sets);
  const qf = W.q(`SELECT scheduled_on, status FROM nations_cup_fixtures WHERE career_save_id = ? AND stage = 'quarter_final'`, cid);
  check("the quarter-finals are made for the next day, from the group tables", qf.length === 4 && qf.every((f) => f.scheduled_on === `${CUP}-11-25` && f.status === "scheduled"), qf.map((f) => f.scheduled_on).join(", "));

  console.log("\n6b. THE REST OF THE CUP");
  await playTo(`${CUP}-11-30`);
  const fx = W.q(`SELECT * FROM nations_cup_fixtures WHERE career_save_id = ? AND season_year = ? ORDER BY id`, cid, CUP);
  const on = (stage) => [...new Set(fx.filter((f) => f.stage === stage).map((f) => f.scheduled_on))];
  check("group day, quarter-finals, semi-finals, medal day: one day each, after round 70",
    JSON.stringify([on("group"), on("quarter_final"), on("semi_final"), [...new Set([...on("bronze"), ...on("gold")])]]) === JSON.stringify([[`${CUP}-11-24`], [`${CUP}-11-25`], [`${CUP}-11-26`], [`${CUP}-11-27`]]),
    JSON.stringify({ g: on("group"), qf: on("quarter_final"), sf: on("semi_final"), medal: on("gold") }));
  check("12 group fixtures, 4 quarter-finals, 2 semi-finals, bronze and gold, every one decided with its result row",
    fx.filter((f) => f.stage === "group").length === 12 && fx.filter((f) => f.stage === "quarter_final").length === 4 && fx.filter((f) => f.stage === "semi_final").length === 2
      && fx.filter((f) => f.stage === "bronze").length === 1 && fx.filter((f) => f.stage === "gold").length === 1 && fx.every((f) => f.status === "decided" && f.match_id != null));
  const decidedDays = W.q(`SELECT f.scheduled_on d, m.played_on p FROM nations_cup_fixtures f JOIN olympic_matches m ON m.id = f.match_id WHERE f.career_save_id = ? AND f.season_year = ?`, cid, CUP);
  check("each result is dated its own day", decidedDays.length === 20 && decidedDays.every((r) => r.d === r.p));

  // ── 7. Medals ─────────────────────────────────────────────────────────────
  console.log("\n7. MEDALS, THE CEREMONY, CLUB NEWS");
  const medals = W.q(`SELECT medal, nation FROM olympic_medals WHERE career_save_id = ? AND season_year = ?`, cid, CUP);
  check("six medallists: two gold, two silver, two bronze", medals.length === 6 && ["gold", "silver", "bronze"].every((m) => medals.filter((x) => x.medal === m).length === 2));
  const cer = W.q(`SELECT * FROM career_ceremonies WHERE career_save_id = ? AND event = 'nations_cup' AND season_year = ?`, cid, CUP);
  check("the podium ceremony is queued for the Dashboard", cer.length === 1 && cer[0].ready_on === `${CUP}-11-27`, cer[0]?.ready_on);
  const news = (await W.api("GET", "/news")).data?.items ?? [];
  check("Club News reports the Cup", news.some((i) => i.id === `olympic-${CUP}`));
  const sched = (await W.api("GET", "/olympics/schedule")).data;
  check("the schedule page reads it day by day (4 days, 20 matches)", sched?.cup?.schedule?.length === 4 && sched.cup.schedule.flatMap((d) => d.fixtures).length === 20 && sched.cup.finished);

  // ── 8. Second window ──────────────────────────────────────────────────────
  console.log("\n8. OFFERS AS SOON AS HIS CONTRACT ENDS; A BETTER RECORD, STRONGER NATIONS");
  const weakPays = first.map((o) => o.monthly);
  W.w(`UPDATE teams SET manager_rep_points = 1600 WHERE id = ?`, teamId);
  W.w(`UPDATE national_coach_jobs SET ends_on = ? WHERE id = ?`, next(today(), 1), paid.id);
  await W.day();
  const ended = W.q(`SELECT status FROM national_coach_jobs WHERE id = ?`, paid.id)[0];
  const second = offers();
  check("the day his contract ends it ends, and offers come at once", ended.status === "ended" && second.length >= 1 && second.every((o) => o.reason === "contract_end"),
    second.map((o) => `${o.nation} #${o.strength_rank}/${o.ranked} $${o.monthly}`).join(", "));
  check("a Legend's offers are stronger nations than a Local Coach's, and pay less",
    Math.max(...second.map((o) => o.strength_rank / o.ranked)) < Math.min(...first.map((o) => o.strength_rank / o.ranked)) && Math.max(...second.map((o) => o.monthly)) < Math.min(...weakPays),
    `level 5: $${second.map((o) => o.monthly).join("/")}; level 1: $${weakPays.join("/")}`);
  const five = await W.api("POST", `/national-coach/offers/${second[0].id}/accept`, { years: 5 });
  const j5 = job();
  check("a 5-year contract", five.status === 200 && j5?.years === 5 && j5.ends_on.slice(0, 4) === String(Number(j5.started_on.slice(0, 4)) + 5));
  // Decline them all (two offers planted while he has no job).
  W.w(`UPDATE national_coach_jobs SET status = 'ended' WHERE id = ?`, j5.id);
  for (const n of ["Kenya", "Peru"]) W.w(`INSERT INTO national_coach_offers (career_save_id, nation, monthly, strength_rank, ranked, offered_on, reason, cup_year, status) VALUES (?, ?, 9000, 40, 50, ?, 'contract_end', ?, 'open')`, cid, n, today(), CUP + 4);
  const dec = await W.api("POST", "/national-coach/offers/decline");
  check("declining them all", dec.data?.declined === 2 && offers().length === 0 && job() == null);
  void profileId;
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
  W.finish();
}
