"""Coastal breeze and cold-front observation instruments. Blender XYZ = east, depth, elevation."""
from math import pi,tau,sin,cos,exp,sqrt
from pathlib import Path
from random import Random
import sys,bpy
from mathutils import Vector,noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
from fieldbook_workshop import Workshop,ROOT,linear_rgb
from water_workshop import FINISH,leveled_bed,reading_plate,front_turn
from earth_material import apply_scan

palette=FINISH|{
 'cut-stone':('rock','ffffff',0,.85),'stone':('rock','ffffff',0,.88),'loam':('land','ffffff',0,.91),'bay':('water','ffffff',.10,.23),
 'turf-sample':('land','ffffff',0,.86),'pebble':('rock','a29983',0,.84),'brick':('rock','a67c65',0,.81),
 'limewash':('rock','d8c9a8',0,.77),'slate':('rock','526466',.03,.73),'iron':('steel','40554c',.69,.53),
 'surf':('water','ced0b4',.05,.37),'field-leaves':('plant','596f4d',0,.80),'crop-leaves':('plant','778561',0,.83),'cloth':('enamel','b68466',0,.77),
 'window':('enamel','4b6870',.14,.26),'lantern-glass':('enamel','dbc07e',.20,.29),
 'hedge':('plant','ffffff',0,.85),'sand':('land','bca988',0,.87),'copper':('brass','9b7650',.83,.36),
 'blue-steel':('steel','537179',.64,.43),'dark-earth':('rock','806b52',0,.89),
}
def mix(a,b,t):
 t=max(0,min(1,t));return tuple(u*(1-t)+v*t for u,v in zip(linear_rgb(a),linear_rgb(b)))
def n(x,y,z,s):return noise.noise_vector(Vector((x*s,y*s,z*s)))[0]
def grid(name,nx,ny,at,color,finish,group):
 vs=[at(i/nx,j/ny) for j in range(ny+1) for i in range(nx+1)]
 fs=[(k,k+1,k+2+nx,k+nx+1) for j in range(ny) for i in range(nx) for k in [j*(nx+1)+i]]
 ob=w.mesh(name,vs,fs,finish,group,True)
 if color:w.paint(ob,[color(*p) for p in vs])
 return ob
def box(name,x,y,z,width,depth,height,finish,group='frame',edge=.09):
 return w.block(name,(x,y,z),(width,depth,height),finish,edge,group)
def key(label,x,y,z,width,group):
 mark=reading_plate(w,label,x,y,z,width,5.8,24,group);xx,zz,yy=mark['at']
 curve=bpy.data.curves.new(label,'FONT');curve.body=label;curve.font=font;curve.size=3.5;curve.resolution_u=4
 curve.align_x=curve.align_y='CENTER'
 obj=bpy.data.objects.new(label,curve);w.scene.collection.objects.link(obj);obj.location=(xx,yy,zz+.05);obj.rotation_euler=(mark['angle'],0,pi)
 w.register(obj,'瓷面刻字 '+label,'scale-ink',group)
def vertical_text(label,x,y,z,size,group):
 curve=bpy.data.curves.new(label,'FONT');curve.body=label;curve.font=font;curve.size=size;curve.resolution_u=5
 curve.align_x=curve.align_y='CENTER'
 obj=bpy.data.objects.new(label,curve);w.scene.collection.objects.link(obj);obj.location=(x,y,z);obj.rotation_euler=(pi/2,0,pi)
 w.register(obj,label+' 铭文','scale-ink',group)
def column(x,y,bottom,top,r,group='frame'):
 z=bottom;w.turning('车削立柱',(x,y),[(z,r*1.61),(z+.46,r*1.69),(z+.77,r*1.34),(z+1.45,r*1.09),
   (z+2.01,r*.68),(top-1.75,r*.47),(top-1.58,r*.69),(top-.99,r*.71),(top-.70,r*.60),(top,r*.54)],'black-green',group,28)
 for h,rr in [(z+.71,1.37*r),(top-1.4,r*.71)]:
  w.turning('铜束环',(x,y),[(h,rr),(h+.19,rr+.09),(h+.33,rr)],'patinated-brass',group,28)
def roof(name,x,y,z,a,b,peak,group,finish='slate'):
 vs=[(x-a,y-b,z),(x+a,y-b,z),(x+a,y+b,z),(x-a,y+b,z),(x-a,y,z+peak),(x+a,y,z+peak)]
 w.mesh(name,vs,[(0,3,2,1),(0,1,5,4),(2,3,4,5),(3,0,4),(1,2,5)],finish,group)
 for t in [.22,.48,.74]:
  w.curve('搭接瓦边',[(x-a,y+b*(1-t),z+t*peak+.035),(x+a,y+b*(1-t),z+t*peak+.035)],.05,'iron',group)
