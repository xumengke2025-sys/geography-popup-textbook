import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { evaluateGreenhouseResponse } from '../src/textbook-sky-causality-model';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildSolarDisturbanceWorld, buildMarsTransferWorld, buildGreenhouseResponseWorld } from '../src/textbook-sky-causality-world';

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
  return { motion, meshes, role };
}

describe('visible receiving geometry follows the same causal phase', () => {
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
