"""Staff portraits (daytime 2 Oct, N-46): crop each source card to head and
shoulders, above its name band, and blur the scenery behind the person so no
printed name, flag, card frame or logo text from the source can be read.

Run ONCE on the source cards (the images as they were at commit d641514); the
images in public/images/staff are its output, 500 x 500. Running it on its own
output would crop again, so give it a folder of the source cards:
  git archive d641514 artifacts/beach-volleyball/public/images/staff | tar -x -C <tmp>
  python scripts/portraits/crop-staff-portraits.py <out> scripts/portraits/staff-face-boxes.json <tmp>/artifacts/beach-volleyball/public/images/staff
Needs Pillow and opencv-python-headless 4.x (Haar face cascades). Faces the
cascades miss (sunglasses under caps) are given in staff-face-boxes.json."""
import sys, os, glob, json
import cv2, numpy as np
from PIL import Image
root = sys.argv[3]  # the source cards, never public/images/staff itself
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
over = json.load(open(sys.argv[2])) if len(sys.argv) > 2 and os.path.exists(sys.argv[2]) else {}
files = sorted(glob.glob(root + "/*.webp")) + sorted(glob.glob(root + "/*/*.webp"))
cas = [cv2.CascadeClassifier(cv2.data.haarcascades + n) for n in ("haarcascade_frontalface_default.xml", "haarcascade_frontalface_alt2.xml", "haarcascade_frontalface_alt.xml")]
OW, OH = 500, 500
def find_face(g, w, h):
    for scale, nb, eq in ((1.08, 6, False), (1.05, 3, True)):
        gg = cv2.equalizeHist(g) if eq else g
        best = None
        for c in cas:
            for (x, y, fw, fh) in c.detectMultiScale(gg, scale, nb, minSize=(int(w * 0.1), int(w * 0.1))):
                cx, cy = x + fw / 2, y + fh / 2
                if cy < 0.40 * h and 0.12 * w < cx < 0.88 * w and (not best or fw * fh > best[2] * best[3]):
                    best = (int(x), int(y), int(fw), int(fh))
        if best: return best
    return None
boxes = {}
for f in files:
    rel = os.path.relpath(f, root).replace("\\", "/")
    im = Image.open(f).convert("RGB"); w, h = im.size
    k = over.get(rel, {})
    face = k.get("face") or find_face(cv2.cvtColor(np.array(im), cv2.COLOR_RGB2GRAY), w, h)
    if not face: print("NO FACE", rel); continue
    fx, fy, fw, fh = face
    H = 2.35 * fh * k.get("zoom", 1); W = H * OW / OH
    cx = fx + fw / 2 + k.get("dx", 0) * fw; top = max(0, fy - 0.45 * fh + k.get("dy", 0) * fh)
    bottom_max = h * k.get("bottom", 0.64 if w > h else 0.70)
    if top + H > bottom_max: H = bottom_max - top; W = H * OW / OH
    if W > w: W = w; H = W * OH / OW
    # Keep the face near the middle (within its middle 30%): where the person stands
    # near the picture's edge, crop closer rather than leave the face at the side.
    if min(cx, w - cx) < 0.35 * W: W = min(cx, w - cx) / 0.35; H = W * OH / OW
    x0 = min(max(0, cx - W / 2), w - W)
    box = [int(round(v)) for v in (x0, top, x0 + W, top + H)]
    crop = np.array(im.crop(box).resize((OW, OH), Image.LANCZOS))
    # The person, by GrabCut seeded from the face: sharp; the scenery behind: blurred.
    s = OW / (box[2] - box[0])
    fcx, fty, ffw, ffh = (fx + fw / 2 - box[0]) * s, (fy - box[1]) * s, fw * s, fh * s
    # A head-and-shoulders shape around the face: nothing outside it is ever
    # sharp, so scenery beside the head (the wall logos) is always blurred.
    shape = np.zeros((OH, OW), np.uint8)
    cv2.ellipse(shape, (int(fcx), int(fty + 0.5 * ffh)), (int(0.72 * ffw), int(0.78 * ffh)), 0, 0, 360, 1, -1)
    chin = fty + 0.95 * ffh
    for y in range(max(0, int(chin)), OH):
        half = min(1.9, 0.55 + 1.6 * (y - chin) / ffh) * ffw
        shape[y, max(0, int(fcx - half)):int(fcx + half)] = 1
    near = cv2.dilate(shape, np.ones((41, 41), np.uint8))
    m = np.where(near > 0, cv2.GC_PR_BGD, cv2.GC_BGD).astype(np.uint8)
    m[shape > 0] = cv2.GC_PR_FGD
    if (m == cv2.GC_BGD).sum() < 200: m[:6, :] = np.where(shape[:6, :] > 0, m[:6, :], cv2.GC_BGD)
    m[int(fty + 0.15 * ffh):int(fty + 0.9 * ffh), int(fcx - 0.3 * ffw):int(fcx + 0.3 * ffw)] = cv2.GC_FGD
    m[int(fty + 1.2 * ffh):, max(0, int(fcx - 0.6 * ffw)):int(fcx + 0.6 * ffw)] = cv2.GC_FGD
    fg = shape.astype(np.float32)
    if (m == cv2.GC_BGD).any():
        bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
        cv2.grabCut(cv2.cvtColor(crop, cv2.COLOR_RGB2BGR), m, None, bgd, fgd, 5, cv2.GC_INIT_WITH_MASK)
        fg = np.isin(m, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.float32) * cv2.dilate(shape, np.ones((9, 9), np.uint8))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    fg = cv2.GaussianBlur(fg, (0, 0), 6)[..., None]
    blur = cv2.GaussianBlur(crop, (0, 0), k.get("blur", 14))
    res = (crop * fg + blur * (1 - fg)).astype(np.uint8)
    boxes[rel] = {"box": box, "face": [int(v) for v in face], "size": [w, h]}
    dst = os.path.join(out, rel); os.makedirs(os.path.dirname(dst) or out, exist_ok=True)
    Image.fromarray(res).save(dst, "WEBP", quality=88)
json.dump(boxes, open(os.path.join(out, "_boxes.json"), "w"), indent=1)
print(len(boxes), "cropped of", len(files))