def finish_file(title,center,view,span):
 for ob,finish,group in w.parts:
  material=ob.data.materials[0]
  scan={'cut-stone':'outcrop','stone':'outcrop','loam':'loam','dark-earth':'loam','turf-sample':'turf','sand':'alluvium','pebble':'alluvium','dark-timber':'walnut'}.get(finish)
  if scan and not material.get('earth_scan'):apply_scan(material,scan,{'valley':15,'outcrop':13,'loam':10,'turf':10,'alluvium':7,'walnut':23}[scan])
 graph=bpy.context.evaluated_depsgraph_get()
 for ob in list(w.scene.objects):
  if ob.type=='FONT':
   letters=bpy.data.meshes.new_from_object(ob.evaluated_get(graph));g=bpy.data.objects.new(ob.name+' 刻字网格',letters)
   w.scene.collection.objects.link(g);g.matrix_world=ob.matrix_world.copy();bpy.data.objects.remove(ob,do_unlink=True)
 bpy.ops.object.camera_add(location=Vector(view)+Vector(center));cam=bpy.context.object
 cam.rotation_euler=(Vector(center)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=span;w.scene.camera=cam
 for d,power,size in [((-36,71,80),120000,72),((43,-41,48),72000,52)]:
  bpy.ops.object.light_add(type='AREA',location=Vector(d)+Vector(center));ob=bpy.context.object;ob.data.size=size;ob.data.energy=power
  ob.rotation_euler=(Vector(center)-ob.location).to_track_quat('-Z','Y').to_euler()
 w.scene.world=bpy.data.worlds.new('玻璃标本柜');w.scene.world.color=(.23,.24,.22)
 for area in bpy.context.screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL'
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'release/Blender/制作素材'/(title+'.blend')),compress=True)
def breeze():
 def coast(y):return 48.4+3.8*sin(y*.096)+1.65*sin(y*.203+.24)+.83*sin(y*.37)
 def land(x,y):
  c=coast(y);inland=max(0,1-x/c)
  ridge=22*exp(-((x-9-.17*y)/9.3)**2-((y-14)/13.8)**2)+10*exp(-((x-28)/8)**2-((y-26)/12)**2)
  detail=2.6*n(x,y,0,.12)+1.15*n(x,y,0,.29)+.39*n(x,y,0,.73)
  return 3.35+inland*(2.3+ridge+detail)+.36*sin(y*.31)*max(0,1-inland*6)
 def land_color(x,y,z):
  slope=abs(land(x+.2,y)-land(x-.2,y))/.4;near=coast(y)-x
  if z>13.5 or slope>1.05:return mix('756e5e','b5a891',.47+.26*sin(3.6*z+x*.06)+.18*n(x,y,z,.37))
  if near<3.8:return mix('8f815e','baad86',.48+.31*n(x,y,z,.24))
  return mix('526a50','969d75',.46+.42*n(x,y,z,.18)+.16*sin(x*.20))
 land_ob=grid('雕刻海岸、岬角和坡地',92,86,lambda u,v:(coast(63*v)*u,63*v,land(coast(63*v)*u,63*v)),land_color,'stone','land')
 facies=land_ob.data.color_attributes.new(name='facies',type='FLOAT_COLOR',domain='POINT')
 for i,v in enumerate(land_ob.data.vertices):
  x,y,z=v.co;slope=abs(land(x+.2,y)-land(x-.2,y))/.4
  rock=max(0,min(1,(slope-.56)*1.5+(z-14)*.15));beach=max(0,min(1,1-(coast(y)-x)/4.1))*(1-rock)
  facies.data[i].color=(rock,beach,(1-rock-beach)*.86,1)
 for edge in ['back','near','left','cliff']:
  def side(u,v):
   y=63*u if edge in ['left','cliff'] else (0 if edge=='back' else 63)
   x=coast(y) if edge=='cliff' else 0 if edge=='left' else coast(y)*u
   return x,y,-.65+(land(x,y)+.65)*v
  grid('沿海岩芯的开挖面 '+edge,90,12,side,lambda x,y,z:mix('746451','b8a38a',.46+.29*sin(3.8*z+.055*y+.12*x)+.18*n(x,y,z,.4)),'cut-stone','strata')
 def beach(u,v):
  y=63*v;c=coast(y);width=3.3+1.8*sin(y*.15)
  return c+width*u,y,land(c,y)*(1-u)+1.62*u
 grid('滩砂和潮间带',9,82,beach,None,'sand','shore')
 def water(u,v):
  y=63*v;c=coast(y)+1.52+.8*sin(y*.15);x=c+(100-c)*u
  swell=x*.51+.12*y+1.87*sin(y*.135)+1.20*n(x,y,0,.073)
  h=1.82+.13*sin(swell)+.025*sin(swell*2.1)+.049*n(x,y,0,.27)
  return x,y,h
 grid('有涌浪微起伏的浅海标本',67,66,water,lambda x,y,z:mix('356871','8ea99b',.22+.47*exp(-max(0,x-coast(y))/13)+.20*n(x,y,0,.103)+.045*sin(x*.47+.12*y+1.65*sin(y*.14))),'bay','sea')
 for edge in ['near','far','right']:
  def side(u,v):
   x,y,z=water(1 if edge=='right' else u,u if edge=='right' else int(edge=='near'));return x,y,-.68+(z+.68)*v
  grid('海水剖缘 '+edge,52,2,side,lambda x,y,z:mix('315b65','648b86',.43+.14*z),'bay','sea')
 for j,(start,end,offset) in enumerate([(2,10,2.4),(13,21,2.7),(26,35,2.2),(39,47,2.65),(51,61,2.4)]):
  pts=[]
  for i in range(16):
   y=start+(end-start)*i/15;x=coast(y)+offset+.25*sin(y*.78);pts.append((x,y,1.99))
  w.curve('浪边细沫',pts,.074,'surf','foam')
 for i in range(23):
  y=rng.uniform(3,61);x=coast(y)+rng.uniform(.43,2.85);z=2.10+rng.uniform(.03,.29)
  ob=w.turning('滩砾',(0,0),[(-.27,.31),(-.17,.61),(.13,.66),(.27,.46),(.34,.19)],'pebble','shore',10)
  ob.location=(x,y,z);ob.scale=(rng.uniform(.8,1.7),rng.uniform(.52,1.1),rng.uniform(.64,1.4))
 tx,ty=39,30;t=land(tx,ty)
 w.turning('岸灯石砌塔体',(tx,ty),[(t-.7,3.8),(t+.37,4.08),(t+.83,3.94),(t+1.2,3.42),(t+8.1,2.87),(t+12.4,2.35),(t+12.7,2.54)],'limewash','tower',40)
 w.turning('灯塔赤陶圈',(tx,ty),[(t+5.3,3.12),(t+7.2,2.97)],'brick','tower',40)
 w.turning('灯室托盘',(tx,ty),[(t+12.63,2.34),(t+12.92,3.05),(t+13.35,3.10),(t+13.58,2.91)],'iron','tower',40)
 w.turning('透镜灯笼',(tx,ty),[(t+13.6,1.74),(t+16.75,1.74)],'lantern-glass','lantern',14)
 for j in range(12):
  a=tau*j/12;xx=tx+1.79*cos(a);yy=ty+1.79*sin(a)
  w.shaft('灯笼铁框',(xx,yy,t+13.53),(xx,yy,t+16.89),.10,'iron','tower',8)
 w.turning('风雨铜帽',(tx,ty),[(t+16.76,2.11),(t+17.14,2.23),(t+18.55,.66),(t+19.03,.18)],'copper','tower',36)
 box('塔门',tx,ty+3.21,t+1.85,1.65,.34,3.61,'iron','tower')
 for h in [4.5,8.5,11.4]:box('灯塔石窗',tx,ty+3.41-h*.081,t+h,1.0,.30,1.35,'window','tower')
 for x,y in [(18,29),(26.6,24.3)]:
  z=land(x,y);box('守灯人石舍',x,y,z+1.71,6.1,4.8,4.03,'limewash','cottages')
  roof('板瓦坡屋顶',x,y,z+3.72,3.45,2.72,1.82,'cottages')
  box('木门',x,y+2.46,z+.91,1.13,.16,2.21,'teal','cottages')
  for dx in [-2.02,1.98]:box('门廊细窗',x+dx,y+2.45,z+2.02,.88,.13,1.07,'window','cottages')
 # A vertical harbour section is mounted in a single fitted walnut drawer.
 leveled_bed(w,(50,36.8),(104,77),-.72)
 for x in [5.2,93]:
  column(x,9.2,land(x,9.2) if x<50 else 1.9,64.4,1.33,'comparison-frame')
  front_turn(w,'立柱封顶',x,9.2,65,[(-.36,1.05),(.31,1.05),(.48,.83)],'burnished-brass','comparison-frame',30)
 for x in [26,74]:
  col=5.2 if x<50 else 93
  for h in [29,57]:
   w.shaft('同高度对照横臂',(col,9.2,h),(x,9.2,h),.26,'patinated-brass','comparison-frame',16)
   w.shaft('铭牌承托销',(x,9.2,h),(x,17.6,h),.28,'steel','comparison-frame',16)
   box('同高气压瓷窗包边',x,18,h,15.6,1.18,6.2,'patinated-brass','pressure-faces',.23)
   box('同高气压瓷面',x,18.69,h,14.73,.28,5.43,'ivory','pressure-faces',.13)
 for x in [20,80]:
  reading_plate(w,'热力对照',x,72,1.1,26.5,5.9,29,'temperature-plates')
 for i,t in enumerate(['白天','夜晚']):key(t,43+i*14,72,1.12,11.1,'key'+str(i))
 # Dark and light half-rings on the existing day/night index.
 for j in range(48):
  a=tau*j/48;b=tau*(j+1)/48;rm,R=7.66,8.31;y=52.82
  vs=[(106+r*cos(t),y,26+r*sin(t)) for r,t in [(rm,a),(R,a),(R,b),(rm,b)]]
  w.mesh('昼夜双金属刻圈',vs,[(0,1,2,3)],'burnished-brass' if sin((a+b)/2)>0 else 'blue-steel','dial-inlay')
 w.export('breeze',extra={'flagCoast':round(coast(54),4),'jettyCoast':round(coast(48),4)},positive_depth=True)
 apply_scan(land_ob.data.materials[0],'valley',15)
 for x,h,t in [(26,29,'低压'),(74,29,'高压'),(26,57,'高压'),(74,57,'低压')]:vertical_text(t,x,18.87,h,4.45,'native')
 # Native copy of the web clock and qualitative indices keeps this asset independently viewable.
 for x in [20,80]:
  column(x,67.8,-.61,21.6,.65,'native')
  box('海陆热响应标条',x,68.19,11.8,2.86,.61,18.3,'ivory','native')
 front_turn(w,'昼夜盘体',106,51.1,26,[(-1.42,9.34),(-1.02,10.42),(.86,10.41),(1.49,9.81)],'patinated-brass','native')
 front_turn(w,'昼夜瓷盘',106,52.65,26,[(-.08,9.52),(.09,9.52)],'ivory','native')
 w.curve('蓝钢时指',[(106,53.04,26),(106,53.05,33.5)],.2,'blue-steel','native')
 column(106,50,-.6,25.3,1.36,'native')
 finish_file('海岬灯塔昼夜测风台',(53,32,29),(38,140,82),148)

