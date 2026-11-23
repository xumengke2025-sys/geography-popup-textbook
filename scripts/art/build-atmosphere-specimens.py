"""Heliothermal bench, exchangeable radiation receiver and a mountain/estuary specimen.
Blender coordinates are x, depth, elevation. The web lesson supplies its original ray and water states.
"""
import sys
from pathlib import Path
from math import pi, tau, exp, sin, cos, sqrt
from random import Random
import bpy
from mathutils import Vector, noise
sys.path.insert(0,str(Path(__file__).resolve().parent))
from fieldbook_workshop import Workshop, ROOT, linear_rgb
from water_workshop import FINISH, leveled_bed, reading_plate, sphere, machined_section
from earth_material import apply_scan

palette=FINISH|{
    'limestone':('rock','ffffff',0,.83),'cut-limestone':('rock','ffffff',0,.86),'earth':('land','ffffff',0,.91),
    'leaf':('plant','ffffff',0,.85),'secondary-leaf':('plant','ffffff',0,.89),'coastal-water':('water','ffffff',.04,.31),
    'trial-soil':('land','a98c67',0,.91),'cloud':('air','ffffff',0,.81),'shadows':('rock','685a4a',0,.84),
    'blackened':('enamel','4d4943',.15,.69),'silver':('steel','cabfa9',.80,.30),
    'amber':('enamel','e0a459',.06,.28),'mist':('air','adc7c3',.06,.45),
}
rng=Random(929)
def grid(name,nx,ny,pos,shade,finish,group):
    pts=[pos(i/nx,j/ny) for j in range(ny+1) for i in range(nx+1)]
    faces=[]
    for j in range(ny):
        for i in range(nx):
            k=j*(nx+1)+i;faces.append((k,k+1,k+nx+2,k+nx+1))
    ob=w.mesh(name,pts,faces,finish,group,True)
    if shade:w.paint(ob,[shade(*v) for v in pts])
    return ob
def value(x,y,z,span):
    return noise.noise_vector(Vector((x*span,y*span,z*span)))[0]
def blend(a,b,t):
    t=max(0,min(1,t));return tuple(v*(1-t)+q*t for v,q in zip(linear_rgb(a),linear_rgb(b)))
def axis(name,at,direction,profile,finish,group,closed=False):
    obj=w.turning(name,(0,0),profile,finish,group,48,closed)
    obj.rotation_euler=Vector(direction).to_track_quat('Z','Y').to_euler()
    obj.location=at
    return obj
def column(x,y,z,top,group='frame'):
    w.turning('铸铁台脚与黄铜柱座',(x,y),[(z,3.35),(z+.48,3.55),(z+.76,3.12),(z+1.38,2.61),
        (z+1.65,2.53),(z+2.30,1.63),(z+2.59,1.43),(top-2.4,1.04),(top-1.95,1.46),(top-1.18,1.48),(top-.89,1.13),(top,1.15)],'black-green',group,40)
    for h,r in [(z+.51,3.27),(z+2,1.88),(top-1.77,1.49)]:
        w.turning('切削铜环',(x,y),[(h,r),(h+.23,r+.05),(h+.36,r)],'burnished-brass',group,36)
def keybank(labels,xs,y,z,width):
    for i,(caption,x) in enumerate(zip(labels,xs)):
        name='key'+str(i)
        mark=reading_plate(w,caption,x,y,z,width,5.6,26,name)
        fontdata=bpy.data.curves.new(caption,'FONT')
        fontdata.body=caption;fontdata.font=font;fontdata.size=3.95;fontdata.resolution_u=4
        fontdata.align_x=fontdata.align_y='CENTER'
        obj=bpy.data.objects.new(caption,fontdata);w.scene.collection.objects.link(obj)
        xx,zz,yy=mark['at'];obj.location=(xx,yy,zz)
        obj.rotation_euler=(mark['angle'],0,pi)
        w.register(obj,caption,'scale-ink',name)
