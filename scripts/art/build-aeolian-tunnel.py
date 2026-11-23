"""An open-bed aeolian demonstrator, with a hand-driven centrifugal blower."""
import bpy
from math import cos, sin, exp, pi, tau
from mathutils import Vector, noise
from pathlib import Path
import random
import json
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldbook_workshop import Workshop, ROOT, linear_rgb
from water_workshop import FINISH, front_turn, keys_linear, leveled_bed, reading_plate

w=Workshop('手摇风沙实验风道',FINISH | {
    'aged-cast':('brass','796348',.76,.48), 'reed':('plant','69704b',0,.81),
    'ochre-grass':('plant','9b8b56',0,.76), 'sand':('land','ffffff',0,.84),
    'sandstone':('rock','ffffff',0,.88), 'desert-floor':('land','fffdfb',0,.89),
    'black-oil':('steel','364245',.80,.32), 'cherry-grip':('wood','72462e',.03,.38),
})
rng=random.Random(76)
def strata(name,points,faces,finish,group,at):
    obj=w.mesh(name,points,faces,finish,group,True)
    w.paint(obj,[at(*p) for p in points])
    return obj

def shade(hexcode,value): return tuple(min(1,c*value) for c in linear_rgb(hexcode))
def fn(x,y,z,f): return noise.noise_vector(Vector((x*f,y*f,z*f)))[0]

def ground():
    nx,ny=78,44
    pts=[(21+77*i/nx,6+41*j/ny,.81+.09*sin(i*.57+sin(j*.28))+.09*fn(i,j,0,.32)) for j in range(ny+1) for i in range(nx+1)]
    faces=[(k,k+1,k+nx+2,k+nx+1) for j in range(ny) for i in range(nx) for k in [j*(nx+1)+i]]
    strata('细沙床与微风纹',pts,faces,'desert-floor','bed',lambda x,y,z:shade('ad8960',1+.19*fn(x,y,z,.21)+.09*fn(x,y,z,.98)))

def mushroom():
    # Half-hard driftstone cap over a narrower, wind-abraded plinth.
    profile=[(0,8.5),(.45,9.4),(1.6,8.8),(3.3,7.4),(5.4,6.2),(8,5.6),(10.5,5.8),(12.8,6.5),
             (14.3,7.7),(15.4,10.7),(16.5,13.3),(17.5,14.1),(18.8,13.8),(20.4,14.5),(22,13.6),(23.8,11.7),(25.2,8.1),(26,4.7),(26.3,.25)]
    layers=[]
    for (z,r),(h,rr) in zip(profile,profile[1:]):
        for j in range(3): layers.append((z+(h-z)*j/3,r+(rr-r)*j/3))
    layers.append(profile[-1]);n=96;pts=[]
    for z,rad in layers:
        for i in range(n):
            a=tau*i/n
            broad=.82*sin(3*a+.29)+.51*cos(5*a-.5)+.28*cos(8*a+z*.1)
            furrow=.41*sin(2.4*z+.72*cos(a*3)+.22*cos(8*a))
            r=rad*(1+.116*broad)+min(rad,1)*(.45*fn(cos(a)*rad,sin(a)*rad,z,.7)+furrow)
            xx=57+r*cos(a)*1.17+1.35*(z/26)**2
            yy=26+r*sin(a)*.88+1.02*sin(z*.16)
            zz=1+z+.54*sin(2*a+.37)*min(1,rad/3)*min(1,z/2)+.026*(xx-57)*min(z,1)
            pts.append((xx,yy,zz))
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(layers)-1) for i in range(n)]
    faces += [tuple(reversed(range(n))),tuple(range(len(pts)-n,len(pts)))]
    def color(x,y,z):
        h=z+.032*x+.061*y+.30*fn(x,y,z,.17)
        vein=.53+.47*sin(h*2.2+.25*sin(h*6))
        tone='b48760' if h<17.5 else 'bc9268'
        return shade(tone,.76+.26*vein+.23*fn(x,y,z,.44)+.16*fn(x,y,z,.16))
    return strata('风铣砂岩与悬挑帽层',pts,faces,'sandstone','mushroom',color)

