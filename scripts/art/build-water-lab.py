"""Mechanical teaching specimens authored in Blender; the book supplies their states."""
import json
from math import cos, hypot, pi, sin, tau
from pathlib import Path
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldbook_workshop import ROOT, Workshop, linear_rgb

from water_workshop import (
    FINISH, dish, front_turn, front_web, keys_linear, leveled_bed, machined_section,
    marker, porcelain_type, reading_plate, sphere,
)


def lab_balance(data):
    specs = data['dimensions']
    x,z,y = specs['pivot']
    w = Workshop('海水等体积比较天平',FINISH)
    leveled_bed(w,(50,19),(92,34),4.64)
    w.block('立柱四孔座',(x,y,5.2),(19,13,1.27),'black-green',.46)
    for dx in [-6.5,6.5]:
        for dy in [-4.5,4.5]:
            w.screw(x+dx,y+dy,5.84,.94)
    w.turning('黄铜柱脚',(x,y),[(5.8,5.40),(6.07,5.71),(7.2,5.71),(7.55,4.76),
              (8.11,3.75),(9.84,3.16),(10.43,3.46),(11.06,3.46)],'patinated-brass')
    w.turning('内收立柱',(x,y),[(9.80,3.32),(10.65,3.08),(14.8,2.86),(23.8,2.57),
              (39.4,2.32),(44.9,2.49),(47.95,3.17),(48.98,3.46)],'black-green')
    for height,radius in [(10.72,3.49),(46.65,2.86),(48.68,3.62)]:
        w.turning('黄铜柱冠压肩',(x,y),[(height-.28,radius-.16),(height-.14,radius),
                  (height+.18,radius),(height+.34,radius-.19)],'burnished-brass')
    for depth in [y-2.6,y+2.6]:
        w.block('轴承叉形铸耳',(x,depth,49.48),(8.6,2.38,6.84),'black-green',.52)
        front_turn(w,'带孔黄铜轴承',x,depth,z,[(-1.36,2.39),(-1.18,2.94),(-.66,3.16),
                  (.65,3.16),(1.16,2.85),(1.36,2.29),(1.36,.90),(-1.36,.90)],
                  'burnished-brass','bearing',48,True)
    w.shaft('横梁的贯通钢轴',(x,y-5.9,z),(x,y+8.44,z),.88,'steel','bearing',36)
    front_turn(w,'轴端压帽',x,y+7.81,z,[(0,1.38),(.42,1.72),(.89,1.73),(1.19,1.4)],'patinated-brass','bearing')

    # Each half of the working beam is a curved open-web casting. A single
    # center hub and two cross pins join the halves and carry the suspended pans.
    outside = [(1.5,-3.45),(8,-2.24),(16.8,-1.62),(24.9,-1.64),(30.2,-2.50),
               (33.2,-1.61),(33.55,.65),(31.52,2.29),(27.84,2.26),
               (23.91,2.85),(15.4,3.32),(7.73,4.38),(1.5,5.04)]
    opening = [(4.3,-1.47),(8.3,-.94),(16.9,-.37),(24.6,-.55),(28.0,-.63),
               (29.2,-.35),(29.35,.22),(27.45,.81),(25.98,.88),
               (23.8,1.22),(15.61,1.72),(8.45,2.56),(4.3,2.74)]
    for side in [-1,1]:
        def on_arm(coords):
            path=[(x+side*u,z+v) for u,v in coords]
            return path if side==1 else list(reversed(path))
        front_web(w,'一体镂空弧形承重臂',on_arm(outside),on_arm(opening),y,2.27,'patinated-brass','beam',.26)
        xx=x+side*specs['arm']
        front_turn(w,'吊杯销眼',xx,y,z,[(-1.8,1.40),(-1.50,1.86),(1.50,1.86),
                  (1.8,1.40),(1.80,.76),(-1.8,.76)],'burnished-brass','beam',40,True)
        w.shaft('吊杯横销',(xx,y-2.21,z),(xx,y+2.26,z),.73,'steel','beam',28)
    front_turn(w,'承重梁毂',x,y,z,[(-1.46,2.61),(-1.32,3.34),(1.32,3.34),
              (1.46,2.63),(1.46,.91),(-1.46,.91)],'burnished-brass','beam',64,True)

    scale_y=y+6.51
    w.block('零位尺背桥',(x,y+4.21,36.0),(4.1,5.7,3.7),'black-green',.43)
    for name,lo,hi,depth,material in [('黄铜分度弧架',14.4,20.5,scale_y,'patinated-brass'),
                                     ('瓷质零位弧面',15.17,19.87,scale_y+.54,'ivory')]:
        ring=[(x+hi*cos(a),z+hi*sin(a)) for a in [1.5*pi-.50+i*.024 for i in range(43)]]
        ring += [(x+lo*cos(a),z+lo*sin(a)) for a in [1.5*pi-.50+i*.024 for i in range(42,-1,-1)]]
        extent=len(ring)
        verts=[(xx,depth+d,zz) for d in [-.28,.28] for xx,zz in ring]
        faces = [tuple(range(extent)),tuple(reversed(range(extent,2*extent)))]
        faces += [(i,i+extent,(i+1)%extent+extent,(i+1)%extent) for i in range(extent)]
        w.mesh(name,verts,faces,material,'scale' if material=='ivory' else 'frame')
    for i in range(-9,10):
        a=1.5*pi+i*.047
        length=2.71 if i==0 else (1.94 if i%3==0 else .98)
        w.shaft('无量纲比较刻线',(x+(19.37-length)*cos(a),scale_y+.83,z+(19.37-length)*sin(a)),
                (x+19.37*cos(a),scale_y+.83,z+19.37*sin(a)),.137 if i==0 else .066,
                'scale-ink',segments=8)
    front_turn(w,'指针前轴帽',x,scale_y+2.83,z,[(-.31,1.56),(.05,1.67),(.52,1.39)],'burnished-brass','pointer',40)
    w.shaft('连接梁毂的指针杆',(x,y+1.2,z),(x,scale_y+2.82,z),.63,'steel','pointer',18)
    w.shaft('钢质下垂指针',(x,scale_y+2.77,z+.42),(x,scale_y+2.77,z-18.8),.77,
            'scale-ink','pointer',20,tip=.13)

    initial=data['states'][0]
    for i,hanger in enumerate(initial['suspensions']):
        px,pz,py=hanger['pan']
        group=f'pan-{i}'
        for a in [pi/2,7*pi/6,11*pi/6]:
            sx,sy = px+8.5*cos(a),py+8.5*sin(a)
            # Straight diagonal rods would cross the cups. The yoked drop
            # legs remain outside the porcelain until above both cut rims.
            w.curve('绕开瓷盏的三点吊架',[(sx,sy,pz+1.54),(sx,sy,pz+16.6),
                    (px+7.91*cos(a),py+7.91*sin(a),pz+18.96),
                    (px+.52*cos(a),py+.52*sin(a),pz+specs['suspension']-.61),
                    (px,py,pz+specs['suspension'])],.24,'steel',group)
            w.turning('悬索压头',(sx,sy),[(pz+.7,.61),(pz+.84,.73),(pz+1.36,.73),
                      (pz+1.79,.46),(pz+2.12,.32)],'burnished-brass',group,20)
        dish(w,'深拉铜秤盘',px,py,pz,specs['panRadius'],'patinated-brass',group)
        outer,inner=specs['cupOuterRadius'],specs['cupInnerRadius']
        bottom,top=pz+.96,pz+1+specs['cupHeight']
        section=(pi/2+.86,tau-1.72)
        machined_section(w,'剖开瓷盏',(px,py),[(bottom,outer-.72),(bottom+.46,outer-.37),
             (bottom+1.58,outer-.13),(top-.72,outer),(top-.19,outer-.15),(top,inner+.28),
             (top-.37,inner),(bottom+1.10,inner-.01),(bottom+.96,outer*.53),(bottom,outer*.53)],
             *section,'ivory',f'cup-{i}',72)
        for zz,radius in [(bottom+.88,outer-.20),(top-.32,outer-.02)]:
            w.curve('沿真实剖口止住的黄铜收边',[(px+radius*cos(section[0]+section[1]*k/64),
                py+radius*sin(section[0]+section[1]*k/64),zz) for k in range(65)],.18,'burnished-brass',group)
        h=pz+2.05
        r=specs['waterRadius']
        w.turning('同体积海水',(px,py),[(h,r),(h+specs['waterHeight']-.18,r),
                  (h+specs['waterHeight'],r-.076)],'sea',f'water-{i}',64)
        w.turning('固定位标定线',(px,py),[(h+specs['waterHeight']-.11,r-.035),
                  (h+specs['waterHeight']+.035,r+.036),(h+specs['waterHeight']+.068,r-.16)],
                  'steel',group,64,True)
        w.block('嵌铜质量示意牌',(px,py+9.52,pz+2.27),(9.81,.84,4.7),'patinated-brass',.28,group)
        w.block('质量牌象牙瓷面',(px,py+9.98,pz+2.27),(8.68,.22,3.72),'ivory',.09,group)
        for j in range(13):
            w.shaft('定性质量计数', (px-3.42+j%5*1.72,py+10.08,pz+3.35-j//5*1.09),
                (px-3.42+j%5*1.72,py+10.28,pz+3.35-j//5*1.09),
                .26,'dark-bronze',f'token-{i}-{j}',14)
    plaques={}
    for i in range(3):
        xx=31+19*i
        w.block('读数斜座的底脚',(xx,31.25,5.13),(15.2,9.18,1.1),'black-green',.41)
        w.block('读数斜座的背榫',(xx,29.75,7.76),(13.85,2.76,4.81),'dark-bronze',.35)
        plaques[f'choice-{i}']=reading_plate(w,'压选条件',xx,32.04,7.42,14.55,7.80,49)
        marker(w,xx,35.98,5.21,f'choice-{i}')
    w.export('density',{'plaques':plaques},positive_depth=True)
    porcelain_type(w,[(text,plaques[f'choice-{i}'],4.92) for i,text in enumerate(['对照','降温','增盐'])])

    beam=w.join_movement('beam',(x,y,z),'衡梁和指针')
    for obj,_,group in w.parts:
        if group=='pointer':
            world=obj.matrix_world.copy()
            obj.parent=beam
            obj.matrix_world=world
    pans=[]
    for i,hanger in enumerate(initial['suspensions']):
        px,pz,py=hanger['pan']
        pan=w.join_movement(f'pan-{i}',(px,py,pz),f'保持铅直的吊杯 {i+1}')
        for obj,_,group in w.parts:
            if group in {f'cup-{i}',f'water-{i}'} or group.startswith(f'token-{i}-'):
                world=obj.matrix_world.copy()
                obj.parent=pan
                obj.matrix_world=world
        pans.append(pan)
    right=next(obj for obj,_,group in w.parts if group=='water-1')
    material=right.data.materials[0].copy()
    right.data.materials[0]=material
    liquid_color=material.node_tree.nodes.get('Principled BSDF').inputs['Base Color']
    for frame,state in enumerate(data['states'],1):
        beam.rotation_euler.y=-state['angle']
        beam.keyframe_insert(data_path='rotation_euler',frame=frame)
        liquid_color.default_value=(*linear_rgb(FINISH['cold-sea' if state['mode']==1 else 'sea'][1]),1)
        liquid_color.keyframe_insert(data_path='default_value',frame=frame)
        for i,pan in enumerate(pans):
            px,pz,py=state['suspensions'][i]['pan']
            pan.location=(px,py,pz)
            pan.keyframe_insert(data_path='location',frame=frame)
        for obj,_,group in w.parts:
            if group.startswith('token-'):
                i,j=map(int,group.split('-')[1:])
                for attribute in ['hide_viewport','hide_render']:
                    setattr(obj,attribute,j>=state['massTokens'][i])
                    obj.keyframe_insert(data_path=attribute,frame=frame)
    w.scene.frame_end=3
    for i,name in enumerate(['相同条件','只降低温度','只增加盐度'],1):
        w.scene.timeline_markers.new(name,frame=i)
    w.scene.frame_set(2)
    w.photograph('density','海水等体积比较天平',(50,19,29),(24,142,70),112,-.10,
                 detail=((49,21,41),(17,140,45),81))


def wall_run(w, name, path, section, finish, group='frame'):
    """Sweep a continuous section along the inside edge of the vessel."""
    vertices=[]
    for i,(x,y) in enumerate(path):
        tx,ty=map(lambda pair: pair[1]-pair[0],zip(path[max(0,i-1)],path[min(i+1,len(path)-1)]))
        length=hypot(tx,ty)
        vertices.extend((x+offset*ty/length,y-offset*tx/length,z) for offset,z in section)
    rows=len(section)
    panels=[(i*rows+j,(i+1)*rows+j,(i+1)*rows+(j+1)%rows,i*rows+(j+1)%rows)
            for i in range(len(path)-1) for j in range(rows)]
    panels.extend([tuple(range(rows)),tuple(reversed(range(len(vertices)-rows,len(vertices))))])
    obj=w.mesh(name,vertices,panels,finish,group)
    bevel=obj.modifiers.new('搪瓷圆口','BEVEL')
    bevel.width,bevel.segments=.12,2
    obj.modifiers.new('加权面法线','WEIGHTED_NORMAL')
    return obj


def salinity_scale(w):
    w.block('潮位标尺支架',(89.75,58.82,14.84),(4.97,2.14,25.53),'patinated-brass',.42)
    w.block('象牙瓷水位标尺',(89.75,60.02,14.76),(3.62,.43,24.09),'ivory',.16)
    for i in range(23):
        z=4.2+i*.963
        end=90.98 if i%5==0 or i==13 else 90.12
        w.shaft('初始水位与分线',(88.48,60.26,z),(end,60.26,z),.10 if i==13 else .057,'scale-ink',segments=8)
    for z in [4.3,24.95]:
        w.block('水位尺法兰座',(88.28,59.1,z),(4.33,3.73,1.05),'dark-bronze',.34)
    w.turning('糙边封闭浮子',(83.1,53.4),[(-.60,1.72),(-.45,2.10),(.22,2.10),
              (.49,1.74),(.55,1.56)],'burnished-brass','float',48)
    w.turning('浮子瓷顶',(83.1,53.4),[(.47,1.22),(.61,1.30),(.69,1.12)],'ivory','float',40)
    w.curve('连至水位指针的弯臂',[(83.1,53.4,.51),(83.10,56.22,.80),(83.67,58.59,.82),
            (85.04,59.94,.80),(87.29,60.48,.62),(89.15,60.55,.47)],.26,'patinated-brass','float')
    w.shaft('水位指针',(87.8,60.59,.36),(90.32,60.59,.12),.34,'blue-enamel','float',20,tip=.09)

    # The front-right drive owns the time control. Its two guides and
    # bushings are independent from the float's observed water level.
    w.block('角部滑轨脚',(94.78,58.81,2.20),(7.52,7.20,2.56),'black-green',.48)
    w.block('把导轨座连到槽体的跨榫',(91.67,57.68,2.79),(11.85,4.36,1.37),'patinated-brass',.38)
    w.screw(87.64,57.52,3.49,.76)
    w.block('水滴滑台铸铁背脊',(96,58.48,27.1),(6.30,1.98,49.37),'black-green',.91)
    for z in [5.37,28.9,51.93]:
        w.block('导轨端座及接梁',(94.72,59.43,z),(7.1,3.62,1.52),'patinated-brass',.43)
        w.screw(96,60.23,z+.77,.57)
    for x in [94.46,97.54]:
        w.shaft('水滴滑台的钢质导杆',(x,60.47,4.36),(x,60.47,52.66),.24,'steel',segments=20)
        w.shaft('滑台铜质导套',(x,60.47,49.8),(x,60.47,52.2),.50,'burnished-brass','cursor',20)
    w.block('水滴读数的黄铜滑架',(96,60.53,51),(4.58,1.18,2.6),'patinated-brass',.33,'cursor')
    front_turn(w,'瓷面水滴按钮',96,61,51,[(0,1.29),(.23,1.47),(.52,1.37),
              (.63,1.14)],'blue-enamel','cursor',48)


def salinity_sources(w):
    sun='source-0'
    w.block('辐射符号燕尾座',(26.7,17.96,28.2),(7.92,5.32,1.48),'patinated-brass',.44,sun)
    w.screw(24.02,17.6,28.75,.85,sun)
    w.turning('辐射符号车削柱',(26.9,17.9),[(28.53,1.25),(28.86,1.69),(30.07,1.69),(31.14,1.08),
              (34.6,.88),(48.58,.76),(50.34,1.03),(51.29,1.03)],'patinated-brass',sun,40)
    w.curve('辐射符号悬臂',[(26.9,17.9,50.7),(26.9,20.9,52.2),
            (28.66,26.7,53.2),(32.17,29.28,53.2)],.58,'patinated-brass',sun)
    front_turn(w,'日照黄铜太阳盘',34,30,53,[(-.95,3.41),(-.56,4.45),(.22,4.71),
              (.62,4.38),(.79,3.9)],'burnished-brass',sun)
    front_turn(w,'太阳盘内珐琅',34,30,53,[(.60,3.35),(.86,3.38),(.98,3.0)],'ivory',sun)
    for i in range(12):
        a=tau*i/12
        w.shaft('日照短长分辉',(34+cos(a)*4.53,30,53+sin(a)*4.53),
                (34+cos(a)*(5.70 if i%3==0 else 5.29),30,53+sin(a)*(5.70 if i%3==0 else 5.29)),
                .239,'patinated-brass',sun,12,tip=.13)

    rain='source-1'
    for x in [34,72]:
        w.block('雨栅后座',(x,17.82,28.02),(6.36,5.83,1.57),'patinated-brass',.35,rain)
        for yy in [16.0,19.54]:
            w.screw(x,yy,28.83,.70,rain)
        w.turning('雨栅车削立柱',(x,17.92),[(28.28,1.38),(28.63,1.65),(30.0,1.36),
                  (31.3,.69),(49.8,.66),(50.6,1.08),(51.28,1.08)],'patinated-brass',rain,36)
        w.curve('带弯肩的雨栅悬臂',[(x,17.92,50.8),(x,23,51.3),(x,30,51.03),
                (x,36.5,50.75),(x,46.8,50.75)],.56,'patinated-brass',rain)
    for depth in [34,40,46]:
        w.shaft('带靠背的雨滴分配管',(33.2,depth,50.74),(72.7,depth,50.74),.51,'steel',rain,16)
        for x in [35,42,49,56,63,70]:
            w.turning('有通孔的黄铜滴口',(x,depth),[(49.02,.22),(49.02,.48),(49.18,.61),
                      (49.64,.62),(49.79,.41),(50.66,.41),(50.66,.21)],'burnished-brass',rain,22,True)
        for x in [33.77,72.08]:
            w.shaft('分配管端帽',(x-.56,depth,50.74),(x+.56,depth,50.74),.79,'patinated-brass',rain,16)

    river='source-2'
    path=[(5,18,34),(8,25,30.5),(12,32,27.3),(18,38,24.2),(20.15,38.72,23.63)]
    runnel=[(-2.51,.83),(-2.44,-.31),(-1.92,-.77),(1.65,-.77),(2.43,-.33),
            (2.51,.83),(1.92,.84),(1.74,.15),(1.41,-.11),(-1.42,-.11),(-1.78,.16),(-1.94,.84)]
    vertices=[]
    ribs=[]
    for i,(x,y,z) in enumerate(path):
        a,b=path[max(0,i-1)],path[min(i+1,len(path)-1)]
        dx,dy=b[0]-a[0],b[1]-a[1]
        length=hypot(dx,dy)
        ribs.append((x,y,z,dy/length,-dx/length))
        vertices.extend((x+d*dy/length,y-d*dx/length,z+h) for d,h in runnel)
    rows=len(runnel)
    quads=[(i*rows+j,(i+1)*rows+j,(i+1)*rows+(j+1)%rows,i*rows+(j+1)%rows)
           for i in range(len(path)-1) for j in range(rows)]
    quads += [tuple(range(rows)),tuple(reversed(range(len(vertices)-rows,len(vertices))))]
    shell=w.mesh('连续的有厚度导水明渠',vertices,quads,'ivory',river)
    modifier=shell.modifiers.new('托渠圆角','BEVEL')
    modifier.width,modifier.segments=.13,3
    shell.modifiers.new('托渠面法线','WEIGHTED_NORMAL')
    for side in [-1,1]:
        w.curve('明渠两侧压口',[(x+side*2.17*nx,y+side*2.17*ny,z+.86) for x,y,z,nx,ny in ribs],
                .17,'burnished-brass',river)
    w.curve('明渠刻出的水纹',[(x,y,z+.18) for x,y,z in path],.32,'sea',river)
    for x,y,z in [(5,18,33.5),(14.5,34.52,25.17)]:
        w.block('明渠鞍座底托',(x,y,1.21),(8.1,6.5,2.25),'black-green',.60,river)
        for xx in [x-2.68,x+2.68]:
            w.screw(xx,y,2.42,.74,river)
        w.turning('明渠立柱',(x,y),[(2.15,1.51),(2.52,1.68),(3.44,1.41),(4.47,1.04),
                  (z-2,.75),(z-1.2,1.13),(z-.72,1.13)],'patinated-brass',river,36)
        w.block('明渠承重横鞍',(x,y,z-.45),(5.08,2.36,.88),'dark-bronze',.33,river)


def salinity_lab(data):
    w=Workshop('海水盐度观察槽',FINISH)
    # The specimen and the case share the book's exact interior dimensions.
    # The curved edge, flange, and side inlet are cast into the same section.
    leveled_bed(w,(53.5,40.0),(75.25,49.2),2.09,'basin')
    w.block('观察槽搪瓷底面',(53.5,39.4,2.54),(69.06,41.46,.92),'ivory',.39,'basin')
    rear=[(19.63,35.6),(19.63,19.1),(19.75,18.91),(20.02,18.83),
          (86.97,18.83),(87.24,18.93),(87.37,19.18),(87.37,59.68)]
    front=[(19.63,59.66),(19.63,44.4)]
    notch=[(19.63,44.4),(19.63,35.6)]
    for path,top in [(rear,27.45),(front,27.45),(notch,22.61)]:
        wall_run(w,'有内收肩和宽唇的整体槽壁',path,
                 [(-.003,2.98),(1.21,2.98),(2.69,5.41),(2.96,6.3),(2.76,10.66),
                  (2.50,top-3.28),(2.97,top-2.19),(2.94,top-.83),(2.26,top-.11),(.01,top)],
                  'black-green','basin')
        wall_run(w,'槽内连续象牙色搪瓷',path,[(0,3.12),(.17,3.14),(.26,top-.62),
                 (.05,top-.24),(-.055,top-.57),(-.052,3.29)],'ivory','basin')
        w.curve('搭在铸件宽唇的暖铜边',[(x,y,top-.19) for x,y in path],.34,'patinated-brass','basin')
    w.block('可退卸的河流侧闸',(18.21,39.97,24.83),(2.75,8.66,4.39),'black-green',.21,'plug')
    w.shaft('河口上缘闸套',(18.88,35.61,27.43),(18.88,44.37,27.43),.29,'burnished-brass','plug',16)
    for x in [19.32,87.64]:
        w.block('剖窗斜面曲角',(x,59.71,3.80),(3.72,2.6,4.58),'patinated-brass',.41,'basin')
        w.shaft('剖窗端部亮线',(x,59.75,4.95),(x,59.75,27.22),.31,'burnished-brass','basin',20)
        w.screw(x,60.05,6.11,.69,'basin')
    w.block('槽前剖沿',(53.52,59.77,2.90),(69.76,1.28,1.65),'patinated-brass',.36,'basin')
    for i in range(18):
        x=21+i*3.7
        w.shaft('未转移前的固定基准',(x,59.69,17),(x+1.61,59.69,17),.066,'ivory','basin',8)
    plaques={}
    for index,x in enumerate([34,71.5]):
        w.block('剖窗下方的读数梁',(x,62.69,2.22),(27.92,8.84,2.63),'black-green',.48,'plaque')
        w.block('剖窗表牌后侧的托榫',(x,62.72,5.58),(25.15,2.62,5.47),'dark-bronze',.34,'plaque')
        plaques['salt' if index==0 else 'result']=reading_plate(w,'温润盐度牌',x,65.30,5.34,
                                                               26.35,7.65,52,'plaque')
    for i in range(3):
        x=37+i*19
        w.block('供水选择共用托梁',(x,20.02,27.51),(16.43,7.33,1.08),'patinated-brass',.37,'plaque')
        w.block('背面扎入铸架的榫',(x,19.56,30.54),(13.54,3.04,6.14),'dark-bronze',.32,'plaque')
        plaques[f'choice-{i}']=reading_plate(w,'入水条件',x,21.44,31.33,14.8,8.02,56,'plaque')
        marker(w,x,24.42,28.13,f'choice-{i}')
    salinity_scale(w)
    salinity_sources(w)
    w.export('salinity',{'plaques':plaques},positive_depth=True)
    labels=porcelain_type(w,[('盐量不变',plaques['salt'],4.58)]+
              [(text,plaques[f'choice-{i}'],5.04) for i,text in enumerate(['蒸发','降水','河流'])]+
              [(f'盐度{text}',plaques['result'],4.58) for text in ['未变','升高','降低']])

    # Native Blender timeline houses one section for each of the same
    # alternative trials. Parts swap only at the three marker positions.
    water = w.block('剖窗里随水量变化的海水',(53.5,39,3.5),(67.6,40,1),'sea',0,None)
    float_pivot=w.join_movement('float',(0,0,0),'浮子与水位指针')
    cursor=w.join_movement('cursor',(96,61,51),'双导柱滑座')
    salt=[sphere(w,'溶解盐示踪点',(0,0,0),.44,'burnished-brass') for _ in range(24)]
    drops=[sphere(w,'独立水量转移',(0,0,0),.58,'sea') for _ in data[0][0]['portions']]
    for mode,states in enumerate(data):
        begin=1+mode*110
        w.scene.timeline_markers.new(['蒸发增强','降水增多','河流注入'][mode],frame=begin)
        for obj,_,group in w.parts:
            if group.startswith('source-') or group=='plug':
                hidden=group!=f'source-{mode}' if group.startswith('source-') else mode==2
                for attribute in ['hide_viewport','hide_render']:
                    setattr(obj,attribute,hidden)
                    obj.keyframe_insert(data_path=attribute,frame=begin)
        for state in states:
            frame=begin+round(state['phase']*100)
            level=state['waterLevel']
            water.scale.z=level
            water.location.z=3+level/2
            water.keyframe_insert(data_path='scale',frame=frame)
            water.keyframe_insert(data_path='location',frame=frame)
            float_pivot.location.z=3+level
            float_pivot.keyframe_insert(data_path='location',frame=frame)
            cursor.location.z=51-45*state['phase']
            cursor.keyframe_insert(data_path='location',frame=frame)
            for name in ['盐度未变','盐度升高','盐度降低']:
                if name in labels:
                    label=labels[name]
                    hidden=name!=f"盐度{state['tendency']}"
                    for attribute in ['hide_viewport','hide_render']:
                        setattr(label,attribute,hidden)
                        label.keyframe_insert(data_path=attribute,frame=frame)
            for j,obj in enumerate(salt):
                obj.location=(26+j%6*10.6,59.25,3.4+level*(.13+j//6*.21))
                obj.keyframe_insert(data_path='location',frame=frame)
            for obj,portion in zip(drops,state['portions']):
                x,z,y=portion['point']
                obj.location=(x,y,z)
                strength=min(1,portion['strength']*3)
                obj.scale=(strength,strength,strength*(1.15 if mode==0 else 1.7))
                obj.keyframe_insert(data_path='location',frame=frame)
                obj.keyframe_insert(data_path='scale',frame=frame)
    for obj in [water,float_pivot,cursor,*salt,*drops]:
        keys_linear(obj)
    w.scene.frame_end=321
    w.scene.frame_set(155)
    w.photograph('salinity','海水盐度观察槽',(53,37,24),(-30,148,78),119,-2.65,
                 detail=((82,58,21),(-28,135,51),64))


def sculpt_ice(w, name, x, y, base, width, depth, height, index, group):
    # Facets share a fractured perimeter. Fine variations in pigment follow
    # the lamination across the entire specimen instead of separate cubes.
    vertices=[]
    layers=7
    sides=18
    for row in range(layers):
        t=row/(layers-1)
        for i in range(sides):
            a=tau*i/sides
            edge=1+.055*sin(9*a+index*.68)+.083*cos(5*a-index*.33)
            distort=(sin(a)**3 + .44*sin(a*2+index*.8))*.51
            section=.92+.09*sin(t*pi)-.16*t*t
            xx=x+width/2*cos(a)*edge*section+.71*t*sin(a+index)
            yy=y+depth/2*sin(a)*edge*section+.45*t*cos(a*2)
            zz=base+t*(height+height*.17*cos(2*a+.3*index)+distort*(.7+t))
            vertices.append((xx,yy,zz))
    faces=[(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i)
           for i in range(sides) for j in range(layers-1)]
    faces.append(tuple(reversed(range(sides))))
    vertices.append((x+.34,y-.21,base+height*1.092))
    faces.extend([((layers-1)*sides+i,(layers-1)*sides+(i+1)%sides,layers*sides) for i in range(sides)])
    obj=w.mesh(name,vertices,faces,'pale-ice',group)
    dark,light=map(linear_rgb,['7eacb3','d8e3dc'])
    colors=[]
    for xx,yy,zz in vertices:
        band=.50+.34*sin(zz*1.29+yy*.24+xx*.19)
        amount=min(1,.37+.38*band+.22*(zz-base)/height)
        colors.append(tuple(a+(b-a)*amount for a,b in zip(dark,light)))
    w.paint(obj,colors)
    bevel=obj.modifiers.new('微融冰棱','BEVEL')
    bevel.width,bevel.segments=.12,1
    return obj


def perforated_basket(w):
    """Each ellipse is a punched through-hole with an inner wall."""
    vertices=[]
    faces=[]
    radius=15.72
    outer=[(-1,-1),(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0)]
    for row in range(3):
        z=16.0+1.43*(row+.5)
        for i in range(32):
            angle=tau*(i+.5)/32
            offset=len(vertices)
            for r in [radius,radius-.41]:
                for loop in [outer,[(.68*cos(-3*pi/4+k*pi/4),.57*sin(-3*pi/4+k*pi/4)) for k in range(8)]]:
                    for u,v in loop:
                        a=angle+u*pi/32
                        vertices.append((50+r*cos(a),39+r*sin(a),z+v*.715))
            for j in range(8):
                k=(j+1)%8
                faces.extend([tuple(offset+a for a in loop) for loop in [
                    (j,k,k+8,j+8),(j+16,j+24,k+24,k+16),(j+8,k+8,k+24,j+24)]])
                if row==0 and j in [0,1] or row==2 and j in [4,5]:
                    faces.append(tuple(offset+a for a in (j,j+16,k+16,k)))
    w.mesh('整圈真开孔内转篮',vertices,faces,'steel','rotor',True)
    for z in [15.68,20.45]:
        w.turning('转篮轧边',(50,39),[(z-.24,15.21),(z-.29,15.75),(z,16.04),
                  (z+.41,15.80),(z+.33,15.20)],'burnished-brass','rotor',84,True)


def bevel_wheel(w,name,center,axis,profile,teeth,group):
    """Conical tooth bands on shafts meeting at the same pitch apex."""
    cx,cy,cz=center
    vertices=[]
    count=teeth*4
    for offset,radius,cut in profile:
        for i in range(count):
            a=i*tau/count
            r=radius-(cut if i%4 in [0,3] else 0)
            vertices.append((cx+offset,cy+r*cos(a),cz+r*sin(a)) if axis=='x'
                            else (cx+r*cos(a),cy+r*sin(a),cz+offset))
    faces=[(j*count+i,j*count+(i+1)%count,(j+1)*count+(i+1)%count,(j+1)*count+i)
           for j in range(len(profile)-1) for i in range(count)]
    faces += [tuple(reversed(range(count))),tuple(range(len(vertices)-count,len(vertices)))]
    return w.mesh(name,vertices,faces,'patinated-brass',group)


def ice_lab(data):
    w=Workshop('海冰淡化双法观察仪',FINISH)
    leveled_bed(w,(51,44),(81.3,51.7),3.91,'collector-chassis')
    w.block('被托起的盐水汇集槽',(50,44,4.18),(67.6,40.8,.76),'steel',.29,'collector')
    case=[(17.37,62.68),(17.37,26.16),(17.71,25.49),(18.40,25.11),
          (81.47,25.11),(82.20,25.55),(82.63,26.24),(82.63,62.68)]
    wall_run(w,'连续集液槽后沿与侧肩',case,
             [(0,4.02),(.68,4.02),(1.23,4.62),(1.50,7.80),(1.48,8.64),
              (1.04,9.06),(.27,9.04),(.01,8.66)],'steel','collector')
    w.curve('集液槽卷起的黄铜上缘',[(x,y,8.93) for x,y in case],.26,'patinated-brass','collector')
    w.block('前剖窗低沿',(50,63.24,4.64),(67.66,1.99,1.24),'burnished-brass',.36,'collector')
    w.block('收集瓷牌的榫座',(74.1,65.06,4.41),(26.40,5.92,2.02),'black-green',.43,'collector')
    w.block('盐水牌的背榫',(74.1,65.19,6.54),(22.14,2.46,4.51),'dark-bronze',.35,'collector')
    plaque=reading_plate(w,'盐水收集',74.1,67.40,6.30,25.22,7.76,52,'collector')
    brine=w.block('实际盛接盐水',(50,43.85,4.95),(63.6,37.3,.80),'brine',.06,'brine')

    gravity='gravity'
    for x in [26.65,72.45]:
        for y in [27.8,52.4]:
            w.block('排盐架榫足',(x,y,4.86),(5.4,4.66,.92),'black-green',.37,gravity)
            w.turning('三段立柱',(x,y),[(5.2,1.51),(5.61,1.72),(6.6,1.72),(7.40,1.27),
                      (8.99,.76),(17.2,.67),(18.37,1.30),(19.32,1.30)],'patinated-brass',gravity,34)
            w.screw(x,y,20.19,.64,gravity)
    for y in [27.5,53.91]:
        w.block('带实际搁槽的承重横梁',(49.55,y,19.4),(49,2.3,1.99),'patinated-brass',.42,gravity)
        for x in [26.6,72.5]:
            w.screw(x,y,20.39,.78,gravity)
    for x in [27.6+i*3 for i in range(16)]:
        w.shaft('平行排液格栅',(x,28.53,20.02),(x,52.92,20.02),.24,'steel',gravity,12)
    for i in range(4):
        sculpt_ice(w,'有截面和交错裂隙的海冰',37.9+i*8.22,40.16,20.36,
                   9.45+(i%2)*.20,28.8-(i%3)*.63,14.4-(i%3)*1.06,i,f'ice-{i}')

    spin='spin'
    center=(50,39)
    # The lower open band lets collected water leave the rotor casing.
    # Both the stationary safety guard and the moving basket have finite walls.
    start=pi/2+.79
    sweep=tau-1.58
    machined_section(w,'深色离心机铸壳',center,
        [(16.7,18.76),(16.64,19.48),(17.12,20.59),(19.29,21.20),(31.98,20.80),
         (34.30,20.51),(35.39,20.0),(35.46,18.60),(34.61,18.25),(17.10,18.32)],
        start,sweep,'black-green','guard',80)
    for z,radius in [(17.59,20.35),(34.52,20.23)]:
        w.curve('同心黄铜卷边',[(50+radius*cos(start+sweep*i/74),39+radius*sin(start+sweep*i/74),z)
                               for i in range(75)],.42,'burnished-brass',spin)
    for a in [start+.1,start+sweep*.35,start+sweep*.66,start+sweep-.1]:
        x,y=50+20*cos(a),39+20*sin(a)
        w.block('防护筒铸铁脚',(x,y,5),(4.9,4.7,1.14),'black-green',.33,spin)
        w.turning('防护筒承重立柱',(x,y),[(5.5,1.44),(6.05,1.73),(7.26,1.37),
                  (8.72,.98),(15.32,1.04),(16.96,1.51),(17.54,1.51)],'patinated-brass',spin,32)
    w.turning('主轴止推轴承',center,[(4.53,3.42),(5.12,3.84),(6.72,3.84),
              (7.28,2.89),(10.45,2.67),(11.57,2.67)],'dark-bronze',spin,52)
    w.turning('随轴转动的钢轴',center,[(7.82,1.50),(8.13,1.85),(13.4,1.85),
              (15.45,1.68),(24.6,1.30),(29.1,1.08),(31.3,1.08)],'steel','rotor',44)
    w.turning('转篮支承盘',center,[(14.2,4.7),(14.49,5.84),(15.40,15.29),(15.92,15.59),
              (16.3,15.2),(16.3,3.68),(15.87,2.1)],'patinated-brass','rotor',60)
    perforated_basket(w)
    for i in range(4):
        a=i*pi/2
        w.shaft('转篮钢骨',(50+3.1*cos(a),39+3.1*sin(a),16.69),(50+15.33*cos(a),39+15.33*sin(a),17.10),
                .35,'steel','rotor',16)
    # Contact is close to (57.4,39,13.8): both conical pitch lines point
    # back to (50,39,10.45). The rotor and hand crank use a 2:1 ratio.
    apex=(50,39,10.45)
    bevel_wheel(w,'主轴三十二齿锥轮',apex,'z',[(2.75,6.48,.29),(3.02,7.00,.41),
                (3.83,8.6,.49),(4.05,8.52,0)],32,'rotor')
    bevel_wheel(w,'侧轴十六齿锥轮',apex,'x',[(6.16,2.62,.23),(6.49,2.88,.22),
                (8.25,3.81,.36),(8.57,3.83,0)],16,'crank')
    w.block('侧轴黄铜鞍座',(75.82,39,5.28),(10.26,7.96,1.48),'patinated-brass',.41,spin)
    w.block('侧轴承重铸座',(76.62,39,8.18),(8.38,6.12,5.25),'black-green',.62,spin)
    for y in [36.25,41.75]:
        w.screw(79.25,y,6.02,.84,spin)
    for x in [74.48,79.7]:
        lip=w.turning('侧轴轴承压盖',(0,0),[(-.77,2.08),(-.53,2.49),(.54,2.49),
                     (.85,2.10),(.85,.95),(-.77,.95)],'burnished-brass',spin,44,True)
        lip.location=(x,39,10.45)
        lip.rotation_euler.y=pi/2
    w.shaft('横向传动钢轴',(55.82,39,10.45),(82.65,39,10.45),.90,'steel','crank',30)
    w.shaft('曲柄黄铜摇臂',(82.25,39,10.45),(82.25,39,17.01),.67,'patinated-brass','crank',24)
    grip=w.turning('车削胡桃木手柄',(0,0),[(-.50,1.2),(-.22,1.58),(.37,1.58),
                    (1.50,1.26),(3.65,1.10),(4.94,1.22),(5.21,.76)],'dark-timber','crank-handle',40)
    grip.location=(82.52,39,17.01)
    grip.rotation_euler.y=pi/2
    w.shaft('摇柄贯穿销',(82.03,39,17.01),(88.00,39,17.01),.48,'burnished-brass','crank-handle',24)
    for i in range(9):
        width,depth,height = (2.18+i%2*.36,2.25+i%3*.30,9.15+i%3*.49) if i<4 else (
            5.3+i%3*.44,4.4+i%4*.56,4.85+i%3*.92)
        sculpt_ice(w,'托在篮底的破碎海冰',0,0,0,width,depth,height,i,f'fragment-{i}')
    w.export('desalination',{'plaques':{'collector':plaque}},positive_depth=True)
    porcelain_type(w,[('盐水收集',plaque,4.66)])

    rotor=w.join_movement('rotor',(50,39,0),'轴与内转篮')
    crank=w.join_movement('crank',(81,39,10.45),'侧轴和木柄')
    bpy.context.view_layer.update()
    for obj,_,group in w.parts:
        if group=='crank-handle':
            transform=obj.matrix_world.copy()
            obj.parent=crank
            obj.matrix_world=transform
    fragments=[next(obj for obj,_,g in w.parts if g==f'fragment-{i}') for i in range(9)]
    drops=[sphere(w,'盐水口袋示踪',(0,0,0),.68,'brine') for _ in range(16)]
    for mode,states in enumerate(data):
        first=1+mode*110
        w.scene.timeline_markers.new(['重力排盐','破碎离心'][mode],frame=first)
        for obj,_,group in w.parts:
            if group not in {'collector-chassis','collector','brine'}:
                gravity_part=group=='gravity' or group.startswith('ice-')
                for prop in ['hide_render','hide_viewport']:
                    setattr(obj,prop,gravity_part != (mode==0))
                    obj.keyframe_insert(data_path=prop,frame=first)
        for state in states:
            frame=first+round(state['phase']*100)
            angle=state['phase']*4*pi
            brine.scale.z=1+state['progress']*2.5
            brine.location.z=4.55+.40*brine.scale.z
            brine.keyframe_insert(data_path='scale',frame=frame)
            brine.keyframe_insert(data_path='location',frame=frame)
            rotor.rotation_euler.z=angle
            rotor.keyframe_insert(data_path='rotation_euler',frame=frame)
            crank.rotation_euler.x=-2*angle
            crank.keyframe_insert(data_path='rotation_euler',frame=frame)
            for i,obj in enumerate(fragments):
                x,y,a=state['fragmentPoses'][i]
                obj.location=(x,y,16.31)
                obj.rotation_euler.z=pi/2+a
                obj.keyframe_insert(data_path='location',frame=frame)
                obj.keyframe_insert(data_path='rotation_euler',frame=frame)
            for marker,pocket in zip(drops,state['pockets']):
                x,z,y=pocket['point']
                marker.location=(x,y,z)
                marker.keyframe_insert(data_path='location',frame=frame)
    for obj in [rotor,crank,brine,*fragments,*drops]:
        keys_linear(obj)
    w.scene.frame_end=211
    w.scene.frame_set(164)
    w.photograph('desalination','海冰淡化双法观察仪',(51,44,15),(-38,140,89),108,-.83,
                 detail=((57,42,16),(47,148,41),68))
    w.scene.frame_set(48)
    w.scene.render.filepath=str(ROOT/'work/desalination-drain.png')
    bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    samples=json.loads((ROOT/'work/water-lab-states.json').read_text(encoding='utf8'))
    builders={'density':lab_balance,'salinity':salinity_lab,'desalination':ice_lab}
    selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else builders
    for name in selected:
        builders[name](samples[name])
