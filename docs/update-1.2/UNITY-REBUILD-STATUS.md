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
     - How much the stats weigh against the timing goes up with difficulty: 55% on Easy, 70% on Medium, 85% on Hard ("Hard: stats matter more").
     - A rating counts from 20 (nothing) to 95 (the best), so the differences between real players show.

   The quality then sets what comes off the touch: how close to the aim the ball goes, how high a dig or set goes, and how safely a spike or serve clears the tape. A spike or serve that is hit badly can go into the net.
10. **The serve meter and the spike meter.**
    - **Serve:** the meter stays as it was: it sweeps WEAK to MAX, and one tap serves. Its own numbers are kept: under 12% goes into the net, and from 92% is the MAX zone.
    - **Serve grade:** the meter is the serve's "timing". MAX zone is perfect, from 70% is good, from 12% is weak (graded "Late"), and under 12% is a fault.
    - **Ace ability:** Rob's rule stays (rated 95+ and tapping in MAX), but there is no automatic ace now. Instead that serve goes 8% faster and its error is halved, and the physics decides the rest.
    - **Spike:** the spike meter is a charge, from a tap (0) to full (1). A full charge hits about 60% harder but is a little less accurate. How the buttons drive it is in A3.
11. **Player reach comes from the career's own data.**
    - Standing reach is 1.33 × her height.
    - Spike jump: 0.40 m, plus up to 0.32 m from power.
    - Block jump: 0.30 m, plus up to 0.40 m from the block rating.
    - Running speed on sand: 3.8 m/s for the slowest up to 6.2 m/s for the quickest, pulled down by condition.
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
    - **The opponents** get sharper with the difficulty: their timing spread is 105 ms on Easy, 75 ms on Medium and 50 ms on Hard, and their reaction time is 300, 230 and 170 ms.
    - **Every AI player's timing** also narrows with her own rating for the touch.
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

## Items

| Item | State | Proof | Commit |
|---|---|---|---|
| 0 Baseline | Done, PASS | `docs/update-1.2/proof/baseline/` (`results.txt`, plus the full `compile.log`, `RallyPlanProof.log` and `ManualControlsProof.log`) | game repo `dffed753`; Unity repo: `update-1.2` at `dd0a4875` (no file changes) |
| Packs | Committed through LFS | `git lfs ls-files` lists all 672 pack FBX files | Unity `3c0e0f4` |
| A1 Real ball flight | Done, PASS | `docs/update-1.2/proof/A1/`: `a1-ball-flight.txt` (Unity batch, 23/23), `a1-dotnet.txt` (dotnet, 18/18), `a1-unity.log`, 3 pictures | Unity `a656a3f`; game repo `23ba802e` |
| A2 Every touch graded | Done, PASS | `docs/update-1.2/proof/A2/`: `a2-touch-grading.txt` (Unity batch, 27/27), `a2-dotnet.txt` (dotnet, 27/27), `a2-unity.log`, `a2-digs.png`, `a2-spikes.png` | Unity `2b964d0`; game repo `3be1fe35` |
| Animations, first job | Done, PASS | `docs/update-1.2/proof/animation/`: `aa-volleyball-humanoid.txt`, `play-strips.txt` and five Play-mode strips | Unity `ed0e902` |
| A3 Controls, played on the court | Done, PASS | `docs/update-1.2/proof/A3/`: `a3-played-match.txt` (Unity batch, 28/28), `a3-unity.log`, three pictures | Unity `ed0e902`; game repo: the A3 commit |

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

**Results** (Medium, players rated 62 unless stated; 1,000 real flights per line):

| What | Result |
|---|---|
| Perfect digs | 0.60 m from the setter on average; 100% within 1 m; top height 4.6 m. That is an easy set. |
| Late digs (200 ms off) | 2.66 m from the setter on average; 11% within 1 m; 21% wild (shanked). She has to chase them. |
| Perfect digs by defenders rated 90 and 40 | 0.19 m against 1.13 m from the setter |
| Sets | A perfect set misses the hitter's spot by 0.31 m at spike height; a late one by 1.01 m. |
| Spike pace | Power 88 hits at 21.2 m/s; power 40 at 12.8 m/s. A full spike meter hits at 16.5 m/s; a tap at 10.2 m/s. |
| Perfect spikes (aimed 0.8 m inside the lines) | 99% in |
| Late spikes | 25% in, 72% in the net, 2% out. A late contact is lower, so the ball doesn't clear the tape. |
| Soft shots | 500 of 500 cleared the tape by 0.4 m or more and landed in, short. |
| Serves | Under 12% on the meter: always into the net. MAX zone: 100% in. Half power: 97% in. |
| Ace ability | A server rated 95 in the MAX zone serves at 21.4 m/s with an error of up to 0.20 m; one rated 94 at 19.7 m/s and 0.42 m. |
| Timing against stats (Medium dig) | A good touch by a player rated 85 scores 0.71; a perfect touch by a player rated 45 scores 0.53. |
| Difficulty and stats | The gap between perfect digs by players rated 85 and 45 is 0.29 on Easy and 0.45 on Hard. |
| Fitness and fatigue | Fitness 60 with fatigue 50 drops a perfect spike from 0.69 to 0.57 and running speed from 5.14 to 4.28 m/s. Stamina 15 drops the spike to 0.61. |

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
