import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildSolarHeatingWorld } from '../src/textbook-solar-heating-world';
import { evaluateSolarHeating, SOLAR_HEATING_LAYOUT } from '../src/textbook-solar-heating-model';
import { LIFT_MARGIN } from '../src/textbook-geometry';

function fixture() {
  const root = new T.Group(), meshes: T.Mesh[] = [];
  const b: any = {
    width: 200, root, meshes, pop: { u: { uSurfAlpha: { value: 1 } }, paperMats: [] }, accentStrokes: [],
    mesh(geometry: T.BufferGeometry, color: string) {
      const m = new T.Mesh(geometry, new T.MeshStandardMaterial({ color })); root.add(m); meshes.push(m); return m;
    },
    label(text: string, at: number[], w: number, h: number) {
      const m = this.mesh(new T.PlaneGeometry(w, h), '#fff'); m.position.fromArray(at);
      m.userData.kind = 'text-label'; m.userData.text = text; return m;
    },
    stroke() {}, contour() {}, outline() {}, v(p: number[]) { return new T.Vector3(...p); },
  };
  const motion = buildSolarHeatingWorld(b);
  return { motion, meshes, role: (name: string) => meshes.filter(m => m.userData.solarHeatingRole === name) };
}

describe('assembled thermal house keeps the original closed heat circuit', () => {
  it('keeps all six actual water bodies and three radiation marks on their original routes while scrubbing', () => {
    const { motion, role, meshes } = fixture(), water = role('persistent-water-mark'), rays = role('shortwave-mark');
    const ids = meshes.map(m => m.geometry.uuid), buffers = meshes.map(m => m.geometry.attributes.position.array);
    const physical = (point: number[]) => [point[0] * 2, point[1] * 2, -LIFT_MARGIN - 144 + point[2] * 2];
    for (const phase of [0, .22, .44, .6, .72, .84, 1, .6, 0]) {
      motion.update(phase, 0, 0, true); const state = evaluateSolarHeating(phase), actual = motion.describe!();
      expect(actual.water).toEqual(state.water); expect(actual.rays).toEqual(state.rays);
      expect(water).toHaveLength(6); expect(rays).toHaveLength(3);
      for (const [group, definitions] of [[water, state.water], [rays, state.rays]] as const)
        group.forEach((m, i) => m.position.toArray().forEach((value, j) => expect(value).toBeCloseTo(physical(definitions[i].point)[j], 10)));
      expect(meshes.map(m => m.geometry.uuid)).toEqual(ids);
      expect(meshes.every((m, i) => m.geometry.attributes.position.array === buffers[i])).toBe(true);
      expect(actual.geometryBuffersReused).toBe(true);
    }
  });

  it('changes the physical receiving fins from the same room state and restores cold on rewind', () => {
    const { motion, role } = fixture(), fins = role('receiver-fins');
    expect(fins).toHaveLength(2);
    for (const phase of [.8, 1, .7, 0]) {
      motion.update(phase, 0, 0, true); const state = evaluateSolarHeating(phase);
      for (const m of fins) {
        const key = m.userData.receiverRoom as 'upper' | 'lower';
        const expected = new T.Color('#e4e2d4').lerp(new T.Color('#c39a6c'), state.roomWarmth[key]);
        expect((m.material as T.MeshStandardMaterial).color.toArray()).toEqual(expected.toArray());
      }
    }
  });

  it('leaves every device clickable, seats the single legend on the apron, and shares one reversible physical slider', () => {
    const { motion, role } = fixture();
    for (const [name, selection] of [['solar-source', 0], ['thermal-collector', 1], ['water-pump', 2], ['receiver-fins', 3]] as const)
      expect(role(name).every(m => m.userData.modelInput.selection === selection)).toBe(true);
    const rider = role('phase-handle')[0], thumb = role('phase-thumb')[0];
    expect(thumb.userData.modelInput).toBe(rider.userData.modelInput);
    for (const phase of [0, 1, .4, .9, .4]) {
      motion.update(phase, 0, 0, true);
      expect(role('process-label').filter(m => m.visible)).toHaveLength(1);
      expect(role('process-label').every(m => m.userData.labelMount === 'surface')).toBe(true);
      const x = (SOLAR_HEATING_LAYOUT.trackStart[0] + 80 * phase) * 2;
      expect(rider.position.x).toBeCloseTo(x, 10); expect(thumb.position.x).toBeCloseTo(x, 10);
    }
    expect(motion.describe!()).toMatchObject({ depictsPhotovoltaicElectricity: false,
      floatingProcessBoards: false, wallOpenings: 2, supportedPump: true });
  });
});
