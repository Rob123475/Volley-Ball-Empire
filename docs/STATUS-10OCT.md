# Pictures brief Sat 10 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\PICTURES-BRIEF-10OCT.md`, steps 1 to 7 in order, worktree `C:\vbe-final`, branch `launch-final` (started at `6120604`, the 6 Oct status commit; code `b311e6c`).

## Summary

**Your new pictures are in the game on `launch-final`, and its package is ready for you to check: `C:\build\vbe-final-10oct\win-unpacked`.** Nothing is merged into `main` (still `2c17431`), nothing went to Steam, and the fallbacks `C:\build\vbe-final-06oct` and `C:\build\vbe-launch-05oct` were not touched.

- **The 205 senior cards without the banner** are in. The cards relied on the old 2:3 shape, and a shorter picture would have left a dark band under her, so the card was fixed: her picture now fills its column, head at the top. This was checked on every card at three window sizes (Team, Player Market, At AI Clubs, the pop-up, Contracts).
- **The 96 AI pictures** (each the best fit for her country, in her country's colours) are in.
- **Skin tones follow the pictures:** the 49 who changed now have their picture's band, in the starter DB and in every save at boot. Each change is keyed by player and made only where the save still has the old tone (on a copy of your 2 Oct save, 49 of 49). Two things this needed:
  - The boot no longer copies the starter DB's tones over a save's.
  - **A gap was fixed:** an AI player you buy used to play on your side of the court with no skin tone; she now has her picture's.
- **The caption check had to follow the crop.** It read the name from each card's banner, which is now gone. I checked pixel by pixel that each new card is the top of the card that was read, and carried each reading over (Q-12).
- **The checks:** the four suites alone passed; the AI court in Auto passed 17/17 with a full match; the full harness passed first time, **104/104 suites, 1,713 checks, at `da18281`**. The package was built from that commit, and on a copy of your 2 Oct save your career loaded and your pictures were served, byte for byte. Your live save was never opened.
- Four new questions (Q-12 to Q-15) and two notes are at the end.

## The pictures

`PICTURES-10OCT.zip` was extracted with `Expand-Archive` to `C:\Users\rbonn\Downloads\PICTURES-10OCT\`. The zip has its own top folder, so the files are in `Downloads\PICTURES-10OCT\PICTURES-10OCT\` (`seniors\`, `seniors-ai\`, `reshuffle.json`, `proof\`, and a copy of the brief). Nothing in it was moved, renamed or changed; this run only copied from it.

Checked before using it:
- `seniors\`: **205** files, the same names as the 205 `player_senior_<country>_NN.webp` in `public/images/players/seniors/` (no name missing, none extra). **Only the height changed:** every width is the same as before (192 at 600 px, 13 at 1023 px); the heights went from 901 to 699–790 (and from 1537 to 1293–1337).
- `seniors-ai\`: **96** files, the same names as the 96 in `seniors/ai/`; 600×800, as before.
- `reshuffle.json`: **96 rows**, one per AI slot, every `pictureFrom` used once (a reshuffle of the same 96 pictures). **49 rows change the skin tone.** Each row's `skinToneWas` is that player's tone in `scripts/portraits/ai-senior-cards.json` and the starter DB, each `skinToneNow` is the band of the picture it comes from (`imageBand` of `pictureFrom`), and every picture stays on its continent. The Korean picture at `ASI_03_P2` (Min-Seo Kim) has `kit: null`: left white, as the brief says.

## Steps

### 1. The 205 cropped senior cards

**Done.** The 205 files were copied over the same names in `artifacts/beach-volleyball/public/images/players/seniors/` (all 205 byte-identical to Rob's afterwards; `check-image-formats` OK).

**The cards relied on the old 2:3 height, so the fix is in the card itself** (`components/player-portrait.tsx`, the one component that draws a player's picture on the Team page and the Player Market). The picture was drawn at 62% of the card's width at its own height, top first. That filled the frame only for a 2:3 picture: at 1280×720 a 2:3 card filled the Player Market's 288 px frame to the pixel, and a shorter one would have left a band of the blurred background under her (36–65 px with the cropped cards; Rob's 3:4 AI and graduate pictures already showed 34 px). Now the picture **covers** the same centre column, head at the top: a short picture loses a little of each side, a tall one its bottom (as before). The name strip, the OVR column and the card's size are unchanged.

Measured in headless Chrome on the built game (`scripts/webgl-proof/senior-cards-proof.mjs`, a new Sydney Riptide career on a copy of the starter DB), every card at three window sizes, before and after (`docs/proof-10oct/step1/before/` and `after/`, `summary.json` and screenshots):

| Page, window | Before (old cards, old code): blurred band under her / bottom cut | After (cropped cards, new code) |
|---|---|---|
| Player Market, 216 senior cards, 1280×720 | 1–2 px band (the card filled exactly) | **no band**; whole height shown, 5–11% off each side |
| Player Market, 1440×900 | bottom 14% cut | no band; bottom 0–4% cut, up to 5% off each side |
| Player Market, 1920×1080 | bottom 24% cut | no band; bottom 2–16% cut |
| Team page, 3 cards, 1280×720 | bottom 10% cut | no band; whole height shown, 4% off each side |
| Team page, 1440×900 / 1920×1080 | bottom 23% / 32% cut | no band; bottom 7–8% / 18–19% cut |
| At AI Clubs, 96 cards (pictures not yet changed), 1280×720 | **34 px band** | no band; 6% off each side |
| At AI Clubs, 1440×900 / 1920×1080 | bottom 3% / 15% cut | same: 3% / 15% |

On every card her head is at the top of the frame. **The pop-up** (the lightbox a card opens when clicked; no other pop-up in the game shows a player's picture) shows the whole picture at its own shape, inside the window at all three sizes (`lightbox-*.png`). **The Contracts page's round avatars** still show her face (`contracts-page-*.png`).

### 2. The 96 AI pictures

**Done.** The 96 files were copied over the same names in `public/images/players/seniors/ai/` (all 96 byte-identical to Rob's afterwards; every one of the 96 differs from the file it replaced; no two of them are the same file; `check-image-formats` OK). Same names, so the cards in the starter DB and in every save (`/images/players/seniors/ai/player_senior_ai_<slot>.webp`) show the new picture without a database change. The card layout is the one fixed in step 1 (3:4, no band at any size).

### 3. Skin tones follow the pictures

**Done.** For the 49 rows of `reshuffle.json` whose tone changes, the player's tone is now her new picture's band, in the starter DB and in every existing save at boot, keyed by `stable_id`, and only where the save still has the old tone.

**Where the game keeps an AI player's tone: one place,** `continental_pool_players.skin_tone`. The court reads it there for the AI club's pool players, and through `career_player_state.pool_player_id` for the career player she becomes (the Player Market makes one of each AI club senior; `utils/aiSquads.ts`). Her career copy has no `player_v4` of its own (checked: none in a career with all 120 made career players), so there is nothing else to change. `/unity/match-state` reads that same column.

What changed:
- **The starter DB:** the 49 tones (by `stable_id`, each from `skinToneWas` to `skinToneNow`); nothing else (every other table and column compared row by row with the DB before: identical). `check-starter-db` OK.
- **The R-75 tone script** (`scripts/src/seed-pool-skin-tones.ts`, which wrote every pool player's tone from her nation's draw): a player with one of Rob's 96 pictures now takes her picture's band instead of a draw. Run on the starter DB it changed exactly those 49 (the same 49, `was` → `now`, as the list), and run again it changes nothing, so the `pool-skin-tones` suite's "re-running changes nothing" check still holds.
- **Existing saves at boot (new `utils/aiSkinTones.ts`, called in `index.ts` next to the 2 Oct reference corrections):** the 49 as a list (`stableId`, `was`, `now`); each is set only where the save still has `was`. A second boot changes nothing.
- **The boot sync no longer follows the starter DB over a tone a save has** (`ensureSchema.ts`). It used to copy the starter DB's tone over every save's, without looking. Now it only fills a tone a save has none of (a save from before R-75, as before), so "only when the save still has the old value" holds. A tone changes only through a listed correction like this one.
- **A gap closed on Rob's side of the court** (`routes/unity.ts`): an AI club player Rob buys (or takes over with an AI club through the job market) played for him with **no** skin tone, because his side read only `player_v4`, which her career copy does not have. His side now falls back to her pool player's tone, which is her picture's band.
- **`scripts/portraits/ai-senior-cards.json`** follows the reshuffle: for each of the 96, `robSource` and `imageBand` are now those of the picture she has (`pictureFrom`'s), and `skinTone` is `skinToneNow` (= `imageBand`, all 96). New fields so the next person is not misled: `pictureFrom`, `pictureMadeAs`, `kit` (the colours; `null` for the Korean picture left white) and `skinToneBefore10Oct`.
- **The caption guard (`check-captions`) had to follow the cropped cards.** It pins each senior card's sha1 to the name, nationality, age and height printed in the card's banner, read by hand on 3 Sep. Rob's crop removed that banner, so all 204 audited cards failed as "artwork changed". Each new card was checked against the card that was read: same width, shorter, and its pixels are that card's top. The mean difference is 0.8–1.8 (out of 255; WebP re-encoding), against 8–71 when compared with any other card (`docs/proof-10oct/step3/senior-cards-crop-check.json`, all 205). So each 3 Sep reading was carried to the cropped file, with `croppedFrom` = the sha1 of the card that was read (`scripts/captions.json`), and the guard's header says so. The guard passes. A card replaced from now on can't be read from the picture (Q-12).

**On a copy of the 2 Oct backup** (MD5 `f2c55790…` before and after; only copied): all 49 had their old tone; after one boot of this build all 49 have their new picture's band, and all 120 AI club players' tones equal their cards' (`docs/proof-10oct/step3/backup-copy-tones.txt`).

**New checks** (run in step 4):
- `player-pictures`, new section 5: the boot list is exactly the 49; on an older save still on the old tones, the 48 left on their old tone are brought forward; one deliberately set to a third tone is left alone; one with no tone is given the starter DB's; career copies keep no tone of their own; a second boot changes nothing.
- `pool-skin-tones`: the script's 96 picture bands; a tone a save already has is not overwritten by the starter DB's.
- `unity match-state`: an AI club player whose tone changed is bought and made a Match Player, and she is on Rob's side of the payload with her new picture's band.
- The AI court proof now chooses a match whose AI pair includes a changed tone, buys that player, and checks her on Rob's side too.

### 4. The suites alone, then the AI court in Auto

**The suites, alone, one after another, on `d86b217`** (built: typecheck, build, sync; each on its own copy of the starter DB; run as the full harness runs them, the staff roll off): `docs/proof-10oct/step4/solo-*.txt`.

| Suite | Result | Time | The 10 Oct checks |
|---|---|---|---|
| `player-pictures` | **35/35** | 25 s | the boot list is the 49; on an older save 48 of 48 still on the old tone get the new; the one set to a third tone is left alone; the one with none gets the starter DB's; no career copy keeps a tone of its own; a second boot changes nothing. Section 4: all 96 new pictures' tones = their bands in the starter DB |
| `ai-buyable` | **25/25** | 22 s | (unchanged suite: AI players are still bought on the same rules) |
| `unity match-state` | **11/11** | 1 s | bought Annika Bauer (EUR_01_P1, Medium Dark → Medium) and made her a Match Player: Rob's side of the payload has her as **Medium**, her picture's band and her pool tone (before this fix it would have been no tone: Rob's side read only `player_v4`) |
| `pool-skin-tones` (also changed) | **5/5** | 6 s | re-running the tone script changes nothing (96 from Rob's pictures); a tone a save has is not overwritten by the starter DB's |

ALL SOLO SUITES PASSED.

**The AI court proof in Auto** (`scripts/webgl-proof/ai-court-proof.mjs --mode auto --until-finished 900 --gpu`; headless Chrome, real GPU; `docs/proof-10oct/step4/ai-court-auto.txt` and `ai-court-auto/`): **17/17**.
- A new Sydney Riptide career; its first match is against **Rome Beach Gladiators**, whose pair both changed tone on 10 Oct: **Giulia Ricci** (Light → Medium) and **Valentina Bianchi** (Dark → Medium).
- Giulia was bought on the Player Market, so the club played its replacement, **Camila Santiago** (a national senior, not one of the 120 AI cards), with Valentina. Each picture is served (HTTP 200). On the court Valentina is **Medium**, her new picture's band; Camila is Medium Dark (her nation's tone, as before).
- **Giulia, now Rob's, was put in his pair:** the match-state and the court's own loader log both have her on the home side as **Medium**, her new picture's band (`player_senior_ai_eur_04_p1.webp`, 200).
- The court's loader put exactly that pair on the away side with those tones. Auto ran with no manual code. **The match was played to its end in Auto: 2-1 (11-6, 11-13, 11-6), recorded completed.** No page errors.

The 3D court shows no pictures (it draws the players in 3D): "the tone on the court equals her picture's band" is checked from the court's data and its own loader log, as on 6 Oct.

### 5. Full harness on `launch-final`

**Run #1, at `da18281` (the step 4 proof commit; its code is `d86b217`'s, and every commit after `d86b217` is `docs/` only): 104/104 suites, 1,713 checks, ALL HARNESSES PASSED** (22:06–23:10; `docs/proof-10oct/full-harness-da18281.txt`). 1,713 = 6 Oct's 1,703 + this run's 10 new checks (player-pictures 7, unity match-state 2, pool-skin-tones 1). The typecheck stage includes `check-captions` (OK on the cropped cards) and `check-image-formats`. It passed first time, so no fix and no second run. Nothing else ran during it, and the run left the tree clean (no tracked file changed).

### 6. Package `C:\build\vbe-final-10oct\win-unpacked`

**Done.** Built from **`da18281`**, the commit the harness passed on: the worktree was checked out at exactly that commit for the build, then went back to the branch. The steps: the Unity data Brotli-compressed (`compress-unity-data`; already up to date), the workspaces rebuilt from that commit, then `electron-builder --win dir` into `C:\build\vbe-final-10oct` (615 MB).
- **Before-pack:** only the Brotli Unity data was packaged (the raw `.data`/`.wasm` stripped), and better-sqlite3 loads under Electron. **After-pack:** the starter DB alone (no -wal/-shm), no `steam_appid.txt`, steamworks.js unpacked (`docs/proof-10oct/package-checks-da18281.txt`).
- The packaged starter DB is the branch's (MD5 `9e8c01d1…` both, with the 49 new tones). The packaged `.data.br` is the same file as 6 Oct's (MD5 `1f5b912b…`; Unity unchanged). The packaged frontend has the new card layout and the packaged server has the tone correction.
- **Booted on a copy of your 2 Oct backup** (MD5 `f2c55790…` before and after; the original was only copied), with the package's own exe as its server, never the app (`docs/proof-10oct/boot-final-da18281.json`):
  - **Your career loaded:** profile Rob, Sydney Riptide, $247,731, 24 Apr 2026, 3 players, 2 staff.
  - The page is served, and the Unity data and wasm are served Brotli.
  - **The pictures are served, and they are yours:** the package's 205 senior cards and 96 AI pictures are byte-identical to the files in your `PICTURES-10OCT` folder. Valentina Sosa's cropped card was served at 200, the same 55,574 bytes as your file. Annika Bauer's new AI picture was served at 200, 61,076 bytes, the same as your file. A graduate's picture was served at 200.
  - The Player Market lists 120 AI club players, 96 with your new pictures.
  - **The skin tones:** all 49 had their old tone in the save copy, all 49 have their new picture's band after the boot, and all 120 AI club players' tones equal their cards'.
- **Your live save is unchanged:** only its date and size were read, before and after (10 Oct 21:35:40, 2,314,240 bytes); it was never opened.
- **The fallbacks were not touched:** `C:\build\vbe-final-06oct` (last changed 6 Oct 17:21) and `C:\build\vbe-launch-05oct` (5 Oct 16:34).

### 7. Final check

| Branch | Head = harness = package = GitHub | Full harness | Package | Boot on copy |
|---|---|---|---|---|
| **`launch-final`** (6 Oct join + 10 Oct pictures) | **`da18281`** for the harness and the package. GitHub's head is this status commit; every commit after `d86b217` (the last code commit) is proof files and this report under `docs/` (`git diff --name-only d86b217 HEAD` lists nothing outside `docs/`), so head, harness and package run the same code. Pushed after every step; local = GitHub | **104/104 suites, 1,713 checks, ALL HARNESSES PASSED** at `da18281`, 22:06–23:10, first run (`docs/proof-10oct/full-harness-da18281.txt`) | `C:\build\vbe-final-10oct\win-unpacked`, built from `da18281`; before-pack and after-pack OK | **Yes**: Sydney Riptide loaded, $247,731, 24 Apr 2026; your 205 + 96 pictures served byte for byte; 49 of 49 tones brought forward; live save unchanged (`boot-final-da18281.json`) |
| `fix-batch-29sep` (launch fallback, untouched) | `636f4a2`, the same on GitHub | 101/101 at `715073e` (5 Oct) | `C:\build\vbe-launch-05oct`, not touched (5 Oct 16:34) | Yes (5 Oct) |

`main` is `2c17431`, locally and on GitHub, unchanged. `C:\build\vbe-final-06oct` (the 6 Oct package) was not touched (6 Oct 17:21).

**The brief, re-read top to bottom:**
- **Extract and check:** done. 205 + 96 pictures, the same names as in the game. Only the senior cards' height changed. 96 reshuffle rows, 49 tone changes, and the Korean picture at `ASI_03_P2` left white. The zip's own top folder put the files one level down (note at the end).
- **Rules of engagement:** kept.
  - **The live save was never opened.** Tests used copies of the starter DB, and the backup checks used copies of the 2 Oct backup (MD5 unchanged). Only the live save's date and size were read.
  - **Your files were never moved, renamed or edited:** `PICTURES-10OCT\` was only copied from. No music changes. No Steam upload. The ElevenLabs key check passed on every push (7 pushes).
  - **One full harness at a time:** one run; nothing else ran during it. **Committed and pushed after each step.** Nothing merged into `main`.
  - **The fallbacks were kept:** `vbe-final-06oct` and `vbe-launch-05oct` were not touched.
  - **Pathways that would not take the change were rebuilt, not patched over:**
    - the card's picture rule (one line, the 2:3 assumption gone);
    - the tone script (Rob's pictures give the tone, instead of a draw that was then overwritten);
    - the boot sync (fill-only, instead of follow-and-correct);
    - the court's home-side tone (one rule: her own data, else her pool player's);
    - the caption fixture (each reading re-pinned with where it came from, not the guard switched off).
  - **The report** was written as the steps went: summary first, "What Rob must check on screen" and "Questions for Rob" at the end.
- **1:** done. The 205 cards were copied. The layout depended on 2:3 and was fixed in the card (the one component that draws them). Checked on Team, Player Market, At AI Clubs, the pop-up (the lightbox, the only pop-up with her picture) and the Contracts avatars, at three window sizes, before and after.
- **2:** done. The 96 AI pictures were copied.
- **3:** done.
  - The 49 tones were changed in the starter DB and in every save at boot, by `stable_id`, only where the old tone remains. The game keeps an AI player's tone in one place (the AI player table), and `/unity/match-state` reads it there; her career copy has no `player_v4` of its own (checked).
  - `ai-senior-cards.json` was updated (`robSource`, `imageBand`, `skinTone`, plus the reshuffle's fields).
- **4:** done. `player-pictures` 35/35, `ai-buyable` 25/25 and `unity match-state` 11/11 passed alone (and `pool-skin-tones` 5/5, which this run changed). The AI court proof in Auto passed 17/17: each AI player's tone on the court equals her new picture's band, on the away side and, once bought, on yours. A full match was played.
- **5:** done. Passed first time, every suite.
- **6:** done. The package was built from the commit the harness passed on, and the before-pack and after-pack checks passed. On a copy of the 2 Oct backup your career loaded, the pictures were served, and the live save is unchanged.
- **7:** this table and this re-read.

Stopped here.

## What Rob must check on screen

All in **`C:\build\vbe-final-10oct\win-unpacked`**. Make a backup of your save first, as always.

1. **Your career loads** as before (Sydney Riptide).
2. **The senior cards, without the banner** (Team page, Player Market): her head at the top of the card, no dark band under her, the name down the left and the OVR column on the right as before. At 1280×720 a little of each side of the picture is now off the card (up to 11% each side for the shortest pictures) instead of a dark band at the bottom. Click a card: the pop-up shows the whole picture.
3. **Player Market, At AI Clubs:** the 96 new pictures, each in her country's colours. Min-Seo Kim (Korea) is in white, as you meant.
4. **The court:** Watch Match against an AI club. Each AI player's skin matches her new card. **Buy one** and put her in your pair: on your side of the court she now has her card's skin tone too (before, she had none).

## Questions for Rob

Where the decision was yours, I took the safest option and carried on. Each one is easy to change.

- **Q-12 (new) The caption check can no longer read the cards.** Since 3 Sep a build check has held each senior card to the name, country, age and height printed in its banner, read by hand. The banner is gone, so I carried each reading over to the cropped card, after checking pixel by pixel that each cropped card is the top of the card that was read. If a senior card is replaced from now on, nobody can tell from the picture who she is. Should the uncropped originals be kept somewhere for that, or is the check against the old reading enough?
- **Q-13 (new) The cards now fill their frame by trimming the sides.** I chose this over leaving a dark band under the shorter pictures, which also happened before with your 3:4 AI and graduate pictures (34 px at 1280×720). At 1280×720 up to 11% of each side of the shortest pictures is off the card; at larger windows nothing is off the sides and less is off the bottom than before. Fine, or would you rather see the band?
- **Q-14 (new) A save's AI skin tones no longer follow the starter DB blindly.** Until now every boot copied the starter DB's AI skin tones over the save's. Now a tone is only filled where a save has none, and a change reaches a save only through a list like today's 49, and only where the old tone is still there. That is the rule this brief asked for; it means a future tone change must be listed in `utils/aiSkinTones.ts`. Fine?
- **Q-15 (new, for your information) A bought AI player had no skin tone on your side of the court.** Your side read only the player's own appearance data, which an AI club player bought from the market (or taken over with a club through the job market) doesn't have, so the court drew her with its default. Your side now uses her AI player's tone, which is her picture's. Say if that is wrong.
- **Note: the zip has its own top folder,** so `Expand-Archive` to `Downloads\PICTURES-10OCT\` put the files in `Downloads\PICTURES-10OCT\PICTURES-10OCT\`. I left it as it is (your files: copied from, not moved).
- **Note: your live save was written at 21:35:40 today** (2,314,240 bytes), 30 seconds after I extracted the zip. No server, proof or app of this run had started by then (the first one started at 21:42), and none of them ever used that file, so I took it to be your game closing. From then on it was only looked at (date and size), never opened.
- **The questions from 5 and 6 Oct** (Q-1 to Q-3, Q-5 to Q-9, Q-11; `STATUS-06OCT.md`) stand as decided then. Q-1 (the pictures' size) now reads with Q-13: the cards fill their frame, and the whole picture is in the pop-up.
