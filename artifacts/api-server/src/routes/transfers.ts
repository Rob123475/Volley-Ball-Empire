/**
 * 1.1.1, Parts 2 and 3 (Rob, 16 Oct): the player's club's transfers.
 *
 *   GET  /transfers                 bids for his players waiting for his answer,
 *                                   players he has bought ahead (arriving), his
 *                                   players sold ahead (leaving), and the rest
 *   POST /transfers/:id/counter     his one chance to keep her: { wage, length, perks }
 *   POST /transfers/:id/let-go      she goes (the fee is paid today)
 *
 * The rules are utils/transfers.ts; a bid itself is made through the Player
 * Market's Buy (POST /contracts).
 */
import { Router } from "express";
import { db, transferDealsTable, perksText, perksMonthly, COUNTER_OFFER, type TransferDeal } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getActiveTeam } from "../lib/getActiveTeam.js";
import { loadPlayer, requireCareerSaveId, withCareerStateTx } from "../lib/playerDto.js";
import { getGameDate } from "../utils/gameDate.js";
import { myTransfersTx, answerWithCounterTx, agreeTx } from "../utils/transfers.js";
import { readContractLength } from "../utils/contractTerms.js";
import { committedWageBill, wageCapRefusal } from "../utils/salaryCap.js";
import { checkSpendingAllowed } from "../utils/board-confidence.js";
import { transferWindowFor } from "../utils/transferWindow.js";

const router = Router();

router.get("/transfers", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const cid = requireCareerSaveId(req.activeCareerSaveId);
  const today = await getGameDate(team.id);
  const year = Number(today.slice(0, 4));
  res.json({ today, window: transferWindowFor(year), answerDays: COUNTER_OFFER.answerDays, ...withCareerStateTx((w) => myTransfersTx(w.tx, cid, team.id)) });
});

/** A bid for one of his players, still waiting for his answer. */
type Offer = { deal: TransferDeal; cid: number } | { error: string; status: number };
function myOffer(careerSaveId: number | undefined, dealId: number, teamId: number): Offer {
  const cid = requireCareerSaveId(careerSaveId);
  const deal = db.select().from(transferDealsTable).where(eq(transferDealsTable.id, dealId)).get();
  if (!deal || deal.careerSaveId !== cid || deal.fromTeamId !== teamId) return { error: "No such bid for your players.", status: 404 };
  if (deal.status !== "offered") return { error: "That bid has already been answered.", status: 409 };
  return { deal, cid };
}

router.post("/transfers/:id/counter", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const found = myOffer(req.activeCareerSaveId, Number(req.params.id), team.id);
  if ("error" in found) { res.status(found.status).json({ error: found.error }); return; }
  const { deal, cid } = found;
  const wanted = readContractLength(req.body);
  if ("error" in wanted) { res.status(400).json({ error: wanted.error }); return; }
  const wage = Number(req.body?.wage);
  if (!Number.isFinite(wage) || wage <= 0) { res.status(400).json({ error: "wage must be a positive number" }); return; }
  const perks = perksText(Array.isArray(req.body?.perks) ? req.body.perks : String(req.body?.perks ?? "").split(","));
  const her = await loadPlayer(cid, deal.playerId);
  if (!her) { res.status(404).json({ error: "No such player." }); return; }
  // Keeping her costs what the counter adds: it is new spending and must fit under the cap.
  const adding = wage + perksMonthly(perks) - (Number(her.salary) + perksMonthly(her.perks));
  if (adding > 0) {
    const frozen = await checkSpendingAllowed(cid);
    if (frozen) { res.status(403).json({ error: frozen }); return; }
    const over = wageCapRefusal(committedWageBill(cid, { teamId: team.id }), adding);
    if (over) { res.status(422).json({ error: over, wageCap: true }); return; }
  }
  const today = await getGameDate(team.id);
  const outcome = withCareerStateTx((w) => answerWithCounterTx(w, cid, deal.id, { wage, length: wanted.length, perks }, today));
  res.json({ outcome, deal: db.select().from(transferDealsTable).where(eq(transferDealsTable.id, deal.id)).get() });
});

router.post("/transfers/:id/let-go", async (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const team = await getActiveTeam(req);
  if (!team) { res.status(404).json({ error: "No team" }); return; }
  const found = myOffer(req.activeCareerSaveId, Number(req.params.id), team.id);
  if ("error" in found) { res.status(found.status).json({ error: found.error }); return; }
  const today = await getGameDate(team.id);
  const outcome = withCareerStateTx((w) => agreeTx(w, found.cid, found.deal.id, today));
  res.json({ outcome, deal: db.select().from(transferDealsTable).where(eq(transferDealsTable.id, found.deal.id)).get() });
});

export default router;
