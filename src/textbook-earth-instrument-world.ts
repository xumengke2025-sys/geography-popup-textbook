import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { EARTH_RADII, EARTH_COLORS, EARTH_LAYER_NAMES, evaluateEarthLayers, earthLayerInspection, EARTH_REFERENCE } from './textbook-astronomy-model';
import { turnedShaftGeometry } from './textbook-instrument-parts';
export function buildEarthInstrumentWorld(b: TextbookGeometry): ModelMotion {
const s=b.width/100,p=(u:number,v:number,h=0)=>b.p(u,v,h*s);
  // A cutaway with one real, closed paper shell per layer. The removed front
  // quadrant and both section planes share the same angular boundaries.
  const center = p(.30, .83, 34), radii = EARTH_RADII, colors = EARTH_COLORS;
  const hardware:any[]=[],carriage:any[]=[],wheelParts:any[]=[];
  const brass='#aa8a51',steel='#979e9a',ivory='#e3ddc9',enamel='#293c37';
  const q=(x:number,y:number,z=0):Vec3=>[center[0]+x*s,y*s,center[2]+z*s];
  const add=(geo:any,role:'brass'|'steel'|'enamel'|'ivory'|'wood',color:string,name:string)=>{
    const mesh=b.mesh(geo,color,false,true,role);mesh.name=`earth-instrument:${name}`;
    mesh.userData.earthInstrument=name;hardware.push(mesh);return mesh;
  };
  const rod=(a:Vec3,c:Vec3,r:number,role:'brass'|'steel'|'enamel'|'ivory'|'wood',color:string,name:string)=>{
    const radius=r*s;
    const profile:readonly (readonly [number,number])[]=name==='polar-bearing'
      ?[[radius*.85,0],[radius,.1],[radius,.32],[radius*.75,.38],[radius*.75,.66],[radius,.72],[radius,.9],[radius*.85,1]]
      :[[radius*.9,0],[radius,.08],[radius,.92],[radius*.9,1]];
    return add(turnedShaftGeometry(a,c,profile),role,color,name);
  };
  const rounded=(x:number,y:number,z:number,w:number,d:number,h:number,r:number,color:string,role:'brass'|'steel'|'enamel'|'ivory'|'wood',name:string)=>{
    const sh=new T.Shape(),a=-w/2,c=-d/2;
    sh.moveTo(a+r,c);sh.lineTo(a+w-r,c);sh.quadraticCurveTo(a+w,c,a+w,c+r);
    sh.lineTo(a+w,c+d-r);sh.quadraticCurveTo(a+w,c+d,a+w-r,c+d);
    sh.lineTo(a+r,c+d);sh.quadraticCurveTo(a,c+d,a,c+d-r);
    sh.lineTo(a,c+r);sh.quadraticCurveTo(a,c,a+r,c);
    const geo=new T.ExtrudeGeometry(sh,{depth:h,bevelEnabled:true,bevelThickness:.12,bevelSize:.16,bevelSegments:2,curveSegments:6});
    geo.rotateX(-Math.PI/2);geo.scale(s,s,s);geo.translate(...q(x,y,z));return add(geo,role,color,name);
  };
  // One rounded chassis carries both the pole bearings and the extraction
  // ways. The open meridian leaves the right-hand section completely clear.
  rounded(26,1.1,0,94,21,2.3,5.5,'#544534','wood','chassis');
  rounded(26,3.5,0,91,18,.9,4.5,enamel,'enamel','enamel-deck');
  rounded(26,4.45,0,89,16,.24,4,brass,'brass','fine-deck-rim');
  rounded(26,4.7,0,88,15.2,.3,4,enamel,'enamel','deck-inset');
  for(const x of [-15,66])for(const z of [-6,6]){
    rod(q(x,.3,z),q(x,1.1,z),2,'enamel',enamel,'leveling-foot');
    rod(q(x,5.05,z),q(x,5.25,z),.55,'brass',brass,'captive-screw');
  }
  rod(q(0,5),q(0,7.2),5,'brass',brass,'turned-shoulder');
  rod(q(0,7.2),q(0,9.2),3.1,'enamel',enamel,'pedestal-neck');
  rod(q(0,9.2),q(0,10.3),4,'brass',brass,'bearing-seat');
  const meridian=Array.from({length:91},(_,i)=>{const a=Math.PI/2+i/90*Math.PI;return new T.Vector3(...q(Math.cos(a)*24.4,34+Math.sin(a)*24.4));});
  add(new T.TubeGeometry(new T.CatmullRomCurve3(meridian),90,.9*s,12,false),'brass',brass,'open-meridian');
  for(const y of [10.7,57.3]){
    rod(q(0,y-1),q(0,y+1),2.7,'brass',brass,'polar-bearing');
    rod(q(0,y-1.5),q(0,y+1.5),1.1,'steel',steel,'short-polar-spindle');
  }
  // This slender specimen rest becomes visible when the enclosing shells are
  // removed; it terminates at the outer core rather than crossing the cut face.
  rod(q(0,12),q(0,22.8),.65,'steel',steel,'inner-specimen-rest');
  rod(q(0,22),q(0,22.8),1.4,'brass',brass,'inner-specimen-seat');
  // Unnumbered divisions communicate alignment without invented units.
  for(let i=0;i<=18;i++){
    const a=Math.PI/2+i/18*Math.PI,r0=24.9,r1=i%3===0?26.1:25.55;
    rod(q(Math.cos(a)*r0,34+Math.sin(a)*r0,.1),q(Math.cos(a)*r1,34+Math.sin(a)*r1,.1),.065,'steel',steel,'meridian-division');
  }
  for(const z of [-5,5]){
    rod(q(0,7,z),q(68,7,z),.75,'steel',steel,'precision-guide');
    for(const x of [0,68])rounded(x,5,z,3.6,3.8,2.7,.7,brass,'brass','rail-bearing');
  }
  rod(q(0,6.8),q(71,6.8),.65,'steel',steel,'lead-screw');
  const helix=Array.from({length:561},(_,i)=>{const x=i/560*69,a=x*Math.PI*1.5;return new T.Vector3(...q(x,6.8+Math.sin(a)*.8,Math.cos(a)*.8));});
  add(new T.TubeGeometry(new T.CatmullRomCurve3(helix),560,.1*s,4,false),'brass',brass,'screw-thread');
  carriage.push(rounded(0,7.7,0,8,13,1.5,1,enamel,'enamel','travel-carriage'));
  carriage.push(rod(q(0,9.2),q(0,12.7),2.1,'brass',brass,'shell-rest'));
  carriage.push(rod(q(0,9.2),q(0,16.3),.9,'steel',steel,'telescopic-inner-sleeve'));
  rod(q(69,6.8),q(74,6.8),1,'steel',steel,'handwheel-spindle');
  const wheelGeo=new T.TorusGeometry(3.5*s,.55*s,10,48);wheelGeo.rotateY(Math.PI/2);
  const wheel=add(wheelGeo,'brass',brass,'extraction-handwheel');wheel.position.set(...q(73,6.8));wheelParts.push(wheel);
  wheel.userData.modelInput={kind:'select',selection:1,toggleTo:0,label:'转动手轮抽出地壳；再次选择复原'};
  for(const a of [0,Math.PI*2/3,Math.PI*4/3]){
    const spoke=rod([0,0,0],[0,Math.sin(a)*3.4*s,Math.cos(a)*3.4*s],.25,'brass',brass,'handwheel-spoke');
    spoke.position.set(...q(73,6.8));spoke.userData.modelInput=wheel.userData.modelInput;wheelParts.push(spoke);
  }
  const grip=rod([0,0,3.4*s],[3*s,0,3.4*s],.6,'enamel',enamel,'handwheel-grip');grip.position.set(...q(73,6.8));wheelParts.push(grip);
  rod(q(-12,5.1,2.5),q(-12,5.7,2.5),4.3,'brass',brass,'selector-case');
  rod(q(-12,5.7,2.5),q(-12,5.85,2.5),3.65,'ivory',ivory,'ivory-selector');
  for(let i=0;i<4;i++){
    const a=i/4*Math.PI*2;const mark=rod(q(-12+Math.sin(a)*2.8,5.88,2.5+Math.cos(a)*2.8),q(-12+Math.sin(a)*3.35,5.88,2.5+Math.cos(a)*3.35),.14,'steel',steel,'selector-detent');
    mark.userData.modelInput={kind:'select',selection:i,label:['整体复原','抽出地壳','抽出地幔','观察地核'][i]};
  }
  const pointer=rod([0,0,0],[0,0,2.7*s],.2,'brass',brass,'selector-pointer');pointer.position.set(...q(-12,6,2.5));
  const latch=rod(q(0,58.6),q(0,60.8),1.8,'brass',brass,'section-latch');
  latch.userData.modelInput={kind:'inspect',target:'closed',toggleTo:'overview',label:'合拢或打开地球剖面'};
  const names = EARTH_LAYER_NAMES;
  const layers = radii.map((r, i) => {
    const inner = (radii[i + 1] ?? 0) * s, outer = r * s;
    const members: any[] = [];
    const modelInput = { kind: 'select', selection: i < 2 ? i + 1 : 3, label: `查看${names[i]}`, toggleTo: 0 };
    const addPart = (geometry: any, part: string) => {
      const mesh = b.mesh(geometry, colors[i], false);
      mesh.userData.layer = i; mesh.userData.layerName = names[i]; mesh.userData.layerPart = part;
      mesh.userData.modelInput = modelInput;
      members.push(mesh); return mesh;
    };
    const curved = (radius: number) => {
      const geometry = new T.SphereGeometry(radius, 36, 24, Math.PI, Math.PI * 1.5);
      geometry.translate(...center); return geometry;
    };
    const shell = addPart(curved(outer), 'outer');
    shell.userData.modelInput = { kind: 'inspect', target: 'closed', toggleTo: 'overview', label: '合拢地球外壳，对照外观与剖面；再次选择打开' };
    const coverGeometry = (radius: number) => {
      const g = new T.SphereGeometry(radius, 16, 24, Math.PI / 2, Math.PI / 2); g.translate(...center); return g;
    };
    const cover = addPart(coverGeometry(outer), 'observation-cover'); cover.userData.modelInput = shell.userData.modelInput;
    // The inner surface closes a shell when it is lifted away from its nested
    // neighbour; it stays hidden when both coincident surfaces are assembled.
    const lining = inner ? addPart(curved(inner), 'inner') : null;
    const coverLining = inner ? addPart(coverGeometry(inner), 'observation-cover-inner') : null;
    if (coverLining) coverLining.userData.modelInput = shell.userData.modelInput;
    for (const axis of [0, 1]) {
      const vs: number[] = [], is: number[] = [];
      for (let j = 0; j <= 36; j++) {
        const a = j / 36 * Math.PI, cy = Math.cos(a), sn = Math.sin(a);
        for (const rr of [outer, inner]) vs.push(center[0] + (axis ? sn * rr : 0), center[1] + cy * rr, center[2] + (axis ? 0 : sn * rr));
        if (j < 36) { const k = j * 2; is.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const q = new T.BufferGeometry(); q.setAttribute('position', new T.Float32BufferAttribute(vs, 3)); q.setIndex(is); q.computeVertexNormals(); addPart(q, axis ? 'section-x' : 'section-z');
    }
    const label = b.label(names[i], [center[0] + 36 * s, center[1] + (16 - i * 10) * s, center[2]], 12 * s, 4.8 * s);
    label.userData.labelForLayer = i;
    label.userData.modelInput = modelInput;
    return { shell, cover, lining, coverLining, members, label, outer, inner, offset: new T.Vector3(), visible: true };
  });
  let selected = 0, lastNow = performance.now(), inspection = 'overview';
  const at = (x: number, y: number, z: number, offset: any): Vec3 =>
    [center[0] + x + offset.x, center[1] + y + offset.y, center[2] + z + offset.z];
  return { update(_t, selection, _dt, reduced) {
    const state = evaluateEarthLayers(selection);
    const observation = earthLayerInspection(inspection), firstVisible = state.layers.find(layer => layer.visible && !layer.peeled)?.index;
    selected = state.selection;
    const now = performance.now(), elapsed = Math.max(0, Math.min(.08, (now - lastNow) / 1000));
    lastNow = now;
    // Selection has a short physical lift even while the scientific timeline
    // is paused. Reduced motion goes straight to the same final geometry.
    const blend = reduced ? 1 : 1 - Math.exp(-14 * elapsed);
    layers.forEach((layer, i) => {
      layer.visible = state.layers[i].visible;
      const peeled = state.layers[i].peeled;
      // The extracted shell clears the remaining sphere in silhouette: a
      // small offset made two overlapping globes instead of a readable layer.
      // Extra separation also preserves the gap at the book's allowed oblique
      // camera angles, rather than only in the default front view.
      const target = new T.Vector3(...state.layers[i].offset.map(value => value * s));
      layer.offset.lerp(target, blend);
      for (const mesh of layer.members) { mesh.visible = layer.visible; mesh.position.copy(layer.offset); }
      if (layer.lining) layer.lining.visible = layer.visible && layer.offset.lengthSq() > .0001;
      layer.cover.visible = layer.visible && observation.coverVisible;
      if (layer.coverLining) layer.coverLining.visible = layer.visible && observation.coverVisible && layer.offset.lengthSq() > .0001;
      if (observation.coverVisible) for (const mesh of layer.members) if (mesh.userData.layerPart.startsWith('section-')) mesh.visible = false;
      const labelVisible = state.layers[i].labelVisible && (!observation.coverVisible || peeled || i === firstVisible);
      layer.label.visible = labelVisible;
      const hovered = layer.members.some(mesh => mesh.visible && mesh.userData.modelHovered === true)
        || (labelVisible && layer.label.userData.modelHovered === true);
      // All section outlines use precisely the same translation as the solids.
      if (layer.visible && !observation.coverVisible) for (const axis of [0, 1]) for (const radius of [layer.outer, layer.inner]) {
        if (!radius) continue;
        const arc = Array.from({ length: 49 }, (_, j): Vec3 => {
          const a = j / 48 * Math.PI;
          return at(axis ? Math.sin(a) * radius : 0, Math.cos(a) * radius, axis ? .05 * s : Math.sin(a) * radius, layer.offset);
        });
        b.contour(arc, (peeled ? .7 : i === 0 ? .65 : .4) + (hovered ? .2 : 0));
      }
      if (!labelVisible) return;
      const row = peeled ? layer.outer + 8 * s : (selected === 0 ? 16 - i * 10 : i === 2 ? 5 : -7) * s;
      const labelX = peeled ? 0 : (selected === 3 ? 23 : 36) * s;
      layer.label.position.set(...at(labelX, row, 0, layer.offset));
      if (peeled) {
        b.contour([at(layer.outer * .24, layer.outer * .97, .08 * s, layer.offset),
          at(0, row - 3 * s, .08 * s, layer.offset), at(0, row - 2.5 * s, .08 * s, layer.offset)], hovered ? .6 : .42);
        return;
      }
      const radius = i === 3 ? layer.outer * .48 : (layer.outer + layer.inner) * .5;
      const angle = [.65, .15, -.3, -.9][i];
      b.contour([at(Math.cos(angle) * radius, Math.sin(angle) * radius, .08 * s, layer.offset),
        at(labelX - 9 * s, row, .08 * s, layer.offset), at(labelX - 6.5 * s, row, .08 * s, layer.offset)], hovered ? .6 : .42);
    });
    const extracted=layers.find((_,i)=>state.layers[i].peeled);
    const travel=extracted?.offset.x??0,lift=extracted?.offset.y??0;
    // Physical travel is shared with the shell, not another independently
    // timed animation. Reverse selection returns every part to its datum.
    carriage[0].position.set(travel,0,0);
    carriage[1].position.set(travel,lift+(extracted?(21-extracted.outer/s)*s:0),0);
    carriage[2].position.set(travel,0,0);
    for(const part of wheelParts)part.rotation.x=travel/s*.33;
    pointer.rotation.y=-selected*Math.PI/2;
  }, inspect(target) { inspection = earthLayerInspection(target).inspection; }, focusBounds: () => {
    const bounds = new T.Box3();
    for(const mesh of hardware){
      mesh.geometry.computeBoundingBox();mesh.updateMatrix();
      bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
    }
    for (const layer of layers) {
      if (layer.visible) for (const mesh of layer.members) {
        if (!mesh.visible) continue;
        mesh.geometry.computeBoundingBox(); bounds.union(mesh.geometry.boundingBox.clone().translate(layer.offset));
      }
      if (layer.label.visible) {
        const position = layer.label.position;
        bounds.expandByPoint(position.clone().add(new T.Vector3(-6 * s, -2.4 * s, -2.4 * s)));
        bounds.expandByPoint(position.clone().add(new T.Vector3(6 * s, 2.4 * s, 2.4 * s)));
      }
    }
    return { min: bounds.min.toArray() as Vec3, max: bounds.max.toArray() as Vec3 };
  }, describe: () => ({ kind: 'earth-cutaway', layers: ['crust', 'mantle', 'outer-core', 'inner-core'], scale: 'schematic', source: EARTH_REFERENCE,
    selected, inspection, observation: earthLayerInspection(inspection), focus: selected === 0 ? 'all' : selected === 1 ? 'crust' : selected === 2 ? 'mantle' : 'core',
    groupedSections: true, crustThicknessUnchanged: true,
    instrument:{kind:'sectional-globe',openMeridian:true,polarBearing:true,dualGuideRails:true,
      originalScientificDisplacements:true,carriageTravel:carriage[0].position.x/s,
      handwheelAngle:wheel.rotation.x,selectorAngle:pointer.rotation.y,parts:hardware.length},
    layerGroups: layers.map((layer, i) => ({ layer: i, visible: layer.visible, offset: layer.offset.toArray(), parts: layer.members.length, labelVisible: layer.label.visible })) }) };
}
