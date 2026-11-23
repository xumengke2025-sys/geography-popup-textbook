import { mountLimestoneFinish } from './textbook-karst-limestone';
import { mountSpecimenDial } from './textbook-specimen-dial';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint } from './textbook-model-input';
import { evaluateKarst, KARST_NAMES, KARST_REFERENCE, karstHeight, karstSource, karstJointU, karstJointV, karstTransverseRange, karstWaterPoint } from './textbook-karst-model';

/** One closed, mutable limestone relief. Its original paper shader, fine
 * section ink and rain paths are geometry; no source illustration is sampled. */
export function buildKarstWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = 66 * s, z0 = -LIFT_MARGIN - b.height * .69;
  const p = (u: number, v: number, h = 0): Vec3 => [u * b.width, h * s, z0 + v * depth];
  const nx = 114, nz = 74, vertices: number[] = [], indices: number[] = [];
  const samples: { index: number; u: number; v: number }[] = [], border: [number, number][] = [];
  let state = evaluateKarst(0, 0), previousPhase = -1, previousSelection = -1;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / nz, k = vertices.length / 3;
    vertices.push(...p(u, v, karstHeight(state, u, v))); samples.push({ index: k, u, v });
    if (i < nx && j < nz) indices.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
  }
  for (let i = 0; i <= nx; i++) border.push([i / nx, 0]);
  for (let j = 1; j <= nz; j++) border.push([1, j / nz]);
  for (let i = nx - 1; i >= 0; i--) border.push([i / nx, 1]);
  for (let j = nz - 1; j > 0; j--) border.push([0, j / nz]);
  for (let i = 0; i < border.length; i++) {
    const [u, v] = border[i], [x, z] = border[(i + 1) % border.length], k = vertices.length / 3;
    vertices.push(...p(u, v, karstHeight(state, u, v)), ...p(x, z, karstHeight(state, x, z)), ...p(x, z), ...p(u, v));
    samples.push({ index: k, u, v }, { index: k + 1, u: x, v: z });
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  let source = samples.map(sample=>karstSource(0,sample.u,sample.v)), sourceSelection=0;
  const bottom = vertices.length / 3;
  vertices.push(...p(0, 0), ...p(1, 0), ...p(1, 1), ...p(0, 1));
  indices.push(bottom, bottom + 2, bottom + 1, bottom, bottom + 3, bottom + 2);
  const geometry = new T.BufferGeometry(), position = new T.Float32BufferAttribute(vertices, 3);
  geometry.setAttribute('position', position); geometry.setIndex(indices); geometry.computeVertexNormals();
  const rock = b.mesh(geometry, '#cec5ab', false);
  const finish=mountLimestoneFinish(b.pop,geometry,nx,nz,s);
  rock.material=finish.material;
  rock.userData.landformDetail='灰岩残峰、坡面溶槽与层面';
  rock.material.side = T.DoubleSide; rock.userData.karstRole = 'limestone';
  const waterGeometry = new T.BufferGeometry(), waterPosition = new T.Float32BufferAttribute(new Float32Array(3 * 57 * 6), 3), waterIndex: number[] = [];
  for (let lane = 0; lane < 3; lane++) for (let i = 0; i < 56; i++) {
    const k = lane * 114 + i * 2; waterIndex.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
  }
  waterGeometry.setAttribute('position', waterPosition); waterGeometry.setIndex(waterIndex);
  const water = b.mesh(waterGeometry, '#83a3a6', false, false); water.userData.karstRole = 'surface-water';
  water.material = createSpecimenMaterial(b.pop, { color: '#83a3a6', ink: '#567b7d', hatch: .035, shade: .025, spacing: 3, seed: 71 });
  water.material.side = T.DoubleSide;
  const labels = KARST_NAMES.map(name => b.label(name, p(.50, -.095, 42), 18.8 * s, 7 * s));
  const selectSpecimen=mountSpecimenDial(b,p(.88,1.11,4.2),4.3*s,{label:'拨盘更换石灰岩标本',choices:KARST_NAMES});
  const track = { start: p(.19, 1.14, 2.1), end: p(.81, 1.14, 2.1) };
  const rail = b.box(p(.17, 1.13, 1.7), p(.83, 1.15, 2.1), '#ded5bd', false); rail.userData.karstRole = 'erosion-track';
  const handleGeometry = new T.LatheGeometry([[0, -1.8], [.85, -1.55], [1.40, -.65], [1.35, .25], [.70, 1.15], [0, 3.0]].map(([r, y]) => new T.Vector2(r * s, y * s)), 24);
  const handle = b.mesh(handleGeometry, '#7f9ea2', false); handle.userData.karstRole = 'water-handle';
  handle.material = createSpecimenMaterial(b.pop, { color: '#7f9ea2', ink: '#53767d', hatch: .06, shade: .08, spacing: 2.7, seed: 57 });
  handle.userData.modelInput = { kind: 'phase-track', track, label: '拖动水滴，观察溶蚀' };
  handle.userData.erosionHandle = true;
  const outline = () => {
    const edge = border.map(([u, v]) => p(u, v, karstHeight(state, u, v) + .035));
    b.contour(edge.concat([edge[0]]), .6);
    for (const [u, v] of [[0, 0], [0, 1], [1, 1]]) b.contour([p(u, v), p(u, v, karstHeight(state, u, v))], .48);
    b.contour([p(0, 1), p(1, 1), p(1, 0)], .43);
    for (let lane = 0; lane < 3; lane++) b.contour(Array.from({ length: 67 }, (_, i) => {
      const v = i / 66, u = karstJointU(lane, v); return p(u, v, karstHeight(state, u, v) + .045);
    }), .32);
    for (let lane = 0; lane < 2; lane++) {
      const [start, end] = karstTransverseRange(lane);
      b.contour(Array.from({ length: 57 }, (_, i) => {
        const u = start + (end - start) * i / 56, v = karstJointV(lane, u); return p(u, v, karstHeight(state, u, v) + .045);
      }), .22);
    }
    b.contour([track.start, track.end], .35);
  };
  return {
    update(phase, selection) {
      selectSpecimen(phase,selection);
      if (phase !== previousPhase || selection !== previousSelection) {
        state = evaluateKarst(phase, selection);
        finish.setDampness(state.waterStrength);
        if(sourceSelection!==state.selection) {
          source=samples.map(sample=>karstSource(state.selection,sample.u,sample.v)); sourceSelection=state.selection;
        }
        samples.forEach((sample,i)=>position.setY(sample.index,karstHeight(state,sample.u,sample.v,source[i])*s));
        position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        for (let lane = 0; lane < 3; lane++) for (let i = 0; i <= 56; i++) {
          const point = karstWaterPoint(state, lane, .2 + i / 56 * .679), half = .0055 * state.waterStrength;
          const k = lane * 114 + i * 2;
          waterPosition.setXYZ(k, ...p(point.u - half, point.v, karstHeight(state, point.u - half, point.v) + .105));
          waterPosition.setXYZ(k + 1, ...p(point.u + half, point.v, karstHeight(state, point.u + half, point.v) + .105));
        }
        waterPosition.needsUpdate = true; waterGeometry.computeVertexNormals(); waterGeometry.computeBoundingSphere();
        handle.position.set(...phaseTrackPoint(state.phase, track));
        previousPhase = phase; previousSelection = selection;
      }
      water.visible = state.waterStrength > .001;
      labels.forEach((mesh, i) => mesh.visible = state.selection === i);
      outline();
      if (water.visible) for (const path of state.paths) {
        for (let i = 0; i < 4; i++) {
          const q = (state.phase * 2.1 + i / 4 + path.lane * .09) % 1;
          const a = karstWaterPoint(state, path.lane, Math.max(0, q - .039)), z = karstWaterPoint(state, path.lane, q);
          if (z.stage === 'infiltration' && z.height < path.inlet.height - .35) continue;
          b.flow.push({ points: [b.v(p(a.u, a.v, a.height + .04)), b.v(p(z.u, z.v, z.height + .04))], width: 1.2 * state.waterStrength });
        }
        for (let i = 0; i < 3; i++) {
          const q = ((state.phase * 4 + i / 3 + path.lane * .11) % 1) * .2;
          const a = karstWaterPoint(state, path.lane, Math.max(0, q - .027)), z = karstWaterPoint(state, path.lane, q);
          b.flow.push({ points: [b.v(p(a.u, a.v, a.height)), b.v(p(z.u, z.v, z.height))], width: .9 * state.waterStrength });
        }
      }
    },
    focusBounds: () => ({ min: p(-.015, -.13, 0), max: p(1.015, 1.20, 46) }),
    describe: () => ({ kind: 'karst-dissolution', forms: 6, selectedForm: state.name, phase: state.phase,
      erosion: state.erosion, jointWidth: state.jointWidth, reference: KARST_REFERENCE,
      universalTimeSequence: false, absoluteRockHeightOnlyDecreases: true, waterFollowsSurface: true,
      dissolutionIsNotMechanicalScouring: true, rainfallAndRatesAreSchematic: true,
      buffersStable: true, surfaceVertices: (nx + 1) * (nz + 1), closedLimestoneSolid: true,
      waterPaths: state.paths, erosionTrack: track,
      heightProbes: [[.2, .25], [.52, .55], [.8, .72]].map(([u, v]) => ({ u, v, height: karstHeight(state, u, v) })),
    }),
  };
}
