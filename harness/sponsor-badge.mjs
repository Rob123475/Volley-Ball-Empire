/**
 * Overnight brief 30 Sep, item 28 — the Sponsor Reputation badge is readable.
 *
 * Rob, 30 Sep: "RELIABLE" was orange text on orange. The badge was the
 * theme's "secondary" badge, whose ground in the game's dark theme is sand
 * gold (hsl 30 90% 67%), with the tier's colour as its text: yellow-500 on it.
 *
 * Asserted: the badge now sits on the card's dark ground (bg-card) with the
 * tier's border, and every tier's text colour on that ground passes WCAG AA
 * for normal text (4.5:1); the old pairing is reported, and fails.
 *
 * Usage: node harness/sponsor-badge.mjs
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
console.log("  OVERNIGHT 30 SEP, 28: THE SPONSOR REPUTATION BADGE IS READABLE");
console.log("=".repeat(72));

const fin = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/pages/finances.tsx"), "utf8");
const css = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/src/index.css"), "utf8");
const html = fs.readFileSync(path.join(REPO, "artifacts/beach-volleyball/index.html"), "utf8");

// Tailwind's 500 shades (v3/v4 hex equivalents).
const TW = { red: "#ef4444", orange: "#f97316", yellow: "#eab308", blue: "#3b82f6", purple: "#a855f7", green: "#22c55e" };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hsl = (h, s, l) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))); };
const lum = ([r, g, b]) => { const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const token = (block, name) => { const m = new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(block); return m ? hsl(+m[1], +m[2], +m[3]) : null; };
const dark = css.slice(css.search(/\.dark\s*\{/));

check("the game runs in its dark theme", /<html[^>]*class="dark"/.test(html));
const card = token(dark, "card"), secondary = token(dark, "secondary");
const tiers = [...fin.matchAll(/label: "(\w+)",\s*stars: \d, color: "text-(\w+)-500"/g)].map((m) => ({ label: m[1], colour: m[2] }));
check("the badge is on the card's dark ground with the tier's border, not the sand-gold secondary badge",
  /<Badge variant="outline" data-testid="sponsor-tier-badge" className=\{cn\("text-xs font-bold uppercase bg-card border-2", tier\.color, tier\.bg\)\}>/.test(fin));
const ratios = tiers.map((t) => ({ ...t, now: contrast(hex(TW[t.colour]), card), before: contrast(hex(TW[t.colour]), secondary) }));
check("every tier's word passes WCAG AA (4.5:1) on it", ratios.length === 5 && ratios.every((r) => r.now >= 4.5),
  ratios.map((r) => `${r.label} ${r.now.toFixed(1)}:1`).join(", "));
const rel = ratios.find((r) => r.label === "Reliable");
check("(the old badge: RELIABLE, yellow on sand gold, failed)", rel && rel.before < 3, `${rel?.before.toFixed(2)}:1 before, ${rel?.now.toFixed(1)}:1 now`);

console.log(`\n=== ${checks - failures}/${checks} passed ===`);
process.exit(failures > 0 ? 1 : 0);
