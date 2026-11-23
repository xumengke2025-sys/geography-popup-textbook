"""Build the open eight-speed teaching orrery and its interactive mesh groups."""
from math import atan, atan2, cos, pi, radians, sin, sqrt, tan, tau
from pathlib import Path
import json
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldbook_workshop import ROOT, Workshop, linear_rgb
from water_workshop import FINISH, keys_linear

SPAN = 20
SUN_HEIGHT = 42
RIM_HEIGHT = 35.6
SPEC = json.loads((ROOT/'src/assets/orrery-mechanism.json').read_text(encoding='utf8'))
RADII = SPEC['orbitRadii']
SIZES = SPEC['bodyRadii']
NAMES = ['水星', '金星', '地球', '火星', '木星', '土星', '天王星', '海王星']
# Pitch radii sum to the common arbor spacing on each floor of the train.
COUNTS = SPEC['gearTeeth']
w = Workshop('手摇八行星仪', FINISH | {
    'midnight': ('enamel','183d46',.13,.25), 'porcelain': ('ivory','f0e3bf',.03,.32),
    'dial-ink': ('enamel','272d29',.03,.54), 'gold-leaf': ('brass','e7c277',.78,.26),
    'aged-casting': ('brass','705a3c',.73,.48), 'rubbed-lip': ('brass','c9a16c',.86,.26),
    'recessed-copper': ('brass','635a45',.62,.53), 'oiled-walnut': ('wood','69462e',.02,.38),
    'pointer-blue': ('steel','405360',.76,.30), 'oxblood': ('enamel','843e33',.04,.31),
    'lacquer-globe': ('ivory','ffffff',.06,.32),
})


def annulus(name, x, y, z, r, ri, thick, finish, group='frame', steps=128):
    profile=[(z-thick/2,ri),(z-thick/2,r-.09),(z-thick/2+.09,r),
             (z+thick/2-.09,r),(z+thick/2,r-.09),(z+thick/2,ri)]
    return w.turning(name,(x,y),profile,finish,group,steps,loop=True)


def prism(name, outline, low, high, finish, group, bevel=0):
    n=len(outline)
    verts=[(x,y,h) for h in (low,high) for x,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    obj=w.mesh(name,verts,faces,finish,group)
    if bevel:
        mod=obj.modifiers.new('磨边','BEVEL')
        mod.width,mod.segments=bevel,2
        obj.modifiers.new('平面法线','WEIGHTED_NORMAL')
    return obj


def involute(r, rb):
    tangent=sqrt(max(0,(r/rb)**2-1))
    return tangent-atan(tangent)


def gear(name, x, y, z, teeth, pitch, finish, group, phase=0):
    module=2*pitch/teeth
    root,tip=pitch-1.20*module,pitch+.87*module
    base=pitch*cos(radians(20))
    flank=[max(root,base+.001)+(tip-max(root,base+.001))*j/3 for j in range(4)]
    half=lambda r:pi/(2*teeth)+involute(pitch,base)-involute(r,base)
    pattern=[(-pi/teeth,root),(-half(flank[0]),root)]
    pattern.extend((-half(r),r) for r in flank)
    pattern.extend((half(r),r) for r in reversed(flank))
    pattern.append((half(flank[0]),root))
    rim=[]
    for i in range(teeth):
        for a,r in pattern:
            point=(phase+tau*i/teeth+a,r)
            if not rim or (abs(point[0]-rim[-1][0])+abs(point[1]-rim[-1][1])>.0001):
                rim.append(point)
    ri=root*.84
    verts=[(x+r*cos(a),y+r*sin(a),height) for height in (z-.33,z+.33)
           for inside in (False,True) for a,rr in rim for r in [ri if inside else rr]]
    n=len(rim)
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(j,i,n+i,n+j),(2*n+i,2*n+j,3*n+j,3*n+i),
                      (i,j,2*n+j,2*n+i),(n+j,n+i,3*n+i,3*n+j)])
    rim_obj=w.mesh(name,verts,faces,finish,group)
    bevel=rim_obj.modifiers.new('齿顶及轮缘去锐','BEVEL')
    bevel.width,bevel.segments=.058,1
    rim_obj.modifiers.new('齿面法线','WEIGHTED_NORMAL')
    hub=min(2.1,root*.60)
    if group.startswith('pinion'):
        bore=.58+.145*int(group.removeprefix('pinion'))-.09
        hub=max(hub,bore+.38)
        annulus('开孔输出毂',x,y,z,hub,bore,.82,finish,group,48)
    else:
        w.turning('键接轮毂',(x,y),[(z-.41,hub*.9),(z-.31,hub),(z+.30,hub),(z+.42,hub*.9)],finish,group,32)
    for i in range(5 if teeth>20 else 3):
        a=phase+tau*i/(5 if teeth>20 else 3)
        # Narrow tapered spoke, with a curved transition into the toothed rim.
        def edge(t,sign):
            r=hub*.80+(ri*1.015-hub*.80)*t
            angle=a+.18*sin(t*pi*.73)
            width=(.11+.06*cos(t*pi*2))*min(6,root)
            return x+r*cos(angle)-sign*width*sin(angle)/2,y+r*sin(angle)+sign*width*cos(angle)/2
        outline=[edge(j/5,-1) for j in range(6)]+[edge(j/5,1) for j in reversed(range(6))]
        prism('弯辐',outline,z-.26,z+.26,finish,group)


