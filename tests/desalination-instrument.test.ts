import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { evaluateDesalination } from '../src/textbook-desalination-model';
import type { TextbookGeometry } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildDesalinationInstrumentWorld } from '../src/textbook-desalination-instrument';
import { loadFieldInstrument } from '../src/textbook-field-instruments';

beforeAll(() => loadFieldInstrument('desalination'));

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
    const crank = root.getObjectByName('geared-hand-crank')!;
    const water = meshes.find(m => m.name === 'collected-salt-rich-water')!;
    const chassis = meshes.find(m => m.name === 'collector-chassis')!;
    const ice = meshes.filter(m => m.name === 'fractured-sea-ice');
    for (const phase of [0, .25, .76, 1, .25]) {
      motion.update(phase, 1, 1 / 24, false);
      expect(rotor.rotation.y).toBeCloseTo(-phase * Math.PI * 4);
      expect(crank.rotation.x).toBeCloseTo(-2 * rotor.rotation.y);
      for (const fragment of ice) {
        fragment.geometry.computeBoundingBox();
        expect(fragment.position.y + fragment.geometry.boundingBox!.min.y).toBeCloseTo(16.31);
      }
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
    const slabs=meshes.filter(m=>m.name==='cleaved-sea-ice');
    expect(slabs).toHaveLength(4);
    expect(slabs.every(m=>m.userData.modelInput.kind==='replay'&&m.userData.modelInput.selection===0)).toBe(true);
    expect(new Set(meshes.filter(m=>m.userData.modelInput?.kind==='select').map(m=>m.userData.modelInput.selection))).toEqual(new Set([0,1]));
    const crank=meshes.find(m=>m.userData.desalinationNativeControl)!.userData.modelInput;
    expect(crank.dial).toMatchObject({plane:'yz',turns:4});
    expect(meshes.some(m=>m.userData.modelInput?.kind==='phase-track')).toBe(true);
    expect(meshes.some(m => m.userData.modelInput?.selection === 1)).toBe(true);
    expect(motion.describe!().potableWaterClaim).toBe(false);
  });
  it('uses closed thickness at both cut faces of the safety guard and finite surface normals', () => {
    const { meshes } = fixture();
    const geometry = meshes.find(mesh => mesh.name === 'sectioned-centrifuge-guard')!.geometry;
    for (const attr of Object.values(geometry.attributes)) expect([...attr.array].every(Number.isFinite)).toBe(true);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.y).toBeCloseTo(16.64);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(35.46);
    const weldedEdges = new Map<string, number>(), position = geometry.attributes.position;
    const key = (i: number) => `${position.getX(i)},${position.getY(i)},${position.getZ(i)}`;
    const triangles = geometry.index!.array;
    for (let i = 0; i < triangles.length; i += 3) for (let j = 0; j < 3; j++) {
      const edge = [key(triangles[i + j]), key(triangles[i + (j + 1) % 3])].sort().join('|');
      weldedEdges.set(edge, (weldedEdges.get(edge) ?? 0) + 1);
    }
    expect([...weldedEdges.values()].every(usage => usage === 2)).toBe(true);
  });
});
