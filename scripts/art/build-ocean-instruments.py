"""Author three water specimens using exact samples from the textbook models."""
import json
from math import ceil, cos, exp, pi, sin
from pathlib import Path
import sys

import bpy
from mathutils import Vector, noise

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldbook_workshop import Workshop, ROOT, linear_rgb
from earth_material import apply_scan

PALETTE = {
    'blue-glass': ('water', 'ffffff', .08, .26),
    'shore-pigment': ('rock', 'ffffff', 0, .79),
    'water-cyan': ('water', '659fa1', .08, .24),
    'sea-trace': ('enamel', 'bfd9cf', .07, .45),
    'blue-green': ('enamel', '37656b', .11, .30),
    'copper-point': ('brass', 'bd7541', .83, .33),
    'copper-band': ('enamel', 'a25a45', .13, .38),
    'rib-wood': ('wood', 'a17b50', .03, .39),
    'keel-wood': ('wood', '5f4433', .035, .39),
    'japanned-iron': ('enamel', '253b33', .16, .30),
    'cast-brass': ('brass', '87623b', .84, .39),
    'polished-brass': ('brass', 'cba468', .88, .24),
    'depth-marker': ('enamel', '8ab9a9', .08, .30),
    'engraving': ('enamel', '3a3a31', .04, .54),
}
SCREW_PITCH = 10


def blend(first, second, t):
    return tuple(a+(b-a)*t for a,b in zip(first,second))


def clamp(t):
    return max(0,min(1,t))


def field_faces(nx, nz):
    count = (nx+1)*(nz+1)
    quads = [(i,i+1,i+nx+2,i+nx+1) for j in range(nz) for c in range(nx) for i in [j*(nx+1)+c]]
    perimeter = (list(range(nx+1)) + [j*(nx+1)+nx for j in range(1,nz+1)]
                 + [nz*(nx+1)+i for i in range(nx-1,-1,-1)]
                 + [j*(nx+1) for j in range(nz-1,0,-1)])
    sides = [(a,a+count,b+count,b) for a,b in zip(perimeter,perimeter[1:]+perimeter[:1])]
    # Bottom grid and walls share every boundary vertex in the .blend.
    return quads + [tuple(k+count for k in reversed(face)) for face in quads] + sides


def solid_field(w, name, top, nx, nz, finish, group, bottom=lambda x,z,y: 0):
    vertices = top + [(x,z,bottom(x,z,y)) for x,z,y in top]
    obj = w.mesh(name, vertices, field_faces(nx,nz),finish,group)
    for face in obj.data.polygons:
        face.use_smooth = face.index < nx*nz
    return obj


def face_turning(w, name, x, depth, height, profile, finish, group='frame', segments=72, loop=False):
    obj = w.turning(name,(0,0),profile,finish,group,segments,loop)
    obj.rotation_euler.x = -pi/2
    obj.location = (x,depth,height)
    return obj


def face_type(w, text, x, depth, height, size, group='frame'):
    data = bpy.data.curves.new('刻字 '+text,'FONT')
    data.body, data.align_x, data.align_y = text, 'CENTER', 'CENTER'
    data.size, data.resolution_u = size, 4
    obj = bpy.data.objects.new(data.name,data)
    w.scene.collection.objects.link(obj)
    obj.rotation_euler = (pi/2,0,pi)
    obj.location = (x,depth,height)
    return w.register(obj,data.name,'engraving',group)


def porcelain_caption(w, text, plate, font):
    label=face_type(w,text,*plate.location,3.2,None)
    label.data.font=font
    label.rotation_euler.x=.75
    label.location+=Vector((0,.119,.128))
    graph=bpy.context.evaluated_depsgraph_get()
    letters=bpy.data.meshes.new_from_object(label.evaluated_get(graph))
    obj=bpy.data.objects.new(label.name, letters)
    w.scene.collection.objects.link(obj)
    obj.matrix_world=label.matrix_world
    font_curve=label.data
    bpy.data.objects.remove(label,do_unlink=True)
    bpy.data.curves.remove(font_curve)


def water_finish(obj):
    # The cutaway stays readable through soft highlights and restrained
    # variation in the polish, without extra simulated surface movement.
    tree=obj.data.materials[0].node_tree
    coords=tree.nodes.new('ShaderNodeTexCoord')
    grain=tree.nodes.new('ShaderNodeVectorMath')
    grain.operation='MULTIPLY'
    grain.inputs[1].default_value=(.14,.28,.24)
    tree.links.new(coords.outputs['Object'],grain.inputs[0])
    noise_tex=tree.nodes.new('ShaderNodeTexNoise')
    noise_tex.inputs['Scale'].default_value=2.4
    noise_tex.inputs['Detail'].default_value=2
    tree.links.new(grain.outputs[0],noise_tex.inputs['Vector'])
    roughness=tree.nodes.new('ShaderNodeMapRange')
    roughness.inputs['To Min'].default_value=.19
    roughness.inputs['To Max'].default_value=.34
    tree.links.new(noise_tex.outputs['Fac'],roughness.inputs['Value'])
    bsdf=tree.nodes.get('Principled BSDF')
    tree.links.new(roughness.outputs[0],bsdf.inputs['Roughness'])
    bsdf.inputs['Coat Weight'].default_value=.19
    bsdf.inputs['Coat Roughness'].default_value=.19


def open_web(w, name, outside, opening, front, back, finish, group='frame', bevel=.20):
    # The castings and yoke are closed shells with a real through opening.
    length = len(outside)
    verts = [(x,depth,z) for depth in (front,back) for path in (outside,opening) for x,z in path]
    faces = []
    for i in range(length):
        j = (i+1)%length
        faces += [(j,i,i+length,j+length), (i+2*length,j+2*length,j+3*length,i+3*length),
                  (i,j,j+2*length,i+2*length), (j+length,i+length,i+3*length,j+3*length)]
    obj = w.mesh(name,verts,faces,finish,group)
    modifier = obj.modifiers.new('铸件圆角','BEVEL')
    modifier.width, modifier.segments = bevel, 3
    obj.modifiers.new('平面法线','WEIGHTED_NORMAL')
    return obj


