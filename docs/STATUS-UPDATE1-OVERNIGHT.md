# Update 1: overnight run, 14–15 Oct 2026, morning report

Branch **update-1**, started from 32b26f8. Nothing pushed. `main` and `launch-final` untouched.
Written as the night goes, part by part. The newest state is at the bottom of each section.

## What got done

(Filled in part by part below.)

## Build counts

Not run yet (part 9).

## Decisions made overnight

(Each with what Rob may want to change.)

## Skipped, and why

## Images Rob must make

**Staff portraits (part 1a), 90 in all,** so every one of the 60 AI clubs can have a coach and a medical
member on Day 8 while 5 of every role stay on the market:

| Role | Have | Must make |
|---|---|---|
| Head Coach | 10 | 25 |
| Assistant Coach | 10 | 25 |
| Doctor | 10 | 10 |
| Physiotherapist | 10 | 10 |
| Massage Therapist | 10 | 10 |
| Medical Specialist | 10 | 10 |

(The coaches can be split any way between Head and Assistant, 50 in all. Add one more of a role for each
of that role the player hires in his first week, if Rob wants 5 left even then.) Each new member needs a
name, nationality, age, skill and wage too, as in utils/staff-generator.ts; once the pictures exist, the
new people go in the staff data and the deal takes them with no code change (AI_STAFF.marketFloor stays 5).

## Olympic clashes with the pre-season camp

## 5-season soak tables

## Rob's on-screen check list for all of Update 1

(Written at the end.)

---

## Part by part

### Part 1a: the AI clubs' staff on Day 8 (done, not yet run)

**Can the game make new staff without new pictures? No.** utils/staff-generator.ts and
utils/medical-staff-generator.ts only copy the named people already in the game (same name, same
portrait), and every one of the 120 staff (10 per role) has a portrait made for them under
images/staff/. So I took the brief's second path: deal what is spare, and keep at least 5 of every
role on the market for the player.

What is built (utils/aiStaff.ts, one constants block `AI_STAFF`):
- `career_staff_state.pool_team_id`: the AI club that employs someone, stored exactly as the
  player's staff are, so `loadStaffTx(tx, cid, { poolTeamId })` reads an AI club's staff the way
  `loadStaff(cid, { teamId })` reads the player's (Rob's correction of 14 Oct). The market
  ("unhired") is now "nobody's": neither the player's club nor an AI club. The Staff and Medical
  Markets and both hire routes refuse anyone at an AI club.
- **Day 8** (`career_saves.ai_staff_deal_on`, set to the career's first day + 7 when it is made):
  every AI club, in random order, gets one coach (Head or Assistant, random) and one medical
  member (Doctor, Physiotherapist, Massage Therapist or Medical Specialist, random), on a normal
  contract of random length (6m / 1s / 2s, the player's own `contractEndDate`), as long as the
  role keeps 5 on the market. The signing fee is the player's rule (one month's salary), paid from
  the AI club's balance; a club that can't pay it waits.
- **Wages:** weekly, from the AI club's balance, in `chargePoolClubsWeekTx`, through the same
  `weeklyWageBill` as its players. Never the salary cap (the cap's bill reads seniors only).
- **Every day after Day 8:** AI contracts that have ended go back to the market, and a club with no
  coach (or no medical member) takes one when a role has a spare. So clubs that missed out fill
  one coach and one medical member at a time, as contracts end (the player's and the AI's).
- **Older careers:** dealt once at boot, the same way, on their current game date
  (`dealAiStaffToOlderCareers`, index.ts).
- **A takeover:** when the player takes over an AI club, its staff come with it on their
  contracts (as its players and academy already did).
- **Bug fixed on the way:** when the player's staff contract ran out, the calendar set their wage
  to $0, so a re-hire cost $0 and was paid $0. A contract that ends now leaves the wage as it was,
  exactly as a release does (one patch, `STAFF_BACK_ON_MARKET`, for the player's and the AI's).
- New suite **harness/ai-staff.mjs** (run-all 98h).

**How many clubs get staff today:** 10 of the 60 AI clubs get a coach (5 Head + 5 Assistant are
spare) and 20 get a medical member (5 of each of the four roles are spare), fewer if the player
hires a coach or medic in his first week.

### Part 1b: injured players come cheap, in weeks (done)

`MONEY.salaryCap.injuredLongMonths = 3` is now `injuredLongWeeks = 4` (lib/db/src/schema/money.ts).
Out 4 weeks or more: 50% of her wage; less: 75%. The AI no-renewal rule reads the same number. Nothing
read the old constant yet: both rules are built in part 2 (4c items 3 and 4), on this one.

### Part 2: item 4c in full (done, not yet run)

All of 4c, the full-club buy and part 1b, as written in docs/STATUS-UPDATE1-SALARY-CAP.md
("Overnight 14–15 Oct"). In short: AI clubs refill to 3 seniors (a third only if they can afford and fit
her); AI players get the player's own injury roll after their matches (Fitness Guru counts for AI
managers now) and heal on the same weekly clock, free agents too; an AI club with fewer than two fit
forfeits; an injured free agent asks 50% (4+ weeks out) or 75% through the one asking-wage path, and
signs at it; a long-injured AI senior isn't renewed; AI clubs gamble on an injured free agent only with
two fit; a full AI club buys by releasing its weakest. Suite harness/ai-injuries.mjs (run-all 98i).
