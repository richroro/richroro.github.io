#!/usr/bin/env python3
"""장면별 대본 → 자연스러운 AI 내레이션 → 장면 길이에 맞춰 영상에 합성.

    python3 narrate.py script.txt --video in.mp4 --out out/
    python3 narrate.py script.txt --video in.mp4 --check      # 음성 생성 없이 길이만 점검

만드는 것 (out/):
    narrated.mp4        내레이션을 입힌 영상 (--video 를 줬을 때)
    narration.wav       타임라인 전체 길이의 내레이션 트랙 (캡컷 등에 그대로 올릴 수 있음)
    subtitles.srt       문장 단위 자막
    clips/scene_NN.*    장면별 음성 (mp3, supertonic 은 wav)
    report.json         장면별 배치·속도·넘침 기록

엔진: edge(무료, 기본) · google · openai · elevenlabs (API 키는 환경변수) · supertonic(오프라인).
"""
from __future__ import annotations

import argparse
import array
import asyncio
import base64
import json
import os
import re
import shutil
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

SR = 48000  # 내부 작업 샘플레이트 (mono s16)

# ───────────────────────────── 대본 읽기 ─────────────────────────────

_T = r"(?:\d{1,2}(?::\d{1,2}){1,2}(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?:초|s|sec)?"
RANGE_RE = re.compile(rf"^\s*[\[\(]?\s*({_T})\s*[-~–—]\s*({_T})\s*[\]\)]?\s*[:：|]?\s*(.*)$", re.I)
DUR_RE = re.compile(r"^\s*[\[\(]\s*(\d+(?:\.\d+)?)\s*(?:초|s|sec)\s*[\]\)]\s*[:：|]?\s*(.*)$", re.I)
SCENE_RE = re.compile(
    r"^\s*(?:#+\s*)?(?:\*\*)?\s*(?:장면|씬|신|scene|컷|cut)\s*#?\s*\d+\s*(?:\*\*)?\s*"
    r"(?:[\(\[]\s*([^\)\]]*)\s*[\)\]])?\s*(?:\*\*)?\s*[:：.\-–]?\s*(.*)$",
    re.I,
)
SPEAK_PREFIX = re.compile(r"^\s*(?:[-*•]\s*)?(?:\*\*)?(내레이션|나레이션|narration|na|n|vo|v\.o\.|음성|대사)(?:\*\*)?\s*[:：]\s*", re.I)
DROP_PREFIX = re.compile(
    r"^\s*(?:[-*•]\s*)?(?:\*\*)?(화면|영상|자막|컷|장면\s*설명|b-?roll|bgm|배경음|효과음|sfx|음악|이미지|텍스트|연출|전환)(?:\*\*)?\s*[:：]", re.I
)


def parse_time(s: str) -> float:
    s = re.sub(r"\s*(초|s|sec)$", "", s.strip(), flags=re.I)
    if ":" in s:
        sec = 0.0
        for part in s.split(":"):
            sec = sec * 60 + float(part)
        return sec
    return float(s)


@dataclass
class Scene:
    idx: int
    text: str
    start: float | None = None
    end: float | None = None
    dur: float | None = None
    # 채워지는 값
    spoken: str = ""
    clip: str = ""
    speech: float = 0.0
    speed: float = 1.0
    at: float = 0.0
    overflow: float = 0.0
    sentences: list = field(default_factory=list)  # [(start, end, text)] 클립 기준 초


def _clean_block(lines: list[str]) -> str:
    """무대 지시는 빼고 읽을 문장만 남긴다."""
    lines = [l for l in (x.strip() for x in lines) if l]
    if any(SPEAK_PREFIX.match(l) for l in lines):
        lines = [SPEAK_PREFIX.sub("", l) for l in lines if SPEAK_PREFIX.match(l)]
    out = []
    for l in lines:
        if DROP_PREFIX.match(l):
            continue
        if re.fullmatch(r"[\(\[【].*[\)\]】]", l):  # (화면 전환) 같은 한 줄 지시
            continue
        out.append(l)
    return "\n".join(out)


