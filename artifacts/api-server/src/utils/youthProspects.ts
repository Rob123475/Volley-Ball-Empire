/**
 * Overnight brief 1 Oct, N-44, for saves made before it: a scouting mission's
 * pending finds were rated by a rule of their own (Rob's came back 74, 72 and
 * 65 while the loan list's youths were 47-51), kept no stats, and named only
 * their region on the card while the report named a country.
 *
 * At boot, every pending find with no stats is re-rated once by the one youth
 * rule (utils/youthIntake.ts drawYouthStats): her six stats and the rating they
 * make. A find the report called a "Generational Talent" stays the 1 in 100
 * (super-gifted). Her country is the one her report names, or one of her
 * region's nations if it names none. Signed and rejected finds are left alone:
 * a signed one is a player now. Idempotent: a find with stats is skipped.
 */
import { db, youthProspectsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { drawYouthStats } from "./youthIntake.js";
import { overallRating } from "./overallRating.js";
import { regionNations } from "./prospect-generator.js";

export function rerateOldProspects(): number {
  const pending = db.select().from(youthProspectsTable)
    .where(and(eq(youthProspectsTable.status, "pending"), isNull(youthProspectsTable.stats))).all();
  for (const p of pending) {
    const { stats } = drawYouthStats(p.eliteEventType === "Generational Talent" ? 0 : Math.random());
    const nations = regionNations(p.continent);
    const named = nations.find((n) => (p.scoutingReportText ?? "").includes(n));
    const nationality = p.nationality ?? named ?? nations[Math.floor(Math.random() * nations.length)] ?? null;
    db.update(youthProspectsTable)
      .set({ stats, currentRating: overallRating(stats), nationality })
      .where(eq(youthProspectsTable.id, p.id)).run();
  }
  return pending.length;
}
