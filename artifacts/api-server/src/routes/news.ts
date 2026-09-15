/**
 * Club news — R-43.
 *
 * Every item is built from a row this career wrote, and its id names that row:
 *   result-<match id>         a completed match of the club's
 *   signing-<contract id>     a contract the club signed
 *   board-<board season id>   the board's season review
 *   trophy-<trophy id>        an honour the club won (R-42)
 *   champion-<season year>    that season's World Final
 *   olympic-<season year>     that year's Olympic tournament (R-61)
 *   academy-<season year>     that season's academy intake (R-62)
 * Each carries the game date it happened on.
 *
 * This replaced a day-seeded generator of invented players, nations,
 * tournaments, transfers, injuries and records, merged into the same list as
 * the club's real items with nothing to tell them apart. A kind of event with no
 * row behind it is not news. Renewals are not listed: a renewal updates the
 * contract in place and records no date.
 */
import { Router } from "express";
import { db, matchesTable, contractsTable, trophiesTable, boardSeasonsTable, playersTable, youthIntakesTable } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { worldFinalsSummary } from "../utils/worldTour.js";
import { getGameDate } from "../utils/gameDate.js";
import { olympicTournament, olympicYearsPlayed } from "../utils/olympics.js";

const router = Router();

type NewsItem = {
  id: string;
  type: "result" | "signing" | "board" | "trophy" | "champion" | "olympic" | "academy";
  headline: string;
  detail: string;
  date: string;
  isUserTeam: boolean;
};

const RECENT_RESULTS = 6;
const RECENT_SIGNINGS = 5;
const MAX_ITEMS = 15;

// On one date, the bigger story first.
const KIND_ORDER: Record<NewsItem["type"], number> = { trophy: 0, olympic: 1, champion: 2, board: 3, academy: 4, result: 5, signing: 6 };
const OLYMPIC_TROPHY_TYPES = new Set(["olympic_gold", "olympic_silver", "olympic_bronze", "olympic_appearance"]);

const GRADE_WORDS: Record<string, string> = {
  met: "met expectations", below: "below expectations", failed: "failed expectations",
};

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

