import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import { COLD_WAVE_LABELS, COLD_WAVE_LAYOUT as L, COLD_WAVE_PARTS, COLD_WAVE_PLANTS,
  COLD_WAVE_REFERENCE, COLD_WAVE_STOPS, coldAirDepthAt, coldWaveLocalResponse, coldWaveProject,
  coldWaveSvg, evaluateColdWave, type ColdWaveMesh, type ColdWavePoint } from '../src/textbook-cold-wave-model';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildColdWaveWorld } from '../src/textbook-cold-wave-world';

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
    stroke() {}, contour(points: Vec3[]) { contours.push(points); }, outline() {},
    v(point: Vec3) { return new Three.Vector3(...point); },
  };
  const motion = buildColdWaveWorld(b as unknown as TextbookGeometry);
  return { b, root, meshes, contours, motion };
}
function volume(data: ColdWaveMesh) {
  let result = 0;
  for (let i = 0; i < data.indices.length; i += 3) {
    const [a, b, c] = data.indices.slice(i, i + 3).map(index => new Three.Vector3(...data.positions.slice(index * 3, index * 3 + 3)));
    result += a.dot(b.clone().cross(c)) / 6;
  }
  return result;
}
function expectIndexedShell(data: ColdWaveMesh) {
  const edges = new Map<string, { count: number; balance: number }>();
  for (let i = 0; i < data.indices.length; i += 3) {
    const face = data.indices.slice(i, i + 3);
    for (let j = 0; j < 3; j++) {
      const a = face[j], b = face[(j + 1) % 3], key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      const edge = edges.get(key) ?? { count: 0, balance: 0 };
      edge.count++; edge.balance += a < b ? 1 : -1; edges.set(key, edge);
    }
  }
  for (const edge of edges.values()) { expect(edge.count).toBe(2); expect(edge.balance).toBe(0); }
  expect(Math.abs(volume(data))).toBeGreaterThan(.0001);
}
const phases = [0, .12, .35, .479, .48, .62, .8, 1];

