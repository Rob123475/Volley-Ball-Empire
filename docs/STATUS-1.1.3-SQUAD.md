# 1.1.3 squad policy brief (26 Oct): status

Brief: `Downloads/SQUAD-POLICY-BRIEF-26OCT.md`. Worktree `C:/vbe-tm`, branch `release-1.1.3`, from fd19538e. Version stays 1.1.3. Unity unchanged (dd0a487). Nothing uploaded to Steam; BuildID 26098080 (1.1.2) stays live.

## Summary

*(written as the work goes; the final summary goes here at the end)*

- **Item A (one squad policy): done.** `utils/aiSquadPolicy.ts` now makes every decision about who an AI club holds:
  - its one renewal;
  - the third place;
  - injured-list cover;
  - deadwood;
  - the age rule;
  - the cap, including arrivals;
  - Day 1's academies;
  - the market;
  - bids;
  - counter-offers.

  The game calls `aiSquadPolicyTx` from six places: Day 1, the weekly block, every game day, an AI club's match injuries, an arrival, and the turn. The scattered versions (eleven functions, 842 lines out of `aiSquads.ts`) are deleted. A new suite (`squad-policy.mjs`, 10/10) proves the policy is the only place that sets squad size, renews, releases or signs cover. It checks the source, and also checks every change to every AI club's seniors on every day of two seasons. The two-senior suites were updated once against the policy; all 12 affected suites pass.

  Proving the benchmarks turned up two holes, both fixed in the policy:
  - in the transfer window, a club with no report coming now signs the best it can fit at once, instead of waiting until every free agent it could afford was gone;
  - a bid still waiting for an answer now counts against the club's cap.

  **Every benchmark is met** in a 10-season soak. The bid bar is now "5 better than its weaker starter": 6 bids on Rob's seniors in 10 seasons (25 Oct: 8).
- **Item B (Malta): done.** Rob's four Malta pictures are installed (malta_01 to malta_04). Maria Caruana and Nicole Borg are on malta_01 and malta_02 (starter DB only). **No two players share a picture, with no exceptions** (324 cards). The installer had a leftover call to a function deleted by the flags work; that line is fixed.
- Item C (skin tones): *pending*
- Part C: *pending*

## Item A: one squad policy

### What is now true

- **One function owns the squad.** `artifacts/api-server/src/utils/aiSquadPolicy.ts` `aiSquadPolicyTx(w, careerSaveId, event)`. Its header lists every rule, in the order they apply. The six events:

  | Event | Called from | What it does |
  |---|---|---|
  | `day1` | `utils/day1Draft.ts`, when the draft closes | Fills the AI academies, then settles every club in random order. |
  | `week` | `routes/calendar.ts`, the weekly block | Deadwood, then contracts (its best renewed early in the window), then market scouting, the window's signings and the bids for his seniors. Then every club is settled. |
  | `day` | `utils/injuredList.ts`, every game day; `utils/transfers.ts` when an AI club's player left that day | Settles every club. |
  | `injury` | `utils/aiSquads.ts` `aiMatchInjuriesTx` | Settles the hurt club, so she is covered the same day. |
  | `arrival` | `utils/transfers.ts` `completeTx` | Settles that club: trim, then the cap on arrival. |
  | `turn` | `utils/seasonRollover.ts` | Settles every club. |

- **Settling a club** runs five rules in a fixed order:
  1. **Contracts.** A contract that ran out is renewed only for the club's best, once a season, and only if it fits the cap with room for three. Any other is released.
  2. **Returns.** A senior fit again comes off the injured list. If places are full, her cover goes.
  3. **Trim.** In the window, or on an arrival.
  4. **The cap on arrival.**
  5. **Places.** One rule for every reason a place is open.
     - **To make two:** the best free agent who fits, keeping room for three where it can. Else an academy youth aged 16+, never blocked by the cap (C-5). Else, on credit, the best of the floor-wage free agents.
     - **The third place:** a free agent under 35 who fits the cap, else a youth who fits. Else it stays on two.
     - **Cover** (a senior on the injured list) is filled from the academy first, then the market. Any other place is filled from the market first.
