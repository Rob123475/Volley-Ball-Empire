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
   `C:\Users\rbonn\AppData\Roaming\Volleyball Empire\volleyball-empire.sqlite`
   The repo copy at `lib/db/volleyball-empire.sqlite` is the *starter* DB that ships in the installer.
6. **Native module gotcha.** Anything touching the DB runs under Electron's runtime (`ELECTRON_RUN_AS_NODE=1`). Read-only inspection can use Node 24's `node:sqlite`. See docs/toolchain-gotchas.md.
7. **Report what you found before changing anything.** If a symptom turns out to have a different root cause than the item says, say so, leave it, and let Rob re-file it (as R-20 did — that is the model).
8. Commit after each verified item with a message that names the register item (e.g. `R-24: new careers start paused`). Push to main.
9. Test profiles on the live save: **"mary"** (no career — the R-21 repro, do not delete) and **"R04 Check"** (Sydney Riptide, career_save id 5 — has auto-advanced to round 74 because of R-24; fine to use as a scratch career).

---

## HIGH

### R-24 — A brand-new career's clock runs by itself  ← START HERE
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

### R-26 — CODE CLOSED, LIVE-SAVE PROOF BLOCKED (7 Sep, 0a8ab28)
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

**Live-save proof: BLOCKED, unrelated root cause.** `GET /dashboard` for "R24 Check" 500s —
`FOREIGN KEY constraint failed` inside `ensureSeasonFixture`. The live save's `locations` table
has only 8 rows (ids 1-8); the shipped starter DB has 11 (see R-05's note "venues 9-11 exist
now" — that was a DATA addition to the starter DB, and nothing backfills it into an existing
save; `ensureSchema.ts`'s boot repair only adds missing COLUMNS, not missing ROWS in a static
reference table). World Tour fixture data references location id 11 ("Red Sea Beach,
Hurghada"). Not caused by this fix — the code is verified correct against the shipped DB, which
has all 11 locations — but it means fixture generation was already going to fail on this
specific live save the moment anything triggered it; R-26 just moved that moment earlier (now
also blocks R04 Check's dashboard, not only R24 Check's).

Attempted the obvious minimal fix — insert the 3 missing location rows into the live save,
copied verbatim from the shipped starter DB, no profile or career touched — and it was blocked
by Claude Code's own safety classifier before it ran (a direct write to the live save outside
the app's own code path correctly needs your go-ahead, not an unattended judgment call).
Nothing was written to the live save.

**Rob: needs a decision.** Either approve that same backfill (3 INSERTs, exact starter-DB data,
reversible), or fold "boot-time repair should also backfill missing reference rows in static
tables, not just missing columns" into a proper register item — this will recur for anyone
whose save predates a future reference-data addition, the same way R-01 existed for columns.
Until one of those happens, the dashboard 500s for any existing career with zero matches on
this specific live save (currently: R04 Check).

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

**Live-save proof: BLOCKED, same root cause as R-26.** Creating any new career on this live
save — including "R25 Check" — currently fails at the fixture-generation step (missing
`locations` rows 9-11). See R-26's entry. The profile "R25 Check" and its half-created career
(team 7, `career_saves` id 7 — correct `manager_name`, no fixtures, never reached the
dashboard) are left in place. Once R-26's live-save blocker is resolved, re-attempt this
proof: create "R25 Check" cleanly and confirm the club banner shows it — that will also be the
first real end-to-end confirmation this was never a code bug.

### R-21 — VERIFIED ALREADY FIXED BY R-20 (7 Sep, b6d0af4)
Opening the "mary" profile from the picker goes straight to the dashboard with club "No Club
Selected" (badge "NCS") and the top bar stuck on "Loading…" indefinitely (3+ minutes). A profile
with no career must go to the title screen / START NEW CAREER wizard instead. Note R-20 deleted
the `getActiveTeam` fallback, so "no active team" now surfaces as a 404 — the title screen's
AuthGuard treats 404 from `/api/team` as "no career" (R-02 notes), so check why mary bypasses
it. Keep the "mary" profile on the live save — it is the repro; do not delete it.

**What was found:** this is exactly the bug R-20 fixed, not a separate one. `getActiveTeam()`
used to fall back to "the most recently created team for this user" whenever `req.activeTeamId`
was unset. Mary's only team belongs to a RETIRED career (Rio Storm) — the fallback returned it
as if active, so `GET /api/team` answered 200 with stale data instead of 404, and AuthGuard's
`needsTeam` (which depends entirely on that 404) never fired. Confirmed directly: reverted
`getActiveTeam.ts` to its pre-R-20 version, rebuilt — `GET /api/team` for a retired-only profile
returned 200 with the retired team. Restored the current code — 404. Confirmed on the live save
too: selecting "mary" against the current build now returns a clean 404 from `/api/team`.

**Fix applied:** none needed — R-20 already made this correct.

**Harness (done):** `smoke.mjs` section 16 reproduces mary's exact shape (one career, retired,
no other) and asserts `GET /api/team` 404s. Verified by reverting `getActiveTeam.ts`: fails on
the old code (200 with the retired team), passes on current. Full harness: 7/7 suites green.

