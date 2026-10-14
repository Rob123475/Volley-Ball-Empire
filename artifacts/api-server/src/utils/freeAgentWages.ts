/**
 * Update 1, item 4a (Rob, 14 Oct, 4a-3): an existing career's free agents are
 * re-priced once, at boot, to the wage rise above rating 77 (MONEY
 * .playerWageRiseMonthly.perPointAbove), so a career made before it asks what a
 * new career asks. Players under contract keep their wage until renewal.
 *
 * A free agent asks what a new career's market asks (utils/migrateCareerState.ts
 * seeds it): her asking price's wage plus the rise for her rating, by
 * seniorMonthlyWage. One with no asking price (a player the AI clubs brought
 * into the world) asks the wage for her rating, monthlySalaryFor, the rule the
 * AI clubs pay and release her on. Once per career (career_saves
 * .free_agent_wage_pass_at); never again.
 */
import { db, careerSavesTable, careerPlayerStateTable, playersTable } from "@workspace/db";
import { and, eq, isNull, or } from "drizzle-orm";
import { withCareerStateTx } from "../lib/playerDto.js";
import { overallRating } from "./overallRating.js";
import { seniorMonthlyWage } from "./wageCurve.js";
import { monthlySalaryFor } from "./clubFinances.js";

/** Returns how many careers were re-priced. */
export function repriceFreeAgentsOnce(): number {
  const careers = db.select({ id: careerSavesTable.id }).from(careerSavesTable).where(isNull(careerSavesTable.freeAgentWagePassAt)).all();
  for (const { id } of careers) {
    withCareerStateTx((w) => {
      const free = w.tx.select({
        id: careerPlayerStateTable.playerId, ask: playersTable.askingPrice,
        speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
        serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
      }).from(careerPlayerStateTable)
        .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
        .where(and(
          eq(careerPlayerStateTable.careerSaveId, id),
          isNull(careerPlayerStateTable.teamId),
          isNull(careerPlayerStateTable.poolTeamId),
          eq(careerPlayerStateTable.isRetired, false),
          or(eq(playersTable.playerType, "senior"), eq(careerPlayerStateTable.isPromoted, true)),
        )).all();
      for (const p of free) {
        const rating = overallRating(p);
        const wage = Number(p.ask ?? 0) > 0 ? seniorMonthlyWage(Number(p.ask), rating) : monthlySalaryFor(rating);
        w.setPlayerState(id, p.id, { salary: wage });
      }
      w.tx.update(careerSavesTable).set({ freeAgentWagePassAt: new Date().toISOString() }).where(eq(careerSavesTable.id, id)).run();
    });
  }
  return careers.length;
}
