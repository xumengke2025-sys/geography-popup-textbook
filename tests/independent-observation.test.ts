import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import type { ModelMotion, TextbookGeometry, Vec3 } from '../src/textbook-geometry';
import { inspectionTargets } from '../src/textbook-inspection';
import { evaluateWave, evaluateWaveInspection, waveSvg } from '../src/textbook-wave-model';
import { evaluateTemperatureProfile, evaluateTemperatureInspection, temperatureProfileSvg } from '../src/textbook-temperature-model';
import { evaluateSoilProfile, soilProfileInspection, soilProfileSvg } from '../src/textbook-soil-profile-model';
import { evaluateGnss, evaluateGnssInspection, gnssSvg } from '../src/textbook-gnss-model';
import { evaluateEarthLayers, earthLayerInspection, earthLayersSvg } from '../src/textbook-astronomy-model';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildWaveWorld } from '../src/textbook-wave-world';
import { buildTemperatureWorld } from '../src/textbook-temperature-world';
import { buildSoilProfileWorld } from '../src/textbook-soil-profile-world';
import { buildGnssWorld } from '../src/textbook-gnss-world';
import { buildAstronomy } from '../src/textbook-models-astronomy';
import { loadFieldInstrument } from '../src/textbook-field-instruments';

beforeAll(() => loadFieldInstrument('waves'));

function fixture(build: (b: TextbookGeometry) => ModelMotion) {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), contours: Vec3[][] = [];
  const b = {
    width: 300, height: 180, root, meshes, flow: [], accentStrokes: [],
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    p(u: number, v: number, y = 0): Vec3 { return [u * this.width, y, -96 - (1 - v) * this.height]; },
    v(point: Vec3) { return new Three.Vector3(...point); },
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color })); root.add(mesh); meshes.push(mesh); return mesh;
    },
    box(a: Vec3, z: Vec3, color: string) {
      const g = new Three.BoxGeometry(z[0] - a[0], z[1] - a[1], z[2] - a[2]); g.translate((a[0] + z[0]) / 2, (a[1] + z[1]) / 2, (a[2] + z[2]) / 2); return this.mesh(g, color);
    },
    sphere(at: Vec3, r: number, color: string, _outline = false, scale: Vec3 = [1, 1, 1]) {
      const g = new Three.SphereGeometry(r, 24, 16); g.scale(...scale); g.translate(...at); return this.mesh(g, color);
    },
    label(text: string, at: Vec3, w: number, h = 10) {
      const mesh = this.mesh(new Three.PlaneGeometry(w, h)); mesh.position.set(...at); mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    stroke() {}, ring() {}, outline() {}, contour(points: Vec3[]) { contours.push(points); },
  };
  const motion = build(b as unknown as TextbookGeometry);
  return { motion, meshes, contours };
}
const xyz = (mesh: Three.Mesh) => mesh.position.toArray();

