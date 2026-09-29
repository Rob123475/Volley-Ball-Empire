# Overnight status, 29/30 Sep 2026

Rules followed: one item at a time (harness green, commit, push, proof line in the item's status file); Rob's live save never opened
(tests used copies of the starter DB, or of Downloads/volleyball-empire-backup-29sep-1136.sqlite); no Steam upload. Branch `fix-batch-29sep`
(game repo); Unity repo `main`.

**Harness:** every item green in its own full run; final tree (b332837, all items) 73/73 suites. Details below.

## FIX-BATCH-29SEP (docs/FIX-BATCH-29SEP-STATUS.md)

| # | Item | Status | Commit |
|---|---|---|---|
| 1 | D-1 Upgrade Ready for a building already bought | DONE | `594b125` |
| 2 | D-2 Club picker budget vs real starting money | DONE | `4af3f7f` |
| 3 | D-3 One building, two names | DONE | `27d1b75` |
| 4 | D-4 "−0 fatigue/session" on the Nutrition Centre | DONE | `f678af9` |
| 5 | D-5 Match Day box says "Your Team" | DONE | `fe3fec0` |
| 6 | D-6 Euro sign on the prize | DONE | `39d6a53` |
| 7 | Q-1 Established career shows Bronze (investigate only) | REPORTED, no code change | `2c0559a` (report only) |
| 8 | F-1 "Next match" button | DONE | `15b1501` |

## UNITY-MATCH-BRIEF-29SEP (docs/UNITY-MATCH-29SEP-STATUS.md)

| # | Item | Status | Commit |
|---|---|---|---|
| 1 | One set of odds | DONE | game `f6a7ea2`, Unity `54390e8` |
| 2 | Points decided on screen | DONE | Unity `4554c55` (no game-repo change) |
| 3 | Boosts that do what they say | DONE | game `8b94723`, Unity `0d3f3a2` |
| 4 | The result counts | DONE | game `19ce7bc`, Unity `5ff6480` |
| 5 | A proper finish, then straight back to the dashboard | DONE (on-screen check is Rob's) | game `dd2b81a`, Unity `f41d6f3` |
| 6 | The WebGL page looks like our game | DONE | game `9b54660`, Unity `7923da0` |
| 7 | Colour wash at the start | BLOCKED: could not reproduce | (status only) |
| 8 | Export and prove | DONE (Rob's on-screen check to come) | game `5598da3`, Unity `1f2441b` (export built from it) |
| 9 | Game music during the 3D match | DONE | `320710c` |
| 10 | Match Day only on match day | DONE | `08df3a6` |
| 11 | After a match, the clock stays paused | DONE | `948c1e8` |
| 12 | Dashboard stale after matches; WT "Sets +/-" | DONE | `0cd2b7f` |
| 13 | Finances page from the ledger | DONE | `b7247b3` |
| 14 | Injured match player: the game says so | DONE | `b03d14e`, fix `8e1034e` (b03d14e took two files with later items' lines; the fix restores the tested versions) |
| 15 | Player Market: prices, scouting, buying blind | DONE (Rob's design; questions 4-6) | `c87a893` |
| 16 | Staff slot count; Scouting line only on Scouts | DONE (question 7) | `1398a1a` |
| 17 | Staff and Medical scouting kept and shown | DONE | `5336182` |
| 18 | Training and Youth Academy | DONE | `4686ccf` |
| 19 | Training takes game days | DONE (lengths Rob-approved 29 Sep) | `d13e928`, fix `35b2415` (d13e928 recorded the item 15 starter DB; the fix commits the DB the run tested) |
| 20 | Club pages | DONE (Trophy Cabinet count: item 21) | `aa37585` |
| 21 | Achievements check | DONE (Steamworks not checkable from here: questions 8-9) | `b332837` |

## Every question for Rob

1. (Fix batch) **Q-1 (item 7):** an Established career is paid full Silver purses from day one, as the wizard says, but its badge says Bronze and its first five events (all Bronze, 17 Feb - 8 Mar) pay it exactly what they pay an Underdog; the difference starts at the first Silver event, 12 Mar. Keep as is, show the purse tier on the badge, change the wizard wording, or change what Established means in season 1?
2. (Unity brief) **Item 1, the favourite's edge in shorter sets.** The per-point model is unchanged, but 11-point sets compound it less than 21-point ones. At the game's own chances (game engine, 20,000 matches each): per-point 0.52 -> 60.8% match win, 0.54 -> 72.1%, 0.56 -> 81.0%, 0.58 (the cap) -> 88.0%. Under 21/21/15 the engine's comment gave a 10-rating edge about 65% and the cap about 93%. Keep, or steepen POINT_EDGE_PER_RATING to restore the old spread?
3. (Unity brief) **Item 3, boost sizes.** Attack +0.04 and Defence +0.03 per point, 3 points on and 5 off. Used every time they are ready, an even match goes from 52% to 58-61%, and a pair 10 rating points weaker from 40% to at most 49%. Rob to tune: bigger shifts make boosts matter more but let a weaker pair win.
4. (Unity brief) **Item 7, the colour wash.** Not reproduced (headless GPU and the game's own Electron, 40 s of frames each). To find it I need: roughly how long after the court opened it appeared and how long it lasted; whether the court was the whole window or you had resized it; whether the Attack/Defence boost was pressed at the time; and, if it happens again in the new build, a phone photo or a screenshot (Win+Shift+S) while it is on screen.
5. (Unity brief) **Item 15, the price.** A player's price is one month of her asking wage, shown unscouted as that figure -15% to +15% (rounded out to $500), e.g. $5,500 - $8,500 for a $7,000/month player; the exact price is a fixed point inside. It is charged once on signing, on top of the wage. Is that the scale you want (your example was $8,000 - $10,000)? When she comes from another club in the transfer window, the fee is charged but paid to nobody: should the selling club receive it?
6. (Unity brief) **Item 15, scouting cost.** Scouting a player is still free (the brief gave no cost); staff scouting costs $1,000. Charge for player scouting, and how much?
7. (Unity brief) **Item 15, new senior players.** "Refresh Pool" (30 generated pool players, free, any time) went with the old Player Pool. New seniors now enter the market only as today (graduates, releases, contract expiries, retirement churn). Do you want another source of new senior players?
8. (Unity brief) **Item 16, medical staff and the 8.** The server's rule (unchanged, now stated once) counts medical staff in the club's 8, with at most 4 of them medical. Or do you want two departments: 8 staff plus 4 medical?
9. (Unity brief) **Item 21, Steamworks.** Please check Steamworks > Stats & Achievements shows 29 (Sold On deleted, not hidden: the code comment of 23 Sep says it was deleted). I could not see it: the public page for app 5233750 says "No stats are available" until release, and the partner site needs your login.
10. (Unity brief) **Item 21, two Steam descriptions.** Future Superstar and Star Factory could never unlock (they read a column only retirement writes). Their rule now means developing a player; please update the Steamworks descriptions to match the game: Future Superstar "Develop a player to an 85 rating: she joined your squad rated under 85 and reaches 85 while in it." Star Factory "Develop 3 players to an 85 rating: each joined your squad rated under 85 and reached 85 while in it."

## How the harness was run

The full harness (harness/run-all.mjs) takes about 40 minutes. To keep working while it ran, each item's run used a separate copy of the tree (C:\vbe-snap) holding exactly that item on top of the commits before it (later items' files set back to the last commit, shared files in that item's own version, @workspace packages pointed at the copy's own lib/), rebuilt there. Results, suites passed / suites run:

- Items 11-13: 63/63, 64/64, 65/65.
- Item 14: first run 65/66 (olympic-qualification: its healing came after match day began, so the new substitution brought the interchange on; the suite now heals before each day, 29/29). Second run 64/66: job market and AI club economy failed because my own test runs on the main tree held their ports at the same moment; both re-run alone in the same copy: 54/54, 19/19.
- Items 15-21: 67/67, 68/68, 69/69, 70/70, 71/71, 72/72, 73/73. Item 21's run is the final tree (`b332837`).

## Two commits corrected after the fact

- `b03d14e` (item 14) took the working copies of calendar.ts and condition.ts, which already held lines from items 19 and 20, so it did not build on its own. `8e1034e` restores the versions item 14's run tested.
- `d13e928` (item 19) recorded item 15's copy of the starter DB (same size, copied timestamp, so git saw no change). `35b2415` commits the DB item 19's run tested.

## Local package (not uploaded)

C:\build\vbe-unity-30sep\win-unpacked\Beach Volleyball Empire.exe, electron-builder --win dir from the tree with every item (after-pack checks: starter DB alone, no steam_appid.txt, steamworks.js unpacked). Not launched here: the packaged game opens the real save folder. The Unity WebGL build in it is item 8's (no Unity changes since). C:\build\vbe was not touched. No Steam upload.

## Unity repo

No Unity changes after item 8 (`1f2441b`); ProjectSettings/UnityConnectSettings.asset left uncommitted, as before. Proof screenshots for items 13, 14, 15 and 20 are in the Unity repo's proof/ folder (not tracked by git): u13-finances-*.png, u14-injury-*.png, u15-market-*.png, u20-club-*.png.
