import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry } from '../src/textbook-geometry';
import { GEOLOGICAL_INTERVALS, geologicalInterval } from '../src/textbook-sky-causality-model';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildGeologicalSpecimenWorld } from '../src/textbook-geological-specimen-world';

function fixture() {
  const root = new Three.Group(), meshes: Three.Mesh[] = [], materials = new Map<string, Three.Material>();
  const b = { width: 150, height: 95, root, meshes,
    mesh(geometry: Three.BufferGeometry, color: string, _edges: boolean, _volume: boolean, role: string) {
      const key = role + color; if (!materials.has(key)) materials.set(key, new Three.MeshBasicMaterial({ color }));
      const m = new Three.Mesh(geometry, materials.get(key)); root.add(m); meshes.push(m); return m;
    },
  };
  const motion = buildGeologicalSpecimenWorld(b as unknown as TextbookGeometry);
  return { root, meshes, motion };
}

describe('hinged geological specimen folio', () => {
  it('retains four original intervals and a geometrically proportional 4600 Ma ruler', () => {
    const { meshes, motion } = fixture();
    const ruler = meshes.filter(m => m.userData.geologicalPart === 'real-duration-ruler');
    expect(ruler).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      motion.update(.5, i, 0, true);
      expect(motion.describe!()).toMatchObject({ kind: 'geological-time', selected: i,
        boundaryMa: [4600, 541, 252, 66, 0], interval: geologicalInterval(i),
        representativeAssemblages: true, transitionIsBiologicalSimulation: false,
        equalDuration: false, widthUsesRealDuration: true, phaseMeaning: 'static-period-comparison' });
      const [left, right] = ruler[i].userData.durationEndpoints;
      expect((right - left) / 106).toBeCloseTo(geologicalInterval(i).fraction, 13);
      if (i) expect(left).toBe(ruler[i - 1].userData.durationEndpoints[1]);
    }
    expect(ruler[3].userData.durationEndpoints[1]).toBe(108);
  });
  it('keeps every solid specimen attached to the same transverse hinge through selection', () => {
    const { root, meshes, motion } = fixture();
    const leaves = Array.from({ length: 4 }, (_, i) => root.getObjectByName(`specimen-leaf-${i}`)!);
    for (const selected of [0, 2, 1, 3, 0]) {
      motion.update(.2, selected, 1 / 60, false); root.updateMatrixWorld(true);
      for (const leaf of leaves) {
        expect(leaf.visible).toBe(true);
        const a = leaf.localToWorld(new Three.Vector3(0, 0, 0));
        const c = leaf.localToWorld(new Three.Vector3(24, 0, 0));
        expect(a.y).toBeCloseTo(c.y); expect(a.z).toBeCloseTo(c.z);
        expect(a.y).toBeCloseTo(leaves[0].getWorldPosition(new Three.Vector3()).y);
        expect(a.z).toBeCloseTo(leaves[0].getWorldPosition(new Three.Vector3()).z);
      }
    }
    const nativeSelections = new Set(meshes.flatMap(m => m.userData.geologicalSelection === undefined ? [] : [m.userData.geologicalSelection]));
    expect([...nativeSelections].sort()).toEqual([0, 1, 2, 3]);
    expect(root.getObjectByName('continuous-folio-hinge')).toBeTruthy();
  });
  it('uses presentation hinge easing without turning the lesson phase into biological evolution', () => {
    const { motion } = fixture();
    for (const selected of [0, 1, 2, 3]) {
      motion.update(0, selected, 0, true); const beginning = motion.describe!();
      motion.update(1, selected, 0, true); expect(motion.describe!()).toEqual(beginning);
      const specimens = beginning.specimens as any;
      expect(specimens.hingeAngles.filter((n: number) => n === -.2)).toHaveLength(1);
      expect(specimens.equalLeafWidthsAreDuration).toBe(false);
      expect(specimens.reliefsAreInterpretations).toBe(true);
      expect(specimens.namedSpeciesReconstruction).toBe(false);
    }
  });
  it('preserves distinct textbook-supported casts and reusable buffers after reverse selection', () => {
    const { root, meshes, motion } = fixture();
    expect(root.getObjectByName('stromatolite-section-laminae')).toBeTruthy();
    expect(root.getObjectByName('trilobite-paired-pleural-segments')).toBeTruthy();
    expect(root.getObjectByName('dinosaur-continuous-sculpted-cast')).toBeTruthy();
    expect(root.getObjectByName('mammal-continuous-sculpted-cast')).toBeTruthy();
    expect(root.getObjectByName('broadleaf-impression')).toBeTruthy();
    for (let n = 0; n < 24; n++) motion.update(n / 24, n % 4, 1 / 60, false);
    motion.update(1, 0, 0, true);
    expect(motion.describe!()).toMatchObject({ specimens: { buffersStable: true, fixedMeshCount: true,
      rulerFractions: GEOLOGICAL_INTERVALS.map((_, i) => geologicalInterval(i).fraction) } });
    for (const m of meshes) expect([...m.geometry.attributes.position.array].every(Number.isFinite)).toBe(true);
  });
});
