// Monday brief A: how far the first dig after a serve can land from the teammate, for every
// senior and AI club player in the starter DB, by MatchManager.CalculateRandomTarget's own
// formula (PASS): radius 1.0-2.0 m x defenceFactor (1.5 - digScore/150, clamped 0.15-2.5),
// digScore = defense*sf + speed*sf + stamina + overall*0.1 (sf: 1 fresh, down to 0.6 when
// her match stamina is spent), x1.35 in light rain.
// Usage: node scripts/webgl-proof/dig-spread.cjs [starter db]
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");
const db = new DatabaseSync(process.argv[2] ?? path.join(__dirname, "../../lib/db/volleyball-empire.sqlite"), { readOnly: true });
const cols = "name, speed, power, defense, serve, block, stamina";
const rows = db.prepare(`SELECT ${cols} FROM players WHERE player_type = 'senior'`).all()
  .concat(db.prepare(`SELECT ${cols} FROM continental_pool_players`).all());
const overall = (p) => Math.round((p.speed + p.power + p.defense + p.serve + p.block + p.stamina) / 6);
const maxRadius = (p, sf) => 2.0 * Math.min(2.5, Math.max(0.15, 1.5 - (p.defense * sf + p.speed * sf + p.stamina + overall(p) * 0.1) / 150));
const r = rows.map((p) => ({ name: p.name, fresh: maxRadius(p, 1), tired: maxRadius(p, 0.6) }));
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };
const out = {
  players: r.length,
  freshMax: { median: pct(r.map((x) => x.fresh), 0.5), p90: pct(r.map((x) => x.fresh), 0.9), max: Math.max(...r.map((x) => x.fresh)), over1m: r.filter((x) => x.fresh > 1).length },
  tiredMax: { median: pct(r.map((x) => x.tired), 0.5), p90: pct(r.map((x) => x.tired), 0.9), max: Math.max(...r.map((x) => x.tired)), over1m: r.filter((x) => x.tired > 1).length },
  tiredInRainMax: Math.max(...r.map((x) => x.tired)) * 1.35,
  worst: r.sort((a, b) => b.tired - a.tired).slice(0, 5).map((x) => `${x.name}: fresh ${x.fresh.toFixed(2)} m, tired ${x.tired.toFixed(2)} m`),
};
console.log(JSON.stringify(out, null, 1));
