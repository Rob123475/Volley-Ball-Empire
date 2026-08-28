/**
 * Removes the original 30 placeholder free-agent players and 15 placeholder
 * free-agent staff created by seed-world-data.ts during early DB migration
 * testing. Matches by exact name AND teamId IS NULL, so it can never touch
 * a real player/staff member who happens to share a name and has since been
 * signed to a team.
 *
 * Run: DB_PATH=<path to sqlite file> pnpm --filter @workspace/scripts exec tsx ./src/remove-placeholder-world-data.ts
 */

import { db } from "@workspace/db";
import { playersTable, staffTable, careerPlayerStateTable } from "@workspace/db/schema";
import { and, eq, inArray, isNull, isNotNull, notExists, sql } from "drizzle-orm";

// Exact names from seed-world-data.ts
const PLACEHOLDER_PLAYER_NAMES = [
  "Lucas Ferreira", "Jake Sullivan", "Marco Rossi", "Kenji Watanabe", "Erik Johansson",
  "Diego Alvarez", "Tomasz Nowak", "Ryan Cooper", "Felipe Santos", "Anders Berg",
  "Bruno Costa", "Sam Whitfield", "Nikolai Petrov", "Rafael Gomez", "Owen Clarke",
  "Mateus Silva", "Jack Harrington", "Pedro Almeida", "Ollie Baxter", "Thiago Lima",
  "Carlos Mendez", "Liam Foster", "Andre Souza", "Noah Bennett", "Gustavo Reyes",
  "Ethan Marsh", "Rodrigo Pinto", "Callum Reid", "Vitor Araujo", "Harry Nolan",
];

const PLACEHOLDER_STAFF_NAMES = [
  "Roberto Alves", "Karen Whitman", "Fabio Bianchi", "Sandra Mueller", "Peter Larsson",
  "Isabel Marquez", "Tom Bradley", "Yuki Tanaka", "Klaus Weber", "Nadia Kowalski",
  "Simon Clarke", "Priya Sharma", "Henrik Olsen", "Claudia Ferrari", "David Okafor",
];

async function main() {
  console.log("=== Removing placeholder world-data seed rows ===\n");

  // "Not on a team" is career state now, not a column on the reference row, so
  // the guard is: no career anywhere has this player signed to a club.
  const deletedPlayers = await db
    .delete(playersTable)
    .where(
      and(
        inArray(playersTable.name, PLACEHOLDER_PLAYER_NAMES),
        notExists(
          db.select({ one: sql`1` })
            .from(careerPlayerStateTable)
            .where(and(
              eq(careerPlayerStateTable.playerId, playersTable.id),
              isNotNull(careerPlayerStateTable.teamId),
            )),
        ),
      ),
    )
    .returning({ id: playersTable.id, name: playersTable.name });

  console.log(`Removed ${deletedPlayers.length} placeholder players:`);
  for (const p of deletedPlayers) console.log(`  - ${p.name}`);

  const deletedStaff = await db
    .delete(staffTable)
    .where(
      and(
        inArray(staffTable.name, PLACEHOLDER_STAFF_NAMES),
        isNull(staffTable.teamId),
      ),
    )
    .returning({ id: staffTable.id, name: staffTable.name });

  console.log(`\nRemoved ${deletedStaff.length} placeholder staff:`);
  for (const s of deletedStaff) console.log(`  - ${s.name}`);

  console.log("\n=== Done. ===");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
