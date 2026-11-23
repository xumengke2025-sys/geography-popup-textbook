"""Two rain-catchment buildings and a planted infiltration bed for the same finite rain experiment."""
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldbook_workshop import Workshop, ROOT
from earth_material import apply_scan

rng = random.Random(832)
w = Workshop('街区雨水剖面标本', {
    'brick': ('rock', 'a57963', 0, .83), 'limestone': ('rock', 'd1bfa0', 0, .78),
    'flashing': ('brass', '739084', .65, .57), 'pane': ('enamel', '3f5960', .12, .23),
    'sash': ('wood', 'b8af95', .05, .64), 'slate': ('rock', '56646a', .02, .64),
    'slate-lap': ('rock', '707c7c', .04, .70), 'gravel': ('rock', 'a99d86', 0, .90),
    'gravel-light': ('rock', 'c0ac91', 0, .88), 'reeds': ('plant', '757c4e', 0, .82),
    'rush': ('plant', '536842', 0, .84), 'spike': ('plant', '856448', 0, .79),
    'road': ('rock','788082',0,.87),
    'loam': ('land', '876c52', 0, .91), 'sand': ('rock', 'beaa79', 0, .88),
})
def box(name,c,d,finish,group,r=.035):
    return w.block(name,c,d,finish,r,group)
def roof(x,y,z,a,b,h,group):
    rows=[(x-a,y-b,z),(x+a,y-b,z),(x+a,y+b,z),(x-a,y+b,z),
          (x-a+b*.72,y,z+h),(x+a-b*.72,y,z+h)]
    w.mesh('四坡叠瓦屋面',rows,[(0,3,2,1),(0,1,5,4),(1,2,5),(2,3,4,5),(3,0,4)],'slate',group)
    for t in [.18,.36,.54,.72,.9]:
        for side in [-1,1]:
            extent=a-b*.72*t
            w.curve('板瓦搭接边',[(x-extent,y+side*b*(1-t),z+t*h+.035),
                                  (x+extent,y+side*b*(1-t),z+t*h+.035)],.045,'slate-lap',group)
    w.curve('脊瓦',[(x-a+b*.72,y,z+h+.05),(x+a-b*.72,y,z+h+.05)],.16,'slate-lap',group)
def building(x,y,a,b,h,hall):
    group='pump-house' if hall else 'terrace-house'
    floor=21.0; top=floor+h; front=y+b
    wall='limestone' if hall else 'brick'
    box('砌体外墙',(x,y,floor+h/2),(2*a,2*b,h),wall,group,.09)
    box('勒脚',(x,y,floor+.48),(2*a+.35,2*b+.35,.96),'limestone',group)
    box('层间石线',(x,y,floor+h*.52),(2*a+.3,2*b+.3,.39),'limestone',group)
    box('檐下线脚',(x,y,top-.23),(2*a+.8,2*b+.68,.65),'limestone',group,.11)
    roof(x,y,top,a+.65,b+.6,4.3 if hall else 3.7,group)
    for offset in [-.76,-.39,0,.39,.76]:
        wx=x+a*offset
        for level in [0,1]:
            height=2.15 if level else 2.65
            bottom=floor+(h*.61 if level else 1.55)
            door=not level and offset==0
            if door:bottom=floor+.28;height=5.1
            width=2.25 if door else 1.59
            box('门窗外框',(wx,front+.10,bottom+height/2),(width+.24,.28,height+.28),'sash',group,.025)
            box('木门' if door else '窗玻璃',(wx,front+.27,bottom+height/2),(width,.12,height),'teal' if door else 'pane',group,0)
            if not door:
                box('木窗竖棂',(wx,front+.35,bottom+height/2),(.10,.08,height),'sash',group,0)
                box('窗横档',(wx,front+.35,bottom+height*.56),(width,.08,.11),'sash',group,0)
            box('窗台',(wx,front+.23,bottom-.14),(width+.51,.51,.20),'limestone',group,.04)
            box('过梁',(wx,front+.22,bottom+height+.23),(width+.64,.45,.31),'limestone',group,.035)
    for side in [-1,1]:
        for yy in [-.54,.54]:
            box('山墙窗',(x+side*(a+.06),y+b*yy,floor+h*.66),(.17,1.81,2.6),'pane',group)
            box('侧窗石台',(x+side*(a+.13),y+b*yy,floor+h*.66-1.4),(.35,2.23,.2),'limestone',group)
        by=front+.8; bx=x+side*(a-.34)
        w.curve('铜制落水管',[(bx,by,top),(bx,by,top-.45),(bx,front+.32,top-1.03),
            (bx,front+.32,floor+.48),(bx,by+.67,floor+.22)],.16,'flashing',group)
        for zz in [floor+2.2,top-2.2]:box('落水管卡箍',(bx,front+.36,zz),(.56,.4,.16),'bronze',group)
    w.curve('接雨檐沟',[(x-a-.52,front+.63,top-.01),(x+a+.52,front+.63,top-.01)],.19,'flashing',group)
    for cx in [x-a*.53,x+a*.51]:
        box('砖烟囱',(cx,y-1.9,top+3.8),(1.5,1.7,4.25),'brick',group,.05)
        box('烟囱压顶',(cx,y-1.9,top+5.96),(1.89,2.04,.42),'limestone',group)
        w.shaft('陶质烟囱帽',(cx,y-1.9,top+6.09),(cx,y-1.9,top+6.98),.46,'clay',group,16)
    if hall:
        # Front pediment breaks the hipped silhouette on the adjoining pump house.
        tri=[(x-4,front+.42,top-.08),(x+4,front+.42,top-.08),(x,front+.42,top+2.62)]
        w.mesh('泵房石山花',tri+[(xx,yy-.6,zz) for xx,yy,zz in tri],[(0,2,1),(3,4,5),(0,1,4,3),(2,0,3,5),(1,2,5,4)],'limestone',group)
        w.curve('山花压边',[tri[0],tri[2],tri[1]],.18,'limestone',group)
        for xx in [x-2.55,x+2.55]:
            w.shaft('门廊柱',(xx,front+.83,floor+.42),(xx,front+.83,floor+5.8),.35,'limestone',group,16)
        box('入口雨篷',(x,front+.58,floor+5.9),(6.8,2,.39),'flashing',group)
    for i in range(2):
        box('石门阶',(x,front+.65+i*.48,floor+.2-i*.095),(3.9+i*.35,1.25,.37-i*.16),'limestone',group)
