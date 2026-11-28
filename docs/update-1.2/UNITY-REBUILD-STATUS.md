# BVE 1.2 Unity match rebuild: status

Brief: `docs/update-1.2/UNITY-REBUILD-BRIEF.md`. Plan: `docs/update-1.2/PLAYABLE-MATCH-PLAN.md`.

## Decisions made without Rob
1. **Where the branches start.** The game repo's `update-1.2` starts from `update-1` at `da9bea65`. That is the same commit as `release-1.1.3`, the 1.1.3 squad-policy report. The Unity repo's `update-1.2` starts from `release-1.1.3` at `dd0a4875`. The 1.1.3 court was exported from that commit, and `feat-manual-controls` is already inside it.
2. **One settings line left out of git.** Unity batch runs add `APP_UI_EDITOR_ONLY` to the WebGL defines in `ProjectSettings/ProjectSettings.asset`. That line was already changed before this session started. It stays uncommitted, and it must be reverted before the WebGL build in Part C.
3. **The two animation packs went in at the start of Part A,** as Unity commit `3c0e0f4`, before any push. That covers `Assets/Animo` (AA_Volleyball) and `Assets/KAWAII_ANIMATIOMS_100`. All 672 FBX files go through Git LFS by the existing `*.fbx` rule, including the 132.6 MB and 130.3 MB AA_Volleyball files. Only 21 MB of metas, controllers and docs is in plain git.
4. **The item 0 proofs ran with their default settings.** No api-server was running, so they used the prefab ratings and a 0.5 point chance. That is how they stand today, and it is what item 0 asks for.
5. **Unity was closed for every batch run** in item 0 and Part A. No `Unity.exe` was running beforehand.
6. **Where the played-match engine lives.** It is new files in `Assets/Scripts/PlayedMatch/`, in the C# namespace `Played`, with no `UnityEngine`. Coordinates are court-local metres:
   - the net is the plane z = 0
   - Team A plays the z < 0 half, as in MatchManager
   - the court's world position comes from `VolleyballCourt`
   
   The engine uses doubles, a fixed 120 Hz step and its own seeded random generator (SplitMix64). That way the same inputs give the same match on any machine, which D6's online scaffold will need. Its checks are in `Assets/Editor/PlayedMatchChecks.cs`, which is also plain C#. The game repo's `harness/played-match` compiles the engine and the checks from the Unity repo with dotnet, the same way `harness/unity-point-model` compiles `PointModel.cs`.
7. **The rules at the net and on the lines (A1).**
   - **In or out:** the lines are part of the court. A ball is in if it touches any part of a painted line, so the edge of "in" is the line's outer edge. V19's lines are 15 cm wide and centred on x = ±4 and z = ±8.
   - **The net:** a ball that hits the net drops back on its own side and stays in play. Beach rules let the team play it if they have touches left.
   - **Faults at the net:** a ball that passes under the net, or crosses outside an antenna, is a fault by the team that played it. The antennae stand over the sidelines.
   - **The tape:** a ball that clips the tape rolls over if its centre is above the tape and falls back if it is below. It keeps more speed the higher it crosses.
8. **V19's baselines are named the other way round from the teams.** `Baseline_A` is the line at z = +8, which is Team B's end in MatchManager. Only the names differ: the lines are symmetric. The A1 proof therefore checks the lines by position, not by name.
9. **How a touch is graded (A2).** Every touch gets a quality from 0 to 1, made of three parts multiplied together:
   - **Timing:** perfect, good, late or miss. The windows are each side of the ideal moment:

     | | Perfect | Good | Late | Then |
     |---|---|---|---|---|
     | Easy | ±100 ms | ±200 ms | ±360 ms | a miss |
     | Medium | ±65 ms | ±140 ms | ±260 ms | a miss |
     | Hard | ±45 ms | ±100 ms | ±190 ms | a miss |

     "Late" covers early too. The grade keeps the sign.
   - **Position:** balanced, stretching or diving. A dig reaches 0.75 m balanced, about 1.3 m stretching and about 2.5 m diving. Diving is for digs only.
   - **Stats:** the rating each touch uses, as the brief lists them, times her condition.
     - Condition comes from fitness, career fatigue and the stamina she has left in this match.
     - How much the stats weigh against the timing goes up with difficulty: 46% on Easy, 50% on Medium, 62% on Hard ("Hard: stats matter more"). These were 55/70/85% until A6 retuned them.
     - A rating counts from 20 (nothing) to 95 (the best). For skill in the touch, its effect reaches 40% of the way from an average player (62) towards those ends (`TouchRules.SkillSpread`). For the body (speed, power for pace and jump, block for reach), it reaches the whole way. See decision 20.

   The quality then sets what comes off the touch: how close to the aim the ball goes, how high a dig or set goes, and how safely a spike or serve clears the tape. A spike or serve that is hit badly can go into the net.
10. **The serve meter and the spike meter.**
    - **Serve:** the meter stays as it was: it sweeps WEAK to MAX, and one tap serves. Its own numbers are kept: under 12% goes into the net, and from 92% is the MAX zone.
    - **Serve grade:** the meter is the serve's "timing". MAX zone is perfect, from 70% is good, from 12% is weak (graded "Late"), and under 12% is a fault.
    - **Ace ability:** Rob's rule stays (rated 95+ and tapping in MAX), but there is no automatic ace now. Instead that serve goes 8% faster and its error is halved, and the physics decides the rest.
    - **Spike:** the spike meter is a charge, from a tap (0) to full (1). A full charge hits about 60% harder but is a little less accurate. How the buttons drive it is in A3.
11. **Player reach comes from the career's own data.**
    - Standing reach is 1.33 × her height.
    - Height is in centimetres in the career (158–193) and in metres on the court's own prefab players. `TouchRules.Metres` reads both.
    - Spike jump: 0.45 m, plus up to 0.22 m from power.
    - Block jump: 0.18 m, plus up to 0.26 m from the block rating. Her hands rise and fall with the jump.
    - Running speed on sand: 4.3 m/s for the slowest up to 5.9 m/s for the quickest, pulled down by condition.
    - All of these were set in A6. A1 and A2 first had them steeper.
12. **From A3, Manual means the played match.**
    - When the match is in Manual, MatchManager hands each serve to the new engine. It does that in two lines of `MatchManager.cs`. Everything else MatchManager needs for a played point is in a new partial file, `MatchManager.Played.cs`, so `MatchManager.cs` itself did not grow.
    - The old forgiving pathway (`ManualControl`'s touches, MatchManager's manual branches) can no longer be reached. It stays in the files until A8 deletes it.
    - `ManualControlsProof` tests that old pathway, so it cannot pass after A3. A8 retires it.
    - Auto is unchanged: same code, same odds.
13. **The controls (A3).**
    - **Kept as they were:** ManualControl's keys and pad buttons for move, dig, set, dive, switch, cheer, Auto/Manual, pause and help.
    - **New: the soft shot,** on I / RB / R1. Those are free keys next to J, K and L, and the free right shoulder button.
    - **The L / Y button still does three jobs:**
      - *Serving:* tap the meter, as before.
      - *At the net while they attack:* block.
      - *On your side:* hold to jump and charge the new spike meter, release to hit. A plain tap still spikes, but softly.
    - **Aim** is the direction held at the contact: forward goes deep, back goes short, left and right go along the net.
    - **The serving player** still moves left and right along her serve line, so the stick both moves her and aims the serve.
14. **Who you control.**
    - Control follows the ball to whichever of your two players the engine says it is going to.
    - **Q / LB** takes the other player until the ball next goes over the net. The AI then plays the ball for her partner.
    - **A white ring** at her feet shows which player is yours.
15. **AI sharpness by difficulty (A4, A5).**
    - **The player's partner** has Medium sharpness on every difficulty, so a harder career does not give you a worse partner.
    - **The opponents** get sharper with the difficulty: their timing spread is 128 ms on Easy, 105 ms on Medium and 88 ms on Hard, and their reaction time is 318, 268 and 242 ms.
      - A6 first set them to 120, 97 and 79 ms (reactions 305, 260 and 230) for a fair match on Medium.
      - They were retuned on 26 Nov to Rob's rule that the player must not lose more often than he wins at any difficulty. See "Difficulty retuned" at the end of this file.
      - The partner's level is Medium's, so she moved with it: 105 ms and 268 ms.
    - **Every AI player's timing** also narrows a little with her own rating for the touch: one rated 85 is about 10% steadier than one rated 45.
16. **Boosts in a played match.** There are no odds to shift in a played match, so a boost raises Team A's ratings instead:
    - **Attack:** +8 power and serve.
    - **Defence:** +8 defence, speed and block.

    They are pressed and counted in points exactly as before.
17. **Wind.** When `WeatherManager` says Windy, its wind force × 0.08 acts on the ball: up to about 0.3 m/s² of drift.
18. **Animation proofs are done in Play mode.** Posing BeachPlayer in edit mode, as the brief's frame strips first did, leaves her body mesh unskinned: only her separate head mesh moves. Motion Cast's Spike, which plays correctly in every match, looks broken in edit mode too.
    - So every clip is proven in Play mode, through the players' own controller (`PlayedAnimationPlayStrip`), with a measured check that her head bone stays inside her body's skin in all 24 poses.
    - The rejected edit-mode pictures are kept in `proof/animation/rejected-edit-mode/` to show why.
    - AA_Volleyball's InPlace clips have no vertical jump in them. The game lifts the player for jumps from the engine's jump curve, as MatchManager already does for Motion Cast clips.
19. **Side switches.** Teams do not change ends during a set, in a played match or in Auto. Auto never did, so the two stay the same.
20. **How steeply the ratings count (A6).** The first engine made ratings count about three times as steeply as the career's Sim Result: a pair 10 points weaker almost never won. That would make playing a match yourself a punishment when slightly outrated, and a gift when slightly stronger. A6 tuned it in two parts:
    - **Skill in the touch** reaches only 40% of the way from average to the extremes.
    - **The body** keeps its whole range, because no thumbs make a slow player quicker, a weak hitter harder or a short blocker taller. That is what stops quick thumbs from carrying a far weaker pair.

    The table in A6 compares every match-up with Sim Result's own rate.
21. **A dig shanks wild below quality 0.30.** A dig 200 ms late on Medium then goes wild about half the time (51%). Otherwise it lands about 3.8 m from the setter.
22. **Auto's height reading, fixed on Rob's instruction (26 Nov 2026).** MatchManager's Auto block formula read a player's height as metres, but the career sends centimetres. In Auto, every career player therefore got the full height bonus at the block.
    - **The fix:** one line, the formula's height reading. A value over 3 is now read as centimetres and divided by 100. A height already in metres (the court's prefab players) and Auto's own fallback for no height (1.90 m) are as they were. Nothing else in Auto changed.
    - **What it changes:** the block's height score is (height − 1.5) ÷ 0.7 × 100, capped at 100. A 188 cm player now scores 54 instead of 100; a 158 cm player scores 11.
    - **Proof** (`docs/update-1.2/proof/A7/auto-height/`):
      - `RallyPlanProof` RESULT: PASS, with all 8 checks.
      - `one-set-of-odds` 20/20, `boosts` 12/12 and `watched-result` 22/22.

      The proof's prefab players carry no height in centimetres, so their block ratings are unchanged (162).
23. **On Hard, a strong AI times as sharply as her rating says (26 Nov 2026, on Rob's instruction).** Rob's second ruling was withdrawn and reverted. Instead, Hard alone gets `AiLevel.ratingPull` = 1.0 (0 on Easy and Medium):
    - **What it does:** on Hard, an AI player's rating tightens or loosens her timing spread that much more either side of an average player (62). A strong AI misses Hard's narrow windows far less than before, and a weak AI more often. An average AI (62) times exactly as before.
    - **What it fixes:** with expert thumbs, the player's weak pair (45) beat a strong AI pair (80) 47% of the time on Hard. It is now 18% (target 15–25%).
    - The section "Hard only: the strong AI's timing" has the tables, the cost and every number.
24. **Rob, 26 Nov: no more win-rate tuning.** Rob will do the final pass himself after playing with a pad. Work goes on in the brief's order: the Animations section, then Part B (B1 to B5). Part D is not started.
25. **The presentation's clips are plain states played by name.** They are in the players' controller (`VolleyballController`) as 42 states with no triggers. The presentation crossfades to one by name, and each one-shot state goes back to Locomotion when it ends. Nothing in a rally uses them, so the rally's triggers are unchanged.
26. **The umpire signals from her chair.** AA_Volleyball's referee clips are made standing. On her they play on a new upper-body layer (head, arms, fingers) above her seated pose, so she signals without leaving the chair. Her seated pose is now frozen by its own state (speed 0) instead of by stopping her whole Animator, which would have stopped the signals too.
27. **There are no line judges in the scene,** so AA_Volleyball's five line-judge clips are not used. Adding line judges would be new venue content, which is Part D's.
28. **"All six venues" (B1): there is one venue today.**
    - V19's beach is the only venue. The six are Part D's plan (D1), which has not started.
    - So both looks are built from the court itself: its position, its net, its chair and the objects round it (`CameraKeepOut`). A venue built round the same court gets the same six views and shots, each moved out of whatever that venue puts in the way.
    - Each must still be checked there, with `PresentationCameraProof`, once D1 builds the other venues. Only V19 is checked today.
29. **One court camera, driven.** `CourtCamera` replaces `SimpleCameraPresets`, which switched three scene cameras on and off. It drives `Camera_Gameplay_Close` (its name is kept, since proofs and the page find it by name). The other two scene cameras stay in the scene, switched off.
30. **The stick in a played match.**
    - In the Game look, up on the stick is up on the screen. In the overhead view, that is towards the net.
    - In the TV look the camera never stops moving, so the stick keeps the frame from behind your own baseline.
31. **The camera choice is remembered per kind of match.** There is one choice for a played match and one for a watched match, kept by the page in localStorage like Auto/Manual, with the brief's defaults: Game, behind your baseline, when playing; TV when watching. Switching Auto/Manual mid-match switches to that kind of match's choice.
32. **Keys.**
    - 1 to 6 pick a Game view; V (L3 on a pad) switches look; the D-pad's left and right step through the views.
    - All are Input System actions, so any keyboard or pad works.
    - R and Space no longer pick the close camera; there is no close camera now.
    - The 1x/2x/4x buttons work in both looks. The + / - dolly works in the Game look only.
33. **The 1.2 demo is its own edition (27 Nov 2026, Rob's demo brief).** One switch, `electron/edition.js`, which reads the packaged `package.json`. Only the demo's packaging config (`electron-builder.demo.cjs`) marks a build as the demo, through electron-builder's `extraMetadata`. The repo's `package.json`, dev runs and the real game's package are unchanged.
    - **Its own identity:** the name "Beach Volleyball Empire 1.2 Demo", the appId `com.volleyballempire.desktop.demo-1-2` and the version 1.2.0-demo1. That gives it its own install folder, Start-menu and desktop shortcuts, and Uninstall entry.
    - **Its own save:** the save is in `AppData\Roaming\Beach Volleyball Empire 1.2 Demo`. It never brings a save forward from any other folder: the real game's move from "Volleyball Empire" and its copies from the older folders are off in the demo.
    - **No Steam:** launched outside Steam, steamworks.js could still attach to the real app id and unlock the real game's achievements.
    - **Its own port, 4174:** it runs even while the real game is open.
    - **The title screen** shows the name and version from the desktop app (`vbeApp.name`, `vbeApp.version`).
34. **The court asks only for the commentary clips its `LINES.txt` lists.** The first demo run found that every match in the WebGL build stopped at the walk-on.
    - **The cause:** the court asked for every kind's three clips, and B4's seven new kinds are not recorded. The server answered each missing clip with the game's page and a 200. Chrome could not decode that page as audio, and Unity's loader turned the error into an `alert()` that stopped the page.
    - **Why the editor proofs missed it:** they load clips from `file://`, where a missing clip simply fails.
    - **The fix:** `LINES.txt` is the list `scripts/elevenlabs-commentary.mjs` records from, so a line Rob records is picked up with no code change.
35. **The server answers a missing file with a 404, never the page.** Only the page's own routes (no file extension) get `index.html`. A missing asset can no longer be handed to Unity as something else.
36. **`APP_UI_EDITOR_ONLY` and batch Play-mode proofs.**
    - **What happens:** the App UI package puts the define back on WebGL whenever the editor enters Play mode (`AppUIManager`, on `delayCall`). With the line reverted for the WebGL build, the next Play-mode proof recompiled every script in the middle of its match, and the match broke with a NullReferenceException at every serve.
    - **So:** the line stays as App UI writes it for Play-mode proofs, as it did all through Parts A and B, and is reverted right before each WebGL build (decision 2). Both demo exports were built with it reverted. The Unity repo is left without it, as committed; App UI adds it again the next time the editor plays.
37. **The soundtrack now plays through the match, from the band's stage (6e, Rob 27 Nov).** This replaces Unity brief item 9 (Rob, 29 Sep), under which the music faded out on the court.
    - The songs stay in the game page's own player, so its queue, skip, pause, volume and the three fade-outs work as they do everywhere else. Unity never plays, trims or fades a song.
    - The court tells the page how loud the stage is where its camera is. The page plays the song at the player's volume times that.
    - A venue with no band plays the songs at the player's volume.
38. **Loudness only, no left and right.** Panning the song needs the page's music to go through Web Audio. A Web Audio context that the browser holds suspended plays silence until it is woken, and that risks the soundtrack everywhere in the game. So the stage gets louder and quieter as the camera moves, but not left and right. Rob can ask for panning; it is a change to the page's player alone.
39. **A continent waiting on Rob's assets plays at the island beach.** Each continent has its line in `Resources/venues.json`, with its look and what is missing. Its status is "waiting on Rob" until its venue is built. Until then, a match there plays at the fallback (oceania, the island beach) and the log says so.
40. **The scenery's light is not baked.** D2 moves the sun through four times of day. A baked set would be right for one of them and wrong for the other three, and four sets per venue would multiply the download. So the scenery is lit by the real sun and sky, and casts no real-time shadow (section 2's rule: only the players and the ball do). Rob can ask for a baked set per time of day; each would add to the venue's download.
41. **Each musician carries the instrument on Musical Motions' own skeleton.** Musical Motions hangs its instruments on bones of its own (Guitar, DrumStick_L/R). A Humanoid clip played on another skeleton, Citizens Pro's here, does not carry those bones. So the pack's own rig stands in each musician's spot, scaled to their height, with its body hidden. It plays the same clip in step and holds the instrument where the pack's animator put it.
42. **The court's weather is what you see; it does not move the ball (D3).**
    - **Why:** a match's weather is already in the game's odds, and A6's win rates were set with none.
    - **What was taken out:** the wind's push on Auto's ball (up to 4 N on a 0.27 kg ball, enough to throw every windy rally off its course) and the breeze on a played match's ball.
    - **What stays:** Auto's small weather touches to where its players move and aim (rain slows them a little, wind widens a serve's scatter). An Auto point is already decided by the game's odds before it is shown.


## Items

