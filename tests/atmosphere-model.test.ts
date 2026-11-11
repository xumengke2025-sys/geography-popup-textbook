import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import { ATMOSPHERE_BOUNDARIES, ATMOSPHERE_LAYERS, ATMOSPHERE_PROFILE, ATMOSPHERE_REFERENCE,
  ATMOSPHERE_STOPS, atmosphereDiagnostics, atmosphereProfilePoint, atmosphereRelativeTemperature,
  atmosphereSvg, evaluateAtmosphere } from '../src/textbook-atmosphere-model';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildAtmosphereWorld } from '../src/textbook-atmosphere-world';

function fixture(width = 150) {
  const root = new Three.Group(), meshes: Three.Mesh[] = [], contours: Vec3[][] = [];
  const b = {
    width, height: 220, root,
    pop: { paper: vi.fn(({ color }: { color: string }) => new Three.MeshBasicMaterial({ color })) },
    materialFor(_role:string,color:string){return new Three.MeshBasicMaterial({color})},
    mesh(g: Three.BufferGeometry, color: string,_edges=true,_volume=true,materialRole?:string) {
      const mesh = new Three.Mesh(g, new Three.MeshBasicMaterial({ color }));mesh.userData.materialRole=materialRole;
      root.add(mesh); meshes.push(mesh); return mesh;
    },
    box(a: Vec3, c: Vec3, color: string) {
      const g = new Three.BoxGeometry(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
      g.translate((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2); return this.mesh(g, color);
    },
    label(text: string, at: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height), '#f7f1e3'); mesh.position.set(...at);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    contour(path: Vec3[]) { contours.push(path); }, outline() {},
  };
  const motion = buildAtmosphereWorld(b as unknown as TextbookGeometry);
  return { b, meshes, contours, motion };
}

function assertClosedVolume(g: Three.BufferGeometry) {
  const a = g.attributes.position, index = g.index!, edges = new Map<string, { count: number; balance: number }>();
  let volume = 0;
  const key = (i: number) => [a.getX(i), a.getY(i), a.getZ(i)].map(n => n.toFixed(5)).join(',');
  for (let i = 0; i < index.count; i += 3) {
    const face = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const [p, q, r] = face.map(n => new Three.Vector3().fromBufferAttribute(a, n));
    expect(q.clone().sub(p).cross(r.clone().sub(p)).length()).toBeGreaterThan(1e-9);
    volume += p.dot(q.clone().cross(r)) / 6;
    for (let j = 0; j < 3; j++) {
      const u = key(face[j]), v = key(face[(j + 1) % 3]), ordered = [u, v].sort(), k = ordered.join('|');
      const e = edges.get(k) ?? { count: 0, balance: 0 }; e.count++; e.balance += u === ordered[0] ? 1 : -1; edges.set(k, e);
    }
  }
  for (const edge of edges.values()) { expect(edge.count).toBe(2); expect(edge.balance).toBe(0); }
  expect(Math.abs(volume)).toBeGreaterThan(.0001);
}

describe('textbook p.31–32: a continuous vertical atmosphere observation', () => {
  it('uses one unambiguous layer at each boundary, preserving order and both endpoint heights', () => {
    expect(ATMOSPHERE_BOUNDARIES).toEqual([0, .24, .56, 1]);
    expect(evaluateAtmosphere(0).selectedLayer).toBe('troposphere');
    expect(evaluateAtmosphere(.24 - Number.EPSILON).selectedLayer).toBe('troposphere');
    expect(evaluateAtmosphere(.24).selectedLayer).toBe('stratosphere');
    expect(evaluateAtmosphere(.56 - Number.EPSILON).selectedLayer).toBe('stratosphere');
    expect(evaluateAtmosphere(.56).selectedLayer).toBe('upper-atmosphere');
    expect(evaluateAtmosphere(1).selectedLayer).toBe('upper-atmosphere');
    expect(evaluateAtmosphere(0).handle[1]).toBeLessThan(evaluateAtmosphere(1).handle[1]);
    expect(evaluateAtmosphere(-10)).toEqual(evaluateAtmosphere(0));
    expect(evaluateAtmosphere(20)).toEqual(evaluateAtmosphere(1));
    expect(evaluateAtmosphere(NaN)).toEqual(evaluateAtmosphere(0));
  });

  it('keeps bookmarks inside the corresponding height band instead of defining three alternate scenes', () => {
    for (const stop of ATMOSPHERE_STOPS) {
      const state = evaluateAtmosphere(stop.phase);
      expect(state.selection).toBe(stop.selection); expect(state.stageIndex).toBe(stop.selection);
      expect(state.layerLabel).toBe(stop.label);
      expect(state.phase).toBeGreaterThan(state.layerBounds.bottom);
      expect(state.phase).toBeLessThan(state.layerBounds.top);
    }
  });

  it('shows overall tropospheric cooling and little lower-stratospheric change followed by warming', () => {
    expect(atmosphereRelativeTemperature(0)).toBeGreaterThan(atmosphereRelativeTemperature(.12));
    expect(atmosphereRelativeTemperature(.12)).toBeGreaterThan(atmosphereRelativeTemperature(.24));
    expect(evaluateAtmosphere(.12).localTemperatureTendency).toBe('decreasing');
    expect(atmosphereRelativeTemperature(.24)).toBe(atmosphereRelativeTemperature(.28));
    expect(evaluateAtmosphere(.27).localTemperatureTendency).toBe('little-change');
    expect(atmosphereRelativeTemperature(.34)).toBeLessThan(atmosphereRelativeTemperature(.5));
    expect(evaluateAtmosphere(.42).localTemperatureTendency).toBe('increasing');
  });

  it('does not turn the upper atmosphere into a monotonic temperature-rise graph', () => {
    expect(atmosphereRelativeTemperature(.56)).toBeGreaterThan(atmosphereRelativeTemperature(.7));
    expect(atmosphereRelativeTemperature(.7)).toBeGreaterThan(atmosphereRelativeTemperature(.76));
    expect(atmosphereRelativeTemperature(.76)).toBeLessThan(atmosphereRelativeTemperature(.9));
    expect(atmosphereRelativeTemperature(.9)).toBeLessThan(atmosphereRelativeTemperature(1));
    expect(evaluateAtmosphere(.64).localTemperatureTendency).toBe('decreasing');
    expect(evaluateAtmosphere(.88).localTemperatureTendency).toBe('increasing');
    expect(evaluateAtmosphere(.64).temperatureTrend).toBe('complex');
    expect(evaluateAtmosphere(.88).temperatureTrend).toBe('complex');
  });

  it('keeps temperature and probe continuous at boundaries and reverses without hysteresis', () => {
    for (const boundary of [.24, .30, .56, .76]) {
      expect(Math.abs(atmosphereRelativeTemperature(boundary - 1e-7) - atmosphereRelativeTemperature(boundary + 1e-7))).toBeLessThan(1e-5);
    }
    const reference = evaluateAtmosphere(.43);
    evaluateAtmosphere(.93); evaluateAtmosphere(.02);
    expect(evaluateAtmosphere(.43)).toEqual(reference);
    for (let i = 0; i <= 100; i++) {
      const state = evaluateAtmosphere(i / 100);
      expect(state.profilePoint).toEqual(ATMOSPHERE_PROFILE[i]);
      expect(state.probe[1]).toBe(state.handle[1]);
      expect(state.normalizedHeight).toBe(state.phase);
      expect(Object.values(state.probe).every(Number.isFinite)).toBe(true);
    }
  });

  it('states dominant motions and qualitative limits without inventing weather or calibrated readings', () => {
    expect(evaluateAtmosphere(.1).motion).toBe('vertical-dominant');
    expect(evaluateAtmosphere(.4).motion).toBe('horizontal-dominant');
    expect(evaluateAtmosphere(.8).motion).toBe('not-modelled');
    expect(evaluateAtmosphere(.4).evidence).toContain('不等于完全没有垂直运动');
    expect(ATMOSPHERE_REFERENCE.calibratedHeight).toBe(false);
    expect(ATMOSPHERE_REFERENCE.calibratedTemperature).toBe(false);
    expect(ATMOSPHERE_REFERENCE.layerBoundariesVaryWithLatitudeAndConditions).toBe(true);
    expect(ATMOSPHERE_REFERENCE.upperBoundaryIsTeachingWindow).toBe(true);
    expect(ATMOSPHERE_REFERENCE.weatherPrediction).toBe(false);
    expect(evaluateAtmosphere(.2).units).toBe('schematic-height');
  });

  it('uses native SVG with the same complete scientific state and exactly aligned curve probe', () => {
    for (const phase of [0, .12, .24, .42, .56, .76, .82, 1]) {
      const svg = atmosphereSvg(phase), state = evaluateAtmosphere(phase);
      expect(svg).not.toMatch(/<image|data:image|°C|℃|千米|km|12\/50/);
      expect(svg).toContain(`data-atmosphere-phase="${phase}"`);
      const serialized = svg.match(/data-atmosphere-state='([^']+)'/)![1];
      expect(JSON.parse(serialized)).toEqual(atmosphereDiagnostics(state));
      expect(svg.match(/data-atmosphere-layer="(?:troposphere|stratosphere|upper-atmosphere)"/g)).toHaveLength(4);
      expect(svg).toContain('高度和温度未按实际数值标定');
      const dot = svg.match(/data-atmosphere-probe="temperature" cx="([^"]+)" cy="([^"]+)"/)!.slice(1).map(Number);
      expect(dot[0]).toBeCloseTo(22 + state.probe[0] * 5.6, 3);
      expect(dot[1]).toBeCloseTo(494 - state.probe[1] * 4.3, 3);
    }
    expect(atmosphereSvg(.12)).not.toBe(atmosphereSvg(.82));
  });
});

