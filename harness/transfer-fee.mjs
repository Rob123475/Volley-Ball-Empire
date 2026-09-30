/**
 * Overnight brief 30 Sep, item 32 — the transfer fee goes to the selling club.
 *
 * Rob, 30 Sep (Q-8): when a player is bought from another club, the fee is
 * paid to that club; the price scale stays one month of her wage ±15%.
 * It was charged to the buyer and paid to nobody.
 *
 * In the game as it stands no AI club owns a player the market can sell: AI
 * clubs field pool players, who are not on the market. So the selling club is
 * made here, on this harness's own DB copy: a second club holding a player
 * whose contract ends inside the 6-month transfer window.
 *
 * Asserted: buying her needs the confirm step naming her price (one month of
 * her wage ±15%); the buyer pays exactly that price and its ledger says so;
 * the selling club's balance rises by the same amount and its ledger has a
 * "Transfer fee" income row; a free agent's price still goes to nobody.
 *
 * Usage: node harness/transfer-fee.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const PORT = 4936;
const BASE = `http://localhost:${PORT}/api`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-transfer-"));
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 32: THE TRANSFER FEE GOES TO THE SELLING CLUB");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "transfer.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { return d.prepare(sql).run(...a); } finally { d.close(); } };
let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const t = await res.text(); let data = null; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: res.status, data };
}
const logFd = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({ server: SERVER, electron: requireElectronBinary(REPO), out: logFd,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "transfer" } });
try {
  for (let i = 0; i < 240; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const prof = await api("POST", "/profiles", { name: "Transfer" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Transfer", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const me = (await api("GET", "/team")).data;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? [])[0]?.id;
  const today = (await api("GET", "/calendar")).data?.currentDate;

  // The selling club, and her: under contract there to 30 days from now.
  const userId = q(`SELECT user_id AS u FROM teams WHERE id = ?`, me.id)[0].u;
  const sellerId = Number(w(`INSERT INTO teams (user_id, name, budget, created_at) VALUES (?, 'Seller Club', 250000, ?)`, userId, Math.floor(Date.now() / 1000)).lastInsertRowid);
  const ends = new Date(`${today}T00:00:00Z`); ends.setUTCDate(ends.getUTCDate() + 30);
  const her = q(`SELECT s.player_id AS id FROM career_player_state s JOIN players p ON p.id = s.player_id
                  WHERE s.career_save_id = ? AND s.team_id IS NULL AND p.player_type = 'senior' ORDER BY s.player_id LIMIT 1`, careerSaveId)[0].id;
  w(`UPDATE career_player_state SET team_id = ?, contract_end_date = ? WHERE career_save_id = ? AND player_id = ?`, sellerId, ends.toISOString().slice(0, 10), careerSaveId, her);
  const listed = ((await api("GET", "/players/market-all")).data ?? []).find((p) => p.id === her);
  check("she is on the market in the transfer window, at the other club", listed?.status === "transfer_available" && listed?.currentTeamId === sellerId, `${listed?.name}: ${listed?.status}, club ${listed?.currentTeamId}`);

  // Room for her: the squad is full (2 starters and 1 interchange).
  const mine = () => q(`SELECT s.player_id AS id FROM career_player_state s JOIN players p ON p.id = s.player_id
                         WHERE s.career_save_id = ? AND s.team_id = ? AND p.player_type = 'senior' AND s.squad_role = 'interchange'`, careerSaveId, me.id)[0]?.id;
  await api("POST", `/players/${mine()}/release`, {});
  const terms = { playerId: her, salary: 5000, bonusPerWin: 0, squadRole: "interchange", length: "1s" };
  const ask = await api("POST", "/contracts", terms);
  check("buying her needs the confirm step, which names her price range", ask.status === 400 && ask.data?.needsConfirm === true && ask.data?.priceRange?.low > 0, `${ask.status}: ${ask.data?.error}`);
  const sellerBefore = Number(q(`SELECT budget FROM teams WHERE id = ?`, sellerId)[0].budget);
  const meBefore = Number((await api("GET", "/team")).data?.budget);
  const bought = await api("POST", "/contracts", { ...terms, confirm: true });
  const fee = bought.data?.fee;
  const meAfter = Number((await api("GET", "/team")).data?.budget);
  const sellerAfter = Number(q(`SELECT budget FROM teams WHERE id = ?`, sellerId)[0].budget);
  const buyerRow = q(`SELECT amount, category, description FROM finance_transactions WHERE team_id = ? AND category = 'signing_fee'`, me.id);
  const sellerRow = q(`SELECT type, amount, category, description FROM finance_transactions WHERE team_id = ?`, sellerId);
  check("the buyer pays her price, on its ledger", bought.status === 201 && fee > 0 && meBefore - meAfter === fee && buyerRow.length === 1 && Number(buyerRow[0].amount) === fee,
    `HTTP ${bought.status} ${bought.data?.error ?? ""}; fee $${fee}; balance -$${meBefore - meAfter}`);
  check("the selling club receives exactly that fee, on its balance and its ledger",
    sellerAfter - sellerBefore === fee && sellerRow.length === 1 && sellerRow[0].type === "income" && Number(sellerRow[0].amount) === fee && sellerRow[0].category === "transfer_fee"
      && sellerRow[0].description === `Transfer fee: ${listed.name} sold to ${me.name}`,
    `seller $${sellerBefore} -> $${sellerAfter}; ${sellerRow.map((r) => `${r.type} ${r.category} $${r.amount} "${r.description}"`).join("; ")}`);
  check("the price is still one month of her wage ±15% (inside the range the confirm step named)", fee >= ask.data.priceRange.low && fee <= ask.data.priceRange.high,
    `$${fee} in $${ask.data.priceRange.low}-$${ask.data.priceRange.high}`);

  // A free agent: her price is paid to nobody.
  const freeOne = ((await api("GET", "/players/market-all")).data ?? []).find((p) => p.status === "free_agent");
  const incomeBefore = q(`SELECT COUNT(*) AS n FROM finance_transactions WHERE category = 'transfer_fee'`)[0].n;
  await api("POST", `/players/${mine()}/release`, {});
  const signFree = await api("POST", "/contracts", { playerId: freeOne.id, salary: 4000, bonusPerWin: 0, squadRole: "interchange", length: "1s", confirm: true });
  check("a free agent's price goes to nobody", (signFree.status === 201 || signFree.status === 422) && q(`SELECT COUNT(*) AS n FROM finance_transactions WHERE category = 'transfer_fee'`)[0].n === incomeBefore,
    `HTTP ${signFree.status} ${signFree.data?.error ?? ""}`);
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  try { await stopServer(child); } catch { /* stopped */ }
  try { fs.closeSync(logFd); } catch { /* closed */ }
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
