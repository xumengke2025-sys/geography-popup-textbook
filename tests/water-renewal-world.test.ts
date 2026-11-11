import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { evaluateWaterRenewal } from '../src/textbook-water-renewal-model';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildWaterRenewalWorld } from '../src/textbook-water-renewal-world';

function fixture() {
  const root = new T.Group(), meshes: T.Mesh[] = [], materials = new Map<string, T.MeshStandardMaterial>();
  const b: any = { width: 300, height: 160, root, meshes,
    materialFor(role: string, color: string) {
      const key = role + color; if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color }));
      return materials.get(key)!;
    },
    mesh(geometry: T.BufferGeometry, color: string, _edges: boolean, _volume: boolean, role: string) {
      const mesh = new T.Mesh(geometry, this.materialFor(role, color)); root.add(mesh); meshes.push(mesh); return mesh;
    },
  };
  const motion = buildWaterRenewalWorld(b), role = (name: string) => meshes.filter(m => m.userData.waterRenewalRole === name);
  return { root, meshes, motion, role };
}
const bounds = (mesh: T.Mesh) => {
  mesh.updateWorldMatrix(true, false); mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
};

describe('water renewal state retains the source lesson boundary', () => {
  it('preserves the existing initial and final storage in each independent condition', () => {
    for (const selection of [0, 1, 2]) for (const t of [0, .13, .4, .73, 1]) {
      const state = evaluateWaterRenewal(t, selection);
      expect(state.level).toBe(selection === 1 ? .7 - t * .57 : .7);
      expect(state.contaminated).toBe(selection === 2);
      expect(state).toMatchObject({ localAvailableWaterOnly: true, globalWaterDestroyed: false, ratesAreIllustrative: true });
      expect(state.level).toBeCloseTo(.7 + state.supplied - state.withdrawn, 12);
    }
  });
  it('keeps pollution separate from quantity and does not certify water safety', () => {
    for (const t of [0, .2, .6, 1]) {
      const clean = evaluateWaterRenewal(t, 0), polluted = evaluateWaterRenewal(t, 2);
      expect(polluted.level).toBe(clean.level); expect(polluted.withdrawn).toBe(clean.withdrawn);
      expect(polluted).toMatchObject({ contaminationIsWaterLoss: false, waterSafetyCertified: false,
        receiverCapacityIsCalibrated: false, markersArePollutantMolecules: false });
    }
  });
  it('integrates the illustrative received portion without claiming measured capacities', () => {
    const regular = evaluateWaterRenewal(1, 0), excessive = evaluateWaterRenewal(1, 1);
    expect(evaluateWaterRenewal(0).receiverLevel).toBe(0);
    expect(excessive.receiverLevel).toBeGreaterThan(regular.receiverLevel);
    expect(excessive.receiverLevel).toBeLessThan(1);
    const saved = evaluateWaterRenewal(.476, 1);
    for (const t of [1, 0, .88, .15]) evaluateWaterRenewal(t, 2);
    expect(evaluateWaterRenewal(.476, 1)).toEqual(saved);
    expect(evaluateWaterRenewal(NaN, 9)).toEqual(evaluateWaterRenewal(0, 0));
  });
});

describe('raised water-budget instrument has real openings and receiving consequences', () => {
  it('uses thick annular shells and real open mouths without a top lid or duplicate labels', () => {
    const { role, meshes } = fixture();
    for (const name of ['open-reservoir-wall', 'open-boundary-supply', 'open-receiving-cup', 'sample-cup']) {
      const mesh = role(name)[0]; expect(mesh.userData.openTop).toBe(true);
      expect(mesh.userData.wallThickness).toBeGreaterThan(0); expect(mesh.userData.innerRadius).toBeGreaterThan(0);
      expect(mesh.geometry.attributes.position.count).toBeGreaterThan(100);
    }
    expect(role('open-reservoir-mouth')).toHaveLength(1); expect(role('receiver-open-mouth')).toHaveLength(1);
    expect(role('retained-tank-floor')).toHaveLength(1);
    expect(meshes.filter(m => m.userData.kind === 'text-label')).toHaveLength(0);
  });
  it('keeps the same water floor and radius while the physical surface follows the source state', () => {
    const { role, motion, root } = fixture(), water = role('stored-water')[0], receiver = role('received-water')[0];
    let previousWidth = 0;
    for (const selection of [0, 1, 2]) for (const phase of [0, .37, 1, .37]) {
      motion.update(phase, selection, 0, true); root.updateMatrixWorld(true);
      const state = evaluateWaterRenewal(phase, selection), a = bounds(water), c = bounds(receiver);
      expect(a.min.y / 3).toBeCloseTo(14.4, 5); expect(a.max.y / 3).toBeCloseTo(14.4 + state.level * 25, 5);
      const width = a.max.x - a.min.x;
      if (previousWidth) expect(width).toBe(previousWidth); previousWidth = width;
      expect(c.max.y / 3).toBeCloseTo(3.9 + Math.max(.002, state.receiverLevel * 7.3), 5);
      expect(motion.describe!()).toMatchObject({ level: state.level, contaminated: state.contaminated,
        actualOpenVessels: true, receiverReadsSameState: true, geometryBuffersReused: true });
    }
  });
  it('places the take-off below the lowest water surface and the receiving mouth below its nozzle', () => {
    const { role, motion } = fixture();
    motion.update(1, 1, 0, true);
    const state = motion.describe!();
    expect(state.mainWaterSurface as number).toBeGreaterThan(15.4);
    expect(bounds(role('withdrawal-open-nozzle')[0]).min.y).toBeGreaterThan(bounds(role('receiver-open-mouth')[0]).max.y);
  });
  it('provides actual valve, supply and sample selections plus a reversible rail in the same model frame', () => {
    const { role, motion } = fixture();
    expect(role('open-boundary-supply')[0].userData.modelInput).toMatchObject({ kind: 'replay', selection: 0 });
    expect(role('withdrawal-valve-wheel')[0].userData.modelInput).toMatchObject({ kind: 'replay', selection: 1 });
    expect(role('water-quality-sample')[0].userData.modelInput).toMatchObject({ kind: 'replay', selection: 2 });
    const slider = role('observation-slider')[0], track = slider.userData.modelInput.track;
    motion.update(0, 0, 0, true); expect(slider.position.toArray()).toEqual(track.start);
    motion.update(1, 1, 0, true); expect(slider.position.toArray()).toEqual(track.end);
    expect(role('withdrawal-valve-wheel')[0].userData.modelInput.selection).toBe(0);
    motion.update(0, 0, 0, true); expect(slider.position.toArray()).toEqual(track.start);
  });
  it('makes the stored water, received water, sample and quality symbols agree', () => {
    const { role, motion } = fixture();
    motion.update(.6, 2, 0, true);
    expect(role('stored-water')[0].material).toBe(role('received-water')[0].material);
    expect(role('stored-water')[0].material).toBe(role('water-quality-sample')[0].material);
    expect(role('quality-symbol').every(m => m.visible)).toBe(true);
    motion.update(.6, 0, 0, true); expect(role('quality-symbol').some(m => m.visible)).toBe(false);
  });
});
