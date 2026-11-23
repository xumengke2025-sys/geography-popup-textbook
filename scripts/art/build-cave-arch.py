"""Sculpt a cut limestone specimen with a continuous roof and flanking piers."""
from pathlib import Path
from math import cos, sin, pi, sqrt, exp
import json, sys
import bpy
from mathutils import Vector, noise

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
points, colors, triangles = [], [], []
def roof(x):
    u=x/100
    return 10+sqrt(max(0,1-((u-.5)/.4)**2))*(25+2.5*sin(19*u)+1.4*cos(43*u)-1.3*abs(sin(31*u)))

def edge(t,d,inner):
    # Vertical jambs pass into the irregular arch without separate pedestal blocks.
    q=min(1,max(0,(t-.085)/.83))
    a=pi*q
    x=50-(40 if inner else 45)*cos(a)
    h=roof(x) if inner else 10+sin(a)*(33+1.8*sin(a*5)+1.7*cos(a*11))
    end=min(1,t/.085,(1-t)/.085)
    h=3.7+(h-3.7)*max(0,end)
    grain=noise.fractal(Vector((x*.087,h*.12,d*.13)),1,2,3)
    if inner:
        # Keep the roof bonded at the three teaching plumb lines.
        h+=min(1,abs(d-6)*.38,abs(d-8)*.38)*grain*.82*end
    else:
        h+=end*(2.4*grain+.55*cos(x*.58+d*.22))
        x+=grain*.8*cos(a)
    return x,h

def surface(nt,ns,point,face_kind,reverse=False):
    first=len(points)
    for j in range(ns+1):
        for i in range(nt+1):
            x,h,d=point(i/nt,j/ns)
            points.append((x,-d,h))
            n=noise.noise_vector(Vector((x*.23,d*.27,h*.35))).x
            bed=h*.91+x*.10+.94*sin(x*.12+d*.10)
            seam=exp(-(sin(bed*.48)/.18)**2)
            k=.98+.075*sin(bed)+.075*n-.21*seam
            base={'cut':(.61,.51,.35),'outer':(.49,.445,.345),'soffit':(.46,.414,.31)}[face_kind]
            colors.append(tuple(min(1,v*k) for v in base)+(1,))
    for j in range(ns):
        for i in range(nt):
            a=first+j*(nt+1)+i
            for f in [(a,a+1,a+nt+1),(a+1,a+nt+2,a+nt+1)]:
                triangles.append(f if reverse else f[::-1])

def lip(t):
    return 10+1.24*sin(t*27)+.82*cos(t*63)+.36*sin(t*121)

def longitudinal(t,v,inner):
    d=-10.6+(lip(t)+10.6)*v
    x,h=edge(t,d,inner)
    return x,h,d

def section(t,v,front):
    d=lip(t) if front else -10.6
    a,h=edge(t,d,True)
    b,k=edge(t,d,False)
    return a+(b-a)*v,h+(k-h)*v,d+(.24*sin(pi*v)*sin(t*57) if front else 0)

surface(90,12,lambda t,v:longitudinal(t,v,False),'outer')
surface(90,12,lambda t,v:longitudinal(t,v,True),'soffit',True)
surface(90,10,lambda t,v:section(t,v,True),'cut',True)
surface(90,2,lambda t,v:section(t,v,False),'cut')
for t in (0,1):
    def foot(v,q):
        a,h,d=longitudinal(t,q,True); b,k,_=longitudinal(t,q,False)
        return a+(b-a)*v,h+(k-h)*v,d
    surface(3,12,foot,'soffit',t==0)
mesh=bpy.data.meshes.new('灰岩层理与溶蚀拱缘')
mesh.from_pydata(points,[],triangles);mesh.update()
stone=bpy.data.objects.new('地下岩溶 · 前缘标本',mesh)
bpy.context.collection.objects.link(stone)
attr=mesh.color_attributes.new(name='Mineral',type='FLOAT_COLOR',domain='POINT')
attr.data.foreach_set('color',[v for c in colors for v in c])
for f in mesh.polygons:f.use_smooth=True
mat=bpy.data.materials.new('含细层理的灰岩');mat.use_nodes=True
nodes=mat.node_tree.nodes
node=nodes.new('ShaderNodeVertexColor');node.layer_name='Mineral'
bsdf=nodes.get('Principled BSDF');mat.node_tree.links.new(node.outputs['Color'],bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value=.84
mesh.materials.append(mat)
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.shading.color_type='VERTEX'
        area.spaces.active.region_3d.view_location=(50,0,20)
        area.spaces.active.region_3d.view_distance=110
source=root/'release/Blender/制作素材/溶洞剖切拱缘.blend'
if source.exists() and '--replace' not in sys.argv: raise FileExistsError(source)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source),compress=True)
asset=dict(xyz=[round(v*100) for x,y,z in points for v in (x,z,-y)],
           rgb=[round(v*255) for c in colors for v in c[:3]],indices=[v for f in triangles for v in f])
(root/'src/assets/cave/arch.json').write_text(json.dumps(asset,separators=(',',':')))
