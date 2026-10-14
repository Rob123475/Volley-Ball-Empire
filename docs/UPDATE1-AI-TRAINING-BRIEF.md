# Update 1, item 3: AI clubs train and develop

Branch: **update-1**. Item 2 (manager faces) is committed (a01d6a1, status db67e2b).

## Rules of engagement
- Work on update-1 only. Commit after each step with a clear message. Do NOT push until Rob has done his on-screen check.
- No guessing: read the code before changing it. If something in this brief doesn't match the code, stop and report. Don't invent a workaround.
- Delete dead code you replace. Don't layer new code over old. No second, parallel training system.
- Line endings: keep each file's existing line endings (the repo is LF).
- **No builds and no test runs during this item (Rob, 14 Oct).** Write the new suite and add it to run-all, but don't run it, or anything else. Commit and move on. ONE full `pnpm run build` (which runs the whole harness itself; never run run-all again after it) happens at the end of Update 1, and any failures get fixed then. The per-step commits are how a failure gets traced back to its item.
- Write the report to docs/STATUS-UPDATE1-AI-TRAINING.md.

## What the game does now (read 14 Oct, check it's still true)
- **AI academies already develop.** utils/youthLoans.ts aiAcademiesWeekTx gives every AI academy youth a weekly academyWeek(...), the same as the player's academy. Keep that. Only add the speciality (below).
- **AI seniors never train.** An AI club's seniors are career_player_state rows with pool_team_id set (utils/aiSquads.ts). routes/calendar.ts calls materializeAiSeniorsTx every week, so after the first week every pool player is a career row. Their stats never change, so the AI world stays frozen while the player's squad grows.
- **The player's training:** routes/training.ts applyFatigueAndStats. It gives base XP of 25–35, times the programme, coach, philosophy, age, potential, facility, academy and manager multipliers. The primary stat goes +1 every 100 XP, the secondary +1 every 200 XP, capped at 99.

## What to build
1. **One XP rule, shared.** Pull the XP-and-stat part of applyFatigueAndStats (base XP, the multipliers, the 100/200 milestones and the 99 cap) into one exported function. The player's training calls it exactly as before, with the same numbers, the same results and the same harness counts. AI training calls the same function. Do not copy the formula.
2. **AI seniors train weekly.** In the same weekly block in routes/calendar.ts, straight after materializeAiSeniorsTx, every AI club's seniors each get ONE training session through that shared function:
   - Programme: the one whose primary stat is that player's lowest of power, speed, defense, serve and block. Ties go in that order. No Conditioning and no Recovery.
   - Multipliers: the programme's own, age, potential (a senior with no potential grows as Average, the existing rule), and the AI manager's Coach speciality (+10% senior XP). AI clubs have no coach, facilities or philosophy, so those are 1.
   - XP and stats only. No fatigue, morale, injury or focus changes for AI players.
   - Each player's trainingPoints carries over week to week, like the player's squad.
3. **One knob for item 6.** `AI_TRAIN_EVERY_WEEKS = 1` in utils/aiSquads.ts (or a new utils/aiTraining.ts). AI seniors train only in weeks where the career's week number is a multiple of it. Item 6 will set Easy = 4 and Hard = 1. Nothing else reads difficulty yet.
4. **M-6 switches on for AI clubs.** Remove the "player's club only" guard for exactly these two, so an AI club's own manager counts:
   - Coach: +10% AI senior training XP.
   - Youth Developer: +15% AI academy XP. Pass the factor into academyWeek in aiAcademiesWeekTx, which already takes `factor`.
   The other six specialities stay player-only for now (AI clubs don't scout, negotiate or take sponsors that way). Use the same specialityFactor helper from item 2, with the AI club's face from career_pool_team_state. Don't make a second lookup.
5. **Ratings follow.** Club strength, ranking-point earners, Olympic athletes, the 3D court opponents and market prices all read aiSquadsTx, so they pick up the new stats with no change. Check this, don't assume it. If anything caches an AI player's rating or stats, stop and report.

## Harness (new suite: harness/ai-training.mjs)
1. The player's training: the same session on the same seeded player gives the same XP and stat gains as before the refactor.
2. After one week, every AI senior's trainingPoints went up. The programme matches her lowest stat, and no AI player's fatigue, morale or injury changed.
3. A senior on a Coach-managed AI club gains about 10% more XP than the same player on a non-Coach club. A Youth Developer AI academy gains about 15% more. A Negotiator AI club gets nothing extra anywhere.
4. With AI_TRAIN_EVERY_WEEKS = 4, AI seniors train in 1 week of 4, and not in the other 3.
5. No stat goes above 99.
6. **Balance report (numbers, not pass/fail):** simulate 3 seasons and print the average AI senior rating and the average AI club strength at the start and at the end of each season, next to the player's starting squad. Rob wants to see the world grow, not run away.

## When done
All steps are committed, and STATUS-UPDATE1-AI-TRAINING.md says what was done, what wasn't run yet (the balance report runs in the end build), and anything that didn't match this brief. Then go straight on to docs/UPDATE1-SALARY-CAP-BRIEF.md. Rob's on-screen check happens at the end of Update 1: play a few weeks, open the Player Market or Qualified Teams, and see an AI player's stats tick up.
