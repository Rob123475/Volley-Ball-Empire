/**
 * Overnight brief 30 Sep, item 6 — market pages refresh when the clock moves.
 *
 * Rob, 30 Sep: Valentina Sosa's card kept "report in 1 day" three days after
 * the report was in; it showed only after leaving the page. The server was
 * right (a scout's report is worked out from the game date on every read:
 * harness/player-market.mjs and staff-scouting.mjs follow it day by day). The
 * page never asked again: a day's advance refreshed only the calendar queries,
 * and the market lists are cached for 30 s and kept while the page is open.
 *
 * Asserted in the UI's code, as the app runs it: every way the clock moves
 * (the day button and the auto-advance ticker, which share one mutation; Next
 * match; the match day's dismiss and skip) refreshes every query, so any page
 * on screen (Players, Staff, Medical markets, the youth pool) reads itself
 * again the moment the day changes; and the ticker has no advance of its own.
 *
 * Usage: node harness/clock-refresh.mjs
 */
import fs from "node:fs";
import path from "node:path";

const REPO = path.join(import.meta.dirname, "..");
const src = (p) => fs.readFileSync(path.join(REPO, "artifacts", "beach-volleyball", "src", p), "utf8");
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 30 SEP, 6: THE PAGES READ THEMSELVES AGAIN WHEN THE DAY CHANGES");
console.log("=".repeat(72));

const cal = src("hooks/use-calendar.ts");
const block = (name) => {
  const i = cal.indexOf(`const ${name} = useMutation`);
  return i < 0 ? "" : cal.slice(i, cal.indexOf("\n  });", i));
};
const all = /queryClient\.invalidateQueries\(\)/;
const adv = block("advanceMutation");
check("a day's advance refreshes every query (it refreshed only the calendar)", adv.includes("/api/calendar/advance") && /onSettled:\s*\(\) => \{ queryClient\.invalidateQueries\(\); \}/.test(adv));
check("Next match refreshes every query", all.test(block("nextMatchMutation")));
check("the match day's dismiss and skip refresh every query",
  /const refreshAfterMatch = \(\) => queryClient\.invalidateQueries\(\);/.test(cal) && /onSuccess:\s*refreshAfterMatch/.test(block("dismissMatchMutation")) && /onSuccess:\s*refreshAfterMatch/.test(block("skipMatchMutation")));

const panel = src("components/calendar-panel.tsx");
check("the auto-advance ticker moves the clock through that same mutation, and no other way",
  /advanceMutation\.mutate\(undefined,/.test(panel) && !/\/api\/calendar\/advance/.test(panel));

const pages = ["pages/players.tsx", "pages/staff-market.tsx", "pages/medical-market.tsx", "pages/youth-academy.tsx"];
const pinned = pages.filter((p) => /refetchOnMount:\s*false|enabled:\s*false|staleTime:\s*Infinity/.test(src(p)));
check("no market page pins its data against a refresh", pinned.length === 0, pinned.join(", "));

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
