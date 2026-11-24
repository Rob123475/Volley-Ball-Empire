# Beach Volleyball Empire 1.2: Unity match rebuild (brief for Claude Code)

Written 23 Nov 2026 for Rob. Start after the Caffeinated build is finished. Target: ready for Christmas.

## The goal, in Rob's words
"I want it to be like DOA volleyball or Unbound volleyball."

That means two things, both decided by Rob on 13 Nov:
1. **Matches you really play.** Your timing, aim and your players' stats decide each point.
2. **TV-style presentation with roaming cameras**, like DOA: the camera is always moving, there are replays, reactions and walk-ons.

The full plan is `docs/update-1.2/PLAYABLE-MATCH-PLAN.md` in the game repo. Read it first. This brief turns its Unity parts into work items. Where the two disagree, this brief wins.

## Where everything is (checked on the beast, 23 Nov)
- **Unity project:** `C:\Users\rbonn\Game_Dev\VolleyBall Empire\volleyball`, Unity **6000.3.16f1** (from `ProjectSettings/ProjectVersion.txt`). Git repo `Rob123475/volleyball-unity`.
- **Game repo:** `C:\Users\rbonn\Documents\Volley-Ball-Empire` (Electron + API server + React). The 3D court is a WebGL build shown in an iframe by `pages/court.tsx`.
- **Scene in use:** `Assets/BeachVolleyball V19.unity`. V18 is the older one; leave it alone.
- **Scripts:** `Assets/Scripts` (32 scripts). Batch-mode proofs are in `Assets/Editor` (`ManualControlsProof.cs`, `RallyPlanProof.cs`, `WebBuild.cs` and others).
- **Data in:** `UnityMatchDataLoader.cs` reads `/api/unity/match-state`. Per player it gets speed, power, defense, serve, block, stamina, overall, morale, fatigue, fitness, injured, age, height, kit colours, skin tone. It also gets `pointChanceHome` and `manualAllowed`.
- **Data out:** `MatchReporter.cs` posts `/api/unity/match-progress` after each point and `/api/unity/match-result` at the end. `CourtBridge.cs` tells the page the match is finished.

## What is wrong with the match today (read from the code)
- **The ball does not fly.** `MatchManager.cs` moves it along a fixed six-step script (`RallyStep`: pass, set, attack, pass, set, attack) by lerp.
- **The point is decided before the rally starts.** `DecidePoint` rolls once from `pointChanceHome` (`PointModel.cs`), and the rally is then acted out to that result (`RallyPlan`).
- **Manual mode is a layer on top of that.** `ManualControl.cs` says so itself: forgiving windows, the ball waits for you, and "every point is still decided by the game's own odds". The player can lose a point by missing, and can save a planned winner with a dig, but good play does not win points.
- **`MatchManager.cs` is 114 KB** and does scoring, rally script, boosts, serve positions, stamina, animation and labels in one file.
- **Cameras:** three fixed presets with zoom (`SimpleCameraPresets.cs`). Nothing directs them.

This is why it is a rebuild and not a patch. Rob's rule: when a pathway is wrong, demolish that part and build it fresh. Never layer repair code over the old.

## Rules of engagement (Rob's standing rules)
1. **No guessing.** Read the file, run the command, look at the picture. Never say "done" without proof you ran yourself.
2. **Prove the baseline first** (item 0) before any new work.
3. **Build fresh, delete the old.** When the new played-match engine works, the old forgiving-manual code comes out. No dead code left connected to nothing.
4. **Keep assets.** Never delete art, models, animation packs or scenes. Code dead ends go; content stays.
5. **Never touch Rob's music.** No fades, trims or level changes on any song.
6. **No builds between items.** Batch-mode proofs per item are fine and expected. One full WebGL build and one full package at the end.
7. **Three full runs, then stop.** If the full build and test is not clean in three goes, commit, write down what the failures have in common, and stop.
8. **Do not cut work to save time.** It takes as long as it takes.
9. **Long builds run overnight.** Unity must be closed for batch mode. Say so in the status file if you needed it closed.
10. **Working unattended: decide and go.** Do not wait for permission. Take the most sensible reading, write the decision at the top of the status file, carry on. Stop only for something that cannot be undone.
11. **Hands off:** the live save (work on a copy), Steam (no uploads, no SteamPipe), and `main` in both repos.
12. **Branding:** no FIVB, Mikasa or Olympic names or marks anywhere. It is the "Empire Nations Cup". The ball is the BVE ball.
13. **Screens and graphics:** no dead empty space. Boxes side by side line up. Text big enough to read on a TV.
14. **Git Bash:** forward slashes in paths, `MSYS_NO_PATHCONV=1` for builds. See `docs/toolchain-gotchas.md`.

