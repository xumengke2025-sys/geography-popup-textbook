"""Two related limestone teaching instruments, sharing the specimen slide and mineral palette."""
import bpy
import json
from math import atan2, cos, exp, pi, sin, sqrt, tau
from mathutils import Vector, noise
from pathlib import Path
from random import Random
import subprocess
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
from fieldbook_workshop import ROOT, Workshop, linear_rgb
from water_workshop import FINISH, front_turn, leveled_bed, reading_plate, keys_linear
from earth_material import apply_scan

data=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/art/sample-karst-observer.mjs')],cwd=ROOT))
palette=FINISH|{
 'limestone':('rock','ffffff',0,.86), 'mantle':('land','fefefe',0,.89),
 'bare-loam':('land','fffaf5',0,.90), 'flowstone':('ivory','fffdf5',.015,.39),
 'fissure':('rock','4f5347',0,.87), 'water-blue':('water','82b6c0',.02,.20),
 'leaf':('plant','ffffff',0,.86), 'root':('wood','62503a',.01,.80),'grain':('land','aa7751',0,.90),
 'aged':('brass','826b4b',.78,.47),'rain-steel':('steel','738487',.75,.36),
}
def clamp(v):return min(1,max(0,v))
def pigment(a,b,f,shade):
    a,b=linear_rgb(a),linear_rgb(b);return tuple(min(1,max(0,(aa+(bb-aa)*clamp(f))*shade)) for aa,bb in zip(a,b))
def n(x,y,z,k):return noise.noise_vector(Vector((x*k,y*k,z*k)))[0]
def rockcolor(x,y,z):
    layer=.5+.5*sin(z*1.74+.066*x+.031*y+.38*sin(.17*x))
    return pigment('746e5c','b5ae95',.24+.61*layer+.27*n(x,y,z,.19),.92+.22*n(x,y,z,.62))
def colored(name,verts,faces,finish,group,color,smooth=True):
    ob=w.mesh(name,verts,faces,finish,group,smooth);w.paint(ob,[color(*p) for p in verts]);return ob
def grid(name,nx,ny,point,finish,group,color):
    pts=[point(i/nx,j/ny) for j in range(ny+1) for i in range(nx+1)]
    faces=[(k,k+1,k+nx+2,k+nx+1) for j in range(ny) for i in range(nx) for k in [j*(nx+1)+i]]
    return colored(name,pts,faces,finish,group,color)
def sample(column,u,v):
    nx,ny=data['nx'],data['ny'];x,y=clamp(u)*nx,clamp(v)*ny;i,j=min(nx-1,int(x)),min(ny-1,int(y));a,b=x-i,y-j;g=data['grid']
    return (1-b)*((1-a)*g[j][i][column]+a*g[j][i+1][column])+b*((1-a)*g[j+1][i][column]+a*g[j+1][i+1][column])
