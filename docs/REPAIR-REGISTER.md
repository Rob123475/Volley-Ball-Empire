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

### R-55 — CLOSED (15 Sep, Rob's decision; code 51f83ab): the board's expectation is a band, not a rank — kept as is
**Rob's decision (15 Sep):** KEEP. A 1-in-10 established sacking over four seasons is intended. No
code change; the "near 0%" target no longer applies. Harness case: `harness/board-review.mjs`
section 1 carries R-55's band cases (four warnings and no strike at 6th/7th/8th/5th; two failed
seasons in a row sack; a below season between two failed ones resets nothing; a met season clears
the strike; an underdog judged at its level) — 58/58 in the 14 Sep final full run.

Original entry:

### R-55 — CLOSED AS SPECIFIED (14 Sep, 51f83ab); ROB TO DECIDE: the "near 0%" target is not met: the board's expectation is a band, not a rank
**Symptom (R-54):** established clubs were sacked by ordinary results variance. The strongest pair
finished 6th-10th in 5 of 26 seasons, and two such seasons in a row sacked against R-53's #2 target.

**Rob's rule:**
- **Established:** top 4 met; 5th-8th below expectations (a warning, no strike); 9th or worse
  failed.
- **Strikes:** two failed seasons in a row sack. A warning season resets nothing and adds nothing.
- **Underdogs** get the same band logic at their level.
- **Asked:** your example underdog bands (top-10 / 11-15 / 16+) would sack nearly every harness
  underdog by season 2: those clubs finished 16th or worse in 32 of 36 measured seasons.
- **Rob chose bands relative to squad strength.**

**Fixed (docs/r53-design.md, amendment R-55):**
- **`utils/board-confidence.ts`:** bands from the pair's strength rank R at the draw.
  - met: finish ≤ R+3, confidence +5, clears strikes
  - below: R+4 to R+7, confidence 0, strikes unchanged, review outcome `warning`
  - failed: R+8 or worse, or half the season forfeited; confidence −25, a strike
  - An established starting pair (R = 1) is exactly top 4 / 5th-8th / 9th+. A #19 squad cannot fail
    on position.
- **Sacking at a review:** a second strike, or confidence ≤ 20. The rest of R-53 stands.
- **Strikes** are derived from the reviewed grades, not stored.
- **Monthly check:** a projected below or failed season warns; freeze thresholds unchanged.
- **Deleted:** R-53's difficulty allowance, money places, `targetFinish` and the six-step grade.
- **`board_seasons`:** lost `allowance` and `money_places`. `target` is now the met line.
  - The starter DB's empty table was rebuilt: only board_seasons changed.
  - Saves created since this morning's R-53 build keep the two unused, nullable columns, because
    ensureSchema only adds columns.
- **Spec:**
  - `BoardConfidence` gains `failedFrom` and `strikes`
  - the review outcome gains `warning`
  - projected grades are now met / below / failed
- **Player-facing:** the expectation reads "The board expects a top-4 finish this season: 5th-8th is
  below expectations, a warning with no strike; 9th or worse fails the season". The contract page's
  rules explainer is rewritten to match.
- **Harness:**
  - `board-review.mjs` re-judges the design's six careers and §5.1 cases under the bands, and adds
    R-55's own cases (6th, 7th, 8th, 5th is four warnings; two failed in a row sack; a below season
    between them resets nothing; a met season clears the strike; an underdog judged at a #10 squad's
    level). Its source scan now also catches R-53's rank target.
  - `rollover.mjs`: RollA is back to an established club.
  - `scripts/r55-sack-rate.mjs` measures sack rates over more careers than the arcs.

**Verified:**
- **Suites:** board-review 58/58. Full harness 24/24, rollover 78/78: RollA (established) crossed all
  five boundaries.
