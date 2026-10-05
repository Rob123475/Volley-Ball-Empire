# Afternoon brief Fri 2 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\AFTERNOON-BRIEF-02OCT.md`, in its order, plus Rob's two corrections sent during the run:
- **music:** fade only three songs, and the full Champions;
- **add-ons**, after the brief's items: a music bar upgrade, and the reference corrections (two player moves, two renames).

Ground rules:
- Your live save is never opened: tests use copies of the starter DB or of `Downloads\volleyball-empire-backup-02oct-0845.sqlite`.
- **Your 2 Oct backup has gone from Downloads** (found at 16:00; only the 29 Sep, 30 Sep and 1 Oct backups are left). I didn't delete or move it, and I haven't written anything into Downloads. A byte copy I made earlier in the afternoon is in `%TEMP%\bk02b.sqlite`. The add-on's proof used that copy (Q-7).
- One full harness run at a time.
- No Steam upload. The key check runs on every push.

## Summary

- **Runner-up prize (item 2): A kept.** B (a third of the full purse for every club) fails your 22 Sep test: every bottom-three season gains $311k–$504k and those clubs are never sold, and the champion gains $496k. A (today's rule) passes it at +$10k: champions gain $164k–$208k, 24 AI clubs are sold over 30 seasons, nobody goes below $0. Both tables are below.
- **1. Sponsor raise +$10,000 a week: done** (`f4a7480`). The champion and AI-sale lines are asserted again; the two bottom-club lines stay reported (Q-1).
- **2. Runner-up: done** (report only; no code change).
- **3. Music: done** (`a24cf10`), to your correction. Only Barefoot Tonight, Burn Under the Sun and Rum Under the Palms fade (last 5 s). Champions is your full file. All 18 files are byte-identical to your originals (Bobby Farquhar restored, Q-2).
- **4. Youth wage: decided, no change.**
- **5. Launch package: done.** `C:\build\vbe-unity-02oct-pm2\win-unpacked`, after a full harness of **99/99 suites, 1,590 checks**. Not launched against your save.
- **6. feat-ai-buyable rollover: done** (`55d9132`, 90/90).
- **7. Job market on your timing: done** (`cb38e0c` + follow-ups `67f5201`, `832596a`). Its suite passes 22/22, and job-market, career-ends and board-review were rewritten and pass. Alone on the branch: season rollover 88/90 (both fixed after the run, not re-run) and ai club economy 13/14 (the branch is still on +$20k).
- **8. Try package: partly done, NOT built.** `try-02oct` was merged and the full harness ran once (14:49–16:00): **95/100 suites, 1,620/1,625 checks: FAILED.** It failed 6 suites (5 checks). Two are fixed and pass alone: invented content removed, commentary she. One is a worktree artifact that passes in the main tree: market order. Three still fail: ai club economy, ai job market, staff portraits. The details are under item 8. So `C:\build\vbe-try-02oct` was not built.
- **Add-ons (after the items):**
  - the music bar's Play/Pause and song list: done (`1a69094`, `087be9a`), proven;
  - the reference corrections: done (`f4db408`). Aoife O'Sullivan is at Dublin and Yasmin Grech at Lisbon, each on the same contract and with the same stats. Salote Taufa and Maui Hula Warriors are renamed everywhere, past results included. Applied in the starter DB and in every save at boot. New suite `reference-corrections` **11/11** on the starter DB and a copy of your 2 Oct save (booted twice).
- **Questions:** Q-1 to Q-8 (Q-7: your 2 Oct backup is missing from Downloads), plus A-6 still open.


## Runner-up prize (item 2): A kept, B tested and rejected

**The two rules** (both at +$10,000 a week, everything else as shipped):
- **A (today's):** a club playing above its tier is paid 10% of the purse; the winner takes ⅔ and the runner-up ⅓ of what the club is paid.
- **B:** every club is paid the full purse in every tier; the winner takes ⅔ and the runner-up ⅓ of the full purse.
- **How B was tested:** in a throwaway copy of the repo (`C:\vbe-snap`, `purseAccessFor` always full; never committed), with the same suites as A: `ai-club-economy` (30 seasons, all 60 AI clubs) and `economy` (your club, 12 seasons).

**Bank balance at the end of the season**, in $ thousands, for this morning's six clubs:

| Club | Rule | S1 | S2 | S5 | S10 | S20 | S30 | Times sold |
|---|---|---|---|---|---|---|---|---|
| Rio Copacabana Queens (top) | A | 543 | 783 | 1,446 | 2,018 | 3,643 | 4,856 | 0 |
| | B | 942 | 936 | 2,337 | 4,425 | 8,013 | 11,398 | 0 |
| LA Beach Legends (top) | A | 752 | 975 | 1,328 | 1,884 | 3,139 | 5,305 | 0 |
| | B | 893 | 1,272 | 2,311 | 4,140 | 6,962 | 11,404 | 0 |
| Vancouver Pacific Orcas (middle) | A | 570 | 571 | 573 | 744 | 1,033 | 1,588 | 0 |
| | B | 1,021 | 1,022 | 1,023 | 1,967 | 1,990 | 2,022 | 0 |
| Fiji Island Breakers (middle) | A | 594 | 687 | 965 | 1,193 | 1,636 | 1,900 | 0 |
| | B | 594 | 688 | 1,764 | 2,653 | 3,647 | 5,875 | 0 |
| Wellington Southern Cross (last) | A | 582 | 662 | 908 | 1,310 | 2,163 | 3,028 | 0 |
| | B | 586 | 670 | 906 | 1,315 | 2,180 | 3,045 | 0 |
| Dar es Salaam Swahili Stars (last) | A | 614 | 722 | 1,062 | 1,644 | 2,797 | 3,950 | 0 |
| | B | 618 | 734 | 1,070 | 1,640 | 2,810 | 3,960 | 0 |

**All 60 AI clubs over 30 seasons, and your club over 12**

| | A (kept) | B |
|---|---|---|
| AI clubs sold over 30 seasons | 24 (46 never sold) | 12 (54 never sold) |
| AI clubs that end a season below $0 | 0 (none, at any depth) | 0 (none, at any depth) |
| Median AI balance at season 30 | $3.00M | $5.93M |
| Richest / poorest AI club at season 30 | $8.13M / $493k | $11.40M / $500k |
| Your club, a season in the bottom three | −$28,729 to +$47,275 (3 of 4 went backwards; the underdog sold after season 8) | **+$311,357 to +$503,689, every one** (never sold) |
| Your club, a season as Gold champion | +$164,425 to +$208,369 (5 titles) | +$260,739 and **+$496,405** (2 titles) |

**Your test** ("works financially" = the 22 Sep rule):
- **A** passes it as far as this morning's +$10k did: champions gain well under $500k, 24 AI clubs are sold over 30 seasons, and nobody ends a season below $0. Only the bottom-three line is soft: one season gained $47k.
- **B fails.** Every bottom-three season gains $311k–$504k and the club is never sold. A Bronze or Silver club would bank the full Gold purse, so the bottom never goes backwards. The champion sits right at the line ($496k).
- **So A stays as shipped: no code changed.** The fixture list's 10% note and the rules page stay as they are.

Raw output: `docs/proof-02oct-pm/runnerup_A_30_seasons.txt`, `runnerup_B_30_seasons.txt`, `runnerup_A_player_club.txt`, `runnerup_B_player_club.txt`.

## Items

| # | Item | Status | Commit | What changed, and how it is proven |
|---|---|---|---|---|
| 1 | Sponsor raise +$10,000 a week (Q-2) | Done | `f4a7480` | **Changed:** `lib/db/src/schema/money.ts`: `sponsorWeeklyBonus` from $20,000 to $10,000. **Older saves:** nothing stored the old figure; sponsor income is computed each week from the club's reputation plus the bonus (`clubFinances.ts sponsorWeeklyIncome`, used by the weekly tick, the AI clubs' week and the Finances forecast). So a save raised at +$20,000 earns +$10,000 from its next week on, and past ledger lines stay as they were paid. **22 Sep rule, re-run at +$10k:** <ul><li>economy (12 seasons): the Gold champion gained $164k–$208k a season (under $500k: **asserted again**). A bottom-three season went backwards 3 times in 4: S2 gained $47,275, S4/S5/S6 lost $16,577–$28,729. The underdog lost $16,760 over its 4 bottom seasons, less than it had, and was sold after season 8. Both bottom-club lines **stay reported** (Q-1).</li><li>ai-club-economy (30 seasons): **24 AI clubs sold** (asserted again, `RULE_IS_ASSERTED = true`).</li></ul> **Suites:** economy 5/5, ai-club-economy 19/19, money-pass 22/22, staff-bonuses 22/22, finances-ledger 31/31. |

| 2 | Runner-up prize: a third of the purse (Q-3) | Done: tested, **A kept** (B fails the 22 Sep rule) | `e5eb583` (report only) | Both tables are above. No game code changed: B lived only in the throwaway copy. Suites: economy 5/5 and ai-club-economy 19/19 under A (item 1's runs); 4/4 and 19/19 under B in the copy. |
| 3 | Music: fade only three songs; the full Champions (Rob's correction, replacing the brief's "fade every song") | Done | `a24cf10` | **The player** (`components/music/music-provider.tsx`): only `barefoot-tonight.mp3`, `burn-under-the-sun.mp3` and `rum-under-the-palms.mp3` fade, over their last 5 seconds (the slider's level times what is left), on a timer so it also runs with the window hidden. Skip, Mute and the slider keep working during a fade, and the next song starts at the slider's level. No fade was ever added to the other songs. **Files:** <ul><li>`champions.mp3` is now `Downloads\Champions-full-02oct.mp3`, byte for byte, with no fade and no loudness change;</li><li>`bobby-farquhar.mp3` was an older re-encode in the game (last night's comparison) and is now your original, byte for byte, so every file matches your originals;</li><li>no other file is touched.</li></ul> **Proof:** <ul><li>`docs/proof-02oct-pm/music_files_identical.txt`: all 18 files identical (MD5) to your originals (Champions to the new file);</li><li>the music-ends proof, extended, played every song from 6 s before its end: the three fall from 0.40 to 0.001–0.006; the other 15 stay at 0.40 to their end; every handover is clean with the next song at 0.40, 18 of 18;</li><li>Champions plays 119.96 s to its natural end, unfaded (`music_fade_three.json`).</li></ul> |
| 4 | Youth wage stays fixed by talent (Q-7) | Decided: no change | — | Rob, Q-7: a youth's wage stays the academy wage for her talent (overnight N-33). Nothing changed. |

| 5 | Launch package (items 1–3) | Done | built from `56e741a` | `C:\build\vbe-unity-02oct-pm2\win-unpacked` (602 MB, electron-builder `--win dir`, output redirected). **Full harness on the launch branch first** (`a24cf10`, items 1–3; later commits before the package are docs only): **99/99 suites, 1,590/1,590 checks, ALL HARNESSES PASSED** (13:52–14:48). before-pack: only the Brotli Unity files packed; better-sqlite3 loads under Electron. after-pack: starter DB clean, no steam_appid.txt, steamworks.js unpacked. **Not launched:** its own server, run by its exe, booted on a **copy** of your 2 Oct save; your career loaded and the page and Unity files were served. Its bundle has the +$10,000 bonus, the three-song fade and your full Champions (MD5 identical). The two add-ons came after this package and are not in it. |
| 6 | feat-ai-buyable: the rollover trace count | Done | `55d9132` | One line in `harness/rollover.mjs`: the "every senior is traceable" count now includes the seniors at AI clubs (traced through their clubs). Season rollover alone on the branch: **90/90**. AI clubs' original players still don't age (A-6 is open: no change to ageing). |
| 7 | feat-job-market: manager moves on your timing (J-2, J-3, J-4) | Done (suite and touched suites green; see the rollover note) | `cb38e0c` (merged with item 6: `49134e3`) | **Your board** (`board-confidence.ts`): a second failed season running is outcome "sacked", by the same bands as the AI boards. The final warning now says so. **The off-season window** (`utils/managerMoves.ts`): it opens when your club has played its last match (a club out of the finals finishes earlier) and lasts until the next season starts. When it opens, the AI boards judge their managers and the sackings are in the day's news. Jobs open from then on stay open into the next season. **In the window** (Job Market page): <ul><li>the board's verdict on you;</li><li>Resign;</li><li>Break Contract, with the $25,000 clause paid at once;</li><li>Apply to any vacancy;</li><li>AI clubs' offers (poaching): from clubs with a vacancy, and from clubs whose board wants a better manager (theirs is on a failed season), judged on your level and on your season (none after a failed season). Accept or Decline; a declined offer is not made again.</li><li>Retire.</li></ul> **Mid-season:** no sackings and no moves. Resign and Break Contract say "You can leave once your season is over (penalties apply if you break your contract)." The abandonment sacking is recorded and takes effect at the season's end. **At the season's start** every move happens: to the club you agreed. If you must go (sacked, club sold, resigned or broke the contract) with nothing agreed: the best open club you qualify for, else the open club with the lowest rating, else the lowest-rated club (its manager steps aside), and it says so. **Seeking a club** is gone. A club taken at the season's start has left its regional league, so it is never in the World Tour twice; if it was already drawn into the new field, the next club outside the field takes its seat in this career's fixtures. **Proof:** <ul><li>`harness/ai-job-market.mjs` rewritten: **22/22** (mid-season refusals in your words; the window opens at the last match; AI sackings announced with reasons; offers, one declined and one accepted; the move at the season's start with record, achievements and level kept, and the club not twice in the field; your board's verdict in the window and the sacking at the season's start; placed at the lowest-rated club "and says so"; break contract with the penalty; retire ends it);</li><li>job-market 54/54, career-ends 10/10 and board-review 60/60, rewritten for the new timing.</li></ul> **Alone on the branch:** <ul><li>**season rollover 88/90.** Both failures are in its 20-season career, which your new rule now sacks and moves: (1) the suite counted the season's matches from the new club's totals, a negative count (suite fixed: it reads the old club's totals); (2) a real bug: the academy youths who came with a taken club were given senior contracts, which the renewal route refuses (fixed in `job-market.ts`: the academy's youths get none). Both fixes are committed on the branch, but couldn't be re-run before 16:15: the server build was locked by the running test servers.</li><li>**ai club economy 13/14.** The one failure, "a run separates the clubs that made money from the ones that lost it", needs some club to lose money. This branch is still on +$20,000 a week: your +$10,000 (item 1) is on the launch branch and comes in with `try-02oct` (item 8). So every club makes money and none is sold. The 30-season rule is checked at +$10k in item 8's run.</li></ul> |
| 8 | Try package: `try-02oct` (launch items 1–3 + feat-job-market + feat-ai-buyable) | **Partly done: merged, full harness FAILED, package NOT built** | `c65bb69` (run), `eb5382a` (two fixes after it) | **Merge:** the launch branch at `a24cf10` + feat-job-market (with feat-ai-buyable, `49134e3`/`67f5201`). **Full harness, once** (14:49–16:00): **95/100 suites, 1,620/1,625 checks, HARNESS FAILED.** The six failures: <ol><li>**invented content removed** (R-43): the guard's pattern matched the new poaching code (offers from AI clubs), not invented content. Fixed by narrowing the pattern to the old fake "poaching" pool; **now 11/11 alone** (`eb5382a`).</li><li>**commentary she:** one match line read "He leaves…" for the manager. Now "The manager leaves at the end of the season."; **now 6/6 alone** (`eb5382a`).</li><li>**market order:** a worktree artifact. The worktree's files have Windows line endings, which the suite's source check reads wrongly. The same code passes 4/4 in the main tree. Not a game fault.</li><li>**ai club economy:** the check that a club sold to new owners comes back healthy failed: "Athens Aegean Stars carries -$61,196 after changing hands". This is a real outcome of +$10k a week combined with AI clubs that buy players (feat-ai-buyable): a sold club can now restart below $0. **Not fixed** (Q-8).</li><li>**staff portraits:** "Rob's 2 Oct backup is on this machine" failed because the file has gone from Downloads (see the top). It is a missing file, not a code fault, and it fails on any branch until the backup is back.</li><li>**ai job market:** a test-setup fault. The check "with no club he qualifies for, the open club with the lowest rating takes him" got "Santiago Atacama Aces take Rob Bonner on". The suite left a vacancy he qualifies for, so the best-qualified rule (correctly) won. The suite must clear those vacancies first. **Not fixed.**</li></ol> **So no try package was built.** The next run needs fixes 4 and 6, and the backup back in Downloads (or `VBE_ROB_BACKUP` set). |
| Add-on | Music bar: Play/Pause and the song list (launch branch) | Done | `1a69094`, `087be9a` | Play/Pause beside Mute (remembered across pages and restarts); the title opens the list of all 18 (the one playing highlighted); a picked song plays from its start, then the shuffle carries on. Skip, Mute and the slider are unchanged; no song file was touched. `scripts/webgl-proof/music-bar-proof.mjs`: 6/6 (pick, pause, play, skip, remembered pause, list). Screenshot: `docs/proof-02oct-pm/music-song-list.png`. music-playlist suite 28/28. |
| Add-on | Reference corrections (launch branch) | Done | `f4db408` | **Starter DB and seed scripts:** <ul><li>Aoife O'Sullivan (EUR_09_P2) plays for Dublin Emerald Spikers;</li><li>Yasmin Grech (EUR_10_P2) for Lisbon Atlantic Blaze;</li><li>AUS_08_P2 is Salote Taufa;</li><li>AUS_04 is Maui Hula Warriors.</li></ul> **Existing saves, at boot:** the reference sync now carries a pool player's club and name and a pool club's name (`ensureSchema.ts`). `utils/referenceRenames.ts` moves each player's live contract row to her new club (same row, same end date) and renames the club in stored fixtures/results, ladders, ledger lines, history and medals. Only rows that still say the old thing change, so a second boot changes nothing. **Proof:** `harness/reference-corrections.mjs` **11/11** (now in run-all), run on the starter DB and on a copy of `%TEMP%\bk02b.sqlite` (the byte copy of your 2 Oct backup): <ul><li>Aoife: contract #1190, EUR_09 → EUR_10, to 2026-07-01;</li><li>Yasmin: contract #1192, EUR_10 → EUR_09;</li><li>stats unchanged;</li><li>3 stored matches now say Maui Hula Warriors, 0 the old name;</li><li>a second boot changes nothing.</li></ul> Their wages change at this boot only through the existing money pass, which re-prices every pool contract in that save by rating ($10,325 → $18,525 for Aoife), moved or not. **Alone, afterwards:** olympic-qualification 29/29 (it now finds the Hawaii club by id), fake-content-removed 11/11, pool-skin-tones 4/4, reference-data-backfill 8/8, -new-players 9/9, -update 6/6. **Not in a full harness run** (no time for one before 16:15) and not in a package. |

## Questions for Rob

- **Q-1 (item 1)** At +$10k your 22 Sep rule holds for champions and for AI sales, but a bottom-three club still gains a little now and then (S2: +$47,275), and four bottom seasons don't cost a club more than it had. Those two lines stay reported, not asserted. Is "usually goes backwards" enough, or should the bottom lose more?

- **Q-2 (item 3)** `bobby-farquhar.mp3` was an older re-encode in the game, not your file. To make every song byte-identical to your originals I put your original back (same length; it was 2 dB quieter). Say if you want the old one kept.
- **Q-3 (add-on)** Skip always started the next song playing, so Skip also ends a pause. Pause stays remembered otherwise: across pages, and when the game is restarted.
- **Q-4 (item 7)** AI clubs make offers only after a season that wasn't failed ("judged on your level and results"). Is that the rule, or should a failed season just mean fewer offers?
- **Q-5 (item 7)** "No sackings mid-season" now covers the abandonment sacking too: a club that can't put two players on the sand for 30 days loses its manager at the season's end, not on the day. Right?
- **Q-6 (item 7)** If no club has a vacancy at all when you must go, the lowest-rated AI club takes you and its manager steps aside (it says so). Fine, or should you be able to wait a season?
- **Q-7 (backup)** Your `volleyball-empire-backup-02oct-0845.sqlite` has gone from Downloads. Did you move it? Until it is back, the staff-portraits suite fails on every branch. reference-corrections fails too, unless `VBE_ROB_BACKUP` points at a copy (mine is `%TEMP%\bk02b.sqlite`, byte-identical to it as it was this afternoon).
- **Q-8 (item 8)** With +$10k a week and AI clubs that buy players, a club sold to new owners can restart below $0 (Athens: −$61,196). Should the new owners clear the debt, or should the sale price be what makes a sold club whole?
- **A-6** (AI clubs' original players don't age): still open, unchanged as asked.

## What Rob must check on screen

**Launch package `C:\build\vbe-unity-02oct-pm2`:**
1. Finances: sponsor income about $10,000 a week lower than this morning's build (item 1).
2. Music: Barefoot Tonight, Burn Under the Sun and Rum Under the Palms fade out over their last 5 seconds; every other song ends exactly as recorded; Champions plays the full 2:00 (item 3).

**Launch branch after the package (not in a package yet):**
3. The music bar: Play/Pause beside Mute; the song title opens the list of 18 (the one playing highlighted); a picked song plays from its start (add-on).
4. Maui Hula Warriors in the fixtures and past results; Aoife O'Sullivan at Dublin, Yasmin Grech at Lisbon; Salote Taufa at Tonga (add-on).

**Try package `C:\build\vbe-try-02oct`: NOT built** (item 8's harness failed). Once it is built, check:
5. Mid-season, Resign or Break Contract on the contract page: "You can leave once your season is over (penalties apply if you break your contract)."
6. After your last match of the season: the Job Market's window, your board's verdict, AI clubs' offers (accept or decline), vacancies to apply for; the move at the next season's start.
7. Player Market, "At AI Clubs": buy an AI club's player (from this morning).
