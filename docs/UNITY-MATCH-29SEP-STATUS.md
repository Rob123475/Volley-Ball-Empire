# Unity match brief 29 Sep 2026: status

Brief: C:\Users\rbonn\Downloads\UNITY-MATCH-BRIEF-29SEP.md. Started after docs/FIX-BATCH-29SEP-STATUS.md
showed every item done or reported (`5dbd510`). Branch `fix-batch-29sep` (game repo); Unity repo
`Rob123475/volleyball-unity`, branch `main`. Unity 6000.3.16f1 in batch mode, Editor closed.
No Steam upload. Rob's live save never written.

## Found before starting (why Rob's 17-21 loss was recorded as a 2-1 win)

A watched match was played THREE times, by three engines that never talked to each other:
1. the game's server "tick engine" (utils/match-tick-engine.ts), started by POST /matches/:id/watch,
   which played its own points on a timer and **recorded its own result** when it finished;
2. Unity's MatchManager, awarding points by a weighted dice roll every 8-18 s (CalculateTeamWeight);
3. the rally drawn on screen, which looped on its own and never decided anything (except a stuff
   block, which awarded a point by a second path).
The court showed (2)'s score; the game recorded (1)'s. Items 1, 2 and 4 replace all three with one
decision per point, made by Unity from the game's own chance, and one recorded result.

## Items

| # | Item | Status | Commits | Proof |
|---|---|---|---|---|
| 1 | One set of odds | DONE | game `f6a7ea2`, Unity `54390e8` | **Game:** the per-point chance is computed in ONE place, `matchPointChance` (routes/matches.ts): the pair picked as for every match (injured never picked), each player's rating scaled by fitness, the Psychology Centre/camp bonus in high-pressure matches, the opponent's real rating, home advantage, form and weather. Sim Result plays at it and now reports it (`pointChanceHome`); GET /unity/match-state sends the same number. The engine's format is Rob's: best of 3, EVERY set to 11, win by 2 (`POINTS_TO_WIN_SET`; was 21/21/15), with the old 40-point deuce cap removed so no score can end illegal; `isLegalSet` added. The rules page and the in-match rules panel say so (the "court swap every 7 points" line is gone: nothing does it). Two suites that hard-coded 21/21/15 (world-tour-competitors, olympics-tournament) now check 11. **Unity:** new `Assets/Scripts/PointModel.cs` (plain C#: the chance, the point, the set/match format, `MatchScore`); the loader reads `pointChanceHome`; MatchManager decides every point from it; `CalculateTeamWeight` deleted. **Proof:** new suite harness/one-set-of-odds.mjs (20/20). A new career run to its first match: /unity/match-state sends 0.5138, Sim Result plays at exactly 0.5138, legal score. Then 2,000 matches through Unity's own PointModel.cs (compiled and run from the Unity repo by harness/unity-point-model, .NET 10) and 2,000 through the game's engine at each of 0.45, 0.50, 0.5138, 0.55, 0.58, both fed the same stream of random numbers: identical win rates (e.g. 24.4% / 24.4% at 0.45, 88.3% / 88.3% at 0.58), all 2,000 matches identical point for point, every score legal. (Run first on independent dice, the gap was up to 2.8 points at 2,000 matches: sampling noise, which the shared stream removes.) Unity compiles clean (batch mode). Full harness 59/59 (suite added as 56/59). |

## Questions for Rob

1. **Item 1, the favourite's edge in shorter sets.** The per-point model is unchanged, but 11-point sets compound it less than 21-point ones. At the game's own chances (game engine, 20,000 matches each): per-point 0.52 -> 60.8% match win, 0.54 -> 72.1%, 0.56 -> 81.0%, 0.58 (the cap) -> 88.0%. Under 21/21/15 the engine's comment gave a 10-rating edge about 65% and the cap about 93%. Keep, or steepen POINT_EDGE_PER_RATING to restore the old spread?
