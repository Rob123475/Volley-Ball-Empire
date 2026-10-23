/**
 * 1.1.3 (Rob, 23 Oct; brief A5): medal ceremonies, the World Finals bronze, the ladder cups.
 *
 *   1. the bronze rule (utils/worldFinalsBronze.ts, as the server runs it): points,
 *      then wins, then set difference, then rally-point difference; dead level
 *      after all four, "level" (a third-place match)
 *   2. (source) only the bronze pair's club gets the bronze trophy; the ladder
 *      leaves the third-place match out; the ceremony dialog, the ladder cups, the
 *      Rules; Unity's podium (when the Unity project is on this machine)
 *   3. a real season to the World Final: the bronze is the losing semi-finalist
 *      higher on the ladder (worked out here from the save), no third-place
 *      match; the podium (/unity/ceremony-state): banner, places, the six in
 *      their clubs' kits with their nations' flags; the Dashboard's ceremony is
 *      pending, and seen once skipped
 *   4. the next season, the two losing semi-finalists made dead level on the
 *      ladder in this suite's own database: a third-place match is played on
 *      the final's day and its winner takes bronze
 *   5. the Nations Cup year: its podium in national colours, "EMPIRE NATIONS CUP 2028"
 *
 * CEREMONY_KEEP_DB=<path> keeps the save at the end (scripts/webgl-proof/ceremony-shots.mjs).
 * Usage: node harness/ceremonies.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createWorld, REPO } from "./night2-world.mjs";
import { keepSideFielded, renewExpiringContracts, healSquadByTeam, turnDownBids } from "./harness-club.mjs";

const W = createWorld("ceremonies", 4993);
const { check, info } = W;
const SRC = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const { bronzeOnLadder } = await import(pathToFileURL(path.join(REPO, "artifacts/api-server/src/utils/worldFinalsBronze.ts")).href);
const { NATIONAL_KITS } = await import(pathToFileURL(path.join(REPO, "lib/db/src/schema/national-kits.ts")).href);
const FLAGS = path.join(REPO, "artifacts/beach-volleyball/public/images/flags");
console.log("=".repeat(72));
console.log("  1.1.3 (A5): MEDAL CEREMONIES, THE WORLD FINALS BRONZE, THE LADDER CUPS");
console.log("=".repeat(72));

try {
  // ── 1. The rule ────────────────────────────────────────────────────────────
  console.log("\n1. THE BRONZE RULE");
  const line = (competitorId, points, wins, setDiff, pointDiff) => ({ competitorId, points, wins, setDiff, pointDiff });
  check("more ranking points takes bronze", bronzeOnLadder(line(1, 40, 20, 5, 30), line(2, 38, 25, 9, 90)).competitorId === 1);
  check("points level: more wins", bronzeOnLadder(line(1, 40, 20, 5, 30), line(2, 40, 21, -3, -10)).competitorId === 2);
  check("points and wins level: set difference", bronzeOnLadder(line(1, 40, 20, 6, 30), line(2, 40, 20, 5, 90)).competitorId === 1);
  check("and then the rally points won and lost", bronzeOnLadder(line(1, 40, 20, 5, 30), line(2, 40, 20, 5, 31)).competitorId === 2);
  check("still level after all four: a third-place match", bronzeOnLadder(line(1, 40, 20, 5, 30), line(2, 40, 20, 5, 30)) === "level");

  // ── 2. Source ─────────────────────────────────────────────────────────────
  console.log("\n2. (SOURCE)");
  const trophies = SRC("artifacts/api-server/src/utils/seasonTrophies.ts"), wt = SRC("artifacts/api-server/src/utils/worldTour.ts");
  check("a lost semi-final is bronze only for the bronze pair's club", /if \(finals === "semi-finalist" && bronze\)/.test(trophies) && /summary\.playerBronze === true/.test(trophies));
  check("dead level, the third-place match is played on the final's day; the ladder leaves it out",
    /if \(bronze\.by === "level"\) playThirdPlaceTx/.test(wt) && /ne\(worldTourFixturesTable\.tier, THIRD_PLACE_TIER\)/.test(wt));
  const shell = SRC("artifacts/beach-volleyball/src/components/layout/shell.tsx"), dialog = SRC("artifacts/beach-volleyball/src/components/ceremony-dialog.tsx");
  check("the ceremony interrupts like the Season Review, with the court in ceremony mode and Skip",
    /<CeremonyDialog \/>/.test(shell) && /unity-build\/index\.html\?careerSaveId=\$\{p\.careerSaveId\}&ceremony=\$\{p\.event\}&year=\$\{p\.seasonYear\}/.test(dialog) && /data-testid="ceremony-skip"/.test(dialog));
  check("the continental ladder and its history show gold, silver and bronze cups", /final && entry\.position <= 3 && <LadderCup/.test(SRC("artifacts/beach-volleyball/src/pages/competition/regional-ladders.tsx"))
    && /<LadderCup place=\{q\.qualifyingPosition\}/.test(SRC("artifacts/beach-volleyball/src/pages/competition/regional-history.tsx")));
  check("the Rules explain it", /Medals and the podium/.test(SRC("artifacts/beach-volleyball/src/pages/rules.tsx")));
  const unity = process.env.VBE_UNITY_PROJECT ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball";
  const director = path.join(unity, "Assets/Scripts/CeremonyDirector.cs");
  if (fs.existsSync(director)) {
    const cs = fs.readFileSync(director, "utf8");
    check("(Unity) the podium: steps 1-2-3, the six medallists, medals, the wave, flags by the name plates, the banner",
      /\{ 1, \(0f, 0\.9f\) \}, \{ 2, \(-2\.0f, 0\.6f\) \}, \{ 3, \(2\.0f, 0\.38f\) \}/.test(cs) && /while \(people\.Count < 6\)/.test(cs) && /class MedalHang/.test(cs)
        && /Ceremony\/CeremonyWave/.test(cs) && /Resources\.Load<Texture2D>\("Flags\/" \+ pl\.flag\)/.test(cs) && /BannerPainter\.Paint\(1536, 384, p\.banner/.test(cs));
  } else info(`the Unity project is not on this machine (${director})`);

  await W.boot();
  const { teamId, cid } = await W.newCareer("Podium");
  const today = () => W.q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, teamId)[0]?.d ?? "";
  let guard = 0;
  async function playTo(date, each) {
    while (today() < date && guard++ < 1400) {
      healSquadByTeam(W.db, teamId);
      turnDownBids(W.db, teamId);
      if (guard % 7 === 1) { await keepSideFielded(W.api); await renewExpiringContracts(W.api); }
      const r = await W.day();
      if (r.status >= 400) throw new Error(`advance ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") W.w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
      if (each) await each();
    }
  }
  const lineOf = (year, competitorId) => {
    const r = W.q(`SELECT ranking_points p, wins w FROM competitor_rankings WHERE career_save_id = ? AND season_year = ? AND competitor_id = ?`, cid, year, competitorId)[0] ?? { p: 0, w: 0 };
    let setDiff = 0, pointDiff = 0;
    for (const f of W.q(`SELECT home_competitor_id h, away_competitor_id a, home_sets hs, away_sets as2, sets FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = ? AND status = 'completed' AND tier <> 'World Finals Third Place' AND (home_competitor_id = ? OR away_competitor_id = ?)`, cid, year, competitorId, competitorId)) {
      const home = f.h === competitorId;
      setDiff += home ? (f.hs ?? 0) - (f.as2 ?? 0) : (f.as2 ?? 0) - (f.hs ?? 0);
      for (const s of JSON.parse(f.sets ?? "[]")) pointDiff += home ? s.home - s.away : s.away - s.home;
    }
    return line(competitorId, r.p, r.w, setDiff, pointDiff);
  };
  const losersOf = (year) => W.q(`SELECT home_competitor_id h, away_competitor_id a, home_sets hs, away_sets as2 FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = ? AND round = 71`, cid, year)
    .map((s) => (s.hs > s.as2 ? s.a : s.h));
  const nameOf = (competitorId) => W.q(`SELECT coalesce(t.name, p.team_name) n FROM competitors c LEFT JOIN teams t ON t.id = c.team_id LEFT JOIN continental_pool_teams p ON p.id = c.pool_team_id WHERE c.id = ?`, competitorId)[0]?.n;
  const podiumChecks = (state, label) => {
    check(`${label}: three places on steps 1, 2 and 3, two medallists each`, state?.places?.length === 3 && state.places.map((p) => p.place).join() === "1,2,3"
      && state.places.map((p) => p.medal).join() === "gold,silver,bronze" && state.places.every((p) => p.players.length === 2));
    const noFlag = state.places.flatMap((p) => p.players).filter((pl) => !pl.flag || !fs.existsSync(path.join(FLAGS, `${pl.flag}.svg`)));
    check(`${label}: each with her nation's flag`, noFlag.length === 0, noFlag.map((p) => `${p.name} (${p.nationality})`).join(", ") || state.places.flatMap((p) => p.players.map((x) => x.flag)).join(" "));
    check(`${label}: each with a kit and a skin tone`, state.places.flatMap((p) => p.players).every((pl) => /^#[0-9a-f]{6}$/i.test(pl.primaryColor ?? "") && /^#[0-9a-f]{6}$/i.test(pl.secondaryColor ?? "") && !!pl.skinTone));
  };

  // ── 3. A real season's World Finals ───────────────────────────────────────
  console.log("\n3. 2026: THE WORLD FINALS");
  await playTo("2026-12-03");
  const losers26 = losersOf(2026);
  const pick26 = bronzeOnLadder(lineOf(2026, losers26[0]), lineOf(2026, losers26[1]));
  const finals26 = (await W.api("GET", "/world-tour/finals")).data;
  check("the bronze is the losing semi-finalist higher on the ladder", pick26 !== "level" && finals26?.bronze?.by === "ladder" && finals26.bronze.name === nameOf(pick26.competitorId),
    `${nameOf(losers26[0])} ${JSON.stringify(lineOf(2026, losers26[0]))} v ${nameOf(losers26[1])} ${JSON.stringify(lineOf(2026, losers26[1]))}: ${finals26?.bronze?.name}`);
  check("no third-place match when they are not level", W.q(`SELECT COUNT(*) n FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = 2026 AND tier = 'World Finals Third Place'`, cid)[0].n === 0);
  const pending26 = (await W.api("GET", "/ceremonies/pending")).data?.pending;
  check("the World Finals ceremony is waiting for the Dashboard", pending26?.event === "world_finals" && pending26.seasonYear === 2026, JSON.stringify(pending26));
  const wf = (await W.api("GET", `/unity/ceremony-state?careerSaveId=${cid}&event=world_finals&year=2026`)).data;
  check("the banner reads BEACH VOLLEYBALL EMPIRE WORLD TOUR", wf?.banner === "BEACH VOLLEYBALL EMPIRE WORLD TOUR");
  check("gold the champion, silver the runner-up, bronze the bronze club", wf?.places?.[0]?.label === finals26?.champion?.name && wf.places[2].label === finals26.bronze.name,
    wf?.places?.map((p) => `${p.place} ${p.label}`).join(", "));
  podiumChecks(wf, "the World Finals podium");
  const clubKit = (label) => W.q(`SELECT primary_color p FROM continental_pool_teams WHERE team_name = ? UNION SELECT logo_color p FROM teams WHERE name = ?`, label, label)[0]?.p;
  check("World Tour players wear their clubs' kits", wf.places.every((p) => p.players.every((pl) => (pl.primaryColor ?? "").toLowerCase() === (clubKit(p.label) ?? "").toLowerCase())));
  const seen = await W.api("POST", "/ceremonies/world_finals/2026/seen");
  check("skipped (or watched), it doesn't open again", seen.data?.ok === true && (await W.api("GET", "/ceremonies/pending")).data?.pending == null);
  writeShotState("world_finals", 2026);

  // ── 4. Dead level ─────────────────────────────────────────────────────────
  console.log("\n4. 2027: THE TWO LOSING SEMI-FINALISTS DEAD LEVEL");
  await playTo("2027-11-28");
  const semis27 = W.q(`SELECT id, home_competitor_id h, away_competitor_id a, home_sets hs, away_sets as2 FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = 2027 AND round = 71 AND status = 'completed'`, cid);
  check("(set-up) both semi-finals decided", semis27.length === 2);
  const losers27 = semis27.map((s) => (s.hs > s.as2 ? s.a : s.h));
  // This suite's own database: both lose their semi 9-11, 9-11, play no other set this season, and finish level on points and wins.
  for (const s of semis27) {
    const homeWon = s.hs > s.as2;
    W.w(`UPDATE world_tour_fixtures SET home_sets = ?, away_sets = ?, sets = ? WHERE id = ?`, homeWon ? 2 : 0, homeWon ? 0 : 2,
      JSON.stringify(homeWon ? [{ home: 11, away: 9 }, { home: 11, away: 9 }] : [{ home: 9, away: 11 }, { home: 9, away: 11 }]), s.id);
  }
  for (const c of losers27) {
    W.w(`UPDATE world_tour_fixtures SET home_sets = 0, away_sets = 0, sets = '[]' WHERE career_save_id = ? AND season_year = 2027 AND round < 71 AND (home_competitor_id = ? OR away_competitor_id = ?)`, cid, c, c);
    W.w(`UPDATE competitor_rankings SET ranking_points = 30, wins = 25 WHERE career_save_id = ? AND season_year = 2027 AND competitor_id = ?`, cid, c);
  }
  check("(set-up) now dead level on all four", bronzeOnLadder(lineOf(2027, losers27[0]), lineOf(2027, losers27[1])) === "level", JSON.stringify(lineOf(2027, losers27[0])));
  await playTo("2027-12-03");
  const third = W.q(`SELECT * FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = 2027 AND tier = 'World Finals Third Place'`, cid);
  const finals27 = (await W.api("GET", "/world-tour/finals")).data;
  const thirdWinner = third[0] ? (third[0].home_sets > third[0].away_sets ? third[0].home_competitor_id : third[0].away_competitor_id) : null;
  check("a third-place match was played on the final's day, between the two", third.length === 1 && third[0].status === "completed" && [third[0].home_competitor_id, third[0].away_competitor_id].sort().join() === [...losers27].sort().join(),
    third[0] ? `${nameOf(third[0].home_competitor_id)} ${third[0].home_sets}-${third[0].away_sets} ${nameOf(third[0].away_competitor_id)}` : "none");
  check("and its winner takes bronze", finals27?.bronze?.by === "match" && finals27.bronze.name === nameOf(thirdWinner), JSON.stringify(finals27?.bronze));
  const wf27 = (await W.api("GET", `/unity/ceremony-state?careerSaveId=${cid}&event=world_finals&year=2027`)).data;
  check("the podium's bronze step is hers", wf27?.places?.[2]?.label === nameOf(thirdWinner));
  check("the third-place match is not on the ladder (no prize, no points)", W.q(`SELECT ranking_points p FROM competitor_rankings WHERE career_save_id = ? AND season_year = 2027 AND competitor_id = ?`, cid, thirdWinner)[0]?.p === 30);
  await W.api("POST", "/ceremonies/world_finals/2027/seen");

  // ── 5. The Nations Cup podium ─────────────────────────────────────────────
  console.log("\n5. 2028: THE EMPIRE NATIONS CUP PODIUM");
  await playTo("2028-11-28");
  const pending28 = (await W.api("GET", "/ceremonies/pending")).data?.pending;
  check("the Cup's ceremony is waiting once its medals are decided", pending28?.event === "nations_cup" && pending28.seasonYear === 2028, JSON.stringify(pending28));
  const nc = (await W.api("GET", `/unity/ceremony-state?careerSaveId=${cid}&event=nations_cup&year=2028`)).data;
  check("the banner reads EMPIRE NATIONS CUP 2028", nc?.banner === "EMPIRE NATIONS CUP 2028");
  podiumChecks(nc, "the Nations Cup podium");
  check("each nation's pair in its national colours", nc.places.every((p) => p.players.every((pl) => pl.primaryColor === NATIONAL_KITS[p.label]?.[0] && pl.secondaryColor === NATIONAL_KITS[p.label]?.[1])),
    nc.places.map((p) => `${p.label} ${p.players[0]?.primaryColor}`).join(", "));
  const medalNations = W.q(`SELECT medal, nation FROM olympic_medals WHERE career_save_id = ? AND season_year = 2028 GROUP BY medal`, cid);
  check("the places are the Cup's medals", ["gold", "silver", "bronze"].every((m, i) => nc.places[i].label === medalNations.find((x) => x.medal === m)?.nation));
  writeShotState("nations_cup", 2028);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
  if (process.env.CEREMONY_KEEP_DB) {
    fs.copyFileSync(W.db, process.env.CEREMONY_KEEP_DB);
    info(`save kept at ${process.env.CEREMONY_KEEP_DB}`);
  }
  W.finish();
}

/** For the render proof: which career and years hold the two podiums. */
function writeShotState(event, year) {
  if (!process.env.CEREMONY_KEEP_DB) return;
  const f = `${process.env.CEREMONY_KEEP_DB}.json`;
  const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  prev.careerSaveId = W.q(`SELECT id FROM career_saves ORDER BY id DESC LIMIT 1`)[0]?.id;
  prev[event] = year;
  fs.writeFileSync(f, JSON.stringify(prev, null, 2));
}