router.get("/news", async (req, res) => {
  if (!req.user) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.json({ items: [] }); return; }
  const careerSaveId = requireCareerSaveId(req.activeCareerSaveId);
  const today = (await getGameDate(team.id)).slice(0, 10);
  const items: NewsItem[] = [];

  // Results: the club's latest completed matches.
  const matches = await db.select().from(matchesTable).where(and(
    or(eq(matchesTable.homeTeamId, team.id), eq(matchesTable.awayTeamId, team.id)),
    eq(matchesTable.status, "completed"),
    isNotNull(matchesTable.scheduledAt),
  )).orderBy(desc(matchesTable.scheduledAt)).limit(RECENT_RESULTS);
  for (const m of matches) {
    const home = m.homeTeamId === team.id;
    const mine = (home ? m.homeScore : m.awayScore) ?? 0;
    const theirs = (home ? m.awayScore : m.homeScore) ?? 0;
    const opponent = (home ? m.awayTeamName : m.homeTeamName) ?? "their opponent";
    items.push({
      id: `result-${m.id}`, type: "result", isUserTeam: true,
      date: m.scheduledAt!.slice(0, 10),
      headline: mine > theirs
        ? `${team.name} beat ${opponent} ${mine}–${theirs}`
        : `${team.name} lose to ${opponent} ${mine}–${theirs}`,
      detail: `Round ${m.round}${m.locationName ? ` · ${m.locationName}` : ""}`,
    });
  }

  // Signings: the club's latest contracts, dated on the game clock (R-51).
  const contracts = await db.select().from(contractsTable).where(eq(contractsTable.teamId, team.id))
    .orderBy(desc(contractsTable.startDate), desc(contractsTable.id)).limit(RECENT_SIGNINGS);
  const names = new Map(
    (contracts.length > 0
      ? await db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable)
          .where(inArray(playersTable.id, contracts.map((c) => c.playerId)))
      : []
    ).map((p) => [p.id, p.name]),
  );
  for (const c of contracts) {
    items.push({
      id: `signing-${c.id}`, type: "signing", isUserTeam: true,
      date: c.startDate.slice(0, 10),
      headline: `${team.name} sign ${names.get(c.playerId) ?? "a player"}`,
      detail: `Contract runs to ${c.endDate.slice(0, 10)}`,
    });
  }

  // Board reviews, and the World Final of each reviewed season.
  const reviews = await db.select().from(boardSeasonsTable).where(and(
    eq(boardSeasonsTable.careerSaveId, careerSaveId),
    isNotNull(boardSeasonsTable.outcome),
    isNotNull(boardSeasonsTable.reviewedOn),
  ));
  const reviewedOn = new Map(reviews.map((r) => [r.seasonYear, r.reviewedOn!.slice(0, 10)]));
  for (const r of reviews) {
    const date = reviewedOn.get(r.seasonYear)!;
    items.push({
      id: `board-${r.id}`, type: "board", isUserTeam: true, date,
      headline: `Board review ${r.seasonYear}: ${r.finish != null ? `finished ${ordinal(r.finish)}, ` : ""}${GRADE_WORDS[r.grade ?? ""] ?? "season reviewed"}`,
      detail: r.confidenceBefore != null && r.confidenceAfter != null
        ? `Board confidence ${r.confidenceBefore} → ${r.confidenceAfter}`
        : "",
    });
    const finals = worldFinalsSummary(careerSaveId, r.seasonYear, team.id);
    if (finals.champion) {
      items.push({
        id: `champion-${r.seasonYear}`, type: "champion", isUserTeam: finals.playerResult === "champion", date,
        headline: `${finals.champion} are World Champions ${r.seasonYear}`,
        detail: finals.runnerUp ? `Beat ${finals.runnerUp} in the World Final` : "Won the World Final",
      });
    }
  }

  // R-61: the Olympic tournaments this career has played.
  const olympicPlayedOn = new Map<number, string>();
  for (const year of olympicYearsPlayed(careerSaveId)) {
    const t = olympicTournament(careerSaveId, year);
    if (!t) continue;
    olympicPlayedOn.set(year, t.playedOn);
    const clubMedal = (["gold", "silver", "bronze"] as const)
      .some((m) => t.medals[m].pair.some((p) => p.kind === "player" && p.teamId === team.id));
    items.push({
      id: `olympic-${year}`, type: "olympic", isUserTeam: clubMedal, date: t.playedOn,
      headline: `${t.medals.gold.nation} win Olympic gold ${year}`,
      detail: `Beat ${t.medals.silver.nation} in the gold medal match; bronze to ${t.medals.bronze.nation}`,
    });
  }

  // R-62: the academy's intakes, one for each season the career has opened.
  const intakes = await db.select().from(youthIntakesTable).where(and(
    eq(youthIntakesTable.careerSaveId, careerSaveId),
    eq(youthIntakesTable.teamId, team.id),
  ));
  for (const intake of intakes) {
    const joined = intake.playerIds.length > 0
      ? await db.select({ id: playersTable.id, name: playersTable.name, nationality: playersTable.nationality, baseAge: playersTable.baseAge })
          .from(playersTable).where(inArray(playersTable.id, intake.playerIds))
      : [];
    items.push({
      id: `academy-${intake.seasonYear}`, type: "academy", isUserTeam: true, date: intake.intakeOn,
      headline: joined.length > 0
        ? `${joined.length} youth player${joined.length === 1 ? "" : "s"} join the ${team.name} academy`
        : `The ${team.name} academy found no one this year`,
      detail: joined.map((p) => `${p.name} (${p.nationality}, ${p.baseAge})`).join(" · "),
    });
  }

  // Honours: season honours are written in the same transaction as the season's
  // review (R-42) and dated by it; Olympic honours are dated by their tournament.
  const trophies = await db.select().from(trophiesTable).where(eq(trophiesTable.teamId, team.id));
  for (const t of trophies) {
    const date = t.year == null ? undefined
      : OLYMPIC_TROPHY_TYPES.has(t.type) ? olympicPlayedOn.get(t.year) : reviewedOn.get(t.year);
    if (!date) continue;
    items.push({ id: `trophy-${t.id}`, type: "trophy", isUserTeam: true, date, headline: t.name, detail: t.notes ?? "" });
  }

  items.sort((a, b) => b.date.localeCompare(a.date) || KIND_ORDER[a.type] - KIND_ORDER[b.type]);
  res.json({ items: items.filter((i) => i.date <= today).slice(0, MAX_ITEMS) });
});

export default router;
