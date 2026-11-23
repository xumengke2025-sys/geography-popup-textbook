"""Author the watershed, water budget and temperature observations in Blender."""
import json
from math import cos, pi, sin, tau
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldbook_workshop import ROOT, Workshop, linear_rgb
from water_workshop import (
    FINISH, front_turn, front_web, keys_linear, leveled_bed, machined_section, reading_plate,
    porcelain_type, sphere,
)

PALETTE = FINISH | {
    'land-pigment': ('land', 'ffffff', 0, .77),
    'sea-pigment': ('water', 'ffffff', .03, .31),
    'ridge-fir': ('land', '647c5c', 0, .72),
    'meadow-green': ('land', '8d9b67', 0, .78),
    'mist': ('ivory', 'ebe5d5', 0, .64),
    'clear-blue': ('water', '5895a2', .04, .27),
    'weight-blue': ('water', '3d7682', .06, .31),
    'quality-water': ('water', 'a09268', .05, .29),
    'sample-gold': ('brass', 'c7995d', .53, .37),
    'sample-copper': ('brass', 'a76e50', .61, .35),
}


def mix_rgb(first, second, alpha):
    return tuple(a+(b-a)*alpha for a,b in zip(first, second))


def clamp(value):
    return min(1,max(0,value))


def mesh_points(data):
    p=data['positions']
    return [(p[i],p[i+2],p[i+1]) for i in range(0,len(p),3)]


def transfer_mesh(w,name,data,finish,group,color=None):
    verts=mesh_points(data)
    triangles=data['indices']
    faces=[(triangles[i],triangles[i+2],triangles[i+1]) for i in range(0,len(triangles),3)]
    mesh=w.mesh(name,verts,faces,finish,group)
    if color:
        w.paint(mesh,[color(*coord) for coord in verts])
    return mesh


def watershed_solid(w, grid, divisions):
    nx,nz=divisions
    verts=mesh_points(grid)[:(nx+1)*(nz+1)]
    top_count=len(verts)
    stride=nx+1
    faces=[]
    for j in range(nz):
        for i in range(nx):
            k=j*stride+i
            faces.append((k,k+1,k+stride+1,k+stride))
    perimeter=list(range(stride))
    perimeter.extend(j*stride+nx for j in range(1,nz+1))
    perimeter.extend(nz*stride+i for i in range(nx-1,-1,-1))
    perimeter.extend(j*stride for j in range(nz-1,0,-1))
    length=len(perimeter)
    levels=8
    for layer in range(1,levels+1):
        alpha=layer/levels
        for i in perimeter:
            x,y,high=verts[i]
            verts.append((x,y,high*(1-alpha)+.4*alpha))
        previous=perimeter if layer==1 else [top_count+(layer-2)*length+i for i in range(length)]
        current=[top_count+(layer-1)*length+i for i in range(length)]
        for i in range(length):
            j=(i+1)%length
            faces.append((previous[i],current[i],current[j],previous[j]))
    verts.append((31.9,29.0,.4))
    center=len(verts)-1
    faces.extend((center,current[(i+1)%length],current[i]) for i in range(length))
    land=w.mesh('具有沉积切面的集水山脊',verts,faces,'land-pigment','land')
    for face in land.data.polygons:
        face.use_smooth=face.index<nx*nz
    shale,olive,moss,limestone,sand,brown,aquifer=map(linear_rgb,
        ['655449','899763','527449','b6b1a0','c0ac80','947a58','777f6d'])
    colors=[]
    for i,(x,y,z) in enumerate(verts):
        grain=.5+.31*sin(x*.59+y*.23)+.19*cos(y*.91-x*.51)
        if i<top_count:
            rock=clamp((z-21.3)/17)
            shore=clamp((13.2-z)/5.1)
            surface=mix_rgb(moss,olive,.44+.38*grain)
            surface=mix_rgb(surface,limestone,rock*(.77+.23*grain))
            pigment=mix_rgb(surface,sand,shore*.88)
        else:
            band=.5+.42*sin(z*.54+.16*sin(x*.20)+.25*sin(y*.18))
            upper=clamp(z/21)
            pigment=mix_rgb(mix_rgb(shale,brown,band),sand,upper*.52)
            wet=clamp(1-abs(z-(8.74-.018*x))/2.9)
            pigment=mix_rgb(pigment,aquifer,wet*.77)
        colors.append(tuple(v*(.94+.115*grain) for v in pigment))
    w.paint(land,colors)
    return land