## Item 0: baseline
- Record the current commit hash of both repos. Create branch `update-1.2` in both. Commit and push per item.
- Confirm the Unity project compiles in batch mode on 6000.3.16f1.
- Run `ManualControlsProof` and `RallyPlanProof` once each as they stand. Save the output to `docs/update-1.2/proof/baseline/`.
- If the baseline fails, stop and report. Do not build on a broken base.

## Part A: a match you really play

Build this as **new files**. Do not grow `MatchManager.cs`. Keep the rules in plain C# with no `UnityEngine` (as `PointModel.cs` does) so the game repo's harness can compile and test the same file.

**A1. Real ball flight.** Gravity and a launch velocity worked out at each contact. The ball can hit the net, clip the tape, land in or out by the court lines. A landing-spot prediction that both the AI and the on-sand ring use.

**A2. Every touch is graded.** Three inputs:
- **timing:** perfect, good, late, miss
- **position:** in reach and balanced, stretching, diving
- **the player's stats** from the career data (defense for digs, power for spikes, serve for serves, block for blocks, speed for getting there, fitness and fatigue pulling everything down)

The grade sets the quality of the ball that comes off the touch. A perfect dig gives an easy set. A late one pops up wild and the setter has to chase it.

**A3. Controls.**
- Read the key and pad mapping in `ManualControl.cs` and keep it, so nobody relearns the game. Add one new action: **soft shot** (cut or poke over the block).
- **Aim:** the direction held at contact aims serves, sets and spikes.
- **Power:** the serve meter stays. Spikes get one too.
- **Block:** a timed jump at the net. Stats decide the reach.
- **Auto-switch (decided):** control follows the ball to whichever of your two players it is going to. Q / LB still overrides.
- Keyboard and gamepad, both proven.

**A4. AI plays the same game.** In a played match the partner and both opponents use the same ball and the same grading. Their "timing" is drawn from their stats and the difficulty. **No winner is decided in advance in a played match.**

**A5. Difficulty: Easy / Medium / Hard,** taken from the career's difficulty setting. Check whether `/api/unity/match-state` already sends it. If it does not, add it on the game side.
- Easy: landing ring, button prompts, wide timing windows
- Medium: ring stays, narrower windows
- Hard: no ring, stats matter more, sharper opponents

**A6. Fair to the career.** A played match reports through `MatchReporter` exactly as now, and pays the same money, ranking points, fitness cost and injuries as a simmed one. Stats must still matter: a weak pair should not beat a far stronger pair just because the player has quick thumbs.
- Proof: a scripted "average player" bot plays full matches headless at each difficulty, weak pair vs strong, even vs even, strong vs weak. Put the win-rate table in the status file for Rob to judge.

**A7. Auto mode is not touched.** It stays the default and stays on `PointModel`, so simmed and watched results keep matching the game's engine. `RallyPlanProof` must still pass at the end.

**A8. Demolition.** When A1 to A6 are proven, delete the old forgiving-manual pathway (the manual branches in `MatchManager.cs`, the old code in `ManualControl.cs`, the old `ManualControlsProof.cs`) and write a new proof for the new engine. List every file deleted or cut down in the status file.

## Part B: TV presentation

**B1. Two camera looks: "TV" and "Game" (Rob, 23 Nov).** The player switches between them at any time, in the match and in Settings, and the choice is remembered.

