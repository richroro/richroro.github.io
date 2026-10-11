"""GitHub Actions 에서 도는 한 바퀴: 요청 → 상품 받기 → 문구 → 렌더 → 업로드 문구.

  requests/<id>.json 이 새로 생기거나 바뀌면   fetch.py  → data/<id>.json
  specs/<id>.json 이 없으면                    autospec.py → specs/<id>.json
  영상이 없거나 spec·data 가 바뀌었으면        render.py + make_desc.py → out/<id>.mp4, out/<id>.txt

사용: python pipeline.py [--changed 파일목록.txt] [--force] [id ...]
  id 를 주면 그것만, 안 주면 requests/ 와 specs/ 전체를 훑는다.
"""
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import autospec  # noqa: E402
import fetch  # noqa: E402
import make_desc  # noqa: E402
import render  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def main(argv: list[str]) -> int:
    force = "--force" in argv
    changed: set[str] = set()
    if "--changed" in argv:
        f = Path(argv[argv.index("--changed") + 1])
        changed = {l.strip() for l in f.read_text().splitlines() if l.strip()} if f.exists() else set()
    ids = [a for a in argv if not a.startswith("--") and not a.endswith(".txt")]
    if not ids:
        ids = sorted({p.stem for p in (ROOT / "requests").glob("*.json")} | {p.stem for p in (ROOT / "specs").glob("*.json")})
    rel = lambda p: str(p.relative_to(ROOT.parent))  # noqa: E731 — 저장소 기준 경로 (git diff 와 같은 형식)
    bad = 0
    for i in ids:
        req, data, spec, mp4 = (ROOT / "requests" / f"{i}.json", ROOT / "data" / f"{i}.json",
                                ROOT / "specs" / f"{i}.json", ROOT / "out" / f"{i}.mp4")
        refetched = False
        if req.exists() and (force or not data.exists() or rel(req) in changed):
            if not (os.environ.get("COUPANG_ACCESS_KEY") and os.environ.get("COUPANG_SECRET_KEY")):
                print(f"[{i}] 쿠팡 API 키가 없어 상품을 받지 못했습니다 — 시크릿을 넣은 뒤 이 요청 파일을 다시 올리세요")
                continue
            if fetch.main([i]):
                bad += 1
                continue
            refetched = True
        if not data.exists() and spec.exists():
            src = json.loads(spec.read_text()).get("data", i)
            data = ROOT / "data" / f"{src}.json"
        if not data.exists():
            print(f"[{i}] data 가 없어 건너뜀 (requests/{i}.json 을 먼저 넣으세요)")
            continue
        if spec.exists() and refetched:
            # 다시 받은 상품 목록에 spec 이 가리키는 상품이 없으면 문구를 새로 쓴다 (있으면 손본 spec 을 그대로 둔다)
            have = {str(p["productId"]) for p in json.loads(data.read_text())["products"]}
            if any(str(b.get("p")) not in have for b in json.loads(spec.read_text())["beats"] if b.get("p") and not str(b["p"]).startswith("#")):
                autospec.main([i, "--force"])
        if not spec.exists():
            autospec.main([i])
            if not spec.exists():
                continue
            refetched = True
        if force or refetched or not mp4.exists() or rel(spec) in changed:
            try:
                print("렌더:", render.render(i))
                out = ROOT / "out" / f"{i}.txt"
                out.write_text(make_desc.desc(i))
                print("업로드 문구:", out.relative_to(ROOT))
            except (Exception, SystemExit) as e:  # noqa: BLE001 — 한 편이 실패해도 나머지는 계속
                print(f"[{i}] 렌더 실패: {type(e).__name__}: {e}")
                bad += 1
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