def terrain_trees(w, plants):
    for i,plant in enumerate(plants):
        x,z,y=plant['at']
        height=plant['height']
        w.shaft('埋入地面的树干',(x,y,z-.11),(x+.09*height,y,z+.61*height),
                height*.054,'dark-timber','trees',7,tip=height*.024)
        if i!=1 and i%3!=2:
            dims=[(.24,.31,.69),(.43,.25,.83),(.58,.18,.97)]
            for start,radius,top in dims:
                w.shaft('分层针叶冠',(x,y,z+height*start),(x+.09*height,y,z+height*top),
                        radius*height,'ridge-fir','trees',8,tip=.018*height)
        else:
            for dx,dy,q in [(-.15,-.1,.70),(.13,-.09,.74),(.06,.15,.79),(.01,0,.84)]:
                loc=(x+dx*height,y+dy*height,z+q*height)
                bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=height*.24,location=loc)
                obj=w.register(bpy.context.object,'阔叶冠','meadow-green','trees')
                for face in obj.data.polygons:
                    face.use_smooth=True
                obj.scale=(1.16,1.03,.72)


def cloud_sculpture(w,name,parts,group):
    data=bpy.data.metaballs.new(name)
    data.resolution=.54
    data.render_resolution=.48
    data.threshold=.69
    body=bpy.data.objects.new(name,data)
    w.scene.collection.objects.link(body)
    for i,(x,z,y,r) in enumerate(parts):
        for dx,dy,dz,factor in [(0,0,0,1),(-.46,.21,.15,.59),(.25,-.16,.27,.55),(.49,.16,-.12,.43)]:
            element=data.elements.new(type='ELLIPSOID')
            element.co=(x+r*dx,y+r*dy,z+r*dz)
            element.radius=r*factor
            element.size_x,element.size_y,element.size_z=1.04,.76,.59+.041*(i%3)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active=body
    body.select_set(True)
    bpy.ops.object.convert(target='MESH')
    obj=w.register(bpy.context.object,name,'mist',group)
    for face in obj.data.polygons:
        face.use_smooth=True
    return obj


def watershed_mount(w):
    # Two physical saddles bear the cut specimen. Their exposed arms carry
    # the rail outside the foreground fracture instead of covering it.
    for x in [16.2,80.5]:
        w.block('胡桃木托枕',(x,29,-2.16),(12.6,47.2,2.62),'dark-timber',.58)
        w.block('黄铜楔形标本夹',(x,30,-.43),(8.1,44.62,1.68),'patinated-brass',.43)
        w.block('同轴下托',(x,54.8,-5.47),(5.5,14.6,9.45),'black-green',.54)
        w.shaft('伸向读数导梁的斜撑',(x,51.12,-1.35),(x,65.73,-12.13),
                .63,'patinated-brass',segments=24)
        w.screw(x,51.75,.42,.85)
    w.block('胡桃木前缘导梁',(50,66,-13.58),(86.9,6.65,2.04),'dark-timber',.48,'rail')
    w.block('导梁铸铁槽',(50,66,-12.34),(84.0,4.61,.77),'black-green',.32,'rail')
    for y in [64.82,67.18]:
        w.shaft('两条同高精磨导轨',(10,y,-11.78),(90,y,-11.78),.27,'steel','rail',18)
    for x in [10,90]:
        w.block('导轨压盖',(x,66,-11.7),(3.63,3.61,1.54),'patinated-brass',.24,'rail')
        w.screw(x,66,-10.91,.74,'rail')
    w.block('铜制导鞍',(12,66,-11.14),(4.9,3.74,1.21),'patinated-brass',.34,'cursor')
    for y in [64.82,67.18]:
        w.shaft('滚动导套',(10.48,y,-11.78),(13.52,y,-11.78),.51,'burnished-brass','cursor',18)
    w.turning('手持读数滚花钮',(12,66),[(-10.65,1.08),(-10.46,1.58),(-9.72,1.58),
              (-9.51,1.31)],'gold','cursor',42)
    w.turning('游标青绿瓷心',(12,66),[(-9.61,1.25),(-9.55,1.26),(-9.44,1.08)],'blue-enamel','cursor',40)
    for i in range(19):
        x=12+76*i/18
        w.shaft('进度细分刻线',(x,67.64,-11.88),(x,68.08 if i%3==0 else 67.87,-11.88),
                .053,'burnished-brass','rail',8)


