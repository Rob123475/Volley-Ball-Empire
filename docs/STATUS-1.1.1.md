# 1.1.1: the Clubs page, the transfer window, perks and the calendar: status

Brief: `docs/UPDATE1-1.1.1-BRIEF.md`. Branch **update-1**, on top of 1.1.0 (`3592767f`, BuildID 25976250). Nothing pushed, nothing uploaded to Steam, `main` and `launch-final` untouched, Rob's save never opened.

*Written as the work goes; the summary at the top is filled in at the end.*

## Summary

| Part | Status | Commit |
|---|---|---|
| 1. The Clubs page | done | `59481c47` |
| 2. The transfer window | done | `f2da0bec` (code, Parts 2-4), suite in the same commit |
| 3. One chance to keep her | done | `7e2cbec0`, `1c5ceb14` |
| 4. Perks | done | `00e9a2b0` |
| 5. AI clubs' youths | done | `78bfcf23` |
| 6. The calendar | done | `97deef35` |
| 7. Words | done | (Part 7 commit) |
| 8. Tests | | |
| 9. Full build, soak, 1.1.1 | | |

## Decisions made

**Clubs page (Part 1)**
- "Ladder position" is the World Tour rank, for clubs in this season's World Tour field. Every AI club also shows its regional league position, from the latest regional season with results; a league's `season_year` is a season number, not the calendar year.
- "Most successful" sorts by World Tour position, then World Tour points, then regional position.
- The player's club takes its continent from its club template. His row opens his own Club page.
- An AI club's staff skill is shown plainly. They are not market staff, so there is no "?".
- An AI club's seniors are shown on their Player Market cards, with Watch, Scout and Buy through the market's own routes. The Watch List already had the Sort menu.

**Transfer window, buying ahead, no dumping (Part 2)**
- The window is the calendar's Off-Season: the holiday slots, **7 to 31 December**. It has no separate number, so the calendar and the rule always agree.
- A player bought ahead arrives when the window opens. If her contract ends sooner, she arrives the day after it ends, even outside the window: she is free then.
- A contract that starts in the window runs from 1 January of the next season, so a 1-season deal is a full season.
- A bid skips the squad-size check. The window is open on her arrival, so room can be made then. If his squad is still full, she joins as an extra interchange.
- An AI club holding the player answers a bid at once. A bid from a club no one runs is agreed straight away.
- The fee is paid when the deal is agreed, and paid back if the move falls through before she arrives.
- **The injured-list clash.** Cover signed for an injured player can be released at any time once the covered player is fit. This applies to his club and to the AI clubs; outside the window, an AI club releases only cover. An AI club over its places trims in the window.
- The 6-month rule and the free first-week release are deleted. The old AI "sold at once" path (`aiClubSoldTx`) is replaced by bids.
- AI clubs bid for AI seniors and for his seniors held 365 days or more (from the contract's start date). Each buyer has one open deal at a time.
- AI bids: her wage x1.15, the bidder's own length for her rating, and perks cheapest first up to 10% of the wage.
- A buy's fee goes in the ledger as `transfer_fee`. A free agent's signing fee stays `signing_fee`.

**One chance to keep her (Part 3)**
- Her mood is the average of her morale term and her club's World Tour form term, so it runs from -1 to +1.
- An AI club counters on the bid's terms, but pays her at most 1.10 x the wage for her rating. It counters only if it can pay 12 months of the extra cost from its balance above its reserve, and the counter fits under its cap.
- If no answer comes by the deadline, the deal is agreed that day and the fee is paid.

**Perks (Part 4)**
- Perks don't change whether a free agent signs. They count when she weighs a bid against a counter, by their pull.
- They are paid weekly with the wages, on their own ledger line (`player_perks`). Finances shows them as "Player perks". They count in the cap with her wage.
- A bought-ahead player's perks start the day she arrives. Until then her old club pays her, with no perk.

**AI clubs' youths (Part 5)**
- **Who negotiates.** The buyer's best Scout on duty negotiates. A club with no Scout is represented by its best Head or Assistant Coach on duty, using their scouting rating. One rule for every club: the AI clubs hire no Scouts, so their coaches do it. The shipped coaches all have scouting 50, so an AI club without a Scout rarely gets a sale.
- **A loan** is always agreed while her age allows one: 6 or 12 months, by the loan market's rules. Any AI youth can be loaned, not only listed reserves: a youth-team player too.
- **A sale** depends on a chance (table below). If her club won't sell, it offers her on loan. Its answer holds for the week: asking again before then gets the same answer. The roll is fixed by the career, the youth, the buyer and the week.
- A youth already on loan can't be asked for until she is back at her own club. A full academy (6) can't take another.
- A bought youth joins the buyer's academy. For his club that means an academy contract (as a youth signed off the market) and the youth team if it has a place. The selling club is paid her youth price ($500 to $2,000 by talent; 10% less at a Negotiator's club). The sale is recorded in `transfer_deals` (squad role `academy`, status `moved`). His fee goes in the ledger as `transfer_fee`.
- **AI clubs buy from each other** in their weekly academy step. Up to 2 clubs a week try, the best negotiators first. A club tries only if it has academy room, money above its reserve ($150,000) and a negotiator above the floor. It goes for the best youth at another AI club who beats its weakest youth-team player by 5. If it is offered only a loan, it takes the loan, provided it has none in already.
- The AI clubs don't ask for his youths. A youth of his is his to list for loan (Team > Youth Loans), as before.