def spindle_wheel(w, x, depth, height, group, radius=4.5):
    profile = [(-.75,radius-.22),(-.48,radius),(.48,radius),(.75,radius-.22),
               (.71,radius-.72),(-.71,radius-.72)]
    wheel = w.turning('三辐丝杠手轮',(0,0),profile,'polished-brass',group,64,loop=True)
    wheel.location = (x,depth,height)
    wheel.rotation_euler.y = pi/2
    for a in [0,2*pi/3,4*pi/3]:
        w.curve('手轮弯辐',[(x-.16+.32*t,depth+radius*.87*t*cos(a+.34*t),
            height+radius*.87*t*sin(a+.34*t)) for t in [i/12 for i in range(13)]],.29,'brass',group)
    w.shaft('手轮轮毂',(x-1.33,depth,height),(x+.98,depth,height),1.22,'cast-brass',group,28)
    w.shaft('手轮轴端',(x+.94,depth,height),(x+1.37,depth,height),.66,'steel',group,24)
    for i in range(32):
        a = 2*pi*i/32
        y,z = depth+(radius-.045)*cos(a),height+(radius-.045)*sin(a)
        w.shaft('轮缘滚花',(x-.39,y,z),(x+.39,y,z),.10,'cast-brass',group,6)


def slotted_rail(w, start, end, z, height, supported_from, group='cursor'):
    center=(start+end)/2
    w.block('榫接滑轨横床',(center,z,height-2.45),(end-start+13,6.15,1.28),'japanned-iron',.52,'rail')
    for x in [start-3.85,center,end+3.85]:
        w.block('滑台承梁',(x,(z+supported_from)/2,height-2.10),(3.24,z-supported_from+3.1,1.58),'japanned-iron',.41,'rail')
        w.block('承梁黄铜压片',(x,supported_from,height-1.26),(3.18,3.23,.39),'brass',.15,'rail')
        w.screw(x,supported_from,height-1.02,.73,'rail')
    for delta in [-1.47,1.47]:
        w.shaft('钢质导杆',(start-3.8,z+delta,height),(end+3.8,z+delta,height),.33,'steel','rail',20)
    for x in [start-3.6,end+3.6]:
        w.block('分体轴承座',(x,z,height-.58),(3.42,4.70,2.75),'cast-brass',.43,'rail')
        w.block('轴承上盖',(x,z,height+.88),(3.84,4.92,.64),'polished-brass',.21,'rail')
        for delta in [-1.57,1.57]:
            w.screw(x,z+delta,height+1.20,.76,'rail')
        w.shaft('滑动轴套',(x-2.1,z,height),(x+2.1,z,height),.78,'brass','rail',24)
    first,last = start-3.0,end+6.5
    w.shaft('丝杠轴',(first,z,height),(last,z,height),.43,'steel','screw',24)
    count=ceil((last-first)/SCREW_PITCH*22)
    thread=[]
    for i in range(count+1):
        x=first+(last-first)*i/count
        angle=2*pi*(x-first)/SCREW_PITCH
        thread.append((x,z+.51*cos(angle),height+.51*sin(angle)))
    w.curve('丝杠螺纹',thread,.172,'steel','screw')
    spindle_wheel(w,last,z,height,'screw')
    w.block('搪瓷分度承槽',(center,z+3.07,height-.70),(end-start+7,1.87,.91),'cast-brass',.24,'rail')
    w.block('刻度搪瓷条',(center,z+3.09,height-.23),(end-start+6,1.39,.19),'ivory',.07,'rail')
    for i in range(21):
        x = start + (end-start)*i/20
        w.shaft('长短分度',(x,z+2.57,height-.119),(x,z+(3.65 if i%5==0 else 3.24),height-.119),
                .072 if i%5==0 else .046,'ink','rail',6)
    w.block('青铜螺母滑座',(start,z,height+.40),(5.2,4.07,1.27),'cast-brass',.38,group)
    for delta in [-1.47,1.47]:
        w.shaft('滑座导套',(start-2.2,z+delta,height),(start+2.2,z+delta,height),.57,'bronze',group,18)
    w.shaft('丝杠螺母',(start-2.42,z,height),(start+2.42,z,height),.76,'brass',group,20)
    w.block('游标珐琅指片',(start,z+2.56,height-.044),(.84,2.51,.35),'blue-green',.11,group)
    w.turning('滚花游标钮',(start,z),[(height+.77,1.14),(height+.90,1.56),(height+1.47,1.56),
                                    (height+1.72,1.28)],'gold',group,40)
    for i in range(28):
        a = 2*pi*i/28
        x,y = start+1.55*cos(a),z+1.55*sin(a)
        w.shaft('游标防滑齿',(x,y,height+.92),(x,y,height+1.45),.065,'bronze',group,8)


def stitched_bed(w, x, y, width, depth, base=-1.6):
    w.block('胡桃木阶沿',(x,y,base-.88),(width,depth,.94),'walnut',.37)
    w.block('榫接胡桃木底座',(x,y,base+.06),(width-1.04,depth-.89,1.74),'walnut',.59)
    w.block('嵌铜亮边',(x,y,base+.96),(width-.83,depth-.71,.26),'polished-brass',.11)
    w.block('铸铁承槽',(x,y,base+1.42),(width-2.10,depth-1.80,.88),'japanned-iron',.38)
    for xx in (x-width/2+4,x+width/2-4):
        for yy in (y-depth/2+4,y+depth/2-4):
            w.turning('调平脚',(xx,yy),[(base-2.25,1.62),(base-2.17,2.02),
                                     (base-1.67,2.02),(base-1.52,1.34),
                                     (base-1.18,1.34)],'cast-brass',segments=32)