def parse_script(path: str) -> list[Scene]:
    with open(path, encoding="utf-8-sig") as f:
        raw = f.read()
    data = None
    if path.lower().endswith(".json") or raw.lstrip().startswith(("{", "[")):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            if path.lower().endswith(".json"):
                raise  # "[0:00-0:05] ..." 로 시작하는 텍스트 대본은 아래에서 처리
    if data is not None:
        items = data.get("scenes", data) if isinstance(data, dict) else data
        scenes = []
        for i, it in enumerate(items, 1):
            if isinstance(it, str):
                it = {"text": it}
            g = lambda *ks: next((it[k] for k in ks if it.get(k) not in (None, "")), None)
            st, en, du = g("start"), g("end"), g("duration", "dur")
            scenes.append(Scene(
                i, _clean_block(str(g("text", "narration", "script") or "").splitlines()),
                parse_time(str(st)) if st is not None else None,
                parse_time(str(en)) if en is not None else None,
                parse_time(str(du)) if du is not None else None,
            ))
        return [s for s in scenes if s.text.strip()]

    blocks: list[dict] = []
    cur: dict | None = None

    def new(start=None, end=None, dur=None, first=""):
        nonlocal cur
        cur = {"start": start, "end": end, "dur": dur, "lines": [first] if first else []}
        blocks.append(cur)

    for line in raw.splitlines():
        m = RANGE_RE.match(line)
        if m and (":" in m.group(1) or ":" in m.group(2) or re.search(r"초|s", m.group(1) + m.group(2), re.I) or line.lstrip()[:1] in "[("):
            new(parse_time(m.group(1)), parse_time(m.group(2)), None, m.group(3))
            continue
        m = DUR_RE.match(line)
        if m:
            new(None, None, float(m.group(1)), m.group(2))
            continue
        m = SCENE_RE.match(line)
        if m:
            inner, rest = (m.group(1) or "").strip(), m.group(2)
            r = RANGE_RE.match(inner) if inner else None
            d = re.match(r"^(\d+(?:\.\d+)?)\s*(초|s|sec)?$", inner, re.I) if inner else None
            if r:
                new(parse_time(r.group(1)), parse_time(r.group(2)), None, rest)
            elif d:
                new(None, None, float(d.group(1)), rest)
            else:
                new(None, None, None, rest)
            continue
        if not line.strip():
            # 시간 표기가 전혀 없는 대본은 빈 줄을 장면 구분으로 쓴다
            if cur is not None and cur["lines"] and not any(b["start"] is not None or b["dur"] is not None for b in blocks):
                cur = None
            continue
        if cur is None:
            new()
        cur["lines"].append(line)

    scenes = []
    for b in blocks:
        text = _clean_block(b["lines"])
        if text.strip():
            scenes.append(Scene(len(scenes) + 1, text, b["start"], b["end"], b["dur"]))
    return scenes


def assign_times(scenes: list[Scene], video_dur: float | None) -> None:
    """start/end 가 빈 장면을 채운다. 시간이 하나도 없으면 영상 길이를 글자 수 비율로 나눈다."""
    if all(s.start is None and s.dur is None for s in scenes):
        if not video_dur:
            return  # 제약 없음 → 자연 길이대로 이어 붙인다
        weights = [max(estimate_seconds(s.text), 0.5) for s in scenes]
        tot = sum(weights)
        t = 0.0
        for s, w in zip(scenes, weights):
            s.start, s.end = t, t + video_dur * w / tot
            t = s.end
        return
    t = 0.0
    for i, s in enumerate(scenes):
        if s.start is None:
            s.start = t
        if s.end is None:
            if s.dur is not None:
                s.end = s.start + s.dur
            else:
                nxt = next((n.start for n in scenes[i + 1:] if n.start is not None), None)
                s.end = nxt if nxt is not None else (video_dur or s.start + estimate_seconds(s.text) + 0.6)
        t = s.end


# ─────────────────────────── 읽기 좋게 다듬기 ───────────────────────────

_EMOJI = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍]")


def normalize_for_speech(text: str) -> str:
    t = text
    t = re.sub(r"https?://\S+", "", t)
    t = _EMOJI.sub("", t)
    t = re.sub(r"[*_#>`]+", "", t)
    t = re.sub(r"\[[^\]]*\]|【[^】]*】", "", t)            # [BGM] 같은 지시
    t = re.sub(r"\((?:화면|자막|bgm|효과음|sfx|컷)[^)]*\)", "", t, flags=re.I)
    t = re.sub(r"(\d)\s*[~〜]\s*(\d)", r"\1에서 \2", t)    # 3~5개 → 3에서 5개
    t = re.sub(r"\bvs\.?\b", "대", t, flags=re.I)
    t = t.replace("&", " 앤 ").replace("→", ", ").replace("·", ", ")
    lines = [l.strip() for l in t.splitlines() if l.strip()]
    fixed = []
    for l in lines:
        # 줄 끝이 문장 종결인데 마침표가 없으면 붙여서 쉼을 만든다
        if re.search(r"[가-힣]$", l) and re.search(r"(다|요|죠|까|네|세요|니다|어요|아요|해요|습니다|군요|거든요)$", l):
            l += "."
        fixed.append(l)
    t = " ".join(fixed)
    t = re.sub(r"\s+", " ", t).strip()
    t = re.sub(r"\s+([,.!?])", r"\1", t)
    return t


