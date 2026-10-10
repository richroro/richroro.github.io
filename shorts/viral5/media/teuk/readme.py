"""Print the README section for the "○○ 특" v2 shorts: per-episode rows, scorecards (media/teuk/score.py), photo sources
and upload texts (upload/txt/<id>.txt + upload/specs/<id>.json). usage: python3 media/teuk/readme.py > /tmp/section.md"""
import json, os, re, statistics, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, ROOT)
from episodes import EPISODES
IDS = [f"teuk{i}" for i in range(1, 15)]
MUSIC = {"hustle.mp3": "Hustle", "sneaky_snitch.mp3": "Sneaky Snitch", "monkeys_spinning_monkeys.mp3": "Monkeys Spinning Monkeys",
         "hyperfun.mp3": "Hyperfun", "scheming_weasel.mp3": "Scheming Weasel (faster version)", "Exhilarate.mp3": "Exhilarate"}
# id: (노리는 공감 포인트, 결말 유형, 감정)
POINT = {
 "teuk1": ("알람 이름까지 '진짜_최종_마지막'으로 바꿔 가며 버틴 아침이 겨우 오전 10시라는 허탈함", "허탈 개그", "공감"),
 "teuk2": ("시험 전날에만 생기는 정리 욕구, 끝나고 나서야 잘되는 공부", "역전(끝나니까 공부가 됨)", "웃음"),
 "teuk3": ("4교시 메뉴 확인부터 국자 한 번 더까지, 졸업하고 나서야 그리운 급식", "따뜻한 반전", "뭉클한 공감"),
 "teuk4": ("알림 끄고 몰래 읽는 나, 정작 조용해지면 먼저 '심심해' 보내는 나", "자기 폭로 반전", "웃음"),
 "teuk5": ("냄비가 그릇, 대파 한 단, 마지막 휴지 한 칸, 결국 본가 가는 날만 기다리는 첫 달", "의외의 결말(자유 → 본가 그리움)", "공감"),
 "teuk6": ("우산의 법칙과 밀가루 없는 파전, 집에 오자마자 그치는 비", "허탈 개그", "웃음"),
 "teuk7": ("1년 회원권, 다음 날 계단, 운동 후 치킨, 결국 샤워만 하고 오는 헬스장", "허탈 개그", "웃음"),
 "teuk8": ("입금 알림 대기부터 '내가 쏜다' 후회, 이틀 만에 원래 잔고", "허탈 개그", "공감"),
 "teuk9": ("1인분 → 볶음밥, 단무지 리필, 어묵 국물 눈치, '당분간 안 먹어' 다음 날 또 추천", "자기 배신 반전", "웃음"),
 "teuk10": ("보이지 않는 물 선, 1분째 젓가락 대기, 고르는 데 20분·먹는 데 3분", "자기 배신 반전", "웃음"),
 "teuk11": ("팥 vs 슈크림 → 둘 다, 머리·꼬리 성격, 3마리 → 1마리, 지도에 몰래 별표", "의외의 결말(혼자만 아는 가게)", "웃음"),
 "teuk12": ("굽는 사람은 못 먹고, 엘리베이터에서 메뉴가 들키고, 마지막 한 점은 아무도 안 먹는 고깃집", "펀치라인(그 한 점 내가 먹을게)", "웃음"),
 "teuk13": ("뒤를 가리키는 화살표, 출구 번호, 오른쪽 하면 왼쪽부터, 근데 맛집 가는 길은 한 번에", "역전(맛집만 직진)", "웃음"),
 "teuk14": ("'이거 누가 시켰어요?', 스포, 깜짝 파티 장소 질문 → 근데 제일 착한 친구 → 혹시 나야?", "따뜻한 반전 + 자기 폭로", "웃음과 공감"),
}

def score_rows():
    out = subprocess.run([sys.executable, f"{HERE}/score.py", *IDS], capture_output=True, text=True, cwd=ROOT).stdout
    return out.strip().splitlines()