def lettering(text,x,y,z,angle,size,finish,group='frame'):
    """Horizontal engraving in the tool frame; caller may mount the text upright."""
    curve=bpy.data.curves.new(text,'FONT')
    curve.body=text
    curve.font=engraver
    curve.size,curve.align_x,curve.align_y,curve.resolution_u=size,'CENTER','CENTER',4
    obj=bpy.data.objects.new(text,curve)
    w.scene.collection.objects.link(obj)
    obj.location=(x,y,z)
    obj.rotation_euler.z=angle
    return w.register(obj,'盘面刻字 '+text,finish,group)


def cabinet():
    # Ring foot supports sit outside the orbit swept by the carriers.
    w.turning('旋削胡桃木底托',(6,0),[(0,18.9),(.45,20.2),(1.1,20.5),(1.46,20.2),
              (1.74,19.1),(2.36,18.6),(2.72,18.75),(3.18,18.3)],'walnut',segments=112)
    w.turning('木座嵌线',(6,0),[(1.3,20.12),(1.44,20.34),(1.61,20.05)],'gold-leaf',segments=112)
    w.turning('机芯承重底板',(6,0),[(3.14,17.8),(3.58,18.45),(4.35,18.4),(4.60,18.05)],'midnight',segments=96)
    bezel_start=len(w.parts)
    for angle in [radians(90),radians(212),radians(328)]:
        x,y=49.8*cos(angle),49.8*sin(angle)
        # A pierced wishbone casting joins each tall post to the central foot.
        rootx,rooty=6+14*cos(angle),14*sin(angle)
        for side in [-1,1]:
            points=[]
            for k in range(17):
                t=k/16
                spread=side*(2.4*(1-t)+1.76*sin(pi*t))
                points.append((rootx+(x-rootx)*t-spread*sin(angle),rooty+(y-rooty)*t+spread*cos(angle),
                               3.3+.85*sin(t*pi)+.7*t))
            w.curve('分叉撑脚',points,.77,'midnight')
        w.turning('三点调平脚与立柱',(x,y),[(0,2.35),(.34,2.83),(.91,2.74),(1.4,1.9),(2,1.62),
                  (2.8,2.16),(3.1,2.3),(4.5,2.20),(5.1,1.57),(5.9,1.46),(6.4,1.9),
                  (6.9,1.86),(7.35,1.31),(8.25,.98),(27.5,.71),(29.2,.96),(30,1.27),
                  (30.48,1.24),(31.0,1.64),(32.0,1.64),(32.48,1.22),(34.9,1.34)],'patinated-brass')
        w.turning('亮铜柱头',(x,y),[(33.7,1.34),(33.9,1.93),(34.6,2.05),(34.96,1.82)],'gold')
    annulus('轨道盘乌蓝珐琅胎',0,0,RIM_HEIGHT,52.6,47.8,1.6,'midnight',steps=256)
    annulus('象牙白分度圈',0,0,36.50,52.08,48.32,.28,'porcelain',steps=256)
    for r in (48.15,52.39):
        annulus('两侧压边',0,0,36.40,r+.19,r-.19,.40,'gold',steps=256)
    tick_verts,tick_faces=[],[]
    for i in range(180):
        a=tau*i/180
        mark=1.06 if i%5==0 else .50
        half=.113 if i%5==0 else .055
        p=len(tick_verts)
        for rad,sg in [(48.45,-1),(48.45+mark,-1),(48.45+mark,1),(48.45,1)]:
            tick_verts.append((rad*cos(a)-sg*half*sin(a),rad*sin(a)+sg*half*cos(a),36.66))
        tick_faces.append((p,p+1,p+2,p+3))
    w.mesh('双度短线及十度长线',tick_verts,tick_faces,'dial-ink','frame')
    for i in range(12):
        a=-tau*i/12
        lettering(str(i*30)+'°',50.75*cos(a),50.75*sin(a),36.67,a+pi/2,1.8,'dial-ink')
    for k in range(bezel_start,len(w.parts)):
        obj,finish,_=w.parts[k]
        w.parts[k]=(obj,finish,'bezel')
    # Each wire sight hoop is silver-soldered to its own carriage below the planet.
    for i,r in enumerate(RADII):
        annulus('轨道 '+NAMES[i],0,0,33.87-.95*i,r+.12,r-.12,.22,'gold' if i==2 else 'bronze','orbit'+str(i),160)


