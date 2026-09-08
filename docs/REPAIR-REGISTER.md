# Beach Volleyball Empire — Repair Register (handoff brief for Claude Code)

Refreshed 7 Sep 2026 against `main @ 2293606`. This file is the working list. Work it top to
bottom within each band, HIGH before MEDIUM before LOW. Compiled 2 Sep from a full code audit;
this refresh folds in what was verified on screen on 7 Sep and what R-20's investigation found.

**Score: 7 closed and verified · 20 open** (6 HIGH · 8 MEDIUM · 6 LOW). One of the LOW items
(R-18) may already be done and needs a look, not work.

## Rules of engagement (from Rob — non-negotiable)

1. **No guessing.** If you don't know, read the file / query the DB / run the command.
2. **One item at a time.** Finish it, verify it, report it, then STOP and wait. Auto mode OFF — never pick the next item yourself.
3. **Never say "done" without verification.** Show the command output or test that proves it, plus the on-screen check the item asks for.
4. **Demolish, don't patch.** If a pathway keeps failing, rebuild that part fresh. Delete dead code as you go. Never layer repair code on top of old rubbish.
5. **Live save ≠ repo DB.** The DB the app actually uses is the one `electron/main.js` resolves — read main.js first, never trust a note:
   `C:\Users\rbonn\AppData\Roaming\Beach Volleyball Empire\volleyball-empire.sqlite`
   (moved here from `...\Roaming\Volleyball Empire\` by R-23's rename migration, 8 Sep — the old
   folder still exists, emptied of the DB, as a breadcrumb; do not delete it either.)
   The repo copy at `lib/db/volleyball-empire.sqlite` is the *starter* DB that ships in the installer.
6. **Native module gotcha.** Anything touching the DB runs under Electron's runtime (`ELECTRON_RUN_AS_NODE=1`). Read-only inspection can use Node 24's `node:sqlite`. See docs/toolchain-gotchas.md.
7. **Report what you found before changing anything.** If a symptom turns out to have a different root cause than the item says, say so, leave it, and let Rob re-file it (as R-20 did — that is the model).
8. Commit after each verified item with a message that names the register item (e.g. `R-24: new careers start paused`). Push to main.
9. Test profiles on the live save: **"mary"** (no career — the R-21 repro, do not delete) and **"R04 Check"** (Sydney Riptide, career_save id 5 — has auto-advanced to round 74 because of R-24; fine to use as a scratch career).

---

## HIGH

### R-31 — Database is never checkpointed or closed on quit
`before-quit` in `electron/main.js` just kills the server (`child.kill()`, no signal a Windows
process can catch, 2s grace then `app.exit(0)` regardless). Nothing runs `PRAGMA
wal_checkpoint`, nothing calls `sqlite.close()` — confirmed by direct grep, no such call exists
on the main `sqlite` export anywhere in the server. The last writes of a session can sit
un-checkpointed in `volleyball-empire.sqlite-wal` indefinitely (SQLite's own auto-checkpoint is
the only thing that ever runs), which breaks Steam Cloud sync: Cloud only uploads the file(s) it
is told to sync, and a WAL-mode database's true state is split across `.sqlite` + `-wal` — syncing
the main file alone can ship a save missing its most recent progress.
**Do:** give the api-server a shutdown path `main.js` can trigger that runs `PRAGMA
wal_checkpoint(TRUNCATE)`, closes the sqlite handle, and exits 0. Change `before-quit` to call it
and wait for the child to exit, with the existing 2s kill as the fallback if it doesn't.
**Proof:** harness: boot, write a row, trigger the shutdown, assert the `-wal` file is 0 bytes or
absent and the row is present in the main `.sqlite` opened read-only. Live save: launch, quit via
the window close button, report `volleyball-empire.sqlite-wal`'s size afterward.

### R-24 — CLOSED, VERIFIED ON SCREEN BY ROB 8 SEP (6cb7c27)
Found during R-20. `routes/calendar.ts:187 getOrCreateCalendar()` creates a new career's
`calendar_state` with `calendar_speed = "medium"`, not `"pause"`. The moment anything polls
`GET /api/calendar` (the dashboard does, on load) the season starts advancing on its own. Proof
on the live save: "R04 Check" was created 7 Sep at round 1 / Feb 2026, Rob never touched
Advance, and within minutes of opening the dashboard and Team page it read round 74/78,
15 Dec 2026. A Steam player would start a career, look around the menus, and find the season
over.
**Do:** new careers must be created paused. Find every place a calendar row is created and make
"pause" the only default. Then check whether *polling* the calendar can ever advance it — a GET
must never move the clock; only an explicit advance/speed change may. If the advance is driven
by a client-side ticker, confirm the ticker does nothing while speed is "pause".
**Proof:** harness case: create a career, poll `/api/calendar` and `/api/dashboard` 20 times,
assert round and date are unchanged. Then on the live save: new profile → new career → sit on
the dashboard for two full minutes → screenshot shows round 1 and the start date. (Create it as
profile "R24 Check"; leave it there.)

**Verified on screen by Rob, 8 Sep.**

### R-26 — CLOSED, LIVE-SAVE VERIFIED (7-8 Sep, 0a8ab28, unblocked by R-28 cb5373a)
Found during R-20. Fixture generation is lazy: it only runs on `GET /matches/fixture`, which
only the Fixtures page calls. So a new career's dashboard shows "No match — Schedule one", the
ladder is empty (`GET /api/seasons/:id/ladder` returns `[]`), and R-05's transaction only
matters if the player happens to visit that page. R-05 never made generation eager — the
register's earlier claim that fixtures are generated "up front" was wrong.

**What was done:** extracted the generator into `ensureSeasonFixture(team, seasonYear)`
(`routes/matches.ts`), idempotent, called eagerly from `POST /careers` and defensively from
`GET /dashboard` (repair net for existing saves) as well as `GET /matches/fixture` (unchanged
in effect). Root cause was broader than fixtures alone: the ladder stayed empty because
`competitor_rankings` only ever gains a row on a career's first PLAYED match, not from a
schedule — added `ensureCompetitorRanking()` (`utils/competitors.ts`) alongside it, same
eager+defensive pattern, seeding a zero row so the player appears on their own ladder from day
one. `harness/fixture-transaction.mjs` (R-05's sabotage test) and `harness/rollover.mjs` needed
updating for the new eager behaviour — not wrong, just exercising states that no longer exist
(rollover's career now has real matches from day one, so calendar/advance correctly blocks on
match days; the harness now resolves them with `/calendar/skip-match`).

**Harness proof (done):** smoke.mjs section 14 — a fresh career, before ever calling
`GET /matches/fixture`, has `matches` rows, a real `nextMatch` from `GET /dashboard`, and a
ladder containing the player's own team at 0-0-0. Verified by stash/revert: all three fail
cleanly on the old code. Full harness: 7/7 suites green.

**Live-save proof: was BLOCKED, now CLEARED by R-28 (cb5373a).** `GET /dashboard` for "R24
Check" 500'd — `FOREIGN KEY constraint failed` inside `ensureSeasonFixture`, because the live
save's `locations` table had only 8 rows (ids 1-8) against the shipped starter DB's 11. Not
caused by this fix — the code was always correct against the shipped DB — but R-26 moved the
moment that gap surfaced earlier (onto R04 Check's dashboard as well as R24 Check's). Rather
than hand-insert the 3 missing rows (blocked by Claude Code's own safety classifier, correctly:
a direct write to the live save outside the app's own code path needs a go-ahead, not an
unattended judgment call), this became R-28: a proper boot-time repair, the same shape as R-01's
schema repair but for reference ROWS instead of columns. Verified on this live save: launched
`electron:dev`, boot log reads
`"starterDbPath":"...\\lib\\db\\volleyball-empire.sqlite","inserted":{"locations":[9,10,11]},"msg":"reference data backfilled from starter DB"`,
then `POST /api/profiles/8f275ed5-b85c-43d8-9567-3afc2ad1212e/select` + `GET /api/dashboard` for
R04 Check returned HTTP 200 (was 500), and `POST /api/careers` for a fresh slot on that same
profile returned HTTP 200 (was 500). R-26 itself is now fully proven live, not just in harness.

**Verified on screen by Rob, 8 Sep.**

### R-25 — INVESTIGATED, NO CODE BUG FOUND (7 Sep, 2cabc5a)
Found during R-20. `career_saves.manager_name` for "R04 Check" is literally the string `"r"`
(the dashboard club banner shows it as the manager badge). The row is the right row; the value
was wrong at write time. Most likely the wizard field sends a stale/partial value or the wrong
field. Related: R-13 says the save-slot screen drops `managerNationality` and `crestShapeIndex`
— check both wizard paths (`pages/new-career.tsx` and `pages/career-management.tsx`) while here,
because they are near-duplicates (see economy-design.md "the club picker exists TWICE").

**What was found:** every step of the write path is correct. `new-career.tsx` and
`career-management.tsx` (`NewCareerModal`) are both plain controlled inputs
(`value`/`onChange`, no stale state, no wrong field), submitted as `managerName.trim()`.
`useUpsertCareerSave` (generated API client) is a pure passthrough. `POST /careers` stores
`req.body.managerName.trim()` unmodified. Confirmed on the live save: attempted to create
"R25 Check" through the exact request shape the wizard sends; the request failed (same
location-data gap R-26 found — see below), but the `career_saves` row it managed to write
before that failure shows `manager_name = 'R25 Check'`, exactly as sent.

R-13's part of this (career-management.tsx dropping `managerNationality`/`crestShapeIndex`) is
worse than a dropped payload field — that modal never collects them at all (no state, no UI).
Fixing it means adding a nationality picker and a crest-shape picker to that screen, a real UI
feature. Left open under R-13, not attempted here.

**Fix applied:** `autoComplete="off"` added to both manager-name inputs — a defensive measure
against browser-level form autofill (the only plausible non-code explanation left), not
presented as a confirmed fix, since no code defect was found to fix.

**Harness (done):** `smoke.mjs` section 15 asserts `POST /careers` echoes the exact manager
name sent and `GET /dashboard` reads it back unchanged. This does not fail on the prior commit
— the server-side behaviour never changed, and a server-driven harness cannot exercise a
client-side `autoComplete` attribute. It stands as a permanent regression guard, and as the
evidence that the write path is correct. Full harness: 7/7 suites green.

**Live-save proof: was BLOCKED, now CLEARED by R-28 (cb5373a).** Creating any new career on
this live save previously failed at the fixture-generation step — the same missing `locations`
9-11 rows R-26 hit (see R-26's entry for the live boot-log and HTTP proof that the gap is now
backfilled at boot). The profile "R25 Check" and its half-created career (team 7, `career_saves`
id 7 — correct `manager_name`, no fixtures, never reached the dashboard) are left in place as
found; not cleaned up, since that write predates R-28 and is itself evidence the write path was
always correct. `POST /careers` was re-proven end-to-end on this live save under R-28's own
verification (a fresh career, different profile, `manager_name` echoed and stored exactly as
sent, HTTP 200) — a clean re-attempt of "R25 Check" itself was not repeated, since it would only
re-confirm the same write path R-28's verification already exercised.

**Verified on screen by Rob, 8 Sep.**

### R-21 — CLOSED, VERIFIED ON SCREEN BY ROB 8 SEP (7 Sep, b6d0af4; re-investigated 8 Sep, 7479193)
Mary reached the title screen and started a career from it, confirming the R-20/R-21 fix on
screen. Commit `7479193` records the 8 Sep re-investigation (mary's live-save data had changed
— a real career now exists for her — not a code regression); see that entry below in full.
Opening the "mary" profile from the picker goes straight to the dashboard with club "No Club
Selected" (badge "NCS") and the top bar stuck on "Loading…" indefinitely (3+ minutes). A profile
with no career must go to the title screen / START NEW CAREER wizard instead. Note R-20 deleted
the `getActiveTeam` fallback, so "no active team" now surfaces as a 404 — the title screen's
AuthGuard treats 404 from `/api/team` as "no career" (R-02 notes), so check why mary bypasses
it. Keep the "mary" profile on the live save — it is the repro; do not delete it.

**What was found (7 Sep):** this was exactly the bug R-20 fixed, not a separate one.
`getActiveTeam()` used to fall back to "the most recently created team for this user" whenever
`req.activeTeamId` was unset. Mary's only team then belonged to a RETIRED career (Rio Storm,
team id 4) — the fallback returned it as if active, so `GET /api/team` answered 200 with stale
data instead of 404. Confirmed by reverting `getActiveTeam.ts`: 200 with the retired team on old
code, 404 on current. `smoke.mjs` section 16 covers this. Left as **"Rob: please confirm
visually — open mary and watch for the title screen."**

**8 Sep — Rob reported "R-21 is NOT fixed": opening mary now lands on a full dashboard** (club
"Sydney Riptide", manager "rob", budget $400,000, Jan 1 2026, ladder showing only that team).
Re-investigated per Rob's 4-step brief: read the live save read-only, reproduce as mary through
the real API path, find the real cause, fix it if there is one.

**Read-only, before touching anything:** mary's `career_saves` rows are now just ONE —
`id 8, team_id 8, slot_number 1, manager_name "rob", club_name "Sydney Riptide", budget 400000,
retired_at NULL, created_at 2026-09-08T01:18:24Z`. The old retired career (team id 4, "Rio Storm
Volleyball") no longer has ANY `career_saves` row at all — team 4 is now an orphaned historical
row, consistent with R-03's overwrite-a-slot cascade (delete the old `career_saves` row, keep
the team row as history). `career_history_entries` has zero rows for mary — no retirement audit
trail either way. `users` has no `active_team_id`/`active_career_save_id` column; that state
lives only in the server-side session (`lib/auth.ts`), not on the row.

**Reproduced through the real app path** (fresh cookie jar, exactly the client's own sequence):
`POST /api/profiles/<mary>/select` → `{"ok":true}` → `GET /api/auth/user` → **200**,
`"username":"mary"` → `GET /api/team` → **200**, team id 8, "Sydney Riptide" → `GET /api/dashboard`
→ **200**, `clubName:"Sydney Riptide"`, `managerName:"rob"`. Traced the exact code that chose it:
`authMiddleware.ts`'s session-restore query (line ~72) selects the career with
`isNull(careerSavesTable.retiredAt)`, `orderBy(desc(lastPlayedAt))` — mary has exactly one
non-retired row (id 8), so it correctly restores `activeTeamId = 8`. `getActiveTeam.ts` then
returns team 8 for that id — no fallback, no guessing, exactly the R-20 fix working as designed.
`dashboard.ts` reads `career_saves` id 8 by `(id = cid, userId = mary)` for the manager/club
name — also exactly as designed.

**Real cause: not a code defect. Mary's live-save data itself changed.** She no longer has "only
a retired career" — she has one genuine, non-retired `career_saves` row, created 2026-09-08 at
01:18:24 UTC. `POST /careers` requires a full body (`managerName`, `clubName`, `budget`,
`locationId`, colors) submitted explicitly — nothing in this codebase can create that row from a
GET request or any automatic backfill/repair path (checked `dashboard.ts`, `getActiveTeam.ts`,
`ensureSeasonFixture`, `ensureCompetitorRanking` — none of them insert into `career_saves`).
`manager_name = "rob"` is a real person's name, not a generated placeholder or template default.
The creation timestamp (01:18:24) falls inside the exact window an `electron:dev` window was
left open and running against this live save for R-28's live verification (01:16–01:20) — i.e.
very likely Rob completed the START NEW CAREER wizard for mary himself, in the actual running
game window, while going to confirm the "please confirm visually" note above — which the wizard
appearing at all would already have proven correct. `slot_number 1` matches mary's only slot, so
this reused/overwrote her original slot rather than adding a second one.

Given that: `getActiveTeam`, `authMiddleware` and `dashboard.ts` are all doing exactly what
R-21/R-20 designed them to do — serve a genuine non-retired career, 404 only when there truly is
none. There is nothing to fix here; forcing a code change or a harness case against this would
be asserting a bug that isn't there. **No commit made for this re-investigation** — consistent
with R-25's "investigated, no code bug found" precedent.

**Rob: your call on how to leave mary.** Per this brief's hard rule, her current career was NOT
deleted, retired or renamed. If you want mary restored as a permanent "all-careers-retired"
fixture for future regression testing, that needs an explicit decision — either retire this
"Sydney Riptide" career (R-03's overwrite path) or use a different profile for that repro. Until
then, mary genuinely has an active career and will correctly land on its dashboard.

**Harness (unchanged, still valid):** `smoke.mjs` section 16 still reproduces the ORIGINAL
retired-only shape synthetically (its own fixture, not mary's live row) and asserts
`GET /api/team` 404s for it — this is unaffected by mary's live-save data changing and remains
the permanent regression guard for the R-20/R-21 fix itself. Full harness: 8/8 suites green
(unchanged by this investigation — no code was touched).

### R-23 — CLOSED (8 Sep, bc06e91 + fix b14fb0f) — "Beach Volleyball Empire" everywhere (absorbs R-18)
Registered on Steam as **Beach Volleyball Empire**. Rob's decision (7 Sep): everywhere the name
is written or said it must read "Beach Volleyball Empire" — title page, window title bar,
sidebar wordmark, installer name, `productName`, About/credits, docs, README, in-game text.
**The save folder needs care.** Electron's `userData` folder is named after `productName`
(previously `C:\Users\rbonn\AppData\Roaming\Volleyball Empire`, now
`...\Beach Volleyball Empire` — see rules of engagement §5 above, updated). Renaming
`productName` moves the save folder; `ensureUserDb()` in `electron/main.js` must move the old
folder's contents to the new one on first launch if the new one is empty, and log it.

**Assets:** Rob supplied `bve-icon-256.png` (256×256 wordmark, white bg) and
`bve-title-large.png` — reported as 1280×720 (wider than the 1232 Rob believed he had; used as
supplied). Both copied under `artifacts/beach-volleyball/public/images/brand/`, plus a flood-fill
knockout PNG (a global colour key would have eaten the wordmark's own white letters — only a
black outline separates them from the white background) and a 6-size `.ico` (16-256) derived
from the icon.

**A. Name — grep report:**
*Before* (case-insensitive, whole repo, excluding generated/binary): ~260 hits — the bulk (~200)
were auto-generated `lib/api-zod`/`lib/api-client-react` banner comments (`* Volleyball Empire
API`, from `openapi.yaml`'s `info.title`/`description`); the rest were real display strings
(title screen, sidebar, dashboard footer, leaderboard/matches headers, career-management,
achievement name, `index.html` title/meta, `docs/economy-design.md` heading,
`docs/packaging.md` installer-filename references, the dev launcher `.bat`/shortcut scripts) plus
correct identifiers (`appId: com.volleyballempire.desktop`, `volleyball-empire.sqlite`, the repo
folder/GitHub remote, the pnpm workspace name `"workspace"`, `main.js`'s `LEGACY_APP_DIRS`).

*Change list:* every display string above → "Beach Volleyball Empire". The ~200 generated banners
were fixed by editing `openapi.yaml`'s `title`/`description` and rerunning `pnpm --filter
@workspace/api-spec run codegen` — never hand-edited, since the next generation would have
reverted them anyway.

*Leave-alone list, with why:* `appId` (Steam/OS package identity, changing it breaks update
continuity), `volleyball-empire.sqlite` (the DB filename — an identifier, not a display string),
the repo folder and GitHub remote (out of scope, not asked for), the pnpm workspace name
`"workspace"` (`main.js`'s own comment: renaming it would move the dev save folder as a side
effect of a packaging change), `main.js`'s `LEGACY_APP_DIRS`/new `PREVIOUS_APP_NAME` (name OLD
folders on purpose, for migration — see below), and two files judged out of scope as *historical
record rather than live display text*: `attached_assets/*.txt` (a pasted prompt from early
development) and `PR_BODY.md` (a past PR's own changelog describing what THAT PR did) — rewriting
either would falsify a record of what was actually said/done at the time, not fix a display bug.

*After:* re-grepped the same patterns — the only remaining hits are exactly the leave-alone list
above (confirmed line by line) plus the two historical files, noted above, left alone on purpose.

**B (= R-18) — title screen (`auth-guard.tsx`):** background is now `bve-title-large.png`
(cover, centred; same gradient overlays kept, so the button stays legible). Removed the
"VOLLEYBALL / EMPIRE" `<h1>` (the wordmark is in the artwork now) and the world-summary fetch +
stat-pill rail that existed only to feed it (dead code once the pills are gone: `worldReady`,
`statPills`, `formatPrize`, the `useQuery` call). No "Conquer X cities" text existed anywhere in
the current codebase — grepped for it specifically, confirmed absent, not invented. Top-left
small logo and the sidebar wordmark (`shell.tsx`) both use the **text** fallback, not the
knocked-out icon: rendered the knockout at the ~28px it would actually show at, the 3-line
stacked wordmark was illegible mush — exactly the case the brief's own fallback clause
anticipated, decided from that evidence rather than a guess. Kept the ALL-WOMEN WORLD TOUR chip,
the tagline, and the START/CONTINUE button exactly as they were.

**C — icon/window:** `BrowserWindow` now sets `icon`/`title`; `package.json`'s `build.win.icon`
repointed at the brand-folder `.ico`. Deleted `electron/icons/volleyball-empire.ico` (superseded,
now dead) and a genuinely broken duplicate, `scripts/create-desktop-shortcut.ps1` (pointed at a
`.bat` that never existed at its own relative path, under an even older product name) — demolished
rather than patched to match the rename.

**D — save folder migration:** new `migrateRenamedAppData()` in `electron/main.js`, MOVE
semantics (`fs.renameSync`), scoped specifically to the one hand-off that matters
("Volleyball Empire" → "Beach Volleyball Empire") — distinct from the existing
`migrateLegacyUserData()`'s COPY semantics for several older, already-historical names, which is
unchanged. Never overwrites an existing save at the new path; never deletes the old folder, only
empties it.

**A real bug, caught live, not in harness (fixed in b14fb0f):** the first live-save launch under
the new name logged `Migrated save data from workspace to Beach Volleyball Empire` —
`migrateLegacyUserData()` ran first and claimed the new folder with a stale, empty "workspace"
save (a leftover from an old dev session) before `migrateRenamedAppData()` ever got to look at
the real one. Rob's save was never at risk — `migrateLegacyUserData()` only copies, and
"Volleyball Empire" isn't even in its list — but the new folder ended up with the wrong (empty)
data. Manually removed the wrongly-created "Beach Volleyball Empire" folder (nothing in it but
Chromium runtime cache and the empty decoy — verified before deleting), fixed the call order
(`migrateRenamedAppData()` now runs first), and — because the original harness fixture had no
decoy folder to compete for `userDbPath`, it passed 6/6 despite the ordering bug being live-broken
— strengthened `harness/save-folder-migration.mjs` to seed exactly that decoy. Confirmed the
strengthened harness now catches it (reverted just the ordering change: 4/7 fail, the 3
assertions that matter); confirmed the fix again: 7/7.

**Harness (done):** `harness/save-folder-migration.mjs` — the first suite to boot
`electron/main.js` itself (every other suite boots only the built server via
`ELECTRON_RUN_AS_NODE`), using `--user-data-dir` (a standard Electron/Chromium flag, more
reliable than an `APPDATA` env override which Electron's Windows path service doesn't read back)
to point a real app boot at a temp AppData layout. Seeds a save under the OLD folder name plus a
decoy "workspace" folder, with real profile rows, and asserts: new folder has the moved DB, old
folder still exists but is empty, the boot log names the move, the decoy is untouched, and both
profiles are byte-exact. Wired into `run-all.mjs` as suite 4/9. Full harness green: **9/9
suites**.

**Live-save proof (done):** live save's `Volleyball Empire` folder confirmed fully intact (4
profiles: mary, R04 Check, R24 Check, R25 Check) before every attempt. Launched `electron:dev`:
boot log reads `Moved save data from "Volleyball Empire" to "Beach Volleyball Empire"
(volleyball-empire.sqlite, volleyball-empire.sqlite-wal, volleyball-empire.sqlite-shm)`. Verified
directly: the old folder's `volleyball-empire.sqlite`(+ sidecars) are gone, the folder itself
still exists (Chromium runtime cache + two differently-named backup files from earlier repair
work, untouched); the new folder has the moved DB; `GET /api/profiles` on the running app lists
all 4 profiles, exactly as before. Window title bar confirmed via
`Get-Process | Select MainWindowTitle` → **"Beach Volleyball Empire"**. `images/brand/bve-icon-
256.ico` and `bve-title-large.png` both serve 200 from the running app. **Left running for Rob to
screenshot** — title screen art, no pills, no cities/prize numbers, sidebar/top-bar wordmark and
window icon are visual judgment calls this environment cannot make; Rob decides whether it looks
right.

### R-06 — CLOSED, LIVE-SAVE VERIFIED (7-8 Sep, e2345e6)
Dashboard rank and ladder were rebuilt in R-20 (scoped to `competitor_rankings`). Still open:
`routes/leaderboard.ts:9-24` ranks from `teams` with no results gate and no career scope;
`pages/leaderboard.tsx:125, 190-198` renders the top row as Champion. Apply the same
`competitor_rankings` source + "no results yet" empty state.

**What was done:** rebuilt `GET /leaderboard` on `competitor_rankings`, scoped to
`(career_save_id, season_year)` — the same source and scope R-20 gave the season ladder.
Joined through `career_saves` by `career_save_id` (not `team_id`, which is nullable once a
manager resigns) so the "Manager" column reads the in-game manager name, consistent with
`dashboard.ts` — the old code used the profile's local name, which R-25 found is a different
value. `pages/leaderboard.tsx`'s `isUser` was matched by team name (four call sites) — same
anti-pattern R-20 fixed on the ladder — changed to `teamId`. Added a "No results yet" empty
state and hid the now-pointless empty rankings table.

**Discovered mid-fix:** R-26 (earlier in this pass) seeds a zero-row `competitor_ranking` at
career creation, so a fresh career's leaderboard is never actually empty through the normal
creation path — it shows the player's own team at 0-0-0, day one, same as the ladder. The
"fresh career shows the empty state" proof text no longer holds after that change; what it
was actually guarding against (no cross-career data, no fake Champion) is what the harness
proves instead. The empty-state UI still covers a save whose ranking predates R-26.

**Harness (done):** `smoke.mjs` section 17 — two played careers each see only their own team;
a brand-new career sees only its own team at 0-0-0, never another's. Verified by stash/revert:
old code shows all careers-worth of teams on every request, all 3 checks fail. Full harness:
7/7 suites green.

**Live-save proof: was PARTIALLY BLOCKED, now CLEARED by R-28 (cb5373a).** The cross-career-
scoping half needed no new career and was never blocked. "A fresh career's leaderboard"
specifically was blocked by the same location-data gap R-26 and R-25 documented — creating a
fresh career on this live save 500'd before R-28. R-28's own live-save verification created
exactly that: a brand-new career ("R28 Verify", slot 2, on R04 Check's profile) via
`POST /careers`, HTTP 200. That career is left in place on the live save — **Rob: open R04
Check → slot 2 ("R28 Verify") and check the leaderboard shows it at 0-0-0 alongside R04 Check's
own team, never another profile's**, for the visual confirmation this entry's harness proof
already covers server-side.

**Verified on screen by Rob, 8 Sep** (R28 Verify FC's standings row showed only its own team,
0-0-0 — the 9:1 goal-differential display issue seen on that row is tracked separately as R-30).

### R-28 — CLOSED (8 Sep, cb5373a) — Reference data in a save falls behind the starter DB
Found during R-26/R-25/R-06. The live save's `locations` table had only 8 rows (ids 1-8); the
shipped starter DB has 11. Venues 9-11 were added to the starter DB at some point (R-05's note
"venues 9-11 exist now") and nothing ever backfilled that into an existing save — R-01's boot
repair (`ensureSchema.ts`) only adds missing COLUMNS and TABLES, derived from the drizzle
schema; it has no notion of missing ROWS in a static reference table, because row data isn't
part of the schema declaration at all. World Tour fixture data references location id 11
("Red Sea Beach, Hurghada"), so on this save `POST /careers` and `GET /dashboard` both 500'd
with `FOREIGN KEY constraint failed` the moment fixture generation ran — every existing career
with no matches yet, and any brand-new career.

**What was done:** `ensureReferenceData()` added next to `ensureSchema()` in
`utils/ensureSchema.ts`, run right after it at boot. Compares `locations`, `club_templates` and
`outfits` — the subset of `scripts/src/make-starter-db.ts`'s own `KEEP_TABLES` (its
already-maintained "this is reference data" list) that has no per-career shadow state.
`players` and `staff` are also in `KEEP_TABLES` but excluded: both are genuinely written by
`updatePlayerReference`/`updateStaffReference`, and a missing row there would need a matching
`career_player_state`/`career_staff_state` row for every existing career, which only
`seedCareerState()` can safely create, only at career creation — a different, larger problem
than a missing row. For the three tables in scope, every row present in the shipped starter DB
(path via new `STARTER_DB_PATH` env, wired through `electron/main.js` the same way `PUBLIC_DIR`
already is) but missing from the save is inserted by primary key; every row's other columns are
left exactly as they are — additive only, never an UPDATE, same spirit as R-01. No-op, logged,
when `STARTER_DB_PATH` isn't set (harness suites other than this one, a bare `node dist/index.mjs`).

**Harness (done):** `harness/reference-data-backfill.mjs` — a save missing locations 9-11 gets
them back at boot, the log names each id inserted, `POST /careers` succeeds where it used to
500, an existing row (`locations` id 1) is proven byte-for-byte untouched, and
`STARTER_DB_PATH` unset is proven a logged no-op rather than a crash. Verified by stash/rebuild/
rerun against the pre-fix code: 4/8 checks fail, including the exact
`FOREIGN KEY constraint failed` 500 this exists to fix. Wired into `harness/run-all.mjs` as
suite 3/8. Full harness green: 8/8 suites.

**Live-save proof (done):** launched `electron:dev` against the live save. Boot log:
`"starterDbPath":"...\\lib\\db\\volleyball-empire.sqlite","inserted":{"locations":[9,10,11]},"msg":"reference data backfilled from starter DB"`.
`GET /api/dashboard` for R04 Check (`8f275ed5-b85c-43d8-9567-3afc2ad1212e`) returned HTTP 200
(was 500). `POST /api/careers` for a fresh slot on that profile ("R28 Verify", slot 2) returned
HTTP 200 (was 500) — left in place on the live save, not deleted, as evidence and as R-06's
fresh-career leaderboard test case. No profile or career was deleted or renamed; the backfill
itself ran entirely through the app's own boot code path, not a direct write.

---

## MEDIUM

### R-29 — World Tour standings show only the player's club
World Tour Standings reads "1 teams", the World Finals bracket auto-seeds the player as #1 with
every other slot TBD, and the fixtures header says "18 qualified teams" while the ladder holds
one. Root cause is already documented in `docs/economy-design.md` §2.4: World Tour opponents
are name strings from static data, not competitor rows, so nothing else can hold ranking points.
Needs Rob's design decision on where AI ranking points come from (Phase 0 "competitor entity").
Registered 8 Sep — do not build it yet.

### R-30 — "Goals +/- 9 : 1" on a club that has played zero matches
Seen on R28 Verify FC's World Tour Standings row at 0-0-0. Find where the seeded
`competitor_rankings` zero-row (R-26's `ensureCompetitorRanking`) or the standings page gets 9
and 1 from and make a fresh row read 0 : 0. Small; queue after R-23. Registered 8 Sep.

### R-22 — Skin tone and kit colour in the Unity court
Rob's requirement (7 Sep): every player must appear with **her own skin tone** and **her club's
bikini/kit colour** in the Unity 3D court, and this must match the management side. Today,
launching from the desktop shortcut and pressing "3D Court" shows the same pale model in a grey
kit for everyone. Rob believes the Unity project already has provisions for skin and kit
colour, so this is first a **pathway trace**, not a build job:
1. What does the management side hold per player (skin tone field? kit colour on team?) — report the columns.
2. What does `/unity/match-state` actually send — dump one real payload.
3. What does `UnityMatchDataLoader.cs` read from it, and does the Unity scene apply it?
Report where the chain breaks before fixing. If a field does not exist on the management side,
say so — that becomes a data job (per-player skin tone, per-team kit colour) and Rob decides.
`pages/court.tsx` is the highest-churn file in the repo (R-17); do not "repair" it — if the
integration needs rebuilding, say so and stop. Also confirm the triage note 3y: a player keeps
her skin tone when she changes club, and kit colour follows the **team**.
**Proof:** a real match in the Unity view with two visibly different players in their club's
colours, plus the payload that produced it. Screenshot.

### R-27 — Delete-cascade guard misses teamId-scoped tables
Flagged by Claude Code during R-19: the schema-drift / cascade guard only checks tables keyed
by `careerSaveId`; tables keyed by `teamId` (e.g. `competitors`) are not covered, so a future
table could be orphaned by a career delete without the harness noticing.
**Do:** extend the guard to every table that references a career directly or through its team.
**Proof:** sabotage test — add a fake teamId-scoped table to a throwaway DB, delete the career,
assert the guard reports the orphans.

### R-07 — Invariants: I1, I5 failing; I2, I6, I8, I9 hard-coded not measured
`docs/economy-design.md:567-596`; `harness/invariants.mjs:313` (I1), `:344-383` (I5),
`:400-437` (literal verdicts for I2/I6/I8/I9). I5: best squad 38.3 pts vs Gold threshold 40 —
a settings DECISION for Rob, not a code change. I1: wages 2.00× vs income 1.32×. I2/I6/I8/I9
blocked on R-08/R-09/R-11.

### R-08 — Five-season harness never plays a match
`harness/rollover.mjs` walks 5 seasons at 0W 0L. Make it simulate real fixtures for a strong and
a weak squad across the whole arc so I8/I9 become measurable.

### R-09 — Getting sacked is computed but never happens (partial)
`isJobAtRisk` / `boardConfidence` computed server-side, zero frontend consumers.
`pages/manager-contract.tsx` still runs on `PLACEHOLDER_CONTRACT`. Wire an at-risk banner +
confidence meter to the dashboard, escalation ladder on the contract page, career ends at zero
confidence; then replace the placeholder contract with a real endpoint.

### R-10 — Three design-doc screens don't exist
`docs/economy-design.md:840-848, 868-878`: no Rankings page, no Career Result page, no
Underdog/Established start choice. Qualification / Tier status / Finals bracket / Fail state
are "extend existing page" — open each and confirm whether done.

### R-11 — Career difficulty choice isn't in the game
Underdog vs established at career start. `pages/new-career.tsx` sends the same payload
regardless; `routes/careers.ts` has no concept of it. Add to wizard → store on career save →
seeding reads it (budget, tier lock, starting squad). Invariant I6 hangs off this.

---

## LOW

### R-18 — CLOSED, absorbed into R-23 (8 Sep, bc06e91)
Decided 2 Sep: remove the World Tour Stops / Countries / Grand Final Prize pills and the
"Conquer X cities" tagline in `auth-guard.tsx` (~81-91). Keep "Build your dream team…" + START.
Done as R-23 section B: pills and the dead `world-summary` fetch that fed them removed; no
"Conquer X cities" text existed in the current codebase to remove (grepped, confirmed absent).
See R-23's entry above for full detail.

### R-12 — Seven "coming in a future update" stubs still visible
`pages/competition/medal-table.tsx:24` · `olympic-results.tsx:23` · `olympic-history.tsx:19,24`
· `pages/job-market.tsx:408` · `components/career/PoachingInbox.tsx:235` ·
`pages/manager-contract.tsx:518, 546`. Build or remove from nav.

### R-13 — Save-slot screen drops nationality and crest shape (partial)
`pages/career-management.tsx:264-276` payload omits `managerNationality` and `crestShapeIndex`;
wizard sends them. Check alongside R-25.

### R-14 — Profile page hard-codes manager salary (partial)
`pages/profile.tsx` `PLACEHOLDER_SALARY = "$5,000 / season"`. Resolves with R-09.

### R-15 — Dashboard "Game Settings" tile doesn't open settings
`pages/dashboard.tsx:927-931` — tile opens the career options menu. Relabel or remove.

### R-16 — Stray package.json inside server source
`artifacts/api-server/src/package.json:12-13` still lists `@google-cloud/storage`. Delete it.

### R-17 — Unity court: scope, don't fix yet
`pages/court.tsx` — 92 commits, highest churn in repo, one-endpoint integration
(`/unity/match-state`) + iframe. R-22's pathway trace is the scoping exercise for this. Steam:
0 references anywhere — late, short step.

---

## Closed and verified (do NOT re-cover)

| Item | Closed | Proof |
|---|---|---|
| R-01 Saves fall behind the code | 2 Sep, adad32b | derived schema diff at boot; harness schema-drift; live save 0 missing |
| R-02 One real career has never reached the Dashboard | 2 Sep | Rob reached the dashboard; full launch path verified on screen |
| R-03 Overwrite/delete a played career fails on FK | 2 Sep, cc319d3 | one shared `deleteCareerSave` cascade; smoke case 10; live-save proof via R-19 |
| R-04 New career starts with no squad / no prompt | 7113a3b, verified on screen 7 Sep | 2 starters + 1 interchange, "Grow Your Squad" prompt |
| R-05 Fixture generation isn't a transaction | 3949ecd | `harness/fixture-transaction.mjs` sabotage test 30 orphans → 0 |
| R-19 Delete button on Select Manager | 359d245, verified on live save 7 Sep | deleted "R02 Verify" and "r" through the UI |
| R-20 Dashboard/ladder show another career's state | 7 Sep, 2293606 | ladder had no filter; fallbacks deleted; smoke case 12 proven by sabotage; 7/7 suites, 56/56 |

26 Aug Release Triage: 25/33 fully fixed, leftovers folded in above. Still holding: native-ABI
guard, dev routes gated, CORS same-origin, all portrait refs resolve, PORT build hole guarded,
`sync:public` in build chain, caption guard (204 cards), image-format guard.

## Open design decisions (not repairs — Rob's call, tracked in docs/triage.md §3)
Academy never refills (3w) · seniors cannot retire early (3x) · AI club reserves (3a) ·
qualifying competition (3b) · I5 threshold (R-07) · real flag assets before any Olympic
ceremony (ideas.md).

## Live save facts (verified 7 Sep)
Path above. Profiles: mary (no career), R04 Check (career_save 5, Sydney Riptide, team 5,
season 7 — auto-advanced to round 74 by R-24). Schema check clean at 2293606.
