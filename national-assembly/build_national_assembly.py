# -*- coding: utf-8 -*-
"""
국회의사당 (대한민국 국회 본관, 여의도) 3D 모델 생성 스크립트 — Blender 4.2+ / bpy 5.x

본관과 둘레 캠퍼스를 손으로 배치하지 않고 전부 코드로 만듭니다. 공개된 치수(본관 122 x 81 m, 열주 24개 32.5 m,
돔 64 m · 20 m, 기단 5.44 m, 대계단 50 m, 전체 69.19 m)와 OpenStreetMap 윤곽을 상수로 쓰고, 자료가 없는
세부(창 리듬, 돔 이음새 수, 계단 단수, 분수·해태 크기, 이웃 건물 형태)는 사진을 보고 단순화한 추정값입니다.
이 파일은 섹션(치수 → 도구 → 재질 → 부지 → 상징물 → 기단 → 본체 → 열주·지붕 → 돔 → 조명 → 내보내기 → 실행)을
순서대로 이어 붙인 것입니다.

사용법
  1) Blender GUI  : Scripting 탭 → 이 파일 열기 → ▶ 실행.  (현재 씬을 비우고 낮 장면을 만듭니다)
  2) 헤드리스     : blender -b -P build_national_assembly.py -- --out ./out --blend --glb --render
  3) pip bpy      : python build_national_assembly.py --out ./out --blend --glb --render

자주 쓰는 옵션 (전체는 --help)
  --out DIR            결과물 폴더 (기본 ./out)
  --blend              national_assembly.blend 저장 (--tod 시간대 장면)
  --glb                웹 뷰어용 GLB 3개 (본관 낮 · 본관 밤 · 캠퍼스 낮, Draco) + hotspots.json + env_night.hdr
  --glb-scopes LIST    GLB 골라 쓰기 (building,night,campus)
  --render             기본 샷 목록(DEFAULT_SHOTS: 낮 7장 · 골든 1장 · 밤 3장)을 Cycles 로 렌더
  --shots LIST         렌더할 샷 (예: day:hero,night:axis). 카메라 이름은 build_cameras 참고
  --tod day|golden|night   GUI/--blend 장면 시간대 (기본 day)
  --samples N          기준 샘플 수 (기본 128; 시간대별 배율이 곱해짐)
  --size WxH           렌더 해상도 (기본 1920x1080)
  --format png|jpg     렌더 파일 형식 (기본 png)
  --cam NAME=X,Y,Z/TX,TY,TZ[/LENS]   임시 카메라 추가 (--shots day:NAME 으로 렌더)
  --flat               렌더 전에 재질을 웹 GLB 대표색으로 (웹에서 어떻게 보일지 미리보기)
  --no-site            캠퍼스(잔디·분수·나무·이웃 건물) 생략, 본관만
  --validate           실제 치수(높이 69.19 m, 돔 64 m, 열주 24개, 본체 122 x 81 m …) 검사, 실패 시 종료 코드 1
"""

import argparse
import contextlib
import json
import math
import os
import random
import struct
import sys
import tempfile
import time

import bpy                      # bpy 를 먼저 불러와야 bmesh·mathutils 가 잡힙니다
import bmesh
import mathutils.noise
import numpy as np              # Blender 에 함께 들어 있음
from mathutils import Matrix, Vector

# ----------------------------------------------------------------------------
# 치수 (단위: m) — 여러 부위가 함께 쓰는 "공유 치수". 부위별 세부 치수는 각 섹션에 있습니다.
#
# 좌표계: 원점 = 본관 중심 지면. 정면 = -Y, Z 위. 정면은 실제로 남동쪽(방위각 약 142°)을 봅니다.
#   +X = 정면에서 건물을 볼 때 오른쪽(북동: 국회도서관·의정관·의원동산 쪽), -X = 왼쪽(남서: 의원회관 쪽),
#   +Y = 뒤(북서: 한강 쪽). 진북은 모델 좌표로 약 (+0.62, +0.79). compass_dir() 참고.
#
# 근거: 한국민족문화대백과 — 지반→기단면 5.44 m, 기단면→돔 상단 63.75 m (합 69.19 m, 흔히 "70 m"),
#   열주 24개 높이 32.5 m, 대계단 너비 50 m, 층고 5.2~6.5 m. 여러 자료 — 본관 122 x 81 m,
#   돔 밑지름 64 m · 높이 20 m · 약 1,000 t. 처마·파라펫·받침 높이의 배분은 추정입니다.
#
# 평면 해석 (PLAN_BASIS): 자료의 "122 x 81 m" 를 무엇으로 읽느냐의 문제.
#   'osm'       (기본) 122 x 81 = 열주 뒤 본체 외벽. OpenStreetMap 윤곽(처마 약 156 x 115, 기단 약 164 x 123,
#               돔 66)과 연면적 81,444 m2 가 모두 이쪽과 맞습니다. 열주 칸은 약 20.6 m 로 거의 정사각형.
#   'colonnade' 122 x 81 = 열주 중심선 (이전 버전의 해석).
# ----------------------------------------------------------------------------
PLAN_BASIS = 'osm'

if PLAN_BASIS == 'osm':
    BODY_X, BODY_Y = 122.0, 81.0   # 본체 외벽 (자료의 122 x 81)
    GALLERY_D = 11.0               # 본체 외벽 → 열주 중심선 (회랑 깊이)
    ROOF_OVERHANG = 6.0            # 열주 중심선 → 처마 끝 (처마 156 x 115)
    PODIUM_MARGIN = 10.2           # 열주 중심선 → 기단 가장자리 (기단 164.4 x 123.4)
    STAIR_DEPTH = 32.3             # 기단 앞면 → 대계단 맨 아랫단 (OSM: y -61.7 → -94)
    L = BODY_X + 2 * GALLERY_D     # 144  열주 중심선 길이
    W = BODY_Y + 2 * GALLERY_D     # 103  열주 중심선 폭
else:
    L, W = 122.0, 81.0
    GALLERY_D = 5.5
    ROOF_OVERHANG = 4.0
    PODIUM_MARGIN = 5.0
    STAIR_DEPTH = 18.0
    BODY_X, BODY_Y = L - 2 * GALLERY_D, W - 2 * GALLERY_D
WALL_INSET = GALLERY_D            # (이전 이름)

PODIUM_H = 5.44           # 지반 → 기단면 (정면 대계단이 여기까지 오름)
PODIUM_X = L + 2 * PODIUM_MARGIN               # 기단 길이
PODIUM_Y = W + 2 * PODIUM_MARGIN               # 기단 폭
STAIR_W = 50.0            # 정면 대계단 전체 너비 (옆벽 포함, 디딤판은 약 47 m)
STAIR_FOOT_Y = -PODIUM_Y / 2 - STAIR_DEPTH     # 대계단 맨 아랫단 y (osm: 약 -94)
COL_H = 32.5              # 열주 높이 (기단면 → 처마 밑면)
COL_BASE_W = 2.8          # 열주 밑단 폭 (모서리를 조금 깎은 사각형, 면 사이 거리)
COL_TOP_W = 3.3           # 열주 윗단 폭 (정팔각형, 면 사이 거리) — 위로 갈수록 넓어짐
COLS_FRONT = 8            # 앞·뒤 열주 수 (전면 8개 = 팔도)
COLS_SIDE_BETWEEN = 4     # 좌·우 모서리 사이 열주 수 → 8+8+4+4 = 24 (24절기)
FLOOR_HEIGHTS = (6.5, 5.2, 5.2, 5.2, 5.2, 5.2)  # 기단 위 6개 층 (합 32.5 = 열주 높이)
FLOORS = len(FLOOR_HEIGHTS)
EAVES_H = 3.2             # 처마 슬래브 두께 (추정)
PARAPET_H = 2.8           # 처마 위 파라펫 높이 (추정)
DRUM_R = 33.0             # 돔 받침 원통 반지름 (돔 밑 반지름 32 m 보다 살짝 큼, OSM 돔 윤곽 66 m)
DRUM_H = 5.25             # 돔 받침 높이 (나머지 높이를 맞추는 값, 추정)
DOME_D = 64.0             # 돔 밑지름
DOME_H = 20.0             # 돔 높이 (라이즈/스팬 0.31 — 반구가 아닌 낮은 돔)
FRONT_AZIMUTH = 142.0     # 정면이 바라보는 방위각 (진북 0°, 시계방향) — OSM 건물 윤곽·의사당대로 축

ROOF_Z0 = PODIUM_H + COL_H                     # 37.94  처마 밑면
ROOF_DECK_Z = ROOF_Z0 + EAVES_H                # 41.14  옥상 바닥 (파라펫 안쪽)
ROOF_TOP = ROOF_DECK_Z + PARAPET_H             # 43.94  파라펫 윗면
DRUM_Z0 = ROOF_TOP                             # 43.94  (받침은 옥상 바닥까지 내려가도 됨 — 파라펫에 가려짐)
DOME_Z0 = DRUM_Z0 + DRUM_H                     # 49.19  돔 스프링 라인
TOTAL_H = DOME_Z0 + DOME_H                     # 69.19  지면 → 돔 꼭대기 ("70 m")
PUBLISHED_H = 70.0                             # 자료에 흔히 적힌 높이

# 의원동산 (옛 양말산 자리) — 본관 오른쪽 뒤의 낮은 언덕. 부지·상징물 섹션이 같은 지형을 쓰도록 여기 둡니다.
MOUND_CENTER = (190.0, 15.0)
MOUND_RADIUS = 85.0       # 이 반경 밖은 평지
MOUND_H = 7.0             # 꼭대기 높이 (추정)


def ground_z(x, y):
    """지면 높이. 의원동산만 매끈한 언덕이고 나머지는 0."""
    d = math.hypot(x - MOUND_CENTER[0], y - MOUND_CENTER[1]) / MOUND_RADIUS
    if d >= 1.0:
        return 0.0
    return MOUND_H * 0.5 * (1.0 + math.cos(math.pi * d))


TODS = ('day', 'golden', 'night')


def floor_levels():
    """기단면부터 각 층 바닥 높이(z) 리스트와 마지막 천장 높이. [(z0, h), ...]"""
    z, out = PODIUM_H, []
    for h in FLOOR_HEIGHTS:
        out.append((z, h))
        z += h
    return out


def compass_dir(azimuth_deg, elevation_deg=0.0):
    """나침반 방위각(진북 0°, 동 90°)·고도각 → 모델 좌표 단위 벡터 (그 방향을 가리킴)."""
    a = math.radians(FRONT_AZIMUTH - 90.0 - azimuth_deg)
    e = math.radians(elevation_deg)
    return Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))


def column_positions():
    """열주 24개의 (x, y). 앞(-Y)·뒤(+Y) 8개씩, 좌·우 모서리 사이 4개씩 (osm 기준 칸 20.57 x 20.6 m)."""
    pts = []
    for i in range(COLS_FRONT):
        x = -L / 2 + L * i / (COLS_FRONT - 1)
        pts.append((x, -W / 2))
        pts.append((x, W / 2))
    n = COLS_SIDE_BETWEEN + 1
    for j in range(1, n):
        y = -W / 2 + W * j / n
        pts.append((-L / 2, y))
        pts.append((L / 2, y))
    assert len(pts) == 24
    return pts


# ----------------------------------------------------------------------------
# 공통 도구 — 장면 초기화, 컨텍스트, 재질 노드, bmesh 형상
# ----------------------------------------------------------------------------

def clear_scene():
    """새 파일처럼 비웁니다 (기본 큐브/카메라/라이트 포함)."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for block_list in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras,
                       bpy.data.images, bpy.data.node_groups, bpy.data.curves, bpy.data.worlds):
        for block in list(block_list):
            if block.users == 0:
                block_list.remove(block)


class Ctx:
    """한 번의 빌드 상태. 부위 함수는 모두 build_xxx(ctx) 형태로 이것만 받습니다.

    ctx.tod     'day' | 'golden' | 'night'   (재질 발광, 조명, 하늘이 이것을 봅니다)
    ctx.night   tod == 'night'
    ctx.site    주변 부지를 만들지 여부
    ctx.rng     고정 시드 난수 (같은 입력 → 같은 결과)
    ctx.mats    공유 재질 dict (build_materials 가 채움)
    ctx.cameras 이름 → 카메라 오브젝트 (build_cameras 가 채움)
    ctx.stats   검증용 수치 (예: stats['columns'] = 24)
    """

    def __init__(self, tod='day', site=True, seed=1975):
        assert tod in TODS, tod
        self.tod = tod
        self.night = tod == 'night'
        self.site = site
        self.seed = seed
        self.rng = random.Random(seed)
        mathutils.noise.seed_set(seed)      # noise_vector 류는 시드를 안 주면 실행마다 값이 달라짐
        self.scene = bpy.context.scene
        self.root = bpy.data.collections.new('National_Assembly')
        self.scene.collection.children.link(self.root)
        self._colls = {}
        self.mats = {}
        self.cameras = {}
        self.stats = {}

    def coll(self, name, parent=None):
        """루트 아래(또는 parent 아래) 컬렉션을 한 번만 만들어 돌려줍니다."""
        if name not in self._colls:
            c = bpy.data.collections.new(name)
            (parent or self.root).children.link(c)
            self._colls[name] = c
        return self._colls[name]

    def material(self, key, factory):
        """부위 전용 재질을 한 번만 만듭니다. factory() → bpy.types.Material"""
        if key not in self.mats:
            self.mats[key] = factory()
        return self.mats[key]


# --- 재질 노드 도우미 ---------------------------------------------------------

def ensure_nodes(block):
    """4.x 에서는 use_nodes 를 켜야 노드 트리가 생기고, 5.0 부터는 기본이라 건드리지 않음."""
    if block.node_tree is None:
        block.use_nodes = True


def node(nt, kind, loc=(0, 0), **values):
    """노드를 만들고 입력 소켓 기본값/속성을 이름으로 설정합니다.
    소켓 이름의 공백은 _ 로 씁니다 (Emission_Strength=2.0). 소켓이 아니면 노드 속성으로 설정합니다."""
    n = nt.nodes.new(kind)
    n.location = loc
    for key, val in values.items():
        name = key.replace('_', ' ')
        sock = n.inputs.get(name)
        if sock is not None and hasattr(sock, 'default_value'):
            sock.default_value = val
        else:
            setattr(n, key, val)
    return n


def link(nt, out_socket, in_socket):
    nt.links.new(out_socket, in_socket)


def mix_color(nt, fac, a, b, blend='MIX', loc=(0, 0)):
    """RGBA Mix 노드. fac/a/b 는 소켓 또는 값. 결과 소켓을 돌려줍니다.
    (Mix 노드는 float/vector/color 입력이 이름이 같아서 인덱스로 접근해야 합니다: 0=Factor, 6=A, 7=B, 출력 2=Result)"""
    m = nt.nodes.new('ShaderNodeMix')
    m.location = loc
    m.data_type = 'RGBA'
    m.blend_type = blend
    for idx, v in ((0, fac), (6, a), (7, b)):
        if hasattr(v, 'is_output'):
            nt.links.new(v, m.inputs[idx])
        elif idx == 0:
            m.inputs[0].default_value = v
        else:
            m.inputs[idx].default_value = v if len(v) == 4 else (*v, 1.0)
    return m.outputs[2]


def principled(mat):
    return next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')


def new_pbr(name, color, roughness=0.5, metallic=0.0, emission=None, emission_strength=0.0, **extra):
    """Principled BSDF 재질. 기본값은 '평평한 대표색'이기도 해서 glTF 내보내기 때 그대로 쓰입니다.
    절차적 텍스처는 돌려받은 nt/bsdf 에 노드를 이어서 붙이면 됩니다. extra 는 소켓 이름(_=공백) → 값.
    반환: (mat, nt, bsdf)"""
    mat = bpy.data.materials.new(name)
    ensure_nodes(mat)
    nt = mat.node_tree
    bsdf = principled(mat)
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    for key, val in extra.items():
        bsdf.inputs[key.replace('_', ' ')].default_value = val
    mat.diffuse_color = (*color, 1.0)          # 솔리드 뷰포트 색
    mat.roughness = roughness
    mat.metallic = metallic
    mat['na_flat'] = {
        'color': list(color), 'roughness': roughness, 'metallic': metallic,
        'emission': list(emission) if emission is not None else [0.0, 0.0, 0.0],
        'emission_strength': emission_strength,
    }
    return mat, nt, bsdf


def make_material(name, color, roughness=0.6, metallic=0.0, emission=None, emission_strength=1.0):
    """절차적 텍스처 없는 단색 재질 (이전 버전 호환)."""
    return new_pbr(name, color, roughness, metallic, emission, emission_strength if emission else 0.0)[0]


def set_flat(mat, **kw):
    """glTF 로 내보낼 평평한 대표값을 덮어씁니다 (color, roughness, metallic, emission, emission_strength)."""
    flat = dict(mat['na_flat'].to_dict()) if 'na_flat' in mat else {}
    flat.update({k: (list(v) if isinstance(v, (tuple, list)) else v) for k, v in kw.items()})
    mat['na_flat'] = flat


def flatten_material(mat):
    """절차적 노드를 모두 지우고 na_flat 대표값만 남긴 Principled 로 바꿉니다 (glTF 내보내기 직전에만 사용)."""
    flat = mat.get('na_flat')
    if flat is None:
        c = mat.diffuse_color
        flat = {'color': [c[0], c[1], c[2]], 'roughness': 0.6, 'metallic': 0.0,
                'emission': [0, 0, 0], 'emission_strength': 0.0}
    else:
        flat = flat.to_dict()
    ensure_nodes(mat)
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.inputs['Base Color'].default_value = (*flat['color'], 1.0)
    bsdf.inputs['Roughness'].default_value = flat['roughness']
    bsdf.inputs['Metallic'].default_value = flat['metallic']
    bsdf.inputs['Emission Color'].default_value = (*flat.get('emission', [0, 0, 0]), 1.0)
    bsdf.inputs['Emission Strength'].default_value = flat.get('emission_strength', 0.0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])


# --- bmesh 형상 도우미 --------------------------------------------------------

def finish_mesh(name, bm, collection, material, smooth=False, smooth_sides_only=False, part=None):
    """bmesh → 오브젝트. material 은 재질 하나 또는 리스트(면의 material_index 로 선택).
    smooth_sides_only 는 원통 옆면만 스무스(위·아래 뚜껑은 플랫). part 는 검증용 태그."""
    bm.normal_update()
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if smooth_sides_only:
        for f in bm.faces:
            f.smooth = abs(f.normal.z) < 0.5
    elif smooth:
        for f in bm.faces:
            f.smooth = True
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for m in (material if isinstance(material, (list, tuple)) else [material]):
        mesh.materials.append(m)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    if part:
        obj['na_part'] = part
    return obj


def bm_box(bm, cx, cy, z0, sx, sy, sz):
    """중심(cx, cy), 바닥 z0, 크기(sx, sy, sz) 박스를 bm 에 추가. 새 꼭짓점 리스트를 돌려줍니다."""
    ret = bmesh.ops.create_cube(bm, size=1.0)
    verts = ret['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=(cx, cy, z0 + sz / 2.0), verts=verts)
    return verts


def bm_cylinder(bm, cx, cy, z0, r_bottom, r_top, h, segments=48, rot_z=0.0):
    """원기둥/원뿔대 (segments=8 이면 8각 기둥). 바닥 z0."""
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                                radius1=r_bottom, radius2=r_top, depth=h)
    verts = ret['verts']
    if rot_z:
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot_z, 3, 'Z'), verts=verts)
    bmesh.ops.translate(bm, vec=(cx, cy, z0 + h / 2.0), verts=verts)
    return verts


def bm_extrude_profile_x(bm, pts_yz, x0, x1):
    """YZ 평면의 다각형 단면(pts_yz, 순서대로)을 X 방향 x0→x1 로 밀어낸 프리즘."""
    a = [bm.verts.new((x0, y, z)) for (y, z) in pts_yz]
    b = [bm.verts.new((x1, y, z)) for (y, z) in pts_yz]
    n = len(pts_yz)
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    return a + b


def bm_prism_z(bm, pts_xy, z0, z1):
    """XY 평면 다각형(볼록/오목 무관, 순서대로)을 z0→z1 로 세운 프리즘."""
    a = [bm.verts.new((x, y, z0)) for (x, y) in pts_xy]
    b = [bm.verts.new((x, y, z1)) for (x, y) in pts_xy]
    n = len(pts_xy)
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    return a + b


def bm_lathe(bm, profile_rz, segments=64, cx=0.0, cy=0.0, cap_bottom=True, cap_top=True, phase=0.0):
    """회전체. profile_rz = [(r, z), ...] 아래→위. r=0 인 점은 극점 하나로 모읍니다.
    반환: 링별 꼭짓점 리스트."""
    rings = []
    for (r, z) in profile_rz:
        if r <= 1e-9:
            rings.append([bm.verts.new((cx, cy, z))])
        else:
            rings.append([bm.verts.new((cx + r * math.cos(phase + 2 * math.pi * k / segments),
                                        cy + r * math.sin(phase + 2 * math.pi * k / segments), z))
                          for k in range(segments)])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segments):
            k2 = (k + 1) % segments
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                bm.faces.new((a[0], b[k], b[k2]))
            elif len(b) == 1:
                bm.faces.new((a[k], a[k2], b[0]))
            else:
                bm.faces.new((a[k], a[k2], b[k2], b[k]))
    if cap_bottom and len(rings[0]) > 2:
        bm.faces.new(list(reversed(rings[0])))
    if cap_top and len(rings[-1]) > 2:
        bm.faces.new(rings[-1])
    return rings


def bm_transform(bm, verts, matrix):
    """4x4 행렬로 꼭짓점 변환."""
    bmesh.ops.transform(bm, matrix=matrix, verts=verts)


def box_object(name, cx, cy, z0, sx, sy, sz, collection, material, part=None):
    bm = bmesh.new()
    bm_box(bm, cx, cy, z0, sx, sy, sz)
    return finish_mesh(name, bm, collection, material, part=part)


def add_bevel(obj, width, segments=1, angle_deg=30.0):
    """모서리 베벨 모디파이어 (렌더와 glTF(export_apply) 모두에 반영)."""
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle_deg)
    mod.harden_normals = False
    return mod


def instance(name, src_obj, collection, loc, rot_z=0.0, scale=1.0):
    """메시 데이터를 공유하는 링크 복제 (나무·가로등처럼 많이 반복되는 것)."""
    obj = bpy.data.objects.new(name, src_obj.data)
    obj.location = loc
    obj.rotation_euler = (0.0, 0.0, rot_z)
    obj.scale = (scale, scale, scale) if not isinstance(scale, (tuple, list)) else scale
    collection.objects.link(obj)
    for key in ('na_part',):
        if key in src_obj:
            obj[key] = src_obj[key]
    return obj


def track_to(obj, target):
    c = obj.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    return c


def empty(name, loc, collection):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    collection.objects.link(e)
    return e


# ----------------------------------------------------------------------------
# 공유 재질 — 여러 부위가 함께 쓰는 건축 재질 (부위 전용 재질은 각 섹션에서 ctx.material 로 만듦)
# 키: granite, granite_light, granite_dark, concrete, glass, metal, bronze (+ steel: 기단 난간·캐노피)
#
# 모두 Cycles 절차적 재질입니다 (UV 없음 — Object 좌표 = 월드 m, instance() 복제본은 원본 메시 좌표).
# new_pbr 의 대표값(평평한 색·거칠기·금속성)은 렌더에서 보이는 평균값에 맞춘 것이고 웹 GLB 에 그대로 쓰입니다.
# 석재 무늬는 평균이 1 인 밝기 인수들의 곱이라 평균색이 대표색에서 벗어나지 않습니다.
#   가까이(~10 m): 결정 알갱이 · 판 줄눈(오목, 모서리 둥글림) · 판마다 톤·거칠기 차이 · 범프.
#   멀리(~300 m): 알갱이·줄눈이 픽셀보다 작아지면 카메라 거리에 따라 평균값으로 서서히 바뀝니다
#   (모아레·반짝임 방지). 판마다 옅은 톤 차이와 큰 얼룩만 남습니다.
# 면 좌표는 삼각형의 참 법선(True Normal)으로 고릅니다 (한 면 안에서 일정):
#   알갱이 — 면 위 정규직교 좌표 (가로 접선, 면을 따라 위) → 어느 방향의 평면에서도 둥근 알갱이.
#   판 줄눈 — 축 투영: X 를 보는 벽 (y, z), Y 를 보는 벽 (x, z), 윗면·밑면 (x, y). 곡면에서도 이어지지만
#             비스듬한 면(45° 모따기 등)에서는 판이 최대 1/cos 45° = 1.41 배 넓어집니다.
# ----------------------------------------------------------------------------
MAT_FADE_GRAIN = (10.0, 40.0)      # 알갱이: 이 거리(m)부터 평균으로 바뀌기 시작 → 끝
MAT_FADE_CLOUD = (40.0, 160.0)     # 판 안 구름 무늬
MAT_FADE_JOINT = (55.0, 190.0)     # 줄눈
MAT_EDGE = 0.006                   # 판 모서리 둥글림 폭 (m, 범프만)
MAT_GRIME_H = 0.5                  # 땅·기단면 위 빗물 튄 때 높이 (m)
MAT_GRIME_XY = (L / 2 + 2.0, W / 2 + 2.0)   # 기단면 위 때는 열주 안쪽(회랑·본체 굽)에만
MAT_AXIS_COS = 0.998               # 참 법선이 축과 이 cos 이상(약 3.6° 이내)이면 '축에 나란한 면' (열주 경사면 포함)

# 석재 사양. color = 대표색(선형), panel = (판 폭, 판 높이), v0 = 줄눈 기준 높이, offset = 엇갈림(0.5 = 막쌓기),
# jw = 줄눈 폭, kv = 세로 줄눈 세기(0 = 가로 줄눈만), grain = (스케일, 톤 폭, 검은 알갱이 비율, 세기,
# 흰 알갱이 비율, 세기), panel_amp/large_amp/cloud_amp = 판마다 / 큰 얼룩 / 판 안 구름 밝기 폭,
# weather = 빗물 자국·먼지를 켤 때 그만큼 어두워지는 것을 되돌리는 밝기 보정 (0 = 풍화 없음; 주로 보이는 면 기준 측정값),
# grime = 땅·기단면 바로 위 때의 최대 어두워짐 (면적이 작아 대표색 보정 없음).
MAT_STONES = {
    # 벽·기단 — 밝은 회백색 화강석 (sRGB #D8D5CD), 판 1.4 x 0.907 m (기단 높이 5.44 m 에 6단)
    'granite': dict(name='Granite', color=(0.686, 0.665, 0.610), hue=0.016, rough=0.60, rough_var=0.07,
                    panel=(1.4, PODIUM_H / 6.0), v0=0.0, offset=0.5, jw=0.006, kv=0.6, joint_rel=0.62,
                    depth=0.003, grain=(80.0, 0.07, 0.10, 0.42, 0.07, 0.10),
                    panel_amp=0.045, large_amp=0.03, cloud_amp=0.03, weather=0.0, grime=0.09),
    # 열주 — 조금 더 밝고 고운 알갱이, 가로 드럼 줄눈만 (열주 높이 32.5 m 를 23 드럼, 약 1.41 m)
    'granite_light': dict(name='Granite_Light', color=(0.716, 0.694, 0.644), hue=0.012, rough=0.56,
                          rough_var=0.06, panel=(1.6, COL_H / 23.0), v0=PODIUM_H, offset=0.0, jw=0.007,
                          kv=0.0, joint_rel=0.6, depth=0.003, grain=(115.0, 0.06, 0.08, 0.38, 0.06, 0.08),
                          panel_amp=0.026, large_amp=0.025, cloud_amp=0.025, weather=0.0, grime=0.07),
    # 굽·띠 — 짙은 회색 화강석 (소금·후추 알갱이가 더 뚜렷)
    'granite_dark': dict(name='Granite_Dark', color=(0.27, 0.26, 0.24), hue=0.02, rough=0.52, rough_var=0.08,
                         panel=(1.4, PODIUM_H / 6.0), v0=0.0, offset=0.5, jw=0.006, kv=0.7, joint_rel=0.7,
                         depth=0.004, grain=(65.0, 0.10, 0.16, 0.48, 0.08, 0.36),
                         panel_amp=0.04, large_amp=0.03, cloud_amp=0.035, weather=0.0, grime=0.12),
    # 처마·파라펫 — 회백색 석재 (sRGB #CFCBC3), 큰 판 + 옅은 빗물 자국·윗면 먼지
    'concrete': dict(name='Concrete_Eaves', color=(0.624, 0.597, 0.546), hue=0.01, rough=0.72, rough_var=0.06,
                     panel=(2.6, EAVES_H), v0=ROOF_Z0, offset=0.0, jw=0.008, kv=1.0, joint_rel=0.7,
                     depth=0.004, grain=(55.0, 0.05, 0.06, 0.25, 0.05, 0.06),
                     panel_amp=0.02, large_amp=0.035, cloud_amp=0.02, weather=1.015, grime=0.0),
}

# 유리 — 본체 핀 격자와 같은 창 격자 (열주 한 칸 = 창 10장, 방 = 창 5장, 층 = floor_levels).
# 격자는 본관·기단(곁채 포함) 안에서만 씁니다. 그 밖의 유리(정문 초소 등)는 메시 섬(유리 한 장)마다 난수.
MAT_GLASS_PANES_PER_BAY = 10
MAT_GLASS_ROOM_PANES = 5
MAT_GLASS_GRID_XY = (PODIUM_X / 2 + 18.0, PODIUM_Y / 2 + 5.0)   # 격자를 쓰는 |x|, |y| 범위
MAT_GLASS_TINT = (0.200, 0.140, 0.062)   # 반사 색 (금속 F0 로 씀 → 밝은 하늘을 비추면 sRGB 약 #6B5A3A)
MAT_GLASS_METAL = 0.88                   # 반사 코팅 비율 (나머지는 어두운 실내)
MAT_GLASS_FLAT = (0.242, 0.180, 0.101)   # GLB 대표색 = 코트층 반사(약 4 %)까지 더한 평균 (측정)
MAT_GLASS_LIT = 0.55                     # 밤에 불 켜진 방 비율
MAT_GLASS_NIGHT = 1.3                    # 켜진 창 평균 발광 세기 (Cycles; 너무 밝으면 AgX 가 크림색으로 바램)
MAT_GLASS_KELVIN = (2575.0, 2825.0)      # 실내 조명 색온도 범위 (방마다, 창마다 ±75 K → 2500~2900 K) — AgX 에서
                                         # 밝은 창이 크림색으로 바래지 않고 호박색으로 남게 조금 낮춤
MAT_GLASS_BLIND = (1.0, 0.74, 0.48)      # 밤에 불빛을 받은 블라인드 색 (따뜻한 베이지)
MAT_GLASS_ROOM_TINT = (1.0, 0.85, 0.62)  # 창으로 나오는 빛은 실내 벽·천장·목재에 한 번 튄 빛 → 램프 색에 곱하는 반사색
MAT_GLASS_NIGHT_FLAT = ((1.0, 0.72, 0.45), 1.6)   # 밤 GLB 대표 발광 (따뜻한 흰색, 세기)


# --- 노드 도우미 ------------------------------------------------------------------

def _mat_in(nt, sock, val):
    """입력 소켓에 값 넣기: 출력 소켓이면 연결, 아니면 기본값 (3색 → RGBA 자동)."""
    if hasattr(val, 'is_output'):
        nt.links.new(val, sock)
        return
    if isinstance(val, (tuple, list)) and len(val) == 3 and len(sock.default_value) == 4:
        val = (*val, 1.0)
    sock.default_value = val


def _mat_math(nt, op, a, b=None, c=None, clamp=False):
    """Math 노드 (입력은 소켓 또는 숫자). 결과 소켓."""
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = op
    m.use_clamp = clamp
    for i, v in enumerate((a, b, c)):
        if v is not None:
            _mat_in(nt, m.inputs[i], v)
    return m.outputs[0]


def _mat_lerp(nt, t, a, b):
    """a + t (b - a) — Mix(FLOAT) 라서 t = 0/1 에서 정확히 a/b."""
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'FLOAT'
    m.clamp_factor = True
    for name, v in (('Factor', t), ('A', a), ('B', b)):
        _mat_in(nt, m.inputs[name], v)
    return m.outputs['Result']


def _mat_smooth(nt, v, a0, a1, b0=0.0, b1=1.0):
    """v 를 a0..a1 에서 b0..b1 로 (smoothstep, 범위 밖은 고정)."""
    m = nt.nodes.new('ShaderNodeMapRange')
    m.interpolation_type = 'SMOOTHSTEP'
    m.clamp = True
    for name, val in (('Value', v), ('From Min', a0), ('From Max', a1), ('To Min', b0), ('To Max', b1)):
        _mat_in(nt, m.inputs[name], val)
    return m.outputs['Result']


def _mat_zero_mean(nt, r, amp, mean=0.5):
    """1 + 2 amp (r - mean) — 평균 1 인 밝기 인수 (r 은 평균 mean 인 난수, 0..1 이면 1 ± amp)."""
    return _mat_math(nt, 'MULTIPLY_ADD', _mat_math(nt, 'SUBTRACT', r, mean), 2.0 * amp, 1.0)


def _mat_tex(nt, kind, vec, **values):
    """텍스처 노드 (Vector 입력 연결). 속성·소켓 값은 node() 규칙."""
    t = node(nt, kind, **values)
    link(nt, vec, t.inputs['Vector'])
    return t


def _mat_vec(nt, op, a, b=None):
    """Vector Math 노드 (입력은 소켓 또는 3-튜플). 결과 소켓 (DOT_PRODUCT 는 Value, 나머지는 Vector)."""
    m = nt.nodes.new('ShaderNodeVectorMath')
    m.operation = op
    for i, v in enumerate((a, b)):
        if v is not None:
            _mat_in(nt, m.inputs[i], v)
    return m.outputs['Value' if op == 'DOT_PRODUCT' else 'Vector']


def _mat_hash(nt, a, b, c):
    """정수 칸 번호 (a, b, c) → 칸마다 고정된 서로 독립인 난수 3개 (0..1).
    (White Noise 의 Color.R 은 Value 와 같아서 Value·G·B 를 씁니다.)"""
    v = nt.nodes.new('ShaderNodeCombineXYZ')
    for i, s in enumerate((a, b, c)):
        _mat_in(nt, v.inputs[i], s)
    wn = _mat_tex(nt, 'ShaderNodeTexWhiteNoise', v.outputs[0])
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    link(nt, wn.outputs['Color'], sep.inputs['Color'])
    return wn.outputs['Value'], sep.outputs['Green'], sep.outputs['Blue']


def _mat_tidy(nt):
    """노드를 출력에서의 깊이별 열로 가지런히 (노드 편집기에서 읽기 쉽게). 출력에 닿지 않는 노드(공용 좌표 도우미가
    만들었지만 이 재질이 쓰지 않는 것)는 지웁니다."""
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    depth, frontier = {out.name: 0}, [out]
    while frontier:
        nxt = []
        for n in frontier:
            for sock in n.inputs:
                for lk in sock.links:
                    d = depth[n.name] + 1
                    if depth.get(lk.from_node.name, -1) < d:
                        depth[lk.from_node.name] = d
                        nxt.append(lk.from_node)
        frontier = nxt
    for n in [n for n in nt.nodes if n.name not in depth]:
        nt.nodes.remove(n)
    cols = {}
    for n in nt.nodes:
        cols.setdefault(depth[n.name], []).append(n)
    for d, ns in cols.items():
        for i, n in enumerate(ns):
            n.location = (-260.0 * d, 90.0 * len(ns) - 180.0 * i)


def _mat_camera_lod(mat, nt, bsdf):
    """카메라 광선만 절차적 BSDF, 나머지(간접광 튕김·반사 속 모습)는 대표값 Principled 로 (Mix Shader 는 계수가 0/1 이면
    안 쓰는 쪽 노드를 건너뛰므로 렌더가 빨라집니다; 평균색이 같아 간접광은 그대로).
    대표색에는 코트층 반사가 이미 들어 있으므로(유리·금속) 싼 쪽은 코트 없이 — 코트를 두 번 세지 않게."""
    flat = mat['na_flat']
    cheap = nt.nodes.new('ShaderNodeBsdfPrincipled')
    cheap.inputs['Base Color'].default_value = (*flat['color'], 1.0)
    cheap.inputs['Roughness'].default_value = flat['roughness']
    cheap.inputs['Metallic'].default_value = flat['metallic']
    cheap.inputs['IOR'].default_value = bsdf.inputs['IOR'].default_value
    cheap.inputs['Coat Weight'].default_value = 0.0
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    mix = nt.nodes.new('ShaderNodeMixShader')
    link(nt, nt.nodes.new('ShaderNodeLightPath').outputs['Is Camera Ray'], mix.inputs['Fac'])
    link(nt, cheap.outputs['BSDF'], mix.inputs[1])
    link(nt, bsdf.outputs['BSDF'], mix.inputs[2])
    link(nt, mix.outputs['Shader'], out.inputs['Surface'])


# --- 좌표 -------------------------------------------------------------------------

def _mat_space(nt, faces=True):
    """Object 좌표·법선·카메라 거리. 반환 dict (소켓):
    co, x, y, z — Object 좌표 (m);  nz — 셰이딩 법선의 z (빗물 자국·먼지, 곡면에서 부드럽게);  dist — 카메라 거리.
    faces 이면 면 좌표용으로 더 (금속처럼 3D 노이즈만 쓰는 재질은 False — 노드 트리가 간결):
    tn — 삼각형의 참 법선 (Object 공간 단위 벡터, 한 삼각형 안에서 일정 → 면 좌표의 기준), az = |tn.z|;
    horiz(윗/밑면 1), xface(X 를 보는 면 1), fid(면 방향 번호 0..7),
    axis(축에 나란한 평면 1 — MAT_AXIS_COS 이내), d(면이 놓인 평면의 원점 거리 co·tn, 평면 안에서 일정)."""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    co = tc.outputs['Object']
    p = nt.nodes.new('ShaderNodeSeparateXYZ')
    sn = nt.nodes.new('ShaderNodeSeparateXYZ')
    link(nt, co, p.inputs[0])
    link(nt, tc.outputs['Normal'], sn.inputs[0])
    sp = dict(co=co, x=p.outputs['X'], y=p.outputs['Y'], z=p.outputs['Z'], nz=sn.outputs['Z'],
              dist=nt.nodes.new('ShaderNodeCameraData').outputs['View Distance'])
    if not faces:
        return sp
    # 참 법선은 월드 공간이라 Object 공간으로 (instance() 복제본도 원본 좌표와 맞게)
    vt = node(nt, 'ShaderNodeVectorTransform', vector_type='NORMAL', convert_from='WORLD', convert_to='OBJECT')
    link(nt, node(nt, 'ShaderNodeNewGeometry').outputs['True Normal'], vt.inputs['Vector'])
    tn = _mat_vec(nt, 'NORMALIZE', vt.outputs['Vector'])
    n = nt.nodes.new('ShaderNodeSeparateXYZ')
    link(nt, tn, n.inputs[0])
    ax, ay, az = (_mat_math(nt, 'ABSOLUTE', n.outputs[i]) for i in range(3))
    horiz = _mat_math(nt, 'GREATER_THAN', az, 0.7)
    xface = _mat_math(nt, 'GREATER_THAN', _mat_math(nt, 'SUBTRACT', ax, ay), 0.0)
    main_n = _mat_lerp(nt, horiz, _mat_lerp(nt, xface, n.outputs['Y'], n.outputs['X']), n.outputs['Z'])
    fid = _mat_math(nt, 'MULTIPLY_ADD', horiz, 4.0,
                    _mat_math(nt, 'MULTIPLY_ADD', xface, 2.0, _mat_math(nt, 'GREATER_THAN', main_n, 0.0)))
    axis = _mat_math(nt, 'GREATER_THAN', _mat_math(nt, 'MAXIMUM', _mat_math(nt, 'MAXIMUM', ax, ay), az),
                     MAT_AXIS_COS)
    sp.update(tn=tn, az=az, horiz=horiz, xface=xface, fid=fid, axis=axis, d=_mat_vec(nt, 'DOT_PRODUCT', co, tn))
    return sp


def _mat_face_uv(nt, sp, shift=0.618):
    """면 위의 좌표. 반환 dict (소켓):
    u, v — 판 줄눈 좌표 (m). 축 투영: X 를 보는 벽 (y, z), Y 를 보는 벽 (x, z), 윗·밑면 (x, y).
           축에 나란한 면만 u 에 평면 거리 d x 0.618 을 더해 나란한 면(핀 옆면 등)마다 줄눈 위치가 달라집니다
           (d 는 평면 안에서 일정해서 늘어남 없음). 비스듬한 면·곡면은 더하지 않습니다 — 거기서 d 는 면을 따라
           바뀌어 무늬가 늘어나거나(평면) 삼각형마다 끊기기(곡면) 때문. 그래서 비스듬한 면의 판은 최대 1.41 배 넓음.
    qw   — 평면 번호 (축에 나란한 면만; 나머지는 0 → 곡면에서 삼각형마다 판 톤이 끊기지 않음).
    gu, gv — 알갱이 좌표: 참 법선의 면 위 정규직교 좌표 (가로 접선 t = Z x n, 면을 따라 위 b = n x t) —
           어떤 방향의 평면에서도 늘어나지 않습니다. 곡면에서는 삼각형마다 이어지지 않지만 무작위 알갱이라
           경계가 보이지 않습니다. 거의 수평인 면(|n.z| > 0.999)은 (x, y)."""
    x, y, z, horiz, xface = sp['x'], sp['y'], sp['z'], sp['horiz'], sp['xface']
    u = _mat_lerp(nt, horiz, _mat_lerp(nt, xface, x, y), x)
    v = _mat_lerp(nt, horiz, z, y)
    dd = _mat_math(nt, 'MULTIPLY', sp['axis'], sp['d'])
    u = _mat_math(nt, 'MULTIPLY_ADD', dd, shift, u)
    qw = _mat_math(nt, 'FLOOR', _mat_math(nt, 'MULTIPLY_ADD', dd, 0.37, 0.123))
    t = _mat_vec(nt, 'NORMALIZE', _mat_vec(nt, 'CROSS_PRODUCT', (0.0, 0.0, 1.0), sp['tn']))
    b = _mat_vec(nt, 'CROSS_PRODUCT', sp['tn'], t)
    flat = _mat_math(nt, 'GREATER_THAN', sp['az'], 0.999)
    gu = _mat_lerp(nt, flat, _mat_vec(nt, 'DOT_PRODUCT', sp['co'], t), x)
    gv = _mat_lerp(nt, flat, _mat_vec(nt, 'DOT_PRODUCT', sp['co'], b), y)
    return dict(u=u, v=v, qw=qw, gu=gu, gv=gv)


def _mat_fade(nt, sp, rng):
    """카메라 거리 rng[0] → rng[1] 에서 0 → 1 (잔 무늬를 평균으로 바꾸는 비율)."""
    return _mat_smooth(nt, sp['dist'], rng[0], rng[1])


# --- 석재 -------------------------------------------------------------------------

def _mat_joint_line(nt, t, size):
    """t = 판 좌표/판 크기. 반환: (가장 가까운 줄눈까지 거리 m, 판 번호)."""
    centre = _mat_math(nt, 'ABSOLUTE', _mat_math(nt, 'SUBTRACT', _mat_math(nt, 'FRACT', t), 0.5))
    return _mat_math(nt, 'MULTIPLY', _mat_math(nt, 'SUBTRACT', 0.5, centre), size), _mat_math(nt, 'FLOOR', t)


def _mat_joints(nt, u, v, s):
    """판 줄눈. 반환: (줄눈 마스크 J 0..1, 높이 -1(줄눈 바닥)..0(판 면), 판 열 번호, 판 행 번호).
    가로 줄눈만 있는 돌(kv = 0, 열주 드럼)은 열 번호가 0 — 한 단의 한 면이 한 장이라 줄눈 없는 곳에서 톤이 바뀌지 않음."""
    pw, ph = s['panel']
    jw, kv = s['jw'], s['kv']
    dv, row = _mat_joint_line(nt, _mat_math(nt, 'MULTIPLY', _mat_math(nt, 'SUBTRACT', v, s['v0']), 1.0 / ph), ph)
    soft = 0.0015
    jh = _mat_smooth(nt, dv, jw / 2 - soft, jw / 2 + soft, 1.0, 0.0)
    eh = _mat_smooth(nt, dv, jw / 2 - soft, jw / 2 + MAT_EDGE)
    if kv <= 0.0:
        return jh, _mat_math(nt, 'SUBTRACT', eh, 1.0), 0.0, row
    odd = _mat_math(nt, 'FLOORED_MODULO', row, 2.0)
    shifted = _mat_math(nt, 'MULTIPLY_ADD', u, 1.0 / pw, _mat_math(nt, 'MULTIPLY', odd, s['offset']))   # 막쌓기
    du, col = _mat_joint_line(nt, shifted, pw)
    jv = _mat_smooth(nt, du, jw / 2 - soft, jw / 2 + soft, kv, 0.0)
    ev = _mat_smooth(nt, du, jw / 2 - soft, jw / 2 + MAT_EDGE, 1.0 - kv, 1.0)
    return (_mat_math(nt, 'MAXIMUM', jh, jv), _mat_math(nt, 'SUBTRACT', _mat_math(nt, 'MINIMUM', eh, ev), 1.0),
            col, row)


def _mat_grain(nt, sp, uv, s):
    """결정 알갱이: 굵은 알갱이 + 2.7배 고운 알갱이 (면 좌표 uv 위 2D Voronoi 칸마다 난수 → 검은 운모·흰 장석·
    회색 석영 톤). 반환: (밝기 인수 평균 1, 거칠기 보정 평균 0) — 카메라가 멀면 평균값으로.
    (범프 높이에는 넣지 않습니다: 범프 입력은 세 번 계산돼서 Voronoi 가 들어가면 렌더가 크게 느려짐.)"""
    scale, amp, p_dk, a_dk, p_lt, a_lt = s['grain']
    f, rough = 1.0, 0.0
    for mul, w in ((1.0, 1.0), (2.7, 0.55)):
        vo = _mat_tex(nt, 'ShaderNodeTexVoronoi', uv, Scale=scale * mul, Randomness=1.0, voronoi_dimensions='2D')
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        link(nt, vo.outputs['Color'], sep.inputs['Color'])
        r1, r2 = sep.outputs['Red'], sep.outputs['Green']
        dark = _mat_math(nt, 'SUBTRACT', _mat_math(nt, 'LESS_THAN', r1, p_dk), p_dk)          # 평균 0
        light = _mat_math(nt, 'SUBTRACT', _mat_math(nt, 'GREATER_THAN', r1, 1.0 - p_lt), p_lt)
        g = _mat_zero_mean(nt, r2, amp * w)
        g = _mat_math(nt, 'MULTIPLY_ADD', dark, -a_dk * w, g)
        g = _mat_math(nt, 'MULTIPLY_ADD', light, a_lt * w, g)
        f = g if mul == 1.0 else _mat_math(nt, 'MULTIPLY', f, g)
        rough = _mat_math(nt, 'MULTIPLY_ADD', dark, -0.25 * w, rough)                       # 운모는 반들
    fade = _mat_fade(nt, sp, MAT_FADE_GRAIN)
    return _mat_lerp(nt, fade, f, 1.0), _mat_lerp(nt, fade, rough, 0.0)


def _mat_weather(nt, sp, f, rough):
    """빗물 자국(세로면, 위아래로 긴 노이즈)과 윗면 먼지. 반환: (밝기 인수, 거칠기, 먼지 비율)."""
    vec = nt.nodes.new('ShaderNodeVectorMath')
    vec.operation = 'MULTIPLY'
    link(nt, sp['co'], vec.inputs[0])
    vec.inputs[1].default_value = (1.4, 1.4, 0.055)
    n = _mat_tex(nt, 'ShaderNodeTexNoise', vec.outputs[0], Scale=1.0, Detail=3.0, Roughness=0.55)
    streak = _mat_smooth(nt, n.outputs['Factor'], 0.50, 0.74)
    streak = _mat_math(nt, 'MULTIPLY', streak, _mat_smooth(nt, _mat_math(nt, 'ABSOLUTE', sp['nz']), 0.6, 0.2))
    f = _mat_math(nt, 'MULTIPLY', f, _mat_math(nt, 'MULTIPLY_ADD', streak, -0.10, 1.0))
    blot = _mat_tex(nt, 'ShaderNodeTexNoise', sp['co'], Scale=0.7, Detail=3.0, Roughness=0.6)
    dust = _mat_math(nt, 'MULTIPLY', _mat_smooth(nt, sp['nz'], 0.5, 0.9),
                     _mat_smooth(nt, blot.outputs['Factor'], 0.3, 0.7, 0.45, 1.0))
    rough = _mat_math(nt, 'MULTIPLY_ADD', dust, 0.12, _mat_math(nt, 'MULTIPLY_ADD', streak, 0.05, rough))
    return f, rough, dust


def _mat_grime(nt, sp):
    """땅(z = 0)과 기단면(PODIUM_H) 바로 위 세로면의 옅은 때 (빗물 튄 자국, 0.5 m 안쪽). 반환: 0..1.
    기단면 띠는 열주 안쪽(MAT_GRIME_XY — 회랑 바닥에 선 열주 굽·본체 굽)에만: 기단 파라펫이나 이웃 건물의
    같은 높이에는 받쳐 줄 바닥이 없습니다."""
    blot = _mat_tex(nt, 'ShaderNodeTexNoise', sp['co'], Scale=1.3, Detail=2.0, Roughness=0.6)
    inside = _mat_math(nt, 'MULTIPLY',
                       _mat_math(nt, 'LESS_THAN', _mat_math(nt, 'ABSOLUTE', sp['x']), MAT_GRIME_XY[0]),
                       _mat_math(nt, 'LESS_THAN', _mat_math(nt, 'ABSOLUTE', sp['y']), MAT_GRIME_XY[1]))
    g = 0.0
    for base in (0.0, PODIUM_H):
        d = _mat_math(nt, 'SUBTRACT', sp['z'], base)
        band = _mat_math(nt, 'MULTIPLY', _mat_smooth(nt, d, MAT_GRIME_H, 0.0), _mat_smooth(nt, d, -0.03, 0.0))
        g = band if base == 0.0 else _mat_math(nt, 'MAXIMUM', g, _mat_math(nt, 'MULTIPLY', band, inside))
    g = _mat_math(nt, 'MULTIPLY', g, _mat_math(nt, 'SUBTRACT', 1.0, sp['horiz']))
    return _mat_math(nt, 'MULTIPLY', g, _mat_smooth(nt, blot.outputs['Factor'], 0.3, 0.7, 0.4, 1.0))


def _mat_stone(key):
    """MAT_STONES[key] 사양으로 절차적 석재 재질을 만듭니다."""
    s = MAT_STONES[key]
    pw, ph = s['panel']
    j_mean = s['jw'] / ph + s['kv'] * s['jw'] / pw                  # 줄눈이 차지하는 면적 비율
    flat_f = 1.0 - j_mean * (1.0 - s['joint_rel'])
    gain = (s['weather'] or 1.0) / flat_f                            # 줄눈·풍화까지 평균 내면 대표색
    base = tuple(c * gain for c in s['color'])
    mat, nt, bsdf = new_pbr(s['name'], s['color'], s['rough'], 0.0)
    sp = _mat_space(nt)
    fc = _mat_face_uv(nt, sp)
    jmask, jh, col, row = _mat_joints(nt, fc['u'], fc['v'], s)
    fade_j = _mat_fade(nt, sp, MAT_FADE_JOINT)
    jmask = _mat_lerp(nt, fade_j, jmask, j_mean)
    jh = _mat_math(nt, 'MULTIPLY', jh, _mat_math(nt, 'SUBTRACT', 1.0, fade_j))
    h_val, h_g, h_b = _mat_hash(nt, _mat_math(nt, 'MULTIPLY_ADD', sp['fid'], 1000.0, col), row, fc['qw'])
    # 밝기 인수 = 판마다 x 큰 얼룩 x 판 안 구름 x 알갱이 x 줄눈 (각각 평균 1)
    f = _mat_zero_mean(nt, h_val, s['panel_amp'])
    large = _mat_tex(nt, 'ShaderNodeTexNoise', sp['co'], Scale=0.045, Detail=2.0, Roughness=0.5)
    f = _mat_math(nt, 'MULTIPLY', f, _mat_zero_mean(nt, large.outputs['Factor'], s['large_amp']))
    cloud = _mat_tex(nt, 'ShaderNodeTexNoise', sp['co'], Scale=2.2, Detail=2.0, Roughness=0.6, Distortion=0.4)
    cf = _mat_zero_mean(nt, cloud.outputs['Factor'], s['cloud_amp'])
    f = _mat_math(nt, 'MULTIPLY', f, _mat_lerp(nt, _mat_fade(nt, sp, MAT_FADE_CLOUD), cf, 1.0))
    uv = nt.nodes.new('ShaderNodeCombineXYZ')
    link(nt, fc['gu'], uv.inputs[0])
    link(nt, fc['gv'], uv.inputs[1])
    gf, g_rough = _mat_grain(nt, sp, uv.outputs[0], s)
    f = _mat_math(nt, 'MULTIPLY', f, gf)
    f = _mat_math(nt, 'MULTIPLY', f, _mat_math(nt, 'MULTIPLY_ADD', jmask, s['joint_rel'] - 1.0, 1.0))
    rough = _mat_math(nt, 'ADD', s['rough'], _mat_math(nt, 'MULTIPLY', _mat_math(nt, 'SUBTRACT', h_b, 0.5),
                                                          2.0 * s['rough_var']))
    rough = _mat_math(nt, 'ADD', rough, g_rough)
    rough = _mat_math(nt, 'MULTIPLY_ADD', jmask, 0.25, rough)
    # 판마다 따뜻한/차가운 기운 (평균 = base)
    t = s['hue']
    warm = (base[0] * (1 + t), base[1], base[2] * (1 - t))
    cool = (base[0] * (1 - t), base[1], base[2] * (1 + t))
    color = mix_color(nt, h_g, cool, warm)
    dust = None
    if s['weather']:
        f, rough, dust = _mat_weather(nt, sp, f, rough)
    if s['grime']:
        grime = _mat_grime(nt, sp)
        f = _mat_math(nt, 'MULTIPLY', f, _mat_math(nt, 'MULTIPLY_ADD', grime, -s['grime'], 1.0))
        rough = _mat_math(nt, 'MULTIPLY_ADD', grime, 0.06, rough)
    color = mix_color(nt, 1.0, color, f, 'MULTIPLY')
    if dust is not None:
        color = mix_color(nt, _mat_math(nt, 'MULTIPLY', dust, 0.35), color,
                          tuple(c * 0.8 for c in (base[0], base[1] * 0.97, base[2] * 0.9)))
    link(nt, color, bsdf.inputs['Base Color'])
    link(nt, _mat_math(nt, 'MAXIMUM', rough, 0.2), bsdf.inputs['Roughness'])
    bump = node(nt, 'ShaderNodeBump', Strength=1.0, Distance=s['depth'])
    link(nt, jh, bump.inputs['Height'])
    link(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])
    _mat_camera_lod(mat, nt, bsdf)
    _mat_tidy(nt)
    return mat


# --- 유리 -------------------------------------------------------------------------

def _mat_storeys(nt, z):
    """층 경계(기단면·floor_levels·처마 밑면) 기준 (층 바닥 z, 층 안 높이 비율 0..1). 층 바닥 z 는 층 번호로도 씀."""
    thr = [PODIUM_H] + [zf for (zf, _) in floor_levels()[1:]] + [ROOF_Z0]
    nxt = thr[1:] + [ROOF_Z0 + FLOOR_HEIGHTS[-1]]
    zb, zt, prev = 0.0, PODIUM_H, 0.0
    for t, t2 in zip(thr, nxt):
        above = _mat_math(nt, 'GREATER_THAN', z, t)
        zb = _mat_math(nt, 'MULTIPLY_ADD', above, t - prev, zb)
        zt = _mat_math(nt, 'MULTIPLY_ADD', above, t2 - t, zt)
        prev = t
    frac = _mat_math(nt, 'DIVIDE', _mat_math(nt, 'SUBTRACT', z, zb), _mat_math(nt, 'SUBTRACT', zt, zb), clamp=True)
    return zb, frac


def _mat_glass_grid(nt, sp, island):
    """창 격자: 본체 핀 모듈(열주 칸 / 10)과 같은 칸. 반환 dict: pane(창 번호), room(방 번호),
    storey(층 바닥 z), frac(층 안 높이 비율), fid(면 방향).
    본관·기단 범위(MAT_GLASS_GRID_XY) 밖의 유리는 격자가 창틀과 맞지 않으므로 창·방 번호 = 메시 섬 번호, 층 = 0
    (섬 하나가 통째로 켜지거나 블라인드가 내려짐 — 창 한가운데서 끊기지 않게)."""
    mx = L / (COLS_FRONT - 1) / MAT_GLASS_PANES_PER_BAY
    my = W / (COLS_SIDE_BETWEEN + 1) / MAT_GLASS_PANES_PER_BAY
    ux = _mat_math(nt, 'MULTIPLY_ADD', sp['x'], 1.0 / mx, L / 2 / mx)
    uy = _mat_math(nt, 'MULTIPLY_ADD', sp['y'], 1.0 / my, W / 2 / my)
    uu = _mat_lerp(nt, sp['horiz'], _mat_lerp(nt, sp['xface'], ux, uy), ux)
    storey, frac = _mat_storeys(nt, sp['z'])
    frac = _mat_lerp(nt, sp['horiz'], frac, _mat_math(nt, 'FRACT', uy))
    storey = _mat_lerp(nt, sp['horiz'], storey, _mat_math(nt, 'FLOOR', uy))
    inside = _mat_math(nt, 'MULTIPLY',
                       _mat_math(nt, 'LESS_THAN', _mat_math(nt, 'ABSOLUTE', sp['x']), MAT_GLASS_GRID_XY[0]),
                       _mat_math(nt, 'LESS_THAN', _mat_math(nt, 'ABSOLUTE', sp['y']), MAT_GLASS_GRID_XY[1]))
    isl = _mat_math(nt, 'FLOOR', _mat_math(nt, 'MULTIPLY', island, 65536.0))
    room = _mat_math(nt, 'FLOOR', _mat_math(nt, 'MULTIPLY', uu, 1.0 / MAT_GLASS_ROOM_PANES))
    return dict(pane=_mat_lerp(nt, inside, isl, _mat_math(nt, 'FLOOR', uu)),
                room=_mat_lerp(nt, inside, isl, room),
                storey=_mat_math(nt, 'MULTIPLY', storey, inside), frac=frac, fid=sp['fid'])


def _mat_glass_blind(nt, g):
    """창마다 내린 블라인드 (창의 약 40 %, 층 윗부분 0~70 %). 1 = 블라인드 뒤."""
    r = _mat_hash(nt, _mat_math(nt, 'MULTIPLY_ADD', g['fid'], 1000.0, g['pane']), g['storey'], 11.0)
    length = _mat_math(nt, 'MULTIPLY', _mat_math(nt, 'MAXIMUM', _mat_math(nt, 'SUBTRACT', r[2], 0.6), 0.0), 1.75)
    return _mat_math(nt, 'GREATER_THAN', g['frac'], _mat_math(nt, 'SUBTRACT', 1.0, length)), r


def _mat_glass_night(nt, g, island, blind, blind_r, bsdf):
    """밤: 방 단위로 불이 켜지고(MAT_GLASS_LIT) 방마다 밝기·색온도가 다르며, 켜진 방 안에서도 창마다 조금씩 다릅니다.
    천장 쪽이 조금 더 밝고(실내 천장 조명), 내린 블라인드는 고르게 빛나는 따뜻한 베이지(MAT_GLASS_BLIND)."""
    room = _mat_hash(nt, _mat_math(nt, 'MULTIPLY_ADD', g['fid'], 1000.0, g['room']), g['storey'], 7.0)
    r_on, r_bright = blind_r[0], blind_r[1]
    mixed = _mat_math(nt, 'MULTIPLY_ADD', island, 0.3, _mat_math(nt, 'MULTIPLY', r_on, 0.7))
    on = _mat_math(nt, 'LESS_THAN', mixed, 0.84)                                        # 켜진 방의 창 84 %
    stray = _mat_math(nt, 'MULTIPLY', _mat_math(nt, 'LESS_THAN', r_on, 0.07), 0.3)      # 꺼진 방의 드문 불빛
    lit = _mat_lerp(nt, _mat_math(nt, 'LESS_THAN', room[0], MAT_GLASS_LIT), stray, on)
    bright = _mat_math(nt, 'MULTIPLY', _mat_math(nt, 'MULTIPLY_ADD', room[1], 0.9, 0.55),
                       _mat_math(nt, 'MULTIPLY_ADD', r_bright, 0.5, 0.75))
    ceiling = _mat_math(nt, 'MULTIPLY_ADD', g['frac'], 0.6, 0.7)
    strength = _mat_math(nt, 'MULTIPLY', _mat_math(nt, 'MULTIPLY', lit, bright), _mat_lerp(nt, blind, ceiling, 1.0))
    link(nt, _mat_math(nt, 'MULTIPLY', strength, MAT_GLASS_NIGHT), bsdf.inputs['Emission Strength'])
    bb = nt.nodes.new('ShaderNodeBlackbody')
    k0, k1 = MAT_GLASS_KELVIN
    kelvin = _mat_math(nt, 'MULTIPLY_ADD', room[2], k1 - k0, _mat_math(nt, 'MULTIPLY_ADD', island, 150.0, k0 - 75.0))
    link(nt, kelvin, bb.inputs['Temperature'])
    lamp = mix_color(nt, 1.0, bb.outputs['Color'], MAT_GLASS_ROOM_TINT, 'MULTIPLY')
    link(nt, mix_color(nt, _mat_math(nt, 'MULTIPLY', blind, 0.5), lamp, MAT_GLASS_BLIND), bsdf.inputs['Emission Color'])


def _mat_glass(ctx):
    """금빛(청동색) 반사 유리: 어두운 판에 따뜻한 반사, 코트층, 창마다 조금씩 다른 톤·거칠기, 잔 물결, 블라인드.
    창 난수 = 창 격자 칸(본체 핀 모듈, 본관·기단 안) + 메시 섬(Random Per Island — 본체는 창유리가 한 장씩 따로).
    밤에는 방·창 단위로 켜진 실내 불빛 (_mat_glass_night)."""
    emit, strength = MAT_GLASS_NIGHT_FLAT if ctx.night else (None, 0.0)
    mat, nt, bsdf = new_pbr('Glass_Bronze', MAT_GLASS_FLAT, 0.06, MAT_GLASS_METAL,
                            emission=emit, emission_strength=strength,
                            IOR=1.52, Coat_Weight=1.0, Coat_Roughness=0.015, Coat_IOR=1.5)
    sp = _mat_space(nt)
    island = node(nt, 'ShaderNodeNewGeometry').outputs['Random Per Island']
    g = _mat_glass_grid(nt, sp, island)
    pane_r = _mat_hash(nt, _mat_math(nt, 'MULTIPLY_ADD', g['fid'], 1000.0, g['pane']), g['storey'], 3.0)
    r = _mat_lerp(nt, 0.5, pane_r[0], island)                         # 창마다 난수 (평균 0.5)
    tint = mix_color(nt, _mat_math(nt, 'MULTIPLY', pane_r[2], 0.6),
                     MAT_GLASS_TINT, (MAT_GLASS_TINT[0] * 1.02, MAT_GLASS_TINT[1] * 0.93, MAT_GLASS_TINT[2] * 0.7))
    tint = mix_color(nt, 1.0, tint, _mat_zero_mean(nt, r, 0.12), 'MULTIPLY')
    # 낮에도 내린 블라인드가 어두운 유리 뒤로 옅게 비침 (반사 코팅 비율을 조금 낮추고 밝은 베이지)
    blind, blind_r = _mat_glass_blind(nt, g)
    blind_vis = _mat_math(nt, 'MULTIPLY', blind, 0.28)
    link(nt, mix_color(nt, blind_vis, tint, (0.52, 0.47, 0.39)), bsdf.inputs['Base Color'])
    link(nt, _mat_lerp(nt, blind_vis, MAT_GLASS_METAL, 0.45), bsdf.inputs['Metallic'])
    link(nt, _mat_math(nt, 'MULTIPLY_ADD', r, 0.05, 0.035), bsdf.inputs['Roughness'])
    # 판의 잔 물결 (강화유리 롤러 자국처럼 반사가 조금 일렁임; 창마다 기울기는 본체가 형상으로 줌)
    wave = _mat_tex(nt, 'ShaderNodeTexNoise', sp['co'], Scale=0.9, Detail=1.0)
    bump = node(nt, 'ShaderNodeBump', Strength=1.0, Distance=0.0025)
    link(nt, wave.outputs['Factor'], bump.inputs['Height'])
    link(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])
    if ctx.night:
        _mat_glass_night(nt, g, island, blind, blind_r, bsdf)   # 불빛이 간접광으로도 번지게 LOD 없음
    else:
        _mat_camera_lod(mat, nt, bsdf)
    _mat_tidy(nt)
    return mat


# --- 금속 -------------------------------------------------------------------------

def _mat_metal(name, color, rough, metallic, var=0.08, coat=0.0, fine=6.0):
    """금속 (창틀·난간): 부재(메시 섬)마다 톤 차이 + 잔 거칠기 얼룩(멀면 평균).
    코트층 반사만큼 GLB 대표색을 밝게 (측정: 코트 0.25 → 약 +10 %)."""
    flat = tuple(c * (1.0 + 0.4 * coat) for c in color)
    mat, nt, bsdf = new_pbr(name, flat, rough, metallic, Coat_Weight=coat, Coat_Roughness=0.25)
    sp = _mat_space(nt, faces=False)
    island = node(nt, 'ShaderNodeNewGeometry').outputs['Random Per Island']
    n = _mat_tex(nt, 'ShaderNodeTexNoise', sp['co'], Scale=fine, Detail=3.0, Roughness=0.55)
    fine_r = _mat_lerp(nt, _mat_fade(nt, sp, MAT_FADE_GRAIN), n.outputs['Factor'], 0.5)
    f = _mat_zero_mean(nt, island, var)
    link(nt, mix_color(nt, 1.0, color, f, 'MULTIPLY'), bsdf.inputs['Base Color'])
    link(nt, _mat_math(nt, 'MULTIPLY_ADD', _mat_math(nt, 'SUBTRACT', fine_r, 0.5), 0.12, rough),
         bsdf.inputs['Roughness'])
    _mat_camera_lod(mat, nt, bsdf)
    _mat_tidy(nt)
    return mat


def _mat_bronze():
    """짙은 청동 (문·조각): 고르게 짙은 갈색 금속 + 잔 얼룩, 옅은 녹청(윗면에 조금 더) — 녹청 부분은 비금속·거칠게."""
    base, patina = (0.12, 0.078, 0.045), (0.11, 0.15, 0.115)
    mat, nt, bsdf = new_pbr('Bronze_Dark', (0.118, 0.079, 0.047), 0.44, 0.9)
    sp = _mat_space(nt, faces=False)
    fade = _mat_fade(nt, sp, MAT_FADE_GRAIN)
    n1 = _mat_tex(nt, 'ShaderNodeTexNoise', sp['co'], Scale=0.9, Detail=3.0, Roughness=0.5)
    n2 = _mat_tex(nt, 'ShaderNodeTexNoise', sp['co'], Scale=7.0, Detail=4.0, Roughness=0.6)
    fine = _mat_lerp(nt, fade, n2.outputs['Factor'], 0.5)
    f = _mat_math(nt, 'MULTIPLY', _mat_zero_mean(nt, n1.outputs['Factor'], 0.08), _mat_zero_mean(nt, fine, 0.10))
    up = _mat_smooth(nt, sp['nz'], 0.2, 0.9, 0.0, 0.25)
    pat = _mat_smooth(nt, _mat_math(nt, 'ADD', n1.outputs['Factor'], up), 0.66, 0.9, 0.0, 0.4)
    col = mix_color(nt, pat, mix_color(nt, 1.0, base, f, 'MULTIPLY'), patina)
    link(nt, col, bsdf.inputs['Base Color'])
    link(nt, _mat_math(nt, 'MULTIPLY_ADD', pat, -0.9, 0.95), bsdf.inputs['Metallic'])
    rough = _mat_math(nt, 'MULTIPLY_ADD', pat, 0.3, _mat_math(nt, 'MULTIPLY_ADD', fine, 0.16, 0.34))
    link(nt, rough, bsdf.inputs['Roughness'])
    bump = node(nt, 'ShaderNodeBump', Strength=1.0, Distance=1.0)
    link(nt, _mat_math(nt, 'MULTIPLY', fine, 0.0006), bump.inputs['Height'])
    link(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])
    _mat_camera_lod(mat, nt, bsdf)
    _mat_tidy(nt)
    return mat


def build_materials(ctx):
    """공유 재질 dict. 밤(ctx.night)이면 유리가 실내 불빛으로 빛납니다."""
    mats = {key: _mat_stone(key) for key in MAT_STONES}
    mats['glass'] = _mat_glass(ctx)
    # 창틀·멀리언: 짙은 청동색 아노다이징 알루미늄
    mats['metal'] = _mat_metal('Metal_Bronze_Anodised', (0.095, 0.07, 0.048), 0.36, 0.8, var=0.08, coat=0.25)
    mats['bronze'] = _mat_bronze()
    # 기단 난간·캐노피 (40_podium 이 쓰고, 없으면 metal)
    mats['steel'] = _mat_metal('Steel_Brushed', (0.56, 0.565, 0.57), 0.3, 1.0, var=0.04, fine=10.0)
    return mats


# ----------------------------------------------------------------------------
# 주변 부지 — 지형·한강, 캠퍼스 차로·보도·광장, 잔디광장과 분수, 산울타리, 나무, 가로등, 울타리, 운동장, 바깥 도로
#
# 배치는 spec/research_spec.md (OpenStreetMap 기반). 원점 = 본관 중심 지면, 정면 -Y (방위 142°), 진북 (0.616, 0.788).
#   앞마당 y -94..-120.5 (X ±101.6) → 가로 차로 y ≈ -124 → 잔디광장 네 칸 X ±(8..96), 분수 (0, -223)
#   → 앞 가로 차로 y -324 → 정문 구역 → 울타리 y -388 → 국회대로 y -404.6, 의사당대로 (-Y 방향 쌍 차로).
#   뒤: 회차로 (-1, 108), 뒷길 y ≈ 121, 국회운동장, 숲, 여의서로(벚나무 가로수), 한강(가장 가까운 물가 (68, 355)).
#   오른쪽: 의원동산 — ground_z 언덕 위 소나무 숲과 잔디 마당. 이웃 건물·조각·정문 기둥은 35_landmarks 몫이라
#   발자국만 비웁니다 (SITE_CLEAR).
# 높이 층 (윗면 z): 바탕 땅 SITE_Z_BASE < 잔디·아스팔트 0 < 포장 SITE_Z_PAVE < 포장 위 잔디·둘째 포장.
#   층 사이는 1.5 cm 이상 띄웁니다. 같은 재질끼리 겹칠 수밖에 없는 곳(차로 교차부, 이웃 앞마당)은 몇 mm 씩 높이를
#   달리해 정확히 같은 평면이 생기지 않게 합니다 (Cycles 에서 같은 평면이 겹치면 검은 얼룩이 생김).
#   의원동산 근처의 길·잔디는 ground_z 를 따라 덮습니다 (drape).
# 나무: 소나무 3 + 활엽수 3 원본을 가까운용(hi)·먼용(lo) 두 단계로 만들고 instance() 로 세웁니다. 원본별로 빈
#   오브젝트 밑에 모아 GLB 에서 GPU 인스턴싱이 됩니다. 가로등·무궁화 떨기나무도 같은 방식.
# 바깥 건물: OSM(2024-10) 캠퍼스 밖 건물 윤곽(1 m 로 단순화)을 낮은 매스로 (SITE_CONTEXT_BLDGS),
#   한강 건너(마포)는 자료가 없어 난수 블록으로 스카이라인만 암시합니다.
# ----------------------------------------------------------------------------
from mathutils import noise as _site_mnoise

SITE_GROUND = (-750.0, 750.0, -850.0, 650.0)   # 부지 지면 사각형 x0, x1, y0, y1 (이 밖은 먼 땅)
SITE_FAR = 4500.0                               # 먼 땅·강의 반폭
SITE_RIVER_P = (68.0, 355.0)                    # 한강 가까운 물가에서 본관에 가장 가까운 점
SITE_RIVER_N = (0.616, 0.788)                   # 물 쪽 법선 (= 진북). 물가선 방향은 진동 (0.788, -0.616)
SITE_RIVER_W = 900.0                            # 강 폭 (건너편 물가까지)
SITE_WATER_Z = -2.2                             # 한강 수면
SITE_BANK = ((-9.0, 0.0), (-4.5, -0.6), (1.2, -2.7), (4.0, -3.3))   # 호안 단면 (물가선에서 s, 바탕 땅 기준 z)
SITE_PARK_W = 130.0                             # 부지 밖 강변 둔치(풀밭) 폭 — 그 너머는 도시
SITE_Z_BASE = -0.03       # 바탕 땅 (잔디·흙)
SITE_Z_PAVE = 0.02        # 보도·광장·산책로 포장
SITE_Z_PAVE2 = 0.035      # 둘째 포장 (운동장처럼 옆 포장보다 높여야 하는 것)
SITE_Z_GRASS2 = 0.045     # 포장 판 위에 얹은 잔디 (잔디광장 네 칸·가운데 띠)
SITE_Z_PAINT = 0.012      # 차선 도색 (아스팔트 윗면 0 위)
SITE_CURB = (0.18, 0.13)  # 연석 폭, 윗면 높이

SITE_MOUND_BOX = (105.0, 330.0, -118.0, 110.0)     # 의원동산 변위 격자 범위 (밖은 ground_z = 0)
SITE_MOUND_WOODS = (118.0, 328.0, -112.0, 106.0)   # 의원동산 숲 (OSM)
SITE_YARD = (138.0, 207.0, -75.0, 69.0)            # 의원동산 잔디 마당 (사랑재 (192, 20) 가 있음)
SITE_FOUNTAIN = (0.0, -223.0)
SITE_FOUNTAIN_R = 13.5                              # 분수 수반 바깥 반지름 (지름 27 m)
SITE_RING_R = 17.0                                  # 분수 둘레 길 바깥 반지름 (잔디가 여기서 잘림)
SITE_LAWN_X = (8.0, 96.0)                           # 잔디광장 칸 |x|
SITE_LAWN_ROWS = ((-220.0, -133.0), (-313.0, -226.0))
SITE_BLOCK = (99.5, -128.0, -316.5)                 # 잔디광장 포장 판: 반폭, 위 y (= 가로 차로 가장자리), 아래 y
SITE_FORECOURT = (101.6, -120.5)                    # 앞마당: 반폭, 앞 끝 y (계단 발치 STAIR_FOOT_Y 부터)
SITE_GROVES = (40.0, 95.0, -112.0, -87.0)           # 앞마당 소나무 화단 |x| 범위, y 범위
SITE_CROSS_Y = (-128.0, -120.5)                     # 가로 차로 (2차로)
SITE_LAWN_DRIVE_X = (105.0, 112.0)                  # 잔디광장 양옆 일방 차로 |x| (본관 옆 차로와 한 줄)
SITE_FRONT_DRIVE_Y = (-328.0, -320.0)               # 앞 가로 차로
SITE_GATE_DRIVE_X = (33.5, 41.5)                    # 정문 차로 |x| (1·2문, x ±37.5)
SITE_SIDE_DRIVE_X = (105.0, 112.0)                  # 본관 옆 서비스 차로 |x|
SITE_FENCE_Y = -388.0
SITE_FENCE_GAPS = ((-44.5, -30.5), (-5.0, 5.0), (30.5, 44.5))   # 앞 울타리 틈: 2문, 보행문(축), 1문
SITE_GUKHOE = (-404.6, 27.0)                        # 국회대로 중심 y, 폭 (6차로)
SITE_UISADANG = ((-20.0, 25.0), 16.4, -2200.0)      # 의사당대로 두 방향 차로 중심 x, 차로 폭, 끝 y
SITE_UTURNS = ((-445.0, -430.0), (-584.0, -564.0))    # 의사당대로 가운데 녹지를 트는 유턴 길 (y 구간)
SITE_LAMP_LIGHTS = 23     # 밤에 점광원을 붙일 가로등 수 (분수 가까운 것부터)
SITE_JUNCTION_LIGHTS = 4  # 밤에 정문 앞 교차로를 비추는 도로 가로등 수 (분수 13 + 23 + 4 = 40)

# 캠퍼스 경계 (울타리) — 앞 y -388, 왼쪽은 여의서로 안쪽 차로, 뒤·오른쪽은 여의서로 바깥 차로에서 12 m 안.
SITE_FENCE = ((440, -388), (430, -260), (420, -190), (355, -95), (310, -30), (245, 52), (205, 100), (175, 132),
              (135, 160), (95, 200), (60, 236), (20, 262), (-14, 280), (-50, 282), (-100, 268), (-150, 248),
              (-178, 228), (-186, 205), (-192, 183), (-226, 90), (-250, 46), (-266, 5), (-268, -16), (-288, -86),
              (-300, -150), (-306, -205), (-333, -291), (-352, -345), (-362, -388))
# 여의서로 (OSM): 캠퍼스를 뒤에서 감싸는 바깥 차로, 왼쪽 두 방향 차로, 뒤 숲을 두르는 안쪽 길.
SITE_RING_OUT = ((-620, 296), (-420, 282), (-287, 267), (-230, 261), (-190, 255), (-170, 259), (-151, 266),
                 (-92, 291), (-72, 297), (-49, 300), (-27, 298), (-14, 295), (1, 287), (21, 276), (37, 265),
                 (73, 236), (84, 228), (146, 171), (167, 152), (184, 141), (213, 110), (259, 55), (283, 27),
                 (329, -34), (375, -101), (444, -201), (501, -282), (555, -362), (583, -404))
SITE_LEFT_OUT = ((-230, 258), (-211, 234), (-203, 219), (-200, 201), (-204, 183), (-239, 90), (-262, 46),
                 (-280, 1), (-335, -146), (-367, -227), (-385, -272), (-404, -345), (-417, -414), (-427, -517),
                 (-470, -760), (-521, -1045))
SITE_LEFT_IN = ((-280, 1), (-286, -33), (-299, -83), (-313, -148), (-318, -188), (-315, -202), (-320, -216),
                (-344, -291), (-364, -345), (-379, -403))
SITE_REAR_LOOP = ((-191, 122), (-175, 167), (-156, 201), (-135, 225), (-112, 243), (-85, 256), (-47, 263),
                  (-25, 263), (-3, 256), (15, 246), (33, 231), (124, 145), (137, 133))
SITE_YEOUI = ((SITE_RING_OUT, 10.5, (-1.75, 1.75), -0.004), (SITE_LEFT_OUT, 10.5, (-1.75, 1.75), -0.008),
              (SITE_LEFT_IN, 7.0, (0.0,), -0.012))
#   여의서로 (점, 폭, 차선 점선 위치, 윗면 z) — 국회대로(z 0) 밑으로 들어가는 끝이 겹치지 않게 조금씩 낮춤
SITE_MOUND_PATHS = (((112.0, -42.0), (122.0, -46.0), (131.0, -41.0), (138.5, -36.0)),        # 의원동산 오르는 길
                    ((180.0, -118.0), (172.0, -104.0), (178.0, -90.0), (174.0, -76.0)),
                    ((207.5, 30.0), (222.0, 38.0), (236.0, 58.0), (246.0, 64.0)))
SITE_SIDE_STREETS = ((-165, -850), (117, -717), (183, -717), (250, -716), (314, -716), (380, -717))
#   국회대로 남쪽 골목 (x, 끝 y) — 국회대로 남쪽 가장자리에서 시작

# 이웃 건물·상징물 발자국 (35_landmarks) — 나무·포장이 침범하지 않게 (x0, x1, y0, y1)
SITE_CLEAR = ((-104.0, 104.0, -96.0, 66.0),                                      # 본관 기단·돌출부·대계단
              (-40.0, -25.0, -95.0, -85.0), (25.0, 40.0, -95.0, -85.0),        # 계단 발치 받침
              (-34.0, -26.0, -377.0, -367.0), (26.0, 34.0, -377.0, -367.0),    # 해태
              (42.0, 50.5, -371.5, -364.5),                                     # 2025 상징석
              (-46.0, 46.0, -392.0, -378.0),                                    # 정문·초소 앞 마당
              (132.0, 196.0, -265.0, -180.0), (228.0, 278.0, -271.0, -174.0),  # 도서관, 의정관
              (196.0, 228.0, -227.0, -217.0), (316.0, 379.0, -293.0, -196.0),  # 연결 다리, 헌정기념관
              (-196.0, -140.0, -290.0, -156.0), (-286.0, -196.0, -188.0, -146.0),
              (-286.0, -196.0, -299.0, -257.0), (-266.0, -196.0, -257.0, -188.0),  # 의원회관
              (-240.0, -170.0, -30.0, 45.0),                                    # 소통관
              (36.0, 72.0, 152.0, 184.0), (-200.0, -165.0, 53.0, 93.0), (-153.0, -129.0, 148.0, 179.0),
              (197.0, 254.0, -61.0, -6.0), (-344.0, -280.0, -370.0, -343.0),   # 2층 작은 건물들
              (174.0, 210.0, 2.0, 38.0))                                        # 사랑재 (돌 기단 포함)
SITE_APRONS = SITE_CLEAR[7:9] + SITE_CLEAR[10:11] + ((-286.0, -140.0, -299.0, -146.0),) + SITE_CLEAR[15:19] + \
    SITE_CLEAR[20:21]   # 포장 앞마당을 두를 이웃 건물 — 서로 겹치지 않게 의원회관 네 동은 한 덩어리로
#   (연결 다리 밑은 차로가 지나가고, 의원동산 비탈의 작은 건물은 평평한 포장이 맞지 않아 뺌)


# --- 평면 도형 도우미 -----------------------------------------------------------

def _site_area2(pts):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))


def _site_ccw(pts):
    """반시계 방향(위에서 볼 때)으로 맞춘 점 목록."""
    pts = list(pts)
    return pts if _site_area2(pts) > 0 else pts[::-1]


def _site_arc(cx, cy, r, a0, a1, step_deg=6.0):
    """원호 점 (a0 → a1, 라디안, 양 끝 포함)."""
    n = max(2, int(abs(a1 - a0) / math.radians(step_deg)) + 1)
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / (n - 1)), cy + r * math.sin(a0 + (a1 - a0) * i / (n - 1)))
            for i in range(n)]


def _site_circle(cx, cy, r, n=48):
    return [(cx + r * math.cos(2 * math.pi * i / n), cy + r * math.sin(2 * math.pi * i / n)) for i in range(n)]


def _site_roundrect(x0, x1, y0, y1, r, step_deg=15.0):
    """모서리를 둥글린 사각형 (반시계). r 는 숫자 또는 (좌하, 우하, 우상, 좌상)."""
    rs = r if isinstance(r, (tuple, list)) else (r,) * 4
    corners = ((x0 + rs[0], y0 + rs[0], math.pi, 1.5 * math.pi), (x1 - rs[1], y0 + rs[1], 1.5 * math.pi, 2 * math.pi),
               (x1 - rs[2], y1 - rs[2], 0.0, 0.5 * math.pi), (x0 + rs[3], y1 - rs[3], 0.5 * math.pi, math.pi))
    pts = []
    for (cx, cy, a0, a1), rr in zip(corners, rs):
        pts += [(cx, cy)] if rr < 1e-6 else _site_arc(cx, cy, rr, a0, a1, step_deg)
    return pts


def _site_minus_circle(poly, cx, cy, r, step_deg=4.0):
    """볼록에 가까운 다각형(반시계)에서 원을 파냅니다 — 원 안의 꼭짓점을 빼고 원호로 잇습니다."""
    dense = []
    for (x0, y0), (x1, y1) in zip(poly, list(poly[1:]) + [poly[0]]):
        dx, dy = x1 - x0, y1 - y0
        t = max(0.0, min(1.0, ((cx - x0) * dx + (cy - y0) * dy) / (dx * dx + dy * dy or 1e-9)))
        near = math.hypot(x0 + t * dx - cx, y0 + t * dy - cy) < r        # 원을 지나는 긴 변은 잘게 나눔
        dense += _site_resample([(x0, y0), (x1, y1)], r / 4.0)[:-1] if near else [(x0, y0)]
    poly = dense
    inside = [math.hypot(x - cx, y - cy) < r for x, y in poly]
    if not any(inside):
        return list(poly)
    out, entry = [], None
    n = len(poly)
    start = next(i for i in range(n) if not inside[i])
    for k in range(n):
        i, j = (start + k) % n, (start + k + 1) % n
        (x0, y0), (x1, y1) = poly[i], poly[j]
        if not inside[i]:
            out.append((x0, y0))
        if inside[i] != inside[j]:
            dx, dy = x1 - x0, y1 - y0
            a, b, c = dx * dx + dy * dy, 2 * (dx * (x0 - cx) + dy * (y0 - cy)), (x0 - cx) ** 2 + (y0 - cy) ** 2 - r * r
            disc = math.sqrt(max(0.0, b * b - 4 * a * c))
            t = (-b - disc) / (2 * a) if not inside[i] else (-b + disc) / (2 * a)
            p = (x0 + t * dx, y0 + t * dy)
            if not inside[i]:
                entry = p
            else:
                a_in = math.atan2(entry[1] - cy, entry[0] - cx)
                a_out = math.atan2(p[1] - cy, p[0] - cx)
                while a_out > a_in:
                    a_out -= 2 * math.pi
                out += _site_arc(cx, cy, r, a_in, a_out, step_deg)
    return out


def _site_clip(poly, a, b, c):
    """다각형을 반평면 a·x + b·y ≤ c 로 자릅니다 (Sutherland–Hodgman 한 번)."""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp < 0 < fq) or (fq < 0 < fp):
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def _site_river_s(x, y):
    """한강 가까운 물가선에서 물 쪽으로 잰 거리 (음수 = 뭍)."""
    return (x - SITE_RIVER_P[0]) * SITE_RIVER_N[0] + (y - SITE_RIVER_P[1]) * SITE_RIVER_N[1]


def _site_river_line(s):
    """물가선에서 s 만큼 떨어진 평행선 위의 한 점과 방향 (진동)."""
    nx, ny = SITE_RIVER_N
    return (SITE_RIVER_P[0] + nx * s, SITE_RIVER_P[1] + ny * s), (ny, -nx)


def _site_land_clip(poly, s_max):
    """물가선 기준 s ≤ s_max (뭍 쪽) 만 남깁니다."""
    nx, ny = SITE_RIVER_N
    return _site_clip(poly, nx, ny, s_max + SITE_RIVER_P[0] * nx + SITE_RIVER_P[1] * ny)


def _site_inside(x, y, poly):
    c = False
    n = len(poly)
    for i in range(n):
        (x0, y0), (x1, y1) = poly[i], poly[(i + 1) % n]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            c = not c
    return c


def _site_in_rects(x, y, rects, margin=0.0):
    return any(x0 - margin <= x <= x1 + margin and y0 - margin <= y <= y1 + margin for x0, x1, y0, y1 in rects)


def _site_smooth(pts, iterations=2):
    """Chaikin 모서리 깎기 (열린 선, 양 끝 유지) — OSM 도로의 꺾임을 부드럽게."""
    for _ in range(iterations):
        out = [pts[0]]
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        out.append(pts[-1])
        pts = out
    return pts


def _site_resample(pts, step, closed=False):
    """선분이 step 보다 길면 나눕니다 (언덕을 따라 덮을 때)."""
    seq = list(pts) + ([pts[0]] if closed else [])
    out = []
    for (x0, y0), (x1, y1) in zip(seq, seq[1:]):
        n = max(1, int(math.ceil(math.hypot(x1 - x0, y1 - y0) / step)))
        out += [(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(n)]
    if not closed:
        out.append(seq[-1])
    return out


def _site_frames(pts, closed=False):
    """꼭짓점마다 (점, 왼쪽 법선, 마이터 배율)."""
    n = len(pts)
    out = []
    for i in range(n):
        p = pts[i]
        a = pts[i - 1] if (i > 0 or closed) else None
        b = pts[(i + 1) % n] if (i < n - 1 or closed) else None
        dirs = []
        for q0, q1 in ((a, p), (p, b)):
            if q0 is not None and q1 is not None:
                seg_len = math.hypot(q1[0] - q0[0], q1[1] - q0[1]) or 1e-9
                dirs.append(((q1[0] - q0[0]) / seg_len, (q1[1] - q0[1]) / seg_len))
        tx, ty = sum(d[0] for d in dirs), sum(d[1] for d in dirs)
        t_len = math.hypot(tx, ty) or 1e-9
        tx, ty = tx / t_len, ty / t_len
        cos_half = max(0.35, tx * dirs[0][0] + ty * dirs[0][1])
        out.append((p, (-ty, tx), 1.0 / cos_half))
    return out


def _site_along(pts, step, offset=0.0, closed=False, phase=0.5):
    """선을 따라 step 간격 점 (x, y, 방향각) — offset 은 왼쪽(+) 옆으로 띄움."""
    seq = list(pts) + ([pts[0]] if closed else [])
    out, carry = [], step * phase
    for (x0, y0), (x1, y1) in zip(seq, seq[1:]):
        seg_len = math.hypot(x1 - x0, y1 - y0)
        if seg_len < 1e-6:
            continue
        tx, ty = (x1 - x0) / seg_len, (y1 - y0) / seg_len
        d = carry
        while d <= seg_len:
            out.append((x0 + tx * d - ty * offset, y0 + ty * d + tx * offset, math.atan2(ty, tx)))
            d += step
        carry = d - seg_len
    return out


def _site_cumlen(pts):
    """선의 꼭짓점마다 처음부터 잰 거리."""
    out = [0.0]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        out.append(out[-1] + math.hypot(x1 - x0, y1 - y0))
    return out


def _site_at(pts, cum, s):
    """선 위 거리 s 인 점과 그곳의 방향각."""
    i = next((k for k in range(len(cum) - 1) if cum[k + 1] >= s), len(cum) - 2)
    (x0, y0), (x1, y1) = pts[i], pts[i + 1]
    t = (s - cum[i]) / ((cum[i + 1] - cum[i]) or 1e-9)
    return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t), math.atan2(y1 - y0, x1 - x0)


def _site_cut(pts, cum, a, b):
    """거리 a..b 사이의 부분 선 (양 끝은 보간한 점)."""
    return [_site_at(pts, cum, a)[0]] + [p for p, c in zip(pts, cum) if a + 0.05 < c < b - 0.05] + \
        [_site_at(pts, cum, b)[0]]


def _site_cross_s(pts, cum, y):
    """선이 수평선 y 를 지나는 거리 s 들 (처음부터 순서대로)."""
    out = []
    for i, ((x0, y0), (x1, y1)) in enumerate(zip(pts, pts[1:])):
        if y0 != y1 and (y0 - y) * (y1 - y) <= 0:
            out.append(cum[i] + (cum[i + 1] - cum[i]) * (y - y0) / (y1 - y0))
    return out


def _site_offset(pts, off):
    """선을 왼쪽(+)으로 off 만큼 옮긴 선 (꼭짓점마다 마이터 — sweep 의 가장자리와 같음)."""
    return [(p[0] + n[0] * off * k, p[1] + n[1] * off * k) for p, n, k in _site_frames(pts)]


def _site_mouth(path, w, y):
    """폭 w 차로(중심선 path)가 수평선 y 를 지나는 x 구간 (lo, hi). 안 지나면 None."""
    xs = []
    for off in (-w / 2, w / 2):
        pts = _site_offset(path, off)
        xs += [x0 + (x1 - x0) * (y - y0) / (y1 - y0) for (x0, y0), (x1, y1) in zip(pts, pts[1:])
               if y0 != y1 and (y0 - y) * (y1 - y) <= 0]
    return (min(xs), max(xs)) if len(xs) >= 2 else None


# --- 메시 만들기 ----------------------------------------------------------------

class _SiteMesh:
    """면을 바로 쌓는 bmesh (bmesh.ops 없이 verts.new / faces.new 만 — 면이 많아도 선형 시간).
    면은 만들 때부터 바깥(수평면은 +Z)을 보게 감고, finish 에서 법선을 다시 계산하지 않습니다."""

    def __init__(self, name, mats):
        self.name = name
        self.mats = list(mats)
        self.bm = bmesh.new()

    def face(self, pts, mi=0):
        f = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        f.material_index = mi
        return f

    def poly(self, pts_xy, z, mi=0):
        """수평 다각형 윗면. z 는 숫자 또는 z(x, y) 함수 (언덕을 따를 때)."""
        pts = _site_ccw(pts_xy)
        if len(pts) < 3:
            return None
        zf = z if callable(z) else (lambda x, y: z)
        return self.face([(x, y, zf(x, y)) for x, y in pts], mi)

    def prism(self, pts_xy, z0, z1, mi=0, mi_top=None, bottom=False):
        """세운 다각형 기둥 (옆면 + 윗면, bottom=True 면 밑면도)."""
        pts = _site_ccw(pts_xy)
        n = len(pts)
        lo = [self.bm.verts.new((x, y, z0)) for x, y in pts]
        hi = [self.bm.verts.new((x, y, z1)) for x, y in pts]
        for i in range(n):
            j = (i + 1) % n
            self.bm.faces.new((lo[i], lo[j], hi[j], hi[i])).material_index = mi
        self.bm.faces.new(hi).material_index = mi if mi_top is None else mi_top
        if bottom:
            self.bm.faces.new(lo[::-1]).material_index = mi

    def box(self, x0, x1, y0, y1, z0, z1, mi=0, bottom=False):
        self.prism(((x0, y0), (x1, y0), (x1, y1), (x0, y1)), z0, z1, mi, bottom=bottom)

    def obox(self, cx, cy, hx, hy, ang, z0, z1, mi=0):
        """ang 만큼 돌린 박스 (중심, 반폭 hx·hy)."""
        c, s = math.cos(ang), math.sin(ang)
        pts = [(cx + c * u - s * v, cy + s * u + c * v) for u, v in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
        self.prism(pts, z0, z1, mi)

    def sweep(self, path, profile, mi=0, closed=False, drape=False, caps=True, smooth=False):
        """단면 profile [(u, z), ...] 을 path 를 따라 쓸어 만든 띠. u 는 진행 방향 왼쪽이 +.
        profile 순서: 오른쪽 아래 → 위 → 왼쪽 아래 (u 가 늘어나는 쪽으로 넘어감) 이면 면이 바깥을 봅니다.
        drape=True 면 각 꼭짓점 z 에 ground_z 를 더합니다 (path 는 미리 잘게 나눠 두세요)."""
        rows = []
        for (px, py), (nx, ny), k in _site_frames(path, closed):
            row = []
            for u, z in profile:
                x, y = px + nx * u * k, py + ny * u * k
                row.append(self.bm.verts.new((x, y, z + (ground_z(x, y) if drape else 0.0))))
            rows.append(row)
        pairs = list(zip(rows, rows[1:])) + ([(rows[-1], rows[0])] if closed else [])
        for a, b in pairs:
            for k in range(len(profile) - 1):
                f = self.bm.faces.new((a[k], b[k], b[k + 1], a[k + 1]))
                f.material_index = mi
                f.smooth = smooth
        if caps and not closed and len(profile) > 2:
            self.bm.faces.new(rows[0]).material_index = mi
            self.bm.faces.new(rows[-1][::-1]).material_index = mi

    def ribbon(self, path, w, z, mi=0, closed=False, drape=False, off=0.0):
        """폭 w 의 수평 띠 (윗면만). off 는 중심선에서 왼쪽(+)으로 옮김."""
        self.sweep(path, ((off - w / 2, z), (off + w / 2, z)), mi, closed, drape, caps=False)

    def finish(self, coll, smooth=False):
        self.bm.normal_update()
        if smooth:
            for f in self.bm.faces:
                f.smooth = True
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in self.mats:
            mesh.materials.append(m)
        obj = bpy.data.objects.new(self.name, mesh)
        coll.objects.link(obj)
        obj['na_part'] = 'site'
        return obj


# --- 재질 노드 도우미 --------------------------------------------------------------

def _site_coords(nt, scale=None, space='Object'):
    """텍스처 좌표 (Object = 월드 m, instance() 복제본은 원본 로컬 m). scale 이 있으면 Mapping 으로 늘림."""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    if scale is None:
        return tc.outputs[space]
    mp = node(nt, 'ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    link(nt, tc.outputs[space], mp.inputs['Vector'])
    return mp.outputs['Vector']


def _site_noise(nt, vec, scale, detail=3.0, rough=0.55, dist=0.0):
    n = node(nt, 'ShaderNodeTexNoise', Scale=scale, Detail=detail, Roughness=rough, Distortion=dist)
    link(nt, vec, n.inputs['Vector'])
    return n.outputs['Factor']


def _site_voronoi(nt, vec, scale, feature='F1'):
    v = node(nt, 'ShaderNodeTexVoronoi', Scale=scale)
    v.feature = feature
    link(nt, vec, v.inputs['Vector'])
    return v


def _site_ramp(nt, fac, stops):
    """색 램프: stops = [(위치, (r, g, b)), ...]."""
    cr = nt.nodes.new('ShaderNodeValToRGB')
    r = cr.color_ramp
    while len(r.elements) < len(stops):
        r.elements.new(0.5)
    for e, (pos, col) in zip(r.elements, stops):
        e.position = pos
        e.color = (*col, 1.0)
    link(nt, fac, cr.inputs['Factor'])
    return cr.outputs['Color']


def _site_math(nt, op, a, b=None):
    m = node(nt, 'ShaderNodeMath', operation=op)
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if hasattr(v, 'is_output'):
            link(nt, v, m.inputs[i])
        else:
            m.inputs[i].default_value = v
    return m.outputs['Value']


def _site_maprange(nt, val, a, b, c=0.0, d=1.0):
    mr = node(nt, 'ShaderNodeMapRange', From_Min=a, From_Max=b, To_Min=c, To_Max=d)
    link(nt, val, mr.inputs['Value'])
    return mr.outputs['Result']


def _site_bump(nt, bsdf, height, strength, distance=0.05):
    b = node(nt, 'ShaderNodeBump', Strength=strength, Distance=distance)
    link(nt, height, b.inputs['Height'])
    link(nt, b.outputs['Normal'], bsdf.inputs['Normal'])


def _site_xyz(nt, vec):
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    link(nt, vec, sep.inputs['Vector'])
    return sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']


# --- 재질 -----------------------------------------------------------------------

def _site_mat_grass(kind):
    """잔디. kind: 'rough'(바탕 땅), 'lawn'(깎은 잔디 — 잔디깎이 줄무늬), 'wood'(숲 바닥: 솔잎·그늘)."""
    base = {'rough': (0.17, 0.25, 0.08), 'lawn': (0.14, 0.27, 0.06), 'wood': (0.11, 0.14, 0.06)}[kind]
    mat, nt, bsdf = new_pbr('Site_Grass_' + kind, base, 0.93, Sheen_Weight=0.35, Sheen_Tint=(0.7, 0.9, 0.5, 1.0))
    co = _site_coords(nt)
    patch = _site_noise(nt, co, 0.035 if kind != 'lawn' else 0.02, 4.0, 0.6)
    if kind == 'wood':
        col = _site_ramp(nt, patch, [(0.35, (0.08, 0.13, 0.05)), (0.6, (0.20, 0.16, 0.09))])
    elif kind == 'lawn':
        col = _site_ramp(nt, patch, [(0.3, (0.11, 0.24, 0.05)), (0.7, (0.17, 0.30, 0.07))])
        x, _, _ = _site_xyz(nt, co)                         # 깎은 줄: x 방향 6 m 폭 띠 (축과 나란히)
        tri = _site_math(nt, 'ABSOLUTE', _site_math(nt, 'SUBTRACT', _site_math(nt, 'FRACT', _site_math(
            nt, 'DIVIDE', x, 12.0)), 0.5))
        stripe = _site_maprange(nt, tri, 0.22, 0.28)
        col = mix_color(nt, _site_math(nt, 'MULTIPLY', stripe, 0.4), col, (0.27, 0.38, 0.12), 'MIX')
        link(nt, _site_maprange(nt, stripe, 0.0, 1.0, 0.95, 0.8), bsdf.inputs['Roughness'])
    else:
        col = _site_ramp(nt, patch, [(0.3, (0.10, 0.20, 0.05)), (0.62, (0.20, 0.27, 0.08)), (0.85, (0.30, 0.28, 0.13))])
    fine = _site_noise(nt, co, 4.0, 3.0, 0.7)
    clump = _site_noise(nt, co, 0.7, 3.0, 0.6)                   # 잔디 포기 얼룩 (가까이서 보이는 결)
    blade = _site_voronoi(nt, _site_coords(nt, (1.0, 1.0, 0.2)), 55.0).outputs['Distance']
    col = mix_color(nt, 0.3, col, fine, 'OVERLAY')
    col = mix_color(nt, 0.4, col, clump, 'OVERLAY')
    col = mix_color(nt, 0.3, col, _site_ramp(nt, blade, [(0.0, (0.55, 0.6, 0.45)), (0.5, (1.0, 1.0, 1.0))]), 'MULTIPLY')
    link(nt, col, bsdf.inputs['Base Color'])
    h = _site_math(nt, 'ADD', _site_math(nt, 'MULTIPLY', fine, 0.6), blade)
    _site_bump(nt, bsdf, h, 0.45, 0.02)
    return mat


def _site_mat_paving(name, c1, c2, mortar, tile, rough=0.8, speckle=0.25):
    """벽돌 무늬 포장 (윗면, Object XY). tile = (길이, 폭) m."""
    avg = tuple((a + b) / 2 * 0.95 for a, b in zip(c1, c2))
    mat, nt, bsdf = new_pbr(name, avg, rough)
    co = _site_coords(nt)
    br = node(nt, 'ShaderNodeTexBrick', offset=0.5, offset_frequency=2, Scale=1.0, Mortar_Size=0.012 * tile[0] / 0.6,
              Mortar_Smooth=0.1, Bias=0.0, Brick_Width=tile[0], Row_Height=tile[1])
    br.inputs['Color1'].default_value = (*c1, 1.0)
    br.inputs['Color2'].default_value = (*c2, 1.0)
    br.inputs['Mortar'].default_value = (*mortar, 1.0)
    link(nt, co, br.inputs['Vector'])
    grime = _site_noise(nt, co, 0.08, 4.0, 0.6)
    col = mix_color(nt, 0.35, br.outputs['Color'], grime, 'OVERLAY')
    sp = _site_voronoi(nt, co, 40.0)
    col = mix_color(nt, speckle, col, _site_ramp(nt, sp.outputs['Distance'], [(0.0, (0.3, 0.3, 0.3)), (0.2, (1, 1, 1))]),
                    'MULTIPLY')
    link(nt, col, bsdf.inputs['Base Color'])
    link(nt, _site_maprange(nt, grime, 0.3, 0.7, rough - 0.12, rough + 0.08), bsdf.inputs['Roughness'])
    _site_bump(nt, bsdf, _site_math(nt, 'MULTIPLY', br.outputs['Factor'], -1.0), 0.4, 0.015)
    return mat


def _site_mat_asphalt():
    mat, nt, bsdf = new_pbr('Site_Asphalt', (0.075, 0.075, 0.08), 0.82)
    co = _site_coords(nt)
    patch = _site_noise(nt, co, 0.05, 4.0, 0.6)
    col = _site_ramp(nt, patch, [(0.3, (0.055, 0.056, 0.06)), (0.7, (0.11, 0.11, 0.115))])
    agg = _site_voronoi(nt, co, 60.0)
    col = mix_color(nt, 0.3, col, _site_ramp(nt, agg.outputs['Distance'], [(0.0, (0.5, 0.5, 0.5)), (0.25, (1, 1, 1))]),
                    'MULTIPLY')
    link(nt, col, bsdf.inputs['Base Color'])
    link(nt, _site_maprange(nt, patch, 0.3, 0.7, 0.72, 0.9), bsdf.inputs['Roughness'])
    _site_bump(nt, bsdf, agg.outputs['Distance'], 0.25, 0.01)
    return mat


def _site_mat_water(name, deep, pool=False):
    """물: 한강(탁한 녹회색, 불투명·반사) 또는 분수(맑은 청록, 투과 — 바닥 타일이 비침). 잔물결은 범프."""
    extra = {'Transmission_Weight': 0.85} if pool else {}
    mat, nt, bsdf = new_pbr(name, deep, 0.03, IOR=1.333, Specular_IOR_Level=1.0 if not pool else 0.6, **extra)
    co = _site_coords(nt, (1.0, 1.0, 1.0))
    swell = _site_noise(nt, co, 0.02 if not pool else 0.3, 3.0, 0.5)
    wv = node(nt, 'ShaderNodeTexWave', Scale=0.25 if not pool else 1.5, Distortion=8.0, Detail=3.0)
    wv.wave_type = 'RINGS' if pool else 'BANDS'
    wv.rings_direction = 'SPHERICAL'
    link(nt, co, wv.inputs['Vector'])
    h = _site_math(nt, 'ADD', swell, _site_math(nt, 'MULTIPLY', wv.outputs['Factor'], 0.35))
    if not pool:
        chop = _site_noise(nt, _site_coords(nt, (1.0, 3.0, 1.0)), 1.2, 4.0, 0.6)
        h = _site_math(nt, 'ADD', h, _site_math(nt, 'MULTIPLY', chop, 0.4))
        col = _site_ramp(nt, swell, [(0.3, deep), (0.7, tuple(c * 1.35 for c in deep))])
        link(nt, col, bsdf.inputs['Base Color'])
    _site_bump(nt, bsdf, h, 0.1 if not pool else 0.08, 0.05)
    if pool:                                  # 투과로 바닥 타일이 비쳐 렌더에서는 어두운 청회색 — 웹 대표색도 그렇게
        set_flat(mat, color=[0.06, 0.14, 0.17])
    return mat


def _site_mat_spray(night):
    """물줄기·물보라: 흰빛 반투명 (밤에는 수중등을 받아 은은히 빛남)."""
    mat, nt, bsdf = new_pbr('Site_Water_Spray', (0.86, 0.92, 0.96), 0.3, Transmission_Weight=0.55, Alpha=0.6,
                            IOR=1.33, emission=(0.75, 0.88, 1.0) if night else None,
                            emission_strength=0.3 if night else 0.0)
    co = _site_coords(nt, (3.0, 3.0, 0.8))
    n = _site_noise(nt, co, 2.0, 3.0, 0.6)
    link(nt, _site_maprange(nt, n, 0.3, 0.7, 0.35, 0.85), bsdf.inputs['Alpha'])
    _site_bump(nt, bsdf, n, 0.5, 0.05)
    set_flat(mat, color=[0.80, 0.86, 0.90])
    return mat


def _site_mat_bark(pine):
    """나무껍질. 소나무(적송)는 아랫부분 회갈색 거북등 → 위로 갈수록 붉은 주황 (로컬 z)."""
    base = (0.26, 0.15, 0.10) if pine else (0.17, 0.14, 0.12)
    mat, nt, bsdf = new_pbr('Site_Bark_Pine' if pine else 'Site_Bark', base, 0.9)
    co = _site_coords(nt, (3.0, 3.0, 0.6))
    n = _site_noise(nt, co, 4.0, 4.0, 0.7)
    lo = _site_ramp(nt, n, [(0.3, (0.10, 0.08, 0.07)), (0.7, (0.24, 0.20, 0.17))])
    if pine:
        _, _, z = _site_xyz(nt, _site_coords(nt))
        hi = _site_ramp(nt, n, [(0.3, (0.32, 0.12, 0.06)), (0.7, (0.55, 0.26, 0.13))])
        lo = mix_color(nt, _site_maprange(nt, z, 2.5, 5.5), lo, hi, 'MIX')
    link(nt, lo, bsdf.inputs['Base Color'])
    _site_bump(nt, bsdf, n, 0.8, 0.03)
    return mat


def _site_mat_leaf(name, base, hue_jitter=0.03):
    """잎: 덩어리 사이 그늘(보로노이) + 나무마다 색조·명도 흔들기 (Object Info 난수)."""
    mat, nt, bsdf = new_pbr(name, base, 0.75, Sheen_Weight=0.25, Sheen_Tint=(0.8, 1.0, 0.6, 1.0))
    co = _site_coords(nt)
    vo = _site_voronoi(nt, co, 7.0)                              # 잎 뭉치 (약 15 cm 칸) — 사이는 그늘
    shade = _site_ramp(nt, vo.outputs['Distance'], [(0.0, (1.0, 1.0, 1.0)), (0.8, (0.5, 0.5, 0.5))])
    fine = _site_noise(nt, co, 3.5, 3.0, 0.6)
    clump = _site_noise(nt, co, 0.9, 3.0, 0.6)                   # 덩어리 사이 큰 그늘·밝은 끝
    col = mix_color(nt, 0.3, base, fine, 'OVERLAY')
    col = mix_color(nt, 0.4, col, clump, 'OVERLAY')
    col = mix_color(nt, 0.6, col, shade, 'MULTIPLY')
    info = nt.nodes.new('ShaderNodeObjectInfo')
    hsv = node(nt, 'ShaderNodeHueSaturation', Saturation=1.0)
    link(nt, _site_maprange(nt, info.outputs['Random'], 0.0, 1.0, 0.5 - hue_jitter, 0.5 + hue_jitter), hsv.inputs['Hue'])
    link(nt, _site_maprange(nt, info.outputs['Random'], 0.0, 1.0, 0.8, 1.2), hsv.inputs['Value'])
    link(nt, col, hsv.inputs['Color'])
    link(nt, hsv.outputs['Color'], bsdf.inputs['Base Color'])
    h = _site_math(nt, 'ADD', vo.outputs['Distance'], _site_math(nt, 'MULTIPLY', clump, 1.5))
    _site_bump(nt, bsdf, h, 0.7, 0.1)
    return mat


def _site_mat_simple(name, color, rough=0.6, metal=0.0, noise_scale=None, emission=None, strength=0.0, **extra):
    """단색에 가까운 재질 (얼룩 노이즈 선택)."""
    mat, nt, bsdf = new_pbr(name, color, rough, metal, emission, strength, **extra)
    if noise_scale:
        n = _site_noise(nt, _site_coords(nt), noise_scale, 4.0, 0.6)
        col = _site_ramp(nt, n, [(0.3, tuple(c * 0.82 for c in color)), (0.7, tuple(min(1.0, c * 1.15) for c in color))])
        link(nt, col, bsdf.inputs['Base Color'])
        _site_bump(nt, bsdf, n, 0.15, 0.05)
    return mat


def _site_mat_hedge():
    mat, nt, bsdf = new_pbr('Site_Hedge', (0.06, 0.14, 0.045), 0.8, Sheen_Weight=0.3)
    co = _site_coords(nt)
    vo = _site_voronoi(nt, co, 9.0)
    n = _site_noise(nt, co, 1.5, 3.0, 0.6)
    col = _site_ramp(nt, n, [(0.3, (0.04, 0.10, 0.03)), (0.7, (0.09, 0.19, 0.05))])
    col = mix_color(nt, 0.6, col, _site_ramp(nt, vo.outputs['Distance'], [(0.0, (1, 1, 1)), (0.8, (0.5, 0.5, 0.5))]),
                    'MULTIPLY')
    link(nt, col, bsdf.inputs['Base Color'])
    _site_bump(nt, bsdf, vo.outputs['Distance'], 0.8, 0.08)
    return mat


def _site_mat_flowers():
    """꽃밭: 초록 바탕에 분홍·빨강·흰 꽃점 (보로노이 칸 색)."""
    mat, nt, bsdf = new_pbr('Site_Flowerbed', (0.30, 0.20, 0.16), 0.8)
    co = _site_coords(nt)
    vo = _site_voronoi(nt, co, 9.0)
    r, g, _ = _site_xyz(nt, vo.outputs['Color'])
    petal = _site_ramp(nt, r, [(0.0, (0.75, 0.08, 0.12)), (0.4, (0.85, 0.35, 0.55)), (0.75, (0.9, 0.88, 0.85))])
    is_flower = _site_math(nt, 'LESS_THAN', vo.outputs['Distance'], 0.3)
    col = mix_color(nt, _site_math(nt, 'MULTIPLY', is_flower, _site_math(nt, 'GREATER_THAN', g, 0.3)),
                    (0.07, 0.15, 0.04), petal, 'MIX')
    link(nt, col, bsdf.inputs['Base Color'])
    _site_bump(nt, bsdf, vo.outputs['Distance'], 0.6, 0.05)
    return mat


def _site_mat_track():
    """운동장 트랙: 붉은 갈색 우레탄 (고운 알갱이)."""
    mat, nt, bsdf = new_pbr('Site_Track', (0.36, 0.12, 0.07), 0.85)
    co = _site_coords(nt)
    sp = _site_voronoi(nt, co, 80.0)
    n = _site_noise(nt, co, 0.1, 3.0, 0.5)
    col = _site_ramp(nt, n, [(0.3, (0.30, 0.10, 0.06)), (0.7, (0.42, 0.15, 0.09))])
    col = mix_color(nt, 0.25, col, _site_ramp(nt, sp.outputs['Distance'], [(0.0, (0.6, 0.6, 0.6)), (0.3, (1, 1, 1))]),
                    'MULTIPLY')
    link(nt, col, bsdf.inputs['Base Color'])
    _site_bump(nt, bsdf, sp.outputs['Distance'], 0.3, 0.01)
    return mat


def _site_mat_city(name, base, night, lit=0.0, glass=(0.06, 0.08, 0.10)):
    """먼 도시 땅·바깥 건물: 블록 얼룩(보로노이 칸). lit > 0 이면 층 띠 창 (3.6 m 층의 아래 절반이 유리 띠).
    밤에는 벽을 어둡게 해(달빛에 흰 줄무늬 상자로 뜨지 않게) 어두운 매스에 창 칸(3 x 1.8 m)의 약 5분의 1 만 따뜻하게
    켭니다 (세기는 칸마다 0.35·lit..lit) — 35_landmarks 의 이웃 건물과 같은 인상. 지붕은 창 띠에서 뺍니다.
    멀리 강 건너 블록은 밝고 푸르스름한 base·glass 로 공기 원근을 흉내 냅니다."""
    wall = tuple(c * 0.3 for c in base) if lit and night else base
    avg = tuple(0.6 * c + 0.4 * g for c, g in zip(wall, glass)) if lit else wall   # 유리 띠를 섞은 평균 = 웹 대표색
    mat, nt, bsdf = new_pbr(name, avg, 0.85)
    co = _site_coords(nt)
    vo = _site_voronoi(nt, co, 0.012 if not lit else 0.05)
    col = _site_ramp(nt, _site_xyz(nt, vo.outputs['Color'])[0],
                     [(0.0, tuple(c * 0.8 for c in wall)), (0.5, wall), (1.0, tuple(min(1.0, c * 1.25) for c in wall))])
    if lit:
        x, y, z = _site_xyz(nt, co)
        band = _site_math(nt, 'LESS_THAN', _site_math(nt, 'FRACT', _site_math(nt, 'DIVIDE', z, 3.6)), 0.5)
        up = _site_xyz(nt, nt.nodes.new('ShaderNodeNewGeometry').outputs['Normal'])[2]
        band = _site_math(nt, 'MULTIPLY', band, _site_math(nt, 'LESS_THAN', _site_math(nt, 'ABSOLUTE', up), 0.5))  # 지붕 제외
        col = mix_color(nt, _site_math(nt, 'MULTIPLY', band, 0.8), col, glass, 'MIX')
        if night:
            u = _site_math(nt, 'DIVIDE', _site_math(nt, 'ADD', x, y), 3.0)           # 창 칸 3 m x 층 3.6 m
            cells = node(nt, 'ShaderNodeCombineXYZ')
            link(nt, _site_math(nt, 'FLOOR', u), cells.inputs['X'])
            link(nt, _site_math(nt, 'FLOOR', _site_math(nt, 'DIVIDE', z, 3.6)), cells.inputs['Y'])
            wn = nt.nodes.new('ShaderNodeTexWhiteNoise')
            link(nt, cells.outputs['Vector'], wn.inputs['Vector'])
            g = wn.outputs['Value']
            frame = _site_math(nt, 'LESS_THAN', _site_math(nt, 'ABSOLUTE', _site_math(
                nt, 'SUBTRACT', _site_math(nt, 'FRACT', u), 0.5)), 0.4)                  # 칸 사이 창틀 (0.6 m)
            on = _site_math(nt, 'MULTIPLY', _site_math(nt, 'MULTIPLY', band, frame), _site_math(nt, 'GREATER_THAN', g, 0.8))
            bsdf.inputs['Emission Color'].default_value = (1.0, 0.76, 0.48, 1.0)
            link(nt, _site_math(nt, 'MULTIPLY', on, _site_maprange(nt, g, 0.8, 1.0, 0.35 * lit, lit)),
                 bsdf.inputs['Emission Strength'])
            set_flat(mat, emission=[1.0, 0.76, 0.48], emission_strength=0.06 * lit)
    link(nt, col, bsdf.inputs['Base Color'])
    return mat


def _site_mat_bronze():
    """조각 청동: 짙은 갈색 금속, 오목한 곳에 녹청."""
    mat, nt, bsdf = new_pbr('Site_Bronze_Sculpture', (0.11, 0.08, 0.05), 0.42, 0.85)
    co = _site_coords(nt)
    n = _site_noise(nt, co, 3.0, 4.0, 0.6)
    col = _site_ramp(nt, n, [(0.35, (0.08, 0.055, 0.035)), (0.6, (0.16, 0.11, 0.06)), (0.8, (0.14, 0.20, 0.16))])
    link(nt, col, bsdf.inputs['Base Color'])
    link(nt, _site_maprange(nt, n, 0.6, 0.85, 0.85, 0.3), bsdf.inputs['Metallic'])
    _site_bump(nt, bsdf, n, 0.3, 0.02)
    return mat


def _site_materials(ctx):
    """부지 전용 재질 dict (ctx.material 캐시). 밤이면 가로등·수중등·물줄기·먼 창이 빛납니다."""
    night = ctx.night
    m = ctx.material
    lamp_emit = (1.0, 0.72, 0.42) if night else None
    return {
        'grass': m('site_grass', lambda: _site_mat_grass('rough')),
        'lawn': m('site_lawn', lambda: _site_mat_grass('lawn')),
        'woodfloor': m('site_woodfloor', lambda: _site_mat_grass('wood')),
        'granite_pave': m('site_granite_pave', lambda: _site_mat_paving(
            'Site_Paving_Granite', (0.66, 0.64, 0.60), (0.58, 0.56, 0.53), (0.36, 0.35, 0.33), (1.2, 0.6), 0.7)),
        'path': m('site_path', lambda: _site_mat_paving(
            'Site_Paving_Path', (0.55, 0.49, 0.45), (0.47, 0.43, 0.41), (0.25, 0.24, 0.23), (0.4, 0.2), 0.8)),
        'setts': m('site_setts', lambda: _site_mat_paving(
            'Site_Paving_Setts', (0.42, 0.42, 0.42), (0.34, 0.34, 0.35), (0.18, 0.18, 0.18), (0.2, 0.1), 0.8, 0.4)),
        'asphalt': m('site_asphalt', _site_mat_asphalt),
        'paint': m('site_paint', lambda: _site_mat_simple('Site_Paint_White', (0.78, 0.78, 0.75), 0.55)),
        'paint_y': m('site_paint_y', lambda: _site_mat_simple('Site_Paint_Yellow', (0.80, 0.56, 0.06), 0.55)),
        'curb': m('site_curb', lambda: _site_mat_simple('Site_Curb', (0.60, 0.59, 0.56), 0.7, noise_scale=1.5)),
        'river': m('site_river', lambda: _site_mat_water('Site_Water_River', (0.035, 0.06, 0.05))),
        'pool': m('site_pool', lambda: _site_mat_water('Site_Water_Pool', (0.10, 0.26, 0.30), pool=True)),
        'pool_floor': m('site_pool_floor', lambda: _site_mat_paving(
            'Site_Pool_Floor', (0.38, 0.52, 0.56), (0.33, 0.47, 0.52), (0.55, 0.6, 0.6), (0.3, 0.3), 0.4, 0.1)),
        'spray': m('site_spray', lambda: _site_mat_spray(night)),
        'bank': m('site_bank', lambda: _site_mat_paving(
            'Site_Revetment', (0.40, 0.39, 0.36), (0.33, 0.32, 0.30), (0.2, 0.2, 0.19), (1.6, 0.8), 0.9, 0.3)),
        'riverbed': m('site_riverbed', lambda: _site_mat_simple('Site_Riverbed', (0.06, 0.06, 0.05), 0.9)),
        'bark': m('site_bark', lambda: _site_mat_bark(False)),
        'bark_pine': m('site_bark_pine', lambda: _site_mat_bark(True)),
        'leaf_pine': m('site_leaf_pine', lambda: _site_mat_leaf('Site_Leaf_Pine', (0.05, 0.12, 0.05), 0.02)),
        'leaf_cherry': m('site_leaf_cherry', lambda: _site_mat_leaf('Site_Leaf_Cherry', (0.09, 0.19, 0.05))),
        'leaf_zelkova': m('site_leaf_zelkova', lambda: _site_mat_leaf('Site_Leaf_Zelkova', (0.11, 0.21, 0.06))),
        'leaf_ginkgo': m('site_leaf_ginkgo', lambda: _site_mat_leaf('Site_Leaf_Ginkgo', (0.15, 0.25, 0.06))),
        'hedge': m('site_hedge', _site_mat_hedge),
        'flowers': m('site_flowers', _site_mat_flowers),
        'soil': m('site_soil', lambda: _site_mat_simple('Site_Soil', (0.12, 0.09, 0.06), 0.95, noise_scale=2.0)),
        'track': m('site_track', _site_mat_track),
        'bronze': m('site_bronze', _site_mat_bronze),
        'pole': m('site_pole', lambda: _site_mat_simple('Site_Lamp_Pole', (0.06, 0.065, 0.07), 0.6, 0.3)),
        'globe': m('site_globe', lambda: _site_mat_simple(
            'Site_Lamp_Globe', (0.86, 0.85, 0.80), 0.3, emission=lamp_emit, strength=4.5 if night else 0.0,
            Transmission_Weight=0.3)),
        'luminaire': m('site_luminaire', lambda: _site_mat_simple(
            'Site_Luminaire', (0.80, 0.80, 0.78), 0.3, emission=(1.0, 0.86, 0.66) if night else None,
            strength=25.0 if night else 0.0)),
        'uplight': m('site_uplight', lambda: _site_mat_simple(
            'Site_Pool_Light', (0.75, 0.80, 0.82), 0.2, emission=(0.8, 0.9, 1.0) if night else None,
            strength=40.0 if night else 0.0)),
        'fence': m('site_fence', lambda: _site_mat_simple('Site_Fence', (0.80, 0.80, 0.78), 0.4, 0.3)),
        'bench': m('site_bench', lambda: _site_mat_simple('Site_Bench_Wood', (0.30, 0.19, 0.11), 0.6, noise_scale=6.0)),
        'city': m('site_city', lambda: _site_mat_city('Site_City_Ground', (0.24, 0.24, 0.22), night)),
        'context': m('site_context', lambda: _site_mat_city('Site_Context_Buildings', (0.58, 0.57, 0.55), night, 0.7)),
        'skyline': m('site_skyline', lambda: _site_mat_city('Site_Far_City', (0.42, 0.46, 0.52), night, 1.0,
                                                             (0.27, 0.31, 0.38))),
        'granite': ctx.mats['granite'],
        # 분수 돌림띠: 둥근 면이라 공유 화강석의 사각 줄눈이 어색해서, 같은 색의 줄눈 없는 화강석
        'fountain_stone': m('site_fountain_stone', lambda: _site_mat_simple(
            'Site_Fountain_Granite', tuple(ctx.mats['granite']['na_flat']['color']), 0.6, noise_scale=3.0)),
    }


# --- 지형 · 한강 ------------------------------------------------------------------

def _site_ground_kind(x, y):
    """바탕 땅 칸의 재질: 국회대로 남쪽 시가지는 도시 바닥, 나머지(캠퍼스·둔치·샛강 공원)는 풀."""
    return 'city' if y < -424.0 else 'grass'


def _site_grid_lines(a, b, step, extra=()):
    return sorted(set([a + step * i for i in range(int((b - a) / step) + 1)] + [b] + [v for v in extra if a < v < b]))


def _site_ground(mt, coll):
    """부지 바닥: 25 m 칸 평면(물가에서 잘림) + 의원동산 변위 격자 + 호안 + 강물 + 먼 땅(도시)·건너편 물가."""
    x0, x1, y0, y1 = SITE_GROUND
    mx0, mx1, my0, my1 = SITE_MOUND_BOX
    m = _SiteMesh('Site_Ground', [mt['grass'], mt['city'], mt['woodfloor']])
    bank_top = SITE_BANK[0][0]
    xs = _site_grid_lines(x0, x1, 25.0, (mx0, mx1))
    ys = _site_grid_lines(y0, y1, 25.0, (my0, my1))
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            a, b, c, d = xs[i], xs[i + 1], ys[j], ys[j + 1]
            if mx0 <= a and b <= mx1 and my0 <= c and d <= my1:
                continue                                     # 의원동산 격자가 덮음
            cell = _site_land_clip([(a, c), (b, c), (b, d), (a, d)], bank_top)
            if len(cell) >= 3:
                m.poly(cell, SITE_Z_BASE, 1 if _site_ground_kind((a + b) / 2, (c + d) / 2) == 'city' else 0)
    _site_mound_grid(m)
    # 먼 땅: 부지 사각형 둘레 네 조각 + 강 건너편 — 물가 SITE_PARK_W 는 둔치 풀밭, 그 너머는 도시 바닥
    F = SITE_FAR
    nx, ny = SITE_RIVER_N
    pn = SITE_RIVER_P[0] * nx + SITE_RIVER_P[1] * ny
    for rect in (((-F, -F), (x0, -F), (x0, F), (-F, F)), ((x1, -F), (F, -F), (F, F), (x1, F)),
                 ((x0, -F), (x1, -F), (x1, y0), (x0, y0)), ((x0, y1), (x1, y1), (x1, F), (x0, F))):
        land = _site_land_clip(list(rect), bank_top)
        m.poly(_site_land_clip(land, -SITE_PARK_W), SITE_Z_BASE, 1)
        m.poly(_site_clip(land, -nx, -ny, SITE_PARK_W - pn), SITE_Z_BASE, 0)
    far = _site_clip([(-F, -F), (F, -F), (F, F), (-F, F)], -nx, -ny, -(SITE_RIVER_W - bank_top + pn))
    m.poly(_site_land_clip(far, SITE_RIVER_W + SITE_PARK_W), SITE_Z_BASE, 0)
    m.poly(_site_clip(far, -nx, -ny, -(SITE_RIVER_W + SITE_PARK_W + pn)), SITE_Z_BASE, 1)
    obj = m.finish(coll)
    _site_river(mt, coll)
    return obj


def _site_mound_grid(m):
    """의원동산: ground_z 를 따르는 5 m 격자. 숲 안은 숲 바닥(솔잎), 잔디 마당과 나머지는 풀."""
    mx0, mx1, my0, my1 = SITE_MOUND_BOX
    wx0, wx1, wy0, wy1 = SITE_MOUND_WOODS
    yx0, yx1, yy0, yy1 = SITE_YARD
    xs = _site_grid_lines(mx0, mx1, 5.0, (wx0, yx0, yx1))
    ys = _site_grid_lines(my0, my1, 5.0, (wy0, wy1, yy0, yy1))
    rows = [[m.bm.verts.new((x, y, ground_z(x, y) + SITE_Z_BASE)) for x in xs] for y in ys]
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            in_yard = yx0 < cx < yx1 and yy0 < cy < yy1
            mi = 2 if (wx0 < cx < wx1 and wy0 < cy < wy1 and not in_yard) else 0
            f = m.bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
            f.material_index = mi
            f.smooth = True


def _site_river(mt, coll):
    """한강: 호안 경사(풀 → 돌 블록) 양쪽 물가, 수면, 강바닥. 물가선은 진동 방향 직선 (OSM 물 윤곽 근사)."""
    m = _SiteMesh('Site_Han_River_Banks', [mt['grass'], mt['bank']])
    F = SITE_FAR * 1.5
    for s0, flip in ((0.0, False), (SITE_RIVER_W, True)):
        prof = [(s0 + (-s if flip else s), z + SITE_Z_BASE) for s, z in SITE_BANK]
        for k in range(len(prof) - 1):
            (sa, za), (sb, zb) = prof[k], prof[k + 1]
            (pa, d), (pb, _) = _site_river_line(sa), _site_river_line(sb)
            quad = [(pa[0] - d[0] * F, pa[1] - d[1] * F, za), (pa[0] + d[0] * F, pa[1] + d[1] * F, za),
                    (pb[0] + d[0] * F, pb[1] + d[1] * F, zb), (pb[0] - d[0] * F, pb[1] - d[1] * F, zb)]
            f = m.face(quad if not flip else quad[::-1], 0 if k == 0 else 1)
            f.normal_update()
            if f.normal.z < 0:
                f.normal_flip()
    m.finish(coll)
    w = _SiteMesh('Site_Han_River', [mt['river'], mt['riverbed']])
    (pa, d), (pb, _) = _site_river_line(-2.0), _site_river_line(SITE_RIVER_W + 2.0)
    w.poly([(pa[0] - d[0] * F, pa[1] - d[1] * F), (pa[0] + d[0] * F, pa[1] + d[1] * F),
            (pb[0] + d[0] * F, pb[1] + d[1] * F), (pb[0] - d[0] * F, pb[1] - d[1] * F)], SITE_WATER_Z, 0)
    w.poly([(-F, -F), (F, -F), (F, F), (-F, F)], -3.6, 1)
    w.finish(coll)


# --- 차로 윤곽 — 아스팔트 그리기와 '차로 위인가' 검사(가로등·나무·건물 자리)가 같은 자료를 씁니다 -------------

def _site_road_shapes():
    """모든 차로의 아스팔트: (사각형 [(x0, x1, y0, y1, z)], 띠 [(점 목록, 폭, z, 닫힘, 언덕 따름)]).
    겹치는 교차부는 윗면을 몇 mm 씩 달리해 같은 평면이 겹치지 않게 합니다 (Cycles 에서 검은 얼룩 방지)."""
    cy0, cy1 = SITE_CROSS_Y
    lx0, lx1 = SITE_LAWN_DRIVE_X
    fy0, fy1 = SITE_FRONT_DRIVE_Y
    gx0, gx1 = SITE_GATE_DRIVE_X
    sx0, sx1 = SITE_SIDE_DRIVE_X
    yc, w = SITE_GUKHOE
    (ca, cb), cw, yend = SITE_UISADANG
    rects = [(-308.0, 391.0, cy0, cy1, 0.0),                   # 가로 차로 (의원회관 ↔ 의정관 쪽)
             (-lx1, 216.0, fy0, fy1, 0.0),                     # 앞 가로 차로 (도서관 옆 길까지)
             (208.5, 215.5, fy1, cy0, 0.0),                    # 도서관 ↔ 의정관 사이 길
             (-191.0, 128.0, 117.0, 125.0, 0.0),               # 뒷길
             (-2500.0, 2500.0, yc - w / 2, yc + w / 2, 0.0),   # 국회대로
             (-425.0, -170.0, -515.0, -507.0, 0.0)]            # 여의서로1길 (여의서로 바깥 차로에 닿게)
    rects += [(c - cw / 2, c + cw / 2, yend, yc - w / 2, 0.0) for c in (ca, cb)]            # 의사당대로
    rects += [(ca + cw / 2, cb - cw / 2, u0, u1, 0.0) for u0, u1 in SITE_UTURNS + ((yc - w / 2 - 6.0, yc - w / 2),)]
    #   유턴 길 두 곳 + 가운데 녹지 코와 국회대로 사이 (교차로 안)
    rects += [(x - 5.0, x + 5.0, yb, yc - w / 2, 0.0) for x, yb in SITE_SIDE_STREETS]      # 국회대로 남쪽 골목
    ribbons = []
    for s in (-1, 1):
        rects += [(*sorted((s * lx0, s * lx1)), fy1, cy0, 0.0),              # 잔디광장 양옆 일방 차로
                  (*sorted((s * gx0, s * gx1)), yc + w / 2, fy0, 0.0)]      # 정문 1·2 차로
        sx = s * (sx0 + sx1) / 2
        ribbons += [(_site_resample([(sx, cy1), (sx, 117.0)], 5.0), sx1 - sx0, 0.0, False, True),  # 본관 옆 서비스 차로
                    (_site_smooth([(sx, 88.0), (s * 42.0, 88.0), (s * 27.0, 91.0), (s * 12.0, 99.0)]),
                     6.0, 0.008, False, False)]                                 # 뒤 회차로로 드는 길
    ribbons += [(_site_circle(-1.0, 108.0, 14.0, 40), 7.0, 0.004, True, False),  # 뒤 참관 출입구 회차로
                (_site_smooth([(126.0, 121.0), (133.0, 124.0), (137.0, 133.0)], 1), 8.0, 0.004, False, False),
                (_site_smooth(list(SITE_REAR_LOOP)), 7.0, 0.008, False, False),  # 운동장·숲을 두르는 뒤 순환길
                (_site_smooth([(-lx1, -183.0), (-130.0, -207.0), (-130.0, -240.0), (-lx1, -267.0)]),
                 6.0, 0.0, False, False)]                                        # 의원회관 차 대는 길
    ribbons += [(_site_smooth(list(pts)), wd, z, False, False) for pts, wd, _, z in SITE_YEOUI]
    return rects, ribbons


def _site_road_index(ribbons, chunk=8):
    """띠 차로를 짧은 조각 (bbox, 점 목록, 반폭) 으로 — '차로 위인가' 검사를 빠르게."""
    out = []
    for pts, w, _, closed, _ in ribbons:
        seq = list(pts) + ([pts[0]] if closed else [])
        for i in range(0, len(seq) - 1, chunk):
            part = seq[i:i + chunk + 1]
            xs, ys = [p[0] for p in part], [p[1] for p in part]
            out.append(((min(xs) - w / 2, max(xs) + w / 2, min(ys) - w / 2, max(ys) + w / 2), part, w / 2))
    return out


SITE_ROADS = _site_road_shapes()
SITE_ROAD_INDEX = _site_road_index(SITE_ROADS[1])


def _site_on_road(x, y, margin=0.0):
    """(x, y) 가 차로 아스팔트 위이거나 그 가장자리에서 margin m 안인지."""
    for x0, x1, y0, y1, _ in SITE_ROADS[0]:
        if x0 - margin <= x <= x1 + margin and y0 - margin <= y <= y1 + margin:
            return True
    for (x0, x1, y0, y1), pts, half in SITE_ROAD_INDEX:
        if x0 - margin <= x <= x1 + margin and y0 - margin <= y <= y1 + margin and \
                _site_seg_dist(x, y, pts) < half + margin:
            return True
    return False


def _site_roads(road):
    """아스팔트 (SITE_ROADS 그대로)."""
    for x0, x1, y0, y1, z in SITE_ROADS[0]:
        road.poly(_site_rect(x0, x1, y0, y1), z)
    for pts, w, z, closed, drape in SITE_ROADS[1]:
        road.ribbon(pts, w, z, closed=closed, drape=drape)


# --- 차선·연석 도우미 ------------------------------------------------------------

def _site_gapped(a, b, gaps):
    """구간 [a, b] 에서 gaps [(g0, g1), ...] 를 뺀 조각들."""
    out, cur = [], a
    for g0, g1 in sorted(gaps):
        if g1 <= cur or g0 >= b:
            continue
        if g0 > cur:
            out.append((cur, g0))
        cur = max(cur, g1)
    if cur < b:
        out.append((cur, b))
    return out


def _site_hline(m, x0, x1, y, w, z, mi, gaps=(), dash=None):
    """x 방향 선 (실선 또는 dash=(칠, 빔) 점선). 틈 gaps 는 x 구간."""
    for a, b in _site_gapped(x0, x1, gaps):
        if dash is None:
            m.poly(((a, y - w / 2), (b, y - w / 2), (b, y + w / 2), (a, y + w / 2)), z, mi)
            continue
        x = a
        while x + dash[0] <= b:
            m.poly(((x, y - w / 2), (x + dash[0], y - w / 2), (x + dash[0], y + w / 2), (x, y + w / 2)), z, mi)
            x += dash[0] + dash[1]


def _site_vline(m, y0, y1, x, w, z, mi, gaps=(), dash=None):
    """y 방향 선 (x 와 y 를 바꿔 _site_hline 과 같게)."""
    for a, b in _site_gapped(y0, y1, gaps):
        if dash is None:
            m.poly(((x - w / 2, a), (x + w / 2, a), (x + w / 2, b), (x - w / 2, b)), z, mi)
            continue
        y = a
        while y + dash[0] <= b:
            m.poly(((x - w / 2, y), (x + w / 2, y), (x + w / 2, y + dash[0]), (x - w / 2, y + dash[0])), z, mi)
            y += dash[0] + dash[1]


def _site_path_dashes(m, path, off, dash, w, z, mi):
    """굽은 길을 따라 점선 (off = 중심선에서 왼쪽 거리)."""
    for x, y, ang in _site_along(path, dash[0] + dash[1], off):
        m.obox(x, y, dash[0] / 2, w / 2, ang, z - 0.004, z, mi)


def _site_zebra(m, cx, cy, along_x, road_w, cross_w, z, mi):
    """횡단보도: 차 방향과 나란한 흰 막대 (폭 0.5, 간격 1.0) 를 차로 폭 전체에."""
    n = int(road_w / 1.0)
    for k in range(n):
        v = -road_w / 2 + 0.5 + k * (road_w - 1.0) / max(1, n - 1)
        if along_x:
            m.poly(((cx - cross_w / 2, cy + v - 0.25), (cx + cross_w / 2, cy + v - 0.25),
                    (cx + cross_w / 2, cy + v + 0.25), (cx - cross_w / 2, cy + v + 0.25)), z, mi)
        else:
            m.poly(((cx + v - 0.25, cy - cross_w / 2), (cx + v + 0.25, cy - cross_w / 2),
                    (cx + v + 0.25, cy + cross_w / 2), (cx + v - 0.25, cy + cross_w / 2)), z, mi)


def _site_mouth_span(path, cum, s0, w):
    """중심선이 거리 s0 에서 수평선(큰길 가장자리)을 지날 때 폭 w 의 양 가장자리가 그 선을 지나는 거리 (작은, 큰).
    어귀 근처는 곧다고 보고 방향을 한 번만 씁니다."""
    _, ang = _site_at(path, cum, s0)
    k = abs(math.cos(ang) / (math.sin(ang) or 1e-9))
    return s0 - k * w / 2, s0 + k * w / 2


def _site_mouth_zebra(m, path, cum, s0, road_w, setback, z, cross_w=3.6, mi=0):
    """비스듬한 어귀의 횡단보도: 차 방향과 나란한 흰 막대 (폭 0.5, 간격 1.0) 를 차로 폭 전체에. 막대마다 자기 줄이
    큰길 가장자리를 지나는 곳에서 setback 만큼 (길을 따라) 떨어뜨려, 줄무늬 끝이 큰길 가장자리와 나란합니다."""
    (px, py), ang = _site_at(path, cum, s0)
    dx, dy = math.cos(ang), math.sin(ang)
    k = dx / (dy or 1e-9)
    n = int(road_w / 1.0)
    for i in range(n):
        v = -road_w / 2 + 0.5 + i * (road_w - 1.0) / max(1, n - 1)
        t = -k * v + setback
        m.obox(px + dx * t - dy * v, py + dy * t + dx * v, cross_w / 2, 0.25, ang, z - 0.004, z, mi)


def _site_strip(m, x0, x1, ya, yb, z, cuts, mi=0):
    """y ya..yb 의 띠(보도)를 x0..x1 에 깔되 cuts [((a_lo, a_hi), (b_lo, b_hi)), ...] 를 비웁니다.
    a 는 y = ya, b 는 y = yb 에서의 x 구간 — 비스듬히 들어오는 길의 어귀도 가장자리를 따라 잘립니다."""
    prev = (x0, x0)
    for (a_lo, a_hi), (b_lo, b_hi) in sorted(cuts) + [((x1, x1), (x1, x1))]:
        if a_lo > prev[0] + 0.05 and b_lo > prev[1] + 0.05:
            m.poly(((prev[0], ya), (a_lo, ya), (b_lo, yb), (prev[1], yb)), z, mi)
        prev = (max(prev[0], a_hi), max(prev[1], b_hi))


def _site_curb_x(m, x0, x1, y, gaps=()):
    for a, b in _site_gapped(x0, x1, gaps):
        m.box(a, b, y - SITE_CURB[0] / 2, y + SITE_CURB[0] / 2, -0.08, SITE_CURB[1])


def _site_curb_y(m, y0, y1, x, gaps=()):
    for a, b in _site_gapped(y0, y1, gaps):
        m.box(x - SITE_CURB[0] / 2, x + SITE_CURB[0] / 2, a, b, -0.08, SITE_CURB[1])


def _site_rect(x0, x1, y0, y1):
    return ((x0, y0), (x1, y0), (x1, y1), (x0, y1))


# --- 캠퍼스 차로 ------------------------------------------------------------------

def _site_campus_paint(paint):
    """캠퍼스 안 차로 도색: 가로 차로 노란 중앙선, 일방 차로 흰 점선, 횡단보도."""
    cy0, cy1 = SITE_CROSS_Y
    lx0, lx1 = SITE_LAWN_DRIVE_X
    fy0, fy1 = SITE_FRONT_DRIVE_Y
    gx0, gx1 = SITE_GATE_DRIVE_X
    z = SITE_Z_PAINT
    _site_hline(paint[1], -300.0, 385.0, (cy0 + cy1) / 2, 0.15, z, 0,
                gaps=((-lx1 - 1.0, -lx0 + 1.0), (lx0 - 1.0, lx1 + 1.0), (208.0, 216.0), (-3.5, 3.5)))
    _site_hline(paint[1], -lx1 + 2.0, 214.0, (fy0 + fy1) / 2, 0.15, z, 0,
                gaps=((-42.0, -33.0), (33.0, 42.0), (-3.5, 3.5), (lx0 - 1.0, lx1 + 1.0), (208.0, 216.0)))
    for s in (-1, 1):
        _site_vline(paint[0], fy1 + 2.0, cy0 - 2.0, s * (lx0 + lx1) / 2, 0.15, z, 0, gaps=((-227.0, -219.0),),
                    dash=(3.0, 5.0))
        _site_vline(paint[0], -386.0, fy0 - 2.0, s * (gx0 + gx1) / 2, 0.15, z, 0, dash=(3.0, 5.0))
        _site_zebra(paint[0], s * (lx0 + lx1) / 2, -223.0, False, lx1 - lx0, 5.0, z, 0)
    _site_zebra(paint[0], 0.0, (cy0 + cy1) / 2, True, cy1 - cy0, 6.0, z, 0)
    _site_zebra(paint[0], 0.0, (fy0 + fy1) / 2, True, fy1 - fy0, 6.0, z, 0)


def _site_campus_curbs(curb):
    cy0, cy1 = SITE_CROSS_Y
    lx0, lx1 = SITE_LAWN_DRIVE_X
    fy0, fy1 = SITE_FRONT_DRIVE_Y
    gx0, gx1 = SITE_GATE_DRIVE_X
    sx0, sx1 = SITE_SIDE_DRIVE_X
    lawn = ((-lx1, -lx0), (lx0, lx1))
    _site_curb_x(curb, -308.0, 391.0, cy1, gaps=((-sx1, -sx0), (sx0, sx1)))
    _site_curb_x(curb, -308.0, 391.0, cy0, gaps=lawn + ((208.5, 215.5),))
    _site_curb_x(curb, -lx1, 216.0, fy1, gaps=lawn + ((208.5, 215.5),))
    _site_curb_x(curb, -lx1, 216.0, fy0, gaps=((-gx1, -gx0), (gx0, gx1)))
    for s in (-1, 1):
        for x in (lx0, lx1):
            _site_curb_y(curb, fy1, cy0, s * x)
        for x in (gx0, gx1):
            _site_curb_y(curb, SITE_GUKHOE[0] + SITE_GUKHOE[1] / 2, fy0, s * x)
    for x in (208.5, 215.5):
        _site_curb_y(curb, fy1, cy0, x, gaps=((-227.0, -217.0),))


# --- 바깥 도로 --------------------------------------------------------------------

def _site_yeoui_mouths():
    """여의서로 차로들 [(매끈한 중심선, 폭)] — 국회대로 어귀를 잘라낼 때 씁니다."""
    return [(_site_smooth(list(pts)), wd) for pts, wd, _, _ in SITE_YEOUI]


def _site_mouth_gaps(mouths, y, pad=0.0):
    """수평선 y 에서 여의서로 어귀들이 차지하는 x 구간 (pad 만큼 넓혀서)."""
    return [(g[0] - pad, g[1] + pad) for g in (_site_mouth(p, wd, y) for p, wd in mouths) if g]


def _site_mouth_cuts(mouths, ya, yb, straight=()):
    """보도 띠 ya..yb 를 비울 구간: 곧은 틈 straight [(x0, x1)] + 비스듬한 여의서로 어귀."""
    out = [((a, b), (a, b)) for a, b in straight]
    for p, wd in mouths:
        ga, gb = _site_mouth(p, wd, ya), _site_mouth(p, wd, yb)
        if ga and gb:
            out.append((ga, gb))
    return out


def _site_gukhoe(paint, curb, walk):
    """국회대로 (6차로): 도색, 양쪽 연석·보도. 의사당대로·남쪽 골목·여의서로 어귀는 보도·연석·가장자리 선을 비우고,
    정문 차로 앞은 연석만 낮춥니다(비움)."""
    yc, w = SITE_GUKHOE
    y0, y1 = yc - w / 2, yc + w / 2                    # -418.1, -391.1
    (ca, cb), cw, _ = SITE_UISADANG
    z = SITE_Z_PAINT
    mouths = _site_yeoui_mouths()
    junction = ((ca - cw / 2 - 12.0, cb + cw / 2 + 12.0),)                # 의사당대로 어귀 + 양쪽 횡단보도
    for off in (-0.15, 0.15):
        _site_hline(paint[1], -750.0, 750.0, yc + off, 0.12, z, 0, gaps=junction)
    for off in (-7.2, -3.6, 3.6, 7.2):
        _site_hline(paint[0], -750.0, 750.0, yc + off, 0.15, z, 0, gaps=junction, dash=(3.0, 5.0))
    _site_hline(paint[0], -750.0, 750.0, yc - 10.8, 0.15, z, 0,
                gaps=junction + tuple(_site_mouth_gaps(mouths, yc - 10.8, 1.0)))
    _site_hline(paint[0], -750.0, 750.0, yc + 10.8, 0.15, z, 0,
                gaps=junction + ((-44.0, -31.0), (31.0, 44.0)) + tuple(_site_mouth_gaps(mouths, yc + 10.8, 1.0)))
    for xc, sgn in ((ca - cw / 2 - 6.0, 1.0), (cb + cw / 2 + 6.0, -1.0)):
        _site_zebra(paint[0], xc, yc, True, w, 5.0, z, 0)
        stop = sorted((yc, yc - sgn * (w / 2 - 0.4)))                     # 정지선: 교차로로 들어오는 쪽 차로만 (우측통행)
        paint[0].poly(_site_rect(xc - sgn * 4.0 - 0.25, xc - sgn * 4.0 + 0.25, *stop), z)
    for x, yb in SITE_SIDE_STREETS:
        _site_vline(paint[1], yb, y0 - 6.0, x, 0.12, z, 0)
    side = [(x - 5.0, x + 5.0) for x, _ in SITE_SIDE_STREETS] + [(ca - cw / 2, cb + cw / 2)]
    gates = [(-SITE_GATE_DRIVE_X[1], -SITE_GATE_DRIVE_X[0]), SITE_GATE_DRIVE_X]
    _site_curb_x(curb, -750.0, 750.0, y1, gaps=gates + _site_mouth_gaps(mouths, y1, 0.1))
    _site_curb_x(curb, -750.0, 750.0, y0, gaps=side + _site_mouth_gaps(mouths, y0, 0.1))
    _site_strip(walk, -750.0, 750.0, y1, SITE_FENCE_Y, SITE_Z_PAVE, _site_mouth_cuts(mouths, y1, SITE_FENCE_Y))
    _site_strip(walk, -750.0, 750.0, y0 - 6.0, y0, SITE_Z_PAVE, _site_mouth_cuts(mouths, y0 - 6.0, y0, side))


def _site_uisadang(paint, curb, walk):
    """의사당대로 (두 방향 5차로씩): 차선, 어귀 횡단보도·정지선, 연석, 양쪽 보도, 가운데 녹지(유턴 길에서 끊김)."""
    y0 = SITE_GUKHOE[0] - SITE_GUKHOE[1] / 2
    (ca, cb), cw, yend = SITE_UISADANG
    z = SITE_Z_PAINT
    for c in (ca, cb):
        for off in (-4.8, -1.6, 1.6, 4.8):
            _site_vline(paint[0], -840.0, y0 - 14.0, c + off, 0.15, z, 0, dash=(3.0, 5.0))
        for off in (-8.0, 8.0):                               # 가장자리 선 — 녹지 쪽은 유턴 길에서 끊음
            inner = (off > 0) == (c == ca)
            _site_vline(paint[0], yend, y0 - 12.0, c + off - math.copysign(0.2, off), 0.15, z, 0,
                        gaps=SITE_UTURNS if inner else ())
        _site_zebra(paint[0], c, y0 - 8.0, False, cw, 5.0, z, 0)
        paint[0].poly(_site_rect(c - cw / 2, c + cw / 2, y0 - 11.3, y0 - 10.8), z)   # 정지선
    for c, s in ((ca, -1), (cb, 1)):
        xo = c + s * cw / 2
        _site_curb_y(curb, -850.0, y0, xo)
        walk.poly(_site_rect(*sorted((xo, xo + s * 6.0)), -850.0, y0 - 6.0), SITE_Z_PAVE)
    m0, m1 = ca + cw / 2, cb - cw / 2
    hc = SITE_CURB[0] / 2
    for a, b in _site_gapped(-850.0, y0 - 6.0, SITE_UTURNS):          # 가운데 녹지 (가로수 두 줄) + 둘레 연석
        walk.poly(_site_rect(m0, m1, a, b), 0.1, 1)
        for e in (m0, m1):
            _site_curb_y(curb, a - (hc if a > -850.0 else 0.0), b + hc, e)
        for yy in (b,) + ((a,) if a > -850.0 else ()):                  # 녹지 끝 연석 (코)
            curb.box(m0 + hc, m1 - hc, yy - hc, yy + hc, -0.08, SITE_CURB[1])


def _site_yeoui_paint(paint):
    """여의서로 차선: 점선·가장자리 선은 국회대로 어귀 6 m 앞에서 멈추고, 어귀마다 횡단보도(보도와 한 줄),
    캠퍼스 쪽에서 드는 차로에 정지선. 바깥 일방 3차로 + 왼쪽 두 길 (뒤 순환길은 캠퍼스 차로)."""
    yc, w = SITE_GUKHOE
    z = SITE_Z_PAINT
    for pts, width, lanes, _ in SITE_YEOUI:
        path = _site_smooth(list(pts))
        cum = _site_cumlen(path)
        s_n = _site_cross_s(path, cum, yc + w / 2)[0]                  # 국회대로 북쪽 가장자리를 지나는 곳
        s_s = _site_cross_s(path, cum, yc - w / 2)[:1]                 # 남쪽으로 건너가 이어지면 그 어귀
        n_lo = _site_mouth_span(path, cum, s_n, width)[0]
        keep = [(0.0, n_lo - 6.0)] + [(_site_mouth_span(path, cum, s, width)[1] + 6.0, cum[-1]) for s in s_s]
        for a, b in keep:
            piece = _site_cut(path, cum, a, b)
            for off in lanes:
                _site_path_dashes(paint[0], piece, off, (3.0, 5.0), 0.15, z, 0)
            for off in (-width / 2 + 0.4, width / 2 - 0.4):
                paint[0].ribbon(piece, 0.15, z, off=off)
        _site_mouth_zebra(paint[0], path, cum, s_n, width, -2.3, z)
        for s in s_s:
            _site_mouth_zebra(paint[0], path, cum, s, width, 2.3, z)
        (px, py), ang = _site_at(path, cum, n_lo - 5.0)
        paint[0].obox(px, py, 0.225, width / 2 - 0.3, ang, z - 0.004, z)   # 정지선


def _site_riverside(mt, coll):
    """한강 둔치: 물가 산책로(포장)와 자전거길 (노란 점선) — 물가선과 나란히."""
    m = _SiteMesh('Site_Riverside_Paths', [mt['asphalt'], mt['path'], mt['paint_y']])
    F = 900.0
    for s, w, mi in ((-30.0, 3.6, 0), (-17.0, 2.6, 1)):
        (px, py), (dx, dy) = _site_river_line(s)
        path = [(px - dx * F, py - dy * F), (px + dx * F, py + dy * F)]
        m.ribbon(path, w, 0.0 if mi == 0 else SITE_Z_PAVE, mi)
        if mi == 0:
            _site_path_dashes(m, path, 0.0, (2.0, 3.0), 0.12, SITE_Z_PAINT, 2)
    m.finish(coll)


# --- 잔디광장 · 앞마당 · 정문 구역 ---------------------------------------------------

def _site_lawn_block(mt, coll):
    """잔디광장: 포장 판(산책로 전체) 위에 잔디 네 칸과 가운데 띠를 얹고, 칸 둘레에 낮은 산울타리.
    포장 판이 곧 축 산책로(x ±4..8), 가로 길(y -226..-220), 둘레 길, 분수 둘레 길이 됩니다."""
    hw, yt, yb = SITE_BLOCK
    fx, fy = SITE_FOUNTAIN
    m = _SiteMesh('Site_Lawn_Plaza', [mt['path'], mt['lawn']])
    for s in (-1, 1):                                     # 포장 판 두 쪽 (가운데 분수 수반 자리를 파냄)
        half = _site_roundrect(*sorted((0.0, s * hw)), yb, yt, (6.0, 0.0, 0.0, 6.0) if s < 0 else (0.0, 6.0, 6.0, 0.0))
        m.poly(_site_minus_circle(_site_ccw(half), fx, fy, SITE_FOUNTAIN_R - 0.05), SITE_Z_PAVE, 0)
    hedges = []
    for s in (-1, 1):
        for y0, y1 in SITE_LAWN_ROWS:
            x0, x1 = sorted((s * SITE_LAWN_X[0], s * SITE_LAWN_X[1]))
            quad = _site_minus_circle(_site_roundrect(x0, x1, y0, y1, 3.0), fx, fy, SITE_RING_R)
            m.poly(quad, SITE_Z_GRASS2, 1)
            inner = _site_roundrect(x0 + 0.45, x1 - 0.45, y0 + 0.45, y1 - 0.45, 2.55)
            hedges.append(_site_minus_circle(inner, fx, fy, SITE_RING_R + 0.45))
    for y0, y1 in ((fy, SITE_LAWN_ROWS[0][1]), (SITE_LAWN_ROWS[1][0], fy)):   # 두 축 산책로 사이 잔디 띠
        m.poly(_site_minus_circle(_site_ccw(_site_rect(-4.0, 4.0, y0, y1)), fx, fy, SITE_RING_R), SITE_Z_GRASS2, 1)
    m.finish(coll)
    h = _SiteMesh('Site_Hedges', [mt['hedge']])
    prof = ((-0.35, -0.02), (-0.35, 0.40), (-0.24, 0.52), (0.24, 0.52), (0.35, 0.40), (0.35, -0.02))
    for path in hedges:
        h.sweep([(x, y) for x, y in path], [(u, z + SITE_Z_GRASS2) for u, z in prof], closed=True)
    h.finish(coll)


def _site_forecourt(mt, coll):
    """앞마당: 계단 발치~y -120.5 밝은 화강석 판, 계단 옆 차 마당(화강석 잔돌), 소나무 화단, 꽃밭."""
    hw, y_end = SITE_FORECOURT
    m = _SiteMesh('Site_Forecourt', [mt['granite_pave'], mt['setts'], mt['curb'], mt['woodfloor'], mt['flowers']])
    m.poly(_site_rect(-hw, hw, y_end, -86.0), SITE_Z_PAVE, 0)
    for s in (-1, 1):
        m.poly(_site_rect(*sorted((s * 25.0, s * SITE_SIDE_DRIVE_X[0])), -86.0, -PODIUM_Y / 2), SITE_Z_PAVE, 1)
    gx0, gx1, gy0, gy1 = SITE_GROVES
    curb = ((-0.14, -0.05), (-0.14, 0.30), (0.14, 0.30), (0.14, -0.05))
    for s in (-1, 1):
        x0, x1 = sorted((s * gx0, s * gx1))
        ring = _site_roundrect(x0, x1, gy0, gy1, 1.5)
        m.sweep(ring, curb, 2, closed=True)
        m.poly(_site_roundrect(x0 + 0.1, x1 - 0.1, gy0 + 0.1, gy1 - 0.1, 1.4), 0.2, 3)
        fx0, fx1 = sorted((s * 10.0, s * 23.0))                 # 계단 앞 꽃밭 (OSM 에서 포장 없는 칸)
        m.sweep(_site_roundrect(fx0, fx1, -112.0, -101.0, 0.8), ((-0.1, -0.05), (-0.1, 0.22), (0.1, 0.22),
                                                                  (0.1, -0.05)), 2, closed=True)
        m.poly(_site_roundrect(fx0 + 0.05, fx1 - 0.05, -111.95, -101.05, 0.75), 0.16, 4)
    m.finish(coll)


def _site_gate_zone(mt, coll):
    """정문 구역 (y -324..-388): 가운데 잔디판과 둘레 화강석 보도, 왼쪽 무궁화 광장, 오른쪽 소나무 숲 바닥."""
    m = _SiteMesh('Site_Gate_Zone', [mt['granite_pave'], mt['lawn'], mt['path'], mt['woodfloor']])
    gx0 = SITE_GATE_DRIVE_X[0]
    m.poly(_site_rect(-gx0, gx0, SITE_FENCE_Y, SITE_FRONT_DRIVE_Y[0]), SITE_Z_PAVE, 0)
    m.poly(_site_roundrect(-27.5, 27.5, -379.0, -337.0, 2.0), SITE_Z_GRASS2, 1)
    m.poly(_site_rect(-258.0, -45.0, SITE_FENCE_Y, -331.0), SITE_Z_PAVE, 2)          # 무궁화 광장
    m.poly(_site_roundrect(-255.0, -52.0, -380.0, -331.0, 3.0), SITE_Z_GRASS2, 1)
    m.poly(_site_roundrect(54.0, 158.0, -379.0, -335.0, 4.0), 0.0, 3)               # 오른쪽 소나무 숲
    m.finish(coll)


def _site_walks(mt, coll):
    """보도: 가로 차로 양쪽, 잔디광장 옆 차로 바깥, 본관 옆·뒤, 이웃 건물 앞마당."""
    m = _SiteMesh('Site_Walks', [mt['path']])
    z = SITE_Z_PAVE
    cy0, cy1 = SITE_CROSS_Y
    hw = SITE_FORECOURT[0]
    sx0, sx1 = SITE_SIDE_DRIVE_X
    lx0, lx1 = SITE_LAWN_DRIVE_X
    for a, b in _site_gapped(-300.0, 385.0, ((-hw, hw), (-sx1, -sx0), (sx0, sx1))):
        m.poly(_site_rect(a, b, cy1, cy1 + 3.0), z)
    for a, b in _site_gapped(-300.0, 385.0, ((-SITE_BLOCK[0], SITE_BLOCK[0]), (-lx1, -lx0), (lx0, lx1), (208.5, 215.5))):
        m.poly(_site_rect(a, b, cy0 - 3.0, cy0), z)
    for s in (-1, 1):
        x = s * SITE_LAWN_DRIVE_X[1]
        m.poly(_site_rect(*sorted((x, x + s * 3.2)), SITE_FRONT_DRIVE_Y[1], cy0 - 3.0), z)
    px, py, sx = PODIUM_X / 2, PODIUM_Y / 2, SITE_SIDE_DRIVE_X[0]
    m.poly(((-sx, -py), (-px, -py), (-px, py), (px, py), (px, -py), (sx, -py), (sx, 84.5), (-sx, 84.5)), z)
    for i, (x0, x1, y0, y1) in enumerate(SITE_APRONS):     # 이웃 앞마당끼리 겹치는 곳은 2 mm 씩 높여 같은 평면을 피함
        m.poly(_site_rect(x0 - 5.0, x1 + 5.0, y0 - 5.0, y1 + 5.0), z + 0.002 * i)
    for path in SITE_MOUND_PATHS:                        # 의원동산 산책로: 언덕을 따라 덮음
        m.ribbon(_site_resample(_site_smooth(list(path)), 2.5), 2.4, z, drape=True)
    m.finish(coll)


def _site_sports(mt, coll):
    """국회운동장 (X -123..32, Y 144..225): 붉은 4레인 트랙, 인조잔디 축구장과 흰 선, 골대."""
    x0, x1, y0, y1 = -123.0, 32.0, 144.0, 225.0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    half = (x1 - x0 - (y1 - y0)) / 2                            # 직선 구간 반길이
    m = _SiteMesh('Site_Sports_Field', [mt['track'], mt['lawn'], mt['paint'], mt['fence']])

    def stadium(r, n=16):
        return (_site_arc(cx + half, cy, r, -math.pi / 2, math.pi / 2, 180 / n) +
                _site_arc(cx - half, cy, r, math.pi / 2, 1.5 * math.pi, 180 / n))

    zt = SITE_Z_PAVE2 + 0.01                                     # 옆 건물 앞마당 포장보다 높게
    m.poly(_site_rect(x0, x1, y0, y1), zt, 0)
    r_in = (y1 - y0) / 2 - 0.5 - 4 * 1.22
    m.poly(stadium(r_in), zt + 0.02, 1)
    for k in range(5):
        m.ribbon(stadium(r_in + 1.22 * k), 0.05, zt + 0.01, 2, closed=True)
    zl = zt + 0.032
    ph = 28.0                                                    # 축구장 반폭 → 반길이는 반원 안에 들게
    pw = half + math.sqrt((r_in - 2.0) ** 2 - ph ** 2)
    m.ribbon(_site_rect(cx - pw, cx + pw, cy - ph, cy + ph), 0.12, zl, 2, closed=True)
    m.ribbon(((cx, cy - ph), (cx, cy + ph)), 0.12, zl, 2)
    m.ribbon(_site_circle(cx, cy, 9.15, 40), 0.12, zl, 2, closed=True)
    for s in (-1, 1):
        gx = cx + s * pw
        m.ribbon(((gx, cy - 16.0), (gx - s * 13.0, cy - 16.0), (gx - s * 13.0, cy + 16.0), (gx, cy + 16.0)),
                 0.12, zl, 2)
        for dy in (-3.66, 3.66):                                 # 골대 기둥 + 가로대
            m.box(gx - 0.06, gx + 0.06, cy + dy - 0.06, cy + dy + 0.06, 0.0, 2.44, 3)
        m.box(gx - 0.06, gx + 0.06, cy - 3.72, cy + 3.72, 2.32, 2.44, 3)
    m.finish(coll)


# --- 분수 (0, -223) ----------------------------------------------------------------

SITE_FOUNT_WATER_Z = 0.2       # 수면 (갓돌 윗면 0.6 에서 0.4 아래)
SITE_FOUNT_FLOOR_Z = -0.45     # 수반 바닥
SITE_JETS = (20, 9.0, 3.6, 4.6)   # 둘레 분사구 수, 반지름, 물줄기 높이, 떨어지는 반지름


def _site_fountain(ctx, mt, coll):
    """분수: 화강석 수반(지름 27 m, 갓돌 0.6 x 0.8 m), 물, 타일 바닥, 가운데 원통 받침(지름 6 x 3 m),
    청동 '평화와 번영의 상'(추상화한 군상), 둘레 물줄기 20개와 가운데 높은 물줄기. 밤에는 수중등."""
    fx, fy = SITE_FOUNTAIN
    R = SITE_FOUNTAIN_R
    m = _SiteMesh('Site_Fountain_Stone', [mt['fountain_stone'], mt['pool_floor'], mt['uplight']])
    bm = m.bm
    prof = [(R - 0.8, SITE_FOUNT_FLOOR_Z - 0.05), (R - 0.8, 0.55), (R - 0.76, 0.6), (R - 0.04, 0.6), (R, 0.56),
            (R, -0.08)]
    bm_lathe(bm, [(r, z) for r, z in reversed(prof)], segments=96, cx=fx, cy=fy, cap_bottom=False, cap_top=False)
    for f in bm.faces:
        f.smooth = True
    drum = [(3.7, SITE_FOUNT_FLOOR_Z), (3.7, 0.35), (3.3, 0.45), (3.0, 0.45), (3.0, 2.75), (3.25, 2.8), (3.25, 3.0),
            (2.6, 3.05), (0.0, 3.05)]
    bm_lathe(bm, drum, segments=48, cx=fx, cy=fy, cap_bottom=False, cap_top=False)
    m.poly(_site_circle(fx, fy, R - 0.78, 96), SITE_FOUNT_FLOOR_Z, 1)
    stone = set(bm.faces)                                             # 수반 안벽의 수중 조명 띠 (밤에 물이 빛남)
    bm_lathe(bm, [(R - 0.81, 0.02), (R - 0.81, -0.12)], segments=96, cx=fx, cy=fy, cap_bottom=False, cap_top=False)
    for f in bm.faces:
        if f not in stone:
            f.material_index = 2
    m.finish(coll)
    w = _SiteMesh('Site_Fountain_Water', [mt['pool']])
    w.poly(_site_circle(fx, fy, R - 0.79, 96), SITE_FOUNT_WATER_Z)
    w.finish(coll)
    crown = _site_sculpture(mt, coll, fx, fy, 3.05)
    _site_jets(ctx, mt, coll, fx, fy, crown)


def _site_tube(bm, p0, p1, r0, r1, sides=6):
    """두 점을 잇는 원뿔대 관 (뚜껑 없음) — 팔·가지·물줄기 조각."""
    d = (p1 - p0).normalized()
    u = d.orthogonal().normalized()
    v = d.cross(u)
    rings = []
    for p, r in ((p0, r0), (p1, r1)):
        rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * k / sides) + v * math.sin(2 * math.pi * k / sides)) * r)
                      for k in range(sides)])
    for k in range(sides):
        k2 = (k + 1) % sides
        bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]))


def _site_tube_path(bm, pts, radii, sides=6, cap=True):
    """점 목록을 따라 굵기가 변하는 관 (나무 줄기·물줄기). 끝은 뚜껑 (cap)."""
    rings = []
    for i, (p, r) in enumerate(zip(pts, radii)):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        u = d.orthogonal().normalized() if i == 0 else (u - d * u.dot(d)).normalized()
        v = d.cross(u)
        rings.append([bm.verts.new(p + (u * math.cos(2 * math.pi * k / sides) + v * math.sin(2 * math.pi * k / sides)) * r)
                      for k in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            k2 = (k + 1) % sides
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    if cap:
        bm.faces.new(rings[-1])
    return rings


def _site_torus(bm, cx, cy, cz, R, r, nu=40, nv=8):
    """수평 고리 (도넛)."""
    grid = [[bm.verts.new((cx + (R + r * math.cos(2 * math.pi * j / nv)) * math.cos(2 * math.pi * i / nu),
                           cy + (R + r * math.cos(2 * math.pi * j / nv)) * math.sin(2 * math.pi * i / nu),
                           cz + r * math.sin(2 * math.pi * j / nv))) for j in range(nv)] for i in range(nu)]
    for i in range(nu):
        for j in range(nv):
            a, b = grid[i], grid[(i + 1) % nu]
            bm.faces.new((a[j], b[j], b[(j + 1) % nv], a[(j + 1) % nv]))


def _site_sculpture(mt, coll, fx, fy, z0):
    """평화와 번영의 상 (김세중, 1978) — 형태 자료가 없어 추상화: 다섯 인물이 둥글게 서서 바깥으로 살짝 기울고
    두 팔로 가운데 고리와 구를 받쳐 올리는 청동 군상 (받침 윗면에서 약 5 m)."""
    bm = bmesh.new()
    bm_cylinder(bm, fx, fy, z0, 2.5, 2.4, 0.3, segments=32)              # 청동 받침판
    top = z0 + 0.3
    body = ((0.30, 0.0), (0.33, 0.6), (0.24, 1.5), (0.31, 2.2), (0.36, 2.55), (0.13, 2.72), (0.0, 2.76))
    for k in range(5):
        a = -math.pi / 2 + 2 * math.pi * k / 5
        ca, sa = math.cos(a), math.sin(a)
        px, py = fx + 1.35 * ca, fy + 1.35 * sa
        rings = bm_lathe(bm, [(r, top + z) for r, z in body], segments=8, cx=px, cy=py, cap_top=False)
        lean = (Matrix.Translation((px, py, top)) @ Matrix.Rotation(0.12, 4, Vector((-sa, ca, 0.0))) @
                Matrix.Translation((-px, -py, -top)))
        bm_transform(bm, [v for ring in rings for v in ring], lean)
        head = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.23)['verts']
        bmesh.ops.translate(bm, verts=head, vec=lean @ Vector((px, py, top + 3.0)))
        for side in (-1, 1):                                             # 두 팔: 어깨 → 가운데 고리
            shoulder = lean @ Vector((px - sa * 0.3 * side, py + ca * 0.3 * side, top + 2.45))
            hand = Vector((fx + 0.8 * math.cos(a + 0.35 * side), fy + 0.8 * math.sin(a + 0.35 * side), top + 4.2))
            _site_tube(bm, shoulder, hand, 0.11, 0.08, 6)
    _site_torus(bm, fx, fy, top + 4.35, 0.95, 0.16)
    globe = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=0.45)['verts']
    bmesh.ops.translate(bm, verts=globe, vec=(fx, fy, top + 4.35))
    finish_mesh('Site_Sculpture_Peace_Prosperity', bm, coll, mt['bronze'], smooth=True, part='site')
    return top + 4.8


def _site_jets(ctx, mt, coll, fx, fy, crown_z):
    """물줄기: 둘레 20개가 안쪽으로 포물선을 그리고(높이 3.6 m), 가운데 구 위로 높은 물줄기 하나.
    분사구 청동 고리, 밤에는 분사구 수중등(발광)과 위로 쏘는 스폿."""
    n, r0, h, r1 = SITE_JETS
    zw = SITE_FOUNT_WATER_Z
    spray = bmesh.new()
    nozz = _SiteMesh('Site_Fountain_Nozzles', [mt['bronze'], mt['uplight']])
    for k in range(n):
        a = 2 * math.pi * (k + 0.5) / n
        ca, sa = math.cos(a), math.sin(a)
        pts, radii = [], []
        for i in range(15):
            t = i / 14
            r = r0 + (r1 - r0) * t
            pts.append(Vector((fx + r * ca, fy + r * sa, zw + 4 * h * t * (1 - t) * (1 + 0.1 * t))))
            radii.append(0.045 + 0.13 * t ** 1.5)
        _site_tube_path(spray, pts, radii, 6, cap=False)
        splash = bmesh.ops.create_cone(spray, cap_ends=False, segments=8, radius1=0.45, radius2=0.08, depth=0.35)
        bmesh.ops.translate(spray, verts=splash['verts'], vec=(fx + r1 * ca, fy + r1 * sa, zw + 0.17))
        nx, ny = fx + r0 * ca, fy + r0 * sa
        nozz.prism(_site_circle(nx, ny, 0.14, 8), zw - 0.3, zw + 0.06, 0)
        nozz.poly(_site_circle(nx, ny, 0.3, 12), zw + 0.004, 1)
    col = [(0.06, 0.0), (0.10, 1.5), (0.16, 3.5), (0.26, 5.2), (0.40, 6.0), (0.34, 6.5), (0.0, 6.7)]
    bm_lathe(spray, [(r, crown_z + z) for r, z in col], segments=12, cx=fx, cy=fy, cap_bottom=False)
    finish_mesh('Site_Fountain_Jets', spray, coll, mt['spray'], smooth=True, part='site')
    nozz.finish(coll)
    if ctx.night:
        for k in range(0, n, 2):
            a = 2 * math.pi * (k + 0.5) / n
            p = (fx + r0 * math.cos(a), fy + r0 * math.sin(a), zw + 0.15)
            _site_spot(coll, f'Site_Fountain_Spot_{k:02d}', p, (fx + 5.5 * math.cos(a), fy + 5.5 * math.sin(a), 3.5),
                       350.0, (0.85, 0.93, 1.0), 55.0)
        for k in range(3):                     # 조각 투광: 받침 원통 가장자리에 가리지 않게 물 위 r 7.5 에서
            a = math.pi / 2 + 2 * math.pi * k / 3
            p = (fx + 7.5 * math.cos(a), fy + 7.5 * math.sin(a), SITE_FOUNT_WATER_Z + 0.15)
            _site_spot(coll, f'Site_Sculpture_Spot_{k}', p, (fx, fy, 5.8), 1500.0, (1.0, 0.86, 0.68), 26.0)


def _site_spot(coll, name, loc, target, energy, color, size_deg):
    """위를 향한 스폿 조명 (밤 전용 발광체 — 부지 섹션의 점광원은 40 개 이하)."""
    ld = bpy.data.lights.new(name, 'SPOT')
    ld.energy = energy
    ld.color = color
    ld.spot_size = math.radians(size_deg)
    ld.spot_blend = 0.4
    ld.shadow_soft_size = 0.15
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    ob['na_part'] = 'site'
    coll.objects.link(ob)
    return ob


# --- 나무 원본 ---------------------------------------------------------------------

SITE_BROADLEAF = {   # 모양: 높이 범위, 줄기 높이, 수관 반폭 rx, 반높이 rz, 큰 가지 수, 가지가 서는 정도
    'cherry': ((7.5, 9.0), (1.8, 2.3), 4.6, 2.9, 4, 0.45),     # 왕벚나무 — 낮고 넓게 퍼진 둥근 수관
    'zelkova': ((10.0, 13.0), (2.4, 3.1), 4.8, 3.9, 5, 0.8),  # 느티나무 계열 — 숲·둔치 (항아리 모양)
    'ginkgo': ((10.0, 12.0), (2.0, 2.6), 2.5, 4.4, 3, 1.3),   # 은행나무 — 가로수 (좁고 높게)
}


def _site_blob(bm, center, radii, rng, subdiv, flat=0.5, amp=0.34):
    """노이즈로 울퉁불퉁한 타원 덩어리 (잎 뭉치). 아랫면은 flat 만큼 납작하게."""
    verts = bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)['verts']
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50)))
    for v in verts:
        d = v.co.normalized()
        n = _site_mnoise.noise(d * 2.1 + off) + 0.5 * _site_mnoise.noise(d * 4.6 + off)
        r = 1.0 + amp * n
        z = d.z * (flat if d.z < 0 else 1.0)
        v.co = Vector((center[0] + d.x * r * radii[0], center[1] + d.y * r * radii[1], center[2] + z * r * radii[2]))
    return verts


def _site_tree_bm(trunk, limbs, blobs, rng, sides, subdiv):
    """줄기(점·굵기 목록) + 가지 [(시작, 끝, 굵기0, 굵기1)] + 잎 덩어리 [(중심, 반지름, 납작)] → bmesh.
    재질 슬롯 0 = 껍질, 1 = 잎."""
    bm = bmesh.new()
    _site_tube_path(bm, [Vector(p) for p in trunk[0]], trunk[1], sides)
    for p0, p1, r0, r1 in limbs:
        _site_tube(bm, Vector(p0), Vector(p1), r0, r1, max(3, sides - 1))
    wood = set(bm.faces)
    for c, radii, flat in blobs:
        _site_blob(bm, c, radii, rng, subdiv, flat)
    for f in bm.faces:
        f.material_index = 0 if f in wood else 1
        f.smooth = True
    return bm


def _site_pine(rng, hi):
    """소나무(적송): 살짝 기울고 휜 줄기, 위쪽에서 비스듬히 뻗은 가지 끝마다 납작한 솔잎 덩어리 → 우산 모양 수관."""
    H = rng.uniform(9.0, 12.0)
    a = rng.uniform(0, 2 * math.pi)
    lean, wob = rng.uniform(0.8, 2.8), rng.uniform(-0.8, 0.8)
    ca, sa = math.cos(a), math.sin(a)
    fr = (-0.03, 0.3, 0.55, 0.78, 0.9)
    bend = [(max(f, 0.0) ** 1.5 * lean, math.sin(math.pi * max(f, 0.0)) * wob) for f in fr]
    trunk = [(ca * b - sa * w, sa * b + ca * w, f * H) for f, (b, w) in zip(fr, bend)]
    radii = [r * H / 10.0 for r in (0.26, 0.2, 0.15, 0.1, 0.06)]
    limbs, blobs = [], []
    nb = 5 if hi else 3
    for k in range(nb):                                   # 아래 단은 길고 낮게, 위 단은 짧고 높게
        f = rng.uniform(0.5, 0.64) if k % 2 == 0 else rng.uniform(0.66, 0.84)
        i = max(j for j in range(4) if fr[j] <= f)
        p0 = Vector(trunk[i]).lerp(Vector(trunk[i + 1]), (f * H - trunk[i][2]) / (trunk[i + 1][2] - trunk[i][2]))
        az = a + 2 * math.pi * k / nb + rng.uniform(-0.45, 0.45)
        reach = (rng.uniform(2.4, 3.8) if k % 2 == 0 else rng.uniform(1.4, 2.6)) * H / 10.0
        p1 = p0 + Vector((math.cos(az) * reach, math.sin(az) * reach, rng.uniform(0.2, 1.1)))
        limbs.append((p0, p1, 0.08 * H / 10.0, 0.04))
        rx = rng.uniform(1.2, 2.4) * H / 10.0
        blobs.append((p1 + Vector((0, 0, 0.35)), (rx, rx * rng.uniform(0.7, 1.0), rng.uniform(0.6, 1.0)), 0.3))
    top = Vector(trunk[-1])
    rx = rng.uniform(1.8, 2.6) * H / 10.0
    blobs.append((top + Vector((0, 0, 0.5)), (rx, rx * 0.85, rng.uniform(0.8, 1.1)), 0.3))
    if hi:
        blobs.append((top + Vector((rng.uniform(-1.2, 1.2), rng.uniform(-1.2, 1.2), -0.9)), (1.4, 1.1, 0.65), 0.3))
    return _site_tree_bm((trunk, radii), limbs, blobs, rng, 6 if hi else 4, 1 if hi else 0)


def _site_broadleaf(rng, hi, style):
    """활엽수: 곧은 줄기 → 큰 가지 몇 개 → 둥글게 모인 잎 덩어리 (style 은 SITE_BROADLEAF 키)."""
    (h0, h1), (t0, t1), rx, rz, nl, up = SITE_BROADLEAF[style]
    H = rng.uniform(h0, h1)
    th = rng.uniform(t0, t1)
    s = H / (h0 + h1) * 2
    rx, rz = rx * s, rz * s
    lx, ly = rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25)
    trunk = ((0, 0, -0.05 * H), (lx * 0.5, ly * 0.5, th * 0.6), (lx, ly, th))
    radii = [0.3 * s, 0.25 * s, 0.21 * s]
    c = Vector((lx, ly, H - rz))
    limbs, blobs = [], []
    a0 = rng.uniform(0, 2 * math.pi)
    for k in range(nl if hi else 2):
        az = a0 + 2 * math.pi * k / nl + rng.uniform(-0.3, 0.3)
        end = c + Vector((math.cos(az) * rx * 0.55, math.sin(az) * rx * 0.55, rz * (up - 0.5) * 0.6))
        limbs.append((Vector(trunk[-1]), end, 0.15 * s, 0.06 * s))
    # 잎 덩어리: 가까운용은 작은 덩어리 여럿(위 하나 + 가운데 고리 + 아래 안쪽 고리)이 겹쳐 한 수관이 되게,
    # 먼용은 큰 덩어리 넷.
    rings = ((0.55, 0.55, 0.0, 1), (0.62, 0.42, 0.1, 6), (0.35, 0.4, -0.3, 4)) if hi else \
        ((0.55, 0.55, 0.0, 1), (0.58, 0.5, 0.0, 3))
    for f, r, dz, n in rings:
        for k in range(n):
            az = a0 + 2 * math.pi * (k + 0.5 * (dz < 0)) / n + rng.uniform(-0.3, 0.3)
            ff = f * rng.uniform(0.85, 1.1) if n > 1 else 0.0
            p = c + Vector((math.cos(az) * rx * ff, math.sin(az) * rx * ff,
                            rz * (0.45 if n == 1 else dz + rng.uniform(-0.15, 0.2))))
            rr = r * rng.uniform(0.85, 1.15)
            blobs.append((p, (rx * rr, rx * rr * rng.uniform(0.85, 1.0), rz * rr * 1.05), 0.7))
    return _site_tree_bm((trunk, radii), limbs, blobs, rng, 6 if hi else 4, 1 if hi else 0)


def _site_shrub(rng):
    """무궁화 떨기나무 (약 2.2 m): 잎 뭉치 셋, 꽃은 재질 (분홍·흰 점)."""
    blobs = [(Vector((rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), 0.9 + 0.35 * k)), (0.75 - 0.12 * k,) * 2 +
              (0.6,), 0.6) for k in range(3)]
    return _site_tree_bm((((0, 0, -0.05), (0, 0, 0.5)), (0.05, 0.04)), [], blobs, rng, 4, 1)


def _site_tree_sources(ctx, mt, needed):
    """원본 메시: 소나무 3 · 벚나무 · 느티나무 · 은행나무 (각 가까운용 hi / 먼용 lo) + 무궁화 — needed 에 든 것만.
    키 → bpy 메시. 원본마다 씨앗은 ctx.rng 에서 정해진 순서로 뽑아 hi 와 lo 가 같은 모양이 됩니다."""
    out = {}
    specs = [(f'pine{i}', 'pine', None) for i in range(3)] + [(k, 'broad', k) for k in SITE_BROADLEAF]
    for key, kind, style in specs:
        seed = ctx.rng.random()
        for hi in (True, False):
            if f'{key}_{"hi" if hi else "lo"}' not in needed:
                continue
            rng = random.Random(seed)
            bm = _site_pine(rng, hi) if kind == 'pine' else _site_broadleaf(rng, hi, style)
            mats = ([mt['bark_pine'], mt['leaf_pine']] if kind == 'pine' else
                    [mt['bark'], mt['leaf_' + style]])
            name = f'Site_Tree_{key}_{"hi" if hi else "lo"}'
            me = bpy.data.meshes.new(name)
            bm.to_mesh(me)
            bm.free()
            for m in mats:
                me.materials.append(m)
            out[f'{key}_{"hi" if hi else "lo"}'] = me
    bm = _site_shrub(random.Random(ctx.rng.random()))
    me = bpy.data.meshes.new('Site_Shrub_Mugunghwa')
    bm.to_mesh(me)
    bm.free()
    for m in (mt['bark'], mt['flowers']):
        me.materials.append(m)
    out['shrub'] = me
    return out


class _SiteForest:
    """나무 자리 모음 → 원본 메시별로 첫 그루를 원본 오브젝트로, 나머지를 instance() 링크 복제로 세웁니다.
    원본별 빈 오브젝트 밑에 모읍니다 (GLB 에서는 메시를 공유하는 노드). 심을 때 수관이 건물 발자국에
    닿는 나무는 뺍니다 (_site_canopy_hits)."""

    def __init__(self, ctx):
        self.rng = ctx.rng
        self.spots = {}

    def add(self, key, x, y, scale=1.0, z=None, jitter=0.15):
        s = scale * self.rng.uniform(1.0 - jitter, 1.0 + jitter)
        zz = ground_z(x, y) - 0.1 if z is None else z
        self.spots.setdefault(key, []).append(
            (x, y, zz, self.rng.uniform(0, 2 * math.pi), (s, s, s * self.rng.uniform(0.9, 1.1))))

    def count(self):
        return sum(len(v) for v in self.spots.values())

    def plant(self, coll, meshes):
        for key in sorted(self.spots):
            me = meshes[key]
            reach = max((max(abs(v.co.x), abs(v.co.y)) for v in me.vertices), default=0.0)
            spots = [sp for sp in self.spots[key] if not _site_canopy_hits(sp[0], sp[1], reach * sp[4][0])]
            if not spots:
                continue
            root = empty(f'Site_Instances_{key}', (0.0, 0.0, 0.0), coll)
            root['na_part'] = 'site'
            src = None
            for i, (x, y, z, rot, sc) in enumerate(spots):
                name = f'Site_{key}_{i:04d}'
                if src is None:
                    src = bpy.data.objects.new(name, meshes[key])
                    src.location, src.rotation_euler, src.scale = (x, y, z), (0.0, 0.0, rot), sc
                    src['na_part'] = 'site'
                    coll.objects.link(src)
                    obj = src
                else:
                    obj = instance(name, src, coll, (x, y, z), rot, sc)
                obj.parent = root


def _site_canopy_hits(x, y, r):
    """반경 r 수관이 실제 건물·조각 발자국(본관 기단·돌출부·대계단, 받침·해태·상징석, 이웃 건물)에 닿는지."""
    return _site_in_rects(x, y, SITE_CANOPY_BLOCK, r)


# --- 나무 심기 ---------------------------------------------------------------------

# 수관이 닿으면 안 되는 발자국: 본관 기단+양 끝 돌출부, 대계단, 그리고 SITE_CLEAR 의 조각·이웃 건물
# (SITE_CLEAR[0] 는 앞마당까지 넓게 잡은 구역이라 빼고, 정문 앞마당 [6] 도 뺌)
SITE_CANOPY_BLOCK = ((-98.8, 95.0, -PODIUM_Y / 2, PODIUM_Y / 2), (-STAIR_W / 2, STAIR_W / 2, STAIR_FOOT_Y, 0.0)) + \
    SITE_CLEAR[1:6] + SITE_CLEAR[7:]

SITE_PAVED = (   # 나무를 흩뿌리지 않는 길·광장·보도 사각형 (x0, x1, y0, y1) — 차로 자체는 _site_on_road 가 검사
    (-310.0, 393.0, -132.0, -116.5), (-117.0, 117.0, -330.0, -116.5), (-113.0, 217.0, -330.0, -319.0),
    (206.0, 218.0, -330.0, -116.5), (-113.0, 113.0, -122.0, 127.0), (-193.0, 132.0, 115.0, 127.0),
    (-2500.0, 2500.0, -426.0, -386.0), (-36.0, 41.0, -2200.0, -418.0), (-427.0, -163.0, -517.0, -505.0),
    (-126.0, 35.0, 141.0, 228.0), (-260.0, -43.0, -390.0, -329.0), (-44.0, 44.0, -392.0, -326.0),
    (-136.0, -106.0, -272.0, -178.0)) + tuple((x - 6.5, x + 6.5, y1, -418.0) for x, y1 in SITE_SIDE_STREETS)


def _site_seg_dist(x, y, pts):
    best = 1e9
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        t = max(0.0, min(1.0, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy or 1e-9)))
        best = min(best, math.hypot(x0 + t * dx - x, y0 + t * dy - y))
    return best


def _site_free(x, y, margin=4.0):
    """나무 자리가 비었는지: 건물 발자국(margin)·길·광장·강, 차로 가장자리에서 3.5 m, 의원동산 산책로에서 3.5 m."""
    if _site_in_rects(x, y, SITE_CLEAR, margin) or _site_in_rects(x, y, SITE_PAVED, 1.5):
        return False
    if _site_river_s(x, y) > -40.0 or _site_on_road(x, y, 3.5):
        return False
    return all(_site_seg_dist(x, y, p) > 3.5 for p in SITE_MOUND_PATHS)


def _site_grove(x, y, seed=0.0):
    """숲·빈터를 나누는 낮은 주파수 노이즈 (-1..1) — 흩뿌린 나무가 무리를 짓게."""
    return _site_mnoise.noise(Vector((x / 70.0, y / 70.0, seed)))


def _site_scatter(rng, x0, x1, y0, y1, step, jitter=0.4):
    """흔들린 격자 점 (숲을 고르게 채우되 줄지어 보이지 않게)."""
    out = []
    y = y0 + step / 2
    while y < y1:
        x = x0 + step / 2
        while x < x1:
            out.append((x + rng.uniform(-jitter, jitter) * step, y + rng.uniform(-jitter, jitter) * step))
            x += step
        y += step
    return out


def _site_plant_front(forest, rng):
    """앞쪽 (가까이 보이는 hi): 앞마당 소나무 화단, 잔디광장 가장자리 소나무 무리, 옆 차로 벚나무, 정문 구역.
    정문 안 가운데 잔디판(x -27..28)은 자료대로 비워 둡니다 — 정문에서 본관이 보이는 시야."""
    gx0, gx1, gy0, gy1 = SITE_GROVES
    for s in (-1, 1):
        for x, y in _site_scatter(rng, gx0 + 4.0, gx1 - 1.5, gy0 + 1.5, gy1 - 1.5, 6.5, 0.3):   # 군상 쪽은 비움
            forest.add(f'pine{rng.randrange(3)}_hi', s * x, y, 0.95, z=0.1)
    clumps = ((88.0, -142.0, 5), (88.0, -176.0, 4), (86.0, -210.0, 5), (86.0, -238.0, 5), (88.0, -272.0, 4),
              (88.0, -304.0, 5), (20.0, -140.0, 3), (32.0, -305.0, 3), (55.0, -144.0, 3), (60.0, -302.0, 3))
    for s in (-1, 1):
        for cx, cy, n in clumps:
            for k in range(n):
                a = 2 * math.pi * k / n + rng.uniform(-0.4, 0.4)
                r = 0.0 if k == 0 and n > 3 else rng.uniform(3.0, 5.5)
                forest.add(f'pine{rng.randrange(3)}_hi', s * cx + r * math.cos(a), cy + r * math.sin(a), 1.0,
                           z=SITE_Z_GRASS2 - 0.1)
        for y in range(-136, -318, -10):
            for x in (102.5, 119.0):
                if _site_free(s * x, float(y), 2.0) or x == 102.5:
                    forest.add('cherry_hi', s * x, float(y), 0.95)
    for x, y in _site_scatter(rng, 56.0, 156.0, -377.0, -337.0, 7.5, 0.35):
        forest.add(f'pine{rng.randrange(3)}_hi', x, y, 1.0, z=-0.1)
    for x in range(-247, -55, 7):                                  # 무궁화 광장: 무궁화 두 줄
        for y in (-343.5, -376.5):
            forest.add('shrub', float(x) + rng.uniform(-0.8, 0.8), y, 1.0, z=SITE_Z_GRASS2 - 0.05)


def _site_plant_campus(forest, rng):
    """캠퍼스 숲: 의원동산(사랑재 마당·산책로에서 가까이 보이므로 소나무는 가까운용 hi, 마당 25 m 안의 활엽수도 hi),
    뒤 숲, 좌우 빈터, 가로 차로·뒤 순환길 벚나무 (먼 lo). 모두 울타리 안."""
    fence = SITE_FENCE
    yx0, yx1, yy0, yy1 = SITE_YARD
    for x, y in _site_scatter(rng, *SITE_MOUND_WOODS, 8.5):
        if yx0 - 2 < x < yx1 + 2 and yy0 - 2 < y < yy1 + 2:
            continue
        if _site_inside(x, y, fence) and _site_free(x, y, 3.0):
            broad = 'zelkova_hi' if _site_in_rects(x, y, (SITE_YARD,), 25.0) else 'zelkova_lo'
            forest.add(f'pine{rng.randrange(3)}_hi' if rng.random() < 0.7 else broad, x, y, 1.0)
    for x, y in _site_scatter(rng, -179.0, 118.0, 128.0, 262.0, 9.5):
        if _site_inside(x, y, fence) and _site_free(x, y, 3.0):
            forest.add(f'pine{rng.randrange(3)}_lo' if rng.random() < 0.5 else 'zelkova_lo', x, y, 1.0)
    for x0, x1, y0, y1 in ((-300.0, -118.0, -330.0, 125.0), (118.0, 440.0, -388.0, -118.0)):
        for x, y in _site_scatter(rng, x0, x1, y0, y1, 12.0, 0.45):
            if _site_grove(x, y) > 0.05 and _site_inside(x, y, fence) and _site_free(x, y, 6.0) and \
                    not (50 < x < 162 and y < -331):
                lod = '_hi' if x < 0 and y < -100 else '_lo'          # 왼쪽 앞(대표 카메라 바로 밑)은 가까운용
                forest.add(('zelkova' if rng.random() < 0.6 else 'cherry') + lod, x, y, 1.0)
    for y in (-114.0, -134.5):
        for x in range(-296, 384, 11):
            if abs(x) > 120 and _site_free(float(x), y, 2.0):
                forest.add('cherry_hi' if abs(x) < 200 else 'cherry_lo', float(x), y, 1.0)
    for off in (-7.5, 7.5):
        for x, y, _ in _site_along(_site_smooth(list(SITE_REAR_LOOP)), 10.0, off):
            if _site_inside(x, y, fence) and not _site_in_rects(x, y, SITE_CLEAR + SITE_PAVED[9:10], 3.0) and \
                    not _site_on_road(x, y, 2.5):
                forest.add('cherry_lo', x, y, 1.0)


def _site_plant_outside(forest, rng):
    """바깥 (lo): 여의서로 양쪽 벚나무 가로수, 국회대로·의사당대로 은행나무·느티나무, 한강 둔치.
    가로수는 차로 어귀와 도로 가로등 기둥(4 m 안)을 피합니다."""
    x0, x1, y0, y1 = SITE_GROUND
    for pts in (SITE_RING_OUT, SITE_LEFT_OUT):
        for off in (-9.5, 9.5):
            for x, y, _ in _site_along(_site_smooth(list(pts)), 9.0, off):
                if x0 < x < x1 and y0 < y < y1 and _site_river_s(x, y) < -40.0 and \
                        not _site_inside(x, y, SITE_FENCE) and not _site_in_rects(x, y, SITE_PAVED[6:7], 0.0) and \
                        not _site_on_road(x, y, 3.0):
                    forest.add('cherry_lo', x, y, 1.0)
    yc, w = SITE_GUKHOE
    (ca, cb), cw, _ = SITE_UISADANG
    poles = [(x, y) for x, y, _, _ in _site_streetlight_spots()]
    rows = [(float(x), yc - w / 2 - 3.0, 'ginkgo_lo', 1.0) for x in range(-740, 741, 10)]
    for y in range(-434, -846, -10):
        rows += [(ca - cw / 2 - 3.0, float(y), 'ginkgo_lo', 0.9), (cb + cw / 2 + 3.0, float(y), 'ginkgo_lo', 0.9)]
        if not any(u0 - 3.0 < y < u1 + 3.0 for u0, u1 in SITE_UTURNS):      # 가운데 녹지 (유턴 길은 비움)
            rows += [(ca + cw / 2 + 5.0, float(y), 'zelkova_lo', 0.9), (cb - cw / 2 - 5.0, float(y), 'zelkova_lo', 0.9)]
    for x, y, key, sc in rows:
        if not _site_on_road(x, y, 2.5) and all(math.hypot(x - px, y - py) > 4.0 for px, py in poles):
            forest.add(key, x, y, sc)
    for x, y in _site_scatter(rng, x0, x1, -700.0, y1, 17.0, 0.45):       # 샛강·한강 둔치 쪽 숲 (울타리 밖)
        if (x < -300.0 or x > 440.0) and _site_grove(x, y, 3.0) > 0.0 and not _site_inside(x, y, SITE_FENCE) and \
                _site_ground_kind(x, y) == 'grass' and _site_free(x, y, 3.0):
            forest.add('zelkova_lo' if rng.random() < 0.7 else 'cherry_lo', x, y, 1.0)
    (px, py), (dx, dy) = _site_river_line(-58.0)
    t = -700.0
    while t < 900.0:
        x, y = px + dx * t + rng.uniform(-6, 6), py + dy * t
        y += rng.uniform(-14.0, 14.0)
        if x0 < x < x1 and y0 < y < y1 and not _site_inside(x, y, SITE_FENCE) and not _site_on_road(x, y, 3.5):
            forest.add('zelkova_lo' if rng.random() < 0.6 else 'cherry_lo', x, y, 1.0)
        t += rng.uniform(12.0, 22.0)


# --- 가로등 · 울타리 ---------------------------------------------------------------

def _site_lamp_mesh(mt):
    """캠퍼스 가로등 (5 m): 팔각 받침, 가는 기둥, 둥근 유백색 등갓 (밤에 따뜻한 빛)."""
    bm = bmesh.new()
    bm_cylinder(bm, 0, 0, -0.05, 0.2, 0.17, 0.55, segments=8)
    bm_cylinder(bm, 0, 0, 0.5, 0.075, 0.055, 4.05, segments=8)
    bm_cylinder(bm, 0, 0, 4.55, 0.1, 0.13, 0.12, segments=8)
    metal = set(bm.faces)             # bmesh.ops 뒤에는 면 순서가 만든 순서가 아니므로 집합으로 가림
    globe = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.27)['verts']
    bmesh.ops.translate(bm, verts=globe, vec=(0, 0, 4.9))
    for f in bm.faces:
        f.material_index = 0 if f in metal else 1
        f.smooth = f not in metal
    cap = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.14, radius2=0.02, depth=0.14)['verts']
    bmesh.ops.translate(bm, verts=cap, vec=(0, 0, 5.2))
    me = bpy.data.meshes.new('Site_Lamp')
    bm.to_mesh(me)
    bm.free()
    for m in (mt['pole'], mt['globe']):
        me.materials.append(m)
    return me


def _site_streetlight_mesh(mt):
    """도로 가로등 (10 m): 기둥 + 도로 쪽(+X)으로 뻗은 팔 + 납작한 등기구 (아랫면이 밤에 빛남)."""
    m = _SiteMesh('Site_Streetlight', [mt['pole'], mt['luminaire']])
    bm = m.bm
    bm_cylinder(bm, 0, 0, -0.05, 0.13, 0.08, 10.05, segments=8)
    _site_tube(bm, Vector((0, 0, 9.4)), Vector((1.6, 0, 10.0)), 0.05, 0.045, 5)
    m.box(1.4, 2.4, -0.18, 0.18, 9.9, 10.05, 0)
    m.poly(_site_rect(1.45, 2.35, -0.15, 0.15), 9.895, 1).normal_flip()      # 아래를 보는 발광면
    me = bpy.data.meshes.new('Site_Streetlight')
    m.bm.to_mesh(me)
    m.bm.free()
    for mat in m.mats:
        me.materials.append(mat)
    return me


def _site_lamp_spots():
    """캠퍼스 가로등 자리 — 축 산책로 가운데 잔디, 분수 둘레, 가로 길, 둘레 길, 차로 옆 보도, 뒤 길."""
    fx, fy = SITE_FOUNTAIN
    spots = []
    for s in (-1, 1):
        spots += [(s * 3.3, float(y)) for y in range(-145, -310, -25) if abs(y - fy) >= 22]
        spots += [(s * x, -220.6) for x in (35.0, 60.0, 85.0)]
        spots += [(s * 98.8, float(y)) for y in range(-140, -310, -25)]
        spots += [(s * (SITE_LAWN_DRIVE_X[1] + 2.7), float(y)) for y in range(-137, -320, -25)]
        spots += [(s * 42.8, float(y)) for y in (-340.0, -362.0)]
        spots += [(s * 103.6, float(y)) for y in range(-105, 115, 25)]
    spots += [(fx + 16.2 * math.cos(math.radians(22.5 + 45 * k)), fy + 16.2 * math.sin(math.radians(22.5 + 45 * k)))
              for k in range(8)]
    spots += [(float(x), -118.8) for x in range(-290, 385, 25) if abs(x) > 8]
    spots += [(float(x), -329.4) for x in range(-100, 215, 25) if not (28 < abs(x) < 48) and abs(x) > 8]
    spots += [(float(x), 126.6) for x in range(-185, 126, 30)]
    # 뒤 회차로 (-1, 108) 둘레: 바깥 반지름 17.5 밖 r 21.5, 뒷길·회차로로 드는 길을 피한 각도
    spots += [(-1.0 + 21.5 * math.cos(a), 108.0 + 21.5 * math.sin(a)) for a in (0.12, math.pi - 0.12, -1.22, -1.92)]
    return [(x, y) for x, y in spots if not _site_on_road(x, y, 0.6)]      # 차로 위(교차부·차 대는 길)는 뺌


def _site_streetlight_spots():
    """도로 가로등 자리 (x, y, z, 팔 방향): 국회대로 양쪽 보도 35 m 간격, 의사당대로 양쪽 보도.
    정문 앞과 교차로 모서리에도 세우고(밤에 어귀가 어둡지 않게), 골목·어귀 위에 오는 것은 줄을 따라 7 m 옮기거나 뺍니다."""
    yc, w = SITE_GUKHOE
    (ca, cb), cw, _ = SITE_UISADANG
    yn, ys = yc + w / 2 + 1.2, yc - w / 2 - 1.2
    spots = [(float(x), yn, 0.0, -math.pi / 2) for x in range(-735, 740, 35) if abs(x - 2) > 60]
    spots += [(-20.0, yn, 0.0, -math.pi / 2), (20.0, yn, 0.0, -math.pi / 2)]   # 정문 앞 (보행문과 1·2문 사이)
    spots += [(float(x) + 17.0, ys, 0.0, math.pi / 2) for x in range(-735, 720, 35) if abs(x + 15) > 60]
    spots += [(ca - cw / 2 - 17.0, ys, 0.0, math.pi / 2), (cb + cw / 2 + 17.0, ys, 0.0, math.pi / 2)]   # 교차로 모서리
    spots += [(ca - cw / 2 - 1.2, float(y), 0.0, 0.0) for y in range(-433, -850, -35)]
    spots += [(cb + cw / 2 + 1.2, float(y), 0.0, math.pi) for y in range(-433, -850, -35)]
    out = []
    for x, y, z, rot in spots:
        tx, ty = -math.sin(rot), math.cos(rot)                  # 줄 방향 (팔과 직각)
        for d in (0.0, 7.0, -7.0):
            if not _site_on_road(x + tx * d, y + ty * d, 0.9):
                out.append((x + tx * d, y + ty * d, z, rot))
                break
    return out


def _site_bench_mesh(mt):
    """벤치 (1.8 m): 화강석 다리 둘 + 나무 앉음판·등받이."""
    m = _SiteMesh('Site_Bench', [mt['curb'], mt['bench']])
    for x in (-0.7, 0.7):
        m.box(x - 0.09, x + 0.09, -0.22, 0.22, -0.05, 0.4, 0)
    m.box(-0.9, 0.9, -0.25, 0.25, 0.4, 0.46, 1)
    m.box(-0.9, 0.9, 0.2, 0.26, 0.5, 0.85, 1)
    m.box(-0.75, -0.65, 0.18, 0.22, 0.4, 0.6, 0)
    m.box(0.65, 0.75, 0.18, 0.22, 0.4, 0.6, 0)
    me = bpy.data.meshes.new('Site_Bench')
    m.bm.to_mesh(me)
    m.bm.free()
    for mat in m.mats:
        me.materials.append(mat)
    return me


def _site_bench_spots():
    """벤치 자리 (x, y, 앉은 사람이 보는 방향각): 분수 둘레 길 네 곳(분수를 봄), 둘레 길(바깥 차로 쪽을 봄),
    가로 길 남쪽 가장자리(북쪽 본관을 봄). 등받이는 잔디·산울타리 쪽."""
    fx, fy = SITE_FOUNTAIN
    spots = [(fx + 16.3 * math.cos(a), fy + 16.3 * math.sin(a), a + math.pi)
             for a in (math.radians(45.0 + 90.0 * k) for k in range(4))]
    for s in (-1, 1):
        spots += [(s * 96.7, float(y), 0.0 if s > 0 else math.pi) for y in (-152.0, -202.0, -252.0, -292.0)]
        spots += [(s * x, -225.3, math.pi / 2) for x in (47.0, 72.0)]
    return spots


def _site_instances(name, mesh, coll, spots):
    """spots [(x, y, z, 회전)] 에 mesh 를 세웁니다: 첫 개가 원본, 나머지는 instance() 링크 복제, 모두 빈 오브젝트 밑."""
    root = empty(f'Site_Instances_{name}', (0.0, 0.0, 0.0), coll)
    root['na_part'] = 'site'
    src = None
    for i, (x, y, z, rot) in enumerate(spots):
        if src is None:
            src = bpy.data.objects.new(f'Site_{name}_000', mesh)
            src.location, src.rotation_euler = (x, y, z), (0.0, 0.0, rot)
            src['na_part'] = 'site'
            coll.objects.link(src)
            obj = src
        else:
            obj = instance(f'Site_{name}_{i:03d}', src, coll, (x, y, z), rot)
        obj.parent = root


def _site_lamps(ctx, mt, coll):
    """가로등·벤치: 캠퍼스 5 m 등, 국회대로·의사당대로 10 m 도로등 (팔은 차로 쪽), 산책로 벤치.
    밤에는 등갓·등기구가 빛납니다 (재질)."""
    lamps = _site_lamp_spots()
    _site_instances('Lamp', _site_lamp_mesh(mt), coll, [(x, y, ground_z(x, y) + SITE_Z_PAVE, 0.0) for x, y in lamps])
    if ctx.night:                  # 축 산책로·분수 둘레·앞마당 가로등 밑에 빛 웅덩이 (점광원 23 — 분수 13·교차로 4 와 합쳐 40)
        near = sorted(lamps, key=lambda p: abs(p[0]) * 0.8 + abs(p[1] - SITE_FOUNTAIN[1]) * 0.25)[:SITE_LAMP_LIGHTS]
        for i, (x, y) in enumerate(near):
            ld = bpy.data.lights.new(f'Site_Lamp_Light_{i:02d}', 'POINT')
            ld.energy, ld.color, ld.shadow_soft_size = 150.0, (1.0, 0.74, 0.46), 0.12
            ob = bpy.data.objects.new(ld.name, ld)
            ob.location = (x + 0.16, y, ground_z(x, y) + 4.5)
            ob['na_part'] = 'site'
            coll.objects.link(ob)
    street = _site_streetlight_spots()
    _site_instances('Streetlight', _site_streetlight_mesh(mt), coll, street)
    if ctx.night:                  # 정문 앞 교차로 모서리 가로등 넷: 등기구 밑에서 교차로 쪽으로 비스듬히 비추는 스폿
        cx, cy = sum(SITE_UISADANG[0]) / 2, SITE_GUKHOE[0]                  # 교차로 한가운데
        near = sorted(street, key=lambda sp: math.hypot(sp[0] - cx, sp[1] - cy + 6.0))[:SITE_JUNCTION_LIGHTS]
        for i, (x, y, _, rot) in enumerate(near):
            hx, hy = x + 1.9 * math.cos(rot), y + 1.9 * math.sin(rot)
            aim = (hx + 0.55 * (cx - hx), hy + 0.55 * (cy - hy), 0.0)
            _site_spot(coll, f'Site_Junction_Light_{i}', (hx, hy, 9.8), aim, 2500.0, (1.0, 0.86, 0.68), 120.0)
    _site_instances('Bench', _site_bench_mesh(mt), coll,
                    [(x, y, SITE_Z_PAVE, face + math.pi / 2) for x, y, face in _site_bench_spots()])


def _site_fence(mt, coll):
    """캠퍼스 울타리 (약 2 m): 화강석 낮은 담 + 흰 기둥(2.5 m 간격)·위 난간·세로 살 (0.2 m).
    앞(y -388)은 정문 차로·보행문 자리를 비우고, 가로 차로가 옆 울타리를 지나는 곳도 비웁니다."""
    m = _SiteMesh('Site_Fence', [mt['curb'], mt['fence']])
    pts = [(float(x), float(y)) for x, y in SITE_FENCE]
    segs = list(zip(pts, pts[1:])) + [((pts[-1][0], SITE_FENCE_Y), (pts[0][0], SITE_FENCE_Y))]
    gaps = [(a, b, SITE_FENCE_Y - 3.0, SITE_FENCE_Y + 3.0) for a, b in SITE_FENCE_GAPS]
    gaps += [(-306.0, -284.0, -132.0, -116.5), (362.0, 388.0, -132.0, -116.5)]
    for (x0, y0), (x1, y1) in segs:
        seg_len = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(round(seg_len / 2.5)))
        tx, ty = (x1 - x0) / seg_len, (y1 - y0) / seg_len
        ang = math.atan2(ty, tx)
        for k in range(n):
            a = (x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n)
            b = (x0 + (x1 - x0) * (k + 1) / n, y0 + (y1 - y0) * (k + 1) / n)
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            if _site_in_rects(mx, my, gaps):
                continue
            half = seg_len / n / 2
            m.obox(mx, my, half, 0.18, ang, -0.1, 0.4, 0)                     # 낮은 담
            m.obox(mx, my, half, 0.035, ang, 1.88, 1.95, 1)                   # 위 난간
            m.obox(a[0], a[1], 0.07, 0.07, ang, 0.4, 2.05, 1)                 # 기둥
            nb = int(half * 2 / 0.2)
            for j in range(1, nb):
                u = -half + 2 * half * j / nb
                cx, cy = mx + tx * u, my + ty * u
                m.face(((cx - tx * 0.016, cy - ty * 0.016, 0.4), (cx + tx * 0.016, cy + ty * 0.016, 0.4),
                        (cx + tx * 0.016, cy + ty * 0.016, 1.88), (cx - tx * 0.016, cy - ty * 0.016, 1.88)), 1)
    m.finish(coll)


SITE_CONTEXT_BLDGS = (   # OSM 2024-10 캠퍼스 밖 건물: (높이 m, (x0, y0, x1, y1, ...)) — 모델 좌표, 1 m 로 단순화
    (42, (-131,-816,-130,-831,-121,-831,-121,-825,-111,-825,-111,-831,-96,-831,-96,-825,-86,-825,-86,-831,-77,-831,
         -77,-819,-83,-819,-83,-800,-71,-800,-71,-796,-70,-796,-70,-793,-55,-793,-55,-838,-56,-842,-60,-842,
         -60,-845,-67,-845,-67,-847,-141,-847,-141,-845,-148,-845,-148,-842,-152,-842,-153,-838,-153,-816)),
    (24, (113,-820,142,-800,200,-799,211,-820)), (40, (318,-821,314,-818,314,-782,316,-778)),
    (16, (88,-810,80,-808,77,-803,79,-796,87,-789,99,-784,108,-783,118,-785,124,-790,123,-797,116,-803,99,-809)),
    (40, (291,-814,290,-819,249,-819,248,-757,249,-752,290,-752)), (40, (317,-778,370,-778,374,-781)),
    (42, (-153,-764,-152,-734,-141,-734,-141,-733,-107,-733,-107,-758,-132,-757,-132,-763,-138,-763,-138,-773,
         -132,-773,-132,-783,-138,-783,-138,-794,-131,-794,-131,-804,-138,-804,-138,-811,-153,-811)),
    (28, (316,-750,374,-749,373,-773,370,-774,370,-778,352,-778,352,-764,335,-764,335,-778,317,-778,317,-774,
         314,-772,314,-752)),
    (40, (66,-755,216,-755,216,-775,66,-775)), (40, (422,-771,422,-760,452,-760)),
    (12, (-377,-727,-250,-726,-249,-820)),
    (40, (410,-771,392,-771,391,-744,399,-744,399,-742,442,-742,442,-758,410,-758)),
    (36, (-264,-704,-264,-682,-187,-683,-187,-705)),
    (40, (125,-660,178,-660,178,-680,161,-680,158,-683,155,-680,152,-683,149,-680,146,-683,143,-680,125,-680)),
    (40, (-143,-699,-143,-665,-139,-664,-139,-663,-120,-664,-120,-699)),
    (42, (-68,-664,-68,-688,-114,-687,-114,-664)), (40, (261,-678,262,-661,308,-662,308,-685,261,-685)),
    (40, (401,-684,400,-664,444,-664,445,-684)), (40, (189,-687,188,-658,241,-658,241,-687)),
    (4, (-249,-682,-264,-682,-264,-704,-251,-704,-251,-712,-306,-711,-304,-652,-288,-634,-275,-634,-274,-626,
         -248,-626)),
    (40, (108,-662,108,-686,67,-687,67,-661,99,-660,99,-662)), (40, (325,-683,325,-650,368,-650,367,-684)),
    (4, (-240,-638,-213,-639,-212,-677,-240,-676)), (40, (-137,-641,-116,-641,-117,-659,-138,-659)),
    (40, (400,-648,401,-628,444,-629,444,-658,400,-659)), (40, (-104,-656,-104,-624,-69,-624,-69,-656)),
    (40, (67,-628,106,-628,106,-653,67,-653)), (40, (133,-651,133,-629,151,-629,151,-651)),
    (40, (170,-624,170,-642,173,-642,173,-653,155,-653,156,-624)), (40, (195,-626,211,-625,211,-654,195,-655)),
    (40, (264,-624,282,-624,282,-657,264,-656)), (40, (301,-625,301,-654,285,-654,285,-625)),
    (40, (218,-631,217,-625,233,-625,233,-654,217,-654)), (40, (344,-612,344,-633,326,-634,326,-612)),
    (40, (554,-620,555,-620,555,-624,554,-624,554,-632,511,-632,509,-622,511,-622,511,-614,554,-614)),
    (33, (582,-636,582,-634,580,-635,579,-625,580,-625,579,-619,582,-619,582,-618,595,-618,597,-619,607,-618,
         607,-619,610,-619,609,-617,618,-619,618,-617,631,-618,634,-619,634,-622,635,-623,635,-625)),
    (44, (-148,-637,-149,-604,-121,-603,-120,-637)),
    (20, (556,-631,555,-605,557,-604,563,-608,563,-609,561,-615,561,-631)),
    (40, (149,-625,130,-625,130,-596,149,-596)),
    (40, (392,-592,416,-593,416,-621,402,-621,402,-620,400,-619,400,-608,392,-608)),
    (40, (441,-620,421,-620,421,-594,442,-594)),
    (40, (349,-574,363,-574,370,-581,370,-624,365,-624,365,-632,349,-632)),
    (40, (-112,-617,-112,-584,-70,-584,-69,-617)), (40, (235,-620,217,-620,217,-579,235,-579)),
    (40, (167,-578,167,-615,164,-615,164,-621,152,-621,152,-581,154,-581,154,-578)),
    (40, (193,-616,193,-579,199,-573,211,-573,213,-585,213,-619,199,-619,199,-616)),
    (40, (299,-578,299,-619,266,-619,266,-578)), (40, (104,-620,71,-620,70,-570,104,-570)),
    (40, (344,-572,345,-610,326,-610,326,-571)),
    (25, (548,-594,545,-583,546,-571,553,-560,563,-554,569,-552,581,-553,592,-558,599,-568,603,-580,601,-589,
         597,-598,591,-604,592,-605,587,-608,586,-606,574,-610,563,-608,555,-603)),
    (40, (147,-572,147,-592,129,-592,129,-572)),
    (20, (-274,-626,-279,-626,-279,-623,-286,-623,-285,-613,-306,-592,-321,-607,-331,-612,-341,-613,-347,-611,
         -355,-605,-361,-599,-364,-590,-364,-585,-361,-574,-343,-555,-331,-556,-326,-550,-337,-540,-321,-524,
         -258,-524,-258,-525,-248,-525,-248,-530,-223,-529,-222,-566,-220,-570,-221,-572,-224,-573,-223,-620,
         -248,-620,-248,-626)),
    (40, (-203,-597,-203,-561,-184,-561,-184,-598)), (12, (388,-589,388,-554,400,-554,400,-589)),
    (67, (420,-588,420,-587,416,-586,417,-578,415,-578,415,-553,416,-553,416,-545,420,-545,420,-543,451,-542,
         451,-552,453,-552,453,-578,451,-578,451,-588)),
    (35, (529,-601,525,-588,525,-575,531,-556,540,-545,538,-542,554,-531,556,-535,569,-532,585,-533,585,-541,
         590,-542,590,-550,598,-555,603,-561,607,-569,609,-579,603,-580,599,-568,592,-558,581,-553,569,-552,
         563,-554,553,-560,546,-571,545,-583,546,-589,551,-599,547,-602,543,-603,541,-601)),
    (41, (-67,-545,-67,-576,-113,-576,-113,-545)), (36, (-147,-570,-147,-545,-117,-545,-117,-570)),
    (8, (388,-548,388,-527,398,-527,398,-547)), (8, (373,-548,364,-548,364,-525,373,-525)),
    (40, (133,-516,149,-516,149,-551,133,-551)), (40, (349,-549,348,-519,363,-519,364,-548)),
    (40, (192,-547,192,-517,213,-517,214,-546)), (40, (218,-548,217,-517,233,-517,233,-548)),
    (36, (-117,-540,-138,-540,-138,-522,-117,-522)), (40, (300,-519,302,-521,301,-549,264,-549,264,-519)),
    (40, (323,-519,342,-518,343,-543,324,-544)), (4, (440,-527,440,-535,425,-535,425,-527)),
    (40, (79,-504,104,-504,104,-552,79,-552)), (40, (175,-541,152,-541,152,-516,175,-516)),
    (44, (-145,-502,-119,-502,-117,-505,-118,-520,-145,-520,-146,-515,-144,-511,-146,-507)),
    (40, (414,-522,397,-523,398,-497,414,-498)), (52, (445,-495,445,-525,419,-525,419,-495)),
    (40, (346,-514,346,-493,362,-493,362,-514)), (32, (325,-492,345,-492,345,-514,325,-514)),
    (40, (172,-492,172,-513,137,-513,137,-492)), (40, (200,-515,199,-490,214,-490,214,-515)),
    (36, (232,-513,215,-513,215,-491,231,-491)), (40, (-99,-472,-69,-472,-69,-530,-99,-530)),
    (57, (-736,-489,-719,-493,-720,-502,-738,-498)),
    (15, (-242,-484,-240,-484,-239,-496,-269,-496,-269,-495,-333,-497,-333,-496,-346,-497,-347,-485,-344,-485,
         -344,-483,-242,-482)),
    (15, (-209,-498,-234,-498,-234,-481,-210,-481)), (40, (305,-512,285,-512,285,-469,304,-469)),
    (12, (-129,-492,-129,-485,-133,-485,-133,-484,-118,-484,-118,-494,-122,-494,-122,-492)),
    (35, (345,-468,345,-490,326,-490,326,-469)), (34, (263,-473,263,-449,279,-449,279,-509,263,-509)),
    (40, (-138,-463,-117,-462,-117,-481,-138,-481)), (40, (348,-449,363,-449,363,-488,348,-488)),
    (15, (-213,-451,-211,-451,-211,-462,-215,-462,-215,-463,-225,-463,-225,-462,-233,-462,-233,-463,-251,-462,
         -251,-463,-261,-463,-261,-462,-269,-462,-269,-464,-279,-464,-279,-462,-283,-462,-283,-452,-281,-452,
         -281,-450,-213,-450)),
    (40, (104,-488,72,-488,72,-430,104,-430)),
    (15, (-290,-463,-304,-464,-304,-462,-312,-463,-312,-464,-322,-464,-322,-463,-330,-463,-330,-464,-340,-464,
         -340,-463,-344,-463,-344,-452,-342,-452,-342,-451,-323,-452,-324,-451,-305,-452,-305,-451,-292,-450,
         -292,-452,-290,-452)),
    (40, (171,-484,142,-484,143,-429,171,-429)), (40, (344,-445,344,-467,326,-466,326,-445)),
    (40, (302,-464,283,-464,283,-443,302,-443)), (8, (-144,-443,-125,-443,-125,-453,-145,-454)),
    (40, (-70,-455,-108,-455,-108,-428,-70,-428)), (40, (282,-441,257,-441,257,-429,282,-429)),
    (8, (355,-428,364,-428,363,-440,355,-440)),
    (12, (-724,-392,-720,-393,-717,-380,-701,-383,-706,-412,-727,-408)),
    (12, (520,-173,520,-176,504,-188,502,-187,501,-184,517,-173)),
    (12, (540,-159,540,-162,524,-174,522,-172,521,-170,537,-158)),
    (12, (490,-107,490,-109,474,-121,472,-120,472,-117,487,-106)))


def _site_context(ctx, mt, coll):
    """캠퍼스 밖 도시: OSM 건물 윤곽을 세운 매스 + 부지 사각형 밖 먼 도시 블록(한강 건너 마포, 여의도·당산 쪽).
    먼 블록은 자료가 없어 난수로 스카이라인만 암시하고, 밝고 푸르스름한 재질로 공기 원근을 흉내 냅니다."""
    m = _SiteMesh('Site_Context_Buildings', [mt['context']])
    for h, flat in SITE_CONTEXT_BLDGS:
        pts = list(zip(flat[0::2], flat[1::2]))
        perim = sum(math.hypot(x1 - x0, y1 - y0) for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
        # 1 m 단순화가 남긴 찌꺼기 (세 점짜리, 폭 4 m 미만의 칼날·조각) 와 차로 안쪽(1 m 넘게)에 걸린 윤곽은 뺌
        if len(pts) <= 3 or abs(_site_area2(pts)) / perim < 4.0 or any(_site_on_road(x, y, -1.0) for x, y in pts):
            continue
        m.prism(pts, -0.1, float(max(h, 6)))
    m.finish(coll)
    far = _SiteMesh('Site_Far_City', [mt['skyline']])
    rng = random.Random(ctx.rng.random())
    x0, x1, y0, y1 = SITE_GROUND
    for gy in range(-2500, 2500, 70):
        for gx in range(-2500, 2500, 70):
            x, y = gx + rng.uniform(-20, 20), gy + rng.uniform(-20, 20)
            s = _site_river_s(x, y)
            if x0 - 40 < x < x1 + 40 and y0 - 40 < y < y1 + 40 or -SITE_PARK_W - 10 < s < SITE_RIVER_W + SITE_PARK_W + 10:
                continue
            if rng.random() > (0.7 if s > 0 else 0.5):
                continue
            h = rng.uniform(40.0, 75.0) if rng.random() < 0.25 else rng.uniform(10.0, 32.0)
            hx, hy, ang = rng.uniform(9.0, 20.0), rng.uniform(7.0, 15.0), rng.uniform(-0.08, 0.08)
            if not _site_on_road(x, y, math.hypot(hx, hy) + 3.0):              # 의사당대로·여의서로 위에는 세우지 않음
                far.obox(x, y, hx, hy, ang, -0.1, h)
    far.finish(coll)


def build_site(ctx):
    """주변 부지 전체. 순서: 바닥·강 → 차로·도색·연석·보도 → 광장·잔디·분수 → 울타리·가로등 → 바깥 매스 → 나무."""
    coll = ctx.coll('Site')
    mt = _site_materials(ctx)
    _site_ground(mt, coll)
    road = _SiteMesh('Site_Roads', [mt['asphalt']])
    paint = (_SiteMesh('Site_Road_Paint', [mt['paint']]), _SiteMesh('Site_Road_Paint_Yellow', [mt['paint_y']]))
    curb = _SiteMesh('Site_Curbs', [mt['curb']])
    walk = _SiteMesh('Site_Sidewalks', [mt['path'], mt['grass']])
    _site_roads(road)
    _site_campus_paint(paint)
    _site_campus_curbs(curb)
    _site_gukhoe(paint, curb, walk)
    _site_uisadang(paint, curb, walk)
    _site_yeoui_paint(paint)
    for m in (road, *paint, curb, walk):
        m.finish(coll)
    _site_riverside(mt, coll)
    _site_lawn_block(mt, coll)
    _site_forecourt(mt, coll)
    _site_gate_zone(mt, coll)
    _site_walks(mt, coll)
    _site_sports(mt, coll)
    _site_fountain(ctx, mt, coll)
    _site_fence(mt, coll)
    _site_lamps(ctx, mt, coll)
    _site_context(ctx, mt, coll)
    forest = _SiteForest(ctx)
    _site_plant_front(forest, ctx.rng)
    _site_plant_campus(forest, ctx.rng)
    _site_plant_outside(forest, ctx.rng)
    forest.plant(ctx.coll('Site_Trees', coll), _site_tree_sources(ctx, mt, set(forest.spots)))
    ctx.stats['site_trees'] = forest.count()


# ----------------------------------------------------------------------------
# 상징물과 주변 건물 — 해태 한 쌍, 2025 상징석, 정문, 계단 발치의 '애국애족의 군상', 이웃 국회 건물, 사랑재 (부지 옵션일 때만)
#
# 배치는 spec/research_spec.md (OpenStreetMap 기반). 원점 = 본관 중심 지면, 정면 -Y (방위 142°).
#   해태 (이순석, 1975): 정문 안쪽 (±30, -372), 네 발로 선 수컷·암컷, 흰 대리석, 받침 1.4 x 2.4 x 2.0 m, 바깥(-Y, 관악산)을 봄.
#   상징석 (2025): 자연석 5.0 x 2.0 x 1.2 m, 앞면에 '민주주의 최후의 보루 / 대한민국 국회'.
#   정문 (울타리 y -388, 울타리는 부지 섹션): 1문(들어옴) x +37.5, 2문(나감) x -37.5 (약 12 m), 축의 보행문, 초소, 흰 문기둥, 밤에 빛나는 문 번호판.
#   '애국애족의 군상' (김세중, 1976): 대계단 발치 화강석 받침 13.6 x 7.5 x 2.5 m (±32.3, -90) 위 짙은 청동 인물 무리 (약 5 m).
#   이웃 건물: 국회도서관·의정관(+연결 다리)·헌정기념관·의원회관·소통관·2층 작은 건물 다섯·사랑재 (좌표는 LM_* 상수).
# 조각(해태·군상)은 메타볼 요소로 빚어 메시로 굳힙니다 (_LmSculpt → _LmBaker). 건물은 재질별로 한 메시에 모읍니다 (_LmMesh).
# 크기·형태 중 자료가 없는 것(해태 자세 세부, 군상 인물 구성, 이웃 건물 입면)은 사진 기억 수준의 단순화입니다.
# ----------------------------------------------------------------------------
from mathutils import noise as _lm_noise
from mathutils.bvhtree import BVHTree as _LmBVH

LM_HAETAE = ((-30.0, -372.0, 'female'), (30.0, -372.0, 'male'))   # (x, y, 성별) — 좌우 어느 쪽이 수컷인지는 자료가 엇갈림
LM_HAETAE_PLINTH = (1.4, 2.4, 2.0)          # 받침 X, Y, 높이
LM_HAETAE_UP = (0.6, 3.0)                   # 밤 업라이트: 받침 가운데에서 옆 ±x, 받침 앞면에서 앞으로
LM_STONE = (46.0, -368.0)                   # 2025 상징석 중심 (1문 쪽 해태 옆 잔디)
LM_STONE_SIZE = (5.0, 2.0, 1.2)
LM_GATE_Y = -388.0                          # 앞 울타리 선 (부지 섹션 SITE_FENCE_Y 와 같음)
LM_GATES = ((37.5, '1'), (-37.5, '2'))      # 차량 문 중심 x, 번호 (1문 들어옴, 2문 나감)
LM_GATE_GAP = 7.0                           # 차량 문 반폭 (울타리 틈) → 기둥 사이 약 11.6 m
LM_PED_GAP = 5.0                            # 보행문 반폭
LM_GATE_WING = 1.4                          # 문기둥 바깥 날개벽 길이 (부지 울타리가 2.5 m 칸으로 끊겨 생기는 틈 ≤ 0.8 m 를 덮음)
LM_BOOTH = (13.5, -384.3)                   # 초소 중심 (보행문과 1문 사이, 해태 앞 시야를 가리지 않게)
LM_PEDESTAL = (32.3, -90.0, 13.6, 7.5, 2.5)  # 군상 받침: |x|, y, 길이 X, 폭 Y, 높이
LM_DECIMATE = 0.4                           # 메타볼 조각 삼각형을 이 비율로 줄임
LM_METABALL_STIFF = 2.0                     # 메타볼 공 하나의 겉 반지름 = radius * 0.574 (stiffness 2, threshold 0.6)
LM_MB_K = 0.574
LM_MB_THRESH = 0.6
LM_ROCK_AXES = ((0.0, 0.0, 0.0), (17.3, 5.1, 9.7), (3.9, 21.7, 13.1))   # 바위 흔들기 x·y·z 노이즈 표본 오프셋
LM_FIG_STIFF = 3.5                          # 군상 인물: 요소끼리 덜 녹아 붙어 관절·목이 또렷하게


# --- 메시 도우미 -------------------------------------------------------------------

class _LmMesh:
    """재질 여러 개를 쓰는 bmesh 하나 (bmesh.ops 없이 꼭짓점을 바로 만들어 부품이 많아도 빠름)."""

    def __init__(self, name, mats):
        self.name = name
        self.mats = list(mats)
        self.bm = bmesh.new()

    def face(self, pts, mi=0):
        f = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        f.material_index = mi
        return f

    def prism(self, pts, z0, z1, mi=0, mi_top=None, bottom=True):
        """XY 다각형(반시계)을 z0→z1 로 세운 기둥. 윗면 재질 mi_top."""
        a = [self.bm.verts.new((x, y, z0)) for x, y in pts]
        b = [self.bm.verts.new((x, y, z1)) for x, y in pts]
        n = len(pts)
        if bottom:
            self.bm.faces.new(a[::-1]).material_index = mi
        self.bm.faces.new(b).material_index = mi if mi_top is None else mi_top
        for i in range(n):
            j = (i + 1) % n
            self.bm.faces.new((a[i], a[j], b[j], b[i])).material_index = mi

    def box(self, x0, x1, y0, y1, z0, z1, mi=0, mi_top=None):
        x0, x1 = sorted((x0, x1))
        y0, y1 = sorted((y0, y1))
        if x1 - x0 > 1e-4 and y1 - y0 > 1e-4 and z1 - z0 > 1e-4:
            self.prism(((x0, y0), (x1, y0), (x1, y1), (x0, y1)), z0, z1, mi, mi_top)

    def obox(self, cx, cy, hx, hy, ang, z0, z1, mi=0, mi_top=None):
        """z 축으로 ang 만큼 돌린 상자 (중심, 반폭)."""
        c, s = math.cos(ang), math.sin(ang)
        pts = [(cx + c * u - s * v, cy + s * u + c * v) for u, v in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
        self.prism(pts, z0, z1, mi, mi_top)

    def beam(self, p, q, w, h, mi=0):
        """p→q 로 뻗은 네모 막대 (폭 w, 높이 h, 기울어져도 윗면이 위를 봄) — 한옥 마루."""
        p, q = Vector(p), Vector(q)
        d = (q - p).normalized()
        s = d.cross(Vector((0.0, 0.0, 1.0)))
        s = s.normalized() * (w / 2) if s.length > 1e-6 else Vector((w / 2, 0.0, 0.0))
        u = s.cross(d).normalized() * (h / 2)
        ring = [-s - u, s - u, s + u, -s + u]
        a = [self.bm.verts.new(p + c) for c in ring]
        b = [self.bm.verts.new(q + c) for c in ring]
        self.bm.faces.new(a[::-1]).material_index = mi
        self.bm.faces.new(b).material_index = mi
        for i in range(4):
            j = (i + 1) % 4
            self.bm.faces.new((a[i], a[j], b[j], b[i])).material_index = mi

    def finish(self, coll, smooth=False, place=None):
        """오브젝트로 굳힘. place 가 있으면 메시는 로컬 좌표 그대로 두고 오브젝트 행렬로 놓습니다."""
        obj = finish_mesh(self.name, self.bm, coll, self.mats, smooth=smooth, part='site')
        if place is not None:
            obj.matrix_world = place
        return obj


def _lm_ground_range(x0, x1, y0, y1, step=4.0):
    """발자국 안 지면 높이의 (최저, 최고) — 의원동산 비탈 위 건물의 바닥·기초 높이를 정할 때."""
    nx = max(2, int((x1 - x0) / step) + 1)
    ny = max(2, int((y1 - y0) / step) + 1)
    zs = [ground_z(x0 + (x1 - x0) * i / (nx - 1), y0 + (y1 - y0) * j / (ny - 1)) for i in range(nx) for j in range(ny)]
    return min(zs), max(zs)


# --- 메타볼 조각 도우미 --------------------------------------------------------------

def _lm_rot_x_to(d):
    """메타볼 요소의 로컬 X 축을 방향 d 로 돌리는 쿼터니언 (캡슐·타원체 방향 맞춤)."""
    d = Vector(d)
    if d.length < 1e-9:
        return Vector((1.0, 0.0, 0.0)).rotation_difference(Vector((1.0, 0.0, 0.0)))
    return Vector((1.0, 0.0, 0.0)).rotation_difference(d.normalized())


class _LmSculpt:
    """메타볼 요소 목록. 크기는 모두 '겉 반지름'(m) 으로 받아 radius 로 바꿉니다.
    stiff 를 주면 그 값이 기본 stiffness 가 되고 요소마다 stiffness 에 맞는 비율로 정확히 나눕니다 (군상 인물).
    주지 않으면 stiffness 2 기준 LM_MB_K 하나로 나눕니다 (해태 — 작은 털 뭉치는 stiffness 3 이라 조금 더 큼)."""

    def __init__(self, stiff=None):
        self.elems = []
        self.stiff = stiff or LM_METABALL_STIFF
        self.exact = stiff is not None

    def _radius(self, s, stiff):
        k = math.sqrt(1.0 - (LM_MB_THRESH / stiff) ** (1.0 / 3.0)) if self.exact else LM_MB_K
        return s / k

    def ball(self, p, s, stiff=None, neg=False):
        st = stiff or self.stiff
        self.elems.append(('BALL', Vector(p), self._radius(s, st), st, None, None, neg))

    def ellip(self, p, s3, rot=None, stiff=None, neg=False):
        """타원체: s3 = 로컬 X·Y·Z 겉 반지름, rot = 쿼터니언(없으면 축 정렬)."""
        st = stiff or self.stiff
        r = max(s3)
        size = tuple(v / r for v in s3)
        self.elems.append(('ELLIPSOID', Vector(p), self._radius(r, st), st, size, rot, neg))

    def capsule(self, a, b, s, stiff=None, neg=False):
        """a→b 캡슐 (굵기 겉 반지름 s)."""
        st = stiff or self.stiff
        a, b = Vector(a), Vector(b)
        half = (b - a).length / 2.0
        self.elems.append(('CAPSULE', (a + b) / 2.0, self._radius(s, st), st, (half, 1.0, 1.0),
                           _lm_rot_x_to(b - a), neg))

    def chain(self, pts, radii, stiff=None):
        """점 목록을 잇는 캡슐 사슬 (굵기는 구간 양 끝 평균)."""
        for i in range(len(pts) - 1):
            self.capsule(pts[i], pts[i + 1], (radii[i] + radii[i + 1]) / 2.0, stiff)

    def mirror_x(self, start):
        """start 이후에 넣은 요소를 x → -x 로 복제 (좌우 대칭 부위)."""
        for kind, p, r, st, size, rot, neg in list(self.elems[start:]):
            q = None
            if rot is not None:
                q = rot.copy()
                q.y, q.z = -q.y, -q.z          # YZ 평면 거울: 회전축 (x, y, z) → (x, -y, -z)
            self.elems.append((kind, Vector((-p.x, p.y, p.z)), r, st, size, q, neg))

    def transform(self, start, matrix):
        """start 이후 요소를 4x4 행렬로 옮김 (머리 돌리기 등)."""
        rot = matrix.to_quaternion()
        for i in range(start, len(self.elems)):
            kind, p, r, st, size, q, neg = self.elems[i]
            self.elems[i] = (kind, matrix @ p, r, st, size, (rot @ q) if q is not None else
                             (rot.copy() if kind != 'BALL' else None), neg)


def _lm_bake(temps):
    """임시 오브젝트(메타볼·글자 곡선·수정자 달린 메시)를 한 번의 depsgraph 평가로 메시로 굳히고 지웁니다.
    메타볼은 이름 앞부분이 같으면 한 덩어리로 합쳐지므로 임시 이름을 서로 다르게 붙입니다."""
    for ob in temps:
        bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    out = [bpy.data.meshes.new_from_object(ob.evaluated_get(dg)) for ob in temps]
    store = {'META': bpy.data.metaballs, 'FONT': bpy.data.curves, 'MESH': bpy.data.meshes}
    for ob in temps:
        kind, data = ob.type, ob.data
        bpy.data.objects.remove(ob, do_unlink=True)
        if data.users == 0:
            store[kind].remove(data)
    return out


def _lm_metaball_temp(name, sculpt, res):
    """_LmSculpt → 임시 메타볼 오브젝트 (해상도 res m)."""
    mb = bpy.data.metaballs.new('LmMB_' + name)
    mb.resolution = res
    mb.render_resolution = res
    mb.threshold = LM_MB_THRESH
    for kind, p, r, stiff, size, rot, neg in sculpt.elems:
        e = mb.elements.new(type=kind)
        e.co = p
        e.radius = r
        e.stiffness = stiff
        e.use_negative = neg
        if size is not None:
            e.size_x, e.size_y, e.size_z = size
        if rot is not None:
            e.rotation = rot
    return bpy.data.objects.new('LmMB_' + name, mb)


def _lm_text_temp(i, body, size):
    """임시 글자 곡선 오브젝트 (내장 글꼴 → 한글은 번들 Noto CJK 로 대체됨). 로컬 XY 평면(+Z 를 봄)에 가운데 정렬."""
    cu = bpy.data.curves.new(f'LmText{i}', 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.resolution_u = 3
    return bpy.data.objects.new(f'LmText{i}', cu)


class _LmBaker:
    """메타볼 조각과 글자를 모아 두었다가 depsgraph 평가 두 번으로 한꺼번에 메시로 굳힙니다
    (큰 장면에서 평가 한 번이 약 0.25 s 라 부위마다 따로 굳히지 않음). 조각은 Decimate 로 삼각형을 줄여
    곱슬 털 같은 굴곡은 살리고 평평한 곳만 덜어냅니다."""

    def __init__(self):
        self.sculpts = []       # (오브젝트 이름, _LmSculpt, 해상도 m, 월드 행렬, decimate 비율, 재질)
        self.texts = {}         # 오브젝트 이름 → (재질, [(글자, 크기, 월드 행렬)])

    def sculpt(self, name, sc, res, matrix, ratio, mat):
        self.sculpts.append((name, sc, res, matrix, ratio, mat))

    def text(self, name, mat, body, size, matrix):
        self.texts.setdefault(name, (mat, []))[1].append((body, size, matrix))

    def run(self, coll):
        items = [(name, it) for name, (_, lst) in self.texts.items() for it in lst]
        temps = [_lm_metaball_temp(f'{i}_{s[0]}', s[1], s[2]) for i, s in enumerate(self.sculpts)]
        temps += [_lm_text_temp(i, body, size) for i, (_, (body, size, _)) in enumerate(items)]
        meshes = _lm_bake(temps)
        raw, glyphs = meshes[:len(self.sculpts)], meshes[len(self.sculpts):]
        dec = []
        for me, (name, _, _, matrix, ratio, _) in zip(raw, self.sculpts):
            me.transform(matrix)
            ob = bpy.data.objects.new('LmDec_' + name, me)
            ob.modifiers.new('Decimate', 'DECIMATE').ratio = ratio
            dec.append(ob)
        for me, (name, _, _, _, _, mat) in zip(_lm_bake(dec), self.sculpts):
            me.name = name
            _lm_mesh_object(name, me, coll, [mat])
        groups = {}
        for me, (name, (_, _, matrix)) in zip(glyphs, items):
            me.transform(matrix)
            groups.setdefault(name, bmesh.new()).from_mesh(me)
            bpy.data.meshes.remove(me)
        for name, bm in groups.items():
            finish_mesh(name, bm, coll, self.texts[name][0], part='site')


def _lm_mesh_object(name, me, coll, mats, smooth=True):
    """굳힌 메시 → 오브젝트 (재질 목록, 스무스)."""
    for m in mats:
        me.materials.append(m)
    if smooth:
        me.shade_smooth()
    obj = bpy.data.objects.new(name, me)
    coll.objects.link(obj)
    obj['na_part'] = 'site'
    return obj


# --- 재질 -----------------------------------------------------------------------

def _lm_coords(nt, scale=(1.0, 1.0, 1.0)):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = node(nt, 'ShaderNodeMapping', Scale=scale)
    link(nt, tc.outputs['Object'], mp.inputs['Vector'])
    return mp.outputs['Vector']


def _lm_ramp(nt, fac, stops):
    cr = nt.nodes.new('ShaderNodeValToRGB')
    r = cr.color_ramp
    while len(r.elements) < len(stops):
        r.elements.new(0.5)
    for e, (pos, col) in zip(r.elements, stops):
        e.position = pos
        e.color = (*col, 1.0)
    link(nt, fac, cr.inputs['Factor'])
    return cr.outputs['Color']


def _lm_math(nt, op, a, b=None):
    m = node(nt, 'ShaderNodeMath', operation=op)
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if hasattr(v, 'is_output'):
            link(nt, v, m.inputs[i])
        else:
            m.inputs[i].default_value = v
    return m.outputs['Value']


def _lm_maprange(nt, val, a, b, c=0.0, d=1.0):
    m = node(nt, 'ShaderNodeMapRange', From_Min=a, From_Max=b, To_Min=c, To_Max=d)
    link(nt, val, m.inputs['Value'])
    return m.outputs['Result']


def _lm_bump(nt, bsdf, height, strength, distance=0.02):
    b = node(nt, 'ShaderNodeBump', Strength=strength, Distance=distance)
    link(nt, height, b.inputs['Height'])
    link(nt, b.outputs['Normal'], bsdf.inputs['Normal'])


def _lm_cavity(nt, lo=0.40, hi=0.5):
    """오목한 곳 = 1 (Cycles 의 Pointiness). 조각의 틈을 어둡게 해 형태를 읽히게 합니다."""
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    return _lm_maprange(nt, geo.outputs['Pointiness'], lo, hi, 1.0, 0.0)


def _lm_mat_marble():
    """해태 대리석: 따뜻한 흰색, 옅은 회색 결, 틈(AO·Pointiness)에 낀 때 — 조각의 굴곡이 읽히도록."""
    mat, nt, bsdf = new_pbr('LM_Marble_Haetae', (0.66, 0.64, 0.60), 0.42)
    co = _lm_coords(nt)
    wave = node(nt, 'ShaderNodeTexWave', Scale=0.9, Distortion=9.0, Detail=5.0, Detail_Scale=1.2)
    link(nt, co, wave.inputs['Vector'])
    vein = _lm_ramp(nt, wave.outputs['Factor'], [(0.0, (0.66, 0.65, 0.62)), (0.03, (0.76, 0.74, 0.70)),
                                                 (1.0, (0.80, 0.78, 0.73))])
    nz = node(nt, 'ShaderNodeTexNoise', Scale=2.5, Detail=6.0, Roughness=0.6)
    link(nt, co, nz.inputs['Vector'])
    mottle = _lm_ramp(nt, nz.outputs['Factor'], [(0.3, (0.80, 0.79, 0.76)), (0.7, (0.95, 0.95, 0.94))])
    col = mix_color(nt, 1.0, vein, mottle, 'MULTIPLY')
    ao = node(nt, 'ShaderNodeAmbientOcclusion', Distance=0.12)
    grime = _lm_math(nt, 'MAXIMUM', _lm_maprange(nt, ao.outputs['AO'], 0.35, 0.95, 0.75, 0.0),
                     _lm_math(nt, 'MULTIPLY', _lm_cavity(nt, 0.44, 0.5), 0.5))
    col = mix_color(nt, grime, col, (0.30, 0.28, 0.25))
    link(nt, col, bsdf.inputs['Base Color'])
    link(nt, _lm_maprange(nt, nz.outputs['Factor'], 0.3, 0.7, 0.32, 0.5), bsdf.inputs['Roughness'])
    _lm_bump(nt, bsdf, nz.outputs['Factor'], 0.08, 0.01)
    return mat


def _lm_mat_stone(name, base, rough=0.75, speck=35.0, bump=0.25):
    """돌·회벽 계열 (받침·상징석·한옥 기단·회벽): 큰 얼룩 + 반점(speck = 반점 밀도) + 범프."""
    mat, nt, bsdf = new_pbr(name, base, rough)
    co = _lm_coords(nt)
    nz = node(nt, 'ShaderNodeTexNoise', Scale=0.8, Detail=6.0, Roughness=0.6)
    link(nt, co, nz.inputs['Vector'])
    dk = tuple(c * 0.82 for c in base)
    lt = tuple(min(1.0, c * 1.1) for c in base)
    col = _lm_ramp(nt, nz.outputs['Factor'], [(0.3, dk), (0.7, lt)])
    vo = node(nt, 'ShaderNodeTexVoronoi', Scale=speck)
    link(nt, co, vo.inputs['Vector'])
    sp = _lm_ramp(nt, vo.outputs['Distance'], [(0.0, (0.35, 0.34, 0.33)), (0.15, (1.0, 1.0, 1.0))])
    col = mix_color(nt, 0.3, col, sp, 'MULTIPLY')
    link(nt, col, bsdf.inputs['Base Color'])
    height = _lm_math(nt, 'ADD', nz.outputs['Factor'], _lm_math(nt, 'MULTIPLY', vo.outputs['Distance'], 0.3))
    _lm_bump(nt, bsdf, height, bump, 0.02)
    return mat


def _lm_mat_simple(name, color, rough=0.5, metal=0.0, emission=None, strength=0.0, **extra):
    return new_pbr(name, color, rough, metal, emission, strength, **extra)[0]


def _lm_mat_bronze():
    """'애국애족의 군상' 짙은 청동: 얼룩진 갈색 금속, 오목한 곳과 빗물 줄에 녹청."""
    mat, nt, bsdf = new_pbr('LM_Bronze_Dark', (0.085, 0.064, 0.045), 0.58, 0.8)
    co = _lm_coords(nt)
    nz = node(nt, 'ShaderNodeTexNoise', Scale=1.5, Detail=5.0, Roughness=0.6)
    link(nt, co, nz.inputs['Vector'])
    col = _lm_ramp(nt, nz.outputs['Factor'], [(0.3, (0.05, 0.037, 0.026)), (0.7, (0.13, 0.092, 0.058))])
    streak = node(nt, 'ShaderNodeTexNoise', Scale=2.0, Detail=3.0)
    link(nt, _lm_coords(nt, (3.0, 3.0, 0.25)), streak.inputs['Vector'])
    pat = _lm_math(nt, 'MAXIMUM', _lm_cavity(nt, 0.42, 0.5), _lm_maprange(nt, streak.outputs['Factor'], 0.55, 0.75))
    pat = _lm_math(nt, 'MULTIPLY', pat, 0.75)
    col = mix_color(nt, pat, col, (0.10, 0.19, 0.15))
    link(nt, col, bsdf.inputs['Base Color'])
    link(nt, _lm_maprange(nt, pat, 0.0, 0.75, 0.85, 0.2), bsdf.inputs['Metallic'])
    link(nt, _lm_maprange(nt, pat, 0.0, 0.75, 0.52, 0.8), bsdf.inputs['Roughness'])
    _lm_bump(nt, bsdf, nz.outputs['Factor'], 0.1, 0.01)
    return mat


def _lm_facing_u(nt):
    """벽·지붕 면을 따라가는 가로 좌표: Y 를 보는 면은 x, X 를 보는 면은 y (오브젝트 공간 법선으로 고름)."""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sn = nt.nodes.new('ShaderNodeSeparateXYZ')
    sp = nt.nodes.new('ShaderNodeSeparateXYZ')
    link(nt, tc.outputs['Normal'], sn.inputs['Vector'])
    link(nt, tc.outputs['Object'], sp.inputs['Vector'])
    side = _lm_math(nt, 'GREATER_THAN', _lm_math(nt, 'ABSOLUTE', sn.outputs['X']),
                    _lm_math(nt, 'ABSOLUTE', sn.outputs['Y']))
    u = _lm_math(nt, 'ADD', _lm_math(nt, 'MULTIPLY', sp.outputs['X'], _lm_math(nt, 'SUBTRACT', 1.0, side)),
                 _lm_math(nt, 'MULTIPLY', sp.outputs['Y'], side))
    return u, sp.outputs['Z']


def _lm_stripes(nt, coord, spacing, width):
    """간격 spacing 마다 폭 width 인 줄 = 1."""
    fr = _lm_math(nt, 'FRACT', _lm_math(nt, 'DIVIDE', coord, spacing))
    return _lm_math(nt, 'LESS_THAN', fr, width / spacing)


def _lm_mat_giwa():
    """한옥 기와: 짙은 회색, 경사를 따라 내려가는 기와 골(0.32 m)을 범프로, 골마다 조금씩 다른 색."""
    mat, nt, bsdf = new_pbr('LM_Hanok_Giwa', (0.10, 0.105, 0.11), 0.55)
    u, _ = _lm_facing_u(nt)
    ph = _lm_math(nt, 'SINE', _lm_math(nt, 'MULTIPLY', u, 2 * math.pi / 0.32))
    ridge = _lm_math(nt, 'POWER', _lm_math(nt, 'ABSOLUTE', ph), 0.5)
    nz = node(nt, 'ShaderNodeTexNoise', Scale=0.6, Detail=4.0)
    link(nt, _lm_coords(nt), nz.inputs['Vector'])
    col = _lm_ramp(nt, nz.outputs['Factor'], [(0.3, (0.07, 0.074, 0.08)), (0.7, (0.14, 0.145, 0.15))])
    col = mix_color(nt, _lm_math(nt, 'MULTIPLY', ridge, 0.35), col, (0.20, 0.205, 0.21))
    link(nt, col, bsdf.inputs['Base Color'])
    _lm_bump(nt, bsdf, ridge, 0.7, 0.06)
    return mat


def _lm_mat_timber():
    """소나무 목재 (단청 없음): 따뜻한 갈색, 세로로 늘인 결 무늬."""
    mat, nt, bsdf = new_pbr('LM_Hanok_Timber', (0.34, 0.22, 0.12), 0.7)
    nz = node(nt, 'ShaderNodeTexNoise', Scale=6.0, Detail=6.0, Distortion=0.4)
    link(nt, _lm_coords(nt, (1.0, 1.0, 0.08)), nz.inputs['Vector'])
    col = _lm_ramp(nt, nz.outputs['Factor'], [(0.3, (0.24, 0.15, 0.08)), (0.7, (0.42, 0.28, 0.16))])
    link(nt, col, bsdf.inputs['Base Color'])
    _lm_bump(nt, bsdf, nz.outputs['Factor'], 0.15, 0.01)
    return mat


def _lm_mat_gable():
    """합각 널벽: 세로로 댄 짙은 널판 (널마다 조금씩 다른 색, 이음 줄 범프)."""
    mat, nt, bsdf = new_pbr('LM_Hanok_Gable', (0.22, 0.15, 0.10), 0.75)
    u, _ = _lm_facing_u(nt)
    plank = _lm_math(nt, 'FLOOR', _lm_math(nt, 'DIVIDE', u, 0.24))
    wn = nt.nodes.new('ShaderNodeTexWhiteNoise')
    wn.noise_dimensions = '1D'
    link(nt, plank, wn.inputs['W'])
    col = _lm_ramp(nt, wn.outputs['Value'], [(0.0, (0.16, 0.10, 0.06)), (1.0, (0.30, 0.20, 0.12))])
    seam = _lm_stripes(nt, u, 0.24, 0.02)
    col = mix_color(nt, seam, col, (0.05, 0.035, 0.025))
    link(nt, col, bsdf.inputs['Base Color'])
    _lm_bump(nt, bsdf, _lm_math(nt, 'SUBTRACT', 1.0, seam), 0.4, 0.01)
    return mat


def _lm_mat_soffit():
    """처마 밑: 경사를 따라 내려가는 서까래(갈색)와 그 사이 흰 회반죽(앙토) 줄."""
    mat, nt, bsdf = new_pbr('LM_Hanok_Soffit', (0.45, 0.36, 0.27), 0.75)
    u, _ = _lm_facing_u(nt)
    raft = _lm_stripes(nt, u, 0.36, 0.2)
    col = mix_color(nt, raft, (0.74, 0.71, 0.65), (0.30, 0.19, 0.10))
    link(nt, col, bsdf.inputs['Base Color'])
    _lm_bump(nt, bsdf, raft, 0.5, 0.05)
    set_flat(mat, color=(0.49, 0.42, 0.34))
    return mat


def _lm_mat_lattice(night):
    """창살문: 한지(밝은 미색) 위 가로 0.22 · 세로 0.30 m 나무 살. 밤에는 한지가 따뜻하게 빛납니다."""
    glow = (1.0, 0.72, 0.42) if night else None
    mat, nt, bsdf = new_pbr('LM_Hanok_Lattice', (0.72, 0.67, 0.58), 0.8, emission=glow,
                            emission_strength=1.2 if night else 0.0)
    u, z = _lm_facing_u(nt)
    bars = _lm_math(nt, 'MAXIMUM', _lm_stripes(nt, u, 0.22, 0.035), _lm_stripes(nt, z, 0.30, 0.035))
    col = mix_color(nt, bars, (0.88, 0.85, 0.76), (0.32, 0.20, 0.11))
    link(nt, col, bsdf.inputs['Base Color'])
    if night:
        link(nt, _lm_math(nt, 'MULTIPLY', _lm_math(nt, 'SUBTRACT', 1.0, bars), 1.2), bsdf.inputs['Emission Strength'])
    _lm_bump(nt, bsdf, bars, 0.3, 0.01)
    set_flat(mat, color=(0.72, 0.67, 0.58), emission_strength=0.9 if night else 0.0)
    return mat


def _lm_mat_glass(name, tint, night):
    """이웃 건물 유리: 어두운 반사 유리 (tint), 창 칸(1.6 x 1.6 x 3.8 m)마다 조금씩 다른 색·거칠기.
    밤에는 칸의 약 7분의 1 에 따뜻한 불이 은은하게 켜집니다 (본관보다 약하게)."""
    mat, nt, bsdf = new_pbr(name, tint, 0.12, 0.3, emission=(1.0, 0.74, 0.46) if night else None,
                            emission_strength=0.0, Coat_Weight=0.5, Specular_IOR_Level=0.8)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = node(nt, 'ShaderNodeMapping', Scale=(1 / 1.6, 1 / 1.6, 1 / 3.8))
    link(nt, tc.outputs['Object'], mp.inputs['Vector'])
    fl = node(nt, 'ShaderNodeVectorMath', operation='FLOOR')
    link(nt, mp.outputs['Vector'], fl.inputs[0])
    wn = nt.nodes.new('ShaderNodeTexWhiteNoise')
    link(nt, fl.outputs['Vector'], wn.inputs['Vector'])
    col = mix_color(nt, _lm_math(nt, 'MULTIPLY', wn.outputs['Value'], 0.6), tint,
                    tuple(min(1.0, c * 1.9) for c in tint))
    link(nt, col, bsdf.inputs['Base Color'])
    link(nt, _lm_maprange(nt, wn.outputs['Value'], 0.0, 1.0, 0.05, 0.16), bsdf.inputs['Roughness'])
    if night:
        lit = _lm_math(nt, 'GREATER_THAN', wn.outputs['Value'], 0.86)
        link(nt, _lm_math(nt, 'MULTIPLY', lit, _lm_maprange(nt, wn.outputs['Value'], 0.86, 1.0, 0.35, 0.9)),
             bsdf.inputs['Emission Strength'])
        set_flat(mat, emission_strength=0.12)
    return mat


def _lm_materials(ctx):
    """상징물 전용 재질 dict (ctx.material 캐시). 밤이면 번호판·등기구·한옥 창호가 빛납니다."""
    night = ctx.night
    m = ctx.material
    return {
        'marble': m('lm_marble', _lm_mat_marble),
        'plinth': m('lm_plinth', lambda: _lm_mat_stone('LM_Plinth_Granite', (0.60, 0.58, 0.55), 0.7)),
        'uplight': m('lm_uplight', lambda: _lm_mat_simple(
            'LM_Uplight', (0.12, 0.12, 0.12), 0.4, 0.6, emission=(1.0, 0.82, 0.58) if night else None,
            strength=30.0 if night else 0.0)),
        'rock': m('lm_rock', lambda: _lm_mat_stone('LM_Rock', (0.44, 0.42, 0.39), 0.85, 14.0, 0.9)),
        'rock_face': m('lm_rock_face', lambda: _lm_mat_stone('LM_Rock_Face', (0.56, 0.54, 0.51), 0.55, 40.0, 0.1)),
        'ink': m('lm_ink', lambda: _lm_mat_simple('LM_Stone_Letters', (0.025, 0.025, 0.025), 0.55)),
        'white_stone': m('lm_white_stone', lambda: _lm_mat_stone(
            'LM_Gatepost_White', (0.80, 0.79, 0.76), 0.5, 60.0, 0.08)),
        'white_steel': m('lm_white_steel', lambda: _lm_mat_simple('LM_Gate_Steel', (0.80, 0.81, 0.80), 0.35, 0.4)),
        'sign': m('lm_sign', lambda: _lm_mat_simple('LM_Sign_Panel', (0.02, 0.035, 0.08), 0.35, 0.3)),
        'sign_glow': m('lm_sign_glow', lambda: _lm_mat_simple(
            'LM_Sign_Letters', (0.92, 0.92, 0.90), 0.4, emission=(0.80, 0.90, 1.0) if night else None,
            strength=12.0 if night else 0.0)),
        'bronze_dark': m('lm_bronze_dark', _lm_mat_bronze),
        'glass': ctx.mats['glass'],
        'nglass': m('lm_glass', lambda: _lm_mat_glass('LM_Glass_Neighbour', (0.045, 0.06, 0.075), night)),
        'nglass_green': m('lm_glass_green', lambda: _lm_mat_glass('LM_Glass_GreyGreen', (0.05, 0.075, 0.068), night)),
        'roof': m('lm_roof', lambda: _lm_mat_stone('LM_Flat_Roof', (0.36, 0.37, 0.37), 0.9, 8.0, 0.05)),
        'render': m('lm_render', lambda: _lm_mat_stone('LM_Render', (0.80, 0.77, 0.70), 0.85, 50.0, 0.05)),
        'white_panel': m('lm_white_panel', lambda: _lm_mat_simple('LM_White_Panel', (0.84, 0.85, 0.85), 0.3, 0.4)),
        'giwa': m('lm_giwa', _lm_mat_giwa),
        'hanok_gable': m('lm_gable', _lm_mat_gable),
        'hanok_soffit': m('lm_soffit', _lm_mat_soffit),
        'timber': m('lm_timber', _lm_mat_timber),
        'plaster': m('lm_plaster', lambda: _lm_mat_stone('LM_Plaster', (0.84, 0.83, 0.79), 0.9, 80.0, 0.03)),
        'lattice': m('lm_lattice', lambda: _lm_mat_lattice(night)),
        'hanok_stone': m('lm_hanok_stone', lambda: _lm_mat_stone('LM_Hanok_Stone', (0.60, 0.58, 0.54), 0.8, 20.0,
                                                                 0.35)),
    }


# --- 해태 -------------------------------------------------------------------------

def _lm_haetae_legs(sc, b):
    """네 다리 (한쪽을 만들고 거울 복제): 큰 발·발톱, 굵은 앞다리와 어깨, 뒷넓적다리·정강이·발목, 곱슬 털 뭉치."""
    start = len(sc.elems)
    x = 0.30
    for py in (-0.84, 0.72):                                                     # 앞발, 뒷발
        sc.ellip((x, py, b + 0.12), (0.19, 0.25, 0.12))
        for dx in (-0.10, -0.035, 0.035, 0.10):
            sc.ball((x + dx, py - 0.24, b + 0.07), 0.055, stiff=3.0)              # 발가락
    sc.capsule((x, -0.80, b + 0.18), (x, -0.72, b + 0.70), 0.17)                 # 앞다리
    sc.capsule((x, -0.72, b + 0.70), (x - 0.03, -0.62, b + 1.02), 0.21)
    sc.ball((x - 0.05, -0.60, b + 1.06), 0.25)                                   # 어깨
    for ty, tz in ((-0.55, b + 0.72), (-0.52, b + 0.60), (-0.57, b + 0.85)):
        sc.ball((x + 0.03, ty, tz), 0.075, stiff=3.0)                             # 팔꿈치 뒤 털 뭉치
    sc.capsule((x, 0.74, b + 0.16), (x, 0.88, b + 0.46), 0.14)                    # 뒷발목
    sc.capsule((x, 0.88, b + 0.46), (x - 0.02, 0.66, b + 0.78), 0.17)            # 정강이
    sc.ball((x - 0.05, 0.68, b + 1.00), 0.34)                                    # 넓적다리
    for ty, tz in ((0.97, b + 0.50), (0.99, b + 0.38)):
        sc.ball((x + 0.02, ty, tz), 0.065, stiff=3.0)
    sc.mirror_x(start)


def _lm_haetae_body(sc, b):
    """몸통·목·등줄기 털·꼬리."""
    sc.ball((0.0, -0.55, b + 1.13), 0.45)                                        # 가슴
    sc.ellip((0.0, -0.10, b + 1.10), (0.39, 0.48, 0.35))                         # 갈비
    sc.ellip((0.0, 0.36, b + 1.09), (0.33, 0.34, 0.30))                          # 허리
    sc.ball((0.0, 0.68, b + 1.12), 0.36)                                         # 엉덩이
    sc.capsule((0.0, -0.60, b + 1.32), (0.0, -0.84, b + 1.68), 0.30)             # 목
    for i in range(8):
        y = -0.36 + 0.14 * i
        sc.ball(((-1) ** i * 0.06, y, b + 1.43 - 0.012 * i), 0.075, stiff=3.0)   # 등줄기 털
    _lm_haetae_tail(sc, b)
    for sx in (-1, 1):                                                         # 어깨 뒤로 흩날리는 불꽃 털
        for k in range(3):
            sc.ball((sx * (0.36 - 0.02 * k), -0.52 + 0.12 * k, b + 1.22 + 0.05 * k), 0.07 - 0.01 * k, stiff=3.0)


def _lm_haetae_tail(sc, b):
    """꼬리: 엉덩이 위로 조금 솟았다가 앞으로 말려 엉덩이에 붙는 굵은 소용돌이, 끝은 등을 따라 앞으로 눕는 불꽃 털
    세 가닥 (가운데 굵고 양옆 가늘게, 끝이 가늘어지며 살짝 들림 — 공이 녹아 붙도록 stiffness 2). 머리보다 한참 낮습니다."""
    curl = [(0.0, 0.98, b + 1.22), (0.0, 1.09, b + 1.36), (0.0, 1.08, b + 1.51), (0.0, 0.98, b + 1.59),
            (0.0, 0.85, b + 1.59), (0.0, 0.75, b + 1.53)]
    sc.chain(curl, (0.13, 0.12, 0.11, 0.10, 0.095, 0.085))
    for sx, w in ((0.0, 1.0), (-1.0, 0.75), (1.0, 0.75)):
        sc.chain([(sx * 0.06, 0.74, b + 1.54), (sx * 0.10, 0.62, b + 1.58), (sx * 0.12, 0.52, b + 1.62)],
                 (0.075 * w, 0.05 * w, 0.022 * w))


def _lm_haetae_head(sc, b, male):
    """머리: 정수리·눈썹·튀어나온 눈(눈동자 홈)·볼·주둥이·코·송곳니·턱(수컷은 입을 벌림)·귀·외뿔·갈기."""
    sc.ball((0.0, -0.94, b + 1.86), 0.32)                                        # 정수리
    sc.capsule((-0.19, -1.14, b + 1.95), (0.19, -1.14, b + 1.95), 0.075)         # 눈썹
    for sx in (-1, 1):
        sc.ball((sx * 0.15, -1.19, b + 1.87), 0.095, stiff=3.5)                  # 눈
        sc.ball((sx * 0.15, -1.29, b + 1.87), 0.03, stiff=4.0, neg=True)         # 눈동자 홈
        sc.ball((sx * 0.20, -1.08, b + 1.72), 0.18)                              # 볼
        sc.ellip((sx * 0.30, -0.88, b + 2.00), (0.06, 0.11, 0.08))               # 귀
        sc.capsule((sx * 0.11, -1.31, b + 1.64), (sx * 0.11, -1.32, b + 1.55), 0.038, stiff=3.0)   # 송곳니
        sc.ball((sx * 0.065, -1.38, b + 1.76), 0.05)                             # 콧방울
    sc.ellip((0.0, -1.20, b + 1.70), (0.21, 0.16, 0.13))                         # 주둥이
    sc.ellip((0.0, -1.33, b + 1.78), (0.11, 0.07, 0.075))                        # 코
    sc.ellip((0.0, -1.15, b + 1.50), (0.17, 0.15, 0.07))                         # 아래턱
    if male:
        sc.ellip((0.0, -1.29, b + 1.595), (0.155, 0.12, 0.045), neg=True)        # 벌린 입
    horn = 0.05 if male else 0.042
    sc.capsule((0.0, -0.99, b + 2.10), (0.0, -0.93, b + 2.24), horn)             # 외뿔
    sc.ball((0.0, -0.91, b + 2.26), horn * 0.8, stiff=3.0)
    _lm_haetae_mane(sc, (0.0, -0.86, b + 1.66), 0.40 if male else 0.37, 130 if male else 110)
    for sx in (-1, 1):                                                           # 턱 밑 수염 곱슬
        for k in range(3):
            sc.ball((sx * (0.08 + 0.07 * k), -1.08 + 0.05 * k, b + 1.42 - 0.02 * k), 0.06, stiff=3.0)


def _lm_haetae_mane(sc, c, rad, n):
    """갈기: 얼굴 뒤·옆과 목 둘레를 덮는 작은 곱슬 뭉치 (피보나치 구면 배치, 얼굴 쪽은 비움)."""
    golden = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(n):
        z = 1.0 - 2.0 * (i + 0.5) / n
        r = math.sqrt(1.0 - z * z)
        a = golden * i
        d = Vector((r * math.cos(a), r * math.sin(a), z))
        if d.y < -0.35 or d.z < -0.70:
            continue
        sc.ball(Vector(c) + d * rad, 0.07, stiff=3.0)


def _lm_haetae_sculpt(male, turn):
    """해태 한 마리의 메타볼 요소 (로컬: 받침 윗면 중심 원점, 머리 -Y, 높이 약 2.4 m)."""
    sc = _LmSculpt()
    b = 0.12                                                                     # 조각에 붙은 얇은 바닥돌 두께
    _lm_haetae_legs(sc, b)
    _lm_haetae_body(sc, b)
    start = len(sc.elems)
    _lm_haetae_head(sc, b, male)
    pivot = Vector((0.0, -0.72, b + 1.55))
    sc.transform(start, Matrix.Translation(pivot) @ Matrix.Rotation(turn, 4, 'Z') @ Matrix.Translation(-pivot))
    return sc


def _lm_haetae(ctx, coll, mt, bk):
    """해태 한 쌍: 화강석 받침(굽·몸·갓돌) + 대리석 조각 + 밤 업라이트."""
    px, py, ph = LM_HAETAE_PLINTH
    plinth = _LmMesh('LM_Haetae_Plinths', [mt['plinth'], mt['marble'], mt['uplight']])
    for hx, hy, sex in LM_HAETAE:
        plinth.box(hx - px / 2 - 0.12, hx + px / 2 + 0.12, hy - py / 2 - 0.12, hy + py / 2 + 0.12, -0.3, 0.35)
        plinth.box(hx - px / 2, hx + px / 2, hy - py / 2, hy + py / 2, 0.35, ph - 0.16)
        plinth.box(hx - px / 2 - 0.08, hx + px / 2 + 0.08, hy - py / 2 - 0.08, hy + py / 2 + 0.08, ph - 0.16, ph)
        plinth.box(hx - 0.50, hx + 0.50, hy - 1.08, hy + 1.08, ph, ph + 0.12, 1)     # 조각 바닥돌
        for sx in (-1, 1):
            ux, uy = hx + sx * LM_HAETAE_UP[0], hy - py / 2 - LM_HAETAE_UP[1]
            plinth.box(ux - 0.14, ux + 0.14, uy - 0.1, uy + 0.1, -0.05, 0.06, 2)    # 바닥 업라이트 (받침 앞 3 m)
        male = sex == 'male'
        turn = math.radians(7.0 if hx < 0 else -7.0)                               # 머리를 살짝 축(보행문) 쪽으로
        bk.sculpt('LM_Haetae_' + sex, _lm_haetae_sculpt(male, turn), 0.028, Matrix.Translation((hx, hy, ph)),
                  LM_DECIMATE, mt['marble'])
    plinth.finish(coll)
    if ctx.night:
        for hx, hy, _ in LM_HAETAE:
            for sx in (-1, 1):
                _lm_spot(coll, f'LM_Haetae_Up_{hx:+.0f}_{sx}',
                         (hx + sx * LM_HAETAE_UP[0], hy - py / 2 - LM_HAETAE_UP[1], 0.12),
                         (hx, hy - 0.4, ph + 1.75), 520.0, (1.0, 0.86, 0.66), 22.0)


def _lm_spot(coll, name, loc, target, energy, color, size_deg):
    """조각 업라이트용 스폿 (target 을 향함, 부드러운 가장자리)."""
    ld = bpy.data.lights.new(name, 'SPOT')
    ld.energy = energy
    ld.color = color
    ld.spot_size = math.radians(size_deg)
    ld.spot_blend = 0.6
    ld.shadow_soft_size = 0.15
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    d = Vector(target) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    ob['na_part'] = 'site'
    coll.objects.link(ob)
    return ob


# --- 2025 상징석 -----------------------------------------------------------------

def _lm_rock_bm(sx, sy, sz, seed, sink=0.45, detail=4, rough=0.0):
    """자연석 덩어리: 이코스피어를 노이즈(부드러운 덩어리 + 모난 세포 무늬)로 울퉁불퉁하게 한 뒤 크기 (sx, sy, sz) 에
    맞춤 (바닥 z = 0 아래로 sink 만큼 묻히고 -0.15 에서 평평히 자름). rough = 크기를 맞춘 뒤 월드 크기(m) 노이즈로
    한 번 더 흔드는 폭 — 길쭉한 바위에서 무늬가 길게 늘어나지 않게."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
    off = Vector((seed * 0.37, seed * 0.11, seed * 0.23))
    for v in bm.verts:
        d = v.co.normalized()
        k = (1.0 + 0.26 * _lm_noise.fractal(d * 0.9 + off, 0.7, 2.0, 4)
             - 0.10 * _lm_noise.noise(d * 2.2 + off, noise_basis='VORONOI_F2F1')
             + 0.03 * _lm_noise.noise(d * 6.0 + off))
        hump = 1.0 + 0.22 * math.exp(-((d.x + 0.35) ** 2) * 6.0)                 # 한쪽으로 치우친 봉우리
        v.co = Vector((d.x * k, d.y * k, d.z * k * hump))
    lo = [min(v.co[i] for v in bm.verts) for i in range(3)]
    hi = [max(v.co[i] for v in bm.verts) for i in range(3)]
    for v in bm.verts:
        v.co = Vector(((v.co.x - (lo[0] + hi[0]) / 2) / (hi[0] - lo[0]) * sx,
                       (v.co.y - (lo[1] + hi[1]) / 2) / (hi[1] - lo[1]) * sy,
                       (v.co.z - lo[2]) / (hi[2] - lo[2]) * (sz + sink) - sink))
        if rough > 0.0:                    # noise_vector 는 프로세스마다 오프셋이 달라 쓰지 않음 (재현성)
            q = v.co * 0.8 + off
            v.co += Vector([_lm_noise.noise(q + Vector(o)) for o in LM_ROCK_AXES]) * rough
        v.co.z = max(v.co.z, -0.15)
    return bm


def _lm_carved_rock_bm(sx, sy, sz, seed, face_tilt=math.radians(12.0), face_cut=0.42):
    """글씨 면이 있는 자연석: 앞(-Y) 면을 뒤로 기운 평면으로 다듬고(재질 1), 다듬은 뒤의 깊이가 sy 가 되도록
    다듬기 전 깊이를 두 번 고쳐 맞춥니다. 반환: (bm, 글씨 면 위의 한 점, 면 법선)."""
    n = Vector((0.0, -math.cos(face_tilt), math.sin(face_tilt)))
    fit = sy
    for _ in range(3):
        bm = _lm_rock_bm(sx, fit, sz, seed)
        p0 = Vector((0.0, -fit / 2 + face_cut, sz * 0.45))
        for v in bm.verts:
            h = n.dot(v.co - p0)
            if h > 0.0:
                v.co -= n * h
        depth = max(v.co.y for v in bm.verts) - min(v.co.y for v in bm.verts)
        if abs(depth - sy) < 0.02:
            break
        bm.free()
        fit += sy - depth
    for f in bm.faces:                                                           # 다듬은 면 = 재질 1
        f.material_index = 1 if all(abs(n.dot(v.co - p0)) < 1e-4 for v in f.verts) else 0
    return bm, p0, n


def _lm_symbol_stone(coll, mt, bk):
    """2025 상징석 (5.0 x 2.0 x 1.2 m 자연석) + 다듬은 앞면의 글씨 '민주주의 최후의 보루 / 대한민국 국회'.
    글씨 크기·위치는 다듬은 면의 실제 범위(평면 좌표)에 맞춥니다."""
    cx, cy = LM_STONE
    sx, sy, sz = LM_STONE_SIZE
    bm, p0, n = _lm_carved_rock_bm(sx, sy, sz, 7.0)
    up = Vector((0.0, n.z, -n.y))                                               # 글씨 면의 '위' (뒤로 기울어짐)
    flat = [v.co for v in bm.verts if abs(n.dot(v.co - p0)) < 1e-4 and v.co.z > 0.05]
    us = [c.x for c in flat]
    ws = [up.dot(c - p0) for c in flat]
    wc = (max(ws) + min(ws)) / 2
    width = (max(us) - min(us)) * 0.72
    uc = (max(us) + min(us)) / 2
    bmesh.ops.translate(bm, vec=(cx, cy, 0.0), verts=bm.verts)
    finish_mesh('LM_Symbol_Stone', bm, coll, [mt['rock'], mt['rock_face']], smooth=True, part='site')
    basis = Matrix((Vector((1.0, 0.0, 0.0)), up, n)).transposed().to_4x4()
    s1, s2 = min(0.25, width / 10.0), min(0.36, width / 7.2)
    for body, size, h in (('민주주의 최후의 보루', s1, wc + 0.55 * s2), ('대한민국 국회', s2, wc - 0.5 * s2)):
        at = Vector((cx + uc, cy, 0.0)) + p0 + up * h + n * 0.012
        bk.text('LM_Symbol_Stone_Letters', mt['ink'], body, size, Matrix.Translation(at) @ basis)


# --- 정문 -----------------------------------------------------------------------

def _lm_gate_leaf(m, hx, hy, length, height, ang, mi):
    """흰 강철 문짝 하나 (경첩 (hx, hy) 에서 ang 방향으로 length): 테·가운데 가로대·세로 살."""
    c, s = math.cos(ang), math.sin(ang)

    def bar(u0, u1, z0, z1, t):
        u = (u0 + u1) / 2
        m.obox(hx + c * u, hy + s * u, (u1 - u0) / 2, t, ang, z0, z1, mi)

    bar(0.0, length, 0.10, 0.22, 0.05)
    bar(0.0, length, height - 0.12, height, 0.05)
    bar(0.0, length, 0.95, 1.03, 0.035)
    bar(0.0, 0.12, 0.10, height + 0.08, 0.06)
    bar(length - 0.12, length, 0.10, height, 0.06)
    nb = int(length / 0.16)
    for k in range(1, nb):
        u = length * k / nb
        bar(u - 0.018, u + 0.018, 0.22, height - 0.12, 0.018)
    bar(length - 0.30, length - 0.10, 0.0, 0.10, 0.06)                    # 바퀴 받침


def _lm_gatepost(m, x, y, w, h, mi):
    """흰 문기둥: 굽 + 몸 + 갓 (위로 한 번 더 좁아짐)."""
    m.box(x - w / 2 - 0.1, x + w / 2 + 0.1, y - w / 2 - 0.1, y + w / 2 + 0.1, -0.1, 0.35, mi)
    m.box(x - w / 2, x + w / 2, y - w / 2, y + w / 2, 0.35, h - 0.35, mi)
    m.box(x - w / 2 - 0.08, x + w / 2 + 0.08, y - w / 2 - 0.08, y + w / 2 + 0.08, h - 0.35, h - 0.12, mi)
    m.box(x - w / 2 + 0.1, x + w / 2 - 0.1, y - w / 2 + 0.1, y + w / 2 - 0.1, h - 0.12, h, mi)


def _lm_gate_wing(m, xf, sgn, y, mi):
    """문기둥 바깥면 xf 에서 sgn 방향으로 뻗은 흰 날개벽 (굽·몸·갓). 울타리(담 ±0.18, 기둥 2.05 m)보다 두껍고 높아
    울타리 끝이 날개벽 안 어디에서 끊겨도 감싸 가립니다."""
    xo = xf + sgn * LM_GATE_WING
    m.box(xf, xo, y - 0.34, y + 0.34, -0.1, 0.5, mi)
    m.box(xf, xo, y - 0.27, y + 0.27, 0.5, 2.18, mi)
    m.box(xf, xo + sgn * 0.06, y - 0.33, y + 0.33, 2.18, 2.34, mi)
    m.box(xf, xo - sgn * 0.08, y - 0.22, y + 0.22, 2.34, 2.42, mi)


def _lm_booth(m, cx, cy):
    """초소: 흰 벽 아래 띠 + 사방 유리 띠 + 모서리 기둥 + 얇게 내민 평지붕."""
    hx, hy = 1.5, 1.2
    m.box(cx - hx - 0.1, cx + hx + 0.1, cy - hy - 0.1, cy + hy + 0.1, -0.1, 0.15, 0)
    m.box(cx - hx, cx + hx, cy - hy, cy + hy, 0.15, 1.0, 0)
    m.box(cx - hx + 0.06, cx + hx - 0.06, cy - hy + 0.06, cy + hy - 0.06, 1.0, 2.3, 2)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(cx + sx * (hx - 0.1), cx + sx * hx, cy + sy * (hy - 0.1), cy + sy * hy, 1.0, 2.3, 0)
    m.box(cx - hx, cx + hx, cy - hy, cy + hy, 2.3, 2.6, 0)
    m.box(cx - hx - 0.35, cx + hx + 0.35, cy - hy - 0.35, cy + hy + 0.35, 2.6, 2.82, 0)
    m.box(cx + hx - 0.02, cx + hx + 0.02, cy - 0.45, cy + 0.45, 0.15, 2.15, 1)          # 문


def _lm_main_gate(coll, mt, bk):
    """정문 (울타리 y -388): 1·2문 차량 문(흰 기둥 둘 + 안쪽으로 열린 문짝 둘), 축의 보행문, 초소, 문 번호판."""
    y = LM_GATE_Y
    m = _LmMesh('LM_Main_Gate', [mt['white_stone'], mt['white_steel'], mt['glass'], mt['sign']])
    signs = []
    for gx, num in LM_GATES:
        for side in (-1, 1):
            px = gx + side * (LM_GATE_GAP - 0.65)
            _lm_gatepost(m, px, y, 1.3, 4.2, 0)
            _lm_gate_wing(m, px + side * 0.65, side, y, 0)
            m.box(px - 0.48, px + 0.48, y - 0.65 - 0.10, y - 0.65, 2.05, 3.35, 3)            # 번호판
            signs.append((num, px, y - 0.65 - 0.10))
            _lm_gate_leaf(m, px - side * 0.75, y + 0.1, LM_GATE_GAP - 1.55, 2.3, math.radians(90 + side * 6), 1)
    for side in (-1, 1):
        px = side * (LM_PED_GAP - 0.5)
        _lm_gatepost(m, px, y, 0.9, 3.2, 0)
        _lm_gate_wing(m, px + side * 0.45, side, y, 0)
        _lm_gate_leaf(m, px - side * 0.55, y + 0.1, LM_PED_GAP - 1.1, 2.0, math.radians(90 + side * 10), 1)
    _lm_booth(m, *LM_BOOTH)
    m.finish(coll)
    face = Matrix(((1.0, 0.0, 0.0), (0.0, 0.0, -1.0), (0.0, 1.0, 0.0))).to_4x4()   # 글자 +Z → -Y (바깥)
    for num, px, fy in signs:
        bk.text('LM_Gate_Numbers', mt['sign_glow'], num, 0.78, Matrix.Translation((px, fy - 0.012, 2.62)) @ face)
        bk.text('LM_Gate_Numbers', mt['sign_glow'], '국회', 0.24, Matrix.Translation((px, fy - 0.012, 3.13)) @ face)


# --- 계단 발치 받침과 '애국애족의 군상' ------------------------------------------------

LM_FIG_PROPS = {   # 키 1 기준 관절·굵기 (사람 비례를 조금 영웅적으로)
    'hip': 0.52, 'knee': 0.28, 'ankle': 0.05, 'shoulder': (0.125, 0.81), 'head': 0.925,
    'thigh': 0.064, 'calf': 0.047, 'uarm': 0.043, 'farm': 0.036, 'uarm_len': 0.17, 'farm_len': 0.15,
}


def _lm_fig_arm(sc, P, H, side, shoulder, theta, phi, beta, sleeve):
    """팔 하나: 어깨에서 θ(아래 0 → 앞 90 → 위 180°), 바깥으로 φ, 팔꿈치에서 β 만큼 더 굽힘."""
    fp = LM_FIG_PROPS

    def d(t):
        return Vector((side * math.sin(phi), -math.sin(t) * math.cos(phi), -math.cos(t) * math.cos(phi)))

    e = shoulder + d(theta) * fp['uarm_len']
    h = e + d(theta + beta) * fp['farm_len']
    sc.capsule(P(shoulder), P(e), fp['uarm'] * sleeve * H)
    sc.capsule(P(e), P(h), fp['farm'] * sleeve * H)
    sc.ball(P(shoulder + d(theta) * 0.06 + Vector((0.0, -0.012, 0.0))), fp['uarm'] * 1.2 * H)   # 알통
    hd = d(theta + beta)
    axis = P(h + hd) - P(h)
    sc.ellip(P(h + hd * 0.04), (0.042 * H, 0.026 * H, 0.014 * H), rot=_lm_rot_x_to(axis))       # 손바닥
    sc.capsule(P(h + hd * 0.012 + Vector((-side * 0.02, -0.012, 0.0))),
               P(h + hd * 0.05 + Vector((-side * 0.028, -0.02, 0.0))), 0.008 * H)                  # 엄지


def _lm_fig_legs(sc, P, H, pose):
    """다리 둘 (서기·걷기) 또는 한쪽 무릎 꿇기 — 넓적다리·장딴지 근육 덩어리 포함. 반환: 골반 높이 (키 1 기준)."""
    fp = LM_FIG_PROPS
    th, ca = fp['thigh'] * H, fp['calf'] * H
    foot = (0.034 * H, 0.078 * H, 0.028 * H)

    def leg(hipp, kn, ank, toe):
        sc.capsule(P(hipp), P(kn), th)
        sc.capsule(P(kn), P(ank), ca)
        sc.ball(P(hipp.lerp(kn, 0.35) + Vector((0.0, -0.01, 0.0))), th * 1.12)          # 넓적다리 근육
        sc.ball(P(kn.lerp(ank, 0.3) + Vector((0.0, 0.015, 0.0))), ca * 1.15)            # 장딴지
        sc.ellip(P(toe), foot)

    k = pose.get('kneel')
    if k:
        hip = 0.36
        leg(Vector((k * 0.06, 0.0, hip)), Vector((k * 0.06, 0.08, 0.05)), Vector((k * 0.06, 0.32, 0.04)),
            Vector((k * 0.06, 0.36, 0.03)))
        leg(Vector((-k * 0.07, 0.0, hip)), Vector((-k * 0.07, -0.26, 0.30)), Vector((-k * 0.07, -0.27, 0.05)),
            Vector((-k * 0.07, -0.30, 0.028)))
        return hip
    stride = pose.get('stride', 0.0)
    for side in (-1, 1):
        fy = -stride if side > 0 else stride * 0.8
        hipp = Vector((side * 0.06, 0.0, fp['hip']))
        ank = Vector((side * 0.065, fy, fp['ankle']))
        kn = (hipp + ank) / 2 + Vector((0.0, -0.025, 0.0))
        leg(hipp, kn, ank, ank + Vector((0.0, -0.035, -0.022)))
    return fp['hip'] - 0.3 * stride * stride


def _lm_fig_torso(sc, P, H, U, q, pose):
    """골반·허리·가슴(가슴 근육)·목·머리 (+쪽진 머리), 어깨에 두른 천과 등 뒤로 늘어진 망토."""
    mus = pose.get('muscle', 1.0)
    sc.ellip(P(U((0.0, 0.0, 0.54))), (0.108 * H, 0.078 * H, 0.078 * H), rot=q)
    sc.ellip(P(U((0.0, 0.0, 0.64))), (0.092 * H, 0.068 * H, 0.075 * H), rot=q)
    sc.ellip(P(U((0.0, -0.005, 0.745))), (0.125 * mus * H, 0.08 * mus * H, 0.095 * H), rot=q)
    if not pose.get('skirt'):
        for sx in (-1, 1):
            sc.ball(P(U((sx * 0.052 * mus, -0.05 * mus, 0.765))), 0.05 * mus * H)            # 가슴 근육
    sc.capsule(P(U((0.0, 0.004, 0.80))), P(U((0.0, -0.008, 0.885))), 0.029 * H)                  # 목
    for sx in (-1, 1):                                                         # 승모근 (목 밑 → 어깨 비탈)
        sc.capsule(P(U((sx * 0.02, 0.012, 0.835))), P(U((sx * 0.10 * mus, 0.006, 0.80))), 0.024 * mus * H)
    hz = LM_FIG_PROPS['head']
    sc.ellip(P(U((0.0, -0.004, hz + 0.012))), (0.052 * H, 0.058 * H, 0.063 * H), rot=q)          # 두개골
    sc.ellip(P(U((0.0, -0.026, hz - 0.038))), (0.034 * H, 0.036 * H, 0.030 * H), rot=q)          # 턱·광대
    sc.capsule(P(U((0.0, -0.062, hz + 0.0))), P(U((0.0, -0.069, hz - 0.026))), 0.011 * H)          # 코
    sc.capsule(P(U((-0.03, -0.054, hz + 0.018))), P(U((0.03, -0.054, hz + 0.018))), 0.011 * H)     # 눈썹뼈
    if pose.get('skirt'):
        sc.ball(P(U((0.0, 0.05, 0.955))), 0.035 * H)
    ds = pose.get('drape')
    if ds:
        for i in range(6):                                                     # 어깨 → 반대쪽 허리 띠
            f = i / 5.0
            sc.ellip(P(U((ds * (0.11 - 0.2 * f), -0.06 - 0.02 * math.sin(math.pi * f), 0.80 - 0.26 * f))),
                     (0.05 * H, 0.03 * H, 0.05 * H), rot=q)
        for i in range(5):                                                     # 등 뒤 망토
            f = i / 4.0
            sc.ellip(P(U((ds * 0.03 * f, 0.075 + 0.03 * f, 0.78 - 0.34 * f))),
                     ((0.12 + 0.03 * f) * H, 0.028 * H, 0.09 * H), rot=q)


def _lm_figure(sc, pos, face, H, pose):
    """메타볼 인물 하나: pos (월드), face (z 회전, 0 = -Y 를 봄), 키 H, pose dict
    (stride·kneel·lean·arms[(θ, φ, β) 왼·오]·skirt(한복)·drape(천)·muscle)."""
    rot = Matrix.Rotation(face, 3, 'Z')
    base = Vector(pos)

    def P(p):
        return base + rot @ (Vector(p) * H)

    fp = LM_FIG_PROPS
    lean = Matrix.Rotation(pose.get('lean', 0.0), 3, 'X')
    q = (rot @ lean).to_quaternion()
    if pose.get('skirt'):
        hip = fp['hip']
        for i in range(12):                                                    # 치마: 매끈한 종 모양
            z = 0.62 - 0.054 * i
            r = 0.085 + 0.11 * ((0.62 - z) / 0.6) ** 0.8
            sc.ellip(P((0.0, 0.01, z)), (r * H, r * 0.8 * H, 0.05 * H), rot=rot.to_quaternion(), stiff=1.6)
    else:
        hip = _lm_fig_legs(sc, P, H, pose)
    dz = hip - fp['hip']
    pel = Vector((0.0, 0.0, hip + 0.02))

    def U(p):                                          # 상체 점: 골반 기준으로 기울임
        return pel + lean @ (Vector(p) + Vector((0.0, 0.0, dz)) - pel)

    _lm_fig_torso(sc, P, H, U, q, pose)
    mus = pose.get('muscle', 1.0)
    sx, sz = fp['shoulder']
    for side, (theta, phi, beta) in zip((-1, 1), pose.get('arms', ((5, 8, 10), (5, 8, 10)))):
        sh = U((side * sx * mus, 0.0, sz))
        sc.ball(P(sh), 0.048 * mus * H)
        _lm_fig_arm(sc, P, H, side, sh, math.radians(theta), math.radians(phi), math.radians(beta),
                    1.45 if pose.get('skirt') else mus)


LM_GROUPS = {   # 받침 위 인물 배치 (받침 윗면 중심 기준 x, y, 얼굴 방향°(+ = 축 쪽 +X), 키, 자세) — 구성은 사진 기억 수준의 추정
    -1: ((-4.4, -0.3, 25, 3.6, {'kneel': 1, 'lean': 0.15, 'arms': ((80, 10, 40), (30, 20, 30)), 'muscle': 1.1}),
         (-2.8, 0.5, 15, 4.0, {'stride': 0.14, 'lean': 0.12, 'arms': ((70, 10, 30), (60, 15, 50)), 'muscle': 1.1,
                               'drape': 1}),
         (-1.2, -0.6, 8, 3.8, {'skirt': True, 'arms': ((50, 12, 80), (55, 12, 75))}),
         (-2.0, -1.2, 12, 1.9, {'stride': 0.06, 'arms': ((15, 15, 20), (95, 10, 30)), 'muscle': 1.0}),
         (0.4, 0.4, 0, 4.4, {'stride': 0.10, 'arms': ((170, 8, 0), (20, 12, 30)), 'muscle': 1.13, 'drape': 1}),
         (2.2, -0.2, -12, 4.1, {'stride': 0.12, 'lean': 0.1, 'arms': ((95, -20, 25), (40, 20, 40)), 'muscle': 1.1,
                                'drape': -1}),
         (3.9, 0.5, -25, 3.7, {'kneel': -1, 'lean': 0.2, 'arms': ((120, 15, 30), (60, 10, 60)), 'muscle': 1.1})),
    1: ((4.3, -0.2, -25, 3.7, {'kneel': -1, 'lean': 0.12, 'arms': ((40, 15, 60), (85, 15, 30)), 'muscle': 1.1}),
        (2.7, 0.4, -14, 4.1, {'stride': 0.13, 'lean': 0.1, 'arms': ((60, 15, 45), (75, 10, 20)), 'muscle': 1.1,
                              'drape': -1}),
        (0.9, -0.5, -6, 3.8, {'skirt': True, 'arms': ((40, 15, 90), (65, 10, 60))}),
        (-0.5, 0.4, 0, 4.4, {'stride': 0.12, 'arms': ((20, 10, 25), (160, 15, 10)), 'muscle': 1.13, 'drape': -1}),
        (-2.3, -0.3, 12, 4.0, {'stride': 0.1, 'lean': 0.15, 'arms': ((110, -15, 20), (35, 15, 45)), 'muscle': 1.1}),
        (-3.1, -1.1, 20, 2.0, {'stride': 0.05, 'arms': ((10, 12, 15), (70, 10, 40)), 'muscle': 1.0}),
        (-4.3, 0.5, 28, 3.6, {'kneel': 1, 'lean': 0.2, 'arms': ((100, 20, 40), (40, 10, 60)), 'muscle': 1.1,
                              'drape': 1})),
}


def _lm_group_sculpt(side, rock):
    """군상 하나의 인물 메타볼 요소 (받침 윗면 중심 원점). 인물마다 발이 닿는 자리들의 바위 높이 중 가장 낮은 곳에
    발바닥을 맞춰(조금 묻힘) 어느 발도 뜨지 않게 합니다. rock = 바위 BVH (같은 로컬 좌표)."""
    sc = _LmSculpt(LM_FIG_STIFF)
    for x, y, face, h, pose in LM_GROUPS[side]:
        rot = Matrix.Rotation(math.radians(face), 2)
        zs = []
        for d in ((0.0, 0.0), (-0.1, 0.36), (0.1, 0.36), (-0.1, -0.36), (0.1, -0.36)):   # 발이 닿을 만한 자리 (키 비례)
            q = Vector((x, y)) + rot @ Vector(d) * h
            hit = rock.ray_cast(Vector((q.x, q.y, 5.0)), Vector((0.0, 0.0, -1.0)))
            zs.append(hit[0].z if hit[0] is not None else 0.0)
        _lm_figure(sc, (x, y, min(zs) - 0.06), math.radians(face), h, pose)
    return sc


def _lm_pedestals(ctx, coll, mt, bk):
    """계단 발치 화강석 받침 둘 (굽·몸·갓, 앞면 청동 명판) + 짙은 청동 군상 + 밤 업라이트."""
    ax, cy, lx, ly, h = LM_PEDESTAL
    m = _LmMesh('LM_Stair_Pedestals', [mt['plinth'], ctx.mats['granite_dark'], mt['bronze_dark'], mt['uplight']])
    rocks = bmesh.new()
    for side in (-1, 1):
        cx = side * ax
        rock = _lm_rock_bm(10.6, 3.2, 0.6, 3.0 + side, sink=0.3, rough=0.22)    # 모난 청동 바위 바닥
        if side < 0:
            bmesh.ops.scale(rock, vec=(-1.0, 1.0, 1.0), verts=rock.verts)        # 봉우리를 바깥쪽에
            bmesh.ops.reverse_faces(rock, faces=rock.faces)
        tree = _LmBVH.FromBMesh(rock)
        bmesh.ops.translate(rock, vec=(cx, cy + 0.6, h), verts=rock.verts)
        me = bpy.data.meshes.new('LmRock')
        rock.to_mesh(me)
        rock.free()
        rocks.from_mesh(me)
        bpy.data.meshes.remove(me)
        m.box(cx - lx / 2, cx + lx / 2, cy - ly / 2, cy + ly / 2, -0.3, 0.45, 1)
        m.box(cx - lx / 2 + 0.22, cx + lx / 2 - 0.22, cy - ly / 2 + 0.22, cy + ly / 2 - 0.22, 0.45, h - 0.32, 0)
        m.box(cx - lx / 2 + 0.05, cx + lx / 2 - 0.05, cy - ly / 2 + 0.05, cy + ly / 2 - 0.05, h - 0.32, h - 0.1, 0)
        m.box(cx - lx / 2, cx + lx / 2, cy - ly / 2, cy + ly / 2, h - 0.1, h, 0)
        m.box(cx - 1.6, cx + 1.6, cy - ly / 2 + 0.17, cy - ly / 2 + 0.25, 0.95, 1.85, 2)     # 명판
        for k in (-1, 0, 1):
            m.box(cx + k * 3.6 - 0.2, cx + k * 3.6 + 0.2, cy - ly / 2 + 0.25, cy - ly / 2 + 0.45, h, h + 0.14, 3)
        bk.sculpt(f'LM_Bronze_Group_{"L" if side < 0 else "R"}', _lm_group_sculpt(side, tree), 0.055,
                  Matrix.Translation((cx, cy + 0.6, h)), LM_DECIMATE, mt['bronze_dark'])
    m.finish(coll)
    finish_mesh('LM_Bronze_Rocks', rocks, coll, [mt['bronze_dark']], smooth=False, part='site')
    if ctx.night:
        for side in (-1, 1):
            cx = side * ax
            for k in (-1, 0, 1):
                _lm_spot(coll, f'LM_Group_Up_{side:+d}_{k:+d}', (cx + k * 3.6, cy - ly / 2 + 0.35, h + 0.2),
                         (cx + k * 2.0, cy + 0.6, h + 2.8), 2600.0, (1.0, 0.84, 0.62), 70.0)


# --- 이웃 건물: 공통 입면 ---------------------------------------------------------------
# 건물 메시의 재질 칸: 0 돌(피어·띠·처마), 1 유리, 2 짙은 굽, 3 지붕, 4 금속·흰 패널
LM_I_STONE, LM_I_GLASS, LM_I_BASE, LM_I_ROOF, LM_I_METAL = range(5)
LM_REVEAL = 0.35                            # 들인 출입구 양옆 돌벽 두께


def _lm_face_box(m, rect, face, a0, a1, d0, d1, z0, z1, mi):
    """사각 평면 rect 의 한 면(face 's'·'n'·'w'·'e')에 붙는 상자: a = 면을 따라, d = 면에서 안쪽 깊이."""
    x0, x1, y0, y1 = rect
    if face == 's':
        m.box(a0, a1, y0 + d0, y0 + d1, z0, z1, mi)
    elif face == 'n':
        m.box(a0, a1, y1 - d1, y1 - d0, z0, z1, mi)
    elif face == 'w':
        m.box(x0 + d0, x0 + d1, a0, a1, z0, z1, mi)
    else:
        m.box(x1 - d1, x1 - d0, a0, a1, z0, z1, mi)


def _lm_block(m, rect, z0, h, pier=(0.9, 1.0, 3.6), band=(0.8, 0.4), floor_h=4.2, base=(1.0, 0.15),
              attic=1.6, cornice=(0.6, 0.6), parapet=0.9, skip='', recess=None):
    """돌 피어·층마다 가로 띠·안쪽 유리·위 돌 띠(attic)·내민 처마돌·파라펫을 가진 상자형 건물.
    rect = (x0, x1, y0, y1) 는 피어 바깥면. skip 에 적은 면('s','n','w','e')은 다른 매스에 붙어 입면을 생략.
    band = (높이, 피어 바깥면에서 들인 깊이 — 음수면 피어보다 내밀어 띠창처럼 이어짐).
    recess = (면, a0, a1, 깊이, 윗높이): 그 면에 발자국 안으로 들인 출입구 (돌출 캐노피 대신 — 이웃 나무와 부딪히지 않게).
    반환: 처마돌 윗면 높이 (옥상)."""
    x0, x1, y0, y1 = rect
    pw, pd, _ = pier
    zb = z0 + base[0]
    zc1 = z0 + h - parapet
    zc0 = zc1 - cornice[0]
    za0 = zc0 - attic
    m.box(x0 - base[1], x1 + base[1], y0 - base[1], y1 + base[1], z0 - 0.6, zb, LM_I_BASE)
    _lm_block_core(m, rect, pd, zb, za0, recess)
    cw = max(pw, pd) * 1.5
    for cx in (x0, x1 - cw):
        for cy in (y0, y1 - cw):
            m.box(cx, cx + cw, cy, cy + cw, zb, za0, LM_I_STONE)
    for face in 'snwe':
        if face not in skip:
            rec = recess if recess is not None and recess[0] == face else None
            _lm_block_face(m, rect, face, pier, band, floor_h, cw, zb, za0, rec)
            if rec:
                _lm_recess_frame(m, rect, rec, z0, zb, za0, base[1])
    m.box(x0, x1, y0, y1, za0, zc0, LM_I_STONE)
    co = cornice[1]
    m.box(x0 - co, x1 + co, y0 - co, y1 + co, zc0, zc1, LM_I_STONE, mi_top=LM_I_ROOF)
    t = 0.45
    m.box(x0 - co, x1 + co, y0 - co, y0 - co + t, zc1, z0 + h, LM_I_STONE)
    m.box(x0 - co, x1 + co, y1 + co - t, y1 + co, zc1, z0 + h, LM_I_STONE)
    m.box(x0 - co, x0 - co + t, y0 - co + t, y1 + co - t, zc1, z0 + h, LM_I_STONE)
    m.box(x1 + co - t, x1 + co, y0 - co + t, y1 + co - t, zc1, z0 + h, LM_I_STONE)
    return zc1


def _lm_block_core(m, rect, pd, zb, za0, recess):
    """피어 뒤 유리 매스. 들인 출입구가 있으면 그 면만 출입구 깊이까지 들이고 양옆·위를 유리 조각으로 채웁니다
    (조각끼리 맞닿는 면은 서로 반대를 보며 안에 묻혀 겹침 무늬가 생기지 않음)."""
    x0, x1, y0, y1 = rect
    if recess is None:
        m.box(x0 + pd, x1 - pd, y0 + pd, y1 - pd, zb, za0, LM_I_GLASS)
        return
    face, r0, r1, rd, rz = recess
    d = {f: (rd if f == face else pd) for f in 'snwe'}
    m.box(x0 + d['w'], x1 - d['e'], y0 + d['s'], y1 - d['n'], zb, za0, LM_I_GLASS)
    a0, a1 = (x0, x1) if face in 'sn' else (y0, y1)
    _lm_face_box(m, rect, face, a0 + pd, r0, pd, rd, zb, za0, LM_I_GLASS)
    _lm_face_box(m, rect, face, r1, a1 - pd, pd, rd, zb, za0, LM_I_GLASS)
    _lm_face_box(m, rect, face, r0, r1, pd, rd, rz, za0, LM_I_GLASS)


def _lm_block_face(m, rect, face, pier, band, floor_h, cw, zb, za0, rec):
    """한 면의 세로 피어와 층 띠. 들인 출입구(rec) 앞의 피어는 인방 위부터, 띠는 출입구 양옆에서 끊습니다."""
    x0, x1, y0, y1 = rect
    pw, pd, step = pier
    bh, bi = band
    a0, a1 = (x0, x1) if face in 'sn' else (y0, y1)
    lo, hi, rz = (rec[1] - LM_REVEAL, rec[2] + LM_REVEAL, rec[4]) if rec else (0.0, 0.0, zb)
    n = max(1, int(round((a1 - a0 - cw) / step)))
    for k in range(1, n):
        a = a0 + cw / 2 + k * (a1 - a0 - cw) / n
        zs = rz if rec and a + pw / 2 > lo and a - pw / 2 < hi else zb
        _lm_face_box(m, rect, face, a - pw / 2, a + pw / 2, 0.0, pd, zs, za0, LM_I_STONE)
    z = zb + floor_h
    while z < za0 - 1.0:
        spans = ((a0 + cw, lo), (hi, a1 - cw)) if rec and z - bh / 2 < rz else ((a0 + cw, a1 - cw),)
        for s0, s1 in spans:
            _lm_face_box(m, rect, face, s0, s1, bi, pd + 0.05, z - bh / 2, z + bh / 2, LM_I_STONE)
        z += floor_h


def _lm_recess_frame(m, rect, rec, z0, zb, za0, bo):
    """들인 출입구의 돌 테(양옆 벽·내민 인방), 안쪽 유리문의 금속 문살, 굽 앞 계단 (단높이 약 0.17 m).
    인방 위가 위 돌 띠(za0)까지 1.2 m 가 안 되면 인방을 거기까지 올려 좁은 유리 틈을 남기지 않습니다."""
    face, r0, r1, rd, rz = rec
    rv = LM_REVEAL
    zt = za0 if za0 - (rz + 0.3) < 1.2 else rz + 0.3
    _lm_face_box(m, rect, face, r0 - rv, r0 + 0.02, 0.0, rd, zb, rz - 0.5, LM_I_STONE)
    _lm_face_box(m, rect, face, r1 - 0.02, r1 + rv, 0.0, rd, zb, rz - 0.5, LM_I_STONE)
    _lm_face_box(m, rect, face, r0 - rv, r1 + rv, -0.08, rd, rz - 0.5, zt, LM_I_STONE)
    nm = max(2, int(round((r1 - r0) / 1.8)))
    for k in range(1, nm):
        a = r0 + (r1 - r0) * k / nm
        _lm_face_box(m, rect, face, a - 0.05, a + 0.05, rd - 0.1, rd + 0.02, zb, rz - 0.5, LM_I_METAL)
    if zb + 2.72 < rz - 0.5:                                                   # 문 위 가로대
        _lm_face_box(m, rect, face, r0, r1, rd - 0.12, rd + 0.02, zb + 2.6, zb + 2.72, LM_I_METAL)
    ns = max(2, int(round((zb - z0) / 0.17)))
    for j in range(1, ns):                                  # 단마다 제 디딤판 폭만 (옆면이 겹치지 않게)
        d1 = -bo + 0.05 if j == ns - 1 else -bo - 0.32 * (ns - j - 1)
        _lm_face_box(m, rect, face, r0 + 0.3, r1 - 0.3, -bo - 0.32 * (ns - j), d1, z0 - 0.3,
                     z0 + (zb - z0) * j / ns, LM_I_BASE)


def _lm_rooftop(m, rng, rect, z, count, size=(5.0, 12.0)):
    """옥상 기계실·설비 상자 (항공 샷에서 지붕이 밋밋하지 않게)."""
    x0, x1, y0, y1 = rect
    for _ in range(count):
        w, d = rng.uniform(*size), rng.uniform(*size)
        cx = rng.uniform(x0 + w / 2 + 3, x1 - w / 2 - 3)
        cy = rng.uniform(y0 + d / 2 + 3, y1 - d / 2 - 3)
        m.box(cx - w / 2, cx + w / 2, cy - d / 2, cy + d / 2, z, z + rng.uniform(1.8, 3.5), LM_I_STONE)


def _lm_loggia_columns(m, rect, face, pos, d0, d1, w, z0, z1):
    """들인 출입구 앞줄의 네모 돌기둥 (면을 따라 pos 위치, 면에서 d0..d1 깊이)."""
    for a in pos:
        _lm_face_box(m, rect, face, a - w / 2, a + w / 2, d0, d1, z0, z1, LM_I_STONE)


# --- 국회도서관 · 의정관 · 연결 다리 · 헌정기념관 ------------------------------------------------

LM_LIBRARY = (132.0, 196.0, -265.0, -180.0, 28.0)
LM_UIJEONG = (228.0, 266.0, -271.0, -174.0, 32.0)         # 동쪽 면이 곡면
LM_UIJEONG_TOWER = (262.0, 278.0, -243.0, -202.0, 38.0)
LM_BRIDGE = (196.0, 228.0, -226.0, -218.0, 9.0, 13.0)     # 도서관 2층 ↔ 의정관 3층 연결 다리
LM_MUSEUM = (316.0, 379.0, -293.0, -196.0, 12.0)


def _lm_library(ctx, m):
    """국회도서관 (1987): 낮고 육중한 화강석 상자, 촘촘한 세로 피어, 두꺼운 처마돌, 서쪽(잔디광장 쪽) 캐노피, 옥상 천창."""
    x0, x1, y0, y1, h = LM_LIBRARY
    rect, cy = (x0, x1, y0, y1), (y0 + y1) / 2
    zr = _lm_block(m, rect, 0.0, h, pier=(1.1, 1.4, 3.9), band=(1.1, 0.5), floor_h=4.6, base=(1.3, 0.2),
                   attic=2.6, cornice=(0.8, 1.0), parapet=0.8, recess=('w', cy - 11.0, cy + 11.0, 3.5, 6.3))
    _lm_loggia_columns(m, rect, 'w', [cy + k * 5.5 for k in (-1.5, -0.5, 0.5, 1.5)], 0.25, 1.05, 0.8, 1.3, 5.8)
    sx, sy = (x0 + x1) / 2, cy
    m.box(sx - 9.0, sx + 9.0, sy - 12.0, sy + 12.0, zr, zr + 1.6, LM_I_GLASS)                 # 천창
    for k in range(-4, 5):
        m.box(sx - 9.05, sx + 9.05, sy + k * 2.9 - 0.08, sy + k * 2.9 + 0.08, zr + 1.6, zr + 1.75, LM_I_METAL)
    _lm_rooftop(m, ctx.rng, (x0 + 4, x0 + 22, y0 + 6, y1 - 6), zr, 2)


def _lm_arc_pts(p0, pm, p1, n):
    """세 점을 지나는 원호 위 점 n 개 (p0 → p1) 와 원의 중심."""
    ax, ay = p0
    bx, by = pm
    cx, cy = p1
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    r = math.hypot(ax - ux, ay - uy)
    a0, a1 = math.atan2(ay - uy, ax - ux), math.atan2(cy - uy, cx - ux)
    return [(ux + r * math.cos(a0 + (a1 - a0) * i / (n - 1)), uy + r * math.sin(a0 + (a1 - a0) * i / (n - 1)))
            for i in range(n)], (ux, uy)


def _lm_arc_band(m, arc, c, x_in, out, z0, z1, mi, mi_top=None):
    """동쪽으로 볼록한 원호(남→북)를 바깥으로 out 만큼 키운 띠 판 (서쪽은 x_in 에서 닫음)."""
    ux, uy = c
    pts = []
    for x, y in arc:
        r = math.hypot(x - ux, y - uy)
        pts.append((ux + (x - ux) * (r + out) / r, uy + (y - uy) * (r + out) / r))
    m.prism([(x_in, pts[0][1])] + pts + [(x_in, pts[-1][1])], z0, z1, mi, mi_top)


def _lm_uijeong(ctx, m):
    """의정관 (2007): 서·남·북은 돌 피어 입면, 동쪽은 볼록한 유리 곡면(층마다 흰 띠, 세로 핀), 가운데 더 높은 탑,
    도서관과 잇는 연결 다리 (z 9..13, 유리 두 줄)."""
    x0, x1, y0, y1, h = LM_UIJEONG
    xs = x1 - 6.0                                                                # 돌 매스 동쪽 끝 = 곡면 시작
    zr = _lm_block(m, (x0, xs, y0, y1), 0.0, h, pier=(0.8, 1.0, 3.0), band=(0.6, 0.35), floor_h=4.8,
                   base=(1.0, 0.15), attic=1.8, cornice=(0.5, 0.5), parapet=0.9, skip='e')
    arc, c = _lm_arc_pts((xs - 0.5, y0 + 1.0), (x1, (y0 + y1) / 2), (xs - 0.5, y1 - 1.0), 33)
    zg = 1.02                          # 곡면 굽 윗면: 네모 매스 굽(1.0)보다 2 cm 높여 겹친 윗면이 없게
    _lm_arc_band(m, arc, c, xs - 1.0, 0.6, -0.6, zg, LM_I_BASE)                   # 곡면 유리 밑 화강석 굽
    m.prism([(xs - 1.0, y0 + 1.0)] + arc + [(xs - 1.0, y1 - 1.0)], zg, zr - 0.6, LM_I_GLASS)
    z = 1.0 + 4.8
    while z < zr - 1.0:
        _lm_arc_band(m, arc, c, xs - 1.0, 0.45, z - 0.35, z + 0.25, LM_I_METAL)
        z += 4.8
    _lm_arc_band(m, arc, c, xs - 1.0, 0.6, zr - 0.6, zr + 0.3, LM_I_STONE, LM_I_ROOF)
    for x, y in arc[1:-1]:
        ang = math.atan2(y - c[1], x - c[0])
        r = math.hypot(x - c[0], y - c[1]) + 0.22
        m.obox(c[0] + r * math.cos(ang), c[1] + r * math.sin(ang), 0.25, 0.06, ang, zg, zr - 0.6, LM_I_METAL)
    tx0, tx1, ty0, ty1, th = LM_UIJEONG_TOWER                                 # 서쪽 면도 입면: 의정관 지붕 위로 드러남
    _lm_block(m, (tx0, tx1, ty0, ty1), 0.0, th, pier=(0.7, 0.8, 2.4), band=(0.5, 0.3), floor_h=4.8,
              base=(1.0, 0.15), attic=2.4, cornice=(0.4, 0.4), parapet=1.2)
    bx0, bx1, by0, by1, bz0, bz1 = LM_BRIDGE
    e0, e1 = bx0 - 1.5, bx1 + 1.1                     # 도서관 유리면(피어 깊이 1.4)·의정관 유리면(1.0)보다 10 cm 안까지
    m.box(e0, e1, by0, by1, bz0, bz0 + 0.7, LM_I_STONE)
    m.box(e0, e1, by0, by1, bz1 - 0.6, bz1, LM_I_STONE, mi_top=LM_I_ROOF)
    m.box(e0, e1, by0 + 0.25, by1 - 0.25, bz0 + 0.7, bz1 - 0.6, LM_I_GLASS)
    zm = (bz0 + 0.7 + bz1 - 0.6) / 2
    m.box(e0, e1, by0 + 0.17, by1 - 0.17, zm - 0.1, zm + 0.1, LM_I_METAL)
    nb = int((bx1 - bx0) / 1.6)
    for k in range(nb + 1):
        x = bx0 + (bx1 - bx0) * k / nb
        m.box(x - 0.06, x + 0.06, by0 + 0.2, by1 - 0.2, bz0 + 0.7, bz1 - 0.6, LM_I_METAL)
    _lm_rooftop(m, ctx.rng, (x0, xs - 2, y0, y1), zr, 3)


def _lm_museum(ctx, m):
    """헌정기념관·국회박물관 (1998): 낮은 화강석 건물, 서쪽 입구에 네모 돌기둥 주랑과 두꺼운 보, 넓은 피어 간격."""
    x0, x1, y0, y1, h = LM_MUSEUM
    rect, cy = (x0, x1, y0, y1), (y0 + y1) / 2
    zr = _lm_block(m, rect, 0.0, h, pier=(1.4, 1.2, 5.6), band=(1.2, 0.5), floor_h=4.4, base=(0.9, 0.2),
                   attic=1.9, cornice=(0.5, 0.8), parapet=0.6, recess=('w', cy - 18.6, cy + 18.6, 4.2, 8.6))
    _lm_loggia_columns(m, rect, 'w', [cy - 17.5 + 5.0 * k for k in range(8)], 0.15, 1.15, 1.0, 0.9, 8.1)
    sx = (x0 + x1) / 2                                                           # 전시실 위 긴 천창
    m.box(sx - 6.0, sx + 6.0, cy - 30.0, cy + 30.0, zr, zr + 1.5, LM_I_GLASS)
    m.box(sx - 6.3, sx + 6.3, cy - 30.3, cy + 30.3, zr + 1.5, zr + 1.8, LM_I_STONE, mi_top=LM_I_GLASS)
    for k in range(-5, 6):
        m.box(sx - 6.3, sx + 6.3, cy + k * 5.5 - 0.12, cy + k * 5.5 + 0.12, zr + 1.8, zr + 1.95, LM_I_METAL)
    _lm_rooftop(m, ctx.rng, (x0 + 4, sx - 8, y0 + 10, y1 - 10), zr, 2)


# --- 의원회관 · 소통관 · 작은 건물 ------------------------------------------------------------

LM_MEMBERS = {   # 의원회관 (40 m): 본동·북동·남동, 가운데 낮은 유리 아트리움 (12 m)
    'main': (-196.0, -140.0, -290.0, -156.0),
    'north': (-286.0, -196.0, -188.0, -146.0),
    'south': (-286.0, -196.0, -299.0, -257.0),
    'atrium': (-266.0, -196.0, -257.0, -188.0),
}
LM_SOTONG = (-205.0, 7.5, 30.0, 33.0)          # 소통관 중심 x, y, 반폭 X, 반폭 Y (위치는 확인되지 않음)
LM_SMALL = ((36.0, 72.0, 152.0, 184.0), (-200.0, -165.0, 53.0, 93.0), (-153.0, -129.0, 148.0, 179.0),
            (197.0, 254.0, -61.0, -6.0), (-344.0, -280.0, -370.0, -343.0))   # 2층(8 m) 어린이집·경비대·다솜화원


def _lm_members(ctx, m):
    """의원회관: 옅은 화강석 피어 + 회녹색 유리, 40 m 세 동 (옆 두 동은 15 cm 낮춰 맞붙은 지붕 면이 겹치지 않게),
    본동 동쪽의 들인 현관, 12 m 유리 아트리움."""
    spec = dict(pier=(0.9, 1.1, 3.3), band=(0.75, 0.4), floor_h=3.8, base=(1.6, 0.2), attic=1.8,
                cornice=(0.6, 0.7), parapet=1.0)
    main = LM_MEMBERS['main']
    cy = (main[2] + main[3]) / 2
    for key in ('main', 'north', 'south'):          # 맞붙은 면도 입면을 둠: 아트리움 위·끝동으로 드러나는 부분이 있음
        rect = LM_MEMBERS[key]
        rec = ('e', cy - 14.0, cy + 14.0, 4.0, 7.6) if key == 'main' else None
        zr = _lm_block(m, rect, 0.0, 40.0 if key == 'main' else 39.85, recess=rec, **spec)
        x0, x1, y0, y1 = rect
        _lm_rooftop(m, ctx.rng, (x0 + 4, x1 - 4, y0 + 4, y1 - 4), zr, 3, (6.0, 14.0))
    _lm_loggia_columns(m, main, 'e', [cy + k * 8.0 for k in (-1.5, -0.5, 0.5, 1.5)], 0.2, 1.1, 0.9, 1.6, 7.1)
    ax0, ax1, ay0, ay1 = LM_MEMBERS['atrium']
    m.box(ax0, ax1 + 0.5, ay0 - 0.5, ay1 + 0.5, -0.3, 0.8, LM_I_BASE)
    m.box(ax0 + 0.3, ax1 + 0.5, ay0 - 0.5, ay1 + 0.5, 0.8, 11.4, LM_I_GLASS)
    m.box(ax0, ax1 + 0.5, ay0 - 0.5, ay1 + 0.5, 11.4, 12.0, LM_I_METAL, mi_top=LM_I_GLASS)
    for k in range(1, 24):
        y = ay0 + (ay1 - ay0) * k / 24
        m.box(ax0 + 0.15, ax0 + 0.35, y - 0.07, y + 0.07, 0.8, 11.4, LM_I_METAL)
        m.box(ax0, ax1, y - 0.12, y + 0.12, 12.0, 12.35, LM_I_METAL)
    for z in (4.2, 7.8):
        m.box(ax0 + 0.1, ax0 + 0.35, ay0, ay1, z - 0.1, z + 0.1, LM_I_METAL)


def _lm_sotong(m):
    """국회소통관 (2019): 5 m 높이 판 네 장을 ±4° 씩 번갈아 비틀어 쌓음 — 흰 금속 층 테두리, 안쪽 유리, 흰 세로 핀."""
    cx, cy, hx, hy = LM_SOTONG
    for k in range(4):
        ang = math.radians(4.0 if k % 2 == 0 else -4.0)
        c, s = math.cos(ang), math.sin(ang)
        z0, z1 = 5.0 * k, 5.0 * k + 5.0
        ex = 1.2 if k == 0 else 0.0                                             # 1층은 조금 들어간 로비
        gx, gy = hx - 1.4 - ex, hy - 1.4 - ex
        m.obox(cx, cy, hx - ex, hy - ex, ang, z1 - 0.9, z1, LM_I_METAL, mi_top=LM_I_ROOF if k == 3 else None)
        m.obox(cx, cy, gx, gy, ang, z0 if k else -0.3, z1 - 0.9, LM_I_GLASS)
        zf = z0 if k else 0.0

        def fin(lx, ly, fx, fy):                                                # 세로 핀 (유리면 밖 0.25 m)
            m.obox(cx + c * lx - s * ly, cy + s * lx + c * ly, fx, fy, ang, zf, z1 - 0.9, LM_I_METAL)

        nx, ny = int(2 * gx / 3.0), int(2 * gy / 3.0)
        for sgn in (-1, 1):
            for i in range(1, nx):
                fin(-gx + 2 * gx * i / nx, sgn * (gy + 0.25), 0.07, 0.3)
            for i in range(1, ny):
                fin(sgn * (gx + 0.25), -gy + 2 * gy * i / ny, 0.3, 0.07)
    m.obox(cx + 8.0, cy - 6.0, 9.0, 6.0, math.radians(4.0), 20.0, 22.4, LM_I_ROOF)             # 옥상 기계실


def _lm_small_buildings(m):
    """2층 작은 건물 다섯: 굽·피어보다 3 cm 내민 띠(띠창)·기둥형 피어·얇은 처마·파라펫, 남쪽 가운데 들인 현관.
    비탈(의원동산 자락) 위 건물은 가장 낮은 땅에 앉히고 층을 더해, 비탈 아래쪽은 지하층이 드러나고 위쪽은 땅에 묻힙니다."""
    for x0, x1, y0, y1 in LM_SMALL:
        lo, hi = _lm_ground_range(x0, x1, y0, y1)
        extra = 3.6 * round((hi - lo) / 2.0 / 3.6)                                # 드러난 지하층 (층높이 3.6)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        zr = _lm_block(m, (x0, x1, y0, y1), lo, 8.0 + extra, pier=(0.6, 0.35, 5.0), band=(1.6, -0.03),
                       floor_h=3.6, base=(0.6, 0.1), attic=1.4, cornice=(0.2, 0.25), parapet=0.5,
                       recess=('s', cx - 3.0, cx + 3.0, 2.0, lo + 3.4))
        m.box(cx + 2.0, cx + 8.0, cy - 3.0, cy + 2.0, zr, zr + 2.3, LM_I_STONE)             # 옥상 기계실


# --- 사랑재 (한옥, 2011) ------------------------------------------------------------------
# 로컬 좌표: 돌 기단 가운데 지면 원점, +X = 긴 축. 오브젝트 행렬로 (192, 20, ground_z) 에 43° 돌려 놓습니다
# (창살·기와 골 무늬가 벽·지붕 방향을 따르도록 메시는 로컬 좌표 그대로 둠).
LM_HANOK = (192.0, 20.0, 43.0)             # 중심 x, y, z 회전(°)
LM_HANOK_TERRACE = (16.2, 7.8, 1.0)        # 기단 반폭 X, Y, 높이
LM_HANOK_LOWER = 1.0                        # 아래 단 기단이 위 단보다 넓은 폭
LM_HANOK_BAYS = (11, 4, 2.6, 2.9)          # 칸 수 X·Y, 칸 너비 X·Y → 기둥 28.6 x 11.6 m
LM_HANOK_EAVE = (2.2, 3.9, 7.5)            # 처마 내밀기, 처마 끝 높이(기단 위), 용마루 면 높이(기단 위)
LM_HANOK_ROOF = (0.52, 11.2, 0.9, 0.5)     # 합각이 시작되는 t, 합각 반길이, 추녀 솟음, 안허리 내밈
LM_HANOK_RING = (16, 44, 16)               # 지붕 고리 수, 긴 변·짧은 변 나눔
LM_HK_TILE, LM_HK_GABLE, LM_HK_SOFFIT, LM_HK_WOOD, LM_HK_PLASTER, LM_HK_LATTICE, LM_HK_STONE = range(7)


def _lm_hanok_ring(t, inset=0.0):
    """지붕 고리 하나 (t = 0 처마 끝 → 1 용마루): 반시계 점 [(x, y, z, 짧은 변 여부)]. 네 모서리는 추녀처럼 솟고
    평면에서도 바깥으로 휩니다 (합각 시작 t_g 에 가까울수록 약해짐). t ≥ t_g 의 짧은 변은 수직 합각 벽이 됩니다."""
    _, nl, ns = LM_HANOK_RING
    px, py = LM_HANOK_BAYS[0] * LM_HANOK_BAYS[2] / 2, LM_HANOK_BAYS[1] * LM_HANOK_BAYS[3] / 2
    over, ze, zr = LM_HANOK_EAVE
    tg, ag, lift, flare = LM_HANOK_ROOF
    A, B = px + over, py + over
    b = max(0.05, B * (1.0 - t) + 0.15 * t - inset)
    a = (A - (A - ag) * t / tg if t < tg else ag) - inset
    w = (1.0 - t / tg) ** 2 if t < tg else 0.0
    z = LM_HANOK_TERRACE[2] + ze + (zr - ze) * t ** 1.35
    pts = []
    for (x0, y0), (x1, y1), n in (((-a, -b), (a, -b), nl), ((a, -b), (a, b), ns), ((a, b), (-a, b), nl),
                                  ((-a, b), (-a, -b), ns)):
        for i in range(n):
            x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            on_long, on_short = abs(abs(y) - b) < 1e-6, abs(abs(x) - a) < 1e-6
            cx, cy = (abs(x) / a) ** 3, (abs(y) / b) ** 3
            c = max(cx if on_long else 0.0, cy if on_short else 0.0)
            dx = math.copysign(flare * cy * cy * w, x) if on_short else 0.0
            dy = math.copysign(flare * cx * cx * w, y) if on_long else 0.0
            pts.append((x + dx, y + dy, z + lift * c * w, t >= tg and on_short))
    return pts


def _lm_hanok_roof(m):
    """팔작지붕: 처마→용마루 고리를 이어 윗면(기와)·합각(수직 삼각 벽)을 만들고, 조금 안쪽·아래의 밑면(서까래)과
    처마 끝 띠·꼭대기 띠로 닫습니다. 반환: 윗면 고리 목록 (마루를 얹을 자리)."""
    nt = LM_HANOK_RING[0]
    tg = LM_HANOK_ROOF[0]
    ts = sorted(set([i / (nt - 1) for i in range(nt)] + [tg]))
    top = [_lm_hanok_ring(t) for t in ts]
    bot = [[(x, y, z - (0.32 + 0.28 * min(1.0, t / 0.3)), g) for x, y, z, g in _lm_hanok_ring(t, inset=0.25)]
           for t in ts]
    bm = m.bm
    vt = [[bm.verts.new(p[:3]) for p in ring] for ring in top]
    vb = [[bm.verts.new(p[:3]) for p in ring] for ring in bot]
    n = len(top[0])
    for i in range(len(ts) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            gable = top[i][k][3] and top[i][k2][3] and top[i + 1][k][3] and top[i + 1][k2][3]
            f = bm.faces.new((vt[i][k], vt[i][k2], vt[i + 1][k2], vt[i + 1][k]))
            f.material_index = LM_HK_GABLE if gable else LM_HK_TILE
            bm.faces.new((vb[i][k], vb[i + 1][k], vb[i + 1][k2], vb[i][k2])).material_index = LM_HK_SOFFIT
    for k in range(n):
        k2 = (k + 1) % n
        bm.faces.new((vb[0][k], vb[0][k2], vt[0][k2], vt[0][k])).material_index = LM_HK_TILE
        bm.faces.new((vt[-1][k], vt[-1][k2], vb[-1][k2], vb[-1][k])).material_index = LM_HK_TILE
    return top


def _lm_hanok_ridges(m, top):
    """용마루 (양 끝이 살짝 솟음), 모서리의 추녀마루, 합각 윗변의 내림마루 — 고리 모서리 점을 따라가는 네모 마루."""
    ag = LM_HANOK_ROOF[1]
    zr = top[-1][0][2]
    m.beam((-ag - 0.25, 0.0, zr + 0.18), (ag + 0.25, 0.0, zr + 0.18), 0.55, 0.6, LM_HK_TILE)
    for sx in (-1, 1):                                                          # 양 끝 치미 (살짝 솟은 마루 끝)
        m.beam((sx * (ag - 0.2), 0.0, zr - 0.1), (sx * (ag + 0.45), 0.0, zr + 0.75), 0.6, 0.7, LM_HK_TILE)
    _, nl, ns = LM_HANOK_RING
    for k in (0, nl, nl + ns, 2 * nl + ns):
        line = [top[i][k][:3] for i in range(len(top))]
        for p, q in zip(line, line[1:]):
            m.beam((p[0], p[1], p[2] + 0.13), (q[0], q[1], q[2] + 0.13), 0.34, 0.3, LM_HK_TILE)


def _lm_hanok_terrace(m):
    """두 단 돌 기단: 아래 단(1 m 넓고 윗면 = 기단 가운데 땅높이)이 의원동산 비탈을 받아 위 단이 높이 솟지 않게 하고,
    위 단(갑석)에 오르는 앞뒤 가운데 계단은 비탈 아래 땅(약 -0.4)부터 시작합니다."""
    tx, ty, th = LM_HANOK_TERRACE
    lw = LM_HANOK_LOWER
    m.box(-tx - lw, tx + lw, -ty - lw, ty + lw, -2.0, -0.12, LM_HK_STONE)
    m.box(-tx - lw - 0.08, tx + lw + 0.08, -ty - lw - 0.08, ty + lw + 0.08, -0.12, 0.0, LM_HK_STONE)
    m.box(-tx, tx, -ty, ty, -0.3, th - 0.2, LM_HK_STONE)
    m.box(-tx - 0.1, tx + 0.1, -ty - 0.1, ty + 0.1, th - 0.2, th, LM_HK_STONE)
    zg, n = -0.4, 8
    for sgn in (-1, 1):                                    # 단마다 제 디딤판 폭만 (옆면이 겹치지 않게)
        for k in range(n):
            m.box(-2.2, 2.2, sgn * (ty + 0.3 * (n - k)), sgn * (ty + 0.3 * (n - k - 1)), -2.0,
                  zg + (th - zg) * (k + 1) / n - 0.02, LM_HK_STONE)


def _lm_hanok_body(m):
    """주춧돌·둥근 기둥, 긴 변은 창살문·짧은 변은 회벽, 창방·익공·포벽(지붕 밑면까지)."""
    _, _, th = LM_HANOK_TERRACE
    nx, ny, sx, sy = LM_HANOK_BAYS
    px, py = nx * sx / 2, ny * sy / 2
    posts = [(-px + sx * i, s * py) for i in range(nx + 1) for s in (-1, 1)]
    posts += [(s * px, -py + sy * j) for j in range(1, ny) for s in (-1, 1)]
    zt = th + 3.25
    for x, y in posts:
        m.box(x - 0.32, x + 0.32, y - 0.32, y + 0.32, th, th + 0.28, LM_HK_STONE)
        m.prism([(x + 0.2 * math.cos(math.pi * k / 4 + math.pi / 8), y + 0.2 * math.sin(math.pi * k / 4 + math.pi / 8))
                 for k in range(8)], th + 0.28, zt + 0.34, LM_HK_WOOD, bottom=False)
        for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):                            # 익공 (기둥 머리 받침)
            if (abs(x) > px - 0.1 and d[0] * x > 0) or (abs(y) > py - 0.1 and d[1] * y > 0):
                m.box(x - 0.12 + min(0, d[0]) * 0.45, x + 0.12 + max(0, d[0]) * 0.45,
                      y - 0.12 + min(0, d[1]) * 0.45, y + 0.12 + max(0, d[1]) * 0.45, zt - 0.1, zt + 0.32, LM_HK_WOOD)
    for (x0, y0), (x1, y1), long_side in (((-px, -py), (px, -py), True), ((-px, py), (px, py), True),
                                          ((-px, -py), (-px, py), False), ((px, -py), (px, py), False)):
        _lm_hanok_wall(m, x0, y0, x1, y1, long_side, th, zt)


def _lm_hanok_wall(m, x0, y0, x1, y1, long_side, th, zt):
    """기둥 줄 하나의 벽: 칸마다 아래 머름(나무)·창살문(긴 변) 또는 회벽+중방(짧은 변), 위로 창방·포벽."""
    along_x = abs(y1 - y0) < 1e-6
    L = abs(x1 - x0) if along_x else abs(y1 - y0)
    n = LM_HANOK_BAYS[0] if along_x else LM_HANOK_BAYS[1]

    def seg(a0, a1, d, z0, z1, mi):
        if along_x:
            m.box(x0 + a0, x0 + a1, y0 - d, y0 + d, z0, z1, mi)
        else:
            m.box(x0 - d, x0 + d, y0 + a0, y0 + a1, z0, z1, mi)

    for i in range(n):
        a0, a1 = L * i / n + 0.2, L * (i + 1) / n - 0.2
        seg(a0, a1, 0.12, th + 0.1, th + 0.75, LM_HK_WOOD)
        if long_side:
            seg(a0, a1, 0.05, th + 0.75, zt - 0.05, LM_HK_LATTICE)
        else:
            seg(a0, a1, 0.09, th + 0.75, zt - 0.05, LM_HK_PLASTER)
            seg(a0 - 0.05, a1 + 0.05, 0.11, th + 1.75, th + 1.95, LM_HK_WOOD)      # 중방 (끝이 기둥 속으로)
    dz = 0.0 if long_side else -0.02            # 모서리에서 긴 변·짧은 변 부재의 윗면이 한 평면에 겹치지 않게
    seg(-0.3, L + 0.3, 0.16, zt - 0.05 + dz, zt + 0.35 + dz, LM_HK_WOOD)         # 창방
    seg(-0.3, L + 0.3, 0.1, zt + 0.35 + dz, zt + 0.95 + dz, LM_HK_PLASTER)       # 포벽 (지붕 밑면 안까지)
    seg(-0.28, L + 0.28, 0.14, zt + 0.55 + dz, zt + 0.75 + dz, LM_HK_WOOD)       # 장혀


def _lm_hanok(coll, mt):
    """사랑재: 돌 기단 위 11 x 4 칸 한옥, 팔작지붕 (처마 약 4 m, 용마루 약 8 m). 의원동산 꼭대기 (192, 20)."""
    cx, cy, rot = LM_HANOK
    m = _LmMesh('LM_Sarangjae', [mt['giwa'], mt['hanok_gable'], mt['hanok_soffit'], mt['timber'], mt['plaster'],
                                  mt['lattice'], mt['hanok_stone']])
    _lm_hanok_ridges(m, _lm_hanok_roof(m))
    _lm_hanok_terrace(m)
    _lm_hanok_body(m)
    m.finish(coll, place=Matrix.Translation((cx, cy, ground_z(cx, cy))) @ Matrix.Rotation(math.radians(rot), 4, 'Z'))


def _lm_neighbours(ctx, coll, mt):
    """이웃 건물들: 건물마다 재질 칸이 다른 메시 하나 (0 돌, 1 유리, 2 짙은 굽, 3 지붕, 4 금속·흰 패널).
    유리는 본관의 금빛 유리(공유 glass)와 구분되는 이웃 건물 전용 유리 (의원회관은 회녹색)."""
    g = ctx.mats
    ng, gg = mt['nglass'], mt['nglass_green']
    specs = (('LM_Library', g['granite'], ng, g['metal'], lambda m: _lm_library(ctx, m)),
             ('LM_Uijeonggwan', g['granite_light'], ng, mt['white_panel'], lambda m: _lm_uijeong(ctx, m)),
             ('LM_Museum', g['granite'], ng, g['metal'], lambda m: _lm_museum(ctx, m)),
             ('LM_Members_Office', g['granite_light'], gg, g['metal'], lambda m: _lm_members(ctx, m)),
             ('LM_Sotong', mt['white_panel'], ng, mt['white_panel'], _lm_sotong),
             ('LM_Small_Buildings', mt['render'], ng, g['metal'], _lm_small_buildings))
    for name, stone, glass, accent, fn in specs:
        m = _LmMesh(name, [stone, glass, g['granite_dark'], mt['roof'], accent])
        fn(m)
        m.finish(coll)


def build_landmarks(ctx):
    """상징물·정문·이웃 건물 전체 (부지 옵션일 때만 불림)."""
    coll = ctx.coll('Landmarks')
    mt = _lm_materials(ctx)
    bk = _LmBaker()
    _lm_haetae(ctx, coll, mt, bk)
    _lm_symbol_stone(coll, mt, bk)
    _lm_main_gate(coll, mt, bk)
    _lm_pedestals(ctx, coll, mt, bk)
    bk.run(coll)
    _lm_neighbours(ctx, coll, mt)
    _lm_hanok(coll, mt)


# ----------------------------------------------------------------------------
# 기단 — 지상 1층을 품은 화강석 받침, 양 끝 돌출부, 정면 대계단, 기단 파라펫, 기단면 포장, 뒤쪽 참관 출입구
#
# 평면 (00_header, OSM): 기단 PODIUM_X x PODIUM_Y = 164.4 x 123.4 (X ±82.2, Y ±61.7), 지면 → 기단면 5.44 m.
#   왼쪽 돌출부 X -98.8..-82.2, Y -13.5..+12 = 기단면까지 오르는 옆 계단,
#   오른쪽 돌출부 X +82.2..+95, Y -6..+6 = 서비스 출입 블록 (지붕은 기단면과 이어지고 파라펫이 둘러쌈).
#   정면 대계단: 전체 너비 STAIR_W 50 m (옆벽 |x| 23.5..25, 디딤판 47 m), 기단 앞면 y -61.7 → 맨 아랫단 STAIR_FOOT_Y.
# 대계단 단수·참은 자료가 없어(OSM 은 너비·깊이만) 매개변수입니다: 챌면 0.16 m x 34단 = 5.44 m 를 세 흐름(12·11·11),
#   넓은 참 두 곳(약 6 m), 기단 앞 맨 위 참(약 3.3 m, OSM 의 47 x 3.8 m 띠)으로. 디딤판 약 0.55 m.
#   디딤판·참이 모두 디딤판 t 의 정수배라 판석 줄눈이 계단 전체에서 한 격자로 맞습니다.
#   OSM 의 '계단 밑을 지나는 차로'(y ≈ -78, 높이 5 m)는 이 단면(그 자리 계단 높이 약 2~3 m)으로는 머리 공간이 없어
#   만들지 않고 계단을 통으로 둡니다.
# 벽 좌표: 면마다 a = 면을 따라(앞·뒤 = x, 좌·우 = y), d = 바깥 면에서 안쪽 깊이(음수 = 바깥으로 내밈), z = 높이.
#   벽은 두께 POD_T 의 껍데기(굽·창 띠·그림자 홈·파라펫·갓돌)이고, 안은 비어 있지만 기단면 슬래브와 계단이 닫습니다.
#   앞·뒤(긴 면)가 모서리를 품고 옆(짧은 면)은 그 사이에 들어가며, 굽·갓돌 끝은 맞닿는 곳에서 서로 겹치지 않게 자릅니다.
# 지상 1층 창 띠: 본체 핀과 같은 격자(열주 한 칸 / 10 ≈ 2.06 m, 열주 축에서 시작) — 2 모듈마다 화강석 피어
#   (열주 축은 넓게), 사이 창에 청동색 틀·멀리언·가로살과 돌 창턱. 유리는 공유 재질 glass (밤에 방마다 불빛).
# 계단 좌표: s = 맨 아랫단 챌면에서 기단 쪽으로, w = 계단 너비 방향, z. frame(s, w, z) 가 월드 좌표로 바꿉니다.
# ----------------------------------------------------------------------------
POD_SINK = 0.30                     # 벽·계단을 지면 아래로 묻는 깊이 (지면과 틈 방지)
POD_COURSE = PODIUM_H / 6           # 화강석 한 단 높이 — 공유 granite 의 가로 줄눈(기단 높이에 6단)과 창·홈·갓돌을 맞춤
POD_T = 0.50                        # 벽 껍데기(= 파라펫) 두께
POD_BASE_TOP, POD_BASE_OUT = 0.55, 0.06      # 짙은 화강석 굽: 윗면 높이·내밈
POD_WIN_Z = (POD_COURSE, 4 * POD_COURSE)     # 지상 1층 창 띠 아래·위 = 줄눈 (0.91 / 3.63, 출입구 머리도 같은 높이)
POD_WIN_MARGIN = 1.6                # 모서리·개구부에서 이보다 가까운 피어 자리는 통벽
POD_FRONT_WINDOWS = True            # 정면(대계단 양쪽)에도 창 띠 (자료 없음 — 1층 사무실이 앞 차로를 보므로 옆·뒤와 같게)
POD_GLASS_D = 0.30                  # 유리 앞면 깊이 (벽면에서)
POD_PIER_W, POD_AXIS_PIER_W = 0.55, 1.30     # 피어 폭 (일반 / 열주 축)
POD_MULLION = (0.07, 0.10)          # 멀리언 폭·유리 앞 돌출
POD_FRAME_W = 0.06                  # 창틀 폭
POD_TRANSOM_Z = 3 * POD_COURSE      # 가로살 높이 = 줄눈 (위는 고정 채광창)
POD_SILL = (0.08, 0.04)             # 돌 창턱 높이·벽 밖 내밈
POD_GROOVE = (PODIUM_H - 0.04, PODIUM_H + 0.04, 0.035)   # 기단면 높이(= 줄눈)의 그림자 홈 (z0, z1, 깊이)
POD_COPING_H, POD_COPING_OUT = 0.12, 0.05    # 갓돌 두께·양쪽 내밈
POD_PARAPET_H = POD_COURSE + POD_COPING_H    # 파라펫 높이 (기단면에서, 갓돌 포함) 1.03 → 윗면 6.47, 갓돌 밑 = 줄눈
POD_DECK_T = 1.0                    # 기단면 슬래브 두께
POD_PAVE_MODULES = 17               # 열주 한 칸당 포장 판 수 (앞뒤 20.571/17 = 1.210, 옆 20.6/17 = 1.212 m)

POD_FLIGHTS = (12, 11, 11)          # 대계단 흐름별 챌면 수 (합 34 → 챌면 0.16 m)
POD_LANDING_T = 11                  # 참 깊이 (디딤판 수) → 디딤판 약 0.55 m, 참 약 6.0 m
POD_TOP_T = 6                       # 맨 위 참 (디딤판 수, 마지막 챌면 → 기단 앞면 약 3.3 m — OSM 의 y -65.2..-61.4 띠)
POD_NOSING = 0.03                   # 디딤판 코 내밈 (밑에 45° 홈 → 가는 그림자 선)
POD_CHEEK = (23.5, 25.0)            # 대계단 옆벽 안·바깥 |x|
POD_CHEEK_H = POD_PARAPET_H         # 옆벽 높이 (코 선에서, 갓돌 포함) — 맨 위에서 파라펫과 같은 높이
POD_NEWEL = (-0.10, 1.0, 0.30)      # 아래 끝 기둥돌: 앞면 s, 길이, 옆벽 갓돌보다 높은 만큼
POD_RAILS = (7.5, 16.0)             # 대계단 난간 |x| (가운데 15 m 는 의전 축으로 비움)
POD_RAIL_H, POD_RAIL_R, POD_POST_R = 0.90, 0.028, 0.022
POD_POST_STEP = 1.8                 # 난간 기둥 간격 (디딤판 가운데로 맞춤)
POD_STEP_LIGHT = (0.36, 0.09, 0.32)  # 옆벽 안쪽 발밑등: 길이, 높이, 디딤판 위 중심 높이 (자료 없음, 밤 분위기용)

POD_SIDE_X = (-98.8, -82.2)         # 왼쪽 옆 계단 (맨 아랫단 → 기단 옆면)
POD_SIDE_Y = (-13.5, 12.0)
POD_SIDE_FLIGHTS = (17, 17)
POD_SIDE_LANDING_T = 9              # → 디딤판 약 0.40 m, 참 약 3.6 m
POD_SIDE_TOP_T = 1
POD_SIDE_CHEEK_W = 1.2
POD_SIDE_RAIL = 5.8                 # 옆 계단 난간: 가운데에서 ± (세 갈래)

POD_ANNEX = (82.2, 95.0, -6.0, 6.0)          # 오른쪽 서비스 블록 x0, x1, y0, y1
POD_ANNEX_DOOR = 3.2                # 서비스 셔터 반폭 (동쪽 면 가운데)
POD_ENTRY_HW, POD_ENTRY_D = 9.0, 2.4         # 뒤 참관 출입구: 반폭, 현관 깊이
POD_DOOR_HW = 1.2                   # 보조 출입문 반폭 (뒤·양 끝면의 열주 칸 가운데, 유리 양여닫이 + 돌 차양)
POD_DOOR_BAY = 1.5                  # 보조 출입문 자리: 모서리 열주 축에서 1.5 칸 안쪽 (앞뒤 ±41.1, 옆 ±20.6)
POD_CANOPY = (12.0, 6.0, 4.10)      # 캐노피 반폭, 내밈, 밑면 높이
POD_LAMP_NIGHT = (14.0, 55.0)       # 등갓 발광 세기, 밤 점광원 W


# --- 형상 도우미 ------------------------------------------------------------------

def _pod_box(bm, x0, x1, y0, y1, z0, z1, mi=0):
    """축 정렬 상자 (bmesh.ops 를 쓰지 않아 수천 개도 빠름). 면 방향은 바깥, 재질 번호 mi."""
    x0, x1 = sorted((x0, x1))
    y0, y1 = sorted((y0, y1))
    if x1 - x0 < 1e-5 or y1 - y0 < 1e-5 or z1 - z0 < 1e-5:
        return
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for idx in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in idx]).material_index = mi


def _pod_wbox(bm, seg, a0, a1, d0, d1, z0, z1, mi=0):
    """벽 좌표 (a, d, z) 상자 → 월드. d 는 바깥 면에서 안쪽으로 (음수 = 벽 밖으로 내밈)."""
    c, n = seg['c'], seg['n']
    w0, w1 = c - n * d0, c - n * d1
    if seg['axis'] == 'x':
        _pod_box(bm, a0, a1, w0, w1, z0, z1, mi)
    else:
        _pod_box(bm, w0, w1, a0, a1, z0, z1, mi)


def _pod_fbox(bm, frame, s0, s1, w0, w1, z0, z1, mi=0):
    """계단 좌표 (s, w, z) 상자 → 월드 (frame 은 축 교환·평행 이동뿐이라 상자가 그대로 상자)."""
    p, q = frame(s0, w0, z0), frame(s1, w1, z1)
    _pod_box(bm, p[0], q[0], p[1], q[1], z0, z1, mi)


def _pod_extrude(bm, prof, w0, w1, frame, mi=0):
    """(s, z) 닫힌 단면을 w0 → w1 로 밀어낸 프리즘 (오목 단면 가능). 면 방향은 finish_mesh 가 맞춥니다."""
    a = [bm.verts.new(frame(s, w0, z)) for (s, z) in prof]
    b = [bm.verts.new(frame(s, w1, z)) for (s, z) in prof]
    bm.faces.new(a).material_index = mi
    bm.faces.new(list(reversed(b))).material_index = mi
    for i in range(len(prof)):
        j = (i + 1) % len(prof)
        bm.faces.new((a[i], b[i], b[j], a[j])).material_index = mi


def _pod_tube(bm, p0, p1, r, sides=8, extend=0.0, mi=0):
    """p0 → p1 둥근 관 (난간·기둥·인장봉). extend 만큼 양 끝을 늘여 꺾이는 곳의 틈을 메웁니다."""
    p0, p1 = Vector(p0), Vector(p1)
    axis = (p1 - p0).normalized()
    p0, p1 = p0 - axis * extend, p1 + axis * extend
    u = axis.cross(Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))).normalized()
    v = axis.cross(u)
    rings = []
    for p in (p0, p1):
        rings.append([bm.verts.new(p + r * (math.cos(2 * math.pi * k / sides) * u +
                                            math.sin(2 * math.pi * k / sides) * v)) for k in range(sides)])
    for k in range(sides):
        k2 = (k + 1) % sides
        bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k])).material_index = mi
    bm.faces.new(list(reversed(rings[0]))).material_index = mi
    bm.faces.new(rings[1]).material_index = mi


def _pod_minus(a0, a1, holes):
    """구간 [a0, a1] 에서 구멍 구간들을 뺀 나머지 구간 목록."""
    out, cur = [], a0
    for h0, h1 in sorted(holes):
        if h0 > cur:
            out.append((cur, min(h0, a1)))
        cur = max(cur, h1)
    if cur < a1:
        out.append((cur, a1))
    return out


# --- 계단 단면 --------------------------------------------------------------------

def _pod_stair_plan(flights, landing_t, top_t, run):
    """계단 계획. 반환 dict: t(디딤판), rise(챌면), run, steps [(챌면 s, 그 단 윗면 z)],
    flights [(첫 챌면 s, 마지막 챌면 s, 흐름 아래 z, 위 z)], top (맨 위 참 깊이). 참·맨 위 참은 디딤판 t 의 정수배."""
    rise = PODIUM_H / sum(flights)
    t = run / (sum(k - 1 for k in flights) + landing_t * (len(flights) - 1) + top_t)
    steps, fl = [], []
    s, z = 0.0, 0.0
    for i, k in enumerate(flights):
        s0, z0 = s, z
        for j in range(k):
            z += rise
            steps.append((s, z))
            if j < k - 1:
                s += t
        fl.append((s0, s, z0, z))
        s += (landing_t if i < len(flights) - 1 else top_t) * t
    return dict(t=t, rise=rise, run=run, steps=steps, flights=fl, top=top_t * t)


def _pod_step_profile(plan):
    """디딤판 코(3 cm 내밈 + 밑의 45° 홈 → 가는 그림자 선)가 있는 계단 단면 (s, z). 아래는 지면 밑까지 닫힘."""
    nos = POD_NOSING
    pts = [(0.0, -POD_SINK)]
    z_prev = None
    for (s, z) in plan['steps']:
        if z_prev is not None:
            pts.append((s, z_prev))
        pts += [(s, z - 0.035), (s - nos, z - 0.022), (s - nos, z - 0.008), (s - nos + 0.008, z)]
        z_prev = z
    return pts + [(plan['run'], PODIUM_H), (plan['run'], -POD_SINK)]


def _pod_nose_line(plan, s_end=None):
    """디딤판 코를 이은 선 [(s, z)]: 흐름은 기울기, 참·맨 윗단은 수평. s_end 가 있으면 거기까지 수평 연장."""
    t = plan['t']
    pts = []
    for (s0, s1, z0, z1) in plan['flights']:
        pts += [(s0 - t, z0), (s1, z1)]
    pts.append((plan['run'] if s_end is None else s_end, PODIUM_H))
    return pts


def _pod_at(line, s):
    """꺾은선 line 의 s 위치 z (선형 보간, 양 끝 밖은 끝 기울기로 연장)."""
    for (sa, za), (sb, zb) in zip(line, line[1:]):
        if s <= sb or (sb, zb) == line[-1]:
            return za + (zb - za) * (s - sa) / (sb - sa) if sb > sa else zb
    return line[-1][1]


def _pod_clip(line, s0, s1):
    """꺾은선을 [s0, s1] 로 자른 점 목록 (양 끝 보간점 포함)."""
    return [(s0, _pod_at(line, s0))] + [p for p in line if s0 < p[0] < s1] + [(s1, _pod_at(line, s1))]


def _pod_surface_z(plan, s):
    """s 위치의 디딤판(참) 윗면 z."""
    z = 0.0
    for (sr, zt) in plan['steps']:
        if s < sr:
            break
        z = zt
    return z


# --- 바깥벽 (지상 1층 창 띠, 굽, 그림자 홈, 파라펫) ------------------------------------

def _pod_segments():
    """기단 바깥벽 조각들. axis 'x' = y = c 인 면(앞·뒤), 'y' = x = c 인 면(좌·우), n = 바깥 법선 부호.
    base / cope = (a0 쪽, a1 쪽) 으로 굽·갓돌을 더 내거나(+) 줄이는(-) 길이 — 모서리·맞닿는 벽에서 겹침 방지.
    grid = 창 격자 (시작 = 열주 축, 모듈), win = 창을 낼 수 있는 a 범위, holes = 바닥부터 창 띠 머리까지 뚫린 구간,
    doors = 그 구멍 가운데 보조 출입문을 끼울 중심들 (나머지 구멍은 뒤 현관·서비스 셔터가 채움)."""
    hx, hy, t = PODIUM_X / 2, PODIUM_Y / 2, POD_T
    bo, co = POD_BASE_OUT, POD_COPING_OUT
    ci, cx = POD_CHEEK
    ax0, ax1, ay0, ay1 = POD_ANNEX
    sy0, sy1 = POD_SIDE_Y
    sw = POD_SIDE_CHEEK_W
    gx = (-L / 2, L / (COLS_FRONT - 1) / 10)
    gy = (-W / 2, W / (COLS_SIDE_BETWEEN + 1) / 10)
    gf = gx if POD_FRONT_WINDOWS else None
    dx = L / 2 - POD_DOOR_BAY * L / (COLS_FRONT - 1)          # 보조 출입문 중심 |a|
    dy = W / 2 - POD_DOOR_BAY * W / (COLS_SIDE_BETWEEN + 1)
    dh = lambda c: (c - POD_DOOR_HW, c + POD_DOOR_HW)
    return [
        # 정면 — 대계단 옆벽까지, 갓돌은 옆벽 위를 덮음
        dict(axis='x', c=-hy, n=-1, a0=-hx, a1=-cx, base=(bo, 0), cope=(co, cx - ci + co), grid=gf),
        dict(axis='x', c=-hy, n=-1, a0=cx, a1=hx, base=(0, bo), cope=(cx - ci + co, co), grid=gf),
        # 뒤 — 가운데 참관 출입구, 양쪽 보조 출입문
        dict(axis='x', c=hy, n=1, a0=-hx, a1=hx, base=(bo, bo), cope=(co, co), grid=gx, doors=(-dx, dx),
             holes=((-POD_ENTRY_HW, POD_ENTRY_HW), dh(-dx), dh(dx))),
        # 왼쪽 — 옆 계단 양쪽
        dict(axis='y', c=-hx, n=-1, a0=-hy + t, a1=sy0, base=(0, 0), cope=(-co, sw + co), grid=gy,
             doors=(-dy,), holes=(dh(-dy),)),
        dict(axis='y', c=-hx, n=-1, a0=sy1, a1=hy - t, base=(0, 0), cope=(sw + co, -co), grid=gy,
             doors=(dy,), holes=(dh(dy),)),
        # 오른쪽 — 서비스 블록 양쪽 (벽은 블록 안으로 t 만큼 더 들어가 파라펫 모서리를 채움)
        dict(axis='y', c=hx, n=1, a0=-hy + t, a1=ay0 + t, base=(0, -t), cope=(-co, co), grid=gy, win=(-hy, ay0),
             doors=(-dy,), holes=(dh(-dy),)),
        dict(axis='y', c=hx, n=1, a0=ay1 - t, a1=hy - t, base=(-t, 0), cope=(co, -co), grid=gy, win=(ay1, hy),
             doors=(dy,), holes=(dh(dy),)),
        # 서비스 블록 — 남·북 면은 창, 동쪽 면은 가운데 셔터
        dict(axis='x', c=ay0, n=-1, a0=ax0, a1=ax1 - t, base=(-bo, 0), cope=(-co, -co), grid=gx),
        dict(axis='x', c=ay1, n=1, a0=ax0, a1=ax1 - t, base=(-bo, 0), cope=(-co, -co), grid=gx),
        dict(axis='y', c=ax1, n=1, a0=ay0, a1=ay1, base=(bo, bo), cope=(co, co), grid=None,
             holes=((-POD_ANNEX_DOOR, POD_ANNEX_DOOR),)),
    ]


def _pod_wall(bm, seg):
    """벽 한 조각: 짙은 굽, 창 띠(또는 통벽), 윗벽, 기단면 높이 그림자 홈, 파라펫, 갓돌.
    재질 번호: 0 화강석, 1 짙은 화강석, 2 갓돌·창턱(밝은 화강석), 3 유리, 4 창틀(금속) (5 셔터, 6 벽등 유리)."""
    t = POD_T
    a0, a1 = seg['a0'], seg['a1']
    holes = seg.get('holes', ())
    e0, e1 = seg['base']
    for s0, s1 in _pod_minus(a0 - e0, a1 + e1, holes):
        _pod_wbox(bm, seg, s0, s1, -POD_BASE_OUT, t, -POD_SINK, POD_BASE_TOP, 1)
    wz0, wz1 = POD_WIN_Z
    for s0, s1 in _pod_minus(a0, a1, holes):
        _pod_wbox(bm, seg, s0, s1, 0.0, t, POD_BASE_TOP, wz0, 0)
        _pod_window_band(bm, seg, s0, s1)
    g0, g1, gd = POD_GROOVE
    top = PODIUM_H + POD_PARAPET_H
    _pod_wbox(bm, seg, a0, a1, 0.0, t, wz1, g0, 0)
    _pod_wbox(bm, seg, a0, a1, gd, t, g0, g1, 0)
    _pod_wbox(bm, seg, a0, a1, 0.0, t, g1, top - POD_COPING_H, 0)
    c0, c1 = seg['cope']
    _pod_wbox(bm, seg, a0 - c0, a1 + c1, -POD_COPING_OUT, t + POD_COPING_OUT, top - POD_COPING_H, top, 2)
    for c in seg.get('doors', ()):
        _pod_door(bm, seg, c)


def _pod_door(bm, seg, c):
    """보조 출입문 (벽 구멍 c ± POD_DOOR_HW): 돌 문턱, 유리 양여닫이 두 짝(가로살 위 채광창), 청동색 틀·가운데 선틀·
    발판·손잡이, 문 위 얇은 돌 차양. 재질 번호는 _pod_wall 과 같음."""
    hw, zt, gd = POD_DOOR_HW, POD_WIN_Z[1], POD_GLASS_D
    _pod_wbox(bm, seg, c - hw, c + hw, -0.12, gd, -0.2, 0.05, 2)
    for g0, g1 in ((c - hw, c), (c, c + hw)):
        _pod_wbox(bm, seg, g0, g1, gd, gd + 0.04, 0.05, zt, 3)
    for j0, j1 in ((c - hw, c - hw + 0.08), (c + hw - 0.08, c + hw)):
        _pod_wbox(bm, seg, j0, j1, gd - 0.08, gd, 0.05, zt, 4)
    _pod_wbox(bm, seg, c - hw, c + hw, gd - 0.075, gd, zt - 0.08, zt, 4)
    _pod_wbox(bm, seg, c - hw, c + hw, gd - 0.09, gd, POD_TRANSOM_Z - 0.05, POD_TRANSOM_Z + 0.05, 4)
    _pod_wbox(bm, seg, c - hw, c + hw, gd - 0.07, gd, 0.05, 0.25, 4)
    _pod_wbox(bm, seg, c - 0.05, c + 0.05, gd - 0.085, gd, 0.05, POD_TRANSOM_Z - 0.05, 4)
    for sg in (-1, 1):
        _pod_wbox(bm, seg, c + sg * 0.15 - 0.015, c + sg * 0.15 + 0.015, gd - 0.12, gd, 0.9, 2.0, 4)
    _pod_wbox(bm, seg, c - hw - 0.45, c + hw + 0.45, -1.2, 0.0, zt + 0.15, zt + 0.35, 2)


def _pod_window_band(bm, seg, s0, s1):
    """창 띠 한 구간 (s0..s1): 격자의 짝수 선마다 화강석 피어(열주 축은 넓게), 피어 사이마다 창 하나.
    격자가 없거나 창 자리가 모자라면 통벽."""
    t = POD_T
    z0, z1 = POD_WIN_Z
    grid = seg.get('grid')
    lo, hi = seg.get('win', (s0, s1))
    lo, hi = max(lo, s0) + POD_WIN_MARGIN, min(hi, s1) - POD_WIN_MARGIN
    piers = []
    if grid:
        o, m = grid
        k0, k1 = math.ceil((lo - o) / (2 * m)), math.floor((hi - o) / (2 * m))
        piers = [(o + 2 * k * m, POD_AXIS_PIER_W if k % 5 == 0 else POD_PIER_W) for k in range(k0, k1 + 1)]
    if len(piers) < 2:
        _pod_wbox(bm, seg, s0, s1, 0.0, t, z0, z1, 0)
        return
    _pod_wbox(bm, seg, s0, piers[0][0] - piers[0][1] / 2, 0.0, t, z0, z1, 0)
    _pod_wbox(bm, seg, piers[-1][0] + piers[-1][1] / 2, s1, 0.0, t, z0, z1, 0)
    for p, w in piers:
        _pod_wbox(bm, seg, p - w / 2, p + w / 2, 0.0, t, z0, z1, 0)
    for (p, wp), (q, wq) in zip(piers, piers[1:]):
        _pod_window(bm, seg, p + wp / 2, q - wq / 2, (p + q) / 2)


def _pod_window(bm, seg, w0, w1, mid):
    """창 하나: 돌 창턱, 유리 두 장(멀리언 양쪽 — 장마다 따로라 공유 유리의 장별 난수가 다름), 청동색 틀·멀리언·가로살.
    앞면 깊이를 조금씩 달리해(문설주 > 머리·밑틀, 멀리언 > 가로살) 겹치는 모서리에서 같은 평면이 생기지 않게."""
    z0, z1 = POD_WIN_Z
    gd, fw = POD_GLASS_D, POD_FRAME_W
    mw, md = POD_MULLION
    sh, so = POD_SILL
    zs = z0 + sh / 2
    _pod_wbox(bm, seg, w0, w1, -so, gd, z0 - sh / 2, zs, 2)
    for g0, g1 in ((w0, mid), (mid, w1)):
        _pod_wbox(bm, seg, g0, g1, gd, gd + 0.04, z0, z1, 3)
    _pod_wbox(bm, seg, w0, w0 + fw, gd - 0.07, gd, zs, z1, 4)
    _pod_wbox(bm, seg, w1 - fw, w1, gd - 0.07, gd, zs, z1, 4)
    _pod_wbox(bm, seg, w0, w1, gd - 0.065, gd, z1 - fw, z1, 4)
    _pod_wbox(bm, seg, w0, w1, gd - 0.065, gd, zs, zs + fw, 4)
    _pod_wbox(bm, seg, mid - mw / 2, mid + mw / 2, gd - md, gd, zs, z1, 4)
    _pod_wbox(bm, seg, w0, w1, gd - 0.08, gd, POD_TRANSOM_Z - 0.04, POD_TRANSOM_Z + 0.04, 4)


def _pod_annex_door(ctx, coll, bm):
    """서비스 블록 동쪽 면: 벽 개구부 안쪽의 골진 금속 셔터 (재질 5), 위에 얇은 돌 차양 (재질 2),
    양옆 벽등 (청동 판 + 젖빛 유리, 재질 4·6 — 밤에 작은 점광원)."""
    ax1 = POD_ANNEX[1]
    hw = POD_ANNEX_DOOR
    zt = POD_WIN_Z[1]
    _pod_box(bm, ax1 - 0.45, ax1 - 0.35, -hw, hw, -0.1, zt, 5)
    _pod_box(bm, ax1, ax1 + 1.4, -hw - 0.6, hw + 0.6, zt + 0.17, zt + 0.37, 2)
    for sg in (-1, 1):
        y = sg * (hw + 1.3)
        _pod_box(bm, ax1, ax1 + 0.04, y - 0.16, y + 0.16, 2.45, 3.15, 4)
        _pod_box(bm, ax1 + 0.04, ax1 + 0.2, y - 0.11, y + 0.11, 2.55, 3.05, 6)
        if ctx.night:
            _pod_light(coll, f'Podium_Annex_Light.{sg + 1}', (ax1 + 0.35, y, 2.8), 25.0)


def _pod_deck(ctx, coll):
    """기단면 슬래브 (part=podium_deck, 윗면 z = PODIUM_H 정확히): 벽 껍데기 안쪽 본판 + 두 계단 윗단 앞 띠 +
    서비스 블록 지붕. 서로 겹치지 않는 상자들이라 윗면이 같은 평면에서 겹치지 않습니다. 윗면 포장, 옆면 화강석."""
    hx, hy, t = PODIUM_X / 2, PODIUM_Y / 2, POD_T
    z0 = PODIUM_H - POD_DECK_T
    ax0, ax1, ay0, ay1 = POD_ANNEX
    sw = POD_SIDE_CHEEK_W
    bm = bmesh.new()
    _pod_box(bm, -hx + t, hx - t, -hy + t, hy - t, z0, PODIUM_H)
    _pod_box(bm, -POD_CHEEK[0], POD_CHEEK[0], -hy, -hy + t, z0, PODIUM_H)
    _pod_box(bm, -hx, -hx + t, POD_SIDE_Y[0] + sw, POD_SIDE_Y[1] - sw, z0, PODIUM_H)
    _pod_box(bm, hx - t, ax1 - t, ay0 + t, ay1 - t, z0, PODIUM_H)
    bm.normal_update()
    for f in bm.faces:
        f.material_index = 0 if f.normal.z > 0.5 else 1
    finish_mesh('Podium_Deck', bm, coll, [_pod_paving_mat(ctx), ctx.mats['granite']], part='podium_deck')


# --- 계단 (정면 대계단, 왼쪽 옆 계단) ------------------------------------------------

def _pod_cheek(bm, plan, frame, w_in, w_out, s_end):
    """계단 옆벽 하나: 코 선 + (POD_CHEEK_H - 갓돌) 로 기울고 참에서 수평인 벽, 갓돌, 아래 끝 기둥돌(+갓돌 캡),
    바깥면·앞면의 짙은 굽, 안쪽 면의 낮은 발밑등(난간 기둥 자리마다, 디딤판 위 POD_STEP_LIGHT[2]).
    s_end = 기단 벽 껍데기 안면까지. 재질 0 화강석, 1 짙은 화강석, 2 갓돌, 3 발밑등.
    반환: 등 자리 [(s, w, z)] — 기둥돌 위, 참 가운데, 맨 위 참 가운데 (모두 수평인 갓돌 위)."""
    run, t = plan['run'], plan['t']
    line = _pod_nose_line(plan, s_end)
    hw = POD_CHEEK_H - POD_COPING_H
    n0, n_len, n_up = POD_NEWEL
    n1 = n0 + n_len
    lo, hi = sorted((w_in, w_out))
    wc = (lo + hi) / 2
    co, bo = POD_COPING_OUT, POD_BASE_OUT
    sg = 1 if w_out > w_in else -1                     # 바깥 방향
    ni, no = w_in - 0.03 * sg, w_out + 0.03 * sg      # 기둥돌은 옆벽보다 양쪽 3 cm 두툼 (같은 평면 겹침 방지)
    wall = [(n0 + 0.1, -POD_SINK)] + [(s, z + hw) for (s, z) in _pod_clip(line, n0 + 0.1, s_end)]
    _pod_extrude(bm, wall + [(s_end, -POD_SINK)], lo, hi, frame, 0)
    cope = _pod_clip(line, n1, run - co)
    prof = [(s, z + hw) for (s, z) in cope] + [(s, z + POD_CHEEK_H) for (s, z) in reversed(cope)]
    _pod_extrude(bm, prof, lo - co, hi + co, frame, 2)
    zn = _pod_at(line, n1) + POD_CHEEK_H + n_up
    _pod_fbox(bm, frame, n0, n1, ni, no, -POD_SINK, zn - POD_COPING_H, 0)
    _pod_fbox(bm, frame, n0 - co, n1 + co, ni - co * sg, no + co * sg, zn - POD_COPING_H, zn, 2)
    # 굽: 기둥돌 앞·바깥을 감싸고 (안쪽 면은 기둥돌 속 1 cm), 옆벽 바깥면을 따라 기단 굽까지
    _pod_fbox(bm, frame, n0 - bo, n1 - 0.01, ni + 0.01 * sg, no + bo * sg, -POD_SINK, POD_BASE_TOP, 1)
    _pod_fbox(bm, frame, n1 - 0.01, run - bo, w_out, w_out + bo * sg, -POD_SINK, POD_BASE_TOP, 1)
    for s in _pod_posts(plan, t / 2, run - t / 2):
        if s < n1 + 0.2:
            continue
        zc = _pod_surface_z(plan, s) + POD_STEP_LIGHT[2]
        _pod_fbox(bm, frame, s - POD_STEP_LIGHT[0] / 2, s + POD_STEP_LIGHT[0] / 2, w_in - 0.02 * sg, w_in + 0.01 * sg,
                  zc - POD_STEP_LIGHT[1] / 2, zc + POD_STEP_LIGHT[1] / 2, 3)
    spots = [((n0 + n1) / 2, wc, zn)]
    fl = plan['flights']
    for (_, s1, _, z1), (s0n, _, _, _) in zip(fl, fl[1:]):
        spots.append(((s1 + s0n - t) / 2, wc, z1 + POD_CHEEK_H))
    spots.append((run - plan['top'] / 2, wc, PODIUM_H + POD_CHEEK_H))
    return spots


def _pod_posts(plan, s0, s1):
    """난간 기둥(발밑등) 자리: 양 끝 s0·s1 과, 그 사이 디딤판·참 가운데 후보 중 POD_POST_STEP 간격."""
    steps = plan['steps']
    ends = [s for (s, _) in steps[1:]] + [plan['run']]
    mids = []
    for (sa, _), sb in zip(steps, ends):
        n = max(1, round((sb - sa) / POD_POST_STEP))
        mids += [sa + (sb - sa) * (i + 0.5) / n for i in range(n)]
    out = [s0]
    for s in mids:
        if s - out[-1] >= POD_POST_STEP * 0.9 and s1 - s >= POD_POST_STEP * 0.5:
            out.append(s)
    return out + [s1]


def _pod_rails(bm, plan, frame, ws):
    """디딤판 위 스테인리스 난간 (코 선 + POD_RAIL_H 의 둥근 손잡이 + 기둥). ws = 난간의 w 위치들."""
    t = plan['t']
    line = _pod_nose_line(plan)
    s0, s1 = t / 2, min(plan['run'] - plan['top'] + 0.3, plan['run'] - t / 2)   # 끝은 마지막 챌면 0.3 m 뒤
    rail = [(s, z + POD_RAIL_H) for (s, z) in _pod_clip(line, s0, s1)]
    posts = _pod_posts(plan, s0, s1)
    for w in ws:
        for (sa, za), (sb, zb) in zip(rail, rail[1:]):
            _pod_tube(bm, frame(sa, w, za), frame(sb, w, zb), POD_RAIL_R, 8, extend=POD_RAIL_R)
        for s in posts:
            _pod_tube(bm, frame(s, w, _pod_surface_z(plan, s) - 0.03), frame(s, w, _pod_at(line, s) + POD_RAIL_H),
                      POD_POST_R, 6)


def _pod_front_stair(ctx, coll, cheeks, rails):
    """정면 대계단: 47 m 디딤판(코 그림자 선), 옆벽 두 개, 난간 넷. 반환: 등 자리 (월드)."""
    plan = _pod_stair_plan(POD_FLIGHTS, POD_LANDING_T, POD_TOP_T, STAIR_DEPTH)
    y0 = STAIR_FOOT_Y
    frame = lambda s, w, z: (w, y0 + s, z)
    ci, cx = POD_CHEEK
    bm = bmesh.new()
    _pod_extrude(bm, _pod_step_profile(plan), -ci - 0.05, ci + 0.05, frame)
    finish_mesh('Grand_Stair', bm, coll, _pod_stair_mat(ctx, 'front', 'y', y0, plan['t'], -ci, ci), part='podium')
    spots = []
    for sg in (-1, 1):
        spots += [frame(*p) for p in _pod_cheek(cheeks, plan, frame, sg * ci, sg * cx, plan['run'] + POD_T)]
    _pod_rails(rails, plan, frame, [sg * x for x in POD_RAILS for sg in (-1, 1)])
    ctx.stats['stair_risers'] = len(plan['steps'])
    ctx.stats['stair_tread'] = round(plan['t'], 3)
    return spots


def _pod_side_stair(ctx, coll, cheeks, rails):
    """왼쪽 돌출부 옆 계단 (-X 로 내려감): 디딤판, 옆벽 두 개, 난간 둘. 반환: 등 자리 (월드)."""
    x0, x1 = POD_SIDE_X
    y0, y1 = POD_SIDE_Y
    cw = POD_SIDE_CHEEK_W
    plan = _pod_stair_plan(POD_SIDE_FLIGHTS, POD_SIDE_LANDING_T, POD_SIDE_TOP_T, x1 - x0)
    frame = lambda s, w, z: (x0 + s, w, z)
    bm = bmesh.new()
    _pod_extrude(bm, _pod_step_profile(plan), y0 + cw - 0.05, y1 - cw + 0.05, frame)
    finish_mesh('Side_Stair', bm, coll, _pod_stair_mat(ctx, 'side', 'x', x0, plan['t'], y0 + cw, y1 - cw),
                part='podium')
    spots = []
    for w_in, w_out in ((y0 + cw, y0), (y1 - cw, y1)):
        spots += [frame(*p) for p in _pod_cheek(cheeks, plan, frame, w_in, w_out, plan['run'] + POD_T)]
    wc = (y0 + y1) / 2
    _pod_rails(rails, plan, frame, (wc - POD_SIDE_RAIL, wc + POD_SIDE_RAIL))
    return spots


# --- 등·뒤 출입구·캐노피 ---------------------------------------------------------

def _pod_light(coll, name, loc, watts, kind='POINT', size=0.12, color=(1.0, 0.72, 0.45)):
    """밤 전용 등기구 광원 (내 부위의 등에서 나오는 빛만). 사각 면광원은 size = (x, y), 아래를 비춤."""
    ld = bpy.data.lights.new(name, kind)
    ld.energy = watts
    ld.color = color
    if kind == 'AREA':
        ld.shape = 'RECTANGLE'
        ld.size, ld.size_y = size
    else:
        ld.shadow_soft_size = size
    obj = bpy.data.objects.new(name, ld)
    obj.location = loc
    coll.objects.link(obj)
    obj['na_part'] = 'podium'
    return obj


def _pod_lamps(ctx, coll, spots):
    """옆벽 갓돌·기둥돌 위 작은 등주: 청동 받침·기둥·모자, 네 모서리 청동 틀의 젖빛 유리 등갓 (높이 1.64 m).
    메시 하나를 링크 복제로 세우고, 밤에는 등갓이 빛나며 등마다 따뜻한 점광원."""
    bm = bmesh.new()
    _pod_box(bm, -0.16, 0.16, -0.16, 0.16, 0.0, 0.08, 0)
    _pod_tube(bm, (0, 0, 0.06), (0, 0, 1.04), 0.05, 8)
    _pod_box(bm, -0.2, 0.2, -0.2, 0.2, 1.02, 1.08, 0)
    _pod_box(bm, -0.16, 0.16, -0.16, 0.16, 1.08, 1.50, 1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            _pod_box(bm, sx * 0.14, sx * 0.175, sy * 0.14, sy * 0.175, 1.08, 1.50, 0)
    _pod_box(bm, -0.23, 0.23, -0.23, 0.23, 1.50, 1.56, 0)
    _pod_box(bm, -0.13, 0.13, -0.13, 0.13, 1.56, 1.64, 0)
    proto = finish_mesh('Podium_Lamp', bm, coll, [ctx.mats['bronze'], _pod_lantern_mat(ctx)], part='podium')
    proto.location = spots[0]
    for i, p in enumerate(spots[1:], 1):
        instance(f'Podium_Lamp.{i:03d}', proto, coll, p)
    if ctx.night:
        for i, p in enumerate(spots):
            _pod_light(coll, f'Podium_Lamp_Light.{i:03d}', (p[0], p[1], p[2] + 1.29), POD_LAMP_NIGHT[1])
    ctx.stats['podium_lamps'] = len(spots)


def _pod_rear_entrance(ctx, coll):
    """뒤(+Y) 가운데 참관 출입구 (지상 1층): 벽을 파고 든 현관 — 화강석 옆벽·천장, 짙은 화강석 바닥,
    청동 틀 유리문 벽(가운데 네 짝은 문, 밤에 로비 불빛), 천장 다운라이트."""
    hy, t = PODIUM_Y / 2, POD_T
    hw, yb, zt = POD_ENTRY_HW, PODIUM_Y / 2 - POD_ENTRY_D, POD_WIN_Z[1]
    bm = bmesh.new()
    for sg in (-1, 1):
        _pod_box(bm, sg * hw, sg * (hw + t), yb - 0.3, hy - t, -POD_SINK, zt, 0)
    _pod_box(bm, -hw - t, hw + t, yb - 0.3, hy - t, zt, PODIUM_H - POD_DECK_T, 0)
    _pod_box(bm, -hw, hw, yb, hy, -0.25, 0.04, 1)
    _pod_box(bm, -hw, hw, yb - 0.05, yb, 0.04, zt, 3)
    n = round(2 * hw / 1.5)
    for k in range(n + 1):
        x = -hw + 2 * hw * k / n
        w = 0.15 if abs(x) < 3.01 else 0.09
        _pod_box(bm, x - w / 2, x + w / 2, yb, yb + 0.09, 0.04, zt, 2)
    for z0, z1, d in ((0.04, 0.18, 0.08), (POD_TRANSOM_Z - 0.06, POD_TRANSOM_Z + 0.06, 0.07), (zt - 0.12, zt, 0.08)):
        _pod_box(bm, -hw, hw, yb, yb + d, z0, z1, 2)
    for x in (-1.5, 0.0, 1.5):
        for sg in (-1, 1):
            _pod_box(bm, x + sg * 0.11 - 0.015, x + sg * 0.11 + 0.015, yb + 0.09, yb + 0.15, 0.9, 2.1, 2)
    for x in (-6.0, -2.0, 2.0, 6.0):
        _pod_tube(bm, (x, (yb + hy) / 2, zt - 0.03), (x, (yb + hy) / 2, zt + 0.02), 0.16, 12, mi=4)
    mats = ctx.mats
    finish_mesh('Podium_Rear_Entrance', bm, coll, [mats['granite'], mats['granite_dark'], mats['bronze'],
                                                   _pod_lobby_mat(ctx), _pod_downlight_mat(ctx)], part='podium')
    if ctx.night:
        _pod_light(coll, 'Podium_Entrance_Light', (0.0, (yb + hy) / 2, zt - 0.05), 80.0, 'AREA', (2 * hw - 1, 1.6))


def _pod_canopy(ctx, coll):
    """뒤 출입구 위 유리·강철 캐노피: 벽 받침판, 끝으로 가늘어지는 외팔 보 5개, 앞 테두리 보, 유리판,
    보 끝에서 벽 위쪽으로 당기는 인장봉과 벽 고정쇠."""
    hy = PODIUM_Y / 2
    cw, cd, cz = POD_CANOPY
    frame = lambda s, w, z: (w, hy + s, z)
    bm = bmesh.new()
    _pod_box(bm, -cw - 0.15, cw + 0.15, hy, hy + 0.12, cz - 0.05, cz + 0.45, 0)
    for i in range(5):
        x = -cw + 2 * cw * i / 4
        prof = [(0.1, cz), (cd - 0.1, cz + 0.2), (cd - 0.1, cz + 0.36), (0.1, cz + 0.36)]
        _pod_extrude(bm, prof, x - 0.07, x + 0.07, frame, 0)
        _pod_tube(bm, (x, hy + cd - 0.35, cz + 0.36), (x, hy + 0.1, cz + 1.9), 0.022, 8)
        _pod_box(bm, x - 0.1, x + 0.1, hy, hy + 0.14, cz + 1.8, cz + 2.0, 0)
    _pod_box(bm, -cw - 0.07, cw + 0.07, hy + cd - 0.12, hy + cd + 0.02, cz + 0.16, cz + 0.40, 0)
    _pod_box(bm, -cw - 0.02, cw + 0.02, hy + 0.12, hy + cd - 0.12, cz + 0.36, cz + 0.38, 1)
    steel = ctx.mats.get('steel', ctx.mats['metal'])
    finish_mesh('Podium_Canopy', bm, coll, [steel, _pod_canopy_glass_mat(ctx)], part='podium')
    if ctx.night:
        _pod_light(coll, 'Podium_Canopy_Light', (0.0, hy + cd / 2, cz - 0.05), 220.0, 'AREA', (2 * cw, cd * 0.7))


# --- 재질 (기단 전용) -------------------------------------------------------------

def _pod_math(nt, op, a, b=None, c=None, clamp=False):
    """Math 노드 (입력은 소켓 또는 숫자). 결과 소켓."""
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = op
    m.use_clamp = clamp
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if hasattr(v, 'is_output'):
            nt.links.new(v, m.inputs[i])
        else:
            m.inputs[i].default_value = v
    return m.outputs[0]


def _pod_ramp(nt, v, a0, a1, b0, b1):
    """v 를 [a0, a1] → [b0, b1] 로 (잘라냄). 결과 소켓."""
    mr = node(nt, 'ShaderNodeMapRange', From_Min=a0, From_Max=a1, To_Min=b0, To_Max=b1)
    mr.clamp = True
    link(nt, v, mr.inputs['Value'])
    return mr.outputs['Result']


def _pod_joint(nt, coord, origin, module, shift=0.0):
    """좌표 소켓 → (가장 가까운 줄눈선까지 거리 m, 판 번호). 줄눈선 = origin + k * module (+ shift * module)."""
    u = _pod_math(nt, 'SUBTRACT', _pod_math(nt, 'DIVIDE', _pod_math(nt, 'SUBTRACT', coord, origin), module), shift)
    f = _pod_math(nt, 'ABSOLUTE', _pod_math(nt, 'SUBTRACT', _pod_math(nt, 'FRACT', u), 0.5))
    return _pod_math(nt, 'MULTIPLY', _pod_math(nt, 'SUBTRACT', 0.5, f), module), _pod_math(nt, 'FLOOR', u)


def _pod_slab_shader(nt, bsdf, base, co, dist, cell_u, cell_v, jw, tone=0.05, rough=0.6, extra=None):
    """판석 셰이더 공통부. dist = 줄눈까지 거리(m), cell_u/v = 판 번호 (판마다 톤·거칠기 차이), extra = 밝기 인수 소켓.
    큰 얼룩 + 결정 알갱이(검은 점) + 잔 무늬, 오목한 줄눈(색·범프). 카메라에서 멀면 알갱이·줄눈이 평균으로."""
    near = _pod_ramp(nt, node(nt, 'ShaderNodeCameraData').outputs['View Distance'], 35.0, 150.0, 1.0, 0.0)
    joint = _pod_math(nt, 'MULTIPLY', _pod_ramp(nt, dist, jw * 0.3, jw * 0.7, 1.0, 0.0), near)
    cells = node(nt, 'ShaderNodeCombineXYZ')
    link(nt, cell_u, cells.inputs['X'])
    link(nt, cell_v, cells.inputs['Y'])
    wn = node(nt, 'ShaderNodeTexWhiteNoise', noise_dimensions='3D')
    link(nt, cells.outputs['Vector'], wn.inputs['Vector'])
    f = _pod_math(nt, 'MULTIPLY_ADD', wn.outputs['Value'], 2 * tone, 1.0 - tone)
    big = node(nt, 'ShaderNodeTexNoise', Scale=0.12, Detail=3.0, Roughness=0.5)
    link(nt, co, big.inputs['Vector'])
    f = _pod_math(nt, 'MULTIPLY', f, _pod_ramp(nt, big.outputs['Factor'], 0.3, 0.7, 0.95, 1.05))
    vo = node(nt, 'ShaderNodeTexVoronoi', Scale=45.0, Randomness=1.0)
    link(nt, co, vo.inputs['Vector'])
    speck = _pod_math(nt, 'LESS_THAN', vo.outputs['Distance'], 0.22)
    f = _pod_math(nt, 'MULTIPLY', f, _pod_math(nt, 'SUBTRACT', 1.0, _pod_math(nt, 'MULTIPLY', speck, _pod_math(
        nt, 'MULTIPLY', near, 0.28))))
    fine = node(nt, 'ShaderNodeTexNoise', Scale=9.0, Detail=2.0)
    link(nt, co, fine.inputs['Vector'])
    f = _pod_math(nt, 'MULTIPLY', f, _pod_ramp(nt, fine.outputs['Factor'], 0.3, 0.7, 0.96, 1.04))
    if extra is not None:
        f = _pod_math(nt, 'MULTIPLY', f, extra)
    col = mix_color(nt, 1.0, base, f, 'MULTIPLY')
    col = mix_color(nt, _pod_math(nt, 'MULTIPLY', joint, 0.8), col, tuple(c * 0.42 for c in base))
    link(nt, col, bsdf.inputs['Base Color'])
    r = _pod_math(nt, 'MULTIPLY_ADD', wn.outputs['Value'], 0.12, rough - 0.06)
    link(nt, _pod_math(nt, 'MULTIPLY_ADD', joint, 0.2, r), bsdf.inputs['Roughness'])
    bump = node(nt, 'ShaderNodeBump', Strength=0.6, Distance=0.006)
    link(nt, _pod_math(nt, 'MULTIPLY', joint, -1.0), bump.inputs['Height'])
    link(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])


def _pod_coords(nt):
    """Object 좌표 (= 월드 m) 소켓과 분리한 x, y, z 소켓."""
    co = node(nt, 'ShaderNodeTexCoord').outputs['Object']
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    link(nt, co, sep.inputs['Vector'])
    return co, sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']


def _pod_granite_color(ctx, k=1.0):
    """공유 granite 의 대표색 (웹 GLB 색과 같은 기준) 에 밝기 인수 k."""
    flat = ctx.mats['granite'].get('na_flat')
    c = tuple(flat['color']) if flat is not None else (0.68, 0.66, 0.61)
    return tuple(min(1.0, v * k) for v in c)


def _pod_paving_mat(ctx):
    """기단면 포장: 옅은 화강석 정사각 판석 (열주 한 칸 = POD_PAVE_MODULES 장, 약 1.21 m) — 줄눈이 열주 축을 지남.
    파라펫을 따라 한 줄은 조금 짙은 테두리."""
    def make():
        base = _pod_granite_color(ctx, 0.93)
        mat, nt, bsdf = new_pbr('Podium_Paving', base, 0.62)
        co, x, y, _ = _pod_coords(nt)
        mx = L / (COLS_FRONT - 1) / POD_PAVE_MODULES
        my = W / (COLS_SIDE_BETWEEN + 1) / POD_PAVE_MODULES
        dx, cu = _pod_joint(nt, x, -L / 2, mx)
        dy, cv = _pod_joint(nt, y, -W / 2, my)
        xb = L / 2 + (round((PODIUM_X / 2 - POD_T - L / 2) / mx) - 1) * mx
        yb = W / 2 + (round((PODIUM_Y / 2 - POD_T - W / 2) / my) - 1) * my
        edge = _pod_math(nt, 'MAXIMUM', _pod_math(nt, 'GREATER_THAN', _pod_math(nt, 'ABSOLUTE', x), xb),
                         _pod_math(nt, 'GREATER_THAN', _pod_math(nt, 'ABSOLUTE', y), yb))
        _pod_slab_shader(nt, bsdf, base, co, _pod_math(nt, 'MINIMUM', dx, dy), cu, cv, 0.010,
                         extra=_pod_math(nt, 'MULTIPLY_ADD', edge, -0.12, 1.0))
        return mat
    return ctx.material('pod_paving', make)


def _pod_stair_mat(ctx, key, s_axis, s0, t, w0, w1):
    """계단 화강석: 디딤판 한 단 = 판석 한 줄 (길이 약 1.2 m, 단마다 반 장 엇갈림), 챌면은 그 단과 같은 세로 줄눈,
    참은 디딤판 깊이의 줄로 나눈 포장. s_axis = 오르는 방향 좌표축 ('x'/'y'), s0 = 맨 아랫단 챌면, t = 디딤판,
    w0..w1 = 디딤판 너비. 가로 줄눈(줄 사이)은 윗면에만 그립니다 (챌면은 한 장)."""
    def make():
        base = _pod_granite_color(ctx, 0.97)
        mat, nt, bsdf = new_pbr(f'Podium_Stair_{key.title()}', base, 0.64)
        co, x, y, _ = _pod_coords(nt)
        s, w = (y, x) if s_axis == 'y' else (x, y)
        ds, row = _pod_joint(nt, s, s0 - 0.035, t)
        nz = node(nt, 'ShaderNodeSeparateXYZ')
        link(nt, node(nt, 'ShaderNodeNewGeometry').outputs['Normal'], nz.inputs['Vector'])
        vert = _pod_math(nt, 'LESS_THAN', nz.outputs['Z'], 0.5)
        ds = _pod_math(nt, 'MULTIPLY_ADD', vert, 10.0, ds)
        mw = (w1 - w0) / max(1, round((w1 - w0) / 1.2))
        dw, cw = _pod_joint(nt, w, w0, mw, _pod_math(nt, 'MULTIPLY', _pod_math(nt, 'MODULO', row, 2.0), 0.5))
        _pod_slab_shader(nt, bsdf, base, co, _pod_math(nt, 'MINIMUM', dw, ds), cw, row, 0.008, tone=0.05, rough=0.66)
        return mat
    return ctx.material('pod_stair_' + key, make)


def _pod_lantern_mat(ctx):
    """등갓 젖빛 유리: 낮에는 옅은 우윳빛, 밤에는 따뜻한 등불 (웹 GLB 에서는 등기구로 취급될 만큼 밝게)."""
    def make():
        emit = (1.0, 0.74, 0.46) if ctx.night else None
        return new_pbr('Podium_Lantern', (0.86, 0.84, 0.78), 0.35, 0.0, emission=emit,
                       emission_strength=POD_LAMP_NIGHT[0] if ctx.night else 0.0)[0]
    return ctx.material('pod_lantern', make)


def _pod_lobby_mat(ctx):
    """뒤 출입구 유리문 벽: 낮에는 짙은 반사 유리(코트층), 밤에는 로비 불빛 — 천장 조명이라 위쪽이 조금 밝고,
    가로로 옅게 얼룩진 따뜻한 빛."""
    def make():
        emit = (1.0, 0.62, 0.32) if ctx.night else None
        mat, nt, bsdf = new_pbr('Podium_Lobby_Glass', (0.035, 0.04, 0.045), 0.04, 0.0, emission=emit,
                                emission_strength=0.8 if ctx.night else 0.0, IOR=1.5, Coat_Weight=1.0,
                                Coat_Roughness=0.02)
        if ctx.night:
            co, x, _, z = _pod_coords(nt)
            n = node(nt, 'ShaderNodeTexNoise', Scale=0.35, Detail=2.0)
            link(nt, co, n.inputs['Vector'])
            k = _pod_math(nt, 'MULTIPLY', _pod_ramp(nt, z, 0.0, POD_WIN_Z[1], 0.75, 1.35),
                          _pod_ramp(nt, n.outputs['Factor'], 0.3, 0.7, 0.8, 1.2))
            link(nt, _pod_math(nt, 'MULTIPLY', k, 0.8), bsdf.inputs['Emission Strength'])
        return mat
    return ctx.material('pod_lobby', make)


def _pod_steplight_mat(ctx):
    """계단 옆벽 발밑등: 낮에는 짙은 청동 틀의 유백 판, 밤에는 디딤판을 스치는 따뜻한 빛."""
    def make():
        emit = (1.0, 0.8, 0.55) if ctx.night else None
        return new_pbr('Podium_Step_Light', (0.55, 0.53, 0.48), 0.3, 0.0, emission=emit,
                       emission_strength=18.0 if ctx.night else 0.0)[0]
    return ctx.material('pod_steplight', make)


def _pod_downlight_mat(ctx):
    """현관 천장 다운라이트 (밤에 밝게)."""
    def make():
        emit = (1.0, 0.86, 0.68) if ctx.night else None
        return new_pbr('Podium_Downlight', (0.92, 0.9, 0.86), 0.3, 0.0, emission=emit,
                       emission_strength=30.0 if ctx.night else 0.0)[0]
    return ctx.material('pod_downlight', make)


def _pod_canopy_glass_mat(ctx):
    """캐노피 접합유리: 투과 (렌더), 웹 GLB 에서는 옅은 청회색 불투명."""
    def make():
        mat = new_pbr('Podium_Canopy_Glass', (0.62, 0.70, 0.70), 0.03, 0.0, Transmission_Weight=1.0, IOR=1.5)[0]
        set_flat(mat, color=[0.36, 0.42, 0.43], roughness=0.1)
        return mat
    return ctx.material('pod_canopy_glass', make)


def _pod_shutter_mat(ctx):
    """서비스 셔터: 가로 골(11 cm 간격, 범프)이 있는 회색 도장 강판."""
    def make():
        mat, nt, bsdf = new_pbr('Podium_Shutter', (0.40, 0.41, 0.42), 0.42, 0.6)
        _, _, _, z = _pod_coords(nt)
        wave = _pod_math(nt, 'SINE', _pod_math(nt, 'MULTIPLY', z, 2 * math.pi / 0.11))
        bump = node(nt, 'ShaderNodeBump', Strength=0.6, Distance=0.004)
        link(nt, wave, bump.inputs['Height'])
        link(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])
        return mat
    return ctx.material('pod_shutter', make)


# --- 조립 -------------------------------------------------------------------------

def build_podium(ctx):
    """기단 전체: 바깥벽·창 띠·파라펫(한 메시, 재질 번호로 구분) → 기단면 슬래브(podium_deck) → 정면 대계단·옆 계단
    (옆벽·스테인리스 난간은 두 계단을 합쳐 한 메시씩) → 뒤 출입구·캐노피 → 옆벽 위 등."""
    coll = ctx.coll('Podium')
    mats = ctx.mats
    walls = bmesh.new()
    for seg in _pod_segments():
        _pod_wall(walls, seg)
    _pod_annex_door(ctx, coll, walls)
    finish_mesh('Podium_Walls', walls, coll, [mats['granite'], mats['granite_dark'], mats['granite_light'],
                                              mats['glass'], mats['metal'], _pod_shutter_mat(ctx),
                                              _pod_lantern_mat(ctx)], part='podium')
    _pod_deck(ctx, coll)
    cheeks, rails = bmesh.new(), bmesh.new()
    spots = _pod_front_stair(ctx, coll, cheeks, rails) + _pod_side_stair(ctx, coll, cheeks, rails)
    finish_mesh('Podium_Stair_Walls', cheeks, coll, [mats['granite'], mats['granite_dark'], mats['granite_light'],
                                                     _pod_steplight_mat(ctx)], part='podium')
    finish_mesh('Podium_Handrails', rails, coll, mats.get('steel', mats['metal']), smooth=True, part='podium')
    _pod_rear_entrance(ctx, coll)
    _pod_canopy(ctx, coll)
    _pod_lamps(ctx, coll, spots)


# ----------------------------------------------------------------------------
# 본체 — 열주 뒤 외벽 (BODY_X x BODY_Y = 122 x 81, 기단면 → 처마 밑면)
#   · 촘촘한 세로 리듬: 열주 한 칸(20.57 / 20.6 m)을 10 모듈(약 2.06 m)로 나눈 화강석 핀,
#     열주 축마다 조금 넓은 피어, 네 모서리는 통돌 기둥. 격자는 열주 축에 맞춰 가운데 대칭.
#   · 층선마다 얇은 화강석 띠(창턱 코 포함), 처마 밑 통돌 띠 + 그림자 홈, 짙은 화강석 굽.
#     유리는 핀·띠 뒤로 0.3~0.5 m 물러나 그림자가 깊게 지고, 창틀은 짙은 청동색.
#   · 정면 가운데 칸(열주 축 x ±10.29): 2개 층 높이의 화강석 출입구(청동 문 3쌍 + 유리 트랜섬).
#   · 정면 위층 가운데: 격자형 LED 패널(2007~, 18.4 x 12.4 m). 낮에는 짙은 청동 격자,
#     밤에는 태극기(국기법 비율)를 셰이더로 그리고 GLB 에는 색 구간별 발광 재질로 넣습니다.
#   · 뒤쪽·양 끝면 가운데: 기단면 높이의 소박한 보조 출입문 (양 끝의 기단 돌출부 = 옆 계단·경사로가 닿는 곳).
# 면 좌표: s = 면을 따라 (앞·뒤 = x, 좌·우 = y), n = 유리면(본체 외벽)에서 바깥쪽 거리, z = 높이.
# 창·핀 배치(모듈, 모서리 기둥)는 자료가 없어 사진 기억 수준의 단순화입니다.
# ----------------------------------------------------------------------------
BODY_MODULES_PER_BAY = 10                  # 열주 한 칸당 모듈 수 (앞뒤 2.057 m, 옆 2.06 m)
BODY_FIN_W, BODY_FIN_D = 0.50, 0.50        # 일반 핀 폭·돌출
BODY_PIER_W, BODY_PIER_D = 1.20, 0.58      # 열주 축 피어 (벽에 걸리는 열주 축마다)
BODY_CORNER_REACH = 1.5                    # 모서리에서 이보다 가까운 격자선은 모서리 기둥이 흡수
BODY_MID_AXIS = L / (COLS_FRONT - 1) / 2   # 정면 가운데 칸 열주 축 x (±10.29)
BODY_BAND_D = 0.32                         # 층 띠 돌출 (핀보다 얕게 → 세로 강조)
BODY_BAND_DN, BODY_BAND_UP = 0.30, 0.75    # 층선 아래·위 띠 높이 (합 1.05 m, 위쪽이 창턱)
BODY_NOSE_D, BODY_NOSE_H = 0.37, 0.08      # 띠 윗단 창턱 코 (가는 그림자 선)
BODY_BASE_H, BODY_BASE_D = 0.55, 0.60      # 밑단 굽 (짙은 화강석)
BODY_TOP_H, BODY_TOP_D = 1.45, 0.60        # 처마 밑 통돌 띠
BODY_REVEAL_H, BODY_REVEAL_D = 0.14, 0.30  # 통돌 띠와 처마 밑면 사이 그림자 홈
BODY_SINK = 0.03                           # 기단면·처마 속으로 묻는 깊이 (보이는 틈 방지)
BODY_FRAME_W = 0.07                        # 창틀 폭
BODY_TOPLIGHT = 0.95                       # 창 윗부분 고정창 높이 (가로살 위치)
BODY_PANE_TILT = 0.005                     # 창유리마다 무작위 기울기 한계 (rad, 약 ±0.3°) → 반사가 장마다 달라짐

BODY_PORTAL_JAMB = 1.70                    # 출입구 바깥 문설주 폭 (틀 바깥면 = 가운데 열주 축 피어 바깥면)
BODY_PORTAL_STEP = 0.45                    # 한 단 들어간 안쪽 문설주 폭
BODY_PORTAL_D = 2.20                       # 틀 돌출 (머리 캡은 +0.25 → 2.45 m)
BODY_PORTAL_CAP = 0.50                     # 머리 캡 두께
BODY_PORTAL_LINTEL = 2.10                  # 바깥 개구부 위 화강석 머리 높이
BODY_PORTAL_POST_W = 0.60                  # 문 칸 사이 돌기둥 폭
BODY_DOOR_H = 6.0                          # 청동 문 높이
BODY_DOOR_SILL = 0.15                      # 문턱 높이
BODY_DOOR_N = (0.75, 0.95)                 # 문짝 면 깊이 (n)
BODY_SIDE_DOOR_MODULES = 2                 # 보조 출입문: 가운데 핀에서 좌우 2 모듈씩 (문 4칸)
BODY_SIDE_DOOR_H = 3.4

BODY_LED_FLAG_H = 12.0                     # 태극기 세로 (가로 18 m, 3:2) — 패널 안쪽을 꽉 채움
BODY_LED_ZC = 27.5                         # 패널 중심 높이 (출입구 캡 위 ~ 처마 밑 띠 아래의 가운데)
BODY_LED_EDGE = 0.2                        # 패널 테두리 부재 (패널 바깥 18.4 x 12.4 m)
BODY_LED_PITCH, BODY_LED_BAR = 0.25, 0.10  # LED 가로 막대 간격·높이 (면의 40 %)
BODY_LED_N = (0.84, 0.90)                  # 막대 깊이 (핀 앞 0.34~0.4 m, 얇아서 비스듬히 봐도 비침)
BODY_LED_NIGHT = 2.0                       # 밤 발광 세기 (Cycles; 너무 세면 AgX 가 빨강을 분홍으로 바램)
# 태극기 (국기법 시행령): 가로:세로 = 3:2, 태극 지름 = 세로/2, 괘 길이 = 지름/2, 괘 전체 폭 = 지름/3,
# 효 폭 = 지름/12, 효 사이·끊긴 틈 = 지름/24, 태극과 괘 사이 = 지름/4. 아래 식은 세로 48 단위 좌표.
BODY_FLAG_WHITE = (0.95, 0.95, 0.93)
BODY_FLAG_RED = (0.610, 0.027, 0.042)      # #CD2E3A (선형)
BODY_FLAG_BLUE = (0.0, 0.063, 0.351)       # #0047A0 (선형)
# 괘: (중심 방향 (u, v), 안→밖 효가 끊겼는지). 앞에서 보아 건☰ 왼위, 곤☷ 오른아래, 감☵ 오른위, 리☲ 왼아래
BODY_TRIGRAMS = (((-3, 2), (0, 0, 0)), ((3, -2), (1, 1, 1)), ((3, 2), (1, 0, 1)), ((-3, -2), (0, 1, 0)))


# --- 면 좌표 -------------------------------------------------------------------

def _body_face_info(face):
    """면 → (면 방향 반길이, 중심→유리면 거리, 모듈 길이, 열주 격자 시작 s, 격자 칸 수)."""
    if face[0] == 'x':
        n = (COLS_FRONT - 1) * BODY_MODULES_PER_BAY
        return BODY_X / 2, BODY_Y / 2, L / n, -L / 2, n
    n = (COLS_SIDE_BETWEEN + 1) * BODY_MODULES_PER_BAY
    return BODY_Y / 2, BODY_X / 2, W / n, -W / 2, n


BODY_FACES = (('x', -1), ('x', 1), ('y', -1), ('y', 1))    # 정면(-Y), 뒤(+Y), 왼쪽(-X), 오른쪽(+X)
BODY_FRONT, BODY_BACK = BODY_FACES[0], BODY_FACES[1]
BODY_DOOR_FACES = BODY_FACES[1:]                            # 보조 출입문이 있는 면 (뒤·왼·오른)


def _body_cube(bm, x0, x1, y0, y1, z0, z1):
    """축 정렬 박스 (꼭짓점 8, 면 6). bm_box(create_cube)는 메시가 커질수록 느려져서 직접 만듭니다."""
    x0, x1 = min(x0, x1), max(x0, x1)
    y0, y1 = min(y0, y1), max(y0, y1)
    v = [bm.verts.new(p) for p in ((x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                   (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for q in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in q])
    return v


def _body_box(bm, face, s0, s1, n0, n1, z0, z1):
    """면 좌표 (s0..s1, n0..n1, z0..z1) 박스를 월드 좌표로 bm 에 추가."""
    axis, sign = face
    wall = _body_face_info(face)[1]
    a0, a1 = sign * (wall + n0), sign * (wall + n1)
    if axis == 'x':
        return _body_cube(bm, s0, s1, a0, a1, z0, z1)
    return _body_cube(bm, a0, a1, s0, s1, z0, z1)


def _body_grid(face):
    """면의 세로 부재와 창 칸. 반환: (핀 [(s, 폭, 돌출)], 창 칸 [(s0, s1)], 모서리 기둥 안쪽 끝 s).
    격자선 = 열주 축(-L/2 또는 -W/2)부터 모듈 간격. 열주 축 위의 격자선은 넓은 피어,
    모서리에서 BODY_CORNER_REACH 안의 격자선은 모서리 기둥에 흡수 (그 선 + 피어 반폭까지가 모서리 기둥)."""
    half, _, mod, s_org, n = _body_face_info(face)
    k0 = next(k for k in range(n) if s_org + k * mod > -half + BODY_CORNER_REACH)
    s_corner = s_org + (k0 - 1) * mod + BODY_PIER_W / 2
    fins = []
    for k in range(k0, n - k0 + 1):
        pier = k % BODY_MODULES_PER_BAY == 0
        fins.append((s_org + k * mod, BODY_PIER_W if pier else BODY_FIN_W, BODY_PIER_D if pier else BODY_FIN_D))
    edges = [s_corner] + [e for (s, w, _) in fins for e in (s - w / 2, s + w / 2)] + [-s_corner]
    bays = [(edges[k], edges[k + 1]) for k in range(0, len(edges), 2)]
    return fins, bays, s_corner


def _body_rows():
    """층별 창 높이 [(z0 창 아래, z1 창 위)] — 기단 위 6개 층."""
    lv = floor_levels()
    rows = []
    for i, (zf, h) in enumerate(lv):
        z0 = PODIUM_H + BODY_BASE_H if i == 0 else zf + BODY_BAND_UP
        z1 = ROOF_Z0 - BODY_TOP_H if i == len(lv) - 1 else zf + h - BODY_BAND_DN
        rows.append((z0, z1))
    return rows


def _body_portal_dims():
    """정면 출입구 치수 (헤더 상수와 격자에서 유도). 틀 바깥면 = 가운데 칸 열주 축 피어의 바깥면."""
    hw = BODY_MID_AXIS + BODY_PIER_W / 2                        # 10.29 + 0.6
    top = floor_levels()[2][0] + BODY_BAND_UP + 0.1             # 머리 윗면: 3층 띠 윗단 바로 위 (2개 층 높이)
    open_top = top - BODY_PORTAL_LINTEL
    return {'hw': hw, 'open_hw': hw - BODY_PORTAL_JAMB, 'in_hw': hw - BODY_PORTAL_JAMB - BODY_PORTAL_STEP,
            'top': top, 'cap_top': top + BODY_PORTAL_CAP, 'open_top': open_top, 'in_top': open_top - 0.4,
            'door_top': PODIUM_H + BODY_DOOR_SILL + BODY_DOOR_H}


def _body_side_door_hw(face):
    """보조 출입문 반폭 (그 면의 모듈 기준, 앞면은 0)."""
    return BODY_SIDE_DOOR_MODULES * _body_face_info(face)[2] if face in BODY_DOOR_FACES else 0.0


# --- 돌: 핀·피어·모서리 기둥·층 띠·굽·처마 밑 띠 ---------------------------------

def _body_fin_bottom(face, s, w):
    """세로 부재 아래 끝: 보통은 굽 속, 정면 출입구 위는 출입구 캡 속, 뒤쪽 문 칸은 기단면까지."""
    if face == BODY_FRONT and abs(s) + w / 2 <= _body_portal_dims()['hw'] + 1e-6:
        return _body_portal_dims()['cap_top'] - 0.15
    if face in BODY_DOOR_FACES and abs(s) <= _body_side_door_hw(face) + 0.01:
        return PODIUM_H - BODY_SINK
    return PODIUM_H + BODY_BASE_H - 0.3


def _body_stone(ctx, coll):
    """화강석 핀·피어·모서리 기둥·층 띠·처마 밑 띠 (한 메시, 가는 베벨)."""
    bm = bmesh.new()
    z_top = ROOF_Z0 - BODY_TOP_H + 0.3                      # 세로 부재 윗끝은 처마 밑 띠 속
    for face in BODY_FACES:
        for (s, w, d) in _body_grid(face)[0]:
            _body_box(bm, face, s - w / 2, s + w / 2, -0.1, d, _body_fin_bottom(face, s, w), z_top)
    # 모서리 기둥: 두 면을 함께 덮는 통돌 (피어와 같은 돌출)
    cx, cy = abs(_body_grid(BODY_FRONT)[2]), abs(_body_grid(BODY_FACES[2])[2])
    hx, hy = BODY_X / 2 + BODY_PIER_D, BODY_Y / 2 + BODY_PIER_D
    for sx in (-1, 1):
        for sy in (-1, 1):
            _body_cube(bm, sx * cx, sx * hx, sy * cy, sy * hy, PODIUM_H + BODY_BASE_H - 0.3, z_top)
    # 층 띠 + 창턱 코: 본체를 통째로 감싸는 얇은 박스 (모서리 이음매 없음)
    ring = lambda d, z0, z1: _body_cube(bm, -BODY_X / 2 - d, BODY_X / 2 + d, -BODY_Y / 2 - d, BODY_Y / 2 + d, z0, z1)
    for (zf, _) in floor_levels()[1:]:
        ring(BODY_BAND_D, zf - BODY_BAND_DN, zf + BODY_BAND_UP)
        ring(BODY_NOSE_D, zf + BODY_BAND_UP - BODY_NOSE_H, zf + BODY_BAND_UP + 0.01)
    # 처마 밑 통돌 띠와 그 위 그림자 홈 (처마 슬래브 속으로 조금 묻힘)
    ring(BODY_TOP_D, ROOF_Z0 - BODY_TOP_H, ROOF_Z0 - BODY_REVEAL_H)
    ring(BODY_REVEAL_D, ROOF_Z0 - BODY_REVEAL_H - 0.02, ROOF_Z0 + BODY_SINK)
    obj = finish_mesh('Body_Stone', bm, coll, ctx.mats['granite'], part='body')
    add_bevel(obj, 0.03)

    # 굽: 보조 출입문 자리(뒤·양 끝)만 파낸 링 (오목 다각형 프리즘, 반시계 방향)
    X, Y = BODY_X / 2 + BODY_BASE_D, BODY_Y / 2 + BODY_BASE_D
    xn, yn = BODY_X / 2 - 0.2, BODY_Y / 2 - 0.2
    gb, gs = _body_side_door_hw(BODY_BACK), _body_side_door_hw(BODY_FACES[3])
    outline = [(-X, -Y), (X, -Y), (X, -gs), (xn, -gs), (xn, gs), (X, gs), (X, Y),
               (gb, Y), (gb, yn), (-gb, yn), (-gb, Y), (-X, Y),
               (-X, gs), (-xn, gs), (-xn, -gs), (-X, -gs)]
    bm = bmesh.new()
    bm_prism_z(bm, outline, PODIUM_H - BODY_SINK, PODIUM_H + BODY_BASE_H)
    obj = finish_mesh('Body_Base', bm, coll, ctx.mats['granite_dark'], part='body')
    add_bevel(obj, 0.02)


# --- 유리·창틀 -------------------------------------------------------------------

def _body_glass():
    """유리 뒤판 = 외벽보다 6 cm 안쪽의 박스 하나 (문짝 틈 같은 곳으로 빈 속이 보이지 않게). 반환: bmesh.
    실제 창유리는 창마다 한 장씩(_body_pane) 그 앞에 붙고, 핀·띠가 유리 앞으로 돌출해 깊은 그림자를 만듭니다."""
    bm = bmesh.new()
    x, y = BODY_X / 2 - 0.06, BODY_Y / 2 - 0.06
    _body_cube(bm, -x, x, -y, y, PODIUM_H - 0.02, ROOF_Z0 + 0.02)
    return bm


def _body_pane(bm, face, s0, s1, z0, z1, rng):
    """창유리 한 장: 얇은 판(n -0.012..0)을 가운데 기준으로 아주 조금 기울임 (작은 각의 전단 = 회전 근사).
    가장자리는 핀·띠·창틀 속으로 3 cm 들어가 틈이 없습니다."""
    axis, sign = face
    wall = _body_face_info(face)[1]
    sc, zc = (s0 + s1) / 2, (z0 + z1) / 2
    ts, tz = rng.uniform(-1, 1) * BODY_PANE_TILT, rng.uniform(-1, 1) * BODY_PANE_TILT
    v = []
    for (s, z) in ((s0 - 0.03, z0 - 0.03), (s1 + 0.03, z0 - 0.03), (s1 + 0.03, z1 + 0.03), (s0 - 0.03, z1 + 0.03)):
        for n in (-0.012, 0.0):
            a = sign * (wall + n + ts * (s - sc) + tz * (z - zc))
            v.append(bm.verts.new((s, a, z) if axis == 'x' else (a, s, z)))
    bm.faces.new([v[0], v[2], v[4], v[6]])
    bm.faces.new([v[1], v[3], v[5], v[7]])
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new([v[2 * i], v[2 * j], v[2 * j + 1], v[2 * i + 1]])


def _body_window(bm, face, s0, s1, z0, z1, full=True):
    """창 한 칸의 틀: 양쪽 문설주·머리·창턱(조금 더 돌출)·가로살. 핀·띠 속으로 2~3 cm 겹침.
    겹치는 부재끼리는 앞면 깊이를 조금씩 달리해 같은 평면이 겹치지 않게 합니다 (Cycles 검은 얼룩 방지).
    full: 층 높이 전체 창 (윗부분 고정창 가로살, 높은 1층은 가운데 가로살 하나 더)."""
    f = BODY_FRAME_W
    _body_box(bm, face, s0 - 0.03, s0 + f, -0.03, 0.06, z0, z1)
    _body_box(bm, face, s1 - f, s1 + 0.03, -0.03, 0.06, z0, z1)
    _body_box(bm, face, s0 - 0.02, s1 + 0.02, -0.04, 0.075, z1 - 0.09, z1 + 0.02)
    _body_box(bm, face, s0 - 0.02, s1 + 0.02, -0.04, 0.12, z0 - 0.02, z0 + 0.08)
    if not full:
        return
    bars = [z1 - BODY_TOPLIGHT] if z1 - z0 > 2.5 else []
    if z1 - z0 > 5.0:
        bars.append(z0 + 0.45 * (z1 - z0 - BODY_TOPLIGHT))
    for zt in bars:
        _body_box(bm, face, s0, s1, -0.02, 0.09, zt - 0.045, zt + 0.045)


def _body_windows(ctx, coll, glass_bm):
    """모든 창 칸의 창틀과 유리 (출입구 자리 제외). 반환: 창 수."""
    bm = bmesh.new()
    count = 0
    portal = _body_portal_dims()
    for face in BODY_FACES:
        bays = _body_grid(face)[1]
        for ri, (z0, z1) in enumerate(_body_rows()):
            for (s0, s1) in bays:
                mid = (s0 + s1) / 2
                zb = z0
                if face == BODY_FRONT and abs(mid) < portal['hw']:
                    if z1 <= portal['cap_top'] + 0.5:
                        continue                        # 출입구 틀 뒤
                    zb = max(z0, portal['cap_top'])
                if ri == 0 and abs(mid) < _body_side_door_hw(face):
                    zb = PODIUM_H + BODY_SIDE_DOOR_H + 0.17   # 보조 출입문 위 채광창만
                _body_window(bm, face, s0, s1, zb, z1, full=zb == z0)
                _body_pane(glass_bm, face, s0, s1, zb, z1, ctx.rng)
                count += 1
    finish_mesh('Body_Window_Frames', bm, coll, _body_frame_mat(ctx), part='body')
    return count


def _body_frame_mat(ctx):
    """청동색 아노다이징 알루미늄 창틀 (금빛 유리와 어울리는 짙은 청동)."""
    return ctx.material('body_frame', lambda: new_pbr('Body_Frame_Bronze', (0.11, 0.08, 0.055),
                                                      0.38, 0.75)[0])


# --- 정면 출입구 ---------------------------------------------------------------

def _body_portal_frame(ctx, coll):
    """2개 층 높이 화강석 출입구 틀: 바깥 문설주·머리·머리 캡·한 단 들어간 안쪽 틀·문 칸 돌기둥·굽·문턱."""
    f, p, d = BODY_FRONT, _body_portal_dims(), BODY_PORTAL_D
    hw, ohw, ihw = p['hw'], p['open_hw'], p['in_hw']
    z0 = PODIUM_H - BODY_SINK
    bm = bmesh.new()
    # 부재는 맞닿게만 (겹치는 같은 평면 금지): 문설주는 머리 밑까지, 머리는 전체 폭
    for sg in (-1, 1):
        _body_box(bm, f, *sorted((sg * ohw, sg * hw)), -0.2, d, z0, p['open_top'])            # 바깥 문설주
        _body_box(bm, f, *sorted((sg * ihw, sg * (ohw + 0.1))), -0.2, d - 0.5, z0, p['in_top'])  # 안쪽 문설주
    _body_box(bm, f, -hw, hw, -0.2, d, p['open_top'], p['top'])                             # 머리
    _body_box(bm, f, -hw - 0.03, hw + 0.03, -0.2, d + 0.25, p['top'], p['cap_top'])         # 머리 캡 (피어 옆면과 겹치지 않게 3 cm 넓게)
    _body_box(bm, f, -ohw - 0.1, ohw + 0.1, -0.2, d - 0.5, p['in_top'], p['open_top'] + 0.05)  # 안쪽 머리
    for c in _body_portal_posts():
        _body_box(bm, f, c - BODY_PORTAL_POST_W / 2, c + BODY_PORTAL_POST_W / 2, -0.2, 1.1,
                  z0, p['door_top'] + 0.2)
    obj = finish_mesh('Body_Portal', bm, coll, ctx.mats['granite_light'], part='body')
    add_bevel(obj, 0.02)
    bm = bmesh.new()
    for sg in (-1, 1):                                                                     # 문설주 굽
        _body_box(bm, f, *sorted((sg * (ohw - 0.05), sg * (hw + 0.05))), -0.2, d + 0.05, z0, PODIUM_H + 0.6)
    _body_box(bm, f, -ohw - 0.05, ohw + 0.05, 0.7, d + 0.15, z0, PODIUM_H + BODY_DOOR_SILL)  # 문턱
    obj = finish_mesh('Body_Portal_Base', bm, coll, ctx.mats['granite_dark'], part='body')
    add_bevel(obj, 0.015)


def _body_portal_posts():
    """문 세 칸을 나누는 돌기둥 중심 s (같은 폭의 세 칸)."""
    ihw = _body_portal_dims()['in_hw']
    bay = (2 * ihw - 2 * BODY_PORTAL_POST_W) / 3
    return (-(bay + BODY_PORTAL_POST_W) / 2, (bay + BODY_PORTAL_POST_W) / 2)


def _body_door_leaf(bm_b, bm_m, face, s0, s1, z0, z1, n0, n1, rows, handle_s):
    """청동 문짝 하나: 판 + 도드라진 장식판 rows 개 + 손잡이(금속 세로 막대, 받침 2개로 문에 붙음)."""
    _body_box(bm_b, face, s0, s1, n0, n1, z0, z1)
    m = min(0.2, (s1 - s0) * 0.12)
    ph = (z1 - z0 - (rows + 1) * m) / rows
    for r in range(rows):
        zr = z0 + m + r * (ph + m)
        _body_box(bm_b, face, s0 + m, s1 - m, n1 - 0.01, n1 + 0.04, zr, zr + ph)
    hz = z0 + min(1.0, 0.3 * (z1 - z0))
    _body_box(bm_m, face, handle_s - 0.025, handle_s + 0.025, n1 + 0.07, n1 + 0.12, hz, hz + 1.6)
    for zb in (hz + 0.15, hz + 1.45):
        _body_box(bm_m, face, handle_s - 0.015, handle_s + 0.015, n1 - 0.01, n1 + 0.08, zb - 0.02, zb + 0.02)


def _body_portal_doors(ctx, coll, glass_bm):
    """출입구 안쪽 면: 청동 문 3쌍, 문 위 청동 보, 유리 트랜섬과 청동 살."""
    f, p = BODY_FRONT, _body_portal_dims()
    ihw = p['in_hw']
    z0, zt = PODIUM_H + BODY_DOOR_SILL - 0.01, p['door_top']
    n0, n1 = BODY_DOOR_N
    posts = _body_portal_posts()
    pw = BODY_PORTAL_POST_W / 2
    edges = [-ihw, posts[0] - pw, posts[0] + pw, posts[1] - pw, posts[1] + pw, ihw]
    bays = [(edges[k], edges[k + 1]) for k in range(0, 6, 2)]
    bm_b, bm_m = bmesh.new(), bmesh.new()
    for (b0, b1) in bays:
        mid = (b0 + b1) / 2
        _body_door_leaf(bm_b, bm_m, f, b0 - 0.02, mid - 0.012, z0, zt, n0, n1, 4, mid - 0.15)
        _body_door_leaf(bm_b, bm_m, f, mid + 0.012, b1 + 0.02, z0, zt, n0, n1, 4, mid + 0.15)
    _body_box(bm_b, f, -ihw - 0.05, ihw + 0.05, n0 - 0.05, n1 + 0.1, zt, zt + 0.4)          # 문 위 보
    zg0, zg1 = zt + 0.38, p['in_top'] + 0.05
    _body_box(glass_bm, f, -ihw - 0.05, ihw + 0.05, 0.78, 0.88, zg0, zg1)                  # 트랜섬 유리
    for c in posts:                                                   # 살: 굵은 살 > 가로살 > 가는 살 깊이
        _body_box(bm_b, f, c - 0.11, c + 0.11, 0.84, 0.99, zg0, zg1)
    for (b0, b1) in bays:
        for c in (b0 + (b1 - b0) / 3, b0 + 2 * (b1 - b0) / 3):
            _body_box(bm_b, f, c - 0.045, c + 0.045, 0.84, 0.95, zg0, zg1)
    zm = (zg0 + zg1) / 2
    _body_box(bm_b, f, -ihw, ihw, 0.85, 0.97, zm - 0.05, zm + 0.05)
    finish_mesh('Body_Portal_Doors', bm_b, coll, ctx.mats['bronze'], part='body')
    finish_mesh('Body_Door_Handles', bm_m, coll, ctx.mats['metal'], part='body')


def _body_portal_lights(ctx, coll):
    """출입구 안쪽 머리 밑면의 매입 다운라이트 6개 (밤에만 발광 — 문 앞을 비춤)."""
    f, p = BODY_FRONT, _body_portal_dims()

    def make():
        emit = (1.0, 0.82, 0.6) if ctx.night else None
        return new_pbr('Body_Downlight', (0.75, 0.74, 0.7), 0.3, 0.0,
                       emission=emit, emission_strength=25.0 if emit else 0.0)[0]
    bm = bmesh.new()
    ihw = p['in_hw']
    for i in range(6):
        s = -ihw + (i + 0.5) * 2 * ihw / 6
        _body_box(bm, f, s - 0.2, s + 0.2, 1.1, 1.5, p['in_top'] - 0.02, p['in_top'] + 0.01)
    finish_mesh('Body_Portal_Downlights', bm, coll, ctx.material('body_downlight', make), part='body')


def _body_side_doors(ctx, coll):
    """뒤·양 끝면 가운데 1층(기단면 높이) 창 칸 4개씩을 청동 쌍여닫이문으로 — 정면보다 소박하게."""
    z0, z1 = PODIUM_H - BODY_SINK, PODIUM_H + BODY_SIDE_DOOR_H
    bm_b, bm_m = bmesh.new(), bmesh.new()
    for f in BODY_DOOR_FACES:
        hw = _body_side_door_hw(f)
        for (s0, s1) in _body_grid(f)[1]:
            mid = (s0 + s1) / 2
            if abs(mid) >= hw:
                continue
            _body_door_leaf(bm_b, bm_m, f, s0 - 0.02, mid - 0.01, z0, z1, -0.02, 0.08, 2, mid - 0.07)
            _body_door_leaf(bm_b, bm_m, f, mid + 0.01, s1 + 0.02, z0, z1, -0.02, 0.08, 2, mid + 0.07)
            _body_box(bm_b, f, s0 - 0.03, s1 + 0.03, -0.03, 0.14, z1, z1 + 0.17)            # 문 머리 보
    finish_mesh('Body_Side_Doors', bm_b, coll, ctx.mats['bronze'], part='body')
    finish_mesh('Body_Side_Handles', bm_m, coll, ctx.mats['metal'], part='body')


# --- 정면 LED 격자 패널 · 태극기 -----------------------------------------------

def _body_led_extent():
    """LED 패널 바깥 (반폭, 아래 z, 위 z). 안쪽(테두리 제외)이 태극기 3:2."""
    e = BODY_LED_EDGE
    hw = 1.5 * BODY_LED_FLAG_H / 2 + e
    return hw, BODY_LED_ZC - BODY_LED_FLAG_H / 2 - e, BODY_LED_ZC + BODY_LED_FLAG_H / 2 + e


def _body_trigram_hit(s, t, broken):
    """괘 하나: s = 중심에서 괘 방향 거리, t = 가로 방향. 효 3개(안→밖), 끊긴 효는 가운데 1 단위 틈."""
    w = s - 18.0
    if not (0.0 < w < 8.0 and abs(t) < 6.0):
        return False
    k = min(2, int(w // 3))
    if w - 3 * k >= 2.0:
        return False
    return not (broken[k] and abs(t) < 0.5)


def _body_flag_class(u, v):
    """태극기 색 분류 (u, v: 세로 48 단위, 가운데 원점, u 오른쪽(+X)·v 위) → 0 꺼짐·검정, 1 흰, 2 빨강, 3 파랑.
    _body_flag_nodes 의 셰이더 식과 똑같습니다 (GLB 용 색 구간 분할에 씀).
    태극: 건-곤 대각선 위쪽 반원이 빨강, 건 쪽 작은 원은 빨강·곤 쪽 작은 원은 파랑 (지름/2 원)."""
    if abs(u) >= 36 or abs(v) >= 24:
        return 0
    r = 1 / math.sqrt(13)
    a, b = (-3 * u + 2 * v) * r, (2 * u + 3 * v) * r      # a: 건 쪽 대각선, b: 그 수직(빨강 쪽 +)
    if u * u + v * v < 144:
        if (a - 6) ** 2 + b * b < 36 or (b > 0 and (a + 6) ** 2 + b * b >= 36):
            return 2
        return 3
    for (dx, dy), broken in BODY_TRIGRAMS:
        if _body_trigram_hit((dx * u + dy * v) * r, (-dy * u + dx * v) * r, broken):
            return 0
    return 1


def _body_m(nt, op, a, b=None, c=None):
    """Math 노드 하나 (입력은 소켓 또는 숫자). 출력 소켓을 돌려줍니다."""
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    n.location = (-600, 0)
    for i, v in enumerate((a, b, c)):
        if v is None:
            continue
        if hasattr(v, 'is_output'):
            nt.links.new(v, n.inputs[i])
        else:
            n.inputs[i].default_value = v
    return n.outputs[0]


def _body_flag_nodes(nt):
    """패널 좌표(Object = 월드 m)에서 태극기 색을 계산하는 셰이더 식. _body_flag_class 와 같은 규칙.
    반환: 발광 색 소켓 (태극기 밖·괘는 검정 = LED 꺼짐)."""
    M = lambda op, a, b=None, c=None: _body_m(nt, op, a, b, c)
    tc = node(nt, 'ShaderNodeTexCoord', loc=(-1400, 0))
    sep = node(nt, 'ShaderNodeSeparateXYZ', loc=(-1200, 0))
    link(nt, tc.outputs['Object'], sep.inputs['Vector'])
    k = 48.0 / BODY_LED_FLAG_H
    u = M('MULTIPLY', sep.outputs['X'], k)
    v = M('MULTIPLY', M('SUBTRACT', sep.outputs['Z'], BODY_LED_ZC), k)
    r = 1 / math.sqrt(13)
    lin = lambda cu, cv: M('MULTIPLY_ADD', u, cu * r, M('MULTIPLY', v, cv * r))
    a, b = lin(-3, 2), lin(2, 3)
    inside = M('LESS_THAN', M('ADD', M('MULTIPLY', u, u), M('MULTIPLY', v, v)), 144.0)
    b2 = M('MULTIPLY', b, b)
    sq = lambda x: M('MULTIPLY', x, x)
    red_head = M('LESS_THAN', M('ADD', sq(M('SUBTRACT', a, 6.0)), b2), 36.0)
    blue_head = M('LESS_THAN', M('ADD', sq(M('ADD', a, 6.0)), b2), 36.0)
    upper = M('MULTIPLY', M('GREATER_THAN', b, 0.0), M('SUBTRACT', 1.0, blue_head))
    red = M('MULTIPLY', inside, M('MAXIMUM', red_head, upper))
    blue = M('SUBTRACT', inside, red)
    black = None
    for (dx, dy), broken in BODY_TRIGRAMS:
        w = M('SUBTRACT', lin(dx, dy), 18.0)
        at = M('ABSOLUTE', lin(-dy, dx))
        hit = M('MULTIPLY', M('MULTIPLY', M('GREATER_THAN', w, 0.0), M('LESS_THAN', w, 8.0)),
                M('MULTIPLY', M('LESS_THAN', at, 6.0), M('LESS_THAN', M('MODULO', w, 3.0), 2.0)))
        mid = M('MULTIPLY', M('GREATER_THAN', w, 3.0), M('LESS_THAN', w, 6.0))
        brk = M('ADD', M('MULTIPLY_ADD', M('LESS_THAN', w, 3.0), float(broken[0]),
                         M('MULTIPLY', mid, float(broken[1]))),
                M('MULTIPLY', M('GREATER_THAN', w, 6.0), float(broken[2])))
        hit = M('MULTIPLY', hit, M('SUBTRACT', 1.0, M('MULTIPLY', brk, M('LESS_THAN', at, 0.5))))
        black = hit if black is None else M('MAXIMUM', black, hit)
    in_flag = M('MULTIPLY', M('LESS_THAN', M('ABSOLUTE', u), 36.0), M('LESS_THAN', M('ABSOLUTE', v), 24.0))
    col = mix_color(nt, red, BODY_FLAG_WHITE, BODY_FLAG_RED, loc=(-300, 0))
    col = mix_color(nt, blue, col, BODY_FLAG_BLUE, loc=(-250, 0))
    col = mix_color(nt, M('MULTIPLY', black, M('SUBTRACT', 1.0, inside)), col, (0, 0, 0), loc=(-200, 0))
    return mix_color(nt, in_flag, (0, 0, 0), col, loc=(-150, 0))


def _body_led_mat(ctx, cls):
    """LED 막대 재질. 낮: 짙은 청동 금속 (분류 하나). 밤: 셰이더가 태극기를 그리고,
    GLB 대표값은 색 구간(cls: 0 꺼짐, 1 흰, 2 빨강, 3 파랑)별 발광색."""
    names = ('Off', 'White', 'Red', 'Blue')
    emit = (None, BODY_FLAG_WHITE, BODY_FLAG_RED, BODY_FLAG_BLUE)[cls] if ctx.night else None

    def make():
        mat, nt, bsdf = new_pbr('Body_LED_' + (names[cls] if ctx.night else 'Grille'),
                                (0.075, 0.058, 0.042), 0.42, 0.7,
                                emission=emit, emission_strength=2.5 if emit else 0.0)
        if ctx.night:
            link(nt, _body_flag_nodes(nt), bsdf.inputs['Emission Color'])
            bsdf.inputs['Emission Strength'].default_value = BODY_LED_NIGHT
        return mat
    return ctx.material(f'body_led_{cls}' if ctx.night else 'body_led', make)


def _body_led_runs(z, s0, s1):
    """높이 z 막대를 따라 태극기 색이 바뀌는 구간 [(s_a, s_b, cls)] (GLB 에서도 밤에 태극기가 보이도록)."""
    k = 48.0 / BODY_LED_FLAG_H
    n = max(1, int(round((s1 - s0) / 0.03)))
    runs = []
    for i in range(n):
        sa, sb = s0 + (s1 - s0) * i / n, s0 + (s1 - s0) * (i + 1) / n
        c = _body_flag_class((sa + sb) / 2 * k, (z - BODY_LED_ZC) * k)
        if runs and runs[-1][2] == c:
            runs[-1][1] = sb
        else:
            runs.append([sa, sb, c])
    return runs


def _body_led_bar(bm, face, runs, n0, n1, z0, z1):
    """LED 막대 하나: 색 구간 경계마다 단면 링, 구간마다 재질 번호. 속 면이 없는 닫힌 한 덩어리."""
    wall = _body_face_info(face)[1]
    sign = face[1]
    ring = lambda s: [bm.verts.new((s, sign * (wall + n), z)) for (n, z) in
                      ((n0, z0), (n1, z0), (n1, z1), (n0, z1))]
    rings = [ring(runs[0][0])] + [ring(r[1]) for r in runs]
    for j, r in enumerate(runs):
        a, b = rings[j], rings[j + 1]
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k])).material_index = r[2]
    bm.faces.new(rings[0]).material_index = runs[0][2]
    bm.faces.new(rings[-1]).material_index = runs[-1][2]


def _body_led_frame(ctx, coll):
    """LED 패널 청동 틀: 위·아래 가로재, 양쪽 세로재, 핀 앞의 세로 걸이 + 핀에 닿는 까치발,
    양쪽 세로재를 옆 피어에 붙이는 받침."""
    f = BODY_FRONT
    hw, z0, z1 = _body_led_extent()
    e = BODY_LED_EDGE
    mod = _body_face_info(f)[2]
    pier_in = BODY_MID_AXIS - BODY_PIER_W / 2                       # 가운데 칸 피어 안쪽 면
    bm = bmesh.new()
    for zb in (z0, z1 - e):
        _body_box(bm, f, -hw, hw, 0.76, 0.98, zb, zb + e)
    for sg in (-1, 1):
        _body_box(bm, f, *sorted((sg * (hw - e), sg * hw)), 0.76, 0.98, z0 + e, z1 - e)
        for zb in (z0 + 1.2, BODY_LED_ZC, z1 - 1.2):
            _body_box(bm, f, *sorted((sg * (hw - 0.05), sg * (pier_in + 0.02))), 0.55, 0.78, zb - 0.08, zb + 0.08)
    kmax = int((hw - e) / mod)
    for i in range(-kmax, kmax + 1):                                    # 핀과 같은 자리의 걸이·까치발
        s = i * mod
        _body_box(bm, f, s - 0.035, s + 0.035, 0.74, 0.85, z0 + e, z1 - e)
        for zb in (z0 + 1.2, BODY_LED_ZC, z1 - 1.2):
            _body_box(bm, f, s - 0.02, s + 0.02, BODY_FIN_D - 0.03, 0.75, zb - 0.06, zb + 0.06)
    finish_mesh('Body_LED_Frame', bm, coll, _body_frame_mat(ctx), part='body')


def _body_led_panel(ctx, coll):
    """정면 위층 가운데 격자형 LED 패널: 틀 + 가로 LED 막대. 밤에는 패널 뒤 창을 끈 유리로 가립니다
    (뒤 사무실 불빛이 태극기를 씻어내지 않도록)."""
    f = BODY_FRONT
    _body_led_frame(ctx, coll)
    hw, z0, z1 = _body_led_extent()
    e = BODY_LED_EDGE
    bm = bmesh.new()
    nb = int(round((z1 - z0 - 2 * e) / BODY_LED_PITCH))
    s0, s1 = -hw + e - 0.02, hw - e + 0.02
    for i in range(nb):
        zc = z0 + e + (i + 0.5) * BODY_LED_PITCH
        runs = _body_led_runs(zc, s0, s1) if ctx.night else [[s0, s1, 0]]
        _body_led_bar(bm, f, runs, *BODY_LED_N, zc - BODY_LED_BAR / 2, zc + BODY_LED_BAR / 2)
    mats = [_body_led_mat(ctx, c) for c in range(4 if ctx.night else 1)]
    finish_mesh('Body_LED_Grille', bm, coll, mats, part='body')
    if ctx.night:
        pier_in = BODY_MID_AXIS - BODY_PIER_W / 2
        bm = bmesh.new()
        _body_box(bm, f, -pier_in - 0.02, pier_in + 0.02, 0.035, 0.045,
                  _body_portal_dims()['cap_top'] - 0.1, ROOF_Z0 - BODY_TOP_H + 0.1)
        mat = ctx.material('body_glass_off', lambda: new_pbr('Body_Glass_Off', (0.03, 0.025, 0.02), 0.08, 0.3)[0])
        finish_mesh('Body_LED_Backing', bm, coll, mat, part='body')


# --- 조립 ------------------------------------------------------------------------

def build_body(ctx):
    coll = ctx.coll('Body')
    _body_stone(ctx, coll)
    glass = _body_glass()
    _body_portal_frame(ctx, coll)
    _body_portal_doors(ctx, coll, glass)
    _body_portal_lights(ctx, coll)
    ctx.stats['body_windows'] = _body_windows(ctx, coll, glass)
    finish_mesh('Body_Glass', glass, coll, ctx.mats['glass'], part='body')
    _body_side_doors(ctx, coll)
    _body_led_panel(ctx, coll)


# ----------------------------------------------------------------------------
# 열주 24개와 지붕 — 경회루 돌기둥에서 온 사각→팔각 열주, 처마 슬래브(그림자 홈·LED 띠),
# 회랑 천장 우물반자와 다운라이트, 파라펫, 옥상 (방수층·통로·설비·천창)
#
# 열주: 밑단은 모서리를 조금 깎은 사각(COL_BASE_W), 위로 갈수록 넓어지며 윗단은 정팔각(COL_TOP_W).
#   주두 없이 처마 밑면으로 곧게 들어가고, 그 사이에 얇은 그림자 홈 블록만 둡니다.
#   약 1.41 m 높이 화강석 드럼을 쌓은 줄눈은 V 홈으로 모델링합니다 (평평한 GLB 재질에서도 보임).
#   줄눈 높이 = PODIUM_H + k * COL_H / CLN_DRUMS — 공유 재질 granite_light 의 가로 줄눈 행과 일치.
# 처마: 장식 몰딩 없는 평평한 회백색 석재 슬래브 하나. 밑면 가장자리에 그림자 홈, 그 안에 밤용 LED 띠.
# 회랑 천장: 열주 축마다 넓은 보, 그 사이 칸을 4 x 2 우물로 나누는 절제된 격자 (보·리브·우물 세 높이).
# ----------------------------------------------------------------------------
CLN_SINK = 0.05             # 굽을 기단면 속으로 묻는 깊이 (틈·동일 평면 겹침 방지)
CLN_PLINTH_H = 0.40         # 열주 굽 높이
CLN_PLINTH_OUT = 0.30       # 굽이 기둥 밑단보다 나오는 폭
CLN_PLINTH_BEVEL = 0.05     # 굽 윗모서리 깎기
CLN_CHAMFER = 0.35          # 밑단 사각의 모서리 깎기 (다리 길이 → 빗면 폭 약 0.5 m)
CLN_FLARE = 1.35            # 폭 증가 곡선 지수 (>1: 위로 갈수록 빨리 넓어지는 오목한 실루엣)
CLN_OCT_EASE = 1.10         # 모서리 빗면이 커지는 곡선 지수
CLN_DRUMS = 23              # 기단면 → 처마 밑면을 나누는 화강석 드럼 수 (약 1.41 m, granite_light 줄눈과 같은 격자)
CLN_JOINT_W, CLN_JOINT_D = 0.05, 0.022   # V 줄눈 폭·깊이
CLN_GAP_H, CLN_GAP_INSET = 0.28, 0.30    # 기둥머리와 처마 사이 그림자 홈 블록 높이·들임

CLN_REVEAL = 0.30           # 처마 밑면 가장자리 그림자 홈 (높이 = 깊이)
CLN_BEAM_HW = 1.80          # 열주 축 보 반폭 (열주 윗단 3.3 m 를 덮음)
CLN_RIB_W = 0.60            # 우물 사이 리브 폭
CLN_EDGE_W = 0.60           # 처마 끝 테두리 띠 폭
CLN_COFFERS = 4             # 열주 한 칸을 나누는 우물 수
CLN_LV = (0.0, 0.22, 0.50)  # 보 / 리브 / 우물 천장 높이 (처마 밑면 ROOF_Z0 기준)
CLN_LIGHT_R, CLN_LIGHT_H = 0.22, 0.05    # 다운라이트 반지름·돌출
CLN_LED_Z, CLN_LED_H, CLN_LED_D = 0.09, 0.10, 0.05   # LED 띠: 홈 바닥에서 높이, 두께, 돌출

CLN_PARAPET_SET = 0.50      # 파라펫을 처마 끝에서 들인 거리
CLN_PARAPET_T = 0.50        # 파라펫 두께
CLN_COPING_H, CLN_COPING_OUT = 0.14, 0.05   # 갓돌 높이·내밈
CLN_DECK_T = 0.06           # 옥상 방수층 두께
CLN_DOME_CLEAR = DRUM_R + 3.0                 # 옥상 중앙에서 비워 둘 반지름 (돔 받침)
CLN_WALK_GAP, CLN_WALK_W, CLN_WALK_H = 0.25, 1.3, 0.05   # 관리 통로: 파라펫과의 틈, 폭, 두께
CLN_WALK_CROSS = 0.70       # 양 끝 가로 통로 반폭 (y = 0 축 위)

# 옥상 설비 배치 — 모든 위치를 파라펫 안쪽 면(ix, iy)이나 돔 여유 반지름에서 잽니다.
# 그래서 PLAN_BASIS 를 바꿔 지붕이 작아져도 설비가 지붕을 따라가고, 들어갈 자리가 없는 설비는 뺍니다.
CLN_AHU_IN = (20.0, 24.5)          # 공조기 중심: 파라펫 안쪽 면에서 들인 거리 (x, y)
CLN_AHU_SIZE = (12.0, 4.8, 2.0)    # 공조기 크기 (x, y, 높이)
CLN_AHU_PAD = 0.40                 # 받침대가 공조기보다 나오는 폭
CLN_FAN_R, CLN_FAN_PITCH = 1.0, 3.6          # 공조기 위 팬 덮개 반지름, 간격 (3개)
CLN_PENT_IN = (9.0, 10.0)          # 계단 옥탑: 중심 x, 앞(-Y)면을 파라펫 안쪽 면에서 들인 거리
CLN_PENT_SIZE = (6.0, 5.0, 2.5)    # 계단 옥탑 크기 (x, y, 높이) — 문은 돔 쪽(+Y) 면
CLN_SKY_START, CLN_SKY_PITCH, CLN_SKY_N = 10.0, 8.0, 3   # 천창: 돔 여유 반지름 밖 첫 중심까지, 간격, 한 줄 수
CLN_SKY_Y = 10.0                   # 천창 두 줄의 y (중심축에서)
CLN_SKY_SIZE = (6.0, 3.6)          # 천창 크기 (x, y)
CLN_UNIT_CLEAR = 0.50              # 설비와 통로·다른 설비 사이 최소 틈


# --- 열주 --------------------------------------------------------------------

def _cln_oct(a, c, z, inset=0.0):
    """면이 X·Y 축과 나란한 팔각 단면 8점 (반시계). a = 면 사이 반폭, c = 모서리 깎기 다리 길이.
    inset 만큼 모든 면을 안쪽으로 평행 이동한 단면을 돌려줄 수도 있습니다 (줄눈 홈)."""
    a, c = a - inset, c - inset * (2.0 - math.sqrt(2.0))
    b = a - c
    return [(a, -b, z), (a, b, z), (b, a, z), (-b, a, z),
            (-a, b, z), (-a, -b, z), (-b, -a, z), (b, -a, z)]


def _cln_loft(bm, cx, cy, rings, mat=0):
    """팔각 단면 목록(아래→위)을 이어 붙이고 위·아래를 막은 닫힌 기둥 조각. 면 방향은 바깥쪽."""
    vs = [[bm.verts.new((cx + x, cy + y, z)) for (x, y, z) in ring] for ring in rings]
    for r0, r1 in zip(vs, vs[1:]):
        for k in range(8):
            k2 = (k + 1) % 8
            bm.faces.new((r0[k], r0[k2], r1[k2], r1[k])).material_index = mat
    bm.faces.new(list(reversed(vs[0]))).material_index = mat
    bm.faces.new(vs[-1]).material_index = mat


def _cln_section(t):
    """높이 비율 t(0 밑 → 1 위)의 열주 단면 (반폭, 모서리 깎기)."""
    a = (COL_BASE_W + (COL_TOP_W - COL_BASE_W) * t ** CLN_FLARE) / 2.0
    a_top = COL_TOP_W / 2.0
    c_top = a_top * (1.0 - math.tan(math.pi / 8.0))      # 이 값이면 정팔각형
    return a, CLN_CHAMFER + (c_top - CLN_CHAMFER) * t ** CLN_OCT_EASE


def _cln_shaft_rings(z0, z1):
    """기둥 몸통 단면 링: 드럼 줄눈마다 V 홈 (바깥·안쪽·바깥 세 링). z0·z1 = 몸통 밑·위."""
    step = COL_H / CLN_DRUMS
    hw = CLN_JOINT_W / 2.0
    joints = [PODIUM_H + k * step for k in range(1, CLN_DRUMS)]
    joints = [zj for zj in joints if z0 + 0.3 < zj < z1 - 0.3]

    def ring(z, inset=0.0):
        a, c = _cln_section((z - z0) / (z1 - z0))
        return _cln_oct(a, c, z, inset)

    rings = [_cln_oct(*_cln_section(0.0), z0 - 0.02)]    # 굽 속으로 2 cm 묻힘
    for zj in joints:
        rings += [ring(zj - hw), ring(zj, CLN_JOINT_D), ring(zj + hw)]
    rings.append(ring(z1))
    return rings


def _cln_column(bm, cx, cy):
    """열주 하나: 짙은 굽 → 드럼을 쌓은 몸통 → 그림자 홈 블록 (처마 밑면 속으로 5 cm)."""
    a0, c0 = _cln_section(0.0)
    ap, cp = a0 + CLN_PLINTH_OUT, c0 + CLN_PLINTH_OUT * (2.0 - math.sqrt(2.0))
    zp0, zp1 = PODIUM_H - CLN_SINK, PODIUM_H + CLN_PLINTH_H
    _cln_loft(bm, cx, cy, [_cln_oct(ap, cp, zp0), _cln_oct(ap, cp, zp1 - CLN_PLINTH_BEVEL),
                           _cln_oct(ap, cp, zp1, CLN_PLINTH_BEVEL)], mat=1)
    z_top = ROOF_Z0 - CLN_GAP_H
    _cln_loft(bm, cx, cy, _cln_shaft_rings(zp1, z_top), mat=0)
    a1, c1 = _cln_section(1.0)
    _cln_loft(bm, cx, cy, [_cln_oct(a1, c1, z_top - 0.02, CLN_GAP_INSET),
                           _cln_oct(a1, c1, ROOF_Z0 + 0.05, CLN_GAP_INSET)], mat=0)


def build_columns(ctx):
    """24개 열주 (앞·뒤 8개씩, 옆 4개씩). 모두 한 메시 — 월드 좌표라 재질 무늬가 기둥마다 다릅니다."""
    coll = ctx.coll('Columns')
    bm = bmesh.new()
    pts = column_positions()
    for (x, y) in pts:
        _cln_column(bm, x, y)
    finish_mesh('Columns_24', bm, coll, [ctx.mats['granite_light'], ctx.mats['granite_dark']],
                part='columns')
    ctx.stats['columns'] = len(pts)


# --- 지붕용 bmesh 도우미: 작은 원기둥, 면 방향을 직접 정하는 작성기 (열린 면: 천장 격자·처마 끝) ---

def _cln_disc(bm, x, y, z0, z1, r, seg=10, top=True):
    """작은 다각 기둥 (bmesh.ops 없이 정점을 바로 만듦 — 수백 개를 한 메시에 넣어도 빠름).
    top=False 면 윗면 생략 (천장 속에 묻히는 경우)."""
    ring = [(r * math.cos(2 * math.pi * k / seg), r * math.sin(2 * math.pi * k / seg)) for k in range(seg)]
    lo = [bm.verts.new((x + u, y + v, z0)) for (u, v) in ring]
    hi = [bm.verts.new((x + u, y + v, z1)) for (u, v) in ring]
    for k in range(seg):
        k2 = (k + 1) % seg
        bm.faces.new((lo[k], lo[k2], hi[k2], hi[k]))
    bm.faces.new(list(reversed(lo)))
    if top:
        bm.faces.new(hi)


class _ClnMesh:
    """같은 좌표는 같은 정점으로 공유하고, 면은 지정한 법선 방향으로 만듭니다.
    열린 면 조각이 많아 recalc_face_normals 의 추정에 맡기지 않으려고 씁니다."""

    def __init__(self):
        self.bm = bmesh.new()
        self._verts = {}

    def vert(self, p):
        """좌표 p 의 정점 (0.1 mm 로 반올림해 같은 자리면 이미 만든 정점을 돌려줌)."""
        key = (round(p[0], 4), round(p[1], 4), round(p[2], 4))
        v = self._verts.get(key)
        if v is None:
            v = self._verts[key] = self.bm.verts.new(key)
        return v

    def face(self, pts, normal, mat=0):
        """볼록 다각형 pts 를 법선이 normal 쪽을 향하도록 만듭니다."""
        a, b, c = (Vector(p) for p in pts[:3])
        if (b - a).cross(c - a).dot(Vector(normal)) < 0:
            pts = pts[::-1]
        f = self.bm.faces.new([self.vert(p) for p in pts])
        f.material_index = mat
        return f

    def rect(self, axis, c, u0, u1, v0, v1, sign, mat=0):
        """축에 수직인 직사각형. axis='z': 평면 z=c, (u,v)=(x,y) / 'x': x=c, (y,z) / 'y': y=c, (x,z)."""
        if axis == 'z':
            pts, n = [(u0, v0, c), (u1, v0, c), (u1, v1, c), (u0, v1, c)], (0, 0, sign)
        elif axis == 'x':
            pts, n = [(c, u0, v0), (c, u1, v0), (c, u1, v1), (c, u0, v1)], (sign, 0, 0)
        else:
            pts, n = [(u0, c, v0), (u1, c, v0), (u1, c, v1), (u0, c, v1)], (0, sign, 0)
        return self.face(pts, n, mat)

    def box(self, x0, x1, y0, y1, z0, z1, mat=0):
        """바닥면 없는 축 정렬 상자 (늘 다른 면 위에 얹거나 살짝 묻어서 씀)."""
        self.rect('z', z1, x0, x1, y0, y1, 1, mat)
        self.rect('x', x0, y0, y1, z0, z1, -1, mat)
        self.rect('x', x1, y0, y1, z0, z1, 1, mat)
        self.rect('y', y0, x0, x1, z0, z1, -1, mat)
        self.rect('y', y1, x0, x1, z0, z1, 1, mat)

    def ring(self, o, i, z0, z1, sides, mat=0):
        """원점 중심 사각 고리 (모서리 45° 맞춤). o, i = 바깥·안쪽 (반폭 x, 반폭 y).
        sides 는 'out', 'in', 'top', 'bottom' 중 만들 면."""
        outer = [(o[0], o[1]), (-o[0], o[1]), (-o[0], -o[1]), (o[0], -o[1])]
        inner = [(i[0], i[1]), (-i[0], i[1]), (-i[0], -i[1]), (i[0], -i[1])]
        for k in range(4):
            (ax, ay), (bx, by) = outer[k], outer[(k + 1) % 4]
            (cx, cy), (dx, dy) = inner[k], inner[(k + 1) % 4]
            n_out = ((ax + bx) / 2.0, (ay + by) / 2.0, 0.0)
            if 'out' in sides:
                self.face([(ax, ay, z0), (bx, by, z0), (bx, by, z1), (ax, ay, z1)], n_out, mat)
            if 'in' in sides:
                self.face([(cx, cy, z0), (dx, dy, z0), (dx, dy, z1), (cx, cy, z1)],
                          (-n_out[0], -n_out[1], 0.0), mat)
            for side, z, nz in (('top', z1, 1), ('bottom', z0, -1)):
                if side in sides:
                    self.face([(ax, ay, z), (bx, by, z), (dx, dy, z), (cx, cy, z)], (0, 0, nz), mat)

    def finish(self, name, coll, mats, part='roof'):
        """메시·오브젝트로 만들어 컬렉션에 넣고 part 태그를 붙입니다 (법선은 만든 그대로 둠)."""
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for m in mats:
            mesh.materials.append(m)
        obj = bpy.data.objects.new(name, mesh)
        coll.objects.link(obj)
        obj['na_part'] = part
        return obj


# --- 회랑 천장 격자 배치 -------------------------------------------------------

def _cln_axis(centres, half):
    """한 축의 천장 구간 [(u0, u1, 등급)]. 등급 0 = 보·테두리, 1 = 리브, 2 = 우물.
    centres = 열주 축 좌표 (정렬), half = 처마 밑면 반폭 (그림자 홈 안쪽)."""
    hb, rw, n = CLN_BEAM_HW, CLN_RIB_W, CLN_COFFERS
    iv = [(-half, -half + CLN_EDGE_W, 0), (-half + CLN_EDGE_W, centres[0] - hb, 2)]
    for a, b in zip(centres, centres[1:]):
        iv.append((a - hb, a + hb, 0))
        cw = (b - a - 2 * hb - (n - 1) * rw) / n
        u = a + hb
        for k in range(n):
            iv.append((u, u + cw, 2))
            u += cw
            if k < n - 1:
                iv.append((u, u + rw, 1))
                u += rw
    iv.append((centres[-1] - hb, centres[-1] + hb, 0))
    iv.append((centres[-1] + hb, half - CLN_EDGE_W, 2))
    iv.append((half - CLN_EDGE_W, half, 0))
    return iv


def _cln_level(iv, u):
    """좌표 u 가 속한 구간의 등급 (구간 밖이면 0 = 보·테두리)."""
    for u0, u1, lv in iv:
        if u0 - 1e-6 <= u <= u1 + 1e-6:
            return lv
    return 0


def _cln_wall_band(iv, body_half):
    """본체 벽을 두르는 띠의 바깥 경계 = 벽 바로 밖 리브의 바깥 모서리 (좁은 우물 조각이 안 생기게)."""
    near = [u1 for (u0, u1, lv) in iv if lv == 1 and body_half - 1e-6 <= u0 < body_half + 1.5]
    return min(near) if near else body_half + 1.0


def _cln_soffit_layout():
    """천장 격자: 경계선 xs·ys, 칸 등급 함수 level(i, j) (None = 본체 위라 면 없음), 우물 중심 목록."""
    ex = L / 2 + ROOF_OVERHANG - CLN_REVEAL
    ey = W / 2 + ROOF_OVERHANG - CLN_REVEAL
    pts = column_positions()
    ivx = _cln_axis(sorted({round(x, 6) for x, _ in pts}), ex)
    ivy = _cln_axis(sorted({round(y, 6) for _, y in pts}), ey)
    bx, by = BODY_X / 2, BODY_Y / 2
    wbx, wby = _cln_wall_band(ivx, bx), _cln_wall_band(ivy, by)

    def breaks(iv, extra):
        us = sorted({round(u, 5) for (u0, u1, _) in iv for u in (u0, u1)} | {round(e, 5) for e in extra})
        return [u for k, u in enumerate(us) if k == 0 or u - us[k - 1] > 1e-4]

    xs = breaks(ivx, (-bx, bx, -wbx, wbx))
    ys = breaks(ivy, (-by, by, -wby, wby))

    def level_at(x, y):
        if abs(x) < bx and abs(y) < by:
            return None
        if abs(x) < wbx and abs(y) < wby:
            return 0
        return min(_cln_level(ivx, x), _cln_level(ivy, y))

    lv = [[level_at((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2) for j in range(len(ys) - 1)]
          for i in range(len(xs) - 1)]
    coffers = [((u0 + u1) / 2, (v0 + v1) / 2)
               for (u0, u1, a) in ivx if a == 2 for (v0, v1, b) in ivy if b == 2
               if level_at((u0 + u1) / 2, (v0 + v1) / 2) == 2]
    return {'xs': xs, 'ys': ys, 'level': lambda i, j: lv[i][j], 'coffers': coffers, 'ex': ex, 'ey': ey}


# --- 처마 슬래브 ---------------------------------------------------------------

def _cln_step(mb, axis, c, u0, u1, la, lb, zs):
    """이웃한 두 칸의 높이 차이만큼 수직 턱 (법선은 더 높은 = 움푹한 칸 쪽). 등급마다 나눠 T 접합을 피함."""
    if la is None or lb is None or la == lb:
        return
    sign = 1 if lb > la else -1
    for k in range(min(la, lb), max(la, lb)):
        mb.rect(axis, c, u0, u1, zs[k], zs[k + 1], sign, mat=1)


def _cln_soffit(mb, lay):
    """회랑 천장: 보(0)·리브(1)·우물(2) 세 높이의 격자 면과 그 사이 턱 (모두 아래를 향함, 재질 1).
    가장자리 그림자 홈의 수직면은 처마 석재(재질 0)."""
    xs, ys, lvl = lay['xs'], lay['ys'], lay['level']
    zs = [ROOF_Z0 + d for d in CLN_LV]
    nx, ny = len(xs) - 1, len(ys) - 1
    for i in range(nx):
        for j in range(ny):
            lv = lvl(i, j)
            if lv is None:
                continue
            mb.rect('z', zs[lv], xs[i], xs[i + 1], ys[j], ys[j + 1], -1, mat=1)
            if i + 1 < nx:
                _cln_step(mb, 'x', xs[i + 1], ys[j], ys[j + 1], lv, lvl(i + 1, j), zs)
            if j + 1 < ny:
                _cln_step(mb, 'y', ys[j + 1], xs[i], xs[i + 1], lv, lvl(i, j + 1), zs)
    # 처마 밑면 가장자리 그림자 홈의 안쪽 수직면 (격자 경계선마다 나눠 천장과 정점을 공유)
    z0, z1 = ROOF_Z0, ROOF_Z0 + CLN_REVEAL
    for j in range(ny):
        for s, i in ((-1, 0), (1, nx - 1)):
            mb.rect('x', s * lay['ex'], ys[j], ys[j + 1], z0 + CLN_LV[lvl(i, j)], z1, s)
    for i in range(nx):
        for s, j in ((-1, 0), (1, ny - 1)):
            mb.rect('y', s * lay['ey'], xs[i], xs[i + 1], z0 + CLN_LV[lvl(i, j)], z1, s)


def _cln_fascia_bottom(mb, lay, ox, oy, z):
    """처마 끝 띠의 밑면 (그림자 홈의 천장). 안쪽 모서리에 천장 격자 경계선마다 정점을 넣어
    홈 수직면 조각들과 정점을 공유합니다 (T 접합 없음 — 웹 뷰어에서 머리카락 틈이 안 생김)."""
    xs, ys, ex, ey = lay['xs'], lay['ys'], lay['ex'], lay['ey']
    for s in (-1, 1):
        mb.face([(s * ox, -oy, z), (s * ox, oy, z)] + [(s * ex, y, z) for y in reversed(ys)], (0, 0, -1))
        mb.face([(-ox, s * oy, z), (ox, s * oy, z)] + [(x, s * ey, z) for x in reversed(xs)], (0, 0, -1))


def _cln_eave(ctx, coll, lay):
    """처마 슬래브 하나: 천장 격자 + 그림자 홈 + 바깥 면 + 윗면 (옥상 바닥 높이)."""
    mb = _ClnMesh()
    _cln_soffit(mb, lay)
    ox, oy = L / 2 + ROOF_OVERHANG, W / 2 + ROOF_OVERHANG
    mb.ring((ox, oy), (lay['ex'], lay['ey']), ROOF_Z0 + CLN_REVEAL, ROOF_DECK_Z, ('out',))
    _cln_fascia_bottom(mb, lay, ox, oy, ROOF_Z0 + CLN_REVEAL)
    mb.rect('z', ROOF_DECK_Z, -ox, ox, -oy, oy, 1)
    return mb.finish('Roof_Eaves', coll, [ctx.mats['concrete'], _cln_soffit_mat(ctx)])


def _cln_downlights(ctx, coll, lay):
    """우물마다 가운데에 작은 원형 다운라이트 (밤에만 발광)."""
    bm = bmesh.new()
    z_ceil = ROOF_Z0 + CLN_LV[2]
    for (x, y) in lay['coffers']:
        _cln_disc(bm, x, y, z_ceil - CLN_LIGHT_H, z_ceil + 0.01, CLN_LIGHT_R, seg=8, top=False)
    mat = _cln_glow_mat(ctx, 'cln_downlight', 'Soffit_Downlight', (0.80, 0.80, 0.78),
                        (1.0, 0.80, 0.56), 30.0)
    return finish_mesh('Soffit_Downlights', bm, coll, mat, part='roof')


def _cln_led_strip(ctx, coll, lay):
    """처마 끝 그림자 홈 안의 가는 LED 띠 — 밤에 처마 윤곽이 따뜻한 선으로 보이게."""
    mb = _ClnMesh()
    ex, ey = lay['ex'], lay['ey']
    z0 = ROOF_Z0 + CLN_LED_Z
    mb.ring((ex + CLN_LED_D, ey + CLN_LED_D), (ex - 0.02, ey - 0.02), z0, z0 + CLN_LED_H,
            ('out', 'top', 'bottom'))
    mat = _cln_glow_mat(ctx, 'cln_led', 'Eave_LED', (0.55, 0.55, 0.54), (1.0, 0.74, 0.45), 8.0)
    return mb.finish('Eave_LED_Strip', coll, [mat])


# --- 파라펫과 옥상 -------------------------------------------------------------

def _cln_parapet(ctx, coll):
    """처마 끝에서 조금 들인 민무늬 파라펫과 얇은 갓돌 (윗면 = ROOF_TOP)."""
    mb = _ClnMesh()
    px, py = L / 2 + ROOF_OVERHANG - CLN_PARAPET_SET, W / 2 + ROOF_OVERHANG - CLN_PARAPET_SET
    t, zc = CLN_PARAPET_T, ROOF_TOP - CLN_COPING_H
    mb.ring((px, py), (px - t, py - t), ROOF_DECK_Z, zc, ('out', 'in'))
    co = CLN_COPING_OUT
    mb.ring((px + co, py + co), (px - t - co, py - t - co), zc, ROOF_TOP, ('out', 'in', 'top', 'bottom'))
    return mb.finish('Roof_Parapet', coll, [ctx.mats['concrete']])


def _cln_roof_inner():
    """파라펫 안쪽 면의 반폭 (ix, iy) — 옥상 방수층·통로·설비 배치의 기준."""
    return (L / 2 + ROOF_OVERHANG - CLN_PARAPET_SET - CLN_PARAPET_T,
            W / 2 + ROOF_OVERHANG - CLN_PARAPET_SET - CLN_PARAPET_T)


def _cln_cross_walks(ix):
    """양 끝 가로 통로 두 개의 발자국 [(x0, x1, y0, y1)] (돔 여유 반지름 밖 → 가장자리 통로 고리)."""
    edge = ix - CLN_WALK_GAP - CLN_WALK_W
    return [tuple(sorted((s * (CLN_DOME_CLEAR + 0.5), s * edge))) + (-CLN_WALK_CROSS, CLN_WALK_CROSS)
            for s in (-1, 1)]


def _cln_deck(ctx, coll):
    """옥상 방수층 (파라펫 속까지 깔림)과 관리 통로 (가장자리 고리 + 양 끝 가로 통로)."""
    ix, iy = _cln_roof_inner()
    zt = ROOF_DECK_Z + CLN_DECK_T
    mb = _ClnMesh()
    mb.rect('z', zt, -ix - 0.1, ix + 0.1, -iy - 0.1, iy + 0.1, 1)
    mb.finish('Roof_Deck', coll, [_cln_membrane_mat(ctx)])
    mb = _ClnMesh()
    g, w, h = CLN_WALK_GAP, CLN_WALK_W, CLN_WALK_H
    mb.ring((ix - g, iy - g), (ix - g - w, iy - g - w), zt, zt + h, ('out', 'in', 'top'))
    for (x0, x1, y0, y1) in _cln_cross_walks(ix):
        mb.box(x0, x1, y0, y1, zt, zt + h)
    mb.finish('Roof_Walkways', coll, [ctx.mats['concrete']])


# --- 옥상 설비 배치 -------------------------------------------------------------

def _cln_unit_candidates(ix, iy):
    """설비 후보 [(종류, 중심 x, 중심 y, 발자국 (x0, x1, y0, y1))]. 모두 파라펫 안쪽 면·돔 여유 반지름 기준.
    종류: 'ahu' 공조기 (받침대 포함 발자국), 'pent' 앞쪽 계단 옥탑 (문 포함), 'sky' 박공 천창."""
    ax, ay, _ = CLN_AHU_SIZE
    px, py, _ = CLN_PENT_SIZE
    sx, sy = CLN_SKY_SIZE
    hx, hy = ax / 2 + CLN_AHU_PAD, ay / 2 + CLN_AHU_PAD
    out = []
    for s in (-1, 1):
        for t in (-1, 1):
            cx, cy = s * (ix - CLN_AHU_IN[0]), t * (iy - CLN_AHU_IN[1])
            out.append(('ahu', cx, cy, (cx - hx, cx + hx, cy - hy, cy + hy)))
        cx, y0 = s * (ix - CLN_PENT_IN[0]), -(iy - CLN_PENT_IN[1])
        out.append(('pent', cx, y0 + py / 2, (cx - px / 2, cx + px / 2, y0, y0 + py + 0.1)))
        for k in range(CLN_SKY_N):
            cx = s * (CLN_DOME_CLEAR + CLN_SKY_START + CLN_SKY_PITCH * k)
            for t in (-1, 1):
                cy = t * CLN_SKY_Y
                out.append(('sky', cx, cy, (cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2)))
    return out


def _cln_unit_fits(rect, lim_x, lim_y, taken):
    """발자국이 통로 고리 안쪽(|x| ≤ lim_x, |y| ≤ lim_y), 돔 여유 반지름 밖이고
    이미 차지한 자리(가로 통로·다른 설비)와 CLN_UNIT_CLEAR 이상 떨어져 있는지."""
    x0, x1, y0, y1 = rect
    if x0 < -lim_x or x1 > lim_x or y0 < -lim_y or y1 > lim_y:
        return False
    nx, ny = min(max(0.0, x0), x1), min(max(0.0, y0), y1)      # 발자국에서 돔 중심에 가장 가까운 점
    if math.hypot(nx, ny) < CLN_DOME_CLEAR:
        return False
    c = CLN_UNIT_CLEAR
    return all(x1 + c <= a0 or a1 + c <= x0 or y1 + c <= b0 or b1 + c <= y0 for (a0, a1, b0, b1) in taken)


def _cln_unit_slots():
    """자리가 있는 설비만 골라 [(종류, cx, cy)] 로 돌려줍니다 (지붕이 작으면 들어가지 않는 설비는 빠짐)."""
    ix, iy = _cln_roof_inner()
    edge = CLN_WALK_GAP + CLN_WALK_W + CLN_UNIT_CLEAR
    taken = _cln_cross_walks(ix)
    slots = []
    for kind, cx, cy, rect in _cln_unit_candidates(ix, iy):
        if _cln_unit_fits(rect, ix - edge, iy - edge, taken):
            taken.append(rect)
            slots.append((kind, cx, cy))
    return slots


# --- 옥상 설비 형상 ---------------------------------------------------------------

def _cln_skylight(mb, cx, cy, zb, mat_curb, mat_glass):
    """X 방향 용마루의 박공형 천창: 낮은 턱 위 유리 경사면."""
    sx, sy = CLN_SKY_SIZE
    curb = 0.45
    mb.box(cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, zb, zb + curb, mat_curb)
    z0, z1 = zb + curb, zb + curb + 0.35 * sy
    x0, x1, y0, y1 = cx - sx / 2 + 0.1, cx + sx / 2 - 0.1, cy - sy / 2 + 0.1, cy + sy / 2 - 0.1
    for s, ye in ((-1, y0), (1, y1)):
        mb.face([(x0, ye, z0), (x1, ye, z0), (x1, cy, z1), (x0, cy, z1)], (0, s, 1), mat_glass)
    for s, xe in ((-1, x0), (1, x1)):
        mb.face([(xe, y0, z0), (xe, y1, z0), (xe, cy, z1)], (s, 0, 0), mat_glass)


def _cln_ahu(mb, fans, cx, cy, zb):
    """공조기 한 대: 콘크리트 받침대 위 금속 함체, 윗면에 팬 덮개 3개 (함체 윗면에 2 cm 묻힘)."""
    ax, ay, ah = CLN_AHU_SIZE
    p = CLN_AHU_PAD
    mb.box(cx - ax / 2, cx + ax / 2, cy - ay / 2, cy + ay / 2, zb, zb + ah, 0)
    mb.box(cx - ax / 2 - p, cx + ax / 2 + p, cy - ay / 2 - p, cy + ay / 2 + p, zb, zb + 0.25, 1)
    for k in (-1, 0, 1):
        _cln_disc(fans, cx + CLN_FAN_PITCH * k, cy, zb + ah - 0.02, zb + ah + 0.18, CLN_FAN_R, seg=16)


def _cln_penthouse(mb, cx, cy, zb):
    """계단·승강기 옥탑: 콘크리트 상자, 돔 쪽(+Y) 면에 금속 문."""
    px, py, ph = CLN_PENT_SIZE
    mb.box(cx - px / 2, cx + px / 2, cy - py / 2, cy + py / 2, zb, zb + ph, 1)
    mb.box(cx - 1.0, cx + 1.0, cy + py / 2, cy + py / 2 + 0.1, zb, zb + 2.1, 0)


def _cln_roof_units(ctx, coll):
    """양 끝의 설비: 공조기(팬 덮개 포함), 계단·승강기 옥탑, 박공 천창 (밤에도 발광 없음 — 멀리서 본
    밤 실루엣은 처마 LED 선이 윗선이 되게). 모두 파라펫 높이보다 낮게."""
    zb = ROOF_DECK_Z + CLN_DECK_T - 0.01
    mb = _ClnMesh()                                  # 재질: 0 공조기, 1 콘크리트, 2 유리
    fans = bmesh.new()
    for kind, cx, cy in _cln_unit_slots():
        if kind == 'ahu':
            _cln_ahu(mb, fans, cx, cy, zb)
        elif kind == 'pent':
            _cln_penthouse(mb, cx, cy, zb)
        else:
            _cln_skylight(mb, cx, cy, zb, 1, 2)
    unit = _cln_unit_mat(ctx)
    glass = ctx.material('cln_skylight', lambda: new_pbr('Roof_Skylight', (0.03, 0.045, 0.055), 0.08)[0])
    mb.finish('Roof_Equipment', coll, [unit, ctx.mats['concrete'], glass])
    fan = ctx.material('cln_fan', lambda: new_pbr('Roof_Fan', (0.10, 0.105, 0.11), 0.5, 0.6)[0])
    finish_mesh('Roof_Fans', fans, coll, fan, part='roof')


# --- 재질 (섹션 전용) ----------------------------------------------------------

def _cln_glow_mat(ctx, key, name, day_color, glow, strength):
    """낮에는 옅은 회색 기구, 밤에는 따뜻하게 빛나는 재질."""
    def make():
        return new_pbr(name, day_color, 0.4, 0.0,
                       emission=glow if ctx.night else None,
                       emission_strength=strength if ctx.night else 0.0)[0]
    return ctx.material(key, make)


def _cln_soffit_mat(ctx):
    """회랑 천장 마감: 처마 석재와 같은 대표색의 매끈한 도장 면. 석재 판 줄눈이 우물 격자와 엇갈리지 않게
    줄눈 없이 큰 얼룩과 고운 결만 둡니다."""
    def make():
        flat = ctx.mats['concrete'].get('na_flat')
        base = tuple(flat['color']) if flat is not None else (0.62, 0.60, 0.55)
        mat, nt, bsdf = new_pbr('Soffit_Finish', base, 0.82)
        tc = node(nt, 'ShaderNodeTexCoord')
        big = node(nt, 'ShaderNodeTexNoise', Scale=0.09, Detail=3.0, Roughness=0.5)
        link(nt, tc.outputs['Object'], big.inputs['Vector'])
        col = mix_color(nt, big.outputs['Factor'], tuple(c * 0.95 for c in base), tuple(c * 1.05 for c in base))
        link(nt, col, bsdf.inputs['Base Color'])
        fine = node(nt, 'ShaderNodeTexNoise', Scale=9.0, Detail=2.0)
        link(nt, tc.outputs['Object'], fine.inputs['Vector'])
        bump = node(nt, 'ShaderNodeBump', Strength=0.04, Distance=0.02)
        link(nt, fine.outputs['Factor'], bump.inputs['Height'])
        link(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])
        return mat
    return ctx.material('cln_soffit', make)


def _cln_unit_mat(ctx):
    """옥상 공조기 함체·옥탑 문: 도장한 회색 금속."""
    return ctx.material('cln_unit', lambda: new_pbr('Roof_Units', (0.40, 0.42, 0.43), 0.45, 0.3)[0])


def _cln_membrane_mat(ctx):
    """옥상 방수 시트: 차분한 청회색 (항공사진 추정), 1.8 m 폭 시트 이음선과 얼룩."""
    def make():
        base = (0.155, 0.172, 0.190)
        mat, nt, bsdf = new_pbr('Roof_Membrane', base, 0.85)
        tc = node(nt, 'ShaderNodeTexCoord')
        sep = node(nt, 'ShaderNodeSeparateXYZ')
        link(nt, tc.outputs['Object'], sep.inputs['Vector'])
        div = node(nt, 'ShaderNodeMath', operation='DIVIDE')
        link(nt, sep.outputs['Y'], div.inputs[0])
        div.inputs[1].default_value = 1.8
        frac = node(nt, 'ShaderNodeMath', operation='FRACT')
        link(nt, div.outputs['Value'], frac.inputs[0])
        seam = node(nt, 'ShaderNodeMath', operation='LESS_THAN')
        link(nt, frac.outputs['Value'], seam.inputs[0])
        seam.inputs[1].default_value = 0.025
        nz = node(nt, 'ShaderNodeTexNoise', Scale=0.12, Detail=5.0, Roughness=0.6)
        link(nt, tc.outputs['Object'], nz.inputs['Vector'])
        col = mix_color(nt, nz.outputs['Factor'], tuple(c * 0.8 for c in base),
                        tuple(c * 1.2 for c in base))
        col = mix_color(nt, seam.outputs['Value'], col, tuple(c * 0.6 for c in base))
        link(nt, col, bsdf.inputs['Base Color'])
        return mat
    return ctx.material('cln_membrane', make)


def build_roof(ctx):
    """처마 슬래브(회랑 천장 포함), 다운라이트, LED 띠, 파라펫, 옥상 방수층·통로·설비."""
    coll = ctx.coll('Roof')
    lay = _cln_soffit_layout()
    _cln_eave(ctx, coll, lay)
    _cln_downlights(ctx, coll, lay)
    _cln_led_strip(ctx, coll, lay)
    _cln_parapet(ctx, coll)
    _cln_deck(ctx, coll)
    _cln_roof_units(ctx, coll)


# ----------------------------------------------------------------------------
# 돔 — 받침 원통(드럼)과 코니스·발치 포장 띠, 구면 캡 돔 셸(밑지름 64 m, 높이 20 m), 동판 스탠딩 심,
#       돔 발치 동판 띠, 꼭대기의 작은 원형 캡, 피뢰침. 녹청 재질(얼룩·빗물 자국·판별 톤·판 부풂 범프).
#
# 근거: 밑지름 64 m · 높이 20 m (라이즈/스팬 0.31 → 반구가 아닌 낮은 구면 캡, 구 반지름 약 35.6 m,
#   스프링 라인에서 수평과 약 64°), 앵글 철골 위 동판 마감, 붉은 구리(1975) → 회녹·민트색 녹청.
# 사진 기억(낮은 확신): 굵은 리브가 아니라 촘촘한 자오선 방향 스탠딩 심, 뚜렷한 가로 띠 없음,
#   랜턴·큐폴라 없음(꼭대기에 지름 2~3 m 의 낮은 원형 캡 정도), 파라펫 뒤 옥상에서 올라오는 짧은 원통.
#   심 수(128)·동판 길이·드럼 띠·코니스 단면·발치 포장 띠는 추정입니다.
# ----------------------------------------------------------------------------
DOME_R_SPH = ((DOME_D / 2) ** 2 + DOME_H ** 2) / (2 * DOME_H)   # 35.6  구면 반지름
DOME_CZ = TOTAL_H - DOME_R_SPH                                  # 33.59 구 중심 높이
DOME_TH_EDGE = math.asin(DOME_D / 2 / DOME_R_SPH)               # 스프링 라인 극각 (연직에서 약 64°)
DOME_SEGMENTS = 256        # 셸·드럼 둘레 분할 (클로즈업에서도 매끈한 실루엣)
DOME_RINGS = 80            # 셸 위도 분할 (약 0.8° 간격)
DOME_SEAMS = 128           # 스프링 라인의 스탠딩 심 수 (간격 약 1.57 m)
DOME_SEAM_DROP_R = (22.6, 11.3, 5.66)   # 수평 반지름이 이보다 작아지면 심을 하나 걸러 끝냄 (128→64→32→16)
DOME_SEAM_W = 0.12         # 심 폭 (실제 25 mm 보다 과장 — 1920 px 렌더에서 읽히도록)
DOME_SEAM_H = 0.085        # 심 높이 (셸 면 위)
DOME_SEAM_STEP = math.radians(1.2)   # 심이 구면을 따라가는 분할 각 (처짐 2 mm)
DOME_SEAM_TAPER = 1.0      # 중간에 끝나는 심이 셸 속으로 접혀 들어가는 길이 (m)
# 심 단면 (폭 비율, 높이 비율) — 셸 속 3 cm 에서 시작해 윗단이 둥근 핀
DOME_SEAM_PROFILE = ((-0.5, -0.35), (-0.42, 0.62), (-0.2, 1.0), (0.2, 1.0), (0.42, 0.62), (0.5, -0.35))
DOME_SHEET_L = 2.8         # 동판 한 장의 자오선 방향 길이 (가로 이음 간격, 셰이더)
DOME_PILLOW = 0.010        # 심 사이 판이 부푼 높이 (m, 셰이더 범프 — 오일 캐닝)
DOME_STREAK_FREQ = 34.0    # 빗물 자국의 방위 방향 촘촘함 (둘레 약 200줄)
DOME_CROWN_R = 1.4         # 꼭대기 원형 캡 반지름 (지름 2.8 m)
DOME_COLLAR_R = 1.75       # 심이 끝나는 꼭대기 칼라 링 반지름
DOME_DRUM_BASE_Z = ROOF_DECK_Z - 0.5            # 드럼 밑면 (처마 슬래브 속에 묻음)
DOME_APRON_R = DRUM_R + 2.9  # 드럼 발치 돌 포장 띠 바깥 반지름 (지붕 섹션이 비워 두는 반지름 36 m 안)
DOME_APRON_H = 0.10        # 포장 띠 윗면이 옥상 바닥보다 높은 값 (m)
DOME_STONE_BLOCKS = 140    # 드럼 한 바퀴 석재 판 수 (판 폭 약 1.48 m, 둘레에 딱 맞음)
DOME_STONE_ROW = 0.90      # 드럼 석재 줄눈 간격 (m, 받침단 윗선 DRUM_Z0 에 줄눈이 맞음)


# --- 구면 좌표 도우미 -------------------------------------------------------------

def _dome_th_at_r(r):
    """수평 반지름 r 인 구면 점의 극각 (연직에서 잰 각)."""
    return math.asin(r / DOME_R_SPH)


def _dome_th_at_z(z):
    """높이 z 인 구면 점의 극각."""
    return math.acos((z - DOME_CZ) / DOME_R_SPH)


def _dome_z_at_r(r):
    """구면 캡에서 수평 반지름 r 인 곳의 높이."""
    return DOME_CZ + math.sqrt(DOME_R_SPH ** 2 - r * r)


def _dome_pt(th, ph, lift=0.0, side=0.0):
    """극각 th · 방위각 ph 의 구면 점에서 법선 방향으로 lift, 방위각 증가 방향으로 side 만큼 옮긴 점."""
    rr = DOME_R_SPH + lift
    st = math.sin(th)
    return (rr * st * math.cos(ph) - side * math.sin(ph),
            rr * st * math.sin(ph) + side * math.cos(ph),
            DOME_CZ + rr * math.cos(th))


def _dome_srgb(hexstr):
    """'#RRGGBB' (sRGB) → 선형 RGB 튜플 (재질 Base Color 는 선형값)."""
    out = []
    for i in (1, 3, 5):
        c = int(hexstr[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def _dome_lathe(bm, profile, sharp_deg=25.0):
    """회전체(bm_lathe, 뚜껑 없음) + 모든 면 스무스, 윤곽이 sharp_deg 이상 꺾이는 링은 sharp 모서리."""
    rings = bm_lathe(bm, profile, segments=DOME_SEGMENTS, cap_bottom=False, cap_top=False)
    for i in range(1, len(profile) - 1):
        (r0, z0), (r1, z1), (r2, z2) = profile[i - 1], profile[i], profile[i + 1]
        turn = math.atan2(z2 - z1, r2 - r1) - math.atan2(z1 - z0, r1 - r0)
        turn = abs((turn + math.pi) % (2 * math.pi) - math.pi)
        if math.degrees(turn) > sharp_deg and len(rings[i]) > 1:
            ring = rings[i]
            for k in range(len(ring)):
                e = bm.edges.get((ring[k], ring[(k + 1) % len(ring)]))
                if e is not None:
                    e.smooth = False
    for f in bm.faces:
        f.smooth = True
    return rings


# --- 재질 -------------------------------------------------------------------------

def _dome_math(nt, op, a, b=None):
    """Math 노드 하나. a/b 는 소켓 또는 값. 출력 소켓을 돌려줍니다."""
    m = nt.nodes.new('ShaderNodeMath')
    m.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if hasattr(v, 'is_output'):
            nt.links.new(v, m.inputs[i])
        else:
            m.inputs[i].default_value = v
    return m.outputs[0]


def _dome_remap(nt, value, f0, f1, t0=0.0, t1=1.0):
    """Map Range (clamp) — value 를 [f0, f1] → [t0, t1] 로."""
    m = node(nt, 'ShaderNodeMapRange', From_Min=f0, From_Max=f1, To_Min=t0, To_Max=t1)
    link(nt, value, m.inputs['Value'])
    return m.outputs['Result']


def _dome_noise(nt, vec, scale, detail=4.0, rough=0.55, distortion=0.0):
    """Noise Texture 의 흑백 Factor 소켓 (Color 출력은 색이 섞여 쓰지 않음)."""
    n = node(nt, 'ShaderNodeTexNoise', Scale=scale, Detail=detail, Roughness=rough, Distortion=distortion)
    link(nt, vec, n.inputs['Vector'])
    return n.outputs['Factor']


def _dome_polar(nt):
    """Object(=월드) 좌표에서 돔 구면 좌표 소켓들: pos, th(극각), s(꼭대기에서 잰 호 길이),
    rh(수평 반지름), dirv(수평 방향 단위벡터 — atan2 이음매 없이 방위를 나타냄), phi."""
    tc = node(nt, 'ShaderNodeTexCoord')
    pos = tc.outputs['Object']
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    link(nt, pos, sep.inputs['Vector'])
    hor = node(nt, 'ShaderNodeCombineXYZ')
    link(nt, sep.outputs['X'], hor.inputs['X'])
    link(nt, sep.outputs['Y'], hor.inputs['Y'])
    ln = node(nt, 'ShaderNodeVectorMath', operation='LENGTH')
    link(nt, hor.outputs['Vector'], ln.inputs[0])
    nrm = node(nt, 'ShaderNodeVectorMath', operation='NORMALIZE')
    link(nt, hor.outputs['Vector'], nrm.inputs[0])
    rh = ln.outputs['Value']
    th = _dome_math(nt, 'ARCTAN2', rh, _dome_math(nt, 'SUBTRACT', sep.outputs['Z'], DOME_CZ))
    return {'pos': pos, 'z': sep.outputs['Z'], 'rh': rh, 'th': th,
            'phi': _dome_math(nt, 'ARCTAN2', sep.outputs['Y'], sep.outputs['X']),
            's': _dome_math(nt, 'MULTIPLY', th, DOME_R_SPH), 'dirv': nrm.outputs['Vector']}


def _dome_rand(nt, a, b, c):
    """정수 id (a, b, c) → 0..1 난수 소켓 3개 (판·동판마다 고정된 값)."""
    ids = node(nt, 'ShaderNodeCombineXYZ')
    for sock, v in zip(('X', 'Y', 'Z'), (a, b, c)):
        if hasattr(v, 'is_output'):
            link(nt, v, ids.inputs[sock])
        else:
            ids.inputs[sock].default_value = v
    wn = node(nt, 'ShaderNodeTexWhiteNoise', noise_dimensions='3D')
    link(nt, ids.outputs['Vector'], wn.inputs['Vector'])
    sc = node(nt, 'ShaderNodeSeparateColor')
    link(nt, wn.outputs['Color'], sc.inputs['Color'])
    return sc.outputs['Red'], sc.outputs['Green'], sc.outputs['Blue']


def _dome_panels(nt, pc):
    """심 사이 동판 띠(판) 단위 값. 판 폭 = 심 간격 (위도에 따라 128→64→32→16 칸).
    반환 dict: t(판 가로 위치 -1..1, 심에서 ±1), dist(가장 가까운 심까지 m), half_w(판 반폭 m),
    rowf(동판 세로 위치 -1..1), joint(가로 이음 선 0..1), sheet(동판 한 장 난수), prand(판 난수 3개)."""
    k = 0.0
    for r in DOME_SEAM_DROP_R:
        k = _dome_math(nt, 'ADD', k, _dome_math(nt, 'LESS_THAN', pc['rh'], r))
    count = _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'POWER', 0.5, k), float(DOME_SEAMS))
    u = _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'ADD', pc['phi'], math.pi),
                                              1.0 / (2 * math.pi)), count)
    pan = _dome_math(nt, 'FLOOR', u)
    t = _dome_math(nt, 'SUBTRACT', _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'FRACT', u), 2.0), 1.0)
    half_w = _dome_math(nt, 'DIVIDE', _dome_math(nt, 'MULTIPLY', pc['rh'], math.pi), count)
    dist = _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'SUBTRACT', 1.0, _dome_math(nt, 'ABSOLUTE', t)), half_w)
    # 가로 이음: 동판 길이 DOME_SHEET_L 마다, 이웃 판과 반 장씩 엇갈림
    row = _dome_math(nt, 'ADD', _dome_math(nt, 'DIVIDE', pc['s'], DOME_SHEET_L),
                     _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'MODULO', pan, 2.0), 0.5))
    rowf = _dome_math(nt, 'SUBTRACT', _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'FRACT', row), 2.0), 1.0)
    jd = _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'SUBTRACT', 1.0, _dome_math(nt, 'ABSOLUTE', rowf)),
                    DOME_SHEET_L / 2)
    return {'t': t, 'dist': dist, 'rowf': rowf, 'half_w': half_w,
            'joint': _dome_remap(nt, jd, 0.006, 0.03, 1.0, 0.0),
            'sheet': _dome_rand(nt, pan, _dome_math(nt, 'FLOOR', row), k)[0],
            'prand': _dome_rand(nt, pan, 17.0, k)}


def _dome_streaks(nt, pc):
    """자오선 방향으로 흘러내린 빗물 자국 노이즈 0..1 (방위 방향으로 촘촘, 극각 방향으로 긺)."""
    sv = node(nt, 'ShaderNodeVectorMath', operation='SCALE')
    link(nt, pc['dirv'], sv.inputs[0])
    sv.inputs['Scale'].default_value = DOME_STREAK_FREQ
    lat = node(nt, 'ShaderNodeCombineXYZ')
    link(nt, _dome_math(nt, 'MULTIPLY', pc['th'], 2.2), lat.inputs['Z'])
    add = node(nt, 'ShaderNodeVectorMath', operation='ADD')
    link(nt, sv.outputs['Vector'], add.inputs[0])
    link(nt, lat.outputs['Vector'], add.inputs[1])
    return _dome_noise(nt, add.outputs['Vector'], 1.0, detail=2.0, rough=0.45, distortion=0.15)


def _dome_patina_color(nt, pc, pn):
    """녹청 색: 큰 얼룩 + 중간 얼룩 + 빗물 자국 + (판) 판·동판별 톤 차이, 심 옆 때, 가로 이음.
    pn 은 _dome_panels 결과 (심 재질은 None). 반환: (색 소켓, 빗물 자국 강도 소켓)"""
    lo, mid, hi = _dome_srgb('#76978a'), _dome_srgb('#8bab9f'), _dome_srgb('#a6c2b8')
    blot = _dome_noise(nt, pc['pos'], 0.045, detail=5.0, rough=0.6, distortion=0.4)
    col = node(nt, 'ShaderNodeValToRGB')
    link(nt, blot, col.inputs['Factor'])
    els = col.color_ramp.elements
    els[0].position, els[0].color = 0.32, (*lo, 1.0)
    els[1].position, els[1].color = 0.68, (*hi, 1.0)
    els.new(0.5).color = (*mid, 1.0)
    c = mix_color(nt, 0.10, col.outputs['Color'], _dome_noise(nt, pc['pos'], 0.9, detail=3.0), blend='OVERLAY')
    mott = _dome_noise(nt, pc['pos'], 0.28, detail=3.0, rough=0.5, distortion=0.6)
    c = mix_color(nt, 0.16, c, mott, blend='OVERLAY')
    st = _dome_streaks(nt, pc)
    low = _dome_remap(nt, pc['th'], 0.25, DOME_TH_EDGE, 0.3, 1.0)       # 아래(가파른 곳)일수록 자국이 짙음
    low = _dome_math(nt, 'MULTIPLY', low, _dome_remap(nt, pc['th'], 0.06, 0.30))   # 평평한 꼭대기엔 자국 없음
    dark = _dome_math(nt, 'MULTIPLY', _dome_remap(nt, st, 0.56, 0.74), low)
    if pn is not None:                                                  # 빗물은 심 사이 판을 따라 흐름
        dark = _dome_math(nt, 'MULTIPLY', dark, _dome_remap(nt, pn['prand'][2], 0.0, 1.0, 0.35, 1.25))
    light = _dome_math(nt, 'MULTIPLY', _dome_remap(nt, st, 0.40, 0.28), _dome_remap(nt, pc['th'], 0.06, 0.30, 0.0, 0.45))
    c = mix_color(nt, dark, c, _dome_srgb('#648175'))
    c = mix_color(nt, light, c, _dome_srgb('#b8ccc3'))
    foot = _dome_remap(nt, pc['z'], DOME_Z0 + 2.2, DOME_Z0 + 0.2, 0.0, 0.3)   # 발치: 빗물이 모여 어두움
    c = mix_color(nt, foot, c, _dome_srgb('#687870'))
    if pn is None:
        hs = node(nt, 'ShaderNodeHueSaturation', Value=1.06, Saturation=0.92)
        link(nt, c, hs.inputs['Color'])
        return hs.outputs['Color'], dark
    tone = _dome_math(nt, 'ADD', _dome_math(nt, 'MULTIPLY', pn['sheet'], 0.05),
                      _dome_math(nt, 'MULTIPLY', pn['prand'][0], 0.04))
    hs = node(nt, 'ShaderNodeHueSaturation')
    link(nt, c, hs.inputs['Color'])
    link(nt, _dome_math(nt, 'ADD', tone, 0.955), hs.inputs['Value'])
    link(nt, _dome_math(nt, 'SUBTRACT', 1.04, _dome_math(nt, 'MULTIPLY', pn['sheet'], 0.08)), hs.inputs['Saturation'])
    grime = _dome_remap(nt, pn['dist'], 0.06, 0.30, 0.16, 0.0)          # 심 발치에 낀 때 (먼 거리에서 심이 읽히게)
    c = mix_color(nt, grime, hs.outputs['Color'], _dome_srgb('#5e776b'))
    c = mix_color(nt, _dome_math(nt, 'MULTIPLY', pn['joint'], 0.3), c, _dome_srgb('#556c61'))
    return c, dark


def _dome_pillow(nt, pn):
    """판이 심 사이에서 살짝 부푼 높이 (m). 판마다 부푼 정도·치우침이 달라 햇빛에 판이 한 장씩 다른 결로
    보입니다 (오일 캐닝). 심에서 0, 가로 이음에서는 양쪽이 같은 값이라 범프에 경계 선이 생기지 않습니다."""
    t = pn['t']
    amp = _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'ADD', 0.55, _dome_math(nt, 'MULTIPLY', pn['prand'][0], 0.9)),
                     DOME_PILLOW)
    amp = _dome_math(nt, 'MULTIPLY', amp, _dome_remap(nt, pn['half_w'], 0.0, 0.8))   # 꼭대기의 좁은 판은 덜 부풂
    skew = _dome_math(nt, 'ADD', 1.0, _dome_math(nt, 'MULTIPLY', t, _dome_remap(nt, pn['prand'][1], 0.0, 1.0, -0.7, 0.7)))
    across = _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'SUBTRACT', 1.0, _dome_math(nt, 'MULTIPLY', t, t)), skew)
    along = _dome_math(nt, 'SUBTRACT', 1.0, _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'MULTIPLY', pn['rowf'], pn['rowf']), 0.35))
    return _dome_math(nt, 'MULTIPLY', _dome_math(nt, 'MULTIPLY', across, along), amp)


def _dome_patina_mat(name, seam=False):
    """풍화된 동판 녹청 (민트 회녹색, sRGB #7FA898~#95B5AE 근처 — 하늘빛에 채도가 올라가므로 조금 낮춰 둠). seam=True 는 심용(조금 밝고 판 무늬 없음).
    GLB 대표색 = 렌더에서 보이는 평균색."""
    flat = _dome_srgb('#94b3a6') if seam else _dome_srgb('#8aaa9d')
    mat, nt, bsdf = new_pbr(name, flat, 0.52, 0.15)
    pc = _dome_polar(nt)
    pn = None if seam else _dome_panels(nt, pc)
    col, streak = _dome_patina_color(nt, pc, pn)
    link(nt, col, bsdf.inputs['Base Color'])
    rough = _dome_math(nt, 'ADD', 0.46, _dome_math(nt, 'MULTIPLY', streak, 0.14))
    rough = _dome_math(nt, 'ADD', rough, _dome_math(nt, 'MULTIPLY', _dome_noise(nt, pc['pos'], 0.3), 0.08))
    link(nt, rough, bsdf.inputs['Roughness'])
    height = _dome_math(nt, 'MULTIPLY', _dome_noise(nt, pc['pos'], 2.5, detail=2.0), 0.25)
    if pn is not None:
        height = _dome_math(nt, 'SUBTRACT', height, pn['joint'])
    bump = node(nt, 'ShaderNodeBump', Strength=0.3, Distance=0.01)
    link(nt, height, bump.inputs['Height'])
    normal = bump.outputs['Normal']
    if pn is not None:                        # 판 부풂은 실제 치수(m) 그대로: Distance 1, Strength 1
        pb = node(nt, 'ShaderNodeBump', Strength=1.0, Distance=1.0)
        link(nt, _dome_pillow(nt, pn), pb.inputs['Height'])
        link(nt, normal, pb.inputs['Normal'])
        normal = pb.outputs['Normal']
    link(nt, normal, bsdf.inputs['Normal'])
    return mat


def _dome_scale_z(nt, vec, sz):
    """벡터의 z 만 sz 배 (세로로 긴 노이즈 → 빗물 자국)."""
    vm = node(nt, 'ShaderNodeVectorMath', operation='MULTIPLY')
    link(nt, vec, vm.inputs[0])
    vm.inputs[1].default_value = (1.0, 1.0, sz)
    return vm.outputs['Vector']


def _dome_stone_base(ctx):
    """드럼 석재 대표색 = 공유 'concrete'(처마·파라펫 회백색 석재)의 평평한 대표색 — 재질 섹션이 색을 바꿔도
    드럼이 처마와 같은 돌로 보이게 합니다."""
    flat = ctx.mats['concrete'].get('na_flat') if 'concrete' in ctx.mats else None
    if flat is None:
        return (0.80, 0.795, 0.765)
    return tuple(min(1.0, c * 0.97) for c in list(flat['color'])[:3])


def _dome_stone_joints(nt, sep):
    """드럼 석재 줄눈 (1 = 줄눈). 원통 둘레 호 길이(방위각 x DRUM_R)와 높이로 판을 맞추고,
    코니스 위쪽은 세로 줄눈만. 둘레에 DOME_STONE_BLOCKS 장이 딱 맞아 atan2 이음매가 줄눈과 겹칩니다."""
    phi = _dome_math(nt, 'ARCTAN2', sep.outputs['Y'], sep.outputs['X'])
    uv = node(nt, 'ShaderNodeCombineXYZ')
    link(nt, _dome_math(nt, 'MULTIPLY', phi, DRUM_R), uv.inputs['X'])
    link(nt, _dome_math(nt, 'SUBTRACT', sep.outputs['Z'], DRUM_Z0), uv.inputs['Y'])
    width = 2 * math.pi * DRUM_R / DOME_STONE_BLOCKS
    joints = []
    for row_h in (DOME_STONE_ROW, 50.0):
        br = node(nt, 'ShaderNodeTexBrick', offset=0.5, offset_frequency=2, Scale=1.0, Mortar_Size=0.01,
                  Mortar_Smooth=0.3, Brick_Width=width, Row_Height=row_h)
        link(nt, uv.outputs['Vector'], br.inputs['Vector'])
        joints.append(br.outputs['Factor'])
    upper = _dome_math(nt, 'GREATER_THAN', sep.outputs['Z'], DOME_Z0 - 1.45)
    return _dome_math(nt, 'MAXIMUM', _dome_math(nt, 'MULTIPLY', joints[0], _dome_math(nt, 'SUBTRACT', 1.0, upper)),
                      _dome_math(nt, 'MULTIPLY', joints[1], upper))


def _dome_stone_mat(base):
    """드럼 석재: 처마·파라펫과 같은 밝은 회백색 돌. 얼룩 + 반점 + 세로 빗물 때 + 줄눈, 그리고
    돔에서 흘러내린 빗물이 코니스와 드럼 윗부분에 남긴 옅은 녹청 자국."""
    mat, nt, bsdf = new_pbr('Dome_Drum_Stone', base, 0.72, 0.0)
    pos = node(nt, 'ShaderNodeTexCoord').outputs['Object']
    sep = node(nt, 'ShaderNodeSeparateXYZ')
    link(nt, pos, sep.inputs['Vector'])
    joint = _dome_stone_joints(nt, sep)
    ramp = node(nt, 'ShaderNodeValToRGB')
    link(nt, _dome_noise(nt, pos, 0.35, detail=4.0), ramp.inputs['Factor'])
    e0, e1 = ramp.color_ramp.elements
    e0.position, e0.color = 0.3, (*(c * 0.93 for c in base), 1.0)
    e1.position, e1.color = 0.7, (*(min(1.0, c * 1.04) for c in base), 1.0)
    vo = node(nt, 'ShaderNodeTexVoronoi', Scale=30.0, Randomness=1.0)
    link(nt, pos, vo.inputs['Vector'])
    c = mix_color(nt, 0.3, ramp.outputs['Color'], _dome_remap(nt, vo.outputs['Distance'], 0.0, 0.12, 0.75, 1.0),
                  blend='MULTIPLY')
    streak = _dome_noise(nt, _dome_scale_z(nt, pos, 0.08), 1.2, detail=3.0)
    c = mix_color(nt, _dome_remap(nt, streak, 0.58, 0.75, 0.0, 0.18), c, (0.52, 0.52, 0.50))
    # 녹청 빗물 자국: 코니스 바로 아래가 가장 짙고 아래로 옅어짐 (+ 코니스 윗면 물매 전체에 옅게)
    run = _dome_noise(nt, _dome_scale_z(nt, pos, 0.05), 2.3, detail=2.0)
    fall = _dome_remap(nt, sep.outputs['Z'], DOME_Z0 - 5.0, DOME_Z0 - 1.1, 0.0, 1.0)
    run = _dome_math(nt, 'MULTIPLY', _dome_remap(nt, run, 0.50, 0.70, 0.0, 0.40), fall)
    run = _dome_math(nt, 'MAXIMUM', run, _dome_remap(nt, sep.outputs['Z'], DOME_Z0 - 0.25, DOME_Z0 - 0.1, 0.0, 0.14))
    c = mix_color(nt, run, c, _dome_srgb('#97b0a5'))
    c = mix_color(nt, _dome_math(nt, 'MULTIPLY', joint, 0.6), c, (0.45, 0.45, 0.43))
    link(nt, c, bsdf.inputs['Base Color'])
    bump = node(nt, 'ShaderNodeBump', Strength=0.35, Distance=0.02)
    link(nt, _dome_math(nt, 'MULTIPLY', joint, -1.0), bump.inputs['Height'])
    link(nt, bump.outputs['Normal'], bsdf.inputs['Normal'])
    return mat


# --- 형상 -------------------------------------------------------------------------

def _dome_drum(coll, stone):
    """받침 원통: 옥상 바닥(파라펫 뒤)에서 스프링 라인까지. 파라펫 윗면 높이(ROOF_TOP)까지 오는 받침단 →
    벽 → 얕은 오목 띠 → 벽 → 작은 턱 · 경사 · 코로나(수직 띠) 로 된 코니스 → 돔 쪽으로 오르는 물매 윗면.
    받침단 윗선이 파라펫 윗선과 같아 멀리서 보면 파라펫 위로 DRUM_H 만큼만 올라온 짧은 원통으로 읽힙니다.
    발치에는 옥상 바닥보다 10 cm 높은 돌 포장 띠(점검 통로)를 둘러 옥상 슬래브와의 이음을 덮습니다."""
    r, z0, zc, zb = DRUM_R, ROOF_DECK_Z, DOME_Z0, DRUM_Z0
    prof = [
        (r + 0.40, DOME_DRUM_BASE_Z), (r + 0.40, zb - 0.14), (r + 0.26, zb), (r, zb),        # 받침단 · 물끊기
        (r, zc - 2.55), (r - 0.08, zc - 2.55), (r - 0.08, zc - 2.20), (r, zc - 2.20),     # 오목 띠
        (r, zc - 1.45), (r + 0.12, zc - 1.45), (r + 0.12, zc - 1.27),                     # 작은 턱
        (r + 0.30, zc - 1.02), (r + 0.72, zc - 1.02), (r + 0.72, zc - 0.22),               # 경사 · 처마돌림
        (r + 0.64, zc - 0.14), (DOME_D / 2 + 0.35, zc), (DOME_D / 2 - 0.40, zc + 0.05),    # 물매 윗면
    ]
    bm = bmesh.new()
    _dome_lathe(bm, prof)
    finish_mesh('Dome_Drum', bm, coll, stone, part='dome_drum')
    ra, za = DOME_APRON_R, z0 + DOME_APRON_H
    apron = [(r + 0.30, za), (ra - 0.04, za), (ra, za - 0.04), (ra, DOME_DRUM_BASE_Z)]
    bm = bmesh.new()
    _dome_lathe(bm, apron)
    finish_mesh('Dome_Apron', bm, coll, stone, part='dome_drum')


def _dome_shell(coll, patina):
    """구면 캡 셸. 스프링 라인 아래로 조금 더 내려 코니스 속에 묻습니다 (틈 없음)."""
    ths = [DOME_TH_EDGE * i / DOME_RINGS for i in range(1, DOME_RINGS + 1)]
    ths.append(_dome_th_at_z(DOME_Z0 - 0.25))
    bm = bmesh.new()
    top = bm.verts.new((0.0, 0.0, TOTAL_H))
    n = DOME_SEGMENTS
    rows = [[bm.verts.new(_dome_pt(th, 2 * math.pi * j / n)) for j in range(n)] for th in ths]
    for j in range(n):
        bm.faces.new((top, rows[0][j], rows[0][(j + 1) % n]))
    for a, b in zip(rows, rows[1:]):
        for j in range(n):
            j2 = (j + 1) % n
            bm.faces.new((a[j], b[j], b[j2], a[j2]))
    finish_mesh('Dome_Shell', bm, coll, patina, smooth=True, part='dome_shell')


def _dome_seam_layout():
    """스탠딩 심 배치 [(방위각, 끝 극각, 중간에서 끝나는지)].
    스프링 라인에서 128개, 수평 반지름이 DOME_SEAM_DROP_R 를 지날 때마다 하나 걸러 끝나고
    16개만 꼭대기 칼라까지 갑니다 (실제 돔처럼 위에서 심이 몰리지 않게)."""
    ends = [_dome_th_at_r(r) for r in DOME_SEAM_DROP_R] + [_dome_th_at_r(DOME_COLLAR_R - 0.05)]
    out = []
    for k in range(DOME_SEAMS):
        level = 0
        while level < len(DOME_SEAM_DROP_R) and k % (2 ** (level + 1)) == 0:
            level += 1
        out.append((2 * math.pi * k / DOME_SEAMS, ends[level], level < len(DOME_SEAM_DROP_R)))
    return out


def _dome_add_seam(bm, ph, th0, th1, taper):
    """방위각 ph 의 자오선을 따라 극각 th0(아래) → th1(위) 로 가는 심 하나. taper 면 끝에서 셸 속으로 접힘."""
    n = max(2, int(math.ceil((th0 - th1) / DOME_SEAM_STEP)))
    prev = None
    for s in range(n + 1):
        th = th0 + (th1 - th0) * s / n
        hf = 1.0
        if taper:
            hf = max(0.2, min(1.0, (th - th1) * DOME_R_SPH / DOME_SEAM_TAPER))
        ring = [bm.verts.new(_dome_pt(th, ph, DOME_SEAM_H * v * (hf if v > 0 else 1.0), DOME_SEAM_W * u))
                for (u, v) in DOME_SEAM_PROFILE]
        if prev is None:
            bm.faces.new(ring)
        else:
            for i in range(len(ring) - 1):
                f = bm.faces.new((prev[i], ring[i], ring[i + 1], prev[i + 1]))
                f.smooth = True
        prev = ring
    bm.faces.new(list(reversed(prev)))


def _dome_seams(coll, seam_mat):
    """스탠딩 심 전부 (한 메시). 돔 발치 동판 띠 속에서 시작합니다."""
    th0 = _dome_th_at_z(DOME_Z0 + 0.26)
    bm = bmesh.new()
    for ph, th1, taper in _dome_seam_layout():
        _dome_add_seam(bm, ph, th0, th1, taper)
    finish_mesh('Dome_Seams', bm, coll, seam_mat, part='dome')


def _dome_trim(coll, seam_mat, metal):
    """돔 발치의 낮은 동판 띠(심이 여기서 시작), 꼭대기 칼라 링과 지름 2.8 m 의 낮은 원형 캡, 피뢰침."""
    zf, zs = DOME_Z0, _dome_z_at_r
    foot = [(DOME_D / 2 + 0.24, zf - 0.05), (DOME_D / 2 + 0.24, zf + 0.20), (DOME_D / 2 + 0.10, zf + 0.33),
            (DOME_D / 2 - 0.35, zf + 0.38)]
    bm = bmesh.new()
    _dome_lathe(bm, foot)
    rc, rk = DOME_CROWN_R, DOME_COLLAR_R
    top = TOTAL_H + 0.30
    crown = [(rk, zs(rk) - 0.06), (rk, zs(rk) + 0.09), (rk - 0.12, zs(rk) + 0.12), (rc, zs(rk) + 0.12),
             (rc, top - 0.05), (rc - 0.05, top), (0.3, top + 0.01), (0.0, top + 0.015)]
    _dome_lathe(bm, crown)
    finish_mesh('Dome_Trim', bm, coll, seam_mat, part='dome')
    bm = bmesh.new()
    bm_cylinder(bm, 0, 0, top - 0.02, 0.22, 0.18, 0.14, segments=24)
    bm_cylinder(bm, 0, 0, top + 0.12, 0.05, 0.014, 3.2, segments=12)
    finish_mesh('Dome_Lightning_Rod', bm, coll, metal, smooth_sides_only=True, part='dome_rod')


def build_dome(ctx):
    """드럼과 발치 포장 띠(dome_drum) · 돔 셸(dome_shell) · 스탠딩 심과 발치·꼭대기 마감(dome) · 피뢰침(dome_rod).
    건축 조명(돔 투광)은 조명 섹션 몫이라 여기엔 발광체가 없습니다."""
    coll = ctx.coll('Dome')
    patina = ctx.material('dome_patina', lambda: _dome_patina_mat('Dome_Patina'))
    seam = ctx.material('dome_patina_seam', lambda: _dome_patina_mat('Dome_Patina_Seam', seam=True))
    stone = ctx.material('dome_stone', lambda: _dome_stone_mat(_dome_stone_base(ctx)))
    _dome_drum(coll, stone)
    _dome_shell(coll, patina)
    _dome_seams(coll, seam)
    _dome_trim(coll, seam, ctx.mats['metal'])


# ----------------------------------------------------------------------------
# 하늘·조명·카메라·렌더 설정
#
# 낮·골든: 물리 하늘(Sky MULTIPLE_SCATTERING, 해 원반 끔) + 같은 방향·같은 세기의 SUN 램프 하나 (이중 태양 없음).
#   해 방향은 서울의 실제 태양 위치: sun_rotation r = 방위각 − 322 (정면 142° 기준 모델 좌표), 램프 회전
#   (π/2 − e, 0, π − r). compass_dir(방위각, 고도) 와 같은 방향인지 빌드 때 확인합니다.
#   지평선 아래(부지 너머)는 물리 하늘이 40배 어두워 남색 띠가 보이므로, 하늘만 파노라마로 한 번 렌더해
#   방위별 지평선 색을 재고 그 색으로 채웁니다 (임시 파일은 tempfile, 바로 삭제).
# 밤: 해 −5.5° 블루아워 하늘 + 지평선의 옅은 도시 불빛 + 차가운 달빛, 2007년 경관조명 계획 —
#   열주 24개 좁은 업라이트(3000 K), 처마 바깥면 워시(면광원 띠), 옥상 파라펫 안쪽 고리의 돔 투광 16개(5000 K).
#   창·LED·다운라이트 같은 발광 재질은 각 부위 섹션 몫입니다. 밤 룩은 AgX Punchy, 블룸은 넘치는 광원만.
# 카메라: 이름 = 샷 이름. 땅에서 찍는 샷은 카메라를 수평으로 두고 렌즈 시프트로 구도를 잡아 수직선이 곧습니다.
#   부지의 나무·가로등 자리(30_site)를 피해 둠 — 잔디광장 가장자리 소나무 무리·벚나무 줄, 가로등 줄.
# 렌더: 시간대별 샘플 배율 (낮·골든 0.75, 밤 0.375) — 1080p 한 장 4 스레드 약 4 분.
# ----------------------------------------------------------------------------

DEFAULT_SHOTS = [('day', 'hero'), ('day', 'front'), ('day', 'aerial'), ('day', 'axis'), ('day', 'colonnade'),
                 ('day', 'dome'), ('day', 'haetae'), ('golden', 'golden'), ('night', 'hero'), ('night', 'axis'),
                 ('night', 'corner')]

# 해: (방위각°, 고도°, 램프 세기 W/m2, 램프 색). 세기·색은 같은 하늘(원반 켬/끔)에 흰 확산 평면을 두고
# 잰 해 성분 (Cycles 5.0.1 측정, 에어로졸 LGT_SKY 값 기준) — 원반을 끄고 램프로 바꿔도 밝기·색이 같습니다.
LGT_SUN = {
    'day':    (125.0, 42.0, 155.0, (1.0, 0.842, 0.636)),   # 9월 하순 오전 10시 무렵: 정면을 오른쪽 앞에서
    'golden': (93.0, 7.5, 89.3, (1.0, 0.600, 0.211)),      # 이른 아침: 정면을 오른쪽에서 길게 훑는 빛
}
LGT_NIGHT_SUN = (290.0, -5.5)                 # 일몰 뒤 블루아워 (해는 서북서 지평선 아래)
LGT_SKY = {'air': 1.0, 'aerosol': 1.5, 'ozone': 1.0, 'altitude': 100.0}   # 서울의 옅은 연무
LGT_EXPOSURE = {'day': -5.0, 'golden': -4.0, 'night': 0.6}     # 노출 (물리 하늘 세기 1 기준)
# 뷰 변환·룩: 낮·골든은 Khronos PBR Neutral — AgX 는 밝은 면의 채도를 크게 빼서 황금빛 정면이 크림색으로
# 바래고 하늘이 뿌옇게 됨 (비교 렌더로 확인). 밤은 AgX: 따뜻한 조명·창이 주황으로 쏠리지 않고 흰빛에 가깝게.
# 밤 룩은 Punchy (+0.3 EV 로 중간톤 보정): Medium High Contrast 는 밝은 LED 태극기의 빨강을 연분홍
# (채도 0.47)으로 바래게 하는데 Punchy 는 0.64 로 지키고, 하늘이 더 짙은 남색이 되며 넘치는 픽셀도 줄어듦.
LGT_VIEW = {'day': ('Khronos PBR Neutral', 'None'), 'golden': ('Khronos PBR Neutral', 'None'),
            'night': ('AgX', 'AgX - Punchy')}
LGT_WHITE_BALANCE = {'day': 5700.0, 'golden': 6500.0, 'night': 5200.0}   # 뷰 화이트 밸런스 (K, 6500 = 그대로)
LGT_HORIZON_AZ = 30            # 지평선 색을 재는 방위 수 (+ 끝 2개 = 색 램프 한도 32)
assert LGT_HORIZON_AZ <= 30, 'ColorRamp 는 요소 32 개까지 (방위 수 + 끝 2 개)'
LGT_HORIZON_SOFT = 0.02        # 지평선 아래 채움이 섞이는 폭 (방향 벡터 z)
LGT_CITY_GLOW = (0.060, 0.034, 0.016)   # 밤 지평선의 도시 불빛 (선형, 하늘 세기 1 기준)
LGT_CITY_GLOW_H = 0.07         # 도시 불빛이 사라지는 높이 (방향 벡터 z)
# 달: 방위각, 고도, 세기, 색 (정면 쪽 동남 하늘). Punchy 룩은 어두운 곳을 더 누르므로 잔디·나무가 읽히도록
# 약한 푸른 채움 겸 0.25 (0.10 에서는 hero 화면의 8 % 가 검정으로 뭉개짐 → 3.6 %).
LGT_MOON = (135.0, 34.0, 0.25, (0.72, 0.80, 1.0))
# 뭉게구름 (낮·골든): 방향 벡터를 높은 평면에 투영한 (x, y) / (z + bend) 위의 3D 노이즈를 문턱 cover 로 잘라 만듦.
# 카메라·반사 광선에만 보이므로 하늘빛·해 세기 보정은 그대로. 색 = 해 램프 세기·색 × lit + 지평선 색 × amb (밝은 쪽),
# 해 쪽으로 offset 만큼 옮긴 표본이 짙으면 그늘 (지평선 색 × shade × tint — 골든은 파란 하늘빛을 받아 푸른 회색).
# 지평선 가까이 fade 범위에서 연무로 사라짐. 골든은 lit 을 낮춰 밝은 면이 하이라이트 압축에 바래지 않고 복숭앗빛.
LGT_CLOUDS = {
    'day':    {'scale': 1.2, 'cover': (0.55, 0.69), 'bend': 0.05, 'fade': (0.03, 0.20), 'opacity': 0.95,
               'lit': 0.24, 'amb': 0.9, 'shade': 0.65, 'tint': (1.0, 1.0, 1.0), 'offset': 0.08, 'seed': 3.0},
    'golden': {'scale': 1.4, 'cover': (0.60, 0.74), 'bend': 0.05, 'fade': (0.02, 0.16), 'opacity': 0.9,
               'lit': 0.17, 'amb': 0.8, 'shade': 0.75, 'tint': (0.8, 0.9, 1.25), 'offset': 0.06, 'seed': 7.0},
}

# 열주 업라이트: 기둥 중심에서 바깥으로 out m (굽 반폭 1.70 밖; 모서리 기둥은 대각선으로 out_corner m — 팔각 굽의
# 대각선 반폭 2.03 밖), 기단면 바로 위. 기둥 바깥면을 따라 거의 수직으로 쏘아 밑동부터 처마까지 씻습니다.
LGT_COL_SPOT = {'energy': 4.0e4, 'size': 28.0, 'blend': 0.85, 'temp': 3000.0,
                'out': 2.4, 'out_corner': 2.6, 'z': PODIUM_H + 0.15}
# 처마 워시: 변마다 가는 면광원 띠 두 줄 — 처마 바깥면(z 38.24~41.14)은 처마 끝 바로 밖·아래에서,
# 파라펫 바깥면(z 41.14~43.94, 0.5 m 들임)은 처마 윗면 높이 조금 밖에서 위·안쪽으로 쓸어 올림.
LGT_EAVE_WASH = (
    {'name': 'Fascia', 'energy_per_m': 22.0, 'width': 0.25, 'out': 0.9, 'z': ROOF_Z0 - 0.35,
     'tilt': 18.0, 'spread': 50.0, 'temp': 3200.0},
    {'name': 'Parapet', 'energy_per_m': 9.0, 'width': 0.2, 'out': 1.0, 'z': ROOF_DECK_Z - 0.15,
     'tilt': 38.0, 'spread': 60.0, 'temp': 3200.0},
)
# 돔 투광 16개 (옥상 파라펫 안쪽 고리, 파라펫 윗면 위). 넓은 빔(돔 아래쪽·드럼)과 좁은 빔(돔 윗부분)을 번갈아 —
# 드럼 코니스(반지름 33.7 m, z 49.2)는 빛에 거의 수직이라 쉽게 하얗게 뜨므로 넓은 빔은 약하게, 윗부분은 좁은 빔으로 채움.
LGT_DOME_FLOOD = {'n': 16, 'r': 62.0, 'r_min': 54.5, 'temp': 5000.0, 'z': ROOF_TOP + 0.8,
                  'beams': ({'energy': 4.0e4, 'size': 60.0, 'blend': 0.6, 'aim_z': 58.0},
                            {'energy': 9.0e4, 'size': 36.0, 'blend': 0.9, 'aim_z': 68.0})}
# 밤 컴포지터 블룸: 문턱을 높게 — 화면에서 하얗게 넘치는 램프·다운라이트·창만 번지고, 태극기 LED 처럼
# 밝지만 채도가 높은 면은 번지지 않아 색이 바래지 않음 (문턱 1.5 에서 파랑 채도 0.87 → 0.59).
LGT_BLOOM = {'threshold': 4.0, 'strength': 0.6, 'size': 0.6}
# 공기 원근 (컴포지터): 카메라에서 start m 넘게 떨어진 면을 거리 d 에 따라 지평선 색 쪽으로 섞음,
# 섞는 비율 = min(1 − exp(−(d − start) / scale), cap). 하늘(깊이 무한)은 그대로. 서울의 옅은 연무 (가시거리 약 15 km).
LGT_HAZE = {'day': {'start': 120.0, 'scale': 7000.0, 'cap': 0.55},
            'golden': {'start': 120.0, 'scale': 5000.0, 'cap': 0.6}}

# 샘플 수 = --samples × 시간대 배율 (최소 min_samples). 기본 128 이면 낮·골든 96, 밤 48 — 1080p 한 장이
# 4 스레드에서 약 4 분 (통합에 가까운 장면, 128 spp 낮 CPU 1285 s · 64 spp 밤 1400 s 에서 환산).
# 밤은 광원 60여 개 + 발광 면이 많아 샘플당 시간이 낮의 약 2 배지만 OIDN 뒤 24 spp 에서도 깨끗함.
LGT_RENDER = {'adaptive': 0.02, 'clamp_indirect': 10.0, 'blur_glossy': 0.8,
              'samples_scale': {'day': 0.75, 'golden': 0.75, 'night': 0.375}, 'min_samples': 16,
              'bounces': {'max_bounces': 8, 'diffuse_bounces': 4, 'glossy_bounces': 4,
                          'transmission_bounces': 8, 'transparent_max_bounces': 16, 'volume_bounces': 0}}


# --- 하늘 ---------------------------------------------------------------------

def _lgt_math(ng, op, a, b=None):
    """수학 노드 (Blender 5 는 월드 셰이더와 컴포지터 모두 ShaderNodeMath). a·b 는 소켓 또는 값. 결과 소켓."""
    n = ng.nodes.new('ShaderNodeMath')
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if hasattr(v, 'is_output'):
            ng.links.new(v, n.inputs[i])
        else:
            n.inputs[i].default_value = v
    return n.outputs[0]


def _lgt_sun_rotation(azimuth):
    """나침반 방위각 → Sky 노드 sun_rotation (도). 정면 142° 를 모델 −Y 로 둔 좌표계의 +Y = 322°."""
    return (azimuth - (FRONT_AZIMUTH + 180.0)) % 360.0


def _lgt_sky_node(nt, elevation, azimuth):
    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'MULTIPLE_SCATTERING'
    sky.sun_disc = False                      # 해는 같은 방향의 SUN 램프가 맡음
    sky.sun_elevation = math.radians(elevation)
    sky.sun_rotation = math.radians(_lgt_sun_rotation(azimuth))
    sky.air_density = LGT_SKY['air']
    sky.aerosol_density = LGT_SKY['aerosol']
    sky.ozone_density = LGT_SKY['ozone']
    sky.altitude = LGT_SKY['altitude']
    return sky


def _lgt_probe_horizon(world):
    """하늘만 있는 임시 장면을 등장방형 파노라마(지평선 위 0.3~3°)로 렌더해 방위별 평균 색을 돌려줍니다.
    반환: LGT_HORIZON_AZ 개의 선형 RGB — i 번째는 +Y 에서 +X 쪽으로 (i + 0.5) / n * 360 − 180 도."""
    import numpy as np
    n = LGT_HORIZON_AZ
    sc = bpy.data.scenes.new('_LGT_HorizonProbe')
    sc.world = world
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 8
    sc.cycles.use_denoising = False
    sc.render.threads_mode = 'FIXED'
    sc.render.threads = 2
    sc.render.resolution_x, sc.render.resolution_y = n, 4
    sc.render.image_settings.file_format = 'OPEN_EXR'
    cd = bpy.data.cameras.new('_LGT_HorizonProbe')
    cd.type = 'PANO'
    cd.panorama_type = 'EQUIRECTANGULAR'
    cd.latitude_min, cd.latitude_max = math.radians(0.3), math.radians(3.0)
    cd.longitude_min, cd.longitude_max = -math.pi, math.pi
    cam = bpy.data.objects.new('_LGT_HorizonProbe', cd)
    cam.rotation_euler = (math.pi / 2, 0.0, 0.0)            # 가운데 열 = +Y, 오른쪽으로 +X
    sc.collection.objects.link(cam)
    sc.camera = cam
    fd, path = tempfile.mkstemp(prefix='na_horizon_', suffix='.exr')
    os.close(fd)
    try:
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True, scene=sc.name)
        im = bpy.data.images.load(path)
        px = np.array(im.pixels[:]).reshape(4, n, 4)[..., :3].mean(0)
        bpy.data.images.remove(im)
    finally:
        os.remove(path)
        bpy.data.objects.remove(cam)
        bpy.data.cameras.remove(cd)
        bpy.data.scenes.remove(sc)
    return [tuple(float(c) for c in p) for p in px]


def _lgt_azimuth_ramp(nt, colors):
    """방향 벡터의 방위(+Y 에서 +X 쪽 각)로 colors 를 고르게 이어 주는 색 램프. 결과 색 소켓."""
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    link(nt, tc.outputs['Generated'], sep.inputs['Vector'])
    ang = node(nt, 'ShaderNodeMath', operation='ARCTAN2')
    link(nt, sep.outputs['X'], ang.inputs[0])
    link(nt, sep.outputs['Y'], ang.inputs[1])
    t = node(nt, 'ShaderNodeMath', operation='MULTIPLY_ADD')
    link(nt, ang.outputs[0], t.inputs[0])
    t.inputs[1].default_value = 1.0 / (2.0 * math.pi)
    t.inputs[2].default_value = 0.5
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    n = len(colors)
    els = ramp.color_ramp.elements
    wrap = tuple((a + b) / 2.0 for a, b in zip(colors[0], colors[-1]))
    stops = [(0.0, wrap)] + [((i + 0.5) / n, c) for i, c in enumerate(colors)] + [(1.0, wrap)]
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1.0)
    els[1].position, els[1].color = stops[-1][0], (*stops[-1][1], 1.0)
    for pos, c in stops[1:-1]:
        els.new(pos).color = (*c, 1.0)
    link(nt, t.outputs[0], ramp.inputs['Fac'])
    return ramp.outputs['Color'], sep.outputs['Z']


def _lgt_below_mask(nt, z):
    """방향 z 가 0 → −LGT_HORIZON_SOFT 로 내려갈 때 0 → 1."""
    mr = node(nt, 'ShaderNodeMapRange', From_Min=0.0, From_Max=-LGT_HORIZON_SOFT)
    link(nt, z, mr.inputs['Value'])
    return mr.outputs['Result']


def _lgt_city_glow(nt, color_in, z):
    """지평선에 붙은 옅은 도시 불빛: glow · exp(−max(z, 0) / h) 를 더합니다."""
    k = _lgt_math(nt, 'MULTIPLY', _lgt_math(nt, 'MAXIMUM', z, 0.0), -1.0 / LGT_CITY_GLOW_H)
    return mix_color(nt, _lgt_math(nt, 'EXPONENT', k), color_in, LGT_CITY_GLOW, blend='ADD')


def _lgt_cloud_density(nt, u, v, c, du=0.0, dv=0.0):
    """투영 좌표 (u + du, v + dv) 의 구름 밀도 0..1 (노이즈를 cover 문턱으로 자름)."""
    xyz = nt.nodes.new('ShaderNodeCombineXYZ')
    link(nt, _lgt_math(nt, 'ADD', u, du), xyz.inputs['X'])
    link(nt, _lgt_math(nt, 'ADD', v, dv), xyz.inputs['Y'])
    xyz.inputs['Z'].default_value = c['seed']
    tex = node(nt, 'ShaderNodeTexNoise', Scale=c['scale'], Detail=7.0, Roughness=0.58)
    link(nt, xyz.outputs['Vector'], tex.inputs['Vector'])
    mr = node(nt, 'ShaderNodeMapRange', From_Min=c['cover'][0], From_Max=c['cover'][1])
    link(nt, tex.outputs['Fac'], mr.inputs['Value'])
    return mr.outputs['Result']


def _lgt_clouds(nt, color_in, tod, horizon):
    """낮·골든 뭉게구름을 color_in 위에 얹음 (카메라·반사 광선만). horizon = 지평선 중앙값 색 (선형)."""
    c = LGT_CLOUDS[tod]
    az, el, energy, sun_col = LGT_SUN[tod]
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    link(nt, tc.outputs['Generated'], sep.inputs['Vector'])
    zb = _lgt_math(nt, 'MAXIMUM', _lgt_math(nt, 'ADD', sep.outputs['Z'], c['bend']), 1e-3)
    u = _lgt_math(nt, 'DIVIDE', sep.outputs['X'], zb)
    v = _lgt_math(nt, 'DIVIDE', sep.outputs['Y'], zb)
    to_sun = Vector(compass_dir(az, el)[:2]).normalized() * c['offset']
    dens = _lgt_cloud_density(nt, u, v, c)
    shadow = _lgt_cloud_density(nt, u, v, c, to_sun.x, to_sun.y)       # 해 쪽이 짙으면 그늘진 면
    lit = tuple(energy * c['lit'] * s + c['amb'] * h for s, h in zip(sun_col, horizon))
    shade = tuple(c['shade'] * h * t for h, t in zip(horizon, c['tint']))
    cloud = mix_color(nt, shadow, lit, shade)
    fade = node(nt, 'ShaderNodeMapRange', From_Min=c['fade'][0], From_Max=c['fade'][1])
    link(nt, sep.outputs['Z'], fade.inputs['Value'])
    lp = nt.nodes.new('ShaderNodeLightPath')
    seen = _lgt_math(nt, 'MAXIMUM', lp.outputs['Is Camera Ray'], lp.outputs['Is Glossy Ray'])
    f = _lgt_math(nt, 'MULTIPLY', _lgt_math(nt, 'MULTIPLY', dens, fade.outputs['Result']), c['opacity'])
    return mix_color(nt, _lgt_math(nt, 'MULTIPLY', f, seen), color_in, cloud)


def build_world(ctx):
    """물리 하늘 + 방위별 지평선 채움 + 낮·골든 뭉게구름 (밤에는 도시 불빛). 해 원반은 끄고 SUN 램프가 대신합니다."""
    scene = ctx.scene
    world = bpy.data.worlds.new('World')
    scene.world = world
    ensure_nodes(world)
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    az, el = (LGT_NIGHT_SUN if ctx.night else LGT_SUN[ctx.tod][:2])
    sky = _lgt_sky_node(nt, el, az)
    link(nt, sky.outputs['Color'], bg.inputs['Color'])
    link(nt, bg.outputs['Background'], out.inputs['Surface'])
    bg.inputs['Strength'].default_value = 1.0
    horizon = _lgt_probe_horizon(world)                 # 하늘만 연결된 상태에서 잼
    hz_color, z = _lgt_azimuth_ramp(nt, horizon)
    col = mix_color(nt, _lgt_below_mask(nt, z), sky.outputs['Color'], hz_color)
    median = [sorted(c[i] for c in horizon)[len(horizon) // 2] for i in range(3)]
    col = _lgt_city_glow(nt, col, z) if ctx.night else _lgt_clouds(nt, col, ctx.tod, median)
    link(nt, col, bg.inputs['Color'])
    world['na_horizon_median'] = median


# --- 조명 ---------------------------------------------------------------------

def _lgt_aim(obj, target):
    """오브젝트의 −Z 가 target 을 향하게 (Y 축이 위쪽)."""
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def _lgt_lamp(coll, name, kind, loc, energy, color=None, temp=None, **props):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    if temp:
        ld.use_temperature = True
        ld.temperature = temp
    if color:
        ld.color = color
    for k, v in props.items():
        setattr(ld, k, v)
    obj = bpy.data.objects.new(name, ld)
    obj.location = loc
    obj.visible_camera = False                # 광원 자체는 화면에 안 보이게 (빛만)
    obj['na_part'] = 'light'
    coll.objects.link(obj)
    return obj


def _lgt_sun_lamp(coll, name, azimuth, elevation, energy, color, angle):
    """Sky 노드와 그림자가 일치하는 SUN 램프 (TRACK_TO 없음). 방향을 compass_dir 로 검산합니다."""
    sun = _lgt_lamp(coll, name, 'SUN', (0.0, 0.0, 200.0), energy, color, angle=angle)
    r = math.radians(_lgt_sun_rotation(azimuth))
    sun.rotation_euler = (math.pi / 2 - math.radians(elevation), 0.0, math.pi - r)
    to_sun = sun.rotation_euler.to_matrix() @ Vector((0.0, 0.0, 1.0))
    assert (to_sun - compass_dir(azimuth, elevation)).length < 1e-4, (name, to_sun)
    return sun


def _lgt_column_spots(coll):
    """열주 24개: 기단면에서 각 기둥 바깥면을 좁게 쏘아 올리는 따뜻한 스폿 (굽 밖, 모서리 기둥은 대각선)."""
    p = LGT_COL_SPOT
    for i, (x, y) in enumerate(column_positions()):
        ox = (1.0 if x > L / 2 - 0.1 else -1.0 if x < -L / 2 + 0.1 else 0.0)
        oy = (1.0 if y > W / 2 - 0.1 else -1.0 if y < -W / 2 + 0.1 else 0.0)
        corner = ox != 0.0 and oy != 0.0
        d = Vector((ox, oy, 0.0)).normalized()
        base = Vector((x, y, p['z'])) + d * (p['out_corner'] if corner else p['out'])
        spot = _lgt_lamp(coll, f'Light_Column_{i:02d}', 'SPOT', base, p['energy'], temp=p['temp'],
                         spot_size=math.radians(p['size']), spot_blend=p['blend'], shadow_soft_size=0.08)
        face = COL_TOP_W / 2.0 * (1.08 if corner else 1.0)     # 윗단 바깥면(모서리는 빗면) 바로 앞을 겨눔
        _lgt_aim(spot, (x + d.x * face, y + d.y * face, ROOF_Z0 - 4.0))


def _lgt_strip(coll, name, centre, length, normal, p):
    """길이 방향이 X 또는 Y 인 가는 면광원 띠. normal = 건물 바깥쪽 수평 단위벡터 (nx, ny):
    띠는 위로, tilt 만큼 건물 쪽으로 기울여 비춥니다."""
    nx, ny = normal
    tilt = math.radians(p['tilt'])
    lamp = _lgt_lamp(coll, name, 'AREA', centre, p['energy_per_m'] * length, temp=p['temp'],
                     shape='RECTANGLE', size=length, size_y=p['width'], spread=math.radians(p['spread']))
    emit = Vector((-nx * math.sin(tilt), -ny * math.sin(tilt), math.cos(tilt)))
    x_axis = Vector((abs(ny), abs(nx), 0.0))                  # 띠 길이 방향
    z_axis = -emit                                              # 면광원은 로컬 −Z 로 비춤
    lamp.rotation_euler = Matrix((x_axis, z_axis.cross(x_axis), z_axis)).transposed().to_euler()
    return lamp


def _lgt_eave_wash(coll):
    """처마 네 변 × (처마 바깥면, 파라펫 바깥면) 워시. 처마 끝 = 열주 중심선 + ROOF_OVERHANG."""
    ex, ey = L / 2 + ROOF_OVERHANG, W / 2 + ROOF_OVERHANG
    for p in LGT_EAVE_WASH:
        o = p['out']
        for side, (cx, cy), length, n in (('F', (0.0, -ey - o), 2 * ex, (0.0, -1.0)),
                                          ('B', (0.0, ey + o), 2 * ex, (0.0, 1.0)),
                                          ('L', (-ex - o, 0.0), 2 * ey, (-1.0, 0.0)),
                                          ('R', (ex + o, 0.0), 2 * ey, (1.0, 0.0))):
            _lgt_strip(coll, f"Light_{p['name']}_{side}", (cx, cy, p['z']), length, n, p)


def _lgt_dome_floods(coll):
    """옥상 파라펫 안쪽 고리(반지름 약 55~62 m, 파라펫 윗면 위)의 차가운 흰색 투광 — 돔 축 (0, 0, aim_z) 을 겨눔.
    드럼 코니스에 가리지 않도록 드럼에서 멀리 둡니다. 넓은 빔과 좁은 빔을 번갈아 배치."""
    p = LGT_DOME_FLOOD
    iy = W / 2 + ROOF_OVERHANG - 2.0                      # 파라펫 안쪽 (옥상 가장자리 통로 위)
    for k in range(p['n']):
        a = 2 * math.pi * (k + 0.5) / p['n']
        c, s = math.cos(a), math.sin(a)
        r = min(p['r'], iy / abs(s) if abs(s) > 1e-6 else p['r'])
        r = max(r, p['r_min'])
        beam = p['beams'][k % len(p['beams'])]
        spot = _lgt_lamp(coll, f'Light_Dome_{k:02d}', 'SPOT', (r * c, r * s, p['z']), beam['energy'],
                         temp=p['temp'], spot_size=math.radians(beam['size']), spot_blend=beam['blend'],
                         shadow_soft_size=0.25)
        _lgt_aim(spot, (0.0, 0.0, beam['aim_z']))


def build_lights(ctx):
    """낮·골든: 하늘과 같은 방향의 해. 밤: 달 + 열주 업라이트 + 처마 워시 + 돔 투광."""
    coll = ctx.coll('Lights')
    sun_size = math.radians(0.545)                      # Sky 노드 기본 sun_size 와 같은 시직경
    if not ctx.night:
        az, el, energy, color = LGT_SUN[ctx.tod]
        _lgt_sun_lamp(coll, 'Sun', az, el, energy, color, sun_size)
        return
    az, el, energy, color = LGT_MOON
    _lgt_sun_lamp(coll, 'Moon', az, el, energy, color, math.radians(0.52))
    _lgt_column_spots(coll)
    _lgt_eave_wash(coll)
    _lgt_dome_floods(coll)


# --- 카메라 -------------------------------------------------------------------

def _lgt_camera(coll, name, loc, aim, lens=35.0, level=False, ortho=None, dof=None, clip=None):
    """카메라 하나. level=True (또는 직교) 면 기울이지 않고(수직선이 곧게) aim 높이만큼 렌즈 시프트로 올립니다.
    dof = (초점을 맞출 점, 조리개 f 값), clip = (가까운, 먼 자르기 거리 m)."""
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36.0
    cd.clip_start, cd.clip_end = clip or ((0.5 if lens < 60 else 2.0), 6000.0)
    cam = bpy.data.objects.new('Cam_' + name, cd)
    cam.location = loc
    cam['na_part'] = 'camera'
    coll.objects.link(cam)
    d = Vector(aim) - Vector(loc)
    if ortho:
        cd.type = 'ORTHO'
        cd.ortho_scale = ortho
    if level or ortho:
        flat = Vector((d.x, d.y, 0.0))
        cam.rotation_euler = flat.to_track_quat('-Z', 'Y').to_euler()
        cd.shift_y = d.z / ortho if ortho else lens * d.z / flat.length / cd.sensor_width   # 시프트 단위 = 화면 폭
    else:
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if dof:
        cd.dof.use_dof = True
        cd.dof.focus_distance = (Vector(dof[0]) - Vector(loc)).length
        cd.dof.aperture_fstop = dof[1]
    return cam


LGT_CAMERAS = {
    # 이름: (위치, 겨냥점, 렌즈 mm, 옵션)
    'hero':      ((-122.0, -300.0, 55.0), (0.0, -25.0, 22.0), 35.0, {}),
    # 정면 입면: 화면 아래 = z −1, 처마 156 m 에 좌우 7 m 여유. 앞쪽 6 m (가로 차로 가로등 줄)와
    # 본관 뒤 300 m 밖 (한강 건너 도시 — 직교 투영에선 뒤 풍경이 원근 없이 그대로 커 보임)은 잘라 냄.
    'front':     ((0.0, -123.0, 46.8), (0.0, 0.0, 46.8), 50.0, {'ortho': 170.0, 'clip': (6.0, 300.0)}),
    # 캠퍼스 전체: 축 왼쪽 앞 높은 곳 — 정문·해태 줄부터 잔디광장·분수·본관·뒤 한강까지, 의원회관은 왼쪽 가장자리
    'aerial':    ((-170.0, -760.0, 250.0), (10.0, -160.0, 15.0), 38.0, {}),
    # 분수 너머 축선 (드론 18 m): 분수 수반 앞 테두리까지 화면 안
    'axis':      ((0.0, -345.0, 18.0), (0.0, -40.0, 22.0), 50.0, {'level': True}),
    'colonnade': ((-78.0, -59.0, 7.0), (-52.0, -42.0, 36.0), 20.0, {}),
    'dome':      ((75.0, -430.0, 30.0), (0.0, 0.0, 55.0), 135.0, {'level': True}),
    # 왼쪽 해태상 (−30, −372) 을 앞 왼쪽에서 크게, 본관은 가운데 오른쪽. 28 mm f/1.2 로 10 m 앞 해태 머리에
    # 초점 → 본관은 1080p 에서 약 3 px 번짐 (은은한 심도)
    'haetae':    ((-26.0, -382.0, 1.3), (-26.0, -342.0, 6.9), 28.0,
                  {'level': True, 'dof': ((-30.0, -373.0, 4.0), 1.2)}),
    # 골든: 왼쪽 앞 잔디광장 위 (드론 18 m) — 오른쪽에서 낮게 드는 햇빛이 정면을 훑고, 그늘진 왼쪽 면과
    # 잔디 위 긴 그림자가 함께 보이게. 잔디 가장자리 소나무 무리 (−86, −238)·벚나무 줄 (x −102.5) 과
    # 가로 산책로 가로등 (y −220.6) 머리는 화면 밖.
    'golden':    ((-70.0, -266.0, 18.0), (0.0, -32.0, 28.0), 38.0, {'level': True}),
    # 밤 근경: 앞마당 왼쪽 소나무 화단 위 (21 m) 에서 본 앞 왼쪽 모서리 — 열주 업라이트, 처마 워시·LED 띠,
    # 처마 밑 다운라이트, 기단 창, 대계단 난간 조명과 돔 윗부분이 한 화면에
    'corner':    ((-104.0, -130.0, 21.0), (-28.0, -36.0, 26.0), 28.0, {'level': True}),
}


def build_cameras(ctx):
    """샷 카메라들 (이름 = --shots 의 카메라 이름). 밤에는 hero·axis 를 다시 쓰고 corner 를 더합니다."""
    coll = ctx.coll('Cameras')
    cams = {}
    for name, (loc, aim, lens, opt) in LGT_CAMERAS.items():
        cams[name] = _lgt_camera(coll, name, loc, aim, lens, **opt)
    ctx.scene.camera = cams['hero']
    return cams


# --- 렌더 ---------------------------------------------------------------------

def _lgt_haze(ng, image, depth, haze, color):
    """공기 원근: image 를 지평선 색 color 쪽으로 (1 − exp(−(깊이 − start)/scale)) 만큼 섞음 (하늘 제외)."""
    far = _lgt_math(ng, 'MAXIMUM', _lgt_math(ng, 'SUBTRACT', depth, haze['start']), 0.0)
    t = _lgt_math(ng, 'EXPONENT', _lgt_math(ng, 'MULTIPLY', far, -1.0 / haze['scale']))
    f = _lgt_math(ng, 'MINIMUM', _lgt_math(ng, 'SUBTRACT', 1.0, t), haze['cap'])
    f = _lgt_math(ng, 'MULTIPLY', f, _lgt_math(ng, 'LESS_THAN', depth, 1.0e6))   # 하늘: 깊이 1e10
    mix = ng.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    ng.links.new(f, mix.inputs['Factor'])
    ng.links.new(image, mix.inputs['A'])
    mix.inputs['B'].default_value = (*color, 1.0)
    return mix.outputs['Result']


def _lgt_bloom(ng, image):
    """밤: 아주 밝은 광원만 은은하게 번지는 Bloom (Glare 의 Type·Quality 는 메뉴 소켓)."""
    gl = ng.nodes.new('CompositorNodeGlare')
    gl.inputs['Type'].default_value = 'Bloom'
    gl.inputs['Quality'].default_value = 'High'
    gl.inputs['Threshold'].default_value = LGT_BLOOM['threshold']
    gl.inputs['Strength'].default_value = LGT_BLOOM['strength']
    gl.inputs['Size'].default_value = LGT_BLOOM['size']
    ng.links.new(image, gl.inputs['Image'])
    return gl.outputs['Image']


def _lgt_compositor(ctx):
    """Blender 5 컴포지터 (scene.compositing_node_group): 낮·골든 공기 원근, 밤 블룸."""
    scene = ctx.scene
    ng = bpy.data.node_groups.new('NA_Post_' + ctx.tod, 'CompositorNodeTree')
    ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    haze = LGT_HAZE.get(ctx.tod)
    haze = haze if haze and scene.world and 'na_horizon_median' in scene.world else None
    if haze:
        scene.view_layers[0].use_pass_z = True          # 노드를 만들기 전에 켜야 Depth 소켓이 생김
    rl = ng.nodes.new('CompositorNodeRLayers')
    rl.scene = scene
    image = rl.outputs['Image']
    if haze:
        image = _lgt_haze(ng, image, rl.outputs['Depth'], haze, tuple(scene.world['na_horizon_median']))
    if ctx.night:
        image = _lgt_bloom(ng, image)
    ng.links.new(image, ng.nodes.new('NodeGroupOutput').inputs['Image'])
    scene.compositing_node_group = ng
    scene.render.use_compositing = True


def setup_render(ctx, samples=128, size=(1920, 1080), threads=0):
    """Cycles CPU: 적응 샘플링, OIDN(정밀 전처리), 광원 트리, 노출에 맞춘 간접광 클램프, 코스틱 끔.
    샘플 수 = samples × 시간대 배율 (LGT_RENDER['samples_scale']: 낮·골든 0.75, 밤 0.375), 최소 16.
    시간대별 뷰 변환·노출·화이트 밸런스, 컴포지터 (낮·골든 공기 원근, 밤 블룸)."""
    scene = ctx.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.length_unit = 'METERS'
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    if threads:
        scene.render.threads_mode = 'FIXED'
        scene.render.threads = threads
    scene.render.engine = 'CYCLES'
    cy = scene.cycles
    cy.device = 'CPU'
    cy.samples = max(LGT_RENDER['min_samples'], round(samples * LGT_RENDER['samples_scale'][ctx.tod]))
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = LGT_RENDER['adaptive']
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_prefilter = 'ACCURATE'
    cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    cy.use_light_tree = True
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = LGT_RENDER['blur_glossy']
    for k, v in LGT_RENDER['bounces'].items():
        setattr(cy, k, v)
    exposure = LGT_EXPOSURE[ctx.tod]
    cy.sample_clamp_direct = 0.0
    cy.sample_clamp_indirect = LGT_RENDER['clamp_indirect'] * 2.0 ** (-exposure)   # 화면 밝기 기준으로 같은 클램프
    vs = scene.view_settings
    vs.view_transform, vs.look = LGT_VIEW[ctx.tod]
    vs.exposure = exposure
    vs.use_white_balance = True
    vs.white_balance_temperature = LGT_WHITE_BALANCE[ctx.tod]
    _lgt_compositor(ctx)


# ----------------------------------------------------------------------------
# glTF 내보내기 — 웹 뷰어(model-viewer 3.5)용 GLB 와 핫스팟 앵커
#
# export_glb(ctx, path, draco, scope)
#   scope 'building': 본관(na_part podium*/body/columns/roof/dome*) + 가까운 부지 부품(앞마당, 계단 발치 받침과
#       청동 군상, 소나무 숲 …). 바닥·잔디·길·물처럼 평평한 부지는 받침판 경계(EXPORT_BASE)에서 잘라 넣고,
#       그 밑에 짙은 받침판을 깔아 건축 모형처럼 보이게 합니다. 경계 상자가 건물에 맞춰져 뷰어가 건물을 크게 잡습니다.
#   scope 'campus': 캠퍼스 전체. 중심에서 EXPORT_CAMPUS_R 밖은 빼고, 평평한 것은 그 원(정다각형)에서 자릅니다.
#   · 링크 복제(나무·가로등)는 메시를 공유한 노드로 내보냅니다. GPU 인스턴싱 확장은 쓰지 않습니다
#     (model-viewer 3.5 가 인스턴싱 메시마다 콘솔 경고를 내고, 공유 메시만으로도 크기가 충분히 작음).
#   · 조명·카메라·빈 오브젝트는 내보내지 않습니다 (자식이 있는 부모 Empty 만 예외). Y-up, 모디파이어 적용, Draco.
#   · 재질은 flatten_material 로 대표색만 남깁니다 (한 방향 — main 이 끝에 다시 빌드). 낮에는 발광을 모두 끕니다.
#   · 밤: 창·LED 는 제 색이 남도록 세기 ≤ 0.9, 아주 밝은 등기구는 1 초과(KHR_materials_emissive_strength) 로
#     내보내고, GLB 에 못 들어가는 건축 조명(열주 업라이트, 처마 워시, 돔 투광)은 '빛 받은 색' 발광으로 흉내 냅니다
#     (이미 빛나는 재질은 그대로). 짝이 되는 어두운 환경맵은 export_night_env.
# export_hotspots(ctx, path, scope): model-viewer 핫스팟 앵커 JSON. 좌표는 glTF/model-viewer (x, z, -y).
# 판정은 오브젝트 이름이 아니라 na_part 태그·공유 치수·월드 경계 상자만 봅니다 (다른 섹션이 바뀌어도 동작).
# ----------------------------------------------------------------------------


EXPORT_BUILDING_PARTS = ('podium', 'body', 'columns', 'roof', 'dome')   # na_part 앞부분 → 본관
EXPORT_NEAR = (-110.0, 110.0, -135.0, 75.0)   # building: 입체 부지 부품은 중심이 이 안이어야 (x0, x1, y0, y1)
EXPORT_BASE = (-130.0, 130.0, -150.0, 90.0)   # building: 자르는 경계 = 받침판 260 x 240 m (앞마당 y -120.5 포함)
EXPORT_BASE_DEPTH = 3.0                        # 받침판 두께 (m)
EXPORT_BASE_COLORS = ((0.30, 0.40, 0.24), (0.075, 0.075, 0.08))   # 받침판 윗면(부지 잔디가 없을 때)·옆면
EXPORT_CAMPUS_R = 650.0                        # campus: 중심에서 이 거리 밖(먼 도로·강 건너)은 자르거나 뺌
EXPORT_CAMPUS_SIDES = 48                       # campus 경계 정다각형 변 수
EXPORT_FLAT = (1.5, 0.02)   # 평평한 조각: 높이차 ≤ max(1.5 m, 가로 크기 x 2 %) → 경계에서 잘라 넣음
EXPORT_DRACO = {   # 실측: 수준 7 은 6 보다 11 % 작음(10 과 1 % 차). 위치 16 bit = 160 m 건물 2.5 mm · 1.3 km 캠퍼스 2 cm 단위(+12 %)
    'export_draco_mesh_compression_level': 7,
    'export_draco_position_quantization': 16,
    'export_draco_normal_quantization': 10,
}
EXPORT_GEOMETRY = ('MESH', 'CURVE', 'FONT', 'SURFACE', 'META')
# --glb-scopes 이름 → (범위, 시간대, 파일 이름)
EXPORT_VARIANTS = {
    'building': ('building', 'day', 'national_assembly.glb'),
    'night': ('building', 'night', 'national_assembly_night.glb'),
    'campus': ('campus', 'day', 'national_assembly_campus.glb'),
}


# --- 범위 (볼록 다각형 경계) ------------------------------------------------------

class _ExportRegion:
    """볼록 다각형 경계(자르기) + 입체 부품의 중심이 들어와야 하는 사각형."""

    def __init__(self, poly, near):
        self.poly = poly
        self.near = near
        self.planes = []                       # (점, 바깥쪽 단위 법선) — 다각형은 반시계 방향
        for i, (x0, y0) in enumerate(poly):
            x1, y1 = poly[(i + 1) % len(poly)]
            n = Vector((y1 - y0, x0 - x1, 0.0)).normalized()
            self.planes.append((Vector((x0, y0, 0.0)), n))

    def _extremes(self, lo, hi, n):
        """상자들(lo, hi: (k,3))의 n 방향 최소·최대 투영."""
        a = np.where(n.x > 0, lo[:, 0], hi[:, 0]) * n.x + np.where(n.y > 0, lo[:, 1], hi[:, 1]) * n.y
        b = np.where(n.x > 0, hi[:, 0], lo[:, 0]) * n.x + np.where(n.y > 0, hi[:, 1], lo[:, 1]) * n.y
        return a, b

    def classify(self, lo, hi):
        """상자별 (경계 안에 다 들어옴, 경계와 겹침, 중심이 near 안) — 모두 (k,) bool."""
        inside = np.ones(len(lo), bool)
        overlap = np.ones(len(lo), bool)
        for p, n in self.planes:
            d = p.x * n.x + p.y * n.y
            mn, mx = self._extremes(lo, hi, n)
            inside &= mx <= d + 1e-6
            overlap &= mn < d
        xs = [q[0] for q in self.poly]
        ys = [q[1] for q in self.poly]
        overlap &= (lo[:, 0] < max(xs)) & (hi[:, 0] > min(xs)) & (lo[:, 1] < max(ys)) & (hi[:, 1] > min(ys))
        c = (lo + hi) / 2
        x0, x1, y0, y1 = self.near
        near = (c[:, 0] >= x0) & (c[:, 0] <= x1) & (c[:, 1] >= y0) & (c[:, 1] <= y1)
        return inside, overlap, near


def _export_region(scope):
    if scope == 'building':
        x0, x1, y0, y1 = EXPORT_BASE
        return _ExportRegion([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], EXPORT_NEAR)
    r, n = EXPORT_CAMPUS_R, EXPORT_CAMPUS_SIDES
    poly = [(r * math.cos(2 * math.pi * (k + 0.5) / n), r * math.sin(2 * math.pi * (k + 0.5) / n)) for k in range(n)]
    return _ExportRegion(poly, (-r, r, -r, r))


def _export_flat(lo, hi):
    ext = np.maximum(hi[:, 0] - lo[:, 0], hi[:, 1] - lo[:, 1])
    return hi[:, 2] - lo[:, 2] <= np.maximum(EXPORT_FLAT[0], EXPORT_FLAT[1] * ext)


def _export_is_building(obj):
    return str(obj.get('na_part', '')).split('_')[0] in EXPORT_BUILDING_PARTS


# --- 메시 섬(연결 성분) 자르기 ------------------------------------------------------

def _export_world_coords(me, mw):
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    m = np.array(mw)
    return co @ m[:3, :3].T + m[:3, 3]


def _export_islands(me):
    """꼭짓점별 연결 성분 번호 (0..k-1) — numpy 유니온-파인드 (갈고리 걸기 + 포인터 점프)."""
    n = len(me.vertices)
    e = np.empty(len(me.edges) * 2, dtype=np.int64)
    me.edges.foreach_get('vertices', e)
    e = e.reshape(-1, 2)
    par = np.arange(n)
    while True:
        while True:                                   # 뿌리까지 압축
            nxt = par[par]
            if np.array_equal(nxt, par):
                break
            par = nxt
        a, b = par[e[:, 0]], par[e[:, 1]]
        diff = a != b
        if not diff.any():
            break
        np.minimum.at(par, np.maximum(a[diff], b[diff]), np.minimum(a[diff], b[diff]))
    return np.unique(par, return_inverse=True)[1]


def _export_clip(bm, region):
    """볼록 경계 밖을 잘라내고 잘린 단면(닫힌 고리)을 면으로 메웁니다."""
    for p, n in region.planes:
        d = p.dot(n)
        if not any(v.co.dot(n) > d + 1e-4 for v in bm.verts):
            continue
        ret = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-4,
                                     plane_co=p, plane_no=n, clear_outer=True)
        rim = [g for g in ret['geom_cut'] if isinstance(g, bmesh.types.BMEdge) and g.is_valid and g.is_boundary]
        if rim:
            for f in bmesh.ops.holes_fill(bm, edges=rim, sides=0)['faces']:
                f.normal_update()
                if f.normal.dot(n) < 0:
                    f.normal_flip()


def _export_cut(obj, dg, region):
    """부분만 경계에 걸친 오브젝트 → 남길 섬만 모아(평평한 섬은 경계에서 잘라) 새 임시 오브젝트.
    남기는 섬: 평평하고 경계와 겹치는 것, 또는 경계 안에 다 들어오고 중심이 near 안인 입체.
    반환: (오브젝트, 평평한 섬의 최저 z 또는 None) — 남길 섬이 없으면 (None, None)."""
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    try:
        if not len(me.vertices):
            return None, None
        co = _export_world_coords(me, obj.matrix_world)
        lab = _export_islands(me)
        k = lab.max() + 1
        lo = np.full((k, 3), np.inf)
        hi = np.full((k, 3), -np.inf)
        np.minimum.at(lo, lab, co)
        np.maximum.at(hi, lab, co)
        inside, overlap, near = region.classify(lo, hi)
        flat = _export_flat(lo, hi)
        keep = (flat & overlap) | (inside & near)
        if not keep.any():
            return None, None
        flat_z = float(lo[keep & flat, 2].min()) if (keep & flat).any() else None
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.transform(obj.matrix_world)
        bm.verts.ensure_lookup_table()
        drop = np.nonzero(~keep[lab])[0]
        if len(drop):
            bmesh.ops.delete(bm, geom=[bm.verts[i] for i in drop], context='VERTS')
        if (keep & ~inside).any():
            _export_clip(bm, region)
        mats = [s.material for s in obj.material_slots]
    finally:
        ev.to_mesh_clear()
    mesh = bpy.data.meshes.new(obj.name + '_web')
    bm.to_mesh(mesh)
    bm.free()
    for m in mats:
        mesh.materials.append(m)
    cut = bpy.data.objects.new(obj.name + '_web', mesh)
    obj.users_collection[0].objects.link(cut)
    cut['na_part'] = obj.get('na_part', 'site')
    return cut, flat_z


# --- 범위 고르기 --------------------------------------------------------------------

def _export_bbox(obj, dg):
    ev = obj.evaluated_get(dg)
    pts = [obj.matrix_world @ Vector(c) for c in ev.bound_box]
    lo = np.array([[min(p[i] for p in pts) for i in range(3)]])
    hi = np.array([[max(p[i] for p in pts) for i in range(3)]])
    return lo, hi


def _export_collect(scope):
    """범위에 들어갈 오브젝트 목록과 임시로 만든(잘라낸) 오브젝트 목록, 평평한 부지의 최저 z.
    본관 부품은 늘 넣고, 나머지는 경계 상자로: 경계 밖 → 뺌, 경계 안이고 (중심이 near 안 또는 평평) → 통째로,
    걸쳐 있으면 섬 단위로 자름 — 곡선·글자도 평가된 메시로 자릅니다
    (링크 복제 메시·자식 있는 것·지오메트리 노드 인스턴스는 자르지 않고 뺌)."""
    region = _export_region(scope)
    dg = bpy.context.evaluated_depsgraph_get()
    keep, temps, flat_z = [], [], []
    for obj in list(bpy.context.view_layer.objects):
        if obj.type not in EXPORT_GEOMETRY or obj.hide_render or not obj.visible_get():
            continue
        if _export_is_building(obj):
            keep.append(obj)
            continue
        lo, hi = _export_bbox(obj, dg)
        inside, overlap, near = (v[0] for v in region.classify(lo, hi))
        flat = bool(_export_flat(lo, hi)[0])
        if not overlap:
            continue
        if inside and (near or flat):
            keep.append(obj)
            if flat:
                flat_z.append(lo[0, 2])
        elif ((obj.type != 'MESH' or obj.data.users == 1) and not obj.children
              and not any(m.type == 'NODES' for m in obj.modifiers)):     # GN 인스턴스는 to_mesh 에 없음
            cut, z = _export_cut(obj, dg, region)
            if cut is not None:
                keep.append(cut)
                temps.append((obj, cut))
                if z is not None:
                    flat_z.append(z)
    return keep, temps, (min(flat_z) if flat_z else 0.0)


def _export_base(ctx, top_z):
    """building 범위 받침판: 윗면은 부지 잔디 대표색(없으면 중립 녹회색), 옆·밑면은 짙은 색."""
    grass = ctx.mats.get('grass')
    top_col = tuple(grass['na_flat']['color']) if grass is not None and 'na_flat' in grass else EXPORT_BASE_COLORS[0]
    top = new_pbr('Web_Base_Top', top_col, 0.95)[0]
    side = new_pbr('Web_Base_Side', EXPORT_BASE_COLORS[1], 0.7)[0]
    x0, x1, y0, y1 = EXPORT_BASE
    bm = bmesh.new()
    bm_box(bm, (x0 + x1) / 2, (y0 + y1) / 2, top_z - EXPORT_BASE_DEPTH, x1 - x0, y1 - y0, EXPORT_BASE_DEPTH)
    bm.normal_update()
    for f in bm.faces:
        f.material_index = 0 if f.normal.z > 0.5 else 1
    return finish_mesh('Web_Base', bm, ctx.root, [top, side], part='site'), (top, side)


# --- 재질 ---------------------------------------------------------------------------

def flatten_for_web(night):
    """쓰이는 재질을 모두 대표색 Principled 로. 낮에는 발광을 끄고, 밤에는 na_flat 발광(창·LED·등)만 남깁니다.
    밤 발광 상한: 창·LED 는 EXPORT_NIGHT_EMIT_MAX (웹 톤매핑에서 제 색 유지), 원래 아주 밝은 등기구는
    EXPORT_NIGHT_LAMP (1 초과 → KHR_materials_emissive_strength, 흰빛 광원으로 보임).
    이미 평평하게 만든 재질(과 그 발광 사본)은 건너뜁니다 — 같은 빌드로 여러 범위를 내보낼 때."""
    for mat in bpy.data.materials:
        if not mat.users or mat.get('na_web_flat'):
            continue
        flatten_material(mat)
        mat['na_web_flat'] = True
        emit = principled(mat).inputs['Emission Strength']
        peak = max(principled(mat).inputs['Emission Color'].default_value[:3])
        cap = EXPORT_NIGHT_LAMP[1] if peak * emit.default_value >= EXPORT_NIGHT_LAMP[0] else EXPORT_NIGHT_EMIT_MAX
        emit.default_value = min(emit.default_value, cap / max(peak, 1e-6)) if night else 0.0


# --- 밤 GLB: 건축 조명 흉내 ------------------------------------------------------------
# 조명 섹션의 업라이트·투광등(램프)은 GLB 에 들어가지 않고 model-viewer 는 환경광만 쓰므로, 밤 GLB 에서는
# 조명을 받는 면을 '빛 받은 색'의 발광 재질로 바꿉니다. 세로 밝기 변화는 2 x 32 px 발광 텍스처 + 높이 UV.
# (규칙 이름, 대상 na_part (정확히 일치), 빛 색, 세기, (z0, z1, z0 밝기, z1 밝기) 또는 None = 균일,
#  대상 면: 'side' = 옆면, 'fascia' = 열주 중심선 밖의 옆면(처마·파라펫 앞면, 옥상 설비 제외), 'all' = 전부)
# dome_rod(피뢰침)는 일부러 뺍니다 — 투광등은 돔 표면(셸·줄눈·테두리)을 비춥니다.
EXPORT_NIGHT_LIT = (
    ('columns', ('columns',), (1.0, 0.78, 0.55), 1.0, (PODIUM_H, ROOF_Z0, 1.0, 0.28), 'side'),  # 열주 업라이트 (3000 K)
    ('roof', ('roof',), (1.0, 0.85, 0.68), 0.45, None, 'fascia'),                                # 처마 앞면 워시
    ('drum', ('dome_drum',), (0.80, 0.94, 1.0), 0.28, None, 'side'),                            # 돔 받침: 스치는 빛
    ('dome', ('dome_shell', 'dome'), (0.80, 0.94, 1.0), 0.75, (DOME_Z0, TOTAL_H, 1.0, 0.45), 'all'),  # 투광등 돔
)
EXPORT_LIT_UV = 'NA_WebLitZ'  # 높이 UV 층 이름 (섹션이 만든 'UVMap' 과 겹치지 않게)
EXPORT_NIGHT_EMIT_MAX = 0.9   # 밤 웹 발광 상한 (색 x 세기의 최대 채널): 창·LED 가 흰색으로 날아가지 않고 제 색으로
EXPORT_NIGHT_LAMP = (8.0, 3.0)  # 원래 발광(색 x 세기 최대 채널)이 8 이상인 등기구는 3 까지 → 흰빛 광원
#                                 (1 을 넘으므로 KHR_materials_emissive_strength 로 나갑니다)
EXPORT_NIGHT_SKY = {        # env_night.hdr (선형 복사휘도): 짙은 남색 하늘, 지평선의 도시 불빛, 흐린 달
    'zenith': (0.010, 0.015, 0.034), 'horizon': (0.050, 0.058, 0.085), 'glow': (0.070, 0.050, 0.028),
    'ground': (0.030, 0.028, 0.025), 'moon': (3.0, 3.1, 3.5), 'moon_dir': (-0.45, -0.55, 0.70),
}


def _export_srgb(v):
    v = np.clip(v, 0.0, 1.0)
    return np.where(v <= 0.0031308, 12.92 * v, 1.055 * np.power(v, 1 / 2.4) - 0.055)


def _export_emits(mat):
    """평평하게 만든 재질이 이미 스스로 빛나는지 (창·LED·등기구)."""
    bsdf = principled(mat)
    return bsdf.inputs['Emission Strength'].default_value * max(bsdf.inputs['Emission Color'].default_value[:3]) > 0


def _export_lit_twin(mat, rule, cache):
    """평평한 재질 → 같은 바탕색에 '빛 받은 색' 발광을 더한 사본 (세로 기울기면 발광 텍스처)."""
    key = (mat.name, rule[0])
    if key not in cache:
        _, _, tint, strength, grad, _ = rule
        twin = mat.copy()
        twin.name = f'{mat.name}_Lit_{rule[0]}'
        nt, bsdf = twin.node_tree, principled(twin)
        lit = np.array(bsdf.inputs['Base Color'].default_value[:3]) * np.array(tint)
        if grad is None:
            bsdf.inputs['Emission Color'].default_value = (*lit, 1.0)
        else:
            t = (np.arange(32) + 0.5) / 32                     # 아래(z0) → 위(z1)
            b = grad[3] + (grad[2] - grad[3]) * (1 - t) ** 1.6
            px = np.ones((32, 2, 4))
            px[:, :, :3] = _export_srgb(lit[None, :] * b[:, None])[:, None, :]
            img = bpy.data.images.new(twin.name, 2, 32)
            img.pixels.foreach_set(px.ravel().astype(np.float32))
            img.pack()
            tex = node(nt, 'ShaderNodeTexImage', image=img, extension='EXTEND')
            uv = node(nt, 'ShaderNodeUVMap', uv_map=EXPORT_LIT_UV)
            link(nt, uv.outputs['UV'], tex.inputs['Vector'])
            link(nt, tex.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = strength
        cache[key] = twin
    return cache[key]


def _export_light_mesh(obj, rule, cache):
    """한 메시(obj 가 대표 사용자): 대상 면의 재질 번호를 발광 사본으로 돌리고, 기울기가 있으면 높이 UV 를 답니다."""
    me = obj.data
    m3 = np.array(obj.matrix_world.to_3x3())
    nrm = np.empty(len(me.polygons) * 3)
    me.polygons.foreach_get('normal', nrm)
    nw = nrm.reshape(-1, 3) @ m3.T
    sel = np.abs(nw[:, 2]) < 0.5 * np.maximum(np.linalg.norm(nw, axis=1), 1e-9)
    if rule[5] == 'fascia':
        cen = np.empty(len(me.polygons) * 3)
        me.polygons.foreach_get('center', cen)
        cen = cen.reshape(-1, 3) @ m3.T + np.array(obj.matrix_world.translation)
        sel &= (np.abs(cen[:, 0]) > L / 2) | (np.abs(cen[:, 1]) > W / 2)
    elif rule[5] == 'all':
        sel[:] = True
    mi = np.empty(len(me.polygons), np.int64)
    me.polygons.foreach_get('material_index', mi)
    new = mi.copy()
    for i, mat in enumerate(list(me.materials)):
        if mat is not None and not _export_emits(mat):          # 등기구·LED 는 제 발광 그대로
            me.materials.append(_export_lit_twin(mat, rule, cache))
            new[(mi == i) & sel] = len(me.materials) - 1
    me.polygons.foreach_set('material_index', new)
    if rule[4] is not None:
        z0, z1 = rule[4][:2]
        co = _export_world_coords(me, obj.matrix_world)
        vi = np.empty(len(me.loops), np.int64)
        me.loops.foreach_get('vertex_index', vi)
        uv = np.stack([np.full(len(vi), 0.5), np.clip((co[vi, 2] - z0) / (z1 - z0), 0, 1)], 1)
        me.uv_layers.new(name=EXPORT_LIT_UV).data.foreach_set('uv', uv.ravel())


def _export_night_rule(obj):
    part = obj.get('na_part')
    return next((r for r in EXPORT_NIGHT_LIT if part in r[1]), None)


def _export_lit_shareable(users, rule):
    """링크 복제(메시 공유) 사용자들이 같은 발광 사본·높이 UV 를 쓸 수 있는지: 같은 규칙이고, 월드 행렬의 z 행
    (높이·수평 판정을 정함)이 같아야 합니다. 'fascia' 는 x·y 위치도 보므로 행렬 전체가 같아야 합니다."""
    ref = np.array(users[0].matrix_world)
    rows = slice(None) if rule[5] == 'fascia' else slice(2, 3)
    return all(_export_night_rule(o) is rule and np.allclose(np.array(o.matrix_world)[rows], ref[rows], atol=1e-4)
               for o in users[1:])


def _export_night_lighting():
    """밤: 열주·처마·돔에 건축 조명 흉내 발광 (한 빌드에 한 번만 적용). 메시 단위로 한 번씩 — 링크 복제로
    공유된 메시(예: instance() 로 세운 열주)는 사용자들이 조건을 만족하면 대표 하나로 처리하고, 아니면 알립니다."""
    cache = {}
    by_mesh = {}
    for obj in bpy.context.view_layer.objects:
        if obj.type == 'MESH' and _export_is_building(obj):
            by_mesh.setdefault(obj.data, []).append(obj)
    for me, users in by_mesh.items():
        rule = _export_night_rule(users[0])
        if rule is None or me.get('na_web_lit'):
            continue
        if any(s.link == 'OBJECT' for o in users for s in o.material_slots):
            print(f'밤 GLB: {users[0].name} 는 오브젝트 재질 슬롯이라 건축 조명 발광을 건너뜀')
            continue
        if me.users > len(users) or (len(users) > 1 and not _export_lit_shareable(users, rule)):
            print(f'밤 GLB: 메시 {me.name} 를 공유하는 오브젝트 {me.users}개의 태그·높이가 달라 조명 발광을 건너뜀')
            continue
        me['na_web_lit'] = True
        _export_light_mesh(users[0], rule, cache)


def export_night_env(path, w=64, h=32):
    """밤 GLB 용 model-viewer environment-image: 작은 등장방형 Radiance HDR (RLE 스캔라인).
    three.js 규약: u = atan2(z, x) / 2π + 0.5, 첫 줄이 위(+Y). 좌표는 glTF."""
    sky = EXPORT_NIGHT_SKY
    u = (np.arange(w) + 0.5) / w
    lat = (0.5 - (np.arange(h) + 0.5) / h) * math.pi
    ph, la = np.meshgrid((u - 0.5) * 2 * math.pi, lat)
    d = np.stack([np.cos(la) * np.cos(ph), np.sin(la), np.cos(la) * np.sin(ph)], -1)
    y = d[..., 1:2]
    t = np.clip(y, 0, 1) ** 0.45
    img = np.array(sky['horizon']) * (1 - t) + np.array(sky['zenith']) * t
    img = img + np.array(sky['glow']) * np.exp(-np.clip(y, 0, 1) / 0.06)
    img = np.where(y >= 0, img, np.array(sky['ground']))
    moon = Vector(sky['moon_dir']).normalized()
    ang = np.arccos(np.clip(d @ np.array(_export_gltf(moon)), -1, 1))
    img = img + np.array(sky['moon']) * np.exp(-(ang / 0.07) ** 2)[..., None]
    v = img.max(axis=2)
    m, e = np.frexp(v)
    rgbe = np.zeros((h, w, 4), np.uint8)
    rgbe[..., :3] = np.clip(img * (m * 256.0 / np.maximum(v, 1e-32))[..., None], 0, 255)
    rgbe[..., 3] = np.where(v > 1e-32, e + 128, 0)
    out = bytearray(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % (h, w))
    for row in rgbe:
        out += bytes((2, 2, w >> 8, w & 255))
        for c in range(4):
            out += bytes((w,)) + row[:, c].tobytes()          # 반복 없는 리터럴 한 덩어리 (w ≤ 128)
    with open(path, 'wb') as f:
        f.write(bytes(out))
    return path


# --- GLB ----------------------------------------------------------------------------

def export_glb(ctx, path, draco=True, scope='building'):
    """현재 장면에서 scope 범위만 GLB 로. 재질을 평평하게 바꾸므로(한 방향) 빌드의 마지막 단계에서만 부릅니다.
    임시 오브젝트(잘라낸 부지·받침판)는 내보낸 뒤 지워서 같은 빌드로 다른 범위를 이어서 내보낼 수 있습니다."""
    assert scope in ('building', 'campus'), scope
    flatten_for_web(ctx.night)
    if ctx.night:
        _export_night_lighting()
    keep, temps, flat_z = _export_collect(scope)
    extra_mats = ()
    if scope == 'building':
        base, extra_mats = _export_base(ctx, min(flat_z, 0.0) - 0.03)
        keep.append(base)
        temps.append((None, base))
    renamed = []
    for src, cut in temps:              # 잘라낸 사본이 원래 오브젝트·메시 이름을 쓰도록 (뷰어에서 읽기 쉬운 이름)
        if src is not None:
            for a, b in ((src, cut), (src.data, cut.data)):
                name = a.name
                a.name = name + '.src'
                b.name = name
                renamed.append((a, name))
    sel = set(keep)
    for obj in keep:                    # 부모 Empty 도 함께 선택 (자식 변환이 부모 기준이므로)
        p = obj.parent
        while p is not None:
            if p.type == 'EMPTY':
                sel.add(p)
            p = p.parent
    for obj in bpy.context.view_layer.objects:
        obj.select_set(obj in sel)
    try:
        with _export_quiet():
            bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True,
                                      export_yup=True, export_cameras=False, export_lights=False,
                                      export_extras=False, export_animations=False, export_gpu_instances=False,
                                      export_gn_mesh=True,
                                      export_draco_mesh_compression_enable=draco,
                                      **EXPORT_DRACO)
    finally:
        for obj in bpy.context.view_layer.objects:
            obj.select_set(False)
        for _, cut in temps:
            me = cut.data
            bpy.data.objects.remove(cut, do_unlink=True)
            bpy.data.meshes.remove(me)
        for src, name in renamed:
            src.name = name
        for m in extra_mats:
            bpy.data.materials.remove(m)
    return path


@contextlib.contextmanager
def _export_quiet():
    """Draco 인코더(C++)가 메시마다 표준 출력에 찍는 줄을 내보내는 동안만 버립니다 (오류는 stderr 로 그대로).
    표준 출력 파일 기술자가 없는 환경(일부 GUI)에서는 아무것도 하지 않습니다."""
    try:
        sys.stdout.flush()
        saved, null = os.dup(1), os.open(os.devnull, os.O_WRONLY)
    except (OSError, ValueError, AttributeError):
        yield
        return
    os.dup2(null, 1)
    try:
        yield
    finally:
        os.dup2(saved, 1)
        os.close(null)
        os.close(saved)


def glb_stats(path):
    """GLB 요약: 크기, 그려지는 삼각형(인스턴스 포함)·저장된 삼각형, 메시·노드·재질 수, 발광 재질."""
    with open(path, 'rb') as f:
        data = f.read()
    clen = struct.unpack_from('<I', data, 12)[0]
    j = json.loads(data[20:20 + clen])
    acc = j.get('accessors', [])
    per_mesh = []
    for m in j.get('meshes', []):
        t = 0
        for p in m['primitives']:
            if p.get('mode', 4) == 4:
                t += acc[p['indices'] if 'indices' in p else p['attributes']['POSITION']]['count'] // 3
        per_mesh.append(t)
    drawn = 0
    for nd in j.get('nodes', []):
        if 'mesh' in nd:
            inst = nd.get('extensions', {}).get('EXT_mesh_gpu_instancing')
            k = acc[next(iter(inst['attributes'].values()))]['count'] if inst else 1
            drawn += per_mesh[nd['mesh']] * k
    emissive = [m.get('name', '?') for m in j.get('materials', []) if any(m.get('emissiveFactor', (0, 0, 0)))]
    return {'bytes': len(data), 'tris': drawn, 'tris_stored': sum(per_mesh), 'meshes': len(per_mesh),
            'nodes': len(j.get('nodes', [])), 'materials': len(j.get('materials', [])), 'emissive': emissive,
            'extensions': j.get('extensionsUsed', [])}


def glb_report(path):
    """내보낸 GLB 한 줄 요약 (크기·삼각형·메시·노드·재질·발광 재질 수)."""
    st = glb_stats(path)
    return (f"wrote {path}  ({st['bytes'] / 1e6:.2f} MB, 삼각형 {st['tris']:,} (저장 {st['tris_stored']:,}), "
            f"메시 {st['meshes']} · 노드 {st['nodes']} · 재질 {st['materials']}, 발광 재질 {len(st['emissive'])})")


# --- 핫스팟 -------------------------------------------------------------------------

def _export_gltf(v):
    """블렌더 (x, y, z) → glTF/model-viewer (x, z, -y)."""
    return (v[0], v[2], -v[1])


def _export_building_anchors():
    """본관 앵커: (id, 이름, 설명, 목표점, 바깥쪽 법선, 보기 거리). 모두 공유 치수에서 계산합니다."""
    front = sorted(x for (x, y) in column_positions() if abs(y + W / 2) < 1e-6)
    floors = floor_levels()
    th = math.radians(18.0)                                   # 돔 꼭대기에서 앞쪽으로 조금 내려온 점
    dome_r = ((DOME_D / 2) ** 2 + DOME_H ** 2) / (2 * DOME_H)
    dome_n = Vector((0.0, -math.sin(th), math.cos(th)))
    dome_p = Vector((0.0, 0.0, TOTAL_H - dome_r)) + dome_n * dome_r
    slope = math.atan2(PODIUM_H, -PODIUM_Y / 2 - STAIR_FOOT_Y)
    stair_n = Vector((0.0, -math.sin(slope), math.cos(slope)))
    eave_x, eave_y = L / 2 + ROOF_OVERHANG, W / 2 + ROOF_OVERHANG
    bay = (front[1] + front[2]) / 2          # 왼쪽 두 번째 열주 칸 가운데 (열주에 가리지 않음)
    return [
        ('dome', '돔', f'밑지름 {DOME_D:.0f} m · 높이 {DOME_H:.0f} m · 동판 녹청 (지면에서 꼭대기 {TOTAL_H:.1f} m)',
         dome_p, dome_n, 120),
        ('columns', f'열주 {len(column_positions())}개',
         f'높이 {COL_H:g} m · 24절기를 뜻하고 전면 {COLS_FRONT}개는 팔도',
         Vector((front[-3], -W / 2, PODIUM_H + COL_H / 2)), Vector((0, -1, 0)), 90),
        ('eaves', '처마', f'{2 * eave_x:.0f} x {2 * eave_y:.0f} m 평지붕 슬래브, 밑면 {ROOF_Z0:.1f} m',
         Vector((-eave_x + 4.0, -eave_y, ROOF_Z0 + EAVES_H / 2)), Vector((0, -1, 0)), 110),
        ('stair', '대계단', f'너비 {STAIR_W:.0f} m · 기단면 {PODIUM_H:g} m 까지 오르는 정면 계단',
         Vector((0.0, (-PODIUM_Y / 2 + STAIR_FOOT_Y) / 2, PODIUM_H / 2)), stair_n, 90),
        ('podium', '기단', f'높이 {PODIUM_H:g} m · {PODIUM_X:.0f} x {PODIUM_Y:.0f} m 화강석, 안에 지상 1층',
         Vector(((STAIR_W / 2 + PODIUM_X / 2) / 2, -PODIUM_Y / 2, PODIUM_H / 2)), Vector((0, -1, 0)), 100),
        ('led', 'LED 그릴', '정면 위층 격자형 LED 패널 — 밤엔 태극기를 띄웁니다',
         Vector((0.0, -BODY_Y / 2, (floors[2][0] + ROOF_Z0) / 2)), Vector((0, -1, 0)), 80),
        ('body', '본체', f'{BODY_X:.0f} x {BODY_Y:.0f} m · 기단 위 {FLOORS}개 층, 열주 뒤 {GALLERY_D:g} m 회랑',
         Vector((bay, -BODY_Y / 2, floors[1][0] + floors[1][1] / 2)), Vector((0, -1, 0)), 90),
    ]


# 부지 앵커: (id, 이름, 설명, (x, y), 범위, 지면 위 최소 높이) — 위에서 광선을 쏴 맞은 점이 ground_z(x, y) 보다
# 그만큼 높을 때만 씀 (물체가 실제로 있을 때). 음수는 지형 자체: ground_z 가 의원동산을 품고 있으므로
# 맞은 점이 그 높이(-0.5 m 허용) 이상이면 부지가 동산을 만든 것 (평지면 한참 아래에서 맞음).
# 위치는 spec/research_spec.md (OSM 기반) 의 요소 11, 17, 19, 21, 23, 24.
# (id, 이름, 설명, (x, y), 범위, 최소 높이, 클릭하면 갈 camera-orbit — None 이면 법선 방향 자동)
EXPORT_SITE_ANCHORS = (
    ('bronze', '애국애족의 군상', '대계단 발치 양쪽 받침 위 청동 군상 (김세중, 1976)', (-32.3, -90.0),
     ('building',), 2.0, '-25deg 72deg 32m'),
    ('fountain', '분수', '잔디광장 가운데 · 평화와 번영의 상 (김세중, 1978)', (0.0, -223.0), ('campus',), 0.3,
     '0deg 62deg 75m'),
    ('haetae', '해태상', '정문 안쪽 좌우 한 쌍, 밖을 바라봄 (이순석, 1975)', (-30.0, -372.0), ('campus',), 1.5,
     '-20deg 78deg 16m'),
    ('library', '국회도서관', '잔디광장 오른쪽 · 지하 1층 / 지상 5층 화강석 건물', (164.0, -222.5), ('campus',), 8.0,
     '-35deg 62deg 190m'),
    ('members', '의원회관', '잔디광장 왼쪽 · 10층 (약 40 m) 국회의원 사무실', (-168.0, -223.0), ('campus',), 8.0,
     '35deg 62deg 210m'),
    ('mound', '의원동산', f'옛 양말산 자리의 낮은 언덕 (약 {MOUND_H:g} m) · 한옥 사랑재', MOUND_CENTER, ('campus',),
     -0.5, '-40deg 55deg 230m'),
)


EXPORT_HOTSPOT_LIFT = 0.05   # 앵커를 맞은 표면에서 법선 쪽으로 띄우는 거리 (m) — 점이 표면 위에 얹히도록


def _export_orbit(n, dist):
    """앵커를 정면으로 보는 model-viewer camera-orbit (theta 는 +Z(정면)에서 +X 쪽, phi 는 위에서)."""
    g = _export_gltf(n)
    theta = math.degrees(math.atan2(g[0], g[2])) if math.hypot(g[0], g[2]) > 0.3 else -30.0
    phi = min(75.0, max(40.0, math.degrees(math.acos(max(-1.0, min(1.0, g[1]))))))
    return f'{theta:.0f}deg {phi:.0f}deg {dist:.0f}m'


def _export_hotspot(hid, label, desc, pos, n, scopes, dist):
    p = [round(v, 2) + 0.0 for v in _export_gltf(pos)]              # + 0.0: -0.0 → 0.0
    g = [round(v, 3) + 0.0 for v in _export_gltf(n)]
    return {'id': hid, 'label': label, 'desc': desc, 'scopes': list(scopes),
            'position': p, 'normal': g,
            'data_position': ' '.join(f'{v:.2f}m' for v in p), 'data_normal': ' '.join(f'{v:.3f}m' for v in g),
            'orbit': _export_orbit(n, dist)}


def export_hotspots(ctx, path, scope=None):
    """model-viewer 핫스팟 앵커를 JSON 목록으로 씁니다 (scope 를 주면 그 범위 것만).
    본관 앵커는 공유 치수로 목표점을 잡고 바깥에서 광선을 쏴 실제 표면에 붙입니다 (못 맞히면 목표점 그대로).
    부지 앵커는 위에서 광선을 쏴 해당 물체가 실제로 있을 때만 넣습니다.
    항목: id, label, desc, scopes, position/normal (glTF 좌표 m), data_position/data_normal (속성 문자열), orbit."""
    dg = bpy.context.evaluated_depsgraph_get()
    scene = ctx.scene
    out = []
    for hid, label, desc, target, n, dist in _export_building_anchors():
        hit, loc, *_ = scene.ray_cast(dg, target + n * 6.0, -n, distance=12.0)
        scopes = ('building', 'campus') if hid == 'dome' else ('building',)   # 캠퍼스 축척에선 돔만 (겹침 방지)
        anchor = (loc if hit else target) + n * EXPORT_HOTSPOT_LIFT
        out.append(_export_hotspot(hid, label, desc, anchor, n, scopes, dist))
    up = Vector((0.0, 0.0, 1.0))
    for hid, label, desc, (x, y), scopes, min_h, orbit in EXPORT_SITE_ANCHORS:
        hit, loc, *_ = scene.ray_cast(dg, Vector((x, y, 400.0)), -up, distance=800.0)
        if hit and loc.z - ground_z(x, y) >= min_h:
            spot = _export_hotspot(hid, label, desc, loc + up * EXPORT_HOTSPOT_LIFT, up, scopes,
                                   60 + 2 * max(0.0, loc.z - ground_z(x, y)))
            if orbit:
                spot['orbit'] = orbit
            out.append(spot)
    if scope is not None:
        out = [h for h in out if scope in h['scopes']]
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    return out


# ----------------------------------------------------------------------------
# 빌드 · 검증 · 렌더 · 내보내기
# ----------------------------------------------------------------------------

def build(tod='day', site=True, seed=1975):
    """장면을 비우고 국회의사당을 처음부터 짓습니다. 반환: Ctx"""
    clear_scene()
    ctx = Ctx(tod=tod, site=site, seed=seed)
    ctx.mats.update(build_materials(ctx))
    if site:
        build_site(ctx)
        build_landmarks(ctx)
    build_podium(ctx)
    build_body(ctx)
    build_columns(ctx)
    build_roof(ctx)
    build_dome(ctx)
    build_world(ctx)
    build_lights(ctx)
    ctx.cameras = build_cameras(ctx)
    bpy.context.view_layer.update()
    return ctx


def _world_bbox(objs):
    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        ev = o.evaluated_get(dg)
        if ev.type != 'MESH':
            continue
        mw = ev.matrix_world
        for v in ev.data.vertices:
            p = mw @ v.co
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    return lo, hi


def validate(ctx):
    """실제 치수와 비교. (이름, 기대값, 실제값, 허용오차) 목록과 실패 수를 돌려줍니다."""
    bpy.context.view_layer.update()
    tagged = lambda *parts: [o for o in bpy.data.objects if o.get('na_part') in parts]
    checks = []
    shell = tagged('dome_shell')
    if shell:
        lo, hi = _world_bbox(shell)
        checks.append(('돔 밑지름 (m)', DOME_D, hi[0] - lo[0], 1.5))
        checks.append(('돔 높이 (m)', DOME_H, hi[2] - DOME_Z0, 1.0))
        checks.append(('돔 꼭대기 높이 (m)', TOTAL_H, hi[2], 0.8))
        checks.append(('자료상 높이 70 m 와의 차이', PUBLISHED_H, hi[2], 1.5))
    else:
        checks.append(('돔 셸(na_part=dome_shell) 존재', 1, 0, 0))
    building = [o for o in bpy.data.objects if str(o.get('na_part', '')).split('_')[0]
                in ('podium', 'body', 'columns', 'roof', 'dome')]
    lo, hi = _world_bbox([o for o in building if o.get('na_part') != 'dome_rod'])
    checks.append(('건물 최고 높이 (피뢰침 제외, m)', TOTAL_H, hi[2], 1.5))
    deck = tagged('podium_deck')
    checks.append(('기단면 높이 (na_part=podium_deck 윗면, m)', PODIUM_H,
                   _world_bbox(deck)[1][2] if deck else -1.0, 0.05))
    cols = column_positions()
    xs = [p[0] for p in cols]
    ys = [p[1] for p in cols]
    checks.append(('열주 수', 24, ctx.stats.get('columns', 0), 0))
    checks.append(('열주 중심선 길이 (m)', L, max(xs) - min(xs), 0.01))
    checks.append(('열주 중심선 폭 (m)', W, max(ys) - min(ys), 0.01))
    body = tagged('body')
    if body:
        blo, bhi = _world_bbox(body)
        checks.append(('본체 길이 (자료 122 m, 핀·출입구 돌출 포함)', BODY_X, bhi[0] - blo[0], 3.0))
        checks.append(('본체 폭 (자료 81 m, 핀·출입구 돌출 포함)', BODY_Y, bhi[1] - blo[1], 6.0))
    col_objs = tagged('columns')
    if col_objs:
        clo, chi = _world_bbox(col_objs)
        checks.append(('열주 윗면 = 처마 밑면 (m)', ROOF_Z0, chi[2], 0.6))
        checks.append(('열주 밑면 = 기단면 (m)', PODIUM_H, clo[2], 0.6))
    front = sum(1 for (_, y) in cols if y < -W / 2 + 0.01)
    checks.append(('전면 열주 수', 8, front, 0))
    fails = 0
    for name, want, got, tol in checks:
        ok = abs(got - want) <= tol
        fails += 0 if ok else 1
        print(f"  [{'OK ' if ok else 'FAIL'}] {name}: 기대 {want:g}, 실제 {got:.2f} (허용 ±{tol:g})")
    return checks, fails


def add_custom_cameras(ctx, specs):
    """--cam name=x,y,z/tx,ty,tz[/lens] 로 임시 카메라 추가 (부위 점검용 클로즈업)."""
    coll = ctx.coll('Cameras')
    for spec in specs or []:
        name, rest = spec.split('=', 1)
        parts = rest.split('/')
        loc = tuple(float(v) for v in parts[0].split(','))
        aim = tuple(float(v) for v in parts[1].split(','))
        cd = bpy.data.cameras.new(name)
        cd.lens = float(parts[2]) if len(parts) > 2 else 35.0
        cd.clip_end = 5000
        cam = bpy.data.objects.new('Cam_' + name, cd)
        cam.location = loc
        coll.objects.link(cam)
        track_to(cam, empty('Cam_' + name + '_Aim', aim, coll))
        ctx.cameras[name] = cam


def render_shots(shots, out_dir, samples, size, fmt, threads, site, cams=None, flat=False):
    """shots = [(tod, camera_name), ...]. 시간대마다 한 번 빌드하고 카메라별로 렌더."""
    written = []
    by_tod = {}
    for tod, cam in shots:
        by_tod.setdefault(tod, []).append(cam)
    for tod in TODS:
        if tod not in by_tod:
            continue
        ctx = build(tod, site=site)
        add_custom_cameras(ctx, cams)
        setup_render(ctx, samples, size, threads)
        if flat:                                   # 웹 GLB 에서 보일 평평한 대표색 미리보기
            flatten_for_web(ctx.night)
        scene = ctx.scene
        scene.render.image_settings.file_format = 'JPEG' if fmt == 'jpg' else 'PNG'
        if fmt == 'jpg':
            scene.render.image_settings.quality = 90
        for cam in by_tod[tod]:
            if cam not in ctx.cameras:
                print(f'카메라 {cam!r} 없음 — 건너뜀 (있는 것: {sorted(ctx.cameras)})')
                continue
            scene.camera = ctx.cameras[cam]
            path = os.path.join(out_dir, f'render_{tod}_{cam}{"_flat" if flat else ""}.{fmt}')
            scene.render.filepath = path
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            print(f'wrote {path}  ({time.time() - t0:.0f}s)')
            written.append(path)
    return written


def write_web_exports(out_dir, variants, draco, site):
    """--glb: 시간대마다 한 번 빌드해 범위별 GLB 를 씁니다. 첫 빌드에서 hotspots.json, 밤이면 env_night.hdr 도.
    (내보내기가 재질을 평평하게 바꾸므로 같은 시간대의 범위들은 한 빌드를 같이 씁니다)"""
    by_tod = {}
    for name in variants:
        if name not in EXPORT_VARIANTS:
            sys.exit(f'--glb-scopes: 모르는 이름 {name!r} (가능: {", ".join(EXPORT_VARIANTS)})')
        scope, tod, fname = EXPORT_VARIANTS[name]
        if scope == 'campus' and not site:
            print('--no-site 이므로 캠퍼스 GLB 는 건너뜀')
            continue
        by_tod.setdefault(tod, []).append((scope, fname))
    hotspots = None
    for tod in TODS:
        if tod not in by_tod:
            continue
        ctx = build(tod, site=site)
        if hotspots is None:
            hotspots = export_hotspots(ctx, os.path.join(out_dir, 'hotspots.json'))
            print(f'wrote hotspots.json  (앵커 {len(hotspots)}개)')
        if tod == 'night':
            export_night_env(os.path.join(out_dir, 'env_night.hdr'))
        for scope, fname in by_tod[tod]:
            print(glb_report(export_glb(ctx, os.path.join(out_dir, fname), draco, scope)))


def parse_args():
    argv = sys.argv
    if '--' in argv:
        user = argv[argv.index('--') + 1:]
    elif argv and argv[0].endswith('.py'):
        user = argv[1:]
    else:                                  # Blender 텍스트 에디터에서 실행
        user = []
    p = argparse.ArgumentParser(description='국회의사당 3D 모델 생성')
    p.add_argument('--out', default='./out', help='결과물 폴더 (기본 ./out)')
    p.add_argument('--blend', action='store_true', help='.blend 저장')
    p.add_argument('--glb', action='store_true',
                   help='웹 뷰어용 GLB (Draco): 건물 낮·밤, 캠퍼스 낮 + hotspots.json, env_night.hdr')
    p.add_argument('--glb-scopes', default=','.join(EXPORT_VARIANTS), metavar='LIST',
                   help='내보낼 GLB (쉼표): building=건물 낮, night=건물 밤, campus=캠퍼스 낮 (기본 전부)')
    p.add_argument('--no-draco', action='store_true', help='GLB 를 Draco 없이')
    p.add_argument('--render', action='store_true', help='--shots 목록 렌더')
    p.add_argument('--shots', default='', help='예: day:hero,night:hero (기본 DEFAULT_SHOTS)')
    p.add_argument('--tod', default='day', choices=TODS, help='GUI/--blend 장면 시간대')
    p.add_argument('--samples', type=int, default=128, help='렌더 샘플 수 (기본 128)')
    p.add_argument('--size', default='1920x1080', help='렌더 해상도 WxH (기본 1920x1080)')
    p.add_argument('--format', default='png', choices=('png', 'jpg'), help='렌더 파일 형식')
    p.add_argument('--threads', type=int, default=0, help='렌더 스레드 (0 = 자동)')
    p.add_argument('--no-site', action='store_true', help='잔디·광장·나무 등 주변 부지 생략 (건물만)')
    p.add_argument('--validate', action='store_true', help='치수 검사, 실패 시 종료 코드 1')
    p.add_argument('--flat', action='store_true', help='렌더 전에 재질을 GLB 대표색으로 (웹 미리보기)')
    p.add_argument('--cam', action='append', default=[],
                   help='임시 카메라 name=x,y,z/tx,ty,tz[/lens] (여러 번 가능, --shots day:name 으로 렌더)')
    return p.parse_args(user)


def main():
    args = parse_args()
    t_start = time.time()
    site = not args.no_site
    w, h = (int(v) for v in args.size.lower().split('x'))
    out_dir = os.path.abspath(args.out)            # Blender 는 상대 경로 저장을 거부할 수 있음
    if args.blend or args.glb or args.render:
        os.makedirs(out_dir, exist_ok=True)

    if args.render:
        shots = DEFAULT_SHOTS
        if args.shots:
            shots = [tuple(s.split(':', 1)) for s in args.shots.split(',') if s]
        render_shots(shots, out_dir, args.samples, (w, h), args.format, args.threads, site, args.cam, args.flat)

    if args.glb:
        write_web_exports(out_dir, [v for v in args.glb_scopes.split(',') if v], not args.no_draco, site)

    # 마지막으로 GUI / .blend 용 장면을 남깁니다 (GLB 내보내기는 재질을 평평하게 바꾸므로 다시 빌드)
    ctx = build(args.tod, site=site)
    setup_render(ctx, args.samples, (w, h), args.threads)
    if args.validate:
        _, fails = validate(ctx)
        if fails:
            print(f'검증 실패 {fails}건')
            sys.exit(1)
    if args.blend:
        path = os.path.join(out_dir, 'national_assembly.blend')
        bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
        print('wrote', path)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    dg = bpy.context.evaluated_depsgraph_get()
    tris = 0
    for o in meshes:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        ev.to_mesh_clear()
    print(f'국회의사당 모델 생성 완료 ({args.tod}): 오브젝트 {len(meshes)}개, 삼각형 {tris:,}개, '
          f'열주 {ctx.stats.get("columns", 0)}개, 돔 지름 {DOME_D:.0f} m, 높이 {TOTAL_H:.0f} m, '
          f'{time.time() - t_start:.1f}s')


if __name__ == '__main__':
    main()