def surface(u,v):return sample(1,u,v)
def roof(x):return data['roof'][int(round(x))]
def chipped(x,y):return .25*n(x,y,2,.31)+.14*sin(x*.77+y*.35)
def make_frame(id,names):
    cave=id=='karst-cave'
    leveled_bed(w,(50,33.7),(108,76),0)
    for x in [2.0,98]:
        w.block('矿样侧压条',(x,26.5,.58),(1.55,55.3,1.41),'aged',.22)
    start,end=(24,76) if cave else (16,84)
    for y in [56.8,59]:
        w.shaft('磨光横向滑轨',(start-3.9,y,2.3),(end+3.9,y,2.3),.44,'steel')
    for xx in [start-3.9,end+3.9]:
        w.block('行程挡块',(xx,57.9,1.97),(2.15,5.2,3.92),'black-green',.43)
        w.screw(xx,57.9,3.98,.75)
    for i in range(29):
        xx=start+(end-start)*i/28
        w.block('游标分度',(xx,61.65,.18),(.15,1.3 if i%4==0 else .64,.16),'burnished-brass',.025)
    w.block('燕尾滑座',(start,57.9,2.64),(6.56,4.72,2.66),'patinated-brass',.43,'cursor')
    w.turning('手推瓷钮',(start,57.9),[(3.75,1.68),(4.2,2.25),(4.78,2.22),(5.0,1.82)],'blue-enamel','cursor',48)
    w.shaft('游标指针',(start,57.1,3.86),(start,54.4,6.62),.36,'steel','cursor')
    if cave:
        w.shaft('视准环脚',(start,54.4,6.62),(start,54.4,9.46),.29,'aged','cursor')
        front_turn(w,'视准环',start,54.4,11.29,[(-.39,1.67),(-.39,2.09),(.38,2.09),(.4,1.67)],'burnished-brass','cursor',48,True)
    font=bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc');font.pack()
    spacing=41 if cave else 23.4
    for i,label in enumerate(names):
        x=50+(i-(len(names)-1)/2)*spacing
        mark=reading_plate(w,label,x,66.4,1.42,35 if cave else 21.1,6.7,19,'key'+str(i))
        curve=bpy.data.curves.new(label,'FONT');curve.body=label;curve.font=font;curve.size=4.48;curve.align_x=curve.align_y='CENTER';curve.resolution_u=4;curve.extrude=.022
        obj=bpy.data.objects.new(label,curve);w.scene.collection.objects.link(obj)
        xx,z,y=mark['at'];obj.location=(xx,y,z+.014);obj.rotation_euler=(mark['angle'],0,pi)
        w.register(obj,'搪瓷刻字 '+label,'scale-ink','key'+str(i))
def column(name,x,y,z,height,radius,down,group,seed):
    rings=15;segments=36;pts=[]
    for j in range(rings+1):
        t=j/rings
        shape=((1-t)**(1.48 if down else .72))*(1+.11*cos(t*10+seed))+.023
        for i in range(segments):
            a=tau*i/segments;r=radius*shape*(1+.12*cos(6*a+seed)+.08*sin(11*a+t*3)+.07*n(cos(a)*6,sin(a)*6,t*9,.39))
            pts.append((x+r*cos(a)+.10*radius*sin(t*pi),y+r*sin(a)*.91,z+(-1 if down else 1)*height*t))
    faces=[(j*segments+i,j*segments+(i+1)%segments,(j+1)*segments+(i+1)%segments,(j+1)*segments+i) for j in range(rings) for i in range(segments)]
    if down:faces=[tuple(reversed(f)) for f in faces]
    faces.extend([tuple(range(segments)),tuple(range(len(pts)-segments,len(pts)))])
    return colored(name,pts,faces,'flowstone',group,lambda xx,yy,zz:pigment('b69b71','e8d6ad',.49+.28*cos(6*atan2(yy-y,xx-x)+seed)+.17*n(xx,yy,zz,.49),1))
