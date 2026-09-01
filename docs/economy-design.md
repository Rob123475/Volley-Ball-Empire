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

**SETTLED: reset per season.** The deciding reason is that nothing which
represents progress lives in the ranking. Squad, balance, trophies, standings,
history and hall of fame all persist across the boundary; the ranking is a
season's competitive standing and nothing else. Resetting it therefore erases no
achievement — it only asks the club to prove itself again, which is what makes a
season mean something.

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

#### Tier eligibility: CUMULATIVE (modelled, against both our leans)

The question was whether one-tier-live was intended or merely what D4(b)
implies. Modelled both against I1 and I5 before the gate was built.

**Exclusive FAILS I5 outright.** Same squad, income by band:

  | mode | Bronze | Silver | Gold |
  |---|---|---|---|
  | exclusive | $538,833 (32 ev) | **$510,810 (18 ev)** | $576,543 (16 ev) |
  | cumulative | $522,973 (32 ev) | $694,145 (48 ev) | $939,995 (62 ev) |

Under exclusivity a club that climbs to Silver earns LESS than it did in Bronze.
Climbing costs you money. That is not a tuning miss that a prize rescale fixes —
it is structural: promotion trades 32 Bronze events for 18 Silver ones, and no
plausible per-event prize covers an event count falling faster than the purse
rises. "Climbing pays" is the whole point of §1, so exclusivity contradicts it.

Cumulative passes cleanly and monotonically, because the calendar GROWS as you
rise: 32 -> 48 -> 62 events.

It also dissolves the dead-fixture problem. Under exclusivity 31-33 of 62
fixtures score nothing every season; under cumulative a Gold club has 62 live
fixtures and none dead. The Phase 8 requirement to collapse push-out events
shrinks to a much smaller case — only tiers the club has not yet unlocked, which
are genuinely not available rather than pointedly worthless.

**Legibility, which was the case for exclusivity, survives.** "You have unlocked
Bronze, Silver and Gold" is not harder to state than "you are in Silver"; the
fixture list simply shows what is open. D4(b)'s push-out still applies to any
tier a club is above — there just are not any, because cumulative means a club
is never above a tier it has cleared.

**I1 FAILS under BOTH, and gating is not what fixes it.**

  | mode | cheapest | lower-mid | upper-mid | best |
  |---|---|---|---|---|
  | exclusive | 1.91x | 1.34x | 1.29x | 1.03x |
  | cumulative | 2.19x | 1.59x | 1.37x | 1.11x |

Gating narrows the inversion substantially — the pre-gating baseline spanned
3.53x to 1.84x, a spread of 1.69x, against 1.08x under cumulative — but the
direction is still wrong, and net result falls too ($157k down to $40k). The
best squad grosses the most and nets the least, because a $360,000 wage bill
eats the difference.

That is the wage curve, not the gate, and §1's own escape clause anticipated it:
"Measures I1 against gating ALONE (wage curve untouched unless I1 still fails)."
It still fails. The wage curve is therefore in scope for Phase 2.

**Caveat on these numbers.** The $500,000 World Final is always eligible
(qualification-based, not ranking-gated) and dominates every band's income,
which is why the exclusive Bronze figure looks so high. I3 is contaminating I5's
measurement. Re-measure both after Phase 3 rescales the purses.

**Superseded by the cumulative decision above.** Under the exclusive model that
was first assumed, 31-33 of 62 fixtures scored nothing every season. Cumulative
eligibility removes that: a club sees the tiers it has cleared plus the ones it
has not yet unlocked, and nothing it has cleared is ever worthless. Kept here
because the Phase 8 scope still needs to handle not-yet-unlocked tiers, just far
fewer of them.

### 2. Prize structure
Prize scales steeply by tier, so tier ACCESS — not win rate within a tier — is
the dominant income lever. No single match may dominate a season (see I3).

### 3. Costs
Wages scale with player rating (already correct: monthly figure, weekly drip at
salary ÷ 4.333). Staff and facilities scale with ambition. Costs must rise as you
climb, but slower than income does (see I5).

