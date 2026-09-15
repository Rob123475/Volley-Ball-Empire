/**
 * R-73 — every AI club's kit.
 *
 * Each continental pool club gets two hexes, a primary and a secondary. They
 * come from a kit palette, not the club's country flag:
 *   - 12 primaries, each paired with the first 6 secondaries that stand out
 *     against it (WCAG contrast ratio of at least 2.2), in a fixed order.
 *   - The club at position j (0–9, by id) of the continent at position c (0–5,
 *     by key) wears primary (j + 2c) mod 12 with that primary's c-th secondary.
 *   - So no two clubs of one continent share a primary, and no two clubs
 *     anywhere share a pair.
 *
 * Deterministic: a re-run writes the same colours.
 *
 * Usage (from scripts/):  npx tsx src/seed-pool-kits.ts <sqlite file> [--apply]
 * Without --apply it only reports.
 */
import { DatabaseSync } from "node:sqlite";

const PRIMARIES = [
  "#1B4F9C", // royal blue
  "#B3122E", // crimson
  "#00843D", // emerald
  "#F2A900", // amber
  "#5B2C83", // purple
  "#00A3AD", // teal
  "#E35205", // tangerine
  "#0B2545", // navy
  "#C2185B", // magenta
  "#7CB518", // lime
  "#6D1A36", // maroon
  "#37393B", // charcoal
];

const SECONDARIES = [
  "#FFFFFF", // white
  "#111111", // black
  "#FFD100", // gold
  "#6CC5F0", // sky
  "#B8BCC0", // silver
  "#0B2545", // navy
  "#FF7F6B", // coral
  "#98E2C6", // mint
  "#1E4D2B", // forest
  "#7A1F3D", // burgundy
  "#4E2A1E", // chocolate
  "#4B1F6F", // deep purple
];

const MIN_CONTRAST = 2.2;
const SECONDARIES_PER_PRIMARY = 6;

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const [file, flag] = process.argv.slice(2);
if (!file) { console.error("usage: tsx src/seed-pool-kits.ts <sqlite file> [--apply]"); process.exit(2); }
const apply = flag === "--apply";
const d = new DatabaseSync(file);
const hasColumn = (table: string, col: string) =>
  (d.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);

const pairsFor = PRIMARIES.map((p) => {
  const ok = SECONDARIES.filter((s) => s !== p && contrast(p, s) >= MIN_CONTRAST).slice(0, SECONDARIES_PER_PRIMARY);
  if (ok.length < SECONDARIES_PER_PRIMARY) throw new Error(`primary ${p} has only ${ok.length} contrasting secondaries`);
  return ok;
});

const clubs = d.prepare("SELECT id, continent, team_name FROM continental_pool_teams ORDER BY continent, id").all() as
  { id: number; continent: string; team_name: string }[];
const continents = [...new Set(clubs.map((c) => c.continent))].sort();
if (continents.length > SECONDARIES_PER_PRIMARY) throw new Error(`${continents.length} continents, more than ${SECONDARIES_PER_PRIMARY}`);

const kits = new Map<number, { name: string; primary: string; secondary: string }>();
for (const [ci, continent] of continents.entries()) {
  const members = clubs.filter((c) => c.continent === continent);
  if (members.length > PRIMARIES.length) throw new Error(`${continent} has ${members.length} clubs, more than ${PRIMARIES.length} primaries`);
  members.forEach((club, j) => {
    const p = (j + 2 * ci) % PRIMARIES.length;
    kits.set(club.id, { name: club.team_name, primary: PRIMARIES[p]!, secondary: pairsFor[p]![ci]! });
  });
}

const pairKeys = new Set([...kits.values()].map((k) => `${k.primary}/${k.secondary}`));
const lowest = Math.min(...[...kits.values()].map((k) => contrast(k.primary, k.secondary)));
console.log(`R-73 kits: ${kits.size} clubs, ${pairKeys.size} distinct pairs, ${continents.length} continents, lowest contrast ${lowest.toFixed(2)}`);
if (pairKeys.size !== kits.size) throw new Error("kit pairs are not distinct");
for (const [id, k] of kits) console.log(`  ${String(id).padStart(2)} ${k.primary} / ${k.secondary}  ${k.name}`);

if (!apply) { console.log("\n(dry run — pass --apply to write)"); d.close(); process.exit(0); }

d.exec("BEGIN");
if (!hasColumn("continental_pool_teams", "primary_color")) d.exec("ALTER TABLE continental_pool_teams ADD COLUMN primary_color text");
if (!hasColumn("continental_pool_teams", "secondary_color")) d.exec("ALTER TABLE continental_pool_teams ADD COLUMN secondary_color text");
const setKit = d.prepare("UPDATE continental_pool_teams SET primary_color = ?, secondary_color = ? WHERE id = ?");
for (const [id, k] of kits) setKit.run(k.primary, k.secondary, id);
d.exec("COMMIT");
d.exec("PRAGMA wal_checkpoint(TRUNCATE)");
d.close();
console.log(`\napplied to ${file}`);
