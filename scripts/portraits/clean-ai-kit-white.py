"""
Serve brief 11 Oct, item 5: white tips and splashes left on the AI club
pictures' bikinis after the 10 Oct recolour (the white kits recoloured to each
country's colours).

How it finds them, picture by picture, without touching anything else:
  1. The picture it was made from: the 5 Oct picture of the slot named in
     scripts/portraits/ai-senior-cards.json `pictureFrom`, white kit and all
     (from git, passed in as --originals). Same size, same pixels outside what
     the recolour changed.
  2. The recoloured kit: pixels the recolour changed (more than 30 of 255 on
     a channel), closed, split into regions; only regions on the body are the
     bikini (centre of the card, between shoulders and thighs: 17-85% of its height, big enough).
     Anything else the recolour changed (an umbrella in one picture) is left
     exactly as it is.
  3. The leftovers: the white kit in the original (light and colourless,
     in regions the recolour mostly covered) and its 3 px soft edge; there,
     every pixel that is not the kit's colour now (more than 35 from the
     nearest shade of either kit colour) is a leftover: the pale rim, the
     white tips and splashes. Also any grey or white (neutral) pixel within
     3 px of the coloured fabric that is not the kit's colour: the pale rim
     on dark kits. Skin (warm) and sky (blue) are never neutral; fences and
     umbrellas away from the kit are never in either zone.
  4. They are filled from the kit around them (OpenCV inpainting, radius 4),
     so they take the kit's colour and shading. Nothing else is written.
Kits meant to be white (kit: null, the Korean picture at ASI_03_P2) are skipped.

Usage: py scripts/portraits/clean-ai-kit-white.py --pictures <ai dir> --originals <5 Oct ai dir> --out <dir> [--report report.json]
"""
import argparse, json, os
import cv2
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--pictures", required=True)
ap.add_argument("--originals", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--report", default=None)
ap.add_argument("--cards", default=os.path.join(os.path.dirname(__file__), "ai-senior-cards.json"))
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

cards = [p for p in json.load(open(a.cards, encoding="utf-8"))["players"] if p["kind"] == "new"]
file_of = lambda sid: f"player_senior_ai_{sid.lower()}.webp"
report = []

for p in cards:
    name, sid = p["name"], p["stableId"]
    cur_path = os.path.join(a.pictures, file_of(sid))
    cur_img = Image.open(cur_path).convert("RGB")
    row = {"stableId": sid, "name": name, "kit": p.get("kit"), "pictureFrom": p.get("pictureFrom")}
    if not p.get("kit"):
        row.update(skipped="kit meant to be white (kit: null): not written, the picture stays as it is", fixed=0)
        report.append(row)
        continue
    orig = np.asarray(Image.open(os.path.join(a.originals, file_of(p["pictureFrom"]))).convert("RGB")).astype(np.int16)
    cur = np.asarray(cur_img).astype(np.int16)
    h, w, _ = cur.shape
    diff = np.abs(cur - orig).max(axis=2)
    changed = (diff > 30).astype(np.uint8)
    closed = cv2.morphologyEx(changed, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(closed, 8)
    keep = np.zeros((h, w), np.uint8)
    regions, others = [], []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        cx, cy = x + bw / 2, y + bh / 2
        on_body = area >= 250 and 0.27 * w <= cx <= 0.73 * w and 0.17 * h <= cy <= 0.85 * h and bw <= 0.5 * w
        (regions if on_body else others).append({"box": [int(x), int(y), int(bw), int(bh)], "area": int(area)})
        if on_body:
            keep[labels == i] = 1
    near = cv2.dilate(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    # The white kit in the original: light, colourless (white fabric is neutral;
    # skin is warm, R-B 50-100; sky is blue, R-B about -130), in regions the
    # recolour mostly covered (so not a fence post or an umbrella).
    o_min, o_max = orig.min(axis=2), orig.max(axis=2)
    o_rb = orig[:, :, 0] - orig[:, :, 2]
    white = ((o_min >= 120) & ((o_max - o_min) <= 40) & (np.abs(o_rb) <= 25) & (near == 1)).astype(np.uint8)
    wn, wl, ws, _ = cv2.connectedComponentsWithStats(white, 8)
    covered = cv2.dilate(changed, np.ones((3, 3), np.uint8))
    white_kit = np.zeros((h, w), np.uint8)
    for i in range(1, wn):
        comp = wl == i
        if covered[comp].mean() >= 0.5 and (keep[comp].any() or cv2.dilate(keep, np.ones((5, 5), np.uint8))[comp].any()):
            white_kit[comp] = 1
    # Its soft edge (the recolour's blend into skin), 3 px.
    zone = cv2.dilate(white_kit, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) == 1
    # Inside that zone, whatever is not the kit's colour now is a leftover: a
    # pixel the recolour missed or only half-coloured (the pale rim, the tips).
    kits = [np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], float) for c in p["kit"]]
    c_f = cur.astype(float)
    resid = np.full((h, w), 1e9)
    for k in kits:
        sc = np.clip((c_f @ k) / (k @ k), 0.15, 1.3)
        resid = np.minimum(resid, np.linalg.norm(c_f - sc[:, :, None] * k, axis=2))
    # And a grey or white pixel right at the kit's edge (within 3 px of the
    # coloured fabric) that is not the kit's colour: the pale rim on dark kits.
    # Neutral means not skin (warm) and not sky (blue).
    fabric = ((resid <= 35) & (keep == 1)).astype(np.uint8)
    edge3 = cv2.dilate(fabric, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) == 1
    c_min, c_max = cur.min(axis=2), cur.max(axis=2)
    neutral = ((c_max - c_min) <= 50) & (np.abs(cur[:, :, 0] - cur[:, :, 2]) <= 30) & (c_max >= 70)
    leftover = (zone | (edge3 & neutral)) & (resid > 35)
    mask = leftover.astype(np.uint8) * 255
    fixed = cv2.inpaint(np.ascontiguousarray(cur.astype(np.uint8)[:, :, ::-1]), mask, 4, cv2.INPAINT_TELEA)[:, :, ::-1]
    Image.fromarray(fixed).save(os.path.join(a.out, file_of(sid)), "WEBP", quality=92, method=6)
    ys, xs = np.nonzero(leftover)
    row.update(fixed=int(leftover.sum()), bikiniRegions=regions, otherChangedRegions=[r for r in others if r["area"] >= 250],
               fixedBox=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if len(xs) else None)
    report.append(row)
    print(f"{sid} {name}: {row['fixed']} pixels, {len(regions)} bikini regions, {len(row['otherChangedRegions'])} other changed regions left alone")

if a.report:
    json.dump(report, open(a.report, "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
