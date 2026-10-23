# 1.1.3, the final package: status

Brief: `Downloads\FINAL-1.1.3-BRIEF.md` (23 Oct 2026). Worktree `C:/vbe-tm`, branch **release-1.1.3**, made from `release-1.1.2` 39cebbbe (live on Steam as BuildID 26098080). Commit and push after every item. Nothing uploaded to Steam. Rob's live save was only copied, never opened.

*Written as the work goes. The summary goes at the top once Part C is done.*

## Summary

(Part C not run yet.)

## Decisions I made

- **A1, logos:** the brief says pictures carrying a logo, brand mark, printed name or flag are reported and **not installed**. 82 of the 143 fail: every head coach (10) and every scout (61) wears the gold swirl tour emblem (polo chest, suit lapel; the scouts also have the blurred swirl on the back wall), and every assistant coach (11) has "BEACH VOLLEYBALL WORLD TOUR" on the shirt and WORLD TOUR / VOLLEY TOUR on the net banners behind. I did not clean them as on 19 Oct, because the brief says don't install those, and the medics the AI clubs run short of (doctors and physios) all pass. The 82 can be cleaned the 19 Oct way, or regenerated without the emblem, in a later update if Rob wants them.
- **A1, printed role words:** "PHYSIOTHERAPIST" and "PHYSIO ASSISTANT" on the physios' polos are generic role words, which the 19 Oct check left as they are (docs/STAFF-LOGO-CLEANUP.md, "Left as is"). They pass.
- **A1, orthopaedic surgeons:** "the `orthapaedic surgeon` folder is out". The 17 Oct set has no surgeon folder, so none are installed. The 13 surgeons 1.1.1 already installed stay. Taking them out of saves would be a removal the brief doesn't ask for.
- **A1, nationality and age:** the doctor and physiotherapist file names give the nationality (cut short, e.g. "of a Sou" is the South Korean woman); the registrar and physio assistant names give none, so it is read off the picture, as for 1.1.1's junior medics. No file name gives an age, so ages are read off the pictures. Names follow each nation's athletes' surnames where the game has them, and none repeats an existing staff name (two clashes, Seo-yeon Choi and Rania Khoury, were changed to Han and Saab).

## Part A

### A1. Staff portraits Rob made on 17 Oct

**Done. Commit: see the A1 line in the item table.**

