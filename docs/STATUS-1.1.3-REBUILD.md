# 1.1.3 rebuild: status

Brief: `Downloads\REBUILD-BRIEF-24OCT.md` (24 Oct 2026). Worktree `C:/vbe-tm`, branch **release-1.1.3**, continuing from eb2dc65b. Version stays **1.1.3** (a rebuild of an unpublished package). Commit and push after every item. Nothing uploaded to Steam; nothing merged into update-1. Rob's live save is only copied (its hash is at the end).

## Summary

*(In progress: filled in as the items land.)*

## Decisions I made

- **A1, the duplicate scout:** scouts `(15)` and `(16)` are the same file byte for byte. `(16)` is left out (not cleaned, not installed); Rob's original stays in his folder, untouched. None of the 82 had a name yet, so "give her name to another scout" has nothing to move: `(15)` is named like the others. **81 pictures are installed, not 82** (10 head coaches, 11 assistant coaches, 60 scouts).
- **A1, the method:** the 19 Oct code (`clean.py`) is used unchanged; only where it reads its pictures changed. Regions were placed per picture as on 19 Oct. Two helpers placed the scouts' regions, which I then checked one by one on sheets: one finds the gold lapel pin, one draws the wall region right of the person, away from anything sharp or dark, so hair and shoulders are never in it. Cleaning works on the installer's own crop (500×500, losslessly), so the installer's resize is a no-op.
- **A1, the scouts' wall:** the blurred swirl sits on the warm wall at the right in 43 of the 60. The other 17 sit in front of glass with no swirl, so their background is left alone.
- **A1, names:** head coaches' file names give nationality, gender and age; assistant coaches' give nationality (and mostly gender), ages read off the picture; the scouts' file names give nothing, so nationality, gender and age are read off the picture, as last night for the registrars. Surnames come from the game's athletes of that nation where it has any (Turkey, Finland, Scotland and Iran have none, so those four use common surnames). No name repeats a player, pool player or staff member: 11 first choices clashed and were changed.
- **A1, Scouts in the installer:** the installer had no Scout role. It does now (`"Scout": "scouts"`). New scouts copy the existing ten scouts' rules (skill 65–90, their wage line).

## Part A

### A1. The 82 refused staff portraits: cleaned and installed

**Done.**

**What was on them, and what was done** (the 19 Oct method, `docs/STAFF-LOGO-CLEANUP.md`; the code and every region are in `scripts/portraits/staff-logo-clean/`):

| Who | Mark | Repair |
|---|---|---|
| 10 head coaches | gold swirl on the polo chest | fabric: mark found against the fabric, Navier–Stokes inpaint, grain |
| 11 assistant coaches | "BEACH VOLLEYBALL WORLD TOUR" and the swirl on the shirt; WORLD TOUR / VOLLEY TOUR on the net bands; a blurred gold emblem on the net poles (and gold bands on the pole in 3); a gold banner over the sea in 2; the cap logo on 1 | fabric as above (lanyards protected by cut lines); the bands along their slant (`open`, darken-only) or from the band beside the text (`lerp`); the cap by a smooth shading fit; the sea banners line by line from the clean side, clipped to above the shoulder |
| 60 scouts | gold swirl lapel pin; a big blurred swirl on the wall behind 43 of them | the pin by a smooth fit of the lapel around it (a circle just over the pin and its rim); the wall by a smooth surface fit, as on 19 Oct |

