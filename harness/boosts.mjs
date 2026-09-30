/**
 * Unity match brief (29 Sep), item 3 — boosts that do what they say.
 *
 * The boosts are counted in points (Unity's Assets/Scripts/BoostClock.cs: on
 * for 3 points, then 5 points of cooldown) and add a fixed shift to the chance
 * that the player's pair wins each point they are on for. This suite runs the
 * Unity project's own BoostClock.cs and PointModel.cs (harness/unity-point-model,
 * "boosts" mode) and measures what they are worth, at the chances the game's
 * engine gives an even match and a 10-rating mismatch either way.
 *
 * Asserted (Rob's brief): each boost raises the chance of every point it is on
 * for, and never lowers it; using the boosts every time they are ready wins
 * noticeably more often than Sim Result.
 *
 * Overnight brief 30 Sep, item 31 (Rob, Q-7: boosts should matter more): used
 * every time they are ready, an even match goes from ~52% to about 65%, and a
 * pair 10 rating points weaker from ~40% to about 52% (they turned it only to
 * ~49%). Asserted within 3 points of each target, for Attack, Defence and the
 * two in turn. The measured numbers are printed for the status file; Rob tunes after.
 *
 * Usage: node harness/boosts.mjs
 */
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pointProbability } from "../artifacts/api-server/src/utils/matchEngine.ts";

const REPO = path.join(import.meta.dirname, "..");
const RUNNER = path.join(REPO, "harness", "unity-point-model");
const N = 20000;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  UNITY 3: BOOSTS, COUNTED IN POINTS, WORTH SOMETHING");
console.log("=".repeat(72));

// The game's own chances: the player's club at home (as every career match is).
const CASES = [
  { label: "even match (70 v 70)",             chance: pointProbability(70, 70, { homeAdvantage: true }) },
  { label: "10 rating points weaker (65 v 75)", chance: pointProbability(65, 75, { homeAdvantage: true }) },
  { label: "10 rating points stronger (75 v 65)", chance: pointProbability(75, 65, { homeAdvantage: true }) },
];
const POLICIES = ["none", "attack", "defence", "alternate"];

const run = spawnSync("dotnet", ["run", "-c", "Release", "--", "boosts", String(N), "30", ...CASES.map((c) => String(c.chance))],
  { cwd: RUNNER, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
let out = null;
try { out = JSON.parse(run.stdout.trim().split("\n").pop()); } catch { /* reported below */ }
check("the Unity project's BoostClock.cs and PointModel.cs compile and run", run.status === 0 && out != null,
  run.status === 0 ? `on ${out?.activePoints} points, cooldown ${out?.cooldownPoints}; Attack +${out?.attackShift}, Defence +${out?.defenceShift} per point` : (run.stderr || run.stdout).slice(-400));

check("each boost adds to the player's chance of a point, never takes away", out?.attackShift > 0 && out?.defenceShift > 0);
check("boosts last 3 points and cool down for 5 (the brief's suggestion)", out?.activePoints === 3 && out?.cooldownPoints === 5);

const rate = (k, pol) => (out?.results?.[k]?.[pol] ?? NaN) / N * 100;
console.log(`\n  REPORT  match win rate, ${N} matches per cell (best of 3 to 11):`);
console.log("          " + "case".padEnd(38) + POLICIES.map((p) => (p === "none" ? "no boosts" : `${p} every time`).padStart(20)).join(""));
for (const [k, c] of CASES.entries()) {
  console.log("          " + `${c.label}, p ${c.chance.toFixed(4)}`.padEnd(38) + POLICIES.map((p) => `${rate(k, p).toFixed(1)}%`.padStart(20)).join(""));
}
console.log("");

const even = 0, weak = 1, strong = 2;
for (const pol of ["attack", "defence", "alternate"]) {
  check(`even match: ${pol} every time it is ready goes from ~52% to about 65%`,
    Math.abs(rate(even, "none") - 52) <= 3 && Math.abs(rate(even, pol) - 65) <= 3, `${rate(even, "none").toFixed(1)}% -> ${rate(even, pol).toFixed(1)}%`);
  check(`10 points weaker: ${pol} every time goes from ~40% to about 52%`,
    Math.abs(rate(weak, "none") - 40) <= 3 && Math.abs(rate(weak, pol) - 52) <= 3, `${rate(weak, "none").toFixed(1)}% -> ${rate(weak, pol).toFixed(1)}%`);
  check(`10 points stronger: ${pol} still helps`, rate(strong, pol) > rate(strong, "none"),
    `${rate(strong, "none").toFixed(1)}% -> ${rate(strong, pol).toFixed(1)}%`);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
