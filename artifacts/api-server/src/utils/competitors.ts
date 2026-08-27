import {
  db,
  competitorsTable,
  continentalPoolTeamsTable,
  teamsTable,
} from "@workspace/db";
import { eq, isNotNull, isNull } from "drizzle-orm";

/**
 * Competitor identity.
 *
 * A competitor is anything that can appear in a ranking table or a set of
 * standings: the player's club, or one of the 60 AI pool clubs. The table
 * stores identity only — name and rating are read through the join to the
 * parent, never copied, so there is nothing to keep in sync.
 *
 * Note that "read the rating through the join" is not symmetric, and callers
 * should not expect a single view to provide it: an AI club's rating is a
 * stored column, while a player club's rating is DERIVED from its active
 * roster. Use the match engine's resolver for a rating, and this module only
 * for identity.
 */

/** Ensure every AI pool club has a competitor row. Idempotent. */
export function ensurePoolCompetitors(): number {
  let created = 0;
  db.transaction((tx) => {
    const pools = tx.select({ id: continentalPoolTeamsTable.id })
      .from(continentalPoolTeamsTable).all();
    const existing = new Set(
      tx.select({ poolTeamId: competitorsTable.poolTeamId })
        .from(competitorsTable)
        .where(isNotNull(competitorsTable.poolTeamId))
        .all()
        .map((r) => r.poolTeamId),
    );
    for (const p of pools) {
      if (existing.has(p.id)) continue;
      tx.insert(competitorsTable).values({ poolTeamId: p.id }).run();
      created++;
    }
  });
  return created;
}

/** Ensure every player club has a competitor row. Idempotent. */
export function ensureTeamCompetitors(): number {
  let created = 0;
  db.transaction((tx) => {
    const teams = tx.select({ id: teamsTable.id }).from(teamsTable).all();
    const existing = new Set(
      tx.select({ teamId: competitorsTable.teamId })
        .from(competitorsTable)
        .where(isNotNull(competitorsTable.teamId))
        .all()
        .map((r) => r.teamId),
    );
    for (const t of teams) {
      if (existing.has(t.id)) continue;
      tx.insert(competitorsTable).values({ teamId: t.id }).run();
      created++;
    }
  });
  return created;
}

/** The competitor id for a player's club, creating it if absent. */
export async function competitorIdForTeam(teamId: number): Promise<number> {
  const [existing] = await db.select({ id: competitorsTable.id })
    .from(competitorsTable)
    .where(eq(competitorsTable.teamId, teamId))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db.insert(competitorsTable)
    .values({ teamId })
    .returning({ id: competitorsTable.id });
  return created!.id;
}

/** The competitor id for an AI pool club, creating it if absent. */
export async function competitorIdForPoolTeam(poolTeamId: number): Promise<number> {
  const [existing] = await db.select({ id: competitorsTable.id })
    .from(competitorsTable)
    .where(eq(competitorsTable.poolTeamId, poolTeamId))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db.insert(competitorsTable)
    .values({ poolTeamId })
    .returning({ id: competitorsTable.id });
  return created!.id;
}

export type CompetitorIdentity = {
  competitorId: number;
  name: string;
  isPlayer: boolean;
  teamId: number | null;
  poolTeamId: number | null;
  /** Stored rating for AI clubs. Null for player clubs, whose rating is
   *  derived from the active roster — see matchEngine.sideRating. */
  storedRating: number | null;
};

/** Every competitor with its name resolved through the join. */
export async function listCompetitors(): Promise<CompetitorIdentity[]> {
  const rows = await db
    .select({
      competitorId: competitorsTable.id,
      teamId:       competitorsTable.teamId,
      poolTeamId:   competitorsTable.poolTeamId,
      teamName:     teamsTable.name,
      poolName:     continentalPoolTeamsTable.teamName,
      poolRating:   continentalPoolTeamsTable.rating,
    })
    .from(competitorsTable)
    .leftJoin(teamsTable, eq(competitorsTable.teamId, teamsTable.id))
    .leftJoin(continentalPoolTeamsTable, eq(competitorsTable.poolTeamId, continentalPoolTeamsTable.id));

  return rows.map((r) => ({
    competitorId: r.competitorId,
    name:         r.teamName ?? r.poolName ?? "Unknown",
    isPlayer:     r.teamId != null,
    teamId:       r.teamId,
    poolTeamId:   r.poolTeamId,
    storedRating: r.teamId != null ? null : (r.poolRating != null ? Number(r.poolRating) : null),
  }));
}

/** Competitor rows whose parent no longer exists. Should always be empty —
 *  the foreign keys prevent it — but cheap to assert in tests. */
export async function orphanedCompetitors(): Promise<number> {
  const rows = await db.select({ id: competitorsTable.id })
    .from(competitorsTable)
    .where(isNull(competitorsTable.teamId));
  return rows.length;
}
