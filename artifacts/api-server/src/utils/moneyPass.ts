/**
 * Overnight brief 1 Oct, N-41: the money pass, for saves made before it.
 *
 * Rob's numbers live in lib/db/src/schema/money.ts. New careers are built on
 * them (the market's wages, the AI clubs' contracts, the starting squad); this
 * brings an existing save onto them, once per career, at boot:
 *
 *   - every senior player's wage rises by playerWageRise(her rating): the
 *     club's own squad (her state and her active contract, by the same sum),
 *     and every AI club's contracts (set to monthlySalaryFor, which now
 *     carries the rise, so a contract signed today and one signed before agree);
 *   - a free agent's asking wage is her market wage (seniorMonthlyWage), which
 *     also mends the $0 asking wage a player was left on when her contract ran
 *     out; youth are not touched;
 *   - head coaches above MONEY.headCoachSalaryMonthlyMax come down to it (the
 *     market and the hired alike) - this part is a rule, so it runs every boot.
 *
 * The managers' salaries need no backfill: each is fixed by managerSalaryFor
 * from the career (or the AI club), so an existing save is paid one in range
 * from its first salary week. Sponsor income needs none either: it is a rule
 * of the weekly charge (clubFinances.ts sponsorWeeklyIncome).
 *
 * `career_saves.money_pass_at` records the game date the pass ran on; a new
 * career is stamped when it is made, so it is never raised twice.
 */
import {
  careerSavesTable, careerPlayerStateTable, careerStaffStateTable, playersTable, staffTable,
  contractsTable, poolPlayerContractsTable, continentalPoolPlayersTable, calendarStateTable,
  playerWageRise, MONEY,
} from "@workspace/db";
import { and, eq, gt, inArray, isNull } from "drizzle-orm";
import { withCareerStateTx } from "../lib/playerDto.js";
import { monthlySalaryFor } from "./clubFinances.js";
import { seniorMonthlyWage } from "./wageCurve.js";
import { overallRating } from "./overallRating.js";

/** Hold every head coach to the cap: reference data, and every career's market and hires. */
export function capHeadCoachSalaries(): number {
  const cap = MONEY.headCoachSalaryMonthlyMax;
  return withCareerStateTx((w) => {
    const coaches = w.tx.select({ id: staffTable.id, base: staffTable.baseSalary })
      .from(staffTable).where(eq(staffTable.role, "Head Coach")).all();
    let n = 0;
    for (const c of coaches) {
      if (Number(c.base) > cap) { w.tx.update(staffTable).set({ baseSalary: cap }).where(eq(staffTable.id, c.id)).run(); n++; }
    }
    const ids = coaches.map((c) => c.id);
    if (ids.length === 0) return n;
    const over = w.tx.select({ careerSaveId: careerStaffStateTable.careerSaveId, staffId: careerStaffStateTable.staffId })
      .from(careerStaffStateTable)
      .where(and(inArray(careerStaffStateTable.staffId, ids), gt(careerStaffStateTable.salary, cap))).all();
    for (const s of over) w.setStaffState(s.careerSaveId, s.staffId, { salary: cap });
    return n + over.length;
  });
}

/** Boot: every career not yet on the 1 Oct numbers is brought onto them, once. */
export function applyMoneyPass(): { careers: number; signed: number; freeAgents: number; aiContracts: number; headCoaches: number } {
  const out = { careers: 0, signed: 0, freeAgents: 0, aiContracts: 0, headCoaches: capHeadCoachSalaries() };
  const saves = withCareerStateTx((w) => w.tx.select({ id: careerSavesTable.id, teamId: careerSavesTable.teamId })
    .from(careerSavesTable).where(isNull(careerSavesTable.moneyPassAt)).all());

  for (const save of saves) {
    withCareerStateTx((w) => {
      const players = w.tx.select({
        id: careerPlayerStateTable.playerId, teamId: careerPlayerStateTable.teamId, salary: careerPlayerStateTable.salary,
        isPromoted: careerPlayerStateTable.isPromoted, poolTeamId: careerPlayerStateTable.poolTeamId,
        speed: careerPlayerStateTable.speed, power: careerPlayerStateTable.power, defense: careerPlayerStateTable.defense,
        serve: careerPlayerStateTable.serve, block: careerPlayerStateTable.block, stamina: careerPlayerStateTable.stamina,
        playerType: playersTable.playerType, askingPrice: playersTable.askingPrice,
      }).from(careerPlayerStateTable)
        .innerJoin(playersTable, eq(playersTable.id, careerPlayerStateTable.playerId))
        .where(eq(careerPlayerStateTable.careerSaveId, save.id)).all();

      for (const p of players) {
        const senior = p.playerType === "senior" || (p.playerType === "youth" && !!p.isPromoted);
        if (!senior || p.poolTeamId != null) continue;        // youth are not included
        const rating = overallRating(p);
        if (p.teamId != null) {
          const rise = playerWageRise(rating);
          w.setPlayerState(save.id, p.id, { salary: Number(p.salary) + rise });
          const live = w.tx.select({ id: contractsTable.id, salary: contractsTable.salary }).from(contractsTable)
            .where(and(eq(contractsTable.playerId, p.id), eq(contractsTable.teamId, p.teamId), eq(contractsTable.status, "active"))).all();
          for (const c of live) w.tx.update(contractsTable).set({ salary: Number(c.salary) + rise }).where(eq(contractsTable.id, c.id)).run();
          out.signed++;
        } else {
          w.setPlayerState(save.id, p.id, { salary: seniorMonthlyWage(Number(p.askingPrice ?? 0), rating) });
          out.freeAgents++;
        }
      }

      const pool = w.tx.select({
        id: poolPlayerContractsTable.id,
        speed: continentalPoolPlayersTable.speed, power: continentalPoolPlayersTable.power,
        defense: continentalPoolPlayersTable.defense, serve: continentalPoolPlayersTable.serve,
        block: continentalPoolPlayersTable.block, stamina: continentalPoolPlayersTable.stamina,
      }).from(poolPlayerContractsTable)
        .innerJoin(continentalPoolPlayersTable, eq(continentalPoolPlayersTable.id, poolPlayerContractsTable.poolPlayerId))
        .where(and(eq(poolPlayerContractsTable.careerSaveId, save.id), eq(poolPlayerContractsTable.status, "active"))).all();
      for (const c of pool) {
        w.tx.update(poolPlayerContractsTable).set({ salary: monthlySalaryFor(overallRating(c)) }).where(eq(poolPlayerContractsTable.id, c.id)).run();
      }
      out.aiContracts += pool.length;

      const today = save.teamId == null ? null : w.tx.select({ d: calendarStateTable.currentDate })
        .from(calendarStateTable).where(eq(calendarStateTable.teamId, save.teamId)).get()?.d;
      w.tx.update(careerSavesTable).set({ moneyPassAt: today ?? new Date().toISOString().slice(0, 10) })
        .where(eq(careerSavesTable.id, save.id)).run();
      out.careers++;
    });
  }
  return out;
}
