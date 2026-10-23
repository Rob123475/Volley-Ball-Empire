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

## Item table

| Item | What | Commit | Proof |
|---|---|---|---|
| A1 | Staff portraits: 49 installed, 82 refused (logos) | 90a17739 | ai-staff 31/31, junior-medics 12/12, installer 15/15, live-save copy |
| A2 | Real flags: flag-icons, <Flag>, every nationality resolves | bf8104ac | flags 18/18; screenshots in Part C |
| A3 | AI scouting and buying limits (10 a season, 2 at one club), counted from ai_market_moves | (this commit) | ai-market-limits 19/19; transfer-window, ai-buyable, counter-offer, salary-cap, manager-faces |