#### The wage curve — flattened above $100k (shipped, and it does NOT fix I1)

Measured across the shipped roster, price and capability scale at wildly
different rates:

| | cheapest starter | best starter | ratio |
|---|---|---|---|
| asking price | $66,000 | $180,000 | **2.7x** |
| overall rating | 66.2 | 76.3 | **1.15x** |
| expected season income | — | — | **1.39x** |

Price rises 2.7x for a 15% capability gain, while income rises 1.39x. That is
the I1 inversion in one line: the best squad grosses most and nets least.

`utils/wageCurve.ts` flattens the top end — asking price below a $100k knee is
untouched, above it each dollar contributes 40c of wage. Elite players stay the
most expensive; they stop costing multiples of what they return.

**It fixes the elite pathology and does not fix I1.** Sweeping the compression
from 1.0 (old linear curve) to 0.0 (total flattening), by season-2 net:

| compression | cheapest | lower-mid | upper-mid | best | I1 monotonic |
|---|---|---|---|---|---|
| 1.00 (before) | $127,949 | $92,593 | $105,565 | **$62,105** | FAIL |
| 0.40 (shipped) | $127,949 | $94,993 | $136,765 | **$158,105** | FAIL |
| 0.00 (maximum) | $127,949 | $96,601 | $157,573 | **$222,113** | FAIL |

What it bought: the best squad went from netting the **least** of the four to
netting the **most** of the top three ($62k → $158k). Real, and worth keeping.

Why it cannot finish the job: **the surviving inversion is between `cheapest`
($127,949) and `lower-mid` ($96,601) — both below the $100k knee, where the
curve never applies.** Flattening the top end is structurally incapable of
reaching it. At compression 0.00 the top three converge and rise monotonically
among themselves and `cheapest` still beats `lower-mid`. Income is computed
independently of wages, so cost is the only lever this change has, and it has
no reach below the knee.

The sub-knee inversion is a *prize* problem, not a wage problem: a $66k player
and a $102k player differ 55% in price and ~3.5 rating points, which buys ~14%
more income. Closing that is prize scaling — deliberately **not** done here,
because I3 is already 35% against a 15% target (the single World Final is 35%
of season prize money). **I1 is deferred to Phase 3.**

#### 2.5 — I1 and I5 measured under gating (PROVISIONAL, superseded by Phase 3)

First measurement with tier gating and the wage curve both live. The model now
walks the schedule **in order**, accruing ranking points and re-checking
eligibility per event, because under gating what a club may enter depends on
what it has already won. Averaged over 200 seasons per squad.

| squad | rating | tier | pts | entered | wages | **net** | return |
|---|---|---|---|---|---|---|---|
| cheapest | 66.2 | Silver | 22.7 | 35 | $132,000 | $105,515 | 1.80x |
| lower-mid | 69.7 | Silver | 28.3 | 37 | $201,600 | $108,190 | 1.54x |
| upper-mid | 72.2 | Silver | 31.7 | 38 | $220,800 | $121,745 | 1.55x |
| best | 76.3 | Silver | 37.1 | 39 | $264,000 | **$163,410** | 1.62x |

**I1 VIOLATED — but narrowly, and the shape has changed.** From `lower-mid`
onward the return multiple now rises monotonically (1.54 → 1.55 → 1.62). The
only remaining inversion is `cheapest` → `lower-mid`, the sub-knee gap the wage
curve cannot reach.

**Worth a decision: net income rises monotonically at every step**
($105,515 → $108,190 → $121,745 → $163,410). I1 is written as a *return
multiple*, and on that measure the cheapest squad wins purely because its
denominator is small — a $132,000 wage bill turning $237,515. If the invariant
is meant to say "a better squad earns a better net result", it already passes.
If it is meant to say "a better squad is more capital-efficient", it fails and
probably always will at the bottom of the market. **Which of those I1 means is
open** — see the decision list.

