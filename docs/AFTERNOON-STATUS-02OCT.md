# Afternoon brief Fri 2 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\AFTERNOON-BRIEF-02OCT.md`, in its order, plus Rob's two corrections sent during the run:
- **music:** fade only three songs, and the full Champions;
- **add-on:** a music bar upgrade, after the brief's items.

Ground rules:
- Your live save is never opened: tests use copies of the starter DB or of `Downloads\volleyball-empire-backup-02oct-0845.sqlite`.
- One full harness run at a time.
- No Steam upload. The key check runs on every push.

SUMMARY-PLACEHOLDER

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

| 2 | Runner-up prize: a third of the purse (Q-3) | Done: tested, **A kept** (B fails the 22 Sep rule) | ITEM2-HASH (report only) | Both tables are above. No game code changed: B lived only in the throwaway copy. Suites: economy 5/5 and ai-club-economy 19/19 under A (item 1's runs); 4/4 and 19/19 under B in the copy. |
| 3 | Music: fade only three songs; the full Champions (Rob's correction, replacing the brief's "fade every song") | Done | ITEM3-HASH | **The player** (`components/music/music-provider.tsx`): only `barefoot-tonight.mp3`, `burn-under-the-sun.mp3` and `rum-under-the-palms.mp3` fade, over their last 5 seconds (the slider's level times what is left), on a timer so it also runs with the window hidden. Skip, Mute and the slider keep working during a fade, and the next song starts at the slider's level. No fade was ever added to the other songs. **Files:** <ul><li>`champions.mp3` is now `Downloads\Champions-full-02oct.mp3`, byte for byte, with no fade and no loudness change;</li><li>`bobby-farquhar.mp3` was an older re-encode in the game (last night's comparison) and is now your original, byte for byte, so every file matches your originals;</li><li>no other file is touched.</li></ul> **Proof:** <ul><li>`docs/proof-02oct-pm/music_files_identical.txt`: all 18 files identical (MD5) to your originals (Champions to the new file);</li><li>the music-ends proof, extended, played every song from 6 s before its end: the three fall from 0.40 to 0.001–0.006; the other 15 stay at 0.40 to their end; every handover is clean with the next song at 0.40, 18 of 18;</li><li>Champions plays 119.96 s to its natural end, unfaded (`music_fade_three.json`).</li></ul> |
| 4 | Youth wage stays fixed by talent (Q-7) | Decided: no change | — | Rob, Q-7: a youth's wage stays the academy wage for her talent (overnight N-33). Nothing changed. |

## Questions for Rob

- **Q-1 (item 1)** At +$10k your 22 Sep rule holds for champions and for AI sales, but a bottom-three club still gains a little now and then (S2: +$47,275), and four bottom seasons don't cost a club more than it had. Those two lines stay reported, not asserted. Is "usually goes backwards" enough, or should the bottom lose more?

## What Rob must check on screen
