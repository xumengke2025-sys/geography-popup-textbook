import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { evaluateInsolation, insolationHit, insolationProject, insolationSvg,
  INSOLATION_LAYOUT as L, INSOLATION_REFERENCE, INSOLATION_STOPS } from '../src/textbook-insolation-model';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildInsolationWorld } from '../src/textbook-insolation-world';
import { createSolidMaterial, type SolidMaterialRole } from '../src/textbook-solid-materials';

const norm = (point: number[]) => Math.hypot(...point);
const minus = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
const dot = (a: number[], b: number[]) => a.reduce((v, c, i) => v + c * b[i], 0);
const closePoint = (a: number[], b: number[], digits = 6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], digits));
function fixture() {
  const meshes: Three.Mesh[] = [], paperMaterials: Three.Material[] = [], root = new Three.Group(), contours: Vec3[][] = [];
  const b = {
    width: 300, height: 150, root, meshes,
    pop: { paperMats:paperMaterials,u:{uSurfAlpha:{value:1}},paper: ({ color = '#fff' }: { color?: string }) => {
      const material = new Three.MeshBasicMaterial({ color }); paperMaterials.push(material); return material;
    } },
    v: (point: Vec3) => new Three.Vector3(...point),
    materialFor(role:SolidMaterialRole,color='#fff'):Three.Material{return role==='paper'?this.pop.paper({color}):createSolidMaterial(this.pop,role,color);},
    mesh(geometry: Three.BufferGeometry, color = '#fff',_edges=false,_volume=true,role:SolidMaterialRole='ivory') {
      const mesh = new Three.Mesh(geometry,this.materialFor(role,color)); root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, at: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...at);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; mesh.userData.labelSize = [width, height]; return mesh;
    },
    stroke() {}, outline() {}, contour(points: Vec3[]) { contours.push(points); },
  };
  return { meshes, paperMaterials, root, contours, motion: buildInsolationWorld(b as unknown as TextbookGeometry) };
}

