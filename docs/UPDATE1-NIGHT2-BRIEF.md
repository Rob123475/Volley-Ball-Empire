# Update 1: night 2 (15–16 Oct 2026). Finish, test, build

Branch **update-1**. Rob is asleep. In the morning he wants a quick on-screen look and then the Steam upload. So tonight is: finish the last features, install the staff portraits, test everything, and make the release build.

## How to work tonight (read first)
- **Don't stop to wait for Rob.** Make the most reasonable choice that fits his decisions below, write it under "Decisions made overnight" in the report, and carry on. Skip a step only if it truly can't be done without him, and say why.
- **No time limit (Rob, 22:22):** finish every feature in Parts 1–6 before any testing, however long it takes. Rob would rather start an hour or two later in the morning. Then do Parts 7–9 in full.
- Never push. Never touch `main` or `launch-final`. **Never upload anything to Steam.** Commit after each step.
- Use test profiles only. Never open or change Rob's own save (AppData). His live Steam game uses it.
- Read the code before changing it. Delete what you replace: the old way goes, it doesn't sit beside the new one. One set of rules for the player's club and every AI club. Every number goes in one constants block. Keep LF line endings.
- No full builds until Part 7. Write each new suite and add it to run-all as you go.
- Report: **docs/STATUS-UPDATE1-NIGHT2.md**, written as you go.

Rob's decisions are on the "Overnight Results" page, items O-6 to O-10 (15 Oct). They're written out in full below.

---