describe('independent observation reveals relationships without seeking the process', () => {
  it('compares closed material orbits at two depths of the same unchanged wave', () => {
    const scientific = evaluateWave(.537, 1), sample = evaluateWaveInspection(.537, 'depth-pair');
    expect(evaluateWave(.537, 1)).toEqual(scientific);
    expect(sample.points).toHaveLength(2); expect(sample.points[1].radius).toBeLessThan(sample.points[0].radius);
    sample.points.forEach(point => expect(Math.hypot(point.point.x - point.rest.x, point.point.height - point.rest.height)).toBeCloseTo(point.radius, 10));
    expect(evaluateWaveInspection(0, 'depth-pair').points).toEqual(evaluateWaveInspection(1, 'depth-pair').points);
    expect(evaluateWaveInspection(.537, 'unknown').inspection).toBe('overview');
  });

  it('makes the actual surface and deep points select observation while their science stays fixed', () => {
    const { motion, meshes } = fixture(buildWaveWorld), particle = meshes.find(mesh => mesh.userData.waveRole === 'particle')!;
    const deep = meshes.find(mesh => mesh.userData.waveRole === 'deep-particle')!;
    motion.update(.537, 1, 0, true); const before = motion.describe!(), position = xyz(particle);
    expect(particle.userData.modelInput).toMatchObject({ kind: 'inspect', target: 'displacement' });
    motion.inspect!('depth-pair'); motion.update(.537, 1, 0, true);
    expect(motion.describe!()).toMatchObject({ phase: before.phase, selection: before.selection, particle: before.particle, inspection: 'depth-pair' });
    expect(xyz(particle)).toEqual(position); expect(deep.visible).toBe(true); const at = xyz(deep);
    motion.update(.91, 1, 0, true); motion.update(.537, 1, 0, true); expect(xyz(deep)).toEqual(at);
    motion.inspect!('overview'); motion.update(.537, 1, 0, true); expect(deep.visible).toBe(false);
  });

  it('pins the printed surface reading while a temperature comparison keeps the same curve and depth', () => {
    const reference = evaluateTemperatureInspection(0, 'surface-compare').reference;
    let previous = -1;
    for (const phase of [0, .2, .5, 1]) {
      const science = evaluateTemperatureProfile(phase), observed = evaluateTemperatureInspection(phase, 'surface-compare');
      expect(observed.reference).toEqual(reference); expect(observed.current).toEqual(science.point);
      expect(observed.referenceAtDepth[1]).toBe(science.point[1]);
      expect(observed.approximateDifferenceC).toBeGreaterThanOrEqual(previous); previous = observed.approximateDifferenceC;
      expect(evaluateTemperatureProfile(phase)).toEqual(science);
    }
  });

  it('adds real comparison clamps to the water without changing buffers, labels or the sampled temperature', () => {
    const { motion, meshes } = fixture(buildTemperatureWorld), water = meshes.find(mesh => mesh.userData.temperatureRole === 'fixed-profile-closed-water-volume')!;
    motion.update(.51, 1, 0, true); const science = (motion.describe!() as any).state, buffer = water.geometry.attributes.position.array, colors = water.geometry.attributes.color.array;
    expect(water.userData.modelInput).toMatchObject({ kind: 'inspect', target: 'surface-compare' });
    motion.inspect!('surface-compare'); motion.update(.51, 1, 0, true);
    const read = motion.describe!() as any, clamps = meshes.filter(mesh => mesh.userData.temperatureRole === 'surface-reference-clamp');
    expect(read.state).toEqual(science); expect(read.visibleCurrentLabelCount).toBe(1); expect(clamps.every(mesh => mesh.visible)).toBe(true);
    expect(Math.abs(clamps[0].position.x - clamps[1].position.x)).toBeCloseTo(Math.abs(read.observation.reference[0] - science.point[0]) * 3, 8);
    expect(water.geometry.attributes.position.array).toBe(buffer); expect(water.geometry.attributes.color.array).toBe(colors);
    motion.inspect!('overview'); motion.update(.51, 1, 0, true); expect(clamps.some(mesh => mesh.visible)).toBe(false);
  });

  it('uses two adjoining closed soil halves, moving a front half without duplicating or transporting its material', () => {
    const section = soilProfileInspection('section'); expect(section.frontFraction + section.rearFraction).toBe(1);
    const { motion, meshes } = fixture(buildSoilProfileWorld); motion.update(.65, 2, 0, true);
    const original = motion.describe!() as any, pieces = meshes.filter(mesh => mesh.userData.soilProfileRole === 'front-half');
    const handle=meshes.find(mesh=>mesh.userData.soilProfileHandle)!;
    const handleAt=handle.getWorldPosition(new Three.Vector3()).toArray();
    const track=original.waterTrack;
    handleAt.forEach((n,i)=>expect(n).toBeCloseTo(track.start[i]+(track.end[i]-track.start[i])*.65,8));
    const frontFoot=meshes.find(mesh=>mesh.name==='front-half-contact-shoe')!;
    const footBefore=xyz(frontFoot);
    const grains = meshes.filter(mesh => mesh.userData.soilProfileRole === 'material'), positions = grains.map(xyz), buffers = meshes.map(mesh => mesh.geometry.attributes.position.array);
    expect(pieces).toHaveLength(6); expect(pieces.every(mesh => mesh.userData.modelInput.kind === 'inspect')).toBe(true);
    expect(meshes.filter(mesh => mesh.userData.soilProfileRole === 'layer').map(mesh => mesh.userData.sectionRange)).toEqual(Array.from({ length: 6 }, () => [0, .55]));
    expect(pieces.map(mesh => mesh.userData.sectionRange)).toEqual(Array.from({ length: 6 }, () => [.55, 1]));
    motion.inspect!('section'); motion.update(.65, 2, 0, true);
    const open = motion.describe!() as any;
    expect(open.inventory).toEqual(original.inventory); expect(open.materials).toEqual(original.materials); expect(open.selection).toBe(original.selection); expect(open.phase).toBe(original.phase);
    expect(xyz(frontFoot)[0]-footBefore[0]).toBeCloseTo(section.frontOffset*120,8);
    expect(handle.getWorldPosition(new Three.Vector3()).toArray()).toEqual(handleAt);
    expect(new Set(grains.map(mesh => mesh.userData.soilProfileMaterial)).size).toBe(24);
    grains.forEach((mesh, i) => { expect(mesh.position.x - positions[i][0]).toBeCloseTo(section.frontOffset * 120, 9); expect(mesh.position.y).toBe(positions[i][1]); });
    motion.inspect!('overview'); motion.update(.65, 2, 0, true); expect(grains.map(xyz)).toEqual(positions);
    expect(xyz(frontFoot)).toEqual(footBefore);
    expect(meshes.every((mesh, i) => mesh.geometry.attributes.position.array === buffers[i])).toBe(true);
  });

  it('keeps every soil marker once in SVG when the column is opened or closed', () => {
    const base = evaluateSoilProfile(.65, 2);
    for (const target of ['overview', 'section']) {
      const svg = soilProfileSvg(.65, 2, target);
      expect((svg.match(/data-soil-profile-material="/g) ?? []).length).toBe(base.inventory.total);
      expect(svg.includes(`data-source="${base.inventory.source}" data-moving="${base.inventory.moving}" data-deposited="${base.inventory.deposited}"`)).toBe(true);
      expect(svg.includes('data-model-inspection="section"')).toBe(true);
    }
  });

  it('closes precisely the missing quarter of the same Earth shells, preserving layer choices', () => {
    const { motion, meshes } = fixture(b => buildAstronomy(b, 'spheres'));
    motion.update(.7, 2, 0, true); const science = evaluateEarthLayers(2), before = motion.describe!() as any;
    const covers = meshes.filter(mesh => mesh.userData.layerPart === 'observation-cover');
    expect(covers).toHaveLength(4); expect(covers.every(mesh => !mesh.visible)).toBe(true);
    for (const cover of covers) {
      const parameters = (cover.geometry as Three.SphereGeometry).parameters;
      expect(parameters.phiStart).toBe(Math.PI / 2); expect(parameters.phiLength).toBe(Math.PI / 2);
      expect(cover.userData.modelInput).toMatchObject({ kind: 'inspect', target: 'closed' });
    }
    motion.inspect!('closed'); motion.update(.7, 2, 0, true);
    const closed = motion.describe!() as any; expect(closed.selected).toBe(2); expect(closed.layerGroups.map((item: any) => item.offset)).toEqual(before.layerGroups.map((item: any) => item.offset));
    expect(covers.map(mesh => mesh.visible)).toEqual(science.layers.map(layer => layer.visible));
    motion.inspect!('overview'); motion.update(.7, 2, 0, true); expect(covers.some(mesh => mesh.visible)).toBe(false);
    expect(earthLayerInspection('closed').observationOnly).toBe(true);
  });

  it('never turns the selected full GNSS guide into a signal arrival or position solution', () => {
    for (const phase of [.1, .43, .53, .85]) for (const satellite of [0, 1, 2, 3]) {
      const science = evaluateGnss(phase), sample = evaluateGnssInspection(phase, `sat-${satellite}`);
      expect(sample.signal).toEqual(science.signals.find(signal => signal.id === `nav-${satellite}`));
      expect(sample.received).toBe(science.receivedSignalIds.includes(`nav-${satellite}`)); expect(sample.lineOfSight).toBe(true);
      expect(evaluateGnss(phase)).toEqual(science);
    }
    expect(evaluateGnssInspection(.1, 'sat-0').received).toBe(false);
  });

  it('selects GNSS observation from each physical satellite without a timeline jump', () => {
    const { motion, meshes } = fixture(buildGnssWorld); motion.update(.43, 1, 0, true);
    const original = motion.describe!() as any, tracers = meshes.filter(mesh => mesh.userData.gnssRole === 'signal-tracer'), positions = tracers.map(xyz);
    meshes.filter(mesh => mesh.userData.gnssRole === 'satellite-body').forEach((satellite, i) => expect(satellite.userData.modelInput).toMatchObject({ kind: 'inspect', target: `sat-${i}` }));
    motion.inspect!('sat-2'); motion.update(.43, 1, 0, true); const focused = motion.describe!() as any;
    expect(focused.state).toEqual(original.state); expect(focused.inspection).toBe('sat-2'); expect(tracers.map(xyz)).toEqual(positions);
    motion.inspect!('overview'); motion.update(.43, 1, 0, true); expect((motion.describe!() as any).state).toEqual(original.state);
  });

  it('offers keyboard/SVG equivalents of each new observation, with matching deterministic states', () => {
    const cases = [
      ['soil', 'section', () => soilProfileSvg(.55, 2, 'section')],
      ['wave', 'depth-pair', () => waveSvg(.55, 1, 'depth-pair')],
      ['temperature', 'surface-compare', () => temperatureProfileSvg(.55, 'surface-compare')],
      ['spheres', 'closed', () => earthLayersSvg(2, 'closed')],
      ['gnss', 'sat-2', () => gnssSvg(.55, 1, 'sat-2')],
    ] as const;
    for (const [effect, target, render] of cases) {
      expect(inspectionTargets(effect, 0).some(item => item.target === target)).toBe(true);
      const svg = render(); expect(svg.includes(`data-inspection="${target}"`)).toBe(true);
      expect(svg.includes('data-model-inspection=')).toBe(true); expect(/<image|<animate/.test(svg)).toBe(false);
      expect(render() === svg).toBe(true);
    }
  });
});
