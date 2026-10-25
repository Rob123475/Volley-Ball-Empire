# 1.1.3: the AI market brief (25 Oct)

Branch `release-1.1.3` in `C:/vbe-tm`, from `a0cd6231` (the rebuild's package commit). Unity is unchanged at dd0a487. Version 1.1.3.

## Summary

*(Written last, when Part C is done.)*

## What is now true

| Item | Now | Evidence |
|---|---|---|
| 1 | AI clubs renew one player a season (their best) and replace every other ending contract in the window from the free-agent market, paying her price. A club too poor signs cheaper, then promotes a youth, then records the open place and why. No AI-to-AI bids. | `ai-market.mjs` **35/35** over 5 seasons: every club with a contract ending filled its places each season; at most one renewal a club, always its best on the day (83 renewals checked); every leaver gone by the turn; the A3 limits held; no AI-to-AI bid; no AI club over the cap on any day (C-5 apart: the 6 clubs the starter DB puts over it keep their own and add nobody); planted P1 signed cheaper (replacing a 79: a 73 and a 64), P2 promoted a youth, P3 recorded `open:cap`. `ai-buyable` **10/10 runs, 25/25 each**; the same suite on a0cd6231 (before the market) **fails**: "0 signed from the free agents". Logs: `docs/proof-1.1.3/market/item1/` |

| 2 | 22 of the 24 pool players who wore a world-roster player's card now have an unused new-senior picture of their own nation, in the starter DB only. Malta's two are reported: Rob made no Malta picture. | `pool-names.mjs` **24/24**: no two players in the starter DB share a picture, bar Malta's two (the academy youths' one generic youth card apart, by design); no two different files are the same picture (322 files, md5); the 22 are in, each from her nation's folder; a copy of Rob's live save, booted, keeps every pool card; a new save's AI seniors carry the new pictures; and with every other new-senior picture planted as given, the first turn hands none of the 22 to a new senior. `player-pictures.mjs` 36/36. The 22 old → new: `docs/proof-1.1.3/market/item2/repoint-old-to-new.txt`; contact sheet (old card, new card, each captioned): `contact-sheet-old-and-new-cards.jpg` |

| 3 | The contract box says what's true: "1 season runs to 31 December (signed in the transfer window, to the next one); 2 seasons, a season more; 6 months, six months from today." The Rules page had no such claim; its AI section now describes Item 1's market. | `contract-offer-dialog.tsx`, `rules.tsx`; the rules page's "Contract lengths" already said 31 December (24 Oct). No suite reads these texts (checked); frontend typecheck clean; packaged-game check in Part C |

| 4 | An AI club near the cap holds a third senior, inside the cap: its one renewal and its refills keep room for three; the third place takes a free agent or a youth that fits; the injured list's cover comes the same day; the academies are filled from Day 1. | A 10-season soak on this build: **0 short-squad club-days** (22 over 30 seasons on 24 Oct; 12 in 10 seasons before the academy fill), **0** AI clubs over the cap that signed anyone, over it only through a promoted youth 3 (season 1) and 1 (season 7). `ai-market.mjs` 36/36 with the new check (no AI club below two on any day, 5 seasons; clubs starting a season on fewer than three: 13 → 0 → 0 → 0 → 0). The 30-season proof is Part C's soak. Logs: `docs/proof-1.1.3/market/item4/` |

