"""Build the cutaway cyclone as editable lofts and export their triangulated web meshes."""
from pathlib import Path
import json
from math import cos, sin, pi, exp, ceil, floor, atan2, hypot
import bpy
import bmesh
from mathutils import Vector, noise

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
parts = {}
edges = {}
start, span = -pi / 4, 1.5 * pi
steps = 108

def polar(r, a, h):
    return (50 + r*cos(a), -(40-r*sin(a)), h)

def cloud_tone(key,x,y,z):
    # Thicker, rain-bearing bases grade into sunlit ice at the anvil.
    grain=noise.fractal(Vector((x*.091,y*.091,z*.14)),1,2,3)
    ice=min(1,max(0,(z-5)/45))
    value=.60+.33*ice+.21*grain
    if key in ('wall','crown'):
        a=atan2(y+40,x-50)
        cut=exp(-(min(abs((a-start+pi)%(2*pi)-pi),abs((a-start-span+pi)%(2*pi)-pi))/.095)**2)
        radius=hypot(x-50,y+40)
        streak=sin(radius*1.12-z*.19+.72*grain+1.1*sin(z*.22))
        value+=cut*(-.10+.13*streak+.18*grain)
    value=min(1,max(.33,value))
    return (value*(.87+.12*ice),value*(.95+.05*ice),value)