- **Arcs (3 careers each):** established sacked 0 of 3, underdog 0 of 3.
  - RollStrong finished #3, #6 (warning), #2, #1.
  - RollStrong2 finished #4, #4, #1, #3.
  - RollStrong3 finished #1, #1, #1, #3.
  - Every underdog season (#14-#19) met expectations.
- **Larger sample** (`scripts/r55-sack-rate.mjs`, 10 careers per difficulty, four reviews each):
  - **Established: sacked in 1 of 10.**
    - Est3 went #1, #7 (warning), #10 (failed), #9 (failed).
    - Across 40 seasons: 27 met, 5 below, 8 failed. The failed finishes were #9 four times, #10,
      #12 twice and #14.
  - **Underdog:** 0 of 10; all 40 seasons met (#13-#19).

**Why established clubs still fail (diagnosis on that run's DB, nothing changed):**
- **No bug found.**
  - The pair was rated 89.5 and ranked #1 in every season.
  - No forfeits.
  - The drawn fields were equally strong every season (mean 77.7-80.6).
- **Failed seasons were weaker seasons:** 29.3 wins on average against 36.5 in met seasons.
- **The standings rank by tier-weighted points, which magnifies that.** Est3's season 3 went 33W 21L
  and finished 10th on 58 points; Est8's season 3 went 26W 29L and finished 3rd on 62.
- **Season timing is noise:** season 4's four failures sit within this sample's noise (same field
  strength).
- **Model check:** per season, failed 20% and below 12.5%. The chance of two failed seasons in a row
  within four reviews is then about 11%, which matches 1 in 10.

**Rob to decide, not applied (a game-design change):** with the bands as specified, an established
club that makes no signings is sacked in roughly 1 career in 10. Options:
1. **Failed from 11th (R+10) instead of 9th.** 3 of the 40 measured seasons finished 11th or worse,
   which projects to about 2% over four reviews: near 0%, not immune.
2. **Rank the standings by wins before points.** The variance comes from which tier's events a club
   wins, not how many.
3. **Require low confidence as well as two strikes to sack.**

### R-52 — CLOSED (14 Sep, 696a4e5): a spending freeze blocked contract renewal, so a solvent club could lose its squad and forfeit whole seasons
**What happens:**
- R-51's renewal applies the board's spending gate, the same gate as signing.
- A club in the `spending_blocked` stage therefore cannot renew. Its squad lapses at the next season
  boundary, and under R-48 every match after that is a forfeit.
- A healthy budget floors board confidence at the `spending_blocked` stage (the
  board-confidence-ladder suite asserts this), so such a club is never sacked either.
- It forfeits season after season with money in the bank.

**Evidence (14 Sep, the two R-48 full runs):**
- **Run 1:** RollStrong (established) was refused at the start of season 3 (balance $1.89M) and went
  0W 54L in season 4.
- **Run 2:**
  - RollWeak2 and RollWeak3 (underdog) were refused at the start of seasons 2 and 3. Their contracts,
    renewed at season-1 start, ran through season 2, lapsed on day one of season 3, and seasons 3 and
    4 were both 0W 54L. Balances were $1.06M-$1.50M, and neither was sacked.
  - RollStrong was refused at the start of season 5, the terminal season.

The harness report line for this is imprecise: it says "the squad lapsed and its matches were
forfeited" for every refused season, where a refusal lapses the squad at the NEXT boundary.

**Options (not applied; board-confidence balance is not to change yet, R-47):**
- Renewal at unchanged terms is exempt from the spending freeze, since it is not new spending.
- The freeze leaves renewals open but caps them.
- Leave it as is: the freeze bites and the board never ends a solvent career.

**Rob's decision (14 Sep):** exempt renewals at unchanged terms from the spending freeze. A freeze
blocks new spending, not keeping the squad you have on the same terms.

**What changed (696a4e5):**
- **`POST /contracts/:id/renew`** takes an optional `salary`, and omitted means unchanged.
  - Only a raise (above the current salary) meets the board's spending gate, with a 403 that
    says a same-terms renewal is still allowed.
  - Renewing at the current salary, or less, goes through a freeze.
  - The contract and career state carry the salary.
- **Signing is unchanged:** still refused while frozen.
- **OpenAPI:** an optional request body, with the client regenerated.
- **Harness:**
  - `contract-renewal` gained a frozen-club section.
  - `rollover.mjs` now requires every season's renewal to go through with none refused.
  - Its report line for a refused renewal now says the squad lapses at the following boundary
    (the imprecision noted above).

**Harness: `contract-renewal` 23/23.** Club B, frozen (spending_blocked, score 10):
- a raise is refused (403) and changes nothing
- the same salary, named or omitted, renews to 2027-12-31
- signing is refused (403)

Club A's renewal, refusals, game-clock warnings and signing checks are unchanged.

**Full harness: 24/24 suites passed; season rollover 66/66.** Renewals refused in the arc: none.

Five-season table and sackings, as the run printed them:

```
  Season | Strong: record / played / pts / tier / balance / rank / finals          | Weak: record / played / pts / tier / balance / rank / finals
       1 | 31W 24L / 55/59 / 63 / Gold / $1,109,559 / #1 / semi-finalist                    | 26W 28L / 54/59 / 13 / Bronze / $532,420 / #8 / did not qualify
       2 | 37W 18L / 55/59 / 22 / Silver / $1,533,058 / #4 / semi-finalist                  | 22W 32L / 54/59 / 10 / Bronze / $861,040 / #15 / did not qualify
       3 | 41W 14L / 55/59 / 22 / Silver / $1,974,077 / #4 / semi-finalist                  | 12W 42L / 54/59 / 7 / Bronze / $1,120,200 / #19 / did not qualify
       4 | 41W 14L / 55/59 / 30 / Silver / $2,460,851 / #3 / semi-finalist                  | 18W 36L / 54/59 / 7 / Bronze / $1,398,580 / #18 / did not qualify

── Sackings per arc (R-47: a legitimate result — reported, not failed; 3 careers each) ──
  Strong (established): sacked in 0 of 3 careers (0%)
    RollStrong   31W 24L | 37W 18L | 41W 14L | 41W 14L  ->  career complete
    RollStrong2  35W 21L | 33W 23L | 30W 24L | 40W 15L  ->  career complete
    RollStrong3  36W 20L | 32W 22L | 33W 21L | 33W 22L  ->  career complete
  Weak (underdog): sacked in 1 of 3 careers (33%)
    RollWeak     26W 28L | 22W 32L | 12W 42L | 18W 36L  ->  career complete
    RollWeak2    22W 32L | 17W 37L | 19W 35L | 11W 43L  ->  career complete
    RollWeak3    (no full season)  ->  SACKED in season 1 after 3W 14L
```

### R-50 — CLOSED (14 Sep, 56c40ba): injuries and fitness decided nothing: injured players at fitness 0 played at full rating
**Found during R-48's diagnosis:**
- At the end of season 1 all three of an established club's players were injured: two
  "Unavailable" and one "Major Injury", with fitness 0 and fatigue 34.
- They were still `is_active` and played every match rated on their full stats.
- Simulate rates a squad by `sideRating(activePlayers)` (`routes/matches.ts`). That reads the six
  stats only, and `activePlayers` filters on `is_active` alone.
- Injury status, fitness and fatigue are written (post-match effects, weekly recovery in
  `calendar.ts`), but nothing that picks the pair or computes match strength reads them.

**When fixed, also check:**
- the live tick engine's team selection (`utils/match-tick-engine.ts`)
- the Unity payload
- R-48's empty-squad rule, which counts contracted active players and so would count an injured one
  as able to play

**Found when fixing it (overnight batch item 1, 14 Sep):**
- **"The side" was every active player.** Starters and the interchange were all rated together, on
  full stats, and all of them "played" every match.
- **Nobody ever rested, so nobody healed.** Injury weeks ticked down only for a player who sat a match
  out.
- **Recovery could never keep up.** Daily recovery was fatigue −4 and fitness +1, and the fitness
  gain only applied below 30 fatigue. Against about +20 fatigue a match every ~4.7 days, fatigue
  climbed all season and fitness drained to 0.

**Design (decided and recorded, `utils/condition.ts`):**
- **Selection.** A pair of available players: contracted, active, not injured.
  - The stored lineup comes first where its players are available, then starters, the interchange
    and anyone else, each by fitness-scaled rating.
  - One function picks the side for `/simulate`, `/watch`, the live tick engine, both sides of the
    Unity payload, game-API match setup, the R-48 forfeit rule, and the board's able-to-play check
    (R-53).
  - `PATCH /matches/:id/lineup` refuses an injured player, or anyone outside the squad (400, naming
    who). It also now checks the match belongs to the club.
- **Fitness curve:** factor = 0.6 + 0.4 × fitness / 100, applied to each of the six stats.
  - 100 → 1.00, 75 → 0.90, 50 → 0.80, 25 → 0.70, 0 → 0.60.
  - Linear because it meets Rob's anchors exactly and reads plainly on screen ("plays at 88%").
- **A match costs only the two who played:** fitness −4 to −7, fatigue +12 to +18 (plus weather),
  and an injury roll.
- **Rest.** Every game day, on the calendar: fitness +2 and fatigue −5; injured players +1 and −3.
  Measured rest days between the club's World Tour matches: 4-5.
- **Injuries** heal a week every 7 game days on the calendar, off-season included; the medic and
  Medical Centre bonuses are unchanged. They are shorter and rarer than before, because an injured
  player can no longer play through it and a three-player squad with two out forfeits:
  - base risk 3% a match (was 5%)
  - Minor: 1 week, 65% of injuries (was 2 weeks, 60%)
  - Major: 3 weeks, 30% (was 6 weeks, 30%)
  - Unavailable: 6 weeks, 5% (was 12 weeks, 10%)
  - the "playing through an injury" path is deleted
- **Screens:**
  - **Team page:** each player card shows "Fitness N% · plays at M%" and, when injured,
    "Injured: … · N weeks out · cannot be selected".
  - **Next Match card:** names the pair, their fitness and what they play at, who cannot be
    selected, and warns when the match would be forfeited.
  - **Attention panel:** says when injuries leave fewer than two fit players.
  - **Status badge:** "Injured — can't play".
  - **Match screens:** Sim Result's auto-pick and both lineup pickers leave injured players out.

**Fixed:**
- **New `utils/condition.ts`** holds the rules.
- **`routes/matches.ts`:** simulate, watch, forfeit and the lineup route go through the selection.
  - The match row stores who played, and the result returns `lineup` and `squadRating`.
  - `applyPostMatchEffects(playedIds…)` charges only the pair.
  - Moved to `condition.ts`: `calcInjuryRisk`, `rollInjurySeverity` and the per-match injury tick.
- **`routes/calendar.ts`:** the rest-day recovery and the weekly injury tick.
- **Selection wired into:** `match-tick-engine.ts`, `unity.ts`, `game-api.ts`.
- **Board and dashboard:**
  - `board-confidence.ts` excludes injured players from the pair and from unfieldable-days.
  - `dashboard.ts` and the spec add `nextMatchSelection`.
  - `attention.ts` adds `squad-unfit`.
- **Dev:** `POST /dev/condition/win-rate` (dev-only).
- **Frontend:** the dashboard, Team page, `MatchActionButtons`, matches page and status badge.
- **Harness:** new `harness/condition.mjs` (suite 23 of 25).

**Verified:**
- **`harness/condition.mjs` 27/27:**
  - **Source scan:** the old paths are gone (the whole active squad rated on full stats, the tick
    engine's top two active seniors, the gated recovery, playing through an injury), and each old
    line planted back is caught.
  - **5,000 matches per fitness level** against an 80-rated side, through the rating `/simulate`
    uses:
    - an 89.5 pair wins 66.0% at fitness 100, 36.3% at 50 and 14.9% at 0 (z = 52)
    - ratings 89.5 / 71.6 / 53.7 exactly
  - **Live, with a starter injured on the match day:**
    - the dashboard names the other starter and the interchange, and says she cannot be selected
    - Unity sends the fit pair
    - a manual lineup including her gets 400 ("Yaritza Mendez is injured")
    - auto-selection plays the other two, and the match row stores them
    - she is not charged for the match; the pair are
  - **`/simulate` squadRating** equals the pair's stats × 0.6 at fitness 0 and × 1.0 at 100.
  - **Rest and recovery:**
    - a rest day: +2 fitness, −5 fatigue (injured: +1, −3)
    - match days 17 Feb, 22 Feb, 26 Feb, 3 Mar, 8 Mar, 12 Mar (gaps of 4-5 days)
    - a one-week injury heals on the weekly tick
  - **Two of three injured:** the dashboard and the attention panel warn, and the match is forfeited
    with the injury reason.
- **Checks:** `pnpm run typecheck` with every guard clean.
- **Full harness 25/25, rollover 78/78.** Every harness career completed; 0 of 3 sacked in each arc.
  The five-season table:

  | career | S1 | S2 | S3 | S4 |
  |---|---|---|---|---|
  | RollStrong | 34W 21L, #3, Gold, semi | 41W 15L, #1, Gold, champion | 39W 17L, #1, Gold, champion | 32W 22L, #9, Silver |
  | RollStrong2 | 33W 21L, #8, Silver | 25W 29L, #15, Bronze | 37W 19L, #1, Gold, champion | 39W 17L, #1, Gold, champion |
  | RollStrong3 | 35W 20L, #3, Gold, semi | 35W 19L, #7, Silver | 40W 16L, #2, Gold, runner-up | 41W 15L, #1, Gold, champion |
  | RollWeak | 25W 29L, #12, Bronze | 18W 36L, #19 | 16W 38L, #19 | 18W 36L, #19 |
  | RollWeak2 | 17W 37L, #18 | 22W 32L, #13 | 18W 36L, #19 | 17W 37L, #19 |
  | RollWeak3 | 16W 38L, #19 | 10W 44L, #19 | 15W 39L, #19 | 17W 37L, #17 |

  RollStrong3's season-5 review was judged against a top-6 finish. A player injured at the draw does
  not count towards the pair, so its strength rank was 3 that season: R-50 and R-55 working
  together.

**Known and accepted:** the calendar's "skip match" path moves the date on without that day's
processing, so a manager who skips loses that day's rest recovery.

### R-51 — CLOSED (14 Sep, c41cad2): an expiring contract was neither warned about in game time nor renewable
**Found (Rob's R-48 item 2: does the game warn the manager, with enough notice, and is there a renew action?):**
- **No renew action existed anywhere.**
  - `POST /contracts` refused a player already in the squad with "Use the Contracts page to renew
    their contract".
  - `pages/contracts.tsx` offered only Terminate.
  - Neither the routes nor the OpenAPI spec had a renew endpoint.
- **The warning existed, but on the wrong clock.**
  - `routes/attention.ts` "Contract Expiring" is orange at ≤30 days and red at ≤14. It appears in
    the dashboard's attention panel and is counted in the header bell.
  - But it computed days left from `new Date()`, the computer's clock, against in-game end dates.
    It appeared, or never did, regardless of where the season was.
  - The Contracts page's "Days Remaining" did the same.
- **Signing used the computer's clock too:** `POST /contracts` started a contract on the machine's
  date and capped it a year after that.
- **Expiry was only reported after the fact.** The calendar says "N contracts expired — players
  returned to free agency" (`calendar.ts:562`), and no inbox or news item comes before it.

**Rob's decision (14 Sep):** build renewal now; the R-48 empty-squad forfeit ships with it.

**What changed:**
- **`POST /contracts/:id/renew`:**
  - one more season on the same terms: the new end is one year after the old one, same salary and
    bonus
  - allowed only in the contract's final season (end ≤ the active season's end), so renewals cannot
    be stacked
  - the board's spending gate applies (403)
  - another club's contract is a 404; an academy contract is a 403
  - career state carries the new end date
- **`routes/attention.ts`:** days left are counted on the game clock (`getGameDate`), and the item
  says to renew on the Contracts page.
- **`POST /contracts`:** start date and one-year cap use the game date.
- **`pages/contracts.tsx`:** "Days Remaining" is counted from the game date, and a "Renew +1 season"
  button shows for contracts in their final season.
- **OpenAPI:** `renewContract`, with the client regenerated.

**Harness: new `harness/contract-renewal.mjs`, 18/18:**
- renewal to 2027-12-31, same salary, in the contracts table and career state
- a second renewal is 409, a cross-career contract 404, unauthenticated 401, spending blocked 403
- with the game clock at 1 Jan: no warning
- at 10 Dec: two orange (21 days), the renewed contract silent
- at 20 Dec: two red (11 days) saying renew
- on the machine's clock (14 Sep 2026) those contracts were 108 days away, so the warnings are the
  game clock's
- a signing on game day 20 Dec starts that day and is capped at 2027-12-20
- the page source renews and counts game days

The first run of this suite failed 3 checks. The harness set the game date on a calendar row that
did not exist yet: `GET /calendar` creates it, and `current_date` is also SQLite's CURRENT_DATE
keyword. Scene writes now open the calendar first, quote the column, and must change exactly one row.

### R-48 — CLOSED (14 Sep, dc8fbc6): the Strong arc collapsed at the first season boundary — squads walked out and clubs played on as phantoms
**Symptom (final run, 14 Sep):** RollStrong (established) finished season 1 at 42W 14L, #1, World
Champion. In season 2 it went 10W 44L, #19, with no signings and no training. The weak arc also sat
at #19 from season 2 on.

**Method:** investigated before changing anything. A diagnostic played an established career through
the real API on a copy of the shipped starter DB, with no signings or training (the R-08 arc's
conditions). It snapshotted the DB at five points:
- **A:** season 1 round 77, one advance before the rollover
- **B:** immediately after the rollover advance
- **C:** one advance into season 2
- **D:** season 2's first World Tour match played
- **E:** ten matches later

The diagnostic's date column read returned SQLite's CURRENT_DATE keyword rather than the calendar,
so the rounds (77 → 1 → 1 → 10 → 21) are what place the snapshots.

**What changed, and where:**
| | end of S1 (A) | start of S2 | where |
|---|---|---|---|
| ages | 28, 28, 27 | 29, 29, 28 (at B) | `seasonRollover.ts:103` → `playerDto.ts:493` `ageAllPlayers` |
| six stats | e.g. [80,96,88,88,99,88] | identical for all three (A→D) | nothing writes them at rollover |
| retirements | — | none (threshold 40) | `seasonRollover.ts:108`, `RETIREMENT_AGE` |
| youth promotion | — | none of this squad | `seasonRollover.ts:112` |
| ranking | 86 pts | new season: no row, then 0 (head start was S1 only) | `careers.ts:278` |
| contracts | 3 active, all ending `2026-12-31` | all 3 expired at C: team null, inactive, salary 0, contracts terminated | end date hardcoded at `careers.ts:233` via `seedStartingSquad`; expiry at `calendar.ts:538-564` |
| active squad rating | 86.22 | 60 from C on | `matches.ts:590` `sideRating(activePlayers)` → `matchEngine.ts:61`: an empty list returns a flat 60 |
| AI pool player stats | hash 472115 over 120 players | identical at E | reference data; nothing writes it |
| AI field | S1: mean 79.94, max 88.50 | S2: 10 of 18 clubs carried over, mean 78.04, max 85.67 | S2 regional qualifiers (the field got slightly weaker) |

The rollover advance itself reported "Season 1 complete — Season 2 begins". The next advance reported
"3 contracts expired — players returned to free agency".

In S2 the club plays every match as a phantom pair rated 60, with nobody under contract. The
diagnostic's first 11 S2 matches went 5W 6L. The weak arc's starting squad is signed to the same
`2026-12-31`, so both arcs play season 2 onward at 60, which is why both sit near #19.

**Diagnosis:** not a stat reset, not ageing, not retirements, and not an AI strength refresh. Two
things together:
1. **Contract length (a design knob):** the starting squad's contracts are one season long and expire
   on the first day of season 2. The R-08 arc never renews them.
2. **Silent fallback (a rule question):** a club with no contracted players keeps playing, and
   keeps winning some matches, as a flat-60 side. The empty squad is hidden rather than surfaced.
   The dashboard's red "Squad Incomplete" item already says such a club "can't play a match".

**Proposed fix (not applied: contract length and what an empty squad does are Rob's calls):**
- **Recommended:**
  - (a) A club without 2 contracted active players cannot field a side, so its match is a forfeit
    (0-2, through the existing forfeit path) instead of a phantom 60 pair.
  - (b) The R-08 arc renews expiring contracts through the real contract route before they lapse, as
    a manager would. It then measures a managed club, and "no signings or training" stays true.
- **Alternatives, both economy/balance:**
  - The starting squad signs to the end of the arc (`2030-12-31`).
  - Contracts auto-renew at rollover.

**Also observed (not at the boundary, not investigated):** at A all three players were injured (two
"Unavailable", one "Major Injury") with fitness 0, yet active and rated at full stats. Injury and
fitness appear to play no part in selection or match rating.

**Rob's decision (14 Sep):** go with the recommendation (forfeit empty squads; the harness renews),
plus:
- (1) contracts dated relative to the career's start, never a literal year
- (2) check the player-facing warning and renew action
- (3) register R-50

**What changed:**
- **(1) `229957a`:**
  - `POST /careers` creates the season row first, with its year from `FIRST_SEASON_YEAR`.
  - It signs the starting squad with `oneSeasonContract(season)`: start and end are the season's own
    dates. This replaces the literal `"2026-12-31"` and the computer-clock start.
  - Harness `starting-contracts` 15/15.
- **(2) found no renew action and a warning on the computer's clock.** That became R-51 (`c41cad2`):
  renewal route and button, game-clock warning and signing. Harness `contract-renewal` 18/18.
- **(3)** R-50 registered (`e90bef6`).
- **Forfeit (dc8fbc6):**
  - A club with fewer than 2 contracted active players forfeits instead of playing as a flat-60
    phantom side.
  - `/simulate` records the forfeit through the same code as `POST /matches/:id/forfeit`, now shared
    as `recordForfeit`, and the result says why.
  - `/watch` refuses with 409.
  - The dashboard's Squad item says matches are forfeited.
  - Harness `squad-forfeit` 11/11: warned, watch refused, a 0-2 forfeit with loss, confidence −5,
    opponent credit and ranking loss; a full-squad control plays a real best-of-three.
  - The smoke suite signs a partner for its tracked player so its matches are played, and asserts
    none were forfeited.
- **Harness renewal (dc8fbc6):**
  - `rollover.mjs` renews every contract ending this season through `POST /contracts/:id/renew`
    before each season, in both the rollover walk and the R-08 arc.
  - Refusals are reported, and the check accepts only the board's spending block (403).

**Verification:**
- **Full run 1: 20 of 24 suites passed.** The four failures were two mistakes of mine:
  - fresh-install, all-star-removed and olympic-qualification failed because rebuilding the server
    cleared `dist/public` and I had not re-synced the frontend
  - season rollover's new renewal check wrongly failed a season with nothing left to renew after a
    refusal
- The frontend was rebuilt and synced, and the check corrected.
- **Full run 2: 24/24 suites passed; season rollover 66/66.**

**Five-season table (run 2, first career of each arc):**
| season | Strong (established) | Weak (underdog) |
|---|---|---|
| 1 | 36W 19L · 55/59 · 78 pts · Gold · $1,211,159 · #1 · semi-finalist | SACKED after 7W 17L |
| 2 | 32W 22L · 54/59 · 14 pts · Bronze · $1,549,903 · #7 · did not qualify | — |
| 3 | 33W 22L · 55/59 · 22 pts · Silver · $1,968,222 · #3 · semi-finalist | — |
| 4 | 24W 30L · 54/59 · 8 pts · Bronze · $2,243,526 · #18 · did not qualify | — |

Sackings: established 0 of 3, underdog 1 of 3 (run 1: 0 of 3 and 3 of 3).

All three runs, every season:
- **Established:**
  - RollStrong 36-19, 32-22, 33-22, 24-30
  - RollStrong2 37-19, 34-22, 39-17, 35-19
  - RollStrong3 36-20, 32-24, 40-16, 39-16
- **Underdog:**
  - RollWeak sacked in S1
  - RollWeak2 15-39, 11-43, 0-54, 0-54
  - RollWeak3 23-31, 21-33, 0-54, 0-54
  - Both RollWeak2 and RollWeak3 lost their squads to refused renewals: R-52.

The season-2 collapse is gone. What remains is R-52.

### R-40 — CLOSED, VERIFIED ON SCREEN BY ROB 14 SEP (game 195e769, rebuilt 417cdcd; Unity ea6eb5e)

**Verified on screen by Rob, 14 Sep:** the Electron 3D Court on career 9 shows the full venue and
all four players, with four distinct skin tones — the home pair in `#0a0` green, the away pair in
red. That is brief step 8, passed.
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

### R-31 — CLOSED, VERIFIED ON THE LIVE SAVE 14 SEP (877557c)
**Verified on the live save, 14 Sep:** Rob closed the game with the window's X. Afterwards the
live save folder holds only `volleyball-empire.sqlite` (2,064,384 bytes, modified 14 Sep
10:23): **no `volleyball-empire.sqlite-wal`**, no `-shm`, and no Electron process left running.
The quit went through the checkpoint-and-close path. Harness proof since `877557c`:
`harness/wal-checkpoint-shutdown.mjs`, 7/7 in the 12 Sep full run.

Original entry:
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

### R-54 — CLOSED (14 Sep, 8bc38c2): tiers follow the standings: every win scores, no head start, Silver 55 / Gold 63, full purses up to last season's tier
**Symptom (R-52 final run):**
- RollStrong (established) earned 63 points and Gold in season 1 at 31W 24L, with the 20-point head
  start.
- It then earned 22-30 points and only Silver at 37W 18L and 41W 14L, while finishing #3-#4 in the
  field.

Other established clubs ended Bronze while finishing high:
- RollStrong3: S3, #6, 14 points
- RollStrong2: S3, #10, 13 points
- R-48 run 2 RollStrong: S2, #7, 14 points

**What the tier is calibrated to:**
- Silver 15 and Gold 40 were set in `docs/economy-design.md` (ranking reset, lines 83-132), modelled
  on:
  - a 62-event season
  - a squad on the Phase 1 curve (75.0 in S1, rising to 89.5)
  - opponents rated by tier (`opponentRatingFromTier`, +2 per season)
- The target was I8, "a well-run club reaches the Grand Final within the arc". Silver 20 / Gold 55
  never reached Gold in that model.
- The model predates:
  - R-29: real opponents, clubs rated 68.7-88.5
  - R-44: 57 events
  - R-11: the established head start of 20 points, season 1 only
- The same doc (lines 457-475) already recorded "Gold is unreachable IN TIME". The ranking resets
  each season, so the gate opens after most Gold events are played. It was noted as a scheduling
  problem and left open.

**How the gate works:**
- A win scores Bronze 1, Silver 2, Gold 4.
- A win at a gated tier scores 0 unless the club already holds that tier's threshold (15 or 40),
  and pays 10% of the purse (`awardedPoints` in `utils/rankingPoints.ts`, `eligibilityFor` in
  `utils/tierQualification.ts`).
- The season's 57 events, in calendar order:
  `BBBBBSSGGGBBBBBSSSGGBBBBBSSGGGBBBBSSSGGBBBBSSSGGBBBBSSSGG`. Each continent block plays its Bronze
  first.

**Modelled over the real schedule** (`scripts/r54-gate-model.mjs`: deterministic, finals excluded,
independent win probability per match):
- **Winning every regular match from 0 points (every season after season 1):** 57 points.
  - Silver opens only after event 25, and Gold after event 49 of 57.
  - 17 of the 57 wins score nothing.
- **Winning every match from 20 points (established, season 1):** 123 points.
  - Silver is open from the start, and Gold after event 18.
- **By win rate:**

  | win rate | from 0: mean pts | P(Silver) | P(Gold) | from 20: mean pts | P(Gold) |
  |---|---|---|---|---|---|
  | 35% | 9.7 | 2.8% | 0.0% | 44.0 | 62.9% |
  | 45% | 13.1 | 21.2% | 0.0% | 54.7 | 94.8% |
  | 55% | 18.0 | 58.9% | 0.0% | 66.0 | 99.8% |
  | 65% | 24.3 | 90.7% | 0.3% | 77.6 | 100.0% |
  | 75% | 31.4 | 99.4% | 4.4% | 89.8 | 100.0% |
  | 85% | 40.4 | 100.0% | 37.3% | 101.2 | 100.0% |

**What that means:**
1. **The tier measures when a club crossed a gate, not how good it is.**
   - A club starting at 0 needs 15 Bronze wins before any Silver or Gold win counts, and there are
     only 27 Bronze events.
   - Most of its best results against the strongest opposition score 0.
2. **The head start is worth more than skill.**
   - An established season-1 club winning 35% reaches Gold 63% of the time.
   - A club starting at 0 reaches Gold 4.4% of the time winning 75%, and 37% winning 85%.
   - This matches the run: 31W 24L gave Gold; 41W 14L gave Silver.
3. **A top-4 club can be Bronze.**
   - From 0 points at 55% wins, a club finishes Bronze 41% of the time.
   - The real field has produced top-4 finishes at 55-75% win rates, and established clubs at #6,
     #7 and #10 finished Bronze.
   - No top-4 club was Bronze in the final run, but nothing prevents it. Whether a top-4 club should
     ever be Bronze is Rob's call: the tier and the standings currently answer different questions.
4. **I8's calibration no longer holds.** The model it was set against is gone: real opponents, 57
   events, the head start.

**Options reported:**
- tiers qualified on the previous season's final standing or ranking (the ratchet the reset decision
  rejected)
- wins count toward points at every tier, with the gate applying only to the purse
- thresholds proportional to events played so far
- the head start applied every season, or never

**Decision (Rob, 14 Sep):**
- Tiers must follow what the player can see.
- Drop the gate ("a win scores nothing until you hold 15/40") and the season-1 head start.
- Re-derive Silver and Gold from the real 57-event season with real opponents, so that in the
  typical season a top-4 club is Gold, a top-10 club Silver, and the rest Bronze.
- **Purse access follows the tier the club finished last season.** I asked, because 55/63 are
  season-end levels; under the old live rule almost every Silver and Gold purse would have paid 10%
  all season. In season 1, established clubs get Silver access and underdogs Bronze.

**Numbers (proposed, then implemented):**
- **Points per win unchanged:** Bronze 1, Silver 2, Gold 4, World Semi Final 8, World Final 15.
  - Every win scores; a loss scores 0.
  - Points reset each season, and every club starts at 0.
- **Data:** `scripts/r54-tier-thresholds.mjs`, run before the change.
  - 12 careers through the real API on a starter-DB copy; 10 complete season-1 fields (the old
    board sacked 2 underdogs); 190 club-seasons.
  - Every club was scored from `world_tour_fixtures` with every win counted, then ranked by points,
    wins and set difference. Match results never depended on points, so the scoring is exact.
  - **Points by finish, median (range):**

    | finish | median | range |
    |---|---|---|
    | #1 | 91 | 75-99 |
    | #2 | 84.5 | 70-91 |
    | #3 | 69 | 66-76 |
    | #4 | 65 | 63-71 |
    | #5 | 62 | 58-67 |
    | #6 | 62 | 57-67 |
    | #9 | 56 | 54-59 |
    | #10 | 55.5 | 51-58 |
    | #11 | 53 | 50-56 |
    | #12 | 51.5 | 49-56 |
    | #19 | 36 | 31-39 |

- **Gold 63, Silver 55:**
  - Every sampled top-4 club reached 63 (40 of 40); the median #5 did not.
  - The median #10 reached 55; the median #11 did not.
  - This agrees with top-4 Gold / #5-#10 Silver / #11-#19 Bronze for 92.1% of the 190 club-seasons.
  - Gold 64 agreed for 92.6% but left one sampled #4 at Silver. I chose 63 so that a top-4 finish
    is Gold.
  - The #4 and #5 ranges overlap (63-71 against 58-67), so a strong #5 can still reach Gold.

**Fixed:**
- **`utils/tierQualification.ts` rewritten:**
  - the thresholds, with their derivation
  - `tierForPoints`
  - `purseAccessFor(eventTier, accessTier)`: open or finals pay in full; `above_access` pays
    `LOCKED_PURSE_MULTIPLIER` (0.1)
  - Deleted: `eligibilityFor`, `below_threshold`, `above_tier`, `unlockedTiers`, `currentTier`,
    `nextTierGap`, `PUSHED_OUT_PRIZE_MULTIPLIER`.
- **`utils/rankingPoints.ts`:**
  - `awardedPoints` deleted; `creditCompetitorTx` credits `rankingPointsFor` to every club, AI and
    player
  - `currentRanking` returns the `tier`
  - new `purseAccessTierFor`: last season's ranking row gives the tier; with no row, difficulty
    decides
- **`utils/careerDifficulty.ts`:**
  - `ESTABLISHED_STARTING_RANKING_POINTS` and `startingRankingPointsFor` deleted
  - `SEASON_ONE_PURSE_TIER` added (established Silver, underdog Bronze)
  - `ensureCompetitorRanking` lost its initial-points parameter
- **Routes:**
  - `/matches/:id/simulate` pays by purse access.
  - `GET /matches` carries `purse`, replacing `eligibility`.
  - `GET /seasons/ranking` adds `purseAccessTier` and `tierThresholds`.
  - The season review's ranking carries `tier`. The review dialog shows it, with "next season pays
    X purses in full".
- **Player-facing text:** the wizard taglines and the `CareerDifficulty` spec text no longer say
  "Bronze-locked" or "Silver/Gold from day one".
- **Harness:**
  - world-tour-competitors and world-tour-byes reconcile every club's points with every win scored.
    Rounds 11-22 hold Silver and Gold events long before any club could hold 15 or 40, so a gate
    surviving anywhere fails them.
  - career-difficulty asserts: both difficulties start at 0; season-1 access is Bronze (underdog)
    and Silver (established), read from each career's own fixture list; and a source scan for the
    gate and the head start, with a planted line, finds nothing.
  - smoke §7 asserts purse access on every fixture.
  - rollover mirrors 55/63, and asserts each next season's access equals the tier just reached.
  - `invariants.mjs`: model updated (see findings below).
- **`docs/economy-design.md`:** the Silver 15 / Gold 40 decision and the "Gold is unreachable in
  time" finding are annotated as superseded and resolved by R-54.

**Verified:**
- **Suites:** world-tour-competitors 38/38, world-tour-byes 18/18, career-difficulty 15/15,
  olympic-qualification 29/29.
- **Checks:** `pnpm run typecheck` with every guard clean.
- **Full harness 24/24, rollover 78/78.** The five-season table from the final run:

  | career | S1 | S2 | S3 | S4 |
  |---|---|---|---|---|
  | RollStrong (est.) | 37W 18L, 75 Gold, #4, semi | 33W 22L, 68 Gold, #4, semi | 36W 20L, 94 Gold, #1, champion | 38W 18L, 96 Gold, #1, champion |
  | RollStrong2 (est.) | 35W 21L, 90 Gold, #1, champion | 38W 18L, 100 Gold, #1, champion | 42W 14L, 106 Gold, #1, champion | 36W 19L, 70 Gold, #4, semi |
  | RollStrong3 (est.) | 37W 19L, 96 Gold, #1, champion | 33W 21L, 64 Gold, #5 | 37W 19L, 82 Gold, #2, runner-up | 40W 15L, 77 Gold, #3, semi |
  | RollWeak (und.) | 19W 35L, 32 Bronze, #18 | 15W 39L, 29 Bronze, #19 | 14W 40L, 23 Bronze, #19 | 24W 30L, 51 Bronze, #12 |
  | RollWeak2 (und.) | 21W 33L, 38 Bronze, #16 | 15W 39L, 36 Bronze, #18 | 16W 38L, 33 Bronze, #18 | 19W 35L, 36 Bronze, #19 |
  | RollWeak3 (und.) | 12W 42L, 21 Bronze, #19 | 14W 40L, 30 Bronze, #19 | 14W 40L, 25 Bronze, #19 | 16W 38L, 30 Bronze, #19 |

  - Balances at the end of S4: established $3.98M-$4.35M; underdog $1.25M-$1.31M.
  - Every top-4 finish was Gold. RollStrong3's #5 at 64 was also Gold. Every underdog season (#12-#19,
    21-51 points) was Bronze.
  - In the first R-54 full run, which failed only on RollA (below): #1-#4 were Gold (66-96 points)
    and #6-#8 Silver (57-59).
  - Each next season's purse access equalled the tier just reached: 24 of 24 transitions.
  - The symptom this entry was filed for is gone. RollStrong used to finish #3-#4 at 37W 18L and
    41W 14L and end Silver on 22-30 points; a #3-#4 finish is now Gold on 68-77.

**Found on the way, for Rob (not changed):**
1. **An established club is sacked more often than the arcs show.**
   - In R-54's first full run, rollover's RollA walk (established) finished 7th twice and was
     sacked at the season-2 review. That is R-53 working as approved: two failed seasons running.
   - The walk was ruled out as a cause. A probe on a starter-DB copy (scratchpad
     `r54_rolla_probe.mjs`) ran two careers each way, RollA's skip-match walk and the arcs' walk:
     - skip-match careers: 0 forfeits and 0 unplayed matches; finishes #3, #1, #1, #5
     - an arc-style established career: #9 at 28W 26L
   - Across both R-54 runs, the #1-rated pair finished #6-#10 in 5 of 26 established seasons.
     Two in a row sacks. The arcs reported 0 of 3 sacked both times.
   - **Balance untouched.** RollA's walk exists to test ageing, retirement and promotion across all
     five boundaries, so it now runs as an underdog. Targets of #19 and #18 are met by any finish,
     so the board cannot end it before its season-5 verdict; the worst case is confidence 35.
2. **`harness/invariants.mjs` has been broken since R-29.** Not part of `run-all`.
   - Its I1/I4/I5 probe calls `opponentRatingFromTier(e.tier, e.opponent)`, but since R-29
     (5a91525) World Tour events have no `opponent`, so it crashes in `nameVariance`.
   - R-54 switched its tier model to the new rules. Its probes now read a temp copy of the starter
     DB; they used to open the committed file in place.
   - The opponent model is left alone. Offered as a separate task; not registered.
3. **Money.** Established balances at the end of S4 are $3.98M-$4.35M, against $2.55M-$3.12M in the
   R-53 run, because Gold purses now pay in full from season 2. Reported only.

### R-53 — CLOSED (14 Sep, 393cbac): board confidence reacted to the wrong things; the board now reviews seasons against expectations
**Symptom (R-48 full run 2):**
- RollWeak2 and RollWeak3 went 0W 54L in seasons 3 and 4, with $1.06M-$1.50M in the bank, and were
  never sacked.
- RollWeak was sacked at 7W 17L in season 1; earlier runs sacked underdogs at 4W 15L, 5W 15L and
  6W 16L.

**What board confidence actually measures (read from the code, nothing changed):**
- **Stored value:** `teams.board_confidence`, default 60 (`lib/db/src/schema/game.ts:189`), clamped
  0-100.
- **It is written in exactly three places, all results:**
  - **Win:** +3, or +8 for a Grand Final (`routes/matches.ts:813`, `winConfidenceDelta`). The +5
    "Continental Final" branch is dead: that tier is no longer on the schedule.
  - **Loss:** −5 (`routes/matches.ts:844`).
  - **Forfeit:** −5 (`recordForfeit` in `routes/matches.ts`).
- **The score shown and acted on is computed when read:** `clamp(stored + financeAdjustment(budget))`
  (`utils/board-confidence.ts:130-136`). The finance adjustment is:
  - +5 at $300k or more
  - 0 at $100k or more
  - −5 at $50k or more
  - −15 at $0 or more
  - −25 in debt
- **Stages** (`stageForScore`):
  - ≤0 sacked
  - <5 "forced sale pending"
  - <15 spending blocked
  - <30 warning
- **Sacking** is checked only after a result (`/simulate`, `/forfeit`).
- **The forced sale is never carried out.** The only code that touches it (`routes/board-confidence.ts:26-46`)
  names a target for display.

**What that means:**
1. **Money above $300k makes sacking impossible.**
   - The stored value floors at 0, and +5 lifts the score to 5: spending blocked, never sacked, at
     any record.
   - That is why RollWeak2 and RollWeak3 survived. Their season-1 results (15-39, 23-31) drove the
     stored value to 0, but they ended season 1 at $451,680 and $480,260.
   - The board-confidence-ladder suite asserts it as a property: "a healthy budget alone cannot reach
     forced_sale_pending or sacked".
2. **Under $300k an underdog's survival is a race between prize money and losses.**
   - An underdog starts at $150k (adjustment 0) and stored 60.
   - 7W 17L is 60 + 21 − 85 < 0, so the club was sacked at that result, still under $300k.
   - A similar record that banks $300k first cannot be sacked at all.
3. **The break-even win rate is 62.5%.** A win is +3 and a loss −5, so a club must win 5 of every 8
   matches just to hold steady.
   - This ignores difficulty, squad strength, tier, opponent, ranking and finishing position.
   - An established club finishing #7 at 32W 22L loses confidence (96 − 110 = −14).
   - An underdog doing better than anyone could expect of it still sinks.
4. **Nothing else is measured:**
   - no expectations by difficulty or tier
   - no season objective or season-end review
   - no trend, no decay or recovery over time
   - no weight for titles beyond a Grand Final win, and none for prize money or balance except the
     four absolute budget brackets (the same for underdog and established)
5. **A forfeit costs the same −5 as a lost match.** With the floor in point 1, a solvent club with no
   squad forfeits indefinitely with no consequence from the board.

**Design (14 Sep):** `docs/r53-design.md`. **Rob approved it as written**, with every proposed number
and the proposals for all five open questions: the 30-day abandonment rule stays, season 5 stays a
verdict that cannot sack, and the forced-sale label is deleted.

**Fixed: replaced, not layered.**
- **`utils/board-confidence.ts` rewritten:**
  - pure rules: target, grade (with the forfeited-half rule), honours, money, review outcome, freeze
    hysteresis
  - database steps: the season row, the target at the draw, `boardDay`, the forfeit count and
    abandonment, the review
  - the plain-word texts the player reads
- **New career-scoped table `board_seasons`:**
  - target inputs: pair rating, strength rank, allowance, money places, target
  - the monthly projection and freeze, forfeits, unfieldable-since
  - the review record
  - The starter DB gained exactly this table and its index (refresh diff); `deleteCareerSave` clears it.
- **Removed:**
  - the win +3/+5/+8 and loss −5 in `/simulate`
  - the −5 in `recordForfeit`
  - the post-result sacking in both
  - the sacking on `GET /board-confidence`
  - the `financeAdjustment` money bracket and `forcedSaleTarget`
  - the stages spending_blocked, forced_sale_pending and sacked
  - `BoardConfidenceBreakdown`
  - the R-09 widgets (`WarningBanner`, `BoardConfidenceBar`, `ConfidenceLadder`) and the dashboard
    and contract page's `careerEnded` redirects
  - `harness/board-confidence-ladder.mjs`
- **Where the rules now run:**
  - the target is set once the World Tour is drawn
  - the monthly check and the unfieldable tracking run in the calendar advance (`boardDay`)
  - a forfeit is counted, and sacks for abandonment, in `recordForfeit`
  - the review runs inside `rolloverSeason`: a sacking returns `kind: "sacked"` and opens no next
    season, the calendar route ends the career with the review as the dismissal text, and the next
    season's board row opens on the carried balance
- **`checkSpendingAllowed(careerSaveId)`** reads only the board's freeze. Signing, staff hire,
  facility upgrade and renewal at a raise are refused; same-terms renewal is allowed (R-52).
- **Player-facing:**
  - The dashboard always shows the board card: what the board expects, its verdict so far, and last
    season's review, in words. It was hidden while "safe".
  - The contract page shows the card and a "how the board judges you" explainer.
  - A review sacking at the boundary, or an abandonment sacking from Skip or Sim, routes to the
    career-end screen.
- **Spec:** `BoardConfidence` replaced (seasonYear, confidence, stage safe / warning /
  spending_freeze / final_warning, spendingBlocked, expectation, verdict, target, strengthRank,
  projection, lastReview). `MatchResult.fired` now means abandonment only. Codegen run.
- **Pair rating:** `sideRating` over the two best contracted, able players. That is the engine's own
  rating, the same one the pool clubs are ranked by. The underdog starting pair measures 65.0 (best
  two of its three) against the design's 63.8 for its two named starters; it ranks #19 either way.

**Verified:**
- **`harness/board-review.mjs` 50/50** (suite 15 of `run-all`):
  - **Table:** every §5 row (the six careers, plus RollWeak2's second failed season in S5 as a
    verdict) and every §5.1 case matches the design's M, T, grade, confidence and outcome through
    the server's own rules (`POST /dev/board/review-table`, dev-only). So do money-never-immunity
    ($5M, sacked for two failed seasons at confidence 30), debt −15, a >25% fall −5 (20% costs
    nothing), 27 of 54 forfeited as failed badly (26 judged on the finish), and the clamp at 100.
  - **Projection thresholds:** 45 warns, 30 freezes, a freeze holds between 30 and 35, lifts above
    35. RollWeak3's mid-season #19 against T19 is met, with no warning.
  - **Target at the draw:** established pair 89.5, strength #1, target #2; underdog strength #19,
    target #19. Both are stated in words.
  - **Sabotage, live:** a win, a loss and a forfeit each left confidence at 60; the forfeit was
    counted. At confidence 0, five more results fired nobody.
  - **Sabotage, static:** none of the old code remains in 460 api, frontend, generated and spec
    files. Each of five old lines planted back is caught.
  - **Monthly check:** 30 game days after the target, the underdog at confidence 0 projected #15
    exceeded, and was frozen. A signing got 403; a same-terms renewal got 200.
  - **Abandonment:** forfeits on days 0-28 did not sack; the day-33 forfeit did, and the career
    ended with the reason.
  - **Season review:** the underdog at confidence 0 finished #19 against T19 (met, 0 → 5) and was
    sacked at the boundary. No 2027 season opened, the career was retired, and the dismissal carries
    the review.
- **Other suites:** squad-forfeit 11/11 (forfeit leaves confidence unchanged, counted by the board);
  contract-renewal 23/23 (the freeze now lives on `board_seasons`).
- **Checks:** `pnpm run typecheck` with every guard clean. Full harness **24/24**, rollover **72/72**
  ("the board reviewed every season it closed", 5/5 for all six careers).
- **The new arc: nobody sacked** (0 of 3 in each arc). Reviews per season (finish against target →
  confidence):

  | career | S1 | S2 | S3 | S4 | S5 (verdict) |
  |---|---|---|---|---|---|
  | RollStrong (est.) | #1 vs 2, champion → 80 | #10 vs 2, failed → 55, **final warning** | #4 vs 2, semi → 49 | #2 vs 2, runner-up → 62 | #2, runner-up → 75 |
  | RollStrong2 (est.) | #1, semi → 69 | #1, champion → 89 | #8 vs 2, failed → 64, **final warning** | #3, semi → 73 | #2, runner-up → 86 |
  | RollStrong3 (est.) | #1, champion → 80 | #2, runner-up → 93 | #1, champion → 100 | #4, semi → 94 | #1, champion → 100 |
  | RollWeak (und.) | #14 vs 19, far exceeded → 80 | #17 vs 18, met → 85 | #19 vs 16, missed → 75 | #19 vs 14, failed → 50, **final warning** | #19 vs 13, failed → 25 (a second failed season; the verdict cannot sack) |
  | RollWeak2 (und.) | #16 vs 19, exceeded → 70 | #19 vs 18, met → 75 | #15 vs 17, exceeded → 85 | #18 vs 15, missed → 75 | #15 vs 13, missed → 65 |
  | RollWeak3 (und.) | #19 vs 19, met → 65 | #18 vs 18, met → 70 | #19 vs 17, missed → 60 | #19 vs 15, missed → 50 | #14 vs 13, met → 55 |

**Known and accepted, then it happened:** the rollover suite's RollA walk (ageing, retirement,
promotion over five boundaries) plays real matches, and an established club is sackable at a review
(two failed seasons running, or confidence falling to 20). It did not happen in this run. It did in
R-54's first full run (RollA finished 7th twice and was sacked at the season-2 review). R-54 made the
walk an underdog; see R-54's findings.

### R-41 — CLOSED (12 Sep, with R-29): `harness/run-all.mjs` had not parsed since R-38
From `39148cb` (R-38, 11 Sep) until R-29's commit, the full harness could not run at all. Suite 9's
header held a real line break inside a JavaScript string (`console.log("` on one line,
`########## 9/17 …");` on the next). `node harness/run-all.mjs` died with
`SyntaxError: missing ) after argument list` before running a single suite.

No register entry claimed a full run in that window — R-38 and R-40 each report only the suites they
ran individually — so no false green was recorded. But nothing caught the break either.

**Cause, found while repairing it:** text passed to the Bash tool has its double backslashes
collapsed. A `\\n` meant to arrive as the two characters `\n` arrives as a real newline. The R-38
change went through a shell heredoc, and my first three repair attempts failed for exactly the
same reason: each "fixed" the line by writing the line break back in.

**Fix:** repaired with the Edit tool; `node --check` clean. The full harness then ran green end to
end: **18/18**.

**Rule:** edit anything containing backslash escapes with Write/Edit, never through a shell
command, and run `node --check` on a harness file after touching it.

### R-42 — CLOSED (14 Sep, 06488d3): trophies are written at the season boundary
**Rob's brief (overnight batch item 2):** trophies written at season end — World Tour tier titles,
World Finals placings, Olympics — into the trophies table, shown on the club page and the season
review. Harness: a champion season produces exactly the right rows; a fresh career has none.

**Fix:** `utils/seasonTrophies.ts`, called once inside `rolloverSeason`'s transaction right after
the board review (the honours stand whatever the board decided; idempotent per team and year):

| Happened | type | name |
|---|---|---|
| Won the World Final | `world_championship` | World Champions 2026 |
| Lost the World Final | `runner_up` | World Final runner-up 2026 |
| Lost a World Semi Final | `bronze` | World Finals semi-finalist 2026 |
| Season finished Silver / Gold on ranking points (R-54) | `world_tour_tier` | World Tour Gold tier 2026 (notes: the points) |

The placings come from `worldFinalsSummaryTx` (the real round 71/72 fixtures), the tier from the
season's `competitor_rankings` row through `tierForPoints`. Bronze is where every club starts, so it
earns nothing.
- Club page (Trophy Cabinet tab): new row "World Tour Silver / Gold tier seasons"
  (`honours.worldTourTiers`, spec `ClubHonours`); the existing rows relabelled to what they now hold
  — "World Champions (World Final wins)", "World Final Runner-Ups", "World Finals Semi-Finals".
- Season review: `/seasons/:year/review` returns `trophies`; the dialog shows "Honours won".
- `history.ts` season summary: `bronze` now reads "World Finals semi-finalist", not "3rd Place".
- Every other reader filters by type (`careerLifecycle`, `players.ts` legend score,
  `check-achievements`), so tier rows inflate no title count.

**Olympics: NOT written — no real source.** This build plays no Olympic tournament:
`/olympics/schedule` re-rolls its "results" with `Math.random` on every read. Awarding a medal from
that would be R-43's fabrication in trophy form. The Olympic cabinet row and the `olympic_gold`
achievement stay at zero until a real Olympic tournament exists (listed in RELEASE-STATUS).

**Harness (new):** `harness/trophies.mjs`, run-all 24/26 (smoke 25/26, rollover 26/26). 10/10:
fresh career 0 rows and every cabinet row empty; real established season-1 careers each get exactly
their earned rows (Trophy1 did not qualify, 59 pts → Silver tier only; Trophy2 champion, 92 pts →
World Champions 2026 + Gold tier); the season review and cabinet show the same rows. Runner-up and
semi-finalist are covered by the same rule function but did not occur live in this run.

**Full harness: 24/26.** Neither failure is R-42:
- board review 57/58 — R-57, the section-5 clock start (registered with the evidence).
- save folder migration 3/7 — the run was launched with `ELECTRON_RUN_AS_NODE=1` in the parent
  environment, and the R-23 suite hands its environment to REAL Electron: `electron/main.js:34`
  "Cannot read properties of undefined (reading 'getPath')". Rerun standalone without it: 7/7.
  **Rule:** launch `run-all` without `ELECTRON_RUN_AS_NODE`; every server suite sets it for its own child.

Rollover 78/78; season trophies 20/20 in the full run. Five-season table: every season crowned a
champion from the field; established 0 of 3 sacked (season-1 champions RollStrong, RollStrong2,
RollStrong3; RollStrong3 champion again in season 4), underdog 0 of 3 (#16–#19 every season,
Bronze).

Original entry:
No code in `artifacts/api-server` inserts into `trophies`; it is only read:
`routes/trophies.ts`, `routes/history.ts:128,202`, `routes/players.ts:509`,
`utils/careerLifecycle.ts:36`, `utils/check-achievements.ts:58`, `routes/news.ts`.

So these are permanently empty: the Trophy Cabinet, "Titles Won", the trophy news items, the Hall
of Fame archive's trophy count, and the `olympic_gold` achievement.

R-29 now produces a real World Champion every season (`world_tour_fixtures`, round 72), which is
the natural source for a world-championship trophy. Registered 12 Sep; not fixed this weekend.

### R-43 — CLOSED (14 Sep, b8f730a): invented content deleted, not stubbed
**Rob's brief (overnight batch item 3):** delete the fabricated news generator, fake manager moves
and fake youth results. Replace only with what real events can generate (results, signings,
renewals, sackings, trophies); anything with no real source is removed, not stubbed. Report what was
deleted.

**Deleted — whole files (2,850 lines):**

| File | Lines | What it was |
|---|---|---|
| `routes/youth-league.ts` | 392 | youth "Development League": Math.random win/draw/loss, opponents from a hardcoded name list, an AI ladder ticking at random, a coin-flip championship |
| `routes/ai-managers.ts` | 240 | "Manager Movements": invented managers and clubs moving on a random tick |
| `routes/poaching.ts` | 261 | poaching offers from a hardcoded club pool; accepting created a club with no squad and no fixtures |
| `pages/youth-league.tsx` | 417 | Youth League hub (results, ladder, stars, championship) |
| `pages/youth-results.tsx` | 427 | the same, as a second page |
| `pages/job-market.tsx` | 850 | hardcoded job listings; applying created a club with no squad and no fixtures |
| `components/career/PoachingInbox.tsx` | 263 | the dashboard's poaching approach card |

**Deleted — in place:**
- `routes/news.ts`: the day-seeded world news generator and every pool it drew from (nations,
  tournaments, first/last names, staff roles, injuries, facilities, records). Also the "real" player
  and staff signing items, which were dated by the reference rows' `createdAt` — not events.
- `routes/careers.ts`: `POST /careers/apply-job`.
- `routes/olympics.ts`: `simResult` and every Olympic-year score, group table and medallist it filled
  in (re-rolled on each read). The schedule is the projected draw only.
- `routes/events.ts`: the Youth League upcoming-event item. `routes/history.ts`: youth standings and
  the youth result. `routes/matches.ts`: the youth champion lookup for the season summary.
- Schema: tables `youth_league_results`, `youth_ladder`, `youth_championship_trophies`,
  `poaching_offers`, `ai_managers`, `ai_manager_events`; column `manager_season_summaries.youth_result`.
- Spec: 9 paths and their schemas (`ApplyJob*`, `Poaching*`, `AcceptPoachingResult`, `AiManager*`,
  `WorldTourNews*`, `Youth{Ladder,Star,Championship,LeagueResult}*`, `HistoryYouthRow`, `youthResult`,
  the `youth_league` event type).
- Frontend: dashboard World Tour News panel, Manager Movements panel and poaching card; league-ladders
  Youth tab, youth standings, youth result badge and column, and `mockForm` (a form strip hashed from
  a club name); youth-academy "Development League" section; leaderboard "Reputation Bonus — Next tier
  at 2,500 REP" card; Career Options' Job Market; nav "Youth League"; routes `/youth-league`,
  `/youth-results`, `/job-market`; career-history's "Offer Accepted" entry type.

**Replaced with real sources only:**
- **Club News** (`GET /news`, dashboard): every item names its row and carries that row's game date —
  `result-<match>` (the club's completed matches), `signing-<contract>` (contracts, dated on the game
  clock since R-51), `board-<board season>` (season reviews), `trophy-<trophy>` (R-42 honours),
  `champion-<year>` (that season's World Final). Renewals are NOT listed: a renewal updates the
  contract in place and records no date. Sackings end the career, so the dashboard never shows one.
- **Academy development** (`utils/academyDevelopment.ts`) stays without the invented result: weekly XP
  is the old roll's average for the rating band (21 / 19 / 16), focus points unchanged, morale no
  longer moves (it only ever moved on the invented result).
- **Older saves**: `utils/removedContent.ts` drops the six tables and the column at boot — their rows
  reference teams, users and career saves, and would otherwise block a profile's deletion. Starter
  database refreshed (47 tables; only those removed, no row changes).

**Consequences — recorded, not papered over:**
- Resign and Break Contract still end the job, but the Job Market was the only way to another club:
  the save is left without a club. Career Management (new or load) is the way on. Listed for Rob in
  RELEASE-STATUS.
- Youth players develop; there is no youth competition to watch.
- The Olympics have a projected draw and no tournament, medals or Olympic trophies (see R-42).
- `make-starter-db.ts`: a source save from before R-43 must be booted once first.

**Harness (new):** `harness/fake-content-removed.mjs`, run-all 25/27. 11/11: none of it in 490 api,
frontend, spec, schema, script and generated files (a planted line of each of 9 patterns caught);
nothing of the removed screens in the built bundle; starter clean; an older save with rows in all six
tables loses them at boot and its profile deletes (HTTP 200); 9 removed endpoints 404; after 6 match
days 9 news items (6 results, 3 signings), each traced to its row and date; the Olympic schedule's 20
matches unscored and identical across reads. First run 9/11 — both failures were the new suite's own
mistakes (it counted a split string as a seventh table; it expected 22 Olympic matches, there are 20).

**Full harness: 26/27** (launched without `ELECTRON_RUN_AS_NODE`; save folder migration passed). The
one failure is not R-43: injuries and fitness 26/27, R-59 — a random injury from the suite's own
simulated matches reached its rest-day player. Rerun standalone: 27/27. Board review 58/58 and
migration fixtures 62/62 inside the run (R-57, R-49). Rollover 78/78; five-season table: every
season crowned a champion from the field; established 0 of 3 sacked (RollStrong champion in seasons 1
and 2, RollStrong2 champion in seasons 1 and 2, RollStrong3 #3, #2, #12, #2), underdog 0 of 3 (#14–#19,
every season met).

Original entry:
Each of these is presented as a record of something that happened:
- **World Tour News:** `routes/news.ts` `generateWorldNews`, a day-seeded RNG over hardcoded names
  and tournaments, merged indistinguishably with the player's real items.
- **Manager Movements:** `routes/ai-managers.ts`, randomly seeded managers and random moves.
- **The youth league:** a hardcoded AI ladder with random W/L, hardcoded opposition names,
  `Math.random` results, and a youth form strip from `mockForm`, a hash of the club name.
- **Job Market:** listings hardcoded in `pages/job-market.tsx`.
- **Leaderboard:** the "Reputation Bonus — Next tier at 2,500 REP" card, backed by nothing.

File lines are in `docs/r10-audit.md` §1. Registered 12 Sep; not fixed. The youth league has the
same shape R-29 fixed for seniors and should follow the same design.

### R-44 — CLOSED (14 Sep, the commit carrying this entry): World Tour byes (Rob's decision on WEEKEND-STATUS Q1)
**Decision (Rob):** keep the 19-club field (18 AI + the player). The resting club each round gets an
explicit BYE: it appears in that club's fixture list and in the round view as "Bye", never as a
missing match, and a bye earns 0 points. If the player's club has the bye, the dashboard's Next Match
card says so and Advance still works. Harness: over a full season every club has exactly the same
number of matches and exactly one bye per 19 rounds.

**Arithmetic, and Rob's follow-up choice:** the regular World Tour had 60 rounds. 60 is not a multiple
of 19, so "same matches for every club" and "exactly one bye per 19 rounds" cannot both hold over 60.
Rob chose **57 rounds** (three full cycles): every club plays 54 matches and has 3 byes. Three Bronze
events came off: the three smallest purses in the game, from three different continents:
- round 41 Hurghada Red Sea Open ($6,000)
- round 51 Cancún Open ($5,000)
- round 61 Cartagena Beach Cup ($6,000)

Their slots are open dates; no other event moved.

Measured from `data/worldTour.ts` before and after:
- Bronze: 30 events / $231,500 → 27 / $214,500 (smallest purse left: $6,500)
- season: 62 events / $1,615,000 → 59 / $1,598,000

**Design:**
- The draw is a true circle-method round robin over all 19 entrants (the player is one of them) with
  a BYE slot. The old draw kept the player out of the rotation, so the player never rested.
- A bye is a stored `world_tour_fixtures` row with status `bye` and home = away (both columns are NOT
  NULL; no schema change).
- The player's bye is its `matches` row set to status `bye`, opponent "Bye", prize 0, linked by
  `match_id`.
- No points are credited for a bye.
- A rotation offset puts the player's byes in its 11th, 30th and 49th World Tour rounds rather than
  the first.
- A pre-R-44 fixture's unplayed player rows on the removed rounds are deleted at draw time. A season
  already drawn keeps its draw.

**What changed:**
- `data/worldTour.ts`: the three events are removed.
- `utils/worldTour.ts`:
  - `WORLD_TOUR_EVENT_ROUNDS` comes from the schedule
  - a new `roundPairings(entrants, k)` and `drawWorldTourTx` with bye rows
  - `BYE` / `BYE_MESSAGE`
  - `worldTourGate` refuses a bye (409)
- `routes/world-tour.ts`: every fixture carries `bye`. `resting` is read from the bye row rather than
  inferred, and `eventRounds` is returned.
- `routes/dashboard.ts`:
  - `nextBye` is the club's next bye, when it has not passed (`round >= season.currentRound`) and
    comes before the next match
  - `nextMatch` is now ordered by round; it had no order before
- `routes/seasons.ts`: the review carries `fixture.byes`.
- `routes/calendar.ts`: the season structure is counted from the schedule, and a bye day's event
  reads "Bye — your club rests this round".
- OpenAPI: Match status gains `bye`, and Dashboard gains `nextBye` (codegen rerun).
- Frontend:
  - the Next Match card says "Bye — Round N · Your club rests this round · Advance carries on"
  - the fixture list has a Bye card
  - the finals unlock treats a bye as done
  - WT Fixtures shows a Bye card and only offers event rounds (numbered "WT Round 1–57")
  - the rules page's World Tour card describes 19 clubs, 57 rounds, 54 matches and 3 byes
- Comments and docs: calendarSlots, tierQualification (29 -> 45 -> 59 events), economy-design.

**Harness:**
- **New `harness/world-tour-byes.mjs`, 18/18.** One fresh career walked through the whole regular
  World Tour by the calendar:
  - 57 rounds; slots 41/51/61 empty
  - every round 9 matches + 1 bye
  - all 19 clubs exactly 54 matches and 3 byes, one per 19-round cycle
  - every ranking row W+L = 54, points = a recomputation from matches alone
  - the player's 3 byes (R21, R40, R62) on its fixture list as "Bye" with no purse, linked to the
    bye rows
  - the round view shows the club's Bye
  - `GET /dashboard` reported the bye before round 21 (next match 22)
  - no pending match ever pointed at a bye
  - the field played every round the player sat out
- `world-tour-competitors.mjs` now reads bye rows (38/38).
- `fixture-transaction.mjs`'s sabotage trigger moved to round 42, because round 41 no longer exists.
- `rollover.mjs` subtracts byes from the entitled count.
- **Full harness 19/19 suites passed.** R-08 arc: every season 54/59 played (56/59 in RollStrong's
  title season), every season entitled-match check passing.

Left as is:
- The fixture endpoint returns a bye's purse as null rather than 0; the Bye card shows no purse.
- A season already drawn before this change keeps its bye-less draw.
- Screen check is Rob's (R-39).

### R-45 — CLOSED (14 Sep, the commit carrying this entry): All-Star events removed (Rob's decision on WEEKEND-STATUS Q2)
**Decision (Rob):** delete every remnant of the All-Star events: fixture generation, events,
tables/columns used only for them, UI references. Report the list before deleting and the new season
length, and park "All-Star events" in docs/triage.md under V2 ideas.

**Found:**
- No All-Star event has been on the schedule since the 78-slot season (`data/worldTour.ts` holds
  none), so no fixture ever contained one.
- The remnants were special cases for a match that could not exist, the page that waited for it
  forever, and a player stat nothing could raise.
- No table or column existed only for it.

**Deleted (the list was reported before deleting):**
- **Server:**
  - `data/worldTour.ts`: the `Tier` entry and its comment
  - `seasonFixture.ts`: the `FINALS_TIERS` entry and the "Europe / Asia / Oceania All-Stars" home-side branch
  - `routes/matches.ts`: the `isAllStar` flag, its crowd highlight, the zero-prize case, the
    ranking-credit guard, the whole All-Star early-return result, and the forfeit guard
  - `game-api.ts`: the Unity result route's guard
  - `utils/worldTour.ts`: the `worldTourGate` pass-through
  - `rankingPoints.ts`: `"All-Star Match": 0`
  - `tierQualification.ts`: `EXHIBITION_TIERS` and the `"exhibition"` eligibility reason
  - `matchEngine.ts`: tier rating 84
  - `prizeDistribution.ts`: the "exhibition" comment
- **Frontend:**
  - `pages/competition/all-star.tsx` (the file), its `App.tsx` route, the shell nav item, and the
    World Tour hub tab
  - `matches.tsx`: the `WORLD_FINALS_TIERS` entry, plus `WorldFinalsMatchCard`'s `isExhibition`
    styling, badge and "Watch All-Star Match" button
- **Data:** `players.player_v4` `career_stats.all_star_selections`, 0 for all 276 players.
  - Removed from the schema type, the OpenAPI spec (clients regenerated), `seed-player-v4.ts`, and
    the shipped starter DB.
  - In the starter DB, `json_remove` ran on 276 rows. Each row was verified inside the transaction
    to differ by that key only, and the WAL was checkpointed into the file.
  - Existing saves lose the key on their next launch through R-33's reference update, which copies
    `player_v4`. That was proven on a copy; the live save was not opened.
- **Scripts/harness:** `migrate-season-78.ts`'s `Tier` type; the world-tour-competitors mirror entry.
- **Docs:** `docs/triage.md` §6 "V2 ideas: All-Star events"; a note on economy-design's hub tab list.
  `r10-audit.md`, `WEEKEND-STATUS.md` and this register are left as dated records.

**Season length:** 59 = 57 World Tour rounds (R-44) + World Semi Final + World Final. R-45 does not
change it, because the fixture never had an All-Star row.

**Harness: new `harness/all-star-removed.mjs`, 12/12:**
- a fresh career has 59 fixtures and 0 All-Star, through the API and in the DB
- no line of source, schema, spec, generated client, script or harness mentions an All-Star (only
  the suite itself and run-all's registration line are exempt)
- the built server bundle and the served frontend are clean
- no table, column or value in the shipped starter DB mentions one
- a pre-R-45 save (the key restored on a copy) loses it on boot through R-33, with every
  `player_v4` then byte-identical to the shipped one
- sabotage S1–S3 fail as they must

**Full harness: 19 of 20 suites passed.** Season rollover failed: RollWeak (underdog) was legitimately
sacked mid-season 1, and the arc harness cannot continue past a sacking (R-47 below).

On the same build, run-all's suites 19+20 were reproduced twice on one server:
- run 1: smoke 72/72, rollover 40/40
- run 2: the same sacking

No All-Star code path can run (no All-Star match exists), so the sacking is not caused by R-45.

### R-47 — CLOSED (14 Sep, 04f7830): the R-08 arc treats a sacking as a legitimate result and reports the sack rate per arc
**What happens:**
- `harness/rollover.mjs`'s R-08 section walks an established and an underdog career through five
  seasons.
- When the underdog's losses drive board confidence to zero, the R-09 fail state correctly ends the
  career on that result (`fired: true`, a dismissal history entry, the session cleared).
- The harness ignores `fired` and fails on its next advance with an opaque
  `advance failed: {"error":"No active team"}`.

**Evidence (kept diagnostic DB copy):**
- RollWeak FC: 6W 16L, `board_confidence` 0, `retired_at` set.
- History: "RollWeak was sacked by RollWeak FC after board confidence collapsed to zero."
- Last match: round 33, lost 0-2.
- Seen in 4 of 7 rollover runs on 14 Sep: the R-45 and R-46 full runs, and run 2 of each two-run
  reproduction. Passed in the R-44 full run and run 1 of each reproduction.
- Both failures whose databases were kept were this sacking in season 1: 6W 16L (R-45 build) and
  5W 15L (R-46 build), board confidence 0. run-all deletes its own copy, so its two failures were
  matched by signature only (the underdog arc's advance → "No active team" after RollStrong completed).

**Not measured:** whether the sacking rate changed with R-29 (real opponents) or R-44 (57 rounds).

**Decision needed (game design):** is an underdog squad being sacked in season 1 this often intended?
- **If yes:** the R-08 arc has to treat a sacking as an outcome, and the weak arc then cannot measure
  five seasons.
- **If no:** the R-09/R-11 balance changes.

Until decided, a full harness run can fail on this by chance. Nothing was changed for it.

**Decision (Rob, 14 Sep):** the harness treats a sacking as a legitimate result and reports the sack
rate per arc. Board-confidence balance is NOT to change yet.

**What changed (`harness/rollover.mjs` only; nothing in the game):**
- `advanceToBoundaryPlaying` stops at a result that comes back `fired: true`. The season's record is
  counted from the results themselves, because after a sacking the career's session has no team to
  read.
- Each arc runs `ARC_CAREERS` = 3 careers, each to the end of the arc or to its sacking.
  - The first career is still the one the summary table shows.
  - That table prints "SACKED after …" in the season it happened.
- The checks apply to every career:
  - every season it played is measured: all 4, or every season before its sacking
  - the entitled-matches, walkover, World Final and champion checks run over every full season
- A new report, "Sackings per arc", gives sacked-of-3 careers per arc, with each career's records.

**Verified: full harness 21/21; season rollover 60/60 in 233.5 s (was 113 s).** The sacking path ran
in this run: RollWeak was sacked in season 1 after 4W 15L, and it was reported, not failed.

| arc | sacked | careers (season records) |
|---|---|---|
| Strong (established) | 0 of 3 | 38-17, 8-46, 19-35, 10-44 · 34-21, 17-37, 11-43, 14-40 · 39-16, 19-35, 13-41, 13-41 |
| Weak (underdog) | 1 of 3 | sacked S1 after 4-15 · 15-39, 15-39, 14-40, 9-45 · 22-32, 13-41, 19-35, 9-45 |

Every established career went from #1 in season 1 to #16-#19 from season 2 on: that is R-48.

### R-46 — CLOSED (14 Sep, 93ba82b): Olympic qualification on this season's World Tour ranking points (Rob's decision on WEEKEND-STATUS Q3)
**Decision (Rob):**
- The Olympics are NATIONAL teams.
- A country qualifies on the World Tour ranking points its players earned THIS SEASON: the sum
  across that country's players, whichever club they play for.
- The top 12 countries qualify; ties are broken by best single-player total.
- Player ratings play no part in qualifying.
- The in-game rules page must say exactly this.
- Harness: two seasons where a high-rated country earns few points and a low-rated country many; the
  low-rated one qualifies and the high-rated one doesn't; the rules text is asserted.

**Found (read before designing):**
- `routes/olympics.ts` `buildQualifierStandings` gave per-continent spots (Europe 3, Asia 2, North
  America 2, South America 2, Africa & Middle East 2, Oceania 1), ranked by the average rating of each
  nation's two best players. Ranking points played no part.
- `getOlympicsYear` read the newest season row in the whole database, not the career's.
- No per-player points existed: `competitor_rankings` holds a club's total only.
- One country had two spellings. Pool players (the AI clubs' 120 players) store demonyms ("German",
  "Argentine", 42 values), while seniors store country names. `DEMONYM_TO_COUNTRY` covers 20 staff
  demonyms. The country-code table in continents.ts resolves all but "Hawaiian", "Emirati" and "Saudi".

**Design:**
- **New table `player_ranking_points`** (career, season, club, player or pool player, points,
  matches), written by `creditCompetitorTx` on every credited result.
  - An AI club credits its two pool players; the player's club credits its two starters
    (`squad_role = 'starter'`).
  - The same points after the same tier gate, so the players' points are the club's.
- **Nations:** `nationName()` in continents.ts resolves every spelling to one nation.
  - Hawaiian → USA (Hawaii is a US state).
  - Emirati → UAE and Saudi → Saudi Arabia get country codes.
  - An unresolved value is shown under its own spelling, never dropped.
- **Qualification:** new `utils/olympicQualification.ts`.
  - Order: total points, then best single player, then country name (only so an exact tie gives one
    stable table).
  - Top 12 qualify.
  - The schedule draws the 12 in qualifying order and simulates by points; ratings are no longer used
    anywhere in the Olympics.
- **Rules page, Olympics card:**
  - "The Olympics are for national teams, not clubs"
  - "A country qualifies on the World Tour ranking points its players earned this season: the sum
    across all of that country's players, whichever club they play for"
  - "The top 12 countries qualify; ties are broken by the best single-player total"
  - "Player ratings play no part in qualifying"

**What changed:**
- **Schema:** `player_ranking_points`. The starter DB carries it: a boot-and-diff on a copy showed the
  table and its index as the only difference, and check-starter-db now reads 52 tables.
- **`utils/rankingPoints.ts`:** `creditPlayersTx`, called from `creditCompetitorTx` on both its
  branches.
- **`lib/db/src/schema/continents.ts`:**
  - `nationName()`
  - Hawaiian → US; Emirati → AE; Saudi → SA
  - the CZ name order, so the nation is "Czech Republic"
- **New `utils/olympicQualification.ts`.**
- **`routes/olympics.ts`:**
  - qualifiers and schedule rewritten
  - both now refuse an unauthenticated request and read the career's own season
  - `buildQualifierStandings`, `CONTINENT_SPOTS` and `CONTINENT_ORDER` deleted
- **`deleteCareerSave`:** now clears the new table.
- **Frontend:**
  - Olympic Qualifying is one national table with the qualification line, each nation's points, best
    single player, and players with their clubs
  - the dashboard widget shows the top 12 by points
  - the schedule type and the rules page Olympics card are updated
- **`.agents/memory/olympic-qualifier-system.md`** rewritten.

**Harness: new `harness/olympic-qualification.mjs`, 29/29:**
- **Real play:** World Tour rounds 11-16 through the calendar.
  - Each of the 18 AI clubs' two players holds exactly the club's points and matches.
  - The player's two starters each hold what the club earned (25 incl. a head start of 20 → 5 each)
    and its 6 matches.
  - 38 rows, nobody else.
- **Nations:** 312 players resolve to 69 nations, none twice. German + Germany are one country, and
  Hawaii's pair is in USA.
- **Season 2026:**
  - Malaysia (rated 69.4) earns 25 at its pool club + 20 at the player's club = 45 and qualifies,
    rank 1.
  - Brazil (rated 88.5) earns 5: rank 14, out.
  - Malaysia is in only through the sum: best single 25 < 12th place 40.
  - Argentina, tied on 40 with best 20, is out at 13th behind eleven 40s with best 40.
  - The schedule draws exactly the 12.
  - Sabotage S1: ranking by rating would have put Brazil in and Malaysia out.
- **Ratings:** Brazil's players set to 99 and Malaysia's to 40 leave the table byte-identical.
- **Season 2027:** Venezuela (70.3) earns 60 and qualifies, rank 1. Brazil (3) is out at 13.
  Malaysia's 2026 points do not carry (0, rank 33).
- **Rules:** the four lines are in `rules.tsx` and in the shipped bundle, and "Top 12 World Tour
  teams qualify" is gone from both.

Seasons 2026/2027's point rows are written directly into a DB copy (the only way to make the scenario
exact). The real-play section proves play writes the same rows.

**Full harness: 20 of 21 suites passed**, olympic-qualification included. Season rollover failed on
R-47 again: RollWeak got "No active team" after RollStrong completed its arc.

On the same build, run-all's suites 20+21 were reproduced twice on one server:
- **Run 1:** smoke 72/72, rollover 40/40. Both arcs covered all four measured seasons, and every
  season played every match it was entitled to.
- **Run 2:** RollWeak sacked in season 1 (5W 15L, board confidence 0, dismissal entry, retired_at).
  Up to the sacking that career held 38 `player_ranking_points` rows. Its two starters held 3 points
  over 20 matches each, exactly the club's 3 points and 5W 15L, so R-46's credit path ran on every
  result.

**Left as is:**
- Screen check is Rob's (R-39).
- `/olympics/countries` (the squad picker) still groups senior players by stored nationality. It
  plays no part in qualifying.

### R-29 — CLOSED (12 Sep, the commit carrying this entry): the World Tour is a real competition, per career
World Tour Standings read "1 teams", the World Finals bracket seeded the player #1 with every other
slot TBD, and the fixtures header said "18 qualified teams" while the ladder held one. Rob's decision
(weekend brief) was one competitor per AI club per career, every AI fixture through the same
engine, points from the same table, and standings and finals seeding read from those rows only.
Design written and committed before any code: `docs/r29-design.md` (`b93e589`).

**Found (beyond the note above):**
- **The old AI-results path was a cross-career write.** `autoSimulateAIMatches` ran a 55% coin flip
  over every *other* team's scheduled matches in the database — other careers' fixtures included —
  and wrote those teams' wins and losses.
- `POST /calendar/skip-match` wrote a random 2-1 or 1-2 onto the match: no engine, no ranking.
- `world_tour_qualifications.career_save_id` was never written, and
  `GET /regional-league/qualifications` returned every career's rows.
- The regional league rated clubs `100 - (poolRanking - 1) * 8` (100 down to 28).
- `resolveOpponentRating` looked pool clubs up by name, and no World Tour opponent name was ever a
  pool club.
- `getWorldFinalsSeedings` used every team in the database, by wins, padded with nine hardcoded
  names.
- Both final-standings snapshots (rollover and the World Final branch) ranked every team in the
  database by `wins * 3`.
- The ladder and leaderboard INNER JOINed `teams`, so an AI club could never appear.
- On screen: the form strip was a hash of the club name; two screens re-sorted the ladder by their
  own rule; there were invented quarter-final and round-of-16 bands, and a third-place playoff.

**Built:**
- `world_tour_fixtures`, one career-scoped table holding every World Tour result, AI and player
  alike. The player's own games stay in `matches` and are linked by `match_id`.
- `utils/worldTour.ts`:
  - **field:** this career's 18 qualifiers + its club
  - **draw:** rounds 11–70 up front; each club meets the player and rests 3–4 times a season
  - **AI fixtures:** `pointProbability` → `simulateMatch`, with each club rated by `sideRating`
    over its own two players
  - **scoring:** a shared `creditCompetitorTx`, so AI clubs and the player are scored by one table
    and one gate
  - one standings function for every reader; finals seeded top 4 (1v4, 2v3); a gate used by
    simulate, watch, forfeit and the Unity result route
- The opponent is credited on every path a player match completes by, including forfeit, which
  previously credited nobody in the ranking table.
- Screens: WT Fixtures (every fixture, who rests), WT Standings, World Finals (real bracket and
  champion), Leaderboard, League Ladders, Dashboard, the Matches finals cards, and skip
  (simulate, then advance).
- API spec and client regenerated. The starter DB carries the new table; a boot-and-diff showed it
  and its two indexes as the only difference.

**Behaviour to know about:**
- A World Tour match cannot be played, watched, forfeited or reported before the field is drawn.
  That returns a 409 with the reason, because the rules page decides the field after round 10.
- A finals match the club did not reach is `not_qualified`: never played, never paid.
- Before the draw the ladder is the player's own row (R-26 kept).
- The dashboard's `seasonStanding.points` is now ranking points, not `wins * 3`.

**Proof:**
- `harness/world-tour-competitors.mjs` **38/38**, two careers × 12 rounds:
  - a field of 19; 9 fixtures plus 1 rest per round; 108 legal results per career
  - every one of 19 ranking rows' W/L and points equal to an independent recomputation (tier table
    + gate, round order)
  - standings order checked
  - B's play wrote nothing to A's 62 matches
  - **sabotage:** the one-row ladder and a +1 point were both caught
- `rollover.mjs` R-08, Rob's pass condition — the player does not win every season by default:

| Season | Established: record / rank / finals | Underdog: record / rank / finals |
|---|---|---|
| 1 | 34W 28L / #1 / **champion** | 25W 35L / #14 / did not qualify |
| 2 | 19W 41L / #17 / did not qualify | 22W 38L / #16 / did not qualify |
| 3 | 16W 44L / #19 / did not qualify | 15W 45L / #18 / did not qualify |
| 4 | 13W 47L / #19 / did not qualify | 14W 46L / #17 / did not qualify |

  Eight different real champions came from the field. The established squad's fall after season 1
  is partly the harness's own doing (it never signs or trains) and is reported, not tuned — balance
  is Rob's.
- **Full harness 18/18** (first full run since R-38 — see R-41) and root typecheck clean.

**Harness changes, deliberate:**
- smoke R-20/R-06: "only F's own competitors — its club plus AI clubs, never another career's team".
- rollover: plays before skipping; "every match the club was entitled to" (the fixture less finals it
  did not reach); a finals table and the not-every-season check.
- R-32 tick fallback and the R-09 board ladder walk the calendar to the first World Tour day first.

**Not done (follow-ups):**
- WT Results still lists only the player's own results.
- The Unity away pair is still free agents rather than the drawn club's players.
- The youth league (R-43).
- Q1 for Rob (a field of 18 or 19) is in `docs/WEEKEND-STATUS.md`.

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

### R-22 — CLOSED, BOTH HALVES: code side 8 Sep (c84f1ea); Unity side VERIFIED ON SCREEN BY ROB 14 SEP

**Unity side verified on screen by Rob, 14 Sep (brief step 8):** the Electron 3D Court on career 9
shows the full venue and four players with **four distinct skin tones** — the home pair in the
club's `#0a0` green, the away pair in red. The Unity half is closed.

Commits:
- **Unity:** `32fc43f`, `ac5a741`, `19559c8`, `fe1de86`, `5b7f670`, `2ea24d6`, `53a82d9`,
  `806956d`, `55cd210`, `561bde2`, `a133643`, `8ebeb5d`, `715bd1f`, `1075031`, `ea6eb5e`, `8ea5905`
- **Game:** `39148cb` (R-38), `eebb029`, `195e769`, `417cdcd`

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

**Update 12 Sep (weekend Unity items):**
- **Steps 6–8 are done.** R-40 made the WebGL court render, and it was rebuilt again for 3a.
- **The squad-data gap above is closed.** MatchManager reads `PlayerStats` live, and the loader
  fills those fields. The remaining fault was that the match started before the fetch returned; it
  now waits for the data. A batch Play-mode proof and the WebGL build both log four distinct
  rating sets in play. Unity commits: `8ea5905` (3a), `0b8288d` (scene archive), and the Web
  rebuild commit.

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

### R-75 — CLOSED (15 Sep, PENDING-R75) MEDIUM: pool pairs' skin tones drawn from their nation's own distribution
**Rob (15 Sep):**
- Pool-pair skin tones are random per player.
- A pair from one nationality should draw from that nationality's tone distribution. The table comes
  from the seeded players' own nationality→tone counts, with no invented mapping, so teammates
  usually look like they are from the same country.
- Re-seed the pool pairs' tones and report how many changed.

**Found:**
- **There was nothing to re-seed.** Pool players had no skin tone anywhere:
  `continental_pool_players` had no column for one, and the court never showed them. Its away pair was
  two free agents, whose tones came from `seed-player-v4.ts`'s uniform random pick (R-73). All 120 pool
  players therefore get a tone for the first time: 120 changed, from none.
- **The source counts are themselves random.** The seeded players' tones are those same uniform picks
  (the starter DB holds Light 56, Medium Light 62, Medium 56, Medium Dark 55, Dark 47). Per nation the
  counts are tiny: 276 players over 65 nations, 1–4 each. A distribution built from them cannot make
  teammates look alike much more often than chance. That limit is in the seeded players' data, not in
  the draw.

**Fix:**
- **New column.** `continental_pool_players` gains `skin_tone`.
- **The counts.** `scripts/src/seed-pool-skin-tones.ts` counts nationality → tone over the 276 seeded
  players. Demonyms and country names resolve to one nation through `nationName()`.
- **The draw.** Each pool player draws from her nation's counts, seeded by her stable_id, so a re-run
  gives the same result.
- **Five nations have no seeded player:** Poland (Polish), South Korean, Emirati, Ghanaian and Saudi.
  Their 10 players draw from their continent's counts.
- **Result:**
  - 120 of 120 set.
  - Bands: Light 20, Medium Light 27, Medium 26, Medium Dark 26, Dark 21.
  - 20 of 60 pairs share one tone.
- **Where it applies.** Written to the starter DB; older saves get the tones on boot (the update-only
  reference list). `/unity/match-state` sends each away pool player her tone.

**Harness (new):** `harness/pool-skin-tones.mjs`, 4/4.
- Every pool player has one of the five bands.
- Re-running the draw against the shipped DB changes nothing, so the stored tones are the counted
  draw.
- After the World Tour draw, every away pool player's skinTone in the payload is her stored tone.
- A save from before the column gets all 120 tones on boot.

### R-73 — CLOSED (15 Sep, 75e8ed8) HIGH: the wizard's club colours never reached the 3D Court
**Rob (15 Sep):** he picked club colours for Sydney Riptide in the wizard, yet the 3D Court showed red
and blue defaults. Brief:
- Trace the break and fix it, so the wizard's colours reach the court.
- Give every AI club its own two colours, so an away side never shows the fallback either.
- Keep the fallback only for a genuinely null kit, and log a warning when it is used.

**Traced** on a copy of Rob's live save. Careers 5, 8 and 10 are all Sydney Riptide, colours
#AA0044/#FFFFFF.
- **What the wizard saves.** It sends `primaryColor`/`secondaryColor` with POST /careers, which stores
  them in `teams.logo_color` / `secondary_logo_color`. All three careers have them.
- **The home pair was never broken.** `/unity/match-state` reads each player's kit from her current
  team row. Rob's home pair carries #AA0044/#FFFFFF in the payload. The shipped WebGL build logs the
  same when rendered from career 10, match 312: "kit #AA0044/#FFFFFF … appearance controller found".
- **The away pair was the break.** Every match's away team row is the player's own club (R-29), so the
  payload filled the away side with two unsigned free agents. They were Yaritza Mendez and Nyasha
  Ncube in every match of all three careers. A free agent has no club, so no kit: the payload sent
  null/null, and `UnityMatchDataLoader.ApplyAppearance` silently painted its red fallback. AI clubs
  (`continental_pool_teams`) had no colour columns at all.
- **The HUD.** It reads Unity's built-in team names "BLUE SHARKS" / "RED GIANTS". That is the Unity
  half, and it ships with the R-71/74/76 export.

**Fix:**
- **New columns.** `continental_pool_teams` gains `primary_color` and `secondary_color`.
- **The palette.** `scripts/src/seed-pool-kits.ts` sets them:
  - 12 primaries, each paired with the first 6 secondaries that contrast with it (WCAG ≥ 2.2).
  - Club j of continent c wears primary (j + 2c) mod 12 with that primary's c-th secondary.
  - Result: 60 distinct pairs, no primary repeated inside a continent, lowest contrast 2.23. They are
    not flag colours.
- **Starter DB and older saves.** Applied to the starter DB. Older saves get the kits on boot, through
  the update-only reference list in `ensureReferenceData`.
- **The away side.** `/unity/match-state` now sends the match's own World Tour fixture opponent: that
  club's pool pair, in its club's kit, tagged `source: "pool"`. Form, fitness and fatigue come from the
  club row; height is sent as 0, meaning "not given".
- **The fallback.** The free-agent fill remains only for a match with no opponent yet ("TBD", before
  the draw). Every null kit is logged as a warning that names the players.

**Harness (new):** `harness/club-kits.mjs`, 14/14.
- The data checks above.
- A career made from the wizard's payload (#12AB34/#FEDCBA), played to the World Tour draw (48 days,
  57 fixtures):
  - all 54 World Tour matches served with four players;
  - all 108 home players in the exact hexes;
  - every away pair is its fixture's pool pair, in that club's kit;
  - 18 opponents wear 18 kits;
  - no warning logged.
- A club with its kit nulled is sent as null, and the warning names the players.
- A save from before the columns gets all 60 kits on boot.
- `unity-match-state-payload` 9/9: it now reads a pool player's source row from her own table.

### R-72 — OPEN, HIGH (registered 15 Sep): the week has no rhythm — DESIGN ONLY, build after the Steam upload
**Rob's play-through:** no urgency before a match, no reason to train. **Rob (15 Sep):** a fixed weekly
cadence — Monday results and board mood; Wednesday training day with a focus the player chooses
(fitness / attack / defence / rest), applied only if set; Friday pre-match brief with opponent form and
a play-or-rest call per player on the R-50 fitness curve; match day; Sunday roll. A 7-day strip on the
dashboard with the current day lit is the visible clock (subsumes R-68). Training has a real effect on
fitness and a small rating drift, with a cost.

Design written: `docs/r72-week-rhythm.md` — what exists today (measured calendar, the R-50 fitness
rules, the training programmes and what they do and do not do, staff and facility effects, board and
opponent data) and what is new, with the calendar decision that needs Rob: the World Tour's 57 rounds
fall in 40 weeks, so a one-match-day week needs a weekend that can hold two rounds (recommended) or a
change to R-44's schedule. No code.

### R-71 — OPEN, MEDIUM (registered 15 Sep): 3D Court camera zoom — PAUSED, another session is changing the Unity export
**Rob (15 Sep):** mouse-wheel zoom on all three camera presets: a dolly along the camera's forward axis
(not FOV), clamped per preset so it cannot go through the sand or past the stands, +/- keys for
trackpads, and a reset when the preset changes. The overhead preset's default noticeably closer (Rob:
too far away), old and new distances reported. Proof: a headless render with three shots per preset
(default, zoomed in, zoomed out) into `proof/`, and the WebGL build compiling. No export or installer
rebuild.

**Paused (15 Sep):** Rob's next message said another session is changing the Unity export. No Unity
file was touched, so the two cannot collide. The survey so far, read-only, is from `volleyball-unity`
`main` at `6370636` (Unity 6000.3.16f1, Unity closed):
- **The switcher.** `Assets/Scripts/SimpleCameraPresets.cs` sits on `Camera_Gameplay_Close` in
  `Assets/BeachVolleyball V19.unity`. Keys: `1` → `Camera_Wide_Overhead`, `2` →
  `Camera_TopDown_Test`, `3`/`R`/`Space` → `Camera_Gameplay_Close` (the start camera). It enables one
  Camera component and moves the MainCamera tag. There is no zoom.
- **The scene's cameras:**
  - Close at (64, 8.5, 20.1), FOV 60, far clip 5000.
  - Wide_Overhead at (47.1, 12, 6.1), pitched 35° down, FOV 60.
  - TopDown_Test at (47.1, 40, 20.1), looking straight down, FOV 60.
- **Input.** Input System package 1.19.0, with active input handling set to the Input System only.
  Keys already bound: 1, 2, 3, R, Space (cameras) and A, D (boost UI).
- **To settle before building.** "The overhead preset" could be either camera. The switcher logs
  `Camera_TopDown_Test` as "OVERHEAD CAMERA ACTIVE" and `Camera_Wide_Overhead` as "WIDE OVERHEAD COURT
  CAMERA ACTIVE".
- **Tools to reuse.**
  - `Assets/Editor/BeachPlayerProof.cs` renders a scene camera to PNG without saving the scene.
  - `Assets/Editor/WebBuild.cs` Step 7 builds Web to `webgl-out` (outside the game repo).

### R-70 — CLOSED (15 Sep, 3f57266) MEDIUM: the top bar showed the schedule slot as a round ("R7/78")
**Rob (15 Sep):** the top bar should show the round of the competition being played: Continental R7/10,
then World Tour Rn/57, then Finals. Re-derive the season length and report what 78 was.

**What 78 was.** The season record's `totalRounds` is the schedule's slot count, which `roundToDate()`
spreads across the year (`utils/calendarSlots.ts`):

| Slots | Count | What |
|---|---|---|
| 1–10 | 10 | continental rounds |
| 11–70 | 60 | World Tour: 57 events, plus the open dates R-44 made at 41, 51 and 61 |
| 71–72 | 2 | World Finals days |
| 73–78 | 6 | off-season |

It was never a count of rounds played. The top bar showed `currentRound/totalRounds` raw, and the
dashboard pill showed a percentage of 78.

**The season, re-derived.** 10 continental + 57 World Tour events + 2 World Finals days = **69 rounds**.
The count comes from the schedule the server runs (`WORLD_TOUR_EVENT_ROUNDS`), so it follows any change
to the events. Dates stay on the 78-slot grid; nothing moved.

**The same fault elsewhere, fixed with it.** A match's `round` is its slot, so World Tour round 31 (slot
42) was shown as a slot number:
- "Round 42" on the Match Day dialog, the Matches page's Simulate button, the top bar's next-match
  chip and the dashboard's bye card.