def slider(y,z):
    for dy in [-1.00,.96]:
        w.shaft('研磨钢导轨',(14.5,y+dy,z-1.15),(85.5,y+dy,z-1.15),.36,'steel','frame',18)
    for x in [13.5,86.5]:
        w.block('导轨固定座',(x,y,z-1.45),(2.35,4.25,2.6),'patinated-brass',.35)
    w.block('燕尾滑块',(15,y,z-1.12),(5.05,3.86,.98),'patinated-brass',.19,'cursor')
    w.turning('青瓷推进柄',(15,y),[(z-.68,.83),(z-.15,1.24),(z+.30,1.73),(z+1.05,1.71),(z+1.29,1.42)],'blue-enamel','cursor',40)
def store(id,title,center,cam,width):
    bpy.ops.object.camera_add(location=Vector(center)+Vector(cam));camera=bpy.context.object
    camera.rotation_euler=(Vector(center)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=width;w.scene.camera=camera
    for d,energy,tint,size in [((-40,70,80),105000,(1,.92,.78),75),((53,-36,50),63000,(.79,.86,1),52)]:
        bpy.ops.object.light_add(type='AREA',location=Vector(center)+Vector(d));lamp=bpy.context.object
        lamp.data.energy=energy;lamp.data.color=tint;lamp.data.size=size
        lamp.rotation_euler=(Vector(center)-lamp.location).to_track_quat('-Z','Y').to_euler()
    for ob,finish,group in w.parts:
        kind={'earth':'loam','trial-soil':'loam','limestone':'outcrop','cut-limestone':'outcrop','dark-timber':'walnut','shadows':'loam'}.get(finish)
        if kind and not ob.data.materials[0].get('earth_scan'):apply_scan(ob.data.materials[0],kind,{'loam':9,'outcrop':17,'walnut':23}[kind])
    graph=bpy.context.evaluated_depsgraph_get()
    for ob in list(w.scene.objects):
        if ob.type!='FONT':continue
        letters=bpy.data.meshes.new_from_object(ob.evaluated_get(graph))
        glyph=bpy.data.objects.new(ob.name+' 刻字网格',letters);w.scene.collection.objects.link(glyph)
        glyph.matrix_world=ob.matrix_world.copy();bpy.data.objects.remove(ob,do_unlink=True)
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.shading.color_type='MATERIAL'
    w.scene.world=bpy.data.worlds.new('收藏室环境');w.scene.world.color=(.19,.22,.21)
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'release/Blender/制作素材'/(title+'.blend')),compress=True)