*TV look: the roaming camera director.* Always moving, never a locked-off shot:
- serve: slow push-in from behind or beside the server, or a low angle off the sand
- rally: a follow camera that drifts and orbits, keeps ball and players in frame, swings as the ball crosses the net
- the kill: a quick cut or swoop in close
- between points: crane and orbit shots of the scorer, the crowd, the venue
- several shots for each moment, picked at random, so it does not repeat
- collision checks: never inside a player, the net, the umpire chair or the boards

*Game look: six fixed points of view of the court.* The camera stays put so the player can judge the ball.
- There are three fixed cameras today (`SimpleCameraPresets.cs`: wide, overhead, close). Keep what works and make it six: behind your own baseline, behind the far baseline, side-on at the net, high sideline (classic broadcast), overhead, and low courtside.
- Keys 1 to 6 and a pad button step through them. Zoom keeps working on each.
- Every one of the six must be set up for all six venues (nothing in the way, nothing clipping).

*Defaults:* a played match opens on the Game look, behind your own baseline. A watched (Auto) match opens on the TV look. Replays and between-point shots use the director in both looks, and can be skipped.

**B2. Between points (3 to 4 seconds, skippable).** Close-up of the scorer with a point-won reaction, the other side's point-lost reaction, a score graphic, and a **slow-motion replay** of big moments (ace, block, diving save, hard spike) from another angle. Replays record positions for the last few seconds and play them back. They are not video.

**B3. Match moments.** Walk-on with name and nation lower-thirds, set point and match point graphics, a winners' celebration, then the existing result banner. The World Tour and Empire Nations Cup podium ceremonies (`CeremonyDirector.cs`) stay as they are.

**B4. Crowd and commentary.** The crowd builds through a long rally and erupts on aces and blocks. Commentary lines tied to what really happened (an ace, a long rally, a comeback). The crowd still dips when Kailey or Hukum speak. Reuse the existing voices and lines; flag any new lines Rob would need to record in ElevenLabs rather than inventing audio.

**B5. Skip and settings.** "Skip to next serve" and "Skip replays", in the match and as toggles in the game's Settings menu, so a long career is never slowed down.

## Animations: two new packs, bought and imported 25 Nov; report any gaps honestly
Motion Cast #14 Vol.1 (already in the project) has 3 serves, 5 digs, 3 standing passes, 3 blocks, 4 dives, 2 smashes, 3 point-won and 3 point-lost reactions, walking under the net applauding, and rising to greet the crowd. The Kevin Iglesias packs are also in the project.

**Both packs were bought and imported by Rob on Wed 25 Nov 2026 (checked in `Assets` the same morning). The build can start.**

- **AA_Volleyball** (activeanimation, Unity Asset Store, v1.0). Folder: `Assets/Animo/AA_Volleyball`. 175 motion-capture clips. Clip names checked from the store's package list on 23 Nov: jump sets and one-hand jump sets, standing sets, setter dump, overhead passes, tip and power tip, off-speed spikes, hard-driven and slide spikes, fake jumps, commit / reaction / swing blocks, one-arm digs in five directions, overhead digs, dives, pancake, falls, five serves, sprint, walk, turns, eight-way shuffles, missing the ball, hit by ball, collisions, and a full set of referee and line-judge signals. The pack has no ball.
  - All the clips sit inside two big FBX files, as read from their `.meta` files on 25 Nov:
    - `Animations/AA_Volleyball_RootMotion.fbx` (132 MB): rig is **Humanoid** (`animationType: 3`). Usable as it is.
    - `Animations/InPlace/AA_Volleyball_InPlace.fbx` (130 MB): rig is **Generic** (`animationType: 2`). It will not retarget to BeachPlayer until it is changed.
  - **First job in this section:** set the InPlace FBX to Humanoid (Rig tab, Animation Type Humanoid, Avatar Definition "Create From This Model", Apply), check the Avatar configures with no missing required bones, and prove one InPlace clip on BeachPlayer. BeachPlayer has root motion off, so InPlace is the expected set. If InPlace will not go Humanoid cleanly, use the RootMotion file with root motion left off and say so in the status file.
  - **Both FBX files are over GitHub's 100 MB file limit.** Track them with Git LFS before the first commit, the same way the big textures are tracked. Do not let a plain commit of them reach a push.
  - The pack also brings `Demo.unity`, one prefab, a model and 350 one-clip Animator Controllers in `Controller/`. Do not add `Demo.unity` to the build list. Leave the controllers alone; build the game's own controller.