| Item | State | Proof | Commit |
|---|---|---|---|
| 10 The five venues, demo 4 (29 Nov) | Done: north_america, south_america, europe, asia (no bungalow), africa_middle_east built from Rob's packs to D1's looks, each its own bundle (69 to 110 MB) with its own terrain and sea; sections 2, 3, 6 applied; sand ripples (a small gain, no cost); 55.5 to 57.2 fps at every venue and time; missing pieces listed for Tripo. Demo 4 packaged, not installed: 1.2.0-demo4, 808.6 MB | `proof/10/` (sheets, per-venue pictures, packs, sand before/after, `fps/`, `packaged/`), `DEMO-CHECKLIST.md` | Unity `3c83948c`, game (this commit) |
| 5 The commentary team (29 Nov) | Done, PASS: Rob's sheet as data (57 lines, a new guest is data only); career: the reporter on, a guest at random, a Settings switch for guests; exhibition: guest and reporter picked; the three in the commentary tent's front deck, Nicole on the sand with a microphone; missing clips skipped in silence; levelling script (-18.5 dBFS). The booth had been on the tent's roof (9e): fixed | `harness/commentary-team.mjs --unity` 26/26, `proof/5/` | Unity `6eac297b`, game (this commit) |
| Demo 3 (29 Nov) | Packaged, not installed (install test skipped, as Rob said): 1.2.0-demo3, 458 MB; proof on its own files 21/22, 57 fps; the director's band and booth shots are picked but covered by the point's cutaways (a finding, not changed) | `proof/demo3/`, `DEMO-CHECKLIST.md` | game (this commit) |
| 9e Commentary tent, 9f Rob's remade props (29 Nov) | Done, PASS: the tent from the yellow tower in blue and white (orange accents only, said plainly), booth fits three; the VIP tent squared and in place, the cart and the shop in, the cart's mashed script covered | `proof/9e/`, `proof/9f/` sheets, `vip-tent-profile.txt` | Unity `ea70a0c5` |
| 9c The ball in her hand at the serve (29 Nov) | Done, PASS: drawn in her left hand in played and Auto, clear of head and hat; drawing only (A1 18/18, --unity-full 13/13) | `proof/9c/9c-serve-hold-sheet.png`, `proof/D6/d6-player_a2.png` | Unity `252a16b5` |
| 9d Music: Rob's ruling (29 Nov) | Done, PASS: the control was already there (Settings and the court's settings, remembered); only the court's help text corrected | `scripts/webgl-proof/music-9d.mjs` 8/8, `proof/9d/` | game only |
| 9b Rob's swimwear prints (29 Nov) | Done, PASS: his 23 swatches as 20 prints (paisley 4 ways), 11 the player recolours by Rob's rule, 9 as painted; a new print is a picture and a line; 42 MB to 3.0 MB; seams cut to whole repeats or mirrored; the palette of brights and pastels | `proof/9b/9b-prints-sheet.png`; store 30/30, exhibition --unity 30/30 | Unity `ace36fd0` |
| 9a Tinted sunglasses (29 Nov) | Done, PASS: five lens tints beside the frame colour, in the store and on the pick screen; eyes faint behind them; the floodlights light them | `proof/9a/9a-lenses-sheet.png`; store 27/27, exhibition 21/21 | Unity `a7575042` |
| D4-D6 Full harness (28 Nov) | **ALL HARNESSES PASSED** on run 3 of the 3 allowed (144 suites; season rollover 2,266 s). Run 1 stopped at check-starter-db; run 2 failed four source suites only | `pnpm run build`; see "Full harness, Part D" below | game `07503f05`, `bdbaef5a` |
| D6 Exhibition and online scaffold (28 Nov) | Done, PASS: the pick screen, up to four people, custom swimwear in two colours and eight prints (the leopard print poor: Rob to supply art), nothing in a career; RemoteSeat, recording, two engines agree | `proof/D6/` (`d6-exhibition-court.txt`, `d6-prints.png`), `proof/pages/`; `harness/exhibition.mjs` 23/23, `harness/online-scaffold.mjs` 6/6; `ONLINE-SCAFFOLD.md` | Unity `ac3a9af1`, game `80ad1d5f` |
| D5 Crowd banners (28 Nov) | Done, PASS: ten slogans and the player's own | `proof/D5/` | Unity `ac3a9af1`, game `80ad1d5f` |
| D4 Store and wallet (28 Nov) | Done, PASS, shipped closed: the wallet and four hooks from one settings file, items from a data file, the page, both ways proven | `harness/store.mjs` 25/25, `proof/pages/` | Unity `ac3a9af1`, game `80ad1d5f` |
| Section 4 Drinks break (28 Nov) | Done, PASS: 6 s, both teams, a shot of each, Enter skips, bottles away before the serve; B5 4/4 | `proof/section4/`, `proof/B5/b5-skip.txt` | Unity `a6aae18c` and after |
| D2 Time of day, D3 Weather (28 Nov) | Done, PASS: four times and four weathers in every venue; the weather is what you see, not on the ball | `proof/D2/`, `proof/D3/`; frame rate `proof/D2/fps/` | Unity `a6aae18c` |
| D1 Venues, sections 2, 3, 6 (28 Nov) | Built: the venue system and the island beach (oceania); five continents waiting on Rob's packs; palms 1.9 million to 30,000 triangles; Rob's props, the band, booth, juice bar, kiosk | `proof/D1/`; frame rate 56.8 fps lowest (headless Chrome's own ceiling is 56.3) | Unity `47348863`, `09fd34c7` |
| Demo build (27 Nov) | Done: steps 1 to 6 PASS; step 7, the full harness, run 2: 139/140, the one failure a chance rate that passed alone. See "Demo build" at the end | `docs/update-1.2/proof/demo/`; `DEMO-CHECKLIST.md`; package `C:\build\vbe-1.2-demo-2026-11-27\` | game `fd7301a0`, `4849bcd9`, `7f7ba5c1`, `8e7f8996`, `6f5d2a65`; Unity `8bbf267` |
| 0 Baseline | Done, PASS | `docs/update-1.2/proof/baseline/` (`results.txt`, plus the full `compile.log`, `RallyPlanProof.log` and `ManualControlsProof.log`) | game repo `dffed753`; Unity repo: `update-1.2` at `dd0a4875` (no file changes) |
| Packs | Committed through LFS | `git lfs ls-files` lists all 672 pack FBX files | Unity `3c0e0f4` |
| A1 Real ball flight | Done, PASS | `docs/update-1.2/proof/A1/`: `a1-ball-flight.txt` (Unity batch, 23/23), `a1-dotnet.txt` (dotnet, 18/18), `a1-unity.log`, 3 pictures | Unity `a656a3f`; game repo `23ba802e` |
| A2 Every touch graded | Done, PASS | `docs/update-1.2/proof/A2/`: `a2-touch-grading.txt` (Unity batch, 27/27), `a2-dotnet.txt` (dotnet, 27/27), `a2-unity.log`, `a2-digs.png`, `a2-spikes.png` | Unity `2b964d0`; game repo `3be1fe35` |
| Animations, first job | Done, PASS | `docs/update-1.2/proof/animation/`: `aa-volleyball-humanoid.txt`, `play-strips.txt` and five Play-mode strips | Unity `ed0e902` |
| Animations, the rest | Done, PASS | `docs/update-1.2/proof/animation/`: `presentation-states.txt`, `presentation-strips.txt` (42/42) and a `play-strip-*.png` for each state, `pair-placement.txt` with `pair-strip-HighFive.png` and `pair-strip-Hug.png`, `pose-proof.txt` with `pose-strip-HandSignals.png`, `pose-strip-Drink.png` and `pose-strip-Umpire.png`, `rejected/` | Unity `287718e` |
| B5 Skip and settings | Done, PASS | `docs/update-1.2/proof/B5/`: `b5-skip.txt` (Unity batch, a whole match, 4/4); `harness/presentation.mjs` 43/43 (all of Part B) | Unity `5825432` |
| B4 Crowd and commentary | Done, PASS (42 new lines for Rob to record, `COMMENTARY-NEW-LINES.md`) | `docs/update-1.2/proof/B4/`: `b4-crowd-and-commentary.txt` (Unity batch, 8/8) with its log; `u21_commentary.txt` (the item 21 proof, PASS) | Unity `41e2041` |
| B3 Match moments | Done, PASS | `docs/update-1.2/proof/B3/`: `b3-match-moments.txt` (Unity batch, V19, a whole match, 8/8) with four pictures; `harness-unity-full.txt` (13/13) with its court proof and log; `RallyPlanProof.log` (PASS) | Unity `ee2f355` |
| B2 Between points | Done, PASS | `docs/update-1.2/proof/B2/`: `b2-between-points.txt` (Unity batch, V19, 13/13) with three pictures and `b2-between-points-unity.log`; `RallyPlanProof.log` (PASS); `harness-played-match-unity.txt` (9/9) | Unity `45074a1` |
| B1 Two camera looks | Done, PASS | `docs/update-1.2/proof/B1/`: `b1-court-camera.txt` (Unity batch, V19, 23/23) with `b1-tv-shots.png`, `b1-game-views.png` and `b1-court-camera-unity.log`; `RallyPlanProof.log` (PASS); `harness-played-match-unity.txt` (9/9, the three played courts); `harness/presentation.mjs` 17/17; `harness/settings.mjs` 40/40 | Unity `f807a08` |
| A3 Controls, played on the court | Done, PASS | `docs/update-1.2/proof/A3/`: `a3-played-match.txt` (Unity batch, 28/28), `a3-unity.log`, three pictures | Unity `ed0e902`; game repo `833aaeac` |
| A4 AI plays the same game | Done, PASS (the check that failed under the second ruling passes again since the ruling was withdrawn) | `docs/update-1.2/proof/A4/`: `a4-ai-same-game.txt` (Unity batch, 9/9), `a4-dotnet.txt` (dotnet, 8/8), `a4-unity.log` | Unity `ea77855`; game repo `74f3a669` |
| A5 Difficulty from the career | Done, PASS | `docs/update-1.2/proof/A5/`: `a5-harness.txt` (9/9; the final run, on the tuned code, is in `proof/A6/a6-harness.txt`), `a5-easy.txt`, `a5-medium.txt`, `a5-hard.txt` (each court 14/14) | Unity `95c47c5`; game repo: the A5 commit |
| A6 Fair to the career | Done, PASS 10/10 (retuned on 26 Nov; the second ruling withdrawn and reverted; then Hard only. See "Difficulty retuned", "Rob's ruling on mismatches (withdrawn)" and "Hard only: the strong AI's timing") | `docs/update-1.2/proof/A6/`: see the list after this table | Unity `96acace`; retune `fadb71f`; revert `5bf216d`; Hard `dd08097`; game repo `8b5ecfe5`; retune `7401b78b` |
| A7 Auto not touched | Done, PASS | `docs/update-1.2/proof/A7/RallyPlanProof.log` (RallyPlanProof PASS on the demolished code); `proof/A8/harness-one-set-of-odds.txt` (20/20), `harness-boosts.txt` (12/12), `harness-watched-result.txt` (22/22) | Unity `e6efc68` |
| A8 Demolition | Done, PASS | `docs/update-1.2/proof/A8/`: `a8-played-match.txt` (the new engine's proof, 28/28), `a8-compile.log` (0 errors), `harness-played-match.txt` (6/6), three pictures | Unity `e6efc68`; game repo `ee7d5dda` |

**A6's proof files** (`docs/update-1.2/proof/A6/`), with a correction:
- **`a6-dotnet.txt`:** the win-rate table now (the first retune's checks, with Hard's strong-AI timing), 10/10.
- **The earlier tables:**
  - `a6-dotnet-25nov.txt`: the first table, 11/11 against the first targets.
  - `a6-dotnet-26nov-first.txt`: after the first retune, 10/10.
  - `a6-dotnet-26nov-second.txt`: under the second ruling, which has since been withdrawn. It is kept on file as instructed.
- **`a6-harness.txt` ended FAIL, 14/15, not a pass.** That combined run's whole played match on the server failed 2 of its 28 checks (no set made by the person, no block). The cause was the career's heights in centimetres: a 188 cm player reached 250 m, so with real career players no set or spike could be timed. I fixed the height reading, and the rerun, `a6-harness-full-match.txt`, passed 12/12. This row used to say the suite passed 12/12 without naming the failed run first.
- **`a6-played-on-server.txt`:** the court's proof of that rerun, 28/28, with three pictures from that match (`a6-court-*.png`).
- **The latest whole match on the server,** on the final code (the Hard-only change), is `proof/A8/harness-unity-full.txt`: 12/12.

### A1: real ball flight (25 Nov 2026)
**Files:**
- `Assets/Scripts/PlayedMatch/PlayedMath.cs`: vectors, the court and the random generator
- `Assets/Scripts/PlayedMatch/BallFlight.cs`: the flight, the net and the prediction
- `Assets/Editor/PlayedMatchChecks.cs` and `Assets/Editor/PlayedMatchProof.cs`: the checks and the batch proof
- `harness/played-match/`: the dotnet runner in the game repo

**What the ball does now:**
- It flies under gravity (9.81 m/s²) plus any wind. The launch velocity is worked out at the contact, either for a top height or for a flight time.
- Positions are exact. After 120 steps of 1/120 s the ball is within 1.7E-14 m of the textbook parabola.
- At the net: a clean crossing, the tape (rolls over at 2.29 m, falls back at 2.18 m), the net (drops back at 1.36 m and stays in play), under the net (fault at 1.00 m) and outside the antenna (fault at x = 4.05; x = 3.85 is inside).
- On the lines: in at 4.175 and out at 4.185 across the sideline; in at 8.175 and out at 8.185 across the baseline.

**Prediction:** the AI and the ring on the sand both read the same landing prediction. Over 2,000 random flights covering net, tape, antenna and wind, the prediction made at the strike ended in the same place, to the bit, 2,000 times out of 2,000. That held for the in/out call too, and for a second prediction made half-way through each flight. 500 launches flown twice gave identical results bit for bit.

**The scene:** V19's net top measures 2.240 m. Its four lines are centred on ±4 and ±8 and are 0.150 m wide. Both match the engine's numbers.

**Pictures:** seven flights drawn over the real court:
- `a1-flights-behind.png`: all seven, from behind Team A
- `a1-net-close.png`: the tape and net cases, close up
- `a1-flights-side.png`: side-on, partly behind the umpire's chair

**Physics found along the way:** a serve driven flat at 15 m/s from 2.9 m clips the tape. The touches in A2 have to loft the ball, as real players do.

### Item 0: baseline (25 Nov 2026)
- **Starting commits:**
  - game repo `Rob123475/Volley-Ball-Empire`: `update-1` at `da9bea65646f8538ef360be0aa5a4d6a18ea0775`
  - Unity repo `Rob123475/volleyball-unity`: `release-1.1.3` at `dd0a4875be63f35d7ec83b3e89aef2b17a6650df`
  - Branch `update-1.2` was created from those commits in both repos.
- **Compile:** `Unity.exe -batchmode -quit` on **6000.3.16f1 (a56f230f6470)** gave `Tundra build success`, 0 `error CS` lines, `Exiting batchmode successfully now!` and exit 0. The compiled `Assembly-CSharp.dll` and `Assembly-CSharp-Editor.dll` (23 Nov) are newer than every `.cs` in `Assets`, so the current sources are what was compiled.
- **RallyPlanProof** (Auto, time scale 8): **RESULT: PASS**, exit 0, 1 min 48 s. All 8 checks passed:
  - the score was BLUE SHARKS 2-1 RED GIANTS (11-7, 4-11, 13-11) and every set was legal
  - 57 points were played, 57 were decided at the serve and 57 were awarded as decided
  - 57 of 57 serves had everyone in position
  - the zoom gave exactly 1x, 2x and 4x
  - the result box stayed up for 12 s and Continue worked
  - a server rated 95 got the ace ability (101 aces in 1200 serves, about 100 expected) and one rated 94 got none
- **ManualControlsProof** (Manual through a virtual keyboard and gamepad, time scale 2): **RESULT: PASS**, exit 0, 4 min 47 s. 31 checks passed and 0 failed:
  - every action fired from both the keyboard and the gamepad
  - the serve meter worked: a fault under 12%, full speed in the MAX zone, an ace for a server rated 95, none for one rated 94
  - the first-dig aid did work in 8 of 17 digs
  - 41 of 41 serves had everyone in position
  - the score was 2-0 (12-10, 11-9), and 42 of 42 points went to the team the plan said
- The baseline is sound, so Part A can start on it.
- The ManualControlsProof results also record what the old manual mode does: 24 of 42 points were "changed" by the player, and 42 of 42 were still "awarded as planned". This is the pre-decided pathway the brief replaces in Part A and removes in A8.

### A2: every touch is graded (25 Nov 2026)
**Files:**
- `Assets/Scripts/PlayedMatch/TouchGrade.cs`: the grade (timing, position and stats), plus difficulty and ratings
- `Assets/Scripts/PlayedMatch/TouchShapes.cs`: what comes off each touch (dig, set, spike, soft shot, serve)

**Results** (Medium, players rated 62 unless stated; 1,000 real flights per line). These are the final numbers, after A6's tuning; `proof/A2/a2-touch-grading.txt` was rerun on the finished code.

| What | Result |
|---|---|
| Perfect digs | 0.42 m from the setter on average; 100% within 1 m; top height 4.8 m. That is an easy set. |
| Late digs (200 ms off) | 3.84 m from the setter on average; 9% within 1 m; 51% wild (shanked). She has to chase them. |
| Perfect digs by defenders rated 90 and 40 | 0.30 m against 0.53 m from the setter |
| Sets | A perfect set misses the hitter's spot by 0.22 m at spike height; a late one by 1.21 m. |
| Spike pace | Power 88 hits at 19.5 m/s; power 40 at 14.3 m/s. A full spike meter hits at 16.6 m/s; a tap at 10.3 m/s. |
| Perfect spikes (aimed 0.8 m inside the lines) | 99% in |
| Late spikes | 25% in, 73% in the net, 2% out. A late contact is lower, so the ball doesn't clear the tape. |
| Soft shots | 500 of 500 cleared the tape by 0.4 m or more and landed in, short. |
| Serves | Under 12% on the meter: always into the net. MAX zone: 100% in. Half power: 98% in. |
| Ace ability | A server rated 95 in the MAX zone serves at 20.2 m/s with an error of up to 0.28 m; one rated 94 at 18.6 m/s and 0.57 m. |
| Timing against stats (Medium dig) | A good touch by a player rated 85 scores 0.66; a perfect touch by a player rated 45 scores 0.73. Your timing now counts for more than the ratings in a single touch, as A6 needs. |
| Difficulty and stats | The gap between perfect digs by players rated 85 and 45 is 0.10 on Easy and 0.13 on Hard. |
| Fitness and fatigue | Fitness 60 with fatigue 50 drops a perfect spike from 0.78 to 0.69 and running speed from 5.20 to 4.33 m/s. Stamina 15 drops the spike to 0.72. |
| Height in centimetres | A career height of 188 reaches what 1.88 m does: 2.50 m standing, 2.97 m spiking and 2.83 m blocking. |

The same seed gives the same 400 graded touches, bit for bit.

**Pictures:**
- `a2-digs.png`: the green perfect digs fill the setter's 2 m ring; the red late digs scatter across the half and out of the court.
- `a2-spikes.png`: the perfect spikes land in all over the far half; the late spikes mostly die in the net on the hitter's side.

### Animations, first job (25 Nov 2026)
**The InPlace FBX is now Humanoid.** `AA_Volleyball_InPlace.fbx` was Generic with no Avatar. It is now Humanoid, with "Create From This Model":
- The Avatar is valid and human.
- All 15 required bones are mapped, and 52 bones in all.
- All 175 clips are humanoid.

The RootMotion FBX was already Humanoid and was left as it is. The tool is `Editor/PlayedAnimationSetup.Humanoid`, and its output is `aa-volleyball-humanoid.txt`.

**The soft shot clip.** `094_AA_Volleyball_Attacking_Tip` is the new `SoftShot` state in the players' controller (`Motion Cast#14 - Vol.1/VolleyballController.controller`). It has its own trigger and is wired as Spike is. The contact (her raised hand) is at about 44% of the clip, so the game starts the state at 40%. That way the tip on screen meets the ball.

**Proven on BeachPlayer in Play mode** (`play-strips.txt` and `play-strip-*.png`):
- SoftShot (the AA Tip), plus Spike, Dig, Block and EmergencySave from Motion Cast for comparison.
- In all 24 poses of every clip, her head bone was within 0.08 m of her body's skin: the body follows the skeleton.
- No T-pose.
- The AA Tip is a one-handed tip over the head, with the left hand.

### A3: the controls, played on the court (25 Nov 2026)
**New files:**
- `Assets/Scripts/PlayedMatch/PlayedEngine.cs`: the rally and the rules
- `Assets/Scripts/PlayedMatch/PlayedAi.cs`: the AI seat (refined and proven in A4) and the LocalSeat
- `Assets/Scripts/PlayedMatchRunner.cs` and `Assets/Scripts/PlayedControls.cs`: the court side and the controls
- `Assets/Scripts/MatchManager.Played.cs`: MatchManager's played-match hooks
- `Assets/Editor/PlayedMatchPlayProof.cs`: the proof

**Changed:**
- `MatchManager.cs`: `partial`, plus 2 lines that hand a Manual serve over
- `ManualControl.cs`: the rally buttons stand aside during a played match, and the help panel shows the new controls
- `PlayerStats.cs` and `UnityMatchDataLoader.cs`: fitness and fatigue are now carried through

**Proof** (`a3-played-match.txt`, 28/28): a whole match on V19, Medium, players rated 62. It was driven only through a virtual keyboard and a virtual gamepad. An autopilot sat in the person's seat, took turns with the two devices, read the ball and pressed at the moment.

**Results:**
- **Buttons:** every action fired from both devices: move, dig, set, spike, soft shot, dive, switch and cheer, plus Tab / View, Esc / Menu and H / D-pad down, which stay with ManualControl.
- **Touches:** 242 of the person's touches reached the engine, 121 from each device: 65 digs, 74 sets, 60 spikes and 14 soft shots, all graded by the engine.
- **Serve meter:** 26 of 29 serves were tapped in the MAX zone and graded perfect. The WEAK tap went into the net and lost the point, a serve fault to Team B.
- **Aim:** spikes with the stick held left were sent to x = −2.25 on average, and held right to +2.55.
- **Spike meter:** a long hold hit at 16.9 m/s, a tap at 11.2 m/s.
- **Block and dive:** 2 block jumps at the net (1 block touch) and 32 dives.
- **Auto-switch:** control changed players 233 times by itself; Q / LB took the other player twice.
- **No point decided in advance:** no `[Point] decided` line in the whole played match.
- **Scoring:** 55 points played and 55 in the score, all announced by MatchManager (header, crowd, commentary, MatchReporter). The match ended 2-1, every set legal.
- **Pictures:** `a3-serve-meter.png`, `a3-ring-incoming.png` (the landing ring) and `a3-spike-meter.png`.

**Rules the proof made me add:**
- **Your own serve:** nobody may play her own side's serve, and a serve left on the server's side is the receivers' point at once. The first run had the server's partner playing a serve that was dropping into the net.
- **Aim:** the seat keeps the stick as it was at the press. The engine may only take its next 1/120 s step after the stick has moved on.

**Tuning so far, AI against AI under dotnet** (Medium, both pairs rated 62; `dotnet run -- sim`):
- matches last 9 to 17 minutes
- about 10 touches a rally
- most points are kills
- there are aces, blocks and errors
- both sides win

Two causes made blocks far too strong at first. A blocker stood square in front of every hitter, and her hands covered 0.85 m. Now the blocker takes the line or the angle, her hands follow the jump, and good hitters hit over the block. The win-rate tuning is in A6.

### A4: the AI plays the same game (25 Nov 2026)
**How it plays.** Each AI player (`AiSeat` in `PlayedAi.cs`) presses the same buttons a person does, through the same `SeatInput`:
- She reads the ball's real landing prediction, the same one the ring shows.
- She starts moving after her reaction time and runs at her own rated speed.
- She presses at the ideal moment plus a timing error. The error's spread is set by the difficulty (for the opponents), then narrowed by her rating for that touch.
- The engine grades her touches exactly as it grades the player's, and she has no other way to win a point.
- She also serves through the meter, blocks at the net (taking the line or the angle), aims her attacks at the open court away from the block, and plays a soft shot about one time in six.

**Proof** (`a4-ai-same-game.txt`, Unity batch 9/9, and the same 8 checks under dotnet):

| Check | Result |
|---|---|
| Every point is the ball's | In 30 AI-only matches (Medium, pairs rated 62), 1,453 of 1,453 points went where the ball's own events say. The proof works that out apart from the engine: landed in or out, net faults, four hits. The points split: Kill 1,162, Dropped 187, Ace 46, Out 37, BlockStuff 12, NetFault 9. These are the final numbers, after A6's tuning. |
| Nothing decided beforehand | Even pairs split the matches: the home pair won 17 of 30. |
| Timing comes from the ratings | Same AI level: players rated 85 time touches with an 88 ms spread, players rated 45 with 94 ms. The pair rated 85 beat the pair rated 45 in 20 of 20 matches. |
| Timing comes from the difficulty | The opponents' spread is 106 ms on Easy, 90 on Medium and 74 on Hard. The player's partner stays between 83 and 92 ms on all three. |
| The AI is graded like anyone | In one match: 259 perfect, 158 good, 62 late, 68 missed. |
| Same seed, same match | Seed 9 played twice was identical point for point (53 points). Seed 10 played differently (60 points). |
| No odds in a played match | None of the played match's nine files touches the game's odds or a rally plan (`PointModel.HomeWinsPoint`, `HomeChance(`, `DecidePoint`, `MakePlan`, `_plan`, `PointChanceHome`, `OverridePlan`). The A3 proof also found no `[Point] decided` line in a whole played match. |

### A5: difficulty from the career (25 Nov 2026)
**Game side.** `GET /api/unity/match-state` now sends `gameDifficulty` for club matches and Empire Nations Cup matches. It comes from the career's own setting through the game's `gameDifficultyOf`, so a career made before difficulty existed sends `medium`. The change is in `artifacts/api-server/src/routes/unity.ts`.

**Court side.** The loader reads it, and the played match runs at it:
- the timing windows
- how much the stats weigh
- the opponents' AI sharpness (the partner stays at Medium's)
- the landing ring: on Easy and Medium, not on Hard
- the button prompts: on Easy only

**Proof: `harness/played-match.mjs --unity`.** This is a new suite (port 4967). It runs the real api-server on a copy of the starter database and makes four careers.
- **The payload (6/6):** Easy, Medium and Hard send "easy", "medium" and "hard". A career with no value sends "medium".
- **The courts:** three Unity batch runs, one per career. Each reads its career's match from that server and plays 6 points, measuring the helpers in every frame. Each passes 14/14:

| | The court plays at | Ring shown | Prompt shown |
|---|---|---|---|
| Easy | easy | 14,494 of 14,494 frames with the ball coming to your side | 14,488 of 14,488 frames when it was yours to play |
| Medium | medium | in every such frame | never |
| Hard | hard | never | never |

  On every court, the opponents played at that difficulty's sharpness and the partner at Medium's.

### A6: fair to the career (25 Nov 2026)
**Reported and paid exactly as now.**
- A played point is announced by `MatchManager.Played.cs` and reported through the same `MatchReporter.SendProgress` and `SendResult` calls as an Auto point. Nothing in the report says how the match was played.
- `harness/watched-result.mjs` (existing) proves that `/unity/match-result` goes through `completeMatch`, the path Sim Result uses.
- **Proof, `harness/played-match.mjs --unity-full`, 12/12.** The real career's match (Medium; pairs rated about 67–80) was watched, then the Unity court played the whole match on the server, 28/28 checks.
  - MatchReporter posted the result, and the game recorded exactly the court's score: 2-1 (9-11, 11-3, 11-3).
  - The win counted, and the $4,333 prize ("World Tour R1 vs Amsterdam Dune Riders") is on the ledger.
  - Both players' fitness and fatigue were charged: 100 to 95 and 93; 0 to 15 and 17.

**The win-rate table (for Rob to judge).**
- **Who plays:** an "average player" with a pad (`PlayedMatchSims.AveragePlayer`) plays whole matches headless under dotnet.
- **Her thumbs:** a 75 ms timing spread and a 280 ms reaction, whoever she controls.
- **Her play:** she reads the ring to within 0.30 m (0.65 m on Hard, where there is no ring), aims where she fancies rather than at the open court, and tries a block about one time in three.
- **The court around her:** control follows the ball as on the court, her partner is the Medium AI, and the opponents are the AI at the difficulty.
- **The sample:** 200 matches per cell, with fitness 100 and fatigue 0.

