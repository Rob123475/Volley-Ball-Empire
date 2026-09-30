import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  financeTransactionsTable,
  youthProspectsTable,
  staffTable,
  continentalScoutingMissionsTable,
  facilitiesTable,
  normaliseRole,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { generateContinentalProspects } from "../utils/prospect-generator";
import { blankReport } from "../utils/missionFinds.js";
import { loadStaff, requireCareerSaveId } from "../lib/playerDto.js";
import { getGameDate } from "../utils/gameDate.js";

const router = Router();

// ── Region definitions (static) ───────────────────────────────────────────

const REGIONS = [
  {
    id:           "Europe",
    name:         "Europe",
    emoji:        "🌍",
    specialties:  ["All-Rounder", "Setter"],
    description:  "Technical excellence and tactical sophistication. Produces disciplined, well-rounded talent.",
    talentLevel:  "Elite",
    talentColor:  "gold",
  },
  {
    id:           "Asia",
    name:         "Asia",
    emoji:        "🌏",
    specialties:  ["Setter", "Defender"],   // item 18: "Server" is not a position
    description:  "Disciplined technique and serve precision. Known for methodical, consistent players.",
    talentLevel:  "High",
    talentColor:  "orange",
  },
  {
    id:           "Africa",
    name:         "Africa",
    emoji:        "🌍",
    specialties:  ["Blocker", "Power"],
    description:  "Raw athleticism and explosive physicality. Uncovered gems with high physical ceilings.",
    talentLevel:  "High",
    talentColor:  "orange",
  },
  {
    id:           "North America",
    name:         "North America",
    emoji:        "🌎",
    specialties:  ["All-Rounder", "Spiker"],
    description:  "Athletic versatility and competitive drive. Strong overall players with high work rates.",
    talentLevel:  "High",
    talentColor:  "orange",
  },
  {
    id:           "South America",
    name:         "South America",
    emoji:        "🌎",
    specialties:  ["Defender", "Spiker"],
    description:  "Natural creativity and beach volleyball heritage. Fluid, instinctive talent.",
    talentLevel:  "Elite",
    talentColor:  "gold",
  },
  {
    id:           "Oceania",
    name:         "Oceania",
    emoji:        "🌏",
    specialties:  ["Speed", "Stamina"],
    description:  "Beach-hardened endurance and conditions expertise. Resilient, conditions-tested players.",
    talentLevel:  "Average",
    talentColor:  "blue",
  },
] as const;

const MISSION_COSTS: Record<number, number> = { 1: 20000, 3: 45000, 6: 75000 };

