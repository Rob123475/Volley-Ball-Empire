/**
 * 1.2 D4 (Rob, 23 Nov): the Store and its own money.
 *
 * Separate from the career: these two tables are keyed by the profile (users.id), never by a
 * career, a team or a club, and nothing here reads or writes a club's bank balance or anything
 * else in a career's finances. The store, its accessories and prints are for the exhibition and
 * (later) online play.
 *
 * ensureSchema creates both tables in an older save at boot, as for every table declared here.
 */
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/** One wallet per profile. */
export const storeWalletsTable = sqliteTable("store_wallets", {
  userId: text("user_id").primaryKey(),
  balance: integer("balance").notNull(),
  /** When the steady income was last paid in (ISO time): the dribble pays for whole periods since. */
  incomeAt: text("income_at").notNull(),
  createdAt: text("created_at").notNull(),
});

/** What a profile has bought, in the colour it chose, and whether it is worn. */
export const storeOwnedTable = sqliteTable("store_owned", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  /** The item's id in the store's data file (artifacts/api-server/src/data/store-items.json). */
  itemId: text("item_id").notNull(),
  /** "#rrggbb", or for a print "#rrggbb,#rrggbb" (its two colours). */
  colour: text("colour").notNull(),
  worn: integer("worn", { mode: "boolean" }).notNull().default(false),
  boughtAt: text("bought_at").notNull(),
}, (t) => [index("store_owned_user").on(t.userId)]);

export type StoreWallet = typeof storeWalletsTable.$inferSelect;
export type StoreOwned = typeof storeOwnedTable.$inferSelect;
