---
name: Olympic qualifier system
description: How Olympic qualification and the schedule endpoints work (R-46: national, on this season's World Tour ranking points), and a CalendarState gotcha
---

## Endpoints
Both routes live on `olympicsRouter` (mounted at `/api`, no prefix) in `artifacts/api-server/src/routes/olympics.ts`, and both read the ACTIVE CAREER's season:

- `GET /api/olympics/qualifiers` — `{ olympicsYear, seasonYear, totalSpots: 12, countries }`, from `olympicQualification()` in `utils/olympicQualification.ts`.
- `GET /api/olympics/schedule` — full bracket: the 12 qualified nations in qualifying order, then groups + knockout.

## Qualification logic (R-46, Rob's rule, 14 Sep 2026)
- The Olympics are NATIONAL teams. A country qualifies on the World Tour ranking points its players earned THIS SEASON — the sum across that country's players, whichever club they play for.
- Top 12 countries qualify. Ties broken by best single-player total (then country name, only for a stable table).
- Player ratings play NO part. (The old rule — per-continent spots by the top-2 player rating average — is gone.)
- Points per player live in `player_ranking_points` (per career, season, club, player), written by `creditCompetitorTx` in `utils/rankingPoints.ts` on every credited result: an AI club's two pool players, or the player's club's two `squad_role = 'starter'` players.
- Nation identity: `nationName()` in `lib/db/src/schema/continents.ts` — pool players store demonyms ("German"), seniors country names ("Germany"). Hawaiian resolves to USA.
- Rules page text is asserted by `harness/olympic-qualification.mjs`.

## Schedule structure
- The 12 qualified nations in qualifying order, assigned to 4 groups via serpentine seeding (order [0,1,2,3,3,2,1,0,0,1,2,3])
- Non-Olympic year: all matches `status: "projected"`, no scores
- Olympic year (`isOlympicYear`): scores simulated, the side with more World Tour points favoured

## CalendarState gotcha
`CalendarState` (in `use-calendar.ts`) does **not** include `isOlympicSeason` — that field is on the DB table but not in the hook's returned type. To check for an Olympic year in frontend code, use:
```ts
(calendar?.seasonYear ?? 0) % 4 === 0
```

**Why:** The hook type was defined without `isOlympicSeason` even though the DB schema has the column. Using `calendar?.isOlympicSeason` causes a TS2339 type error.

**How to apply:** Any frontend code needing to detect the current year as an Olympic year should derive it from `seasonYear % 4 === 0` rather than reading `isOlympicSeason` from the calendar hook.
