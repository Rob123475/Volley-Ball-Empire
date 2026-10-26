# 1.1.3 squad policy brief (26 Oct): status

Brief: `Downloads/SQUAD-POLICY-BRIEF-26OCT.md`. Worktree `C:/vbe-tm`, branch `release-1.1.3`, from fd19538e. Version stays 1.1.3. Unity unchanged (dd0a487).

**Nothing has been uploaded to Steam; BuildID 26098080 (1.1.2) stays live. Nothing has been merged into `update-1`.**

Rob's live save was hashed, never opened, before and after: SHA-256 `5980b82c…910a4e`, unchanged, last written 16 Oct.

## Summary

All three items are done, and the full harness passed **135 of 135 on its first run**, so Part C needed no fixes and no second run.

- The 30-season soak ran to the end.
- The packaged game shows everything the brief asked for.
- The package is rebuilt at `C:\build\vbe-1.1.3` from **333192f9**.

**A: one squad policy.**
- `utils/aiSquadPolicy.ts` `aiSquadPolicyTx` is now the one place that decides who an AI club holds:
  - its one renewal;
  - the third place;
  - same-day injured-list cover;
  - deadwood;
  - the age rule;
  - the cap, including arrivals;
  - Day 1's academies;
  - the market;
  - its bids;
  - its counter-offers.
- It is called from Day 1, the weekly block, every game day, an AI club's match injuries, an arrival, and the turn.
- The eleven scattered functions are deleted: 842 lines out of `aiSquads.ts`.
- A new suite (`squad-policy`) proves it is the only place that sets squad size, renews, releases or signs cover. It checks the source, and checks every change to every AI club's seniors on every day of two seasons.
- The two-senior suites were updated once against it.
- The bid bar is written into the policy's header: 5 better than the club's weaker starter, because a club doesn't pay a fee for an interchange.
- Proving the benchmarks found two holes, both fixed in the policy:
  - a club in the transfer window waited for scouting reports until every free agent it could afford was gone;
  - a bid waiting for an answer wasn't counted against the cap.
- **Every benchmark is met:** 0 short-squad days, 0 over-cap signers, 3 over-cap club-seasons through promoted youths (benchmark 4), and the pool 180–181 after season 1.

**B: Malta.**
- Rob's four Malta pictures are installed as malta_01 to malta_04.
- Maria Caruana and Nicole Borg are on malta_01 and malta_02 (starter DB only).
- **No two players share a picture, with no exceptions** (324 cards).

