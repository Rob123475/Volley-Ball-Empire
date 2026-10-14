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


