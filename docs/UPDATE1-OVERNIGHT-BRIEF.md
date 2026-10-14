# Update 1: overnight run, 14–15 Oct 2026

Branch **update-1** (last commit 32b26f8). Rob is asleep for about 7 hours. Work through every part below in order, then build and test.

## How to work tonight (read first)
- **Rob is asleep. Don't stop and wait for him.** The earlier briefs' "stop and report" rules become: make the most reasonable choice that fits Rob's decisions below, write it under "Decisions made overnight" in the morning report, and carry on. Skip a step only if it truly can't be done without Rob (for example, it needs new images). Then go straight to the next part.
- Never push. Never touch `main` or `launch-final`. Commit after each step with a clear message.
- No guessing: read the code before changing it. Delete dead code you replace. One set of rules for every club: the player's club and the AI clubs go through the same functions. Every tunable number goes in ONE place (MONEY or a constants block), so Rob can tune it.
- Keep LF line endings.
- No builds or test runs until part 9. Write each new suite and add it to run-all as you go.
- Morning report: **docs/STATUS-UPDATE1-OVERNIGHT.md**. Write it as you go, not only at the end, so a crash still leaves a record. Add each part's details to the existing status files too (salary cap, AI training) where they belong.

The decisions are Rob's, from the "Update 1 Decisions" and "Salary Cap Decisions" pages, 14 Oct.

---

## Part 1: Finish the two stops from this evening

**1a. AI staff on Day 8 (stop 1).** There are 120 staff, and only 20 of them are coaches. First read utils/staff-generator.ts and utils/medical-staff-generator.ts and the staff data and portraits:
- **If** the game can create new staff members (name, role, skill, wage, portrait) under its existing rules without new image files, top up the market at career start so that after every AI club gets its 2, the player still has at least 5 of every role to choose from. Then deal on Day 8 as pasted earlier: at least one coaching (Head Coach or Assistant Coach) and one medical (Doctor, Physiotherapist, Massage Therapist or Medical Specialist) per AI club, random, normal contracts of random length, wages from the AI club's balance, never the salary cap, unavailable to the player until the contract ends.
- **If** new staff would need new portraits, deal what's available while keeping at least 5 of every role on the market for the player. Clubs that miss out get staff as contracts end, and fill one coaching and one medical at a time. Then write in the morning report exactly how many portraits of which roles Rob must make (he offered to make images). Don't invent pictures.
- Existing careers: deal AI staff once at boot, the same way.

**1b. Injured players come cheap (stop 2).** The longest injury in the game is 6 weeks, so the "3 months" threshold never triggers. Rob's B-2 rule counts an injury of **4 weeks or more** as serious, so use that: out 4 weeks or more → 50% of her wage; less → 75%. Rename the constant to weeks (`injuredLongWeeks = 4`). The AI club's no-renewal rule (4c item 4) uses the same 4 weeks.

## Part 2: Item 4c, as in docs/UPDATE1-SALARY-CAP-BRIEF.md
Plus Rob's answer: a full AI club may buy a player at least AI_BUY_GAP better than its weakest senior by releasing its weakest to the market, and the cap still applies. Plus Part 1b.

