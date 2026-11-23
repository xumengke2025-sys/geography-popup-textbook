"""Editable sediment flume with a metering rack, drum, and three study keys."""
import json
from math import cos, sin, exp, pi, sqrt, radians, atan2, tau
from pathlib import Path
import sys
import bpy
from mathutils import Vector, noise

sys.path.insert(0,str(Path(__file__).resolve().parent))
from fieldbook_workshop import ROOT, Workshop, linear_rgb
from water_workshop import FINISH, front_turn, leveled_bed, reading_plate, keys_linear

w=Workshop('河口水沙实验槽', FINISH | {
    'hopper': ('brass','996344',.76,.45), 'belt':('wood','4e392c',0,.68),
    'meter': ('brass','776248',.78,.41),'sand':('land','dbc591',0,.86),
    'paint-land':('land','ffffff',0,.87), 'basin-water':('water','ffffff',.045,.205),
    'channel-water':('water','59888b',.07,.25), 'river-silt':('land','ad9167',0,.86), 'sedge-pigment':('plant','ffffff',0,.76)})
data=json.loads((ROOT/'work/delta-flume-science.json').read_text('utf8'))
depth=60; vert=.46
def height(x,y):
    v=y/60; u=x/100
    q=max(0,min(1,(v-.025)/.315))
    channel=49+2.3*sin(q*tau)*sin(q*pi)
    dist=abs(x-channel)
    coast=max(0,min(1,(.34-v)/.12))
    # Old floodplain channels and levees remain entirely upstream of the live depositional front.
    levee=1.12*max(0,1-abs(dist-3.2)/3.7)
    terraces=.45*sin(10*u+12*v)+.60*sin(22*u-13*v)
    swale=-.88*max(0,1-abs(x-(24+6*sin(y*.18)))/3.1)
    # A curving coastal shelf tapers beneath the fixed water surface.
    shoreline=19.1+1.45*sin(x*.17)+1.14*sin(x*.36+2)
    taper=clip((shoreline+2.85-y)/3.45)
    flat=8.4+1.65*coast+coast*(terraces+swale)
    cut=exp(-((dist/1.84)**2))
    intact=flat+levee*coast
    bank=intact+(4.8-intact)*cut
    return (1.42+(bank-1.42)*taper)*vert

def clip(k):return max(0,min(1,k))
def color_mix(a,b,q):return tuple(x+(y-x)*clip(q) for x,y in zip(a,b))
def grid_rect(x0,x1,y0,y1,nx,ny,fn,finish,name,group,close=False):
    verts=[(x0+(x1-x0)*i/nx,y0+(y1-y0)*j/ny,fn(x0+(x1-x0)*i/nx,y0+(y1-y0)*j/ny)) for j in range(ny+1) for i in range(nx+1)]
    stride=nx+1
    faces=[(k,k+1,k+stride+1,k+stride) for j in range(ny) for i in range(nx) for k in [j*stride+i]]
    if close:
        rim=list(range(stride))+[j*stride+nx for j in range(1,ny+1)]+[ny*stride+i for i in range(nx-1,-1,-1)]+[j*stride for j in range(ny-1,0,-1)]
        first=len(verts)
        for k in rim:verts.append((*verts[k][:2],.27))
        for i,k in enumerate(rim):
            j=(i+1)%len(rim);faces.append((k,first+i,first+j,rim[j]))
        faces.append(tuple(reversed(range(first,len(verts)))))
    obj=w.mesh(name,verts,faces,finish,group)
    for f in obj.data.polygons:f.use_smooth=f.index<nx*ny
    return obj

leveled_bed(w,(50,29),(103,81),0)
# Enamel basin over a dovetailed cabinet; the raised lip remains below the sample.
for x in [1.8,98.2]:
    w.block('水槽侧壁',(x,28.5,1.55),(1.55,60.7,3.2),'black-green',.37)
    w.shaft('卷边铜口',(x,-1.6,3.12),(x,58.6,3.12),.39,'patinated-brass',segments=24)
