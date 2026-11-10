"""Reduce los PNG de assets/field-tracking a paleta de 256 colores con alfa (sin dependencias fuera de Pillow).

    python3 scripts/field-tracking/optimize.py
"""
import pathlib
from PIL import Image

root = pathlib.Path(__file__).resolve().parents[2] / 'assets' / 'field-tracking'
for p in sorted(root.glob('*.png')):
    before = p.stat().st_size
    im = Image.open(p).convert('RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(p, optimize=True)
    print(f'{p.name}: {before // 1024} KB -> {p.stat().st_size // 1024} KB')
