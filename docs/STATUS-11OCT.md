# Serve brief Sun 11 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\SERVE-BRIEF-11OCT.md`. Game repo branch `launch-final` (worktree `C:\vbe-final`, started at `a208526`); Unity repo `volleyball-unity` branch `feat-manual-controls` (`C:\Users\rbonn\Game_Dev\VolleyBall Empire\volleyball`, started at `66ef4bf`).

## Summary

(Written as the items go; finished at the end.)

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

## What Rob must check on screen

(Filled in at the end.)
