/**
 * 1.1.3 (Rob, 23 Oct; brief A4c): the national coach job and the National Team
 * page (utils/nationalCoach.ts; the numbers in lib/db/src/schema/national-coach.ts).
 *
 *   GET  /national-coach                        his job (nation, years left, pay, paid so far),
 *                                               the offers waiting, today's Nations Cup matches
 *                                               (the Dashboard's Watch buttons)
 *   POST /national-coach/offers/:id/accept      { years: 3 | 5 }
 *   POST /national-coach/offers/decline         every open offer
 *   GET  /national-team                         the National Team page (404 while he coaches none)
 *   POST /national-team/pair                    { pair: [{ kind, id }, { kind, id }] }
 *   POST /national-team/camp                    { camp: "training" | "recovery" }
 */
import { Router } from "express";
import { NATIONAL_COACH, NATIONAL_CAMP, db, careerSavesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { careerGameDateTx } from "../utils/gameDate.js";
import {
  activeNationalJobTx, openOffersTx, acceptNationalOfferTx, declineNationalOffersTx, nationalTeamViewTx,
  pickNationalPairTx, chooseNationalCampTx, nationalCoachEarnedTx, nextCupTx,
} from "../utils/nationalCoach.js";
import { nationsCupView } from "../utils/olympics.js";

const router = Router();

/** The career and its club (none while he looks for one), and the game's today. */
function context(req: { activeCareerSaveId?: number | null }) {
  const cid = requireCareerSaveId(req.activeCareerSaveId ?? undefined);
  const teamId = db.select({ t: careerSavesTable.teamId }).from(careerSavesTable).where(eq(careerSavesTable.id, cid)).get()?.t ?? null;
  const today = db.transaction((tx) => careerGameDateTx(tx, cid));
  return { cid, teamId, today };
}

router.get("/national-coach", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (req.activeCareerSaveId == null) { res.json({ job: null, offers: [], today: [] }); return; }
  const { cid, today } = context(req);
  const { job, offers, earned, next } = withCareerStateTx((w) => ({
    job: activeNationalJobTx(w.tx, cid), offers: openOffersTx(w.tx, cid), earned: nationalCoachEarnedTx(w.tx, cid), next: nextCupTx(w.tx, cid, today),
  }));
  const year = Number(today.slice(0, 4));
  const cup = nationsCupView(cid, year, today, job?.nation ?? null);
  const todays = cup.drawn ? cup.schedule.flatMap((d) => d.fixtures).filter((f) => f.scheduledOn === today) : [];
  res.json({
    today, job: job ? { ...job, daysLeft: Math.max(0, Math.round((Date.parse(job.endsOn) - Date.parse(today)) / 86_400_000)) } : null,
    offers, earned: Math.round(earned), contractYears: NATIONAL_COACH.contractYears,
    nextCup: { year: next.year, startsOn: next.days.group },
    todayCup: todays,
  });
});

router.post("/national-coach/offers/:id/accept", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { cid, today } = context(req);
  const r = withCareerStateTx((w) => acceptNationalOfferTx(w.tx, cid, Number(req.params.id), Number(req.body?.years), today));
  if (!r.ok) { res.status(400).json({ error: r.error }); return; }
  res.json(r);
});

router.post("/national-coach/offers/decline", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { cid, today } = context(req);
  res.json({ declined: withCareerStateTx((w) => declineNationalOffersTx(w.tx, cid, today)) });
});

router.get("/national-team", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { cid, teamId, today } = context(req);
  const view = withCareerStateTx((w) => nationalTeamViewTx(w.tx, cid, teamId, today));
  if (!view) { res.status(404).json({ error: "You don't coach a nation." }); return; }
  res.json({ today, ...view, camps: NATIONAL_CAMP });
});

router.post("/national-team/pair", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { cid, teamId, today } = context(req);
  const pair = Array.isArray(req.body?.pair) ? req.body.pair.map((p: { kind?: unknown; id?: unknown }) => ({ kind: String(p?.kind), id: Number(p?.id) })) : [];
  const r = withCareerStateTx((w) => pickNationalPairTx(w.tx, cid, teamId, today, pair));
  if (!r.ok) { res.status(400).json({ error: r.error }); return; }
  res.json(r);
});

router.post("/national-team/camp", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { cid, teamId, today } = context(req);
  const r = withCareerStateTx((w) => chooseNationalCampTx(w.tx, cid, teamId, today, String(req.body?.camp ?? "")));
  if (!r.ok) { res.status(400).json({ error: r.error }); return; }
  res.json(r);
});

export default router;
