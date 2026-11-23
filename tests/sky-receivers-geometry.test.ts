import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { evaluateGreenhouseResponse } from '../src/textbook-sky-causality-model';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildSolarDisturbanceWorld, buildSphereExchangeWorld, buildGreenhouseResponseWorld } from '../src/textbook-sky-causality-world';
import { buildMarsTransferWorld } from '../src/textbook-mars-base-world';

import { loadSolarInstrument } from '../src/textbook-solar-instrument';
import { loadFieldInstrument } from '../src/textbook-field-instruments';
beforeAll(async()=>{await Promise.all([loadSolarInstrument(),loadFieldInstrument('greenhouse'),loadFieldInstrument('external-spheres')]);});

function fixture(build: (b: TextbookGeometry) => ReturnType<typeof buildMarsTransferWorld>) {
  const meshes: Three.Mesh[] = [], root = new Three.Group();
  const b = {
    width: 300, height: 150, root, meshes, flow: [], accentStrokes: [],
    p(u: number, v: number, y = 0): Vec3 { return [u * this.width, y, -96 - (1 - v) * this.height]; },
    v(point: Vec3) { return new Three.Vector3(...point); },
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    mesh(geometry: Three.BufferGeometry, color = '#fff') { const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color })); root.add(mesh); meshes.push(mesh); return mesh; },
    box(a: Vec3, z: Vec3, color: string) { const geometry = new Three.BoxGeometry(z[0] - a[0], z[1] - a[1], z[2] - a[2]); geometry.translate((a[0] + z[0]) / 2, (a[1] + z[1]) / 2, (a[2] + z[2]) / 2); return this.mesh(geometry, color); },
    cylinder(a: Vec3, z: Vec3, radius: number, color: string) { const from = this.v(a), to = this.v(z), direction = to.clone().sub(from), geometry = new Three.CylinderGeometry(radius, radius, direction.length(), 12); geometry.applyQuaternion(new Three.Quaternion().setFromUnitVectors(new Three.Vector3(0, 1, 0), direction.normalize())); geometry.translate(...from.add(to).multiplyScalar(.5).toArray()); return this.mesh(geometry, color); },
    tube(points: Vec3[], radius: number, color: string) { return this.mesh(new Three.TubeGeometry(new Three.CatmullRomCurve3(points.map(point => this.v(point))), 48, radius, 6), color); },
    terrain(x0: number, x1: number, z0: number, z1: number, _height: unknown, color: string) { return this.box([x0, 0, z0], [x1, 3, z1], color); },
    label(text: string, at: Vec3, width: number, height: number) { const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...at); mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh; },
    stroke() {}, contour() {}, outline() {},
  };
  const motion = build(b as unknown as TextbookGeometry); motion.update(0, 0, 1 / 60, false);
  const role = (value: string) => meshes.find(mesh => mesh.userData.causalRole === value)!;
  return { motion, meshes, role, b };
}

