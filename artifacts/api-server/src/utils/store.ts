/**
 * 1.2 D4: the Store's wallet and items (Rob, 23 Nov).
 *
 * Separate from the career: everything here is keyed by the profile (users.id) and touches only
 * the store's own tables (store_wallets, store_owned). It never reads or writes a club's bank
 * balance or anything else in a career's finances.
 *
 * The wallet's numbers and the store's switch are in data/store-settings.json; the items are in
 * data/store-items.json (adding an item is a line there; see the status file for the steps).
 * Rob's four wallet hooks, for when online play arrives:
 *   1. a starting balance, paid when a profile's wallet is first opened (walletFor);
 *   2. money won for a win (walletResult(userId, true));
 *   3. money lost for a loss (walletResult(userId, false); never below zero);
 *   4. a steady income dribble, paid for every whole period since the last (walletFor pays it).
 */
import { db, storeWalletsTable, storeOwnedTable, type StoreWallet } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import settings from "../data/store-settings.json";
import itemsFile from "../data/store-items.json";

export type StoreSlot = "hat" | "sunglasses" | "shoes" | "bracelet" | "earrings" | "necklace" | "legpiece" | "print";
export type StoreItem = {
  id: string; name: string; slot: StoreSlot; price: number;
  /** What the court shows for it: a part of the players' model (IdaFaber's SK_BG_*), or a print's mask. */
  unity: string;
  picture: string;
  /** The colour it comes in ("#rrggbb"; a print has two, "#rrggbb,#rrggbb"). */
  colour: string;
};

export const STORE_SETTINGS = settings as {
  open: boolean; currency: string; startingBalance: number; winReward: number; lossPenalty: number;
  income: { amount: number; everyHours: number };
};
/**
 * Whether the store is open: the settings file's switch. Only the harness (dev routes, never in a
 * shipped build) can override it, to prove the store both ways without rebuilding.
 */
let openOverride: boolean | null = null;
export const storeOpen = () => openOverride ?? STORE_SETTINGS.open;
export const setStoreOpenOverride = (open: boolean | null) => { openOverride = open; };
export const STORE_ITEMS: readonly StoreItem[] = (itemsFile as { items: StoreItem[] }).items;
export const storeItem = (id: string) => STORE_ITEMS.find((i) => i.id === id) ?? null;

const HEX = /^#[0-9a-fA-F]{6}$/;
/** A colour as the item takes it: one "#rrggbb", or two for a print. Null if it does not fit. */
export function cleanColour(item: StoreItem, colour: unknown): string | null {
  if (typeof colour !== "string") return null;
  const parts = colour.split(",").map((c) => c.trim());
  const want = item.slot === "print" ? 2 : 1;
  if (parts.length !== want || !parts.every((c) => HEX.test(c))) return null;
  return parts.map((c) => c.toLowerCase()).join(",");
}

/** The profile's wallet, opened with the starting balance the first time, and the income dribble paid up to now. */
export function walletFor(userId: string, now: Date = new Date()): StoreWallet {
  let w = db.select().from(storeWalletsTable).where(eq(storeWalletsTable.userId, userId)).get();
  if (!w) {
    const at = now.toISOString();
    db.insert(storeWalletsTable).values({ userId, balance: STORE_SETTINGS.startingBalance, incomeAt: at, createdAt: at }).run();
    return db.select().from(storeWalletsTable).where(eq(storeWalletsTable.userId, userId)).get()!;
  }
  const periodMs = STORE_SETTINGS.income.everyHours * 3600_000;
  const periods = periodMs > 0 ? Math.floor((now.getTime() - Date.parse(w.incomeAt)) / periodMs) : 0;
  if (periods > 0 && STORE_SETTINGS.income.amount > 0) {
    const incomeAt = new Date(Date.parse(w.incomeAt) + periods * periodMs).toISOString();
    db.update(storeWalletsTable).set({ balance: w.balance + periods * STORE_SETTINGS.income.amount, incomeAt }).where(eq(storeWalletsTable.userId, userId)).run();
    w = db.select().from(storeWalletsTable).where(eq(storeWalletsTable.userId, userId)).get()!;
  }
  return w;
}

/** Hooks 2 and 3: a result in an online match (none exists yet). A loss never takes the balance below zero. */
export function walletResult(userId: string, won: boolean): StoreWallet {
  const w = walletFor(userId);
  const balance = won ? w.balance + STORE_SETTINGS.winReward : Math.max(0, w.balance - STORE_SETTINGS.lossPenalty);
  db.update(storeWalletsTable).set({ balance }).where(eq(storeWalletsTable.userId, userId)).run();
  return { ...w, balance };
}

export function ownedBy(userId: string) {
  return db.select().from(storeOwnedTable).where(eq(storeOwnedTable.userId, userId)).all();
}

export type BuyResult = { ok: true; balance: number } | { ok: false; status: number; error: string };

/** Buys an item in a colour from the wallet. A store that is closed sells nothing. */
export function buy(userId: string, itemId: string, colour: unknown): BuyResult {
  if (!storeOpen()) return { ok: false, status: 403, error: "The store is closed." };
  const item = storeItem(itemId);
  if (!item) return { ok: false, status: 404, error: "No such item." };
  const c = cleanColour(item, colour ?? item.colour);
  if (!c) return { ok: false, status: 400, error: item.slot === "print" ? "A print takes two colours, #rrggbb,#rrggbb." : "A colour is #rrggbb." };
  const w = walletFor(userId);
  if (w.balance < item.price) return { ok: false, status: 409, error: `Not enough ${STORE_SETTINGS.currency}.` };
  const balance = w.balance - item.price;
  db.transaction((tx) => {
    tx.update(storeWalletsTable).set({ balance }).where(eq(storeWalletsTable.userId, userId)).run();
    tx.insert(storeOwnedTable).values({ userId, itemId, colour: c, worn: false, boughtAt: new Date().toISOString() }).run();
  });
  return { ok: true, balance };
}

/** Wears (or takes off) an owned item; one item per slot is worn at a time. */
export function wear(userId: string, ownedId: number, worn: boolean): { ok: boolean; status?: number; error?: string } {
  const o = db.select().from(storeOwnedTable).where(and(eq(storeOwnedTable.id, ownedId), eq(storeOwnedTable.userId, userId))).get();
  if (!o) return { ok: false, status: 404, error: "Not yours." };
  const item = storeItem(o.itemId);
  if (!item) return { ok: false, status: 404, error: "That item is no longer in the store's file." };
  db.transaction((tx) => {
    if (worn)
      for (const other of tx.select().from(storeOwnedTable).where(and(eq(storeOwnedTable.userId, userId), eq(storeOwnedTable.worn, true))).all())
        if (storeItem(other.itemId)?.slot === item.slot) tx.update(storeOwnedTable).set({ worn: false }).where(eq(storeOwnedTable.id, other.id)).run();
    tx.update(storeOwnedTable).set({ worn }).where(eq(storeOwnedTable.id, ownedId)).run();
  });
  return { ok: true };
}

/** What a profile wears, as the court takes it: the model part (or print) and its colour. */
export function wornFor(userId: string): { slot: StoreSlot; unity: string; colour: string }[] {
  return ownedBy(userId).filter((o) => o.worn).flatMap((o) => {
    const item = storeItem(o.itemId);
    return item ? [{ slot: item.slot, unity: item.unity, colour: o.colour }] : [];
  });
}
