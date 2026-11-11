import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, ModelMotion, Vec3 } from './textbook-geometry';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { WAREHOUSE_SITES, WAREHOUSE_TOWNS, WAREHOUSE_WATER_LEVEL as level, warehouseHeight as height,
  warehouseRoutes, sampleWarehouseRoute, type MapPoint } from './textbook-warehouse-relief';

/** A cartographic relief specimen: bronze is confined to the map's lower
 * registration hardware. The hills, roads, warehouses and inundation remain
 * geographical objects, with their own connected surfaces and entrances. */
export function buildWarehouseWorld(b:TextbookGeometry):ModelMotion {
  const s=b.width/100,back=-96-78*s, p=(x:number,y:number,z:number):Vec3=>[x*s,y*s,back+z*s];
  const colors={wood:'#584233',brass:'#b59a64',enamel:'#30483e',ivory:'#e1d9c5',steel:'#8c9590'};
  const part=(geo:any,color:string,role:any,name:string)=>{
    const m=b.mesh(geo,color,false,true,role);m.name=name;m.userData.reliefPart=name;return m;
  };
  const plate=(a:Vec3,c:Vec3,role:keyof typeof colors,name:string)=>part(chamferedPlateGeometry(p(...a),p(...c),.18*s),colors[role],role,name);
  plate([1,.1,4],[99,1.15,76],'wood','thin-map-specimen-edge');
  plate([1.4,1.15,4.4],[98.6,1.5,75.6],'brass','map-registration-lip');
  plate([1.9,1.5,4.9],[98.1,1.9,75.1],'enamel','recessed-map-deck');
  // One closed relief volume, including the river incision and its banks.
  const positions:number[]=[],indices:number[]=[],vertexColors:number[]=[];
  const nx=80,nz=50,x0=3,x1=97,z0=6,z1=68;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=x0+(x1-x0)*i/nx,z=z0+(z1-z0)*j/nz,y=height(x,z);
    positions.push(...p(x,y,z));
    const color=new T.Color('#8b9d78').lerp(new T.Color('#b5ad8c'),Math.min(1,(y-5.2)/14));
    color.multiplyScalar(1+.018*Math.sin(x*1.3+z*.8));vertexColors.push(color.r,color.g,color.b);
    if(i<nx&&j<nz){const a=j*(nx+1)+i,c=a+nx+1;indices.push(a,c,a+1,a+1,c,c+1);}
  }
  const boundary:number[]=[];
  for(let i=0;i<=nx;i++)boundary.push(i);
  for(let j=1;j<=nz;j++)boundary.push(j*(nx+1)+nx);
  for(let i=nx-1;i>=0;i--)boundary.push(nz*(nx+1)+i);
  for(let j=nz-1;j>0;j--)boundary.push(j*(nx+1));
  const topCount=positions.length/3;
  boundary.forEach(k=>{positions.push(positions[k*3],1.92*s,positions[k*3+2]);vertexColors.push(.37,.37,.27)});
  boundary.forEach((a,i)=>{const j=(i+1)%boundary.length,c=boundary[j],d=topCount+i,e=topCount+j;indices.push(a,d,c,c,d,e)});
  // Deck seals the underside; sidewalls have their own hard normals.
  const relief=new T.BufferGeometry();relief.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  relief.setAttribute('color',new T.Float32BufferAttribute(vertexColors,3));relief.setIndex(indices);relief.computeVertexNormals();
  const surface=part(relief,'#ffffff','land','continuous-incised-relief');surface.material.vertexColors=true;
  // Unnumbered contour lines belong to this very surface. They reveal why
  // the mountain approach turns, without pretending to surveyed elevations.
  for(const elevation of [7,10,13,16])for(let k=0;k<nx*nz*6;k+=3){
    const tri=indices.slice(k,k+3),crossings:Vec3[]=[];
    for(let j=0;j<3;j++){
      const a=tri[j]*3,c=tri[(j+1)%3]*3,ay=positions[a+1]/s,cy=positions[c+1]/s;
      if((ay<elevation)!==(cy<elevation)){
        const q=(elevation-ay)/(cy-ay);crossings.push([positions[a]+(positions[c]-positions[a])*q,(elevation+.035)*s,positions[a+2]+(positions[c+2]-positions[a+2])*q]);
      }
    }
    if(crossings.length===2)b.stroke(crossings,.17);
  }
  // Clip the fixed level to the *same* triangulation as the solid terrain.
  const wet:number[]=[];
  for(let k=0;k<nx*nz*6;k+=3){
    let poly=indices.slice(k,k+3).map(i=>new T.Vector3(positions[i*3],positions[i*3+1],positions[i*3+2]));
    const out:any[]=[];
    for(let j=0;j<poly.length;j++){
      const a=poly[j],c=poly[(j+1)%poly.length],inside=a.y<=level*s,next=c.y<=level*s;
      if(inside)out.push(a);if(inside!==next)out.push(a.clone().lerp(c,(level*s-a.y)/(c.y-a.y)));
    }
    poly=out;for(let j=1;j<poly.length-1;j++)for(const a of [poly[0],poly[j],poly[j+1]])wet.push(a.x,level*s+.025*s,a.z);
  }
  const floodGeo=new T.BufferGeometry();floodGeo.setAttribute('position',new T.Float32BufferAttribute(wet,3));floodGeo.computeVertexNormals();
  const flood=part(floodGeo,'#84b2b2','water','terrain-clipped-high-water');flood.userData.fixedHighWater=true;
  // A narrow, dark channel below the high-water surface gives the banks a
  // readable depth rather than drawing a round blue pipe over the hillside.
  const ribbon=(route:MapPoint[],width:number,lift:number,color:string,name:string)=>{
    const points=sampleWarehouseRoute(route),v:number[]=[],ix:number[]=[];
    for(let i=0;i<points.length;i++){
      const [x,z]=points[i],a=points[Math.max(0,i-1)],c=points[Math.min(points.length-1,i+1)];
      const len=Math.hypot(c[0]-a[0],c[1]-a[1])||1,dx=-(c[1]-a[1])/len*width/2,dz=(c[0]-a[0])/len*width/2;
      for(const sign of [-1,1]){const xx=x+sign*dx,zz=z+sign*dz;v.push(...p(xx,height(xx,zz)+lift,zz))}
      if(i<points.length-1){const a=i*2;ix.push(a,a+2,a+1,a+1,a+2,a+3)}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();
    return part(g,color,'rock',name);
  };
  const routes=[0,1,2].map(warehouseRoutes);
  // All roads remain visible during the comparison, including the winding
  // mountain approach. Only the selected service evidence is picked out.
  routes.forEach((row,i)=>row.forEach((route,j)=>ribbon(route,1.12,.08,'#d0c4a7',`road-${i}-${j}`)));
  const activeRoutes=routes.map((row,i)=>row.map((route,j)=>ribbon(route,.42,.14,'#ae8851',`selected-route-${i}-${j}`)));
  const siteMeshes:any[][]=[];
  const warehouse=(x:number,z:number,index:number)=>{
    const y=height(x,z),start=b.meshes.length;
    plate([x-5.4,y,z-4.4],[x+5.4,y+.55,z+5.7],'ivory','warehouse-loading-apron');
    // A storehouse is wider and lower than a dwelling. The loading door,
    // dock and route meet at exactly the same front point.
    plate([x-4.8,y+.55,z-3.6],[x+4.8,y+5.7,z+3.6],'ivory','warehouse-masonry');
    plate([x-1.8,y+.6,z+3.61],[x+1.8,y+4.8,z+3.72],'enamel','loading-door');
    plate([x-2.2,y+.55,z+3.75],[x+2.2,y+1,z+5.7],'steel','loading-dock');
    const roofParts:any[]=[];
    for(const sign of [-1,1]){
      const g=chamferedPlateGeometry([0,0,-4.2*s],[5.5*s,.28*s,4.2*s],.06*s);
      g.rotateZ(sign>0?-.27:Math.PI+.27);g.translate(...p(x,y+7.25,z));roofParts.push(g);
    }
    part(mergeInstrumentGeometry(roofParts),'#4f655d','enamel','pitched-storehouse-roof');
    const grooves:any[]=[];for(let j=0;j<5;j++)grooves.push(turnedShaftGeometry(p(x-1.6,y+1.3+j*.65,z+3.76),p(x+1.6,y+1.3+j*.65,z+3.76),[[.025*s,0],[.025*s,1]]));
    part(mergeInstrumentGeometry(grooves),'#a5aaa0','steel','loading-door-slats');
    const own=b.meshes.slice(start);own.forEach(m=>m.userData.modelInput={kind:'select',selection:index,label:`比较${['近河低地','路网节点','偏远山地'][index]}库址`});siteMeshes.push(own);
  };
  WAREHOUSE_SITES.forEach(([x,z],i)=>warehouse(x,z,i));
  WAREHOUSE_TOWNS.forEach(([x,z])=>{b.house(p(x,height(x,z),z),5.1*s,3.9*s);b.house(p(x+5.2,height(x+5.2,z-2),z-2),3.4*s,2.8*s)});
  // Numbered selector inlays are part of the actual map rim, not free-standing
  // title cards. Full candidate names remain in the existing DOM controls.
  const selectors=WAREHOUSE_SITES.map((_,i)=>{
    const x=29+i*21;const seat=plate([x-7.2,1.91,69],[x+7.2,2.17,74.1],'ivory','candidate-index-inlay');
    const label=b.label(['甲 · 近河','乙 · 路口','丙 · 山地'][i],p(x,2.23,71.6),13.2*s,3.8*s,{appearance:'engraved'});label.rotation.x=-Math.PI/2;label.userData.labelMount='surface';
    for(const m of [seat,label])m.userData.modelInput={kind:'select',selection:i,label:`选择${['近河低地','路网节点','偏远山地'][i]}库址`};return seat;
  });
  let mode=0;
  return {
    update(_phase,selection){
      mode=Math.max(0,Math.min(2,Math.round(selection)));
      activeRoutes.forEach((row,i)=>row.forEach(m=>m.visible=i===mode));
      selectors.forEach((m,i)=>{m.position.y=(i===mode?.24:0)*s});
      // The vulnerable approach stays visibly under the same water, even
      // when another candidate is selected. It cannot become a passable
      // animated delivery simply because the student clicked its roof.
      siteMeshes[mode].slice(0,1).forEach(m=>b.outline(m,.55));
    },
    focusBounds:()=>({min:p(0,0,3),max:p(100,30,77)}),
    describe:()=>({kind:'relief-warehouse-location',construction:'connected-cartographic-specimen',candidate:['river-lowland','road-junction','remote-hill'][mode],
      settlementCount:3,roadNetworkUsed:true,lowlandExposure:mode===0,sharedHighWaterScenario:true,roadsFollowRelief:true,
      routeParcelsAreStatic:true,schematicSiteComparison:true,optimalSiteComputed:false,realLocations:false,timedServiceArea:false,
      roadsMeetLoadingAprons:true,floodClippedToSameTerrain:true,detachedTitleCards:0,waterLevelUnits:'illustrative'})
  };
}
