/**
 * The contract lengths, for the screens that offer them.
 *
 * Rob's rule (22 Sep), as Rob narrowed it on 24 Oct 2026 (1.1.3 rebuild, Part B):
 *
 *     players at the club the career controls   6 months · 1 season · 2 seasons
 *     players at every other club (the AI)      1 season · 2 seasons
 *     staff and medical, at every club          1 season · 2 seasons, ending 7 January
 *
 * Every screen here acts for the manager's own club, so the player screens
 * offer PLAYER_CONTRACT_LENGTHS and the staff and medical screens
 * STAFF_CONTRACT_LENGTHS. AI_PLAYER_CONTRACT_LENGTHS is here so the three
 * lists can be checked against the server's together.
 *
 * ── Why this is a second copy ───────────────────────────────────────────────
 * The server owns the rule, in `api-server/src/utils/contractTerms.ts`: it
 * validates the length and resolves the end date against the real season rows.
 * This file exists only because the browser cannot import that module's
 * package — `lib/db`'s entry point opens a SQLite connection the moment it is
 * imported, so pulling it into the bundle is not possible.
 *
 * Two copies of a rule is how rules drift, so `harness/contract-terms.mjs`
 * asserts each of these three lists, and the labels, is identical to the
 * server's and fails the build if one is not.
 */

/** Every length a stored contract can carry (an older save's 6-month staff deal included). */
export const CONTRACT_LENGTHS = ["6m", "1s", "2s"] as const;

export type ContractLength = (typeof CONTRACT_LENGTHS)[number];

/** Players at the club the career controls now: the only contracts that may run 6 months. */
export const PLAYER_CONTRACT_LENGTHS: readonly ContractLength[] = ["6m", "1s", "2s"];
/** Players at every other club (the AI clubs, a club the manager has left). */
export const AI_PLAYER_CONTRACT_LENGTHS: readonly ContractLength[] = ["1s", "2s"];
/** Staff and medical, at every club: to 7 January. */
export const STAFF_CONTRACT_LENGTHS: readonly ContractLength[] = ["1s", "2s"];

export const CONTRACT_LENGTH_LABELS: Record<ContractLength, string> = {
  "6m": "6 months",
  "1s": "1 season",
  "2s": "2 seasons",
};
