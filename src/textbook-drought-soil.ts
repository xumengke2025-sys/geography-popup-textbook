import { THREE as T } from './reference/engine.js';
import { type TextbookGeometry, type Vec3 } from './textbook-geometry';
import { createSolidMaterial } from './textbook-solid-materials';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { specimenSeed, taperRoot } from './textbook-agricultural-specimens';
import { noise } from './textbook-soil-cut-surface';

type Point=[number,number];
type Datum=(x:number,z:number,y?:number)=>Vec3;
const wetEarth=new T.Color('#716147'),dryEarth=new T.Color('#ab8d66');
const atHeight=(x:number,z:number)=>7.55+.46*(noise(x*.26,z*.25)-.5)+.22*(noise(x*.78,z*.84)-.5);
const closedEdge=(x:number,z:number)=>Math.min(1,Math.max(0,Math.min(x-4.5,66-x,z-12,66-z)));

/** Permanent parcels of cohesive topsoil meet when hydrated. Desiccation pulls
 * their uneven lips apart; the lighter exposed clay lies below the same fixed crop. */
export function mountDroughtSoil(b:TextbookGeometry,p:Datum,s:number){
  const seeds:Point[]=[];
  for(let j=0;j<11;j++)for(let i=0;i<13;i++){
    const k=j*13+i;seeds.push([4.5+(i+.12+.76*specimenSeed(k,2))*61.5/13,12+(j+.12+.76*specimenSeed(k,3))*54/11]);
  }
  const base:number[]=[],dry:number[]=[],colors:number[]=[],indices:number[]=[];
  function vertex(x:number,z:number,y:number,dx:number,dz:number,dy:number,shade:number) {
    const k=base.length/3;base.push(...p(x,z,y));dry.push(dx*s,dy*s,dz*s);colors.push(shade,shade,shade);return k;
  }
  function warp(x:number,z:number):Point{
    const w=closedEdge(x,z);return [x+(noise(x*.22,z*.24)-.5)*.95*w,z+(noise(x*.24+16,z*.27)-.5)*.89*w];
  }
  for(const [index,[cx,cz]] of seeds.entries()){
    let poly:Point[]=[[4.5,12],[66,12],[66,66],[4.5,66]];
    for(const [x,z] of seeds){
      const dx=x-cx,dz=z-cz;if((dx===0&&dz===0)||dx*dx+dz*dz>240)continue;
      const mx=(x+cx)/2,mz=(z+cz)/2,next:Point[]=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],c=poly[(i+1)%poly.length],da=(a[0]-mx)*dx+(a[1]-mz)*dz,dc=(c[0]-mx)*dx+(c[1]-mz)*dz;
        if(da<=0)next.push(a);
        if((da<=0)!==(dc<=0)){const t=da/(da-dc);next.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t]);}
      }
      poly=next;
    }
    const tint=.81+.22*specimenSeed(index,8),center=vertex(cx,cz,atHeight(cx,cz),0,0,.04,tint);
    const border:Point[]=poly.flatMap((a,i)=>{
      const c=poly[(i+1)%poly.length];return [warp(...a),warp((a[0]+c[0])*.5,(a[1]+c[1])*.5)];
    });
    const lip:number[]=[],wall:number[]=[],foot:number[]=[];
    for(const [x,z] of border){
      const d=Math.hypot(cx-x,cz-z)||1;
      const pocket=noise(x*.076,z*.089);
      const shrink=closedEdge(x,z)*(.028+.27*Math.min(1,Math.max(0,(pocket-.23)/.55))**1.5);
      const dx=(cx-x)*shrink/d,dz=(cz-z)*shrink/d,y=atHeight(x,z),curl=.12+.10*noise(x*.6,z*.7);
      lip.push(vertex(x,z,y,dx,dz,curl,tint*.92));wall.push(vertex(x,z,y,dx,dz,curl,.53));
      foot.push(vertex(x,z,6.72,0,0,0,.44));
    }
    for(let i=0;i<border.length;i++){const j=(i+1)%border.length;indices.push(center,lip[j],lip[i],wall[i],wall[j],foot[i],foot[i],wall[j],foot[j]);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(base,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  g.setIndex(indices);g.morphTargetsRelative=true;g.morphAttributes.position=[new T.Float32BufferAttribute(dry,3)];g.computeVertexNormals();
  const mesh=b.mesh(g,'#82785a',false,true,'land');mesh.material=createSoilSpecimenFinish(b.pop,'#ffffff',1,.73*s,'loam');
  mesh.material.vertexColors=true;mesh.name='耕层干缩面';mesh.userData.agriculturalSpecimen='shrinkable-cultivated-loam';
  // The exposed front slice shows the same cultivated horizon over a paler
  // parent deposit. Fine cereal roots enter from the nearest row of stems.
  const cut:number[]=[],pigment:number[]=[],ix:number[]=[];
  const upper=new T.Color('#715c40'),lower=new T.Color('#a68a64');
  for(let j=0;j<=12;j++)for(let i=0;i<=96;i++){
    const x=4.5+61.5*i/96,t=j/12,y=t*atHeight(x,66),z=66+.15*Math.sin(t*Math.PI)*noise(x*.53,t*32);
    cut.push(...p(x,z,y));const horizon=2.35+.77*noise(x*.19,7)+.38*Math.sin(x*.4);
    const c=lower.clone().lerp(upper,Math.min(1,Math.max(0,(y-horizon)/.85))).multiplyScalar(.90+.18*noise(x*.43,y*.78));
    pigment.push(c.r,c.g,c.b);
    if(j<12&&i<96){const k=j*97+i;ix.push(k,k+1,k+97,k+1,k+98,k+97);}
  }
  const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute(cut,3));cg.setAttribute('color',new T.Float32BufferAttribute(pigment,3));cg.setIndex(ix);cg.computeVertexNormals();
  const face=b.mesh(cg,'#ffffff',false,true,'land');face.material=createSoilSpecimenFinish(b.pop,'#ffffff',1,.62*s,'loam');face.material.vertexColors=true;face.userData.agriculturalSpecimen='tilled-section';
  const roots:any[]=[];
  for(let i=0;i<6;i++){
    const x=12.6+i*8.1;
    for(let j=0;j<3+Math.floor(4*specimenSeed(i,61));j++){
      const dx=(specimenSeed(i*6+j,31)-.5)*4.2,tip=1.2+3.35*specimenSeed(i,j+7);
      const points=[p(x,63.7,7.58),p(x+.22*dx,65.65,7.17),p(x+.56*dx,66.21,6.1),p(x+1.14*dx,66.23,4.9),p(x+1.5*dx,66.12,tip)];
      const main=new T.CatmullRomCurve3(points.map(q=>new T.Vector3(...q)));
      roots.push(taperRoot(main,(.12+.10*specimenSeed(j,i))*s,17));
      const junction=main.getPoint(.57),side=dx<0?-1:1;
      roots.push(taperRoot(new T.LineCurve3(junction,junction.clone().add(new T.Vector3(side*.66*s,-1.05*s,.02*s))),.079*s,7));
    }
  }
  const fibres=b.mesh(mergeInstrumentGeometry(roots),'#977c5c',false,true,'plant');fibres.userData.agriculturalSpecimen='cereal-roots';
  return {mesh,members:[mesh,face,fibres],update(deficit:number){
    mesh.morphTargetInfluences[0]=deficit*deficit;
    mesh.material.color.copy(wetEarth).lerp(dryEarth,deficit);
    mesh.material.roughness=.68+.27*deficit;
  }};
}

