import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, LIFT_MARGIN, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateSeaBreeze } from './model';
import { phaseDialPoint, type ModelInput, type PhaseDial } from './textbook-model-input';
import { createInstrumentParts, turnedShaftGeometry, mergeInstrumentGeometry } from './textbook-instrument-parts';
import { buildCoastalSpecimen } from './textbook-coastal-specimen';

/** A coastal world, independent of the printed illustration's shallow bounds.
 * The book and all drawing/lifting/shading still use the original Popout. */
export function buildBreeze(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100 * 1.24, back = -LIFT_MARGIN - 37 * s, front = back + 63 * s;
  // The explanation unfolds into the air above the source page. Its height
  // belongs to the atmospheric section, rather than a pair of table legs.
  const rise = 43 * s, retreat = 16 * s, shift = 2 * s;
  b.root.position.set(shift, rise, -retreat);
  const at = (x: number, z: number, y = 0): Vec3 => [x * s, y * s, back + z * s];
  const parts = createInstrumentParts(b);
  const { coast, ground } = buildCoastalSpecimen(b, s, back);

  // White walls and lightly lifted grey eaves are part of the coast, not UI ornament.
  for (const [x, z, w, h] of [[17, 31, 8.2, 5.4], [28, 29, 6.6, 4.6]])
    b.house(at(x, z, ground(x, z) + .06), w * s, h * s, '#f0eadb');
  const jettyX = coast(48);
  b.box(at(jettyX - 1.5, 45.8, 2.9), at(jettyX + 10, 49, 3.45), '#eee5d4');
  for (const x of [jettyX + 3, jettyX + 8]) for (const z of [46.1, 48.7]) b.cylinder(at(x, z, .3), at(x, z, 3.5), .13 * s, '#7e8171');
  for (let j = 0; j < 9; j++) b.stroke([at(jettyX - 1 + j * 1.2, 45.9, 3.48), at(jettyX - 1 + j * 1.2, 48.9, 3.48)], .23);

  const low = 13, high = 67, airZ = 43;
  // A rounded spatial circuit, with a separate return path over the coast.
  // The two side paths form the depth of one idealized circulation cell.
  const loop = [at(70, airZ, low), at(32, airZ, low), at(17, airZ, 25), at(19, airZ, 51),
    at(36, airZ, high), at(67, airZ, high), at(83, airZ, 51), at(84, airZ, 27)];
  const curve = new T.CatmullRomCurve3(loop.map(p => b.v(p)), true, 'centripetal');
  // Solid rounded arrow sections catch the same light as the apparatus.
  // They remain schematic airflow arrows, with no closed vessel around air.
  const radial=10;
  const ribbons = [0, 1, 2, 3].map(() => {
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(33*radial*3),3));
    const index:number[]=[];
    for(let j=0;j<32;j++)for(let side=0;side<radial;side++){
      const a=j*radial+side,c=j*radial+(side+1)%radial;
      index.push(a,c,a+radial,c,c+radial,a+radial);
    }
    for(let side=1;side<radial-1;side++)index.push(0,side+1,side,32*radial,32*radial+side,32*radial+side+1);
    geometry.setIndex(index);
    const mesh=b.mesh(geometry,'#608e84',false,false,'enamel');mesh.name='rounded-circulation-arrow';
    return mesh;
  });
  // Two horizontal comparison levels. There are no inter-height pressure arrows.
  const tags = [-1, 0, 1].map(direction => {
    const landLow = direction > 0 ? '低压' : direction < 0 ? '高压' : '近似相等';
    const seaLow = direction > 0 ? '高压' : direction < 0 ? '低压' : '近似相等';
    return [[landLow, 27, low + 16], [seaLow, 75, low + 16], [seaLow, 28, high - 10], [landLow, 74, high - 10]]
      .map(([text, x, y]) => b.label(String(text), at(Number(x), airZ + .6, Number(y)), (direction === 0 ? 22 : 14) * s, 5.8 * s));
  });
  const landTags = ['陆地 · 较冷', '陆地 · 同温', '陆地 · 较暖'].map(text => b.label(text, at(20, 76, 2.5), 25 * s, 5.8 * s));
  const seaTags = ['海洋 · 较暖', '海洋 · 同温', '海洋 · 较冷'].map(text => b.label(text, at(80, 76, 2.5), 25 * s, 5.8 * s));
  // Matched, mechanically guided comparison indices. They show relative
  // warmth without inventing a thermometer calibration or a physical air pipe.
  const heating = [20, 80].map(x => {
    const z=67.8,base=at(x,z,2.8);
    parts.plate(at(x-3.8,z-2.4,-.68),at(x+3.8,z+2.4,.2),'brass',.2*s);
    const pedestal=parts.plate(at(x-3.1,z-1.8,.2),at(x+3.1,z+1.8,1.4),'steel',.2*s);
    pedestal.material=b.materialFor('enamel','#293c37');pedestal.userData.materialRole='enamel';
    parts.fasteners([at(x-2.2,z+1.15,1.46),at(x+2.2,z+1.15,1.46)],[0,1,0],.31*s);
    const column=parts.plate(at(x-1.5,z-.8,2.4),at(x+1.5,z+.05,21.5),'ivory',.18*s);
    column.name='relative-heat-ivory-scale';
    for(const dx of [-2.4,2.4]){
      parts.bearing(at(x+dx,z,2),[0,1,0],.72*s,1.1*s);
      parts.shaft(at(x+dx,z,2.3),at(x+dx,z,22.6),.24*s,'steel');
      parts.bearing(at(x+dx,z,22.2),[0,1,0],.63*s,.95*s);
    }
    parts.plate(at(x-3.1,z-.65,22.2),at(x+3.1,z+.7,23),'brass',.18*s);
    const ticks:any[]=[];
    for(let i=0;i<17;i++){
      const y=3.1+i*1.05,w=i%4===0?1.8:1.05;
      const tick=new T.BoxGeometry(w*s,.065*s,.06*s);tick.translate(...at(x-.9+w/2,z+.09,y));ticks.push(tick);
    }
    b.mesh(mergeInstrumentGeometry(ticks),'#424b4b',false,false,'steel');
    const bar=b.cylinder(base,[base[0],base[1]+17*s,base[2]],.23*s,'#b8784f');
    const cool=b.cylinder(base,[base[0],base[1]+17*s,base[2]],.23*s,'#4e8191');
    const index=new T.Group();index.name='relative-heat-sliding-index';b.root.add(index);
    const indexParts=createInstrumentParts(b,index);
    indexParts.plate([-3*s,-.42*s,-.5*s],[3*s,.42*s,.45*s],'brass',.12*s);
    for(const dx of [-2.4,2.4])indexParts.bearing([dx*s,0,0],[0,1,0],.57*s,1.4*s);
    const pointer=new T.ConeGeometry(.46*s,1.5*s,3);pointer.rotateZ(Math.PI/2);pointer.translate(.3*s,0,.65*s);
    index.add(b.mesh(pointer,'#424b4b',false,false,'steel'));
    index.position.set(...base);
    return {base,bar,cool,index};
  });
  // The light cue follows solar phase, independently of thermal lag. Sunset
  // therefore does not claim that the wind reverses at that exact instant.
  // A fine clock arc occupies the free air above the circulation. The sun/moon
  // is the handle: pulling it changes the model input, not a separate movie.
  const dial:PhaseDial={center:at(106,52.1,26),radiusX:9.1*s,radiusY:9.1*s};
  // One cantilever grows out of the specimen's front retaining lip. The
  // clock no longer stands on an unrelated wooden foot beside the coast.
  parts.plate(at(96,59,-2.1),at(101,63.8,-.8),'steel');
  parts.shaft(at(98.3,61,-1.3),at(106,48.7,-.4),.75*s,'steel');
  parts.plate(at(103.1,46.7,-1.1),at(108.9,50.7,.2),'brass');
  parts.bearing(at(106,48.7,1),[0,1,0],1.5*s,1.6*s);
  parts.shaft(at(106,48.7,1),at(106,48.7,26),.62*s,'steel');
  parts.shaft(at(106,48.7,26),at(106,52.1,26),.68*s,'steel');
  parts.bearing(at(106,50.5,26),[0,0,1],2*s,2.4*s);
  parts.fasteners([at(97.1,62.2,-.6),at(99.4,60.2,-.6)],[0,1,0],.42*s);
  // A turned case, recessed ivory face and raised bezel: the clock is a
  // physical input assembly. The comparison scale has no invented hours.
  const dialPlate=b.mesh(turnedShaftGeometry(at(106,49.6,26),at(106,52.48,26),[
    [9.7*s,0],[10.4*s,.08],[10.4*s,.18],[10*s,.22],
    [10*s,.76],[10.6*s,.84],[10.6*s,.94],[10.1*s,1]
  ]),'#a88b50',false,true,'brass');
  dialPlate.name='daylight-turned-case';
  const face=b.mesh(turnedShaftGeometry(at(106,52.45,26),at(106,52.62,26),[[9.6*s,0],[9.6*s,1]]),'#e3ddc9',false,true,'ivory');
  face.name='daylight-recessed-face';
  const ringGeometry=new T.TorusGeometry(10.05*s,.22*s,12,80);ringGeometry.translate(...at(106,52.69,26));
  b.mesh(ringGeometry,'#a88b50',false,true,'brass');
  const innerRing=new T.TorusGeometry(7.3*s,.055*s,6,80);innerRing.translate(...at(106,52.71,26));
  b.mesh(innerRing,'#a88b50',false,false,'brass');
  // Marks sit on the face, not in the XY plane at world origin. The previous
  // handwritten marks were too thin to survive the view's reduction.
  const dialTicks:any[]=[];
  for(let j=0;j<48;j++){
    const angle=j/48*Math.PI*2,major=j%12===0,length=major?1.6:.7;
    const tick=new T.BoxGeometry(length*s,(major?.14:.075)*s,.075*s);
    tick.rotateZ(angle);tick.translate(...at(106+Math.cos(angle)*(9.25-length/2),52.73,26+Math.sin(angle)*(9.25-length/2)));
    dialTicks.push(tick);
  }
  b.mesh(mergeInstrumentGeometry(dialTicks),'#424b4b',false,false,'steel');
  const center=at(106,53,26);
  const needle=new T.Shape();needle.moveTo(-.34*s,-1.6*s);needle.lineTo(.34*s,-1.6*s);
  needle.lineTo(.22*s,6.3*s);needle.lineTo(0,7.5*s);needle.lineTo(-.22*s,6.3*s);needle.closePath();
  const handGeometry=new T.ExtrudeGeometry(needle,{depth:.18*s,bevelEnabled:true,bevelSize:.045*s,bevelThickness:.045*s,bevelSegments:2});
  const hand=b.mesh(handGeometry,'#424b4b',false,true,'steel');hand.position.set(...center);
  hand.userData.interactionFeedback=false;
  parts.knob(at(106,53.5,26),[0,0,1],.86*s,.62*s);
  b.label('昼夜',at(106,54,11),13*s,4.8*s);
  const sky = phaseDialPoint(.5,dial);
  const daylightInput:ModelInput={kind:'phase-dial',dial,label:'拖动日月，观察风向变化'};
  dialPlate.userData.modelInput=daylightInput;face.userData.modelInput=daylightInput;hand.userData.modelInput=daylightInput;
  for(const mesh of [dialPlate,face,hand])mesh.userData.interactionFeedback=false;
  const sun=b.mesh(turnedShaftGeometry([sky[0],sky[1],sky[2]+.95*s],[sky[0],sky[1],sky[2]+1.65*s],[[1.35*s,0],[1.55*s,.2],[1.55*s,.8],[1.35*s,1]]),'#c8a568',false,true,'brass');
  sun.userData.modelInput=daylightInput;sun.userData.daylightHandle=true;
  sun.userData.smallPointTarget=true;
  sun.userData.interactionFeedback=false;
  sun.material = b.materialFor('brass','#c8a568');
  const lunar = new T.Shape(), radius = 1.75 * s;
  lunar.absarc(0, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  lunar.quadraticCurveTo(-radius * 1.1, 0, 0, radius);
  const moonGeometry = new T.ExtrudeGeometry(lunar, { depth: .35 * s, bevelEnabled: false, curveSegments: 24 });
  moonGeometry.translate(sky[0] + radius * .4, sky[1], sky[2] + 1 * s);
  const moon = b.mesh(moonGeometry, '#bcced0', false);
  moon.userData.modelInput=daylightInput;moon.userData.daylightHandle=true;
  moon.userData.smallPointTarget=true;
  moon.userData.interactionFeedback=false;
  const foot = at(coast(54) - 4, 54, 3.5), top: Vec3 = [foot[0], 15.6 * s, foot[2]];
  parts.bearing([foot[0],foot[1]+.45*s,foot[2]],[0,1,0],1*s,.9*s);
  b.cylinder(foot, top, .13 * s, '#6d786e'); b.stroke([foot, top], .54); b.sphere(top, .22 * s, '#e7dcc4', false);
  const cloth = new T.PlaneGeometry(9.1 * s, 2.6 * s, 28, 6); cloth.translate(4.55 * s, 0, 0);
  const flag = b.mesh(cloth, '#b78366', false, false); flag.position.set(top[0], top[1] - 1.9 * s, top[2]);
  const rest = new Float32Array(cloth.attributes.position.array);
  let state = evaluateSeaBreeze({ phase: .5, contrast: 1 }), motion = 0, flowPhase = 0;
  return {
    update(phase, _selection, dt, reduced) {
      state = evaluateSeaBreeze({ phase, contrast: 1 });
      const { direction, strength } = state, tag = direction + 1;
      if (!reduced) {
        const step = Math.min(Math.max(dt, 0), .05) * .10;
        motion += step;
        // Integrate the signed speed. Changing the heat difference slows the
        // same ribbon down instead of remapping its position or teleporting it.
        flowPhase = ((flowPhase + step * direction * strength) % 1 + 1) % 1;
      }
      const daylight = Math.cos((phase - .5) * Math.PI * 2) > 0;
      const celestial=phaseDialPoint(phase,dial),offset=b.v(celestial).sub(b.v(sky));
      sun.position.copy(offset);moon.position.copy(offset);
      hand.rotation.z=(phase-.25)*Math.PI*2-Math.PI/2;
      sun.visible = daylight; moon.visible = !daylight;
      const held=!!(sun.userData.modelHovered||moon.userData.modelHovered);
      // A small engraved collar gives both day and night the same graspable
      // control silhouette. The weather model still owns the calm interval.
      b.contour(Array.from({length:33},(_,i):Vec3=>{
        const angle=i/32*Math.PI*2;
        return [celestial[0]+Math.cos(angle)*2.1*s,celestial[1]+Math.sin(angle)*2.1*s,celestial[2]+1.7*s];
      }),held?.62:.29);
      if (!daylight) b.outline(moon, held?.85:.6);
      if (daylight) for (let j = 0; j < 8; j++) {
        const a = j / 8 * Math.PI * 2;
        b.contour([1.8, held?2.7:2.4].map(r => [celestial[0] + Math.cos(a) * r * s, celestial[1] + Math.sin(a) * r * s, celestial[2]+1.7*s]) as Vec3[], .42);
      }
      tags.forEach((set, i) => set.forEach(m => { m.visible = i === tag; }));
      landTags.forEach((m, i) => { m.visible = i === tag; }); seaTags.forEach((m, i) => { m.visible = i === tag; });
      // Relative heat is visible on the landscape; no invented Celsius scale.
      heating.forEach(({ base, bar, cool, index }, i) => {
        const warmer = i === 0 ? direction > 0 : direction < 0;
        bar.visible = warmer && direction !== 0; cool.visible = !warmer && direction !== 0;
        const relativeHeat=i===0?state.land:state.sea;
        const scale = Math.max(.12,Math.min(.96,.5+relativeHeat*.48));
        for (const mesh of [bar, cool]) {
          mesh.scale.y = scale; mesh.position.y = base[1] * (1 - scale);
          index.position.y=base[1]+17*s*scale;
        }
      });
      for (let k = 0; k < 4; k++) {
        const mesh=ribbons[k],a=mesh.geometry.attributes.position;
        mesh.visible=strength>.018;
        for(let j=0;j<=32;j++){
          const t=j/32,u=((k/4+flowPhase+.018+t*.175*(direction||1))%1+1)%1;
          const p=curve.getPoint(u),tangent=curve.getTangent(u).multiplyScalar(direction||1);
          const normal=new T.Vector3(-tangent.y,tangent.x,0).normalize();
          const radius=(t<.72?.46:1.45*(1-t)/.28)*s*Math.min(1,strength*2);
          for(let side=0;side<radial;side++){
            const angle=side/radial*Math.PI*2,q=p.clone().addScaledVector(normal,Math.cos(angle)*radius);
            q.z+=Math.sin(angle)*radius;a.setXYZ(j*radial+side,q.x,q.y,q.z);
          }
        }
        a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();
      }
      if (strength > .018) {
        b.contour(curve.getPoints(96).map((p: any) => p.toArray()), .25);
        for (const depth of [-15, 0, 12]) {
          if (depth) b.contour(curve.getPoints(80).map((p: any) => [p.x, p.y, p.z + depth * s]), .17);
          for (let j = 0; j < 7; j++) {
          const t = ((flowPhase + j / 7 + depth * .017) % 1 + 1) % 1;
          const a = curve.getPoint(t), tangent = curve.getTangent(t).multiplyScalar(direction), tail = a.clone().addScaledVector(tangent, -1.75 * s * strength);
          a.z += depth * s; tail.z += depth * s; b.flow.push({ points: [tail, a], width: depth ? .62 : 1.05 });
          }
        }
      }
      for (const height of [low + 16, high - 10]) for (let i = 0; i < 8; i++)
        b.contour([at(40 + i * 2.8, airZ + .5, height), at(41.2 + i * 2.8, airZ + .5, height)], .22);
      const a = cloth.attributes.position;
      // The cloth rotates towards a hanging pose as wind weakens. Its cross
      // axis keeps its width, including at zero wind; the flag never collapses
      // into a line just when students need to observe the calm interval.
      const fall = 1 - strength, length = Math.hypot(strength, fall);
      const axisX = -direction * strength / length, axisY = -fall / length;
      for (let j = 0; j < a.count; j++) {
        const x = rest[j * 3], y = rest[j * 3 + 1], u = x / (9.1 * s);
        a.setXYZ(j, axisX * x - axisY * y, axisY * x + axisX * y - .28 * s * u * u,
          (Math.sin(u * 7 - motion * 80) * .48 + Math.sin(u * 13 - motion * 113) * .12) * s * u * strength);
      }
      a.needsUpdate = true; cloth.computeVertexNormals(); cloth.computeBoundingSphere();
      for (const ids of [Array.from({ length: 29 }, (_, i) => i), Array.from({ length: 29 }, (_, i) => i + 174),
        [0, 29, 58, 87, 116, 145, 174], [28, 57, 86, 115, 144, 173, 202]])
        b.contour(ids.map(j => [a.getX(j) + flag.position.x, a.getY(j) + flag.position.y, a.getZ(j) + flag.position.z]), .52);
    },
    describe: () => ({ kind: 'sea-breeze', layout: 'land-left-sea-right', scene: 'coastal-paper-world',
      selected: state.direction > 0 ? 'day' : state.direction < 0 ? 'night' : 'transition',
      groundX: -state.direction, upperX: state.direction, strength: state.strength, pressure: state.pressure,
      continuousDayNight: true, flowPhase, flowRate: .10 * state.direction * state.strength,
      flagArea: surfaceArea(cloth), panels: 1, sameHeightGuides: 2, elevatedAbovePage: rise, sourceFootprint: [b.width, b.height], sceneDepth: front - back,
      directInteraction:'drag-daylight-handle',daylightControlIsSchematic:true,visualConstruction:'coastal-thermal-instrument',relativeHeatGauges:2,
      specimenConstruction:'fitted-relief-with-common-height-field',mechanicalHeatIndices:2,
      heatIndexPositions:heating.map(h=>h.index.position.y/s) }),
    focusBounds: () => ({ min: [-3 * s, -8 * s, back - 3 * s], max: [125 * s, 74 * s, front + 18 * s] }),
  };
}

function surfaceArea(geometry: any) {
  const p = geometry.attributes.position, index = geometry.index;
  let area = 0;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    const ux = p.getX(b) - p.getX(a), uy = p.getY(b) - p.getY(a), uz = p.getZ(b) - p.getZ(a);
    const vx = p.getX(c) - p.getX(a), vy = p.getY(c) - p.getY(a), vz = p.getZ(c) - p.getZ(a);
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return area;
}

