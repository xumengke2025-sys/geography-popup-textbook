import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { mountFieldInstrument } from './textbook-field-instruments';
import { finishWindSpecimens } from './textbook-aeolian-sculpture';
import { applyEarthScan } from './textbook-earth-scan';
import { AEOLIAN_TITLES, aeolianRadiusScale, aeolianTransportPoint, evaluateAeolian } from './textbook-aeolian-model';

export function buildAeolianTunnel(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .62;
  const point = (x: number, h: number, depth: number): Vec3 => [x * s, h * s, z0 + depth * s];
  const parts = mountFieldInstrument(b, 'aeolian', s, point(0, 0, 0));
  const group = (key: string) => parts.get(key)!;
  const shaft = point(4.6, 16.5, 44.2);
  const dial = { center: point(4.6, 16.5, 49.4), radiusX: 9.34 * s, radiusY: 9.34 * s, turns: 3 };
  const rotors = ['wheel', 'grip', 'rotor'].flatMap(name => {
    const meshes = group(name);
    for (const mesh of meshes) {
      mesh.geometry.translate(-shaft[0], -shaft[1], -shaft[2]);
      mesh.position.set(...shaft);
      if (name !== 'rotor') mesh.userData.modelInput = { kind: 'phase-dial', dial, label: '转动木柄送风，反摇回看同一标本' };
    }
    return meshes;
  });
  const keys = AEOLIAN_TITLES.map((name, i) => {
    const meshes = group('key' + i);
    for (const mesh of meshes) {
      mesh.userData.modelInput = { kind: 'select', selection: i, keepPhase: true, label: '换入' + name + '标本' };
      mesh.userData.smallPointTarget = true;
    }
    return meshes;
  });
  const stone = group('mushroom')[0], yardang = group('yardang')[0], dune = group('dune')[0];
  finishWindSpecimens(stone, yardang, dune, group('bed')[0], s, z0);
  const stoneOrigin = point(57, 1, 26);
  stone.geometry.translate(-stoneOrigin[0], -stoneOrigin[1], -stoneOrigin[2]); stone.position.set(...stoneOrigin);
  const rock = stone.geometry.attributes.position, original = new Float32Array(rock.array);
  const neutralNormal = new Float32Array(stone.geometry.attributes.normal.array);
  const replay = AEOLIAN_TITLES.map((title, selection) => ({ kind: 'replay' as const, selection, label: '从头观察' + title }));
  stone.userData.aeolianRole = 'mushroom'; yardang.userData.aeolianRole = 'yardang'; dune.userData.aeolianRole = 'dune';
  stone.userData.modelInput = replay[0]; yardang.userData.modelInput = replay[1];
  // Both rocks use one stone finish. Dune and tray use the finer aeolian sand at their own spans.
  applyEarthScan(stone.material, 'outcrop', 9 * s);
  if (yardang.material !== stone.material) applyEarthScan(yardang.material, 'outcrop', 9 * s);
  applyEarthScan(dune.material, 'sand', 8.5 * s);
  applyEarthScan(group('bed')[0].material, 'sand', 7.5 * s);
  const sand = Array.from({ length: 18 }, (_, i) => {
    const grain = b.mesh(new T.IcosahedronGeometry((.25 + i % 3 * .09) * s, 0), i % 2 ? '#b18d5e' : '#c7a87c', false, true, 'land');
    grain.userData.aeolianRole = 'sand-grain'; grain.userData.aeolianGrainId = i;
    return grain;
  });
  const hull: Vec3[] = [];
  for (const x of [-12, 106]) for (const depth of [-.8, 59]) hull.push(point(x,-4.7,depth), point(x,2,depth));
  for (const x of [-10,20]) for (const depth of [18,34]) hull.push(point(x,32,depth));
  hull.push(point(57,29,27), point(5,22,52));
  let state = evaluateAeolian(0), lastErosion = -1;
  return {
    framingPoints: () => hull,
    focusBounds: () => ({ min: point(-12,-4.75,-.8), max: point(106,33,59) }),
    update(phase, selection) {
      state = evaluateAeolian(phase, selection);
      for (const mesh of rotors) mesh.rotation.z = state.phase * Math.PI * 2 * dial.turns;
      keys.forEach((meshes, i) => { for (const mesh of meshes) mesh.position.y = state.selection === i ? -.44 * s : 0; });
      stone.visible = state.selection === 0; yardang.visible = state.selection === 1;
      dune.visible = state.selection >= 2; dune.position.x = state.duneOffset * s; dune.userData.modelInput = replay[state.selection];
      for (const mesh of group('grass')) mesh.visible = state.stabilized;
      if (stone.visible && state.erosion !== lastErosion) {
        const normals = stone.geometry.attributes.normal;
        for (let i = 0; i < rock.count; i++) {
          const k = i * 3, y = original[k + 1] / s, factor = aeolianRadiusScale(y, state.erosion);
          rock.setXYZ(i, original[k] * factor, original[k+1], original[k+2] * factor);
          // Inverse-transpose of the local erosion deformation. The shared-vertex
          // normals of the Blender sculpture retain the chipped surface at every seek.
          const slope = (1 - factor) * 2 * (y - 8) / (6.5 * 6.5);
          const nx = neutralNormal[k] / factor, nz = neutralNormal[k+2] / factor;
          const ny = neutralNormal[k+1] - slope * ((original[k]/s) * nx + (original[k+2]/s) * nz);
          const length = Math.hypot(nx, ny, nz) || 1;
          normals.setXYZ(i,nx/length,ny/length,nz/length);
        }
        rock.needsUpdate = normals.needsUpdate = true; stone.geometry.computeBoundingSphere(); lastErosion = state.erosion;
      }
      for (let j=0;j<3;j++) {
        const depth=.24+j*.21;
        const path=Array.from({length:31},(_,i)=>point(...aeolianTransportPoint(
          i/30,depth,2.1+.52*j,state.selection,state.duneOffset)));
        b.trace(path,state.windPhase+j*.11,2,'flow',1,.51);
      }
      sand.forEach((grain,i) => {
        const g=state.grains[i]; grain.visible=g.visible;
        grain.position.set(...point(...aeolianTransportPoint(g.x,g.depth,g.height,state.selection,state.duneOffset)));
      });
    },
    describe: () => ({ kind: 'wind-erosion-and-deposition', form: state.form, state, wind: 'positive-x',
      duneHorns: 'downwind', erosionAndDepositionDistinct: true, speedIsSchematic: true, buffersStable: true,
      independentForms: true, sharedPureState: true, crankTurns: state.phase * dial.turns, directDrive: true }),
  };
}
