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

## What Rob must check on screen

(Filled in at the end.)
