import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry } from '../src/textbook-geometry';
import { evaluateSalinity, salinityPortionPoint, salinitySvg, SALINITY_REFERENCE } from '../src/textbook-salinity-model';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildSalinityWorld } from '../src/textbook-salinity-world';
import { loadFieldInstrument } from '../src/textbook-field-instruments';

beforeAll(() => loadFieldInstrument('salinity'));

function fixture() {
  const root = new Three.Group(), meshes: Three.Mesh[] = [], materials = new Map<string, Three.Material>();
  const b = { width: 150, height: 100, root, meshes,
    mesh(geometry: Three.BufferGeometry, color: string, _edges: boolean, _volume: boolean, role: string) {
      const key = role + color; if (!materials.has(key)) materials.set(key, new Three.MeshBasicMaterial({ color }));
      const object = new Three.Mesh(geometry, materials.get(key)); root.add(object); meshes.push(object); return object;
    },
    label(_text: string, at: number[], width: number, height: number) {
      const label = this.mesh(new Three.PlaneGeometry(width, height), '#fff', false, false, 'paper');
      label.position.set(at[0], at[1], at[2]); return label;
    },
  };
  const motion = buildSalinityWorld(b as unknown as TextbookGeometry);
  return { root, meshes, motion };
}
const center = (a: Three.BufferAttribute, start: number, n: number) => {
  const point = new Three.Vector3(); for (let j = 0; j < n; j++) point.add(new Three.Vector3().fromBufferAttribute(a, start + j));
  return point.divideScalar(n);
};

