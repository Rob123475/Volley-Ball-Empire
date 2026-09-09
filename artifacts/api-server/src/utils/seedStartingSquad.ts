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
export async function seedStartingSquad(
  careerSaveId: number,
  teamId: number,
  contractEndDate: string,
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

  const today = new Date().toISOString().split("T")[0]!;

  for (const [i, player] of picks.entries()) {
    const squadRole = i < MAX_STARTERS ? "starter" : "interchange";

    await db.insert(contractsTable).values({
      playerId: player.id,
      teamId,
      salary: player.salary,
      startDate: today,
      endDate: contractEndDate,
      bonusPerWin: 0,
    });

    await updatePlayerState(careerSaveId, player.id, {
      teamId,
      salary: player.salary,
      contractEndDate,
      isActive: true,
      squadRole,
    });
  }
}