for y in [-1.6,58.7]:
    w.block('水槽端唇',(50,y,1.5),(97.4,1.37,3.0),'black-green',.25)
    w.shaft('端边铜口',(1.8,y,3.08),(98.2,y,3.08),.38,'patinated-brass',segments=24)
for x in [2.8,97.2]:
    for y in [0,28,57]:
        w.block('边缘压条',(x,y,3.12),(2.7,2.25,.38),'meter',.2)
        w.screw(x,y,3.36,.76)

up=grid_rect(2.6,97.4,-.96,25.4,160,62,height,'paint-land','自然堤、背河洼地及古水道','plain',True)
green,clay,reed,sand=map(linear_rgb,['536040','9f7850','849343','b0a176'])
pigments=[]
for v in up.data.vertices:
    x,y,h=v.co; q=clip((y/60-.025)/.315)
    river_x=49+2.3*sin(q*tau)*sin(q*pi)
    mottled=.5+noise.fractal(Vector((x*.105,y*.105,.7)),1.06,2.1,4)*.58
    marsh=clip(1-abs(x-(24+6*sin(y*.18)))/4.7)
    color=color_mix(clay,color_mix(green,reed,mottled),.26+.69*mottled)
    color=color_mix(color,reed,marsh*.48)
    color=color_mix(color,sand,clip((5.8-abs(x-river_x))/4.6)*.85+.15*clip((y-14)/6))
    pigments.append(tuple(c*(.84+.27*mottled) for c in color))
w.paint(up,pigments)

# A shallow estuary has shelter at the banks and faint wavelets toward the toe.
def surface_water(x,y):
    return 6.34*vert+.020*sin(y*2.47+x*.22+.73*sin(x*.32))+.014*sin(y*3.37-x*.41)
water=grid_rect(2.325,97.675,-.72,58.58,102,112,surface_water,'basin-water','浅水槽面与流纹','water',True)
water_paint=[]
for vertex in water.data.vertices:
    x,y,h=vertex.co
    offshore=clip((y-16)/44)
    shade=.81+.17*offshore+.11*(.5+noise.noise(Vector((x*.07,y*.09,.23))))
    water_paint.append(tuple(v*shade for v in color_mix(linear_rgb('648c85'),linear_rgb('5c8998'),offshore)))
w.paint(water,water_paint)
# Small riparian sedge patches mark the older alluvial plain beside the stream.
blades=[];faces=[];leafcolors=[]
a,b=map(linear_rgb,['516344','899353'])
for idx in range(650):
    x,y=3+(idx*49.437)%93,-.36+(idx*13.643)%21.3
    wet=height(x,y)
    if wet<3.55 or noise.noise(Vector((x*.14,y*.155,3.7)))<.08:continue
    for j in range(4):
        angle=idx*2.17+j*1.49;r=.17+.11*((idx+j)%5)
        u,v=x+r*cos(angle),y+r*sin(angle)
        h=height(u,v);tip=.37+.22*((idx+j*3)%5);k=len(blades)
        blades.extend([(u-.115*sin(angle),v+.115*cos(angle),h-.02),(u+.115*sin(angle),v-.115*cos(angle),h-.02),(u+.29*cos(angle),v+.29*sin(angle),h+tip*.73),(u+.68*cos(angle),v+.68*sin(angle),h+tip)])
        faces.extend([(k,k+1,k+2),(k+1,k+3,k+2)])
        stem=color_mix(a,b,((idx%7)+j)/11);leafcolors.extend([stem]*4)
plant=w.mesh('泛滥平原草丛',blades,faces,'sedge-pigment','sedge');w.paint(plant,leafcolors)

