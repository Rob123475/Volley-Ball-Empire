/**
 * 1.2 D4 (Rob, 23 Nov): the Store and its own money, on a copy of the starter DB.
 *
 *   - closed as shipped (data/store-settings.json "open": false): GET /store says only that it is
 *     closed, and nothing can be bought or worn;
 *   - opened (the dev switch stands in for flipping the file): the wallet opens with the starting
 *     balance, every item from data/store-items.json is listed with a picture that exists;
 *   - buying: the price comes off the wallet; a colour that does not fit is refused; 1.2 9b: Rob's
 *     prints from data/prints.json, each in its own colours (two or three, the buyer's), a colourway,
 *     or as painted; not enough money is refused; wearing one item of a slot takes the other off;
 *   - Rob's four hooks: the starting balance, a win's reward, a loss's penalty (never below zero),
 *     the income dribble for each whole period;
 *   - separate from the career: no team's or career's money moves through any of it;
 *   - closed again: GET /store is closed and buying is refused.
 *
 * Usage: node harness/store.mjs
 */
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
const SETTINGS = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "store-settings.json"), "utf8"));
const ITEMS = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "store-items.json"), "utf8")).items;
const PUBLIC = path.join(REPO, "artifacts", "beach-volleyball", "public");
const PRINTS = JSON.parse(fs.readFileSync(path.join(REPO, "artifacts", "api-server", "src", "data", "prints.json"), "utf8")).prints;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-store-"));
const DB = path.join(WORK, "save.sqlite");
const PORT = 4958;
const BASE = `http://localhost:${PORT}/api`;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  1.2 D4: THE STORE AND ITS OWN MONEY");
console.log("=".repeat(72));

