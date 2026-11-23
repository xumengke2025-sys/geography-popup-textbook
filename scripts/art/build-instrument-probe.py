"""Render a reusable linear-light studio probe for the atlas instrument finishes."""
from pathlib import Path
import bpy
import math
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
out=root/'src/assets/studio'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
scene.render.engine='CYCLES'
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX'
prefs.refresh_devices()
if any(d.type=='OPTIX' for d in prefs.devices):
    scene.cycles.device='GPU'
    for d in prefs.devices: d.use=d.type=='OPTIX'
scene.world=bpy.data.worlds.new('Soft grey surround')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.20,.21,.22,1)
def card(name,location,width,height,rgb,strength):
    bpy.ops.mesh.primitive_plane_add(size=1,location=location)
    obj=bpy.context.object
    obj.name=name
    obj.rotation_euler=(-Vector(location)).to_track_quat('Z','Y').to_euler()
    obj.scale=(width,height,1)
    mat=bpy.data.materials.new(name);mat.use_nodes=True
    nodes=mat.node_tree.nodes
    light=nodes.new('ShaderNodeEmission')
    light.inputs[0].default_value=(*rgb,1)
    light.inputs[1].default_value=strength
    mat.node_tree.links.new(light.outputs[0],nodes['Material Output'].inputs[0])
    obj.data.materials.append(mat)
card('Large warm window',(-4,-3,4.5),6.5,3.6,(1,.91,.78),4.2)
card('Cool silk fill',(4,-2,2.8),4.3,4.5,(.77,.87,1),2.4)
card('Vertical highlight',(-2,4,1.8),.78,6.4,(1,.94,.83),6.3)
card('Dark reflection flag',(2.8,3.4,.4),2.4,5.2,(.08,.085,.09),.45)
card('Warm reflected bench',(0,0,-4.5),11,10,(.36,.28,.19),.93)
bpy.ops.object.camera_add(location=(0,0,0),rotation=(math.pi/2,0,0))
scene.camera=bpy.context.object
scene.camera.data.type='PANO'
scene.camera.data.panorama_type='EQUIRECTANGULAR'
scene.cycles.samples=8
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage=512,256,100
scene.render.image_settings.file_format='HDR'
scene.render.filepath=str(out/'instrument-room.hdr')
studio=root/'work/blender-atlas/studio'
studio.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(studio/'仪器反射棚.blend'))
bpy.ops.render.render(write_still=True)
