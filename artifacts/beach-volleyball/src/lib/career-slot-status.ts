/**
 * Interpreting the result of `GET /api/team`.
 *
 * The route answers 404 for "this profile has no career yet" and 5xx/network
 * failure for "we could not find out". React Query surfaces both as `isError`,
 * and collapsing them is dangerous: the title screen turns Continue into
 * "Start New Career", the new-career screen's occupied-slot guard waves the
 * player through, and `POST /careers` then overwrites a real save with no
 * confirmation. One dropped request would cost a career.
 *
 * So: only a 404 counts as "no career". Anything else is `unknown`, and every
 * caller must treat `unknown` as "do not offer to create a career".
 */
export type CareerSlotStatus = "loading" | "present" | "absent" | "unknown";

function statusCodeOf(error: unknown): number | undefined {
  return (error as { status?: number } | null | undefined)?.status;
}

/** True only for a definitive "no career here" answer from the server. */
export function isNoCareerError(error: unknown): boolean {
  return statusCodeOf(error) === 404;
}

export function careerSlotStatus(q: {
  data: unknown;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}): CareerSlotStatus {
  if (q.isLoading) return "loading";
  if (q.data) return "present";
  if (q.isError) return isNoCareerError(q.error) ? "absent" : "unknown";
  // Resolved with no error and no team — treat as unknown rather than absent;
  // a career is only ever created from a definitive answer.
  return "unknown";
}
