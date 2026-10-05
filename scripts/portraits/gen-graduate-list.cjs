// Writes artifacts/api-server/src/data/graduatePortraits.ts in the repo given, from the A4 manifest.
const path = require("path"), fs = require("fs");
// Usage: node gen-graduate-list.cjs <repo> <manifest.json from prepare-player-cards.py>
const m = require(path.resolve(process.argv[3]));
const repo = process.argv[2];
let s = `/**
 * Final brief 5 Oct, A4: Rob's graduate pictures, by continent (public/images/players/graduates).
 * Made from Rob's folders (copies; his originals untouched), resized to 600 x 800 WebP. Each is a
 * woman of 21 in a plain white bikini, with no flag, name or text: the game prints her name, stats
 * and stars itself. harness/player-pictures.mjs checks every file exists and none is listed twice.
 */
import type { ContinentKey } from "@workspace/db";

export const GRADUATE_PORTRAITS: Record<ContinentKey, readonly string[]> = {
`;
for (const [c, l] of Object.entries(m.graduates)) s += `  ${c}: [\n${l.map((x) => `    "${x.file}",`).join("\n")}\n  ],\n`;
s += "};\n";
fs.writeFileSync(path.join(repo, "artifacts/api-server/src/data/graduatePortraits.ts"), s);
console.log("written", Object.values(m.graduates).flat().length);
