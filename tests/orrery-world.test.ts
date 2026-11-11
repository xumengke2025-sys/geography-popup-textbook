import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildOrreryWorld } from '../src/textbook-orrery-world';
import { evaluateSolarSystem } from '../src/textbook-astronomy-model';
import { phaseFromDialPoint, type PhaseDial } from '../src/textbook-model-input';

function fixture() {
  const root = new T.Group(), meshes: T.Mesh[] = [];
  const b = {
    root, width: 100,
    p: (u: number, v: number, y = 0) => [u * 100, y, -96 - (1 - v) * 80],
    mesh: (geometry: T.BufferGeometry, color: string) => {
      const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color }));
      root.add(mesh); meshes.push(mesh); return mesh;
    },
    label: (_text: string, at: [number, number, number]) => {
      const mesh = new T.Mesh(new T.PlaneGeometry(12, 5));
      mesh.position.set(...at); root.add(mesh); meshes.push(mesh); return mesh;
    },
    contour: vi.fn(),
  };
  return { root, meshes, motion: buildOrreryWorld(b as any) };
}

describe('the orrery carries the scientific state without independent prop animation', () => {
  it('keeps all eight carrier endpoints joined to their planet stalks while scrubbing both ways', () => {
    const { motion, root } = fixture();
    for (const phase of [0, .125, .371, .9, 1, .371, 0]) {
      motion.update(phase, 0, 0, true); root.updateMatrixWorld(true);
      const state = motion.describe!() as any, science = evaluateSolarSystem(phase);
      expect(state.planetPositions).toHaveLength(8);
      for (const [i, planet] of state.planetPositions.entries()) {
        expect(planet.local).toEqual(science.bodies[i].point);
        expect(new T.Vector3(...planet.supportEndpoint).distanceTo(new T.Vector3(...planet.stalkBottom))).toBeLessThan(1e-7);
      }
    }
  });
  it('exposes a phase control whose visible grip agrees with the existing circular input contract', () => {
    const { motion, meshes, root } = fixture();
    for (const phase of [.12, .44, .83]) {
      motion.update(phase, 3, 0, true); root.updateMatrixWorld(true);
      const state = motion.describe!() as any;
      const grip = meshes.find(m => m.userData.orreryPart === 'handwheel-grip')!;
      grip.geometry.computeBoundingBox();
      const at = grip.localToWorld(grip.geometry.boundingBox!.getCenter(new T.Vector3()));
      expect(at.x).toBeCloseTo(state.phaseDialPoint[0]);
      expect(at.y).toBeCloseTo(state.phaseDialPoint[1]);
      expect(phaseFromDialPoint(at.x, at.y, state.phaseDial as PhaseDial, 0)).toBeCloseTo(phase);
      expect(grip.userData.modelInput.kind).toBe('phase-dial');
    }
  });
  it('rests its levelling pads at the local page plane and keeps focus bounds around all construction', () => {
    const { motion, meshes, root } = fixture();
    motion.update(.371, 0, 0, true); root.updateMatrixWorld(true);
    const bounds = motion.focusBounds!();
    const focus = new T.Box3(new T.Vector3(...bounds.min), new T.Vector3(...bounds.max));
    for (const mesh of meshes.filter(m => m.userData.orreryPart)) {
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      expect(focus.clone().expandByScalar(.001).containsBox(box), mesh.name).toBe(true);
      if (mesh.userData.orreryPart === 'three-small-levelling-pads') expect(box.min.y).toBeCloseTo(0);
    }
    expect((motion.describe!() as any).source.periodsToScale).toBe(false);
    expect((motion.describe!() as any).instrumentMechanismIsAstronomicalCause).toBe(false);
  });
});
