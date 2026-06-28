import { Router } from "express";
import { db } from "@workspace/db";
import {
  poachingOffersTable,
  careerSavesTable,
  teamsTable,
  careerHistoryEntriesTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getSession, getSessionId, updateSession } from "../lib/auth.js";

const router = Router();

// ── Club pool that can issue poaching offers ───────────────────────────────────

const POACHING_POOL = [
  { clubName: "Rio Praia SC",       continent: "South America", country: "Brazil",       logoColor: "#10b981", reputation: 88 },
  { clubName: "Paris Sablé FC",     continent: "Europe",        country: "France",       logoColor: "#ec4899", reputation: 82 },
  { clubName: "Barcelona Sand FC",  continent: "Europe",        country: "Spain",        logoColor: "#3b82f6", reputation: 84 },
  { clubName: "Sao Paulo Waves",    continent: "South America", country: "Brazil",       logoColor: "#a855f7", reputation: 76 },
  { clubName: "Dubai Falcons BC",   continent: "Asia",          country: "UAE",          logoColor: "#eab308", reputation: 74 },
  { clubName: "Miami Blazers",      continent: "North America", country: "USA",          logoColor: "#f59e0b", reputation: 78 },
  { clubName: "Shanghai Stormers",  continent: "Asia",          country: "China",        logoColor: "#ef4444", reputation: 72 },
  { clubName: "Sydney Surf FC",     continent: "Oceania",       country: "Australia",    logoColor: "#0ea5e9", reputation: 68 },
  { clubName: "Toronto Shoreline",  continent: "North America", country: "Canada",       logoColor: "#14b8a6", reputation: 62 },
  { clubName: "Athens Aegean BC",   continent: "Europe",        country: "Greece",       logoColor: "#8b5cf6", reputation: 58 },
  { clubName: "Cape Town Swells",   continent: "Africa",        country: "South Africa", logoColor: "#f97316", reputation: 54 },
  { clubName: "Hokkaido Snow Birds",continent: "Asia",          country: "Japan",        logoColor: "#06b6d4", reputation: 56 },
];

function salaryForReputation(rep: number): number {
  if (rep >= 80) return 22_000 + Math.round(Math.random() * 10_000);
  if (rep >= 65) return 14_000 + Math.round(Math.random() * 8_000);
  if (rep >= 50) return 9_000  + Math.round(Math.random() * 5_000);
  return 6_000 + Math.round(Math.random() * 3_000);
}

function budgetForReputation(rep: number): number {
  if (rep >= 80) return 450_000 + Math.round(Math.random() * 250_000);
  if (rep >= 65) return 250_000 + Math.round(Math.random() * 150_000);
  if (rep >= 50) return 120_000 + Math.round(Math.random() * 100_000);
  return 60_000 + Math.round(Math.random() * 60_000);
}

function expectationForReputation(rep: number): string {
  if (rep >= 85) return "Win the World Tour";
  if (rep >= 75) return "Reach the Grand Final";
  if (rep >= 60) return "Top 8 finish";
  if (rep >= 50) return "Qualify for playoffs";
  return "Establish top-half standing";
}

// ── GET /poaching/offers ──────────────────────────────────────────────────────

