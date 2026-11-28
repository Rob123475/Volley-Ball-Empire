/**
 * 1.2 D6 (Rob, 23 Nov): the Exhibition Game, on a copy of the starter DB.
 *
 *   - the pick screen's options: the game's 60 continental clubs and their 120 players, the six
 *     venues, four times, four weathers, three difficulties, six cuts and eight prints, the
 *     accessories (all free);
 *   - a game that does not add up is refused (three players, the same player twice, a colour that is
 *     not a colour, a person 3 with no person 2...);
 *   - a good game: the court's view of it (/unity/exhibition-state) has both teams, the names as
 *     changed, the custom team's swimwear and the accessories, the seats, the venue, time, weather
 *     and difficulty, and the game's own odds;
 *   - it touches nothing in a career: no row in any table changes (a career is made first, so there
 *     is something to keep still);
 *   - with --unity, the court plays it (Assets/Editor/ExhibitionProof.cs): proof/D6.
 *
 * Usage: node harness/exhibition.mjs [--unity]
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";
import { startCareer } from "./harness-club.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-exhibition-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4955;
const BASE = `http://localhost:${PORT}/api`;
const UNITY = process.argv.includes("--unity");
const UNITY_EXE = "C:/Program Files/Unity/Hub/Editor/6000.3.16f1/Editor/Unity.exe";
const UNITY_PROJECT = process.env.VBE_UNITY_REPO ?? "C:/Users/rbonn/Game_Dev/VolleyBall Empire/volleyball";
const PROOF = path.join(REPO, "docs", "update-1.2", "proof");

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  1.2 D6: THE EXHIBITION GAME");
console.log("=".repeat(72));

fs.copyFileSync(SHIPPED, DB);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({ server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "exhibition", STARTER_DB_PATH: SHIPPED } });
let cookie = "";
async function call(method, p, body) {
  const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  let data; const t = await r.text(); try { data = JSON.parse(t); } catch { data = t; }
  return { status: r.status, data };
}
/** Every table's row count and a checksum of its rows: anything a game wrote would show. */
function snapshot() {
  const d = new DatabaseSync(DB, { readOnly: true });
  try {
    const tables = d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('sessions')").all().map((r) => r.name);
    return Object.fromEntries(tables.map((t) => [t, JSON.stringify(d.prepare(`SELECT * FROM "${t}"`).all()).length + ":" + d.prepare(`SELECT COUNT(*) n FROM "${t}"`).get().n]));
  } finally { d.close(); }
}

