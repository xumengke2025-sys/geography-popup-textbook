"""Make offline specimen previews from the 63 registered Blender renders."""
import json
from pathlib import Path
import sys
from PIL import Image

root = Path(__file__).resolve().parents[2]
catalog = json.loads((root/'docs/handoff/catalog-branch-inventory.json').read_text(encoding='utf-8-sig'))
source = root/'work/blender-atlas/renders'
output = root/'public/textbook/specimens'
output.mkdir(parents=True, exist_ok=True)
selected = set(sys.argv[1:])
if selected - {figure['id'] for figure in catalog}:
    raise ValueError('Unknown catalog entry')
for figure in catalog:
    filename = figure['id']
    if selected and filename not in selected:
        continue
    with Image.open(source/(filename+'.png')) as original:
        image = original.convert('RGBA')
        bounds = image.getchannel('A').point(lambda alpha: 255 if alpha > 16 else 0).getbbox()
        if not bounds:
            raise ValueError('Empty render: '+filename)
        crop = image.crop(bounds)
        crop.thumbnail((464,280), Image.Resampling.LANCZOS)
        tile = Image.new('RGBA',(480,300))
        tile.alpha_composite(crop,((tile.width-crop.width)//2,(tile.height-crop.height)//2))
        tile.save(output/(filename+'.webp'),quality=90,method=6)