def heat():
    # The ray starts at the polished aperture. A yoke under the optical barrel
    # turns about an actual trunnion instead of passing through the lens.
    base=(16,49,54); d=Vector((4,0,-5)).normalized()
    v=Vector(base)
    pivot=v-d*6.4
    column(pivot.x,27,-2.55,pivot.z)
    w.shaft('悬臂轴',(pivot.x,27,pivot.z),(pivot.x,43.05,pivot.z),.78,'steel','lamp',28)
    for y in [43.3,54.6]:
        w.shaft('叉耳支臂',(pivot.x-2.25,y,pivot.z-12.3),(pivot.x,y,pivot.z),.94,'patinated-brass','lamp',24)
        axis('光源俯仰耳轴',(pivot.x,y-.63,pivot.z),(0,1,0),[(0,1.85),(.33,2.13),(1.05,2.1),(1.28,1.5)],'bronze','lamp')
    w.shaft('叉架弯梁',(pivot.x-2.25,43.25,pivot.z-12.3),(pivot.x-2.25,54.6,pivot.z-12.3),.89,'patinated-brass','lamp',24)
    axis('黑漆集光器灯筒',base,d,[(-13,0),(-13,2.7),(-12.5,3.7),(-11.1,4.16),(-6,3.9),(-5.5,4.14),(-5.25,3.86),(-1.1,6.15),(-.22,6.46),(0,6.24),(-.21,5.74),(-5.3,2.87),(-10.6,2.65)],'black-green','lamp',True)
    axis('凹面集光反射碗',base,d,[(-5.6,.95),(-5.0,2.70),(-3.9,3.85),(-2.5,4.95),(-.48,5.87),(-.03,5.93),(.14,5.72),(-.35,5.52),(-2.31,4.65),(-3.62,3.60),(-4.74,2.49),(-5.2,.95)],'silver','lamp',True)
    for zz,rr in [(-11.5,4.22),(-6,4.14),(.0,6.48)]:
        axis('镜筒压圈',base,d,[(zz-.28,rr-.18),(zz-.13,rr+.1),(zz+.16,rr+.13),(zz+.34,rr-.12),(zz+.30,rr-.36),(zz-.28,rr-.36)],'burnished-brass','lamp',True)
    lamp=sphere(w,'太阳短波光源象征',v-d*2.1,1.67,'amber','lamp');lamp.scale.z=.88
    lo=lambda x:3.2+3.7*sin(pi*max(0,min(1,(x-4)/92)))**2
    for x in [34,66]:
        h=lo(x);w.turning('土面观测口薄圈',(x,49),[(h-.2,3.2),(h+.06,3.27),(h+.18,3.17),(h+.18,2.98),(h+.04,2.93),(h-.2,2.93)],'bronze','receiver',40,True)
        w.turning('黑化地面热响应试片',(x,49),[(h-.09,2.92),(h+.10,2.97),(h+.12,2.78)],'blackened','absorber-'+str(x),48)
    def sample(a,r):
        x=50+38.1*r*cos(a);y=39+16.15*r*sin(a)
        h=lo(x)+.20*value(x,y,2,.39)
        for cup in [34,66]:
            dist=sqrt((x-cup)**2+(y-49)**2)
            if dist<3.5:h=min(h,lo(cup)-.4+max(0,dist-2.9)*.65)
        return x,y,h
    # A shallow oval calorimeter exposes an actual soil core. A copper bath
    # encircles the core below its naturally rounded upper cut face.
    grid('椭圆吸收皿土样',64,20,lambda u,v:sample(tau*u,.001+.999*v),None,'trial-soil','sample-surface')
    def wall(u,v):
        x,y,h=sample(tau*u,1)
        return x,y,1.75+(h-1.75)*v
    grid('土样剖缘',82,8,wall,lambda x,y,z:blend('756049','b09471',.47+.29*sin(z*4+x*.06)+.19*value(x,y,z,.39)),'earth','heat-bed')
    pan=w.turning('铜制土样热吸收皿',(0,0),[(-.42,26),(-.24,31),(.35,34.3),(.87,36.6),(1.70,38.12),(2.5,38.83),(2.87,38.75),(3.02,38.45),(2.84,38.03),(2.36,38.1),(1.69,37.4),(.96,35.4),(.56,32.5),(.64,26)],'patinated-brass','basin',80,True)
    pan.location=(50,39,0);pan.scale.y=16.15/38.1
    for x in [32,68]:
        w.turning('皿底铸铁鞍座',(x,39),[(-2.6,3.63),(-2.1,3.72),(-1.85,3.4),(-1.5,2.42),(-.78,2.14),(-.29,2.8),(.1,3.03)],'black-green','basin',40)
    leveled_bed(w,(50,37.7),(97.8,55.3),-2.5)
    kb=w.block('四档观察键座',(50,59.2,-1.47),(89,7.1,2.40),'dark-timber',.52)
    kb.rotation_euler.x=-26*pi/180
    keybank(['短波','地面','长波','大气'],[18,39.3,60.7,82],60,.28,18.3)
    # Ribbed black absorber and open-air thermometer bulb are parts of the demonstration,
    # mounted behind the scientific ray plane to keep its tip visible.
    for x,z,y in [(34,8.8,24),(82.9,25.4,24)]:
        w.turning('通风感温罩',(x,y),[(z-3.32,.94),(z-3,1.08),(z-1.72,.75),(z-.8,.57),(z,.45)],'silver','probe',28)
    for y in [19.7,23.8]:
        w.curve('开敞空气探头夹',[(83,y,24.1),(85.1,y,25.3),(86,y,28.2),(85.6,y,30.3)],.24,'patinated-brass','probe')
    w.export('heating',positive_depth=True)
    # Assemble the native reference bed, indicators and manual track after exporting the adjunct geometry.
    slider(68,-12)
    for x,y,z in [(34,23,9.7),(83,23,27)]:
        axis('相对读数表盘',(x,y,z),(0,1,0),[(-1.3,3.0),(-1.12,3.48),(0,3.58),(.2,3.36)],'patinated-brass','native')
        axis('白瓷刻度面',(x,y+.21,z),(0,1,0),[(0,3.06),(.20,3.06)],'ivory','native')
        w.curve('相对指针',[(x,y+.46,z),(x+1.1,y+.46,z+2)],.13,'scale-ink','native')
    store('heating','短长波受热试验台',(49,38,26),(39,125,70),121)

