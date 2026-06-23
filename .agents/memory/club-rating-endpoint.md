---
name: Club Rating endpoint
description: How the GET /club-rating endpoint calculates the overall club score.
---

## Route
`GET /api/club-rating` — handled in `artifacts/api-server/src/routes/facilities.ts`

## Weights
| Component | Weight | Source |
|-----------|--------|--------|
| Players   | 30%    | Avg OVR (speed+power+defense+serve+block)/5 across active players |
| Staff     | 15%    | Avg overallRating of non-medical staff |
| Medical   | 15%    | Avg overallRating of medical staff (roles: team_doctor, medical_specialist, physiotherapist, nutritionist, sports_chemist) |
| Facilities| 25%    | Avg level of 9 main types / 10 * 100 |
| Youth     | 15%    | youth_academy.level / 10 * 100 |

## Labels
- 90+ → "World Class Club"
- 80+ → "Elite Club"
- 70+ → "Professional Club"
- 60+ → "Established Club"
- 50+ → "Developing Club"
- 35+ → "Amateur Club"
- <35  → "Startup Club"

**Why:** Club Rating is displayed on Dashboard and Facilities page; it creates a single number that captures the overall health of all club systems.
