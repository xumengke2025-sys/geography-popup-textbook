"""Build native editable Blender scenes from the geometry of the live two instruments."""
import base64,json,sys
from pathlib import Path
import bpy,numpy as np
from mathutils import Matrix,Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from earth_material import apply_scan
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'work/botanical-blender-transfer'
OUT=ROOT/'release/Blender/制作素材'
basis=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def array(raw,dtype):return np.frombuffer(base64.b64decode(raw),dtype)
def read_mesh(raw,name):
 mesh=bpy.data.meshes.new(name);points=array(raw['p'],'<f4').reshape(-1,3)
 indices=array(raw['i'],'<u4').astype(np.int32) if raw['i'] else np.arange(len(points),dtype=np.int32)
 mesh.vertices.add(len(points));mesh.vertices.foreach_set('co',points.flatten())
 mesh.loops.add(len(indices));mesh.loops.foreach_set('vertex_index',indices)
 mesh.polygons.add(len(indices)//3);mesh.polygons.foreach_set('loop_start',np.arange(0,len(indices),3,dtype=np.int32))
 mesh.polygons.foreach_set('use_smooth',np.ones(len(indices)//3,dtype=np.bool_))
 if raw['c']:
  attr=mesh.color_attributes.new(name='色泽',type='FLOAT_COLOR',domain='POINT')
  rgb=array(raw['c'],'<f4').reshape(-1,3);rgba=np.ones((len(points),4),dtype=np.float32);rgba[:,:3]=rgb
  attr.data.foreach_set('color',rgba.flatten())
 mesh.update(calc_edges=True);return mesh
def make_material(part,painted,factor):
 color=tuple(part['color']);scan=part.get('scan') or ('walnut' if part.get('kind')=='wood' else None)
 key=(color,part.get('kind'),scan,part.get('bark'),part.get('rough'),part['metal'],part['opacity'],painted)
 if key in materials:return materials[key]
 mat=bpy.data.materials.new(part['name']+' 实物材质');materials[key]=mat;mat.diffuse_color=(*color,part['opacity']);mat.use_nodes=True
 nodes=mat.node_tree.nodes;link=mat.node_tree.links.new;bsdf=nodes.get('Principled BSDF')
 bsdf.inputs['Base Color'].default_value=(*color,1);bsdf.inputs['Roughness'].default_value=part['rough'];bsdf.inputs['Metallic'].default_value=part['metal']
 bsdf.inputs['Alpha'].default_value=part['opacity']
 if painted:
  v=nodes.new('ShaderNodeVertexColor');v.layer_name='色泽'
  mul=nodes.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[1].default_value=(*color,1)
  link(v.outputs['Color'],mul.inputs[2]);link(mul.outputs[0],bsdf.inputs['Base Color'])
 if scan:apply_scan(mat,scan,factor*(8.7 if scan!='walnut' else 23))
 if part.get('bark'):
  tex=nodes.new('ShaderNodeTexCoord');coord=nodes.new('ShaderNodeVectorMath');coord.operation='MULTIPLY';coord.inputs[1].default_value=(12,.47,12)
  noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=7.5;noise.inputs['Detail'].default_value=2.8
  link(tex.outputs['Generated'],coord.inputs[0]);link(coord.outputs['Vector'],noise.inputs['Vector'])
  bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.24;bump.inputs['Distance'].default_value=.06*factor
  link(noise.outputs['Fac'],bump.inputs['Height']);link(bump.outputs[0],bsdf.inputs['Normal'])
 return mat
def transform(part,factor):
 m=Matrix(np.array(part['ma']).reshape((4,4)).T.tolist())
 return Matrix.Scale(1/factor,4)@basis@m
def label(part,factor):
 name=part['text'];text=bpy.data.curves.new(name,'FONT');text.body=name;text.font=font;text.align_x=text.align_y='CENTER';text.extrude=0
 text.size=min(part['height']*.89,part['width']*.84/max(1,len(name)));text.resolution_u=5
 ob=bpy.data.objects.new(name,text);ob.matrix_world=transform(part,factor);ob.data.materials.append(ink)
 return ob
def configure(scene):
 bpy.context.window.scene=scene;bpy.context.view_layer.update()
 corners=[ob.matrix_world@Vector(corner) for ob in scene.objects if ob.type=='MESH' for corner in ob.bound_box]
 lo=Vector([min(v[i] for v in corners) for i in range(3)]);hi=Vector([max(v[i] for v in corners) for i in range(3)])
 mid=(lo+hi)*.5;w=hi.x-lo.x
 cam=bpy.data.objects.new('标本柜实物观察',bpy.data.cameras.new('观察相机'));scene.collection.objects.link(cam);cam.location=mid+w*Vector((.27,-1.25,.62))
 cam.rotation_euler=(mid-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=w*1.21;cam.data.clip_end=1200;scene.camera=cam
 for d,energy,size in [((-.42,-.65,.92),84000,71),((.55,.23,.57),62000,55)]:
  data=bpy.data.lights.new('柔光窗','AREA');data.energy=energy;data.shape='DISK';data.size=size
  ob=bpy.data.objects.new('柜窗反光',data);scene.collection.objects.link(ob);ob.location=mid+w*Vector(d);ob.rotation_euler=(mid-ob.location).to_track_quat('-Z','Y').to_euler()
 scene.world=bpy.data.worlds.new('植被标本柜环境');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.23,.26,.23,1)
 scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100
def build(id,title,modes,labels):
 global materials,font,ink
 bpy.ops.wm.read_factory_settings(use_empty=True);shapes={};materials={};scenes=[];byid={};first=None
 font=bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc');ink=bpy.data.materials.new('铭文烟黑');ink.diffuse_color=(.053,.045,.025,1)
 for ix,mode in enumerate(modes):
  data=json.loads((SOURCE/(id+'-'+mode+'.json')).read_text('utf8'));factor=data['scale']
  for gid,raw in data['shapes'].items():shapes[gid]=read_mesh(raw,'实物几何')
  if id=='forest' and ix>0:
   for p in data['parts']:
    mat=transform(p,factor);ob=byid[p['id']]
    if all(abs(ob.matrix_world[i][j]-mat[i][j])<1.e-5 for i in range(4) for j in range(4)):continue
    if ob.animation_data is None:
     ob.keyframe_insert('location',frame=1);ob.keyframe_insert('rotation_euler',frame=1)
    ob.matrix_world=mat;ob.keyframe_insert('location',frame=1+ix*40);ob.keyframe_insert('rotation_euler',frame=1+ix*40)
   continue
  scene=bpy.context.scene if ix==0 else bpy.data.scenes.new(labels[ix]);scene.name=labels[ix]
  bpy.context.window.scene=scene;scenes.append(scene)
  if first is None:first=scene
  for p in data['parts']:
   if p.get('text'):ob=label(p,factor)
   else:
    geom=shapes[p['g']];ob=bpy.data.objects.new(p['name'],geom);ob.matrix_world=transform(p,factor)
    mat=make_material(p,bool(geom.color_attributes),factor)
    if not geom.materials:geom.materials.append(mat)
    ob.material_slots[0].link='OBJECT';ob.material_slots[0].material=mat
   scene.collection.objects.link(ob);byid[p['id']]=ob
  configure(scene)
 bpy.context.window.scene=first
 if id=='forest':
  first.frame_end=81;first.frame_set(41)
  for f,t in [(1,'乔木层'),(41,'灌木层'),(81,'草本层')]:first.timeline_markers.new(t,frame=f)
 # Convert inscriptions in every scene so the project has no font dependency.
 for sc in scenes:
  bpy.context.window.scene=sc;bpy.context.view_layer.update();graph=bpy.context.evaluated_depsgraph_get()
  for ob in list(sc.objects):
   if ob.type=='FONT':
    geom=bpy.data.meshes.new_from_object(ob.evaluated_get(graph));copy=bpy.data.objects.new(ob.name+' 铭文',geom)
    sc.collection.objects.link(copy);copy.matrix_world=ob.matrix_world.copy();bpy.data.objects.remove(ob,do_unlink=True)
 bpy.context.window.scene=first
 for area in bpy.context.screen.areas:
  if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.color_type='MATERIAL'
 bpy.context.preferences.filepaths.save_version=0
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(title+'.blend')),compress=True)
 print('SAVED',title,len(scenes),'scenes',sum(len(sc.objects) for sc in scenes),'objects')
build('forest','森林分层升降测光架',['0','0.5','1'],['同一片森林'])
build('vegetation','七类植被腊叶比较柜',list('0123456'),['热带雨林','常绿阔叶林','落叶阔叶林','亚寒带针叶林','热带草原','温带草原','荒漠植被'])
