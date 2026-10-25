# sheet.py bands.json known-m.json out.jpg
# One row per repointed player: her old card, her new card, her old tone and her new tone (a swatch each: the median
# skin colour of the 10 Oct pictures in that band, measured as measure.py does), name and nation.
import cv2, json, sys, numpy as np
PUBLIC = "C:/vbe-tm/artifacts/beach-volleyball/public"
BANDS = ["Light", "Medium Light", "Medium", "Medium Dark", "Dark"]
rows = json.load(open(sys.argv[1], encoding="utf-8"))
known = json.load(open(sys.argv[2], encoding="utf-8"))

def skin_bgr(it):
    img = cv2.imread(PUBLIC + it["url"])
    x, y, fw, fh = it["box"]
    regs = [(x + int(fw * .15), y + int(fh * .5), x + int(fw * .38), y + int(fh * .72)), (x + int(fw * .62), y + int(fh * .5), x + int(fw * .85), y + int(fh * .72)),
            (x + int(fw * .35), y + int(fh * .12), x + int(fw * .65), y + int(fh * .28))]
    px = np.concatenate([img[b:d, a:c].reshape(-1, 3) for a, b, c, d in regs])
    ycc = cv2.cvtColor(px.reshape(-1, 1, 3), cv2.COLOR_BGR2YCrCb).reshape(-1, 3)
    m = (ycc[:, 1] >= 133) & (ycc[:, 1] <= 180) & (ycc[:, 2] >= 77) & (ycc[:, 2] <= 135)
    sel = px[m] if m.sum() >= 50 else px
    return np.median(sel, axis=0)

swatch = {}
for b in BANDS:
    cols = [skin_bgr(k) for k in known if k["band"] == b and k["face"]]
    swatch[b] = tuple(int(v) for v in np.median(np.array(cols), axis=0))

CW, CH = 150, 200   # card thumbnails (3:4)
SW = 170
H = CH + 8
font = cv2.FONT_HERSHEY_SIMPLEX
def card(url):
    img = cv2.imread(PUBLIC + url)
    return cv2.resize(img, (CW, CH)) if img is not None else np.full((CH, CW, 3), 200, np.uint8)
def chip(band, title):
    t = np.full((H, SW, 3), 255, np.uint8)
    cv2.putText(t, title, (8, 22), font, 0.5, (90, 90, 90), 1, cv2.LINE_AA)
    cv2.rectangle(t, (8, 32), (SW - 8, 132), swatch[band], -1)
    cv2.rectangle(t, (8, 32), (SW - 8, 132), (60, 60, 60), 1)
    cv2.putText(t, band, (8, 160), font, 0.6, (0, 0, 0), 2 if title == "new tone" else 1, cv2.LINE_AA)
    return t
def text(lines, w=300):
    t = np.full((H, w, 3), 255, np.uint8)
    for i, (s, sc, th) in enumerate(lines):
        cv2.putText(t, s, (8, 30 + i * 30), font, sc, (0, 0, 0), th, cv2.LINE_AA)
    return t
gap = lambda: np.full((H, 6, 3), 255, np.uint8)

out = []
head = np.full((40, 6 + CW + 6 + CW + 6 + SW + 6 + SW + 6 + 300, 3), 255, np.uint8)
cv2.putText(head, "old card        new card         old tone            new tone (her new picture's band)", (10, 27), font, 0.6, (0, 0, 0), 1, cv2.LINE_AA)
out.append(head)
for r in rows:
    def pad(im):
        p = np.full((H, im.shape[1], 3), 255, np.uint8); p[4:4 + im.shape[0]] = im; return p
    line = np.hstack([gap(), pad(card(r["old"])), gap(), pad(card(r["card"])), gap(), chip(r["toneBefore"], "old tone"), gap(), chip(r["band"], "new tone"), gap(),
                      text([(r["key"], 0.6, 2), (r["name"], 0.6, 1), (r["country"], 0.55, 1), ("changed" if r["toneBefore"] != r["band"] else "unchanged", 0.55, 1)])])
    out.append(line)
    out.append(np.full((2, line.shape[1], 3), 225, np.uint8))
sheet = np.vstack(out)
cv2.imwrite(sys.argv[3], sheet, [cv2.IMWRITE_JPEG_QUALITY, 86])
print(sheet.shape, json.dumps({b: swatch[b] for b in BANDS}))
