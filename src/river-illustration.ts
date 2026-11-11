import { THREE as T } from './reference/engine.js';
import { GeographyPen } from './geography-pen';
import { evaluateRiver, samplePath, riverUpstream, riverBend, riverDownstream, riverShortcut, type RiverProgress } from './chapters';

export class RiverIllustration {
  private g:GeographyPen;private banks:any;private motion:any;private neck:any;private water:any;private shortcut:any;private bend:any;private lakeLabel:any;
  private lastPhase=-1;private clock=0;
  constructor(private pop:any){
    const g=this.g=new GeographyPen(pop);g.box([7,0,-120],[165,10.8,-17]);
    for(let j=0;j<7;j++)g.stroke([[9,2+j,-16.95],[54,2+j,-16.95],[109,2+j,-16.95],[164,2+j,-16.95]],.25);
    // Field boundaries and reeds stay quiet enough to read the changing water route.
    for(const [x,z] of [[24,-56],[28,-72],[56,-112],[114,-65],[111,-79]]){
      g.stroke([[x,10.95,z],[x+7,10.95,z-2],[x+10,10.95,z+7]],.3);
      for(let j=0;j<3;j++)g.stroke([[x+j*2,11,z+2],[x+j*2+.4,12.4,z+1]],.25);
    }
    for(const [x,z] of [[16,-91],[48,-23],[155,-107]])g.tree(x,z,5,10.8);
    this.water=pop.paper({color:'#dce7e5',spacing:1.7,shade:.11});
    for(const path of [riverUpstream,riverDownstream]){const strip=g.strip(path,5.3,this.water);strip.edges.forEach(edge=>g.stroke(edge,.7))}
    this.bend=g.strip(riverBend,5.3,this.water).mesh;
    this.shortcut=g.strip(riverShortcut,.03,this.water).mesh;
    g.label('上游',19,17,-22,17,6);g.label('下游',21,17,-115,17,6);
    this.lakeLabel=g.label('牛轭湖',127,17,-80,25,7);this.lakeLabel.visible=false;
    g.finish();this.banks=g.dynamic('#253945',1400,1.15);this.motion=g.dynamic('#317f8b',1400,1.7);this.neck=g.dynamic('#9a6649',260,1.15);
  }
  update(dt:number,input:RiverProgress,visible:boolean,reduced:boolean,running:boolean){
    const s=evaluateRiver(input.phase),live=visible&&this.pop.state==='live';
    if(live&&running&&!reduced)this.clock+=dt;
    if(this.lastPhase!==s.phase){
      this.lastPhase=s.phase;
      const next=this.g.stripData(riverShortcut,Math.max(.03,5.5*s.cut),0,1,12);
      this.shortcut.geometry.dispose();this.shortcut.geometry=next.geometry;
      this.shortcut.visible=s.cut>.005;
      const old=this.g.stripData(riverBend,5.3,.06*s.isolation,1-.1*s.isolation);
      this.bend.geometry.dispose();this.bend.geometry=old.geometry;
      const lines=old.edges.map(points=>({points:points.map(p=>this.g.v(p)),width:.7}));
      if(s.cut>.005)lines.push(...next.edges.map(points=>({points:points.map(p=>this.g.v(p)),width:.6})));
      this.banks.setLines(lines);
    }
    this.banks.mesh.visible=live||this.pop.state==='print';this.lakeLabel.visible=live&&s.isolation>.9;
    const neck:any[]=[];
    if(live&&s.phase<.65)for(let i=0;i<10;i++){const a=i/10*Math.PI*2,b=(i+.55)/10*Math.PI*2;neck.push({points:[new T.Vector3(71+11*Math.cos(a),11.4,-60+10*Math.sin(a)),new T.Vector3(71+11*Math.cos(b),11.4,-60+10*Math.sin(b))],width:.6})}
    this.neck.setLines(neck);this.neck.mesh.visible=neck.length>0;
    const arrows:any[]=[];
    if(live){
      const routes=s.cut>.75?[riverUpstream,riverShortcut,riverDownstream]:[riverUpstream,riverBend,riverDownstream];
      for(const path of routes){const count=path===riverShortcut?1:path===riverBend?5:2;for(let j=0;j<count;j++)arrows.push(this.g.arrow(path,(this.clock*.13+j/count+.15)%1,.95))}
    }
    this.motion.setLines(arrows);this.motion.mesh.visible=arrows.length>0;
  }
  dispose(){this.g.dispose()}
}
