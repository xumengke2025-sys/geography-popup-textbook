import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import { evaluateRecovery, recoveryCaseIndex, recoveryDiagnostics, recoveryLinkMesh, recoveryProject,
  recoverySvg, RECOVERY_CASES, RECOVERY_LAYOUT, RECOVERY_LINKS, RECOVERY_PARTS, RECOVERY_REFERENCE,
  RECOVERY_STOPS, type RecoveryMeshData } from '../src/textbook-recovery-model';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildRecoveryWorld } from '../src/textbook-recovery-world';

function fixture(width = 150) {
  const root = new Three.Group(), meshes: Three.Mesh[] = [], contours: Vec3[][] = [];
  const b = {
    width, height: 220, root, meshes,
    pop: { paper: ({ color }: { color: string }) => new Three.MeshBasicMaterial({ color }) },
    mesh(geometry: Three.BufferGeometry, color: string) {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color })); root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, at: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height), '#f7f1e3'); mesh.position.set(...at);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    outline() {}, contour(points: Vec3[]) { contours.push(points); }, v(point: Vec3) { return new Three.Vector3(...point); },
  };
  const motion = buildRecoveryWorld(b as unknown as TextbookGeometry);
  return { b, root, meshes, contours, motion };
}
function assertClosed(mesh: RecoveryMeshData) {
  const edges = new Map<string, { count: number; balance: number }>(); let volume = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const face = mesh.indices.slice(i, i + 3), [a, b, c] = face.map(n => new Three.Vector3(...mesh.positions.slice(n * 3, n * 3 + 3)));
    expect(b.clone().sub(a).cross(c.clone().sub(a)).length()).toBeGreaterThan(1e-9);
    volume += a.dot(b.clone().cross(c)) / 6;
    for (let j = 0; j < 3; j++) {
      const a = face[j], b = face[(j + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key) ?? { count: 0, balance: 0 };
      edge.count++; edge.balance += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) { expect(edge.count).toBe(2); expect(edge.balance).toBe(0); }
  expect(Math.abs(volume)).toBeGreaterThan(.0001);
}

describe('textbook p.111: two independent events and observation progress', () => {
  it('binds Yushu rescue and relocated Beichuan to their actual separate photographs and captions', () => {
    const rescue = evaluateRecovery(1, 0), town = evaluateRecovery(0, 1);
    expect(rescue.source.figure).toBe('6.16'); expect(rescue.source.location).toBe('青海玉树'); expect(rescue.source.eventYear).toBe(2010);
    expect(town.source.figure).toBe('6.17'); expect(town.source.location).toBe('四川北川'); expect(town.source.eventYear).toBe(2008);
    expect(rescue.source.source).toBe('textbook/page-116.webp'); expect(town.source.printedPage).toBe(111);
    expect(RECOVERY_CASES[1].source.imageContent).toContain('异地修建');
    expect(RECOVERY_REFERENCE.sameEvent || RECOVERY_REFERENCE.sameLocation || RECOVERY_REFERENCE.rubbleTransformsIntoCity).toBe(false);
    expect(rescue.caseId).not.toBe(town.caseId); expect(new Set(rescue.partIds.filter(id => town.partIds.includes(id))).size).toBe(0);
  });

  it('keeps selection as the case, while all three stage bookmarks stay inside that case', () => {
    for (const selection of [0, 1]) for (const [index, stop] of RECOVERY_STOPS[selection].entries()) {
      const state = evaluateRecovery(stop.phase, selection);
      expect(state.selection).toBe(selection); expect(state.caseIndex).toBe(selection);
      expect(state.stageIndex).toBe(index); expect(state.caption).toBe(stop.label);
      expect(state.replacesChoices).toBe(false); expect(stop).not.toHaveProperty('selection');
    }
    expect(recoveryCaseIndex(NaN)).toBe(0); expect(recoveryCaseIndex(-3)).toBe(0); expect(recoveryCaseIndex(7)).toBe(1);
    expect(evaluateRecovery(-2, 1)).toEqual(evaluateRecovery(0, 1));
    expect(evaluateRecovery(2, 0)).toEqual(evaluateRecovery(1, 0));
    expect(evaluateRecovery(NaN, 0)).toEqual(evaluateRecovery(0, 0));
  });

  it('continuously changes observation emphasis without moving, removing or rebuilding the fixed scene', () => {
    for (const selection of [0, 1]) {
      const first = evaluateRecovery(0, selection), final = evaluateRecovery(1, selection);
      expect(final.partIds).toEqual(first.partIds); expect(final.endpointRetained).toBe(true);
      for (const phase of [0, .1, .25, .5, .75, .9, 1]) {
        const state = evaluateRecovery(phase, selection);
        expect(state.emphasis.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        expect(state.emphasis.every(value => value >= 0 && value <= 1)).toBe(true);
        expect(state.staticSceneRetained).toBe(true); expect(state.rubbleRemoved).toBe(false); expect(state.cranePresent).toBe(false);
      }
      expect(evaluateRecovery(.5, selection).emphasis).toEqual([0, 1, 0]);
      for (const boundary of [.25, .5, .75]) {
        const a = evaluateRecovery(boundary - 1e-7, selection), b = evaluateRecovery(boundary + 1e-7, selection);
        a.focusPoint.forEach((n, i) => expect(Math.abs(n - b.focusPoint[i])).toBeLessThan(.0001));
        a.emphasis.forEach((n, i) => expect(Math.abs(n - b.emphasis[i])).toBeLessThan(.00001));
      }
    }
  });

  it('distinguishes conceptual support and daily-life links from operational routes or measured outcomes', () => {
    for (const selection of [0, 1]) for (const phase of [0, .3, .5, .8, 1]) {
      const state = evaluateRecovery(phase, selection);
      expect(state.linksAreRoutes).toBe(false); expect(state.operationalInstructions).toBe(false);
      expect(state.calibratedTime || state.casesConnectedByTime || state.recoveryEffectivenessMeasured).toBe(false);
      expect(state.phaseMeaning).toBe('independent-case-observation-order');
      expect(state.links.every(link => link.meaning === 'support-relationship' || link.meaning === 'life-service-relationship')).toBe(true);
    }
    expect(RECOVERY_REFERENCE.evacuationRoutesNotSpecified).toBe(true);
    expect(RECOVERY_REFERENCE.engineeringSafetyCertified).toBe(false);
    expect(RECOVERY_CASES[1].source.photographProvesSpecificRefugeDesignation).toBe(false);
    expect(evaluateRecovery(1, 1).text).toContain('不认定照片中某处的实际规划用途');
  });

  it('has exact reversible seeks and does not carry one case’s stage, source or link identity into the other', () => {
    for (const selection of [0, 1]) {
      const reference = evaluateRecovery(.64, selection);
      for (const [phase, other] of [[1, 1 - selection], [.2, selection], [.9, 1 - selection], [0, selection]]) evaluateRecovery(phase, other);
      expect(evaluateRecovery(.64, selection)).toEqual(reference);
    }
    expect(RECOVERY_PARTS[0].some(part => part.role === 'concrete-remnant')).toBe(true);
    expect(RECOVERY_PARTS[0].some(part => /housing|service-roof|crane/.test(part.role))).toBe(false);
    expect(RECOVERY_PARTS[1].some(part => part.role === 'housing-roofs')).toBe(true);
    expect(RECOVERY_PARTS[1].some(part => /concrete-remnant|searcher|responder|crane/.test(part.role))).toBe(false);
  });
});

describe('solid scene data and native SVG', () => {
  it('builds closed nondegenerate meshes for the stable ruins, people, shelter, supplies and separate town', () => {
    for (const parts of RECOVERY_PARTS) for (const part of parts) {
      expect(part.mesh.positions.every(Number.isFinite)).toBe(true); assertClosed(part.mesh);
    }
    expect(RECOVERY_PARTS[0].filter(part => /^searcher-|support-worker/.test(part.role))).toHaveLength(3);
    expect(RECOVERY_PARTS[0].some(part => part.role === 'medical-canopy')).toBe(true);
    expect(RECOVERY_PARTS[0].some(part => part.role === 'supply-crates')).toBe(true);
    expect(RECOVERY_PARTS[1].some(part => part.role === 'open-square')).toBe(true);
  });

  it('grows each unarrowed relationship ribbon continuously and keeps its topology closed and fixed', () => {
    for (const links of RECOVERY_LINKS) for (const link of links) {
      const complete = recoveryLinkMesh(link, 1), indices = complete.indices;
      for (const reveal of [.02, .2, .5, .9, 1]) {
        const data = recoveryLinkMesh(link, reveal); assertClosed(data);
        expect(data.indices).toEqual(indices); expect(data.positions).toHaveLength(complete.positions.length);
        expect(data.positions.every(Number.isFinite)).toBe(true);
      }
      let previous = 0;
      for (let i = 0; i <= 100; i++) {
        const state = evaluateRecovery(i / 100, links === RECOVERY_LINKS[0] ? 0 : 1);
        const reveal = state.links.find(item => item.id === link.id)!.reveal;
        expect(reveal).toBeGreaterThanOrEqual(previous); previous = reveal;
      }
      expect(previous).toBe(1);
    }
  });

  it('serializes the same case state in native SVG, retaining only current-case button selections', () => {
    for (const selection of [0, 1]) for (const phase of [0, .25, .5, .75, 1]) {
      const state = evaluateRecovery(phase, selection), svg = recoverySvg(phase, selection);
      expect(svg).not.toMatch(/<image|data:image|<animate|NaN|Infinity|undefined/);
      expect(JSON.parse(svg.match(/data-recovery-state='([^']+)'/)![1])).toEqual(recoveryDiagnostics(state));
      expect(svg.match(/data-recovery-node="[^"]+"/g)).toHaveLength(3);
      expect(svg.match(/role="button" tabindex="0"/g)).toHaveLength(3);
      expect([...svg.matchAll(/data-model-selection="(\d+)"/g)].map(match => Number(match[1]))).toEqual([selection, selection, selection]);
      expect(svg).toContain(`data-recovery-case="${state.caseId}"`); expect(svg).toContain('font-size="30"');
      expect(svg).toContain('两个独立案例'); expect(svg).toContain('不是灾后恢复时间');
      for (const part of RECOVERY_PARTS[selection]) expect(svg).toContain(`data-recovery-part="${part.id}"`);
      for (const part of RECOVERY_PARTS[1 - selection]) expect(svg).not.toContain(`data-recovery-part="${part.id}"`);
    }
  });

  it('keeps all projected scene geometry, caption and pull-tab positions inside the fixed SVG viewport', () => {
    for (const parts of RECOVERY_PARTS) for (const part of parts) for (let i = 0; i < part.mesh.positions.length; i += 3) {
      const [x, y] = recoveryProject(part.mesh.positions.slice(i, i + 3) as Vec3);
      expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(650); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(430);
    }
    const [lx, ly] = recoveryProject(RECOVERY_LAYOUT.label);
    expect(lx - 40 * 5.7 / 2).toBeGreaterThan(0); expect(lx + 40 * 5.7 / 2).toBeLessThan(650);
    expect(ly - 22).toBeGreaterThan(0);
    for (const endpoint of [RECOVERY_LAYOUT.track.start, RECOVERY_LAYOUT.track.end]) {
      const [x, y] = recoveryProject(endpoint); expect(x - 9).toBeGreaterThan(0); expect(x + 9).toBeLessThan(650); expect(y + 14).toBeLessThan(430);
    }
  });
});

describe('independent paper cases in the existing Three.js popout', () => {
  it('raises actual closed solid geometry and keeps exactly the selected scene visible', () => {
    const { root, meshes, motion } = fixture(); expect(root.position.y).toBeGreaterThan(0);
    for (const selection of [0, 1, 0]) for (const phase of [0, .5, 1]) {
      motion.update(phase, selection, .016, false); const d = motion.describe!() as any;
      const visible = meshes.filter(mesh => mesh.visible && mesh.userData.recoveryCase !== undefined);
      expect(visible.length).toBeGreaterThan(8); expect(visible.every(mesh => mesh.userData.recoveryCase === selection)).toBe(true);
      expect(d.source.figure).toBe(selection ? '6.17' : '6.16'); expect(d.state.selection).toBe(selection);
      expect(d.originalPagePreserved).toBe(true); expect(d.activeMeshCount).toBeLessThan(60);
      for (const mesh of visible.filter(mesh => mesh.userData.kind !== 'text-label')) expect((mesh.material as Three.MeshBasicMaterial).map).toBe(null);
    }
  });

  it('gives physical bodies only current-case selections and derives continuous phase from the same front track', () => {
    const { root, meshes, motion } = fixture(), handle = meshes.find(mesh => mesh.userData.recoveryRole === 'phase-handle')!;
    const track = handle.userData.modelInput.track; expect(handle.userData.modelInput.kind).toBe('phase-track');
    root.position.set(11, 9, -3); root.rotation.y = .17;
    for (const selection of [0, 1]) for (const phase of [0, .2, .5, .8, 1, .42]) {
      motion.update(phase, selection, .016, false); const d = motion.describe!() as any;
      for (const mesh of meshes.filter(mesh => mesh.visible && mesh.userData.modelInput?.kind === 'select')) expect(mesh.userData.modelInput.selection).toBe(selection);
      expect(phaseFromTrackPoint(handle.position.x, handle.position.y, track, 0)).toBeCloseTo(phase, 12);
      expect(d.handleWorld).toEqual(handle.getWorldPosition(new Three.Vector3()).toArray());
      const derived = d.phaseTrackWorld.start.map((n: number, i: number) => n + (d.phaseTrackWorld.end[i] - n) * phase);
      d.handleWorld.forEach((n: number, i: number) => expect(n).toBeCloseTo(derived[i], 10));
      expect(d.nodeWorld.every((node: any) => node.selection === selection)).toBe(true);
      expect(d.nodeWorld.map((node: any) => node.stageIndex)).toEqual([0, 1, 2]);
    }
  });

  it('reports real ray-pickable current-case solids, rather than distant proxies or stage-as-case inputs', () => {
    const { root, meshes, motion } = fixture();
    for (const selection of [0, 1]) {
      motion.update(.5, selection, 0, true); root.updateWorldMatrix(true, true);
      const role = selection === 0 ? 'supply-crates' : 'housing-walls';
      const mesh = meshes.find(mesh => mesh.userData.recoveryRole === role)!;
      const a = mesh.geometry.attributes.position, local = new Three.Vector3().fromBufferAttribute(a, 0);
      const b = new Three.Vector3().fromBufferAttribute(a, 1), c = new Three.Vector3().fromBufferAttribute(a, 2);
      // Use a point inside the first triangular face, then cast toward it.
      const face = mesh.geometry.index!.array, centroid = new Three.Vector3();
      for (const index of [face[0], face[1], face[2]]) centroid.add(new Three.Vector3().fromBufferAttribute(a, index));
      centroid.multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld);
      const normal = b.sub(local).cross(c.sub(local)).normalize().transformDirection(mesh.matrixWorld);
      const ray = new Three.Raycaster(centroid.clone().addScaledVector(normal, 100), normal.clone().negate());
      expect(ray.intersectObject(mesh).length).toBeGreaterThan(0);
      expect(mesh.userData.modelInput.selection).toBe(selection);
    }
  });

  it('keeps one envelope around every current-case mesh throughout case changes and forward/backward observation', () => {
    const { meshes, motion } = fixture(), bounds = motion.focusBounds!();
    const envelope = new Three.Box3(new Three.Vector3(...bounds.min), new Three.Vector3(...bounds.max));
    for (const selection of [0, 1, 0]) for (const phase of [0, .15, .5, .89, 1, .24]) {
      motion.update(phase, selection, .016, false); expect(motion.focusBounds!()).toEqual(bounds);
      for (const mesh of meshes.filter(mesh => mesh.visible)) {
        mesh.updateMatrix(); mesh.geometry.computeBoundingBox();
        expect(envelope.containsBox(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix)), mesh.userData.recoveryRole).toBe(true);
      }
    }
  });

  it('restores exact solid geometry, colours and diagnostics while reusing every buffer across both cases', () => {
    const { meshes, motion } = fixture();
    const buffers = meshes.map(mesh => [mesh.geometry.uuid, mesh.geometry.attributes.position.array, mesh.geometry.index?.array]);
    const signature = () => meshes.map(mesh => ({ position: mesh.position.toArray(), visible: mesh.visible,
      color: (mesh.material as Three.MeshBasicMaterial).color.toArray(), vertices: [...mesh.geometry.attributes.position.array] }));
    motion.update(.68, 0, .016, false); const expected = signature(), expectedState = motion.describe!();
    for (const [phase, selection] of [[1, 0], [.9, 1], [.1, 0], [0, 1], [1, 1], [.68, 0]]) motion.update(phase, selection, .5, true);
    expect(signature()).toEqual(expected); expect(motion.describe!()).toEqual(expectedState);
    meshes.forEach((mesh, i) => {
      expect(mesh.geometry.uuid).toBe(buffers[i][0]); expect(mesh.geometry.attributes.position.array).toBe(buffers[i][1]);
      expect(mesh.geometry.index?.array).toBe(buffers[i][2]);
    });
    expect(motion.describe!().geometryBuffersReused).toBe(true);
  });
});
