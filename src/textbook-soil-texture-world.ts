import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { createSoilInstrument } from './textbook-soil-instrument-parts';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';
import { evaluateSoilTexture, soilTextureWaterU, SOIL_TEXTURE_COLLECTOR_FLOOR, SOIL_TEXTURE_COLLECTOR_RANGE, SOIL_TEXTURE_GRAINS,
  SOIL_TEXTURE_REFERENCE, SOIL_TEXTURE_TYPES, SOIL_TEXTURE_WATER_COUNT } from './textbook-soil-texture-model';

/** A freely drained, open-front cutaway comparison instrument. One rigid
 * headstock carries equal rain cells; every column has real drain bores and
 * its own retained collection vessel. Scientific portions remain unchanged. */
export function buildSoilTextureWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, width = 23 * s, height = Math.min(b.height * .60, 43 * s), depth = 14 * s;
  const bottom = 24 * s, top = bottom + height, z0 = -LIFT_MARGIN - b.height * .55, z1 = z0 + depth;
  const centers = [18, 50, 82].map(x => x * s), floor = top - SOIL_TEXTURE_COLLECTOR_FLOOR * height;
  const point = (sample: number, u: number, d: number, v = 1): Vec3 => [centers[sample] + (u - .5) * width, top - d * height, z0 + v * depth];
  const kit = createSoilInstrument(b, s), { parts, solid, plate, pipe, bearing, finish, nozzle, openBox, fixedLabel } = kit;
  const select = (i: number) => ({ kind: 'select', selection: i, label: `观察${SOIL_TEXTURE_TYPES[i].name}，保留同一场降水进度` });
  const action = (mesh: any, i: number, role: string) => {
    mesh.userData.soilTextureRole = role; mesh.userData.soilTextureSample = i;
    mesh.userData.modelInput = select(i); mesh.userData.interactionFeedback = false; return mesh;
  };
  // A low bed has inset feet, tool-cut edges and a narrow metal reveal. The
  // uprights are connected behind the specimens, leaving their front open.
  plate([0, floor - 5.2 * s, z0 - 5 * s], [100 * s, floor - 3.1 * s, z1 + 7 * s], '#544534', 'wood', 'soil-comparison-bed');
  plate([.6 * s, floor - 3.1 * s, z0 - 4.4 * s], [99.4 * s, floor - 2.8 * s, z1 + 6.4 * s], '#a88b50', 'brass', 'thin-bed-reveal');
  plate([1.3 * s, floor - 2.8 * s, z0 - 3.7 * s], [98.7 * s, floor - 1.9 * s, z1 + 5.7 * s], '#2c443d', 'enamel', 'recessed-catch-bed');
  parts.fasteners([[3 * s, floor - 1.8 * s, z0 - 1.5 * s], [97 * s, floor - 1.8 * s, z0 - 1.5 * s],
    [3 * s, floor - 1.8 * s, z1 + 3.3 * s], [97 * s, floor - 1.8 * s, z1 + 3.3 * s]], [0, 1, 0], .38 * s);
  for (const x of [3.4, 96.6]) {
    plate([(x - 1.5) * s, floor - 1.9 * s, z0 - 2.1 * s], [(x + 1.5) * s, floor + .2 * s, z0 + 1.7 * s], '#2c443d', 'enamel', 'upright-bearing-foot');
    pipe([x * s, floor + .1 * s, z0], [x * s, top + 11 * s, z0], .66 * s);
    bearing([x * s, top + 8.7 * s, z0], [0, 1, 0], 1.1 * s, 3.7 * s);
  }
  const beam = plate([2.4 * s, top + 9.5 * s, z0 - 1 * s], [97.6 * s, top + 10.7 * s, z0 + 3.4 * s], '#2c443d', 'enamel', 'same-rain-headstock');
  beam.userData.soilTextureRole = 'same-rain-beam';

  const grainBase = new T.IcosahedronGeometry(1, 1), grainVertices = grainBase.attributes.position;
  const columns = SOIL_TEXTURE_TYPES.map((type, index) => {
    const vertices: number[] = [], colors: number[] = [], normals: number[] = [];
    const grainColors = [type.color, type.side, ['#ddd0ac', '#b39c78', '#be967c'][index]].map(c => new T.Color(c));
    for (const grain of SOIL_TEXTURE_GRAINS[index]) {
      const center = point(index, grain.u, grain.depth, grain.v), radius = grain.radius * width;
      const angle = Math.sin(grain.id * 1.93) * 2.7, ca = Math.cos(angle), sa = Math.sin(angle), color = grainColors[grain.shade];
      const flatten = .62 + .30 * (Math.sin(grain.id * 2.317) * .5 + .5);
      for (let j = 0; j < grainVertices.count; j++) {
        const ox = grainVertices.getX(j), oy = grainVertices.getY(j), oz = grainVertices.getZ(j);
        const relief = .91 + .08 * Math.cos(ox * 7 + oy * 5 - oz * 9 + grain.id * 1.71) ** 2;
        const x = ox * radius * relief, y = oy * radius * flatten * relief, z = oz * radius * .77 * relief;
        vertices.push(center[0] + x * ca - y * sa, center[1] + y * ca + x * sa, center[2] + z);
        const n = new T.Vector3(ox, oy / flatten, oz / .77).normalize();
        normals.push(n.x * ca - n.y * sa, n.y * ca + n.x * sa, n.z);
        const tint = .94 + .06 * (Math.sin(grain.id * 7.13) * .5 + .5);
        colors.push(color.r * tint, color.g * tint, color.b * tint);
      }
    }
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    const grains = b.mesh(geometry, '#ffffff', false, true, 'rock');
    grains.material = createSoilSpecimenFinish(b.pop, '#ffffff', index + 1, s); grains.material.vertexColors = true;
    action(grains, index, 'soil-grains'); grains.userData.grainCount = SOIL_TEXTURE_GRAINS[index].length; grains.userData.grainStride = grainVertices.count;
    const x = centers[index], left = x - width / 2, right = x + width / 2;
    // A real U shell holds the retained back and side faces; its front is the
    // open specimen section. Narrow corner jaws touch the shell, not the pores.
    const walls = openBox(left - .55 * s, right + .55 * s, bottom, top + .4 * s, z0 - .5 * s, z1 + .15 * s,
      '#d8d3bb', 'ivory', `soil-cutaway-${index}`, false, false, .5 * s);
    for (const m of walls) action(m, index, 'sample-frame');
    for (const xx of [left - .65 * s, right + .65 * s]) {
      pipe([xx, bottom - .2 * s, z0 + depth * .48], [xx, top + .7 * s, z0 + depth * .48], .38 * s, '#a88b50', 'brass');
      for (const y of [bottom + 1.2 * s, top - 1.2 * s]) {
        const jaw = plate([xx - .7 * s, y - .6 * s, z0 - .6 * s], [xx + .7 * s, y + .6 * s, z1 + .3 * s], '#2c443d', 'enamel', 'specimen-side-jaw');
        action(jaw, index, 'sample-frame');
      }
    }
    const support = new T.Shape(); support.moveTo(left - .55 * s, -z0); support.lineTo(right + .55 * s, -z0);
      support.lineTo(right + .55 * s, -(z1 + .8 * s)); support.lineTo(left - .55 * s, -(z1 + .8 * s)); support.closePath();
    for (let lane = 0; lane < 3; lane++) {
      const xx = x + (soilTextureWaterU(index, lane, 1) - .5) * width, hole = new T.Path();
      hole.absarc(xx, -z1, .70 * s, 0, Math.PI * 2, true); support.holes.push(hole);
      const outlet = nozzle([xx, bottom - 1.0 * s, z1], .88 * s, .70 * s, 1.7 * s);
      outlet.userData.soilTextureRole = 'actual-drain-nozzle'; outlet.userData.soilTextureSample = index;
    }
    const baseGeometry = new T.ExtrudeGeometry(support, { depth: .65 * s, bevelEnabled: true, bevelSize: .04 * s, bevelThickness: .04 * s, bevelSegments: 1 });
    baseGeometry.rotateX(-Math.PI / 2); baseGeometry.translate(0, bottom - .65 * s, 0);
    action(solid(baseGeometry, '#a88b50', 'brass', 'perforated-drain-seat'), index, 'sample-frame');
    // Each bearing foot bridges all the way down to the instrument bed.
    for (const xx of [left - .8 * s, right + .8 * s]) for (const zz of [z0 + .7 * s, z1 - 1.4 * s]) {
      pipe([xx, floor - 1.9 * s, zz], [xx, bottom, zz], .48 * s);
      bearing([xx, bottom - 2 * s, zz], [0, 1, 0], .77 * s, 1.6 * s);
    }
    const pool = solid(new T.BoxGeometry(width * .84, 1, depth * .88), '#79a6af', 'water', 'collected-water');
    pool.userData.soilTextureRole = 'collected-water'; pool.userData.soilTextureSample = index;
    pool.userData.castShadow = false;
    const cup = openBox(left + .5 * s, right - .5 * s, floor, bottom - 3.3 * s, z0 + depth * .09, z1 + .6 * s,
      '#d8d3bb', 'ivory', `receiving-cup-${index}`, true, true, .45 * s);
    for (const m of cup) { m.userData.soilTextureRole = 'collector'; m.userData.soilTextureSample = index; }
    const reservoir = solid(new T.BoxGeometry(width * .84, 1, depth * .75), '#9bbdc2', 'water', 'equal-rain-reservoir');
    reservoir.userData.soilTextureRole = 'rain-reservoir'; reservoir.userData.soilTextureSample = index; reservoir.userData.castShadow = false;
    const tray = openBox(left - .7 * s, right + .7 * s, top + 11.0 * s, top + 16.8 * s, z0 - .15 * s, z1 + .55 * s,
      '#d8d3bb', 'ivory', `equal-rain-cell-${index}`, true, false, .42 * s);
    // The shared headstock physically contacts the perforated cell floor.
    const rainFloor = support.clone(); const rainGeometry = new T.ExtrudeGeometry(rainFloor, { depth: .5 * s, bevelEnabled: false, curveSegments: 12 });
    rainGeometry.rotateX(-Math.PI / 2); rainGeometry.translate(0, top + 10.7 * s, 0);
    const rainTray = solid(rainGeometry, '#a88b50', 'brass', 'rain-cell-perforated-floor'); rainTray.userData.soilTextureRole = 'rain-tray';
    for (const m of tray) m.userData.soilTextureRole = 'rain-tray';
    // Names are small fixed enamel plates attached to the front bed, not
    // free billboards occupying the space needed to see the specimens.
    plate([x - 6 * s, floor - 2.2 * s, z1 + 5.15 * s], [x + 6 * s, floor + .9 * s, z1 + 5.55 * s], '#a88b50', 'brass', 'sample-nameplate-seat');
    const label = fixedLabel(type.name, [x, floor - .55 * s, z1 + 5.6 * s], 10.7 * s, 2.7 * s);
    action(label, index, 'sample-label');
    return { index, grains, pool, reservoir, label, left, right };
  });
  grainBase.dispose();
  const dropBase = new T.IcosahedronGeometry(1, 1), dropPositions = dropBase.attributes.position;
  const dropSource = new Float32Array(dropPositions.array), stride = dropPositions.count;
  const drops = columns.map(({ index }) => {
    const geometry = new T.BufferGeometry(), position = new T.Float32BufferAttribute(new Float32Array(stride * SOIL_TEXTURE_WATER_COUNT * 3), 3);
    geometry.setAttribute('position', position); const mesh = solid(geometry, '#598d9c', 'water', 'moving-finite-water-portions');
    mesh.userData.soilTextureRole = 'water-portions'; mesh.userData.soilTextureSample = index; mesh.userData.waterPortionStride = stride; mesh.userData.castShadow = false;
    return { mesh, geometry, position, index };
  }); dropBase.dispose();
  const track = { start: [-.2 * s, top + 16.5 * s, z1 + 2 * s] as Vec3, end: [-.2 * s, floor + 1 * s, z1 + 2 * s] as Vec3 };
  pipe(track.start, track.end, .25 * s);
  for (const at of [track.start, track.end]) bearing(at, [0, 1, 0], .65 * s, 1.1 * s);
  const handle = solid(new T.SphereGeometry(1.6 * s, 20, 12), '#e3ddc9', 'ivory', 'rain-observation-rider'); handle.scale.set(.9, 1.25, .8);
  handle.userData.soilTextureRole = 'water-handle'; handle.userData.soilTextureHandle = true;
  handle.userData.modelInput = { kind: 'phase-track', track, label: '上下拖动水滴，对照同一场降水' };
  const tag = parts.knob([50 * s, top + 18 * s, z0 + 2 * s], [0, 1, 0], 2.1 * s, 2.4 * s);
  tag.traverse((m: any) => { if (m.isMesh) { m.userData.soilTextureRole = 'replay-tag'; m.userData.modelInput = { kind: 'replay', label: '重新播放同一场示意降水' }; } });
  finish();
  let state = evaluateSoilTexture(0), previousPhase = -1, previousSelection = -1;
  return {
    update(phase, selection) {
      if (phase !== previousPhase || selection !== previousSelection) {
        state = evaluateSoilTexture(phase, selection);
        for (const column of columns) {
          const sample = state.samples[column.index], poolHeight = height * SOIL_TEXTURE_COLLECTOR_RANGE * sample.collected;
          column.pool.visible = sample.collected > 0; column.pool.scale.y = Math.max(.001, poolHeight);
          column.pool.position.set(centers[column.index], floor + poolHeight / 2, z0 + depth * .56);
          const reserveHeight = 4.8 * s * sample.reservoir;
          column.reservoir.visible = sample.reservoir > 0; column.reservoir.scale.y = Math.max(.001, reserveHeight);
          column.reservoir.position.set(centers[column.index], top + 11.2 * s + reserveHeight / 2, z0 + depth * .56);
          column.pool.userData.fraction = sample.collected; column.reservoir.userData.fraction = sample.reservoir;
          const { mesh, position, geometry } = drops[column.index];
          for (const water of sample.portions) {
            const center = point(column.index, water.u, water.depth), visible = water.status !== 'waiting' && water.status !== 'collected';
            const radius = visible ? water.radius * width * Math.cbrt(water.amount) : 0, elongation = water.status === 'falling' || water.status === 'dripping' ? 1.4 : .75;
            for (let j = 0; j < stride; j++) { const a = j * 3, vertex = water.id * stride + j;
              position.setXYZ(vertex, center[0] + dropSource[a] * radius, center[1] + dropSource[a + 1] * radius * elongation, center[2] + dropSource[a + 2] * radius * .75);
            }
          }
          position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere(); mesh.userData.portions = sample.portions;
        }
        handle.position.set(...phaseTrackPoint(state.phase, track)); previousPhase = phase; previousSelection = selection;
      }
      // Only a fine underline marks the current comparison object.
      const x = centers[state.selection];
      b.contour([[x - 4.3 * s, floor - 1.65 * s, z1 + 5.65 * s], [x + 4.3 * s, floor - 1.65 * s, z1 + 5.65 * s]], .42);
    },
    focusBounds: () => ({ min: [-4 * s, floor - 6 * s, z0 - 5 * s], max: [102 * s, top + 22 * s, z1 + 9 * s] }),
    describe: () => ({ kind: 'soil-texture', reference: SOIL_TEXTURE_REFERENCE, phase: state.phase, selection: state.selection, stage: state.stage,
      sameRainfall: true, rain: state.rain, samples: state.samples, grainCounts: SOIL_TEXTURE_GRAINS.map(g => g.length),
      fixedWaterCountPerSample: SOIL_TEXTURE_WATER_COUNT, fixedBuffers: true, ratesMeasured: false, retentionIsMeasured: false,
      geometryLayout: { centers, width, height, top, bottom, z0, depth, waterV: 1 }, waterTrack: track,
      construction: 'open-cutaway-soil-comparison-instrument', actualDrainOutlets: 9, independentCollectors: 3,
      equalRainCells: 3, fixedGrainGeometry: true, selfSupporting: true, cutawayIsOpenFront: true }),
  };
}
