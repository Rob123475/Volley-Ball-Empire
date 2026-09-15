# Release status — Rob's four design decisions (15 Sep 2026)

Written at the end of the batch that carried out Rob's decisions on R-55, R-60, R-61 and R-62, on top
of the overnight batch of 14 Sep (R-50, R-42, R-43, R-49/56/57/59, R-58 — section 1b). Rules:
`docs/REPAIR-REGISTER.md` rules of engagement — never the live save, commit per item, decide-and-go on
anything that is not game design. Every number below comes from a run in this batch; nothing is
estimated.

---

## 1. Done

| Item | Register | Commit | What changed | Proof |
|---|---|---|---|---|
| 1 | R-55 | `0bf9a71` | Closed by Rob's decision: the board's bands stay (established: top 4 met, 5th–8th a warning, 9th+ a strike, two strikes sack). 1 established career in 10 sacked over four seasons is intended | register entry; no code change |
| 2 | R-60 | `3267c4b` | Resign and Break Contract END the career through the sacking path with their own reason; the dialog says "This ends your career at <club>. There is no job market yet."; the save keeps its club; a clubless save an older build left is finished at boot; the finished screen names each ending | career-ends 12/12 |
| 3 | R-61 | `d5bbd96` | A real Olympic tournament in Olympic years (2028 for a 2026 career): the 12 qualified nations' real top-two pairs from any club, 4 groups of 3, quarter-finals, semi-finals, bronze and gold on the World Tour engine, 25 Nov (after round 70, before the World Finals); medals on the players' records, trophies for their club, Club News. The projected draw, the manager-picked squads with invented wildcards, `olympic_selections` and the Locations page are deleted | olympics-tournament 24/24; olympic-qualification 29/29; fake-content-removed 11/11 |
| 4 | R-62 | `8eb6bde` | Every rollover that opens a season brings the player's club 3 youth players: the youth template card, 16–18, ratings from the shipped youth's distribution, real names of the club's country and region; Club News; a dry academy says it found no one. Players a career creates are owned by it and no longer leak into later careers | youth-intake 22/22 |
| 5 | R-63 | `3bc6c70` | The academy holds 12: signing and the intake both stop there, and the Team page banner reads the same cap from the roster. Academy wages billed once, in the weekly wage run; the per-match charge deleted. A full academy costs $71,500 a season in wages (12 players, 52 weeks), plus 20% in staff costs on the wage bill | academy-cap-wages 17/17 |
| 6 | R-64 | `27fecd1` | Release build 0.9.0: the NSIS installer (336,203,636 bytes) and win-unpacked (557,170,430 bytes), installed and run from the install folder against the live save and on a first run | build chain 32/32; install proof in the register |

### Rob's questions, answered
- **R-61, the brief's harness line said 16 knockout matches.** Four groups of 3 with the top two to
  quarter-finals is 4 QF + 2 SF + bronze + gold = **8**, plus 12 group matches. Built and asserted
  as 8.
- **R-61, calendar.** Round 70 (23 Nov) is followed directly by the World Finals (27 Nov); there is no
  slot between. The Games are played on that transition, dated 25 Nov. No clash with any fixture.
- **R-61, nations with fewer than two eligible players:** 52 nations can field a pair; **2 cannot —
  Ireland and Portugal, one each.** Neither has qualified in any run. Rule applied, no invented
  players: such a nation gives its place to the next nation that can field two.
- **R-62, portraits.** 89 distinct portraits in `attached_assets` have no player row; tags are
  filenames only (45 country, 43 region, 1 malformed); every one is an adult senior card. By Rob's
  decision they are not used for youth — reserved for a senior free-agent refresh (V2). Intake cards
  are the youth template, so cards never run out.
- **R-62, how long the pool lasts.** The finite pool is names. After a five-season Brazil club used
  12, South America still holds **194 unused names — 64 more seasons of intakes of 3.**
- **R-62, "five rollovers produce five intakes".** A five-season career crosses 5 boundaries; 4 open
  a new season and bring an intake (2027–2030); the 5th ends the career. Asserted as 4.

### Final full harness

