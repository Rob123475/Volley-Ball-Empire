import { Router } from "express";
import { db } from "@workspace/db";
import { locationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

router.get("/locations/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const loc = await db.query.locationsTable.findFirst({ where: eq(locationsTable.id, id) });
  if (!loc) { res.status(404).json({ error: "Location not found" }); return; }
  res.json(serializeLocation(loc));
});

export default router;
