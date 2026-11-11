import { THREE as T } from './reference/engine.js';
import { InkLines, PenSchedule, inkBox } from './reference/stores-BwMXNqO6.js';
import { flowAt, type SeaBreezeDerivedState } from './model';

/** Geography content drawn with Every Joule's actual pen, paper and hatching pipeline. */
export class CoastIllustration {
  private pen = new PenSchedule({speed: 1800, gap: .001, min: .012, max: .12});
  private lines: any;
  private motion: any;
  private flagLines: any;
  private flag: any;
  private flagOriginal: Float32Array;
  private labels: any[] = [];
  private thermals: any[] = [];
  private bars: any[] = [];
  private aux: any[] = [];
  private textures: any[] = [];
  private lastDirection = 99;
  private clock = 0;
  private paper: any;
  private flowClock=0;
  private particles = Array.from({length: 18},(_,i)=>({x:.85*Math.cos(2*Math.PI*i/18),y:.5+.4*Math.sin(2*Math.PI*i/18)}));
  constructor(private pop: any) {
    this.lines=new InkLines(pop.ink({widthPx:1.25,widthMm:.28,bias:.5}));
    this.paper=pop.paper({color:'#fbf7ee',spacing:1.4,shade:.12,seed:7});
    this.drawCoast();
    this.drawHouse(121,-73,13,11,12);
    this.drawHouse(145,-86,10,9,8);
    this.drawTree(145,-45,15);
    this.drawTree(112,-92,10);
    this.box([98,4,-43],[99,31,-42]);
    this.box([95,3.7,-46],[102,4.4,-39]);
    this.stroke([[98.5,32,-42.5],[98.5,36,-42.5]],.6);
    this.lines.build();pop.addLines(this.lines);
    this.pen.fit(1.45);
    this.lines.reschedule();
    const fg=new T.PlaneGeometry(17,7,22,5);fg.translate(8.5,0,0);
    this.flagOriginal=new Float32Array(fg.attributes.position.array);
    this.flag=new T.Mesh(fg,pop.paper({color:'#fbf7ee',spacing:1.2,shade:.12}));
    this.flag.position.set(99,29,-42);pop.addSurface(this.flag);
    this.flagLines=new InkLines(pop.ink({widthPx:1.25}),{capacity:200});pop.addLines(this.flagLines);
    this.motion=new InkLines(pop.ink({widthPx:1.6,color:'#317f8b',bias:.5}),{capacity:1600});pop.addLines(this.motion);
    // Small printed plates occupy the two comparison levels, leaving the drawing visible.
    for(const [x,y] of [[37,13],[131,13],[37,68],[131,68]]) this.labels.push(this.plate('',x,y,-109,29,8));
    this.aux.push(this.plate('近地面',9,13,-109,18,7),this.plate('高空',9,68,-109,16,7));
    for(const x of [43,131]){
      this.thermals.push(this.plate('',x,8,-9,42,9));
      const bar=new T.Mesh(new T.PlaneGeometry(29,1.3),new T.MeshBasicMaterial({color:'#458aab',transparent:true}));
      bar.position.set(x,2,-8);pop.group.add(bar);this.bars.push(bar);
    }
  }
  private v(p:number[]){return new T.Vector3(p[0],p[1],p[2]);}
  private stroke(points:number[][],width=1,closed=false){
    const pts=points.map(p=>this.v(p));
    let length=0;for(let i=1;i<pts.length;i++)length+=pts[i].distanceTo(pts[i-1]);
    this.lines.add(pts,{width,closed,wobble:.08,sched:this.pen.next(length),overshoot:.3});
  }
  private box(a:number[],b:number[]){inkBox(this.pop,this.lines,this.v(a),this.v(b),{mat:this.paper,pen:this.pen,width:.8});}
  private shore(z:number){return 81+7*Math.sin((z+100)*.035)+3*Math.sin(z*.08);}
  private polygon(points:number[][],height:number){
    const shape=new T.Shape();points.forEach((p,i)=>i?shape.lineTo(p[0],-p[1]):shape.moveTo(p[0],-p[1]));shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:5});g.rotateX(-Math.PI/2);
    this.pop.addSurface(new T.Mesh(g,this.paper));
    this.stroke(points.map(p=>[p[0],height,p[1]]),1.1,true);
    for(const i of [0,points.length-1])this.stroke([[points[i][0],0,points[i][1]],[points[i][0],height,points[i][1]]],.65);
  }
  private drawCoast(){
    const shore=Array.from({length:45},(_,i)=>{const z=-117+i*99/44;return[this.shore(z),z]});
    this.polygon([[7,-117],...shore,[7,-18]],2.2);
    this.polygon([...shore,[164,-18],[164,-117]],4.2);
    // A second shore stroke and short waves are the same ink work as the original illustrations.
    this.stroke(shore.map(([x,z])=>[x+2.8,4.3,z]),.6);
    for(let j=0;j<7;j++){
      const z=-108+j*13;
      const points=Array.from({length:35},(_,i)=>[14+i*1.5,2.3,z+.6*Math.sin(i*.37+j)]);
      this.stroke(points,.45);
    }
    for(let j=0;j<11;j++){
      const z=-114+j*8.8;
      this.stroke([[this.shore(z)+7,4.25,z],[this.shore(z)+10,4.25,z-1.4]],.3);
    }
    for(const x of [18,151])this.stroke([[x,0,-18],[x,-1.6,-18]],.45);
  }
  private drawHouse(x:number,z:number,w:number,d:number,h:number){
    this.box([x-w/2,4.2,z-d/2],[x+w/2,4.2+h,z+d/2]);
    const shape=new T.Shape();shape.moveTo(x-w/2-1,4.2+h);shape.lineTo(x,4.2+h+6);shape.lineTo(x+w/2+1,4.2+h);shape.closePath();
    const roof=new T.ExtrudeGeometry(shape,{depth:d+2,bevelEnabled:false});roof.translate(0,0,z-d/2-1);
    this.pop.addSurface(new T.Mesh(roof,this.paper));
    for(const zz of [z-d/2-1,z+d/2+1])this.stroke([[x-w/2-1,4.2+h,zz],[x,10.2+h,zz],[x+w/2+1,4.2+h,zz]],.8);
    this.stroke([[x,10.2+h,z-d/2-1],[x,10.2+h,z+d/2+1]],.9);
    this.stroke([[x-w*.22,4.3,z+d/2+.04],[x-w*.22,10,z+d/2+.04],[x+w*.05,10,z+d/2+.04],[x+w*.05,4.3,z+d/2+.04]],.6);
    this.stroke([[x+w*.22,10,z+d/2+.05],[x+w*.4,10,z+d/2+.05],[x+w*.4,13,z+d/2+.05],[x+w*.22,13,z+d/2+.05]],.6,true);
    for(let j=0;j<5;j++)this.stroke([[x-w/2+1+j*w/6,4.2+h+1,z+d/2+1.1],[x-w/2+4+j*w/6,4.2+h+4,z+d/2+1.1]],.3);
  }
  private drawTree(x:number,z:number,h:number){
    this.stroke([[x,4.2,z],[x+.3,h+4,z],[x-3,h+7,z]],.8);
    this.stroke([[x,h+1,z],[x+4,h+5,z]],.6);
    const g=new T.SphereGeometry(h*.34,12,8);g.scale(1,.9,.65);g.translate(x,h+6,z);
    this.pop.addSurface(new T.Mesh(g,this.paper));
    const ring=Array.from({length:42},(_,i)=>{const a=i/41*Math.PI*2;return[x+Math.cos(a)*h*.34,h+6+Math.sin(a)*h*.3,z+1.4]});
    this.stroke(ring,.65);
  }
  private texture(text:string){
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=150;
    const c=canvas.getContext('2d')!;c.fillStyle='#fbf7ee';c.fillRect(0,0,600,150);
    c.strokeStyle='#414959';c.lineWidth=2;c.strokeRect(3,3,594,144);
    c.fillStyle='#27313e';c.font='56px FieldSerif, serif';c.textAlign='center';c.fillText(text,300,97);
    const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;this.textures.push(t);return t;
  }
  private plate(text:string,x:number,y:number,z:number,w:number,h:number){
    const mat=this.pop.paper({hatch:0,shade:0});mat.map=this.texture(text);mat.side=T.DoubleSide;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),mat);mesh.position.set(x,y,z);this.pop.addSurface(mesh);return mesh;
  }
  update(dt:number,state:SeaBreezeDerivedState,options:{running:boolean;reveal:number;flow:boolean;thermal:boolean;pressure:boolean;visible:boolean;reduced:boolean;quality:string}){
    const live=options.visible&&this.pop.state==='live';
    const move=options.running&&!options.reduced?dt:0;this.clock+=move;
    if(this.lastDirection!==state.direction){
      const values=[state.pressure.seaGround,state.pressure.landGround,state.pressure.seaUpper,state.pressure.landUpper];
      this.labels.forEach((sp,i)=>{sp.material.map.dispose();sp.material.map=this.texture(values[i])});
      this.thermals.forEach((sp,i)=>{sp.material.map.dispose();sp.material.map=this.texture(`${i?'陆地':'海洋'} · ${i?state.landThermal:state.seaThermal}`)});
      this.lastDirection=state.direction;
    }
    for(const p of [...this.labels,...this.aux])p.visible=live&&options.pressure&&options.reveal>=2;
    this.thermals.forEach(sp=>sp.visible=live&&options.thermal&&options.reveal>=0);
    this.bars.forEach((sp,i)=>{sp.visible=live&&options.thermal&&options.reveal>=0;sp.material.color.set(state.direction===0?'#96978a':(i===0?state.direction<0:state.direction>0)?'#b85e3f':'#3d839c')});
    const fg=this.flag.geometry.attributes.position,pts:number[][]=[];
    for(let i=0;i<fg.count;i++){
      const x=this.flagOriginal[i*3],y=this.flagOriginal[i*3+1],u=x/17;
      const xx=state.direction*x*state.strength+.8*u*(1-state.strength), yy=y-(1-state.strength)*u*13,zz=Math.sin(u*7-this.clock*5)*1.4*state.strength*u;
      fg.setXYZ(i,xx,yy,zz);
    }fg.needsUpdate=true;this.flag.geometry.computeVertexNormals();
    for(const i of [0,22,131,110,0])pts.push([fg.getX(i)+99,fg.getY(i)+29,fg.getZ(i)-42]);
    this.flagLines.setLines([{points:pts.map(p=>this.v(p)),width:.85}]);
    this.flag.visible=live&&options.reveal>=4;this.flagLines.mesh.visible=this.flag.visible;
    const dynamic:{points:any[];width:number;seed?:number}[]=[];
    const map=(x:number,y:number)=>new T.Vector3(86+x*68,12+y*54,-96);
    if(live&&options.pressure&&options.reveal>=2)for(const y of [13,68])for(let x=16;x<158;x+=5)dynamic.push({points:[new T.Vector3(x,y,-110),new T.Vector3(x+2,y,-110)],width:.25});
    if(live&&options.flow&&options.reveal>=1&&state.strength>.008){
      if(options.reveal>=3)for(const level of [.26,.5]){
        const extent=2*Math.acos(level)/Math.PI,points=[];
        const samples=options.quality==='低'?30:60;
        for(let half=0;half<2;half++)for(let i=0;i<=samples;i++){
          const x=(half?1-2*i/samples:2*i/samples-1)*extent;
          const lower=Math.asin(Math.min(1,level/Math.cos(Math.PI*x/2)))/Math.PI;
          points.push(map(x,half?1-lower:lower));
        }dynamic.push({points,width:.48});
      }
      const count=options.quality==='低'?8:options.quality==='中'?12:18;
      for(const p of this.particles.slice(0,count)){
        const f=flowAt(p.x,p.y,state),mid=flowAt(p.x+f.u*move*.09,p.y+f.v*move*.09,state);
        p.x=T.MathUtils.clamp(p.x+mid.u*move*.18,-.98,.98);p.y=T.MathUtils.clamp(p.y+mid.v*move*.18,.025,.975);
        if(options.reveal<3&&Math.abs(p.x)<.65)continue;
        const at=map(p.x,p.y),dir=new T.Vector3(f.u*68,f.v*54,0).normalize(),normal=new T.Vector3(-dir.y,dir.x,0);
        const tip=at.clone().addScaledVector(dir,1.7),tail=at.clone().addScaledVector(dir,-1.7);
        dynamic.push({points:[tail.clone().addScaledVector(normal,1.2),tip,tail.clone().addScaledVector(normal,-1.2)],width:.9});
      }
    }
    this.motion.setLines(dynamic);this.motion.mesh.visible=dynamic.length>0;
    this.flowClock+=dt;
  }
  dispose(){for(const t of this.textures)t.dispose();}
}