**I5 VIOLATED — all four squads finish in the same band.** A 66.2-rated squad
and a 76.3-rated one both land in Silver (22.7 vs 37.1 points, threshold 15,
Gold 40). The gate does not separate them, so there is no tier boundary to
measure a delta across. This is a **threshold** question, not a prize question:
Silver 15 / Gold 40 were chosen to make Gold reachable across the arc (I8), and
the same setting makes Silver reachable by everyone in season one.

Both are **provisional and explicitly superseded by the post-Phase-3 sweep**.
I3 is 35% against a 15% target — the single $500,000 World Final is 35% of all
prize money — so that one event dominates every band's income and contaminates
both ratios. Re-measure after Phase 3 rescales the purses.

#### 2.4 — finals qualification: BLOCKED, not built

D5 decided finals qualify as "top 4 by ranking points as of the semi round".
That cannot be implemented, because **there is no field to rank**:

- `competitor_rankings` is only ever written for the player's club.
- World-tour opponents are not entities. `dev.ts` seeds every tour match with
  `awayTeamId: team.id` and `awayTeamName: event.opponent` — the opponent is a
  **string from static data**, with no competitor row, no rating, no results.
- The AI clubs that *do* have simulated results (`continental_pool_teams`) play
  **regional leagues**, which have no tier and never touch ranking points. The
  player is not in them and they are not on the world tour.

So a "top 4" would be a field of one, and the gate would pass unconditionally
while appearing to work — the silent-success pattern this project exists to
remove. Deciding where AI ranking points come from is a modelling decision, not
a mechanical one. Not built. See the decision list.

`bracketBlockReason` already enforces the half of the bracket that IS
well-defined: the World Final requires the World Semi Final to have been played
and won.

#### Phase 3 — purses re-scaled and the purse SPLIT (DONE, measured 2026-09-01)

Two changes. Only the first was in the original scope; the second turned out to
be the one that mattered.

**1. Purses re-scaled by tier.** Per-tier multipliers preserve the intra-tier
variation (a $5,000 Bronze stop still costs less than a $9,000 one) while moving
each tier's level. The two showpiece events were set to absolute values, because
being absolute outliers was their entire problem.

| tier | n | was | now | per-event | share |
|---|---|---|---|---|---|
| Gold | 14 | $348,000 | $712,500 | $45,000-$59,500 | 44.1% |
| Silver | 16 | $215,000 | $366,000 | $18,500-$30,500 | 22.7% |
| Bronze | 30 | $217,000 | $231,500 | $5,000-$9,000 | 14.3% |
| World Final | 1 | $500,000 | $190,000 | $190,000 | 11.8% |
| World Semi Final | 1 | $150,000 | $115,000 | $115,000 | 7.1% |
| **total** | 62 | $1,430,000 | $1,615,000 | | |

Per-event means now run Bronze $7,717 -> Silver $22,875 (3.0x) -> Gold $50,893
(6.6x Bronze). That is the "scales steeply by tier" the section above asks for,
and it is what makes tier access worth having once the gate separates clubs.

**2. The purse is no longer winner-takes-all.** 70% winner / 30% runner-up, in
`utils/prizeDistribution.ts`, imported by both the server and the harness so the
two cannot drift.

This was not in the phase's stated scope and is the change that fixed I4. The
old payout was `prizeEarned = won ? purse : 0`, which made every event an
all-or-nothing coin flip. **No amount of re-pricing can fix that** — the spread
is a property of the payout SHAPE, not of the numbers being paid. Re-scaling
alone moved I4 from 41.5% to roughly 30%; the split took it to 7.6%.

It is also what the section above already asked for: "tier ACCESS - not win rate
within a tier - is the dominant income lever." Winner-takes-all made win rate the
dominant lever, which is the opposite of the stated design.

**Results.**

| invariant | before | after | target | verdict |
|---|---|---|---|---|
| I3 no single-match lottery | 35.0% | **11.8%** | <= 15% | **WITHIN** |
| I4 predictability | 41.5% | **7.6%** | <= 25% | **WITHIN** |
| I1 monotonic return | 2.06 -> 1.63x | 2.05 -> 1.35x | rising | still VIOLATED |
| I5 climbing pays | all Silver | all Silver | separation | still VIOLATED |