## Constants

All in `lib/db/src/schema/transfers.ts`; the client reads the same file as `@shared/transfers`.

**Perks: monthly cost and pull** (`PERKS`; `PERK_PULL_VALUE`: what she counts a perk as, in extra wage a month)

| Perk | $/month | Pull |
|---|---:|---|
| Phone and internet | 220 | small ($300) |
| Gym membership | 270 | small ($300) |
| New car | 450 | medium ($900) |
| Clothing allowance | 540 | small ($300) |
| Beauty salon | 670 | medium ($900) |
| Family flights home | 900 | medium ($900) |
| Personal media agent | 900 | medium ($900) |
| Private chef | 1,120 | medium ($900) |
| Personal trainer | 1,350 | large ($2,500) |
| Beach house | 3,580 | large ($2,500) |
| **All ten** | **10,000** | |

**Weighing an offer.** An offer's value to her is (wage + her perks' pull) x months, where 6m = 6, 1s = 12 and 2s = 24 (`CONTRACT_MONTHS`).

**The counter-offer** (`COUNTER_OFFER`):

| Constant | Value | Meaning |
|---|---|---|
| `answerDays` | 14 | game days to answer a bid |
| `closeShare` | 0.05 | "close" means the counter is within 5% of the bid's value |
| `moraleWeight` | 0.10 | in a close call, the counter is worth (1 + 0.10 x mood) to her |

Mood runs from -1 to +1. A worked example: the bid is $20,000 a month for 1 season, worth $240,000. The counter is $19,000 for 1 season, worth $228,000. The gap is $12,000, which is 5%, so it's close. A happy player (mood +1) values the counter at $228,000 x 1.1 = $250,800 and stays. An unhappy one (mood -1) values it at $205,200 and goes. A counter more than 5% away is decided on value alone.

**AI bids and counters** (`AI_TRANSFER_TERMS`):

| Constant | Value | Meaning |
|---|---|---|
| `wageRise` | 1.15 | an AI bid offers her wage x1.15 |
| `perkShare` | 0.10 | perks, cheapest first, up to 10% of the wage |
| `counterCeiling` | 1.10 | an AI club counters with at most 1.10 x the wage for her rating |
| `counterMonths` | 12 | and only if it can pay 12 months of the extra cost above its reserve |

**Youth deals** (`YOUTH_DEALS`, `youthSaleChance`):

chance = scout share x position x plans x cash, capped at 0.95.

