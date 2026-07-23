---
name: AI Match Automation
description: How World Tour AI-vs-NPC matches are auto-simulated when the calendar advances
---

## Rule
`autoSimulateAIMatches(seasonYear, maxRound, excludeTeamId)` in `calendar.ts` batch-simulates all scheduled AI matches whenever the advance endpoint hits a World Tour / Finals day.

## Why
World Tour matches have `home_team_id` pointing to a real DB team, but `away_team_id` is set to the same value as `home_team_id` (FK constraint workaround — NPC opponents are not DB records). The name is stored in `away_team_name` only. Because of this, simulation filters by `home_team_id != player_team_id` (not away).

## How to apply
- Called in POST `/api/calendar/advance` inside the WT/Finals block, BEFORE checking for the player's match
- Uses a single batch `sql.raw()` UPDATE with CASE…END per match (fast for large backlogs)
- `round <= maxRound` filter means first call retroactively catches up all past rounds
- `status = 'scheduled'` filter prevents double-simulation (idempotent)
- Team wins/losses updated with one `sql.raw()` UPDATE per unique home_team_id
- Non-fatal: wrapped in try/catch so AI sim errors never block calendar advance