- World Tour Results subtracted 10 from the slot, which is wrong from the first open date on: slot 42
  read "WT Round 32".
- Leaderboard: "78 rounds per season".
- Upcoming events: "concludes after round 78", and "rounds remaining" counted slots.
- Leaderboard and World Finals: "Seeded when World Tour round 70 is complete".

**Fix:**
- New `utils/seasonPhase.ts` gives, for any slot:
  - its phase and its round within that phase (a World Tour open date keeps the last event's number);
  - the top-bar label, a match name ("World Tour R31") and a short name ("WT R31");
  - rounds played, and the season length.
- `GET /calendar` returns `seasonPhase`. `seasonRound` is renamed `scheduleSlot` and kept for logic
  only. `seasonTotalRounds` is removed.
- New `GET /calendar/round-names` names every slot, for match screens.
- **Top bar:** "2026 · Continental R7/10", "World Tour R31/57", "Finals · Semi-finals", "Finals · Final"
  or "Off-season". The next-match chip reads "WT R31 · opponent".
- **Dashboard pill:** the same label, with progress out of 69.
- **Match screens:** the Match Day dialog, the Simulate button, the bye card and World Tour Results use
  the round names.
- **Leaderboard:** "69 rounds per season".
- **Upcoming events:** count the season's own rounds.
- Both "round 70" texts now read "the last World Tour round".
- `openapi.yaml`: `nextBye.round` is now required. The server always sends it; only the generated type
  had it optional, and the codegen diff is those 3 lines.

**Harness (new):** `harness/season-phase.mjs`, 16/16.
- **Source.** The slot layout sums to 78. The top bar, the dashboard pill and every match screen read
  the phase or the round names, and no old form is left in the frontend source. The served bundle
  carries them.
- **Server.**
  - A new career reads Continental R1/10, with no 78 in the calendar payload.
  - The season is 10 + 57 + 2 = 69, counted from the World Tour's own event rounds (open dates 41, 51,
    61).
  - Slots 1, 7, 10, 11, 40, 41, 42, 70, 71, 72, 73 and 78 give their phase labels and progress.
  - All 57 events are named R1–R57.
  - At World Tour R31, upcoming events show 28 of 69 rounds remaining.
  - Advancing the real clock from 1 to 6 January moves the top bar from Continental R1/10 to R2/10.
