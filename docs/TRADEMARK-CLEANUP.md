# Trademark cleanup — 19 Oct 2026

Branch `fix/trademark-cleanup` (worktree `C:/vbe-tm`). **Nothing built or packaged, nothing uploaded.**

**Branch base: `update-1` at 7649b762, not `main`.** The brief said "off main". But `main` (2c17431e) is 403 commits behind `update-1`, and `update-1` is what 1.1.x ships from. A branch off `main` would have missed most of the Olympic text and the 1.1.x code the boot fix runs in. The branch merges straight into `update-1`. The main tree's uncommitted new-seniors work was not touched: everything here was done in a separate worktree.

## Read this first: what is still NOT clean

1. **FIXED (19 Oct evening): the "BEACH VOLLEYBALL WORLD TOUR" wall text is gone from all 205 senior cards** (Rob's set in Downloads/BVE-fixed-seniors, commit "Remove World Tour wall text from all senior cards"). I checked contact sheets of all 205 and zoomed into the cards that had the biggest or extra banners (USA 01, Australia 03, Tahiti 03, Argentina 01, Uruguay 01/03, Zimbabwe 02, Guyana 01): every wall is plain. The only trace left is faint, unreadable glow smudges low on the left wall of the Uruguay cards. Also checked for wall writing or tour emblems, and none were found: the 96 AI-club cards (`seniors/ai/`), the 121 graduates and the 428 staff/manager portraits. The manager backgrounds show invented club signs (03 "…KERS …BALL CLUB" with a gold wave emblem, 04 "L…" with a blue wave, 15 "…KE …CLUB", 19 "OCE… BEACH V…" with a wave, 35 "…AZAR …BALL CLUB", 66 "MEDIC…"): no World Tour wording, no swirl ball. 12 graduate/AI cards hold a plain blue/yellow/white ball with no text or logo (Mikasa-like colours only): graduates africa_05, 08, 09, 10, 11, oceania_06, 14; AI afm_07_p2, asi_01_p2, asi_03_p1, asi_05_p1, asi_08_p2.
2. **A small chevron logo sat on many bikinis** (e.g. both Taiwan cards, before the final copy). It looked like a sportswear brand mark (Macron-style). On the final cards I zoomed into, it is gone.
3. **FIXED (19 Oct night): the 3D match ball.** New base colour (white/blue/yellow, no emblems), the old emblems flattened out of its normal map, the letters and swirl sculpted into its mesh smoothed away (BallMeshSmoothing), and the normal map imported as a normal map. Six views around the ball show no letters, no swirl, no blotches. See 4b.
4. **STILL OPEN, Rob's call: "World Tour" is the game's own competition name** (93 player-visible strings in the code, plus every save's stored competition names, trophies and news; not changed) (World Tour rounds, World Tour ranking points, the rules page, the news). The brief did not list it, so I changed nothing. It is the FIVB circuit's old name ("FIVB Beach Volleyball World Tour", now Beach Pro Tour). The plain words are generic (ATP, UCI and others use them), but together with "Beach Volleyball" on the cards it points straight at FIVB. Your call.

## 1. "Olympic" → "Empire Nations Cup" (display text only)

Keys, table and column names, routes, query keys, test ids and code identifiers are unchanged (`olympic_gold`, `olympic_medals`, `/olympics`, `isOlympicYear`, ...). Saves and Steam API names keep working.

Wording used: "Olympics"/"Olympic Games" → "Empire Nations Cup"; "Olympic gold/silver/bronze/medal(s)" → "Nations Cup ..."; "Olympic year" → "Nations Cup year"; "Olympian" → "Nations Cup player"; "an Olympic podium" → "a Nations Cup podium".

| Where | Was | Now |
|---|---|---|
| Side menu section (shell.tsx) | Olympics | Empire Nations Cup |
| Rules page | Olympics section title, "The Olympics are for national teams", "Played in Olympic years only", "the Olympic medal in its trophy cabinet", "regional league to Olympic gold" | Empire Nations Cup / Nations Cup equivalents |
| Qualifying page + dashboard widget | Olympic Qualifying | Nations Cup Qualifying |
| Schedule page | Olympic Games {year}, "The next Games are in", "{year} Olympic Beach Volleyball" | Empire Nations Cup {year}, "The next Nations Cup is in", "{year} Empire Nations Cup" |
| National Squads | "At the Olympics each nation..." | "At the Empire Nations Cup each nation..." |
| Annual calendar | Olympic Qualifier, Olympics, 🏅 Olympic Season | Nations Cup Qualifier, Empire Nations Cup, 🏅 Nations Cup Season |
| Dashboard | Olympic Gold/Silver/Bronze labels, "Olympic" and "Olympics" chips | Nations Cup ... |
| Trophy cabinet | Olympic Medals (stat, tab), "Olympic medals won by...", Total Olympic Appearances, Olympic Campaigns, "No Olympic campaigns yet", "...in the Olympics section", Olympic Medals Total | Nations Cup ... / Empire Nations Cup section |
| Profile, Retire modal | Olympic Medals | Nations Cup Medals |
| Career history | Olympic Medal | Nations Cup Medal |
| League ladders | Olympic Golds, "Olympic" column | Nations Cup Golds, "Nations Cup" |
| Manager records | Olympic golds (your players) | Nations Cup golds (your players) |
| Club hall of fame badge | "{n} Olympic gold(s)" | "{n} Nations Cup gold(s)" |
| Facilities | Olympic prestige, Olympic Prestige, "influences Olympic selection" | Nations Cup ... |
| Facility name (lib/db facility-names.ts) | Olympic Performance Centre | Nations Cup Performance Centre |
| Youth/scouting/team cards: elite event badge | Olympic Wonderkid | Nations Cup Wonderkid (new `src/lib/elite-event.ts`: the stored value and API enum stay "Olympic Wonderkid", only the drawn label changes) |
| Scouting report texts (server) | "compete at Olympic level", "OLYMPIC CALIBRE.", "FUTURE OLYMPIAN.", "an Olympic podium" | Nations Cup level, NATIONS CUP CALIBRE., FUTURE NATIONS CUP PLAYER., a Nations Cup podium |
| Trophies written (utils/olympics.ts) | "Olympic Gold 2028 — Brazil", "Olympic Games 2028" | "Nations Cup Gold 2028 — Brazil", "Empire Nations Cup 2028" |
| Club News (news.ts) | "{nation} win Olympic gold {year}" | "{nation} win Nations Cup gold {year}" |
| Events list / calendar (events.ts, calendar.ts) | 🏅 Olympic Games {year}, Olympic Games | 🏅 Empire Nations Cup {year}, Empire Nations Cup |
| Retirement summary (careers.ts) | "...and N Olympic medal(s)" | "...and N Nations Cup medal(s)" |
| Starter staff (scripts/src/seed-staff.ts) | Olympic Gold Medallist, Olympic Weightlifting & Power | Nations Cup Gold Medallist, Competition Weightlifting & Power |

### Achievement display names to change in Steamworks

The keys / Steam API names are unchanged (`olympic_gold`, `double_olympic_gold`). Only the display text changed; please mirror it in Steamworks (all languages you have set):

| API name | Display name: was → now | Description: was → now |
|---|---|---|
| `olympic_gold` | Olympic Gold → **Nations Cup Gold** | "Have a player from your club win Olympic gold." → **"Have a player from your club win Nations Cup gold."** |
| `double_olympic_gold` | Back-to-Back Gold (unchanged) | "Have players from your club win Olympic gold at two Games." → **"Have players from your club win Nations Cup gold at two Nations Cups."** |

Check the Steamworks texts themselves too. They were typed there by hand and may differ from the game's.

### Saves already on players' machines: boot fix

`artifacts/api-server/src/utils/trademarkRenames.ts`, called at boot from `index.ts`, right after the reference corrections. It rewrites capitalised whole words only (Olympic, Olympics, Olympic Games, Olympian(s), OLYMPIC..., "an Olympic" → "a Nations Cup") in these stored text columns:
trophies.name/notes, career_history_entries.description, finance_transactions.description, manager_season_summaries.world_result/continental_result, staff.specialty/special_trait/coach_speciality, youth_prospects.scouting_report_text, continental_scouting_missions.report, promo_deals.description/appeal_reason, career_saves.leaving_reason, career_pool_team_state.vacancy_reason, olympic_matches.label, seasons.name.
Lower-case keys are never matched. `elite_event_type` is not in the list. A player named "Olympia" is not a whole-word match. It is idempotent: the second boot changes nothing and logs nothing.

Not stored, so nothing to fix: Club News, events and calendar titles are built when read, and achievements are stored by key only.

The starter DB `lib/db/volleyball-empire.sqlite` still has 5 staff text values with "Olympic" (Olympic Gold Medallist ×3, Olympic Weightlifting & Power ×2). I deliberately did not rewrite that binary here: the main tree has an uncommitted starter DB change (new seniors), and two binary edits can't be merged. The boot fix rewrites these on the first boot of every new install, before the server listens. If you want the shipped file clean as well, boot a server once on it after the merge, or run the rename on it.

**Harness:** new suite `harness/trademark-renames.mjs` (port 4996), added to run-all as 98zt. It plants old rows into a copy of your 2 Oct backup (or the starter DB if that's missing): trophies, a history line, a ledger line, a scouting report plus elite event, a season summary, a player named Olympia. Then it boots twice. **14/14 PASS** on this branch: every line renamed, keys kept, no whole-word Olympic left in any text column of the save outside key columns, and the second boot changes nothing and says nothing. The other suites were searched for checks on the old wording: none assert it (olympics-tournament checks the news by id and winner nation, not by text).

Typecheck: libs, api-server and frontend `tsc --noEmit` all clean. `check:captions` passes.

### Grep of the built output for /olympi/i

Built in this worktree only (api-server `build.mjs`, frontend `vite build`, no sync:public, no package).

- **Frontend bundle** (`dist/public/assets/index-*.js`): every remaining hit is a route (`/olympics`, `/competition/olympic-schedule`, `/api/olympics/*`), a react-query key, a `data-testid`, a field name (`olympicMedals`, `olympicGolds`, `isOlympicYear`, `olympicsYear`), a type key (`olympic`, `olympic_qualifier`, `olympic_gold`), a tab value (`olympics`), the `"Olympic Wonderkid"` lookup keys (label shown is "Nations Cup Wonderkid"), and the finances colour key `Olympics` (a lookup key nothing produces; never drawn). **Player-visible hits: 0.**
- **api-server bundle** (`dist/index.mjs`): capitalised strings left are `"Olympic Wonderkid"` (the stored enum value; never drawn as such) and four server log lines ("Olympic season flags corrected", "correcting Olympic season flags failed", plus the two new boot-fix log lines). These go to the log file, not the screen. **Player-visible hits: 0.**
- In Electron there is no address bar, so `/olympics` routes are not seen.

## 2. Brand-name grep

Searched case-insensitively, whole word: FIVB, Mikasa, Molten, Wilson, AVP, "Beach Pro Tour", "Volleyball World", Swatch, Nike, Adidas, Puma, Mizuno, Errea, Macron, Hummel, Speedo, Red Bull. Locations: all tracked text in the branch (src, data JSON, seed scripts, docs, harness), the starter DB (every text column), the Unity WebGL build (`unity-build/Build/*.data/.wasm/.js`, `unity-build/index.html`), public/ text files, electron/, the main tree's uncommitted and untracked files, and `steam/store-assets` (two PNGs, no text files).

| Hit | Where | Player-visible? | Action |
|---|---|---|---|
| `outfit-swatch-${id}` | beach-volleyball/src/pages/team.tsx (test id) | No | none |
| "FIVB vocabulary" / "FIVB names" | scripts/check-captions.cjs, scripts/captions.json note, docs/caption-audit.md, docs/triage.md | No (dev comments/docs) | none |
| "red Nike runner" comment + Unsplash URL for sponsor "AirJump Footwear" | scripts/src/seed.ts (old seed script) | No: the starter DB holds no Unsplash URL at all, so the script's pictures never reach the game | none |
| "Wilson" (Dr. Andrew Wilson, Christine/Brenda/Emma/Morgan/Alyssa/Ella Wilson) | staff/medical data, generators, seed scripts, starter DB staff row | Surnames: fine per brief | none |
| "AVP" / "avp" / "Macron" | Unity .data/.wasm | No: random bytes in compressed data, and font glyph names (macron = the accent mark) | none |
| docs/DAYTIME-STATUS-02OCT.md line matching | dev report | No | none |

**No player-visible brand text was found, and no text needed fixing.** The brand problems are all in pictures (see "What is still NOT clean", and part 4).

## 3. Leftover images

`public/player-vera-petrakis.webp` and `public/opengraph.jpg` are referenced nowhere: not in src, index.html, CSS, electron, the starter DB, or the api-server. "Vera Petrakis" appears only in the old seed scripts as a name with an Unsplash URL. **Both deleted.**

## 4. Unity 3D ball (report only, nothing changed)

- Scene: `Assets/BeachVolleyball V19.unity` (the only scene in the build settings). The ball is the GameObject with `BallController`, a prefab instance of `Assets/my assets/Environment/ball/tripo_convert_12743fa7-8708-4a36-9a84-3f527b047c88.fbx` (a Tripo AI-generated model). It uses the FBX's own material, with no override in the scene.
- Texture: `.../tripo_convert_12743fa7-....fbm/beachvolleyballball3dmodel_basecolor.JPEG` (4096×4096), plus metallic/normal/roughness maps.
- **What it shows:** no legible text: no "MIKASA", no "FIVB". But:
  - four white emblem marks on the blue panels: two are **a swirl wrapped around a ball** (the same kind of swirl volleyball emblem the second brief describes on the staff shirts), two are garbled letter-like shapes, i.e. an AI imitation of a printed logo and word mark;
  - the whole ball is **yellow and blue curved panels**, the look of the Mikasa beach ball (VLS300 / V200W colourway).
- 19 Oct: the four texture files were copied unchanged to `Downloads/BVE-ball-texture/` (basecolor 908,278 B, metallic 479,282 B, normal 394,737 B, roughness 490,858 B; all 4096×4096 JPEG). The FBX references all four (DiffuseColor, NormalMap, and reflection/shininess slots).
- Suggestion: repaint the base colour (remove the four white marks, ideally change the colours or the panel shapes away from Mikasa's), then re-export WebGL. That needs the Unity Editor licence sign-in (it lapsed: see earlier reports).

### 4b. Ball texture swapped (19 Oct evening)

- Original base colour backed up to `Documents/BVE-image-backup-19oct/unity-ball/`; Rob's new `beachvolleyballball3dmodel_basecolor.JPEG` (4096×4096, white and blue panels with yellow outlines, no emblems, no text) put in its place. Metallic, normal and roughness maps not touched. Unity commit a578d70 on `feat-manual-controls` (pushed), with a new batch proof `BallTextureProof`.
- Unity reimported it (batch mode). The ball's material (`tripo_mat_12743fa7`, URP Lit) uses the new texture, imported at 2048×2048 (its import cap, as before). Pictures: `docs/proof-19oct/ball/` (two close-ups frozen on a serve, plus the match camera).
- **Normal map fixed (19 Oct night):** the four embossed emblems in `beachvolleyballball3dmodel_normal.JPEG` were flattened to the surrounding flat normal, and the panel seams kept (before/after: `docs/proof-19oct/ball/normal-map-emblems-before-after.png`; original backed up in `Documents/BVE-image-backup-19oct/unity-ball/`). Unity commit 3705a8f. Re-exported (WebBuild.Step7 Succeeded; only `.data` changed, 267,932,085 B), copied in, Brotli regenerated (data.br 216,371,782 B) and checked.
- **Still on the ball: letters and a swirl sculpted into the mesh.** Six views around the ball (`ball-six-views-after-normal-fix.png`) still showed raised garbled letters and a swirl-around-a-ball on the blue band. Rendered again with the normal map switched off (`mesh-relief-normal-map-off-px.png`, `-nx.png`), they are still there: they are geometry in the Tripo FBX (`tripo_convert_12743fa7-....fbx`), not texture. No texture change can remove them. Options: smooth the two areas in the mesh (Blender sculpt, or an editor script that relaxes those vertices), or swap the match ball for a clean model (the `Volleyball_Set_1` pack's balls carry only a generic "Volleyball" word). They are invisible from the match camera, where the ball is a few pixels across.
- WebGL export: `WebBuild.Step7`, Succeeded (1 error, the old IDA_Skin gles3 sampler-limit one that earlier exports also log). Only `.data` changed (267,974,607 bytes); `.wasm`, `.framework.js` and `.loader.js` are byte-identical to the deployed ones. Copied under the deployed names into `public/unity-build/Build/`; Brotli regenerated (data.br 216,422,569 B, wasm.br 8,999,034 B; both checked to decompress to the exact files). `verify-unity-brotli` will pass once the frontend is rebuilt (it checks dist/public, which is not built). **Not built, not packaged.**
- **Mesh smoothed (19 Oct night):** `Assets/Editor/BallMeshSmoothing.cs` (an AssetPostprocessor for this one FBX; the .fbx file itself is unchanged and backed up) puts the 1,011 vertices in the four old emblem areas back on the ball's surface. BallMeshSurvey: vertices raised over 1.5 mm in the four areas went from 82/57/106/63 to 1/2/1/0. With the normal map switched off, the six views are smooth.
- **Normal map import fixed (19 Oct night):** the normal JPEG was imported as a Default sRGB texture, so URP read its flat blue as a strong tilt. Through the mesh's tangent frame, that tilt drew the old letter shapes and the dark jagged blotches even after the mesh was smoothed. It is now imported as a normal map (the setting the project's other normal maps use). Six views with everything on: no letters, no swirl, no blotches (`docs/proof-19oct/ball/ball-six-views-final.png`). Unity commit 4d25b9a. This also changes the ball's look a little: smoother and cleaner panels.
- The decor balls by the court (racks and baskets, `Volleyball_Set_1` asset pack) carry only a generic "Volleyball" script and the pack's own small emblem; no Mikasa/FIVB.

### 4c. Courtside advert boards (20 Oct)

- **Found:** the match scene's 18 courtside boards were three Tripo "advertising banner" models. Their textures were cut-up real adverts: one was a Timex watch advert (watch faces, "TI", "MEX", "WHAT'S NE…"), one had red/blue script logos, one was yellow with "Sen…". Their meshes also had the adverts sculpted in: script lettering, a circled "V" emblem like the Volleyball World/FIVB mark, a player silhouette, and a 3D watch (`docs/proof-20oct/boards/before-relief-*.png`).
- **Textures:** each model's four textures are now plain (white base colour, flat normal map). Originals are backed up in `Documents/BVE-image-backup-19oct/unity-boards/`. The normal maps are now imported as normal maps.
- **Meshes:** `CourtsideBoardMeshes` (AssetPostprocessor, these three FBX files only; the files themselves are unchanged) turns each mesh into a plain A-frame board of the same footprint, with 18 vertices and flat faces.
- **Colours:** `CourtsideBoards` (runtime) paints them per match from the kits the loader applies. On each club's half, the side boards take its primary colour and the end boards its secondary. The fallback is the loader's blue/white vs red/white.
- **Proof:**
  - Unity commits 7334c26 (boards) and c2823cf (build-report check).
  - The build report lists only the plain 256 px textures and the 18-vertex boards from those folders (`docs/proof-20oct/boards/board-assets-in-build.txt`); the `.data` is 9.5 MB smaller.
  - Game commit 982bc4e8. In the packaged game: plain blue (Sydney Riptide) and green (Athens Aegean Stars) boards.
  - Note: the export changed `.data` and `.wasm` (the loader now paints the boards). The `.framework.js` and `.loader.js` changed too, because they carry the `.wasm` size; the commit message wrongly says those two were identical.

## 5. Also on this branch (jobs 2 and 3)

- Final cards: 198 senior cards + `images/youth/player_youth_card_01.webp`, commit 362df513 "Final logo cleanup: 198 senior cards + youth card". These replace the 100 from 757581ce. All 199 have the same pixel size and format as the files they replaced. Originals: `Documents/BVE-image-backup-19oct/{seniors,youth}`. captions.json: 197 re-pinned; `peru_04` has no caption row and is referenced nowhere in the code. Proof: mean difference 0.3-1.9 of 255 against its own original, 4.7-48 against any other card.
- Earlier: 100 fixed senior cards, commit 757581ce "Replace Mikasa/FIVB balls and wall emblems on senior cards". Backup of the replaced files: `Documents/BVE-image-backup-19oct/seniors`. Exactly 100 replaced, all with the same pixel size and format. `scripts/captions.json` re-pinned (the fixed cards are proven to be the same players: `docs/proof-19oct/senior-cards-ball-fix-check.json`), so check:captions passes. **But see the top of this doc: the wall text is still on them.**
- Job 2 (staff/manager logo paint-out): see `docs/STAFF-LOGO-CLEANUP.md`.
