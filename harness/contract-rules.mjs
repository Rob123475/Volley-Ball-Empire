/**
 * 1.1.3 rebuild, Part B (Rob, 24 Oct): who may sign which contract length.
 *
 *   players at the club the career controls   6 months · 1 season · 2 seasons
 *   players at every other club (the AI)      1 season · 2 seasons
 *   staff and medical, at every club          1 season · 2 seasons, ending 7 January
 *
 * (utils/contractTerms.ts.) Asserted:
 *   1. The rule: the three lists, the gate (the career's current club), the refusals, and where a
 *      staff contract ends (7 January, the day before the AI clubs' deal day), from the module itself.
 *   2. The source: every route that signs or renews a player asks the gate; every staff route and
 *      the AI staff deal use the staff lengths; no AI path can pick 6 months.
 *   3. A career: his club signs a player on 6 months; a 2-season deal spans two seasons, not 730 days;
 *      a staff or medical hire on 6 months is refused, on 1 or 2 seasons it ends on a 7 January.
 *   4. Past the AI clubs' 8 January deal: no staff or medical contract anywhere ends on any other
 *      date than 7 January, and no AI club holds a 6-month contract of any kind.
 * The club move (the option follows the manager, the old club's 6-month deals untouched) is
 * asserted where a real move is played: harness/ai-job-market.mjs.
 *
 * Usage: node harness/contract-rules.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createWorld, REPO } from "./night2-world.mjs";
import { freeSquadPlace } from "./harness-club.mjs";

const W = createWorld("contract-rules", 4994);
const { check } = W;
const SRC = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
console.log("=".repeat(72));
console.log("  1.1.3 REBUILD PART B: CONTRACT LENGTHS BY WHO SIGNS, STAFF TO 7 JANUARY");
console.log("=".repeat(72));

const esbuild = createRequire(path.join(REPO, "artifacts", "api-server", "package.json"))("esbuild");
const termsOut = path.join(W.work, "terms.mjs");
esbuild.buildSync({ entryPoints: [path.join(REPO, "artifacts/api-server/src/utils/contractTerms.ts")], outfile: termsOut, format: "esm", bundle: true, logLevel: "silent", platform: "node" });
const T = await import(pathToFileURL(termsOut).href);
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

try {
  // ── 1. The rule ───────────────────────────────────────────────────────────
  console.log("\n1. THE RULE (utils/contractTerms.ts)");
  check("players at the career's club: 6 months, 1 season, 2 seasons", T.PLAYER_CONTRACT_LENGTHS.join(",") === "6m,1s,2s");
  check("players at every other club: 1 season, 2 seasons", T.AI_PLAYER_CONTRACT_LENGTHS.join(",") === "1s,2s");
  check("staff and medical: 1 season, 2 seasons", T.STAFF_CONTRACT_LENGTHS.join(",") === "1s,2s");
  check("the gate: the career's current club is the only party that may use 6 months",
    T.playerContractParty(true) === "career_player" && T.playerContractParty(false) === "other_player");
  const ai6 = T.readContractLength({ length: "6m" }, T.playerContractParty(false));
  const staff6 = T.readContractLength({ length: "6m" }, "staff");
  const mine6 = T.readContractLength({ length: "6m" }, T.playerContractParty(true));
  check("an AI club's request for 6 months is refused, and says why", "error" in ai6 && /Only the club the career manages can offer 6 months/.test(ai6.error), ai6.error);
  check("a staff or medical 6 months is refused, and says why", "error" in staff6 && /end on 7 January/.test(staff6.error), staff6.error);
  check("the career's club may", mine6.length === "6m");
  check("1 or 2 seasons are fine for everyone",
    ["career_player", "other_player", "staff"].every((p) => ["1s", "2s"].every((l) => T.readContractLength({ length: l }, p).length === l)));
  const dealDay = Number(/export const AI_STAFF_DEAL_DAY = (\d+);/.exec(SRC("lib/db/src/schema/staff-roles.ts"))?.[1]);
  check("staff contracts end on 7 January, the day before the AI clubs' deal day",
    T.STAFF_CONTRACT_END === `01-${String(dealDay - 1).padStart(2, "0")}` && T.STAFF_CONTRACT_END === "01-07", `AI_STAFF_DEAL_DAY ${dealDay}, STAFF_CONTRACT_END ${T.STAFF_CONTRACT_END}`);
  const cases = [
    ["1s", "2026-01-03", "2027-01-07", "a first-week hire runs the whole year"],
    ["1s", "2026-07-15", "2027-01-07", "a mid-season hire runs to the next 7 January (a short deal, intended)"],
    ["1s", "2026-12-20", "2027-01-07", "a December hire too"],
    ["2s", "2026-07-15", "2028-01-07", "2 seasons: the 7 January after that"],
    ["1s", "2027-01-07", "2028-01-07", "renewed on its 7 January end: to the next one"],
    ["2s", "2027-01-07", "2029-01-07", "renewed for 2 seasons"],
  ];
  for (const [l, from, want, why] of cases) check(`staff ${l} from ${from} ends ${want}: ${why}`, T.staffContractEndDate(l, from) === want, T.staffContractEndDate(l, from));
  check("a 2-season player deal ends on the end of the season after this one, not 730 days on",
    T.contractEndDate("2s", "2026-03-01", ["2026-12-31"]) === "2027-12-31" && days("2026-03-01", "2027-12-31") !== 730,
    `${T.contractEndDate("2s", "2026-03-01", ["2026-12-31"])} (${days("2026-03-01", T.contractEndDate("2s", "2026-03-01", ["2026-12-31"]))} days)`);
  check("an older deal on 6 months renews on a season at a club that may not use 6 months", T.seasonLength("6m") === "1s" && T.seasonLength("2s") === "2s");

  // ── 2. The source ─────────────────────────────────────────────────────────
  console.log("\n2. THE SOURCE: EVERY PATH ASKS THE RULE");
  const routes = ["routes/contracts.ts", "routes/team.ts", "routes/transfers.ts", "routes/youth-loans.ts", "routes/youth-scouting.ts"]
    .map((f) => [f, SRC(`artifacts/api-server/src/${f}`)]);
  const reads = routes.flatMap(([f, s]) => [...s.matchAll(/readContractLength\(([^;]+)\);/g)].map((m) => [f, m[1]]));
  check("every route that signs or renews a player reads its length through the gate (the career's current club)",
    reads.length === 6 && reads.every(([, a]) => /playerContractPartyFor\(/.test(a)), reads.map(([f, a]) => `${f}: ${a.slice(0, 60)}`).join(" | "));
  const staffRoutes = [SRC("artifacts/api-server/src/routes/staff.ts"), SRC("artifacts/api-server/src/routes/medical-staff.ts")].join("\n");
  const staffReads = [...staffRoutes.matchAll(/readContractLength\(([^;]+)\);/g)].map((m) => m[1]);
  check("the staff and medical routes read staff lengths, and end a deal on a 7 January",
    staffReads.length === 3 && staffReads.every((a) => /"staff"/.test(a)) && /staffContractEndDate\(wanted\.length, member\.contractEndDate\)/.test(staffRoutes), staffReads.join(" | "));
  const aiStaff = SRC("artifacts/api-server/src/utils/aiStaff.ts");
  check("the AI clubs' staff deal picks 1 or 2 seasons, to 7 January",
    /STAFF_CONTRACT_LENGTHS\[Math\.floor\(random\(\) \* STAFF_CONTRACT_LENGTHS\.length\)\]/.test(aiStaff) && /contractEndDate: staffContractEndDate\(length, today\)/.test(aiStaff) && !/CONTRACT_LENGTHS\[Math/.test(aiStaff.replace(/STAFF_CONTRACT_LENGTHS/g, "")));
  const pool = SRC("artifacts/api-server/src/utils/poolClubFinances.ts");
  const lengthFor = /export function lengthForRating[\s\S]*?\n\}/.exec(pool)?.[0] ?? "";
  check("an AI club's player length (signings, renewals, bids) is 1 or 2 seasons", /return clubRating >= 78 \? "2s" : "1s";/.test(lengthFor) && !/6m|CONTRACT_LENGTHS/.test(lengthFor), lengthFor.split("\n").pop());
  const aiSrc = ["utils/aiSquads.ts", "utils/aiSquadPolicy.ts", "utils/poolClubFinances.ts", "utils/transfers.ts", "utils/youthDeals.ts", "utils/aiStaff.ts"].map((f) => SRC(`artifacts/api-server/src/${f}`)).join("\n");
  check("no AI path falls back on the first length (it was 6 months)", !/CONTRACT_LENGTHS\[0\]/.test(aiSrc) && !/"6m"/.test(aiSrc));
  // 1.1.3 (26 Oct): an AI club's counter (aiCounterFor) is the squad policy's; the deal completes in transfers.ts.
  const tr = SRC("artifacts/api-server/src/utils/transfers.ts");
  check("an AI club counters a 6-month bid with a season, and a deal completed at any club but his is on a season",
    /length: seasonLength\(bid\.length\)/.test(SRC("artifacts/api-server/src/utils/aiSquadPolicy.ts")) && /playerContractPartyTx\(tx, careerSaveId, to\.teamId\) === "career_player"/.test(tr));

  // ── 3. A career ───────────────────────────────────────────────────────────
  console.log("\n3. A CAREER: HIS CLUB, AND STAFF");
  await W.boot();
  const c = await W.newCareer("Contract Rules");
  const today = async () => (await W.api("GET", "/calendar")).data?.currentDate;
  W.w(`UPDATE teams SET budget = 2000000 WHERE id = ?`, c.teamId);
  const sign = async (length) => {
    // Every senior holding a place (the roster page leaves out one on the injured list): keep the two starters.
    const seniors = W.q(`SELECT s.player_id AS id FROM career_player_state s JOIN players p ON p.id = s.player_id
      WHERE s.career_save_id = ? AND s.team_id = ? AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1) ORDER BY s.squad_role = 'starter', s.salary`, c.cid, c.teamId);
    for (const s of seniors.slice(0, Math.max(0, seniors.length - 2))) freeSquadPlace(W.db, s.id, c.teamId);
    const fa = ((await W.api("GET", "/players/free-agents")).data ?? []).filter((x) => x.playerType !== "youth" && !x.teamId)
      .sort((a, b) => Number(a.salary) - Number(b.salary))[0];
    const r = await W.api("POST", "/contracts", { confirm: true, playerId: fa.id, salary: fa.salary, bonusPerWin: 0, squadRole: "interchange", length });
    return { ...r, fa };
  };
  const d0 = await today();
  const six = await sign("6m");
  check("his club signs a player on 6 months", six.status === 201 && days(six.data?.startDate ?? d0, six.data?.endDate) >= 180 && days(six.data?.startDate ?? d0, six.data?.endDate) <= 185,
    `HTTP ${six.status}: ${six.data?.startDate ?? d0} -> ${six.data?.endDate} ${six.data?.error ?? ""}`);
  const two = await sign("2s");
  const seasonEnd = W.q(`SELECT end_date AS e FROM seasons WHERE career_save_id = ? AND status = 'active'`, c.cid)[0].e;
  const nextEnd = `${Number(seasonEnd.slice(0, 4)) + 1}${seasonEnd.slice(4)}`;
  check("a 2-season deal spans two seasons, to the end of the next season, not 730 days",
    two.status === 201 && two.data?.endDate === nextEnd && days(d0, two.data?.endDate) !== 730, `${d0} -> ${two.data?.endDate} (${days(d0, two.data?.endDate)} days; this season ends ${seasonEnd})`);
  const staffMarket = (await W.api("GET", "/staff/market")).data ?? [];
  const medMarket = (await W.api("GET", "/medical-staff/market")).data ?? [];
  const coach = staffMarket[0], medic = medMarket[0];
  const coach6 = await W.api("POST", "/staff", { staffId: coach?.id, length: "6m" });
  const medic6 = await W.api("POST", "/medical-staff", { staffId: medic?.id, length: "6m" });
  check("a staff hire on 6 months is refused, and so is a medical one", coach6.status === 400 && medic6.status === 400, `${coach6.status} ${coach6.data?.error}; ${medic6.status}`);
  const coach1 = await W.api("POST", "/staff", { staffId: coach?.id, length: "1s" });
  const medic2 = await W.api("POST", "/medical-staff", { staffId: medic?.id, length: "2s" });
  const endOf = (id) => W.q(`SELECT contract_term AS t, contract_end_date AS e FROM career_staff_state WHERE career_save_id = ? AND staff_id = ?`, c.cid, id)[0];
  const y = Number(d0.slice(0, 4));
  check("on 1 season the coach's deal ends on the 7 January after this season", coach1.status === 201 && endOf(coach.id)?.t === "1s" && endOf(coach.id)?.e === `${y + 1}-01-07`, JSON.stringify(endOf(coach.id)));
  check("on 2 seasons the medic's ends on the 7 January after that", medic2.status < 300 && endOf(medic.id)?.t === "2s" && endOf(medic.id)?.e === `${y + 2}-01-07`, JSON.stringify(endOf(medic.id)));

  // ── 4. Past the AI clubs' deal day ────────────────────────────────────────
  console.log("\n4. PAST THE AI CLUBS' 8 JANUARY DEAL, AND A MONTH ON");
  for (let i = 0; i < 40 && (await today()) < `${y}-02-10`; i++) await W.day();
  const aiStaff8 = W.q(`SELECT COUNT(*) AS n FROM career_staff_state WHERE career_save_id = ? AND pool_team_id IS NOT NULL`, c.cid)[0].n;
  const ends = W.q(`SELECT staff_id AS id, team_id AS t, pool_team_id AS p, contract_term AS term, contract_end_date AS e FROM career_staff_state
    WHERE career_save_id = ? AND (team_id IS NOT NULL OR pool_team_id IS NOT NULL)`, c.cid);
  const off = ends.filter((r) => r.e == null || r.e.slice(5) !== "01-07");
  check("no staff or medical contract anywhere ends on any other date than 7 January (his club and every AI club)",
    aiStaff8 > 0 && ends.length > 0 && off.length === 0, `${ends.length} contracts (${aiStaff8} at AI clubs), ends: ${[...new Set(ends.map((r) => r.e))].join(", ")}${off.length ? `; OFF: ${JSON.stringify(off.slice(0, 3))}` : ""}`);
  const aiStaff6 = ends.filter((r) => r.p != null && !["1s", "2s"].includes(r.term));
  check("no AI club's staff member is on 6 months (or anything but 1 or 2 seasons)", aiStaff6.length === 0, `${ends.filter((r) => r.p != null).length} AI staff; terms ${[...new Set(ends.filter((r) => r.p != null).map((r) => r.term))].join(", ")}`);
  const poolLengths = W.q(`SELECT length AS l, status AS s, COUNT(*) AS n FROM pool_player_contracts WHERE career_save_id = ? GROUP BY length, status`, c.cid);
  check("no AI club's pool contract is on 6 months", poolLengths.every((r) => r.l !== "6m"), poolLengths.map((r) => `${r.l}/${r.s} x${r.n}`).join(", "));
  const aiDeals = W.q(`SELECT length AS l, COUNT(*) AS n FROM transfer_deals WHERE career_save_id = ? AND to_pool_team_id IS NOT NULL GROUP BY length`, c.cid);
  check("no deal that takes a player to an AI club is on 6 months", aiDeals.every((r) => r.l !== "6m"), aiDeals.map((r) => `${r.l} x${r.n}`).join(", ") || "none yet");
  const seasonEnds = new Set(W.q(`SELECT end_date AS e FROM seasons WHERE career_save_id = ?`, c.cid).map((r) => r.e));
  for (const e of [...seasonEnds]) for (let k = 1; k <= 3; k++) seasonEnds.add(`${Number(e.slice(0, 4)) + k}${e.slice(4)}`);
  const aiSeniors = W.q(`SELECT s.player_id AS id, s.contract_end_date AS e FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND s.is_retired = 0 AND (p.player_type = 'senior' OR s.is_promoted = 1)`, c.cid);
  const offSeason = aiSeniors.filter((r) => r.e != null && !seasonEnds.has(r.e));
  check("every AI club's senior is on a season deal: her contract ends on a season's end (a 6-month one would not)",
    aiSeniors.length >= 100 && offSeason.length === 0, `${aiSeniors.length} AI seniors, ends: ${[...new Set(aiSeniors.map((r) => r.e))].join(", ")}${offSeason.length ? `; OFF ${JSON.stringify(offSeason.slice(0, 3))}` : ""}`);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