**1. Which are already in the game (by picture, not file name).**
- Every one of the 143 was compared with every portrait under `images/staff/**` (359) and the earlier source folder `Desktop\staff portraits\` (156). The method: the installer's own crop, then a 256-bit DCT hash plus a pixel-by-pixel difference at 64×64 colour (`scripts/portraits/staff-picture-match.py`; the result is `docs/proof-1.1.3/a1-picture-match.json`).
- A plain 64-bit pHash wasn't decisive on these look-alike studio headshots (different people came out 4 to 10 bits apart), so the pixel difference decides. The closest game picture to any new one is 6.2 levels apart (of 255), and by eye it is a different man (`a1-sheet_game.jpg`, the 16 closest pairs side by side).
- **Already in: 0. New: 143. Duplicates within the new set: 1 pair**, scouts `... croppe (15).png` and `(16).png`, identical to the pixel.

**2. The logo check (as on 19 Oct: by eye on contact sheets, `docs/proof-1.1.3/a1-sheet-*.jpg`).**

| Folder | Pictures | Pass | Fail | Why it fails |
|---|---|---|---|---|
| doctor | 13 | 13 | 0 | |
| registrar | 12 | 12 | 0 | |
| physiotherapist | 12 | 12 | 0 | ("PHYSIOTHERAPIST" on the polo: a role word, passes) |
| Physio Assistant | 12 | 12 | 0 | ("PHYSIO ASSISTANT": a role word, passes) |
| head coach | 10 | 0 | 10 | gold swirl tour emblem on the polo chest |
| assistant coach | 11 | 0 | 11 | "BEACH VOLLEYBALL WORLD TOUR" and the swirl on the shirt; WORLD TOUR / VOLLEY TOUR net banners; a cap logo on one |
| scouts | 61 | 0 | 61 | gold swirl lapel pin; a blurred swirl on the wall behind. (15) and (16) are also a duplicate |
| **Total** | **143** | **49** | **82** | |

**3. Installed: the 49 that pass**, the way 1.1.1 did it (`scripts/install-staff-portraits.cjs`: 500×500 WebP at q=88, the role folders under `images/staff/`, ids from 10001 up so the boot's Pass 3b brings them to old saves; the junior grades with `--juniors`). Names, ages and nationalities are in `docs/staff-portrait-names-1.1.3.json`.
- The installer used to number a role's pictures after its *seeded* staff and find a person again by picture. A second install into the same folder would have overwritten day 2's and 1.1.1's pictures (doctors from staff-11). It now finds a person by name and role, and a new picture takes the next number after every picture already in the folder, from the rows and the files alike. The installer suite still passes (15/15: first write, second write updates, never a duplicate).
- Doctors are `medical_doctor/staff-36` to `-48`, Registrars `-49` to `-60`, Physiotherapists `physiotherapist/staff-32` to `-43`, Physio Assistants `-44` to `-55`. Staff ids 10161 to 10209.

**Counts per role, starter DB and a copy of Rob's live save** (`%APPDATA%\Beach Volleyball Empire\volleyball-empire.sqlite`, last saved 16 Oct; copied, and the 1.1.3 server booted once on the copy):

| Role | Starter DB before | Starter DB after | Live-save copy before | Live-save copy after one boot |
|---|---|---|---|---|
| Doctor | 21 | **34** | 21 | **34** |
| Registrar (Doctor) | 14 | **26** | 0 (a 1.1.0 save) | **26** |
| Physiotherapist | 21 | **33** | 21 | **33** |
| Physio Assistant (Physiotherapist) | 10 | **22** | 0 | **22** |
| Orthopaedic Surgeon | 13 | 13 | 0 | 13 |
| every other role | unchanged | unchanged | unchanged | unchanged |
| all staff | 280 | **329** | | |

- Both careers in the live-save copy got their state rows for all 49 new people (career 16: 0 then 49; career 18: 0 then 49).

**Proof, the AI clubs (`harness/ai-staff.mjs`, 31/31 alone):**
- "(1.1.3) the Day 8 pool includes the 49 new faces, and AI clubs hired some of them": **49 in the career, 28 at AI clubs on Day 8** (doctors and physiotherapists).
- "(1.1.3) on Day 8 no AI club is short of a doctor or physio": **0 of 60** without one. Before, only 32 doctors and physios were spare for 60 clubs (docs/STATUS-UPDATE1-PRE-UPLOAD.md); now 105 are.
- `harness/junior-medics.mjs` 12/12 (now 26 Registrars and 22 Physio Assistants). `harness/wizard-career-economy.mjs`'s staff count moves from 160 to 209 from id 10001.
- **The soak line** (no AI club short of a doctor or physio, across the seasons) is in Part C.


### A2. Real flags on every screen

**Done in code; the packaged-game screenshots are in Part C.**

- **The flags:** the MIT `flag-icons` set, version 7.5.0 (May 2025), 4x3 SVGs. All 271 are copied into `artifacts/beach-volleyball/public/images/flags/` with the licence (`LICENSE.txt`), so they work offline. `scripts/install-flags.cjs` does the copy, and with `--unity` it renders the game's flags as 128 × 96 PNG textures into the Unity project's `Assets/Resources/Flags/` (128 of them, for A5).
- **One lookup, one component:** `flagCode()` in `lib/db/src/schema/continents.ts` is built on `countryCode()` and gives `gb-eng`, `gb-sct` and `gb-wls` to England, Scotland and Wales. The frontend's one component is `components/flag.tsx`, `<Flag nation=… />`. It draws `images/flags/<code>.svg`, or a plain globe icon (never letters) for a nationality the game doesn't know. **`countryFlag()` and its emoji are deleted.** The Nations Cup API no longer sends an emoji `flag` field: the pages draw the flag from the nation's name.
- **Replaced (every emoji flag):** the youth card's flag (player-portrait), the manager's nationality picker (both wizards), the Nations Cup qualifying list, national squads, the schedule (matches, groups, medals, passed-over nations) and the dashboard's Nations Cup widget.
- **Added beside every nationality a card or list prints:** the youth card (FIFA-style card), senior player cards (Players, Team), staff cards (Staff Market, Medical Market, Staff, Medical), the Youth Academy, continental scouting, Day 1 draft, continental pools, the Hall of Fame. The clubs page's youth tiles use the youth card flag. The job market's flags come with A4c's national-coach offers, which show there.
- **Every nationality resolves:** the new check found 25 nationalities with no flag: 6 manager-face nations (Estonia, Haiti, Romania, Bangladesh, Israel, Cape Verde), the player-nationality edit list (Kazakh, Uzbek, Romanian, Slovenian, Rwandan …), and Hungary, Slovakia and "Great Britain" from the manager picker. Each now has an `iso()` line.
- **Proof: `harness/flags.mjs`, 18/18** (run-all 98zu). It walks every distinct nationality in the starter DB (players, staff, pool players, youths, retirements, managers), the new-senior picture nations, `data/nationNames.ts`, the manager faces, the world roster and every picker and generator list: **205 nationalities, every one with a flag file.** The source checks: no emoji flag in the frontend, server or continents.ts; `countryFlag` gone; 19 files draw `<Flag>`, all through `components/flag.tsx`. Unity: a PNG for every one of the 124 flag codes.

**Decisions (A2):**
- `flag-icons` is not added to a `package.json`. The worktree's `node_modules` are junctions into the main tree, and a `pnpm add` here would change the main tree's install. The package was fetched with `npm pack flag-icons@7.5.0`, and its SVGs and licence are copied in by `scripts/install-flags.cjs`, which says where they came from.
- The Players page's continent filter keeps its globe emoji (🌍 🌏 🌎 🌊). They stand for continents, not nations, so they aren't flags.

### A3. AI scouting and buying limits

**Done; proven alone. The soak lines run in Part C.**

**What I found first:** AI clubs did not scout seniors at all. An AI club bid for a senior straight away, with no report (`aiTransfersWeekTx`, utils/aiSquads.ts). Its only scouting job was a youth deal's negotiation. So the scouting limit needed something to limit: **an AI club now scouts a senior before it bids for her.**

**The rule, as built** (`AI_SEASON_LIMITS = { scoutingReports: 10, scoutingPerClub: 2, bids: 10, bidsPerClub: 2 }` in `lib/db/src/schema/transfers.ts`, beside `AI_TRANSFER_TERMS`):
- **Scouting:** each week an AI club that wants a senior (the same choice as before: the best fit player it can afford, at least 5 better) first needs a report on her. With none, one of its Scouts or coaches starts one: a job in `scouting_jobs`, 5 days, under the existing 2-reports-at-once rule. It bids a later week, once the report is ready. **At most 10 reports a season, and never more than 2 on players at any one club** (the player's club counts as a club).
- **Buying:** a senior bid and a youth buy offer are each one bid. **At most 10 bids a season, never more than 2 to any one club** (the player's club or the selling AI club). A bid her club refuses or counters still counts. An ask that couldn't be made (nobody free to negotiate, no money) is not a bid.
- **Counted from the save:** every report and bid is a row in a new table, `ai_market_moves` (the AI club, kind, player, the club holding her that day, season, date, the report's ready day). `utils/aiMarketLimits.ts` counts from it, never from memory. A deleted career deletes its rows.
- A season runs from 1 January, as the seasons table's do. Continental youth missions are not covered (AI clubs send none).

**Proof: `harness/ai-market-limits.mjs`, 19/19 alone** (run-all 98zv). It sims 3 seasons, with a server reboot in the middle.
- **Planted:** an AI club given 10 bids this season made no more. One given 2 reports on the player's club scouted none of his players again.
- **Every season, from the table:** most reports by one AI club 4 / 3 / 3; most by one club on one club 2 / 2 / 1; most bids by one club 10 (the planted one) / 7 / 5; most to one club 2 / 2 / 2. All within the limits.
- **The table agrees with the game:** 449 AI reports, each a Scout's or coach's job in `scouting_jobs` (and the other way round). Every AI senior bid in `transfer_deals` is on record as a bid, and every one came after the bidder's ready report on her. Every AI youth buy is on record, and refused asks are counted too (315 bids recorded against 5 senior bids and 12 youth sales).
- **A reboot keeps every report and bid** (393 rows before, 393 after).
- AI senior buying was already rare (0–3 a season in 1.1.1: AI squads sit near the cap). As in `ai-buyable` and `transfer-window`, the suite gives six AI clubs room so bids happen at all.
- **The suites that rely on AI buying, run again alone:** transfer-window 19/19, ai-buyable 25/25, counter-offer 10/10, salary-cap 16/16, manager-faces 56/56.
- **The soak** now prints, each season, the reports and bids, the most by one AI club, and the most by one AI club on one club. It flags any season past a limit. That replaces 1.1.1's "no limit on AI bids" flag.

**Decisions (A3):**
- AI clubs scout before buying, as described above. Without it, "10 scouting missions a year" would limit nothing. The cost: an AI bid now comes a week after the club picks her, once the report is in.
- AI clubs hire coaches, not Scouts (one coach and one medic each), so a Head or Assistant Coach does an AI club's scouting, as for its youth deals. A club with no coach can't scout, and so can't buy a senior, until it hires one.

### A4. Empire Nations Cup: watchable, and the player can coach a nation

**Done in code and proven alone. The 3D court's side (Unity) is exported with A5, and the packaged-game screenshots are in Part C.**

**A4a. Played over days** (`utils/olympics.ts`; the one-shot `playOlympicsTx` is deleted, and the World Tour no longer calls it):
- **Kept:** Cup years (divisible by 4), the 12-nation field and qualifying, 4 groups of 3, QF/SF/bronze/gold and the same match engine.
- **The draw:** at the end of the last regular World Tour round's day (round 70, 23 November), once every regular fixture is decided. It makes the field, the pairs and the group day's 12 fixtures (a new table, `nations_cup_fixtures`).
- **The days** (`NATIONS_CUP_DAYS`, `lib/db/src/schema/national-coach.ts`): **group day 24 Nov, quarter-finals 25 Nov, semi-finals 26 Nov, medal day 27 Nov.** Each stage's fixtures are made once the stage before is decided (QF from the group tables, SF from the QFs, bronze and gold from the SFs).
- **A match** is *scheduled*, then *live* while it is watched on the court, then *decided*: by the court's result, or by the engine at the end of its day (`nationsCupDayTx`, run by the calendar's day). A match left part-way is finished from its last score, as a club match is.
- **Results, medals, trophies, Club News and achievements** use the same tables as before: each decided match is its `olympic_matches` row, and the medal rows and trophies are written when gold and bronze are decided. Club News shows a Cup once it is finished.
- The Season Calendar shows the four days, and the schedule page shows the Cup day by day, with today's matches marked.

**A4b. Watch on the 3D court:**
- **Watch buttons** on the Nations Cup schedule page and the Dashboard ("Empire Nations Cup today"), on the match's day only. They open `/court?nationsMatchId=…`.
- **`/unity/match-state?nationsMatchId=`** serves the two nations' pairs, each player in **her nation's colours**. The colours come from a new kit table, `lib/db/src/schema/national-kits.ts`: the 42 national kits the AI club cards already wear, plus every other nation's two main flag colours, one line for each of the 128 nations the game knows. When the two kits are too alike, the away pair changes to white, under the one kit rule.
- **The court's switch:** the payload carries `courtsideBoards: "nations_cup"`, `boardText: "EMPIRE NATIONS CUP 2028"` and `kitSource: "national"`. Unity's `CourtsideBoards.DressNationsCup` draws the banner text at run time into each board model's own texture size (`BannerPainter`, TextMeshPro), so every Cup year has its own boards.
- **Results:** `/unity/match-progress` and `/unity/match-result` take `nationsMatchId` (MatchReporter posts it in place of `matchId`). A result sent twice changes nothing.
- **Auto only,** except his own nation's matches. The payload's `manualAllowed` (Unity's `ManualControl.ForbidManual` refuses Manual from the page and from Tab / View / Share), and the court page's settings agree. Manual control always plays the court's home pair, so when his nation is the fixture's away side the court is sent it as home, and the scores it posts are turned back.

**A4c. The national coach job** (`utils/nationalCoach.ts`, `routes/national-team.ts`; the numbers in `lib/db/src/schema/national-coach.ts`):
- **Offers:** whenever he has no national job, **1 to 3 nations** offer: in the 6 months before a Cup (from its group day back), and as soon as his national contract ends. His manager level picks the band of the strength ranking they come from (level 1, Local Coach: the weakest 40%; level 5, Legend: the strongest 40%). Strength is a nation's best two fit players' average rating. The offers show on the **Career page** (top) and the **job market**, with a **Dashboard notice** while one waits. He accepts one or declines them all.
- **Contract: 3 or 5 years** (anything else is refused). **Pay is fixed**, set when the offer is made, and **against strength** (`NATIONAL_COACH_PAY`, by strength share): **strongest 20% $3,000 a month, then $4,500, $6,000, $7,500, weakest 20% $9,000.** It is paid to him day by day (`national_coach_jobs.paid`), **never through the club's books**. It counts in his career earnings, and his Profile shows a "National Coach (nation)" pay line.
- **National Team page** (side menu, Competition › Empire Nations Cup, only while he coaches): every player of his nation at any club (never a free agent) with injuries, fitness and fatigue. He picks the pair for the next Cup; an injured player can't be picked, and if he doesn't pick, the best two fit play. The **pre-Cup camp**: *training* (the pair plays the Cup +2, and +10 fatigue) or *recovery* (fitness 100, no fatigue), applied at the draw and for the Cup only. The page also shows his contract (nation, years left, pay, paid so far). It locks once the Cup is drawn.
- **Rules page:** new sections, "The Empire Nations Cup, day by day" and "National coach". The Nations Cup card says the coach's pick is used.

**Proof: `harness/nations-cup.mjs`, 45/45 alone** (run-all 98zw). It plays one career to the end of November 2028:
- **First window:** no offer before 24 May 2028. On that day 3 offers came (Venezuela #34/50 $7,500, Vanuatu #43/50 $9,000, Ghana #47/50 $9,000). The Career page and Dashboard data read them. **4 years refused; 3 years accepted** (Venezuela, 25 May 2028 to 25 May 2031, $7,500 a month); the other two declined.
- **Pay:** $7,644 for 31 days (monthly × 12 / 365 a day); nothing on the club's ledger; it shows on the career summary.
- **The page:** every listed player is at a club (for the USA, which he was set to coach for the test: 8 listed, 8 free agents not listed); an injured player is shown and can't be picked; a pair that is *not* the best two was picked, with the training camp.
- **The draw** (end of round 70's day): **his picked pair plays**, rated **+2** (85.75 against 83.75). Their fatigue: 50 that morning, 60 after the draw (the camp's +10; AI club players have no daily rest). **Every other nation played its best two fit** (11 of 11), and the page locked.
- **Group day:** 12 watchable matches on the Dashboard data. His nation's match on the court was live, his nation the court's home pair, Manual allowed, **in national colours (#1B2A4A for the USA) with "EMPIRE NATIONS CUP 2028" boards.** Another nation's match: Auto only. **The court's result decided his match**, and a repeat changed nothing. A match left part-way was finished from its last score. **At the day's end the other 10 were decided by the engine**, and the quarter-finals were made for the next day.
- **The rest:** one day for each stage (24, 25, 26, 27 Nov); 20 matches, each dated its own day; six medallists; **the podium ceremony queued**; Club News; the schedule page reads 4 days and 20 matches.
- **Second window:** the day his contract ended, offers came at once. At Legend level they were stronger nations paying less (New Zealand #11/53, $3,000, against $7,500/$9,000/$9,000 at Local Coach). **5 years accepted.** "Decline them all" works.
- **`harness/olympics-tournament.mjs` 24/24** (now waits for the medals; the pairs are compared with those at the draw). `trophies` 9/9, `board-review` 60/60, `trademark-renames` 14/14, `schema-drift` 12/12, `flags` 18/18, alone. `olympic-qualification` reads the built frontend, so it runs in Part C's full build.

**Decisions (A4):**
- **Only three days lie between round 70 (23 Nov) and the World Finals semis (27 Nov),** and the brief wants four Cup days (groups, QF, SF, medal day). The medal day is therefore 27 November, the World Finals semis' day. The Cup's bronze and gold are decided at that day's end, separately from the club semis. Groups, QFs and SFs fall between the two rounds, as asked.
- **The Cup's pairs are set at the draw** (end of 23 Nov), so "picked by the Cup's first day" means before the draw. The page locks then.
- **Unwatched matches are decided "at the end of their day"**, which is the end of that game day's processing, when the player moves the calendar on. A match watched part-way and left is finished by the engine from the court's last score.
- **"Before or after a Cup":** offers come in the 6-month window before each Cup and the day a contract ends, whichever comes first. Declined, the next offers come with the next window or contract end.
- **"Better manager record means better nations":** the record is his manager level, the game's one standing measure (`teams.manager_rep_points`). Each level opens a band of the strength ranking.
- **Pay goes to the manager's salary line:** the club's "Manager salary" ledger line is a club expense, so the national pay is kept on the job (`paid`), shown on the Profile and the National Team page, and added to Career Earnings, never to the club's money.
- **The camp** is applied once, at the draw: training adds +2 to the pair's Cup rating and +10 fatigue; recovery sets fitness 100 and fatigue 0. AI club players' fitness and fatigue stay off (item 4c), so recovery shows only on career players.
- AI nations' pairs now also leave out an injured AI-club player (they had not), so every nation plays its best two **fit**.

### A5. Medal ceremonies

**Done; the suite passes alone, and the podium renders are below.**

**The World Finals bronze** (`utils/worldFinalsBronze.ts`, a pure rule, and `worldTour.ts`):
- The two losing semi-finalists are compared on the World Tour ladder: **ranking points, then wins, then set difference, then rally points won minus lost.** The higher one takes bronze.
- **Only if they are dead level on all four** is a third-place match played (tier "World Finals Third Place"), on the final's day, by the same engine. It is left off the ladder: no prize and no points.
- Only the bronze pair's club gets "World Finals bronze {year}" in its Trophy Cabinet (`seasonTrophies.ts`). Before, both losing semi-finalists got one. The World Finals page shows a bronze card.

**The continental ladder cups** (`components/ladder-cup.tsx`): a gold, silver and bronze cup beside the top three once a season's ladder is final, on the Continental Ladders page and in its history of past seasons. No 3D ceremony.

**The ceremony** (World Finals and Empire Nations Cup):
- **When:** a row in a new table, `career_ceremonies`, is written when the Cup's medals are decided (27 Nov of a Cup year) and when the World Finals final is decided (3 Dec). `/ceremonies/pending` gives the next unseen one, and `components/ceremony-dialog.tsx` (mounted in the shell) opens it on the Dashboard, the same interrupt as the Season Review, with the court in an iframe in ceremony mode (`/court?ceremony=<event>&year=`) and a **Skip** button. Skipped or watched, it is marked seen and doesn't open again. It plays every time, whoever is on the podium.
- **`/unity/ceremony-state?careerSaveId=&event=`** gives the 6 medallists (gold, silver and bronze pairs), each with place, name, nation, flag code, kit colours and skin tone, and the banner text: **"BEACH VOLLEYBALL EMPIRE WORLD TOUR"** or **"EMPIRE NATIONS CUP {year}"**. Cup players wear their nation's kit (A4's `national-kits.ts`), World Tour players their club's.
- **Unity** (`Assets/Scripts/CeremonyDirector.cs`): in the existing beach venue it stands the match down, builds a podium at the court with steps marked **1, 2, 3**, and stands the six on it: the court's four BeachPlayer (Beach Girl 05) players and two copies of them, each painted with MaterialPropertyBlocks exactly as in a match (kit and skin). Each wears a **medal**, a disc on a ribbon in gold, silver or bronze (`MedalHang`), has a **name plate with her nation's flag** (A2's PNG textures in `Resources/Flags`) and **waves**. A big banner behind them is painted at run time (`BannerPainter`) with the event's text. The camera frames the podium.

**The wave — what Rob's packs have:** none of the packs (Motion Cast VolleyballController, "Volley-ball animations", the Beach Girls pack) has a plain wave or a celebration clip. The closest is Motion Cast VolleyballController's **"10 - Rises from the chair and greets the audience" (no-root take)**, whose greeting is a raised-arm wave to the crowd. The ceremony loops that part of it, 4.63 s to 6.06 s of the clip (`Resources/Ceremony/CeremonyWave.controller` and `wave-range.txt`, made by `Assets/Editor/CeremonySetup.cs` in batch mode). Nothing is faked: it is the real clip, looped.

**Proof: `harness/ceremonies.mjs`, 34/34 alone** (run-all 98zx):
- **The rule:** points decide; points level, wins; then sets; then rally points; all four level, a third-place match.
- **2026:** Bondi Beach Legends (65 points) took bronze over Tokyo Surf Samurai (62); no third-place match. The ceremony waited for the Dashboard (ready 3 Dec); banner "BEACH VOLLEYBALL EMPIRE WORLD TOUR"; gold Paris Sables Royales, silver Auckland Pacific Diamonds, bronze Bondi Beach Legends; three places on steps 1, 2, 3, two each, every one with a flag (fr fr nz ar au au), a kit and a skin tone, in club kits. Skipped, it didn't open again.
- **2027, the two set dead level:** a third-place match was played on the final's day (Durban Indian Ocean Tides 1-2 Buenos Aires Pampas Storm), its winner took bronze and the bronze step, and it is not on the ladder.
- **2028, the Nations Cup:** the ceremony waited once the medals were decided (27 Nov), banner "EMPIRE NATIONS CUP 2028", Papua New Guinea, Greece and South Korea in their national colours, with flags pg pg gr gr kr kr; the places are the Cup's medals.
- `trophies` 9/9 (only the bronze club's trophy).

**Podium renders** (`scripts/webgl-proof/ceremony-shots.mjs`, the real Unity build in headless Chromium with the GPU, on the suite's kept save; `docs/proof-1.1.3/podiums/`, three frames each, 6 s apart):
- `podium-world_finals-2026-*.png` and `podium-nations_cup-2028-*.png`: steps 1, 2, 3; six medallists in kit (club kits for the World Finals, national colours for the Cup: Papua New Guinea black and red, Greece blue, South Korea white and red); gold, silver and bronze medals; the arms in a different place in each frame (the wave); a flag by every name plate; the banner. Court log: `[Ceremony] podium built: world_finals 2026, 6 medallists, banner 'BEACH VOLLEYBALL EMPIRE WORLD TOUR'` and the same for `nations_cup 2028 … 'EMPIRE NATIONS CUP 2028'`. No errors.
- **Found by the first render and fixed:** the club or nation name floated above each step, over the banner's words. It is now on a low navy sign in the sand in front of each step. Unity re-exported, rendered again (the PNGs above are the second render).
- **The World Finals podium shows each club's pair at the time of the ceremony.** In the game that is the night of the final. On this proof save, which is at the end of 2028, the 2026 podium shows the clubs' 2028 pairs (Bondi Beach Legends now has Alina Kora and Mere Raitoga, not the Australians who won bronze in 2026). In the game the ceremony opens the night of the final, or on the next Dashboard visit, so the pairs are the ones that played. Only a save kept for years before its ceremony is watched, like this one, shows newer pairs.

**Found, not fixed (old data, not 1.1.3's):** the Nations Cup gold pair reads "ALINA KORA, ALINA KORA". They are two different players: world-roster player 81 (Bondi Beach Legends) and player 411, made from continental-pool player 105 (Dubai Sand Aces), both from Papua New Guinea with the same name. **The 1.1.2 starter DB already has 28 continental-pool players named like a world-roster player**, and a 3-season career had 86 such pairs of names (including generated youths). Renaming pool players changes every save's AI squads, so it is left for Rob to decide (see "Not done").

### A6. Patch notes and rules

**Done.**
- `docs/UPDATE1-1.1.3-PATCH-NOTES.md`: every Part A item in the plain style of 1.1.1's and 1.1.2's notes (coach a nation, the Nations Cup day by day, medal ceremonies, the AI clubs' limits, flags, new staff faces). No "Olympic", "FIVB" or brand names.
- **Version 1.1.3** in the root `package.json`, the one electron-builder reads (the app's About and the installer). The workspace packages stay 0.0.0, as before.
- **Rules page** (`pages/rules.tsx`), new or changed sections: "The Empire Nations Cup, day by day", "National coach", "Medals and the podium" (the bronze rule, the third-place match, the ceremonies, the ladder cups), and the AI clubs' scouting and bid limits in the transfer rules.

## Part B

- **The merge into `update-1`:** not done, as the brief says. It is for after Rob uploads 1.1.3: merge `release-1.1.3` into `update-1` in `C:\Users\rbonn\Documents\Volley-Ball-Empire`, then push.
- **The Steam script:** `steam/app_build_5233750-1.1.3.vdf`, ContentRoot `C:\build\vbe-1.1.3\win-unpacked\`, **SetLive "default"**, the Desc naming the final commit. **Not run.**
- **The old worktrees** (`git worktree list` in the main repo, 23 Oct). **Nothing deleted.**

| Worktree | Branch | Last commit | Notes |
|---|---|---|---|
| vbe-before | (detached) | f51d2c85 | 1 Oct 2026; 499 changed files not committed |
| vbe-u3 | feat-job-market | 832596a5 | |
| vbe-u6 | feat-ai-buyable | 55d91321 | |
| vbe-try | try-02oct | 29cdfaa7 | |
| vbe-mergetrial | (detached) | b7de2bfa | 1 changed file not committed |
| vbe-staff | feat-staff-injuries | 98b969ad | |
| vbe-controls | feat-manual-controls | 8e32cb93 | |

## Item table

| Item | What | Commit | Proof |
|---|---|---|---|
| A1 | Staff portraits: 49 installed, 82 refused (logos) | 90a17739 | ai-staff 31/31, junior-medics 12/12, installer 15/15, live-save copy |
| A2 | Real flags: flag-icons, <Flag>, every nationality resolves | bf8104ac | flags 18/18; screenshots in Part C |
| A3 | AI scouting and buying limits (10 a season, 2 at one club), counted from ai_market_moves | da1c34fb | ai-market-limits 19/19; transfer-window, ai-buyable, counter-offer, salary-cap, manager-faces |
| A4 | The Nations Cup over days, watchable on the court in national colours; the national coach job | 04dd6a52 | nations-cup 45/45; olympics-tournament 24/24; trophies, board-review |
| A5 | Medal ceremonies: the podium (Unity), the World Finals bronze rule, the ladder cups | 4c656682 (Unity dd0a487) | ceremonies 34/34; trophies 9/9; podium renders |
| A6 | Patch notes, version 1.1.3, rules page, the Steam script | (this commit) | rules page sections, read in Part C |