# A rolled copper hopper sits over the actual head of the river. Its feed drum
# and short chute are supported between a pair of cast-iron cheek frames.
for x in [42.1,55.9]:
    for y in [-6.8,1.8]:
        w.turning('支架落座',(x,y),[(0,1.78),(.46,1.95),(.83,1.31),(1.07,.95)],'black-green')
        w.shaft('料斗车制立柱',(x,y,1.0),(x,y,17.65),.53,'meter',segments=28,tip=.42)
        w.turning('柱端套箍',(x,y),[(15.9,.68),(16.14,.84),(16.45,.81),(16.57,.63)],'burnished-brass')
    w.shaft('横担',(x,-7.4,16.6),(x,2.1,16.6),.52,'dark-bronze',segments=20)
    w.shaft('斜撑',(x,-6.8,10),(x,1.7,16.6),.32,'patinated-brass')
for y in [-6.6,1]:
    w.shaft('料仓吊耳横梁',(42.1,y,16.7),(55.9,y,16.7),.52,'patinated-brass',segments=24)
w.turning('铆合锥底铜料斗',(49,-2.5),[(12.35,2.1),(12.85,2.2),(14.27,2.37),(19.15,7.280),
    (24.12,7.28),(24.5,7.58),(24.84,7.48),(24.88,7.08),(24.51,6.97),(19.32,6.98),(14.48,2.03),(12.35,1.83)],'hopper',segments=88,loop=True)
for z,r in [(19.18,7.32),(23.94,7.34)]:
    w.turning('卷边与钎焊接缝',(49,-2.5),[(z-.12,r),(z,r+.18),(z+.14,r),(z+.08,r-.14)],'burnished-brass',segments=88,loop=True)
for i in range(14):
    a=tau*i/14
    w.shaft('手工铆钉',(49+7.20*cos(a),-2.5+7.20*sin(a),19.77),(49+7.50*cos(a),-2.5+7.50*sin(a),19.77),.21,'dark-bronze',segments=12)
w.shaft('落沙转鼓轴',(49,-7.8,11.5),(49,2.46,11.5),.56,'steel',segments=32,group='drum')
front_turn(w,'铣槽给料鼓',49,-2.1,11.5,[(-2.22,1.35),(-1.99,1.73),(1.95,1.73),(2.20,1.35)],'meter','drum')
for i in range(8):
    a=i*tau/8; x,z=49+1.72*cos(a),11.5+1.72*sin(a)
    w.shaft('给料鼓分格铜肋',(x,-3.98,z),(x,-.38,z),.32,'burnished-brass','drum',14)
for y in [-4.62,.55]:
    w.block('料鼓轴承座',(49,y,11.48),(4.77,.87,3.9),'black-green',.52)
    w.shaft('轴承横撑',(42.2,y,10.3),(55.8,y,10.3),.44,'meter',segments=24)

# A back plate and upturned edges form one tangible open sand spout.
w.mesh('折弯铜下料槽',[(47.2,-1.4,10),(50.8,-1.4,10),(50.7,2.73,5.18),(47.3,2.73,5.18),
    (46.93,-1.4,10.97),(51.07,-1.4,10.97),(47.04,2.73,5.78),(50.96,2.73,5.78)],
    [(0,1,2,3),(4,0,3,6),(1,5,7,2)],'patinated-brass')

# A long shaft runs inside the bed, underneath the basin. Only its two
# bearings, active pitch wheel and rear leather transmission are exposed.
rack0,travel,pinion_x,pinion_h=66,26,65,2.77
pitch=1.15;radius=pitch*16/tau
for a,c in [(-7.88,-2.0),(59.1,66.10)]:
    w.shaft('底床传动轴颈',(pinion_x,a,pinion_h),(pinion_x,c,pinion_h),.49,'steel','pinion',32)
w.shaft('床身内通轴',(pinion_x,-5.2,-.82),(pinion_x,61.7,-.82),.46,'steel','shaft',24)
for y in [-4.6,60.8]:
    w.block('轴颈枕座',(pinion_x,y,1.50),(5.57,2.84,2.75),'black-green',.51)
    front_turn(w,'压入铜衬套',pinion_x,y,pinion_h,[(-1.6,.73),(-1.31,1.02),(1.35,1.02),(1.59,.73)],'meter')
