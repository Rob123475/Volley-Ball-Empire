/**
 * R-75 — pool players' skin tones, drawn from their nation's own distribution.
 *
 * The distribution is counted, not written by hand. For each seeded player
 * (origin_career_save_id IS NULL) it counts nationality →
 * player_v4.visual_identity.skin_tone. Nations are resolved with nationName(),
 * because pool players store demonyms ("German") and seniors store country
 * names ("Germany").
 *
 * A pool player whose nation has no seeded player draws from her continent's
 * distribution, counted the same way. A player with neither stops the run:
 * there is no hand-made nation→tone table to fall back on.
 *
 * The draw is seeded by her stable_id, so a re-run writes the same tones.
 * Teammates of one nation draw from the same distribution, so a pair usually
 * looks like one country.
 *
 * Usage (from scripts/):  npx tsx src/seed-pool-skin-tones.ts <sqlite file> [--apply]
 * Without --apply it only reports.
 */
import { DatabaseSync } from "node:sqlite";
import { continentKeyForNationality, nationName } from "@workspace/db/schema";

const BANDS = ["Light", "Medium Light", "Medium", "Medium Dark", "Dark"] as const;

/** FNV-1a, then mulberry32: a reproducible number in [0, 1) per key. */
function seededUnit(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  let t = (h + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const [file, flag] = process.argv.slice(2);
if (!file) { console.error("usage: tsx src/seed-pool-skin-tones.ts <sqlite file> [--apply]"); process.exit(2); }
const apply = flag === "--apply";
const d = new DatabaseSync(file);
const hasColumn = (table: string, col: string) =>
  (d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);

type Counts = Record<string, number>;
const byNation = new Map<string, Counts>();
const byContinent = new Map<string, Counts>();
const seeded = d.prepare(
  `SELECT nationality, json_extract(player_v4, '$.visual_identity.skin_tone') AS tone
   FROM players WHERE origin_career_save_id IS NULL`,
).all() as { nationality: string | null; tone: string | null }[];
let counted = 0;
for (const p of seeded) {
  if (!p.tone || !(BANDS as readonly string[]).includes(p.tone)) continue;
  counted++;
  const nation = nationName(p.nationality) ?? p.nationality ?? "";
  const cont = continentKeyForNationality(p.nationality) ?? "";
  for (const [map, key] of [[byNation, nation], [byContinent, cont]] as const) {
    const c = map.get(key) ?? {};
    c[p.tone] = (c[p.tone] ?? 0) + 1;
    map.set(key, c);
  }
}
console.log(`R-75 distribution: ${seeded.length} seeded players, ${counted} with a tone, ${byNation.size} nations, ${byContinent.size} continents`);

function draw(counts: Counts, key: string): string {
  const total = BANDS.reduce((s, b) => s + (counts[b] ?? 0), 0);
  let r = seededUnit(key) * total;
  for (const b of BANDS) { r -= counts[b] ?? 0; if (r < 0) return b; }
  return BANDS[BANDS.length - 1]!;
}

const hadTone = hasColumn("continental_pool_players", "skin_tone");
const pool = d.prepare(
  `SELECT id, pool_team_id, stable_id, name, nationality, ${hadTone ? "skin_tone" : "NULL AS skin_tone"}
   FROM continental_pool_players ORDER BY pool_team_id, id`,
).all() as { id: number; pool_team_id: number; stable_id: string; name: string; nationality: string; skin_tone: string | null }[];

const tones = new Map<number, string>();
const viaContinent: string[] = [];
const unresolved: string[] = [];
for (const p of pool) {
  const nation = nationName(p.nationality) ?? p.nationality;
  let counts = byNation.get(nation);
  let source = `nation ${nation}`;
  if (!counts) {
    const cont = continentKeyForNationality(p.nationality);
    counts = cont ? byContinent.get(cont) : undefined;
    source = `continent ${cont}`;
    if (counts) viaContinent.push(`${p.nationality} (${cont})`);
  }
  if (!counts) { unresolved.push(`${p.name} (${p.nationality})`); continue; }
  const tone = draw(counts, `r75:${p.stable_id}`);
  tones.set(p.id, tone);
  const dist = BANDS.map((b) => counts![b] ?? 0).join("/");
  console.log(`  ${p.name.padEnd(24)} ${p.nationality.padEnd(18)} ${tone.padEnd(13)} from ${source} [L/ML/M/MD/D ${dist}]`);
}

const changed = pool.filter((p) => tones.has(p.id) && tones.get(p.id) !== p.skin_tone).length;
const pairs = new Map<number, string[]>();
for (const p of pool) pairs.set(p.pool_team_id, [...(pairs.get(p.pool_team_id) ?? []), tones.get(p.id) ?? ""]);
const sameTone = [...pairs.values()].filter((t) => t.length === 2 && t[0] === t[1]).length;
console.log(`\nR-75 tones: ${tones.size} of ${pool.length} pool players; ${changed} changed from what the table held (${hadTone ? "skin_tone column existed" : "there was no skin_tone column: every pool player had no tone"})`);
console.log(`  drew from the continent's distribution (nation had no seeded player): ${viaContinent.length}${viaContinent.length ? ": " + [...new Set(viaContinent)].join(", ") : ""}`);
console.log(`  pairs whose two players share a tone: ${sameTone} of ${pairs.size}`);
console.log(`  bands: ${BANDS.map((b) => `${b} ${[...tones.values()].filter((t) => t === b).length}`).join(", ")}`);
if (unresolved.length > 0) throw new Error(`no distribution for ${unresolved.join(", ")}; refusing to invent one`);

if (!apply) { console.log("\n(dry run — pass --apply to write)"); d.close(); process.exit(0); }

d.exec("BEGIN");
if (!hadTone) d.exec("ALTER TABLE continental_pool_players ADD COLUMN skin_tone text");
const setTone = d.prepare("UPDATE continental_pool_players SET skin_tone = ? WHERE id = ?");
for (const [id, t] of tones) setTone.run(t, id);
d.exec("COMMIT");
d.exec("PRAGMA wal_checkpoint(TRUNCATE)");
d.close();
console.log(`\napplied to ${file}`);
