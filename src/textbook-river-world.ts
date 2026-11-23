import { applyEarthScan } from './textbook-earth-scan';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, LIFT_MARGIN, type ModelMotion, type Vec3 } from './textbook-geometry';
import { sampleRiverBanks, evaluateRiverCutoff, RIVER_HEIGHT, type RiverPoint } from './textbook-river-model';
import { mountFieldInstrument, riverSculpture } from './textbook-field-instruments';

/** A cut-away floodplain, not a blue drawing on a slab. Permanent vertex
 * buffers are shared by the bank relief, waterline and flow paths. */
export function buildRiverWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, depth = b.width * .62, z0 = -LIFT_MARGIN - b.height * .88;
  const p = (u: number, v: number, h = 0): Vec3 => [u * b.width, h * s, z0 + v * depth];
  const { plateau, water: waterY, bed: bedY } = RIVER_HEIGHT;
  const sculpture = riverSculpture();
  const parts = mountFieldInstrument(b, 'river', s, [0, 0, z0]);
  const cursor = parts.get('cursor')!;
  const track = { start: p(.15, (62 + .66) / 62, 2), end: p(.85, (62 + .66) / 62, 2) };
  cursor.forEach(mesh => {
    mesh.userData.modelInput = { kind: 'phase-track', track, label: '拖动标尺游标，回看河曲、冲颈和牛轭湖' };
  });
  let state = evaluateRiverCutoff(0), previous = -1;
  const { columns: nx, rows: nz } = sculpture;
  const positions: number[] = [], indices: number[] = [];
  const bankDistances = new Float32Array((nx+1)*(nz+1));
  sampleRiverBanks(state,nx,nz,bankDistances);
  const gridIndex = (u:number,v:number) => Math.round((v-.045)*nz/.91)*(nx+1)+Math.round((u-.012)*nx/.976);
  const smooth = (value: number) => {
    const k = Math.max(0, Math.min(1, value));
    return k * k * (3 - 2 * k);
  };
  const heightAt = (index: number) => {
    const channel = bankDistances[index];
    if (channel <= 1) return bedY + (waterY - bedY) * smooth((channel - .55) / .45);
    return waterY + (plateau + sculpture.height[index] / 100 - waterY) * smooth((channel - 1) / .63);
  };
  const height = (u: number, v: number) => heightAt(gridIndex(u,v));
  const top: { index: number; u: number; v: number }[] = [], boundary: number[] = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const u = .012 + .976 * i / nx, v = .045 + .91 * j / nz, index = positions.length / 3;
    positions.push(...p(u, v, height(u, v))); top.push({ index, u, v });
    if (j < nz && i < nx) indices.push(index, index + nx + 1, index + 1, index + 1, index + nx + 1, index + nx + 2);
  }
  const waterSurface = new T.BufferGeometry();
  waterSurface.setAttribute('position', new T.Float32BufferAttribute(top.flatMap(({u,v}) => p(u, v, waterY + .015)), 3));
  waterSurface.setIndex(indices.slice());
  waterSurface.computeVertexNormals();
  const waterColours = new T.Float32BufferAttribute(new Float32Array(top.length * 3), 3);
  waterSurface.setAttribute('color', waterColours);
  for (let i = 0; i <= nx; i++) boundary.push(i);
  for (let j = 1; j <= nz; j++) boundary.push(j * (nx + 1) + nx);
  for (let i = nx - 1; i >= 0; i--) boundary.push(nz * (nx + 1) + i);
  for (let j = nz - 1; j > 0; j--) boundary.push(j * (nx + 1));
  const sideBands = ['#857761', '#b09a74', '#967b5b'].map(color => new T.Color(color));
  const section = new T.Color('#978060');
  const edgeVertices: { index: number; sample: number; layer: number }[] = [];
  const sideHeight = (sample: number, layer: number) => {
    const crest = heightAt(sample);
    if (layer === 0) return 0;
    if (layer === 1) return Math.min(crest * .34, 1.30 + .13 * Math.sin(sample * .21));
    if (layer === 2) return crest * .62 + .15 * Math.sin(sample * .16);
    return crest;
  };
  const edgeStart = positions.length / 3;
  for (let layer = 0; layer < sideBands.length; layer++) {
    for (let i = 0; i < boundary.length; i++) {
      const start = boundary[i], end = boundary[(i + 1) % boundary.length], k = positions.length / 3;
      for (const [sample, edge] of [[start,layer],[end,layer],[end,layer+1],[start,layer+1]]) {
        const { u, v } = top[sample];
        edgeVertices.push({ index: positions.length / 3, sample, layer: edge });
        positions.push(...p(u, v, sideHeight(sample,edge)));
      }
      indices.push(k, k + 2, k + 1, k, k + 3, k + 2);
    }
  }
  const k = positions.length / 3;
  positions.push(...p(.012, .045), ...p(.988, .045), ...p(.988, .955), ...p(.012, .955));
  indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
  const terrain = new T.BufferGeometry(); terrain.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  terrain.setIndex(indices); terrain.computeVertexNormals();
  const colours = new T.Float32BufferAttribute(new Float32Array(positions.length),3);
  const silt=new T.Color('#c6b28b'), dampBank=new T.Color('#967756'), grass=new T.Color('#9ca277');
  const moistMeadow=new T.Color('#6f825c'), pigment=new T.Color();
  for(let i=0;i<colours.count;i++) colours.setXYZ(i,section.r,section.g,section.b);
  sideBands.forEach((color, layer) => {
    for (let i = 0; i < boundary.length * 4; i++) {
      pigment.copy(color).multiplyScalar(.96 + .06 * Math.sin(i * .123));
      colours.setXYZ(edgeStart + layer * boundary.length * 4 + i, pigment.r, pigment.g, pigment.b);
    }
  });
  terrain.setAttribute('color',colours);
  const land = b.mesh(terrain, '#c5bea0', false);
  land.material = applyEarthScan(createSpecimenMaterial(b.pop, { color: '#ffffff', role: 'land' }), 'alluvium', 11 * s);
  land.material.side = T.DoubleSide;land.material.vertexColors=true;
  // Elevation alone reveals the river and lake. A common surface allows the
  // channels to join at the breach without overlapping independent strips.
  const water = b.mesh(waterSurface, '#ffffff', false, false, 'water');
  const waterMaterial = createSpecimenMaterial(b.pop, { color: '#ffffff', role: 'water' });
  waterMaterial.vertexColors = true;
  water.material = waterMaterial;
  water.renderOrder = 1;
  const streamColour = new T.Color('#3e7b86');
  const shallows = new T.Color('#74a3a0');
  const pondColour = new T.Color('#5e8779');
  const neck = b.label('河曲颈部', p(.5, .934, 9.6), 20 * s, 5.5 * s);
  const flood = b.label('洪水冲颈', p(.5, .934, 9.6), 20 * s, 5.5 * s);
  const lake = b.label('牛轭湖', p(.5, .4, 16), 19 * s, 5.5 * s);
  const neckInput = { kind: 'select', selection: 1, label: '回看洪水冲断河曲颈部的关键阶段' };
  neck.userData.modelInput = flood.userData.modelInput = neckInput;
  lake.userData.modelInput = { kind: 'select', selection: 2, label: '查看旧河道分离后形成的牛轭湖' };
  const neckHeight = height(.5,.817);
  const neckPin = b.sphere(p(.5, .817, neckHeight + .22), .93 * s, '#aa8249', false, [1.3, .5, 1]);
  neckPin.userData.modelInput = neckInput; neckPin.userData.smallPointTarget = true;
  neckPin.userData.riverRole = 'neck-observation-point';
  // Original banks remain as fine broken survey marks. Only the changing
  // neck is compared, keeping the fixed floodplain free of duplicate linework.
  const original = evaluateRiverCutoff(0);
  const originalBanks = [-1, 1].map(side => original.bend.map(([u, v], i, path) => {
    const a = path[Math.max(0, i - 1)], c = path[Math.min(path.length - 1, i + 1)];
    const dx = c[0] - a[0], dz = (c[1] - a[1]) * .62, length = Math.hypot(dx, dz) || 1;
    return p(u - dz / length * original.bendWidth / 2 * side,
      v + dx / length * original.bendWidth / 2 / .62 * side, plateau + .12);
  }));
  const flowPath = (path: readonly RiverPoint[]) => path.map(([u, v]) => p(u, v, waterY + .18));
  return { update(phase) {
    state = evaluateRiverCutoff(phase);
    if (phase !== previous) {
      const a = terrain.attributes.position;
      sampleRiverBanks(state,nx,nz,bankDistances);
      for (const {index,u,v} of top) {
        a.setY(index,heightAt(index)*s);
        const distance=bankDistances[index];
        const plantCover = Math.min(1, Math.max(0, (distance - 1.18) * 1.55));
        pigment.copy(dampBank).lerp(silt,Math.min(1,Math.max(0,(distance-.68)*1.6)));
        pigment.lerp(grass,plantCover);
        pigment.lerp(moistMeadow,Math.min(1,Math.max(0,(sculpture.pigment[index]-83)/134))*.5*plantCover);
        pigment.multiplyScalar(1+.027*Math.sin(u*39+v*13)*Math.sin(v*53-u*5));
        colours.setXYZ(index,pigment.r,pigment.g,pigment.b);
        pigment.copy(streamColour).lerp(shallows, smooth((distance - .4) / .7));
        if (v < .695 && state.separation > 0) pigment.lerp(pondColour, state.separation * .68);
        waterColours.setXYZ(index,pigment.r,pigment.g,pigment.b);
      }
      for (const edge of edgeVertices) a.setY(edge.index,sideHeight(edge.sample,edge.layer)*s);
      colours.needsUpdate=true;
      waterColours.needsUpdate=true;
      a.needsUpdate = true; terrain.computeVertexNormals(); terrain.computeBoundingBox(); terrain.computeBoundingSphere();
      neckPin.position.y = (height(.5,.817) - neckHeight) * s;
      for (const mesh of cursor) mesh.position.x = 70*s*state.phase;
      previous = phase;
    }
    const outline = boundary.map(i => { const q = top[i]; return p(q.u, q.v, height(q.u, q.v) + .04); });
    b.contour([...outline, outline[0]], .55);
    for (const [u, v] of [[.012, .955], [.988, .955], [.012, .045]]) b.contour([p(u, v), p(u, v, height(u, v))], .5);
    if (state.migration > .08) for (const bank of originalBanks) {
      for (let i = 0; i < 16; i += 4) b.contour(bank.slice(i, i + 3), .20);
      for (let i = 84; i < 100; i += 4) b.contour(bank.slice(i, i + 3), .20);
    }
    neckPin.visible = state.stage < 2; if (neckPin.visible) b.outline(neckPin, neckPin.userData.modelHovered ? .7 : .38);
    neck.visible = state.stage === 0; flood.visible = state.stage === 1; lake.visible = state.stage === 2;
    b.trace(flowPath(state.upstream), phase * 4, 2);
    b.trace(flowPath(state.downstream), phase * 4 + .2, 2);
    if (state.bendFlow > .02) b.trace(flowPath(state.bend), phase * 4, 5, 'flow', 1, state.bendFlow);
    if (state.shortcutFlow > .02) b.trace(flowPath(state.shortcut), phase * 4, 1, 'flow', 1, state.shortcutFlow);
    if (state.stage < 2) b.contour([p(.5, .906, 8.6), p(.5, .817, height(.5,.817) + .23)], .3);
    else b.contour([p(.5, .4, 13), p(.5, .27, waterY + .2)], .3);
  }, focusBounds: () => ({ min: p(-.02, -.04, -3), max: p(1.02, 1.065, 25) }),
  describe: () => ({ kind: 'meander-cutoff', stage: state.stage, phase: state.phase,
    breach: state.breach, separation: state.separation, closedOxbow: state.isolated,
    lakeFlow: state.bendFlow, shortcutFlow: state.shortcutFlow,
    channelDepth: (plateau - bedY) * s, waterSurface: waterY * s,
    lakeEndpoints: [state.bend[0], state.bend.at(-1)], bufferVertices: terrain.attributes.position.count,
    geometryGap: state.isolated, buffersStable: true, erosionRate: 'schematic-flood-triggered-possible-cutoff' }) };
}
