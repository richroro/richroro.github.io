#!/usr/bin/env python3
"""Roblox 없이 서버 코드를 실제로 실행해본다.

    python3 tools/test.py

Roblox API 를 흉내낸 스텁(tools/sim/stub.luau)과 협조적 스케줄러
(tools/sim/sched.luau) 위에 src/server 를 통째로 올려서, 월드 생성부터
클레임·구매·환생·퇴장·저장까지 시나리오를 돌린다. 물리 엔진은 없으므로
낙하물은 시나리오가 직접 금고에 넣어준다.

이것으로 못 보는 것: 실제 물리(컨베이어, 충돌), 렌더링, 네트워크 복제,
실제 DataStore 의 처리량 제한. 그건 Studio 에서 봐야 한다.

luau 는 https://github.com/luau-lang/luau/releases 에서 받는다.
"""

import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SIM = ROOT / "tools" / "sim"

# 의존 순서대로. 아래 모듈이 위 모듈을 이름으로 그냥 참조한다.
MODULES = [
    ("Config", "src/shared/Config.luau"),
    ("Format", "src/shared/Format.luau"),
    ("Net", "src/shared/Net.luau"),
    ("Build", "src/server/Build.luau"),
    ("Data", "src/server/Data.luau"),
    ("Economy", "src/server/Economy.luau"),
    ("Plot", "src/server/Plot.luau"),
    ("PlotService", "src/server/PlotService.luau"),
    ("World", "src/server/World.luau"),
]

SERVICES = """local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Lighting = game:GetService("Lighting")
local DataStoreService = game:GetService("DataStoreService")
"""

# require / GetService 한 줄은 지운다. 번들 바깥의 같은 이름 로컬로 풀린다.
DROP_LINE = re.compile(
    r"^local \w+ = (?:require\(|game:GetService\(|ReplicatedStorage:WaitForChild\()"
)


def as_module(name: str, relative: str) -> str:
    source = (ROOT / relative).read_text(encoding="utf-8")
    # `export type` 은 모듈 최상위 전용 문법이라 함수로 감싸면 깨진다.
    source = re.sub(r"^export type ", "type ", source, flags=re.MULTILINE)
    source = "\n".join("" if DROP_LINE.match(line) else line for line in source.splitlines())
    return f"local {name} = (function()\n{source}\nend)()\n"


def run(luau: str, scenario: pathlib.Path) -> int:
    bundle = "".join(
        [
            (SIM / "stub.luau").read_text(encoding="utf-8"),
            (SIM / "sched.luau").read_text(encoding="utf-8"),
            SERVICES,
        ]
        + [as_module(name, rel) for name, rel in MODULES]
        + [scenario.read_text(encoding="utf-8")]
    )

    with tempfile.NamedTemporaryFile("w", suffix=".luau", encoding="utf-8", delete=False) as handle:
        handle.write(bundle)
        generated = handle.name

    try:
        finished = subprocess.run([luau, generated], capture_output=True, text=True)
    finally:
        pathlib.Path(generated).unlink(missing_ok=True)

    print(finished.stdout, end="")
    if finished.stderr:
        print(finished.stderr, end="", file=sys.stderr)

    match = re.search(r"^RESULT (\d+)$", finished.stdout, re.MULTILINE)
    if match is None:
        print(f"!! {scenario.name}: 끝까지 돌지 못했다", file=sys.stderr)
        return 1
    return int(match.group(1))


def main() -> int:
    luau = shutil.which("luau")
    if luau is None:
        print("luau 실행 파일을 찾지 못했다. https://github.com/luau-lang/luau/releases", file=sys.stderr)
        return 1

    scenarios = sorted(SIM.glob("*.luau"))
    scenarios = [s for s in scenarios if s.name not in {"stub.luau", "sched.luau"}]

    failures = 0
    for scenario in scenarios:
        print(f"######## {scenario.name} ########")
        failures += run(luau, scenario)
        print("")

    print("=" * 40)
    print("전부 통과" if failures == 0 else f"실패 {failures}건")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