- **KAWAII ANIMATIONS 100** (FUDASTORE, Unity Asset Store, v1.11.1). Folder: `Assets/KAWAII_ANIMATIOMS_100` (the folder name is spelled that way by the publisher). 668 clips, one FBX per clip, made for female characters. Rob chose this in place of MC Greet & Talk, which he did not buy.
  - **Paired clips,** in `Assets/Animations/Idle/Idle_Pair`. Each pair is two files, `_1` for one player and `_2` for the other, made to be played together: `@KA_Idle21_HighFive1_1` and `@KA_Idle22_HighFive1_2`, `@KA_Idle33_Hug1_1` and `@KA_Idle34_Hug1_2`. The high-five and hug files were read on 25 Nov and are Humanoid (`animationType: 3`).
  - **Point won** (in `Assets/Animations/Idle`): `Idle25_Cheers`, `Idle74_Cheer`, `Idle36_Yay`, `Idle66_JumpForJoy`, `Idle26_Shout`, `Idle65_ThumbsUp`, `Idle91_ThumbsUp`, `Idle76_MotivatedPose`, `Idle88_DoublePeacePose`, `Idle42_Taunt`, `Idle55_Backflip`, `Idle54_CartwheelAndBackHandspring`.
  - **Point lost:** `Idle67_FeelDown`, `Idle38_Cry`, `Idle27_Angry`, and the seated `Sit_Sorrow` set in `Assets/Animations/Sit`.
  - There is only **one** high five. To stop every celebration looking the same, mix it with the hug and the single-player reactions above and Motion Cast's three point-won reactions.
  - The two players must stand at the spacing and facing the pair was recorded at, or the hands will miss. Work the offset out from the clips and prove the hands meet with a frame strip on two BeachPlayers.
  - Do not use `Idle59/60_Kiss`, the combat, sleep or wall clips. Do not add the pack's demo scene to the build list.
- **PromptMotion** (AI text-to-animation tool) is already in the project at `Assets/PromptMotion`. Rob (25 Nov): he believes it was a free trial with five free motions, after which motions have to be paid for. The five clips he made in June, a cheer among them, are in `Generated/`. Look at those five on BeachPlayer and use any that look good. Do not generate new ones and do not plan around the tool. If a gap cannot be filled from owned clips, say so and let Rob decide.

Rules:
- Confirm both packs are in `Assets` before starting. If one is missing, stop and tell Rob.
- Every clip used must be Humanoid and play on the BeachPlayer prefab. Prove each clip you use with a frame strip on the real model, not the pack's demo character.
- Use the referee and line-judge clips for the umpire.
- Still not covered by any pack: a medal moment, hand signals behind the back, a drinks or timeout idle. Blend these from owned clips and show proof frames.
- If any clip looks wrong on the beach girls (the AA_Volleyball demo character is a robot, so this is untested), say so plainly in the status file. Do not hide it and do not leave a T-pose.

## Part D: customisation (Rob, 23 Nov)

Rob: "once again I need it customisable." Do Part D after A and B are proven. Order inside D is D1 to D6.

**What is already in the project (checked 23 Nov):**
- `Assets/IdaFaber` has a hat (2 textures), sunglasses, shoes (black, white) and an accessories set (bracelet, earrings, necklace, leg piece), 3 bikini sets and 3 swimsuits with 15 colour textures each, and 3 pattern textures in `Textures/Pattern`.
- `BeachGirlAppearanceController.cs` already colours skin and kit per player with a MaterialPropertyBlock. Its own notes say the pack's "easy colour change" is dead as shipped. Read those notes before touching materials.
- `WeatherManager.cs` has four states: Sunny, Windy, Cloudy, LightRain.
- `CourtsideBoards.cs` paints banner text into a texture at run time.
- There is **one** venue and **one** time of day. There is no store, no exhibition mode and no local multiplayer.

