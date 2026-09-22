# -*- coding: utf-8 -*-
"""
국회의사당 (대한민국 국회 본관, 여의도) 3D 모델 생성 스크립트 — Blender 4.2+ / bpy

건물을 손으로 배치하지 않고 전부 코드로 만듭니다. 실제 건물의 공개된 치수를 파라미터로 쓰고,
세부 형상(창 띠, 멀리언, 계단, 돔 리브 등)은 사진을 참고해 단순화했습니다.

사용법
  1) Blender GUI  : Scripting 탭 → 이 파일 열기 → ▶ 실행.  (현재 씬을 비우고 모델을 만듭니다)
  2) 헤드리스     : blender -b -P build_national_assembly.py -- --out ./out --blend --glb --render
  3) pip bpy      : python build_national_assembly.py --out ./out --blend --glb --render

옵션
  --out DIR        결과물 폴더 (기본 ./out)
  --blend          national_assembly.blend 저장
  --glb            national_assembly.glb 내보내기 (웹 뷰어용)
  --render         Cycles 로 hero / aerial / front 3장 렌더 (PNG)
  --samples N      렌더 샘플 수 (기본 96)
  --size WxH       렌더 해상도 (기본 1920x1080)
  --no-site        잔디·광장·분수·나무 등 주변 부지 생략 (건물만)

실제 치수(m) — 본관 122 x 81, 8각 화강석 열주 24개(높이 32.5, 전면 8개 = 8도 상징),
돔 밑지름 64(철골 약 1,000 t), 전체 높이 70, 지상 6층(1층은 기단 안).
"""

import argparse
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

# ----------------------------------------------------------------------------
# 치수 (단위: m)  — 좌표계: X 동서(장변), Y 남북(단변, 정면 = -Y), Z 위
# ----------------------------------------------------------------------------
L = 122.0                 # 열주 중심선 기준 본관 길이 (동서)
W = 81.0                  # 열주 중심선 기준 본관 폭 (남북)
PODIUM_H = 6.0            # 기단 높이 (지상 1층이 이 안에 들어감)
PODIUM_MARGIN = 5.0       # 열주 중심선 → 기단 가장자리 여유
COL_H = 32.5              # 열주 높이
COL_R_BOTTOM = 1.7        # 8각 열주 밑 반지름
COL_R_TOP = 1.35          # 8각 열주 위 반지름 (약한 배흘림/테이퍼)
WALL_INSET = 5.5          # 열주 중심선 → 본체 외벽 (열주 뒤 회랑 폭)
FLOOR_H = 6.5             # 기단 위 층고 (5개 층 x 6.5 = 32.5)
FLOORS = 5                # 기단 위 층 수 (지상 6층 - 1)
SPANDREL_H = 2.6          # 층마다 화강석 띠 높이 (나머지는 창)
MULLION_STEP = 3.0        # 창 멀리언 간격
ROOF_OVERHANG = 4.0       # 열주 중심선 → 처마 끝
EAVES_H = 3.0             # 처마 슬래브 두께
PARAPET_H = 2.5           # 파라펫 높이
PARAPET_INSET = 1.5
DRUM_R = 33.5             # 돔 받침 원통 반지름
DRUM_H = 4.0
DOME_D = 64.0             # 돔 밑지름
TOTAL_H = 70.0            # 지면 → 돔 꼭대기
DOME_RIBS = 24            # 돔 리브 수 (열주 24개와 맞춤)
STAIR_W = 46.0            # 정면 대계단 폭
STAIR_RISE, STAIR_RUN = 0.30, 0.75
STAIR_FLIGHTS = (10, 10)  # 두 단(10+10) x 0.3 = 6.0 = 기단 높이
STAIR_LANDING = 3.0

ROOF_Z0 = PODIUM_H + COL_H                     # 38.5  처마 밑면
ROOF_TOP = ROOF_Z0 + EAVES_H + PARAPET_H       # 44.0
DRUM_Z0 = ROOF_TOP
DOME_Z0 = DRUM_Z0 + DRUM_H                     # 48.0
DOME_H = TOTAL_H - DOME_Z0                     # 22.0

# ----------------------------------------------------------------------------
# 유틸
# ----------------------------------------------------------------------------