def estimate_seconds(text: str, speed: float = 1.0) -> float:
    """보통 속도 한국어 내레이션 길이 추정 (음절 ≈ 초당 6.8개)."""
    t = normalize_for_speech(text)
    hangul = len(re.findall(r"[가-힣]", t))
    digits = len(re.findall(r"\d", t)) * 1.6  # 숫자는 읽으면 길어진다
    latin = len(re.findall(r"[A-Za-z]", t)) * 0.45
    pauses = len(re.findall(r"[.!?]", t)) * 0.35 + len(re.findall(r"[,]", t)) * 0.18
    return ((hangul + digits + latin) / 6.8 + pauses) / speed


def split_sentences(text: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"(?<=[.!?…])\s+", text) if p.strip()]
    out = []
    for p in parts:  # 자막 한 줄이 너무 길면 쉼표에서 한 번 더 자른다
        if len(p) > 30 and "," in p:
            chunks, buf = [], ""
            for c in re.split(r"(?<=,)\s*", p):
                if buf and len(buf) + len(c) > 30:
                    chunks.append(buf.strip())
                    buf = ""
                buf += c + " "
            if buf.strip():
                chunks.append(buf.strip())
            out.extend(chunks)
        else:
            out.append(p)
    return out


# ─────────────────────────────── ffmpeg ───────────────────────────────

def ffmpeg_bin() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("ffmpeg 가 없습니다: pip install imageio-ffmpeg  (또는 시스템 ffmpeg 설치)")


