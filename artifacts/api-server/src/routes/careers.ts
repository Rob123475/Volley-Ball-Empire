import { Router } from "express";
import { db } from "@workspace/db";
import {
  careerSavesTable,
  teamsTable,
  careerHistoryEntriesTable,
  seasonsTable,
} from "@workspace/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";
import { seedCareerState } from "../utils/migrateCareerState.js";
import { deleteCareerSave } from "../utils/deleteCareerSave.js";
import { seedStartingSquad, oneSeasonContract } from "../utils/seedStartingSquad.js";
import { FIRST_SEASON_YEAR } from "../utils/seasonRollover.js";
import { ensureSeasonFixture } from "./matches.js";
import { ensureCompetitorRanking } from "../utils/competitors.js";
import { ensureBoardSeason } from "../utils/board-confidence.js";
import {
  openPoolClubBooksTx, openPoolClubSeasonsTx,
} from "../utils/poolClubFinances.js";
import { seasonEndsForCareerTx } from "../utils/seasonDates.js";
import { buildCareerSummary, endCareer, computeManagerSalary } from "../utils/careerLifecycle.js";
import { isOlympicYear } from "../utils/olympics.js";
import {
  isCareerDifficulty, startingBudgetFor,
  type CareerDifficulty,
} from "../utils/careerDifficulty.js";

const router = Router();

// GET /careers — list save slots for current user
router.get("/careers", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select({
      id:                careerSavesTable.id,
      teamId:            careerSavesTable.teamId,
      slotNumber:        careerSavesTable.slotNumber,
      managerName:       careerSavesTable.managerName,
      clubName:          careerSavesTable.clubName,
      originalClubName:  careerSavesTable.originalClubName,
      season:            careerSavesTable.season,
      worldRanking:      careerSavesTable.worldRanking,
      budget:            careerSavesTable.budget,
      managerReputation: careerSavesTable.managerReputation,
      retiredAt:         careerSavesTable.retiredAt,
      lastPlayedAt:      careerSavesTable.lastPlayedAt,
      createdAt:         careerSavesTable.createdAt,
      primaryColor:      teamsTable.logoColor,
      secondaryColor:    teamsTable.secondaryLogoColor,
      crestShapeIndex:   teamsTable.crestShapeIndex,
    })
    .from(careerSavesTable)
    .leftJoin(teamsTable, eq(teamsTable.id, careerSavesTable.teamId))
    .where(eq(careerSavesTable.userId, req.user.id))
    .orderBy(careerSavesTable.slotNumber);

  const activeTeamId       = req.activeTeamId ?? null;
  const activeCareerSaveId = req.activeCareerSaveId ?? null;

  const activeSave = activeCareerSaveId
    ? rows.find(s => s.id === activeCareerSaveId)
    : activeTeamId ? rows.find(s => s.teamId === activeTeamId) : null;

  res.json({
    saves: rows.map(s => ({
      id:                s.id,
      teamId:            s.teamId ?? null,
      slotNumber:        s.slotNumber,
      managerName:       s.managerName,
      clubName:          s.clubName,
      originalClubName:  s.originalClubName ?? null,
      season:            s.season,
      worldRanking:      s.worldRanking,
      budget:            s.budget,
      managerReputation: s.managerReputation ?? 50,
      primaryColor:      s.primaryColor ?? null,
      secondaryColor:    s.secondaryColor ?? null,
      crestShapeIndex:   s.crestShapeIndex ?? null,
      retiredAt:         s.retiredAt ? s.retiredAt.toISOString() : null,
      lastPlayedAt:      s.lastPlayedAt.toISOString(),
      createdAt:         s.createdAt.toISOString(),
    })),
    activeCareerSaveId: activeSave?.id ?? null,
  });
});

// GET /careers/summary — end-career stats for the active career
router.get("/careers/summary", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const teamId = req.activeTeamId;
  if (!teamId)   { res.status(404).json({ error: "No active career" }); return; }

  const summary = await buildCareerSummary(teamId, req.user.id);
  res.json(summary);
});

