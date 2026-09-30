# Overnight brief 30 Sep -> 1 Oct 2026: status

Brief: C:\Users\rbonn\Downloads\OVERNIGHT-BRIEF-30SEP.md. Branch `fix-batch-29sep` (game repo); Unity repo
`Rob123475/volleyball-unity`, branch `main`. Order of work: A (1-3), D (16-24), B (4-12), C (13-14), F (30-34),
E (26-29), C15 last. Rob's live save never opened: tests use copies of the starter DB or of
Downloads\volleyball-empire-backup-30sep-0921.sqlite (only ever copied). No Steam upload.

## Items

| # | Item | Status | Commit | What changed, and how it is proven |
|---|---|---|---|---|
| 1 | Career > Records is the manager's record | Done | (this commit) | Cause: the Records tab showed the Trophy Cabinet (club achievements). GET /history/records is rebuilt as the manager's record across every club he or she managed (current + former): matches, wins, win %, best and current win streak, seasons, titles, World Finals, gold events, perfect seasons, best finish, prize money won, highest balance, youth signed/promoted, Hall of Fame inductions, Olympic golds; new page `manager-records.tsx` is the tab. Proven by `harness/manager-records.mjs` 6/6 on a copy of Rob's 30 Sep backup (every figure recomputed from the copy's own rows); full harness 74/74 green. |
## Questions for Rob
