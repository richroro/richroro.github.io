# -*- coding: utf-8 -*-
"""renders/*.jpg → renders/thumb/*.jpg (가로 960 px, JPEG) 썸네일 만들기.

렌더를 새로 바꾼 뒤(예: 최종 1920x1080) 다시 실행하면 됩니다. Pillow 없이 bpy 만 씁니다.
원본 폴더는 --src 로 주거나, 없으면 이 파일 옆의 national-assembly/renders 또는 renders 를 씁니다.

  python3 make_thumbs.py                      # pip install bpy
  blender -b -P make_thumbs.py                # Blender 헤드리스
  python3 make_thumbs.py --src national-assembly/renders --width 960 --quality 82
"""
import argparse
import glob
import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))


def parse_args():
    argv = sys.argv
    if '--' in argv:                        # blender -b -P make_thumbs.py -- --width 960
        argv = argv[argv.index('--') + 1:]
    elif argv and argv[0].endswith('.py'):  # python3 make_thumbs.py --width 960
        argv = argv[1:]
    else:                                   # blender -b -P make_thumbs.py
        argv = []
    p = argparse.ArgumentParser(description='렌더 썸네일 만들기')
    p.add_argument('--src', default=None,
                   help='원본 JPEG 폴더 (기본: 이 파일 옆의 national-assembly/renders 또는 renders)')
    p.add_argument('--width', type=int, default=960, help='썸네일 가로 px (기본 960, 세로는 비율대로)')
    p.add_argument('--quality', type=int, default=82, help='JPEG 품질 (기본 82)')
    return p.parse_args(argv)


def main():
    args = parse_args()
    if args.src is None:
        cands = [os.path.join(HERE, 'national-assembly', 'renders'), os.path.join(HERE, 'renders')]
        args.src = next((c for c in cands if os.path.isdir(c)), cands[0])
    out_dir = os.path.join(args.src, 'thumb')
    os.makedirs(out_dir, exist_ok=True)

    # save_render 는 장면의 색 관리(뷰 변환)를 거치므로 Standard 로 두어 색이 바뀌지 않게 합니다.
    scene = bpy.context.scene
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    scene.display_settings.display_device = 'sRGB'
    fmt = scene.render.image_settings
    fmt.file_format = 'JPEG'
    fmt.color_mode = 'RGB'
    fmt.quality = args.quality

    paths = sorted(glob.glob(os.path.join(args.src, '*.jpg')))
    if not paths:
        sys.exit('JPEG 없음: ' + args.src)
    for path in paths:
        img = bpy.data.images.load(path, check_existing=False)
        w, h = img.size
        tw = min(args.width, w)
        th = round(tw * h / w)
        if (tw, th) != (w, h):
            img.scale(tw, th)
        out = os.path.join(out_dir, os.path.basename(path))
        img.save_render(out, scene=scene)
        bpy.data.images.remove(img)
        print(f'{os.path.basename(path)}: {w}x{h} -> {tw}x{th}  ({os.path.getsize(out) // 1024} KB)')


if __name__ == '__main__':
    main()
