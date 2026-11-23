import { mountFieldInstrument } from './textbook-field-instruments';
import { applyEarthScan } from './textbook-earth-scan';
import { evaluateCaveDeposition, evaluateKarstCover } from './textbook-ground-process-model';
import { karstPhaseSection, soilMantleHeight } from './textbook-karst-terrain';
import { LIFT_MARGIN, type ModelMotion, type TextbookGeometry, type Vec3 } from './textbook-geometry';

type Specimen = 'karst-cave'|'karst-livelihood';
export function buildKarstObserver(b: TextbookGeometry, id: Specimen): ModelMotion {
  const cave = id === 'karst-cave', s = b.width / 100, z0 = -LIFT_MARGIN - b.height * .62;
  const point = (x: number, h: number, depth: number): Vec3 => [x*s,h*s,z0+depth*s];
  const parts = mountFieldInstrument(b,id,s,point(0,0,0));
  const group = (g:string) => parts.get(g)!;
  const names = cave ? ['观察洞腔','观察滴水沉积'] : ['观察植被覆盖','观察破坏与侵蚀','观察雨涝晴旱','观察立体农业'];
  const keys = names.map((label,i) => {
    const meshes=group('key'+i);
    for(const mesh of meshes){
      mesh.userData.modelInput={kind:'select',selection:i,keepPhase:true,label};
      mesh.userData.smallPointTarget=true;
    }
    return meshes;
  });
  const start=karstPhaseSection(id,0),end=karstPhaseSection(id,1);
  const track={start:point(start,4.8,57.9),end:point(end,4.8,57.9)};
  const cursor=group('cursor');
  for(const mesh of cursor)mesh.userData.modelInput={kind:'phase-track',track,
    label:cave?'推拉视准游标，查看滴水和沉积':'推拉取样游标，追踪洼地的水土变化'};
  const rockGroups=cave?['arch','back','floor']:['rock'];
  const scanned=new Set();
  for(const name of [...rockGroups,...(cave?[]:['soil'])]){
    for(const mesh of group(name)){
      if(scanned.has(mesh.material))continue;
      applyEarthScan(mesh.material,name==='soil'?'loam':'outcrop',(name==='soil'?9:18)*s);scanned.add(mesh.material);
    }
  }
  const hull: Vec3[]=[];
  for(const x of [-4,104])for(const depth of [-4.5,72]){
    hull.push(point(x,-4.8,depth),point(x,2,depth));
  }
  for(const depth of [3,48])for(const x of [20,48,77])hull.push(point(x,cave?44:39,depth));
  const focus = {framingPoints:()=>hull,focusBounds:()=>({min:point(-4,-4.8,-4.5),max:point(104,cave?46:41,72)})};
  function moveControls(phase:number,selection:number) {
    for(const mesh of cursor)mesh.position.x=(karstPhaseSection(id,phase)-start)*s;
    keys.forEach((meshes,i)=>{for(const mesh of meshes)mesh.position.y=(selection===i?-.48:0)*s;});
  }
  if(cave){
    let state=evaluateCaveDeposition(0);
    const deposits=state.deposits.map((_,i)=>({top:group('top'+i),low:group('low'+i)}));
    const drops=state.drops.map((_,i)=>group('drop'+i)[0]);
    // Drops are authored at the origin. Keep their anchor independent of the cut's page offset.
    for(const mesh of drops)mesh.geometry.translate(0,0,-z0);
    for(const [i,mesh] of drops.entries())mesh.userData.dropId=i;
    for(const pair of deposits)for(const mesh of [...pair.top,...pair.low])
      mesh.userData.modelInput={kind:'replay',selection:1,label:'从头观察同一滴水点的沉积'};
    const captions=[b.label('石钟乳',point(15,26,49),15*s,5.6*s),b.label('石笋',point(85,8,49),12*s,5.6*s)];
    return {...focus,update(phase,selection) {
      state=evaluateCaveDeposition(phase,selection);moveControls(state.phase,Number(state.deposition));
      deposits.forEach((pair,i)=>{
        const site=state.deposits[i];
        for(const mesh of pair.top){mesh.position.y=site.ceiling*s;mesh.scale.y=site.hanging;}
        for(const mesh of pair.low){mesh.position.y=4*s;mesh.scale.y=site.rising;}
      });
      state.drops.forEach((drop,i)=>{
        const d=state.deposits[drop.site],top=d.ceiling-d.hanging,low=4+d.rising,mesh=drops[i];
        mesh.visible=drop.visible;mesh.position.set(...point(100*drop.u,top+(low-top)*drop.progress,32));
      });
      for(const cap of captions) cap.visible=state.deposition;
      if(state.deposition){
        const left=state.deposits[0],right=state.deposits[2];
        b.contour([point(21,26.3,48),point(26,26.3,43),point(29,left.ceiling-left.hanging*.52,32)],.38);
        b.contour([point(80,8,48),point(77,8,40),point(72,4+right.rising*.50,32)],.38);
      }
    },describe:()=>({kind:'karst-cave',...state,actualVoid:true,retainedBackWall:true,
      originalPagePreserved:true,timeIsGeologicalYears:false,slidePosition:karstPhaseSection(id,state.phase)})};
  }
  let state=evaluateKarstCover(0,0);
  const soil=group('soil'),treePatches=Array.from({length:8},(_,i)=>group('trees'+i)),pool=group('pool')[0],farm=[...group('orchard'),...group('crops')];
  pool.geometry.translate(0,0,-z0);
  const soilAt=(u:number,v:number,delta=0)=>point(3+94*u,soilMantleHeight(u,v)+delta,1.5+51*v);
  const packets=state.particles.map(p=>{
    const mesh=group('packet'+p.id)[0];mesh.geometry.translate(0,0,-z0);mesh.userData.karstSoilPacketId=p.id;return mesh;
  });
  const landUse=['山顶水源林','坡地经济林','洼地粮田'].map((name,i)=>b.label(name,point([40,86,36][i],[40,29,12][i],[15,34,52][i]),19*s,5.1*s));
  return {...focus,update(phase,selection){
    const n=Math.floor(Math.max(0,Math.min(3,selection)));state=evaluateKarstCover(phase,n);
    moveControls(state.phase,n);
    for(const m of soil)m.position.y=-.81*state.loss*s;
    treePatches.forEach((patch,i)=>{for(const m of patch)m.visible=i===3||i===7||state.loss<.16+.11*i;});
    for(const m of farm)m.visible=n===3;
    for(const m of landUse)m.visible=n===3;
    pool.visible=state.wet>.035;
    pool.position.set(...point(50,5.57+.72*state.wet,28.5));
    pool.scale.set(36,1,24);
    state.particles.forEach((p,i)=>{
      packets[i].visible=n===1;
      if(packets[i].visible) packets[i].position.set(...soilAt(p.u,p.v,-.31*state.loss+.44+(p.retained ? .16*(p.id%3) : 0)));
    });
    if(n<3){
      for(const side of [-1,1]){
        const path=Array.from({length:18},(_,j)=>{const t=j/17;
          return soilAt(.5+side*.25*(1-t),.5+.24*t,.26-.14*state.loss);});
        b.trace(path,state.phase,2,n===1?'accent':'flow',1,state.dry ? .30 : .61);
      }
      b.trace([point(50,6.3,40),point(49,5.75,52.7),point(50.8,4.1,52.8),
        point(50.2,3.2,52.8),point(52,1.65,52.8),point(59.1,.75,52.8)],state.phase,2,'flow',1,.7);
    }
    if(n===2&&!state.dry)for(const [u,v] of [[.43,.58],[.52,.62],[.62,.57]]){
      const at=soilAt(u,v,.4);b.trace([[at[0]-s,at[1]+9*s,at[2]],at],state.phase+u,2,'flow',1,.55);
    }
  },describe:()=>({kind:'karst-ecology-and-livelihood',state,selection:['vegetation-protection','erosion-after-clearing','wet-flooding-dry-leakage','agroforestry-zonation'][state.selection],
    weather:state.selection===2?state.dry?'dry':'rainy':'not-specified',fracturesAreSchematic:true,rockDesertificationIsNotInstantaneous:true,
    hydrologicalBalanceIsNotQuantified:true,buffersStable:true,slidePosition:karstPhaseSection(id,state.phase)})};
}
