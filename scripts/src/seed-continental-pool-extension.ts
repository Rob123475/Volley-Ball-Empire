/**
 * Extends the continental pool from 8 to 10 teams per continent by adding
 * 2 new inactive pool teams per continent (stableIds _09 and _10, poolRanking
 * 9 and 10). Shadow-player data is sourced from real senior-player records.
 *
 * Run:  pnpm --filter @workspace/scripts run seed-continental-pool-extension
 * Idempotent: skips any stableId that already exists.
 */

import { db, sqlite } from "@workspace/db";
import {
  continentalPoolTeamsTable,
  continentalPoolPlayersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

type PlayerDef = {
  stableId: string;
  name: string;
  nationality: string;
  age: number;
  speed: number;
  power: number;
  defense: number;
  serve: number;
  block: number;
  stamina: number;
  imageUrl: string;
};

type TeamDef = {
  stableId: string;
  continent: string;
  teamName: string;
  rating: number;
  form: number;
  fitness: number;
  fatigue: number;
  poolRanking: number;
  players: [PlayerDef, PlayerDef];
};

// ── 12 new pool teams (2 per continent, poolRanking 9 and 10) ─────────────────
// Shadow-player stats and imageUrls sourced from real senior-player records.

const NEW_TEAMS: TeamDef[] = [
  // ── Africa and Middle East ────────────────────────────────────────────────
  {
    stableId: "AFM_09",
    continent: "Africa and Middle East",
    teamName: "Tunis Mediterranean Aces",
    rating: 60, form: 35, fitness: 100, fatigue: 0, poolRanking: 9,
    players: [
      {
        stableId: "AFM_09_P1",
        name: "Sarah Ben Ammar", nationality: "Tunisian", age: 24,
        speed: 74, power: 72, defense: 74, serve: 73, block: 71, stamina: 76,
        imageUrl: "/images/players/seniors/player_senior_tunisia_01.webp",
      },
      {
        stableId: "AFM_09_P2",
        name: "Habiba Mzoughi", nationality: "Tunisian", age: 25,
        speed: 67, power: 81, defense: 65, serve: 62, block: 88, stamina: 70,
        imageUrl: "/images/players/seniors/player_senior_tunisia_02.webp",
      },
    ],
  },
  {
    stableId: "AFM_10",
    continent: "Africa and Middle East",
    teamName: "Dar es Salaam Swahili Stars",
    rating: 57, form: 32, fitness: 100, fatigue: 0, poolRanking: 10,
    players: [
      {
        stableId: "AFM_10_P1",
        name: "Zawadi Kimaro", nationality: "Tanzanian", age: 27,
        speed: 72, power: 71, defense: 72, serve: 71, block: 69, stamina: 72,
        imageUrl: "/images/players/seniors/player_senior_tanzania_03.webp",
      },
      {
        stableId: "AFM_10_P2",
        name: "Asha Msuya", nationality: "Tanzanian", age: 25,
        speed: 66, power: 78, defense: 65, serve: 62, block: 83, stamina: 71,
        imageUrl: "/images/players/seniors/player_senior_tanzania_01.webp",
      },
    ],
  },

  // ── Asia ──────────────────────────────────────────────────────────────────
  {
    stableId: "ASI_09",
    continent: "Asia",
    teamName: "Ho Chi Minh City Delta Stars",
    rating: 62, form: 35, fitness: 100, fatigue: 0, poolRanking: 9,
    players: [
      {
        stableId: "ASI_09_P1",
        name: "Nguyen Mai Anh", nationality: "Vietnamese", age: 21,
        speed: 77, power: 64, defense: 75, serve: 83, block: 60, stamina: 76,
        imageUrl: "/images/players/seniors/player_senior_vietnam_03.webp",
      },
      {
        stableId: "ASI_09_P2",
        name: "Le Minh Anh", nationality: "Vietnamese", age: 21,
        speed: 76, power: 70, defense: 73, serve: 71, block: 68, stamina: 73,
        imageUrl: "/images/players/seniors/player_senior_vietnam_02.webp",
      },
    ],
  },
  {
    stableId: "ASI_10",
    continent: "Asia",
    teamName: "Taipei Formosa Spikers",
    rating: 59, form: 32, fitness: 100, fatigue: 0, poolRanking: 10,
    players: [
      {
        stableId: "ASI_10_P1",
        name: "Chen Yu-Hsin", nationality: "Taiwanese", age: 23,
        speed: 80, power: 81, defense: 62, serve: 70, block: 65, stamina: 76,
        imageUrl: "/images/players/seniors/player_senior_taiwan_02.webp",
      },
      {
        stableId: "ASI_10_P2",
        name: "Huang Yi-Ting", nationality: "Taiwanese", age: 22,
        speed: 81, power: 80, defense: 62, serve: 70, block: 64, stamina: 76,
        imageUrl: "/images/players/seniors/player_senior_taiwan_01.webp",
      },
    ],
  },

  // ── Australia and Pacific Islands ─────────────────────────────────────────
  {
    stableId: "AUS_09",
    continent: "Australia and Pacific Islands",
    teamName: "Port Moresby Coral Aces",
    rating: 61, form: 35, fitness: 100, fatigue: 0, poolRanking: 9,
    players: [
      {
        stableId: "AUS_09_P1",
        name: "Alina Kora", nationality: "Papua New Guinean", age: 25,
        speed: 82, power: 88, defense: 64, serve: 75, block: 70, stamina: 78,
        imageUrl: "/images/players/seniors/player_senior_papua_new_guinea_04.webp",
      },
      {
        stableId: "AUS_09_P2",
        name: "Kiriwina Tau", nationality: "Papua New Guinean", age: 21,
        speed: 73, power: 83, defense: 68, serve: 70, block: 77, stamina: 72,
        imageUrl: "/images/players/seniors/player_senior_papua_new_guinea_02.webp",
      },
    ],
  },
  {
    stableId: "AUS_10",
    continent: "Australia and Pacific Islands",
    teamName: "Wellington Southern Cross",
    rating: 58, form: 32, fitness: 100, fatigue: 0, poolRanking: 10,
    players: [
      {
        stableId: "AUS_10_P1",
        name: "Zoe Walker", nationality: "New Zealander", age: 25,
        speed: 68, power: 82, defense: 67, serve: 64, block: 86, stamina: 73,
        imageUrl: "/images/players/seniors/player_senior_new_zealand_01.webp",
      },
      {
        stableId: "AUS_10_P2",
        name: "Lily Mackenzie", nationality: "New Zealander", age: 23,
        speed: 84, power: 59, defense: 85, serve: 66, block: 53, stamina: 82,
        imageUrl: "/images/players/seniors/player_senior_new_zealand_02.webp",
      },
    ],
  },

  // ── Europe ────────────────────────────────────────────────────────────────
  {
    stableId: "EUR_09",
    continent: "Europe",
    teamName: "Lisbon Atlantic Blaze",
    rating: 63, form: 35, fitness: 100, fatigue: 0, poolRanking: 9,
    players: [
      {
        stableId: "EUR_09_P1",
        name: "Sofia Almeida", nationality: "Portuguese", age: 28,
        speed: 79, power: 83, defense: 63, serve: 71, block: 67, stamina: 76,
        imageUrl: "/images/players/seniors/player_senior_portugal_04.webp",
      },
      {
        stableId: "EUR_09_P2",
        name: "Aoife O'Sullivan", nationality: "Irish", age: 22,
        speed: 75, power: 71, defense: 74, serve: 72, block: 70, stamina: 74,
        imageUrl: "/images/players/seniors/player_senior_ireland_01.webp",
      },
    ],
  },
  {
    stableId: "EUR_10",
    continent: "Europe",
    teamName: "Dublin Emerald Spikers",
    rating: 60, form: 32, fitness: 100, fatigue: 0, poolRanking: 10,
    players: [
      {
        stableId: "EUR_10_P1",
        name: "Sara Borg", nationality: "Maltese", age: 22,
        speed: 75, power: 71, defense: 74, serve: 72, block: 70, stamina: 74,
        imageUrl: "/images/players/seniors/player_senior_malta_02.webp",
      },
      {
        stableId: "EUR_10_P2",
        name: "Yasmin Grech", nationality: "Maltese", age: 24,
        speed: 68, power: 80, defense: 66, serve: 63, block: 85, stamina: 72,
        imageUrl: "/images/players/seniors/player_senior_malta_01.webp",
      },
    ],
  },

  // ── North America ─────────────────────────────────────────────────────────
  {
    stableId: "NAM_09",
    continent: "North America",
    teamName: "Kingston Reggae Spikers",
    rating: 65, form: 35, fitness: 100, fatigue: 0, poolRanking: 9,
    players: [
      {
        stableId: "NAM_09_P1",
        name: "Kayla Thompson", nationality: "Jamaican", age: 23,
        speed: 80, power: 75, defense: 74, serve: 73, block: 65, stamina: 78,
        imageUrl: "/images/players/seniors/player_senior_jamaica_01.webp",
      },
      {
        stableId: "NAM_09_P2",
        name: "Niah Myers", nationality: "Jamaican", age: 22,
        speed: 84, power: 80, defense: 62, serve: 70, block: 63, stamina: 79,
        imageUrl: "/images/players/seniors/player_senior_jamaica_02.webp",
      },
    ],
  },
  {
    stableId: "NAM_10",
    continent: "North America",
    teamName: "Nassau Island Blazers",
    rating: 62, form: 32, fitness: 100, fatigue: 0, poolRanking: 10,
    players: [
      {
        stableId: "NAM_10_P1",
        name: "Aaliyah Rolle", nationality: "Bahamian", age: 25,
        speed: 76, power: 72, defense: 74, serve: 73, block: 70, stamina: 75,
        imageUrl: "/images/players/seniors/player_senior_bahamas_01.webp",
      },
      {
        stableId: "NAM_10_P2",
        name: "Jada Knowles", nationality: "Bahamian", age: 22,
        speed: 74, power: 64, defense: 73, serve: 81, block: 59, stamina: 74,
        imageUrl: "/images/players/seniors/player_senior_bahamas_02.webp",
      },
    ],
  },

  // ── South America ─────────────────────────────────────────────────────────
  {
    stableId: "SAM_09",
    continent: "South America",
    teamName: "Georgetown Guyana Waves",
    rating: 68, form: 35, fitness: 100, fatigue: 0, poolRanking: 9,
    players: [
      {
        stableId: "SAM_09_P1",
        name: "Nia Campbell", nationality: "Guyanese", age: 28,
        speed: 73, power: 85, defense: 79, serve: 78, block: 86, stamina: 79,
        imageUrl: "/images/players/seniors/player_senior_guyana_03.webp",
      },
      {
        stableId: "SAM_09_P2",
        name: "Amara James", nationality: "Guyanese", age: 26,
        speed: 84, power: 86, defense: 70, serve: 78, block: 74, stamina: 78,
        imageUrl: "/images/players/seniors/player_senior_guyana_01.webp",
      },
    ],
  },
  {
    stableId: "SAM_10",
    continent: "South America",
    teamName: "La Paz Andean Queens",
    rating: 65, form: 32, fitness: 100, fatigue: 0, poolRanking: 10,
    players: [
      {
        stableId: "SAM_10_P1",
        name: "Valeria Mamani", nationality: "Bolivian", age: 26,
        speed: 66, power: 79, defense: 66, serve: 62, block: 85, stamina: 71,
        imageUrl: "/images/players/seniors/player_senior_bolivia_04.webp",
      },
      {
        stableId: "SAM_10_P2",
        name: "Camila Torrez", nationality: "Bolivian", age: 21,
        speed: 79, power: 79, defense: 61, serve: 68, block: 63, stamina: 73,
        imageUrl: "/images/players/seniors/player_senior_bolivia_02.webp",
      },
    ],
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Continental Pool Extension ===");
  console.log(`Target: 12 new pool teams (2 per continent, poolRanking 9–10)\n`);

  let teamsInserted = 0;
  let teamsSkipped = 0;
  let playersInserted = 0;

  for (const teamDef of NEW_TEAMS) {
    // Idempotency check
    const [existing] = await db
      .select({ id: continentalPoolTeamsTable.id })
      .from(continentalPoolTeamsTable)
      .where(eq(continentalPoolTeamsTable.stableId, teamDef.stableId))
      .limit(1);

    if (existing) {
      console.log(`  [skip] ${teamDef.stableId} "${teamDef.teamName}" already exists (id=${existing.id})`);
      teamsSkipped++;
      continue;
    }

    // Insert team
    const [inserted] = await db
      .insert(continentalPoolTeamsTable)
      .values({
        continent:        teamDef.continent,
        stableId:         teamDef.stableId,
        teamName:         teamDef.teamName,
        rating:           teamDef.rating,
        form:             teamDef.form,
        fitness:          teamDef.fitness,
        fatigue:          teamDef.fatigue,
        poolRanking:      teamDef.poolRanking,
        promotionCount:   0,
        relegationCount:  0,
        isActiveInLeague: false,
      })
      .returning({ id: continentalPoolTeamsTable.id });

    if (!inserted) throw new Error(`Failed to insert team ${teamDef.stableId}`);

    teamsInserted++;
    console.log(`  [insert] ${teamDef.stableId} "${teamDef.teamName}" → id=${inserted.id}`);

    // Insert shadow players
    for (const p of teamDef.players) {
      // Idempotency check for player stableId
      const [existingPlayer] = await db
        .select({ id: continentalPoolPlayersTable.id })
        .from(continentalPoolPlayersTable)
        .where(eq(continentalPoolPlayersTable.stableId, p.stableId))
        .limit(1);

      if (existingPlayer) {
        console.log(`    [skip] player ${p.stableId} already exists`);
        continue;
      }

      await db.insert(continentalPoolPlayersTable).values({
        poolTeamId:  inserted.id,
        stableId:    p.stableId,
        name:        p.name,
        nationality: p.nationality,
        age:         p.age,
        speed:       p.speed,
        power:       p.power,
        defense:     p.defense,
        serve:       p.serve,
        block:       p.block,
        stamina:     p.stamina,
        imageUrl:    p.imageUrl,
      });

      playersInserted++;
      console.log(`    [insert] ${p.stableId} ${p.name} (${p.nationality})`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Teams  inserted: ${teamsInserted} / skipped: ${teamsSkipped}`);
  console.log(`Players inserted: ${playersInserted}`);

  // Validation totals
  const allTeams = await db
    .select({
      continent:        continentalPoolTeamsTable.continent,
      isActiveInLeague: continentalPoolTeamsTable.isActiveInLeague,
    })
    .from(continentalPoolTeamsTable)
    .orderBy(continentalPoolTeamsTable.continent);

  const byContinent = new Map<string, { total: number; active: number; bench: number }>();
  for (const t of allTeams) {
    const entry = byContinent.get(t.continent) ?? { total: 0, active: 0, bench: 0 };
    entry.total++;
    if (t.isActiveInLeague) entry.active++; else entry.bench++;
    byContinent.set(t.continent, entry);
  }

  console.log(`\n=== Pool teams by continent ===`);
  for (const [continent, counts] of [...byContinent.entries()].sort()) {
    console.log(`  ${continent}: ${counts.total} total (${counts.active} active, ${counts.bench} bench)`);
  }

  // Checkpoint so a raw file copy of the .sqlite (e.g. ensureUserDb, or
  // packaging the starter DB) never has to depend on the -wal sidecar too.
  sqlite.pragma("wal_checkpoint(TRUNCATE)");
}

main()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });
