"""Build the paired solar and terrestrial specimens of a teaching instrument."""
import base64
from array import array
import json
from math import cos, sin, pi, radians
from pathlib import Path

import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = '日地扰动演示仪'
palette = {
    'walnut': ('wood', '513120', .05, .40),
    'cast': ('enamel', '263f38', .30, .36),
    'brass': ('brass', 'a78045', .86, .34),
    'edge': ('brass', 'd7b779', .86, .23),
    'steel': ('steel', '9da9a2', .86, .29),
    'copper': ('brass', 'bd7847', .77, .34),
    'ivory': ('ivory', 'e3d7ac', .05, .44),
    'ink': ('enamel', '29312e', .05, .49),
    'sea': ('enamel', '40676c', .27, .28),
    'land': ('brass', 'c3a772', .65, .42),
}
materials = {}
def linear(v):
    v = int(v,16)/255
    return ((v+.055)/1.055)**2.4 if v>.04045 else v/12.92

for key, (role,h,metal,rough) in palette.items():
    m=bpy.data.materials.new(key)
    m.diffuse_color=tuple(linear(h[i:i+2]) for i in (0,2,4))+(1,)
    m.use_nodes=True
    nodes=m.node_tree.nodes
    link=m.node_tree.links.new
    shader=nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value=m.diffuse_color
    shader.inputs['Metallic'].default_value=metal
    shader.inputs['Roughness'].default_value=rough
    if role in ('wood','brass'):
        coord=nodes.new('ShaderNodeTexCoord')
        direction=nodes.new('ShaderNodeVectorMath');direction.operation='MULTIPLY'
        direction.inputs[1].default_value=(1.2,27,12) if role=='wood' else (4,4,4)
        grain=nodes.new('ShaderNodeTexNoise');grain.inputs['Scale'].default_value=3;grain.inputs['Detail'].default_value=3
        ramp=nodes.new('ShaderNodeValToRGB')
        for stop,factor in zip(ramp.color_ramp.elements,[.50,1.25]):
            stop.color=tuple(min(1,c*factor) for c in m.diffuse_color[:3])+(1,)
        link(coord.outputs['Generated'],direction.inputs[0]);link(direction.outputs[0],grain.inputs[0])
        link(grain.outputs['Fac'],ramp.inputs[0]);link(ramp.outputs[0],shader.inputs['Base Color'])
    materials[key]=m

components=[]
def register(obj,name,finish,group='frame'):
    obj.name=name
    obj.data.materials.append(materials[finish])
    components.append((obj,finish,group))
    return obj

def box(name,xyz,size,finish,bevel=.15,group='frame'):
    bpy.ops.mesh.primitive_cube_add(size=1,location=xyz)
    o=bpy.context.object;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=o.modifiers.new('手工倒角','BEVEL');mod.width=bevel;mod.segments=3
    o.modifiers.new('平面法线','WEIGHTED_NORMAL')
    return register(o,name,finish,group)

def rod(name,a,b,r,finish,group='frame',vertices=32):
    axis=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=axis.length,location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object;o.rotation_euler=axis.to_track_quat('Z','Y').to_euler()
    for f in o.data.polygons: f.use_smooth=len(f.vertices)==4
    return register(o,name,finish,group)

def profile(name,x,y,points,finish,group='frame',n=64):
    verts=[(x+r*cos(i*2*pi/n),y+r*sin(i*2*pi/n),z) for z,r in points for i in range(n)]
    faces=[(j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i) for j in range(len(points)-1) for i in range(n)]
    faces.extend([tuple(reversed(range(n))),tuple(range(len(verts)-n,len(verts)))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
    for f in mesh.polygons: f.use_smooth=len(f.vertices)==4
    return register(obj,name,finish,group)

def tube(name,points,r,finish,group='frame',cyclic=False):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;c.resolution_u=1
    spl=c.splines.new('POLY');spl.points.add(len(points)-1)
    for v,co in zip(spl.points,points):v.co=(*co,1)
    spl.use_cyclic_u=cyclic
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o)
    return register(o,name,finish,group)

def sphere(name,at,r,finish,group):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=32,radius=r,location=at)
    obj=bpy.context.object
    for face in obj.data.polygons:face.use_smooth=True
    return register(obj,name,finish,group)

def face_ring(name,x,y,z,r,wire,finish,group='frame'):
    return tube(name,[(x+r*cos(i*pi/48),y,z+r*sin(i*pi/48)) for i in range(96)],wire,finish,group,True)

def screw(x,y,z):
    rod('沉头螺钉',(x,y,z),(x,y,z+.23),.48,'edge',vertices=20)
    box('一字槽',(x,y,z+.24),(.61,.092,.04),'ink',.02)

for x in [7,88]:
    for y in [-7.6,7.6]:
        profile('调平螺足',x,y,[(-2.8,1.8),(-2.5,2.1),(-2,2.1),(-1.7,1.5),(-.2,1.3)],'brass')
box('胡桃木座', (47.5,0,-.1),(91,20.5,3.1),'walnut',1.1)
box('底缘嵌铜线',(47.5,0,-1.1),(91.2,20.6,.32),'edge',.14)
box('床身暗绿铸件',(47.5,0,1.55),(89,19.1,1.7),'cast',.53)
for x,rr,group in [(16,12,'sun'),(79,11,'earth')]:
    top=23-rr
    profile('回转支座',x,0,[(1.4,5.1),(2.6,5.1),(3,4.8),(3.35,4.8),(3.55,3.8),(4.5,3.6),(5,3.15),(5.2,2.25),(top-2,1.8),(top-1.4,2.35),(top,2.35)],'brass','support-'+group)
    for y in [-4.2,4.2]: screw(x,y,2.7)
    # The fork carries the ball on two side bearings, leaving the field lines clear.
    r=rr+1.4
    for off in [-.58,.58]:
        a=[radians(177+i*186/88) for i in range(89)]
        tube('双缘子午托圈',[(x+r*cos(t),off,23+r*sin(t)) for t in a],.49,'edge')
    for sign in [-1,1]:
        rod('横轴轴肩',(x+sign*(rr-.2),0,23),(x+sign*(r+.8),0,23),1.0,'steel')
        rod('轴端压盖',(x+sign*r,0,23),(x+sign*(r+.88),0,23),1.62,'brass')
    sphere('太阳球壳' if group=='sun' else '地球珐琅胎',(x,0,23),rr,'brass' if group=='sun' else 'sea',group)
    for lat in ([-52,-28,0,28,52] if group=='sun' else [-55,-30,0,30,55]):
        a=radians(lat); radius=rr+.06
        tube('纬圈嵌丝',[(x+radius*cos(a)*cos(t*pi/48),radius*cos(a)*sin(t*pi/48),23+radius*sin(a)) for t in range(96)],.075,'copper' if group=='sun' else 'edge',group,True)
    if group=='sun':
        for k in range(12):
            phi=k*pi/6
            pts=[]
            for i in range(65):
                a=-pi/2+i*pi/64
                ang=phi+.15*sin(2*a)
                pts.append((x+(rr+.04)*cos(a)*cos(ang),(rr+.04)*cos(a)*sin(ang),23+(rr+.04)*sin(a)))
            tube('铜刻日面经线',pts,.085,'copper',group)
# Twin guides, end bearings and a travelling vernier at the reader-facing edge.
for y in [-8.8,-6.6]:
    rod('磨亮钢轨',(9,y,4),(87,y,4),.42,'steel')
    for x in [8,87]:box('导杆轴承座',(x,y,3.65),(2.6,2,2.6),'brass',.36)
box('线性刻度嵌条',(47.5,-5,2.62),(73,1.75,.35),'ivory',.14)
for i in range(41):
    length=1.25 if i%5==0 else .63
    box('刻线',(12.5+1.75*i,-5.65+length/2,2.81),(.10,length,.04),'ink',.01)
box('游标滑座',(12.5,-7.7,4.75),(5.2,3.9,1.45),'brass',.45,'slide')
box('游标墨线',(12.5,-6.25,5.50),(.22,1.35,.08),'ink',.02,'slide')
profile('滚花钮',12.5,-8.1,[(5.4,.95),(5.85,.9),(6.08,1.54),(6.9,1.54),(7.15,1.34)],'edge','slide',36)
for i in range(24):
    a=i*pi/12
    rod('滚花齿',(12.5+1.54*cos(a),-8.1+1.54*sin(a),6.15),(12.5+1.54*cos(a+.075),-8.1+1.54*sin(a+.075),6.84),.085,'brass','slide',8)
# An analogue position indicator repeats the slider reading, without giving
# the explanatory timeline fictitious physical units.
cx=47.5
box('仪表脚',(cx,1,3.5),(13,7,2.6),'cast',.7)
rod('仪表壳',(cx,-2.0,9),(cx,2.5,9),7.1,'brass',vertices=80)
rod('珐琅刻度盘',(cx,-2.24,9),(cx,-2,9),6.45,'ivory',vertices=80)
face_ring('抛光表圈',cx,-2.3,9,6.64,.36,'edge')
for i in range(25):
    a=radians(210-10*i);inner=4.85 if i%4==0 else 5.56
    rod('仪表分度',(cx+inner*cos(a),-2.34,9+inner*sin(a)),(cx+6.08*cos(a),-2.34,9+6.08*sin(a)),.10,'ink',vertices=8)
