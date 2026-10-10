# Pictures brief Sat 10 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\PICTURES-BRIEF-10OCT.md`, steps 1 to 7 in order, worktree `C:\vbe-final`, branch `launch-final` (started at `6120604`, the 6 Oct status commit; code `b311e6c`).

## Summary

(Written as the steps go; finished at step 7.)

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

## What Rob must check on screen

(Filled in at the end.)

## Questions for Rob

(Filled in at the end.)
