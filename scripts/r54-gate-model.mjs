// R-54: how the ranking-point tier gate plays out over the real World Tour schedule.
// Read-only and deterministic (seeded): parses artifacts/api-server/src/data/worldTour.ts.
// Mirrors utils/rankingPoints.ts (Bronze 1, Silver 2, Gold 4) and utils/tierQualification.ts
// (a win at a gated tier scores only if the club already holds its threshold: Silver 15,
// Gold 40; below it the win scores 0). Finals are excluded (they come after every gated event).
//
// Usage: node scripts/r54-gate-model.mjs
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.join(import.meta.dirname, "..", "artifacts", "api-server", "src", "data", "worldTour.ts"), "utf8");
const body = src.slice(src.indexOf("export const WORLD_TOUR"));
const events = body.split(/\n\s*\{\s*\r?\n/).slice(1).map((b) => ({
  round: Number(b.match(/round:\s*(\d+)/)?.[1]),
  tier: b.match(/tier:\s*"([^"]+)"/)?.[1],
})).filter((e) => e.round && e.tier && !/World/.test(e.tier)).sort((a, b) => a.round - b.round);

const POINTS = { Bronze: 1, Silver: 2, Gold: 4 };
const THRESH = { Bronze: 0, Silver: 15, Gold: 40 };
const tierOf = (pts) => (pts >= 40 ? "Gold" : pts >= 15 ? "Silver" : "Bronze");

console.log(`${events.length} regular events; by tier: ` +
  Object.entries(events.reduce((m, e) => ({ ...m, [e.tier]: (m[e.tier] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(", "));
console.log("order: " + events.map((e) => e.tier[0]).join(""));

function season(start, winP, rng) {
  let pts = start, wins = 0, gatedWins = 0;
  const byTier = { Bronze: 0, Silver: 0, Gold: 0 };
  let silverAt = start >= 15 ? 0 : null, goldAt = start >= 40 ? 0 : null;
  events.forEach((e, i) => {
    if (rng() >= winP) return;
    wins++;
    if (pts < THRESH[e.tier]) { gatedWins++; return; }
    pts += POINTS[e.tier];
    byTier[e.tier] += POINTS[e.tier];
    if (silverAt == null && pts >= 15) silverAt = i + 1;
    if (goldAt == null && pts >= 40) goldAt = i + 1;
  });
  return { pts, wins, gatedWins, byTier, silverAt, goldAt };
}

for (const start of [0, 20]) {
  const r = season(start, 1, () => 0);
  console.log(`\nwin EVERY regular match, starting at ${start}: ${r.pts} pts (${r.pts - start} earned), tier ${tierOf(r.pts)}; wins that scored 0 (gated): ${r.gatedWins}; ` +
    `Silver unlocked after event ${r.silverAt}, Gold after event ${r.goldAt}; earned by tier ${JSON.stringify(r.byTier)}`);
}

let seed = 12345;
const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const N = 20000;
console.log(`\nMonte Carlo, ${N} seasons each, independent win probability per regular match (finals excluded):`);
console.log("start | win% | mean wins | mean pts | P(>=15 Silver) | P(>=40 Gold) | mean gated wins (scored 0)");
for (const start of [0, 20]) {
  for (const p of [0.35, 0.45, 0.55, 0.65, 0.75, 0.85]) {
    let sumPts = 0, sumWins = 0, silver = 0, gold = 0, gated = 0;
    for (let i = 0; i < N; i++) {
      const r = season(start, p, rng);
      sumPts += r.pts; sumWins += r.wins; gated += r.gatedWins;
      if (r.pts >= 15) silver++;
      if (r.pts >= 40) gold++;
    }
    console.log(`${String(start).padStart(5)} | ${String(Math.round(p * 100)).padStart(4)} | ${(sumWins / N).toFixed(1).padStart(9)} | ${(sumPts / N).toFixed(1).padStart(8)} | ${(100 * silver / N).toFixed(1).padStart(13)}% | ${(100 * gold / N).toFixed(1).padStart(11)}% | ${(gated / N).toFixed(1)}`);
  }
}