- **Only the policy's primitives move a player.** `joinTx` (used by `signTx` and `promoteTx`), `releaseTx` and `renewTx` are private to the policy, and they are the only code that changes who an AI club holds. Each records its move in `ai_market_moves`: `sign`, `refill`, `promote`, `leave` or `renew`.
- **The bid bar is an explicit rule** in the policy's header: `AI_BUY_GAP = 5`, measured from the club's **weaker starter**, meaning the second best of its seniors holding a place. The reasoning: a club doesn't pay a transfer fee for an interchange. Until today the bar was measured from its weakest senior, and the cheap third senior that item 4 gives every club dragged that down. So more of Rob's seniors cleared it without being any better. A senior Rob has transfer-listed is wanted at the weaker starter's own level. Rob keeps the counter-offer feature; `aiCounterFor` has moved into the policy.
- **The four fixes are kept:**
  - the podium's skin tones (`nationTones`, still in `aiSquads.ts`);
  - the Club News market headline, with refills counted (`routes/news.ts`, unchanged);
  - the age-35 skip for the market, the third place and cover (making two takes anyone);
  - on credit, the best of the floor-wage free agents.

### A fix found while proving the benchmarks: the window's wait

On the first build, ai-market's count of clubs starting a season on fewer than three ran 1, 1, 2, 0 and then 3, 2, 0, 0 after the first turn. The benchmark is 0. I traced it with a kept save, plus a temporary debug line (since deleted) at the point a club records an open place. It has three causes:

1. **The window's wait (fixed).** Before its last week, a club signs only a player it has a ready report on, or one within `AI_BUY_GAP` of the player she replaces. Otherwise it waits a week. A club whose cap left room only for cheap players kept waiting, and by the last week every free agent it could fit had gone to other clubs. In the trace, the cheapest free agent asked $11,500 on 9 December and $14,049 on 30 December. Example: club 56 signed a $36,500 star on 9 December, keeping room for two at $11,500, and recorded both places `open:cap` on the 30th.

   The rule now (`marketWindowTx`): a club waits a week only for what a week can bring, a scouting report still to come on a player it could fit. With none coming, it signs the best it can fit now.

   I first tried keeping room at a pessimistic "what will be left" wage instead. It held the market back and broke the planted P1 check, so it was deleted.
2. **A third signed injured (the existing rule).** As a third place, a club with two fit may sign an injured free agent at her injured wage (item 4c). Clubs 20 and 22 started 2028 with a third out for 30 and 20 weeks. She counts, but doesn't hold a place until she is fit.
3. **A December signing who retires at the turn.** Her club refills on the next game day. Short-squad club-days stay 0.

After the fix, ai-market counted 17, then 0, 1, 0, 0.

### A second fix: a bid still waiting holds its wage

The next ai-market run failed one check. AI club 19 was over the cap from 7 December 2029, at $61,328. The gamer's senior it had bid for, Camila Santiago, arrived on $28,678 plus $2,150 of perks, beside Yoanna Fuentes on $30,500. With only two, the cap-on-arrival rule could release no one.

The bid gave her $2,150 of perks, which the policy does only with that much room under the cap on her arrival date. So Yoanna joined after the bid. An agreed deal is in the committed bill, which would have refused her. So she was signed while the bid was still "offered".

A bid the gamer leaves unanswered goes through on its answer-by date (14 days, `transfersDayTx` then `agreeTx`), and nothing re-checks the cap at that point. The places rule had signed Yoanna because an offered bid wasn't in the bill it tests. Such a run needs the bid timing and the places rule's daily fill to line up, which is likely why the 25 Oct runs never hit it.

**Fix (in the policy):** `heldBillTx` is the committed bill plus the club's bid still waiting for an answer. Every cap test in the policy now uses it:
- the places rule (free agent, youth, on credit);
- the window's signings;
- the counter-offer;
- `bestAffordableFreeAgent`.

It is in the policy's header beside the cap on arrival.

### Decisions I made (logged for Rob)

