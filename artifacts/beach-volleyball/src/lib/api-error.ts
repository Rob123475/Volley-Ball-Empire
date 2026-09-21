/**
 * The server's own words for why something was refused.
 *
 * ── R-80 gate 5: why this exists ────────────────────────────────────────────
 * Nineteen places across eleven pages read a failed mutation as
 * `err?.response?.data?.error`. That is the AXIOS error shape, and axios is not
 * a dependency of this project and never has been. The client is
 * `lib/api-client-react/src/custom-fetch.ts`, which throws an `ApiError` whose
 * parsed body is on `.data` — `.response` is the raw `Response`, and a
 * `Response` has no `.data`. So that expression was ALWAYS undefined and every
 * one of those nineteen paths silently fell through to a generic string.
 *
 * Found by driving the screens: signing a fourth senior is refused by the
 * server with
 *
 *   "Squad is full (3/3 senior players). A squad is 2 starters and 1
 *    interchange — release someone first."
 *
 * and the player was shown "Unable to sign this player." That is exactly what
 * `utils/squadRules.ts` set out to prevent — its `refusalReason()` returns the
 * message rather than a boolean, and says so: "so the caller cannot invent its
 * own wording — the player is told which limit they hit and what to do about
 * it, not just 'no'." The UI was inventing its own wording after all.
 *
 * One helper rather than nineteen hand-written chains, so the next person
 * cannot reintroduce the axios shape without deleting this.
 */

/** What `ApiError` (and a thrown `Error`) actually carry. */
type ErrorLike = {
  data?: unknown;
  message?: string;
};

/**
 * Pull the server's `{ error: "..." }` message out of a rejected request.
 *
 * `fallback` is used only when the server said nothing useful — never to
 * replace a message it did send.
 */
export function serverMessage(err: unknown, fallback: string): string {
  const e = err as ErrorLike | null | undefined;

  // ApiError.data is the parsed JSON body. Every refusal in this API is
  // `{ error: "..." }`.
  const data = e?.data;
  if (data && typeof data === "object") {
    const msg = (data as { error?: unknown }).error;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  if (typeof data === "string" && data.trim()) return data.trim();

  // A non-JSON failure still carries a message; drop the "HTTP 422 ...:"
  // prefix the client puts on it, the same way App.tsx's mutationCache does.
  const raw = typeof e?.message === "string" ? e.message : "";
  const stripped = raw.replace(/^HTTP \d+[^:]*:\s*/, "").trim();
  if (stripped && !stripped.startsWith("{") && !stripped.startsWith("<")) return stripped;

  return fallback;
}
