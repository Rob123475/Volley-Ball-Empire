/**
 * Update 1, night 2 (Rob, 15 Oct, O-10): the injured list, for every club.
 *
 *   on        an injury of more than INJURED_LIST.overWeeks puts her on it at
 *             once (utils/injuries.ts startInjuryTx), with the club's other
 *             seniors written down. While she is on it she does not take one of
 *             the three senior places (routes/contracts.ts, routes/team.ts), so
 *             the club can promote, sign or loan in cover. Her wage still counts
 *             toward the cap (utils/salaryCap.ts counts every senior), and a
 *             promoted youth is never blocked by the cap (C-5).
 *   cover     Rob's rule: anyone taken on while she is out (a senior not on the
 *             list when she went on it) is cover. While cover is still on the
 *             roster she can't play, even fit: "Fit, waiting for a place". The
 *             club must release, sell or loan out the spare first. With no cover
 *             taken on she is back in the squad as soon as she is fit.
 *   AI clubs  the same list (utils/aiSquads.ts aiInjuredListDayTx): a place
 *             filled from the academy (best 16+), else the best free agent it
 *             can afford and fit; when she is fit, its weakest is released.
 *   leaving   a player who leaves the club comes off the list.
 */
import { careerPlayerStateTable, playersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { withCareerStateTx, type CareerStateTx } from "../lib/playerDto.js";
import { seniorIdsTx } from "./injuries.js";
import { MAX_STARTERS } from "./squadRules.js";
import { aiInjuredListDayTx } from "./aiSquads.js";

const OFF_THE_LIST = { onInjuredList: false, injuredListSince: null, injuredListSquad: null } as const;

/** Back in the player's squad: a starter if a match place is free, else the interchange. */
function backInTheSquad(w: CareerStateTx, careerSaveId: number, teamId: number) {
  const s = careerPlayerStateTable;
  const starters = w.tx.select({ id: s.playerId }).from(s)
    .where(and(eq(s.careerSaveId, careerSaveId), eq(s.teamId, teamId), eq(s.squadRole, "starter"), eq(s.isRetired, false))).all().length;
  return { ...OFF_THE_LIST, squadRole: starters < MAX_STARTERS ? "starter" : "interchange", isActive: true };
}

/** Her cover still on the roster: the club's seniors now who were not there when she went on the list. */
export function coverOnRoster(p: { injuredListSquad: string | null }, seniorsNow: readonly number[]): number[] {
  const then = new Set((p.injuredListSquad ?? "").split(",").filter(Boolean).map(Number));
  return seniorsNow.filter((id) => !then.has(id));
}

/** What the pages say about a player on the list. */
export function injuredListStatus(p: { onInjuredList: boolean; injuryStatus: string; injuredListSquad: string | null }, seniorsNow: readonly number[]): "injured" | "waiting" | null {
  if (!p.onInjuredList) return null;
  if (p.injuryStatus !== "Healthy") return "injured";
  return coverOnRoster(p, seniorsNow).length > 0 ? "waiting" : null;
}

/**
 * The game day's injured-list step (routes/calendar.ts): the player's club's
 * fit players come off it once no cover is left, players who left a club come
 * off it, and the AI clubs do the same by their own rule. Returns Club News.
 */
export function injuredListDayTx(w: CareerStateTx, careerSaveId: number, teamId: number, today: string): string[] {
  const news = clubInjuredListTx(w, careerSaveId, teamId);
  aiInjuredListDayTx(w, careerSaveId, today);
  return news;
}

/** The player's club: anyone fit on the list with no cover left comes back now (also after a release). */
export function clubInjuredListTx(w: CareerStateTx, careerSaveId: number, teamId: number): string[] {
  const s = careerPlayerStateTable;
  const news: string[] = [];
  const listed = w.tx.select({ id: s.playerId, name: playersTable.name, teamId: s.teamId, poolTeamId: s.poolTeamId, injuryStatus: s.injuryStatus, injuredListSquad: s.injuredListSquad })
    .from(s).innerJoin(playersTable, eq(playersTable.id, s.playerId))
    .where(and(eq(s.careerSaveId, careerSaveId), eq(s.onInjuredList, true))).all();
  for (const p of listed) {
    if (p.teamId == null && p.poolTeamId == null) { w.setPlayerState(careerSaveId, p.id, { ...OFF_THE_LIST, squadRole: "reserve", isActive: false }); continue; }
    if (p.teamId !== teamId || p.injuryStatus !== "Healthy") continue;
    const cover = coverOnRoster(p, seniorIdsTx(w, careerSaveId, { teamId }, p.id));
    if (cover.length > 0) continue;
    w.setPlayerState(careerSaveId, p.id, backInTheSquad(w, careerSaveId, teamId));
    news.push(`${p.name} is fit and back in the squad`);
  }
  return news;
}

/** After the player's club lets a player go: a fit player waiting for a place may have one now. */
export function afterSquadChange(careerSaveId: number, teamId: number): void {
  withCareerStateTx((w) => clubInjuredListTx(w, careerSaveId, teamId));
}
