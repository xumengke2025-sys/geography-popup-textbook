"""Print a continuous globe gore from the instrument's Natural Earth stock."""
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parents[2]
rings = json.loads((root/'src/assets/solar-instrument/coastlines.json').read_text())
w, h = 2048, 1024
land = Image.new('L', (w, h))
pen = ImageDraw.Draw(land)
for coords in rings:
    points = [((lon+180)*w/360, (90-lat)*h/180) for lon,lat in coords]
    pen.polygon(points, fill=255)
mask = np.asarray(land, dtype=float)/255
coast = np.clip(mask - np.asarray(land.filter(ImageFilter.GaussianBlur(3.0)))/255., 0, 1)
y,x = np.mgrid[0:h,0:w]
lon, lat = (x+.5)*360/w-180, 90-(y+.5)*180/h
rng = np.random.default_rng(1824)
# Varnished paper gores have a slight colour drift and a darker lapped seam.
stain = .023*np.sin(lon*np.pi/15 + .32*np.cos(lat*.14)) + .024*np.cos(lat*.093+np.sin(lon*.06))
paper = 1 + stain + rng.normal(0,.014,(h,w))
parallel = np.abs((lat+7.5)%15-7.5)
meridian = np.abs((lon+7.5)%15-7.5)
graticule = np.clip(1-parallel/.18,0,1)*.26 + np.clip(1-meridian/.21,0,1)*.23
seam = np.clip(1-np.abs((lon+15)%30-15)/.42,0,1)*.095
equator = np.clip(1-np.abs(lat)/.32,0,1)*.20
sea = np.array([92,139,137])
ochre = np.array([209,183,131])
pigment = sea + mask[:,:,None]*(ochre-sea)
factor = paper*(1-coast*.57-graticule-seam-equator)
im=Image.fromarray(np.uint8(np.clip(pigment*factor[:,:,None],0,255)))
im.save(root/'public/textbook/materials/sectional-globe.webp', quality=92, method=6)
