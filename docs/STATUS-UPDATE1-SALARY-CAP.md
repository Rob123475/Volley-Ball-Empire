# Update 1, item 4: salary cap, Day 1 draft, AI full squads and injuries: status

Brief: `docs/UPDATE1-SALARY-CAP-BRIEF.md` (Rob's decisions C-1 to C-6, 14 Oct 2026), in three parts, 4a, 4b, 4c. Branch `update-1`, on top of item 3 (`5e562b1`). **Not pushed.** Nothing built or run during this item (Rob, 14 Oct): the one full `pnpm run build` at the end of Update 1 runs everything.

## 4a: the salary cap

### Measured before building (the brief's first step), and Rob's decision

Real monthly wages, read-only from a copy of the starter database through the game's own formulas (free agents: `seniorMonthlyWage(asking price, rating)`; AI seniors: `monthlySalaryFor(rating)`):

| | Lowest | Median | Highest | Ratings |
|---|---|---|---|---|
| (a) Free agents on the market (192) | $10,500 | $16,700 | $20,800 | 63-90 |
| (b) AI clubs' seniors (120) | $11,500 | $18,525 | $24,500 | 63-89 |
| (c) 66-rated: AI wage / free agents (5) | $12,278 | $11,500 | $12,000 | |
| (c) 77-rated: AI wage / free agent (1) | $22,067 | $20,600 | | |

`monthlySalaryFor` matched what Rob was told ($12,300 at 66, $22,100 at 77), and the market's medians were within 10% of it. The ends were not: the cheapest 66-rated free agent was 14.6% under, and the top AI senior 10.9% over, because the wage stopped rising at 77 while ratings run to 89-90. Against the brief's $55,000 cap, today's AI pairs all fitted ($23,343-$49,000), but a third senior at the AI median wage would have put 33 of the 60 clubs over. **Stopped 14 Oct (the brief's stop condition).**

**Rob's decision (C, 14 Oct):**
- **The cap is $60,000 a month** (`MONEY.salaryCap.monthlyCap`).
- **Wages keep rising above rating 77: +$1,000 a month per rating point**, in the one place both the AI wage and the market's asking wage get their rise (`playerWageRise` in `lib/db/src/schema/money.ts`, `MONEY.playerWageRiseMonthly.perPointAbove`). A 90 asks $13,000 more than a 77 ($23,000 rise against $10,000).
- **Contracts already signed keep their wage until renewal.**

**The same measurement under the new rise:** free agents $10,500 / $16,700 / $33,800; AI seniors $11,500 / $18,525 / $36,500. Six AI clubs' pairs are already over $60,000 at a new career's start (up to $72,000). Under C-5 they keep their players but cannot add anyone. A third senior at the AI median wage would put 23 of the 60 clubs over (part 4c).

### Commits