def cycle_observation(data):
    w=Workshop('水循环山海切面',PALETTE)
    watershed_solid(w,data['land'],data['divisions'])
    deep,coastal=map(linear_rgb,['346872','a4bb9c'])
    transfer_mesh(w,'海岸与外海共边水面',data['sea'],'sea-pigment','sea',
        lambda x,y,z:mix_rgb(deep,coastal,clamp((z-1)/9)*(.43+.31*clamp((98-x)/30))))
    transfer_mesh(w,'贴合山谷断面的河道',data['river'],'clear-blue','river')
    terrain_trees(w,data['plants'])
    watershed_mount(w)
    cloud_sculpture(w,'陆地凝结云形',data['clouds']['land'],'land-cloud')
    cloud_sculpture(w,'海上凝结云形',data['clouds']['sea'],'sea-cloud')
    w.export('water',positive_depth=True)

    carrier=w.join_movement('cursor',(12,66,-11),'机械进度游标')
    clouds=[w.join_movement('land-cloud',(32,37,50),'陆地云形变化'),
            w.join_movement('sea-cloud',(82,36,50),'海上云形变化')]
    marks=[sphere(w,'保留身份的六组水示踪',(0,0,0),.96,
                 'sample-gold' if i==0 else 'sample-copper' if i==3 else 'clear-blue') for i in range(6)]
    names=['海陆间循环','陆地内循环','海上内循环']
    for mode,states in enumerate(data['states']):
        first=1+mode*110
        w.scene.timeline_markers.new(names[mode],frame=first)
        for state in states:
            frame=first+round(state['phase']*100)
            carrier.location.x=12+76*state['phase']
            carrier.keyframe_insert(data_path='location',frame=frame)
            for obj,region in zip(clouds,['land','sea']):
                presence=state['clouds'][region]
                obj.scale=(.15+.85*presence,)*3 if presence>.001 else (.001,)*3
                obj.keyframe_insert(data_path='scale',frame=frame)
            for marker,sample in zip(marks,state['samples']):
                x,z,y=sample['position']
                marker.location=(x,y,z)
                marker.scale=(.77,.77,1.43) if sample['medium']=='rain' else (1,1,1)
                marker.keyframe_insert(data_path='location',frame=frame)
                marker.keyframe_insert(data_path='scale',frame=frame)
    for obj in [carrier,*clouds,*marks]:
        keys_linear(obj)
    w.scene.frame_end=321
    w.scene.frame_set(51)
    w.photograph('water','水循环山海切面',(49,37,18),(-37,142,86),130,-15,
                 detail=((23,33,21),(-26,137,83),64))


def pipe_with_bore(w,name,points,outer,inner,finish,group,reference=(0,1,0)):
    coords=[Vector(point) for point in points]
    verts=[]
    sides=24
    for i,point in enumerate(coords):
        tangent=(coords[min(i+1,len(coords)-1)]-coords[max(0,i-1)]).normalized()
        # Both pipes lie in a near-vertical plane, giving the bore a fixed
        # side axis even around the descending spout.
        horizontal=tangent.cross(Vector(reference)).normalized()
        side=horizontal.cross(tangent)
        for radius in [outer,inner]:
            for j in range(sides):
                a=tau*j/sides
                verts.append(point+radius*(side*cos(a)+horizontal*sin(a)))
    band=sides*2
    faces=[]
    for i in range(len(coords)-1):
        a,b=i*band,(i+1)*band
        for j in range(sides):
            k=(j+1)%sides
            faces += [(a+j,a+k,b+k,b+j),(a+sides+j,b+sides+j,b+sides+k,a+sides+k)]
    for endpoint in [0,len(coords)-1]:
        offset=endpoint*band
        for j in range(sides):
            k=(j+1)%sides
            cap=(offset+j,offset+sides+j,offset+sides+k,offset+k)
            faces.append(cap if endpoint==0 else tuple(reversed(cap)))
    obj=w.mesh(name,verts,faces,finish,group)
    for face in obj.data.polygons:
        face.use_smooth=face.index<len(faces)-band
    return obj