**31/31 suites passed** (`node harness/run-all.mjs`, launched without `ELECTRON_RUN_AS_NODE`), with
every static guard and typecheck clean and the starter database matching the model (50 tables).
**After R-63: 32/32**, the new suite 30 being *academy cap and wages* 17/17, every other suite at the
same count as below and the season rollover still 78/78 with no career sacked.

| # | Suite | Checks | # | Suite | Checks |
|---|---|---|---|---|---|
| 1 | guard self-test | 42/42 | 17 | world tour byes | 18/18 |
| 2 | schema drift | 12/12 | 18 | all-star removed | 12/12 |
| 3 | reference data backfill | 8/8 | 19 | olympic qualification | 29/29 |
| 4 | reference data update | 6/6 | 20 | starting contracts | 15/15 |
| 5 | reference data new players | 9/9 | 21 | contract renewal | 23/23 |
| 6 | save folder migration | 7/7 | 22 | empty squad forfeit | 11/11 |
| 7 | wal checkpoint on shutdown | 7/7 | 23 | injuries and fitness | 27/27 |
| 8 | unity match-state payload | 9/9 | 24 | season trophies | 14/14 |
| 9 | unity career scoping | 15/15 | 25 | invented content removed | 11/11 |
| 10 | match tick fallback roster | 9/9 | 26 | dashboard standing | 11/11 |
| 11 | migration fixtures | 62/62 | 27 | **career ends (R-60)** | 12/12 |
| 12 | fresh install | 40/40 | 28 | **olympic tournament (R-61)** | 24/24 |
| 13 | fixture transaction | 3/3 | 29 | **academy intake (R-62)** | 22/22 |
| 14 | career difficulty | 15/15 | 30 | gameplay smoke | 75/75 |
| 15 | board review | 58/58 | 31 | season rollover | 78/78 |
| 16 | world tour competitors | 38/38 | | | |

Along the way (all fixed before this run, none a game fault):
- The first Olympic runs were sacked for abandonment because the harness never renewed contracts.
- The club-honours check then found the club's players weren't in the field: first because their
  nations didn't qualify, then because USA's seniors are draft-pool players, not free agents.
- The intake harness first ran out of its day budget one season short.

### Five-season table (season rollover suite, real fixtures)

Three established careers (the strongest starting squad) and three underdog careers (the weakest),
each played through five seasons on the real draw. The academy intake (R-62) is live in every one of
these careers from season 2, and 2028 is an Olympic year. Every season crowned a real champion from
the field. **Sacked: established 0 of 3, underdog 0 of 3.**

| Career | Season 1 (2026) | Season 2 (2027) | Season 3 (2028) | Season 4 (2029) | End |
|---|---|---|---|---|---|
| RollStrong (est.) | 39-17, #2, Gold, runner-up | 37-19, #2, Gold, runner-up | 36-20, #2, Gold, runner-up | 40-16, #2, Gold, runner-up | complete |
| RollStrong2 (est.) | 37-18, #2, Gold, semi-final | 28-26, #11, Bronze | 40-16, #1, Gold, **champion** | 40-15, #2, Gold, semi-final | complete |
| RollStrong3 (est.) | 41-14, #1, Gold, semi-final | 38-18, #2, Gold, runner-up | 34-20, #5, Gold | 43-13, #1, Gold, **champion** | complete |
| RollWeak (und.) | 15-39, #19, Bronze | 23-31, #16, Bronze | 18-36, #17, Bronze | 19-35, #17, Bronze | complete |
| RollWeak2 (und.) | 18-36, #17, Bronze | 16-38, #19, Bronze | 26-28, #9, Silver | 11-43, #19, Bronze | complete |
| RollWeak3 (und.) | 19-35, #16, Bronze | 20-34, #17, Bronze | 17-37, #19, Bronze | 15-39, #19, Bronze | complete |

Each season is 54–56 of 59 matches played: 57 World Tour rounds less 3 byes, plus the World Finals
for the four that qualify. Balances still rise every season with the intake's academy wages
(RollStrong $1.13M → $3.97M; RollWeak $451K → $1.20M).