- **Places are filled every day, not only weekly.** The same rule runs on the `day` event, so a place opened by a mid-week departure is filled that day instead of at the next weekly block.
- **One minimum age for promotion: 16.** Before, a youth of any age could be promoted to make two. Now it is `PROMOTION_MIN_AGE` (16) everywhere, as the third place and the market already required.
- **`aiCounterFor` moved into the policy.** It decides an AI club's counter. The write itself stays in `transfers.ts` `answerWithCounterTx`, because the counter belongs to the deal. The new suite lists that write and says why.
- **An AI club's seller-left refill** in `transfersDayTx` is now the policy's `day` event, not its own code.

### Proof

- **`harness/squad-policy.mjs` (new, 98zzb in `run-all`): 10/10.** Log: `docs/proof-1.1.3/squad/squad-policy.log`.
  - **Source:**
    - none of the 11 old functions is named anywhere in the server;
    - the policy's moves are recorded only in the policy (the one other record is a youth bid);
    - every write of a player's club or contract anywhere in the server (20 found) is on a list with its reason, and inside the policy only `joinTx`, `releaseTx` and `renewTx` write them;
    - the policy is called from exactly the seven call sites above;
    - the bid bar and the four fixes are there.
  - **Two seasons played:** every change to an AI club's seniors on every day is accounted for, with **none unexplained**:
    - 236 market signings, 20 refills and 7 promotions;
    - 239 releases and 35 renewals;
    - 8 retirements;
    - 1 transfer completed.

    (The first run flagged two departures at the turn. Both were retirements whose state rows are deleted, so the suite now also reads `player_retirements`.)
- **The two-senior suites, updated once against the policy, all on the final build:** ai-market 36/36, ai-injuries 16/16, ai-market-limits 22/22, salary-cap 16/16, new-seniors 31/31, contract-rules 33/33, manager-faces 56/56, ai-buyable 25/25, scouting-history 12/12, injured-list 17/17, day1-draft 27/27. Logs: `docs/proof-1.1.3/squad/`. (`ai-market-first.log` and `soak-10-seasons-first.log` are from the first build, before the two fixes above.)
- **The benchmarks** come from a 10-season soak on the final build (`docs/proof-1.1.3/squad/soak-10-seasons.log`), set beside the 25 Oct soak they come from (`docs/proof-1.1.3/market/item4/soak-10-seasons.log`) and this item's first build:

  | Benchmark | Brief | 25 Oct | First build | **Final build** |
  |---|---|---|---|---|
  | Short-squad club-days | 0 | 0 | 0 | **0** every season |
  | AI clubs over the cap that signed anyone | 0 | 0 | 0 | **0** every season |
  | Club-seasons over the cap only through a promoted youth (C-5) | 4 | 3 + 1 | 2 + 1 | **2 + 1 = 3** |
  | Places short after season 1 (clubs on two) | 13 | 13 (pool 167) | 13 (pool 167) | **12** (pool 168) |
  | Then: the continental pool, seasons 2–10 (180 = no club short) | 176–181 | 179, 180, 180, 181, 180, 176, 180, 180, 180 | 180, 180, 180, 180, 180, 175, 180, 182, 180 | **180, 180, 180, 180, 180, 180, 180, 180, 181** |
  | Transfers a season | 104–172 | 124, 159, 120, 172, 104, 148, 110, 139, 111, 140 | 128, 159, 111, 164, 113, 159, 103, 142, 112, 140 | **124, 162, 117, 170, 110, 141, 104, 142, 107, 130** |
  | Players 3+ seasons at one club | at most 1 per club | at most 1 | at most 1 | **at most 1** (clubs with two or more: 0 every season) |
  | Bids on Rob's seniors a season | (report) | 0, 0, 1, 2, 2, 1, 1, 1, 0, 0 (8) | 0, 1, 0, 1, 1, 0, 1, 0, 2, 0 (6) | **0, 0, 0, 2, 1, 1, 2, 0, 0, 0 (6)** |

  **Every benchmark is met on the final build.** The pool is 181 in season 10: one more senior than 60 × 3. The soak counts a senior on the injured list and her cover both.

  **The bid rate under the new bar:** 6 bids on Rob's seniors in 10 seasons. That is 0.6 a season against 0.8 on 25 Oct. (Before item 4 gave every club a cheap third, it was nearly none.) The soak never answers, so each bid took a player. In play Rob counters or lets her go.

  ai-market's count, taken at the instant the season turns, of clubs starting a season on fewer than three seniors holding a place:

  | Build | Season 1 | Then |
  |---|---|---|
  | 25 Oct, the three full runs | 15–16 | 1,1,0,0 / 0,1,0,1 / 1,1,1,1 |
  | First build of this item | 15 | 1,1,2,0 / 3,2,0,0 |
  | Final build, three runs | 15–17 | 0,1,0,0 / 0,0,0,0 / 2,0,0,1 |

  The season-1 count includes three clubs the starter DB puts over the cap with two seniors (C-5) and the suite's planted P3. What is left after season 1 is clubs whose two staying seniors leave less room than the cheapest free agent asks at the turn (the cap rule), or whose third is out injured. None has a short day.

  The 30-season soak in Part C measures all of these over the long run.

