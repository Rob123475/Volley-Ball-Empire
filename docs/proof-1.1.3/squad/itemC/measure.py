# measure.py list.json out.json : the skin of each picture's face, measured.
# list.json: [{"key": ..., "url": "/images/..."}]. For each: the largest face OpenCV's frontal detector finds
# (else the top-centre of the portrait), its cheeks and forehead (not eyes, mouth, hair), the pixels there that are
# skin-coloured (YCrCb), and their median CIE L*, b* and ITA (individual typology angle, atan((L*-50)/b*), degrees).
import cv2, json, math, sys, numpy as np
PUBLIC = "C:/vbe-tm/artifacts/beach-volleyball/public"
items = json.load(open(sys.argv[1], encoding="utf-8"))
casc = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
out = []
for it in items:
    img = cv2.imread(PUBLIC + it["url"])
    if img is None:
        raise SystemExit("cannot read " + it["url"])
    h, w = img.shape[:2]
    grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = casc.detectMultiScale(grey, scaleFactor=1.1, minNeighbors=5, minSize=(w // 8, w // 8))
    if len(faces):
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
        found = True
    else:
        x, y, fw, fh = int(w * 0.3), int(h * 0.1), int(w * 0.4), int(w * 0.4)
        found = False
    # Cheeks (left and right, below the eyes) and the forehead's middle.
    regions = [
        (x + int(fw * 0.15), y + int(fh * 0.50), x + int(fw * 0.38), y + int(fh * 0.72)),
        (x + int(fw * 0.62), y + int(fh * 0.50), x + int(fw * 0.85), y + int(fh * 0.72)),
        (x + int(fw * 0.35), y + int(fh * 0.12), x + int(fw * 0.65), y + int(fh * 0.28)),
    ]
    px = np.concatenate([img[y0:y1, x0:x1].reshape(-1, 3) for x0, y0, x1, y1 in regions])
    ycc = cv2.cvtColor(px.reshape(-1, 1, 3), cv2.COLOR_BGR2YCrCb).reshape(-1, 3)
    skin = (ycc[:, 1] >= 133) & (ycc[:, 1] <= 180) & (ycc[:, 2] >= 77) & (ycc[:, 2] <= 135)
    sel = px[skin] if skin.sum() >= 50 else px
    lab = cv2.cvtColor(sel.reshape(-1, 1, 3).astype(np.float32) / 255.0, cv2.COLOR_BGR2LAB).reshape(-1, 3)
    L, b = float(np.median(lab[:, 0])), float(np.median(lab[:, 2]))
    ita = math.degrees(math.atan2(L - 50, b)) if b != 0 else 90.0
    out.append({**it, "L": round(L, 1), "b": round(b, 1), "ita": round(ita, 1), "face": found, "skinShare": round(float(skin.mean()), 2),
                "box": [int(x), int(y), int(fw), int(fh)]})
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), indent=1)
print(len(out), "measured;", sum(1 for o in out if not o["face"]), "without a detected face")
