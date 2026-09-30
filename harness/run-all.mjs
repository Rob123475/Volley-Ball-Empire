/**
 * Every harness, in one command, wired into `pnpm build`.
 *
 * The migration and fresh-install fixtures are load-bearing forever now that the
 * starter database ships clean: the repair path they cover only ever runs for
 * players upgrading from an older build — a small population, impossible to
 * debug remotely, and the one that will hit it years from now. Code like that
 * bit-rots unless something runs it on every build.
 *
 * Each suite boots the real server binary itself, so there is nothing to start
 * by hand and nothing to remember.
 *
 * Usage: node harness/run-all.mjs
 * Exits non-zero if any suite fails.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);

if (!fs.existsSync(SERVER)) {
  console.error(`[harness] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

const results = [];

function runSuite(name, file) {
  const started = Date.now();
  const r = spawnSync(process.execPath, [file], { stdio: "inherit", cwd: REPO });
  results.push({ name, ok: r.status === 0, secs: ((Date.now() - started) / 1000).toFixed(1) });
  return r.status === 0;
}

// The guards run FIRST. If a guard has gone inert, every check after it is
// reporting on a net with a hole in it, and the run should say so before
// anything else claims to have passed.
console.log("\n########## 1/84  GUARD SELF-TEST ##########");
runSuite("guard self-test", path.join(REPO, "harness", "guard-selftest.mjs"));

// Schema drift runs before the data migrations, for the same reason
// ensureSchema runs before them at boot: every migration below assumes its
// columns exist. A save that has fallen behind the code fails here first, with
// the column named, rather than three suites later as a confusing data error.
console.log("\n########## 2/84  SCHEMA DRIFT (R-01) ##########");
runSuite("schema drift", path.join(REPO, "harness", "schema-drift.mjs"));

// Same reasoning, one layer down: ensureReferenceData() runs right after
// ensureSchema() at boot, so its own drift check belongs right after schema
// drift's here too — a save missing reference ROWS (not columns) fails here
// first, with the row named, rather than as a confusing FK error later.
console.log("\n########## 3/84  REFERENCE DATA BACKFILL (R-28) ##########");
runSuite("reference data backfill", path.join(REPO, "harness", "reference-data-backfill.mjs"));

// Same boot-time pass, the other half of it: R-28 inserts missing rows, R-33
// updates stale ones. Sits right next to R-28's suite for the same reason.
console.log("\n########## 4/84  REFERENCE DATA UPDATE (R-33) ##########");
runSuite("reference data update", path.join(REPO, "harness", "reference-data-update.mjs"));

// Same boot-time pass again: R-28/R-33 only touch rows a save already has —
// this is what happens when the starter DB has a player row the save has
// never seen at all.
console.log("\n########## 5/84  REFERENCE DATA NEW PLAYERS (R-34) ##########");
runSuite("reference data new players", path.join(REPO, "harness", "reference-data-new-players.mjs"));

// One layer up from all of the above: this is the only suite that boots
// electron/main.js itself rather than just the server, because the R-23
// save-folder rename migration is main.js's own logic, running before
// ensureSchema/ensureReferenceData ever see the moved DB.
console.log("\n########## 6/84  SAVE FOLDER MOVES WITH THE RENAME (R-23) ##########");
runSuite("save folder migration", path.join(REPO, "harness", "save-folder-migration.mjs"));

// The other end of the same process lifecycle R-23 touches at boot: this one
// is shutdown. A real fork(), not spawn() — the IPC channel the shutdown
// message travels over only exists on a forked child.
console.log("\n########## 7/84  CHECKPOINT AND CLOSE ON QUIT (R-31) ##########");
runSuite("wal checkpoint on shutdown", path.join(REPO, "harness", "wal-checkpoint-shutdown.mjs"));

console.log("\n########## 8/84  UNITY PAYLOAD SKIN TONE / KIT COLOUR (R-22) ##########");
runSuite("unity match-state payload", path.join(REPO, "harness", "unity-match-state-payload.mjs"));

// The same endpoint, one layer up: R-22 made the payload carry the right values,
// R-38 made it possible to ASK for them at all. /unity/match-state read the
// career from the session, which neither a WebGL iframe nor Editor Play mode has,
// so the loader it exists to feed could never call it.
console.log("\n########## 9/84  UNITY MATCH-STATE CAREER SCOPING (R-38) ##########");
runSuite("unity career scoping", path.join(REPO, "harness", "unity-career-scoping.mjs"));


console.log("\n########## 10/84  MIGRATION FIXTURES ##########");
runSuite("migration fixtures", path.join(REPO, "harness", "migration-fixtures.mjs"));

console.log("\n########## 11/84  FRESH INSTALL CHAIN ##########");
runSuite("fresh install", path.join(REPO, "harness", "fresh-install.mjs"));

console.log("\n########## 12/84  FIXTURE GENERATION IS ONE TRANSACTION (R-05) ##########");
runSuite("fixture transaction", path.join(REPO, "harness", "fixture-transaction.mjs"));

// Own throwaway DB + server: creates one career of each difficulty in the
// same session and diffs their starting budget, ranking points and squad —
// there is no "correct number" to check against (the design doc gives none),
// only that the two starts are actually different.
console.log("\n########## 13/84  CAREER DIFFICULTY (R-11) ##########");
runSuite("career difficulty", path.join(REPO, "harness", "career-difficulty.mjs"));

// Own throwaway DB + server. R-53 replaced R-09's per-result ladder: the
// review rules over the design's own career tables, the target at the draw,
// the monthly freeze, abandonment and a sacking at the season review, plus
// proof the old +3/-5 path is gone.
console.log("\n########## 14/84  BOARD SEASON REVIEW (R-53) ##########");
runSuite("board review", path.join(REPO, "harness", "board-review.mjs"));

// R-29: two careers, a dozen real World Tour rounds each, every AI result and
// ranking point reconciled against its fixtures, plus sabotaged copies the
// checks must fail on. Own DB and server.
console.log("\n########## 15/84  WORLD TOUR COMPETITORS (R-29) ##########");
runSuite("world tour competitors", path.join(REPO, "harness", "world-tour-competitors.mjs"));

// R-44: a full regular season. Every club 54 matches and 3 byes, one bye in every
// 19 rounds, byes stored and worth nothing, the player's bye visible, Advance
// straight through it. Own DB and server.
console.log("\n########## 16/84  WORLD TOUR BYES (R-44) ##########");
runSuite("world tour byes", path.join(REPO, "harness", "world-tour-byes.mjs"));

// R-45: a fresh career's season has no All-Star fixture and is exactly 59
// matches; nothing built or shipped mentions an All-Star. Own DB and server.
console.log("\n########## 17/84  ALL-STAR REMOVED (R-45) ##########");
runSuite("all-star removed", path.join(REPO, "harness", "all-star-removed.mjs"));

// R-46: Olympic qualification is national, on this season's World Tour points:
// real play credits the players, two seasons of high-rated vs low-rated
// countries, ratings changing nothing, the rules page wording. Own DB and server.
console.log("\n########## 18/84  OLYMPIC QUALIFICATION (R-46) ##########");
runSuite("olympic qualification", path.join(REPO, "harness", "olympic-qualification.mjs"));

// R-48 (1): starting-squad contracts are dated from the career's own first
// season, never a literal year. Own DB and server.
console.log("\n########## 19/84  STARTING CONTRACTS (R-48) ##########");
runSuite("starting contracts", path.join(REPO, "harness", "starting-contracts.mjs"));

// R-51: contracts can be renewed, and expiry is warned about and dated on the
// game clock. Own DB and server.
console.log("\n########## 20/84  CONTRACT RENEWAL (R-51) ##########");
runSuite("contract renewal", path.join(REPO, "harness", "contract-renewal.mjs"));

// R-48: a club without two contracted players forfeits its matches instead of
// playing as a phantom side. Own DB and server.
console.log("\n########## 21/84  EMPTY SQUAD FORFEIT (R-48) ##########");
runSuite("empty squad forfeit", path.join(REPO, "harness", "squad-forfeit.mjs"));

// R-50: injuries and fitness decide who plays and how well — selection never
// picks an injured player, fitness scales the side's rating, rest days recover,
// injuries heal weekly, plus a 5,000-match sample per fitness level. Own DB and
// server.
console.log("\n########## 22/84  INJURIES AND FITNESS (R-50) ##########");
runSuite("injuries and fitness", path.join(REPO, "harness", "condition.mjs"));

// R-42: trophies are written at the season boundary — a fresh career has none,
// and real season-1 careers get exactly the rows their finals and tier earned,
// including a champion season. Own DB and server.
console.log("\n########## 23/84  SEASON TROPHIES (R-42) ##########");
runSuite("season trophies", path.join(REPO, "harness", "trophies.mjs"));

// R-43: invented content is deleted — nothing of it in the source, the bundle or
// the starter database; an older save loses its tables at boot and its profile
// still deletes; the removed endpoints 404; every news item names a real row;
// the Olympic schedule is a projected draw. Own DB and server.
console.log("\n########## 24/84  INVENTED CONTENT REMOVED (R-43) ##########");
runSuite("invented content removed", path.join(REPO, "harness", "fake-content-removed.mjs"));

// R-58: the dashboard's tier badge and the board's standing line — read from the
// API, the board's current finish is the standings rank graded by its own bands,
// the words follow the band, the badge is the season's ranking row. Own DB and
// server.
console.log("\n########## 25/84  DASHBOARD TIER AND BOARD STANDING (R-58) ##########");
runSuite("dashboard standing", path.join(REPO, "harness", "dashboard-standing.mjs"));

// R-60: Resign and Break Contract end the career through the same path as a
// sacking, the save keeps its club, and a save an older build left without one
// is finished at boot. Own DB and server.
console.log("\n########## 26/84  RESIGN AND BREAK CONTRACT END THE CAREER (R-60) ##########");
runSuite("career ends", path.join(REPO, "harness", "career-ends.mjs"));

// R-61: a real Olympic tournament. A career played to 2028: none in 2026 or
// 2027; 12 nations in qualifying order with their real national pairs; 12 group
// and 8 knockout matches with real scores; the bracket follows the tables; one
// gold, silver and bronze with honours and trophies; played before the World
// Finals; Club News reports it. Own DB and server.
console.log("\n########## 27/84  OLYMPIC TOURNAMENT (R-61) ##########");
runSuite("olympic tournament", path.join(REPO, "harness", "olympics-tournament.mjs"));

// R-62: an academy intake at every season boundary: one intake of three per
// season opened, the template card on disk, ages 16-18, ratings in the
// shipped youth's range, nations of the club's region, names new and real;
// Club News; never seeded into another career; a dry academy creates no one
// and says so. Own DB and server.
console.log("\n########## 28/84  ACADEMY INTAKE (R-62) ##########");
runSuite("academy intake", path.join(REPO, "harness", "youth-intake.mjs"));

// R-63: the academy holds 6 (overnight 30 Sep item 14: was 12) — signing and the intake both stop there, and the
// Team page reads the same cap; academy wages are billed once, in the weekly
// wage run, never after a match. Two careers, a season each. Own DB and server.
console.log("\n########## 29/84  ACADEMY CAP AND WAGES (R-63) ##########");
runSuite("academy cap and wages", path.join(REPO, "harness", "academy-cap-wages.mjs"));

// R-67: a career created with the wizard's own payload starts on the design's
// budget; staff salaries are monthly (the seeded 118 were annual); a hire costs
// one month and the weekly run bills salary / (52/12); an older save's annual
// staff wages are repaired on boot. Own DB and server.
console.log("\n########## 30/84  WIZARD CAREER ECONOMY AND STAFF WAGES (R-67) ##########");
runSuite("wizard career economy", path.join(REPO, "harness", "wizard-career-economy.mjs"));

// R-68: the calendar clock ticks visibly while it runs — the date replays on
// every day, a bar fills across the ticker interval, a dot pulses. Static.
console.log("\n########## 31/84  CALENDAR CLOCK TICKS VISIBLY (R-68) ##########");
runSuite("calendar tick", path.join(REPO, "harness", "calendar-tick.mjs"));

// R-79: the soundtrack. Sits beside calendar-tick because it is the other
// frontend-only suite — no server, no database. Its load-bearing check is that
// src/data/music-tracks.ts and public/audio/music/ still agree in both
// directions: nothing in TypeScript ties a hand-written file name to a file on
// disk, so a renamed mp3 would compile and go silent.
console.log("\n########## 32/84  SOUNDTRACK PLAYLIST AND PLAYER (R-79) ##########");
runSuite("music playlist", path.join(REPO, "harness", "music-playlist.mjs"));

// L-02a: the three contract lengths, everyone covered, staff contracts that
// actually end, and the payout when a club tears one up. Own DB and server.
console.log("\n########## 33/84  CONTRACT TERMS (L-02a) ##########");
runSuite("contract terms", path.join(REPO, "harness", "contract-terms.mjs"));

// L-02b: retirement at forty closes the contract, empties the squad slot and
// takes a player nobody honoured out of the career altogether, leaving her name
// and portrait for the next generation. Own DB and server.
console.log("\n########## 34/84  RETIREMENT AT FORTY (L-02b) ##########");
runSuite("retirement", path.join(REPO, "harness", "retirement.mjs"));

// L-02c: the academy refills itself. Thirty seasons in three regions, run
// together, asserting the youth count does not move once the academy is full,
// that it is never empty, and that nobody is without a portrait. Own DBs and
// servers (three of them, ports 4531-4533).
console.log("\n########## 35/84  YOUTH REBIRTH, 30 SEASONS x 3 REGIONS (L-02c) ##########");
runSuite("youth rebirth", path.join(REPO, "harness", "youth-rebirth.mjs"));

// L-02d: a club keeps four of its own graduates. The Team page refuses the
// fifth, the season boundary releases whatever forced promotion pushed over,
// and a graduate who has never played can still be sold. Own DB and server.
console.log("\n########## 36/84  GRADUATE CAP AND TRADING (L-02d) ##########");
runSuite("graduates", path.join(REPO, "harness", "graduates.mjs"));

// HOF: the club's Hall of Fame — the window every two seasons, the cap of six,
// honours before numbers in the recommendation, and an inducted player kept
// whole when she retires. Own DB and server.
console.log("\n########## 37/84  CLUB HALL OF FAME (HOF) ##########");
runSuite("hall of fame", path.join(REPO, "harness", "hall-of-fame.mjs"));

// ACH: the server announces every unlock on the fork channel, and answers
// main.js's boot question with everything the save has ever unlocked. The
// Electron side of the Steam wiring, without Steam. Own DB and server.
console.log("\n########## 38/84  ACHIEVEMENTS OVER THE FORK CHANNEL (ACH) ##########");
runSuite("achievement ipc", path.join(REPO, "harness", "achievement-ipc.mjs"));

// L-04: money means something. Two clubs walked twelve seasons each with every
// pound in and out read from the ledger: a club at the bottom of the field
// goes backwards every season and is broke inside five, and a club at the top
// of the Gold tour goes forwards modestly. Own DBs and servers.
console.log("\n########## 39/84  MONEY MEANS SOMETHING (L-04) ##########");
runSuite("economy", path.join(REPO, "harness", "economy.mjs"));

// L-02e: five loss-making seasons and the club is sold — the board never sacks
// for results. The manager is shown real clubs with vacancies, keeps the career
// on taking one, and retires by declining them all. Own DB and server.
console.log("\n########## 40/84  CLUB SOLD; THE JOB MARKET (L-02e) ##########");
runSuite("job market", path.join(REPO, "harness", "job-market.mjs"));

// R-70: the top bar shows the round of the competition being played —
// Continental R7/10, World Tour R31/57, Finals, Off-season — and match screens
// name a match's round the same way; the season is 69 rounds, not the
// schedule's 78 slots. Own DB and server.
console.log("\n########## 41/84  SEASON PHASE IN THE TOP BAR (R-70) ##########");
runSuite("season phase", path.join(REPO, "harness", "season-phase.mjs"));

// R-73: the wizard's colours reach the court and every AI club has its own
// kit — a career played to the World Tour draw, every match's home pair in the
// wizard's hexes, every away pair its fixture's pool club in that club's kit,
// a null kit warned about, an older save given the kits on boot. Own DB and server.
console.log("\n########## 42/84  CLUB KITS REACH THE 3D COURT (R-73) ##########");
runSuite("club kits", path.join(REPO, "harness", "club-kits.mjs"));

// R-75: pool players' skin tones are drawn from their nation's own tone counts
// among the seeded players — every pool player banded, the stored tones equal a
// re-run of the draw, the court's away pair carries them, an older save gets
// them on boot. Own DB and server.
console.log("\n########## 43/84  POOL PAIRS' SKIN TONES (R-75) ##########");
runSuite("pool skin tones", path.join(REPO, "harness", "pool-skin-tones.mjs"));

// R-77: a match watched in 3D completes on its own through the same code as
// "Sim Result" and counts — wins, career stats, purse, First Steps — and a match
// watched then simulated counts once; the achievements list is the honest one.
// Own DB and server.
console.log("\n########## 44/84  WATCHED MATCHES COUNT; HONEST ACHIEVEMENTS (R-77) ##########");
runSuite("watched match", path.join(REPO, "harness", "watched-match.mjs"));

// P-09: hired staff give their bonuses. Title-Case roles in the data, snake_case
// keys in the code, and nothing ever matched - proven here by what a session,
// a week's sponsor income and a signing bonus actually pay.
console.log("\n########## 45/84  HIRED STAFF GIVE THEIR BONUSES (P-09) ##########");
runSuite("staff bonuses", path.join(REPO, "harness", "staff-bonuses.mjs"));

// P-11: a staff card renamed in the starter DB is renamed in existing saves
// too - but only where the save still holds a name the starter DB once
// shipped. A name the player typed is theirs.
console.log("\n########## 46/84  STAFF RENAMES REACH EXISTING SAVES (P-11) ##########");
runSuite("staff name sync", path.join(REPO, "harness", "staff-name-sync.mjs"));

// P-05: a new career's starting squad can be changed for free in week 1, and
// only then - both ways of dropping a player, measured in the balance.
console.log("\n########## 47/84  STARTING SQUAD: FREE CHANGES IN WEEK 1 ONLY (P-05) ##########");
runSuite("starting squad release", path.join(REPO, "harness", "starting-squad-release.mjs"));

// D-1: a building under construction is never offered as "Upgrade Ready", and
// a finished build is collected by the clock, not by opening the Facilities
// page. Own DB and server.
console.log("\n########## 48/84  NO UPGRADE CARD WHILE BUILDING (D-1) ##########");
runSuite("facility upgrades", path.join(REPO, "harness", "facility-upgrades.mjs"));

// D-2: every club x both difficulties starts on exactly the money the picker
// shows, read from the one table both use. Own DB and server.
console.log("\n########## 49/84  THE CLUB PICKER SHOWS THE REAL STARTING MONEY (D-2) ##########");
runSuite("club picker budget", path.join(REPO, "harness", "club-picker-budget.mjs"));

// D-3: a facility has one name wherever a player reads it - cards, events,
// calendar, ledger (old saves too), and no old spelling left in the client.
console.log("\n########## 50/84  ONE BUILDING, ONE NAME (D-3) ##########");
runSuite("facility names", path.join(REPO, "harness", "facility-names.mjs"));

// D-4: every facility text at every level, no zero bonus, nothing else moved;
// and what Nutrition levels 1-3 really take off a Power Camp. Own DB and server.
console.log("\n########## 51/84  NO ZERO BONUS IN A FACILITY'S TEXT (D-4) ##########");
runSuite("facility benefits", path.join(REPO, "harness", "facility-benefits.mjs"));

// D-5: the MATCH DAY box names the club as the dashboard does, and no
// placeholder stands in for a club name anywhere. Own DB and server.
console.log("\n########## 52/84  THE MATCH DAY BOX NAMES THE CLUB (D-5) ##########");
runSuite("match day box", path.join(REPO, "harness", "match-day-box.mjs"));

// D-6: no euro or pound sign anywhere a player can read, the box's prize
// and a real salary week in dollars. Own DB and server.
console.log("\n########## 53/84  EVERY AMOUNT IN DOLLARS (D-6) ##########");
runSuite("currency", path.join(REPO, "harness", "currency.mjs"));

// F-1: Next match runs the clock's own day to the next match day; the save it
// leaves is identical, table by table, to pressing Advance day by day.
console.log("\n########## 54/84  NEXT MATCH: THE CLOCK, FASTER (F-1) ##########");
runSuite("next match", path.join(REPO, "harness", "next-match.mjs"));

// Unity brief item 1: the chance sent to the 3D court is the chance Sim Result plays,
// and Unity's own PointModel.cs plays the same matches as the game's engine.
console.log("\n########## 55/84  ONE SET OF ODDS, ONE FORMAT (UNITY 1) ##########");
runSuite("one set of odds", path.join(REPO, "harness", "one-set-of-odds.mjs"));

// Unity brief item 3: Unity's own BoostClock.cs, 3 points on and 5 off; what the boosts
// are worth in an even match and a 10-rating mismatch, measured.
console.log("\n########## 56/84  BOOSTS IN POINTS, WORTH SOMETHING (UNITY 3) ##########");
runSuite("boosts", path.join(REPO, "harness", "boosts.mjs"));

// Unity brief item 4: the court's result recorded exactly through completeMatch; illegal refused;
// twice changes nothing; left at 7-4 finished from 7-4; a closed window finished on boot.
console.log("\n########## 57/84  THE 3D COURT'S RESULT COUNTS (UNITY 4) ##########");
runSuite("watched result", path.join(REPO, "harness", "watched-result.mjs"));

// Unity brief item 5: the court page's Leave match and its return to the dashboard, and
// the Unity finish (banner, crowd, header, labels) they rely on.
console.log("\n########## 58/84  A PROPER FINISH, AND A WAY OUT (UNITY 5) ##########");
runSuite("court finish", path.join(REPO, "harness", "court-finish.mjs"));

// Unity brief item 6: the court's own page (no Unity sample template), its names, and the
// unity-loaded message the game's loading strip waits for.
console.log("\n########## 59/84  THE 3D COURT'S PAGE LOOKS LIKE OUR GAME (UNITY 6) ##########");
runSuite("court page", path.join(REPO, "harness", "court-page.mjs"));

// Unity brief item 11: fast before a match, paused after it - Sim Result, Skip and watched.
console.log("\n########## 60/84  AFTER A MATCH, THE CLOCK STAYS PAUSED (UNITY 11) ##########");
runSuite("pause after match", path.join(REPO, "harness", "pause-after-match.mjs"));

// Unity brief item 12: record, points, rank and recent results after Sim, Skip and watched matches.
console.log("\n########## 61/84  THE DASHBOARD MATCHES THE STANDINGS AFTER EVERY MATCH (UNITY 12) ##########");
runSuite("dashboard fresh", path.join(REPO, "harness", "dashboard-fresh.mjs"));

// Unity brief item 13: every finances figure against a direct ledger/contract sum, on a copy of Rob's save.
console.log("\n########## 62/84  THE FINANCES PAGE READS THE LEDGER AND THE CONTRACTS (UNITY 13) ##########");
runSuite("finances ledger", path.join(REPO, "harness", "finances-ledger.mjs"));

// Unity brief item 14: one injury test, the attention card, the match-day substitution, the forfeit.
console.log("\n########## 63/84  AN INJURED MATCH PLAYER - THE GAME SAYS SO (UNITY 14) ##########");
runSuite("injured match player", path.join(REPO, "harness", "injured-match-player.mjs"));

// Unity brief item 15: price ranges, 5-day scouting, blind signing, confirm step, season-end lapse.
console.log("\n########## 64/84  PLAYER MARKET - PRICES, SCOUTING AND BUYING BLIND (UNITY 15) ##########");
runSuite("player market", path.join(REPO, "harness", "player-market.mjs"));

// Unity brief item 16: 8 staff in all with at most 4 medical, one constant for every page.
console.log("\n########## 65/84  ONE STAFF SLOT COUNT, AND SCOUTING ONLY ON SCOUTS (UNITY 16) ##########");
runSuite("staff slots", path.join(REPO, "harness", "staff-slots.mjs"));

// Unity brief item 17: scouting kept across a relaunch, on the ledger, a Scouted label, lapses at season end.
console.log("\n########## 66/84  STAFF AND MEDICAL SCOUTING IS KEPT AND SHOWN (UNITY 17) ##########");
runSuite("staff scouting", path.join(REPO, "harness", "staff-scouting.mjs"));

// Unity brief item 18: one fitness figure, game-dated training, youth list from the API, youth name sync, missions on game time.
console.log("\n########## 67/84  TRAINING AND YOUTH ACADEMY (UNITY 18) ##########");
runSuite("training and youth", path.join(REPO, "harness", "training-youth.mjs"));

// Unity brief item 19: sessions run their game days, gains once on the finish date, cancel gives nothing.
console.log("\n########## 68/84  TRAINING TAKES GAME DAYS (UNITY 19) ##########");
runSuite("training days", path.join(REPO, "harness", "training-days.mjs"));

// Unity brief item 20: medical market on its own page, one fatigue figure, treatment bar from real injury weeks, rounds by phase.
console.log("\n########## 69/84  CLUB PAGES (UNITY 20) ##########");
runSuite("club pages", path.join(REPO, "harness", "club-pages.mjs"));

// Unity brief item 21: the cabinet is Steam's 29, every rule at its threshold, the real streak, prize money only, Future Superstar.
console.log("\n########## 70/84  ACHIEVEMENTS - ONE LIST OF 29, HONEST RULES AND RECORDS (UNITY 21) ##########");
runSuite("achievements 29", path.join(REPO, "harness", "achievements-29.mjs"));

// Overnight 30 Sep item 1: the manager's own records, on a copy of Rob's 30 Sep save.
console.log("\n########## 71/84  CAREER > RECORDS IS THE MANAGER'S RECORD (OVERNIGHT 1) ##########");
runSuite("manager records", path.join(REPO, "harness", "manager-records.mjs"));

// Overnight brief 30 Sep, item 2: Career Earnings are the manager's salary pro rata on game days;
// the profile's stars, the dashboard and the Trophy Cabinet read one table of levels.
console.log("\n########## 72/84  MANAGER EARNINGS AND ONE STANDING (OVERNIGHT 2) ##########");
runSuite("manager profile", path.join(REPO, "harness", "manager-profile.mjs"));

// Overnight brief 30 Sep, item 3: dates written from the PC's clock in older saves become game dates at boot;
// proven on a copy of Rob's 30 Sep backup (skipped when it is absent).
console.log("\n########## 73/84  OLD RECORDS MOVE FROM THE PC'S DATE TO THE GAME'S (OVERNIGHT 3) ##########");
runSuite("real world dates", path.join(REPO, "harness", "real-world-dates.mjs"));

// Overnight brief 30 Sep, items 21-22: the 48 commentary lines and clips the game ships, the Unity table and scene,
// and every string the game writes: none says he/his/him.
console.log("\n########## 74/84  TWO COMMENTATORS, AND THEY SAY SHE (OVERNIGHT 21-22) ##########");
runSuite("commentary she", path.join(REPO, "harness", "commentary-she.mjs"));

// Overnight brief 30 Sep, item 6: every clock move refreshes every query on screen.
console.log("\n########## 75/84  THE PAGES READ THEMSELVES AGAIN WHEN THE DAY CHANGES (OVERNIGHT 6) ##########");
runSuite("clock refresh", path.join(REPO, "harness", "clock-refresh.mjs"));

// Overnight brief 30 Sep, item 9: staff attributes show as words, one label table for every page.
console.log("\n########## 76/84  STAFF ATTRIBUTES READ AS WORDS (OVERNIGHT 9) ##########");
runSuite("staff labels", path.join(REPO, "harness", "staff-labels.mjs"));

// Overnight brief 30 Sep, item 10: the staff and medical markets list their cards in the order of the role buttons.
console.log("\n########## 77/84  MARKET CARDS LIST IN THE FILTER BUTTONS' ORDER (OVERNIGHT 10) ##########");
runSuite("market order", path.join(REPO, "harness", "market-order.mjs"));

// Overnight brief 30 Sep, item 11: every nationality is stored and shown as the country, existing saves converted at boot.
console.log("\n########## 78/84  NATIONALITY IS THE COUNTRY, EVERYWHERE (OVERNIGHT 11) ##########");
runSuite("nationality countries", path.join(REPO, "harness", "nationality-countries.mjs"));

// Overnight brief 30 Sep, item 12: unscouted youth show a range and ?, prices by talent, scouting reveals potential, and potential drives growth.
console.log("\n########## 79/84  YOUTH MARKET ON SENIOR RULES, POTENTIAL DRIVES GROWTH (OVERNIGHT 12) ##########");
runSuite("youth market", path.join(REPO, "harness", "youth-market.mjs"));

// Overnight brief 30 Sep, item 13: missions find youth only, 0-4 by the Scout and the department, the report explains a blank, Sign (confirm) or Reject each.
console.log("\n########## 80/84  SCOUTING MISSIONS FIND YOUTH, SIGN OR REJECT (OVERNIGHT 13) ##########");
runSuite("scouting missions", path.join(REPO, "harness", "scouting-missions.mjs"));

// Overnight brief 30 Sep, item 32: a player bought from another club pays that club her fee.
console.log("\n########## 81/84  THE TRANSFER FEE GOES TO THE SELLING CLUB (OVERNIGHT 32) ##########");
runSuite("transfer fee", path.join(REPO, "harness", "transfer-fee.mjs"));

// Rob, 23 Sep: every AI club keeps books on the same rules the player's club
// does, and five loss-making seasons sells one of them too. Thirty seasons of
// the whole world, with the table of every club's balance per season. Own DB
// and server, and the longest suite here after the rollover.
console.log("\n########## 82/84  EVERY CLUB KEEPS BOOKS (AI CLUB ECONOMY) ##########");
runSuite("ai club economy", path.join(REPO, "harness", "ai-club-economy.mjs"));

// ── Smoke needs a server; boot one on a throwaway copy of the shipped DB ─────
console.log("\n########## 83/84  GAMEPLAY SMOKE ##########");
{
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-smoke-"));
  const db = path.join(work, "smoke.sqlite");
  fs.copyFileSync(SHIPPED, db);
  const port = 4455;
  const logFile = path.join(work, "server.log");
  const out = fs.openSync(logFile, "w");
  const child = forkServer({
    server: SERVER,
    electron: ELECTRON,
    out,
    env: {
      ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: db, PORT: String(port),
      NODE_ENV: "development", SESSION_SECRET: "harness-smoke-secret",
    },
  });

  const started = Date.now();
  let up = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { await fetch(`http://localhost:${port}/api/health`); up = true; break; }
    catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  if (!up) {
    console.error("[harness] smoke server never came up");
    console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
    results.push({ name: "gameplay smoke", ok: false, secs: "-" });
  } else {
    const r = spawnSync(
      process.execPath,
      [path.join(REPO, "harness", "smoke.mjs"), `http://localhost:${port}`, db],
      { stdio: "inherit", cwd: REPO },
    );
    results.push({
      name: "gameplay smoke", ok: r.status === 0,
      secs: ((Date.now() - started) / 1000).toFixed(1),
    });

    // Rollover reuses the same server: it walks a fresh career through five
    // season boundaries and on, plays five-season strong/weak arcs, and (L-01)
    // one established career to season 30 — slow, but the only way to prove a
    // career keeps rolling rather than compiling.
    console.log("\n########## 84/84  SEASON ROLLOVER ##########");
    const rollStart = Date.now();
    const rr = spawnSync(
      process.execPath,
      [path.join(REPO, "harness", "rollover.mjs"), `http://localhost:${port}`, db],
      { stdio: "inherit", cwd: REPO },
    );
    results.push({
      name: "season rollover", ok: rr.status === 0,
      secs: ((Date.now() - rollStart) / 1000).toFixed(1),
    });
  }

  // R-36: quit through R-31's shutdown path rather than SIGKILL, so the
  // database is left checkpointed with no -wal sidecar. The settle sleep
  // that used to follow the kill was only covering for that.
  await stopServer(child);
  try { fs.closeSync(out); } catch {}
  try { fs.rmSync(work, { recursive: true, force: true }); } catch {}
}

// ── Summary ─────────────────────────────────────────────────────────────────
const bar = "=".repeat(72);
console.log("\n" + bar);
for (const r of results) {
  console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.name.padEnd(24)} ${r.secs}s`);
}
const failed = results.filter((r) => !r.ok);
console.log(bar);
if (failed.length > 0) {
  console.log(`  HARNESS FAILED: ${failed.map((f) => f.name).join(", ")}`);
  console.log(bar);
  process.exit(1);
}
console.log("  ALL HARNESSES PASSED");
console.log(bar);
