# Update 1: fixes before upload (Rob, 16 Oct)

Branch **update-1**. Nothing pushed, nothing uploaded to Steam. Rob's save was never opened.

There were two rounds today. The morning's two fixes are further down. This evening's three fixes come from Rob's on-screen check of 1.1.0.

# Evening: Rob's on-screen check of 1.1.0, three fixes

## Summary

**All three are done. 1.1.0 is repackaged into `C:\build\vbe-1.1.0\win-unpacked\` from `a09c6d54` and proved running, sound included. Not uploaded.** The Steam script's Desc names `a09c6d54`.

| | What | Commit |
|---|---|---|
| 1. The silent match | **Found by measuring:** when the focus leaves the 3D court, the court stops dead: picture and all its sound, until it gets the focus back. A click on the bar above the court does it, and so does a click on another window. **Fixed on the court's own page.** No Unity rebuild was needed. The sliders and the music's mute were never the cause (measured below). | `f078c96a` |
| 2. Master volume | At the top of Settings > Sound, over the music, the crowd and the commentary. Done on the page side. | `f078c96a` |
| 3. Settings over the match | A **Settings** button beside Leave match opens Sound (master, music, crowd, commentary) and Controls (Auto / Manual and the controls table) over the match. Changes apply at once. | `f078c96a` |
| Suites | settings 33/33, music-playlist 28/28, court-finish 11/11, court-page 10/10 (alone) | `f078c96a`, `a09c6d54` |
| Package and proofs | Package proof (draft, a whole 3D match, Settings); the packaged sound proof, every slider: 34/34; the court with the focus off it: 36/36; the Chrome court proof: 14/14 | this commit |
| Steam script | `"Desc" "v1.1.0 Update 1 (update-1 a09c6d54)"` | this commit |

## 1. The silent match: what was measured

Two meters, both read-only:
- **The court's own output.** Every Web Audio node the court connects to the speakers goes through an analyser (`scripts/webgl-proof/court-audio.mjs`).
- **What Windows receives from the game.** The game's audio session on the default output device: its peak meter, its Volume Mixer level and its mute (`scripts/webgl-proof/windows-audio-meter.ps1`, new). This is after everything inside the game, so it's what goes to your speakers.

**Rob's settings, in the packaged 1.1.0 from this morning** (`scripts/webgl-proof/package-sound-proof.mjs`, real exe, throwaway profile). Logs are in `docs/proof-update1-16oct/investigation/`.

| Case | Court peak | Windows peak |
|---|---|---|
| Crowd 0, commentary 100, the music muted, stored before the match | 0.87–0.89 | 0.89–0.93 |
| The same, with the sliders set on the Settings page itself (its sliders and Mute) | 0.87 | 0.92 |
| The same, in Manual, before and after an Esc pause (silent while paused, as it should be) | 0.89 / 0.92 | 0.89 / 0.92 |
| Leave a match (forfeit), set crowd 0, watch the next match | 0.92 | 0.92 |
| Commentary alone, crowd alone, both 0 (silent), both 100, changed during the match | heard / heard / 0 / heard | the same |

The game's audio session sat at 100% in the Windows Volume Mixer, not muted, every time. **So the commentary always played with the crowd at 0, and the music's mute never touched the court.** The mute is the music element's own flag. Nothing links it to the court, in the code or in the measurement.

**The one silencing path found: the focus leaving the court.** With the court playing (crowd 0, commentary 100, music muted), the focus was moved to the bar above it, as a click there does:

| | Court peak | Windows peak | The court's picture over 4 s |
|---|---|---|---|
| Before (the focus on the court) | 0.89 | 0.90 | moving |
| **The focus off the court** | **0** | **0** | **didn't change: stopped** |
| The focus back on the court | 0.90 | 0.90 | moving |

**Cause:** the Unity build has *Run In Background* off (`ProjectSettings.asset runInBackground: 0`). In a WebGL build that means the court pauses, sound and all, whenever its window loses focus. Any of these would do it:
- a click anywhere outside the court picture (the bar, the Leave match strip);
- a click on another window or the taskbar, the Windows volume control included;
- Alt-Tab.

The court only comes back when it gets the focus again. It also explains item 3: Settings opened over the match would have taken the focus and stopped it.

**I couldn't make your exact report (no sound with the match still moving) happen any other way.** If your match froze when it went quiet, this was it. If the match kept moving with no sound, tell me what you clicked or changed just before, and I'll measure that case.

**The fix** (`artifacts/beach-volleyball/public/unity-build/index.html`): the court's own page keeps the window's blur from reaching Unity. Unity's blur handler is on that window, and the page's script runs before Unity loads. Measured again on the final package (`docs/proof-update1-16oct/package-focus-off/`): with the focus off the court it **kept playing** (the picture changed) and was **heard (court and Windows peak 0.90)**. It was heard again with the focus back on.

**Why not Unity's own setting:** I turned Run In Background on in the Unity project and ran the 15 Oct batch export. It stopped at once: **"No valid Unity Editor license found"** (exit 198, "Access token is unavailable"). The Unity Hub sign-in on this PC has lapsed. I reverted the Unity project; nothing there changed. The page-side fix needs no rebuild, which is what you preferred anyway. If you ever want it in Unity itself, sign in to Unity Hub first.

**What changes for you:** the match now carries on while you're in another window, or with the focus off the court. Before, it froze. In Manual, Esc still pauses. One small side effect: in Manual, a key held down at the moment you click off the court (W, say) may keep acting until you press it again. That's because the court no longer hears the focus leave.

## 2. The master volume

- **Settings > Sound** now starts with **Master volume** (0–100%, 100% for everyone at first). Then come the music (Mute and volume), the crowd and the commentary.
- The master is applied on the page side, so there's **no Unity change**:
  - **the court** is sent crowd × master and commentary × master (`courtVolumes`, `lib/court-settings.ts`);
  - **the music** plays at its own volume × master (`music-provider.tsx`) and follows the master straight away.
- It's stored with the court's volumes, in the same settings object.
- **The music's Mute mutes only the songs.** Its note says so on screen.

## 3. Settings over the 3D match

- A **Settings** button sits beside **Leave match** above the court. It opens a panel over the match, and you never leave the court:
  - **Sound:** master, music (Mute and volume), crowd, commentary;
  - **Controls:** Auto / Manual and the controls table.
- These are the same panels as on the Settings page (`components/sound-settings.tsx`, `components/controls-settings.tsx`), so the two can't drift apart.
- **Every change applies at once.** A volume goes to the court as you drag. Auto / Manual goes to the court straight away and is remembered.
- The music's line says "The songs stop during a match and come back after it", because the songs fade out on the court as before.
- **×, Esc, or the Settings button again** closes the panel, and the keyboard goes back to the court.
- The match keeps playing, with its sound, while the panel is open (the fix in 1).
- The Settings page's Controls note now mentions the gear above the court.

## The suites (alone, on the build of `f078c96a`)

| Suite | Result | What changed |
|---|---|---|
| settings | **33/33** | Its source checks follow the shared panels. New section 7 (the master: first on Sound, the court gets each volume × master, the music plays at its volume × master, the mute is the songs' alone). New section 8 (the gear, the panel over the court, nothing in it leaves the court, Auto / Manual to the court, closing gives the keyboard back, the blur kept from Unity before Unity loads). The first run was 32/33: my own new mute check was wrong (it matched Tailwind's `text-muted` class), fixed in `a09c6d54` |
| music-playlist | **28/28** | "Leaving the court plays the next song at the normal volume" now reads the volume × master |
| court-finish | **11/11** | — |
| court-page | **10/10** | — |

No other suite was run.

## The rebuild and package (this morning's way)

1. `pnpm run typecheck && pnpm -r --if-present run build && pnpm run sync:public` (passed). The Unity `.br` files were reused, because the Unity build didn't change.
2. `artifacts/api-server/dist/public` stripped. This morning's package deleted, and its proof kept as `C:\build\vbe-1.1.0\proof-0cde84d9\`.
3. `npx electron-builder --win dir "-c.directories.output=C:\build\vbe-1.1.0"`, from **`a09c6d54`**.

Every packaging check passed:
- only Brotli Unity files;
- better-sqlite3 under Electron;
- the starter DB alone;
- no `steam_appid.txt`;
- steamworks.js unpacked.

The package is 1,425 files and 622 MB. The blur fix is in the packaged court page, and the panel is in the packaged frontend.

## The proofs on the final package (`C:\build\vbe-1.1.0\proof\`)

**The package proof** (`package-proof.mjs`, as last night): new profile and career, the Day 1 draft in the UI ("Senior wages $32,500 of $60,000"), days to the match day, a whole 3D match (won 2–0, 11–9 and 16–14, in 7.3 min), "Result saved.", Continue, the dashboard, the next match day (22 Feb), Settings. All 12 screenshots taken. **Your save is unchanged.**

**The sound proof, every slider** (`package-sound-proof.mjs`, `proof\sound\`, a copy in `docs/proof-update1-16oct/package-sound/`): **34 of 34**.

| Step | Element / court gets | Court peak | Windows peak |
|---|---|---|---|
| Settings: master first, then music, crowd, commentary; master at 100% | | | |
| Music 40%, master 100% (only the music plays here) | 0.4 | — | 0.16 |
| Master 50% | music 0.2 | — | 0.09 |
| Master 0% | music 0 | — | **0** |
| The music's Mute | muted; nothing else stored changed | — | **0** |
| Your sliders: crowd 0, commentary 100, music muted. The match, as stored | 0 / 1 | 0.90 | 0.90 |
| **Settings opened over the match**, the focus on its slider: the match carries on (picture changes) | | 0.90 | 0.90 |
| Commentary alone (crowd 0) | 0 / 1 | 0.92 | 0.92 |
| Crowd alone (commentary 0) | 1 / 0 | 0.16 | 0.18 |
| Both 0 | 0 / 0 | **0** | **0** |
| Master 0, both 100 | 0 / 0 | **0** | **0** |
| Master 50%, both 100 | 0.5 / 0.5 | 0.48 | 0.50 |
| Everything 100 | 1 / 1 | 0.90 | 0.91 |
| Manual, then Auto, from the panel | the court's log: "mode Manual (page)", "mode Auto (page)"; remembered | | |
| Closed: the keyboard back on the court | | 0.85 | 0.86 |

Still on the court throughout, no page errors, and your save is unchanged.

**The court with the focus off it** (`--blur`, `proof\sound-focus-off\`): **36 of 36**. Kept playing and heard (0.90) with the focus on the bar above it.

**The Chrome court proof** (`sound-volume-proof.mjs --gpu --start=0,1 --music-muted`, on the built server, `docs/proof-update1-16oct/`): **14 of 14**. Commentary alone, crowd alone, both 0 silent, all with the music muted.

Windows' device volume read 78% for most of the day and 100% in the final runs. Something outside the proofs changed it; the meter only reads.

## The Steam upload

Same steps as `docs/STATUS-UPDATE1-NIGHT2.md`, "The Steam upload". The repo's `steam/app_build_5233750-1.1.0.vdf` now says `"Desc" "v1.1.0 Update 1 (update-1 a09c6d54)"`. ContentRoot is still `C:\build\vbe-1.1.0\win-unpacked\`. Your Steamworks scripts folder was not touched. **Not uploaded.**

## What to check on screen

1. Settings > Sound: Master is at the top, and moving it changes the music.
2. A 3D match with crowd 0 and commentary 100: the commentators are heard.
3. During the match, click **Settings** above the court:
   - the match keeps going and the sound stays;
   - drag Crowd and Commentary and hear them change;
   - switch Auto / Manual;
   - close the panel, and the keys work on the court again.
4. Click another window during a match: the match and its sound carry on.

# Morning: two fixes before upload

## Summary

**Both fixes are done.** The five suites they touch pass alone. 1.1.0 is repackaged into `C:\build\vbe-1.1.0\win-unpacked\` from **`0cde84d9`** and proved running again. The Steam script's Desc names `0cde84d9`. **Not uploaded.**

| | What | Commit |
|---|---|---|
| Fix 1 | A 1-week injury doesn't count toward the 3-in-12-months reconstruction rule | `0cde84d9` |
| Fix 2 | The AI clubs' medic is a doctor or physio while one is spare; a massage therapist or specialist only after | `0cde84d9` |
| Package | `C:\build\vbe-1.1.0\win-unpacked\` from `0cde84d9`; proof in `C:\build\vbe-1.1.0\proof\` | — |
| Steam script | `steam/app_build_5233750-1.1.0.vdf`: `"Desc" "v1.1.0 Update 1 (update-1 0cde84d9)"` | this commit |

## Fix 1: 1-week injuries and reconstructions

The only 1-week injury is a cramp or strained muscle (leg, 40% of all injuries). Before this fix, two cramps in a year made the next leg injury a 30-week leg reconstruction.

- `RECONSTRUCTION.minBaseWeeks = 2` (lib/db `schema/injuries.ts`), next to the rule's other numbers.
- `injuriesInAreaTx` counts only injuries of 2+ base weeks (`utils/injuries.ts`).
- **A cramp is never the third either.** Two broken legs and then a cramp stay a cramp, not a reconstruction. "Don't count towards the rule" was read as both: a cramp is neither one of the three nor the third.
- **The player card's "Leg: N in the last 12 months"** counts the same injuries (`routes/medical.ts`), so its "one more there and it's a reconstruction" warning stays true. Cramps are still listed in her history.
- The Rules page and the patch notes add "1-week injuries don't count".
- Reconstructions already recorded keep their 30 base weeks, so they count as before.

## Fix 2: the Day 8 medic

- `AI_STAFF.firstChoice = [doctor, physiotherapist]` (`utils/aiStaff.ts`). While a doctor or physio is spare above the market floor of 5, a club's medic is one of those two, picked at random. A massage therapist or medical specialist is chosen only once doctors and physios are both down to 5.
- `fillAiStaffTx` is the only picker, so the same rule applies on Day 8, at an older save's boot deal, and to every gap filled later when a contract ends.

**Worth knowing:** a new career has only **32 spare doctors and physios for 60 clubs**. So 32 clubs get a doctor or physio, and the other **28 still get a massage therapist or specialist**. Those 28 have nobody to treat an ordinary injury (×2 time out) until a doctor or physio comes free. Every club still gets a medic (60 of 60). More doctor and physio portraits would close the gap. Lowering the floor of 5 that's kept for the player would too, but that's your call.

## The suites (alone, on the build of `0cde84d9`; staff absences off, as run-all runs them)

| Suite | Result | What changed |
|---|---|---|
| reconstruction | **16/16** (was 13) | New section 6: two cramps then a broken leg is a broken leg; her card counts the leg once; two broken legs then a cramp is a cramp (1 base week) |
| ai-staff | **23/23** (was 22) | New check: "32 doctors and physios of 32 spare, 28 massage therapists and specialists" |
| injury-treatment | **17/17** | — |
| staff-roles | **22/22** | — |
| ai-injuries | **16/16** | — |

No other suite was run, as asked. The full harness last ran on build #2 (`dcfcc450`, 114 of 118, each failure fixed and re-run alone).

## The rebuild and package (last night's way)

1. `pnpm run typecheck && pnpm -r --if-present run build && pnpm run sync:public`. This is `pnpm run build` without its last step, the full harness. That's because you asked for only the five suites. The suites ran on this build.
2. Last night's Unity `.br` files were reused: the Unity export hasn't changed since they were made (16 Oct 01:26, from the 15 Oct export). So `compress-unity-data.cjs` (9.6 min) would have made the same files.
3. `artifacts/api-server/dist/public` stripped. Last night's package deleted, and its proof kept as `C:\build\vbe-1.1.0\proof-1589736f\`.
4. `npx electron-builder --win dir "-c.directories.output=C:\build\vbe-1.1.0"`.

Every packaging check passed:
- only Brotli Unity files;
- better-sqlite3 loads under Electron's runtime;
- the starter DB alone in `resources/starter-db`;
- no `steam_appid.txt`;
- steamworks.js unpacked.

The package is 1,425 files and 622 MB, and the exe's version reads 1.1.0. Both fixes were found in the packaged server (`minBaseWeeks`, `firstChoice`) and the new Rules line in the packaged frontend. No other folder under `C:\build` was written.

## The proof (`scripts/webgl-proof/package-proof.mjs`, screenshots in `C:\build\vbe-1.1.0\proof\`)

The real packaged exe ran on a throwaway profile (`%TEMP%\vbe-1.1.0-proof-AVYY6H`), and the first screen was "No profiles yet". It went through:
- a new profile and career;
- the Day 1 draft in the UI ("Senior wages $32,500 of $60,000");
- days passing to the 17 Feb match day;
- a whole 3D match: Unity loaded in 4 s, lost 0–2 (5–11, 8–11), "Result saved.", Continue, back on the dashboard;
- the next match day (22 Feb);
- Settings.

All 12 screenshots were taken. **Your save is unchanged** (2,404,352 bytes, SHA-1 `10796c5e…`, before and after).

## The Steam upload

Same steps as `docs/STATUS-UPDATE1-NIGHT2.md`, "The Steam upload". The repo's `steam/app_build_5233750-1.1.0.vdf` said `"Desc" "v1.1.0 Update 1 (update-1 0cde84d9)"` this morning; the evening repackage replaced it (above). ContentRoot is still `C:\build\vbe-1.1.0\win-unpacked\`. Your Steamworks scripts folder was not touched.
