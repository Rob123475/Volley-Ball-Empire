/**
 * Overnight brief 1 Oct, N-44 (b) (Rob, 1 Oct): one contract box. Signing a
 * scout's find showed only "Sign for $1,800"; it now goes through the same box
 * as a market youth: her price and wage, 6 months / 1 season / 2 seasons, the
 * academy's Youth Team or Reserves, and the confirm.
 *
 * Asserted on a new career (starter save): a find cannot be signed without the
 * confirm, which names her price; signed for 6 months into the reserves, her
 * contract starts on the game date and ends where a 6-month contract ends, she
 * is a reserve, and her price is a "Signing fee" on the ledger; one signed for
 * the youth team goes there while it has a place and to the reserves once it
 * is full (3); a market youth signed through POST /contracts goes where the box
 * says too. Both pages that sign finds use the shared box.
 *
 * Usage: node harness/youth-contract-box.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-youth-box-"));
const PORT = 4563;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 1 OCT, N-44 (b): ONE CONTRACT BOX FOR A SCOUT'S FIND");
console.log("=".repeat(72));

let cookie = "";
async function api(method, p, body) {
  const res = await fetch(BASE + p, {
    method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  const text = await res.text(); let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const dbFile = path.join(WORK, "save.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT), NODE_ENV: "development",
    SESSION_SECRET: "youth-box", STARTER_DB_PATH: SHIPPED },
});
const q = (sql, ...a) => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare(sql).all(...a); } finally { d.close(); } };
const w = (sql, ...a) => { const d = new DatabaseSync(dbFile); try { return d.prepare(sql).run(...a); } finally { d.close(); } };

try {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  const prof = await api("POST", "/profiles", { name: "Youth Box" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const club = ((await api("GET", "/club-templates")).data?.clubs ?? []).find((c) => c.name === "Sydney Riptide");
  await api("POST", "/careers", { slotNumber: 1, managerName: "Youth Box", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const team = (await api("GET", "/team")).data;
  const careerSaveId = ((await api("GET", "/careers")).data?.saves ?? []).find((s) => s.teamId === team.id)?.id;
  w(`UPDATE teams SET budget = 5000000 WHERE id = ?`, team.id);
  const regions = ((await api("GET", "/continental-scouting/regions")).data ?? []).map((r) => r.id ?? r.region?.id).filter(Boolean);
  const offer = ((await api("GET", "/staff/market?role=scout")).data ?? []).find((m) => /scout/i.test(m.role));
  await api("POST", "/staff", { staffId: offer?.id, length: "2s" });
  const scout = ((await api("GET", "/staff")).data ?? []).find((s) => /^scout$/i.test(s.role));
  const finds = [];
  for (let round = 0; round < 6 && finds.length < 6; round++) {
    for (const region of regions) {
      const st = await api("POST", "/continental-scouting/start", { region, durationMonths: 1, staffId: scout.id });
      if (st.status !== 201) continue;
      await api("POST", `/continental-scouting/missions/${st.data.id}/dev-complete`);
      finds.push(...((await api("POST", `/continental-scouting/missions/${st.data.id}/collect`)).data?.prospects ?? []));
    }
  }
  check("enough finds to sign", finds.length >= 5, `${finds.length}`);
  const role = (playerName) => q(`SELECT s.academy_role AS r, s.contract_end_date AS e FROM career_player_state s JOIN players p ON p.id = s.player_id
                                   WHERE s.career_save_id = ? AND s.team_id = ? AND p.name = ?`, careerSaveId, team.id, playerName)[0];
  await api("GET", "/calendar");
  const gd = q(`SELECT * FROM calendar_state WHERE team_id = ?`, team.id)[0].current_date;

  // 1. The confirm.
  const a = finds[0];
  const noConfirm = await api("POST", `/youth-scouting/prospects/${a.id}/sign`, { length: "6m", academyRole: "reserve" });
  check("a find cannot be signed without the confirm, which names her price", noConfirm.status === 400 && noConfirm.data?.error?.includes(`$${a.signingCost.toLocaleString()}`),
    `${noConfirm.status}: ${noConfirm.data?.error}`);
  check("...and the box knows her wage before she signs (the academy's for her talent)", Number(a.wage) > 200 && Number(a.wage) < 1100, `$${Math.round(a.wage)} a month`);

  // 2. Six months, the reserves.
  const b0 = Number((await api("GET", "/team")).data?.budget);
  const s1 = await api("POST", `/youth-scouting/prospects/${a.id}/sign`, { length: "6m", academyRole: "reserve", confirm: true });
  const b1 = Number((await api("GET", "/team")).data?.budget);
  const c1 = q(`SELECT c.start_date AS s, c.end_date AS e, c.salary FROM contracts c JOIN players p ON p.id = c.player_id WHERE p.name = ? AND c.team_id = ?`, a.name, team.id)[0];
  const fee = q(`SELECT description, category FROM finance_transactions WHERE team_id = ? AND description LIKE ?`, team.id, `Signing fee: ${a.name}%`)[0];
  const sixMonths = new Date(`${gd}T00:00:00Z`); sixMonths.setUTCMonth(sixMonths.getUTCMonth() + 6);
  check("signed for 6 months into the reserves: a contract from the game date, ending six months on, and a reserve",
    s1.status < 300 && c1?.s === gd && Math.abs(Date.parse(c1.e) - sixMonths.getTime()) <= 3 * 86400000 && role(a.name)?.r === "reserve" && s1.data?.academyPlace === "reserve",
    `HTTP ${s1.status} ${s1.data?.error ?? ""}; ${c1?.s} to ${c1?.e}; ${role(a.name)?.r}`);
  check("her price is charged and on the ledger as a signing fee", b0 - b1 === a.signingCost && fee?.category === "signing_fee",
    `-$${b0 - b1} for $${a.signingCost}; "${fee?.description}"`);

  // 3. The youth team, while it has a place.
  const placed = [];
  for (const f of finds.slice(1, 5)) {
    const r = await api("POST", `/youth-scouting/prospects/${f.id}/sign`, { length: "1s", academyRole: "youth_team", confirm: true });
    placed.push({ name: f.name, status: r.status, place: r.data?.academyPlace, role: role(f.name)?.r });
  }
  const team3 = placed.slice(0, 3), fourth = placed[3];
  check("signed for the youth team: the first three go there", team3.every((p) => p.status < 300 && p.place === "youth_team" && p.role === "youth_team"),
    team3.map((p) => `${p.name}: ${p.role}`).join(", "));
  check("with the youth team full (3), the next starts in the reserves, and the response says so", fourth && fourth.status < 300 && fourth.place === "reserve" && fourth.role === "reserve",
    fourth ? `${fourth.name}: ${fourth.place}` : "no fourth");

  // 4. A market youth through POST /contracts: the same choice.
  const market = ((await api("GET", "/players/youth-pool")).data ?? []).filter((p) => p.teamId == null);
  const m = market[0];
  const sm = await api("POST", "/contracts", { playerId: m?.id, salary: 0, bonusPerWin: 0, length: "2s", squadRole: "reserve", academyRole: "reserve", confirm: true });
  const mr = q(`SELECT academy_role AS r FROM career_player_state WHERE career_save_id = ? AND player_id = ?`, careerSaveId, m?.id)[0];
  check("a market youth signed through the box goes where it says (reserves here)", sm.status === 201 && sm.data?.academyPlace === "reserve" && mr?.r === "reserve",
    `HTTP ${sm.status} ${sm.data?.error ?? ""}; ${mr?.r}`);

  // 5. The pages.
  const page = (f) => fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src", f), "utf8");
  check("both pages that sign finds use the shared contract box, and the box offers a youth Youth Team or Reserves",
    ["pages/continental-scouting.tsx", "pages/youth-academy.tsx"].every((f) => /<ContractModal\s+player=\{findAsSigning\(/.test(page(f)) && !/Sign for \$\{/.test(page(f)))
    && /pages\/players\.tsx/.test("pages/players.tsx") && /import \{ ContractModal/.test(page("pages/players.tsx"))
    && /\{ role: "youth_team", label: "Youth Team" \}/.test(page("components/contract-offer-dialog.tsx")) && /\{ role: "reserve",\s+label: "Reserves" \}/.test(page("components/contract-offer-dialog.tsx")));
} catch (err) {
  check("the run completed", false, String(err?.stack ?? err));
} finally {
  await stopServer(child);
}
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else fs.rmSync(WORK, { recursive: true, force: true });
process.exit(failures > 0 ? 1 : 0);
