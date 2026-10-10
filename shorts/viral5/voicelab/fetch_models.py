"""Download the weights the 음성 v2 engines and the bake-off scorer need (nothing here is committed to the repository).

usage: python3 voicelab/fetch_models.py [supertonic] [asr] [mos] [qwen]      (no argument: supertonic asr mos)
  pip install supertonic faster-whisper onnxruntime librosa     (qwen: pip install qwen-tts, plus a CPU build of torch)

| name       | what                                   | from (Hugging Face)                         | licence              | size    |
|------------|----------------------------------------|---------------------------------------------|----------------------|---------|
| supertonic | Supertonic 3 TTS, 10 preset voices     | Supertone/supertonic-3 (pinned by the SDK)  | OpenRAIL-M; code MIT | ~0.4 GB |
| asr        | faster-whisper large-v3-turbo (int8)   | deepdml/faster-whisper-large-v3-turbo-ct2   | MIT                  | ~1.6 GB |
| mos        | UTMOS22 strong, ONNX (bake-off only)   | TigreGotico/utmos-onnx                      | MIT                  | ~0.4 GB |
| qwen       | Qwen3-TTS 0.6B CustomVoice (optional)  | Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice        | Apache-2.0           | ~2.5 GB |

Supertonic's OpenRAIL-M licence forbids, among other uses, impersonating people and publishing generated content without
saying it is machine-generated: our descriptions credit "목소리: AI 합성 음성", and we only use its preset voices.
Weights land in the Hugging Face cache (~/.cache/huggingface) and ~/.cache/voicelab; delete them to free disk.
"""
import os, sys
from huggingface_hub import hf_hub_download, snapshot_download

want = sys.argv[1:] or ["supertonic", "asr", "mos"]
if "supertonic" in want:
    from supertonic import TTS
    TTS(model="supertonic-3", auto_download=True); print("supertonic-3 ready")
if "asr" in want:
    print(snapshot_download("deepdml/faster-whisper-large-v3-turbo-ct2"))
if "mos" in want:
    d = os.path.expanduser("~/.cache/voicelab/utmos")
    print(hf_hub_download("TigreGotico/utmos-onnx", "utmos22_strong.onnx", local_dir=d))
if "qwen" in want:
    print(snapshot_download("Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")); print(snapshot_download("Qwen/Qwen3-TTS-Tokenizer-12Hz"))
