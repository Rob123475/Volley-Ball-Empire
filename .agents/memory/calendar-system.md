---
name: Calendar progression system
description: How the in-game calendar works — round→date mapping, daily processing, speed controls
---

## Architecture

- **DB table**: `calendarStateTable` in `lib/db/src/schema/game.ts` (one row per team)
  - `currentDate` (YYYY-MM-DD varchar), `calendarSpeed`, `pendingMatchId`, `lastSalaryDate`
- **Route file**: `artifacts/api-server/src/routes/calendar.ts` (registered in index.ts)
- **Hook**: `artifacts/beach-volleyball/src/hooks/use-calendar.ts`
- **UI panel**: `artifacts/beach-volleyball/src/components/calendar-panel.tsx` (in sidebar)
- **Match modal**: `artifacts/beach-volleyball/src/components/match-day-modal.tsx` (in Shell)

## Round → Date mapping

```typescript
function roundToDate(startDate, endDate, round, totalRounds): string
// Maps round N to a calendar date using linear interpolation over season span
```

Season data comes from `seasonsTable` (has `startDate`, `endDate`, `totalRounds`).

## Day advance pipeline (POST /api/calendar/advance)

1. Check pendingMatchId (returns blocked if unresolved)
2. Find rounds that map to today's date (loop over all totalRounds)
3. If user's team has a scheduled match on those rounds → set pendingMatchId, pause speed
4. Daily: fatigue -= 4 (healthy) / -2 (injured), fitness += 1 (fatigue < 30)
5. Weekly (every 7 days from lastSalaryDate): deduct salaries, add sponsor income

## Speed → auto-advance interval

- pause: none; slow: 3000ms; medium: 1000ms; fast: 200ms
- Frontend `setInterval` in `useCalendar` effect, tied to `calendar.calendarSpeed`

## Auth guard

Auth middleware calls `next()` even unauthenticated (doesn't reject). All calendar routes
have an explicit `router.use()` guard that returns 401 if `req.user` is missing.
This pattern should be used for any new protected router file.

**Why:** `getActiveTeam` uses `req.user!.id` (non-null assert) which crashes if user is null.
**How to apply:** Add `router.use((_req, res, next) => { if (!_req.user) { res.status(401)...; return; } next(); });` at the top of any new router.
