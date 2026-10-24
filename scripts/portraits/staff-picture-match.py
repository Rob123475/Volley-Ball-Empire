"""A1 second pass: pHash on look-alike corporate headshots is not decisive (4-10 bits apart
for different people), so every new picture is also compared pixel by pixel: the
installer's crop, 64x64 colour, mean absolute difference (0-255) and a 256-bit pHash.
A copy (even re-encoded or logo-cleaned) is a few levels apart; a different person 20+.
"""
import json, os, sys
import numpy as np
import cv2
from PIL import Image

# 1.1.3 rebuild (A1, 24 Oct): an optional second argument names the new set's folder
# (the 81 cleaned head coaches, assistant coaches and scouts).
NEW = sys.argv[2] if len(sys.argv) > 2 else r"C:\Users\rbonn\OneDrive\Desktop\staff portraits 1.1.2"
OLD = r"C:\Users\rbonn\OneDrive\Desktop\staff portraits"
GAME = r"C:\vbe-tm\artifacts\beach-volleyball\public\images\staff"
OUT = sys.argv[1]


def crop(im):
    w, h = im.size
    side = min(w, h)
    left = round((w - side) / 2)
    top = round((h - side) * 0.1) if h > w else 0
    return im.crop((left, top, left + side, top + side))


def load(path):
    im = crop(Image.open(path).convert("RGB"))
    small = np.asarray(im.resize((64, 64), Image.LANCZOS), dtype=np.float32)
    g = np.asarray(im.convert("L").resize((64, 64), Image.LANCZOS), dtype=np.float32)
    d = cv2.dct(g)[:16, :16].flatten()
    bits = d[1:] > np.median(d[1:])
    return small, bits


def walk(root):
    out = []
    for dp, _, fs in os.walk(root):
        for f in sorted(fs):
            if f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
                out.append(os.path.join(dp, f))
    return out


def stack(paths):
    xs = [load(p) for p in paths]
    return np.stack([x[0] for x in xs]), np.stack([x[1] for x in xs])


newp, oldp, gamep = walk(NEW), walk(OLD), walk(GAME)
N, NB = stack(newp)
O, OB = stack(oldp)
G, GB = stack(gamep)


def best(i, P, B, paths, skip=None):
    mad = np.abs(P - N[i]).mean(axis=(1, 2, 3))
    hb = (B != NB[i]).sum(axis=1)
    if skip is not None:
        mad[skip] = 1e9
    j = int(np.argmin(mad))
    return {"mad": round(float(mad[j]), 2), "bits": int(hb[j]), "path": paths[j]}


rows = []
for i, p in enumerate(newp):
    rows.append({"file": os.path.relpath(p, NEW), "game": best(i, G, GB, gamep), "old": best(i, O, OB, oldp),
                 "new": best(i, N, NB, newp, skip=i)})
json.dump(rows, open(OUT, "w", encoding="utf-8", newline="\n"), indent=1, ensure_ascii=False)
for r in sorted(rows, key=lambda r: min(r["game"]["mad"], r["old"]["mad"], r["new"]["mad"])):
    print(f"game {r['game']['mad']:6.2f}/{r['game']['bits']:3d} old {r['old']['mad']:6.2f}/{r['old']['bits']:3d} new {r['new']['mad']:6.2f}/{r['new']['bits']:3d}  {r['file'][-40:]}  ~ {os.path.relpath(r['game']['path'], GAME)}  ~new {os.path.relpath(r['new']['path'], NEW)[-40:]}")
