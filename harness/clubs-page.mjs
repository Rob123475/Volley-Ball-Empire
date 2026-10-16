/**
 * 1.1.1, Part 1: the Clubs page (api-server routes/clubs.ts, pages/clubs.tsx).
 *
 *   1. every club is listed, the player's included, each with its badge colours,
 *      continent, tier, World Tour ladder position and record, balance, senior
 *      wages against the cap and injuries this season
 *   2. the Sort menu's six orders (richest, poorest, most successful by the
 *      World Tour ladder then points, most injury-prone, continent, name), and
 *      the menu entry between Finances and Career
 *   3. an AI club's Players: every senior (role, contract end date, injury) and
 *      academy youth, the manager, the record and the last 5 results
 *   4. its Staff & Medical: role, skill, wage and contract end date
 *   5. scouting, the Player Market's rule: an unscouted player shows "?"
 *      (no rating, locked attributes) until her report is in
 *   6. the player's own club opens his Club page; each senior is shown on her
 *      Player Market card (the same Watch star, Scout and Buy)
 */
import fs from "node:fs";
import path from "node:path";
import { createWorld, REPO } from "./night2-world.mjs";

const W = createWorld("clubs-page", 4981);
const { check } = W;
const FE = (p) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", p), "utf8");
console.log("=".repeat(72));
console.log("  1.1.1 PART 1: THE CLUBS PAGE");
console.log("=".repeat(72));

