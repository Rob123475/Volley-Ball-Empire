/**
 * R-68 — a running clock is visibly running.
 *
 * Rob's play-through: pressing Play gave no feedback — at Slow the date only
 * changes every 3 seconds, so the game looked frozen. The calendar panel now
 * replays a tick animation on the date for every simulated day, fills a bar
 * across the ticker's interval, and pulses a dot beside the speed while the
 * clock runs.
 *
 * Static: the source and the built bundle both carry it. The on-screen check is
 * Rob's (RELEASE-STATUS section 2).
 *
 * Usage: node harness/calendar-tick.mjs
 */
import fs from "node:fs";
import path from "node:path";

const REPO = path.join(import.meta.dirname, "..");
let failures = 0, checks = 0;
function check(label, cond, detail = "") {
  checks++;
  if (cond) console.log(`  PASS  ${label}${detail ? "  " + detail : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail ? "  " + detail : ""}`); }
}

console.log("=".repeat(72));
console.log("  R-68 THE CALENDAR CLOCK TICKS VISIBLY");
console.log("=".repeat(72));

const panel = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/components/calendar-panel.tsx"), "utf8");
const css = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/index.css"), "utf8");
const hook = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/hooks/use-calendar.ts"), "utf8");

check("running means a speed is set and no match is waiting",
  /const isRunning = speed !== "pause" && !calendar\.pendingMatchId;/.test(panel));
check("the date is keyed on the current date and replays the tick animation while running",
  /key=\{calendar\.currentDate\}/.test(panel) && /isRunning && "vbe-date-tick"/.test(panel));
check("a bar fills across the ticker's own interval, restarting each day",
  /key=\{`tick-\$\{calendar\.currentDate\}`\}/.test(panel) && /const tickMs\s+= SPEED_MS\[speed\];/.test(panel)
    && /animationDuration: `\$\{tickMs\}ms`/.test(panel) && /vbe-tick-bar/.test(panel));
check("a pulsing dot shows beside the speed while the clock runs",
  /isRunning && \(\s*<span\s+data-testid="calendar-running-dot"/.test(panel) && /vbe-running-dot/.test(panel));
check("the animations exist in the stylesheet, and motion is reduced when the player asks",
  /@keyframes vbe-date-tick/.test(css) && /@keyframes vbe-tick-bar/.test(css) && /@keyframes vbe-running-dot/.test(css)
    && /prefers-reduced-motion: reduce/.test(css));
const slow = /slow:\s+(\d+)/.exec(hook)?.[1];
check("the ticker intervals are the ones the bar uses", !!slow && /SPEED_MS/.test(panel), `slow ${slow} ms`);

const assets = path.join(REPO, "artifacts/api-server/dist/public/assets");
if (fs.existsSync(assets)) {
  const bundle = fs.readdirSync(assets).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n");
  const styles = fs.readdirSync(assets).filter((f) => f.endsWith(".css")).map((f) => fs.readFileSync(path.join(assets, f), "utf8")).join("\n");
  check("the built bundle the server serves carries the tick, the bar and the dot",
    /calendar-tick-bar/.test(bundle) && /calendar-running-dot/.test(bundle) && /vbe-date-tick/.test(bundle)
      && /vbe-tick-bar/.test(styles) && /vbe-running-dot/.test(styles));
} else {
  check("the built bundle the server serves carries the tick, the bar and the dot", false, `${assets} not built`);
}

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