def bevel_crown(name, front):
    # A pair of straight, mitred conical gears. Matching pitch cones share an apex.
    count=22
    verts=[]
    depth=10
    for level,r,amplitude in [(2.85,2.66,.22),(4.65,4.46,.32),(4.9,4.18,.22)]:
        for i in range(count):
            for frac,delta in [(0,-1),(.20,-1),(.38,1),(.62,1),(.81,-1)]:
                a=tau*(i+frac)/count
                u,v=(r+amplitude*delta)*cos(a),(r+amplitude*delta)*sin(a)
                verts.append((SPAN+u,-level,depth+v) if front else (SPAN+u,v,depth+level))
    n=count*5
    faces=[tuple(reversed(range(n))),tuple(range(2*n,3*n))]
    faces.extend((row*n+i,row*n+(i+1)%n,(row+1)*n+(i+1)%n,(row+1)*n+i)
                 for row in range(2) for i in range(n))
    w.mesh(name,verts,faces,'gold' if front else 'bronze','wheel' if front else 'driver')


def crank():
    for y in (-21,-10):
        w.block('前轴承铸脚',(SPAN,y,5.42),(6.0,4.55,2.0),'midnight',.49)
        w.block('轴承座腹板',(SPAN,y,7.80),(4.28,3.8,4.31),'midnight',.61)
        w.shaft('可拆轴瓦',(SPAN,y-2.01,10),(SPAN,y+2.01,10),2.25,'gold',segments=40)
        for x in (SPAN-2.18,SPAN+2.18):
            w.screw(x,y,6.42,.66)
    w.block('伸出式曲柄底托',(SPAN,-15.1,3.51),(7.65,22.5,2.48),'walnut',.67)
    w.shaft('精钢横轴',(SPAN,-25.2,10),(SPAN,-3,10),.81,'steel','wheel')
    bevel_crown('主动锥齿轮',True)
    bevel_crown('从动锥齿轮',False)
    w.shaft('八级共同输入轴',(SPAN,0,8),(SPAN,0,25.48),1.13,'steel','driver')
    w.turning('主轴锁紧帽',(SPAN,0),[(24.62,1.3),(24.76,1.75),(25.13,1.81),(25.30,1.64),
              (25.52,1.63),(25.88,1.37),(26.05,.85)],'gold','driver',32)
    w.turning('下轴瓦',(SPAN,0),[(4.52,2.98),(5.12,3.15),(5.48,2.86),(10.5,1.64),
              (11.05,1.94),(12.1,1.94),(12.37,1.47)],'midnight')
    # Bowed rather than straight crank web, with a wooden thumbpiece.
    pts=[(SPAN+5.2*cos(tau*i/96),-25,10+5.2*sin(tau*i/96)) for i in range(96)]
    w.curve('手轮圈',pts,.44,'burnished-brass','wheel',True)
    for k in range(3):
        points=[]
        for j in range(9):
            t=j/8
            a=k*tau/3+.31*sin(pi*t)
            points.append((SPAN+5.2*t*cos(a),-25,10+5.2*t*sin(a)))
        w.curve('手轮弯辐',points,.31,'gold','wheel')
    w.shaft('手柄销',(SPAN+5.2,-25.0,10),(SPAN+5.2,-28.8,10),.38,'steel','wheel')
    handle=w.turning('胡桃木摇柄',(0,0),[(0,.37),(.28,.63),(.62,.72),(2.03,.66),(2.62,.82),(2.86,.78),(3,.45)],'walnut','grip',32)
    handle.location=(SPAN+5.2,-25.63,10)
    handle.rotation_euler.x=pi/2
    for offset,r in [(.22,.58),(2.85,.75)]:
        w.shaft('木柄护端',(SPAN+5.2,-25.63-offset,10),(SPAN+5.2,-25.63-offset-.14,10),r,'rubbed-lip','grip',32)


