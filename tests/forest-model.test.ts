import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { evaluateForest, forestPartMeshData, forestSvg, FOREST_LAYOUT, FOREST_PARTS,
  FOREST_PLANTS, FOREST_REFERENCE, FOREST_STOPS } from '../src/textbook-forest-model';
import { phaseFromTrackPoint } from '../src/textbook-model-input';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildForestWorld } from '../src/textbook-forest-world';

function fixture() {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), strokes: Vec3[][] = [], contours: Vec3[][] = [];
  const b: any = {
    width: 300, height: 140, root, meshes, strokes, contours,
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    v: (point: Vec3) => new Three.Vector3(...point),
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color }));
      root.add(mesh); meshes.push(mesh); return mesh;
    },
    label(text: string, point: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...point);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    stroke(points: Vec3[]) { strokes.push(points); },
    contour(points: Vec3[]) { contours.push(points); },
    outline(_mesh: Three.Mesh) {},
  };
  return { b, meshes, motion: buildForestWorld(b as TextbookGeometry) };
}
const closePoint = (actual: number[], expected: number[]) => actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 9));

describe('textbook fig.5.2 is a vertical observation of one forest', () => {
  it('records the checked figure and explicitly separates position from growth or time', () => {
    expect(FOREST_REFERENCE).toMatchObject({ printedPage: 83, pdfPage: 88, figure: '5.2',
      phaseMeaning: 'vertical-observation-position', phaseMeansElapsedTime: false,
      depictsGrowth: false, depictsSuccession: false, heightsAreMeasured: false, lightIsMeasured: false });
    expect(FOREST_STOPS.map(({ phase, selection }) => [phase, selection])).toEqual([[0, 0], [.5, 1], [1, 2]]);
    FOREST_STOPS.forEach(stop => expect(evaluateForest(stop.phase)).toMatchObject({
      selection: stop.selection, stageIndex: stop.selection, selectedLayer: stop.label,
    }));
  });

  it('retains every plant and part at every observation height', () => {
    expect(FOREST_PLANTS).toHaveLength(25);
    expect([0, 1, 2].map(layer => FOREST_PLANTS.filter(plant => plant.layer === layer).length)).toEqual([5, 6, 14]);
    expect(new Set(FOREST_PLANTS.map(plant => plant.id)).size).toBe(FOREST_PLANTS.length);
    const before = JSON.stringify({ plants: FOREST_PLANTS, parts: FOREST_PARTS });
    for (const phase of [0, .23, .5, .81, 1, .17, 0]) {
      const state = evaluateForest(phase);
      expect(state.plants).toBe(FOREST_PLANTS); expect(state.parts).toBe(FOREST_PARTS);
      expect(state).toMatchObject({ allLayersRetained: true, plantStructuresAreStatic: true,
        phaseMeansElapsedTime: false, depictsGrowth: false, depictsSuccession: false });
    }
    expect(JSON.stringify({ plants: FOREST_PLANTS, parts: FOREST_PARTS })).toBe(before);
  });

  it('continuously lowers the observation plane and relative light without invented units', () => {
    let previousHeight = Infinity, previousLight = Infinity;
    for (let i = 0; i <= 400; i++) {
      const state = evaluateForest(i / 400);
      expect(state.observationHeight).toBeLessThanOrEqual(previousHeight);
      expect(state.relativeLight).toBeLessThanOrEqual(previousLight);
      expect(state.relativeLight).toBeGreaterThan(0);
      expect(state.probe[1]).toBe(state.observationHeight);
      expect(state.handle[1]).toBe(state.observationHeight);
      previousHeight = state.observationHeight; previousLight = state.relativeLight;
    }
    expect([0, .5, 1].map(phase => evaluateForest(phase).observationHeight)).toEqual([42, 22.5, 3]);
    expect(evaluateForest(0).relativeLight).toBe(1);
    expect(evaluateForest(1).relativeLight).toBe(.16);
    expect(Object.keys(evaluateForest(.5)).join(' ')).not.toMatch(/lux|percent|metres|seconds/);
  });

  it('returns the same result after forward, backward and discontinuous seeking', () => {
    const expected = evaluateForest(.631);
    for (const phase of [1, .5, .2, 0, .98, .71]) evaluateForest(phase);
    expect(evaluateForest(.631)).toEqual(expected);
    expect(evaluateForest(-9).phase).toBe(0); expect(evaluateForest(8).phase).toBe(1);
    expect(evaluateForest(Number.NaN).phase).toBe(0);
    for (const phase of [0, .5, 1]) {
      const p = evaluateForest(phase).handle;
      expect(phaseFromTrackPoint(p[0], p[1], FOREST_LAYOUT.track, .31)).toBeCloseTo(phase, 12);
    }
  });

  it('builds finite three-dimensional crown, stem and leaf data for both renderers', () => {
    expect(new Set(FOREST_PARTS.map(part => part.kind))).toEqual(new Set(['rod', 'crown', 'leaf']));
    for (const part of FOREST_PARTS) {
      const data = forestPartMeshData(part);
      expect(data.positions.every(Number.isFinite)).toBe(true);
      expect(data.indices.every(index => Number.isInteger(index) && index >= 0 && index < data.positions.length / 3)).toBe(true);
      expect(data.indices.length % 3).toBe(0);
      const bounds = [0, 1, 2].map(axis => {
        const values = data.positions.filter((_, i) => i % 3 === axis); return Math.max(...values) - Math.min(...values);
      });
      expect(bounds.every(size => size > 0)).toBe(true);
    }
    expect(FOREST_PARTS.some(part => part.role === 'branch')).toBe(true);
    expect(FOREST_PARTS.some(part => part.kind === 'leaf' && part.thickness > 0)).toBe(true);
  });

  it('keeps the SVG native, selectable and tied to the same plants, height and light', () => {
    for (const phase of [0, .375, .5, .86, 1]) {
      const state = evaluateForest(phase), svg = forestSvg(phase);
      expect(svg).not.toContain('<image'); expect(svg).not.toContain('data:image');
      expect(svg.match(/data-forest-plant="/g)).toHaveLength(FOREST_PLANTS.length);
      expect(svg.match(/data-forest-node="/g)).toHaveLength(3);
      expect(svg).toContain(`data-forest-stage="${state.stage}"`);
      expect(svg).toContain(`data-forest-selection="${state.selection}"`);
      expect(svg).toContain(`data-forest-height="${Number(state.observationHeight.toFixed(3))}"`);
      expect(svg).toContain(`data-forest-light="${Number(state.relativeLight.toFixed(3))}"`);
      expect(svg).toContain(state.caption);
      FOREST_PLANTS.forEach(plant => expect(svg).toContain(`data-forest-plant="${plant.id}" data-forest-layer="${plant.layer}"`));
      expect(svg).not.toMatch(/\d+%|勒克斯|照度值|年后|生长阶段/);
    }
  });
});

describe('the raised forest preserves its solids during observation', () => {
  it('merges the plant parts into eleven selectable solid surfaces and three labels', () => {
    const { meshes, motion } = fixture(), plants = meshes.filter(mesh => /^plant-/.test(mesh.userData.forestRole ?? ''));
    expect(plants).toHaveLength(11); expect(motion.describe!().fixedMeshCount).toBe(meshes.length);
    expect(new Set(plants.map(mesh => mesh.userData.modelInput.selection))).toEqual(new Set([0, 1, 2]));
    expect(new Set(plants.flatMap(mesh => mesh.userData.forestPartIds)).size).toBe(FOREST_PARTS.length);
    expect(new Set(plants.flatMap(mesh => mesh.userData.forestPlantIds)).size).toBe(FOREST_PLANTS.length);
    const labels = meshes.filter(mesh => mesh.userData.kind === 'text-label');
    expect(labels.map(mesh => mesh.userData.text)).toEqual(['乔木层', '灌木层', '草本层']);
    expect(labels.map(mesh => mesh.userData.modelInput.selection)).toEqual([0, 1, 2]);
    expect(motion.describe!()).toMatchObject({ kind: 'forest-strata-observation', layers: 3, plantCount: 25,
      solidPlantMeshes: 11, layerPlantCounts: [5, 6, 14], elevatedAbovePage: 99, originalPagePreserved: true });
  });

  it('moves the real probe and handle on the same vertical rail and reads the pure state', () => {
    const { motion, meshes } = fixture(), handle = meshes.find(mesh => mesh.userData.forestRole === 'phase-handle')!;
    expect(handle.userData.smallPointTarget).toBe(true);
    expect(handle.userData.modelInput.kind).toBe('phase-track');
    const track = handle.userData.modelInput.track;
    expect(track.start[2]).toBe(track.end[2]); expect(track.start[0]).toBe(track.end[0]);
    expect(track.start[1]).toBeGreaterThan(track.end[1]);
    for (const phase of [0, .5, 1, .19, .81, .5, 0]) {
      motion.update(phase, 0, 1 / 60, false);
      const state = evaluateForest(phase), actual = motion.describe!();
      expect(actual).toMatchObject({ phase: state.phase, stage: state.stage, stageIndex: state.stageIndex,
        selectedLayer: state.selectedLayer, caption: state.caption, observationHeight: state.observationHeight,
        relativeLight: state.relativeLight, allPlantMeshesVisible: true, allLayersRetained: true,
        plantStructuresAreStatic: true, geometryBuffersReused: true });
      const worldTrack = actual.phaseTrackWorld as { start: Vec3; end: Vec3 };
      closePoint(actual.handleWorld as Vec3, worldTrack.start.map((value, i) => value + (worldTrack.end[i] - value) * phase));
      expect((actual.probeWorld as Vec3)[1]).toBeCloseTo((actual.handleWorld as Vec3)[1], 9);
    }
  });

  it('reuses every geometry buffer and keeps fixed plants and framing through repeated seeks', () => {
    const { motion, meshes } = fixture(), focus = motion.focusBounds!(), meshCount = meshes.length;
    const vertices = meshes.map(mesh => mesh.geometry.attributes.position.array), indices = meshes.map(mesh => mesh.geometry.index?.array);
    const plants = meshes.filter(mesh => /^plant-/.test(mesh.userData.forestRole ?? ''));
    const transforms = plants.map(mesh => mesh.matrix.clone());
    for (const phase of [0, 1, .5, .13, .77, .21, 1, 0]) {
      motion.update(phase, 2, 1 / 30, false);
      meshes.forEach((mesh, i) => { expect(mesh.geometry.attributes.position.array).toBe(vertices[i]); expect(mesh.geometry.index?.array).toBe(indices[i]); });
      plants.forEach((mesh, i) => { mesh.updateMatrix(); expect(mesh.matrix).toEqual(transforms[i]); expect(mesh.visible).toBe(true); });
      expect(motion.focusBounds!()).toEqual(focus);
    }
    expect(meshes).toHaveLength(meshCount);
    motion.update(.613, 0, 1 / 30, false); const slow = motion.describe!();
    motion.update(.613, 2, 1 / 144, true); expect(motion.describe!()).toEqual(slow);
  });

  it('keeps the observation rim, both guide bushes and leadscrew nut connected during reverse scrubbing', () => {
    const { motion, meshes } = fixture();
    const byName = (name: string) => meshes.find(mesh => mesh.name === name)!;
    const rim = byName('observation-frame'), bushes = byName('carriage-guide-bushes');
    const connections = byName('carriage-rim-connections'), screw = byName('leadscrew-core').parent!;
    expect(screw.name).toBe('observation-leadscrew');
    const fixed = byName('paired-observation-guides'); fixed.geometry.computeBoundingBox();
    for (const phase of [0, .61, 1, .25, .5, 0]) {
      motion.update(phase, 0, 1 / 60, false);
      const height = evaluateForest(phase).observationHeight * 3;
      expect(rim.position.y).toBeCloseTo(height, 10);
      expect(bushes.position.y).toBeCloseTo(height, 10);
      expect(connections.position.y).toBeCloseTo(height, 10);
      expect(height).toBeGreaterThan(fixed.geometry.boundingBox!.min.y);
      expect(height).toBeLessThan(fixed.geometry.boundingBox!.max.y);
      // A fixed angular contact on the nut sees the same thread at each
      // position, in either seek direction, instead of an unrelated spin.
      const contactAngle = height / (3 * 3) * Math.PI * 2 + screw.rotation.y;
      expect(contactAngle).toBeCloseTo(0, 10);
      expect(motion.describe!().instrumentConstruction).toMatchObject({
        guideBores: true, carriageConnectedToRim: true, causesForestStratification: false,
      });
    }
  });
});
