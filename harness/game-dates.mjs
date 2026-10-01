/**
 * Overnight brief 1 Oct, N-37 (Rob, 1 Oct): loan dates showed "2026-09-22". A
 * game date is shown in the game's style, "22 Sep 2026" (the Matches page's),
 * everywhere: the Youth Loans tab, and the other raw dates a sweep found (staff
 * and medical contract ends, the contract-renewal bar, sponsor offers' expiry,
 * the Olympics' date) and in text the server writes (Club News, news, the
 * ledger, refusals).
 *
 * Asserted without a server: the page formatter turns "2026-09-22" into
 * "22 Sep 2026" (and a full timestamp by its date part); the server's text
 * formatter is the same rule; no page renders a date field raw; the server's
 * player-facing strings format theirs. The Youth Loans tab itself is pictured by
 * scripts/webgl-proof/d-items-proof.mjs loan-dates.
 *
 * Usage: node harness/game-dates.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { gameDateText } from "../artifacts/beach-volleyball/src/lib/game-date.ts";

const REPO = path.join(import.meta.dirname, "..");
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}
console.log("=".repeat(72));
console.log("  OVERNIGHT 1 OCT, N-37: DATES IN THE GAME'S STYLE");
console.log("=".repeat(72));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);

check("the page formatter: \"2026-09-22\" -> \"22 Sep 2026\", a timestamp by its date",
  gameDateText("2026-09-22") === "22 Sep 2026" && gameDateText("2027-01-08T14:00:00.000Z") === "8 Jan 2027" && gameDateText(null) === "",
  `${gameDateText("2026-09-22")}, ${gameDateText("2027-01-08T14:00:00.000Z")}`);
const serverFmt = fs.readFileSync(path.join(REPO, "artifacts/api-server/src/utils/gameDate.ts"), "utf8");
check("the server's text formatter is the same rule", /export function gameDateText/.test(serverFmt)
  && serverFmt.includes('["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]')
  && serverFmt.includes("`${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`"));

const FIELDS = "endsOn|startsOn|expiresAt|playedOn|olympicsDate|contractEndDate|endDate|startDate";
const rawJsx = new RegExp(`\\{[\\w.?]*\\b(${FIELDS})\\}`, "g");
const rawTpl = new RegExp(`\\$\\{[\\w.?]*\\b(${FIELDS})\\}`, "g");
const pages = walk(path.join(REPO, "artifacts/beach-volleyball/src")).filter((f) => f.endsWith(".tsx"));
const pageHits = pages.flatMap((f) => fs.readFileSync(f, "utf8").split("\n").map((l, i) => ({ f, i, l })))
  .filter(({ l }) => (l.match(rawJsx) || l.match(rawTpl)) && !/key=|Date\.parse|new Date\(|=\{[\w.?]*(Date|On)\}|endDate=|gameDate=|startDate=/.test(l));
check("no page renders a date field raw", pageHits.length === 0,
  pageHits.slice(0, 5).map((h) => `${path.relative(REPO, h.f)}:${h.i + 1}`).join(", ") || `${pages.length} pages swept`);

const SERVER_TEXT = ["routes/calendar.ts", "routes/continental-scouting.ts", "routes/contracts.ts", "routes/players.ts", "routes/staff.ts", "routes/news.ts"];
const serverHits = SERVER_TEXT.flatMap((f) => fs.readFileSync(path.join(REPO, "artifacts/api-server/src", f), "utf8").split("\n").map((l, i) => ({ f, i, l })))
  .filter(({ l }) => /(description|detail|error|events\.push)/.test(l) && new RegExp(`\\$\\{[\\w.]*\\b(endsOn|endDate|contractEndDate)\\b(\\.slice\\([^)]*\\))?\\}`).test(l));
check("the server's player-facing text formats its dates", serverHits.length === 0,
  serverHits.map((h) => `${h.f}:${h.i + 1}`).join(", ") || "loans, missions, contracts, staff, news");

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