def front_disc(name, center, radius, depth, finish, group='stand', inner=None):
    x,y,h=center
    if inner is None:
        return w.shaft(name,(x,y+depth/2,h),(x,y-depth/2,h),radius,finish,group,80)
    ring=annulus(name,0,0,0,radius,inner,depth,finish,group,96)
    ring.rotation_euler.x=pi/2
    ring.location=center
    return ring


def controls():
    # A low, tenoned forestock carries both controls clear of the drive.
    w.block('榫入主座的胡桃木托臂',(-3,-25.7,2.07),(22.5,42.0,3.64),'oiled-walnut',.85,'stand')
    w.block('分度器前托',(-3,-39.6,3.33),(33.3,11.3,3.36),'oiled-walnut',.85,'stand')
    w.block('沉头铸铜台肩',(-3,-40.2,5.10),(32.5,9.9,.84),'oiled-walnut',.31,'stand')
    for x in [-17.3,10.5]:
        for y in [-43.4,-36.9]:
            w.screw(x,y,5.55,.67,'stand')
    for x in [-16,9.7]:
        w.turning('前托小调平足',(x,-41.9),[(0,1.65),(.3,1.82),(.70,1.68),(1.04,1.23),(1.92,1.14)],'aged-casting','stand',40)
    sx,h,front=SPEC['selector']['center']
    # Bolted saddle supports the chapter ring clear of the timber.
    w.block('双榫分度器鞍座',(sx,-39.35,7.29),(10.1,4.5,4.14),'aged-casting',.69,'stand')
    # Fixed chapter ring with nine physical detents and a sprung pointer.
    front_disc('带肩分度器机座',(sx,-front+4.1,h),10.0,3.7,'aged-casting')
    front_disc('氧化凹槽',(sx,-front+2.17,h),9.73,.44,'recessed-copper')
    front_disc('象牙色刻度盘',(sx,-front+1.87,h),9.40,.47,'porcelain','dialFace')
    front_disc('抛亮盘口',(sx,-front+1.65,h),10.02,.54,'rubbed-lip','dialFace',9.40)
    for k in range(9):
        a=radians(SPEC['selector']['startDegrees']+k*SPEC['selector']['stepDegrees'])
        for shift in [-.17,0,.17]:
            b=a+shift
            inside=7.98 if shift else 7.63
            w.shaft('分度刻痕',(sx+inside*cos(b),-front+1.45,h+inside*sin(b)),
                    (sx+8.94*cos(b),-front+1.45,h+8.94*sin(b)),.075 if shift else .13,'dial-ink','dialFace',8)
        char=lettering(str(k),sx+6.20*cos(a),-front+1.40,h+6.20*sin(a),0,3.12,'dial-ink','dialFace')
        char.rotation_euler.x=pi/2
        char.data.extrude=.038
        char.data.font=station_font
    front_disc('钢制棘轮轴套',(sx,-front+1.31,h),2.26,1.08,'recessed-copper','dialFace')
    # Build in +X, rotate the intact group from station zero at assembly.
    key='dialPointer'
    coords=[(-2.68,-.57),(-.45,-1.20),(1.60,-1.06),(7.66,-.25),
            (8.26,0),(7.65,.25),(1.60,1.06),(-.45,1.2),(-2.68,.57)]
    pointer=prism('蓝钢指针',coords,-.22,.22,'pointer-blue',key,.12)
    pointer.location=(sx,-front+.82,h)
    pointer.rotation_euler.x=pi/2
    w.shaft('黄铜脊线',(sx+.9,-front+.58,h),(sx+7.36,-front+.58,h),.105,'rubbed-lip',key,12)
    # Thumb nut, its dark root and regularly cut knurls can be inspected close up.
    front_disc('盘钮领口',(sx,-front+.47,h),2.38,.65,'rubbed-lip',key)
    front_disc('盘钮滚花圈',(sx,-front-.05,h),1.94,.92,'aged-casting',key)
    for i in range(28):
        a=i*tau/28
        w.shaft('滚花斜槽',(sx+1.94*cos(a),-front+.32,h+1.94*sin(a)),
                (sx+1.94*cos(a+.08),-front-.41,h+1.94*sin(a+.08)),.09,'rubbed-lip',key,8)
    front_disc('胡桃木钮芯',(sx,-front-.60,h),1.48,.40,'oiled-walnut',key)
    x,z,f=SPEC['lever']['center']
    front_disc('剖视扳杆轴座',(x,-f+2.23,z),2.84,2.8,'aged-casting')
    arc=[(x+6.7*cos(radians(54+72*i/24)),-f+2.20,z+6.7*sin(radians(54+72*i/24))) for i in range(25)]
    w.curve('扳杆限位弧',arc,.30,'rubbed-lip','stand')
    for a in [54,126]:
        dx,dz=6.7*cos(radians(a)),6.7*sin(radians(a))
        w.shaft('扳杆止挡销',(x+dx,-f+5.60,z+dz),(x+dx,-f+2.12,z+dz),.59,'recessed-copper','stand',24)
    w.block('弧轨背部铸耳',(x,-f+5.0,z+4.5),(9.5,1.9,5.2),'aged-casting',.71,'stand')
    w.shaft('扳杆蓝钢柄身',(x,-f,z),(x+6.7,-f,z),.56,'pointer-blue','leverArm',24,tip=.35)
    front_disc('扳杆轴帽',(x,-f,z),1.42,1.02,'rubbed-lip','leverArm')
    grip=globe('红褐虫胶木柄',(x+6.7,-f,z),1.44,'oxblood','leverArm')
    grip.scale=(1.15,.91,.91)
    return [(sx,-front,h),(x,-f,z)]


