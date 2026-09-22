/**
 * The academy: contract ticks and development for signed youth players (ages
 * 14-18), once per simulated senior match.
 *
 * R-43: development used to run inside an invented "Development League" — an
 * opponent name picked from a hardcoded list, a Math.random win/draw/loss, a
 * ladder of AI academies ticking at random and a coin-flip championship, with XP
 * and morale hanging off that invented result. The league is deleted. The
 * development stays, without a result:
 *   - XP is what the old roll averaged for the player's rating band, so the
 *     academy develops at the pace it did. The roll was win 20-30 / draw 12-18 /
 *     loss 8-12 XP at 65/20/15% (rating 75+), 50/20/30% (60-74) and 35/20/45%
 *     (under 60): 20.75, 18.5 and 16.25 a week.
 *   - Focus development points are unchanged: 8-12 a week.
 *   - Morale no longer moves. It only ever moved on the invented result; a
 *     Leadership focus still adds its 2.
 *
 * R-63: the contract tick no longer charges wages. An academy player's wage was
 * billed here after every match AND in the weekly wage run; it is now billed
 * once, in the weekly wage run (routes/calendar.ts, utils/academy.ts).
 */
import { careerSaveIdForTeam } from "../lib/getActiveSeason.js";
import { isYouthPlayer } from "./playerClassification.js";
import { loadPlayers, requireCareerSaveId, updatePlayerState, type CareerPlayerFields, type StatKey } from "../lib/playerDto.js";

/**
 * Take a week off each academy contract. Charges nothing.
 *
 * L-02d: "in the academy" is a youth player this career has not promoted
 * (utils/playerClassification.ts), not "aged 14 to 18". Selecting by age put
 * academy years back onto an 18-year-old the club had just promoted — and a
 * player with academy years is one routes/contracts.ts refuses to renew, so a
 * graduate's senior contract could only run out. The thirty-season runs showed
 * it as "Academy contracts are managed by the youth academy" at the start of
 * every season.
 */
export async function tickAcademyContracts(teamId: number): Promise<{ playerCount: number }> {
  const careerSaveId = requireCareerSaveId((await careerSaveIdForTeam(teamId)) ?? undefined);
  const youthPlayers = (await loadPlayers(careerSaveId, { teamId })).filter(isYouthPlayer);

  for (const player of youthPlayers) {
    const currentYears = player.academyContractYears != null
      ? Number(player.academyContractYears)
      : 2.0;

    const newYears = Math.max(0, currentYears - 1 / 52);

    await updatePlayerState(careerSaveId, player.id, {
      academyContractYears: Number(newYears.toFixed(2)),
    });
  }

  return { playerCount: youthPlayers.length };
}

const FOCUS_STAT_MAP: Record<string, StatKey> = {
  Attack:      "power",
  Defence:     "defense",
  Serving:     "serve",
  Blocking:    "block",
  Athleticism: "speed",
};

/** Weekly XP for a youth player's rating band: the old invented roll's average, rounded. */
export function academyXpFor(rating: number): number {
  return rating >= 75 ? 21 : rating >= 60 ? 19 : 16;
}

/** Academy training, for the academy — see tickAcademyContracts on who that is. */
export async function developAcademyPlayers(teamId: number): Promise<void> {
  const careerSaveId = requireCareerSaveId((await careerSaveIdForTeam(teamId)) ?? undefined);
  const youthPlayers = (await loadPlayers(careerSaveId, { teamId })).filter(isYouthPlayer);

  for (const player of youthPlayers) {
    const rating = Math.round((player.power + player.speed + player.defense + player.serve + player.block) / 5);
    const updates: Partial<CareerPlayerFields> = {
      trainingPoints: player.trainingPoints + academyXpFor(rating),
    };

    if (player.trainingFocus === "Leadership") {
      updates.morale = Math.min(100, player.morale + 2);
    } else if (player.trainingFocus) {
      const focusStat = FOCUS_STAT_MAP[player.trainingFocus];
      if (focusStat) {
        const prevFocusXp = player.focusXp ?? 0;
        const newFocusXp  = prevFocusXp + 8 + Math.floor(Math.random() * 5);
        updates.focusXp   = newFocusXp;
        const focusGain   = Math.floor(newFocusXp / 100) - Math.floor(prevFocusXp / 100);
        if (focusGain > 0) updates[focusStat] = Math.min(99, player[focusStat] + focusGain);
      }
    }

    await updatePlayerState(careerSaveId, player.id, updates);
  }
}