- Cleaned copies, under Rob's file names: `C:\Users\rbonn\Documents\BVE-staff-portraits-1.1.3-cleaned\{Head Coach, Assistant Coach, Scout}\` (500×500 PNG). Rob's originals in `OneDrive\Desktop\staff portraits 1.1.2\` are untouched.
- **Contact sheets, every one before | after:** `docs/proof-1.1.3/rebuild-a1/sheet-coaches_0.jpg` (21), `sheet-scouts_0.jpg` and `_1.jpg` (61, with `sc08` = the duplicate (16), shown unchanged).
- **Zooms on the largest marks:** `zoom-coaches.jpg` (a head coach's emblem, the assistant coaches' shirt prints, ac02's cap and sea banner, ac05's two banners, ac09's net band and pole, ac07's lower banner), `zoom-scouts-pins.jpg`, `zoom-scouts-walls.jpg` (the wall contrast-stretched, so the swirl shows before and is gone after).
- I looked at every picture before and after, at card size and zoomed, and at every scout's wall contrast-stretched: no emblem, no lettering, no swirl remains.

**Could not clean perfectly (as on 19 Oct, listed so Rob can regenerate if he wants):**
- **Tweed jackets** (scouts `(52)`, `(54)`, `(58)`, `(60)`: Marites Santos, Yelitza Colmenares, Kavita Sharma, Adaeze Nwosu): where the pin was, the speckled tweed is a soft, slightly blotchy patch. No pin shape is left; it shows only zoomed in.
- **The scouts' walls** are smooth where the swirl was: they read as a defocused wall at card size, like the 19 Oct scouts.
- **Assistant coaches' bands and sea banners:** plain band colour where the text was; ac02 and ac08's sea banner is plain blue up to the shoulder.

**Installed** the way the 49 were (`scripts/install-staff-portraits.cjs`, 500×500 WebP q=88, role folders, ids continuing from the 49): head coaches `head_coach/staff-36`–`45`, assistant coaches `assistant_coach/staff-36`–`46`, scouts `scouts/staff-11`–`70`. **Staff ids 10210–10290.** Names, ages, nationalities: `docs/staff-portrait-names-1.1.3.json` ("Head Coach", "Assistant Coach", "Scout").

**Counts per role** (starter DB; and a **copy** of Rob's live save, booted once by the server so the boot's reference sync, Pass 3b, runs):

| Role | Starter DB before | Starter DB after | Live-save copy before | Live-save copy after one boot |
|---|---|---|---|---|
| Head Coach | 35 | **45** | 35 | **45** |
| Assistant Coach | 35 | **46** | 35 | **46** |
| Scout | 10 | **70** | 10 | **70** |
| every other role | unchanged | unchanged | (the 49 medics and 1.1.1's juniors arrive too: Doctor 21→34, Physio 21→33, Registrar 0→26, Physio Assistant 0→22, Surgeon 0→13) | |
| all staff | 329 | **410** | | |

- Both careers in the live-save copy got their state rows for all 81 new people (career 16: 0 → 81; career 18: 0 → 81).

**No duplicate went in** (the same check as for the 49, `scripts/portraits/staff-picture-match.py`, now taking the cleaned folder; result `docs/proof-1.1.3/rebuild-a1/picture-match.json`):
- Before installing: the closest game picture to any of the 81 is 5.6 levels apart (of 255); a copy, even re-encoded or cleaned, is under 2. The eight closest pairs side by side (`closest-pairs.jpg`): all different people (look-alike studio shots).
- After installing: all 81 files exist, 500×500 WebP, 81 distinct pictures; each is within 0.6 of its own cleaned copy; the closest other staff picture is the same 5.6 (head_coach staff-20, a different man).

**Suites (alone, once):** `staff-portrait-install` 15/15; `ai-staff` 31/31 (the Day 8 pool now holds 130 new faces: the 49 medics and these 81; AI clubs hired some of them); `staff-bonuses` 28/28 (starter staff 410, all names distinct); `wizard-career-economy` 12/12 (290 staff from id 10001). Run with run-all's own switches (`VBE_STAFF_BUDGET=off`, `VBE_STAFF_ABSENCES=off`): a first standalone run of staff-bonuses without them was refused by the sponsor's staff budget, which run-all always lifts for that suite.

### A2. The 28 duplicate pool players renamed: starter DB only

**Done.**

**What I found first:** the boot's reference sync copied a pool player's **name** from the starter DB into every save (`utils/ensureSchema.ts`, `REFERENCE_UPDATE_ONLY.continental_pool_players: ["pool_team_id", "name", "image_url"]`). Every career in a save reads the pool rows live (an AI club's pool seniors become career players on the career's first week, from these rows). So a plain rename in the starter DB would have reached every save on its next boot, which Rob ruled out.

**The change:**
- The sync no longer copies a pool player's name (club and card still follow). The header says why: a starter-DB rename reaches new saves only.
- The one older rename that has to reach saves in play, 2 Oct's Siosaia → Salote Taufa, used to ride on that sync. It is now made by name in `utils/referenceRenames.ts`, from its existing list, and only while the save still has the old name.
- `scripts/rename-pool-duplicates.cjs` renames the 28 in `lib/db/volleyball-empire.sqlite` (idempotent; each row only while it still has its old name). The **pool** player is renamed, never the world-roster player.

| Pool player | Was (= a world-roster player) | Now |
|---|---|---|
| ASI_01_P1 (Japan) | Yuki Tanaka | Haruka Mori |
| ASI_05_P1 (India) | Priya Sharma | Kavya Mehta |
| AFM_05_P1 (Kenya) | Wanjiru Kamau | Akinyi Odhiambo |
| AUS_03_P1 (New Zealand) | Aroha Tane | Kahurangi Ngata |
| AFM_09_P1 (Tunisia) | Sarah Ben Ammar | Yasmine Mzoughi |
| AFM_09_P2 (Tunisia) | Habiba Mzoughi | Amira Bouazizi |
| AFM_10_P1 (Tanzania) | Zawadi Kimaro | Rehema Mollel |
| AFM_10_P2 (Tanzania) | Asha Msuya | Upendo Mwakalinga |
| ASI_09_P1 (Vietnam) | Nguyen Mai Anh | Tran Thu Trang |
| ASI_09_P2 (Vietnam) | Le Minh Anh | Le Ngoc Han |
| ASI_10_P1 (Taiwan) | Chen Yu-Hsin | Lin Pei-Shan |
| ASI_10_P2 (Taiwan) | Huang Yi-Ting | Hsu Wan-Ting |
| AUS_09_P1 (Papua New Guinea) | Alina Kora | Grace Bainivalu |
| AUS_09_P2 (Papua New Guinea) | Kiriwina Tau | Lahui Kaupa |
| AUS_10_P1 (New Zealand) | Zoe Walker | Ruby Mackenzie |
| AUS_10_P2 (New Zealand) | Lily Mackenzie | Isla Walker |
| EUR_09_P1 (Portugal) | Sofia Almeida | Carolina Moreira |
| EUR_09_P2 (Ireland) | Aoife O'Sullivan | Niamh Kavanagh |
| EUR_10_P1 (Malta) | Sara Borg | Maria Caruana |
| EUR_10_P2 (Malta) | Yasmin Grech | Nicole Borg |
| NAM_09_P1 (Jamaica) | Kayla Thompson | Tanisha Brown |
| NAM_09_P2 (Jamaica) | Niah Myers | Keisha Beckford |
| NAM_10_P1 (Bahamas) | Aaliyah Rolle | Shante Bethel |
| NAM_10_P2 (Bahamas) | Jada Knowles | Tiara Ferguson |
| SAM_09_P1 (Guyana) | Nia Campbell | Anjali Persaud |
| SAM_09_P2 (Guyana) | Amara James | Keziah Campbell |
| SAM_10_P1 (Bolivia) | Valeria Mamani | Ximena Zeballos |
| SAM_10_P2 (Bolivia) | Camila Torrez | Daniela Mamani |

Every surname is one of that nation's athletes' in the game. No new name matches a player, pool player, staff member, youth name or any name in the staff and youth name histories.

**Proof: `harness/pool-names.mjs`, 15/15** (run-all 98zy, port 4982):
- **The starter DB:** no pool player's name matches any world-roster player's name (120 pool players, 276 world-roster players); no two pool players share a name; no new name matches a staff member's; the 28 renames are in; each new surname is her nation's.
- **The source:** the sync copies a pool player's club and card, not her name; Salote Taufa goes by name.
- **A save in play, untouched:** a copy of Rob's live save, booted once by the new server: the hash of every pool player's name, and of every player's name, is the same before and after (`28cce0bd7a2de859` and `ec105a173660f067`); the 28 keep the save's names (AUS_09_P1 is still "Alina Kora"). The save keeps its 28 duplicates, as Rob decided.
- **A new save:** the AI clubs' seniors made from the 28 carry the new names, none shares a name with a world-roster player, and the Papua New Guinea club's page shows Grace Bainivalu, not Alina Kora.
- `harness/reference-corrections.mjs` 12/12: in the starter DB the two moved players (EUR_09_P2, EUR_10_P2) carry their new names; on Rob's 2 Oct save they move club, keep the names that save has, and Salote Taufa still arrives. `reference-data-update` 6/6.
- To run this item's suite I rebuilt the api-server alone (its suites read `artifacts/api-server/dist`). The full build is in Part E.

**Decisions (A2):**
- **"Do not reach into existing saves" also covers a new career started inside an existing save file:** it reads that save's pool rows, so it gets that save's names, duplicates included. Only a new save (a fresh install, or a save made from the starter DB) gets the clean names. Reaching into the save's reference rows to change that would be the very thing Rob ruled out.
- Two first choices gave a pool player the same surname as the world-roster player whose card she shares (see below): Grace Kumul beside Diana Kumul, Yasmine Trabelsi beside Ines Trabelsi. They became Grace Bainivalu and Yasmine Mzoughi, and the suite asserts it can't happen.

### A3. "BEACH VOLLEYBALL WORLD TOUR" off the youth card

**Done.**

- `images/youth/player_youth_card_01.webp` is a card template, and the words sat in the gold pill at the bottom left, above five stars. They are painted out the 19 Oct way (`clean.py`'s polygon fill with a smooth fit from the plain card around it, and grain; the region is `docs/proof-1.1.3/rebuild-a3/youth-card-region.json`). The stars, the pill's gold outline and the "BVE / Beach Volleyball Empire" ball (the game's own name) stay.
- **Rob's senior cards were cleaned by Rob's own fixed set on 19 Oct** (`docs/TRADEMARK-CLEANUP.md`: "Rob's 205 cleaned senior cards ... copied over"). No fixed youth card exists anywhere on this machine, so "the same method" here is the 19 Oct painting method, as for the staff portraits.
- **Same pixel size and format:** 1086 × 1448, WebP (quality 96, the nearest to the original's file size, as 19 Oct chose; 74,090 → 77,146 bytes). `check:image-formats` OK.
- **The original is kept:** `C:\Users\rbonn\Documents\BVE-image-backup-24oct\youth\player_youth_card_01.webp` (byte-identical to the file it replaced, checked before writing).
- **Mean difference against its own original** (0–255): **0.62** over the whole card (19 Oct's cards: 0.3–1.9); 0.20 outside the painted box (the re-encode), 41.9 inside it (where the words were).
- **Before and after:** `docs/proof-1.1.3/rebuild-a3/youth-card-before-after.jpg` (whole card) and `youth-card-wall-zoom.jpg` (zoomed on the words). The packaged-game screenshot is in Part E.

### A4. The World Tour decision, recorded: closed

**Done.**

- `docs/TRADEMARK-CLEANUP.md` item 4 now reads **DECIDED — keep "World Tour". No rename.**, with Rob's reasons (two dictionary words used across many sports; the FIVB Beach Volleyball World Tour ran its last edition in 2021 and has been the Volleyball World Beach Pro Tour since 2022, so the name is not in use; the marks that carried risk are gone) and both dates (decided 23 Oct, confirmed 24 Oct). It says the question is closed and not to ask again.
- **No strings changed.** All 93 player-visible uses stay; the World Tour podium banner stays "BEACH VOLLEYBALL EMPIRE WORLD TOUR".
- The same decision is in my own notes for future sessions, which also had it as open.

## Part B: contracts (Rob's rule change, 24 Oct)

**Done.** The rule as built (`utils/contractTerms.ts`, whose header now states the amended rule, why, and that it is deliberate):

| Who | Lengths | Ends |
|---|---|---|
| Players at the club the career controls now | 6 months · 1 season · 2 seasons | 6 months on; or the end of this / next season (from the season rows) |
| Players at every other club (the AI clubs, a club he has left) | 1 season · 2 seasons | the end of this / next season |
| Staff and medical, every club | 1 season · 2 seasons | **7 January**: the one after this season, or the one after that |

**What I found first:**
- The AI clubs' staff deal picked 6m / 1s / 2s at random (`aiStaff.ts`), as the brief says.
- **The AI clubs also signed players on 6 months:** `lengthForRating` (`poolClubFinances.ts`) gave every club rated under 70 a 6-month deal, and it is the one length an AI club uses for every senior it signs from the free agents, every renewal and every bid. Old 6-month pool deals renewed on 6 months again. An AI club's counter to the manager's 6-month bid copied the 6 months. That is a lot of AI squads turning over in mid-season, which matters for D1 below.

**B1, staff and medical end on 7 January:**
- `STAFF_CONTRACT_LENGTHS = ["1s", "2s"]` for everyone; `STAFF_CONTRACT_END = "01-07"`, the day before `AI_STAFF_DEAL_DAY` (8). `staffContractEndDate(length, from)`: 1 season runs to the 7 January after the season it is signed in, 2 seasons to the one after; a renewal counts on from the deal's own end.
- Wired into: hiring (`routes/staff.ts`, `routes/medical-staff.ts` through `staffContractPatch`), renewing (`routes/staff.ts`, which medical shares), the AI clubs' 8 January deal (`aiStaff.ts`, 1 or 2 seasons at random), the rollover's and the boot's backfills for staff with no contract (`backfillContracts.ts`, `staffContractBackfill.ts`). A 6-month staff or medical request is refused: "Staff and medical contracts run 1 or 2 seasons and end on 7 January."
- A contract ends on 7 January and the calendar's expiry (end date before the day) frees the person on 8 January, the same day the AI clubs hire.
- **Existing saves:** a staff member on 6 months expires mid-season once more, then renews (or is hired) onto a season contract. No migration.

**B2, AI clubs sign players on 1 or 2 seasons only:** `lengthForRating` returns 1 season below 78 and 2 seasons from 78 (no calendar arithmetic: a season is still the season row). An old 6-month pool deal renews on 1 season, and the row's length is updated. An AI counter to a 6-month bid offers 1 season. A deal that completes at any club but the career's current one is written on a season. The bookkeeping row of a pool player who becomes a career senior says 1 season, not 6 months. **Existing saves:** AI players on 6 months expire once, then re-sign on season deals. No migration.

**B3, the 6-month option is the manager's club's and follows him:** every route that signs or renews a player (`contracts.ts` signing and renewal, `team.ts` promotion, `transfers.ts`, `youth-loans.ts`, `youth-scouting.ts`) reads its length through `playerContractPartyFor(career, team)`: 6 months only if the team is `career_saves.team_id` now. When he moves, the new club is that team and the old one isn't, so the option moves with no other code. Contracts stay where they were signed.
- **The screens:** `lib/contract-lengths.ts` now holds three lists (players at his club, players elsewhere, staff); player screens offer his club's three, the staff and medical hire pickers and renew bar offer two; the markets read "1 season or 2 seasons, to 7 January". The Rules page has a "Contract lengths" section; the patch notes a "Contracts" section (and the 130 faces and the renamed players).
- `harness/contract-terms.mjs` now checks **each of the three lists** (and the full code list) is identical on the server and the frontend.

**Proof:**
- **`harness/contract-rules.mjs`, 33/33** (new, run-all 98zz, port 4994): the rule from the module itself (the three lists; the gate; an AI club's request for 6 months refused, saying why; a staff 6 months refused, saying why; six staff end-date cases: a first-week hire, mid-season, December, 2 seasons, renewals); a 2-season player deal ends on the next season's end, not 730 days on. The source: all six player routes ask the gate, the three staff reads use staff lengths, the AI staff deal and `lengthForRating` can't pick 6 months, no AI path falls back on the first length. A career: his club signs a player on 6 months (182 days); a 2-season deal ends 2027-12-31; a staff or medical 6 months refused; 1 season ends 2027-01-07, 2 seasons 2028-01-07. **Past the AI clubs' 8 January deal: all 122 staff contracts in the career (120 at AI clubs) end on a 7 January; no AI staff on anything but 1s/2s; no pool contract on 6 months (74 × 1s, 46 × 2s); every one of 168 AI seniors' contracts ends on a season's end.**
- **The club move, `harness/ai-job-market.mjs`, 36/36** (four new B3 checks in a real move at a season's start): a 6-month deal signed at his club before the move (to 2027-05-30) is still there after it, active, at the old club, same date; the old club is not the career's club and 6 months is refused for it; at the new club a 6-month signing is accepted (to 2027-07-01). The first run failed only because the new club's squad was over the salary cap for the signing; the helper now makes cap room first (`makeCapRoom`, the harness's tool for exactly that).
- `contract-terms` 46/46 (the split list check; staff 6 months refused; 1 season to 7 January; 2 seasons to the 7 January after next; the warning and expiry tested on a planted end date), `staff-contracts` 14/14 (the same for hiring, renewing, the backfill at boot), `ai-staff` 31/31 (every AI hire on 1s/2s ending 7 January), `counter-offer` 10/10.
- Suites that hired staff on 6 months only to have staff now hire on 1 season (`night2-world`, `player-market`, `staff-bonuses`, `staff-scouting`, `staff-slots`, `youth-market`, `ai-staff`); `ai-club-economy` and `counter-offer` now expect an AI club's two lengths. These run in Part E's full harness.
- **The soak** prints, each season, the AI clubs' 6-month contracts (players off a season's end, pool deals, staff) and staff contracts not ending 7 January, and flags either above zero. Its numbers are in Part E.

**Decisions (Part B):**
- **"1 season (to the next 7 January)" for a staff hire made on 1 to 7 January:** read literally, a coach hired on 3 January would leave on the 7th, four days later, and the Rules page tells the player to hire in a new career's first week. I read "1 season" as the season it is signed in (the season rows run 1 January to 31 December), so it ends on the 7 January after that season: a first-week hire runs the year, a mid-season one is short (as the brief says), a December one shorter still.
- **The gate is the career's current club for every player route,** although today every route only ever acts for that club: that is what makes the rule automatic, as the brief asks, and it is what the move test exercises.
- **The B3 move test lives in `ai-job-market.mjs`,** the suite that already plays a real move at a season's start; a second suite would have to play a whole season to reach one.
- The incidental "6m" staff hires in other suites became "1s"; none of those suites is about contract length.

## Part C: last night's six suite failures, properly

### C1. The three that were "the suite was out of date"

| Suite | What the game does now | Is that what Rob asked for? | What the check asserts now |
|---|---|---|---|
| **court-finish** | Last night: after a **Nations Cup** match (finished, or left part-way) the court went to the Cup schedule page; a club match to the Dashboard. | **No.** Rob's rule for the court (Unity brief, 29 Sep, item 5) is "a proper finish, then **straight back to the dashboard**". The 1.1.3 brief asked for Watch buttons on the Cup schedule and the Dashboard; it never asked for a different way back. The check had been changed to follow the game. **The game was wrong: fixed.** A Cup match now goes straight back to the Dashboard too, where the day's other Cup matches have their Watch buttons (`pages/court.tsx`, both places). | Leaving POSTs `/matches/:id/leave` (a club match) and goes to `/`; "unity-match-finished" refreshes every screen and goes to `/`; and `court.tsx` no longer names the Cup schedule at all. 11/11. |
| **settings** | On the court's settings overlay, choosing Manual for a Nations Cup match of a nation he doesn't coach does nothing (`chooseMode` returns first); his own nation's match can be Manual. | **Yes.** The 1.1.3 brief, A4b: "Watched matches play in Auto. Manual is only allowed for the player's own nation"; A4c: "He can play his nation's matches in Manual or Auto. Every other match is Auto only." The court (`ManualControl.ForbidManual`) refuses it too. | `chooseMode` refuses Manual when Manual isn't allowed, then saves and sends the mode as before. Unchanged tonight. |
| **staff-bonuses** | The starter DB had 329 staff after last night's 49 medics; it has **410** after tonight's A1 (81 coaches and scouts). | **Yes:** the count is the staff Rob's portraits added. | 410 starter staff, no two sharing a name (ignoring "Dr."). Updated for A1 tonight; 28/28. |

### C2. Academy intake: where the extra player came from

**Every path that makes a player** (I read each one; `w.createPlayer` / `createCareerPlayer` / an insert into `players` are the only ways):

| Path | Code | In last night's count? |
|---|---|---|
| His club's intake | `youthIntake.ts` `youthIntakeTx` → `youthFactoryTx().make` | counted, and listed in `youth_intakes` |
| **The AI clubs' academies, refilled every week** | `youthLoans.ts` `aiAcademiesWeekTx` → the **same** `youthFactoryTx().make` | **counted, never in his intake row** |
| The season's picture players | `newSeniors.ts` → `career_new_seniors` | excluded |
| Pool players made career seniors (a career's first week) | `aiSquads.ts` `materializeAiSeniorsTx` (`pool_player_id`) | excluded |
| A youth signed off a scouting find | `routes/youth-scouting.ts` (the player's action) | not in this scenario |
| `POST /players` | `routes/players.ts` (no screen calls it) | not in this scenario |
| The Day 1 draft, youth promotion, graduates kept at 19 | move existing players; **make none** | n/a |

**The name a new player can wear when "no name is left":** the suite gives every first name × surname combination to parked players first. Two kinds of real name still come back: a **retiree's** (the L-02c respawn rule, `player_retirements.name_reused_at`), which the old count allowed; and **an AI academy graduate's who left the game at 19**, which `intakeNamePoolTx` deliberately frees again (the C15 rule, so sixty AI academies don't use up a region's names). **The old count did not allow for the second.** An AI academy refill (or a picture player, whose name comes from the same pool) wearing a departed graduate's name would read as "1 created with a new name" while his intake made no one: exactly last night's line. That is the likeliest origin. It is a real, recycled name, by design, not a made-up one.

**The check now** (`harness/youth-intake.mjs`): it lists every player the season makes in that career, each with her origin (his intake / an AI academy refill (which club) / a picture player / a pool player made a career senior) and the source of her name (a retiree's given back / a departed AI graduate's / the pool player's own). It **fails on any player of unknown origin or with a genuinely new name**, and names her.

**Runs:** 5 runs tonight, **25/25 each**, plus last night's 2 clean re-runs: **7 clean runs of 8; not reproduced.** Each run's list (`docs/proof-1.1.3/rebuild-c/youth-intake-run1..5.log`): 2 to 6 players made, all accounted for: AI academy refills and new seniors, all wearing retirees' names given back. No departed-graduate name came up in these five, so the C15 path is the likeliest explanation, not a proven one. If last night's case happens again, the line will name her, her club and where her name came from.

One thing the new lines showed, explained and not a fault: in three runs the same youth (Martha Kera, Solomon Islands), made by an AI academy refill that season, also has a `career_new_seniors` row (listed as a new senior). The intake factory makes youths of 16 to 18 (`INTAKE_AGE_MIN/MAX`); one made at 18 turns 19 at the season's turn and can be one of the AI youths kept on as a new senior (`newSeniors.ts`, kind "youth"). Accounted for either way.

### C3. The two suite fixes hold

| Suite | Last night's fault in the suite | Runs tonight | Result |
|---|---|---|---|
| **ai-job-market** | The planted failed AI season came after the boards had already judged (his two World Finals places are matches too, so "one regular match left" was 3 scheduled, and that count went to 0 in one day). The suite only passed when some AI club failed on its own, **2 runs in 5, through 1.1.1 too: it had been passing on luck.** | **10**: 2 while building Part B, 5 for C3, 3 after a helper fix | **The planted sacking held in all 10**: 1 to 4 AI managers sacked each run, each with its reason. 9 of 10 runs 36/36. The one failure was in my own new B3 helper, not the planted season (below). |
| **ai-injuries** | It didn't allow for a walkover won by default: when the home side can't field two either, the walkover goes to the away side, so the short club "wins" 2-0 on 42-0 points without playing. | **5** | **16/16 all five.** The walkover case came up in all five (e.g. "2-0 (42-0 points, away)"), so the fix was exercised, not just passed. |

**The one failure, mine:** in one of the five C3 runs of ai-job-market, the new B3 check "his new club signs a player on 6 months" got "Squad is full (3/3)". My helper freed a squad place from the Team page's roster, which leaves out a senior on the injured list. It now counts the seniors holding a place from the database and frees down to the two starters (the same fix went into `contract-rules.mjs`'s helper). Then: contract-rules 33/33, ai-job-market 36/36 three times running.

## Part D: report only (no game code changed)

### D1. AI clubs with fewer than two seniors to play

**How I looked:** the soak counted the club-days but never said why. It now records each run of short days ("episode") with its cause, read on the day it began: how many seniors the club had, how many were on the injured list, who had left the club since the day before and where to (retired, to the free agents, to another AI club, to his club), its wage bill against the cap and its balance (`harness/long-career-update1.mjs`, harness only). To see the cause **before** Part B, I built the server from the commit before Part B (825e830a) in a throwaway worktree, since deleted, and ran the 30-season soak on it with the same script (`SOAK_SERVER`). Logs: `docs/proof-1.1.3/rebuild-d/soak-30-seasons-before-part-b.log` and `.json`.

**The cause, before Part B: the injured list at clubs carrying only two seniors.**
- **32 club-days in 30 seasons** (last night 27; 1.1.1 14 in 5): **27 episodes, every one "the injured list leaves fewer than two".**
- In every episode the club had **two seniors** (twice three, with two listed) and one had just gone on the injured list.
- **Nobody had left any of these clubs the day it began**: no expired contract, no release, no sale. Contracts were not the cause.
- **26 of the 27 lasted a single day.** The next day the club's cover comes up (an academy youth promoted, or a free agent signed, by the injured-list and weekly steps), so it is one forfeit-risk day. The one longer episode (6 days) was 2 January 2026, a club that began the career with two.
- Over the cap at the start: 3 of 27; none below zero on balance. Spread across the year (most in October to November and March to June).
- **Why two seniors:** an AI club refills to three only if it can fit the third under its salary cap (`keepAiSquadsTx`: "the interchange only when it can pay one and fit her under its cap"). At each season's end 48 to 59 of the 60 clubs held three seniors (median 56) in the baseline, so a handful of clubs sit at two at any time. With no interchange, one injury is enough.
- The weekly squad step is also why contracts don't cause it: an AI contract that runs out is renewed or released only in that weekly step, which refills the club in the same step.

**Does Part B fix it?** The after-Part-B soak is in Part E. On the cause above, I don't expect it to: Part B changes contract lengths, and no short episode began with a contract ending. (Part B did take the AI clubs' 6-month player deals out: about 62 AI players were on them at the end of every season in the baseline.)

### D2. The Job Market mid-season (report only: nothing changed)

**What it is now:**
- `pages/job-market.tsx` is routed **outside the game's shell** (`App.tsx`: `/job-market` sits with `/career-end`, not with the shell's pages), on purpose: it is "the only screen that works while a career has no club" (every club route answers "no team" then).
- **What leads to it:** only the cases where he has no club or is leaving one: the calendar when his club is sold (`hooks/use-calendar.ts`), the title screen when the career is seeking a club (`auth-guard.tsx`), and the Career page's Options tab after he resigns or breaks his contract (`manager-contract.tsx`). **No menu entry, no Dashboard link, nothing on the Career page leads there mid-season.**
- **No way back:** the page has two buttons, Apply (disabled outside the off-season window) and Retire (shown only in the window). There is no Back or Dashboard button and, being outside the shell, no side menu. A manager who lands there with a club can only use the browser history (which the packaged game doesn't show).
- **What it shows mid-season:** the window text ("moves wait for the season's end"), the vacancies (AI clubs whose boards sacked their manager) and, since 1.1.3, the national coach offers (`<NationalCoachOffers />`). AI clubs' poaching offers only appear in the off-season window. The national coach offers also show at the top of the Career page, with a Dashboard notice, so nothing is lost by not reaching the Job Market mid-season today.

**What it would take** (about half a day with a suite, all frontend):
1. **A way in:** a "Job Market" entry in the side menu's Career section (or a button on the Career page), shown while he has a club. While he has none, the redirects above already take him there.
2. **A way out:** when `employed` is true (the API already sends it), a "Back to the Dashboard" button at the top of the page; or render the page inside the shell when he has a club and outside it when he hasn't (two routes, one component), which gives him the side menu too. The second is cleaner but touches the router and the auth guard, so it needs the guard's redirects re-tested.
3. **Mid-season wording:** Apply is already disabled outside the window and says why (`windowText`), so no server change is needed.
4. **Proof:** a few lines in `harness/ai-job-market.mjs` (the route exists, the menu entry is there while employed, the back button only while employed) and a packaged-game screenshot.
