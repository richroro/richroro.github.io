"""Text cards for the newsab shorts (our own graphics, no third-party pictures).
usage: python3 make_cards.py   -> card_*.png next to this file (1080x1080, content kept in the top 620 px
because the red headline and the captions sit over the lower part of the picture)."""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "..", "..", "shorts", "viral5", "public", "fonts")
T = lambda s: ImageFont.truetype(os.path.join(FONTS, "BlackHanSans-Regular.ttf"), s)
B = lambda s: ImageFont.truetype(os.path.join(FONTS, "Pretendard-Black.otf"), s)

def base(top=(18, 26, 64), bottom=(4, 6, 16)):
    im = Image.new("RGB", (1080, 1080))
    d = ImageDraw.Draw(im)
    for y in range(1080):
        k = y / 1079
        d.line([(0, y), (1080, y)], fill=tuple(int(a + (b - a) * k) for a, b in zip(top, bottom)))
    return im, d

def center(d, y, text, font, fill, stroke=0, sfill="black"):
    w = d.textlength(text, font=font)
    d.text(((1080 - w) / 2, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=sfill)

def save(im, name):
    im.save(os.path.join(HERE, name)); print(name)

# newsab1: 59 vs 58
im, d = base()
center(d, 40, "A매치 최다 골 (한국 남자)", B(54), (255, 225, 77))
center(d, 120, "59", T(300), (227, 24, 30), 10, "white")
center(d, 440, "손흥민 · 151경기", B(58), "white")
center(d, 530, "58  차범근 · 136경기", B(46), (170, 180, 200))
save(im, "card_59.png")

# newsab1: 1978 -> 2026
im, d = base()
center(d, 60, "차범근 58호 골", B(56), (170, 180, 200))
center(d, 140, "1978", T(200), "white")
center(d, 350, "↓  47년", B(64), (255, 225, 77))
center(d, 440, "2026", T(200), (227, 24, 30), 8, "white")
save(im, "card_1978.png")

# newsab2: player of the month
im, d = base((70, 12, 22), (12, 4, 8))
center(d, 50, "아틀레티코 마드리드", B(56), "white")
center(d, 140, "9월 이달의 선수", T(130), (255, 225, 77))
center(d, 310, "이강인", T(190), (255, 255, 255), 8, (200, 16, 46))
center(d, 540, "구단 팬 투표 · 2026.10.2 발표", B(44), (230, 200, 200))
save(im, "card_potm.png")

# newsab2: what he did since joining
im, d = base((70, 12, 22), (12, 4, 8))
center(d, 40, "아틀레티코 이적 후", B(56), (230, 200, 200))
rows = [("8월", "말라가전 데뷔골 → 라리가 8월 이달의 골"), ("9월", "오사수나전 골 · 4대0 승"), ("9월", "레알 마드리드전 2대1 승 · 89분")]
y = 150
for m, t in rows:
    d.rounded_rectangle([60, y, 1020, y + 120], 24, fill=(255, 255, 255))
    d.text((90, y + 22), m, font=T(66), fill=(200, 16, 46))
    d.text((250, y + 36), t, font=B(44 if len(t) < 18 else 38), fill=(20, 20, 20))
    y += 145
save(im, "card_lee_run.png")

# newsab3: scoreboard
im, d = base((8, 40, 90), (2, 8, 20))
center(d, 40, "아시안게임 남자축구 결승", B(56), (255, 225, 77))
center(d, 150, "한국  1 : 0  일본", T(128), "white", 6, (10, 20, 60))
center(d, 360, "후반 16분 엄지성", B(70), "white")
center(d, 460, "2026.10.3 · 일본 도요타 스타디움", B(42), (170, 190, 220))
save(im, "card_score.png")

# newsab3: Eom Ji-sung (no licensed photo of him)
im, d = base((8, 40, 90), (2, 8, 20))
center(d, 40, "결승골", B(64), (255, 225, 77))
center(d, 130, "엄지성", T(220), (255, 255, 255), 8, (227, 24, 30))
center(d, 400, "스완지 시티 (잉글랜드)", B(60), "white")
center(d, 500, "이번 대회 4골", B(56), (255, 225, 77))
save(im, "card_eom.png")

# newsab3: four in a row
im, d = base((8, 40, 90), (2, 8, 20))
center(d, 40, "아시안게임 남자축구 금메달", B(54), (255, 225, 77))
for i, (yr, place) in enumerate([("2014", "인천"), ("2018", "자카르타"), ("2022", "항저우"), ("2026", "아이치·나고야")]):
    x = 50 + i * 250
    d.rounded_rectangle([x, 150, x + 230, 470], 26, fill=(255, 255, 255) if i < 3 else (255, 225, 77))
    w = d.textlength(yr, font=T(84)); d.text((x + (230 - w) / 2, 190), yr, font=T(84), fill=(10, 20, 60))
    w = d.textlength("🥇", font=B(40))
    f = B(36 if len(place) < 5 else 28); w = d.textlength(place, font=f); d.text((x + (230 - w) / 2, 330), place, font=f, fill=(40, 40, 40))
    w = d.textlength("금", font=T(70)); d.text((x + (230 - w) / 2, 380), "금", font=T(54), fill=(227, 24, 30))
center(d, 510, "사상 첫 4연패", T(90), "white", 6, (227, 24, 30))
save(im, "card_four.png")