router.get("/poaching/offers", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const sid     = getSessionId(req);
  const session = sid ? await getSession(sid) : null;

  // Find active career save
  let save: typeof careerSavesTable.$inferSelect | undefined;
  if (session?.activeCareerSaveId) {
    const [found] = await db
      .select().from(careerSavesTable)
      .where(and(eq(careerSavesTable.id, session.activeCareerSaveId), eq(careerSavesTable.userId, req.user.id)));
    save = found;
  }
  if (!save) {
    const saves = await db
      .select().from(careerSavesTable)
      .where(eq(careerSavesTable.userId, req.user.id))
      .orderBy(desc(careerSavesTable.lastPlayedAt));
    save = saves[0];
  }
  if (!save) { res.json({ offers: [] }); return; }

  const managerReputation = save.managerReputation ?? 50;

  // Load existing pending offers for this save
  const pending = await db
    .select().from(poachingOffersTable)
    .where(and(
      eq(poachingOffersTable.careerSaveId, save.id),
      eq(poachingOffersTable.status, "pending"),
    ))
    .orderBy(desc(poachingOffersTable.createdAt));

  // ── Auto-generate if qualified and no pending offers ──────────────────────
  if (pending.length === 0 && managerReputation >= 50) {
    // Cooldown: don't generate if an offer (any status) was created within the last 4 hours
    const [mostRecent] = await db
      .select().from(poachingOffersTable)
      .where(eq(poachingOffersTable.careerSaveId, save.id))
      .orderBy(desc(poachingOffersTable.createdAt))
      .limit(1);

    const COOLDOWN_MS = 4 * 60 * 60 * 1000;
    const isCoolingDown = mostRecent && (Date.now() - new Date(mostRecent.createdAt).getTime() < COOLDOWN_MS);

    if (!isCoolingDown && Math.random() < 0.55) {
      // Pick a club with reputation in a sensible range of the manager
      const eligible = POACHING_POOL.filter(c =>
        c.clubName !== save!.clubName &&
        c.reputation >= managerReputation - 20 &&
        c.reputation <= managerReputation + 40,
      );

      if (eligible.length > 0) {
        const club          = eligible[Math.floor(Math.random() * eligible.length)];
        const contractLength = 1 + Math.floor(Math.random() * 3); // 1–3 seasons
        const salary         = salaryForReputation(club.reputation);
        const transferBudget = budgetForReputation(club.reputation);
        const expectation    = expectationForReputation(club.reputation);

        const [newOffer] = await db.insert(poachingOffersTable).values({
          userId:            req.user.id,
          careerSaveId:      save.id,
          clubName:          club.clubName,
          continent:         club.continent,
          country:           club.country,
          logoColor:         club.logoColor,
          salary,
          contractLength,
          transferBudget:    transferBudget.toFixed(2),
          seasonExpectation: expectation,
          clubReputation:    club.reputation,
          status:            "pending",
        }).returning();

        pending.push(newOffer);
      }
    }
  }

  res.json({
    offers: pending.map(o => ({
      id:                o.id,
      clubName:          o.clubName,
      continent:         o.continent,
      country:           o.country,
      logoColor:         o.logoColor,
      salary:            o.salary,
      contractLength:    o.contractLength,
      transferBudget:    o.transferBudget,
      seasonExpectation: o.seasonExpectation,
      clubReputation:    o.clubReputation,
      status:            o.status,
      createdAt:         o.createdAt.toISOString(),
    })),
  });
});

// ── POST /poaching/offers/:id/decline ────────────────────────────────────────

router.post("/poaching/offers/:id/decline", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [offer] = await db
    .select().from(poachingOffersTable)
    .where(and(eq(poachingOffersTable.id, id), eq(poachingOffersTable.userId, req.user.id)));

  if (!offer) { res.status(404).json({ error: "Offer not found" }); return; }
  if (offer.status !== "pending") { res.status(400).json({ error: "Offer already resolved" }); return; }

  await db.update(poachingOffersTable)
    .set({ status: "declined" })
    .where(eq(poachingOffersTable.id, id));

  res.json({ ok: true });
});

// ── POST /poaching/offers/:id/accept ─────────────────────────────────────────

router.post("/poaching/offers/:id/accept", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [offer] = await db
    .select().from(poachingOffersTable)
    .where(and(eq(poachingOffersTable.id, id), eq(poachingOffersTable.userId, req.user.id)));

  if (!offer) { res.status(404).json({ error: "Offer not found" }); return; }
  if (offer.status !== "pending") { res.status(400).json({ error: "Offer already resolved" }); return; }

  // Find the career save
  const [save] = await db
    .select().from(careerSavesTable)
    .where(and(eq(careerSavesTable.id, offer.careerSaveId), eq(careerSavesTable.userId, req.user.id)));

  if (!save) { res.status(404).json({ error: "Career save not found" }); return; }

  // Create a new team for the new club
  const [newTeam] = await db.insert(teamsTable).values({
    userId:     req.user.id,
    name:       offer.clubName,
    budget:     offer.transferBudget,
    reputation: offer.clubReputation,
    logoColor:  offer.logoColor,
  }).returning();

  // Update career save: new team, new club name, updated manager reputation
  await db.update(careerSavesTable)
    .set({
      teamId:            newTeam.id,
      clubName:          offer.clubName,
      managerReputation: offer.clubReputation,
      lastPlayedAt:      new Date(),
    })
    .where(eq(careerSavesTable.id, save.id));

  // Career history entry
  await db.insert(careerHistoryEntriesTable).values({
    userId:       req.user.id,
    careerSaveId: save.id,
    type:         "appointment",
    clubName:     offer.clubName,
    season:       save.season,
    description:  `Joined ${offer.clubName} as head coach following a poaching approach`,
  });

  // Mark offer accepted
  await db.update(poachingOffersTable)
    .set({ status: "accepted" })
    .where(eq(poachingOffersTable.id, id));

  // Activate in session
  const sid     = getSessionId(req);
  const session = sid ? await getSession(sid) : null;
  if (sid && session) {
    await updateSession(sid, {
      ...session,
      activeTeamId:       newTeam.id,
      activeCareerSaveId: save.id,
    });
  }

  res.json({ ok: true, clubName: offer.clubName, teamId: newTeam.id, season: save.season });
});

export default router;