// Unity brief item 18 (Rob, 29 Sep): a "1-month" mission ran 3 REAL days (3
// months 7, 6 months 14) on the PC's clock, so the page could only say "Advance
// seasons to complete". A mission now runs its months on the GAME calendar: it
// starts on the game date it is sent and completes that many months later, and
// the page says on which date.
const DAY_MS = 86_400_000;
/** A game date (YYYY-MM-DD) as the timestamp the mission columns store. */
const gameDay = (date: string) => new Date(`${date}T00:00:00Z`);
const isoDay = (d: Date) => new Date(d).toISOString().slice(0, 10);
function addMonths(date: string, months: number): string {
  const d = gameDay(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoDay(d);
}
/** Missions sent before this rule ran on real days (at most 14); none sent since is shorter than a month. */
const isRealTimeMission = (m: { startDate: Date; endDate: Date }) =>
  new Date(m.endDate).getTime() - new Date(m.startDate).getTime() <= 14.5 * DAY_MS;


// ── Helper: auto-complete missions whose endDate has passed ───────────────

export async function autoCompleteContinentalMissions(teamId: number): Promise<void> {
  const today = await getGameDate(teamId);
  const now = gameDay(today);
  const active = await db
    .select()
    .from(continentalScoutingMissionsTable)
    .where(
      and(
        eq(continentalScoutingMissionsTable.teamId, teamId),
        eq(continentalScoutingMissionsTable.status, "active"),
      ),
    );

  for (const mission of active) {
    // Item 18: a mission sent under the old real-time rule keeps the real days
    // it had left, as game days from today, and runs on the game calendar.
    if (isRealTimeMission(mission)) {
      const total = Math.round((new Date(mission.endDate).getTime() - new Date(mission.startDate).getTime()) / DAY_MS);
      const left = Math.max(0, Math.ceil((new Date(mission.endDate).getTime() - Date.now()) / DAY_MS));
      const endDate = new Date(now.getTime() + left * DAY_MS);
      const startDate = new Date(endDate.getTime() - Math.max(total, 1) * DAY_MS);
      await db.update(continentalScoutingMissionsTable)
        .set({ startDate, endDate })
        .where(eq(continentalScoutingMissionsTable.id, mission.id));
      mission.endDate = endDate;
    }
    if (new Date(mission.endDate) <= now) {
      await db
        .update(continentalScoutingMissionsTable)
        .set({ status: "completed" })
        .where(eq(continentalScoutingMissionsTable.id, mission.id));
    }
  }
}

// ── GET /continental-scouting/regions ─────────────────────────────────────

router.get("/continental-scouting/regions", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  await autoCompleteContinentalMissions(team.id);
  const today = await getGameDate(team.id);

  const activeMissions = await db
    .select()
    .from(continentalScoutingMissionsTable)
    .where(
      and(
        eq(continentalScoutingMissionsTable.teamId, team.id),
        inArray(continentalScoutingMissionsTable.status, ["active", "completed"]),
      ),
    );

  const missionByRegion: Record<string, typeof activeMissions[0] | undefined> = {};
  for (const m of activeMissions) {
    const existing = missionByRegion[m.region];
    if (!existing || new Date(m.createdAt) > new Date(existing.createdAt)) {
      missionByRegion[m.region] = m;
    }
  }

  const result = REGIONS.map((r) => {
    const m = missionByRegion[r.id];
    return {
      ...r,
      costs:         MISSION_COSTS,
      activeMission: m
        ? {
            id:             m.id,
            status:         m.status,
            durationMonths: m.durationMonths,
            startDate:      m.startDate,
            endDate:        m.endDate,
            // Item 18: when it completes, on the game calendar.
            completesOn:    isoDay(m.endDate),
            daysLeft:       Math.max(0, Math.round((new Date(m.endDate).getTime() - gameDay(today).getTime()) / DAY_MS)),
            progressPct:    Math.min(100, Math.max(0, Math.round(
              ((gameDay(today).getTime() - new Date(m.startDate).getTime()) / Math.max(DAY_MS, new Date(m.endDate).getTime() - new Date(m.startDate).getTime())) * 100))),
            assignedStaffId: m.assignedStaffId,
            cost:           Number(m.cost),
            prospectsFound: m.prospectsFound,
          }
        : null,
    };
  });

  res.json(result);
});

// ── POST /continental-scouting/start ──────────────────────────────────────

