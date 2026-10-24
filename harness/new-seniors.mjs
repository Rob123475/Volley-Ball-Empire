/**
 * 1.1.1 (Rob, 18 Oct; Downloads/NEW-SENIORS-BRIEF-18OCT.md, v4): new seniors, the picture decides the
 * nation, and retirement rebuilt.
 *
 *   1. at a season's turn 15 AI academy youths stay on at 19 and 5 picture players arrive, all free
 *      agents: each picture player's nation is her picture's folder nation, her name a real name of
 *      that nation, 19 to 21; a kept-on youth's card is her own nation's picture, else a graduate
 *      picture of her continent, else her flag; no picture twice; nations no AI youth holds first
 *   2. a new senior can be signed under the cap and the window rules
 *   3. retirement: the season she turns 40 is her last (and Club News says so); the chance table
 *      (age, reconstructions, a falling rating, a season unsigned); the turn records ratings and
 *      free agents for the next
 *   4. "Ask her to retire": refused outside the window, allowed on the injured list, the rest of her
 *      contract paid out; "Put her on the transfer list" on and off
 *   5. (source) the AI clubs' deadwood, the listed player in AI buying, the Rules page and patch notes
 *
 * The pictures are this suite's own placeholders (VBE_NEW_SENIOR_PICTURES), so it does not depend on
 * Rob's set being installed.
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";
import { turnDownBids, healAllSquads, freeSquadPlace } from "./harness-club.mjs";

const W = createWorld("new-seniors", 4998);
const { check } = W;
const SRC = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
console.log("=".repeat(72));
console.log("  1.1.1: NEW SENIORS, THE PICTURE DECIDES THE NATION, RETIREMENT REBUILT");
console.log("=".repeat(72));

// Placeholder pictures: four of each of six nations, Croatia (no athletes in the game) among them.
const NATIONS = [["Croatia", "europe"], ["Germany", "europe"], ["Kenya", "africa_middle_east"], ["Fiji", "oceania"], ["Japan", "asia"], ["Brazil", "south_america"]];
const pictures = NATIONS.flatMap(([nation, continent]) => [1, 2, 3, 4].map((i) => ({
  url: `/images/players/new-seniors/test/${nation.toLowerCase()}/${nation.toLowerCase()}_0${i}.webp`, nation, continent })));
const manifest = path.join(W.work, "pictures.json");
fs.writeFileSync(manifest, JSON.stringify({ pictures }));
const nationOfUrl = new Map(pictures.map((p) => [p.url, p.nation]));

try {
  await W.boot({ VBE_NEW_SENIOR_PICTURES: manifest });
  const { teamId, cid } = await W.newCareer("New Seniors");

  // ── 4 (first, in January: outside the window) ─────────────────────────────
  console.log("\n4. ASK HER TO RETIRE, AND THE TRANSFER LIST");
  const mine = () => W.q(`SELECT s.player_id id, p.name, s.salary, s.contract_end_date e FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_retired = 0 ORDER BY s.player_id`, cid, teamId);
  const squad = mine();
  const asked = squad[0];
  const outside = await W.api("POST", `/players/${asked.id}/retire`, {});
  check("asking her to retire outside the window is refused, saying when it opens", outside.status === 409 && /only in the transfer window/.test(outside.data?.error ?? ""), outside.data?.error);
  W.w(`UPDATE career_player_state SET on_injured_list = 1 WHERE career_save_id = ? AND player_id = ?`, cid, asked.id);
  const budgetBefore = W.q(`SELECT budget b FROM teams WHERE id = ?`, teamId)[0].b;
  const today = (await W.api("GET", "/calendar")).data.currentDate;
  const contract = W.q(`SELECT salary, end_date e FROM contracts WHERE player_id = ? AND team_id = ? AND status = 'active'`, asked.id, teamId)[0];
  const months = contract ? Math.ceil((Date.parse(contract.e) - Date.parse(today)) / 86_400_000 / 30.44) : 0;
  const ok = await W.api("POST", `/players/${asked.id}/retire`, {});
  const row = W.q(`SELECT reason, retired_on o FROM player_retirements WHERE career_save_id = ? AND player_id = ?`, cid, asked.id)[0];
  check("on the injured list she can be asked any time: she retires now, reason \"asked\", dated today",
    ok.status === 200 && row?.reason === "asked" && row.o === today && !mine().some((p) => p.id === asked.id), `HTTP ${ok.status} ${JSON.stringify(row)}`);
  check("and the rest of her contract is paid out, as ending it early is", contract != null && ok.data?.payout === Math.round(Number(contract.salary) * months)
    && Math.round(budgetBefore - W.q(`SELECT budget b FROM teams WHERE id = ?`, teamId)[0].b) === ok.data.payout, `paid ${ok.data?.payout} for ${months} months`);
  const news = (await W.api("GET", "/news")).data?.items ?? [];
  check("Club News announces the retirement", news.some((i) => i.type === "retirement" && i.headline.includes(asked.name)), news.find((i) => i.type === "retirement")?.headline);
  const listed = squad[1];
  const on = await W.api("POST", `/players/${listed.id}/transfer-list`, { listed: true });
  const card = (await W.api("GET", "/team/roster")).data;
  const seen = [...(card?.starters ?? []), ...(card?.interchanges ?? []), ...(card?.reserves ?? [])].find((p) => p.id === listed.id);
  check("on the transfer list: her card says so", on.status === 200 && seen?.transferListed === true, JSON.stringify(on.data));
  const off = await W.api("POST", `/players/${listed.id}/transfer-list`, { listed: false });
  check("and off it again", off.status === 200 && W.q(`SELECT transfer_listed t FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, listed.id)[0].t === 0);

  // ── 3 (set up): a free agent plays on through the season she turns 40 ──
  // (A free agent: an AI club would ask a 39-year-old to retire in the window, aiDeadwoodTx.)
  const old = W.q(`SELECT s.player_id id, p.name FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.team_id IS NULL
    AND s.pool_team_id IS NULL AND s.is_retired = 0 AND p.player_type = 'senior' ORDER BY s.player_id LIMIT 1`, cid)[0];
  // Too weak for any club to sign in the meantime.
  W.w(`UPDATE career_player_state SET age = 39, speed = 20, power = 20, defense = 20, serve = 20, block = 20, stamina = 20 WHERE career_save_id = ? AND player_id = ?`, cid, old.id);

  // ── The season's turn ─────────────────────────────────────────────────────
  console.log("\n   (playing to the season's turn)");
  let rolled = null;
  for (let d = 0; d < 420 && !rolled; d++) {
    turnDownBids(W.db);
    if (d % 7 === 0) healAllSquads(W.db);
    const r = await W.day();
    if (r.data?.seasonRollover?.kind === "rolled") rolled = r.data.seasonRollover;
  }
  check("the season turned", !!rolled, rolled ? `${rolled.fromSeason} -> ${rolled.toSeason}` : "never");

  // ── 1. The new seniors ────────────────────────────────────────────────────
  console.log("\n1. THE NEW SENIORS");
  const arrived = W.q(`SELECT n.*, p.name, p.nationality, s.age, s.team_id t, s.pool_team_id pt, s.pool_joined_on joined, s.salary, p.player_type type, s.is_promoted pr,
    s.speed, s.power, s.defense, s.serve, s.block, s.stamina
    FROM career_new_seniors n JOIN players p ON p.id = n.player_id LEFT JOIN career_player_state s ON s.player_id = n.player_id AND s.career_save_id = n.career_save_id
    WHERE n.career_save_id = ? AND n.season_year = 2027`, cid);
  const youths = arrived.filter((a) => a.kind === "youth"), picks = arrived.filter((a) => a.kind === "picture");
  const left = W.q(`SELECT COUNT(*) n FROM players p WHERE p.origin_career_save_id = ? AND p.player_type = 'youth'
    AND NOT EXISTS (SELECT 1 FROM career_player_state s WHERE s.player_id = p.id AND s.career_save_id = ?)`, cid, cid)[0].n;
  check("15 AI academy youths stayed on and 5 picture players arrived, on the new season's first day", youths.length === 15 && picks.length === 5
    && arrived.every((a) => a.arrived_on === "2027-01-01"), `${youths.length} youths stayed (${left} other AI youths left the game at 19), ${picks.length} picture players`);
  // 1.1.3 rebuild (Part E): they arrive on the market; later in the same turn an AI club short of players signs from the
  // free agents (seasonRollover.ts keepAiSquadsTx), so one may already be at an AI club, joined that day. Anything else fails.
  const signedAtTurn = arrived.filter((a) => a.t == null && a.pt != null && a.joined === "2027-01-01");
  check("every one arrived a free agent on the market, at a wage (an AI club short of players may sign one at the turn)",
    arrived.every((a) => Number(a.salary) > 0 && a.t == null && (a.pt == null || signedAtTurn.includes(a))),
    `${arrived.filter((a) => a.pt == null && a.t == null).length} on the market; signed by an AI club at the turn: ${signedAtTurn.map((a) => `${a.name} (club ${a.pt})`).join(", ") || "none"}${arrived.some((a) => a.t != null || (a.pt != null && !signedAtTurn.includes(a))) ? `; ELSEWHERE: ${arrived.filter((a) => a.t != null || (a.pt != null && !signedAtTurn.includes(a))).map((a) => a.name).join(", ")}` : ""}`);
  check("every picture player's nation is her picture's folder nation", picks.every((a) => a.nationality === a.nation && nationOfUrl.get(a.image_url) === a.nation),
    picks.map((a) => `${a.name} ${a.nationality} <- ${nationOfUrl.get(a.image_url)}`).join("; "));
  check("each is a senior of 19 to 21 with youth-scale stats", picks.every((a) => a.type === "senior" && a.age >= 19 && a.age <= 21
    && [a.speed, a.power, a.defense, a.serve, a.block, a.stamina].every((v) => v >= 1 && v <= 99)), picks.map((a) => a.age).join(","));
  const namesFile = SRC("artifacts/api-server/src/data/nationNames.ts");
  const realName = (a) => {
    const [first, ...rest] = a.name.split(" "); const last = rest.join(" ");
    const athletes = W.q(`SELECT name FROM players WHERE origin_career_save_id IS NULL AND nationality = ? UNION SELECT name FROM continental_pool_players WHERE nationality = ?`, a.nation, a.nation).map((r) => r.name);
    const has = (part, i) => athletes.some((n) => (i === 0 ? n.split(" ")[0] : n.split(" ").slice(1).join(" ")) === part) || namesFile.includes(`"${part}"`);
    return has(first, 0) && has(last, 1);
  };
  check("each has a real name of her nation (its athletes' names, or data/nationNames.ts)", picks.every(realName), picks.map((a) => a.name).join(", "));
  const held = new Set(W.q(`SELECT DISTINCT p.nationality n FROM career_player_state s JOIN players p ON p.id = s.player_id WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL
    AND p.player_type = 'youth' AND s.is_promoted = 0`, cid).map((r) => r.n));
  check("nations no AI academy youth holds come first: Croatia arrives", picks.some((a) => a.nation === "Croatia") && !held.has("Croatia"), [...new Set(picks.map((a) => a.nation))].join(", "));
  const portraits = W.q(`SELECT player_id p, image_url u FROM career_graduate_portraits WHERE career_save_id = ?`, cid);
  check("no picture is used twice in the career", new Set(portraits.map((r) => r.u)).size === portraits.length, `${portraits.length} given`);
  const urlOf = new Map(portraits.map((r) => [r.p, r.u]));
  check("each kept-on youth's card: her own nation's new picture, else a graduate picture of her continent, else her flag",
    youths.every((a) => (a.picture === "nation" && nationOfUrl.get(urlOf.get(a.player_id)) === a.nation)
      || (a.picture === "graduate" && (urlOf.get(a.player_id) ?? "").startsWith("/images/players/graduates/"))
      || (a.picture === "none" && !urlOf.has(a.player_id))),
    ["nation", "graduate", "none"].map((k) => `${k} ${youths.filter((a) => a.picture === k).length}`).join(", "));
  check("a new picture is never on a player of another nation", portraits.filter((r) => nationOfUrl.has(r.u)).every((r) =>
    W.q(`SELECT nationality n FROM players WHERE id = ?`, r.p)[0]?.n === nationOfUrl.get(r.u)));
  const talent = ((await W.api("GET", "/news")).data?.items ?? []).find((i) => i.type === "talent");
  check("Club News lists the new talent", !!talent && /20 new seniors on the free-agent market/.test(talent.headline), talent?.headline);

  // ── 2. Signing one ────────────────────────────────────────────────────────
  console.log("\n2. SIGNING A NEW SENIOR");
  const target = [...picks].sort((a, b) => Number(a.salary) - Number(b.salary))[0];
  const room = W.q(`SELECT SUM(salary) s FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND is_retired = 0`, cid, teamId)[0].s;
  const sign = await W.api("POST", "/contracts", { playerId: target.player_id, salary: Number(target.salary), bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("a new senior signs at her wage, outside the window too, like any free agent under the cap", sign.status < 300
    && W.q(`SELECT team_id t FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, target.player_id)[0]?.t === teamId,
    `HTTP ${sign.status} ${sign.data?.error ?? ""} (wages before $${room})`);
  // A place free (the squad is 3 of 3), and the wages over the cap: the next signing must be refused for the cap.
  const spare = W.q(`SELECT player_id id, squad_role r FROM career_player_state WHERE career_save_id = ? AND team_id = ? AND is_retired = 0 AND player_id <> ? LIMIT 1`, cid, teamId, target.player_id)[0];
  if (spare) freeSquadPlace(W.db, spare.id, teamId);
  W.w(`UPDATE career_player_state SET salary = 61000 WHERE career_save_id = ? AND team_id = ? AND player_id = ?`, cid, teamId, target.player_id);
  const second = picks.find((a) => a.player_id !== target.player_id);
  const capped = await W.api("POST", "/contracts", { playerId: second.player_id, salary: Number(second.salary), bonusPerWin: 0, squadRole: spare?.r ?? "starter", length: "1s", confirm: true });
  check("and the salary cap refuses one that would take him over", capped.status >= 400 && /cap/i.test(JSON.stringify(capped.data)), `HTTP ${capped.status} ${capped.data?.error ?? ""}`);

  // ── 3. Retirement ─────────────────────────────────────────────────────────
  console.log("\n3. RETIREMENT");
  const limit = W.q(`SELECT reason, age, retired_on o FROM player_retirements WHERE career_save_id = ? AND player_id = ?`, cid, old.id)[0];
  check("a player who turned 40 in the season retired at its end (reason \"limit\")", limit?.reason === "limit" && limit.age === 40 && limit.o === "2027-01-01", JSON.stringify(limit));
  const all = W.q(`SELECT reason, COUNT(*) n FROM player_retirements WHERE career_save_id = ? AND season_year = 2026 GROUP BY reason`, cid);
  W.info(`retired at the turn of season 1: ${all.map((r) => `${r.reason} ${r.n}`).join(", ")}`);
  check("every retirement at the turn has a reason and a date", W.q(`SELECT COUNT(*) n FROM player_retirements WHERE career_save_id = ? AND (reason IS NULL OR retired_on IS NULL)`, cid)[0].n === 0);
  // (Youths made after it, the player's intake and the AI academies' refill, have none until the next.)
  check("the turn recorded each living senior's rating and whether she was a free agent", W.q(`SELECT COUNT(*) n FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1) AND s.last_rollover_rating IS NULL`, cid)[0].n === 0
    && W.q(`SELECT COUNT(*) n FROM career_player_state WHERE career_save_id = ? AND last_rollover_free_agent = 1`, cid)[0].n > 0);
  const chance = (await W.api("POST", "/dev/retirement/chance", { players: [
    { age: 25, reconstructions: 0, seriousInjuries: 0, rating: 80, lastRating: 80, unsigned: false },
    { age: 28, reconstructions: 2, seriousInjuries: 2, rating: 78, lastRating: 79, unsigned: false },
    { age: 33, reconstructions: 0, seriousInjuries: 0, rating: 74, lastRating: 80, unsigned: false },
    { age: 30, reconstructions: 0, seriousInjuries: 0, rating: 70, lastRating: 70, unsigned: true },
    { age: 36, reconstructions: 0, seriousInjuries: 0, rating: 80, lastRating: 80, unsigned: false },
    { age: 40, reconstructions: 0, seriousInjuries: 0, rating: 80, lastRating: 80, unsigned: false },
  ] })).data?.results ?? [];
  const [young, knees, fading, unsigned, thirties, forty] = chance;
  check("small in her twenties, growing through her thirties", young?.chance < 0.01 && thirties?.chance > 0.15 && young.reason === "age", `25: ${young?.chance}, 36: ${thirties?.chance}`);
  check("two reconstructions can end a career at 28", knees?.chance >= 0.3 && knees.reason === "injury", JSON.stringify(knees));
  check("a falling rating and a season unsigned raise it", fading?.chance > 0.15 && fading.reason === "rating" && unsigned?.chance > 0.25 && unsigned.reason === "unsigned",
    `fading ${fading?.chance}, unsigned ${unsigned?.chance}`);
  check("the season she turns 40 is her last", forty?.chance === 1 && forty.reason === "limit");

  // ── 5. Source ─────────────────────────────────────────────────────────────
  console.log("\n5. (SOURCE) THE AI CLUBS, THE RULES AND THE NOTES");
  const ai = SRC("artifacts/api-server/src/utils/aiSquads.ts"), cal = SRC("artifacts/api-server/src/routes/calendar.ts");
  check("(source) the AI clubs ask their broken-down and oldest to retire, and list their older weakest, every week before buying",
    /export function aiDeadwoodTx/.test(ai) && /aiDeadwoodTx\(w, careerSaveId, nextDate\);\s*return aiTransfersWeekTx/.test(cal));
  check("(source) a listed player is wanted without the gap and for 75% of her price", /listed\.has\(m\.id\) \? bar - AI_BUY_GAP : bar/.test(ai) && /feeShare: 0\.75/.test(ai));
  check("(source) a new nation picture is never recycled onto a youth", /!r\.imageUrl\.startsWith\(NEW_SENIOR_PICTURE_PREFIX\)/.test(SRC("artifacts/api-server/src/utils/youthIntake.ts")));
  const rules = SRC("artifacts/beach-volleyball/src/pages/rules.tsx"), notes = SRC("docs/UPDATE1-1.1.2-PATCH-NOTES.md");
  check("(source) the Rules page: the new-talent line and the Retirement topic with both options",
    rules.includes("New talent from around the world arrives on the free-agent market every season.") && rules.includes('title: "Retirement"')
      && rules.includes("Ask her to retire (on her card)") && rules.includes("Put her on the transfer list (on her card)"));
  check("(source) and the patch notes", notes.includes("New talent from around the world arrives on the free-agent market every season") && notes.includes("No retirement age."));
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
