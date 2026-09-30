/**
 * Overnight brief 30 Sep, item 29 — money achievements in one format.
 *
 * Rob, 30 Sep: the Trophy Cabinet showed "396045 / 1000000", the Career page
 * "$0.40M / $1M". Both pages now print progress through one function
 * (lib/achievement-progress.ts, compiled as the UI compiles it).
 *
 * Asserted: Rob's example reads "$0.40M / $1M"; $100k-scale targets read in
 * $k; counts stay plain; both pages call it, and neither prints the raw pair.
 *
 * Usage: node harness/achievement-progress.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const REPO = path.join(import.meta.dirname, "..");
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 29: MONEY ACHIEVEMENTS IN ONE FORMAT");
console.log("=".repeat(72));
const esbuild = createRequire(path.join(REPO, "artifacts", "api-server", "package.json"))("esbuild");
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "vbe-ach-")), "p.mjs");
esbuild.buildSync({ entryPoints: [path.join(REPO, "artifacts/beach-volleyball/src/lib/achievement-progress.ts")], outfile: out, format: "esm", bundle: true, logLevel: "silent" });
const { formatProgress } = await import(pathToFileURL(out).href);
check("Rob's example: 396,045 of $1M reads \"$0.40M / $1M\"", formatProgress(396045, 1000000) === "$0.40M / $1M", formatProgress(396045, 1000000));
check("a $250k target reads in $k; a count stays a count", formatProgress(120500, 250000) === "$121k / $250k" && formatProgress(7, 29) === "7 / 29",
  `${formatProgress(120500, 250000)}; ${formatProgress(7, 29)}`);
const src = (f) => fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages", f), "utf8");
const cab = src("trophy-cabinet.tsx"), car = src("achievements.tsx");
check("the Trophy Cabinet and the Career page both print progress through it",
  /formatProgress\(achievement\.progress, achievement\.target\)/.test(cab) && /formatProgress\(a\.progress\.current, a\.progress\.target\)/.test(car)
  && [cab, car].every((s) => /from "@\/lib\/achievement-progress"/.test(s)) && !/function formatProgress/.test(car));
check("neither prints the raw pair", !/\{achievement\.progress\} \/ \{achievement\.target\}/.test(cab));
console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
