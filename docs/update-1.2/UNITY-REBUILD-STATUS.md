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

## Items

| Item | State | Proof | Commit |
|---|---|---|---|
| 0 Baseline | Done, PASS | `docs/update-1.2/proof/baseline/` (`results.txt`, plus the full `compile.log`, `RallyPlanProof.log` and `ManualControlsProof.log`) | game repo `dffed753`; Unity repo: `update-1.2` at `dd0a4875` (no file changes) |
| Packs | Committed through LFS | `git lfs ls-files` lists all 672 pack FBX files | Unity `3c0e0f4` |
| A1 Real ball flight | Done, PASS | `docs/update-1.2/proof/A1/`: `a1-ball-flight.txt` (Unity batch, 23/23), `a1-dotnet.txt` (dotnet, 18/18), `a1-unity.log`, 3 pictures | Unity `a656a3f`; game repo `23ba802e` |
| A2 Every touch graded | Done, PASS | `docs/update-1.2/proof/A2/`: `a2-touch-grading.txt` (Unity batch, 27/27), `a2-dotnet.txt` (dotnet, 27/27), `a2-unity.log`, `a2-digs.png`, `a2-spikes.png` | Unity `2b964d0`; game repo `3be1fe35` |
| Animations, first job | Done, PASS | `docs/update-1.2/proof/animation/`: `aa-volleyball-humanoid.txt`, `play-strips.txt` and five Play-mode strips | Unity `ed0e902` |
| Animations, the rest | Done, PASS | `docs/update-1.2/proof/animation/`: `presentation-states.txt`, `presentation-strips.txt` (42/42) and a `play-strip-*.png` for each state, `pair-placement.txt` with `pair-strip-HighFive.png` and `pair-strip-Hug.png`, `pose-proof.txt` with `pose-strip-HandSignals.png`, `pose-strip-Drink.png` and `pose-strip-Umpire.png`, `rejected/` | Unity `287718e` |
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
