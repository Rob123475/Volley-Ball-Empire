"""
Serve brief 11 Oct, item 5: before/after contact sheet of the 96 AI pictures'
bikinis (the white tips and splashes cleaned). Each pair: before on the left,
after on the right, the bikini area enlarged, the player's name and slot under
it. 12 pairs a page.

Usage: py scripts/portraits/ai-kit-contact-sheet.py <before dir> <after dir> <report.json> <out prefix>
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

before, after, report, prefix = sys.argv[1:5]
rows = json.load(open(report, encoding="utf-8"))
try:
    font = ImageFont.truetype("arial.ttf", 15)
except OSError:
    font = ImageFont.load_default()
TH, PAIR_W, PER_ROW, ROWS = 330, 460, 3, 4
per_page = PER_ROW * ROWS
pages = []
for page in range(0, len(rows), per_page):
    sheet = Image.new("RGB", (PER_ROW * PAIR_W, ROWS * (TH + 26)), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    for k, r in enumerate(rows[page:page + per_page]):
        f = f"player_senior_ai_{r['stableId'].lower()}.webp"
        b = Image.open(f"{before}/{f}").convert("RGB")
        a = Image.open(f"{after}/{f}").convert("RGB") if os.path.exists(f"{after}/{f}") else b   # not written: unchanged
        regs = r.get("bikiniRegions") or []
        if regs:
            x0 = min(g["box"][0] for g in regs) - 18; y0 = min(g["box"][1] for g in regs) - 18
            x1 = max(g["box"][0] + g["box"][2] for g in regs) + 18; y1 = max(g["box"][1] + g["box"][3] for g in regs) + 18
        else:
            x0, y0, x1, y1 = 150, 150, 450, 600
        box = (max(0, x0), max(0, y0), min(b.width, x1), min(b.height, y1))
        s = min(TH / (box[3] - box[1]), (PAIR_W / 2 - 8) / (box[2] - box[0]))
        size = (int((box[2] - box[0]) * s), int((box[3] - box[1]) * s))
        cx, cy = (k % PER_ROW) * PAIR_W, (k // PER_ROW) * (TH + 26)
        sheet.paste(b.crop(box).resize(size, Image.LANCZOS), (cx + 2, cy + 2))
        sheet.paste(a.crop(box).resize(size, Image.LANCZOS), (cx + PAIR_W // 2 + 2, cy + 2))
        label = f"{r['name']} ({r['stableId']})  " + ("kit white on purpose: unchanged" if r.get("skipped") else f"{r['fixed']} px")
        d.text((cx + 6, cy + TH + 5), label, fill=(235, 235, 235), font=font)
    out = f"{prefix}-{page // per_page + 1}.png"
    sheet.save(out)
    pages.append(out)
print("\n".join(pages))
