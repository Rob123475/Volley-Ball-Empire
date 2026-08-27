import { Router } from "express";
import { db } from "@workspace/db";
import { locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { WORLD_TOUR } from "../data/worldTour.js";

const router = Router();

const serializeLocation = (loc: any) => ({
  ...loc,
  latitude: loc.latitude ? Number(loc.latitude) : null,
  longitude: loc.longitude ? Number(loc.longitude) : null,
  weatherPatterns: Array.isArray(loc.weatherPatterns) ? loc.weatherPatterns : [],
});

router.get("/locations", async (req, res) => {
  const locs = await db.select().from(locationsTable).orderBy(locationsTable.id);
  res.json(locs.map(serializeLocation));
});

/**
 * GET /locations/world-summary — world-size figures and the prize ladder.
 *
 * Public (like /locations) because the title screen renders before a career
 * exists. Everything here is COUNTED or DERIVED, never typed in: the splash
 * copy used to hardcode "11 cities across 9 countries" and a "$50k Grand
 * Final", all seed-era numbers that nothing would have caught going stale.
 *
 * Declared above /locations/:id so "world-summary" is not parsed as an id.
 */
router.get("/locations/world-summary", async (_req, res) => {
  const locs = await db.select().from(locationsTable);

  const prizesByTier = new Map<string, number[]>();
  for (const e of WORLD_TOUR) {
    if (!prizesByTier.has(e.tier)) prizesByTier.set(e.tier, []);
    prizesByTier.get(e.tier)!.push(e.prize);
  }

  const prizeLadder = [...prizesByTier.entries()].map(([tier, prizes]) => ({
    tier,
    events:    prizes.length,
    minPrize:  Math.min(...prizes),
    maxPrize:  Math.max(...prizes),
  }));

  res.json({
    venues:      locs.length,
    cities:      new Set(locs.map(l => l.city).filter(Boolean)).size,
    countries:   new Set(locs.map(l => l.country).filter(Boolean)).size,
    totalEvents: WORLD_TOUR.length,
    topPrize:    Math.max(...WORLD_TOUR.map(e => e.prize)),
    prizeLadder,
  });
});

router.get("/locations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const loc = await db.query.locationsTable.findFirst({ where: eq(locationsTable.id, id) });
  if (!loc) { res.status(404).json({ error: "Location not found" }); return; }
  res.json(serializeLocation(loc));
});

export default router;
