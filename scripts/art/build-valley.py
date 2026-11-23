"""Build two swappable river specimens and a travelling three-plummet comparator."""
import json
from random import Random
from math import cos, pi, radians, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector, noise
sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldbook_workshop import ROOT, Workshop, linear_rgb
from earth_material import apply_scan
from water_workshop import FINISH, front_turn, keys_linear, leveled_bed

data=json.loads((ROOT/'work/valley-profiles.json').read_text(encoding='utf8'))
nx,ny,depth=data['nx'],data['ny'],data['depth']
w=Workshop('河谷断面测量台',FINISH|{
    'painted-relief':('rock','ffffff',0,.78),
    'trace-water':('water','ffffff',.06,.27),
    'cut-water':('water','687f77',.045,.28),
    'oxidised':('brass','766649',.75,.48),
    'river-stones':('rock','ffffff',0,.71),
    'dry-tussock':('plant','ffffff',0,.88),
    'flax':('wood','a6926c',0,.74),
    'steel-blue':('steel','627a7c',.63,.33),
})
def mix(a,b,t):
    t=max(0,min(1,t))
    return tuple(v+(u-v)*t for v,u in zip(a,b))

def field(x,y,z,frequency):
    return .5+.5*noise.fractal(Vector((x*frequency,y*frequency,z*frequency)),1,2,3)

def loose_material(profile, mode, group):
    rng=Random(3917+mode)
    def elevation(x,y):
        u=min(nx-.00001,max(0,(x-3.5)/93*nx));v=min(ny-.00001,max(0,y/depth*ny))
        i,j=int(u),int(v);a,b=u-i,v-j
        g=profile['grid']
        if a>=b:
            return g[j][i]*(1-a)+g[j][i+1]*(a-b)+g[j+1][i+1]*b
        return g[j][i]*(1-b)+g[j+1][i+1]*a+g[j+1][i]*(b-a)
    verts,faces,colors=[],[],[]
    rock_palette=[linear_rgb(c) for c in ['746a57','857767','a1937a','635e53','9f8c73']]
    for patch in range(72):
        y=rng.uniform(1.3,58.7);sign=rng.choice([-1,1]);left,right,level=profile['river'][round(y/depth*ny)]
        bank=(left if sign<0 else right)+sign*rng.uniform(-.32,2.7)
        talus=not mode and patch%4==0
        if talus:bank+=sign*rng.uniform(7,31)
        for stone in range(rng.randrange(3,13)):
            x=bank+rng.gauss(0,.96);z=y+rng.gauss(0,1.40)
            if not (4<x<96 and .35<z<59.65):continue
            h=elevation(x,z);radius=(.13+.46*rng.random()**2)*(1.9 if talus else 1)
            if h < level-.17 and not talus:continue
            axis=rng.uniform(0,pi);ca,sa=cos(axis),sin(axis)
            tint=rng.choice(rock_palette);n=rng.randrange(5,8);start=len(verts)
            for k in range(n):
                angle=2*pi*k/n;size=rng.uniform(.77,1.17)*radius
                dx,dz=cos(angle)*size,sin(angle)*size*rng.uniform(.52,.83)
                xx,zz=x+dx*ca-dz*sa,z+dx*sa+dz*ca
                base=elevation(xx,zz)-.10*radius
                verts.append((xx,zz,base));colors.append(tint)
            for k in range(n):
                xx,zz,hh=verts[start+k]
                verts.append((.42*xx+.58*x,.42*zz+.58*z,hh+radius*rng.uniform(.40,.68)))
                colors.append(tint)
                a=start+k;b=start+(k+1)%n
                faces.append((a,b,b+n,a+n))
            faces.append(tuple(start+n+k for k in range(n)))
    if verts:
        obj=w.mesh('坡脚碎石与河岸砾滩',verts,faces,'river-stones',group)
        w.paint(obj,colors)
    verts,faces,colors=[],[],[]
    for patch in range(120):
        x,y=rng.uniform(5,95),rng.uniform(1,59)
        left,right,h=profile['river'][round(y/depth*ny)]
        if left-2.3<x<right+2.3 or elevation(x,y)>21 or field(x,y,0,.15)<.40:continue
        for stalk in range(rng.randrange(4,13)):
            xx,yy=x+rng.gauss(0,.62),y+rng.gauss(0,.52)
            zz=elevation(xx,yy)-.025
            h=rng.uniform(.23,.83);side=rng.uniform(0,2*pi);dx,dy=cos(side),sin(side)
            a=len(verts);w0=rng.uniform(.040,.095);sway=rng.uniform(.13,.34)
            verts.extend([(xx-w0*dy,yy+w0*dx,zz),(xx+w0*dy,yy-w0*dx,zz),(xx+dx*sway,yy+dy*sway,zz+h)])
            faces.append((a,a+1,a+2))
            colors.extend([linear_rgb('555734')]*2+[linear_rgb(rng.choice(['8d8d50','a29b62','727846']))])
    if verts:
        obj=w.mesh('砾滩外缘与缓坡的草丛',verts,faces,'dry-tussock',group)
        w.paint(obj,colors)

