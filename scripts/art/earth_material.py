"""Physical surface scans for native specimens. Coordinates are in workshop units."""
from pathlib import Path
import bpy

TEXTURES = Path(__file__).resolve().parents[2] / 'public/textbook/materials'

def apply_scan(material, kind, tile_size):
    if material.get('earth_scan') == kind and material.get('earth_span') == tile_size:
        return material
    material.use_nodes = True
    nodes, link = material.node_tree.nodes, material.node_tree.links.new
    bsdf = next(node for node in nodes if node.type == 'BSDF_PRINCIPLED')
    def math_node(operation, a, b):
        node = nodes.new('ShaderNodeMath')
        node.operation = operation
        for i, val in enumerate([a,b]):
            if isinstance(val, (int,float)):
                node.inputs[i].default_value = val
            else:
                link(val, node.inputs[i])
        return node.outputs[0]
    def scan(name, repeat):
        image = bpy.data.images.load(str(TEXTURES / (name+'.webp')), check_existing=True)
        image.colorspace_settings.name = 'Non-Color'
        image.alpha_mode = 'CHANNEL_PACKED'
        if not image.packed_file:
            image.pack()
        tex = nodes.new('ShaderNodeTexImage')
        tex.label, tex.image = name, image
        tex.projection, tex.projection_blend = 'BOX', .19
        coord = nodes.new('ShaderNodeVectorMath')
        coord.operation = 'SCALE'
        coord.inputs['Scale'].default_value = repeat / tile_size
        link(object_coords, coord.inputs[0])
        link(coord.outputs[0], tex.inputs['Vector'])
        return tex.outputs['Color'], tex.outputs['Alpha']

    object_coords = nodes.new('ShaderNodeTexCoord').outputs['Object']
    if kind == 'valley':
        # Each vertex carries contributions from bare rock, gravel and cover.
        # Unassigned weight belongs to exposed soil.
        attr = nodes.new('ShaderNodeVertexColor')
        attr.layer_name = 'facies'
        sep = nodes.new('ShaderNodeSeparateColor')
        link(attr.outputs['Color'],sep.inputs[0])
        amounts = [sep.outputs[i] for i in range(3)]
        amounts.append(math_node('SUBTRACT',1,math_node('ADD',math_node('ADD',amounts[0],amounts[1]),amounts[2])))
        total = None
        warmth_sum = None
        for weight,(name,repeat) in zip(amounts,[('outcrop',.70),('alluvium',1.35),('turf',1.13),('loam',1)]):
            mul = nodes.new('ShaderNodeVectorMath')
            mul.operation = 'SCALE'
            link(weight,mul.inputs['Scale'])
            colour, pigment = scan(name, repeat)
            link(colour,mul.inputs[0])
            contribution = math_node('MULTIPLY', weight, pigment)
            warmth_sum = contribution if warmth_sum is None else math_node('ADD', warmth_sum, contribution)
            if total is None:
                total = mul.outputs[0]
            else:
                add = nodes.new('ShaderNodeVectorMath')
                add.operation = 'ADD'
                link(total,add.inputs[0])
                link(mul.outputs[0],add.inputs[1])
                total = add.outputs[0]
        surface, pigment = total, warmth_sum
    else:
        surface, pigment = scan(kind, 1)
    channels = nodes.new('ShaderNodeSeparateColor')
    link(surface,channels.inputs[0])
    albedo,height,rough = (channels.outputs[i] for i in range(3))
    color = bsdf.inputs['Base Color']
    original = color.links[0].from_socket if color.is_linked else None
    mix = nodes.new('ShaderNodeMixRGB')
    mix.blend_type, mix.inputs[0].default_value = 'MULTIPLY', 1
    if original:
        link(original,mix.inputs[1])
    else:
        mix.inputs[1].default_value = color.default_value
    if kind == 'walnut':
        link(math_node('ADD',.39,math_node('MULTIPLY',albedo,1.22)),mix.inputs[2])
    else:
        warmth = math_node('MULTIPLY', 1/128, math_node('SUBTRACT',math_node('MULTIPLY',255,pigment),128))
        value = math_node('ADD', .43, math_node('MULTIPLY',albedo,1.14))
        dye = nodes.new('ShaderNodeCombineColor')
        for i, coefficient in enumerate([.86,.10,-.94]):
            gain = math_node('POWER',2.718281828,math_node('MULTIPLY',coefficient,warmth))
            link(math_node('MULTIPLY',gain,value),dye.inputs[i])
        link(dye.outputs[0],mix.inputs[2])
    link(mix.outputs[0],color)
    base_rough = bsdf.inputs['Roughness'].default_value
    if kind == 'walnut':
        link(math_node('ADD',base_rough-.07,math_node('MULTIPLY',rough,.14)),bsdf.inputs['Roughness'])
    else:
        link(math_node('ADD',base_rough*.52,math_node('MULTIPLY',rough,.48)),bsdf.inputs['Roughness'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .76
    bump.inputs['Distance'].default_value = tile_size * (.0018 if kind == 'walnut' else .033)
    link(math_node('ADD',math_node('MULTIPLY',height,.79),math_node('MULTIPLY',albedo,.21)),bump.inputs['Height'])
    link(bump.outputs[0],bsdf.inputs['Normal'])
    material['earth_scan'], material['earth_span'] = kind, tile_size
    return material
