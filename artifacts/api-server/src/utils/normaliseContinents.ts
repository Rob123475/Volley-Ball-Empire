import {
  db,
  playersTable,
  clubTemplatesTable,
  youthProspectsTable,
  continentalPoolTeamsTable,
  regionalLeagueSeasonsTable,
  normaliseContinent,
  continentForNationality,
  isContinent,
} from "@workspace/db";
import { eq, isNull, or, sql } from "drizzle-orm";

/**
 * One-time data migration: bring every continent value onto the canonical six
 * (see lib/db/src/schema/continents.ts) and backfill the ones that were never
 * set.
 *
 * Three spellings were live at once — players used "Africa & Middle East" and
 * "Oceania", club_templates used "Oceania", while the regional league and
 * continental pool (which the competition actually runs on) used "Africa and
 * Middle East" and "Australia and Pacific Islands". Any group-by continent
 * therefore split the same region into two buckets. 72 players had no
 * continent at all.
 *
 * Idempotent: rows already canonical are left alone, so this is safe to run on
 * every boot. Runs for existing player saves too, not just the shipped
 * database — a save created before this shipped needs it more, not less.
 */
export type ContinentMigrationResult = {
  playersNormalised: number;
  playersBackfilled: number;
  playersUnresolved: number;
  clubTemplatesNormalised: number;
  youthProspectsNormalised: number;
  poolTeamsNormalised: number;
  regionalSeasonsNormalised: number;
};

export function normaliseContinentsOnce(): ContinentMigrationResult {
  const result: ContinentMigrationResult = {
    playersNormalised: 0, playersBackfilled: 0, playersUnresolved: 0,
    clubTemplatesNormalised: 0, youthProspectsNormalised: 0,
    poolTeamsNormalised: 0, regionalSeasonsNormalised: 0,
  };

  db.transaction((tx) => {
    // ── Rows whose continent is set but spelled differently ────────────────
    const tables = [
      { t: playersTable,               col: playersTable.continent,               key: "playersNormalised" },
      { t: clubTemplatesTable,         col: clubTemplatesTable.continent,         key: "clubTemplatesNormalised" },
      { t: youthProspectsTable,        col: youthProspectsTable.continent,        key: "youthProspectsNormalised" },
      { t: continentalPoolTeamsTable,  col: continentalPoolTeamsTable.continent,  key: "poolTeamsNormalised" },
      { t: regionalLeagueSeasonsTable, col: regionalLeagueSeasonsTable.continent, key: "regionalSeasonsNormalised" },
    ] as const;

    for (const { t, col, key } of tables) {
      const rows = tx.select({ id: (t as any).id, continent: col }).from(t as any).all() as
        Array<{ id: number; continent: string | null }>;

      for (const row of rows) {
        if (row.continent == null || isContinent(row.continent)) continue;
        const canonical = normaliseContinent(row.continent);
        if (!canonical) continue;  // unknown spelling — leave it and report below
        tx.update(t as any).set({ continent: canonical } as any)
          .where(eq((t as any).id, row.id)).run();
        (result as any)[key]++;
      }
    }

    // ── Players with no continent at all — derive it from nationality ──────
    const missing = tx
      .select({ id: playersTable.id, nationality: playersTable.nationality })
      .from(playersTable)
      .where(isNull(playersTable.continent))
      .all() as Array<{ id: number; nationality: string | null }>;

    for (const p of missing) {
      const derived = continentForNationality(p.nationality);
      if (!derived) { result.playersUnresolved++; continue; }
      tx.update(playersTable).set({ continent: derived })
        .where(eq(playersTable.id, p.id)).run();
      result.playersBackfilled++;
    }
  });

  return result;
}
