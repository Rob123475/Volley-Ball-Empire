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

#### Ranking points: RESET per season (decided, modelled)

The implementation already resets — `competitor_rankings` is keyed on
(competitor, career, season_year), so each season creates a fresh row at zero.
That was not a decision anyone had made, so it was modelled against the real
schedule and engine before being kept.

Modelled with the agreed weights (D1) and thresholds (Silver 15, Gold 40), with a
squad following the measured Phase 1 curve (75.0 in season one, then the 89.5
ceiling):

| policy | S1 | S2 | S3 | S4 | S5 | dead fixtures/season |
|---|---|---|---|---|---|---|
| **reset** | Silver 29 | **Gold 41** | Silver 39 | Silver 39 | Silver 36 | 31-33 |
| accumulate | Silver 30 | Gold 76 | Gold 122 | Gold 165 | Gold 208 | 44-46 |
| carry 50% | Silver 29 | Gold 57 | Gold 67 | Gold 78 | Gold 81 | 41-46 |

**RESET is the only policy with tension in it.** The club reaches Gold in season
two and then oscillates on the boundary — 41, 39, 39, 36 against a threshold of
40 — so holding Gold is a live question every season. That is the demotion
pressure the ladder is supposed to create.

Both carry-over policies ratchet. Under accumulate the club is permanently Gold
from season two and 46 of 62 fixtures are dead. Carry-50% only slows it: the
carried figure alone climbs 15 -> 29 -> 34 -> 39 and is effectively at the Gold
threshold by season five, so it converges to the same permanent-Gold state.

The worry that a reset lets one bad run erase three good ones does not
materialise, because nothing that represents progress is stored in the ranking.
Squad, balance, trophies, standings and history all persist across the boundary.
The ranking is a season's competitive standing, like a real tour ranking, and
resetting it is what makes the season mean something.

**Thresholds were checked, not assumed.** Silver 20 / Gold 55 was modelled as an
alternative and never reaches Gold at all across the whole arc (peak 41), which
fails I8's "a well-run club reaches the Grand Final within the arc". Silver 15 /
Gold 40 stands.

**Deliberate deviation from the arc, accepted.** §1's arc implies Silver in
season two and Gold in season three. The measured curve is one season ahead:
Silver in season one, Gold in season two. Recorded here as a deviation rather
than left as drift — three seasons of contested Gold beats two seasons of
climbing, and I8 is the judge of whether that is right.

**Half the calendar is dead, by construction.** Exactly one tier is live at a
time — below a threshold is ineligible, above your band is pushed out — so 31 to
33 of 62 fixtures score nothing in any season. That is a direct consequence of
D4(b) and it is a UI problem, not a modelling error. See the Phase 8 scope.

### 2. Prize structure
Prize scales steeply by tier, so tier ACCESS — not win rate within a tier — is
the dominant income lever. No single match may dominate a season (see I3).

### 3. Costs
Wages scale with player rating (already correct: monthly figure, weekly drip at
salary ÷ 4.333). Staff and facilities scale with ambition. Costs must rise as you
climb, but slower than income does (see I5).

### 4. Sponsorship, and where money goes
Reputation-linked, option B decay toward 50 at 5%/week already implemented.
Re-tune: ±1/match was calibrated against a broken 33–40% win band. At real win
rates most clubs now gain reputation, so the decay is pulling rep down from above
50 rather than rescuing it. Sponsorship must not make Bronze survival comfortable.

**REFRAMED — Phase 4's real job is money SINKS, not squad prices.**

The Phase 1 measurement showed the affordable squad hits the roster ceiling in
season two and never moves again: three of five seasons have no spending
decision left. The obvious reading is "the best players are too cheap", and it
is the wrong one.

This is 2v2 beach volleyball. A squad is two to four players. However expensive
the market is, a club that earns steadily will saturate it within a season or
two — there is nothing left to buy, because there are only so many slots. Raising
prices moves the saturation point from season two to season three. It does not
remove it, and it cannot: the sink is bounded by the format.