def globe(name,loc,r,finish,group,pigments=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=32,radius=r,location=loc)
    obj=w.register(bpy.context.object,name,finish,group)
    for poly in obj.data.polygons:
        poly.use_smooth=True
    if pigments:
        w.paint(obj,[pigments(v.co.normalized()) for v in obj.data.vertices])
    return obj


def land_at(lon,lat):
    for xmin,xmax,ymin,ymax,ring in land:
        if xmin<=lon<=xmax and ymin<=lat<=ymax:
            inside=False
            for (x1,y1),(x2,y2) in zip(ring,ring[1:]+ring[:1]):
                if (y1>lat)!=(y2>lat) and lon<(x2-x1)*(lat-y1)/(y2-y1)+x1:
                    inside=not inside
            if inside:
                return True
    return False


def globes_and_train():
    w.turning('中心轴座',(0,0),[(4.58,4.85),(4.86,5.25),(5.53,5.1),(6.1,3.65),
              (7.12,2.78),(13.08,2.35),(14.18,3.18),(14.55,3.18),(14.81,2.25)],'patinated-brass')
    w.shaft('固定太阳针轴',(0,0,6),(0,0,SUN_HEIGHT),.43,'steel','sun')
    globe('鎏金太阳',(0,0,SUN_HEIGHT),4.8,'gold-leaf','sun')
    annulus('日轮合缝',0,0,SUN_HEIGHT,4.84,4.74,.20,'gold','sun')
    w.turning('太阳杯口',(0,0),[(35.15,.82),(36.6,1.12),(37.05,1.43),(37.55,1.51),(37.80,1.38)],'gold','sun')
    for i,(radius,size,(teeth,pinion)) in enumerate(zip(RADII,SIZES,COUNTS)):
        z=15.25+1.30*i
        arm_h=33.87-.95*i
        sleeve=.58+.145*i
        group='arm'+str(i)
        pitch=SPAN*teeth/(teeth+pinion)
        gear('主动轮 '+str(teeth),SPAN,0,z,teeth,pitch,'patinated-brass','input'+str(i),pi)
        gear('从动轮 '+str(pinion),0,0,z,pinion,SPAN-pitch,'burnished-brass','pinion'+str(i),pi/pinion)
        # The open concentric sleeves clear one another all the way to the arm.
        annulus('同心套轴 '+NAMES[i],0,0,(arm_h+z)/2,sleeve,sleeve-.09,arm_h-z,'steel','pinion'+str(i),48)
        w.turning('支臂轴肩',(0,0),[(arm_h-.40,sleeve+.24),(arm_h-.27,sleeve+.37),
                  (arm_h+.24,sleeve+.37),(arm_h+.37,sleeve+.19)],'gold',group,40)
        shape=[(0,-.49),(radius*.19,-.65),(radius*.68,-.34),(radius-.43,-.40),
               (radius+.33,-.28),(radius+.47,0),(radius+.33,.28),(radius-.43,.40),
               (radius*.68,.34),(radius*.19,.65),(0,.48)]
        prism('锥形行星托臂',shape,arm_h-.25,arm_h+.25,'gold' if i%2==0 else 'bronze',group,.11)
        w.turning('球座与竖杆',(radius,0),[(arm_h-.35,.50),(arm_h+.25,.57),(arm_h+.61,.36),
                  (arm_h+1.08,.22),(SUN_HEIGHT-size-.84,.22),(SUN_HEIGHT-size-.66,.48),
                  (SUN_HEIGHT-size-.35,.62),(SUN_HEIGHT-size+.14,.38)],'gold',group,28)
        def pigment(v):
            lon,lat=atan2(v.y,v.x),atan2(v.z,sqrt(v.x*v.x+v.y*v.y))
            wave=sin(lon*4+lat*6)*.09+sin(lon*11-lat*8)*.035
            if i==2:
                col='e2e1c9' if abs(lat)>1.30 else '96a06b' if land_at(lon*180/pi,lat*180/pi) else '31667d'
            elif i in (4,5):
                u=sin(lat*(19 if i==4 else 15)+wave*2)+.28*sin(lat*43+.31*sin(lon*4))
                cols=('a16b4b','ce9e72','e1c79e','efe0bf') if i==4 else ('b59865','dbbd89','e6d3a8','ede1bf')
                col=cols[0 if u<-.78 else 1 if u<-.12 else 2 if u<.62 else 3]
            else:
                col=['9d9682','d4aa73','','bc704c','','','82bab4','4f7fa7'][i]
            return tuple(min(1,x*(1+wave)) for x in linear_rgb(col))
        globe(NAMES[i]+'彩绘球',(radius,0,SUN_HEIGHT),size,'lacquer-globe','globe'+str(i),pigment)
        if i==5:
            for r0,r1,col in [(1.22,1.50,'porcelain'),(1.55,1.72,'gold'),(1.76,1.94,'porcelain')]:
                band=annulus('土星环',0,0,0,size*r1,size*r0,.19,col,'globe5',96)
                band.location=(radius,0,SUN_HEIGHT)
                band.rotation_euler.x=radians(22)


