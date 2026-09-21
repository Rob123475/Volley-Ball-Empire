# R-80 — full pre-push check (21 Sep 2026)

Rob asked for "a complete check on everything in the game to make sure it is error and bug free
before we commit and push." This is what was run, what it found, and what was fixed. Every number
below comes from a run in this batch. Nothing is estimated, and nothing is reported as passing that
was not seen to pass.

The live save was never opened. Gate 6 used a copy, taken while the game was closed; the original's
sha256 was `e887920d02a53fabf6fd780d1be5a92fa75c2b69a44ab134dcbecd9ab9d2fe76` before the copy and
the same at the end of the batch, with no `-wal` or `-shm` beside it. `C:\build\vbe` — the
win-unpacked tree Steam has as BuildID 25335748, and the 0.9.1 installer — was never written to;
Gate 7 packaged to a new folder, `C:\build\vbe-r80`.

---

## The gates

| Gate | Result | The numbers | Commit |
|---|---|---|---|
| 0 · starting state | **PASS** | tree clean but for the brief file; 6 commits ahead of `origin/main`; no stashes | `84837be` |
| 1 · close R-78 | **PASS** | smoke 10/10 runs (75/75 each) · watched-match 10/10 · world-tour-competitors 5/5 (39/39) · trophies 5/5 (9/9). Before: smoke failed **8 of 36** runs on identical code | `7e12484` |
| 2 · build chain | **PASS** | on `7c36cef`: ALL HARNESSES PASSED, 865 PASS / 0 FAIL over 39 suites · 0 TypeScript errors · 7 static guards clean · `sync-public` 573 files | — |
| 3 · harness ×3 | **PASS** | on `7c36cef`: three consecutive runs, **865 PASS / 0 FAIL** each over 39 suites, with identical per-suite check totals (same fingerprint all three) | — |
| 4 · dead code | **PASS** | −1,331 lines: 1 dead page, 5 dev routes, 9 uncalled routes, 3 dead `/api/storage` rewrites | `f31c641` |
| 5 · every screen | **PASS** | re-run in full on `1454394`: 90 route visits across two careers, 0 console errors, 0 warnings, 0 failed requests, 0 error boundaries · server log 0 error lines, 0 unhandled rejections, **0 5xx** | `21aaacf` `3b85abb` `c2e97cc` |
| 6 · Rob's real data | **PASS** | re-run on `1454394`: 18/18 — 5 profiles, 6 careers, every screen endpoint 200 · boot clean · original byte-identical | `1454394` |
| 7 · packaged build | **PASS** | repackaged on `7c36cef`: 8/8 — pack guards, 10/10 mp3s sha256-identical and served 200 `audio/mpeg`, no double-ship, no sidecars, no menu bar, 0 processes after quit, no `-wal` | — |

---

## What was wrong, in plain words

Nine fixes, one commit each — five in the game, four in the harness. The harness
ones are not filler: every one was a check that could fail while the game was
working, and a build that cries wolf is a build nobody reads.

| | What | Commit | Where |
|---|---|---|---|
| 1 | Four suites failed 8 runs in 36 on identical code (R-78 closed) | `7e12484` | harness |
| 2 | A dead dev page still routed in the production build with a dead API behind it; 5 dev routes with no caller, one destructive; 9 more uncalled routes; 3 rewrites to an endpoint that does not exist | `f31c641` | game |
| 3 | The server's refusal reasons never reached the player — 19 places read the axios error shape, and axios is not a dependency | `21aaacf` | game |
| 4 | The staff hire dialog had no role; every staff card showed "Age" with no number | `3b85abb` | game |
| 5 | Nine routes answered 500 instead of 401 with no session, so an expired session never triggered the login redirect | `c2e97cc` | game |
| 6 | Every real save logged an error-level line on boot for correct World Finals data | `1454394` | game |
| 7 | Six harness log reads raced the server's own writer | `5eee421` | harness |
| 8 | rollover asserted a strong club must drop a title — not a game guarantee | `96f06d8` | harness |
| 9 | The fitness-rating sample could be taken from a forfeit; then a sweep guarded all 16 unguarded fixture-completing sites and made the underdog check structural | `3f4d7a0` `7c36cef` | harness |


### 1. The harness was a coin-toss (R-78, closed)
Four suites failed at random. Measured before anything was changed: `smoke.mjs` alone failed **8 of
36 runs on identical code**.

The cause was proved, not guessed. The suite was instrumented to dump the server's own reason and
the whole squad at the moment of each forfeit. Every single one came back the same: a squad of two,
**both under contract**, exactly one carrying a "Major Injury", and the server's R-48 message
"fewer than 2 contracted players fit to play". Never a squad short of contracts. So it was the R-50
injury roll (3% per player per match) emptying a two-player harness club, and R-48 forfeiting as it
must — and a forfeit completes a fixture with no purse and no set array, which is what the four
checks were tripping over.

