# Beach Volleyball Empire: playable, TV-style 3D matches (plan, 13 Nov 2026)

Rob's call (13 Nov): make the 3D match more like DOA Xtreme Beach Volleyball / Volleyball Unbound: **TV-style presentation with matches you actually play.** Built **after Caffeinated's build goes to Valve** (about 11 Dec), in **2 weeks**, alongside the retirement-age update. Auto mode stays the default and works as it does today.

## What's already there (checked in the Unity project, 13 Nov)
- **Manual mode exists** (`ManualControl.cs`, 5 Oct brief): keyboard and gamepad, control one of your two players (Q / LB switches), the partner is AI, a landing ring and the button to press on screen, a serve power meter, dive, block, cheer. **But it's deliberately forgiving and the point is still decided by the game's odds (`PointModel`)**: pressing the right button about on time keeps the rally going, and your timing and aim don't decide who wins the point. That's the main thing to change.
- **Cameras:** 3 presets (wide, overhead, close) with zoom (`SimpleCameraPresets`, `CameraZoomButtons`, `ArcadeCamera`). No automatic camera director.
- **Presentation pieces:** `CommentaryManager` + `CommentaryLines`, `Scoreboard`, `ActionWordBanner`, `MatchResultBanner`, `CeremonyDirector` (podiums), `CourtsideBoards`, `AudioManager`, the Stadium Crowd Generator, umpire, weather.
- **Animations (Motion Cast #14 Vol.1):** 3 serves (floating, jump, spoon), 5 digs, 4 passes, 3 blocks, 4 dives, 2 smashes, moving in dig, a fall after a hard hit, **3 point-won and 3 point-lost reactions**, **walking under the net applauding the crowd**, **rising from a chair to greet the crowd**. Also Kevin Iglesias packs and the Beach Girls models (skin and kit colours already wired).

## Week 1: matches you really play
1. **Your touch decides the point.** In Manual, the ball's flight is real (physics arc), and each touch is graded by **timing** (perfect / good / late / miss), **position** (in reach, off balance) and the **player's stats** (reach, jump, power, accuracy from the career data). A perfect dig makes an easy set; a late one pops up wild. The odds model stays for Auto and for AI-vs-AI matches, so results reported back to the career work the same.
2. **Aim and power.** Hold the stick or WASD direction at contact to aim serves, sets and spikes; a power meter on serves and spikes (as now on serves). Two attack choices: **power spike** and a **soft shot** (cut or poke) over the block. Block: timed jump, with stats deciding the reach.
3. **Who you control (Rob, 13 Nov: decided):** control **tracks the ball and switches automatically** to whichever of your players it's going to, as DOA does. Q / LB stays as an override. The AI partner calls "mine" and covers.
4. **Difficulty**, tied to the game's Easy / Medium / Hard: Easy keeps today's helpers (landing ring, button prompts, wide timing windows); Medium narrows the windows; Hard has no ring and stats matter more. Opponents' AI scales the same way.
5. **Fair to the career:** a played match pays out exactly like a simmed one (prize money, ranking points, fitness and injuries).

## Week 2: TV presentation
6. **Roaming camera director (Rob, 13 Nov: "roaming camera angles like DOA"):** sports-broadcast style, but the camera is **always moving**, not fixed shots:
   - **during the serve:** a slow push-in from behind or beside the server, or a low angle from the sand
   - **during the rally:** a roaming follow camera that drifts and orbits around the court, keeping the ball and the players in frame, swinging side to side as the ball crosses the net
   - **on the kill:** a quick cut or swoop in close (low angle under the spike, or behind the blocker)
   - **between points:** sweeping crane and orbit shots around the scorer, the crowd and the venue, and a slow orbit around the two partners celebrating
   - several shots per moment, picked at random, so it doesn't repeat
   The camera never sits inside a player, the net or the umpire chair (collision checks). The 1 / 2 / 3 keys still pick a fixed camera; "Roaming" is the new default.
7. **Between points (about 3–4 seconds, skippable):** close-up of the scorer with a point-won reaction, the other side's point-lost reaction, partners' celebration, a score graphic, and an **instant replay** of big moments (ace, block, diving save, hard spike) in slow motion from another angle. Replays record the last few seconds of positions, so they're cheap on WebGL.
8. **Match moments:** walk-on with name and nation lower-thirds (the "greets the audience" animation), set point and match point graphics, a winners' celebration (walking under the net applauding), then the existing result banner. Nations Cup and World Tour finals keep their ceremonies.
9. **Crowd and sound:** the crowd builds with a long rally and erupts on aces and blocks; whistle; commentary tied to what actually happened (an ace, a long rally, a comeback).
10. **Skip:** "Skip to next serve" and "Skip replays" options, and Settings toggles, so the presentation never slows down someone playing a long career.

## Same 2 weeks: retirement, so the cards last 30 seasons (management side)
**The problem, from the 1.1.1 and 1.1.3 reports:** each picture is used once per career. The new-senior pictures are all used by **season 22**, after that only 15 new seniors a season come in against 24–47 retirements, and the market is thinnest around **season 27**. Of 985 retirements in the 30-season run, **542 were free agents nobody signed** ("a season without a club"). Those players use up a card and leave without playing.
**The fixes the 1.1.3 report listed** were more new seniors a season, a graduate picture for picture players once the new ones run out, or **fewer unsigned retirements**. The retirement-age version of that:
- **A. An unsigned free agent no longer retires after one season without a club.** She stays on the market (and can be signed cheaply) until she's 35, then retires if still unsigned. Playing seniors still retire by 40 as now, and injuries can still end a career. This is the biggest lever: it keeps about half of the retiring cards in play.
- **B. Recycle the faces of retired players** who aren't in a Hall of Fame, for a new senior **10 or more seasons later** (Rob's 22 Sep rule: "a non-HoF retiree's name respawns on a new youth, portrait to a graduating youth"). This was decided but never built: today a picture is never used twice in a career. 10 seasons on, nobody remembers the face.
- **Suggested: both.** A slows the drain, and B means the pictures never run out at all. Proof: the 30-season soak shows the market holding (no fall after season 22) and no player without a card.

## Then
One full build and test at the end (no builds between items, Rob's Update #1 rule), Rob plays several matches on each difficulty, fixes, upload as BVE 1.2.

## Risks, said once
- **Animations:** the pack has no jump set, soft shot / poke, or high-five. Workarounds exist (reuse pass and smash clips with blending), but if they look wrong Rob may need one more animation pack.
- **Feel takes play-testing:** the timing windows will need Rob's hands on a pad more than once.
- **Gamepads in the iframe:** they already work for today's manual mode, so low risk.

## Decided by Rob (13 Nov)
- Control tracks the ball and auto-switches.
- Sports-broadcast style, with **roaming camera angles like DOA**.

## Questions for Rob
1. Retirement: **A, B or both** (suggested both)?
2. For A: is **35** the right age for an unsigned free agent to give up?
3. Local multiplayer (2 people on one PC) later, or not at all?
