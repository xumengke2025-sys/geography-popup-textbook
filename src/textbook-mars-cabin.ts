import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';

/** Longitudinal cutaway habitat. One continuous floor, a fixed aft pressure
 * shell and two thick observation leaves share the same section and datum.
 * These are teaching models, not a practical pressure-vessel design. */
export function buildMarsCabin(b:TextbookGeometry,at:Vec3,s:number,index:number){
  const p=(x:number,y:number,z:number):Vec3=>[at[0]+x*s,at[1]+y*s,at[2]+z*s];
  const meshes:any[]=[],colors={ivory:'#ded8c7',enamel:'#364b43',brass:'#b39964',steel:'#9ca39a',plant:'#83a549'};
  const add=(g:any,role:keyof typeof colors,name:string,tint=colors[role])=>{
    const m=b.mesh(g,tint,false,true,role);m.name=name;m.userData.cabinPart=name;m.userData.moduleIndex=index;meshes.push(m);return m;
  };
  const rod=(a:Vec3,c:Vec3,r:number,role:keyof typeof colors,name:string)=>add(turnedShaftGeometry(p(...a),p(...c),[[r*s,0],[r*s,1]]),role,name);
  const plate=(a:Vec3,c:Vec3,role:keyof typeof colors,name:string)=>add(chamferedPlateGeometry(p(...a),p(...c),.1*s),role,name);
  // Broad saddles terminate at the actual regolith contact. The floor is a
  // single rounded longitudinal section rather than three stacked discs.
  for(const z of [-7.3,8.3]){
    plate([-7.7,-1.3,z-1],[7.7,-.1,z+1],'enamel','cabin-floor-saddle');
    for(const x of [-6.5,6.5]){
      rod([x,-1.7,z],[x,-1.1,z],1.15,'steel','cabin-short-foot');
      rod([x,-1.7,z],[x,-1.55,z],1.65,'enamel','cabin-ground-pad');
    }
  }
  const floorShape=new T.Shape();
  floorShape.moveTo(-8.8,-10.3);floorShape.lineTo(8.8,-10.3);
  floorShape.quadraticCurveTo(10.7,-10.3,10.7,-8.4);floorShape.lineTo(10.7,11.5);
  floorShape.quadraticCurveTo(10.7,13.4,8.8,13.4);floorShape.lineTo(-8.8,13.4);
  floorShape.quadraticCurveTo(-10.7,13.4,-10.7,11.5);floorShape.lineTo(-10.7,-8.4);
  floorShape.quadraticCurveTo(-10.7,-10.3,-8.8,-10.3);floorShape.closePath();
  const floor=new T.ExtrudeGeometry(floorShape,{depth:.65,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:2,steps:1,curveSegments:8});
  // The shape's second coordinate is the cabin's longitudinal z coordinate.
  const floorPositions=floor.attributes.position;
  for(let i=0;i<floorPositions.count;i++){
    const x=floorPositions.getX(i),z=floorPositions.getY(i),y=floorPositions.getZ(i);
    floorPositions.setXYZ(i,...p(x,.65-y,z));
  }
  floor.computeVertexNormals();add(floor,'ivory','continuous-longitudinal-cabin-floor');

  // Closed annular sections include the outer face, inner face, both cut
  // ends and longitudinal edge returns. Every visible cut has real thickness.
  const shell=(from:number,to:number,z0:number,z1:number,outer=10.65,inner=10.12,withWindow=false)=>{
    const vertices:number[]=[],indices:number[]=[],steps=Math.max(2,Math.ceil((to-from)*24));
    const sections=withWindow?[z0,-2.9,10.4,z1]:[z0,z1];
    for(let i=0;i<=steps;i++){
      const a=from+(to-from)*i/steps;
      for(const z of sections)for(const r of [outer,inner])
        vertices.push(...p(Math.cos(a)*r,.65+Math.sin(a)*r*1.18,z));
    }
    const quad=(a:number,c:number,d:number,e:number)=>indices.push(a,c,d,a,d,e);
    const occupied=(i:number,j:number)=>i>=0&&i<steps&&j>=0&&j<sections.length-1&&!(withWindow&&j===1&&i>=5&&i<steps-5);
    for(let i=0;i<steps;i++)for(let j=0;j<sections.length-1;j++){
      if(!occupied(i,j))continue;
      const a=2*(i*sections.length+j),b=a+2*sections.length,c=b+2,d=a+2;
      quad(a,b,c,d);quad(a+1,d+1,c+1,b+1);
      if(!occupied(i-1,j))quad(a,d,d+1,a+1);
      if(!occupied(i+1,j))quad(b,b+1,c+1,c);
      if(!occupied(i,j-1))quad(a,a+1,b+1,b);
      if(!occupied(i,j+1))quad(d,c,c+1,d+1);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g;
  };
  add(shell(0,Math.PI,-9.8,-4.9),'ivory','fixed-aft-vault-shell');
  // Two low continuous side sills carry hinges and meet the aft shell.
  for(const side of[-1,1])plate([side<0?-10.65:9.9,.65,-4.9],[side<0?-9.9:10.65,2.25,12.3],'enamel','longitudinal-hinge-sill');
  const sectionRib=(z:number)=>{
    const points=Array.from({length:49},(_,i)=>{const a=i/48*Math.PI;return new T.Vector3(...p(Math.cos(a)*10.73,.65+Math.sin(a)*12.66,z));});
    return new T.TubeGeometry(new T.CatmullRomCurve3(points),48,.13*s,6,false);
  };
  add(mergeInstrumentGeometry([-9.7,-4.95].map(sectionRib)),'steel','aft-shell-section-seams');
  // The aft bulkhead is cut from the same arch, not a floating window panel.
  const rear=new T.Shape();rear.moveTo(-10.1,.65);
  for(let i=0;i<=48;i++){const a=Math.PI-i/48*Math.PI;rear.lineTo(Math.cos(a)*10.1,.65+Math.sin(a)*11.92);}
  rear.closePath();const bulkhead=new T.ExtrudeGeometry(rear,{depth:.45,bevelEnabled:false,steps:1});
  bulkhead.scale(s,s,s);bulkhead.translate(...p(0,0,-9.85));add(bulkhead,'ivory','aft-pressure-bulkhead');
  const shellPivots:any[]=[],hatchHandles:any[]=[],hatchSurfaces:any[]=[];
  for(const side of [-1,1]){
    const hinge=p(side*10.3,1.75,0);
    const pivot=new T.Group();pivot.position.set(...hinge);b.root.add(pivot);shellPivots.push(pivot);
    const mounted=(geometry:any,role:keyof typeof colors,name:string,tint=colors[role])=>{
      geometry.translate(-hinge[0],-hinge[1],-hinge[2]);
      const m=add(geometry,role,name,tint);pivot.add(m);hatchSurfaces.push(m);return m;
    };
    const from=side<0?Math.PI/2:0,to=from+Math.PI/2;
    const jamb=(to-from)*5/Math.ceil((to-from)*24);
    mounted(shell(from,to,-4.8,12.25,10.65,10.12,true),'ivory','hinged-longitudinal-observation-shell');
    const pane=mounted(shell(from+jamb,to-jamb,-2.9,10.4,10.42,10.31),'ivory','inset-observation-glazing','#b3d0cc');
    // This tint is exclusive to the eight model windows. Roof and glass are
    // both children of the hinge and keep the original book reveal uniform.
    pane.material.opacity=.24;pane.material.depthWrite=false;
    pane.castShadow=false;pane.userData.castShadow=false;pane.raycast=()=>{};
    // A machined cut-edge follows the pressure-shell section at its front.
    const rimPoints=Array.from({length:25},(_,i)=>{const a=(side<0?Math.PI/2:0)+i/24*Math.PI/2;return new T.Vector3(...p(Math.cos(a)*10.4,.65+Math.sin(a)*12.27,12.28));});
    mounted(new T.TubeGeometry(new T.CatmullRomCurve3(rimPoints),24,.14*s,6),'brass','shell-front-cut-edge');
    for(const z of[-3.2,9.5]){
      const barrel=turnedShaftGeometry(p(side*10.3,1.75,z-.65),p(side*10.3,1.75,z+.65),[[.36*s,0],[.36*s,1]]);
      mounted(barrel,'steel','longitudinal-hinge-barrel');
    }
    // A small pull is fixed to the shell itself and moves with its hinge.
    const pull=new T.TorusGeometry(.68*s,.16*s,7,18,Math.PI*1.4);pull.rotateY(side*.35);pull.translate(...p(side*7.9,8.6,12.6));
    const handle=mounted(pull,'brass','shell-opening-pull');handle.userData.shellIndex=index;hatchHandles.push(handle);
  }
  const setOpening=(fraction:number)=>{
    const amount=Math.max(0,Math.min(1,fraction));
    shellPivots.forEach((pivot,i)=>{pivot.rotation.z=(i===0?1:-1)*amount*Math.PI*.30;});
  };
  setOpening(.82);
  // A wall-mounted service strip replaces the old flat exterior window.
  plate([-5.7,4.2,-9.3],[5.7,7.3,-8.88],'enamel','internal-service-panel');
  const window=b.mesh(chamferedPlateGeometry(p(-4.8,4.7,-8.82),p(4.8,6.8,-8.69),.035*s),'#aabfc1',false,true,'ivory');
  window.userData.cabinPart='arrival-indicator-in-wall';meshes.push(window);
  // Mount each identifier on the fixed aft arch. A forward threshold label
  // on the plant module disappears behind the resource module in overview.
  const rake = -.46, plateCenter = p(0,15.4,-7.1);
  for(const x of [-4.6,4.6]) rod([x,11.65,-7.1],[x,13.8,-7.1],.32,'brass','identifier-stud');
  const crest = chamferedPlateGeometry([-8.55*s,-3.25*s,-.4*s],[8.55*s,3.25*s,.4*s],.2*s);
  crest.rotateX(rake);crest.translate(...plateCenter);
  add(crest,'enamel','aft-nameplate-seat');
  const faceOffset=.43*s;
  const name=b.label(['乘员舱','植物舱','生保舱','资源舱'][index],
    [plateCenter[0],plateCenter[1]-Math.sin(rake)*faceOffset,plateCenter[2]+Math.cos(rake)*faceOffset],
    16*s,5.9*s,{appearance:'engraved',ink:'#f5e8c9'});
  name.rotation.x=rake;
  name.userData.labelMount='surface';name.userData.moduleIndex=index;meshes.push(name);
  // A few visible bulkhead collars explicitly terminate the transfer routes.
  // Their shape belongs to the teaching apparatus, not a claim that food,
  // water and gas all use the same practical engineering transport system.
  const ports=([[2.4,7,10,4],[7,10,4],[2.4,5],[2.4]][index]);
  plate([-.85,.65,8.2],[.85,Math.max(...ports)+.8,8.65],'enamel','floor-mounted-service-spine');
  for(const y of ports){const x=0;
    rod([x,y,8.65],[x,y,9.35],.58,'steel','transfer-port-inner');
    rod([x,y,8.88],[x,y,9.1],.88,'brass','transfer-port-flange');
  }
  // The same open shell carries different working interiors. Nothing is
  // suspended: benches, beds and filter housings meet the cabin floor.
  if(index===0){
    for(const x of [-4.6,4.6]){
      plate([x-1.5,.7,-5.5],[x+1.5,1.5,2.4],'enamel','crew-berth-base');
      plate([x-1.4,1.5,-5.4],[x+1.4,2.15,2.3],'ivory','crew-berth-mattress');
      plate([x-1.2,2.15,-5],[x+1.2,2.55,-3.8],'ivory','crew-berth-pillow');
    }
  }else if(index===1){
    for(const x of [-4.3,4.3]){
      plate([x-1.5,.7,-4.7],[x+1.5,1.6,4.6],'enamel','plant-growing-trough');
      plate([x-1.25,1.6,-4.45],[x+1.25,1.78,4.35],'ivory','plant-growing-bed');
      const upright = x + Math.sign(x) * 1.3;
      rod([upright,1.6,-4],[upright,5.8,-4],.17,'steel','grow-light-upright');
      rod([upright,5.8,-4],[x,5.8,-4],.17,'steel','grow-light-arm');
      plate([x-.35,5.5,-4.25],[x+.35,5.94,4.0],'ivory','grow-light-bar');
      rod([x,1.1,4.5],[x,1.1,6.2],.26,'steel','bed-return-elbow');
      rod([x,1.1,6.2],[0,1.1,6.2],.26,'steel','bed-return-manifold');
      const foliage:any[]=[];
      for(const z of [-3.3,-.7,1.9,3.5]){
        rod([x,1.75,z],[x,4.1,z],.07,'enamel','plant-inner-stem');
        for(const sign of [-1,1]){
          const g=new T.SphereGeometry(.85*s,12,8);g.scale(1,.2,.55);g.rotateZ(sign*.4);g.translate(...p(x+sign*.6,3.2,z));foliage.push(g);
        }
      }
      add(mergeInstrumentGeometry(foliage),'plant','rooted-inner-plant-leaves');
    }
    rod([0,1.1,6.2],[0,1.1,8.4],.3,'steel','manifold-service-connection');
  }else if(index===2){
    for(const x of [-4.5,4.5]){
      rod([x,.7,-1],[x,1.3,-1],2,'enamel','filter-floor-seat');
      rod([x,1.3,-1],[x,7.9,-1],1.35,'ivory','filter-cartridge-body');
      for(const y of [1.4,7.7])rod([x,y-.15,-1],[x,y+.15,-1],1.65,'brass','filter-cartridge-flange');
    }
    // A true axle-supported fan casing surrounds the existing response rotor.
    const g=new T.TorusGeometry(3.3*s,.32*s,10,48);g.translate(...p(0,4,9.05));add(g,'brass','filter-rotor-bearing-ring');
    for(const x of [-2.8,2.8])rod([x,.7,8.9],[x,2.6,8.9],.2,'steel','filter-bearing-feet');
  }else{
    for(const x of [-3.8,3.8])for(const z of [6.9,9.7])rod([x,.7,z],[x,6.5,z],.2,'steel','reservoir-frame-upright');
    for(const y of [.8,6.5]){
      plate([-4,y,6.5],[4,y+.27,10],'enamel','reservoir-frame-crosshead');
    }
    plate([-3.6,.9,6.55],[3.6,6.4,6.9],'ivory','reservoir-back-wall');
    for(const x of [-4.3,4.3]){
      plate([x-1.4,.7,-4.5],[x+1.4,3.1,-1],'enamel','reserve-supply-locker');
      plate([x-1.25,3.1,-4.4],[x+1.25,3.3,-1.1],'brass','reserve-locker-lid');
    }
  }
  return{window,meshes,hatchHandles,hatchSurfaces,setOpening};
}
