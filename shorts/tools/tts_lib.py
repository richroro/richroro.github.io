"""Thin wrapper around sherpa-onnx Supertonic 3 for Korean narration."""
import numpy as np, sherpa_onnx, wave, os

def load_tts(model_dir, threads=4):
    M = model_dir
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
                duration_predictor=f"{M}/duration_predictor.int8.onnx",
                text_encoder=f"{M}/text_encoder.int8.onnx",
                vector_estimator=f"{M}/vector_estimator.int8.onnx",
                vocoder=f"{M}/vocoder.int8.onnx",
                tts_json=f"{M}/tts.json",
                unicode_indexer=f"{M}/unicode_indexer.bin",
                voice_style=f"{M}/voice.bin"),
            num_threads=threads, provider="cpu"),
        max_num_sentences=1)
    return sherpa_onnx.OfflineTts(cfg)

def synth(tts, text, sid, speed=1.1, steps=10, seed=7, lang="ko"):
    g = sherpa_onnx.GenerationConfig()
    g.sid = sid; g.num_steps = steps; g.speed = speed
    g.extra = {"lang": lang, "seed": str(seed), "silence_duration": "0.12"}
    a = tts.generate(text, g)
    return np.array(a.samples, dtype=np.float32), a.sample_rate

def write_wav(path, x, sr):
    x = np.clip(x, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def f0_track(x, sr, fmin=70, fmax=420):
    fr = int(0.04 * sr); hop = int(0.01 * sr); out = []
    for i in range(0, len(x) - fr, hop):
        seg = x[i:i + fr]
        if np.sqrt(np.mean(seg ** 2)) < 0.02: continue
        seg = seg - seg.mean(); ac = np.correlate(seg, seg, 'full')[fr - 1:]
        lo, hi = int(sr / fmax), int(sr / fmin)
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.35 * ac[0]: out.append(sr / k)
    return np.array(out)
