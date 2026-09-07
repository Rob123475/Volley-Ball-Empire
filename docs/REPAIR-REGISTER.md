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

### R-26 — New career has no fixtures until the Fixtures page is opened
Found during R-20. Fixture generation is lazy: it only runs on `GET /matches/fixture`, which
only the Fixtures page calls. So a new career's dashboard shows "No match — Schedule one", the
ladder is empty (`GET /api/seasons/:id/ladder` returns `[]`), and R-05's transaction only
matters if the player happens to visit that page. R-05 never made generation eager — the
register's earlier claim that fixtures are generated "up front" was wrong.
**Do:** generate the season's fixtures inside `POST /careers` (career creation), in the same
transaction R-05 built, so a career is never without a schedule. Delete the lazy path in
`GET /matches/fixture` if nothing else needs it — do not leave two generators.
**Proof:** harness: create a career and assert `matches` has rows for the team and the dashboard
returns a real `nextMatch` before any other request. Live save: the "R24 Check" career from
above shows a real next match and a populated ladder on first dashboard load. Screenshot.

### R-25 — New-career wizard saves the wrong manager name
Found during R-20. `career_saves.manager_name` for "R04 Check" is literally the string `"r"`
(the dashboard club banner shows it as the manager badge). The row is the right row; the value
was wrong at write time. Most likely the wizard field sends a stale/partial value or the wrong
field. Related: R-13 says the save-slot screen drops `managerNationality` and `crestShapeIndex`
— check both wizard paths (`pages/new-career.tsx` and `pages/career-management.tsx`) while here,
because they are near-duplicates (see economy-design.md "the club picker exists TWICE").
**Proof:** create a career named "R25 Check" through the title-screen wizard; SQL on the live
save shows `manager_name = 'R25 Check'`; the club banner shows it. Screenshot.

### R-21 — Profile with no career lands on a dead dashboard
Opening the "mary" profile from the picker goes straight to the dashboard with club "No Club
Selected" (badge "NCS") and the top bar stuck on "Loading…" indefinitely (3+ minutes). A profile
with no career must go to the title screen / START NEW CAREER wizard instead. Note R-20 deleted
the `getActiveTeam` fallback, so "no active team" now surfaces as a 404 — the title screen's
AuthGuard treats 404 from `/api/team` as "no career" (R-02 notes), so check why mary bypasses
it. Keep the "mary" profile on the live save — it is the repro; do not delete it.
**Proof:** open mary → title screen with START NEW CAREER. Screenshot.

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

### R-06 — Leaderboard crowns a fresh save "Champion" (partial)
Dashboard rank and ladder were rebuilt in R-20 (scoped to `competitor_rankings`). Still open:
`routes/leaderboard.ts:9-24` ranks from `teams` with no results gate and no career scope;
`pages/leaderboard.tsx:125, 190-198` renders the top row as Champion. Apply the same
`competitor_rankings` source + "no results yet" empty state.
**Proof:** harness: two careers, leaderboard for each contains only its own competitors; a fresh
career shows the empty state. Screenshot of a fresh career's leaderboard.

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
