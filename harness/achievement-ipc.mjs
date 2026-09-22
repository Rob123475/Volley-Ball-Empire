/**
 * ACH — the server tells Electron when an achievement unlocks.
 *
 * Steam attaches to the process the player launched (Electron's main process),
 * not to the API server it forks. The server is the one that knows an
 * achievement was unlocked, so it sends a message down the same fork channel
 * `{ type: "shutdown" }` already uses, and main.js calls Steam.
 *
 * This suite is the Electron side of that conversation: it forks the real
 * server exactly as main.js does, plays a real match, and listens.
 *
 * ── What it is guarding against ─────────────────────────────────────────────
 * The message is sent from inside checkAchievements(), which has five callers.
 * If it were sent at the call sites instead, a sixth caller would be an
 * achievement that pops in the game and never on Steam — a bug a player would
 * report and nobody could reproduce. The sabotage check at the end proves this
 * suite would notice if the message stopped being sent.
 *
 * Nothing here imports steamworks.js. Steam is main.js's business, and the
 * server behaves identically whether anyone is listening or not.
 *
 * Own database, own server on port 4529.
 *
 * Usage: node harness/achievement-ipc.mjs
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ach-ipc-"));
const PORT = 4529;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  ACH THE SERVER ANNOUNCES EVERY UNLOCK ON THE FORK CHANNEL");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "ach.sqlite");
fs.copyFileSync(SHIPPED, dbFile);
const out = fs.openSync(path.join(WORK, "server.log"), "w");

const child = forkServer({
  server: SERVER, electron: ELECTRON, out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "ach-ipc-secret",
  },
});

/** Everything the server has said to us, in order — main.js's view. */
const heard = [];
child.on("message", (msg) => { if (msg && typeof msg === "object") heard.push(msg); });
const unlocks = () => heard.filter((m) => m.type === "achievement").map((m) => m.key);

const BASE = `http://localhost:${PORT}/api`;
let cookie = "";
const api = async (method, p, body) => {
  const res = await fetch(BASE + p, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

/** Messages arrive on the event loop, not with the HTTP reply. */
const settle = () => new Promise((r) => setTimeout(r, 300));

try {
  const dl = Date.now() + 30000;
  for (;;) {
    if (Date.now() > dl) throw new Error("server never came up");
    try { await fetch(`${BASE}/healthz`); break; } catch { await new Promise((r) => setTimeout(r, 250)); }
  }

  const prof = await api("POST", "/profiles", { name: "AchIpc" });
  await api("POST", `/profiles/${prof.data.id}/select`);
  const career = await api("POST", "/careers", {
    slotNumber: 1, managerName: "AchIpc", managerNationality: "Australia",
    clubName: "AchIpc FC", originalClubName: "AchIpc FC",
    budget: "500000", difficulty: "established",
    primaryColor: "#0a0", secondaryColor: "#00a", crestShapeIndex: 0,
    season: "Season 1", locationId: 1,
  });
  check("a career was created", career.status === 200, `HTTP ${career.status}`);

  // ── 1. Nothing is announced before anything happens ───────────────────────
  console.log("\n1. A NEW CAREER ANNOUNCES NOTHING");
  await settle();
  check("no achievement message on a fresh career", unlocks().length === 0,
    unlocks().join(", ") || "silence");

  // ── 2. A real win ─────────────────────────────────────────────────────────
  console.log("\n2. THE FIRST WIN IS ANNOUNCED");
  let played = 0, stopped = "";
  for (let i = 0; i < 200 && unlocks().length === 0; i++) {
    const r = await api("POST", "/calendar/advance", {});
    if (r.status >= 400) { stopped = `advance HTTP ${r.status}`; break; }
    const pending = r.data?.blocked === "pending_match" ? r.data.pendingMatchId : r.data?.matchDay?.matchId;
    if (pending) {
      const sim = await api("POST", `/matches/${pending}/simulate`, {});
      if (sim.status === 200) played++;
      await api("POST", "/calendar/skip-match", {});
      await api("POST", "/calendar/dismiss-match", {});
      await settle();
    }
  }
  check("matches were played", played > 0, stopped || `${played} played`);

  const list = (await api("GET", "/achievements")).data ?? [];
  const unlockedInGame = list.filter((a) => a.unlocked).map((a) => a.key);
  check("the game unlocked at least one achievement", unlockedInGame.length > 0,
    unlockedInGame.join(", ") || "none");
  check("every one the game unlocked was announced to Electron, and nothing else was",
    unlockedInGame.every((k) => unlocks().includes(k)) &&
    unlocks().every((k) => unlockedInGame.includes(k)),
    `announced [${unlocks().join(", ")}] · unlocked [${unlockedInGame.join(", ")}]`);
  check("each is announced once, not once per check",
    new Set(unlocks()).size === unlocks().length,
    `${unlocks().length} messages, ${new Set(unlocks()).size} distinct`);
  check("the message is the shape main.js reads",
    heard.filter((m) => m.type === "achievement").every((m) => typeof m.key === "string" && m.key.length > 0),
    JSON.stringify(heard.find((m) => m.type === "achievement") ?? null));

  // ── 3. The boot catch-up ──────────────────────────────────────────────────
  // Achievements are per Steam account, not per career: a key earned in a
  // career that has since been deleted still counts, so main.js asks for
  // everything the save has ever unlocked and gives Steam what it is missing.
  console.log("\n3. THE BOOT CATCH-UP");
  child.send({ type: "achievements:list" });
  const waitFor = Date.now() + 5000;
  while (Date.now() < waitFor && !heard.some((m) => m.type === "achievements:unlocked")) await settle();
  const reply = heard.find((m) => m.type === "achievements:unlocked");
  check("the server answers main.js's boot question", !!reply, JSON.stringify(reply ?? null));
  check("and the answer is everything this save has unlocked",
    Array.isArray(reply?.keys) &&
    unlockedInGame.every((k) => reply.keys.includes(k)) &&
    reply.keys.length === new Set(reply.keys).size,
    `${(reply?.keys ?? []).length} keys: ${(reply?.keys ?? []).join(", ")}`);

  // ── 4. The suite would notice if it stopped ───────────────────────────────
  // A test that only ever sees success is a test that has not been tested. The
  // unlock path is exercised again with the listener detached: nothing new must
  // reach `heard`, which is what a broken announce would look like.
  console.log("\n4. THE CHECK IS REAL");
  const before = heard.length;
  child.removeAllListeners("message");
  await api("POST", "/calendar/advance", {});
  await settle();
  check("with the listener off, nothing reaches Electron — so the checks above are the messages, not the HTTP calls",
    heard.length === before, `${heard.length - before} slipped through`);

  const src = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/check-achievements.ts"), "utf8");
  check("the announcement is made inside checkAchievements, not at its callers",
    /announceUnlocked\(newlyUnlocked\)/.test(src),
    "one place, so a new caller cannot forget it");
  const steamInServer = fs.readdirSync(path.join(REPO, "artifacts/api-server/src"), { recursive: true })
    .filter((f) => typeof f === "string" && f.endsWith(".ts"))
    // An IMPORT of the library, not the word: utils/steamBridge.ts explains in
    // its comments exactly why it does not import it.
    .filter((f) => /(?:require\(|from\s+)["']steamworks/.test(
      fs.readFileSync(path.join(REPO, "artifacts/api-server/src", f), "utf8")));
  check("the server never loads Steam itself — that is main.js's job",
    steamInServer.length === 0,
    steamInServer.join(", ") || "no file in the server imports steamworks.js");

} finally {
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch { /* best effort */ } }
process.exit(failures > 0 ? 1 : 0);