def yardang():
    nx,ny=124,80;pts=[]
    ridges=[(27,75,10.2,3.9,9.7),(33,85,18.3,4.8,14.1),(24,70,26.9,3.7,10.6),(36,93,36.1,4.6,12.0),(27,77,43.4,2.6,6.3)]
    for j in range(ny+1):
        for i in range(nx+1):
            x,y=21+i*77/nx,6+41*j/ny;h=.02
            for k,(a,b,mid,r,peak) in enumerate(ridges):
                u=(x-a)/(b-a)
                if 0<u<1:
                    axis=mid+.65*sin(4*u+k)+.37*sin(8*u+k)*u
                    breadth=r*(.29+.97*sin(pi*u)**.40)*(1-.42*u)
                    q=abs(y-axis)/breadth
                    flank=max(0,1-q**2.8)**.71
                    head=min(1,(u/.13)**.65)
                    h=max(h,peak*head*(1-u)**.58*flank*(.94+.10*fn(x,y,k,.3)))
            pts.append((x,y,.98+h+.065*sin(x*1.3+.53*y)))
    faces=[(k,k+1,k+nx+2,k+nx+1) for j in range(ny) for i in range(nx) for k in [j*(nx+1)+i]]
    return strata('顺主风向的五道残丘与风蚀槽',pts,faces,'sandstone','yardang',
                  lambda x,y,z:shade('b18d67',.91+.13*sin(z*2+.032*x+.04*y)+.14*fn(x,y,z,.41)))

def dune_point(u,v):
    q=2*v-1;a=2*u-1
    span=max(0,1-q*q)
    crest=24*q*q+.69*sin(q*5)
    run=(26 if a<0 else 8.7)*max(.003,span**.75)
    height=10.5*span**.78*(1-abs(a))**(1.52 if a<0 else 1)
    return 57+crest+a*run,26+q*16.3,.99+height+.07*sin(v*20+u*34)*span*max(0,-a)
def dune():
    nx,ny=66,56;pts=[dune_point(i/nx,j/ny) for j in range(ny+1) for i in range(nx+1)]
    faces=[(k,k+1,k+nx+2,k+nx+1) for j in range(ny) for i in range(nx) for k in [j*(nx+1)+i]]
    return strata('新月形沙丘的迎风坡、滑坡面与双翼',pts,faces,'sand','dune',
                  lambda x,y,z:shade('caa571',.94+.085*sin(2.73*x+.21*y+.43*sin(y*.76))+.14*fn(x,y,z,.37)))

def grasses():
    for material,passes in [('reed',1),('ochre-grass',1)]:
        pts=[];faces=[]
        for clump in range(18):
            u=.24+.41*((clump*13%19)/19);v=.12+.77*((clump*7%19)/19)
            x,y,z=dune_point(u,v)
            for i in range(10):
                a=rng.random()*tau;r=rng.random()*.48;l=1.1+rng.random()*2.4
                xx,yy=x+r*cos(a),y+r*sin(a);d=.14+rng.random()*.1
                tip=(xx+.63*l*cos(a)+.80,yy+.5*l*sin(a),z+l*.75)
                k=len(pts);pts += [(xx-d*sin(a),yy+d*cos(a),z-.09),(xx+d*sin(a),yy-d*cos(a),z-.09),
                                    (xx+.27*l*cos(a),yy+.23*l*sin(a),z+.48*l),tip]
                faces += [(k,k+1,k+2),(k+1,k+3,k+2)]
        w.mesh('沙生草丛披针叶',pts,faces,material,'grass',True)

leveled_bed(w,(47,29),(118,59.5),0)
ground();stone=mushroom();yardang();dune();grasses()
for y in [5.6,47.5]:
    w.block('风道压边',(59.4,y,.81),(79.2,.92,1.75),'aged-cast',.25)
for x in [20.5,98.3]:
    w.block('压床口',(x,26.6,.64),(.9,42,1.25),'black-green',.21)
# Cast ram's-horn blower; the circular inlet faces the observer. Air exits the
# wide tangential mouth into the open specimen tray, along positive X.
cx,cz=4.6,16.5
for y in [19.7,33.0]:
    w.block('壳体地脚',(cx,y,1.19),(18.2,3.5,2.3),'black-green',.7)
    for xx in [-2.2,11.1]:w.screw(xx,y,2.35,1.1)
outline=[];inner=[]
for i in range(97):
    a=-pi/2+tau*i/96;r=14.3+1.15*i/96
    outline.append((cx+r*cos(a),cz+r*sin(a)));inner.append((cx+(r-.69)*cos(a),cz+(r-.69)*sin(a)))
pts=[(x,y,z) for y in [18,34] for ring in [outline,inner] for x,z in ring];n=len(outline)
faces=[];smooth=[]
for i in range(n-1):
    a=-pi/2+tau*(i+.5)/96
    if not -1.01<a<-.43:
        smooth.append(len(faces));smooth.append(len(faces)+1)
        faces.extend([(i,i+1,2*n+i+1,2*n+i),(n+i,3*n+i,3*n+i+1,n+i+1)])
    faces.extend([(i,n+i,n+i+1,i+1),(2*n+i,2*n+i+1,3*n+i+1,3*n+i)])
