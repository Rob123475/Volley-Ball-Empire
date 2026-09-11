# R-10 audit — every frontend page, what feeds it, what is dead, duplicated or fake

Read-only. Written 12 Sep 2026 during the unattended weekend run, with **no code changed
for this item**. Every statement below comes from reading the file or grepping the source
in this session. Anything not checked says so.

State as of the R-29 commits. The screens R-29 rebuilt that weekend are marked
**(R-29)**, so this audit describes what the player sees now, not before.

---

## 1. Headline findings, most serious first

| # | Finding | Where | Kind |
|---|---|---|---|
| 1 | **Nothing ever writes a trophy.** No code in `artifacts/api-server` inserts into `trophies`; it is only read. The Trophy Cabinet, "Titles Won", the history season summary, the trophy news items, the Hall of Fame archive's trophy count and the `olympic_gold` achievement all read a table that stays empty forever. | `routes/trophies.ts`, `routes/history.ts:128,202`, `routes/players.ts:509`, `utils/careerLifecycle.ts:36`, `utils/check-achievements.ts:58`, `routes/news.ts` | dead |
| 2 | **World Tour News is mostly invented.** `generateWorldNews(daySeed)` builds stories from hardcoded first names, last names, tournaments, injuries and staff roles with a day-seeded RNG, and the route merges them with the player's real items into one list with nothing to tell them apart. | `routes/news.ts:125, 404-411` → dashboard "World Tour News" | fake shown as real |
| 3 | **Manager Movements is random.** AI managers are seeded from a hardcoded name and club list with random reputations and hire dates, and a tick simulates random movements. | `routes/ai-managers.ts:10,25,43-54,60` → dashboard "Manager Movements" | fake shown as real |
| 4 | **The Youth league is the one-club World Tour problem R-29 fixed for seniors.** The youth ladder's AI teams are a hardcoded list with random wins and losses; youth opposition names are hardcoded, and results, points and development gains come from `Math.random`. The youth ladder's form strip is `mockForm`, a hash of the club name. | `routes/youth-league.ts:102-129, 251-300, 377`; `pages/league-ladders.tsx` (youth tab) | fake shown as real |
| 5 | **Job Market listings are hardcoded in the page**, under a notice that reads as a coming-soon promise ("salary negotiation and real-time club matching will expand as the game evolves"). Poaching offers come from a hardcoded club list. | `pages/job-market.tsx:67` (`JOB_OFFERS`), `:730`; `routes/poaching.ts:16,118` | hardcoded / "coming soon" |
| 6 | **Olympic qualification is not what the rules page says.** Rules: "Top 12 World Tour teams qualify". Code: countries ranked by their top two players' ratings, N spots per continent. Olympic results are drawn per request (`simResult`: a 70/30 favourite roll plus `Math.random` set scores), so the same tournament's scores can differ between two page loads. | `pages/rules.tsx`; `routes/olympics.ts:307-327, 386-481` | rules/code mismatch; unstable results |
| 7 | **The All-Star page can never show a match.** The schedule has no All-Star event (see §5), so the page always renders "All-Star Match Not Yet Scheduled", and its copy says it "takes place in Round 72", which is the World Final. | `pages/competition/all-star.tsx:60-66` | dead |
| 8 | **Leaderboard info cards.** "Reputation Bonus — Next tier at 2,500 REP — Win streaks multiply your bonus": no reputation tier or 2,500 threshold exists in the server (the only `2500` is a kit price, `seed-world-data.ts:116`). Win streaks do exist: +1 rating per streak step (capped at 3) in the match engine, and +5 reputation at a 3+ streak, but nothing multiplies. The third card is derived from real data. The "World Finals" card was false ("Top 8 qualify, ends in 12 days") and **(R-29)** now says top 4. | `pages/leaderboard.tsx:337-358` | fake |
| 9 | **The dev generation-test page ships in the desktop build with a dead API.** `/dev/generation-test` is routed for everyone, but `/api/dev/*` is only mounted when `NODE_ENV !== "production"`, and the desktop app runs production. | `App.tsx:139`; `routes/index.ts:86-87` | dead in shipped build |
| 10 | **Tab labels that name the wrong screen.** Club → "Overview" renders the history archive (`LeagueLadders`); Club → "Hall of Fame" renders the World Tour leaderboard. Route `/locations` imports as `WorldTourLocations` but the page is Olympic selection. The sidebar's "WT Calendar" is the Match Center (`/matches`). | `pages/club-hub.tsx:42-52`; `App.tsx:54,179`; `components/layout/shell.tsx` | mislabelled |

