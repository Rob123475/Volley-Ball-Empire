/**
 * Overnight brief 30 Sep, C15 — the youth loan market.
 *
 * Rob's proof: a harness for listing, borrowing, the 50/50 wage split each
 * week, and the return at the term's end. Asserted on a starter-DB copy, in a
 * new career:
 *   court time   the academy's youth team is 3 and a reserve develops at half
 *                the youth team's rate (same stats, same potential, one match)
 *   AI academies every AI club keeps an academy (a youth team of 3 and a
 *                reserve), made by the intake's rule; AI youths are not free
 *                agents (not in the youth market, cannot be signed)
 *   listing      only a reserve can be listed; the listing shows to others
 *   AI borrows   a strong listed youth of the player's is borrowed by an AI club
 *                by its need; she plays there (pool club), 12 months at 16
 *   50/50        each week of her loan the player's ledger carries half her wage
 *                ("on loan to"), the AI club pays the other half, and the halves
 *                add to her wage; both are counted on the loan week by week
 *   no recall    there is no recall route, an active loan cannot be unlisted,
 *                and she cannot be signed back
 *   return       on the end date she is back in the player's academy, a reserve
 *   borrowing    the player borrows an AI club's youth: confirm required; she
 *                joins the youth team; the player's ledger carries half ("from")
 *   cap          a full academy cannot borrow; her own youths out on loan count
 *   AI market    over the weeks AI clubs list and borrow among themselves, never
 *                both sides of one loan, no academy past 6
 *   page         Team > Youth Loans exists, with the confirm text and no recall
 *
 * Usage: node harness/youth-loans.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { healAllSquads } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PORT = 4961;
const BASE = `http://localhost:${PORT}/api`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-youth-loans-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, C15: THE YOUTH LOAN MARKET");
console.log("=".repeat(72));

let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await res.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: res.status, data };
}
const WAGE = { Low: 50, Average: 75, High: 100, Elite: 150, Generational: 250 };

const dbFile = path.join(WORK, "loans.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { d.prepare(sql).run(...a); } finally { d.close(); } };

const fd = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out: fd,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "loans", STARTER_DB_PATH: SHIPPED } });
try {
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const prof = await api("POST", "/profiles", { name: "Loans" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Loans", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const teamId = (await api("GET", "/team")).data?.id;
  const cid = q(`SELECT id AS c FROM career_saves ORDER BY id DESC LIMIT 1`)[0].c;
  w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, teamId);
  const today = async () => (await api("GET", "/calendar")).data?.currentDate;
  const day = async () => {
    healAllSquads(dbFile);
    const r = await api("POST", "/calendar/advance", {});
    if (r.data?.blocked === "pending_match") { await api("POST", `/matches/${r.data.pendingMatchId}/simulate`); await api("POST", "/calendar/dismiss-match"); return day(); }
    if (r.data?.matchDay?.matchId) { await api("POST", `/matches/${r.data.matchDay.matchId}/simulate`); await api("POST", "/calendar/dismiss-match"); }
    return r;
  };
  // A salary week has run when a new weekly sponsor line is on the ledger.
  const weeks = () => q(`SELECT COUNT(*) AS n FROM finance_transactions WHERE team_id = ? AND description LIKE 'Weekly sponsor%'`, teamId)[0].n;
  const week = async () => { const n = weeks(); for (let i = 0; i < 10 && weeks() === n; i++) await day(); };

  // ── AI academies ─────────────────────────────────────────────────────────
  console.log("\n1. AI ACADEMIES");
  await week();
  const aiClubs = q(`SELECT pool_team_id AS id FROM career_pool_team_state WHERE career_save_id = ? AND taken_over_at IS NULL`, cid).map((r) => r.id);
  const aiYouth = q(`SELECT s.pool_team_id AS club, s.academy_role AS role, s.player_id AS id FROM career_player_state s JOIN players p ON p.id = s.player_id
    WHERE s.career_save_id = ? AND s.pool_team_id IS NOT NULL AND p.player_type = 'youth' AND s.is_promoted = 0`, cid);
  const byClub = new Map(); for (const y of aiYouth) { if (!byClub.has(y.club)) byClub.set(y.club, []); byClub.get(y.club).push(y); }
  // The first week already fills, lists and borrows, so a club's own academy is
  // who plays there, less the youths on loan in, plus its own out on loan.
  const loans0 = q(`SELECT owner_pool_team_id AS o, borrower_pool_team_id AS b FROM youth_loans WHERE career_save_id = ? AND status = 'active'`, cid);
  const own = (c) => (byClub.get(c) ?? []).length - loans0.filter((l) => l.b === c).length + loans0.filter((l) => l.o === c).length;
  const shapes = aiClubs.map((c) => `${own(c)} own, youth team ${(byClub.get(c) ?? []).filter((y) => y.role === "youth_team").length}`);
  check("every AI club keeps an academy of 4 (its own youths, wherever they play), a youth team of 3",
    aiClubs.length > 0 && shapes.every((s) => s === "4 own, youth team 3"),
    `${aiClubs.length} clubs, ${aiYouth.length} youths, ${loans0.length} already on loan; ${[...new Set(shapes)].join("; ")}`);
  const pool = (await api("GET", "/players/youth-pool")).data ?? [];
  const poolList = Array.isArray(pool) ? pool : (pool.players ?? []);
  const aiIds = new Set(aiYouth.map((y) => y.id));
  check("an AI club's youth is not in the youth market", poolList.length > 0 && !poolList.some((p) => aiIds.has(p.id)), `${poolList.length} in the market`);
  const tryAi = await api("POST", "/contracts", { playerId: aiYouth[0].id, salary: 500, endDate: "2027-12-31", bonusPerWin: 0, squadRole: "reserve", confirm: true });
  check("and cannot be signed: she is at an AI club's academy", tryAi.status === 422 && /AI club's academy/.test(tryAi.data?.error ?? ""), `${tryAi.status}: ${tryAi.data?.error}`);
  const aiListed = q(`SELECT COUNT(*) AS n FROM youth_loans WHERE career_save_id = ? AND status = 'listed' AND owner_pool_team_id IS NOT NULL`, cid)[0].n;
  check("the AI clubs list their reserves (no court time) for loan", aiListed > 0, `${aiListed} listed`);

  // ── The player's academy and court time ──────────────────────────────────
  console.log("\n2. THE PLAYER'S ACADEMY: COURT TIME");
  const four = poolList.slice(0, 4).map((p) => p.id);
  for (const [i, id] of four.entries()) {
    // Four youths into the academy, the same stats and potential; the fourth the weakest.
    const v = i === 3 ? 40 : 60;
    w(`UPDATE career_player_state SET team_id = ?, squad_role = 'reserve', is_active = 0, academy_contract_years = 2, academy_role = NULL, age = 16,
       speed = ?, power = ?, defense = ?, serve = ?, block = ?, training_points = 0, training_focus = NULL WHERE career_save_id = ? AND player_id = ?`, teamId, v, v, v, v, v, cid, id);
    w(`UPDATE players SET potential = 'High' WHERE id = ?`, id);
  }
  let view = (await api("GET", "/youth-loans")).data;
  const role = (id) => view.academy.find((a) => a.playerId === id)?.academyRole;
  check("the academy's youth team is its best 3; the 4th is a reserve", view.academy.length === 4 && [0, 1, 2].every((i) => role(four[i]) === "youth_team") && role(four[3]) === "reserve",
    view.academy.map((a) => `${a.name} ${a.rating} ${a.academyRole}`).join(" | "));
  // Same stats for the reserve and one youth-team player, then one senior match.
  w(`UPDATE career_player_state SET speed = 60, power = 60, defense = 60, serve = 60, block = 60 WHERE career_save_id = ? AND player_id = ?`, cid, four[3]);
  const tp = () => Object.fromEntries(q(`SELECT player_id AS id, training_points AS t FROM career_player_state WHERE career_save_id = ? AND player_id IN (${four.join(",")})`, cid).map((r) => [r.id, r.t]));
  const before = tp();
  // To the next match day (the World Tour starts in February), and play it.
  healAllSquads(dbFile);
  const md = (await api("POST", "/calendar/next-match")).data?.matchDay;
  const sim = md?.matchId ? await api("POST", `/matches/${md.matchId}/simulate`) : null;
  await api("POST", "/calendar/dismiss-match");
  const played = sim?.status === 200;
  // The academy's week runs after the match, off the request: wait for it.
  let after = tp();
  for (let i = 0; i < 60 && after[four[0]] === before[four[0]]; i++) { await new Promise((r) => setTimeout(r, 500)); after = tp(); }
  await new Promise((r) => setTimeout(r, 500)); after = tp();
  const full = after[four[0]] - before[four[0]], half = after[four[3]] - before[four[3]];
  check("with the same stats and potential, a reserve develops at half the youth team's rate", played && full > 0 && half === Math.round(full * 0.5),
    `youth team +${full} XP, reserve +${half} XP`);

  // ── Listing ──────────────────────────────────────────────────────────────
  console.log("\n3. LISTING");
  const noYouthTeam = await api("POST", "/youth-loans/list", { playerId: four[0] });
  check("a youth-team player cannot be listed (she has court time)", noYouthTeam.status === 400, noYouthTeam.data?.error);
  // Make the reserve the best youth anywhere, so an AI club needs her.
  w(`UPDATE career_player_state SET speed = 95, power = 95, defense = 95, serve = 95, block = 95 WHERE career_save_id = ? AND player_id = ?`, cid, four[3]);
  w(`UPDATE career_player_state SET academy_role = 'reserve' WHERE career_save_id = ? AND player_id = ?`, cid, four[3]);
  const listed = await api("POST", "/youth-loans/list", { playerId: four[3] });
  view = (await api("GET", "/youth-loans")).data;
  check("a reserve is listed", listed.status === 201 && view.academy.find((a) => a.playerId === four[3])?.listed === true, `${listed.status} ${listed.data?.error ?? ""}`);
  const twice = await api("POST", "/youth-loans/list", { playerId: four[3] });
  check("and not twice", twice.status === 400, twice.data?.error);

  // ── An AI club borrows her ─────────────────────────────────────────────────
  console.log("\n4. AN AI CLUB BORROWS HER, BY ITS NEED");
  let loan = null;
  for (let i = 0; i < 4 && !loan; i++) {
    await week();
    loan = q(`SELECT * FROM youth_loans WHERE career_save_id = ? AND player_id = ? AND status = 'active'`, cid, four[3])[0] ?? null;
  }
  const herState = q(`SELECT team_id, pool_team_id, academy_role FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, four[3])[0];
  check("an AI club borrows her for 12 months (she is 16)", !!loan && loan.owner_team_id === teamId && loan.borrower_pool_team_id != null && loan.months === 12,
    loan ? `club ${loan.borrower_pool_team_id}, ${loan.starts_on} to ${loan.ends_on}` : "not borrowed in 4 weeks");
  check("she plays for the borrower: in its academy, in its youth team", herState?.team_id == null && herState?.pool_team_id === loan?.borrower_pool_team_id && herState?.academy_role === "youth_team",
    JSON.stringify(herState));
  view = (await api("GET", "/youth-loans")).data;
  check("the page lists her on loan out", view.out.some((l) => l.playerId === four[3]), view.out.map((l) => `${l.name} to ${l.club}`).join(", "));
  const banner = (await api("GET", "/team/roster")).data?.academy;
  check("the Team page's academy count still holds her while she is away (she comes back)", banner?.size === 4 && view.academySize === 4,
    `banner ${JSON.stringify(banner)}, Youth Loans ${view.academySize}`);

  // ── The 50/50 split, each week ─────────────────────────────────────────────
  console.log("\n5. THE WAGE, 50/50, EACH WEEK");
  const wage = WAGE.High;
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const was = q(`SELECT owner_paid AS o, borrower_paid AS b FROM youth_loans WHERE id = ?`, loan.id)[0];
    const seen = new Set(q(`SELECT id FROM finance_transactions WHERE team_id = ?`, teamId).map((r) => r.id));
    await week();
    const now = q(`SELECT owner_paid AS o, borrower_paid AS b FROM youth_loans WHERE id = ?`, loan.id)[0];
    const line = q(`SELECT id, amount, description FROM finance_transactions WHERE team_id = ? AND description LIKE 'Youth loan:%'`, teamId).filter((r) => !seen.has(r.id));
    rows.push({ owner: now.o - was.o, borrower: now.b - was.b, line });
  }
  check("each week the player's ledger carries half her wage, on loan to the AI club",
    rows.every((r) => r.line.length === 1 && Number(r.line[0].amount) === Math.ceil(wage / 2) && /on loan to /.test(r.line[0].description)),
    rows.map((r) => r.line.map((l) => `${l.amount}: ${l.description}`).join("; ")).join(" | "));
  check("and the AI club pays the other half; the halves add to her wage, every week",
    rows.every((r) => r.owner === Math.ceil(wage / 2) && r.borrower === Math.floor(wage / 2) && r.owner + r.borrower === wage),
    rows.map((r) => `$${r.owner} + $${r.borrower}`).join(", "));
  const acadLine = q(`SELECT description FROM finance_transactions WHERE team_id = ? AND description LIKE 'Weekly player salaries%' ORDER BY id DESC LIMIT 1`, teamId)[0]?.description;
  check("her wage is not on the academy's own line as well (3 at the club)", /3 in the academy/.test(acadLine ?? ""), acadLine);

  // ── No recall ─────────────────────────────────────────────────────────────
  console.log("\n6. NO EARLY RECALL");
  const recall = await api("POST", "/youth-loans/recall", { playerId: four[3] });
  const unlist = await api("POST", "/youth-loans/unlist", { playerId: four[3] });
  const signBack = await api("POST", "/contracts", { playerId: four[3], salary: 500, endDate: "2027-12-31", bonusPerWin: 0, squadRole: "reserve", confirm: true });
  check("there is no recall route, an active loan cannot be taken off the list, and she cannot be signed back",
    recall.status === 404 && unlist.status === 400 && signBack.status === 422, `recall ${recall.status}, unlist ${unlist.status}, sign ${signBack.status}`);

  // ── The return ─────────────────────────────────────────────────────────────
  console.log("\n7. SHE COMES BACK ON THE END DATE");
  const t0 = await today();
  const end = new Date(`${t0}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 2);
  const endsOn = end.toISOString().slice(0, 10);
  w(`UPDATE youth_loans SET ends_on = ? WHERE id = ?`, endsOn, loan.id); // the harness moves the 12 months on
  await day();
  const dayBefore = q(`SELECT status FROM youth_loans WHERE id = ?`, loan.id)[0].status;
  for (let i = 0; i < 3 && q(`SELECT status FROM youth_loans WHERE id = ?`, loan.id)[0].status === "active"; i++) await day();
  const back = q(`SELECT team_id, pool_team_id, academy_role FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, cid, four[3])[0];
  const status = q(`SELECT status FROM youth_loans WHERE id = ?`, loan.id)[0].status;
  check("still away the day before; back on the end date, in the player's academy", dayBefore === "active" && status === "returned" && back.team_id === teamId && back.pool_team_id == null,
    `before: ${dayBefore}; on ${endsOn}: ${status}, ${JSON.stringify(back)}`);

  // ── The player borrows ─────────────────────────────────────────────────────
  console.log("\n8. THE PLAYER BORROWS AN AI CLUB'S YOUTH");
  view = (await api("GET", "/youth-loans")).data;
  const pick = view.available.find((l) => l.allowedMonths.includes(6));
  const noConfirm = await api("POST", "/youth-loans/borrow", { loanId: pick?.loanId, months: 6 });
  check("borrowing needs the confirm step", noConfirm.status === 400 && /Confirm/.test(noConfirm.data?.error ?? ""), noConfirm.data?.error);
  const got = await api("POST", "/youth-loans/borrow", { loanId: pick?.loanId, months: 6, confirm: true });
  view = (await api("GET", "/youth-loans")).data;
  const inRow = view.academy.find((a) => a.playerId === pick?.playerId);
  // The youth team is full (3), so she joins the reserves and the manager chooses who plays.
  check("confirmed, she joins the player's academy on loan for 6 months: in the reserves, the youth team being full",
    got.status === 201 && got.data?.months === 6 && inRow?.onLoanFrom?.club === pick?.club && inRow?.academyRole === "reserve"
      && view.academy.filter((a) => a.academyRole === "youth_team").length === 3,
    `${got.status} ${got.data?.error ?? ""} ${inRow ? `${inRow.name}: ${inRow.academyRole}, from ${inRow.onLoanFrom?.club} until ${inRow.onLoanFrom?.endsOn}` : ""}`);
  const inWage = got.data?.weeklyWage;
  const seen2 = new Set(q(`SELECT id FROM finance_transactions WHERE team_id = ?`, teamId).map((r) => r.id));
  const was2 = q(`SELECT owner_paid AS o, borrower_paid AS b FROM youth_loans WHERE id = ?`, got.data?.loanId)[0];
  await week();
  const now2 = q(`SELECT owner_paid AS o, borrower_paid AS b FROM youth_loans WHERE id = ?`, got.data?.loanId)[0];
  const line2 = q(`SELECT id, amount, description FROM finance_transactions WHERE team_id = ? AND description LIKE 'Youth loan:%'`, teamId).filter((r) => !seen2.has(r.id));
  check("a week on: the player's ledger carries her half, on loan from the AI club, and the AI club the other half",
    line2.length === 1 && Number(line2[0].amount) === Math.floor(inWage / 2) && /on loan from /.test(line2[0].description)
      && now2.b - was2.b === Math.floor(inWage / 2) && now2.o - was2.o === Math.ceil(inWage / 2),
    `${line2.map((l) => `${l.amount}: ${l.description}`).join("; ")}; owner +${now2.o - was2.o}, borrower +${now2.b - was2.b} of $${inWage}`);

  // ── The cap ────────────────────────────────────────────────────────────────
  console.log("\n9. THE CAP");
  const more = poolList.slice(4, 5).map((p) => p.id);
  for (const id of more) w(`UPDATE career_player_state SET team_id = ?, squad_role = 'reserve', academy_contract_years = 2, age = 16 WHERE career_save_id = ? AND player_id = ?`, teamId, cid, id);
  view = (await api("GET", "/youth-loans")).data;
  const another = view.available.find((l) => l.allowedMonths.includes(6));
  const full6 = await api("POST", "/youth-loans/borrow", { loanId: another?.loanId, months: 6, confirm: true });
  check("with 6 in the academy (one on loan in) the club cannot borrow another", view.academySize === 6 && full6.status === 400 && /full/.test(full6.data?.error ?? ""),
    `${view.academySize} of ${view.cap}; ${full6.status} ${full6.data?.error}`);

  // ── The AI market over the weeks ─────────────────────────────────────────
  console.log("\n10. THE AI CLUBS' MARKET");
  for (let i = 0; i < 3; i++) await week();
  const all = q(`SELECT * FROM youth_loans WHERE career_save_id = ?`, cid);
  const aiToAi = all.filter((l) => l.owner_pool_team_id != null && l.borrower_pool_team_id != null);
  check("AI clubs borrow from each other by their needs", aiToAi.length > 0, `${aiToAi.length} AI-to-AI loans of ${all.length} rows`);
  check("never both sides of one loan", all.every((l) => !(l.owner_pool_team_id != null && l.owner_pool_team_id === l.borrower_pool_team_id) && !(l.owner_team_id != null && l.owner_team_id === l.borrower_team_id)));
  const sizes = aiClubs.map((c) => q(`SELECT COUNT(*) AS n FROM career_player_state WHERE career_save_id = ? AND pool_team_id = ?`, cid, c)[0].n
    + q(`SELECT COUNT(*) AS n FROM youth_loans WHERE career_save_id = ? AND owner_pool_team_id = ? AND status = 'active'`, cid, c)[0].n);
  check("no AI academy past 6 (its youths away on loan counted)", Math.max(...sizes) <= 6, `largest ${Math.max(...sizes)}`);

  // ── The page ─────────────────────────────────────────────────────────────
  console.log("\n11. TEAM > YOUTH LOANS");
  const hub = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/team-hub.tsx"), "utf8");
  const page = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/youth-loans.tsx"), "utf8");
  check("the Team page has a Youth Loans tab; the page lists, borrows with a confirm, and has no recall",
    /label: "Youth Loans"/.test(hub) && /<YouthLoans \/>/.test(hub) && /\/api\/youth-loans\/borrow/.test(page) && /confirm: true/.test(page)
      && /neither club can end the loan early/.test(page) && !/recall/i.test(page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(fd); } catch { /* closed */ }
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