try {
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const prof = (await call("POST", "/profiles", { name: "Exhibition Proof" })).data;
  await call("POST", `/profiles/${prof.id}/select`);
  const club = (await call("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await startCareer(call, { managerFaceId: 8, slotNumber: 1, managerName: "Exhibition Proof", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });

  const o = (await call("GET", "/exhibition/options")).data;
  check("the options: 60 clubs, 120 players", o.teams?.length === 60 && o.players?.length === 120, `${o.teams?.length} clubs, ${o.players?.length} players`);
  check("six venues, four times, four weathers, three difficulties", o.venues?.length === 6 && o.times?.length === 4 && o.weathers?.length === 4 && o.difficulties?.length === 3, o.venues?.map((v) => v.key).join(", "));
  check("six cuts and eight prints", o.cuts?.length === 6 && o.prints?.length === 8, o.prints?.join(", "));
  check("the accessories, all free here", o.items?.length === 11, `${o.items?.length} items`);

  const [t1, t2] = [o.teams[0], o.teams[7]];
  const pl = (id) => o.players.find((p) => p.id === id);
  const game = {
    home: { poolTeamId: null, name: "Sunset Sirens", primary: "#ff7a00", secondary: "#ffffff", players: [
      { poolPlayerId: t1.players[0], name: "Kira Sands", swimwear: { cut: "swimsuit-1", print: "hibiscus", colourA: "#1f5fbf", colourB: "#f26aa3" }, wear: [{ itemId: "sun-hat", colour: "#f4e3c1" }, { itemId: "sunglasses", colour: "#222222", lens: "amber" }] },
      { poolPlayerId: t1.players[1], name: pl(t1.players[1]).name, swimwear: { cut: "bikini-3", print: "zebra", colourA: "#ffffff", colourB: "#111111" }, wear: [{ itemId: "bangle", colour: "#d4af37" }] },
    ] },
    away: { poolTeamId: t2.id, name: t2.name, primary: t2.primary, secondary: t2.secondary, players: [
      { poolPlayerId: t2.players[0], name: pl(t2.players[0]).name, wear: [] },
      { poolPlayerId: t2.players[1], name: pl(t2.players[1]).name, wear: [{ itemId: "earrings", colour: "#c0c0c8" }] },
    ] },
    venue: "europe", timeOfDay: "sunset", weather: "cloudy", difficulty: "hard", seats: [0, 1, 2, -1],
  };
  const bad = [
    ["three players on a team", { ...game, home: { ...game.home, players: [game.home.players[0]] } }],
    ["the same player twice", { ...game, away: { ...game.away, players: [game.away.players[0], { ...game.home.players[0] }] } }],
    ["a colour that is not a colour", { ...game, home: { ...game.home, primary: "orange" } }],
    ["a print that does not exist", { ...game, home: { ...game.home, players: [{ ...game.home.players[0], swimwear: { ...game.home.players[0].swimwear, print: "tartan" } }, game.home.players[1]] } }],
    ["a person 3 with no person 2", { ...game, seats: [0, 2, -1, -1] }],
    ["a venue that is not one of the six", { ...game, venue: "antarctica" }],
    ["sunglasses with a lens they do not come in (9a)", { ...game, home: { ...game.home, players: [{ ...game.home.players[0], wear: [{ itemId: "sunglasses", colour: "#222222", lens: "purple" }] }, game.home.players[1]] } }],
  ];
  for (const [what, g] of bad) { const r = await call("POST", "/exhibition", g); check(`refused: ${what}`, r.status === 400, `${r.status} ${JSON.stringify(r.data)}`); }

  const before = snapshot();
  const made = await call("POST", "/exhibition", game);
  check("a good game is made", made.status === 200 && typeof made.data.id === "string", JSON.stringify(made.data));
  const st = (await call("GET", `/unity/exhibition-state?id=${made.data.id}`)).data;
  check("the court's view: an exhibition, the two teams' names", st.exhibition === true && st.homeTeam === "Sunset Sirens" && st.awayTeam === t2.name, `${st.homeTeam} v ${st.awayTeam}`);
  check("the names as changed", st.players[0].name === "Kira Sands", st.players.map((p) => p.name).join(", "));
  check("the custom team's swimwear; a club team keeps its kit", st.players[0].swimwear?.print === "hibiscus" && st.players[1].swimwear?.cut === "bikini-3" && st.players[2].swimwear === null,
    `${JSON.stringify(st.players[0].swimwear)}; away ${st.players[2].primaryColor}/${st.players[2].secondaryColor}`);
  check("the accessories, as model parts and colours", st.players[0].wear.map((w) => w.part).join(",") === "SK_BG_HAT,SK_BG_SUNGLASSES" && st.players[3].wear[0]?.part === "SK_BG_EARRINGS", JSON.stringify(st.players[0].wear));
  check("9a: the sunglasses with their lens tint", st.players[0].wear[1]?.lens === "amber" && st.players[0].wear[0]?.lens === null, JSON.stringify(st.players[0].wear));
  check("9a: the sunglasses offer five lens tints", JSON.stringify(o.items.find((i) => i.id === "sunglasses")?.lenses) === JSON.stringify(["black", "brown", "blue-mirror", "amber", "rose"]), JSON.stringify(o.items.find((i) => i.id === "sunglasses")?.lenses));
  check("the seats, the venue, the time, the weather, the difficulty", JSON.stringify(st.exhibitionSeats) === "[0,1,2,-1]" && st.continent === "europe" && st.timeOfDay === "sunset" && st.weather === "cloudy" && st.gameDifficulty === "hard");
  check("the game's own odds for the pair", st.pointChanceHome > 0.3 && st.pointChanceHome < 0.7, `${st.pointChanceHome}`);
  const after = snapshot();
  const changed = Object.keys(after).filter((t) => after[t] !== before[t]);
  check("it touches nothing in a career: no table changed", changed.length === 0, changed.length ? changed.join(", ") : `${Object.keys(after).length} tables the same`);

  if (UNITY) {
    console.log("\n  THE COURT PLAYS IT (Unity, batch)");
    const log = path.join(WORK, "unity.log").replace(/\\/g, "/");
    const r = spawnSync(UNITY_EXE, ["-batchmode", "-projectPath", UNITY_PROJECT, "-executeMethod", "ExhibitionProof.Run", "-proofDir", PROOF, "-apiBase", `http://localhost:${PORT}`, "-exhibitionId", made.data.id, "-logFile", log], { encoding: "utf8", timeout: 900000 });
    const text = fs.existsSync(path.join(PROOF, "D6", "d6-exhibition-court.txt")) ? fs.readFileSync(path.join(PROOF, "D6", "d6-exhibition-court.txt"), "utf8") : "";
    check("the court ran it", r.status === 0 && text.length > 0, `exit ${r.status}`);
    check("its venue, time and weather", /time Sunset; weather Cloudy/.test(text), text.split("\n").find((l) => l.includes("the game:")));
    check("the custom team's swimwear and accessories on the players", /Player_A1: Kira Sands; swimwear swimsuit-1 hibiscus/.test(text) && /SK_BG_HAT/.test(text), text.split("\n").find((l) => l.includes("Player_A1:")));
    check("three people here, each on her own seat, and the AI on the fourth", /played: 3 people here/.test(text) && /Player_B2 AiSeat/.test(text), text.split("\n").find((l) => l.includes("engine's seats")));
    check("nothing reported to a career", /reported to a career: nothing/.test(text));
    console.log(text.split("\n").map((l) => "    " + l).join("\n"));
  }
} catch (e) {
  failures++; console.log(`  FAIL  ${e.stack ?? e}`);
} finally {
  await stopServer(child);
}
console.log(`\n  ${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failures === 0 ? 0 : 1);