def cave():
    make_frame('karst-cave',['洞腔','滴水沉积'])
    def ceiling(x,y):return roof(x)+max(0,y-32)*.64+min(1,abs(y-32)/8)*(1.0*sin(y*.32+x*.07)+.62*n(x,y,4,.26))
    # A continuous vaulted roof with open front and closed piers.
    for part in ['soffit','top','cut','rearcut']:
        def at(u,v):
            x=8+84*u
            def low(y):return ceiling(x,y) if 10<=x<=90 else 2.3
            def high(y):return low(y)+4.7+2.1*sin(u*pi)+.57*n(x,y,1,.32)
            if part in ['cut','rearcut']:
                y=46.5 if part=='cut' else 5
                return (x,y,low(y)+(high(y)-low(y))*v)
            y=5+41.5*v
            return (x,y,(low(y) if part=='soffit' else high(y)))
        grid('溶蚀顶板 '+part,112,30 if part in ['soffit','top'] else 8,at,'limestone','arch',rockcolor)
    for x in [8,92]:
        grid('顶板侧端面',35,6,lambda u,v:(x,5+41.5*u,2.3+(4.7+.57*n(x,5+41.5*u,1,.32))*v),'limestone','arch',rockcolor)
    # Back wall is several centimetres behind the measured drops.
    def wall(u,v):
        x=8+84*u;z=3.5+(max(10,roof(x))-2.2)*v
        y=10+2.3*cos(x*.24+z*.09)+1.7*n(x,z,6,.22)+2.9*sin(v*2.8)
        return x,y,z
    grid('溶蚀纵沟与岩层后壁',104,50,wall,'limestone','back',
         lambda x,y,z:pigment('70624d','b99d78',.43+.30*sin(z*1.3+.064*x)+.26*n(x,y,z,.26),.82))
    grid('石灰岩洞底',88,36,lambda u,v:(8+84*u,3+44*v,4+chipped(8+84*u,3+44*v)*min(1,abs(3+44*v-32)/3)),
         'limestone','floor',rockcolor)
    # Thin low ledge hides pavers and makes the section at the front readable.
    grid('洞底剖切层',90,6,lambda u,v:(8+84*u,47,4*v+.12*n(u*84,v*4,3,.35)*v),'limestone','floor',rockcolor)
    seed=Random(68)
    for i in range(25):
        x=12+i*3.06;y=12+seed.random()*8
        column('洞顶固有流石',x,y,ceiling(x,y)+.73,1.9+seed.random()**1.9*8,1.3+seed.random()*1.5,True,'fixed',i)
    for i in range(15):
        x=15+i*4.8;y=12+seed.random()*6
        column('洞底固有流石',x,y,3.83,.8+seed.random()**1.5*5,1.1+seed.random()*1.1,False,'fixed',i)
    for x,y,count in [(22,24,9),(63,24,12),(80,23,7)]:
        for k in range(count):
            xx=x+k*.68;yy=y+.83*cos(k*1.4);roof_z=ceiling(xx,yy)+.62
            length=3.3+6.5*sin(pi*(k+.7)/(count+1))**1.4+seed.random()**2*3
            column('并生方解石帷幔',xx,yy,roof_z,length,.69+.30*seed.random(),True,'fixed',k*.5)
    for x,y,d in [(15,23,7.4),(76,18,9),(33,18,7)]:
        for j in range(5):
            column('边壁流石簇',x+j*.69,y+.5*cos(j*.8),3.86,2.4+d*sin(pi*(j+.8)/6),1.43,False,'fixed',j)
    # The front of the section is open to a low, broad raking light.
    bpy.ops.object.light_add(type='AREA',location=(44,59,21))
    lamp=bpy.context.object;lamp.name='洞口柔光反射板';lamp.data.shape='DISK';lamp.data.size=35;lamp.data.energy=43000
    lamp.data.color=(1,.86,.67);lamp.rotation_euler=(Vector((50,17,18))-lamp.location).to_track_quat('-Z','Y').to_euler()
    # Record active calcite shapes with a unit height. Their anchors and lengths
    # are restored from the same states in native keyframes and in WebGL.
    for i,x in enumerate([29,50,72]):
        column('钟乳石观察位',x,32,0,1,3.1,True,'top'+str(i),2+i)
        column('石笋观察位',x,32,0,1,3.35,False,'low'+str(i),5+i)
    for i in range(9):
        w.turning('滴水', (0,0),[(-.47,.055),(-.34,.36),(-.04,.44),(.28,.31),(.78,.035)],'water-blue','drop'+str(i),24)