describe('continuous latitude experiment with a fixed parallel-light cross-section', () => {
  it('states the limited geometric supplement and does not call the annual bar chart a sphere diagram', () => {
    expect(INSOLATION_REFERENCE).toMatchObject({ printedPages: [9], pdfPages: [14], figure: '1.12',
      directReconstructionOfOriginalFigure: false, subsolarLatitudeDegrees: 0, localNoonGeometry: true,
      annualRadiationCalculated: false, seasonalDistribution: false, dayLengthCalculated: false, atmosphereCalculated: false });
    expect(INSOLATION_REFERENCE.source).toContain('柱图'); expect(INSOLATION_REFERENCE.note).toContain('只解释入射角一项原因');
  });
  it('maps the three actual latitude nodes to the same sphere and linear height track', () => {
    expect(INSOLATION_STOPS.map(stop => stop.label)).toEqual(['低纬度', '中纬度', '高纬度']);
    expect(INSOLATION_STOPS.map(stop => stop.selection)).toEqual([0, 1, 2]);
    expect(INSOLATION_STOPS[1].phase).toBeCloseTo(Math.sin(40 * Math.PI / 180) / Math.sin(65 * Math.PI / 180), 12);
    for (const stop of INSOLATION_STOPS) {
      const state = evaluateInsolation(stop.phase);
      expect(state.latitudeDegrees).toBeCloseTo(stop.latitudeDegrees, 10); expect(state.selection).toBe(stop.selection);
      expect(state.phaseMeaning).toBe('observation-latitude');
      closePoint(state.hitCenter, insolationHit(state.height));
    }
    const at = evaluateInsolation(.5);
    expect(at.height).toBeCloseTo(evaluateInsolation(1).height / 2, 12);
    expect(at.latitudeDegrees).not.toBeCloseTo(32.5, 1);
  });
  it('keeps a 3.2 by 3.2 beam at every phase, including the entire high-latitude bundle', () => {
    for (let i = 0; i <= 100; i++) {
      const state = evaluateInsolation(i / 100), y = state.rays.map(ray => ray.source[1]);
      expect(state.beamWidth).toBe(3.2); expect(state.beamHeight).toBe(3.2);
      expect(Math.max(...y) - Math.min(...y)).toBeCloseTo(3.2, 12);
      expect(norm(minus(state.rays[1].source, state.rays[2].source))).toBeCloseTo(3.2, 12);
      expect(norm(minus(state.rays[2].source, state.rays[4].source))).toBeCloseTo(3.2, 12);
      expect(state.rays).toHaveLength(5);
    }
    expect(evaluateInsolation(1).rays[3].hit[1] - L.center[1]).toBeGreaterThan(22.4);
  });
  it('makes all five rays parallel and terminates them at the first actual sphere intersection', () => {
    for (const phase of [0, .1, .4, INSOLATION_STOPS[1].phase, .91, .99, 1]) {
      const state = evaluateInsolation(phase);
      for (const ray of state.rays) {
        const direction = minus(ray.hit, ray.source), length = norm(direction);
        closePoint(direction.map(v => v / length), L.sunward.map(v => -v), 10);
        expect(norm(minus(ray.hit, L.center))).toBeCloseTo(L.radius, 11);
        expect(dot(minus(ray.hit, L.center), L.sunward)).toBeGreaterThan(0);
        // One small step back towards the light is strictly outside Earth.
        const justBefore = ray.hit.map((v, i) => v + L.sunward[i] * .001);
        expect(norm(minus(justBefore, L.center))).toBeGreaterThan(L.radius);
      }
    }
  });
  it('uses the same spherical surface for every patch vertex and outward triangle winding', () => {
    for (const phase of [0, .45, 1]) {
      const { patch } = evaluateInsolation(phase);
      expect(patch.points).toHaveLength((L.patchRows + 1) * (L.patchColumns + 1));
      expect(patch.indices).toHaveLength(L.patchRows * L.patchColumns * 6);
      for (const point of patch.points) expect(norm(minus(point, L.center))).toBeCloseTo(L.radius, 10);
      for (let i = 0; i < patch.indices.length; i += 3) {
        const a = new Three.Vector3(...patch.points[patch.indices[i]]), b = new Three.Vector3(...patch.points[patch.indices[i + 1]]), c = new Three.Vector3(...patch.points[patch.indices[i + 2]]);
        const normal = b.sub(a).cross(c.sub(a));
        expect(normal.dot(a.sub(new Three.Vector3(...L.center)))).toBeGreaterThan(0);
      }
    }
  });
  it('spreads the same source cross-section across an increasing area as latitude rises', () => {
    let previousArc = 0, previousArea = 0;
    for (let i = 0; i <= 100; i++) {
      const state = evaluateInsolation(i / 100);
      expect(state.footprintArcLength).toBeGreaterThan(previousArc); previousArc = state.footprintArcLength;
      expect(state.footprintArea).toBeGreaterThan(previousArea); previousArea = state.footprintArea;
      expect(state.footprintArea).toBeGreaterThan(state.beamCrossSectionArea);
    }
    expect(evaluateInsolation(1).footprintArcLength / evaluateInsolation(0).footprintArcLength).toBeGreaterThan(2);
  });
  it('clamps bounds and invalid input, and remains deterministic after reverse dragging or arbitrary seeking', () => {
    expect(evaluateInsolation(-2)).toEqual(evaluateInsolation(0)); expect(evaluateInsolation(4)).toEqual(evaluateInsolation(1));
    for (const invalid of [NaN, Infinity, -Infinity]) expect(evaluateInsolation(invalid)).toEqual(evaluateInsolation(0));
    const expected = evaluateInsolation(.7921);
    for (const phase of [1, .5, .1, .99, 0, .7921]) evaluateInsolation(phase);
    expect(evaluateInsolation(.7921)).toEqual(expected);
  });
});

