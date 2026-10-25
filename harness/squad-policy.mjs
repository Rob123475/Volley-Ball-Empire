/**
 * 1.1.3 (Rob, 26 Oct; squad policy brief, item A): one squad policy.
 *
 * Rob's rule: one function (utils/aiSquadPolicy.ts aiSquadPolicyTx) owns every decision about who an AI club holds:
 * the one renewal, the third place, the injured list's cover, deadwood, the age rule, the cap (arrivals too) and
 * Day 1's academies. It is called from the weekly block, the injured list's day and arrivals, and nothing else sets
 * an AI club's squad size, renews, releases or signs cover.
 *
 * Asserted:
 *   1. (source) the old scattered functions exist nowhere; the policy's moves (sign, refill, promote, leave, renew,
 *      open) are recorded only in the policy; every other line that writes a player's club or contract is on a
 *      list here, each with the reason it is not an AI club's squad decision; inside the policy only its
 *      primitives (joinTx, releaseTx, renewTx) write them; it is called from exactly the places the brief names
 *   2. (a career, SEASONS (2) seasons played headless, on a copy of the starter DB) every day, every AI club: each
 *      senior who joined, left or had her contract changed is accounted for by the policy's own record of it that
 *      day, a transfer that completed (or a counter-offer answered), a retirement, or the club being taken over.
 *      Anything else is a decision taken outside the policy.
 *
 * Usage: node harness/squad-policy.mjs   (SEASONS=n for more)
 */
import path from "node:path";
import fs from "node:fs";
import { createWorld, REPO } from "./night2-world.mjs";
import { keepSideFielded, renewExpiringContracts, healSquadByTeam } from "./harness-club.mjs";

const W = createWorld("squad-policy", 4965);
const { check, info } = W;
const SEASONS = Number(process.env.SEASONS ?? 2);
const SRCDIR = path.join(REPO, "artifacts", "api-server", "src");
const SRC = (p) => fs.readFileSync(path.join(SRCDIR, p), "utf8");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith(".ts") ? [path.join(d, e.name)] : []);
const FILES = walk(SRCDIR).map((f) => ({ f: path.relative(SRCDIR, f).replace(/\\/g, "/"), s: fs.readFileSync(f, "utf8") }));
console.log("=".repeat(72));
console.log("  1.1.3 (26 OCT): ONE SQUAD POLICY");
console.log("=".repeat(72));

