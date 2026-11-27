/**
 * 1.2 D6 (Rob, 23 Nov): the online scaffold's two-engine proof. No networking: two separate
 * processes stand for two PCs.
 *
 *   1. Process A plays an AI v AI match on the played-match engine and saves every seat's input,
 *      step by step (InputRecording), printing each point as it is decided.
 *   2. Process B reads the file and plays the match again with four RemoteSeats handed those
 *      inputs, printing each point. Process C does it again.
 *   3. The three must agree point by point (who won it, how, at what time, the score after it) and
 *      on the result; no input may be left unplayed.
 *   4. One input changed in the file must change the match: the replay really plays the inputs.
 * If they differ, the engine is not ready for online play (the brief: that must be fixed now).
 *
 * Usage: node harness/online-scaffold.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = path.join(import.meta.dirname, "played-match");
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), "vbe-online-"));
const FILE = path.join(WORK, "match.txt");
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
const run = (...args) => {
  const r = spawnSync("dotnet", ["run", "-c", "Release", "--no-build", "--", ...args], { cwd: DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`dotnet ${args.join(" ")}: ${r.stderr || r.stdout}`);
  return r.stdout.split(/\r?\n/);
};
const points = (lines) => lines.filter((l) => l.startsWith("point ") || l.startsWith("match over"));

console.log("=".repeat(72));
console.log("  1.2 D6: THE ONLINE SCAFFOLD, TWO ENGINES FROM ONE RECORDING");
console.log("=".repeat(72));
try {
  const b = spawnSync("dotnet", ["build", "-c", "Release", "-nologo", "-v", "q"], { cwd: DIR, encoding: "utf8" });
  check("(set-up) the engine builds outside Unity", b.status === 0, b.status === 0 ? "" : b.stdout.slice(-400));
  const a = run("record", FILE, "424242");
  const pa = points(a);
  check("process A played a whole match and saved its inputs", pa.at(-1)?.startsWith("match over") && fs.existsSync(FILE), `${pa.length - 1} points; ${a.find((l) => l.startsWith("recorded"))}`);
  const replayB = run("replay", FILE), replayC = run("replay", FILE);
  const pb = points(replayB), pc = points(replayC);
  const firstDiff = (x, y) => { for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `point ${i + 1}: "${x[i]}" v "${y[i]}"`; return null; };
  check("process B, from the file alone, agrees point by point", !firstDiff(pa, pb), firstDiff(pa, pb) ?? `${pb.length - 1} points, ${pb.at(-1)}`);
  check("process C agrees too", !firstDiff(pa, pc), firstDiff(pa, pc) ?? `${pc.length - 1} points`);
  check("every recorded input was played", /0 left unplayed/.test(replayB.find((l) => l.startsWith("replayed")) ?? ""), replayB.find((l) => l.startsWith("replayed")));
  // Tamper: the first press in the file is dropped.
  const lines = fs.readFileSync(FILE, "utf8").split("\n");
  const i = lines.findIndex((l, k) => k >= 5 && l.trim().length > 0 && !l.endsWith(" 0"));
  const tampered = path.join(WORK, "tampered.txt");
  fs.writeFileSync(tampered, [...lines.slice(0, i), ...lines.slice(i + 1)].join("\n"));
  const pt = points(run("replay", tampered));
  check("with one press taken out of the file, the match goes differently", !!firstDiff(pa, pt), `(dropped "${lines[i]}") first difference: ${firstDiff(pa, pt)}`);
} catch (e) {
  failures++; console.log(`  FAIL  ${e.message ?? e}`);
}
console.log(`\n  ${checks - failures}/${checks} checks passed`);
console.log(failures === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failures === 0 ? 0 : 1);
