/**
 * 1.2 D4: the Store (Rob, 23 Nov). Built but closed: data/store-settings.json's "open" is false,
 * so GET /store says only that it is closed (the side menu shows no Store pill) and nothing can
 * be bought. Opening it later is flipping that switch.
 *
 * Its money is the profile's own wallet (utils/store.ts): it never reads or writes a career's.
 */
import { Router } from "express";
import { STORE_ITEMS, STORE_SETTINGS, storeOpen, walletFor, ownedBy, buy, wear } from "../utils/store.js";

const router = Router();

router.get("/store", (req, res) => {
  if (!storeOpen()) { res.json({ open: false }); return; }
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const wallet = walletFor(req.user.id);
  const owned = ownedBy(req.user.id);
  res.json({
    open: true,
    currency: STORE_SETTINGS.currency,
    balance: wallet.balance,
    items: STORE_ITEMS.map((i) => ({ id: i.id, name: i.name, slot: i.slot, price: i.price, picture: i.picture, colour: i.colour, lenses: i.lenses })),
    owned: owned.map((o) => ({ id: o.id, itemId: o.itemId, colour: o.colour, worn: o.worn })),
  });
});

router.post("/store/buy", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { itemId, colour } = (req.body ?? {}) as { itemId?: string; colour?: string };
  const r = buy(req.user.id, String(itemId ?? ""), colour);
  if (!r.ok) { res.status(r.status).json({ error: r.error }); return; }
  res.json({ balance: r.balance, owned: ownedBy(req.user.id).map((o) => ({ id: o.id, itemId: o.itemId, colour: o.colour, worn: o.worn })) });
});

router.post("/store/wear", (req, res) => {
  if (!storeOpen()) { res.status(403).json({ error: "The store is closed." }); return; }
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { ownedId, worn } = (req.body ?? {}) as { ownedId?: number; worn?: boolean };
  const r = wear(req.user.id, Number(ownedId), worn !== false);
  if (!r.ok) { res.status(r.status ?? 400).json({ error: r.error }); return; }
  res.json({ owned: ownedBy(req.user.id).map((o) => ({ id: o.id, itemId: o.itemId, colour: o.colour, worn: o.worn })) });
});

export default router;
