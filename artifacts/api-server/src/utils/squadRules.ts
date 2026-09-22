/**
 * How big a squad is allowed to be.
 *
 * Beach volleyball is played two-a-side, so the senior squad is deliberately
 * tiny:
 *
 *    2 starters      the pair on the sand
 *    1 interchange   the senior reserve
 *   12 academy       youth players (R-63, Rob's decision 15 Sep)
 *
 * Defined here rather than typed into contracts.ts so the numbers exist once.
 * Every previous "one screen kept its own copy" bug in this project started as
 * a literal written in two places — the Team page said "up to 6" while this
 * file allowed 1.
 *
 * ── These are limits on SIGNING, not a purge ────────────────────────────────
 * They are checked when a contract is offered. A save made before these limits
 * existed may hold more players than this, and that is deliberate: silently
 * releasing someone's squad on load would be far worse than letting an old
 * save sit over the cap until the player trims it themselves. The check is
 * `>=`, so an over-full squad simply cannot add anyone new. The season intake
 * (utils/youthIntake.ts) never takes the academy past ACADEMY_CAP either.
 */

/** The pair on court. */
export const MAX_STARTERS = 2;

/** Senior bench — one interchange. */
export const MAX_INTERCHANGE = 1;

/** Senior squad total: the pair plus the interchange. */
export const MAX_SENIORS = MAX_STARTERS + MAX_INTERCHANGE;

/**
 * Academy places. The signing rule below, the season intake and the Team page
 * banner (GET /team/roster `academy.cap`) all read this one number.
 */
export const ACADEMY_CAP = 12;

/**
 * L-02d — how many of its own graduates a club may hold.
 *
 * Rob's rule (22 Sep): four. An academy may develop twelve, but the club cannot
 * keep everyone it promotes: past four, the surplus goes back to the pool at
 * the season boundary where any club can sign them.
 *
 * Nothing capped promotion before this. A SIGNING is refused past MAX_SENIORS,
 * but the rollover's own promotion and the Team page's role change both wrote
 * straight past it, so a long career piled graduates up on its own books for
 * ever — thirty seasons in, a club was carrying ninety-odd players and paying
 * every one of them every week.
 */
export const GRADUATE_CAP = 4;

/** Everyone under contract, senior and academy. */
export const MAX_SQUAD = MAX_SENIORS + ACADEMY_CAP;

export type SquadCounts = {
  starters: number;
  interchange: number;
  /**
   * Seniors the club SIGNED. L-02d: its own graduates are not counted here —
   * they have their own limit (GRADUATE_CAP) and are held on top of the squad.
   * Counting them together meant a club that developed four players could
   * never sign anyone again, which would have made "graduates can be bought
   * and sold" impossible for exactly the clubs that have graduates.
   */
  seniors: number;
  youth: number;
};

/**
 * Why a signing is refused, or null when it is allowed.
 *
 * Returns the MESSAGE rather than a boolean so the caller cannot invent its own
 * wording — the player is told which limit they hit and what to do about it,
 * not just "no".
 */
export function refusalReason(
  counts: SquadCounts,
  signing: { isYouth: boolean; squadRole: "starter" | "interchange" | "reserve" },
): string | null {
  if (signing.isYouth) {
    return counts.youth >= ACADEMY_CAP
      ? `Academy is full (${counts.youth}/${ACADEMY_CAP}). Promote or release an academy player before signing another.`
      : null;
  }

  if (counts.seniors >= MAX_SENIORS) {
    return `Squad is full (${counts.seniors}/${MAX_SENIORS} senior players). ` +
      `A squad is ${MAX_STARTERS} starters and ${MAX_INTERCHANGE} interchange — release someone first.`;
  }

  if (signing.squadRole === "starter" && counts.starters >= MAX_STARTERS) {
    return `You already have ${counts.starters} starters, and only ${MAX_STARTERS} play. ` +
      `Sign this player as interchange, or move a starter to the bench first.`;
  }

  if (signing.squadRole === "interchange" && counts.interchange >= MAX_INTERCHANGE) {
    return `You already have ${counts.interchange} interchange player. ` +
      `Sign this player as a starter, or release the current interchange first.`;
  }

  return null;
}
