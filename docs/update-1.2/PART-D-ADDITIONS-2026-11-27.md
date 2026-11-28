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

## 5. The commentary team: CONFIRMED by Rob, Sat 28 Nov, 10 pm. Build it.
Rob's team, for the Exhibition Game AND the main game (career matches):
- **Kailey and Hukum**, the two resident commentators, as now. Nothing of theirs changes.
- **Nicole Dupont**, the sideline reporter: a French voice speaking English. She speaks only in breaks: the
  walk-on, the end of a set, the drinks break, before a deciding set, and when the match is won.
- **A celebrity guest in the booth, one per match:** **Roxy Calderwood** (action-comedy film star: "The Dog or
  Him?" and "Sabotage 3: We Didn't See It Coming") or **Kai Brennock** (a retired champion from another sport).
  Both are invented; no real person. ElevenLabs stock or designed voices only, never an imitation of anyone.

**The lines** are in `docs/update-1.2/COMMENTARY-TEAM-LINES.md`: 57 new lines with file names, when each is
said, and where Rob's voice samples are. Nothing is recorded yet. Rob records them.

**What to build:**
- The court knows the match's team: residents always; the sideline reporter on or off; the guest (Roxy, Kai or
  none). All from data, so a new guest later is a data change and a folder of clips.
- **Exhibition:** the player picks the guest on the pick screen (Roxy, Kai or no guest) and can switch the
  sideline reporter off.
- **Career matches:** the sideline reporter is on. The guest is Claude's default, for Rob to change: Roxy or
  Kai at random per match, with one switch in Settings, "Guest commentators", to turn them off.
- **When they speak.** A guest line follows the residents' call of the same play, never over it, and not on
  every point: at most one guest line in three points, and never the same line twice in a set. A sideline line
  is introduced by a resident hand-over line when one is recorded. Nothing is ever said during a rally.
- **The commentary tent (9e)** now has people in it: three seated at the desk (two residents and the guest)
  from Citizens Pro, and one more Citizens Pro person standing courtside with a microphone as Nicole. The
  "commentary booth" shot shows the three; add a "sideline reporter" shot for her lines.
- **Until Rob records a line, nothing breaks,** exactly as for B4's 42 lines: a missing clip is skipped in
  silence and the residents carry on. Once a clip is in the folder under its file name, it plays.
- Level every clip to the existing clips' loudness when it is added (Rob's samples differ by about 8 dB).
- Music: as section 9d. Never touch the songs.
- Proof: a harness check that walks every line in the sheet and names the clip it expects; a match log in each
  mode showing who would speak at each moment with clips missing; and the booth and sideline shots.

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

