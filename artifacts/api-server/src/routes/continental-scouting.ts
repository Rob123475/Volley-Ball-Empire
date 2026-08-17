import { Router } from "express";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { db } from "@workspace/db";
import {
  teamsTable,
  financeTransactionsTable,
  youthProspectsTable,
  staffTable,
  continentalScoutingMissionsTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { generateContinentalProspects } from "../utils/prospect-generator";

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
    specialties:  ["Server", "Defender"],
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

// Real-time days per in-game month. Keeping these short so gameplay stays
// responsive; the display always shows game months, never real-day counts.
const MISSION_DURATIONS_DAYS: Record<number, number> = { 1: 3, 3: 7, 6: 14 };


// ── Helper: auto-complete missions whose endDate has passed ───────────────

export async function autoCompleteContinentalMissions(teamId: number): Promise<void> {
  const now = new Date();
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

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + (MISSION_DURATIONS_DAYS[durationMonths as keyof typeof MISSION_DURATIONS_DAYS] ?? 1));

  const [mission] = await db
    .insert(continentalScoutingMissionsTable)
    .values({
      teamId:         team.id,
      region,
      status:         "active",
      durationMonths,
      endDate,
      assignedStaffId: staffId ?? null,
      cost,
    })
    .returning();

  await db.update(teamsTable)
    .set({ budget: budget - cost })
    .where(eq(teamsTable.id, team.id));

  const today = new Date().toISOString().split("T")[0]!;
  await db.insert(financeTransactionsTable).values({
    teamId:      team.id,
    type:        "expense",
    amount:      -cost,
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

  const now = new Date();
  if (mission.status === "active" && new Date(mission.endDate) > now) {
    const remaining = Math.ceil((new Date(mission.endDate).getTime() - now.getTime()) / (1000 * 60 * 60));
    res.status(422).json({ error: `Mission still in progress. ${remaining}h remaining.` });
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

  const count = await generateContinentalProspects({
    teamId:        team.id,
    region:        mission.region,
    missionId,
    scoutingRating,
    scoutName,
    durationMonths: mission.durationMonths,
  });

  await db
    .update(continentalScoutingMissionsTable)
    .set({ status: "collected", prospectsFound: count })
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

  const past = new Date(Date.now() - 1000);
  await db
    .update(continentalScoutingMissionsTable)
    .set({ status: "completed", endDate: past })
    .where(eq(continentalScoutingMissionsTable.id, missionId));

  res.json({ ok: true, message: "Mission force-completed" });
});

export default router;