The actual defect is that **players are the only money sink in the game.**
Everything else that should compete for the budget already exists and none of it
is a decision:

- **Staff.** 120 of them across 12 roles, with a hiring cost and a termination
  fee, and no reason to hire a better one over a cheaper one.
- **Medical.** A separate market of 60, same problem.
- **Facilities.** Levels exist and feed a club rating; upgrading is not a
  meaningful call.
- **The academy.** The pipeline now works, but investing in it costs nothing and
  returns nothing distinguishable.
- **Scouting missions.** Elective, cheap, and the only thing that restocks the
  academy — currently a footnote rather than a budget line.

So Phase 4 is: give money somewhere else to go, so that a club with $2,000,000
in season four still has decisions to make. Concretely, that means each of those
systems needs a cost that scales and a benefit that is legible, and the tuning
target is that a rich club can still spend itself into trouble.

Success is measured by I9, and I9 should be read as "are there still decisions",
not "is the balance small".

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

## Pre-economy baseline — measured 2026-08-28

Phases 2-4 are judged against these numbers. Without a baseline "better" is
unmeasurable. Produced by `harness/invariants.mjs`; re-run it to reproduce.

Basis, stated because it matters: I3 is pure configuration analysis of the
shipped schedule. I1 and I4 run the REAL match engine over the REAL shipped
prize table with REAL squads from the shipped database — but NOT through a
played season, because season rollover does not exist yet. They are the engine
and the data, not a career.

**I7 ONE ENGINE — PASS.** This is a Phase 0 acceptance test and it FAILED when
first measured. `simulateFixtureResult` was a separate model: a `>` comparison
with uniform noise, sets by coin flip, and point totals from `Math.random()*18+3`
that ignored team strength entirely. It diverged from the shared engine by up to
26.9pp and produced a GUARANTEED win at +25 rating, which the engine design
rules out. Now delegates to the shared engine; max divergence 0.4pp.

  | rating gap | shared | regional | delta |
  |---|---|---|---|
  | +0  | 52.1% | 52.2% | 0.1pp |
  | +5  | 60.7% | 60.7% | 0.0pp |
  | +10 | 67.8% | 67.4% | 0.4pp |
  | +25 | 85.7% | 85.5% | 0.2pp |

  NOT covered: the youth league, which does not have a second engine — it has
  none. AI academy ladder records are seeded from `Math.random()` and the
  championship is a coin flip with no rating involved. See the Phase 1
  requirement below.

**I3 NO SINGLE-MATCH LOTTERY — VIOLATED, 35.0% (target <= 15%).**
62 events, $1,430,000 total achievable prize money.

  | tier | events | total |
  |---|---|---|
  | World Semi Final | 1 | $150,000 |
  | Silver | 16 | $215,000 |
  | Bronze | 30 | $217,000 |
  | Gold | 14 | $348,000 |
  | World Final | 1 | $500,000 |

  The single World Final is 35% of the entire season and more than double the
  30-event Bronze tier combined.

**I1 MONOTONIC RETURN — VIOLATED, return multiple falls as squad quality rises.**

  | squad | rating | season wages | expected prize | return |
  |---|---|---|---|---|
  | cheapest | 66.2 | $132,000 | $465,654 | 3.53x |
  | lower-mid | 69.7 | $204,000 | $519,656 | 2.55x |
  | upper-mid | 72.2 | $252,000 | $543,339 | 2.16x |
  | best | 76.3 | $360,000 | $663,604 | 1.84x |

  Spending more earns more in absolute terms but less per dollar, every step of
  the way. Assumes every squad enters every event, which is what the game
  currently allows with no tier gating — so absolute income is an upper bound
  and the RATIO is the finding.

**I4 PREDICTABILITY — VIOLATED, 83.9% max deviation (target <= 25%).**
Same squad, five runs of the full schedule:
$458,000 / $939,500 / $337,500 / $431,000 / $388,000, mean $510,800.

  The spread is dominated by whether the $500,000 final is won, so I3 and I4 are
  the same defect measured two ways. Fixing the prize distribution should move
  both.

