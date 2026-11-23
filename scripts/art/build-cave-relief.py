"""Rebuild the offline limestone relief with Blender 4.5 LTS in background mode."""
from pathlib import Path
import json
import math
import bpy
from mathutils import Vector, noise

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "src/assets/cave"
STUDIO = ROOT / "work/cave-studio"
ASSETS.mkdir(parents=True, exist_ok=True)
STUDIO.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for backend in ("OPTIX", "CUDA"):
    prefs.compute_device_type = backend
    prefs.refresh_devices()
    devices = [d for d in prefs.devices if d.type == backend]
    if devices:
        for d in prefs.devices:
            d.use = d.type == backend
        scene.cycles.device = "GPU"
        print("CYCLES DEVICE:", backend, [d.name for d in devices], flush=True)
        break

def relief(x, z):
    coarse = noise.noise_vector(Vector((x*.047, z*.069, .43))).x
    broken = noise.fractal(Vector((x*.21, z*.27, .73)), 1.0, 2.0, 4)
    fold = z*.67 + x*.096 + 1.4*math.sin(x*.12) + coarse*.88
    bedding = .78*math.sin(fold) - .55*math.exp(-((math.sin(fold*.5)/.17)**2))
    flutes = .7*math.cos(x*.91 + coarse*2.7 + math.sin(z*.23))
    return 2.5*coarse + bedding + .67*broken + flutes

def stone(x, z):
    y = relief(x, z)
    t = .5+.5*math.sin(z*.67+x*.096+1.4*math.sin(x*.12)+y*.19)
    return (.32+.13*t, .286+.105*t, .229+.083*t, 1)

nx, nz = 480, 240
vertices, faces, colors = [], [], []
for j in range(nz+1):
    z = 42*j/nz
    for i in range(nx+1):
        x = 8+84*i/nx
        vertices.append((x, -relief(x,z), z))
        colors.append(stone(x,z))
        if i<nx and j<nz:
            a=j*(nx+1)+i
            faces.append((a,a+1,a+nx+2,a+nx+1))
mesh = bpy.data.meshes.new("Limestone beds")
mesh.from_pydata(vertices, [], faces)
mesh.update()
attr = mesh.color_attributes.new(name="Mineral",type="FLOAT_COLOR",domain="POINT")
attr.data.foreach_set("color",[c for face in colors for c in face])
for poly in mesh.polygons:
    poly.use_smooth=True
wall=bpy.data.objects.new("Dissolved limestone rear wall",mesh)
scene.collection.objects.link(wall)
mat=bpy.data.materials.new("Limestone with fine calcite grain")
mat.use_nodes=True
tree=mat.node_tree
bsdf=tree.nodes.get("Principled BSDF")
vc=tree.nodes.new("ShaderNodeVertexColor")
vc.layer_name="Mineral"
tree.links.new(vc.outputs["Color"],bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value=.84
grain=tree.nodes.new("ShaderNodeTexNoise")
grain.inputs["Scale"].default_value=190
grain.inputs["Detail"].default_value=3
bump=tree.nodes.new("ShaderNodeBump")
bump.inputs["Strength"].default_value=.21
bump.inputs["Distance"].default_value=.055
tree.links.new(grain.outputs["Fac"],bump.inputs["Height"])
tree.links.new(bump.outputs["Normal"],bsdf.inputs["Normal"])
mesh.materials.append(mat)
def area(name, xyz, target, power, size, rgb):
    light=bpy.data.lights.new(name,"AREA")
    light.energy,light.shape,light.size,light.color=power,"DISK",size,rgb
    obj=bpy.data.objects.new(name,light)
    scene.collection.objects.link(obj)
    obj.location=xyz
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
area("Raking light at cave mouth",(14,-31,57),(49,0,16),36000,29,(1,.9,.76))
area("Reflected skylight",(81,-28,24),(52,0,21),18500,38,(.76,.84,1))
scene.world=bpy.data.worlds.new("Ambient limestone")
scene.world.color=(.22,.22,.22)
bpy.ops.object.camera_add(location=(50,-85,21),rotation=(math.pi/2,0,0))
scene.camera=bpy.context.object
scene.camera.data.type="ORTHO"
scene.camera.data.ortho_scale=84
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x,scene.render.resolution_y=1024,512
scene.render.resolution_percentage=100
scene.render.image_settings.file_format="JPEG"
scene.render.image_settings.quality=91
scene.render.filepath=str(ASSETS/"limestone.jpg")
scene.view_settings.view_transform="AgX"
bpy.ops.wm.save_as_mainfile(filepath=str(STUDIO/"洞壁岩层.blend"))
bpy.ops.render.render(write_still=True)
# Browser mesh displacements use the same physical surface as the lit relief.
cols, rows=64,32
data=[round(relief(8+84*i/cols,42*j/rows)*100) for j in range(rows+1) for i in range(cols+1)]
(ASSETS/"relief.json").write_text(json.dumps(dict(cols=cols,rows=rows,depth=data),separators=(",",":")),encoding="utf8")
