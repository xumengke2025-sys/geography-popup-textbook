import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildSoilPoreInstrument } from '../src/textbook-soil-pore-world';
import { buildSoilTextureWorld } from '../src/textbook-soil-texture-world';
import { evaluateSoilPores } from '../src/textbook-ground-process-model';
import { evaluateSoilTexture, SOIL_TEXTURE_GRAINS } from '../src/textbook-soil-texture-model';

function fixture(builder: (b: any) => any) {
  const root = new T.Group(), meshes: T.Mesh[] = [], materials = new Map<string, T.MeshStandardMaterial>();
  const b: any = { width: 300, height: 160, root, meshes, pop: { paperMats: [] },
    materialFor(role: string, color: string) { const k = role + color;
      if (!materials.has(k)) materials.set(k, new T.MeshStandardMaterial({ color })); return materials.get(k)!; },
    mesh(geometry: T.BufferGeometry, color: string, _edges: boolean, _volume: boolean, role: string) {
      const mesh = new T.Mesh(geometry, this.materialFor(role, color)); root.add(mesh); meshes.push(mesh); return mesh; },
    label(text: string, at: number[], width: number, height: number) {
      const m = this.mesh(new T.PlaneGeometry(width, height), '#fff', false, false, 'paper');
      m.position.set(...at); m.userData.text = text; return m; }, contour() {},
  };
  return { motion: builder(b), meshes, root };
}
const volume = (mesh: T.Mesh) => {
  const a = mesh.geometry.attributes.position; let v = 0;
  for (let i = 0; i + 2 < a.count; i += 3) {
    const p = new T.Vector3().fromBufferAttribute(a, i), q = new T.Vector3().fromBufferAttribute(a, i + 1), r = new T.Vector3().fromBufferAttribute(a, i + 2);
    v += p.dot(q.cross(r)) / 6;
  } return Math.abs(v);
};

describe('soil-composition is one retained specimen with complementary pore fill', () => {
  it('changes actual water volume inside fixed pore boundaries while all minerals remain fixed', () => {
    const { motion, meshes } = fixture(buildSoilPoreInstrument), grains = meshes.filter(m => m.userData.soilPoreRole === 'mineral');
    const original = grains.map(m => [m.position.toArray(), Array.from(m.geometry.attributes.position.array)]);
    const pores = ['water', 'air'].map(role => meshes.filter(m => m.userData.soilPoreRole === role));
    let fixedVolume = 0;
    for (const mode of [0, 1, 2, 0]) {
      motion.update(.5, mode); const state = evaluateSoilPores(mode);
      for (let i = 0; i < 5; i++) {
        const w = volume(pores[0][i]), a = volume(pores[1][i]);
        expect(w / (w + a)).toBeCloseTo(state.water, 5);
        if (!fixedVolume) fixedVolume = w + a; expect(w + a).toBeCloseTo(fixedVolume, 2);
      }
      expect(grains.map(m => [m.position.toArray(), Array.from(m.geometry.attributes.position.array)])).toEqual(original);
      expect(motion.describe()).toMatchObject({ ...state, solidsStationary: true, samePores: true });
    }
  });
  it('keeps organic pieces embedded and provides a physical three-stop control', () => {
    const { motion, meshes } = fixture(buildSoilPoreInstrument);
    expect(meshes.filter(m => m.userData.soilPoreRole === 'organic')).toHaveLength(15);
    expect(meshes.filter(m => m.userData.kind === 'text-label')).toHaveLength(0);
    for (const mode of [0, 1, 2]) {
      motion.update(0, mode);
      const control = meshes.filter(m => m.userData.soilPoreRole === 'moisture-knob');
      expect(control.length).toBeGreaterThan(0);
      expect(control.every(m => m.userData.modelInput.selection === (mode + 1) % 3)).toBe(true);
    }
  });
});

describe('soil-texture has one rainfall comparison and three independent drainage paths', () => {
  it('has nine genuinely hollow outlet bores and three retained open collection vessels', () => {
    const { meshes, motion } = fixture(buildSoilTextureWorld);
    const outlets = meshes.filter(m => m.userData.soilTextureRole === 'actual-drain-nozzle');
    expect(outlets).toHaveLength(9);
    for (const m of outlets) {
      const a = m.geometry.attributes.position, inner = m.userData.openBoreRadius;
      expect(inner).toBeGreaterThan(0);
      for (let i = 0; i < a.count; i++) expect(Math.hypot(a.getX(i), a.getZ(i))).toBeGreaterThanOrEqual(inner - 1e-5);
    }
    expect(new Set(meshes.filter(m => m.userData.soilTextureRole === 'collector').map(m => m.userData.soilTextureSample)).size).toBe(3);
    expect(motion.describe()).toMatchObject({ independentCollectors: 3, equalRainCells: 3, selfSupporting: true });
  });
  it('reuses grain and water buffers and drives the water, cups and reservoirs from the unchanged scientific model', () => {
    const { meshes, motion } = fixture(buildSoilTextureWorld);
    const grains = meshes.filter(m => m.userData.soilTextureRole === 'soil-grains');
    const water = meshes.filter(m => m.userData.soilTextureRole === 'water-portions');
    const original = grains.map(m => new Float32Array(m.geometry.attributes.position.array));
    const grainBuffers = grains.map(m => m.geometry.attributes.position);
    const buffers = water.map(m => m.geometry.attributes.position);
    expect(grains.map(m => m.userData.grainCount)).toEqual(SOIL_TEXTURE_GRAINS.map(g => g.length));
    for (const phase of [0, .2, .4, .9, 1, .4]) for (const selection of [0, 1, 2]) {
      motion.update(phase, selection); const state = evaluateSoilTexture(phase, selection);
      expect(motion.describe().samples).toEqual(state.samples);
      for (let i = 0; i < 3; i++) {
        expect(water[i].geometry.attributes.position).toBe(buffers[i]);
        expect(grains[i].geometry.attributes.position).toBe(grainBuffers[i]);
        const current = grainBuffers[i].array;
        expect(Buffer.from(current.buffer, current.byteOffset, current.byteLength)
          .equals(Buffer.from(original[i].buffer))).toBe(true);
        const pool = meshes.find(m => m.userData.soilTextureRole === 'collected-water' && m.userData.soilTextureSample === i)!;
        const reservoir = meshes.find(m => m.userData.soilTextureRole === 'rain-reservoir' && m.userData.soilTextureSample === i)!;
        expect(pool.userData.fraction).toBe(state.samples[i].collected);
        expect(reservoir.userData.fraction).toBe(state.samples[i].reservoir);
      }
    }
  });
  it('keeps specimen selection independent of time and retains direct replay and drag controls', () => {
    const { meshes, motion } = fixture(buildSoilTextureWorld);
    const handle = meshes.find(m => m.userData.soilTextureHandle)!;
    motion.update(0, 0); expect(handle.position.toArray()).toEqual(handle.userData.modelInput.track.start);
    motion.update(1, 2); expect(handle.position.toArray()).toEqual(handle.userData.modelInput.track.end);
    expect(meshes.some(m => m.userData.soilTextureRole === 'replay-tag' && m.userData.modelInput.kind === 'replay')).toBe(true);
    expect(meshes.filter(m => m.userData.soilTextureRole === 'soil-grains').map(m => m.userData.modelInput.selection)).toEqual([0, 1, 2]);
  });
});
