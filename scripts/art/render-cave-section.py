"""Render a registered frontal limestone section for the native 2-D reader."""
from pathlib import Path
from math import pi, cos, sin, exp, sqrt
import bpy, bmesh
from mathutils import Vector, noise
root=Path(__file__).resolve().parents[2]
studio=root/'release/Blender/制作素材'
bpy.ops.wm.read_factory_settings(use_empty=True)
def append(file, name):
    with bpy.data.libraries.load(str(studio/file),link=False) as (source,dest):
        dest.objects=[name]
    obj=dest.objects[0]
    bpy.context.scene.collection.objects.link(obj)
    return obj

arch=append('溶洞剖切拱缘.blend','地下岩溶 · 前缘标本')
wall=append('洞壁岩层.blend','Dissolved limestone rear wall')
wall.location.y=6.8
def roof(x):
    u=x/100
    return 10+sqrt(max(0,1-((u-.5)/.4)**2))*(25+2.5*sin(19*u)+1.4*cos(43*u)-1.3*abs(sin(31*u)))
bm=bmesh.new()
bm.from_mesh(wall.data)
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not (9.8<=v.co.x<=90.2 and 3<=v.co.z<=roof(v.co.x)+.8)],context='VERTS')
bm.to_mesh(wall.data);bm.free()

# Broken beds over a broad wavelength and finer spar crystals across the cut.
def cut_stone(material):
    nodes=material.node_tree.nodes; link=material.node_tree.links.new
    bsdf=nodes.get('Principled BSDF')
    tex=nodes.new('ShaderNodeTexCoord')
    noise_node=nodes.new('ShaderNodeTexNoise');noise_node.inputs['Scale'].default_value=.85
    noise_node.inputs['Detail'].default_value=4
    link(tex.outputs['Object'],noise_node.inputs['Vector'])
    bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.32;bump.inputs['Distance'].default_value=.22
    link(noise_node.outputs['Fac'],bump.inputs['Height']);link(bump.outputs['Normal'],bsdf.inputs['Normal'])
    sep=nodes.new('ShaderNodeSeparateXYZ');link(tex.outputs['Object'],sep.inputs[0])
    def math(op,a,b):
        n=nodes.new('ShaderNodeMath');n.operation=op
        for i,x in enumerate([a,b]):
            if isinstance(x,(float,int)):n.inputs[i].default_value=x
            else:link(x,n.inputs[i])
        return n.outputs[0]
    fold=math('ADD',math('MULTIPLY',sep.outputs['X'],.11),math('MULTIPLY',sep.outputs['Z'],1.08))
    fold=math('ADD',fold,math('MULTIPLY',noise_node.outputs['Fac'],1.15))
    band=math('SINE',fold,0)
    ramp=nodes.new('ShaderNodeValToRGB')
    # Sine is centred at zero; shift explicitly to cover the full ramp.
    link(math('ADD',math('MULTIPLY',band,.5),.5),ramp.inputs[0])
    cr=ramp.color_ramp;cr.elements[0].color=(.24,.182,.112,1);cr.elements[1].color=(.66,.57,.395,1)
    cr.elements.new(.12).color=(.44,.36,.235,1)
    cr.elements.new(.23).color=(.63,.53,.36,1)
    cr.elements.new(.72).color=(.53,.447,.31,1)
    link(ramp.outputs[0],bsdf.inputs['Base Color'])
cut_stone(arch.data.materials[0])

# The three receiving points are registered to z=4 in both web modes.
verts=[];faces=[]
nx,ny=140,30
for j in range(ny+1):
    v=j/ny
    for i in range(nx+1):
        x=4+92*i/nx; d=-10+24*v
        w=noise.fractal(Vector((x*.18,d*.17,.6)),1,2,3)
        h=4+.19*w+.31*sin(x*.28+d*.42)
        for cx,cd in [(29,6),(50,8),(72,6)]:
            h=4+(h-4)*min(1,((x-cx)**2+(d-cd)**2)/16)
        if j==ny:
            d+=.6*sin(x*.24)+.27*w
        verts.append((x,-d,h))
        if j<ny and i<nx:
            a=j*(nx+1)+i;faces.append((a,a+nx+1,a+nx+2,a+1))
edge=list(range(nx+1))+[j*(nx+1)+nx for j in range(1,ny+1)]+[ny*(nx+1)+i for i in range(nx-1,-1,-1)]+[j*(nx+1) for j in range(ny-1,0,-1)]
for i,a in enumerate(edge):
    b=edge[(i+1)%len(edge)]
    c=len(verts);verts.extend([(verts[k][0],verts[k][1],1+.3*sin(verts[k][0]*.2)) for k in (a,b)])
    faces.append((a,b,c+1,c))
mesh=bpy.data.meshes.new('层状洞底');mesh.from_pydata(verts,[],faces);mesh.update()
floor=bpy.data.objects.new('滴水承接面',mesh);bpy.context.scene.collection.objects.link(floor)
mesh.materials.append(arch.data.materials[0])

def light(name,loc,target,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color
    obj=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(obj);obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
light('左侧洞口自然光',(12,-50,65),(45,0,18),77000,32,(1,.88,.7))
light('右侧漫反射',(89,-28,27),(58,5,18),12000,30,(.72,.85,1))
light('顶部掠射光',(67,10,73),(45,0,25),32000,21,(1,.94,.81))
scene=bpy.context.scene
scene.world=bpy.data.worlds.new('洞内散射');scene.world.color=(.08,.08,.085)
bpy.ops.object.camera_add(location=(50,-100,22),rotation=(pi/2,0,0));scene.camera=bpy.context.object
scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=100
scene.camera.data.clip_end=250
scene.render.engine='CYCLES'
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX';prefs.refresh_devices()
for dev in prefs.devices:dev.use=dev.type=='OPTIX'
scene.cycles.device='GPU';scene.cycles.samples=32;scene.cycles.use_denoising=True
scene.render.film_transparent=True
scene.render.resolution_x=1200;scene.render.resolution_y=720;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='WEBP';scene.render.image_settings.color_mode='RGBA';scene.render.image_settings.quality=92
scene.render.filepath=str(root/'src/assets/cave/section.webp')
dest=studio/'溶洞正剖面摄影.blend'
if dest.exists(): raise FileExistsError(dest)
bpy.ops.wm.save_as_mainfile(filepath=str(dest),compress=True)
bpy.ops.render.render(write_still=True)