a=radians(210)
rod('烤蓝指针',(cx-.8*cos(a),-2.53,9-.8*sin(a)),(cx+5.35*cos(a),-2.53,9+5.35*sin(a)),.23,'cast','pointer',14)
rod('表针轴帽',(cx,-2.94,9),(cx,-2.47,9),.69,'brass')
for x in [5,90]:
    for y in [-7,7]: screw(x,y,2.4)
# Lead screw and handwheel share the same axis and pitch as the travelling nut.
pitch=4.375
rod('丝杠芯轴',(7,-7.7,4),(94,-7.7,4),.52,'steel','drive')
tube('连续螺旋牙',[(10+i*.1,-7.7+.56*cos(2*pi*i*.1/pitch),4+.56*sin(2*pi*i*.1/pitch)) for i in range(771)],.19,'brass','drive')
for x in (8,87):
    box('丝杠止推轴承座',(x,-7.7,3.6),(2.6,5.4,3.1),'cast',.35)
    rod('轴承油封',(x-.2,-7.7,4),(x+1.6,-7.7,4),1.13,'brass')
wheelx=94
wheelr=3.7
tube('车削手轮外缘',[(wheelx,-7.7+wheelr*cos(i*pi/48),4+wheelr*sin(i*pi/48)) for i in range(96)],.55,'edge','drive',True)
for j in range(3):
    a=j*2*pi/3
    tube('弧形轮辐',[(wheelx,-7.7+(1+2.7*t/16)*cos(a+.32*t/16),4+(1+2.7*t/16)*sin(a+.32*t/16)) for t in range(17)],.28,'brass','drive')
rod('轮毂',(92.8,-7.7,4),(94.6,-7.7,4),1.12,'brass','drive')
rod('手轮柄轴',(94,-7.7+3.65,4),(96.35,-7.7+3.65,4),.30,'steel','drive')
rod('乌木握柄',(95,-7.7+3.65,4),(97,-7.7+3.65,4),.67,'walnut','drive')

def dial_text(body,x,z,size):
    c=bpy.data.curves.new('盘面印字','FONT');c.body=body;c.align_x='CENTER';c.align_y='CENTER';c.size=size;c.extrude=.012
    o=bpy.data.objects.new(body,c);scene.collection.objects.link(o);o.location=(x,-2.38,z);o.rotation_euler.x=pi/2
    register(o,'刻字 '+body,'ink')
for angle,label in [(210,'0'),(150,'25'),(90,'50'),(30,'75'),(-30,'100')]:
    a=radians(angle);dial_text(label,cx+4.35*cos(a),9+4.35*sin(a),1.12)
dial_text('%',cx,6.8,1.6)
from mathutils.geometry import tessellate_polygon
out=root/'src/assets/solar-instrument'
coords,faces=[],[]
def shell_triangle(a,b,c,depth):
    if depth and max((a-b).length,(b-c).length,(c-a).length)>9:
        tri=[a,b,c]
        i=max(range(3),key=lambda j:(tri[j]-tri[(j+1)%3]).length)
        a,b,c=tri[i],tri[(i+1)%3],tri[(i+2)%3]
        mid=(a+b)/2
        shell_triangle(a,mid,c,depth-1)
        shell_triangle(mid,b,c,depth-1)
    else:
        face=[]
        for pt in [a,b,c]:
            lon=radians(pt.x+18);lat=radians(pt.y);r=11.14
            face.append(len(coords));coords.append((79+r*sin(lon)*cos(lat),-r*cos(lon)*cos(lat),23+r*sin(lat)))
        u,v,w=(Vector(coords[j]) for j in face)
        if (v-u).cross(w-u).dot(u-Vector((79,0,23)))<0:face.reverse()
        faces.append(face)
for outline in json.loads((out/'coastlines.json').read_text()):
    poly=[Vector((lon,lat,0)) for lon,lat in outline]
    for tri in tessellate_polygon([poly]): shell_triangle(*(poly[j] for j in tri),12)
me=bpy.data.meshes.new('浅浮雕大陆');me.from_pydata(coords,[],faces);me.update()
o=bpy.data.objects.new('大陆',me);scene.collection.objects.link(o)
register(o,'蚀刻大陆轮廓','land','earth')
# Use joined vertex normals on the curved relief, including the globe silhouette.
for poly in me.polygons:poly.use_smooth=True
me.normals_split_custom_set_from_vertices([(v.co-Vector((79,0,23))).normalized() for v in me.vertices])