I4's five runs of the same schedule now read $731,700 / $745,700 / $836,700 /
$773,700 / $846,500 against a mean of $786,860. The old spread was $380,500 to
$896,500.

**I1 got slightly worse, and that was expected.** Paying the loser compresses the
income gap between a strong squad and a weak one: income per event goes from
`purse * w` to `purse * (0.30 + 0.40 * w)`, so a squad winning 70% against one
winning 55% earns 1.27x as much before the change and 1.12x after. The split was
set at 70/30 rather than 65/35 for exactly this reason — both land I4 with room
to spare, so the shallower runner-up share is chosen because it gives back the
most win-rate separation for the least cost to predictability.

**What I1 actually needs, stated precisely.** It is not a prize problem any more.
Income already rises with squad quality; wages simply rise faster:

| | cheapest | best | ratio |
|---|---|---|---|
| season wages | $132,000 | $264,000 | **2.00x** |
| season income | $270,602 | $356,928 | **1.32x** |

The design's lever for closing that is tier access, and it is not firing: all
four test squads finish in the SAME band, so every squad enters the same events
and the steep per-tier pricing above never gets to separate them.

The gap is small and specific. **The best squad ends the season on 38.3 ranking
points against a Gold threshold of 40** — it misses the band it is supposed to
reach by 1.7 points. That is a Phase 2 threshold setting, not a Phase 3 prize
setting, which is why it is not changed here: Silver 15 / Gold 40 were chosen to
pace Gold across the arc (I8), and I8 cannot yet be measured because manager
policies (Phase 4) and start modes (Phase 6) do not exist. Moving the threshold
to chase I1 while the invariant that justifies its current value is unmeasurable
would be tuning against the one number nobody can see.

**Note on the economy's absolute level.** The first re-scale attempt cut the
total purse to $1,267,000 and, combined with the runner-up split, left the best
squad netting $5,064 against a $264,000 wage bill — arithmetically fine, and an
unplayable game. The shipped multipliers are set so nets land at $138,602 /
$98,885 / $95,056 / $92,928 across the four bands, comparable to the pre-Phase-3
baseline. Re-scaling the whole table is share-neutral, so I3 is unaffected by
this correction: 11.8% either way.

#### Is tier access the I1 lever? Tested, and NO (2026-09-01)

Phase 3 left I1 violated and pointed at tier access as the remaining lever. That
was an inference, so it was tested before anything was tuned on the strength of
it. Three findings, in the order they matter.

**1. The harness measures ONE season, and that is the right window anyway.**
`SEASONS = 200` in `harness/invariants.mjs` is 200 INDEPENDENT single seasons
averaged, each starting from zero points — not a five-season career. That looks
like the wrong window for an arc where Gold arrives in season two or three.

It is not, because **ranking resets every season** (settled above). A club climbs
from zero every year, so season three is not a longer runway than season one. The
arc's route to Gold is not accumulated points, it is a better squad: the Phase 1
curve is 75.0 in season one rising to an 89.5 ceiling. The harness's four squads
are drawn from the shipped roster and top out at 76.3, so no amount of extra
seasons would have produced a Gold club. **Extending the harness in time was the
wrong fix; extending it in squad quality was the right one.**

A fifth squad now ships in the sweep: `developed`, the same athletes as `best`
trained to the 89.5 ceiling, on the same wages (a contract does not re-price when
a player improves), measured against season-3 opposition since
`opponentRatingFromTier` adds +2 rating per season and everything else in the
sweep faces season-1 opponents.

**2. It clears Gold on merit — 48.7 points against a threshold of 40.** So the
threshold is reachable and does not need lowering. I5 CLIMBING PAYS now PASSES
for the first time: two bands reached, and income rises with tier
($276,300 / $298,054 / $319,809 / $353,120 / $417,835).

