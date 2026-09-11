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

### R-40 — CLOSED (12 Sep; Unity ea6eb5e, game repo: the commit carrying this entry)
Brief step 8 failed on screen: the eebb029 WebGL build loaded and the sim ran — score,
commentary, weather HUD, court lines and net pole all drew — but the sand, the venue, the
crowd and all four players were invisible. July's build had rendered everything.

**Reproduced first, on both GL paths.** Headless Chrome driven over the DevTools Protocol
(Playwright is not installed on this machine), the api-server in production mode against a
**copy** of the live save, `unity-build/index.html?careerSaveId=9`, screenshot 8s after the
loader's `applied 4 of 4 player(s)` line. The eebb029 build, pulled back out of LFS at
`6b65af6`, gives exactly Rob's screen on SwiftShader and on the real GPU
(`WebGL2 | ANGLE (NVIDIA GeForce RTX 5080 … Direct3D11)`): 58.5% of the frame sky-blue,
0.0% sand-like, bottom half mean RGB (148,186,216).

**The suspected cause was tested and ruled out.** Rob's hypothesis was the editor-applied URP
migration committed as `1075031`, with Forward+ unsupported on WebGL.
- `PC_Renderer.asset` has `m_RenderingMode: 2` (Forward+) at both `766ebc1` and `1075031`, so
  the rendering path never changed. The strip flags (`m_StripUnusedVariants`,
  `m_StripUnusedPostProcessingVariants`, `m_ExportShaderVariants`) are 1 at both.
- The entire delta was eleven `m_Prefilter*` flags on `PC_RPAsset.asset`, a populated RID list
  in `UniversalRenderPipelineGlobalSettings.asset`, and field additions in
  `DefaultVolumeProfile.asset`.
- Option 1 — revert those three assets to `766ebc1` and rebuild — turned out to be a
  **no-op**. URP's pre-build prefilter pass rewrote all three back to the `1075031` values at
  07:30:56, before a single shader compiled (PC_RPAsset re-imported at log lines 8478/8534,
  URP/Lit compiled at 13956). After the build the three files are byte-identical to
  `1075031`. **The build that works was built with exactly the settings under suspicion.**

**What actually differs: the URP/Lit variant set.** Same scene, same 170 shaders compiled.
`Universal Render Pipeline/Lit`, pass ForwardLit, full variant space 181,193,932,800 in both:

| build | after settings filtering | after built-in stripping | shipped |
|---|---|---|---|
| eebb029 (`step7.log`, 11 Sep) | 1,228,800 | 4,800 | **160** |
| rebuild (`r40_build1.log`, 12 Sep) | 307,200 | 1,200 | **240** |

The broken build shipped a different keyword set for ForwardLit. Every Lit surface — sand,
venue, crowd, the Beach Girl materials — had no variant for the keywords the runtime asked for
and drew nothing, while Unlit geometry (court lines, UI) drew normally. *Why* the 11 Sep
build's keyword prefilter came out differently is **not proven**: both logs show the pre-build
pass re-importing PC_RPAsset. The likeliest explanation is that the 11 Sep batch build ran
while the Editor's migration state was still settling (it was committed as `1075031` only after
that build), but that is inference, not measurement.

**Which change fixed it: rebuilding from the current project state** (`1075031` plus the
settings the build derives). Not the `766ebc1` revert, which Unity undid before compiling, and
**not Forward (mode 0)**: the first rebuild rendered, so that fallback was never needed and the
renderer stays Forward+.

**Proof (new build, same harness as the control):**
- Real GPU: bottom half 0.6% sky-blue / 43.6% sand-like, mean RGB (207,188,164).
- SwiftShader: 0.6% / 43.5%, mean RGB (207,187,164).
- Loader, all four runs: `careerSaveId 9 (from page URL)`, four per-player `<-` lines with
  four skin bands, `applied 4 of 4 player(s)`. **0 console errors.**
- Screenshots: `proof/webgl_court.png`, `proof/webgl_court_gpu.png`,
  `proof/webgl_court_eebb029_control.png`, `proof/webgl_court_eebb029_control_gpu.png` in the
  Unity checkout. That folder is **gitignored by design** (as with the band renders), so
  they exist on this machine only. `ea6eb5e`'s message says it carries the screenshots; it
  does not.
- Build: `.data` 267,139,548 bytes (`.br` 215,452,766), `.wasm` 51,443,814 (`.br` 8,955,403).
- Harness: unity-match-state-payload 9/9, unity-career-scoping 15/15, fresh-install 40/40.

Unity `ea6eb5e` also commits what the build derived for itself (Mobile_RPAsset prefilter flags,
plus the WebGL batching entry and scripting defines in ProjectSettings), so the repo matches
what produced the working build. Left uncommitted: batch mode flipped
`UnityConnectSettings.m_Enabled` from 1 to 0 — a batch-mode side effect, not a decision.

**Rule going forward: a Web build is not done until it has passed the render proof.** A build
can load and run the sim while drawing nothing. The tooling is now in `scripts/webgl-proof/`:
`run.mjs` (boots the server against a save copy and drives Chrome; `R40_GPU=1` selects the
real GPU, `R40_PUBLIC_DIR` serves a control), `proof.mjs` and `stats.py`.

### R-38 — CLOSED (11 Sep, 39148cb)
`GET /unity/match-state` is career-scoped but read the career from the session, which
neither a WebGL iframe nor Unity Editor Play mode has — so the endpoint the Unity
loader exists to call could never be called successfully by it.

**Found:** the handler is documented "No auth required — Unity connects as an external
service", and then called `requireCareerSaveId(req.activeCareerSaveId)` in five places.
`activeCareerSaveId` only exists on a browser session, so any session-less caller got a
500 with `No active career. Player and staff state is career-scoped — this code path
needs req.activeCareerSaveId.` Confirmed live against the running app on the live save:
`GET /api/unity/match-state` returned HTTP 500 with that exact error in the server log.

Not a curl artefact, which is what makes it a real bug rather than a test nuisance: the
WebGL build runs in an iframe with no app session, and Editor Play mode has no cookie at
all. Both of the only two callers that will ever exist were locked out.

A second, quieter instance of the same fault sat in the match lookup: with no `matchId`
it took the newest match by status with **no team filter**, so in a database holding two
careers it could return whichever career's match happened to be most recent — the
cross-career bleed R-20 was about.

**Fix:** `?careerSaveId=N` wins; otherwise the session's active career; otherwise **400**
naming the problem. It deliberately does **not** fall back to "the first career in the
table" — guessing an owner is how R-20 showed one career another career's state, and a
400 beats a plausible wrong answer. An id that does not exist is 404, not a silent
fallback. The career is resolved once at the top and that value feeds all five
`loadPlayers` calls. The match lookup is now scoped to the career's own team, in both the
explicit-`matchId` and no-`matchId` paths.

`pages/court.tsx` passes `careerSaveId` (from `useListCareerSaves`'s
`activeCareerSaveId`) plus any `matchId` in the iframe URL, and waits for that query to
settle before mounting the iframe — mounting first and adding the id afterwards would
change `src` and reload the whole Unity build. This is the only management-side file the
Unity work was scoped to touch.

**Harness (done):** `harness/unity-career-scoping.mjs`, suite 9/17, 15/15. Two careers in
one database: `?careerSaveId=A` and `=B` each return 200 **with no session at all**, each
reporting its own club (`CareerA FC` vs `CareerB FC`) and its own match (ids 1 vs 63); no
id and no session is 400 with a message naming the problem; an unknown id is 404; and a
session with an active career still works with no id, resolving to the same career as the
explicit form.

Two of its assertions were wrong first and are worth recording, because both encoded a
false idea of the data model rather than a bug:

- It asserted A's and B's player **ids** were disjoint. They are not, and should not be:
  `players` is global reference data shared by every career and only
  `career_player_state` is career-scoped, so two careers seeded from the same starter
  pool legitimately pick the same top-rated rows.
- It then asserted all four returned players were on the career's team. Only two are. The
  away pair is staffed from the free-agent pool because every match's `awayTeamId`
  equals its own `homeTeamId` (R-29) and the true away side is an AI opponent (R-22);
  free agents have `team_id` NULL.

What it asserts now is the thing that actually proves scoping: every returned player has
a `career_player_state` row for **that** career, with the home pair on that career's team
and the away pair free agents.

