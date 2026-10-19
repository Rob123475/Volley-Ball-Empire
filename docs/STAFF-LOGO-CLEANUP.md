# Staff and manager portrait logo cleanup — 19 Oct 2026

Branch `fix/trademark-cleanup`. **Not built.** Originals backed up before anything was touched: `C:\Users\rbonn\Documents\BVE-image-backup-19oct\staff` and `\managers` (428 files).

## Counts

| | Checked | Changed | No mark (byte-identical to backup) |
|---|---|---|---|
| `images/staff` (all subfolders + root) | 359 | 178 | 181 |
| `images/managers` | 69 | 2 | 67 |
| **Total** | **428** | **180** | **248** |

Every file keeps its name, format (lossy WebP) and exact pixel size, checked against the backup: 0 mismatches. Changed files were re-encoded at the quality closest to their original file size (78–96); total size went from 4.15 MB to 3.79 MB.

## What the marks were

- **The swirl volleyball emblem, often with "BEACH VOLLEYBALL / WORLD TOUR" under it**, in white, gold or orange on T-shirts, singlets and polos (left or centre chest), on cap fronts (navy, green, red, white, yellow caps), on suit lapel pins (scouts, promotional managers) and on one clipboard (fitness_trainer staff-16).
- **"WORLD TOUR" text in the background**: the yellow-on-black net banners behind most assistant coaches, and black signs bottom-left on several fitness trainers.
- **Large blurred swirl emblems on the back wall** behind all massage therapists, promotional managers, scouts and strength conditioners.
- Managers: a swirl-style emblem on a flag (manager_57_canadian_man) and on a shield (manager_61_serbian_man). The other 67 managers had no marks.

## Files changed

- `staff/assistant_coach/`: all 35
- `staff/fitness_trainer/`: 18 (all but staff-03, staff-08)
- `staff/head_coach/`: 27 (staff-02, 06, 11–35)
- `staff/massage_therapist/`: 19 (all but staff-13)
- `staff/physiotherapist/`: 8 (staff-01, 06, 12, 14, 15, 17, 19, 20)
- `staff/promotional_manager/`: all 10
- `staff/scouts/`: all 10
- `staff/strength_conditioner/`: all 20
- `staff/` root: 31 — staff_assistant_coach_01–11, staff_fitness_trainer_01/04/05/06/09/10, staff_head_coach_01–10, staff_medical_physiotherapist_01/06, staff_scout_11/12
- `managers/`: manager_57_canadian_man, manager_61_serbian_man

No marks, so untouched: medical_doctor, medical_nutritionist, medical_specialist, sports_scientist, and the staff_medical_doctor/nutritionist/science/specialist root files.

## Method

Python + OpenCV and Pillow. I placed regions by hand for each image (boxes or polygons), checked against gridded zooms. Faces, hair, sunglasses, lanyards, chains and ID cards were kept out of every region.
- **Fabric:** mark pixels were found against a median-filtered fabric estimate, filled with Navier–Stokes inpainting, and given a light grain so the fabric matches its surroundings.
- **Caps:** the crest was repainted with a smooth shading fit taken from the surrounding cap fabric.
- **Banners:** the text was removed along the banner's slant, leaving the plain dark banner colour.
- **Walls:** the blurred emblem was replaced by a smooth surface fitted to the wall around it.

Every image was looked at on before/after contact sheets (30 sheets for the 180 changed files). I also checked two of the sheets myself (assistant coaches 01–06, scouts 04–09): no marks remain, and the fabric and lanyards are intact.

## Could not clean perfectly: regenerate if you want them perfect

No visible mark remains in any of these, but the repair shows up close:

- **Cap crowns plain and slightly flat** (logo gone, seam and crease detail softened): `staff/assistant_coach/` staff-01–09, 11–16, 19–22, 24, 25, 28, 29, 31, 33; `staff/staff_assistant_coach_01`–`_11`. Worst: **staff_assistant_coach_02, staff_assistant_coach_10, assistant_coach/staff-01, assistant_coach/staff-09** (cap bill edge slightly soft).
- **Banner or sign fills with faint banding or flat patches:** `staff/assistant_coach/` staff-18, 24 (bottom-left sign is a flat dark block), 26, 30, 32, 34; `staff/fitness_trainer/` staff-05, staff-16.
- **Wall smooth or blurry where the emblem was** (reads as a defocused wall at card size), about 58 images across `massage_therapist`, `promotional_manager`, `scouts` and `strength_conditioner`. Most visible: **promotional_manager staff-06 and staff-10**.
- **managers/manager_57_canadian_man:** the flag is now plain blue. Fine at card size, but you can see it was edited.

## Left as is, for Rob to judge

- Generic role words on uniforms: NUTRITIONIST, PHYSIOTHERAPIST, PHYSIO ASSISTANT, SPORTS SCIENTIST, CARDIOLOGY, NEUROLOGY, ORTHOPAEDIC. These are not FIVB marks.
- Fictional club signage in manager backgrounds (partial words like "…KERS …ALL CLUB" on 03, "…KE …CLUB" on 15, "OCE… BEACH" on 19, "…AZAR …ALL CLUB" on 35, "MEDIC…" on 66). These look like invented clubs, not the World Tour mark.

## Not covered by this pass

The senior cards are covered in `docs/TRADEMARK-CLEANUP.md`: since 19 Oct evening their walls are clean. The AI-club cards, the graduates and the staff/manager portraits were checked afterwards for wall writing and tour emblems: none found.