def main():
    P = json.load(open(f"{HERE}/photos.json"))
    w = print
    w('## "○○ 특" v2 (벤치마크, `teuk1`~`teuk14`)\n')
    w("`research/benchmark-drawn.md` 3절과 `research/benchmark-targets-drawn.json`의 `teuk` 목표(자체공감 「곱창 특」 98.7만, 「바나나 우유 특」 96.9만)에 맞춰 v1 8편을 다시 만들고 6편을 새로 만들었다. "
      "2026-10-10 이야기 검토(REVIEW.md 2-1절)로 대본을 한 번 더 고쳤다.\n")
    w("**바뀐 점 (v1 → v2)**\n")
    for l in ["제목은 한 줄 \"○○ 특\"(3~7자)이다. 제목을 읽는 첫 줄을 없애고, 0초부터 첫 항목과 가장 센 리액션 그림이 나온다.",
              "위쪽 검정 띠가 없다. 어두운 단색 바탕(편마다 색이 조금 다름)이고, 오른쪽 위에 마스코트 로고, 가운데 그림 칸(1080×1160), 아래에 흰 글씨 2줄 관찰체 자막이 있다. 강조색과 단어 하이라이트는 없다.",
              "첫 항목은 짧은 훅 줄(1~1.4초)과 그다음 줄로 나눴다. 첫 줄 끝(훅 끝)이 1.0~1.7초다.",
              "항목마다 그림 종류가 바뀐다. 마스코트 클로즈업(정면 꽉 차게, 왼쪽, 오른쪽, 아래에서 올라옴, 기울임, 효과선, 땀, 김, 하트, 불꽃), 사진(Wikimedia Commons, 반응 원형 인서트), 그린 장면(`Sseol.tsx`)을 섞는다.",
              "내레이터 속도를 올렸다(SunHi +32%, Hyunsu +40%, 실측 6.3~6.9음절/초). \"나\"의 반응 줄은 7줄에서 2줄로 줄였고, 말풍선 대신 따옴표 자막으로 넣었다.",
              "번호 목록(\"1. 알람 다섯 번 끄기\")을 없애고 \"~함/~음\" 관찰체 문장으로 썼다. 끝은 \"여러분은 몇 개 해당?ㅋㅋ\"와 \"나\"의 펀치라인 한 줄이다.",
              "화면에 출처 배지가 없다. 사진 크레딧은 모두 설명란(`upload/txt/<id>.txt`)에 있다."]:
        w(f"- {l}")
    w("\n### 새 템플릿 옵션 (`src/lib/Teuk.tsx`, 기존 쇼츠는 그대로)\n")
    for l in ["`edit.json` 최상위에 `\"layout\": \"teuk\"`를 두면 `ClipShort`가 영상 전체를 `TeukShort`에 넘긴다(`src/ClipShort.tsx`에 import 1줄, 타입 2줄, `return` 1줄). `\"teuk\": {\"bg\": \"#2e2321\", \"mascot\": \"#FFB36B\"}`로 바탕색과 마스코트 색을 정한다.",
              "클립의 `gfx.type`은 세 가지다. `\"face\"`는 마스코트 리액션 클로즈업이다(`mood`, `to`, `pos`: close·left·right·low·tilt, `fx`: lines·sweat·steam·gloom·sparkle·fire·hearts, `burst`, `prop`·`propX`·`propY`, `big`, `say`, `steps` = [표정 바뀌는 때, 말풍선, 큰 글씨]). `\"photo\"`는 클립의 `src` 사진을 천천히 확대해 보여 준다(`react`: 반응 원형 인서트 {mood, to, side, size}, `tag`, `big`, `zoom`, `pos`, `steps` = [인서트, 태그, 큰 글씨, 인서트 표정 바뀜]). `\"scene\"`은 기존 `Sseol.tsx` 장면이다.",
              "자막: `prep.py`가 `layout: teuk`일 때 자막 페이지마다 `\"g\"`(대사 id:자막 번호)를 붙이고, `TeukShort`가 같은 `g`의 페이지를 2줄로 함께 띄운다. `cap`의 `/`가 줄바꿈이다. qa_review는 줄마다 글자 수를 잰다. 첫 자막은 0초부터, 마지막 자막은 영상 끝까지 보인다.",
              "만드는 도구(`media/teuk/`): `episodes.py`(대본·그림), `make.py`(script.json·edit.json 생성), `fetch.py`(Commons 라이선스 확인 `resolve`, 사진 내려받기), `score.py`(벤치마크 점수표), `upload.py`(설명글 spec), `readme.py`(이 절).",
              "하위 호환 확인: 템플릿을 바꾸기 전과 후에 `sseol1`(바꾸지 않은 썰 쇼츠)의 `src/data/sseol1.json`이 바이트 단위로 같고, 프레임 0·45·200·400·700의 정지 화면 md5가 모두 같았다."]:
        w(f"- {l}")
    w("\n```bash\npython3 media/teuk/make.py teuk9 && python3 media/teuk/fetch.py teuk9 && python3 voice_edge.py teuk9 && python3 prep.py teuk9 \\\n  && ./render.sh teuk9 final/teuk9.mp4 && python3 qa_review.py teuk9 && python3 media/teuk/score.py teuk9\n```\n")
    w("### 편 목록과 노리는 공감 포인트\n")
    w("| id | 화면 제목 | 노리는 공감 포인트 | 결말 유형 | 감정 | 음악 |")
    w("| --- | --- | --- | --- | --- | --- |")
    for sid in IDS:
        ep = EPISODES[sid]; pt, end, emo = POINT[sid]
        w(f"| `{sid}` | {ep['title']} | {pt} | {end} | {emo} | {MUSIC[os.path.basename(ep['music'][0])]} |")
    w("\n### 벤치마크 점수표\n")
    w("벤치마크 값은 `benchmark-targets-drawn.json`의 `teuk`이다(길이·훅·컷·음절 속도는 보고서가 *추정*으로 표시한 값). 우리 값은 렌더(`final/<id>.mp4`, qa_review와 같은 그림 칸·장면 기준 0.12)와 목소리 타임라인(`build/<id>/timeline.json`, 한글 음절 수 ÷ 대사 길이 합, 줄 사이 쉼 제외)에서 쟀다. `python3 media/teuk/score.py <id>`로 다시 잴 수 있다.\n")
    w("| 편 | 길이 | 훅 끝 | 첫 화면 변화 | 평균 / 최장 장면 | 음절/초 | 줄 수 | 제목 |")
    w("| --- | --- | --- | --- | --- | --- | --- | --- |")
    for r in score_rows(): w(r)
    w("\n**목표와 다른 점**\n")
    for l in ["길이는 25.4~30.3초(중앙값 28.5초)로 목표(28초, 25~35초) 안이다. 가장 짧은 teuk7(25.4초)은 항목 문장이 짧은 편이다.",
              "음절 속도는 6.30~6.94음절/초로 모두 6.2 이상이다(목표 6.5, v1 중앙값 5.27).",
              "훅 끝: 첫 줄을 짧게 나눠 1.0~1.7초로 목표(1.5초)에 맞췄다.",
              "평균 장면 길이는 목표(2.2초)보다 조금 짧거나 비슷하다. 줄마다 그림을 바꾸고, 사진 클립의 반응 인서트가 뜨는 순간도 화면 변화로 잡힌다.",
              "줄 수는 13~14줄로 목표(14, 12~16)에 맞췄다. teuk9·teuk11은 항목이 길어 13줄이다.",
              "제목 길이: `눈치 없는 사람 특`은 7자로, 목표 범위(3~7자)의 끝이다. 보고서 아이디어 목록의 제목(자체공감 「눈치 없는 사람 특」 117만)을 그대로 썼다.",
              "qa_review의 '제목 띠' WARN은 의도한 것이다. 벤치마크 레시피가 \"위 제목 띠 없음\"이라서 띠를 뺐다."]:
        w(f"- {l}")
    w("\n### 이야기 검토 (REVIEW.md 2-1, 2026-10-10)로 다시 쓴 항목\n")
    w("흔한 말, 구체적이지 않은 말, 마지막이 약한 항목을 바꿨다. 마지막 항목은 꺾이거나 가장 세게 했다. 바꾼 뒤 모두 다시 녹음하고 다시 렌더했다.\n")
    for sid, items in REWRITES.items():
        w(f"- `{sid}`: " + " · ".join(f"{a} → {b}" for a, b in items))
    w("\n### 사진 출처와 라이선스\n")
    w("Pexels와 Pixabay를 먼저 시도했지만, 두 사이트 모두 이 환경에 봇 확인 화면(Cloudflare)을 돌려줘서 항목별 라이선스 페이지를 열 수 없었다. 그래서 쓰지 않았다. "
      "대신 Wikimedia Commons에서 CC0, 퍼블릭 도메인, CC BY 파일만 골랐다(BY-SA, NC, ND 제외). 라이선스는 각 파일 페이지의 메타데이터(imageinfo extmetadata)에서 2026-10-10에 확인했다(`media/teuk/fetch.py resolve`). "
      "모든 사진을 큰 크기로 보고 상표, 가게 이름, 앱 아이콘, 알아볼 수 있는 얼굴이 없는 것만 남겼다. 컵라면 제품 사진은 위에서 내려다본 컵 속만 보이는 것만 썼다. 물 끓이는 주전자 사진은 각인된 글씨 때문에, 학교 급식 사진은 군 관련 사진뿐이라서 뺐다. "
      "각 파일의 페이지 주소, 파일 주소, 라이선스, 작가, 쓴 구간은 `media/teuk/photos.json`과 각 `edit.json`의 `sources`에 있다. 화면에는 크레딧을 넣지 않고 설명란에 넣는다.\n")
    w("| 사진 키 | 파일 (Commons) | 작가 | 라이선스 | 쓴 편 (초) |")
    w("| --- | --- | --- | --- | --- |")
    used = {}
    for sid in IDS:
        d = json.load(open(f"{ROOT}/src/data/{sid}.json")) if os.path.exists(f"{ROOT}/src/data/{sid}.json") else None
        e = json.load(open(f"{ROOT}/shorts/{sid}/edit.json"))
        for c, dc in zip(e["clips"], d["clips"] if d else [None] * len(e["clips"])):
            if c.get("src"): used.setdefault(c["src"], []).append(f"{sid} {dc['at']:.1f}~{dc['at'] + dc['dur']:.1f}" if dc else sid)
    for k, ps in sorted(P.items()):
        if k not in used: continue
        w(f"| `{k}` | [{ps['title'][5:]}]({ps['page']}) | {ps['author']} | {ps['license']} | {', '.join(used[k])} |")
    w("\n### 사실 확인\n")
    w("14편 모두 관찰체 창작 대본이다. 통계, 가격, 법규 같은 사실 주장은 없다. 시간·숫자(\"10분\", \"3분\", \"천 원에 몇 마리\")는 장면 속 표현이고 사실로 내세우지 않는다. 그래서 인용할 출처가 없다. "
      "실제 브랜드, 가게, 앱, 회사 이름은 없다(\"국룰\", \"밀떡/쌀떡\"은 일반 명사). 사람 유형 편(길치, 눈치 없는 사람)은 \"나\"의 습관으로 쓰고, 끝에서 \"혹시 나야?\", \"맛집 가는 길은 한 번에\"처럼 자기 자신을 소재로 돌린다. 몸, 지역, 직업, 집단은 놀리지 않는다. 설명란 요약 앞에 \"(창작)\"이 붙는다.\n")
    w("### 업로드 문구\n")
    w("설명글은 공통 형식(`upload/README.md`)으로 `upload/specs/<id>.json` → `python3 upload/make_desc.py <id>` → `upload/txt/<id>.txt`에 있다. 채널 이름과 핸들은 아직 자리표시자다. 아래는 그 내용이다.\n")
    for sid in IDS:
        sp = json.load(open(f"{ROOT}/upload/specs/{sid}.json"))
        txt = open(f"{ROOT}/upload/txt/{sid}.txt").read().strip()
        w(f"`{sid}`\n- 제목: {sp['title']}\n- 설명:\n  ```")
        for l in txt.splitlines(): w(f"  {l}")
        w("  ```")
        w(f"- 해시태그: {' '.join('#' + t for t in ['Shorts'] + sp['tags'])}\n- 고정 댓글: {sp['pinned']}\n")