try {
  await W.boot();
  const { teamId, cid } = await W.newCareer("Clubs Page");

  // ── 1. The list ───────────────────────────────────────────────────────────
  console.log("\n1. EVERY CLUB, THE PLAYER'S INCLUDED");
  const list = (await W.api("GET", "/clubs")).data;
  const clubs = list?.clubs ?? [];
  const aiCount = W.q(`SELECT COUNT(*) n FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid)[0].n;
  const mine = clubs.find((c) => c.kind === "mine");
  check("every club: the player's and every AI club", clubs.length === aiCount + 1 && mine?.id === teamId, `${clubs.length} clubs (${aiCount} AI)`);
  const whole = (c) => typeof c.name === "string" && ["Bronze", "Silver", "Gold"].includes(c.tier) && typeof c.balance === "number"
    && c.wages?.cap === 60000 && typeof c.wages.seniorWages === "number" && typeof c.injuries === "number" && typeof c.wins === "number" && typeof c.losses === "number";
  check("each row: badge colours, continent, tier, ladder, record, balance, \"$X of $60,000\", injuries",
    clubs.every(whole) && clubs.filter((c) => c.kind === "ai").every((c) => !!c.continent && !!c.primaryColor), JSON.stringify(clubs[1]).slice(0, 200));

  // ── 2. The Sort menu ──────────────────────────────────────────────────────
  console.log("\n2. THE SORT MENU AND THE MENU ENTRY");
  const page = FE("pages/clubs.tsx"), shell = FE("components/layout/shell.tsx");
  const sorts = ["richest", "poorest", "successful", "injuryProne", "continent", "name"];
  check("(source) six orders: richest, poorest, most successful, most injury-prone, continent, name",
    sorts.every((k) => new RegExp(`\\b${k}:\\s*\\{ label:`).test(page)) && /label: "Most successful"/.test(page) && /label: "Most injury-prone"/.test(page));
  check("(source) most successful is the World Tour ladder position, then ranking points, then the regional position",
    /successful:[^\n]*\(a\.ladderPosition \?\? 999\) - \(b\.ladderPosition \?\? 999\) \|\| b\.points - a\.points \|\| \(a\.regionalPosition \?\? 999\) - \(b\.regionalPosition \?\? 999\)/.test(page));
  check("(source) Clubs is in the side menu between Finances and Career",
    shell.indexOf('id: "finances"') < shell.indexOf('id: "clubs"') && shell.indexOf('id: "clubs"') < shell.indexOf('id: "career"') && /label: "Clubs"/.test(shell));
  check("(source) the player's own club opens his Club page", /navigate\(c\.kind === "mine" \? "\/club" : `\/clubs\/\$\{c\.id\}`\)/.test(page));

  // Into the season: Jan 8's staff and the first World Tour matches.
  const today = async () => (await W.api("GET", "/calendar")).data?.currentDate ?? "";
  for (let i = 0; i < 70 && (await today()) < "2026-02-20"; i++) await W.day();
  const after = (await W.api("GET", "/clubs")).data.clubs;
  const ranks = after.map((c) => c.ladderPosition).filter((r) => r != null);
  const field = W.q(`SELECT COUNT(*) n FROM competitor_rankings WHERE career_save_id = ? AND season_year = 2026`, cid)[0].n;
  check("after the first World Tour rounds every club in the World Tour field has its ladder position, each once",
    ranks.length === field && field > 0 && new Set(ranks).size === ranks.length, `${ranks.length} positions, ${field} in the field`);
  // Each continent's league: positions 1 to n, each once (its most recent league season with results).
  const byContinent = new Map();
  for (const c of after.filter((c) => c.kind === "ai" && Number.isInteger(c.regionalPosition))) byContinent.set(c.continent, [...(byContinent.get(c.continent) ?? []), c.regionalPosition]);
  const ranked = [...byContinent.values()].every((l) => l.length > 0 && [...l].sort((a, b) => a - b).every((v, i) => v === i + 1));
  check("each regional league's clubs have their positions, 1 to n, and the player's club none (it plays no regional league)",
    byContinent.size === 6 && ranked && after.find((c) => c.kind === "mine")?.regionalPosition === null,
    [...byContinent].map(([k, l]) => `${k} ${l.length}`).join(", "));
  const played = after.filter((c) => c.kind === "ai" && c.wins + c.losses > 0);
  check("and a record", played.length > 0, `${played.length} AI clubs have played`);

  // ── 3. An AI club's Players ───────────────────────────────────────────────
  console.log("\n3. AN AI CLUB'S PLAYERS");
  const ai = played[0];
  const detail = (await W.api("GET", `/clubs/${ai.id}`)).data;
  check("its seniors: at least two, each with her role, contract end date and wage",
    detail?.seniors?.length >= 2 && detail.seniors.every((p) => !!p.role && /^\d{4}-\d{2}-\d{2}/.test(p.contractEndDate ?? "") && p.wage > 0 && p.wagePer === "month"),
    JSON.stringify(detail?.seniors?.[0]).slice(0, 200));
  check("its academy youths, each with her age, role and weekly wage", detail?.youths?.length > 0 && detail.youths.every((p) => p.youth && p.age > 0 && p.wagePer === "week"),
    `${detail?.youths?.length} youths`);
  check("its manager (face, name, speciality)", detail?.manager == null || (!!detail.manager.image && !!detail.manager.name && !!detail.manager.speciality),
    JSON.stringify(detail?.manager));
  check("its record and its last 5 World Tour results, with scores",
    detail?.wins + detail?.losses === ai.wins + ai.losses && detail.lastFive.length === Math.min(5, ai.wins + ai.losses)
      && detail.lastFive.every((r) => /^\d-\d$/.test(r.score) && !!r.opponent), JSON.stringify(detail?.lastFive?.[0]));
  const injured = W.q(`SELECT s.player_id id, s.injury_status st, s.injury_weeks_remaining w FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND s.team_id IS NULL AND p.player_type = 'senior' AND s.is_injured = 1 LIMIT 1`, cid)[0];
  if (injured) {
    const club = W.q(`SELECT pool_team_id c FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, injured.id)[0].c;
    const row = (await W.api("GET", `/clubs/${club}`)).data.seniors.find((p) => p.id === injured.id);
    check("an injured senior shows her injury and weeks out", row?.injury?.name === injured.st && row.injury.weeksOut === Math.ceil(injured.w), JSON.stringify(row?.injury));
  } else W.info("no AI senior injured yet: the injury line is not checked");

  // ── 4. Staff & Medical ────────────────────────────────────────────────────
  console.log("\n4. STAFF & MEDICAL");
  check("every staff member with role, skill, wage and contract end date (a coach and a medic since Jan 8)",
    detail?.staff?.length >= 1 && detail.staff.every((m) => !!m.role && m.skill > 0 && m.wage > 0 && /^\d{4}-\d{2}-\d{2}/.test(m.contractEndDate ?? "")),
    JSON.stringify(detail?.staff));

  // ── 5. Scouting ───────────────────────────────────────────────────────────
  console.log("\n5. SCOUTING: \"?\" UNTIL HER REPORT IS IN");
  const target = detail.seniors.find((p) => !p.revealed);
  check("an unscouted senior shows no rating (\"?\") and no attributes on her card",
    !!target && target.rating === null && (await W.api("GET", "/players/market-all")).data.find((p) => p.id === target.id)?.power == null);
  await W.hire("Scout", 80, cid);
  const sent = await W.api("POST", `/players/${target.id}/scout`, {});
  for (let i = 0; i < 6; i++) await W.day();
  const seen = (await W.api("GET", `/clubs/${ai.id}`)).data.seniors.find((p) => p.id === target.id);
  check("scouted through the market's route, her rating shows once the report is in", sent.status < 300 && seen?.revealed === true && typeof seen.rating === "number",
    `HTTP ${sent.status}, rating ${seen?.rating}`);
  const youth = detail.youths.find((p) => !p.revealed);
  check("an unscouted youth shows \"?\" too", !youth || youth.rating === null);

  // ── 6. The same card ──────────────────────────────────────────────────────
  console.log("\n6. EACH SENIOR ON HER PLAYER MARKET CARD");
  const players = FE("pages/players.tsx");
  check("(source) the page shows each senior on the market's own card, with its Watch star, Scout and Buy handlers",
    /<MarketPlayerCard player=\{card\} onSign=\{actions\.handleSign\} onScout=\{actions\.handleScout\} onWatch=\{actions\.handleWatch\}/.test(page)
      && /export function useMarketActions\(\)/.test(players) && /export function MarketPlayerCard\(/.test(players));
  check("an unknown club is refused", (await W.api("GET", "/clubs/999999")).status === 404);
} catch (err) {
  W.fail(err);
} finally {
  await W.stop();
}
W.finish();
