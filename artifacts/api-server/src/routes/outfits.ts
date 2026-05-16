import { Router } from "express";
import { db } from "@workspace/db";
import { outfitsTable } from "@workspace/db";

const router = Router();

const serializeOutfit = (o: any) => ({ ...o, price: Number(o.price) });

router.get("/outfits", async (req, res) => {
  const outfits = await db.select().from(outfitsTable).orderBy(outfitsTable.id);
  res.json(outfits.map(serializeOutfit));
});

export default router;