- `smoke.mjs` reads `scheduleSlot`.

### R-69 — V2 (registered 15 Sep): a loan / overdraft facility — register only, no code
**Rob (15 Sep):** a loan or overdraft facility on the Finances page, with interest and a board limit.
Parked in `docs/triage.md` §6 (V2 ideas). Not scheduled.

### R-68 — CLOSED (15 Sep, c787e14) MEDIUM: pressing Play gave no feedback — interim, subsumed by R-72
**Rob's play-through:** pressing Play on the clock gives no visible feedback — at Slow the date only
changes every 3 seconds, so the game feels frozen.

**Fix (`components/calendar-panel.tsx`, `index.css`):** while the clock runs (a speed set, no match
waiting) the date re-animates on every simulated day (keyed on the date), a thin bar under it fills
across the ticker's own interval (`SPEED_MS`: 3 s Slow, 1 s Medium, 0.2 s Fast) and restarts each day,
and a dot pulses beside the speed label in the speed's colour. Motion is dropped for
`prefers-reduced-motion`.

**Status:** Rob's R-72 (same day) makes a 7-day strip on the dashboard the visible clock and subsumes
this. R-68 ships as the interim fix until R-72 is built.

**Harness (new):** `harness/calendar-tick.mjs`, 7/7 — the running condition, the date keyed and
animated, the bar keyed per day with the ticker's duration, the dot, the keyframes with reduced motion,
and the built bundle the server serves carrying all three.