// GET /careers/contract — employment terms for the active career (R-09/R-14).
//
// Everything here is real, derived from data that already exists: `releaseFee`
// is the exact figure /careers/break-contract charges (BREAK_CONTRACT_FEE,
// defined below), and `salary` is derived from manager reputation
// (computeManagerSalary). There is no contract-length/negotiation system in
// this game (R-12 removed the stub UI for one), so this deliberately does not
// invent term dates, fan approval or objectives the way the old frontend
// placeholder did — those aren't real data and showing them as if they were
// would just move the placeholder problem, not fix it.
router.get("/careers/contract", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }
  const teamId = req.activeTeamId;
  if (!teamId)   { res.status(404).json({ error: "No active career" }); return; }

  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(and(eq(careerSavesTable.teamId, teamId), eq(careerSavesTable.userId, req.user.id)));

  if (!save) { res.status(404).json({ error: "Career save not found" }); return; }

  res.json({
    clubName:   save.clubName,
    season:     save.season,
    status:     "Active" as const,
    salary:     computeManagerSalary(save.managerReputation ?? 50),
    releaseFee: BREAK_CONTRACT_FEE,
  });
});

// POST /careers — create or overwrite a slot
router.post("/careers", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { slotNumber, managerName, managerNationality, clubName, originalClubName, season, worldRanking, budget, difficulty: rawDifficulty, locationId, primaryColor, secondaryColor, crestShapeIndex } = req.body as {
    slotNumber:           number;
    managerName:          string;
    managerNationality?:  string | null;
    clubName:             string;
    originalClubName?:    string | null;
    season?:              string;
    worldRanking?:        number | null;
    budget?:              number | null;
    difficulty?:          string | null;
    locationId?:          number | null;
    primaryColor?:        string | null;
    secondaryColor?:      string | null;
    crestShapeIndex?:     number | null;
  };

  if (
    typeof slotNumber !== "number" || slotNumber < 1 || slotNumber > 3 ||
    typeof managerName !== "string" || managerName.trim().length === 0 ||
    typeof clubName !== "string"    || clubName.trim().length === 0
  ) {
    res.status(400).json({ error: "Invalid body" }); return;
  }

  // R-11: an unset or unrecognised difficulty defaults to "established" —
  // the pre-R-11 behaviour (comfortable flat budget, no tier head start),
  // rather than rejecting a caller that predates this field.
  const difficulty: CareerDifficulty = isCareerDifficulty(rawDifficulty) ? rawDifficulty : "established";

  const [existing] = await db
    .select()
    .from(careerSavesTable)
    .where(and(
      eq(careerSavesTable.userId,     req.user.id),
      eq(careerSavesTable.slotNumber, slotNumber),
    ));

  if (existing) {
    // Overwriting a slot must only remove save-slot-owned data, the same
    // scope as DELETE /careers/:id below — deleteCareerSave is the one place
    // that knows every table with a non-cascading FK to career_saves. The old
    // team is GLOBAL world data (referenced by 25 other tables) and must NOT
    // be deleted — it's left orphaned, same as DELETE /careers/:id does.
    try {
      deleteCareerSave(existing.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      req.log.error({ err, saveId: existing.id, userId: req.user.id }, "POST /careers overwrite failed");
      res.status(500).json({ error: `Database error while overwriting save slot: ${message}` });
      return;
    }
  }

  // Seasons are global (shared across every save/team), not per-career, so
  // this only creates one the very first time any career is started. Without
  // it, nothing ever populates seasonsTable — /api/calendar, the annual
  // calendar, and getOrCreateCalendar() all depend on an active season and
  // silently fail/return empty without one. Bounds are chosen so the
  // existing hardcoded World Tour match dates (worldTour.ts) land exactly
  // where the linear round→date interpolation in calendar.ts expects them
  // (round 11 → 2026-02-17, round 72 → 2026-12-02).

  // R-11: starting budget is decided by difficulty, not the club-selected
  // figure the wizard still sends for older callers — see careerDifficulty.ts
  // for why these are picked numbers, not derived from the design doc.
  const startingBudget = startingBudgetFor(difficulty);

  const [newTeam] = await db
    .insert(teamsTable)
    .values({
      userId:             req.user.id,
      name:               clubName.trim(),
      budget:             startingBudget,
      reputation:         50,
      ...(locationId   ? { locationId }                   : {}),
      ...(primaryColor ? { logoColor: primaryColor }      : {}),
      ...(secondaryColor ? { secondaryLogoColor: secondaryColor } : {}),
      ...(crestShapeIndex != null ? { crestShapeIndex } : {}),
    })
    .returning();

  const [inserted] = await db
    .insert(careerSavesTable)
    .values({
      userId:              req.user.id,
      teamId:              newTeam.id,
      slotNumber,
      managerName:         managerName.trim(),
      managerNationality:  managerNationality?.trim() ?? null,
      clubName:            clubName.trim(),
      originalClubName:    originalClubName?.trim() ?? null,
      season:              season ?? "Season 1",
      worldRanking:        worldRanking ?? null,
      budget:              startingBudget,
      difficulty,
      lastPlayedAt:        new Date(),
    })
    .returning();

  // Per-career player and staff state. Without this a new career has no rows in
  // career_player_state, so its transfer market is empty and nothing can be
  // signed — players are global reference data and the career half must exist.
  seedCareerState(inserted!.id);

  // This career's own season timeline. Previously one global season row was
  // created on the first career and every later career reused it, so a second
  // career inherited the first one's currentRound and could start mid-season or
  // immediately at season end. Multiple careers per install is a shipped
  // feature, so that was a live bug, not just a harness artifact.
  //
  // Bounds are chosen so the hardcoded World Tour dates (worldTour.ts) land
  // where calendar.ts's round->date interpolation expects them
  // (round 11 -> 2026-02-17, round 72 -> 2026-12-02).
  //
  // R-48: created BEFORE the starting squad, because the squad's contracts are
  // dated from this row, and its year is FIRST_SEASON_YEAR rather than a literal.
  const firstYear = FIRST_SEASON_YEAR;
  const [season1] = await db.insert(seasonsTable).values({
    careerSaveId:            inserted!.id,
    year:                    firstYear,
    name:                    "Season 1",
    status:                  "active",
    totalRounds:             78,
    currentRound:            1,
    startDate:               `${firstYear}-01-01`,
    endDate:                 `${firstYear}-12-31`,
    isOlympicSeason:         isOlympicYear(firstYear),
    regionalRoundsProcessed: 0,
  }).returning();

  // R-53: the board's first season, opened on the starting budget — the
  // balance season 1's money places are measured from.
  ensureBoardSeason(inserted!.id, season1!.year, newTeam.id);

  // Rob, 23 Sep: every club in this world has books, not only this one. The
  // sixty open on the same balance an established career opens on, their pairs
  // sign on the same three contract lengths, and season 1 is opened for them
  // the way it is opened for the player - which is the chain the five
  // loss-making seasons are read from (utils/poolClubFinances.ts).
  db.transaction((tx) => {
    openPoolClubBooksTx(tx, inserted!.id, `${firstYear}-01-01`, seasonEndsForCareerTx(tx, inserted!.id));
    openPoolClubSeasonsTx(tx, inserted!.id, season1!.year);
  });

  // A startup squad so the manager isn't staring at zero players (R-04).
  // R-11: quality now follows difficulty — see seedStartingSquad.ts.
  // R-48: contracts for the career's first season, dated from its season row.
  await seedStartingSquad(inserted!.id, newTeam.id, oneSeasonContract(season1!), difficulty);

  // R-26: fixture generation used to be lazy — only GET /matches/fixture ever
  // called it, so a career had no schedule until the player happened to open
  // the Fixtures page. Generated eagerly here so a career is never without
  // one; GET /matches/fixture and GET /dashboard call the same function
  // (idempotent — a career that already has its fixture returns immediately)
  // as a repair net for saves created before this existed.
  //
  // R-35: the year comes from the season row just created rather than a second
  // hardcoded 2026. The fixture belongs to a season, so the season is what
  // should say which year it is — two independent literals could disagree, and
  // a fixture generated for a year the season is not in is invisible
  // (ensureSeasonFixture filters by season year), which is the same empty-season
  // failure R-35 fixes at the rollover end.
  await ensureSeasonFixture(newTeam, season1!.year);

  // R-26: the ladder is built from competitor_rankings, which only ever
  // gained a row on a career's first PLAYED match — a schedule alone
  // doesn't rank you. Seed a zero row so the player appears on their own
  // ladder from day one instead of the ladder staying empty until then.
  // R-54: every club starts at zero. R-11's established head start is gone;
  // difficulty sets season 1's purse access instead (careerDifficulty.ts).
  await ensureCompetitorRanking(newTeam.id, inserted!.id, season1!.year);

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) await updateSession(sid, { ...session, activeTeamId: newTeam.id, activeCareerSaveId: inserted.id });
  }

  res.json({
    id:               inserted.id,
    teamId:           inserted.teamId ?? null,
    slotNumber:       inserted.slotNumber,
    managerName:      inserted.managerName,
    clubName:         inserted.clubName,
    originalClubName: inserted.originalClubName ?? null,
    season:           inserted.season,
    worldRanking:     inserted.worldRanking,
    budget:           inserted.budget,
    lastPlayedAt:     inserted.lastPlayedAt.toISOString(),
    createdAt:        inserted.createdAt.toISOString(),
  });
});