### What changed, file by file

- `artifacts/api-server/src/utils/aiSquadPolicy.ts` (**new**): the policy (see above). Beyond the code it gathers, it now has the window's wait rule (`marketWindowTx`) and `heldBillTx` (both above).
- `artifacts/api-server/src/utils/aiSquads.ts` (1,148 → 332 lines). It keeps:
  - the squads and pairs;
  - match ratings;
  - match injuries (which now call the policy's `injury` event);
  - materialising the AI seniors;
  - their training;
  - `nationTones`;
  - `balanceOf` and `addToBalance`.

  **Deleted:** `keepAiSquadsTx`, `aiInjuredListDayTx`, `aiMarketScoutingWeekTx`, `aiMarketWindowTx`, `aiTransfersWeekTx`, `aiDeadwoodTx`, `aiCapOnArrivalTx`, `aiTrimSquadsTx`, `signToAiClub`, `releaseToMarket`, `renewAiSeniorTx`, and their readers (now private to the policy).
- `artifacts/api-server/src/routes/calendar.ts`: the weekly block calls the policy's `week`.
- `artifacts/api-server/src/utils/day1Draft.ts`: Day 1 calls the policy's `day1`.
- `artifacts/api-server/src/utils/injuredList.ts`: the injured list's day calls the policy's `day`.
- `artifacts/api-server/src/utils/seasonRollover.ts`: the turn calls the policy's `turn`.
- `artifacts/api-server/src/utils/transfers.ts`:
  - `completeTx` calls the policy's `arrival`;
  - `transfersDayTx`'s own trim, cap and refill code is gone (it calls `day` when an AI club's player left);
  - `aiCounterFor` has moved to the policy;
  - unused imports removed.
