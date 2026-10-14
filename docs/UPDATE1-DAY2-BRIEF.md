# Update 1, 15 Oct (day): fixes from the overnight report

Branch **update-1**. Rob is out for about 4 hours, so work straight through without waiting for him. Rob answered "yes" to every recommendation on the Overnight Results page (O-1 to O-5).

## Rules
- Same as the overnight brief: don't stop to wait. Make the most reasonable choice, write it under "Decisions made today" in the report, and carry on.
- Never push. Never touch main or launch-final. Commit after each step.
- Read the code before changing it. Delete what you replace. One set of rules for every club. Every number goes in one place.
- Keep LF line endings.
- **Testing today:** after each part, run only the suites that part touches, each on its own. **No full `pnpm run build` today.** It runs tonight, after Rob's images are in.
- Report: **docs/STATUS-UPDATE1-DAY2.md**, written as you go.

## Part 1: O-1, AI clubs can afford a squad of 3 (the money)
- Same rule for every club: raise `MONEY.sponsorWeeklyBonus` (now $10,000 a week, every club).
- **Work the figure out, don't guess it.** Take the median AI club with 3 seniors at the real wages (the 4a rise included) and its coach and medic, on Medium. Find the weekly bonus that makes its balance roughly level over a season, prize money and running costs included. Round it to $500.
- Re-run harness/long-career-update1.mjs, 5 seasons on Medium. Pass if:
  - the median AI balance stays within ±$150,000 of its start every season;
  - fewer than 10 AI clubs are below zero at any season end;
  - at least 40 AI clubs hold 3 seniors in every season.
- Then run Easy and Hard for 2 seasons each.
- If one figure can't meet that, report the closest and what's in the way. Don't change other money rules.
- Check the player's club with the same bonus: a normal club shouldn't be rolling in money. Report its balance over the 5 seasons.
- Update the tests that knowingly read the old figure (money-pass, ai-club-economy, finances-ledger and any others), and re-run them alone.

## Part 2: O-3, doctors and medical specialists work, for every club
- **Doctor:** injuries heal faster, using the same mechanism and scale as the physiotherapist's healing bonus (a chance of an extra week off each week, rising with skill above 50, at most what the best physio gives). It stacks with the physio the way the existing healers stack. If they don't stack, the best one counts, and you report which.
- **Medical Specialist:** lowers injury risk, up to −15% at skill 95 (skill above 50 scale, like staffBonuses.ts), in the one `injuryRisk` function.
- Both read staff on duty only, for the player's club and AI clubs alike (AI medics come from part 1a's deal).
- The Medical page shows the real numbers from these functions. Delete the "+% recovery" display that nothing read, or point it at the real figure.
- Add checks to the staff-bonuses and ai-staff suites, and re-run them alone.

## Part 3: O-4, the AI clubs' original players age
- Delete the U-6 "originals don't age at an AI club" exception. They age, fade (B-2) and retire at 40, like every player.
- Re-run the rollover, retirement, ai-club-economy and ai-training suites alone. Update any check that knowingly expected timeless originals.
- In the soak (part 1), report how many originals retire over 5 seasons, and that AI clubs still field 3.

## Part 4: O-5, the rare renewal bug
- The season-rollover check "no renewal refused as 'no longer in your squad'" failed on the path where the career is sacked and takes over a club the board sold (routes/job-market.ts inserts a contract for every player who comes with the club).
- Find the stale contract row, fix the cause (a player who leaves a club must not keep a live contract row there), and add a check that drives that exact path on purpose, not by chance.
- Re-run season-rollover and ai-job-market alone. Run the rollover suite twice more.

## Part 5: O-5, match sound volume in Settings (Unity)
- Use the same Unity project, build steps and proof method as the 11 Oct court work (docs/STATUS-11OCT.md).
- Add a Unity method that the court page can call with a volume: one for crowd and one for commentary, or one master volume if the audio isn't split. Read the audio setup first and report which.
- The page sends it the same way as the control mode (`MatchManager.SetControlMode`'s message path), on load and when changed.
- Add the slider or sliders to Settings > Sound, stored like the music volume.
- Rebuild WebGL, put the build where the game loads it (as on 11 Oct), and prove it with a batch or browser proof: the volume changes, and 0 is silent.
- If the Unity build can't run on this machine now, write exactly why, leave Settings without the slider, and carry on.

## Part 6: Get ready for Rob's staff portraits (O-2)
Rob will make **90 staff portraits** when he gets home:

| Role | Portraits |
|---|---|
| Head Coach | 25 |
| Assistant Coach | 25 |
| Doctor | 10 |
| Physiotherapist | 10 |
| Massage Therapist | 10 |
| Medical Specialist | 10 |

1. Create these empty folders on his desktop: `C:\Users\rbonn\OneDrive\Desktop\staff portraits\` with one subfolder per role, named exactly: `Head Coach`, `Assistant Coach`, `Doctor`, `Physiotherapist`, `Massage Therapist`, `Medical Specialist`. Check the Desktop path first: Rob's manager cards were under `C:\Users\rbonn\OneDrive\Desktop\`.
2. Write `scripts/install-staff-portraits.cjs` on the same pattern as install-manager-faces.cjs and the existing staff portrait crop (scripts/portraits/crop-staff-portraits.py). It should:
   - read each role folder and crop to the existing staff portraits' size and format;
   - take age, gender and nationality from the file name where the name gives them (as the manager faces did), and list any it can't read;
   - write each new person into the staff data (role, skill, wage on the existing rules), with the name from a names file `docs/staff-portrait-names.json`, which Claude (chat) will write once the pictures exist. Don't invent names.
   - Don't run it: there are no pictures yet. Test it on 2 copies of existing staff portraits in a temp folder, then delete them.
3. Check the AI staff deal takes the new people with no code change, with marketFloor 5.

## Part 7: Report
At the top of STATUS-UPDATE1-DAY2.md:
- each part done or not;
- the new sponsor figure and the soak tables;
- the suites re-run and their counts;
- the Unity result;
- the exact folder paths for Rob's portraits.

Then stop.