---

## 2. The design-doc screens (the register's original R-10 scope)

`docs/economy-design.md` "UI scope (Phase 8)" lists eight rows. Current state:

| Row | Design says | Now | Evidence |
|---|---|---|---|
| Ranking | new Rankings screen: points, world position, table around the player, points per event | **Not built as specified.** No Rankings screen. `GET /seasons/ranking` has no frontend consumer. **(R-29)** The World Tour Standings now show every club's ranking points and position, which covers "position" and "table"; nothing shows points per event. | grep `rankingPoints` in frontend: only `season-review-dialog.tsx` |
| Qualification | per event: qualified / not / above tier, threshold, gap | **Not built.** `GET /matches` returns an `eligibility` object with every fixture; no page or component reads it. | grep `eligibility.` in `pages`, `components`: none |
| Tier status | dashboard: tier, points to next threshold, what unlocks | **Not built.** No consumer of tier thresholds or `nextTierGap`. | grep: none |
| Finals | new Finals screen: group stage, bracket, qualification path | **Built (R-29)** as the format that exists: seeds 1v4 / 2v3, both semis, final, champion, and whether the player qualified. There is no group stage in this game's finals. | `pages/competition/world-finals.tsx`, `GET /world-tour/finals` |
| Fail state | dashboard + finances: escalation ladder always visible | **Partly — not verified stage by stage.** Board-confidence data is consumed by `dashboard.tsx` and `manager-contract.tsx`; `finances.tsx` does not call it. Whether warning / spending blocked / forced sales / sacked each render was not checked line by line. | hook usage per page, §3 |
| Season end | review | **Built.** `season-review-dialog.tsx`, opened by `calendar-panel.tsx` on `reviewYear`. | |
| Career end | new Career Result: trophies, peak ranking, progression, balance, score, rank band | **Not built.** `career-end.tsx` is the "You've Been Sacked" screen only. `careerComplete` is typed in `use-calendar.ts` and nothing renders a completed five-season career. (Its "trophies" row would be empty anyway — finding 1.) | `pages/career-end.tsx:31` |
| Start | Underdog vs Established | **Built** (R-11). | `pages/new-career.tsx:195-261` |

---

## 3. Navigation map

**Sidebar** (`components/layout/shell.tsx`): Dashboard `/` · Team `/team` · Player Market `/players` ·
Staff `/staff` · World Tour group (Overview-style links straight to `/competition/*` and `/matches`
labelled "WT Calendar") · Continental group (`/competition/regional-*`, pools,
promotion/relegation, history, qualified teams) · Olympics group (`/olympics`, national squads,
schedule) · Youth League `/youth-league` · Club `/club` · Season Cal `/annual-calendar` ·
Finances `/finances` · Career `/career` · Match Day `/court`.

**Hubs** render other pages as tabs:

| Hub | Route | Tabs → component |
|---|---|---|
| Team | `/team` | Senior Team → `team.tsx` · Youth Team → `youth-academy.tsx` · Training → `training.tsx` · Contracts → `contracts.tsx` |
| Staff | `/staff` | Market → `staff-market.tsx` · Scouting → `continental-scouting.tsx` · My Staff → `staff.tsx` |
| World Tour | `/world-tour` | Overview, Calendar, Fixtures, Results, Standings, World Finals, All-Star, History |
| Continental | `/continental` | Overview, Fixtures, Results, Standings, Pools, Promotion/Relegation, History |
| Olympics | `/olympics` | Overview, Qualifying (`olympic-qualifiers.tsx`), Fixtures |
| Club | `/club` | Overview → `league-ladders.tsx` · Facilities · Medical Centre → `medical.tsx` + `medical-market.tsx` · Hall of Fame → `leaderboard.tsx` · Trophy Cabinet → `trophy-cabinet.tsx` |
| Career | `/career` | Overview → `profile.tsx` · Achievements · Records → `trophy-cabinet.tsx` · Manager History → `career-history.tsx` · Career Options → `job-market.tsx` + `manager-contract.tsx` |

