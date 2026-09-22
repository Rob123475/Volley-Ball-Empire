/**
 * The three contract lengths, for the screens that offer them.
 *
 * Rob's rule (22 Sep, final): a contract runs 6 months, 1 season or 2 seasons,
 * and nothing else — players, staff and medical staff alike.
 *
 * ── Why this is a second copy ───────────────────────────────────────────────
 * The server owns the rule, in `api-server/src/utils/contractTerms.ts`: it
 * validates the length and resolves the end date against the real season rows.
 * This file exists only because the browser cannot import that module's
 * package — `lib/db`'s entry point opens a SQLite connection the moment it is
 * imported, so pulling it into the bundle is not possible.
 *
 * Two copies of a rule is how rules drift, so `harness/contract-terms.mjs`
 * asserts these three keys and their labels are identical to the server's and
 * fails the build if they are not.
 */

export const CONTRACT_LENGTHS = ["6m", "1s", "2s"] as const;

export type ContractLength = (typeof CONTRACT_LENGTHS)[number];

export const CONTRACT_LENGTH_LABELS: Record<ContractLength, string> = {
  "6m": "6 months",
  "1s": "1 season",
  "2s": "2 seasons",
};
