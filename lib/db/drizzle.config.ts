import { defineConfig } from "drizzle-kit";
import path from "path";

// DB_PATH: same env var used by lib/db/src/index.ts, so `drizzle-kit push`
// targets the same SQLite file the app actually runs against.
const dbPath = process.env.DB_PATH || "./volleyball-empire.sqlite";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