def run_ff(args: list[str]) -> None:
    p = subprocess.run([ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError("ffmpeg 실패:\n" + p.stderr[-2000:])


def probe(path: str) -> tuple[float, bool]:
    """(길이 초, 오디오 트랙 유무)"""
    p = subprocess.run([ffmpeg_bin(), "-hide_banner", "-i", path], capture_output=True, text=True)
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", p.stderr)
    if not m:
        raise RuntimeError(f"길이를 읽을 수 없음: {path}\n{p.stderr[-800:]}")
    dur = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    return dur, bool(re.search(r"Stream #\S+.*Audio:", p.stderr))


def decode_pcm(path: str, tempo: float = 1.0) -> array.array:
    af = []
    t = tempo
    while t > 2.0:
        af.append("atempo=2.0"); t /= 2.0
    while t < 0.5:
        af.append("atempo=0.5"); t /= 0.5
    if abs(t - 1.0) > 1e-3:
        af.append(f"atempo={t:.4f}")
    cmd = [ffmpeg_bin(), "-hide_banner", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR)]
    if af:
        cmd += ["-af", ",".join(af)]
    cmd += ["-f", "s16le", "-"]
    p = subprocess.run(cmd, capture_output=True)
    if p.returncode:
        raise RuntimeError("디코딩 실패: " + p.stderr.decode(errors="replace")[-800:])
    a = array.array("h")
    a.frombytes(p.stdout[: len(p.stdout) // 2 * 2])
    if sys.byteorder == "big":
        a.byteswap()
    return a


def trim_silence(a: array.array, thresh: int = 300, keep: float = 0.03) -> tuple[array.array, float]:
    """앞뒤 무음을 잘라내고 (잘린 배열, 앞에서 잘라낸 초) 를 돌려준다."""
    n = len(a)
    i = 0
    while i < n and abs(a[i]) < thresh:
        i += 1
    j = n - 1
    while j > i and abs(a[j]) < thresh:
        j -= 1
    pad = int(keep * SR)
    i, j = max(0, i - pad), min(n, j + 1 + pad)
    return a[i:j], i / SR


def write_wav(path: str, a: array.array) -> None:
    import wave
    b = array.array("h", a)
    if sys.byteorder == "big":
        b.byteswap()
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b.tobytes())


# ─────────────────────────────── 음성 엔진 ───────────────────────────────

class EngineUnavailable(Exception):
    """접속 불가·키 없음 — auto 모드면 다음 엔진으로 넘어간다."""


def _http(url: str, body: dict, headers: dict, timeout: int = 90) -> bytes:
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type": "application/json", **headers})
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")[:600]
            if e.code in (401, 403):
                raise EngineUnavailable(f"{e.code} 인증/접근 거부: {msg}")
            if e.code == 400:
                raise ValueError(msg)
            last = f"{e.code}: {msg}"
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            last = str(e)
        time.sleep(2 ** attempt)
    raise EngineUnavailable(f"{url.split('/')[2]} 접속 실패: {last}")


class Engine:
    name = ""
    default_voice = ""
    ext = "mp3"  # synth 가 쓰는 파일 형식

    def __init__(self, voice: str | None, style: str | None):
        self.voice = voice or self.default_voice
        self.style = style

    def synth(self, text: str, rate: float, out: str) -> tuple[list | None, float]:
        """out 에 mp3 를 쓰고 (문장 경계 [(start, end, text)] 또는 None, 엔진이 직접 반영한 속도) 를 돌려준다.
        반영하지 못한 나머지 속도는 ffmpeg atempo 로 맞춘다."""
        raise NotImplementedError


class EdgeEngine(Engine):
    """Microsoft Edge 온라인 신경망 음성. 무료·키 없음. speech.platform.bing.com 접속 필요."""
    name = "edge"
    default_voice = "ko-KR-SunHiNeural"

    def __init__(self, voice, style):
        super().__init__(voice, style)
        try:
            import edge_tts  # noqa: F401
            import edge_tts.communicate as ec
        except ImportError:
            raise EngineUnavailable("edge-tts 미설치: pip install edge-tts")
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
        if os.environ.get("SSL_CERT_FILE") and os.path.exists(os.environ["SSL_CERT_FILE"]):
            ctx.load_verify_locations(os.environ["SSL_CERT_FILE"])  # 사내·샌드박스 프록시 인증서
        ec._SSL_CTX = ctx

    def synth(self, text, rate, out):
        import edge_tts
        pct = int(round((rate - 1.0) * 100))
        sents, audio = [], bytearray()

        async def go():
            # stream() 은 한 번만 부를 수 있어서 재시도마다 새로 만든다
            comm = edge_tts.Communicate(text, self.voice, rate=f"{pct:+d}%", boundary="SentenceBoundary")
            async for ch in comm.stream():
                if ch["type"] == "audio":
                    audio.extend(ch["data"])
                elif ch["type"] == "SentenceBoundary":
                    s = ch["offset"] / 1e7
                    sents.append((s, s + ch["duration"] / 1e7, ch["text"]))

        last = None
        for attempt in range(3):
            try:
                audio.clear(); sents.clear()
                asyncio.run(go())
                last = None
                break
            except Exception as e:  # aiohttp 오류 종류가 많아서 넓게 잡는다
                last = e
                if "403" in str(e):  # 네트워크 정책 차단 — 재시도해도 소용없다
                    break
                time.sleep(2 ** attempt)
        if last is not None:
            raise EngineUnavailable(f"edge 음성 서버 접속 실패 ({type(last).__name__}: {str(last)[:200]})")
        if not audio:
            raise EngineUnavailable("edge 가 오디오를 돌려주지 않음")
        with open(out, "wb") as f:
            f.write(audio)
        return sents or None, rate


class GoogleEngine(Engine):
    """Google Cloud Text-to-Speech. GOOGLE_TTS_API_KEY 필요."""
    name = "google"
    default_voice = "ko-KR-Chirp3-HD-Aoede"

    def __init__(self, voice, style):
        super().__init__(voice, style)
        self.key = os.environ.get("GOOGLE_TTS_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not self.key:
            raise EngineUnavailable("GOOGLE_TTS_API_KEY 없음")
        self.rate_ok = True

    def synth(self, text, rate, out):
        lang = "-".join(self.voice.split("-")[:2])
        body = {"input": {"text": text}, "voice": {"languageCode": lang, "name": self.voice},
                "audioConfig": {"audioEncoding": "MP3", "sampleRateHertz": 48000}}
        if self.rate_ok:
            body["audioConfig"]["speakingRate"] = round(min(max(rate, 0.25), 4.0), 3)
        try:
            r = _http(f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.key}", body, {})
        except ValueError:
            if not self.rate_ok:
                raise
            self.rate_ok = False  # 속도 미지원 음성 → atempo 로
            body["audioConfig"].pop("speakingRate")
            r = _http(f"https://texttospeech.googleapis.com/v1/text:synthesize?key={self.key}", body, {})
        with open(out, "wb") as f:
            f.write(base64.b64decode(json.loads(r)["audioContent"]))
        return None, (body["audioConfig"].get("speakingRate", 1.0))


class OpenAIEngine(Engine):
    """OpenAI gpt-4o-mini-tts. OPENAI_API_KEY 필요. 말투를 지시문으로 조절."""
    name = "openai"
    default_voice = "nova"

    def __init__(self, voice, style):
        super().__init__(voice, style)
        self.key = os.environ.get("OPENAI_API_KEY")
        if not self.key:
            raise EngineUnavailable("OPENAI_API_KEY 없음")

    def synth(self, text, rate, out):
        body = {"model": os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"), "voice": self.voice, "input": text,
                "response_format": "mp3",
                "instructions": self.style or "한국어 영상 내레이션. 또렷하고 따뜻한 톤, 자연스러운 억양과 문장 사이 짧은 쉼. 과장하지 말 것."}
        audio = _http("https://api.openai.com/v1/audio/speech", body, {"Authorization": f"Bearer {self.key}"})
        with open(out, "wb") as f:
            f.write(audio)
        return None, 1.0


class ElevenLabsEngine(Engine):
    """ElevenLabs eleven_multilingual_v2. ELEVENLABS_API_KEY 필요, --voice 에 voice_id."""
    name = "elevenlabs"
    default_voice = "21m00Tcm4TlvDq8ikWAM"

    def __init__(self, voice, style):
        super().__init__(voice, style)
        self.key = os.environ.get("ELEVENLABS_API_KEY")
        if not self.key:
            raise EngineUnavailable("ELEVENLABS_API_KEY 없음")

    def synth(self, text, rate, out):
        # ElevenLabs 속도는 0.7~1.2 만 받는다. 넘치는 부분은 atempo 로 보충
        applied = round(min(max(rate, 0.7), 1.2), 3)
        body = {"text": text, "model_id": os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.15,
                                   "speed": applied}}
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice}?output_format=mp3_44100_128"
        audio = _http(url, body, {"xi-api-key": self.key})
        with open(out, "wb") as f:
            f.write(audio)
        return None, applied


class SupertonicEngine(Engine):
    """Supertone Supertonic 3 (sherpa-onnx). 오프라인 CPU 신경망 음성 — 네트워크·키 없이 동작.
    처음 한 번 GitHub 릴리스에서 모델(약 130MB)을 받아 ~/.cache/video-narration 에 둔다."""
    name = "supertonic"
    default_voice = "3"
    ext = "wav"
    MODEL = "sherpa-onnx-supertonic-3-tts-int8-2026-05-11"
    URL = f"https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/{MODEL}.tar.bz2"

    def __init__(self, voice, style):
        super().__init__(voice, style)
        try:
            import sherpa_onnx  # noqa: F401
        except ImportError:
            raise EngineUnavailable("sherpa-onnx 미설치: pip install sherpa-onnx")
        if not str(self.voice).isdigit() or not 0 <= int(self.voice) <= 9:
            raise EngineUnavailable(f"supertonic 음성은 0~9 번호입니다 (받은 값: {self.voice})")
        self.tts = None

    def _model_dir(self) -> str:
        root = os.environ.get("NARRATION_MODEL_DIR") or os.path.expanduser("~/.cache/video-narration")
        d = os.path.join(root, self.MODEL)
        if os.path.exists(os.path.join(d, "voice.bin")):
            return d
        import tarfile
        os.makedirs(root, exist_ok=True)
        tmp = d + ".tar.bz2.part"
        print(f"  supertonic 모델 내려받는 중 (약 130MB, 처음 한 번만)…", file=sys.stderr)
        ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or None)
        try:
            with urllib.request.urlopen(self.URL, timeout=600, context=ctx) as r, open(tmp, "wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            raise EngineUnavailable(f"모델 다운로드 실패 (github.com): {e}")
        with tarfile.open(tmp, "r:bz2") as t:
            t.extractall(root, filter="data")
        os.remove(tmp)
        return d

    def synth(self, text, rate, out):
        import wave
        import sherpa_onnx
        if self.tts is None:
            m = self._model_dir() + "/"
            cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
                supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
                    duration_predictor=m + "duration_predictor.int8.onnx", text_encoder=m + "text_encoder.int8.onnx",
                    vector_estimator=m + "vector_estimator.int8.onnx", vocoder=m + "vocoder.int8.onnx",
                    tts_json=m + "tts.json", unicode_indexer=m + "unicode_indexer.bin", voice_style=m + "voice.bin"),
                num_threads=min(4, os.cpu_count() or 1), provider="cpu"))
            self.tts = sherpa_onnx.OfflineTts(cfg)
        g = sherpa_onnx.GenerationConfig()
        g.sid = int(self.voice)
        g.num_steps = int(os.environ.get("SUPERTONIC_STEPS", "10"))  # 클수록 깨끗, 느림
        g.speed = rate
        g.extra["lang"] = os.environ.get("SUPERTONIC_LANG", "ko")
        a = self.tts.generate(text, g)
        if not len(a.samples):
            raise RuntimeError("supertonic 이 오디오를 만들지 못함")
        pcm = array.array("h", (max(-32768, min(32767, int(v * 32767))) for v in a.samples))
        if sys.byteorder == "big":
            pcm.byteswap()
        with wave.open(out, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(a.sample_rate)
            w.writeframes(pcm.tobytes())
        return None, rate


ENGINES = {"edge": EdgeEngine, "google": GoogleEngine, "openai": OpenAIEngine, "elevenlabs": ElevenLabsEngine,
           "supertonic": SupertonicEngine}

VOICES = """추천 한국어 음성
  edge (무료)
    ko-KR-SunHiNeural              여성 · 밝고 또렷함 (기본)
    ko-KR-InJoonNeural             남성 · 차분한 뉴스/정보 톤
    ko-KR-HyunsuMultilingualNeural 남성 · 대화체에 가까운 자연스러운 톤
  google (GOOGLE_TTS_API_KEY)
    ko-KR-Chirp3-HD-Aoede / -Kore / -Leda   여성 · 가장 사람 같은 HD 음성
    ko-KR-Chirp3-HD-Charon / -Puck / -Fenrir 남성
    ko-KR-Neural2-A (여) / ko-KR-Neural2-C (남)
  openai (OPENAI_API_KEY)
    nova · shimmer · coral (여) / onyx · ash · echo (남)   --style 로 말투 지시
  elevenlabs (ELEVENLABS_API_KEY)
    --voice 에 음성 라이브러리의 voice_id
  supertonic (오프라인, 키·네트워크 불필요 — 모델만 처음 한 번 GitHub 에서 받음)
    3  여성 · 또렷하고 경쾌함 (기본)      2  여성 · 차분하고 느긋함
    0  여성 · 부드러움                    1  여성 · 높고 밝음
    6  남성 · 낮고 묵직함                 8  남성 · 중저음, 또박또박
    9  남성 · 낮고 차분함                 7  남성 · 빠른 편
    4, 5  낮은 여성/중성적
"""


# ─────────────────────────────── 핵심 흐름 ───────────────────────────────

def voice_owner(voice: str | None) -> str | None:
    """auto 모드에서 --voice 가 어느 엔진의 음성인지 추측한다."""
    if not voice:
        return None
    if voice.isdigit():
        return "supertonic"
    if "Chirp" in voice or "Neural2" in voice or "Wavenet" in voice or "Standard" in voice:
        return "google"
    if re.fullmatch(r"[a-z]{2}-[A-Z]{2}-\w+Neural", voice):
        return "edge"
    if re.fullmatch(r"[A-Za-z0-9]{20}", voice):
        return "elevenlabs"
    return "openai"


def make_engine(name: str, voice, style) -> list[Engine]:
    order = ["edge", "google", "elevenlabs", "openai", "supertonic"] if name == "auto" else [name]
    owner = voice_owner(voice) if name == "auto" else name
    if owner and name == "auto":
        order.remove(owner)
        order.insert(0, owner)  # 고른 음성의 엔진을 먼저 쓴다
    engines, errors = [], []
    for n in order:
        try:
            engines.append(ENGINES[n](voice if n == owner else None, style))
        except EngineUnavailable as e:
            errors.append(f"{n}: {e}")
    if not engines:
        sys.exit("사용할 수 있는 음성 엔진이 없습니다.\n  " + "\n  ".join(errors))
    return engines


def synth_scene(engines: list[Engine], s: Scene, rate: float, base: str) -> tuple[array.array, list | None, Engine]:
    while engines:
        eng = engines[0]
        try:
            path = f"{base}.{eng.ext}"
            sents, applied = eng.synth(s.spoken, rate, path)
            rest = rate / applied
            pcm = decode_pcm(path, rest)
            if sents and abs(rest - 1.0) > 1e-3:
                sents = [(a / rest, b / rest, t) for a, b, t in sents]
            return pcm, sents, eng
        except EngineUnavailable as e:
            print(f"  ! {eng.name} 사용 불가 → {e}", file=sys.stderr)
            engines.pop(0)
            if engines:
                print(f"  → {engines[0].name} 엔진으로 전환", file=sys.stderr)
    sys.exit("모든 음성 엔진이 실패했습니다. (네트워크 허용 목록 또는 API 키를 확인하세요)")


def fit_scene(engines, s: Scene, clips_dir: str, base_rate: float, max_speed: float, window: float | None):
    """자연 속도로 한 번 만들고, 창보다 길면 max_speed 까지 빠르게 다시 만든다."""
    path = os.path.join(clips_dir, f"scene_{s.idx:02d}")  # 확장자는 엔진이 정한다
    rate = base_rate
    for _ in range(3):
        pcm, sents, eng = synth_scene(engines, s, rate, path)
        pcm, lead_cut = trim_silence(pcm)
        dur = len(pcm) / SR
        if window is None or dur <= window + 0.02 or rate >= max_speed - 1e-3:
            break
        rate = min(max_speed, rate * dur / window * 1.02)
    s.speech, s.speed = dur, rate
    if sents:
        s.sentences = [(max(0.0, a - lead_cut), min(dur, b - lead_cut), t) for a, b, t in sents]
    else:
        parts = split_sentences(s.spoken)
        w = [max(len(re.sub(r"\s", "", p)), 1) for p in parts]
        tot, t = sum(w), 0.0
        s.sentences = []
        for p, k in zip(parts, w):
            s.sentences.append((t, t + dur * k / tot, p))
            t += dur * k / tot
    return pcm, eng


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(path: str, scenes: list[Scene]) -> None:
    n, out = 0, []
    for s in scenes:
        sents = s.sentences
        for k, (a, b, t) in enumerate(sents):
            # 다음 문장 직전까지 자막을 유지해 깜빡임을 줄인다
            end = s.at + (sents[k + 1][0] if k + 1 < len(sents) else b + 0.25)
            n += 1
            out.append(f"{n}\n{srt_time(s.at + a)} --> {srt_time(max(end, s.at + a + 0.4))}\n{t.strip()}\n")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(out))


