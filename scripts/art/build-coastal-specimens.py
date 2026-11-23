"""Sculpt two independent examples of eroding bedrock headlands."""
from math import cos, pi, sin
from pathlib import Path
import sys

import bmesh
from mathutils import Vector, noise

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldbook_workshop import Workshop, linear_rgb

PALETTE = {
    'weathered-rock': ('rock', 'ffffff', .0, .82),
    'aqua-shelf': ('water', 'ffffff', .05, .25),
    'ledge': ('rock', 'a89172', .0, .76),
    'tide-sheen': ('ivory', 'adcfca', .0, .43),
}


def mix(a,b,t):
    return tuple(v+(w-v)*t for v,w in zip(a,b))


def coast_pigment(x,z,y):
    band = y+.080*x+.093*z+.54*sin(.122*x+.078*z)
    layered = .50+.5*sin(band*1.48+.32*sin(band*.52))
    old, fresh, crest = map(linear_rgb,['8f775c','d0b794','bbb389'])
    color = mix(old,fresh,layered)
    color = mix(color,crest,.44*max(0,min(1,(y-17)/12)))
    wet = max(0,1-(y-2.1)/3.8)*.32 if y>=2.1 else .32
    rough = 1+.038*sin(x*1.09+z*2.13)-wet
    return tuple(c*rough for c in color)


def rows_to_rock(w,name,rings,group,section_axis='z'):
    n=len(rings[0])
    vertices=[v for ring in rings for v in ring]
    faces=[(j*n+i,(j+1)*n+i,(j+1)*n+(i+1)%n,j*n+(i+1)%n)
           for j in range(len(rings)-1) for i in range(n)]
    if section_axis=='y':
        faces.append(tuple(reversed(range(n))))
        first=len(vertices)-n
        edge=rings[-1]
        center=tuple(sum(v[axis] for v in edge)/n for axis in range(3))
        for k,factor in enumerate([.78,.54,.29,.125]):
            start=len(vertices)
            for i,(x,z,y) in enumerate(edge):
                xx=center[0]+(x-center[0])*factor
                zz=center[1]+(z-center[1])*factor
                grit=noise.fractal(Vector((xx*.11,zz*.146,2.5)),.9,2.12,3)
                yy=center[2]+(y-center[2])*factor+1.3*grit*(1-factor)
                vertices.append((xx,zz,yy))
            faces.extend((first+i,first+(i+1)%n,start+(i+1)%n,start+i) for i in range(n))
            first=start
        tip=len(vertices)
        vertices.append(center)
        faces.extend((first+i,first+(i+1)%n,tip) for i in range(n))
    else:
        # Both portals use a dense face strip between the outer crown and
        # the inner aperture. The arc is a real open topology.
        half=n//2
        for edge_index,start in [(0,0),(1,(len(rings)-1)*n)]:
            outer=list(range(start,start+half))
            inner=list(reversed(range(start+half,start+n)))
            prev=outer
            for stripe in range(1,9):
                t=stripe/9
                current=[]
                for a,b in zip(outer,inner):
                    x,z,y=mix(vertices[a],vertices[b],t)
                    grit=noise.fractal(Vector((x*.25,y*.29,edge_index*8.3)),.81,2.22,3)
                    current.append(len(vertices))
                    vertices.append((x,z+.48*sin(pi*t)*grit,y))
                faces.extend((a,b,d,c) for a,b,c,d in zip(prev,prev[1:],current,current[1:]))
                prev=current
            faces.extend((a,b,d,c) for a,b,c,d in zip(prev,prev[1:],inner,inner[1:]))
            # Connect the ramp of cap strips across the foot end to the
            # original short bottom edges without replacing the opening.
            for end in [0,half-1]:
                hip=[outer[end]]
                hip+=[len(vertices)-half*(9-row)+end for row in range(1,9)]
                hip.append(inner[end])
                faces.append(tuple(hip))
    rock=w.mesh(name,vertices,faces,'weathered-rock',group)
    topology = bmesh.new()
    topology.from_mesh(rock.data)
    bmesh.ops.recalc_face_normals(topology, faces=list(topology.faces))
    topology.to_mesh(rock.data)
    topology.free()
    w.paint(rock,[coast_pigment(*vertex.co) for vertex in rock.data.vertices])
    return rock


def shelf(w,group):
    w.block('海岸标本托片',(50,30,-.81),(96,57,1.42),'teal',.51,group)
    for x in [8.5,91.5]:
        w.block('独立胡桃木托枕',(x,30,-1.76),(10.1,55.8,1.26),'walnut',.47,group)
        w.block('铜包角',(x,57.22,-.71),(8.9,4.1,1.2),'bronze',.32,group)
        w.screw(x,58.4,.02,.68,group)
    water=w.block('海岸水体',(50,30,1.27),(95.3,56.2,2.02),'aqua-shelf',.20,group)
    bpy_data=water.data.vertices
    deep,light=map(linear_rgb,['557f85','9ac7bb'])
    w.paint(water,[mix(deep,light,.81 if v.co.z>0 else .21) for v in bpy_data])
    for x,z in [(13,45),(43,52),(85,44)]:
        w.curve('水面反光细线',[(x+i*.45,z+.36*sin(i*.2),2.306) for i in range(24)],
                .045,'tide-sheen',None)


