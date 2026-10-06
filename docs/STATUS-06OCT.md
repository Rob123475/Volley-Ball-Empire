# Merge brief Tue 6 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\MERGE-BRIEF-06OCT.md`, steps 1 to 8 in order.

## Summary

**All three new builds are in the game, on one branch, `launch-final`, and its package is ready for you to check: `C:\build\vbe-final-06oct\win-unpacked`.** Nothing is merged into `main` (still `2c17431`), nothing went to Steam, and the launch-only fallback `C:\build\vbe-launch-05oct` and the four old branches are untouched.

- **Try** (AI players buyable, the job market, your AI senior pictures) joined with no conflicts. Its six suites passed alone.
- **Staff injuries** joined with two conflicts, both resolved keeping both features (the suite list; the starter DB rebuilt as try's plus staff's three columns and table). With the job market: a manager who moves takes on the new club's staff (an AI club has none), the old club's staff stay there, and anyone off stays off. AI clubs still have no staff rows. **The new check found a real bug, now fixed:** on the day of a move, a staff hire was dated 1 Jan 2026 and its contract ran out the next day.
- **Manual controls** joined with no conflicts. On the court, in Auto and in Manual, the AI club plays its squad as it is now, after I bought one of its pair: each player's picture is served and her skin tone on the court is her picture's. A full match was played in Auto, and the manual-court proof passed 8/8.
- **The full harness:** the first run found a fault in one suite. With the job market joined in, the suite's own manager could be sacked and move clubs, and the suite then let his new club go broke. I fixed the suite, and the second run passed: **104/104 suites, 1,703 checks, ALL HARNESSES PASSED at `b311e6c`**.
- **The package** is built from `b311e6c`, its before-pack and after-pack checks passed, and it booted on a copy of your 2 Oct save. Your career loaded, the Unity data and the pictures were served, and your live save was not changed.
- **Q-4 is settled** (the AI seniors' pictures are in the launch build now). The other eight questions from 5 Oct stand as decided and are listed again at the end, with one new one (Q-11).

## Steps

### 1. The joined branch

**Done.** `launch-final` made from the launch branch `fix-batch-29sep` at its head `636f4a2` (its code is `715073e`: `git diff --name-only 715073e 636f4a2` lists only `docs/`). Worktree `C:\vbe-final`; its frontend, server and scripts link to this worktree's own `lib/` packages (not the main tree's), so every build compiles this branch's code. `fix-batch-29sep`, `try-02oct`, `feat-staff-injuries`, `feat-manual-controls` and `C:\build\vbe-launch-05oct` are not touched.

### 2. Merge try (`try-02oct`, `29cdfaa`)

**Done.** Merge commit `237085f`. **No conflicts:** try already held the launch code `715073e` (merged into it on 5 Oct), so the merged code is try's exactly (`git diff --name-only try-02oct 237085f` lists only `docs/` files: launch's proof files and its status file came along).

The six suites alone, one after another, on `237085f` (built: typecheck, build, sync), each on its own copy of the starter DB (`docs/proof-06oct/step2-solo-suites-237085f.txt`):