// Every write of a player's club (poolTeamId) or contract (contractEndDate): a setPlayerState call or an update of
// career_player_state, with the function it is in.
function writers() {
  const out = [];
  for (const { f, s } of FILES) {
    const re = /(?:setPlayerState|updatePlayerState)\(|\.update\(careerPlayerStateTable\)(?:\s|\/\/[^\n]*)*\.set\(/g;
    let m;
    while ((m = re.exec(s))) {
      // The object literal passed to the call (an argument, so the call is still open where it starts).
      const at = m.index + m[0].length, i = s.indexOf("{", at);
      if (i < 0) continue;
      let open = 0, closed = false;
      for (const ch of s.slice(at, i)) { if (ch === "(") open++; else if ((ch === ")" && --open < 0) || ch === ";") { closed = true; break; } }
      if (closed) continue;
      let j = i, depth = 0;
      for (; j < s.length; j++) { if (s[j] === "{") depth++; else if (s[j] === "}" && --depth === 0) break; }
      const obj = s.slice(i, j + 1);
      const keys = ["poolTeamId", "contractEndDate"].filter((k) => new RegExp(`\\b${k}\\b`).test(obj));
      if (keys.length === 0) continue;
      // Its function: a declaration, a method of the career-state writer (lib/playerDto.ts withCareerStateTx), or a route.
      const fn = [...s.slice(0, m.index).matchAll(/(?:export )?(?:async )?function (\w+)|^ {4}(\w+)\(careerSaveId|router\.(?:get|post|put|patch|delete)\("([^"]+)"/gm)].pop();
      out.push(`${f}#${fn?.[1] ?? fn?.[2] ?? fn?.[3] ?? "?"}`);
    }
  }
  return [...new Set(out)].sort();
}

// The writes outside the policy, each with why it is not an AI club's squad decision.
const ALLOWED = {
  "lib/playerDto.ts#promoteAgedYouth": "an academy's graduate at 19 enters the senior market, a free agent (C15); a youth, never one of an AI club's seniors",
  "routes/calendar.ts#advanceOneDay": "a contract at the career's own club running out (teamId set)",
  "routes/contracts.ts#/contracts": "the gamer's own signing (a Day 1 draft pick from an AI club, U-6), his decision",
  "routes/contracts.ts#/contracts/:id": "the gamer's own contract edit, at his club",
  "routes/contracts.ts#/contracts/:id/renew": "the gamer's own renewal, at his club",
  "routes/players.ts#/players/:id/release": "the gamer releasing his own player",
  "routes/team.ts#/team/roster/:id/role": "the gamer moving his own youth into his side",
  "routes/job-market.ts#takeOverClub": "the manager takes the club over: it is no longer an AI club",
  "utils/backfillContracts.ts#backfillCareerContracts": "a contract row for a player at the career's own club",
  "utils/day1Draft.ts#undoDraftPickTx": "the gamer undoing his own Day 1 pick puts her back where she was",
  "utils/graduates.ts#releaseSurplusGraduatesTx": "the career's own club's surplus graduates",
  "utils/newSeniors.ts#newSeniorsArriveTx": "a new senior arrives a free agent (Rob, 18 Oct): an AI academy's youth given a picture, or a new player; never one of an AI club's seniors",
  "utils/transfers.ts#answerWithCounterTx": "a counter-offer answered (Rob's 16 Oct feature, which he keeps); an AI club's counter is the policy's (aiCounterFor)",
  "utils/transfers.ts#completeTx": "a transfer completing; an arrival at an AI club is then settled by the policy (its arrival event)",
  "utils/youthDeals.ts#youthDealTx": "a youth bought or sold: academies, not seniors",
  "utils/youthLoans.ts#borrowTx": "a youth loan: academies, not seniors",
  "utils/youthLoans.ts#returnDueLoansTx": "a youth loan ending: academies, not seniors",
  "utils/aiSquadPolicy.ts#joinTx": "THE POLICY: a free agent signed or a youth promoted",
  "utils/aiSquadPolicy.ts#releaseTx": "THE POLICY: a senior let go",
  "utils/aiSquadPolicy.ts#renewTx": "THE POLICY: the one renewal",
};

try {
  // ── 1. Source ──────────────────────────────────────────────────────────────
  console.log("\n1. (SOURCE) THE POLICY IS THE ONE PLACE");
  const policy = SRC("utils/aiSquadPolicy.ts");
  const OLD = ["keepAiSquadsTx", "aiInjuredListDayTx", "aiMarketScoutingWeekTx", "aiMarketWindowTx", "aiTransfersWeekTx", "aiDeadwoodTx",
    "aiCapOnArrivalTx", "aiTrimSquadsTx", "signToAiClub", "releaseToMarket", "renewAiSeniorTx"];
  const oldHits = FILES.flatMap(({ f, s }) => OLD.filter((n) => new RegExp(`\\b${n}\\b`).test(s)).map((n) => `${f}: ${n}`));
  check("the scattered versions are deleted: none of the old functions is named anywhere in the server", oldHits.length === 0, oldHits.join("; ") || `${OLD.length} names, none found`);

  const moveCalls = FILES.flatMap(({ f, s }) => [...s.matchAll(/recordAiMoveTx\(([^,]+),([^,]+),([^,]+),([^,]+),/g)].map((m) => ({ f, kind: m[4].trim() })))
    .filter((c) => c.f !== "utils/aiMarketLimits.ts");
  const outside = moveCalls.filter((c) => c.f !== "utils/aiSquadPolicy.ts");
  check("the policy's moves (sign, refill, promote, leave, renew, open) are recorded only in the policy; the one other record is a youth bid",
    outside.length === 1 && outside[0].f === "utils/youthDeals.ts" && outside[0].kind === `"bid"`
      && ["\"renew\"", "\"leave\"", "\"promote\"", "kind"].every((k) => moveCalls.some((c) => c.f === "utils/aiSquadPolicy.ts" && c.kind === k))
      && /`open:\$\{why\}`/.test(policy),
    outside.map((c) => `${c.f} ${c.kind}`).join("; "));

  const found = writers();
  const unknown = found.filter((k) => !(k in ALLOWED)), gone = Object.keys(ALLOWED).filter((k) => !found.includes(k));
  check("every write of a player's club or contract outside the policy is on the list with its reason; in the policy only joinTx, releaseTx and renewTx",
    unknown.length === 0 && gone.length === 0, `${found.length} writers${unknown.length ? `; NOT ON THE LIST: ${unknown.join(", ")}` : ""}${gone.length ? `; listed but not found: ${gone.join(", ")}` : ""}`);
  for (const k of found) info(`  ${k}: ${ALLOWED[k] ?? "?"}`);
  // An AI senior made from the pool on Day 1 (materializeAiSeniorsTx) is created at her club, not moved: createPlayer.
  check("an AI club's own seniors are created where the starter DB has them (materializeAiSeniorsTx), not moved",
    /w\.createPlayer\(careerSaveId, \{[\s\S]{0,600}teamId: null, poolTeamId: m\.poolTeamId, poolPlayerId: m\.id,/.test(SRC("utils/aiSquads.ts")));

  // The policy's entry point is called from exactly the places the brief names.
  const calls = FILES.flatMap(({ f, s }) => [...s.matchAll(/aiSquadPolicyTx\(w, careerSaveId, \{ kind: "(\w+)"/g)].map((m) => `${f}:${m[1]}`)).sort();
  const want = ["routes/calendar.ts:week", "utils/aiSquads.ts:injury", "utils/day1Draft.ts:day1", "utils/injuredList.ts:day", "utils/seasonRollover.ts:turn",
    "utils/transfers.ts:arrival", "utils/transfers.ts:day"].sort();
  check("the policy is called from the weekly block, the injured list's day, an AI club's match injuries, arrivals, Day 1 and the turn, and nowhere else",
    JSON.stringify(calls) === JSON.stringify(want) && (policy.match(/export function aiSquadPolicyTx\(/g) ?? []).length === 1, calls.join(", "));
  check("the bid bar is an explicit rule in the policy's header, with its number and its reason",
    /THE BID BAR/.test(policy) && /export const AI_BUY_GAP = 5;/.test(policy));
  check("the four fixes are kept: the podium's skin tones, the Club News market headline, the age-35 skip, the best floor-wage free agent on credit",
    /export function nationTones/.test(SRC("utils/aiSquads.ts")) && /askAge/.test(policy) && /on credit/.test(policy)
      && /refill/.test(SRC("routes/news.ts")));

  // ── 2. A career ───────────────────────────────────────────────────────────
  console.log(`\n2. ${SEASONS} SEASONS: EVERY CHANGE TO AN AI CLUB'S SENIORS IS THE POLICY'S`);
  await W.boot();
  const { teamId, cid } = await W.newCareer("Squad Policy");
  const myTeam = () => W.q(`SELECT team_id t FROM career_saves WHERE id = ?`, cid)[0]?.t ?? teamId;
  const today = () => W.q(`SELECT "current_date" AS d FROM calendar_state WHERE team_id = ?`, myTeam())[0]?.d ?? "";
  const clubs = () => new Set(W.q(`SELECT pool_team_id c FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid).map((r) => r.c));
  const seniors = () => new Map(W.q(`SELECT s.player_id id, s.pool_team_id club, s.contract_end_date ends FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, cid)
    .map((r) => [r.id, r]));
  const maxId = (t) => W.q(`SELECT COALESCE(MAX(id), 0) n FROM ${t} ${t === "players" ? "" : "WHERE career_save_id = ?"}`, ...(t === "players" ? [] : [cid]))[0].n;
  let season = 1, guard = 0, before = seniors(), lastMove = maxId("ai_market_moves"), lastPlayer = maxId("players");
  const unexplained = [], tally = {};
  const count = (k) => { tally[k] = (tally[k] ?? 0) + 1; };
  while (season <= SEASONS && guard++ < 470 * SEASONS) {
    healSquadByTeam(W.db, myTeam());
    if (guard % 7 === 1) { await keepSideFielded(W.api); await renewExpiringContracts(W.api); }
    const d0 = today();
    const r = await W.day();
    if (r.status >= 400) { check("the calendar advances", false, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`); break; }
    const d = today();
    const after = seniors(), ai = clubs();
    const mv = W.q(`SELECT pool_team_id club, kind, player_id id FROM ai_market_moves WHERE career_save_id = ? AND id > ?`, cid, lastMove);
    const has = (club, id, kinds) => mv.some((x) => x.club === club && x.id === id && kinds.includes(x.kind));
    // A deal that completed, or a counter-offer answered, today.
    const deals = W.q(`SELECT player_id id, from_pool_team_id fromC, to_pool_team_id toC, status FROM transfer_deals WHERE career_save_id = ?
      AND (moved_on BETWEEN ? AND ? OR (counter_wage IS NOT NULL AND offered_on BETWEEN ? AND ?))`, cid, d0, d, d0, d);
    // A retirement: her state row kept (the hall of fame) or gone, and a player_retirements row either way.
    const retired = (id) => W.q(`SELECT is_retired r FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, id)[0]?.r === 1
      || W.q(`SELECT 1 FROM player_retirements WHERE career_save_id = ? AND player_id = ?`, cid, id).length > 0;
    for (const [id, m] of after) {
      if (!ai.has(m.club)) continue;
      const was = before.get(id);
      if (was?.club === m.club) {
        if (was.ends === m.ends) continue;
        if (has(m.club, id, ["renew"])) count("renewed (the policy)");
        else if (deals.some((x) => x.id === id && x.fromC === m.club)) count("contract changed by a counter-offer answered");
        else unexplained.push(`${d} club ${m.club}: player ${id}'s contract ${was.ends} -> ${m.ends}`);
        continue;
      }
      if (has(m.club, id, ["sign", "refill", "promote"])) count(`joined: ${mv.find((x) => x.club === m.club && x.id === id && ["sign", "refill", "promote"].includes(x.kind)).kind} (the policy)`);
      else if (deals.some((x) => x.id === id && x.toC === m.club)) count("joined: a transfer completed");
      else if (!was && id > lastPlayer) count("joined: created at her club from the pool");
      else unexplained.push(`${d} club ${m.club}: player ${id} joined (was ${was ? `at club ${was.club}` : "not an AI senior"})`);
    }
    for (const [id, m] of before) {
      if (!ai.has(m.club) || after.get(id)?.club === m.club) continue;
      if (has(m.club, id, ["leave"])) count("left: released (the policy)");
      else if (deals.some((x) => x.id === id && x.fromC === m.club)) count("left: a transfer completed");
      else if (retired(id)) count("left: retired");
      else if (W.q(`SELECT team_id t FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, id)[0]?.t === myTeam()) count("left: signed by the gamer");
      else unexplained.push(`${d} club ${m.club}: player ${id} left (now ${after.get(id) ? `at club ${after.get(id).club}` : "not an AI senior"})`);
    }
    before = after; lastMove = maxId("ai_market_moves"); lastPlayer = maxId("players");
    if (r.data?.seasonRollover && r.data.seasonRollover.kind !== "none") {
      W.w(`UPDATE board_seasons SET grade = 'met' WHERE career_save_id = ? AND grade = 'failed'`, cid);
      info(`season ${season} ended ${d}`);
      season++;
    }
  }
  check(`${SEASONS} seasons played`, season > SEASONS, `reached season ${season} on ${today()}`);
  check("every change to an AI club's seniors, every day, was the policy's (or a transfer, a counter-offer, a retirement, the gamer's own signing)",
    unexplained.length === 0, unexplained.slice(0, 10).join("\n        ") || "none");
  check("the policy did act (joined, left and renewed seen)", Object.keys(tally).some((k) => k.startsWith("joined: sign")) && Object.keys(tally).some((k) => k.startsWith("left: released")) && (tally["renewed (the policy)"] ?? 0) > 0,
    Object.entries(tally).map(([k, n]) => `${k} ${n}`).join("; "));
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
  if (process.env.KEEP_DB) fs.copyFileSync(W.db, process.env.KEEP_DB);
  W.finish();
}
