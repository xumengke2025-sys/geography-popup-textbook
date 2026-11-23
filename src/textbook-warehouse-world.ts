import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, ModelMotion, Vec3 } from './textbook-geometry';
import { warehouseDistricts,warehouseSelector } from './textbook-warehouse-cabinet';
import { applyEarthScan } from './textbook-earth-scan';
import { chamferedPlateGeometry, mergeInstrumentGeometry, turnedShaftGeometry } from './textbook-instrument-parts';
import { WAREHOUSE_SITES, warehouseRiverX, WAREHOUSE_WATER_LEVEL as level, warehouseHeight as height,
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
  plate([1,.1,4],[99,1.15,80],'wood','thin-map-specimen-edge');
  plate([1.4,1.15,4.4],[98.6,1.5,79.6],'brass','map-registration-lip');
  plate([1.9,1.5,4.9],[98.1,1.9,79.1],'enamel','recessed-map-deck');
  // One closed relief volume, including the river incision and its banks.
  const positions:number[]=[],indices:number[]=[],vertexColors:number[]=[],facies:number[]=[];
  const nx=122,nz=80,x0=3,x1=97,z0=6,z1=68;
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=x0+(x1-x0)*i/nx,z=z0+(z1-z0)*j/nz,y=height(x,z);
    positions.push(...p(x,y,z));
    const bank=Math.max(0,1-Math.abs(x-warehouseRiverX(z))/9.5);
    const rock=Math.max(0,Math.min(.88,(y-7.3)/13+.105*Math.sin(x*.4+z*.3)));
    const turf=Math.min(1-bank,1-rock)*(.57+.12*Math.sin(x*.19-z*.09));
    facies.push(rock,bank*(1-rock),Math.max(0,Math.min(turf,1-rock-bank*(1-rock))));
    const color=new T.Color('#788263').lerp(new T.Color('#947f5c'),rock*.97).lerp(new T.Color('#a39770'),bank*.79);
    const slope=(height(x-.7,z-.2)-height(x+.7,z+.2))*.16;
    color.multiplyScalar(.95+slope+.045*Math.sin(x*.33+Math.sin(z*.34))+.038*Math.sin(z*.27-x*.13));
    vertexColors.push(color.r,color.g,color.b);
    if(i<nx&&j<nz){const a=j*(nx+1)+i,c=a+nx+1;indices.push(a,c,a+1,a+1,c,c+1);}
  }
  const boundary:number[]=[];
  for(let i=0;i<=nx;i++)boundary.push(i);
  for(let j=1;j<=nz;j++)boundary.push(j*(nx+1)+nx);
  for(let i=nx-1;i>=0;i--)boundary.push(nz*(nx+1)+i);
  for(let j=nz-1;j>0;j--)boundary.push(j*(nx+1));
  const wallStart=positions.length/3,n=boundary.length;
  for(const [layer,offset] of [0,.18,.51,1].entries())for(const k of boundary){
    const x=positions[k*3],z=positions[k*3+2],surface=positions[k*3+1];
    const bed=1.92*s,subtle=(layer===1||layer===2)?.13*s*Math.sin((x+z)*.26/s):0;
    positions.push(x,surface-(surface-bed)*offset+subtle,z);
    const shade=new T.Color(['#726d4f','#725a43','#aa9169','#7c786b'][layer]);
    vertexColors.push(shade.r,shade.g,shade.b);facies.push(layer>1?.58:.12,.22,0);
  }
  for(let layer=0;layer<3;layer++)for(let i=0;i<n;i++){
    const j=(i+1)%n,a=wallStart+n*layer+i,c=wallStart+n*layer+j;
    indices.push(a,a+n,c,c,a+n,c+n);
  }
  // Deck seals the underside; sidewalls have their own hard normals.
  const relief=new T.BufferGeometry();relief.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  relief.setAttribute('color',new T.Float32BufferAttribute(vertexColors,3));relief.setIndex(indices);relief.computeVertexNormals();
  relief.setAttribute('facies',new T.Float32BufferAttribute(facies,3));
  const surface=part(relief,'#ffffff','land','continuous-incised-relief');surface.material.vertexColors=true;applyEarthScan(surface.material,'valley',11*s);
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
  const wet:number[]=[],wetColors:number[]=[];
  const shallow=new T.Color('#bbd1bd'),deep=new T.Color('#527e88'),waterColor=new T.Color();
  const waterVertex=(point:any,top:boolean)=>{
    const depth=Math.max(0,level-point.y/s);
    waterColor.copy(shallow).lerp(deep,Math.min(1,depth/1.8));
    if(!top)waterColor.multiplyScalar(.77);
    wet.push(point.x,top?(level+.025)*s:point.y,point.z);
    wetColors.push(waterColor.r,waterColor.g,waterColor.b);
  };
  for(let k=0;k<nx*nz*6;k+=3){
    let poly=indices.slice(k,k+3).map(i=>new T.Vector3(positions[i*3],positions[i*3+1],positions[i*3+2]));
    const out:any[]=[];
    for(let j=0;j<poly.length;j++){
      const a=poly[j],c=poly[(j+1)%poly.length],inside=a.y<=level*s,next=c.y<=level*s;
      if(inside)out.push(a);if(inside!==next)out.push(a.clone().lerp(c,(level*s-a.y)/(c.y-a.y)));
    }
    poly=out;
    for(let j=1;j<poly.length-1;j++)for(const a of [poly[0],poly[j],poly[j+1]])waterVertex(a,true);
    // The two cut ends expose the channel profile down to the actual bed.
    for(let j=0;j<poly.length;j++){
      const a=poly[j],c=poly[(j+1)%poly.length];
      if(Math.abs(a.z-c.z)>1e-5||!([z0,z1].some(z=>Math.abs((a.z-back)/s-z)<1e-5)))continue;
      waterVertex(a,true);waterVertex(c,false);waterVertex(c,true);
      waterVertex(a,true);waterVertex(a,false);waterVertex(c,false);
    }
  }
  const floodGeo=new T.BufferGeometry();floodGeo.setAttribute('position',new T.Float32BufferAttribute(wet,3));floodGeo.computeVertexNormals();
  floodGeo.setAttribute('color',new T.Float32BufferAttribute(wetColors,3));
  const flood=part(floodGeo,'#ffffff','water','terrain-clipped-high-water');
  flood.material.vertexColors=true;flood.material.roughness=.36;flood.material.opacity=.91;flood.userData.fixedHighWater=true;
  // The road strips follow both edges of each approach over the relief.
  const ribbon=(route:MapPoint[],width:number,lift:number,color:string,name:string)=>{
    const points=sampleWarehouseRoute(route),v:number[]=[],ix:number[]=[];
    for(let i=0;i<points.length;i++){
      const [x,z]=points[i],a=points[Math.max(0,i-1)],c=points[Math.min(points.length-1,i+1)];
      const len=Math.hypot(c[0]-a[0],c[1]-a[1])||1,dx=-(c[1]-a[1])/len*width/2,dz=(c[0]-a[0])/len*width/2;
      for(const sign of [-1,1]){const xx=x+sign*dx,zz=z+sign*dz;v.push(...p(xx,height(xx,zz)+lift,zz))}
      if(i<points.length-1){const a=i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2)}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();
    return part(g,color,'rock',name);
  };
  const routes=[0,1,2].map(warehouseRoutes);
  // All roads remain visible during the comparison, including the winding
  // mountain approach. Only the selected service evidence is picked out.
  for(const [i,row] of routes.entries())for(const [j,route] of row.entries()){
    ribbon(route,1.57,.055,'#86775b',`road-shoulder-${i}-${j}`);
    ribbon(route,1.12,.084,'#c1ac82',`road-${i}-${j}`);
  }
  const activeRoutes=routes.map((row,i)=>row.map((route,j)=>ribbon(route,.61,.14,'#964d36',`selected-route-${i}-${j}`)));
  const roofs:any[]=[];
  const roofEnamel=b.materialFor('enamel','#4f655d');
  const selectedEnamel=b.materialFor('enamel','#964d36');
  const siteMeshes:any[][]=[];
  // Loading ramps join the level door threshold to the existing relief road.
  // Their side walls reach the same terrain, rather than hovering as boxes.
  const loadingRamp=(x:number,z:number,y:number)=>{
    const positions:number[]=[],nx=4,nz=8;
    for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
      const vertex=(ii:number,jj:number):Vec3=>{
        const xx=x-2.2+4.4*ii/nx,q=jj/nz,zz=z+3.75+1.95*q;
        return p(xx,(y+1)*(1-q)+(height(xx,z+5.7)+.08)*q,zz);
      };
      const a=vertex(i,j),c=vertex(i+1,j),d=vertex(i,j+1),e=vertex(i+1,j+1);
      positions.push(...a,...d,...c,...c,...d,...e);
    }
    for(const side of [-1,1])for(let j=0;j<nz;j++){
      const edge=(q:number):Vec3=>{const xx=x+side*2.2,zz=z+3.75+1.95*q;return p(xx,(y+1)*(1-q)+(height(xx,z+5.7)+.08)*q,zz)};
      const a=edge(j/nz),c=edge((j+1)/nz),d=p(x+side*2.2,height(x+side*2.2,z+3.75+1.95*j/nz),z+3.75+1.95*j/nz),e=p(x+side*2.2,height(x+side*2.2,z+3.75+1.95*(j+1)/nz),z+3.75+1.95*(j+1)/nz);
      if(side<0)positions.push(...a,...d,...c,...c,...d,...e);else positions.push(...a,...c,...d,...c,...e,...d);
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    return part(geometry,colors.steel,'steel','terrain-contact-loading-ramp');
  };
  const warehouse=(x:number,z:number,index:number)=>{
    const y=height(x,z),start=b.meshes.length;
    plate([x-5.4,y,z-4.4],[x+5.4,y+.55,z+3.75],'ivory','warehouse-loading-apron');
    // A storehouse is wider and lower than a dwelling. The loading door,
    // dock and route meet at exactly the same front point.
    plate([x-4.8,y+.55,z-3.6],[x+4.8,y+5.7,z-3.12],'ivory','warehouse-masonry');
    for(const sign of [-1,1]){
      const xx=x+sign*4.56;
      plate([xx-.24,y+.55,z-3.16],[xx+.24,y+5.7,z+3.53],'ivory','warehouse-sidewall');
      const jamb=x+sign*3.18;
      plate([jamb-1.62,y+.55,z+3.12],[jamb+1.62,y+5.7,z+3.6],'ivory','warehouse-door-jamb');
    }
    plate([x-1.64,y+4.64,z+3.12],[x+1.64,y+5.7,z+3.6],'ivory','warehouse-loading-lintel');
    plate([x-1.59,y+3.98,z+3.61],[x+1.59,y+4.72,z+3.72],'enamel','raised-loading-shutter');
    plate([x-2.2,y+.55,z+3.6],[x+2.2,y+1,z+3.75],'steel','loading-dock');
    loadingRamp(x,z,y);
    // Close both gables under the ridge and give the shed a continuous wall
    // even when the book is rotated towards its uphill end.
    const gables:number[]=[];
    for(const end of [-1,1]){
      const gz=z+end*3.6;
      const a=p(x-4.8,y+5.7,gz),ridge=p(x,y+7.25,gz),c=p(x+4.8,y+5.7,gz);
      gables.push(...a,...(end>0?c:ridge),...(end>0?ridge:c));
    }
    const gableGeo=new T.BufferGeometry();
    gableGeo.setAttribute('position',new T.Float32BufferAttribute(gables,3));
    gableGeo.computeVertexNormals();
    part(gableGeo,colors.ivory,'ivory','masonry-gables');
    const roofParts:any[]=[];
    for(const sign of [-1,1]){
      const g=chamferedPlateGeometry([0,0,-4.2*s],[5.5*s,.28*s,4.2*s],.06*s);
      g.rotateZ(sign>0?-.27:Math.PI+.27);g.translate(...p(x,y+7.25,z));roofParts.push(g);
    }
    const roof=part(mergeInstrumentGeometry(roofParts),'#4f655d','enamel','pitched-storehouse-roof');
    roofs.push(roof);
    const seams:any[]=[];
    for(const direction of [-1,1])for(const zOffset of [-3,-1.5,0,1.5,3]){
      seams.push(turnedShaftGeometry(p(x,y+7.55,z+zOffset),
        p(x+direction*5.28,y+6.08,z+zOffset),[[.07*s,0],[.07*s,1]]));
    }
    seams.push(turnedShaftGeometry(p(x,y+7.55,z-4.25),p(x,y+7.55,z+4.25),[[.17*s,0],[.17*s,1]]));
    part(mergeInstrumentGeometry(seams),'#727d72','steel','folded-roof-seams');
    const grooves:any[]=[];for(let j=0;j<3;j++)grooves.push(turnedShaftGeometry(p(x-1.6,y+4.04+j*.24,z+3.76),p(x+1.6,y+4.04+j*.24,z+3.76),[[.025*s,0],[.025*s,1]]));
    part(mergeInstrumentGeometry(grooves),'#a5aaa0','steel','loading-door-slats');
    const own=b.meshes.slice(start);own.forEach(m=>m.userData.modelInput={kind:'select',selection:index,label:`比较${['近河低地','路网节点','偏远山地'][index]}库址`});siteMeshes.push(own);
  };
  WAREHOUSE_SITES.forEach(([x,z],i)=>warehouse(x,z,i));
  warehouseDistricts(b,s,p(0,0,0));
  const turnSelector=warehouseSelector(b,s,p);
  // Numbered selector inlays are part of the actual map rim, not free-standing
  // title cards. Full candidate names remain in the existing DOM controls.
  const selectors=WAREHOUSE_SITES.map((_,i)=>{
    const x=20+i*30;
    plate([x-13.25,1.91,68.55],[x+13.25,2.04,78.75],'brass','candidate-brass-bezel');
    const seat=plate([x-12.7,1.91,69],[x+12.7,2.17,78.2],'ivory','candidate-index-inlay');
    const label=b.label(['甲 · 近河','乙 · 路口','丙 · 山地'][i],p(x,2.23,73.6),24.5*s,7.45*s,{appearance:'engraved'});label.rotation.x=-Math.PI/2;label.userData.labelMount='surface';label.userData.reliefPart='candidate-index-label';
    for(const m of [seat,label])m.userData.modelInput={kind:'select',selection:i,label:`选择${['近河低地','路网节点','偏远山地'][i]}库址`};return{seat,label};
  });
  let mode=0, roofSelection=-1;
  return {
    update(_phase,selection){
      mode=Math.max(0,Math.min(2,Math.round(selection)));
      if(roofSelection!==mode){
        turnSelector(mode);
        roofs.forEach((roof,i)=>roof.material=i===mode?selectedEnamel:roofEnamel);
        roofSelection=mode;
      }
      activeRoutes.forEach((row,i)=>row.forEach(m=>m.visible=i===mode));
      selectors.forEach(({seat,label},i)=>{const lift=(i===mode?.24:0)*s;seat.position.y=lift;label.position.y=2.23*s+lift});
      // The vulnerable approach stays visibly under the same water, even
      // when another candidate is selected. It cannot become a passable
      // animated delivery simply because the student clicked its roof.
      siteMeshes[mode].slice(0,1).forEach(m=>b.outline(m,.55));
    },
    focusBounds:()=>({min:p(0,-2.2,3),max:p(103,30,85.2)}),
    describe:()=>({kind:'relief-warehouse-location',construction:'connected-cartographic-specimen',candidate:['river-lowland','road-junction','remote-hill'][mode],
      settlementCount:3,roadNetworkUsed:true,lowlandExposure:mode===0,sharedHighWaterScenario:true,roadsFollowRelief:true,
      routeParcelsAreStatic:true,schematicSiteComparison:true,optimalSiteComputed:false,realLocations:false,timedServiceArea:false,
      roadsMeetLoadingAprons:true,floodClippedToSameTerrain:true,detachedTitleCards:0,waterLevelUnits:'illustrative'})
  };
}