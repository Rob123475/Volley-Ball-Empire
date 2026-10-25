# 1.1.3: the AI market brief (25 Oct)

Branch `release-1.1.3` in `C:/vbe-tm`, from `a0cd6231` (the rebuild's package commit). Unity is unchanged at dd0a487. Version 1.1.3.

## Summary

*(Written last, when Part C is done.)*

## What is now true

| Item | Now | Evidence |
|---|---|---|
| 1 | AI clubs renew one player a season (their best) and replace every other ending contract in the window from the free-agent market, paying her price. A club too poor signs cheaper, then promotes a youth, then records the open place and why. No AI-to-AI bids. | `ai-market.mjs` **35/35** over 5 seasons: every club with a contract ending filled its places each season; at most one renewal a club, always its best on the day (83 renewals checked); every leaver gone by the turn; the A3 limits held; no AI-to-AI bid; no AI club over the cap on any day (C-5 apart: the 6 clubs the starter DB puts over it keep their own and add nobody); planted P1 signed cheaper (replacing a 79: a 73 and a 64), P2 promoted a youth, P3 recorded `open:cap`. `ai-buyable` **10/10 runs, 25/25 each**; the same suite on a0cd6231 (before the market) **fails**: "0 signed from the free agents". Logs: `docs/proof-1.1.3/market/item1/` |

## What I changed, file by file

### Item 1: AI clubs trade on the market

- `artifacts/api-server/src/utils/aiSquads.ts`
  - **The renewal rule** (`keepAiSquadsTx`, and the new `renewAiSeniorTx`): a contract that has run out is renewed only if she is the club's best senior and it has renewed nobody else that season. Every other one is released to the market.
  - **`aiMarketScoutingWeekTx`** (new, every weekly block): a club with places to fill next season scouts one player a week. She is a free agent, or a player whose contract with another AI club ends this season and who isn't that club's best. She must be someone it could fit under its cap next season. It keeps one report more than it has places, inside the A3 limits; the job goes to a Scout or coach (`scouting_jobs`).
  - **`aiMarketWindowTx`** (new, every weekly block in the window): first the club's one renewal (its best, if her contract ends this season), then a signing from the free agents for each place it has to fill. The fallbacks run in Rob's order, with each player leaving released when her place or wage is needed. See "Decisions" for the detail.
  - **`aiTransfersWeekTx`**: runs the two above first. The AI-to-AI bids are gone: `theirs` and the `canSellTx` check on an AI seller are removed. Its bids are now only for Rob's seniors.
  - **`releaseToMarket`** records every AI release as a `leave` row. `bestAffordableFreeAgent`, the turn's cheapest-on-credit signing and the market all skip a player who left that club this season or last.
  - The refills and promotions in `keepAiSquadsTx` and the injured list's cover record `refill` / `promote` rows, so the soak can count every AI signing. `aiTrimSquadsTx` and `aiCapOnArrivalTx` now take the day.
- `artifacts/api-server/src/utils/aiMarketLimits.ts`: the new row kinds (`sign`, `renew`, `leave`, `refill`, `promote`, `open:<why>`). A free agent as a target (`MoveTarget = Club | null`) counts toward the season totals but toward no club's two. A `sign` row counts with the bids. New `aiRenewalsTx` and `leftClubTx`.
- `artifacts/api-server/src/utils/transfers.ts`: passes the day to the trim and cap-on-arrival steps.
- `artifacts/api-server/src/routes/news.ts` and `artifacts/beach-volleyball/src/pages/dashboard.tsx`: **a Club News item each day the AI clubs sign from the market** ("AI clubs sign 12 free agents", with who went where), so Rob sees the market.
- Harness:
  - `harness/ai-market.mjs` (new, in run-all as 98zza, port 4966): five seasons plus three planted clubs (below).
  - `harness/ai-buyable.mjs`: section 5 now asserts that AI clubs scout the market and make no AI-to-AI bid. Section 6 asserts that in the window every club with a contract ending fills its places, which fails when AI clubs don't trade.
  - `transfer-window.mjs`: "AI clubs bid for each other" → "no AI-to-AI bid".
  - `ai-market-limits.mjs`: signings count with the bids; senior bids are only for his players.
  - `salary-cap.mjs`: the renewal subjects are now each club's best; a source check moves to the route that still uses `canSellTx`.
  - `manager-faces.mjs`: the market price takes no speciality.
  - `ai-injuries.mjs`: the new signatures.
  - `long-career-update1.mjs`: the market lines.
  - I found the suites to change with a script that tests every harness regex against the committed and the working copy of each changed file. Its only other hit is ai-market's deliberate "must not match".

## Decisions I made

**Item 1 (the market):**

- **"Its best" is the club's best senior by overall rating, of everyone in its squad**, not the best of the ones whose contracts are ending. If the best's contract isn't ending, the club renews nobody. That is the plain reading of "its best by overall", and it is what keeps long stays to about one a club.
- **The one renewal is counted per season**, in the season the contract ends (a renewal at the turn is dated 31 December). It is kept as a `renew` row in the save's `ai_market_moves` table, so a reload can't reset it.
- **Replacements are signed in the transfer window (7–31 December).** That is still inside the season the contracts end in. The scouting runs through the year. A signing before the window would put a fourth senior on the books (three is the most), and its contract would end with this season.
- **The player leaving goes the day her place or her wage is needed for her replacement**, weakest first, and never below two seniors holding a place. She goes into the free-agent market there and then, so the other clubs (and Rob) can sign her that window. One whose place isn't needed by the end of the window leaves at the turn. Without this, the good leavers would only reach the market after the window closed.
- **Like for like = within 5 points (AI_BUY_GAP) of the strongest player leaving.** Before the window's last week, a club signs only a player it has a ready report on, or one that good. Otherwise it waits a week for the market to fill. In the last week it takes the best it can afford, else its academy's best youth, else it records the place open with the reason.
- **"Afford" = her price plus three months of her wage in the bank** (the refill's old test, plus her price), and **room under the cap both today and next season**, with room kept for its other places at the cheapest free agents' wages.
- **Her price is the market's** (`marketPrice` for a free agent: one month of her market wage, ±15%), paid from the club's balance like Rob's signing fee. The emergency refills (two on the sand, the interchange, the injured list's cover) keep their old terms, with no price.
- **A signing from the market counts toward the A3 limit of 10 bids a season.** A free agent is at no club, so it counts toward no club's two. The same goes for a scouting report on her.
- **AI clubs no longer bid for each other's players at all** ("no club-to-club negotiation"). **They still bid for Rob's seniors** (his 16 Oct counter-offer feature, which his Team page answers). See "What needs Rob".
- **A club doesn't sign back a player who left it at the end of her contract, that season or the next.** Without this, a club could release a leaver into the market and pick her straight back up: a second renewal by the back door. The first suite run caught exactly that.
- **Rob's C-5 rule stands for the emergency youth promotions** (the injured list's cover, two on the sand): "a youth promoted into the seniors is never blocked". The market itself never uses it: its promotions must fit under the cap.

## What I found and did not fix

## What needs Rob

1. **After you upload and set 1.1.3 live: merge `release-1.1.3` into `update-1`** in `C:\Users\rbonn\Documents\Volley-Ball-Empire` and push (brief item 7; not done, it waits for the upload). Optional: `C:\build\vbe-1.1.3-eb2dc65b\` can be deleted.

## The market numbers

## The commit
