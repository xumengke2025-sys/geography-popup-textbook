import { mountLoessSection } from './textbook-loess-section';
import { applyEarthScan } from './textbook-earth-scan';
import { addSlopeComparators } from './textbook-slope-comparator';
import { createInstrumentParts, turnedShaftGeometry } from './textbook-instrument-parts';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import { SLOPE_BOUNDARY_INDICES, SLOPE_CONSTRAINTS, SLOPE_CONTOURS, SLOPE_GRID, SLOPE_TOP_INDICES, SLOPE_LAYOUT,
  SLOPE_REFERENCE, SLOPE_SPOTS, SLOPE_STOPS, evaluateSlopeRelief, slopeDisplayY,
  slopeReliefMesh, type SlopePoint } from './textbook-slope-model';

/** One closed loess relief is raised from one fixed heightfield. The phase
 * changes display height only; it never erodes or generates the landform. */
export function buildSlopeWorld(b: TextbookGeometry): ModelMotion {
  const scale = b.width / 100, back = -LIFT_MARGIN - 78 * scale, rise = 42 * scale;
  const p = ([x, y, z]: readonly number[]): Vec3 => [x * scale, y * scale, back + z * scale];
  b.root.position.set(0, rise, -8 * scale);
  const role = (mesh: any, name: string) => { mesh.userData.slopeRole = name; return mesh; };
  const materials = new Map<string, any>();
  const paper = (color: string, hatch = .065) => {
    const key = `${color}:${hatch}`;
    if (!materials.has(key)) {
      const material = createSpecimenMaterial(b.pop, { color, ink: '#74634b', spacing: 2.9, hatch, shade: .1, seed: 422 + materials.size });
      material.side = T.DoubleSide; materials.set(key, material);
    }
    return materials.get(key);
  };
  const solid = (geometry: any, color: string, name: string, hatch = .065) => {
    const mesh = role(b.mesh(geometry, color, false), name); mesh.material = paper(color, hatch); return mesh;
  };
  const select = (mesh: any, selection: number, label: string) => {
    mesh.userData.modelInput = { kind: 'select', selection, label }; return mesh;
  };
  const parts=createInstrumentParts(b);
  const bed=(x:number,y:number,z:number,ex:number,ey:number,ez:number,material:'wood'|'brass'|'steel'|'ivory',bevel=.18)=>
    parts.plate(p([x,y,z]),p([ex,ey,ez]),material,bevel*scale);
  bed(-2,-4.4,-2,102,-.42,96,'wood',.63);
  bed(-1.65,-.53,-1.65,101.65,-.15,95.65,'brass',.13);
  bed(-1.2,-.15,-1.2,101.2,.11,95.2,'wood',.12);
  for(const x of [2.6,97.4])for(const z of [3,90])
    parts.column(p([x,-8.5,z]),p([x,-4.38,z]),2.14*scale,'brass');
  for(const x of [0,100])
    parts.shaft(p([x,0,0]),p([x,0,76.33]),.31*scale,'brass');
  parts.fasteners([p([.2,.18,78]),p([99.8,.18,78]),p([.2,.18,94]),p([99.8,.18,94])],[0,1,0],.56*scale);
  const comparators=addSlopeComparators(b,p,scale);
  const raw = slopeReliefMesh(0), positions: number[] = [];
  for (let i = 0; i < raw.positions.length; i += 3) positions.push(...p(raw.positions.slice(i, i + 3)));
  const terrainGeometry = new T.BufferGeometry();
  terrainGeometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  // The detailed cut walls meet the same top and bottom loops as the relief.
  terrainGeometry.setIndex(raw.indices.slice(0,2*SLOPE_TOP_INDICES.length)); terrainGeometry.computeVertexNormals();
  const updateCut = mountLoessSection(b,p,scale);
  const terrain = select(solid(terrainGeometry, '#cbb98f', 'closed-contour-constrained-relief', .12), 1, '抬升同一地形，查看中央沟谷与右侧支沟');
  terrain.material=applyEarthScan(createSpecimenMaterial(b.pop,{role:'land',color:'#c2a47c'}),'loam',8.5*scale);
  const earthTones:number[]=[];
  for(let side=0;side<2;side++)for(const node of SLOPE_GRID){
    const weather=Math.max(0,Math.min(1,(node.elevationM-779)/101));
    const fleck=.035*Math.sin(node.x*.18+node.z*.085)+.03*Math.cos(node.z*.21-node.x*.13);
    const silt=Math.exp(-(((node.elevationM-786)/13)**2));
    earthTones.push(.91+.12*weather+fleck-.03*silt,.84+.17*weather+fleck+.03*silt,.77+.17*weather+fleck+.09*silt);
  }
  terrainGeometry.setAttribute('color',new T.Float32BufferAttribute(earthTones,3));terrain.material.vertexColors=true;
  terrain.userData.surveyedDEM = false;
  const positionAttribute = terrainGeometry.attributes.position;
  const topVertexCount = raw.topVertexCount;

  const markerGeometry = new T.CylinderGeometry(1.15 * scale, 1.15 * scale, .6 * scale, 16);
  const markers = SLOPE_SPOTS.map(spot => {
    const mesh = select(solid(markerGeometry, '#9b6947', 'spot-height-marker', .04), 2, `${spot.name}，海拔${spot.elevationM.toFixed(1)}米；比较甲乙高差`);
    mesh.userData.slopePointId = spot.id; mesh.userData.smallPointTarget = true; return mesh;
  });
  const spotLabels = SLOPE_SPOTS.map(spot => {
    const label = role(b.label(`${spot.name} ${spot.elevationM.toFixed(1)}m`, p([spot.x, 7.8, spot.z]), spot.labelWidth * scale, 9.6 * scale), 'spot-height-label');
    label.userData.slopePointId = spot.id;
    return select(label, 2, `${spot.name}，比较甲乙两点高差`);
  });

  // A separate short ruler magnifies only the 6.4 m difference. Its base is
  // Jia's elevation, not sea level; it is not a second relief or slope angle.
  const c = SLOPE_LAYOUT.comparison;
  const comparisonMeshes: any[] = [];
  bed(100,-3.9,c.z-5.6,128,-.25,c.z+5.6,'wood',.4);
  parts.column(p([c.rulerX,-.25,c.z]),p([c.rulerX,28,c.z]),1.36*scale,'brass');
  parts.shaft(p([c.x,2,c.z-.12]),p([c.x,c.yiY+1.2,c.z-.12]),.25*scale,'steel');
  for(const h of [c.jiaY,c.yiY]){
    const bar=parts.shaft(p([c.x-.8,h,c.z+.18]),p([c.rulerX+1.5,h,c.z+.18]),.32*scale,'brass');
    comparisonMeshes.push(bar);
  }
  const rulerGeometry = new T.BoxGeometry(.28 * scale, (c.yiY - c.jiaY) * scale, .65 * scale);
  rulerGeometry.translate(...p([c.rulerX, (c.jiaY + c.yiY) / 2, c.z]));
  const ruler = select(solid(rulerGeometry, '#aa8051', 'relative-height-ruler', .035), 2, '乙比甲高6.4米；局部高差放大');
  ruler.material=createSpecimenMaterial(b.pop,{role:'brass',color:'#b28b4c'});
  comparisonMeshes.push(ruler);
  const comparisonDots = [['甲', c.jiaY], ['乙', c.yiY]].map(([name, y]) => {
    const height = Number(y), dot = solid(new T.SphereGeometry(.62 * scale, 12, 8), '#9b6947', 'comparison-endpoint', .035);
    dot.position.set(...p([c.x, height, c.z]));
    dot.userData.slopePointId = name === '甲' ? 'jia' : 'yi';
    select(dot, 2, `${name}的高差对照位置`); dot.userData.smallPointTarget = true;
    const label = role(b.label(String(name), p([c.x - 5.5, height + .8, c.z]), 10 * scale, 9.6 * scale), 'comparison-label');
    comparisonMeshes.push(dot, label); return dot;
  });
  const differenceLabel = role(b.label('6.4m', p(c.label), 30 * scale, 9.6 * scale), 'difference-label');
  const comparisonTitle = role(b.label('高差放大', p([124,-4.25,48]), 45 * scale, 9.6 * scale), 'comparison-title');
  comparisonMeshes.push(differenceLabel, comparisonTitle);

  const track: PhaseTrack = { start: p(SLOPE_LAYOUT.track.start), end: p(SLOPE_LAYOUT.track.end) };
  const rail=role(parts.shaft(p([12,1,91]),p([88,1,91]),.38*scale,'steel'),'phase-rail');
  parts.shaft(p([12,1,89.45]),p([88,1,89.45]),.27*scale,'steel');
  for(const x of [12,88])parts.bearing(p([x,1,91]),[1,0,0],.85*scale,1.9*scale);
  const gripInput={kind:'phase-track',track,label:'推拉木柄，在平面与抬升地形间连续观测'};
  rail.userData.modelInput=gripInput;
  const toolFinish = (geometry:any,material:'brass'|'wood',color:string,name:string)=>{
    const mesh=role(b.mesh(geometry,color,false),name);
    mesh.material=createSpecimenMaterial(b.pop,{role:material,color});
    mesh.userData.modelInput=gripInput;mesh.userData.smallPointTarget=true;return mesh;
  };
  const handle=toolFinish(turnedShaftGeometry([0,0,0],[0,0,4.2*scale],
    [[1.18*scale,0],[1.25*scale,.09],[.86*scale,.2],[.96*scale,.51],[1.63*scale,.7],[1.72*scale,.88],[1.38*scale,1]]),'wood','#734632','phase-handle');
  const collar=toolFinish(turnedShaftGeometry([-1.7*scale,0,0],[1.7*scale,0,0],
    [[.76*scale,0],[1.03*scale,.09],[1.03*scale,.22],[.8*scale,.28],[.8*scale,.72],[1.03*scale,.78],[1.03*scale,.91],[.76*scale,1]]),'brass','#ad854b','phase-bearing');
  const keyBases=SLOPE_STOPS.map((stop,i)=>{
    const [x,y,z]=SLOPE_LAYOUT.labels[i];
    const plate=select(bed(x-6.7,y-1.3,z-1.6,x+6.7,y-.35,z+.35,'brass'),i,stop.label);
    const stem=parts.shaft(p([x,-3.8,92]),p([x,y-.85,z-.3]),.66*scale,'steel');
    return {plate,stem};
  });
  const labels = SLOPE_STOPS.map((stop, index) => {
    const [x,y,z]=SLOPE_LAYOUT.labels[index];
    return select(role(b.label(stop.label,p([x,y-.36,z+3.8]),26*scale,9.6*scale),'process-label'),index,stop.label);
  });

  let state = evaluateSlopeRelief(0), lastPhase = -1;
  const fixedMeshCount = b.meshes.length, buffers = b.meshes.map(mesh => mesh.geometry.attributes.position.array);
  const indices = b.meshes.map(mesh => mesh.geometry.index?.array);
  const motion: ModelMotion = {
    update(phase, _selection, _dt, _reduced) {
      state = evaluateSlopeRelief(phase);
      if(state.phase!==lastPhase){
      for (let i = 0; i < topVertexCount; i++) positionAttribute.setY(i, slopeDisplayY(SLOPE_GRID[i].elevationM, state.phase) * scale);
      positionAttribute.needsUpdate = true;
      terrainGeometry.computeVertexNormals(); terrainGeometry.computeBoundingSphere();
      updateCut(state.phase);comparators.update(state.phase);lastPhase=state.phase;
      }
      state.points.forEach((spot, index) => {
        markers[index].position.set(...p([spot.x, spot.position[1] + .3, spot.z]));
        spotLabels[index].position.set(...p([spot.x, spot.position[1] + 5.8, spot.z]));
        b.outline(markers[index], .44);
      });
      for (const contourLine of SLOPE_CONTOURS) for (const path of contourLine.paths) {
        b.contour(path.map(([x, elevationM, z]) => p([x, slopeDisplayY(elevationM, state.phase) + .1, z])), contourLine.sourceLabelRead ? .46 : .22);
      }
      const boundary = SLOPE_BOUNDARY_INDICES.map(index => {
        const point = SLOPE_GRID[index]; return p([point.x, slopeDisplayY(point.elevationM, state.phase) + .07, point.z]);
      });
      b.contour([...boundary, boundary[0]], .55);
      for (const index of [0, Math.floor(SLOPE_BOUNDARY_INDICES.length / 4), Math.floor(SLOPE_BOUNDARY_INDICES.length / 2), Math.floor(SLOPE_BOUNDARY_INDICES.length * .75)]) {
        const point = SLOPE_GRID[SLOPE_BOUNDARY_INDICES[index]];
        b.contour([p([point.x, 0, point.z]), p([point.x, slopeDisplayY(point.elevationM, state.phase), point.z])], .33);
      }
      comparisonMeshes.forEach(mesh => { mesh.visible = state.comparison.visible; });
      if (state.comparison.visible) {
        for (const y of [c.jiaY, c.yiY]) b.contour([[c.x, y, c.z], [c.rulerX + 2, y, c.z]].map(p), .5);
        b.outline(ruler, .4);
      }
      handle.position.set(...phaseTrackPoint(state.phase, track));collar.position.copy(handle.position);
      labels.forEach((label, index) => { const pressed=index===state.stageIndex;label.userData.slopeActive=pressed;
        keyBases[index].plate.position.y=pressed?-.35*scale:0; });
    },
    focusBounds: () => ({ min: p([-6, -14, -4]), max: p([155, 45, 104]) }),
    describe: () => {
      b.root.updateWorldMatrix(true, true);
      const world = (point: Vec3): Vec3 => b.v(point).applyMatrix4(b.root.matrixWorld).toArray() as Vec3;
      const meshWorld = (mesh: any): Vec3 => mesh.getWorldPosition(new T.Vector3()).toArray() as Vec3;
      return { kind: 'textbook-contour-relief', source: SLOPE_REFERENCE, state,
        phase: state.phase, stage: state.stage, stageIndex: state.stageIndex, selection: state.selection,
        activeStop: state.activeStop, caption: state.caption, phaseMeaning: state.phaseMeaning,
        landformEvolutionSimulated: false, surveyedDEM: false, originalPagePreserved: true,
        sourceConstraints: SLOPE_CONSTRAINTS.map(constraint => ({ id: constraint.id, kind: constraint.kind, points: constraint.points })),
        sourceSpotHeightsM: SLOPE_REFERENCE.checkedElevationsM,
        relativeHeightM: 6.4, higherSpotId: 'yi', sourceContourIntervalM: null,
        mechanicalProfileComparator:comparators.describe(), contoursFromSameTriangles: true, auxiliaryContourIntervalM: 10, verticalExaggeration: true,
        nodeStops: SLOPE_STOPS, nodeWorld: labels.map((mesh, selection) => ({ selection, point: meshWorld(mesh) })),
        handleWorld: meshWorld(handle), phaseTrackWorld: { start: world(track.start), end: world(track.end) },
        spotWorld: markers.map((mesh, index) => ({ id: state.points[index].id, elevationM: state.points[index].elevationM,
          point: meshWorld(mesh), surfacePoint: world(p(state.points[index].position)) })),
        comparisonWorld: { visible: state.comparison.visible, verticallyMagnified: true, sameReference: 'jia-879.0m',
          jia: meshWorld(comparisonDots[0]), yi: meshWorld(comparisonDots[1]), differenceM: 6.4 },
        terrainWorld: { origin: meshWorld(terrain), topVertexCount, closed: true,
          fixedHeightField: true, spotVertexWorld: SLOPE_SPOTS.map(spot => {
            const index = SLOPE_GRID.findIndex(point => point.x === spot.x && point.z === spot.z);
            const point: Vec3 = [positionAttribute.getX(index), positionAttribute.getY(index), positionAttribute.getZ(index)];
            return { id: spot.id, index, point: world(point) };
          }) },
        meshRoles: b.meshes.map(mesh => ({ role: mesh.userData.slopeRole, pointId: mesh.userData.slopePointId, point: meshWorld(mesh), visible: mesh.visible })),
        fixedMeshCount, geometryBuffersReused: b.meshes.length === fixedMeshCount && b.meshes.every((mesh, index) =>
          mesh.geometry.attributes.position.array === buffers[index] && mesh.geometry.index?.array === indices[index]),
        directInteraction: 'spot-height-click-and-phase-track', elevatedAbovePage: rise,
      };
    },
  };
  motion.update(0, 0, 0, true); return motion;
}
