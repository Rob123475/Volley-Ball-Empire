# Online play: what is in place, what is not (1.2, 28 Nov 2026)

Rob's plan (23 Nov): the exhibition game becomes online tournaments after 1.2. No networking is built in 1.2; the exhibition is built so it can be added without a rewrite. "Multiplayer" here means online. Up to four people on one PC is in this build.

## In place

**1. Every player on court is a seat** (`Assets/Scripts/PlayedMatch/PlayedEngine.cs`, `ISeat`).
- There are three kinds of seat:
  - a person here (`LocalSeat`, fed by `PersonInput`: the keyboard, or a pad of her own);
  - the AI (`AiSeat`);
  - a person on another PC (`RemoteSeat`).
- The match never asks which kind of seat it is: it only reads inputs.
- An exhibition says who sits where: `exhibitionSeats` holds person 1 to 4, or the AI, for each of A1, A2, B1 and B2.

**2. A seat sends only inputs** (`SeatInput`): the stick in court directions, plus the presses (dig, set, spike down and up, soft shot, dive). The engine alone decides what the ball does.

**3. The match rules are plain C#, on fixed steps** (`Assets/Scripts/PlayedMatch`).
- They use no `UnityEngine`, doubles, a fixed 120 Hz step, and the engine's own seeded random numbers (SplitMix64).
- `PlayedEngine.Steps` numbers each step; a `RemoteSeat` plays the input handed to it for that step.

**4. The set-up is one small block of data** (`ExhibitionSetup`, `artifacts/api-server/src/routes/exhibition.ts`). It holds:
- both teams (a club or a custom team), their names and colours;
- each player, her name as changed, her swimwear (cut, print, two colours) and her accessories;
- the venue, time of day, weather and difficulty;
- the seats.

It is plain JSON: it could be sent to another PC as it is. The court reads it from `GET /api/unity/exhibition-state` in the same shape as a career match.

**5. `RemoteSeat`** (`Assets/Scripts/PlayedMatch/OnlineScaffold.cs`). It has the same face as the local and AI seats, and does nothing but play the inputs handed to it (`Hand(step, input)`). A step with nothing handed in is a seat that does nothing that step.

**6. Record and playback** (`InputRecording`, same file).
- It records every seat's input at every step, plus what the match began from: the seed, difficulty, the four players' ratings and who served first.
- It saves to a plain text file and reads back. `Remotes()` hands every recorded input to four `RemoteSeat`s, and the match plays again.
- B2's replays could use the same recording; today they replay the court's own transforms.

**7. The two-engine proof** (`harness/online-scaffold.mjs`, in the full harness).
- Process A plays a whole AI v AI match on the engine and saves its inputs.
- Processes B and C, two more engines, read the file and play the match again with four `RemoteSeat`s.
- **Result:** all three agree point by point (who won each point, how, the time to the millisecond, the score after it) and on the result (0-2, 5-11 and 9-11). All 83,797 inputs were played.
- With one press taken out of the file, the very first point goes the other way: the replay really plays the inputs.
- So the engine is deterministic across processes on this PC. It has not yet been run on two different PCs (see the first online test below).

## Not in place

- **The network itself:** no sockets, no relay server, no lobby, no matchmaking, no accounts across PCs.
- **Input delay and lost inputs:**
  - A remote input has to arrive before the step that plays it.
  - The plan is lockstep with a small input delay: each PC sends its seats' inputs for step N + k, and every engine steps only when it has all four for step N.
  - Not built: no buffering, no resend, no "waiting for the other player" screen.
- **Rollback:** not planned for the first test. Beach volleyball is slow enough that a small fixed delay may do; the test will tell.
- **A check that two PCs have not drifted:** e.g. a hash of the ball and players every second, sent with the inputs. Not built.
- **Floating point on different PCs:**
  - The engine uses doubles. The same build on two x64 Windows PCs should give the same results, but this is not proven.
  - If the first test drifts, the engine moves to fixed-point maths. That is a bounded job: the engine is about 2,700 lines, in one folder.
- **Online tournaments, chat and the store's money online.** The wallet's win and loss hooks are built (D4) and called by nothing until online play exists.
- **Online over Steam.** Nothing has been done with Steam networking. No Steam upload was made.

## The first online test

Two PCs in two different houses play one full match. Rob has four PCs at home, but they share one connection, which proves nothing about the internet. A friend is to be the second house.

**What it needs:**
1. A relay both PCs can reach, so neither needs an open port: a small server online, or Steam's.
2. Each PC sends its own person's inputs, step-numbered, to the other, and plays the other's through a `RemoteSeat`.
3. Both PCs run the same build: same game, same court, same engine.
4. The set-up block, sent once at the start: who plays which player, the teams and the venue.

**What to check:**
- Both PCs show the same score after every point. A hash of the engine's state every second would show the first drift, if any.
- How it feels at the delay the connection needs.
- What happens when the connection drops for a second.

**The recording is the fallback evidence.** Each PC can save its `InputRecording`. If the scores differ, replaying both files on one PC shows whether the inputs differed (a network fault) or the engines did (a drift).