def mix_video(video: str, narr_wav: str, out: str, total: float, vdur: float, has_audio: bool, a) -> None:
    inputs = ["-i", video, "-i", narr_wav]
    if a.music:
        inputs += ["-stream_loop", "-1", "-i", a.music]
    f, beds = [], []
    if has_audio and a.orig_volume > 0:
        f.append(f"[0:a]aresample={SR},aformat=channel_layouts=stereo,volume={a.orig_volume}[orig]")
        beds.append("[orig]")
    if a.music:
        fade_st = max(total - 2.0, 0)
        f.append(f"[2:a]aresample={SR},aformat=channel_layouts=stereo,volume={a.music_volume},"
                 f"afade=t=in:d=1,afade=t=out:st={fade_st:.2f}:d=2[mus]")
        beds.append("[mus]")
    f.append(f"[1:a]aresample={SR},aformat=channel_layouts=stereo,apad[nar]")
    if beds:
        if len(beds) == 2:
            f.append("[orig][mus]amix=inputs=2:duration=longest:normalize=0[bed]")
        else:
            f.append(f"{beds[0]}anull[bed]")
        if a.duck:
            f.append("[nar]asplit=2[nar][sc]")
            f.append("[bed][sc]sidechaincompress=threshold=0.015:ratio=8:attack=20:release=450:makeup=1[bedd]")
            f.append("[bedd][nar]amix=inputs=2:duration=longest:normalize=0[mix]")
        else:
            f.append("[bed][nar]amix=inputs=2:duration=longest:normalize=0[mix]")
    else:
        f.append("[nar]anull[mix]")
    f.append(f"[mix]loudnorm=I={a.lufs}:TP=-1.5:LRA=11,aresample={SR},atrim=0:{total:.3f}[aout]")

    vmap, vcodec = "0:v:0", ["-c:v", "copy"]
    if total > vdur + 0.05:
        # 내레이션이 영상보다 길면 마지막 프레임을 늘려서 끝까지 들려준다
        f.append(f"[0:v]tpad=stop_mode=clone:stop_duration={total - vdur + 0.1:.3f}[vout]")
        vmap, vcodec = "[vout]", ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p"]
    run_ff([*inputs, "-filter_complex", ";".join(f), "-map", vmap, "-map", "[aout]", *vcodec,
            "-c:a", "aac", "-b:a", "192k", "-t", f"{total:.3f}", "-movflags", "+faststart", out])


