# Update 1.2: Rob's additions, Fri 27 Nov 2026

Written up from Rob's chat with Claude on 27 Nov so nothing is lost. Read this together with
`UNITY-REBUILD-BRIEF.md`. Where the two differ, this file is newer.
The brief's rules of engagement apply to everything here. Hands off: the live save, Steam, `main`, and the win rates.

## 0. Do this before anything else: the editor froze (27 Nov, 9 pm)
Rob opened the Unity editor to import the three packs he bought (Citizens Pro 2024, Hats Collection,
Santa Hat Pack +100 Prefab). The editor hung for 28 minutes on
`EditorApplication.delayCall: GrandstandCreator.<OnValidate>b__20_0` ("Waiting for user code in
Assembly-CSharp.dll"), holding 20 GB of memory with the PC at 98%. Rob ended it from Task Manager.
Citizens Pro was still downloading at the time. He does not know which packs finished importing.
- Find out why `GrandstandCreator`'s OnValidate ran away in the editor and fix it so opening the project in
  the editor is safe again. Do not just delete the crowd: section 1b still needs it for the free fixes.
  Proof: the editor opens the V19 scene and settles, with the time it took and the memory it held.
- Check the project is undamaged after the forced close: `git status` in the Unity repo, and report any
  half-imported pack folders in `Assets`. Remove half-imported folders.
- Import the three packs yourself if their downloads are complete in Rob's Asset Store cache
  (`C:\Users\rbonn\AppData\Roaming\Unity\Asset Store-5.x\`, Citizens Pro is under `AGLOBEX-Mobile`).
  If a download is incomplete or missing, do not guess: list which ones Rob must download again and carry on.
- **The packs Rob got on 27 Nov** (all downloaded, so all should be in the Asset Store cache): Citizens Pro 2024,
  Hats Collection, Santa Hat Pack +100 Prefab, Cowboy Hat_1, fun hat, Musical Motions, Female Lounge Singer,
  two packs whose names start "Musical Instrument" (one is NOT_Lonely's Musical Instruments Pack),
  Modular Stage, Arena Stage Venue, Food Pack Mixed, Turnstile Fare Gate. Rob is buying nothing more:
  anything still missing he will build himself in Tripo, so list it for him.
- **Clean the coffee game.** Rob downloaded these through the coffee game project
  (`C:\Users\rbonn\Game_Dev\CoffeeGame`) and some were imported into it by mistake. On 27 Nov at 9:36 pm its
  `Assets` held, among others: `Citizens PRO`, `Cowboy_Hat`, `Female_Lounge_Singer`, `Food Pack Mixed`,
  `Hats Collection`, `Santa_hat_Pack+100`, `UrsaAssets`, `LoafbrrAssets`, `Mia Bikini`, `Beach - resort`.
  Use `git status` in the coffee game repo to find which folders are new and untracked today. Remove only
  those (folder and its `.meta`), touch nothing git already tracks, change nothing else in that project, and
  list what you removed. If you are not sure a folder is one of today's volleyball packs, leave it and ask Rob.
  Never touch `main` there either.
- Nobody checked the three packs against this project's editor version before Rob bought them. Citizens Pro's
  store page says it was made in Unity 6000.0.40; the two hat packs were not checked. After each import, report
  the pack's Unity version against `ProjectSettings/ProjectVersion.txt`, any compile errors or console errors
  it causes, and whether its materials draw in URP. If a pack breaks the project, remove it, say so plainly
  and carry on without it.

## 1. Two fixes from Rob's first look at the demo (do these before Part D)

**1a. The ball is too big.** At the serve it covers the server's whole head.
- Measure the visible ball's diameter in the scene and report it. A real beach volleyball is 21 cm.
- Set the visible ball to 21 cm, and make sure the size the match engine uses (`Court.BallRadius`) agrees with what is drawn.
- Rerun the A1 ball flight proof and one whole played match (`harness/played-match.mjs --unity-full`).
- Proof: a picture at the serve with the ball beside the server's head, and one mid-rally, in both the TV and Game looks.

**1b. The crowd and every other person in the venue must match the players' quality** (updated 27 Nov, 2 pm).
Rob: "they look shit against our players." He also wants the crowd to MOVE, and not all dressed alike: now they
all wear white shirts and black trousers. Mix the clothing, with some in the two teams' colours or national colours.
Work in this order and stop at the first step that fails, reporting why.
1. Report what the crowd is made of now, how many spectators there are, and what they cost in frame rate.
   Do the same for the people standing round the venue (see 6a).
2. Free fixes first, using the crowd pack already in the project (Stadium Crowd Generator, Aikodex). Its store
   page says it can colour the crowd from a texture grid, offset animation timings so motion looks random, and
   build the stands in several styles (steel beams, wooden bleachers, concrete steps, with or without railings).
   - Try the colour grid: mixed clothing colours, with a share of each stand in the two teams' colours taken
     from the match data. Try the timing offsets so the crowd does not move in step.
   - Try the stand styles and show Rob a picture of each one that suits a beach event (this also answers 6f).
   - Proof: before and after pictures from the TV look, the Game look and one replay angle. Say plainly whether
     the spectators still look low-poly beside the players after this.
3. Audit the realistic people already owned (IdaFaber, Abandoned World Base Humans, Swimwear Girl 3, Mia Lock,
   Serah Fei) and say which could stand near the court as reduced-detail bystanders.
4. Rob may buy ONE people pack for the front rows and bystanders. If a new people pack is in `Assets`, check
   its rig converts to Humanoid first, then use it: real 3D people only in the rows the cameras get close to,
   flat animated picture cards of the same people for the rows behind. If no new pack is there, do not build a
   second low-poly crowd. Leave steps 2 and 3 in place and list what is missing for Rob.
- Keep the crowd's reactions and audio working (B4).
- Measure the WebGL frame rate before and after with the roaming camera on. It must not drop.

Then rebuild the demo to `C:\build\vbe-1.2-demo-2026-11-27b\`, version `1.2.0-demo2`, still a separate app with
its own save folder.

## 2. Look and speed (applies to all of Part D)
Rob: the venues must look impressive without creating lag.
- Keep one realistic style. Do not mix low-poly or cartoon scenery with the realistic players and court.
- Spend detail near the court. Simple geometry and painted backdrops for the far background.
- Bake the scenery lighting. Only players and the ball cast real-time shadows.
- Cap textures and report each venue's download size.
- Measure the frame rate of every venue at every time of day in the WebGL build, roaming camera on. Report the
  lowest figure for each. If a venue drops below 60 fps on the beast, cut scenery until it holds and say what was cut.
- Rob owns more packs than are in `Assets`. In the D1 audit, list what each continent is missing so he can import
  from: Beach - resort (Mixall), Hawaii Beach House, Island Assets (Lylek), Pavilion, Rock and Boulders 2,
  Free Island Collection, URP Stylized Water Shader, Colonial Ship, Free General Ambience Sounds.
- Do not stop to wait for missing assets, and do not fake a continent with the same props in another colour.
  Mark it as waiting on Rob and carry on.

## 3. Props Rob made in Tripo
All are in `C:\Users\rbonn\Game_Dev\VolleyBall Empire\1.2 props\`. Each is a Tripo FBX with a `.fbm` textures
folder (some as folders, some as zips to unzip). None has a rig or animation. Every one comes out of Tripo
1 metre tall with 4096 textures, so each needs: import, textures capped (1024 for scenery, 512 for small
items), scaled to real size, static, and added to the camera keep-out. Place scenery well back from the court,
the run-off and the camera paths. Say plainly if any looks poor up close so Rob can remake it.

| File or folder | What it is | Triangles | Real size | Notes |
|---|---|---|---|---|
| `seagull-fbx\` | standing seagull | 8,812 | about 0.6 m long | a few on the sand in each venue. Ignore `seagull-standing.glb` |
| `thatched-bar-fbx\` | tiki bar: bamboo counter under a thatched roof | 8,520 | about 3 m tall | dress the counter with the drinks below |
| `bve-kiosk-fbx\` | kiosk with a blue awning and a sign | 8,285 | about 3 m tall | sign fix below |
| `surfboard-rack.zip` | about six boards in a timber rack | 8,354 | about 2.2 m tall | |
| `surfboard-upright-orange.zip` | board standing on its tail | 17,948 | about 2 m tall | |
| `surfboard-lying-with-leash.zip` | board on its side with leg rope | 18,688 | about 2 m long | |
| `beach-signpost.zip` | post with direction signs and an umbrella top | 18,924 | about 2.5 m tall | sign fix below |
| `beach-chair.zip` | beach chair | 17,942 | about 0.9 m tall | several around the bar and sideline seating |
| `lifeguard-tower-yellow.zip` | yellow lifeguard tower on stilts | 61,958 | about 4 m tall | one per venue at most. Reduce if you can and report the count |
| `drink-bottle-pink.zip` | pink sports bottle | 8,956 | about 25 cm | reduce to under 1,500. The players' bottle for the drinks break, tinted to team colour |
| `drink-bottle-magenta-with-handle.zip` | bottle with handle and spout | 64,500 | about 25 cm | bar dressing. Reduce to under 2,000 before placing more than one |
| `drink-cup-with-straw-red.zip` | takeaway cup with dome lid and straw | 64,446 | about 18 cm | bar dressing. Reduce to under 2,000 before placing more than one |
| `drink-bottles-three-neon.zip` | three bottles fused as one object | 8,830 | tallest about 25 cm | table dressing only |

- **Drinks on the bar:** make 4 to 6 colour versions of each drink by hue-shifting its texture, and line the tiki
  bar and kiosk counters with a mix. If a drink cannot be reduced, place one and tell Rob it needs re-exporting.
- **Kiosk sign:** the lettering is AI-mashed. Cover it: a flat sign panel just in front of each sign face, sized to
  hide the old lettering, showing the game's own wordmark (`steam/store-assets/bve-library-logo-1280x720.png`,
  or the cleanest "Beach Volleyball Empire" logo in the repo). No other text.
  Proof: a close picture of each sign face and one from match distance.
- **Signpost:** the lettering is fine except the surfboard-shaped sign, which reads "SAND & SURP". Cover that one
  with a panel in the same style reading "SAND & SURF". Leave the other signs alone. Proof: a close picture.
- **Not to be used yet (too heavy as exported; Rob is re-exporting them lighter):** a red pop-up canopy tent
  (1,497,356 triangles), a classic car (989,733), four boats (fishing boat, luxury yacht, speedboat, classic
  wooden speedboat, about 565,000 to 585,000 each) and a red sports car (196,536). They are not in the props folder.
- **Proof for the props:** one picture per venue with a gull in shot, and each prop's size beside a player.

## 4. Drinks break between sets
Add a short drinks break when a set ends, before the next one starts. Both teams walk to their own side, each
player uses the drinks idle that is already built (`pose-strip-Drink.png`) or a stretch, the TV camera takes one
slow shot of each team, then play resumes. About 6 seconds, skippable with the same key as the other moments.
Never during a rally. Hands are empty again before the serve.
Rob's rule for anything held: only when the ball is not in play. No alcohol, cigarettes or real brands in a
player's hand.
Proof: a picture of each team at the break, and the B5 skip check still passing.

## 5. Exhibition commentary (D6): decided so far
The exhibition is a different event from the World Tour, so it gets its own commentary team.
- **Celebrity guest commentators (invented by Claude, kept by Rob 27 Nov):**
  - **Roxy Calderwood**, action-comedy film star. Her films: "The Dog or Him?" and
    "Sabotage 3: We Didn't See It Coming".
  - **Kai Brennock**, a retired champion from another sport.
  Web searches on 27 Nov found no real person named either, and no film called "The Dog or Him?".
  "Kate Jones" was dropped: a real Queensland ex-minister has that name.
- **Music:** the soundtrack plays during the match as it does now, with the skip options. No radio object.
- **Voices:** ElevenLabs stock or designed voices only. Never an imitation of a real person.

**Proposed by Claude, NOT yet confirmed by Rob:**
- Four roles: lead caller (every point), analyst (a remark every few points), celebrity guest (small, funny set),
  sideline reporter (breaks only: set end, time-out, walk-on, winners).
- The player picks the celebrity guest from three or four. Lead and analyst stay fixed, because every swappable
  voice needs every one of its lines recorded.
- Rob floated the alternative of 3 voices (2 plus the celebrity) and 3 or 4 more the player can choose from.
- The scripts are not written yet. No audio exists. Do not build this until Rob confirms the set-up.

## 6. Venue features Rob wants in (27 Nov, 13:20)
Rob: "we need commentary, a band and a food stand and maybe a juice bar and I think we're done. Once we can get
all that into the game we'll decide what is a hard asset and what will be a buyable one."
So build each of these as its own venue feature that one line in a data file can switch on or off per venue.
Do not wire any of them to the store yet.

**6a. What is already in the scene and the project. Check these first.**
Rob built a lot of scenery for the original match with his own Tripo models. They are in
`Assets/my assets/Environment/`, and `proof/scene_survey.txt` (14 Sep) shows many placed in the V19 scene:
a food van, a T-shirt shop (also filed as "clothing store"), a scaffolding tower beside the court, a VIP tent,
a signpost, a seaside hotel about 100 m away, a dock, umbrellas with chairs, beach chairs, towels, flags,
surfboards and two kinds of palm tree. Also in the folder but not seen in that survey: `media tower.fbx`,
a luxury hotel, an overwater bungalow, a helicopter, national flags, a lifeguard tower zip and
`stadium+bleachers` (a 58 MB FBX).
- Rob: "if they're any good use them. If the poly is too low or the image looks shit just ask me to regenerate."
- **Report first, with pictures.** For every one of Rob's models: a close picture, a match-distance picture, its
  triangle count, and a plain verdict (use / too rough up close / too heavy). Put the list in the status file
  under "For Rob to regenerate".
- **Things to check from that survey** (it is from September, so confirm against the scene as it is now):
  - The T-shirt shop's box ran from 1.55 m below ground to 1.55 m above, the VIP tent from 2.16 m below, the
    signpost 0.96 m below and the scaffolding tower 0.46 m below. If they are half-buried, sit them on the sand.
  - The two palm models are 50 MB and 53 MB FBX files, each placed 12 times. Report their triangle counts and
    what the 24 palms cost in frame rate. If they are heavy, say so and replace them with lighter palms.
  - The people standing round the venue are low-poly (`casual_Male_G`, `Swimwear_Female_YoungAdult_*` and
    others). They clash with the players the same way the crowd does. Treat them under fix 1b.

**6b. Commentary stand.** Rob thinks he made one for the original game. Find it: the scaffolding tower by the
court and `media tower.fbx` are the candidates. Show Rob both. Whichever is used becomes the commentary
position: a visible booth the TV camera can cut to, with seats for the commentary team from section 5.
No commentator characters until Rob confirms the team.

**6c. Food stand.** Use the existing food van if it passes 6a.

**6d. Juice bar ("maybe").** The tiki bar from section 3, dressed with the drinks, is the juice bar.
Do not build a second bar unless Rob asks.

**6e. Band.** Rob wants a band at the beach event with the game's own soundtrack coming from it:
"pretty fucking cool", and no other volleyball game has it.
- Build now: a small stage placed well back from the court, and make the soundtrack play from the stage's
  position, louder near it, so the roaming camera hears it move. Skip and volume keep working as they do now.
  Never change, trim or fade Rob's songs.
- **Update 27 Nov, 9:30 pm: Rob has now downloaded band assets.** They are in his Asset Store cache
  (downloaded through the coffee game project, NOT imported anywhere): one or more stage packs (one is free),
  **Musical Motions** (UrsaAnimations: playing animations and instrument props, URP; its store picture shows
  double bass, trumpet, drum kit, saxophone and keyboard) and **Female Lounge Singer** (RamsterZ: singing
  animations). He may also buy **Musical Instruments Pack** (NOT_Lonely: electric guitar, bass, drum kit,
  microphone and stand, guitar stack, monitors). Import whichever of these are in the cache, with the same
  version, error and URP checks as section 0.
- Build the band from them: the stage (pick the stage pack that suits a beach event and show Rob the others),
  musicians taken from Citizens Pro in beach-appropriate clothes, each on an instrument that Musical Motions
  has a playing animation for, and a singer at a microphone if a microphone model is there.
- First report exactly what each pack contains: every animation clip and every instrument model. A musician
  is only added where the animation and the instrument match. Do not fake a player with an unrelated
  animation, and do not show an instrument nobody plays. List anything missing for Rob.
- Check both animation packs retarget to the Citizens Pro rig before building on them.
- The band plays (animates) while a song is playing and stands idle between songs and when the music is skipped
  or muted. The band is scenery: well back from the court, in the camera keep-out, and inside the frame-rate rule.
- Proof: a close picture and a match-distance picture of the band, and a short note on how each musician looks
  in motion.

**6f. Crowd stands.** Rob asked whether the stands can be fixed or need a new asset. He has not yet said what is
wrong with them. As surveyed there are two stands, each about 14 m long, 6.4 m deep and 4 m high, both on one
side of the court. Plain bench stands are simple shapes and can be built without buying anything.
Wait for Rob to say what he wants before changing them.

**6g. Wearables and props already owned.** Go through every pack in `Assets` and list what could be worn or
placed: hats, sunglasses, towels, bags, jewellery, drinks, umbrellas. Give the pack, the item, its triangle count
and whether it is a separate object. This feeds the store (D4) and the scenery.

## 7. Ideas raised, NOT decided. Do not build.
- **Store items Rob is collecting:** hats (Hats Collection, Santa Hat Pack, a free cowboy hat on his Asset Store
  list), plus ideas for ball skins, ball trails, celebration emotes from the unused KAWAII animations, and
  seasonal sets. When the store is built, produce a fitting sheet: every hat on a player, front and side.