router.post("/continental-scouting/start", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const { region, durationMonths, staffId } = req.body as {
    region: string;
    durationMonths: number;
    staffId?: number;
  };

  if (!REGIONS.find((r) => r.id === region)) {
    res.status(400).json({ error: `Invalid region. Must be one of: ${REGIONS.map((r) => r.id).join(", ")}` });
    return;
  }
  if (![1, 3, 6].includes(durationMonths)) {
    res.status(400).json({ error: "durationMonths must be 1, 3, or 6" });
    return;
  }

  await autoCompleteContinentalMissions(team.id);

  // Overnight 30 Sep, item 13: a mission is a Scout's job: one of this club's
  // Scouts must be sent (a mission used to go with no one, at rating 50).
  const scouts = (await loadStaff(requireCareerSaveId(req.activeCareerSaveId), { teamId: team.id }))
    .filter((s) => normaliseRole(s.role) === "scout");
  if (!scouts.some((s) => s.id === Number(staffId))) {
    res.status(400).json({
      error: scouts.length === 0
        ? "You have no Scout. Hire a Scout on the Staff Market to send on a mission."
        : "Choose which of your Scouts goes on the mission.",
      noScout: scouts.length === 0,
    });
    return;
  }

  const existing = await db
    .select()
    .from(continentalScoutingMissionsTable)
    .where(
      and(
        eq(continentalScoutingMissionsTable.teamId, team.id),
        eq(continentalScoutingMissionsTable.region, region),
        inArray(continentalScoutingMissionsTable.status, ["active", "completed"]),
      ),
    );

  if (existing.length > 0) {
    const s = existing[0]!.status;
    res.status(422).json({
      error: s === "completed"
        ? `Your ${region} mission has prospects ready to collect. Collect them before sending another.`
        : `A scouting mission is already active in ${region}.`,
    });
    return;
  }

  const cost = MISSION_COSTS[durationMonths as keyof typeof MISSION_COSTS]!;
  const budget = Number(team.budget ?? 0);
  if (budget < cost) {
    res.status(422).json({ error: `Insufficient funds. This mission costs $${cost.toLocaleString()}.` });
    return;
  }

  // Item 18: the mission's months, on the game calendar.
  const sentOn = await getGameDate(team.id);
  const startDate = gameDay(sentOn);
  const endDate = gameDay(addMonths(sentOn, durationMonths));

  const [mission] = await db
    .insert(continentalScoutingMissionsTable)
    .values({
      teamId:         team.id,
      region,
      status:         "active",
      durationMonths,
      startDate,
      endDate,
      assignedStaffId: staffId ?? null,
      cost,
    })
    .returning();

  await db.update(teamsTable)
    .set({ budget: budget - cost })
    .where(eq(teamsTable.id, team.id));

  const today = await getGameDate(team.id);
  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      cost,
    description: `Continental scouting — ${region} (${durationMonths} month${durationMonths > 1 ? "s" : ""})`,
    category:    "youth_academy",
    date:        today,
  });

  res.status(201).json(mission);
});

// ── POST /continental-scouting/missions/:id/collect ───────────────────────

router.post("/continental-scouting/missions/:id/collect", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const missionId = parseInt(req.params.id);
  if (isNaN(missionId)) { res.status(400).json({ error: "Invalid mission id" }); return; }

  const [mission] = await db
    .select()
    .from(continentalScoutingMissionsTable)
    .where(
      and(
        eq(continentalScoutingMissionsTable.id, missionId),
        eq(continentalScoutingMissionsTable.teamId, team.id),
      ),
    );

  if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
  if (mission.status === "collected") {
    res.status(422).json({ error: "Prospects from this mission have already been collected." });
    return;
  }
  if (mission.status === "cancelled") {
    res.status(422).json({ error: "This mission was cancelled." });
    return;
  }

  const now = gameDay(await getGameDate(team.id));
  if (mission.status === "active" && new Date(mission.endDate) > now) {
    const remaining = Math.ceil((new Date(mission.endDate).getTime() - now.getTime()) / DAY_MS);
    res.status(422).json({ error: `Mission still in progress: it completes on ${isoDay(mission.endDate)}, ${remaining} game day${remaining === 1 ? "" : "s"} from now.` });
    return;
  }

  let scoutingRating = 50;
  let scoutName: string | null = null;

  if (mission.assignedStaffId) {
    const [scout] = await db
      .select()
      .from(staffTable)
      .where(eq(staffTable.id, mission.assignedStaffId));
    if (scout) {
      scoutingRating = scout.scoutingRating;
      scoutName = scout.name;
    }
  }

  // Item 13: the Scouting Department's level shifts the odds (it did nothing before).
  const department = await db.query.facilitiesTable.findFirst({
    where: and(eq(facilitiesTable.teamId, team.id), eq(facilitiesTable.type, "scouting_department")),
  });
  const departmentLevel = department?.level ?? 1;
  const { count, watched } = await generateContinentalProspects({
    teamId:        team.id,
    region:        mission.region,
    missionId,
    scoutingRating,
    scoutName,
    durationMonths: mission.durationMonths,
    departmentLevel,
  });
  // A blank explains itself; a find says how many she recommends of how many.
  const who = scoutName ?? "Your scout";
  const report = count === 0
    ? blankReport(who, watched, mission.region)
    : `${who} watched ${watched} players in ${mission.region} and recommends ${count}.`;

  await db
    .update(continentalScoutingMissionsTable)
    .set({ status: "collected", prospectsFound: count, report })
    .where(eq(continentalScoutingMissionsTable.id, missionId));

  const prospects = await db
    .select()
    .from(youthProspectsTable)
    .where(
      and(
        eq(youthProspectsTable.teamId, team.id),
        eq(youthProspectsTable.continentalMissionId, missionId),
      ),
    );

  res.json({
    prospectsFound: count,
    report,
    departmentLevel,
    scoutName,
    scoutingRating,
    prospects: prospects.map((p) => ({
      id:                   p.id,
      name:                 p.name,
      age:                  p.age,
      continent:            p.continent,
      currentRating:        p.currentRating,
      potentialStars:       p.potentialStars,
      speciality:           p.speciality,
      signingCost:          p.signingCost,
      status:               p.status,
      scoutingReportText:   p.scoutingReportText,
      discoveredBy:         p.discoveredBy,
      scoutedPotentialLabel: p.scoutedPotentialLabel,
      continentalMissionId: p.continentalMissionId,
    })),
  });
});

