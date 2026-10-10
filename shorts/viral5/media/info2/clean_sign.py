"""life6: paint over the maker's name printed on the exit sign in Pexels photo 37643871 (no brand names on screen).
usage: python3 media/info2/clean_sign.py public/life6/src/ph37643871.jpg public/life6/src/ph37643871_clean.jpg"""
import sys
from PIL import Image, ImageDraw
im = Image.open(sys.argv[1]).convert("RGB"); W, H = im.size; k = W / 600
box = [int(415 * k), int(458 * k), int(492 * k), int(492 * k)]
green = im.getpixel((int(400 * k), int(475 * k)))
ImageDraw.Draw(im).rectangle(box, fill=green)
im.save(sys.argv[2], quality=95)