**C: skin tones.**
- The 24 repointed players (the 22 plus Malta's two) now have their new picture's band as their tone: 22 changed, starter DB only.
- Their files carry no prompt words, so the 10 Oct name rule couldn't be applied directly. I judged each against the 96's own 10 Oct bands, with a face measurement as tie-break.
- The contact sheet is in the proof folder, and two of them are on the packaged court, drawn Dark (Light before).

**Part C, the 30-season soak:**
- **The AI clubs' pool holds** at 180–181 from season 2 to 30, with 0 short-squad days and 0 over-cap signers.
- At most 1 player per club stays 3+ seasons, every season.
- Bids on Rob's seniors run 0.7 a season.
- **The free-agent market does not hold for ever:** 146 → 223 by season 6, then down to 114 by season 30, about 5 a season at the end. That's new seniors against retirements, not the squad policy, and it gets worse once the new-senior pictures run out in season 22 (see "What I found and did not fix").

**What needs Rob:** the upload, then the merge into `update-1`.

## What is now true

### Item A: one squad policy

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

#### A fix found while proving the benchmarks: the window's wait

On the first build, ai-market's count of clubs starting a season on fewer than three ran 1, 1, 2, 0 and then 3, 2, 0, 0 after the first turn. The benchmark is 0. I traced it with a kept save, plus a temporary debug line (since deleted) at the point a club records an open place. It has three causes:

1. **The window's wait (fixed).** Before its last week, a club signs only a player it has a ready report on, or one within `AI_BUY_GAP` of the player she replaces. Otherwise it waits a week. A club whose cap left room only for cheap players kept waiting, and by the last week every free agent it could fit had gone to other clubs. In the trace, the cheapest free agent asked $11,500 on 9 December and $14,049 on 30 December. Example: club 56 signed a $36,500 star on 9 December, keeping room for two at $11,500, and recorded both places `open:cap` on the 30th.

   The rule now (`marketWindowTx`): a club waits a week only for what a week can bring, a scouting report still to come on a player it could fit. With none coming, it signs the best it can fit now.

   I first tried keeping room at a pessimistic "what will be left" wage instead. It held the market back and broke the planted P1 check, so it was deleted.
2. **A third signed injured (the existing rule).** As a third place, a club with two fit may sign an injured free agent at her injured wage (item 4c). Clubs 20 and 22 started 2028 with a third out for 30 and 20 weeks. She counts, but doesn't hold a place until she is fit.
3. **A December signing who retires at the turn.** Her club refills on the next game day. Short-squad club-days stay 0.

After the fix, ai-market counted 17, then 0, 1, 0, 0.

#### A second fix: a bid still waiting holds its wage

The next ai-market run failed one check. AI club 19 was over the cap from 7 December 2029, at $61,328. The gamer's senior it had bid for, Camila Santiago, arrived on $28,678 plus $2,150 of perks, beside Yoanna Fuentes on $30,500. With only two, the cap-on-arrival rule could release no one.

The bid gave her $2,150 of perks, which the policy does only with that much room under the cap on her arrival date. So Yoanna joined after the bid. An agreed deal is in the committed bill, which would have refused her. So she was signed while the bid was still "offered".

A bid the gamer leaves unanswered goes through on its answer-by date (14 days, `transfersDayTx` then `agreeTx`), and nothing re-checks the cap at that point. The places rule had signed Yoanna because an offered bid wasn't in the bill it tests. Such a run needs the bid timing and the places rule's daily fill to line up, which is likely why the 25 Oct runs never hit it.

**Fix (in the policy):** `heldBillTx` is the committed bill plus the club's bid still waiting for an answer. Every cap test in the policy now uses it:
- the places rule (free agent, youth, on credit);
- the window's signings;
- the counter-offer;
- `bestAffordableFreeAgent`.

It is in the policy's header beside the cap on arrival.

#### Decisions I made (logged for Rob)

- **Places are filled every day, not only weekly.** The same rule runs on the `day` event, so a place opened by a mid-week departure is filled that day instead of at the next weekly block.
- **One minimum age for promotion: 16.** Before, a youth of any age could be promoted to make two. Now it is `PROMOTION_MIN_AGE` (16) everywhere, as the third place and the market already required.
- **`aiCounterFor` moved into the policy.** It decides an AI club's counter. The write itself stays in `transfers.ts` `answerWithCounterTx`, because the counter belongs to the deal. The new suite lists that write and says why.
- **An AI club's seller-left refill** in `transfersDayTx` is now the policy's `day` event, not its own code.

#### Proof

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

### Item B: Malta

- **Rob's four Malta pictures are installed** as `public/images/players/new-seniors/europe/malta/malta_01.webp` to `malta_04.webp` (600 × 800 WebP, the installer's own output) and listed in `artifacts/api-server/src/data/new-senior-pictures.json`. The list is now 331 pictures across 74 nations.
- **Malta's two pool players are repointed** (starter DB only) by `scripts/repoint-pool-shared-faces.cjs --write`:
  - EUR_10_P1 Maria Caruana: `player_senior_malta_02.webp` (world-roster Sara Borg's card) → `malta_01.webp`;
  - EUR_10_P2 Nicole Borg: `player_senior_malta_01.webp` (world-roster Yasmin Grech's card) → `malta_02.webp`.

  A second run finds nothing to repoint. `malta_03` and `malta_04` are free for new seniors.
- **No two players share a picture, with no exceptions:** 324 cards, each on one player (the world roster, its spares and the pool; the academy youths' one generic youth card apart, by design).
- **Saves already in play keep their cards.** A pool player's card is filled from the starter DB only where a save has none (25 Oct). A new senior is never given a picture a pool or world-roster player holds (`utils/newSeniors.ts` `usedPicturesTx`).

#### How I ran the installer

- **The installer would not run.** `scripts/install-new-senior-cards.mjs` still called `countryFlag()`, which 1.1.3 A2 deleted (bf8104ac changed its import to `flagCode` but not the call). I fixed the one line: a nation folder must now resolve to a flag code.
- **A re-run rebuilds the whole set.** I ran it on Rob's whole "New Senior Cards" folder, writing into a copy of `public/images`.
  - Its picture list is the installed 327 unchanged, plus the four Malta pictures as `malta_01` to `malta_04`. The rest of the list is the same, in the same order.
  - But all 327 existing files come out with different bytes: the same pictures, re-encoded (mean pixel difference 2.5 of 255, at most 5.6).
  - So I took the installer's output for the four Malta files and its list only, and left the 327 shipped pictures, and the tones banded from them, untouched.
- **The brief's names are the starter DB's.** Maria Caruana and Nicole Borg were renamed on 24 Oct. `scripts/portraits/ai-senior-cards.json` still had them as "kept" under their old names. They are now `repointed`, with `cardBefore26Oct` and `nameBefore24Oct`.

#### Proof

- `pool-names` 26/26 (`docs/proof-1.1.3/squad/itemB/pool-names.log`):
  - "no two players share a picture, with no exceptions: 324 cards, each on one player";
  - the 24 repointed, each to a new-senior picture of her own nation;
  - Malta's two on Malta pictures of their own;
  - a new save's AI seniors made from the 24 carry them;
  - at the first turn, with every other new-senior picture planted as given (307), no new senior gets a pool or world-roster player's picture.
- `player-pictures` 36/36: the list is 120 players (96 new, 24 repointed, none keeping an old card), each card the starter DB's, every file there.
- `new-seniors` 31/31: the new seniors work with the bigger list.

### Item C: skin tones

- **All 24 repointed players' skin tone is their new picture's band**: the 22 from 25 Oct plus Malta's two, in the starter DB only. 22 changed; Carolina Moreira and Nicole Borg were already Medium. The 3D court draws a pool player, and the career player made from her, with this tone (`continental_pool_players.skin_tone`, 10 Oct).
- **All 120 AI club players' tones are now their pictures' bands.** The 10 Oct tone script (`scripts/src/seed-pool-skin-tones.ts`) takes the band for kind "repointed" as well as "new":
  - its dry run on the starter DB changed exactly these 22;
  - after `--apply`, 22 `skin_tone` cells differ and nothing else in the database;
  - run again, it changes nothing.
- **Saves in play keep their tones.** No boot correction was added (`utils/aiSkinTones.ts` is untouched), and the starter DB only fills a tone a save has none of (R-75).

#### The band of each picture, and how I judged it

The 10 Oct method gave each of the 96 its picture's band (`imageBand`) from the skin words of Rob's prompt in the file name (`prepare-player-cards.py` `band_of`, plus one band set by hand). Rob's new-senior files have no such words, and none is embedded in the PNGs (only "Made with Google AI"):
- the name stops at "…not an illustration_ not anime_ not a (1).png";
- Malta's are `player_senior_malta_01.png`.

So I banded the 24 against the 96 themselves:
1. **Reference faces.** The faces of the 96 at each 10 Oct band (`reference-faces-by-10oct-band.jpg`).
2. **By eye.** Each of the 24's faces compared with them (`faces-24-measured.jpg`, with close-ups of the five full-body shots in `faces-close-ups.jpg`).
3. **A measurement as tie-break.** The face's median skin colour as ITA, the standard skin-tone angle (`measure.py`), used only where my eye fell between two neighbouring bands. On its own it is too rough to decide a band: on the 96 it gets 61 of 96 exactly and 80 within one band (`calibration-on-the-96.txt`). On the 24 it agrees on 11 of the 19 where it found a face, and is within one band on 18.

Each card records this as `imageBandBy`, and its old tone as `skinToneBefore26Oct`.

| Player | Nation | Old tone | New band |
|---|---|---|---|
| AFM_09_P1 Yasmine Mzoughi | Tunisia | Medium Light | Medium Dark |
| AFM_09_P2 Amira Bouazizi | Tunisia | Dark | Medium Dark |
| AFM_10_P1 Rehema Mollel | Tanzania | Light | Dark |
| AFM_10_P2 Upendo Mwakalinga | Tanzania | Light | Medium Dark |
| ASI_09_P1 Tran Thu Trang | Vietnam | Medium Light | Medium |
| ASI_09_P2 Le Ngoc Han | Vietnam | Light | Medium |
| ASI_10_P1 Lin Pei-Shan | Taiwan | Medium Dark | Light |
| ASI_10_P2 Hsu Wan-Ting | Taiwan | Medium Dark | Medium Light |
| AUS_09_P1 Grace Bainivalu | Papua New Guinea | Light | Dark |
| AUS_09_P2 Lahui Kaupa | Papua New Guinea | Light | Dark |
| AUS_10_P1 Ruby Mackenzie | New Zealand | Medium Light | Medium Dark |
| AUS_10_P2 Isla Walker | New Zealand | Light | Medium Dark |
| EUR_09_P1 Carolina Moreira | Portugal | Medium | Medium (unchanged) |
| EUR_09_P2 Niamh Kavanagh | Ireland | Dark | Light |
| EUR_10_P1 Maria Caruana | Malta | Dark | Medium Light |
| EUR_10_P2 Nicole Borg | Malta | Medium | Medium (unchanged) |
| NAM_09_P1 Tanisha Brown | Jamaica | Medium | Medium Dark |
| NAM_09_P2 Keisha Beckford | Jamaica | Light | Dark |
| NAM_10_P1 Shante Bethel | Bahamas | Medium | Medium Dark |
| NAM_10_P2 Tiara Ferguson | Bahamas | Medium | Medium Dark |
| SAM_09_P1 Anjali Persaud | Guyana | Medium Dark | Dark |
| SAM_09_P2 Keziah Campbell | Guyana | Medium Light | Medium Dark |
| SAM_10_P1 Ximena Zeballos | Bolivia | Medium | Medium Dark |
| SAM_10_P2 Daniela Mamani | Bolivia | Medium | Medium Dark |

#### Proof

- **The contact sheet:** `docs/proof-1.1.3/squad/itemC/contact-sheet-24.jpg`. One row per player: her old card, her new card, her old tone, her new tone, and her name and nation. Each swatch is the median skin colour of the 10 Oct pictures in that band.
- **The court, two of them (Part C's packaged proof):** Grace Bainivalu and Lahui Kaupa, the Papua New Guinea pair, moved from Light to Dark.
  - The packaged game's own court loader log reads "Grace Bainivalu | team Maldives Coral Kings (home) | skinTone Dark" and the same for Lahui Kaupa.
  - Screenshots: `docs/proof-1.1.3/squad/part-c/packaged/20-court-two-retoned-players-start.png` and `21-…-play.png`.
  - They play as his pair in a throwaway save (Part C says why).
- **Suites:** `pool-skin-tones` (re-running the script changes nothing; all 120 from pictures; every away pool pair's tone on the court is her stored tone) and `player-pictures` (each of the 24's tone is her new picture's band, in the starter DB). pool-skin-tones 5/5 ("120 of 120 set, 0 changed; 120 from Rob's pictures"; on the court, 108 of 108 away pool players across 54 matches have their stored tone). player-pictures 37/37 ("each of the 24 repointed has her new picture's band as her skin tone, in the starter DB: 24 of 24; 22 changed on 26 Oct").

### Part C

#### 1–2. Typecheck, build, sync, and the full harness

`pnpm run build` on **333192f9**: **ALL HARNESSES PASSED, 135 of 135 suites, first run** (2.5 h). This includes:
- the new `squad policy` (98zzb);
- `ai market`, `pool names`, `player pictures` and `pool skin tones`.

Log: `docs/proof-1.1.3/squad/part-c/full-build-333192f9.log`. With nothing failing, there was nothing to fix and no second run (one of the three allowed was used).

#### 3. The 30-season soak

Run on the build of 243db06e (the server code is the same at 333192f9, whose only further change is the proof scripts): `SEASONS=30 node harness/long-career-update1.mjs`, which reports "SOAK COMPLETE: 30 of 30 seasons".
- Log: `docs/proof-1.1.3/squad/part-c/soak-30-seasons.log`
- The table as JSON: `soak-30-table.json`
- The free agents' inflow and outflow, read from the soak's own save: `soak-30-inflow-outflow.txt`

**Does the pool hold over 30 seasons?**
- **The AI clubs' pool: yes.** It is 180 or 181 every season from season 2 to season 30. Season 1 ends 14 short at 166, because 15 places are left open for the cap, as the starter DB's contracts allow.
- **The free agents: no, not for ever.** They grow from 146 to 223 by season 6, then fall about 3 a season to 175 by season 21, and about 5 a season to 114 by season 30. This is not the squad policy, which only moves players between AI clubs and the market. It's the balance of what enters and leaves the game:
  - **In:** 20 new seniors a season (5 picture players, 15 youths) until season 22. Then the new-senior pictures are used up and the picture players stop (3 in season 22, none after), leaving 15 a season.
  - **Out:** 24–47 retirements a season: 985 in all, 542 of them free agents nobody signed.

  At season 30's rate (about 5 a season), the market would fall below the roughly 110 contracts that end each season around season 30–35. See "What I found and did not fix".

**Every line:**
- **Transfers:** 96–165 a season, nearly all AI clubs signing free agents in the window. Two seasons are just under the 10-season band (104–172): season 7 (96) and season 17 (97). Both are seasons with few contracts ending, as in the 10-season runs (contracts run 1 or 2 seasons, so the count rises and falls in a two-year rhythm).
- **Free agents, start and end of each season:** in the table.
- **Pool size:** 166 in season 1, then 180–181.
- **Players 3+ seasons at one club:** 0–21 in all, at most 1 at any club in every season. No club ever had two or more.
- **Youth promotions:** 241 in 30 seasons, 1–17 a season.
- **Places left open:** 53 in 30 seasons, 15 of them in season 1. Nearly all were for the cap; three were for money and one for the limit.
- **Short-squad club-days:** 0 in every season.
- **Over-cap club-seasons:** 0 AI clubs over the cap that signed anyone. 3 over it only through a promoted youth (C-5, allowed): 2 in season 1 and 1 in season 12.
- **The bid rate on Rob's seniors:** 21 bids in 30 seasons, 0.7 a season. His squad held 2–4 players, 115 player-seasons in all, so that's about one bid a year for every five of his players. The soak never answers a bid, so 20 of his players went; in play he counters or lets her go. On 25 Oct, under the old bar, it was 8 in 10 seasons; before item 4 gave every club a cheap third, it was nearly none.

#### 4. The packaged game

The rebuilt package (`C:\build\vbe-1.1.3\win-unpacked`, from 333192f9) ran on three throwaway saves:
- The saves were made by `scripts/webgl-proof/market-1.1.3-save.mjs` on the same server code, and are kept at `C:\build\vbe-1.1.3-squad-proof-saves`.
- `market-1.1.3-shots.mjs` drove each with its own `--user-data-dir`.
- Rob's AppData saves were fingerprinted before and after: unchanged.

Screenshots and logs: `docs/proof-1.1.3/squad/part-c/packaged/`.

- **A Malta player's card** (`15b-malta-player-card.png`): Maria Caruana on `malta_01.webp` at Dublin Emerald Spikers, the file served and loaded, beside Niamh Kavanagh's repointed Irish card. (Her name is printed down the card one letter a line, so the page's text check reads false; the screenshot shows it.)
- **Two retoned players on the court** (`20-…start.png`, `21-…play.png`): Next match, then Watch Match, on 17 Feb 2027. The court's own loader log draws Grace Bainivalu and Lahui Kaupa as **Dark** (Light before 26 Oct) on his side.

  His club never meets the 12 clubs whose pairs are among the 24: a whole season of the proof career, 118 matches, had none against them. A bid for one was kept by her club's counter-offer. So the save plants the pair as his starters on 2 January, as the suites plant their clubs. Each keeps her pool player link, which is how the court finds a player from an AI club's tone. The court then drew them from its own data.
- **The Job Market's way in and out** (`10`–`14`):
  - in: the Career page's Job Market tab, on 15 June;
  - out: the sidebar back to the Dashboard;
  - the page on its own, whose "← Back" returns to `/career`.
- **AI market activity in the news** (`17`, `18`): Club News on 2 January 2027 shows "AI clubs sign 83 free agents" (10 Dec) and "AI clubs sign 1 free agent" (1 Jan: Salote Fifita to Auckland Pacific Diamonds).
- **Also:** a repointed card (`15`) and the contract box's season sentence (`16`).

Running these found two faults in the 25 Oct proof scripts, which had never run (that brief stopped before its packaged proof), both fixed:
- **The save script's year was 0.** It read the calendar before the first day, so every save would have been taken at the start.
- **Session N didn't open Club News**, which is a collapsible panel. It now clicks the panel's title (`market-1.1.3-shots-N-rerun.json`).

#### 5. Fix what fails

Nothing failed: the first full run passed 135 of 135, the soak completed, and the packaged proof met every check. The only fixes in Part C were to the two 25 Oct proof scripts (above), which aren't part of the game or the harness.

#### 6. The package

- `npx electron-builder --win dir` built `C:\build\vbe-1.1.3\win-unpacked` from 333192f9.
- Its starter DB is byte-identical to the committed one (SHA-1 `6d31dafd…`), and the version is 1.1.3. The after-pack checks pass: starter DB only, no `steam_appid.txt`, steamworks unpacked.
- The 24 Oct package (a0cd6231) is kept at `C:\build\vbe-1.1.3-a0cd6231`, beside the older `vbe-1.1.3-eb2dc65b`.
- The Steam script `steam/app_build_5233750-1.1.3.vdf` now names 333192f9 in its description. It has not been run.

## What changed, file by file

### Item A

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

### Item B

- `artifacts/beach-volleyball/public/images/players/new-seniors/europe/malta/` (**new**): `malta_01.webp` to `malta_04.webp`.
- `artifacts/api-server/src/data/new-senior-pictures.json`: the four Malta entries.
- `lib/db/volleyball-empire.sqlite` (starter DB): EUR_10_P1 and EUR_10_P2's `image_url`.
- `scripts/install-new-senior-cards.mjs`: `countryFlag(nation) === "🌍"` → `!flagCode(nation)`.
- `scripts/portraits/ai-senior-cards.json`: Malta's two are `repointed`, with their current names.
- `scripts/repoint-pool-shared-faces.cjs`: header count (331 pictures, 74 nations).
- `harness/pool-names.mjs`: no exceptions; Malta's two on Malta pictures; the 22 become 24 throughout.
- `harness/player-pictures.mjs`: 24 repointed, none kept.
- `harness/run-all.mjs`: the banner comment.

### Item C

- `lib/db/volleyball-empire.sqlite` (starter DB): 22 `continental_pool_players.skin_tone` values.
- `scripts/portraits/ai-senior-cards.json`: for the 24, `imageBand`, `skinTone`, `skinToneBefore26Oct` and `imageBandBy`.
- `scripts/src/seed-pool-skin-tones.ts`: a picture's band for kind "repointed" too.
- `harness/pool-skin-tones.mjs`: 120 picture bands (was 96).
- `harness/player-pictures.mjs`: a check that the 24's tones are their new pictures' bands.
- `docs/proof-1.1.3/squad/itemC/`: the contact sheet, the reference and face sheets, the measurements and the scripts that made them.

### Part C

- `scripts/webgl-proof/market-1.1.3-save.mjs`:
  - the year now comes from the career's first season;
  - save C (two of the 24 as his pair);
  - Malta's two listed in M.
- `scripts/webgl-proof/market-1.1.3-shots.mjs`:
  - Malta's card;
  - session C, the court and its loader log;
  - session N opens Club News.
- `steam/app_build_5233750-1.1.3.vdf`: the description names 333192f9.
- `docs/STATUS-1.1.3-SQUAD.md` (this report) and `docs/proof-1.1.3/squad/` (every log, table and screenshot).

## What I found and did not fix

1. **The free-agent market drains over a long career.** In the soak it falls about 3 a season from season 6 and about 5 a season after season 22, to 114 by season 30. The squad policy isn't the cause: it only moves players between AI clubs and the market, and the AI clubs' pool holds at 180–181. The cause is new seniors against retirements:
   - **In:** 20 new seniors a season (5 picture players and 15 youths).
   - **The pictures run out:** the new-senior pictures are all used by season 22 and the picture players stop, so 15 a season after that.
   - **Out:** 24–47 retirements a season, most of them free agents nobody signs ("a season without a club": 542 of 985).

   At that rate the market would be thinner than the roughly 110 contracts ending each season by season 30–35. Possible fixes are more new seniors a season, a graduate picture for picture players once the new ones run out, or fewer unsigned retirements. These are economy decisions for Rob, not this brief.
2. **Transfers dip below the 10-season band in two of 30 seasons** (96 in season 7, 97 in season 17; the band is 104–172). Both are seasons with few contracts ending: contracts run 1 or 2 seasons, so the count rises and falls in a two-year rhythm. Nothing is wrong in those seasons (0 short days, places filled).
3. **ai-market's count of clubs starting a season on fewer than three seniors holding a place** is 0–2 after season 1, against 0–1 on 25 Oct. Each case I traced was one of:
   - a club whose two staying seniors leave less room than the cheapest free agent asks at the turn (the cap rule);
   - a third signed injured at her injured wage, who counts but holds no place until fit;
   - a December signing who retires at the turn, refilled the next game day.

   None gives a short day.
4. **The new-seniors installer re-encodes every picture on every run.** The bytes change each time though the pictures don't (mean pixel difference 2.5 of 255), so a re-run would rewrite all 331 files in git. Here I took only Malta's output. It could skip a picture whose source is unchanged.
5. **A youth at his club showed no skin tone in the court's match data.** While making a proof save, `/unity/match-state` gave Souphaphone Khampheng, a youth promoted into his side, `skinTone: null`. I didn't check what the court draws for her; the packaged court proof used two pool players.
6. **The 12 lowest AI clubs (each continent's _09 and _10) never met the proof career in a season.** They play elsewhere (not in its World Tour field), so the 24 repointed players' new tones are seen on the court mostly when they move to other clubs or to his.

## What needs Rob

1. **The upload.**
   - Run `steam/app_build_5233750-1.1.3.vdf` (ContentRoot `C:\build\vbe-1.1.3\win-unpacked\`, built from 333192f9; Unity dd0a487).
   - It has **`"SetLive" "default"`**, as 1.1.2's had: running it makes 1.1.3 live on the default branch. Change that line first if you want to check the build on a beta branch.
   - If you want the old package: the 24 Oct a0cd6231 one is at `C:\build\vbe-1.1.3-a0cd6231`.
2. **Then the merge of `release-1.1.3` into `update-1`**, only after the upload, as the brief says.
3. **Look at:**
   - the 24 bands on `docs/proof-1.1.3/squad/itemC/contact-sheet-24.jpg` (judged from the pictures, since their file names carry no prompt words; I'd most like a second eye on AFM_09_P2 and SAM_09_P2, full-body shots, and on EUR_10_P1);
   - the court screenshots;
   - Malta's card.
4. **Decisions I made that you may want to change:**
   - places filled every day, not only weekly;
   - one promotion age (16) everywhere;
   - in the window a club with no report coming signs now;
   - a waiting bid holds its wage;
   - `aiCounterFor` lives in the policy.
5. **The free-agent drain** (above): your call on the economy.

## The full 30-season market table

From `docs/proof-1.1.3/squad/part-c/soak-30-seasons.log` (`soak-30-table.json`). Over-cap club-seasons are given as AI clubs over the cap that signed anyone / over it only through a promoted youth (C-5, allowed).

| Season | Transfers (signed / refills / by bid) | Free agents start → end | Pool | 3+ seasons (most at a club) | Youth promotions | Places left open | Short-squad days | Over-cap club-seasons (signers / promoted youth) | Bids on his seniors |
|---|---|---|---|---|---|---|---|---|---|
| 1 (2026) | 127 (84 / 43 / 0) | 146 → 145 | 166 | 0 (0) | 2 | 15 (cap 15) | 0 | 0 / 2 | 0 |
| 2 (2027) | 165 (161 / 4 / 0) | 160 → 156 | 180 | 0 (0) | 10 | 1 (cap 1) | 0 | 0 / 0 | 0 |
| 3 (2028) | 122 (109 / 11 / 2) | 172 → 173 | 180 | 4 (1) | 1 | 2 (cap 2) | 0 | 0 / 0 | 3 |
| 4 (2029) | 162 (156 / 4 / 2) | 193 → 197 | 180 | 0 (0) | 5 | 1 (cap 1) | 0 | 0 / 0 | 1 |
| 5 (2030) | 108 (101 / 7 / 0) | 208 → 210 | 180 | 4 (1) | 7 | 2 (cap 2) | 0 | 0 / 0 | 0 |
| 6 (2031) | 153 (146 / 7 / 0) | 218 → 223 | 180 | 3 (1) | 8 | 0 | 0 | 0 / 0 | 0 |
| 7 (2032) | 96 (84 / 11 / 1) | 209 → 209 | 180 | 7 (1) | 13 | 2 (cap 2) | 0 | 0 / 0 | 1 |
| 8 (2033) | 142 (123 / 17 / 2) | 199 → 204 | 181 | 4 (1) | 12 | 0 | 0 | 0 / 0 | 2 |
| 9 (2034) | 112 (99 / 12 / 1) | 195 → 195 | 180 | 16 (1) | 5 | 0 | 0 | 0 / 0 | 1 |
| 10 (2035) | 135 (122 / 13 / 0) | 186 → 187 | 181 | 12 (1) | 11 | 0 | 0 | 0 / 0 | 0 |
| 11 (2036) | 112 (100 / 11 / 1) | 183 → 189 | 180 | 13 (1) | 12 | 0 | 0 | 0 / 0 | 1 |
| 12 (2037) | 119 (111 / 8 / 0) | 175 → 187 | 181 | 15 (1) | 14 | 6 (cap 6) | 0 | 0 / 1 | 0 |
| 13 (2038) | 106 (93 / 12 / 1) | 186 → 197 | 180 | 14 (1) | 12 | 1 (cap 1) | 0 | 0 / 0 | 1 |
| 14 (2039) | 131 (116 / 14 / 1) | 191 → 197 | 180 | 15 (1) | 7 | 0 | 0 | 0 / 0 | 1 |
| 15 (2040) | 105 (89 / 16 / 0) | 176 → 174 | 180 | 12 (1) | 17 | 3 (money 1, limit 1, cap 1) | 0 | 0 / 0 | 1 |
| 16 (2041) | 127 (116 / 10 / 1) | 175 → 181 | 180 | 10 (1) | 7 | 1 (cap 1) | 0 | 0 / 0 | 0 |
| 17 (2042) | 97 (91 / 6 / 0) | 177 → 185 | 180 | 17 (1) | 12 | 0 | 0 | 0 / 0 | 0 |
| 18 (2043) | 130 (118 / 12 / 0) | 183 → 189 | 180 | 13 (1) | 11 | 1 (cap 1) | 0 | 0 / 0 | 0 |
| 19 (2044) | 112 (102 / 10 / 0) | 185 → 182 | 180 | 19 (1) | 2 | 0 | 0 | 0 / 0 | 0 |
| 20 (2045) | 123 (110 / 12 / 1) | 176 → 176 | 181 | 21 (1) | 4 | 2 (cap 2) | 0 | 0 / 0 | 2 |
| 21 (2046) | 108 (93 / 13 / 2) | 163 → 175 | 180 | 21 (1) | 14 | 3 (cap 3) | 0 | 0 / 0 | 2 |
| 22 (2047) | 128 (108 / 19 / 1) | 160 → 167 | 180 | 16 (1) | 11 | 1 (cap 1) | 0 | 0 / 0 | 0 |
| 23 (2048) | 110 (98 / 12 / 0) | 151 → 148 | 180 | 16 (1) | 4 | 2 (cap 2) | 0 | 0 / 0 | 0 |
| 24 (2049) | 134 (124 / 10 / 0) | 142 → 142 | 181 | 16 (1) | 3 | 0 | 0 | 0 / 0 | 0 |
| 25 (2050) | 116 (107 / 7 / 2) | 139 → 137 | 180 | 15 (1) | 1 | 0 | 0 | 0 / 0 | 2 |
| 26 (2051) | 129 (118 / 10 / 1) | 125 → 132 | 180 | 9 (1) | 11 | 3 (money 1, cap 2) | 0 | 0 / 0 | 1 |
| 27 (2052) | 110 (96 / 13 / 1) | 129 → 128 | 181 | 9 (1) | 7 | 4 (cap 4) | 0 | 0 / 0 | 1 |
| 28 (2053) | 122 (112 / 10 / 0) | 124 → 128 | 180 | 13 (1) | 8 | 2 (cap 2) | 0 | 0 / 0 | 0 |
| 29 (2054) | 119 (102 / 17 / 0) | 123 → 119 | 180 | 16 (1) | 3 | 0 | 0 | 0 / 0 | 0 |
| 30 (2055) | 121 (112 / 9 / 0) | 110 → 114 | 181 | 16 (1) | 7 | 1 (cap 1) | 0 | 0 / 0 | 1 |

## The commits

| Commit | What |
|---|---|
| adc249a6 | Item A: one squad policy (the policy, the deletions, the callers, the suites, `squad-policy.mjs`) |
| 8f15d32d | Item B: Malta (pictures, repoint, installer fix, suites) |
| 243db06e | Item C: the 24 banded to their new pictures (starter DB, cards list, tone script, suites, contact sheet) |
| **333192f9** | Part C prep: the packaged proof's scripts. **The full harness (135/135), the soak's server code and the package are this commit.** |
| (this report) | The report; the proof logs; session N's Club News fix; the Steam script's description; `--retoned` taken back out of `ai-court-proof.mjs` (unused). |
