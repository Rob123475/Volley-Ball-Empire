/**
 * 1.1.1, Part 6 (Rob, 16 Oct: "Is the calendar up to date with all our
 * changes?"): every dated rule on the annual calendar (GET /calendar/annual;
 * api-server utils/calendarDatedRules.ts).
 *
 *   1. the Day 1 draft (1 January), the AI clubs' staff day (8 January) and
 *      its reminder from 1 January
 *   2. the pre-season choice day (expected from his last match) and a camp's dates
 *   3. the transfer window opening and closing
 *   4. a player bought ahead arriving, one sold ahead leaving, a bid's 14-day deadline
 *   5. his players' and staff's contract end dates
 *   6. the legend: every type the calendar sends has a colour and a label
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";

const W = createWorld("calendar-rules", 4988);
const { check } = W;
console.log("=".repeat(72));
console.log("  1.1.1 PART 6: THE CALENDAR'S DATED RULES");
console.log("=".repeat(72));

const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Calendar Rules");
  await W.day();
  const today = (await W.api("GET", "/calendar")).data.currentDate;
  const year = Number(today.slice(0, 4));
  const annual = async () => (await W.api("GET", `/calendar/annual?year=${year}`)).data.events;
  const on = (events, date, re, type) => events.find((e) => e.date === date && re.test(e.title) && (!type || e.type === type));

  // ── 1. January ────────────────────────────────────────────────────────────
  console.log("\n1. THE DAY 1 DRAFT, THE AI CLUBS' STAFF DAY AND ITS REMINDER");
  let ev = await annual();
  check("the Day 1 draft on 1 January of his first season", !!on(ev, `${year}-01-01`, /Day 1 draft/, "facility"));
  check("the reminder on 1 January: the AI clubs hire on 8 January", !!on(ev, `${year}-01-01`, /AI clubs hire on 8 January/, "facility"));
  check("the AI clubs' staff day on 8 January", !!on(ev, `${year}-01-08`, /AI clubs hire staff/, "facility"));
  const next = (await W.api("GET", `/calendar/annual?year=${year + 1}`)).data.events;
  check("next season: the staff day again, and no draft (it is the career's first day only)",
    !!on(next, `${year + 1}-01-08`, /AI clubs hire staff/) && !next.some((e) => /Day 1 draft/.test(e.title)));
  check("next season's 1 January: the season boundary (ages, the board's review, the academy)", !!on(next, `${year + 1}-01-01`, /New season/, "facility")
    && !ev.some((e) => /New season/.test(e.title)));

  // ── 2. Pre-season ─────────────────────────────────────────────────────────
  console.log("\n2. THE PRE-SEASON CHOICE AND A CAMP");
  const season = W.q(`SELECT start_date s, end_date e, total_rounds n FROM seasons WHERE career_save_id = ? AND year = ?`, cid, year)[0];
  const last = W.q(`SELECT MAX(round) r FROM matches WHERE season = ? AND (home_team_id = ? OR away_team_id = ?)`, year, teamId, teamId)[0].r;
  const choice = ev.find((e) => /Pre-season choice/.test(e.title));
  // roundToDate, as the server spaces the slots: start + (slot-1)/(n-1) of the season.
  const span = (Date.parse(`${season.e}T00:00:00Z`) - Date.parse(`${season.s}T00:00:00Z`)) / 86_400_000;
  const lastOn = addDays(season.s, Math.round(((last - 1) / (season.n - 1)) * span));
  check("the pre-season choice: day 7 of his off-season, expected from his last match", !!choice && Math.abs((Date.parse(choice.date) - Date.parse(addDays(lastOn, 6))) / 86_400_000) <= 1,
    choice ? `${choice.date} (last match ${lastOn}, round ${last})` : "none");
  W.w(`INSERT INTO preseason_choices (career_save_id, season_year, team_id, choice, location, length, starts_on, ends_on, cost, done) VALUES (?, ?, ?, 'camp', 'altitude', '2w', ?, ?, 20000, 0)`,
    cid, year, teamId, `${year}-12-10`, `${year}-12-24`);
  ev = await annual();
  check("a camp's first and last days", !!on(ev, `${year}-12-10`, /Altitude Camp starts/, "facility") && !!on(ev, `${year}-12-24`, /Altitude Camp ends/, "facility"));

  // ── 3. The window ─────────────────────────────────────────────────────────
  console.log("\n3. THE TRANSFER WINDOW");
  check("the window opens on 7 December and closes on 31 December", !!on(ev, `${year}-12-07`, /Transfer window opens/, "transfer") && !!on(ev, `${year}-12-31`, /Transfer window closes/, "transfer"));

  // ── 4. Deals ──────────────────────────────────────────────────────────────
  console.log("\n4. ARRIVALS, DEPARTURES, BIDS TO ANSWER");
  const pool = W.q(`SELECT pool_team_id id FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL LIMIT 1`, cid)[0].id;
  const aiSenior = W.q(`SELECT s.player_id id, p.name FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.pool_team_id = ? AND p.player_type = 'senior' LIMIT 1`, cid, pool)[0];
  const mine = W.q(`SELECT s.player_id id, p.name FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior' ORDER BY s.player_id`, cid, teamId);
  const deal = (player, from, to, status, answerBy, arrivesOn) => W.w(`INSERT INTO transfer_deals (career_save_id, player_id, from_team_id, from_pool_team_id, to_team_id, to_pool_team_id, fee, wage, length, perks, status, offered_on, answer_by, arrives_on, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 20000, 15000, '1s', '', ?, ?, ?, ?, ?)`, cid, player, from.t ?? null, from.p ?? null, to.t ?? null, to.p ?? null, status, today, answerBy, arrivesOn, Date.now());
  deal(aiSenior.id, { p: pool }, { t: teamId }, "agreed", today, `${year}-12-07`);
  deal(mine[0].id, { t: teamId }, { p: pool }, "agreed", today, `${year}-12-07`);
  deal(mine[1].id, { t: teamId }, { p: pool }, "offered", addDays(today, 14), `${year}-12-07`);
  // A youth on loan to him (the calendar reads the loan's dates).
  const youth = W.q(`SELECT s.player_id id, p.name FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0 LIMIT 1`, cid)[0];
  W.w(`INSERT INTO youth_loans (career_save_id, player_id, status, listed_on, owner_pool_team_id, borrower_team_id, starts_on, ends_on, months, weekly_wage, created_at)
    VALUES (?, ?, 'active', ?, ?, ?, ?, ?, 6, 100, ?)`, cid, youth.id, today, pool, teamId, today, `${year}-07-02`, Date.now());
  ev = await annual();
  check("a youth loan to him ending: she goes back to her club", !!on(ev, `${year}-07-02`, new RegExp(`${youth.name}'s loan ends`), "transfer"), youth.name);
  check(`a player bought ahead: "${aiSenior.name} arrives" on 7 December`, !!on(ev, `${year}-12-07`, new RegExp(`${aiSenior.name} arrives`), "transfer"));
  check(`a player sold ahead: "${mine[0].name} leaves" on 7 December`, !!on(ev, `${year}-12-07`, new RegExp(`${mine[0].name} leaves`), "transfer"));
  check("a bid for his player: its answer deadline, 14 days on", !!on(ev, addDays(today, 14), new RegExp(`Answer the bid for ${mine[1].name}`), "transfer"));

  // ── 5. Contracts ──────────────────────────────────────────────────────────
  console.log("\n5. HIS PLAYERS' AND STAFF'S CONTRACT ENDS");
  const contract = W.q(`SELECT c.end_date e, p.name FROM contracts c JOIN players p ON p.id = c.player_id WHERE c.team_id = ? AND c.status = 'active' AND c.end_date LIKE ? LIMIT 1`, teamId, `${year}-%`)[0];
  if (contract) check("a player's contract end (already there)", !!on(ev, contract.e, new RegExp(`Contract Expires: ${contract.name}`), "contract"));
  else {
    // None of his ends this year: the next year's calendar shows the first that does.
    const later = W.q(`SELECT c.end_date e, p.name FROM contracts c JOIN players p ON p.id = c.player_id WHERE c.team_id = ? AND c.status = 'active' ORDER BY c.end_date LIMIT 1`, teamId)[0];
    const evLater = (await W.api("GET", `/calendar/annual?year=${later.e.slice(0, 4)}`)).data.events;
    check("a player's contract end (already there)", !!on(evLater, later.e, new RegExp(`Contract Expires: ${later.name}`), "contract"), later.e);
  }
  const coach = await W.hire("Head Coach", 75, cid);
  const end = W.q(`SELECT contract_end_date e FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, cid, coach.id)[0].e;
  ev = await annual();
  check(`a staff contract end: ${coach.name} (6 months)`, !!on(ev, end, new RegExp(`Staff contract expires: ${coach.name}`), "contract"), end);

  // ── 6. The legend ─────────────────────────────────────────────────────────
  console.log("\n6. THE LEGEND");
  const page = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "annual-calendar.tsx"), "utf8");
  const legend = new Set([...page.matchAll(/\{ type: "([a-z_]+)"\s+as AnnualEventType, label: "[^"]+",\s+dot: "bg-[a-z]+-\d+"/g)].map((m) => m[1]));
  const sent = new Set([...ev, ...next].map((e) => e.type));
  check("every type the calendar sends has a colour and a legend label (Transfers: indigo)", [...sent].every((t) => legend.has(t)) && /transfer:\s+"bg-indigo-500"/.test(page),
    `sent ${[...sent].join(", ")}`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