The board's season reviews for the established careers:
- RollStrong: met in all five (2nd, 2nd, 2nd, 2nd, 3rd against top 4).
- RollStrong2: met, **failed** (11th against top 4 — a strike and the final warning), met as
  champion, met, met (6th against top 7). The strike did not become a sacking because the next
  season met.
- RollStrong3: met, met, **below** (5th against top 4 — a warning, no strike), met as champion
  (1st against top 6), met.

This is the R-55 band Rob chose to keep: one failed season in 15 established seasons here, no
sacking.

---

## 1b. The overnight batch before this one (14 Sep)

| Register | Commit | What changed | Proof |
|---|---|---|---|
| R-50 | `56c40ba` | Injured players cannot be selected; fitness scales a player's contribution 0.6–1.0; rest days recover; injuries heal weekly | condition 27/27 |
| R-42 | `06488d3` | Season trophies written at the boundary and shown in the cabinet and the season review | season trophies 14/14 |
| R-43 | `b8f730a` | Invented world news, Manager Movements, the youth league, the Job Market, poaching, the Reputation Bonus card deleted; Club News built only from real rows | fake-content-removed 11/11 |
| R-49, R-56, R-57, R-59 | `92d928e` | Harness faults fixed properly | 62/62, 58/58, 27/27 |
| R-58 | `bb37664` | Dashboard tier badge and the board's standing line | dashboard-standing 11/11 |

---

## 2. What Rob must check on screen

Start the app from your own terminal (R-39) and confirm `http://localhost:4173/api/health` answers.
Use a test profile for anything that ends a career — never *mary*.

**On the live save's first launch with this build** the server, once: drops `olympic_selections`
(log: `removed content dropped`), creates `olympic_tournaments`, `olympic_matches`, `olympic_medals`
and `youth_intakes`, adds `players.origin_career_save_id`, and marks every season row whose year is
divisible by 4 as Olympic. Players the live save's careers created BEFORE this build (draft picks,
scouted signings) cannot be traced to their career, so they stay unowned; only players created from
now on are kept out of other careers.

**R-60 — Resign / Break Contract**
1. Career → Career Options → Resign: the dialog reads *This ends your career at <club>. There is no
   job market yet.* Confirm → the finished screen says *You Resigned* with the reason. The save
   appears finished in Career Management, still showing its club.
2. Same for Break Contract on another test career: *You Broke Your Contract*; the $25,000 release
   clause is gone from the balance first.

