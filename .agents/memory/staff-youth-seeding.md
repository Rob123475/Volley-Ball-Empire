---
name: Staff & youth seeding
description: GCS paths, role names, image file selection, and youth JSON structure for seeder scripts
---

## Staff GCS paths
- Images stored under: `staff/<type>/staff-NN.webp` (e.g. `staff/head_coach/staff-01.webp`)
- DB `imageUrl`: `/objects/staff/<type>/staff-NN.webp`
- Script: `scripts/src/seed-staff.ts`

## Staff role names (DB `role` column)
Use these exact strings — old legacy data used snake_case but new entries use Title Case:
- "Head Coach", "Assistant Coach", "Fitness Trainer", "Doctor"
- "Physiotherapist", "Nutritionist", "Sports Scientist", "Medical Specialist"
- "Massage Therapist", "Scout", "Promotional Manager", "Strength Coach"

## Image file selection
For staff types with duplicate timestamps (two files per number), use the **lower** timestamp (original).
Types with fewer than 10 images:
- `fitness_trainer`: 8 images (01–06, 09, 10 — no 07/08)
- `medical_physiotherapist`: 9 images (01–09)
- `medical_science`: 8 images (01, 02, 04, 06–10 — no 03/05)

## Youth players
- Source file: `youthPlayers_international_1782962759017.json` (most recent, 60 total / 36 female)
- Regular file alternative: `youthPlayers_1782960878399.json` (60 total / 36 female)
- Filter to `gender === "Female"` for the all-women's game
- International file uses `primaryRole` field (not `role`)
- Position mapping: Server→spiker, Setter→setter, Blocker→blocker, Defender/Libero→defender, Universal→all_rounder
- Potential mapping (int): 5→Elite, 4→High, 3→Average, 2→Below Average, 1→Poor
- Continent mapping: "Africa" → "Africa & Middle East"
- All share one uploaded youth card image: `youth-cards/youth-card.webp`
- Seeded into `playersTable` with `playerType='youth'`, `isDraftPlayer=false`, `teamId=null`
- **Why not youthProspectsTable**: requires `teamId NOT NULL` — can't be standalone free agents

## Pre-existing staff in DB
Before our seeder ran there were ~77 legacy staff rows with different role/naming conventions (snake_case roles like "assistant_coach", "head_coach", etc.). New rows use the Title Case role names above.
