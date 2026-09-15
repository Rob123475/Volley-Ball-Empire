# R-72 — the week has a rhythm

**Status:** design only (15 Sep 2026). Build after the Steam upload. No code has been written for it.

**Why.** Rob's first play-through of the 0.9.0 installer: no urgency before a match and no reason to
train. Days pass; matches arrive; nothing between them asks for a decision.

**Rob's brief.** A fixed weekly cadence:

| Day | Beat |
|---|---|
| Monday | Results and board mood |
| Wednesday | Training day — a focus the player chooses (fitness / attack / defence / rest), applied only if set |
| Friday | Pre-match brief — opponent form, and a play-or-rest call per player using the R-50 fitness curve |
| Match day | The match |
| Sunday | Roll |

A 7-day strip on the dashboard with the current day lit is the visible clock (this subsumes R-68).
Training must have a real effect on fitness and a small rating drift, with a cost.

---

## 1. What the game does today (measured, 15 Sep)

### The calendar has no week in it

- A season is 78 schedule slots spread evenly across the year: slot *r* falls
  `floor((r − 1) × 364 / 77)` days after 1 January (`routes/calendar.ts` `roundToDate`,
  `data/worldTour.ts`). One slot every ~4.7 days.
  - Slots 1–10: regional period (the AI leagues; the player's club has no match).
  - Slots 11–70: World Tour — 57 events since R-44 (41, 51, 61 are open dates).
  - Slots 71–72: World Finals (27 Nov semi-finals, 2 Dec final).
  - Slots 73–78: holiday.
- The 59 dated match rounds (17 Feb – 2 Dec 2026) fall on **every weekday**: Fri 11, Sun 10, Wed 10,
  Tue 9, Mon 7, Thu 6, Sat 6. Consecutive rounds are 5 days apart 39 times, 4 days apart 16 times,
  9–10 days apart 3 times (the open dates).
- Counted in Monday–Sunday weeks, **41 weeks hold a match round: 23 hold one, 18 hold two.**
- The weekly salary run (wages, staff wages since R-67, sponsor income, weekly injury healing) fires
  every 7 game days from the season's start date — Thursdays in 2026 — unrelated to matches.
- The clock: Pause, Slow (a day every 3 s), Medium (1 s), Fast (0.2 s). The ticker stops for a match
  day. R-68 added a visible tick (the date re-animates each day, a bar fills across the interval, a dot
  pulses).

### Fitness already decides who plays (R-50, `utils/condition.ts`)

- A player contributes `0.6 + 0.4 × fitness / 100` of her six stats (100 → 100%, 50 → 80%, 0 → 60%).
- A match costs the two who played fitness −4 to −7 and fatigue +12 to +18 (more in extreme weather),
  plus an injury roll: 3% base, raised by fatigue and consecutive matches, lowered by facilities.
- Every game day of rest: fitness +2, fatigue −5 (injured +1, −3). Injuries heal a week every 7 game
  days.
- Selection: a stored lineup where its players are available, then starters, interchange, anyone,
  by fitness-scaled rating; fewer than two available forfeits.
- The dashboard's **Next Match** card shows the pair that will play, each one's fitness and "plays at
  N%", who cannot be selected and why, and a forfeit warning.

So the curve Friday's brief needs exists and is on screen; what does not exist is a moment that asks
the player to decide, or a rest call that means anything beyond the automatic pick.

### Training exists, but it is outside the calendar and costs nothing (`routes/training.ts`, `pages/training.tsx`)

- Six programmes:

  | Programme | Primary stat | Secondary | Fatigue | Fitness | Other |
  |---|---|---|---|---|---|
  | Power Camp | power | block | +26 | – | |
  | Agility Camp | speed | defense | +18 | – | |
  | Serving Academy | serve | – | +18 | – | morale +2 |
  | Defensive Systems | defense | stamina | +20 | – | XP ×0.95 |
  | Conditioning | stamina | – | +12 | +10 | XP ×0.85 |
  | Recovery Program | – | – | −30 | +18 | heals an injury week; XP ×0.15 |

- A session earns 25–35 XP × multipliers: age (1.25 at ≤20 … 0.80 at 34+), potential (0.80–1.30),
  programme, an optional assigned coach (rating, speciality, personality), head and assistant coach
  skill, training complex and gymnasium levels, the club's training philosophy, and a youth academy
  ×1.20. The primary stat gains +1 every 100 XP, the secondary +1 every 200 XP.
- Sessions are created for a player or the whole active squad with a **real-world date-time** from a
  form (not the game date), and take effect only when the player presses **Complete**. There is **no
  cost** of any kind, no limit per week, and nothing ties a session to a game day — so a player can
  complete sessions back to back for unlimited stat gains, or ignore training forever with no effect.
  The plan endpoint's "completed this week" counts every session ever completed.
- Academy youth develop separately after every senior match (`utils/academyDevelopment.ts`: weekly XP
  by rating band, and a focus stat — Attack / Defence / Serving / Blocking / Athleticism / Leadership —
  set per youth player).

### Staff and facilities

- **Coaching effects exist only inside training** (the multipliers above). Nothing about staff
  touches a match, selection or recovery. Medical staff: a physiotherapist's skill can tick an extra
  injury week off during a Recovery session.
- **Defect found in R-67, not yet fixed:** training looks for staff roles `head_coach`,
  `assistant_coach`, `fitness_trainer` (and snake_case medical roles), but all 120 seeded staff are
  stored Title Case ("Head Coach"). Only staff the market generates match, so hiring a seeded coach
  does nothing for training.
- Facilities in play: training complex and gymnasium (training XP), psychology centre (training
  morale), medical centre (Recovery), nutrition centre (training fatigue); facilities also scale
  injury risk.

### Board, results and opponents

- The board (R-53): a target finish set at the World Tour draw, a monthly check (projected grade,
  warning, spending freeze), the season review; board confidence 0–100. R-58 put its line on the
  dashboard: "Board expects: top 4 · Currently: 3rd · On track".
- Club News (R-43) lists the club's results, signings, board reviews, honours, Olympics and academy
  intakes, dated on the game clock.
- Opponent data exists and is not shown anywhere as form: every World Tour fixture's result for every
  club in the career's field (`world_tour_fixtures`, R-29), the standings, and each AI club's pair
  and ratings.

---

## 2. The design

### 2.1 The week

The game week runs **Monday to Sunday**. Every week, in season and out, has the same four beats; match
weeks add match days.

| Day | What happens | Player decision |
|---|---|---|
| **Mon** | Results and board mood | none — read it |
| Tue | nothing scheduled (market, staff, contracts as now) | — |
| **Wed** | Training day | the week's focus, if the player sets one |
| Thu | nothing scheduled | — |
| **Fri** | Pre-match brief (match weeks) | play or rest, per player |
| **Sat** | Match day | the match (play / watch / simulate, as now) |
| **Sun** | Match day when the week holds a second round; then the roll | — |

**The calendar decision Rob needs to make.** The World Tour's 57 rounds (plus the two finals) fall in
40–41 weeks, so one match day a week cannot hold them. Options:

- **A — the match weekend (recommended).** Each week holds one or two World Tour rounds: the first on
  Saturday, a second (when the week has one) on Sunday, then the roll. It keeps R-44's 57 rounds,
  the 19-club field and its one-bye-in-19 byes, the purses and ranking points, and roughly today's
  split (about 23 one-round weeks and 17 two-round weeks). Friday's brief covers the weekend; a
  player who plays both days pays both matches' fitness cost with no rest day between, which is
  exactly the decision the brief is for.
- **B — two match days a week (Wed and Sat).** Collides with training day.
- **C — one round a week.** 57 rounds do not fit a 52-week year with a regional period and an
  off-season; it would mean fewer events (R-44's schedule, purses and ranking points redone).

The regional weeks (January to mid-February) and the off-season keep Monday, Wednesday and Sunday
with no match — training matters most there.

Schedule slots become **(week, day)** instead of an evenly spread slot number. The regional league,
World Tour, finals, Olympics (R-61: late November, before the finals) and the season rollover all
move to named days; the weekly salary run moves to **Sunday's roll**.

### 2.2 Monday — results and board mood

A **week report** opens on Monday (the clock pauses for it, as the season review does):

- the weekend's results, from Club News rows that already exist;
- **board mood**: one word and the reason, derived from what R-53/R-58 already compute —
  confidence, the current standing against the target, the projected grade, any warning or freeze.
  For example *Pleased — 3rd against a top-4 target*, *Watching — 6th, below the band*,
  *Concerned — spending frozen*, *Final warning*. No new board rules; a new way of saying the
  existing verdict weekly rather than monthly;
- the week ahead: this weekend's opponent(s), and whether a training focus is set.

### 2.3 Wednesday — training day

The player may set **one team focus for the week** on the dashboard strip or the Training page:
**Fitness**, **Attack**, **Defence** or **Rest**. It applies on Wednesday **only if set**; unset means
no session, no effect, no cost (the brief's "applies only if the player sets it"). The focus carries
to the next week until changed, so it is set once, not every week.

What each focus does, applied on Wednesday to every contracted senior player who is fit to train
(injured players do nothing; academy youth keep their own development):

| Focus | Fitness | Fatigue | Rating drift | Cost |
|---|---|---|---|---|
| **Fitness** | +6, and the next match costs 2 less fitness | +6 | stamina, speed | session fee |
| **Attack** | −2 | +12 | power, serve, block | session fee; +1% injury risk at the next match |
| **Defence** | −2 | +12 | defense, block, speed | session fee; +1% injury risk at the next match |
| **Rest** | +10 | −15 | none | none |

- **Rating drift** is small and earned: each session adds training XP toward the focus stats through
  the existing XP rule (+1 per 100 XP, the same multipliers — age, potential, coaches, training
  complex, gymnasium, philosophy). Tuned so a player on one focus all season gains about 2–4 points
  in its stats. Bounded by the player's potential; no drift without sessions.
- **The cost is real three ways:** fatigue (a heavy week before a match weekend is a trade), injury
  risk carried into the next match, and money — a weekly **training fee** per session, scaled by the
  squad trained and the training facilities, billed in Sunday's roll as its own ledger line.
- **Staff matter:** the head coach's and fitness trainer's skill scale the XP and trim the fatigue, as
  the existing multipliers do — with the role-name defect fixed so the seeded staff count.
- The existing six programmes, the per-session Complete button and real-world scheduling are
  **retired**: Wednesday's focus replaces them. The XP, stat-threshold, age, potential, coach,
  facility and philosophy rules are kept and fed by the focus instead.

### 2.4 Friday — the pre-match brief

In a match week the clock pauses on Friday for the **brief** (the manager can turn this pause off):

- **The opponent(s):** club, ranking, **form** (last five World Tour results from the fixtures
  table), their pair and its conditioned rating, the event's tier and purse.
- **Our squad, per player:** fitness, "plays at N%" (R-50), fatigue, injury risk for this match, and a
  **Play / Rest** call. A recommendation is shown from the R-50 curve (for example, suggest rest below
  60% fitness or above 70 fatigue when an available player is fitter) — the player makes the call.
- **Rest** means she sits out the weekend's match or matches: the pair is picked from the rest by the
  existing selection rule; she takes rest-day recovery instead of the match cost. Resting so that
  fewer than two can play shows the forfeit warning before it is confirmed.
- The calls are stored as the weekend's lineup (the stored lineup R-50's selection already honours)
  and cleared on Sunday.

### 2.5 Match day

As now: the match-day modal, play / watch in 3D / simulate. On a two-round weekend, Saturday's result
and fitness costs are in place before Sunday's match; Friday's calls cover both unless changed on
Saturday night.

### 2.6 Sunday — the roll

After the last match of the week: the salary run (wages, staff wages, training fee, sponsor income),
weekly injury healing, the week's training XP and drift made visible ("Anna: +1 serve"), the season
rollover when it is the last week, and the week counter moves.

### 2.7 The 7-day strip — the visible clock

A strip at the top of the dashboard: seven day chips, **Mon to Sun**, the current day lit and moving
as the clock runs. Each chip carries its beat — report, training, brief, match (with the opponent's
initials), roll — and marks what still wants the player: a Wednesday with no focus set, a Friday brief
not yet opened. Clicking a chip opens that day's screen. The header clock keeps the date and speed
controls; R-68's per-day tick and bar can stay or be dropped once the strip exists.

---

## 3. Exists vs new

| Piece | Exists today | New in R-72 |
|---|---|---|
| Fitness curve, match cost, rest recovery, injuries | yes (R-50) | Friday Rest call feeds it; Fitness/Rest focus adds to recovery |
| Pair selection honouring a stored lineup | yes (R-50) | the brief writes the lineup for the weekend |
| Next Match card (pair, fitness, unavailable) | yes (R-50) | becomes the brief's squad panel |
| Training XP, stat thresholds, age / potential / coach / facility / philosophy multipliers | yes | kept; fed by the weekly focus |
| Training programmes, Complete button, real-world scheduling | yes | retired |
| Training cost | none | weekly training fee, fatigue, injury risk |
| Coach and fitness trainer effect on training | yes, but seeded staff never match (role names) | role-name fix |
| Board target, monthly check, review, confidence, dashboard line | yes (R-53, R-58) | weekly board mood line on Monday |
| Club News results | yes (R-43) | Monday week report reads them |
| Opponent results and standings | yes, not shown as form | Friday form panel |
| Evenly spread slots, matches on any weekday | yes | Mon–Sun weeks, match weekend |
| Salary run every 7 days from 1 Jan | yes | moves to Sunday's roll |
| Visible clock | R-68 tick in the header | 7-day strip on the dashboard |

## 4. What the build must prove (harness plan)

- Every match falls on Saturday or Sunday; every season week has Monday, Wednesday and Sunday beats;
  R-44's 57 rounds, byes and prize totals are unchanged; the finals, Olympics and rollover land on
  named days.
- An unset focus changes nothing; each focus moves fitness, fatigue, drift and cost by the table's
  numbers on Wednesday, for fit seniors only; drift stays within a season target band and never above
  potential; a seeded head coach changes the XP.
- A Friday Rest call keeps the player out of the weekend's matches and gives her rest recovery; a
  resting call that leaves fewer than two warns before the forfeit.
- Sunday bills wages, staff wages and the training fee once; injuries heal once a week.
- The strip lights the current day and marks unset training and unopened briefs.
- Five-season arcs: sacking rates and balances reported against today's table, as every economy
  change has been.

## 5. Open questions for Rob

1. The calendar: **A (match weekend, recommended)**, B or C.
2. Training fee: a flat fee per session, per player, or scaled by facilities — and roughly how much of
   a Bronze club's week it should be.
3. Should Friday's brief pause the clock by default?
4. Should ratings drift down a little without training (a reason to keep training), or only up?
5. Keep R-68's header tick once the strip exists, or drop it?