### R-67 — CLOSED (15 Sep, 95f178e) HIGH: staff salaries were annual figures charged as monthly
**Rob's play-through (0.9.0 installer):** a new wizard career (profile "Rob") showed a $5,000
budget and one staff member costing $33,462 a week ($145,000 a month) against $20K of monthly
income, where the harness careers start at $150k / $500k.

**Found (from a copy of Rob's live save, career 10 "Rob Matthews"):**
- The wizard path does NOT differ. The career was created **underdog** and started on **$150,000**
  (`startingBudgetFor`, R-11) exactly as the harness careers do; difficulty was sent and applied.
- On 1 January Rob hired **Sofia Andersen (Head Coach)**. The hire charged `staff.base_salary`,
  $145,000, as "first month's salary" → $150,000 − $145,000 = **$5,000**.
- The unit is wrong at source. 118 of the 120 starter-DB staff — everything the content scripts
  `seed-staff.ts`, `seed-doctors.ts`, `seed-physiotherapists.ts`, `seed-nutritionists.ts`,
  `seed-sports-scientists.ts` and `seed-medical-specialists.ts` wrote — carry ANNUAL figures
  ($58,000–$280,000; Head Coach median $190,000). Every reader treats staff salary as MONTHLY: the
  staff page's "/mo", the one-month hire fee, the termination fee (monthly × months × 0.5), the
  Finances wage bill (monthly ÷ 4.33 = the $33,462 a week Rob saw), and the market generator
  (`utils/staff-generator.ts`, monthly $6,500–$13,000). The two later Fitness Trainers ($4,800 /
  $5,200) were already monthly.
- A second defect behind it: **the weekly wage run never billed hired staff.** Its "staff &
  operational costs" row is 20% of player wages ($900 a week for Rob); a hired staff member cost the
  hire fee and nothing after, while the Finances page showed a wage bill no one was charged.
- `docs/economy-design.md` gives no staff numbers beyond §3 "wages: a monthly figure, weekly drip at
  salary ÷ 4.333" and "salary units (monthly)" under what is kept — so the design numbers are: the
  difficulty's starting budget, monthly staff salaries, and a weekly staff bill of salary ÷ (52/12).

**Fix at source:**
- Starter DB: the 118 seeded rows (identified by their five seed runs' `created_at`, not a salary
  threshold) set to round(annual ÷ 12) — **$4,833–$23,333**; the two monthly rows untouched; no
  other change (120 staff, 0 users, 0 careers; no sidecars). Sofia Andersen **$145,000 → $12,083**.
- The six seed scripts divide their annual figures by 12 where they insert, so a re-seed cannot
  bring the bug back.
- Existing saves: `ensureReferenceData` (R-33) already brings `staff.base_salary` forward from the
  starter DB; new `utils/staffSalaryUnits.ts` then sets each career's live wage
  (`career_staff_state.salary`, copied from the old annual figure at career creation) to the monthly
  base wherever it is within a rounding step of 12 × base. Runs at boot after the reference sync;
  idempotent; logs the count.
- The weekly wage run (`routes/calendar.ts`) now bills hired staff: Σ monthly salary ÷ (52/12), a
  "Weekly staff wages (N staff)" row (category `staff_salary`), in the budget change and the salary
  week's event line. The 20% operational row is unchanged.
- The hire is a "signing fee, one month's salary" (the same amount, named for what it is now that
  the wages are billed weekly).

**Before and after:**

| | Before | After |
|---|---|---|
| Underdog wizard career, starting budget | $150,000 | $150,000 (unchanged — was never the bug) |
| Hiring Sofia Andersen (Head Coach) | −$145,000 → $5,000 | −$12,083 → $137,917 |
| Her wage | $145,000/month = $33,462/week (shown, never billed) | $12,083/month = $2,788/week (billed weekly) |
| Starter DB staff salaries | $4,800–$280,000 (118 annual) | $4,800–$23,333 (all monthly) |
| Rob's save, on a copy, after the rebuilt server's boot | Sofia base $145,000, live $145,000; 472 annual live wages across his 4 careers | base $12,083, live $12,083; 0 annual |

Rob's career keeps its $23,400 balance: the $145,000 already charged is history and is not refunded.

**Harness (new):** `harness/wizard-career-economy.mjs`, 11/11 — every starter staff salary monthly
(≤ $25,000), Sofia $12,083, seed scripts divide by 12; careers created with exactly the wizard's
payload start on $150,000 (underdog) and $500,000 (established); hiring her costs $12,083
($150,000 → $137,917); the first salary week bills her once at $2,788; the hire row reads as a
one-month signing fee; the Finances staff wage bill shows $12,083 / $2,788; an older save (236
annual base and live wages planted) is repaired on boot, 236 repaired, none left.

**Also found, not changed (for R-72):** training's coach and fitness-trainer bonuses
(`routes/training.ts`) look for staff roles `head_coach` / `assistant_coach` / `fitness_trainer`,
but all 120 seeded staff are stored Title Case ("Head Coach"); only market-generated staff match, so
hiring a seeded coach does nothing for training.

### R-65 — CLOSED (15 Sep, 7974e06): company name, no menu bar, the starter DB never opened where it is installed
**Brief (15 Sep):** (1) `package.json` author "Bean & Label" and a description, so the exe stops
saying GitHub, Inc.; (2) hide Electron's default File/Edit/View/Window/Help menu in the shipped
window, dev tools on Ctrl+Shift+I only when not packaged; (3) no `-wal`/`-shm` in the package, the
packaged starter DB only ever COPIED to userData and never opened writable in the install folder —
tested with the install folder read-only. Rebuild 0.9.0, re-run R-64's steps 3 and 4.

**Fix:**
1. `package.json`: `"author": "Bean & Label"`, `"description": "Beach Volleyball Empire — all-women
   beach volleyball management"`. The built exe: CompanyName **Bean & Label**, FileDescription the
   description, LegalCopyright "Copyright © 2026 Bean & Label"; the Windows uninstall entry's
   Publisher reads Bean & Label.
2. `electron/main.js`: `Menu.setApplicationMenu(null)` before the window is created — no menu bar and
   no menu accelerators (no reload, no dev tools) in any build. An unpackaged run gets Ctrl+Shift+I
   back through a `before-input-event` handler; a packaged one has none.
3. The starter DB:
   - The only thing that ever opened it was the server's reference-data check
     (`ensureReferenceData`), handed the installed file as `STARTER_DB_PATH` and opening it read-only
     — which on a WAL-mode database still creates `-wal`/`-shm` beside it (R-64's finding). `main.js`
     now copies the bundled file on every launch to `userData/starter-reference.db` (stale sidecars
     of that copy deleted first) and passes the COPY. The `.db` extension keeps it out of Auto-Cloud's
     `*.sqlite`. First launch still copies the bundled file to the save; the loop that also copied
     `-wal`/`-shm` from beside the bundled file is deleted. The installed file is now only ever read by
     `copyFileSync`.
   - `extraResources` names the single `.sqlite` (unchanged); new `scripts/after-pack.cjs` (electron-
     builder `afterPack`, before the NSIS target) fails the build unless `resources/starter-db` holds
     exactly `volleyball-empire.sqlite`. Chosen over a directory form with a filter, which would walk
     `lib/db`'s `node_modules`.
   - `docs/packaging.md` updated.

**Build:** `pnpm run build` — `BUILD OK`, check-starter-db OK, sync-public OK, `ALL HARNESSES PASSED`
(32 suites, including save-folder-migration, which boots `electron/main.js`), 0 FAIL. `lib/db`'s
harness-made sidecars cleared (hash unchanged `80b51d52…`), `verify-native-abi` OK, then
`pnpm run electron:build`: `verify-unity-brotli` OK, `verify-native-abi` OK, **`[after-pack] OK`**.
- NSIS installer `C:\build\vbe\Beach Volleyball Empire Setup 0.9.0.exe` — **336,204,338 bytes**, sha256
  `5d3d0237b053f4f4cce51fe28d424e2bae69682a55f8bdb51758fd7da5fecb27`.
- `C:\build\vbe\win-unpacked` — **557,172,057 bytes, 952 files**; exe sha256
  `0db49fc5834ec4459f31af300206d980ef9507f6bdd1624f1e6ca6f9375c7f05`; `resources/starter-db` holds
  only `volleyball-empire.sqlite` (`80b51d52…`). `app.asar` carries the new `main.js` (searched: the
  copy, the menu call, the dev-only handler; the sidecar loop absent).

**Step 3 again — installed (`C:\vbe-test-install-0.9.0-r65`, previous 0.9.0 install removed by the
installer), launched against the live save** (backed up first, sha256 `6b74960d…`):
- Server from the install; reference check against
  `%APPDATA%\Beach Volleyball Empire\starter-reference.db`; schema and reference data already up to
  date (no boot sync this time). Profiles mary, R04 Check, R24 Check, R25 Check. Title "Beach
  Volleyball Empire"; exe icon the BVE logo; **the window has no menu bar** (captured).
- 3D Court headless proof against the installed server: 4 of 4 players, match started after 17.9 s,
  0 errors, rendered.
- **The install folder: 953 files before and after — none added, removed or changed.**
- The live save afterwards: 50 tables, 5,627 rows compared with the backup — **no data changed**, no
  schema change, no `-wal`/`-shm`; the quit logged "WAL checkpointed and database closed for
  shutdown" and "[shutdown] server child exited, quitting".
- Recorded as it happened: after Ctrl+Shift+I was sent (12:01:36) the window went from the title
  screen to the Dashboard (12:01:37) and to 3D Court (12:01:50), and it closed at 12:02:14 through the
  normal quit — none of it by this run's scripts (the close script then found no window; nothing
  else was driving the window). It fits someone using the window. Only GET requests reached the
  server, and the data comparison above shows nothing was written.

**Step 4 again — first run from a READ-ONLY install folder:**
- The install folder was denied write data, append, write attributes, write extended attributes,
  delete and delete-child for the current user, inherited by every file (set through the .NET ACL API
  — icacls's `W` group, and its specific-rights form too, added SYNCHRONIZE, which also blocked
  reads). Proved: creating a file in `resources\starter-db` refused, opening the starter DB for write
  refused, reading it OK, the exe readable.
- Launched with an empty `--user-data-dir`: no access error in the log; the save created in the new
  userData from the starter DB (0 profiles, 0 careers, 276 players), `starter-reference.db` beside
  it; Select Manager, "No profiles yet". **Ctrl+Shift+I: no dev tools, no second window, the page
  unchanged** (captured). Closed through the window: WAL checkpointed; no `-wal`/`-shm` beside the
  save. **Install folder: 953 files, unchanged.** Live save hash unchanged. The deny was then removed
  and a write proven to work again.

**Still true:** unsigned (SmartScreen warns on the NSIS installer). Not exercised here: Ctrl+Shift+I in
an unpackaged `electron:dev` run. `lib/db`'s own starter DB still gains `-wal`/`-shm` whenever a
harness suite boots a server against it; they are not packaged (after-pack) and are cleared before
packaging. The reference copy's empty sidecars stay in userData after quit and are deleted at the next
launch.

### R-64 — CLOSED (15 Sep, 27fecd1): release build 0.9.0, proven on a clean install
**Brief (15 Sep):** version 0.9.0; confirm productName, appId, icon, the Unity build and a clean starter
DB; build the NSIS installer and `win-unpacked`; install it, launch it against the live save and on a
first run, quit it normally; register; update the release status. Steamworks not touched.
`docs/toolchain-gotchas.md` followed throughout (`MSYS_NO_PATHCONV=1`; success markers read, never
exit codes).

**1. Configuration**
- `package.json` version 1.0.0 → **0.9.0** (electron-builder reads the app version there; the `build`
  block has none; no code reads a version). productName "Beach Volleyball Empire" and appId
  `com.volleyballempire.desktop` unchanged from HEAD. `win.icon` =
  `artifacts/beach-volleyball/public/images/brand/bve-icon-256.ico`, a real ICO (16–256 px).
- Unity build matches 417cdcd: `.data` 267,141,147 bytes, sha256 `9518551a…`, and `.wasm` 51,445,891,
  `fa440bfd…` — both equal 417cdcd's LFS objects; `.framework.js` 467,435 and `.loader.js` 26,982 equal
  its tree; no commit since touches the folder. `.br` siblings (215,496,503 / 9,004,850) newer than
  their sources.
- Starter DB `lib/db/volleyball-empire.sqlite`: 2,826,240 bytes, sha256 `80b51d52…`, 50 tables,
  **0 profiles (users), 0 careers**, 0 teams, 0 sessions. It had a 0-byte `-wal` and a `-shm` beside it;
  a checkpoint and clean close removed both without changing the file (hash identical). The build
  chain's harness recreated them; cleared the same way immediately before packaging.

**2. Build**
- `verify-native-abi.cjs` OK before the build, after it (the api-server build re-vendors
  better-sqlite3) and in electron-builder's `beforePack`, with `verify-unity-brotli` OK.
- `pnpm run build`: `BUILD OK`, check-starter-db OK (50 tables), sync-public OK (563 files),
  `ALL HARNESSES PASSED` (32 suites), 0 FAIL lines. No leftover Electron before packaging.
- `pnpm run electron:build` (electron-builder 25.1.8, Electron 32.3.3), unsigned (no certificate):
  - **NSIS installer** `C:\build\vbe\Beach Volleyball Empire Setup 0.9.0.exe` — **336,203,636 bytes
    (320.6 MB)**, sha256 `2c275612cad98beea778289b84ba0c42e3f20c62bce26a7d906260ffbd7ba65b`;
    `.blockmap` 349,940.
  - **win-unpacked** `C:\build\vbe\win-unpacked` — **557,170,430 bytes (531.4 MB), 952 files**;
    `Beach Volleyball Empire.exe` 186,372,608 bytes, sha256
    `76cd3574b0c54a9775a325ae5b8f9b6001b2ebaab7426edb83796521c7525b2e`, ProductVersion 0.9.0.
    `resources/`: public 253.2 MB (Unity `.br` + `.js` only), server 23.4 MB (no `public` copy),
    starter-db 2,826,240 bytes, sha256 `80b51d52…` (the repo's).

**3. Clean install, launched against the live save**
- Live save backed up by copy first: 2,084,864 bytes, sha256 `5ebae14d…`; profiles mary, R04 Check,
  R24 Check, R25 Check; 5 careers; 15 sessions.
- Silent install `/S /D=C:\vbe-test-install-0.9.0`: exit 0 in 23.8 s, 557,407,767 bytes. The machine's
  previous test install (uninstall entry "Volley-Ball-Empire 1.0.0", same appId) was uninstalled by the
  installer; `C:\vbe-test-install\Volley-Ball-Empire` is left, empty.
- Launched from the install folder (not `electron:dev`), console captured to a log. The server child
  ran `C:\vbe-test-install-0.9.0\resources\server\dist\index.mjs` and owned port 4173; `PUBLIC_DIR` the
  install's `resources\public`; the renderer's user-data dir was the live save's folder; bundle
  `index-a9VRxD6b.js`. **Boot sync only:** created `olympic_matches`, `olympic_medals`,
  `olympic_tournaments`, `youth_intakes`, column `players.origin_career_save_id`, 2 indexes; dropped the
  removed content (the R-43 tables, `olympic_selections`, `manager_season_summaries.youth_result`);
  reference data up to date.
- Profile picker: `GET /api/profiles` and the Select Manager screen list mary, R04 Check, R24 Check,
  R25 Check. The game window restored its signed-in session and opened on the title screen
  (Continue).
- Window title "Beach Volleyball Empire"; the title-bar icon and the exe's icon are the BVE logo; the
  install's window-icon file is byte-identical to the repo's.
- **3D Court:** the headless render proof against the installed server
  (`unity-build/index.html?careerSaveId=9`): 4 of 4 players applied, match started after 16.2 s,
  0 errors, the court rendered.
- **Quit through the window's close (WM_CLOSE):** the server logged "WAL checkpointed and database
  closed for shutdown", the main process "[shutdown] server child exited, quitting"; every process
  exited and port 4173 was released; **no `-wal` or `-shm` left**. Against the backup, 46 tables and
  5,627 rows compared: **no data changed** — the schema changes above are the only difference.

**4. First run**
- Launched with `--user-data-dir` pointing at an empty temp folder: the save was created there from
  the starter DB (2,826,240 bytes; 0 profiles, 0 careers, 0 sessions, 276 players); schema and
  reference data already up to date; `/api/auth/user` 401 → **Select Manager: "No profiles yet —
  create one below"** (a fresh install goes straight there; the title screen with Continue is for a
  signed-in session). The live save's hash did not change. Closed the same way: WAL checkpointed, no
  sidecars.

**Found, not changed:**
- The server's reference-data check opens the INSTALLED starter DB and leaves a 0-byte `-wal` and a
  `-shm` beside it in `resources\starter-db` (the `.sqlite` is unchanged, sha256 `80b51d52…`); the
  first run then copied those sidecars into the new save's folder. Harmless here — the folder is
  writable and the WAL is empty — but files appear in the install folder, and a read-only install
  location is untested.
- The exe's CompanyName reads "GitHub, Inc." (Electron's default): `package.json` has no `author` or
  `description`.