def gear():
    n=16; profile=[]
    for j in range(n):
        for off,r in [(-.5,radius-.34),(-.28,radius-.34),(-.18,radius+.31),(.18,radius+.31),(.28,radius-.34)]:
            a=(j+off)*tau/n;profile.append((pinion_x+r*cos(a),pinion_h+r*sin(a)))
    pts=[(x,y,z) for y in [63.35,65.45] for x,z in profile];k=len(profile)
    faces=[tuple(range(k)),tuple(reversed(range(k,2*k)))]+[(i,(i+1)%k,k+(i+1)%k,k+i) for i in range(k)]
    obj=w.mesh('16齿送料小齿轮',pts,faces,'patinated-brass','pinion')
    mod=obj.modifiers.new('齿棱轻倒角','BEVEL');mod.width=.085;mod.segments=2
gear()
for x,z,g in [(65,pinion_h,'pinion'),(49,11.5,'drum')]:
    front_turn(w,'双凸缘皮带盘',x,-7.15,z,[(-.9,2.70),(-.68,2.86),(-.46,2.36),(.46,2.36),(.71,2.85),(.91,2.72)],'meter',g)
    front_turn(w,'端盖',x,-8.05,z,[(-.29,.68),(.1,.85),(.31,.77)],'burnished-brass',g)
# The equal-radius belt has exact common tangents and two half wraps.
angle=atan2(11.5-pinion_h,49-65)
belt=[]
for x,z,start in [(49,11.5,angle-pi/2),(65,pinion_h,angle+pi/2)]:
    for i in range(28):
        a=start+pi*i/27;belt.append((x+2.46*cos(a),-7.15,z+2.46*sin(a)))
w.curve('张紧的皮带',belt,.29,'belt',cyclic=True)
# Positive X slides the top rack over the gear. Its tail always covers the pinion.
w.block('给沙滑尺齿条',(49.95,64.4,6.47),(39.5,1.49,.86),'steel',.10,'rack')
for j in range(34):
    x=31.25+j*pitch
    w.block('齿条渐开齿',(x,64.4,5.91),(.525,1.45,.45),'meter',.075,'rack')
for y in [61.55,66.46]:
    w.shaft('送料规导轨',(62,y,5.03),(96.2,y,5.03),.44,'steel',segments=24)
for x in [61.9,96.32]:
    w.block('止挡与滑杆座',(x,64,3.12),(2.49,7.28,5.15),'black-green',.56)
    for y in [61.67,66.46]:w.screw(x,y,5.75,.57)
w.block('定量滑座',(rack0,64,6.31),(5.44,6.67,1.65),'patinated-brass',.60,'rack')
w.turning('送料木柄铜箍',(rack0,64),[(6.94,.97),(7.14,1.30),(7.58,1.30),(7.92,1.07)],'burnished-brass','rack')
w.turning('送料蘑菇木柄',(rack0,64),[(7.78,1.08),(8.1,1.18),(8.54,1.65),(9.25,2.13),(9.74,2.16),(10.2,1.67),(10.40,.76)],'dark-timber','rack',64)
w.block('黄铜行程标尺',(79.0,68.2,.61),(30.8,1.16,.38),'patinated-brass',.12)
for i in range(21):
    x=66+26*i/20;w.block('刻线',(x,68.21,.828),(.11,.81 if i%5==0 else .43,.04),'scale-ink',.012)
# Put the small selector bank in front of the rack tail so it remains accessible.
font=bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc')
keys=['平原','沉积','岸线']
for i,x in enumerate([12,28.9,45.8]):
    placement=reading_plate(w,'观察键',x,63.8,3.38,15.15,6.82,20,'key'+str(i))
    curve=bpy.data.curves.new(keys[i],'FONT');curve.body=keys[i];curve.font=font;curve.align_x=curve.align_y='CENTER';curve.size=4.59
    curve.extrude=.04;curve.resolution_u=4
    obj=bpy.data.objects.new('瓷刻'+keys[i],curve);w.scene.collection.objects.link(obj)
    xx,zz,yy=placement['at'];obj.location=(xx,yy,zz+.03);obj.rotation_euler=(radians(20),0,pi)
    w.register(obj,keys[i],'scale-ink','key'+str(i))
    w.block('倾斜挡座',(x,64.8,1.34),(16.1,8.67,2.75),'black-green',.61)