**Duplicated entry points** (the same component reachable two or three ways):
- `/world-tour` and `/continental` hubs duplicate the sidebar's direct competition links. **Nothing links to either hub**; they are reachable only by typing the URL.
- `trophy-cabinet.tsx` is both Club → Trophy Cabinet and Career → Records.
- Standalone routes duplicate hub tabs: `/staff-market`, `/continental-scouting`, `/training`, `/contracts`, `/facilities`, `/medical`, `/medical-market`, `/leaderboard`, `/league-ladders`, `/trophy-cabinet`, `/achievements`, `/profile`, `/manager-contract`, `/job-market`, `/career-history`.
- `/youth-results` (`youth-results.tsx`) and `/youth-league` (`youth-league.tsx`) are two different files (522 differing lines) built on the **same four hooks** and headed "Youth Development League" / "Youth Championship". Nothing links to `/youth-results`.
- The World Tour standings table appears four times: `competition/wt-ladder.tsx`, the dashboard's Season Ladder, the Club → Hall of Fame leaderboard, and the league-ladders seniors tab. **(R-29)** All four now read the same standings function, so they agree.

---

## 4. Every page

"Data" lists generated API hooks and direct `fetch` endpoints found in the file.

### Dashboard and navigation shell
| Page | Shows | Data | Findings |
|---|---|---|---|
| `dashboard.tsx` `/` | Recent Results, Season Ladder, Trophy Cabinet, Upcoming Events, World Tour News, Team Strength, Attention Required, Manager Movements, Olympic qualification strip | dashboard, current season, season ladder, club rating, attention items, facilities, world tour news, upcoming events, AI manager feed, board confidence; `/api/olympics/qualifiers` | News invented (finding 2); Manager Movements random (3); trophy data never written (1). Season Ladder **(R-29)**: the whole field, in server order. |
| `court.tsx` `/court` | Unity WebGL court, "Unity 3D Court not available" fallback | career saves | R-40 fixed rendering this weekend |
| `annual-calendar.tsx` `/annual-calendar` | season calendar by year | `useCalendar`, `useAnnualCalendar` | — |
| `rules.tsx` `/rules` | static rules | none | Olympics rule contradicts code (6); "World Tour 18 teams" vs a field of 19 with the player — see WEEKEND-STATUS Q1 |
| `not-found.tsx` | 404 | none | — |
| `dev-generation-test.tsx` `/dev/generation-test` | reference-data generation checker | `/api/dev/generate-test` | dead in production build (9) |

### Squad and staff
| Page | Shows | Data | Findings |
|---|---|---|---|
| `team-hub.tsx` `/team` | tabs (§3) | — | — |
| `team.tsx` | roster, attributes, strength, outfits | team roster, team strength, outfits, update player/outfit | — |
| `players.tsx` `/players` | senior market, draft, youth pool | sign contract; `/api/draft`, `/api/players/market-all`, `/api/players/youth-pool` | draft youth names are generated from hardcoded lists (`routes/draft.ts:23,38`) — gameplay generation, not a stat shown as fact |
| `youth-academy.tsx` | scouting missions, reports, prospect database, development league | youth prospects, continental prospects/regions, youth league results, sign prospect | development league data is random (4) |
| `training.tsx` `/training` | training center, sessions | my team, training plan, players, staff, sessions, update team | — |
| `contracts.tsx` `/contracts` | contracts | contracts list | — |
| `staff-hub.tsx` `/staff` | tabs | — | — |
| `staff.tsx` | staff management | my team, staff list, fire/update staff | — |
| `staff-market.tsx` `/staff-market` | staff market | staff market, hire, staff list | generated candidates (`utils/staff-generator.ts`) |
| `continental-scouting.tsx` `/continental-scouting` | scouting missions, discovered prospects | continental prospects/regions, staff, sign, start scouting | generated prospects (`utils/prospect-generator.ts`) |

