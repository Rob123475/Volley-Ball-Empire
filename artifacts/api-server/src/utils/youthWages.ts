/**
 * Overnight brief 1 Oct, N-33, for saves made before it: a youth's stored wage
 * is the academy's wage for her talent (utils/academy.ts academyMonthlySalary,
 * about $325-$650 a month), which is what the weekly run has always billed an
 * academy player. Older saves held other figures: a market youth's asking wage
 * of $0 (her asking price is empty), and a market youth signed through the
 * contract box on whatever it sent ($5,000 a month by default). Each youth's
 * state, and her active contract, is set to the academy wage at boot.
 * Idempotent: a wage already right is left alone. Graduates (promoted) are
 * seniors and keep theirs.
 */
import { careerPlayerStateTable, playersTable, contractsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { withCareerStateTx } from "../lib/playerDto.js";
import { academyMonthlySalary } from "./academy.js";

export function alignYouthWages(): number {
  return withCareerStateTx((w) => {
    const youths = w.tx.select({
      careerSaveId: careerPlayerStateTable.careerSaveId, playerId: careerPlayerStateTable.playerId,
      teamId: careerPlayerStateTable.teamId, salary: careerPlayerStateTable.salary,
      isPromoted: careerPlayerStateTable.isPromoted, potential: playersTable.potential,
    }).from(careerPlayerStateTable)
      .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
      .where(eq(playersTable.playerType, "youth")).all();
    let n = 0;
    for (const y of youths) {
      if (y.isPromoted) continue;
      const wage = academyMonthlySalary(y.potential);
      if (Math.abs(Number(y.salary) - wage) < 0.01) continue;
      w.setPlayerState(y.careerSaveId, y.playerId, { salary: wage });
      if (y.teamId != null) {
        w.tx.update(contractsTable).set({ salary: wage })
          .where(and(eq(contractsTable.playerId, y.playerId), eq(contractsTable.teamId, y.teamId), eq(contractsTable.status, "active"))).run();
      }
      n++;
    }
    return n;
  });
}
