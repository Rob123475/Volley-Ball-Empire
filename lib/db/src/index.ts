import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

if (!process.env.DB_PATH) {
  throw new Error(
    "DB_PATH must be set. Did you forget to pass the SQLite file path?",
  );
}

export const sqlite = new Database(process.env.DB_PATH);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

export * from "./schema";