### World Tour
| Page | Shows | Data | Findings |
|---|---|---|---|
| `world-tour.tsx` `/world-tour` | hub, 8 tabs | — | not linked (§3) |
| `matches.tsx` `/matches` ("WT Calendar") | Match Center: season fixture, simulate / forfeit / lineup, World Finals section | current season, roster, locations, matches, upcoming, simulate, update lineup; `/api/matches/fixture`, `/api/matches/:id/forfeit` | per-fixture `eligibility` delivered and not shown (§2); header falls back to "/ 73 played" (§5). **(R-29)** World Finals cards show "did not qualify". |
| `competition/wt-fixtures.tsx` | **(R-29)** every fixture of a round for the whole field, who rests, real field size | `/api/world-tour/fixtures?round=` | — |
| `competition/wt-results.tsx` | completed World Tour results | `useListMatches` | shows **only the player's own** results, from `GET /matches`, which is capped at the 50 most recent — a 62-match season cannot be fully listed, and no other club's result appears. Natural follow-up to R-29: read `world_tour_fixtures`. |
| `competition/wt-ladder.tsx` | **(R-29)** World Tour Standings, the whole field | season ladder | invented quarter-final / round-of-16 bands removed |
| `competition/world-finals.tsx` | **(R-29)** seeds, semis, final, champion | `/api/world-tour/finals`, season ladder | invented third-place playoff removed |
| `competition/all-star.tsx` | All-Star match | current season, matches | dead (7) |
| `competition/wt-history.tsx` | past seasons' final standings | history standings, history seasons | reads `season_final_standings`. Seasons that rolled over before R-29 hold the old snapshot of every team in the database; seasons from R-29 on hold the career's real field. |
| `competition/qualified-teams.tsx` | 18 qualifiers by continent | `/api/regional-league/qualifications` | **(R-29)** now this career's own qualifiers |
| `leaderboard.tsx` `/leaderboard`, Club → Hall of Fame | "Global Leaderboard": podium, full rankings, info cards | leaderboard, dashboard, locations, current season | info card fake (8); tab label wrong (10). **(R-29)** the whole field; AI clubs show "—" for manager and reputation. |

### Continental (regional leagues)
| Page | Shows | Data | Findings |
|---|---|---|---|
| `continental.tsx` `/continental` | hub, 7 tabs | — | not linked (§3) |
| `competition/regional-overview.tsx` | per-continent table, qualification and relegation zones | `/api/regional-league/:continent` | — |
| `competition/regional-fixtures.tsx` | fixtures | same | — |
| `competition/regional-results.tsx` | results | same | **(R-29)** clubs rated by their players, not `100 - (rank-1)*8` |
| `competition/regional-ladders.tsx` | ladders | same | — |
| `competition/continental-pools.tsx` | pool clubs | `/api/regional-league/:continent/pools` | — |
| `competition/promotion-relegation.tsx` | promotion and relegation | continent + pools endpoints | — |
| `competition/regional-history.tsx` | past qualifiers | `/api/regional-league/qualifications` | returns the latest season only, so "history" holds one season |

### Olympics
| Page | Shows | Data | Findings |
|---|---|---|---|
| `olympics.tsx` `/olympics` | hub: Overview, Qualifying, Fixtures | — | — |
| `competition/olympic-qualifiers.tsx` | per-continent country standings | `/api/olympics/qualifiers` | rule mismatch (6) |
| `competition/national-squads.tsx` | national eligibility | `/api/olympics/countries` | — |
| `competition/olympic-schedule.tsx` | group draw, knockout, results | `/api/olympics/schedule` | results drawn per request (6) |
| `locations.tsx` `/locations` | Olympic selection: next Olympics, window, your selection | current season, Olympic selection, Olympic countries | misnamed route/import (10); reached from dashboard Upcoming Events |

### Youth
| Page | Shows | Data | Findings |
|---|---|---|---|
| `youth-league.tsx` `/youth-league` | Youth Championship, Youth Development League | youth championship, ladder, results, stars | random results and ladder (4) |
| `youth-results.tsx` `/youth-results` | the same two sections | the same four hooks | duplicate, unlinked (§3) |

