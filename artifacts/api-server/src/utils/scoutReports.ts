/**
 * Update 1, overnight brief part 4 (Rob, 14 Oct, B-3): scout reports are kept.
 *
 *   - Every report is a row (career_scout_reports): when the scout was sent,
 *     when the report is in (SCOUT_DAYS game days on), her rating when he was
 *     sent and his reading of her potential. They never lapse (the season-end
 *     lapse is deleted); an old one just shows its date.
 *   - The first report works as before: career_player_state.scout_started_on
 *     starts the clock, and the card reveals her when it is in.
 *   - A re-scout (allowed whenever the club likes once a report is in, at the
 *     same price and SCOUT_DAYS) leaves the card as it is until the new report
 *     is in; then (applyDueScoutReportsTx, every game day) it becomes her report:
 *     scouted_potential, scout_report_by and scout_started_on are the newest's.
 *   - The card shows the history, oldest first: "Mar 2027 71 → Jun 73 → Sep 76".
 *
 * Scouting is per career and player, whoever she plays for: an AI club's
 * player is scouted like a free agent, and a report stays with her when she
 * moves club (an AI club's signing no longer clears it).
 */
import { careerScoutReportsTable, careerPlayerStateTable, careerWatchListTable } from "@workspace/db";
import { and, asc, eq } from "drizzle-orm";
import type { CareerStateTx } from "../lib/playerDto.js";
import { SCOUT_DAYS } from "./marketScouting.js";

type Tx = CareerStateTx["tx"];

export type ScoutReport = { startedOn: string; readyOn: string; rating: number; potential: string; scoutName: string | null };

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A scout is sent: his report is in SCOUT_DAYS game days on. */
export function recordScoutReportTx(tx: Tx, careerSaveId: number, playerId: number, r: Omit<ScoutReport, "readyOn">): ScoutReport {
  const report = { ...r, readyOn: addDays(r.startedOn, SCOUT_DAYS) };
  tx.insert(careerScoutReportsTable).values({ careerSaveId, playerId, ...report }).run();
  return report;
}

/** Every report in this career, by player, oldest first. */
export function scoutReportsByPlayerTx(tx: Tx, careerSaveId: number): Map<number, ScoutReport[]> {
  const map = new Map<number, ScoutReport[]>();
  const rows = tx.select().from(careerScoutReportsTable)
    .where(eq(careerScoutReportsTable.careerSaveId, careerSaveId))
    .orderBy(asc(careerScoutReportsTable.readyOn), asc(careerScoutReportsTable.id)).all();
  for (const r of rows) {
    map.set(r.playerId, [...(map.get(r.playerId) ?? []), {
      startedOn: r.startedOn, readyOn: r.readyOn, rating: r.rating, potential: r.potential, scoutName: r.scoutName,
    }]);
  }
  return map;
}

/** What a card shows: the reports that are in (oldest first), and a re-scout still out, if any. */
export function scoutHistoryView(reports: readonly ScoutReport[] | undefined, today: string) {
  const all = reports ?? [];
  const pending = all.find((r) => r.readyOn > today) ?? null;
  return {
    scoutHistory: all.filter((r) => r.readyOn <= today).map((r) => ({ on: r.readyOn, rating: r.rating, potential: r.potential })),
    rescouting: pending
      ? { readyOn: pending.readyOn, daysLeft: Math.round((Date.parse(`${pending.readyOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) }
      : null,
  };
}

/**
 * A re-scout whose report is in becomes her report: the newest report in
 * replaces the one on her career state. Every game day (routes/calendar.ts).
 */
export function applyDueScoutReportsTx(w: CareerStateTx, careerSaveId: number, today: string): number {
  const latest = new Map<number, ScoutReport>();
  for (const [playerId, reports] of scoutReportsByPlayerTx(w.tx, careerSaveId)) {
    const done = reports.filter((r) => r.readyOn <= today).at(-1);
    if (done) latest.set(playerId, done);
  }
  if (latest.size === 0) return 0;
  const states = new Map(w.tx.select({ id: careerPlayerStateTable.playerId, started: careerPlayerStateTable.scoutStartedOn })
    .from(careerPlayerStateTable).where(eq(careerPlayerStateTable.careerSaveId, careerSaveId)).all().map((s) => [s.id, s.started]));
  let n = 0;
  for (const [playerId, r] of latest) {
    const started = states.get(playerId);
    if (started == null || started >= r.startedOn) continue;
    w.setPlayerState(careerSaveId, playerId, {
      scoutStartedOn: r.startedOn, scoutedPotential: r.potential, ...(r.scoutName ? { scoutReportBy: r.scoutName } : {}),
    });
    n++;
  }
  return n;
}

// ── The watch list ───────────────────────────────────────────────────────────

/** The players this career watches. */
export function watchedTx(tx: Tx, careerSaveId: number): Set<number> {
  return new Set(tx.select({ id: careerWatchListTable.playerId }).from(careerWatchListTable)
    .where(eq(careerWatchListTable.careerSaveId, careerSaveId)).all().map((r) => r.id));
}

/** Star or un-star a player. */
export function setWatchedTx(tx: Tx, careerSaveId: number, playerId: number, watch: boolean, today: string): void {
  if (watch) {
    tx.insert(careerWatchListTable).values({ careerSaveId, playerId, addedOn: today }).onConflictDoNothing().run();
  } else {
    tx.delete(careerWatchListTable).where(and(eq(careerWatchListTable.careerSaveId, careerSaveId), eq(careerWatchListTable.playerId, playerId))).run();
  }
}
