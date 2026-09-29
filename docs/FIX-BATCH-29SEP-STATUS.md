# Fix batch 29 Sep 2026: status

Brief: C:\Users\rbonn\Downloads\FIX-BATCH-29SEP-BRIEF.md. Branch `fix-batch-29sep`, made from the tip of
`fix-batch-28sep` (`d2b1bc9`, the v0.9.3 report commit on top of `61a10f2`). No build, no Steam upload.
Rob's live save was never opened; every test ran on a copy of the starter DB.

## Items

| # | Item | Status | Commit | Proof |
|---|---|---|---|---|
| 1 | D-1 Upgrade Ready for a building already bought | DONE | `594b125` | **Cause:** two faults. (a) The Attention card (routes/attention.ts) chose buildings by `level < 10 && budget >= level * 20,000` and never looked at `upgrading_to_level`, so a building under construction still read "Level 1 -> 2 for $20,000". The dashboard's own facility tiles (dashboard.tsx) had the same rule and showed the amber "upgrade" badge and cost too. (b) A finished build was only collected when someone opened the Facilities page (GET /facilities ran `checkAndCompleteUpgrades`); until then the building stayed at its old level for every bonus (training XP, injury recovery, match bonuses) and for every other screen. **Fix:** one file, utils/facilityUpgrades.ts (cost, max level, round counter, `canStartUpgrade`, `completeDueUpgrades`), used by facilities, attention and events; the calendar clock now finishes builds on the day their round arrives (calendar advance step 7a); the Attention card and the dashboard tile skip a building under construction (the tile shows "Building Lv N" instead). Attention and upcoming-events also collect finished builds on read, for saves already past the round. **Proof:** new suite harness/facility-upgrades.mjs (9/9): all other buildings set to level 10 so the Training Centre is the only possible card; before buying the card reads "Level 1 -> 2 for $20,000"; bought (level 1, upgrading to 2, round 4, as in Rob's save) -> no card; 3 days later still none; the clock alone (no screen read, checked straight in the DB) finishes it on 16 Jan -> level 2 -> the card for the next level appears, "Level 2 -> 3 for $40,000"; the upcoming-events "Upgrading" card is gone. Sabotage: with the old card rule put back the suite fails 7/9, showing exactly Rob's card. Full harness 52/52 (suite added as 49/52). |

## Questions for Rob

(none yet)
