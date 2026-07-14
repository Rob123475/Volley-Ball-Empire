---
name: API type shapes
description: Actual field names for key generated types — Match, Season, LadderEntry, HistorySeason, HistoryStandingsResponse
---

## Match
`homeTeamName?: string | null`, `awayTeamName?: string | null` — NOT `homeTeam?.name`.
Also has `homeTeamId`, `awayTeamId`, `homeScore?`, `awayScore?`, `round`, `status`, `season`.

## Season
Field is `year: number`, NOT `seasonYear`. Also: `id`, `name`, `status`, `totalRounds`, `currentRound`, `startDate`, `endDate`.

## LadderEntry (from useGetSeasonLadder)
`rank: number`, `teamId: number`, `teamName: string`, `wins`, `losses`, `points`, `goalsFor`, `goalsAgainst`.
No `position`, no `poolTeamId`, no `played`, no `setDiff`.

## useGetSeasonLadder
`enabled: !!(id)` is already built in to the generated queryOptions — no need to pass `{ query: { enabled } }`.
When seasonId is 0/undefined, the hook is already disabled. Just call `useGetSeasonLadder(seasonId ?? 0)`.

## HistorySeason
`id`, `year` (NOT `seasonYear`), `name`, `status`.

## HistoryStandingsResponse
Object with `seniors: HistoryStandingRow[]`, `youth: HistoryYouthRow[]`, `hasSnapshot: boolean`.
NOT a plain array — use `.seniors` or `.youth` to get the rows.
HistoryStandingRow has: `rank`, `competitorName`, `isPlayer`, `wins`, `losses`, `points`, `setDiff`.

**Why:** These were all discovered via typecheck failures when writing competition pages. Knowing the actual shapes avoids having to look them up each time.
