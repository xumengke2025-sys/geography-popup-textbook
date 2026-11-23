"""Mesh authoring, material envelopes and the small real-time mesh transfer."""
from array import array
from base64 import b64encode
import json
from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
PALETTE = {
    'walnut': ('wood', '553b2a', .07, .40),
    'bronze': ('brass', '927041', .83, .43),
    'brass': ('brass', 'b18a50', .84, .32),
    'gold': ('brass', 'd1b27a', .88, .25),
    'steel': ('steel', 'a5a79a', .81, .32),
    'teal': ('enamel', '374e45', .13, .33),
    'ivory': ('ivory', 'e9ddbe', .03, .43),
    'ink': ('enamel', '474c3f', .04, .62),
    'red': ('enamel', 'ad5843', .12, .37),
    'blue': ('enamel', '4b7185', .12, .37),
    'deep-teal': ('enamel', '376a6e', .12, .35),
    'gray': ('enamel', '7e715a', .12, .37),
    'ochre': ('rock', 'b08a68', 0, .84),
    'shale': ('rock', '807b70', 0, .84),
    'clay': ('rock', '976351', 0, .82),
    'strata-ink': ('rock', '544f49', 0, .84),
    'meadow': ('land', '9fa681', 0, .86),
    'sediment': ('rock', 'b69b76', 0, .79),
    'willow': ('plant', '63784c', 0, .82),
    'young-leaf': ('plant', '88945f', 0, .83),
    'bark': ('wood', '624c34', 0, .81),
    'river': ('water', '5c9397', .08, .32),
    'lake': ('water', '6c8f8b', .02, .31),
    'chip-on': ('enamel', 'e5af55', .06, .32),
    'chip-off': ('enamel', '38565b', .10, .39),
}


def linear_rgb(hex_color):
    def channel(index):
        value = int(hex_color[index:index + 2], 16) / 255
        return value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4
    return tuple(channel(index) for index in (0, 2, 4))