shell=w.mesh('铸铜蜗壳与切向排风口',pts,faces,'aged-cast')
for i in smooth:shell.data.polygons[i].use_smooth=True
for y in [18.4,33.7]:
    front_turn(w,'卷边法兰',cx,y,cz,[(-.4,11.45),(-.38,14.35),(-.13,15.07),(.22,15.13),(.51,14.61),(.54,11.65)],'patinated-brass',ring=True)
    for i in range(14):
        a=tau*i/14
        front_turn(w,'法兰锁栓',cx+13.94*cos(a),y+.55,cz+13.94*sin(a),[(-.19,.34),(.28,.43),(.44,.35)],'burnished-brass',segments=8)
front_turn(w,'蜗壳背盖',cx,18,cz,[(-.48,13.87),(.2,14.04),(.43,13.56)],'black-green')
# Four sheet flanges form the expanding discharge; both ends are open.
rings=[[(15.45,18.5,1.2),(15.45,33.5,1.2),(15.45,33.5,10.2),(15.45,18.5,10.2)],
       [(26.1,12.4,1.2),(26.1,39.5,1.2),(26.1,39.5,6.7),(26.1,12.4,6.7)]]
duct=w.mesh('扁口扩散导风嘴',rings[0]+rings[1],[(i,(i+1)%4,4+(i+1)%4,4+i) for i in range(4)],'black-green')
solid=duct.modifiers.new('翻边铁皮','SOLIDIFY');solid.thickness=.23
for i in range(4):w.shaft('出风口卷边',rings[1][i],rings[1][(i+1)%4],.26,'burnished-brass',segments=12)
# Curved, riveted centrifugal blades on the driven spindle.
for i in range(11):
    a=i*tau/11;pts=[]
    for y in [19.2,32]:
        for j in range(8):
            t=j/7;angle=a+.46*t;r=4+7.55*t
            pts.append((cx+r*cos(angle),y,cz+r*sin(angle)))
    obj=w.mesh('铆接弯叶',pts,[(j,j+1,j+9,j+8) for j in range(7)],'patinated-brass','rotor',True)
    mod=obj.modifiers.new('叶片厚度','SOLIDIFY');mod.thickness=.24
front_turn(w,'叶轮钢芯',cx,26,cz,[(-7.2,3.85),(-6.8,4.65),(5.8,4.65),(6.8,3.7)],'black-oil','rotor')
front_turn(w,'主轴',cx,35,cz,[(-7.2,1.16),(10.7,1.16),(10.92,1.0)],'steel','rotor')
# Front bearing bridge is fixed; the crimson flywheel and walnut grip turn on
# the same steel shaft. Its rim stays clear of the sample and all inscriptions.
w.block('前轴承脚',(cx,39.4,1.1),(10.6,5.2,2.15),'aged-cast',.6)
w.turning('车削前轴承柱',(cx,39.4),[(2.05,2.35),(2.45,2.65),(3.1,2.47),(3.7,1.63),(12.6,1.17),(13.75,1.68)],'patinated-brass')
front_turn(w,'铜衬滑动轴承',cx,39.4,cz,[(-2.8,1.82),(-2.5,2.9),(2.47,2.9),(2.67,1.84)],'aged-cast')
front_turn(w,'红漆手轮与磨亮的轮缘',cx,44.2,cz,[(-.58,8.75),(-.5,9.78),(.0,10.13),(.48,9.9),(.66,9.15)],'dark-bronze','wheel',ring=True)
front_turn(w,'手轮抛光凸边',cx,44.7,cz,[(-.17,9.61),(.04,9.86),(.2,9.68),(.17,9.53)],'burnished-brass','wheel',ring=True)
for i in range(5):
    a=tau*i/5;w.curve('流线辐臂',[(cx+r*cos(a+.33*(1-r/9)),44.2,cz+r*sin(a+.33*(1-r/9))) for r in [1.0,2.8,5,7.2,9.2]],.48,'dark-bronze','wheel')
front_turn(w,'紧固轮毂',cx,44.4,cz,[(-1.18,1.28),(-.64,2.15),(.86,1.96),(1.39,1.07)],'burnished-brass','wheel')
front_turn(w,'握柄销与挡圈',cx,46.2,cz-9.34,[(-2.3,.58),(-.74,.86),(.61,.77),(5.68,.43)],'steel','grip')
front_turn(w,'旋削核桃木摇柄',cx,47.05,cz-9.34,[(-1.05,.86),(-.66,1.25),(0,1.23),(.35,.93),(1.03,.87),(2.98,1.25),(4.15,1.32),(4.59,1.12),(4.79,.74)],'cherry-grip','grip')
# Two words per key leave room to read the silhouettes behind them.
font=bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc');font.pack()
for i,(x,label) in enumerate(zip([28,48,68,88],['蘑菇','雅丹','沙丘','固沙'])):
    group='key'+str(i);mark=reading_plate(w,label,x,53.0,1.57,17.2,6.7,21,group)
    xx,z,y=mark['at'];font_curve=bpy.data.curves.new(label,'FONT');font_curve.body=label;font_curve.font=font
    font_curve.align_x=font_curve.align_y='CENTER';font_curve.size=5.12;font_curve.resolution_u=4;font_curve.extrude=.027
    obj=bpy.data.objects.new('瓷键 '+label,font_curve);w.scene.collection.objects.link(obj);obj.location=(xx,y,z+.018);obj.rotation_euler=(mark['angle'],0,pi)
    w.register(obj,'瓷键 '+label,'scale-ink',group)