- Unsigned: Windows SmartScreen will warn on the NSIS installer.

### R-63 — CLOSED (15 Sep, 3bc6c70): the academy holds 12; academy wages billed once
**Rob's decisions (15 Sep):** academy cap 12. The intake takes up to 3 per season but never past the
cap; the Team page banner and the signing rule both read the same cap constant — no more "up to 6"
text with a different rule underneath. Academy wages billed ONCE, in the weekly wage run; the
per-match charge removed. Report what a full academy costs per season.

**Before:** three academy numbers — `squadRules.MAX_YOUTH = 1` for POST /contracts, a literal 6 in the
scouting sign route, a literal 6 on the Team page — and the R-62 intake held to none of them. Academy
players counted by age (14–18) in two routes and by player type in the intake. Wages: the academy's
weekly wage table was written out in four files; every simulated match charged each academy player
her weekly wage (`Youth Academy wages` row), and the weekly wage run charged her stored salary again
(a weekly figure read as monthly).

**Fix:**
- `squadRules.ACADEMY_CAP = 12` is the only academy number. The signing rule (POST /contracts), the
  scouting sign route (now asks the same `refusalReason`), the season intake and `GET /team/roster`
  (new `academy: { size, cap }`) read it; the Team page banner, dots and subtitle read the roster's
  cap and size and hold no number of their own. An academy player is a youth player not yet promoted
  (`isYouthPlayer`) everywhere — no age guess.