- `artifacts/api-server/src/routes/contracts.ts`: `canSellTx` is now imported from the policy.
- `artifacts/api-server/src/utils/youthDeals.ts`: `AI_BUY_RESERVE` is now imported from the policy.
- Comments only, pointing to the policy: `routes/players.ts`, `utils/aiMarketLimits.ts`, `utils/poolClubFinances.ts`, `utils/retirement.ts`, `utils/youthLoans.ts`.
- `harness/squad-policy.mjs` (**new**), registered in `harness/run-all.mjs` as 98zzb (port 4965).
- Suites repointed at the policy:
  - `ai-injuries` (section 7: the new bar, the trim and the cap on arrival);
  - `ai-market` (the renewal, the week, the signing; P1's "cheaper" is now her wage at signing, not her rating a month later at the turn, which crossed the line on its own once);
  - `ai-market-limits`, `salary-cap` and `manager-faces` (the file read);
  - `contract-rules` (the policy added to the AI sources; the counter's season length);
  - `new-seniors` (the policy's deadwood and the calendar's call);
  - `scouting-history` (the policy also never clears a report);
  - comments in `ai-buyable` and `rollover`.

## Item B: Malta

### What is now true

- **Rob's four Malta pictures are installed** as `public/images/players/new-seniors/europe/malta/malta_01.webp` to `malta_04.webp` (600 × 800 WebP, the installer's own output) and listed in `artifacts/api-server/src/data/new-senior-pictures.json`. The list is now 331 pictures across 74 nations.
- **Malta's two pool players are repointed** (starter DB only) by `scripts/repoint-pool-shared-faces.cjs --write`:
  - EUR_10_P1 Maria Caruana: `player_senior_malta_02.webp` (world-roster Sara Borg's card) → `malta_01.webp`;
  - EUR_10_P2 Nicole Borg: `player_senior_malta_01.webp` (world-roster Yasmin Grech's card) → `malta_02.webp`.

  A second run finds nothing to repoint. `malta_03` and `malta_04` are free for new seniors.
- **No two players share a picture, with no exceptions:** 324 cards, each on one player (the world roster, its spares and the pool; the academy youths' one generic youth card apart, by design).
- **Saves already in play keep their cards.** A pool player's card is filled from the starter DB only where a save has none (25 Oct). A new senior is never given a picture a pool or world-roster player holds (`utils/newSeniors.ts` `usedPicturesTx`).

### How I ran the installer

- **The installer would not run.** `scripts/install-new-senior-cards.mjs` still called `countryFlag()`, which 1.1.3 A2 deleted (bf8104ac changed its import to `flagCode` but not the call). I fixed the one line: a nation folder must now resolve to a flag code.
- **A re-run rebuilds the whole set.** I ran it on Rob's whole "New Senior Cards" folder, writing into a copy of `public/images`.
  - Its picture list is the installed 327 unchanged, plus the four Malta pictures as `malta_01` to `malta_04`. The rest of the list is the same, in the same order.
  - But all 327 existing files come out with different bytes: the same pictures, re-encoded (mean pixel difference 2.5 of 255, at most 5.6).
  - So I took the installer's output for the four Malta files and its list only, and left the 327 shipped pictures, and the tones banded from them, untouched.
- **The brief's names are the starter DB's.** Maria Caruana and Nicole Borg were renamed on 24 Oct. `scripts/portraits/ai-senior-cards.json` still had them as "kept" under their old names. They are now `repointed`, with `cardBefore26Oct` and `nameBefore24Oct`.

### Proof

- `pool-names` 26/26 (`docs/proof-1.1.3/squad/itemB/pool-names.log`):
  - "no two players share a picture, with no exceptions: 324 cards, each on one player";
  - the 24 repointed, each to a new-senior picture of her own nation;
  - Malta's two on Malta pictures of their own;
  - a new save's AI seniors made from the 24 carry them;
  - at the first turn, with every other new-senior picture planted as given (307), no new senior gets a pool or world-roster player's picture.
- `player-pictures` 36/36: the list is 120 players (96 new, 24 repointed, none keeping an old card), each card the starter DB's, every file there.
- `new-seniors` 31/31: the new seniors work with the bigger list.

### What changed, file by file

- `artifacts/beach-volleyball/public/images/players/new-seniors/europe/malta/` (**new**): `malta_01.webp` to `malta_04.webp`.
- `artifacts/api-server/src/data/new-senior-pictures.json`: the four Malta entries.
- `lib/db/volleyball-empire.sqlite` (starter DB): EUR_10_P1 and EUR_10_P2's `image_url`.
- `scripts/install-new-senior-cards.mjs`: `countryFlag(nation) === "🌍"` → `!flagCode(nation)`.
- `scripts/portraits/ai-senior-cards.json`: Malta's two are `repointed`, with their current names.
- `scripts/repoint-pool-shared-faces.cjs`: header count (331 pictures, 74 nations).
- `harness/pool-names.mjs`: no exceptions; Malta's two on Malta pictures; the 22 become 24 throughout.
- `harness/player-pictures.mjs`: 24 repointed, none kept.
- `harness/run-all.mjs`: the banner comment.
