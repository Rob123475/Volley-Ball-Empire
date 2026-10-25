import { seasonPhase } from "../utils/seasonPhase.js";
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
 *   staff-off-<absence id>    a member of staff went off ill or hurt (final brief 5 Oct, Part B)
 *   injury-<injury id>        one of the club's players was hurt: the injury, its area, time out (night 2, O-7)
 *   staff-back-<absence id>   ... and came back
 *   retirements-<date>        the players who retired that day, his club's first (1.1.1, 18 Oct: player_retirements)
 *   talent-<season year>      that season's new seniors on the free-agent market (1.1.1, 18 Oct: career_new_seniors)
 *   market-<date>             the AI clubs' signings from the free-agent market that day (1.1.3, 25 Oct: ai_market_moves)
 * Each carries the game date it happened on.
 *
 * This replaced a day-seeded generator of invented players, nations,
 * tournaments, transfers, injuries and records, merged into the same list as
 * the club's real items with nothing to tell them apart. A kind of event with no
 * row behind it is not news. Renewals are not listed: a renewal updates the
 * contract in place and records no date.
 */
import { Router } from "express";
import { db, matchesTable, contractsTable, trophiesTable, boardSeasonsTable, playersTable, youthIntakesTable, staffAbsencesTable, staffAbsenceCause, careerInjuriesTable, BODY_AREA_LABELS, type BodyArea,
  playerRetirementsTable, careerNewSeniorsTable, aiMarketMovesTable, continentalPoolTeamsTable } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { requireCareerSaveId } from "../lib/playerDto.js";
import { worldFinalsSummary } from "../utils/worldTour.js";
import { getGameDate, gameDateText } from "../utils/gameDate.js";
import { olympicTournament, olympicYearsPlayed } from "../utils/olympics.js";
import { ACADEMY_CAP } from "../utils/academy.js";

const router = Router();

type NewsItem = {
  id: string;
  type: "result" | "signing" | "board" | "trophy" | "champion" | "olympic" | "academy" | "staff" | "injury" | "retirement" | "talent" | "market";
  headline: string;
  detail: string;
  date: string;
  isUserTeam: boolean;
};

const RECENT_RESULTS = 6;
const RECENT_SIGNINGS = 5;
const MAX_ITEMS = 15;