// Leaves stay attached at the sheath as the shoot wilts. Left and right laminae
// meet at a raised midrib; variable azimuths keep the crop legible from above.
export function mountDroughtCrops(b:TextbookGeometry,p:Datum){
  const positions:number[]=[],end:number[]=[],color:number[]=[],indices:number[]=[];
  const vertex=(a:Vec3,z:Vec3,shade:number)=>{
    positions.push(...a);end.push(z[0]-a[0],z[1]-a[1],z[2]-a[2]);color.push(shade,shade,shade);
  };
  for(let i=0;i<24;i++){
    const x=12.6+i%6*8.1,z=21.1+Math.floor(i/6)*14.2,twist=specimenSeed(i,5)*Math.PI*2;
    for(let blade=0;blade<5;blade++){
      const h=.11+1.08*blade,reach=3.15+1.57*specimenSeed(i+blade,5)-.34*blade;
      const az=twist+blade*2.41,dx=Math.cos(az),dz=Math.sin(az),base=positions.length/3;
      const rise=5.65-.4*blade+1.12*specimenSeed(i,blade+2);
      for(let j=0;j<=12;j++){
        const t=j/12,arch=Math.sin(t*Math.PI*.74),w=.69*Math.sin(t*Math.PI)**.70*(1-.055*blade);
        const wetY=7.49+h+rise*arch,dryY=Math.max(7.73,7.49+h*.67+rise*(.63*arch-.76*t*t));
        const wetRadius=reach*t**1.16,dryRadius=reach*t*(1+.20*t);
        for(const lane of [-1,0,1]){
          const fold=(1-Math.abs(lane))*.27*Math.sin(t*Math.PI);
          vertex(p(x+dx*wetRadius-dz*lane*w,z+dz*wetRadius+dx*lane*w,wetY+fold),
            p(x+dx*dryRadius-dz*lane*w*.63+.57*t,z+dz*dryRadius+dx*lane*w*.63,dryY+fold*.68),
            (.74+.18*specimenSeed(i,blade))*(lane===0?1.23:lane<0?.89:1.02));
        }
        if(j<12){const k=base+j*3;indices.push(k,k+3,k+1,k+1,k+3,k+4,k+1,k+4,k+2,k+2,k+4,k+5);}
      }
    }
    // A tapered culm joins the individual sheaths to the root collar.
    const first=positions.length/3,n=7;
    for(let j=0;j<=5;j++)for(let k=0;k<n;k++){
      const t=j/5,a=k*Math.PI*2/n,r=.21-.11*t,dx=r*Math.cos(a),dz=r*Math.sin(a);
      vertex(p(x+dx,z+dz,7.42+t*6.98),p(x+dx+.57*t,z+dz,7.42+t*4.77),.82+.13*Math.cos(a));
      if(j<5){const here=first+j*n+k,next=first+j*n+(k+1)%n;indices.push(here,here+n,next,next,here+n,next+n);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(color,3));
  g.morphTargetsRelative=true;g.morphAttributes.position=[new T.Float32BufferAttribute(end,3)];g.setIndex(indices);g.computeVertexNormals();
  const wet=new T.Color('#647b39'),dry=new T.Color('#8e713a'),m=b.mesh(g,'#647b39',false,true,'plant');
  m.material=createSolidMaterial(b.pop,'plant','#647b39');m.material.vertexColors=true;m.userData.agriculturalSpecimen='rooted-leaf-crop';
  return {mesh:m,update(stress:number){m.morphTargetInfluences[0]=stress;m.material.color.copy(wet).lerp(dry,stress);}};
}
