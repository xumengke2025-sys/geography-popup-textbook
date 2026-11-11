import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import type { Figure } from '../src/textbook-catalog';
import { flatLandExtra } from '../src/textbook-flat-land-extra';
import { evaluateSoilTransferDetail } from '../src/textbook-soil-transfer-detail-model';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildLandExtra } from '../src/textbook-models-land-extra';

function fixture(effect: string) {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), materials = new Map<string, Three.MeshBasicMaterial>();
  const b = {
    width: 300, height: 150, root, meshes, flow: [],
    pop: { paper: ({ color }: { color: string }) => new Three.MeshBasicMaterial({ color, side: Three.DoubleSide }) },
    material(color: string) { if (!materials.has(color)) materials.set(color, new Three.MeshBasicMaterial({ color })); return materials.get(color)!; },
    mesh(geometry: Three.BufferGeometry, color = '#fff') { const mesh = new Three.Mesh(geometry, this.material(color)); meshes.push(mesh); root.add(mesh); return mesh; },
    box(a: Vec3, c: Vec3, color: string) { const g = new Three.BoxGeometry(c[0] - a[0], c[1] - a[1], c[2] - a[2]); g.translate((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2); return this.mesh(g, color); },
    tube(points: Vec3[], radius: number, color: string) { return this.mesh(new Three.TubeGeometry(new Three.CatmullRomCurve3(points.map(p => new Three.Vector3(...p))), 56, radius, 6, false), color); },
    label(text: string, at: Vec3, width: number, height: number) { const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...at); mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh; },
    v(point: Vec3) { return new Three.Vector3(...point); },
    stroke() {}, outline() {}, trace() {}, contour() {},
  };
  return { meshes, root, motion: buildLandExtra(b as unknown as TextbookGeometry, effect)! };
}

