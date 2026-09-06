import { db, contractsTable } from "@workspace/db";
import { loadPlayers, updatePlayerState } from "../lib/playerDto.js";
import { MAX_STARTERS, MAX_INTERCHANGE } from "./squadRules.js";

/**
 * Give a brand-new career a squad it can actually field (R-04), instead of
 * the empty roster a fresh career otherwise starts with — the difficulty
 * choice (R-11) that would size this properly isn't built yet, so this signs
 * the weakest available free-agent seniors, appropriate to a startup club
 * rather than an instant contender. Existing free agents only; this never
 * creates a player.
 *
 * Signs the same way POST /contracts does — a contracts row plus the
 * career_player_state update — so Finance and Contracts read the result
 * exactly as if the manager had signed these players themselves.
 */
export async function seedStartingSquad(
  careerSaveId: number,
  teamId: number,
  contractEndDate: string,
): Promise<void> {
  const freeAgents = await loadPlayers(careerSaveId, { freeAgents: true, playerType: "senior" });
  if (freeAgents.length === 0) return; // nothing to sign — leave the squad empty rather than invent a player

  const overall = (p: { power: number; speed: number; defense: number; serve: number; block: number }) =>
    (p.power + p.speed + p.defense + p.serve + p.block) / 5;

  const squadSize = Math.min(MAX_STARTERS + MAX_INTERCHANGE, freeAgents.length);
  const picks = [...freeAgents].sort((a, b) => overall(a) - overall(b)).slice(0, squadSize);

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
