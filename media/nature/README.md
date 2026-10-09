# Nature & wildlife clips (US federal, public domain)

Source footage for Korean YouTube Shorts. All clips are works of US federal agencies
(National Park Service, NOAA Fisheries) downloaded directly from the agency's own
media pages, so they are public domain. Credit lines are kept in each `.json` anyway
(courtesy credit is good practice; NOAA asks for "NOAA").

Each clip: H.264 CRF 22, ≤1080p, AAC 160k, `+faststart`, under 60 MB.
Cuts were chosen from contact sheets. Each `<name>.json` has agency, title, date, source page,
file URL, cut range, contents, licence note and credit line.

| file | agency | what | length | audio |
|---|---|---|---|---|
| `elk_rams_cars.mp4` | NPS Yellowstone (NPS/Dale Bohlke) | Rutting bull elk rams a truck, a sedan and a row of parked cars in Mammoth Hot Springs while tourists film | 61 s | silent track |
| `wolf_pups_toys.mp4` | NPS Yellowstone (NPS/Jacob W. Frank) | Trail cams: Mollie's Pack wolves carry "toys" (bones, antlers, an elk leg) to the den for pups — the cute one | 32 s | music |
| `wolf_chases_elk.mp4` | NPS Yellowstone (NPS/Neal Herbert) | Black wolf tests a cow elk; splashing chase back and forth across Soda Butte Creek | 90 s | narration (English) |
| `bobcat_hunts_ducks.mp4` | NPS Yellowstone (NPS/Neal Herbert) | Bobcat stalks mallards on a snowy riverbank, dives in and swims after them | 52 s | natural sound |
| `grizzly_spring_snow.mp4` | NPS Yellowstone (NPS/Neal Herbert) | Big grizzly just out of hibernation walks through deep snow and down a snowy road past geysers | 62 s | narration (English) |
| `bison_calves.mp4` | NPS Yellowstone (NPS/Neal Herbert) | Orange "red dog" bison calves with their mothers in Lamar Valley | 47 s | near-silent |
| `old_faithful_eruption.mp4` | NPS Yellowstone (NPS/Dave Krueger) | Old Faithful erupting — telephoto close-ups plus wide shot from the Old Faithful Inn roof with the crowd | 90 s | silent track |
| `humpback_underwater.mp4` | NOAA Fisheries | Humpback whales underwater: close passes, white pectoral fins, mother and calf in turquoise water | 90 s | ambient underwater sound |

Notes
- Narrated clips (`wolf_chases_elk`, `grizzly_spring_snow`) have English voice-over; mute or replace the
  audio for Korean Shorts. NPS "Minute Out In It" title cards and end cards are cut out.
- The NPS Old Faithful source has an NPS logo bug in its first ~52 s and after ~3:59; the cut (52–142 s) avoids it.
- The NOAA file URL is a signed Brightcove CDN link that expires; re-download from the source page's
  "download video" button.
- Looked at and skipped: "Bison herd chasing grizzly" webcam (animals are specks), "Bull Fight" (dark thermal),
  "Grizzly steals wolf kill" (too distant, burned-in captions), Katmai bear clips (480×270 only).
  Tornado/lightning: NSSL VORTEX2 media page failed TLS verification from this container, and the NOAA
  library warns its videos often include third-party footage, so no weather clip was taken.
