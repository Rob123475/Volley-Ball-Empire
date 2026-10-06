# Merge brief Tue 6 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\MERGE-BRIEF-06OCT.md`, steps 1 to 8 in order.

## Summary

(Written at the end.)

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