def animate_rail(w, start, end, depth, height, frame=1):
    cursor=w.join_movement('cursor',(start,depth,height),'讲解游标')
    spindle=w.join_movement('screw',(start,depth,height),'丝杠与手轮')
    for time,travel in [(1,0),(101,end-start)]:
        cursor.location.x=start+travel
        spindle.rotation_euler.x=-2*pi*travel/SCREW_PITCH
        cursor.keyframe_insert(data_path='location',frame=time)
        spindle.keyframe_insert(data_path='rotation_euler',frame=time)
    linear_keys(cursor)
    linear_keys(spindle)
    w.scene.frame_end = 101
    w.scene.frame_set(frame)


def key_mesh(obj, scenes, coords):
    obj.shape_key_add(name='Basis')
    frames = [round(s['phase']*100)+1 for s in scenes]
    for scene in scenes:
        frame=round(scene['phase']*100)+1
        key=obj.shape_key_add(name='讲解进度 '+str(frame-1)+'%')
        for vertex,co in zip(key.data, coords(scene)):
            vertex.co=co
        index = frames.index(frame)
        if index:
            key.value=0
            key.keyframe_insert(data_path='value',frame=frames[index-1])
        key.value=1
        key.keyframe_insert(data_path='value',frame=frame)
        if index+1<len(frames):
            key.value=0
            key.keyframe_insert(data_path='value',frame=frames[index+1])
    linear_keys(obj.data.shape_keys)


def linear_keys(obj):
    for channel in obj.animation_data.action.fcurves:
        for key in channel.keyframe_points:
            key.interpolation='LINEAR'


def wave_basin(data):
    w=Workshop('波浪剖面观测槽', PALETTE)
    states=data['wave']
    initial=states[0]
    pose=next(s for s in states if s['phase']==.36)
    stitched_bed(w,50,19,104.8,42.5)
    slotted_rail(w,18,82,43.55,1.40,37.4)
    for x in [.20,99.80]:
        w.block('观测槽角部压脚',(x,36.63,1.58),(4.31,5.12,3.84),'cast-brass',.46)
        w.block('承角抛光压片',(x,37.04,3.46),(4.42,4.44,.54),'polished-brass',.19)
        w.screw(x,38.4,3.71,1.12)
        for z in [2.2,35.65]:
            w.block('槽壁竖向肋',(x,z,3.38),(1.73,3.02,7.31),'brass',.39)
        w.shaft('槽底接缝',(x,2.2,1.13),(x,36.92,1.13),.30,'gold',segments=14)
    # The sampling window is graduated at its side. The center of the
    # cutaway stays clear so the two orbits can be compared directly.
    w.block('水深刻度支架',(-2.09,38.66,9.1),(3.03,1.85,18.3),'cast-brass',.33)
    w.block('水深搪瓷分度面',(-2.13,39.74,9.13),(2.21,.37,17.24),'ivory',.13)
    for i in range(13):
        y=1.31+1.29*i
        w.shaft('剖面分度',(-1.34,39.96,y),(-2.72 if i%4==0 else -2.24,39.96,y),
                .091 if i%4==0 else .056,'engraving',segments=8)
    for x in [6,94]:
        w.block('读数架基座',(x,42.75,-1.58),(6.3,6.88,1.23),'japanned-iron',.37)
        w.screw(x,44.89,-.92,.87)
    # The dark cut base and the bright water skin remain one closed body.
    nx,nz=200,10
    def points(frame):
        return [(i/2,3.8*j,frame['surface'][i]) for j in range(nz+1) for i in range(nx+1)]
    water=solid_field(w,'连续水面和完整前剖面',points(initial),nx,nz,'blue-glass','water-cut')
    deep,light=map(linear_rgb,['275660','8cbbb6'])
    pigments=[]
    for x,z,y in points(initial):
        grain=.975+.023*sin(z*.49+cos(x*.16))+.013*sin(z*1.38+x*.24)
        pigments.append(tuple(v*grain for v in blend(deep,light,clamp(y/24.8)**.63)))
    pigments += [deep]*len(pigments)
    w.paint(water,pigments)
    water_finish(water)
    w.export('waves',{'rail':dict(start=18,end=82,depth=43.55,height=1.40,pitch=SCREW_PITCH)},positive_depth=True)

    def vertices(s):
        top=points(s)
        return top+[(x,z,0) for x,z,y in top]
    key_mesh(water,states,vertices)
    for index in range(4):
        def coordinates(frame):
            return [(p['x'],38.114,p['height']+dy) for p in frame['contours'][index] for dy in [-.09,.09]]
        verts=coordinates(initial)
        strip=w.mesh('随波面移动的剖面等深线',verts,
                     [(i,i+1,i+3,i+2) for i in range(0,len(verts)-2,2)],'sea-trace',None)
        key_mesh(strip,states,coordinates)
    for key,finish,r in [('particle','copper-point',1.25),('deep','depth-marker',1.0)]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=r)
        marker=w.register(bpy.context.object,'表层质点' if key=='particle' else '深水质点',finish,None)
        for polygon in marker.data.polygons:
            polygon.use_smooth=True
        for s in states:
            pt=s[key]
            marker.location=(pt['x'],38.43,pt['height'])
            marker.keyframe_insert(data_path='location',frame=round(s['phase']*100)+1)
        linear_keys(marker)
    q=data['waveSize']['particleRestX']
    for depth,radius,finish in [(0,5.8,'copper-point'),(8,5.8*exp(-2*pi*8/48),'sea-trace')]:
        w.curve('质点闭合参照',[(q+radius*cos(i*pi/48),38.32,19-depth+radius*sin(i*pi/48)) for i in range(96)],
                .085,finish,None,cyclic=True)
    animate_rail(w,18,82,43.55,1.40,round(pose['phase']*100)+1)
    w.photograph('waves','波浪剖面观测槽',(49,23,9),(-42,143,64),117,-3.94)