describe('textbook p.104: a front reaches the same fixed observation point', () => {
  it('exposes four bookmarks in one continuous process and retains the final result', () => {
    expect(COLD_WAVE_STOPS.map(stop => stop.phase)).toEqual([0, .35, .62, 1]);
    COLD_WAVE_STOPS.forEach((stop, index) => {
      const state = evaluateColdWave(stop.phase);
      expect(state.selection).toBe(index); expect(state.stageIndex).toBe(index); expect(state.caption).toBe(stop.label);
      expect(state.kind).toBe('cold-wave'); expect(state.text.length).toBeLessThan(40);
    });
    expect(evaluateColdWave(0).observation.arrived).toBe(false);
    expect(evaluateColdWave(1).endpointRetained).toBe(true); expect(evaluateColdWave(1).cyclic).toBe(false);
    expect(evaluateColdWave(1).observation.coldFraction).toBe(1);
    expect(evaluateColdWave(-2)).toEqual(evaluateColdWave(0));
    expect(evaluateColdWave(3)).toEqual(evaluateColdWave(1)); expect(evaluateColdWave(NaN)).toEqual(evaluateColdWave(0));
  });

  it('never cools or extends the station flag before the real wedge nose crosses it', () => {
    const initial = evaluateColdWave(0), arrival = initial.arrivalPhase;
    for (const phase of [0, .2, .35, arrival - 1e-8, arrival]) {
      const state = evaluateColdWave(phase);
      expect(state.frontX).toBeLessThanOrEqual(L.observation[0]);
      expect(state.observation.arrived).toBe(false); expect(state.observation.coldFraction).toBe(0);
      expect(state.observation.wind).toBe(0); expect(state.observation.fillTop).toBe(initial.observation.fillTop);
      expect(state.flag.extension).toBe(initial.flag.extension); expect(state.flag.droop).toBe(initial.flag.droop);
      expect(state.geometry.flag).toEqual(initial.geometry.flag);
    }
    const after = evaluateColdWave(arrival + .01);
    expect(after.observation.arrived).toBe(true); expect(after.observation.wind).toBeGreaterThan(0);
    expect(after.observation.fillTop).toBeLessThan(initial.observation.fillTop);
    expect(after.flag.extension).toBeGreaterThan(initial.flag.extension);
  });

  it('links monotonically falling relative warmth, growing flag extension and local plant bending', () => {
    let previous = evaluateColdWave(0);
    for (let i = 1; i <= 100; i++) {
      const state = evaluateColdWave(i / 100);
      expect(state.frontX).toBeGreaterThan(previous.frontX);
      expect(state.observation.fillTop).toBeLessThanOrEqual(previous.observation.fillTop);
      expect(state.flag.extension).toBeGreaterThanOrEqual(previous.flag.extension);
      expect(state.flag.droop).toBeLessThanOrEqual(previous.flag.droop);
      state.plants.forEach((plant, index) => {
        expect(plant.base).toEqual(COLD_WAVE_PLANTS[index].base); expect(plant.healthy).toBe(true);
        expect(plant.lean).toBeGreaterThanOrEqual(previous.plants[index].lean);
        expect(plant.wind).toBe(coldWaveLocalResponse(plant.base[0], state.frontX).wind);
        if (state.frontX <= plant.base[0]) { expect(plant.lean).toBe(0); expect(plant.arrived).toBe(false); }
        else expect(plant.lean).toBeGreaterThan(0);
      });
      previous = state;
    }
    const frontBetweenPlants = evaluateColdWave((55 - L.frontStart) / (L.frontEnd - L.frontStart));
    expect(frontBetweenPlants.plants.map(plant => plant.arrived)).toEqual([true, true, false, false, false]);
    expect(frontBetweenPlants.observation.arrived).toBe(false);
  });

  it('keeps station, house and terrain fixed and reverses deterministically without elapsed time', () => {
    const reference = evaluateColdWave(.64);
    for (const phase of [1, .2, .9, 0, .64]) evaluateColdWave(phase);
    expect(evaluateColdWave(.64)).toEqual(reference);
    for (const phase of phases) {
      const state = evaluateColdWave(phase);
      expect(state.observation.point).toEqual(L.observation); expect(state.flag.anchor).toEqual(L.flagAnchor);
      expect(state.observation.point[2]).toBeGreaterThan(L.farZ); expect(state.observation.point[2]).toBeLessThan(L.nearZ);
      expect(state.observation.coldDepth).toBe(coldAirDepthAt(L.observation[0], state.frontX));
    }
  });

  it('states the teaching boundaries without inventing readings, frost, damage or geographic direction', () => {
    expect(COLD_WAVE_REFERENCE.textbookPages).toEqual([104]); expect(COLD_WAVE_REFERENCE.pdfPages).toEqual([109]);
    expect(COLD_WAVE_REFERENCE.source).toBe('textbook/page-109.webp'); expect(COLD_WAVE_REFERENCE.figures).toEqual(['6.7', '6.8']);
    expect(COLD_WAVE_REFERENCE.airVolumeIsTeachingCutaway).toBe(true); expect(COLD_WAVE_REFERENCE.temperatureIsQualitative).toBe(true);
    for (const key of ['measuredTemperature', 'measuredWindSpeed', 'measuredTime', 'realGeographicDirection', 'forecast',
      'frostGuaranteed', 'cropDamageGuaranteed', 'snowGuaranteed', 'reproducesPhotographedDisaster'] as const) expect(COLD_WAVE_REFERENCE[key]).toBe(false);
    for (const phase of phases) {
      const state = evaluateColdWave(phase);
      expect(state.units).toBe('qualitative-teaching-model'); expect(state.definedByActualCoolingThreshold).toBe(false);
      expect(state.text).not.toMatch(/\d+\s*(℃|°C|m\/s|米\/秒)|正北|西北|必然冻/);
      expect(state.plants.every(plant => plant.healthy)).toBe(true);
    }
  });
});

