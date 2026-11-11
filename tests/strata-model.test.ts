import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { evaluateStrata, normalizeStrataSelection, strataMatch, strataSvg, STRATA_LAYERS,
  STRATA_CORRELATIONS, STRATA_FOSSIL_INK, STRATA_REFERENCE } from '../src/textbook-strata-model';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildStrataWorld } from '../src/textbook-strata-world';

function fixture() {
  const meshes: Three.Mesh[] = [], contours: { points: Vec3[]; width: number }[] = [], root = new Three.Group();
  const b = {
    width: 300, height: 140, root, meshes, contours, materials: new Map(),
    pop: { paper: ({ color }: { color: string }) => new Three.MeshBasicMaterial({ color }) },
    p: (u: number, v: number, y = 0): Vec3 => [u * 300, y, -96 - (1 - v) * 140],
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color }));
      root.add(mesh); meshes.push(mesh); return mesh;
    },
    box(a: Vec3, c: Vec3, color: string) {
      const geometry = new Three.BoxGeometry(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      geometry.translate((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2);
      return this.mesh(geometry, color);
    },
    label(text: string, position: Vec3, w: number, h: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(w, h)); mesh.position.set(...position);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    contour(points: Vec3[], width: number) { contours.push({ points, width }); },
  };
  const motion = buildStrataWorld(b as unknown as TextbookGeometry);
  return { b, motion };
}