building(20.5,24,9.5,5.4,11.9,False)
building(78.1,24.8,10.2,5.8,10.5,True)

for i,(x,y) in enumerate([(39,23),(43,30),(47.3,20),(51,28),(56.5,22),(59.4,33),(40.3,41),(54,43),(58,46),(47.8,36)]):
    h=rng.uniform(4.2,7.8)
    for j in range(11):
        angle=j*2.4+rng.uniform(-.2,.2);length=rng.uniform(.48,1.26)*h
        reach=rng.uniform(.15,.62)*length;wid=rng.uniform(.15,.31);verts=[]
        for t,width in [(0,.33),(.34,1),(.72,.61),(1,.025)]:
            mid=Vector((x+math.cos(angle)*reach*t**1.42,y+math.sin(angle)*reach*t**1.42,16.9+length*(t-.18*t*t)))
            side=Vector((-math.sin(angle)*wid*width,math.cos(angle)*wid*width,0))
            verts.extend([mid-side,mid+Vector((0,0,.14*width)),mid+side])
        faces=[]
        for k in range(3):
            for n in range(2):
                a=k*3+n;faces.extend([(a,a+3,a+4),(a,a+4,a+1)])
        # Folded leaf is visible from either bank of the model.
        w.mesh('莎草折叶',verts,faces+[tuple(reversed(f)) for f in faces], 'rush' if j%3 else 'reeds','garden-plants')
    for j in range(2):
        tip=(x+rng.uniform(-1,1),y+rng.uniform(-1,1),16.9+h+rng.uniform(0,1.8))
        start=(x,y,16.87);w.shaft('蒲草花茎',start,tip,.065,'rush','garden-plants',8)
        w.shaft('褐色圆柱穗',tip,(tip[0]+.09,tip[1]+.09,tip[2]+.94),.20,'spike','garden-plants',10,.14)

def gravel(x,y,z,sx,sy,sz,group,i):
    points=[];N=8
    for zz,rad in [(-1,.41),(-.39,.92),(.35,1),(.92,.49)]:
        for q in range(N):
            t=(q+.14*zz)*2*math.pi/N;r=rng.uniform(.84,1.14)*rad
            points.append((x+sx*r*math.cos(t),y+sy*r*math.sin(t),z+sz*zz))
    faces=[tuple(reversed(range(N))),tuple(range(3*N,4*N))]
    for row in range(3):
        for a in range(N):
            b=(a+1)%N;faces.append((row*N+a,row*N+b,(row+1)*N+b,(row+1)*N+a))
    w.mesh('水磨卵石',points,faces,'gravel-light' if i%3==0 else 'gravel',group,True)