describe('shared wedge, cloth, landscape and native vector geometry', () => {
  it('has an actual closed shallow air volume with a sloping zero-height nose', () => {
    for (const phase of phases) {
      const state = evaluateColdWave(phase), data = state.geometry.wedge;
      expectIndexedShell(data); expect(data.positions.every(Number.isFinite)).toBe(true);
      const xs = data.positions.filter((_, i) => i % 3 === 0), zs = data.positions.filter((_, i) => i % 3 === 2);
      expect(Math.max(...xs)).toBeCloseTo(state.frontX, 12); expect(Math.min(...xs)).toBe(L.sourceX);
      expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(40);
      expect(coldAirDepthAt(state.frontX, state.frontX)).toBe(0);
      expect(coldAirDepthAt(state.frontX - 11.5, state.frontX)).toBeCloseTo(L.wedgeHeight / 2, 12);
      expect(state.geometry.wedge.indices).toEqual(evaluateColdWave(0).geometry.wedge.indices);
      expectIndexedShell(state.geometry.flag); expectIndexedShell(state.geometry.gaugeFill);
      state.geometry.flows.forEach(expectIndexedShell);
    }
    for (const part of COLD_WAVE_PARTS) expectIndexedShell(part.mesh);
  });

  it('preserves every fixed and dynamic vertex count across forward and reverse inputs', () => {
    const initial = evaluateColdWave(0), shape = (state: ReturnType<typeof evaluateColdWave>) =>
      [state.geometry.wedge, state.geometry.flag, state.geometry.gaugeFill, ...state.geometry.flows, ...state.plants.map(plant => plant.mesh)]
        .map(mesh => ({ vertices: mesh.positions.length, indices: mesh.indices }));
    for (const phase of [...phases, ...[...phases].reverse()]) expect(shape(evaluateColdWave(phase))).toEqual(shape(initial));
  });

  it('renders the identical phase as native vector faces and ignores stale selection inputs', () => {
    for (const phase of phases) {
      const svg = coldWaveSvg(phase), state = evaluateColdWave(phase);
      expect(svg).toBe(coldWaveSvg(phase, 100));
      expect(svg).not.toMatch(/<image|<foreignObject|data:image|<canvas|<animate|NaN|Infinity|undefined/);
      expect(svg).toContain(`data-stage="${state.stage}"`); expect(svg).toContain(`data-selection="${state.selection}"`);
      expect(svg).toContain(`data-phase="${phase}"`); expect(svg).toContain('data-cold-wave-part="front-pull-tab"');
      for (const role of ['land-base', 'cold-air-wedge', 'wind-flag', 'relative-warmth', 'plant-0']) {
        const content = svg.match(new RegExp(`<g data-cold-wave-part="${role}"[^>]*>(.*?)</g>`))![1];
        expect(content).toContain('<polygon');
      }
      expect(svg.match(/tabindex="0"/g)!.length).toBeGreaterThan(10);
    }
    expect(coldWaveSvg(0)).not.toBe(coldWaveSvg(1));
  });

  it('projects every scene vertex, paper label and movable front tab inside a stable viewport', () => {
    for (const phase of phases) {
      const state = evaluateColdWave(phase), parts = [...COLD_WAVE_PARTS.map(part => part.mesh), state.geometry.wedge,
        state.geometry.flag, state.geometry.gaugeFill, ...state.geometry.flows, ...state.plants.map(plant => plant.mesh)];
      for (const part of parts) for (let i = 0; i < part.positions.length; i += 3) {
        const [x, y] = coldWaveProject(part.positions.slice(i, i + 3) as unknown as ColdWavePoint);
        expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(640); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(400);
      }
      const [x, y] = coldWaveProject(state.handle); expect(x - 28).toBeGreaterThan(0); expect(x + 28).toBeLessThan(640);
      expect(y - 11).toBeGreaterThan(0); expect(y + 14).toBeLessThan(400);
    }
    for (const label of COLD_WAVE_LABELS) {
      const [x, y] = coldWaveProject(label.at);
      expect(x - label.width * 4.1 / 2).toBeGreaterThan(0); expect(x + label.width * 4.1 / 2).toBeLessThan(640);
      expect(y - 14).toBeGreaterThan(0); expect(y + 13).toBeLessThan(400);
    }
  });
});

