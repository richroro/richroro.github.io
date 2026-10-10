"""Write sources.json (every picture actually on screen, the music, the maps, the texts) from edit.json,
script.json and sources_images.json (the Rijksmuseum records checked for CC0 when the pictures were chosen)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
E = json.load(open(f"{HERE}/edit.json")); S = json.load(open(f"{HERE}/script.json"))
img = json.load(open(f"{HERE}/sources_images.json"))
used = sorted({s["img"] for s in E["shots"] if s["kind"] == "img"})
assert all("publicdomain/zero" in img[k]["licence_url"] for k in used)
music = sorted({c["music"] for c in S["chapters"]})
out = {
    "images": {k: img[k] for k in used},
    "music": [{"title": m, "artist": "Kevin MacLeod", "url": "https://incompetech.com/music/royalty-free/mp3-royaltyfree/" + m.replace(" ", "%20") + ".mp3",
               "licence": "CC BY 4.0", "credit": f"\"{m}\" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/"} for m in music],
    "maps": {"data": "Natural Earth 1:10m and 1:50m land (public domain), https://www.naturalearthdata.com/ via github.com/nvkelso/natural-earth-vector",
             "drawn_by": "make_maps.py (own route and labels; place identifications are traditional guesses and are labelled 추정)"},
    "voice": {"engine": "Microsoft Edge TTS", "voice": S["voice"]["edge"], "rate": S["voice"]["rate"]},
    "text": {
        "butler": "Homer, The Odyssey, tr. Samuel Butler (1900), Project Gutenberg #1727, https://www.gutenberg.org/ebooks/1727 (public domain)",
        "murray": "Homer, Odyssey, tr. A. T. Murray (Loeb, 1919), public domain; Perseus Digital Library, https://www.perseus.tufts.edu/hopper/text?doc=Perseus:text:1999.01.0136",
        "britannica": "Encyclopaedia Britannica, 'Odyssey' (epic by Homer), https://www.britannica.com/topic/Odyssey-epic-by-Homer",
        "unesco": "UNESCO World Heritage Centre, 'Gochang, Hwasun and Ganghwa Dolmen Sites' (inscribed 2000), https://whc.unesco.org/en/list/977"},
}
json.dump(out, open(f"{HERE}/sources.json", "w"), ensure_ascii=False, indent=1)
print(len(used), "images,", len(music), "tracks")
