import { THREE as T } from './reference/engine.js';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { evaluateSeismicParticles } from './textbook-ground-process-model';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';

/** An open two-channel wave bench. The carriage and couplings explain a
 * classroom demonstration, not a mechanical cause of earthquakes. The pure
 * textbook model owns every displacement, material condition and particle id. */
export function buildSeismicInstrumentWorld(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100, z = -LIFT_MARGIN - b.height * .45;
  const p = (x: number, y: number, d = 0): Vec3 => [x * s, y * s, z + d * s];
  const finish = { wood: '#584334', brass: '#b29153', steel: '#a5afaa', enamel: '#30483e', ivory: '#e6dfcd', water: '#a4c0bd' };
  const part = (g: any, role: keyof typeof finish, name: string, parent: any = b.root) => {
    const m = b.mesh(g, finish[role], false, true, role as SolidMaterialRole);
    parent.add(m); m.name = name; m.userData.seismicInstrumentPart = name; return m;
  };
  const plate = (a: Vec3, c: Vec3, role: keyof typeof finish, name: string, bevel = .13) =>
    part(chamferedPlateGeometry(p(...a), p(...c), bevel * s), role, name);
  const shaft = (a: Vec3, c: Vec3, radius: number, role: keyof typeof finish, name: string) =>
    part(turnedShaftGeometry(p(...a), p(...c), [[radius * s, 0], [radius * s, 1]]), role, name);
  const turned = (a: Vec3, c: Vec3, profile: [number, number][], role: keyof typeof finish, name: string) =>
    part(turnedShaftGeometry(p(...a), p(...c), profile.map(([r, t]) => [r * s, t])), role, name);
  const fasten = (points: Vec3[]) => {
    const heads = points.map(([x,y,d]) => turnedShaftGeometry(p(x,y-.1,d),p(x,y+.13,d),[[.4*s,0],[.4*s,.8],[.32*s,1]]));
    const slots = points.map(([x,y,d]) => chamferedPlateGeometry(p(x-.24,y+.13,d-.035),p(x+.24,y+.15,d+.035),0));
    part(mergeInstrumentGeometry(heads),'brass','flush-fastener-heads');
    part(mergeInstrumentGeometry(slots),'steel','fastener-slots');
  };

  // Narrow open runners carry the end standards. There is no solid block
  // beneath the air gap or opaque vessel behind the vibrating particles.
  for (const depth of [-6, 9]) {
    plate([0,-1.8,depth-1.8],[98,-.6,depth+1.8],'wood','open-timber-runner',.24);
    plate([.4,-.6,depth-1.35],[97.6,-.36,depth+1.35],'brass','runner-edge-inlay',.06);
    plate([.8,-.36,depth-1.1],[97.2,.18,depth+1.1],'enamel','runner-upper-rail',.09);
  }
  for (const x of [3, 94]) {
    plate([x-2.4,.18,-7.6],[x+2.4,1.5,10.6],'enamel','end-standard-foot',.24);
    turned([x,1.5,-4],[x,35.5,-4],[[1.15,0],[1.15,.09],[.58,.16],[.58,.92],[.95,.96],[.95,1]],'steel','stepped-end-standard');
    fasten([[x-1.3,1.55,-5.6],[x+1.3,1.55,8.6]]);
    for (const height of [14]) {
      shaft([x,height,-4],[x,height,0],.48,'steel','channel-bearing-neck');
      turned([x-1.1,height,0],[x+1.1,height,0],[[1.12,0],[1.12,.18],[.79,.3],[.79,.7],[1.12,.82],[1.12,1]],'brass','channel-end-bearing');
    }
  }
  // One uninterrupted guide for longitudinal motion. Transverse motion has
  // individual vertical guides behind its observation plane, never an x rail
  // through the oscillating beads.
  shaft([2,14,0],[95,14,0],.25,'steel','longitudinal-guide');
  const start = evaluateSeismicParticles(0), heights = [14,29];
  const guideGeometries = start.particles.map(q => turnedShaftGeometry(p(q.restX,24.7,-3),p(q.restX,33.3,-3),[[.13*s,0],[.13*s,1]]));
  part(mergeInstrumentGeometry(guideGeometries),'steel','transverse-individual-guides');
  shaft([3,14,-4],[94,14,-4],.25,'steel','rear-guide-support');
  for(const height of [24.7,33.3]){
    shaft([3,height,-3],[94,height,-3],.19,'steel','transverse-guide-crossrail');
    for(const x of [3,94]){
      shaft([x,height,-4],[x,height,-3],.36,'steel','crossrail-end-coupling');
      turned([x,height-.65,-4],[x,height+.65,-4],[[.82,0],[.82,.18],[.67,.3],[.67,.7],[.82,.82],[.82,1]],'brass','crossrail-standard-collar');
    }
  }

  // Recessed enamel/ivory material keys sit low on the runners. Their boundary
  // is an observational reference, not a wall across which P waves stop.
  const leftKey = plate([12,.2,8],[48,.65,10.6],'ivory','solid-material-key');
  const rightKey = plate([51,.2,8],[88,.65,10.6],'water','right-material-key');
  const label = (text:string,at:Vec3,w:number,h=4.8) => b.label(text,p(...at),w*s,h*s);
  label('固体',[29,3.5,15],14);
  const liquidLabel = label('液体',[69,3.5,15],14), solidLabel = label('固体',[69,3.5,15],14);
  label('P 波',[5,18.6,6],10,4.5); label('S 波',[5,36.1,6],10,4.5);
  // The material-selector lever rotates at its actual low pivot and toggles
  // the existing two conditions. It never adds a third medium or new physics.
  turned([91,.2,10],[91,2.5,10],[[1.8,0],[1.8,.2],[1.1,.4],[1.1,1]],'brass','material-selector-socket');
  const selector = new T.Group(); selector.position.set(...p(91,2.5,10)); b.root.add(selector);
  const lever = part(turnedShaftGeometry([0,0,0],[0,3.7*s,0],[[.28*s,0],[.28*s,1]]),'steel','material-selector-lever',selector);
  const leverTip = part(new T.SphereGeometry(.8*s,16,10),'brass','material-selector-grip',selector); leverTip.position.y=3.7*s;
  const mediumInput = {kind:'select',selection:1,toggleTo:0,label:'切换右侧固体与液体'};
  [rightKey,liquidLabel,solidLabel,lever,leverTip].forEach(m=>{m.userData.modelInput=mediumInput;});

  // The first bead and its crosshead share exactly the same displacement.
  // A telescoping cosmetic rod cannot silently invent a different waveform.
  const drivers = heights.map((height,row) => {
    if(row) {
      shaft([7,23,-1],[7,35,-1],.36,'steel','transverse-drive-guide');
      for(const y of [23,35]){
        shaft([3,y,-4],[7,y,-1],.4,'steel','transverse-drive-seat-arm');
        plate([5.4,y-.55,-2.6],[8.6,y+.55,.5],'enamel','transverse-drive-seat');
      }
    }
    const moving = new T.Group(); b.root.add(moving);
    const crosshead = part(chamferedPlateGeometry(p(6,height-1.2,-1.3),p(9,height+1.2,1.3),.2*s),'enamel',row?'transverse-crosshead':'longitudinal-crosshead',moving);
    const drive = part(turnedShaftGeometry(p(9,height,0),p(14,height,0),[[.38*s,0],[.38*s,1]]),'steel','demonstration-drive-link',moving);
    [crosshead,drive].forEach(m=>{m.userData.modelInput={kind:'replay',label:row?'重看横向振动':'重看纵向振动'};});
    return moving;
  });

  const rows = heights.map((height,row) => start.particles.map(q => {
    const g = row ? new T.SphereGeometry(.88*s,18,12)
      : turnedShaftGeometry([-.9*s,0,0],[.9*s,0,0],[[.77*s,0],[1.03*s,.15],[1.03*s,.3],[.86*s,.42],[.86*s,.65],[1.03*s,.75],[1.03*s,.9],[.77*s,1]]);
    const bead = part(g,row?'enamel':'brass',row?'shear-particle':'compression-particle');
    bead.userData.seismicParticleId=q.id; bead.userData.seismicWave=row?'S':'P';
    bead.userData.seismicEquilibrium=p(q.restX,height);
    bead.userData.modelInput={kind:'inspect',target:`particle-${q.id}`,label:`追踪第${q.id+1}个质点：振动位置与平衡位置`};
    if(row) {
      const carrier = mergeInstrumentGeometry([
        turnedShaftGeometry([0,0,-3*s],[0,0,0],[[.25*s,0],[.25*s,1]]),
        turnedShaftGeometry([0,-.65*s,-3*s],[0,.65*s,-3*s],[[.43*s,0],[.43*s,.18],[.32*s,.3],[.32*s,.7],[.43*s,.82],[.43*s,1]]),
      ]);
      part(carrier,'steel','transverse-slider-and-carrier',bead);
    }
    return bead;
  }));

  // Stable tube buffers join the same neighbouring identities. Compressional
  // coils remain continuous across the boundary; shear links disappear in
  // the liquid region because they stand for shear response, not material loss.
  const segments=16,sides=5,bonds=19;
  const tube = () => {
    const g=new T.BufferGeometry(), vertices=new Float32Array(bonds*(segments+1)*sides*3), indices:number[]=[];
    for(let bond=0;bond<bonds;bond++)for(let j=0;j<segments;j++)for(let k=0;k<sides;k++){
      const a=bond*(segments+1)*sides+j*sides+k,c=bond*(segments+1)*sides+j*sides+(k+1)%sides;
      indices.push(a,c,a+sides,c,c+sides,a+sides);
    }
    g.setAttribute('position',new T.BufferAttribute(vertices,3));g.setIndex(indices);return g;
  };
  const couplings=heights.map((_,row)=>part(tube(),row?'steel':'brass',row?'shear-couplings':'compression-coils'));
  const updateCouplings=(row:number,liquid:boolean)=>{
    const attr=couplings[row].geometry.attributes.position;
    for(let bond=0;bond<bonds;bond++){
      const a=rows[row][bond].position,c=rows[row][bond+1].position,axis=c.clone().sub(a).normalize();
      const n=new T.Vector3(0,0,1),v=new T.Vector3().crossVectors(axis,n).normalize();
      const absent=row===1&&liquid&&bond>=9;
      for(let j=0;j<=segments;j++){
        const u=j/segments,angle=u*Math.PI*4,radius=(row?.16:.42)*s*Math.sin(Math.PI*u);
        const center=a.clone().lerp(c,u).addScaledVector(n,Math.cos(angle)*radius).addScaledVector(v,Math.sin(angle)*radius);
        for(let k=0;k<sides;k++){
          const q=absent?a:center.clone().addScaledVector(n,Math.cos(k/sides*Math.PI*2)*.065*s).addScaledVector(v,Math.sin(k/sides*Math.PI*2)*.065*s);
          attr.setXYZ(bond*(segments+1)*sides+j*sides+k,q.x,q.y,q.z);
        }
      }
    }
    attr.needsUpdate=true;couplings[row].geometry.computeVertexNormals();couplings[row].geometry.computeBoundingSphere();
  };
  // Physical phase rail with a true native scrub target and a quiet, unitless
  // scale. Its position belongs to observation progress, not wave travel.
  const track:PhaseTrack={start:p(16,-5.5,18),end:p(84,-5.5,18)};
  shaft([14,-5.5,17.3],[86,-5.5,17.3],.22,'steel','phase-guide-back');
  shaft([14,-5.5,18.7],[86,-5.5,18.7],.22,'steel','phase-guide-front');
  for(const x of [13.5,86.5]){
    plate([x-.9,-6.5,16],[x+.9,-4.6,20],'enamel','phase-end-bearing');
    shaft([x,-5,17],[x,.1,9],.25,'steel','phase-rail-support');
  }
  const handle=part(turnedShaftGeometry([0,-.6*s,0],[0,.8*s,0],[[1.45*s,0],[1.8*s,.18],[1.8*s,.7],[1.55*s,1]]),'brass','phase-handle');
  handle.userData.modelInput={kind:'phase-track',track,label:'拖动滑钮，对比纵波与横波的同一振动相位'};
  const tracking=heights.map(()=>part(new T.TorusGeometry(1.35*s,.12*s,6,36),'brass','tracked-particle-ring'));
  let state=start,tracked=6;
  const update=(phase:number,selection:number)=>{
    state=evaluateSeismicParticles(phase,selection);
    liquidLabel.visible=state.liquid;solidLabel.visible=!state.liquid;
    rightKey.material=b.materialFor(state.liquid?'water':'ivory',state.liquid?finish.water:finish.ivory);
    selector.rotation.z=state.liquid?-.45:.45;
    rows.forEach((row,kind)=>row.forEach((mesh,i)=>{
      const q=state.particles[i];mesh.position.set(...p(q.restX+(kind?0:q.pDx),heights[kind]+(kind?q.sDy:0)));
      mesh.material=b.materialFor(kind&&!q.transmittedS?'steel':kind?'enamel':'brass',kind&&!q.transmittedS?'#bcc7c1':kind?finish.enamel:finish.brass);
    }));
    const first=state.particles[0];drivers[0].position.x=first.pDx*s;drivers[1].position.y=first.sDy*s;
    updateCouplings(0,state.liquid);updateCouplings(1,state.liquid);
    handle.position.set(...phaseTrackPoint(state.phase,track));
    heights.forEach((height,row)=>{
      const bead=rows[row][tracked],rest=p(state.particles[tracked].restX,height);
      tracking[row].position.copy(bead.position);tracking[row].position.z+=.2*s;
      b.contour([[rest[0]-.65*s,rest[1],rest[2]+1.1*s],[rest[0]+.65*s,rest[1],rest[2]+1.1*s]],.45);
      b.contour([[rest[0],rest[1]-.65*s,rest[2]+1.1*s],[rest[0],rest[1]+.65*s,rest[2]+1.1*s]],.45);
      b.contour([rest,bead.position.toArray()],.38);
      b.trace([p(15,height+5.7,3),p(row&&state.liquid?47:86,height+5.7,3)],state.phase,2,'flow',1,.65);
    });
    // Discontinuous reference ticks are behind the medium, never a barrier.
    for(let y=6;y<38;y+=4)b.contour([p(49.15,y,-3.8),p(49.15,y+1.5,-3.8)],.26);
    b.contour([track.start,track.end],.2);
    for(let i=0;i<=12;i++){
      const at=phaseTrackPoint(i/12,track);b.contour([[at[0],at[1]-.32*s,at[2]+.3*s],[at[0],at[1]+.32*s,at[2]+.3*s]],.26);
    }
  };
  return {update,
    inspect(target){const match=/^particle-(\d+)$/.exec(target);if(match)tracked=Math.max(0,Math.min(19,+match[1]));},
    inspectTargets:()=>[{target:'particle-6',label:'追踪固体质点'},{target:'particle-14',label:'追踪右侧介质质点'}],
    focusBounds:()=>({min:p(-2,-8,-10),max:p(101,42,23)}),
    describe:()=>({kind:'seismic-medium',...state,pTransmits:true,sTransmitsAcrossBoundary:!state.liquid,
      fixedEquilibriumMarks:true,velocityIsMeasured:false,trackedParticleId:tracked,
      specimenConstruction:'open-two-channel-guided-wave-bench',phaseHandle:handle.position.toArray(),
      fixedParticleIdentities:true,continuousPLinksAcrossBoundary:true,shearLinksInLiquid:false,
      apparatusDrivesDemonstrationNotEarthquakes:true,measuredMaterialProperties:false})};
}