def specimen(profile,mode):
    group='plain' if mode else 'mountain'
    grid=profile['grid']
    verts=[(3.5+93*i/nx,depth*j/ny,grid[j][i]) for j in range(ny+1) for i in range(nx+1)]
    stride=nx+1
    faces=[(k,k+1,k+stride+1,k+stride) for j in range(ny) for i in range(nx) for k in [stride*j+i]]
    rim=list(range(stride))+[j*stride+nx for j in range(1,ny+1)]+[ny*stride+i for i in range(nx-1,-1,-1)]+[j*stride for j in range(ny-1,0,-1)]
    turf,meadow,floodplain,stone,gravel_color,shale,ochre,limestone=map(linear_rgb,['394b32','707d43','97885b','827765','98866a','585041','9e7951','ad9675'])
    colors=[]
    materials=[]
    for x,y,z in verts:
        n=field(x,y,z,.10); fine=field(x,y,z,.56)
        center=50+3.5*sin(y/depth*4)
        rim_distance=abs(x-center)
        soil=mix(shale,ochre,.42+.34*n)
        cover=max(0,min(1,.72+.60*(n-.45)+.24*sin(x*.13+y*.16)))
        rock=0 if mode else max(0,min(1,(z-11)/12+1.55*(n-.47)))
        gravel=max(0,min(1,(1-rim_distance/(10 if mode else 4.5))*(1.65 if mode else 1.9)))
        rock*=(1-gravel)
        grass=(1-rock-gravel)*cover
        dirt=1-rock-gravel-grass
        surface=[mix(stone,shale,.16+.40*n),mix(gravel_color,ochre,.24+n*.22),mix(turf,meadow,n),soil]
        colors.append(tuple(sum(c[j]*wgt for c,wgt in zip(surface,[rock,gravel,grass,dirt]))*(.84+.32*fine) for j in range(3)))
        materials.append((rock,gravel,grass))
    # Separate front/side vertices keep the painted cut face sharp at the sod edge.
    prev=None
    for layer in range(25):
        row=[]
        for n in rim:
            x,y,z=verts[n];h=max(0,z*(1-layer/24))
            row.append(len(verts));verts.append((x,y,h))
            below=z-h
            humus=max(0,1-below/(.53+.60*field(x,y,h,.14)))
            seam_h=h+.037*x+.32*sin(.12*x)+.41*sin(.08*y)+.17*sin(.41*x)
            band=sin(seam_h*1.47+.75*sin(seam_h*.63))
            col=mix(shale,ochre,.43+.32*band)
            lens=max(0,(sin(seam_h*3.0)-.30)/.70)*(.27+.30*field(x,y,h,.22))
            col=mix(mix(col,limestone,lens),linear_rgb('493c2c'),humus*.85)
            colors.append(tuple(c*(.80+.36*field(x,y,h,.57)) for c in col))
            rock=max(0,min(.96,(below-1.6)*.37))*(.64+.34*field(x,y,h,.20))
            materials.append((rock,(1-rock)*(.25+.30*lens)*(1-humus),0))
        if prev:
            for k in range(len(row)):
                j=(k+1)%len(row);faces.append((prev[k],row[k],row[j],prev[j]))
        prev=row
    faces.append(tuple(reversed(prev)))
    land=w.mesh('冲积平原与低阶地' if mode else '陡坡、山嘴与V形河槽',verts,faces,'painted-relief',group)
    for f in land.data.polygons: f.use_smooth=f.index<nx*ny
    w.paint(land,colors)
    mask=land.data.color_attributes.new(name='facies',type='FLOAT_COLOR',domain='POINT')
    for swatch,weights in zip(mask.data,materials):
        swatch.color=(*weights,1)
    apply_scan(land.data.materials[0],'valley',14)
    loose_material(profile,mode,group)
    verts=[];faces=[];pigments=[]
    bank_rgb=linear_rgb('84866b')
    current_rgb=linear_rgb('527b79')
    for j in range(ny*3+1):
        jj=min(ny-1,j//3);fraction=j/3-jj
        left,right,height=[a+(b-a)*fraction for a,b in zip(profile['river'][jj],profile['river'][jj+1])]
        y=depth*j/(ny*3)
        for i in range(15):
            t=i/14;x=left+(right-left)*t
            open_water=min(1,max(0,(1-abs(2*t-1))*3.8))
            ripple=sin(y*3.4+.73*sin(x*2.3)+sin(y*.67+x*.27))*.019*open_water
            verts.append((x,y,height+ripple))
            col=mix(bank_rgb,current_rgb,open_water*(.76+.24*field(x,y,0,.45)))
            pigments.append(tuple(c*(.93+.14*field(x,y,0,.82)) for c in col))
            if i<14 and j<ny*3:
                k=j*15+i;faces.append((k,k+1,k+16,k+15))
    water=w.mesh('与岸坡相交的河面',verts,faces,'trace-water',group,True)
    w.paint(water,pigments)
    # A cut lip at each open end exposes water depth at the specimen boundary.
    for j in [0,ny]:
        left,right,h=profile['river'][j];y=depth*j/ny
        w.mesh('河面边缘',[(left,y,h),((2*left+right)/3,y,h-.40),((left+2*right)/3,y,h-.40),(right,y,h)],
               [(0,1,2,3)],'cut-water',group)
    return [land,water]

def keycap(x,group,name,font):
    tilt=radians(18)
    plate=w.block('按键铜托',(x,63,2.0),(18.8,6.7,2.1),'patinated-brass',.60,group)
    plate.rotation_euler.x=-tilt
    face=w.block('象牙搪瓷键面',(x,63.25,3.05),(17.9,5.6,.51),'ivory',.37,group)
    face.rotation_euler.x=-tilt
    curve=bpy.data.curves.new(name,'FONT');curve.body=name;curve.font=font;curve.size=4.6
    curve.align_x=curve.align_y='CENTER';curve.resolution_u=4;curve.extrude=.035
    obj=bpy.data.objects.new(name,curve);w.scene.collection.objects.link(obj)
    obj.location=(x,63.36,3.34);obj.rotation_euler=(tilt,0,pi)
    w.register(obj,name,'scale-ink',group)

leveled_bed(w,(52,31),(108,73),0)
for x in [2,98]:
    w.block('标本托口',(x,30,.43),(2.5,61.3,1.06),'oxidised',.29)
for x in [99.2,104]:
    w.shaft('铣床纵向钢导轨',(x,4,.98),(x,56.5,.98),.52,'steel',segments=24)
for y in [3.8,56.9]:
    w.block('止挡座',(101.6,y,1.38),(7.78,2.8,2.82),'black-green',.35)
    for x in [99.5,103.8]:w.screw(x,y,2.79,.57)
# The travelling post and triangulated beam carry three separate reel housings.
w.block('纵移滑鞍',(101.6,12,2.49),(8.60,6.40,3.11),'patinated-brass',.71,'carriage')
w.turning('旋削测架立柱',(101.6,12),[(3.92,3.0),(4.28,3.30),(5.04,3.27),(5.48,2.47),(7.0,2.01),
          (8.36,1.82),(32.4,1.12),(34.35,1.30),(35.75,1.87),(36.35,2.03),(37.2,1.91),(38.4,1.49)],'oxidised','carriage')
for z in [7.40,34.92]:
    w.turning('窝口抛亮环',(101.6,12),[(z,1.66),(z+.19,1.96),(z+.42,1.92),(z+.54,1.59)],'burnished-brass','carriage',40)
for z in [37.4,39.8]:
    w.shaft('成对的测梁弦杆',(25.2,12,z),(101.6,12,z),.50,'patinated-brass','carriage',24)
for i in range(10):
    x=25.2+7.64*i
    w.shaft('细腹斜撑',(x,12,37.4),(x+7.64,12,39.8),.24,'dark-bronze','carriage',12)
w.shaft('测梁悬挑斜支撑',(101.6,12,27.5),(80.4,12,37.4),.86,'oxidised','carriage',28)
w.block('手推瓷钮座',(105,12,4.15),(4.10,4.63,2.0),'black-green',.43,'carriage')
w.turning('纵移滑架拇指钮',(105,12),[(4.6,1.29),(5.01,1.65),(5.55,1.79),(5.97,1.76),(6.28,1.56)],'blue-enamel','carriage',48)
for i,x in enumerate([27,50,73]):
    group='reel'+str(i)
    for side in [-1,1]:
        front_turn(w,'放线盘颊板',x,12+side*.88,38.7,[(-.22,1.90),(-.08,2.09),(.22,1.95)],'oxidised',group,48)
    w.shaft('绕线芯',(x,11.19,38.70),(x,12.81,38.70),1.08,'flax',group,32)
    front_turn(w,'盘轴锁帽',x,13.17,38.7,[(-.3,.57),(.25,.68),(.43,.50)],'burnished-brass',group,28)
    w.turning('垂线',(x,13.06),[(0,.090),(1,.090)],'flax','line'+str(i),10)
    w.turning('黄铜垂锤',(x,13.06),[(0,.035),(.79,.48),(1.83,.69),(2.07,.66),(2.42,.22),(2.75,.23)],'burnished-brass','bob'+str(i),42)
font_path=Path('C:/Windows/Fonts/msyh.ttc')
font=bpy.data.fonts.load(str(font_path)) if font_path.exists() else bpy.data.fonts.get('Bfont Regular')
for i,x in enumerate([29,51]):keycap(x,'key'+str(i),['山地','平原'][i],font)
for i,profile in enumerate(data['profiles']):specimen(profile,i)
w.export('river-valley',positive_depth=True)
# In both native trials the middle reel follows the channel, and the brass tips
# meet the visible bank or water surface at the line's actual depth.
pivots={g:w.join_movement(g,(0,0,0),'装配 '+g) for g in ['carriage','mountain','plain','key0','key1',
        *['reel'+str(i) for i in range(3)],*['line'+str(i) for i in range(3)],*['bob'+str(i) for i in range(3)]]}
for mode,profile in enumerate(data['profiles']):
    start=1+mode*110
    w.scene.timeline_markers.new(['山地河谷','平原河谷'][mode],frame=start)
    for g in ['mountain','plain']:
        for obj in pivots[g].children:
            for prop in ['hide_render','hide_viewport']:
                setattr(obj,prop,(g=='plain')!=bool(mode));obj.keyframe_insert(data_path=prop,frame=start)
    for i in range(2):
        obj=pivots['key'+str(i)];obj.location.z=-.58 if i==mode else 0
        obj.keyframe_insert(data_path='location',frame=start)
    for t,read in enumerate(profile['readings']):
        frame=start+t;travel=depth*read['v']-13.06
        head=pivots['carriage'];head.location.y=travel;head.keyframe_insert(data_path='location',frame=frame)
        for i,(x,probe) in enumerate(zip([27,50,73],read['probes'])):
            for prefix in ['reel','line','bob']:
                obj=pivots[prefix+str(i)]
                z=0 if prefix=='reel' else probe['height']+.04+(2.64 if prefix=='line' else 0)
                obj.location=(100*probe['u']-x,travel,z)
                obj.keyframe_insert(data_path='location',frame=frame)
                if prefix=='line':
                    obj.scale.z=38.24-z;obj.keyframe_insert(data_path='scale',frame=frame)
for name, group in pivots.items():
    if not group.animation_data:
        continue
    if name in ('key0', 'key1'):
        for curve in group.animation_data.action.fcurves:
            for key in curve.keyframe_points:
                key.interpolation = 'CONSTANT'
    else:
        keys_linear(group)
if font.filepath:font.pack()
w.scene.frame_end=211;w.scene.frame_set(65)
w.photograph('river-valley','河谷断面测量台',(52,30,16),(-32,148,82),129,-4.74,
             detail=((54,36,17),(-38,151,57),94))

