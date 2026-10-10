"""Thumbnail for the Odyssey documentary: a dark painting full frame, one small white line and one big yellow word
in the bottom third. usage: python3 make_thumb.py <out.jpg>"""
import os, sys
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__)); PUB = f"{HERE}/../../public"
W, H = 1280, 720
im = Image.open(f"{PUB}/odyssey/img/nuijen_storm.jpg").convert("RGB")
s = max(W / im.width, H / im.height) * 1.12
im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
x0 = int((im.width - W) * 0.62); y0 = int((im.height - H) * 0.55)
im = im.crop((x0, y0, x0 + W, y0 + H))
im = ImageEnhance.Brightness(im).enhance(0.62); im = ImageEnhance.Contrast(im).enhance(1.15)
# darken the bottom third for the type
grad = Image.new("L", (1, H)); [grad.putpixel((0, y), int(235 * max(0, (y - H * 0.45) / (H * 0.55)) ** 1.3)) for y in range(H)]
im = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), im, grad.resize((W, H)))
d = ImageDraw.Draw(im)
T = f"{PUB}/fonts/BlackHanSans-Regular.ttf"
small, big = ImageFont.truetype(T, 62), ImageFont.truetype(T, 230)
def text(xy, s, f, fill, stroke):
    d.text(xy, s, font=f, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0))
line = "그중 8년은 섬에 갇혔다"
text((70, 392), line, small, (255, 255, 255), 5)
text((60, 478), "10년", big, (255, 214, 10), 9)
im.save(sys.argv[1], quality=92)
print(sys.argv[1], len(line.replace(" ", "")), "chars")
