"""Prepare repeatable offline specimen maps from Poly Haven's CC0 surface scans.

Red carries diffuse luminance relative to its median, green carries displacement,
blue carries roughness, and the earth maps store measured warm/cool variation
in alpha. The specimen still supplies the identifying soil or stratum pigment.
"""
from concurrent.futures import ThreadPoolExecutor
from hashlib import md5
from io import BytesIO
import json
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageOps
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/textbook/materials'
RAW = ROOT / 'work/earth-scans'
SCANS = {'loam': 'brown_mud_rocks_01', 'outcrop': 'rock_face_03',
         'alluvium': 'sandy_gravel', 'turf': 'forest_ground_04',
         'sand': 'sand_02', 'walnut': 'european_walnut_veneer_04'}

def fetch(url):
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Fieldbook-material-preparation/1.0'}), timeout=45) as r:
                return r.read()
        except OSError:
            if attempt == 2:
                raise

def prepare(item):
    kind, asset = item
    meta = json.loads(fetch('https://api.polyhaven.com/files/' + asset))
    bands = []
    cast = None
    for key in ('Diffuse', 'Displacement', 'Rough'):
        files = meta[key]['1k']
        entry = files.get('jpg') or files['png']
        dest = RAW / entry['url'].split('/')[-1]
        data = dest.read_bytes() if dest.is_file() else b''
        if md5(data).hexdigest() != entry['md5']:
            data = fetch(entry['url'])
            if md5(data).hexdigest() != entry['md5']:
                raise ValueError(entry['url'])
            dest.write_bytes(data)
        band = Image.open(BytesIO(data)).convert('L').resize((1024, 1024), Image.Resampling.LANCZOS)
        if key == 'Diffuse':
            band = ImageOps.autocontrast(band, cutoff=(1, 1))
            if kind != 'walnut':
                # Preserve local clay/stone colour relative to the scan median.
                # Encode separately from value so dark pores stay neutral.
                rgb = np.asarray(Image.open(BytesIO(data)).convert('RGB').resize(band.size), dtype=np.float32)
                warmth = np.log((rgb[...,0]+8.) / (rgb[...,2]+8.))
                coeff = np.clip(warmth - np.median(warmth), -.75, .75)
                cast = Image.fromarray(np.rint(128.+coeff*128.).astype('uint8'))
        if key == 'Displacement':
            band = ImageOps.autocontrast(band, cutoff=(.4, .4))
        bands.append(band)
    image = Image.merge('RGBA', [*bands, cast]) if cast is not None else Image.merge('RGB', bands)
    image.save(OUT / (kind + '.webp'), lossless=True, method=5)
    print(kind, asset, flush=True)

if __name__ == '__main__':
    import sys
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        selected = {kind: SCANS[kind] for kind in sys.argv[1:]} if sys.argv[1:] else SCANS
        list(pool.map(prepare, selected.items()))