def make_part(key, title, rows, color):
    width = len(rows[0])
    verts = [p for row in rows for p in row]
    faces = []
    for i in range(len(rows)-1):
        for j in range(width):
            a = i*width+j
            b = i*width+(j+1)%width
            faces.append((a,b,b+width,a+width))
    faces.extend([tuple(reversed(range(width))), tuple(range(len(verts)-width,len(verts)))])
    mesh = bpy.data.meshes.new(title)
    mesh.from_pydata(verts, [], faces)
    bm=bmesh.new()
    bm.from_mesh(mesh)
    for face in bm.faces:
        face.smooth=len(face.verts)==4
    if key in ('wall','crown'):
        caps=[f for f in bm.faces if len(f.verts)>4]
        triangles=bmesh.ops.triangulate(bm,faces=caps)['faces']
        cut_edges=list({edge for f in triangles for edge in f.edges})
        bmesh.ops.subdivide_edges(bm,edges=cut_edges,cuts=3,use_grid_fill=True)
        # The neighbouring loft quads now have extra points on their cut
        # edge. A centre fan keeps each new edge in a nonzero-area triangle.
        transitions=[f for f in bm.faces if len(f.verts)>4]
        if transitions:
            bmesh.ops.poke(bm,faces=transitions,center_mode='MEAN_WEIGHTED')
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj = bpy.data.objects.new(title, mesh)
    bpy.context.collection.objects.link(obj)
    obj.scale.z=.70
    obj.location.z=.60
    mat = bpy.data.materials.new(title)
    mat.diffuse_color = (*color, 1)
    verts=[tuple(v.co) for v in mesh.vertices]
    tones=[cloud_tone(key,*v) for v in verts]
    pigment=mesh.color_attributes.new(name='云底与冰晶',type='FLOAT_COLOR',domain='POINT')
    for sample,rgb in zip(pigment.data,tones):
        sample.color=tuple(v*c for v,c in zip(rgb,color))+(1,)
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    tint=mat.node_tree.nodes.new('ShaderNodeVertexColor')
    tint.layer_name=pigment.name
    mat.node_tree.links.new(tint.outputs['Color'],bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value=.88
    mesh.materials.append(mat)
    mesh.calc_loop_triangles()
    parts[key] = dict(positions=[round(v,3) for x,y,z in verts for v in (x,z,-y)],
                      indices=[v for t in mesh.loop_triangles for v in t.vertices],
                      tones=[round(t*255) for rgb in tones for t in rgb])
    return obj

# Clockwise radial section. Both castings meet along the same shoulder.
wall = [(9,4),(18,4),(19,9),(20,16),(21,24),(22,30),(23.2,35),(10.5,35),(10,25),(9.4,14)]
crown = [(10.5,35),(23.2,35),(25,39),(28,43),(31,45),(33,47),(31,49),(28,50.2),(24,50.5),(20,50),(16,49),(12,47.5),(11.4,44)]

# Staggered convective lobes broaden aloft and feed the thinner anvil. Both
# castings evaluate the same field at their common radial shoulder.
lobes=[]
for level,(count,height) in enumerate(((12,9),(11,19),(12,29),(11,39),(12,47))):
    for j in range(count):
        seed=j*15.91+level*20.17
        lobes.append((2*pi*(j+.32*sin(seed)+.41*level)/count,
                      height+2.8*sin(seed*1.9),.115+.060*(1+cos(seed))*.5,
                      3.3+2.2*(1+sin(seed))*.5,1.6+1.9*(1+cos(seed*.82))*.5))
def cloud_profile(r,h,a):
    grain=noise.fractal(Vector((r*cos(a)*.26,r*sin(a)*.26,h*.24)),1,2,3)
    billow=0
    for theta,z,wa,wh,size in lobes:
        if abs(z-h)>wh*2.5: continue
        da=(a-theta+pi)%(2*pi)-pi
        if abs(da)<wa*2.5:
            billow+=size*exp(-(.5*(da/wa)**2+.72*((h-z)/wh)**2))
    outer=min(1,max(0,(r-10)/9))
    radial=outer*(billow-1+.84*grain)+.28*cos(7*a-h*.08)+(1-outer)*(.72*grain+.49*cos(8*a-h*.19))
    top=min(1,max(0,(h-37)/10))
    # Finite domes merge across the anvil. Jitter their centres and widths
    # so the rim has varied silhouettes even along a single vertical cut.
    x,y=r*cos(a)/6.3,r*sin(a)/6.3
    dome=0
    for i in range(floor(x)-1,floor(x)+2):
        for j in range(floor(y)-1,floor(y)+2):
            seed=i*73.7+j*29.9
            dx=x-i-.5-.29*sin(seed)
            dy=y-j-.5-.26*cos(seed*1.7)
            dome=max(dome,(3.3+sin(seed*.97))*exp(-(dx*dx+dy*dy)*(3.5+cos(seed))))
    lift=top*(.98*grain+1.28*sin(.33*r+2.8*a)+1.16*cos(7*a-r*.20)+dome)
    return polar(r+radial,a,h+lift)

for key, title, profile, shade in [('wall','眼墙 · 上升云塔',wall,(.72,.78,.78)),('crown','冠部 · 云砧',crown,(.9,.9,.82))]:
    fine=[]
    anchors=[]
    for n,(r,h) in enumerate(profile):
        anchors.append(len(fine))
        r1,h1=profile[(n+1)%len(profile)]
        spacing=1.22 if min(h,h1)>43 else 2.8
        segments=max(1,ceil(max(abs(r1-r),abs(h1-h))/spacing))
        fine.extend((r+(r1-r)*j/segments,h+(h1-h)*j/segments) for j in range(segments))
    rows=[]
    for i in range(steps+1):
        a=start+span*i/steps
        rows.append([cloud_profile(r,h,a) for r,h in fine])
    make_part(key,title,rows,shade)
    def web(row):
        return [[round(x,3),round(z,3),round(-y,3)] for x,y,z in row]
    edges[key]=[web(row+[row[0]]) for row in (rows[0],rows[-1])]
    edges[key+'rim']=[web([row[anchors[j]] for row in rows]) for j in ([0,1] if key=='wall' else [5,11])]

# Low rainbands curl inward counterclockwise. Their tapered ends leave the observation cut clear.
for band in range(3):
    rows=[]
    for i in range(49):
        t=i/48
        a=start+.05+band*1.27+t*1.82
        if a>start+span: break
        r=37-17*t+1.35*sin(2*pi*t+band)
        pulse=(.5+.5*cos(29*t+band+1.25*sin(t*13)))**.60
        w=.09+sin(pi*t)**.65*(1.7+1.62*pulse)
        h=4+4*t+1.8*sin(pi*t)
        row=[polar(r+w*cos(k*pi/7),a,h+w*(1.12+.72*pulse)*sin(k*pi/7)) for k in range(14)]
        rows.append(row)
    make_part('band'+str(band),'外围螺旋雨带 '+str(band+1),rows,(.71,.8,.79))

scene=bpy.context.scene
scene.name='成熟台风 · 眼墙与外围雨带'
scene.world=bpy.data.worlds.new('自然光棚')
scene.world.use_nodes=True
studio=scene.world.node_tree.nodes.new('ShaderNodeTexEnvironment')
studio.image=bpy.data.images.load(str(root/'src/assets/studio/instrument-room.hdr'))
studio.image.pack()
background=scene.world.node_tree.nodes.get('Background')
background.inputs['Strength'].default_value=.52
scene.world.node_tree.links.new(studio.outputs['Color'],background.inputs['Color'])
target=Vector((50,-40,18))
def point_at(obj):
    obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
camera_data=bpy.data.cameras.new('剖面相机')
camera=bpy.data.objects.new('剖面相机',camera_data)
scene.collection.objects.link(camera)
camera.location=(87,-142,92)
point_at(camera)
camera_data.type='ORTHO'
camera_data.ortho_scale=112
camera_data.clip_end=400
scene.camera=camera
light_data=bpy.data.lights.new('云层侧光','AREA')
light_data.energy=65000
light_data.shape='DISK'
light_data.size=48
light=bpy.data.objects.new('云层侧光',light_data)
scene.collection.objects.link(light)
light.location=(15,-88,89)
point_at(light)
scene.render.engine='CYCLES'
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.render.resolution_x=900
scene.render.resolution_y=640
scene.render.resolution_percentage=100
scene.render.film_transparent=True
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_location=(50,-40,22)
        area.spaces.active.region_3d.view_distance=115
        area.spaces.active.shading.color_type='MATERIAL'
        area.spaces.active.region_3d.view_perspective='CAMERA'
asset=root/'src/assets/typhoon/cloud.json'
asset.parent.mkdir(parents=True,exist_ok=True)
asset.write_text(json.dumps(dict(parts=parts,edges=edges),separators=(',',':')))
source=root/'release/Blender/制作素材/台风眼墙与雨带.blend'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
