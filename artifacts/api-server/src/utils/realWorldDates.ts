/**
 * Overnight brief 30 Sep, item 3: an existing save keeps real-world (PC clock)
 * dates on records written before the game dated them on its own calendar:
 * Rob's "First Steps" said 29 Sept 2026 (won 17 Feb 2026), a training session
 * "finished 4 Oct". This boot pass converts every such date to the GAME date
 * it belongs to. Idempotent: a converted value is a game date, which the tests
 * below never match again.
 *
 * How a real moment becomes a game date: the ledger. Every finance row carries
 * both the real time it was written (created_at) and the game date it was
 * written for (date), and a club writes one every game week and at every match.
 * A real moment maps to the game date of the last ledger row written at or
 * before it (after the last row: the club's current game date; before the
 * first: the first row's date).
 *
 * What is converted (the player sees each):
 *   achievements.unlocked_at, injury_history.date_injured
 *       - real when not at 00:00 UTC (a game date is stored as its midnight);
 *   training_sessions.scheduled_at - real when it carries a time ("2026-09-29T02:43");
 *     a finished session of that kind finished the same day (it was instant);
 *   finance_transactions.date - real when it carries a time;
 *   contracts.start_date - real when later than the club's game date (a start
 *     cannot be in the future); its created_at dates it;
 *   continental_scouting_missions start/end, once no longer active - real when
 *     not at midnight (an active one is converted by its own rule,
 *     routes/continental-scouting.ts).
 * The writers of the first two now write the game date (check-achievements,
 * matches.ts); the others already did.
 */
import { sqlite } from "@workspace/db";

const DAY = 86_400;
const toSec = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 1000;

export function convertRealWorldDates(): Record<string, number> {
  const converted: Record<string, number> = {};
  const bump = (k: string) => { converted[k] = (converted[k] ?? 0) + 1; };
  const clubs = sqlite.prepare(`SELECT team_id AS teamId, "current_date" AS today FROM calendar_state`).all() as { teamId: number; today: string }[];

  sqlite.transaction(() => {
    for (const { teamId, today } of clubs) {
      const pairs = sqlite.prepare(
        `SELECT created_at AS t, date FROM finance_transactions WHERE team_id = ? AND date NOT LIKE '%T%' ORDER BY created_at, id`,
      ).all(teamId) as { t: number; date: string }[];
      const gameDateAt = (realSec: number): string => {
        if (pairs.length === 0 || realSec >= pairs[pairs.length - 1]!.t) return today;
        let lo = 0, hi = pairs.length - 1, found = -1;
        while (lo <= hi) { const mid = (lo + hi) >> 1; if (pairs[mid]!.t <= realSec) { found = mid; lo = mid + 1; } else hi = mid - 1; }
        return (found >= 0 ? pairs[found]! : pairs[0]!).date.slice(0, 10);
      };

      for (const r of sqlite.prepare(`SELECT id, unlocked_at AS t FROM achievements WHERE team_id = ? AND unlocked_at % ${DAY} != 0`).all(teamId) as { id: number; t: number }[]) {
        sqlite.prepare(`UPDATE achievements SET unlocked_at = ? WHERE id = ?`).run(toSec(gameDateAt(r.t)), r.id); bump("achievements");
      }
      for (const r of sqlite.prepare(`SELECT id, date_injured AS t FROM injury_history WHERE team_id = ? AND date_injured % ${DAY} != 0`).all(teamId) as { id: number; t: number }[]) {
        sqlite.prepare(`UPDATE injury_history SET date_injured = ? WHERE id = ?`).run(toSec(gameDateAt(r.t)), r.id); bump("injury_history");
      }
      for (const r of sqlite.prepare(`SELECT id, scheduled_at AS s, status FROM training_sessions WHERE team_id = ? AND scheduled_at LIKE '%T%'`).all(teamId) as { id: number; s: string; status: string }[]) {
        const real = Date.parse(r.s.length <= 16 ? `${r.s}:00Z` : r.s) / 1000;
        const game = gameDateAt(Number.isFinite(real) ? real : Date.now() / 1000);
        if (r.status === "completed") sqlite.prepare(`UPDATE training_sessions SET scheduled_at = ?, finishes_on = ? WHERE id = ?`).run(game, game, r.id);
        else sqlite.prepare(`UPDATE training_sessions SET scheduled_at = ?, finishes_on = NULL WHERE id = ?`).run(game, r.id);
        bump("training_sessions");
      }
      for (const r of sqlite.prepare(`SELECT id, created_at AS t FROM finance_transactions WHERE team_id = ? AND date LIKE '%T%'`).all(teamId) as { id: number; t: number }[]) {
        sqlite.prepare(`UPDATE finance_transactions SET date = ? WHERE id = ?`).run(gameDateAt(r.t), r.id); bump("finance_transactions");
      }
      for (const r of sqlite.prepare(`SELECT id, created_at AS t FROM contracts WHERE team_id = ? AND substr(start_date, 1, 10) > ?`).all(teamId, today) as { id: number; t: number }[]) {
        sqlite.prepare(`UPDATE contracts SET start_date = ? WHERE id = ?`).run(gameDateAt(r.t), r.id); bump("contracts");
      }
      for (const r of sqlite.prepare(
        `SELECT id, start_date AS s, end_date AS e FROM continental_scouting_missions
          WHERE team_id = ? AND status != 'active' AND (start_date % ${DAY} != 0 OR end_date % ${DAY} != 0)`,
      ).all(teamId) as { id: number; s: number; e: number }[]) {
        sqlite.prepare(`UPDATE continental_scouting_missions SET start_date = ?, end_date = ? WHERE id = ?`)
          .run(toSec(gameDateAt(r.s)), toSec(gameDateAt(r.e)), r.id);
        bump("continental_scouting_missions");
      }
    }
  })();
  return converted;
}
