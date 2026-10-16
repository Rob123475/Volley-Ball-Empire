/**
 * 1.1.1, Part 10 (Rob, S-1 A): the scouting limit (api-server
 * utils/scoutingWork.ts; SCOUT_REPORTS_AT_ONCE in lib/db schema/staff-roles.ts).
 *
 *   1. the limit is 2, in the constants
 *   2. one Scout: two reports at once (a player and a youth alike); a third is
 *      refused, naming him and the day his next report is ready
 *   3. staff and medical reports: a Scout, Head Coach or Assistant Coach, each
 *      two at a time; with all of them busy a third is refused naming them all
 *   4. a report done frees a place
 *   5. a Scout away on a continental youth mission does no reports, and can't
 *      be sent on a second mission until the first ends
 *   6. the Staff page shows each one's reports and mission
 *   7. a youth deal's negotiation is one of the negotiator's jobs: with
 *      everyone busy he can't ask to buy (a loan still goes); AI clubs too
 *   8. Rob's evening with 1.1.0: youth cards get the Watch star and the senior
 *      card's Scout button; watched youths (on the market or in an AI academy)
 *      are on the Watch List, which is a top-row pill with a Seniors / Youths
 *      filter and three buttons a card; the Staff Market's Medical pill
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";

const W = createWorld("scouting-limit", 4979);
const { check, info } = W;
console.log("=".repeat(72));
console.log("  1.1.1 PART 10: THE SCOUTING LIMIT");
console.log("=".repeat(72));

const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dateText = (d) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Scouting Limit");
  await W.day();
  W.w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, teamId);
  // His staff out of the way: the people who scout are hired below.
  W.w(`UPDATE career_staff_state SET team_id = NULL WHERE career_save_id = ? AND team_id = ?`, cid, teamId);
  const today = async () => (await W.api("GET", "/calendar")).data.currentDate;

  // ── 1. The constant ───────────────────────────────────────────────────────
  console.log("\n1. THE LIMIT, IN THE CONSTANTS");
  const roles = fs.readFileSync(path.join(REPO, "lib", "db", "src", "schema", "staff-roles.ts"), "utf8");
  check("SCOUT_REPORTS_AT_ONCE = 2 (lib/db schema/staff-roles.ts)", /export const SCOUT_REPORTS_AT_ONCE = 2;/.test(roles));

  // ── 2. One Scout ──────────────────────────────────────────────────────────
  console.log("\n2. ONE SCOUT: TWO REPORTS AT ONCE, A THIRD REFUSED");
  const scout = await W.hire("Scout", 80, cid);
  const market = (await W.api("GET", "/players/market-all")).data.filter((p) => p.status === "free_agent" || p.status === "player_pool");
  const youths = (await W.api("GET", "/players/youth-pool")).data;
  const d0 = await today();
  const a = await W.api("POST", `/players/${market[0].id}/scout`, {});
  const y = await W.api("POST", `/players/${youths[0].id}/scout`, {});
  check("he takes a player and a youth at once", a.status === 200 && y.status === 200 && a.data?.scoutName === scout.name && y.data?.scoutName === scout.name,
    `HTTP ${a.status}/${y.status} ${a.data?.error ?? ""} ${y.data?.error ?? ""}`);
  const third = await W.api("POST", `/players/${market[1].id}/scout`, {});
  check("a third is refused, in plain words naming him and the day his next report is ready",
    third.status === 409 && third.data?.scoutsBusy === true && third.data.error.includes(scout.name) && third.data.error.includes(dateText(addDays(d0, 5))),
    third.data?.error);

  // ── 3. Staff and medical ──────────────────────────────────────────────────
  console.log("\n3. STAFF AND MEDICAL REPORTS: SCOUT, HEAD COACH, ASSISTANT COACH");
  const staffMarket = W.q(`SELECT st.id, st.name, st.role FROM career_staff_state s JOIN staff st ON st.id = s.staff_id
    WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.role IN ('Fitness Trainer', 'Doctor', 'Physiotherapist', 'Nutritionist') ORDER BY st.id`, cid);
  const busyStaff = await W.api("POST", `/staff/${staffMarket[0].id}/scout`, {});
  check("with the Scout busy and no coach, a staff report is refused naming him", busyStaff.status === 409 && busyStaff.data?.error?.includes(scout.name), busyStaff.data?.error);
  const coach = await W.hire("Head Coach", 75, cid);
  const s1 = await W.api("POST", `/staff/${staffMarket[0].id}/scout`, {});
  const doctor = staffMarket.find((m) => m.role === "Doctor" || m.role === "Physiotherapist");
  const s2 = await W.api("POST", `/staff/${doctor.id}/scout`, {});
  const jobs = W.q(`SELECT staff_id s, kind FROM scouting_jobs WHERE career_save_id = ? AND team_id = ? ORDER BY id`, cid, teamId);
  check("the Head Coach takes a staff report and a medical one", s1.status === 200 && s2.status === 200
    && jobs.filter((j) => j.s === coach.id).map((j) => j.kind).join(",") === "staff,medical", `HTTP ${s1.status}/${s2.status}; ${JSON.stringify(jobs)}`);
  const s3 = await W.api("POST", `/staff/${staffMarket.find((m) => m.id !== staffMarket[0].id && m.id !== doctor.id).id}/scout`, {});
  check("a third is refused, naming both and the first day one is free", s3.status === 409 && s3.data?.error?.includes(scout.name) && s3.data.error.includes(coach.name)
    && s3.data.error.includes(dateText(addDays(d0, 5))), s3.data?.error);

  // ── 4. Done frees a place ─────────────────────────────────────────────────
  console.log("\n4. A REPORT DONE FREES A PLACE");
  while ((await today()) < addDays(d0, 5)) await W.day();
  const again = await W.api("POST", `/players/${market[1].id}/scout`, {});
  check("on the day his reports are in, he takes another", again.status === 200 && again.data?.scoutName === scout.name, `${await today()}: HTTP ${again.status} ${again.data?.error ?? ""}`);

  // ── 5. A mission ──────────────────────────────────────────────────────────
  console.log("\n5. A SCOUT AWAY ON A YOUTH MISSION DOES NO REPORTS");
  W.w(`DELETE FROM scouting_jobs WHERE career_save_id = ?`, cid);
  const sent = await W.api("POST", "/continental-scouting/start", { region: "Europe", durationMonths: 1, staffId: scout.id });
  check("he is sent on a mission (Europe, 1 month)", sent.status === 201, `HTTP ${sent.status} ${sent.data?.error ?? ""}`);
  const away = await W.api("POST", `/players/${market[2].id}/scout`, {});
  check("while away, a player report is refused: he is on a mission, until its end", away.status === 409 && /away on a scouting mission in Europe until/.test(away.data?.error ?? ""), away.data?.error);
  const second = await W.api("POST", "/continental-scouting/start", { region: "Asia", durationMonths: 1, staffId: scout.id });
  check("and he can't be sent on a second mission until it ends", second.status === 409 && /away on a scouting mission in Europe/.test(second.data?.error ?? ""), second.data?.error);
  const staffWhileAway = await W.api("POST", `/staff/${staffMarket[1].id}/scout`, {});
  check("a staff report goes to the Head Coach meanwhile", staffWhileAway.status === 200
    && W.q(`SELECT staff_id s FROM scouting_jobs WHERE career_save_id = ? ORDER BY id DESC LIMIT 1`, cid)[0]?.s === coach.id, `HTTP ${staffWhileAway.status} ${staffWhileAway.data?.error ?? ""}`);

  // ── 6. The Staff page ─────────────────────────────────────────────────────
  console.log("\n6. THE STAFF PAGE SHOWS EACH ONE'S WORK");
  const work = (await W.api("GET", "/staff/scouting-work")).data;
  const sw = work?.scouts?.find((s) => s.id === scout.id), cw = work?.scouts?.find((s) => s.id === coach.id);
  check("the Scout: away on his mission; the Head Coach: his report and its ready day", work?.perScout === 2 && sw?.mission?.region === "Europe" && sw.free === 0
    && cw?.reports?.length === 1 && cw.reports[0].readyOn === addDays(await today(), 5), JSON.stringify(work?.scouts?.map((s) => [s.name, s.reports.length, s.mission?.region ?? "-"])));
  const page = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "staff-hub.tsx"), "utf8");
  check("(source) the Staff page shows it (My Staff and Scouting tabs)", /<ScoutingWork \/><StaffManagement \/>/.test(page) && /<ScoutingWork \/><ContinentalScouting \/>/.test(page));

  // ── 7. Youth deals ────────────────────────────────────────────────────────
  console.log("\n7. A YOUTH DEAL'S NEGOTIATION IS ONE OF THE JOBS");
  // An AI academy youth to ask for (the academies fill in the first salary week).
  for (let i = 0; i < 8 && W.q(`SELECT COUNT(*) n FROM career_player_state WHERE career_save_id = ? AND pool_team_id IS NOT NULL AND academy_role IS NOT NULL`, cid)[0].n === 0; i++) await W.day();
  const youth = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL
    AND s.team_id IS NULL AND p.player_type = 'youth' AND s.is_promoted = 0 AND s.player_id NOT IN (SELECT player_id FROM youth_loans WHERE status = 'active') LIMIT 1`, cid)[0].id;
  // The Head Coach's other place filled (the Scout is away): nobody can negotiate.
  await W.api("POST", `/staff/${staffMarket[2].id}/scout`, {});
  const ask = (await W.api("GET", `/youth-deals/${youth}`)).data;
  const buy = await W.api("POST", "/youth-deals", { playerId: youth, kind: "buy", confirm: true });
  check("with everyone busy, asking to buy is refused, naming who is busy", ask?.chance === 0 && buy.status === 400 && buy.data?.error?.includes(coach.name), buy.data?.error);
  const loan = await W.api("POST", "/youth-deals", { playerId: youth, kind: "loan", months: 6, confirm: true });
  check("a loan needs no negotiation: it still goes", loan.status === 201 && loan.data?.outcome === "loaned", `HTTP ${loan.status} ${loan.data?.error ?? ""}`);
  // AI clubs: one with a Scout (scouting 90), and its negotiations on his list.
  const clubs = W.q(`SELECT pool_team_id id FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL ORDER BY pool_team_id`, cid).map((r) => r.id);
  const buyer = clubs.find((c) => W.q(`SELECT COUNT(*) n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.pool_team_id = ? AND p.player_type = 'youth' AND s.is_promoted = 0`, c)[0].n <= 4);
  const aiScout = W.q(`SELECT s.staff_id id FROM career_staff_state s JOIN staff st ON st.id = s.staff_id WHERE s.career_save_id = ? AND s.team_id IS NULL AND s.pool_team_id IS NULL AND st.role = 'Scout' LIMIT 1`, cid)[0].id;
  W.w(`UPDATE career_staff_state SET pool_team_id = ?, is_available = 0 WHERE career_save_id = ? AND staff_id = ?`, buyer, cid, aiScout);
  W.w(`UPDATE staff SET scouting_rating = 90 WHERE id = ?`, aiScout);
  W.w(`UPDATE career_pool_team_state SET balance = 2000000 WHERE career_save_id = ? AND pool_team_id = ?`, cid, buyer);
  let aiJobs = [];
  for (let i = 0; i < 28 && aiJobs.length === 0; i++) { await W.day(); aiJobs = W.q(`SELECT staff_id s, kind, ready_on r, started_on o FROM scouting_jobs WHERE career_save_id = ? AND pool_team_id = ?`, cid, buyer); }
  check("an AI club's youth negotiation goes on its negotiator's list (its Scout, 5 days)", aiJobs.length > 0 && aiJobs[0].kind === "youth_deal" && aiJobs[0].s === aiScout && aiJobs[0].r === addDays(aiJobs[0].o, 5),
    JSON.stringify(aiJobs));
  const src = fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "utils", "youthDeals.ts"), "utf8");
  check("(source) and the AI clubs pick their negotiator by the same rule (pickScouterTx, the jobs in progress)",
    /pickScouterTx\(tx, careerSaveId, club, \[\["scout"\], \["head_coach", "assistant_coach"\]\], today\)/.test(src) && /negotiatorSkillTx\(tx, careerSaveId, club, today\)\.skill <= YOUTH_DEALS\.scoutFloor/.test(src));
  info("a Scout's reports already started before he goes on a mission still finish (he is not called back)");

  // ── 8. Youth cards, the Watch List, the Medical pill ──────────────────────
  console.log("\n8. YOUTH CARDS, THE WATCH LIST, THE STAFF MARKET'S MEDICAL PILL");
  const freeYouth = (await W.api("GET", "/players/youth-pool")).data[0];
  await W.api("POST", `/players/${freeYouth.id}/watch`, { watch: true });
  const aiYouth = W.q(`SELECT s.player_id id FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL
    AND s.team_id IS NULL AND p.player_type = 'youth' AND s.is_promoted = 0 LIMIT 1`, cid)[0].id;
  await W.api("POST", `/players/${aiYouth}/watch`, { watch: true });
  const pool = (await W.api("GET", "/players/youth-pool")).data.find((p) => p.id === freeYouth.id);
  const wy = (await W.api("GET", "/players/watched-youths")).data;
  check("a starred youth is starred on the youth market, and both starred youths are on the Watch List (one in an AI academy)",
    pool?.watched === true && wy.some((p) => p.id === freeYouth.id && p.status === "free") && wy.some((p) => p.id === aiYouth && p.status === "ai_academy" && !!p.currentTeamName),
    JSON.stringify(wy.map((p) => [p.name, p.status])));
  const club = W.q(`SELECT pool_team_id c FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, aiYouth)[0].c;
  const clubYouth = (await W.api("GET", `/clubs/${club}`)).data?.youths?.find((p) => p.id === aiYouth);
  check("the Clubs page's youth carries her star", clubYouth?.watched === true);
  await W.api("POST", `/players/${freeYouth.id}/watch`, { watch: false });
  check("taken off, she leaves the Watch List", !(await W.api("GET", "/players/watched-youths")).data.some((p) => p.id === freeYouth.id));
  const marketSrc = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "players.tsx"), "utf8");
  check("(source) the Watch List is a top-row pill beside Senior / Youth Players, and the second-row pill is gone (no double)",
    /data-testid="market-watch-list"/.test(marketSrc) && /Watch List \(\{watchCount\}\)/.test(marketSrc) && !/\{ id: "watch",/.test(marketSrc));
  check("(source) on the Watch List each card has Remove from list, Scout and Buy, through the market's own handlers and contract box",
    />Remove from list</.test(marketSrc) && /<Search className="h-3 w-3" \/>Scout/.test(marketSrc) && /triggerLabel="Buy"/.test(marketSrc)
    && /onScout=\{handleScout\} onWatch=\{handleWatch\} watchView/.test(marketSrc) && /watch-kind-\$\{k\}/.test(marketSrc));
  check("(source) a youth card has the Watch star and the senior card's Scout button (full width, under Sign)",
    /export function YouthPoolCard[\s\S]{0,3000}data-testid=\{`watch-\$\{player\.id\}`\}/.test(marketSrc) && /Scout player \(5 days, \$\{scoutCostText\(player\)\}\)/.test(marketSrc.slice(marketSrc.indexOf("export function YouthPoolCard"))));
  const staffMarketSrc = fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", "pages", "staff-market.tsx"), "utf8");
  check("(source) the Staff Market has a Medical pill to the Medical Market, its role pills all kept", /<Link href="\/medical-market">[\s\S]{0,200}staff-market-medical/.test(staffMarketSrc)
    && /const ROLE_FILTERS = \["all", "head_coach", "assistant_coach", "fitness_trainer", "strength_conditioner", "promotions_manager", "scout"\]/.test(staffMarketSrc));

  // Item 6: scouted first (the order is the page's; the state is the server's, for today).
  const fe = (f) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", ...f.split("/")), "utf8");
  const sortSrc = fe("components/sort-menu.tsx");
  check("(source) one rule: scouted (done) first, then in progress, then unscouted, the chosen order kept inside each",
    /const rank = \(s: string \| null \| undefined\) => \(s === "done" \? 0 : s === "in_progress" \? 1 : 2\);/.test(sortSrc) && /a\.r - b\.r \|\| a\.i - b\.i/.test(sortSrc));
  const users = {
    "the Player Market (seniors, youths, the Watch List)": (fe("pages/players.tsx").match(/scoutedFirst\(/g) ?? []).length >= 4,
    "the Staff Market": /scoutedFirst\(sortList\(inButtonOrder\(marketStaff\), sortKey, STAFF_SORT\)/.test(fe("pages/staff-market.tsx")),
    "the Medical list": /scoutedFirst\(sortList\(inButtonOrder\(marketStaff\), sortKey, STAFF_SORT\)/.test(fe("pages/medical-market.tsx")),
    "the Clubs page (seniors and youths)": (fe("pages/clubs.tsx").match(/scoutedFirst\(data\.(seniors|youths)/g) ?? []).length === 2,
  };
  check("(source) every list uses it", Object.values(users).every(Boolean), Object.entries(users).filter(([, v]) => !v).map(([k]) => k).join(", ") || "all five");
  // The state moves on its day: a report sent now reads "in_progress", and "done" on its fifth day.
  const fresh = (await W.api("GET", "/players/market-all")).data.find((p) => p.status === "free_agent" && p.scouting?.state === "none");
  const sentOn = await today();
  W.w(`UPDATE continental_scouting_missions SET status = 'collected' WHERE team_id = ?`, teamId);   // his Scout back from Europe for this check
  W.w(`UPDATE scouting_jobs SET ready_on = ? WHERE career_save_id = ? AND team_id = ?`, sentOn, cid, teamId);   // places free for this check
  const go = await W.api("POST", `/players/${fresh.id}/scout`, {});
  const st0 = (await W.api("GET", "/players/market-all")).data.find((p) => p.id === fresh.id)?.scouting?.state;
  while ((await today()) < addDays(sentOn, 5)) await W.day();
  const st5 = (await W.api("GET", "/players/market-all")).data.find((p) => p.id === fresh.id)?.scouting?.state;
  check("her card reads 'in progress' when the scout goes, and 'done' (to the top) the day the report is in", go.status === 200 && st0 === "in_progress" && st5 === "done",
    `HTTP ${go.status} ${go.data?.error ?? ""}; ${st0} -> ${st5}`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
