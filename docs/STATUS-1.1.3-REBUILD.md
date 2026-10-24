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