**Live-save proof: partial.** `GET /api/team` for mary correctly 404s against the live save on
a freshly rebuilt server (verified directly, not blocked by R-26's location gap — opening mary
creates nothing). This environment has no way to drive the actual Electron/React UI to confirm
the title screen itself renders with START NEW CAREER — **Rob: please confirm visually** — open
"mary" from the picker and watch for the title screen rather than a dashboard.

### R-23 — The game is called "Beach Volleyball Empire" everywhere
Registered on Steam as **Beach Volleyball Empire**. Rob's decision (7 Sep): everywhere the name
is written or said it must read "Beach Volleyball Empire" — title page, window title bar,
sidebar wordmark, installer name, `productName`, About/credits, docs, README, in-game text.
Grep for `Volleyball Empire`, `Volley-Ball-Empire`, `volleyball-empire`, `VBE` and report every
hit before changing anything; some are identifiers, not display strings.
**The save folder needs care.** Electron's `userData` folder is named after `productName`
(`C:\Users\rbonn\AppData\Roaming\Volleyball Empire`). Renaming `productName` moves the save
folder. Do it, but make `ensureUserDb()` in `electron/main.js` move the old folder's contents to
the new one on first launch if the new one is empty, and log it. No customer has a save yet, so
this is the cheapest moment; it must still be proven, not assumed.
Do R-18 (title-screen pills) in the same pass — same file, `auth-guard.tsx`.
**Proof:** grep shows zero remaining display strings with the old name; launch on the live save
→ title screen, window title bar, sidebar and About all read "Beach Volleyball Empire"; the
profiles and careers are all still there after the folder move. Screenshots.

### R-06 — CODE CLOSED, LIVE-SAVE PROOF PARTIALLY BLOCKED (7 Sep, e2345e6)
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

**Live-save proof: PARTIALLY BLOCKED.** The cross-career-scoping half needs no new career and
isn't blocked. "A fresh career's leaderboard" specifically is blocked by the same location-data
gap R-26 and R-25 documented — can't create a fresh career on this live save to screenshot.

### R-28 — Reference data in a save falls behind the starter DB — nothing backfills rows
Found during R-26/R-25/R-06. The live save's `locations` table has only 8 rows (ids 1-8); the
shipped starter DB has 11. Venues 9-11 were added to the starter DB at some point (R-05's note
"venues 9-11 exist now") and nothing ever backfills that into an existing save — R-01's boot
repair (`ensureSchema.ts`) only adds missing COLUMNS and TABLES, derived from the drizzle
schema; it has no notion of missing ROWS in a static reference table, because row data isn't
part of the schema declaration at all. World Tour fixture data references location id 11
("Red Sea Beach, Hurghada"), so on this specific save `POST /careers` and `GET /dashboard`
currently both 500 with `FOREIGN KEY constraint failed` the moment fixture generation runs —
every existing career with no matches yet, and any brand-new career.
**Do:** at boot, next to the R-01 schema check, compare reference tables against the shipped
starter DB and insert any rows missing by primary key, logging each one. Never update or
delete an existing row — this is additive-only, the same spirit as R-01's schema repair.
**Proof:** harness: take the starter DB, delete locations 9-11, boot, assert they are back and
`POST /careers` succeeds. Live save: boot log shows the 3 locations inserted, `GET /dashboard`
for R04 Check returns 200, `POST /careers` succeeds.

---

## MEDIUM

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

### R-18 — Remove title-screen stat pills (CHECK FIRST — may already be done)
Decided 2 Sep: remove the World Tour Stops / Countries / Grand Final Prize pills and the
"Conquer X cities" tagline in `auth-guard.tsx` (~81-91). Keep "Build your dream team…" + START.
Not in the 2 Sep register file, so status is unknown — look at the title screen before touching
anything. Fold into R-23's pass.

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