def elbow(x,y,z,radius,offset=0):
    return [(x+radius*sin(a),y+offset*sin(a),z-radius*(1-cos(a)))
            for a in [i*pi/14 for i in range(8)]]


def flare_cup(w,name,x,y,bottom,top,radius,inner,group,opened=True):
    h=top-bottom
    profile=[(bottom,radius-.72),(bottom+.32,radius-.15),(bottom+.62,radius-.24),
             (bottom+h*.51,radius-.43),(top-.64,radius),(top-.24,radius+.07),
             (top,inner+.21),(top-.38,inner),(bottom+.21,inner-.31)]
    if opened:
        machined_section(w,name,(x,y),profile,pi/2+.86,tau-1.72,'ivory',group)
    else:
        w.turning(name,(x,y),profile,'ivory',group,76,True)


def reservoir_structure(w):
    # The observation window sits between two rolled rims. An underbody
    # saddle bears the weight of the tank and exposes its outlet manifold.
    w.block('胡桃木榫合底座',(50.1,4,.72),(95.3,55.1,1.39),'dark-timber',.49)
    w.block('底座嵌铜亮边',(50.1,4,1.43),(94.0,53.8,.46),'burnished-brass',.17)
    w.block('低位漆面搁床',(50.1,4,1.87),(92.1,52.4,.80),'black-green',.28)
    for y in [-15.0,9.1]:
        w.block('储槽铸铁横承',(49,y,2.75),(30.18,8.52,1.02),'black-green',.41)
        for x in [34.1,63.9]:
            w.screw(x,y,3.34,.93)
            w.turning('储槽锚脚',(x,y),[(3.22,2.55),(3.48,2.89),(4.20,2.79),
                    (4.80,2.04),(5.55,1.62),(11.4,1.34),(11.94,1.92),(12.6,1.86)],
                    'patinated-brass',segments=36)
    w.turning('托住储水筒的环形托肩',(49,-3),[(12.16,16.5),(12.57,18.27),
              (13.23,18.86),(13.71,18.63)],'black-green',segments=80)
    w.turning('实际筒底',(49,-3),[(13.62,18.3),(14.12,18.82),(14.40,17.66)],
              'patinated-brass','tank-floor',92)
    flare_cup(w,'有曲率的开窗搪瓷储水筒',49,-3,14.20,40.55,18.67,17.28,'tank-wall')
    for height,radius,group in [(14.62,18.37,'tank-gasket'),(40.58,18.39,'tank-rim')]:
        w.turning('储槽铜卷边',(49,-3),[(height-.26,radius-.76),(height-.26,radius+.1),
                  (height+.02,radius+.38),(height+.26,radius+.10),(height+.26,radius-.76)],
                  'burnished-brass',group,96,True)
    machined_section(w,'唯一的小观察窗',(49,-3),[(14.5,17.10),(40.39,17.10),
                     (40.39,17.26),(14.5,17.26)],pi/2-.86,1.72,'inspection-glass','pane',44)
    for a in [pi/2-.86,pi/2+.86]:
        x,y=49+17.62*cos(a),-3+17.62*sin(a)
        w.shaft('两边独立铜窗樘',(x,y,14.60),(x,y,40.56),.54,'patinated-brass',segments=24)
        for height in [16.26,38.65]:
            w.shaft('窗樘定位扣',(x,y-.17,height),(x,y+.65,height),.90,'burnished-brass',segments=18)
    w.block('初始水位的搪瓷标尺座',(36.64,10.05,27.25),(4.92,1.69,24.81),'patinated-brass',.35)
    w.block('定住比较基准的象牙瓷面',(36.64,11.02,27.25),(3.71,.37,23.53),'ivory',.14)
    for i in range(15):
        z=17.4+i*1.15
        w.shaft('储水比较分度',(35.32,11.24,z),(35.32+(2.33 if i%4==0 else 1.16),11.24,z),
                .071 if i%4==0 else .043,'scale-ink',segments=8)
    w.block('锁住初始量的铜刻痕',(36.64,11.27,31.9),(3.07,.25,.28),'dark-bronze',.067,'datum')
    w.block('对面的初始量标定',(61.38,9.72,31.9),(3.51,.74,.29),'ivory',.08,'datum')
    w.turning('封闭的跟踪浮子',(53,7),[(-.16,1.52),(.03,1.83),(.22,1.85),
              (.42,1.53),(.49,1.36)],'burnished-brass','float',52)
    w.turning('浮子嵌瓷',(53,7),[(.43,1.12),(.56,1.20),(.62,1.08)],'blue-enamel','float',44)


