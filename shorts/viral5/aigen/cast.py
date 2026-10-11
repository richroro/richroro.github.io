"""The AI 썰 series' fixed look: one style line and one character sheet, pasted word for word into every scene prompt so the
same people come back in every picture (consistency method: fixed character sheet + fixed style + one seed per short).

Scene prompts write {me}, {tae}, ... where a character appears; aigen/gen.py fills them in from CAST.
Rules for every prompt: no real people or lookalikes, no brands/logos/signs (generated letters come out as gibberish, so
the words live in the post body instead), nothing violent, military or sexual, and the students are never hurt or threatened.
"""
STYLE = ("chibi anime illustration, cute super deformed characters with big round heads and small bodies, "
         "thick clean outlines, flat pastel colors, soft cel shading, korean webtoon style, detailed background")

CAST = {
    # 나: the recurring narrator of the series
    "me": "a small korean high school boy with messy dark brown hair and round black glasses, navy blazer school uniform, white shirt, red tie",
    # 강태: the scary-looking classmate everyone calls 일진
    "tae": "a tall korean high school boy with spiky black hair and sharp narrow eyes, unbuttoned navy blazer over a gray hoodie",
    # 서아: 나's desk mate
    "seoa": "a korean high school girl with long black hair in a high ponytail with a yellow scrunchie, navy blazer school uniform, plaid skirt",
    # 할머니: 나's grandmother
    "gma": "a short korean grandmother with curly white permed hair, lavender cardigan, flower-pattern pants",
    # 기사님: the morning bus driver
    "driver": "a korean bus driver in his sixties with neatly slicked-back gray hair, light blue short-sleeve uniform shirt",
    # 강태 아빠: the baker
    "baker": "a stout korean baker in his fifties with a short gray beard, white baker hat and white apron",
}

# the consistency test (python3 aigen/gen.py --test): every recurring character, alone and together, in different places
TEST = [
    ("t1_me", "only one character: {me}, sitting alone at a school desk, nervous smile, bright empty classroom with big windows"),
    ("t2_me_tae", "exactly two characters: {tae} standing next to the desk and looking down at {me}, who is sitting nervously, classroom"),
    ("t3_seoa", "only one character: {seoa}, sitting at a school desk cutting a white eraser in half with small scissors, classroom, afternoon light"),
    ("t4_me_seoa", "exactly two characters: {me} and {seoa} sitting side by side at school desks, she is smiling, he is confused, classroom"),
    ("t5_gma", "only one character: {gma}, smiling and waving, standing at a city bus stop on a sunny morning"),
    ("t6_driver", "only one character: {driver} sitting in the driver seat of a city bus, smiling and looking at the rear-view mirror, morning"),
]