def tide_drive(w, x, depth, height, radius, stroke):
    # One shaft carries the phase hand and eccentric pin. Its horizontal
    # slot absorbs the pin's side travel and transmits just its elevation.
    w.block('潮轮胡桃木外伸座',(x,55.68,-1.64),(28.8,19.7,1.65),'walnut',.68)
    w.block('潮轮铸铁机床',(x,58.75,-.70),(28.0,13.30,1.46),'japanned-iron',.53)
    w.block('潮轮后轴承横梁',(x,depth-7.54,height),(19.4,2.21,4.37),'japanned-iron',.52)
    for side in [-1,1]:
        def arm(points):
            mirrored = [(x+side*a,h) for a,h in points]
            return mirrored if side==1 else list(reversed(mirrored))
        outside = [(6.62,.31),(13.10,.31),(12.15,3.2),(11.07,10.2),(10.92,16.4),
                   (12.60,23.4),(12.23,27.50),(8.20,26.31),(7.22,22.47),(7.50,17.1),
                   (8.08,12.8),(8.72,7.4),(7.79,3.59)]
        opening = [(8.88,2.31),(11.10,2.31),(10.69,4.0),(9.75,10.3),(9.61,16.2),
                   (10.22,21.10),(10.92,24.58),(9.28,24.2),(8.50,22.0),(8.79,17.4),
                   (9.22,12.54),(9.63,7.31),(9.34,4.05)]
        open_web(w,'开窗铸铁轴架',arm(outside),arm(opening),depth-4.16,depth-7.93,'japanned-iron',bevel=.34)
        xx=x+side*10.31
        w.block('桥腿黄铜蹄座',(xx,depth-6.48,.23),(7.15,5.71,1.09),'cast-brass',.38)
        for dx in [-2.28,2.28]:
            w.screw(xx+dx,depth-4.69,.76,1.16)
        w.shaft('升降钢质导柱',(x+side*7.24,depth-3.79,height-8.59),
                (x+side*7.24,depth-3.79,height+8.53),.35,'steel',segments=20)
        for z in [height-8.30,height+8.26]:
            w.block('导柱压盖',(x+side*7.82,depth-4.52,z),(2.74,3.85,1.35),'brass',.38)
            w.screw(x+side*7.40,depth-3.87,z+.67,.64)
    face_turning(w,'多级青铜表壳',x,depth,height,[(-5.38,11.98),(-4.90,12.48),(-3.66,12.48),
                 (-3.29,12.28),(-1.88,12.28),(-1.53,12.60),(-.88,12.6),(-.48,12.14),
                 (-.48,11.70),(-4.67,11.70),(-5.38,11.29)],'cast-brass',loop=True)
    face_turning(w,'抛光滚边',x,depth,height,[(-1.33,12.18),(-1.26,12.53),(-.84,12.73),
                 (-.52,12.47),(-.30,12.16),(-.68,12.03)],'polished-brass',loop=True)
    face_turning(w,'象牙瓷分度环',x,depth,height,[(-1.79,12.08),(-.51,12.03),(-.32,11.74),
                 (-.32,6.56),(-.60,6.37),(-1.79,6.37)],'ivory',loop=True)
    for ring in [6.48,11.72]:
        w.curve('瓷环双车线',[(x+ring*cos(i*pi/48),depth-.30,height+ring*sin(i*pi/48)) for i in range(96)],
                .093,'brass',cyclic=True)
    for i in range(60):
        a=2*pi*i/60
        inner=10.60 if i%5==0 else 11.14
        w.shaft('潮相长短分线',(x+inner*cos(a),depth-.27,height+inner*sin(a)),
                (x+11.57*cos(a),depth-.27,height+11.57*sin(a)),.094 if i%5==0 else .045,'engraving',segments=8)
    for a, text in [(0,'II'),(pi/2,'III'),(pi,'IV'),(3*pi/2,'I')]:
        w1=8.97
        face_type(w,text,x+w1*cos(a),depth-.265,height+w1*sin(a),1.84)
    face_turning(w,'后端阶梯轴承',x,depth,height,[(-8.9,1.95),(-8.28,2.44),(-6.65,2.4),(-5.86,1.68),
                 (-4.60,1.68)],'bronze',segments=48)
    face_turning(w,'钢质主轴',x,depth,height,[(-8.9,.8),(-.07,.8),(.21,.65)],'steel',segments=32)
    face_turning(w,'偏心盘',x,depth,height,[(-3.25,2.87),(-3.03,3.13),(-2.26,3.13),(-2.05,2.89)],
                 'cast-brass','dial-arm',40)
    w.block('偏心臂',(x,depth-2.66,height-stroke*.49),(1.21,.76,stroke+1.1),'brass',.30,'dial-arm')
    w.shaft('偏心销',(x,depth-4.26,height-stroke),(x,depth-2.20,height-stroke),.52,'steel','dial-arm',24)
    w.shaft('偏心销端垫圈',(x,depth-2.30,height-stroke),(x,depth-2.12,height-stroke),.66,'polished-brass','dial-arm',24)
    def capsule(width, r):
        return [(x+side*width+r*cos(a),height+r*sin(a))
                for side,base in [(1,-pi/2),(-1,pi/2)]
                for i in range(13) for a in [base+i*pi/12]]
    open_web(w,'偏心销的贯通横槽',capsule(5.69,1.50),capsule(5.42,.68),depth-3.22,depth-4.33,
             'cast-brass','level-yoke',.16)
    for side in [-1,1]:
        xx=x+side*7.24
        w.turning('滑架导套',(xx,depth-3.79),[(height-1.03,.76),(height-.77,.88),
                  (height+.76,.88),(height+1.03,.75)],'brass','level-yoke',28)
    # A second, fixed vertical scale makes the output of the eccentric
    # visible under the dial throughout its full travel.
    gauge_x,gauge_z=x+2.5,depth-2.96
    gauge_y=8.45
    w.block('线性水位尺托座',(gauge_x,gauge_z,1.07),(5.92,3.14,1.44),'brass',.33)
    w.block('线性水位尺金属背脊',(gauge_x,gauge_z,8.09),(4.85,1.56,13.54),'cast-brass',.33)
    w.block('线性水位尺瓷板',(gauge_x,gauge_z+.90,8.55),(3.88,.28,11.98),'ivory',.12)
    for i in range(11):
        yy=gauge_y-stroke+2*stroke*i/10
        w.shaft('线性水位尺短刻痕',(gauge_x-1.36,gauge_z+1.048,yy),
                (gauge_x+(.70 if i%5==0 else -.21),gauge_z+1.048,yy),
                .089 if i%5==0 else .055,'engraving',segments=8)
    w.shaft('水位尺传动杆',(x+6.88,depth-3.85,height),(x+6.88,depth-3.85,gauge_y),
            .28,'polished-brass','level-yoke',16)
    w.block('水位尺随动指片',(x+5.34,gauge_z+1.24,gauge_y),(3.67,.54,.63),'blue-green',.17,'level-yoke')
    w.shaft('水位指片接臂',(x+6.89,depth-3.85,gauge_y),(x+6.89,gauge_z+1.22,gauge_y),
            .35,'brass','level-yoke',16)
    w.shaft('潮轮长柄',(x,depth+.10,height+.34),(x,depth+.10,height-radius),.62,'brass','dial-arm',20,tip=.41)
    face_turning(w,'转柄圆心压帽',x,depth,height,[(-.19,1.56),(.28,1.68),(.61,1.43)],'polished-brass','dial-arm',40)
    face_turning(w,'潮汐握柄',x,depth,height-radius,[(-.16,1.45),(.33,1.73),(1.44,1.65),(1.62,1.40)],
                 'polished-brass','dial-knob',44)
    face_turning(w,'握柄珐琅嵌件',x,depth,height-radius,[(1.54,1.32),(1.77,1.27),(1.88,1.10)],
                 'blue-green','dial-knob',44)