def check_report(scenes: list[Scene], a) -> int:
    """음성 생성 없이 대본 길이만 점검. 넘치는 장면 수를 돌려준다."""
    bad = 0
    print(f"{'장면':>4} {'구간':>15} {'창':>6} {'예상':>6}  판정")
    for s in scenes:
        est = estimate_seconds(s.text, a.rate)
        if s.start is None:
            print(f"{s.idx:>4} {'(제약 없음)':>15} {'-':>6} {est:5.1f}s  자연 속도로 이어 붙임")
            continue
        win = max(s.end - s.start - a.lead - a.tail, 0.3)
        need = est / win
        if need <= 1.0:
            verdict = "여유" if need < 0.75 else "딱 맞음"
        elif need <= a.max_speed:
            verdict = f"조금 빠르게 ×{need:.2f}"
        else:
            bad += 1
            over_chars = int((est - win * a.max_speed) * 6.8) + 1
            verdict = f"넘침 → 약 {over_chars}자 줄이거나 장면을 {est / a.max_speed - win:.1f}초 늘리세요"
        rng = f"{s.start:5.1f}-{s.end:5.1f}s"
        print(f"{s.idx:>4} {rng:>15} {win:5.1f}s {est:5.1f}s  {verdict}")
    return bad


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description="대본 → 자연스러운 AI 내레이션 → 장면 길이에 맞춰 영상에 합성")
    p.add_argument("script", nargs="?", help="대본 파일 (.txt/.md/.json)")
    p.add_argument("--video", help="내레이션을 입힐 영상")
    p.add_argument("--out", default="narration_out", help="출력 폴더")
    p.add_argument("--engine", default="auto", choices=["auto", *ENGINES])
    p.add_argument("--voice", help="음성 이름 (--list-voices 참고)")
    p.add_argument("--style", help="openai 전용 말투 지시문")
    p.add_argument("--rate", type=float, default=1.0, help="기본 말 속도 배수 (1.0 = 보통)")
    p.add_argument("--max-speed", type=float, default=1.2, help="장면에 맞추려고 올릴 수 있는 최대 속도 (자연스러움 한계 ≈1.2)")
    p.add_argument("--lead", type=float, default=0.2, help="장면 시작 후 말을 꺼내기까지 쉼(초)")
    p.add_argument("--tail", type=float, default=0.3, help="장면 끝나기 전 남겨둘 쉼(초)")
    p.add_argument("--gap", type=float, default=0.25, help="앞 장면 음성이 넘쳤을 때 최소 간격(초)")
    p.add_argument("--music", help="배경음악 파일 (반복·페이드·덕킹)")
    p.add_argument("--music-volume", type=float, default=0.18)
    p.add_argument("--orig-volume", type=float, default=1.0, help="원본 영상 소리 크기 (0 = 제거)")
    p.add_argument("--no-duck", dest="duck", action="store_false", help="말할 때 배경 소리 줄이기 끄기")
    p.add_argument("--no-extend", dest="extend", action="store_false", help="내레이션이 길어도 영상을 늘리지 않음")
    p.add_argument("--lufs", type=float, default=-14.0, help="최종 음량 (쇼츠·유튜브 -14)")
    p.add_argument("--check", action="store_true", help="음성 생성 없이 길이만 점검")
    p.add_argument("--list-voices", action="store_true")
    a = p.parse_args(argv)

    if a.list_voices:
        print(VOICES)
        return 0
    if not a.script:
        p.error("대본 파일이 필요합니다")

    scenes = parse_script(a.script)
    if not scenes:
        sys.exit("대본에서 읽을 문장을 찾지 못했습니다")
    vdur, has_audio = probe(a.video) if a.video else (None, False)
    assign_times(scenes, vdur)
    for s in scenes:
        s.spoken = normalize_for_speech(s.text)

    if a.check:
        bad = check_report(scenes, a)
        print(f"\n장면 {len(scenes)}개" + (f", 영상 {vdur:.1f}초" if vdur else "") +
              (f" — {bad}개 장면이 최대 속도 ×{a.max_speed}로도 넘칩니다" if bad else " — 모두 들어갑니다"))
        return 1 if bad else 0

    os.makedirs(os.path.join(a.out, "clips"), exist_ok=True)
    engines = make_engine(a.engine, a.voice, a.style)
    print(f"엔진: {engines[0].name} / 음성: {engines[0].voice} / 장면 {len(scenes)}개")

    placed: list[tuple[float, array.array]] = []
    prev_end = 0.0
    for s in scenes:
        win = None if s.start is None else max(s.end - s.start - a.lead - a.tail, 0.3)
        pcm, eng = fit_scene(engines, s, os.path.join(a.out, "clips"), a.rate, a.max_speed, win)
        want = (s.start + a.lead) if s.start is not None else (prev_end + (a.gap if placed else a.lead))
        s.at = max(want, prev_end + a.gap) if placed else want
        prev_end = s.at + s.speech
        if s.end is not None:
            s.overflow = max(0.0, prev_end - (s.end - a.tail * 0.5))
        placed.append((s.at, pcm))
        flag = f"  ⚠ {s.overflow:.1f}s 넘침" if s.overflow > 0.05 else ""
        shift = f"  (+{s.at - want:.1f}s 밀림)" if s.at - want > 0.05 else ""
        print(f"  장면 {s.idx:>2}: {s.at:6.2f}s 부터 {s.speech:4.1f}s · 속도 ×{s.speed:.2f} [{eng.name}]{shift}{flag}")

    total_narr = prev_end + a.tail
    total = total_narr
    if vdur:
        total = max(vdur, total_narr) if a.extend else vdur
    buf = array.array("h", bytes(int(total * SR + 1) * 2))
    for at, pcm in placed:
        i = int(at * SR)
        seg = pcm[: max(0, len(buf) - i)]
        buf[i:i + len(seg)] = seg
    narr_wav = os.path.join(a.out, "narration.wav")
    write_wav(narr_wav, buf)
    write_srt(os.path.join(a.out, "subtitles.srt"), scenes)

    out_video = None
    if a.video:
        out_video = os.path.join(a.out, "narrated.mp4")
        print("영상 합성 중…")
        mix_video(a.video, narr_wav, out_video, total, vdur, has_audio, a)

    report = {
        "engine": engines[0].name, "voice": engines[0].voice, "video": a.video,
        "video_duration": vdur, "output_duration": round(total, 3), "extended_by": round(max(0, total - (vdur or total)), 3),
        "scenes": [{"scene": s.idx, "start": s.start, "end": s.end, "narration_at": round(s.at, 3),
                    "speech": round(s.speech, 3), "speed": round(s.speed, 3), "overflow": round(s.overflow, 3),
                    "text": s.spoken} for s in scenes],
    }
    with open(os.path.join(a.out, "report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    over = [s for s in scenes if s.overflow > 0.05]
    print(f"\n완료 → {a.out}/")
    if out_video:
        print(f"  narrated.mp4   {total:.1f}초" + (f" (원본보다 {total - vdur:.1f}초 늘림 — 마지막 프레임 유지)" if total > vdur + 0.05 else ""))
    print("  narration.wav  캡컷 등에 올릴 전체 내레이션 트랙\n  subtitles.srt  자막\n  clips/         장면별 음성")
    if over:
        print(f"  ⚠ 넘친 장면: {', '.join(str(s.idx) for s in over)} — 대본을 줄이거나 --max-speed 를 올리세요")
    return 0


if __name__ == "__main__":
    sys.exit(main())