def renewal_plumbing(w):
    w.block('补给柱法兰',(13,-5,2.88),(11.9,11.08,1.20),'black-green',.51)
    for x in [9.40,16.6]:
        for y in [-8.6,-1.4]:
            w.screw(x,y,3.52,.76)
    w.turning('补给杯变径承柱',(13,-5),[(3.4,3.65),(4.1,3.65),(4.95,2.57),(6.2,2.02),
             (9.2,1.61),(34.67,1.29),(39.23,1.72),(41.94,2.61),(43.30,3.25)],
             'patinated-brass',segments=52)
    w.turning('补给杯嵌铜底',(13,-5),[(42.97,5.41),(43.44,6.91),(44.13,7.18),
              (44.38,6.48)],'black-green',segments=64)
    flare_cup(w,'高位补给搪瓷杯',13,-5,44.20,51.75,7.26,6.27,'supply-wall',opened=False)
    w.turning('补给杯开口铜边',(13,-5),[(51.48,6.34),(51.39,7.10),(51.65,7.41),
              (51.91,7.14),(51.87,6.34)],'burnished-brass',segments=70,loop=True)
    w.turning('清水组织的独立补给边界',(13,-5),[(44.38,6.05),(48.49,6.06)],'clear-blue',segments=64)
    supply=[(18.83,-5,45.90),(23,-5,45.90),(33.65,-5,45.90)]
    supply+=elbow(35.04,-5,45.90,2.96,2)
    supply.append((38,-3,42.76))
    pipe_with_bore(w,'有内壁的补给铜弯管',supply,1.02,.66,'patinated-brass','supply-pipe')
    for x in [22.32,31.38]:
        w.shaft('补给管束带',(x-.49,-5,45.9),(x+.49,-5,45.9),1.33,'dark-bronze',segments=24)
    w.turning('补给管自由落口',(38,-3),[(42.86,.65),(42.83,1.19),(42.99,1.32),
              (43.43,1.23),(43.56,1.01),(43.56,.65)],'burnished-brass',segments=48,loop=True)

    discharge=[(65.62,-3,15.40),(70,-3,15.40),(75.1,-3,15.4),(80.5,-3,15.4)]
    discharge+=elbow(81.37,-3,15.4,2.63)
    discharge.append((84,-3,12.55))
    pipe_with_bore(w,'贯穿筒底的取水管',discharge,1.16,.68,'patinated-brass','outlet-pipe')
    for x,radius in [(67.16,1.69),(71.92,1.52),(80.4,1.45)]:
        w.shaft('低位管的法兰',(x-.49,-3,15.4),(x+.49,-3,15.4),radius,'dark-bronze',segments=32)
    w.turning('接收杯上方的开孔管嘴',(84,-3),[(12.58,.66),(12.56,1.28),(12.76,1.46),
              (13.23,1.30),(13.31,1.16),(13.31,.66)],'burnished-brass','outlet-nozzle',48,True)
    w.turning('接收杯托座',(84,-3),[(2.24,7.61),(2.46,8.54),(3.13,9.13),
              (3.48,8.63),(3.85,8.40)],'black-green',segments=64)
    flare_cup(w,'独立收水瓷杯',84,-3,3.77,11.93,8.83,8.01,'receiver-wall')
    w.turning('接收杯开口铜边',(84,-3),[(11.63,8.11),(11.62,8.70),(11.81,8.97),
             (12.07,8.83),(12.21,8.28),(12.04,8.10)],'burnished-brass','receiver-rim',64,True)

    # The reading wheel carries a real stem. Its spokes and machined rim
    # rotate as a rigid branch around the inline valve.
    x,y,z=73.5,1.5,20.7
    w.turning('阀杆下压套',(x,-3),[(14.42,1.72),(15.07,2.29),(17.92,2.15),
              (18.48,1.83),(19.52,1.38)],'dark-bronze',segments=42)
    w.shaft('入阀钢杆',(x,-3,z-3.83),(x,-3,z),.76,'steel')
    w.shaft('转柄前轴',(x,-3.3,z),(x,y+.35,z),.71,'steel',segments=32)
    front_turn(w,'可拖开对照的镂空黄铜阀轮',x,y,z,[(-.56,3.05),(-.42,3.65),(.43,3.67),
               (.60,3.17),(.53,2.82),(-.54,2.83)],'burnished-brass','valve',60,True)
    front_turn(w,'阀轮轴中心',x,y,z,[(-.57,.96),(-.42,1.23),(.63,1.21),
              (.78,.95)],'patinated-brass','valve',40)
    for a in [0,tau/3,tau*2/3]:
        w.curve('弧形阀轮辐',[(x+cos(a+.42*t)*3.08*t,y+.12*t,z+sin(a+.42*t)*3.08*t)
                for t in [i/8 for i in range(9)]],.29,'patinated-brass','valve')

    # Small side tap and its separate receiver stay outside the main window.
    tap=[(49,13.82,16.5),(49,16.7,16.5),(49,19.10,16.5),(49,20.28,16.06),
         (49,20.72,14.95),(49,20.72,10.81)]
    pipe_with_bore(w,'水质取样弯嘴',tap,.60,.37,'patinated-brass','sample-tap',reference=(1,0,0))
    w.turning('取样杯榫足',(49,20.72),[(2.13,2.88),(2.30,3.23),(2.72,3.19),
              (3.02,2.83)],'patinated-brass',segments=48)
    flare_cup(w,'带观察口的水质取样杯',49,20.72,2.98,10.17,3.20,2.65,'sample-wall')
    w.turning('取样杯口',(49,20.72),[(9.99,2.68),(9.98,3.11),(10.16,3.28),
              (10.34,3.12),(10.27,2.69)],'burnished-brass',segments=50,loop=True)
    w.shaft('局部取样按钮所在短阀',(51.7,20.72,6.37),(54.26,20.72,6.37),
            .55,'patinated-brass',segments=20)
    front_turn(w,'取样按钮瓷心',54.25,20.91,6.36,[(-.58,1.63),(-.28,1.84),
              (.54,1.83),(.72,1.48)],'blue-enamel','quality',42)


