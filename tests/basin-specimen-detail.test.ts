import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { basinGround, basinFloodLevel, basinRiverPoint } from '../src/textbook-integrated-model';
import { basinSpecimenGround, basinSpecimenBedding, basinSurfaceTreatment } from '../src/textbook-basin-detail';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildBasinSpecimen } from '../src/textbook-basin-specimen';

const fixture = () => {
  const root = new T.Group(), meshes: T.Mesh[] = [];
  const b: any = { root, meshes, mesh(geometry: T.BufferGeometry, color: string) {
    const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ color })); root.add(mesh); meshes.push(mesh); return mesh;
  } };
  const specimen = buildBasinSpecimen(b, { s: 1, p: at => [...at] as [number, number, number] });
  return { specimen, meshes, root };
};

describe('basin relief protected by the scientific water corridor', () => {
  it('preserves every bank, river and maximum-inundation point in the complete specimen footprint', () => {
    let preserved = 0, sculpted = 0, highest = 0;
    for (let x = 4; x <= 99; x += .5) for (let z = 4; z <= 60; z += .5) {
      const original = basinGround(x, z), height = basinSpecimenGround(x, z);
      const river = basinRiverPoint((x - 8) / 91);
      expect(height).toBeGreaterThanOrEqual(original);
      if (Math.abs(z - river[2]) <= 12 || original <= basinFloodLevel(x, 1) + 2) {
        expect(height).toBe(original); preserved++;
      } else if (height > original + .5) sculpted++;
      highest = Math.max(highest, height);
    }
    expect(preserved).toBeGreaterThan(10000); expect(sculpted).toBeGreaterThan(1000);
    expect(highest).toBeLessThan(65);
  });
  it('gives the upstream rear shoulder a dominant ridge and smaller foothills', () => {
    const relief = (x: number, z: number) => basinSpecimenGround(x, z) - basinGround(x, z);
    expect(relief(15, 7)).toBeGreaterThan(10);
    expect(relief(15, 7)).toBeGreaterThan(relief(52, 7));
    expect(relief(52, 7)).toBeGreaterThan(relief(71, 12));
    expect(relief(16, 57)).toBeLessThan(relief(15, 7));
    for (let x = 4; x <= 99; x += 1.3) for (let z = 4; z <= 60; z += 1.7) {
      const a = basinSpecimenGround(x, z), b = basinSpecimenGround(x + .0001, z + .0001);
      expect(Math.abs(b - a)).toBeLessThan(.002);
    }
  });
  it('keeps specimen bedding ordered and all surface treatments finite', () => {
    for (const x of [4, 15, 33, 71, 99]) for (const z of [4, 15, 34, 52, 60]) {
      const beds = [-4, 1, 5.2, 11, 18.5, 28, 40, 80].map(y => basinSpecimenBedding(y, x, z));
      expect(beds[0]).toBe(-4); beds.slice(1).forEach((y, i) => expect(y).toBeGreaterThan(beds[i]));
      expect(Object.values(basinSurfaceTreatment(x, z)).every(Number.isFinite)).toBe(true);
    }
  });
  it('mounts continuous coloured cut faces and fitted shoes on the same moving solids', () => {
    const { meshes, specimen, root } = fixture();
    const shoes = meshes.filter(m => m.userData.integratedRole === 'basin-fitted-specimen-shoe');
    const tops = meshes.filter(m => m.userData.heightField === 'basinGround');
    expect(shoes).toHaveLength(5); expect(tops).toHaveLength(5);
    for (const top of tops) {
      expect(top.geometry.attributes.color.count).toBe(top.geometry.attributes.position.count);
      expect((top.material as T.MeshStandardMaterial).vertexColors).toBe(true);
    }
    const cuts = meshes.filter(m => m.userData.integratedRole === 'basin-specimen-cut-stratum');
    expect(cuts).toHaveLength(5); expect(cuts.every(m => m.userData.diagrammaticBedding)).toBe(true);
    specimen.update('specimen-closed', 0, true); root.updateMatrixWorld(true);
    const fixed = tops.map(m => m.getWorldPosition(new T.Vector3()).toArray());
    specimen.update('specimen-open', 0, true); root.updateMatrixWorld(true);
    for (let i = 0; i < tops.length; i++) {
      const sameParent = shoes.find(shoe => shoe.parent === tops[i].parent);
      expect(sameParent).toBeDefined();
      if (tops[i].userData.specimenBand === 'front') {
        expect(tops[i].getWorldPosition(new T.Vector3()).toArray()).not.toEqual(fixed[i]);
        expect(sameParent!.getWorldPosition(new T.Vector3()).toArray()).toEqual(tops[i].getWorldPosition(new T.Vector3()).toArray());
      }
    }
  });
});
