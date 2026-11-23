import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { evaluateUrbanWater, URBAN_WATER_LAYOUT, URBAN_WATER_ORIGINS, URBAN_WATER_PACKET_COUNT,
  URBAN_WATER_REFERENCE, URBAN_WATER_STOPS, urbanWaterPacketPath, urbanWaterPrismMesh,
  urbanWaterSolids, urbanWaterSvg } from '../src/textbook-urban-water-model';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import { LIFT_MARGIN, type TextbookGeometry, type Vec3 } from '../src/textbook-geometry';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildUrbanWaterWorld } from '../src/textbook-urban-water-world';

import { loadFieldInstrument } from '../src/textbook-field-instruments';
beforeAll(() => loadFieldInstrument('urban-waterlogging'));

function fixture() {
  const root = new Three.Group(), meshes: Three.Mesh[] = [];
  const b: any = {
    width: 300, height: 140, root, meshes,
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    v: (point: Vec3) => new Three.Vector3(...point),
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color })); root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, point: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...point);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; mesh.userData.labelSize = [width, height]; return mesh;
    },
    house(at: Vec3, width: number, height: number) {
      const geometry = new Three.BoxGeometry(width, height, width * .75); geometry.translate(at[0], at[1] + height / 2, at[2]);
      this.mesh(geometry);
    },
    stroke() {}, contour() {}, outline() {}, ring: vi.fn(),
  };
  return { b, meshes, root, motion: buildUrbanWaterWorld(b as TextbookGeometry) };
}
const closePoint = (a: number[], b: number[]) => a.forEach((value, i) => expect(value).toBeCloseTo(b[i], 9));

