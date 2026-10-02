# Afternoon brief Fri 2 Oct 2026: status

Brief: `C:\Users\rbonn\Downloads\AFTERNOON-BRIEF-02OCT.md`, in its order, plus Rob's two corrections sent during the run:
- **music:** fade only three songs, and the full Champions;
- **add-on:** a music bar upgrade, after the brief's items.

Ground rules:
- Your live save is never opened: tests use copies of the starter DB or of `Downloads\volleyball-empire-backup-02oct-0845.sqlite`.
- One full harness run at a time.
- No Steam upload. The key check runs on every push.

SUMMARY-PLACEHOLDER

## Items

| # | Item | Status | Commit | What changed, and how it is proven |
|---|---|---|---|---|
| 1 | Sponsor raise +$10,000 a week (Q-2) | Done | `f4a7480` | **Changed:** `lib/db/src/schema/money.ts`: `sponsorWeeklyBonus` from $20,000 to $10,000. **Older saves:** nothing stored the old figure; sponsor income is computed each week from the club's reputation plus the bonus (`clubFinances.ts sponsorWeeklyIncome`, used by the weekly tick, the AI clubs' week and the Finances forecast). So a save raised at +$20,000 earns +$10,000 from its next week on, and past ledger lines stay as they were paid. **22 Sep rule, re-run at +$10k:** <ul><li>economy (12 seasons): the Gold champion gained $164k–$208k a season (under $500k: **asserted again**). A bottom-three season went backwards 3 times in 4: S2 gained $47,275, S4/S5/S6 lost $16,577–$28,729. The underdog lost $16,760 over its 4 bottom seasons, less than it had, and was sold after season 8. Both bottom-club lines **stay reported** (Q-1).</li><li>ai-club-economy (30 seasons): **24 AI clubs sold** (asserted again, `RULE_IS_ASSERTED = true`).</li></ul> **Suites:** economy 5/5, ai-club-economy 19/19, money-pass 22/22, staff-bonuses 22/22, finances-ledger 31/31. |

## Questions for Rob

- **Q-1 (item 1)** At +$10k your 22 Sep rule holds for champions and for AI sales, but a bottom-three club still gains a little now and then (S2: +$47,275), and four bottom seasons don't cost a club more than it had. Those two lines stay reported, not asserted. Is "usually goes backwards" enough, or should the bottom lose more?

## What Rob must check on screen
