"""Stock clips used by the horror1-horror8 shorts (written into each edit.json "sources" and media/horror/sources.json).
Every licence page was opened on 2026-10-10. Pexels files: https://www.pexels.com/download/video/<id>/;
Pixabay files: the cdn.pixabay.com URL below. All were cut to <=40-60 s, scaled to 1080p, muted and graded dark
(eq gamma 0.78 / saturation 0.5 / blue tint + vignette; already-dark clips only desaturated) into public/<short>/src/.
horror5-horror8 clips (licence pages opened 2026-10-10) are graded by media/horror/grade2.sh; NIGHTVISION ones get a
grey night-vision look instead (the home-cam recording in horror7)."""
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
    # horror5 비상계단
    "5843879": ("an-empty-staircase", "Erik Mclean"),
    "6010700": ("an-empty-stairs", "Tima Miroshnichenko"),
    "9152640": ("high-angle-shot-of-stairs", "Erik Mclean"),
    "12096163": ("smoke-in-staircase", "Sasha Poberailo"),
    "5986347": ("high-angle-view-of-a-circular-staircase", "Pat Whelen"),
    "39024320": ("warmly-lit-wooden-stairs-in-modern-interior", "Alef Morais"),
    "7644222": ("an-exit-signage-at-the-building", "Yaroslav Shuraev"),
    "3134591": ("a-lighted-exit-sign-for-direction", "Caleb Oquendo"),
    "4990438": ("stairs-inside-the-old-building", "Pavel Danilyuk"),
    # horror6 지하주차장
    "6028858": ("empty-parking-lot", "Артем Ковальчук"),
    "6028882": ("video-of-a-parking-deck", "Артем Ковальчук"),
    "19217892": ("an-empty-parking-garage-with-a-large-ceiling", "Nino Souza"),
    "5972195": ("empty-mall-parking", "gusat silviu"),
    "27890130": ("a-car-is-parked-in-a-parking-garage", "Baran Robin"),
    "38433795": ("rainy-day-drive-through-foggy-window", "Rishabh Kaple"),
    "5192033": ("video-of-a-wet-window", "Ming Z"),
    "5227362": ("raindrops-falling-on-the-glass", "Francesco Ungaro"),
    "32078487": ("automated-garage-door-closing-at-night", "Rec Everywhere"),
    # horror7 홈캠
    "5245970": ("a-close-up-shot-of-a-camera-iris", "Hemanth K M"),
    "6028175": ("camera-lens-closeup", "Ricky Esquivel"),
    "34106136": ("cctv-camera-on-a-rainy-day-with-architectural-background", "Cemrecan Yurtman"),
    "19228170": ("the-foyer-of-a-home-with-hardwood-floors-and-a-chandelier", "Curtis Adams"),
    "19193293": ("living-room", "Rafael Fernanz"),
    "3773489": ("tracking-shot-of-a-bedroom", "Curtis Adams"),
    "15887293": ("a-double-bed-in-a-luminous-bedroom", "Curtis Adams"),
    "6443851": ("video-of-a-bed-and-pillows", "Pavel Danilyuk"),
    "6114429": ("lamp-on-a-side-table-lighting-up", "cottonbro studio"),
    # horror8 캠핑장
    "5994915": ("video-of-a-tent-in-the-middle-of-the-forest-at-night", "cottonbro studio"),
    "9591436": ("light-flashing-in-tent-at-night", "Kain kn"),
    "4162882": ("a-tent-on-the-campsite-by-the-lake", "Grisha Grishkoff"),
    "5419248": ("close-up-video-of-a-camping-tent", "Yaroslav Shuraev"),
    "9976082": ("rain-falling-on-ground-at-night", "George Morina"),
    "5391986": ("leaves-swaying-in-the-wind-at-night", "Saidouni Sidi Med"),
    "34405948": ("full-moon-shining-through-forest-trees", "Emir Reinado"),
    "39485457": ("close-up-of-water-droplets-on-fabric-canopy", "Nothing Ahead"),
    "39485454": ("raindrops-dripping-from-canopy-focused-in-frame", "Nothing Ahead"),
    "39619866": ("rainwater-puddles-in-a-muddy-pathway", "Nothing Ahead"),
    "7714908": ("muddy-puddle", "Greta Hoffman"),
    # [괴담] v2: the first-shot hands and silhouettes, and horror9-12 (licence pages opened 2026-10-10)
    "7701962": ("close-up-view-of-a-person-pressing-elevator-button", "MART PRODUCTION"),
    "2108274": ("person-opening-and-closing-the-door", "Nazar Matveichev"),
    "6611938": ("man-tapping-blank-screen-on-smartphone", "Tima Miroshnichenko"),
    "7646797": ("person-opening-the-door", "Alena Darmel"),
    "4354915": ("a-person-pressing-an-elevator-button", "Ahmet Akpolat"),
    "6302990": ("hand-slipping-on-rainy-window", "Klaus Nielsen"),
    "13358555": ("hands-scrolling-on-cellphone", "Edwin Lopez"),
    "5994916": ("silhouette-of-hands-inside-a-tent-in-the-middle-of-the-forest", "cottonbro studio"),
    "5994907": ("silhouette-of-a-person-inside-a-tent", "cottonbro studio"),
    "6611941": ("person-holding-a-smartphone", "Tima Miroshnichenko"),
    "7822022": ("notification-on-a-phone", "RDNE Stock project"),
    "8342690": ("tables-and-chairs-inside-the-classroom", "Pavel Danilyuk"),
    "6935499": ("student-desks-inside-the-classroom", "RDNE Stock project"),
    "8342695": ("close-up-video-of-tables-and-chairs-inside-the-classroom", "Pavel Danilyuk"),
    "7055339": ("a-person-flipping-pages-in-the-dark", "Kindel Media"),
    "5897634": ("an-empty-classroom", "Katerina Holmes"),
    "6326847": ("person-writing-on-a-notebook-using-a-pen", "Kaboompics (karola-g)"),
    "6863499": ("person-stamping-on-pink-paper", "Nataliya Vaitkevich"),
    "39425735": ("cozy-nighttime-journal-writing-by-lamp", "Sergei Starostin"),
    "9479751": ("close-up-video-of-a-people-holding-hands-together", "Ron Lach"),
    "19585708": ("a-house-in-the-middle-of-the-woods", "Salih Sezgen"),
    "35889601": ("nighttime-view-of-cozy-home-interior", "K (@kelly)"),
    "10210122": ("a-close-up-of-a-person-s-hand", "cottonbro studio"),
    "7234023": ("close-up-of-a-person-s-palm", "Artem Podrez"),
    "5271483": ("cropped-video-of-an-old-lady-hands", "Moe Magners"),
    "7546178": ("a-close-up-footage-of-people-holding-hands", "SHVETS production"),
    "4547598": ("a-door-is-open-in-a-dark-room-with-sunlight-coming-in", "cottonbro studio"),
    "9594994": ("garments-on-clothes-hangers", "Ron Lach"),
    "8322393": ("hanging-clothes", "Ron Lach"),
    "8533759": ("ground-level-shot-of-a-person-picking-up-and-putting-down-a-pair-of-shoes", "Kaboompics (karola-g)"),
    "37554583": ("silhouette-hands-on-frosted-glass-at-night", "Zulfugar Karimov"),
}
NIGHTVISION = {"6443851", "15887293"}
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