**Still open, separate item:** nothing on the Unity side feeds `MatchManager`. The brief
assumed a `MatchManager.ReplitPlayerData` type; it does not exist in the Unity project
(`MatchManager.cs` there is the 30 June version and that type died with the lost August
work). `PlayerStatsData[]` is a live-stats accumulator MatchManager fills itself, so it is
an output. The loader feeds each player's `PlayerStats` and the appearance controller
instead. How ratings should reach `MatchManager` is a design question, not a defect.


### R-37 — CLOSED (10 Sep, d0316c5)
`match-tick-fallback-roster.mjs` asserts two DISTINCT away scorers, which is not what R-32
guarantees — it depends on the engine picking different players, and it flakes.

**Found:** R-32's bug was `loadFallbackPool`'s `isActive: true` filter returning zero rows, leaving
`awayRoster` empty. `pickPlayer([], stat)` then returns `undefined`, so every away point carried
`lastActionPlayerId: null` — a phantom opponent that won points but never had a name. What the fix
guarantees is that the away side is a real, staffed pair and its points are credited to one of
them.

The suite asserted something stronger: that 2 distinct away player ids were each credited with a
point inside a ~15-point window. Which of the pair gets credited is `pickPlayer()`'s stat-weighted
randomness, and it can favour one of them for a long run, so the assertion can fail with the engine
behaving perfectly. The suite's own comment already said exactly this about the home side, and set
the home bar at 1 for that reason — while leaving the away bar at 2 with identical exposure.

It duly flaked during R-36: one full-harness run sat out the entire 55s poll waiting for a second
distinct away scorer that never came, then failed. 3 runs alone and 2 further full runs passed.
Confirmed not caused by the R-36 change: that diff touches only the import, the launch and the
`finally` teardown, and the poll runs before any of the teardown.

**Fix:** assert the two things R-32 does guarantee, both deterministic.

1. The away side has two real players available to field. The roster the tick engine builds is
   in-memory and never persisted, so this is asserted against the pool it fills from, through the
   app's own `GET /players/free-agents` — the same `loadPlayers(..., { freeAgents: true })` that
   `loadFallbackPool` calls — rather than a hand-copied SQL query. Pre-fix that pool was
   unreachable behind the contradictory filter.
2. Away scored at least one point and it was credited to a real named player from that pool, with a
   separate check that NO away point was credited to nobody — naming the pre-fix symptom
   (`lastActionPlayerId` null) directly rather than inferring it from a scorer count.

The poll now waits for both sides to have a real scorer before asserting. An intermediate version
stopped as soon as away scored, which can be the very first point of the match, and then the home
sanity check failed on an empty set — one stochastic flake traded for another, caught in testing.
Each side winning one point in ~15 is overwhelmingly likely, and far weaker than needing the engine
to pick two different players on one side.

Also tightened a check that passed vacuously: `[...awayScorers].every(...)` is true for an empty
set, so "the away scorer is from the fallback pool" passed when there was no scorer at all. It now
requires a scorer to exist as well as being a real one. A check that passes when nothing happened is
how the original over-assertion sat here unnoticed.

**Proof:** sabotaged the fix under test — re-added `isActive: true` to `loadFallbackPool`, rebuilt,
and ran: 6/9, with "away scored at least one point, credited to a real named player" (7 away points,
0 scorers), "no away point was credited to nobody" (7 nameless away points) and the pool check all
failing. So the new assertions still catch the exact regression the old one did, and say plainly
what went wrong. Sabotage reverted and rebuilt before committing.

**Harness:** 9/9, run 6 times consecutively, 6-15s each (the flaky version ran up to 56s when it
hit the full poll deadline). Full harness 16/16.

### R-36 — CLOSED (10 Sep, 5dc9466)
The harness SIGKILLs the server it booted, so the database is left with an un-checkpointed WAL and
a read-only reader cannot open it. `reference-data-backfill` failed outright on this; three other
suites carried a sleep that was the same bug half-covered.

**Found:** every suite booted the server with `spawn(ELECTRON, [SERVER])` and stopped it with
`child.kill("SIGKILL")`. SIGKILL gives the server no chance to run R-31's shutdown path, so the
save is left in WAL mode with the session's last writes still in the `-wal` sidecar. A suite then
opening that file with `new DatabaseSync(file, { readOnly: true })` fails outright: replaying a
WAL requires creating the `-shm` index, which a read-only connection cannot do, and SQLite reports
it as a bare `disk I/O error` with no mention of WAL or permissions.

`reference-data-backfill.mjs:196` hit it every run on this machine — section D opens the database
read-only immediately after stopping the server. Confirmed pre-existing and unrelated to the work
it was found during (R-08/R-35): stashing that work, rebuilding and re-running reproduced the
identical failure at the identical line on clean `main`.

It was also already known about and worked around rather than fixed. `reference-data-update.mjs`,
`career-difficulty.mjs` and `fixture-transaction.mjs` each carried a 600ms
"a SIGKILL'd better-sqlite3 process can leave the -wal sidecar mid-write, give it a beat" sleep
before their read-only open — a race they happened to win most of the time, on the same bug.

**Fix:** the harness now quits the server the way the app does. R-31 already built that path — the
server listens on the fork's IPC channel for `{ type: "shutdown" }`, runs
`PRAGMA wal_checkpoint(TRUNCATE)`, closes the sqlite handle and exits 0 — and
`wal-checkpoint-shutdown.mjs` already proved it works. It just was not what the other suites used.

New `harness/server-harness.mjs` holds both halves: `forkServer()` (a real `fork()` with an `ipc`
channel, since the shutdown message has nowhere to travel on a `spawn()`ed child) and
`stopServer()` (sends the message, waits for the child's own exit, SIGKILL fallback if it never
comes). The fallback reports itself on stdout when it fires rather than passing quietly, because a
suite silently falling back to the old behaviour is how this stayed invisible. Ten suites plus
`run-all.mjs` now use it, and the three settle sleeps are gone — the graceful path has already
checkpointed the WAL away before `stop()` returns, so there is nothing to wait for.

This also makes the suites a truer test: the database they inspect is now a single complete file
with no sidecar, which is the state a player's save is actually left in after a real quit.

SIGKILL is deliberately kept in two places. `migration-fixtures.mjs` kills on purpose to simulate
a crashed process, and an orderly shutdown would destroy the thing it tests. And
`career-difficulty.mjs` / `fixture-transaction.mjs` keep a `try { kill } catch {}` in their
`finally` as a last-ditch cleanup after the graceful stop has already happened mid-test.

**Harness:** full harness 16/16 suites, ALL HARNESSES PASSED — first time it has been green end to
end. `reference-data-backfill` 8/8 on its own. The other nine converted suites were each run
individually after conversion and are unchanged in what they assert.

### R-35 — CLOSED (10 Sep, 4a37f2c)
Season rollover creates the new season but never generates its fixtures — they only appear when a
page happens to ask (dashboard repairs it silently); harness and any headless path see an empty
season.

**Found:** `rolloverSeason` (`utils/seasonRollover.ts`) completed the old season, aged / retired /
promoted, inserted the new `seasons` row, moved the calendar to 1 January — and stopped. It never
created the new season's fixtures. Only three things ever called `ensureSeasonFixture`:
`POST /careers` (hardcoded to 2026, so season 1 only) and the two read paths `GET /dashboard` and
`GET /matches/fixture`, both of which call it defensively. So for a player the bug was invisible —
opening the dashboard on 1 January silently built the missing fixture. For anything that never
opens a page it was total: the season stayed empty.

Found while verifying R-08, and it is R-08's root cause. The five-season harness advances the
calendar and plays whatever is scheduled; it never opens the dashboard, so seasons 2-5 had nothing
to play and walked through at 0W 0L. Proven by probe before any fix: after rolling into season 2
the fixture was absent, then appeared in full (62 rows, all `scheduled`) the moment
`/matches/fixture` was called.

