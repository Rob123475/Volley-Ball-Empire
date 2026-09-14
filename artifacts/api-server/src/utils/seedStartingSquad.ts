import { db, contractsTable } from "@workspace/db";
import { loadPlayers, updatePlayerState } from "../lib/playerDto.js";
import { MAX_STARTERS, MAX_INTERCHANGE } from "./squadRules.js";
import type { CareerDifficulty } from "./careerDifficulty.js";

/**
 * Give a brand-new career a squad it can actually field (R-04), instead of
 * the empty roster a fresh career otherwise starts with. Existing free
 * agents only; this never creates a player.
 *
 * R-11: squad quality now follows difficulty, per docs/economy-design.md's
 * "What the player should feel" — UNDERDOG ("every signing hurts," a
 * startup club) keeps the original weakest-available picks; ESTABLISHED
 * ("comfortable... competing in Silver/Gold") picks the strongest available
 * instead. No new number invented for this half — "best available" vs
 * "worst available" is exactly what the doc's contrast asks for, from a pool
 * that already exists.
 *
 * Signs the same way POST /contracts does — a contracts row plus the
 * career_player_state update — so Finance and Contracts read the result
 * exactly as if the manager had signed these players themselves.
 */
/** A contract's dates, in GAME time. */
export type ContractTerm = { startDate: string; endDate: string };

/**
 * R-48: a starting-squad contract runs for the career's first season, dated
 * from that season's own row. It used to be signed to a literal "2026-12-31"
 * (and started on the computer's clock), so a career starting in any other year
 * would have opened with its whole squad already out of contract.
 */
export function oneSeasonContract(season: { startDate: string; endDate: string }): ContractTerm {
  return { startDate: season.startDate, endDate: season.endDate };
}

export async function seedStartingSquad(
  careerSaveId: number,
  teamId: number,
  term: ContractTerm,
  difficulty: CareerDifficulty = "established",
): Promise<void> {
  const freeAgents = await loadPlayers(careerSaveId, { freeAgents: true, playerType: "senior" });
  if (freeAgents.length === 0) return; // nothing to sign — leave the squad empty rather than invent a player

  const overall = (p: { power: number; speed: number; defense: number; serve: number; block: number }) =>
    (p.power + p.speed + p.defense + p.serve + p.block) / 5;

  const squadSize = Math.min(MAX_STARTERS + MAX_INTERCHANGE, freeAgents.length);
  const sorted = difficulty === "underdog"
    ? [...freeAgents].sort((a, b) => overall(a) - overall(b)) // weakest first
    : [...freeAgents].sort((a, b) => overall(b) - overall(a)); // strongest first
  const picks = sorted.slice(0, squadSize);

  for (const [i, player] of picks.entries()) {
    const squadRole = i < MAX_STARTERS ? "starter" : "interchange";

    await db.insert(contractsTable).values({
      playerId: player.id,
      teamId,
      salary: player.salary,
      startDate: term.startDate,
      endDate: term.endDate,
      bonusPerWin: 0,
    });

    await updatePlayerState(careerSaveId, player.id, {
      teamId,
      salary: player.salary,
      contractEndDate: term.endDate,
      isActive: true,
      squadRole,
    });
  }
}
