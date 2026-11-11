import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';

/** Cutaway teaching modules, not an engineering design for Mars. The front
 * sector has two genuinely hinged shell leaves. Opening them exposes the
 * receiving parts on the cabin floor; the roof remains a readable cutaway. */
export function buildMarsCabin(b:TextbookGeometry,at:Vec3,s:number,index:number){
  const p=(x:number,y:number,z:number):Vec3=>[at[0]+x*s,at[1]+y*s,at[2]+z*s];
  const meshes:any[]=[],colors={ivory:'#ded8c7',enamel:'#364b43',brass:'#b39964',steel:'#9ca39a'};
  const add=(g:any,role:keyof typeof colors,name:string)=>{
    const m=b.mesh(g,colors[role],false,true,role);m.name=name;m.userData.cabinPart=name;m.userData.moduleIndex=index;meshes.push(m);return m;
  };
  const rod=(a:Vec3,c:Vec3,r:number,role:keyof typeof colors,name:string)=>add(turnedShaftGeometry(p(...a),p(...c),[[r*s,0],[r*s,1]]),role,name);
  const plate=(a:Vec3,c:Vec3,role:keyof typeof colors,name:string)=>add(chamferedPlateGeometry(p(...a),p(...c),.1*s),role,name);
  // Three short feet, a recessed floor and a real open front sector.
  for(const angle of [Math.PI/2,Math.PI*7/6,Math.PI*11/6]){
    const x=Math.cos(angle)*8,z=Math.sin(angle)*8;
    rod([x,-1.6,z],[x,.2,z],.9,'steel','cabin-short-foot');
    rod([x,-1.7,z],[x,-1.3,z],1.4,'enamel','cabin-ground-pad');
  }
  for(const [y,r,h,role] of [[-.1,11.3,.55,'enamel'],[.25,11,.24,'brass'],[.52,10.65,.3,'ivory']] as const){
    const g=new T.CylinderGeometry(r*s,r*s,h*s,64);g.translate(...p(0,y,0));add(g,role,'cabin-floor-lamination');
  }
  plate([-7,.25,7],[7,.65,13.5],'ivory','continuous-front-service-apron');
  const start=Math.PI/3,arc=Math.PI*4/3;
  for(const radius of [10.6,10.18]){
    const g=new T.CylinderGeometry(radius*s,radius*s,7*s,64,1,true,start,arc);g.translate(...p(0,4.15,0));add(g,'ivory','open-sector-wall');
  }
  // Vertical jambs are the real hinge axes, not an unrelated decorative frame.
  for(const angle of [start,start+arc]){
    const x=Math.sin(angle)*10.4,z=Math.cos(angle)*10.4;
    rod([x,.65,z],[x,7.8,z],.36,'brass','cut-edge-wall-jamb');
  }
  const rim=(radius:number,y:number,role:keyof typeof colors,tube=.17)=>{
    const points=Array.from({length:65},(_,i)=>{const a=start+i/64*arc;return new T.Vector3(...p(Math.sin(a)*radius,y,Math.cos(a)*radius))});
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points),64,tube*s,8,false),role,'open-sector-flange');
  };
  rim(10.45,.7,'brass',.22);rim(10.45,7.7,'brass',.22);
  const shellPivots:any[]=[],hatchHandles:any[]=[],hatchSurfaces:any[]=[];
  for(const side of [-1,1]){
    const angle=side*Math.PI/3,hinge=p(Math.sin(angle)*10.4,4.15,Math.cos(angle)*10.4);
    const pivot=new T.Group();pivot.position.set(...hinge);b.root.add(pivot);shellPivots.push(pivot);
    const mounted=(geometry:any,role:keyof typeof colors,name:string)=>{
      geometry.translate(-hinge[0],-hinge[1],-hinge[2]);
      const m=add(geometry,role,name);pivot.add(m);hatchSurfaces.push(m);return m;
    };
    for(const radius of [10.6,10.18]){
      const g=new T.CylinderGeometry(radius*s,radius*s,6.8*s,28,1,true,side<0?-Math.PI/3:.04,Math.PI/3-.04);
      g.translate(...p(0,4.15,0));mounted(g,'ivory','hinged-front-shell');
    }
    const rimPoints=Array.from({length:21},(_,i)=>{const a=side*(.04+i/20*(Math.PI/3-.04));return new T.Vector3(...p(Math.sin(a)*10.42,7.58,Math.cos(a)*10.42));});
    mounted(new T.TubeGeometry(new T.CatmullRomCurve3(rimPoints),24,.15*s,6),'brass','shell-top-seam');
    // A small pull is fixed to the shell itself and moves with its hinge.
    const pull=new T.TorusGeometry(.68*s,.16*s,7,18,Math.PI*1.4);pull.rotateY(side*.23);pull.translate(...p(side*2.6,4.5,10.7));
    const handle=mounted(pull,'brass','shell-opening-pull');handle.userData.shellIndex=index;hatchHandles.push(handle);
  }
  const setOpening=(fraction:number)=>{
    const amount=Math.max(0,Math.min(1,fraction));
    shellPivots.forEach((pivot,i)=>{pivot.rotation.y=(i===0?-1:1)*amount*Math.PI*.63;});
  };
  setOpening(.82);
  // The rear half of a shallow cap keeps the object legible as a habitat,
  // leaving a broad sight line to every receiver on its continuous floor.
  const roof=new T.SphereGeometry(10.6*s,40,16,Math.PI,Math.PI,0,Math.PI/2);roof.scale(1,.52,1);roof.translate(...p(0,7.65,0));
  add(roof,'ivory','rear-half-roof-cutaway');
  const ribs:any[]=[];
  for(let j=0;j<=6;j++){
    const az=Math.PI+j/6*Math.PI,pts=Array.from({length:25},(_,i)=>{
      const t=i/24*Math.PI/2;return new T.Vector3(...p(-10.68*Math.cos(az)*Math.sin(t),7.65+5.55*Math.cos(t),10.68*Math.sin(az)*Math.sin(t)));
    });ribs.push(new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.085*s,6,false));
  }
  add(mergeInstrumentGeometry(ribs),'steel','rear-cap-seams');
  // A wall-mounted service strip replaces the old flat exterior window.
  plate([-5.7,4.2,-9.3],[5.7,7.3,-8.88],'enamel','internal-service-panel');
  const window=b.mesh(chamferedPlateGeometry(p(-4.8,4.7,-8.82),p(4.8,6.8,-8.69),.035*s),'#aabfc1',false,true,'ivory');
  window.userData.cabinPart='arrival-indicator-in-wall';meshes.push(window);
  // Fitted nameplate: its glyph plane is attached to the front fascia.
  plate([-6.7,-.55,13.3],[6.7,1.45,13.7],'enamel','front-nameplate-seat');
  const name=b.label(['乘员舱','植物舱','生保舱','资源舱'][index],p(0,.45,13.75),11.4*s,3*s,{appearance:'engraved',ink:'#e5dbc2'});
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
      const foliage:any[]=[];
      for(const z of [-3.3,-.7,1.9,3.5]){
        rod([x,1.75,z],[x,4.1,z],.07,'enamel','plant-inner-stem');
        for(const sign of [-1,1]){
          const g=new T.SphereGeometry(.85*s,12,8);g.scale(1,.2,.55);g.rotateZ(sign*.4);g.translate(...p(x+sign*.6,3.2,z));foliage.push(g);
        }
      }
      add(mergeInstrumentGeometry(foliage),'enamel','rooted-inner-plant-leaves');
    }
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