describe('persistent raised Three.js paper geometry and direct manipulation', () => {
  it('builds a closed globe, five closed cylinders and five arrows rather than using image panels', () => {
    const { meshes, paperMaterials, motion } = fixture();
    expect(meshes.find(mesh => mesh.userData.insolationRole === 'earth')!.geometry.type).toBe('SphereGeometry');
    const globeMaterial=meshes.find(mesh=>mesh.userData.insolationRole==='earth')!.material as Three.Material;
    expect(globeMaterial.side).toBe(Three.FrontSide);expect(globeMaterial.shadowSide).toBe(Three.BackSide);
    const rays = meshes.filter(mesh => mesh.userData.insolationRole === 'parallel-light-cylinder');
    expect(rays).toHaveLength(5); expect(rays.every(mesh => mesh.geometry.type === 'CylinderGeometry')).toBe(true);
    expect(rays.every(mesh=>mesh.userData.castShadow===false)).toBe(true);
    expect(meshes.find(mesh=>mesh.userData.insolationRole==='illumination-footprint')!.userData.castShadow).toBe(false);
    expect(meshes.filter(mesh => mesh.userData.insolationRole === 'light-direction-arrow')).toHaveLength(5);
    expect(meshes.filter(mesh => mesh.geometry.type === 'PlaneGeometry').every(mesh => mesh.userData.kind === 'text-label')).toBe(true);
    for (const mesh of meshes.filter(mesh => mesh.userData.kind !== 'text-label')) {
      expect(paperMaterials).toContain(mesh.material);
      expect((mesh.material as Three.MeshStandardMaterial).isMeshStandardMaterial).toBe(true);
    }
    expect(motion.describe!()).toMatchObject({ kind: 'solar-distribution', originalPagePreserved: true,
      phaseRepresentsTime: false, beamClampedAtHighLatitude: false, fixedBeamWidth: 3.2, fixedBeamHeight: 3.2 });
  });
  it('puts the actual transformed cylinder endpoints on exactly the shared sphere hits', () => {
    const { meshes, motion } = fixture();
    for (const phase of [0, .37, INSOLATION_STOPS[1].phase, 1, .17]) {
      motion.update(phase, 99, 1 / 30, false);
      const state = evaluateInsolation(phase), d: any = motion.describe!();
      expect(d.state).toEqual(state); expect(d.selection).toBe(state.selection);
      const world = (point: number[]) => [point[0] * 3, point[1] * 3 + 108, point[2] * 3 - 354];
      for (const ray of state.rays) {
        const actual = d.rayWorld.find((entry: any) => entry.id === ray.id);
        closePoint(actual.source, world(ray.source)); closePoint(actual.hit, world(ray.hit));
        expect(norm(minus(actual.hit, d.globeWorld.center))).toBeCloseTo(d.globeWorld.radius, 6);
        const mesh = meshes.find(mesh => mesh.userData.insolationRole === 'parallel-light-cylinder' && mesh.userData.insolationRayId === ray.id)!;
        const [a, c] = [new Three.Vector3(0, -.5, 0), new Three.Vector3(0, .5, 0)].map(point => mesh.localToWorld(point).toArray());
        closePoint(a, actual.source); closePoint(c, actual.hit);
      }
    }
  });
  it('updates the actual curved patch buffer with a small radial lift and preserves its footprint', () => {
    const { meshes, motion } = fixture(), patch = meshes.find(mesh => mesh.userData.insolationRole === 'illumination-footprint')!;
    for (const phase of [0, .5, 1, .2]) {
      motion.update(phase, 0, 0, true); const state = evaluateInsolation(phase), d: any = motion.describe!();
      expect(patch.geometry.attributes.position.count).toBe(state.patch.points.length);
      for (let i = 0; i < state.patch.points.length; i++) {
        expect(norm(minus(d.patchWorld[i], d.globeWorld.center))).toBeCloseTo(23 * 3, 6);
        expect(norm(minus(d.patchRenderWorld[i], d.globeWorld.center))).toBeCloseTo((23 + .085) * 3, 4);
        const actual = patch.localToWorld(new Three.Vector3().fromBufferAttribute(patch.geometry.attributes.position, i)).toArray();
        closePoint(actual, d.patchRenderWorld[i]);
      }
    }
  });
  it('gives the source handle one stable vertical phase track, independent of frame rate and selection', () => {
    const { meshes, motion } = fixture(), handle = meshes.find(mesh => mesh.userData.insolationRole === 'height-handle')!;
    const input = handle.userData.modelInput;
    expect(input.kind).toBe('phase-track'); expect(input.track.start[0]).toBe(input.track.end[0]);
    expect(input.track.start[2]).toBe(input.track.end[2]); expect(handle.userData.smallPointTarget).toBe(true);
    expect(handle.userData.interactionFeedback).toBe(false);
    for (const phase of [0, .15, .71, 1, .2]) {
      motion.update(phase, 2, 1 / 144, true);
      expect(phaseFromTrackPoint(handle.position.x, handle.position.y, input.track, 0)).toBeCloseTo(phase, 10);
      const d: any = motion.describe!();
      closePoint(d.handleWorld, d.phaseTrackWorld.start.map((v: number, i: number) => v + (d.phaseTrackWorld.end[i] - v) * phase));
    }
  });
  it('keeps three real latitude nodes clickable and only three large short labels visible', () => {
    const { meshes, motion } = fixture(), nodes = meshes.filter(mesh => mesh.userData.insolationRole === 'latitude-node');
    expect(nodes).toHaveLength(3);
    for (const stop of INSOLATION_STOPS) {
      motion.update(stop.phase, 0, 0, true);
      expect(nodes[stop.selection].userData.modelInput).toMatchObject({ kind: 'select', selection: stop.selection });
      const labels = meshes.filter(mesh => mesh.userData.kind === 'text-label' && mesh.visible);
      expect(labels).toHaveLength(3); expect(labels.map(mesh => mesh.userData.text)).toEqual(['等宽光束', '照射范围', stop.label]);
      expect(labels.every(mesh => mesh.userData.labelSize[1] >= 6.25 * 3)).toBe(true);
      const d: any = motion.describe!(); expect(d.nodeWorld[stop.selection].latitudeDegrees).toBe(stop.latitudeDegrees);
      expect(d.nodeLabelWorld.filter((label: any) => label.visible)).toHaveLength(1);
    }
  });
  it('supports the light source on the same deterministic vertical carriage during reverse scrubbing',()=>{
    const {motion}=fixture();
    for(const phase of [0,.45,1,.8,.2,0]){
      motion.update(phase,0,0,true);const d:any=motion.describe!();
      expect(d.opticalBench).toMatchObject({supportedSource:true,verticalGuides:2,apertureWidth:3.2,apertureHeight:3.2,annualRadiationCalculated:false});
      closePoint(d.opticalBench.carriageWorld,d.handleWorld);
      closePoint(d.opticalBench.sourceFrameWorld,d.handleWorld);
      closePoint(d.opticalBench.carriageWorld,d.phaseTrackWorld.start.map((v:number,i:number)=>v+(d.phaseTrackWorld.end[i]-v)*phase));
    }
  });
  it('reuses every mesh and geometry buffer through forward, reverse and repeated stationary updates', () => {
    const { meshes, motion } = fixture(), count = meshes.length, bounds = motion.focusBounds!();
    const buffers = meshes.map(mesh => mesh.geometry.attributes.position.array), indices = meshes.map(mesh => mesh.geometry.index?.array);
    for (const phase of [0, .3, .9, 1, .2, .8, 1]) {
      motion.update(phase, 0, 1 / 30, false); const normal = motion.describe!();
      motion.update(phase, 2, 1 / 144, true); expect(motion.describe!()).toEqual(normal);
      expect(meshes).toHaveLength(count); expect(motion.focusBounds!()).toEqual(bounds); expect(motion.describe!().geometryBuffersReused).toBe(true);
      meshes.forEach((mesh, i) => { expect(mesh.geometry.attributes.position.array).toBe(buffers[i]); expect(mesh.geometry.index?.array).toBe(indices[i]); });
    }
  });
});

