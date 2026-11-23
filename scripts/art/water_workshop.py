"""Materials and machined parts shared by the water observation instruments."""
from math import cos, pi, radians, sin, tau
from pathlib import Path

import bpy
from mathutils import Vector

FINISH = {
    'black-green': ('enamel', '293e34', .19, .29),
    'patinated-brass': ('brass', 'a57a45', .86, .37),
    'burnished-brass': ('brass', 'd5ad72', .88, .22),
    'dark-bronze': ('brass', '775637', .82, .39),
    'scale-ink': ('enamel', '35382e', .02, .56),
    'sea': ('water', '699aa6', .05, .26),
    'cold-sea': ('water', '598da1', .05, .25),
    'glazed-water': ('water', 'ffffff', .08, .27),
    'blue-enamel': ('enamel', '467c89', .12, .22),
    'dark-timber': ('wood', '4d3123', .05, .36),
    'pale-ice': ('water', 'ffffff', .02, .38),
    'brine': ('water', 'a59861', .08, .28),
}


def front_turn(w, name, x, y, z, profile, material, group='frame', segments=64, ring=False):
    obj = w.turning(name, (0, 0), profile, material, group, segments, ring)
    obj.rotation_euler.x = -pi/2
    obj.location = (x, y, z)
    return obj


def front_web(w, name, rim, hole, y, thickness, material, group='frame', edge=.18):
    size = len(rim)
    assert size == len(hole)
    vertices = [(x, depth, z) for depth in [y+thickness/2, y-thickness/2] for loop in [rim, hole] for x,z in loop]
    faces = []
    for i in range(size):
        j = (i+1)%size
        faces += [(j,i,i+size,j+size), (i+2*size,j+2*size,j+3*size,i+3*size),
                  (i,j,j+2*size,i+2*size), (j+size,i+size,i+3*size,j+3*size)]
    obj = w.mesh(name, vertices, faces, material, group)
    bevel = obj.modifiers.new('铸件圆角','BEVEL')
    bevel.width, bevel.segments = edge, 3
    obj.modifiers.new('平面法线','WEIGHTED_NORMAL')
    return obj


def machined_section(w, name, center, profile, start, sweep, finish, group, steps=64):
    """Turn a hollow solid and close its exposed radial cut faces."""
    x,y = center
    angles = [start+sweep*i/steps for i in range(steps+1)]
    points = [(x+r*cos(a),y+r*sin(a),z) for a in angles for z,r in profile]
    rows = len(profile)
    panels = [(i*rows+j,(i+1)*rows+j,(i+1)*rows+(j+1)%rows,i*rows+(j+1)%rows)
              for i in range(steps) for j in range(rows)]
    panels += [tuple(range(rows)),tuple(reversed(range(steps*rows,(steps+1)*rows)))]
    obj = w.mesh(name,points,panels,finish,group)
    for face in obj.data.polygons:
        face.use_smooth = face.index < steps*rows
    return obj


def dish(w, name, x, y, z, radius, material, group='frame'):
    return w.turning(name,(x,y),[(z,radius*.76),(z+.22,radius*.86),(z+.58,radius),
                (z+1.15,radius),(z+1.23,radius-.27),(z+.84,radius-.65),
                (z+.44,radius*.77),(z+.45,radius*.20)],material,group,64)


def leveled_bed(w, center, size, top, group='frame'):
    x,y = center
    width,depth = size
    w.block('胡桃木榫合床身',(x,y,top-2.28),(width,depth,1.74),'dark-timber',.61,group)
    w.block('嵌入式黄铜窄沿',(x,y,top-1.38),(width-1.45,depth-1.42,.39),'burnished-brass',.18,group)
    w.block('涂漆铸铁床',(x,y,top-.54),(width-2.42,depth-2.4,1.16),'black-green',.39,group)
    for xx in [x-width*.397,x+width*.397]:
        for yy in [y-depth*.345,y+depth*.345]:
            w.turning('车削调平足',(xx,yy),[(top-4.70,1.58),(top-4.54,2.22),
                      (top-4.01,2.25),(top-3.83,1.68),(top-3.05,1.22)],'patinated-brass',group,40)


def sphere(w,name,center,radius,finish,group=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,radius=radius,location=center)
    obj = w.register(bpy.context.object,name,finish,group)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj


def keys_linear(obj):
    for curve in obj.animation_data.action.fcurves:
        for key in curve.keyframe_points:
            key.interpolation = 'LINEAR'


def porcelain_type(w, captions):
    """Convert the workshop labels to mesh glyphs so the .blend is portable."""
    path=Path('C:/Windows/Fonts/msyh.ttc')
    if not path.is_file():
        return {}
    font=bpy.data.fonts.load(str(path))
    meshes={}
    for text,mark,size in captions:
        curve=bpy.data.curves.new(text,'FONT')
        curve.body,curve.font,curve.size=text,font,size
        curve.align_x,curve.align_y,curve.resolution_u='CENTER','CENTER',5
        curve.materials.append(w.material('scale-ink'))
        drawing=bpy.data.objects.new(text,curve)
        w.scene.collection.objects.link(drawing)
        graph=bpy.context.evaluated_depsgraph_get()
        letters=bpy.data.meshes.new_from_object(drawing.evaluated_get(graph))
        bpy.data.objects.remove(drawing,do_unlink=True)
        bpy.data.curves.remove(curve)
        solid=bpy.data.objects.new('瓷牌 '+text,letters)
        w.scene.collection.objects.link(solid)
        x,z,y=mark['at']
        solid.location=(x,y,z)
        solid.rotation_euler=(mark['angle'],0,pi)
        meshes[text]=solid
    return meshes


def reading_plate(w,name,x,y,z,width,height,tilt,group='frame'):
    """An angled ceramic face and its glyph plane share one reference."""
    angle=radians(tilt)
    normal=Vector((0,sin(angle),cos(angle)))
    center=Vector((x,y,z))
    frame=w.block(name+'黄铜座',center,(width+1.38,height+1.13,.82),'patinated-brass',.23,group)
    frame.rotation_euler.x=-angle
    porcelain=w.block(name+'象牙瓷片',center+normal*.49,(width,height,.25),'ivory',.13,group)
    porcelain.rotation_euler.x=-angle
    pos=center+normal*.63
    return dict(at=[pos.x,pos.z,pos.y],angle=angle,width=width-.44,height=height-.36)


def marker(w, x, y, z, group):
    w.turning('压选钮',(x,y),[(z,1.07),(z+.13,1.50),(z+.62,1.50),
              (z+.80,1.29),(z+.88,1.07)],'patinated-brass',group,40)
    w.turning('按钮瓷帽',(x,y),[(z+.82,1.07),(z+.93,1.07),
              (z+1.01,.94)],'blue-enamel',group,36)
    for i in range(20):
        a = tau*i/20
        xx,yy = x+1.5*cos(a),y+1.5*sin(a)
        w.shaft('滚花',(xx,yy,z+.20),(xx,yy,z+.57),.075,'burnished-brass',group,6)