REWRITES = {
 "teuk1": [("일어나는 게 기본", "마지막 알람 이름이 '진짜_최종_마지막'"), ("회사 앞 깊은 한숨", "출입 카드 '삑' 소리가 하루 중 제일 슬픔"), ("커피 마셔야 사람 됨", "커피 전엔 메일을 읽어도 글자가 안 들어옴"), ("출근하자마자 점심 고민(마지막)", "이렇게 버텼는데 아직 오전 10시")],
 "teuk2": [("새벽 3시 배고픔", "새벽 3시에 갑자기 방 구조 바꾸고 싶음"), ("벼락치기 중 인생 고민(마지막)", "시험 끝나고 나니까 공부가 제일 잘됨")],
 "teuk3": [("디저트 날은 하루 종일 행복", "국자가 한 번 더 오면 그날은 대성공"), ("우유 원샷(마지막)", "졸업하고 나니까 그 급식이 제일 그리움")],
 "teuk4": [("나가기 버튼 100번(마지막)", "막상 조용해지면 내가 먼저 '심심해' 보냄")],
 "teuk5": [("엄마 반찬이 세상에서 제일 맛있음", "엄마 반찬통 돌려줄 때 빈 통 미안해서 과자 넣음"), ("관리비 고지서 보고 깜짝(마지막)", "자유롭다더니 한 달 뒤 본가 가는 날만 기다림")],
 "teuk6": [("양말 젖으면 하루 종일 찝찝", "젖은 운동화에서 하루 종일 '찌걱' 소리"), ("비 오면 괜히 파전 생각", "파전 해 먹자 했는데 밀가루가 없음")],
 "teuk7": [("사흘째부터 갈까 말까(마지막)", "결국 1년 회원권으로 샤워만 하고 옴")],
 "teuk8": [("고생한 나한테 선물", "'오늘은 내가 쏜다' 계산할 때 살짝 후회"), ("다음 월급날 세기(마지막)", "이틀 만에 잔고가 월급 전이랑 같아짐")],
 "teuk9": [("맵다 맵다 하면서 젓가락 안 멈춤", "맵다면서 단무지만 세 번 리필"), ("어묵은 마지막에 먹어야 제맛", "포장마차 어묵 국물 세 번째 컵부터 눈치"), ("떡파 vs 어묵파", "떡만 골라 먹는 친구랑 먹으면 어묵만 산더미"), ("튀김 국물에 퐁당", "김말이 찍는 순간 반은 국물 속으로"), ("다음 날 또 생각남(마지막)", "'당분간 안 먹어' 해 놓고 다음 날 점심에 또 추천")],
 "teuk10": [("2분 반에 뚜껑", "1분째 젓가락 들고 대기"), ("밤 11시엔 세상에서 제일 맛있음", "붓기는 내일의 나에게"), ("김치 없으면 허전", "뚜껑 접어서 앞접시로 쓰는 건 국룰"), ("하나 더 땡김", "고르는 데 20분, 먹는 데 3분"), ("다음 날 얼굴 퉁퉁(마지막)", "'다음엔 다른 맛' 다짐하고 또 같은 맛")],
 "teuk11": [("입천장 데임", "한 입에 입천장 데고 말 잃음"), ("식으면 데워 먹음", "천 원에 몇 마리인지로 물가 체감"), ("파는 곳 찾으면 보물 찾은 기분(마지막)", "파는 곳 발견하면 지도에 몰래 별표")],
 "teuk12": [("옷 냄새는 집에 가서야 앎", "엘리베이터 탄 사람들이 내 저녁 메뉴 맞힘"), ("냄새 맡으면 또 배고픔", "'불판 갈아 드릴까요?' 배부른데 '네!'"), ("쌈장으로 밥 한 공기", "마늘 안 먹는다더니 불판 위 마늘만 노림")],
 "teuk14": [("단체 사진에서 눈 감음(눈치와 무관)", "깜짝 생일 파티 장소를 주인공 앞에서 물어봄")],
}

if __name__ == "__main__":
    main()
