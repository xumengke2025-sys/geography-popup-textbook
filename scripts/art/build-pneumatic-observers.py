"""Create two editable Blender bench instruments, with a separate scene per setting."""
import json
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from earth_material import apply_scan

root=Path(__file__).resolve().parents[2]
source=root/'work/pneumatic-blender-transfer'
out=root/'release/Blender/制作素材'

def import_model(name):
    # View-dependent shader attributes stay in WebGL. The Blender mesh uses
    # the same editable positions, UVs and packed soft-density texture.
    raw=(source/(name+'.glb')).read_bytes();size=struct.unpack_from('<I',raw,12)[0]
    model=json.loads(raw[20:20+size]);tail=raw[20+size:]
    for mesh in model['meshes']:
        for prim in mesh['primitives']:
            prim['attributes']={k:v for k,v in prim['attributes'].items() if not k.startswith('_')}
    header=json.dumps(model,ensure_ascii=False,separators=(',',':')).encode('utf8')
    header+=b' '*((-len(header))%4)
    portable=source/'portable.glb'
    portable.write_bytes(struct.pack('<4sIII4s',b'glTF',2,20+len(header)+len(tail),len(header),b'JSON')+header+tail)
    bpy.ops.import_scene.gltf(filepath=str(portable),import_pack_images=True)

def apply_finish(material):
    if material.get('earthScan'):
        apply_scan(material,material['earthScan'],material['scanTileSize']);return
    role=material.name.split(' ')[0]
    if role=='wood':
        apply_scan(material,'walnut',57)
    if role not in {'brass','steel','historical-glass'} or not material.use_nodes:
        return
    nodes=material.node_tree.nodes
    shader=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
    if role=='historical-glass':
        # Thin optical panes transmit a clean view and only pick up the studio
        # highlight at grazing angles. There are no solid volumes to refract.
        link=material.node_tree.links.new
        clear=nodes.new('ShaderNodeBsdfTransparent')
        reflection=nodes.new('ShaderNodeBsdfGlossy');reflection.inputs['Color'].default_value=(.82,.94,.91,1)
        reflection.inputs['Roughness'].default_value=.12
        fresnel=nodes.new('ShaderNodeFresnel');fresnel.inputs['IOR'].default_value=1.46
        mix=nodes.new('ShaderNodeMixShader');link(fresnel.outputs[0],mix.inputs[0]);link(clear.outputs[0],mix.inputs[1]);link(reflection.outputs[0],mix.inputs[2])
        target=next(n for n in nodes if n.type=='OUTPUT_MATERIAL');link(mix.outputs[0],target.inputs['Surface'])
        return
    link=material.node_tree.links.new
    noise=nodes.new('ShaderNodeTexNoise');noise.label='细斑氧化和擦亮处'
    noise.inputs['Scale'].default_value=8.2 if role=='brass' else 25
    noise.inputs['Detail'].default_value=3.6
    color=tuple(shader.inputs['Base Color'].default_value)
    ramp=nodes.new('ShaderNodeValToRGB')
    for stop,intensity in zip(ramp.color_ramp.elements,(.70,1.10)):
        stop.color=tuple(min(1,k*intensity) for k in color[:3])+(1,)
    link(noise.outputs['Fac'],ramp.inputs[0]);link(ramp.outputs[0],shader.inputs['Base Color'])
    rough=nodes.new('ShaderNodeMapRange');rough.inputs['To Min'].default_value=.21;rough.inputs['To Max'].default_value=.49
    link(noise.outputs['Fac'],rough.inputs['Value']);link(rough.outputs['Result'],shader.inputs['Roughness'])

def pressure_trace(scene,phase_lines):
    if not phase_lines:return
    curve=bpy.data.curves.new('丝带方向与水平流线','CURVE');curve.dimensions='3D';curve.bevel_depth=.003
    for line in phase_lines:
        if len(line['xyz'])<2:continue
        poly=curve.splines.new('POLY');poly.points.add(len(line['xyz'])-1)
        poly.points.foreach_set('co',[v for x,y,z in line['xyz'] for v in (.025*x,-.025*z,.025*y,1)])
    material=bpy.data.materials.new('测风示线');material.diffuse_color=(.044,.22,.24,1)
    curve.materials.append(material);scene.collection.objects.link(bpy.data.objects.new(curve.name,curve))