| Constant | Value | Meaning |
|---|---|---|
| `scoutFloor` | 40 | a negotiator at or below 40: no sale, only a loan |
| `scoutTop`, `scoutTopShare` | 90, 0.8 | the scout share rises evenly from 0 at 40 to 0.8 at 90 |
| `fewFactor` | 0.25 | the seller has no youth spare beyond its youth team of 3 |
| `oneSpareFactor` | 0.5 | one spare (an AI academy is normally 4: three play, one reserve) |
| `manyFactor` | 1.0 | two or more spare |
| `plansFactor` | 0.5 | she plays in its youth team |
| `cashFactor` | 1.5 | its balance is below the AI reserve ($150,000) |
| `maxChance` | 0.95 | |
| `answerDays` | 7 | the answer holds for the week |
| `aiBuysPerWeek` | 2 | AI clubs try this many youth buys a week |

**The table** (she is a reserve, so no plans for her, and her club is not short of cash). "Few" is 3 youths of its own; "many" is 5 or more. The youth-deals suite checks these figures through the server:

| Scout skill | Few youths | Many youths |
|---:|---:|---:|
| 50 | 4% | 16% |
| 70 | 12% | 48% |
| 90 | 20% | 80% |

At the usual AI academy of 4 (one spare), the chances are 8% / 24% / 40%. If she plays in its youth team, halve them; if her club needs cash, raise them by half. A scout at 30 always gets 0%.

## The transfer window (off-season dates)

**7 December to 31 December** each season (the 2026 season: 2026-12-07 to 2026-12-31). These are the calendar's holiday slots 73 to 78, the Off-Season (`utils/calendarSlots.ts`).

## The calendar list

Every dated rule in the game (1.1.0's and 1.1.1's), against the annual calendar (GET /calendar/annual). The new events come from `utils/calendarDatedRules.ts`. The new legend entry is **Transfers (indigo)**; club dates use **Facility / Club (cyan)**; staff contract ends use **Contract Deadline (purple)**. The calendar-rules suite checks each "added" line.

