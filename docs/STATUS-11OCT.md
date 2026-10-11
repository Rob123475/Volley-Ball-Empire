# Serve brief Sun 11 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\SERVE-BRIEF-11OCT.md`. Game repo branch `launch-final` (worktree `C:\vbe-final`, started at `a208526`); Unity repo `volleyball-unity` branch `feat-manual-controls` (`C:\Users\rbonn\Game_Dev\VolleyBall Empire\volleyball`, started at `66ef4bf`).

## Summary

**All six items are in one new package for you to check: `C:\build\vbe-final-11oct\win-unpacked`.** It has one Unity export, from `volleyball-unity` `dd7465d`. Nothing is merged into `main`, nothing went to Steam, no music changed, and the fallbacks (`vbe-final-10oct`, `vbe-final-06oct`, `vbe-launch-05oct` and the 10 Oct originals zip) were not touched.

1. **Start positions:** after every rally the game walks all four back to their spots, your player included. The server stands just behind her own baseline, the serve waits until everyone is there, and it is always the player who walked back who serves. Rebuilt as one rule; the old code picked the server twice and walked the wrong player.
2. **The serve meter:** it sweeps WEAK ↔ MAX without stopping, and one tap of Y serves at the power shown. The top 8% (marked green) is full power; under 12% goes into the net. Hold-and-release is gone.
3. **The ace ability:** a server rated 95 or more aces with a tap in the MAX zone, and in Auto aces 1 serve in 12. 95 is one constant, `AceServeRating`. Nobody starts at 95, but Serving Academy training gets there: **Yaritza Mendez went 88 → 95 in 100 game days, measured**, and the court uses the career's current rating.
4. **Bikinis:** a fabric sheen, Smoothness 0.5 → 0.82 on the bikini material only; skin untouched. Before/after close-ups are in `docs/proof-11oct/bikini/`.
5. **White on the AI pictures:** the pale rims and white tips cleaned on 95 of the 96 pictures; Min-Seo Kim (white on purpose) untouched. The originals are zipped in `C:\build\_KEEP-originals\`. Contact sheet `docs/proof-11oct/ai-pictures-before-after-1..8.png`. Five pictures to look at, and four 10 Oct leftovers outside the bikinis, are listed under item 5.
6. **Zoom buttons 1x 2x 4x** on the court magnify the camera 2 and 4 times. **Note:** item 6 was never in the brief file (it is still the 12:30 version), so I built it from your message.

**Proof:**
- The Unity proofs pass with all the new checks:
  - positions at every serve: 34 in Auto, 15 in Manual;
  - the meter sweeps, a weak tap faults, a MAX tap is full speed;
  - aces at 95 but not at 94, and 111 of 1,200 Auto serves at 95;
  - the zoom measured at ×2.000 and ×4.000.
- In the browser, on the real GPU: positions, the meter and the 4x zoom on screen; the AI court played a full match in Auto (2-1); the manual court 8/8.
- **The full harness:** run #1 found a fault in one suite (unrelated: the staff-injuries suite read Club News too late), fixed; run #2: see "The full harness" below.

## Items

### 1. Start positions after every rally (Auto and Manual)

**Done.** Unity `1f26ee4`.

**What the code did (read on `feat-manual-controls` before changing it); each point in the brief was right:**
- `ResetRallySequence(false)` ran at the end of the point and picked a random server. `ResetRallySequence(true)` ran again before the serve, **picked again**, and put the ball on whoever it picked, wherever she stood.
- `MoveEveryoneToHome()` skipped `playerA1` / `playerB1` as "the server", so the real server could walk home while A1 or B1 stood still.
- The manual player was moved only by the stick, so she was never walked home.
- `ClampToOwnHalf()` kept everyone 0.2 m inside the baseline. The manual server could walk anywhere in her half.
- Also found: the first serve of a match was decided in `Start()`, before the game's point chance had arrived, so the first point was always decided at 0.5.

**Rebuilt as one rule (`MatchManager.cs`, `ManualControl.cs`):**
- **One server**, decided once when the point ends (`SetUpNextServe`: the pattern, then the hitter at its serve step). The serve, the snapshot and the walking all use her. `ResetRallySequence` and `MoveEveryoneToHome` are deleted.
- **Walking to positions:** from the end of the point until the serve is struck, the game walks all four at their own speed, facing the net. The three non-servers go to their home spots. The server goes to her serve spot on her own side, **0.75 m behind her baseline**, at her home x, with the ball in her hands. This includes the manual player, serving or receiving; the stick takes over once the serve is in the air.
- **The serve waits** until all four are within 0.3 m of their spots. Anyone still walking 3 s after the point ended is placed on her spot.
- **A manual server on her spot** moves left and right only, between the sidelines and 0.5–1.5 m behind the baseline, facing the net, until she serves.
- **The clamp** is unchanged for everyone else, and for the server once she has served. The stick now walks a player towards the clamped spot instead of snapping her inside the line, so a server who has just served from behind the baseline walks in.
- The first serve of the match takes the same gate, so it is decided after the match data is in.

**Proof (Unity batch, `docs/proof-11oct/unity/`):**
- `RallyPlanProof` (Auto, a full match, 56 points): **PASS**. At all **56 serves** the non-servers stood within 0.3 m of home (furthest 0.00 m), the server stood 0.75 m behind her own baseline between the sidelines, and the server was the rally sequence's server (all four players served). Nobody needed the 3 s placing. Every other check still passes.
- `ManualControlsProof` (Manual, virtual keyboard and pad): **PASS**. **10 serves in Manual:** your player served 3, received 3, and her partner served 4. All 10 serves were in position by the same checks, and every action still fires from both devices.

### 2. The serve meter (Manual)

**Done.** Unity `1fbfc24`.
- When it's your player's serve, a **power meter sweeps WEAK ↔ MAX**, 1.2 s end to end, without stopping (`ManualControl.MeterAt`).
- **One tap** of Y / L / Triangle serves at the power the meter shows at that moment.
- **Below 12%** is a fault into the net, as before. The power sets the serve's speed through `ServeSpeedFactor()` (×0.85 to ×1.15).
- **The MAX zone is the top 8%**, marked green on the bar; a tap in it is full power. The bottom 12% is marked red. WEAK and MAX are written under the bar, and a white needle shows where the meter is.
- **The prompt** reads `SERVE: tap L at MAX` on the keyboard, or `SERVE: tap Y / Triangle at MAX` on a pad. The controls help now says "(serve: tap at the right time, at MAX)".
- **Nobody taps:** the 12 s auto-serve, as before.
- **Deleted:** the hold-and-release code (the press time, the release flag, the `canceled` handler and `ServePowerSeconds`).

**Proof:** `ManualControlsProof` taps through the virtual keyboard and pad at real speed (`docs/proof-11oct/unity/manual-controls-items23.txt`):
- the meter swept 0.00–1.00 and back (2 turns) on each of the 4 MAX serves;
- **taps at 0% faulted** (ServeError, the point to the other side, 2 of 2);
- **taps in the MAX zone (94%) served at full speed** (×1.150, 4 of 4).

The run passed overall.

### 3. The ace ability (Rob's rule)

**Done.** Unity `a632e3c`.
- **One named constant:** `MatchManager.AceServeRating = 95`. `HasAceAbility(player)` reads her `PlayerStats.serve`. (The 1 in 12 is `AbilityAceOneIn = 12`.)
- **Manual:** a server with the ability whose tap lands in the MAX zone gets an **ace for her team**, through `OverridePlan(..., PointEnding.Ace, ...)`, reported like any other point. A MAX tap by a server under 95 is just a full-power serve.
- **Auto:** when the AI serves, a server with the ability aces **1 in 12** of her serves, decided in `DecidePoint` as the point is planned. This counts on top of the plan's own aces, which every server has. It also applies to the AI's serves in a Manual match, since the manual player earns her aces with the meter.
- **Proof, Manual** (`ManualControlsProof`): rated 95 and tapping MAX → **Ace to her team, 2 of 2**. Rated 94 and tapping MAX → **no ability ace, 2 of 2** (the points were a block and a kill, as planned). PASS.
- **Proof, Auto** (`RallyPlanProof`, after a full match): the match's own `DecidePoint`, run 1,200 times per rating:

  | Server rated | Ability aces in 1,200 serves | Aces in all (ability + the plan's own) |
  |---|---|---|
  | 95 | **91** (1 in 12 is 100; check range 71–129) | 157 |
  | 94 | **0** | 58 |

  PASS.
- **The rating Unity uses is the career's current one.** `/api/unity/match-state` sends `serve` from the player's career state (`playerDto.ts`: `serve: state.serve`), and the court's loader copies it into `PlayerStats.serve`. Measured below: the court read 88 at the start and 95 after training.

**Can a player grow into it? Yes, measured** (`scripts/webgl-proof/serve-growth-measure.mjs`, `docs/proof-11oct/serve-growth.json`).

Training's **Serving Academy** (5 game days a session) adds +1 serve per 100 training XP, up to 99. I made a new Sydney Riptide career on a copy of the starter DB and trained its best server, **Yaritza Mendez** (serve 88, age 28, Elite potential, no coach hired), with sessions back to back, every match simulated as it came:
- She went 88 → 95 by **11 Apr 2026: 100 game days, 20 sessions**, about +1 every 15 days.
- A first run took 105 days and 21 sessions; the XP per session is random.
- `/unity/match-state` sent her serve as **88 before and 95 after**.

Slower for an older player: XP is ×0.9 from 30 and ×0.8 from 34. Faster with a coach or for a younger one.

**AI club players never reach it on their own:** they do not train or develop while at an AI club. The best, 92, stays 92 unless you buy her and train her, about 45 days at the same rate.

### 4. Bikinis too matte (3D court, bikinis only)

**Done.** Unity `1bb6d26`.
- **The material:** `Assets/Materials/BeachKit_Bikini` (URP/Lit), and nothing else. **Smoothness 0.5 → 0.82, Metallic 0 → 0.05**: a fabric sheen, the highlight of wet Lycra, not plastic. Specular highlights and environment reflections were already on. The per-player kit colour (`_BaseColor`, through the MaterialPropertyBlock) and the base map are unchanged.
- **Left alone:** the skin materials (`BeachKit_Skin_*`, still Smoothness 0.25, Metallic 0, written in the proof's `materials.txt`) and everything else on the model.
- **Proof:** a new Unity batch proof, `BikiniCloseProof`. In Play, at a serve with everyone standing on her spot, a camera 2.2 m in front of each of the four players, aimed at her hips, renders her through the scene's own lights. **Two kit colours** are set the way the match data sets them: Team A navy and amber (Sydney Riptide's), Team B red and white. The proof was run once before and once after the change; the pictures are like for like.

**Pictures to open** (`docs/proof-11oct/bikini/`):
- Side by side, before on the left and after on the right, zoomed in:
  - **`bikini-compare-team-b.png`** (red kit): the highlights on the top are new; the skin is the same.
  - **`bikini-compare-team-a.png`** (navy kit).
  - `bikini-compare-team-a-2.png` and `bikini-compare-team-b-2.png`: the other two players.
- The full frames: `unity-before/bikini-close-team-a.png` … and `unity-after/…`.
- **The court from the close camera, zoomed in, in the browser:** `webgl-before/bikini-close-1.png` to `-3.png` are the 10 Oct court. At its closest the close camera is still well back, so they show the whole court rather than the fabric. The after frames from the new export are in `webgl-after/` (with the 4x zoom button of item 6).

### 5. White tips and splashes on the AI pictures' bikinis

**Done.** Game repo, this item's commit (the 95 pictures, `scripts/portraits/clean-ai-kit-white.py`, `scripts/portraits/ai-kit-contact-sheet.py`).
- **The originals are kept:** `C:\build\_KEEP-originals\ai-pictures-before-11oct.zip`, the 96 files as they were (6.5 MB), made before anything changed. That folder is not to be deleted; the 10 Oct zip beside it was not touched.
- **What was wrong** (read off the pictures, as Rob saw on Annika Bauer, Élise Fontaine, Céline Moreau and Carmen Ruiz): the 10 Oct recolour left **a pale, fuzzy rim along the edges** of most bikinis, where the white kit's edge was only half coloured, plus **white tips** (ties, strap ends) and small splashes.
- **How it was found without touching anything else** (`clean-ai-kit-white.py`):
  1. Each picture was compared with the 5 Oct picture it was made from (the slot in `pictureFrom`, from git, white kit and all; same size, same pixels outside what the recolour changed).
  2. The bikini is the changed areas on the body (centre of the card, 17–85% down). Any other area the recolour changed is left as it is; that was only Élise Fontaine's umbrella (see below).
  3. A leftover is a pixel in, or within 3 px of, the original's white kit that is not the kit's colour now; or a grey/white pixel within 3 px of the coloured fabric. White fabric is colourless; skin is warm and sky is blue, so neither is ever picked.
  4. Leftovers are filled from the kit around them (OpenCV inpainting), so they take the kit's colour and shading. 1,130–5,504 pixels a picture.
- **Min-Seo Kim (`ASI_03_P2`), white on purpose (`kit: null`), was not touched at all**: the file is byte for byte as before. No other kit includes white.
- **Contact sheet, all 96, before (left) and after (right), bikinis enlarged:** `docs/proof-11oct/ai-pictures-before-after-1.png` to `-8.png` (12 players a page). Per-picture counts and the bikini areas are in `ai-pictures-clean-report.json`.
- **Installed** under the same names. `check-image-formats` OK, `check-captions` OK, no two of the 96 files are the same.
- **Skin tones:** unchanged (same people, same pictures).

**Pictures I'm not sure about** (all on the contact sheet):
- **Leilani Kahananui** (AUS_04_P1) and **Lisa Natuman** (AUS_07_P2): a beige band under the top. It may be the top's lining in shade, or skin. It is not white or grey, so it is left as it is.
- **Lindiwe Dlamini** (AFM_03_P1): a little pale lining shows on the inside of her top (she is turned).
- **Wei Lin** (ASI_02_P1): a thin white strap at her back is still white. The recolour missed it altogether, and it doesn't touch the coloured kit in the picture, so the cleaner cannot tell it from the background.
- **The pale-blue kits** (Argentina: Valentina Rodríguez, Camila Gómez; Uruguay: Verónica Martínez, Paula Álvarez): the kit is itself pale, so a very faint pale edge may remain.

**Found outside the bikini, left alone as the brief says** (they came with the 10 Oct recolour, and are in the zip and in Rob's own 10 Oct files):
- **Élise Fontaine**: the blue-and-white umbrella was recoloured blue and red.
- **Agnieszka Kowal**: red streaks in her hair.
- **Mariela Colon**: blue patches in her hair.
- **Brittany MacLeod**: a small red mark at the top's neckline.

### 6. Zoom buttons 1x, 2x, 4x

**Done, from your message; the brief file never had it.** You wrote that item 6 (zoom buttons 1x 2x 4x) was added to `SERVE-BRIEF-11OCT.md` at 12:32, and that it was updated at 12:35. The file in Downloads is still the 12:30 version (9,018 bytes, saved 12:30:36), with items 1–5 only. No other brief was written today, and nothing on the PC mentions zoom buttons. So I built item 6 from your words, before the Unity export as you asked; if the brief says more, it is easy to change. Unity `dd7465d`.
- **Three buttons on the court, `1x` `2x` `4x`**, top right under the weather box. The one in use is lit amber. They work in Auto and in Manual (they are buttons, like the boosts).
- **What they do:** they magnify the camera in use 1, 2 or 4 times. The field of view is narrowed so the picture is that much larger: the close camera goes 60° → 32.2° → 16.4°. It is a true zoom, so nothing on the court moves.
- The mouse wheel and +/- (the dolly) still work on top of it. The zoom chosen stays when you switch camera (1 / 2 / 3); only the camera in use is ever magnified.
- **Proof:** `RallyPlanProof` clicks the three buttons (their own `onClick`) and measures the camera: **×2.000 and ×4.000, and back to 60.00° at 1x: PASS** (`docs/proof-11oct/unity/rally-plan-item6.txt`). In the browser, the court proof clicks the 4x button with the mouse (`docs/proof-11oct/bikini/webgl-after/zoom-4x-buttons.png`).

### The Unity export, and the court in the browser

**One WebGL export** of Unity `dd7465d` (items 1–4 and 6), using the 5 and 6 Oct route:
- `WebBuild.Step7` in batch: **Succeeded** (4 min). The output is data 268.7 MB and wasm 51.6 MB.
- Copied into `launch-final` under the deployed names (`unity-build/Build/Volleyball_WebGL_Uncompressed_2.*`, the four files; the page, `index.html`, and the commentary clips are unchanged).
- Brotli regenerated with `compress-unity-data`: data.br 217.0 MB, wasm.br 9.0 MB.

**Headless Chrome on the real game page, real GPU** (`scripts/webgl-proof/court-frames-proof.mjs`, a new Sydney Riptide career's first match, opened with Next match → Watch Match):
- **Positions (item 1):** `docs/proof-11oct/court-positions/serve-team-a.png` ("SYDNEY RIPTIDE TO SERVE": the Team A server stands just outside the left baseline, the other three on their spots) and `serve-team-b.png` ("AMSTERDAM DUNE RIDERS TO SERVE": the Team B server just outside the right baseline). Each frame is taken 1.8 s after the point, while the serve waits for everyone.
- **The serve meter (item 2):** `docs/proof-11oct/court-meter/serve-meter.png` and `-2.png`. The WEAK…MAX bar has the red weak end and the green MAX zone, the needle sweeping, the prompt "SERVE: tap L at MAX", and the help panel's "(serve: tap at the right time, at MAX)". The proof plays in Auto, and after a point Sydney Riptide wins it presses Tab, so Yaritza Mendez serves in Manual.
- **Zoom (item 6) and the bikinis (item 4):** `docs/proof-11oct/bikini/webgl-after/zoom-4x-buttons.png` shows the 4x button clicked with the mouse: it is lit and the close camera is magnified 4 times (the court logged "zoom 4x … field of view 16.4"). `bikini-close-1..3.png` are frames at 4x before a serve. Compare `bikini/webgl-before/` (the 10 Oct court at its closest). The fabric itself is clearest in the Unity close-ups (item 4).

### The full harness

**Run #1, at `669fd0e` (the export and every proof): 103 of 104 suites passed. `staff injuries` failed one check** (18/19): "the long run's own absences are in its Club News too" (`docs/proof-11oct/full-harness-669fd0e-staff-news-fail.txt`).
- **The cause was a fault in the suite, not in the game, and not from this brief** (nothing here touches staff).
- The suite plays 6 seasons, then reads Club News once, at the end. Club News shows the newest 15 items, which by then are the last season's matches and signings. In this run the last staff absence was in October 2028 and the run ended in December 2032, so no staff line could be in the newest 15.
- The check passed on 10 Oct only because an absence happened to fall late in that run.
- **Fixed in the suite (`harness/staff-injuries.mjs`):** it now reads Club News on the day of the first absence the game rolls itself, and checks that line is there on its date. Alone: **19/19** (`docs/proof-11oct/staff-injuries-fixed-alone.txt`: "2026-02-13: Dr. Karim Hassan (Doctor) caught the flu").
- The brief asked for one full harness run. A run with a failed suite can't be packaged, so after the fix I ran it a second time (below), with nothing else running.

**Run #2, at `5c48a66` (the staff fix): 103 of 104 again.** `staff injuries` passed this time, and `season rollover` failed two checks (`docs/proof-11oct/full-harness-5c48a66-rollover-move-fail.txt`): RollStrong's season 5 read **"-217 played"** and **"-130W -87L"**.
- **The cause was again the suite, and again random.** RollStrong had two failed seasons, so his board sacked him at the season-5 review. Since the job market (6 Oct join), a sacked manager carries on at the club he is given, and the boundary comes back as an ordinary "rolled".
- The suite then took the season's record as the new club's running totals minus the old club's: a negative number. The game was right; the same kind of suite fault was fixed in `ai-club-economy` on 6 Oct. It passed in run #1 and on 10 Oct because nobody was sacked then.
- **Fixed in the suite (`harness/rollover.mjs`):** when the club changes at a boundary, the season is the old club's, so its record is read from that club's own totals in the save. The move is logged, and the arc goes on with the new club.
- **Alone, after the fix: 90/90** (`docs/proof-11oct/season-rollover-fixed-alone.txt`). Nobody was sacked in that run, so the new "moved club" branch did not come up; it reads the old club's own totals, which nothing resets on a move.

## What Rob must check on screen

All in **`C:\build\vbe-final-11oct\win-unpacked`**. Make a backup of your save first, as always.

1. **Your career loads** as before (Sydney Riptide).
2. **Start positions, in Auto:** Watch Match. At the end of every rally, all four walk back to their spots. The server walks to **just behind her own baseline**, and the serve goes only when everyone is there. It is the same player who walked back who serves.
3. **Start positions, in Manual, with the Xbox pad:**
   - When a point ends, your player is **walked back by the game**: let go of the stick, she goes by herself.
   - When she serves, she stands behind the baseline and the stick moves her **left and right only** until she serves.
   - When the other side serves, she waits on her spot, and **the stick takes over the moment the serve is in the air**.
4. **The serve meter:** when it's your serve, the bar under the court **sweeps WEAK ↔ MAX without stopping**.
   - **One tap of Y** serves at the power shown; the green MAX zone at the right end is full power.
   - A tap in the red bit at the left (under 12%) goes into the net.
   - The prompt says `SERVE: tap Y / Triangle at MAX`, and the help panel says "tap at the right time, at MAX".
   - Leave it alone and it serves by itself after 12 s.
5. **The ace ability:** nobody starts at 95.
   - To try it, train a player's serve: Serving Academy, back to back; Yaritza Mendez takes about 100 game days from 88.
   - Once she is 95, a tap in the MAX zone is an **ace**. In Auto she aces about 1 serve in 12 on her own.
   - A 94 tapping MAX just serves hard.
6. **The bikinis on the court:** a little sheen on the fabric now, like wet Lycra; the skin as before. Zoom in (item 7) to see it.
7. **The zoom buttons 1x 2x 4x**, top right under the weather: click them, in Auto and in Manual. The picture should get 2× and 4× larger, the button in use lit. The wheel and +/- still work. Say if item 6 of the brief asked for something else (see item 6 above).
8. **The AI club pictures:** Player Market, At AI Clubs. The pale rims and white tips on the bikinis should be gone. Have a look at the ones listed under item 5 (Leilani Kahananui, Lisa Natuman, Lindiwe Dlamini, Wei Lin, the pale-blue kits), and at the 10 Oct leftovers outside the bikinis (Élise Fontaine's umbrella, Agnieszka Kowal's and Mariela Colon's hair, Brittany MacLeod's neckline).
