# 1.1.1: the Clubs page, the transfer window, perks and the calendar: status

Brief: `docs/UPDATE1-1.1.1-BRIEF.md`. Branch **update-1**, on top of 1.1.0 (`3592767f`, BuildID 25976250). Nothing pushed, nothing uploaded to Steam, `main` and `launch-final` untouched, Rob's save never opened.

*Written as the work goes. The newest report comes first (the night of 17–18 October), then 17 October's, then the summary table and the parts.*

## 17–18 October overnight: Rob's on-screen check (read this first)

**Where it stands:** 
- **All seven items are checked.**
  - Fixed: 1 (the name), 2 (continent names), 3 (one tier rule), 4 (old injuries carried over) and 7 (AI managers for older careers).
  - Not faults: 5 (Lima) and 6 (Bangkok) are carried over from 1.0. Under 1.1.1's rules they put themselves right.
- **The full build passed 126 of 127 suites.** The one failure is a check that depends on how the season goes; it passes alone, twice.
- **The package:** 1.1.1 repackaged from `15c60557`. The proof passes, the exe reads 1.1.1, and a 1.1.0 save still loads (17/17).
- **TEST 1.1.1** is refreshed from Rob's real save. The original is untouched, and his earlier test play is kept.
- **The Steam script** names `15c60557`. **Not uploaded.**

**New for Rob to decide (nothing changed for these):**
1. **A brand-new career starts some AI clubs over the cap** from their generated squads: in tonight's proof career, Miami $62,000 and Bali $69,846 on 22 Feb. Nobody signed them over, and like Lima they can't sign or renew until they're back under.
2. **Thirty-season careers run short of players.** In the build's 30-season career, by season 24 there were no free agents and only 107 seniors across 60 AI clubs.
   - The suite's manager, who never improves his squad, was sacked by his board for two failed seasons.
   - The job market then gave him an AI club with one player and nobody to sign, and that club sacked him for having fewer than two players.
   - The suite tries again for this reason, and its second career played all 30 seasons. Retirements outpacing new seniors is worth a look in 1.1.2.

How it was checked: every item was read in the code, then reproduced on a **copy** of Rob's TEST 1.1.1 save (game date 13 May 2026), with the server run on that copy. The fixes were confirmed the same way. Rob's real save was never opened.

