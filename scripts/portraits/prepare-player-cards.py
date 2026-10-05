"""A4 (final brief 5 Oct): Rob's new player images, prepared for the game.

Reads Rob's folders (never writes there), and writes into OUT:
  graduates/<slug>/graduate_<slug>_NN.webp   20 a continent (Africa 21): graduating youth
  seniors/ai/player_senior_ai_<stable_id>.webp  96: the AI club players marked "needs card"
  manifest.json   every output file -> its source file, MD5 of the source, and (seniors) who it went to
  contact/*.jpg   contact sheets, every image with its label
Each image: the whole picture kept (head to toe, as the other player cards), resized to 600 x 800,
WebP quality 82 (about 60-120 KB instead of 6-7 MB).
"""
import csv, glob, hashlib, json, os, re, sqlite3, sys
from PIL import Image, ImageDraw, ImageFont

SRC = r"C:\Users\rbonn\OneDrive\Desktop\Downloads youth cards"
OUT = sys.argv[1]
TRY_DB = r"C:\vbe-try\lib\db\volleyball-empire.sqlite"
W, H = 600, 800

YOUTH = {
    "africa_middle_east": "Downloads youth-cards-africa",
    "oceania": "downloads youth-cards oceania",
    "asia": "downloads youth-cards-asia",
    "europe": "downloads youth-cards-europe",
    "north_america": "downloads youth-cards-north-america",
    "south_america": "downloads youth-cards-south-america",
}
SENIOR = {
    "oceania": "downloads-senior-card-oceania",
    "africa_middle_east": "downloads-senior-cards-africa",
    "asia": "downloads-senior-cards-asia",
    "europe": "downloads-senior-cards-europe",
    "north_america": "downloads-senior-cards-north-america",
    "south_america": "downloads-senior-cards-south-america",
}
SLUG = {"africa_middle_east": "africa", "asia": "asia", "europe": "europe",
        "north_america": "northam", "south_america": "southam", "oceania": "oceania"}

# Rob's brief: the copies to skip.
AFRICA_DUP = "Agent Image - A professional sports photograph of a new_ original adult woman aged 21_ deep brown sk"
SKIP = {
    ("africa_middle_east", AFRICA_DUP + " (1).png"),   # = (3)
    ("africa_middle_east", AFRICA_DUP + " (2).png"),   # = the one without a number
}
ASIA_SKIP_PREFIX = "Agent Image - Photograph a new adult woman aged 21 with"   # 5 copies of South America youth images
ASIA_SKIP = {
    "Agent Image - Photograph a new adult Indonesian woman aged 30 with medium brown skin_ long straight (1).png",
    "Agent Image - Photograph a new adult Sri Lankan woman aged 33 with medium-dark deep tan skin_ a slee (1).png",
}
# One South America name is cut off at "medium" before its skin words end; by the
# continent's count (8 Medium Dark in the CSV, 7 other files say medium-dark) it is Medium Dark.
BAND_OVERRIDE = {"Agent Image - Photograph a new adult Colombian woman of Afro-Caribbean heritage aged 26 with medium.png": "Medium Dark"}


def md5(p):
    return hashlib.md5(open(p, "rb").read()).hexdigest()


def pngs(folder):
    return sorted(f for f in os.listdir(os.path.join(SRC, folder)) if f.lower().endswith(".png"))


def band_of(fname):
    if fname in BAND_OVERRIDE:
        return BAND_OVERRIDE[fname]
    # The skin words of Rob's prompt, right after "with": medium-light / medium-dark /
    # medium (medium warm, medium olive, "medium light-olive" ...) / light / dark (deep, very dark ...).
    words = fname.split(" with ", 1)[1].lower() if " with " in fname else ""
    if words.startswith("medium-light"):
        return "Medium Light"
    if words.startswith("medium-dark"):
        return "Medium Dark"
    if words.startswith("medium"):
        return "Medium"
    if words.startswith("light"):
        return "Light"
    if re.match(r"(very |deep |rich )*(dark|deep)", words):
        return "Dark"
    raise SystemExit(f"no band for {fname}")


def descriptor(fname):
    m = re.match(r"Agent Image - Photograph a new adult (.*?) (?:woman|from)", fname)
    return m.group(1) if m else ""


def age_of(fname):
    m = re.search(r"aged (\d+)", fname)
    return int(m.group(1)) if m else None


def prep(src, dst):
    im = Image.open(src).convert("RGB")
    im = im.resize((W, H), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "WEBP", quality=82, method=6)


manifest = {"graduates": {}, "seniors": []}

# ── Graduating youth ──────────────────────────────────────────────────────────
for cont, folder in YOUTH.items():
    files = [f for f in pngs(folder) if (cont, f) not in SKIP]
    out = []
    for i, f in enumerate(files, 1):
        rel = f"graduates/{SLUG[cont]}/graduate_{SLUG[cont]}_{i:02d}.webp"
        prep(os.path.join(SRC, folder, f), os.path.join(OUT, rel))
        out.append({"file": "/images/players/" + rel, "source": f"{folder}\\{f}", "sourceMd5": md5(os.path.join(SRC, folder, f))})
    manifest["graduates"][cont] = out
    print(cont, "youth", len(out))