for i in range(34):
    y=rng.uniform(18,49);x=(36.6 if i%2 else 63.4)+rng.uniform(-.5,.5)
    gravel(x,y,17.08,rng.uniform(.4,1),rng.uniform(.39,.84),rng.uniform(.23,.5),'garden-pebbles',i)
for i in range(58):
    col=i%20;row=i//20
    gravel(36.7+col*1.32+rng.uniform(-.22,.22),56.02,3.56+row*1.24+rng.uniform(-.16,.16),
           rng.uniform(.56,.91),rng.uniform(.15,.3),rng.uniform(.44,.67),'garden-cut-gravel',i)
# Flagged footways and tightly seated inspection covers connect the facades to
# the street. These are sealed service lids, clear of the one active rain inlet.
for x0,x1 in [(7.2,34.7),(65.3,91)]:
    for row in range(2):
        x=x0
        while x<x1-.18:
            size=min(x1-x, 2.8 if x==x0 and row else 5.1)
            box('人行道石板',(x+size*.5,32.6+row*1.85,21.01),(size-.09,1.77,.29),'limestone','footway',.045)
            x+=size
for x,y in [(22.4,43.1),(76.9,40.8)]:
    w.turning('铸铁检修圈',(x,y),[(20.82,1.62),(20.94,1.67),(21.04,1.57)],'bronze','street-lids',28)
    w.turning('密闭检修盖',(x,y),[(21.04,1.48),(21.1,1.43)],'teal','street-lids',28)
    for delta in [-.69,-.22,.25,.72]:
        length=2*math.sqrt(1.30**2-delta**2)
        box('盖面防滑条',(x+delta,y,21.14),(.081,length,.068),'steel','street-lids',.01)
# A pair of cast iron street lamps marks the scale and frames the two downpipes.
for x in [9.2,89]:
    y=32
    w.turning('铸铁街灯脚柱',(x,y),[(20.89,.67),(21.22,.68),(21.37,.48),(22.4,.37),(22.62,.25),(27.8,.15),(28,.31)],'teal','street-lamps',16)
    w.turning('磨砂灯罩',(x,y),[(28,.32),(28.35,.59),(29,.68),(29.43,.41)],'ivory','street-lamps',8)
    w.turning('灯帽',(x,y),[(29.42,.67),(29.56,.72),(29.84,.37),(30.11,.11)],'teal','street-lamps',8)

w.export('urban-waterlogging',positive_depth=True)
# Editable master depicts the planted option. Other street surfaces and the
# hinged instrument are assembled by the page from their hydraulic profiles.
for xa,xb,low,high,finish in [(6,92,0,3,'walnut'),(6,36,3,19.8,'loam'),(64,92,3,19.8,'loam'),
    (36,64,3,7.2,'gravel'),(36,64,7.2,8.6,'sand'),(36,64,8.6,13,'sediment'),
    (36,64,13,16.3,'loam'),(36,64,16.3,16.9,'bark'),(6,36,19.8,20.8,'road'),(64,92,19.8,20.8,'road')]:
    box('剖面可编辑层',((xa+xb)/2,35,(low+high)/2),(xb-xa,42,high-low),finish,None)
for x in [5.6,92.4]:
    box('黄铜试件边口',(x,35,20.7),(.8,43,.51),'brass',None)
for finish,kind,span in [('road','alluvium',4.3),('loam','loam',11),('walnut','walnut',22),
                         ('gravel','alluvium',6),('gravel-light','alluvium',5),('limestone','outcrop',3.5),
                         ('sand','alluvium',3.6),('sediment','alluvium',7),('bark','loam',10)]:
    apply_scan(w.material(finish),kind,span)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.object.camera_add(location=(103,160,95));cam=bpy.context.object
cam.rotation_euler=(Vector((51,35,16))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.type='ORTHO';cam.data.ortho_scale=112;w.scene.camera=cam
for loc,power in [((42,94,116),96000),((115,8,78),58000)]:
    bpy.ops.object.light_add(type='AREA',location=loc);obj=bpy.context.object
    obj.data.energy=power;obj.data.shape='DISK';obj.data.size=62
    obj.rotation_euler=(Vector((48,34,15))-obj.location).to_track_quat('-Z','Y').to_euler()
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.color_type='MATERIAL'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'release/Blender/制作素材/街区雨水剖面标本.blend'),compress=True)