describe('vegetation observes existing structures without changing a type into another', () => {
  it('focuses the same tree, highlights its actual parts and returns to the overview', () => {
    const { motion, meshes } = fixture('vegetation'); motion.update(.53, 0, 1 / 60, false);
    const beforeCount = meshes.length, overview = motion.focusBounds!(), feature = motion.describe!().featuredTree;
    for (const target of ['vine', 'buttress']) {
      motion.inspect!(target); motion.update(.53, 0, 1 / 60, false);
      expect(motion.describe!()).toMatchObject({ type: 'rainforest', inspection: target, phaseMeaning: 'static-traits' });
      expect(meshes.length).toBe(beforeCount);
      const visibleParts = meshes.filter(mesh => mesh.visible && mesh.userData.vegetationPart === target);
      expect(visibleParts.length).toBeGreaterThan(0);
      expect(visibleParts.every(mesh => mesh.userData.vegetationTree === feature)).toBe(true);
      const focus = motion.focusBounds!();
      expect(focus.max[0] - focus.min[0]).toBeLessThan(overview.max[0] - overview.min[0]);
      expect(meshes.filter(mesh => mesh.visible && mesh.userData.kind === 'text-label')).toHaveLength(1);
    }
    motion.inspect!('overview'); motion.update(.53, 0, 1 / 60, false);
    expect(motion.focusBounds!()).toEqual(overview); expect(motion.describe!().inspection).toBe('overview');
  });

  it('builds closed buttress solids with paired edges and continuous volumetric vine tubes', () => {
    const { meshes } = fixture('vegetation');
    const roots = meshes.filter(mesh => mesh.userData.vegetationPart === 'buttress'); expect(roots.length).toBeGreaterThan(5);
    for (const mesh of roots) {
      const attr = mesh.geometry.attributes.position, edges = new Map<string, number>();
      for (let i = 0; i < attr.count; i += 3) {
        const vertices = [0, 1, 2].map(offset => [attr.getX(i + offset), attr.getY(i + offset), attr.getZ(i + offset)].map(n => n.toFixed(3)).join(','));
        for (let j = 0; j < 3; j++) { const edge = [vertices[j], vertices[(j + 1) % 3]].sort().join('|'); edges.set(edge, (edges.get(edge) ?? 0) + 1); }
      }
      expect([...edges.values()].every(count => count === 2)).toBe(true);
    }
    const tubes = meshes.filter(mesh => mesh.userData.vegetationPart === 'vine' && mesh.geometry.type === 'TubeGeometry');
    expect(tubes).toHaveLength(3);
    expect(tubes.every(mesh => mesh.geometry.attributes.position.count > 250)).toBe(true);
  });

  it('keeps the season fixed during internal-layer inspection and resets local focus on a type switch', () => {
    const { motion, meshes } = fixture('vegetation'); motion.update(.61, 2, 1 / 60, false);
    const transforms = meshes.map(mesh => [...mesh.position.toArray(), ...mesh.scale.toArray()]);
    motion.inspect!('layers'); motion.update(.61, 2, 1 / 60, false);
    expect(meshes.map(mesh => [...mesh.position.toArray(), ...mesh.scale.toArray()])).toEqual(transforms);
    expect(motion.describe!()).toMatchObject({ type: 'deciduous-broadleaf', inspection: 'layers', phaseMeaning: 'leaf-season' });
    motion.update(.61, 1, 1 / 60, false); expect(motion.describe!()).toMatchObject({ type: 'evergreen-broadleaf', inspection: 'overview' });
  });

  it('retains every forest tree while inspecting its existing understory', () => {
    const { motion, meshes } = fixture('vegetation');
    for (const type of [0, 1, 2, 3]) {
      motion.update(.2, type, 1 / 60, false);
      const stems = meshes.filter(mesh => mesh.visible && mesh.userData.vegetationPart === 'branched-stem');
      const crownIds = meshes.filter(mesh => mesh.visible && mesh.userData.vegetationPart === 'crown').map(mesh => mesh.userData.vegetationTree);
      expect(stems).toHaveLength(8);
      motion.inspect!('layers'); motion.update(.2, type, 1 / 60, false);
      expect(stems.every(mesh => mesh.visible)).toBe(true);
      expect(meshes.filter(mesh => mesh.visible && mesh.userData.vegetationPart === 'crown').map(mesh => mesh.userData.vegetationTree)).toEqual(crownIds);
      expect(motion.describe!().allTreesRetainedDuringLayerInspection).toBe(true);
    }
  });

  it('leaves fallen material on the same ground at season end and restores it on reverse seeking', () => {
    const { motion, meshes } = fixture('vegetation');
    const leaves = meshes.filter(mesh => mesh.userData.vegetationPart === 'retained-fallen-leaf');
    const buffers = meshes.map(mesh => mesh.geometry.attributes.position.array);
    motion.update(.53, 2, 1 / 60, false);
    const middle = leaves.map(mesh => ({ visible: mesh.visible, p: mesh.position.toArray(), r: mesh.rotation.toArray() }));
    motion.update(1, 2, 1 / 60, false);
    expect(leaves).toHaveLength(12); expect(leaves.every(mesh => mesh.visible)).toBe(true);
    expect(leaves.every(mesh => Math.abs(mesh.position.y - 5.64) < 1e-9)).toBe(true);
    expect(meshes.filter(mesh => mesh.visible && mesh.userData.vegetationPart === 'crown')).toHaveLength(0);
    motion.update(0, 2, 1 / 60, false); expect(leaves.every(mesh => !mesh.visible)).toBe(true);
    motion.update(.53, 2, 1 / 144, false);
    expect(leaves.map(mesh => ({ visible: mesh.visible, p: mesh.position.toArray(), r: mesh.rotation.toArray() }))).toEqual(middle);
    meshes.forEach((mesh, i) => expect(mesh.geometry.attributes.position.array).toBe(buffers[i]));
  });
});

