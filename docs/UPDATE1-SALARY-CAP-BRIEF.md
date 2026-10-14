# Update 1, item 4: Salary cap, Day 1 draft, AI full squads and injuries

Branch: **update-1**. Rob's decisions, 14 Oct 2026 (C-1 to C-6, on the "Salary Cap Decisions" page).

This item is done in **three parts: 4a, then 4b, then 4c**, in that order, each fully committed before the next starts. Go straight from one part to the next. Only stop for a stop condition written in this brief (something doesn't match, or a count comes up short), and then report and wait.

## Rules of engagement (all three parts)
- Work on update-1 only. Commit after each step with a clear message. Do NOT push until Rob has done his on-screen check.
- No guessing: read the code before changing it. If something in this brief doesn't match the code, stop and report. Don't invent a workaround.
- Delete dead code you replace. Don't layer new code over old. **One set of rules for every club**: the player's club and the 60 AI clubs go through the same functions (Rob's rule, 23 Sep, utils/clubFinances.ts). No separate "AI version".
- Every number below goes in ONE place, so Rob can tune it: add a `SALARY_CAP` block to lib/db/src/schema/money.ts (MONEY), next to the other money figures.
- Line endings: keep each file's existing line endings (the repo is LF).
- **No builds and no test runs during this item (Rob, 14 Oct).** Write each part's new suite and add it to run-all, but don't run it, or anything else. ONE full `pnpm run build` (which runs the whole harness itself; never run run-all again after it) happens at the end of Update 1, and any failures get fixed then. The "Also affected" lists below are the suites most likely to be affected. Read them, and update any whose expectations this part knowingly changes.
- Report to docs/STATUS-UPDATE1-SALARY-CAP.md. Add a section per part (4a, 4b, 4c).

## The numbers (MONEY.salaryCap)
| Name | Value | Meaning |
|---|---|---|
| monthlyCap | 55_000 | The most a club's SENIOR wages may add up to, per month |
| injuredLongWageShare | 0.5 | What an injured free agent out for longMonths or more asks, as a share of her normal wage |
| injuredShortWageShare | 0.75 | The same, for one out for less than longMonths |
| injuredLongMonths | 3 | Where "long" starts |

---

## Part 4a: The salary cap
**Before you change anything:** measure and report the real monthly wages, the lowest, the median and the highest, for (a) the free agents on the Player Market, (b) the AI clubs' seniors, and (c) a 66-rated and a 77-rated senior. Rob was told about $12,300 (66) to $22,100 (77) from utils/clubFinances.ts monthlySalaryFor. If the market's real figures are more than 10% away from that, stop and report before building.

1. **What counts (C-2 A):** senior wages only, meaning the seniors on the club's books: starters, interchange and promoted graduates. Academy youths, staff, the manager and youths out on loan don't count. Write one function, `seniorWageBill(club)`, that every check below calls.
2. **Hard cap (C-3 A):** any of these is refused if it would take the club's senior wage bill over monthlyCap: signing a player (free agent or transfer), a renewal at a higher wage, and any raise. The refusal says, in plain words: "That takes your wages to $58,400. The cap is $55,000. Free up $3,400 first." The wage checked is the wage after any speciality (a Contracts Expert's −10% counts).
3. **Shown on screen:** the Team page and the Finances page show "Senior wages $X of $55,000". Any screen that offers a signing or renewal shows the room left. The player must never be told a deal fits and then have it refused.
4. **Renewals (C-4):** at renewal a senior asks the wage for her CURRENT rating (rule B from item 2, so a player who has improved asks more). If that breaks the cap, the renewal is refused with the message above. Same for AI clubs: an AI club's renewal re-prices her to her current rating. If it fits under the AI club's cap, she renews. If not, the AI club lets her go and she becomes a free agent on the market. Today AI renewals keep the same wage forever (keepAiSquadsTx, renewExpiredPoolContractsTx). That changes.
5. **AI clubs obey the cap everywhere:** aiTransfersWeekTx (an AI club only buys a player who fits), keepAiSquadsTx and signToAiClub (a club refilling signs the best free agent who fits under its cap AND who it can afford: change bestAffordableFreeAgent, don't add a second picker), and canSellTx.
6. **Already over the cap (C-5, existing careers):** nobody is forced to sell. A club over the cap keeps its players, but can't sign anyone or give a raise until it's back under. That covers Steam players' current careers and AI clubs. A youth promoted into the seniors is never blocked. She counts, and the club then can't add more until it's back under.

**Harness (new suite: harness/salary-cap.mjs):** a signing that fits works and one that doesn't is refused with the right message; the Team and Finances figure matches the sum; a Contracts Expert club gets 10% more room; a renewal re-priced over the cap is refused; an AI club can't buy or refill past the cap; an AI club that can't fit a renewal releases her to the market; a career loaded over the cap keeps everyone but can't sign. Also affected: contract-renewal, player-market, transfer-fee, ai-club-economy, starting-squad-release, manager-faces, rollover.

**Go on to 4b.** Rob's on-screen check at the end of Update 1: the wages figure on Team and Finances, and one refused signing.

---

## Part 4b: The Day 1 draft (C-5 B)
Read utils/seedStartingSquad.ts and the new-career wizard first.

1. **The automatic starting squad goes:** delete seedStartingSquad's automatic picks (Underdog weakest-three, Established strongest-three) and anything that only served them. Underdog and Established keep their starting budgets (lib/db/src/schema/career-difficulty.ts).
2. **The draft screen, Day 1:** after the wizard (club, manager face) and before the first day is played, the player picks his seniors from **every senior in the world**: the free agents AND every AI club's seniors. On Day 1 no club owns anyone yet, so there is no transfer fee, only the wage. Each card shows the player's rating, nationality, age and monthly wage (after a Contracts Expert's −10%). A running "Senior wages $X of $55,000" shows at the top. A pick that would go over the cap can't be made, and the reason shows on the card. He must pick 2 or 3 (2 to play, an optional interchange) to continue, and he chooses each one's contract length (6m / 1s / 2s) as in a normal signing. Sign each through the same path as POST /contracts.
3. **Then the AI clubs fill (Day 2):** each AI club keeps its own seniors that the player did not take. Then every AI club with a gap fills it from what's left, using the 4a rule (the best free agent who fits under its cap and who it can afford). Clubs fill in random order, so the same club isn't always first. The AI managers' faces and the staff are dealt out the same as now, after the draft.
4. **A save made from an old career** never sees the draft. It only runs for a new career.

**Harness (new suite: harness/day1-draft.mjs):** a new career has no automatic squad; the draft list holds every senior in the world; a pick over the cap is refused; the player can take an AI club's star and that club then fills its gap from the free agents; no player ends up at two clubs; every AI club ends with at least 2 seniors and is under the cap; an old save is untouched. Also affected: salary-cap, starting-squad-release, player-market, world-tour-competitors, manager-faces, smoke.

**Go on to 4c.** Rob's on-screen check at the end of Update 1: start a new career, draft a star from an AI club, and see that club's squad afterwards.

---

## Part 4c: AI clubs field a full squad, get injured, and injured players come cheap
Read utils/condition.ts (R-50: injuries, fitness, selection), how the player's matches roll injuries, applyWeeklyInjuryRecovery in routes/calendar.ts, and utils/worldTour.ts (how an AI club's result is worked out) first.

1. **3 seniors:** every AI club holds 3 seniors (2 to play plus an interchange). keepAiSquadsTx refills to 3, not 2. Keep the existing names: AI_MIN_SQUAD stays 2 (the two on the sand), and refilling targets AI_MAX_SQUAD (3). **First, count:** 60 clubs × 3 = 180 AI seniors plus the player's. If there aren't enough seniors in the world to fill every club to 3 and still leave a market, stop and report the counts. Don't create players. AI academies already hold 4 youths (AI_ACADEMY_SIZE), which meets Rob's minimum of 2, so leave them alone.
2. **AI players get injured:** after each AI club's match, its two players get the same injury roll the player's players get (the same function and the same odds, including Fitness Guru's ×0.8 for an AI Fitness Guru manager, which switches on here). Injuries heal a week every 7 game days, exactly like the player's club. An AI club plays its best two AVAILABLE seniors (not injured). If it has fewer than 2 available, it does what the player's club does in that case. Read squad-forfeit first and report what that is. Fitness and fatigue: if condition.ts lets injuries run without fitness and fatigue, leave fitness and fatigue off for AI players. If it doesn't, stop and report.
3. **Injured players come cheap (C-6):** a FREE AGENT who is injured asks a lower wage. Out injuredLongMonths (3) or more: injuredLongWageShare (50%) of her normal wage. Out for less: 75%. She signs at that wage for the whole contract. The Player Market card shows the injury, how long she's out, and the reduced wage. It goes through the one market-price/wage path, not a second one.
4. **How a star reaches the market injured:** when an AI club's senior comes up for renewal while out injuredLongMonths or more, the AI club does not renew her. She goes to the market as a free agent, at the injured wage. The player's own renewals don't change (he decides).
5. AI clubs can take the same gamble: when refilling, an AI club may sign an injured free agent, but only if it would still have 2 fit seniors to play.

**Harness (new suite: harness/ai-injuries.mjs):** every AI club holds 3 seniors after a week; AI players pick up injuries over a season, at about the player's club's rate; injured AI players heal on the same clock and aren't selected while injured; an AI Fitness Guru club's injury rate is lower; a long-injured AI senior at renewal is released, appears on the market at 50% wage, and signs at that wage for the whole contract; a short injury shows 75%; no club exceeds the cap. Also affected: salary-cap, day1-draft, squad-forfeit, ai-club-economy, world-tour-competitors, player-market, rollover, unity-match-state-payload.

**Then stop and report.** Rob's on-screen check at the end of Update 1: play a few weeks, find an injured player on the Player Market, and see her reduced wage.