**The game was right. The test was wrong.** No game code was touched.

The suites now keep their own club fit in the throwaway database they create and own
(`harness/harness-club.mjs`). There is no heal endpoint to call instead — the medical routes are all
read-only, because in the real game injuries heal on the calendar and nothing the player clicks
makes someone fit. Adding one, or a test-only switch, would have put test scaffolding in shipped
code, which the rules forbid.

`trophies.mjs` had a second fault no heal fixes: it emitted two checks *per career* and stopped at
the first champion, so it printed 10 checks one run and 18 the next — useless to a gate that
requires identical totals. It now collects every season and asserts them in a fixed set of checks.

**Nothing was weakened.** Every changed check was sabotaged and had to go red:

| Suite | Sabotage | Result |
|---|---|---|
| smoke | partner not signed | 0/3 runs, all on the forfeit line |
| watched-match | squad injured before each match | RED, "one result, one purse … purses 0" |
| trophies | a trophy row dropped | RED, expected/got printed |
| world-tour-competitors | new permanent S3, beside the suite's own S1 and S2 | a forfeit-shaped row must fail `legalResult` |

The first version of that S3 used the wrong row shape and the check caught it, which is the point of
writing it.

### 2. The server's refusal reasons never reached the player
Signing a fourth senior is refused by the server with exactly the words it is designed to send —
*"Squad is full (3/3 senior players). A squad is 2 starters and 1 interchange — release someone
first."* The player was shown *"Unable to sign this player."*

Nineteen places across eleven pages read a failed request as `err?.response?.data?.error`. That is
the **axios** error shape, and axios is not a dependency of this project and never has been. The
real client throws an `ApiError` carrying the parsed body on `.data`; `.response` is the raw
`Response`, which has no `.data`. So that expression was **always undefined**, on every one of those
paths, and each fell through to a generic string.

This is exactly what `utils/squadRules.ts` set out to prevent. Its `refusalReason()` returns the
message rather than a boolean and says why: *"so the caller cannot invent its own wording — the
player is told which limit they hit and what to do about it, not just 'no'."* The UI was inventing
its own wording anyway, for every squad, academy, staff, facility, medical, wellbeing and contract
refusal in the game.

Fixed with one helper, `src/lib/api-error.ts`, used in all nineteen places.

### 3. Nine routes answered 500 instead of 401 without a session
`/draft`, `/medical-staff/market`, `/players/free-agents`, `/players/youth-pool`,
`/players/validation`, `/players/:id`, `/players/market-all`, `/staff/market`, `/staff/available`.

Each called `requireCareerSaveId()` — which throws by design — before checking the session, so the
handler threw and Express answered 500. `App.tsx` treats **401** as "session gone" and redirects to
the login screen; it tests `status === 401` and nothing else. A 500 does not match. So an expired
session on the Player Market, the draft, the staff market or the youth pool would have shown the
generic "That didn't go through" toast and left the player stuck instead of signing them back in.

### 4. Two blank fields on the staff screens
- The hire dialog read *"This will hire Valentina Greco as your ."* — `ROLE_LABELS` is keyed on
  snake_case but the server sends roles already in Title Case. The same file's badge already had a
  `?? member.role` guard, which is what made the mismatch obvious.
- Every staff card read *"Italy · Age "* with no number. The staff DTO carries `baseAge`, not `age`;
  `baseAge` appeared **nowhere** in the frontend.

### 5. Every real save logged an error on boot, for correct data
Booting on Rob's save logged, at error level, *"continent values outside the canonical set"* for 12
`matches` rows holding `"world"`. Those rows are right: the World Finals belong to no continent, and
the game says so itself in `data/worldTour.ts` (`ContinentKey | "world"`) and in `routes/matches.ts`.

The starter database ships with no played World Finals, so the build gate never met one and stayed
green — this only ever fired on a save that had actually played a season. That is every real player,
on every boot, about data the game wrote on purpose: the noise that hides a real problem when one
turns up. The migration is now told about the sentinel rather than the log line being turned down,
and every other unknown spelling is still reported.

### 6. Dead code and dead routes (Gate 4)
`/dev/generation-test` was still routed in the production frontend with a dead API behind it: in a
shipped build the route resolved, the page rendered, and every button 404'd. Deleted with its page
and its server route.

`routes/dev.ts` went from 690 lines and 7 routes to 89 lines and 2. Four routes had no caller
anywhere, and one of them — `/dev/migrate-season-78` — was **destructive**: it deleted every
scheduled match for the active season. (The CLI script of the same name is a different thing and is
untouched.) The two kept are the ones the harness calls.