describe('guided atmospheric comparator and direct vertical probe', () => {
  it('uses physical instrument roles and an open comparison bay without replacing materials with paper',()=>{
    const {b,meshes,motion}=fixture();motion.update(.42,1,0,false);
    expect(b.pop.paper).not.toHaveBeenCalled();
    const materialRoles=new Set(meshes.map(m=>m.userData.materialRole));
    for(const role of ['brass','steel','ivory','air','rock'])expect(materialRoles.has(role)).toBe(true);
    for(const sheet of meshes.filter(m=>m.userData.atmosphereRole==='layer-sheet')){
      sheet.geometry.computeBoundingBox();expect(sheet.geometry.boundingBox!.getSize(new Three.Vector3()).x/b.width).toBeLessThan(.25);
    }
    expect((motion.describe!() as any).instrument).toMatchObject({guideRods:2,linkedCarriage:true,
      openObservationWindow:true,paperMaterialOverride:false,scaleUnits:'none',
      construction:'single-bed-guided-comparator',supportedCurveEnds:2,mountedLayerTablets:3});
  });
  it('has thin closed layer sheets, a closed temperature ribbon and closed relief, rather than image planes', () => {
    const { meshes } = fixture();
    const sheets = meshes.filter(m => m.userData.atmosphereRole === 'layer-sheet');
    expect(sheets).toHaveLength(3);
    expect(sheets.map(m => m.userData.atmosphereLayer)).toEqual(ATMOSPHERE_LAYERS.map(l => l.id));
    for (const sheet of sheets) {
      sheet.geometry.computeBoundingBox(); const size = sheet.geometry.boundingBox!.getSize(new Three.Vector3());
      expect(size.z).toBeGreaterThan(0); expect(size.z / size.x).toBeLessThan(.03);
      assertClosedVolume(sheet.geometry);
    }
    for (const role of ['temperature-profile', 'ground-relief', 'upper-association'])
      assertClosedVolume(meshes.find(m => m.userData.atmosphereRole === role)!.geometry);
    for (const mesh of meshes.filter(m => m.userData.kind !== 'text-label'))
      expect((mesh.material as Three.MeshBasicMaterial).map).toBe(null);
  });

  it('exposes actual ray-pickable height bookmarks on sheets, direction solids and labels', () => {
    const { meshes } = fixture();
    for (const role of ['layer-sheet', 'layer-label']) {
      const objects = meshes.filter(m => m.userData.atmosphereRole === role);
      expect(objects.map(m => m.userData.modelInput.selection)).toEqual([0, 1, 2]);
      expect(objects.every(m => m.userData.modelInput.kind === 'select')).toBe(true);
    }
    // Mounted lettering must retain the tablet's plane. Billboarding these
    // glyphs makes half of each word intersect its real supporting surface.
    for(const label of meshes.filter(m=>m.userData.kind==='text-label'))
      expect(label.userData.labelMount).toBe('surface');
    const arrows = meshes.filter(m => m.userData.atmosphereRole === 'dominant-motion');
    expect(arrows.map(m => m.userData.modelInput.selection)).toEqual([0, 0, 1, 1]);
    expect(new Set(arrows.map(m => m.userData.atmosphereMotion))).toEqual(new Set(['vertical-dominant', 'horizontal-dominant']));
  });

  it('shares a vertical track between handle, needle and probe, and derives the same height from native pointer coordinates', () => {
    const { meshes, motion } = fixture();
    const handle = meshes.find(m => m.userData.atmosphereRole === 'height-handle')!;
    const probe = meshes.find(m => m.userData.atmosphereRole === 'temperature-probe')!;
    const needle = meshes.find(m => m.userData.atmosphereRole === 'height-probe')!;
    const input = handle.userData.modelInput, track = input.track;
    expect(input.kind).toBe('phase-track'); expect(track.start[0]).toBe(track.end[0]);
    expect(track.end[1]).toBeGreaterThan(track.start[1]); expect(track.start[2]).toBe(track.end[2]);
    expect(probe.userData.modelInput).toBe(input); expect(needle.userData.modelInput).toBe(input);
    for (const phase of [0, .12, .24, .42, .56, .76, .82, 1]) {
      motion.update(phase, 2, .016, false); const d = motion.describe!() as any;
      expect(phaseFromTrackPoint(handle.position.x, handle.position.y, track, 0)).toBeCloseTo(phase, 12);
      expect(handle.position.y).toBe(probe.position.y);
      expect(needle.position.y).toBe(probe.position.y);
      expect(d.probeWorld).toEqual(d.profilePointWorld);
      expect(d.selection).toBe(evaluateAtmosphere(phase).selection);
      expect(d.kind).toBe('atmosphere-height-observation');
      expect(d.handleWorld).toEqual(handle.getWorldPosition(new Three.Vector3()).toArray());
    }
  });

  it('keeps fixed camera bounds around every rendered mesh throughout the complete probe journey', () => {
    const { meshes, motion } = fixture(), bounds = motion.focusBounds!();
    const box = new Three.Box3(new Three.Vector3(...bounds.min), new Three.Vector3(...bounds.max));
    for (const phase of [0, .12, .24, .42, .56, .76, .82, 1]) {
      motion.update(phase, 0, 1 / 30, false);
      expect(motion.focusBounds!()).toEqual(bounds);
      for (const mesh of meshes) {
        mesh.updateWorldMatrix(true,false); mesh.geometry.computeBoundingBox();
        const actual = mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
        expect(box.containsBox(actual), mesh.userData.atmosphereRole??mesh.name).toBe(true);
      }
    }
  });

  it('reuses GPU buffers and restores exact geometry, placement and layer colours after backward seeking', () => {
    const { meshes, motion } = fixture();
    const buffers = meshes.map(m => [m.uuid, m.geometry.uuid, m.geometry.attributes.position.array, m.geometry.index?.array]);
    const signature = () => meshes.map(m => ({ position: m.position.toArray(), scale: m.scale.toArray(), visible: m.visible,
      color: (m.material as Three.MeshBasicMaterial).color.toArray(), vertices: [...m.geometry.attributes.position.array] }));
    motion.update(.43, 0, 1 / 60, false); const reference = signature(), scientific = motion.describe!();
    for (const phase of [.97, .1, .76, 0, 1, .43]) motion.update(phase, 2, .1, true);
    expect(signature()).toEqual(reference); expect(motion.describe!()).toEqual(scientific);
    meshes.forEach((m, i) => {
      expect(m.uuid).toBe(buffers[i][0]); expect(m.geometry.uuid).toBe(buffers[i][1]);
      expect(m.geometry.attributes.position.array).toBe(buffers[i][2]); expect(m.geometry.index?.array).toBe(buffers[i][3]);
    });
  });

  it('reads the actual temperature-profile centreline from fixed solid vertices and translates world diagnostics correctly', () => {
    const { b, meshes, motion } = fixture();
    const profile = meshes.find(m => m.userData.atmosphereRole === 'temperature-profile')!, a = profile.geometry.attributes.position;
    const scale = b.width / 100;
    ATMOSPHERE_PROFILE.forEach((point, i) => {
      const average = new Three.Vector3();
      for (let j = 0; j < 4; j++) average.add(new Three.Vector3().fromBufferAttribute(a, i * 4 + j));
      average.multiplyScalar(.25);
      expect(average.x / scale).toBeCloseTo(point[0], 5); expect(average.y / scale).toBeCloseTo(point[1], 5);
    });
    b.root.position.set(11, 7, -3); b.root.rotation.y = .2; motion.update(.42, 0, 0, false);
    const d = motion.describe!() as any;
    expect(d.handleWorld).toEqual(meshes.find(m => m.userData.atmosphereRole === 'height-handle')!.getWorldPosition(new Three.Vector3()).toArray());
    const local = atmosphereProfilePoint(.42), world = b.root.localToWorld(new Three.Vector3(local[0] * scale, local[1] * scale, -96 - 64 * scale + local[2] * scale));
    d.probeWorld.forEach((coordinate: number, i: number) => expect(coordinate).toBeCloseTo(world.toArray()[i], 12));
  });
});