## 8. Demo 3, for Rob's friend (updated Sat 28 Nov, 8 pm)
Rob wants a demo with everything built so far in it: the band, the venue features, times of day, weather,
the drinks break, crowd banners, the Exhibition Game, and the three items in section 9 below.
**Do section 9 first, then make a new WebGL export, then package demo 3.**
**After demo 3 is packaged and proven, do section 5 (the commentary team), then section 10 (the five venues).**
- Output: `C:\build\vbe-1.2-demo-2026-11-28\`, version `1.2.0-demo3`, the same separate demo app and its own save
  folder as before. Never the real game, never Steam, never the live save.
- **Do NOT install it, uninstall anything, or touch the demo's save folder
  (`AppData\Roaming\Beach Volleyball Empire 1.2 Demo`).** Demo 3 has the same app id as demo 2, so installing it
  would replace the demo Rob is using and the install test moves his save aside. Rob installs demo 3 himself.
  So skip the install test this time and say plainly that it was skipped.
- Proof, in headless Chrome against the built files only: one whole watched career match (the band and booth
  shots, the drinks break, a banner in the crowd) and one Exhibition match started from the pick screen with a
  custom team in one of Rob's new prints and tinted sunglasses. Pictures of each, and the frame rate.
- In that Exhibition match, also prove the fix from this morning that was never checked in the browser: the
  songs play from the band's stage at the band's loudness (not full volume), and no career ceremony opens over it.
- Tests: the suites that cover what section 9 touches first (exhibition, store, played match, presentation),
  then the full harness, capped at 3 runs. It may run overnight.
- Update `DEMO-CHECKLIST.md` for demo 3: how to install it over demo 2, and a short "what is new to show"
  list (Exhibition Game from the title screen, the new prints and sunglasses, the band, V for the TV camera,
  times of day and weather, the drinks break between sets). Keep item 1, the real controller test.

## 9. Six items from Rob after reading your overnight report (Sat 28 Nov, 8 to 9:15 pm)

**9a. Tint the sunglasses.** The pack's sunglasses have clear lenses. Give them dark tinted lenses that still let
the eyes show faintly, as real sunglasses do. In the Exhibition pick screen and the store, the lens tint is a
choice alongside the frame colour: at least black, brown, blue mirror, amber and rose. Proof: a close picture of
a player in each tint, in sun and under the night lights.

**9b. Rob's swimwear prints** (updated 28 Nov, 9 pm: twenty-three swatches, the last of them, and Rob's colour rule).
Rob made the swatches himself. They are in
`C:\Users\rbonn\Game_Dev\VolleyBall Empire\1.2 props\swimwear-prints\` (each 1774 x 887). More may come, so
build this so that a new print is one picture dropped in a folder and one line in a data file, with no code change.

**Rob's rule: a print with three colours or fewer can have its colours changed by the player. A print with
more than three colours is shown exactly as painted, with no colour change.** He kept the designs simple for
this reason. Rob's own colours are each print's default. The pick screen shows a colour picker per colour
(one, two or three) for the changeable prints and none for the fixed ones.

| File | Colours | Colour change |
|---|---|---|
| `hibiscus-white-on-red.png` | 2 | yes |
| `hibiscus-red-on-white.png` | 2 | yes (the same flower with the colours swapped: one mask covers both) |
| `stripes-navy-white.png` | 2 | yes |
| `pinstripe-navy.png` | 2 | yes |
| `polka-dots-red-white.png` | 2 | yes |
| `houndstooth.png` | 2 | yes |
| `zebra.png` | 2 | yes |
| `tiger-flat.png` | 2 | yes |
| `cow.png` | 2 | yes |
| `palm-leaves-green-cream.png` | 2 | yes |
| `gingham-red-white.png` | 3 (red, pink, white; the pink is the two crossing) | yes |
| `camouflage.png` | 4 | no |
| `leopard-fur.png` | full colour | no |
| `tiger-fur.png` | full colour | no |
| `snakeskin.png` | full colour | no |
| `hibiscus-tropical-on-black.png` | full colour | no |
| `ditsy-floral.png` | full colour | no |
| `retro-floral-orange.png` | full colour | no |
| `tie-dye-rainbow.png` | full colour | no |
| `paisley-blue.png`, `paisley-green.png`, `paisley-pink.png`, `paisley-orange.png` | full colour | no: Rob made the four colourways himself. Show it as ONE print, "Paisley", with these four colour choices. These four are 829 x 464 |

- I counted the colours by eye. Count them properly from each picture and tell Rob if any count differs.
- **Rob's art replaces every code-drawn print of the same kind:** leopard, hibiscus, stripes, polka dots, palm
  leaves, camouflage, tie-dye and zebra. Remove the code-drawn versions (no dead code left behind).
- **Seams.** Measured edge to edge, most of these do not wrap. Close to tiling: `leopard-fur`,
  `hibiscus-tropical-on-black`, `camouflage`, `pinstripe-navy`. Clearly not: `cow`, `zebra`, both two-colour
  hibiscus, `palm-leaves`, `gingham`, `houndstooth` top to bottom, `polka-dots` top to bottom, `stripes` top to
  bottom, `snakeskin`, both tigers, `ditsy-floral`, `retro-floral`, `tie-dye`. No visible seam or hard join may
  show on a swimsuit. Fix it your way (mirrored repeat, blending the edges, or for the regular patterns
  cropping to a whole number of repeats) and show it. Do not repaint Rob's art; if a swatch cannot be made to
  work, say so.
- **Tie-dye** is one spiral, not a repeat: place a single spiral on the garment, do not tile it.
- **Scale.** The pattern must read at match distance and not look giant close up: about three or four leopard
  spots, or one hibiscus flower, across a bikini top; ditsy floral small, as on a real fabric. Show Rob the
  scale you chose for each.
- **The colour picker** (for plain swimwear and for every changeable print): offer bright full colours AND
  pastels, not just one muted set. At least twelve brights (red, orange, yellow, lime, green, teal, cyan, blue,
  navy, purple, magenta, hot pink) and twelve pastels (their soft versions), plus white, black and grey. Show
  the palette on the proof sheet.
- Cap the imported size (512 or 1024) so the download does not grow by the swatches' 40 MB.
- Proof: a new sheet like `proof/D6/d6-prints.png` with every print on a swimsuit and a bikini, close and at
  match distance; each changeable print also in a second colourway; and a close-up of a seam area for each.

**9c. The ball at the serve.** In the serve hold the ball rests at her head, so with a sun hat on it looks as if
the ball sits on the hat. You also noted that in Auto the ball floats beside the server's head before each
serve. Put the ball in her hand in the serve hold, in both played and Auto matches, clear of her head and of
any hat. This is where the ball is drawn while she holds it only: do not change the serve's flight, timing or
any match result. Rerun A1 and `--unity-full`, and show the serve hold with and without a sun hat.

**9d. The music: Rob's ruling.** Rob has approved what you built: the songs play from the band's stage and on
through the match. His one condition: the player must be able to turn the music down or off whenever they
choose, from the game's Settings and from the court's own settings during a match, and the choice is
remembered. If that control already exists and does this, prove it and change nothing. Never change, trim or
fade the songs themselves.

**9e. The commentary tent.** Rob does not want to generate a new model for this. Take a second copy of his
yellow lifeguard tower (`lifeguard-tower-yellow`, the light 19,940-triangle copy), recolour it, and use it as
the commentary tent in place of the scaffolding tower (6b). The yellow one stays as the lifeguard tower.
- **Colours: blue, white and orange, to match Rob's new T-shirt shop (9f).** Recolour by changing the
  texture's colours on a copy, not by repainting the model. Show it beside the T-shirt shop and the yellow tower.
- The desk and three seats go in it, and the TV camera's "commentary booth" shot points at it. If three seats
  do not fit, say how many do and show it.
- The scaffolding tower stays on file and in the venue data as an option, switched off.

**9f. Rob's remade props (updated 28 Nov, 9:35 pm).** In
`C:\Users\rbonn\Game_Dev\VolleyBall Empire\1.2 props\` as zips (FBX + textures, 4096 textures, 1 m as modelled).

| Zip | What | Triangles | Use |
|---|---|---|---|
| `vip-tent.zip` | marquee: a pyramid roof on four posts, open sides, white canvas, timber | 61,196 | **use it:** replaces the old VIP tent, which you found too rough up close |
| `ice-cream-cart-light.zip` | three-wheeled ice-cream cart with a canopy, blue and cream stripes | 32,532 | **use it:** replaces the untextured ice-cream cart; place it in the venue as a prop (data flag, like the others) |
| `ice-cream-cart.zip` | the same cart, heavier export | 62,898 | not used: on file only |
| `tshirt-shop.zip` | open timber stall with a pitched roof and shirts on racks, blue, white and orange | 65,576 | **use it:** replaces the old T-shirt shop ("clothing store"), which you found too rough up close. Rob meant to send a 35,000 export; if `tshirt-shop-light.zip` is in the folder when you get here, use that one instead |

- **The cart and the shop:** import into `Assets/my assets/Props 1.2`, cap the textures at 1024, real size.
  Keep the detail close up, as for the tent: the full model near the camera, a lighter `MeshReduce` copy at
  distance. Both textures have small patches of AI lettering (the shirts' labels, a red script on the cart):
  look close, and where lettering is mashed cover it the way you covered the kiosk sign, or say it is fine.
  The old T-shirt shop model stays on file, out of the scene. Proof: each beside a player at real size, close
  and at match distance.

**The VIP tent, two jobs:**
1. **Keep the detail.** Rob could only export it at about 600 or about 35,000 faces and chose detail. Do not
   replace it with one reduced copy. Use the full model when the camera is close and a lighter copy
   (`MeshReduce`, about 20,000) further away, switching by screen size as you did for the palms. Cap the
   textures at 1024. Put it at the old VIP tent's size and place.
2. **Square up the back.** Rob: "the back of the tent looks a bit drooped, square it up so it doesn't look so
   dropped off." Measured from the FBX (model units, Z up, 1 m tall, peak at the centre, 0.721 high):
   - the front (the -Y side) roof ends at Y = -0.40, where its edge is 0.40 high;
   - the back (the +Y side) roof is the same down to Y = +0.40 (0.399 high), but then carries on out to
     Y = +0.50 and falls to about 0.30 high: an extra tenth of the tent's length hanging a tenth of its
     height lower than the front. Along that back edge the corners sit lower again (0.306 against 0.36 mid-edge);
   - the two sides (X = +/-0.45) end about 0.31 to 0.34 high.
   Fix it on a copy of the mesh by moving vertices only (no new geometry, the texture mapping untouched): bring
   the back edge of the roof up and in so the back matches the front, level from corner to corner, and the
   tent reads as square from the side and from behind. Keep the back posts upright under the corrected edge.
   If the canvas stretches or tears visibly, say so and show it rather than hiding it.
   Proof: before and after from the side, from behind and from the TV camera, the two side by side.
   The original zip stays on file untouched.

- The commentary tent's colours (9e) are blue, white and orange, to match the T-shirt shop.
- The media tower is no longer needed (9e). **Rob says not to worry about the over-water bungalow: nothing
  may depend on it.**

## 10. The five venues still to build (Sat 28 Nov, 9 pm) - after demo 3
Rob has downloaded the packs you listed as missing, "plus a few extras that might help, like sand textures".
They are NOT imported into the project: as of 9 pm neither `Assets` folder had them. They are in the Asset
Store cache (`C:\Users\rbonn\AppData\Roaming\Unity\Asset Store-5.x\`), which now holds 36 publishers
(it held 4 on 27 Nov), among them Lylek Games, Nobiax Yughues, Tanuki Digital, Manufactura K4, Nature Library,
Baldinoboy, BitGem, RetroStyle Games, Mixall, Falcon3DStudios and 3D Everything.
- List every pack in the cache that is not in the project yet, check each download is complete, and import
  the ones a venue will use, with section 0's checks (Unity version, errors, URP). Report the rest unused.
- Build north_america, south_america, europe, asia and africa_middle_east to the looks in your own D1 audit
  table, each as its own venue bundle, with sections 2, 3 and 6 applied (one realistic style, the venue
  features by data flag, frame rate measured at every time of day).
- No continent faked with the same props recoloured. If a venue still lacks a piece after the new packs, build
  what you can, list the missing piece for Rob (he will make it in Tripo, he is buying nothing more), and say
  plainly how finished that venue is.
- Asia is built WITHOUT the over-water bungalow (Rob: do not worry about it). Use the downloaded packs for
  its resort lagoon. The VIP tent is Rob's new one (9f).
- Use the sand textures if they improve the court surround and the beach without costing frame rate; show
  before and after.
- Proof per venue: a wide picture, the TV look and one Game view at two times of day, the frame-rate table,
  and the bundle's size. Then one more demo package, `1.2.0-demo4`, to
  `C:\build\vbe-1.2-demo-2026-11-28b\`, under the same no-install rule as section 8.
- The full harness after this section counts toward the same cap of 3 runs.

