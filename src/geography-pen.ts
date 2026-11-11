import { THREE as T } from './reference/engine.js';
import { InkLines, PenSchedule, inkBox } from './reference/stores-BwMXNqO6.js';
import { samplePath, type Point } from './chapters';
import { FIELD_VISUAL_THEME } from './textbook-visual-theme';

/** Thin geography adapter. All ink, hatching and paper lifting use the original engine. */
export class GeographyPen {
  pen=new PenSchedule({speed:1800,gap:.001,min:.012,max:.12});
  lines:any; paper:any; textures:any[]=[];
  constructor(readonly pop:any,readonly parent:any=pop.group){
    this.lines=new InkLines(pop.ink({widthPx:1.18,widthMm:.26,bias:.5,color:FIELD_VISUAL_THEME.lines.structure}));
    this.paper=pop.paper({color:'#fbf7ee',...FIELD_VISUAL_THEME.material,seed:7});
  }
  v(p:Point|number[]){return Array.isArray(p)?new T.Vector3(...p):new T.Vector3(p.x,p.y,p.z)}
  stroke(points:(Point|number[])[],width=1,closed=false){
    const pts=points.map(p=>this.v(p));let length=0;for(let i=1;i<pts.length;i++)length+=pts[i].distanceTo(pts[i-1]);
    this.lines.add(pts,{width,closed,wobble:.06,sched:this.pen.next(length),overshoot:.15});
  }
  box(a:number[],b:number[],material=this.paper){const start=this.pop.surfaces.length;inkBox(this.pop,this.lines,this.v(a),this.v(b),{mat:material,pen:this.pen,width:.7});for(const mesh of this.pop.surfaces.slice(start))this.parent.add(mesh)}
  surface(vertices:number[],indices:number[],material=this.paper){
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    return this.pop.addSurface(new T.Mesh(geometry,material),this.parent);
  }
  stripData(path:Point[],width:number,start=0,end=1,segments=72){
    const vertices:number[]=[],indices:number[]=[],edges:[Point[],Point[]]=[[],[]];
    for(let i=0;i<=segments;i++){
      const t=start+(end-start)*i/segments,p=samplePath(path,t),a=samplePath(path,Math.max(0,t-.001)),b=samplePath(path,Math.min(1,t+.001));
      const length=Math.hypot(b.x-a.x,b.z-a.z)||1,dx=-(b.z-a.z)/length*width/2,dz=(b.x-a.x)/length*width/2;
      for(const side of [-1,1]){vertices.push(p.x+dx*side,p.y,p.z+dz*side);edges[side===-1?0:1].push({x:p.x+dx*side,y:p.y+.04,z:p.z+dz*side})}
      if(i<segments){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    return {geometry,edges};
  }
  strip(path:Point[],width:number,material:any,start=0,end=1,segments=72){
    const {geometry,edges}=this.stripData(path,width,start,end,segments);
    return{mesh:this.pop.addSurface(new T.Mesh(geometry,material),this.parent),edges};
  }
  tree(x:number,z:number,h:number,ground:number){
    this.stroke([[x,ground,z],[x,ground+h,z]],.6);
    for(let j=0;j<4;j++){const y=ground+h-j*h*.17,w=(j+1)*h*.13;this.stroke([[x-w,y-h*.2,z],[x,y,z],[x+w,y-h*.2,z]],.6)}
  }
  label(text:string,x:number,y:number,z:number,w=24,h=7){
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=Math.round(600*h/w);const c=canvas.getContext('2d')!;
    c.fillStyle='#fbf7ee';c.fillRect(0,0,canvas.width,canvas.height);c.font=`${Math.floor(canvas.height*.62)}px FieldSerif`;c.fillStyle='#27313e';c.textAlign='center';c.textBaseline='middle';c.fillText(text,300,canvas.height*.53);
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;this.textures.push(texture);
    const material=this.pop.paper({hatch:0,shade:0});material.map=texture;material.side=T.DoubleSide;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),material);mesh.position.set(x,y,z);this.pop.addSurface(mesh,this.parent);return mesh;
  }
  dynamic(color='#317f8b',capacity=4000,width=1.5){const lines=new InkLines(this.pop.ink({widthPx:width,color,bias:.5}),{capacity});this.pop.addLines(lines,this.parent);return lines}
  arrow(path:Point[],t:number,width=1){
    const p=samplePath(path,t),a=this.v(samplePath(path,Math.max(0,t-.005))),b=this.v(samplePath(path,Math.min(1,t+.005))),at=this.v(p),dir=b.sub(a).normalize();
    let normal=new T.Vector3().crossVectors(dir,new T.Vector3(0,0,1));if(normal.length()<.1)normal=new T.Vector3().crossVectors(dir,new T.Vector3(0,1,0));normal.normalize();
    const tail=at.clone().addScaledVector(dir,-2);return{points:[tail.clone().addScaledVector(normal,1.2),at.clone().addScaledVector(dir,1.5),tail.clone().addScaledVector(normal,-1.2)],width};
  }
  finish(){this.lines.build();this.pop.addLines(this.lines,this.parent);this.pen.fit(1.45);this.lines.reschedule()}
  dispose(){for(const texture of this.textures)texture.dispose()}
}
