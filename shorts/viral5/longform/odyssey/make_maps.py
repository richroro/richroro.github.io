"""Draw the Odyssey maps from Natural Earth land polygons (public domain) and write the route points.

usage: python3 make_maps.py <ne_50m_land.geojson> <ne_10m_land.geojson> <out_dir>
Writes <out_dir>/map_med.jpg, map_world.jpg, map_korea.jpg (3840x2160, no labels; labels and the
dotted route are drawn by the video on top) and route.json with every point in 1920x1080 frame pixels.
Places other than Troy and Ithaca are the traditional guesses (ancient writers and later scholars),
which the narration presents as guesses.
"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFilter

W, H, SS = 3840, 2160, 2  # drawn at 2x the 1920x1080 frame so the slow zoom stays sharp
SEA, LAND, COAST = (14, 26, 36), (86, 72, 50), (214, 192, 146)

def view(lon0, lon1, lat_c):
    """equirectangular view centred on lat_c, lon0..lon1 across the frame width"""
    k = W / ((lon1 - lon0) * math.cos(math.radians(lat_c)))
    lat_top = lat_c + (H / 2) / k
    return lambda lon, lat: ((lon - lon0) * math.cos(math.radians(lat_c)) * k, (lat_top - lat) * k)

def rings(geo):
    for f in geo["features"]:
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        for p in polys:
            yield p[0]

def draw(geo, proj, path, grid=True):
    im = Image.new("RGB", (W, H), SEA)
    # faint lat/lon grid, like an old chart
    d = ImageDraw.Draw(im)
    if grid:
        for lon in range(-180, 181, 5):
            pts = [proj(lon, la) for la in range(-80, 81, 2)]
            d.line(pts, fill=(22, 36, 48), width=2)
        for la in range(-80, 81, 5):
            pts = [proj(lo, la) for lo in range(-180, 181, 2)]
            d.line(pts, fill=(22, 36, 48), width=2)
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    for r in rings(geo):
        pts = [proj(x, y) for x, y in r]
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        if max(xs) < -50 or min(xs) > W + 50 or max(ys) < -50 or min(ys) > H + 50:
            continue
        gd.polygon(pts, fill=255)
    # soft coastal glow, then land, then a thin bright coastline
    im.paste(LAND, mask=glow)
    edge = glow.filter(ImageFilter.FIND_EDGES).point(lambda v: 255 if v > 40 else 0).filter(ImageFilter.MaxFilter(3))
    im.paste(COAST, mask=edge)
    # vignette
    vig = Image.radial_gradient("L").resize((W, H)).point(lambda v: int(v * 0.55))
    im = Image.composite(Image.new("RGB", (W, H), (4, 7, 10)), im, vig)
    im.save(path, quality=90)

def main():
    g50, g10, out = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    geo10 = json.load(open(g10)); geo50 = json.load(open(g50))
    route = {}

    med = view(5.0, 33.0, 37.2)
    draw(geo10, med, f"{out}/map_med.jpg")
    P = {  # lon, lat
        "troy": (26.24, 39.96), "ismaros": (25.55, 40.85), "malea": (23.20, 36.44),
        "djerba": (10.86, 33.81), "cyclops": (15.15, 37.55), "aeolus": (14.95, 38.47),
        "ithaca": (20.68, 38.40), "laestry": (9.16, 41.39), "circe": (13.05, 41.23),
        "avernus": (14.08, 40.84), "sirens": (14.43, 40.58), "messina": (15.63, 38.25),
        "thrinacia": (15.27, 37.05), "ogygia": (14.25, 36.04), "scheria": (19.88, 39.62),
    }
    px = lambda k: [round(v / SS, 1) for v in med(*P[k])]
    # the sea lanes between the points: a few waypoints keep the line off the land
    legs = [
        ["troy", (25.6, 39.6), "ismaros"], ["ismaros", (24.9, 39.0), (24.4, 37.6), "malea"],
        ["malea", (21.5, 35.6), (16.0, 34.4), "djerba"], ["djerba", (12.6, 35.6), (15.0, 36.4), (15.5, 37.0), "cyclops"],
        ["cyclops", (15.45, 37.75), (15.62, 38.2), (15.45, 38.45), "aeolus"],
        ["aeolus", (15.5, 38.4), (15.63, 38.05), (16.6, 37.75), (18.6, 38.3), "ithaca"], ["ithaca", (18.4, 38.0), (16.6, 37.6), (15.7, 37.95), (15.6, 38.3), "aeolus"],
        ["aeolus", (12.2, 39.5), (9.6, 41.0), "laestry"], ["laestry", (11.0, 41.3), "circe"],
        ["circe", (13.7, 40.9), "avernus"], ["avernus", (14.1, 40.55), "sirens"],
        ["sirens", (15.2, 39.6), (15.65, 38.6), "messina"], ["messina", (15.42, 37.6), "thrinacia"],
        ["thrinacia", (15.0, 36.6), "ogygia"], ["ogygia", (17.2, 37.3), (19.4, 39.2), "scheria"],
        ["scheria", (20.3, 39.0), "ithaca"],
    ]
    def pt(v):
        return px(v) if isinstance(v, str) else [round(c / SS, 1) for c in med(*v)]
    route["med"] = {"image": "map_med.jpg", "points": {k: px(k) for k in P},
                    "legs": [[pt(v) for v in leg] for leg in legs],
                    "direct": [pt(v) for v in ["troy", (25.6, 39.6), (24.9, 39.0), (24.4, 37.6), "malea", (21.9, 36.3), (21.1, 37.0), (20.9, 37.9), "ithaca"]]}

    world = view(-12.0, 142.0, 33.0)
    draw(geo50, world, f"{out}/map_world.jpg")
    wp = lambda lon, lat: [round(c / SS, 1) for c in world(lon, lat)]
    route["world"] = {"image": "map_world.jpg", "greece": wp(22.5, 38.6), "korea": wp(127.0, 36.3)}

    kor = view(119.5, 135.5, 36.3)
    draw(geo10, kor, f"{out}/map_korea.jpg")
    kp = lambda lon, lat: [round(c / SS, 1) for c in kor(lon, lat)]
    route["korea"] = {"image": "map_korea.jpg", "ganghwa": kp(126.45, 37.75), "gochang": kp(126.70, 35.43),
                      "hwasun": kp(126.93, 34.98)}
    json.dump(route, open(f"{out}/route.json", "w"), indent=1)

if __name__ == "__main__":
    main()