def headland(w,group,length):
    # Height contours taper toward the sea. Uneven points retain the
    # thickness and cut grain of the same bedrock, without repeating columns.
    outline=[(3.7,5.1),(length*.47,4.4),(length*.87,8.1),(length,16.6),
             (length*.86,23.8),(length*.96,29.2),(length*.80,35.6),
             (length*.54,40.5),(length*.36,37.7),(length*.23,33.1),(4.0,35.3)]
    perimeter=[]
    for i,(a,b) in enumerate(zip(outline,outline[1:]+outline[:1])):
        for k in range(7):
            t=k/7
            perimeter.append((a[0]+(b[0]-a[0])*t+.44*sin(pi*t)*sin(i*3.13),
                              a[1]+(b[1]-a[1])*t+.65*sin(pi*t)*cos(i*1.6)))
    rings=[]
    for layer in range(13):
        t=layer/12
        ring=[]
        for i,(x,z) in enumerate(perimeter):
            top=27.6-5.1*sin(z*.14+.6)+2.13*sin(x*.19)+1.6*sin(z*.38+x*.12)
            ledge=.60*sin(layer*1.84+.25*sin(i*.18))+.38*sin(layer*.72)
            retreat=(.4+t*1.21)*sin(i*.21+.65)+.45*sin(i*.74+layer*.7)+ledge
            scar=.66*sin(layer*.72+i*.234)+.54*noise.noise(Vector((i*.39,layer*.31,1.85)))
            ring.append((x+retreat*t,z+scar*t,1.24+t*top))
        rings.append(ring)
    return rows_to_rock(w,'海岸相连的岩体',rings,group,'y')


def arch_scene():
    w=Workshop('海蚀拱桥',PALETTE)
    group='arch'
    shelf(w,group)
    headland(w,group,44)
    rings=[]
    count=58
    for j in range(17):
        t=j/16
        z=26.4+t*21.2
        x0=46.2+7.8*t+.86*sin(t*3.14)
        rx=20.2-1.13*t
        span=10.7 + 1.4*sin(t*4.3)
        rise=25.1-1.75*t
        aperture=16.5-1.4*sin(pi*t)
        outer=[]
        inner=[]
        for i in range(count+1):
            angle=i*pi/count
            x=x0-rx*cos(angle)+.55*sin(i*.72+j*.41)+.5*sin(angle*4.8)
            y=1.65+sin(angle)**.79*(rise+.80*sin(angle*3)+.52*sin(angle*16+j*.44))
            outer.append((x,z,y))
            x=x0+span*cos(angle)+.38*sin(i*.91-j*.34)-.63*sin(angle*3.3)
            y=1.62+sin(angle)**.84*(aperture+.49*sin(angle*15+j*.36))
            inner.append((x,z,y))
        rings.append(outer+inner)
    arch=rows_to_rock(w,'单一岩体贯通孔洞',rings,group)
    arch['开孔方向']='由向海口通到背面'
    w.export('coastal-arch',positive_depth=True)
    w.photograph('coastal-arch','海蚀拱桥与贯通孔',(50,31,8),(-30,130,73),111,-2.5)


def stack_scene():
    w=Workshop('海蚀柱',PALETTE)
    group='stack'
    shelf(w,group)
    headland(w,group,52)
    rings=[]
    for layer in range(27):
        t=layer/26
        radius=8.33-1.82*t-1.66*sin(pi*t)**1.8
        ring=[]
        for edge in range(70):
            angle=edge*2*pi/70
            cut=1+.083*sin(3*angle+.9)+.066*cos(6*angle+1.1)+.038*sin(11*angle+2.4*t)
            lean=1.72*t
            x=74+radius*cut*cos(angle)+lean
            z=42+radius*cut*sin(angle)*.89-1.2*t
            crown=26.8+1.48*sin(2*angle+.7)+.81*sin(5*angle+.8)
            y=1.44+t*crown+.19*sin(edge*.46+layer*.57)*sin(pi*t)
            ring.append((x,z,y))
        rings.append(ring)
    pillar=rows_to_rock(w,'离岸独立受蚀岩柱',rings,group,'y')
    pillar['形态']='独立比较的离岸岩柱'
    w.export('coastal-stack',positive_depth=True)
    w.photograph('coastal-stack','独立海蚀柱',(50,31,9),(-28,137,81),112,-2.5)


arch_scene()
stack_scene()