def boat_hull(w,x,z,draft):
    # A sealed open hull with an inner skin, turned-up ends and a cap rail.
    count=72
    rings=[
        (1, .91),(.89,.23),(.73,-.46),(.59,-draft),(.58,.18),(.69,.25),(.82,.46),(.91,.88)
    ]
    def face_ring(factor,height):
        points=[]
        for i in range(count):
            angle=2*pi*i/count
            long=cos(angle)
            beam=sin(angle)*(.86+.14*sin(angle)**2)
            sheer=.50*abs(long)**3
            points.append((x+6.73*factor*long,z+2.21*factor*beam,height+sheer))
        return points
    rings_vertices=[face_ring(width, height) for width,height in rings]
    vertices=[v for ring in rings_vertices for v in ring]
    faces=[(j*count+i,j*count+(i+1)%count,((j+1)%len(rings))*count+(i+1)%count,
            ((j+1)%len(rings))*count+i) for j in range(len(rings)) if j!=3 for i in range(count)]
    # Center of the keel has the exact requested draft, including the
    # upturned curvatures at stem and stern.
    faces = [tuple(reversed(f)) for f in faces]
    faces.extend([tuple(reversed(range(3*count,4*count))),tuple(range(4*count,5*count))])
    hull=w.mesh('弯木轻舟双层壳',vertices,faces,'keel-wood','skiff-shell',True)
    for index,(width,height) in enumerate([(1,.95),(.95,.64),(.85,.04)]):
        w.curve('搭接船板压线',face_ring(width,height),.10 if index else .18,
                'rib-wood','skiff-fittings',cyclic=True)
    for dx,b in [(-2,3.23),(0,3.71),(2.1,3.18)]:
        w.block('横座板',(x+dx,z,.56),(.62,b,.22),'rib-wood',.09,'skiff-fittings')
    for dy in [-.63,0,.63]:
        w.block('舱内踏板',(x,z+dy,.25),(5.7,.43,.16),'rib-wood',.06,'skiff-fittings')
    for dz in [-2.02,2.02]:
        w.shaft('青铜桨座',(x+.4,z+dz,.8),(x+.4,z+dz,1.26),.19,'bronze','skiff-fittings',14)
    return hull