describe('soil transfer leaves readable evidence at the receiving layer', () => {
  for (const factor of [0, 1, 2]) {
    it(`keeps all 12 identities, with no reception before contact, for factor ${factor}`, () => {
      let previous = evaluateSoilTransferDetail(0, factor);
      expect(previous.received).toBe(0);
      for (let step = 0; step <= 100; step++) {
        const state = evaluateSoilTransferDetail(step / 100, factor), { source, moving, incorporating, retained, total } = state.inventory;
        expect(source + moving + incorporating + retained).toBe(total); expect(total).toBe(12);
        expect(new Set(state.particles.map(p => p.id)).size).toBe(12);
        expect(state.received).toBeGreaterThanOrEqual(previous.received);
        state.particles.forEach((packet, i) => {
          expect(packet.h).toBeLessThanOrEqual(previous.particles[i].h + 1e-10);
          if (!packet.arrived) expect(packet.incorporation).toBe(0);
        });
        previous = state;
      }
      expect(previous.received).toBe(1); expect(previous.retained).toBe(12);
      expect(previous.receiverPatches.every(patch => patch.amount === 1)).toBe(true);
      expect(previous.particles.every(packet => packet.h === packet.target.h && packet.u === packet.target.u)).toBe(true);
    });
  }

  it('lets rain and infiltration reach the movable soil constituents before release', () => {
    const state = evaluateSoilTransferDetail(0, 2);
    for (const packet of state.particles) {
      const atRelease = evaluateSoilTransferDetail(packet.releaseAt, 2);
      expect(atRelease.water.rainReach).toBe(1);
      expect(atRelease.water.front).toBeLessThan(packet.source.h);
    }
    expect(state.material).toBe('mobile-soil-constituent'); expect(state.rainAddsMobileMaterial).toBe(false);
  });

  it('uses the same permanent markers and receiving accumulation in the actual 3-D and SVG views', () => {
    const { motion, meshes } = fixture('soil-factors'), figure = { effect: 'soil-factors' } as Figure;
    for (const factor of [0, 1, 2]) for (const phase of [0, .53, 1, .53, 0]) {
      const state = evaluateSoilTransferDetail(phase, factor); motion.update(phase, factor, 1 / 60, false);
      expect(motion.describe!().provenance).toEqual(state);
      const packets = meshes.filter(mesh => mesh.visible && mesh.userData.soilPacketId !== undefined);
      expect(packets).toHaveLength(12); expect(new Set(packets.map(mesh => mesh.userData.soilPacketId)).size).toBe(12);
      for (const mesh of packets) {
        const packet = state.particles[mesh.userData.soilPacketId];
        // The retained section now occupies 84% of the tray and uses a 1.1
        // display-height ratio. Scientific coordinates remain unchanged.
        expect(mesh.position.x).toBeCloseTo((.5 + (packet.u - .5) * .84) * 300);
        expect(mesh.position.y).toBeCloseTo(packet.h * 3 * 1.1);
        expect(mesh.userData.soilTransferStage).toBe(packet.stage);
      }
      const svg = flatLandExtra(figure, phase, factor)!;
      expect(svg.match(/data-soil-packet=/g)).toHaveLength(12);
      expect(svg.match(/data-stage="retained"/g) ?? []).toHaveLength(state.retained);
      expect(svg).not.toMatch(/NaN|Infinity|<image/);
    }
  });

  it('has continuous contact and retained endpoints under reverse seeking', () => {
    for (const factor of [0, 1, 2]) {
      const middle = evaluateSoilTransferDetail(.634, factor); evaluateSoilTransferDetail(1, factor); evaluateSoilTransferDetail(0, factor);
      expect(evaluateSoilTransferDetail(.634, factor)).toEqual(middle);
      for (const packet of middle.particles) for (const phase of [packet.releaseAt, packet.contactAt, packet.settledAt]) {
        const before = evaluateSoilTransferDetail(phase - 1e-6, factor).particles[packet.id], after = evaluateSoilTransferDetail(phase + 1e-6, factor).particles[packet.id];
        expect(Math.hypot(before.u - after.u, before.v - after.v, before.h - after.h)).toBeLessThan(.0001);
      }
    }
  });
});