font=Path('C:/Windows/Fonts/georgia.ttf')
engraver=bpy.data.fonts.load(str(font)) if font.is_file() else bpy.data.fonts.get('Bfont Regular')
station_font=bpy.data.fonts.load('C:/Windows/Fonts/georgiab.ttf') if Path('C:/Windows/Fonts/georgiab.ttf').is_file() else engraver
polygons=json.loads((ROOT/'src/assets/solar-instrument/coastlines.json').read_text(encoding='utf8'))
land=[(min(x for x,y in p),max(x for x,y in p),min(y for x,y in p),max(y for x,y in p),p) for p in polygons]
cabinet()
crank()
globes_and_train()
control_centers=controls()
# Export the zero pose. The browser and native timeline use identical gear counts and pivots.
settings=dict(radii=RADII,sizes=SIZES,teeth=COUNTS,shaftSpacing=SPAN,globeHeight=SUN_HEIGHT,
              crank=[SPAN,10,25],gripRadius=5.2,armHeights=[33.87-.95*i for i in range(8)])
w.export('solar',settings)
for name,center,a in zip(['dialPointer','leverArm'],control_centers,[90,126]):
    group=w.join_movement(name,center,'选星指针' if name=='dialPointer' else '剖视扳杆')
    group.rotation_euler.y=-radians(a)
