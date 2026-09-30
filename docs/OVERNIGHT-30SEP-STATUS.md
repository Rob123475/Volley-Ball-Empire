# Overnight brief 30 Sep -> 1 Oct 2026: status

Brief: C:\Users\rbonn\Downloads\OVERNIGHT-BRIEF-30SEP.md. Branch `fix-batch-29sep` (game repo); Unity repo
`Rob123475/volleyball-unity`, branch `main`. Order of work: A (1-3), D (16-24), B (4-12), C (13-14), F (30-34),
E (26-29), C15 last. Rob's live save never opened: tests use copies of the starter DB or of
Downloads\volleyball-empire-backup-30sep-0921.sqlite (only ever copied). No Steam upload.

## Items

| # | Item | Status | Commit | What changed, and how it is proven |
|---|---|---|---|---|
| 1 | Career > Records is the manager's record | Done | `7e3b510` | Cause: the Records tab showed the Trophy Cabinet (club achievements). GET /history/records is rebuilt as the manager's record across every club he or she managed (current + former): matches, wins, win %, best and current win streak, seasons, titles, World Finals, gold events, perfect seasons, best finish, prize money won, highest balance, youth signed/promoted, Hall of Fame inductions, Olympic golds; new page `manager-records.tsx` is the tab. Proven by `harness/manager-records.mjs` 6/6 on a copy of Rob's 30 Sep backup (every figure recomputed from the copy's own rows); full harness 74/74 green. |
| 2 | Manager Profile: earnings and one standing | Done | (this commit) | Cause: "Career Earnings" summed the club's prize money; the stars came from career_saves.manager_reputation, which nothing ever moved (always 50 = 3 stars "Experienced Manager"), while the dashboard's "Level 1 Local Coach" came from teams.manager_rep_points. Now one table of levels (`lib/db/src/schema/manager-levels.ts`, Level 1 Local Coach … Level 5 Legend) drives the profile (stars = level, "Level n · name"), the dashboard, the Trophy Cabinet and the retire screen; Career Earnings = the $6,000 salary pro rata on the game days of each season (`managerEarnings`). OpenAPI CareerSummary updated and clients regenerated (the regeneration also drops three stale generated training types left from Unity 19). Proven by `harness/manager-profile.mjs` 5/5 on a copy of Rob's 30 Sep backup ($1,036 on 2026-03-04; 25 points → Level 1 Local Coach). Full harness in item 2's snapshot: 74/75; the one failure was court-finish's end-of-match check, broken by the Unity 20b/21 commits (not by this item), fixed in `cbfdb7b` and 9/9 when rerun in the same snapshot. |
## Questions for Rob