**D1. Six backgrounds, one generic beach for each continent (Rob, 23 Nov).** A venue system: the court, players, cameras and match logic stay the same, the surroundings change.
- Read the six continent keys from the game's own data (the schema and starter DB). Do not make up names.
- **Career matches:** the venue is the continent the match is played on. Check what `/api/unity/match-state` sends (`venue` is there now); add the continent on the game side if it is missing.
- **Exhibition:** the player picks any of the six.
- The current beach becomes one of the six. Keep it; nothing is thrown away.
- **First, an audit, before building any venue:** go through the packs in `Assets` (Beach Pack, YGS Beach Party & Fun Pack, BeachyPropsPack, Abandoned World, Supercyan forest sample and the rest) and write, for each continent, what look you can build from what Rob owns and what is missing. Put it in the status file with one rough render each. Rob can fill gaps with Tripo models or a bought pack. Do not fake a continent with the same palms in a different colour.
- Generic means generic: no trademarked landmarks, no real venue names, no real brands.
- Each venue loads on its own so the web download does not grow six times; report the size of each.

**D2. Time of day.** Morning, midday, sunset, night under lights. Sun angle, sky, light colour and shadows change together. Every venue works at every time.

**D3. Weather.** The four existing states work in every venue at every time of day. In a career match the weather still comes from the game, because it is already in the odds. In an exhibition the player picks it.

**D4. The Store and its own money (Rob, 23 Nov).**
- **Strip the models first:** every player starts with no accessories at all.
- **Separate from the career.** The store, the accessories, the prints, exhibition and (later) online tournaments are their own system. They never read or change a club's bank balance or anything else in the career's finances.
- **Its own wallet,** kept per profile, not per career. Rob's design for when online arrives: a starting balance, money won for a win, money lost for a loss, and a separate steady income dribble. Build the wallet and those four hooks now, driven by one settings file so the amounts can be tuned without code.
- **Store page** with its own **pill in the side menu.** Items are bought from the wallet.
- **Launch items:** hat, sunglasses, shoes, bracelet, earrings, necklace, leg piece, and the prints from D6. **Colour is customisable** on each.
- **Items come from a data file,** not code. When Rob buys a new asset pack (Santa hats and so on), adding it is: import the pack, add lines to the file. Write the steps in the status file.
- Store page layout: no dead space, cards line up, a preview of the item.
- **Built but closed (Rob, 23 Nov).** Build the whole store, wallet and hooks and prove them, then ship with the store **closed**: one switch in the settings file. Closed means the side-menu pill is not shown and nothing can be bought. Opening it later is flipping that switch, not new code. Prove it both ways: switch on, buy an item, see it on a player; switch off, no pill and no way in.

**D5. Crowd banners.** Banners held up in the crowd. Ten pre-designed slogans plus one custom banner the player types himself. Reuse the run-time text painting from the courtside boards. No real brands.

**D6. Exhibition game.**
- A new **"Exhibition Game"** pill on the title screen beside the begin-game pill.
- **Up to 4 people on one PC,** any mix with AI: 2 players, 3 players and an AI, 4 players, and so on. Each person picks a side and a player. One pad per person, and the keyboard counts as one. Control auto-switch applies only when one person has a whole team to himself.
- **Pick screen:** choose the two teams and the players for one game, the venue, time of day, weather and difficulty.
- **Names can be changed** for teams and players.
- **Custom teams** have no nation or club colours, so the bikini is fully free: pick a cut (the 3 bikini sets and 3 swimsuits), then **plain or a print**, and **both colours of a print can be changed** (a hibiscus print can be blue with pink flowers; same for leopard and every other print).
  - This needs a new two-colour swimwear material: a mask texture plus two colours set per player. Build it fresh; the pack's own remap does not work.
  - Prints at launch: leopard, hibiscus, stripes, polka dots, palm leaves, camouflage, tie-dye, zebra. Make the masks, render a proof sheet of each in two colourways, and say plainly if any looks poor so Rob can supply art.