// On one date, the bigger story first.
const KIND_ORDER: Record<NewsItem["type"], number> = { trophy: 0, olympic: 1, champion: 2, board: 3, academy: 4, retirement: 5, talent: 6, market: 7, result: 8, signing: 9, staff: 10, injury: 11 };
const RETIREMENT_WORDS: Record<string, string> = {
  limit: "the season she turned 40", age: "her age", injury: "injuries", rating: "her form", unsigned: "a season without a club", asked: "asked by her club",
};
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
      // Overnight 30 Sep item 24: a forfeit has no score.
      headline: m.forfeit
        ? `${team.name} forfeit to ${opponent}`
        : mine > theirs
          ? `${team.name} beat ${opponent} ${mine}–${theirs}`
          : `${team.name} lose to ${opponent} ${mine}–${theirs}`,
      detail: `${seasonPhase(m.round).name}${m.locationName ? ` · ${m.locationName}` : ""}`,   // item 27
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
      detail: `Contract runs to ${gameDateText(c.endDate)}`,
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
      headline: `${t.medals.gold.nation} win Nations Cup gold ${year}`,
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
    // R-63: an intake stops at the academy's cap, and says so.
    const nowFull = joined.length > 0 && intake.academySize >= ACADEMY_CAP;
    items.push({
      id: `academy-${intake.seasonYear}`, type: "academy", isUserTeam: true, date: intake.intakeOn,
      headline: joined.length > 0
        ? `${joined.length} youth player${joined.length === 1 ? " joins" : "s join"} the ${team.name} academy`
        : intake.outcome === "full"
          ? `The ${team.name} academy is full (${intake.academySize}/${ACADEMY_CAP}): no intake this year`
          : `The ${team.name} academy found no one this year`,
      detail: [
        ...joined.map((p) => `${p.name} (${p.nationality}, ${p.baseAge})`),
        ...(nowFull ? [`The academy is now full (${intake.academySize}/${ACADEMY_CAP})`] : []),
      ].join(" · "),
    });
  }

  // 1.1.1 (Rob, 18 Oct): retirements, announced on the day (a season's turn, or a club's request),
  // his club's players first; and the season's new seniors on the free-agent market.
  const retirements = await db.select().from(playerRetirementsTable).where(and(
    eq(playerRetirementsTable.careerSaveId, careerSaveId), isNotNull(playerRetirementsTable.retiredOn)));
  const byDay = new Map<string, typeof retirements>();
  for (const r of retirements) byDay.set(r.retiredOn!, [...(byDay.get(r.retiredOn!) ?? []), r]);
  for (const [date, list] of byDay) {
    const ours = list.filter((r) => r.lastTeamId === team.id);
    const ordered = [...ours, ...list.filter((r) => r.lastTeamId !== team.id).sort((a, b) => b.age - a.age)];
    items.push({
      id: `retirements-${date}`, type: "retirement", isUserTeam: ours.length > 0, date,
      headline: ours.length > 0
        ? `${ours.map((r) => r.name).join(" and ")} retire${ours.length === 1 ? "s" : ""}${list.length > ours.length ? `, with ${list.length - ours.length} more around the world` : ""}`
        : `${list.length} player${list.length === 1 ? " retires" : "s retire"} around the world`,
      detail: ordered.slice(0, 12).map((r) => `${r.name} (${r.nationality ?? "?"}, ${r.age}: ${RETIREMENT_WORDS[r.reason ?? "age"] ?? "retired"})`).join(" · ")
        + (ordered.length > 12 ? ` · and ${ordered.length - 12} more` : ""),
    });
  }
  const arrivals = await db.select({ s: careerNewSeniorsTable, name: playersTable.name }).from(careerNewSeniorsTable)
    .innerJoin(playersTable, eq(playersTable.id, careerNewSeniorsTable.playerId))
    .where(eq(careerNewSeniorsTable.careerSaveId, careerSaveId));
  const bySeason = new Map<number, typeof arrivals>();
  for (const a of arrivals) bySeason.set(a.s.seasonYear, [...(bySeason.get(a.s.seasonYear) ?? []), a]);
  for (const [year, list] of bySeason) {
    const fromAbroad = list.filter((a) => a.s.kind === "picture");
    items.push({
      id: `talent-${year}`, type: "talent", isUserTeam: false, date: list[0]!.s.arrivedOn,
      headline: `${list.length} new senior${list.length === 1 ? "" : "s"} on the free-agent market`,
      detail: [...fromAbroad, ...list.filter((a) => a.s.kind !== "picture")].slice(0, 12).map((a) => `${a.name} (${a.s.nation})`).join(" · "),
    });
  }

  // 1.1.3 (Rob, 25 Oct): the AI clubs' market. Each day they sign from the free agents (or promote a youth to fill a
  // place), one item: who went where.
  const signings = await db.select({ m: aiMarketMovesTable, name: playersTable.name, club: continentalPoolTeamsTable.teamName })
    .from(aiMarketMovesTable)
    .innerJoin(playersTable, eq(playersTable.id, aiMarketMovesTable.playerId))
    .innerJoin(continentalPoolTeamsTable, eq(continentalPoolTeamsTable.id, aiMarketMovesTable.poolTeamId))
    .where(and(eq(aiMarketMovesTable.careerSaveId, careerSaveId), inArray(aiMarketMovesTable.kind, ["sign", "promote"])));
  const signedOn = new Map<string, typeof signings>();
  for (const r of signings) signedOn.set(r.m.onDate, [...(signedOn.get(r.m.onDate) ?? []), r]);
  for (const [date, list] of signedOn) {
    const promoted = list.filter((r) => r.m.kind === "promote").length;
    items.push({
      id: `market-${date}`, type: "market", isUserTeam: false, date,
      headline: `AI clubs sign ${list.length - promoted} free agent${list.length - promoted === 1 ? "" : "s"}${promoted ? `, and promote ${promoted} from their academies` : ""}`,
      detail: list.slice(0, 12).map((r) => `${r.name} to ${r.club}${r.m.kind === "promote" ? " (from its academy)" : ""}`).join(" · ")
        + (list.length > 12 ? ` · and ${list.length - 12} more` : ""),
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

  // Final brief 5 Oct, Part B: staff off ill or hurt, and back (staff_absences).
  const absences = await db.select().from(staffAbsencesTable).where(and(
    eq(staffAbsencesTable.careerSaveId, careerSaveId),
    eq(staffAbsencesTable.teamId, team.id),
  ));
  for (const a of absences) {
    const cause = staffAbsenceCause(a.cause);
    items.push({
      id: `staff-off-${a.id}`, type: "staff", isUserTeam: true, date: a.startedOn,
      headline: `${a.staffName} (${a.role}) ${cause?.news ?? "is off"}`,
      detail: `Off for ${a.days} day${a.days === 1 ? "" : "s"}${cause ? ` with ${cause.short}` : ""}: no ${a.role} bonus until back.`,
    });
    if (a.returnedOn) {
      items.push({
        id: `staff-back-${a.id}`, type: "staff", isUserTeam: true, date: a.returnedOn,
        headline: `${a.staffName} (${a.role}) is back at work`,
        detail: cause ? `After ${a.days} day${a.days === 1 ? "" : "s"} off with ${cause.short}.` : "",
      });
    }
  }

  // Night 2 (O-7): the club's players' injuries, named, with their area and time out.
  const injuries = await db.select({ h: careerInjuriesTable, name: playersTable.name })
    .from(careerInjuriesTable).innerJoin(playersTable, eq(playersTable.id, careerInjuriesTable.playerId))
    .where(and(eq(careerInjuriesTable.careerSaveId, careerSaveId), eq(careerInjuriesTable.teamId, team.id)))
    .orderBy(desc(careerInjuriesTable.gameDate)).limit(MAX_ITEMS);
  for (const { h, name } of injuries) {
    const weeks = Math.max(1, Math.round(h.weeksOut));
    items.push({
      id: `injury-${h.id}`, type: "injury", isUserTeam: true, date: h.gameDate,
      headline: `${name}: ${h.injury.toLowerCase()} (${(BODY_AREA_LABELS[h.area as BodyArea] ?? h.area).toLowerCase()})`,
      detail: `Out about ${weeks} week${weeks === 1 ? "" : "s"}${h.reconstruction ? ": a reconstruction, after a third injury there in a year" : ""}.`,
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date) || KIND_ORDER[a.type] - KIND_ORDER[b.type]);
  res.json({ items: items.filter((i) => i.date <= today).slice(0, MAX_ITEMS) });
});

export default router;
