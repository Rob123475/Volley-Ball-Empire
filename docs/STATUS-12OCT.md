# Monday brief (11–12 Oct 2026): status

Brief: `C:\Users\rbonn\Downloads\MONDAY-BRIEF-11OCT.md`. Game repo branch `launch-final` (worktree `C:\vbe-final`, started at `92666c9`); Unity repo `volleyball-unity` branch `feat-manual-controls` (started at `dd7465d`).

## Summary

(Written as the items go; finished at the end.)

## Items

### A. Manual mode: the first touch after the serve reaches the teammate

**Done.** Unity `3e311a4`.

**What the code does (read on `dd7465d`), and what I measured.** The brief's reading was right about the formula: the dig (PASS) is aimed 1.0–2.0 m around the teammate who sets, times the digger's `defenseFactor`, ×1.35 in light rain. Three things are different from the brief:
- **The serve-difficulty factor never applies.** `_isServeActive` is cleared just before the dig's target is computed, so that branch is dead today. (Left as it is: changing it would change Auto.)
- **The setter already starts moving the moment the dig is struck.** She is that step's receiver, and `UpdateRally` sends her to the landing spot from the first frame.
- **A manual setter's ring already shows at the strike** (`StartRallyStep` → `NotifyManualBallComing`).

The real offsets are small. In the batch proofs (prefab ratings) the first dig after a serve landed **0.15–0.29 m** from the setter, in Auto and in Manual (`docs/proof-11oct-pm/unity/*-A-before.txt`). By the game's own formula over **all 312 seniors and AI club players** (`scripts/webgl-proof/dig-spread.cjs`, `docs/proof-11oct-pm/dig-spread.json`):

| Digger | Furthest the dig can land |
|---|---|
| Fresh | 0.39 m |
| Her match stamina spent | 1.04 m (only 2 players over 1.0 m) |
| Spent, in light rain | 1.41 m |

So I could not make 4–5 m happen from the dig target itself. **If you still see your partner stranded in the new build, tell me which touch it was** (your dig, her dig, or the set after it), and whether you were moving your player at the time.

**The fix, as the brief asked (Manual only):**
1. **Tighter dig:** the first dig after a serve by your team (you or your partner digging) lands within **1.0 m** of the teammate who sets (`FirstDigAidRadius`). The digger's own spread still decides where inside that, and a good digger's own spread is already smaller.
2. **The set after it:** unchanged (0.5–1.5 m).
3. **The teammate moves early:** already so in the code (above), and now proved: the setter stood 0.00–0.35 m from the spot as the dig came down, and your ring was up at the strike every time.
4. **Auto:** unchanged.

**Proof (Unity batch, `docs/proof-11oct-pm/unity/`):**
- **`ManualControlsProof`: PASS.**
  - To give the aid work, your team digs weakly (defence 5) in light rain, and the home point chance is 0.42 so the other side serves more often.
  - Over **43 points in Manual**, there were **20 first digs** by your team (13 set by you). **All landed within 1.0 m** of the setter (0.63–1.00 m); **without the aid, 4 would have landed over 1.0 m** (up to 1.18 m).
  - Your ring was up at the strike **13 of 13** times, and **every next touch was made (20 of 20)**.
  - Every other check still passes: positions, the meter, the ace, all actions on both devices.
- **`RallyPlanProof` (Auto): PASS.**
  - **48 first digs at 0.15–0.30 m (mean 0.23), none aided**, the same spread as before the change (54 digs at 0.16–0.29 m, mean 0.23).
  - Every other check passes.

### B. The controls panel: how to hide it

**Done.** Unity `4674c7f`.
- **Hint line** at the top of the panel, in the prompt's amber: `Hide: D-pad down · H · or click ×`.
- **The ×** in the panel's top-right corner hides it with a mouse click. It is drawn as "×" rather than "✕", because the game's font has ×; a missing glyph would show as a box.
- **The `Controls` button** sits at the court's bottom-left while the panel is hidden (Manual only). A click, D-pad down or H shows the panel again.
- **Remembered** for the rest of the match. The panel still shows by itself the first time Manual is turned on, as before.
- **Mouse:** only these two buttons take clicks on that canvas; everything else on it is still click-through. The old "Hide this" line is gone (the hint replaces it).

**Proof:**
- **`ManualControlsProof`: PASS.** The panel is shown with no Controls button; × hides it and Controls appears; Controls brings it back (`docs/proof-11oct-pm/unity/manual-B.txt`). Every other check still passes, item A's included.
- I also fixed one proof check: the movement test now takes the furthest the stick moved her. A point ending mid-test had walked her back and read 0 m.
- **In the browser, real GPU, on the new export** (`docs/proof-11oct-pm/controls/`):
  - **`controls-shown.png`**: the panel with the amber hint line and the ×.
  - **`controls-hidden.png`**: after a real mouse click on the ×, the panel is gone and **`Controls`** is at the bottom left.
  - `controls-shown-again.png`: after clicking `Controls`.

  The court logged each click ("controls panel hidden" / "shown").

### The Unity export (A and B)

**One WebGL export** of Unity `4674c7f` (`WebBuild.Step7`, Succeeded), copied into `launch-final` under the deployed names. Brotli regenerated: data.br 217.0 MB, wasm.br 9.0 MB.

### C. The 96 AI pictures

**Done**, after `READY.txt` (approved 9:34 pm).
- **Kept first:** the current 96 are zipped to `C:\build\_KEEP-originals\ai-pictures-11oct-cleaned.zip` (96 files, 7,219,436 bytes).
- **Installed:** the 96 from `Downloads\PICTURES-11OCT\` were copied over the same names in `artifacts/beach-volleyball/public/images/players/seniors/ai/`. All 96 are byte-identical to the delivered files; 95 changed, and Min-Seo Kim (`ASI_03_P2`) was delivered unchanged. No database change. Nothing in `PICTURES-11OCT` was moved, renamed or deleted, and the before-after PNGs are not committed.
- **Checked before installing:** 96 files with the same names; all WebP at 600x800; no two the same.
- **Checks:** `check-image-formats` OK; `check-captions` OK ("no artwork has changed since it was read").
- **Two things I saw comparing each picture with its 5 Oct original.** Away from the body, only two pictures changed:
  - **`EUR_03_P1` Élise Fontaine:** part of her umbrella is still tinted red/blue (a patch about 3,000 px at the left, x≈44, y≈263). `READY.txt` says the umbrellas are unchanged.
  - **`SAM_08_P2` Andreína Colmenares:** a patch of about 1,500 px changed at the right (x≈422, y≈303).

  You approved the set, so both are installed as delivered. They are in the on-screen checks below.

## What Rob must check on screen

(Filled in at the end.)
