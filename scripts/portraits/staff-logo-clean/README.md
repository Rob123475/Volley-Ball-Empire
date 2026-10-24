# Staff portrait logo cleanup (1.1.3 rebuild, A1, 24 Oct 2026)

The 19 Oct method (docs/STAFF-LOGO-CLEANUP.md): `clean.py` is the 19 Oct script unchanged
except where it reads its pictures (`orig/<id>.png` beside it). Regions are placed per
picture in `boxes.json` (boxes or polygons; fabric = inpaint + grain, `fit` = smooth
shading from the ring, `lerp`/`open` = banners, `wall` = smooth surface for a
defocused wall emblem).

1. `node crop.cjs <work dir>` writes the installer's crop (500x500) of Rob's head
   coaches (`hcNN`), assistant coaches (`acNN`) and scouts (`scNN`) as lossless PNGs
   in `<work dir>/orig`, with `index.json` (id -> Rob's file).
2. `findpin.py` found the scouts' lapel pins and `walls.py` drew each scout's wall
   region (right of the person, away from anything sharp or dark); both wrote into
   `boxes.json`, which then had the coaches' regions and hand fixes added.
3. `py run.py all` writes `out/<id>.png`; `zoom.py` / `pairs.py` make before/after sheets.

The cleaned copies were written under Rob's file names to
`Documents\BVE-staff-portraits-1.1.3-cleaned\{Head Coach,Assistant Coach,Scout}` and
installed with `scripts/install-staff-portraits.cjs ... --names docs/staff-portrait-names-1.1.3.json`.
Scout (16) (`sc08`) is the same picture as (15) and has no regions: it is not installed.
