import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildSoilFactorsWorld } from '../src/textbook-soil-factors-world';

function specimen() {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), mats = new Map<string, Three.MeshStandardMaterial>();
  const reveal = { value: .43 }, paperMats: Three.Material[] = [];
  const b = {
    width: 300, height: 150, root, meshes, flow: [],
    pop: { paper: ({ color }: { color: string }) => new Three.MeshStandardMaterial({ color }), u: { uSurfAlpha: reveal }, paperMats },
    material(color: string) { if (!mats.has(color)) mats.set(color, new Three.MeshStandardMaterial({ color })); return mats.get(color)!; },
    materialFor(_role: string, color: string) { return this.material(color); },
    mesh(g: Three.BufferGeometry, color = '#fff') { const m = new Three.Mesh(g, this.material(color)); meshes.push(m); root.add(m); return m; },
    box(a: Vec3, c: Vec3, color: string) { return this.mesh(new Three.BoxGeometry(c[0] - a[0], c[1] - a[1], c[2] - a[2]).translate((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2), color); },
    tube(points: Vec3[], radius: number, color: string) { return this.mesh(new Three.TubeGeometry(new Three.CatmullRomCurve3(points.map(p => new Three.Vector3(...p))), 32, radius, 6, false), color); },
    label(text: string, at: Vec3, w: number, h: number) { const m = this.mesh(new Three.PlaneGeometry(w, h)); m.position.set(...at); m.userData.kind = 'text-label'; m.userData.text = text; return m; },
    v: (p: Vec3) => new Three.Vector3(...p), stroke() {}, outline() {}, contour() {}, trace() {},
  };
  const motion = buildSoilFactorsWorld(b as unknown as TextbookGeometry);
  return { motion, meshes, root, reveal, paperMats };
}
const layerNames = ['bedrock-monolith','weathered-parent-material','mineral-soil','organic-horizon'];

describe('retained soil specimen', () => {
  it('keeps each cut surface on the shared reveal and disposal lifecycle', () => {
    const { meshes, reveal, paperMats } = specimen();
    for (const name of layerNames) {
      const material = meshes.find(m => m.userData.soilFactorsPart === name)!.material as Three.MeshStandardMaterial;
      expect(paperMats).toContain(material);
      expect(material.userData.uniforms.uSurfAlpha).toBe(reveal);
      const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <normal_fragment_maps>\n#include <opaque_fragment>' };
      material.onBeforeCompile(shader as any, {} as any);
      expect((shader.uniforms as any).uSurfAlpha).toBe(reveal);
      expect(shader.fragmentShader).toContain('diffuseColor.a *= uSurfAlpha');
    }
  });
  it('closes all four natural strata, with exactly touching interfaces under time growth and reverse seeking', () => {
    const { motion, meshes } = specimen();
    const layers = layerNames.map(name => meshes.find(m => m.userData.soilFactorsPart === name)!);
    for (const phase of [0, .5, 1, .5, 0]) {
      motion.update(phase, 3, 1 / 60, false);
      layers.forEach((mesh, layerIndex) => {
        const g = mesh.geometry, a = g.attributes.position, edges = new Map<string, number>();
        const point = (i: number) => [a.getX(i),a.getY(i),a.getZ(i)].map(v => v.toFixed(3)).join(',');
        for (let i = 0; i < g.index!.count; i += 3) for (let j = 0; j < 3; j++) {
          const edge = [point(g.index!.getX(i+j)),point(g.index!.getX(i+(j+1)%3))].sort().join('|'); edges.set(edge,(edges.get(edge)??0)+1);
        }
        expect([...edges.values()].every(n=>n===2)).toBe(true);
        if (layerIndex > 0) {
          const below = layers[layerIndex - 1].geometry.attributes.position, topOffset = 43 * 11;
          for (let i = 0; i < topOffset; i++) for (const axis of ['getX','getY','getZ'] as const) expect(a[axis](i)).toBeCloseTo(below[axis](i + topOffset), 5);
        }
      });
    }
  });
  it('keeps all five factors independent, preserves the existing slope branch, and restores exact specimen geometry', () => {
    const { motion, meshes } = specimen(); motion.update(.64, 3, 1 / 60, false);
    const before = meshes.filter(m=>layerNames.includes(m.userData.soilFactorsPart)).map(m=>Array.from(m.geometry.attributes.position.array));
    for (const selection of [0,1,2,4]) {
      motion.update(.64,selection,1/60,false);
      if(selection===4){
        expect(motion.describe!()).toMatchObject({factor:'relief-sorting',sorting:{kind:'soil-relief-sorting'}});
        expect(meshes.filter(m=>m.userData.soilFactorsPart).every(m=>!m.visible)).toBe(true);
        expect(meshes.filter(m=>m.visible&&m.userData.soilSortingRole==='grain').length).toBeGreaterThan(12);
      } else expect(motion.describe!()).toMatchObject({factorsAreIndependent:true,provenance:{factor:selection}});
    }
    motion.update(.64,3,1/60,false);
    expect(meshes.filter(m=>layerNames.includes(m.userData.soilFactorsPart)).map(m=>Array.from(m.geometry.attributes.position.array))).toEqual(before);
  });
  it('mounts four inscriptions on their actual native selectors and reuses every geometry buffer', () => {
    const { motion, meshes } = specimen(); motion.update(0,0,1/60,false);
    const labels = meshes.filter(m=>m.userData.soilFactorsPart==='inset-factor-text');
    expect(labels.map(m=>m.userData.text)).toEqual(['母质','生物','气候','时间']);
    expect(labels.every(m=>m.userData.labelMount==='surface'&&m.userData.modelInput.kind==='replay')).toBe(true);
    const positions = new Set(meshes.flatMap(m=>[m.geometry.attributes.position.array]));
    // Both reusable particle shapes become resident on the first biology pass.
    motion.update(.5,1,1/60,false); meshes.forEach(m=>positions.add(m.geometry.attributes.position.array));
    const count = meshes.length;
    for (const n of [2,3,4,0,1,3]) for (const phase of [0,.5,1,.5,0]) motion.update(phase,n,1/60,false);
    expect(meshes).toHaveLength(count); expect(meshes.every(m=>positions.has(m.geometry.attributes.position.array))).toBe(true);
  });
});
