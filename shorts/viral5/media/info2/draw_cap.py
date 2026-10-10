"""Our own drawing for life7 (replaces the branded pen photos): a ballpoint pen cap with the ventilation hole at its tip.
usage: python3 media/info2/draw_cap.py public/life7/src/cap_drawn.png"""
import sys
from PIL import Image, ImageDraw, ImageFilter
W, H = 1600, 2000
img = Image.new("RGB", (W, H))
d = ImageDraw.Draw(img)
for y in range(H):  # soft studio backdrop
    v = int(236 - 40 * y / H); d.line([(0, y), (W, y)], fill=(v, v - 4, v - 10))
sh = Image.new("L", (W, H), 0); ImageDraw.Draw(sh).rounded_rectangle([650, 420, 1050, 1800], 200, fill=120)
img.paste((90, 90, 100), (0, 0), sh.filter(ImageFilter.GaussianBlur(40)))
cap = Image.new("RGBA", (W, H), (0, 0, 0, 0)); c = ImageDraw.Draw(cap)
c.rounded_rectangle([600, 360, 1000, 1760], 200, fill=(30, 90, 200, 255))          # body
c.rectangle([600, 1500, 1000, 1760], fill=(30, 90, 200, 255))
for k in range(60):  # highlight down the left side
    a = 1 - k / 60; c.line([(650 + k, 520), (650 + k, 1700)], fill=(int(30 + 90 * a), int(90 + 80 * a), int(200 + 45 * a), 255))
c.rounded_rectangle([1000, 520, 1080, 1350], 40, fill=(20, 70, 170, 255))           # clip
c.ellipse([735, 430, 865, 560], fill=(8, 10, 18, 255))                                # the hole
c.ellipse([752, 446, 848, 542], fill=(25, 28, 40, 255))
c.rectangle([600, 1700, 1000, 1760], fill=(22, 72, 175, 255))
img.paste(cap, (0, 0), cap)
img.save(sys.argv[1])