### Club, career and finances
| Page | Shows | Data | Findings |
|---|---|---|---|
| `club-hub.tsx` `/club` | tabs (§3) | — | mislabelled tabs (10) |
| `league-ladders.tsx` `/league-ladders`, Club → Overview | senior and youth final standings, player/manager hall of fame, season archive, records, manager history | current season, season ladder, youth ladder, my team, history seasons/standings/summary/records/manager seasons/hall of fame | **(R-29)** seniors: real form and server order. Youth tab still `mockForm` (4). |
| `facilities.tsx` `/facilities` | facilities | club rating, facilities, my team | — |
| `medical.tsx` `/medical` | medical centre, injuries, workloads | facilities, injury history, my team, workloads, season injury stats, roster, medical staff, fire | — |
| `medical-market.tsx` `/medical-market` | medical staff market | market, hire, list | generated candidates |
| `wellbeing.tsx` | active effects, camps | facilities, wellbeing status | reached from Medical |
| `trophy-cabinet.tsx` `/trophy-cabinet`, Club → Trophy Cabinet, Career → Records | cabinet, hall of fame, records | hall of fame, my team, trophy cabinet | empty forever (1); duplicate (§3) |
| `achievements.tsx` `/achievements`, Career → Achievements | achievements | achievements | written by `utils/check-achievements.ts:91` — real, except `olympic_gold` (1) |
| `career-hub.tsx` `/career` | tabs (§3) | — | — |
| `profile.tsx` `/profile` | manager profile and career stats | career summary, trophy cabinet | trophy-derived figures empty (1) |
| `career-history.tsx` `/career-history` | career history | career history | — |
| `manager-contract.tsx` `/manager-contract` | contract, board confidence, resign / break contract | board confidence, career summary, manager contract | fail-state stages not verified (§2) |
| `job-market.tsx` `/job-market` | job offers | career saves (listings are local) | hardcoded listings, coming-soon notice (5) |
| `career-management.tsx` `/career-management` | save slots, new career, delete | delete career save, career saves, club templates | — |
| `new-career.tsx` `/new-career` | manager, club, colours, difficulty | current user, my team, club templates | — |
| `profile-picker.tsx` `/login` | select or create manager | `/api/profiles`, select, delete | — |
| `career-end.tsx` `/career-end` | "You've Been Sacked" | career history | career *completion* screen missing (§2) |
| `finances.tsx` `/finances` | financial office: sponsors, promo deals, wages, prize money, transactions, cashflow forecast | finance summary, prize money, sponsor progress/reputation, wage bills, promo deals; `/api/finances/*` | sponsor offers are generated (`utils/sponsor-generator.ts`) — gameplay content |

---

## 5. The 76-vs-62 fixture count (carried from R-08)

As recorded under R-10 in the register: the code once described a "76-event season fixture";
`data/worldTour.ts` holds **62** events (60 regular World Tour rounds, the World Semi Final and
the World Final). Remnants of events that do not exist are still there:

- `FINALS_TIERS` in `utils/seasonFixture.ts` includes `"All-Star Match"`, and the finals insert
  special-cases an All-Star home side, but no All-Star event is scheduled.
- `pages/competition/all-star.tsx` waits for that match forever (finding 7).
- `pages/matches.tsx:304` falls back to "/ 73 played".
- The calendar is 78 slots: 10 regional, 60 World Tour, 2 finals, 6 holiday.

**Question for Rob (game design, not changed):** is 62 the intended season length, or were 14
events — including an All-Star match — meant to exist? Until that is decided, the All-Star
remnants and the "73" fallback should stay as they are.

---

## 6. Not checked in this audit

- Stage-by-stage rendering of the fail-state ladder on `dashboard.tsx` / `manager-contract.tsx`.
- Visual layout, responsiveness or copy quality of any screen: this audit covers data and wiring.
- `components/` beyond the pieces named above, and `artifacts/mockup-sandbox`.
- Whether generated gameplay content (draft names, staff and prospect candidates, sponsor offers)
  should count as "fake". It is listed as generation, not flagged, because it is presented as new
  content rather than as a record of something that happened.
