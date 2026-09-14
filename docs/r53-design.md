# R-53: board confidence measured against expectations (design, no code)

Status: **approved as written and implemented, 14 Sep 2026** (R-53 in `docs/REPAIR-REGISTER.md`).
Rob took every proposed number, including the answers to all five open questions in §7: the
allowances and money places stand, sacking stays at ≤ 20 or two failed seasons running, the 30-day
abandonment rule stays, the forced-sale label is deleted, and season 5 stays a verdict that cannot
sack. `harness/board-review.mjs` asserts every row of §5 and §5.1.

> **Amended by R-55 (14 Sep 2026): the expectation is a band, not a rank.** §4.1's target and §4.2's
> six grades are replaced. The rest stands: carried confidence, honours, money, the forfeited-half
> rule, the monthly check and freeze thresholds, abandonment, and the season-5 verdict.
>
> **Why:** the strongest pair in the field finished 6th-10th in 5 of 26 established seasons by
> ordinary results variance. Against a #2 target, two such seasons in a row sacked an established
> club.
>
> **Bands**, set at the draw from the pair's strength rank R (Rob chose "relative to squad
> strength"):
> - **Met:** a finish no worse than R+3. Confidence +5; clears any strike.
> - **Below expectations:** R+4 to R+7. Confidence 0; a warning with no strike; strikes stay as they
>   are.
> - **Failed:** R+8 or worse, or at least half the season's matches forfeited. Confidence −25; a
>   strike.
>
> What that means for the starting squads:
> - An established starting pair (R = 1): top 4 met, 5th-8th below, 9th or worse failed.
> - A #19 underdog squad cannot fail on position.
> - An underdog that builds a #10 squad: top 13 met, 14th-17th below, 18th or worse failed.
>
> **Sacked** at a review with a second strike (two failed seasons in a row), or confidence ≤ 20.
>
> **Deleted:** the difficulty allowance, the money places (money no longer shifts expectations) and
> the six-step grade. §5 and §5.1 below keep their original R-53 numbers as history;
> `harness/board-review.mjs` asserts the same inputs re-judged under R-55.

## 1. Why the current board is wrong

What it measures today, from `docs/REPAIR-REGISTER.md` R-53:

- a stored 0–100 value starting at 60, moved only by results: +3 per win, +8 for a Grand Final win,
  −5 per loss or forfeit
- read with an absolute budget bracket, from +5 at $300k or more down to −25 in debt
- a sacking whenever the score reaches 0, checked after every result

That produces three failures:

- **Money is an immunity.** At $300k or more the score can never reach 0. RollWeak2 and RollWeak3
  went 0W 54L for two seasons with $1M+ in the bank, unsacked.
- **Twitching instead of judging.** An underdog was sacked at 4W 15L in season 1, before its season
  could be judged.
- **No expectations.** A club must win 62.5% of matches to hold steady, whether it is the weakest
  squad in the field or the strongest. The only difference is the money bracket.

## 2. The design in one paragraph

- When the World Tour field is drawn, the board sets a **target finish** from the club's squad
  strength against that field, adjusted for difficulty and for the money the club could spend.
- During the season the board watches the standings and can **warn** and **freeze spending**, but
  cannot sack.
- At season end it holds a **review**: the finish against the target, plus honours and money, moves
  confidence.
- **Sacking happens only at a review:** confidence at or below 20, or two failed seasons in a row.
  The one exception is a club that has stopped fielding a team.
- Money changes what is expected and punishes debt; it never protects anyone.
- A season spent forfeiting is graded failed badly, whatever the finish.
- The "forced sale" label is deleted.

## 3. Inputs, as measured

Squad strength is `sideRating` (the mean of the six stats) over the club's **pair**: its two best
contracted players able to play. When R-50 lands, "able to play" excludes the injured.

Measured on a starter-DB copy on 14 Sep:
- established and underdog careers created through the API
- the calendar walked to the season-1 draw without playing

| difficulty | starting pair | pair rating | season-1 field (18 clubs, two careers each) | strength rank |
|---|---|---|---|---|
| established | Yaritza Mendez 89.8, Nyasha Ncube 89.2 | **89.5** | strongest 88.5, weakest 68.7–71.7, mean ≈ 80 | **#1** |
| underdog | Aishath Nazeema 64.3, Fathimath Shiuna 63.3 | **63.8** | strongest 85.3–88.5, weakest 71.7–75.0 | **#19** |

