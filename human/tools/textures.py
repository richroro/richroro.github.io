# Rocketbox TGA 텍스처 → 웹용 jpg/webp. 사용법: python3 textures.py <tga 폴더> <출력 폴더>
import sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
o = lambda n: Image.open(f'{src}/f003_{n}.tga')
o('head_color').convert('RGB').save(f'{out}/head_color.jpg', quality=88, optimize=True, progressive=True)
o('head_normal').convert('RGB').save(f'{out}/head_normal.jpg', quality=90, optimize=True)
# 스펙큘러 맵을 거칠기 맵으로 뒤집는다(반짝이는 곳 = 덜 거침)
spec = o('head_specular').convert('L').resize((1024, 1024), Image.LANCZOS)
rough = spec.point(lambda v: max(0, min(255, int(255 * (0.62 - (v / 255) * 0.75)))))
rough.convert('RGB').save(f'{out}/head_rough.jpg', quality=88, optimize=True)
o('body_color').convert('RGB').resize((1024, 1024), Image.LANCZOS).save(f'{out}/body_color.jpg', quality=86, optimize=True)
o('body_normal').convert('RGB').resize((1024, 1024), Image.LANCZOS).save(f'{out}/body_normal.jpg', quality=88, optimize=True)
o('opacity_color').save(f'{out}/hair.webp', quality=88, alpha_quality=90, method=6)
