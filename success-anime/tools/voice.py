#!/usr/bin/env python3
"""성공 애니 · 대사 음성 합성

render-shorts.js 가 부르는 도우미. JSON 줄 목록을 받아 줄마다 음성 파일을 만든다.

    python3 voice.py <engine> <jobs.json> <outdir>

jobs.json: [{"id": "s3", "text": "...", "voice": "ko-KR-InJoonNeural", "rate": "+0%", "pitch": "+0Hz"}, ...]
출력:      <outdir>/<id>.wav  와 표준출력에 {"s3": 2.41, ...} (초 단위 길이)

engine
  edge    Microsoft Edge 온라인 신경망 음성 (pip install edge-tts). 자연스러운 한국어.
          speech.platform.bing.com 에 접속할 수 있어야 한다.
  espeak  eSpeak NG 오프라인 음성 (pip install espeakng-loader). 기계음이지만 네트워크가 필요 없다.
"""
import asyncio, ctypes, json, os, subprocess, sys, wave

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')


def wav_len(path):
    with wave.open(path) as w:
        return w.getnframes() / w.getframerate()


def to_wav(src, dst):
    # 44.1k stereo, trimmed of the long leading/trailing silence neural voices add
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', src, '-af',
                    'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,apad=pad_dur=0.08',
                    '-ar', '44100', '-ac', '2', dst], check=True)


# ---------------------------------------------------------------- edge
async def edge_all(jobs, out):
    # behind a TLS-inspecting proxy: edge-tts pins certifi's store and ignores HTTPS_PROXY unless told
    if os.environ.get('SSL_CERT_FILE'):
        import certifi
        certifi.where = lambda: os.environ['SSL_CERT_FILE']
    import edge_tts
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy') or None
    sem = asyncio.Semaphore(4)

    async def one(j):
        async with sem:
            mp3 = os.path.join(out, j['id'] + '.mp3')
            for attempt in range(4):
                try:
                    await edge_tts.Communicate(j['text'], j['voice'], rate=j.get('rate', '+0%'), pitch=j.get('pitch', '+0Hz'), proxy=proxy).save(mp3)
                    break
                except Exception:
                    if attempt == 3:
                        raise
                    await asyncio.sleep(2 ** attempt)
            to_wav(mp3, os.path.join(out, j['id'] + '.wav'))
            os.remove(mp3)

    await asyncio.gather(*(one(j) for j in jobs))


# ---------------------------------------------------------------- espeak
def espeak_all(jobs, out):
    import espeakng_loader as L
    lib = ctypes.CDLL(L.get_library_path())
    CB = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)
    lib.espeak_Initialize.restype = ctypes.c_int
    sr = lib.espeak_Initialize(2, 0, L.get_data_path().encode(), 0)  # AUDIO_OUTPUT_SYNCHRONOUS
    buf = []

    def cb(wav, n, _ev):
        if n > 0:
            buf.append(ctypes.string_at(wav, n * 2))
        return 0

    keep = CB(cb)
    lib.espeak_SetSynthCallback(keep)
    lib.espeak_SetVoiceByName(b'ko')
    for j in jobs:
        buf.clear()
        # map the edge-style "+10%" / "-4Hz" knobs onto espeak rate (wpm) and pitch (0-100)
        rate = 165 * (1 + int(j.get('rate', '+0%').rstrip('%')) / 100)
        pitch = 50 + int(j.get('pitch', '+0Hz').rstrip('Hz')) * 2
        lib.espeak_SetParameter(1, int(rate), 0)
        lib.espeak_SetParameter(3, max(0, min(99, pitch)), 0)
        text = j['text'].encode('utf-8') + b'\0'
        lib.espeak_Synth(text, len(text), 0, 0, 0, 1, None, None)  # espeakCHARS_UTF8
        lib.espeak_Synchronize()
        raw = os.path.join(out, j['id'] + '.raw.wav')
        with wave.open(raw, 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(b''.join(buf))
        to_wav(raw, os.path.join(out, j['id'] + '.wav'))
        os.remove(raw)


def main():
    engine, jobs_path, out = sys.argv[1:4]
    jobs = json.load(open(jobs_path, encoding='utf-8'))
    os.makedirs(out, exist_ok=True)
    if engine == 'edge':
        asyncio.run(edge_all(jobs, out))
    elif engine == 'espeak':
        espeak_all(jobs, out)
    else:
        sys.exit('engine must be edge or espeak')
    print(json.dumps({j['id']: round(wav_len(os.path.join(out, j['id'] + '.wav')), 3) for j in jobs}))


if __name__ == '__main__':
    main()
