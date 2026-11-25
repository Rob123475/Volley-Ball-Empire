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

## Items

| Item | State | Proof | Commit |
|---|---|---|---|
| 0 Baseline | Done, PASS | `docs/update-1.2/proof/baseline/` (`results.txt`, plus the full `compile.log`, `RallyPlanProof.log` and `ManualControlsProof.log`) | game repo `dffed753`; Unity repo: `update-1.2` at `dd0a4875` (no file changes) |
| Packs | Committed through LFS | `git lfs ls-files` lists all 672 pack FBX files | Unity `3c0e0f4` |
| A1 Real ball flight | Done, PASS | `docs/update-1.2/proof/A1/`: `a1-ball-flight.txt` (Unity batch, 23/23), `a1-dotnet.txt` (dotnet, 18/18), `a1-unity.log`, 3 pictures | Unity `a656a3f`; game repo: the A1 commit |

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