class Workshop:
    def __init__(self, name, colors=None):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.scene = bpy.context.scene
        self.scene.name = name
        self.parts = []
        self.materials = {}
        self.palette = PALETTE | (colors or {})

    def material(self, finish):
        if finish in self.materials:
            return self.materials[finish]
        role, color, metalness, roughness = self.palette[finish]
        material = bpy.data.materials.new(finish)
        material.diffuse_color = (*linear_rgb(color), 1)
        material.use_nodes = True
        nodes, links = material.node_tree.nodes, material.node_tree.links
        shader = nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = material.diffuse_color
        shader.inputs['Metallic'].default_value = metalness
        shader.inputs['Roughness'].default_value = roughness
        if role in {'brass', 'wood', 'rock', 'land'}:
            coord = nodes.new('ShaderNodeTexCoord')
            direction = nodes.new('ShaderNodeVectorMath')
            direction.operation = 'MULTIPLY'
            direction.inputs[1].default_value = (1.8, 6.5, 18) if role == 'wood' else (4, 4, 4)
            surface = nodes.new('ShaderNodeTexNoise')
            surface.inputs['Scale'].default_value = 3.7
            surface.inputs['Detail'].default_value = 4
            links.new(coord.outputs['Generated'], direction.inputs[0])
            links.new(direction.outputs[0], surface.inputs[0])
            ramp = nodes.new('ShaderNodeValToRGB')
            values = (.43, 1.24) if role == 'brass' else (.65, 1.17)
            for stop, value in zip(ramp.color_ramp.elements, values):
                stop.color = tuple(min(1, component * value) for component in material.diffuse_color[:3]) + (1,)
            links.new(surface.outputs['Fac'], ramp.inputs[0])
            links.new(ramp.outputs[0], shader.inputs['Base Color'])
            micro = nodes.new('ShaderNodeTexNoise')
            micro.inputs['Scale'].default_value = 82 if role in {'wood', 'brass'} else 46
            micro.inputs['Detail'].default_value = 2
            links.new(direction.outputs[0], micro.inputs[0])
            bump = nodes.new('ShaderNodeBump')
            bump.inputs['Strength'].default_value = .12 if role == 'brass' else .25
            bump.inputs['Distance'].default_value = .04 if role == 'brass' else .15
            links.new(micro.outputs['Fac'], bump.inputs['Height'])
            links.new(bump.outputs[0], shader.inputs['Normal'])
        self.materials[finish] = material
        return material

    def register(self, obj, name, finish, group):
        obj.name = name
        obj.data.materials.append(self.material(finish))
        if group:
            self.parts.append((obj, finish, group))
        return obj

    def mesh(self, name, vertices, faces, finish, group='frame', smooth=False):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(vertices, [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        self.scene.collection.objects.link(obj)
        if smooth:
            for polygon in mesh.polygons:
                polygon.use_smooth = True
        return self.register(obj, name, finish, group)

    def paint(self, obj, colors):
        pigment = obj.data.color_attributes.new(name='pigment', type='FLOAT_COLOR', domain='POINT')
        for swatch, color in zip(pigment.data, colors):
            swatch.color = (*color, 1)
        material = obj.data.materials[0].copy()
        obj.data.materials[0] = material
        nodes = material.node_tree.nodes
        pigment_node = nodes.new('ShaderNodeVertexColor')
        pigment_node.layer_name = 'pigment'
        material.node_tree.links.new(pigment_node.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])

    def block(self, name, center, size, finish, bevel=.22, group='frame'):
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        obj = bpy.context.object
        obj.dimensions = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if bevel:
            modifier = obj.modifiers.new('倒角', 'BEVEL')
            modifier.width, modifier.segments = bevel, 3
            obj.modifiers.new('平面法线', 'WEIGHTED_NORMAL')
        return self.register(obj, name, finish, group)

    def shaft(self, name, start, end, radius, finish, group='frame', segments=24, tip=None):
        axis = Vector(end) - Vector(start)
        bpy.ops.mesh.primitive_cone_add(
            vertices=segments, radius1=radius, radius2=radius if tip is None else tip,
            depth=axis.length, location=(Vector(start) + Vector(end)) / 2,
        )
        obj = bpy.context.object
        obj.rotation_euler = axis.to_track_quat('Z', 'Y').to_euler()
        for poly in obj.data.polygons:
            poly.use_smooth = len(poly.vertices) <= 4
        return self.register(obj, name, finish, group)

    def turning(self, name, center, profile, finish, group='frame', segments=64, loop=False):
        x, y = center
        vertices = [(x + r*cos(a*2*pi/segments), y + r*sin(a*2*pi/segments), z)
                    for z, r in profile for a in range(segments)]
        rows = len(profile)
        faces = [(
            row*segments+i, row*segments+(i+1)%segments,
            ((row+1)%rows)*segments+(i+1)%segments, ((row+1)%rows)*segments+i,
        ) for row in range(rows if loop else rows-1) for i in range(segments)]
        if not loop:
            faces.append(tuple(reversed(range(segments))))
            faces.append(tuple(range(len(vertices)-segments, len(vertices))))
        obj = self.mesh(name, vertices, faces, finish, group)
        for face in obj.data.polygons:
            face.use_smooth = len(face.vertices) == 4
        return obj

    def curve(self, name, points, radius, finish, group='frame', cyclic=False):
        data = bpy.data.curves.new(name, 'CURVE')
        data.dimensions, data.bevel_depth, data.bevel_resolution = '3D', radius, 1
        spline = data.splines.new('POLY')
        spline.points.add(len(points)-1)
        for point, value in zip(spline.points, points):
            point.co = (*value, 1)
        spline.use_cyclic_u = cyclic
        obj = bpy.data.objects.new(name, data)
        self.scene.collection.objects.link(obj)
        return self.register(obj, name, finish, group)

    def screw(self, x, y, z, size=1, group='frame'):
        self.shaft('沉头螺钉', (x,y,z), (x,y,z+.24*size), .53*size, 'gold', group, 18)
        self.block('一字槽', (x,y,z+.245*size), (.68*size,.10*size,.035*size), 'ink', .01, group)

    def join_movement(self, group, center, name):
        pivot = bpy.data.objects.new(name, None)
        self.scene.collection.objects.link(pivot)
        pivot.location = center
        bpy.context.view_layer.update()
        for obj, _, part_group in self.parts:
            if part_group == group:
                world = obj.matrix_world.copy()
                obj.parent = pivot
                obj.matrix_world = world
        return pivot

    def export(self, asset_id, extra=None, positive_depth=False):
        """Batch mesh triangles by movement and surface, preserving their normals."""
        bpy.context.view_layer.update()
        graph = bpy.context.evaluated_depsgraph_get()
        batches = {}
        painted = set()
        facies_groups = set()
        for source, finish, group in self.parts:
            obj = source.evaluated_get(graph)
            mesh = obj.to_mesh()
            mesh.calc_loop_triangles()
            pigment = mesh.color_attributes.get('pigment')
            facies = mesh.color_attributes.get('facies')
            if facies:
                facies_groups.add((group,finish))
            if pigment:
                painted.add((group,finish))
            matrix = obj.matrix_world
            # Positive-depth transfer reflects the specimen. Counter-reflect
            # front-facing engravings about their own centered baseline.
            mirrored_lettering = positive_depth and source.type == 'FONT'
            if mirrored_lettering:
                matrix = matrix @ Matrix.Diagonal((-1, 1, 1, 1))
            normal_matrix = matrix.to_3x3().inverted().transposed()
            vertices, indices, lookup = batches.setdefault((group, finish), ([], [], {}))
            for face in mesh.loop_triangles:
                for corner in (reversed(face.loops) if positive_depth != mirrored_lettering else face.loops):
                    vertex = mesh.loops[corner].vertex_index
                    p = matrix @ mesh.vertices[vertex].co
                    n = (normal_matrix @ mesh.corner_normals[corner].vector).normalized()
                    front = 1 if positive_depth else -1
                    color = tuple(round(max(0,min(1,value))*255) for value in pigment.data[vertex].color[:3]) if pigment else (255,255,255)
                    key = (tuple(round(v*100) for v in (p.x,p.z,front*p.y))
                           + tuple(round(v*127) for v in (n.x,n.z,front*n.y)) + color)
                    if facies:
                        key += tuple(round(max(0,min(1,value))*255) for value in facies.data[vertex].color[:3])
                    if key not in lookup:
                        lookup[key] = len(vertices)
                        vertices.append(key)
                    indices.append(lookup[key])
            obj.to_mesh_clear()

        def pack(typecode, values):
            return b64encode(array(typecode, values).tobytes()).decode('ascii')

        parts = []
        for (group, finish), (vertices, indices, _) in batches.items():
            assert len(vertices) < 65536, (group, finish, len(vertices))
            role, color, metalness, roughness = self.palette[finish]
            part = dict(group=group, finish=role, color='#'+color, metalness=metalness, roughness=roughness,
                        p=pack('h', (v for row in vertices for v in row[:3])),
                        n=pack('b', (v for row in vertices for v in row[3:6])),
                        i=pack('H', indices))
            if (group,finish) in painted:
                part['c'] = pack('B', (v for row in vertices for v in row[6:9]))
            if (group,finish) in facies_groups:
                part['facies'] = pack('B', (v for row in vertices for v in row[9:12]))
            parts.append(part)
        folder = ROOT / 'src/assets/field-instruments'
        folder.mkdir(exist_ok=True)
        data = dict(parts=parts, **(extra or {}))
        (folder / (asset_id + '.json')).write_text(json.dumps(data, separators=(',',':')), encoding='utf8')
        print('EXPORTED', asset_id, len(self.parts), 'editable parts,', len(parts), 'batches', flush=True)

    def photograph(self, asset_id, title, center, camera, width, floor_z=-3.8, detail=None):
        scene = self.scene
        scene.world = bpy.data.worlds.new('摄影棚环境')
        scene.world.color = (.22,.24,.23)
        bpy.ops.mesh.primitive_plane_add(size=950, location=(center[0],center[1],floor_z))
        floor = bpy.context.object
        floor.name = '摄影绒面'
        cloth = bpy.data.materials.new('深灰绿绒面')
        cloth.use_nodes = True
        shader = cloth.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (.024,.031,.029,1)
        shader.inputs['Roughness'].default_value = .91
        floor.data.materials.append(cloth)

        focal_point = Vector(center)
        for name, delta, size, energy, color in [
            ('主柔光箱',(-45,-35,85),65,122000,(1,.89,.74)),
            ('后沿轮廓光',(47,43,66),40,93000,(.78,.88,1)),
            ('前填光',(28,-76,43),52,36000,(1,.95,.84)),
        ]:
            bpy.ops.object.light_add(type='AREA', location=focal_point+Vector(delta))
            obj = bpy.context.object
            obj.name = name
            obj.data.energy, obj.data.size, obj.data.color = energy, size, color
            obj.rotation_euler = (focal_point-obj.location).to_track_quat('-Z','Y').to_euler()

        bpy.ops.object.camera_add(location=focal_point+Vector(camera))
        cam = bpy.context.object
        cam.name = '全貌相机'
        cam.rotation_euler = (focal_point-cam.location).to_track_quat('-Z','Y').to_euler()
        cam.data.type, cam.data.ortho_scale, cam.data.clip_end = 'ORTHO', width, 1500
        scene.camera = cam
        scene.render.engine = 'CYCLES'
        scene.cycles.samples, scene.cycles.use_denoising = 48, True
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'OPTIX'
        prefs.refresh_devices()
        for device in prefs.devices:
            device.use = device.type == 'OPTIX'
        scene.cycles.device = 'GPU' if any(device.use for device in prefs.devices) else 'CPU'
        scene.render.resolution_x, scene.render.resolution_y = 1500, 1000
        scene.render.resolution_percentage = 100
        scene.render.filepath = str(ROOT / 'work' / (asset_id + '-studio.png'))
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.color_type = 'MATERIAL'
                area.spaces.active.shading.show_cavity = True
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'release/Blender/制作素材' / (title + '.blend')), compress=True)
        bpy.ops.render.render(write_still=True)
        if detail:
            target, offset, span = detail
            wide_camera = cam.matrix_world.copy()
            wide_scale, wide_path = cam.data.ortho_scale, scene.render.filepath
            cam.location = Vector(target) + Vector(offset)
            cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z','Y').to_euler()
            cam.data.ortho_scale = span
            scene.render.filepath = str(ROOT / 'work' / (asset_id + '-detail.png'))
            bpy.ops.render.render(write_still=True)
            cam.matrix_world = wide_camera
            cam.data.ortho_scale, scene.render.filepath = wide_scale, wide_path

