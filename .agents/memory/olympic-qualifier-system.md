---
name: Olympic qualifier system
description: How the Olympic qualifiers and schedule endpoints are structured, and CalendarState gotcha
---

## Endpoints
Both routes live on the existing `olympicsRouter` (mounted at `/api`, no prefix) inside `artifacts/api-server/src/routes/olympics.ts`:

- `GET /api/olympics/qualifiers` — per-continent standings. Calls shared `buildQualifierStandings()`.
- `GET /api/olympics/schedule` — full bracket. Calls both helpers then builds groups + knockout.

## Qualification logic
- Spot allocation: Europe=3, Asia=2, North America=2, South America=2, Africa & Middle East=2, Oceania=1 (12 total)
- Team rating = avg of top-2 players' `(speed+power+defense+serve+block+stamina)/6`
- `qualStatus`: `"qualified"` | `"bubble"` (next 2 after spots) | `"not_qualified"`

## Schedule structure
- 12 qualified teams sorted by rating, assigned to 4 groups via serpentine seeding (order [0,1,2,3,3,2,1,0,0,1,2,3])
- Non-Olympic year: all matches `status: "projected"`, no scores
- Olympic year (`isOlympicYear`): scores simulated via deterministic pseudo-random based on ratings

## CalendarState gotcha
`CalendarState` (in `use-calendar.ts`) does **not** include `isOlympicSeason` — that field is on the DB table but not in the hook's returned type. To check for an Olympic year in frontend code, use:
```ts
(calendar?.seasonYear ?? 0) % 4 === 0
```

**Why:** The hook type was defined without `isOlympicSeason` even though the DB schema has the column. Using `calendar?.isOlympicSeason` causes a TS2339 type error.

**How to apply:** Any frontend code needing to detect the current year as an Olympic year should derive it from `seasonYear % 4 === 0` rather than reading `isOlympicSeason` from the calendar hook.