describe('textbook p.15 figure 1.23 fossil evidence and layer ownership', () => {
  it('retains the original different fossil combinations, including the two unmatched layers', () => {
    expect(STRATA_REFERENCE).toMatchObject({ printedPage: 15, pdfPage: 20, figure: '1.23' });
    expect(STRATA_LAYERS.map(l => l.fossils.map(f => f.kind))).toEqual([
      ['fan-shell', 'curled-shell'], ['cone-imprint'], ['round-imprint'],
      ['leaf-shell', 'small-shell'], ['curled-shell', 'fan-shell'], ['cone-imprint'],
    ]);
    expect(new Set(STRATA_LAYERS.flatMap(l => l.fossils.map(f => f.kind))).size).toBe(6);
    expect(STRATA_LAYERS.flatMap(l => l.fossils)).toHaveLength(9);
    expect(new Set(Object.values(STRATA_FOSSIL_INK).map(ink => JSON.stringify(ink.outline))).size).toBe(6);
  });
  it('correlates fossil evidence across unequal heights, not same-numbered beds or arbitrary lines', () => {
    expect(STRATA_CORRELATIONS.map(c => [c.a, c.b])).toEqual([[0, 4], [1, 5]]);
    expect(STRATA_LAYERS[0].level).not.toBe(STRATA_LAYERS[4].level);
    expect(STRATA_LAYERS[1].level).not.toBe(STRATA_LAYERS[5].level);
    expect(Array.from({ length: 6 }, (_, i) => strataMatch(i))).toEqual([4, 5, null, null, 0, 1]);
    for (const { a, b } of STRATA_CORRELATIONS) {
      expect(STRATA_LAYERS[a].fossils.map(f => f.kind).sort()).toEqual(STRATA_LAYERS[b].fossils.map(f => f.kind).sort());
    }
  });
  it('can focus either end at phase 0 and 1, and never invents a mate for the unmatched beds', () => {
    for (const phase of [0, 1]) for (let layer = 0; layer < 6; layer++) {
      const state = evaluateStrata(phase, layer + 2), mate = strataMatch(layer);
      expect(state.focused).toBe(layer); expect(state.match).toBe(mate);
      expect(state.emphasized.slice().sort()).toEqual((mate === null ? [layer] : [layer, mate]).sort());
      expect(state.layers.filter(l => l.highlighted).map(l => l.index).sort()).toEqual(state.emphasized.slice().sort());
      expect(state.connections.filter(c => c.visible)).toHaveLength(mate === null ? 0 : 1);
    }
  });
  it('keeps the original column intact in the whole view and opens gaps reversibly in layer view', () => {
    for (const phase of [0, .25, .7, 1]) {
      const assembled = evaluateStrata(phase, 0);
      expect(assembled.layers.every(l => l.offsetY === 0 && l.offsetZ === 0)).toBe(true);
      expect(assembled.connections.filter(c => c.visible)).toHaveLength(2);
    }
    expect(evaluateStrata(0, 1).gap).toBe(0);
    expect(evaluateStrata(1, 1).gap).toBe(9);
    const middle = evaluateStrata(.4, 4); evaluateStrata(1, 7); evaluateStrata(0, 0);
    expect(evaluateStrata(.4, 4)).toEqual(middle);
    for (let step = 1; step <= 100; step++) expect(evaluateStrata(step / 100, 1).gap).toBeGreaterThan(evaluateStrata((step - 1) / 100, 1).gap);
  });
  it('uses one owner transform for a bed, every fossil and the correlation endpoints', () => {
    for (const phase of [0, .43, 1]) for (const selection of [1, 2, 3, 6, 7]) {
      const state = evaluateStrata(phase, selection);
      for (const layer of state.layers) {
        const d = STRATA_LAYERS[layer.index];
        layer.profile.forEach(([x, y], i) => { expect(x).toBe(d.profile[i][0]); expect(y - d.profile[i][1]).toBeCloseTo(layer.offsetY); });
        layer.fossils.forEach((f, i) => {
          expect(f.owner).toBe(layer.index); expect(f.y - d.fossils[i].y).toBeCloseTo(layer.offsetY);
          expect(f.x).toBe(d.fossils[i].x); expect(f.z).toBe(layer.offsetZ);
        });
      }
      for (const connection of state.connections) {
        expect(connection.from[1]).toBeCloseTo(6 + state.layers[connection.a].level * 12 + state.layers[connection.a].offsetY);
        expect(connection.to[1]).toBeCloseTo(6 + state.layers[connection.b].level * 12 + state.layers[connection.b].offsetY);
      }
    }
  });
  it('bounds invalid input and preserves source data through repeated seeking and selection', () => {
    const source = JSON.stringify(STRATA_LAYERS);
    for (const input of [-4, NaN, Infinity, -Infinity]) expect(evaluateStrata(input, 1)).toEqual(evaluateStrata(0, 1));
    expect(evaluateStrata(3, 1)).toEqual(evaluateStrata(1, 1));
    for (const selection of [NaN, Infinity, -2]) expect(normalizeStrataSelection(selection)).toBe(0);
    expect(normalizeStrataSelection(12)).toBe(7);
    for (let selection = 0; selection < 8; selection++) evaluateStrata(.73, selection);
    expect(JSON.stringify(STRATA_LAYERS)).toBe(source);
  });
  it('renders all nine fossil reliefs and six accessible layer targets as native SVG from the same state', () => {
    for (const phase of [0, .35, 1]) for (const selection of [0, 1, 2, 4, 7]) {
      const svg = strataSvg(phase, selection), state = evaluateStrata(phase, selection);
      expect(svg).not.toContain('<image'); expect(svg).not.toMatch(/NaN|Infinity/);
      expect(svg.match(/data-strata-fossil=/g)).toHaveLength(9); expect(svg.match(/data-model-selection=/g)).toHaveLength(6);
      expect(svg.match(/role="button" tabindex="0"/g)).toHaveLength(6);
      expect(svg.match(/data-strata-correlation=/g) ?? []).toHaveLength(state.connections.filter(c => c.visible).length);
      for (const layer of state.layers) for (const f of layer.fossils)
        expect(svg).toContain(`data-strata-fossil="${f.id}" data-fossil-kind="${f.kind}" data-owner="${layer.id}" data-x="${f.x}" data-y="${Number(f.y.toFixed(4))}"`);
      expect(svg.includes('data-strata-handle="true"')).toBe(state.separated);
    }
  });
  it('builds six closed 3D beds and nine real relief fossils, all with the matching owner selection', () => {
    const { b, motion } = fixture(); motion.update(.5, 2, 0, false);
    const beds = b.meshes.filter(m => m.userData.strataRole === 'layer'), fossils = b.meshes.filter(m => m.userData.strataRole === 'fossil');
    expect(beds).toHaveLength(6); expect(fossils).toHaveLength(9);
    for (const mesh of [...beds, ...fossils]) {
      mesh.geometry.computeBoundingBox(); expect(mesh.geometry.boundingBox!.max.z - mesh.geometry.boundingBox!.min.z).toBeGreaterThan(.25 * 3);
      expect(mesh.userData.modelInput).toMatchObject({ kind: 'select', selection: mesh.userData.strataLayer + 2, toggleTo: 1 });
    }
    expect(b.meshes.filter(m => m.userData.kind === 'text-label').map(m => m.userData.text)).toEqual(['A', 'B']);
    const handle = b.meshes.find(m => m.userData.strataHandle)!;
    expect(handle.userData.modelInput.kind).toBe('phase-track'); expect(handle.visible).toBe(true);
  });
  it('moves actual fossil and bed meshes together without rebuilding geometries while seeking or focusing', () => {
    const { b, motion } = fixture(), count = b.meshes.length;
    const positions = b.meshes.map(m => m.geometry.attributes.position), before = positions.map(a => Array.from(a.array));
    for (const phase of [0, 1, .37, 0, 1]) for (let selection = 0; selection < 8; selection++) {
      b.contours.length = 0; motion.update(phase, selection, 0, true);
      const state = evaluateStrata(phase, selection);
      for (const mesh of b.meshes.filter(m => m.userData.strataLayer !== undefined)) {
        const expected = state.layers[mesh.userData.strataLayer];
        expect(mesh.position.y).toBeCloseTo(expected.offsetY * 3); expect(mesh.position.z).toBeCloseTo(expected.offsetZ * 3);
        expect(mesh.userData.highlighted).toBe(expected.highlighted);
      }
      expect(b.meshes.length).toBe(count);
      const bounds = motion.focusBounds!(); expect([...bounds.min, ...bounds.max].every(Number.isFinite)).toBe(true);
    }
    b.meshes.forEach((m, i) => { expect(m.geometry.attributes.position).toBe(positions[i]); expect(Array.from(m.geometry.attributes.position.array)).toEqual(before[i]); });
  });
});
