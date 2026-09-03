# Volleyball Empire — Repair Register (handoff brief for Claude Code)

Compiled 2 Sep 2026 against `main @ f8fe701` by a full code audit. This file is the working
list. Work it top to bottom. It supersedes the 26 Aug Release Triage (that list is 25/33 fully
fixed, 6 partial, 2 re-opened — the leftovers are folded in below).

## Rules of engagement (from Rob — non-negotiable)

1. **No guessing.** If you don't know, read the file / query the DB / run the command.
2. **One item at a time.** Finish it, verify it, report it, then move on. Do not batch.
3. **Never say "done" without verification.** Show the command output or test that proves it.
4. **Demolish, don't patch.** If a pathway keeps failing, rebuild that part fresh. Delete dead code as you go. Never layer repair code on top of old rubbish.
5. **Live save ≠ repo DB.** The DB the app actually uses is the one `electron/main.js` resolves:
   `C:\Users\rbonn\AppData\Roaming\Volleyball Empire\volleyball-empire.sqlite`
   (a backup `volleyball-empire-BACKUP-pre-column-fix.sqlite` sits beside it). The repo copy at
   `lib/db/volleyball-empire.sqlite` is the *starter* DB that ships in the installer. Don't confuse them.
6. **Native module gotcha.** Running scripts/harness under system Node needs `pnpm rebuild better-sqlite3`;
   launching the Electron app needs the Electron-ABI build (`pnpm exec electron-rebuild -f -w better-sqlite3`,
   or node-gyp directly if electron-rebuild silently no-ops — see docs/toolchain-gotchas.md). They conflict; switch as needed.
7. Commit after each verified item with a message that names the register item (e.g. `R-01: derive missing columns from schema at boot`).

---

## BLOCKERS

### R-01 — Saves fall behind the code, and nothing brings them up to date  ← START HERE

**What's wrong.** `artifacts/api-server/src/utils/ensureSchema.ts` runs on every server boot
(from `src/index.ts:29-36`) and is the only schema-repair step in the project (its own comment,
lines 7-10: "There is no migration runner in this project"). It applies a **hand-typed list**
`NEW_COLUMNS` (lines 140-152) of exactly 7 columns. `teams.crest_shape_index`
(`lib/db/src/schema/game.ts:184`) was never added to that list, so every save created before that
column existed crashed on `GET /api/team` until it was added by hand on 1 Sep. The next schema
change will do the same thing again. `electron/main.js:145-156 ensureUserDb()` only copies the
starter DB when no save exists; it never upgrades one. `harness/migration-fixtures.mjs` tests the
per-career data migration, not schema drift, and would not have caught this.

**Player sees.** After an update: title screen shows RETRY forever / "Could not load your career". Save is intact on disk but unreadable.

