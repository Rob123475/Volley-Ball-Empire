import type { PlayerDevelopment } from "@workspace/db";

/** Average of two rolls — mild bell curve, fewer extreme values. */
function randDev(min: number, max: number): number {
  const a = Math.floor(Math.random() * (max - min + 1)) + min;
  const b = Math.floor(Math.random() * (max - min + 1)) + min;
  return Math.round((a + b) / 2);
}

export function generateDevelopment(): PlayerDevelopment {
  return {
    workEthic:       randDev(40, 100),
    coachability:    randDev(40, 100),
    consistency:     randDev(20, 100),
    leadership:      randDev(1,  100),
    injuryProneness: randDev(1,  100),
  };
}