def tidal_reach(data):
    w=Workshop('潮间带观测剖面',PALETTE)
    layout=data['tideSize']
    low,high=layout['low'],layout['high']
    nx,nz=92,48
    top=[]
    colors=[]
    gravel,wet,sand,dune,grass=[linear_rgb(hex_color) for hex_color in ['8f8170','b7a082','e4cba0','c8ba8a','89977a']]
    for x,z,base in data['tideGroundGrid']:
        landward=clamp((base-high-.7)/3.5)
        feature=noise.fractal(Vector((x*.067,z*.085,3.74)),.86,2.15,3)
        dunes=1.45*exp(-((x-86)/10)**2-((z-16)/11)**2)+2.1*exp(-((x-92)/12)**2-((z-36)/11)**2)
        h=base+landward*(dunes+feature*.62)
        top.append((x,z,h))
        pigment=blend(gravel,wet,clamp((base-low+1.4)/4))
        pigment=blend(pigment,sand,clamp((base-low-.9)/(high-low-1.0)))
        pigment=blend(pigment,blend(dune,grass,clamp(.38+feature*.95)),landward*.96)
        # Overlapping ripple trains soften at the upper limit of tidal wash.
        crest=(.5+.5*cos(x*1.76+z*.19+1.9*sin(z*.22+x*.08)))**4
        ridge=(.105*crest-.034)*(1-landward)+.024*sin(x*.65-z*.37)
        colors.append(tuple(v*(.96+feature*.12+ridge) for v in pigment))
    ground=solid_field(w,'海床与潮间带整块剖面',top,nx,nz,'shore-pigment','shore')
    w.paint(ground,colors+[blend(gravel,wet,.24)]*len(colors))
    substrate=apply_scan(ground.data.materials[0], 'sand', 9.5)
    # The dark fringe tracks the same water-level samples as the float and
    # tide gauge. Native Blender animation uses height in workshop units.
    nodes,link=substrate.node_tree.nodes,substrate.node_tree.links.new
    bsdf=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    xyz=nodes.new('ShaderNodeSeparateXYZ')
    link(nodes.new('ShaderNodeTexCoord').outputs['Object'],xyz.inputs[0])
    distance=nodes.new('ShaderNodeMath')
    distance.operation='SUBTRACT'
    link(xyz.outputs['Z'],distance.inputs[0])
    for state in data['tide']:
        distance.inputs[1].default_value=state['waterLevel']
        distance.inputs[1].keyframe_insert(data_path='default_value',frame=round(state['phase']*100)+1)
    wet_front=nodes.new('ShaderNodeMapRange')
    wet_front.interpolation_type='SMOOTHSTEP'
    for name,value in [('From Min',0),('From Max',2.4),('To Min',.60),('To Max',1)]:
        wet_front.inputs[name].default_value=value
    link(distance.outputs[0],wet_front.inputs[0])
    darken=nodes.new('ShaderNodeMixRGB')
    darken.blend_type='MULTIPLY'
    darken.inputs[0].default_value=1
    link(bsdf.inputs['Base Color'].links[0].from_socket,darken.inputs[1])
    link(wet_front.outputs[0],darken.inputs[2])
    link(darken.outputs[0],bsdf.inputs['Base Color'])
    # Worn shell valves lie partly buried along two discontinuous strandlines.
    from random import Random
    rng=Random(8683)
    fragments, shell_faces=[],[]
    for i in range(48):
        z=rng.uniform(7,54)
        q=(z-6)/49
        offset=2.5*sin(q*pi*1.4)+.7*sin(q*pi*3)
        x=(60 if i<16 else 76)+rng.gauss(0,1.9)-offset+1.5*sin(q*9)
        angle=rng.uniform(0,2*pi)
        size=rng.uniform(.24,.73)
        first=len(fragments)
        for ring in range(5):
            r=.08+.92*ring/4
            for k in range(17):
                a=-1.02+1.95*k/16
                u,v=size*r*sin(a),size*r*(cos(a)+.25)
                dx,dz=u*cos(angle)-v*sin(angle),v*cos(angle)+u*sin(angle)
                h=layout['seabed']+layout['slope']*(x+dx-layout['beachStart']+offset)
                vault=size*(.21*(1-r*r)+.065*cos(8*pi*k/16)*r)
                fragments.append((x+dx,z+dz,h+vault+.025))
            if ring:
                for k in range(16):
                    n=first+17*ring+k
                    shell_faces.append((n-17,n-16,n+1,n))
    w.mesh('潮痕里的残贝壳',fragments,shell_faces,'ivory','shells',True)
    # Sparse dune grasses sit above the highest waterline, leaving the
    # measured change in the intertidal band completely unobstructed.
    tufts=[]
    for i in range(27):
        x=84.8+9.5*(.5+.5*sin(i*3.17))
        z=11+36*(.5+.5*sin(i*2.48+1))
        idx=round((z-6)*48/49)*93+round((x-6)*92/91)
        x,z,y=top[idx]
        for j in range(6):
            a=j*pi/3+i*.44
            dx,dz=cos(a),sin(a)
            h=.54+.48*(.5+.5*sin(i*1.42+j*2.81))
            tufts.extend([(x-.12*dz,z+.12*dx,y-.095),(x+.12*dz,z-.12*dx,y-.095),
                          (x+.28*dx,z+.28*dz,y+h*.58),(x+.51*dx,z+.51*dz,y+h)])
    w.mesh('岸脊稀疏草丛',tufts,[(i,i+1,i+2) for i in range(0,len(tufts),4)]
           + [(i+1,i+3,i+2) for i in range(0,len(tufts),4)],'young-leaf','dune-grass')
    stitched_bed(w,51.5,30.5,94.6,52.4,-1.77)
    for x in [7.65,95.35]:
        w.block('青铜剖面抱角',(x,54.1,.22),(5.66,5.22,1.96),'cast-brass',.38)
        w.block('压脚抛光鞍座',(x,55.41,1.28),(4.98,3.2,.48),'polished-brass',.16)
        w.screw(x,56.06,1.55,.92)
    w.block('前剖面铜质压边',(51.5,55.19,.62),(83.4,.83,.65),'polished-brass',.19)
    # Sparse strata engraved into the exposed front face establish the
    # direction of the shore rise and keep the water / land seam legible.
    for start,end,color,elevation in [(11,47,'sediment',.9),(30,78,'ochre',1.4),
                                      (41,96,'sediment',2.9),(57,96,'ochre',6.2)]:
        pts=[]
        for i in range(57):
            x=start+(end-start)*i/56
            height=elevation+(x-start)*.038+(1+sin(x*.32+elevation))*.17
            pts.append((x,55.038,height))
        w.curve('潮岸沉积层纹',pts,.087,color)
    boat_hull(w,layout['boatX'],layout['boatZ'],layout['boatDraft'])
    gx,gz=layout['gaugeX'],layout['gaugeZ']
    w.turning('潮尺锚固脚',(gx,gz),[(2.58,1.14),(2.92,1.54),(3.22,1.54),(3.53,.96)],
              'bronze','gauge',32)
    w.block('潮尺背脊',(gx,gz,13.55),(2.76,1.40,21.3),'cast-brass',.22,'gauge')
    for side in [-1,1]:
        w.shaft('潮尺保护立边',(gx+side*1.31,gz+.89,3.40),(gx+side*1.31,gz+.89,24.17),
                .16,'polished-brass','gauge',12)
    for i in range(7):
        y=4.4+i*2.8
        w.block('搪瓷红白刻段',(gx,gz+.76,y),(2.28,.31,2.51),'ivory' if i%2==0 else 'copper-band',.075,'gauge')
        w.shaft('潮尺刻线',(gx-1.24,gz+.92,y-1.27),(gx+1.25,gz+.92,y-1.27),.087,'ink','gauge',6)
    w.block('封顶铜帽',(gx,gz,24.34),(3.15,1.84,.51),'brass',.18,'gauge')
    w.shaft('潮位滑套',(gx-1.81,gz+1.18,0),(gx+1.92,gz+1.18,0),.34,'gold','gauge-mark',24)
    w.block('潮位滑套珐琅面',(gx,gz+1.44,.16),(3.43,.26,.43),'blue-green',.07,'gauge-mark')
    cx,cz,cy=86,63.4,27.4
    tide_drive(w,cx,cz,cy,9.66,(high-low)/2)
    w.export('tides',{'dial':dict(x=cx,depth=cz,height=cy,radius=9.66,stroke=(high-low)/2)},positive_depth=True)

    states=data['tide']
    columns=32
    def water_coordinates(frame):
        level=frame['waterLevel']
        top,bottom=[],[]
        for shore,_,z in frame['shoreline']:
            slope_start=shore-(level-layout['seabed'])/layout['slope']
            for i in range(columns+1):
                x=layout['seaLeft']+(shore-layout['seaLeft'])*i/columns
                floor=min(level,layout['seabed']+layout['slope']*max(0,x-slope_start))
                top.append((x,z,level))
                bottom.append((x,z,floor))
        return top+bottom
    vertices=water_coordinates(states[0])
    sea=w.mesh('随潮位相交的水面',vertices,field_faces(columns,40),'blue-glass',None)
    for face in sea.data.polygons:
        face.use_smooth=face.index<columns*40
    half=len(vertices)//2
    shallow,ocean,deep=map(linear_rgb,['aacbbc','558694','2a4d54'])
    w.paint(sea,[blend(ocean,shallow,(i% (columns+1)/columns)**4) for i in range(half)]+[deep]*half)
    water_finish(sea)
    key_mesh(sea,states,water_coordinates)

    def foam_positions(frame):
        return [(x-width,z,level+.071) for x,level,z in frame['shoreline'] for width in [0,.44]]
    foam=w.mesh('潮缘细白线',foam_positions(states[0]),
                [(i,i+2,i+3,i+1) for i in range(0,80,2)],'ivory',None)
    key_mesh(foam,states,foam_positions)
    skiff=w.join_movement('skiff-shell',(0,0,0),'轻舟')
    fittings=w.join_movement('skiff-fittings',(0,0,0),'舷板')
    marker=w.join_movement('gauge-mark',(0,0,0),'固定潮尺上的水位游标')
    slider=w.join_movement('level-yoke',(cx,cz,cy),'偏心槽升降架')
    turn=w.join_movement('dial-arm',(cx,cz,cy),'同轴潮轮及偏心臂')
    knob=w.join_movement('dial-knob',(cx,cz,cy),'潮轮握柄')
    for frame,state in [(round(s['phase']*100)+1,s) for s in states]:
        level=state['waterLevel']
        for obj in [skiff,fittings,marker]:
            obj.location.z=level
            obj.keyframe_insert(data_path='location',frame=frame)
        slider.location.z=cy+level-(low+high)/2
        slider.keyframe_insert(data_path='location',frame=frame)
        for obj in [turn,knob]:
            obj.rotation_euler.y=-2*pi*state['phase']
            obj.keyframe_insert(data_path='rotation_euler',frame=frame)
    for obj in [skiff,fittings,marker,slider,turn,knob]:
        linear_keys(obj)
    w.scene.frame_end=101
    w.scene.frame_set(40)
    w.photograph('tides','潮间带观测剖面',(53,34,14),(38,140,69),116,-4.06,
                 detail=((84,59,20),(41,148,32),68))


