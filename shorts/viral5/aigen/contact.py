"""Contact sheet of a short's AI stills: python3 aigen/contact.py <id> -> media/aigen/<id>/contact.jpg (keys under each frame)."""
import glob, os, sys
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sid = sys.argv[1]; base = os.path.join(ROOT, "media/aigen", sid)
fs = sorted(glob.glob(os.path.join(base, "img", "*.jpg"))); cols = min(6, len(fs)); rows = (len(fs) + cols - 1) // cols
W, H = 320, 576
sheet = Image.new("RGB", (cols * W, rows * (H + 34)), "#111"); d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype("DejaVuSans.ttf", 24)
except OSError: font = ImageFont.load_default()
for i, f in enumerate(fs):
    x, y = (i % cols) * W, (i // cols) * (H + 34)
    sheet.paste(Image.open(f).convert("RGB").resize((W, H)), (x, y)); d.text((x + 8, y + H + 4), os.path.basename(f)[:-4], fill="white", font=font)
out = os.path.join(base, "contact.jpg"); sheet.save(out, quality=85); print(out)