# Preserve individually named, editable Blender objects. Batch the evaluated
# mesh by material and movement for the small real-time version.
bpy.context.view_layer.update()
deps=bpy.context.evaluated_depsgraph_get()
batches={}
for obj,finish,group in components:
    evaluated=obj.evaluated_get(deps)
    mesh=evaluated.to_mesh()
    mesh.calc_loop_triangles()
    matrix=evaluated.matrix_world
    norm=matrix.to_3x3().inverted().transposed()
    verts,indices,lookup=batches.setdefault((group,finish),([],[],{}))
    for tri in mesh.loop_triangles:
        for corner in tri.loops:
            p=matrix@mesh.vertices[mesh.loops[corner].vertex_index].co
            n=(norm@mesh.corner_normals[corner].vector).normalized()
            key=tuple(round(a*100) for a in (p.x,p.z,-p.y))+tuple(round(a*127) for a in (n.x,n.z,-n.y))
            if key not in lookup:lookup[key]=len(verts);verts.append(key)
            indices.append(lookup[key])
    evaluated.to_mesh_clear()
def pack(code,seq):return base64.b64encode(array(code,seq).tobytes()).decode()
data=[]
for (group,finish),(verts,indices,_) in batches.items():
    assert len(verts)<65536
    role,color,*_=palette[finish]
    data.append(dict(group=group,finish=role,color='#'+color,p=pack('h',(v for row in verts for v in row[:3])),n=pack('b',(v for row in verts for v in row[3:])),i=pack('H',indices)))
(out/'instrument.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf8')

# Mechanical controls in the source file are keyed to the same 0–1 observation.
for group,pivot in [('slide',(12.5,-7.7,4)),('pointer',(cx,-2.53,9)),('drive',(0,-7.7,4))]:
    parent=bpy.data.objects.new('读数游标' if group=='slide' else ('丝杠轴' if group=='drive' else '指针转轴'),None);scene.collection.objects.link(parent)
    parent.location=pivot;bpy.context.view_layer.update()
    for obj,_,g in components:
        if g!=group:continue
        world=obj.matrix_world.copy();obj.parent=parent;obj.matrix_world=world
    path='location' if group=='slide' else 'rotation_euler'
    parent.keyframe_insert(data_path=path,frame=1)
    if group=='slide':parent.location.x+=70
    elif group=='pointer':parent.rotation_euler.y=radians(240)
    else:parent.rotation_euler.x=-32*pi
    parent.keyframe_insert(data_path=path,frame=101)
    for fc in parent.animation_data.action.fcurves:
        for key in fc.keyframe_points:key.interpolation='LINEAR'
scene.frame_end=101;scene.frame_set(55)
scene.world=bpy.data.worlds.new('摄影棚');scene.world.color=(.28,.28,.28)
bpy.ops.mesh.primitive_plane_add(size=2000,location=(45,0,-2.82))
floor=bpy.context.object;floor.name='摄影台面'
mat=bpy.data.materials.new('深色绒面');mat.diffuse_color=(.024,.031,.029,1);floor.data.materials.append(mat)
target=Vector((47,0,13))
def light(name,loc,size,power,tint):
    bpy.ops.object.light_add(type='AREA',location=loc)
    obj=bpy.context.object;obj.name=name;obj.data.energy=power;obj.data.shape='DISK';obj.data.size=size;obj.data.color=tint
    obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
light('左侧大柔光箱',(14,-42,78),62,85000,(1,.89,.73))
light('右后轮廓光',(90,26,58),48,85000,(.74,.87,1))
light('正面反光板',(55,-62,28),42,35000,(1,.95,.85))
bpy.ops.object.camera_add(location=(83,-151,76))
cam=bpy.context.object;cam.name='仪器全貌';cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=103;cam.data.clip_end=1500;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX';prefs.refresh_devices()
for dev in prefs.devices:dev.use=dev.type=='OPTIX'
scene.cycles.device='GPU' if any(d.use for d in prefs.devices) else 'CPU'
scene.render.resolution_x=1440;scene.render.resolution_y=810;scene.render.resolution_percentage=100
for a in bpy.context.screen.areas:
    if a.type=='VIEW_3D':a.spaces.active.region_3d.view_perspective='CAMERA'
scene.render.filepath=str(root/'work/solar-instrument-studio.png')
bpy.ops.wm.save_as_mainfile(filepath=str(root/'release/Blender/制作素材/日地扰动演示仪.blend'),compress=True)
bpy.ops.render.render(write_still=True)
print('EXPORTED',len(components),'editable parts',len(data),'web batches')