| Dated rule | Date | On the calendar |
|---|---|---|
| Regional & Pool rounds | season slots 1 to the regional end | already there (Regional / Pool) |
| World Tour rounds (his matches) | their slots | already there (World Tour) |
| World Finals (semi-finals, grand final) | finals slots | already there (World Finals) |
| Off-Season | holiday slots 73 to 78 (7 to 31 Dec) | already there (Off-Season) |
| Salary week | every 7 days | already there (Financial) |
| Facility upgrade complete | its round | already there (Facility / Club) |
| His players' contract ends | the contract's end date | already there (Contract Deadline) |
| Olympic Games | Olympic years, after the last World Tour round | already there (Olympics) |
| **Day 1 draft** | 1 Jan of the career's first season | **added** (Facility / Club), draft careers only |
| **AI clubs hire staff** | 8 Jan every season | **added** (Facility / Club) |
| **Reminder: the AI clubs hire on 8 Jan** | 1 Jan (the Dashboard banner runs 1 to 8 Jan) | **added** (Facility / Club) |
| **New season** (ages, the board's review, the academy intake and graduates) | 1 Jan after the first season | **added** (Facility / Club) |
| **Pre-season choice day** | day 7 of his off-season | **added** (Facility / Club). Before his off-season starts it is "expected", from his last scheduled match + 6 days; once it starts, it's the real day |
| **Pre-season camp starts / ends** | the booked camp's dates | **added** (Facility / Club) |
| **Transfer window opens / closes** | 7 Dec / 31 Dec | **added** (Transfers) |
| **A player bought ahead arrives** | the deal's arrival date | **added** (Transfers) |
| **A player sold ahead leaves** | the deal's arrival date | **added** (Transfers) |
| **A bid's answer deadline** | 14 game days after the bid | **added** (Transfers) |
| **A youth loan of his ends** (out or in) | the loan's end date | **added** (Transfers) |
| **His staff's contract ends** | the staff contract's end date | **added** (Contract Deadline) |
| Olympic Qualifier | none | **not added.** The legend has had it, but nothing ever sends it. Olympic qualification (`utils/olympicQualification.ts`) has no date of its own: the top 12 countries on this season's World Tour ranking points qualify, counted when the Games are played. That date is the Olympic Games entry. The legend entry is left as it was. |
| AI clubs' camps, AI-to-AI deals, AI loans | various | **not added.** The calendar is his club's; the Clubs page shows the AI clubs. |
| Manager job window | his off-season | **not added** separately: it opens with his off-season, which is already the Off-Season. |

The annual calendar also read the first season row for a year from any career on the profile. It now reads only this career's seasons.

## Suites (both full builds)

New suites, each run alone:

| Suite | run-all | Checks alone |
|---|---|---|
| clubs-page | 98s | 20/20 |
| transfer-window | 98t | 19/19 |
| counter-offer | 98u | 10/10 |
| perks | 98v | 10/10 |
| youth-deals | 98w | 12/12 (twice) |
| calendar-rules | 98x | 15/15 |

`harness/run-all.mjs` had a syntax error from the Part 1 commit onwards: four suite headers had a real line break inside their strings. It is fixed in the Part 5 commit.

## The soak

## The package proof

## What a 1.1.0 save gets on first load

- `ensureSchema` adds the `transfer_deals` table and the `career_player_state.perks` column (empty). Existing contracts carry no perks.
- No transfer deals exist yet. AI clubs start bidding in their next weekly step, and they buy ahead into the next window.
- His players already under contract stay. Anyone he has held for 365 days or more can draw AI bids, and he answers each within 14 days.
- AI academies and loans carry on. Any AI youth can now be asked for on loan or to buy from the Clubs page.

## Part by part

**Part 1 (the Clubs page).**
- Server: `routes/clubs.ts` (GET /clubs, GET /clubs/:id).
- Client: `pages/clubs.tsx`, routes `/clubs` and `/clubs/:id`, and the "Clubs" nav item between Finances and Career.
- `players.tsx` exports `MarketPlayerCard`, `useMarketActions` and `RevealedSigningDialog`, so an AI club's seniors show on their market cards.

**Parts 2 to 4 (transfers and perks).**
- Schema: `transfer_deals`, and `career_player_state.perks`. The starter DB has the same DDL applied, and `check-starter-db` passes.
- Rules: `utils/transferWindow.ts` and `utils/transfers.ts`.
- POST /contracts makes a bid for a senior under contract.
- GET /transfers, POST /transfers/:id/counter and /let-go.
- The salary cap counts perks and is checked on a date.
- The weekly "Player perks" line, and Finances' "Player perks".
- The Team page has a Transfers tab, the dashboard a bid banner, and the Player Market a "Joining Clubs" tab (in place of "Transfer Available").
- The contract and renewal boxes have the perk picker.
- `/players/transfer-window` is deleted, along with its spec and client.

**Part 5 (AI clubs' youths).**
- `utils/youthDeals.ts`: `negotiatorSkillTx`, `askYouthTx`, `youthDealTx` and `aiYouthBuysWeekTx`.
- GET /youth-deals/:playerId shows the chance, her price and the loan lengths. POST /youth-deals takes a loan or buy request.
- The weekly step runs the AI clubs' youth buys after their academies.
- On the Clubs page, every academy youth card has "Loan or buy", which opens `components/youth-deal-dialog.tsx`.
- POST /contracts' refusal for an AI academy youth now points to the Clubs page.

**Part 6 (the calendar).**
- `utils/calendarDatedRules.ts`; GET /calendar/annual adds its events and reads only this career's seasons.
- Client: the `transfer` type, and the legend's "Transfers" (indigo).

**Part 7 (words).**
- The Rules page has seven new topics: The transfer window, Buying ahead, No dumping, One chance to keep her, Perks, Youth deals and scouts, and The Clubs page. Their numbers come from `@shared/transfers`, so the page and the game agree.
- "Hire your staff and medical in your first week" now says "On 8 January every season (Day 8 of a new career)", which is 1.1.0's rule.
- Patch notes: `docs/UPDATE1-1.1.1-PATCH-NOTES.md`.
- harness/settings.mjs checks for nineteen topics (it checked twelve) and for the 8 January sentence (it looked for the old "On Day 8" sentence). 40/40 alone.