fs.copyFileSync(SHIPPED, DB);
const out = fs.openSync(path.join(WORK, "server.log"), "w");
const child = forkServer({ server: SERVER, electron: ELECTRON, out,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: DB, PORT: String(PORT), NODE_ENV: "development", SESSION_SECRET: "store", STARTER_DB_PATH: SHIPPED } });
let cookie = "";
async function call(method, p, body) {
  const r = await fetch(BASE + p, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const sc = r.headers.get("set-cookie"); if (sc) cookie = sc.split(";")[0];
  let data; const t = await r.text(); try { data = JSON.parse(t); } catch { data = t; }
  return { status: r.status, data };
}
const money = () => {
  const d = new DatabaseSync(DB, { readOnly: true });
  try {
    const t = d.prepare("SELECT COUNT(*) n, COALESCE(SUM(budget), 0) s FROM teams").get();
    const c = d.prepare("SELECT COUNT(*) n, COALESCE(SUM(budget), 0) s FROM career_saves").get();
    return `teams ${t.n} ${t.s}; careers ${c.n} ${c.s}`;
  } finally { d.close(); }
};

try {
  for (let i = 0; i < 360; i++) { try { if ((await fetch(`${BASE}/healthz`)).ok) break; } catch { /* booting */ } await new Promise((r) => setTimeout(r, 250)); }
  const prof = (await call("POST", "/profiles", { name: "Store Proof" })).data;
  await call("POST", `/profiles/${prof.id}/select`);
  // A career with a club and its money, so "separate from the career" has something to keep still.
  const club = (await call("GET", "/club-templates")).data.clubs.find((c) => c.name === "Sydney Riptide");
  await startCareer(call, { managerFaceId: 8, slotNumber: 1, managerName: "Store Proof", managerNationality: "Australia", clubName: club.name, originalClubName: club.name,
    budget: club.startingBudget, difficulty: "established", primaryColor: "#1e3a8a", secondaryColor: "#f59e0b", crestShapeIndex: 0 });
  const before = money();
  check("(set-up) a career with its club's money", !/careers 0 /.test(before), before);

  console.log("\n  AS SHIPPED");
  check("the settings file ships the store closed", SETTINGS.open === false, `"open": ${SETTINGS.open}`);
  let s = await call("GET", "/store");
  check("GET /store says closed and nothing more", s.status === 200 && s.data.open === false && Object.keys(s.data).length === 1, JSON.stringify(s.data));
  let b = await call("POST", "/store/buy", { itemId: ITEMS[0].id, colour: ITEMS[0].colour });
  check("buying is refused while closed", b.status === 403, `${b.status} ${JSON.stringify(b.data)}`);
  check("wearing is refused while closed", (await call("POST", "/store/wear", { ownedId: 1, worn: true })).status === 403);

  console.log("\n  OPENED (the dev switch, as flipping the file would)");
  await call("POST", "/dev/store/open", { open: true });
  s = await call("GET", "/store");
  check("the wallet opens with the starting balance", s.data.open === true && s.data.balance === SETTINGS.startingBalance, `${s.data.balance} ${s.data.currency}`);
  check("every item in the data file is listed, and every print in prints.json (9b)", s.data.items?.length === ITEMS.length + PRINTS.length, `${s.data.items?.length} of ${ITEMS.length} + ${PRINTS.length}`);
  const missing = s.data.items.filter((i) => !fs.existsSync(path.join(PUBLIC, i.picture)));
  check("every item has its picture (the accessories in public/store, Rob's prints in public/prints)", missing.length === 0, missing.length ? missing.map((i) => i.picture).join(", ") : `${s.data.items.length} pictures`);
  const hat = ITEMS.find((i) => i.slot === "hat"), print = s.data.items.find((i) => i.id === "print-hibiscus-white-on-red");
  b = await call("POST", "/store/buy", { itemId: hat.id, colour: "#FF0000" });
  check("buying takes the price off the wallet", b.status === 200 && b.data.balance === SETTINGS.startingBalance - hat.price, `${b.status}; ${SETTINGS.startingBalance} - ${hat.price} = ${b.data.balance}`);
  check("the item is owned in the colour chosen", b.data.owned?.length === 1 && b.data.owned[0].colour === "#ff0000" && b.data.owned[0].worn === false, JSON.stringify(b.data.owned));
  check("a colour that is not #rrggbb is refused", (await call("POST", "/store/buy", { itemId: hat.id, colour: "red" })).status === 400);
  check("a print with one colour is refused", (await call("POST", "/store/buy", { itemId: print.id, colour: "#ffffff" })).status === 400);
  b = await call("POST", "/store/buy", { itemId: print.id, colour: "#112233,#ddeeff" });
  check("a print in two colours is bought", b.status === 200 && b.data.owned.some((o) => o.itemId === print.id && o.colour === "#112233,#ddeeff"));
  for (let i = 0; i < 8; i++) await call("POST", "/dev/store/result", { won: true });   // the wallet topped up (hook 2) for the buys below
  b = await call("POST", "/store/buy", { itemId: "print-gingham", colour: "#1e2a78,#a9c4f7,#ffffff" });
  check("9b: gingham in three colours of the buyer's", b.status === 200 && b.data.owned.some((o) => o.itemId === "print-gingham" && o.colour === "#1e2a78,#a9c4f7,#ffffff"), `${b.status}`);
  b = await call("POST", "/store/buy", { itemId: "print-leopard", colour: "" });
  check("9b: the leopard as Rob painted it (no colours), and refused in a colour", b.status === 200 && (await call("POST", "/store/buy", { itemId: "print-leopard", colour: "#ffffff" })).status === 400, `${b.status}`);
  b = await call("POST", "/store/buy", { itemId: "print-paisley", colour: "green" });
  check("9b: paisley in one of Rob's four colourways, and refused in one he did not paint", b.status === 200 && b.data.owned.some((o) => o.itemId === "print-paisley" && o.colour === "green") && (await call("POST", "/store/buy", { itemId: "print-paisley", colour: "purple" })).status === 400, `${b.status}`);
  check("an item that is not in the file is refused", (await call("POST", "/store/buy", { itemId: "no-such-thing", colour: "#ffffff" })).status === 404);
  // 1.2 9a: the sunglasses' lens tint, chosen beside the frame colour.
  const glasses = ITEMS.find((i) => i.slot === "sunglasses");
  b = await call("POST", "/store/buy", { itemId: glasses.id, colour: "#333333;blue-mirror" });
  check("9a: sunglasses bought in a frame colour with blue mirror lenses", b.status === 200 && b.data.owned.some((o) => o.itemId === glasses.id && o.colour === "#333333;blue-mirror"), `${b.status} ${JSON.stringify(b.data.owned?.filter((o) => o.itemId === glasses.id))}`);
  check("9a: a lens they do not come in is refused, and so is no lens", (await call("POST", "/store/buy", { itemId: glasses.id, colour: "#333333;purple" })).status === 400 && (await call("POST", "/store/buy", { itemId: glasses.id, colour: "#333333" })).status === 400);
  const firstHat = b.data.owned.find((o) => o.itemId === hat.id);
  let w = await call("POST", "/store/wear", { ownedId: firstHat.id, worn: true });
  check("the hat is worn", w.status === 200 && w.data.owned.find((o) => o.id === firstHat.id).worn === true);
  b = await call("POST", "/store/buy", { itemId: hat.id, colour: "#00ff00" });
  const secondHat = b.data.owned.filter((o) => o.itemId === hat.id).at(-1);
  w = await call("POST", "/store/wear", { ownedId: secondHat.id, worn: true });
  check("wearing a second hat takes the first off", w.data.owned.find((o) => o.id === secondHat.id).worn === true && w.data.owned.find((o) => o.id === firstHat.id).worn === false);
  let bal = (await call("GET", "/store")).data.balance;
  let spent = 0;
  while (bal >= hat.price && spent < 50) { await call("POST", "/store/buy", { itemId: hat.id, colour: "#000000" }); bal = (await call("GET", "/store")).data.balance; spent++; }
  b = await call("POST", "/store/buy", { itemId: hat.id, colour: "#000000" });
  check("not enough money is refused", b.status === 409, `${b.status} ${JSON.stringify(b.data)} with ${bal} left`);

  console.log("\n  ROB'S FOUR WALLET HOOKS (for online play)");
  const r1 = (await call("POST", "/dev/store/result", { won: true })).data.balance;
  check("a win pays the win reward", r1 === bal + SETTINGS.winReward, `${bal} + ${SETTINGS.winReward} = ${r1}`);
  const r2 = (await call("POST", "/dev/store/result", { won: false })).data.balance;
  check("a loss takes the loss penalty", r2 === Math.max(0, r1 - SETTINGS.lossPenalty), `${r1} - ${SETTINGS.lossPenalty} = ${r2}`);
  let low = r2; for (let i = 0; i < 20; i++) low = (await call("POST", "/dev/store/result", { won: false })).data.balance;
  check("losses never take the wallet below zero", low === 0, `${low}`);
  const inc = (await call("POST", "/dev/store/income-back", { hours: SETTINGS.income.everyHours * 3 + 1 })).data.balance;
  check("the income dribble pays each whole period since the last", inc === 3 * SETTINGS.income.amount, `3 periods of ${SETTINGS.income.everyHours} h at ${SETTINGS.income.amount}: ${inc}`);
  const again = (await call("GET", "/store")).data.balance;
  check("and not twice for the same periods", again === inc, `${again}`);

  console.log("\n  SEPARATE FROM THE CAREER");
  const after = money();
  check("no team's or career's money moved", before === after, `before: ${before}; after: ${after}`);

  console.log("\n  CLOSED AGAIN");
  await call("POST", "/dev/store/open", { open: false });
  s = await call("GET", "/store");
  check("GET /store is closed again", s.data.open === false);
  check("and buying is refused", (await call("POST", "/store/buy", { itemId: hat.id, colour: "#ffffff" })).status === 403);
} catch (e) {
  failures++; console.log(`  FAIL  ${e.stack ?? e}`);
} finally {
  await stopServer(child);
}
console.log(`\n  ${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failures === 0 ? 0 : 1);