**R-61 — Olympics**
3. Olympics → Schedule in 2026: no draw and no scores; it names the next Games (2028).
4. Olympics → National Squads: each nation's current pair, with their clubs; a *Fewer than two
   players* count, and those nations badged *Cannot enter* (Ireland and Portugal in the harness
   career — your own squad's nationalities can change the count).
5. Rules → Olympics: the eight lines match the above.
6. Only if you play a career to late November 2028: the schedule shows four group tables, the
   bracket and the medals; Club News "<nation> win Olympic gold 2028"; a medal in a player's
   record and in the Trophy Cabinet if one of your players won one.

**R-62 — academy intake**
7. Play (or open) a career past its first season boundary: Club News "3 youth players join the
   <club> academy" dated 1 January, with names, nations and ages.
8. Team → Youths: the three on the youth template card, aged 16–18. The banner reads *N / 12* with
   twelve dots and the subtitle *holds up to 12 players* (R-63). Signing a 13th academy player is
   refused with *Academy is full (12/12)*.
9. Finances → transactions (R-63): academy wages appear only inside the weekly *Weekly player
   salaries (… in the academy)* row — never a *Youth Academy wages* row after a match.
10. Rules → Academy: six lines, including the intake stopping at the Team page's limit and the weekly
    academy wage.

**Still open from 14 Sep** (unchanged): R-50 fitness and injury display (Team, Dashboard Next Match,
lineup picker); R-42 honours in the season review and the Trophy Cabinet; R-43 — Club News with game
dates, no Manager Movements, no Youth League, no Job Market, no Reputation Bonus, a test profile still
deletes; R-58 tier badge and board line. (14 Sep item 8, "Olympics → Schedule: Projected draw", is
replaced by check 3 above.)

---

## 3. Between this build and a Steam review copy

Honest, in the order it would have to happen. Nothing in this section was done in this batch.

### Packaging — done: 0.9.0 (R-64)
- **Built and proven on a clean install.** `C:\build\vbe\Beach Volleyball Empire Setup 0.9.0.exe`
  (336,203,636 bytes, sha256 `2c275612…`) for our testing, and `C:\build\vbe\win-unpacked`
  (557,170,430 bytes, 952 files) for Steam's depot. Installed silently, launched from the install
  folder against the live save (boot sync only, profiles listed, 3D Court rendered, WAL checkpointed
  on quit) and on an empty user-data folder (fresh save from the starter DB, Select Manager with no
  profiles). Details and hashes in the register, R-64.
- **Not code-signed.** No certificate is configured; Windows SmartScreen warns on the installer. Steam
  installs from the depot, so this matters for the NSIS copy, not the Steam build.
- **Company name.** The exe says "GitHub, Inc." (Electron's default): `package.json` has no `author` or
  `description`. Set both before the store build.
- **Starter DB sidecars.** The server's reference-data check leaves an empty `-wal` and a `-shm` next to
  the installed starter DB (R-64); the `.sqlite` itself is untouched. Harmless in a writable install
  folder; worth a look before shipping into a Steam library folder.
- **Size.** 320.6 MB installer / 531.4 MB unpacked; the Unity `.data` is most of it. The lever is the
  Unity project's texture and audio import settings, not the build.
- **Dev route shipped.** `/dev/generation-test` is still routed in the production frontend with a
  dead API behind it (R-10 audit finding 9).

### Steam — still between this build and the upload (nothing Steam exists in the repository)
1. **Steamworks depot configuration.** App and Windows depot in the partner site; the depot's content
   root is `win-unpacked`; launch option `Beach Volleyball Empire.exe`. No `steam_appid.txt` or
   Steamworks SDK is needed for a plain depot, and none is in the repo.
2. **Auto-Cloud.** Root **WinAppDataRoaming**, subdirectory **"Beach Volleyball Empire"**, pattern
   **`*.sqlite`**. The whole save is `volleyball-empire.sqlite` (R-23); `*.sqlite` does not match the
   `-wal`/`-shm` sidecars, and R-64 proved a normal quit checkpoints the WAL and leaves neither behind.
   Not covered: after a crash the latest writes sit in `-wal`, and Auto-Cloud would sync the older
   `.sqlite`.
3. **Build upload.** SteamPipe: steamcmd with an app build VDF and a depot build VDF pointing at
   `C:\build\vbe\win-unpacked`, uploaded to a branch, then set live for review.
4. **Store assets.** Capsule images (header, small, main, vertical, library hero/logo), screenshots,
   trailer, short and long descriptions, tags, system requirements, content survey.
5. **Review copy.** Keys come from Steamworks once the app exists there.

### Known gaps in the game
- **Academy graduates fill the senior squad** (found in R-63, not changed): a promoted graduate stays
  in the reserve role and counts as a senior, so by season 3 or 4 graduates fill the three-senior
  signing limit and a senior can only be signed after a release. Graduates are never released or
  offered a senior contract. Rob's call.
- **Retirement is effectively off** (triage 3z): one senior retires in five seasons.
- **No Career Result screen** for a completed five-season career (R-10): the season-5 review dialog is
  the end.
- **Design-doc screens not built** (R-10): Rankings screen, per-event qualification, tier status
  detail.
- **Economy invariants (R-07)**: I1 *monotonic return* and I9 *money stays meaningful* still violated.
- **Club News** does not list contract renewals: a renewal records no date.
- **Created players are not deleted with their career**: owned reference rows stay in `players`,
  unseen by every other career.
- **Open design questions** (triage §3): AI club reserves (3a), a qualifying competition (3b).

### V2 (`docs/triage.md`)
- **A real job market** from real AI clubs and reputation — Rob wants it if time allows (R-60).
- **A senior free-agent refresh** from the 89 unused adult portraits (R-62).
- **AI squad turnover** — ageing, retirements and intake for AI clubs (R-62).
