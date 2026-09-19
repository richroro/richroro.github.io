#!/usr/bin/env python3
"""Build.part / Build.label / card / text 의 속성 가방 키가 선언된 타입에 있는지 본다.

    python3 tools/checkprops.py

Luau 타입 검사기는 이 테이블들의 값 타입과 Enum 은 잡아주지만, 선언에 없는
키가 하나 더 들어가는 건 그냥 통과시킨다. 런타임에 Roblox 가
"X is not a valid member of Part" 로 터뜨리기 전에 여기서 잡는다.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

def declared(path, typename):
    src = (ROOT / path).read_text(encoding="utf-8")
    m = re.search(r"(?:export )?type %s = \{(.*?)\n\}" % typename, src, re.S)
    assert m, f"type {typename} not found in {path}"
    return set(re.findall(r"^\t(\w+):", m.group(1), re.M))

TYPES = {
    "Build.part":  declared("src/server/Build.luau", "PartProps"),
    "Build.label": declared("src/server/Build.luau", "LabelProps"),
    "card":        declared("src/client/Hud.luau", "FrameProps"),
    "text":        declared("src/client/Hud.luau", "LabelProps"),
}

def bodies(src, fn):
    """Yield the text of each `fn({ ... })` / `fn(parent, { ... })` literal."""
    for m in re.finditer(re.escape(fn) + r"\(", src):
        i = src.index("{", m.end())
        depth, j = 0, i
        while j < len(src):
            if src[j] == "{": depth += 1
            elif src[j] == "}":
                depth -= 1
                if depth == 0: break
            j += 1
        yield m.start(), src[i+1:j]

bad = 0
for path in sorted(ROOT.glob("src/**/*.luau")):
    src = path.read_text(encoding="utf-8")
    for fn, allowed in TYPES.items():
        for pos, body in bodies(src, fn):
            body = re.sub(r"\{[^{}]*\}", "", body)  # drop nested literals
            for key in re.findall(r"(?:^|\n)\s*(\w+)\s*=", body):
                if key not in allowed:
                    line = src[:pos].count("\n") + 1
                    print(f"{path.relative_to(ROOT)}:{line}: {fn} 에 선언되지 않은 키 '{key}'")
                    bad += 1
print(f"-- 선언에 없는 키 {bad}개")
sys.exit(1 if bad else 0)