// POST /careers/end — retire career, archive to Hall of Fame, clear session
router.post("/careers/end", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const teamId = req.activeTeamId;

  if (teamId) {
    await endCareer(req, teamId, req.user.id, {
      type: "retirement",
      description: (s) =>
        `${s.managerName} retired after a career spanning ${s.totalWins + s.totalLosses} matches, ${s.worldTitles} title${s.worldTitles !== 1 ? "s" : ""}, and ${s.olympicMedals} Olympic medal${s.olympicMedals !== 1 ? "s" : ""}.`,
    });
    res.json({ ok: true });
    return;
  }

  // No active team — still clear the session so a stale activeCareerSaveId
  // (e.g. left over from a resign) doesn't linger past "end".
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, activeCareerSaveId: __, careerSessionRestored: ___, ...rest } = session;
      await updateSession(sid, { ...rest, careerSessionRestored: true });
    }
  }

  res.json({ ok: true });
});

// POST /careers/quit — clear session without writing to Hall of Fame
router.post("/careers/quit", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Mark the career save as retired
  const teamId = req.activeTeamId;
  if (teamId) {
    await db
      .update(careerSavesTable)
      .set({ retiredAt: new Date() })
      .where(and(eq(careerSavesTable.teamId, teamId), eq(careerSavesTable.userId, req.user.id)));
  }

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) {
      const { activeTeamId: _, activeCareerSaveId: __, careerSessionRestored: ___, ...rest } = session;
      await updateSession(sid, { ...rest, careerSessionRestored: true });
    }
  }
  res.json({ ok: true });
});

