// The 96's measurements against their 10 Oct bands: per band, then the best ordinal cuts on ITA and on L*.
import fs from "node:fs";
const D = "C:/Users/rbonn/AppData/Local/Temp/claude/C--Users-rbonn-Documents-Volley-Ball-Empire/54cc9745-a477-447f-b437-e75a71833592/scratchpad/itemC";
const BANDS = ["Light", "Medium Light", "Medium", "Medium Dark", "Dark"];
const known = JSON.parse(fs.readFileSync(`${D}/known-m.json`, "utf8"));
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
for (const b of BANDS) {
  const r = known.filter((k) => k.band === b);
  console.log(`${b.padEnd(13)} n=${String(r.length).padStart(2)}  ITA ${Math.min(...r.map((k) => k.ita))}..${Math.max(...r.map((k) => k.ita))} (median ${med(r.map((k) => k.ita))})  L ${Math.min(...r.map((k) => k.L))}..${Math.max(...r.map((k) => k.L))} (median ${med(r.map((k) => k.L))})`);
}
// Best four cuts (descending metric: Light highest), by exhaustive search over the observed values.
function best(metric) {
  const vals = [...new Set(known.map((k) => k[metric]))].sort((a, b) => b - a);
  const mids = vals.slice(0, -1).map((v, i) => (v + vals[i + 1]) / 2);
  let top = { hit: -1 };
  const n = mids.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    const cuts = [mids[a], mids[b], mids[c], mids[d]];
    let hit = 0;
    for (const k of known) { const i = cuts.filter((t) => k[metric] < t).length; if (BANDS[i] === k.band) hit++; }
    if (hit > top.hit) top = { hit, cuts };
  }
  return top;
}
const out = {};
for (const m of ["ita", "L"]) {
  const t = best(m);
  const within1 = known.filter((k) => Math.abs(t.cuts.filter((c) => k[m] < c).length - BANDS.indexOf(k.band)) <= 1).length;
  console.log(`${m}: cuts ${t.cuts.map((c) => c.toFixed(1)).join(" / ")}: ${t.hit}/96 exact, ${within1}/96 within one band`);
  out[m] = t.cuts;
}
fs.writeFileSync(`${D}/cuts.json`, JSON.stringify(out));
