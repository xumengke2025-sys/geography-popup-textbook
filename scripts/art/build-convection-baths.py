"""Three thermal sources for the shared-air convection demonstration."""
from math import sin, cos, radians, pi, tau
from pathlib import Path
import sys
import bpy
from mathutils import Vector

sys.path.insert(0,str(Path(__file__).resolve().parent))
from fieldbook_workshop import Workshop
from water_workshop import FINISH, machined_section, sphere, keys_linear

w=Workshop('冷热源剖面',FINISH | {
    'tinned-copper':('brass','bc8861',.72,.30), 'basin':('enamel','244146',.10,.25),
    'ice':('water','afced0',.06,.33), 'frost':('ivory','dae5d8',.01,.46),
    'flame':('ivory','eda34c',.04,.28), 'wick':('rock','514737',0,.77),
})


def ring(name,x,y,profile,finish,group):
    return w.turning(name,(x,y),profile,finish,group,72,True)


def vessel(x,hot):
    y=43.0
    group='warm' if hot else ('left' if x<50 else 'right')
    # The viewing opening removes only the near wall, preserving the bottom
    # and the complete rolled upper rim of the vessel.
    w.turning('坐落在地板上的杯足',(x,y),[(2.8,6.90),(2.96,7.55),(3.3,7.75),
              (3.63,7.35),(3.87,7.24)],'dark-bronze',group,72)
    w.turning('搪瓷胆底',(x,y),[(3.78,7.15),(4.04,8.33),(4.42,8.42)],'basin',group,72)
    machined_section(w,'朝前剖开的双层槽壁',(x,y),[(4.1,8.27),(5.04,8.75),(9.17,9.15),
        (9.38,9.09),(9.38,8.47),(4.60,7.96),(4.22,7.65)],radians(146),radians(248),'basin',group,96)
    ring('卷制亮边',x,y,[(9.0,8.71),(8.99,9.13),(9.17,9.43),(9.57,9.43),
         (9.79,9.20),(9.77,8.73),(9.59,8.47),(9.26,8.47)],'burnished-brass',group)
    for a in [radians(141),radians(39)]:
        w.shaft('剖口立边',(x+8.11*cos(a),y+8.11*sin(a),4.33),
                (x+9.03*cos(a),y+9.03*sin(a),9.40),.25,'gold',group,16)
    if hot:
        w.turning('酒精灯储液盏',(x,y+2.25),[(4.40,2.31),(4.51,3.15),(4.84,3.75),
                  (5.34,3.8),(5.78,3.37),(6.08,2.38),(6.22,1.48)],'tinned-copper',group,56)
        w.turning('灯芯铜帽',(x,y+2.25),[(6.15,1.53),(6.37,1.57),(6.45,.76),
                  (6.91,.61)],'burnished-brass',group,40)
        w.shaft('短灯芯',(x,y+2.25,6.69),(x,y+2.25,7.05),.37,'wick',group,20)
        # Cut the front sector from the plate and its turned lines to expose
        # the lamp from the book's elevated observation angle.
        machined_section(w,'剖开观察口的加热铜盘',(x,y),[(9.53,.25),(9.53,8.54),(9.80,9.12),
                         (10.17,8.93),(10.24,8.49),(10.24,.25)],
                         radians(146),radians(248),'tinned-copper','hotplate',92)
        for r in [4.0,6.15,7.58]:
            machined_section(w,'盘面车纹',(x,y),[(10.22,r-.045),(10.22,r+.045),(10.29,r+.04),(10.29,r-.04)],
                             radians(146),radians(248),'dark-bronze','hotplate',72)
        heights=[(0,.15),(.19,.54),(.65,.72),(1.15,.59),(2.10,.32),(2.73,.055)]
        flame=w.turning('灯焰',(0,0),heights,'flame','fire',32)
        for vertex in flame.data.vertices:
            vertex.co.x+=.26*(vertex.co.z/2.31)**2
        flame.location=(x,y+2.25,7.04)
        shader=w.material('flame').node_tree.nodes.get('Principled BSDF')
        shader.inputs['Emission Color'].default_value=(.98,.23,.023,1)
        shader.inputs['Emission Strength'].default_value=.45
    else:
        # Deliberate irregular faceting reads as ice through the cut face.
        for i,(dx,dy,r) in enumerate([(-3.7,-1.9,2.70),(1.4,-3.4,2.93),(4.4,.2,2.35),
            (-3.6,3.25,2.36),(.35,2.90,2.83),(.33,-.46,3.10)]):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=r,location=(x+dx,y+dy,5.67+i%2*.73))
            obj=w.register(bpy.context.object,'冰水槽内的冰样','ice' if i%3 else 'frost',group+'-ice')
            obj.scale=(1.21,.94,.76)
            obj.rotation_euler=(.22*i,-.15*i,.85*i)
        for a in [-pi*.78,-pi*.24]:
            xx,yy=x+8.80*cos(a),y+8.80*sin(a)
            w.screw(xx,yy,9.67,.65,group)
    return group


for x in [18,50,82]:
    vessel(x,x==50)
w.export('thermal',positive_depth=True)
for group,centre in [('fire',(50,45.25,7.04)),('left-ice',(18,43,4.44)),('right-ice',(82,43,4.44))]:
    source=w.join_movement(group,centre,group)
    for frame,amount in [(1,.001),(25,1),(101,1)]:
        source.scale=(amount,)*3
        source.keyframe_insert(data_path='scale',frame=frame)
    keys_linear(source)
w.scene.frame_end=101
w.scene.timeline_markers.new('均温',frame=1)
w.scene.timeline_markers.new('冷暖源就位',frame=25)
w.scene.frame_set(60)
w.photograph('thermal-baths','热力环流的冷热源剖面',(50,43,6),(10,127,58),110,2.79,
             detail=((50,43,7.0),(5,118,28),25))


