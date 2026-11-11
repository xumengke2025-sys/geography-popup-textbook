import { describe, expect, it } from 'vitest';
import { COASTAL_PROCESS_REFERENCE, evaluateCoastalProcess,
  coastalBlockGeometry, coastalCoreGeometry, coastalPlatformGeometry,
  coastalPlatformHeight, coastalProcessSvg, type CoastalMeshData } from '../src/textbook-coastal-process-model';

function volume(mesh: CoastalMeshData) {
  let sum = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i] * 3, b = mesh.indices[i + 1] * 3, c = mesh.indices[i + 2] * 3, p = mesh.positions;
    sum += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1])
      - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c])
      + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  return sum / 6;
}

function expectClosed(mesh: CoastalMeshData) {
  const edges = new Map<string, { count: number; balance: number }>();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const face = mesh.indices.slice(i, i + 3);
    const points = face.map(k => mesh.positions.slice(k * 3, k * 3 + 3));
    const u = points[1].map((v, j) => v - points[0][j]), v = points[2].map((v, j) => v - points[0][j]);
    expect(Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])).toBeGreaterThan(1e-7);
    for (let j = 0; j < 3; j++) {
      const a = face[j], b = face[(j + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key) ?? { count: 0, balance: 0 };
      edge.count++; edge.balance += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) { expect(edge.count).toBe(2); expect(edge.balance).toBe(0); }
  expect(volume(mesh)).toBeGreaterThan(0);
}

describe('coastal cliff: undercut, finite collapse and a platform left in place', () => {
  it('undercuts the toe before fracture or collapse, without shifting the crown inland', () => {
    const first = evaluateCoastalProcess(0), eroded = evaluateCoastalProcess(.33), ready = evaluateCoastalProcess(.44);
    expect(first.undercut).toBe(0); expect(eroded.undercut).toBeGreaterThan(0);
    expect(ready.undercut).toBeGreaterThan(eroded.undercut);
    expect(eroded.blocks.every(b => b.fall === 0 && b.crack === 0)).toBe(true);
    for (let id = 0; id < 3; id++) {
      const a = coastalBlockGeometry(first, id), b = coastalBlockGeometry(eroded, id);
      // Each transverse section has seven vertical levels and two sides.
      for (let i = 0; i < a.positions.length; i += 42) {
        expect(b.positions[i + 6 * 6 + 3 + 2]).toBeCloseTo(a.positions[i + 6 * 6 + 3 + 2], 11);
        expect(b.positions[i + 3 * 6 + 3 + 2]).toBeLessThan(a.positions[i + 3 * 6 + 3 + 2]);
      }
      expect(volume(b)).toBeLessThan(volume(a));
    }
  });
  it('keeps all five rock bodies closed with consistently wound, nondegenerate faces', () => {
    expectClosed(coastalCoreGeometry()); expectClosed(coastalPlatformGeometry());
    for (const phase of [0, .20, .44, .56, .71, .87, 1]) {
      const state = evaluateCoastalProcess(phase);
      for (const block of state.blocks) expectClosed(coastalBlockGeometry(state, block.id));
    }
  });
  it('preserves each identifiable slab after detachment instead of respawning rubble', () => {
    const ready = evaluateCoastalProcess(.44), done = evaluateCoastalProcess(1);
    expect(done.blocks.map(b => b.id)).toEqual(ready.blocks.map(b => b.id));
    expect(done.inventory).toEqual({ attached: 0, falling: 0, deposited: 3, total: 3 });
    for (const phase of [.50, .64, .79, 1]) {
      const state = evaluateCoastalProcess(phase);
      expect(state.inventory.attached + state.inventory.falling + state.inventory.deposited).toBe(3);
      for (const b of state.blocks) expect(volume(coastalBlockGeometry(state, b.id))).toBeCloseTo(volume(coastalBlockGeometry(ready, b.id)), 6);
    }
    expect(evaluateCoastalProcess(.95).blocks).toEqual(done.blocks);
  });
  it('rests the fallen slabs on the same sloping platform and exposes more of it', () => {
    let exposed = 0;
    for (let i = 0; i <= 100; i++) {
      const state = evaluateCoastalProcess(i / 100);
      expect(state.exposedPlatform).toBeGreaterThanOrEqual(exposed - 1e-8); exposed = state.exposedPlatform;
      for (const block of state.blocks) {
        const mesh = coastalBlockGeometry(state, block.id);
        for (let k = 0; k < mesh.positions.length; k += 3) {
          const y = mesh.positions[k + 1], z = mesh.positions[k + 2];
          expect(y - coastalPlatformHeight(z)).toBeGreaterThanOrEqual(-1e-8);
          expect(z).toBeLessThan(61);
        }
      }
    }
    expect(exposed).toBeGreaterThan(8);
  });
  it('has exact seeking in both directions and bounds nonfinite inputs', () => {
    const baseline = evaluateCoastalProcess(.68);
    for (const phase of [1, .2, .91, 0]) evaluateCoastalProcess(phase);
    expect(evaluateCoastalProcess(.68)).toEqual(baseline);
    expect(coastalBlockGeometry(evaluateCoastalProcess(.68), 1)).toEqual(coastalBlockGeometry(baseline, 1));
    expect(evaluateCoastalProcess(-1).phase).toBe(0); expect(evaluateCoastalProcess(5).phase).toBe(1);
    expect(evaluateCoastalProcess(NaN).phase).toBe(0);
  });
  it('projects the same finite blocks in SVG and states the scientific limits', () => {
    const state = evaluateCoastalProcess(.68), svg = coastalProcessSvg(.68);
    expect(svg).not.toContain('<image'); expect(svg).not.toContain('<animate');
    const probes = JSON.parse(svg.match(/data-block-probes='([^']+)'/)![1]);
    for (const probe of probes) {
      const b = state.blocks[probe.id]; expect(probe.state).toBe(b.state); expect(probe.fall).toBeCloseTo(b.fall, 4);
      probe.translation.forEach((n: number, i: number) => expect(n).toBeCloseTo(b.translation[i], 4));
    }
    expect(svg).toContain('不表示真实年限'); expect(svg).toContain('其他海岸形态不是必经阶段');
    expect(COASTAL_PROCESS_REFERENCE.measuredRates).toBe(false);
    expect(coastalProcessSvg(.68)).toEqual(svg);
  });
});
