import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, createInstrumentParts, mergeInstrumentGeometry, turnedShaftGeometry, turnedSleeveGeometry } from './textbook-instrument-parts';
import type { SolidMaterialRole } from './textbook-solid-materials';

/** Soil-family construction, in its own specimen frame. All shell interiors
 * are empty geometry; the openings are not painted on a box. */
export function createSoilInstrument(b: TextbookGeometry, s: number) {
  const parts = createInstrumentParts(b);
  // These members never move or receive input. Batch only this explicit
  // construction path; water buffers, sample frames and controls stay separate.
  const fixed=new Map<string,{geometries:any[];color:string;role:SolidMaterialRole;name:string}>();
  const collect=(geometry:any,color:string,role:SolidMaterialRole,name:string)=>{
    const key=role+color+name;
    if(!fixed.has(key))fixed.set(key,{geometries:[],color,role,name});
    fixed.get(key)!.geometries.push(geometry);
  };
  const solid = (geometry: any, color: string, role: SolidMaterialRole, name: string) => {
    const mesh = b.mesh(geometry, color, false, true, role); mesh.userData.soilInstrumentPart = name; return mesh;
  };
  const plate = (a: Vec3, z: Vec3, color: string, role: SolidMaterialRole, name: string) =>
    solid(chamferedPlateGeometry(a, z, .12 * s), color, role, name);
  const pipe = (a: Vec3, z: Vec3, radius: number, color = '#929b98', role: SolidMaterialRole = 'steel') => {
    const d = new T.Vector3(...z).sub(new T.Vector3(...a)), center = new T.Vector3(...a).add(new T.Vector3(...z)).multiplyScalar(.5);
    const geometry=new T.CylinderGeometry(radius,radius,d.length(),20);
    geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));geometry.translate(...center.toArray());
    collect(geometry,color,role,'connected-round-members');
  };
  const bearing=(at:Vec3,axis:Vec3,radius:number,length:number)=>{
    const direction=new T.Vector3(...axis).normalize(),center=new T.Vector3(...at);
    const point=(t:number)=>center.clone().addScaledVector(direction,t*length).toArray() as Vec3;
    collect(turnedSleeveGeometry(point(-.5),point(.5),[[radius*.88,0],[radius,.07],[radius,.2],
      [radius*.74,.34],[radius*.74,.66],[radius,.8],[radius,.93],[radius*.88,1]],radius*.39),'#a88b50','brass','fixed-bearing-sleeves');
    collect(turnedShaftGeometry(point(-.68),point(.68),[[radius*.37,0],[radius*.37,1]]),'#929b98','steel','fixed-bearing-axes');
  };
  const nozzle = (at: Vec3, outer: number, inner: number, length: number) => {
    // A single revolved closed wall: visible lip, inner bore and underside.
    // Unlike a capped cylinder the drainage path is genuinely empty.
    const profile = [[inner, -length / 2], [outer, -length / 2], [outer, length / 2],
      [inner, length / 2], [inner, -length / 2]].map(([x, y]) => new T.Vector2(x, y));
    const mesh = solid(new T.LatheGeometry(profile, 24), '#a88b50', 'brass', 'hollow-drain-nozzle');
    mesh.position.set(...at); mesh.userData.openBoreRadius = inner; return mesh;
  };
  const openBox = (left: number, right: number, low: number, high: number, back: number, front: number,
    color: string, role: SolidMaterialRole, name: string, window = false, floor = true, thickness = .5 * s) => {
    const walls = [];
    if (floor) walls.push(plate([left, low - thickness, back], [right, low, front], color, role, name + ':floor'));
    walls.push(plate([left, low, back], [right, high, back + thickness], color, role, name + ':back'));
    for (const x of [left, right - thickness]) walls.push(plate([x, low, back], [x + thickness, high, front], color, role, name + ':side'));
    if (window) {
      const pane = plate([left + thickness, low, front - .12 * s], [right - thickness, high, front], '#dbe4dd', 'air', name + ':inspection-pane');
      pane.material = b.materialFor('air', '#dbe4dd'); pane.material.opacity = .08; pane.material.depthWrite = false;
      pane.castShadow = pane.receiveShadow = false; pane.userData.castShadow = false; walls.push(pane);
      for (const x of [left + thickness, right - thickness]) pipe([x, low, front + .05 * s], [x, high, front + .05 * s], .18 * s, '#a88b50', 'brass');
      pipe([left, low, front + .05 * s], [right, low, front + .05 * s], .18 * s, '#a88b50', 'brass');
    }
    return walls;
  };
  const fixedLabel = (text: string, at: Vec3, width: number, height: number) => {
    const mesh = b.label(text, at, width, height); mesh.userData.kind = 'instrument-nameplate';
    mesh.userData.castShadow = false; mesh.castShadow = false; mesh.receiveShadow = false;
    return mesh;
  };
  const finish=()=>{
    for(const item of fixed.values())solid(mergeInstrumentGeometry(item.geometries),item.color,item.role,item.name);
    fixed.clear();
  };
  return { parts, solid, plate, pipe, bearing, nozzle, openBox, fixedLabel, finish };
}