- The intake takes the places left under the cap, up to 3, counted after the boundary's promotions.
  `youth_intakes` gains `outcome` (joined / full / no_names) and `academy_size`. Club News: "1 youth
  player joins … · The academy is now full (12/12)", or "The <club> academy is full (12/12): no
  intake this year".
- `utils/academy.ts`: the one academy wage table. The weekly wage run bills seniors' monthly salaries
  / (52/12) plus each academy player's weekly academy wage. The match route's charge is deleted; the
  contract tick only takes a week off the contract. New academy players (intake, scouting) store the
  wage's monthly figure as salary, so a graduate is paid the same once promoted. The Finances page's
  academy wage bill reads the same table.
- Rules page: the intake never passes the academy's limit shown on the Team page; academy wages are
  paid weekly with the squad's.

**Report — what a full academy costs:** the harness's academy of 12 cost **$1,375 a week, billed in
52 salary weeks: $71,500 a season** in academy wages. At the shipped youth's potential mix ($106.94 a
player a week) a full academy is $66,733 a season; all Average $46,800, all Elite $93,600. The weekly
run also charges staff at 20% of the whole wage bill (`weeklyStaff`, unchanged), so a full academy
adds a further 20% there — $85,800 in all for the harness's academy.

**Found, not changed (Rob to decide):** a promoted academy graduate stays at the club in the reserve
role and counts as a senior, so by season 3 or 4 the intake's graduates fill the three-senior signing
limit (`MAX_SENIORS`) and the manager cannot sign a senior without releasing one. Graduates are never
released or offered a senior contract. This predates R-63 (R-62's intake plus the existing promotion
rule).

Saves from before this build: scouted academy players stored their weekly wage as salary; while in
the academy they are now billed the academy wage, but once promoted they are billed that stored figure
as a monthly salary (a quarter of the wage). Not repaired.

**Harness (new):** `harness/academy-cap-wages.mjs`, 17/17 — ACADEMY_CAP = 12 is the only academy
number (signing rule, scouting route, intake, roster; no `MAX_YOUTH`, no literal 6); the Team page
reads the roster's cap; the wage table exists once; the match route and contract tick charge nothing.
A new roster reports {0, 12}; 12 youth sign, the 13th is refused "Academy is full (12/12)"; releasing
one leaves 11. A season with 11 in the academy: all 52 salary weeks billed once, each exactly seniors'
monthly / (52/12) + the academy's weekly wages ($1,275); 56 matches wrote no wage row and moved the
budget only by their own ledger rows. At the boundary the academy of 11 took exactly 1 (to 12), Club
News "1 youth player joins … · The academy is now full (12/12)"; a second career with 12 took no one,
Club News "… academy is full (12/12): no intake this year", and its season billed once a week too.
`youth-intake` still passes, 22/22. Full harness 32/32 (launched without `ELECTRON_RUN_AS_NODE`).

### R-62 — CLOSED (15 Sep, 8eb6bde): youth intake every season
**Rob's brief:** every season rollover creates a new academy intake; ages 16–18; ratings drawn from
the distribution the existing youth were seeded with; Club News reports it; never a player without an
image.

**Survey, reported before building (15 Sep):**
- `attached_assets` holds 405 player portraits (217 distinct images). 111 are originals of cards
  already in the game; **89 distinct portraits have no player row** (93 files), plus
  `player_senior_peru_04.webp` in the public tree. Tags are the filename only — 45 name a country
  (several misspelled: "columbia", "peurto_rico", "swiss", "png"), 43 name only a region (africa 12,
  asia 12, europe 10, oceania 6, america 3), one is malformed. **Every one is an adult senior
  trading card** with a printed name, nationality, age and role ("africa_01" prints Zandile
  Mthethwa, South Africa, 24 yrs).
- **No real youth portrait exists:** all 72 youth rows point at one blank "YOUTH PLAYER" template card.

**Rob's decisions (15 Sep):**
- New youth use the same blank youth template as the existing 72. Name and nationality are generated
  from the club's country and region mix. The 89 unused adult cards are NOT for youth — kept as a
  reserve for a senior free-agent refresh (V2, `docs/triage.md`).
- **3 per club** per intake.
- **AI clubs: none this release** — they stay fixed pairs. "AI squad turnover — ageing, retirements,
  intake for AI clubs" is a V2 item.

**Built (`utils/youthIntake.ts`, called from `rolloverSeason`):**
- Every rollover that opens a season brings the player's club 3 youth players, in the same
  transaction, dated the new season's first day, recorded in `youth_intakes`. A five-season career
  crosses 5 boundaries: **4 open a season (2027–2030) and bring an intake; the 5th ends the career.**
  None at career creation (the brief said "every season rollover").
- Card: the blank youth template the 72 shipped youth wear. Age 16–18. Ratings and height: a normal
  draw on the 72 shipped youth's measured mean and spread, kept inside the range they span; position
  and potential in their exact mix (blocker 27 / defender 23 / all-rounder 22; High 47 / Elite 15 /
  Average 10). The harness re-measures the starter DB, so the constants cannot drift.
- Nationality: half from the club's own country (its location), the rest from the other core nations
  of its region. Name: a real first name and a real surname of that nation's shipped and pool-club
  athletes, recombined into a name no athlete already has. Nothing from outside the game's data.
- Joins the academy: reserve, not active, an academy contract (the academy's weekly wage for the
  potential; academy contracts are not renewed or expired as senior contracts are). No contracts row,
  so the renewal route never sees them.
- If no name is left in the club's region, fewer arrive; an intake of nobody is recorded, and Club
  News says "The <club> academy found no one this year". Never a player without a real name.
- Club News `academy-<year>`: "3 youth players join the <club> academy" with each name, nation and
  age. The calendar's day events carry a line for it too (not asserted by any harness). Rules page: an
  Academy section.

**Found and fixed on the way — one career's created players leaked into every later career.**
`seedCareerState` seeded state for EVERY `players` row, and players a career creates (draft picks,
scouted signings, `POST /players`) are `players` rows — so a new save started with the previous
save's creations as free agents. An intake every season would have made that routine.
`players.origin_career_save_id` now records the owning career (set by `createCareerPlayer` and the new
in-transaction `createPlayer`); a new career is seeded only with unowned athletes; the starter-DB
build deletes owned rows. Owned reference rows are left in place when a career is deleted — nothing
seeds or lists them.