- **Everything is open in an exhibition.** Every venue, item, cut and print is free to use. Nothing costs anything and nothing is locked.
- An exhibition result touches nothing in a career: no money, no ranking, no injuries.
- **Build it ready for online play later (Rob, 23 Nov).** Rob wants this same mode to become online tournaments after 1.2. Do not build any networking now, but build the exhibition so it can be added without a rewrite. "Multiplayer" here means online. One to four people on one PC is in this build.
  - every player on court is a **seat**: a local person, the AI, or (later) a person on another PC. The match never asks which.
  - a seat sends only **inputs** (move, button, aim, power). The match engine alone decides what the ball does.
  - the match rules stay in plain C# with fixed time steps, so the same match can run on two machines and agree.
  - team, player, name, bikini and accessory choices are one small block of data that could be sent to another PC.
- **Scaffold for online (build this; it is not networking):**
  - a `RemoteSeat` class beside the local and AI seats, with the same interface, that does nothing yet except take inputs handed to it.
  - a **two-engine proof:** run the same match twice from one recorded list of inputs and show both runs give the same score, point by point. If they differ, the engine is not ready for online and that must be fixed now, not later.
  - record and playback of a match's inputs to a file (the replays in B2 can use the same recording).
  - `docs/update-1.2/ONLINE-SCAFFOLD.md`: what is in place, what is not, and the first online test, which is two PCs in two different houses playing one full match. Rob has four PCs at home but they share one connection, which proves nothing; he is asking a friend to be the second house.

**Rob to answer before Part D starts (A and B do not wait on these):**
1. (Answered: six, one per continent.)
2. (Answered: the store is built but stays closed until online.)
3. (Answered: in an exhibition everything is open and free.)
4. (Settled by 2 and Rob's rule that this system is separate from the career: accessories and prints are for exhibition and online. Career players wear club or nation kit with no accessories.)

**Risk, said once:** Part D is about as big as A and B together. The order A, B, D means the playable match is finished first, and D lands piece by piece after it.

## Not in this brief
- The retirement changes (unsigned free agents stay to 35; retired faces reused after 10 seasons). That is management-side work and gets its own brief.
- Online play, tournaments and chat. That is its own project after 1.2 (see D6 for how the exhibition is built ready for it).
- Any Steam upload.

## Part C: one build, one proof, one report
1. One WebGL build with `WebBuild.cs`. Check how the last export was copied into the game repo (file renames, texture cap, LFS for `.wasm`) and do it the same way. Report the `.data` size against the last build.
2. Headless render proof with `scripts/webgl-proof/`: a full Auto match and a full played match (bot-driven), screenshots at the serve, mid-rally, a replay and the result. Plus one frame of each venue at each time of day, and a four-pad exhibition match.
3. Frame rate in the WebGL build, measured, with Roaming on.
4. Package to `C:\build\vbe-1.2-<date>\`, version 1.2.0, tested against a **copy** of the live save: a played match's result reaches the dashboard and pays out.
5. Full harness run in the game repo.
6. Write `docs/update-1.2/UNITY-REBUILD-STATUS.md`:
   - decisions you made on your own, at the top
   - each item: done or not done, the proof file, the commit hash
   - everything deleted
   - the animation gaps, the win-rate table, the print proof sheet and each venue's download size
   - **Rob's on-screen checklist**: a short numbered list of what to look at and play, in the order he will meet it

Rob then plays several matches on each difficulty with a pad in his hands. The timing windows will need his feel more than once; expect a second pass on the numbers after his first session.

## First prompt for Rob to paste into Claude Code
```
Read docs/update-1.2/UNITY-REBUILD-BRIEF.md in C:/Users/rbonn/Documents/Volley-Ball-Empire, then docs/update-1.2/PLAYABLE-MATCH-PLAN.md. Follow the rules of engagement. Do Item 0 (baseline) only, show me the proof, and stop.
```