**Fix (build this, don't extend the list):**
1. At boot, for every table in the drizzle schema (`lib/db/src/schema/*`), compare `PRAGMA table_info(<table>)` against the schema's declared columns.
2. For each missing column, `ALTER TABLE <t> ADD COLUMN <col> <sqlite type>` with the schema's default if it has one; if the schema says NOT NULL with no default, add it with a sensible default and log loudly (or fail boot with a clear error — never silently).
3. Also create any missing table/index the schema declares (keep the existing CREATE IF NOT EXISTS behaviour, but derive it rather than hand-write it if practical).
4. Delete the hand-typed `NEW_COLUMNS` list once the derived path covers it.
5. **Harness:** add a case to `harness/migration-fixtures.mjs` (or a new `harness/schema-drift.mjs` wired into `run-all.mjs`) that takes the starter DB, drops a column that exists in the schema (e.g. `teams.crest_shape_index` via table-rebuild, since SQLite DROP COLUMN has limits), boots `dist/index.mjs` against it, and asserts the column is back and `GET /api/team` returns 2xx.
6. **Verify on the live save:** launch via `pnpm electron:dev`, confirm boot log shows the schema check ran with 0 missing columns, and `GET http://localhost:4173/api/team` returns 200.

**Evidence refs:** `utils/ensureSchema.ts:7-10, 26-152` · `src/index.ts:29-36, 70-90` · `electron/main.js:145-156` · `lib/db/src/schema/game.ts:184` · `utils/migrateCareerState.ts:452-536` (the only other DDL, fixed set) · `scripts/check-starter-db.cjs` (guards the starter DB only, never a player save).

### R-02 — One real career has never reached the Dashboard

**What's wrong.** ~20 launch attempts, none past the title screen. All harness/economy work has been done against a game nobody has played. Launch path (traced): app → `/login` ProfilePicker (`GET/POST /api/profiles`, `POST /api/profiles/:id/select` sets `sid` cookie, `secure:false`) → `/` AuthGuard title (`GET /api/auth/user`, `GET /api/team`; 404 = no career → "START NEW CAREER"; any other error → "RETRY") → `/new-career` (`GET /api/club-templates`, `POST /api/careers`, then `href="/"`) → `/` Dashboard (`GET /api/dashboard`, `/api/seasons/current`, ladder, calendar, etc.).

**Bounce points:** (a) any 500 from `/api/team` → RETRY forever (R-01 causes this on a stale save — proven); (b) after `POST /careers`, if the session's `activeTeamId` isn't set (`routes/careers.ts:255`) AND `lib/getActiveTeam.ts:18-21` fallback finds nothing → bounced to title (possible, unconfirmed); (c) any 401 anywhere → `App.tsx:83-133` redirects to `/login` (possible if the cookie is dropped, unconfirmed on packaged build).

**Fix.** After R-01: launch, tail the server log (`[server]` lines in the Electron console / `startup-error.log`), find the first non-2xx response, fix that one thing, relaunch. Repeat until the dashboard renders with the existing career (1 team, 268 players). Report the exact sequence of requests that succeeded.

**Refs:** `App.tsx:83-133` · `components/layout/auth-guard.tsx:102-115, 209-241` · `pages/new-career.tsx:385-400, 418-455` · `routes/careers.ts:255` · `lib/getActiveTeam.ts:18-21` · `authMiddleware.ts:57-61, 70-99`.

---

## HIGH

### R-03 — Overwriting or deleting a played career fails on a foreign key (re-opened)
The 26 Aug fix (`routes/careers.ts:158-183`) cleans `poaching_offers` + `career_history_entries` in a transaction before deleting `career_saves`. Since then four tables gained NOT NULL, non-cascading FKs to `career_saves`: `career_player_state`, `career_staff_state`, `career_pool_team_state`, `competitor_rankings` (`schema/game.ts:292, 381, 393, 869, 953`), and every new career seeds rows into them (`utils/migrateCareerState.ts:589-640`). Neither the overwrite path nor `DELETE /careers/:id` (`careers.ts:426-446`) cleans them. Only `utils/deleteProfile.ts:35-141` does it right.
**Do:** reproduce first (create career → play one match → overwrite slot; then delete). Then route both paths through ONE shared career-cascade (extract it from deleteProfile's logic) — no second hand-maintained table list.

### R-04 — New career starts with no squad and nothing pointing at the market (partial)
Per-career state, regional league and season row are seeded (`careers.ts:225-228`, `migrateCareerState.ts:554-636`), but no player/staff is assigned to the new club (starter DB: `staff.team_id` NULL 120/120). Dashboard shows only "No players yet / Manage Squad" (`pages/dashboard.tsx:666, 1490`). Depends on R-11 for the difficulty choice; at minimum add a first-session prompt that sends the player to the market.

### R-05 — Fixture generation isn't a transaction
FK failure gone (venues 9-11 exist now), but the 76 inserts in `routes/matches.ts:631-676` are sequential awaits with no transaction → half-built season on any mid-way failure. Wrap in one transaction.

### R-06 — Leaderboard crowns a fresh save "Champion" (partial)
Dashboard rank (`routes/dashboard.ts:40-47`) and ladder (`routes/seasons.ts:124-140`) fixed. `routes/leaderboard.ts:9-24` still ranks from `teams` with no results gate; `pages/leaderboard.tsx:125, 190-198` renders top row as Champion. Apply the same "no results yet" gate + empty state.

---

## MEDIUM (game-completeness — do after the dashboard is reachable)

### R-07 — Invariants: I1, I5 failing; I2, I6, I8, I9 hard-coded not measured
`docs/economy-design.md:567-596`; `harness/invariants.mjs:313` (I1), `:344-383` (I5), `:400-437` (literal verdicts for I2/I6/I8/I9). I5: best squad 38.3 pts vs Gold threshold 40 — a settings DECISION for Rob, not a code change. I1: wages 2.00× vs income 1.32× worst→best squad. Last commit f8fe701 proved tier access is not the I1 lever. I2/I6/I8/I9 blocked on R-08/R-09/R-11.

### R-08 — Five-season harness never plays a match
`harness/rollover.mjs` walks 5 seasons at 0W 0L. Make it simulate real fixtures for a strong and a weak squad across the whole arc so I8/I9 become measurable.

### R-09 — Getting sacked is computed but never happens (partial)
`isJobAtRisk` / `boardConfidence` computed server-side, zero frontend consumers. `pages/manager-contract.tsx:53-79, 342, 415-435, 518, 546, 662` still runs on `PLACEHOLDER_CONTRACT` (fee now matches server `BREAK_CONTRACT_FEE = 25_000`, `routes/careers.ts:474, 684`). Wire an at-risk banner + confidence meter to the dashboard, escalation ladder on the contract page, career ends at zero confidence; then replace the placeholder contract with a real endpoint.

### R-10 — Three design-doc screens don't exist
`docs/economy-design.md:840-848, 868-878`: no Rankings page, no Career Result page, no Underdog/Established start choice. Qualification / Tier status / Finals bracket / Fail state are "extend existing page" — unverified whether done; open each and confirm.

### R-11 — Career difficulty choice isn't in the game
Design decided: scrappy underdog vs established mid-table club at career start. `pages/new-career.tsx:385-400` sends the same payload regardless; `routes/careers.ts:124-255` has no concept of it. Add to wizard → store on career save → seeding reads it (budget, tier lock, starting squad). R-04 and invariant I6 hang off this.

---

## LOW

### R-12 — Seven "coming in a future update" stubs still visible
`pages/competition/medal-table.tsx:24` · `olympic-results.tsx:23` · `olympic-history.tsx:19,24` · `pages/job-market.tsx:408` · `components/career/PoachingInbox.tsx:235` · `pages/manager-contract.tsx:518, 546`. Build or remove from nav.

### R-13 — Save-slot screen drops nationality and crest shape (partial)
`pages/career-management.tsx:264-276` payload omits `managerNationality` and `crestShapeIndex`; wizard sends them (`pages/new-career.tsx:388, 394`). Enter/click drift already fixed.

### R-14 — Profile page hard-codes manager salary (partial)
`pages/profile.tsx:226-227, 302-303, 379-380` `PLACEHOLDER_SALARY = "$5,000 / season"`. Resolves with R-09.

### R-15 — Dashboard "Game Settings" tile doesn't open settings (partial)
`pages/dashboard.tsx:927-931` — tile opens the career options menu. Relabel or remove.

### R-16 — Stray package.json inside server source
`artifacts/api-server/src/package.json:12-13` still lists `@google-cloud/storage`; not a workspace package (`pnpm-workspace.yaml:37-41`). Delete it.

### R-17 — Unity court: scope, don't fix yet
`pages/court.tsx` — 92 commits, highest churn in repo, one-endpoint integration (`/unity/match-state`) + iframe. The one "repaired instead of designed" area. Scope deliberately after R-02. Steam: 0 references anywhere — late, short step.

---

## Closed and verified (do NOT re-cover)

26 Aug items 01-03 (blockers), 04-09 (high, except 03-class regression → R-03), 10-14, 16-19, 21 (medium), 22, 24, 27-30, 32, 33, 34 (low) are fully fixed — evidence per item is in the published Repair Register artifact. Still holding: native-ABI guard (`scripts/before-pack.cjs:7-13`), dev routes gated (`routes/index.ts:86-88`), CORS same-origin (`app.ts:39-43`), all 341 portrait refs resolve, PORT build hole guarded (`scripts/check-build-env.mjs`), `sync:public` in build chain.

## Live save facts (verified 2 Sep)
Path above. `PRAGMA integrity_check` ok, WAL 0 bytes, `teams.crest_shape_index INTEGER` nullable present, 1 team, 268 players, all 50 schema tables present, zero columns missing vs schema at f8fe701. Live-only extra columns (`players.team_id`, `players.outfit_id`, `staff.team_id`) are deliberate leftovers from the career_player_state split — harmless.
