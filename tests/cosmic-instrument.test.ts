import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildCosmicInstrumentWorld } from '../src/textbook-cosmic-instrument-world';
import { phaseDialPoint, phaseFromDialPoint } from '../src/textbook-model-input';

function fixture() {
  const root = new Three.Group(), meshes: Three.Mesh[] = [], materials = new Map<string, Three.MeshBasicMaterial>();
  const b = { width: 150, height: 72, root,
    p(u: number, v: number, y = 0): Vec3 { return [u * 150, y, -96 - (1 - v) * 72]; },
    mesh(g: Three.BufferGeometry, color: string) {
      if (!materials.has(color)) materials.set(color, new Three.MeshBasicMaterial({ color }));
      const m = new Three.Mesh(g, materials.get(color)!); root.add(m); meshes.push(m); return m;
    },
    label(text: string, at: Vec3, w: number, h: number) {
      const m = this.mesh(new Three.PlaneGeometry(w, h), '#eee7d4'); m.position.set(...at); m.userData.text = text; return m;
    },
  };
  return { root, meshes, motion: buildCosmicInstrumentWorld(b as unknown as TextbookGeometry) };
}

describe('coherent cosmic hierarchy instrument', () => {
  it('keeps the real handwheel grip aligned with the native dial input in both scrub directions', () => {
    const { motion, meshes }=fixture();
    const rim=meshes.find(m=>m.name==='phase-wheel-rim')!;
    const dial=rim.userData.modelInput.dial;
    for(const phase of [0,.23,.8,.1,.73]) {
      motion.update(phase,0,0,true);
      const grip=rim.parent!.localToWorld(new Three.Vector3(0,-4.6,0));
      const expected=phaseDialPoint(phase,dial);
      grip.toArray().forEach((n,i)=>expect(n).toBeCloseTo(expected[i],8));
      expect(phaseFromDialPoint(grip.x,grip.y,dial,0)).toBeCloseTo(phase,8);
    }
  });
  it('keeps every adaptive globe-land triangle above the ocean while using fewer faces at book scale',()=>{
    const {meshes}=fixture(),earth=meshes.find(m=>m.name==='earth-globe')!,land=meshes.find(m=>m.name==='schematic-earth-land-relief')!;
    earth.geometry.computeBoundingSphere();const radius=earth.geometry.boundingSphere!.radius;
    const p=land.geometry.attributes.position;
    expect(p.count/3).toBeLessThan(10000);
    for(let i=0;i<p.count;i+=3){
      const center=new Three.Vector3();for(let j=0;j<3;j++)center.add(new Three.Vector3().fromBufferAttribute(p,i+j));
      expect(center.multiplyScalar(1/3).length()).toBeGreaterThan(radius);
    }
  });
  it('keeps three radial support endpoints connected for any phase and selection without reallocating geometry', () => {
    const { motion, meshes } = fixture(), count = meshes.length, buffers = meshes.map(m => m.geometry);
    for (const phase of [0, .13, .54, 1, -.2, 1.31]) for (const selection of [0, 1, 2, 3]) {
      motion.update(phase, selection, 0, true);
      const state = motion.describe!(), endpoints = state.supportConnections as { body: Vec3; support: Vec3 }[];
      expect(endpoints).toHaveLength(3);
      for (const p of endpoints) p.body.forEach((n, i) => expect(n).toBeCloseTo(p.support[i], 10));
      expect(state).toMatchObject({ selected: selection, trueScale: false, realOrbitalPeriodRatio: false,
        relationship: 'membership-not-physical-stacked-shells', instrumentMechanismIsAstronomicalCause: false,
        outerFrameIsCosmicBoundary: false, solarInsetAtGalacticCentre: false });
    }
    expect(meshes).toHaveLength(count); meshes.forEach((m, i) => expect(m.geometry).toBe(buffers[i]));
  });
  it('exposes four real detents and body targets without duplicating the readable DOM caption as tiny physical type', () => {
    const { motion, meshes } = fixture();
    const detents = meshes.filter(m => m.name === 'system-selector-detent');
    expect(detents.map(m => m.userData.modelInput.selection)).toEqual([0, 1, 2, 3]);
    expect(meshes.find(m => m.name === 'earth-globe')!.userData.modelInput.selection).toBe(0);
    expect(meshes.find(m => m.name === 'solar-inset-sun')!.userData.modelInput.selection).toBe(1);
    expect(meshes.find(m => m.name === 'continuous-galactic-spiral-relief')!.userData.modelInput.selection).toBe(2);
    expect(meshes.some(m => m.name === 'sparse-relief-galaxies' && m.userData.modelInput.selection === 3)).toBe(true);
    for (const selection of [0, 3, 1, 2]) {
      motion.update(.3, selection, 0, true);
      expect(meshes.filter(m => m.userData.text && m.visible)).toHaveLength(0);
    }
  });
  it('uses one continuous handwheel input and keeps lunar support deterministic and cycle-continuous', () => {
    const { motion, meshes } = fixture();
    const moon = meshes.find(m => m.name === 'moon-globe')!;
    expect(meshes.filter(m=>m.userData.modelInput?.kind==='phase-track')).toHaveLength(0);
    const dialInputs=meshes.filter(m=>m.userData.modelInput?.kind==='phase-dial');
    expect(dialInputs.length).toBeGreaterThan(0);
    expect(new Set(dialInputs.map(m=>m.userData.modelInput))).toHaveProperty('size',1);
    const snapshot = (phase: number) => { motion.update(phase, 0, 0, true); return moon.getWorldPosition(new Three.Vector3()).toArray(); };
    const a = snapshot(.27); snapshot(.9); expect(snapshot(.27)).toEqual(a);
    snapshot(0).forEach((n, i) => expect(n).toBeCloseTo(snapshot(1)[i], 10));
    const bounds = motion.focusBounds!(); expect(bounds.max[1]).toBeGreaterThan(bounds.min[1]);
  });
  it('seats every selector on the same shallow casting without adding a detached sign',()=>{
    const {meshes,motion}=fixture();motion.update(.42,0,0,true);
    const bed=meshes.find(m=>m.name==='integrated-observation-bed')!;
    const inverse=bed.matrixWorld.clone().invert();
    for(const stop of meshes.filter(m=>m.name==='system-selector-detent')){
      const seat=stop.localToWorld(new Three.Vector3().fromBufferAttribute(stop.geometry.attributes.position,0)).applyMatrix4(inverse);
      const ray=new Three.Raycaster(new Three.Vector3(seat.x,20,seat.z),new Three.Vector3(0,-1,0));
      const localBed=new Three.Mesh(bed.geometry,new Three.MeshBasicMaterial({side:Three.DoubleSide}));localBed.updateMatrixWorld();
      const top=ray.intersectObject(localBed)[0];expect(top).toBeDefined();
      expect(Math.abs(top.point.y-seat.y)).toBeLessThan(.08);
    }
    expect(meshes.some(m=>m.name==='fitted-heading-face')).toBe(false);
    expect(meshes.some(m=>m.name==='heading-to-bed-seat')).toBe(false);
  });
  it('retains the four diagonal levels and advances the selected specimen without resizing any body', () => {
    const { motion, meshes } = fixture();
    const earth = meshes.find(m => m.name === 'earth-globe')!;
    const moon = meshes.find(m => m.name === 'moon-globe')!;
    const arm = meshes.find(m => m.name === 'radial-lunar-support')!;
    const activeNames = ['earth-moon-working-specimen', 'solar-inset-specimen', 'milky-way-specimen', 'observable-universe-specimen'];
    const visible = (mesh: Three.Object3D) => {
      for (let node: Three.Object3D | null = mesh; node; node = node.parent) if (!node.visible) return false;
      return true;
    };
    for (const selection of [0, 1, 2, 3, 0]) {
      motion.update(.27, selection, 0, true);
      const state=motion.describe!();
      expect(state.visibleSpecimens).toEqual(activeNames);
      expect(visible(earth)).toBe(true);
      expect(visible(meshes.find(m => m.name === 'solar-inset-sun')!)).toBe(true);
      const centers=state.stationCenters as Vec3[];
      for(let i=1;i<centers.length;i++){
        expect(centers[i][0]).toBeGreaterThan(centers[i-1][0]);
        expect(centers[i][1]).toBeGreaterThan(centers[i-1][1]);
      }
      expect(centers[selection][2]).toBeCloseTo([1,-2,-5,-8][selection]+5,8);
      expect(earth.parent!.scale.x).toBe(.60);
    }
    // Test geometry and actual transforms, rather than a declared size flag.
    earth.geometry.computeBoundingSphere();
    expect(earth.geometry.boundingSphere!.radius).toBeGreaterThan(7);
    for (const phase of [0, .25, .73, 1]) {
      motion.update(phase, 0, 0, true);
      const bodySocket = moon.parent!.localToWorld(new Three.Vector3(0, 0, -1.8));
      const armEnd = arm.localToWorld(new Three.Vector3(1, 0, -1.8));
      expect(bodySocket.distanceTo(armEnd)).toBeLessThan(1e-8);
    }
    expect(meshes.some(m => m.name === 'thin-outer-observation-frame')).toBe(false);
  });
  it('moves the observation window between levels while keeping a fixed complete apparatus envelope',()=>{
    const {motion}=fixture();const complete=motion.overviewBounds!();const centers:Vec3[]=[];
    for(const selection of [0,1,2,3]){
      motion.update(.27,selection,0,true);
      const focused=motion.focusBounds!(),station=(motion.describe!().stationCenters as Vec3[])[selection];
      const world=[station[0]*1.5+73.5,station[1]*1.5,station[2]*1.5-112.56];
      for(let i=0;i<3;i++){
        expect(focused.min[i]).toBeLessThan(world[i]);expect(focused.max[i]).toBeGreaterThan(world[i]);
      }
      centers.push(focused.min.map((v,i)=>(v+focused.max[i])/2) as Vec3);
      expect(motion.overviewBounds!()).toEqual(complete);
      expect(focused.max[0]-focused.min[0]).toBeLessThan(complete.max[0]-complete.min[0]);
    }
    expect(centers[2][1]).toBeGreaterThan(centers[0][1]);
  });
});
