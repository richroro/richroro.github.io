import sys, glob, os
from PIL import Image, ImageDraw, ImageFont
files = sys.argv[3:]; out = sys.argv[1]; cols = int(sys.argv[2])
W = 300; ims = []
for f in files:
    im = Image.open(f).convert('RGB'); h = int(im.height * W / im.width)
    ims.append((os.path.basename(f), im.resize((W, h))))
H = max(i.height for _, i in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (W + 10), rows * (H + 40)), (40, 40, 40))
d = ImageDraw.Draw(sheet)
try: font = ImageFont.truetype(os.path.expanduser('~/.local/share/fonts/korean/NotoSansKR-700.ttf'), 22)
except OSError: font = ImageFont.load_default()
for k, (n, im) in enumerate(ims):
    x = (k % cols) * (W + 10); y = (k // cols) * (H + 40)
    sheet.paste(im, (x, y + 34)); d.text((x + 4, y + 2), n, fill=(255, 255, 0), font=font)
sheet.save(out); print(sheet.size)
