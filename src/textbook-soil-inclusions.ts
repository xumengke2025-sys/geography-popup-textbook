import { THREE as T } from './reference/engine.js';
import { mergeInstrumentGeometry } from './textbook-instrument-parts';
import { cutCrown,noise,type CutSpecimen } from './textbook-soil-cut-surface';
import { createSoilSpecimenFinish } from './textbook-soil-specimen-finish';
import type { TextbookGeometry } from './textbook-geometry';

type Path2=Array<[number,number]>;
const roots:{path:Path2;r:number}[]=[
  {path:[[35.3,52.0],[35.7,48.4],[34.6,45.9],[36.2,43.1],[36.9,39.1],[39.3,36.4],[38.8,32.2],[40.0,27.8],[38.0,23.7],[38.6,20.5],[36.9,16.1],[36.2,12.7]],r:.54},
  {path:[[35.9,43.5],[33.2,42.6],[31.7,40.8],[28.8,40],[27.7,38.7]],r:.29},
  {path:[[39,35.4],[41.9,33.4],[42.2,31.7],[45.4,30.2]],r:.25},
  {path:[[38.3,23.2],[36.5,22.7],[34.3,20.2],[32.1,19.1]],r:.22},
  {path:[[35.7,47.8],[37.2,46.2],[38.9,45.5],[39.8,43.7]],r:.19},
  {path:[[15.8,51.7],[17.5,49.5],[17.9,47],[20.5,45.6],[19.8,42.9],[21.1,40.5],[21.5,38.4]],r:.36},
  {path:[[17.8,47.2],[16.3,45.4],[14.2,44.5],[13.6,42.3]],r:.22},
  {path:[[20.2,43.6],[22.8,43.4],[24.7,41.7],[26.2,41.5]],r:.16},
  {path:[[69.3,52.1],[68.3,48.9],[69.4,46.9],[68.9,44.1],[70.9,41.6],[70.2,39.8],[71.6,37.9]],r:.43},
  {path:[[68.5,48.7],[65.9,48.4],[64.2,46.6],[62.4,46.1]],r:.21},
  {path:[[69.1,44.6],[72.2,44.0],[73.3,42.1],[75.7,41]],r:.25},
  {path:[[71.1,42.7],[73.1,40.3],[74.0,39.6],[75.5,39.3]],r:.12},
  {path:[[49.2,50.0],[48.2,48.2],[49.1,46],[47.8,42.4],[48.4,40.6]],r:.22},
  {path:[[47.9,42.9],[45.9,42.2],[44.8,40.2]],r:.13},
  {path:[[57.7,51.9],[58.2,49.2],[56.9,46.9],[57.1,44.9]],r:.20}
];
const hash=(i:number,salt:number)=>{const q=Math.sin(i*57.61+salt*31.17)*43657.72;return q-Math.floor(q);};

