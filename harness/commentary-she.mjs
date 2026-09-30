/**
 * Overnight brief 30 Sep, items 21 and 22 — the commentary says "she".
 *
 * Rob, 30 Sep: the commentary said "he". Every line the commentators speak
 * or the game shows is checked for he / his / him / himself:
 *   - the Unity project's commentary table (Assets/Scripts/CommentaryLines.cs)
 *     and the match scene (whose old serialized line arrays held the "he" lines);
 *   - the clip list the game ships (public/unity-build/StreamingAssets/commentary/LINES.txt):
 *     all 48 clips present, each line she/her, matching the Unity table word for word;
 *   - every string in the game's own code (UI and server), comments aside.
 * The Unity checks are skipped with a note when the Unity project is not on this machine.
 *
 * Usage: node harness/commentary-she.mjs
 */
import fs from "node:fs";
import path from "node:path";

const REPO = path.join(import.meta.dirname, "..");
const UNITY = process.env.UNITY_REPO ?? "C:\\Users\\rbonn\\Game_Dev\\VolleyBall Empire\\volleyball";
const CLIPS = path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build", "StreamingAssets", "commentary");
const HE = /\b(he|his|him|himself)\b/i;

let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 21-22: TWO COMMENTATORS, AND THEY SAY SHE");
console.log("=".repeat(72));

// The clip list the game ships.
const list = fs.readFileSync(path.join(CLIPS, "LINES.txt"), "utf8").split(/\r?\n/)
  .filter((l) => /\.mp3\t/.test(l)).map((l) => { const [file, text] = l.split("\t"); return { file, text }; });
const kinds = ["serve", "dig", "set", "spike", "blockattempt", "block", "point", "rally"];
const expected = ["A", "B"].flatMap((s) => kinds.flatMap((k) => [1, 2, 3].map((n) => `${s}_${k}_${n}.mp3`)));
check("48 lines: 8 kinds x 3 x 2 commentators, one clip each, all present",
  list.length === 48 && expected.every((f) => list.some((l) => l.file === f) && fs.existsSync(path.join(CLIPS, f))),
  `${list.length} listed, ${expected.filter((f) => fs.existsSync(path.join(CLIPS, f))).length} clips on disk`);
const heLines = list.filter((l) => HE.test(l.text));
check("no commentary line says he, his, him", heLines.length === 0, heLines.map((l) => l.file).join(", "));
check("the lines speak of her (a third or more name her)", list.filter((l) => /\b(she|her)\b/i.test(l.text)).length >= 16,
  `${list.filter((l) => /\b(she|her)\b/i.test(l.text)).length} of 48 name her`);

// Unity.
if (!fs.existsSync(UNITY)) console.log(`  NOTE  Unity project not at ${UNITY}: Unity checks skipped`);
else {
  const table = fs.readFileSync(path.join(UNITY, "Assets", "Scripts", "CommentaryLines.cs"), "utf8");
  const strings = [...table.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]).filter((s) => s.includes(" "));
  check("the Unity commentary table holds the same 48 lines as the shipped list, none says he",
    strings.length === 48 && list.every((l) => strings.includes(l.text)) && !strings.some((s) => HE.test(s)), `${strings.length} lines`);
  const scene = fs.readFileSync(path.join(UNITY, "Assets", "BeachVolleyball V19.unity"), "utf8");
  check("the match scene no longer carries the old line arrays", !/serveLines:|pointWonLines:|He floats a high serve/.test(scene));
}

// Every string in the game's own code, comments aside.
const hits = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "generated" && e.name !== "node_modules") walk(p); continue; }
    if (!/\.(ts|tsx)$/.test(e.name)) continue;
    fs.readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      const code = line.replace(/\/\/.*$/, "");
      if (HE.test(code) && /["'`>]/.test(code)) hits.push(`${path.relative(REPO, p)}:${i + 1}`);
    });
  }
}
walk(path.join(REPO, "artifacts", "beach-volleyball", "src"));
walk(path.join(REPO, "artifacts", "api-server", "src"));
check("no he/his/him in any text the game's UI or server writes", hits.length === 0, hits.slice(0, 5).join(", "));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
