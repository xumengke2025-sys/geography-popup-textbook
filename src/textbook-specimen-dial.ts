import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import type { IndexedDial, PhaseInput } from './textbook-model-input';

type Face = { label: string; choices: readonly string[] } | { label: string; turns: number };

/** A detented specimen selector or a bounded observation wheel. The face and
 * needle share an axle. Marks are cut in the stationary porcelain annulus. */
export function mountSpecimenDial(b: TextbookGeometry, center: Vec3, radius: number, face: Face) {
  const [cx,cy,cz] = center, dial = { center, radiusX: radius, radiusY: radius };
  const choices = 'choices' in face ? face.choices : null;
  const count = choices?.length ?? 12, start = Math.PI / 2, step = -2 * Math.PI / count;
  const action: IndexedDial | PhaseInput = choices ? {
    kind: 'indexed-dial', dial, start, step, stops: choices.map((_, selection) => ({ selection })),
    advanceAtHub: true, keepPhase: true, label: face.label,
  } : { kind: 'phase-dial', dial: { ...dial, turns: 'turns' in face ? face.turns : 1 }, label: face.label };
  const part = (geo: any, color: string, role: 'wood'|'brass'|'steel'|'ivory'|'enamel', name: string) => {
    const mesh=b.mesh(geo,color,false,true,role);
    mesh.name=name; mesh.userData.modelInput=action;mesh.userData.smallPointTarget=true;
    return mesh;
  };
  const at = (x:number,y:number,z:number):Vec3=>[cx+x*radius,cy+y*radius,cz+z*radius];
  part(chamferedPlateGeometry(at(-1.16,-1.08,-.98),at(1.16,.58,-.40),radius*.13),'#503629','wood','胡桃木拨盘座');
  part(turnedShaftGeometry(at(0,0,-.58),at(0,0,-.08),[[radius*.89,0],[radius*1.05,.21],[radius*1.05,.81],[radius,1]]),'#937345','brass','车削铜圈');
  part(turnedShaftGeometry(at(0,0,-.10),at(0,0,-.04),[[radius*.92,0],[radius*.90,1]]),'#decfa9','ivory','搪瓷刻度盘');
  const marks = Array.from({length:count},(_,i)=>{
    const a=start+i*step;
    return turnedShaftGeometry(at(.70*Math.cos(a),.70*Math.sin(a),-.034),at(.858*Math.cos(a),.858*Math.sin(a),-.034),
      [[radius*.020,0],[radius*.020,1]]);
  });
  part(mergeInstrumentGeometry(marks),'#3c4e4c','enamel','刻位');
  const arbor=part(turnedShaftGeometry(at(0,0,-.08),at(0,0,.22),[[radius*.31,0],[radius*.34,.4],[radius*.24,1]]),'#a78854','brass','带轴肩的钮毂');
  const pointer=new T.Group();b.root.add(pointer);pointer.position.set(...center);
  const pin=part(turnedShaftGeometry([0,0,.12*radius],[.78*radius,0,.12*radius],[[.095*radius,0],[.065*radius,.68],[.035*radius,1]]),'#344a50','steel','蓝钢指示杆');
  pointer.add(pin);
  const grip=part(turnedShaftGeometry([.76*radius,0,.09*radius],[.76*radius,0,.42*radius],[[.09*radius,0],[.13*radius,.28],[.14*radius,.72],[.11*radius,1]]),
    choices?'#916044':'#50372a',choices?'enamel':'wood','指腹转柄');
  pointer.add(grip);
  return (phase:number, selection:number) => {
    pointer.rotation.z=choices ? start+selection*step : (phase*('turns' in face ? face.turns : 1)-.25)*2*Math.PI;
    if(choices && action.kind==='indexed-dial') action.label=face.label+'；'+(choices[selection]??choices[0]);
    arbor.userData.dialReading=choices ? selection : phase;
  };
}
