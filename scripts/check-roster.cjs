#!/usr/bin/env node
/**
 * Build gate for the world roster.
 *
 * The world is ten nations per region with three players each. That shape is
 * declared as DATA in lib/db/src/schema/continents.ts (CORE_NATIONS,
 * RESERVE_NATIONS, PLAYERS_PER_NATION) and this check holds the database to
 * whatever is declared there.
 *
 * ── Written to make the world GROW, not to freeze it ────────────────────────
 * Nothing here hardcodes "ten" or "three". Adding a nation to CORE_NATIONS and
 * giving it PLAYERS_PER_NATION players passes. Raising PLAYERS_PER_NATION and
 * adding the players passes. What CANNOT happen is a half-landed expansion: a
 * nation declared with no players, players for a nation nobody declared, or a
 * nation left one player short all fail the build with the exact shortfall.
 *
 * That matters most for the case this guard was written for. Youth keep their
 * nationality when promoted, so an academy player from a nation outside the
 * roster becomes a senior of that nation in season two - silently widening the
 * world and stranding her without team-mates. On a screen, months later.
 *
 * Everything is DERIVED. The roster is parsed out of continents.ts rather than
 * restated here; a second copy of the world's shape in this file would be the
 * very drift being guarded against.
 *
 * Run: node scripts/check-roster.cjs [path-to-db]
 */
const fs = require("fs");
const path = require("path");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  console.error(
    "[check-roster] FAILED: node:sqlite unavailable (needs Node >= 22).\n" +
      "  This check reads the shipped database and must not be skipped silently.",
  );
  process.exit(1);
}

const REPO = path.join(__dirname, "..");
const CONTINENTS_TS = path.join(REPO, "lib", "db", "src", "schema", "continents.ts");
const DB = process.argv[2] || path.join(REPO, "lib", "db", "volleyball-empire.sqlite");

// ── Read the declaration ────────────────────────────────────────────────────
function readRoster() {
  const src = fs.readFileSync(CONTINENTS_TS, "utf8");

  const block = src.match(/export const CORE_NATIONS[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) fail("could not find CORE_NATIONS in continents.ts");

  const core = {};
  for (const m of block[1].matchAll(/(\w+)\s*:\s*\[([\s\S]*?)\]/g)) {
    core[m[1]] = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  }
  if (Object.keys(core).length === 0) fail("CORE_NATIONS parsed as empty");

  const res = src.match(/export const RESERVE_NATIONS[^=]*=\s*\[([\s\S]*?)\];/);
  const reserve = res ? [...res[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];

  const per = src.match(/export const PLAYERS_PER_NATION\s*=\s*(\d+)/);
  if (!per) fail("could not find PLAYERS_PER_NATION in continents.ts");

  return { core, reserve, perNation: Number(per[1]) };
}

function fail(msg) {
  console.error(`[check-roster] FAILED: ${msg}`);
  process.exit(1);
}

function main() {
  if (!fs.existsSync(DB)) fail(`database not found at ${DB}`);

  const { core, reserve, perNation } = readRoster();
  const reserveSet = new Set(reserve);
  const db = new DatabaseSync(DB, { readOnly: true });
  const q = (s, ...a) => db.prepare(s).all(...a);

  const regions = Object.keys(core);
  console.log(
    `[check-roster] declared: ${regions.length} regions x ` +
      `${core[regions[0]].length} nations x ${perNation} players` +
      `  (+${reserve.length} reserve nations)`,
  );

  const problems = [];

  // ── seniors: every core nation at exactly PLAYERS_PER_NATION ─────────────
  for (const region of regions) {
    const counts = new Map(
      q(
        `SELECT nationality, COUNT(*) n FROM players
          WHERE player_type = 'senior' AND continent = ? GROUP BY nationality`,
        region,
      ).map((r) => [r.nationality, r.n]),
    );

    for (const nation of core[region]) {
      const n = counts.get(nation) ?? 0;
      if (n !== perNation) {
        problems.push(
          `${region}: ${nation} has ${n} senior${n === 1 ? "" : "s"}, expected ${perNation}` +
            (n === 0 ? "  (declared in CORE_NATIONS but no players exist)" : ""),
        );
      }
      counts.delete(nation);
    }
    // anything left is a nation nobody declared
    for (const [nation, n] of counts) {
      if (reserveSet.has(nation)) continue;
      problems.push(
        `${region}: ${n} senior${n === 1 ? "" : "s"} from ${nation}, which is in neither ` +
          `CORE_NATIONS nor RESERVE_NATIONS`,
      );
    }
  }

  // ── youth: must belong to a core nation of their own region ──────────────
  // A promoted youth becomes a senior of her nationality, so an off-roster
  // academy player is a season-two widening of the world, not a cosmetic one.
  for (const region of regions) {
    const allowed = new Set(core[region]);
    for (const r of q(
      `SELECT nationality, COUNT(*) n FROM players
        WHERE player_type = 'youth' AND continent = ? GROUP BY nationality`,
      region,
    )) {
      if (!allowed.has(r.nationality)) {
        problems.push(
          `${region}: ${r.n} youth from ${r.nationality}, which is not one of that ` +
            `region's nations - promoting them would widen the world silently`,
        );
      }
    }
  }

  // ── report ───────────────────────────────────────────────────────────────
  for (const region of regions) {
    const s = q(
      `SELECT COUNT(*) n FROM players WHERE player_type = 'senior' AND continent = ?`,
      region,
    )[0].n;
    const y = q(
      `SELECT COUNT(*) n FROM players WHERE player_type = 'youth' AND continent = ?`,
      region,
    )[0].n;
    console.log(`    ${region.padEnd(20)} ${String(s).padStart(3)} seniors  ${String(y).padStart(3)} youth`);
  }
  if (reserve.length) {
    const held = reserve
      .map((n) => {
        const c = q(`SELECT COUNT(*) n FROM players WHERE nationality = ?`, n)[0].n;
        return `${n}=${c}`;
      })
      .join("  ");
    console.log(`    reserve (not counted): ${held}`);
  }

  if (problems.length) {
    console.error(`\n[check-roster] FAILED: ${problems.length} problem(s)`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      "\n  To ADD a nation: put it in CORE_NATIONS for its region and give it\n" +
        `  ${perNation} players. To change squad depth: edit PLAYERS_PER_NATION and\n` +
        "  add the players. Both are data edits in continents.ts - this guard\n" +
        "  follows whatever is declared there.",
    );
    process.exit(1);
  }

  console.log("\n[check-roster] OK — the database matches the declared world.");
}

main();
