import { mountFieldInstrument, deltaDriveDimensions } from './textbook-field-instruments';
import { applyEarthScan } from './textbook-earth-scan';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, LIFT_MARGIN, type ModelMotion, type Vec3 } from './textbook-geometry';
import { DELTA_BASE, DELTA_MOUTH, DELTA_TOP, DELTA_WATER, deltaPoolPoint, deltaSandTopography, deltaSurfaceHeight, deltaBranchPoint, deltaMainPoint, evaluateDeltaDeposition } from './textbook-delta-model';

export function buildDeltaWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = 60 * s;
  const z0 = -LIFT_MARGIN - b.height * .62;
  const vertical = s * .46;
  const p = (u: number, v: number, h = 0): Vec3 => [u * b.width, h * vertical, z0 + v * depth];
  let state = evaluateDeltaDeposition(0), selected = 0, previous = -1;
  const point = (x: number, h: number, z: number): Vec3 => [x*s, h*s, z0+z*s];
  const parts = mountFieldInstrument(b, 'delta', s, point(0,0,0));
  const dimensions = deltaDriveDimensions();
  const rack = parts.get('rack')!, track = { start: point(dimensions.rackStart, 9.7, 64),
    end: point(dimensions.rackStart + dimensions.travel, 9.7, 64) };
  const control = { kind: 'phase-track', track, label: '推拉木柄，观察同一批泥沙搬运和落定' };
  for (const mesh of rack) {
    mesh.userData.modelInput = control;
    mesh.userData.deltaPart = 'metering-rack';
  }
  const spin = (name: string, x: number, h: number, z: number) => {
    const center=point(x,h,z), meshes=parts.get(name)!;
    for (const mesh of meshes) {
      mesh.geometry.translate(-center[0],-center[1],-center[2]); mesh.position.set(...center);
      mesh.userData.deltaPart = name;
    }
    return meshes;
  };
  const rotors = [...spin('pinion',65,2.77,64.4), ...spin('drum',49,11.5,-2.1)];
  const keys = [0,1,2].map(i => {
    const meshes=parts.get('key'+i)!;
    for(const mesh of meshes) {
      mesh.userData.modelInput={kind:'select',selection:i,label:'按瓷键观察'+['冲积平原','河口沉积','岸线推进'][i]};
      mesh.userData.smallPointTarget=true; mesh.userData.deltaPart='study-key-'+i;
    }
    return meshes;
  });
  for(const mesh of parts.get('plain')!) {
    mesh.userData.deltaPart='plain'; applyEarthScan(mesh.material,'turf',15*s);
  }
  // The water plane intersects the basin, the entrenched main river, and the
  // channels incised in the advancing sand. All wet areas share one surface.
  for (const water of parts.get('water')!) water.userData.deltaPart = 'basin';
  // The bed includes its underside and cut sides, not an expanding flat fan.
  const nx = 151, nz = 96, vertices: number[] = [], indices: number[] = [];
  const top: { index: number; u: number; v: number }[] = [], rim: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = .035 + .93 * i / nx, v = .325 + .65 * j / nz, index = vertices.length / 3;
    vertices.push(...p(u, v, deltaSurfaceHeight(state, u, v))); top.push({ index, u, v });
    if (i < nx && j < nz) indices.push(index, index + nx + 1, index + 1, index + 1, index + nx + 1, index + nx + 2);
  }
  for (let i = 0; i <= nx; i++) rim.push(i);
  for (let j = 1; j <= nz; j++) rim.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) rim.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) rim.push(j * (nx + 1));
  for (let i = 0; i < rim.length; i++) {
    const a = top[rim[i]], c = top[rim[(i + 1) % rim.length]], k = vertices.length / 3;
    vertices.push(...p(a.u, a.v, deltaSurfaceHeight(state, a.u, a.v)), ...p(c.u, c.v, deltaSurfaceHeight(state, c.u, c.v)),
      ...p(c.u, c.v, DELTA_BASE), ...p(a.u, a.v, DELTA_BASE));
    top.push({ index: k, u: a.u, v: a.v }, { index: k + 1, u: c.u, v: c.v });
    indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  }
  const bottom = vertices.length / 3;
  vertices.push(...p(.035, .325, DELTA_BASE), ...p(.965, .325, DELTA_BASE), ...p(.965, .975, DELTA_BASE), ...p(.035, .975, DELTA_BASE));
  indices.push(bottom, bottom + 2, bottom + 1, bottom, bottom + 3, bottom + 2);
  const bedGeometry = new T.BufferGeometry(), bedPositions = new T.Float32BufferAttribute(vertices, 3);
  bedGeometry.setAttribute('position', bedPositions); bedGeometry.setIndex(indices); bedGeometry.computeVertexNormals();
  const bed = b.mesh(bedGeometry, '#c8b48e', false); bed.userData.deltaPart = 'sediment-bed';
  const bedDetail = top.map(v=>deltaSandTopography(v.u,v.v));
  const proximalSand = new T.Color('#bd9763'), distalSilt = new T.Color('#aaa78a');
  const wetSilt = new T.Color('#696e60'), dampSand = new T.Color('#938263');
  // The mouth bars receive the coarser load first. Farther along each finger,
  // the finer sediment is greyer. Both tones are revealed by the moving bed.
  const deposits = top.map(({u,v}) => {
    const dx = u-DELTA_MOUTH[0], dv = v-DELTA_MOUTH[1];
    const reach = Math.hypot(dx,dv*.75), ray = Math.atan2(dx,Math.max(.008,dv));
    const wash = Math.sin(41*ray+5.2*reach+.72*Math.sin(55*reach))*.5
      + .36*Math.sin(155*reach+2.3*Math.sin(10*ray));
    const distal = T.MathUtils.smoothstep(reach,.065,.39);
    return proximalSand.clone().lerp(distalSilt,distal).multiplyScalar(1+.085*wash);
  });
  const surfaceColor = new T.Color();
  const bedColors = new T.Float32BufferAttribute(new Float32Array(vertices.length).fill(1), 3);
  bedGeometry.setAttribute('color', bedColors);
  bed.material = createSpecimenMaterial(b.pop, { color: '#ffffff', role: 'land' });
  applyEarthScan(bed.material, 'alluvium', 8*s);
  bed.material.vertexColors = true;
  bed.material.side = T.DoubleSide;
  const grainGeometry = new T.IcosahedronGeometry(1, 1);
  const grains = state.grains.map(grain => {
    const mesh = b.mesh(grainGeometry, grain.grainClass === 'coarse' ? '#80623b' : '#b28d58', false);
    // Each parcel is a closed convex solid. Its back faces are hidden, so a
    // second transparent face pass adds cost without changing its silhouette.
    mesh.material.side = T.FrontSide;
    mesh.scale.set(1.19*grain.radius*s,.78*grain.radius*s,.86*grain.radius*s);
    mesh.rotation.y=grain.id*.87;
    mesh.userData.deltaPart = 'sediment-grain'; mesh.userData.grainId = grain.id;
    mesh.userData.grainClass = grain.grainClass;
    return mesh;
  });
  const mainPath = (q: number): Vec3 => { const v = deltaMainPoint(q); return p(v[0], v[1], DELTA_WATER+.09); };
  const coarseLabel = b.label('较粗', p(.17, .57, 15), 9 * s, 5.1 * s);
  const fineLabel = b.label('较细', p(.84, .88, 13), 9 * s, 5.1 * s);
  let frontLines: Vec3[][] = [], frontPhase = -1;
  const shoreline = () => {
    // March only the actual solid's near-surface contour. This uses the same
    // heights as the terrain and avoids a decorative, separately moving coast.
    const lines: Vec3[][] = [], height = DELTA_WATER+.12;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const corners = [top[j * (nx + 1) + i], top[j * (nx + 1) + i + 1], top[(j + 1) * (nx + 1) + i + 1], top[(j + 1) * (nx + 1) + i]];
      const crosses: Vec3[] = [];
      for (let n = 0; n < 4; n++) {
        const a = corners[n], c = corners[(n + 1) % 4], ha = bedPositions.getY(a.index) / vertical, hc = bedPositions.getY(c.index) / vertical;
        if ((ha - height) * (hc - height) < 0) {
          const q = (height - ha) / (hc - ha); crosses.push(p(a.u + (c.u - a.u) * q, a.v + (c.v - a.v) * q, height + .04));
        }
      }
      if (crosses.length >= 2) lines.push(crosses.slice(0, 2));
    }
    return lines;
  };
  return { update(phase, selection) {
    selected = Math.max(0, Math.min(2, Math.round(selection))); if(phase!==previous) state = evaluateDeltaDeposition(phase);
    for (const mesh of rack) mesh.position.x=dimensions.travel * state.phase * s;
    for (const mesh of rotors) mesh.rotation.z= -dimensions.travel * state.phase / dimensions.gearRadius;
    keys.forEach((meshes,i)=>{ for(const mesh of meshes) mesh.position.y=(i===selected ? -.42 : 0)*s; });
    if (phase !== previous) {
      for (let i=0;i<top.length;i++) {
        const v=top[i], height = deltaSurfaceHeight(state, v.u, v.v, bedDetail[i]);
        bedPositions.setY(v.index, height * vertical);
        // Dark mud follows the actual water intersection, including channel
        // banks and the advancing edge. The highest sand ridges drain first.
        const exposed = T.MathUtils.smoothstep(height,DELTA_WATER-.16,DELTA_WATER+.64);
        const drained = T.MathUtils.smoothstep(height,DELTA_WATER+.24,DELTA_WATER+1.10);
        surfaceColor.copy(wetSilt).lerp(dampSand,exposed).lerp(deposits[i],drained);
        bedColors.setXYZ(v.index, surfaceColor.r, surfaceColor.g, surfaceColor.b);
      }
      bedColors.needsUpdate = true;
      bedPositions.needsUpdate = true; bedGeometry.computeVertexNormals(); bedGeometry.computeBoundingBox(); bedGeometry.computeBoundingSphere();
      previous = phase;
    }
    if (selected === 2) {
      if (frontPhase !== phase) { frontLines = shoreline(); frontPhase = phase; }
      for (const line of frontLines) b.contour(line, .44);
    }
    if (selected === 1) {
      state.branches.forEach((branch, i) => {
        if (branch.deposition <= .02) return;
        const route = Array.from({length:19},(_,j):Vec3 => {
          const v=deltaBranchPoint(i,Math.max(.02,branch.front-.09)*j/18);
          return p(v[0],v[1],DELTA_WATER+.12);
        });
        b.trace(route,phase*1.6,1,'flow',1,.62);
      });
    }
    if(selected===0) b.trace(Array.from({length:26},(_,i)=>mainPath(i/25)),phase*2.5,2,'flow',1,.58);
    state.grains.forEach((grain, i) => {
      // Deposited parcels are the same solids that travelled down the river;
      // never erase the material evidence when the default overview is used.
      const mesh = grains[i]; mesh.visible = true;
      const [u,h,v]=grain.position;
      const bedOffset=grain.deposition*(deltaSurfaceHeight(state,grain.target[0],grain.target[2])-DELTA_TOP);
      mesh.position.set(...(grain.stage==='waiting' ? point(...deltaPoolPoint(grain.id)) : p(u,v,h+bedOffset)));
      mesh.userData.sedimentStage = grain.stage; mesh.userData.deposition = grain.deposition;
      if (mesh.visible && grain.stage === 'settling') b.contour([
        p(grain.target[0], grain.target[2], 9.05), p(grain.position[0], grain.position[2], grain.position[1])], .28);
      if (selected === 1 && grain.stage!=='waiting' && grain.id % 3 === 0) b.outline(mesh, grain.stage === 'transport' ? .42 : .28);
    });
    coarseLabel.visible = selected === 1 && state.deposition > .2;
    fineLabel.visible = selected === 1 && state.grains.some(g => g.grainClass === 'fine' && (g.stage === 'settling' || g.stage === 'deposited'));
    if (coarseLabel.visible) {
      const v = deltaBranchPoint(0, .33); b.contour([p(.22, .57, 13), p(v[0], v[1], DELTA_TOP + 1)], .32);
    }
    if (fineLabel.visible) {
      const v = deltaBranchPoint(2, .84); b.contour([p(.80, .88, 11), p(v[0], v[1], DELTA_TOP + .8)], .32);
    }
  }, focusBounds: () => ({ min: point(-1.5,-4.7,-11.5), max: point(101.5,25,69.5) }),
  framingPoints: () => [[-1.5,-11.5],[-1.5,69.5],[101.5,-11.5],[101.5,69.5]].flatMap(([x,z])=>[point(x,-4.7,z), point(x,4.5,z)]).concat([point(41.4,25,-9.8),point(56.6,25,5.2),point(92,10.4,64)]),
  describe: () => ({
    kind: 'alluvial-plain-and-delta', phase: state.phase, stage: selected,
    shorelineAdvance: state.branches.map(branch => branch.front), sedimentSorting: 'coarse-near-fine-far',
    sedimentPool: grains.length, deposited: state.deposited, settling: state.settling, transported: state.transported,
    deposition: state.deposition, branches: state.branches,
    grains: state.grains.map(grain => ({ id: grain.id, grainClass: grain.grainClass, stage: grain.stage, position: grain.position, target: grain.target, pathSpeed: grain.pathSpeed })),
    bedVertices: bedPositions.count, fixedParticlePool: true, buffersStable: true,
    coastFromDeposits: true, measuredCoastline: false, universalDeltaShape: false, sedimentRelief: 'exaggerated-schematic',
  }) };
}