def greenhouse():
    # The same source and soil patch persist. The rear slide guides locate either
    # an empty field or a removable open atmospheric comparison cassette.
    for x in [42,69]:
        column(x,10,-.67,32.4)
        w.curve('抽板导轨',[(x,8.7,33.2),(x,34.5,33.2)],.34,'steel','frame')
        axis('后端止挡',(x,9,33.25),(0,1,0),[(-.72,.83),(.53,.83),(.75,.56)],'patinated-brass','frame')
    # Fixed locators and rim leave the centre, where longwave arrives, open.
    for group,y in [('medium',33),('empty',13.4)]:
        w.turning('可替换介质环框',(55.4,y),[(33.0,11.75),(33.2,12.0),(33.86,12.0),(34.18,11.68),(34.18,10.82),(33.92,10.6),(33.0,10.6)],'patinated-brass',group,64,True)
        for x in [42.3,68.5]:
            w.block('介质抽板导套',(x,y,33.18),(3.15,5.2,1.0),'black-green',.23,group)
        w.curve('抽板铜把手',[(65.7,y+5.7,33.6),(68.9,y+6.45,33.6),(69.82,y+6.45,34.27),
            (69.82,y+9.6,34.27),(69.3,y+10.25,33.8),(64.5,y+8.8,33.6)],.34,'burnished-brass',group)
    # Thin mesh crossbars indicate the plane of observation, not an actual mirror.
    for y in [-6.5,0,6.5]:
        length=sqrt(10.6**2-y*y)
        w.curve('观察丝线',[(55.4-length,33+y,33.72),(55.4+length,33+y,33.72)],.047,'silver','medium')
    for x in [29,68]:
        w.turning('黑化圆盘备样座',(x,33),[(2.62,4.8),(2.96,5.15),(3.24,5.15),(3.39,4.7),(3.39,4.09),(3.25,4.08),(2.62,4.08)],'bronze','stages',48,True)
        for a in [0,tau/3,2*tau/3]:
            w.screw(x+4.56*cos(a),33+4.56*sin(a),3.46,.45,'stages')
    slider(64,3)
    w.export('greenhouse',positive_depth=True)
    leveled_bed(w,(56,38),(102,66),-.7,'native')
    w.block('地面辐射试样',(51,34,1.07),(84,35,3.67),'shadows',.4,'native')
    for x in [29,68]:
        w.turning('黑化地面接收盘',(x,33),[(3.10,3.75),(3.62,3.82),(3.73,3.31)],'blackened','native',48)
    d=Vector((19,8,-45)).normalized()
    axis('入射光源',(10,25,49),d,[(-9,2.87),(-8.55,3.25),(-1.3,3.12),(0,3.76),(0,2.47),(-2.8,2.24)],'patinated-brass','native',True)
    column(8,16,-.67,53.3)
    for ob,finish,group in w.parts:
        if group=='empty':ob.hide_render=True;ob.hide_set(True)
    store('greenhouse','可换介质长波辐射比较器',(54,37,22),(43,145,80),120)

