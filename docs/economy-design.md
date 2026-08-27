# Volleyball Empire — Economy Design Spec

## Design intent
- A career is FIVE SEASONS. It ends, and it has a result.
- The World Grand Final is reachable from season three at the earliest. A
  competent player gets there within the arc; a mediocre one does not.
- The player CAN lose. Sustained debt or sustained failure gets you sacked
  before the arc completes.
- Difficulty is chosen at career start: UNDERDOG or ESTABLISHED.

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