w.export('aeolian',positive_depth=True)
# Bind surface scans after mesh transfer; runtime applies the same tiling.
from earth_material import apply_scan
for obj,finish,group in w.parts:
    if finish in ['sandstone','sand','desert-floor']:
        apply_scan(obj.data.materials[0],'outcrop' if finish=='sandstone' else 'alluvium',16 if finish=='sandstone' else 8)
# Native editable animation, one trial for each independent specimen.
pivots={g:w.join_movement(g,(cx,44.2,cz),'同轴 '+g) for g in ['wheel','rotor','grip']}
for obj in pivots.values():
    for frame,angle in [(1,0),(121,tau*3),(122,0),(242,tau*3),(243,0),(363,tau*3),(364,0),(484,tau*3)]:
        obj.rotation_euler.y=-angle;obj.keyframe_insert(data_path='rotation_euler',frame=frame)
    keys_linear(obj)
key_height={obj:obj.location.z for obj,_,group in w.parts if group.startswith('key')}
for i,name in enumerate(['风蚀蘑菇','雅丹','新月形沙丘','植被固沙']):
    start=1+i*121;w.scene.timeline_markers.new(name,frame=start)
    for obj,_,group in w.parts:
        if group in ['mushroom','yardang','dune','grass']:
            hide=not (group==['mushroom','yardang','dune','dune'][i] or group=='grass' and i==3)
            for prop in ['hide_render','hide_viewport']:
                setattr(obj,prop,hide);obj.keyframe_insert(data_path=prop,frame=start)
        if group.startswith('key'):
            obj.location.z=key_height[obj]-(.44 if int(group[3:])==i else 0)
            obj.keyframe_insert(data_path='location',frame=start)
        if group=='dune':
            for frame,dx in [(start,-6 if i==2 else 0),(start+120,6 if i==2 else 0)]:
                obj.location.x=dx;obj.keyframe_insert(data_path='location',frame=frame)
for obj,_,group in w.parts:
    if group.startswith('key'):
        for c in obj.animation_data.action.fcurves:
            for key in c.keyframe_points: key.interpolation='CONSTANT'
    if group=='dune':
        for c in obj.animation_data.action.fcurves:
            if c.data_path=='location':
                for k in c.keyframe_points:k.interpolation='LINEAR'
base=stone.shape_key_add(name='未风蚀的石体')
for name,f,erosion in [('观察起点',1,.55),('观察终点',121,1)]:
    key=stone.shape_key_add(name=name)
    for row in key.data:
        x,y,z=row.co;fac=1-.5*erosion*exp(-(((z-1-8)/6.5)**2));row.co=(57+(x-57)*fac,26+(y-26)*fac,z)
    for at,val in [(1,int(f==1)),(121,int(f==121))]:
        key.value=val;key.keyframe_insert(data_path='value',frame=at)
keys_linear(stone.data.shape_keys)
trials=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/art/sample-aeolian.mjs')],cwd=ROOT))
for grain_id in range(18):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.25+(grain_id%3)*.09)
    grain=bpy.context.object;grain.name='跃移砂粒 %02d'%(grain_id+1)
    grain.data.materials.append(w.material('sediment'))
    for trial,frames in enumerate(trials):
        for tick,row in enumerate(frames):
            x,h,y,visible=row[grain_id];frame=1+121*trial+tick
            grain.location=(x,y,h);grain.keyframe_insert(data_path='location',frame=frame)
            grain.hide_render=grain.hide_viewport=not visible
            if tick==0 or visible!=frames[tick-1][grain_id][-1]:
                for prop in ['hide_render','hide_viewport']:grain.keyframe_insert(data_path=prop,frame=frame)
    for curve in grain.animation_data.action.fcurves:
        for key in curve.keyframe_points:key.interpolation='LINEAR' if curve.data_path=='location' else 'CONSTANT'
w.scene.frame_end=484;w.scene.frame_set(52)
w.photograph('aeolian','手摇风沙实验风道',(47,27,11),(-33,143,69),135,-4.74,detail=((49,27,13),(-19,144,43),102))
