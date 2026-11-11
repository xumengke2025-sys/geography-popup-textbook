import { THREE as T } from './reference/engine.js';
import { GeographyPen } from './geography-pen';
import { evaluateWater, point, samplePath, type WaterProgress } from './chapters';

export class WaterIllustration {
  private g:GeographyPen;private paths:any;private drops:any;private labels=new Map<string,any>();
  constructor(private pop:any){
    this.g=new GeographyPen(pop);const g=this.g;
    const height=(x:number,z:number)=>x>112?9:11+19*Math.exp(-Math.pow((x-27)/26,2))*(.65+.35*Math.cos((z+75)*.065));
    const vertices:number[]=[],indices:number[]=[];
    for(let j=0;j<=10;j++)for(let i=0;i<=16;i++){const x=8+i*6.5,z=-116+j*9.4;vertices.push(x,height(x,z),z);if(i<16&&j<10){const k=j*17+i;indices.push(k,k+17,k+1,k+1,k+17,k+18)}}
    g.surface(vertices,indices);
    for(const z of [-116,-22]){
      const top=Array.from({length:17},(_,i)=>point(8+i*6.5,height(8+i*6.5,z),z));g.stroke(top,.95);
      const face:number[]=[],idx:number[]=[];top.forEach((p,i)=>{face.push(p.x,p.y,p.z,p.x,-8,p.z);if(i<16){const k=i*2;idx.push(k,k+1,k+2,k+1,k+3,k+2)}});g.surface(face,idx);g.stroke([[8,-8,z],[112,-8,z]],.9);
    }
    g.surface([8,-8,-116,8,-8,-22,8,height(8,-22),-22,8,height(8,-116),-116],[0,1,2,0,2,3]);
    g.stroke([[8,height(8,-116),-116],[8,height(8,-22),-22]],.9);
    g.stroke([[8,-8,-22],[8,height(8,-22),-22]],.8);g.stroke([[112,-8,-22],[112,height(112,-22),-22]],.8);
    const sea=pop.paper({color:'#e5ece8',spacing:2,shade:.1});g.box([112,-8,-116],[165,8.8,-22],sea);
    for(let j=0;j<7;j++)g.stroke(Array.from({length:26},(_,i)=>[118+i*1.55,9,-111+j*13+Math.sin(i*.42+j)*.5]),.4);
    for(const x of [20,34,48,63]){
      const path=Array.from({length:45},(_,i)=>{const z=-115+i*93/44;return[x+2*Math.sin(z*.04),height(x,z)+.08,z]});g.stroke(path,.3);
    }
    for(const z of [-98,-80,-63])g.stroke(Array.from({length:55},(_,i)=>{const x=8+i*94/54;return[x,height(x,z)+.12,z]}),.6);
    for(const [x,z,h] of [[24,-80,9],[36,-90,7],[54,-88,8],[66,-72,7],[86,-82,6],[83,-52,5]])g.tree(x,z,h,height(x,z));
    // A cut face at the front keeps infiltration and the underground return visible.
    g.stroke([[10,0,-21.8],[48,0,-21.8],[82,0,-21.8],[112,0,-21.8]],.35);
    const river=[point(45,23,-65),point(62,17,-58),point(75,14,-45),point(89,12,-37),point(111,9,-34)];
    const water=pop.paper({color:'#dce7e5',spacing:1.7,shade:.1});const strip=g.strip(river,2.7,water);strip.edges.forEach(edge=>g.stroke(edge,.55));
    this.cloud(44,57,-63,21);this.cloud(146,57,-53,16);
    const sun=new T.Mesh(new T.CircleGeometry(6,36),g.paper);sun.position.set(90,72,-92.05);pop.addSurface(sun);
    g.stroke(Array.from({length:45},(_,i)=>[90+6*Math.cos(i/44*Math.PI*2),72+6*Math.sin(i/44*Math.PI*2),-92]),.8);
    for(let j=0;j<9;j++){const a=j/9*Math.PI*2;g.stroke([[90+8*Math.cos(a),72+8*Math.sin(a),-92],[90+10.5*Math.cos(a),72+10.5*Math.sin(a),-92]],.5)}
    g.label('海洋',144,12,-17,18,6);g.label('陆地',47,23,-17,18,6);
    this.labels.set('transport',g.label('水汽输送',96,67,-55,31,7));
    this.labels.set('evapSea',g.label('蒸发',137,31,-25,17,6));
    this.labels.set('rainLand',g.label('降水',36,41,-53,17,6));
    this.labels.set('runoff',g.label('地表径流',81,21,-35,28,6));
    this.labels.set('groundwater',g.label('地下径流',83,-4,-16,30,6));
    this.labels.set('infiltration',g.label('下渗',52,7,-16,16,6));
    this.labels.set('evapLand',g.label('蒸发',80,35,-44,16,6));
    this.labels.set('transpiration',g.label('蒸腾',21,40,-64,16,6));
    this.labels.set('rainSea',g.label('降水',161,35,-43,16,6));
    g.finish();this.paths=g.dynamic('#4e7a84',4200,1.15);this.drops=g.dynamic('#286674',900,1.7);
  }
  private cloud(x:number,y:number,z:number,w:number){
    const g=this.g,shape=new T.Shape(),outline=Array.from({length:65},(_,i)=>{const a=i/64*Math.PI*2;return[x+w*.61*Math.cos(a),y+w*.18*Math.sin(a)+1.3*Math.sin(a*5),z+2.05]});
    outline.forEach(([xx,yy],i)=>i?shape.lineTo(xx,yy):shape.moveTo(xx,yy));shape.closePath();
    const geometry=new T.ExtrudeGeometry(shape,{depth:2,bevelEnabled:false});geometry.translate(0,0,z);this.pop.addSurface(new T.Mesh(geometry,g.paper));g.stroke(outline,.8);
  }
  update(_dt:number,input:WaterProgress,visible:boolean,_reduced:boolean){
    const live=visible&&this.pop.state==='live',s=evaluateWater(input),paths:any[]=[],drops:any[]=[];
    this.labels.forEach((label,id)=>label.visible=live&&s.active.includes(id as any));
    if(live)for(const path of s.paths){
      const pts=Array.from({length:35},(_,i)=>this.g.v(samplePath(path.points,i/34)));
      paths.push({points:pts,width:s.focus===path.id?1.1:.45});
      const count=path.id==='runoff'||path.id==='groundwater'?2:3;
      for(let j=0;j<count;j++)drops.push(this.g.arrow(path.points,(s.phase+j/count)%1,s.focus===path.id?1.3:1));
    }
    this.paths.setLines(paths);this.paths.mesh.visible=paths.length>0;this.drops.setLines(drops);this.drops.mesh.visible=drops.length>0;
  }
  dispose(){this.g.dispose()}
}