def shore_of(z, stations):
    for (a,ja),(b,jb) in zip(stations,stations[1:]):
        if ja <= z <= jb:
            q=(z-ja)/(jb-ja)
            return a+(b-a)*q
    return stations[-1][0]


def orbit_stand(w, x, depth, height, orbit):
    front = depth-.89
    w.block('往复仪宽脚与台口相接',(x,6.28,.60),(18.0,5.3,1.68),'japanned-iron',.39,'orbit')
    w.block('往复仪压边',(x,6.28,1.47),(16.7,4.3,.43),'cast-brass',.16,'orbit')
    for side in [-1,1]:
        def wing(points):
            result = [(x+side*p,z) for p,z in points]
            return result if side==1 else list(reversed(result))
        outside = [(2.02,1.63),(8.20,1.63),(7.70,4.36),(6.58,8.20),(6.38,13.6),
                   (7.03,18.7),(6.62,21.05),(4.26,20.22),(3.95,17.0),(4.20,12.24),(3.71,7.71)]
        inside = [(4.1,3.37),(6.61,3.37),(6.12,5.5),(5.56,8.78),(5.43,13.6),
                  (5.9,18.26),(5.78,19.4),(5.1,19.1),(4.9,16.8),(5.08,12.47),(4.87,8.24)]
        open_web(w,'往复表开窗铸件',wing(outside),wing(inside),front-1.1,front-2.97,'cast-brass','orbit',.24)
        w.screw(x+side*6.34,7.41,1.70,.91,'orbit')
    face_turning(w,'往复表车削表背',x,front,height,[(-2.31,6.21),(-1.83,7.18),(-.25,7.36),
                 (.25,7.27),(.48,6.86),(.43,6.31),(-1.9,6.25)],'cast-brass','orbit',64,loop=True)
    face_turning(w,'往复表黄铜抛光前沿',x,front,height,[(.18,7.12),(.33,7.38),(.60,7.17),
                  (.70,6.75),(.53,6.55)],'polished-brass','orbit',64,loop=True)
    face_turning(w,'往复表瓷质刻度盘',x,front,height,[(.11,6.68),(.59,6.65)],'ivory','orbit',72)
    for i in range(24):
        a = 2*pi*i/24
        inner=5.25 if i%6==0 else 5.88
        w.shaft('往复表刻度',(x+inner*cos(a),front+.61,height+inner*sin(a)),
                (x+6.38*cos(a),front+.61,height+6.38*sin(a)),.075 if i%6==0 else .052,
                'engraving','orbit',8)
    for dim in [0,1]:
        w.shaft('环心基线',(x-4.52*(1-dim),front+.624,height-4.52*dim),
                (x+4.52*(1-dim),front+.624,height+4.52*dim),.049,'engraving','orbit',8)
    w.curve('闭合的水质点轨迹',[(x,z+.035,y) for x,y,z in orbit[:-1]],
            .136,'copper-band','orbit',True)