| # | What Rob saw | What it was | What changed |
|---|---|---|---|
| 1 | "Clubs" sits under "Club" | Wording | **"Other Clubs"** in the side menu, the page title and its back button, the Rules topic ("The Other Clubs page"), the line about youth deals, the Player Market's refusal message, and the patch notes. The address stays `/clubs`. |
| 2 | Continents as code (`south_america`) | The page printed the stored key, though the game has a helper for names (`continentLabel`) | The list, its Continent sort, and each club's page now show South America, Africa & Middle East, Asia… |
| 3 | Every club "Bronze", his Dashboard "Silver" | **The Other Clubs page was wrong.** The Dashboard shows the higher of the tier this season's points reach and the tier the club is paid at this season (the 30 Sep rule, Q-1: an Established career is paid Silver from day one). Other Clubs showed the points tier alone. | **One rule for every screen** (`shownTier`, `utils/tierQualification.ts`): the Dashboard, the list and each club's page. A club's paid tier is the one it is really paid at: last season's points tier, or for a first season the difficulty's starting tier (the player's) or Bronze (an AI club's, as the game pays them). Rob's club now reads Silver on both screens. |
| 4 | Injuries 0 for every club, 18 matches in | **The column was right:** it counts this season's injuries in `career_injuries`. Rob's season was played on 1.0, where AI players were never injured. His own club's one injury (Nyasha Ncube, 26 Feb) sat in 1.0's old `injury_history` table, which nothing has read since night 2. On a copy, 25 more days on 1.1.1 recorded injuries at 8 clubs. | 1.0's injury records are carried into `career_injuries` once, when an older save loads (`carryLegacyInjuryHistory`). Rob's club now shows 1, and the Medical page and the reconstruction rule count it too. AI clubs stay 0 for this season: they had no injuries in 1.0. |
| 5 | Lima Pacific Soarers $71,245 of $60,000 | **The existing-save rule, not a bug.** Ashley Carter ($24,500) moved from LA Beach Legends to Lima on 7 May with no transfer record; every 1.1.1 move writes one. That was 1.0's AI transfer, before any salary cap. | Nothing. Under 1.1.1 no one is forced to sell: Lima keeps her, but can't sign or renew over the cap. It comes back under as contracts end (all three run to 31 Dec 2027). |
| 6 | Bangkok Palm Beach Stars on 2 seniors | **Not a fault.** 56 of the 60 AI clubs had 2 seniors, as 1.0 kept them. 1.1.1 tops every club up to 3 at its weekly step (when it can afford one under the cap), and Rob's save stops on 13 May, before its first one. On a copy, the 14 May step signed a third senior at 52 clubs, Bangkok included; 4 stayed on 2 because of the cap or the bank. | Nothing. |
| 7 | Bangkok "Manager's job vacant" | **A fault, at every AI club, not just Bangkok.** AI managers are appointed at a new career's Day 1 draft, at a season's end, or when the job market opens. Rob's career is older than them, so all 60 jobs read vacant until his season ended. | Careers older than the AI managers get them when the save loads (`appointManagersForOlderCareers`), by the new-career rule (the free face out of work longest). A real vacancy stays open. On a copy of Rob's save: 60 appointed, Bangkok's is Min-jun Kim. |

**Found on the way, and fixed.** Adding the tier imports to the Other Clubs route crashed the server at load. `utils/worldTour.ts` imports `routes/matches.ts`, which imports `utils/seasonPhase.ts`, which read `WORLD_TOUR_EVENT_ROUNDS` from `worldTour.ts` before it was set. It had only worked because of the order modules happened to load in. The round list and the two finals tier names now live with the schedule (`data/worldTour.ts`, which imports nothing), and `worldTour.ts` re-exports them.

**New checks (clubs-page, 25/25):**
- his row's tier equals his Dashboard's;
- "Other Clubs" in the menu and title;
- continents shown by name;
- a career made older on purpose and restarted gets all its AI managers and its old injury, and a second restart carries nothing twice.

The settings suite checks the renamed Rules topic.

**Suites run alone after the fixes:** clubs-page 25/25, settings 40/40, scouting-limit 27/27, dashboard-standing 12/12, manager-faces 56/56, ai-job-market 32/32, injury-treatment 17/17, reconstruction 16/16, injured-list 17/17, condition 27/27, commentary-she 7/7, market-order 4/4.

### The full build

`pnpm run build`, 21:51 to 00:11, timestamped and watched.
- **Watching:** the watcher flagged failures and any suite over 30 minutes, and I checked progress at least every 10 minutes. The PC was kept awake throughout, and nothing stalled.
- **Typecheck, build and sync:** clean.
- **126 of 127 suites passed.**
- **The one failure:** ai-job-market's "when the window opens the AI boards' sackings are announced" found no AI manager sacked this time.
  - The suite gives every AI manager one failed season. A manager is sacked only if their club then fails again, which depends on results; usually one is.
  - Alone it passed twice (32/32, one sacked each time).
  - Tonight's changes don't touch the AI boards' judgement, and the check was left as it is.
- **Long suites (none stalled):**
  - youth-rebirth: 16 min 10 s (30 min yesterday, before the speed-up).
  - ai-club-economy: 27 min 46 s, 22/22.
  - season rollover: 55 min, passed. Its first 30-season career ended in season 24 (see "for Rob to decide", item 2) and its second played all 30. Each season was checked as it ran.

### The package, its proof, the Steam script, the TEST copy

- **The package:** `C:\build\vbe-1.1.1\win-unpacked`, from `15c60557`. The exe's Properties read **1.1.1** (FileVersion 1.1.1, ProductVersion 1.1.1.0).
  - The packaged server has the tier rule and the two load-time repairs, and the client says "Other Clubs".
  - After-pack checks: OK.
  - The previous proof is kept as `proof-898cf287`.
- **The package proof:** a throwaway profile, screenshots in `C:\build\vbe-1.1.1\proof` (31). It passes start to finish: 26 steps, no error, Rob's save folder untouched.
  - Draft, a match on the 3D court (2-0, Continue), sort menus.
  - **Other Clubs:** 61 rows, every sort, an AI club's page.
  - Buy-ahead, the Part 10 checks, junior medics on the Medical Market, and Exit.
  - The Other Clubs screenshot shows the new title and menu entry, continents by name ("Africa & Middle East", "North America"…), Sydney Riptide at **Silver** and the others at Bronze, and injuries counted.
- **A 1.1.0 save** (a copy of the genuine one from 16 Oct) on the new package: 17/17.
- **TEST 1.1.1** is refreshed from Rob's real save the same safe way.
  - The game was closed, the save had no working files, and the copy is byte-identical (SHA-256 checked before and after). The original's date is still 16 Oct 2:00 PM.
  - Rob's real save hasn't changed since the first copy, so the TEST copy starts from the same point as before.
  - His test play from last night is kept in `C:\vbe-test-1.1.1\previous-test-play-17oct`.
  - Started once from the Desktop shortcut on the new package, it opened his profile from the copy, then closed cleanly.
- **The Steam script:** `steam/app_build_5233750-1.1.1.vdf`, Desc "v1.1.1 Clubs page, transfers, staff budget, junior medics (update-1 15c60557)". ContentRoot `C:\build\vbe-1.1.1\win-unpacked\`, SetLive empty.
  - The commit after `15c60557` holds only this report and the script.
  - **Not uploaded.**

### For tomorrow: Rob's 1.1.2 portraits (read only, nothing installed)

| Folder | Pictures | Needed |
|---|---|---|
| staff portraits 1.1.2\head coach | 10 | 0 |
| staff portraits 1.1.2\assistant coach | 11 | 0 |
| staff portraits 1.1.2\doctor | 13 | 5 |
| staff portraits 1.1.2\registrar | 12 | 14 |
| staff portraits 1.1.2\physiotherapist | 12 | 6 |
| staff portraits 1.1.2\Physio Assistant | 12 | 16 |
| staff portraits 1.1.2\scouts | 61 (60 different) | 55 |
| staff portraits\scouts | 10 | (the 10 already in the game) |

- **Duplicates:** every picture was compared with every other, 302 in all, the new folders and all of "staff portraits".
  - `staff portraits 1.1.2\scouts\…(15).png` and `…(16).png` are the same file. Install one.
  - The only other pair is the surgeon picture already skipped on 17 Oct.
  - Every other pair differs clearly: the closest are 5.5 out of 255 on a 64×64 comparison, and they are different people.
- **The 41 medics are covered.**
  - Rob made 49: Registrars are 2 short of my 14 and Physio Assistants 4 short of my 16, but there are 8 extra Doctors and 6 extra Physios.
  - The game keeps 5 back per role, and a Registrar counts as a Doctor, a Physio Assistant as a Physiotherapist. Per role that is +25 Doctor-role against 19 needed, and +24 Physio-role against 22.
  - The 8 January deal, simulated 20,000 times with Rob's numbers: every AI club gets a doctor or physio, and at least 5 of every grade stay on the market, in 99.2% of new careers. My 41 managed 99.1%.
- **Scouts are covered:** 60 different new pictures plus the 10 already in the game makes 70, against the 65 needed for every AI club to have one with 5 left. That's 5 to spare. AI clubs don't hire Scouts yet; that's a 1.1.2 change.
- **Coaches:** none were needed, and Rob made 21 (10 Head, 11 Assistant). They give slack: today a coach the player signs before 8 January leaves an AI club without one.

## 17 October: the morning's work

**Where it stands:**
- **1.1.1 is packaged** at `C:\build\vbe-1.1.1\win-unpacked` from `898cf287`.
- **The package proof passes** on a throwaway profile.
- **A copy of a 1.1.0 save loads** and plays on.
- **AI clubs over the cap that signed anyone: 0** in every season of the soak.
- **The 37 junior medics are in.**
- **The full build ran, watched:** 121 of 126 suites passed first time. Every failure is fixed and passes alone, and rollover's slowdown is found and fixed.
- **The Steam script is ready. Nothing is uploaded.**

**For Rob to decide (nothing was changed for these):**
1. **AI transfers are rare** now that the cap holds: 0–3 AI players bought ahead a season (none at all in one 5-season re-run), against 24–39 through the hole (section 2).
2. **Nothing limits AI bids per club or per player.** There are few bids now, so the most on one club or one player in a season was 3.
3. **Rollover and ai-club-economy run past 30 minutes by design.** They play about 60 and 30 seasons; neither hangs (section 4).
4. **About half the AI clubs have no coach-and-medic pair:** 28–38 of 60 a season in the soak. Every one of them could afford one; there aren't enough staff on the market for 60 clubs.

### 1. Last night's "hung" build: the PC went to sleep

- **What happened:** no suite hung. Windows' own log (Kernel-Power) shows the PC sleeping at 22:24:46 and waking at 07:03:33. Every process stopped while it slept, so the build sat still for 8½ hours and then carried on.
- **The check:** the suite that was running (the season rollover) was run alone on its own, and again after a smoke run. It runs normally both times, about 32 s a season.
- **The fix:** this session now asks the app to keep the PC awake while it works (`request_keep_awake`). Nothing in the game or the harness was wrong.
- **The watch:** this morning's build was timestamped line by line. A watcher flagged any suite running more than 30 minutes and any failure. What it found is in section 4.

### 2. AI clubs over the cap: now 0 in every season

Last night's two fixes (the committed wage bill, and a weakest player counted as gone only if her contract still runs on the arrival day) were not enough. The soak still had 2, 16, 3, 7 and 5 AI clubs over the cap that had signed someone. A day-by-day trace found two holes:

1. **The arrival-day trim never trimmed.** `wageCapRefusal` passes any change of $0 or less, so "is the club under the cap?" asked as `fitsUnderCap(bill, 0)` was always yes. It is now a plain comparison.
2. **Room counted twice.** A bid is checked against the club's bill on the arrival day, so a contract ending before then makes room (Rob's rule, AC-8 A). The club then renewed that player at the same wage, which was always allowed. Example: club 60 bid in January with all three of its seniors' contracts ending 1 July. Its bill on 7 December was $0, so it agreed $41,975. It renewed all three, and was at $76,320 when she arrived.

**The rule now (every club, the player's too):** renewing a contract that ends before a player bought ahead arrives must fit under the cap on that day, even at the same wage. Otherwise, as before, only a raise is checked. The Rules page ("Buying ahead") and the patch notes say so, in one line: *that room is spoken for*.

**AI clubs:**
- An AI club counts that room only for players it can do without. It must still field two until the new player comes, so it counts the cheaper of two ways: keeping its cheapest such players, or the cheapest healthy free agents.
- A club short of two keeps room for the cheapest free agent who would make two. Then its first signing can't take all the room.

| Soak (5 seasons, Medium) | s1 | s2 | s3 | s4 | s5 |
|---|---|---|---|---|---|
| AI clubs over the cap that signed anyone (before this morning) | 2 | 16 | 3 | 7 | 5 |
| **AI clubs over the cap that signed anyone (now)** | **0** | **0** | **0** | **0** | **0** |
| over it only through a promoted youth (C-5, allowed) | 7 | 5 | 2 | 4 | 5 |
| AI clubs with 3 seniors | 49 | 53 | 50 | 51 | 52 |
| AI players bought ahead (before) | 24–39 a season | | | | |
| **AI players bought ahead (now)** | 0 | 0 | 3 | 2 | 2 |
| AI bids on his seniors / players he lost | 0/0 | 0/0 | 1/1 | 0/0 | 0/0 |

**For Rob: AI transfers are now rare.**
- Nearly all the AI buying ahead (24–39 a season) went through hole 2. AI squads sit close to the $60,000 cap, so once the hole is shut there is little room to buy.
- The AI still buys (0–3 a season, more from season 3, when contracts have spread out). The suites that check AI-to-AI buying give clubs room in their own databases (ai-buyable, six clubs on $10,000 wages), and transfer-window does the same and counts over the whole year (7, 1 and 6 AI-to-AI bids in three runs). One 5-season soak re-run had no AI bids at all.
- **If Rob wants more movement between AI clubs, that's his call; nothing was changed for it.** The levers: a higher cap, lower AI wages, or shorter AI contracts.
- **The soak now also records:** the first day any AI club goes over the cap with a senior signed that year (none), and the club-days an AI club had fewer than two seniors to play (14 in 5 seasons, against 17 before the free-agent rule).

**Suites run alone after the fix:**

| Suite | Result |
|---|---|
| salary-cap | 16/16 |
| ai-injuries | 16/16 |
| transfer-window | 19/19 (new check: the renewal is refused, naming 7 December) |
| ai-buyable | 25/25 |
| contract-renewal | 31/31 |
| counter-offer | 10/10 |
| injured-list | 17/17 |
| staff-budget | 18/18 |
| junior-medics | 12/12 |
| settings | 40/40 |

ai-club-economy was left to the full build: 22/22 there (section 4).

### 3. Junior medics

- **37 new medical staff, with Rob's portraits:** 14 Registrars (Doctors), 10 Physio Assistants (Physiotherapists), 13 Orthopaedic Surgeons (Medical Specialists).
  - Installed by `scripts/install-staff-portraits.cjs --juniors` from `docs/junior-medic-portrait-names.json`, into `public/images/staff/medical_doctor` (staff-22 to 35), `physiotherapist` (staff-22 to 31) and `medical_specialist` (staff-21 to 33).
  - `orthapaedic surgeon\...mid-chest (10).png` was skipped as a duplicate.
  - Ids are 10001 up, so a 1.1.0 save gets them on first load.
- **The constants:** one block, `JUNIOR_MEDICS` and `JUNIOR_PROMOTION` in `lib/db/src/schema/staff-roles.ts`.

| Grade | Works as | Skill | Wage a month | The full role |
|---|---|---|---|---|
| Registrar | Doctor | 62–78 | $6,237–$7,846 | Doctors: skill 84–92, $14,083–$15,667 |
| Physio Assistant | Physiotherapist | 50–66 | $4,605–$6,319 | Physios: skill 57–95, $8,750–$16,250 |
| Orthopaedic Surgeon | Medical Specialist | 84–98 | $16,195–$18,975 | Specialists: skill 70–96, $11,333–$16,500 |

- **Wages:** a junior's wage is 60% (`wageShare`) of the full role's wage for her skill. Below the role's lowest skill that wage falls in proportion, so Registrars come out at about half a Doctor's. A Surgeon's is 115%.
- **Promotion:** a Registrar or Physio Assistant is promoted on a fixed day between 1 and 3 years after joining a club (a move starts the clock again).
  - She gets the full role's title, +10 skill (Registrar) or +12 (Physio Assistant), and the full role's wage for her new skill (never less than she was on).
  - Club News says so. The staff table keeps her as she was, so another career starts her as a junior again.
- **They treat as their role**, count under the staff budget, and AI clubs hire and promote them by the same rules (`utils/juniorMedics.ts`, daily).
- **Cards read** "Registrar · Team Doctor" on the Medical Market, the Staff page and the Staff Market.
- **Words:** Rules topic "Junior medics", patch notes "Junior medics". settings checks twenty-one topics.
- **Suite:** `harness/junior-medics.mjs` (run-all 98za), 12/12. It checks:
  - the 37 and their portraits;
  - cheaper and weaker, a Surgeon dearer and stronger;
  - a Registrar hired as a Doctor under the budget;
  - not promoted at 300 days, promoted at 3 years with the title, skill, wage and news;
  - an AI club's Physio Assistant promoted too.

### 4. The full build

`pnpm run build`, 08:27 to 11:16, timestamped line by line and watched.

- **Typecheck, build and sync:** clean.
- **126 suites ran. 121 passed in full.** Four failed one or two checks each, and rollover was stopped (below). Each failure is understood, fixed, and passes alone:

| Suite | In the build | Why | Fixed | Alone after |
|---|---|---|---|---|
| condition (R-50) | 25/27 | By chance: at fitness 0 a match gave one of the pair a serious injury, which lowers a stat. The check read the stats after the match. Match-day substitution then left one starter, so the panel said "Squad Incomplete" instead of "Not Enough Fit Players". | Reads the pair's stats before the match; puts two starters back before that scene | 27/27 (three runs) |
| wizard-career-economy (R-67) | 11/12 | Counted 123 portrait staff; there are 160 with the 37 juniors | Counts 160 | 12/12 |
| nationality-countries | 6/7 | **A real gap:** Pakistan wasn't in the game's nation table, so the two Pakistani junior medics had no flag or country | `iso("PK", …)` in `continents.ts`; every starter nationality now resolves (556 checked) | 7/7 |
| ai-injuries (4c) | 15/16 | By chance: since the night-2 injured list, a club with two out 6 weeks may sign or promote cover and play. The check only allowed walkovers. | Allows a match played while the club had two fit besides the injured pair | 16/16 (three runs) |
| season rollover | stopped at 37 min | See below | | 90/90 (39 min 40 s, nothing else running) |

Also found by this build, before its own run reached them:
- **staff-portrait-install:** my junior change to the installer numbered a normal re-run's pictures after its own earlier ones, so a re-run made duplicates. Fixed: a role's run numbers after its seeded staff again, as before; a junior grade numbers after everything else in the folder. A dry run of the juniors maps to the same 37 pictures. 15/15 alone, and 15/15 in the build.

Found while re-checking after the fixes, and made reliable:
- **staff-budget:** waited only 60 days for his club's first win (four or five matches) and once lost them all. It now waits up to 150 days: 18/18 twice.
- **transfer-window:** AI-to-AI bids over a year fell to 0 in one run. AI buying is rare now (section 2). Six AI clubs get room in its own database, as in ai-buyable: 19/19 twice (1 and 6 bids).

**The 30-minute rule:**
- **youth-rebirth:** 29 min 40 s, 19/19. It runs 30 seasons in each of 3 regions.
- **ai-club-economy:** 41 min 25 s, **22/22**. That includes the academy check that was open last night (21/22).
  - Checked while it ran: 14 of 30 seasons at 19 minutes, 22 at 30 minutes, steady. Each day averaged 117 ms against 104 ms on 16 October.
  - Not stopped, since it was advancing and is the main check of the AI economy changed this morning. Its slowdown has the same cause as rollover's, fixed below. Alone after the fix: **22/22 in 33 min 17 s**, with rollover and the package proof running beside it.
- **Season rollover:** stopped at 37 minutes. Its 30-season arc (L-01) was running at about 58 s a season, against about 32 s last night.
  - **Why:** traced by timing every database transaction by call site over 200 game days. One weekly step dominated: the AI clubs' transfer step, about 500 ms a game week.
    - Each of the 60 buyers rebuilt every AI squad (`aiSquadsTx`), his club's bid-able seniors, and each candidate's price and open deal.
    - Its cap check and `canSellTx` rebuilt the squads again.
    - Before this morning most clubs had a deal open and skipped all that. Once the cap holes were shut, almost none did.
  - **The fix:** that work is done once a week, and again only after a bid. The cap bill and `canSellTx` take the squads already built. What each club chooses is unchanged: the saved values only change when a bid is made, and they are worked out again then.
  - **Result:** the weekly step is about 130 ms; 200 game days took 15 s, against 24 s before.
  - **After the fix**, rollover alone (with ai-club-economy and the proof running beside it) passed **90/90** but took 60 minutes.
    - Its first 30-season career was sacked in season 24 with one player. It had lost ten academy graduates to AI bids in five seasons.
    - The walk never answers a bid (an unanswered bid takes her after 14 days). Now that AI clubs aren't tied up in each other's deals, his good graduates draw bids.
    - The suite allows three attempts, and the second played all 30 seasons.
    - The walk now turns bids down, as economy, job-market, olympics-tournament and youth-intake already do. Timed alone with nothing else running: **90/90 in 39 min 40 s**, the 30-season career played through with no sacking (31 s a season early on, about 43 s by its later seasons as its database grows).
- **Both are long by design.**
  - Rollover plays about 60 seasons (six 5-season careers and one of 30); ai-club-economy plays 30 seasons of the whole world.
  - Neither hung; each advanced steadily when checked.
  - **Rob decides** whether 30 minutes is the line for these two. They can be shortened with `LONG_SEASONS` / `SEASONS`.

### 5. The package, its proof, a 1.1.0 save, the Steam script

- **The package:** `C:\build\vbe-1.1.1\win-unpacked`, from `898cf287` (code), built with `electron-builder --win dir`.
  - The exe's Properties read **1.1.1** (FileVersion 1.1.1, ProductVersion 1.1.1.0).
  - The packaged starter database has 280 staff, 37 of them junior medics.
  - The Unity court's compressed data (`.br`) is in, unchanged since 1.1.0.
  - After-pack checks: no `-wal`/`-shm`, no `steam_appid.txt`, steamworks unpacked.
- **The package proof:** `scripts/webgl-proof/package-proof.mjs` runs the real exe on a throwaway profile (`--user-data-dir` in Temp). Screenshots are in `C:\build\vbe-1.1.1\proof`. **It passes, start to finish:**

| Step | What it saw |
|---|---|
| Title screen, Day 1 draft | Advance refused during the draft; three picks; the draft closes |
| The court | The first match on the 3D court, with Pause and Resume; the result recorded (1-2), Continue back to the dashboard |
| Sort menus | Market, Staff and Medical |
| Clubs page | 61 rows, his own marked; every sort (richest, poorest, most successful, injury-prone, continent, name); an AI club's Players (3 seniors, 3 youths) and Staff & Medical |
| Buy-ahead | Valeria Mamani from Honolulu Aloha Warriors: agreed, fee $16,900, "arrives 7 Dec 2026 ($26,385 a month, 1 season, perks: none)", listed on the Team page's Transfers tab |
| Part 10 | The Watch List pill in the top row (not the second); a youth card with the full-width Scout button and the star; Remove / Scout / Buy on Watch List cards (seniors and youths); the Staff Market's Medical pill opens the Medical Market; a Scout with two reports refuses a third ("Ana Vieira is working on 2 reports (the next is ready on 27 Feb 2026)…"); on the Player Market the two in progress come first; the Staff page shows her two reports |
| Junior medics | The Medical Market's cards read "Registrar · Team Doctor"; 2 Registrars, 1 Physio Assistant and 11 Surgeons still on the market on 22 Feb (the AI clubs hired the rest on 8 January); the staff budget line "$7,667 of $39,500 a month — $31,833 room left" |
| Exit game | Asked; Cancel keeps the game; Exit closes the app itself (0.2 s) |

Rob's save folder was checked before and after: untouched.

The proof itself had three faults, found on its first runs and fixed (screenshots of the first run kept in `proof-stopped-at-clubs`):
- the Clubs page step sent the page `"\t"` and `"\n"` inside a template string, real tab and newline characters, so its code didn't parse and the proof stopped there. That step had been added in Part 8 and never run on a package until today;
- it looked for the youth card's Scout button inside the portrait (`.closest(".overflow-hidden")`), not the card;
- it sent the scouts through the game's routes and then read the page's cached lists. It now reloads, and closes the match-day box before the screenshots.
- **A 1.1.0 save:** a copy of a genuine 1.1.0 save (made by the 1.1.0 package's own server with `scripts/make-110-save.mjs`; never Rob's), loaded by the packaged 1.1.1 server. **17/17:**
  - it boots, the career loads, and the team and money are there;
  - the Market, Staff, Medical, Clubs, Transfers, main sponsor, scouting work, Contracts and annual calendar pages all answer;
  - the 37 junior medics are added (the `grade` column too), with career state;
  - the `scouting_jobs` and `transfer_deals` tables are added;
  - three main-sponsor offers wait at the $39,500 first-season budget;
  - it plays on 30 days (5 matches) with no server errors.
- **The Steam script:** `steam/app_build_5233750-1.1.1.vdf`.
  - ContentRoot `C:\build\vbe-1.1.1\win-unpacked\`, SetLive empty, Desc "v1.1.1 Clubs page, transfers, staff budget, junior medics (update-1 898cf287)".
  - **Not uploaded.** Rob's Steamworks folder was not touched or opened. His SDK copy of the scripts would need this one for an upload.

### 6. Commits this morning

| Commit | What |
|---|---|
| `ae383571` | Junior medics; the AI clubs' cap holes |
| `898cf287` | What the full build found: the weekly AI transfer step's speed, Pakistan, the portrait installer's numbering, four suites; **the package is built from this** |
| `938ba1b3` | The proof's three fixes; rollover's walk turns AI bids down; staff-budget and transfer-window made reliable; salary-cap and ai-injuries source checks; the Steam script |
| (the next) | This report |

Nothing pushed, nothing uploaded to Steam, `main` and `launch-final` untouched, Rob's save never opened, Rob's Steamworks folder untouched.



## Summary

| Part | Status | Commit |
|---|---|---|
| 1. The Clubs page | done | `59481c47` |
| 2. The transfer window | done | `f2da0bec` (code, Parts 2-4), suite in the same commit |
| 3. One chance to keep her | done | `7e2cbec0`, `1c5ceb14` |
| 4. Perks | done | `00e9a2b0` |
| 5. AI clubs' youths | done | `78bfcf23` |
| 6. The calendar | done | `97deef35` |
| 7. Words | done | `26802392` |
| 8. Tests | done (one open finding, below) | (Part 8 commit) |
| 9. Full build, soak, 1.1.1 | done: full builds watched, package, proof, a 1.1.0 save (top of this report) | `15c60557` (package, 18 Oct); was `898cf287` |
| 10. Scouting limit, youth cards, Watch List, Medical pill, scouted first | done | (Part 10 commit) |
| 11. Staff budget (main sponsor) | done | (Part 10 commit) |
| 12. Academy Renew at a job-market club | checked: it no longer happens; a check now drives it | (Part 10 commit) |
| 17 Oct: AI clubs over the cap | done: 0 in every season of the soak | `ae383571` |
| 17 Oct: junior medics | done | `ae383571` |
| 17 Oct: what the full build found | done (rollover's speed, Pakistan, the installer, suites) | `898cf287`, 938ba1b3 |
| 17–18 Oct night: Rob's on-screen check (7 items) | done: 5 fixed, 2 carried over from 1.0 (not faults) | `15c60557` |

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
- A contract that starts in the window runs from 1 January of the next season, so a 1-season deal is a full season. This holds for every senior contract that starts in the window: a bid's, a counter's, and (found in Part 8) a free agent signed in December, who was getting a contract that ended a few days later.
- A bid skips the squad-size check. The window is open on her arrival, so room can be made then. If his squad is still full, she joins as an extra interchange.
- An AI club holding the player answers a bid at once. A bid from a club no one runs is agreed straight away.
- The fee is paid when the deal is agreed, and paid back if the move falls through before she arrives.
- **The injured-list clash.** Cover signed for an injured player can be released at any time once the covered player is fit. This applies to his club and to the AI clubs; outside the window, an AI club releases only cover. An AI club over its places trims in the window.
- The 6-month rule and the free first-week release are deleted. The old AI "sold at once" path (`aiClubSoldTx`) is replaced by bids.
- AI clubs bid for AI seniors and for his seniors held 365 days or more (from the contract's start date). Each buyer has one open deal at a time.
- AI bids: her wage x1.15, the bidder's own length for her rating, and perks cheapest first up to 10% of the wage.
- A buy's fee goes in the ledger as `transfer_fee`. A free agent's signing fee stays `signing_fee`.
- **Found by the old suites (Part 8) and fixed at the cause.** A player bought ahead from an AI club can leave it mid-season, the day after her contract ends. The club then had one senior until its weekly refill. It now refills that same day (`transfersDayTx` runs `keepAiSquadsTx`).
- **The same applies to a full AI club that buys ahead.** Its bid counts its weakest senior's wage as gone. She now goes the day the new player arrives, even outside the window, so the club is never over its places or its cap. A club that sells or releases on its own still waits for the window.

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

**Scouting limit and the Watch List (Part 10)**
- **What I found first:** a continental youth mission recorded which Scout went, but did not tie him up. He could still write reports, and could be sent on missions in other regions at the same time. Now a Scout away on a mission writes no reports and can't be sent on a second mission until he's back. Reports he had already started still finish; he isn't called back.
- **Who works on a report:** the best person of the right role who is on duty and has a place free.
  - players and youths: a Scout (as before)
  - staff and medical candidates: a Scout, Head Coach or Assistant Coach
  - a youth deal's negotiation: a Scout, else a coach (AI clubs too)
- **A third report is refused,** naming who is busy (or away) and the first day one of them is free.
- **A youth deal's negotiation is a job.** It holds one of the negotiator's two places for 5 days (SCOUT_DAYS). Asking again for the same youth while it runs adds no job. A loan needs no negotiation, so it still goes when everyone is busy.
- **Left out:** the academy's older club-level "youth scouting" trip (`/youth-scouting`). It has no person attached, and no page in the game uses it.
- **Saves from before 1.1.1:** reports already in progress have no job row, so they don't count toward the limit.
- **Watch List:**
  - its own top-row pill, "Watch List (N)", beside Senior and Youth Players; the second-row pill is gone, so there aren't two
  - a Seniors / Youths filter
  - each card has Remove from list, Scout and Buy, using the market's own handlers and contract box ("Buy" is the box's own button, relabelled)
  - a watched youth in an AI club's academy is bought through her club, with the Clubs page's Loan-or-buy dialog
- **Youth cards** have the senior card's full-width Scout button (and Scout her again), plus the Watch star. The Clubs page's youths have the star too.
- **The Staff Market's Medical pill** links to the Medical Market. The role pills are unchanged.
- **Scouted first:** one helper (`components/sort-menu.tsx` `scoutedFirst`) on every list. A card's order is report in, then in progress, then unscouted, with the chosen sort kept inside each group. The state is the game's own for the day, so a card moves up the day its report is in.

**Staff budget (Part 11)**
- **One sponsor system.** The main sponsor is the existing system's "primary" slot.
  - **The player's club:** its chosen deal is a primary `promo_deals` row, with new columns for its staff budget, bonus, what the bonus has paid, and the season.
  - **Offers:** they wait as status `main_offer`. The Finances page's own sponsor offers no longer include the primary slot. Old-style primary deals in saves from before 1.1.1 run to their end.
  - **AI clubs:** they keep their main sponsor on their own state row (they have no `promo_deals` rows).
- **When offers appear:** on Day 1 (made with the career, shown beside the draft and on Finances), at each season's start (the rollover), and on first look in a save from before 1.1.1. Until the club chooses, its budget is its level: a new club's first-season figure.
- **The bonuses:**
  - **per win:** paid with each win
  - **prize share:** a share on top of each prize
  - **World Finals:** paid once, the first time the club plays a World Finals match that season
  - The player's club is paid on its ledger (category `sponsorship`, "Main sponsor bonus …"); AI clubs to their balance.
- **No monthly payment.** The main sponsor gives a staff budget and a bonus. The flat weekly sponsor income is unchanged.
- **The cap is checked** at the player's staff hire (`POST /staff`), medical hire (`POST /medical-staff`) and renewal (`POST /staff/:id/renew`), and at the AI clubs' Jan 8 hiring (`hireAiStaffTx`). AI staff contracts aren't renewed; they end and the club hires again on Jan 8.
- **The budget level moves at the boundary** on the season just ended: by its World Tour finish (top 4 +30%, top 8 +20%, top 16 +10%, otherwise −5%) and money ($3M+ +10%, $1M+ +5%). It never goes below the first season's level or above $90,000.
- **AI clubs choose too:** the biggest staff budget while they lack a coach or a medic, otherwise any of the three.
- **Logos:** sponsors have none. `promo_deals.image_url` exists but no page reads it. The two images in `public/` (`prohydrate-sponsor.webp`, `swimwear-sponsor.webp`) are referenced nowhere. Cards show name and type (category).
- **The harness:** like `VBE_STAFF_ABSENCES`, a harness-only `VBE_STAFF_BUDGET=off` lifts the refusals for suites about other things. The game never sets it; the staff-budget suite and the soak run with it on.

**17 October**
- **Renewals and buying ahead (every club).** A renewal of a contract that ends before a player bought ahead arrives must fit under the cap on that day, even at the same wage (`renewalCapRefusalTx`). The room that contract made is spoken for. Otherwise, as before, only a raise is checked (C-3 A).
- **AI clubs count that room only for players they can do without.** A club must still field two until the new player comes, so it counts the cheaper of keeping its cheapest such players or the cheapest healthy free agents. A club short of two keeps room for the cheapest free agent who makes two.
- **Junior medics.** A Registrar or Physio Assistant is promoted on a fixed day, between one and three years after joining a club (a hash of who she is, so a run is repeatable). A move starts the clock again. Her wage rises to the full role's wage for her new skill, never below what she was on. Promotion is this career's (`career_staff_state`), so the staff table and other careers keep her as a junior. A Surgeon doesn't promote.
- **Two long suites over 30 minutes were let finish** (ai-club-economy, rollover's second run): each was advancing steadily when checked, and both are long by design. Rollover in the build was stopped, because it had slowed; the cause was found and fixed.
- **Suites given room or patience, not looser checks:** ai-buyable and transfer-window give six AI clubs room in their own databases; staff-budget waits up to 150 days for a win; rollover's walk turns AI bids down. Each check still asks for the same thing.

**Found while checking Parts 10 and 11 (fixed in the game)**
- **Committed wage bill.** An AI club that agreed a buy-ahead (checked against its cap on her arrival date) could then refill or renew against today's wages, and be over the cap when she arrived. The soak found 12–21 such clubs a season. New spending is now checked against the committed bill: today's seniors plus every player bought ahead. That covers signings, renewals, raises, counter-offers and AI refills, for every club, the player's included.
- **Borrowed youths.** An AI club could promote a youth it only had on loan as injured-list cover. When her loan ended she went back, and the club was left with one senior. No club now promotes a youth on loan to it (AI clubs in `academyBestTx`; the player's club is refused with a plain message).
- **Same-day trim.** A full AI club that bought ahead trims only itself, the day the bought player arrives; it had been trimming every club.

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

**Scouting limit** (`lib/db/src/schema/staff-roles.ts`): `SCOUT_REPORTS_AT_ONCE = 2`. A negotiation lasts SCOUT_DAYS (5).

**Staff budget** (`lib/db/src/schema/staff-budget.ts`, `STAFF_BUDGET`):

| Constant | Value |
|---|---|
| `firstSeason` | $39,500 a month |
| `max` | $90,000 a month |
| `finishSteps` | top 4: +30%, top 8: +20%, top 16: +10% |
| `poorSeasonStep` | −5% (no World Tour place, or below the top 16) |
| `moneySteps` | balance $3M+: +10%, $1M+: +5% |
| the three offers | per win (100% of the level, $1,500 a win × level/first); prize share (95%, 25% on top); World Finals (90%, $150,000 × level/first) |

**SB-3, the staff wages measured** (the shipped 243 staff, monthly):

| Role | Lowest | Median | Highest |
|---|---:|---:|---:|
| Head Coach | $9,833 | $14,833 | $20,000 |
| Assistant Coach | $5,750 | $7,982 | $10,083 |
| Doctor | $14,083 | $14,667 | $15,667 |
| Physiotherapist | $8,750 | $13,500 | $16,250 |
| Medical Specialist | $11,333 | $14,667 | $16,500 |
| Nutritionist | $8,333 | $14,084 | $16,667 |
| Sports Scientist | $12,333 | $13,667 | $14,917 |
| Strength Coach | $5,667 | $7,000 | $9,000 |
| Promotional Manager | $5,833 | $7,792 | $9,833 |
| Scout | $4,833 | $6,375 | $7,667 |
| Fitness Trainer | $4,800 | $5,554 | $8,083 |
| Massage Therapist | $4,833 | $5,625 | $6,500 |

**The first-season budget: $39,500, which is 98.75% of the two highest wages combined ($40,000: two Head Coaches at $20,000).**
- **What it buys:** a good Head Coach (skill 79, $14,583) + a good Physio (skill 81, $13,500) + two average staff (a median Fitness Trainer $5,554 + a median Massage Therapist $5,625) = $39,262.
- **What it doesn't:** the two highest-paid together.
- **Why it can't do more:** Rob's two targets pull against each other. A median "good" Head Coach + a good medic + two median support staff (about $7,400 each) is about $43,000, which is more than $40,000. A club can hold two Head Coaches (there's no limit per role), so the budget has to stay under $40,000. "Average staff" is therefore taken as the cheaper support roles.
- **Growth:** with top staff at about $17,900 a month (Head Coaches of skill 85+), three top-4 seasons with $3M in the bank take the level from $39,500 (two top staff) towards $90,000 (four or five). The suite prints the path.

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

## AI bids on his club: are they limited?

Rob asked (16 Oct): how often can the AI clubs bid on one club, or one player? Read from the code (`utils/aiSquads.ts` `aiTransfersWeekTx`):

| Limit | Value | What it limits |
|---|---|---|
| `AI_TRANSFERS_PER_WEEK` | 2 | AI bids a week in the whole world (AI-to-AI and on his players together) |
| One open bid per player | `openDealForTx` | a player with a bid waiting, or a move agreed, gets no second bid |
| One open deal per buyer | | an AI club buying someone ahead bids for nobody else until she arrives |
| `AI_KEEP_DAYS` | 365 | one of his seniors can be bid on only after 365 days at his club (from her contract's start) |
| `AI_BUY_GAP` | 5 | the bidder only wants a player 5 rating points better than its weakest (or second) senior |

**Nothing limits bids per club or per player over a season.** Keeping a player with a counter doesn't reset her contract's start date, so the next week another AI club (or the same one) can bid for her again. His three seniors can each have a bid waiting at once.

**Flagged, not limited: Rob decides.** The soak counts, per season, the AI bids on his seniors, the players he lost to them, and the most bids on one club and on one player (in the table below). In the soak he never answers a bid, so each one takes her after 14 days.

## Part 8: the old checks that expected the old rules

Each was run alone before and after. All pass alone now except where noted.

| Suite | Before | After | What changed and why |
|---|---|---|---|
| transfer-fee | 4/6 | 6/6 | A contracted player at another club is "at_club" at any time of year, not "transfer_available" in the 6-month window. The buyer's ledger line is a `transfer_fee`. |
| ai-buyable | 21/25 | 25/25 | A buy is a bid, agreed and paid now. She joins on her arrival day (the suite brings that forward), and her club refills that day. AI-to-AI buys are counted as deals agreed ahead. Room is made in its own database, because there's no mid-season release now. |
| player-market | 12/18 | 18/18 | It made room by releasing players mid-season. Now done in its own database (`freeSquadPlace`). |
| contract-terms | 26/37 | 41/41 | Room is made the same way. Ending a contract early is now refused outside the window (new check). The payout is checked on 10 December, inside the window. |
| salary-cap | 10/16 | 16/16 | Room is made the same way. Its source check now reads the AI bid: the fee above its reserve, and room under the cap on her arrival date. |
| day1-draft | 26/27 | 27/27 | After the draft, releasing a pick was expected to pay out. It is now refused until the window (no dumping). |
| ai-injuries | 14/16 | 16/16 | Room is made the same way. A full AI club's weakest now goes the day the player it bought arrives (source check). |
| graduates | 14/18 | 19/19 | A promoted graduate is a senior: releasing her mid-season is refused (new check). The release and re-signing are done on 10 December. |
| contract-renewal | 29/31 | 31/31 | It signed an AI club's player, which is now a bid, so it signs a free agent instead. Signed on 20 December, in the window, her contract runs to the end of 2027. It is set to end this season before the renewal tests. |
| manager-faces | 51/56 | 56/56 | Room is made the same way. Its source check now reads the AI bid, and the AI youth buys, which take no price factor. |
| unity-match-state-payload | 10/11 | 11/11 | A bought AI player joins at once only if her contract has ended, so the scene ends it yesterday and bids well over her wage. |
| olympics-tournament | 3/4 | 24/24 | Its squad leaves in its own database. All four careers were being sacked before 2028 because AI bids took the club's best players, which the suite never answered. A new helper (`turnDownBids`) turns those bids down as if he kept them. Transfers aren't this suite's subject. |
| settings | (Part 7) | 40/40 | Nineteen Rules topics and the 8 January sentence. |
| ai-club-economy | 19/22 | 21/22 | The academy check allows more than 4 for a club that bought a youth, and 3 for one that just sold or promoted one. **Open finding, below.** The season-21 manager move in the first run (and the league count that followed from it) didn't happen on the second run: a random sacking. |

Unchanged and passing alone: youth-loans 26/26, youth-market 9/9, youth-contract-box 9/9, injured-list 17/17, market-order 4/4, scouting-history 12/12, staff-contracts 12/12, difficulty 8/8, academy-cap-wages 18/18.

**Real faults the old suites found, fixed in the game (not the suites):**
- An AI club could drop to one senior when a player sold ahead left it mid-season. It now refills that day.
- A full AI club that bought ahead held four seniors until the window. It now lets its weakest go when the new player arrives.
- A free agent signed in the window got a contract that ended a few days later. It now runs from the next season.

**Open finding (ai-club-economy, 30 seasons).**
- **What happened:** after 30 seasons, one Oceania AI club (47) had 3 academy youths of its own. The weekly fill had just run (2 January). Nothing explained the drop: no promotion, sale or loan.
- **Likely cause, not proven:** the youth factory makes no youth when a region's names are used up (`youthIntake.ts`, "no_names"). Oceania is the smallest region. With youth buys, more youths are made over a career: a seller refills while the buyer keeps an extra.
- **Not changed:** the kept world could not be played on to prove it.

## The soak

`harness/long-career-update1.mjs`, 5 seasons, Medium, staff absences on, staff budget on. Final run, 17 Oct (cap fixes, junior medics), before the speed-up:

| Season | 1 (2026) | 2 | 3 | 4 | 5 (2030) |
|---|---|---|---|---|---|
| AI clubs over the cap that signed anyone (must be 0) | **0** | **0** | **0** | **0** | **0** |
| over it only through a promoted youth (C-5, allowed) | 7 | 5 | 2 | 4 | 5 |
| AI clubs with 3 seniors (of 60) | 49 | 53 | 50 | 51 | 52 |
| AI clubs with a coach and a medic | 36 | 36 | 28 | 30 | 38 |
| AI seniors' average rating | 75.0 | 76.4 | 75.8 | 76.4 | 75.3 |
| moves in the window / bought ahead | 0 / 0 | 0 / 0 | 3 / 3 | 1 / 2 | 2 / 2 |
| AI bids in all | 0 | 0 | 3 | 4 | 2 |
| AI bids on his seniors / players he lost | 0 / 0 | 0 / 0 | 1 / 1 | 0 / 0 | 0 / 0 |
| most bids on one club (club) | 0 | 0 | 1 (42) | 3 (25) | 1 (2) |
| most bids on one player | 0 | 0 | 1 | 3 (Beatriz Costa) | 1 |
| youth sales (AI to AI) / loans started | 4 / 48 | 5 / 61 | 9 / 63 | 11 / 56 | 12 / 50 |
| AI injuries | 102 | 119 | 100 | 83 | 116 |
| AI balances: median (below zero) | $577,635 (0) | $598,248 (0) | $660,097 (0) | $714,643 (1) | $720,661 (1) |
| free agents left | 162 | 183 | 228 | 261 | 295 |
| AI clubs' staff (top staff, skill 85+) | 87 (36) | 94 (37) | 84 (28) | 88 (32) | 95 (39) |
| AI staff budgets: median / top | $39,500 / $39,500 | $39,500 / $51,400 | $39,500 / $64,300 | $39,500 / $86,800 | $41,000 / $90,000 |
| AI clubs that can't afford a missing coach or medic | 0 | 0 | 0 | 0 | 0 |
| his staff budget (main sponsor) | $39,500 | $49,400 | $56,800 | $56,800 | $65,300 |

- All 60 AI clubs have a main sponsor every season. AI clubs with fewer than two seniors to play: 14 club-days in 5 seasons.
- **The re-run after the speed-up** (same code apart from the saved values): AI clubs over the cap that signed anyone 0/0/0/0/0; no AI bids at all in 5 seasons; 8 club-days short of two. AI buying is rare now, so one 5-season career can have none. AI-to-AI bids do happen under the same code: transfer-window saw 7, 1 and 6 in a year, and ai-buyable 25/25.
- **AI bids per club or per player: still no limit (flagged, Rob decides).** In these runs the most on one club in a season was 3 and on one player 3, because there are few bids at all now.

## The package proof

At the top of this report (section 5).

## What a 1.1.0 save gets on first load

- `ensureSchema` adds the `transfer_deals` table and the `career_player_state.perks` column (empty). Existing contracts carry no perks.
- No transfer deals exist yet. AI clubs start bidding in their next weekly step, and they buy ahead into the next window.
- His players already under contract stay. Anyone he has held for 365 days or more can draw AI bids, and he answers each within 14 days.
- AI academies and loans carry on. Any AI youth can now be asked for on loan or to buy from the Clubs page.
- (17 Oct) The 37 junior medics are added (ids from 10001, `ensureSchema` Pass 3b), with this career's state; `staff.grade` and the `career_staff_state` promotion columns are added empty.
- (17 Oct) Three main-sponsor offers wait (Finances, Staff Market, Medical Market); until one is chosen the staff budget is the first season's $39,500. Staff he already has stay, even if that is over it (SB-4).
- (17 Oct) `scouting_jobs` is added empty. A report already out in a 1.1.0 save was not tested against the two-at-a-time limit.
- Checked on the package: a copy of a genuine 1.1.0 save, 17/17 (top of this report, section 5).

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

**Part 12 (the academy Renew fault, 12 Oct).**
- **It no longer happens.** job-market's new check takes the job market's path on purpose:
  1. the club is sold and the manager takes an AI club;
  2. one of its academy youths is put into her final season;
  3. the Contracts page offers Renew (the page's own rule);
  4. the renewal goes through: HTTP 200, new end 31 Dec 2028.
- **Likely cause of the old fault:** 15 Oct's O-5 fix, which gives a taken-over academy's youths academy contracts (`repairTakeoverYouthContracts`, and the takeover itself). Nothing was changed for Part 12 beyond the check.

**Part 7 (words).**
- The Rules page has seven new topics: The transfer window, Buying ahead, No dumping, One chance to keep her, Perks, Youth deals and scouts, and The Clubs page. Their numbers come from `@shared/transfers`, so the page and the game agree.
- "Hire your staff and medical in your first week" now says "On 8 January every season (Day 8 of a new career)", which is 1.1.0's rule.
- Patch notes: `docs/UPDATE1-1.1.1-PATCH-NOTES.md`.
- harness/settings.mjs checks for nineteen topics (it checked twelve) and for the 8 January sentence (it looked for the old "On Day 8" sentence). 40/40 alone.