def estuary():
    coast=67.0
    def river_y(x):return 13.2+.435*(x-7)+3.3*sin((x-12)*.119)+.75*sin(x*.27)
    def core(x):return 1.8+12.1*max(0,min(1,(coast-x)/57))**1.22
    def land(x,y):
        center=river_y(x);dist=abs(y-center)
        peaks=14.0*exp(-((x-20)/9)**2-((y-18)/10)**2)+6.7*exp(-((x-32)/9)**2-((y-39)/11)**2)+3*exp(-((x-12)/6)**2-((y-43)/9)**2)
        ridges=1.6+peaks+1.25*value(x,y,2,.15)+.49*value(x,y,2,.46)
        bank=(1-exp(-(dist/3.7)**1.7))*max(0,min(1,(coast-x)/15))
        return core(x)+bank*max(.18,ridges)
    def color(x,y,z):
        slope=abs(land(x+.22,y)-land(x-.22,y))/.44
        wet=abs(y-river_y(x)); q=value(x,y,z,.27)
        if slope>1.14 or z>20.5:
            return blend('675f56','b0a48c',.55+q*.47+.16*sin(z*3.4-x*.08))
        if x>59 or wet<2.6:return blend('938064','b8aa82',.5+.37*q)
        return blend('63734d','9c9b70',.45+.54*q+.19*sin(y*.08))
    top=grid('山脊、冲沟、河漫滩与入海口',112,63,lambda u,v:(5+62*u,9+41*v,land(5+62*u,9+41*v)),color,'limestone','landform')
    # Facies for the triplanar scan follow shore sediment, exposed strata and vegetation.
    facies=top.data.color_attributes.new(name='facies',type='FLOAT_COLOR',domain='POINT')
    for idx,vertex in enumerate(top.data.vertices):
        x,y,z=vertex.co;bank=abs(y-river_y(x));bare=max(0,min(1,(abs(land(x+.25,y)-land(x-.25,y))*2-0.65)*1.45 + (z-20)*.13))
        gravel=max(0,min(1,(3.2-bank)*.68+(x-58)*.11))*(1-bare)
        grass=.83*(1-bare-gravel)
        facies.data[idx].color=(bare,gravel,grass,1)
    for end in ['front','back','left','coast']:
        def section(u,v):
            x,y={'front':(5+62*u,50),'back':(5+62*u,9),'left':(5,9+41*u),'coast':(67,9+41*u)}[end]
            return x,y,-2+(land(x,y)+2)*v
        def pigment(x,y,z):
            d=land(x,y)-z
            if d<1.35+.29*sin(x*.74+y*.16):return blend('685a46','a08b69',.50+.28*value(x,y,z,.48))
            return blend('776e5d','b2a28a',.52+.31*sin(2.3*z+.063*x+.12*y+.45*sin(x*.35))+.19*value(x,y,z,.41))
        grid('层理崖壁 '+end,89,14,section,pigment,'cut-limestone','cutwall')
    river=[]
    for i in range(57):
        x=10+60*i/56;y=river_y(x);z=core(x)+.18;river.append((x,y,z))
    def ribbon(u,v):
        x=10+60*u;width=(.52+1.42*u**1.18)*min(1,.22+u*16)
        return (x,river_y(x)+(v-.5)*2*width,core(x)+.206+.045*sin(x*1.8+v*8))
    grid('穿山河道与入海口',112,9,ribbon,lambda x,y,z:blend('477b77','a0c1b0',.43+.25*sin(x*.62+.19*y)+.21*value(x,y,z,.44)),'coastal-water','estuary')
    def estuary_pt(u,v):return (66.85+28.95*u,9+41*v,1.96+.09*sin(v*37+u*11)+.08*sin(u*32-v*20))
    grid('海湾水面',53,55,estuary_pt,lambda x,y,z:blend('477d82','94b4a1',.68-(x-67)*.009+.12*sin(y*2.4+x*1.03)),'coastal-water','estuary')
    for x0,x1,y0,y1 in [(66.88,95.8,50,50),(95.8,95.8,9,50),(66.88,95.8,9,9)]:
        grid('水体厚度',39,2,lambda u,v:(x0+(x1-x0)*u,y0+(y1-y0)*u,-1.98+3.95*v),lambda x,y,z:blend('547d7c','8fae99',.41+.14*z),'coastal-water','estuary')
    def tree(x,y,h,name):
        bottom=land(x,y);color=[];vertices=[];faces=[]
        w.shaft('溪谷树干',(x,y,bottom-.08),(x+.03*h,y,bottom+.67*h),h*.059,'bark',name,9,h*.027)
        # Each branch carries sprays of small folded leaves. Gaps between
        # sprays retain visible wood and individual leaf silhouettes in close-up.
        for i in range(17):
            ang=2.40*i;level=i/17
            radius=h*(.08+.28*sin(pi*(level+.03))**.86)
            fork=Vector((x+radius*cos(ang),y+radius*sin(ang),bottom+h*(1.02-.47*level)))
            start=(x+.035*h,y,bottom+h*(.60-.29*level))
            w.shaft('树冠分枝',start,fork,h*.024,'bark',name,7,h*.005)
            for j in range(4):
                angle=ang+(j-1.5)*.64
                twig=fork+Vector((cos(angle)*h*.105,sin(angle)*h*.105,h*(.03+.062*rng.random())))
                w.shaft('结果枝',fork,twig,h*.008,'bark',name,6,h*.003)
                for k in range(13 if name=='tree' else 7):
                    direction=rng.random()*tau
                    base=twig+Vector(((rng.random()-.5)*h*.16,(rng.random()-.5)*h*.17,(rng.random()-.46)*h*.14))
                    length=h*(.048+.042*rng.random())
                    along=Vector((cos(direction),sin(direction),rng.uniform(-.46,.47)))*length
                    side=Vector((-sin(direction),cos(direction),0))*length*.31
                    mid=base+along*.48
                    pts=[base,mid+side,mid+Vector((0,0,length*.14)),mid-side,base+along]
                    lo=len(vertices);vertices.extend(pts)
                    for a,b,c in [(0,2,1),(0,3,2),(1,2,4),(2,3,4)]:
                        faces.append((lo+a,lo+b,lo+c))
                    tint=rng.random()*.48+.17+.15*cos(direction)
                    color.extend([blend('334a34','a0ad71',tint+q) for q in [0,.09,.22,.04,.15]])
        obj=w.mesh('枝叶簇',vertices,faces,'leaf' if name=='tree' else 'secondary-leaf',name,True);w.paint(obj,color)
    x0,y0=36,39;tree(x0,y0,15,'tree')
    for x,y,h in [(12,31,4.0),(16,37,4.75),(22,17,4.1),(27,13,3.6),(30.5,32,3.5),(43,45,4.4),(47,42,3.5),(53,34,2.5),(58,28,2.0)]:
        if abs(y-river_y(x))>2.5:tree(x,y,h,'woodland')
    tree_base=[x0,y0,land(x0,y0)]
    soil_at=[x0,50.25,land(x0,50)*.46]
    for i in range(8):
        dx=(i-3.5)*.86
        w.curve('冲积土层分叉的树根',[(x0,y0,tree_base[2]+.16),(x0+.23*dx,42,tree_base[2]-1.4),(x0+.58*dx,47,soil_at[2]+1.5),(x0+dx,50.28,soil_at[2]+.37*sin(i*2.5)),(x0+1.27*dx,50.31,soil_at[2]-1.2)],.078+.065*(i%3==0),'bark','roots')
    # One underslung bracket holds a sculpted cloud without an opaque atmosphere box.
    cloud_at=(49,20,36)
    column(51,9.15,-1.8,35.6)
    w.shaft('云样后悬臂',(51,9.15,35.55),(49,20,35.5),.27,'steel','frame',20)
    def cloud(u,v):
        angle=tau*u;lat=pi*(v-.5);rr=1+.16*sin(5*angle+.7*sin(3*lat))+.10*sin(3*lat+2*angle)+.07*sin(10*angle-lat)
        return 49+8.6*rr*cos(lat)*cos(angle),20+4.0*rr*cos(lat)*sin(angle),36+rr*sin(lat)*(3.55 if lat>0 else 1.74)
    grid('层积云石膏标本',55,25,cloud,lambda x,y,z:blend('adbaaf','f2eedb',(z-33.06)/5+.065*value(x,y,z,.6)),'cloud','cloud')
    leveled_bed(w,(50.2,38.4),(96.7,63),-2.12)
    keybank(['圈层联系','水的迁移','生物联系'],[21.2,50,78.8],55.4,.96,23.7)
    slider(64,3)
    extra={'river':[[round(x,4),round(z,4),round(y,4)] for x,y,z in river],
           'treeBase':[tree_base[0],round(tree_base[2],4),tree_base[1]],'soilAt':[soil_at[0],round(soil_at[2],4),soil_at[1]],'canopy':[37,round(tree_base[2]+14.4,4),39]}
    w.export('external-spheres',extra=extra,positive_depth=True)
    apply_scan(top.data.materials[0],'valley',14)
    store('external-spheres','山河入海圈层交换标本',(50,34,16),(47,145,84),116)

for id,title,fn in [('heating','短长波受热试验台',heat),('greenhouse','可换介质长波辐射比较器',greenhouse),('external-spheres','山河入海圈层交换标本',estuary)]:
    if '--' in sys.argv and id not in sys.argv[sys.argv.index('--')+1:]:continue
    w=Workshop(title,palette);font=bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc')
    fn()