**Fix:** the rollover builds the fixture itself, in the same transaction that creates the season —
a season and its fixture are one atomic thing, not a season plus whatever a later page visit
repairs. That needed the generator callable from inside an existing better-sqlite3 transaction,
which cannot `await`, so it moved to `utils/seasonFixture.ts` as the synchronous
`ensureSeasonFixtureRows(tx, team, year)`. `ensureSeasonFixture` in `routes/matches.ts` is now a
thin async wrapper opening a transaction around that same function, so its three existing callers
are untouched — one generator, four callers, not four generators. It lives in `utils/` to keep the
import graph one-directional (`seasonRollover` needs the generator, `matches.ts` needs
`seasonRollover`'s season-number helpers — leaving it in `matches.ts` would have been a cycle), and
the weather block it depends on moved with it to `utils/weather.ts`, byte-for-byte unchanged.

`routes/careers.ts` no longer passes a hardcoded `2026`: the year comes from the season row it just
inserted. Two independent literals could disagree, and a fixture generated for a year the season is
not in is invisible — `ensureSeasonFixture` filters by season year — which is the same
empty-season failure at the other end.

**Harness:** `harness/rollover.mjs` now asserts, per season and for both squads, that the season
arrived with its fixture already built. Read through `GET /matches`, which does NOT generate —
deliberately not `/matches/fixture`, which does, and would have repaired the very bug the check
exists to catch. Pre-fix that check fails for every season after the first; post-fix all 8 new
checks pass (37/37 in the suite). See R-08 for the measured arc.

### R-34 — CLOSED (9 Sep, 54f95d9)
Players added to the starter DB after a save was created never appear in
that save — R-28/R-33 deliberately skip player rows, so an updated game is
short players (8 of the 24 Europe players were missing from Rob's live save).

**Found:** R-28/R-33 (above) both only ever touch a row a save ALREADY HAS —
by primary key for insert, by column for update. A player row that exists in
the starter DB but not in a save at all was never inserted, and R-28's own
comment explains why players were originally excluded: "a missing
player/staff row needs a matching career_player_state row for every EXISTING
career save, which only seedCareerState() creates, only at career creation."
That's a real second problem, not just a missing-row problem — but it's one
`utils/migrateCareerState.ts` already solves for a brand-new career, so R-34
is "solve it the same way, one layer up," not a new mechanism.

**Fix — reused the exact code path, no second list:** extracted the
per-player `career_player_state`-row-seeding loop out of `seedCareerState()`
into its own function, `seedPlayerStateRows(tx, careerSaveId, playerIds)` —
same column defaults (age/salary/speed/power/defense/serve/block/stamina/
isDraftPlayer), same `onConflictDoNothing` safety, now callable for a subset
of players against ANY career, not just "every player, at creation."
`seedCareerState()` itself now calls it too, so there is exactly one place
this logic lives.

`ensureReferenceData()` (utils/ensureSchema.ts) gained a Pass 3: insert
missing `players` rows verbatim (same technique Pass 1 already uses for
locations/club_templates/outfits), then for every row in `career_saves` —
every existing career, not just the one this boot happens to be running for
— call `seedPlayerStateRows()` with just the newly-inserted ids.

**Deliberately NOT called: `seedCareerState()` itself, or its
`seedRegionalLeagueTx()`.** Both unconditionally INSERT a fresh regional
league season + 180 fixtures with no existence check — correct only at
brand-new career creation. Calling either against an existing, mid-season
career would have duplicated its league and fixtures. Confirmed by harness
assertion E (below), not just by reading the code.

**Spares stay parked, with no special case.** `player_type='spare'` rows are
inserted and seeded exactly like every other player — `seedCareerState()`
itself doesn't discriminate for a brand-new career either, so this matches.
They stay invisible for the existing reason: `isSeniorPlayer()`
(`utils/playerClassification.ts`) already excludes `player_type='spare'`
everywhere the market/squad screens read it. A second, bespoke "skip spares
here" rule would have been exactly the kind of second list this whole item
exists to avoid.

**Staff is out of scope.** The register item and its symptom (8 missing
Europe *players*) are about `players` specifically; `staff` still has no
insert-missing-rows path. Same gap, not fixed here — flag separately if
wanted.

**Harness (new, 15th suite):** `harness/reference-data-new-players.mjs`,
wired into `run-all.mjs` as 5/15, next to R-28/R-33's own suites. Boots a
save with one existing, already-played career, then reboots it against a
starter DB carrying 3 extra senior players (+1 spare) it doesn't have.
Asserts: (A) all 3 seniors appear as free agents for the career that already
existed before this boot, via the real `GET /players/free-agents`; (B) their
`player_v4` is copied byte-for-byte, not regenerated or left null; (C) the
spare is NOT in the free-agents list; (D) `career_player_state` exists for
all 4 (spare included), all free (`team_id` NULL); (E) the career's regional
league season/fixture counts are unchanged — proving `seedRegionalLeagueTx()`
was correctly not re-run. 9/9 checks pass. Full harness: 15/15 suites.

**Live save: verified, not just asserted.** Backed up
(`backup-r34-2026-09-09T04-45-04`), then booted directly against the repo
starter DB. Boot log: `inserted.players = [299..306]`, `seededIntoCareers`
lists all 8 ids under every one of the 5 existing career saves (ids 5, 6, 7,
8, 9 — none retired, none touched otherwise). Confirmed after: 276 total
players (was 268), all 8 have `player_v4`, all 5 careers show 8/8 new
players in `career_player_state`. No profile or career was deleted, renamed
or retired.

**Rob: please confirm on screen** — open the Player Market on any of your
existing careers (Sydney Riptide / R24 Check / R25 Check / rob / R28
Verify): Georgia Mears, Emily Harrison, Marta Hernández, Inês Moreira, Sanne
Keizer, Lieke Jansen, Lena Schneider and Leonie Müller should now all appear
as signable free agents.

### R-33 — CLOSED (9 Sep, c3e0e22)
R-28 only inserts missing rows, so renames and corrections to the starter DB (e.g. players 51 and
187) leave every player's save stale.

**Found — which columns gameplay writes, per table, checked not assumed:**
`scripts/check-write-boundaries.cjs` enforces that `players`/`staff` can only be written through
`lib/playerDto.ts`'s `updatePlayerReference()`/`updateStaffReference()` — "the ONLY sanctioned
write" — so grepping their call sites in `routes/` is exhaustive, not a guess:

- `PATCH /players/:id`, called from `pages/team.tsx`'s **"Edit" and "Change Nationality" buttons —
  a real, always-visible, unguarded feature on every roster player, not a debug tool** — writes
  `name, nationality, continent, position, potential`.
- `PATCH /staff/:id`, called from `pages/staff.tsx`'s own "Edit", writes `name, nationality,
  attributes, personality, specialty, specialTrait`.
- `locations`, `club_templates`, `outfits`: zero runtime writes anywhere — the only
  `update(...Table)` call site for any of the three is `seed.ts`, a one-time seed script, never a
  route. Every shared column is safe.

**This changes the fix, and the register's own example is not solved by it.** `name` — the exact
column players 51/187 were corrected in — is gameplay-writable via Edit Player, so syncing it from
the starter DB on every boot would silently erase a manager's own in-game rename the next time the
app starts: the same cross-career-bleed failure mode the `career_player_state` split was built to
prevent, reintroduced through a different door. So `name` (and `nationality`/`continent`/
`position`/`potential` on players; `name`/`nationality`/`attributes`/`personality`/`specialty`/
`specialTrait` on staff) are **excluded**. Concretely: **this fix does not make an existing save
show "Dewi Lestari" or "Eleni Papadopoulou" for players 51/187** — those specific renames need a
separate, one-off, targeted fix if still wanted on existing saves, not a blanket reference-sync
rule. Reported per rule 7 rather than forced through.

**Fix:** `utils/ensureSchema.ts`'s `ensureReferenceData()` gained a second pass. For
`locations`/`club_templates`/`outfits` (already inserted for missing rows by R-28), existing rows
now also get every shared column brought forward when it differs. For `players`/`staff` — never
inserted, per R-28's own reasoning (a missing row needs `career_player_state`/`career_staff_state`
too, not attempted here) — existing rows get ONLY the confirmed-safe columns synced:

- `players`: `base_age, height, speed, power, defense, serve, block, stamina, image_url,
  player_type, asking_price, is_draft_player, elite_event_type, career_seasons, career_titles,
  continental_titles, world_titles, olympic_medals_count, peak_overall_rating, years_active,
  legend_score, development, player_v4`
- `staff`: `role, base_salary, skill_level, image_url, base_age, overall_rating,
  coach_speciality, scouting_rating`

Column-by-column, never row-by-row: a row with nothing changed runs zero `UPDATE` statements, and
a row with one changed column writes exactly that one column, so a manager's own rename living
next to a genuinely stale `height` is never at risk of the whole row round-tripping.

**Harness (new):** `harness/reference-data-update.mjs`, wired into `run-all.mjs` as 4/14, next to
R-28's own suite. Does NOT test renaming a player, despite that being the register's own example —
see the harness file's own header comment for why. Proves, on one save with a real signed player
and real training progress: (A) a stale safe column (`players.height`) catches up to the starter
DB and the boot log names it; (B) `players.name`, stale in the exact same row, is left alone —
proving the gameplay-writable exclusion holds in practice, not just in the column list; (C) that
career's own `career_player_state.speed` (genuine gameplay-written state, unrelated storage
entirely) is completely untouched. 6/6 checks pass. R-28's own suite
(`reference-data-backfill.mjs`) still passes unchanged — its "existing row untouched" check
compares a live copy against itself, so there is nothing for the new update pass to find different.
Full harness: 14/14 suites.

**Rob: please confirm on screen** — this one has no on-screen surface by design (it's a boot-time
repair with no UI), so there is nothing to click through. If you want players 51/187's names fixed
on an existing save specifically, say so and it'll be a small, separate, one-off change — not
this mechanism.

### R-32 — CLOSED (8 Sep, 5dbe251)
`utils/match-tick-engine.ts:56` has the identical `freeAgents: true, isActive: true` filter
combination R-22 found and fixed in `routes/unity.ts` — a free agent can never be `is_active`
(only set true when a player is signed to a roster), so this fallback lookup returns zero rows,
unconditionally, every time it runs.

**Traced:** the loop never crashes and is not a numeric walkover — `sideRating([])` (in
`matchEngine.ts`) defaults to a flat 60 for an empty roster, so `awayAvg` was a real, average
value even with zero players, and `pointProbability(homeAvg, 60, ...)` gave a normal-looking
contest. What actually broke: `pickPlayer([], stat)` returns `undefined` for an empty roster, so
every point credited to "away" had `lastActionPlayerId: null` — a live-watched match had an
opponent that could win points but never had a name, exactly the same symptom R-22 found in the
Unity payload, just inside the live tick loop instead of the static payload.

**Fix:** same as R-22 — dropped `isActive: true` from `loadFallbackPool`'s query. Only this one
call site; `loadRoster` (for a team's own signed roster) correctly keeps `isActive: true` since a
real team's bench players (signed but not in the starting 2) should not be pulled in.

**Harness (done):** `harness/match-tick-fallback-roster.mjs` — creates a career (eager World Tour
fixture, so `awayTeamId === homeTeamId` on every match), starts the live tick loop
(`POST /matches/:id/watch`), and polls `GET /unity/match-state` until both sides have a real
scorer. **Amended by R-37:** it originally required 2 DISTINCT away scorers, which this fix does not
guarantee — that needs pickPlayer's stat-weighted randomness to pick different players, and it
flaked. It now asserts the away side has two real players to field (via `GET /players/free-agents`,
the pool `loadFallbackPool` draws from) and that away points are credited to one of them, with no
away point credited to nobody. Confirmed against the pre-fix code: 0 distinct away scorers, zero points
credited to any away player, in the same window. Wired into `run-all.mjs` as suite 7/12. Full
harness green: 12/12 suites.

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

### R-30 — CLOSED (8 Sep, b366ff6)
Seen on R28 Verify FC's World Tour Standings row at 0-0-0. Find where the seeded
`competitor_rankings` zero-row (R-26's `ensureCompetitorRanking`) or the standings page gets 9
and 1 from and make a fresh row read 0 : 0. Small; queue after R-23. Registered 8 Sep.

**Found:** `competitor_rankings` doesn't have goal columns at all — `GET /seasons/:id/ladder`
(`routes/seasons.ts`) computes them itself, unconditionally: `goalsFor: wins*2 + (teamId % 10)`,
`goalsAgainst: losses*2 + (teamId % 8)`. The comment above it already explained this was made
deterministic (from a `Math.random()` original) so the number wouldn't visibly change on every
request — it was never real per-match goal/set data, and there is no real per-match goal/set
data tracked anywhere in this schema to source it from. R28 Verify FC is team id 9: `9 % 10 = 9`,
`9 % 8 = 1` — exactly the "9 : 1" seen, regardless of the 0-0-0 record sitting right next to it.

**Fix:** when a competitor has played zero matches (`wins + losses === 0`), `goalsFor`/
`goalsAgainst` now read `0`. The teamId-derived formula is untouched for a team that has actually
played — redesigning "goals" into something backed by real data is a bigger job (new columns,
every match-completion write site) than this item asks for, and is not attempted here.

**Harness (done):** `smoke.mjs` section 18 — a fresh 0-0-0 career's own ladder row reads
`goalsFor: 0, goalsAgainst: 0`. Confirmed against the pre-fix code: the same fixture read
`goalsFor: 3, goalsAgainst: 5` (teamId 13 mod 10 / mod 8). Full harness green: 12/12 suites.

### R-22 — CODE-SIDE PART CLOSED (8 Sep, c84f1ea); UNITY-SIDE PART: ROB'S DECISION, see below

**Unity side, editor proof PASSED ON SCREEN (11 Sep).** Brief step 5 is done and
Rob verified it himself in the Editor on `BeachVolleyball V19.unity`: four players,
**four different skin tones**, the home pair in the club's own `#0a0` green and the
away pair in the red fallback, **animating in a live rally**. The loader fetched
career 9 over HTTP from an api-server Rob ran in his own cmd window.

That closes the loop this whole strand was about. The August symptom was "white
girls in grey bikinis" because skin and swimsuit were one mesh on one material; the
chain that now works end to end is: `player_v4.visual_identity.skin_tone` (a named
band) — `GET /unity/match-state?careerSaveId=9` (R-38) — `UnityMatchDataLoader`
— `BeachGirlAppearanceController` — a MaterialPropertyBlock per renderer on
multiply-tinted URP Lit materials. Four players, four tones, two kit colours, one
shared material each, no per-renderer material clones.

Still open on the Unity side: brief steps 6—8 (texture budget, WebGL export into the
repo, and the in-game proof). `MatchManager` still receives no squad data — see the
note in R-38.

Rob's requirement (7 Sep): every player must appear with **her own skin tone** and **her club's
bikini/kit colour** in the Unity 3D court, and this must match the management side. Today,
launching from the desktop shortcut and pressing "3D Court" shows the same pale model in a grey
kit for everyone. Rob believes the Unity project already has provisions for skin and kit
colour, so this is first a **pathway trace**, not a build job.

**Step 1 — management side.** `players.player_v4` (JSON) already carries exactly this, per
player: `visual_identity.skin_tone/hair_style/hair_colour/body_type/height_scale/face_variant`
and `visual_kit.top_primary_colour/...` (the latter's `kit_source: "card_image_colours"` —
derived from the player's own card art, NOT her club; not actually used by the payload, see
below). Coverage on the shipped DB: **252 of 276 players have a player_v4 block; 24 senior
players have none at all** — a real content gap, not a code bug (list below). `teams.logoColor`/
`secondaryLogoColor` is the TRUE club-kit source — collected from the manager at career creation,
populated for every real team (confirmed: all 6 teams on the live save). `outfits` (5 preset
templates) + `career_player_state.outfitId` (nullable, settable via `PATCH /players/:id/outfit`)
is a separate, optional per-player cosmetic override, currently not read by the payload at all —
untouched here, orthogonal to this requirement.

**Step 2 — real payload.** Dumped `GET /unity/match-state?matchId=126` for R28 Verify FC's own
career on the live save. It already computed `skinTone` from `player_v4.visual_identity` and
`primaryColor`/`secondaryColor` from the player's **current** `teamId` → `teams.logoColor`/
`secondaryLogoColor` at request time (not a stored per-player value) — correctly satisfying the
triage note 3y (skin tone stays with the player; kit colour follows whichever team she's
currently on) already, with no changes needed. But the payload held only **2 players total, both
on the home side** — the away side was completely empty.

**The break, found and fixed:** every match-generation site in this codebase sets
`awayTeamId: team.id` — literally the home team's own id; there is no code path anywhere that
ever creates a match with a genuinely distinct away team row (R-29 already documents this: World
Tour opponents are name strings, not competitor rows). `/unity/match-state`'s fallback for that
case — fill 2 away slots from the free-agent pool — filtered `freeAgents: true, isActive: true`.
A free agent can never be `is_active` (that flag is set true only when a player is signed to a
roster, in `seedStartingSquad.ts`; confirmed on the live save: 0 of 265 free agents have it, all
3 signed players do), so the query returned zero rows, unconditionally, for every career, every
time. The away side of the payload was empty for every match in the game.

**Fix (entirely server/payload-side, no data field or Unity change needed):** dropped the
`isActive: true` filter from that one free-agent query in `routes/unity.ts` — free agents don't
need to be "active" (signed) to stand in as filler opponents. Payload now carries 4 players.

**Sibling finding, NOT touched here (stay-scoped):** `utils/match-tick-engine.ts:56` has the
identical `freeAgents: true, isActive: true` combination, in the actual match SIMULATION engine's
own fallback-player lookup — a separate, more central concern than the Unity payload, worth its
own register item and its own harness proof; flagging it here rather than silently fixing it
under R-22's commit.

**Step 3 — Unity side.** `UnityMatchDataLoader.cs` does not exist anywhere in this repo — grepped
for every `.cs`/`.unity` file, none exist. `artifacts/beach-volleyball/public/unity-build/`
holds only the compiled WebGL export (binary `Build/*.data`, `*.wasm` — 700+ MB, not
meaningfully inspectable as source); `pages/court.tsx` only knows that path, with no reference
anywhere to where the actual Unity Editor project/source lives. **This is the boundary — Rob:
where does the Unity project live, and can you (or whoever has it open) confirm
`UnityMatchDataLoader.cs` reads `skinTone`/`primaryColor`/`secondaryColor` from the JSON and
applies them to the rendered models?** Nothing in this repo can answer that. `pages/court.tsx`
was not touched — the payload fix needed nothing from it.

**24 players with no `player_v4` — Rob's decision, not fixed here:** the field exists; the DATA
doesn't, for these 24 (first 10 of 24, all `player_type = senior`): Valentina Reyes, Gabriela
Santos, Yaritza Mendez, Amara James, Priya Persaud, Nia Campbell, Amara Odhiambo, Sofia Rivera,
Isabela Cruz, Camila Santiago. Whatever content-generation process produced the other 252
players' `visual_identity`/`visual_kit` blocks presumably needs to run for these 24 too — not a
decision for this session to make unilaterally (assigning skin tone/hair/kit values to named
characters is content, not logic). Until backfilled, one of these 24 can legitimately be drawn
into a match's away-fill slots and show up with no skin tone data for Unity to use.

**Harness (done):** `harness/unity-match-state-payload.mjs` — creates a career (eager World Tour
fixture, so `awayTeamId === homeTeamId` on every match, the exact shape that was broken), hits
`/unity/match-state` for one of its own matches, and asserts: 4 players (not 2); `skinTone` passes
through exactly when the source `player_v4` has it — never dropped, never invented (a
pass-through property, not "100% of players have data," since that 24-player gap is real and not
mine to paper over); of the players with real skin tone data it genuinely differs; the 2 home
players' kit colour matches their team's own `logoColor`/`secondaryLogoColor` exactly. Confirmed
against the pre-fix code: fails at "4 players" (only 2). Wired into `run-all.mjs` as suite 6/11.
Full harness green: 11/11 suites.

**Proof status:** the code-side fix is verified server-side (payload dumped, harness green). The
brief's actual proof line — "a real match in the Unity view with two visibly different players in
their club's colours, plus the payload that produced it. Screenshot." — needs the Unity Editor
project this repo does not contain, so it cannot be completed from here. `pages/court.tsx` untouched.

### R-27 — CLOSED (9 Sep, e3106f6)
Flagged by Claude Code during R-19: the schema-drift / cascade guard only checks tables keyed
by `careerSaveId`; tables keyed by `teamId` (e.g. `competitors`) are not covered, so a future
table could be orphaned by a career delete without the harness noticing.

**Found:** the guard is `scripts/check-write-boundaries.cjs`'s static cascade-drift check — it
scans the drizzle schema for any table declaring `careerSaveId`, and fails the build if that
table's export name isn't named anywhere in `deleteProfile.ts`. Checked every table in the
schema that declares `teamId` (24 declarations, 23 distinct tables) against `deleteProfile.ts`
directly: **all 23 are already handled today** — this was a preventive gap, not a live bug, same
as the register's own framing (R-19's `competitors` case already got fixed at the time; only the
guard's COVERAGE stayed narrow).

**Fix:** the drift check now also flags any table declaring `teamId` whose export name isn't in
`deleteProfile.ts` — a team belongs to exactly one `career_save`, so `teamId` scopes a table to a
career just as tightly as `careerSaveId`, one hop removed. One unified check now covers both
fields rather than two separate passes.

**Harness (done):** `guard-selftest.mjs` section 2b — a fake `some_team_scoped` table (declaring
`teamId`) is synthesised into a throwaway schema copy; the guard must reject it while
`deleteProfile.ts` doesn't mention it, and accept it once it does (negative control), mirroring
the existing `careerSaveId` sabotage test exactly. Confirmed against the pre-fix guard: it
silently accepted the unhandled `teamId` table. Full harness green: 12/12 suites (via the
existing `guard-selftest.mjs` suite, already wired into `run-all.mjs` — no new suite needed).

### R-07 — Invariants: I1, I5 failing; I2, I6, I8, I9 hard-coded not measured
`docs/economy-design.md:567-596`; `harness/invariants.mjs:313` (I1), `:344-383` (I5),
`:400-437` (literal verdicts for I2/I6/I8/I9). I5: best squad 38.3 pts vs Gold threshold 40 —
a settings DECISION for Rob, not a code change. I1: wages 2.00× vs income 1.32×. I2/I6/I8/I9
are blocked on nothing now — R-08, R-09 and R-11 are all closed, and R-08 leaves a
measured five-season arc for a strong and a weak squad (see its table) to judge I8/I9 against.

### R-08 — CLOSED (10 Sep, 4a37f2c)
`harness/rollover.mjs` walks 5 seasons at 0W 0L. Make it simulate real fixtures for a strong and
a weak squad across the whole arc so I8/I9 become measurable.

**Found:** two faults, one in the game and one in the harness.

The game's is R-35 — the rollover never generated a season's fixtures, so seasons 2-5 had nothing
to play. That is the whole of the "0W 0L": the harness was not failing to play matches, there were
no matches to play.

The harness's own fault was the measurement. The first cut asserted only "more than zero matches
played", counting `status === "completed"` rows from `GET /matches` — which is `.limit(50)`
(`routes/matches.ts`). The counter saturated at 50, both squads reported exactly "50 matches
completed", and the section passed 32/32 while three of its four seasons ran completely empty. A
count that cannot tell 50 from 62 from "capped" is not a measurement, and a check for "at least one
season" cannot notice that the rest of the arc did nothing.

**Fix:** R-35 on the game side. On the harness side, matches played per season now comes from the
win/loss delta on `GET /team` — uncapped, non-generating and exact, because every completed
fixture credits exactly one win or one loss, forfeits included. The season length it is measured
against is read once from the season-1 fixture rather than hardcoded, so `worldTour.ts` stays the
authority on how long a season is. Per season, for both squads, the harness asserts the fixture was
already built before anything asked for it, the full fixture list was played, and no season was a
walkover — plus that all four boundaries were measured, not "at least one".

Every match is played through `POST /matches/:id/simulate`, the same engine the player uses, so
wins, losses, ranking points and prize money all move for real. Forfeit is the fallback only for a
World Final reached after losing the Semi, which `simulate` legitimately refuses and which a real
squad in that position could not play either.

**Measured — five-season arc, real fixtures, strong vs weak squad.** "Strong" and "weak" reuse
R-11's difficulty mechanism rather than inventing a second one: ESTABLISHED signs the strongest
available free agents, UNDERDOG the weakest (`utils/seedStartingSquad.ts`). Both squads played
62/62 every season. The match engine is stochastic, so this is one run, not a fixed expectation —
and per the item it is MEASUREMENT ONLY: nothing here is asserted against a target or tuned.

| Season | Strong (ESTABLISHED) | Weak (UNDERDOG) |
|---|---|---|
| 1 (2026) | 48W 14L · 62/62 · 94 pts · Gold · $1,341,664 | 38W 24L · 62/62 · 33 pts · Silver · $835,015 |
| 2 (2027) | 27W 35L · 62/62 · 14 pts · Bronze · $2,128,089 | 24W 38L · 62/62 · 18 pts · Silver · $1,617,715 |
| 3 (2028) | 21W 41L · 62/62 · 11 pts · Bronze · $2,794,894 | 20W 42L · 62/62 · 12 pts · Bronze · $2,242,320 |
| 4 (2029) | 18W 44L · 62/62 · 11 pts · Bronze · $3,398,639 | 21W 41L · 62/62 · 17 pts · Silver · $2,888,300 |

Starting budgets: ESTABLISHED $500,000, UNDERDOG $150,000. Season 5 is terminal and has no review,
so four seasons are measurable out of the five-season arc.

**For Rob, not acted on here** (I8/I9 are R-07's to judge): both squads decline sharply after
season 1 — strong 48W to 18W, weak 38W to 21W — while the balance rises every season
regardless. Ranking points collapse from 94 to 11 for the strong squad, so a Gold-tier first season
becomes Bronze for the rest of the arc. Whether that is the intended difficulty curve or an ageing /
squad-refresh problem is a design call, and the numbers above are what it should be judged on.

**Harness:** `harness/rollover.mjs`, 37/37 (29 pre-existing + 8 new). Full harness 15/16 suites —
`reference-data-backfill` fails, which predates this work and is unrelated to it.

### R-09 — CLOSED (9 Sep, 492b590)
`isJobAtRisk` / `boardConfidence` computed server-side, zero frontend consumers.
`pages/manager-contract.tsx` still runs on `PLACEHOLDER_CONTRACT`. Wire an at-risk banner +
confidence meter to the dashboard, escalation ladder on the contract page, career ends at zero
confidence; then replace the placeholder contract with a real endpoint.

**Found:** `utils/board-confidence.ts`'s `buildBoardConfidenceResult` computed `score`
(`rawScore` + a finance adjustment from `team.budget`) and `isJobAtRisk` (`score < 15`) from
`team.boardConfidence`, itself only ever written by `routes/matches.ts`'s win/loss deltas
(+3/+5/+8 win, -5 loss). The one consumer was `GET /board-confidence` — and grepping the whole
frontend for `board-confidence`/`boardConfidence`/`isJobAtRisk` found zero references. The number
was computed correctly every match and read by nobody. `manager-contract.tsx` did already show a
warning banner and a confidence bar (added in `68de3bd`, before this register item existed) but
had no escalation ladder, no gate, and no career-ending consequence — and the dashboard had none
of it. A partial, separate "fired" mechanic existed in `matches.ts`, gated to fire only after the
season-ending Grand Final, and only *disconnected* the manager from the club (`career_saves.team_id
= null`) rather than ending the career — the save stayed alive, re-appliable from the Job Market.
That is not what "career ends at zero confidence" asks for.

**Fix — escalation ladder, same score thresholds the warning text already drew (5/15/30):**
`utils/board-confidence.ts` gained `stageForScore` (`safe` / `warning` / `spending_blocked` /
`forced_sale_pending` / `sacked`) and `isSpendingBlocked`. `BoardConfidenceResult` now carries
`stage` and `spendingBlocked`.

- **Spending blocked:** `checkSpendingAllowed(team)` gates the three real spending actions —
  `POST /contracts` (sign a player), `POST /staff` (hire), `POST /facilities/:type/upgrade`
  (upgrade) — each refusing with 403 before touching the request body.
- **Forced sale pending:** computed live in `GET /board-confidence` (not persisted) —
  `forcedSaleTarget` picks the highest-salary senior in the squad and the response carries
  `forcedSale: { pending, player }`. Deliberately visible-only ("pending"), not an auto-sell —
  the ladder's own name says the sale hasn't happened yet, and forcing one player's sale
  automatically raised more design questions (which player, what fee, can it be undone) than
  R-09 asked to answer.
- **Sacked:** `utils/careerLifecycle.ts` (new) extracts `buildCareerSummary` and adds
  `endCareer` — archives to Hall of Fame, writes a `dismissal` history entry, sets
  `career_saves.retired_at`, and clears the session. This is the same real termination
  `POST /careers/end` (voluntary retirement) already did — `careers.ts` now calls the shared
  `endCareer` too, so there is one way a career ends, not two. The old Grand-Final-only,
  disconnect-only "fired" check in `matches.ts` is replaced: the sacked-check now runs after
  **every** match result and every forfeit (not just the season finale — "sustained
  underperformance ends the career early" per §5, not "only in December"), and calls the same
  `endCareer`. `GET /board-confidence` performs the identical check on every read, so a career
  ends the moment ANY page — dashboard, contract page, or a live match result — observes zero
  confidence, rather than waiting for the player to stumble onto the right screen.

**UI:** `WarningBanner` and `BoardConfidenceBar` extracted from `manager-contract.tsx` into
`components/career/board-confidence-widgets.tsx` (shared, not duplicated — matches R-13's own
"share, don't patch" precedent) plus a new `ConfidenceLadder` (four-step stepper, current stage
highlighted). `dashboard.tsx` now shows both the banner and the meter whenever confidence is
below "safe". `manager-contract.tsx` shows the meter plus the ladder always, banner when
warranted.

**PLACEHOLDER_CONTRACT replaced:** new `GET /careers/contract` returns `clubName`, `season`,
`status`, `salary`, `releaseFee` — every field genuinely real. `releaseFee` was already real
(`BREAK_CONTRACT_FEE`, quoted and charged identically). `salary` is new:
`computeManagerSalary(managerReputation)` (`$2,000 + $80/rep point`) — this game has no
contract-negotiation system to derive a real salary from (R-12 removed the stub UI for one), so
rather than invent one, salary now moves with the one real per-career number that already stands
in for a manager's standing. The placeholder's `startSeason`/`endSeason`/`yearsRemaining`/
`fanApproval`/`objectives` are **removed**, not replaced — none of those are backed by any real
data model, and R-09/§5 never asked for a contract-length or fan-approval system.

**Career-end screen:** new `pages/career-end.tsx`, deliberately a **top-level route** (outside
`AuthGuard`/`Shell`) — `AuthGuard` hard-redirects to `/` the instant it notices no active career,
which would bounce a screen mounted inside it before the player ever saw it. Reads its own data
(`GET /careers/history`, needs only the logged-in user) rather than depending on navigation
state, so it renders correctly regardless of which page's read triggered the sacking.
`matches.tsx`'s existing dismissal dialog and the forfeit handler now route here instead of
`/career`.

**Harness (new, 13th suite):** `harness/board-confidence-ladder.mjs`, wired into `run-all.mjs` as
11/13. Same reasoning as `fixture-transaction.mjs`'s own sabotage approach — the ladder's stage
boundaries are read-time arithmetic, so direct writes to `teams.board_confidence`/`budget` via
`node:sqlite` land exactly on each boundary, deterministically, without a dozen-plus RNG-driven
match simulations per stage. Drives and asserts every stage in order: safe → warning →
spending_blocked (asserts `POST /contracts` refused 403) → forced_sale_pending (asserts a named
forced-sale target is queued) → sacked, the last transition driven by a **real**
`POST /matches/:id/forfeit` call (not a direct write) specifically to prove the fail state fires
from live gameplay through `matches.ts`, not only from the read endpoint. Also proves a healthy
budget alone cannot reach the worst two stages (the +5 finance adjustment floors the read-time
score at 5). After sacking: confirms `GET /careers/summary` and `GET /board-confidence` both
404 (no active career), `career_saves.retired_at` is set, a `dismissal` history entry exists, and
the run was archived to Hall of Fame. 20/20 checks pass. Full harness: 13/13 suites.

**Rob: please confirm on screen** — play (or forfeit) matches until board confidence drops: the
dashboard should show an at-risk banner and confidence meter once it's below "safe"; Manager
Contract should show the same plus the four-stage ladder with the current stage highlighted, and
its Contract Terms should show a real salary (not "$5,000") with no fan-approval or season-goals
section; attempting to sign/hire/upgrade while "Spending Blocked" or worse should be refused with
an explanation; at zero confidence the next match or page load should land on a dedicated
"You've Been Sacked" screen, not silently return to the dashboard.

### R-10 — AUDITED (12 Sep): full report in `docs/r10-audit.md`; three design-doc rows still missing
`docs/economy-design.md:840-848, 868-878`: no Rankings page, no Career Result page, no
Underdog/Established start choice. Qualification / Tier status / Finals bracket / Fail state
are "extend existing page" — open each and confirm whether done.

**Audit done, read-only; no code changed for this item.** `docs/r10-audit.md` covers every page
file: what it shows, what feeds it, and what is dead, duplicated or fake. Design-doc rows:

| Row | State |
|---|---|
| Finals | **Built** — R-29 made it a real bracket (seeds, both semis, final, champion) |
| Season end | **Built** — `season-review-dialog.tsx` |
| Start (Underdog / Established) | **Built** — R-11 |
| Ranking screen | **Not built.** `GET /seasons/ranking` has no frontend consumer. R-29's standings show every club's points and position; nothing shows points per event |
| Qualification per event | **Not built.** `GET /matches` sends `eligibility` with every fixture; nothing renders it |
| Tier status | **Not built** |
| Career Result | **Not built.** `career-end.tsx` is the sacked screen only; a completed five-season career has no result screen |
| Fail state | **Partly, not verified stage by stage** — board confidence is read by `dashboard.tsx` and `manager-contract.tsx`, not `finances.tsx` |

The audit's own findings that are repairs are registered below as their own items. Those that are
design calls (the 76-vs-62 season length and All-Star remnants; the Olympic qualification rule
disagreeing with the rules page) are questions for Rob in `docs/WEEKEND-STATUS.md`.

**Also for this audit (found during R-08, not chased):** the code described a "76-event season
fixture (72 regular/continental + 4 World Finals)", but `data/worldTour.ts` holds 62 events — 60
non-finals plus exactly 2 finals (World Semi Final, World Final). There is no "All-Star Match" row
at all, though `FINALS_TIERS` and the finals insert still special-case one. So a season is 62
matches, not 76, and the comment figures were stale by 14. Whether 62 is the intended season
length or 14 events went missing is a design question, which is why it sits here rather than being
"fixed" either way. The stale comments in `routes/matches.ts` were corrected to stop naming a
count; `FINALS_TIERS` and the All-Star branch were left alone pending this call.

### R-11 — CLOSED (9 Sep, 6079343)
Underdog vs established at career start. `pages/new-career.tsx` sends the same payload
regardless; `routes/careers.ts` has no concept of it. Add to wizard → store on career save →
seeding reads it (budget, tier lock, starting squad). Invariant I6 hangs off this.

**Found:** confirmed exactly as stated — `new-career.tsx` and `career-management.tsx`'s
`NewCareerModal` (R-13 already made them share nationality/crest fields via
`career-wizard-fields.tsx`) both sent identical payloads regardless of any difficulty choice,
because there was no field to choose one. `careerSavesTable` had no column for it.
`seedStartingSquad.ts`'s own comment already named this: "the difficulty choice (R-11) that
would size this properly isn't built yet, so this signs the weakest available free-agent
seniors."

**The doc gives no numbers — four picked, named constants, in `utils/careerDifficulty.ts`:**
`docs/economy-design.md` states the FEEL ("tight from the first week... Bronze-locked" vs
"comfortable but not rich... starts roughly one tier further along") but never a dollar figure
or a ranking-points figure. Per the rule, these are invented and flagged, not derived:

| Constant | Value | Why |
|---|---|---|
| `UNDERDOG_STARTING_BUDGET` | $150,000 | "tight from the first week" |
| `ESTABLISHED_STARTING_BUDGET` | $500,000 | unchanged from the pre-R-11 flat default — already "comfortable" by every existing calibration in this repo |
| `ESTABLISHED_STARTING_RANKING_POINTS` | 20 | clears Silver's threshold (15) without also clearing Gold's (40) — "one tier further, not two" |
| UNDERDOG's ranking points | 0 (the column default) | naturally Bronze-only against the same thresholds — "Bronze-locked" falls out of the existing tier-gate system for free, no new gating code |

Starting squad quality needed **no invented number**: `seedStartingSquad.ts` already picks from
the free-agent pool sorted by overall rating. UNDERDOG keeps the existing weakest-first sort;
ESTABLISHED sorts strongest-first. "Best available" vs "worst available" is exactly what the
doc's contrast asks for, from a pool that already exists.

**Fix:**
- `career_saves.difficulty` (text, default `"established"` — existing saves keep the pre-R-11
  feel they already had). Added to the drizzle schema; `ensureSchema.ts`'s derived boot-repair
  and the shipped starter DB both carry it.
- Both wizards gained a `DifficultyPicker` (new, in the shared `career-wizard-fields.tsx`) —
  two cards, wording taken directly from the design doc's "What the player should feel," not
  paraphrased. Required to advance past step 1, same as nationality.
- `POST /careers` now **overrides** the client-sent `budget` with `startingBudgetFor(difficulty)`
  — the club-selected `startingBudget` field on `club_templates` no longer determines a new
  career's starting money once a difficulty is present. A deliberate simplification, not an
  oversight: the design doc frames difficulty, not club choice, as the budget lever ("starts
  roughly one tier further along, not with more time"). Flagged here in case club-varied budgets
  were still wanted alongside this.
- `ensureCompetitorRanking` gained an optional `initialRankingPoints` parameter (default 0 —
  every other call site, including the dashboard.ts repair-net call, is unaffected).
- `seedStartingSquad` gained a `difficulty` parameter (default `"established"` for any caller
  that predates this).

**Out of scope, deliberately:** the design doc's "Difficulty multiplier: UNDERDOG x1.5,
ESTABLISHED x1.0" on career score is Phase 6/R-10 territory (the Career Result screen doesn't
exist yet) — `difficulty` is stored and ready for it, not consumed by it here.

**Harness (new):** `harness/career-difficulty.mjs`, wired into `run-all.mjs` as 13/16. Creates
one UNDERDOG and one ESTABLISHED career in the same session (each sending a deliberately wrong
client-side `budget` to prove the server ignores it and decides by difficulty instead). Asserts:
budget is exactly the two named constants, not the client figure; `career_saves.difficulty`
stored correctly for each; UNDERDOG's ranking points are 0 (Bronze-locked, below Silver's 15);
ESTABLISHED's are ≥15 and <40 (Silver clear, Gold not); ESTABLISHED's starting squad average
rating is strictly higher than UNDERDOG's (86.6 vs 62.3 in the run that produced this entry).
12/12 checks pass. Full harness: 16/16 suites.

**Rob: please confirm on screen** — open New Career (title screen) and Career Management's
"+" on an empty slot: step 1 should now show an Underdog/Established choice with the two
descriptions above, required before Choose Club is enabled. Creating one of each should show a
visibly different (and, for Established, visibly stronger) starting squad and a different
starting budget on the dashboard.

---

## LOW

### R-39 — electron:dev launched from a Claude Code background task dies within minutes
Not to be fixed now; recorded so nobody loses an afternoon to it again.

`pnpm run electron:dev` started as a Claude Code background task runs correctly for a
few minutes — serving pages, answering API calls — and then exits **cleanly** on its
own. Observed four times in one session, with run lengths from about a minute up to
853s. Every exit was orderly, never a crash:

```
[server] WAL checkpointed and database closed for shutdown
[shutdown] server child exited, quitting
[exited with code 0]
```

That `[shutdown]` line is `electron/main.js`'s own `before-quit` handler, so something
is *asking* Electron to quit rather than it dying — and R-31's checkpoint runs every
time, so the live save is never left with an un-checkpointed WAL. No SIGTERM, crash or
error appears anywhere in the logs.

The cost is real: it reads as a working server, then the next thing that needs it gets
`ConnectionError (0) Cannot connect to destination host`. That is exactly what
happened to the first Unity Play-mode attempt — the loader did everything right,
logged `careerSaveId 9 (from editorCareerSaveId Inspector field)` and the correct URL,
and failed on a port that had gone quiet minutes earlier. Step 5 only passed once Rob
ran the server in his own cmd window.

Most likely the background task's process group is reclaimed once the harness treats
the task as finished, which would make this a harness-lifetime quirk rather than an
app bug. Unproven from inside the session.

**Rule of engagement until fixed:** anything that needs the app alive while a human
looks at a screen — Rob starts it in his own terminal, and confirms
`http://localhost:4173/api/health` answers before pressing Play or taking a
screenshot. Claude may still launch it for short, self-contained API checks, but must
re-verify it is alive immediately before any measurement and never report "left
running".


### R-18 — CLOSED, absorbed into R-23 (8 Sep, bc06e91)
Decided 2 Sep: remove the World Tour Stops / Countries / Grand Final Prize pills and the
"Conquer X cities" tagline in `auth-guard.tsx` (~81-91). Keep "Build your dream team…" + START.
Done as R-23 section B: pills and the dead `world-summary` fetch that fed them removed; no
"Conquer X cities" text existed in the current codebase to remove (grepped, confirmed absent).
See R-23's entry above for full detail.

### R-12 — CLOSED (9 Sep, 8c497c3)
`pages/competition/medal-table.tsx:24` · `olympic-results.tsx:23` · `olympic-history.tsx:19,24`
· `pages/job-market.tsx:408` · `components/career/PoachingInbox.tsx:235` ·
`pages/manager-contract.tsx:518, 546`. Build or remove from nav.

**Found, all 7 confirmed, none built — removed:**
- `medal-table.tsx` / `olympic-results.tsx` / `olympic-history.tsx` — 3 whole-page stubs (each
  file's entire body was the "coming in a future update" card), reachable **two** ways: standalone
  sidebar routes (`App.tsx` + `shell.tsx`'s Olympics nav group) AND as 3 of `pages/olympics.tsx`'s
  6 tabs. Both paths removed; all 3 files deleted (nothing else imported them).
- `job-market.tsx:407-417` — a disabled "Negotiate" button per job card ("Salary negotiation
  coming in a future update"). Removed; `HandCoins` import (only used there) removed with it.
- `PoachingInbox.tsx:223-237` — a disabled "Negotiate" button + "Negotiate coming soon" caption
  on each poaching offer (register cited the exact "coming in a future update" phrase; the actual
  text here reads "Negotiations are not available yet" / "Negotiate coming soon" — same stub
  pattern, different wording, same fix). Removed; `MessageSquare` import removed with it.
- `manager-contract.tsx:518,546` — "Negotiate Contract" and "Request More Budget" were entire
  stub *modals*: clicking either ActionButton opened a dialog whose only content was a "coming in
  a future update" notice and an "OK, understood" button. Both ActionButtons and both modal
  blocks removed (`ModalKey` narrowed to `"resign" | "break"`, the two real actions);
  `Handshake`/`Wallet`/`Info` imports removed with them.

**Deliberately left alone, not in the register's 7:** `manager-contract.tsx:415,435` ("contract
system coming soon" / "full system coming soon" placeholder captions) and `profile.tsx:382`
("Placeholder — contract data coming soon") — these belong to R-14 ("Profile page hard-codes
manager salary... Resolves with R-09"), a different, unassigned register item tied to the R-07–
R-11 economy work this session was explicitly told not to touch.

**Proof:** frontend typecheck and build both clean (2245 modules, down from 2248 — the 3 deleted
files); full harness unaffected (server-side only): 12/12 suites. No new harness case — pure
frontend removal, nothing server-observable to regression-test, same as R-15/R-18.

**Rob: please confirm on screen** — Olympics sidebar group now has 3 items (Qualification /
National Squads / Schedule), `/olympics` has 3 tabs (Overview / Qualifying / Fixtures); Job
Market cards have 2 action buttons (View Club / Apply), no Negotiate; a poaching offer has 2
buttons (Accept / Decline), no Negotiate; Manager Contract's Actions list has 2 buttons (Resign /
Break Contract), no Negotiate Contract / Request More Budget.

### R-13 — CLOSED (9 Sep, 056b9d8)
`pages/career-management.tsx:264-276` payload omits `managerNationality` and `crestShapeIndex`;
wizard sends them. Check alongside R-25.

**Found:** not a payload bug so much as a missing UI feature — `career-management.tsx`'s own
wizard (`NewCareerModal`, ~360 lines) never had a nationality picker or a crest-shape/colour
picker at all (confirmed by R-25's earlier investigation). It duplicated `new-career.tsx`'s club
picker's continent-partition logic (both files' own comments already noted this: "the fact that
this logic existed twice is why fixing it once was not enough").

**Fix, per the register's stated preference — share, don't patch:** extracted the genuinely
reusable, chrome-independent pieces — the nationality list + searchable picker, the colour preset
list + picker, the crest-shape picker — into a new shared module,
`components/career/career-wizard-fields.tsx`. `new-career.tsx` now imports from there too (its
own inline copies of all five deleted) rather than each wizard carrying its own definitions that
can drift again. `NationalityPicker` takes an `accentClassName` so each wizard keeps its own
existing accent colour (`secondary` token vs. literal violet) — unifying colours was never part
of this item.

`career-management.tsx`'s `NewCareerModal` gained: a nationality picker in step 1 (now required
to advance, matching `new-career.tsx`'s `canStep1`), colour pickers + crest-shape picker + a live
crest preview in step 3 (seeded from the selected club's own colours, matching
`new-career.tsx`'s `advanceToStep3`). `buildSavePayload` and `handleCreate`'s type signature both
carry `managerNationality`/`crestShapeIndex` through to `POST /careers` now — the exact payload
shape `new-career.tsx`'s `handleSubmit` already sent. The two wizards' outer chrome (full page
with guard screens vs. modal, slot-1-only vs. multi-slot) were deliberately left as they were —
genuinely different use contexts, not duplication, and unifying navigation/guard logic carried
real regression risk to the first-career creation flow for no benefit this item asked for.

**Harness (done):** `smoke.mjs` section 19 — `POST /careers` with the exact payload shape the
fixed modal now sends (`managerNationality` + `crestShapeIndex` together) round-trips correctly
through `GET /careers/summary` and `GET /careers`. This does **not** fail on the pre-fix code —
the server already accepted and stored both fields correctly (`managerNationality` is sent by
every career-creation call already in this harness file); the actual defect was purely in the
frontend never collecting or sending them, which no suite here can regression-test — there is no
browser-automation harness in this repo, the same limitation R-15 and R-18 already noted. Frontend
typecheck and build both clean. Full harness: 12/12 suites.

**Rob: please confirm on screen** — open Career Management, create a career in an empty slot: step
1 now asks for nationality (required to continue), step 3 now offers primary/secondary colour and
crest-shape pickers with a live preview, seeded from the selected club's own colours.

### R-14 — CLOSED (9 Sep, 492b590)
`pages/profile.tsx` `PLACEHOLDER_SALARY = "$5,000 / season"`. Resolves with R-09.

**Fix, alongside R-09:** `utils/careerLifecycle.ts`'s `buildCareerSummary` now includes
`managerSalary` (`computeManagerSalary(managerReputation)`), so `GET /careers/summary` — already
the source `profile.tsx` reads everything else from — carries a real, per-manager salary instead
of the same hardcoded figure for every save. `profile.tsx`'s two `PLACEHOLDER_SALARY` usages
(the identity strip and the career-highlights row, including its "Placeholder — contract data
coming soon" caption) both replaced with the real value. No new endpoint needed — R-09's
`GET /careers/contract` uses the same `computeManagerSalary` for consistency between the two
pages.

**Harness:** covered by R-09's `board-confidence-ladder.mjs` and `smoke.mjs` section 19, which
already asserts `managerSalary` is present on `GET /careers/summary`'s response. No separate case
needed — this is the same field, same formula, same endpoint. Full harness: 13/13 suites.

**Rob: please confirm on screen** — Manager Profile's "Current Salary" (both the identity strip
and the Career Highlights row) should show a real dollar figure with no "Placeholder" caption.

### R-15 — CLOSED (9 Sep, dc24df7)
`pages/dashboard.tsx:927-931` — tile opens the career options menu. Relabel or remove.

**Found:** all 4 "Career Options" tiles ("Save Career", "Load Different Career", "Return to Main
Menu", "Game Settings") shared the exact same `onClick={() => setShowCareerOptions(true)}` —
every one of them opened the identical `CareerOptionsMenu` modal, regardless of which was
clicked. That modal genuinely contains "Save Career", "Load Different Career" and "Return to
Main Menu" as real items, so those 3 tiles are honest (if redundant) shortcuts into it. "Game
Settings" (described as "Audio, display & preferences") is not one of the modal's items — there
is no audio/display/preferences screen anywhere in this codebase to open (grepped for a settings
page/route: none exists). Clicking it silently delivered "Save Career / Load Different Career /
Return to Main Menu" instead of what its own label and description promised.

**Removed, not relabeled:** there is nothing real for it to correctly describe — the feature
doesn't exist — and relabeling it honestly ("opens Career Options") would just duplicate the 3
sibling tiles and the card's own header, which already says "Career Options — Save, load or
manage your active career". Grid changed from `sm:grid-cols-4` to `sm:grid-cols-3` to match.

**Proof:** frontend typecheck and build both clean; full harness unaffected (server-side only):
12/12 suites. No new harness case — this is a pure frontend JSX removal with no server-observable
behaviour to regression-test. **Rob: please confirm on screen** — the Career Options card now
shows 3 tiles (Save Career / Load Different Career / Return to Main Menu), no Game Settings tile.

### R-16 — CLOSED (9 Sep, d001a23)
`artifacts/api-server/src/package.json:12-13` still lists `@google-cloud/storage`. Delete it.

**Found:** a stray, stale duplicate of `artifacts/api-server/package.json` (the real one, one
directory up) — same `name`, missing scripts the real one has (`check:*`), and listing
`@google-cloud/storage`/`google-auth-library` as dependencies. `pnpm-workspace.yaml`'s
`packages:` glob is `artifacts/*` (one level), so this file — two levels deep, inside `src/` —
was never recognized as a workspace package at all; confirmed neither dependency is imported
anywhere in the actual server source. Genuinely dead, not load-bearing anywhere.

**Fix:** deleted. Full `pnpm run typecheck` and full harness both pass unchanged: 12/12 suites.
No harness case added — there is no behaviour to regression-test for removing a file nothing
referenced; the full typecheck/build/harness run itself is the proof nothing depended on it.

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