def ground():
    make_frame('karst-livelihood',['覆被','侵蚀','涝旱','农林'])
    nx,ny=data['nx'],data['ny']
    def at(c):return lambda u,v:(3+94*u,1.5+51*v,sample(c,u,v))
    def lcolor(x,y,z):return pigment('716d5a','bab6a3',.43+.22*sin(z*1.91+.073*x)+.25*n(x,y,z,.22),.91+.17*n(x,y,z,.52))
    grid('峰丛与封闭洼地',nx,ny,at(0),'limestone','rock',lcolor)
    grid('可流失的薄层坡土',nx,ny,at(1),'mantle','soil',lambda x,y,z:pigment('776349','6d8156',clamp(.85-z*.015+.31*n(x,y,z,.22)),.92+.24*n(x,y,z,.63)))
    for edge in range(4):
        def wall(u,v):
            a,b=[(u,0),(u,1),(0,u),(1,u)][edge]
            return 3+94*a,1.5+51*b,sample(0,a,b)*v
        grid('石灰岩开挖剖面',92,19,wall,'limestone','rock',lcolor)
    # Branching fissure intersects the front section and drains the basin.
    w.curve('可见的渗漏裂隙',[(49,52.56,5.6),(50.8,52.6,4.1),(50.2,52.64,3.2),(52,52.64,1.65),(59.1,52.66,.75)],.12,'fissure')
    seed=Random(80)
    def tree(u,v,h,index,group,orchard=False):
        x,y=3+94*u,1.5+51*v;z=surface(u,v)
        w.shaft('坡地枝干',(x,y,z-.16),(x+.04*h,y,z+.68*h),.09*h,'root',group,8,tip=.042*h)
        pts=[];faces=[];colors=[]
        for j in range(13 if not orchard else 8):
            a=j*2.37;sz=(.25 if orchard else .22)*h*(.78+seed.random()*.62)
            spread=.32*h*sin(pi*(j+.6)/(14 if not orchard else 9))**.65
            cx=x+spread*cos(a);cy=y+spread*sin(a);cz=z+h*(1.13-.56*j/(13 if not orchard else 8))
            if j in [2,4,6,8,10]:
                w.shaft('分枝',(x,y,z+.41*h),(cx,cy,cz-.05*h),.029*h,'root',group,6,tip=.016*h)
            shade=.85+.18*seed.random()
            for vv in range(6):
                lat=-pi/2+pi*vv/5
                for uu in range(11):
                    angle=tau*uu/11;rad=sz*(1+.11*sin(3.3*angle+vv)+.13*seed.random())
                    pt=(cx+rad*cos(lat)*cos(angle),cy+rad*cos(lat)*sin(angle),cz+sz*sin(lat)*(.92 if orchard else 1.12))
                    pts.append(pt);colors.append(pigment('293e31','81905e',.24+.32*sin(lat)+.33*seed.random(),shade))
                    k=len(pts)-1-uu
                    if vv>0:
                        lo=k-11;faces.append((lo+uu,lo+(uu+1)%11,k+(uu+1)%11,k+uu))
        ob=w.mesh('经济林树冠' if orchard else '山地水源林冠',pts,faces,'leaf',group,True);w.paint(ob,colors)
    for edge in range(4):
        def soil_edge(u,v):
            x,y=[(u,0),(u,1),(0,u),(1,u)][edge];low=sample(0,x,y);high=max(low,sample(1,x,y))
            return 3+94*x,1.5+51*y,low+(high-low)*v
        grid('剖开薄土层',75,2,soil_edge,'mantle','soil',
             lambda x,y,z:pigment('755d42','8d7258',.52+.31*n(x,y,z,.52),.93))
    areas=[(.15,.33),(.25,.50),(.39,.20),(.58,.21),(.76,.31),(.83,.53),(.74,.78),(.22,.68)]
    for index,(a,b) in enumerate(areas):
        for j in range(7):
            u=clamp(a+.16*(seed.random()-.5));v=clamp(b+.23*(seed.random()-.5))
            tree(u,v,2.25+2.0*seed.random(),index,'trees'+str(index))
    for row in range(3):
        for col in range(5):
            u=.63+col*.024;v=.51+row*.043
            tree(u,v,1.25+.31*seed.random(),row*5+col,'orchard',True)
    for row in range(3):
        for col in range(3):
            u0=.368+col*.081;v0=.706+row*.068
            coords=[(u0,v0+.01),(u0+.072,v0),(u0+.077,v0+.055),(u0+.008,v0+.061)]
            field=[(3+94*u,1.5+51*v,surface(u,v)+.27) for u,v in coords]
            obj=w.mesh('顺地势分块的洼地田面',field,[(0,1,2,3)],'meadow' if (row+col)%3 else 'sediment','crops')
            w.curve('护土田埂',[(x,y,z+.08) for x,y,z in field],.17,'dark-timber','crops',True)
    for row in range(8):
        pts=[(3+94*u,1.5+51*v,surface(u,v)+.35) for i in range(15) for u,v in [(.37+i*.017,.73+row*.022+.008*sin(i*.28))]]
        w.curve('洼地农田垄作',pts,.32,'young-leaf','crops')
    # A flat water level cuts the irregular banks; a hidden disk never stands on edge.
    verts=[(0,0,0)]+[(cos(tau*i/80)*(1+.027*sin(i*.44)),sin(tau*i/80),0) for i in range(80)]
    w.mesh('洼地积水',verts,[(0,i+1,(i+1)%80+1) for i in range(80)],'water-blue','pool')
    for i in range(14):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.46+i%3*.06);w.register(bpy.context.object,'坡土颗粒','grain','packet'+str(i))

