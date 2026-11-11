import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, PALETTE as C, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { evaluateLandslide, landslideGrade, landslideGround, LANDSLIDE_LAYOUT as L, LANDSLIDE_REFERENCE,
  type LandslideMode, type LandslidePoint } from './textbook-landslide-model';

/** A cut-away slope in the space above the original page. Its finite body or
 * water-bearing debris is actual volume, retained at the foot after motion. */
export function buildLandslideWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, z0 = -LIFT_MARGIN - 76 * scale;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * scale, y * scale, z0 + z * scale];
  const quiet = (mesh: any, color: string, hatch = .13) => {
    mesh.material = createSpecimenMaterial(b.pop, { color, ink: '#727768', spacing: 3.2, hatch, shade: .075, seed: 211 });
    mesh.material.side = T.DoubleSide; return mesh;
  };
  const role = (mesh: any, name: string) => { mesh.userData.landslideRole = name; return mesh; };
  const vertices: number[] = [], terrainIndices: number[] = [], terrainPoints: { index: number; x: number; z: number }[] = [];
  const nx = 60, nz = 36, perimeter: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const x = L.left + (L.right - L.left) * i / nx, z = L.back + (L.front - L.back) * j / nz, index = vertices.length / 3;
    vertices.push(...p([x, landslideGround(x, z, 'landslide'), z])); terrainPoints.push({ index, x, z });
    if (i < nx && j < nz) terrainIndices.push(index, index + nx + 1, index + 1, index + 1, index + nx + 1, index + nx + 2);
  }
  for (let i = 0; i <= nx; i++) perimeter.push(i);
  for (let j = 1; j <= nz; j++) perimeter.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) perimeter.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) perimeter.push(j * (nx + 1));
  for (let i = 0; i < perimeter.length; i++) {
    const a = terrainPoints[perimeter[i]], c = terrainPoints[perimeter[(i + 1) % perimeter.length]], k = vertices.length / 3;
    vertices.push(...p([a.x, landslideGround(a.x, a.z, 'landslide'), a.z]), ...p([c.x, landslideGround(c.x, c.z, 'landslide'), c.z]),
      ...p([c.x, 0, c.z]), ...p([a.x, 0, a.z]));
    terrainPoints.push({ index: k, x: a.x, z: a.z }, { index: k + 1, x: c.x, z: c.z });
    terrainIndices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const floor = vertices.length / 3;
  for (const [x, z] of [[6, 8], [96, 8], [96, 62], [6, 62]]) vertices.push(...p([x, 0, z]));
  terrainIndices.push(floor, floor + 1, floor + 2, floor, floor + 2, floor + 3);
  const terrainGeometry = new T.BufferGeometry(); terrainGeometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  terrainGeometry.setIndex(terrainIndices); terrainGeometry.computeVertexNormals();
  const terrain = role(quiet(b.mesh(terrainGeometry, '#b9b69a', false), '#b9b69a', .16), 'slope-and-gully');
  const initial = evaluateLandslide(0), bodyCount = initial.slide.lower.length;
  function volume(bottom: readonly LandslidePoint[], top: readonly LandslidePoint[], indices: number[], boundary: number[], color: string, name: string) {
    const geometry = new T.BufferGeometry(), positions = new T.Float32BufferAttribute(new Float32Array((bottom.length + top.length) * 3), 3);
    const ix: number[] = [], count = bottom.length;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i], c = indices[i + 1], d = indices[i + 2];
      ix.push(a, c, d, a + count, d + count, c + count);
    }
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], c = boundary[(i + 1) % boundary.length];
      ix.push(a, a + count, c + count, a, c + count, c);
    }
    geometry.setAttribute('position', positions); geometry.setIndex(ix);
    const mesh = role(quiet(b.mesh(geometry, color, false), color, name === 'finite-wet-debris' ? .06 : .20), name);
    const set = (lower: readonly LandslidePoint[], upper: readonly LandslidePoint[]) => {
      for (let i = 0; i < lower.length; i++) { positions.setXYZ(i, ...p(lower[i])); positions.setXYZ(i + count, ...p(upper[i])); }
      positions.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    };
    set(bottom, top); return { mesh, set, geometry };
  }
  const slideTriangles: number[] = [];
  for (let i = 1; i < bodyCount - 1; i++) slideTriangles.push(0, i, i + 1);
  const slide = volume(initial.slide.lower, initial.slide.upper, slideTriangles, Array.from({ length: bodyCount }, (_, i) => i), '#c3b08d', 'coherent-sliding-body');
  slide.mesh.userData.modelInput = { kind: 'replay', selection: 0, label: '重新观察同一个滑体沿坡下移' };
  const flow = volume(initial.debris.bottom, initial.debris.top, initial.debris.indices, initial.debris.boundary, '#a2ad9f', 'finite-wet-debris');
  flow.mesh.userData.modelInput = { kind: 'replay', selection: 1, label: '重新观察同一批含水碎屑' };
  const scarGeometry = new T.BufferGeometry();
  scarGeometry.setAttribute('position', new T.Float32BufferAttribute(initial.slide.lower.flatMap(([x, y, z]) => p([x, y + .018, z])), 3));
  scarGeometry.setIndex(slideTriangles.flatMap((_, i) => i % 3 === 0 ? [slideTriangles[i], slideTriangles[i + 2], slideTriangles[i + 1]] : []));
  scarGeometry.computeVertexNormals();
  const scar = role(quiet(b.mesh(scarGeometry, '#d2c2a2', false, false), '#d2c2a2', .24), 'exposed-slip-surface');
  const rockBase = new T.IcosahedronGeometry(1, 0).toNonIndexed(), rockSource = rockBase.attributes.position;
  const rockPositions = new T.Float32BufferAttribute(new Float32Array(rockSource.count * L.coarseCount * 3), 3), rockGeometry = new T.BufferGeometry();
  rockGeometry.setAttribute('position', rockPositions); const rocks = role(quiet(b.mesh(rockGeometry, '#b6a486', false), '#b6a486', .18), 'permanent-coarse-fragments');
  rocks.userData.fragmentCount = L.coarseCount; rocks.userData.fragmentStride = rockSource.count;
  const rockTemplate = new Float32Array(rockSource.array), rockStride = rockSource.count; rockBase.dispose();
  const bodyLabel = role(b.label('滑体', p([24, 33, 35]), 13 * scale, 6.2 * scale), 'body-label');
  const slipLabel = role(b.label('滑动面', p([23, landslideGrade(23) + 7.5, 17]), 21 * scale, 6.2 * scale), 'slip-label');
  const wetLabel = role(b.label('含水碎屑', p([30, 39, 35]), 27 * scale, 6.5 * scale), 'wet-debris-label');
  const footLabel = role(b.label('坡脚堆积', p([82, 12, 58]), 28 * scale, 6.5 * scale), 'deposit-label');

  const track = { start: p([17, 3.5, 71]), end: p([83, 3.5, 71]) };
  const handleGeometry = new T.IcosahedronGeometry(1.65 * scale, 0); handleGeometry.scale(1.05, .78, .48);
  const handle = role(quiet(b.mesh(handleGeometry, C.warm, false), '#ae8d68', .08), 'phase-handle');
  handle.userData.modelInput = { kind: 'phase-track', track, label: '沿纸轨拖动，暂停回看这一次物质下移' };
  const tag = role(quiet(b.box(p([88, .5, 70.8]), p([97, 6.5, 71.2]), C.paper, false), C.paper, .02), 'replay-tab');
  tag.userData.modelInput = { kind: 'replay', label: '重新播放当前滑坡或泥石流情景' };

  let state = initial, previousPhase = -1, previousMode: LandslideMode | null = null;
  return {
    update(phase, selection) {
      const mode: LandslideMode = selection === 1 ? 'debris-flow' : 'landslide';
      if (phase !== previousPhase || mode !== previousMode) {
        state = evaluateLandslide(phase, selection);
        if (mode !== previousMode) {
          const a = terrainGeometry.attributes.position;
          for (const q of terrainPoints) a.setY(q.index, landslideGround(q.x, q.z, mode) * scale);
          a.needsUpdate = true; terrainGeometry.computeVertexNormals(); terrainGeometry.computeBoundingBox(); terrainGeometry.computeBoundingSphere();
        }
        slide.mesh.visible = scar.visible = mode === 'landslide'; flow.mesh.visible = rocks.visible = mode === 'debris-flow';
        if (mode === 'landslide') {
          slide.set(state.slide.lower, state.slide.upper);
          bodyLabel.position.set(...p([state.slide.x, state.slide.y + 11, 35]));
        } else {
          flow.set(state.debris.bottom, state.debris.top);
          for (const rock of state.debris.coarse) for (let j = 0; j < rockStride; j++) {
            const k = j * 3, x = rockTemplate[k] * rock.radius, y = rockTemplate[k + 1] * rock.radius * .72, z = rockTemplate[k + 2] * rock.radius;
            rockPositions.setXYZ(rock.id * rockStride + j, ...p([rock.center[0] + x * Math.cos(rock.angle) - z * Math.sin(rock.angle),
              rock.center[1] + y, rock.center[2] + z * Math.cos(rock.angle) + x * Math.sin(rock.angle)]));
          }
          rockPositions.needsUpdate = true; rockGeometry.computeVertexNormals(); rockGeometry.computeBoundingBox(); rockGeometry.computeBoundingSphere();
          const middle = (state.debris.front + state.debris.tail) / 2;
          wetLabel.position.set(...p([middle, landslideGrade(middle) + 12, 35]));
        }
        bodyLabel.visible = mode === 'landslide'; slipLabel.visible = mode === 'landslide' && state.slide.travel > .25;
        wetLabel.visible = mode === 'debris-flow'; footLabel.visible = mode === 'debris-flow' && state.phase > .58;
        handle.position.set(...phaseTrackPoint(state.phase, track));
        previousPhase = phase; previousMode = mode;
      }
      const boundary = perimeter.map(i => { const q = terrainPoints[i]; return p([q.x, landslideGround(q.x, q.z, state.mode) + .02, q.z]); });
      b.contour([...boundary, boundary[0]], .48);
      for (const [x, z] of [[6, 8], [6, 62], [96, 62]]) b.contour([p([x, 0, z]), p([x, landslideGround(x, z, state.mode), z])], .45);
      // Quiet strata on the exposed cut face give the slope physical depth.
      for (const fraction of [.27, .58]) b.contour(Array.from({ length: 41 }, (_, i) => {
        const x = 6 + i * 90 / 40; return p([x, landslideGround(x, 62, state.mode) * fraction, 62.03]);
      }), .25);
      if (state.mode === 'landslide') {
        b.contour([...state.slide.upper, state.slide.upper[0]].map(p), .64);
        for (const i of [0, 3, 5]) b.contour([p(state.slide.lower[i]), p(state.slide.upper[i])], .40);
        for (const line of state.slide.seams) b.contour(line.map(p), .39);
        if (state.slide.travel > .25) {
          b.contour([...initial.slide.lower, initial.slide.lower[0]].map(([x, y, z]) => p([x, y + .045, z])), .32);
          for (const z of [30, 35, 40]) b.contour([p([18, landslideGrade(18) + .08, z]), p([29, landslideGrade(29) + .08, z])], .23);
        }
      } else {
        const f = state.debris;
        b.contour([...f.boundary, f.boundary[0]].map(i => p(f.top[i])), .47);
        // Short blue seams belong to the finite wet material, never an endless
        // stream of arrows entering from outside the scene.
        for (const row of [2, 5, 8]) for (const col of [3, 7]) {
          const i = row * (f.columns + 1) + col;
          b.flow.push({ points: [f.top[i], f.top[i + f.columns + 1]].map(([x, y, z]) => b.v(p([x, y + .035, z]))), width: .32 });
        }
      }
      b.contour([track.start, track.end], .28); b.outline(handle, .45); b.outline(tag, .32);
      for (const end of [track.start, track.end]) b.contour([[end[0], end[1] - .7 * scale, end[2]], [end[0], end[1] + .7 * scale, end[2]]], .30);
      const center = p([92.6, 3.6, 71.25]);
      b.contour(Array.from({ length: 25 }, (_, i): Vec3 => { const a = .2 + i / 24 * Math.PI * 1.7;
        return [center[0] + Math.cos(a) * 1.8 * scale, center[1] + Math.sin(a) * 1.8 * scale, center[2]]; }), .43);
      b.contour([[center[0] + 2.0 * scale, center[1] + .4 * scale, center[2]], [center[0] + 1.5 * scale, center[1] - 1.0 * scale, center[2]],
        [center[0] + .3 * scale, center[1] - .6 * scale, center[2]]], .43);
    },
    focusBounds: () => ({ min: p([3, -1, 5]), max: p([100, 46, 77]) }),
    describe: () => ({ kind: 'slope-movement', reference: LANDSLIDE_REFERENCE, phase: state.phase, selection: state.selection,
      mode: state.mode, stage: state.stage, caption: state.caption, stockVolume: state.stockVolume,
      coherentBody: { x: state.slide.x, y: state.slide.y, pitch: state.slide.pitch, volume: state.slide.volume },
      wetDebris: { front: state.debris.front, tail: state.debris.tail, fanWidth: state.debris.fanWidth, volume: state.debris.volume,
        coarseCount: state.debris.coarse.length, containsWater: true, finiteStock: true },
      slidingBodyIsSolid: true, debrisFollowsSlope: true, separateTrials: true, noWraparound: true,
      fixedBuffers: true, phaseTrack: track, stabilityPrediction: false }),
  };
}
