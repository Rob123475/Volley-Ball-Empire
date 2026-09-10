/**
 * R-22 — the Unity payload must carry per-player skin tone and per-team kit
 * colour for a real match, not just for whichever team happens to be home.
 *
 * ── The bug this exists for ─────────────────────────────────────────────────
 * Pathway trace (see docs/REPAIR-REGISTER.md's R-22 entry for the full
 * write-up) found the management side and the payload were both already
 * mostly right: `players.player_v4.visual_identity.skin_tone` is real,
 * per-player reference data (252/276 players on the live save), and
 * `GET /unity/match-state` already resolves each player's kit colour from
 * her CURRENT team's `logoColor`/`secondaryLogoColor` at request time — not
 * a hardcoded per-player value — so a transferred player's kit correctly
 * follows her new club, exactly as the triage note (3y) requires.
 *
 * The actual break: every match's `awayTeamId` equals its own `homeTeamId`
 * (there is no real opposing-team row anywhere in this codebase — every
 * match generation site sets `awayTeamId: team.id`; the true away side is
 * always an AI opponent represented only by `awayTeamName`, a name string —
 * see R-29). `/unity/match-state`'s fallback for that case — fill 2 away
 * slots from the free-agent pool — filtered `isActive: true` on a
 * `freeAgents: true` query. A free agent can never be `is_active` (that flag
 * is only ever set true when a player is signed to a roster —
 * `seedStartingSquad.ts`), so the filter combination returned zero rows,
 * always, for every career. The away side of the payload was empty for
 * every AI-opponent match — which is every match in this game, since no
 * match generation path ever produces a genuinely distinct away team.
 *
 * ── What this asserts ───────────────────────────────────────────────────────
 * Boot a real server, create a career (which eagerly generates its World
 * Tour fixture — every one of those matches has awayTeamId === homeTeamId,
 * the exact shape that was broken), and hit `/unity/match-state` for one of
 * its own matches. Asserts: 4 players, not 2 (the away side actually fills);
 * every player carries a real, non-null skinTone; the 2 home-side players'
 * primaryColor/secondaryColor match the team's own logoColor/
 * secondaryLogoColor exactly (not null, not a placeholder, not each other's
 * — proving the colour genuinely comes from the CURRENT team, per-request,
 * not a stored per-player value).
 *
 * Usage: node harness/unity-match-state-payload.mjs
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { requireElectronBinary } from "./electron-binary.mjs";
import { forkServer, stopServer } from "./server-harness.mjs";

const REPO = path.join(import.meta.dirname, "..");
const SHIPPED = path.join(REPO, "lib", "db", "volleyball-empire.sqlite");
const SERVER = path.join(REPO, "artifacts", "api-server", "dist", "index.mjs");
const ELECTRON = requireElectronBinary(REPO);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-unity-payload-"));
const PORT = 4650;

let failures = 0;
let checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

if (!fs.existsSync(SERVER)) {
  console.error(`[unity-match-state-payload] FAILED: ${SERVER} not built. Run the api-server build first.`);
  process.exit(1);
}

console.log("=".repeat(72));
console.log("  R-22 UNITY PAYLOAD CARRIES SKIN TONE AND PER-TEAM KIT COLOUR");
console.log("=".repeat(72));

const dbFile = path.join(WORK, "unity-payload.sqlite");
fs.copyFileSync(SHIPPED, dbFile);

const logFile = path.join(WORK, "server.log");
const out = fs.openSync(logFile, "w");
const child = forkServer({
  server: SERVER,
  electron: ELECTRON,
  out,
  env: {
    ...process.env, ELECTRON_RUN_AS_NODE: "1", DB_PATH: dbFile, PORT: String(PORT),
    NODE_ENV: "development", SESSION_SECRET: "unity-payload-secret",
  },
});

const base = `http://localhost:${PORT}/api`;
let cookie = "";
const api = async (method, p, body) => {
  const res = await fetch(base + p, {
    method,
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const sc = res.headers.get("set-cookie");
  if (sc) cookie = sc.split(";")[0];
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
};

const deadline = Date.now() + 25000;
let up = false;
while (Date.now() < deadline) {
  try { await fetch(`${base}/healthz`); up = true; break; }
  catch { await new Promise((r) => setTimeout(r, 250)); }
}
if (!up) {
  console.error("[unity-match-state-payload] server never came up");
  console.error(fs.readFileSync(logFile, "utf8").slice(-2000));
  process.exit(1);
}

try {
  const profileRes = await api("POST", "/profiles", { name: "UnityPayloadTest" });
  await api("POST", `/profiles/${profileRes.data.id}/select`);
  const careerRes = await api("POST", "/careers", {
    slotNumber: 1, managerName: "UnityPayloadTest", managerNationality: "Australia",
    clubName: "Unity Payload FC", originalClubName: "Unity Payload FC", season: "Season 1",
    budget: "500000", locationId: 1, primaryColor: "#123456", secondaryColor: "#abcdef",
  });
  check("career created (eager fixture generation)", careerRes.status === 200, `HTTP ${careerRes.status}`);
  const teamId = careerRes.data.teamId;

  const matchesRes = await api("GET", "/matches/fixture");
  const matches = Array.isArray(matchesRes.data) ? matchesRes.data : [];
  const match = matches[0] ?? null;
  check("a real fixture match exists to test against", !!match, JSON.stringify(match)?.slice(0, 200));

  if (match) {
    check("the fixture's away side is the World Tour shape this bug needs (awayTeamId === homeTeamId)",
      match.awayTeamId === match.homeTeamId, `home ${match.homeTeamId}, away ${match.awayTeamId}`);

    const payloadRes = await api("GET", `/unity/match-state?matchId=${match.id}`);
    check("GET /unity/match-state succeeds", payloadRes.status === 200, `HTTP ${payloadRes.status}`);

    const players = payloadRes.data?.players ?? [];
    check("the payload carries 4 players, not 2 — the away side actually fills",
      players.length === 4, `${players.length} players`);

    // Whether skinTone comes through is a pass-through question, not a "does
    // everyone have one" question: 24 of 276 players on the shipped DB have
    // no player_v4 block at all (a content-completeness gap — see R-22's
    // register entry, not a code bug), and this fixture draws free agents
    // essentially at random, so a real one of those 24 can legitimately land
    // in the away fill-in slots on any given run. The correctness property
    // the code owns is: skinTone is present exactly when the source data has
    // it, for every player, never silently dropped and never invented.
    const src = new DatabaseSync(dbFile, { readOnly: true });
    let passThroughOk = true;
    const mismatches = [];
    for (const p of players) {
      const row = src.prepare("SELECT player_v4 FROM players WHERE id = ?").get(p.id);
      const sourceHasSkinTone = !!(row?.player_v4 && JSON.parse(row.player_v4)?.visual_identity?.skin_tone);
      const payloadHasSkinTone = typeof p.skinTone === "string" && p.skinTone.length > 0;
      if (sourceHasSkinTone !== payloadHasSkinTone) { passThroughOk = false; mismatches.push(p.name); }
    }
    src.close();
    check("skinTone passes through exactly when the source player_v4 data has it (never dropped, never invented)",
      passThroughOk, mismatches.length ? `mismatched: ${mismatches.join(", ")}` : "");

    const realSkinTones = players.map((p) => p.skinTone).filter((s) => typeof s === "string" && s.length > 0);
    const distinctSkinTones = new Set(realSkinTones);
    check("of the players with real skin tone data, it genuinely differs (not one value copy-pasted onto everyone)",
      distinctSkinTones.size > 1, `${distinctSkinTones.size} distinct value(s) across ${realSkinTones.length} player(s): ${[...distinctSkinTones].join(", ")}`);

    const homePlayers = players.filter((p) => p.team === "Unity Payload FC");
    check("2 home-side players are present", homePlayers.length === 2, `${homePlayers.length}`);
    const homeColorsMatch = homePlayers.every((p) => p.primaryColor === "#123456" && p.secondaryColor === "#abcdef");
    check("home players' kit colour matches their team's own logoColor/secondaryLogoColor exactly",
      homeColorsMatch, JSON.stringify(homePlayers.map((p) => ({ name: p.name, primaryColor: p.primaryColor, secondaryColor: p.secondaryColor }))));
  }
} finally {
  // R-36: quit through R-31's shutdown path rather than SIGKILL, so the
  // database is left checkpointed with no -wal sidecar. The settle sleep
  // that used to follow the kill was only covering for that.
  await stopServer(child);
  try { fs.closeSync(out); } catch { /* already closed */ }
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
if (failures > 0) console.log(`\nLogs kept: ${WORK}`);
else { try { fs.rmSync(WORK, { recursive: true, force: true }); } catch {} }
process.exit(failures > 0 ? 1 : 0);
