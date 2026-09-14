# Release status — overnight batch (14 Sep 2026)

Written at the end of the unattended batch. Rules: `docs/REPAIR-REGISTER.md` rules of engagement —
never the live save, commit per item, decide-and-go on anything that is not game design. Every
number below comes from a run in this batch; nothing is estimated.

---

## 1. Done

| Item | Register | Commit | What changed | Proof |
|---|---|---|---|---|
| 1 | R-50 | `56c40ba` | Injured players cannot be selected (auto-selection, Unity, manual lineups); fitness scales a player's contribution 0.6–1.0; rest days recover (+2 fitness / −5 fatigue, injured +1 / −3); injuries heal weekly | condition 27/27 — 5,000 matches per fitness level: 66.0% / 36.3% / 14.9% wins at fitness 100 / 50 / 0 |
| 2 | R-42 | `06488d3` | Trophies written at the season boundary: World Champions, World Final runner-up, World Finals semi-finalist, Silver/Gold tier seasons; shown in the Trophy Cabinet and the season review | trophies 10/10: a fresh career has none; a champion season writes exactly "World Champions 2026" + its tier |
| 3 | R-43 | `b8f730a` | Deleted the invented world news, Manager Movements, the youth league, the Job Market, poaching offers, the Reputation Bonus card and re-rolled Olympic results (7 files, 2,850 lines, 9 endpoints, 6 tables). Club News now built only from real rows | fake-content-removed 11/11: nothing left in 490 source files or the bundle; an older save loses the tables and still deletes; every news item traces to its row |
| 4 | R-49, R-56, R-57, R-59 | `92d928e` | Test issues fixed properly: migration-fixtures waits for the server's "Server listening" line; the invariants probe plays a real career's draw; board-review keeps the monthly clock's first start; condition makes its rest-day player fit first | 62/62, invariants sweep runs to the end (2 pass, 0 fail), 58/58, 27/27 |
| 5 | R-58 | PENDING-R58 | Dashboard tier badge ("Silver tier · 58 pts") and the board's standing line ("Board expects: top 4 · Currently: 3rd · On track") | dashboard-standing 11/11 |

The full R-43 deletion list, and each item's reasoning, is in the register entry of the same name.

### Final full harness

**28/28 suites passed** (`node harness/run-all.mjs`, launched without `ELECTRON_RUN_AS_NODE`), with
every static guard and typecheck clean and the starter database matching the model (47 tables).

| # | Suite | Checks | # | Suite | Checks |
|---|---|---|---|---|---|
| 1 | guard self-test | 42/42 | 15 | board review | 58/58 |
| 2 | schema drift | 12/12 | 16 | world tour competitors | 38/38 |
| 3 | reference data backfill | 8/8 | 17 | world tour byes | 18/18 |
| 4 | reference data update | 6/6 | 18 | all-star removed | 12/12 |
| 5 | reference data new players | 9/9 | 19 | olympic qualification | 29/29 |
| 6 | save folder migration | 7/7 | 20 | starting contracts | 15/15 |
| 7 | wal checkpoint on shutdown | 7/7 | 21 | contract renewal | 23/23 |
| 8 | unity match-state payload | 9/9 | 22 | empty squad forfeit | 11/11 |
| 9 | unity career scoping | 15/15 | 23 | injuries and fitness | 27/27 |
| 10 | match tick fallback roster | 9/9 | 24 | season trophies | 14/14 |
| 11 | migration fixtures | 62/62 | 25 | invented content removed | 11/11 |
| 12 | fresh install | 40/40 | 26 | dashboard standing | 11/11 |
| 13 | fixture transaction | 3/3 | 27 | gameplay smoke | 75/75 |
| 14 | career difficulty | 15/15 | 28 | season rollover | 78/78 |

Standalone, not in run-all: `harness/invariants.mjs` runs to the end (2 pass, 0 fail, 5 baseline, 2
blocked).

