import { THREE as T } from './reference/engine.js';
import { createSpecimenMaterial } from './textbook-solid-materials';
import { applyEarthScan } from './textbook-earth-scan';
import type { TextbookGeometry } from './textbook-geometry';
import { crownCrack, slidingFace } from './textbook-slide-fractures';
import { SLIDE_BODY_VOLUME, evaluateLandslide } from './textbook-landslide-model';

const grain=(x:number,z:number)=>.45*Math.sin(x*.89+z*.52)+.31*Math.cos(z*1.41-x*.28)+.23*Math.sin(x*2.5-z*1.81);
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t)};
/** Closed rigid sample in its own centre-of-mass frame. Every triangulated
 * surface variation is volume-balanced so the model footprint,
 * stock volume and eight original boundary markers retain their values. */
export function coherentSpecimen(b:TextbookGeometry,s:number) {
  const initial=evaluateLandslide(0).slide;
  const sides=initial.lower.length,rings=14,steps=13,segments=sides*steps;
  const footprint=initial.lower.map(([x,,z])=>[(x-initial.x)/Math.cos(initial.pitch),z-initial.z]);
  const coordinates:{u:number;v:number;relief:number;weight:number}[]=[{u:0,v:0,relief:0,weight:1}];
  const faces:number[]=[];
  const index=(ring:number,j:number)=>ring===0?0:1+(ring-1)*segments+(j+segments)%segments;
  for(let ring=1;ring<=rings;ring++)for(let j=0;j<segments;j++){
    const a=footprint[Math.floor(j/steps)],e=footprint[(Math.floor(j/steps)+1)%sides],f=(j%steps)/steps,r=ring/rings;
    const du=e[0]-a[0],dv=e[1]-a[1],length=Math.hypot(du,dv);
    const rough=(.43+.16*Math.cos(j-j%steps))*(Math.sin(f*Math.PI*2)+.28*Math.sin(f*Math.PI*4));
    const u=r*(a[0]+du*f+dv/length*rough),v=r*(a[1]+dv*f-du/length*rough);
    const rootDistance=Math.min(...[[-4,-3],[.8,-4.7],[3.7,2.9],[-3.4,5.1]].map(([x,z])=>Math.hypot(u-x,v-z)));
    const w=(1-smooth((r-.79)/.21))*smooth(rootDistance/1.5);
    coordinates.push({u,v,weight:w,relief:w*(.49*grain(u,v)+.28*Math.cos(.31*u-.46*v)-1.17*crownCrack(u,v))});
    const k=index(ring,j),l=index(ring,j+1),prev=index(ring-1,j);
    faces.push(prev,l,k);
    if(ring>1)faces.push(prev,index(ring-1,j+1),l);
  }
  const pos:number[]=[],colors:number[]=[],facies:number[]=[],indices:number[]=[];
  for(const top of [true,false])for(const c of coordinates){
    const h=top?3.2+c.relief:0;
    pos.push(c.u*s,h*s,c.v*s);
    const moss=top?smooth((grain(c.u*.43,c.v*.43)+.47)*1.5):0;
    const crack=top?crownCrack(c.u,c.v)*c.weight:0;
    colors.push((.77-.34*moss)*(1-.55*crack),(.65-.10*moss)*(1-.62*crack),(.48-.25*moss)*(1-.63*crack));
    facies.push(top?.17:.57,.19,moss*.61);
  }
  const n=coordinates.length;
  for(let i=0;i<faces.length;i+=3){
    const [a,c,d]=faces.slice(i,i+3);indices.push(a,c,d,n+a,n+d,n+c);
  }
  // Keep the terricolous cap and the bare slip plane as joined surfaces.
  // In between, angular fragments break through the freshly exposed matrix.
  const rows:number[][]=[Array.from({length:segments},(_,j)=>index(rings,j))];
  for(let row=1;row<8;row++){
    const t=row/8,h=(1-t)*3.2,current:number[]=[];
    for(let j=0;j<segments;j++){
      const {u,v}=coordinates[index(rings,j)],r=Math.hypot(u,v),face=slidingFace(u,v,h);
      const bulge=Math.sin(Math.PI*t)*(.40*face.chip+face.rugosity-.09);
      current.push(pos.length/3);pos.push((u+u/r*bulge)*s,h*s,(v+v/r*bulge)*s);
      const chip=Math.min(1,face.chip*1.9),dark=1-.49*face.hummus;
      colors.push((.55+(.23-face.oxide*.16)*chip)*dark,(.38+(.31-face.oxide*.14)*chip)*dark,
        (.22+(.38-face.oxide*.20)*chip)*dark);
      facies.push(.13+.79*chip,.33*(1-chip),0);
    }
    rows.push(current);
  }
  rows.push(rows[0].map(k=>k+n));
  for(let row=0;row<rows.length-1;row++)for(let j=0;j<segments;j++){
    const next=(j+1)%segments,a=rows[row][j],e=rows[row][next],q=rows[row+1][j],d=rows[row+1][next];
    indices.push(a,e,q,e,d,q);
  }
  // Small clasts replace matrix within the same total stock. Balance their
  // residual signed volume over the interior top without shifting any rim or roots.
  const across=(i:number,j:number)=>pos[i*3+2]*pos[j*3]-pos[i*3]*pos[j*3+2];
  let signed=0,derivative=0;
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i],e=indices[i+1],q=indices[i+2];
    const ca=across(e,q),ce=across(q,a),cq=across(a,e);
    signed+=(pos[3*a+1]*ca+pos[3*e+1]*ce+pos[3*q+1]*cq)/6;
    derivative+=((a<n?coordinates[a].weight:0)*ca+(e<n?coordinates[e].weight:0)*ce+(q<n?coordinates[q].weight:0)*cq)/6;
  }
  const correction=(Math.sign(signed)*SLIDE_BODY_VOLUME*s**3-signed)/derivative;
  for(let i=0;i<n;i++)pos[3*i+1]+=coordinates[i].weight*correction;
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setAttribute('facies',new T.Float32BufferAttribute(facies,3));geo.setIndex(indices);geo.computeVertexNormals();
  const mesh=b.mesh(geo,'#ccc3a4',false);
  mesh.material=applyEarthScan(createSpecimenMaterial(b.pop,{role:'land',color:'#cfc7ae'}),'valley',5.3*s);
  mesh.material.vertexColors=true;
  mesh.userData.landformDetail='整体滑移的拉裂后缘与混杂土石断壁';
  mesh.userData.landslideRole='coherent-sliding-body';
  mesh.userData.modelInput={kind:'replay',selection:0,label:'复查同一滑体沿滑动面的位移'};
  return mesh;
}
