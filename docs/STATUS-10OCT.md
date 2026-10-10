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

## What Rob must check on screen

(Filled in at the end.)

## Questions for Rob

(Filled in at the end.)