describe('a finite, source-bounded urban rainfall comparison', () => {
  it('keeps the fitted surface inlet physically open all the way down to its drain floor', () => {
    const { meshes, root } = fixture(), s = 3;
    root.updateMatrixWorld(true);
    const origin = root.localToWorld(new Three.Vector3(88 * s, 30 * s, -LIFT_MARGIN - 72 * s + 58.25 * s));
    const ray = new Three.Raycaster(origin, new Three.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(meshes.filter(m => /drain|inlet/.test(m.userData.urbanRole ?? '')));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].object.userData.urbanRole).toBe('drain-floor');
    expect(root.worldToLocal(hits[0].point.clone()).y / s).toBeCloseTo(5, 5);
  });
  it('inspects a chosen drop or drain without replaying or changing the finite rain', () => {
    const { motion, meshes } = fixture();
    motion.update(.71, 2, 0, true);
    const before = motion.describe!() as any;
    motion.inspect!('packet-9'); motion.update(.71, 2, 0, true);
    const selected = motion.describe!() as any;
    expect(selected.inspection).toBe('packet-9');
    expect(selected.packets).toEqual(before.packets); expect(selected.phase).toBe(.71);
    expect(meshes.filter(m => m.userData.urbanRole === 'water-packet').every(m => m.userData.modelInput.kind === 'inspect')).toBe(true);
    motion.inspect!('drain'); motion.update(.71, 2, 0, true);
    expect((motion.describe!() as any).inventory).toEqual(before.inventory);
    expect(meshes.find(m => m.userData.urbanRole === 'tracked-water-ring')!.visible).toBe(false);
    const svg = urbanWaterSvg(.71, 2, 'packet-9');
    expect(svg).toContain('data-model-inspect="packet-9"');
    expect(svg).toContain('data-model-inspect="drain"');
    expect(JSON.parse(svg.match(/data-urban-state='([^']+)'/)![1]).inventory).toEqual(before.inventory);
  });
  it('starts all three independent conditions with the identical rain packet identities and locations', () => {
    const first = evaluateUrbanWater(0, 0).packets;
    expect(first).toHaveLength(12); expect(URBAN_WATER_PACKET_COUNT).toBe(12);
    for (const selection of [0, 1, 2]) {
      const state = evaluateUrbanWater(0, selection);
      expect(state.selection).toBe(selection); expect(state.inventory.air).toBe(12);
      expect(state.packets.map(({ id, point, color }) => ({ id, point, color })))
        .toEqual(first.map(({ id, point, color }) => ({ id, point, color })));
      expect(state.sameRainInput).toBe(true);
    }
    expect(URBAN_WATER_STOPS.map(stop => stop.phase)).toEqual([0, .3, .5, .7, 1]);
    expect(URBAN_WATER_REFERENCE).toMatchObject({ printedPages: [96, 97, 98], figures: ['5.23', '5.24'],
      calibratedVolume: false, calibratedTime: false, measuredRunoffPercentages: false,
      purificationSimulated: false, preventsAllFlooding: false });
  });

  it('conserves all twelve unique visible markers across every compartment and condition', () => {
    for (const selection of [0, 1, 2]) for (let i = 0; i <= 200; i++) {
      const state = evaluateUrbanWater(i / 200, selection);
      expect(Object.values(state.inventory).reduce((a, b) => a + b, 0)).toBe(12);
      expect(state.retainedCount).toBe(12); expect(new Set(state.packets.map(packet => packet.id)).size).toBe(12);
      expect(state.packets.flatMap(packet => packet.point).every(Number.isFinite)).toBe(true);
      for (const [compartment, count] of Object.entries(state.inventory))
        expect(state.packets.filter(packet => packet.compartment === compartment)).toHaveLength(count);
      expect(state.packets.every(packet => packet.retained)).toBe(true);
      expect(state.wraps).toBe(false); expect(state.respawns).toBe(false);
    }
  });

  it('keeps all final rain visible in the surface, soil, hollow or collector instead of deleting drained water', () => {
    const states = [0, 1, 2].map(selection => evaluateUrbanWater(1, selection));
    expect(states[0].inventory).toEqual({ air: 0, surface: 8, soil: 0, storage: 0, drain: 0, collected: 4 });
    expect(states[1].inventory).toEqual({ air: 0, surface: 2, soil: 6, storage: 0, drain: 0, collected: 4 });
    expect(states[2].inventory).toEqual({ air: 0, surface: 1, soil: 4, storage: 3, drain: 0, collected: 4 });
    for (const state of states) {
      expect(state.complete).toBe(true); expect(state.endpointCount).toBe(12);
      for (const packet of state.packets) {
        expect(packet.point).toEqual(packet.destination); expect(packet.compartment).toBe(packet.finalDestination);
        if (packet.compartment === 'collected') {
          expect(packet.point[0]).toBeGreaterThan(URBAN_WATER_LAYOUT.collector.left);
          expect(packet.point[0]).toBeLessThan(URBAN_WATER_LAYOUT.collector.right);
          expect(packet.point[2]).toBeGreaterThan(URBAN_WATER_LAYOUT.collector.back);
          expect(packet.point[2]).toBeLessThan(URBAN_WATER_LAYOUT.collector.front);
        }
      }
      expect(state.inventory.surface).toBeGreaterThan(0); expect(state.preventsAllFlooding).toBe(false);
      expect(state.quantitativeRunoffModel).toBe(false); expect(state.packetUnitsAreSchematic).toBe(true);
    }
  });

  it('retains infiltrated water in permeable soil and garden layers, with qualitatively later release', () => {
    expect(evaluateUrbanWater(.7, 0).inventory.soil).toBe(0);
    expect(evaluateUrbanWater(.7, 1).inventory.soil).toBeGreaterThan(0);
    expect(evaluateUrbanWater(.7, 2).inventory.storage).toBeGreaterThan(0);
    expect(evaluateUrbanWater(.85, 0).inventory.collected).toBeGreaterThan(evaluateUrbanWater(.85, 2).inventory.collected);
    for (const selection of [1, 2]) {
      const paths = URBAN_WATER_ORIGINS.map(origin => urbanWaterPacketPath(origin.index, selection));
      expect(paths.some(path => path.some(node => node.compartment === 'soil'))).toBe(true);
      expect(paths.some(path => path.some(node => node.compartment === 'storage'))).toBe(true);
    }
    const overflow = urbanWaterPacketPath(11, 2).map(node => node.compartment);
    expect(overflow).toContain('storage'); expect(overflow).toContain('surface'); expect(overflow.at(-1)).toBe('collected');
  });

  it('has continuous paths with no jump at any change of compartment, including the endpoint', () => {
    for (const selection of [0, 1, 2]) for (const origin of URBAN_WATER_ORIGINS) {
      const path = urbanWaterPacketPath(origin.index, selection);
      expect(path[0].phase).toBe(0); expect(path.at(-1)!.phase).toBe(1);
      path.forEach((node, i) => {
        expect(node.point.every(Number.isFinite)).toBe(true);
        if (i > 0) expect(node.phase).toBeGreaterThan(path[i - 1].phase);
        const before = evaluateUrbanWater(Math.max(0, node.phase - 1e-7), selection).packets[origin.index];
        const after = evaluateUrbanWater(Math.min(1, node.phase + 1e-7), selection).packets[origin.index];
        expect(Math.hypot(...before.point.map((v, j) => v - after.point[j]))).toBeLessThan(.001);
        closePoint(evaluateUrbanWater(node.phase, selection).packets[origin.index].point, node.point);
      });
    }
  });

  it('seeks deterministically in either direction and clamps the endpoint instead of restarting', () => {
    for (const selection of [0, 1, 2]) {
      const expected = evaluateUrbanWater(.672914, selection);
      for (const phase of [1, .1, .8, 0, .35]) evaluateUrbanWater(phase, selection);
      expect(evaluateUrbanWater(.672914, selection)).toEqual(expected);
      expect(evaluateUrbanWater(-5, selection)).toEqual(evaluateUrbanWater(0, selection));
      expect(evaluateUrbanWater(5, selection)).toEqual(evaluateUrbanWater(1, selection));
      expect(evaluateUrbanWater(1, selection)).not.toEqual(evaluateUrbanWater(0, selection));
    }
    for (const phase of [NaN, Infinity, -Infinity]) expect(evaluateUrbanWater(phase, 0).phase).toBe(0);
  });

  it('builds a truly open layered depression and actual separated permeable pavers from shared geometry', () => {
    const garden = urbanWaterSolids(2), pavers = urbanWaterSolids(1).filter(solid => solid.role === 'permeable-paver');
    expect(pavers).toHaveLength(28);
    expect(garden.map(solid => solid.role)).toEqual(expect.arrayContaining([
      'garden-mulch', 'garden-planting-soil', 'garden-fill', 'garden-sand', 'garden-gravel', 'drain-floor',
    ]));
    for (const pavement of garden.filter(solid => solid.role.includes('pavement'))) {
      const xs = pavement.profile.map(point => point[0]);
      expect(Math.max(...xs) <= 36 || Math.min(...xs) >= 64).toBe(true);
    }
    for (const solid of [0, 1, 2].flatMap(urbanWaterSolids)) {
      const mesh = urbanWaterPrismMesh(solid), edges = new Map<string, number>();
      expect(mesh.positions.every(Number.isFinite)).toBe(true);
      const vertices = Array.from({ length: mesh.positions.length / 3 }, (_, i) =>
        new Three.Vector3(...mesh.positions.slice(i * 3, i * 3 + 3) as Vec3));
      const center = vertices.reduce((sum, point) => sum.add(point), new Three.Vector3()).divideScalar(vertices.length);
      // Back-face culling is safe only if every face of these convex sections
      // is wound outwards. Check the geometry, not the material flag alone.
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const [a, b, c] = mesh.indices.slice(i, i + 3).map(index => vertices[index]);
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        const faceCenter = a.clone().add(b).add(c).divideScalar(3);
        expect(normal.dot(faceCenter.sub(center))).toBeGreaterThan(0);
      }
      for (let i = 0; i < mesh.indices.length; i += 3) for (let j = 0; j < 3; j++) {
        const a = mesh.indices[i + j], b = mesh.indices[i + (j + 1) % 3];
        const key = [a, b].sort((x, y) => x - y).join(':'); edges.set(key, (edges.get(key) ?? 0) + 1);
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
      expect(solid.front).toBeGreaterThan(solid.back);
    }
  });

  it('exposes identical unrounded packet positions and inventories in the native SVG', () => {
    for (const selection of [0, 1, 2]) for (const phase of [0, .3, .527481, .7, 1]) {
      const state = evaluateUrbanWater(phase, selection), svg = urbanWaterSvg(phase, selection);
      expect(svg).not.toContain('<image'); expect(svg).not.toContain('data:image');
      expect(svg.match(/data-urban-packet="/g)).toHaveLength(12);
      expect(svg.match(/data-urban-condition="/g)).toHaveLength(3);
      const embedded = JSON.parse(svg.match(/data-urban-state='([^']+)'/)![1]);
      expect(embedded).toEqual({ phase: state.phase, selection: state.selection, stageIndex: state.stageIndex,
        inventory: state.inventory, packets: state.packets.map(({ id, point, compartment, finalDestination }) => ({ id, point, compartment, finalDestination })) });
      expect(svg).toContain(state.caption); expect(svg).not.toMatch(/75%|80%|立方米|毫升|净化率/);
    }
  });
});

describe('the same finite rainfall state drives the actual raised city', () => {
  it('uses scanned sections, two roofed street buildings, persistent water and in-place surface controls', () => {
    const { meshes, motion } = fixture();
    const tokens = meshes.filter(mesh => mesh.userData.urbanRole === 'water-packet'); expect(tokens).toHaveLength(12);
    expect(new Set(tokens.map(mesh => mesh.userData.urbanPacketId)).size).toBe(12);
    for (const name of ['terrace-house','pump-house']) {
      const parts=meshes.filter(mesh=>mesh.userData.urbanRole===name);
      expect(parts.length).toBeGreaterThan(6);
      expect(parts.map(mesh=>mesh.userData.blenderColor)).toEqual(expect.arrayContaining(['#3f5960','#56646a','#739084']));
    }
    expect((meshes.find(mesh=>mesh.userData.urbanRole==='garden-gravel')?.material as Three.Material).userData.earthScan).toBe('alluvium');
    expect((meshes.find(mesh=>mesh.userData.urbanRole==='garden-planting-soil')?.material as Three.Material).userData.earthScan).toBe('loam');
    expect(meshes.filter(mesh => mesh.userData.urbanRole === 'condition-tab').map(mesh => mesh.userData.modelInput))
      .toEqual([0, 1, 2].map(selection => ({ kind: 'select', selection, keepPhase:true, label: `切换${['硬化', '透水', '花园'][selection]}，保留当前雨程` })));
    const labels = meshes.filter(mesh => mesh.userData.kind === 'text-label');
    expect(labels).toHaveLength(6); expect(labels.every(mesh => mesh.userData.labelSize[1] >= 7.8 * 3)).toBe(true);
    expect(motion.describe!()).toMatchObject({ kind: 'urban-rainfall-partition', sameRainInput: true,
      quantitativeRunoffModel: false, preventsAllFlooding: false, allPacketsVisible: true,
      originalPagePreserved: true, elevatedAbovePage: 129 });
  });

  it('places every water marker and front handle from the same pure state at any seek or frame rate', () => {
    const { motion, b } = fixture();
    for (const selection of [0, 2, 1]) for (const phase of [0, .3, .8, 1, .4, 0, 1]) {
      b.ring.mockClear();
      motion.update(phase, selection, 1 / 30, false);
      const state = evaluateUrbanWater(phase, selection), actual = motion.describe!();
      expect(actual.state).toEqual(state); expect(actual.packets).toEqual(state.packets);
      expect(actual.inventory).toEqual(state.inventory); expect(actual.allPacketsVisible).toBe(true);
      const arrived = state.packets.filter(packet => packet.endpointReached && packet.compartment === 'collected');
      expect(b.ring.mock.calls).toHaveLength(arrived.length);
      arrived.forEach((packet, i) => {
        closePoint(b.ring.mock.calls[i][0], [packet.point[0] * 3, 2.55 * 3, -LIFT_MARGIN - 72 * 3 + packet.point[2] * 3]);
        expect(b.ring.mock.calls[i].slice(1)).toEqual([1.65 * 3, 'xz']);
      });
      for (const packet of actual.packetWorld as { id: string; point: Vec3 }[]) {
        const expected = state.packets.find(sample => sample.id === packet.id)!;
        closePoint(packet.point, [expected.point[0] * 3, expected.point[1] * 3 + 129, -336 + expected.point[2] * 3]);
      }
      const track = actual.phaseTrackWorld as { start: Vec3; end: Vec3 };
      closePoint(actual.handleWorld as Vec3, track.start.map((value, i) => value + (track.end[i] - value) * phase));
      motion.update(phase, selection, 1 / 144, true); expect(motion.describe!().state).toEqual(state);
    }
  });

  it('keeps geometry buffers stable through mode switching, with an open garden and visible endpoint water', () => {
    const { meshes, motion } = fixture(), buffers = meshes.map(mesh => mesh.geometry.attributes.position.array);
    const count = meshes.length, focus = motion.focusBounds!();
    for (const selection of [0, 1, 2, 0, 2]) for (const phase of [0, .7, 1, .2, 1]) {
      motion.update(phase, selection, 1 / 60, false); const diagnostic = motion.describe!();
      expect(meshes).toHaveLength(count); expect(diagnostic.geometryBuffersReused).toBe(true);
      expect(motion.focusBounds!()).toEqual(focus);
      meshes.forEach((mesh, i) => expect(mesh.geometry.attributes.position.array).toBe(buffers[i]));
      if (selection === 2) {
        expect(diagnostic.openGardenSection).toBe(true);
        expect(meshes.filter(mesh => mesh.visible && mesh.userData.urbanRole === 'impervious-pavement')).toHaveLength(0);
        expect(meshes.filter(mesh => mesh.visible && mesh.userData.urbanRole === 'garden-mulch')).toHaveLength(1);
      }
    }
  });

  it('lets the front carriage seek along its local track in both directions', () => {
    const { meshes } = fixture(), handle = meshes.find(mesh => mesh.userData.urbanRole === 'phase-handle')!;
    const { kind, track } = handle.userData.modelInput;
    expect(kind).toBe('phase-track'); expect(track.start[2]).toBe(track.end[2]); expect(handle.userData.smallPointTarget).toBe(true);
    for (const phase of [0, .8, .23, 1, .23]) {
      const point = track.start.map((value: number, i: number) => value + (track.end[i] - value) * phase);
      expect(phaseFromTrackPoint(point[0], point[1], track, 0)).toBeCloseTo(phase, 12);
    }
  });
});
