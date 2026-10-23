/**
 * 1.1.3 (Rob, 23 Oct; brief A5): the medal ceremonies (utils/ceremonies.ts).
 *
 *   GET  /ceremonies/pending               the ceremony waiting (the Dashboard opens it), or null;
 *                                          a World Finals one is queued here once its final is decided
 *   POST /ceremonies/:event/:year/seen     watched or skipped: it doesn't open again
 *   GET  /unity/ceremony-state?careerSaveId=&event=&year=
 *                                          the podium for the court in ceremony mode: the 6 players,
 *                                          places, kits, skin tones, nations (flags) and the banner.
 *                                          No session (the court's iframe has none), as /unity/match-state.
 */
import { Router } from "express";
import { db, careerSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { careerGameDateTx } from "../utils/gameDate.js";
import { queueCeremoniesTx, pendingCeremonyTx, markCeremonySeenTx, ceremonyStateTx, latestCeremonyYearTx, type CeremonyEvent } from "../utils/ceremonies.js";

const router = Router();
const EVENTS: readonly CeremonyEvent[] = ["world_finals", "nations_cup"];

router.get("/ceremonies/pending", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.activeCareerSaveId == null) { res.json({ pending: null }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const pending = withCareerStateTx((w) => {
    const today = careerGameDateTx(w.tx, cid);
    queueCeremoniesTx(w.tx, cid, Number(today.slice(0, 4)), today);
    return pendingCeremonyTx(w.tx, cid);
  });
  res.json({ pending: pending ? { event: pending.event, seasonYear: pending.seasonYear, readyOn: pending.readyOn, careerSaveId: cid } : null });
});

router.post("/ceremonies/:event/:year/seen", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const ok = withCareerStateTx((w) => markCeremonySeenTx(w.tx, cid, String(req.params.event), Number(req.params.year), careerGameDateTx(w.tx, cid)));
  res.json({ ok });
});

router.get("/unity/ceremony-state", (req, res) => {
  const cid = Number(req.query.careerSaveId);
  const event = String(req.query.event ?? "") as CeremonyEvent;
  if (!Number.isInteger(cid) || cid <= 0 || !EVENTS.includes(event)) {
    res.status(400).json({ error: "careerSaveId and event (world_finals or nations_cup) are required" });
    return;
  }
  if (!db.select({ id: careerSavesTable.id }).from(careerSavesTable).where(eq(careerSavesTable.id, cid)).get()) { res.status(404).json({ error: "Career not found" }); return; }
  const state = withCareerStateTx((w) => {
    const year = req.query.year != null ? Number(req.query.year) : latestCeremonyYearTx(w.tx, cid, event);
    return year == null ? null : ceremonyStateTx(w.tx, cid, event, year);
  });
  if (!state) { res.status(404).json({ error: "No ceremony for that event and year yet" }); return; }
  res.json(state);
});

export default router;