pivots=[(w.join_movement('driver',(SPAN,0,0),'八层共轴主动轮'),'z',-1,0)]
for group in ['wheel','grip']:
    pivots.append((w.join_movement(group,(SPAN,-25,10),'横轴 '+group),'y',-1,pi/2))
for i in range(8):
    pivots.append((w.join_movement('input'+str(i),(SPAN,0,0),'主动轮 '+str(i)),'z',-1,0))
    for group in ['pinion','arm','globe']:
        pivots.append((w.join_movement(group+str(i),(0,0,0),NAMES[i]+' '+group),'z',COUNTS[i][0]/COUNTS[i][1],-i*SPEC['initialAngleStep'] if group!='pinion' else 0))
for obj,axis,turns,offset in pivots:
    # The front crank drives the vertical shaft through the mating bevels.
    for frame,t in [(1,0),(241,1)]:
        angle=turns*t*tau+offset
        setattr(obj.rotation_euler,axis,angle)
        obj.keyframe_insert(data_path='rotation_euler',frame=frame)
    keys_linear(obj)
w.scene.frame_end=241
w.scene.render.fps=24
w.scene.frame_set(96)
for font_asset in {engraver,station_font}:
    if font_asset and font_asset.filepath:
        font_asset.pack()
w.photograph('solar','手摇八行星仪',(0,0,24),(44,-134,72),123,-.06,
             detail=((9,-1,22),(32,-122,29),69))