| Step | Commit | What |
|---|---|---|
| 0 | `a74be77` | The measurement and Rob's decision; `MONEY.salaryCap`; the wage rise above 77 (`playerWageRise`) |
| 1-4, 6 (player's club) | `35ce688` | `utils/salaryCap.ts`; the cap on signings and on renewals and raises; renewals re-priced; the figures on screen |
| 4-5 (AI clubs) | `78c2af4` | The cap in every AI rule; AI renewals re-priced, or the player released to the market |
| harness | `1f90419` | `harness/salary-cap.mjs` in run-all (98f); the suites whose expectations 4a changes |

### What was done

1. **What counts (C-2 A):** `utils/salaryCap.ts seniorWageBillTx(club)`, the one figure every check and screen reads. It covers the seniors on the club's books: starters, interchange and promoted graduates. It does not count academy youths, youths out on loan, staff or the manager. It works for the player's club (by its teams row) and for an AI club (its squad as `aiSquadsTx` reads it).
2. **The hard cap (C-3 A):** `wageCapRefusal(bill, adding)`. A signing (free agent or transfer), a renewal at a higher wage, or any raise is refused if it takes the senior wages over $60,000. The wording is Rob's: "That takes your wages to $58,400. The cap is $60,000. Free up $3,400 first." The wage checked is the one after the speciality: her asking wage, already 10% lower at a Contracts Expert's club. Places that apply it:
   - `POST /contracts`;
   - `POST /contracts/:id/renew`;
   - the job market's take-over (the interchange it signs must fit).
3. **On screen:**
   - "Senior wages $X of $60,000" (and the room left) on the Team, Finances and Contracts pages.
   - The signing box shows the room left and greys out Confirm, with the server's own words, when the wage would break the cap.
   - The Contracts page shows what each senior asks to renew, and greys out Renew, with the reason, when it won't fit.
   - The figures come from `GET /contracts/wage-cap` and `GET /contracts` (`renewal`), so nothing is shown as fitting and then refused.
4. **Renewals (C-4):** a senior asks the wage for her current rating, `monthlySalaryFor` (the one rating-to-wage function, the AI clubs' rule), less 10% for a Contracts Expert. She refuses less (rule B). A renewal at a higher wage that breaks the cap is refused. For an AI club (`keepAiSquadsTx`), the renewal re-prices her too: if the new wage fits under the club's cap she renews, and if not the club lets her go and she joins the market asking that wage. AI renewals used to keep the same wage for ever.
5. **AI clubs obey the cap everywhere:**
   - `aiTransfersWeekTx` only buys a player who fits;
   - `bestAffordableFreeAgent` now means affordable and fits under the cap. It is still the one picker; `keepAiSquadsTx` and its last-resort cheapest signing use it;
   - `canSellTx` counts the wage leaving with the player;
   - `renewExpiredPoolContractsTx` re-prices, and renews only if the new wage fits.
6. **Already over the cap (C-5):** nobody is forced out. A club over the cap keeps its players, and every addition is refused until it is back under. A renewal at no more than her wage is still allowed. A youth promoted into the seniors is never blocked: she counts.

### What did not match the brief, and choices made

1. **Wages and the cap.** Stopped 14 Oct (above); Rob set the cap at $60,000 and the rise above 77.
2. **"The wage for her CURRENT rating" at renewal.** The game has one rating-to-wage function, `monthlySalaryFor` (the AI clubs' signing and renewal wage, and the figures Rob was told). A free agent's asking wage is worked out differently, from her fixed asking price plus the rise for her rating. Renewals use `monthlySalaryFor` for both the player's club and the AI clubs, so a player signed off the market can ask a little more at renewal than she signed for (about 5-15% at the same rating). See question 1.
3. **R-52 (the spending freeze) still meets only a raise.** Because a renewal now asks the wage for her rating, a frozen club can renew a senior only if her ask is no more than her current wage. Its message now reads "A renewal at no more than her current wage is still allowed." See question 2.
4. **The pool-contract renewal** (`renewExpiredPoolContractsTx`) only renews anything before a career's first week, because every pool player becomes a career senior then. It re-prices too. If the new wage doesn't fit, it leaves her deal expired, and the career-senior renewal releases her to the market.
5. **The automatic starting squad.** Today's Established squad (the three strongest free agents) costs $88,400 a month, well over the cap. Part 4b replaces it with the Day 1 draft.
6. **Existing careers:** free agents keep the asking wage they had when the career was made. The rise above 77 reaches a free agent in a new career, and every player at her next signing or renewal. See question 3.
7. **Not run** (Rob's instruction): `salary-cap.mjs` and the updated suites (contract-renewal, player-market, transfer-fee, manager-faces, money-pass) run in the end build. ai-club-economy, starting-squad-release and rollover read the wages from the database, so their sums follow the re-pricing. They may still move at the end build (starting-squad-release mostly from 4b).

### Questions for Rob (4a)

1. Renewal wage: `monthlySalaryFor(rating now)` for everyone (as built), or for the player's seniors the market's asking wage at her rating now?
2. Under a spending freeze, a senior whose renewal ask is above her wage can't be renewed (it is a raise). Is that what you want, or should a frozen club renew at her current wage whatever she asks?
3. In an existing career, should the free agents' asking wages be re-priced once to the new rise (a boot pass), or left until each signs?


## 4b: the Day 1 draft

### Commits

| Step | Commit | What |
|---|---|---|
| 1-4 | `ca12e48` | The automatic starting squad deleted; the Day 1 draft (server, routes, screen) |
| harness | `7aaa9a1` | Every suite's career goes through `startCareer` (harness-club.mjs), which drafts |
| harness | `dea0bd8` | `harness/day1-draft.mjs` in run-all (98g) |

### What was done

1. **The automatic starting squad is gone.** `utils/seedStartingSquad.ts` is deleted: the Underdog weakest-three and Established strongest-three picks. `oneSeasonContract` moved to `utils/contractTerms.ts`. Underdog and Established keep their starting budgets.
2. **The draft screen, Day 1** (`pages/day1-draft.tsx`, `routes/day1-draft.ts`, `utils/day1Draft.ts`):
   - A new career opens with `career_saves.day1_draft = "open"`. The AI clubs' players are made career seniors (as the first week does), so every senior in the world can be signed one way.
   - The screen lists every senior: the free agents and every AI club's seniors, filterable.
   - Each card shows her rating, nationality, age, AI club (or free agent) and monthly wage, after a Contracts Expert's -10%.
   - "Senior wages $X of $60,000" runs at the top. A card that would break the cap can't be picked and says why, in the server's words.
   - He picks 2 or 3 (2 to play, an optional interchange) and chooses each one's length (6m / 1s / 2s).
   - Each pick signs through `POST /contracts` itself. While the draft is open there is no transfer fee and no confirm step, the AI club is not paid, and the cap holds.
   - A pick taken back is a release, which is free: the picks are the starting squad, so Rob's 28 Sep week-1 rule applies.
   - The calendar refuses to play a day while the draft is open, and the main layout sends an open draft to the screen.
3. **Then the AI clubs fill (Day 2):** `POST /day1-draft/finish` needs 2 or 3 seniors. Each AI club keeps the seniors he didn't take, and every club with a gap fills it from what is left by 4a's rule (`keepAiSquadsTx`: the best free agent who fits under its cap and that it can afford). Clubs go in random order: `keepAiSquadsTx` gained an optional random club order, used only here. The AI managers' faces are dealt then, after the draft. The staff are seeded with the career as before; nothing about them is dealt to AI clubs.
4. **A career made before the draft** (`day1_draft` null) never sees it.

### What did not match the brief, and choices made

1. **"Every AI club ends with at least 2 seniors and is under the cap" can't hold for every club.** With the rise above 77, six AI clubs start a career over $60,000 with their own pair, and C-5 says they keep them. The suite checks that every AI club is under the cap, unless it has added nobody (and every club has at least 2).
2. **The job market's take-over** used the deleted weakest-three picks for a club of fewer than two. It now fills each gap up to three with the best free agent who fits under the cap (4a's rule).
3. **The starting squad's free week-1 release (Rob, 28 Sep) is kept:** draft picks are marked as the starting squad. That is also how a pick is taken back on the screen.
4. **The harness drafts for every suite.** About 85 suites create careers and play matches, so all of them now start through `harness-club.mjs startCareer`. It picks three free agents (never an AI club's player, so the AI world a suite measures is unchanged): for Established the strongest that fit with $15,000 to spare, for Underdog the weakest. That Established squad (rated 80, 67, 66; $44,800) is weaker than the old automatic one (90, 89, 80; $88,400, over the cap). A suite that relied on that strength may move at the end build. `day1-draft.mjs` drives the draft itself.
5. **Not run** (Rob's instruction): `day1-draft.mjs`, the converted suites, and starting-contracts (it now checks `day1Draft.ts` for literal dates) run in the end build.

### Questions for Rob (4b)

1. Should a pick taken back from an AI club go back to that club, rather than to the free agents? (It goes to the free agents, and her club may sign her again when it fills.)
2. Is it right that the draft picks keep the starting squad's free first-week release?

## Rob's answers, 14 Oct, and what changed (commit `da16974`)

**4a:**
1. Renewal wage: as built (`monthlySalaryFor` at her rating now, for every club).
2. The freeze: as built (a frozen club renews at no more than her current wage).
3. **Existing careers' free agents are re-priced once, at boot** (`utils/freeAgentWages.ts repriceFreeAgentsOnce`). Each free agent asks what a new career's market asks: `seniorMonthlyWage` on her asking price, the rise above 77 included, or `monthlySalaryFor` if she has no asking price. It runs once per career (`career_saves.free_agent_wage_pass_at`; a new career is marked "new career"). Contracts keep their wage until renewal.

**4b:**
1. **A pick taken back from an AI club goes back to that club**, on the wage she was on there (`undoDraftPickTx`).
2. **The free first-week release is deleted.** It was for the old automatic squad: `STARTING_SQUAD` and `releasePayout` are gone, and Release and Terminate pay out the rest of the contract. Taking a pick back while the draft is open stays, as a free undo. After Day 1 the normal rules apply. `contracts.origin` is no longer written or read; it is kept so no save needs a column migration. `starting-squad-release.mjs` is deleted, and its remaining checks are in `day1-draft.mjs`.
3. **The pasted change (Day 1 / Day 2), built:**
   - The draft screen is not forced: it is a page in the game.
   - The Dashboard shows a warning with a button to it.
   - The calendar won't move on from Day 1 until he has 2 or 3 seniors.
   - Playing on closes the draft (Day 2): the AI clubs fill from what is left, and the faces are dealt. The Finish step is tied in, not removed: `POST /day1-draft/finish` closes it without playing a day, which the harness uses so no suite's dates move.
   - The staff market from the draft screen (from the first message) is dropped, as the pasted change said.

**What staff a new career starts with today:** none. Every staff member is seeded with the career on the market, unhired. The game has **120 staff and medical, 10 in each of 12 roles**:
- coaching: Head Coach, Assistant Coach;
- medical: Doctor, Physiotherapist, Massage Therapist, Medical Specialist;
- others: Fitness Trainer, Strength Coach, Sports Scientist, Nutritionist, Promotional Manager, Scout.

**Day 8 AI staff: NOT built. The brief's count stops it.** Each of 60 AI clubs needs at least one coach (Head Coach or Assistant Coach) and one medical. There are 20 coaches for 60 clubs, before leaving any for Rob. Medical is fine (40 of the four medical roles), and 120 staff in all would just cover 60 × 2 with nothing left over. Rob's correction (the AI staff will give their bonuses later through the same shared rules; wages from the club's finances, never the salary cap) is noted for when this is built. Options:
- **A.** Add more coaches to the game.
- **B.** Count Fitness Trainer and Strength Coach as coaching too, which gives 40.
- **C.** Deal staff to some AI clubs only.
- **D.** Something else.

**4c:** a full AI club may buy a player at least `AI_BUY_GAP` better than its weakest senior, by releasing its weakest to the market (the cap still applies). Recorded; built in 4c. **4c is stopped:** the injury-length question (no injury in the game lasts 3 months, so the 50% wage tier and the long-injury release can't happen) still needs Rob's answer (A, B or C).


## Overnight 14–15 Oct: the two stops answered, and 4c built (docs/UPDATE1-OVERNIGHT-BRIEF.md parts 1–2)

**Day 8 AI staff (stop 1):** built on the brief's second path (new staff would need new portraits):
the deal takes only what is spare and leaves 5 of every role on the market. Today 10 clubs get a
coach and 20 a medical member; the rest fill one coach and one medical member at a time as
contracts end. Details and the portraits Rob would need in docs/STATUS-UPDATE1-OVERNIGHT.md (part 1a).

**Injury length (stop 2):** `MONEY.salaryCap.injuredLongWeeks = 4` (was `injuredLongMonths = 3`).

**4c, as built (not yet run):**
1. **Three seniors.** First, the count: the world has 312 seniors (120 AI originals + 192), so 60 clubs ×
   3 + the player's 3 = 183 leaves about 129 free agents. `keepAiSquadsTx` refills to `AI_MAX_SQUAD`
   (3). The first two come by any means as before (a free agent it can afford and fit, its academy's
   best youth, or the cheapest who fits, on credit); the third only if it can afford her (three months'
   wage) and fit her under the cap. So a club the cap or the bank stops holds 2 (about 17 clubs at the
   start, the 4a measurement).
2. **AI injuries.** One roll, `matchInjuryRoll` (utils/condition.ts), for the player's pair
   (routes/matches.ts) and the AI pairs (utils/aiSquads.ts `aiMatchInjuriesTx`): same base risk, the
   event's weather (World Tour; a regional match has none), and the AI manager's Fitness Guru ×0.8
   (switched on: `AI_CLUB_SPECIALITIES` now includes Fitness Guru). It runs after every AI-vs-AI World Tour
   match, every regional match, and for the AI club the player has just played (not after a walkover).
   condition.ts lets injuries run without fitness and fatigue (the roll takes fatigue 0 and no run of
   matches), so **fitness and fatigue stay off for AI players**. Healing: one function for everyone,
   `injuryRecoveryWeekTx`, every 7 game days: the player's club (as before), every AI club (with its own
   medics, no Medical Centre), and **the free agents** (no medic; before this a hurt free agent never
   healed).
   - **squad-forfeit, what the player's club does with fewer than two available:** it forfeits the match
     (R-48). So an AI club plays its best two available; with fewer than two fit it has no match rating
     (`aiMatchRatingsTx`) and forfeits, the walkover the World Tour and regional league already played for
     a club with nobody.
3. **Injured free agents come cheap**, through the one asking-wage path: `askingWage(salary, factor,
   injuryWeeks)` × `injuredWageShare` (50% at 4+ weeks out, 75% under). Only a free agent's weeks are
   passed (`freeAgentInjuryWeeks`), so a player at a club never asks less. The Player Market and the
   signing floor read it; she signs at that wage for the whole contract (the contract's wage is the
   offer). The market card shows the injury, the weeks out and the share.
4. **A long-injured AI senior at renewal** (out 4+ weeks) is not renewed: she goes to the market on the
   wage for her rating, so she asks 50% there.
5. **The AI gamble:** refilling, an AI club may sign an injured free agent (at her injured wage) only if
   it would still have two fit seniors. The on-credit last resort only signs a fit one.
6. **Rob's answer, a full club buys:** a full AI club may buy a fit player at least `AI_BUY_GAP` better
   than its WEAKEST senior and releases its weakest to the market; the cap is checked with her wage gone.
   A club with room still compares with its weaker starter. An AI club never buys an injured player.
- New suite **harness/ai-injuries.mjs** (run-all 98i). manager-faces.mjs's two source checks follow the
  shared roll and the third AI speciality (knowingly changed).

**The soak's money finding (overnight part 10, details in docs/STATUS-UPDATE1-OVERNIGHT.md):** with three
seniors at today's wages (AI seniors average about $21,400 a month), the AI clubs lose about $250,000 a
year more than with two. Over 5 Medium seasons the average AI club's opening balance went $500,000 →
$253,546 → $28,282 → −$116,746 → −$224,976, and most were sold at season 5. Only 5 clubs could still
afford a third senior by then. Also seen: 79 AI originals left their clubs in 5 seasons (released for the
cap, for a long injury, or for a better buy). Rob to decide (suggestions in the overnight report); not
retuned.
