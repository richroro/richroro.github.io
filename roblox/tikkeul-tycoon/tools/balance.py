#!/usr/bin/env python3
"""Config 의 밸런스를 Roblox 없이 돌려본다.

    python3 tools/balance.py

Config.luau / Format.luau 원본을 그대로 앞에 붙여 하나의 luau 청크로 만든 뒤
`luau` 인터프리터에 넘긴다. 숫자를 파이썬으로 다시 옮겨 적지 않기 때문에
Config 를 고치면 결과도 같이 움직인다.

luau 는 https://github.com/luau-lang/luau/releases 에서 받는다.
"""

import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent

# Config.luau 는 Roblox 전역을 쓴다. 필요한 건 이 둘뿐이라 최소한만 흉내 낸다.
STUBS = """--!nonstrict
local Vector3 = { new = function(x, y, z) return { X = x, Y = y, Z = z } end }
local Color3 = { fromRGB = function(r, g, b) return { R = r, G = g, B = b } end }
"""


def as_module(path: pathlib.Path, name: str) -> str:
    source = path.read_text(encoding="utf-8")
    # `export type` 은 모듈 최상위에서만 되는 문법이라 함수로 감싸면 깨진다.
    source = re.sub(r"^export type ", "type ", source, flags=re.MULTILINE)
    return f"local {name} = (function()\n{source}\nend)()\n"


def main() -> int:
    luau = shutil.which("luau")
    if luau is None:
        print("luau 실행 파일을 찾지 못했다. https://github.com/luau-lang/luau/releases", file=sys.stderr)
        return 1

    bundle = "".join([
        STUBS,
        as_module(ROOT / "src" / "shared" / "Config.luau", "Config"),
        as_module(ROOT / "src" / "shared" / "Format.luau", "Format"),
        (ROOT / "tools" / "balance.luau").read_text(encoding="utf-8"),
    ])

    with tempfile.NamedTemporaryFile("w", suffix=".luau", encoding="utf-8", delete=False) as handle:
        handle.write(bundle)
        generated = handle.name

    try:
        return subprocess.call([luau, generated])
    finally:
        pathlib.Path(generated).unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
