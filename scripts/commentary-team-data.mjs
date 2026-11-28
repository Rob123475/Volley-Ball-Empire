#!/usr/bin/env node
/**
 * 1.2 section 5 (Rob, 28 Nov 2026): the commentary team's data, from Rob's recording sheet.
 *
 * docs/update-1.2/COMMENTARY-TEAM-LINES.md is the one sheet Rob records from: every new line, its file,
 * who says it and when. This turns its tables into the court's data file,
 * artifacts/beach-volleyball/public/unity-build/StreamingAssets/commentary/TEAM.json:
 *   - the sideline reporter (voice S): her lines, each with its break (walkon, setend, drinks, decider,
 *     band, weather, night, matchwon);
 *   - the celebrity guests, one per match (voices C, D and any added later): each line with its moment
 *     (intro, ace, block, error, rally, setpoint, matchpoint, comeback, quiet, matchwon), and the
 *     resident line that introduces them;
 *   - the residents' hand-overs (tosideline, fromsideline, guestreact).
 * A new guest later is a table in the sheet (and a line for their introduction), this script, and a
 * folder of clips: no code. The court plays a line once its clip is in the commentary folder under its
 * file name; until then it is skipped in silence.
 * harness/commentary-team.mjs checks the sheet and the data agree, line by line.
 *
 * Usage: node scripts/commentary-team-data.mjs [--check]   (--check: only say whether TEAM.json is up to date)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(import.meta.dirname, "..");
export const SHEET = path.join(REPO, "docs", "update-1.2", "COMMENTARY-TEAM-LINES.md");
export const DATA = path.join(REPO, "artifacts", "beach-volleyball", "public", "unity-build", "StreamingAssets", "commentary", "TEAM.json");

/** The sheet's "When" words, as the court's moments. */
export const WHEN = {
  "walk-on": "walkon", "a set ends": "setend", "drinks break": "drinks", "before a deciding set": "decider", "the band shot": "band",
  "wind or rain": "weather", "night match": "night", "match won": "matchwon",
  "ace": "ace", "block": "block", "error": "error", "long rally": "rally", "set point": "setpoint", "match point": "matchpoint",
  "comeback": "comeback", "any quiet moment": "quiet",
  "before a sideline line": "tosideline", "after a sideline line": "fromsideline", "after a guest line": "guestreact",
};

/** Every table row of the sheet: its section's title, and the row's cells. */
export function sheetRows(text = fs.readFileSync(SHEET, "utf8")) {
  const rows = [];
  let section = "";
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("## ")) section = line.slice(3).trim();
    const m = /^\|\s*`([^`]+\.mp3)`\s*\|(.*)\|\s*$/.exec(line);
    if (m) rows.push({ section, file: m[1], cells: m[2].split("|").map((c) => c.trim()) });
  }
  return rows;
}

export function build(rows = sheetRows()) {
  const team = {
    _about: "1.2 section 5: the commentary team, made from docs/update-1.2/COMMENTARY-TEAM-LINES.md by scripts/commentary-team-data.mjs (edit the sheet, not this). A line plays once its clip is in this folder under its file name.",
    residents: { A: "Kailey", B: "Hukum" },
    sideline: { voice: "S", name: "Nicole Dupont", lines: [] },
    guests: [],
    handovers: [],
  };
  const guests = new Map();
  for (const r of rows) {
    const voice = r.file.split("_")[0];
    if (r.section.startsWith("Nicole Dupont")) { team.sideline.lines.push({ file: r.file, when: WHEN[r.cells[0]], text: r.cells[1] }); continue; }
    if (r.section.startsWith("The residents")) {
      const [who, whenWords, text] = r.cells;
      const guest = /^walk-on, (\w+) in the booth$/.exec(whenWords);
      if (guest) { (guests.get(guest[1].toLowerCase()) ?? guests.set(guest[1].toLowerCase(), {}).get(guest[1].toLowerCase())).introducedBy = { file: r.file, voice, text }; continue; }
      team.handovers.push({ file: r.file, voice, speaker: who, when: WHEN[whenWords], text });
      continue;
    }
    const g = /^(.+?), celebrity guest \((\w)\)$/.exec(r.section);
    if (g) {
      const key = g[1].split(" ")[0].toLowerCase();
      const entry = guests.get(key) ?? guests.set(key, {}).get(key);
      Object.assign(entry, { key, voice: g[2], name: g[1] });
      (entry.lines ??= []).push({ file: r.file, when: r.cells[0] === "walk-on" ? "intro" : WHEN[r.cells[0]], text: r.cells[1] });
    }
  }
  team.guests = [...guests.values()].map(({ key, voice, name, introducedBy, lines }) => ({ key, voice, name, introducedBy, lines }));
  return team;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = JSON.stringify(build(), null, 2) + "\n";
  const unknown = [...json.matchAll(/"when": null/g)].length;
  if (unknown) throw new Error(`${unknown} line(s) with a "When" the court does not know: add it to WHEN`);
  if (process.argv.includes("--check")) {
    const same = fs.existsSync(DATA) && fs.readFileSync(DATA, "utf8") === json;
    console.log(same ? "TEAM.json is up to date with the sheet" : "TEAM.json differs from the sheet: run node scripts/commentary-team-data.mjs");
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(DATA, json);
  const t = build();
  console.log(`[commentary-team] ${t.sideline.lines.length} sideline lines, ${t.guests.map((g) => `${g.lines.length} ${g.name}`).join(", ")}, ${t.handovers.length + t.guests.filter((g) => g.introducedBy).length} resident hand-overs -> ${path.relative(REPO, DATA)}`);
}
