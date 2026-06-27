import { Router } from "express";
import { db } from "@workspace/db";
import { clubTemplatesTable } from "@workspace/db";
import { asc } from "drizzle-orm";

const router = Router();

// GET /club-templates — return all clubs ordered by continent then rating desc
router.get("/club-templates", async (req, res) => {
  if (!req.user?.id) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(clubTemplatesTable)
    .orderBy(asc(clubTemplatesTable.continent), asc(clubTemplatesTable.name));

  res.json({
    clubs: rows.map(c => ({
      id:             c.id,
      name:           c.name,
      continent:      c.continent,
      town:           c.town,
      rating:         c.rating,
      startingBudget: c.startingBudget,
      reputation:     c.reputation,
      primaryColor:   c.primaryColor,
      secondaryColor: c.secondaryColor,
    })),
  });
});

export default router;
