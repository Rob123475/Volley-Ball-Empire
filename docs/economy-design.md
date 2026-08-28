# Volleyball Empire — Economy Design Spec

## Design intent
- A career is FIVE SEASONS. It ends, and it has a result.
- The World Grand Final is reachable from season three at the earliest. A
  competent player gets there within the arc; a mediocre one does not.
- The player CAN lose. Sustained debt or sustained failure gets you sacked
  before the arc completes.
- Difficulty is chosen at career start: UNDERDOG or ESTABLISHED.
- The career ends with a CAREER SCORE and a named rank band, so five seasons
  resolve into an answer to "how did I do?". See Career score below.

## The arc
The intended shape, to be produced by qualification thresholds rather than
scripted:
- Season 1 — Bronze. Survival. Learning the club.
- Season 2 — Silver within reach. First real signings.
- Season 3 — Gold. Grand Final possible for a strong run.
- Seasons 4–5 — contention, and defending what you built.
ESTABLISHED starts roughly one tier further along, not with more time.

Winning the Grand Final does NOT end the career. The arc runs its full five
seasons and you attempt to defend. The career ends after season five with a
final result: trophies won, best world ranking, final balance, hall of fame
entries, and a career score.

## Career score
Career score exists to answer "how did I do?" at the end of five seasons. It must
reward the things the game is about, and it must make a good UNDERDOG run beat a
good ESTABLISHED run — otherwise nobody picks the harder start.

Components, in descending weight:

| Component | Weight | Detail |
|---|---|---|
| Trophies won, by tier | dominant | Grand Final 1000, Gold 120, Silver 50, Bronze 15. A Grand Final is worth ~8 Gold events. |
| Peak world ranking | high | `max(0, 1200 - 110 x (rank - 1))`. Rank 1 = 1200, zero from rank 12. |
| Progression | medium | Per tier, `max x (5 - firstQualifiedSeason) / 4`. Maxima: Silver 200, Gold 300, Finals 300. Qualifying in season 2 scores double season 4. Never qualified = 0. |
| Financial health at end | modest | `balance / 10,000`, capped +400, floored -300. Money is a means, not the point. |
| Difficulty multiplier | applied last | UNDERDOG x1.5, ESTABLISHED x1.0. |

Being sacked ends the career with the score earned to that point, not zero.

Rank bands: Legend 6000+, Elite 4000+, Respected 2200+, Journeyman 900+,
Forgotten below. Always shown with the band, never a bare number.

Modelled outcomes:

| Career | Raw | Total | Band |
|---|---|---|---|
| UNDERDOG exceptional (2 GF, peak #1) | 6110 | 9165 | Legend |
| ESTABLISHED exceptional (2 GF, peak #1) | 6815 | 6815 | Legend |
| UNDERDOG competent (3 Gold, peak #6) | 2480 | 3720 | Respected |
| ESTABLISHED competent (5 Gold, peak #5) | 3085 | 3085 | Respected |
| Sacked season 4, two Gold titles | 1265 | 1898 | Journeyman |
| Survived five seasons, won nothing | 225 | 338 | Forgotten |

Both acceptance conditions hold: the sacked manager with two Gold titles (1898)
beats the survivor who won nothing (338), and a good UNDERDOG run (9165) beats a
good ESTABLISHED one (6815). ESTABLISHED out-achieves UNDERDOG in RAW terms, as
it should — it starts a tier up. The multiplier must exceed ~1.24x to flip that;
1.5x is a deliberate margin.

## What the player should feel
- UNDERDOG: money is tight from the first week. Bronze-locked. Every signing
  hurts. Survival is an achievement; the climb is the game.
- ESTABLISHED: comfortable but not rich, competing in Silver/Gold. The job is
  running a business well, not surviving.
- Both: the Grand Final is reachable but never routine.

## Structural rules

### 1. Tier qualification (this is the core change)
Clubs earn Ranking Points from results. Tour tiers gate on ranking:
- Bronze — open to all
- Silver / Gold — require a ranking threshold
- World Semi Final / Grand Final — qualification by end-of-season standings
A club ABOVE a tier must be pushed out of it: either ineligible, or entering
yields sharply reduced prize and zero ranking points. A strong club must not be
able to farm Bronze. This is what makes investment pay off.
Thresholds are tuned to produce the arc above — not hardcoded to a season number.

### 2. Prize structure
Prize scales steeply by tier, so tier ACCESS — not win rate within a tier — is
the dominant income lever. No single match may dominate a season (see I3).

### 3. Costs
Wages scale with player rating (already correct: monthly figure, weekly drip at
salary ÷ 4.333). Staff and facilities scale with ambition. Costs must rise as you
climb, but slower than income does (see I5).

### 4. Sponsorship
Reputation-linked, option B decay toward 50 at 5%/week already implemented.
Re-tune: ±1/match was calibrated against a broken 33–40% win band. At real win
rates most clubs now gain reputation, so the decay is pulling rep down from above
50 rather than rescuing it. Sponsorship must not make Bronze survival comfortable.

### 5. Fail state
Board confidence driven by finances, results, and tier expectations. Sustained
debt or underperformance ends the career early. isJobAtRisk currently has zero
consumers — wire it. Escalate visibly: warnings → blocked spending → forced
player sales → sacked. The player must always see it coming.

### 6. Season rollover — MINIMAL, because the arc is bounded
Over five seasons the world does not need to regenerate itself:
- Age players by one year at the season boundary. (Currently zero code does this.)
- Retire players past a threshold — a handful per season, not a system.
- Promote youth to fill gaps. No senior generation required for a five-season arc.
- Carry balance, standings, history and hall of fame forward.
- Regenerate fixtures parameterised by year (generateSeasonFixture is currently
  keyed to hardcoded 2026 dates).
Build the season boundary handler. Do NOT build deep aging curves, procedural
player generation, or a self-sustaining world — those are only needed for an
endless mode, which is deferred.

## Manager policies — the harness subjects
Every harness run so far used one implicit policy (buy a fixed squad, contest
everything), so there was no such thing as a badly-run club to measure. I2 and I8
measure different clubs; both must be defined.

The two policies differ ONLY in financial decision-making. Both enter everything
they qualify for, so what is isolated is money management, not participation.

COMPETENT
- Signs only when the balance after signing covers at least three months of the
  new wage bill.
- Only signs a player who improves the starting pair's average rating.
- Keeps the total monthly wage bill at or below ~35% of projected monthly income
  (sponsorship plus expected prize at the current tier).
- If the wage bill exceeds ~50% of monthly income, releases the highest-paid
  non-starter.
- Spends on staff and facilities only from surplus above two months of running
  costs.

INCOMPETENT
- Signs the highest-rated player it can afford in a single payment, ignoring the
  ongoing wage entirely.
- Chases players above its tier (top quartile of the market regardless of
  eligibility).
- Applies no wage-to-income test.
- Never releases anyone.
- Spends any surplus immediately on staff and facilities.

I2 is measured against INCOMPETENT, I8 against COMPETENT. Thresholds are tuned
against their own policy. If the two policies produce similar outcomes, that is
itself a finding and must be reported: it would mean the game's decisions do not
matter enough.

## Invariants — these are the acceptance tests
Tune numbers until the harness proves every one. Report each PASS/FAIL with the
measured figures.

- I1 MONOTONIC RETURN. For squads competing at their correct tier, a better squad
  must earn a better net result. Spending more must never make you less
  profitable. (Currently violated: cheapest returns 2.6× costs, best 1.8×.)
- I2 FAILURE IS POSSIBLE. A badly-run club must reach sacking within roughly
  three seasons. Measure it and show the path.
- I3 NO SINGLE-MATCH LOTTERY. No individual match worth more than ~15% of a
  season's achievable prize income at that club's tier. (Currently violated: the
  $500,000 Grand Final exceeds an entire Bronze season.)
- I4 PREDICTABILITY. Season-to-season prize income for the SAME squad varies less
  than about ±25%, so the player can plan. Measure across 5 runs.
- I5 CLIMBING PAYS. Moving up a tier increases both income and costs, with income
  rising faster. Show the delta at each tier boundary.
- I6 UNDERDOG IS TIGHT, NOT DOOMED. An UNDERDOG start played competently survives
  season one and shows progress; played badly it can fail. Both measured.
- I7 ONE ENGINE. All match results — player, AI, regional league, /watch and
  /simulate — come from the same model. A league table generated by different
  maths than the player's results is fiction.
- I8 THE ARC COMPLETES, AND ISN'T GUARANTEED. Simulate full five-season careers
  from both start modes. A well-run club reaches the Grand Final within the arc;
  a poorly-run one does not. Report the season each simulated career first
  qualifies for Gold, and first reaches the Final. This is the single best test
  of whether the difficulty curve works.
- I9 MONEY STAYS MEANINGFUL. By the end of season five, a successful club must
  not be so wealthy that spending decisions no longer matter. Report the end-of-
  arc balance for a strong career and show that squad cost is still a constraint.

## Build phases

Dependency order. Each phase states what it builds and what it measures.

- **Phase 0 — Competitor entity.** `competitors` identity table (nullable
  team_id and pool_team_id, exactly one set); per-career season rankings FK'd to
  it; World Tour field drawn from real pool clubs instead of name strings;
  ranking-point accrual; fix the broken season_final_standings writer. Fold
  regionalSeason and youth-league results into matchEngine. Measures I7.
- **Phase 0.5 — Per-career player and staff state.** players and staff are global
  reference pools, but the columns a career mutates lived on them, so signing a
  player in one career removed them from every other career's market and
  injuries/fitness/contracts applied across saves. career_player_state and
  career_staff_state hold the per-career half; the mutable columns are DROPPED
  from the reference tables so a missed read is a compile error, not a silently
  global value. ~269 compile errors across 28 files, taken in chunks with the
  tree green between each.
- **Phase 0.6 — Regional league and pool-team state.** SEPARATE PHASE, not a
  ride-along. regional_league_seasons/_fixtures/_results are keyed by season with
  no career scope, and continental_pool_teams mixes immutable identity with
  mutable per-career state (is_active_in_league, promotion_count,
  relegation_count) — the same disease as players. Sized at ~155 code references
  across 863 lines plus a new state table plus per-career seeding of 6 seasons
  and 180 fixtures, which is comparable to the player migration itself. The two
  free column-adds (world_tour_qualifications, ai_managers — both empty today,
  both populated by later phases) fold into a Phase 0.5 chunk instead.

  Measurement narrowed the split considerably. `continental_pool_players` is
  never updated anywhere — it is pure reference data and needs only the
  `age` -> `base_age` rename. Of the 13 columns on `continental_pool_teams` only
  THREE are ever written (`is_active_in_league`, `promotion_count`,
  `relegation_count`, all from promotion/relegation).

  The other five — `rating`, `pool_ranking`, `form`, `fitness`, `fatigue` — are
  read and displayed but written by nothing. They are left as reference rather
  than moved on a prediction that something will one day write them. `rating` and
  `pool_ranking` are now Phase 1 and Phase 2 requirements respectively (above),
  because both are dependencies of already-specified work. `form`, `fitness` and
  `fatigue` are simply unimplemented: they render as live AI-club condition in
  the regional-league UI and never change. No action until something needs them.

  Per-career seeding generates the league at career creation rather than shipping
  a pre-built one in the starter database. Season rollover needs a fixture
  generator for seasons 2-5 regardless, so building it here means every new save
  exercises it and a bug surfaces immediately instead of at the first rollover.
- **Phase 1 — Season rollover (§6).** Boundary handler terminal at season five;
  age, retire, promote youth; carry balance/standings/history/HoF; fixtures
  parameterised by year and tier. Also scope seasons per career. Measures that a
  five-season career runs end to end.
  - **REQUIRED: AI clubs must progress.** `continental_pool_teams.rating` is
    written by nothing today — it is seeded and then frozen for the whole arc.
    The match engine takes opponent rating as its input, so a frozen rating means
    every AI club stays exactly as strong in season five as in season one while
    the player's squad improves. The game gets monotonically easier by
    construction and **I8 cannot hold**: "a well-run club reaches the Grand Final"
    becomes true for any club that merely survives. Rollover must move AI ratings
    — drift toward their tier, reward promotion, penalise relegation — and the
    Phase 1 measurement must show AI strength changing across five seasons, not
    only that the career completes.
- **Phase 2 — Tier qualification (§1).** Ranking thresholds, finals
  qualification from standings, push-out rule. Measures I1 against gating ALONE
  (wage curve untouched unless I1 still fails) and I5.
  - **REQUIRED: resolve the two rankings.** Tier qualification gates on Ranking
    Points, which `competitor_rankings` now holds per career and per season. But
    `continental_pool_teams.pool_ranking` is also displayed in the regional-league
    UI and is written by nothing — it is frozen at its seeded value. Shipping both
    gives the player two rankings side by side, one of which never moves, and no
    way to tell which one gates their progression. Phase 2 must pick one:
    pool_ranking is SUPERSEDED (delete the column and the UI field) or it is
    DISTINCT (say what it means, and make it live). Not both.
- **Phase 3 — Prize and Finals week (§2).** Purses re-scaled by tier; World Tour
  Finals as group stage plus semi plus final. Measures I3, I4.
- **Phase 4 — Policies and sponsorship (§4).** COMPETENT and INCOMPETENT in the
  harness; sponsorship retune. Measures I6. Gate: the policies must diverge — if
  they do not, report it.
- **Phase 5 — Fail state (§5).** Wire isJobAtRisk and the escalation ladder.
  Measures I2 against INCOMPETENT.
- **Phase 6 — Start modes and career score.** UNDERDOG/ESTABLISHED, career-end
  result, score and bands. Measures I8, I9.
- **Phase 7 — Full invariant sweep.** Re-run ALL NINE invariants against one
  single final build and report them together. Every earlier phase measures its
  invariants against a different codebase state — phase 3 re-scales prizes,
  invalidating I1 and I5 as measured in phase 2; phase 4 moves everything.
  Measuring nine things at nine points in time and calling it nine passes is not
  a pass. Only the phase 7 numbers count.
- **Phase 8 — Make it visible.** Phases 0-6 touch no frontend. A management game
  whose management systems are invisible is the same as not having them. See UI
  scope below.

## UI scope (Phase 8)
What the player must be able to see, by stage:

| Area | Screen | Must show |
|---|---|---|
| Ranking | new Rankings screen | Current ranking points, world position, the table around the player, points earned per event |
| Qualification | Matches/fixture | Per event: qualified / not qualified / above tier, the threshold, and the gap. Why a club did or did not qualify must be legible, never silent |
| Tier status | Dashboard | Current tier, points to the next threshold, what unlocks |
| Finals | new Finals screen | Group stage table, bracket, qualification path |
| Fail state | Dashboard + Finances | The escalation ladder as a visible state: warning, spending blocked, forced sales pending, sacked. The player must always see it coming |
| Season end | new Season Review | Standings, tier movement, prize summary, what changed |
| Career end | new Career Result | Trophies, peak ranking, progression, final balance, career score and rank band |
| Start | New career | UNDERDOG vs ESTABLISHED choice with a plain description of the difference |

## What is being kept (do not rewrite)
- finances table and the atomic, guarded prize payment transaction
- ledger and /finances/summary endpoints (now paged)
- the rebuilt match engine (pPoint model, real set scoring)
- salary units (monthly, proven via askingPrice = salary × 12)
- the measurement harness — the most valuable thing built so far

## What is being replaced
- prize distribution and tier structure
- tour entry rules (currently none exist)
- sponsorship curve and reputation tuning
- board confidence / fail state (currently computed and never read)
- starting conditions (currently one, needs two)
