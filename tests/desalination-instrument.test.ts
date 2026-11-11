import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { evaluateDesalination } from '../src/textbook-desalination-model';
import type { TextbookGeometry } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildDesalinationInstrumentWorld, sectionedVesselGeometry } from '../src/textbook-desalination-instrument';

function fixture() {
  const root = new T.Group(), meshes: T.Mesh[] = [];
  const g: any = { root, meshes, width: 100, v: (p: number[]) => new T.Vector3(...p),
    mesh(geometry: T.BufferGeometry, color: string, _e: boolean, _v: boolean, role: string) {
      const object = new T.Mesh(geometry, new T.MeshStandardMaterial({ color }));
      object.userData.materialRole = role; meshes.push(object); root.add(object); return object;
    }, label(_text: string, at: number[]) { const object = new T.Object3D(); object.position.fromArray(at); root.add(object); return object; },
  };
  const motion = buildDesalinationInstrumentWorld(g as TextbookGeometry);
  return { root, meshes, motion };
}

describe('method-specific sea-ice apparatus', () => {
  it('keeps every pocket at the exact original scientific position in both methods, including reversible seeks', () => {
    const { meshes, motion } = fixture(), pockets = meshes.filter(m => m.userData.brinePocketId !== undefined);
    expect(pockets).toHaveLength(16);
    for (const mode of [0, 1]) for (const phase of [0, .4, 1, .4, 0]) {
      motion.update(phase, mode, 0, true);
      const state = evaluateDesalination(phase, mode), result = motion.describe!();
      expect(result.brinePockets).toEqual(state.pockets);
      for (const pocket of pockets) {
        const point = state.pockets[pocket.userData.brinePocketId].point;
        expect(pocket.position.toArray()).toEqual([point[0], point[1], -174 + point[2]]);
      }
      expect(result.collectedPockets).toBe(state.collectedPockets);
    }
  });
  it('rotates basket, crank and ice from one phase while keeping the collector seated and static', () => {
    const { root, meshes, motion } = fixture();
    const rotor = root.getObjectByName('bearing-driven-rotor')!;
    const water = meshes.find(m => m.name === 'collected-salt-rich-water')!;
    const chassis = meshes.find(m => m.name === 'collector-chassis')!;
    for (const phase of [0, .25, .76, 1, .25]) {
      motion.update(phase, 1, 1 / 24, false);
      expect(rotor.rotation.y).toBeCloseTo(-phase * Math.PI * 4);
      water.geometry.computeBoundingBox();
      expect(water.geometry.boundingBox!.min.y * water.scale.y + water.position.y).toBeCloseTo(4.55, 5);
      expect(chassis.position.toArray()).toEqual([0, 0, 0]);
      expect(chassis.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    }
  });
  it('switches complete mechanisms rather than leaving a ghost rack through the rotor', () => {
    const { root, motion, meshes } = fixture();
    const rack = root.getObjectByName('gravity-drain-assembly')!, centrifuge = root.getObjectByName('cutaway-centrifuge-assembly')!;
    motion.update(.5, 0, 0, true); expect(rack.visible).toBe(true); expect(centrifuge.visible).toBe(false);
    motion.update(.5, 1, 0, true); expect(rack.visible).toBe(false); expect(centrifuge.visible).toBe(true);
    expect(meshes.filter(m => m.userData.modelInput?.selection === 0)).toHaveLength(4);
    expect(meshes.some(m => m.userData.modelInput?.selection === 1)).toBe(true);
    expect(motion.describe!().potableWaterClaim).toBe(false);
  });
  it('uses closed thickness at both cut faces of the safety guard and finite surface normals', () => {
    const geometry = sectionedVesselGeometry([[18, 12], [21, 12], [21, 37], [18, 37]], Math.PI * .3, Math.PI * 1.4);
    for (const attr of Object.values(geometry.attributes)) expect([...attr.array].every(Number.isFinite)).toBe(true);
    geometry.computeBoundingBox(); expect(geometry.boundingBox!.min.y).toBe(12); expect(geometry.boundingBox!.max.y).toBe(37);
    expect(geometry.attributes.position.count).toBeGreaterThan(1000);
  });
});
