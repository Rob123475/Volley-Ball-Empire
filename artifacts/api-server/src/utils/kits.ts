/**
 * Update 1, overnight brief part 7 (Rob, 14 Oct, K-1 A): kits.
 *
 *   - On the 3D court, if the two clubs' kits are too alike the away pair
 *     wears white (its own primary colour as the trim). "Too alike" is one
 *     rule, here: the two primary colours are less than KITS.tooAlike apart
 *     in RGB (straight-line distance, 0 to 441). If the home kit is itself
 *     close to white, the away pair wears near-black instead. The change rides
 *     on the /unity/match-state payload's colours (routes/unity.ts), so Unity
 *     needs no change.
 *   - The ladders' club dots are each club's real kit primary colour
 *     (kitColourOf), not a colour hashed from its name.
 */
import { continentalPoolTeamsTable, teamsTable, db } from "@workspace/db";
import { inArray } from "drizzle-orm";

export const KITS = {
  /** Two primary colours closer than this (RGB distance, 0-441) are too alike. */
  tooAlike: 100,
  /** What the away pair wears when the kits are too alike... */
  changePrimary: "#FFFFFF",
  /** ...or this, when the home kit is itself too alike white. */
  changePrimaryDark: "#111111",
  /** A dot for a club with no kit on record. */
  noKit: "#9CA3AF",
} as const;

function rgb(hex: string | null | undefined): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex ?? "").trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The straight-line RGB distance between two colours (0 to 441), or null if either isn't a colour. */
export function colourDistance(a: string | null | undefined, b: string | null | undefined): number | null {
  const x = rgb(a), y = rgb(b);
  if (!x || !y) return null;
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

export function kitsTooAlike(homePrimary: string | null | undefined, awayPrimary: string | null | undefined): boolean {
  const d = colourDistance(homePrimary, awayPrimary);
  return d != null && d < KITS.tooAlike;
}

/** The away pair's kit for this match: its own, or the change kit when the two are too alike. */
export function awayKit(homePrimary: string | null | undefined, away: { primary: string | null; secondary: string | null }): { primary: string | null; secondary: string | null; changed: boolean } {
  if (!kitsTooAlike(homePrimary, away.primary)) return { ...away, changed: false };
  const primary = kitsTooAlike(homePrimary, KITS.changePrimary) ? KITS.changePrimaryDark : KITS.changePrimary;
  return { primary, secondary: away.primary, changed: true };
}

/** Each club's kit primary colour, by its teams row id and by its pool club id. */
export function kitColours(teamIds: readonly number[], poolTeamIds: readonly number[]): { team: Map<number, string>; pool: Map<number, string> } {
  const team = new Map<number, string>(), pool = new Map<number, string>();
  if (teamIds.length) for (const t of db.select({ id: teamsTable.id, c: teamsTable.logoColor }).from(teamsTable).where(inArray(teamsTable.id, [...teamIds])).all()) if (t.c) team.set(t.id, t.c);
  if (poolTeamIds.length) for (const p of db.select({ id: continentalPoolTeamsTable.id, c: continentalPoolTeamsTable.primaryColor }).from(continentalPoolTeamsTable).where(inArray(continentalPoolTeamsTable.id, [...poolTeamIds])).all()) if (p.c) pool.set(p.id, p.c);
  return { team, pool };
}

/** A club's kit primary colour by its name (a season's saved standings carry only names): the career's clubs and the pool clubs. */
export function kitColourByName(names: readonly string[], ownTeam: { name: string; logoColor: string | null }): Map<string, string> {
  const map = new Map<string, string>();
  if (names.length) {
    for (const p of db.select({ n: continentalPoolTeamsTable.teamName, c: continentalPoolTeamsTable.primaryColor }).from(continentalPoolTeamsTable)
      .where(inArray(continentalPoolTeamsTable.teamName, [...names])).all()) if (p.c) map.set(p.n, p.c);
  }
  if (ownTeam.logoColor) map.set(ownTeam.name, ownTeam.logoColor);
  return map;
}
