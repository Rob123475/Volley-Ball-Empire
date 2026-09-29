/**
 * Unity brief item 14 (Rob, 29 Sep): an injured Match Player stayed in her slot,
 * and nothing said so. The match itself already left her out (selectPair only
 * picks available players), but silently: the Team page still showed her as a
 * Match Player, and nobody was told who played instead.
 *
 * Now, on match day, an injured Match Player (squad role "starter") is swapped
 * with the fittest healthy interchange player: the interchange becomes a Match
 * Player, the injured player moves to the interchange. The swap is written on
 * the match as its pre-match note ("Substitution: ..."), which the MATCH DAY box
 * shows; completing the match replaces the notes with the match's highlights. If
 * no healthy interchange is left, nothing is swapped and the forfeit rule
 * applies when the match is played (fewer than two available players).
 */
import { db, matchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { loadPlayers, updatePlayerState } from "../lib/playerDto.js";
import { isAvailable, isInjured } from "./condition.js";

export const SUBSTITUTION_PREFIX = "Substitution: ";

export interface MatchDaySubstitution { outId: number; outName: string; injury: string; inId: number; inName: string; inFitness: number }

/** Swap every injured Match Player for the fittest healthy interchange. Idempotent. */
export async function substituteInjuredMatchPlayers(careerSaveId: number, teamId: number, matchId: number): Promise<MatchDaySubstitution[]> {
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1);
  if (!match || match.status !== "scheduled") return [];

  const players = await loadPlayers(careerSaveId, { teamId });
  const injuredStarters = players.filter((p) => p.squadRole === "starter" && isInjured(p));
  if (injuredStarters.length === 0) return [];
  const bench = players
    .filter((p) => p.squadRole === "interchange" && isAvailable(p))
    .sort((a, b) => Number(b.fitness ?? 0) - Number(a.fitness ?? 0));

  const made: MatchDaySubstitution[] = [];
  for (const out of injuredStarters) {
    const on = bench.shift();
    if (!on) break;
    await updatePlayerState(careerSaveId, on.id, { squadRole: "starter", isActive: true });
    await updatePlayerState(careerSaveId, out.id, { squadRole: "interchange", isActive: true });
    made.push({
      outId: out.id, outName: out.name, injury: out.injuryStatus && out.injuryStatus !== "Healthy" ? out.injuryStatus : "Injured",
      inId: on.id, inName: on.name, inFitness: Math.round(Number(on.fitness ?? 0)),
    });
  }
  if (made.length > 0) {
    const notes = made.map((s) => `${SUBSTITUTION_PREFIX}${s.inName} (fitness ${s.inFitness}%) comes in for ${s.outName} (${s.injury.toLowerCase()}).`);
    const earlier = (Array.isArray(match.highlights) ? match.highlights : []).filter((h) => h.startsWith(SUBSTITUTION_PREFIX));
    // The stored lineup, if any, loses the injured player: the pair is re-picked.
    const lineup = Array.isArray(match.lineup) ? match.lineup.filter((id) => !made.some((s) => s.outId === id)) : match.lineup;
    await db.update(matchesTable).set({ highlights: [...earlier, ...notes], lineup }).where(eq(matchesTable.id, matchId));
  }
  return made;
}

/** The pre-match substitution notes on a scheduled match (what the MATCH DAY box shows). */
export function substitutionNotes(match: { status: string; highlights: unknown } | null | undefined): string[] {
  if (!match || match.status !== "scheduled" || !Array.isArray(match.highlights)) return [];
  return (match.highlights as unknown[]).filter((h): h is string => typeof h === "string" && h.startsWith(SUBSTITUTION_PREFIX));
}
