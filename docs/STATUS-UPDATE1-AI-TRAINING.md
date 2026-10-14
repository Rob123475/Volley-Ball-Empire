# Update 1, item 3: AI clubs train and develop: status

Brief: `docs/UPDATE1-AI-TRAINING-BRIEF.md`. Branch `update-1`, on top of item 2 (`db67e2b`). **Not pushed.** Nothing built or run during this item (Rob, 14 Oct): the one full `pnpm run build` at the end of Update 1 runs everything, including this item's suite and its balance report.

## Summary

The AI clubs' seniors now train every week through the player's own XP rule, so the AI world grows instead of staying frozen. Each senior trains the programme for her weakest skill. An AI club's own manager now counts for two specialities: Coach (+10% senior XP) and Youth Developer (+15% academy XP). There is one knob for item 6, `AI_TRAIN_EVERY_WEEKS`. The player's own training gives exactly the same numbers as before: it now calls the shared rule instead of carrying its own copy.

The brief stopped once, on 14 Oct (two mismatches, below). Rob answered 1A and 2A.

## Commits

| Step | Commit | What |
|---|---|---|
| 1 | `8332546` | One XP rule, shared: `utils/trainingXp.ts trainingSessionXp` (base 25-35 XP, every multiplier in the same order as before, +1 primary per 100 XP, +1 secondary per 200 XP, capped at 99). `PROGRAM_CONFIG`, `resolveProgram` and `getAgeModifier` moved with it and were deleted from `routes/training.ts`. The player's training calls it with every multiplier it had; fatigue, morale, focus and injury care stay in the route. |
| 4 | `655cbba` | M-6 switched on for AI clubs, Coach and Youth Developer only. `specialityFactor` takes a club: the player's (its `teams` row) or an AI club (its manager in post's face on `career_pool_team_state`). This is one lookup, `managerSpecialityOf`, which replaces `playerSpecialityForTeam`. `aiAcademiesWeekTx` passes each club's Youth Developer factor into `academyWeek`. |
| 2-3 | `1dcbcee` | `utils/aiSquads.ts aiSeniorsTrainWeekTx`, called in the weekly block straight after `materializeAiSeniorsTx`. `utils/aiTraining.ts` holds the rules only (no database): `AI_TRAIN_EVERY_WEEKS = 1`, `careerWeekOf`, `aiTrainsThisWeek`, `aiProgrammeFor`. |
| harness | `69b97fe` | `harness/ai-training.mjs`, in run-all (as 98e). Two source checks in `manager-faces.mjs` updated for item 3. |

## What was done

- **AI seniors train weekly:**
  - Each AI senior gets one session through `trainingSessionXp`.
  - **Programme:** the one for her lowest of power, speed, defense, serve and block, ties in that order (`aiProgrammeFor`). A senior whose lowest stat is block trains Power Camp (Rob, 1A). Never Conditioning or Recovery.
  - **Multipliers:** the programme's own, her age, her potential (none counts as Average), and her club's manager's Coach (x1.1). Coach, staff, philosophy and facilities are 1.
  - **XP and stats only:** no fatigue, morale, injury or focus change. Training points carry over week to week.
- **The knob:** `AI_TRAIN_EVERY_WEEKS = 1`. AI seniors train only in career weeks that are a multiple of it. The career week is whole weeks since the career's first season began. Nothing reads difficulty yet (item 6).
- **M-6 for AI clubs:**
  - Coach applies to the AI senior training.
  - Youth Developer applies to the AI academies' week, through `academyWeek`'s existing factor, for the club the youth is at.
  - The other six specialities still return 1 for an AI club.
- **Ratings follow (checked, not assumed):** every reader of an AI player's strength reads the live squads (`aiSquadsTx`):
  - club strength (`worldTour.ts poolClubRatingsTx` → `aiClubRatingsTx`);
  - regional league results (`regionalSeason.ts`);
  - ranking-point earners (`rankingPoints.ts aiPairTx`);
  - Olympic athletes (`olympics.ts`);
  - the 3D court's opponents (`unity.ts aiPairTx`);
  - the regional league page.

  Nothing caches an AI player's stats or rating. The clubs' fixed `rating` column is only used for contract lengths and as a fallback (`competitors.ts storedRating` is never read).

## What did not match the brief

1. **No programme has `block` as its primary stat.** Stopped 14 Oct. Rob chose 1A: a senior whose lowest stat is block trains Power Camp, where block is the secondary stat (+1 per 200 XP, with power +1 per 100).
2. **An AI senior's market price is one month of her current wage at her club, ±15%** (Rob's 30 Sep rule), not her rating, so it does not follow her stats as she trains. Stopped 14 Oct. Rob chose 2A: leave it; her price follows at her next renewal, when item 4a re-prices her wage to her current rating. A free agent's price already follows her rating.
3. **How the suite tests the knob.** The brief's harness test 4 ("with AI_TRAIN_EVERY_WEEKS = 4...") cannot change a constant in the built game. The suite tests the cadence rule `aiTrainsThisWeek(week, 4)` directly (weeks 0, 4 and 8 of 12), checks that the shipped value is 1, and checks that the weekly block applies it by the career's week number.
4. **Not run** (Rob's instruction for this item): `ai-training.mjs`, including the three-season balance report, and the updated `manager-faces.mjs` run at the end of Update 1. Several working files on this machine had CRLF line endings while the committed files are LF (`youthLoans.ts`); they were made LF before editing.

## What Rob checks on screen (end of Update 1)

Play a few weeks, open the Player Market or Qualified Teams, and see an AI player's stats tick up.