# ── AI club seniors ───────────────────────────────────────────────────────────
rows = list(csv.DictReader(open(os.path.join(SRC, YOUTH["africa_middle_east"], "AI-CLUB-PLAYER-CARDS.csv"), encoding="utf-8-sig")))
need = [r for r in rows if r["Card"].strip().lower() == "needs card"]
con = sqlite3.connect(f"file:{TRY_DB}?mode=ro", uri=True)
ids = {(n, c): (sid, tone, age) for n, c, sid, tone, age in con.execute(
    "select p.name, t.continent, p.stable_id, p.skin_tone, p.base_age from continental_pool_players p join continental_pool_teams t on t.id = p.pool_team_id")}
by_name = {}
for (n, c), v in ids.items():
    by_name.setdefault(n, []).append((c, v))

for cont, folder in SENIOR.items():
    files = [f for f in pngs(folder)
             if not (cont == "asia" and (f.startswith(ASIA_SKIP_PREFIX) or f in ASIA_SKIP))]
    imgs = [{"f": f, "band": band_of(f), "desc": descriptor(f), "age": age_of(f)} for f in files]
    people = [r for r in need if r["Continent"] == cont]
    # The mix must match exactly (Rob checked it, 5 Oct).
    from collections import Counter
    a, b = Counter(i["band"] for i in imgs), Counter(r["Skin tone"] for r in people)
    if a != b:
        raise SystemExit(f"{cont}: images {dict(a)} vs players {dict(b)}")
    left = list(imgs)
    pairs = []
    # First the images whose nationality is the player's country, then by nearest age.
    for pass_ in ("nation", "age"):
        for r in people:
            if any(p[0] is r for p in pairs):
                continue
            pool = [i for i in left if i["band"] == r["Skin tone"]]
            if pass_ == "nation":
                pool = [i for i in pool if r["Country"][:4].lower() in i["desc"].lower()]
                if not pool:
                    continue
            pick = min(pool, key=lambda i: abs((i["age"] or 0) - int(r["Age"])))
            left.remove(pick)
            pairs.append((r, pick))
    assert not left and len(pairs) == len(people)
    for r, i in pairs:
        cands = [v for c, v in by_name.get(r["Player name"], []) if c == cont]
        if len(cands) != 1:
            raise SystemExit(f"no unique pool player for {r['Player name']} ({cont}): {cands}")
        sid, tone, age = cands[0]
        rel = f"seniors/ai/player_senior_ai_{sid.lower()}.webp"
        prep(os.path.join(SRC, folder, i["f"]), os.path.join(OUT, rel))
        manifest["seniors"].append({
            "stableId": sid, "name": r["Player name"], "club": r["AI club"], "country": r["Country"], "continent": cont,
            "skinTone": r["Skin tone"], "dbSkinTone": tone, "age": int(r["Age"]), "file": "/images/players/" + rel,
            "source": f"{folder}\\{i['f']}", "sourceMd5": md5(os.path.join(SRC, folder, i["f"])), "imageBand": i["band"],
            "nationMatch": r["Country"][:4].lower() in i["desc"].lower(),
        })
    print(cont, "seniors", len(pairs))

json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)

# ── Contact sheets ────────────────────────────────────────────────────────────
try:
    font = ImageFont.truetype("arial.ttf", 13)
    big = ImageFont.truetype("arialbd.ttf", 20)
except OSError:
    font = big = ImageFont.load_default()
TW, TH, LH, COLS = 200, 266, 58, 6


def sheet(title, items, dst):
    rows_ = (len(items) + COLS - 1) // COLS
    im = Image.new("RGB", (COLS * TW + 20, 40 + rows_ * (TH + LH) + 10), "white")
    d = ImageDraw.Draw(im)
    d.text((10, 10), title, fill="black", font=big)
    for k, (path, lines) in enumerate(items):
        x, y = 10 + (k % COLS) * TW, 40 + (k // COLS) * (TH + LH)
        im.paste(Image.open(path).convert("RGB").resize((TW - 8, TH - 8)), (x, y))
        for j, t in enumerate(lines):
            d.text((x, y + TH - 4 + j * 14), t[:36], fill="black", font=font)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, "JPEG", quality=85)


for cont, items in manifest["graduates"].items():
    sheet(f"Graduating youth: {cont} ({len(items)} images; given out in a career as each youth graduates)",
          [(os.path.join(OUT, x["file"].replace("/images/players/", "")), [x["file"].rsplit("/", 1)[1], x["source"].split("\\")[1][-30:]]) for x in items],
          os.path.join(OUT, "contact", f"graduates-{SLUG[cont]}.jpg"))
for cont in SENIOR:
    items = [x for x in manifest["seniors"] if x["continent"] == cont]
    items.sort(key=lambda x: (x["club"], x["name"]))
    sheet(f"AI club seniors: {cont} ({len(items)} images, each with the player it went to)",
          [(os.path.join(OUT, x["file"].replace("/images/players/", "")), [x["name"], x["club"], f"{x['country']} · {x['skinTone']} · {x['age']}"]) for x in items],
          os.path.join(OUT, "contact", f"seniors-{SLUG[cont]}.jpg"))
print("done")