def clear_scene():
    """새 파일처럼 비웁니다 (기본 큐브/카메라/라이트 포함)."""
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for coll in list(bpy.data.collections):
        bpy.data.collections.remove(coll)
    for block_list in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                       bpy.data.cameras, bpy.data.images, bpy.data.node_groups):
        for block in list(block_list):
            if block.users == 0:
                block_list.remove(block)


def new_collection(name, parent):
    coll = bpy.data.collections.new(name)
    parent.children.link(coll)
    return coll


def ensure_nodes(block):
    """4.x 에서는 use_nodes 를 켜야 노드 트리가 생기고, 5.0 부터는 기본이라 건드리지 않음."""
    if block.node_tree is None:
        block.use_nodes = True


def make_material(name, color, roughness=0.6, metallic=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    ensure_nodes(mat)
    nodes = mat.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emission is not None:
        bsdf.inputs['Emission Color'].default_value = (*emission, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.0
    mat.diffuse_color = (*color, 1.0)      # 솔리드 뷰포트 색
    return mat


def finish_mesh(name, bm, collection, material, smooth=False, smooth_sides_only=False):
    """bmesh → 오브젝트. smooth_sides_only 는 원통 옆면만 스무스(위·아래 뚜껑은 플랫)."""
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
    mesh.materials.append(material)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    return obj


def bm_box(bm, cx, cy, z0, sx, sy, sz):
    """중심(cx, cy), 바닥 z0, 크기(sx, sy, sz) 박스를 bm 에 추가."""
    ret = bmesh.ops.create_cube(bm, size=1.0)
    verts = ret['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=(cx, cy, z0 + sz / 2.0), verts=verts)
    return verts


def bm_cylinder(bm, cx, cy, z0, r_bottom, r_top, h, segments=48, rot_z=0.0):
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                                radius1=r_bottom, radius2=r_top, depth=h)
    verts = ret['verts']
    if rot_z:
        from mathutils import Matrix
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


def box_object(name, cx, cy, z0, sx, sy, sz, collection, material):
    bm = bmesh.new()
    bm_box(bm, cx, cy, z0, sx, sy, sz)
    return finish_mesh(name, bm, collection, material)


# ----------------------------------------------------------------------------
# 부위별 생성
# ----------------------------------------------------------------------------

def build_site(root, mats):
    coll = new_collection('Site', root)
    box_object('Ground', 0, -40, -0.6, 700, 700, 0.5, coll, mats['grass'])
    # 앞 광장 + 건물 둘레 포장
    box_object('Plaza', 0, -35, -0.1, 300, 230, 0.12, coll, mats['paving'])
    # 잔디 광장 (계단 앞)
    box_object('Lawn', 0, -125, 0.02, 120, 70, 0.06, coll, mats['grass'])
    # 분수대 (원형)
    bm = bmesh.new()
    bm_cylinder(bm, 0, -125, 0.0, 18.0, 18.0, 1.0, segments=64)
    finish_mesh('Fountain_Basin', bm, coll, mats['granite'], smooth_sides_only=True)
    bm = bmesh.new()
    bm_cylinder(bm, 0, -125, 0.0, 17.0, 17.0, 0.8, segments=64)
    bm_cylinder(bm, 0, -125, 0.8, 2.0, 1.6, 2.5, segments=24)
    finish_mesh('Fountain_Water', bm, coll, mats['water'], smooth_sides_only=True)
    # 가로수 (단순 저폴리)
    bm_trunk, bm_canopy = bmesh.new(), bmesh.new()
    spots = []
    for side in (-1, 1):
        for y in range(-70, -170, -14):
            spots.append((side * 90.0, float(y)))
    for x in range(-140, 141, 14):
        if abs(x) >= 75:                      # 정면 잔디광장 앞은 비워 둠
            spots.append((float(x), -175.0))
    for (x, y) in spots:
        bm_cylinder(bm_trunk, x, y, 0.0, 0.4, 0.3, 3.5, segments=8)
        ret = bmesh.ops.create_icosphere(bm_canopy, subdivisions=2, radius=3.6)
        bmesh.ops.scale(bm_canopy, vec=(1.0, 1.0, 1.25), verts=ret['verts'])
        bmesh.ops.translate(bm_canopy, vec=(x, y, 3.5 + 3.6 * 1.05), verts=ret['verts'])
    finish_mesh('Trees_Trunk', bm_trunk, coll, mats['bark'])
    finish_mesh('Trees_Canopy', bm_canopy, coll, mats['leaf'], smooth=True)


def build_podium(root, mats):
    coll = new_collection('Podium', root)
    px = L + 2 * PODIUM_MARGIN          # 132
    py = W + 2 * PODIUM_MARGIN          # 91
    # 아래 넓은 단 + 위 기단
    box_object('Podium_Plinth', 0, 0, 0.0, px + 4, py + 4, 1.0, coll, mats['granite_dark'])
    box_object('Podium', 0, 0, 1.0, px, py, PODIUM_H - 1.0, coll, mats['granite'])
    # 기단 외벽의 지상 1층 창 띠 (얕게 파인 어두운 띠)
    bm = bmesh.new()
    bm_box(bm, 0, 0, 2.2, px + 0.1, py - 30.0, 2.4)   # 좌우 짧은 면
    bm_box(bm, 0, 0, 2.2, px - 60.0, py + 0.1, 2.4)   # 앞뒤 (계단 부분은 계단이 덮음)
    finish_mesh('Podium_Windows', bm, coll, mats['glass'])

    # 정면 대계단 — 단면(YZ)을 X 로 밀어냄
    y_top = -py / 2.0                      # 기단 정면
    pts = [(y_top, PODIUM_H)]
    y, z = y_top, PODIUM_H
    for fi, n in enumerate(STAIR_FLIGHTS):
        if fi > 0:
            y -= STAIR_LANDING
            pts.append((y, z))
        for _ in range(n):
            z -= STAIR_RISE
            pts.append((y, z))
            y -= STAIR_RUN
            pts.append((y, z))
    y_bottom = y
    pts.append((y_bottom, -0.3))
    pts.append((y_top, -0.3))
    bm = bmesh.new()
    bm_extrude_profile_x(bm, pts, -STAIR_W / 2.0, STAIR_W / 2.0)
    finish_mesh('Grand_Stairs', bm, coll, mats['granite'])

    # 계단 양옆 경사 난간벽
    wall_w = 1.6
    prof = [(y_top + 0.01, -0.3), (y_top + 0.01, PODIUM_H + 1.1),
            (y_bottom - 0.8, 1.1), (y_bottom - 0.8, -0.3)]
    bm = bmesh.new()
    for s in (-1, 1):
        x_in = s * STAIR_W / 2.0
        x_out = s * (STAIR_W / 2.0 + wall_w)
        bm_extrude_profile_x(bm, prof, min(x_in, x_out), max(x_in, x_out))
    finish_mesh('Stair_CheekWalls', bm, coll, mats['granite'])

    # 기단 가장자리 낮은 난간
    bm = bmesh.new()
    t, h = 0.5, 1.0
    for s in (-1, 1):
        bm_box(bm, s * (px / 2 - t / 2), 0, PODIUM_H, t, py, h)
    bm_box(bm, 0, py / 2 - t / 2, PODIUM_H, px, t, h)
    # 정면은 계단 자리를 비움
    seg = (px - STAIR_W - 2 * wall_w) / 2.0
    for s in (-1, 1):
        bm_box(bm, s * (px / 2 - seg / 2), -py / 2 + t / 2, PODIUM_H, seg, t, h)
    finish_mesh('Podium_Balustrade', bm, coll, mats['granite_dark'])
    return y_top


def build_body(root, mats):
    coll = new_collection('Body', root)
    bx = L - 2 * WALL_INSET      # 111
    by = W - 2 * WALL_INSET      # 70
    z0 = PODIUM_H
    # 유리 커튼월 덩어리
    box_object('Body_Glass', 0, 0, z0, bx, by, COL_H, coll, mats['glass'])
    # 층마다 화강석 스팬드럴 띠 (밖으로 0.45 돌출)
    bm = bmesh.new()
    for k in range(FLOORS):
        bm_box(bm, 0, 0, z0 + k * FLOOR_H, bx + 0.9, by + 0.9, SPANDREL_H)
    # 최상부 마감 띠
    bm_box(bm, 0, 0, z0 + COL_H - 1.2, bx + 0.9, by + 0.9, 1.2)
    # 모서리 피어
    for sx in (-1, 1):
        for sy in (-1, 1):
            bm_box(bm, sx * (bx / 2 - 1.2), sy * (by / 2 - 1.2), z0, 3.6, 3.6, COL_H)
    finish_mesh('Body_Spandrels', bm, coll, mats['granite'])
    # 창 멀리언 (세로)
    bm = bmesh.new()
    d = 0.35
    nx = int(bx // MULLION_STEP)
    for i in range(1, nx):
        x = -bx / 2 + i * MULLION_STEP
        for sy in (-1, 1):
            bm_box(bm, x, sy * (by / 2 + d / 2), z0, 0.25, d, COL_H)
    ny = int(by // MULLION_STEP)
    for j in range(1, ny):
        y = -by / 2 + j * MULLION_STEP
        for sx in (-1, 1):
            bm_box(bm, sx * (bx / 2 + d / 2), y, z0, d, 0.25, COL_H)
    finish_mesh('Body_Mullions', bm, coll, mats['metal'])

    # 정면 중앙 출입구: 화강석 포털 + 청동 문
    yf = -by / 2
    pw, ph, pd = 30.0, 13.5, 1.4
    bm = bmesh.new()
    bm_box(bm, -pw / 2 + 1.5, yf - pd / 2, z0, 3.0, pd, ph - 2.0)   # 피어 (상인방 아래까지)
    bm_box(bm, pw / 2 - 1.5, yf - pd / 2, z0, 3.0, pd, ph - 2.0)
    bm_box(bm, 0, yf - pd / 2, z0 + ph - 2.0, pw, pd, 2.0)           # 상인방
    finish_mesh('Entrance_Portal', bm, coll, mats['granite'])
    bm = bmesh.new()
    for i in range(4):
        x = -9.0 + i * 6.0
        bm_box(bm, x, yf - 0.4, z0, 4.4, 0.4, 8.5)
    finish_mesh('Entrance_Doors', bm, coll, mats['bronze'])
    # 출입구 앞 낮은 단
    box_object('Entrance_Step', 0, yf - pd - 1.25, z0, pw + 4, 2.4, 0.3, coll, mats['granite'])


def column_positions():
    pts = []
    for i in range(8):                       # 앞·뒤 8개씩 (전면 8개 = 팔도)
        x = -L / 2 + L * i / 7.0
        pts.append((x, -W / 2))
        pts.append((x, W / 2))
    for j in range(1, 5):                    # 좌·우 사이 4개씩
        y = -W / 2 + W * j / 5.0
        pts.append((-L / 2, y))
        pts.append((L / 2, y))
    assert len(pts) == 24
    return pts


def build_columns(root, mats):
    coll = new_collection('Columns', root)
    bm = bmesh.new()
    for (x, y) in column_positions():
        bm_box(bm, x, y, PODIUM_H, 4.4, 4.4, 0.5)                                  # 주초
        bm_cylinder(bm, x, y, PODIUM_H + 0.5, COL_R_BOTTOM, COL_R_TOP, COL_H - 1.4,
                    segments=8, rot_z=math.pi / 8)                                  # 8각 주신
        bm_box(bm, x, y, PODIUM_H + COL_H - 0.9, 3.4, 3.4, 1.0)                    # 주두 (처마 속 0.1 겹침)
    finish_mesh('Columns_24', bm, coll, mats['granite_light'])


def build_roof(root, mats):
    coll = new_collection('Roof', root)
    rx = L + 2 * ROOF_OVERHANG          # 130
    ry = W + 2 * ROOF_OVERHANG          # 89
    box_object('Eaves', 0, 0, ROOF_Z0, rx, ry, EAVES_H, coll, mats['concrete'])
    # 처마 끝 그림자 홈 (얇고 어두운 띠) → 파라펫과 분리되어 보이게
    box_object('Eaves_Groove', 0, 0, ROOF_Z0 + EAVES_H, rx - 0.6, ry - 0.6, 0.35, coll, mats['granite_dark'])
    box_object('Parapet', 0, 0, ROOF_Z0 + EAVES_H + 0.35,
               rx - 2 * PARAPET_INSET, ry - 2 * PARAPET_INSET, PARAPET_H - 0.35, coll, mats['concrete'])
    # 옥상 설비 (낮은 박스 몇 개)
    bm = bmesh.new()
    for x in (-50, -42, 42, 50):
        bm_box(bm, x, 0, ROOF_TOP, 5.0, 12.0, 1.6)
    finish_mesh('Roof_Equipment', bm, coll, mats['granite_dark'])


def spherical_cap_verts(bm, chord_r, height, z0, segments, rings, r_offset=0.0):
    """밑지름 chord_r*2, 높이 height 인 구면 캡. 꼭짓점 + 위도 링들."""
    R = (chord_r ** 2 + height ** 2) / (2.0 * height)
    cz = z0 + height - R
    theta_edge = math.asin(min(1.0, chord_r / R))
    Rr = R + r_offset
    top = bm.verts.new((0, 0, cz + Rr))
    rows = []
    for i in range(1, rings + 1):
        th = theta_edge * i / rings
        row = []
        for j in range(segments):
            ph = 2 * math.pi * j / segments
            row.append(bm.verts.new((Rr * math.sin(th) * math.cos(ph),
                                     Rr * math.sin(th) * math.sin(ph),
                                     cz + Rr * math.cos(th))))
        rows.append(row)
    return top, rows, R, cz, theta_edge


def build_dome(root, mats):
    coll = new_collection('Dome', root)
    # 받침 원통 + 돌림띠
    bm = bmesh.new()
    bm_cylinder(bm, 0, 0, DRUM_Z0, DRUM_R, DRUM_R, DRUM_H - 0.8, segments=96)
    bm_cylinder(bm, 0, 0, DRUM_Z0 + DRUM_H - 0.8, DRUM_R + 0.6, DRUM_R + 0.6, 0.8, segments=96)
    finish_mesh('Dome_Drum', bm, coll, mats['concrete'], smooth_sides_only=True)
    # 받침 원통 세로 루버
    bm = bmesh.new()
    n = 96
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = (DRUM_R + 0.15) * math.cos(a), (DRUM_R + 0.15) * math.sin(a)
        ret = bmesh.ops.create_cube(bm, size=1.0)
        v = ret['verts']
        bmesh.ops.scale(bm, vec=(0.5, 0.9, DRUM_H - 1.2), verts=v)
        from mathutils import Matrix
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Z'), verts=v)
        bmesh.ops.translate(bm, vec=(x, y, DRUM_Z0 + (DRUM_H - 1.2) / 2 + 0.2), verts=v)
    finish_mesh('Dome_Louvers', bm, coll, mats['granite_dark'])

    # 돔 본체 (구면 캡)
    segments, rings = 96, 28
    bm = bmesh.new()
    top, rows, R, cz, th_edge = spherical_cap_verts(bm, DOME_D / 2, DOME_H, DOME_Z0, segments, rings)
    for j in range(segments):
        bm.faces.new((top, rows[0][j], rows[0][(j + 1) % segments]))
    for i in range(rings - 1):
        for j in range(segments):
            a, b = rows[i][j], rows[i][(j + 1) % segments]
            c, d = rows[i + 1][(j + 1) % segments], rows[i + 1][j]
            bm.faces.new((a, b, c, d))
    # 밑면 막기 (내부는 보이지 않지만 GLB 에서 뚫려 보이지 않도록)
    bm.faces.new(list(reversed(rows[-1])))
    finish_mesh('Dome', bm, coll, mats['patina'], smooth=True)

    # 리브 24개 (얇은 띠)
    bm = bmesh.new()
    rib_half_w, rib_h = 0.45, 0.22
    th_min = 0.11
    steps = 22
    for k in range(DOME_RIBS):
        ph = 2 * math.pi * k / DOME_RIBS + math.pi / DOME_RIBS
        prev = None
        for s in range(steps + 1):
            th = th_min + (th_edge - th_min) * s / steps
            dph = rib_half_w / (R * math.sin(th))
            ring = []
            for (rr, pp) in ((R - 0.05, ph - dph), (R - 0.05, ph + dph),
                             (R + rib_h, ph + dph), (R + rib_h, ph - dph)):
                ring.append(bm.verts.new((rr * math.sin(th) * math.cos(pp),
                                          rr * math.sin(th) * math.sin(pp),
                                          cz + rr * math.cos(th))))
            if prev is None:
                bm.faces.new(ring)
            else:
                for i in range(4):
                    j = (i + 1) % 4
                    bm.faces.new((prev[i], prev[j], ring[j], ring[i]))
            prev = ring
        bm.faces.new(list(reversed(prev)))
    finish_mesh('Dome_Ribs', bm, coll, mats['patina_dark'])
    # 꼭대기 원판 마감 + 피뢰침
    bm = bmesh.new()
    top_z = cz + R
    bm_cylinder(bm, 0, 0, top_z - 0.5, 4.6, 4.2, 0.9, segments=48)
    finish_mesh('Dome_Cap', bm, coll, mats['patina_dark'], smooth_sides_only=True)
    bm = bmesh.new()
    bm_cylinder(bm, 0, 0, top_z + 0.4, 0.12, 0.05, 4.0, segments=8)
    finish_mesh('Lightning_Rod', bm, coll, mats['metal'])


# ----------------------------------------------------------------------------
# 재질 / 조명 / 카메라
# ----------------------------------------------------------------------------

def build_materials():
    return {
        'granite':       make_material('Granite',        (0.70, 0.68, 0.64), 0.75),
        'granite_light': make_material('Granite_Light',  (0.78, 0.76, 0.72), 0.7),
        'granite_dark':  make_material('Granite_Dark',   (0.42, 0.41, 0.39), 0.8),
        'concrete':      make_material('Concrete_Eaves', (0.84, 0.84, 0.81), 0.85),
        'glass':         make_material('Glass_Dark',     (0.04, 0.07, 0.09), 0.18, 0.35),
        'metal':         make_material('Metal',          (0.55, 0.56, 0.58), 0.35, 0.9),
        'bronze':        make_material('Bronze_Doors',   (0.30, 0.20, 0.10), 0.45, 0.8),
        'patina':        make_material('Dome_Patina',    (0.33, 0.60, 0.54), 0.55, 0.05),
        'patina_dark':   make_material('Dome_Patina_Dk', (0.26, 0.50, 0.45), 0.6, 0.05),
        'grass':         make_material('Grass',          (0.24, 0.40, 0.17), 0.95),
        'paving':        make_material('Paving',         (0.40, 0.39, 0.37), 0.9),
        'water':         make_material('Water',          (0.18, 0.40, 0.55), 0.05, 0.0),
        'bark':          make_material('Bark',           (0.30, 0.22, 0.15), 0.9),
        'leaf':          make_material('Leaf',           (0.18, 0.36, 0.14), 0.9),
    }


def track_to(obj, target):
    c = obj.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'


def build_lighting_and_cameras(root):
    coll = new_collection('Lights_Cameras', root)
    scene = bpy.context.scene

    # 하늘: 수평선은 밝고 천정은 파랗게
    world = bpy.data.worlds.get('World') or bpy.data.worlds.new('World')
    scene.world = world
    ensure_nodes(world)
    nt = world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs[6].default_value = (0.66, 0.78, 0.92, 1.0)   # 수평선
    mix.inputs[7].default_value = (0.20, 0.42, 0.82, 1.0)   # 천정
    rng = nt.nodes.new('ShaderNodeMapRange')
    rng.inputs['From Min'].default_value = -0.05
    rng.inputs['From Max'].default_value = 0.45
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    tex = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tex.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], rng.inputs['Value'])
    nt.links.new(rng.outputs['Result'], mix.inputs['Factor'])
    nt.links.new(mix.outputs[2], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    bg.inputs['Strength'].default_value = 0.8

    target = bpy.data.objects.new('Aim', None)
    target.location = (0, 0, 30)
    coll.objects.link(target)

    sun_data = bpy.data.lights.new('Sun', 'SUN')
    sun_data.energy = 3.0
    sun_data.color = (1.0, 0.96, 0.90)
    sun_data.angle = math.radians(1.0)
    sun = bpy.data.objects.new('Sun', sun_data)
    sun.location = (-180, -260, 320)
    coll.objects.link(sun)
    track_to(sun, target)

    cams = {}

    def add_cam(name, loc, aim, lens=40, ortho=None):
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        cd.clip_end = 3000
        if ortho:
            cd.type = 'ORTHO'
            cd.ortho_scale = ortho
        cam = bpy.data.objects.new(name, cd)
        cam.location = loc
        coll.objects.link(cam)
        t = bpy.data.objects.new(name + '_Aim', None)
        t.location = aim
        coll.objects.link(t)
        track_to(cam, t)
        cams[name] = cam
        return cam

    add_cam('Cam_Hero',   (-150, -205, 58),  (0, -12, 26), lens=40)
    add_cam('Cam_Aerial', (-130, -175, 190), (0, -5, 22),  lens=35)
    add_cam('Cam_Front',  (0, -100, 32),     (0, 0, 32),   ortho=175)
    scene.camera = cams['Cam_Hero']
    return cams


def setup_render(samples, size):
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.length_unit = 'METERS'
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    try:
        scene.render.engine = 'CYCLES'
        scene.cycles.device = 'CPU'
        scene.cycles.samples = samples
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception as exc:                       # Cycles 가 없으면 EEVEE 로
        print('Cycles unavailable, falling back:', exc)
        scene.render.engine = 'BLENDER_EEVEE'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.6


# ----------------------------------------------------------------------------
# 메인
# ----------------------------------------------------------------------------

def build(with_site=True):
    clear_scene()
    scene = bpy.context.scene
    root = bpy.data.collections.new('National_Assembly')
    scene.collection.children.link(root)
    mats = build_materials()
    if with_site:
        build_site(root, mats)
    build_podium(root, mats)
    build_body(root, mats)
    build_columns(root, mats)
    build_roof(root, mats)
    build_dome(root, mats)
    cams = build_lighting_and_cameras(root)
    return cams


def export_outputs(cams, out_dir, do_blend, do_glb, do_render, samples, size):
    out_dir = os.path.abspath(out_dir)          # Blender 는 상대 경로 저장을 거부할 수 있음
    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    setup_render(samples, size)
    if do_glb:
        path = os.path.join(out_dir, 'national_assembly.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True,
                                  export_cameras=False, export_lights=False, export_yup=True)
        print('wrote', path)
    if do_render:
        for name, cam in cams.items():
            scene.camera = cam
            scene.render.filepath = os.path.join(out_dir, 'render_' + name.replace('Cam_', '').lower() + '.png')
            bpy.ops.render.render(write_still=True)
            print('wrote', scene.render.filepath)
        scene.camera = cams['Cam_Hero']
    if do_blend:
        path = os.path.join(out_dir, 'national_assembly.blend')
        bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
        print('wrote', path)


def parse_args():
    argv = sys.argv
    if '--' in argv:
        user = argv[argv.index('--') + 1:]
    elif argv and argv[0].endswith('.py'):
        user = argv[1:]
    else:                                  # Blender 텍스트 에디터에서 실행
        user = []
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--out', default='./out')
    p.add_argument('--blend', action='store_true')
    p.add_argument('--glb', action='store_true')
    p.add_argument('--render', action='store_true')
    p.add_argument('--samples', type=int, default=96)
    p.add_argument('--size', default='1920x1080')
    p.add_argument('--no-site', action='store_true')
    return p.parse_args(user)


def main():
    args = parse_args()
    cams = build(with_site=not args.no_site)
    w, h = (int(v) for v in args.size.lower().split('x'))
    setup_render(args.samples, (w, h))
    if args.blend or args.glb or args.render:
        export_outputs(cams, args.out, args.blend, args.glb, args.render, args.samples, (w, h))
    n_obj = sum(1 for o in bpy.data.objects if o.type == 'MESH')
    n_tri = sum(len(o.data.loop_triangles) or 0 for o in bpy.data.objects if o.type == 'MESH')
    print(f'국회의사당 모델 생성 완료: 메시 {n_obj}개, 기둥 24개, 돔 지름 {DOME_D:.0f} m, 전체 높이 {TOTAL_H:.0f} m')


if __name__ == '__main__':
    main()