**Not measured** — blocker on record, deliberately not run:

  - I2 FAILURE IS POSSIBLE — no fail state; `isJobAtRisk` has zero consumers and
    there is no sacking path. Phase 5.
  - I5 CLIMBING PAYS — no tier structure; no boundary to measure a delta across.
    Phases 2 and 3.
  - I6 UNDERDOG IS TIGHT — no start modes and no fail state. Phases 5 and 6.
  - I8 THE ARC COMPLETES — no season rollover; a career cannot pass season one.
    Phase 1.
  - I9 MONEY STAYS MEANINGFUL — no season rollover. Phase 1.

## Phase 1 measurements — added 2026-08-28

**Academy supply.** The shipped academy was banded 15-19, five cohorts, which
four season boundaries clear — leaving it empty from season five. Shifted down
one year to 14-18 (still inside the valid youth band) so it stays populated for
the whole arc with no generator and no new intake system:

  season 1: 72   season 2: 63   season 3: 48   season 4: 29   season 5: 14

Promotion was already correctly age-gated at 19 and already staggered; the band
was simply one year too narrow.

**Youth scouting created seniors.** `youth-scouting.ts` never set `playerType`,
which defaults to `"senior"`, so every scouted 16-year-old was created as a
senior on an academy contract and never entered the youth pool. Fixed. Note that
scouting is still elective and produces nothing passively: a player who never
runs a mission has only the shipped 72.

**AI difficulty was the wrong dial.** Pool-club ratings drive the regional
league, which the player never plays in. Every player match resolves through
`opponentRatingFromTier`, and of 11 distinct World Tour opponents, ZERO match a
pool-club name — so the lookup always falls through to `TIER_BASE_RATING`, which
was constant across all five seasons. `TIER_RATING_PER_SEASON = 2` now stiffens
every tier by 2 a season: Bronze 64 -> 72, World Final 86 -> 94.

**Player vs tier, measured across a real five-season career:**

  | season | balance | affordable squad | Gold tier | gap |
  |---|---|---|---|---|
  | 1 | $500,000 | 75.0 | 76 | -1.0 |
  | 2 | $1,020,000 | 89.5 | 78 | +11.5 |
  | 3 | $1,540,000 | 89.5 | 80 | +9.5 |
  | 4 | $2,060,000 | 89.5 | 82 | +7.5 |
  | 5 | $2,580,000 | 89.5 | 84 | +5.5 |

k=2 works: the gap NARROWS from season two rather than widening. The curve has
stopped flattening.

It has NOT been solved, and a green I8 must not be read as if it had. Two things
this does not touch:

  - Nothing stops a club entering 30 Bronze events a season forever. That is
    tier qualification gating — Phase 2, and it is what I1 and I5 measure.
  - The affordability curve is over by season two. $1,020,000 already buys the
    two best players in the game, and the affordable squad never moves again.
    Three of the five seasons have no spending decision left. I9 VIOLATED, with
    two causes: passive income of $520,000 a season unrelated to results, and a
    roster ceiling reachable on one season's earnings.

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
  - **REQUIRED: give the youth league an engine.** The AI academy ladder is
    seeded from `Math.random()` and the youth championship is a coin flip; no
    squad rating is involved at any point, so youth results are unrelated to the
    academy the player builds. This is not a second engine competing with the
    shared one (I7) — it is the absence of one. It needs AI academy strength to
    exist before it can use matchEngine, which is why it belongs with rollover
    rather than with the engine unification.
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
- **Phase 4 — Policies, sponsorship, and money sinks (§4).** COMPETENT and
  INCOMPETENT in the harness; sponsorship retune. Measures I6. Gate: the policies
  must diverge — if they do not, report it.
  - **REQUIRED: money must have somewhere to go.** See the reframing in §4. The
    squad is two to four players, so the transfer market saturates within a
    season or two whatever it costs — raising prices delays the problem rather
    than fixing it. Staff, medical, facilities, the academy and scouting all
    exist and none is a spending decision. Phase 4 makes at least two of them
    into real budget lines, and I9 is judged on whether a rich club still has
    decisions in season four, not on whether the balance is small.
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