// POST /careers/:id/load — activate a career save for this session
router.post("/careers/:id/load", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(and(
      eq(careerSavesTable.id,     id),
      eq(careerSavesTable.userId, req.user.id),
    ));

  if (!save)        { res.status(404).json({ error: "Not found" }); return; }
  if (!save.teamId) { res.status(400).json({ error: "Career has no team" }); return; }

  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session) await updateSession(sid, { ...session, activeTeamId: save.teamId, activeCareerSaveId: save.id });
  }

  await db
    .update(careerSavesTable)
    .set({ lastPlayedAt: new Date() })
    .where(eq(careerSavesTable.id, id));

  res.json({ ok: true, careerSaveId: save.id, teamId: save.teamId });
});

// DELETE /careers/:id
// Deletes only save-slot-owned data. Teams, players, and all other world
// data are global and must NOT be deleted.
router.delete("/careers/:id", async (req, res) => {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized: no authenticated user" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid save slot id: must be a number" });
    return;
  }

  const [save] = await db
    .select()
    .from(careerSavesTable)
    .where(and(
      eq(careerSavesTable.id,     id),
      eq(careerSavesTable.userId, req.user.id),
    ));

  if (!save) {
    res.status(404).json({ error: `Save slot ${id} not found or does not belong to this user` });
    return;
  }

  req.log.info({ saveId: id, userId: req.user.id, slotNumber: save.slotNumber }, "DELETE /careers/:id — starting");

  try {
    // Teams, players, facilities, matches, finances, etc. are GLOBAL world
    // data and must not be touched — deleteCareerSave only removes rows that
    // reference this career save, then the career_saves row itself.
    deleteCareerSave(id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err, saveId: id, userId: req.user.id }, "DELETE /careers/:id failed");
    res.status(500).json({ error: `Database error while deleting save slot: ${message}` });
    return;
  }

  req.log.info({ saveId: id }, "DELETE /careers/:id — success");

  // Clear session if this save's team was the active one. R-20: this used to
  // clear activeTeamId only — activeCareerSaveId was left pointing at the
  // now-deleted row, and careerSessionRestored stayed true, so nothing would
  // have restored a different career either. Cleared the same way
  // /careers/end and /careers/quit do it, so the player lands back on
  // career-management to choose explicitly rather than any code guessing.
  const sid = getSessionId(req);
  if (sid) {
    const session = await getSession(sid);
    if (session?.activeTeamId === save.teamId) {
      const { activeTeamId: _, activeCareerSaveId: __, careerSessionRestored: ___, ...rest } = session;
      await updateSession(sid, { ...rest, careerSessionRestored: true });
    }
  }

  res.json({ ok: true });
});