## Part 3: AI staff bonuses (B-4)
An AI club's staff give their bonuses to that club through exactly the same functions as the player's (utils/staffBonuses.ts and the medical equivalents):
- head coach and assistant: AI senior training XP;
- fitness trainer: fatigue;
- medical: injury risk and healing for AI players (4c's injuries).

Staff who are off ill or hurt give nothing, the same rule as for the player's club.

## Part 4: Item 3b, players develop differently, age and decline (B-1, B-2, B-3)

**B-1, the development profile counts.** It lives in the `development` JSON (utils/player-development.ts): workEthic, coachability, consistency, leadership, injuryProneness.
- The average of workEthic and coachability scales training XP from ×0.8 (at 40) to ×1.2 (at 100), in the shared XP rule (utils/trainingXp.ts) for everyone, including AI training.
- injuryProneness scales injury risk from ×0.7 (at 1) to ×1.3 (at 100), in the one injury-risk function.
- Any senior with no profile or no potential (the AI clubs' originals) gets one once, at boot or when created: a profile from generateDevelopment, and a potential weighted mostly Average, some High, few Elite, rare Generational. Both are fixed for good.
- Consistency and leadership stay unused.

**B-2, age and injuries shape players.** Staff and medical never change. Players do:

| Stat | Grows best (×1.25 XP) | Holds (×1) | Fades from (×0.5 XP, and −1 to −2 at each season's end) |
|---|---|---|---|
| speed | up to 22 | 22–25 | 26 (−2 a season from 30) |
| power | up to 25 | 25–30 | 31 |
| stamina | up to 24 | 24–29 | 30 |
| defense, serve, block | up to 28 | 28–32 | 33 (−1 a season only) |

- This replaces getAgeModifier. Don't layer it on top. The academy's own youth bonus stays.
- Every player gets a hidden peak shift of −2 to +2 years, rolled once and fixed, which moves all her ages.
- A workEthic of 80 or more halves the season-end fade.
- **Injuries:** every injury that kept her out 4 weeks or more, read from the injury history, knocks 5% off her training XP for good (capped at 20%), and takes 1 point off speed and stamina when it happens.
- The fade runs at the season rollover, after ageing, for every player at every club, free agents included. Never below 1.
- Put the table in one constants block.

**B-3, watching players.**
- A Watch list: a star on any player card, at any club or none. Add a Watch list tab on the Player Market.
- Re-scouting allowed whenever the player likes, at the same price and 5 days.
- Every report is kept, with its date, her rating and the scout's potential reading. The card shows the history: "Mar 2027 71 → Jun 73 → Sep 76".
- Reports no longer lapse at season end. Delete lapseMarketScouting and its callers. An old report just shows its date.
- Check that scouting works on AI clubs' players and on players who've moved club, and report it.

## Part 5: Item 5, pre-season camp
- **Season boundary, carry-over (Rob):** injuries and fatigue carry over from one season to the next. A player who breaks an ankle on 27 Dec, out 5 weeks, is still out in January. Find anything at the rollover that heals, rests or resets injury, fatigue or fitness, and remove it. Healing stays on its weekly clock, off-season included. Also confirm that a player sitting on the bench recovers fatigue and fitness each game day (R-50's rest rule) and report it.
- **When:** on day 7 of the off-season, a choice: a camp, Rest or Skip. A camp must end before the club's first match of the new season. **Check the off-season against the Olympics and Olympic qualifiers.** If a camp length would overlap any Olympic or qualifier date a club's player is in, don't offer that length, and write it in the morning report so Rob can decide.
- **Three locations, three lengths** (seniors only; the academy carries on as normal):

| Location | Builds |
|---|---|
| Altitude Camp | speed + stamina |
| Power House | power + block |
| Beach Academy | serve + defense, plus morale +5 (teamwork) |

| Length | Sessions | XP multiplier | Cost | Fatigue at the end |
|---|---|---|---|---|
| 1 week | 3 | ×1.5 | $10,000 | +10 |
| 2 weeks | 6 | ×1.75 | $20,000 | +20 |
| 4 weeks | 12 | ×2 | $35,000 | +30 |

  - Each session goes through the shared XP rule (with B-1 and B-2), alternating between the camp's two stats' programmes. While at camp, the club can't book normal training.
  - The fatigue carries into the season.
  - Paid from the club's balance, with a ledger line "Pre-season camp".
- **Rest:** free. No training for the rest of the off-season. Every senior who isn't injured starts the season with fitness 100, fatigue 0, and morale +5.
- **Skip:** nothing special.
- **AI clubs choose too,** by difficulty (Part 6), same camps and costs, only if they can afford it (the 4a affordability rule). An AI club picks the location for its weakest area, and picks the length by what it can afford, with randomness.
- Dashboard notice on day 7; Club News lines for AI clubs' camps aren't needed.
- **New suite harness/preseason-camp.mjs.**

## Part 6: Item 6, difficulty Easy / Medium / Hard
| | AI training | AI pre-season camp |
|---|---|---|
| Easy | every 4 weeks | never |
| Medium | every 2 weeks | a coin flip each, if affordable |
| Hard | every week | every club that can afford it |

- Nobody's player ratings change.
- Picked in both new-career wizards, beside Underdog/Established. Fixed for the career and shown on Profile.
- Careers made before this are Medium.
- Drive AI_TRAIN_EVERY_WEEKS from the career's difficulty. Don't keep a second knob.
- **New suite harness/difficulty.mjs.**

## Part 7: Item 7, kits (K-1 A)
- On the 3D court, if the two clubs' kits are too alike (decide "too alike" by colour distance and write the rule in one place), the away pair wears white. This goes through the /unity/match-state payload, so no Unity change should be needed. If it does need one, report it, don't build it.
- The ladder dots (league-ladders.tsx teamColor and any copy of it) show each club's real kit primary colour instead of the name hash. Delete the hash.
- Player cards stay in national colours (Rob: fine as they are).
- Extend harness/club-kits.mjs.

## Part 8: Item 8, Settings
A Settings button (gear) in the sidebar and on the title screen. Every setting is remembered on that PC: Electron settings in a small JSON in the app's user-data folder for the window, localStorage for the rest. Rob has his Steam game on this PC, so test with test profiles only.
- **Display:**
  - Windowed or Fullscreen.
  - Window size: 1280×800, 1400×900 (default), 1600×1000, 1920×1080.
  - A zoom slider from 80% to 150% (Electron webContents zoom).
  - Apply at once, and again on the next launch.
- **Sound:**
  - Music volume and mute (the same state as the music bar, which stays for skipping songs).
  - Match sound volume (crowd and commentary on the court), if the court can take a volume message. If it can't without a Unity rebuild, leave it out and report it.
- **Controls:** Auto or Manual is chosen here (the same stored key as now). Remove the toggle button from the match screen. Add a "Controls" panel listing the keyboard and gamepad controls, read from what the court actually uses.
- **Rules / How to play:** link the existing Rules page from Settings and update it with everything new in this update:
  - the Day 1 draft;
  - the salary cap and what counts;
  - "hire your staff and medical in your first week, because on Day 8 the AI clubs take staff from the market";
  - injured players are cheaper;
  - pre-season camps;
  - difficulty;
  - ageing and injuries;
  - scouting and the Watch list;
  - manager specialities.

  Plain, short words, in the game's style.
- **New suite harness/settings.mjs** for whatever can be tested headless (the stored settings, the Rules text).

## Part 9: Build, test, fix
1. Run ONE full `pnpm run build`. It runs the whole harness itself, so never run run-all again after it.
2. For every failing suite: read why, fix the cause (not the test, unless the test's expectation is what this update knowingly changed, which you then write down), and re-run **only that suite** on its own.
3. When every failure is fixed, and if there's time left, run one more full `pnpm run build` to confirm. Report both runs' counts.
4. Don't push.

## Part 10: Use the time left, a long-career soak test
Part 9 tests each piece and the whole game together: the full build runs every suite against the real built server. If there's time left after Part 9, prove the whole update over a long career:
1. Read docs/LONG-CAREER-BRIEF.md and any existing long-career/thirty-season script, and reuse it. If there isn't one, write `harness/long-career-update1.mjs`.
2. Start a new career through the Day 1 draft (Medium, Established), and play **5 full seasons** headless, with pre-season choices made automatically (a different camp each season, one Rest).
3. At every season end, print a table:
   - the average AI senior rating and the top 5;
   - the player's squad;
   - the number of AI clubs over the cap that added anyone (must be 0);
   - every AI club has 3 seniors and its 2 staff;
   - no stat above 99 or below 1;
   - how many AI injuries there were, and long injuries released to the market;
   - how many free agents were left;
   - the AI clubs' balances (lowest, median and how many went broke).
4. Flag anything that runs away, for example ratings all climbing to 99, every club broke, the market empty, or the same club winning every year. Fix a clear bug. For a balance question, write the numbers and a suggestion in the morning report for Rob, and don't retune on your own.
5. Repeat on Easy and Hard for 2 seasons each, if time allows, and compare.

## Morning report: docs/STATUS-UPDATE1-OVERNIGHT.md
At the top, in plain words:
- what got done;
- the build counts;
- "Decisions made overnight" (each with what Rob may want to change);
- anything skipped and why;
- any images Rob must make (roles and counts);
- any Olympic clash with the camp;
- the 5-season soak tables.

Then **Rob's on-screen check list for all of Update 1**, in the order he should do it:
- faces;
- the draft;
- the salary cap;
- an injured bargain;
- AI training and scouting history;
- a camp;
- difficulty;
- kits;
- Settings.
