import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry } from '../src/textbook-geometry';
import { evaluateDensityComparison } from '../src/textbook-ground-process-model';
import { densityInstrumentPose, DENSITY_INSTRUMENT as D } from '../src/textbook-density-instrument';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildDensityInstrumentWorld } from '../src/textbook-density-world';

function fixture() {
  const root = new Three.Group(), meshes: Three.Mesh[] = [], materials = new Map<string, Three.Material>();
  const b = { width: 150, height: 95, root, meshes,
    materialFor(role: string, color: string) { const key = role + color; if (!materials.has(key)) materials.set(key, new Three.MeshBasicMaterial({ color })); return materials.get(key); },
    mesh(geometry: Three.BufferGeometry, color: string, _edges: boolean, _volume: boolean, role: string) {
      const object = new Three.Mesh(geometry, this.materialFor(role, color)); object.userData.materialRole = role;
      root.add(object); meshes.push(object); return object;
    },
    label(text: string, at: number[], width: number, height: number) {
      const object = new Three.Mesh(new Three.PlaneGeometry(width, height), new Three.MeshBasicMaterial());
      object.userData.kind = 'text-label'; object.userData.text = text; object.position.set(at[0], at[1], at[2]); root.add(object); meshes.push(object); return object;
    },
  };
  const motion = buildDensityInstrumentWorld(b as unknown as TextbookGeometry);
  return { root, meshes, motion };
}

describe('a working equal-volume seawater comparator', () => {
  it('preserves all three original science conditions and never changes either volume', () => {
    for (const selection of [0, 1, 2]) {
      const state = densityInstrumentPose(selection), source = evaluateDensityComparison(selection);
      expect(state).toMatchObject(source);
      expect(state.sampleVolume).toBeCloseTo(Math.PI * D.waterRadius ** 2 * D.waterHeight);
      const [left, right] = state.suspensions;
      expect(left.anchor[1] - left.pan[1]).toBe(D.suspension);
      expect(right.anchor[1] - right.pan[1]).toBe(D.suspension);
      expect(left.pan[1] - right.pan[1]).toBeCloseTo(selection ? -2 * D.arm * Math.sin(source.angle) : 0);
      expect(state.calibratedReadout).toBe(false);
    }
  });
  it('keeps every hanger exactly connected to its moving beam endpoint while samples stay upright', () => {
    const { root, meshes, motion } = fixture();
    const beam = root.getObjectByName('pierced-balance-beam')!.parent!;
    const pans = [root.getObjectByName('plumb-sample-0')!, root.getObjectByName('plumb-sample-1')!];
    for (const selection of [0, 1, 2, 0]) {
      motion.update(.6, selection, 0, true); root.updateMatrixWorld(true);
      for (let i = 0; i < 2; i++) {
        const pin = beam.localToWorld(new Three.Vector3((i ? 1 : -1) * D.arm, 0, 0));
        const hanger = pans[i].localToWorld(new Three.Vector3(0, D.suspension, 0));
        expect(pin.distanceTo(hanger)).toBeLessThan(1e-9);
        const axis = new Three.Vector3(0, 1, 0).transformDirection(pans[i].matrixWorld);
        expect(axis.distanceTo(new Three.Vector3(0, 1, 0))).toBeLessThan(1e-9);
      }
    }
    expect(meshes.filter(m => m.userData.densityPart === 'fixed-volume-seawater').every(m => m.scale.toArray().every(n => n === 1))).toBe(true);
  });
  it('has identical open vessels, real fork bearings and a beam-owned pointer distinct from the fixed reference', () => {
    const { root, meshes, motion } = fixture(); motion.update(0, 1, 0, true);
    const cups = meshes.filter(m => m.userData.densityPart === 'equal-volume-sectioned-cup');
    const waters = meshes.filter(m => m.userData.densityPart === 'fixed-volume-seawater');
    cups.forEach(c => c.geometry.computeBoundingBox());
    expect(cups[0].geometry.boundingBox).toEqual(cups[1].geometry.boundingBox);
    expect(waters[0].userData.teachingVolume).toEqual(waters[1].userData.teachingVolume);
    expect(root.getObjectByName('pivot-bearing')).toBeTruthy();
    const beam = root.getObjectByName('pierced-balance-beam')!.parent!;
    expect(root.getObjectByName('beam-owned-pointer')!.parent).toBe(beam);
    expect(root.getObjectByName('fixed-zero-reference')!.parent).not.toBe(beam);
    expect(beam.rotation.z).toBe(evaluateDensityComparison(1).angle);
    for (const object of meshes) expect([...object.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
  });
  it('lets actual instrument controls select every condition and retains stable geometry on reverse comparison', () => {
    const { root, meshes, motion } = fixture();
    const inputSelections = new Set(meshes.flatMap(m => m.userData.densitySelection === undefined ? [] : [m.userData.densitySelection]));
    expect([...inputSelections].sort()).toEqual([0, 1, 2]);
    motion.update(0, 0, 0, true); root.updateMatrixWorld(true);
    const initial = root.getObjectByName('plumb-sample-1')!.matrixWorld.clone();
    const buffers = meshes.map(m => m.geometry.attributes.position.array);
    for (let i = 0; i < 20; i++) motion.update(i / 20, (i % 2) + 1, 1 / 60, false);
    motion.update(1, 0, 0, true); root.updateMatrixWorld(true);
    expect(root.getObjectByName('plumb-sample-1')!.matrixWorld.equals(initial)).toBe(true);
    expect(meshes.every((m, i) => m.geometry.attributes.position.array === buffers[i])).toBe(true);
    expect(motion.describe!()).toMatchObject({ kind: 'equal-volume-density', equalVolumes: true, pressureHeldEqual: true,
      numericDensity: false, massTokens: [9, 9], instrument: { buffersStable: true, cupGeometryIdentical: true, massSymbolsAreNotSaltGrains: true } });
  });
});