**3. Tier access still does not fix I1.** Two tests:

- **Gold granted to every squad from round one** (all 62 events enterable, all 14
  Gold events played): return still falls, 5.47x -> 3.74x -> 3.52x -> 3.09x.
  Equal access cannot separate squads — obvious in hindsight, and worth having on
  the record.
- **Gold earned, so access is unequal**: separates only the ENDS. The developed
  squad on Gold returns 1.58x against cheapest's 2.09x — so cheapest STILL beats
  it, and beats every squad in between.

The surviving inversion is `cheapest` vs `lower-mid`, and **both sit in Silver
with identical access under every variant tested**. It is a pricing relation, not
a gate:

| | cheapest | lower-mid | change |
|---|---|---|---|
| season wages | $132,000 | $201,600 | **+52.7%** |
| season income | $276,300 | $298,054 | **+7.9%** |

Until a dollar of wage buys more than eight cents of income, no threshold setting
can make I1 monotonic. **Silver 15 / Gold 40 stay as they are.** They are not
what is wrong, and they were set against I8, which is still unmeasurable until
manager policies and start modes land.

**4. A finding that came out of this, and needs its own work: Gold is
unreachable IN TIME.** The `developed` squad clears the gate and still enters
only **0.6 of the 14 Gold events on the card**. Every other squad enters zero.

Because ranking resets annually, a club climbs from zero each season and crosses
40 points late — by which time almost the whole Gold calendar has already been
played. Gold now holds **44.1% of the season's prize money** after the Phase 3
re-scale, so the largest block of money in the game is behind a gate that opens
after the events it guards.

This is a SCHEDULING problem, not a threshold one, and moving the threshold would
paper over it. Options, none of them chosen yet:

- Weight the Gold events later in the calendar so qualification precedes them.
- Raise the ranking points earned per win so 40 arrives sooner in the season.
- Qualify on the PREVIOUS season's final ranking rather than the current one,
  which would give Gold a full season of use — but reintroduces the ratchet the
  reset decision above deliberately rejected.

Recorded rather than fixed. It is Phase 3 scope only because Phase 3 is what
concentrated the money there; the pre-Phase-3 table had the same defect on 24.3%
of the purse instead of 44.1%.

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
  - **Purses: DONE 2026-09-01.** Re-scaled by tier, and the payout changed from
    winner-takes-all to a 70/30 winner/runner-up split. I3 35.0% -> 11.8% and
    I4 41.5% -> 7.6%, both now within target. Full numbers in the Phase 3
    section above. I1 and I5 are untouched by this and remain violated; what
    they need is a tier threshold that separates squads, which is a Phase 2
    setting — the specific gap is 38.3 points against a Gold threshold of 40.
  - **Finals week: NOT BUILT.** The group-stage/semi/final restructure is the
    other half of this phase and has not been started. The schedule still has
    two finals slots (71 semi, 72 final) as `data/worldTour.ts` describes.
    Blocked on the same thing as 2.4: a group stage needs a FIELD to rank, and
    world-tour opponents are still static strings with no competitor rows.
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
| Season end | **BUILT** — `season-review-dialog.tsx` | Record, ranking points, balance, retirements, final table |
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

**Built.** `components/season-review-dialog.tsx`, opened from `calendar-panel`
when an advance crosses a season boundary. A dialog rather than a route: a
season boundary is an event, not a place, and it has to interrupt the
auto-advance ticker rather than wait to be navigated to. Opening it pauses the
clock, or the ticker advances days behind the dialog and the player reads a
review of a season they have already left.

The client no longer derives season-number-to-year itself: `/calendar/advance`
returns `reviewYear`, the year of the season that just ENDED. Duplicating that
mapping in the client is how the two drift. `harness/rollover.mjs` asserts every
rollover carries it, that it names the season that ended rather than the one
starting, and that the year the client is handed actually resolves to a review —
because the rollover returned `seasonRollover` and `careerComplete` for weeks
while the client read neither, and "the rollover happened" is not the same
assertion as "the player can see it".

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