# ── [괴담] v2 (make_edits_v2.py, grade3.sh) ──
# horizontal crop centre for the 9:16 full-screen frame (0 = left edge of the source, 1 = right; default 0.5)
CX = {"7701962": 0.64, "4354915": 0.35, "6611938": 0.42, "13358555": 0.28, "2108274": 0.27, "9479751": 0.57,
      "6326847": 0.36, "39425735": 0.64, "7546178": 0.55, "9594994": 0.6, "37554583": 0.45, "5897634": 0.4,
      "7362620": 0.3, "7362603": 0.35, "8533759": 0.9}
# already-dark clips (colour only) and daylight clips that need a deeper grade
DARK = {"19217894", "19217895", "19217899", "7598737", "5384813", "4623153", "34786856", "34786878",
        "5994915", "9591436", "9976082", "5391986", "34405948", "12096163", "6028858", "6028882", "19193293", "6114429", "3134591",
        "13358555", "6611941", "5994916", "5994907", "7055339", "37554583", "35889601", "39425735", "4547598", "7701962"}
BRIGHT = {"9479751", "7546178", "5271483", "6326847", "6863499", "8342690", "8342695", "6935499", "5897634", "9594994",
          "8322393", "2108274", "7646797", "6302990", "4354915", "8533759", "6611938", "10210122", "7234023", "19585708", "7822022"}
