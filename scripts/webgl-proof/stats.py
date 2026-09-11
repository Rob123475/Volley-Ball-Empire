import sys
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f).convert("RGB"); w, h = im.size
    px = list(im.get_flattened_data()) if hasattr(im, "get_flattened_data") else list(im.getdata())
    def stats(p):
        n = len(p); r = sum(x[0] for x in p)/n; g = sum(x[1] for x in p)/n; b = sum(x[2] for x in p)/n
        sky = sum(1 for x in p if x[2] > 150 and x[2] > x[0] + 25 and x[1] > 110)/n
        sand = sum(1 for x in p if x[0] > 150 and x[0] > x[2] + 25 and x[1] > 110)/n
        return f"mean RGB ({r:.0f},{g:.0f},{b:.0f}) sky-blue {sky*100:.1f}% sand-like {sand*100:.1f}%"
    print(f.split("/")[-1], "| whole:", stats(px), "| bottom half:", stats(px[w*(h//2):]))