| 5 | The Job Market is a tab on the Career page, mid-season and any time, with the sidebar as the way back; its own page has a Back link while he has a club. | Frontend typecheck clean; no suite reads these pages (checked, including fake-content-removed's patterns). Packaged-game screenshots, way in and way back, mid-season: Part C |

| 6 | The staff Doctor who shared pool player SAM_04_P1 Lucía Quispe's name is **Rosario Quispe**, in the starter DB only; the player keeps Lucía. **Rosa Quispe was taken** (staff 10078, a Peruvian Massage Therapist), so not Rosa: Rosario, of which Rosa is the short form. The four tweed scouts are untouched. | `pool-names.mjs` **26/26**: no pool player shares a staff member's name; "Rosario Quispe" belongs to no one else (players, pool, staff, AI managers checked); a copy of Rob's live save, which predates her card, gets her new under the new name, and nothing it had changes. `git diff a0cd6231 -- images/staff/`: no picture changed (scouts 52, 54, 58, 60 as they were) |

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

### Item 2: the 24 shared faces

- `lib/db/volleyball-empire.sqlite` (the starter DB): 22 `continental_pool_players.image_url` repointed, nothing else. Each is the first unused picture of her nation in Rob's list (`tunisia_01`, `tunisia_02`, ...). Unused means on no row of any table that carries a player's picture (`players`, `continental_pool_players`, `career_graduate_portraits`, `career_new_seniors`, `player_retirements`), and not given to another of the 24. The file must exist on disk. The full list is in the proof file:

  | Pool player | Old card (also worn by) | New card |
  |---|---|---|
  | AFM_09_P1 Yasmine Mzoughi | tunisia_01 (Ines Trabelsi) | tunisia/tunisia_01 |
  | AFM_09_P2 Amira Bouazizi | tunisia_02 (Sarah Ben Ammar) | tunisia/tunisia_02 |
  | AFM_10_P1 Rehema Mollel | tanzania_03 (Zawadi Kimaro) | tanzania/tanzania_01 |
  | AFM_10_P2 Upendo Mwakalinga | tanzania_01 (Asha Msuya) | tanzania/tanzania_02 |
  | ASI_09_P1 Tran Thu Trang | vietnam_03 (Le Minh Anh) | vietnam/vietnam_01 |
  | ASI_09_P2 Le Ngoc Han | vietnam_02 (Tran Thi Bich) | vietnam/vietnam_02 |
  | ASI_10_P1 Lin Pei-Shan | taiwan_02 (Chen Yu-Hsin) | taiwan/taiwan_01 |
  | ASI_10_P2 Hsu Wan-Ting | taiwan_01 (Huang Yi-Ting) | taiwan/taiwan_02 |
  | AUS_09_P1 Grace Bainivalu | papua_new_guinea_04 (Diana Kumul) | papua-new-guinea/…_01 |
  | AUS_09_P2 Lahui Kaupa | papua_new_guinea_02 (Kiriwina Tau) | papua-new-guinea/…_02 |
  | AUS_10_P1 Ruby Mackenzie | new_zealand_01 (Zoe Walker) | new-zealand/…_01 |
  | AUS_10_P2 Isla Walker | new_zealand_02 (Lily Mackenzie) | new-zealand/…_02 |
  | EUR_09_P1 Carolina Moreira | portugal_01 (Sofia Almeida) | portugal/portugal_01 |
  | EUR_09_P2 Niamh Kavanagh | ireland_01 (Aoife O'Sullivan) | ireland/ireland_01 |
  | NAM_09_P1 Tanisha Brown | jamaica_01 (Niah Myers) | jamaica/jamaica_01 |
  | NAM_09_P2 Keisha Beckford | jamaica_02 (Jayda Brown) | jamaica/jamaica_02 |
  | NAM_10_P1 Shante Bethel | bahamas_01 (Aaliyah Rolle) | bahamas/bahamas_01 |
  | NAM_10_P2 Tiara Ferguson | bahamas_02 (Jada Knowles) | bahamas/bahamas_02 |
  | SAM_09_P1 Anjali Persaud | guyana_03 (Nia Campbell) | guyana/guyana_01 |
  | SAM_09_P2 Keziah Campbell | guyana_01 (Amara James) | guyana/guyana_02 |
  | SAM_10_P1 Ximena Zeballos | bolivia_04 (Kamila Torrez) | bolivia/bolivia_01 |
  | SAM_10_P2 Daniela Mamani | bolivia_02 (Camila Torrez) | bolivia/bolivia_02 |
  | **EUR_10_P1 Maria Caruana** | malta_02 (Sara Borg) | **reported: no Malta picture** |
  | **EUR_10_P2 Nicole Borg** | malta_01 (Yasmin Grech) | **reported: no Malta picture** |

- `scripts/repoint-pool-shared-faces.cjs` (new): the repoint. It is a dry run by default, `--write` applies it, and it is idempotent.
- `artifacts/api-server/src/utils/ensureSchema.ts`: **a pool player's card no longer follows the starter DB at boot when the save has one.** It moved from the update-only list to the fill-only list, as her skin tone is. Without this, the boot would have copied the 22 new pictures into every save in play, which the brief forbids (the 24 Oct names precedent). A save with no card for her still gets the starter DB's, so 5 Oct's pictures still reach a save that has none.
- `artifacts/api-server/src/utils/newSeniors.ts`: **a new senior is never given a picture a pool player, a world-roster player or this career's player already carries** (`usedPicturesTx`). The game had only checked this career's own record. The 22 pictures the pool players now wear are from the same pool the season's turn hands out, so without this a new senior could later have arrived wearing one of them.
- `scripts/portraits/ai-senior-cards.json`: the 22 are now kind `repointed`, with their new card, `cardBefore25Oct`, and the pool player's current name (`nameBefore24Oct` keeps the old one).
- Harness:
  - `pool-names.mjs` checks the pictures too (sections 1b to 4b above).
  - `player-pictures.mjs` reads 96 new, 22 repointed, 2 kept, and checks each repointed card comes from her own nation's folder.
  - The run-all banner for 98zy.

### Item 4: keep an interchange

**Where it sits against the cap and Item 1.** Every senior asks at least $11,500 a month (the floor wage plus the 1 Oct rise), so on the $60,000 cap a third senior needs the other two to cost at most $48,500. In season 1 that fails for the clubs the starter DB puts at two stars (6 of them are over the cap with two: $62,000 to $72,000), and for clubs near it. Item 1's market made it worse when it left places open for the cap (10–15 a season). The fix keeps the third inside the cap rather than through Rob's C-5 exception:

- `artifacts/api-server/src/utils/aiSquads.ts`
  - **The one renewal leaves room for three** (`renewAiSeniorTx`). Re-priced to her rating, the best renews only if the club's bill on the day her new deal starts still fits its other places at the cheapest free agents' wages. Otherwise she goes and the club fills all three for less ("three rather than two"). This is where Item 4 and Item 1 meet: a club near the cap gives up the renewal.
  - **A refill keeps room for three** (`keepAiSquadsTx`): when it signs to make two, it keeps room for the cheapest free agent who would make three, where it can; two on the sand still comes first. **The third place** goes to the best free agent that fits, else its academy's best youth (16+) **if her wage fits** under the cap; before, it stayed empty.
  - **The injured list's cover comes the same day** a senior goes on the list after a match (`aiMatchInjuriesTx` → `aiInjuredListDayTx` for that club). Before, it came the next morning. And **cover fits under the cap unless the club would have fewer than two**: C-5 (a promoted youth is never blocked) now applies only then. It had made 34–39 club-seasons go over the cap through a promoted youth in five seasons; now 4.
- `artifacts/api-server/src/utils/youthLoans.ts` (`fillAiAcademiesTx`, factored out of the weekly step) and `utils/day1Draft.ts`: **the AI academies are filled when the Day 1 draft closes**, not on the first weekly block (8 January). The only short days left in the soak were two clubs hurt on 1 January with no youth to cover them for a week.
- `artifacts/api-server/src/utils/transfers.ts` (`completeTx`), **found by ai-market**: a bid for Rob's senior agreed in the window moves her at once, by a path that skipped the arriving club's trim and its under-the-cap step. Club 35 was $62,278 for a day. Both steps now run on every arrival at an AI club.
- `harness/ai-market.mjs`: Item 4's checks: no AI club below two seniors holding a place on any day, and how many clubs start each season on fewer than three. It also follows the career's club now (a sacked manager is moved to an AI club at the turn, a new teams row; my first version read the old club's calendar).

### Item 5: the Job Market mid-season

- `artifacts/beach-volleyball/src/pages/career-hub.tsx`: **the way in**. A "Job Market" tab on the Career page (the sidebar's Career), beside Career Options, where his contract and his leaving options already are. It shows the Job Market inside the game's screens, so the sidebar takes him back like every other screen. Mid-season he sees the vacancies, with each club's answer to him, and the window's line: moves wait for his season's end.
- `artifacts/beach-volleyball/src/pages/job-market.tsx`: an `embedded` mode for the tab, without the page's own padding and without the national-coach offers the Career page already shows. On its own page (Career Options' "leave at the season's end" buttons send him there), **a "← Back" link while he still has a club**, as Settings' Rules page has. With no club (the club sold, or sacked), the page is as it was: the one screen that works.
- `artifacts/beach-volleyball/src/App.tsx`: the route renders the page as a child (it now takes a prop).

### Item 6: the staff namesake

- `lib/db/volleyball-empire.sqlite`: staff 10172 (Doctor, Peru) "Lucía Quispe" → "Rosario Quispe". Nothing else.
- `scripts/rename-staff-quispe.cjs` (new): the rename. It refuses if the new name is taken, is idempotent, and doesn't add the old name to `PREVIOUS_STAFF_NAMES`, so a save that has her keeps its name for her.
- `docs/staff-portrait-names-1.1.3.json`: her entry now reads Rosario Quispe (`nameBefore25Oct` keeps Lucía). The portrait installer matches by name and role, so a re-run won't recreate the old name.
- `harness/pool-names.mjs`: the two item 6 checks.
- The tweed scouts (52, 54, 58, 60): not touched, as the brief says.

### Item 3: the contract box sentence

- `artifacts/beach-volleyball/src/components/contract-offer-dialog.tsx`: "A season ends when the World Tour does — the club sets the date." was wrong: every season row runs 1 January to 31 December, and the length decides the end (`contractTerms.ts contractEndDate`, `transferWindow.ts contractEndFrom`). It now says what each length means.
- `artifacts/beach-volleyball/src/pages/rules.tsx`: I checked it for the same claim: there is none, and "Contract lengths" says 31 December. The section "The AI clubs' scouting and buying limits" described the AI-to-AI bidding Item 1 removed. It is now "The AI clubs' market, and its limits": the one renewal, the market in the window, the fallbacks, and bids only for his players. The limits are the same, with signings counted with bids.

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

**Item 2 (the faces):**

- **Each player gets the first unused picture of her nation** in Rob's list order. Nothing in the brief chooses between them, and this is repeatable.
- **The pool card stops following the starter DB in saves that have one** (above), so the change reaches new saves only.
- **Skin tones are left as they are.** The brief doesn't ask, and see "What I found".

**Item 6:**

- **Rosario Quispe, not Rosa Quispe.** The check the brief asked for found Rosa Quispe already on staff (10078). Two staff with one name is the problem this item fixes, so I took the nearest name that is free.

## What I found and did not fix

- **Item 2: these 24 pool players' skin tones never matched their old cards either.** For example, EUR_09_P2 Niamh Kavanagh is "Dark" on a light-skinned card, and AFM_10_P1 Rehema Mollel is "Light" on a dark-skinned one; the contact sheet shows the tone beside each pair. 10 Oct matched tones to pictures for the 96 new cards only, not these 24. The 3D court draws her with the tone, so it may not match her new picture. I didn't change any: a band has to be judged from the picture, and the brief didn't ask.
- **Item 2: a new career started inside an existing save file uses that save's pool cards** (the old shared faces), as with the 24 Oct names: the brief says not to reach into saves.

## What needs Rob

1. **After you upload and set 1.1.3 live: merge `release-1.1.3` into `update-1`** in `C:\Users\rbonn\Documents\Volley-Ball-Empire` and push (brief item 7; not done, it waits for the upload). Optional: `C:\build\vbe-1.1.3-eb2dc65b\` can be deleted.
2. **The upload and going live**, yours as always (not on a Monday). The Steam script `steam/app_build_5233750-1.1.3.vdf` still has `SetLive "default"`: check that line before you run it.
3. **AI clubs still bid for your seniors, and now a little more often.** Your rule took away club-to-club buying between AI clubs. I kept their bids for *your* players, since that's your 16 Oct counter-offer feature, which your Team page answers. Because AI clubs now hold a cheap third (item 4), more of your seniors clear their "5 better than our weakest" bar: in the soak, about one bid on your seniors a season (8 in 10 seasons; it was nearly none). The soak never answers, so each one took a player; you'd counter or let her go. If you meant no club-to-club deals at all, it is one loop in `aiTransfersWeekTx` and the suites that test it.
4. **Malta's two pool players** (EUR_10_P1 Maria Caruana, EUR_10_P2 Nicole Borg) still wear world-roster players' cards (Sara Borg's, Yasmin Grech's). There is no Malta picture among your new-senior cards. Two Malta pictures in `Desktop\new senior cards\europe\malta\` and a re-run of the installer and `scripts/repoint-pool-shared-faces.cjs --write` would finish it.
5. **Rosario, not Rosa:** Rosa Quispe is already your Massage Therapist (staff 10078), so the Doctor is Rosario Quispe. Say if you'd rather another name.
6. **The 24 repointed players' skin tones** didn't match their old cards either (see "What I found"). Say if you want them banded to the new pictures, as 10 Oct did for the 96.

## Part C: the one full test

**Full harness runs** (`pnpm run build`: typecheck, build, sync, every suite; logs in `docs/proof-1.1.3/market/part-c/`):

| Commit | Result | What failed, and what I did |
|---|---|---|
| 852be3f6 (items 1–6) | 129 / 136 | Seven suites, all from this brief's changes. **Game fixes:** (1) the Nations Cup podium had a medallist with no skin tone, a player the game made (a new senior or graduate an AI club signed); the podium now takes the 3D court's rule, one of her nation's pool tones (`nationTones`, shared). (2) The Club News market item said "AI clubs sign 0 free agents…" on days with only a promotion; the wording is fixed, and refills now count as signings. **Suite fixes** (each assumed something this brief changed): `fake-content-removed` didn't know the new `market-<date>` item, nor `retirements-<date>`, which now shows in the first week; both are traced to their rows. `hall-of-fame` lost three seniors to unanswered AI bids: AI clubs with a cheap third clear his players more often, so it turns bids down, as `economy` does. `player-pictures` counted the AI academies' Day 1 youths as shipped ones. `injured-list` planted cover at a club with no room under the cap (cover must fit now). `youth-deals` asked with a Scout already on two jobs. `nations-cup` picked a pair a fortnight before the draw and one had left her club; it re-picks on the eve. Each passed alone after its fix. |
| 18e106a8 | 130 / 136 | The seven above all passed; six others failed, again knock-on effects of AI clubs holding three. **Game fixes:** (1) a poor AI club could sign a 39-year-old as its third and its deadwood rule asked her to retire a week later (paying her off). Now the market and the third-place and cover signings skip free agents of the deadwood age (35); signing to make two takes anyone. (2) The broke club's on-credit signing took the *weakest* free agent of those on the floor wage; it now takes the best of them. **Suite fixes:** `ai-club-economy` lost its manager to abandonment after AI bids took three of his seniors, so it turns bids down; AI clubs now bid for his seniors about once a season (they used to almost never; see "What needs Rob"). `ai-buyable` section 4 picked a club with two seniors holding a place but a third on the injured list (who still counts). `day1-draft` and `ai-market` counted a day-one C-5 cover youth at a club the starter DB puts over the cap as a breach. `youth-deals` gave an AI youth purchase 10 weeks; the buyer's Scout now also works the market, so 20. `new-seniors` passed 5 of 5 after the age fix. |

## The market numbers

## The commit
