/**
 * 1.1.1 (Rob, 18 Oct; Downloads/TIER-START-BRIEF-18OCT.md): the stronger AI clubs start a career's first season at
 * Silver. "The player's club can't be the only one."
 *
 *   1. a new Established career and a new Underdog career: once the World Tour field is known, it is ranked by squad
 *      strength (the board's measure) and stored once; the 10 strongest AI clubs are paid Silver, the rest Bronze, in
 *      both careers alike. The Other Clubs list and each club's page show it; no club starts Gold
 *   2. stored: the ranking does not move as the season is played
 *   3. one of the 10, paid for a Silver-event win, gets the full purse; a club left Bronze gets 10%
 *   4. season 2 on: last season's points decide (a stored-Silver club with few points is Bronze, one with Gold points
 *      is Gold), and nothing is ranked for season 2
 *   5. an existing season-1 save (made before this): the ranking is stored the first time the tier is read
 *   6. (source) one place decides: the Other Clubs page, AI prize money and AI weekly tour costs all read
 *      accessTierByPoolIdTx; the Rules page and the patch notes say so
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";

const W = createWorld("season-one-tiers", 4993);
const { check } = W;
const SRC = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const SILVER_CLUBS = 10;
console.log("=".repeat(72));
console.log("  1.1.1: THE STRONGER AI CLUBS START SEASON 1 AT SILVER");
console.log("=".repeat(72));

const stored = (cid, year = 2026) => W.q(`SELECT pool_team_id id, rating, strength_rank rank, tier, created_at FROM pool_club_start_tiers
  WHERE career_save_id = ? AND season_year = ? ORDER BY strength_rank`, cid, year);
const fieldOf = (cid) => W.q(`SELECT pool_team_id id FROM world_tour_qualifications WHERE career_save_id = ? AND season_year = 1`, cid).map((r) => r.id);
const silverIds = (rows) => rows.filter((r) => r.tier === "Silver").map((r) => r.id).sort((a, b) => a - b);

async function careerToTheDraw(label, difficulty) {
  const c = await W.newCareer(label, difficulty);
  const drawn = () => W.q(`SELECT COUNT(*) n FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = 2026`, c.cid)[0].n > 0;
  for (let i = 0; i < 120 && !drawn(); i++) await W.day();
  check(`${difficulty}: the World Tour is drawn`, drawn(), (await W.api("GET", "/calendar")).data?.currentDate ?? "");
  return c;
}

try {
  await W.boot();
  const careers = [];

  // ── 1. Two new careers ────────────────────────────────────────────────────
  for (const difficulty of ["established", "underdog"]) {
    console.log(`\n1. A NEW ${difficulty.toUpperCase()} CAREER`);
    const c = await careerToTheDraw(`Tiers ${difficulty}`, difficulty);
    const rows = stored(c.cid), field = fieldOf(c.cid);
    check("the field is ranked and stored, every AI club in it once", rows.length === field.length && field.length > SILVER_CLUBS
      && new Set(rows.map((r) => r.id)).size === rows.length && rows.every((r) => field.includes(r.id)), `${rows.length} stored, ${field.length} in the field`);
    check(`the ${SILVER_CLUBS} strongest are Silver and the rest Bronze, ranked 1 to n by squad strength`,
      rows.every((r, i) => r.rank === i + 1 && r.tier === (i < SILVER_CLUBS ? "Silver" : "Bronze") && (i === 0 || rows[i - 1].rating >= r.rating)),
      rows.map((r) => `${r.rank}:${r.tier[0]}:${r.rating.toFixed(1)}`).join(" "));
    check("no club starts Gold", rows.every((r) => r.tier !== "Gold"));
    const clubs = (await W.api("GET", "/clubs")).data?.clubs ?? [];
    const shownSilver = clubs.filter((x) => x.kind === "ai" && x.tier === "Silver").map((x) => x.id).sort((a, b) => a - b);
    check(`the Other Clubs page shows those ${SILVER_CLUBS} AI clubs Silver, and no other AI club above Bronze`,
      JSON.stringify(shownSilver) === JSON.stringify(silverIds(rows)) && clubs.filter((x) => x.kind === "ai").every((x) => x.tier !== "Gold"),
      `${shownSilver.length} shown Silver`);
    const mine = clubs.find((x) => x.kind === "mine");
    check(`his club shows ${difficulty === "established" ? "Silver" : "Bronze"} (his difficulty, unchanged)`, mine?.tier === (difficulty === "established" ? "Silver" : "Bronze"), mine?.tier);
    const pages = await Promise.all(silverIds(rows).map(async (id) => (await W.api("GET", `/clubs/${id}`)).data?.tier));
    check("each of the 10's own page shows Silver", pages.length === SILVER_CLUBS && pages.every((t) => t === "Silver"), pages.join(","));
    const board = W.q(`SELECT pair_rating p, strength_rank r FROM board_seasons WHERE career_save_id = ? AND season_year = 2026`, c.cid)[0];
    if (board?.p != null) W.info(`the board's measure: his pair ${board.p.toFixed(1)} ranks ${board.r}; the stored ratings put it ${1 + rows.filter((r) => r.rating > board.p).length}`);
    careers.push({ ...c, difficulty, rows });
  }
  check("the same rule in both careers: 10 AI clubs Silver whatever the difficulty",
    careers.every((c) => silverIds(c.rows).length === SILVER_CLUBS), careers.map((c) => `${c.difficulty} ${silverIds(c.rows).length}`).join(", "));

  // ── 2. Stored, so it does not move ────────────────────────────────────────
  console.log("\n2. TAKEN ONCE, AND IT DOES NOT MOVE AS THE SEASON IS PLAYED");
  const cur = careers[1];
  const before = JSON.stringify(stored(cur.cid));
  for (let i = 0; i < 21; i++) await W.day();
  const played = W.q(`SELECT COUNT(*) n FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = 2026 AND status = 'completed'`, cur.cid)[0].n;
  check("three weeks of the World Tour later the stored ranking is exactly as it was", played > 0 && JSON.stringify(stored(cur.cid)) === before, `${played} fixtures played`);
  const later = (await W.api("GET", "/clubs")).data?.clubs ?? [];
  check("and no club of the 10 reads Bronze", silverIds(cur.rows).every((id) => later.find((x) => x.id === id && x.kind === "ai")?.tier !== "Bronze"));

  // ── 3. The purse ──────────────────────────────────────────────────────────
  console.log("\n3. A SILVER-EVENT WIN: THE FULL PURSE FOR ONE OF THE 10, 10% FOR A BRONZE CLUB");
  const silverRound = W.q(`SELECT round FROM world_tour_fixtures WHERE career_save_id = ? AND season_year = 2026 AND tier = 'Silver' ORDER BY round LIMIT 1`, cur.cid)[0]?.round;
  const silverClub = cur.rows.find((r) => r.tier === "Silver"), bronzeClub = cur.rows.find((r) => r.tier === "Bronze");
  const pay = async (poolTeamId, seasonYear = 2026) => (await W.api("POST", "/dev/pool-clubs/credit", { poolTeamId, seasonYear, eventTier: "Silver", round: silverRound, won: true })).data;
  const s = await pay(silverClub.id), b = await pay(bronzeClub.id);
  check("one of the 10 is paid at Silver: the full purse", s?.access === "Silver" && s.prize > 0 && s.prize === s.fullPrize, JSON.stringify(s));
  check("a club left Bronze is paid 10% of it", b?.access === "Bronze" && b.prize > 0 && Math.abs(b.prize - b.fullPrize * 0.1) <= 1, JSON.stringify(b));

  // ── 4. Season 2 on ────────────────────────────────────────────────────────
  console.log("\n4. SEASON 2 ON: LAST SEASON'S POINTS DECIDE");
  const pointsOf = (id) => W.q(`SELECT cr.ranking_points p FROM competitor_rankings cr JOIN competitors c ON c.id = cr.competitor_id
    WHERE cr.career_save_id = ? AND cr.season_year = 2026 AND c.pool_team_id = ?`, cur.cid, id)[0]?.p ?? 0;
  const lowSilver = cur.rows.filter((r) => r.tier === "Silver").find((r) => pointsOf(r.id) < 55);
  const s2 = lowSilver ? await pay(lowSilver.id, 2027) : null;
  check("a club ranked Silver in season 1 with too few points is paid Bronze in season 2", !!s2 && s2.access === "Bronze" && Math.abs(s2.prize - s2.fullPrize * 0.1) <= 1,
    lowSilver ? `${pointsOf(lowSilver.id)} points: ${JSON.stringify(s2)}` : "no stored-Silver club under 55 points");
  const goldCandidate = cur.rows.find((r) => r.tier === "Bronze" && r.id !== bronzeClub.id) ?? bronzeClub;
  W.w(`UPDATE competitor_rankings SET ranking_points = 63 WHERE career_save_id = ? AND season_year = 2026
    AND competitor_id IN (SELECT id FROM competitors WHERE pool_team_id = ?)`, cur.cid, goldCandidate.id);
  const g2 = await pay(goldCandidate.id, 2027);
  check("a club left Bronze in season 1 that finishes on Gold points is paid Gold in season 2", g2?.access === "Gold" && g2.prize === g2.fullPrize, JSON.stringify(g2));
  check("nothing is ranked for season 2", stored(cur.cid, 2027).length === 0);

  // ── 5. A season-1 save from before this ───────────────────────────────────
  console.log("\n5. A SEASON-1 SAVE MADE BEFORE THIS: STORED THE FIRST TIME THE TIER IS READ");
  const old = careers[0];
  W.w(`DELETE FROM pool_club_start_tiers WHERE career_save_id = ?`, old.cid);
  await W.stop(); await W.boot(); await W.select(old.profileId); await W.api("POST", `/careers/${old.cid}/load`);
  const reread = (await W.api("GET", "/clubs")).data?.clubs ?? [];
  const again = stored(old.cid);
  check("loaded and read: the ranking is stored again, 10 Silver", again.length === fieldOf(old.cid).length && silverIds(again).length === SILVER_CLUBS, `${again.length} stored`);
  check("and the Other Clubs page shows them Silver", silverIds(again).every((id) => reread.find((x) => x.id === id && x.kind === "ai")?.tier === "Silver"));

  // ── 6. One place ──────────────────────────────────────────────────────────
  console.log("\n6. (SOURCE) ONE PLACE DECIDES, AND THE WORDS");
  const fin = SRC("artifacts/api-server/src/utils/poolClubFinances.ts"), clubsRoute = SRC("artifacts/api-server/src/routes/clubs.ts");
  const access = fin.slice(fin.indexOf("export function accessTierByPoolIdTx"), fin.indexOf("export function poolManagerSalary"));
  check("(source) accessTierByPoolIdTx falls back to the stored first-season tier, only for a club with no row for last season",
    /for \(const \[poolTeamId, tier\] of seasonOneTiersTx\(tx, careerSaveId, seasonYear\)\) \{\s*if \(!map\.has\(poolTeamId\)\) map\.set\(poolTeamId, tier\);/.test(access));
  check("(source) only in season 1, ranked by aiClubRatingsTx (the board's poolClubRatingsTx), the top SEASON_ONE_SILVER_CLUBS = 10 Silver",
    fin.includes("if (seasonNumberForYear(seasonYear) !== 1) return new Map();") && fin.includes("const ratings = aiClubRatingsTx(tx, careerSaveId);")
      && fin.includes("export const SEASON_ONE_SILVER_CLUBS = 10;") && /return aiClubRatingsTx\(tx, careerSaveId\);/.test(SRC("artifacts/api-server/src/utils/worldTour.ts")));
  check("(source) AI prize money and AI weekly tour costs read it",
    /const access = accessTierByPoolIdTx\(tx, args\.careerSaveId, args\.seasonYear\)\.get\(args\.poolTeamId\)/.test(fin)
      && /const access = accessTierByPoolIdTx\(tx, careerSaveId, seasonYear\);[\s\S]*tier:\s+inField\.has\(st\.poolTeamId\) \? \(access\.get\(st\.poolTeamId\) \?\? "Bronze"\)/.test(fin));
  check("(source) the Other Clubs list and each club's page read it", (clubsRoute.match(/accessTierByPoolIdTx\(tx, cid, year\)/g) ?? []).length === 2);
  check("(source) the draw ranks the field", SRC("artifacts/api-server/src/utils/worldTour.ts").includes("seasonOneTiersTx(tx, careerSaveId, seasonYear);"));
  check("(source) the Rules page's World Tour says so",
    SRC("artifacts/beach-volleyball/src/pages/rules.tsx").includes("In a career's first season the 10 strongest AI clubs in the field are paid Silver, as an Established club is"));
  check("(source) and the patch notes", SRC("docs/UPDATE1-1.1.1-PATCH-NOTES.md").includes("In a career's first season the 10 strongest AI clubs in the World Tour field are paid Silver"));
  check("(source) a deleted career takes its stored ranking with it",
    SRC("artifacts/api-server/src/utils/deleteCareerSave.ts").includes("t.delete(poolClubStartTiersTable).where(eq(poolClubStartTiersTable.careerSaveId, careerSaveId)).run();"));
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
