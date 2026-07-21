---
name: Youth nationality system
description: Two nationality formats coexist for youth players; adjective→continent map needed for legacy data; replenishment endpoint details
---

## Two nationality formats in playersTable (youth)
- **Legacy (JSON seeder)**: Adjective form — "German", "Brazilian", "South African"
- **New (academy signings via youth-scouting.ts)**: Country-name form — "Germany", "Brazil"
- Both coexist; never assume one format for all youth

## ADJECTIVE_NATIONALITY_CONTINENT map (dev.ts)
Comprehensive mapping of adjective nationalities → DB continent value.
Used by `POST /api/dev/fix-youth-data` to back-fill continent for existing players.
Includes edge cases: "Omani" → "Africa & Middle East".

## DB continent values for youth/senior players
Use these exact strings (not the NATIONALITY_CONTINENT map values in olympics.ts which differ):
- "Africa & Middle East" (ampersand &, not "and")
- "Asia", "Europe", "North America", "South America", "Oceania"

**Why:** olympics.ts NATIONALITY_CONTINENT uses "Africa and Middle East" and
"Australia and Pacific Islands" — these DO NOT match DB column values.
DB uses "Africa & Middle East" and "Oceania".

## Youth image
Always: `/objects/youth-cards/youth-card.webp`
Never generate individual images for youth players.
Fixed in youth-scouting.ts (was setting null on academy signing).

## Youth pool maintenance
- Target: ~60 total non-retired youth across all player_type='youth' rows
- Replenishment: POST /api/dev/ensure-global-youth-pool — fills vacancies only
- Per-continent target: 10 (60 / 6 continents)
- Age range: 14–18; any seeded players with age > 18 should be capped at 18

## Olympic eligibility
olympics.ts must filter playerType = 'senior' — youth must be excluded.
Fixed: query now uses `and(eq(isActive, true), eq(playerType, "senior"))`.
