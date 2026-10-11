"""Contact sheet of a short's AI pictures (to check that the same characters come back): aigen/sseol/img/<id>/sheet.jpg

usage: python3 aigen/sseol/sheet.py <id> [<id> ...]      (test = the consistency test)
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
CELL, COLS = 300, 4
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def sheet(sid):
    d = os.path.join(HERE, "img", sid)
    names = sorted(f for f in os.listdir(d) if f.endswith(".jpg") and f != "sheet.jpg")
    rows = (len(names) + COLS - 1) // COLS
    out = Image.new("RGB", (COLS * CELL, rows * CELL), "white")
    font = ImageFont.truetype(FONT, 22) if os.path.exists(FONT) else ImageFont.load_default()
    for i, n in enumerate(names):
        im = Image.open(os.path.join(d, n)).convert("RGB").resize((CELL - 6, CELL - 6))
        x, y = (i % COLS) * CELL + 3, (i // COLS) * CELL + 3
        out.paste(im, (x, y))
        dr = ImageDraw.Draw(out)
        dr.rectangle([x, y, x + 12 + 13 * len(n[:-4]), y + 30], fill="white")
        dr.text((x + 6, y + 3), n[:-4], fill="black", font=font)
    out.save(os.path.join(d, "sheet.jpg"), quality=85)
    print(os.path.join(d, "sheet.jpg"))


for sid in sys.argv[1:] or sys.exit(__doc__):
    sheet(sid)