# Mesh batches for the web. Its continuous bed and tracked grains are generated
# from the same TypeScript functions that sampled the native keyframes below.
w.export('delta',positive_depth=True,extra={'rackStart':rack0,'travel':travel,'gearRadius':radius})
rack=w.join_movement('rack',(0,0,0),'手推给沙滑尺')
pinion=w.join_movement('pinion',(65,64.4,pinion_h),'齿条同步传动轴')
drum=w.join_movement('drum',(49,-2.1,11.5),'落沙转鼓')
key_nodes=[w.join_movement('key'+str(i),(0,0,0),'观察键 '+str(i)) for i in range(3)]

nx,ny=data['nx'],data['ny']
sandbody=grid_rect(3.5,96.5,19.5,58.5,nx,ny,lambda x,y:1.35*vert,'sand','连续沉积前缘',None)
sandbody.shape_key_add(name='初始海床')
grains=[]
for i in range(54):
    r=[.72,.49,.30][i%3]
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=r)
    grain=bpy.context.object;grain.name='泥沙示踪样粒 %02d'%i
    for vertex in grain.data.vertices:
        vertex.co.x*=1.19;vertex.co.y*=.86;vertex.co.z*=.76+.11*sin(i*.87+vertex.co.x*7.3)
    for face in grain.data.polygons:face.use_smooth=True
    grain.data.materials.append(w.material(['ochre','sand','river-silt'][i%3]))
    grains.append(grain)
def hopper_point(i):
    a=i*2.399963; r=sqrt((i+.5)/54)*5.53
    return 49+r*cos(a),-2.5+r*sin(a),22.85-.13*r
def animate_shape(obj,points,n):
    key=obj.shape_key_add(name='观测 %03d'%n)
    for i,p in enumerate(points):key.data[i].co=p
    key.slider_max=1
    for delta,value in [(-4,0),(0,1),(4,0)]:
        key.value=value;key.keyframe_insert(data_path='value',frame=1+n+delta)
for n,frame in enumerate(data['frames']):
    t=n/120
    rack.location.x=travel*t;rack.keyframe_insert(data_path='location',frame=n+1)
    for pivot in [pinion,drum]:
        pivot.rotation_euler.y=t*travel/radius;pivot.keyframe_insert(data_path='rotation_euler',frame=n+1)
    for i,grain in enumerate(frame['grains']):
        u,h,v=grain['position']
        grains[i].location=hopper_point(i) if grain['stage']=='waiting' else (100*u,60*v,h*vert)
        grains[i].keyframe_insert(data_path='location',frame=n+1)
    for j,key in enumerate(key_nodes):
        key.location.z=-.42 if j==(0 if n<41 else 1 if n<85 else 2) else 0
        key.keyframe_insert(data_path='location',frame=n+1)
    if n%4==0:
        points=[(3.5+93*i/nx,19.5+39*j/ny,frame['grid'][j][i]*vert) for j in range(ny+1) for i in range(nx+1)]
        animate_shape(sandbody,points,n)

for obj in [rack,pinion,drum,*grains,*key_nodes]:keys_linear(obj)
keys_linear(sandbody.data.shape_keys)
for n,name in [(1,'待给沙'),(36,'搬运至河口'),(63,'粗粒先沉'),(108,'多股分流与前缘推进')]:w.scene.timeline_markers.new(name,frame=n)
from earth_material import apply_scan
apply_scan(up.data.materials[0],'turf',15)
apply_scan(sandbody.data.materials[0],'alluvium',8)
font.pack()
w.scene.frame_end=121;w.scene.frame_set(112)
w.photograph('delta-flume','河口水沙实验槽',(50,27,7),(-33,130,104),130,-4.73,
             detail=((51,-1,12),(-47,82,52),39))