def setup_trial(id):
    groups={label for _,_,label in w.parts}
    pivots={g:w.join_movement(g,(0,0,0),g) for g in groups if g not in {'frame','floor','arch','fixed','rock','back'}}
    def position(g,xyz,frame,scale=None):
        pivot=pivots[g];pivot.location=xyz;pivot.keyframe_insert(data_path='location',frame=frame)
        if scale is not None:pivot.scale=scale;pivot.keyframe_insert(data_path='scale',frame=frame)
    def visible(g,value,frame):
        for ob in pivots[g].children:
            if frame!=1 and ob.get('shown')==int(value):continue
            ob['shown']=int(value)
            for prop in ('hide_render','hide_viewport'):
                setattr(ob,prop,not value);ob.keyframe_insert(data_path=prop,frame=frame)
    is_cave=id=='karst-cave'
    trialset=data['cave' if is_cave else 'relief']
    for selection,trial in enumerate(trialset):
        w.scene.timeline_markers.new((['洞腔','滴水沉积'] if is_cave else ['植被覆盖','侵蚀','雨涝晴旱','立体农业'])[selection],frame=selection*81+1)
        for i in range(len(trialset)):
            position('key'+str(i),(0,0,-.48 if i==selection else 0),selection*81+1)
        for tick,state in enumerate(trial):
            phase=state['phase'];frame=selection*81+tick+1
            position('cursor',(phase*(52 if is_cave else 68),0,0),frame)
            if is_cave:
                for i,site in enumerate(state['deposits']):
                    position('top'+str(i),(0,0,site['ceiling']),frame,(1,1,site['hanging']))
                    position('low'+str(i),(0,0,4),frame,(1,1,site['rising']))
                for d in state['drops']:
                    i=d['id'];g='drop'+str(i);site=state['deposits'][d['site']]
                    top=site['ceiling']-site['hanging'];floor=4+site['rising']
                    position(g,(100*d['u'],32,top+(floor-top)*d['progress']),frame);visible(g,d['visible'],frame)
            else:
                loss,wet=state['loss'],state['wet']
                position('soil',(0,0,-.81*loss),frame)
                for i in range(8):visible('trees'+str(i),i in (3,7) or loss < .16+.11*i,frame)
                visible('orchard',selection==3,frame);visible('crops',selection==3,frame)
                position('pool',(50,28.5,5.57+wet*.72),frame,(36,24,1));visible('pool',wet>.035,frame)
                for packet in state['particles']:
                    i,u,v=packet['id'],packet['u'],packet['v'];g='packet'+str(i)
                    position(g,(3+94*u,1.5+51*v,surface(u,v)-.31*loss+.44+.16*(i%3)*packet['retained']),frame)
                    visible(g,selection==1,frame)
    for g,piv in pivots.items():
        if piv.animation_data:
            for curve in piv.animation_data.action.fcurves:
                for k in curve.keyframe_points:k.interpolation='CONSTANT' if g.startswith('key') else 'LINEAR'
    w.scene.frame_end=len(trialset)*81
    w.scene.frame_set(112 if is_cave else 18)
for id,title,center,cam,span in [('karst-cave','滴水方解石洞剖面仪',(50,28,18),(-10,147,32),127),
                                  ('karst-livelihood','峰丛洼地农林观察器',(50,30,12),(-32,134,77),130)]:
    if '--' in sys.argv and id not in sys.argv[sys.argv.index('--')+1:]:continue
    w=Workshop(title,palette);cave() if id=='karst-cave' else ground()
    w.export(id,positive_depth=True)
    for obj,finish,g in w.parts:
        if finish in ['limestone','mantle','bare-loam']:
            apply_scan(obj.data.materials[0], 'outcrop' if finish=='limestone' else 'loam',18 if finish=='limestone' else 9)
    setup_trial(id)
    w.photograph(id,title,center,cam,span,-4.74)