| Suite | Result | Time |
|---|---|---|
| `ai-buyable` | **25/25** | 24 s |
| `ai-job-market` | **24/24** | 63 s |
| `ai-club-economy` (30 seasons of the whole world; 135 sales, every one reopened on $500,000) | **21/21** | 19 min |
| `player-pictures` (graduates and the 120 AI club players' cards) | **28/28** | 29 s |
| `economy` | **5/5** | 4.7 min |
| `season rollover` (server on a starter-DB copy; to season 30) | **90/90** | 18 min |

ALL SOLO SUITES PASSED.

### 3. Merge staff injuries (`feat-staff-injuries`, `98b969a`)

**Done.** Merge commit `6474c8d`, then one fix and its checks in `a37e034`.

**Conflicts (two), each resolved by keeping both features:**
- `harness/run-all.mjs`: try's two suites (`ai buyable`, `ai job market`) and staff's `staff injuries` all run (staff's numbered 98c/100); every other suite runs with the staff roll off, as on the staff branch.
- `lib/db/volleyball-empire.sqlite` (the starter DB, binary): rebuilt, not picked: try's DB (its AI seniors' pictures and the job market's columns) plus the staff branch's three `career_staff_state` columns and its `staff_absences` table and index, with the DDL read from the staff branch's own DB. Schema compared table by table: against try it differs only by those; against staff only by try's own changes. `check-starter-db` OK (57 tables, 276 players, 120 staff).
- Nothing else overlapped in code (`playerDto.ts`, `calendar.ts`, `players.ts`, `game.ts` merged cleanly; both sides' staff readers are the same 12 files, each counting only staff on duty).

**With try's job market** (new checks in `ai-job-market` section 4; his old club's staff planted with one off, a broken leg, 42 days):
- **He takes on the new club's staff.** The AI club he takes has none (AI clubs have no staff rows), so his Staff page is empty at the new club; none of the old club's staff come with him, none are released: they stay at the old club.
- **Staff who are off stay off:** the broken leg is still off after the move (`off_days_left` 16, the absence still open); the move clears nothing.
- **AI clubs still have no staff rows:** every staff row in the career is at a club he has managed. Try's code adds none (its diff touches no staff rows; a staff row can only point at a `teams` row, and AI clubs are not `teams` rows), so no AI staff illness rule was needed.
- **A real bug found and fixed (`a37e034`):** on the day of the move the new club had no calendar row until the next `GET /calendar`, so a staff hire that day was dated 1 Jan 2026 and its contract "expired" the next day (the hired member was gone). The takeover now starts the new club's calendar on the career's date, paused. In the game the dashboard's calendar call usually made the row first, so it would rarely show; it no longer can.

**Alone, on `a37e034`** (`docs/proof-06oct/step3-solo-suites-a37e034.txt`, run as the full harness runs them, the staff roll off except in its own suite): **`ai-job-market` 30/30** (24 before + 6 new), **`staff-injuries` 19/19** (staff 29 absences in 19,665 staff-days, 1.47 per 1,000, against the players' 3.19).

### 4. Merge manual controls (`feat-manual-controls`, `8e32cb9`; Unity `66ef4bf`)

**Done.** Merge commit `d9e319d`: **no conflicts** (it touches only the court page, the Unity export and their suites, none of which try or staff changed). The Unity export in `launch-final` is the controls branch's exactly (same git blobs for `.data`, `.wasm`, `.framework.js`, `.loader.js`: Unity `66ef4bf`). New proof script `scripts/webgl-proof/ai-court-proof.mjs` (`1696fcc`).

**The court shows try's AI club squads and pictures, in Auto and in Manual** (headless Chromium, real GPU, the court opened as you open it: the remembered Auto/Manual choice, Next match, Watch Match). Each run is a new career whose first match is against an AI club; before it, I **bought one of that club's pair on the Player Market** (try's rule), so the club had to play its replacement:
- **Manual** (`step4/ai-court-manual/`, 13/13): Paris Sables Royales sold Élise Fontaine and signed Camila Santiago. The court's data, the Player Market and the court's own loader log all have **Camila Santiago & Céline Moreau** on the away side, not Élise; each has her picture (served, HTTP 200: Céline's is your AI senior picture `player_senior_ai_eur_03_p2`); each one's skin tone on the court is her picture's (Céline "Medium Light" = her picture's band); the court started in Manual from the page; no page errors.
- **Auto, a full match** (`step4/ai-court-auto/`, 15/15): Athens Aegean Stars sold Eleni Papadaki; the court played **Camila Santiago & Niki Stavros** (Niki "Medium" = her picture's band); **the match played to its end in Auto: 1-2 (10-12, 11-5, 5-11), recorded completed**; no manual code ran; no page errors.
- The 3D court itself shows no pictures (it draws the players in 3D): "pictures correctly" there means each AI player is drawn with her picture's skin tone, which is what is checked. The pictures themselves are on the cards (Player Market, AI club pages).

**The manual-court proof** (`scripts/webgl-proof/manual-court-proof.mjs`, `step4/manual-court/`): **8/8**: opens in Manual from the remembered choice; the page's button says Manual; the court started in Manual; Esc pauses and resumes; Tab switches to Auto and the page's button follows; the page's button switches back; no page errors.

Screenshots in each folder (`ai-court-auto-play.png`: Sydney Riptide v Athens Aegean Stars in Auto).

### 5. Full harness on `launch-final`

**Run #1, at `adbd5de`: 103 of 104 suites passed; `ai-club-economy` failed** (`docs/proof-06oct/full-harness-adbd5de-economy-fail.txt`). Two of its checks: "the world played 30 seasons: the player's own club was sold" and "every continent kept its six clubs: season 11, asia:5".

**The cause (a fault in the suite, which predates managers moving):** in that run the suite's own manager had two failed seasons running, so with try's job market his board sacked him at season 11 and he took Tokyo Surf Samurai (an AI club, which then leaves its league: hence Asia's 5; its balance froze at -$78k in the suite's table). The suite keeps the player's club solvent so it is never sold, but it topped up only his **first** club, so the new one ran five losing seasons and was sold at season 16, which ends the suite. It passed alone in step 2 because there his board never sacked him: it is random. Not a fault in the game: a sacked manager moving to the open club is try's rule, and the taken club's league place is played out (as forfeits) and filled from the bench the next season, as before.

**Fixed (`harness/ai-club-economy.mjs`, the suite only):** his job is `ai-job-market`'s subject, as his club's sale already was, so after every season's turn his board's verdict on the season just ended is planted as "met" (two failed seasons running never happen), the club kept solvent is always the one he has now, and a new check says he stayed at his club. **Alone: 22/22** (`step5-ai-club-economy-fixed-alone.txt`: 30 seasons, every continent six clubs every season, he stayed at his club all 30).

**Run #2, at `b311e6c` (the suite fix; every commit after it is `docs/` only): 104/104 suites, 1,703 checks, ALL HARNESSES PASSED** (16:06–17:10; `docs/proof-06oct/full-harness-b311e6c.txt`). 104 = launch's 101 + try's two (`ai buyable`, `ai job market`) + staff's one (`staff injuries`). No two runs overlapped.

### 6. Package `C:\build\vbe-final-06oct\win-unpacked`

**Done.** Built from **`b311e6c`**, the commit the harness passed on (checked out exactly for the build, then the worktree went back to the branch): the Unity data Brotli-compressed (`compress-unity-data`), the workspaces rebuilt from that commit, then `electron-builder --win dir` into `C:\build\vbe-final-06oct` (616 MB).
- **Before-pack:** only Brotli Unity data packaged (the raw `.data`/`.wasm` stripped); better-sqlite3 loads under Electron. **After-pack:** the starter DB alone (no -wal/-shm); no `steam_appid.txt`; steamworks.js unpacked. (`docs/proof-06oct/package-checks-b311e6c.txt`.)
- The packaged starter DB is the branch's (MD5 `ba6d6659…` both); the packaged `.data.br` is MD5 `1f5b912b…`, the same as the controls package of 5 Oct (the same Unity export, `66ef4bf`).
- **Booted on a copy of your 2 Oct backup** (MD5 `f2c55790…`, the original) with the package's own exe as its server, never the app (`docs/proof-06oct/boot-final-b311e6c.json`): **your career loaded** (profile Rob, Sydney Riptide, $247,731, 24 Apr 2026, 3 players, 2 staff); the page served; **Unity data and wasm served Brotli** (217,010,143 and 9,017,008 bytes); the court page carries the Auto/Manual switch; **pictures served**: an AI senior's (Annika Bauer, `player_senior_ai_eur_01_p1.webp`, 200) and a graduate's (200); the package holds your 96 AI senior pictures and 121 graduate pictures; the Player Market lists 120 AI club players, 96 with your new pictures (the other 24 keep the card your CSV names); the Job Market answers. The save copy gained, additively: the staff columns and `staff_absences` (nobody off), the job market's columns, the AI managers' columns, the graduate table, the 96 pictures.
- **Your live save is unchanged:** its timestamp and size were read before and after (2 Oct 03:49 UTC, 2,314,240 bytes); it was never opened.
- `C:\build\vbe-launch-05oct` (the launch-only fallback) was not touched.

### 7. Questions the join settles

**Done.**
- **Old Q-4 is settled by the join.** The AI club seniors' pictures came to launch with try: your 96 new ones, matched by continent and skin tone, and the 24 that keep the card your CSV names. In `launch-final` every AI club player has her picture. `player-pictures` checks all 120 in the full run (28/28), the package's Player Market lists them with their pictures, and the court draws each player with her picture's skin tone (step 4). Q-4 had one detail: the South America senior whose skin words stop at "medium" is still counted Medium Dark. Say if that is wrong.
- Old Q-10 (the branch head is ahead of the harness commit by `docs/` only) applies again. The table in step 8 answers it the same way.
- Every other open question from `STATUS-05OCT.md` (Q-1, Q-2, Q-3, Q-5, Q-6, Q-7, Q-8, Q-9) stays as I decided it on 5 Oct. They are listed again under "Questions for Rob", with one new question the join raised (Q-11).

### 8. Final check

| Branch | Head = harness = package = GitHub | Full harness | Package | Boot on copy |
|---|---|---|---|---|
| **`launch-final`** (launch + try + staff injuries + manual controls) | **`b311e6c`** for the harness and the package. GitHub's head is this status commit; every commit after `b311e6c` is proof files and this report under `docs/` (`git diff --name-only b311e6c HEAD` lists nothing outside `docs/`). Unity: `volleyball-unity` **`66ef4bf`**, the same on GitHub | **104/104 suites, 1,703 checks, ALL HARNESSES PASSED** at `b311e6c`, 16:06–17:10 (`docs/proof-06oct/full-harness-b311e6c.txt`). Run #1 at `adbd5de`: 103/104, a suite fault, fixed (step 5) | `C:\build\vbe-final-06oct\win-unpacked`, built from `b311e6c`; before-pack and after-pack OK | **Yes**: Sydney Riptide loaded, $247,731, 24 Apr 2026; Brotli Unity data and pictures served; live save unchanged (`boot-final-b311e6c.json`) |
| `fix-batch-29sep` (the fallback, untouched) | `715073e` code, head `636f4a2`, unchanged, the same on GitHub | 101/101 at `715073e` (5 Oct) | `C:\build\vbe-launch-05oct\win-unpacked`, not touched (last changed 5 Oct 16:34) | Yes (5 Oct) |

`try-02oct` (`29cdfaa`), `feat-staff-injuries` (`98b969a`), `feat-manual-controls` (`8e32cb9`) and `main` (`2c17431`) are unchanged, locally and on GitHub. The merge was rehearsed in a scratch worktree (`C:\vbe-mergetrial`, never pushed). Every resolution was then made again on `launch-final` and checked there.

**The brief, re-read top to bottom:**
- **Rules of engagement:** kept. **The live save was never opened:** tests used copies of the starter DB, and the package boot used a copy of the 2 Oct backup (MD5 `f2c55790…`, the original). Only the live save's timestamp and size were read, and they are unchanged. **Your files were never moved, renamed or edited:** this run only read the backup, to copy it. No music changes. No Steam upload. The ElevenLabs key check passed on every push. **One full harness at a time:** run #2 started after run #1 ended, and the solo suites and court proofs never ran during a full harness. **Committed and pushed after each step.** Nothing was merged into `main`. **The fallback is kept:** `C:\build\vbe-launch-05oct` and the old branches are untouched. **Merge conflicts:** each one was read on both sides and resolved keeping both features. The starter DB was rebuilt, not picked, so nothing was layered over a broken join. The join left no dead code: the one stale comment, in `calendar.ts`, was updated. **The report** was written as the steps went, with the summary first and "What Rob must check on screen" and "Questions for Rob" at the end.
- **1:** done. `launch-final` was made from `fix-batch-29sep` at `636f4a2` (code `715073e`).
- **2:** done. try was merged with no conflicts. `ai-buyable`, `ai-job-market`, `ai-club-economy`, `season rollover`, `player-pictures` and `economy` each passed alone.
- **3:** done. Staff injuries was merged. With the job market, the manager takes on the new club's staff and staff who are off stay off. That check found a real bug, now fixed. AI clubs still have no staff rows (try added none), so no AI staff illness rule was needed. `staff-injuries` passed alone (19/19).
- **4:** done. Manual controls was merged. The court shows try's AI squads and pictures in Auto and in Manual. The manual-court proof passed 8/8, and a full match was played in Auto in headless Chromium.
- **5:** done. The first run found a suite fault, which was fixed and committed; the second run passed every suite.
- **6:** done. The package was built from `b311e6c`, the before-pack and after-pack checks passed, and it booted on a copy of the 2 Oct backup: your career loaded, the Unity data and pictures were served, and the live save is unchanged.
- **7:** done. Q-4 is settled; Q-1, Q-2, Q-3, Q-5, Q-6, Q-7, Q-8 and Q-9 are listed again below.
- **8:** this table and this re-read.

Stopped here.

## What Rob must check on screen

All in **`C:\build\vbe-final-06oct`**. Make a backup of your save first, as always.

1. **Your career loads** as before (Sydney Riptide). The **music bar** and the **reference corrections** (Maui Hula Warriors and the others) from the launch build are there.
2. **Graduates' pictures:** move an 18-year-old from the Youth Team into the senior squad. Her card shows one of your pictures of her continent.
3. **Player Market, At AI Clubs:** every AI club player has a picture, with the right skin tone and continent. **Buy one:** the fee goes to her club, and that club signs a free agent so it can still field two.
4. **Job Market:** in the off-season window you get offers (one or two after a failed season, up to four after a good one). If you move clubs, the new club has **no staff** (AI clubs have none, so hire on the Staff page; Q-11), and your old club's staff stay behind.
5. **Staff off ill or hurt:** about once every couple of months with eight staff, someone is off. Their card shows a red "Off: …, back in N days" strip, Club News gets two lines, and their bonus is left out.
6. **The court in Auto:** Watch Match against an AI club. The away pair is that club's current pair, and the match plays exactly as before.
7. **The court in Manual, with a pad and the keyboard** (the full list is in `STATUS-05OCT.md`, items 7–11): click "Auto: AI plays" to switch to "Manual: you play". Then try W A S D, J dig, K set, L spike/block/serve, Space dive, Q switch, Tab Auto/Manual, Esc pause, H help. On an Xbox pad use A/X/Y/B, LB and View; on a PlayStation pad use Cross/Square/Triangle/Circle, L1 and Share. Check that it is forgiving enough and that the mouse only does the boosts.

## Questions for Rob

Where the decision was yours, I took the safest option and carried on. Each one is easy to change.

- **Q-1 (5 Oct) The pictures' size.** In the game they are cut down to 600×800 WebP and show the whole picture, head to toe. Your originals in Downloads are untouched. Is that fine, or should I crop closer?
- **Q-2 (5 Oct) When a continent runs out of graduate pictures** (about 20 each, never used twice in a career), she keeps her flag card. Should a picture come free again when the player who wore it retires, or would you rather make more pictures?
- **Q-3 (5 Oct) "Grow Your Squad"** sits in the Attention panel, off the first screen at 1280×720. Move the panel higher?
- **Q-5 (5 Oct) AI club sales:** on `launch-final` there were 134 to 148 sales over 30 seasons (134 in the full run that passed), many of them clubs in credit, because your rule sells a club after five loss-making seasons whatever is in the bank. Every sale clears the debts. Do you want that many, or should only clubs in debt be sold?
- **Q-6 (5 Oct) Staff illness hits only your club.** AI clubs have no staff in this game (this is still true after the join). Is that fine?
- **Q-7 (5 Oct) How often staff fall ill:** the daily chance is half the players' measured rate. This run measured 1.47 per 1,000 staff-days against the players' 3.19. Keep it, or make it more frequent?
- **Q-8 (5 Oct) What your touches decide in Manual:** a point is still decided by the game's odds; your touches can lose it or save it. Should timing and skill change the odds?
- **Q-9 (5 Oct) Space is dive in a manual match,** so the camera's Space, the A/D boost keys and the wheel stand down there. Is that fine?
- **Q-11 (new) Staff after a move to another club.** AI clubs have no staff, so after a move (sacked, sold, resigned, or an offer taken) you start at the new club with no staff and hire on the Staff page. Your old club's staff stay with the old club, and anyone off there stays off; they are no longer yours. Should some staff follow you, or should an AI club come with staff of its own?