describe('raised cold-wave scene and direct manipulation', () => {
  it('puts actual volume above the original page and assigns real body selections', () => {
    const { root, meshes, motion } = fixture(); expect(root.position.y).toBeGreaterThan(0);
    const d = motion.describe!() as any;
    expect(d.kind).toBe('cold-wave'); expect(d.originalPagePreserved).toBe(true); expect(d.commonCoordinateField).toBe(true);
    expect(d.fixedLandscape).toBe(true); expect(meshes.length).toBeLessThan(30);
    for (const mesh of meshes.filter(mesh => mesh.userData.kind !== 'text-label')) expect((mesh.material as Three.MeshBasicMaterial).map).toBeNull();
    for (const [role, selection] of [['house', 0], ['cold-air-wedge', 1], ['wind-flag', 2], ['relative-warmth', 3]] as const) {
      const mesh = meshes.find(mesh => mesh.userData.coldWaveRole === role)!;
      expect(mesh.userData.modelInput).toMatchObject({ kind: 'select', selection });
    }
  });

  it('ray-picks the actual advancing air, fixed house, responding cloth, plants and gauge', () => {
    const { root, meshes, motion } = fixture(); root.rotation.y = .17; root.position.set(11, 9, -3);
    for (const phase of [0, .35, .62, 1, .4]) {
      motion.update(phase, 100, .016, false); root.updateWorldMatrix(true, true);
      for (const role of ['cold-air-wedge', 'house', 'wind-flag', 'plant-0', 'relative-warmth']) {
        const mesh = meshes.find(mesh => mesh.userData.coldWaveRole === role)!, a = mesh.geometry.attributes.position;
        const indices = mesh.geometry.index!.array;
        let centroid = new Three.Vector3(), normal = new Three.Vector3();
        for (let i = 0; i < indices.length; i += 3) {
          const [u, v, w] = [indices[i], indices[i + 1], indices[i + 2]].map(index => new Three.Vector3().fromBufferAttribute(a, index));
          normal = v.clone().sub(u).cross(w.clone().sub(u));
          if (normal.lengthSq() > 1e-6) { centroid = u.add(v).add(w).multiplyScalar(1 / 3); break; }
        }
        centroid.applyMatrix4(mesh.matrixWorld); normal.normalize().transformDirection(mesh.matrixWorld);
        const ray = new Three.Raycaster(centroid.clone().addScaledVector(normal, 100), normal.clone().negate());
        expect(ray.intersectObject(mesh).length, role).toBeGreaterThan(0);
      }
    }
  });

  it('maps the real front pull tab to the exact same phase even after root rotation and translation', () => {
    const { root, meshes, motion } = fixture(), handle = meshes.find(mesh => mesh.userData.coldWaveRole === 'front-pull-tab')!;
    const track = handle.userData.modelInput.track;
    expect(handle.userData.modelInput.kind).toBe('phase-track'); expect(track.start[2]).toBe(track.end[2]);
    root.position.set(11, 9, -3); root.rotation.y = .2;
    for (const phase of [...phases, .42]) {
      motion.update(phase, 3, .016, false); const d = motion.describe!() as any;
      expect(phaseFromTrackPoint(handle.position.x, handle.position.y, track, 0)).toBeCloseTo(phase, 12);
      expect(d.handleWorld).toEqual(handle.getWorldPosition(new Three.Vector3()).toArray());
      const interpolation = d.phaseTrackWorld.start.map((n: number, i: number) => n + (d.phaseTrackWorld.end[i] - n) * phase);
      d.handleWorld.forEach((n: number, i: number) => expect(n).toBeCloseTo(interpolation[i], 10));
      expect(d.phase).toBe(phase); expect(d.selection).toBe(evaluateColdWave(phase).selection);
    }
  });

  it('uses one fixed camera envelope that contains all solids and paper signs at every phase', () => {
    const { meshes, motion } = fixture(), bounds = motion.focusBounds!();
    const box = new Three.Box3(new Three.Vector3(...bounds.min), new Three.Vector3(...bounds.max));
    for (const phase of [...phases, ...[...phases].reverse()]) {
      motion.update(phase, 0, .016, false); expect(motion.focusBounds!()).toEqual(bounds);
      for (const mesh of meshes) {
        mesh.updateMatrix(); mesh.geometry.computeBoundingBox();
        expect(box.containsBox(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrix)), mesh.userData.coldWaveRole).toBe(true);
      }
    }
  });

  it('restores exact geometry and colour on reverse seek without new GPU arrays or stale bounds', () => {
    const { meshes, motion } = fixture(), buffers = meshes.map(mesh => ({ uuid: mesh.geometry.uuid,
      position: mesh.geometry.attributes.position.array, normal: mesh.geometry.attributes.normal?.array, index: mesh.geometry.index?.array }));
    const signature = () => meshes.map(mesh => ({ position: mesh.position.toArray(), visible: mesh.visible,
      color: (mesh.material as Three.MeshBasicMaterial).color.toArray(), vertices: [...mesh.geometry.attributes.position.array] }));
    motion.update(.64, 0, .016, false); const expected = signature(), expectedDiagnostics = motion.describe!();
    const house = meshes.find(mesh => mesh.userData.coldWaveRole === 'house')!, houseGeometry = [...house.geometry.attributes.position.array];
    for (const phase of [1, .2, .9, 0, 1, .64]) motion.update(phase, 100, .5, true);
    expect(signature()).toEqual(expected); expect(motion.describe!()).toEqual(expectedDiagnostics);
    expect([...house.geometry.attributes.position.array]).toEqual(houseGeometry);
    expect(motion.describe!().geometryBuffersReused).toBe(true);
    meshes.forEach((mesh, i) => {
      expect(mesh.geometry.uuid).toBe(buffers[i].uuid); expect(mesh.geometry.attributes.position.array).toBe(buffers[i].position);
      expect(mesh.geometry.attributes.normal?.array).toBe(buffers[i].normal); expect(mesh.geometry.index?.array).toBe(buffers[i].index);
      const box = new Three.Box3().setFromBufferAttribute(mesh.geometry.attributes.position as Three.BufferAttribute);
      expect(mesh.geometry.boundingBox!.equals(box)).toBe(true);
      if ((mesh.geometry.attributes.position as Three.BufferAttribute).usage === Three.DynamicDrawUsage)
        expect(mesh.geometry.boundingSphere!.containsPoint(box.getCenter(new Three.Vector3()))).toBe(true);
    });
  });

  it('keeps the translucent air readable after the Popout surface pass resets depth writing', () => {
    const { meshes, motion } = fixture(), wedge = meshes.find(mesh => mesh.userData.coldWaveRole === 'cold-air-wedge')!;
    const material = wedge.material as Three.MeshBasicMaterial;
    expect(material.transparent).toBe(true); expect(material.opacity).toBeGreaterThan(0); expect(material.opacity).toBeLessThan(.4);
    material.depthWrite = true; motion.update(0, 0, .016, false); expect(material.depthWrite).toBe(false);
    material.depthWrite = true; motion.update(.62, 3, .016, false); expect(material.depthWrite).toBe(false);
  });
});