### Phase 8 scoping — surveyed 2026-08-28

Measured against the actual frontend, not estimated. `artifacts/beach-volleyball`
has 38 page files and the World Tour hub already carries eight tabs (Overview,
Calendar, Fixtures, Results, Standings, World Finals, All-Star, History).

**The finding: NONE of the eight rows above is visible anywhere today.**
`rankingPoints` appears ZERO times in the whole frontend. Every "qualif" match in
the source is Olympic qualification, which is a different system. `rankBand` in
`competition/wt-ladder.tsx` is a ladder-position colour, not the career-score
band. `manager-contract.tsx` contains no `isJobAtRisk` or board-confidence
reference at all.

So Phase 8 is not "surface some new numbers on existing screens" — for six of
the eight rows there is no host screen and no data binding whatsoever.

**Build vs extend, per row:**

| Row | Host | Verdict |
|---|---|---|
| Ranking | — | NEW screen. `GET /seasons/ranking` exists (Phase 2.1); nothing consumes it |
| Qualification | `competition/wt-fixtures.tsx` | EXTEND. The fixtures list renders no tier and no prize today, so it needs both before it can show a threshold or a gap |
| Tier status | `dashboard.tsx` | EXTEND. Dashboard already hosts widgets; add one |
| Finals | `competition/world-finals.tsx` | EXTEND. Tab exists; group stage and bracket do not |
| Fail state | `dashboard.tsx` + `manager-contract.tsx` | EXTEND both. `manager-contract.tsx` is the natural home and currently shows none of it |
| Season end | — | NEW screen. Nothing renders at a season boundary; the rollover returns `seasonRollover` and `careerComplete` and the client ignores both |
| Career end | — | NEW screen. `careerComplete` is returned and unused |
| Start modes | `new-career.tsx` | EXTEND |

**Push-out fixtures must be collapsed, not merely labelled.** D4(b) keeps the
calendar full deliberately, which means a season-four club scrolls past ~30
fixtures that pay a reduced prize and score zero ranking points. Labelling each
one is not enough at that volume: the fixtures list must collapse or
de-emphasise them into a foldable group ("28 events below your tier"), so the
live fixtures are what the player actually sees.

**The eligibility reason is a Phase 2 API shape, not a Phase 8 one.** "Why a
club did or did not qualify must be legible, never silent" cannot be built from
a rejection on click — by then the player has already chosen. Every fixture in
the list must carry its own eligibility with it:

    { eligible: boolean,
      reason: "open" | "below_threshold" | "above_tier" | "not_qualified",
      threshold: number | null,     // what this tier requires
      currentPoints: number,        // what the club has
      gap: number | null }          // how far away, when below

Settled now so it is designed into the Phase 2 endpoint rather than discovered
when the screen is built.

**Two things Phase 8 must not repeat.** The frozen `poolRanking` and the empty
`competitor_rankings` were both invisible for a whole phase because nothing
rendered them — a value nothing displays is indistinguishable from one nothing
writes. Every number Phase 8 surfaces should be reachable from a screen the
player normally visits, not only from a detail view they may never open.

And the qualification row is the one that carries the design: "why a club did or
did not qualify must be legible, never silent." A fixture the player cannot
enter must say what it needs and how far away they are, in the fixtures list —
not fail on click. That is a Phase 2 API requirement as much as a Phase 8 one:
the eligibility reason has to come back with the fixture, not only on rejection.

**Dependency:** rows 1-4 need Phase 2 (thresholds, push-out), row 5 needs
Phase 5 (fail state), rows 7-8 need Phase 6 (career score, start modes). Row 6
(Season Review) is buildable NOW — rollover already returns everything it needs.

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
