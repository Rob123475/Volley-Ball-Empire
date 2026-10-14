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

__4A_BODY__