function clast(seed:number){
  const n=6+seed%3,front:number[][]=[],rim:number[][]=[],back:number[][]=[];
  for(let i=0;i<n;i++){
    const a=(i+.27*(hash(seed*11+i,1)-.5))*Math.PI*2/n,r=.72+.33*hash(seed*13+i,2),x=r*Math.cos(a),y=r*Math.sin(a);
    rim.push([x,y,-.17]);front.push([x*(.49+.30*hash(seed*23+i,5)),y*.68,.25+.12*hash(seed*17+i,8)+.18*x]);back.push([x*.69,y*.67,-.67]);
  }
  const vertices:number[]=[];
  const triangle=(a:number[],b:number[],c:number[])=>vertices.push(...a,...b,...c);
  for(let i=0;i<n;i++){
    const j=(i+1)%n;triangle([.05,-.03,.43],front[i],front[j]);triangle(front[i],rim[i],rim[j]);triangle(front[i],rim[j],front[j]);
    triangle(rim[i],back[i],back[j]);triangle(rim[i],back[j],rim[j]);triangle([0,0,-.71],back[j],back[i]);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}

export function mountSoilInclusions(b:TextbookGeometry,cut:CutSpecimen,s:number,z0:number,select:object){
  const grains:any[]=[],organic:any[]=[];
  const colors=['#c6bba2','#8e8171','#666358','#ae8863','#9e9684'];
  const finishes=colors.map(tint=>createSoilSpecimenFinish(b.pop,tint,0,.17*s,'outcrop'));
  const embed=(x:number,y:number)=>cut.face(x,y);
  // Deliberately different shapes and sizes: broken grit, oblique chips, a
  // handful of larger parent-rock fragments, and a quieter fine fraction.
  const anchors=[[16.5,13.4,1.82],[48.5,32.3,1.55],[62.2,15.4,1.62],[23,29.7,1.30],[74.1,22.2,1.12],[27.8,18.7,1.20]];
  for(let i=0;i<48;i++){
    const top=i>=42;let x=13.4+hash(i,1)*65,y=9.85+hash(i,4)*39.4;
    let radius=.29+Math.pow(hash(i,6),1.5)*.76;
    if(i<anchors.length)[x,y,radius]=anchors[i];
    if(!top&&!cut.solidAt(x,y,radius+.75)){
      for(let j=1;j<15;j++){
        const alt=10+hash(i,j+9)*39;if(cut.solidAt(x,alt,radius+.75)){y=alt;break;}
      }
    }
    const g=clast(i),m=b.mesh(g,colors[i%colors.length],false,true,'rock');m.material=finishes[i%colors.length];m.name='断面嵌露矿粒';
    m.userData.soilPoreRole='mineral';m.userData.modelInput=select;m.userData.interactionFeedback=false;
    const z=top?-6+15*hash(i,12):embed(x,y);
    m.position.set(x*s,(top?cutCrown(x,z)-.20:y)*s,z0+(top?z:z-.10*radius)*s);
    m.scale.set(radius*(1.05+.68*hash(i,8))*s,radius*(.51+.43*hash(i,9))*s,radius*.91*s);
    m.rotation.set(top?-Math.PI/2:.11*(hash(i,11)-.5),.13*(hash(i,15)-.5),1.6*(hash(i,13)-.5));
    grains.push(m);
  }
  const grit:any[]=[];
  for(let i=0;i<154;i++){
    const x=12.5+hash(i,46)*68.5,y=8.8+hash(i,47)*42;
    if(!cut.solidAt(x,y,.5)||hash(i,51)> .39+.48*noise(x*.18,y*.22))continue;
    const r=.11+.19*hash(i,52),g=clast(i+50);
    g.scale(r*(.9+hash(i,55)),r*.69,r);g.rotateZ(5*hash(i,53));g.translate(x,y,embed(x,y)-r*.05);grit.push(g);
  }
  const g=mergeInstrumentGeometry(grit);g.scale(s,s,s);const specks=b.mesh(g,'#a89a80',false,true,'rock');specks.position.z=z0;specks.name='细砾与矿屑';
  // Exposed rootlets taper smoothly as they descend and repeatedly disappear
  // into the cut face. Small side hairs are attached to their parent fibres.
  function tapered(path:Path2,radius:number,seed:number){
    const curve=new T.CatmullRomCurve3(path.map(([x,y],i)=>new T.Vector3(x,y,embed(x,y)+(.18+.23*Math.sin(i*2.16+seed)) *radius)));
    const sections=Math.max(9,path.length*5),sides=7,geo=new T.TubeGeometry(curve,sections,1,sides,false),attr=geo.attributes.position;
    for(let i=0;i<=sections;i++){
      const t=i/sections,c=curve.getPointAt(t),r=radius*(1-.92*t)*(.93+.11*Math.sin(23*t+seed));
      for(let j=0;j<=sides;j++){
        const k=i*(sides+1)+j;attr.setXYZ(k,c.x+(attr.getX(k)-c.x)*r,c.y+(attr.getY(k)-c.y)*r,c.z+(attr.getZ(k)-c.z)*r*.72);
      }
    }
    geo.computeVertexNormals();return geo;
  }
  roots.forEach(({path,r},i)=>{
    const pieces=[tapered(path,r,i)];
    for(let j=1;j<path.length-1;j++){
      const [x,y]=path[j],dx=(j+i)%2?1:-1,len=.9+1.7*hash(i,j+13);
      pieces.push(tapered([[x,y],[x+dx*.42*len,y-.30*len],[x+dx*.55*len,y-.82*len]],Math.min(.145,r*.39),j+i));
    }
    const g=mergeInstrumentGeometry(pieces);g.scale(s,s,s);const m=b.mesh(g,['#473428','#5e4734','#745c43','#544332'][i%4],false,true,'land');
    m.name='腐殖层根须与支根';m.position.z=z0;m.userData.soilPoreRole='organic';organic.push(m);
  });
  return {grains,organic};
}