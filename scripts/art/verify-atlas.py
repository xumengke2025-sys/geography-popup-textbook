import sys, json
from pathlib import Path
import bpy
root=Path(__file__).resolve().parents[2]
catalog=json.loads((root/'docs/handoff/catalog-branch-inventory.json').read_text(encoding='utf-8-sig'))
scenes=list(bpy.data.scenes)
assert len(scenes)==63 and {s.get('catalog_id') for s in scenes}=={f['id'] for f in catalog}
assert sum(s.get('extension',False) for s in scenes)==3
assert {s['chapter'] for s in scenes}==set(range(1,7))
for s in scenes:
    assert s.camera and any(o.type=='MESH' and not o.hide_render for o in s.objects),s.name
for im in bpy.data.images:
    if im.source=='FILE' and im.filepath:
        assert im.packed_file or Path(bpy.path.abspath(im.filepath)).exists(),im.name
for scene in scenes:
    for obj in scene.objects:
        if obj.type != 'MESH':
            continue
        for slot in obj.material_slots:
            mat = slot.material
            if not mat or not mat.get('earthScan'):
                continue
            textures = [n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image]
            assert textures and all(im.packed_file for im in textures), (scene.name, mat.name)
            if mat['earthScan']=='valley':
                assert 'facies' in obj.data.color_attributes and len(obj.data.color_attributes)>=2, (scene.name, obj.name)
                assert len({im.name for im in textures})>=4, mat.name
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX';prefs.refresh_devices()
for dev in prefs.devices: dev.use=dev.type=='OPTIX'
print('VERIFIED SCENES',len(scenes),'MESHES',sum(o.type=='MESH' for s in scenes for o in s.objects),flush=True)
folder=root/'work/blender-atlas/renders'
folder.mkdir(exist_ok=True)
requested=set(sys.argv[sys.argv.index('--')+1:]) if '--' in sys.argv else set()
for s in scenes:
    if requested and s['catalog_id'] not in requested: continue
    s.render.resolution_percentage=75;s.cycles.samples=8;s.render.film_transparent=True
    s.render.image_settings.file_format='PNG'
    s.render.filepath=str(folder/(s['catalog_id']+'.png'))
    bpy.ops.render.render(write_still=True,scene=s.name)