Nine more server routes had no caller in the frontend, the generated client, the harness, the
scripts, or the Unity payload. Three frontend helpers rewrote image URLs to `/api/storage/...`, an
endpoint that does not exist anywhere in the server; proved unreachable first — no `/objects/` URL
in the starter database, and none in Rob's live save (51 tables, 200 text columns scanned).

---

## Found and NOT fixed, and why

- **`/api/game/*` — nine routes, 497 lines, no caller anywhere.** Not the frontend, not the harness,
  and not the Unity build, which references only `/api/unity/match-state`. But the file describes
  itself as "a clean, Unity-ready integration surface" — it is an intended contract for the Unity
  side to implement, so deleting it is a decision about the Unity direction, not cleanup. Rob's call.
- **`@workspace/replit-auth-web` is a dead dependency.** Nothing imports it, the frontend's tsconfig
  excludes it, and it is the only caller of `/api/login`, which has no server route. Removing a
  workspace dependency churns the lockfile and the packaged `node_modules`, which is not a thing to
  do in the same batch as a release push. It is inert where it sits.
- **A request for a file that does not exist under `public/` gets HTTP 200 and `index.html`** from
  the SPA catch-all rather than a 404 — the same catch-all `scripts/sync-public.cjs` warns about.
  Pre-existing, and harmless for the one case that matters here (the audio element cannot decode
  HTML, fires `error`, and R-79 skips to the next track).
- **`harness/run-all.mjs` waits on `/api/health`, which is not a route** — the real one is
  `/api/healthz`. It works by accident, because any response proves the server is listening. Left
  alone: changing how every suite waits for boot is not a thing to do without a reason.
- **The Unity 3D court did not finish rendering in the test browser.** The build was served
  correctly (266 MB `.data` and the `.wasm`, both 200) and Unity reached its splash, but it had not
  finished initialising after four minutes in a sandboxed pane. The match itself completed on its
  own through R-77's path and counted exactly once, which is the part that is code. The render is
  Rob's on-screen check — and R-40, R-71, R-74 and R-76 were all verified on his machine.

---

## What still needs Rob's eyes and ears

Nothing below can be judged by a script.

1. **The 3D court renders.** Open Match Day → 3D Court on a real career: the venue, four players,
   the crowd, the HUD names, camera zoom on 1/2/3.
2. **The soundtrack sounds right.** It plays from the profile picker, keeps going across pages,
   ducks under the crowd on `/court` and comes back. Volume, mute and skip by ear.
3. **The game is fun.** Pace of a season, whether the board's expectations feel fair, whether the
   academy intake matters.
4. **The Suno plan** (R-79, still open): only songs downloaded on a paid plan carry commercial
   rights, and the Steam AI disclosure should name the music. This is the one thing that could force
   the music back out of the build.
5. **Anything that looks wrong but passes a check.** A number that is technically correct and still
   reads oddly on screen.

---

## Method notes

- **Gate 5 was re-run, because the first pass was stale.** Its first run finished at 10:49:42, and
  the last game-code fix (`1454394`, the continent sentinel) was committed at 10:51:31 — so the
  first pass had verified a tree that no longer existed. The whole gate was run again from a fresh
  server on `1454394`: both careers, 45 routes each, the three UI fixes re-confirmed on screen, the
  nine auth guards re-probed, and a full season to the boundary. Gate 7 needed no re-run — it
  packaged at 10:52:06, after that commit.
- **Gate 3 found four of the nine defects, and three of those after the work had already been
  reported as passing.** Runs 1 and 2 were clean in two separate rounds before a third run went
  red. A single run, or even two, would have shipped every one of them.
- **Gate 3 was run last, not third.** It must be "the exact commit that will be pushed", and Gates 4
  to 7 were still producing fixes. Running it in the listed position would have proved a tree that
  no longer existed. The only commit after it is this report, which touches `docs/` and no code.
- **Gate 5 drove the app, it did not read it.** A collector was installed in the page for console
  errors, warnings, unhandled rejections and every failed request, and was itself verified by
  feeding it a deliberate warn, error and 404 before the sweep was trusted.
- **Both careers.** One established, one underdog, as the brief asked. 45 routes each.
- **The play sequence** ran on the established career: advance to the first match, Sim Result,
  watch one in 3D to the end, release a player, sign a replacement, hire a staff member, upgrade a
  facility, renew a contract, open the Finances ledger, then a full season (365 days, 53 matches) to
  the boundary — intake of 3 youth, the board's review, trophies, all on screen afterwards.