No pool club is rated above 88.5, so an established starting pair ranks #1 in any field. No World
Tour qualifier has been rated below 68.7, so an underdog starting pair ranks #19. The harness makes
no signings and no training, so these ranks hold all arc for its careers. In real play they move as
the manager builds the squad, and the target moves with them.

## 4. The rules and numbers

### 4.1 Target finish, set at the draw (round 11)

- **Strength rank R** is 1 + the number of drawn clubs rated above the club's pair (1–19).
- **Difficulty allowance A:**
  - established +1: the board wants a top-two club, not a guaranteed title
  - underdog +3: a startup board accepts finishing below its squad's strength
- **Money places M:**
  - 1 place per full $150k of season-start balance above $300k, capped at 6
  - the reasoning: a club that could afford a better squad is expected to have bought one
- **Target T** is `clamp( clamp(R + A, 2, 19) − M, 2, 19 )`.
  - It is never #1: winning the league outright exceeds any target.
  - It is never worse than #19.
- **Before the draw** (rounds 1–10), the displayed target is last season's T. In season 1 it is #2
  for established and #19 for underdog.

### 4.2 The season-end review (at the rollover, before the next season opens)

**Grade G = T − finish** (the World Tour standings rank; positive means better than the target):

| G | grade | confidence |
|---|---|---|
| ≥ +5 | far exceeded | **+20** |
| +2 … +4 | exceeded | **+10** |
| −1 … +1 | met | **+5** |
| −4 … −2 | missed | **−10** |
| −8 … −5 | failed | **−25** |
| ≤ −9 | failed badly | **−40** |

**A forfeited season is failed badly.** A season in which the club forfeited at least half of its
World Tour matches is graded **failed badly (−40)**, whatever its finish. A club that did not play
cannot "meet" a target by finishing last.

Without this rule, the weakest squad's forfeited seasons would grade only "missed" or "failed"
against targets of #14-17, and never twice running, so money would still protect it (§5.1).

**Honours** (cumulative with the grade): World champion **+15**, runner-up **+8**, semi-finalist
**+4**.

**Money** (a modifier, never an immunity):
- in debt at season end: **−15**
- balance fell more than 25% across the season: **−5**
- otherwise: **0**

A club never gains confidence for being rich. Riches already raised its target through M.

**Confidence** carries over between seasons, clamped to 0–100, starting at 60. Carry-over is the
patience: seasons in the bank buy time.

**Outcome of the review:**
- **Sacked** if confidence after the review is ≤ 20, **or** the season was graded failed or failed
  badly for the second season running (patience runs out even with confidence in hand).
- **Final warning** if confidence ≤ 35, or the season was graded failed.
- **Safe** otherwise.
- **Season 5, the terminal season:** the review is the career verdict and cannot sack.

### 4.3 During the season: patience

- **No sacking for results mid-season.** A bad month is not a sacking.
- **A monthly check.** Every 30 game days from the draw, the board computes a **projected grade**
  from the current standings rank against T, using the table in 4.2. It shows it on the dashboard
  with the target: "Board expects a top-14 finish. You are 18th: missing."
- **Warning** when confidence + projected grade ≤ 45.
- **Spending freeze** (new signings, staff hires, facility upgrades) when confidence + projected
  grade ≤ 30. It lifts above 35. Renewals on unchanged terms stay allowed (R-52).
- **The one mid-season sacking: abandonment.** A club that has been unable to field a side (fewer
  than 2 contracted players able to play, R-48) for **30 consecutive game days** is sacked at its
  next forfeit. That is not a bad month; the club has stopped competing.

### 4.4 Forced sale: delete the label

**Recommendation: delete it.** The reasons:
- It has never done anything: `routes/board-confidence.ts` only names a target for display.
- A squad is two starters and one interchange. A board-forced sale would leave a club one injury
  away from forfeiting every match (R-48), compounding the failure it is meant to punish.
- Debt is already handled by the review's −15, by the freeze, and by the budget cap on signings.

