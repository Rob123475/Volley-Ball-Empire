/**
 * Telling Electron about an achievement, so Steam can hear it.
 *
 * ── Why the server does not call Steam ──────────────────────────────────────
 * Steam attaches to the process the player launched — the Electron main
 * process — not to the API server Electron forks. The server is also the one
 * process that knows an achievement was unlocked, so the two have to talk.
 *
 * They already do: electron/main.js sends `{ type: "shutdown" }` down the fork
 * channel and the server answers it (index.ts). This is the same channel in the
 * other direction, and it is the whole of the server's Steam involvement —
 * nothing here imports steamworks.js, and the server behaves identically when
 * nobody is listening.
 *
 * ── Messages ───────────────────────────────────────────────────────────────
 *   server -> main   { type: "achievement", key }            one per unlock
 *   main -> server   { type: "achievements:list" }           at boot
 *   server -> main   { type: "achievements:unlocked", keys } the catch-up
 *
 * The catch-up exists because achievements are per STEAM ACCOUNT, not per
 * career: a player who unlocked "First Steps" before the game was on Steam, or
 * in a career they have since deleted, should still have it. main.js activates
 * whatever Steam does not already have.
 */
import { db, achievementsTable } from "@workspace/db";

/** Fork-channel only: when the server is run directly (tests, dev), this is a no-op. */
function send(message: Record<string, unknown>): void {
  if (typeof process.send !== "function") return;
  try {
    process.send(message);
  } catch {
    // A closed channel is not an error worth failing a match over: Steam is
    // optional, and the unlock is already recorded in the database.
  }
}

/** One message per newly unlocked key. Never throws. */
export function announceUnlocked(keys: readonly string[]): void {
  for (const key of keys) send({ type: "achievement", key });
}

/**
 * Every achievement key unlocked anywhere in this save.
 *
 * Deliberately not scoped to a career or a profile: Steam achievements belong
 * to the account, and a key earned in any career counts.
 */
export async function allUnlockedKeys(): Promise<string[]> {
  const rows = await db.select({ key: achievementsTable.achievementKey }).from(achievementsTable);
  return [...new Set(rows.map((r) => r.key))];
}

/** Answer main.js's boot request. Registered once, at startup. */
export function registerSteamCatchUp(): void {
  if (typeof process.on !== "function") return;
  process.on("message", (msg: unknown) => {
    if (!(msg && typeof msg === "object" && (msg as { type?: unknown }).type === "achievements:list")) return;
    void allUnlockedKeys()
      .then((keys) => send({ type: "achievements:unlocked", keys }))
      .catch(() => send({ type: "achievements:unlocked", keys: [] }));
  });
}