def renewal_cursor(w):
    w.block('前缘铸造导梁',(49,28,2.54),(60,6.40,1.54),'black-green',.41,'rail')
    for y in [26.80,29.20]:
        w.shaft('导向钢轨',(21,y,4.39),(77,y,4.39),.28,'steel','rail',20)
    for x in [21,77]:
        w.block('导轨支座',(x,28,4.3),(3.84,4.98,2.03),'patinated-brass',.39,'rail')
        w.screw(x,28,5.38,.74,'rail')
    w.block('推钮床鞍',(24,28,4.94),(4.81,3.73,1.28),'patinated-brass',.39,'cursor')
    for y in [26.80,29.20]:
        w.shaft('推钮下精磨轴套',(22.16,y,4.39),(25.84,y,4.39),.48,'burnished-brass','cursor',18)
    w.turning('游标的搪瓷触点',(24,28),[(5.5,1.18),(5.68,1.42),(6.14,1.40),
              (6.39,1.15)],'blue-enamel','cursor',48)


def water_budget(states):
    w=Workshop('补给取用与储水量',PALETTE|{
        'inspection-glass':('air','d5e4dc',0,.22),
    })
    reservoir_structure(w)
    renewal_plumbing(w)
    renewal_cursor(w)
    w.export('water-renewal',positive_depth=True)

    # The saved timeline mirrors the book's three independent trials.
    glass=w.material('inspection-glass')
    glass.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.13
    main=w.turning('水位实时储水体',(49,-3),[(0,16.85),(1,16.85)],'sea',None,88)
    receiver=w.turning('随取水增长的受水体',(84,-3),[(0,7.8),(1,7.8)],'sea',None,72)
    sample=w.turning('水质取样液面',(49,20.72),[(3.2,2.52),(6.8,2.52)],'sea',None,56)
    float_pivot=w.join_movement('float',(0,0,0),'储量浮子位置')
    valve=w.join_movement('valve',(73.5,1.5,20.7),'随条件切换的阀轮')
    cursor=w.join_movement('cursor',(24,28,5),'横向进度游标')
    drops=[sphere(w,'补给或取水的示踪',(0,0,0),.46,'clear-blue') for _ in range(7)]
    for i,obj in enumerate(drops):
        obj.scale.z=1.35 if i<4 else 1.23
    contaminants=[sphere(w,'水质示踪',(0,0,0),.40,'sample-gold') for _ in range(10)]
    names=['取用与补给相当','取用超过补给','水体污染']
    for mode,mode_states in enumerate(states):
        start=1+110*mode
        w.scene.timeline_markers.new(names[mode],frame=start)
        for state in mode_states:
            phase=state['phase']
            frame=start+round(phase*100)
            depth=state['level']*25
            top=14.4+depth
            for obj,z,h in [(main,14.4,depth),(receiver,3.9,state['receiverLevel']*7.3)]:
                obj.location=(0,0,z)
                obj.scale.z=max(.002,h)
                obj.keyframe_insert(data_path='location',frame=frame)
                obj.keyframe_insert(data_path='scale',frame=frame)
            float_pivot.location.z=top+.17
            float_pivot.keyframe_insert(data_path='location',frame=frame)
            valve.rotation_euler.y=-.85 if mode==1 else .2
            valve.keyframe_insert(data_path='rotation_euler',frame=frame)
            cursor.location.x=24+50*phase
            cursor.keyframe_insert(data_path='location',frame=frame)
            for i,obj in enumerate(drops):
                if i<4:
                    q=(phase*5+i/4)%1
                    obj.location=(38,-3,42.4+(top+.3-42.4)*q)
                else:
                    q=(phase*(10 if mode==1 else 4)+(i-4)/3)%1
                    obj.location=(84,-3,12.2+(4.1+state['receiverLevel']*7.3-12.2)*q)
                obj.hide_render=phase in [0,1]
                obj.keyframe_insert(data_path='hide_render',frame=frame)
                obj.keyframe_insert(data_path='location',frame=frame)
            for i,obj in enumerate(contaminants):
                a=i*2.399963
                r=4+i%3*3.4
                obj.location=(49+sin(a)*r,-3+cos(a)*r,top+.12)
                obj.hide_render=mode!=2
                obj.keyframe_insert(data_path='hide_render',frame=frame)
                obj.keyframe_insert(data_path='location',frame=frame)
        liquid=w.material('sea').node_tree.nodes.get('Principled BSDF').inputs['Base Color']
        liquid.default_value=(*linear_rgb(PALETTE['quality-water' if mode==2 else 'sea'][1]),1)
        liquid.keyframe_insert(data_path='default_value',frame=start)
        liquid.keyframe_insert(data_path='default_value',frame=start+100)
    for obj in [main,receiver,float_pivot,valve,cursor,*drops,*contaminants]:
        keys_linear(obj)
    w.scene.frame_end=321
    w.scene.frame_set(166)
    w.photograph('water-renewal','补给取用与储水量',(50,4,24),(-35,143,75),114,-2.5,
                 detail=((66,9,23),(-30,141,59),65))


if __name__=='__main__':
    samples=json.loads((ROOT/'work/water-observation-states.json').read_text(encoding='utf8'))
    authors={'water':cycle_observation,'water-renewal':water_budget}
    chosen=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else authors
    for name in chosen:
        authors[name](samples[name])
