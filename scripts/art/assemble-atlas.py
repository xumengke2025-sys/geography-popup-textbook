"""Assemble all catalog entries as independently editable Blender scenes."""
import bpy
import json
import math
import struct
import sys
import tempfile
from argparse import ArgumentParser
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(Path(__file__).resolve().parent))
from earth_material import apply_scan
cache=root/'work/blender-atlas'
dest=root/'release/Blender'
dest.mkdir(parents=True,exist_ok=True)
output=dest/'地球现场_整册模型.blend'

catalog=json.loads((root/'docs/handoff/catalog-branch-inventory.json').read_text(encoding='utf-8-sig'))
assert len({f['id'] for f in catalog})==63
parser=ArgumentParser()
parser.add_argument('--figure')
parser.add_argument('--output',type=Path)
parser.add_argument('--replace',action='store_true')
parser.add_argument('--base',type=Path)
parser.add_argument('--update',nargs='+',metavar='ID')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
single=args.figure
changed=set(args.update or [])
if bool(args.base)!=bool(changed) or (args.base and (single or not args.output)):
    parser.error('Use --base BASE.blend --update ID ... --output NEW.blend to revise a catalog')
if changed-{f['id'] for f in catalog}:
    parser.error('Unknown catalog ID in --update')
if single:
    catalog = [f for f in catalog if f['id']==single]
    if not catalog: raise ValueError(single)
    output = dest/'制作素材'/(single+'.blend')
    output.parent.mkdir(parents=True,exist_ok=True)
if args.output:
    output=args.output.resolve()
if args.base and args.base.resolve()==output:
    parser.error('Provide a separate output for the revised catalog')
if output.exists() and not args.replace: raise FileExistsError(output)
if args.base:
    bpy.ops.wm.open_mainfile(filepath=str(args.base.resolve()))
    original={s.get('catalog_id'):s for s in bpy.data.scenes}
    if len(original)!=len(bpy.data.scenes) or set(original)!={f['id'] for f in catalog}:
        raise ValueError('Base file does not contain the full matching catalog')
    world=original['solar'].world
    staging=bpy.data.scenes.new('装配工作场景')
    staging.world=world
    bpy.context.window.scene=staging
    for key in changed:
        bpy.data.scenes.remove(original[key])
    bpy.data.orphans_purge(do_recursive=True)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    world=bpy.data.worlds.new('仪器摄影棚')
    world.use_nodes=True
    env=world.node_tree.nodes.new('ShaderNodeTexEnvironment')
    env.image=bpy.data.images.load(str(root/'src/assets/studio/instrument-room.hdr'))
    env.image.pack()
    world.node_tree.links.new(env.outputs['Color'],world.node_tree.nodes['Background'].inputs['Color'])
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
windows=bpy.context.window
existing_materials=set(bpy.data.materials)
def setup(scene,objects):
    visible=[o for o in objects if o.type=='MESH' and not o.hide_render]
    corners=[o.matrix_world@Vector(c) for o in visible for c in o.bound_box]
    lo=Vector([min(p[i] for p in corners) for i in range(3)])
    hi=Vector([max(p[i] for p in corners) for i in range(3)])
    center=(lo+hi)*.5
    span=max((hi-lo).length,.1)
    studio=bpy.data.collections.new('观察相机与光源')
    scene.collection.children.link(studio)
    cam=bpy.data.cameras.new('观察相机')
    camera=bpy.data.objects.new('观察相机',cam)
    studio.objects.link(camera)
    camera.location=center+Vector((.35,-1,.60)).normalized()*span*1.6
    direction=(center-camera.location).to_track_quat('-Z','Y')
    camera.rotation_euler=direction.to_euler()
    cam.type='ORTHO'
    box=[direction.inverted()@(p-center) for p in corners]
    cam.ortho_scale=max(max(q.x for q in box)-min(q.x for q in box),
        1.5*(max(q.y for q in box)-min(q.y for q in box)))*1.14
    cam.clip_end=span*10
    scene.camera=camera
    lamp=bpy.data.lights.new('侧上方柔光','AREA')
    lamp.energy=span*span*36
    lamp.shape='DISK';lamp.size=span*.75
    obj=bpy.data.objects.new('侧上方柔光',lamp)
    studio.objects.link(obj)
    obj.location=center+Vector((-.65,-.8,1.3))*span
    obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.world=world
    scene.render.engine='CYCLES'
    scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.cycles.device='GPU'
    scene.render.resolution_x=720;scene.render.resolution_y=480;scene.render.resolution_percentage=100
    return len(visible)
def import_meshes(source):
    # Browser-only shader attributes (including scalar IDs) have no Blender
    # material binding. Retain the standard geometry and portable vertex colors.
    raw=source.read_bytes()
    size=struct.unpack_from('<I',raw,12)[0]
    data=json.loads(raw[20:20+size])
    # glTF colour sets are consecutive. Some uniformly painted outcrops have
    # mineral/grass/sediment weights but no vertex tint. Reserve neutral white
    # in COLOR_0 so the importer can preserve facies separately as COLOR_1.
    bin_start=20+size
    bin_size,bin_type=struct.unpack_from('<I4s',raw,bin_start)
    assert bin_type==b'BIN\x00'
    payload=bytearray(raw[bin_start+8:bin_start+8+bin_size])
    neutral={}
    def neutral_pigment(count):
        if count not in neutral:
            offset=len(payload)
            payload.extend(b'\xff'*4*count)
            views=data['bufferViews']
            views.append(dict(buffer=0,byteOffset=offset,byteLength=4*count,target=34962))
            neutral[count]=len(data['accessors'])
            data['accessors'].append(dict(bufferView=len(views)-1,componentType=5121,
                count=count,type='VEC4',normalized=True))
        return neutral[count]
    for mesh in data['meshes']:
        for prim in mesh['primitives']:
            attributes=prim['attributes']
            if '_FACIES' in attributes:
                attributes['COLOR_1']=attributes.pop('_FACIES')
                if 'COLOR_0' not in attributes:
                    attributes['COLOR_0']=neutral_pigment(data['accessors'][attributes['POSITION']]['count'])
            prim['attributes']={k:v for k,v in attributes.items() if not k.startswith('_')}
    data['buffers'][0]['byteLength']=len(payload)
    header=json.dumps(data,ensure_ascii=False,separators=(',',':')).encode('utf8')
    header+=b' '*((-len(header))%4)
    tail=struct.pack('<I4s',len(payload),bin_type)+payload
    with tempfile.NamedTemporaryFile(dir=cache,suffix='.glb',delete=False) as file:
        transfer=Path(file.name)
        file.write(struct.pack('<4sIII4s',b'glTF',2,20+len(header)+len(tail),len(header),b'JSON')+header+tail)
    try:
        bpy.ops.import_scene.gltf(filepath=str(transfer),import_pack_images=True)
    finally:
        transfer.unlink()
ink_colors={'structure':(.105,.105,.085,1),'contours':(.115,.116,.096,1),
            'flow':(.046,.226,.257,1),'accent':(.335,.166,.072,1)}
def add_ink(scene, data):
    group=bpy.data.collections.new('剖面线、等值线与过程路径')
    scene.collection.children.link(group)
    for name,lines in data['ink'].items():
        if not lines: continue
        mat_name='绘图墨线 · '+name
        mat=bpy.data.materials.get(mat_name)
        if mat is None:
            mat=bpy.data.materials.new(mat_name)
            mat.diffuse_color=ink_colors[name]
        curve=bpy.data.curves.new(mat_name,'CURVE')
        curve.dimensions='3D';curve.resolution_u=1
        curve.bevel_depth=.0028;curve.bevel_resolution=0
        curve.materials.append(mat)
        for line in lines:
            xyz=line['xyz']
            poly=curve.splines.new('POLY')
            poly.points.add(len(xyz)-1)
            poly.points.foreach_set('co',[v for x,y,z in xyz for v in (.025*x,-.025*z,.025*y,1)])
            width=max(.12,min(2,line['width']))
            poly.points.foreach_set('radius',[width]*len(xyz))
            poly.use_cyclic_u=line['closed']
        obj=bpy.data.objects.new(mat_name,curve)
        group.objects.link(obj)

def finish_material(mat):
    if mat.get('earthScan'):
        apply_scan(mat,mat['earthScan'],mat['scanTileSize'])
        return
    role=mat.name.split(' ')[0]
    if role=='wood':
        apply_scan(mat,'walnut',57)
        return
    if role not in ('brass','wood','steel','rock','land') or not mat.use_nodes: return
    nodes=mat.node_tree.nodes
    bsdf=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
    if bsdf is None or bsdf.inputs['Base Color'].is_linked: return
    base=tuple(bsdf.inputs['Base Color'].default_value)
    tex=nodes.new('ShaderNodeTexNoise');tex.label='材质表面微差'
    tex.inputs['Scale'].default_value={'brass':8,'wood':5,'steel':34,'rock':55,'land':66}[role]
    tex.inputs['Detail'].default_value=3
    if role in ('wood','steel'):
        coords=nodes.new('ShaderNodeTexCoord')
        scale=nodes.new('ShaderNodeVectorMath');scale.operation='MULTIPLY'
        scale.inputs[1].default_value=(.6,10,3)
        mat.node_tree.links.new(coords.outputs['Generated'],scale.inputs[0])
        mat.node_tree.links.new(scale.outputs['Vector'],tex.inputs['Vector'])
    ramp=nodes.new('ShaderNodeValToRGB')
    ramp.label='黄铜氧化与擦亮处' if role=='brass' else '表面色差'
    a,b=ramp.color_ramp.elements
    a.position=.24;b.position=.78
    a.color=tuple(v*(.61 if role=='brass' else .83) for v in base[:3])+(1,)
    b.color=tuple(min(1,v*1.08) for v in base[:3])+(1,)
    mat.node_tree.links.new(tex.outputs['Fac'],ramp.inputs[0])
    mat.node_tree.links.new(ramp.outputs[0],bsdf.inputs['Base Color'])
    if role in ('brass','steel'):
        rough=nodes.new('ShaderNodeMapRange')
        rough.inputs['To Min'].default_value=.22 if role=='brass' else .28
        rough.inputs['To Max'].default_value=.46 if role=='brass' else .40
        mat.node_tree.links.new(tex.outputs['Fac'],rough.inputs['Value'])
        mat.node_tree.links.new(rough.outputs['Result'],bsdf.inputs['Roughness'])
    tex.location=(-540,160);ramp.location=(-270,200);bsdf.location=(30,180)
report=[]
for i,f in enumerate(catalog):
    if changed and f['id'] not in changed:
        s=original[f['id']]
        meshes=[o for o in s.objects if o.type=='MESH']
        report.append(dict(id=f['id'],scene=s.name,meshes=len(meshes),visible=sum(not o.hide_render for o in meshes)))
        continue
    chapter=sum(f['printedPage']>=p for p in [1,27,45,65,81,99])
    scene=bpy.context.scene if i==0 and not args.base else bpy.data.scenes.new(f['id'])
    scene.name=f"{i+1:02d} · {f['title']}"
    windows.scene=scene
    before=set(scene.objects)
    import_meshes(cache/'models'/(f['id']+'.glb'))
    objects=list(set(scene.objects)-before)
    for o in objects:
        if o.type=='MESH' and any(slot.material and slot.material.get('earthScan')=='valley' for slot in o.material_slots):
            attrs=o.data.color_attributes
            if len(attrs)>1:
                attrs[1].name='facies'
        if o.type=='MESH' and not o.get('initiallyVisible',True):
            o.hide_render=True;o.hide_viewport=True
    bpy.context.view_layer.update()
    snapshot=json.loads((cache/'models'/(f['id']+'.json')).read_text(encoding='utf8'))
    scene['phase']=snapshot['phase'];scene['selection']=snapshot['selection']
    add_ink(scene,snapshot)
    count=setup(scene,objects)
    scene.render.film_transparent=True
    assert count>0,f['id']
    scene['catalog_id']=f['id'];scene['printed_page']=f['printedPage'];scene['chapter']=chapter
    scene['conditions']=' / '.join(str(c.get('label',c)) if isinstance(c,dict) else str(c) for c in f['controls'])
    scene['extension']=bool(f['extension'])
    scene['phase_note']='编辑底稿；几何取自当前演示的一次暂停。交互和连续过程由网页源工程驱动。'
    report.append(dict(id=f['id'],scene=scene.name,meshes=sum(o.type=='MESH' for o in objects),visible=count))
for mat in set(bpy.data.materials)-existing_materials: finish_material(mat)
windows.scene=next(s for s in bpy.data.scenes if s.get('catalog_id')==(single or 'solar'))
if args.base:
    bpy.data.scenes.remove(staging)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.overlay.show_overlays=False
        area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
(cache/((single or 'authoring')+'-index.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print('SAVED ATLAS',len(report),sum(r['meshes'] for r in report),flush=True)