**The "make it real" alternative, if Rob prefers it:** at a review that finds the club in debt, the
board sells the highest-paid **interchange** player (never a starter) at their asking price. If
there is no interchange, nothing is sold and the club takes a further −10.

## 5. The six harness careers under this design

Source: the final R-52 full run, 14 Sep (`docs/REPAIR-REGISTER.md` R-52). Squad strength, and so R,
holds all arc (§3): established R = 1, underdog R = 19. Honours come from the run's finals results.
Every club's balance grew every season, so the money modifier is 0 throughout.

| career | S | season-start balance | M | T | finish | G → grade | honours | confidence after review | outcome now | outcome under R-53 |
|---|---|---|---|---|---|---|---|---|---|---|
| RollStrong (est.) | 1 | $500,000 | 1 | 2 | #1 | +1 met +5 | semi +4 | 60 → **69** | safe | safe |
| | 2 | $1,109,559 | 5 | 2 | #4 | −2 missed −10 | semi +4 | **63** | safe | safe |
| | 3 | $1,533,058 | 6 | 2 | #4 | −2 missed −10 | semi +4 | **57** | safe | safe |
| | 4 | $1,974,077 | 6 | 2 | #3 | −1 met +5 | semi +4 | **66** | safe | safe |
| RollStrong2 (est.) | 1 | $500,000 | 1 | 2 | #1 | +1 met +5 | champion +15 | 60 → **80** | safe | safe |
| | 2 | $1,387,354 | 6 | 2 | #2 | 0 met +5 | runner-up +8 | **93** | safe | safe |
| | 3 | $1,932,468 | 6 | 2 | #10 | −8 failed −25 | — | **68** | safe | **final warning** (failed season) |
| | 4 | $2,264,772 | 6 | 2 | #4 | −2 missed −10 | semi +4 | **62** | safe | safe (not a second failed season) |
| RollStrong3 (est.) | 1 | $500,000 | 1 | 2 | #1 | +1 met +5 | runner-up +8 | 60 → **73** | safe | safe |
| | 2 | $1,336,774 | 6 | 2 | #5 | −3 missed −10 | — | **63** | safe | safe |
| | 3 | $1,704,073 | 6 | 2 | #6 | −4 missed −10 | — | **53** | safe | safe |
| | 4 | $2,042,257 | 6 | 2 | #4 | −2 missed −10 | semi +4 | **47** | safe | safe, trending down |
| RollWeak (und.) | 1 | $150,000 | 0 | 19 | #8 | +11 far exceeded +20 | — | 60 → **80** | safe | safe |
| | 2 | $532,420 | 1 | 18 | #15 | +3 exceeded +10 | — | **90** | safe | safe |
| | 3 | $861,040 | 3 | 16 | #19 | −3 missed −10 | — | **80** | safe | safe |
| | 4 | $1,120,200 | 5 | 14 | #18 | −4 missed −10 | — | **70** | safe | safe, with money unspent the target keeps tightening |
| RollWeak2 (und.) | 1 | $150,000 | 0 | 19 | #12 | +7 far exceeded +20 | — | 60 → **80** | safe | safe |
| | 2 | $485,200 | 1 | 18 | #19 | −1 met +5 | — | **85** | safe | safe |
| | 3 | $761,920 | 3 | 16 | #18 | −2 missed −10 | — | **75** | safe | safe |
| | 4 | $1,051,680 | 5 | 14 | #19 | −5 failed −25 | — | **50** | safe | **final warning**; a second failed season in S5 is the verdict, not a sacking |
| RollWeak3 (und.) | 1 | $150,000 | 0 | 19 | (sacked at 3W 14L) | — | — | — | **sacked mid-season** | **not sacked.** No mid-season sacking for results. At 3W 14L it sits about #19 against a target of 19, a projected "met", so no warning. The run cannot say how its season would have finished. |

How to read it:
- The two established clubs that never missed the top four by much stay safe.
- RollStrong2's collapse to #10 straight after a title and a runner-up is a failed season: a final
  warning, but not a sacking, because two good seasons bought patience.
- The underdogs are judged against the weakest squad in the field. RollWeak's #8 in season 1 is the
  best result any of them had, and it is graded as such.
- Hoarding money raises the bar each season. By season 4, RollWeak2's $1.05M means it is expected
  to finish 14th, not 19th.

