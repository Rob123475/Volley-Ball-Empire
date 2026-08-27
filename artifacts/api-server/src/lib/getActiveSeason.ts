import type { Request } from "express";
import { db, seasonsTable, careerSavesTable } from "@workspace/db";
import { and, eq, isNull, desc } from "drizzle-orm";

/**
 * The active season for the CURRENT career.
 *
 * Every caller used to run its own `where(status = "active")` — eleven sites
 * across eight files, with no shared helper, which is how the bug drifted in.
 * Seasons had no career column, so career creation reused whatever row was
 * already active and a second career inherited the first one's timeline:
 * starting mid-season, or immediately at season end. Multiple careers per
 * install is a shipped feature (the local profile picker exists for it), so
 * that is a live player-facing bug, not just a harness artifact.
 *
 * Resolution order:
 *   1. the active season belonging to this career
 *   2. an unclaimed legacy season (career_save_id IS NULL), which is adopted by
 *      the first career to ask for it, so saves made before this change keep
 *      working instead of silently getting a fresh season
 */
export async function getActiveSeason(req: Request) {
  const careerSaveId = req.activeCareerSaveId;

  if (careerSaveId != null) {
    const [own] = await db.select().from(seasonsTable)
      .where(and(
        eq(seasonsTable.careerSaveId, careerSaveId),
        eq(seasonsTable.status, "active"),
      ))
      .orderBy(desc(seasonsTable.year))
      .limit(1);
    if (own) return own;
  }

  // Legacy adoption: a season from before seasons were career-scoped.
  const [orphan] = await db.select().from(seasonsTable)
    .where(and(
      isNull(seasonsTable.careerSaveId),
      eq(seasonsTable.status, "active"),
    ))
    .orderBy(desc(seasonsTable.year))
    .limit(1);

  if (orphan && careerSaveId != null) {
    await db.update(seasonsTable)
      .set({ careerSaveId })
      .where(eq(seasonsTable.id, orphan.id));
    return { ...orphan, careerSaveId };
  }

  return orphan ?? null;
}

/** Season lookup by career id, for code paths without a Request. */
export async function getActiveSeasonForCareer(careerSaveId: number) {
  const [own] = await db.select().from(seasonsTable)
    .where(and(
      eq(seasonsTable.careerSaveId, careerSaveId),
      eq(seasonsTable.status, "active"),
    ))
    .orderBy(desc(seasonsTable.year))
    .limit(1);
  return own ?? null;
}

/** The career save id owning a team, for paths that only have a team. */
export async function careerSaveIdForTeam(teamId: number): Promise<number | null> {
  const [save] = await db.select({ id: careerSavesTable.id })
    .from(careerSavesTable)
    .where(eq(careerSavesTable.teamId, teamId))
    .limit(1);
  return save?.id ?? null;
}