Two failures earlier in the batch, both harness faults, both fixed and registered: R-57 (board-review
misread its clock start) and R-59 (condition's rest-day player hurt by a random injury). One more was
my own launch: the R-42 run inherited `ELECTRON_RUN_AS_NODE`, which the save-folder suite passes to
real Electron — launch run-all without it.

### Five-season table (season rollover suite, real fixtures)

Three established careers (the strongest starting squad) and three underdog careers (the weakest),
each played through five seasons on the real draw. Every season crowned a real champion from the
field. **Sacked: established 0 of 3, underdog 0 of 3.**

| Career | Season 1 | Season 2 | Season 3 | Season 4 | End |
|---|---|---|---|---|---|
| RollStrong (est.) | 33-23, #2, Gold, runner-up | 36-20, #1, Gold, **champion** | 37-19, #2, Gold, runner-up | 33-21, #5, Gold | complete |
| RollStrong2 (est.) | 35-20, #3, Gold, semi-final | 40-16, #1, Gold, **champion** | 29-25, #8, Silver | 43-13, #1, Gold, runner-up | complete |
| RollStrong3 (est.) | 34-21, #4, Gold, semi-final | 39-16, #2, Gold, semi-final | 28-26, #10, Bronze | 38-16, #5, Gold | complete |
| RollWeak (und.) | 17-37, #18, Bronze | 17-37, #17, Bronze | 18-36, #19, Bronze | 16-38, #17, Bronze | complete |
| RollWeak2 (und.) | 15-39, #18, Bronze | 28-26, #9, Silver | 19-35, #19, Bronze | 23-31, #15, Bronze | complete |
| RollWeak3 (und.) | 16-38, #18, Bronze | 16-38, #18, Bronze | 16-38, #19, Bronze | 16-38, #19, Bronze | complete |

Each season is 54–56 of 59 matches played: 57 World Tour rounds less 3 byes, plus the World Finals
for the four that qualify. R-50's fitness and injuries are live in every one of these seasons.

The board's season reviews for the established careers (the expectation is re-set at every draw from
that season's strength rank, so "top 4" can become "top 7"):
- RollStrong: met, met, met, **below** (5th against top 4), met.
- RollStrong2: met, met, **below** (8th against top 4), met, met.
- RollStrong3: met, met, **below** (10th against top 7), **below** (5th against top 4), met — champion
  in season 5.

No established career had a failed season or a strike in this run. R-55's open issue stands on its
own evidence (1 of 10 established careers sacked in the R-55 study), not on this table.

---

## 2. What Rob must check on screen

Start the app from your own terminal (R-39) and confirm `http://localhost:4173/api/health` answers.
On the **live save's first launch** with this build the server drops the six removed tables — the
log says `removed content dropped`. That is expected, once.

**R-50 — injuries and fitness**
1. Team page: each player card shows *Fitness N%* and *plays at M%*; an injured player reads
   *Injured — can't play*.
2. Dashboard, Next Match card: the pair that will play, their fitness, who is unavailable and why,
   and a forfeit warning when fewer than two are fit.
3. Matches page: the lineup picker will not accept an injured player.

**R-42 — trophies**
4. Play a season to its end (or open a career already past a boundary): the season review has an
   *Honours won* list when there is anything to list.
5. Club → Trophy Cabinet: *World Champions (World Final wins)*, *World Tour Silver / Gold tier
   seasons*, *World Final Runner-Ups*, *World Finals Semi-Finals*.

**R-43 — invented content gone**
6. Dashboard: *Club News* (no LIVE badge, no nations, dates are game dates); no *Manager Movements*
   panel; no poaching approach card.
7. Sidebar: no *Youth League*. Club → Overview: no *Youth* tab. Team → Youth: no *Development
   League* section. Career → Career Options: the contract card only, no Job Market.
8. Olympics → Schedule: *Projected draw*, no scores, no gold medallist.
9. Club → Hall of Fame (leaderboard): two info cards, no *Reputation Bonus*.
10. Delete a test profile (never *mary*): it still deletes.

**R-58 — dashboard**
11. Dashboard top: a tier badge (Bronze / Silver / Gold with points; hover shows the purse access
    tier) and the board's line — before the draw it is absent, between the draw and the first
    World Tour result it says *No World Tour result yet*.

---

## 3. Between this build and a Steam review copy

Honest, in the order it would have to happen. Nothing in this section was done in this batch.

### Packaging
- **Installer not rebuilt.** electron-builder 25 / Electron 32, NSIS, `oneClick: false`. The last
  documented installer is 641.5 MB (22 Aug). Every change since — R-17 through R-58 — has only run
  unpackaged. Follow `docs/packaging.md` in order: Unity `.br` compression, native `better-sqlite3`
  rebuild **before** `pnpm run build`, Bitdefender exclusions for `C:\build\vbe` and the NSIS cache,
  then `pnpm run electron:build`, then a silent install to a scratch directory and the verify steps.
- **Not code-signed.** No certificate is configured; Windows SmartScreen will warn on install.
- **Size.** ~640 MB, 98% of it one Unity asset file (`sharedassets0.assets`). The lever is the Unity
  project's texture and audio import settings, not the build.
- **Dev route shipped.** `/dev/generation-test` is still routed in the production frontend with a
  dead API behind it (R-10 audit finding 9).

### Steam
- **Nothing Steam exists in the repository**: no app id, no `steam_appid.txt`, no Steamworks SDK,
  no SteamPipe app/depot build scripts, no store configuration. The only mention is a comment in
  `electron/main.js`.
- **Upload.** SteamPipe (steamcmd with app and depot VDFs pointing at the packaged `win-unpacked`)
  has to be set up from scratch in a Steamworks partner account.
- **Auto-Cloud.** The whole save is one file: `%APPDATA%\Beach Volleyball Empire\volleyball-empire.sqlite`
  (R-23). On a clean quit the WAL is checkpointed and the database closed (R-31), so that file alone
  is the save. Configure Auto-Cloud on that one file and **exclude** `-wal` / `-shm`. Not verified:
  after a crash the last writes sit in `-wal`, and Steam would sync an older `.sqlite`.
- **Review copy.** Keys come from Steamworks once the app exists there. None of this can be tested
  from the repository.

### Known gaps in the game
- **Established clubs can still be sacked by variance (R-55).** 1 of 10 established careers over
  four seasons (target was near 0%). Options recorded in R-55: failed from 11th, rank by wins, or a
  confidence floor. Rob's call.
- **No Olympic tournament.** A projected draw only: no matches, medals or Olympic trophies (R-42, R-43).
- **Resign / Break Contract leave the save with no club.** The Job Market was the only way to another
  club and it was fabricated (R-43). Career Management (new or load) is the way on. Design call:
  build a real job market from real clubs, or make resigning end the career.
- **No youth intake** (triage 3w): the academy drains to 0 by the end of a five-season arc. No youth
  competition either (R-43).
- **Retirement is effectively off** (triage 3z): one senior retires in five seasons.
- **No Career Result screen** for a completed five-season career (R-10): the season-5 review dialog is
  the end. After a sacking, *View Career Result* goes to the sacked screen.
- **Design-doc screens not built** (R-10): Rankings screen, per-event qualification, tier status
  detail. R-58's badge is the only tier display.
- **Economy invariants (R-07)**: I1 *monotonic return* still violated — 0.97x → 0.67x → 0.63x → 0.55x
  → 2.58x; wages outpace income until a squad reaches Gold. I9 *money stays meaningful* violated.
- **Club News** does not list contract renewals: a renewal records no date.
- **Open design questions** (triage §3): AI club reserves (3a), a qualifying competition (3b).
