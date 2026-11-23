"""Separate a Blender section into native SVG tone plates for the offline reader."""
from pathlib import Path
from collections import defaultdict
from PIL import Image, ImageFilter
from math import hypot

root=Path(__file__).resolve().parents[2]
art=root/'src/assets/cave'
im=Image.open(art/'section.webp').convert('RGBA').resize((196,118),Image.Resampling.LANCZOS)
gray=im.convert('L').filter(ImageFilter.GaussianBlur(.6))
w,h=im.size

def simplify(pts,tol=.64):
    if len(pts)<=2:return pts
    x,y=pts[0];dx=pts[-1][0]-x;dy=pts[-1][1]-y
    length=hypot(dx,dy)
    distances=[abs(dx*(py-y)-dy*(px-x))/length if length else hypot(px-x,py-y) for px,py in pts]
    k=max(range(len(pts)),key=distances.__getitem__)
    if distances[k]<=tol:return [pts[0],pts[-1]]
    return simplify(pts[:k+1],tol)[:-1]+simplify(pts[k:],tol)

layers=[]
for level in [0,55,68,80,92,104,115,125,135,144,153,162,171,181,191,201,213]:
    mask={(x,y) for y in range(h) for x in range(w) if im.getpixel((x,y))[3]>=125 and gray.getpixel((x,y))>=level}
    if not mask:continue
    edges=defaultdict(list)
    for x,y in sorted(mask):
        if (x,y-1) not in mask:edges[x,y].append((x+1,y))
        if (x+1,y) not in mask:edges[x+1,y].append((x+1,y+1))
        if (x,y+1) not in mask:edges[x+1,y+1].append((x,y+1))
        if (x-1,y) not in mask:edges[x,y+1].append((x,y))
    paths=[]
    while edges:
        start=next(iter(edges));chain=[start];curr=start
        while True:
            nxt=edges[curr].pop()
            if not edges[curr]:del edges[curr]
            chain.append(nxt);curr=nxt
            if curr==start:break
        if len(chain)<11:continue
        points=simplify(chain)
        if len(points)>3:
            loop=points[:-1]
            pairs=list(zip(loop,loop[1:]+loop[:1]))
            mid=lambda a,b: f'{(a[0]+b[0])/2:g} {(a[1]+b[1])/2:g}'
            # Round stair steps left by the sample grid while keeping beds closed.
            path='M'+mid(loop[-1],loop[0])+'Q'
            paths.append(path+' '.join(f'{a[0]} {a[1]} {mid(a,b)}' for a,b in pairs)+'Z')
    if paths:
        samples=[im.getpixel((x,y))[:3] for x,y in mask if gray.getpixel((x,y))<=level+11]
        color=tuple(round(sum(a)/len(a)) for a in zip(*samples)) if samples else (60,52,43)
        layers.append('<path fill="#%02x%02x%02x" fill-rule="evenodd" d="%s"/>'%(*color,''.join(paths)))
(art/'section-tones.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" x="32" y="26" width="576" height="330" viewBox="0 0 196 118" preserveAspectRatio="none" aria-hidden="true">'+''.join(layers)+'</svg>',encoding='utf8')