describe('native SVG from the same sphere and rays', () => {
  it('tracks the five exact projected ray endpoints and actual spherical patch for all three nodes', () => {
    for (const phase of INSOLATION_STOPS.map(stop => stop.phase)) {
      const state = evaluateInsolation(phase), svg = insolationSvg(phase);
      expect(svg).toContain(`data-insolation-phase="${state.phase}"`); expect(svg).toContain(`data-insolation-selection="${state.selection}"`);
      for (const ray of state.rays) {
        const coords = [ray.source, ray.hit].map(p => insolationProject(p).map(v => +v.toFixed(3)).join(','));
        expect(svg).toContain(`data-insolation-ray="${ray.id}" d="M${coords[0]}L${coords[1]}"`);
      }
      expect(svg.match(/data-insolation-footprint="/g)).toHaveLength(1); expect(svg.match(/data-insolation-node="/g)).toHaveLength(3);
    }
  });
  it('keeps the mobile view readable with short labels and keyboard-accessible nodes, without a bitmap or external asset', () => {
    for (const phase of [0, .4, .8, 1, NaN]) {
      const svg = insolationSvg(phase);
      expect(svg).toContain('viewBox="0 0 720 480"'); expect(svg.match(/<text\b/g)).toHaveLength(3);
      expect(svg.match(/font-size="36"/g)).toHaveLength(3);
      for (const stop of INSOLATION_STOPS) expect(svg).toContain(`data-model-selection="${stop.selection}" role="button" tabindex="0"`);
      expect(svg).toContain('滑动改变观察纬度，不表示时间'); expect(svg).toContain('不显示年总辐射量');
      expect(svg).not.toMatch(/<image\b|<foreignObject\b|data:image|href=|https?:|NaN|Infinity|undefined/);
      // Check well-nested XML elements in the generated standalone fragment.
      const stack: string[] = [];
      for (const match of svg.matchAll(/<(\/?)([A-Za-z][\w:-]*)\b[^>]*?(\/?)>/g)) {
        if (match[1]) expect(stack.pop()).toBe(match[2]); else if (!match[3]) stack.push(match[2]);
      }
      expect(stack).toEqual([]);
    }
  });
});
