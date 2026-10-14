import type { PlayerDevelopment } from "@workspace/db";
import { playersTable, careerPlayerStateTable, rollPeakShift, rollPotential } from "@workspace/db";
import { isNotNull } from "drizzle-orm";
import { withCareerStateTx } from "../lib/playerDto.js";

/** Average of two rolls — mild bell curve, fewer extreme values. */
function randDev(min: number, max: number): number {
  const a = Math.floor(Math.random() * (max - min + 1)) + min;
  const b = Math.floor(Math.random() * (max - min + 1)) + min;
  return Math.round((a + b) / 2);
}

/**
 * A player's development profile, fixed for good (players.development). Update
 * 1, overnight part 4: workEthic and coachability scale her training XP,
 * injuryProneness her injury risk, and her hidden peak shift moves her ages
 * (lib/db/src/schema/ageing.ts); consistency and leadership are unused.
 */
export function generateDevelopment(): PlayerDevelopment {
  return {
    workEthic:       randDev(40, 100),
    coachability:    randDev(40, 100),
    consistency:     randDev(20, 100),
    leadership:      randDev(1,  100),
    injuryProneness: randDev(1,  100),
    peakShift:       rollPeakShift(),
  };
}

/**
 * Part 4 (B-1, B-2), at boot: every player with no profile gets one, and every
 * profile without a peak shift gets one; both are fixed for good after. An AI
 * club's original (a senior made from a continental pool player, who never had
 * a potential of her own and was given the default) also gets a potential,
 * weighted mostly Average (ageing.ts rollPotential). New ones get both when
 * they are made (utils/aiSquads.ts materializeAiSeniorsTx). Returns how many.
 */
export function giveEveryPlayerAProfile(): number {
  return withCareerStateTx((w) => {
    const originals = new Set(w.tx.select({ id: careerPlayerStateTable.playerId }).from(careerPlayerStateTable)
      .where(isNotNull(careerPlayerStateTable.poolPlayerId)).all().map((r) => r.id));
    const rows = w.tx.select({ id: playersTable.id, development: playersTable.development }).from(playersTable).all();
    let n = 0;
    for (const r of rows) {
      if (r.development && r.development.peakShift != null) continue;
      if (!r.development) {
        w.setPlayerReference(r.id, { development: generateDevelopment(), ...(originals.has(r.id) ? { potential: rollPotential() } : {}) });
      } else {
        w.setPlayerReference(r.id, { development: { ...r.development, peakShift: rollPeakShift() } });
      }
      n++;
    }
    return n;
  });
}
