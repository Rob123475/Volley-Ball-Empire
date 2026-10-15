# Update 1: two fixes before upload (Rob, 16 Oct)

Branch **update-1**. Nothing pushed, nothing uploaded to Steam. Rob's save was never opened.

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

Same steps as `docs/STATUS-UPDATE1-NIGHT2.md`, "The Steam upload". The repo's `steam/app_build_5233750-1.1.0.vdf` now says `"Desc" "v1.1.0 Update 1 (update-1 0cde84d9)"`. ContentRoot is still `C:\build\vbe-1.1.0\win-unpacked\`. Your Steamworks scripts folder was not touched.