## Part 1: Install Rob's 123 staff portraits
- **Rob's pictures:** `C:\Users\rbonn\OneDrive\Desktop\extra download cards\<role>-extra\`, 9 folders. **Copy** them, never move them, into the installer's role folders under `C:\Users\rbonn\OneDrive\Desktop\staff portraits\`:

  | Rob's folder | Role folder |
  |---|---|
  | head coach-extra | Head Coach |
  | assistant-coach-extra | Assistant Coach |
  | doctor-extra | Doctor |
  | Physiotherapist-extra | Physiotherapist |
  | massage-therapist-extra | Massage Therapist |
  | medical-specialist-extra | Medical Specialist |
  | fitness-trainer-extra | Fitness Trainer |
  | strength-conditioner-extra | Strength Coach |
  | sports-science-extra | Sports Scientist |

  That's 25 + 25 + 11 + 11 + 10 + 10 + 10 + 10 + 11 = 123.
- **Names:** `docs/staff-portrait-names.json` (written by Claude chat; it's already in docs). Every picture has an entry by its exact file name: name, age, nationality and gender, read off the file name or the picture. Most file names are cut short, so use the entries, not the file names.
- **Installer changes** (scripts/install-staff-portraits.cjs):
  - add the roles Fitness Trainer, Strength Coach and Sports Scientist to `ROLES`, with the same picture folders the game already uses for them;
  - add `Iranian: "Iran"` and `"Puerto Rican": "Puerto Rico"` to scripts/lib/nationality-words.cjs, and check the game knows both countries (flags, nationality lists). If it doesn't, add them the way the others are, or use the nearest that works and report it.
- Run the dry run, fix every problem it lists, then run `--write`.
- **Name clashes:** check no new name matches an existing staff member, manager face or player in the game. If one does, change the surname to another real one from the same country, and record it.
- **Check the deal:** count the market after the AI clubs' Day 8 deal, with marketFloor 5. Every AI club should now get a coach and a medic. Report the counts per role.
- Existing saves get the new people on boot (Day-2 work). Confirm.

## Part 2: O-6, every staff role does its own job
Rob's words: "each job has its own distinct advantage." One constants block (utils/staffBonuses.ts or a new schema file). Everything works on the "skill above 50" scale, full at 95, for every club including AI clubs, and only for staff on duty.

| Role | Does |
|---|---|
| Head Coach | training XP up to +15% (as now) |
| Assistant Coach | training XP up to +8% (as now) |
| Fitness Trainer | up to −5 tiredness per session (as now) |
| Promotional Manager | sponsor money up to +18% (as now) |
| Scout | needed to scout; accuracy by skill (as now) |
| **Strength Coach** | power and block training XP up to +10% |
| **Massage Therapist** | up to **5** more tiredness off every day (on top of the daily rest) |
| **Nutritionist** | stamina training XP up to +10% |
| **Sports Scientist** | injury prevention: the whole squad's injury risk up to −15% |
| **Medical Specialist** | reconstructions (Part 4). Delete its "−15% injury risk" from 15 Oct: that's now the Sports Scientist's job |
| **Doctor / Physio** | treat injuries (Part 3) |

- **Delete the old "healer" system:** the weekly chance of an extra week off from the best of fitness trainer, strength coach, massage therapist, physio and doctor (`healingBonus`, `MEDICAL_BONUS.healerKeys`, and the Recovery Program's use of it). Part 3 replaces it.
- The **Staff and Medical pages** show each member's real effect, worded from these numbers, and nothing that isn't real.

## Part 3: O-7, real injuries, treated by the right person
- **Replace** "Minor Injury" (1 week), "Major Injury" (3) and "Unavailable" (6) (lib/db/src/schema/injuries.ts, `rollInjury`) with named injuries. Each one has a body area, who treats it, and base weeks:

  | Injury | Area | Treated by | Base weeks | Share |
  |---|---|---|---|---|
  | Cramp or strained muscle | leg | Physio | 1 | 40% |
  | Concussion | head | Doctor | 2 | 8% |
  | Sprained ankle | ankle | Physio | 3 | 20% |
  | Broken finger or toe | hand/foot | Doctor | 4 | 12% |
  | Torn hamstring | hamstring | Physio | 6 | 10% |
  | Broken wrist | hand/foot | Doctor | 8 | 5% |
  | Torn shoulder | shoulder | Physio | 10 | 3% |
  | Broken leg | leg | Doctor | 20 | 1.5% |
  | Torn knee ligament (ACL) | knee | Doctor | 30 | 0.5% |

- **Time out = base × the treatment factor:**
  - neither a doctor nor a physio: ×2;
  - only the wrong one: ×1;
  - the right one: ×0.7 at skill 50, down to ×0.6 at 95;
  - both: ×0.5 down to ×0.4 (the doctor + physio pair, Part 5).

  Rob's broken leg: 40 / 20 / 12–14 / 8–10 weeks.
- **Live:** an injured player's remaining weeks follow the club's staff as they change. If the club hires the right person, her remaining time shrinks to the new factor. If they leave or fall ill, it grows back. Base it on remaining base-weeks, so it can't be gamed by hiring and firing.
- **How often players get hurt doesn't change** (the same injury roll and odds, with the Sports Scientist's −15%, injury-proneness and Fitness Guru as now). Only what the injury is and how long it lasts change. Rob: "injuries should be longer."
- **Seen everywhere:** the injury's name and area show on the Medical page, the player card (with her injury history: each injury and its date), Club News and the Player Market's injured box.
- **Existing saves:** at boot, current injuries become a named one of the same length: Minor → cramp, Major → sprained ankle, Unavailable → torn hamstring. Keep their remaining weeks, and give them no history.
- **Keep the existing rules:** an injury of 4+ weeks is "serious" (B-2: −1 speed and stamina, −5% XP) and makes an injured free agent cheap (4c). Both read the real weeks.

## Part 4: O-8, the Medical Specialist and reconstructions
- **A third injury to the same body area within 12 months** (by game date, from her injury history, every club) becomes a reconstruction instead of the rolled injury. For example "ankle reconstruction": surgery and rehab, **base 30 weeks**. A reconstruction is serious.
- **Time out:**
  - no medical staff: ×2 (60 weeks);
  - a doctor or physio: ×1 (30 weeks);
  - a specialist: ×0.5 (15 weeks);
  - a specialist plus a doctor or physio: ×0.25 (about 8 weeks).

  Live, like Part 3.
- The player card's injury history makes a repeat area obvious ("Ankle: 2 in the last 12 months").

## Part 5: O-9, partners (an extra on top of each one's own bonus)
| Pair on the books | Extra |
|---|---|
| Doctor + Physio | every injury heals at the "both" factor (Part 3) |
| Specialist + Doctor or Physio | a reconstruction's time halves again (Part 4) |
| Strength Coach + Fitness Trainer | training adds 20% less tiredness |
| Sports Scientist + Nutritionist | "better training techniques": all training XP +5% |

The Staff page shows each pair and whether the club has it.

## Part 6: O-10, the injured list, cover, and promotion at 16
- **An injury of more than 6 weeks puts her on the injured list straight away,** for every club. While she's on it she doesn't take one of the 3 senior places, so the club can promote, sign or loan in cover. **Her wage still counts towards the cap.** A promoted youth is never blocked by the cap (C-5).
- **Cover rule (Rob):** while a cover player taken on during her absence is still on the roster, she **can't play**, even when she's fit. She shows as "Fit, waiting for a place". The club must remove the spare (release, sell or loan out) before she plays again. Dashboard and Team page tell the player plainly. If no cover was taken on, she's back in the squad as soon as she's fit.
- **Promotion age drops from 18 to 16** (routes/team.ts and anywhere else that states 18 for a match place). A 16- or 17-year-old can be promoted into the seniors. Graduation at the rollover (PROMOTION_AGE 19) doesn't change. Update the Rules page and any text that says 18.
- **AI clubs:** the same injured list. An AI club with a senior on the list fills the place from its academy (best 16+), else the best free agent it can afford and fit under the cap. When she's fit, the AI club releases its weakest to make room.

## Part 7: Tests, then the full build
1. New suites, added to run-all:
   - `injury-treatment.mjs`: the named injuries and their share over many rolls; the four treatment factors on a broken leg (40 / 20 / 12–14 / 8–10); remaining weeks shrinking when a doctor is hired mid-injury; existing saves' injuries converted;
   - `reconstruction.mjs`: a third ankle injury in 12 months becomes a reconstruction; 60 / 30 / 15 / about 8 weeks;
   - `staff-roles.mjs`: each role's effect and each pair, for the player's club and an AI club; the old healer chance gone;
   - `injured-list.mjs`: over 6 weeks goes on the list; the cover rule; promotion at 16; the cap still counts her wage; AI clubs do the same.
2. Update the suites whose expectations these parts knowingly change (condition, injured-match-player, staff-bonuses, ai-staff, ai-injuries, medical and any others), and write each one down.
3. Run **ONE full `pnpm run build`**. It runs the whole harness: every suite against the real built game, so it tests the new work and how it fits the existing game together. **Never run run-all again after it.**
4. For each failure: fix the cause (or the test, only where this update knowingly changed what it expects, and write that down). Re-run **only that suite**, alone, until it passes.
5. Then run **a second full `pnpm run build`** to confirm everything passes together. Report both runs' counts.

## Part 8: The 5-season soak again
Run `harness/long-career-update1.mjs`: Medium for 5 seasons, then Easy and Hard for 2 each. Same tables as before, plus:
- injuries by type;
- average weeks out per club, with and without a doctor and a physio;
- reconstructions;
- injured-list use;
- cover players.

Check the money still holds with longer injuries:
- median AI balance within ±$150,000 of the start;
- fewer than 10 clubs below zero;
- at least 40 clubs with 3 seniors.

Fix a clear bug. For a balance question, write the numbers and a suggestion for Rob and don't retune on your own.

## Part 9: The release build (don't upload it)
1. Set the version to **1.1.0** everywhere the game states it (package.json, electron, the title screen or About if it shows one).
2. Make the Steam release build **exactly as the launch build was made on 12 Oct**: read docs/packaging.md and the launch status files, and use the same steps, folders and checks. Build from **update-1**. Put the output where the launch build went, in a new folder named for 1.1.0, so the launch build's files are never overwritten.
3. **Prove it runs:** start the packaged game with a fresh test profile. It must open, start a new career through the Day 1 draft, play a few days including a match on the 3D court, and open Settings. Record what you saw: screenshots if you can, otherwise the log lines.
4. Write the Steam patch notes, **docs/UPDATE1-PATCH-NOTES.md**: plain words, for players, listing everything new in Update 1. Rob pastes it into the Steam announcement. No technical words.
5. **Don't upload to Steam.** Rob does that himself in the morning.

## Morning report: docs/STATUS-UPDATE1-NIGHT2.md
At the top, short:
- done or not, part by part;
- both builds' counts;
- the soak tables;
- **where the 1.1.0 build is** (the exact folder) and that it ran;
- "Decisions made overnight";
- anything skipped.

Then **Rob's quick on-screen check**, 10 minutes, in order, in the 1.1.0 build with a test profile:
1. new career: a manager face and difficulty;
2. the Day 1 draft under the cap;
3. Day 8: AI clubs have staff with the new pictures;
4. the Staff page shows each role's real effect;
5. an injury with its name and time out, and how it changes when you hire a doctor or physio;
6. Settings (window, sound sliders, controls, Rules).

Finally, the exact Steam upload steps Rob used on 12–13 Oct (from the launch notes), for the 1.1.0 folder.