// ── POST /continental-scouting/missions/:id/cancel ────────────────────────

router.post("/continental-scouting/missions/:id/cancel", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const missionId = parseInt(req.params.id);
  if (isNaN(missionId)) { res.status(400).json({ error: "Invalid mission id" }); return; }

  const [mission] = await db
    .select()
    .from(continentalScoutingMissionsTable)
    .where(
      and(
        eq(continentalScoutingMissionsTable.id, missionId),
        eq(continentalScoutingMissionsTable.teamId, team.id),
      ),
    );

  if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
  if (mission.status !== "active") {
    res.status(422).json({ error: "Only active missions can be cancelled." });
    return;
  }

  const [updated] = await db
    .update(continentalScoutingMissionsTable)
    .set({ status: "cancelled" })
    .where(eq(continentalScoutingMissionsTable.id, missionId))
    .returning();

  res.json(updated);
});

// ── GET /continental-scouting/prospects ───────────────────────────────────

router.get("/continental-scouting/prospects", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const prospects = await db
    .select()
    .from(youthProspectsTable)
    .where(
      and(
        eq(youthProspectsTable.teamId, team.id),
        eq(youthProspectsTable.status, "pending"),
      ),
    );

  const continental = prospects.filter((p) => p.continentalMissionId != null);

  res.json(
    continental.map((p) => ({
      id:                   p.id,
      name:                 p.name,
      age:                  p.age,
      continent:            p.continent,
      currentRating:        p.currentRating,
      potentialStars:       p.potentialStars,
      speciality:           p.speciality,
      signingCost:          p.signingCost,
      status:               p.status,
      scoutingReportText:   p.scoutingReportText,
      discoveredBy:         p.discoveredBy,
      scoutedPotentialLabel: p.scoutedPotentialLabel,
      continentalMissionId: p.continentalMissionId,
    })),
  );
});

// ── POST /continental-scouting/missions/:id/dev-complete ──────────────────

router.post("/continental-scouting/missions/:id/dev-complete", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team found" }); return; }

  const missionId = parseInt(req.params.id);
  const [mission] = await db
    .select()
    .from(continentalScoutingMissionsTable)
    .where(
      and(
        eq(continentalScoutingMissionsTable.id, missionId),
        eq(continentalScoutingMissionsTable.teamId, team.id),
      ),
    );
  if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }

  const past = gameDay(await getGameDate(team.id));
  await db
    .update(continentalScoutingMissionsTable)
    .set({ status: "completed", endDate: past })
    .where(eq(continentalScoutingMissionsTable.id, missionId));

  res.json({ ok: true, message: "Mission force-completed" });
});

export default router;