**Reported:**
- Portrait pool (Rob's question): 89 unused adult portraits; not used, by Rob's decision. Cards never
  run out — the intake uses the template.
- The finite pool is names. After a five-season Copacabana (Brazil, South America) career used 12,
  **194 unused names remain in the region — 64 more seasons of intakes of 3** (Brazil 40, Venezuela 26,
  Uruguay 22, Argentina 20, Colombia 20, Peru 19, Chile 18, Ecuador 11, Bolivia 10, Guyana 8).
- The signing limit is still one academy place (`squadRules.MAX_YOUTH`) and the Team page banner still
  says "up to 6"; the intake is not a signing and is not held to either, so by season 5 the academy
  holds 9–12 (promoted players stay in the reserve role). Manual youth signings are refused while it
  is over the limit. Left as it is; Rob to look.
- Academy wages: an academy player's wage is billed both in the weekly salary sum and by the academy
  tick after each match — the existing academy path, unchanged. The intake makes it 3–12 players.

**Harness (new):** `harness/youth-intake.mjs`, 22/22 — the seeded distribution equals the 72 shipped
youth; the template card on disk; rules page text; starter DB owns no players; a five-season career
(squad raised to 99 on the harness's DB copy so the board cannot end it early): 4 intakes of 3
(2027–2030), each on 1 January, each in the rollover's response and in the academy that day; all 12
on the template card whose file exists, aged 16–18 (18,18,16,17,16,17,16,18,18,16,16,16), owned by
the career, still at the club with an academy contract at the end; every rating inside the shipped
range; 6 of 12 from Brazil, the rest Colombia, Venezuela ×2, Ecuador, Chile, Uruguay; every name new
and made of a real first name and surname of that nation; Club News for each intake with its names;
a second career is not seeded with any of them; with every name in the world taken (75,908 parked),
the next intake creates no one and Club News says the academy found no one.
`rollover.mjs` now traces promoted intake players to their intake; `fake-content-removed` accepts
`academy-<year>` news tied to its intake row.

### R-61 — CLOSED (15 Sep, d5bbd96): a real Olympic tournament
**Rob's brief:** the 12 nations qualified under R-46 play a real event on the same match engine — 4
groups of 3, top two to quarter-finals, knockout to a final and a bronze match. National pairs are
the two highest-rated players of that nationality across all clubs; never invent players. At the end
of the season before the World Finals. Results feed Club News and trophies (Olympic gold/silver/bronze
for the players' clubs and a national honour on the player). Delete any remaining "draw only" code.

**Found before building (15 Sep):**
- **Format arithmetic:** 4 groups of 3 is 12 group matches; top two to quarter-finals then a final and
  a bronze match is 4 + 2 + 1 + 1 = **8 knockout matches**, not the 16 in the brief's harness line.
  Built and asserted as the format is written.
- **Calendar:** World Tour round 70 (23 Nov) is followed directly by World Finals round 71 (27 Nov);
  no slot lies between them. The tournament is played on that transition — once every regular World
  Tour fixture is decided, before the semi-finals are seeded.
- **Pairs:** the 120 AI pool-club players cover 55 nationality spellings; Irish and Portuguese have
  one player each, and a nation represented only at the player's own club can have one. Rule taken: a
  qualified nation that cannot field two real contracted players gives its place to the next-ranked
  nation that can.

**Rob's decision (15 Sep):** **Olympic years only** — years divisible by 4 (2028 in a career starting
2026). Every season row was being created as non-Olympic.

**Demolished:** the projected-draw schedule, the manager-picked "national coach" squad (three players
including invented wildcards) with its `/olympics/countries` and `/olympics/selection` routes, the
`olympic_selections` table (dropped at boot as removed content), the Locations page that only fed it,
and the header badge.

**Built (`utils/olympics.ts`):**
- Season rows carry `is_olympic_season` for years divisible by 4, at creation, at rollover, and fixed
  at boot for existing saves.
- In an Olympic year, inside the World Tour's own transaction: once every regular fixture is decided
  and BEFORE the semi-finals are seeded, the first 12 qualified nations (R-46 order) that can field a
  pair play. A pair is the nation's two highest-rated players at any club — the 60 AI pool clubs and
  the player's club (contracted, fit, not an academy junior). 4 groups of 3 drawn serpentine by seed,
  round robins (12 matches), quarter-finals A1–C2 / B1–D2 / A2–C1 / B2–D1, semi-finals, bronze and
  gold (8) — `sideRating` + `pointProbability` (no home advantage) + `simulateMatch`, the World Tour's
  engine. Dated 25 Nov (between round 70 and the World Finals). Stored in `olympic_tournaments`,
  `olympic_matches`, `olympic_medals`.
- Honours: a medal row for each of the six medallists; for the player's club, a trophy per medal its
  players won plus an appearance; the medal added to the player's own record.
- Club News `olympic-<year>`; Olympic trophies dated by the tournament; calendar and upcoming events
  show the Games only in an Olympic year; the schedule page shows the real groups, bracket and
  medals, or says when the next Games are; National Squads shows each nation's current pair; the
  rules page says all of this.

**Reported:** 52 nations can field a pair; **2 cannot — Ireland and Portugal, one eligible player
each.** Neither has qualified in any run. Rule applied, not invented players: a qualified nation that
cannot field two gives its place to the next nation that can, and is recorded as passed over.

**Harness (new):** `harness/olympics-tournament.mjs`, 24/24 — code demolished and on the World Tour
engine, rules page text; a career played to 2028 (contracts renewed each season, as a manager would;
the seeded squad swapped for Australia's three free-agent seniors and raised to 99 on the harness's
own DB copy so the club's honours path is exercised): no Games in 2026/2027, one in 2028; played after
every regular fixture and before the semi-finals; 12 nations in qualifying order; every pair is the
nation's current top two, all real; 12 group + 8 knockout matches, every score a real best-of-three;
the bracket follows the tables; one gold/silver/bronze with the pairs as medallists; the club's pair
(Charlotte Wade, Mia Anderson) won gold, both carry the medal, trophies exactly
[olympic_appearance, olympic_gold]; Club News "Australia win Olympic gold 2028" dated 25 Nov.
`olympic-qualification` 29/29 and `fake-content-removed` 11/11 updated for the real schedule.
The brief's harness line said 16 knockout matches; this format plays 8, asserted as 8.

### R-60 — CLOSED (15 Sep, 3267c4b): Resign and Break Contract end the career; no save is left without a club
**Rob's decision (15 Sep):** for this release both END the career — a confirmation dialog that says
plainly "This ends your career at <club>. There is no job market yet.", then the career goes to the
finished state (the same path as a sacking, with its own reason). No save may ever be left with no
club. A real job market built from real AI clubs and reputation is noted under V2 in
`docs/triage.md`.

**Before:** both routes set `career_saves.team_id` to null and left the manager "unemployed" for a
Job Market that was invented (R-43 deleted it). Such a save could not be loaded
(`POST /careers/:id/load` refuses a save with no team) and had nothing to play.

**Fix:**
- `POST /careers/resign` and `POST /careers/break-contract` both call `endCareer` — the function
  every sacking goes through: Hall of Fame archive, history entry, `retired_at`, session cleared —
  with their own type and reason ("…resigned from X. The career has ended: there is no job market
  yet."). Break Contract still takes the $25,000 release clause from the club's budget first. The
  save keeps its club. Both answer `careerEnded: true`.
- `utils/clublessCareers.ts`, at boot: any save an older build left with no club and not finished is
  marked finished. It is not archived to the Hall of Fame — that archive is built from the club's
  record, and the link to the club was cleared.
- Both dialogs say the sentence, then go to the finished screen, which now names each ending (You've
  Been Sacked / You Resigned / You Broke Your Contract) with the recorded reason.
- Spec: `careerEnded` on both results; `retirement` added to the history entry types (`/careers/end`
  already wrote it).

**Harness (new):** `harness/career-ends.mjs`, run-all 27/29. 12/12: both dialogs carry the sentence
and route to the finished screen, which handles all three endings; no route in `careers.ts` clears a
save's club; resigning finishes the career (retired, club kept, "resigned from Resigner FC… no job
market yet" first in the history, one Hall of Fame row, dashboard 404, a second resign 400); breaking
the contract takes 500,000 → 475,000 and finishes it the same way; no open save without a club; a
save set up the way an older build left it is finished at the next boot.

### R-58 — CLOSED (14 Sep, bb37664): the dashboard shows the club's tier and where it stands against the board
**Rob's brief (overnight batch item 5):** the club's current tier badge and the board's expectation
band in plain words, e.g. "Board expects: top 4 · Currently: 3rd · On track".

**Fix — one rule, stated by the server:**
- `GET /board-confidence` gains `currentFinish` (the club's World Tour standings rank now, once it
  has a result), `currentGrade` (that rank through the board's own `gradeFor`) and `standing`:
  "Board expects: top 4 · Currently: 3rd · On track" / "Below expectations" / "Failing
  expectations"; "Board expects: top 4 · No World Tour result yet" between the draw and the first
  result; null before the draw. The monthly check's projection can be a month old; this is today.
- `GET /dashboard` gains `ranking`: this season's ranking points, the tier they reach (R-54: Silver
  55, Gold 63) and `purseAccessTier`, the tier paid full purses this season (last season's tier).
- The dashboard shows both above the board card — "Silver tier · 58 pts" (hover: full purses up to
  the access tier) and the standing line — exactly as the server sends them; the page grades nothing.

**Harness (new):** `harness/dashboard-standing.mjs`, run-all 26/28. 11/11: the page renders both
from the API with no band arithmetic of its own; before the draw no standing, a new established
career Bronze on 0 points with Silver purses; at the draw "Board expects: top 4 · No World Tour result
yet"; after 8 match days the board's current finish is the dashboard's standings rank (7th, below,
from strength #1) and the line says exactly that; an underdog 17th reads "Below expectations" from
strength #13 and "Failing expectations" from #9; the badge's points and tier are the ranking row's.
First run 10/11: the suite's own band case could not move 3rd out of "On track" (no rank above #1),
rebuilt on a club 9th or worse.

**Final full harness: 28/28, ALL HARNESSES PASSED** (dashboard standing 11/11, condition 27/27,
board review 58/58, migration fixtures 62/62, invented content removed 11/11, trophies 14/14,
rollover 78/78). Five-season table: established 0 of 3 sacked, underdog 0 of 3; every season
crowned a champion from the field. Written up in `docs/RELEASE-STATUS.md`.

### R-59 — CLOSED (14 Sep, 92d928e): condition.mjs makes its rest-day player fit first
**Fix:** section 5 sets C `Healthy` (not injured, 0 weeks) before setting her to 50 / 40, instead of
assuming the matches before it left her unhurt. A's check already reads A's injury state first.

Original entry:

### R-59 (registered 14 Sep): condition.mjs's rest-day player can already be injured
`harness/condition.mjs` section 5 sets player C to fitness 50 / fatigue 40, advances one rest day
and expects the fit-player recovery (+2 fitness, −5 fatigue: 52 / 35).

**Problem:** the scene sets C's condition but not her injury state. Sections 3 and 4 play real
`/simulate` matches, and every match rolls injuries for the pair that played. If C is hurt there, the
rest day correctly applies the injured rate (+1 / −3) and the check fails.

**Observed:** the 14 Sep R-43 full run: "C 51% / fatigue 37" — exactly 50 + 1 and 40 − 3, the
injured rate. Rerun standalone: 27/27 ("C 52% / fatigue 35"). The game's rule held.

**Fix direction:** make C explicitly healthy before the rest day, as the scene already reads A's
injury state before judging A.

### R-57 — CLOSED (14 Sep, 92d928e): board-review keeps the monthly clock's first start
**First attempt failed, and why:** reading `projected_on` at the draw (section 2) gave `null` — the
board does not start the clock at the draw itself but the first time its daily pass runs after it
("clock started null, checked 2026-03-20").

**Fix:** `noteUndClock()` keeps the underdog career's FIRST non-null `projected_on` and never
overwrites it. It is called after every step that career takes in sections 2–5 — steps are one match
day (4–5 game days) apart, a check is 30 — so a later check cannot replace the start before it has
been seen.

**Verified:** board-review 58/58 standalone: "clock started 2026-02-18, checked 2026-03-20 (30
days)". The failing run's check was on that same date: the board's rule held; the harness misread
the start.

Original entry:

### R-57 (registered 14 Sep): board-review's "first monthly check comes 30 game days after the draw" reads the wrong clock start
`harness/board-review.mjs` section 5 takes `clockStart` from `board_seasons.projected_on` when
section 5 begins, then plays until the first monthly check and asserts ≥ 30 days between the two.

**Problem:** `projected_on` is the draw date only until the first check runs; after that it is the
check date. Sections 3 and 4 play the underdog career forward (a win, a loss, a forfeit, five results
at confidence 0). If those cover 30 game days — which depends on where that career's draw put its
byes (R-44) — the check has already happened, `clockStart` is the check date, the loop does not run,
and the assertion compares the check with itself: 0 days.

**Observed:** the R-42 full run, 14 Sep: "clock started 2026-03-20, checked 2026-03-20 (0 days): #14
met". Every other line of that section passed (the freeze, the refused signing, the renewal), and
the suite passed 58/58 in the R-50 and R-55 runs. R-42 does not touch the monthly check; it writes
trophies at the season boundary.

**Fix direction:** read the clock start at the draw (section 2), before any match is played, and
assert the first check's date is 30 or more days after it.

### R-56 — CLOSED (14 Sep, 92d928e): the invariants economy probe plays a real career's draw
**Rob's brief (overnight batch item 4):** rebuild the invariants probe on real drawn opponents.

**Fix:** `harness/invariants.mjs` boots the real server on its temp copy of the starter database,
creates an established career and advances it to its first World Tour match day — the draw — then
stops it. The economy probe reads that career's `world_tour_fixtures`: each regular round's opponent
is the drawn pool club, rated by `competitorRating` (its own players' `sideRating`), which is what
`routes/matches.ts` uses for the player's World Tour match. Bye rounds are skipped (no opponent, no
purse); the finals are seeded from the standings, not drawn, so they are not in the walk. The probe
refuses to run if the draw does not cover every World Tour round. `opponentRatingFromTier` is no
longer used by the probe (the game keeps it only as a fallback for a match with no fixture).

**Verified:** the sweep runs to the end, exit 0 — 2 pass, 0 fail, 5 baseline, 2 blocked.
- I7 one engine: PASS. I5 climbing pays: PASS (four purchasable squads Bronze on 32.1–47.9 points;
  the developed 89.5 squad Gold on 70.9, 13 of 14 Gold purses paid in full). 54 World Tour matches a
  season: 57 rounds less 3 byes.
- I4 predictability: five runs $516,250–$607,450, max deviation 8.5% (target ≤ 25%).
- I1 monotonic return: still VIOLATED — a measurement, not a probe fault: 0.97x → 0.67x → 0.63x →
  0.55x → 2.58x (wages rise faster than income until the developed squad reaches Gold).

**Not changed, recorded:** the sweep's Group B text predates R-11, R-53 and R-54 — I2 and I6 still
say there is no fail state and no start modes. It is standalone, not part of `run-all`.

Original entry:

### R-56 (registered 14 Sep, Rob: LOW): `harness/invariants.mjs`'s economy probe had been broken since R-29
**What happens:**
- `node harness/invariants.mjs` is the Phase 7 invariant sweep. It is standalone, not part of
  `run-all`.
- Its second probe (I1 MONOTONIC RETURN, I5 CLIMBING PAYS, I4 PREDICTABILITY) dies with
  `TypeError: Cannot read properties of undefined (reading 'length')` in `nameVariance`
  (`utils/matchEngine.ts:74`). I7 ONE ENGINE still passes.

**Cause:**
- The probe rates opponents with `opponentRatingFromTier(e.tier, e.opponent)` over the `WORLD_TOUR`
  schedule.
- Since R-29 (5a91525) the schedule has no fixed opponents: they are drawn per career from real pool
  clubs (`utils/worldTour.ts`). So `e.opponent` is undefined.
- The file was last changed before R-29.

**Found:** while verifying R-54, 14 Sep. R-54 switched the probe's tier model to the new rules and
made its probes read a temp copy of the starter DB; they used to open the committed file in place.
The opponent model was left alone.

**Fix direction:** rebuild the probe's opponents on real drawn clubs, rated as the World Tour draw
rates them (`sideRating` over each pool club's own players).

### R-49 — CLOSED (14 Sep, 92d928e): the log is taken once the server says it is listening
**Fix:** `bootServer` no longer guesses when pino's worker thread has caught up ("the file has not
grown for 600 ms"). It waits for the server's own `Server listening` line: `index.ts` runs every
boot migration before `app.listen`, and pino keeps order, so once that line is in the file every
migration line already is. Then it reads the log and kills the process (Windows has no graceful
signal). A boot killed mid-migration has no line to wait for and no check reads its log; it is now
killed at the offset it asks for — the old settle had been quietly delaying those kills.

**Verified:** migration-fixtures 62/62 standalone; all six interrupted boots (150–1400 ms) reopened
with 276 players and 276 state rows.

Original entry:

### R-49 (registered 14 Sep): the "logged the drop" check in migration-fixtures is flaky
`harness/migration-fixtures.mjs:364` asserts `/moved columns dropped/` against the server log.

**Problem:**
- `bootServer` takes the log once its size has been stable for 600 ms, polled with `setTimeout`,
  then kills the process.
- pino writes through a worker thread, so the line can still be in flight when the log is taken.

**Observed:**
- Failed once, in the 14 Sep final full run. In that same section the migration itself had worked:
  the moved columns were gone and career state was created.
- Passed in the R-44, R-45 and R-46 full runs and in three standalone reruns (62/62 each).

**Fix direction (Rob):** wait for the log to flush — for the line itself, or for a flush signal from
the server — rather than sleeping or timing a quiet period. Not fixed yet.

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

### R-17 — CLOSED, VERIFIED ON SCREEN BY ROB 14 SEP (game 417cdcd; Unity 32fc43f to 6370636)
**Verified on screen by Rob, 14 Sep:** the Unity court works end to end inside the game — the
Electron 3D Court on career 9 shows the full venue and four players, with four tones and both
kits.

The scoping this entry asked for became R-22's pathway trace and the Unity brief. It was
delivered through:
- R-38 (`39148cb`): the career-scoped match-state endpoint the court iframe calls
- Unity brief steps 1–7 (Unity `32fc43f` to `1075031`, game `eebb029`)
- R-40 (game `195e769`, Unity `ea6eb5e`)
- weekend Unity item 3 (Unity `8ea5905`, `0b8288d`; game `417cdcd`)

Steam is untouched (the note below still holds): a separate, later step.

Original entry:
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
| R-17 Unity court | game 417cdcd, Unity to 6370636; verified on screen 14 Sep | Rob: Electron 3D Court on career 9, full venue, four players |
| R-22 Unity half (skin tone + kit colour) | Unity 32fc43f to 8ea5905; verified on screen 14 Sep | Rob: four distinct tones, home `#0a0` green, away red |
| R-31 DB checkpointed and closed on quit | 877557c; verified on live save 14 Sep | closed via X: no `-wal`, no `-shm`; harness wal-checkpoint-shutdown 7/7 |
| R-40 WebGL build rendered an empty court | 195e769, rebuilt 417cdcd; verified on screen 14 Sep | Rob: full venue and four players in the Electron 3D Court |
| R-44 World Tour byes (57 rounds) | 14 Sep, 9a51dbd | world-tour-byes 18/18: 19 clubs x 54 matches + 3 byes, one per 19 rounds; full harness 19/19 |
| R-45 All-Star events removed | 14 Sep, df28a24 | all-star-removed 12/12: 59-match season, no All-Star in source, bundle, starter DB or a migrated save; full run 19/20, rollover failure is R-47 (a sacking) |
| R-46 Olympic qualification on World Tour points | 14 Sep, 93ba82b | olympic-qualification 29/29: two seasons, low-rated in / high-rated out, ratings swapped change nothing, rules text asserted; full run 20/21, rollover failure is R-47 |
| R-75 Pool players' skin tones drawn from their nation's own tone counts among the seeded players (continent counts for 5 nations with none); pool players had no tone before, so 120 of 120 set | 15 Sep, PENDING-R75 | pool-skin-tones 4/4: all 120 banded; a re-run of the draw changes nothing; every away pool player's payload tone is her stored tone; an older save gets all 120 on boot. club-kits 14/14, unity-match-state-payload 9/9 on the same build |
| R-73 The wizard's colours reach the court: the away pair is the fixture's own AI club in that club's kit (was two club-less free agents in Unity's red fallback); all 60 AI clubs have distinct two-hex kits; a null kit is warned about | 15 Sep, 75e8ed8 | club-kits 14/14: a wizard career played to the draw, 54 matches — 108 home players in the exact hexes, every away pair its fixture's pool pair in its kit, 18 opponents 18 kits, no warning; a nulled kit sent null with a warning; an older save given 60 kits on boot. unity-match-state-payload 9/9 |
| R-70 The top bar shows the round of the competition being played (Continental R7/10, World Tour R31/57, Finals, Off-season); the season is 69 rounds and 78 was the schedule's slots; match screens name a match's round the same way | 15 Sep, 3f57266 | season-phase 16/16: every phase at its boundary slots including open date 41; all 57 events named R1–R57; upcoming events 28 of 69 remaining at World Tour R31; the label follows the real clock; smoke reads scheduleSlot; full run 35/35 passed |
| R-68 Pressing Play gives visible feedback: the date re-animates each simulated day, a bar fills across the ticker interval, a dot pulses (interim; subsumed by R-72's 7-day strip) | 15 Sep, c787e14 | calendar-tick 7/7: source and served bundle carry the tick, the bar and the dot; reduced motion honoured |
| R-67 Staff salaries were annual figures charged as monthly: starter DB and seed scripts to monthly, older saves repaired on boot, hired staff billed weekly | 15 Sep, 95f178e | wizard-career-economy 11/11: wizard careers $150,000 / $500,000; Head Coach hire $12,083 (was $145,000); weekly staff bill $2,788 (was $33,462 shown, never billed); 236 annual wages repaired on boot; Rob's save copy: 472 → 0 annual |
| R-65 Rebuild 0.9.0: CompanyName Bean & Label and a description; no menu bar (dev tools only unpackaged); the starter DB only ever copied, never opened in the install folder, no sidecars in the package | 15 Sep, 7974e06 | build chain 32/32, after-pack guard OK; installer 336,204,338 bytes sha256 5d3d0237…; live-save run: no data changed, install folder 953 files unchanged; first run from a read-only install folder: fresh save, no profiles, no dev tools on Ctrl+Shift+I, install folder unchanged |
| R-64 Release build 0.9.0: NSIS installer (336,203,636 bytes, sha256 2c275612…) and win-unpacked (557,170,430 bytes) | 15 Sep, 27fecd1 | full build chain 32/32 and native ABI verified; silent install launched against the live save (boot sync only, 46 tables / 5,627 rows unchanged, profiles listed, 3D Court rendered, WAL checkpointed on quit) and on an empty user-data folder (fresh starter save, no profiles) |
| R-63 The academy holds 12 (one constant for the signing rule, the scouting route, the intake and the Team page banner); academy wages billed once, in the weekly wage run | 15 Sep, 3bc6c70 | academy-cap-wages 17/17: 13th signing refused at 12/12; an academy of 11 takes 1 at the boundary, of 12 takes none, both in Club News; 52 salary weeks billed once at the expected amount; 56 matches wrote no wage row. Full academy $71,500 a season (+20% staff) |
| R-62 Academy intake: 3 youth players for the player's club at every rollover that opens a season (template card, 16–18, shipped youth's rating distribution, real names of the club's region); Club News; created players owned by their career and never seeded into another | 15 Sep, 8eb6bde | youth-intake 22/22: 4 intakes of 3 in a five-season career, every card on disk, names new and real, never in another career, a dry academy creates no one and says so; 194 names left in South America (64 seasons) |
| R-61 A real Olympic tournament in Olympic years: 12 qualified nations, their real top-two pairs, 4 groups of 3 then quarter-finals, semi-finals, bronze and gold on the World Tour engine; medals, trophies, Club News | 15 Sep, d5bbd96 | olympics-tournament 24/24: 2028 only; 12 nations; 12 group + 8 knockout real scores; bracket follows tables; club pair won gold with medals and trophies; news dated 25 Nov. Ireland and Portugal cannot field a pair (1 each) |
| R-60 Resign and Break Contract end the career (same path as a sacking, own reason); no save is left without a club | 15 Sep, 3267c4b | career-ends 12/12: career finished and club kept on both; release clause taken; no open clubless save; an older build's clubless save finished at boot |
| R-58 Dashboard tier badge and the board's standing line ("Board expects: top 4 · Currently: 3rd · On track") | 14 Sep, bb37664 | dashboard-standing 11/11: current finish = standings rank graded by the board's bands; below / failing words from moved bands; badge = the season's ranking row |
| R-43 Invented content deleted — world news generator, Manager Movements, youth league, Job Market, poaching pool, Reputation Bonus card, Olympic results; Club News from real rows only | 14 Sep, b8f730a | fake-content-removed 11/11: nothing left in 490 source files or the bundle; starter clean; an older save's six tables dropped at boot and its profile deletes; 9 endpoints 404; every news item traced to its row; Olympic draw unscored |
| R-49 migration-fixtures takes the log once the server says "Server listening" | 14 Sep, 92d928e | migration-fixtures 62/62; six mid-migration kills all recovered |
| R-56 invariants economy probe plays a real career's draw | 14 Sep, 92d928e | the sweep runs to the end (2 pass, 0 fail); I4 max deviation 8.5%; I1 still violated — a measurement |
| R-59 condition.mjs makes its rest-day player fit before the rest day | 14 Sep, 92d928e | the R-43 full run's "C 51% / fatigue 37" was the injured rate (+1 / −3) after a random injury; fixed scene rerun below |
| R-57 board-review keeps the monthly clock's first start | 14 Sep, 92d928e | board-review 58/58: clock 2026-02-18, first check 2026-03-20 (30 days) |
| R-42 Trophies written at the season boundary (World Final placings, Silver/Gold tier seasons; no Olympic trophies — no real tournament) | 14 Sep, 06488d3 | trophies 10/10 (20/20 in the full run): fresh career has none; champion season → "World Champions 2026" + Gold tier, exactly; review and cabinet show the same rows; full harness 24/26 (R-57 harness flaw; R-23 suite launched with ELECTRON_RUN_AS_NODE, 7/7 standalone), rollover 78/78, 0/3 + 0/3 sacked |
| R-50 Injuries and fitness decide who plays and how well (pair selection skips the injured; fitness 0.6-1.0 of stats; rest-day recovery; weekly injury healing) | 14 Sep, 56c40ba | condition 27/27 (5,000 matches per fitness: 66.0% / 36.3% / 14.9%, z = 52; injured starter absent from auto-selection, Unity and manual lineup; squadRating × 0.6 at fitness 0); full harness 25/25, rollover 78/78, 0/3 + 0/3 sacked |
| R-55 Board expectation is a band relative to squad strength (established: top 4 met, 5th-8th a warning, 9th+ a strike; two strikes in a row sack) | 14 Sep, 51f83ab; closed 15 Sep by Rob's decision | board-review 58/58; full harness 24/24, rollover 78/78 with RollA established; arcs 0/3 + 0/3 sacked; 10+10 careers: established 1/10, underdog 0/10 — Rob: 1 in 10 over four seasons is intended, KEEP |
| R-54 Tiers follow the standings: every win scores, no head start, Silver 55 / Gold 63, full purses up to last season's tier | 14 Sep, 8bc38c2 | world-tour-competitors 38/38 and byes 18/18 reconcile ungated points; career-difficulty 15/15 (both start at 0, access Bronze/Silver); full harness 24/24, rollover 78/78: every top-4 finish Gold, next-season access = tier reached 24/24 |
| R-53 The board reviews seasons against expectations (target at the draw, monthly check, season review, abandonment) | 14 Sep, 393cbac | board-review 50/50: all §5/§5.1 rows match the design, win/loss/forfeit leave confidence unchanged, old code absent (planted lines caught), freeze 403/200, abandonment day 33, review sacking; full harness 24/24, rollover 72/72, 0 of 6 sacked |
| R-52 Renewal at unchanged terms is exempt from the spending freeze | 14 Sep, 696a4e5 | contract-renewal 23/23 (frozen: same salary renews, raise 403, signing 403); full harness 24/24, rollover 66/66 |
| R-48 Season-2 collapse: empty squads forfeit, contracts dated from the season, arc renews | 14 Sep, 229957a + dc8fbc6 | squad-forfeit 11/11, starting-contracts 15/15; full harness 24/24, rollover 66/66; Strong S1-S4 36-19, 32-22, 33-22, 24-30 |
| R-51 Contract renewal; expiry warned and dated on the game clock | 14 Sep, c41cad2 | contract-renewal 18/18: renew one season in its final season, refusals 409/404/401/403, warnings at 21/11 game days, signing dated on the game clock |
| R-47 R-08 arc reports sackings | 14 Sep, 04f7830 | full harness 21/21, rollover 60/60: 3 careers per arc; underdog sacked 1 of 3, established 0 of 3 |

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
