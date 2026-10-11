# Monday brief (11–12 Oct 2026): status

Brief: `C:\Users\rbonn\Downloads\MONDAY-BRIEF-11OCT.md`. Game repo branch `launch-final` (worktree `C:\vbe-final`, started at `92666c9`); Unity repo `volleyball-unity` branch `feat-manual-controls` (started at `dd7465d`).

## Summary

All three items are done, and the new package is **`C:\build\vbe-final-12oct`**, built from `launch-final` **`7f81091`**. It is not uploaded to Steam, and nothing was merged into main.
- **A. The first dig in Manual:** after the other side serves, your team's first dig now lands within **1.0 m** of the teammate who sets. Auto is unchanged. Proved over 43 Manual points: 20 first digs, all within 1.0 m. The Auto spread was the same before and after.
- **B. The controls panel:** it now has an amber hint line (`Hide: D-pad down · H · or click ×`) and a **×** in its corner. A **`Controls`** button at the bottom left brings it back, and your choice holds for the match. Proved in Unity and in the browser with real mouse clicks.
- **C. The 96 AI pictures:** your new set is installed (95 changed, Min-Seo Kim unchanged) and both checks pass. The previous 96 are kept in `_KEEP-originals`. Two pictures differ from their originals away from the body: **Élise Fontaine's umbrella** and a patch on **Andreína Colmenares**. Please look at both (check 5).
- **The full harness passed once:** 104 of 104 suites at `7f81091`. The package's before-pack and after-pack checks passed. It booted on a copy of the 2 Oct backup with your career intact. The fallback packages and the live save were not touched.

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

## Build

- **Unity:** `feat-manual-controls` committed and pushed: `3e311a4` (A), then `4674c7f` (B). **One WebGL export** of `4674c7f`, Brotli, in `launch-final` (above).
- **Full harness, run once at `launch-final` `7f81091`: ALL HARNESSES PASSED, 104 of 104 suites** (`docs/proof-11oct-pm/harness-7f81091.txt`). A first attempt stopped before any suite ran: pnpm's dependency check refuses a worktree whose `node_modules` points at the main tree. I set the usual worktree flag and ran it again; no code changed.
- **Package:** `C:\build\vbe-final-12oct\win-unpacked`, built from `7f81091`, the harness commit (`docs/proof-11oct-pm/package-checks-7f81091.txt`).
  - **Before pack:** only the Brotli Unity files are shipped (the raw `.data` and `.wasm` were stripped), and `better-sqlite3` loads under Electron.
  - **After pack:** the starter DB has no `-wal` or `-shm`; there is no `steam_appid.txt`; `steamworks.js` is unpacked with its DLL.
- **Boot on a copy of the 2 Oct backup** (`docs/proof-11oct-pm/boot-final-7f81091.json`):
  - the app shell, `data.br` (217.0 MB) and `wasm.br` (9.0 MB) all served;
  - the Unity export in the package is the same as `launch-final`'s;
  - your career loaded: Sydney Riptide, 24 Apr 2026, budget $247,731;
  - 120 AI-club players, 96 of them with the AI pictures;
  - **the 96 AI pictures in the package are byte-identical to the newly installed set**;
  - the 205 cropped senior cards are still yours, and all 120 skin tones match their cards;
  - the save gained the staff and job-market columns as before.
  - (One label in that file is from yesterday's script: "1 of 96 still Rob's 10 Oct files" means Min-Seo Kim; the other 95 are now tonight's set.)

## Rules kept

- **Fallbacks untouched.** Their times are the same as before this brief: `vbe-final-11oct` (live on Steam, 11 Oct 18:33), `vbe-final-10oct` (10 Oct 23:11), `vbe-final-06oct` (6 Oct 17:21), `vbe-launch-05oct` (5 Oct 16:34). In `_KEEP-originals` the two older zips are unchanged, and only the new zip was added.
- **Live save never opened, only stat'ed.** Its time is 19:25 tonight (11 Oct), 2,314,240 bytes. That is your play since the 11 Oct build; it was the same before and after the boot check.
- **No merge into main. No Steam upload. No music changes.**
- **Nothing in `Downloads\PICTURES-11OCT` was moved, renamed or deleted.** The before-after PNGs are not committed.
- **Dead code removed:**
  - the old "Hide this" line in the panel;
  - the line that switched off mouse clicks on the panel's canvas.
- **Committed and pushed after each item.** The ElevenLabs key check passed on every push.

## What Rob must check on screen

1. **The first dig in Manual.** Start a match in Manual and let the other side serve. When you or your partner dig the serve, the ball should come down within about a metre of whoever sets, and that player should already be moving to it. If someone is still stranded, tell me which touch it was (your dig, her dig, or the set after it).
2. **Auto feels the same** as in the 11 Oct build.
3. **The controls panel.** In Manual, the panel shows the amber line `Hide: D-pad down · H · or click ×`.
   - Click the **×**: the panel goes and **`Controls`** appears at the bottom left.
   - Click `Controls`, press H, or press D-pad down: the panel comes back.
   - After a point or two, it stays the way you left it.
   - The boosts still work with the mouse.
4. **The new AI pictures.** Open the market or an AI club and look through the AI players' pictures.
5. **Élise Fontaine (`EUR_03_P1`):** part of her umbrella still looks tinted red/blue. **Andreína Colmenares (`SAM_08_P2`):** a patch on the right of the picture changed. If either is wrong, the old set is in `C:\build\_KEEP-originals\ai-pictures-11oct-cleaned.zip`.
6. **Your career** opens as before in `C:\build\vbe-final-12oct\win-unpacked\Beach Volleyball Empire.exe`. Use a copy of your save if you want to be safe.