def current_specimen(data):
    w=Workshop('定向洋流与往复参照',PALETTE)
    stitched_bed(w,50.5,32,98.8,52.5,-1.16)
    slotted_rail(w,12,88,62.50,.63,55.5)
    for x in [4.85,96.7]:
        w.block('海槽护角',(x,54.35,2.06),(4.45,3.79,3.10),'cast-brass',.46)
        w.block('铜质护角压片',(x,55.04,3.57),(4.55,3.02,.51),'polished-brass',.18)
        w.screw(x,55.76,3.83,.92)
    w.block('海槽开口铜质榫条',(50.5,55.38,1.48),(90.2,.78,.58),'polished-brass',.21)
    layout=data['currentLayout']
    profile=layout['coast'][1:-1]
    floor=layout['sea']['bottom']
    level=layout['sea']['top']
    nx,nz=40,52
    top=[]
    pigment=[]
    shallow,deep,edge=map(linear_rgb,['95bfa9','326173','538990'])
    for j in range(nz+1):
        z=8+47*j/nz
        coast=shore_of(z,profile)
        for i in range(nx+1):
            x=coast + (97-coast)*i/nx
            bathy=clamp((x-coast)/22)
            tone=blend(shallow,deep,bathy*.83)
            crease=(1+sin(x*.49+z*.45+2*sin(z*.23)))*.5
            pigment.append(blend(tone,edge,.12*crease))
            top.append((x,z,level))
    sea=solid_field(w,'闭合的深浅海色水体',top,nx,nz,'blue-glass','sea',bottom=lambda x,z,y:floor)
    w.paint(sea,pigment+[deep]*len(pigment))
    water_finish(sea)
    coast_top=[]
    coast_colors=[]
    muted,fawn,seaweed=map(linear_rgb,['a68f71','d5bb95','899580'])
    nx=29
    for j in range(nz+1):
        z=8+47*j/nz
        line=shore_of(z,profile)
        for i in range(nx+1):
            t=i/nx
            x=4+(line-4)*t
            relief=noise.fractal(Vector((x*.14,z*.091,4.9)),.9,2.12,3)
            shoulder=clamp((1-t)*2.45)
            bedding=(.5+.5*sin(x*1.32+z*.245+.32*sin(z*.62)))**3
            y=level+.09+(5.38+relief*1.51+.59*bedding)*shoulder
            coast_top.append((x,z,y))
            coat=blend(muted,fawn,clamp(t*1.6))
            lamination = .92+.08*sin(x*1.54+z*.28+sin(z*.31))
            coat=blend(coat,seaweed,.64*shoulder*clamp(.65+relief))
            coat=blend(coat,muted,.28*bedding+.35*(1-shoulder)**4)
            coast_colors.append(tuple(v*lamination for v in coat))
    coast=solid_field(w,'非定位浅岸标本',coast_top,nx,nz,'shore-pigment','coast', bottom=lambda x,z,y:floor)
    w.paint(coast,coast_colors+[muted]*len(coast_colors))
    apply_scan(coast.data.materials[0], 'outcrop', 9)

    cx,cy,cz=layout['waveCenter']
    orbit_stand(w,cx,cz,cy,data['orbit'])
    font_path=Path('C:/Windows/Fonts/msyh.ttc')
    font=bpy.data.fonts.load(str(font_path)) if font_path.is_file() else None
    for x,caption in zip([14,50,86],['起点','前移','末位置']):
        w.block('过程序位支耳',(x,66.4,-1.42),(19.5,10.3,1.38),'japanned-iron',.39,'step')
        holder=w.block('装铜瓷质定位牌',(x,70.84,-1.11),(20.5,8.55,.74),'bronze',.43,'step')
        plate=w.block('定位牌瓷面',(x,71.19,-.715),(19.4,8.0,.29),'ivory',.29,'step')
        plate.rotation_euler.x=holder.rotation_euler.x=-.75
        if font:
            porcelain_caption(w,caption,plate,font)
    w.export('currents',{'rail':dict(start=12,end=88,depth=62.5,height=.63,pitch=SCREW_PITCH)},positive_depth=True)

    states=data['current']
    state=states[len(states)//2]
    for side in [0,1]:
        w.curve('洋流示意带边缘',[(x,z,level+.04) for x,y,z in [p[side] for p in data['path']]],
                .10,'sea-trace',None)
    for arrow in data['arrows']:
        w.mesh('向前方向',[(x,z,level+.09) for x,y,z in arrow],[tuple(range(len(arrow)))],'blue-green',None)
    head=state['samples'][0]
    for name,point in [('保留起点',head['origin']),('对照末位置',head['destination'])]:
        x,y,z=point
        w.curve(name,[(x+1.98*cos(a*pi/32),z+1.98*sin(a*pi/32),y) for a in range(64)],.16,'gold',None,True)
    for index in range(len(state['samples'])):
        r=1.39 if index==0 else 1.14
        marker=w.turning('水体标记',(0,0),[(-.22,r*.83),(-.14,r),(.24,r),(.33,r*.84)],
                         'gold' if index==0 else 'blue-green',None,24)
        for sample in states:
            x,y,z=sample['samples'][index]['point']
            marker.location=(x,z,y)
            marker.keyframe_insert(data_path='location',frame=round(sample['phase']*100)+1)
        linear_keys(marker)
    marker=w.shaft('往复参照读点',(0,0,0),(0,.65,0),.65,'copper-point',None,24)
    for sample in states:
        x,y,z=sample['comparison']['point']
        marker.location=(x,z+.39,y)
        marker.keyframe_insert(data_path='location',frame=round(sample['phase']*100)+1)
    linear_keys(marker)
    animate_rail(w,12,88,62.5,.63,51)
    w.photograph('currents','定向洋流与往复参照',(50,34,8),(-28,135,99),116,-3.48)


if __name__=='__main__':
    sample=json.loads((ROOT/'work/sea-art-states.json').read_text(encoding='utf8'))
    author={'waves':wave_basin,'tides':tidal_reach,'currents':current_specimen}
    selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(author)
    for name in selected:
        author[name](sample)