// ── Shared constant: release clause ─────────────────────────────────────────────

// Quoted to the player before they commit — GET /careers/contract's
// `releaseFee` and pages/manager-contract.tsx's confirm button both show this
// exact figure. Keep the two in sync, or the game charges a price it did not
// quote.
const BREAK_CONTRACT_FEE = 25_000;

// ── GET /careers/history — career history entries for this user ────────────────

router.get("/careers/history", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const entries = await db
    .select()
    .from(careerHistoryEntriesTable)
    .where(eq(careerHistoryEntriesTable.userId, req.user.id))
    .orderBy(desc(careerHistoryEntriesTable.occurredAt));

  res.json(entries.map(e => ({
    id:          e.id,
    type:        e.type,
    clubName:    e.clubName,
    season:      e.season ?? null,
    description: e.description,
    occurredAt:  e.occurredAt.toISOString(),
  })));
});

// ── Resign / Break Contract — R-60: both END the career ───────────────────────
//
// These used to set the save's team_id to null and leave the manager
// "unemployed", waiting for a Job Market that was invented (R-43 deleted it).
// A save with no club has nowhere to go and nothing to play. Rob's rule for this
// release: resigning and breaking a contract both end the career — the same
// endCareer a sacking goes through (Hall of Fame, history, retired, session
// cleared), each with its own reason. The save keeps its club: no save is ever
// left with none (utils/clublessCareers.ts finishes any an older build left).

async function activeSaveFor(teamId: number, userId: string) {
  const [save] = await db.select().from(careerSavesTable).where(and(
    eq(careerSavesTable.teamId, teamId),
    eq(careerSavesTable.userId, userId),
    isNull(careerSavesTable.retiredAt),
  ));
  return save ?? null;
}

router.post("/careers/resign", async (req, res) => {
  if (!req.user?.id)   { res.status(401).json({ error: "Unauthorized" }); return; }

  const teamId = req.activeTeamId;
  if (!teamId) { res.status(400).json({ error: "No active career to resign from" }); return; }
  if (!(await activeSaveFor(teamId, req.user.id))) { res.status(404).json({ error: "Career save not found" }); return; }

  const summary = await endCareer(req, teamId, req.user.id, {
    type: "resignation",
    description: (s) =>
      `${s.managerName} resigned from ${s.clubName}. The career has ended: there is no job market yet.`,
  });

  res.json({ ok: true, clubName: summary.clubName, careerEnded: true });
});

router.post("/careers/break-contract", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const teamId = req.activeTeamId;
  if (!teamId) { res.status(400).json({ error: "No active career" }); return; }

  const [save, [team]] = await Promise.all([
    activeSaveFor(teamId, req.user.id),
    db.select().from(teamsTable).where(eq(teamsTable.id, teamId)),
  ]);
  if (!save) { res.status(404).json({ error: "Career save not found" }); return; }
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  // The release clause is still paid, from the club's budget, before the career ends.
  const newBudget = team.budget - BREAK_CONTRACT_FEE;
  await db.update(teamsTable).set({ budget: newBudget }).where(eq(teamsTable.id, teamId));

  const summary = await endCareer(req, teamId, req.user.id, {
    type: "contract_break",
    description: (s) =>
      `${s.managerName} broke the contract with ${s.clubName}, paying the $${BREAK_CONTRACT_FEE.toLocaleString("en-US")} release clause. The career has ended: there is no job market yet.`,
  });

  res.json({ ok: true, feePaid: BREAK_CONTRACT_FEE, newBudget: newBudget.toFixed(2), clubName: summary.clubName, careerEnded: true });
});

export default router;