def stage(scene,environment):
    bpy.context.view_layer.update()
    corners=[o.matrix_world@Vector(p) for o in scene.objects if o.type=='MESH' and not o.hide_render and '气溶胶' not in o.name for p in o.bound_box]
    lo=Vector([min(v[i] for v in corners) for i in range(3)]);hi=Vector([max(v[i] for v in corners) for i in range(3)])
    mid=(lo+hi)/2;span=(hi-lo).length
    cam=bpy.data.objects.new('试验台观察相机',bpy.data.cameras.new('试验台观察相机'));scene.collection.objects.link(cam)
    cam.location=mid+span*Vector((.28,-1.2,.78));cam.rotation_euler=(mid-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';basis=cam.rotation_euler.to_quaternion().inverted()
    plane=[basis@(corner-mid) for corner in corners]
    width=max(v.x for v in plane)-min(v.x for v in plane);height=max(v.y for v in plane)-min(v.y for v in plane)
    cam.data.ortho_scale=max(width,height*1120/760)*1.13;scene.camera=cam
    for point,strength,size in [((-.55,-.66,.98),34,.73),((.64,-.19,.53),12,.45)]:
        light=bpy.data.lights.new('实验室高窗','AREA');light.shape='DISK';light.size=size*span;light.energy=span*span*strength
        ob=bpy.data.objects.new('实验室高窗',light);scene.collection.objects.link(ob);ob.location=mid+span*Vector(point);ob.rotation_euler=(mid-ob.location).to_track_quat('-Z','Y').to_euler()
    scene.world=environment;scene.render.engine='CYCLES';scene.cycles.samples=64;scene.cycles.use_denoising=True
    scene.render.resolution_x=1120;scene.render.resolution_y=760;scene.render.resolution_percentage=100;scene.render.film_transparent=True

def build(identifier,title,labels,printed_page,phases,min_meshes=70):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    env=bpy.data.worlds.new('仪器摄影棚');env.use_nodes=True
    tex=env.node_tree.nodes.new('ShaderNodeTexEnvironment');tex.image=bpy.data.images.load(str(root/'src/assets/studio/instrument-room.hdr'));tex.image.pack()
    env.node_tree.links.new(tex.outputs['Color'],env.node_tree.nodes['Background'].inputs['Color']);env.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
    scenes=[]
    for index,label in enumerate(labels):
        scene=bpy.context.scene if index==0 else bpy.data.scenes.new(label);scene.name=label;bpy.context.window.scene=scene;scenes.append(scene)
        name=f'{identifier}-{index}'
        import_model(name)
        for obj in scene.objects:
            if obj.type=='MESH' and not obj.get('initiallyVisible',True):obj.hide_render=obj.hide_viewport=True
        pressure_trace(scene,json.loads((source/(name+'.json')).read_text('utf8')))
        scene['打印页']=printed_page;scene['观察位置']=phases[index];scene['实验条件']=label
        stage(scene,env)
    for mat in bpy.data.materials:apply_finish(mat)
    bpy.context.window.scene=scenes[0]
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL';area.spaces.active.overlay.show_overlays=False
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(title+'.blend')),compress=True)
    bpy.ops.wm.open_mainfile(filepath=str(out/(title+'.blend')))
    assert len(bpy.data.scenes)==len(labels)
    for sc in bpy.data.scenes:
        assert sc.camera and sum(o.type=='MESH' and not o.hide_render for o in sc.objects)>=min_meshes
    assert all(image.packed_file for image in bpy.data.images if image.source=='FILE')
    print('REOPENED',title,[(sc.name,sum(o.type=='MESH' and not o.hide_render for o in sc.objects)) for sc in bpy.data.scenes],flush=True)

if __name__=='__main__':
    build('pressure-wind','双缸同高风道与差压计',['存在气压差','气压相同'],38,[.89,.89])
    build('haze','通风与减排观察烟箱',['排放积聚','通风扩散','减少排放'],43,[.89,.89,.89])