def cold():
 # Fixed agricultural station and a low draped terrain clear of the leading front.
 def high(x,y):return 3+.13*sin(.23*x+y*.11)+.08*n(x,y,0,.37)+4.9*exp(-((x-21)/14)**2-((y-23)/5.5)**2)+2.9*exp(-((x-46)/14)**2-((y-22)/6)**2)
 def ground(x,y):return min(high(x,y),3.05) if (27<x<86 and 45<y<64) or (74<x<92 and 27<y<44) else high(x,y)
 def ext(y):return min(4,max(0,4-.67*(y-18),4-.67*(72-y)))
 def groundpt(u,v):
  y=18+54*v;x=1+ext(y)+(97-2*ext(y))*u;return x,y,ground(x,y)
 def tone(x,y,z):
  if y<29 and z>4:return mix('716e57','b2aa7e',.47+.4*n(x,y,z,.2))
  if 28<x<85 and 46<y<63:return mix('82684e','ab9170',.50+.23*n(x,y,0,.33))
  return mix('717953','a4a279',.49+.39*n(x,y,0,.22)+.10*sin(.33*x+y*.057))
 grid('观测站周边缓丘与田地',91,60,groundpt,tone,'turf-sample','ground')
 for edge in ['front','rear','left','right']:
  def side(u,v):
   x,y,z=groundpt(u if edge in ['front','rear'] else int(edge=='right'),int(edge=='front') if edge in ['front','rear'] else u);return x,y,-.78+(z+.78)*v
  grid('农田开挖剖面 '+edge,72,8,side,lambda x,y,z:mix('77634c','a58d6a',.49+.28*sin(z*3+x*.08)+.16*n(x,y,z,.39)),'loam','cut')
 # Shallow linear seed beds. Rows undulate only a few centimetres in the model.
 for y in [48.12,51.32,54.52,57.72,60.92]:
  grid('种植垄沟',39,6,lambda u,v:(28+57*u,y+1.63*(v-.5)+.12*sin(u*7),3.11+.30*sin(v*pi)*sin(pi*max(.01,min(.99,u)))**.16),
       lambda x,y,z:mix('735c46','a68c64',.44+.32*n(x,y,z,.39)),'loam','fields')
 # A low hedgerow marks the sheltered field boundary and keeps the measured plants distinct.
 for j in range(35):
  x=4.2+j*.77;y=29.9+1.48*sin(.14*x);h=ground(x,y)
  w.shaft('田埂梗枝',(x,y,h),(x+.14,y,h+.63),.096,'dark-timber','hedgerow',8)
  crown=w.turning('田埂灌丛',(0,0),[(-.18,.26),(.17,.86),(.55,.77),(.90,.34),(1.01,.11)],'field-leaves','hedgerow',9)
  crown.location=(x,y,h+.26);crown.scale=(rng.uniform(.9,1.42),rng.uniform(.75,1.10),rng.uniform(.62,1.22))
 # A ventilated, double-roofed 19th-century meteorological screen joins the
 # station house to its instrument. No snow or crop damage is presumed.
 for x in [78.9,87.1]:
  for y in [31.4,38.6]:
   w.shaft('百叶箱四脚',(x+(.25 if x<83 else -.25),y,3),(x,y,6.61),.30,'limewash','screen',14)
 box('仪器底板',83,35,6.74,9.85,8.24,.56,'limewash','screen')
 box('暗色通风内腔',83,35,9.39,8.80,7.13,5.12,'iron','screen')
 for x in [78.4,87.6]:
  for y in [31.2,38.8]:box('气象百叶箱立框',x,y,9.44,.41,.41,5.71,'limewash','screen')
 for j in range(8):
  z=7.17+j*.61
  for y,rot in [(31.04,-.40),(38.96,.40)]:
   l=box('通风木百叶',83,y,z,9.25,.66,.18,'limewash','screen',.035);l.rotation_euler.x=rot
  for x,rot in [(78.31,.40),(87.69,-.40)]:
   l=box('侧通风百叶',x,35,z,.66,7.45,.18,'limewash','screen',.035);l.rotation_euler.y=rot
 box('百叶检修门压条',83,39.34,9.45,.28,.25,5.22,'limewash','screen')
 box('铭牌与门闩',84,39.45,9.63,.69,.24,.41,'patinated-brass','screen')
 roof('第一层通风顶',83,35,12.42,5.48,4.61,1.35,'screen','limewash')
 roof('上覆排雨顶',83,35,13.12,5.73,4.79,1.44,'screen','slate')
 # At the actual measuring point: a stepped mast, divided capillary and bare
 # brass pressure clips; the live meniscus and flag are driven by the web model.
 column(61,65,2.86,28.28,.74,'mast')
 w.turning('风旗枢轴帽',(61,65),[(28.16,.54),(28.32,.71),(28.52,.66),(28.83,.31)],'burnished-brass','mast',30)
 for z in [7.3,20.9]:w.shaft('温度仪卡座',(61,65,z),(61,67.61,z),.47,'bronze','thermometer',18)
 box('温度仪铸件外壳',61,67.52,14.64,5.66,1.23,20.08,'black-green','thermometer',.35)
 box('压圈衬框',61,68.14,14.2,4.93,.41,18.53,'patinated-brass','thermometer',.15)
 box('瓷面比较刻度',61,68.36,14.06,4.45,.14,17.42,'ivory','thermometer',.05)
 box('温柱凹槽',61,68.41,14.15,1.09,.11,16.77,'blue-steel','thermometer',.03)
 for j in range(17):
  z=6+j
  box('无量纲冷热刻纹',62.03,68.51,z,.67 if j%4==0 else .4,.1,.068,'scale-ink','thermometer',.012)
 for z in [5.12,23.85]:
  w.shaft('仪表螺帽',(61,68.18,z),(61,68.53,z),.27,'burnished-brass','thermometer',14)
 for h in [7.6,21.8]:
  w.shaft('冷热方向瓷耳',(63,67.71,h),(64.1,67.71,h),.29,'bronze','thermometer',12)
  box('冷热刻字包边',65.36,67.99,h,3.75,.69,3.7,'patinated-brass','thermometer')
  box('冷热刻字瓷面',65.36,68.38,h,3.40,.16,3.31,'ivory','thermometer')
  vertical_text('暖' if h>10 else '冷',65.36,68.51,h,2.9,'thermometer')
 # Specimen press and rack: the marker can be moved all the way to the last
 # graduations and its index aligns to the air boundary at every position.
 leveled_bed(w,(50,49),(101,64),-1.01)
 for y in [84.71,87.08]:w.shaft('推架双导轨',(23.6,y,-3.97),(101.2,y,-3.97),.34,'steel','rack',20)
 for x in [23.4,101.4]:
  box('滑尺端座',x,85.91,-4.07,1.26,4.1,2.4,'bronze','rack',.20)
  w.shaft('滑尺托脚',(x,85.76,-4.46),(x,82.05,-.66),.31,'steel','rack',14)
 box('冷锋游标',26,86,-4.01,5.15,4.23,.86,'patinated-brass','cursor',.18)
 w.turning('蓝瓷推柄',(26,86),[(-3.59,1.25),(-3.3,1.46),(-2.76,2.01),(-2.06,2.11),(-1.73,1.75)],'blue-enamel','cursor',36)
 w.curve('锋线定向指针',[(26,85.19,-3.48),(26,81.5,-1.74),(26,73.86,2.86),(26,71.18,3.26)],.15,'copper','cursor')
 for i,(x,label) in enumerate(zip([14.3,38.2,62.1,86],['到来前','接近','到达','推进后'])):key(label,x,77.7,.42,18.5,'key'+str(i))
 w.export('cold-wave',positive_depth=True)
 # Reference state of the retained cold air wedge, at the observation site.
 def dep(x):t=max(0,min(1,(74.0-x)/23));return 17*t*t*(3-2*t)
 air=grid('冷空气剖面示踪面',55,16,lambda u,v:(3+71*u,21+50*v,3.12+dep(3+71*u)),None,'mist','native')
 mat=air.data.materials[0];bsdf=next(v for v in mat.node_tree.nodes if v.type=='BSDF_PRINCIPLED')
 bsdf.inputs['Alpha'].default_value=.20
 w.curve('气流前缘截线',[(3+71*i/40,71,3.12+dep(3+71*i/40)) for i in range(41)],.10,'blue-steel','native')
 # Editable witness cloth, responding plants and the observed liquid column at this reference state.
 flagverts=[]
 for j in range(11):
  u=j/10;flagverts.extend([(61+12*u,65+.43*sin(u*6)*u,27.3-1.1*u),(61+12*u,65+.43*sin(u*6)*u,23.2-1.1*u)])
 w.mesh('观察点已起风的风旗',flagverts,[(2*j,2*j+2,2*j+3,2*j+1) for j in range(10)],'cloth','native',True)
 box('温度读数',61,68.50,11.1,.78,.35,10.2,'blue-enamel','native')
 for j,x in enumerate([46,52,58,68,75]):
  y=58+(j%2)*2.4;h=10+j%3;bend=4.6*max(0,min(1,(74-x)/13))
  at=lambda u:(x+bend*u*u,y,3.38+h*u)
  w.curve('弯曲麦秆',[at(k/8) for k in range(9)],.15,'crop-leaves','native')
  for k in range(6):
   px,py,pz=at(k/6);span=(4.2-k*.32)*(-1 if k%2==0 else 1);vs=[]
   for t in [0,.2,.4,.6,.8,1]:
    xx=px+t*(span+bend*.3);yy=py+t*(1 if k%2 else -1);zz=pz+3.4*sin(t*2.22);wth=.55*sin(pi*t)
    vs.extend([(xx,yy-wth,zz-wth*.4),(xx,yy,zz),(xx,yy+wth,zz-wth*.4)])
   w.mesh('叶脉和折叶',vs,[(i,i+3,i+4,i+1) for row in range(5) for i in [3*row,3*row+1]],'crop-leaves','native',True)
 finish_file('冷锋推进田间观测台',(51,49,11),(35,134,74),122)
palette['mist']=('air','88b3c1',.04,.57)
for id,title,fn in [('breeze','海岬灯塔昼夜测风台',breeze),('cold-wave','冷锋推进田间观测台',cold)]:
 if '--' in sys.argv and id not in sys.argv[sys.argv.index('--')+1:]:continue
 rng=Random(803);w=Workshop(title,palette);font=bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc');fn()