| Difficulty | Weak (45) v strong (80) | Same, expert thumbs | Slightly weaker (57) v (67) | Even (62) v even (62) | Strong (80) v weak (45) |
|---|---|---|---|---|---|
| Easy | 1% (±2%) | 10% (±4%) | 43% (±7%) | 69% (±6%) | 100% |
| Medium | 0% | 6% (±3%) | 24% (±6%) | 52% (±7%) | 97% (±2%) |
| Hard | 1% (±1%) | 11% (±4%) | 12% (±4%) | 29% (±6%) | 90% (±4%) |
| Sim Result (the game's engine, same ratings) | 14% | — | 37% | 51% | 85% |

"Expert thumbs" means a 40 ms timing spread, a 200 ms reaction, reading the ball to within 0.15 m and blocking more. The ± figure is the 95% margin of each 200-match cell. The share of points won is in `a6-dotnet.txt`.

**What the table says:**
- **Even pairs:** Medium is a fair contest (52%, against Sim Result's 51%). Easy gives the player an edge (69%). Hard is a stiff test (29%).
- **Quick thumbs:** they do not carry a far weaker pair. Even an expert wins only 6–11% with a 45 pair against an 80 pair.
- **Mismatches are more decisive than in Sim Result.** A far weaker pair almost never wins (0–1%, against Sim's 14%), and a far stronger one almost always does (90–100%, against Sim's 85%). The body's ratings (speed, power, reach) keep their full range, so a big gap is hard to play through.
- **Close gaps are a little steeper than Sim Result on Medium:** 24% at −10, against Sim's 37%. The quick tuning runs put this between 20% and 31%, inside the ±6% margin.

**How it got here.** The first engine counted ratings about three times as steeply as Sim Result, and the opponents' timing was sharper than an average human's. A6 tuned three things: how far a touch's rating reaches (`TouchRules.SkillSpread` 0.40), the body's full range (`TouchRules.Physical`), and the AI's sharpness at each difficulty. Decision 20 explains why.

**Found along the way.** The career sends heights in centimetres. Until it was fixed, a 188 cm player reached 250 m, and with real career players no set or spike could be timed. The court's prefab players carry metres, so the earlier proofs never saw it. Auto has the same reading of height; see decision 22.

**`ManualControlsProof` is retired:** Manual is the played match now. A8 deletes it, and `PlayedMatchPlayProof` takes its place.

### A7: Auto mode is not touched (25 Nov 2026)
**What stays the same:**
- Auto is still the default.
- Auto still decides every point at the serve from the game's own chance (`PointModel`) and plays the rally to that plan.
- The only changes to Auto's code are the two lines that hand a Manual serve to the played match (A3), and A8 removing the manual branches.

**Proof, on the code after A8's demolition:**
- **`RallyPlanProof`: RESULT: PASS.** The match was BLUE SHARKS 0-2 RED GIANTS (13-15, 6-11), and every set was legal. Every point went to the team decided at its serve. The zoom buttons, the result box, the crowd falling quiet and the ace ability (rated 95 against 94) all pass. One check is gone, the old "first dig after a serve is not aided", because A8 removed the aid it guarded.
- **`harness/one-set-of-odds.mjs` (20/20):** the court's `PointModel.cs` and the game's engine still play the same matches from the same chance.
- **`harness/boosts.mjs` (12/12):** the boosts still work as before.
- **`harness/watched-result.mjs` (22/22):** the court's result is still recorded through `completeMatch`.

### A8: the demolition (25 Nov 2026)
**Deleted:**
- `Assets/Editor/ManualControlsProof.cs` and its `.meta`: 478 lines. It proved the forgiving pathway, which no longer exists. `PlayedMatchPlayProof` is the new engine's proof.

**Cut down** (1,266 lines out, 93 in):

| File | Lines (before Part A → now) | What went |
|---|---|---|
| `Assets/Scripts/MatchManager.cs` | 2,529 → 2,265 | See the list below. |
| `Assets/Scripts/ManualControl.cs` | 733 → 319 | Everything but the Auto / Manual switch (Tab / View / Share, the page, the Nations Cup "Auto only" rule), pause, the controls help and the mode badge. Gone: the ring and the ball that waited for you, the touch windows (`BallComing`, `Arrival`), the manual serve meter, the manual block, `Drive` and `DriveAlongServeLine`, the switch and cheer handling, the prompt and the old serve bar. `ManualAction` is cut to None, Toggle, Pause and Help. The played match's buttons and meters are `PlayedControls`'. |
| `Assets/Editor/RallyPlanProof.cs` | 307 → 297 | The "first dig not aided" check, with the aid. |
| `Assets/Scripts/PlayerAnimationHelper.cs` | one condition | `!ManualControl.Controls(...)` on Auto's automatic dive. |
| `Assets/Scripts/PlayedMatchRunner.cs` | one line | It no longer asks ManualControl who to control: control follows the ball from the first serve. |

**What went from `MatchManager.cs`:**
- the manual serve phase: `UpdateManualServe`, `ClampToServeLine`, the serve band, the manual serve speed
- the manual block
- the ball waiting for a manual touch: `NotifyManualBallComing`, `HoldsForManualTouch`, `NeedFor`, `IsSaveableWinner`
- the player's saves and misses rewriting the point's plan: `SaveByPlayer`, `OverridePlan`, `PointEnding.Miss`, and `MakePlan`'s mid-rally branch (always 0 since, so the draws are unchanged)
- the first-dig aid and its record: `FirstDig`, `FirstDigs`, `AidsFirstDig`, `FirstDigAidRadius`
- the manual drive
- the serve snapshot's three manual fields

A grep of the Unity project finds no reference left to any of it.

**Proofs, after the demolition:**
- The project compiles with 0 errors. The only warnings are four old ones in files A8 did not touch.
- `PlayedMatchPlayProof` passes 28/28: a whole played match, 2-0 (11-4, 11-7), through the virtual keyboard and gamepad.
- `harness/played-match.mjs --a6` passes 6/6 (engine checks A1, A2, A4 and A6, and the difficulty payload).
- RallyPlanProof and the three Auto suites pass (A7).

**The full harness gains the new suite.** `harness/run-all.mjs` now runs `played-match.mjs --a6` as suite 57b, without the Unity courts, which need Unity closed. `runSuite` gained an optional argument list for it.

**The whole played match against the server, `harness/played-match.mjs --unity-full`.**
- **25 Nov, 19:23–19:30:** 12/12, on Unity `e6efc68`. The court won 2-0 (11-4, 11-9). Recorded in commit `6a482129`.
- **26 Nov, after the Auto height fix and the retune: 12/12, no failures.**
  - **The run:** 20:00–20:06, on Unity `fadb71f`.
  - **Engine and payload:** the engine's checks pass 54/54 under dotnet, and the four difficulty payloads pass.
  - **The court:** it played the whole match, 28/28, 2-0 (11-5, 11-7).
  - **The game:**
    - MatchReporter posted the result, and the game recorded exactly that score.
    - The win counted, and the prize is on the ledger.
    - Fitness was charged 100 to 93 for both players, and fatigue 0 to 18 and 21.
  - **The files:** the output is `proof/A8/harness-unity-full.txt` (now this run's). Beside it are the Unity log (`harness-unity-full-unity.log`) and the court's own proof (`harness-unity-full-court.txt`).
  - **Where it ran:** the suite was pointed at a scratch proof folder so the committed A6 files were not overwritten, and its two files were copied here.

### Difficulty retuned to Rob's rule (26 Nov 2026)
**Rob's rule:** the player must not lose more often than he wins at any difficulty.

**The targets,** for even pairs (62 v 62), the average player, 200 matches a cell:
- Easy at least 80% (aim 85%)
- Medium 60–80% (aim 70%)
- Hard 50–70% (aim 60%)

**The limits:**
- Strong (80) v weak (45) stays at 90% or more.
- Weak (45) v strong (80) stays under 14%.
- Hard is harder than Medium, and Medium harder than Easy.
- Hard keeps no ring.

**The result:** the first full 200-match table was inside every target, so it was run once (of the three allowed). `proof/A6/a6-dotnet.txt` has 10/10 checks.

**The new table beside the old one** (the person's pair's match win rate; ± is the 95% margin):

| Difficulty | Weak (45) v strong (80) | Same, expert thumbs | Slightly weaker (57) v (67) | Even (62) v even (62) | Strong (80) v weak (45) |
|---|---|---|---|---|---|
| Easy, **now** | 10% (±4%) | 26% (±6%) | 58% (±7%) | **86%** (±5%) | 100% |
| Easy, 25 Nov | 1% (±2%) | 10% (±4%) | 43% (±7%) | 69% (±6%) | 100% |
| Medium, **now** | 3% (±2%) | 15% (±5%) | 50% (±7%) | **73%** (±6%) | 99% (±1%) |
| Medium, 25 Nov | 0% | 6% (±3%) | 24% (±6%) | 52% (±7%) | 97% (±2%) |
| Hard, **now** | 3% (±2%) | 47% (±7%) | 35% (±7%) | **56%** (±7%) | 97% (±2%) |
| Hard, 25 Nov | 1% (±1%) | 11% (±4%) | 12% (±4%) | 29% (±6%) | 90% (±4%) |
| Sim Result (the game's engine, same ratings) | 14% | — | 37% | 51% | 85% |

**Against the targets:**
- **Even pairs:** Easy 86% (aim 85%), Medium 73% (aim 70%), Hard 56% (aim 60%). All three are inside, and Easy > Medium > Hard.
- **Weak v strong:** 3–10%, under 14% everywhere.
- **Strong v weak:** 97–100%, 90% or more everywhere.

**One thing for Rob, not one of his limits:** with expert thumbs (a 40 ms timing spread, 200 ms reaction), a weak pair now beats a far stronger one 26% of the time on Easy and 47% on Hard.
- **Why:** Hard's narrow timing windows punish a sloppy opponent far more than a steady player. To let the average player win 56% there, the Hard AI's timing had to be about as loose as Medium's. An expert's 40 ms timing then loses almost nothing in those windows, while the AI loses a lot.
- **Your call:** this clashes with the brief's line that "a weak pair should not beat a far stronger pair just because the player has quick thumbs". The new rule wins for now, and the A6 checks follow Rob's 26 Nov targets. The expert cell is reported, not checked.

**Every number changed:**

| Setting (`Assets/Scripts/PlayedMatch/PlayedAi.cs`, `AiLevel.For`) | Was (25 Nov) | Now |
|---|---|---|
| Easy opponents: timing spread / reaction / placing | 0.120 s / 0.305 s / 0.39 m | 0.128 s / 0.318 s / 0.415 m |
| Medium opponents, and the player's partner on every difficulty | 0.097 s / 0.260 s / 0.31 m | 0.105 s / 0.268 s / 0.325 m |
| Hard opponents | 0.079 s / 0.230 s / 0.262 m | 0.088 s / 0.242 s / 0.28 m |

**What did not change:**
- the timing windows (Easy ±100/200/360 ms, Medium ±65/140/260, Hard ±45/100/190)
- how much the ratings count (`SkillSpread` 0.40, `Physical`, `StatWeight` .46/.50/.62)
- the soft-shot share
- the ring, which Hard still does not have

**The checks changed to match** (`Assets/Editor/PlayedMatchChecks.cs`):

| Check | Was | Now |
|---|---|---|
| A6, weak v strong | at most 20% | under 14% |
| A6, strong v weak | at least 80% | at least 90% |
| A6, even pairs on Medium | 35–65% | per difficulty: Easy 80%+, Medium 60–80%, Hard 50–70% |
| A6, expert thumbs | at most 20% (a check) | reported only |
| A4, AI timing spread | measured over each difficulty's own window | measured over Hard's late window (±190 ms) on all three |

**Why A4's measurement changed.** The partner's level is the same on every difficulty, yet over each difficulty's own window her spread read 99 ms on Easy, 98 on Medium and 87 on Hard. That failed the 12 ms tolerance. Only touches that are made carry a timing error, and Hard's window cuts off the worst ones sooner, so Hard alone made her look steadier. Over the same window she reads 87, 88 and 87 ms, and the opponents 94, 86 and 79 ms. `a4-dotnet.txt` keeps both sets of figures.

**Proofs rerun on the final code** (Unity `fadb71f`):

| Proof | Unity batch | dotnet |
|---|---|---|
| A1 | 23/23 | 18/18 |
| A2 | 28/28 | 28/28 |
| A4 | 9/9 | 8/8 |
| A6 | — | 10/10 |

The whole played match on the server (`harness/played-match.mjs --unity-full`) passed 12/12; see A8.

**How long a played match takes at normal speed (1x).** These are from the same 200-match runs, at even ratings with the average player. The engine's clock is real time at 1x.

| Difficulty | Match (mean) | Longest | Points | A point | Rally | Serve wait | Point over | Walk to positions |
|---|---|---|---|---|---|---|---|---|
| Easy | 11.6 min | 19.5 min | 45 | 15.5 s | 9.7 s (8.5 touches) | 2.6 s | 1.9 s | 1.3 s |
| Medium | 12.5 min | 19.5 min | 49 | 15.2 s | 9.5 s (8.5 touches) | 2.5 s | 1.9 s | 1.3 s |
| Hard | 11.2 min | 18.4 min | 49 | 13.6 s | 7.9 s (7.2 touches) | 2.5 s | 1.9 s | 1.3 s |

**Rob's matches run no longer than 5 minutes. A played match runs more than twice that.** Nothing was changed for it yet, as instructed. Where the time goes, per point:
- **The rally, 8–10 s (58–63% of a point).** Rallies average 7–8.5 touches, about three attacks, and each touch is a real flight. A dig or set rises to 3–5 m, and a ball that high takes about 1.5 s up and down.
- **The serve wait, 2.5 s (16–18%).** The meter sweeps for 1.2 s each way, and the server waits a moment before tapping: the AI 0.6–1.5 s, the average player 0.8–2.0 s.
- **The pause after a point, 1.9 s (12–14%).** That is the engine's `PointOverSeconds` (1.8 s; 3.2 s after a set).
- **The walk back to positions, 1.3 s (8–10%).**

There are 45–49 points a match.

### Rob's ruling on mismatches (26 Nov 2026, second ruling): WITHDRAWN
> **Withdrawn by Rob on 26 Nov 2026 and reverted** (Unity `5bf216d` reverts `05622cf`). `TouchRules.RatingReach` and `Toward62` are gone, and `PlayedMatchChecks.A6` is back to the first retune's checks. The A4 check that gave way under this ruling passes again. This section is kept as the record; its table is on file as `proof/A6/a6-dotnet-26nov-second.txt`. What replaced it is in "Hard only: the strong AI's timing".

**The ruling,** in the opponents' terms, with the player as the average player:
- **Leave as they are (even pairs, 62 v 62):** an equal AI team beats the player Easy 14%, Medium 27%, Hard 44%, within 3 points.
- **Change (the player's strong pair 80 v an AI weak pair 45):** the weak AI team beats the player Easy 2%, Medium 4%, Hard 10%.
- **Report, not a target:** the player's weak pair (45) against an AI strong pair (80), both with expert thumbs and with the average player.
- **Rules:** Hard is harder than Medium and Medium harder than Easy; Hard has no ring; no game timing changes.

**The result.** The full 200-match table was run twice (of the three allowed); run 2 is final (`proof/A6/a6-dotnet.txt`, 7/7). Every target is within one point:

| The AI team wins (opponents' side) | Easy | Medium | Hard |
|---|---|---|---|
| Equal AI team (62 v 62), target | 14% | 27% | 44% |
| Equal AI team, **now** | **14%** | **27%** | **44%** |
| Weak AI team (45) v the player's strong pair (80), target | 2% | 4% | 10% |
| Weak AI team v strong pair, **now** | **2%** | **5%** | **11%** |

**The three tables side by side**, all from the opponents' side: how often the AI team wins. Each is 200 matches a cell; the ± margins are in the proof files.

| The AI team wins | Weak AI (45) v the player's strong pair (80) | Equal (62 v 62) | AI (67) v the player's (57) | Strong AI (80) v the player's weak pair (45) | The same, the player with expert thumbs |
|---|---|---|---|---|---|
| Easy, 25 Nov | 0% | 31% | 57% | 99% | 90% |
| Easy, 26 Nov first retune | 0% | 14% | 42% | 90% | 74% |
| **Easy, now** | **2%** | **14%** | **19%** | **50%** | **18%** |
| Medium, 25 Nov | 3% | 48% | 76% | 100% | 94% |
| Medium, 26 Nov first retune | 1% | 27% | 50% | 97% | 85% |
| **Medium, now** | **5%** | **27%** | **43%** | **76%** | **28%** |
| Hard, 25 Nov | 10% | 71% | 88% | 99% | 89% |
| Hard, 26 Nov first retune | 3% | 44% | 65% | 97% | 53% |
| **Hard, now** | **11%** | **44%** | **48%** | **80%** | **20%** |

The files are `proof/A6/a6-dotnet-25nov.txt`, `a6-dotnet-26nov-first.txt` and `a6-dotnet.txt` (now). Those files give the player's side, so each figure here is 100 minus the file's.

**The reported figures, in the player's terms** (the player's weak pair, 45, against an AI strong pair, 80):

| | Easy | Medium | Hard |
|---|---|---|---|
| Average player | 50% | 24% | 20% |
| Expert thumbs | 82% | 72% | 80% |

**What this means, plainly:**
- **Ratings now count for less in a played match, on purpose.** For a far weaker AI team to win 2–11% against the player's strong pair, while equal teams stay where they were, the gap between a 45 and an 80 has to shrink. That cuts both ways.
- **A weak pair can now beat a strong one.** The average player's weak pair (45) beats a strong AI pair (80) half the time on Easy, and an expert's beats it 72–82% of the time.
- **The first brief said otherwise.** It wanted a weak pair not to beat a far stronger pair "just because the player has quick thumbs". Your ruling made that a figure to report, and it is reported here.

**Why Hard was the highest for expert thumbs (26%, 15%, 47% before this change).**
- Hard has the narrowest timing windows. The AI's timing is looser than an expert's, and to let an average player win 56% on Hard, the Hard AI's timing had to be about as loose as Medium's.
- In Hard's narrow windows, many of that AI's touches land late or are missed, while an expert's 40 ms timing almost always lands inside. So the narrow windows cost the AI far more than they cost the expert, and the expert's gain is biggest on Hard.
- **Now (82%, 72%, 80%):** Hard and Easy are about level, and both are above Medium.
  - **Easy:** the AI is loosest and ratings count least, so the expert's precision wins most there.
  - **Hard:** the window effect above still applies.
  - **Medium:** the AI is sharper than Easy's and the windows are wider than Hard's, so there is less for an expert to gain.

**Every number changed:**

| What | Before | Now | Where |
|---|---|---|---|
| How far each rating stands from an average player (62) in a played match, per difficulty | 1.00 everywhere (no such pull) | Easy 0.45, Medium 0.42, Hard 0.50 | New: `TouchRules.RatingReach(Difficulty)` and `Toward62`, applied once in `PlayedEngine.Effective` to power, speed, defence, serve, block and overall. An even pair (all 62) is exactly unchanged. Stamina, fitness and fatigue are not pulled. |
| A6 checks | the 26 Nov targets (player wins Easy 80%+, Medium 60–80%, Hard 50–70%; weak v strong under 14%; strong v weak 90%+) | the AI team wins Easy 14%, Medium 27%, Hard 44% (±3 points); the weak AI team wins Easy 2%, Medium 4%, Hard 10% (within the cell's 95% margin, at least ±2); Easy < Medium < Hard | `PlayedMatchChecks.A6` |

**What did not change:**
- the AI's sharpness (`AiLevel`)
- the timing windows
- `SkillSpread`, `Physical`, `StatWeight`
- the ring (Hard still has none)
- match length and every game timing: serve meter, point-over pause, positioning, flight and reaction times

**Tried and put back:**
1. Pulling only the body's ratings (speed, power, reach) towards the average moved Easy and Medium but hardly moved Hard.
2. Lowering Medium's and Hard's stat weights moved the even pairs out of their 3-point band.

Neither is in the final code.

**The target that gave way: A4's check "players rated 85 time their touches more tightly than players rated 45".**
- **What failed:** the check measured 96 ms against 97 ms and needs a 3% difference. A4 now fails 7/8 under dotnet and 8/9 in Unity. `played-match.mjs` therefore reports its engine-checks line as FAIL (53/54).
- **Why:** the AI's timing still comes from its ratings, by the same formula. But your ruling pulls ratings close to average: on Medium an 85 plays like a 72 and a 45 like a 55. So the formula now expects only about 4% less spread, and the measurement does not show it clearly.
- **What I did about it:** nothing. The ruling did not touch A4, so I left the check as it was rather than loosen it to pass.

**Proofs on the final code:**

| Proof | Result |
|---|---|
| A1 | 23/23 (Unity), 18/18 (dotnet) |
| A2 | 28/28, 28/28 |
| A4 | 8/9 (Unity), 7/8 (dotnet): the check above |
| A6 | 7/7 |
| `harness/played-match.mjs --unity-full` (`proof/A8/harness-unity-full.txt`, with the Unity log and the court's proof beside it) | 11/12. The one failure is the engine-checks line (A4's check). The court played the whole match 28/28, 2-0 (11-9, 11-8). The game recorded exactly that score, the win and prize counted, and fitness was charged (100 to 93 for both players). |

### The 30-season career harness
**What it plays.** The harness is `harness/long-career-update1.mjs`, run with `SEASONS=30`.
- **It uses only Sim Result.** Every one of the player's matches is played through `POST /matches/:id/simulate` (line 408), and the AI clubs' matches are simulated on the server.
- **It never uses the played match.** It does not touch the 3D court or any code under `Assets/Scripts/PlayedMatch`.
- **So:** nothing in Part A or in either retune can change its results. It tests the career around the matches: the market, retirements, money, injuries and the champion.

**The run (25 Nov 2026, 20:55 to 21:27, about 32 minutes).** It ran once, on Medium, career 1, on the final code. It ended with SOAK COMPLETE: 30 of 30 seasons and exit code 0, with nothing on stderr. The table is saved in `proof/30-season/`: `soak-30-seasons.txt` (the printed table) and `soak-30-seasons.json` (the same figures as data).

| Season 30 (the last) | Figure |
|---|---|
| AI seniors' average rating | 70.6 (top: 91, 89, 89, 88, 88) |
| AI clubs with 3 seniors / with a coach and a medic | 59 of 60 / 59 of 60 |
| Stats above 99 or below 1 | 0 |
| AI clubs over the cap that signed anyone | 0 (must be 0) |
| Free agents left at the season's end | 82 |
| AI balances | lowest $35,317, median $978,810, 0 below zero |
| AI injuries | 121 (reconstructions 0) |
| Short-squad club-days (fewer than two seniors) | 0 across all 30 seasons |
| Champion | Lima Pacific Soarers |

**The one flag.** In some seasons a few AI clubs were short of a doctor or physio. By season it ran 0/0/0/0/2/1/1/2/5/0/5/2/1/1/2/0/1/2/0/1/1/2/0/0/0/0/0/1/2/1, so the worst seasons had 5 clubs of 60 short. This flag belongs to the career's staff market and not to the played match. Nothing was changed for it.

### Hard only: the strong AI's timing (26 Nov 2026)
**Rob's instruction:**
- Withdraw the second ruling, then tune Hard only.
- The problem: with expert thumbs, the player's weak pair (45) beat a strong AI pair (80) 47% of the time on Hard. The target is 15–25%.
- Hold on Hard:
  - even pairs: the player wins 50–70%, within 3 points of 56%
  - the average player's weak v strong: under 14%
  - strong v weak: 90% or more
  - Hard harder than Medium, and no ring
  - no change to match length or game timing
- Easy's and Medium's rows must come out as in the first retune.

**Step 1, the withdrawal:**
- Unity `5bf216d` reverts `05622cf` (a revert, not a reset, because the commit was pushed).
- `PlayedMatchChecks.A6` is back to the first retune's checks.
- Last night's table is kept as `proof/A6/a6-dotnet-26nov-second.txt`.
- **A4's check "rated 85 steadier than rated 45" passes again:** 92 ms against 99 ms. A4 is 9/9 in Unity and 8/8 in dotnet.

**The cause, and the fix.**
- **The cause:** the Hard AI's timing was loosened for every rating, so that an average player could win 56% of even matches. Hard's narrow windows then cost every AI, strong or weak, far more than they cost an expert, whose 40 ms spread almost always lands inside them.
- **The fix:** on Hard, an AI player's rating now counts for more in her timing (`AiLevel.ratingPull`, 1.0 on Hard). A strong AI times as sharply as her rating says, so the narrow windows no longer hand an expert the points she misses.
  - An average AI (62) times exactly as before, which keeps even pairs at 56%.
  - Ratings now count for more on Hard, not less: nothing is flattened, and there is no rule about experts.
- **Hard AI's timing spread by rating** (base 88 ms; every touch of an all-45, all-62 or all-80 player):

| Rating | Before | Now |
|---|---|---|
| 45 | 89 ms | 97 ms |
| 62 | 86 ms | 86 ms |
| 80 | 83 ms | 74 ms |

**What was tried first, and why it was not kept.** Making the whole Hard AI sharper, for every rating, does fix the narrow-window gift. But then the average player loses even pairs, and the only way found to bring them back to 56% was a slower-reacting AI. An expert exploits a slow AI just as well, so the gift only moved from timing to footwork. Quick sims, 200 matches each, the player's side:

| Hard AI: timing sd, reaction, placing | Even pairs | Expert, weak v strong | Strong v weak |
|---|---|---|---|
| 88 ms, 242 ms, ±0.28 m (the first retune) | 56% | 43% | 98% |
| 60 ms, 242 ms, ±0.28 m | 2% | 0% | 66% |
| 70 ms, 300 ms, ±0.50 m | 35% | 20% | 95% |
| 60 ms, 360 ms, ±0.50 m | 54% | 33% | 97% |
| 45 ms, 400 ms, ±0.28 m | 39% | 25% | 98% |
| 35 ms, 450 ms, ±0.28 m | 74% | 51% | 100% |

Whenever even pairs came back to about 56%, the expert figure stayed at 33% or more. **The rating pull, scanned with the quick sims:** expert weak v strong 27% at 0.6, 26% at 0.7, 18% at 0.85, 21–23% at 1.0, 10% at 1.2, 12% at 1.5 and 0% at 3.0. Even pairs held at 56–59% throughout. 1.0 is the middle of the band.

**The result.** The full 200-match table was run once (of the three allowed): `proof/A6/a6-dotnet.txt`, 10/10. All four tables are below, from **the player's side** (how often the player's pair wins, with the average player unless it says expert). The second ruling's section gave its table from the opponents' side; here it is the same file turned round.

| Player wins | Weak (45) v strong (80) | Same, expert thumbs | Slightly weaker (57) v (67) | Even (62) v (62) | Strong (80) v weak (45) |
|---|---|---|---|---|---|
| Easy, 25 Nov | 1% | 10% | 43% | 69% | 100% |
| Easy, 26 Nov first retune | 10% | 26% | 58% | 86% | 100% |
| Easy, second ruling (withdrawn) | 50% | 82% | 81% | 86% | 98% |
| **Easy, now** | **10%** | **26%** | **58%** | **86%** | **100%** |
| Medium, 25 Nov | 0% | 6% | 24% | 52% | 97% |
| Medium, 26 Nov first retune | 3% | 15% | 50% | 73% | 99% |
| Medium, second ruling (withdrawn) | 24% | 72% | 57% | 73% | 95% |
| **Medium, now** | **3%** | **15%** | **50%** | **73%** | **99%** |
| Hard, 25 Nov | 1% | 11% | 12% | 29% | 90% |
| Hard, 26 Nov first retune | 3% | 47% | 35% | 56% | 97% |
| Hard, second ruling (withdrawn) | 20% | 80% | 52% | 56% | 89% |
| **Hard, now** | **0%** | **18%** | **18%** | **56%** | **100%** |

**Against Rob's instruction:**
- Easy's and Medium's rows are identical to the first retune, to the match; their settings were not touched.
- On Hard:
  - expert thumbs: 18% (target 15–25%)
  - even pairs: 56% (unchanged)
  - the average player's weak v strong: 0% (under 14%)
  - strong v weak: 100% (90% or more)
  - Hard is harder than Medium for even pairs: 56% against 73% (for expert thumbs, see the cost below)
  - no ring
- Match length on Hard is unchanged: 11.2 minutes, the same as before.
- No target gave way.

**The cost, reported, not a target:**
- **Slightly outrated:** on Hard, the player's pair 10 points weaker (57 v 67) now wins 18%, down from 35%. Sim Result gives 37% for the same pairs. On Hard a 10-point edge is now a large edge, though not yet a certainty. The pull acts on every rating gap, so it cannot move the 45 v 80 figure without also moving this one.
- **Expert thumbs, Hard against Medium:** with expert thumbs the weak pair wins 18% on Hard and 15% on Medium, so for an expert Hard is now slightly easier than Medium in this one match-up. The two are within each other's 95% margins (±5%), and Rob's rule (Hard harder than Medium) is measured on even pairs, where it holds.

**Every number changed:**

| What | Before | Now | Where |
|---|---|---|---|
| `TouchRules.RatingReach`, `Toward62` (the second ruling) | Easy 0.45, Medium 0.42, Hard 0.50 | gone (reverted) | Unity `5bf216d` |
| `PlayedMatchChecks.A6` | the second ruling's checks | the first retune's checks (Easy 80%+, Medium 60–80%, Hard 50–70%; weak v strong under 14%; strong v weak 90%+) | Unity `5bf216d` |
| `AiLevel.ratingPull` (new) | none | Easy 0, Medium 0, Hard 1.0 | `PlayedAi.cs`, `AiLevel.For` |
| The AI's timing spread (`AiSeat.Sigma`) | level × (1.20 − 0.40 × skill) | level × max(0.25, 1.20 − 0.40 × skill − ratingPull × (skill − skill at 62)). With a pull of 0 this is the same number, bit for bit, so Easy and Medium are unchanged. | `PlayedAi.cs` (Unity `dd08097`) |

**Not changed:**
- the timing windows
- the AI's timing sd, reaction, placing and soft shots
- `SkillSpread`, `Physical`, `StatWeight`
- the partner (Medium's AI on every difficulty)
- the ring (Hard has none)
- match length and every game timing

**Proofs on the final code** (saved over the old ones):

| Proof | Result |
|---|---|
| A1 | 23/23 (Unity), 18/18 (dotnet) |
| A2 | 28/28, 28/28 |
| A4 | 9/9 (Unity), 8/8 (dotnet); "rated 85 steadier than rated 45" passes, 92 against 99 ms |
| A6 | 10/10 |
| `harness/played-match.mjs --unity-full` (`proof/A8/harness-unity-full.txt`, with `harness-unity-full-court.txt` and `harness-unity-full-unity.log` beside it) | 12/12. The engine's checks 54/54. The court played the whole match, 28/28, 2-0 (11-9, 11-6). The game recorded exactly that score, the win and prize counted ($4,333), and fitness was charged (100 to 94 and 93). |

The 30-season harness was not run, as instructed. Unity was closed for every batch run.

**Rob, 26 Nov:** stop tuning win rates here. Rob will do the final pass himself after playing with a pad.

### Animations, the rest of the section (26 Nov 2026)
Both packs were confirmed in `Assets` before this started: AA_Volleyball's first job was done on 25 Nov, and KAWAII ANIMATIONS 100 is in `Assets/KAWAII_ANIMATIOMS_100`. Unity was closed for every batch run.

**What went into the players' controller** (`Editor/PresentationAnimationSetup.Run`; the list is in `presentation-states.txt`). Every clip was checked as Humanoid.

| Moment | States (clip) |
|---|---|
| Point won (17) | KAWAII: Cheers, Cheer, Yay, JumpForJoy, Shout, ThumbsUp (65 and 91), MotivatedPose, DoublePeacePose, Taunt, Backflip, CartwheelAndBackHandspring. Motion Cast: the three "Reaction after point obtained". PromptMotion: clapping, cheering with both arms raised. |
| Point lost (6) | KAWAII: FeelDown, Cry, Angry. Motion Cast: the three "Reaction after lose point". |
| Pairs (4) | KAWAII: HighFive1 _1 and _2, Hug1 _1 and _2. |
| Walk-on (3) | KAWAII: Walk01 (set to loop), WaveHands, GreetingBow. |
| Winners' celebration (3) | Motion Cast: the three "Passes under the net while applauding the public". |
| Between points and time-outs (5) | KAWAII: Waiting (set to loop), Stretch, HandsOnHipsConfident. AA_Volleyball: Resting_Position_Loop, Stand_Idle_Type01_Loop. |
| Hand signals (1) | AA_Volleyball: Ready_Position_Loop, the stance under the IK (below). |
| Medal moment (3, chained) | KAWAII: GreetingBow, then LookAtHands, then Cheers. |

Two of the import settings changed: Loop Time is now on for KAWAII's Walk01 and Waiting. No asset was deleted.

**The proof: every state on the real BeachPlayer in Play mode** (`presentation-strips.txt`, 42/42, with one `play-strip-<state>.png` each).
- Each state was frozen at 24 moments and drawn at 6 of them.
- Her head bone was within 0.08 m of her skin in every pose, so the body follows the skeleton.
- No pose looks like the bind T-pose.
- The three idle loops (Rest, Stand, SignalStance) hardly move, as an idle should. They are reported as still idles.
- **The measuring was fixed on the way.** Nothing draws the players between pictures in batch mode, so Unity stopped animating them. The numbers measured between pictures (not the pictures themselves) could therefore be stale. The tools now make the Animators always animate. The 25 Nov strips (SoftShot and the four Motion Cast clips) were measured the old way; their pictures were right.

**Looked at and turned down:**
- **KAWAII `Sit_Sorrow`.** It is made for a chair, so on the sand she sits on nothing (`rejected/play-strip-Lost_SitSorrow.png`). It is not in the controller.
- **PromptMotion's other three clips** (a relaxed spectator standing, one casual, one taking a photo). They are spectator idles, not player moves, and the crowd already uses them. The two player-like ones (clapping, cheering with both arms) are in.
- **Motion Cast's "Rises from the chair and greets the audience"** starts seated, so the walk-on uses KAWAII's WaveHands and GreetingBow instead. The ceremonies keep using it, as they are.

**The pairs** (`Editor/PresentationPairProof`, `pair-placement.txt`, `pair-strip-HighFive.png`, `pair-strip-Hug.png`). The game plays clips with root motion off, so the spacing the pair was recorded at is not in the clips as played. It was worked out:
- Each half was played on a BeachPlayer and read at 48 moments.
- Every placement of the second player was tried: 5° steps of facing and 4 cm steps across and along. They must stand in front of each other and face each other.
- **High five:** the second stands 0.75 m away (0.20 m across, 0.72 m ahead), turned 145°. At the slap their hands are 6 cm apart, and 4 cm on the drawn poses. Their bodies are never closer than 0.76 m.
- **Hug:** the second stands 0.22 m away, face to face (turned 180°). In the hold their chests are 23 cm apart (19 cm drawn), and their hips are never closer than 0.24 m.
- **Two first tries were wrong, and the pictures showed it:**
  - The high five matched hands hanging at rest, before the slap.
  - The hug placed one player inside the other.
  - The rules now use the slap's moment (her raised hand at its highest) and the middle of the hug, and both players must face each other.
- The placements are in `Scripts/PresentationPairs.cs`, for Part B to use.
- There is still only one high five, so B2 will mix it with the hug, the 17 single reactions and Motion Cast's three, as the brief says.

**Not covered by any pack, blended from owned clips** (`Editor/PresentationPoseProof`, `pose-proof.txt`):
- **Hand signals behind the back** (`pose-strip-HandSignals.png`, drawn from behind). She takes the ready stance, IK puts both hands on the small of her back (16 cm behind her hips), and the humanoid finger muscles set the sign: a fist, one finger, two fingers or an open hand. The index fingertip is 7.2 cm from her wrist in a fist and 14.7 cm when pointing.
- **The drinks idle** (`pose-strip-Drink.png`). She stands with the Beachy Props water bottle in her fist; IK raises it to her mouth (12 cm from her head at the sip) and lowers it to her side (63 cm). The bottle is never more than 6 cm from her hand.
  - The pack's bottle material is made for HDRP and drew magenta here. A URP Lit material from the pack's own textures, `Assets/Materials/WaterBottle_URP.mat`, is used instead.
  - The first picture had the bottle's cap pointing away from her mouth. It now sits on her little-finger side.
- **The medal moment.** It is the chain of three states above: she bows to take the medal, looks at it in her hands, then raises it. There is no medal prop on the players, and the podium ceremonies are unchanged (B3).

**The umpire** (`pose-strip-Umpire.png`: V19 with the match switched off, three moments of each signal, drawn from the court side).
- She makes 11 signals from AA_Volleyball's referee set:
  - authorisation to serve, L and R
  - team to serve, L and R
  - ball in, L and R
  - ball out, L and R
  - ball touched
  - end of set
  - time-out
- She stays in her chair: her hips moved 0.0 cm in every signal, and a hand moves 0.51 to 0.76 m from her lap.
- **Sides:** from where she sits, Team A plays on her left and Team B on her right. "Team to serve" points to the right team's half on both sides.
- **Shown plainly:** the chair's umbrella shades her head from the court side, so her arms read well but her face does not.
- `UmpireController` has methods for each signal; B2 calls them. Its old placeholders, which only wrote log lines, are gone.

### B1: two camera looks, TV and Game (26 Nov 2026)
**What the player has.** In the match and in Settings, and remembered:
- **TV**: the roaming director.
- **Game**: six fixed views.

A played match opens on Game, behind your own baseline. A watched match opens on TV.

**The Game look's six views** (court frame: x across the net, Team A at z < 0; metres):

| Key | View | Where | Looks at | Zoom in / out |
|---|---|---|---|---|
| 1 | Behind your baseline | (0, 12, -14) | (0, 0, 3.1) | 8 / 10 m |
| 2 | Behind the far baseline | (0, 12, 14) | (0, 0, -3.1) | 8 / 10 m |
| 3 | Side-on at the net | (11, 3, -2.6), the chair's side | (0, 1.2, 0) | 4 / 3 m |
| 4 | High sideline (classic broadcast) | (16.9, 11, -4.5) | (-9.3, 0, -1.5) | 9 / 8 m |
| 5 | Overhead | (0, 24, 0), your end at the bottom | the centre | 10 / 16 m |
| 6 | Low courtside | (-6.2, 0.9, -10.5) | (0, 1.4, 1.0) | 3 / 3 m |

- **Kept from the three old cameras:**
  - view 1 is the old wide camera;
  - view 4 is the old close camera, moved 4.5 m towards your end and 2.5 m higher;
  - view 5 is the old overhead camera.
- **Moved because the proof showed something in the way:**
  - View 3 was first across from the chair, at the net. On V19 that spot is inside the grandstands, which meet there (picture).
  - View 4 at its old place looked through the umpire's chair.
- Each view is checked clear of everything, with nothing between it and the court's middle.

**The TV look's shots** (`CameraDirector`). Each moment has its own shots, one picked at random and never the one used last time for that moment:

| Moment | Shots |
|---|---|
| Serve | a slow push-in from behind the server; beside her; low off the sand |
| Rally | a follow camera that drifts and orbits, keeps the ball and all four players in frame (its field of view fits them), and swings as the ball crosses the net: from the broadcast side, end-on, or high on the chair's side |
| The kill | a quick swoop in close to where the point was won; a cut close on the scorer |
| Between points | a crane on the scorer; an orbit round the pair; the crowd; the venue |
| Match over | a slow orbit of the venue |

- Every shot keeps moving; the ones that are not orbits also turn slowly round what they look at.
- **Collision checks.** Every frame, the camera is pushed out of anything it must never be inside (`CameraKeepOut`): the players (1 m), the ball (2.2 m, or it fills the picture), the net, the posts and antennae, the umpire's chair and the umpire, the 18 courtside boards, both grandstands and the beach umbrella. The boxes are the objects' own bounds plus 35 cm.
- **Between points today:** Auto gives 2.0 s between points, so it is the kill (1.1 s), a short between-points shot (0.6 s), then the serve's shot. B2's sequence holds the serve longer.

**The proof** (`b1-court-camera.txt`, 23/23, V19 in Play mode, batch, Unity closed):
- **100 s of a watched match in the TV look:**
  - 10 points and 39 shots;
  - every moment used more than one shot (serve 3, rally 3, the kill 2, between points 4), and none followed itself;
  - the camera was inside something in 0 of 184,351 frames;
  - it moved in every one of 99 seconds.
- **Keys 1 to 6 on a virtual keyboard:** each view came up and was clear (`b1-game-views.png`). The first shot of each kind is in `b1-tv-shots.png`.
- **Zoom:** + held 1 s moved view 1 in 8.00 m (its limit), and 2x made the picture exactly twice as large.
- **V, L3 and the D-pad** switched look and stepped the views.
- **The page:** its remembered choice for a watched match (Game 5) was used, and its in-match menu switched look. Switching to Manual opened the played match's choice (Game 3). In view 3, up on the stick is across the court, as the screen shows it.
- **Getting the proof right:** the virtual keyboard only reached the game once the proof set the Input System's editor and background behaviour (as `PlayedMatchPlayProof` does) and sent the held key every frame. Its first runs reported key failures that were the proof's, not the game's.

**Still passing:**
- `RallyPlanProof` PASS (`proof/B1/RallyPlanProof.log`); its zoom-button check now runs through `CourtCamera`.
- The three played courts, at Easy, Medium and Hard (`harness/played-match.mjs --unity`, 9/9; each court 14/14). The played match's stick and the A3 proof's autopilot both read `CourtCamera.StickFrame`.

**The game's side:**
- Settings has a new Camera card. The same panel is in the court's own settings (the gear). For playing and for watching, it offers TV or Game, and for Game the six views.
- The choice is stored in `vbe-court-camera` and sent to the court when it loads and when it changes. The court's page passes it to `CourtCamera.SetCameraPrefs`, only in the form `played=game:1;watched=tv:1`.
- A change made on the court comes back as `unity-camera:played:game:3` and is stored.
- The controls list names the new keys.
- `harness/presentation.mjs` (new, suite 57c in `run-all`): 17/17, testing the real `court-settings.ts` module and the wiring. `harness/settings.mjs` 40/40.

**Files deleted or cut down:**

| File | What | Why |
|---|---|---|
| `Scripts/SimpleCameraPresets.cs` | deleted | replaced by `CourtCamera` |
| `Scripts/ArcadeCamera.cs` | deleted | never in the scene. Its one caller, a "camera shake" on spikes in `MatchManager.cs` (7 lines), found nothing and did nothing, and is removed. Auto plays the same (RallyPlanProof). |
| `Editor/CourtPlayProbe.cs` | deleted | a 1.0-era probe (R-71/73/74/76). Its camera test drove `SimpleCameraPresets`, and the rest were one-off diagnostics that no harness runs. |
| `Editor/OverheadCameraDefault.cs` | deleted | a one-off batch edit of a camera that is now switched off |

**New:** `Scripts/CourtCamera.cs`, `Scripts/CameraDirector.cs`, `Scripts/CameraKeepOut.cs`, `Scripts/MatchManager.Presentation.cs` (each point's ending and scorer, for Part B), `Editor/PresentationCameraProof.cs`.

**Changed:**
- `MatchManager.cs`: +1 line in `AwardPointTo` (it raises the point's moment); the dead shake removed.
- `MatchManager.Played.cs`: +2 lines, the same moment.
- `PlayedControls.cs`: the stick's frame.
- `CameraZoomButtons.cs`, `CeremonyDirector.cs` and `RallyPlanProof.cs`: `CourtCamera` in place of `SimpleCameraPresets`.
- `CourtsideBoards.cs`: lists its boards for the keep-out.
- V19: `CourtCamera` on `Camera_Gameplay_Close` in place of the old component.

### B2: between points (26 Nov 2026)
**What happens after every point,** in both looks and both modes. It is 3 s for a plain point and 4 s for a big one, and it can be skipped with Enter (R3 on a pad). `PointPresenter` runs it:
1. **The score graphic:** a bar low in the centre, with both teams' names, sets and points, above the commentary subtitle. A tab on it says what won the point (BLOCK, OUT, IN THE NET, FOUR HITS, SERVICE ERROR, ...). ACE and WINNER are already MatchManager's action word under the header, so the tab doesn't repeat them.
2. **The umpire** signals the team to serve (towards their side). When it ends she authorises the serve.
3. **The reactions:**
   - The winners each play one of the 17 point-won reactions, never the one she played last.
   - Now and then, the pair celebrates together instead (the high five, or the hug if they are close). Their spacing comes from the Animations section.
   - Pairs are never followed by a replay: the replay takes the players back through the rally, and the slap comes about 2.7 s in.
   - The other side plays the point-lost reactions, unless a player is down from a dive.
4. **The camera** (the director's cutaways, whichever look is on): a close-up of the scorer, head to knees, pushing in, then the other side, then the replay.
5. **A big moment gets a slow-motion replay** from another angle: low behind the losing side's baseline, the ball coming at the camera.
   - A replay is the last 1.2 s of the rally at 0.6x speed.
   - It is not video. `ReplayRecorder` keeps the four players (place, facing, animation state and time) and the ball 30 times a second for 5 s. It plays them back, then puts the court back exactly as it was.
   - The big moments: every ace and every block; a diving save (a dive by the side that went on to win, in a rally of 6 or more touches); a hard spike (17 m/s in a played match; 45 m/s in Auto, whose scripted ball flies its last attack at 30 to 60 m/s).
   - There are never two replays in a row, unless the second is an ace or a block.

**The next serve waits for it.**
- **Auto:** the players stay where they are for the reactions and the replay (`HeldForPresentation`). After the presentation they walk all the way onto their spots before the serve may go (`AfterPresentation`), as the old 2 s pause gave them. Without that, RallyPlanProof caught servers serving from 0.45 m behind the line.
- **A played match:** the engine does not step while the point is presented, and the match ends only after the last point's presentation.

**The proof** (`b2-between-points.txt`, 13/13, V19 in Play mode, batch, Unity closed):
- **150 s of a watched match:**
  - 16 points, every one presented: 6 plain ones in 3.0 s each, 9 big ones in 4.0 s each;
  - the replays covered 2 blocks, 2 aces, 4 diving saves and 1 hard spike;
  - the score graphic matched the match 16/16;
  - all four players reacted at every point;
  - no serve was struck during a presentation;
  - all 9 replays put the court back exactly (under 1 mm);
  - both high fives met, at 3 cm;
  - the camera was inside something in 0 of 86,536 frames.
- **Enter** (virtual keyboard) skipped a presentation 0.01 s after the press.
- **A played match:** in 3 played points the engine's clock did not move while each was presented.
- **Pictures:** `b2-close-up.png`, `b2-other-side.png` and `b2-replay.png`, each with the graphics on it.

**What the proof and the pictures caught, and what was done:**
- **The rally's animation triggers were still pending**, so the controller's Any State transitions took players straight out of a reaction into a set or a spike. Every reaction now clears them first.
- **Nothing is drawn in batch mode**, so the players' bones were never updated, and the hands seemed not to meet. The proof makes the four always animate. The game draws them, so it doesn't need this.
- **Diving saves were found on 8 points of 16** in Auto, where dives are common. They now count only for the winning side, in rallies of 6 or more, and never as a second replay in a row.
- **The replay camera behind a baseline stood inside a tent**, and the picture was grey. The keep-out now holds every solid prop round the court: 588 more boxes for tents, huts, racks, flags, palms and people. The net's own strands are left out, as the net box covers them.
- **The keep-out's push** moved the camera from one grandstand into the other where they meet at the net. Whatever still holds the camera after the push now lifts it over its top. The ball is pushed first and checked last; near the ball is a poor picture, not a collision.
- **With the new prop boxes**, B1's view 6 (low courtside) had a sign between it and the court. It moved along the sideline to (-6.3, 0.9, -5). B1's proof was run again: 23/23.
- **The score bar** first sat on the commentary subtitle, and its tab repeated WINNER. It is now above the subtitle, and the tab shows only what the header's word doesn't.

**Still passing:**
- `RallyPlanProof` PASS (`proof/B2/RallyPlanProof.log`): 29 serves, every server exactly 0.75 m behind her line.
- The three played courts, 9/9 (`proof/B2/harness-played-match-unity.txt`).
- `harness/presentation.mjs`, 23/23.

**Files:**
- **New:** `Scripts/PointPresenter.cs`, `Scripts/ReplayRecorder.cs`, `Scripts/PresentationGraphics.cs` (it also holds B3's lower third and banner), `Editor/PresentationPointProof.cs`.
- **Changed:**
  - `MatchManager.cs`: +2 lines, the hold and the wait.
  - `MatchManager.Presentation.cs`: `HeldForPresentation`, `AfterPresentation`.
  - `MatchManager.Played.cs`: +1 line, the end waits for the presentation.
  - `PlayedMatchRunner.cs`: the engine waits; the cheer button plays a point-won reaction.
  - `CameraKeepOut.cs`, `CameraDirector.cs`, `CourtCamera.cs`: as above.
- **Cut down:** `PlayerAnimationHelper.cs` lost its point-won and point-lost reactions (56 lines), which fired as the point was scored. `PointPresenter` has them now.

### B3: match moments (26 Nov 2026)
**What the player sees** (`MatchMoments`), in both looks and both modes:

**The walk-on, before the first serve (about 11 s).**
- The four start off the court, beside the net on the umpire's side, and walk to their places. The camera watches from across the court, off the net line.
- Then each in turn gets a close-up, waving or bowing, with a lower third: her name, then her nation and her team ("CAROLINA RIBEIRO / BRAZIL · BLUE SHARKS").
- The first serve waits for it from the very first frame, because the match could otherwise serve on the frame its data arrives. Then it waits until everyone is on her spot (`SettleAfterWalkOn`), as after a point.
- A match resumed with points already on the board has no walk-on.

**Set point and match point.** After each point, if the next point can end the set or the match, a banner says so and whose it is ("SET POINT · RED GIANTS", "MATCH POINT · BLUE SHARKS"). It shows for 2.6 s, below the action word under the header. The rule is the score's own (`PointModel.IsSetWon`).

**The winners' celebration, after the last point is presented (5 s).**
- The winners walk to the net together, applauding the crowd: Motion Cast's "passes under the net applauding", as it was made to be used. The losers play the point-lost reactions.
- A banner says "BLUE SHARKS WIN", and the camera watches from the far sideline.
- Only then the existing result box, which waits for it (`MatchResultBanner`).
- The ball is hidden during the walk-on and the celebration (it isn't in play). In the first picture it sat by a winner's head and filled the shot.
- The podium ceremonies (`CeremonyDirector`) are not touched.

Enter (R3) skips the walk-on or the celebration. B5's "skip to next serve" leaves both out.

**Nations.**
- `/unity/match-state` now sends each player's nation (`nationality`), for career players and pool players alike. A Nations Cup's players are sent her nation.
- The court keeps it as `PlayerStats.country`.
- Against the real server: Camila Santiago (Puerto Rico), Nurul Ain (Malaysia), Valentina Bianchi (Italy), Mariana Torres (Colombia) (`harness/played-match.mjs`, its new check).

**The proof** (`b3-match-moments.txt`, 8/8: a whole watched match on V19 in Play mode, batch, Unity closed; the walk-on at 1x, the match at 4x):
- **The walk-on:**
  - the four started 6.0 m out from the court's middle (the sidelines are at 4 m);
  - when the walk ended, the furthest still had 0.05 m to go;
  - four lower thirds, each with her name, nation and team;
  - no serve during it, and it took 10.7 s.
- **The banners:** 61 points read; the banner showed at exactly the 5 set and match points and at no other point.
- **The end:** both winners applauding under "RED GIANTS WIN"; the result box only after the 5.0 s celebration.
- **Pictures:** `b3-walk-on.png`, `b3-lower-third.png`, `b3-set-point.png`, `b3-celebration.png`.
- **What the pictures caught:**
  - The players walked on in the ready crouch, because the court dressing them from the career resets their Animators. The walk-on now keeps the walk playing.
  - The first walk-on camera sat on the net line with the post in the middle.
  - The banner first cut its text short ("SET POINT · BLUE…"), then sat on the WINNER word. It is now 900 wide, sizes its text to fit, and sits lower.
  - The score bar's "10" crowded the dash, so the cells are wider.

**Still passing, with B2 and B3 in place:**
- `harness/played-match.mjs --unity-full` 13/13 (`proof/B3/harness-unity-full.txt`, with the court's proof and Unity log beside it). It is a whole played match against the real server: 2-0 (11-5, 11-3), recorded exactly, prize and fitness charged. In it the walk-on took 10.7 s and all 30 points were presented. This also proves B2's rule that a played match ends after its last point's presentation.
  - An earlier try at this run, during B2, is void: it compiled while B3's files were being copied in (my mistake), so it was deleted.
- `RallyPlanProof` PASS (`proof/B3/RallyPlanProof.log`): 39 serves, all exactly placed after the walk-on and between points.

**Files:**
- **New:** `Scripts/MatchMoments.cs`, `Editor/PresentationMomentsProof.cs`.
- **Changed:**
  - `MatchManager.Presentation.cs`: the walk-on in the hold, `MatchDataReady`, `SettleAfterWalkOn`.
  - `MatchResultBanner.cs`: +1 line, it waits for the celebration.
  - `UnityMatchDataLoader.cs`: the nation, kept as country.
  - `PresentationGraphics.cs`: the banner and the score cells.
- **The game repo:**
  - `api-server/src/routes/unity.ts`: `nationality` in all three player shapes.
  - `harness/played-match.mjs`: its nation check.
  - `harness/presentation.mjs`: the B3 section.

### B4: crowd and commentary (26 Nov 2026)
**The crowd.**
- **Builds through a long rally:** this was already in `AudioManager`. The excited bed starts at 4 touches and is full at 14, the same in both kinds of match.
- **Erupts on aces and blocks (new):** a big roar and a cheer on top of the point's own reaction, and both beds up to their loudest for 1.6 s.
- **Dips when Kailey or Hukum speak:** unchanged (`SetDucked`).

**The commentary says what really happened.**
- **The point's line used to be the same for every point**, so "Point won! The crowd loves it!" was said for a service error too. It is now chosen a frame after the point from how it ended and from the score, in this order:
  1. match won
  2. a comeback (a pair 3 or more behind in this set draws level or leads; once a set each)
  3. ace
  4. block
  5. match point next
  6. set point next
  7. an error
  8. otherwise a point
- **The walk-on** asks for its line too.
- **The existing voices and lines are reused:** the 48 clips (A = Kailey, B = Hukum) still play for serve, dig, set, spike, block attempt, block, point and rally, as before.
- **Seven new kinds** need lines that don't exist: ace, error, comeback, set point, match point, walk-on and match won.
  - Per the brief, **no audio was made**. The 42 lines are written in `docs/update-1.2/COMMENTARY-NEW-LINES.md` for Rob to record in ElevenLabs, with the file names, the voices and the settings `LINES.txt` uses.
  - The court already loads them by name, so a recorded file plays with no code change.
  - Until then, a point that ended one of these ways says a point line, as every point did before; the walk-on says nothing, and no silent caption appears.

**The proof** (`b4-crowd-and-commentary.txt`, 8/8: V19 in Play mode, batch, with the game's own 48 clips; 210 s of a watched match, then 120 s of a played one):
- **Each point's line:** 29 of 29 matched what happened, worked out separately by the proof in the same order (14 point, 11 ace, 2 error, 1 block, 1 set point).
- **The new kinds:** none was spoken. Each fell back to a point line (11 aces, 1 set point), and the walk-on said nothing (no speech in all of it).
- **The crowd:** 12 eruptions for the 12 aces and blocks. 0.5 s after an ace or a block its excited bed was at 0.80, against 0.50 after other points. Through a watched rally it rose from 0.00 (0-3 touches) to 0.43 (9+ touches).
- **A played rally:** in all 28,664 frames the crowd read it as live and counted the engine's own touches.
  - The build-up's level could not be seen in the played part: the person sits still in this proof, so no played rally ran past 4 touches, where it starts.
  - It is one formula for both kinds of match, shown above in the watched one.
- **The existing commentary proof** (item 21, `u21_commentary.txt`) still passes: 48 of 48 clips; 26 lines, the two voices never out of turn; none starting before the last ended; the crowd ducked in every mid-line frame.

**Files:**
- **Changed:**
  - `CommentaryLines.cs`: 7 kinds and their 42 lines.
  - `CommentaryManager.cs`: the point resolved from what happened, the fallbacks, lines tracked for any number of kinds.
  - `AudioManager.cs`: the eruption.
  - `MatchMoments.cs`: the walk-on's line.
- **New:** `Editor/PresentationSoundProof.cs`; `docs/update-1.2/COMMENTARY-NEW-LINES.md`.

### B5: skip and settings (26 Nov 2026)
**In Settings and in the match** (the court's own settings, the gear above the court), remembered on this PC (`vbe-court-skips`), there is a new "Match presentation" card with two switches, both off by default:
- **Skip to next serve:** after a point the score shows for a moment (0.7 s), then straight on to the next serve. There are no close-ups and no replay, no walk-on before the match and no celebration after it.
- **Skip replays:** the reactions and close-ups stay, without the slow-motion replays. A big moment then has the plain point's 3 s.

**On the court:**
- Enter (R3 on a pad) skips whatever is playing between points: the close-ups, the replay, the walk-on, the celebration (B2, B3).
- The controls panel lists it.

**How it reaches the court:**
- The page sends both switches when the court loads and whenever they change, in the form `serve=1;replays=0`.
- The court's page passes that, and only that, to `PointPresenter.SetSkips`.

**The proof** (`b5-skip.txt`, 4/4: a whole watched match on V19 at 4x, batch, Unity closed; the switches sent as the page sends them, by the object's name):
- **"Skip to next serve" from the start:** no walk-on. 8 points of 0.7 to 0.8 s each, and the camera never cut away.
- **"Skip replays":** 10 points of 3.0 s each, with close-ups and no replays; 5 big moments went without one.
- **"Skip to next serve" again to the end:** no celebration, and the result box was up 0.0 s after the match ended.

**The game's side:** `harness/presentation.mjs` (suite 57c), 43/43 for all of Part B. It loads the real `court-settings.ts` for both the camera choice and the skips, checks the wiring in the Settings page, the court page and the court's own page, the Unity source, and each court proof's result. For B4 it also checks that the 42 written lines are exactly the lines in the code and that none is recorded yet.

**Files:**
- **Game:**
  - `lib/court-settings.ts`: the skips; the controls list.
  - `components/skip-settings.tsx`: new.
  - `pages/settings.tsx` and `pages/court.tsx`: the card, and sending it.
  - `public/unity-build/index.html`: `vbe-skips`.
- **Unity:**
  - `PointPresenter.cs`: `SetSkips`; with replays off, a big moment has the plain timings.
  - `Editor/PresentationSkipProof.cs`: new.

**Part B, the last regression on the finished code** (after B5; batch, Unity closed):
- **`RallyPlanProof`:** PASS (`proof/B5/RallyPlanProof.log`). 34 serves, every server exactly placed; the zoom buttons; the result box; Auto's odds.
- **B2's proof again:** 13/13 (`proof/B2/b2-between-points.txt`, rewritten). 18 points presented; 9 replays, all put back exactly.
- **`harness/played-match.mjs --unity-full`:** 13/13 (`proof/B5/harness-unity-full.txt`, with the court's proof and log). The engine's checks 54/54; the four careers' difficulties and their players' nations. A whole played match against the server, 2-0 (11-8, 11-4), recorded exactly, with prize and fitness charged.
- **`harness/presentation.mjs`:** 43/43.

Part B is done (B1 to B5). Part D is not started, as instructed. The next steps are Rob's: playing the presentation and the win rates with a pad, and recording the 42 commentary lines.

## Demo build (27 Nov 2026)

Rob's brief: a demo of update 1.2 to show a friend this weekend. It covers Part A, the animations and Part B as they stand. Every Part D step of Part C is skipped (venues, time of day, the exhibition match), Part D is not started, and no win rates were tuned. Steam, the live save and `main` were not touched. Unity was closed for every batch run. Rob's checklist is `docs/update-1.2/DEMO-CHECKLIST.md`.

**The demo:** `C:\build\vbe-1.2-demo-2026-11-27\`
- `Beach Volleyball Empire 1.2 Demo Setup 1.2.0-demo1.exe` (450,517,108 bytes; not code-signed, so Windows asks "More info → Run anyway").
- `win-unpacked\` (656 MB).

It is packaged from game commit `7f7ba5c1`'s code (Unity `8bbf267`). It is installed on this PC, and its save folder is empty, so its next start is a first run. The test's copies of the live save are at `C:\build\vbe-1.2-demo-2026-11-27-test-saves\`, outside the folder Rob would copy.

| Step | State | Proof | Commit |
|---|---|---|---|
| 1. `APP_UI_EDITOR_ONLY` reverted before the WebGL build | Done (decision 36: it comes back in Play mode, so it was reverted again before the second export) | `git status` clean in `ProjectSettings` for both builds | Unity: not committed (the line is out) |
| 2. One WebGL build with `WebBuild.cs`, copied in as before | Done, twice (the first export stopped at the walk-on in the browser: run 1 below) | `proof/demo/webbuild-summary.txt`, `webbuild-summary-2.txt` | export 1 `fd7301a0`; export 2 (Unity `8bbf267`) `7f7ba5c1` |
| 3. Headless render proof: a full Auto match and a full played match, both looks | Done, PASS: Auto 18/18, played 17/17 | `proof/demo/auto-match/`, `proof/demo/played-match/` (summary.json, console.log, pictures) | `8e7f8996` |
| 4. Frame rate, TV look on | Done | `auto-match/summary.json` (fps), `install/summary.json` (fps) | `8e7f8996` |
| 5. Package | Done | `C:\build\vbe-1.2-demo-2026-11-27\` | code `7f7ba5c1` |
| 6. Install; a copy of the live save; a played match paid out; the real save unchanged | Done, PASS 26/26 | `proof/demo/install/` | `8e7f8996` |
| 7. Full harness | Done, two full runs (of the three allowed): run 1 138/140, run 2 139/140; every failure fixed or passed alone | `proof/demo/harness-run1.log`, `harness-run2.log`, `harness-run2-staff-injuries-alone.txt` | run 1 on `8e7f8996`, run 2 on `6f5d2a65` |

**Step 2, the export.** It was copied in as the 1.1.3 export was (`4c656682`):
- **The files:** the four build files under the deployed names `Volleyball_WebGL_Uncompressed_2.*`, byte-identical (checked with `cmp`). The repo's own `unity-build/index.html` was kept, and `.data` and `.wasm` go through LFS.
- **Texture cap:** 2048 (`WebBuild.Step7`).
- **Brotli:** regenerated by `scripts/compress-unity-data.cjs`.
- **Size:** `.data` is 276,887,540 bytes, against 260,920,681 for the last export before 1.2 (1.1.3, `4c656682`): **+15,966,859 bytes, +6.1%**.
  - The build report lists 8,096 packed assets (471.9 MiB), against the 20 Oct export's 7,896 (451.5 MiB). It was not broken down further.
- **Other files:** `.wasm` is 52,255,963 bytes, against 51,719,498.
- **What ships:** the Brotli files, `.data.br` 224,161,079 bytes and `.wasm.br` 9,131,471.

**Step 3, the render proof.** `scripts/webgl-proof/demo-1.2-proof.mjs` runs headless Chrome on the real GPU, against the built game on a copy of the starter database:
- **Setup:** a new career, drafted and advanced to its first match day, then CONTINUE and Watch Match as a player does.
- **Pictures:** each is taken from the court's own log lines, at the serve, mid-rally, between points (the scorer's close-up) and in a replay, in both looks. The celebration and the result box are taken at the end.
- **Auto** (`auto-match/`, 1920×1080):
  - It opens on TV (the watched default); V switches it to Game.
  - The match went to its end: Sydney Riptide 2-1 Berlin Sand Queens (14-12, 10-12, 13-11), recorded. No played-match code ran, and there were no page errors.
- **Played** (`played-match/`, 1280×720):
  - It opens on Game (the played default); V switches it to TV.
  - A keyboard bot presses J, K and L in turn every 120 ms. It never moves or aims, so it plays like a beginner who only presses buttons.
  - Its presses reached the new engine: its side made 12 touches (9 Good or Perfect, 3 Late) and 139 whiffed presses.
  - It lost 0-2 (0-11, 0-11), recorded, with no page errors. The pictures include REPLAY and ACE.
- **Not tested here:** a real pad (checklist item 1), and the whole match at 1x with a person playing.

**Step 4, the frame rate**, the TV look's roaming camera on, measured as every frame the court's page draws (requestAnimationFrame, which Unity draws on), for 60 s mid-match:

| Where | Size | fps | Median frame | 95th percentile | Worst | Frames over 33 ms | Over 50 ms |
|---|---|---|---|---|---|---|---|
| Installed demo (Electron), this PC | 1280×720 | **58.6** | 16.7 ms | 16.8 ms | 50.0 ms | 18 of 3,516 | 0 |
| Headless Chrome, real GPU | 1920×1080 | **55.6** | 16.7 ms | 33.3 ms | 33.6 ms | 82 of 3,337 | 0 |

Both are capped at the 60 Hz display rate. This is Rob's PC; a weaker PC will be slower.

**Steps 5 and 6, the package and the install test** (`scripts/webgl-proof/demo-install-proof.mjs`, `proof/demo/install/`, 26/26). The demo is kept apart from the real game (decision 33). The test:
- **Fingerprinted, before and after:** every file in the real save folder (993 files, 1.07 GB), the older "Volleyball Empire" (385) and "workspace" (372) folders, the Steam install (2,193 files), and the Uninstall entries. It takes SHA-1 of each file's bytes; SQLite opens none of them.
- **Installed silently:** the demo went to `AppData\Local\Programs\Beach Volleyball Empire 1.2 Demo`. Its own Uninstall entry is "Beach Volleyball Empire 1.2 Demo", and every other entry is as it was.
- **First run:**
  - The title screen shows "Beach Volleyball Empire 1.2 Demo · version 1.2.0-demo1", with no managers (the starter database).
  - The save is in its own folder, on port 4174, with Steam off and no save brought forward.
  - Exit game quit the app and its server.
- **A copy of the live save in the demo's own folder:** Rob's profile, Manual remembered, Next match, Watch Match.
  - The bot played the World Tour R23 match to its end: 0-2 against Miami Shoreline Queens.
  - Continue went back to the dashboard, and Recent Results shows the match as a LOSS.
  - **It paid out:** the runner-up prize ($2,667) is on the ledger. The balance moved by exactly the new ledger rows (218,110 → 215,030: the prize, a week's sponsors, salaries and running costs from the days Next match passed).
- **After:** every fingerprinted file is byte for byte unchanged, including the live save's own SHA-1 (`d9965b78…`), and the Uninstall entries are unchanged.

**Step 7, the full harness** (`pnpm run build`: typecheck, every workspace build, sync, then `harness/run-all.mjs`'s 140 suites). Two full runs, about 2 h 45 min each:
- **Run 1, on `8e7f8996`: 138 of 140 suites passed** (`proof/demo/harness-run1.log`). Both failures were checks that read the source and were out of date:
  - **`commentary-she`:** it wanted exactly 48 lines in the Unity commentary table. B4 (26 Nov) added the 42 lines not yet recorded, so the table holds 90. B4 caused this; Part B had run only its own suites. The check now wants the 48 shipped lines word for word, the 42 more, and none saying "he".
  - **`settings`:** it wanted `vbeApp` to expose only `quit`. The demo added `name` and `version`, two strings for the title screen. The check now allows exactly those and checks that main.js passes them.
  - **Both passed alone** (7/7, 40/40) and were committed as `6f5d2a65` (test files only; the game's code is as packaged).
- **Run 2, on `6f5d2a65`: 139 of 140 passed** (`proof/demo/harness-run2.log`); both of run 1's suites passed.
  - **The one failure:** `staff-injuries`, a rate measured over six seasons of chance. Staff were off 1.02 per 1,000 staff-days against players' 3.41, a ratio of 0.299 against the band's floor of 0.30. It passed in run 1.
  - **Run alone on the same commit:** 20/20 (ratio 0.55; `proof/demo/harness-run2-staff-injuries-alone.txt`). Nothing the demo changed touches staff absences; the game's only server change is the 404 in `app.ts`.
  - **So:** that is chance, not a fault, and I did not spend the third full run on it.

**Runs that failed, kept on file** (three-run rule: each step stayed within three runs; the full harness took two):
1. **Render proof run 1 (`proof/demo/run1-court-stopped/`): the court stopped at the walk-on of the first match.** The cause and both fixes are decisions 34 and 35: missing commentary clips came back as HTML, and the decode error reached Unity's loader as an alert. Unity `8bbf267`, game `7f7ba5c1`, export 2. B4's sound proof was rerun on the fix: PASS 8/8, with 48 of 90 clips loaded, the 48 `LINES.txt` lists (`proof/B4/b4-crowd-and-commentary.txt`, `proof/demo/b4-rerun-unity.log`).
   - On the way, two batch runs of that proof broke mid-match on a recompile. That was the define coming back (decision 36), not the game.
2. **Render proof run 2 (`proof/demo/run2-auto-stale-pictures/`): the match passed, but two TV pictures were late.** The 60 s frame-rate measurement held the picture loop up, so the "between" and "replay" pictures were taken off their moments. That was a proof-script fault. The script now drops a picture more than 1 s late and measures after the TV pictures are taken. Run 3 is the one on file.
3. **Install run 1 (`proof/demo/install-run1-check-wrong/`): 25/26.** The payout check expected the balance to rise by the prize, but Next match also passed days of wages and costs. The ledger showed the prize was paid. That was a proof-script fault: the check now compares the balance with the new ledger rows. The demo was uninstalled and run 2 passed 26/26.

What these have in common: nothing in the game's code failed twice. The real fault (the court stopping) appeared only in a browser against the game's server, which no batch proof in the editor could show. That is why Part C's browser run matters.

**Found, not fixed (for Rob's pass):**
- At 1280×720 the Manual controls help covers the left end of the score bar until H hides it.
- A scorer's close-up is sometimes shot through the net.
- A keyboard bot that never moves lost 0-22 in points: a played match is hard on a beginner. Rob's pad test decides that.

**Files:**
- **Game repo:**
  - **New:** `electron/edition.js`, `electron-builder.demo.cjs`, `scripts/webgl-proof/demo-1.2-proof.mjs`, `scripts/webgl-proof/demo-install-proof.mjs` and `docs/update-1.2/DEMO-CHECKLIST.md`.
  - **Changed:** `electron/main.js` (the edition's name, port, Steam and saves), `electron/preload.js` (`vbeApp.name`, `vbeApp.version`), `pages/profile-picker.tsx` (the version line) and `api-server/src/app.ts` (the 404).
- **Unity:** `CommentaryManager.cs` (`LINES.txt`).
- **Nothing deleted.**

## Part D and Rob's additions of 27 Nov (`PART-D-ADDITIONS-2026-11-27.md`)

Rob's instruction (28 Nov): section 0, then section 1 (the ball, then the crowd, and the demo rebuild), then Part D in order D1 to D6, applying the additions' sections 2, 3, 4 and 6 along the way. Not built: section 5's commentary team (not confirmed), any change to the crowd stands beyond pictures (6f), and anything in section 7. The win rates, the live save, Steam and `main` are untouched; full harness runs are capped at 3.

### Section 0: the editor freeze and the packs (28 Nov 2026)

**Why the editor froze** (`proof/section0/why-it-froze.txt`). The Stadium Crowd Generator's `GrandstandCreator` rebuilt its whole stand from `OnValidate`. It queued the rebuild on `EditorApplication.delayCall` whenever `GUI.changed` was set, and `GUI.changed` is a global that stays set after a button click.
- **The trigger:** importing a package loads the grandstand prefab asset (`SkinnedMesh Grandstand.prefab`) while the Import button has left `GUI.changed` set. So the asset queued a rebuild of itself.
- **Why it never ended:** the rebuild's clear is `while (childCount > 0) DestroyImmediate(child)`, and Unity never destroys an asset's child ("Destroying assets is not permitted to avoid data loss").
- **Reproduced** in batch on the prefab asset: 1,773,018 refusals in 92 s, memory up about 30 MB a second, the log up 17 MB a second. At that rate 20 GB is about ten minutes; Rob's editor reached 20 GB in 28 minutes.
- **Not the cause:** the same trigger on a stand in V19 (a prefab instance) rebuilt once, in 0.0 s, both in batch and in the real editor. The log of Rob's frozen session no longer exists: he opened the coffee game twice afterwards, and each run overwrote the editor log.

**The fix** (Unity, in the pack's own script):
- `OnValidate` is gone, so a stand is rebuilt only when asked: the inspector's new "Rebuild grandstand" button, or the component's menu.
- A rebuild is refused in Play mode, on a prefab asset and on a prefab instance.
- The clear stops if a child cannot be removed.
- The crowd itself is unchanged: the two stands in V19 are as they were.

**Proof in the real editor, not batch mode** (`proof/section0/editor-open.txt`, 9/9):
- **Opening V19:** it settles 26.0 s after the editor starts, holding 4.1 GB (working set; 5.4 GB committed).
- **A forced recompile** of the script: settled again in 14.3 s, both stands with every child (262 each).
- **The real trigger,** a package import (Rob's `fun hat`) with the stands loaded: settled in 10.4 s. The stands and the prefab asset kept every child, and the working set peaked at 3.8 GB.
- **The refusals:** a rebuild is refused on the prefab asset and on a stand in the scene. The old clear, capped at 20 goes on the asset, removed nothing, so it could never have ended.
- **Where a rebuild is allowed:** an unpacked copy in a throwaway scene rebuilt in 0.0 s.

**The project after the forced close.**
- **Git:** `git status` showed only `Citizens PRO` and `Hats Collection` new, plus the uncommitted `APP_UI_EDITOR_ONLY` line (decision 36).
- **Nothing half-imported:** every one of Citizens Pro's 1,123 paths and Hats Collection's 124 was on disk. A batch start then imported nothing more (21 s).

**The packs.** All of Rob's 27 Nov downloads are in the Asset Store cache and complete (`gzip -t` on each, `proof/section0/download-check.txt`). Each was imported in batch, one at a time (`imports.txt`), with no compile errors or exceptions. Their built-in Standard materials were converted to URP Lit with URP's own upgrader, in these folders only (`urp-convert.txt`). A contact sheet of each pack drawn in URP is in `proof/section0/sheets/`, and the full inventory in `packs.txt`.

| Pack (folder in `Assets`) | Made in Unity | Draws in URP | Use |
|---|---|---|---|
| Citizens Pro 2024 (`Citizens PRO`) | 6000.0.40f1 | after conversion, 175/175 | people: bystanders, front rows, musicians (5,100 to 6,000 triangles each, 110 clips) |
| Hats Collection | 6000.0.56f1 | after conversion, 27/27 | the store (D4) |
| fun hat (`Assets Storms`) | **6000.4.4f1, newer than this project's 6000.3.16f1**; imported and compiled without a fault | yes | the store |
| Santa Hat Pack +100 (`Santa_hat_Pack+100`) | 2021.3.11f1 | after conversion, 96/96 | the store |
| Cowboy Hat_1 (`Cowboy_Hat`) | 2021.3.28f1 | yes (URP Lit and Complex Lit) | the store; its 2048 textures are 49 to 65 MB TGAs (capped at import) |
| Musical Motions (`UrsaAssets`) | 2021.3.45f1 | yes | the band (6e) |
| Female Lounge Singer | 2020.3.38f1 | after conversion, 8/8 | the band's singer (6e) |
| Musical Instruments Pack (NOT_Lonely, `MusicalInstrumentsPack`) | **5.0.1f1 (2015)** | after conversion, 30/30 | the band: guitars, bass, drum kit, microphone and stand, guitar stack, monitors |
| Modular Stage (`LoafbrrAssets`) | 2022.3.54f1 | yes (Shader Graph) | the band's stage (6e) |
| Arena Stage Venue (`OlegWER`) | 2022.3.62f3 | after conversion, 51/51 | stage trusses and lighting (6e) |
| Food Pack Mixed | 2017.3.0f3 | after conversion, 97/98 (one demo plane) | the food stand (6c) |
| Turnstile Fare Gate (`NY_Subway`) | 6000.3.2f1 | **no: its 15 materials are HDRP** (their shaders are missing in URP) | not used yet; converting HDRP by hand is only worth it if it is used |

**Missing for Rob:** the second pack whose name starts "Musical Instrument" is not in the Asset Store cache, only NOT_Lonely's Musical Instruments Pack is. Pavilion, Beach - resort and Mia Lock are also in the cache (downloaded on 27 Nov through the coffee game); they are dealt with where section 2 and fix 1b need them.

**The coffee game cleaned.** `C:\Users\rbonn\Game_Dev\CoffeeGame` is not a git repository, so `git status` could not tell what was new.
- **What I removed:** the 15 folders in its `Assets` that were made on 27 Nov between 9:11 and 9:36 pm, with their `.meta` files. Each is exactly the root folder of one of that day's packages (read from each `.unitypackage`): `Hats Collection`, `Santa_hat_Pack+100`, `NY_Subway`, `Food Pack Mixed`, `LoafbrrAssets`, `OlegWER`, `Assets Storms`, `Cowboy_Hat`, `Mia Bikini`, `Beach - resort`, `UrsaAssets`, `Female_Lounge_Singer`, `IGBlocks`, `Citizens PRO` and `MusicalInstrumentsPack`.
- **Nothing older was touched:** its own folders all date from 23 Oct to 23 Nov.
- **Moved, not deleted:** the permission check refused deleting them, so they were moved, unchanged, to `C:\Users\rbonn\Game_Dev\CoffeeGame-removed-2026-11-27\Assets\`. Delete that folder when you're happy; the packs are all in the Asset Store cache.
- **One thing to know:** the coffee game's Library still holds their imported copies until Unity next opens the project.

**Commits:** Unity `10a2d06`.

### Fix 1a: the ball's size (28 Nov 2026)

**Measured** (`proof/1a/ball-size-before.txt`):
- **Before:** V19's visible ball (`Volleyball`, a Tripo mesh 0.976 m across) was at scale 0.5, so it was drawn **49.0 cm across, 2.33 times a real beach volleyball** (21 cm).
- **The engine was already right:** `Court.BallRadius` is 0.105 m, a 21 cm ball. Only the drawing was wrong.

**Set** (`ball-size-set.txt`): the ball's scale is now 0.2145, so it is drawn at 21.0 cm, the same as the engine. Nothing in the match's code reads the drawn size. The played engine places the ball by its centre, and Auto's scripted rally places it by position. The scene change is the ball's scale, three lines.

**Pictures** (`proof/1a/`, V19 in Play mode, a watched match): at the serve, the server holding the ball at her head (the ball 0.09 to 0.12 m from her head), and mid-rally. Each is taken in the TV look and in Game views 1 (behind your baseline) and 6 (low courtside), with a 2× crop round the ball beside each: `1a-tv-serve.png` and `1a-tv-serve-close.png`, and so on. The ball is now about the size of her head, as a real one is.
- The first set of pictures measured the ball by its world bounds, which grow up to √3 times as it spins (up to 33.7 cm). The proof now measures it from its mesh: 21.0 cm in every picture.
- **Seen in passing, not changed:** in Auto, before each serve, the ball floats beside the server's head instead of sitting in her hand. It was like that before 1.2.

**Reruns:**
- **A1:** Unity 23/23 (`a1-ball-flight.txt`) and dotnet 18/18 (`a1-dotnet.txt`).
- **`harness/played-match.mjs --unity-full`:** 13/13 (`harness-unity-full.txt`). The court played the whole match, 2-0 (11-6, 11-4), and the game recorded exactly that.
  - Its first run is kept as `harness-unity-full-run1-relative-path.txt`, 11/13. I passed a relative proof folder, so Unity, which runs from its own project folder, wrote its result file there. The match itself was right (court 28/28, 2-0, 11-6, 11-3, recorded exactly). The stray folder was removed from the Unity project.

**Commits:** Unity `c88ebc7`.

### Fix 1b: the crowd and the people round the venue (28 Nov 2026)

Rob: "they look shit against our players." He wants them to move, and not all dressed alike. The steps went in his order.

**Step 1, what it was** (`proof/1b/crowd-audit.txt`):
- **The stands:** 204 spectators from the Stadium Crowd Generator (102 in each of two stands), about 1,100 triangles each.
  - All in white shirts and navy trousers, from column 0 of the pack's colour grid.
  - None with any animation: they never moved. In half a second, 0.6% of a close shot changed.
- **Round the venue:** 24 low-poly people of 570 to 2,550 triangles each (PolyPeople Swimwear, CityPeople), as close as 9.7 m to the court.
- **In all:** 258,000 triangles in 228 skinned people.
- **Frame rate:** demo 1, with this crowd, measured 55.6 fps (TV look, 1920×1080, headless Chrome on this PC). The crowd's own share of that was not measured apart.

**Step 2, the free fixes, with the crowd pack Rob already owned** (Unity `2170942`). Both stands were rebuilt by the pack's own generator with its vertex-animated (VAT) spectators. A crowd script gave them:
- **Clothes:** per-person palettes in the grid's layout, so shirts, trousers and shoes vary; 35% of each half wore the kit colour of the team on that half.
- **Timing:** each person had their own offset and speed.
- **Reactions:** the pack's moods after each point.
- **Results** (`1b-before-*.png`, `1b-after-*.png` in the TV look, the Game look and the replay angle; real match data through `harness/unity-on-server.mjs`):
  - 14 shirt colours, 193 different timings, 66 team fans (Sydney navy, Paris orange).
  - 11.9% of the close shot changed in half a second.
  - The stands reacted to points (34 cheering, 82 clapping, 32 disappointed).
- **Stand styles** (`stand-styles.png`): six styles the pack's generator builds (court, steel I-beams, wooden bleachers, concrete steps, with and without railings). This answers 6f with pictures only; the stands themselves were not changed.
- **Said plainly: after step 2 they still looked low-poly** beside the players: faceless mannequins. Step 2 was superseded by step 4 below, and its code was removed.

**Step 3, the realistic people already owned** (`people-packs.txt`):
- **IdaFaber's Beach Girls:** 84,000 to 108,000 triangles each, and the players' own model.
- **Abandoned World's Base Humans:** 30,000 and 41,000.
- **Mia Lock:** 53,000 plus 155,000 for the hair. Imported from Rob's cache for this audit; 39 of 45 materials converted to URP.
- **The verdict:** none is light enough for a crowd; one or two could stand near the court at most.
- **Not on this PC at all:** Swimwear Girl 3 and Serah Fei are in neither `Assets` nor the Asset Store cache.

**Step 4, the people pack: Citizens Pro** (bought 27 Nov; Unity `e35f0b8`, `75e32ce`, `28e76177`).
- **It converts to Humanoid** (`citizens-humanoid.txt`, `citizens-retarget.png`):
  - 117 adult models, each with its own valid avatar; 76 adult clips, each with an avatar from its own skeleton.
  - The first try copied a model's avatar to the clips and crumpled every pose. The clips' skeleton isn't the models'.
  - Its own seated, cheering, clapping and talking clips pose properly on its people, and so do Musical Motions' guitar, bass, drums, keyboard, sax, trumpet and violin and the Lounge Singer's singing (needed for 6e).
- **Where the cameras come close** (`camera-reach.txt`, a watched match through the TV look and all six Game views): **every row comes within 6.1 to 7.6 m** of the camera, a seated fan filling 20 to 32% of the picture's height.
  - So by Rob's rule nearly every seat wants a real person. With WebGL's CPU skinning, 204 real people would cost the frame rate, so the number of real rows is one setting (`Crowd.realRows`).
  - It is set to the front row: the row the low courtside and replay cameras see face to face.
- **What is in V19 now** (`Crowd.cs`, `CrowdSetup.cs`, `Shaders/CrowdCard.shader`):
  - **The front row:** 34 real Citizens Pro people, seated, rising to clap and cheer after points, each at their own point in their loop and their own speed.
  - **The rows behind:** 170 picture cards of 12 of the same people. A card is a quad that turns to face the camera, showing frames from an atlas baked at the start of each match from those people under that match's light: seated, clapping and cheering, 6 frames each. The bake took 258 ms in the WebGL build.
  - **Round the venue:** 24 real Citizens Pro people where the low-poly ones stood, idling, talking, looking about, and clapping on points.
  - **Clothes:** everyone's own outfit (89 different people, Summer and Beach sets). Team fans are chosen from the people whose shirts are nearest the team's kit colour, each shirt measured from its own texture over the torso's triangles.
  - **The old pieces:** step 2's VAT spectators, its crowd script (`CrowdDresser`, `CrowdStandsSetup`) and the 24 low-poly people are gone from the scene and the code. Their packs stay in `Assets`.
- **Proof** (`1b-citizens-*.png` and `1b-citizens.txt`, real match data):
  - 34 real people, 170 cards, 24 bystanders, 64 team fans, 44 different people in one match.
  - The stands cheer and clap after points (`1b-citizens-reaction-replay-angle.png`), and the atlas is `1b-citizens-card-atlas.png`.
- **The bake's three faults, found and fixed on the way:**
  - `Camera.Render` called from the game's Update drew nothing; URP's render request draws.
  - `Destroy` waits for the end of the frame, so the people were drawn over each other; each is now hidden at once.
  - A skinned mesh is skinned once a frame, so every pose drew the first; each pose is now baked into a plain mesh and drawn.
- **Download:** Citizens Pro's 298 textures are capped at 512 px (spectators are 6 m away or more).
- **Crowd sound unchanged:** B4's sound proof was rerun on the finished crowd and passes 8/8. The crowd erupts on every ace and block, 15 of 15.
- **Said plainly:** the front row and the people round the venue now match the players' quality. The cards are flat and show it from the side at 6 m, which the cameras do reach. Rob can raise `realRows` and see what it costs.
- **My mistake on the way:** removing the stray folder of 1a's first `--unity-full` run, I deleted the Unity repo's whole `docs` folder, which held one tracked file, `docs/UNITY-STATUS.md`. I restored it from git. I can't rule out that untracked files of Rob's were in that folder.

**The demo rebuilt** (`C:\build\vbe-1.2-demo-2026-11-27b\`, version 1.2.0-demo2, the same separate app and save folder; `proof/demo2/`):
- **The build:** WebGL `.data` is 316,561,412 bytes (demo 1: 276,887,540; +39.7 MB, the crowd). `.data.br` is 247,124,481 bytes. The installer is 473 MB.
- **A whole watched match in headless Chrome:** 18/18, 2-1, the crowd built (34 real, 170 cards, 24 bystanders).
- **Frame rate, roaming TV camera, 60 s:**
  - headless Chrome at 1920×1080: **56.0 fps**, against 55.6 for demo 1 (median frame 17.6 ms, 95th percentile 18.1 ms, none over 50 ms);
  - the installed demo, 1280×720: **56.4 fps**, against 58.6 for demo 1.
  - So it did not drop in Chrome. In the installed app it is 2.2 fps lower: within this machine's run-to-run spread, but I've noted it.
- **The install test** (`proof/demo2/install/`): everything that matters passes.
  - The title screen shows 1.2.0-demo2.
  - On a copy of the live save, a played match pays out.
  - The real save folder, the older ones and the Steam install are byte for byte unchanged.
- **The two set-up checks that failed, and why:**
  - **The Uninstall entry:** demo 2 replaces demo 1, with the same app id and so the same Uninstall entry. The check expected a new one.
  - **"No folder":** the demo's save folder existed, empty, when the test began (left by demo 1's uninstaller). Every file the test then moved aside dates from its own run, so none was Rob's.
- **Demo 2 is installed on this PC**, its save folder moved aside after the test, so its next start is a first run.

### D1: six venues, one per continent, with sections 2, 3 and 6 (28 Nov 2026)

**Where it stands.**
- The venue system is built: one data file, `Resources/venues.json`, holds the six continents and what each venue has.
- One venue is built: the island beach, which is oceania.
- The other five are waiting on Rob's packs (decision 39). Their looks and what each is missing are below and in the data file.
- The frame rate and the main download's size are measured in D2's WebGL build, at every time of day (section 2). That build is still to come.

**The continents come from the game.**
- `CONTINENT_KEYS` (`lib/db/src/schema/continents.ts`): north_america, south_america, europe, asia, africa_middle_east, oceania.
- Every match already carries its continent. `/api/unity/match-state` now sends it as `continent` (`artifacts/api-server/src/routes/unity.ts`; null for a Nations Cup match).
- The court reads it (`UnityMatchDataLoader.Continent`).
- In the proof's career, Sydney Riptide's first match is in Asia. Asia is waiting, so the match played at the island beach, and the log says so.

**How a venue loads** (`VenueLoader`, `VenueBundles`):
- **What is the venue and what is not:**
  - The court, players, cameras, stands, crowd, boards and match logic stay in the scene.
  - The venue is everything round them, kept as its own prefab (`Assets/Venues/KEY/Venue_KEY.prefab`).
- **In a build:** each venue is an AssetBundle of its own in `StreamingAssets/Venues`, fetched only when a match is there. So the download does not grow six times.
  - `WebBuild.Step7` builds the bundles first and hands their manifest to the player build, so code stripping keeps what the venues use.
- **In the Editor:** the prefab is loaded straight from Assets.
- **The match waits for the venue.** Once it is in, the cameras' keep-out is built again round its props, and its palms are handed to the weather's sway.
- **Size:** the island beach's bundle is **75.2 MB**. Until now all of it was inside the main download.

**What was in V19** (`proof/D1/venue-survey.txt`, `v19-map-120m.png`, `v19-map-400m.png`):
- A wide sand flat with the court in the middle and the two stands on its west side.
- A pond west of the stands; palm groves 75 to 280 m out to the east and west.
- A seaside hotel 96 m north and a dock 146 m south.
- Rob's Tripo props round the court.

**The palms (6a).**
- **There were 890, not 24.** That counts 13 + 13 near the court (19 to 70 m) and 877 in the island's groves.
- **Each was 1.9 million triangles** (1,944,095 and 1,886,199), so 1.7 billion in all at their nearest level. A 5% screen-size cut-off was all that kept them drawable.
- **They now use light copies of Rob's own two palms** (`MeshReduce`, with meshoptimizer through `scripts/mesh-reduce.mjs`, which keeps the texture's seams):
  - 30,000 triangles near the camera, and 10,000 once a palm is under 20% of the screen's height;
  - shape error 0.9% and 1.2% near, 3.8% and 5.9% far (`proof/D1/palms-light.png`).
- **The total at the nearest level is 26.6 million**, down from 1.7 billion. A third, 2,500-triangle level fell apart (shape error 99%) and was not used.
- **What they cost in frame rate:** measured in D2's build, against demo 2's 56.0 fps.

**Half-buried props (6a): sat on the sand** (`proof/D1/venue-build.txt`):

| Prop | Lifted by |
|---|---|
| T-shirt shop | 1.55 m |
| VIP tent | 2.16 m |
| signpost | 0.96 m |
| scaffolding tower | 0.46 m |
| three towels | 0.10, 0.40 and 0.46 m |

**No venue shadows (section 2).** Nothing in the venue casts a real-time shadow; only the players and the ball do (decision 40).

**The audit, per continent** (rough renders: `proof/D1/continent-*.png`, the pieces owned for each):

| Continent | Look | Owned now | Missing (Rob's packs that would fill it) | State |
|---|---|---|---|---|
| oceania | tropical island: palms, seaside hotel, dock | everything in V19 | none | **built** (Island Beach) |
| north_america | city surf beach: lifeguard towers, surf racks, a pier, beach houses | yellow lifeguard tower, surf rack and boards, BeachyProps lifeguard chair and carts, the dock | beach houses (Hawaii Beach House, or Beach - resort by Mixall), a pier | waiting on Rob |
| south_america | city beach under high-rise hotels, green hills, headlands | the seaside hotel (glass towers), helicopter | headlands and hills (Rock and Boulders 2, Free Island Collection), more towers, a promenade | waiting on Rob |
| europe | Mediterranean cove: red-roofed villas on a headland, stone promenade, an old ship in the bay | the luxury hotel (red roofs), umbrellas | cliffs and rocks (Rock and Boulders 2), a pavilion (Pavilion), the ship (Colonial Ship), clear water (URP Stylized Water Shader) | waiting on Rob |
| asia | resort lagoon: over-water bungalows, limestone islets | the over-water bungalow (but its mesh is broken), luxury hotel | a working bungalow, islets (Island Assets by Lylek, Free Island Collection), lagoon water (URP Stylized Water Shader) | waiting on Rob |
| africa_middle_east | desert coast: dunes, sandstone rocks, shade sails, a low white resort | VIP tent, kiosk | sandstone rocks (Rock and Boulders 2), shade (Pavilion), a low resort (Beach - resort) | waiting on Rob |

- **Every venue wants ambience** (Free General Ambience Sounds).
- **No continent is faked** with the same props recoloured.
- **The owned packs:**
  - Beach Pack and YGS are cartoon-styled, so they are kept away from the court (section 2: one realistic style).
  - BeachyPropsPack's 80 materials were HDRP and drew magenta. They now draw in URP (`proof/D1/beachyprops-urp.txt`).
  - Abandoned World and the Supercyan forest sample have nothing for a beach.

#### For Rob to regenerate (6a)
Pictures: `proof/D1/6a-rob-models-close.png` (close) and `proof/D1/6a-match-distance.png` (each as the TV camera sees it at 1080p, real size on screen).

| Model | Triangles | In V19 | Verdict |
|---|---|---|---|
| T-shirt shop ("clothing store") | 16,635 | 1, 15 m | **too rough up close**: torn, smeared texture. Regenerate |
| VIP tent | 17,963 | 1, 13 m | **too rough up close**: blotchy white, crude poles. Fine at 30 m or more |
| scaffolding tower | 15,714 | 1, 15 m | use (it is the commentary stand, 6b); flat panels close up |
| food van | 16,177 | 1, 14 m | use (the food stand, 6c) |
| signpost (the old one) | 18,924 | 1, 19 m | use |
| umbrella | 18,998 | 1, 16 m | use |
| beach chairs (textured) | 18,598 | 8 | use |
| `beach chairs.fbx` | 18,598 | 0 | untextured copy of the one above; not used |
| two towels | 18,674 / 19,173 | 9 / 8 | use |
| flag on the beach | 19,100 | 11 | use; `flag.fbx` is an untextured copy |
| three surfboards | 17,533 to 18,688 | 14 | use at distance |
| umbrella and chair | 17,942 | 7, 72 m+ | use at distance |
| seaside hotel | 17,634 | 1, 96 m | use at distance; smeared close up |
| dock | 18,198 | 1, 146 m | use at distance |
| the two palms | 1,944,095 / 1,886,199 | 890 | **too heavy**: replaced by light copies of themselves (above) |
| umpire's chair | 17,230 | 1 | use |
| `media tower.fbx` | 15,226 | 0 | **no texture** (all white). Regenerate if it is to be the commentary stand |
| ice-cream cart (`tripo_convert_f95a6fa8`) | 17,119 | 0 | **no texture**. Regenerate |
| luxury hotel (red roofs) | 17,280 | 0 | a far backdrop only (Europe); rough under 100 m |
| over-water bungalow | 18,684 | 0 | **broken**: its mesh is a heap of spikes. Regenerate (Asia needs it) |
| helicopter | 18,726 | 0 | use (a parked prop) |
| national flags, flags on poles | 17,025 / 15,988 | 0 | use |
| stadium and bleachers | 1,921,625 | 0 | **too heavy, and untextured** |
| colourful beach umbrella | 1,169,419 | 0 | **too heavy**; `MeshReduce` can make a light copy if wanted |
| the old lifeguard tower (zip) | | 0 | not unzipped: the 1.2 yellow tower is used |

The people standing round the venue were treated under fix 1b.

**Rob's 1.2 Tripo props (section 3)** (`proof/D1/props-beside-player.png`, each beside a player at real size):
- **Imported** into `Assets/my assets/Props 1.2` (zips unzipped).
- **Textures capped:** scenery at 1024, the gull and drinks at 512. All of `my assets/Environment` is now capped at 1024 too.
- **Placed** at real size, static, facing the court, 19 to 33 m from its centre (`proof/D1/venue-dress.txt`). Clear of the run-off, and in the keep-out.
- **Triangles cut:**
  - the lifeguard tower from 61,958 to 19,940;
  - the pink bottle from 8,956 to 1,400;
  - the handled bottle from 64,500 to 1,900, the cup with straw from 64,446 to 1,900, and the three bottles from 8,830 to 1,900;
  - shape errors 0.7% to 1.8%.
- **Verdicts:**
  - Kiosk, surf rack, lying board, signpost, beach chair and lifeguard tower look good.
  - **The tiki bar** (its skirt) and **the upright board** are smeared and blotchy up close and fine at match distance. Rob may want them remade.
  - The gull reads as a gull.
  - The beach chair comes with its own umbrella, so it stands 1.9 m to the umbrella's top (the chair itself is about 0.9 m).
- **Drinks:** four kinds in five colours each (the original and four hue turns). Eight line the tiki bar's counter.
  - The kiosk is an open gazebo with no counter, so a table inside its front holds five drinks.
- **The kiosk's sign:** the AI-mashed "BEACH VOLLEBALL EMPIRE" banner under its front eave is covered by a panel with the game's wordmark and nothing else.
  - Found by rays on the model: 2.37 × 0.58 m, 1.40 m up.
  - The wordmark came from `Downloads/bve-library-logo-1280x720.png`: the repo path in the additions file does not exist.
  - Pictures: `oceania-dressed-map-kiosk-sign-close.png`, `-kiosk.png`, `-kiosk-match-distance.png`.
- **The signpost:** the surfboard board reading "SAND & SURP" is covered on both faces by a board-shaped panel reading "SAND & SURF", in its colours. The other boards are untouched (`oceania-dressed-map-signpost-close.png`, `-signpost-back.png`).
- **A gull in shot:** `d1-oceania-gull.png`. One venue is built, so there is one picture.

**The venue features (6b to 6e)** (each switched on or off per venue by one line in `venues.json`):
- **6b, the commentary stand:** the scaffolding tower beside the court, with a desk and three seats on its platform, 2.13 m up, facing the court. There are no commentators yet.
  - The TV camera can cut to it between points: "the commentary booth" is a new shot (`d1-oceania-booth.png`).
  - The media tower was the other candidate. It is untextured, so the tower was used. Both are in the 6a pictures for Rob to choose.
- **6c, the food stand:** the food van.
- **6d, the juice bar:** the tiki bar with its drinks, 25 m from the court (`d1-oceania-juice-bar.png`).
- **6e, the band** (`d1-band-band-close.png`, `d1-band-band-match-distance.png`):
  - **The stage:** Loafbrr's Modular Stage (Stage_Built_B, arched truss over a deck 1 m up), 40 m north-east of the court, in view from it.
    - The other choices are on `6e-stage-packs.png`: Stage_Built_A's materials are broken (pink), and OlegWER is arena lights and speakers.
  - **The musicians:** Citizens Pro people in summer clothes on drums, guitar, bass and keyboard, plus a singer at Musical Instruments Pack's microphone on its stand.
    - **Their clips:** Musical Motions' Drumming_A01 (with the kit's own DrumSet_A01), Guitarist_A, Bassist_A and Keyboard_A01; the Lounge Singer's Sing_Upbeat01.
    - **Idle:** each instrument's own idle. Bass has none, so the guitarist's strap idle is used.
    - **The instruments are on the pack's own rig** (decision 41).
  - **The music:** they play while a song plays, and stand idle between songs, when the music is paused or skipped, and when it is muted or at zero. The soundtrack comes from the stage (decisions 37, 38).
    - **Loudness:** full within 20 m, falling with distance beyond that, never below a tenth. In the proof's shots it was 0.35 from the TV camera, 0.54 from the court's centre and 1.0 beside the stage.
    - The TV camera has a new between-points shot, "the band".
  - **In motion** (`d1-band-band-close.png`): the guitar and bass sit on their players' straps, the hands on the necks. The drummer is at the kit, though his sticks are too small to see at that distance. The keyboard player is at the keys. The singer is at the microphone.
  - **What it costs:** 284,982 triangles at its nearest, mostly the five Citizens Pro people, who come only in high detail. The frame rate is measured with the rest in D2.
  - **Pack contents:** `MusicalInstrumentsPack` has electric, acoustic and bass guitars, drums, synth and piano, violin, trombone, xylophone, chimes, a djembe, maracas, mic and stand, a guitar stack and monitors. Musical Motions animates guitar, bass, double bass, drums, keyboard, sax, trumpet and violin.
    - No player was faked with an unrelated clip, and no instrument stands unplayed.
    - Not used: sax, trumpet, violin and double bass, all owned and animated, to keep the beach band small. Rob can ask for any.
- **6f, the stands:** pictures only (`proof/1b/stand-styles.png`); unchanged.
- **6g, wearables and props:** `proof/D1/6g-wearables-and-props.txt` and `.png`.
  - **The count:** 162 hats (101 Santa, 40 Hats Collection, 7 IdaFaber, 4 cowboy, 4 BeachyProps, 2 fun hats from Assets Storms, plus 4 more), 9 sunglasses, 15 towels, 8 bags, 7 pieces of jewellery (IdaFaber's bracelets, earrings, necklaces, swimsuit chains, all parts of the girls' bodies), 27 drinks and 20 umbrellas.
  - **Not for use:** four beer bottles (BeachyProps, Food Pack).

**The proof in a match** (`proof/D1/d1-oceania.txt`, real match data through `harness/unity-on-server.mjs`):
- The venue was in 0.7 s after the match data.
- All seven features were on. The cameras' keep-out took 442 boxes, 414 of them props.
- Pictures: the TV look, the band close and at match distance, the booth, the juice bar, the kiosk, a gull, the lifeguard tower, and the surf rack and signpost.

### D2: time of day (28 Nov 2026)

**Four times, each changing the sun, the sky, the light's colour and strength, the ambient light and the shadows together** (`TimeOfDay`). They belong to the scene, not to a venue, so every venue gets all four.

| Time | Sun | Sky | Ambient and shadows |
|---|---|---|---|
| morning | 22° up in the east, warm, 1.6 | the day sky, a touch warmer | cool sky light, long shadows (0.85) |
| midday | V19 exactly as it was: 50° up, 5000 K, 2.0 | the day sky | V19's own |
| sunset | 7° up in the west, orange, 1.5 | Unity's procedural sky, drawn for the sun where it is | warm; shadows 0.8 |
| night under lights | a weak cool moon (0.08), which keeps the players' shadows | a dark procedural sky; reflections down to 8% | four floodlight towers on, and the band's stage light |

**Where a match's time comes from.**
- **A career match:** the game keeps no hour for a match, so `/api/unity/match-state` sends `timeOfDay`, chosen from the match's id.
  - The same match always gets the same time, and the four times are spread evenly: 400 ids gave 104, 113, 91 and 92.
  - It is also sent for a Nations Cup match.
- **An exhibition:** the player picks it (D6).
- The court applies it once the venue is in and before the crowd bakes its cards, so the cards are lit for the match.

**The floodlights** (`NightLightsBuild`): four 14 m towers by the court's corners, built from OlegWER's truss with two lamp heads each, and one spotlight each, aimed at the court.
- Placed clear of the stands, the props and the run-off.
- No shadows from the spotlights (section 2). They stand at night only.

**Proof** (`proof/D2/d2-{morning,midday,sunset,night}*.png` and `.txt`, a real match each): the wide view from the TV camera's start, the court from the south, and the band.
- **The night pictures:** the court is bright under the towers, the surroundings dark, and the band lit on its stage.
- **The first night was wrong** (the far sand and palms pale and frosty). The cause was the reflections, still baked from the day sky. They are now scaled with the time of day, and the moon and night ambient were halved.

**Still to measure:** the frame rate of every venue at every time (section 2), in the WebGL build that follows.

### D3: weather everywhere (28 Nov 2026)

**The four states work in every venue at every time of day.** The weather goes on top of the time:

| Weather | Sun | Shadows | Sky | Clouds |
|---|---|---|---|---|
| sunny | full | full | as the time has it | thin, white |
| windy | full | full | as the time has it | thin; the palms sway harder, the clouds drift faster |
| cloudy | half | 45% | darker and greyer | thicker and grey |
| light rain | 30% | 30% | darker and greyer still | thickest; rain falls |

- At every time, the clouds and the rain take the sky's light. At night they are dark, not glowing.
- **A career match's weather comes from the game**, because it is already in the odds. The game has ten words for weather, which the court maps to its four:
  - sunny, hot, perfect, clear and extreme heat are sunny;
  - windy is windy;
  - cloudy and overcast are cloudy;
  - rain and stormy are light rain.
- The proof's match was "hot", so the court drew it sunny (`proof/D3/d3.txt`).
- **An exhibition's weather is the player's pick** (D6).

**The wind no longer pushes the ball** (decision 42). Both places did it: Auto's ball (`BallController`, up to 4 N on a 0.27 kg ball, about 15 m/s²) and a played match's ball (`PlayedMatchRunner`). Neither ever ran, because the court was always sunny.

**Proof** (`proof/D3/d3-{time}-{weather}.png`, 16 pictures from one real match, each 1 s after its weather was set):
- Every combination draws.
- **The crowd's back-row cards look dark** in all but the night pictures. They were baked once, at the match's start under its night light. A real match bakes them under its own light; only the proof changes the light afterwards.

### Section 4: the drinks break between sets (28 Nov 2026)

**What happens** (`MatchMoments`):
- **When:** once a set's last point has been presented, and the match goes on. Never during a rally: the next serve, and a played match's engine, wait for it.
- **About 6 s:**
  1. Each pair walks to its own half's sideline, away from the umpire's chair.
  2. Each player drinks from a sports bottle, the pair a moment apart. This is the drinks idle built in the Animations section (`PresentationPoses`), raised to the mouth and lowered again.
  3. The TV camera takes one slow shot of each team.
  4. A banner reads "END OF SET 1 · 2-11".
- **Skipping:** Enter (R3 on a pad) skips it, like the other moments. B5's "straight to the next serve" skips it altogether.
- **Hands empty before the serve:** the bottles are put away and the pair goes to its places.

**The bottle (Rob's rule: only when the ball is not in play; no alcohol, no brands):**
- It is Rob's pink sports bottle, cut to 1,400 triangles, drawn from a grey copy of its texture and tinted to the team's kit colour.
- It is 0.25 m long in her hand, whatever the scale of the bottle's prefab or the player.
- **Fixed on the way:** in a match the bottle was left half a metre behind the visible hand. It is now held on her hand's own bone.

**Proof** (`proof/section4/`, a real match through `harness/unity-on-server.mjs`):
- **Pictures:** `section4-break-team-a.png` (in navy, with the navy bottle raised) and `section4-break-team-b.png` (in white, with white bottles).
- **The first break:**
  - It took 6.0 s, with 4 bottles out, each 0.25 to 0.29 m long and 0.06 m from the wrist.
  - No point was decided during it.
  - When the next point was decided, no bottle was out.
- **The second break:** Enter skipped it after 1.0 s.
- **B5's skip check still passes:** 4/4 (`proof/B5/b5-skip.txt`, rerun with the break in).

Unity `eac671df`.

### Section 2: frame rate and download size, every time of day (28 Nov 2026)

**Measured in the WebGL build** (D1 to D3 in it), with headless Chrome on the beast's GPU at 1920×1080, the roaming TV camera on, for 60 s after the walk-on of a real match (`scripts/webgl-proof/venue-fps.mjs`, `proof/D2/fps/`). The game chose each match's time.

| Venue | Morning | Midday | Sunset | Night under lights | Lowest |
|---|---|---|---|---|---|
| oceania (Island Beach) | 56.8 | 57.1 | 57.1 | 56.9 | **56.8 fps** |

- Every run had a median frame of 17.5 to 17.6 ms and a 95th percentile of 18.1 to 18.2 ms; 0 to 2 frames in a minute went over 50 ms.
- Demo 2 measured 56.0 fps, before the palms were cut and the venue split off.
- **Below 60, but not because of the scene.** An empty page in the same headless Chrome, measured the same way, gets **56.3 fps** (`proof/D2/fps/blank-page-fps.json`, `scripts/webgl-proof/blank-fps.mjs`).
  - So the figure is the browser's own frame pacing on this PC, and the court reaches it at every time of day.
  - Nothing was cut, because nothing in the scene was holding it back.
  - The installed demo measures in the desktop app (demo 2: 56.4); that is the next place to look at 60.
- **The five venues waiting on Rob** play at the island beach, so these are their figures until they are built.

**Download:**

| Piece | Uncompressed | As served (Brotli) |
|---|---|---|
| main data, after D3 (demo 2: 316.6 MB) | 173.5 MB | 137.5 MB (demo 2: 247.1 MB) |
| main data, final build with D4 to D6 | **208.9 MB** | **160.1 MB** |
| the island beach venue (its own download) | 74.9 MB | (LZ4 inside the bundle) |

- The main download fell because the venue left it: the 1.9-million-triangle palms alone had been about 166 MB of mesh.
- **D4 to D6 put 35 MB back.** The six swimwear cuts and the accessories bring IdaFaber's own 2048 normal and mask maps (5.3 MB each) into the build.
  - The next cut, not made: cap the IdaFaber swimwear and accessory maps at 1024 (`TextureCap`); and ten "OLD" ball-pack maps (`Volleyball_Set_1/Textures/Decor/*_OLD_*`, 53 MB), still reached by the courtside ball rack.
- Each venue to come is a download of its own, so the main one does not grow with them.
- Textures are capped:
  - `my assets/Environment` and Rob's 1.2 props at 1024;
  - the gull and the drinks at 512;
  - Citizens Pro at 512 (fix 1b).

### D4: the Store and its own money, built and closed (28 Nov 2026)

**Separate from the career.**
- The wallet and what is bought live in two tables of their own (`store_wallets`, `store_owned`), keyed by the profile, never by a career or a club.
- Nothing in the store reads or writes a club's bank balance or any other career money. `harness/store.mjs` checks the career's and the club's money before and after everything; they don't move.

**The switch and the numbers are one settings file,** `artifacts/api-server/src/data/store-settings.json`:
- `"open": false` (shipped closed);
- the currency (coins);
- a starting balance of 1,000;
- a win reward of 100 and a loss penalty of 25;
- an income of 20 every 24 hours.

Change them, rebuild, no code.

**Rob's four wallet hooks** (`artifacts/api-server/src/utils/store.ts`):
1. **The starting balance**, paid when a profile's wallet first opens.
2. **A win's reward** and 3. **a loss's penalty** (never below zero). Online play will call these; nothing does yet.
4. **The income dribble**, paid for each whole period since the last.

**The items come from a data file,** `artifacts/api-server/src/data/store-items.json`.
- **At launch:** a sun hat, sunglasses, sandals, beach shoes, a bangle, a charm bracelet, earrings, a chain necklace, a pendant, an ankle chain, a leg band, and D6's eight prints.
- **Colour:** every item's colour is the buyer's to choose; a print has two.
- **The pack's sunglasses are frames with clear lenses** (IdaFaber's own); they are sold as sunglasses.

**Adding an item from a new pack (Santa hats and so on):**
1. Import the pack in Unity.
2. Put its part on the players' model: add the part's name to `Wardrobe.Parts` and run `WardrobeSetup` (`Unity -batchmode ... -executeMethod WardrobeSetup.Run -quit`).
3. Render its picture (`StoreThumbs`, which writes it to `public/store`).
4. Add one line to `store-items.json`.

**The players start with no accessories.** Every piece on their model (IdaFaber's hat, sunglasses, shoes, bracelets, earrings, necklaces, leg pieces) is switched off.
- The model already had all five of its pieces off; the others were added off.
- Each piece draws with a material of its own over a grey copy of the pack's texture, so the chosen colour comes out true. The pack's own shader has no colour input that works.
- **The hat** swaps her scalp and fringe for the pack's hat-fitting ones.

**The Store page** (`pages/store.tsx`), behind its own Store pill in the side menu:
- the wallet's balance;
- a card per item, lined up in a grid with no dead space, each with a picture of the item worn on a player, its slot, its price, the colour (or two), and Buy;
- once bought, Wear, one item per slot at a time.

**Proven both ways:**
- `harness/store.mjs`, 25/25: closed as shipped; opened; buying; refusals; wearing; the four hooks; the career's money still.
- `scripts/webgl-proof/pages-d4-d6.mjs` (`proof/pages/`), on the built pages:
  - **Closed:** no Store pill, and `/store` goes back to the dashboard (`d4-closed-menu.png`).
  - **Opened:** the pill, and the store page (`d4-store-page.png`). The sun hat bought in red and worn, the wallet 1,000 down to 850 coins (`d4-store-bought.png`).
  - **"See it on a player":** what is worn goes on the home team's first player in an exhibition (`d6-pick-screen.png`), and D6's court proof shows a hat on a player.

### D5: banners in the crowd (28 Nov 2026)

- **Ten slogans** are in `Resources/banners.json`, for Rob to change: "GO {HOME}!", "GO {AWAY}!", ACE IT!, BLOCK PARTY, DIG DEEP, SET. SPIKE. SCORE., SUN'S OUT, SPIKES OUT, NO SAND, NO GLORY, SIDE OUT!, BEACH VOLLEYBALL FOREVER.
  - The two team banners carry the teams' names and are in their kit colours.
  - No real brands.
- **The eleventh is the player's own words.** They are typed in Settings > Match presentation (up to 28 letters) and sent to the court when it loads (`d5-banner-setting.png`).
- **How they are made:** each is painted at run time by the courtside boards' `BannerPainter`, on a board held up on two poles above a seat in the stands' second to fifth rows.
  - They face the court, sway a little and go up after every point.
- **Proof** (`proof/D5/`, a real match): all eleven are up, the player's "WE LOVE THE RIPTIDE" with them (`d5-banners-stand-north.png`, `-stand-south.png`, `-stands-wide.png`).
- **Fixed on the way:** the sway reset each banner's facing, so every banner stood edge-on to the cameras.
- **Said plainly:** the boards are held up on poles; no person's hands hold them.

### D6: the exhibition game and the online scaffold (28 Nov 2026)

**The pill and the pick screen** (`pages/exhibition.tsx`; `d6-title-pill.png`, `d6-pick-screen.png`).
- "EXHIBITION GAME" sits beside CONTINUE on the title screen. It needs a profile, not a career.
- **The two teams:** any of the game's 60 continental clubs, or a custom team, with team and player names changed at will.
- **For each player:** who plays her (the AI, or person 1 on the keyboard, or persons 2 to 4 on pads 1 to 3), and her accessories in any colour.
- **A custom team's swimwear:** the cut (three bikini sets, three swimsuits), plain or a print, and both colours.
- **The game:** the venue (any of the six), time of day, weather and difficulty.
- Everything is open and free.

**On the court:**
- **The game** reaches the court from the server (`GET /api/unity/exhibition-state`, held in memory only) in the same shape as a career match. That covers the venue, time and weather, the players and their kit or swimwear and accessories, the game's own odds, and the seats.
- **People and devices:** up to four people play on one PC, each on her own device (`PersonInput`).
  - Control follows the ball only for someone who has a whole team to herself.
  - A person playing the far half has her stick turned round in the TV look.
- **Nothing reaches a career.** The court reports nothing (`MatchReporter`), and the match ends back at the pick screen.

**In the final WebGL build** (`scripts/webgl-proof/pages-d4-d6.mjs`, 12/12, `proof/pages/d6-webgl-court.png`): Play on the pick screen opens `/exhibition/court?exhibitionId=...`; the court reads the game, puts the sun hat picked for Annika Bauer on her (`SK_BG_HAT`), seats person 1 on her and the AI on the other three, and the match starts.

**Proof:** `harness/exhibition.mjs --unity`, 23/23 (`proof/D6/`, `d6-exhibition-court.txt`).
- Every option is there; six kinds of bad game are refused; a good one is made.
- **Not one row in any of the 71 tables of the save changed.**
- **On the court:**
  - a custom team in a hibiscus swimsuit (blue with pink flowers) with a sun hat and sunglasses, and a zebra bikini with a bangle; a club team in its kit, one player with earrings;
  - sunset in cloud;
  - **three people seated** (two pads and the keyboard; the proof plugs in virtual pads), each player's engine seat a `LocalSeat`, and the AI on the fourth;
  - nothing reported.

**The two-colour swimwear** is a new material (`BVE/Swimwear2`, `Swimwear`, `SwimwearSetup`).
- The cut's own texture gives the fabric its folds and seams; a print mask mixes the two colours.
- **Eight prints at launch:** leopard, hibiscus, stripes, polka dots, palm leaves, camouflage, tie-dye and zebra. They are drawn by code as tiling masks (`Assets/Textures/Prints`).
- **Proof sheet** (`proof/D6/d6-prints.png`): every print in its own colours on a swimsuit and in a second colourway on a bikini.
- **Said plainly:**
  - **The leopard print looks poor:** speckled, not rosettes. Rob should supply art for it, a mask of the same name.
  - **Palm leaves and hibiscus** read but are simple.
  - **Stripes, polka dots, zebra, camouflage and tie-dye** look right.
- **Seen on the way:** in the serve hold the ball rests at her head, so a player in the sun hat looks as if the ball sits on the hat (`d6-player_a1.png`).

**Ready for online play later** (`docs/update-1.2/ONLINE-SCAFFOLD.md`):
- every player is a seat;
- seats send only inputs;
- the engine is plain C# on fixed steps;
- the set-up is one small block of data;
- `RemoteSeat` is built;
- every match's inputs can be recorded to a file and played back.

**The two-engine proof** (`harness/online-scaffold.mjs`, 6/6, in the full harness):
- one process plays and records a match;
- two more processes play it again from the file alone, and agree with it point by point, to the millisecond;
- one press taken out of the file changes the first point.

**Not built (Rob's instruction):** section 5's commentary team. Its make-up isn't confirmed, so the booth has no commentators.

### Full harness, Part D (28 Nov 2026): three runs, the cap

| Run | Result | What failed | Fixed in |
|---|---|---|---|
| 1 | Stopped in its first seconds | `check-starter-db`: the store's two tables (`store_wallets`, `store_owned`) were in the model but not in the shipped starter database | `07503f05`: added by the server's own `ensureSchema` on a copy; only the two tables and their indexes changed, no table's row count moved |
| 2 | Every long suite passed (season rollover 2,280 s, ai market, nations cup, ceremonies, store, online scaffold, exhibition...) | Four source suites still pinned the old rules: music playlist and settings (6e: the song plays on through the match, at the band's loudness, replacing item 9's fade-out), court finish (an exhibition leaves to the pick screen), presentation (the engine also waits through the drinks break) | `bdbaef5a` |
| 3 | **ALL HARNESSES PASSED** (144 suites) | | |

**A real bug found by run 2, fixed in `bdbaef5a`:** the music counted only `/court` as the court, so in an exhibition (`/exhibition/court`) the songs ignored the band's stage and played at full volume. The ceremony pop-up also stayed off only `/court`, so a career ceremony could have opened over an exhibition match. Both now treat the exhibition court as the court.
- These two fixes are in the pages' source and the harness. They are not in a WebGL or desktop proof of their own: the court itself did not change.

**Final commits (28 Nov):** Unity `ac3a9af1` (branch `update-1.2`); game `80ad1d5f` (D4-D6 and the final WebGL export), `07503f05`, `bdbaef5a`, and this status commit.

## Section 9 and demo 3 (Rob's 28 Nov additions, from 29 Nov 2026)

Rob's order: section 9, then demo 3 (section 8), then section 5, then section 10. Nothing installed or uninstalled; the demo's save folder untouched.

### 9a: tinted sunglasses (29 Nov 2026)

**Why the lenses were clear.** IdaFaber's sunglasses keep their lenses in one corner of the pack's texture, a dark, see-through patch. The plain material the store gave them drew the frame only.

**What was done:**
- **A shader of their own** (`BVE/Sunglasses`, `Assets/Shaders/Sunglasses.shader`):
  - the frame is solid, in the colour chosen;
  - the lens is a tint the eyes show through faintly, with the sky's reflection on it.
- **Five lens tints,** a choice beside the frame colour (`Wardrobe.Lenses`):
  - black and brown: dark;
  - blue mirror: a blue sheen;
  - amber and rose: lighter.
- **In the store,** the sunglasses card has a lens choice beside its frame colour.
  - A pair is bought as `#rrggbb;tint`, so the database needs no new column.
  - A tint that isn't on the list is refused, and so is a pair with no lens.
- **On the pick screen,** each player's sunglasses have the same lens choice. It goes to the court with the frame colour.
- **The store's picture** of the sunglasses now shows dark lenses (`public/store/sunglasses.png`).

**Under the floodlights.** The new shader takes the night lights, the stage light and the sun or moon (`Assets/Shaders/BVELighting.hlsl`).
- By day the lenses reflect the sky. At night that reflection fades with the light; the reflection probe was baked by day and made the lenses milky.

**Found on the way, fixed:** every part hung from the model's root bone was culled as off screen in a close shot of a bent head.
- That covers her hair, the glasses, the hat and the swimwear.
- Their bounds were her standing pose's. `WardrobeSetup` now gives those 26 parts her whole body's bounds.
- This also protects her hair in the presentation close-ups.

**Also changed:** `Wardrobe.Wear` no longer switches a part off and on again when it stays on.

**Proof:**
- `proof/9a/9a-lenses-sheet.png`: Annika Bauer in a real match, close up, in each of the five tints.
  - Top row: midday in the sun. Bottom row: night under the floodlights.
  - `WardrobeProof -mode lenses` via `harness/unity-on-server.mjs`; one picture per tint in `proof/9a/`.
- `harness/store.mjs` 27/27: sunglasses bought with blue mirror lenses; a wrong lens and no lens refused.
- `harness/exhibition.mjs` 21/21: the five tints offered; amber lenses reach the court; a lens they don't come in refused.

**Said plainly:** in the night pictures her head is bowed, so the camera looks down on the glasses; the eyes show through the amber and rose lenses.

### 9b: Rob's swimwear prints (29 Nov 2026)

**Rob's 23 swatches are the prints, as 20 choices.** Paisley is one print in his four colourways.
- His art replaces the eight prints drawn by code for D6. The code that drew them is gone (`SwimwearSetup`), and so are their masks (`Assets/Textures/Prints`) and the store's pictures of them.
- **Nothing was repainted;** the swatches were only cropped and scaled.

**A new print is one picture and one line, with no code change and no new build.**
- The pictures are served by the game (`artifacts/beach-volleyball/public/prints`, at `/prints/`).
- The court loads a print by name when a player wears it (`PrintLibrary`), with mipmaps so it doesn't shimmer at a distance.
- So the main download doesn't grow; only the prints worn are fetched.
- The data file, `artifacts/api-server/src/data/prints.json`, holds each print's:
  - name and picture;
  - colours (Rob's defaults);
  - colourways;
  - how it repeats;
  - scale.
- `scripts/prepare-prints.mjs` turns Rob's swatches into the game's pictures (below). A new swatch can also be dropped in as it is.

**The size cap:** 42 MB of swatches became **3.0 MB**.
- Each is capped at 1024 wide.
- Prints of 3 colours or fewer are stored as PNG, so their edges stay clean for the colour change; full-colour prints as JPEG at quality 90.

**Rob's rule, and the counts.** A print of three colours or fewer has a colour picker per colour (his colours are the defaults); a print of more is shown exactly as painted.
- **Changeable (11):**
  - 2 colours: both hibiscus, stripes, pinstripe, polka dots, houndstooth, zebra, tiger stripes, cow, palm leaves;
  - 3 colours: gingham (red, pink, white).
- **As painted (9):** camouflage, leopard, tiger, snakeskin, tropical hibiscus, ditsy floral, retro floral, tie-dye, and paisley in his four colourways.
- **Counted from the pictures** (pixel clusters, blends between two colours not counted): every count agrees with Rob's.
  - **Camouflage:** a first coarse count merged its olive green into the brown. It has 4: dark brown, mid brown, olive and tan.
  - **Paisley green and orange:** each has 3 main colours plus shading between them, so they stay as painted, as Rob said.

**The colour change** is in the swimwear shader (`BVE/Swimwear2`).
- Each pixel of Rob's picture is read as a mix of the print's own 2 or 3 colours and drawn as the same mix of the player's.
- So the soft edges he drew stay clean in any colours (`proof/9b`, "a second colourway" column: hot pink and sky; gingham in navy, baby blue and white).
- The shader now also takes the night floodlights (the D6 one took only the sun or moon).

**Seams, measured edge to edge** (each edge's mismatch against the picture's own pixel-to-pixel change):
- **Regular patterns:** cut to a whole number of their repeats, measured from the picture, then tiled. No seam shows:
  - gingham 16 x 8 repeats (110.8 px);
  - houndstooth 16 x 8 (110.6 x 105.7 px);
  - polka dots 10 x 5 (164.6 x 167.9 px);
  - stripes 4 repeats down (189.4 px).
- **Already joining:** tiled as they are. That is camouflage, leopard and tropical hibiscus. Pinstripe joins across and is mirrored down; tiger joins across and is mirrored down.
- **Not joining:** mirrored at every repeat, so the edges always meet. That is cow, zebra, tiger stripes, both two-colour hibiscus, palm leaves, snakeskin, ditsy floral, retro floral and the paisleys.
  - **Said plainly:** a mirror has no hard join, but where four repeats meet the pattern turns symmetrical. The sheet's "join" column shows each one at full size.
  - At the scale chosen, one repeat covers about the width of the swimwear's whole texture, so on a player the turn is mostly off the fabric or at its edges.
- **Tie-dye** is one spiral, not repeated (Rob's instruction). It is placed once across the swimwear's texture at half scale, so the spiral covers the garment; the cut decides how much of it shows on the front.

**Scale: 1 for every print** (one picture across the width of the swimwear's texture), and 0.5 for the tie-dye.
- By eye in the pictures:
  - leopard: about 3 to 4 spots across a bikini cup;
  - two-colour hibiscus: about one flower across a cup;
  - ditsy floral: small, as on real fabric.
- Every print uses the same scale, so Rob can change any one in its line.

**The colour picker** (`components/colour-picker.tsx`), for plain swimwear, every changeable print and the store's items:
- 12 brights: red, orange, yellow, lime, green, teal, cyan, blue, navy, purple, magenta, hot pink;
- their 12 pastels;
- white, grey and black;
- any other colour by hand.
- The sheet shows the palette at its top.

**On the pick screen and in the store:**
- the print's picture beside its colour pickers;
- a colourway choice for paisley;
- "As Rob painted it" for the fixed prints.
- The store sells every print from the data file at one price (`printPrice` in `store-items.json`).

**Proof:**
- `proof/9b/9b-prints-sheet.png` (`PrintsProof` then `scripts/prints-sheet.mjs`). Every print gets:
  - a swimsuit, close;
  - a bikini top, close;
  - match distance (16 m, the TV lens, enlarged 2x);
  - its second colourway or its colourways;
  - its join.
- `harness/store.mjs` 30/30: every print sold and pictured; gingham in three colours; leopard as painted and refused in a colour; paisley in a colourway, and refused in one Rob didn't paint.
- `harness/exhibition.mjs --unity` 30/30:
  - the 20 prints offered with their pictures;
  - Rob's rule (11 changeable, 9 as painted, paisley 4 ways);
  - a wrong colour count, colours on a fixed print, and a wrong colourway all refused;
  - on the court, the hibiscus in blue and pink and the paisley in pink, loaded from the game's server (`proof/D6/d6-player_a1.png`, `d6-player_a2.png`).
- The exhibition suite's server now runs as the game's does (production, the built pages), so the court loads the prints from it.

### 9d: the music, Rob's ruling (29 Nov 2026)

Rob approved the songs playing from the band's stage and on through the match. His condition: the player can turn the music down or off at any time, from Settings and from the court's own settings, and the choice is remembered.

**That control was already there:** music mute and music volume, in Settings > Sound and in the court's gear menu during a match. Both are kept in `bve.music`.
- So nothing about them changed.

**Changed: one line of help text,** which had become untrue. Under the court's music volume it still said the songs stop during a match and come back after it (Unity brief item 9, replaced by 6e). It now says: "The songs play on through the match, from the band's stage. Mute mutes only the songs."

**The songs themselves:** never changed, trimmed or faded beyond what they already did.

**Proof** (`scripts/webgl-proof/music-9d.mjs`, 8/8, `proof/9d/`): run on the built game, reading the page's own `<audio>` element.
1. **Settings:** music down to 20% and muted; the song's element follows (volume 0.2, muted) (`9d-settings-sound.png`).
2. **After a reload:** both remembered (`bve.music`), and the song starts that way.
3. **On the court, unmuted at 60%:** a watched match. The song plays on at 0.216, that is 60% times the stage's loudness where the camera was (0.36), never louder than the player's own 60%.
4. **The court's settings, mid-match:**
   - music volume to 0, and the song is silent;
   - muted;
   - the help text says the songs play on from the band's stage (`9d-court-settings.png`);
   - the choice is remembered.

**Shared:** the page proofs now share `scripts/webgl-proof/built-game.mjs`, which provides:
- the server on a copy of the starter database;
- the built pages;
- a career;
- headless Chrome.

`pages-d4-d6.mjs` uses it too, and passes 11/11 (its hat is now bought in the colour picker's Red).

### 9c: the ball in her hand at the serve (29 Nov 2026)

**Before:** while the server held the ball it was drawn 1.5 m over her feet, at her head.
- In a played match that is the engine's held-ball position.
- In Auto, `MatchManager` put it there every frame as she walked to her spot, so it floated beside her head.
- With a sun hat on, it looked as if it sat on the hat.

**Now:** it is drawn in her left hand, her tossing hand, resting on the palm (`ServeHold.cs`).
- The palm is found from her own skeleton as it is that frame (between wrist and knuckles), on the side away from her body.
- It is clear of her head and of any hat, in played and Auto matches alike.

**Drawing only.** The played engine's own held ball (`PlayedEngine.HeldBallPos`) is unchanged, and so are the serve's flight, its start (`BeginServe` still launches from where it did), its timing and every result.
- A1: 18/18.
- `harness/played-match.mjs --unity-full`: 13/13. The court played a whole match (28/28, 2-0), reported it, and the game recorded exactly the court's score.

**Proof:**
- **Auto,** `proof/9c/9c-serve-hold-sheet.png` (`WardrobeProof -mode serve`, a watched match): the server carrying the ball to her spot, from the front and the side, bare-headed and in the sun hat.
  - The ball is at her hands, 0.69 m from her head.
- **Played,** `proof/D6/d6-player_a2.png` (`harness/exhibition.mjs --unity`, 30/30): the server, Sophie Müller, the ball in her hands.

**Said plainly: a batch-only effect, now handled in the proofs.**
- In batch runs nothing counts as seen, so the players' animators (set to cull when unseen) leave their bones in the bind pose.
- A ball placed by her hand then sat at her bind-pose hand, beside her shoulder.
- The Unity proofs now make the animators always animate, as the earlier batch proofs did.
- In the game the camera sees the server, so her bones move.

### 9e: the commentary tent (29 Nov 2026)

**No new model, as Rob asked.** The commentary tent is a second copy of his light yellow lifeguard tower (19,940 triangles).
- **Recoloured on a copy of its texture,** not repainted (`CommentaryTent`, `Assets/my assets/Props 1.2/commentary-tent/`):
  - the yellow (215,631 of its 1,048,576 pixels) becomes the T-shirt shop's navy blue, its light and shade kept;
  - its red (7,427 pixels) becomes orange;
  - white, wood and black stay.
- The yellow tower stays as the lifeguard tower, with its own texture.

**Where it stands:** in the scaffolding tower's place (6b), 14.9 m from the court.
- The scaffolding tower stays on file and in the venue data as a feature of its own, `commentaryScaffold`, switched off in all six venues.

**The booth:**
- The tent's platform is 3.0 m up, 2.42 m across and 3.0 m deep (measured where rays down onto it land).
- **The desk and all three seats fit,** facing the court.
- The TV's "commentary booth" shot looks for `Feature_commentaryStand/Booth`, which is now on the tent.

**Proof:**
- `proof/9e/9e-tent-shop-tower.png`: the yellow tower, the commentary tent and the T-shirt shop side by side, a player in front.
- `9e-tent-close.png`: the tent close up.
- `proof/9f/9f-venue-sheet.png`: the tent in the venue with its booth.

**Said plainly:** the tower's texture has little red, so the orange is accents only. The tent reads blue and white, with the wood of its deck and the shop's timber as the orange.

### 9f: Rob's remade props (29 Nov 2026)

**Imported** into `Assets/my assets/Props 1.2/`, textures capped at 1024 (`TextureCap`):
- `vip-tent`;
- `ice-cream-cart` (the light export);
- `tshirt-shop`: Rob's `tshirt-shop-light.zip` was in the folder, so that one, 33,622 triangles.

`ice-cream-cart.zip` and `tshirt-shop.zip`, the heavier exports, stay on file, unused.

**Each keeps its detail close up** (`MeshReduce`): the full model near the camera, a lighter copy further away, switching by screen size as the palms do.

| Prop | Near | Far | Shape error far |
|---|---|---|---|
| VIP tent | 61,196 | 19,666 | 1.4% |
| ice-cream cart | 32,532 | 9,779 | 1.3% |
| T-shirt shop | 33,622 | 14,896 | 1.1% |

**In the venue:**
- **The VIP tent** is in the old one's place (47.2, 32.8) at the old one's size: as large as fits the old one's box. That makes it 9.5 m across and 7.5 m tall.
  - The old one was 12.8 m across but only 7.5 m tall. Matching its width alone would have made Rob's taller tent 10 m high.
- **The T-shirt shop** is in the old one's place (60, 13) at real size: 2.8 m tall, 4.7 m wide.
- **The old two are out of the scene.** Their models stay on file.
- **The ice-cream cart** is a new venue feature, `iceCreamCart` (on), at (52.5, 1.5), 2.2 m tall.
- All three turn their good side to the court.

**The AI lettering** (`proof/9f/9f-lettering-sheet.png`, close all round):
- **The cart:** the side it turns to the court has a clean red "Ice Cream" script. The other side's red script is mashed.
  - It is now covered, as the kiosk's sign was: a board with "Ice Cream" in the cart's red on its cream, found on that face, 1.59 x 0.76 m.
- **The T-shirt shop:** its sign "BEACH EVENT T-SHIRT SHOP", the shirts' prints and the counter's picture read cleanly. **Fine as it is.**
  - Its plain back wall has large dark smears in Rob's texture. The back faces away from the court.
- **The kiosk's cover:** now found by scanning the whole face above the counter. It spans the full fascia board, 4.47 x 0.55 m; before, the scan stopped at the first gap, at 2.37 m.

**The VIP tent's back, squared up** (`VipTentSquare`, `proof/9f/vip-tent-profile.txt`, the roof's height map before and after):
- **Measured,** in the model's own axes (1 m tall overall):
  - the front roof ends 0.38 out, 0.40 high in the middle and 0.34 at its corners;
  - the back matches it to 0.37 out, then carried on to 0.50, falling to 0.26.
- **Fixed on a copy of the mesh, by moving vertices only** (13,532 of 53,568; no new geometry, the texture mapping untouched):
  - the flap past 0.37 is drawn in to a short lip ending 0.396 out, like the front's;
  - it is made level at the front's own edge height (0.35 at the corners, 0.40 in the middle, against the front's 0.34 and 0.40);
  - the back third of the roof is lifted gently into it;
  - the back posts are moved in whole and lengthened to meet the corrected edge, so they stand upright.
- **The original zip and FBX are untouched.**
- **Proof:** `proof/9f/9f-vip-tent-sheet.png` shows as sent and squared up, from the side, from behind and from a TV camera's height.
- **Said plainly:** the canvas of the old flap is pressed into the lip. It doesn't tear, but its texture is squeezed there.

**Beside a player at real size, close and at match distance:** `proof/9f/9f-props-beside-sheet.png`.

**In the venue** (a real match, midday, `proof/9f/9f-venue-sheet.png`): the TV look; the kiosk; both sides of the cart; the commentary tent; the T-shirt shop; the VIP tent.

### Demo 3, for Rob's friend (section 8, 29 Nov 2026)

**The package:** `C:\build\vbe-1.2-demo-2026-11-28\Beach Volleyball Empire 1.2 Demo Setup 1.2.0-demo3.exe`, 458 MB, version `1.2.0-demo3`.
- It is the same separate demo app as demo 2 (`electron-builder.demo.cjs`: same app id, its own save folder, no Steam, its own port).
- It holds everything built so far:
  - the band;
  - the venue's features (the commentary tent, the squared VIP tent, the T-shirt shop, the ice-cream cart);
  - times of day and weather;
  - the drinks break;
  - crowd banners;
  - the Exhibition Game;
  - Rob's prints, the colour picker and the tinted sunglasses;
  - the ball in her hand at the serve;
  - the music's controls.
- **Not in demo 3, as Rob ordered:** the commentary team (section 5, after demo 3).

**Not installed, and the install test skipped.** Demo 3 has demo 2's app id, so installing it would replace the demo Rob is using, and the install test moves his save aside.
- Nothing was installed or uninstalled.
- The demo's save folder (`AppData\Roaming\Beach Volleyball Empire 1.2 Demo`) was not touched.
- Rob installs demo 3 himself. `DEMO-CHECKLIST.md` says how (over demo 2, which it replaces in place, the save carried on).

**The WebGL export** (Unity at 9e/9f's commit, `ea70a0c5`):

| Piece | Uncompressed | As served (Brotli) |
|---|---|---|
| main data | 196.5 MB | 158.0 MB |
| the island beach venue | 81.1 MB (74.9 before 9e/9f's props) | (LZ4 in the bundle) |

**The proof, on the package's own files** (`scripts/webgl-proof/demo3-proof.mjs`, `proof/demo3/`).
- The package's server bundle serves the package's own pages, run by the repo's Electron as Node, on a copy of the starter database.
- The packaged app itself was never launched: it would open its own save folder.
- Headless Chrome on the PC's GPU, 1920 x 1080.

**Result: 21 of 22 checks pass** (`proof/demo3/summary.json`, the pictures in `demo3-sheet.png`).

**A. A whole watched career match**, opened as Rob opens it (CONTINUE, Watch Match), in Auto.
- The crowd's ten banners are up, with the player's own "We love the Riptide".
- **The frame rate:** 57.0 fps over 30 s in the TV look (median frame 17.5 ms). Headless Chrome's own ceiling on this PC is 56.3.
- The drinks break played.
- The match ran to its end (three sets), and the result reached the career.

**B. An Exhibition match from the pick screen.**
- **The set-up:** a custom team; Annika in Rob's tropical hibiscus as he painted it, with blue mirror sunglasses; Sophie in polka dots recoloured hot pink and white from the picker, with amber sunglasses; the AI playing all four.
- The court wears exactly that, Rob's prints loaded from the game.
- **The song plays from the band's stage at the band's loudness, not full volume:** sampled every 2.5 s for 30 s, it stayed between 0.14 and 0.25 against the player's own 0.4, moving as the camera moved.
- **No career ceremony opens over it.** A ceremony was planted waiting in this copy of the database: it opened on the dashboard, then never on the pick screen or over the match.
  - This is the fix from 28 Nov (`bdbaef5a`), proved in the browser for the first time.
- **The frame rate:** 57.1 fps.

**The one failure, and a finding.** The proof was to picture the director's "the band", "the commentary booth" and "the crowd" shots between points of the career match.
- **The director picks them.** Over one match it picked the band 3 times and the booth 6 times (`console.log`).
- **But they never reach the screen in a watched match with the presentation on.** The point's own cutaways play over them straight away: the scorer's close-up 1.1 s, the other side 0.7 s, then a replay 2.2 s. The next serve's look follows.
  - The pictures at 1.5, 3.5 and 5.5 s after "the band" was picked show exactly that.
  - This run never picked the booth after the proof began looking, hence the failure.
- **This dates from B2** (the point's presentation was laid over B1's between-points shots).
- With "Skip to next serve" on, the between-points shots do get the screen.
- **Not changed:** making room for them would change the 3 to 4 s between points that Rob set in B2. Rob to decide. One way: let a band or booth shot replace "the other side" close-up when no replay follows.

**Tests before the full harness** (the suites covering section 9):
- exhibition `--unity` 30/30;
- store 30/30;
- presentation 43/43;
- played match: A1 18/18 and `--unity-full` 13/13 (9c);
- the pages proof 11/11 and the music proof 8/8 (9d).
- **The full harness runs once section 5 is in,** so one run covers section 9, demo 3 and section 5 together (within Rob's cap of 3).

**`DEMO-CHECKLIST.md`** is updated for demo 3:
- how to install it over demo 2;
- what is new to show: the Exhibition Game from the title screen, the new prints and sunglasses, the band, V for the TV camera, times of day and weather, the drinks break, the venue;
- item 1, the real controller test, kept.

### Section 5: the commentary team (29 Nov 2026, after demo 3)

**Rob's team, all from data.** The team is in the career's matches and in exhibitions:
- **Kailey and Hukum,** the residents, unchanged.
- **Nicole Dupont,** the sideline reporter.
- **One celebrity guest per match:** Roxy Calderwood or Kai Brennock. Both are invented, and their voices come from ElevenLabs' stock, never an imitation.

**The lines** are Rob's recording sheet, `docs/update-1.2/COMMENTARY-TEAM-LINES.md`: 57 new lines, the one sheet he records from.
- `scripts/commentary-team-data.mjs` turns it into the court's data, `StreamingAssets/commentary/TEAM.json`. For each line: its file, voice, moment and words.
- **A new guest later** is a table in the sheet, this script and a folder of clips. No code.
- In a career match the court picks the guest by the match's id among the file's guests, so a new one joins the rotation.

**Who is in the booth:**
- **A career match:** the reporter on, and Roxy or Kai at random per match (`unity.ts`: `commentary: { sideline: true, guest: "random" }`).
  - One switch in Settings > Match presentation, "Guest commentators" (on), turns the guests off. The court is told on its address (`?guests=0`).
  - This is my default, for Rob to change.
- **An exhibition:** the pick screen's "Guest in the booth" (Roxy, Kai, or No guest; read from `TEAM.json`) and "Nicole Dupont on the sand" (on or off).

**When they speak** (`CommentaryTeam.cs`):
- **Never during a rally, never over anyone.** Every team line waits for the booth to be quiet. A between-points line not started before the next serve is dropped.
- **The guest** follows the residents' call of the same play: an ace, a block, an error, a long rally, set or match point, a comeback, or now and then a quiet moment.
  - At most once in three points, never the same line twice in a set.
  - At the walk-on Kailey introduces the guest, who says hello.
  - Hukum answers every other guest line ("And that's why we invited you").
- **The sideline reporter** speaks in breaks only:
  - at the walk-on (her night line under the lights, her weather line in wind or rain);
  - at each drinks break (the set's end, the drinks, the band, or before a deciding set);
  - when the match is won.
  - A resident hands over to her first ("Let's go down to Nicole on the sand") and Hukum thanks her after, when those lines are recorded.
- **Until Rob records a line, nothing breaks:**
  - a missing clip is skipped in silence;
  - so are the hand-over and the introduction that would lead to it;
  - the residents carry on;
  - once the clip is in the folder under its file name, it plays.

**In person** (`CommentaryBooth.cs`, Citizens Pro, the crowd's own people and animators):
- **In the commentary tent,** at its desk: Kailey, the guest (or an empty seat) and Hukum, seated.
- **On the sand** on the tent's side: Nicole, standing, with a microphone in her hand (a copy of the band's), facing the court; she talks while she speaks.
- **The TV's shots:** "the commentary booth" shot shows the three; a new cutaway, "the sideline reporter", is on her for each of her lines.

**Levelling** (`scripts/level-commentary.mjs`): every clip is brought to the existing clips' speech loudness when it is added, run by Rob.
- Speech RMS over the voiced part: the existing 48 average -18.5 dBFS.
- A quiet clip's loudest moments are held under -1 dBFS by a short look-ahead limiter.
- It is read and written with Windows' own media transcoder; nothing installed.
- **On Rob's four samples** (copies; his files untouched): they spread from -25.5 dBFS (sample 1, Roxy's, the quiet one he named) to -13.8 (sample 4); after levelling, -19.2, -18.4, -18.4 and -18.3.

**Music:** as 9d. The songs are never touched.

**Proof:**
`harness/commentary-team.mjs --unity`: **26/26 pass** (in the full harness as suite 98zzf, "commentary team").
- **The sheet and the data agree:** every one of the sheet's 57 lines is in `TEAM.json` with the same file, voice, moment and words, and nothing else is (15 sideline, 17 Roxy, 17 Kai, 8 resident hand-overs).
- **The match data:** a career match sends the reporter on and a guest at random; an exhibition sends its pick; a guest that is not a key is refused.
- **Four whole matches on the court** (V19 in Play mode, batch, 3x; `CommentaryTeamProof`), Rob's new clips all missing, so every team line is decided and skipped in silence (`proof/5/team-*.txt`, each moment with its time):

| Match | The booth | On the sand | Team moments decided |
|---|---|---|---|
| career | Kailey, Kai (the match's pick), Hukum | Nicole | 24 (17 guest, 4 sideline) |
| exhibition: Roxy, reporter on | Kailey, Roxy, Hukum | Nicole | 16 (10 guest, 3 sideline) |
| exhibition: Kai, reporter off | Kailey, Kai, Hukum | nobody | 18 (12 guest, 0 sideline) |
| exhibition: the residents alone | Kailey, an empty seat, Hukum | nobody | 4 (0 guest, 0 sideline) |

- **Pictures** (`proof/5/`): the booth close (`team-*-booth.png`), the TV's booth shot (`team-*-booth-tv-shot.png`) and the sideline reporter (`team-career-sideline.png`, `team-roxy-sideline.png`).

**Two placing faults the pictures caught, both fixed:**
- **The booth was on the tent's roof.** 9e's booth measure took the busiest flat level its rays found, which on the tent is the roof's flat eaves (3.0 m). It now takes the lowest level a good share of the rays land on, the platform 1.75 m up, and puts the desk and seats on its front metre, the deck between the cabin and the railing on the court's side: in the cabin itself the walls hid the commentators (`VenueDress`; `proof/D1/venue-dress.txt` lists every level found). The island venue was dressed again with it.
- **Nicole stood in front of the grandstand, and the booth shots looked at the pond.** The booth's object sits at the venue's origin (its desk and seats carry their own places), and the reporter's side, the commentators' facing and the shots were worked out from it. They now work from the middle of the seats (62.5, 20.0): Nicole stands on the tent's side, on the sand between the sideline and the food van (53.6, 26.1), and the TV's booth shot is from the court's side, a little above the platform (`CameraDirector.BoothShot`).

**The harness's career match is now marked watched first,** as Watch Match does, so the court's progress reports are accepted (before, each was refused with a 409 in the log; the proof's checks did not depend on it).

**On the pictures:** the three sit at a table on the tower's front deck. In the TV's booth shot, from the court a little above the platform, the roof's eaves cut across their heads; the close picture shows them whole.

**What is not proven here:** how the lines sound. No team line is recorded yet, so none was heard; the levelling is proven on Rob's four samples (above).

### Section 10: the five venues (29 Nov 2026, after section 5)

**All six continents now have a venue of their own** (`Resources/venues.json`: all six "built"). Each is its own prefab and its own bundle, loaded only when a match is there. Pictures of all five: `proof/10/venues-sheet.png` (wide, the view north and the TV look at midday, the TV look at night); each picture on its own in `proof/10/`.

| Venue | The look | Built from | How finished |
|---|---|---|---|
| north_america, Surf City Beach | timber beach houses behind the sand, a 150 m plank pier into the sea, red lifeguard towers along the shore, umbrellas, deck chairs, longboards | Hawaii Beach House (its house, merged), Beach - resort (towers, umbrellas, chairs, boards, palms) | complete but for ambience |
| south_america, Bay City Beach | a row of hotel towers on a black-and-white wave-mosaic promenade, palms along it, green hills behind, an 88 m sugarloaf rock in the bay | Rob's seaside and luxury hotels, Rocks and Boulders 2 (in granite), the mosaic made here | complete in its parts; **the towers repeat Rob's two hotel models** (10 towers) |
| europe, Mediterranean Cove | villas with red roofs up the hillside, two rocky arms round the cove, a stone promenade with pavilions, an old sailing ship at anchor, clear blue water | Rob's luxury hotel at villa size, Rocks and Boulders 2 (in a warm limestone), Pavilion, Colonial Ship | complete in its parts; **the villas are one model repeated** (16) |
| asia, Lagoon Resort | seven limestone islets with palms on top in turquoise water, wooden pavilions along the sand, the resort's hotel behind, loungers. No over-water bungalow (Rob: do not worry about it) | Rocks and Boulders 2 (its rock pillar, pale), Beach - resort's palms, Pavilion, Rob's luxury hotel, Hawaii's loungers | complete but for ambience |
| africa_middle_east, Desert Coast | dunes inland, sandstone rocks, shade sails on the beach, a low white resort with pavilions at its edge, a Red Sea blue | Rocks and Boulders 2 (in sandstone), Pavilion, the resort and the sails built here, Rob's palms | **the least finished: the resort is plain white blocks with a window pattern** (no pack had a building) |

**Every venue has:**
- **The tournament's kit, copied from the island venue:** the venue features, each switched by its data flag (commentary tent with the booth and Nicole, food van, juice bar, kiosk, ice-cream cart, band, gulls, lifeguard tower where the data has it), and the always-there props (Rob's VIP tent and T-shirt shop, the signpost, the surf rack, the chairs). So the band, the commentary team and the drinks break work at every venue.
- **A ground of its own, a Unity terrain** (760 m square, heights every 3 m). The scene has only the court and the sea, so a venue without the island would have stood on water. Flat sand round the court and out to the shore; the land behind rises into the venue's hills or dunes. It is painted from layers that blend: sand, the Hawaii pack's moss on the hills, rock on slopes over 32 degrees.
- **Its own sea** (`VenueWater`, new): the scene's sea tinted (a lagoon's turquoise in Asia, a clear blue in Europe) and carried three times as far, its waves kept their size. The scene's sea ends 280 m out, so Asia's islets and Rio's sugarloaf stood over empty sky before.
  - The island venue is unchanged.
- **No venue shadows** (section 2): only the players and the ball cast real-time shadows.
- **Its signature in the TV look's background**, which looks north from the court: the pier, the sugarloaf, the ship, the islets.

**Missing, for Rob to make in Tripo if he wants them** (he buys nothing more):
- **south_america:** apartment towers of a few different designs (the row repeats his two hotel models).
- **europe:** a small Mediterranean villa or two (the villas are his luxury hotel, scaled down).
- **africa_middle_east:** a low white resort building (now plain blocks) and a date palm (his coconut palm stands in).
- **Every venue:** ambience sound (below).

**The packs** (section 0's checks: `proof/10/packs.txt`, `urp-convert.txt`, `pack-versions.txt`, the sheet `packs-sheet.png`):
- **Rob's Asset Store cache holds 37 packs; 21 were candidates for the venues**, and every one of those downloads is complete.
- **Imported, the parts the venues use** (as Unity's own import does, each file with its .meta), then checked in batch: no compile errors. The only import errors were Beach - resort's bag, ukulele and small-props models (their FBX files), which no venue uses and which are not kept.

| Pack | Made in Unity | Draws in URP | Used for | In the project |
|---|---|---|---|---|
| Hawaii Beach House (PBR, HDRP) | 2022.2.2f1 | 51 of 52 after conversion (its HDRP materials moved to URP Lit) | the beach house, the pier's wood, the hills' moss, Asia's loungers | whole (80 MB) but its HDRP settings and sample scripts, so the house can be made again from its scene |
| Beach - resort (Mixall) | 2021.3.15f1 | yes, 32 of 32 | lifeguard towers, umbrellas, deck chairs, longboards, palms | 19 MB of 281 (the rest unused: bags, sandals, toys, big normal maps) |
| Rock and Boulders 2 | 2017.1.2f1 | 8 of 14 after conversion; the 6 not converted are its legacy blend materials, unused | every venue's rocks, headlands, islets, the sugarloaf | 73 MB of 312 (no snow variants, no demo) |
| Pavilion (IG Blocks) | 2021.3.45f1 | 13 of 13 after conversion | Europe's promenade, Asia's resort, the desert resort's shade | 18 MB of 48 |
| Colonial Ship (Nokobot) | 2017.3.1f1 | 19 of 19 after a fix (below) | Europe's ship | whole, 187 MB (one 95 MB model, 149,000 triangles) |
| Yughues Free Sand Materials | 2022.3.60f1 | (textures only) | the sand's wind ripples | 3 MB: the one normal map used |

- **The ship drew plain white:** URP's own upgrader moves built-in Autodesk Interactive materials to URP's Autodesk graph and drops their colour map. `PackUrpConvert` now moves them to URP Lit with their colour map, as it already did for HDRP Lit; the ship's materials were taken again from its download and converted.
- **The beach house:** the pack has no house prefab, only a demo scene that builds one from 3,767 pieces, 1.4 million triangles. `BeachHouse` merges it into 13 meshes, one per material, with the 2,072 pieces under 15 cm left out (nails and screws), then cuts it with MeshReduce: 89,306 triangles near, 43,567 far (`proof/10/beach-house.txt`).
- **Not used, and why:**
  - Free Island Collection: five 44 MB Unity 5 terrains; the venues have terrains of their own.
  - Island Assets (Lylek): a stylised demo island with sample scripts, and no islets.
  - The four water packs (URP Stylized Water, ShoreLine, SUIMONO, WebGPU interactive water): the sea is the scene's, shared by every venue, and tinted per venue instead. A new water shader would be a change to every venue and a frame-rate risk in WebGL; SUIMONO is for the built-in pipeline, and the WebGPU water needs WebGPU.
  - Sun & Sea Beach Materials: painted, not realistic (big cartoon shells and cracks).
  - The four palm packs (Coconut Palm, Super Palm Pack (Mobile), Yughues Free Palm Trees, Palm Tree Pack Free): Rob's own palms (the light copies) and Beach - resort's cover it.
  - Free General Ambience Sounds: 1.5 GB, and the court has no ambience player yet. **Every venue's missing piece.**
  - 25 Free Realistic Textures: 1.3 GB; nothing a venue lacked.
  - 3D Seashell (too small to see at match distance); Fast Buoyancy (the ship lies at anchor).

**The sand textures** (`proof/10/sand-before-after.png`, the same shot of the court's surround):
- Yughues' wind ripples as the relief of the venues' sand, over the island's own sand colours.
- It is a small but real gain: the sand reads less flat close to the court. It costs no frame rate worth measuring: one normal map on the terrain's sand layer, no extra pass.
- The island venue keeps its own sand (its ground is one mesh with its own material); the same ripples could go on it, for Rob to say.
- The Sun & Sea sands were not used (above).

**The frame rate at every time of day, and each bundle's size** (the WebGL build, headless Chrome on the PC's GPU, 1920 x 1080, an exhibition at each venue and time, 30 s in the TV look; `scripts/webgl-proof/venues-fps-10.mjs`, `proof/10/fps/`):
- **Every venue holds the frame rate at every time of day: 55.5 to 57.2 fps, a median frame of 17.4 to 17.6 ms, the 95th at 18.1 to 18.2 ms.** That is headless Chrome's own ceiling on this PC (an empty page gets 56.3 fps, `proof/D2/fps/blank-page-fps.json`); the island measured 56.8 to 57.1 in D1. The new venues cost no frame rate this PC can show.
- **Frames over 50 ms:** at most 3 in a 30 s run (about 1,700 frames), in 5 of the 24 runs; none at the others.
- **Each run loaded the venue asked for** (no fallback to the island). The load is the bundle from the game's own files, 0.6 to 1.3 s; a download over a home line will take longer.
- Pictures of every run (halved to 960 x 540 for the repository): `proof/10/fps/fps-VENUE-TIME.png`; the numbers: `proof/10/fps/summary.json`.

| Venue | Time | fps | median ms | 95th ms | frames over 50 ms | bundle, load |
|---|---|---|---|---|---|---|
| oceania | morning | 56.5 | 17.6 | 18.2 | 3 | 81.1 MB, 1.3 s |
| oceania | midday | 57.2 | 17.5 | 18.1 | 0 | 81.1 MB, 0.7 s |
| oceania | sunset | 57.1 | 17.5 | 18.1 | 0 | 81.1 MB, 0.6 s |
| oceania | night | 56.9 | 17.5 | 18.1 | 0 | 81.1 MB, 0.6 s |
| north_america | morning | 57.1 | 17.5 | 18.1 | 0 | 84 MB, 0.7 s |
| north_america | midday | 55.8 | 17.4 | 18.1 | 3 | 84 MB, 0.7 s |
| north_america | sunset | 57.1 | 17.5 | 18.2 | 0 | 84 MB, 0.7 s |
| north_america | night | 55.5 | 17.5 | 18.1 | 3 | 84 MB, 0.8 s |
| south_america | morning | 56.5 | 17.5 | 18.2 | 0 | 69.4 MB, 0.6 s |
| south_america | midday | 56 | 17.5 | 18.2 | 3 | 69.4 MB, 0.6 s |
| south_america | sunset | 57.2 | 17.5 | 18.1 | 0 | 69.4 MB, 0.6 s |
| south_america | night | 57 | 17.5 | 18.2 | 0 | 69.4 MB, 0.7 s |
| europe | morning | 56.8 | 17.6 | 18.2 | 0 | 110.4 MB, 1 s |
| europe | midday | 57.1 | 17.5 | 18.1 | 0 | 110.4 MB, 0.8 s |
| europe | sunset | 57.1 | 17.5 | 18.2 | 0 | 110.4 MB, 0.9 s |
| europe | night | 57.2 | 17.5 | 18.1 | 0 | 110.4 MB, 0.8 s |
| asia | morning | 57.2 | 17.4 | 18.1 | 0 | 76.5 MB, 0.7 s |
| asia | midday | 57.1 | 17.6 | 18.2 | 0 | 76.5 MB, 0.6 s |
| asia | sunset | 57.1 | 17.5 | 18.1 | 0 | 76.5 MB, 0.7 s |
| asia | night | 57.1 | 17.5 | 18.2 | 0 | 76.5 MB, 0.6 s |
| africa_middle_east | morning | 57.2 | 17.5 | 18.1 | 0 | 71 MB, 0.7 s |
| africa_middle_east | midday | 57 | 17.5 | 18.1 | 1 | 71 MB, 0.6 s |
| africa_middle_east | sunset | 57.2 | 17.5 | 18.1 | 0 | 71 MB, 0.6 s |
| africa_middle_east | night | 57 | 17.5 | 18.1 | 0 | 71 MB, 0.7 s |

**Triangles** (every LOD level counted, from the court's own log): north_america 2.2 million (the twelve houses), south_america 3.7 million (the palms on the hills and the towers), europe 1.2 million, asia 1.1 million, africa_middle_east 1.1 million.

**Demo 4:** packaged, **not installed** (as section 8: Rob installs it himself; the demo on this PC and its save folder untouched).
- `C:\build\vbe-1.2-demo-2026-11-28b\Beach Volleyball Empire 1.2 Demo Setup 1.2.0-demo4.exe`, 808.6 MB (demo 3 was 458 MB: the five new venues' bundles add 351 MB).
- The same demo app as demo 3 (its app id, its own save folder): it installs over demo 3 in place. Inside the package: version `1.2.0-demo4`, edition `demo`, all six venue bundles; the packaging's own checks passed (starter database alone, no `steam_appid.txt`, steamworks unpacked).
- **The proof on the package's own files** (its server and pages, on a copy of the starter database; the app itself not opened, so no save folder was touched), every venue at midday, 15 s each (`proof/10/packaged/`): every match loaded its own venue from the package and played.

| Venue | Time | fps | median ms | 95th ms | frames over 50 ms | bundle, load |
|---|---|---|---|---|---|---|
| oceania | midday | 56.9 | 17.5 | 18.2 | 1 | 81.1 MB, 1.3 s |
| north_america | midday | 56.3 | 17.6 | 18.2 | 2 | 84 MB, 0.7 s |
| south_america | midday | 57.3 | 17.4 | 18.1 | 0 | 69.4 MB, 0.6 s |
| europe | midday | 56.8 | 17.6 | 18.2 | 0 | 110.4 MB, 0.8 s |
| asia | midday | 57.2 | 17.5 | 18.2 | 0 | 76.5 MB, 0.7 s |
| africa_middle_east | midday | 57 | 17.5 | 18.2 | 0 | 71 MB, 0.7 s |

- `DEMO-CHECKLIST.md` is updated for demo 4: the venues and the commentary team at the top of what's new, the repeated pieces under what Rob may notice.

