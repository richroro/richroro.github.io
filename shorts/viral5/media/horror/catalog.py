"""Stock clips used by the horror1-horror4 shorts (written into each edit.json "sources" and media/horror/sources.json).
Every licence page was opened on 2026-10-10. Pexels files: https://www.pexels.com/download/video/<id>/;
Pixabay files: the cdn.pixabay.com URL below. All were cut to <=40-60 s, scaled to 1080p, muted and graded dark
(eq gamma 0.78 / saturation 0.5 / blue tint + vignette; already-dark clips only desaturated) into public/<short>/src/."""
PX = {  # id: (slug, creator)
    "978049": ("elevator-floor-display-with-no-smoking-sign", "Stefan Kwiecinski"),
    "5823578": ("an-elevator-floor-indicator", "Charlotte May"),
    "34779661": ("elevator-doors-opening-to-underground-garage", "Stefan"),
    "37410328": ("vintage-elevator-in-classic-building-lobby", "Airam Dato-on"),
    "15201563": ("point-of-view-of-a-person-walking-along-a-creepy-hotel-corridor", "Darina Evstafeva"),
    "19217894": ("a-dark-hallway-with-a-light-on-the-wall", "Nino Souza"),
    "19217895": ("a-dark-hallway-with-a-light-on-the-floor", "Nino Souza"),
    "19217899": ("a-dark-empty-hallway-with-a-light-on-the-wall", "Nino Souza"),
    "15434928": ("an-elevator-screen-shows-going-downfloor", "Yusuf Çelik"),
    "9658661": ("camera-moving-through-narrow-corridor", "Videas Cl"),
    "35999369": ("hand-operating-metal-door-lock-close-up", "Jakub Bukowski"),
    "29038649": ("ornate-bronze-door-handle-close-up", "Адам Аушев"),
    "8472547": ("a-pair-of-shoes", "MART PRODUCTION"),
    "3512344": ("a-pair-of-nice-black-leather-shoes", "Bran Sodre"),
    "7598737": ("a-dark-empty-hallway", "Artadya Gumelar"),
    "5384813": ("a-night-lamp-turned-on", "Tima Miroshnichenko"),
    "34786788": ("closeup-of-mobile-phone-with-incoming-text", "Sambhaji Gaikwad"),
    "34786856": ("close-up-of-mobile-device-with-text-notification", "Sambhaji Gaikwad"),
    "34786878": ("close-up-of-smartphone-with-text-message", "Sambhaji Gaikwad"),
    "7362603": ("dolly-shot-of-a-package-in-paper-bag-left-by-the-door", "RDNE Stock project"),
    "7362620": ("video-of-a-box-fragile", "RDNE Stock project"),
    "5483080": ("an-empty-office", "cottonbro studio"),
    "8346903": ("computer-monitors-on-the-table", "Kampus Production"),
    "15365449": ("an-empty-shopping-mall-corridor-with-flickering-lights", "Matthias Groeneveld"),
    "4623153": ("lamp-shade-on-side-table", "Artem Podrez"),
    "32834268": ("cozy-bathroom-with-green-tiled-walls", "Benjamin Eriksen"),
    "27861219": ("a-bathroom-at-the-hotel", "Nothing Ahead"),
    "36778198": ("modern-white-bathroom-interior-design", "Curtis Adams"),
}
PB = {  # id: (slug, creator, cdn file)
    "130783": ("elevator-door-open-waiting-elevator", "Jesehab", "https://cdn.pixabay.com/video/2022/09/10/130783-748347211_large.mp4"),
    "131012": ("inside-elevator-elevator-rise", "Jesehab", "https://cdn.pixabay.com/video/2022/09/12/131012-748849022_large.mp4"),
    "28237": ("house-door-open-spirit-haunted", "Jacques_Barrette", "https://cdn.pixabay.com/video/2019/10/24/28237-368501613_large.mp4"),
}

def source(key):
    """edit.json "sources" entry for a file key like "px978049" or "pxpb130783" """
    if key.startswith("pxpb"):
        i = key[4:]; slug, who, cdn = PB[i]
        return {"file": f"{key}.mp4", "credit": "영상: Pixabay", "label": f"Pixabay video {i} by {who} (Pixabay Content License)",
                "url": f"https://pixabay.com/videos/{slug}-{i}/", "file_url": cdn, "license": "Pixabay Content License", "creator": who}
    i = key[2:]; slug, who = PX[i]
    return {"file": f"{key}.mp4", "credit": "영상: Pexels", "label": f"Pexels video {i} by {who} (Pexels License)",
            "url": f"https://www.pexels.com/video/{slug}-{i}/", "file_url": f"https://www.pexels.com/download/video/{i}/",
            "license": "Pexels License", "creator": who}
