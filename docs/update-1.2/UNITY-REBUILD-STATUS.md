# BVE 1.2 Unity match rebuild: status

Brief: `docs/update-1.2/UNITY-REBUILD-BRIEF.md`. Plan: `docs/update-1.2/PLAYABLE-MATCH-PLAN.md`.

## Decisions made without Rob
1. **Where the branches start.** The game repo's `update-1.2` starts from `update-1` at `da9bea65`. That is the same commit as `release-1.1.3`, the 1.1.3 squad-policy report. The Unity repo's `update-1.2` starts from `release-1.1.3` at `dd0a4875`. The 1.1.3 court was exported from that commit, and `feat-manual-controls` is already inside it.
2. **One settings line left out of git.** Unity batch runs add `APP_UI_EDITOR_ONLY` to the WebGL defines in `ProjectSettings/ProjectSettings.asset`. That line was already changed before this session started. It stays uncommitted, and it must be reverted before the WebGL build in Part C.
3. **The two new animation packs are not in item 0's commit.** `Assets/Animo` (AA_Volleyball) and `Assets/KAWAII_ANIMATIOMS_100` are in the Unity project but not yet in git. They go in with the animation work. Both big FBX files (`AA_Volleyball_RootMotion.fbx` 132.6 MB, `AA_Volleyball_InPlace.fbx` 130.3 MB) are already covered by the `*.fbx` LFS rule in `.gitattributes`. `git check-attr` reports `filter: lfs` for both.
4. **The proofs ran with their default settings.** No api-server was running, so they used the prefab ratings and a 0.5 point chance. That is how they stand today, and it is what item 0 asks for.
5. **Unity was closed for every batch run.** No `Unity.exe` was running beforehand.

## Items

| Item | State | Proof | Commit |
|---|---|---|---|
| 0 Baseline | Done, PASS | `docs/update-1.2/proof/baseline/` (`results.txt`, plus the full `compile.log`, `RallyPlanProof.log` and `ManualControlsProof.log`) | game repo: the item 0 commit on `update-1.2`; Unity repo: `update-1.2` at `dd0a4875` (no file changes) |

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
