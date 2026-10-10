"""Print the upload text (title, description with every photo credit, hashtags, pinned comment) of the "○○ 특" v2 shorts
as README markdown. usage: python3 media/teuk/upload.py [<id> ...]"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
MUSIC = {"hustle.mp3": "Hustle", "sneaky_snitch.mp3": "Sneaky Snitch", "monkeys_spinning_monkeys.mp3": "Monkeys Spinning Monkeys",
         "hyperfun.mp3": "Hyperfun", "scheming_weasel.mp3": "Scheming Weasel (faster version)", "Exhilarate.mp3": "Exhilarate"}
# id: (upload title, first line of the description, hashtags, pinned comment)
TEXT = {
 "teuk1": ("월요일 아침 특ㅋㅋ", "알람 다섯 번 끄고 일어나는 게 기본 ⏰", "#공감 #특 #월요일 #직장인", "알람 몇 번 끄고 일어나세요? ⏰"),
 "teuk2": ("시험 기간 특ㅋㅋ", "시험 전날만 되면 책상 정리가 하고 싶은 사람 손 📚", "#공감 #특 #시험기간 #학생공감", "시험 전날 제일 많이 한 딴짓은? 📚"),
 "teuk3": ("급식 특ㅋㅋ", "4교시부터 급식 메뉴만 생각하던 그 시절 🍱", "#공감 #특 #급식 #학교", "최애 급식 메뉴 하나만 적고 가기 🍱"),
 "teuk4": ("단톡방 특ㅋㅋ", "알림 꺼 놓고 몰래 다 읽는 사람 손 📱", "#공감 #특 #단톡방 #친구공감", "안 읽은 톡 몇 개 있어요? 📱"),
 "teuk5": ("자취 첫 달 특ㅋㅋ", "대파 한 단은 왜 끝까지 못 먹을까 🥬", "#공감 #특 #자취 #자취생", "자취하면서 제일 놀랐던 순간은? 🏠"),
 "teuk6": ("비 오는 날 특ㅋㅋ", "우산 챙긴 날만 비가 안 오는 사람 손 ☔", "#공감 #특 #비오는날 #장마", "집에 우산 몇 개 있어요? ☔"),
 "teuk7": ("헬스장 첫 주 특ㅋㅋ", "1년 회원권 끊고 사흘째부터 고민 시작 💪", "#공감 #특 #헬스장 #운동", "헬스장 며칠째까지 가 봤어요? 💪"),
 "teuk8": ("월급날 특ㅋㅋ", "월급은 통장을 스쳐 갈 뿐 💸", "#공감 #특 #월급날 #직장인", "월급날 제일 먼저 사는 건? 💸"),
 "teuk9": ("떡볶이 특ㅋㅋ", "1인분 시켰는데 정신 차려 보면 볶음밥까지 🍳", "#공감 #특 #떡볶이 #분식", "밀떡 vs 쌀떡, 여러분은? 🌶️"),
 "teuk10": ("컵라면 특ㅋㅋ", "물 선까지 부으라는데 그 선이 안 보임 🍜", "#공감 #특 #컵라면 #라면", "컵라면 몇 분 기다리세요? 🍜"),
 "teuk11": ("붕어빵 특ㅋㅋ", "팥이냐 슈크림이냐, 결국 둘 다 🐟", "#공감 #특 #붕어빵 #겨울간식", "팥 vs 슈크림, 머리 vs 꼬리? 🐟"),
 "teuk12": ("삼겹살 특ㅋㅋ", "고기 굽는 사람은 정작 한 점도 못 먹음 🥓", "#공감 #특 #삼겹살 #고기", "고기 굽는 담당 누구예요? 🥓"),
 "teuk13": ("길치 특ㅋㅋ", "지도 켜고 걷는데 화살표가 계속 뒤를 가리킴 🧭", "#공감 #특 #길치 #공감툰", "길 잃어버린 썰 하나씩 풀고 가기 🧭"),
 "teuk14": ("눈치 없는 사람 특ㅋㅋ", "근데 이런 친구가 제일 솔직하고 착함 😆", "#공감 #특 #눈치 #친구공감", "혹시… 나야? 몇 개 해당? 😆"),
}

def block(sid):
    t, first, tags, pin = TEXT[sid]
    e = json.load(open(f"{ROOT}/shorts/{sid}/edit.json"))
    m = MUSIC[os.path.basename(e["music"]["file"])]
    lines = [f"{first} 여러분은 몇 개 해당?ㅋㅋ (창작 애니)", "직접 그린 캐릭터의 창작 공감 영상입니다. 등장인물과 채팅방은 실제와 관계없습니다."]
    if e["sources"]:
        lines.append("Photos (Wikimedia Commons):")
        lines += [f"- {s['credit']}" for s in e["sources"].values()]
    lines.append(f'Music: "{m}" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 License, http://creativecommons.org/licenses/by/4.0/')
    return "\n".join([f"`{sid}`", f"- 제목: {t}", "- 설명:", "  ```"] + [f"  {l}" for l in lines] + ["  ```", f"- 해시태그: {tags}", f"- 고정 댓글: {pin}", ""])

if __name__ == "__main__":
    for sid in sys.argv[1:] or TEXT: print(block(sid))