Nobody in this run is sacked under R-53. This run had no abandoned squads, because R-52 keeps
renewals open. The design sacks the clubs that stop competing, and the ones that fail two seasons
running.

### 5.1 The earlier cases that prompted R-52 and R-53, under this design

| case (register) | now | under R-53 |
|---|---|---|
| RollStrong, R-48 run 1 (est.): 32-24 #1 runner-up, 28-26 #11, 30-24 #6; the board froze renewal, the squad lapsed, and S4 went 0W 54L with $2.3M | never sacked | S1 met +5, runner-up +8 → 73. S2 #11 against T2 (G −9, failed badly −40) → **33, final warning**. S3 #6 (missed −10) → **23, final warning**. S4 **sacked** by the abandonment rule 30 game days after the lapse. Without that rule: a forfeited season, −40 → 0, sacked at the review. (Since R-52 the freeze no longer blocks renewal, so this lapse can no longer happen.) |
| RollWeak2, R-48 run 2 (und.): #19, #19, then its squad lapsed and S3 and S4 went 0W 54L with $1.06M–$1.39M | never sacked | S1 #19 against T19 (met +5) → 65. S2 #19 against T18 (met +5) → 70. S3 **sacked** by the abandonment rule. Without it: S3 forfeited, −40 → 30 (final warning); S4 forfeited, −40 → 0, sacked (and a second failed season). |
| RollWeak3, R-48 run 2 (und.): #7, #16, then its squad lapsed and S3 and S4 went 0W 54L with $1.16M–$1.50M | never sacked | S1 #7 against T19 (G +12, far exceeded +20) → 80. S2 #16 against T18 (G +2, exceeded +10) → 90. S3 **sacked** by the abandonment rule. Without it: S3 forfeited, −40 → 50 (final warning); S4 forfeited, −40 → 10, sacked (≤ 20, and a second failed season). |
| RollWeak, R-47 run (und.): 4W 15L in season 1, $150k | sacked at that result | **not sacked**: no mid-season sacking for results; the season is judged at its review. |

Season-start balances and the money places (M) behind these targets come from the logs of R-48
runs 1 and 2:
- RollWeak2: $456,300 at S2 start (M 1)
- RollWeak3: $510,100 at S2 start (M 1)

## 6. What changes where (for the implementation step, not now)

- **A per-season review record:** career, season, pair rating, R, A, M, T, finish, grade, honours,
  money, confidence before and after, outcome.
  - That is a new career-scoped table, so it touches the starter DB and the delete cascades.
- **The target** is computed at the draw (`utils/worldTour.ts`), where the field first exists.
- **The review** runs inside `rolloverSeason`, and is the terminal verdict at season 5.
- **The monthly check and abandonment rule** sit in the calendar advance.
- **Remove the per-match confidence deltas** in `/simulate` and `recordForfeit`, and the sacking
  check after each result (keeping only abandonment).
- **`utils/board-confidence.ts`:**
  - the stage ladder becomes safe / warning / spending freeze / final warning
  - `financeAdjustment` stops being read-time
  - `forcedSaleTarget` and the "forced sale" stage are deleted
- **Dashboard and board-confidence page:** target, projected grade and last review.
- **Harness:**
  - the review table computed for fixed finishes (every row of §5 as an assertion)
  - no sacking mid-season for results
  - abandonment sacks after 30 days
  - money never prevents a sacking: a rich club with two failed seasons is sacked
  - a season with at least half its matches forfeited is graded failed badly
  - the five-season arc reports reviews per season
- **Existing saves:** today's stored `board_confidence` becomes the carried confidence, and the target
  is set at the next draw.

## 7. Open questions for Rob

1. **The allowances** (established +1, underdog +3) and **money places** ($150k per place, capped
   at 6). They are chosen to make "underdog #8 = success, established #10 = failure" true with room
   to spare.
2. **Sacking at ≤ 20, or two failed seasons in a row.** Should one failed-badly season (≤ −9) also
   sack when confidence is already under 40?
3. **The abandonment rule:** keep it, and is 30 game days right?
4. **Forced sale:** delete (recommended), or the interchange-only version in §4.4?
5. **Season 5:** the review is a verdict that cannot sack. Should the verdict feed the career score
   (Phase 6)?