describe('visible receiving geometry follows the same causal phase', () => {
  it('seats both solar specimens on their stems and keeps the scientific field open', () => {
    const {meshes}=fixture(buildSolarDisturbanceWorld);
    const stems=meshes.filter(mesh=>mesh.userData.causalRole==='solar-specimen-support');
    expect(stems).toHaveLength(2);
    for(const stem of stems){
      stem.geometry.computeBoundingBox();
      expect(stem.geometry.boundingBox!.max.y).toBeCloseTo(stem.userData.specimenContact[1],5);
      expect(stem.geometry.boundingBox!.min.y).toBeCloseTo(4.2,5);
    }
  });

  it('keeps the nut on the turning screw and the dial on the same reading after reversing', () => {
    const { motion, meshes, b } = fixture(buildSolarDisturbanceWorld);
    const part = (group: string) => meshes.find(mesh => mesh.userData.instrumentPart === group)!;
    for (const phase of [0, .84, .22, 1, 0]) {
      motion.update(phase, 1, 0, false);
      const travel = part('slide').position.x / (b.width / 100);
      const turns = -part('drive').rotation.x / (2 * Math.PI);
      expect(travel).toBeCloseTo(turns * 4.375, 7);
      expect(travel).toBeCloseTo(phase * 70, 7);
      expect(part('pointer').rotation.z).toBeCloseTo(-phase * 4 * Math.PI / 3, 7);
    }
  });

  it('lands precipitation on the actual river and preserves water identity at the runoff handoff', () => {
    const {motion,meshes}=fixture(buildSphereExchangeWorld);
    const drop=meshes.find(mesh=>mesh.userData.waterId==='water-a'&&mesh.geometry.type==='SphereGeometry')!;
    motion.update(.5,1,1/60,true);
    const state=motion.describe!() as any;
    expect(state.rainLanding).toEqual(state.riverEntry);
    expect(Math.abs(drop.position.x-state.rainLanding[0])).toBeLessThan(.75*3);
    expect(drop.position.y).toBe(state.rainLanding[1]);expect(drop.position.z).toBe(state.rainLanding[2]);
    const at=drop.position.clone();
    motion.update(.500001,1,1/60,true);expect(drop.position.distanceTo(at)).toBeLessThan(.01);
    motion.update(.499999,1,1/60,true);expect(drop.position.distanceTo(at)).toBeLessThan(.01);
    expect(new Set(meshes.filter(mesh=>mesh.userData.waterId).map(mesh=>mesh.userData.waterId))).toEqual(new Set(['water-a','water-b','water-c']));
    const soil=meshes.find(mesh=>mesh.userData.causalRole==='root-zone-water-section')!;
    expect(soil.position.y).toBeLessThan(state.treeContact[1]);
  });

  it('opens all four production cabin shells through their physical pulls without changing the transfer state', () => {
    const {motion,meshes}=fixture(buildMarsTransferWorld);
    const handles=meshes.filter(mesh=>mesh.userData.cabinPart==='shell-opening-pull');
    expect(handles).toHaveLength(8);
    motion.update(.5,0,1/60,true);
    for(let index=0;index<4;index++){
      const handle=handles[index*2];
      expect(handle.userData.modelInput).toMatchObject({kind:'inspect',target:`mars-shell-${index}`});
      const oldAngle=handle.parent!.rotation.z;
      motion.inspect!(`mars-shell-${index}`);motion.update(.5,0,1/60,true);
      expect(handle.parent!.rotation.z).not.toBe(oldAngle);
      expect((motion.describe!() as any).selected).toBe(0);
    }
    // Choosing a circuit restores its deliberate observation opening rather
    // than carrying an unrelated manually closed shell into the next lesson.
    motion.update(.5,1,1/60,true);
    expect((motion.describe!() as any).shellOpening).toEqual([1,.18,1,1]);
  });

  it('keeps Mars route fittings attached to the selected circuit through every mode', () => {
    const {motion,meshes}=fixture(buildMarsTransferWorld);
    for(const selection of [0,1,2,3,1,0]){
      motion.update(.7,selection,1/60,true);
      const routes=meshes.filter(mesh=>mesh.userData.transferRoute);
      expect(routes).toHaveLength(5);
      for(const route of routes){
        const fittings=meshes.filter(mesh=>mesh.userData.routeKind===route.userData.transferRoute.kind);
        expect(fittings.length).toBeGreaterThan(0);
        fittings.forEach(fitting=>expect(fitting.visible).toBe(route.visible));
      }
    }
  });

  it('keeps the Mars observation shells watertight with an inner and outer cut surface', () => {
    const {meshes}=fixture(buildMarsTransferWorld);
    const shells=meshes.filter(mesh=>mesh.userData.cabinPart==='hinged-longitudinal-observation-shell');
    expect(shells).toHaveLength(8);
    for(const shell of shells){
      const g=shell.geometry,a=g.attributes.position,ix=g.index!,edges=new Map<string,number>();
      const point=(index:number)=>[a.getX(index),a.getY(index),a.getZ(index)].map(n=>n.toFixed(4)).join(',');
      for(let i=0;i<ix.count;i+=3)for(const [from,to]of[[0,1],[1,2],[2,0]]){
        const key=[point(ix.getX(i+from)),point(ix.getX(i+to))].sort().join('|');edges.set(key,(edges.get(key)??0)+1);
      }
      expect([...edges.values()].every(count=>count===2)).toBe(true);
      expect([...a.array].every(Number.isFinite)).toBe(true);
    }
  });

  it('rests the cabin pads on prepared contacts in a natural cut piece with upward top normals', () => {
    const {meshes}=fixture(buildMarsTransferWorld);
    const ground=meshes.find(mesh=>mesh.userData.causalRole==='continuous-natural-regolith')!;
    const a=ground.geometry.attributes.position,n=ground.geometry.attributes.normal;
    expect(n.getY(0)).toBeGreaterThan(.99);
    const corners=new Set<string>();
    for(let i=1+6*96;i<=7*96;i++)corners.add([a.getX(i),a.getZ(i)].map(v=>v.toFixed(2)).join(','));
    expect(corners.size).toBeGreaterThan(80);
    for(const pad of meshes.filter(mesh=>mesh.userData.cabinPart==='cabin-ground-pad')){
      pad.geometry.computeBoundingBox();expect(pad.geometry.boundingBox!.min.y).toBeCloseTo(ground.userData.preparedContactHeight,5);
    }
    const floors=meshes.filter(mesh=>mesh.userData.cabinPart==='continuous-longitudinal-cabin-floor');
    expect(floors).toHaveLength(4);
    for(const floor of floors){
      const p=floor.geometry.attributes.position,n=floor.geometry.attributes.normal;
      let top=0,bottom=0;
      for(let i=0;i<p.count;i++){if(n.getY(i)>.99)top++;if(n.getY(i)<-.99)bottom++;}
      expect(top).toBeGreaterThan(0);expect(bottom).toBeGreaterThan(0);
    }
  });

  it('brings the water highlight to the same filter and reservoir as the arriving packets', () => {
    const {motion,b}=fixture(buildMarsTransferWorld);
    for(const [phase,receiver] of [[.31,0],[.62,1]] as const){
      b.flow.length=0;
      motion.update(phase,1,1/60,true);
      const state=motion.describe!() as any;
      const expected=state.waterLegJoints[receiver].end as number[];
      const ends=b.flow.map((stroke:any)=>stroke.points.at(-1) as Three.Vector3);
      expect(ends.some(point=>point.distanceTo(new Three.Vector3(...expected))<1e-6)).toBe(true);
    }
    b.flow.length=0;motion.update(.01,1,1/60,true);expect(b.flow).toHaveLength(0);
  });

  it('keeps polar curtains attached and closed until arrival, then retains their opened result', () => {
    const { motion, meshes } = fixture(buildSolarDisturbanceWorld);
    const curtains = meshes.filter(mesh => mesh.userData.causalRole === 'polar-receiving-curtain');
    expect(curtains).toHaveLength(2);
    const arrays = curtains.map(mesh => mesh.geometry.attributes.position.array);
    for (const [phase, visible] of [[.71, false], [.8, true], [1, true], [.2, false], [1, true]] as const) {
      motion.update(phase, 1, 1 / 60, false);
      curtains.forEach((mesh, i) => { expect(mesh.visible).toBe(visible); expect(mesh.geometry.attributes.position.array).toBe(arrays[i]); });
    }
    expect(curtains.every(mesh => mesh.scale.y === 1)).toBe(true);
  });

  it('moves the filter, storage and crew receiver only after their incoming water reaches each one', () => {
    const { motion, role, meshes } = fixture(buildMarsTransferWorld), count = meshes.length;
    const rotor = role('receiving-filter-rotor'), valve = role('receiving-filter-valve'), tank = role('reclaimed-water-receiving-store'), cup = role('crew-received-water');
    motion.update(.309, 1, 1 / 60, false); expect(rotor.rotation.z).toBe(0); expect(valve.rotation.z).toBe(0);
    motion.update(.61, 1, 1 / 60, false); expect(rotor.rotation.z).toBeGreaterThan(.5); expect(tank.scale.y).toBe(.06); expect(cup.scale.y).toBe(.05);
    motion.update(.8, 1, 1 / 60, false); expect(tank.scale.y).toBe(1); expect(cup.scale.y).toBe(.05);
    motion.update(1, 1, 1 / 60, false); expect(cup.scale.y).toBe(1); expect(rotor.rotation.z % Math.PI).not.toBe(0);
    expect(new Set(meshes.filter(mesh => mesh.visible && mesh.userData.transferId).map(mesh => mesh.userData.transferId))).toEqual(new Set(['reclaimed-water-0', 'reclaimed-water-1', 'reclaimed-water-2']));
    motion.update(.309, 1, 1 / 144, true); expect(rotor.rotation.z).toBe(0); expect(cup.scale.y).toBe(.05); expect(meshes).toHaveLength(count);
  });

  it('uses distinct visible matter shapes and preserves the receiving gas/food positions', () => {
    const { motion, role, meshes } = fixture(buildMarsTransferWorld);
    motion.update(.29, 2, 1 / 60, false); const plantBefore = role('plant-received-gas').position.y;
    motion.update(.67, 2, 1 / 60, false); expect(role('plant-received-gas').position.y).toBeGreaterThan(plantBefore); const oxygenBefore = role('crew-received-oxygen').position.y;
    motion.update(1, 2, 1 / 60, false); expect(role('crew-received-oxygen').position.y).toBeGreaterThan(oxygenBefore);
    expect(new Set(meshes.filter(mesh => mesh.visible && mesh.userData.transferId).map(mesh => mesh.userData.symbolKind))).toEqual(new Set(['carbon-dioxide-triatomic', 'oxygen-diatomic', 'food-box']));
    const end = role('crew-received-food-tray').position.toArray(); motion.update(.1, 2, 1 / 60, false); motion.update(1, 2, 1 / 60, false); expect(role('crew-received-food-tray').position.toArray()).toEqual(end);
  });

  it('makes the fixed ground inlay length and needle show the same heat state in every comparison', () => {
    const { motion, role } = fixture(buildGreenhouseResponseWorld), fill = role('relative-ground-heat-fill'), needle = role('relative-ground-heat-position');
    for (const phase of [.1, .27, .77, 1, .5, 1]) for (const selection of [0, 1, 2]) {
      motion.update(phase, selection, 1 / 60, false);
      const state = evaluateGreenhouseResponse(phase, selection); expect(fill.scale.x).toBe(state.groundHeat);
      expect(needle.position.x).toBeCloseTo(.145 * 300 + 219 * state.groundHeat, 9);
    }
    const ends = [0, 1, 2].map(selection => { motion.update(1, selection, 1 / 60, false); return needle.position.x; });
    expect(ends[0]).toBeLessThan(ends[1]); expect(ends[1]).toBeLessThan(ends[2]);
  });
});