describe('sectioned salinity observation trough', () => {
  it('keeps every original scientific trial and the flat-state contract', () => {
    const { motion } = fixture();
    for (const mode of [0, 1, 2]) for (const phase of [0, .12, .43, .7, 1, .43]) {
      motion.update(phase, mode, 0, true); const s = evaluateSalinity(phase, mode), m = motion.describe!() as any;
      expect(m).toMatchObject({ kind: 'salinity-balance', waterAmount: s.water, saltMass: 2, grainCount: 24,
        saltMarksDissolved: true, concentration: s.concentration, direction: s.tendency, sameInitialConditions: true,
        finiteWaterPortions: 18, sharedFlatState: true, units: 'dimensionless-teaching-only', measuredSalinity: false });
      expect(m.inventory.total).toBeCloseTo(m.inventory.expected, 12);
      expect(salinitySvg(phase, mode)).toContain(`data-water="${m.waterAmount}"`);
    }
  });
  it('moves the ACTUAL float and water solid from the same level without calibration claims', () => {
    const { root, meshes, motion } = fixture();
    const water = meshes.find(m => m.userData.salinityRole === 'sea-water')!, follower = root.getObjectByName('surface-float')!;
    for (const mode of [0, 1, 2]) for (const phase of [0, .3, 1]) {
      motion.update(phase, mode, 0, true); const s = evaluateSalinity(phase, mode), m = motion.describe!() as any;
      expect(follower.position.y).toBe((3 + s.waterLevel) * 1.5);
      expect(water.userData.waterAmount).toBe(s.water); expect(water.userData.concentration).toBe(s.concentration);
      water.geometry.computeBoundingBox(); expect(Math.abs(water.geometry.boundingBox!.max.y / 1.5 - s.waterLevel)).toBeLessThan(.111);
      expect(m.observationTrough).toMatchObject({ fixedInitialWaterline: 17, followerHeight: 3 + s.waterLevel,
        scaleIsCalibrated: false, energySourceIsSymbolic: true, frontSectionIsTeachingCutaway: true });
    }
  });
  it('preserves every original salt coordinate and never moves salt onto a transfer path', () => {
    const { meshes, motion } = fixture(), salt = meshes.find(m => m.userData.salinityRole === 'dissolved-salt-marks')!;
    const a = salt.geometry.attributes.position as Three.BufferAttribute, verticesPerMark = a.count / SALINITY_REFERENCE.saltMarks;
    for (const mode of [0, 1, 2]) for (const phase of [0, .4, 1]) {
      motion.update(phase, mode, 0, true); const s = evaluateSalinity(phase, mode);
      for (let i = 0; i < 24; i++) {
        const point = center(a, i * verticesPerMark, verticesPerMark);
        expect(point.x / 1.5).toBeCloseTo(26 + i % 6 * 10.6, 5);
        expect(point.y / 1.5).toBeCloseTo(3.4 + s.waterLevel * (.13 + Math.floor(i / 6) * .21), 5);
        expect(point.z / 1.5).toBeCloseTo(59.25, 5);
      }
    }
  });
  it('retains every finite transfer path, native source selection and original phase rail', () => {
    const { meshes, motion } = fixture(), drops = meshes.find(m => m.userData.salinityRole === 'finite-water-portions')!;
    const a = drops.geometry.attributes.position as Three.BufferAttribute, per = a.count / 18;
    for (const mode of [0, 1, 2]) {
      motion.update(.45, mode, 0, true); const s = evaluateSalinity(.45, mode);
      for (let i = 0; i < 18; i++) {
        const point = center(a, i * per, per), original = salinityPortionPoint(s, i);
        point.toArray().forEach((value, axis) => expect(value / 1.5).toBeCloseTo(original[axis], 5));
      }
    }
    const selections = new Set(meshes.filter(m => m.userData.modelInput?.kind === 'replay').map(m => m.userData.modelInput.selection));
    expect([...selections].sort()).toEqual([0, 1, 2]);
    const handle = meshes.find(m => m.userData.salinityRole === 'water-handle')!;
    expect(handle.userData.modelInput).toMatchObject({ kind: 'phase-track', track: { start: [144, 76.5, -102], end: [144, 9, -102] } });
    motion.update(.7, 1, 0, true); expect(handle.position.toArray()).toEqual([144, 29.25, -102]);
  });
  it('keeps fixed owned buffers through reverse seeking and extra shared support geometry', () => {
    const { root, meshes, motion } = fixture(), count = meshes.length;
    // A shared wrapper can add a separate support: this must not falsely
    // report growth of the independently owned trough subtree.
    root.add(new Three.Mesh(new Three.BoxGeometry(1, 1, 1), new Three.MeshBasicMaterial()));
    for (let i = 0; i < 40; i++) motion.update((i % 11) / 10, i % 3, 0, true);
    expect(meshes).toHaveLength(count);
    expect(motion.describe!()).toMatchObject({ observationTrough: { fixedMeshCount: true, buffersStable: true, inputModulesAreAlternatives: true } });
    for (const m of meshes) expect([...m.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
    expect(meshes.some(m => m.name.includes('gear'))).toBe(false);
  });
  it('opens an actual above-water side inlet for the preserved river path', () => {
    const { root, motion } = fixture(), plug = root.getObjectByName('removable-river-inlet-plug')!;
    for (const mode of [0, 1, 2]) {
      motion.update(1, mode, 0, true); expect(plug.visible).toBe(mode !== 2);
      expect(motion.describe!()).toMatchObject({ observationTrough: { riverPortOpen: mode === 2, riverPortSill: 22.6 } });
    }
    const state = evaluateSalinity(1, 2);
    expect(3 + state.waterLevel).toBeLessThan(22.6);
    // Final unchanged straight leg crosses x19.7 inside the open y/z window.
    const t = (19.7 - 18) / (30 - 18), y = 24.2 + (3 + state.waterLevel - 24.2) * t, z = 38 + 4 * t;
    expect(y).toBeGreaterThan(22.6); expect(y).toBeLessThan(27.4);
    expect(z).toBeGreaterThan(35.6); expect(z).toBeLessThan(44.4);
  });
  it('frames only the active condition while keeping a phase-invariant complete envelope', () => {
    const { root, meshes, motion } = fixture();
    const envelope = (mode: number) => { motion.update(0, mode, 0, true); return motion.focusBounds!(); };
    const bounds = [0, 1, 2].map(envelope);
    expect(bounds[0].min[0]).toBeGreaterThan(bounds[2].min[0]);
    expect(bounds[1].max[1]).toBeLessThan(bounds[0].max[1]);
    for (const mode of [0, 1, 2]) for (const phase of [0, .12, .5, .88, 1, .5]) {
      motion.update(phase, mode, 0, true); root.updateMatrixWorld(true);
      expect(motion.focusBounds!()).toEqual(bounds[mode]);
      const box = new Three.Box3(new Three.Vector3(...bounds[mode].min), new Three.Vector3(...bounds[mode].max)).expandByScalar(.001);
      for (const object of meshes.filter(m => m.visible)) {
        const actual = new Three.Box3().setFromObject(object);
        expect(box.containsBox(actual), `mode ${mode}/phase ${phase}/${object.name}: ${actual.min.toArray()}..${actual.max.toArray()}`).toBe(true);
      }
    }
  });
});
