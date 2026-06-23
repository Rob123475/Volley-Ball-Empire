---
name: Facility types
description: Which facility DB types exist, which 9 are displayed, and which 2 are legacy-only.
---

## Displayed 9 (DISPLAY_ORDER in facilities.tsx)
1. `training_complex` → "Training Centre"
2. `medical_centre` → "Medical Centre"
3. `gymnasium` → "Gymnasium" (added)
4. `nutrition_centre` → "Nutrition Centre" (added)
5. `youth_academy` → "Youth Academy"
6. `scouting_department` → "Scouting Department" (added)
7. `sports_science_lab` → "Performance Centre" (renamed in UI only)
8. `commercial_department` → "Commercial Department" (added)
9. `beach_resort` → "Beach Resort" (added)

## Legacy (in FACILITY_TYPES array but not displayed)
- `psychology_centre` — still applied in training/wellbeing bonuses
- `olympic_performance_centre` — reserved for future use

**Why:** All 11 types must stay in the server's FACILITY_TYPES array so `ensureFacilities()` initialises them and existing backend bonus logic (training.ts, wellbeing.ts) continues to work.

**How to apply:** When adding a new facility type, add it to both `FACILITY_TYPES` in facilities.ts (server) AND `DISPLAY_ORDER`/`FACILITY_CONFIG` in facilities.tsx (frontend). After codegen, also add new generated types to `lib/api-zod/src/index.ts`.
