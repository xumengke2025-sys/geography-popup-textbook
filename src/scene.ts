import { THREE as T, createRenderer, createStage, createBook, createLight, Popout, pageFrame, createFlap, createPost, PaperTone, LiquidGlass } from './reference/engine.js';
import { CoastIllustration } from './coast-illustration';
import { WaterIllustration } from './water-illustration';
import { RiverIllustration } from './river-illustration';
import { chapterForSpread, SPREAD } from './chapters';
import { evaluateSeaBreeze, type SeaBreezeDerivedState } from './model';
import { Paper, PAPER_W, PAPER_H, type PaperHit, type Presentation } from './paper';

export interface LessonRuntime {
  prepare(): Promise<void>; enter(): Promise<void>; update(dt:number,state:SeaBreezeDerivedState):void; leave():Promise<void>; dispose():void;
}
/** Adapter around Every Joule's original book, paper shader, pen and popout engine. */
export class BookScene implements LessonRuntime {
  renderer:any;scene:any;camera:any;book:any;
  lift=0;targetLift=0;view='阅读';quality='高';flowVisible=true;thermalVisible=true;pressureVisible=true;reveal=-1;running=false;
  reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  onLost=()=>{};onReady=()=>{};onHit:(hit:PaperHit,fraction?:number)=>void=()=>{};onPhase:(phase:number,commit:boolean)=>void=()=>{};onHover:(label:string)=>void=()=>{};
  private stage:any;private post:any;private glass:any;
  private lessons=new Map<number,{pop:any;art:CoastIllustration|WaterIllustration|RiverIllustration;flap:any}>();
  private get entry(){return this.lessons.get(this.presentation?.progress.spread??1)}
  private get pop(){return this.entry?.pop??this.lessons.get(1)!.pop}
  private get flap(){return this.entry?.flap??this.lessons.get(1)!.flap}
  private pages=new Map<string,Paper>();private presentation:Presentation|null=null;private leftKey='';private rightKey='';
  private desiredOpen=false;private busy=false;private disposed=false;private lastState=evaluateSeaBreeze({phase:.5,contrast:1});
  private shadowKey='';private shadowElapsed=0;
  private observer:ResizeObserver;private ray=new T.Raycaster();private mouse=new T.Vector2();private orbit=0;private zoom=1;private focus=new T.Vector3(105,0,0);private flopAngle=0;
  private pointer:{id:number;x:number;y:number;moved:boolean;hit:PaperHit|null;phase:boolean;orbit:boolean}|null=null;

  constructor(private host:HTMLElement){
    const canvas=document.createElement('canvas');host.append(canvas);this.renderer=createRenderer(canvas);this.renderer.info.autoReset=false;
    canvas.setAttribute('aria-label','三维立体书。点击纸面可预测、展开模型和改变昼夜；阅读面板提供完整文字与键盘操作。');canvas.style.touchAction='none';
    const light=createLight();
    // The original spine geometry is calibrated to fourteen leaves. Keep that
    // physical block intact; application navigation selects the authored spreads.
    this.book=createBook({renderer:this.renderer,nSpreads:14,light,drawPage:(k:number,side:string,c:CanvasRenderingContext2D)=>this.drawPage(k,side,c)});
    this.book.parts.ribbon.mesh.visible=false;
    this.stage=createStage(this.renderer,{deskTop:this.book.dims.Yb-this.book.dims.BOARD,light});this.scene=this.stage.scene;this.camera=this.stage.camera;this.scene.add(this.book.group);
    // Keep the original lighting and materials, but reuse unchanged shadow maps.
    this.renderer.shadowMap.autoUpdate=false;
    for(const l of [this.stage.key,this.stage.hemi,...this.stage.spill])l.layers.enableAll();
    this.post=createPost({renderer:this.renderer,scene:this.scene,camera:this.camera,ao:true,tone:new PaperTone({exposure:.9,desaturation:.03})});this.glass=new LiquidGlass();this.post.addEffect(this.glass,{after:'tone'});this.post.vignette.offset=.24;this.post.vignette.darkness=.52;
    for(const k of [SPREAD.coast,SPREAD.water,SPREAD.river]){
      const pop=new Popout(this.renderer,{frame:pageFrame(this.book,k,14,212),printRect:{x0:-10,x1:170,y0:-4,y1:196},pxPerMm:6,cab:new T.Vector2(.12,.9)});this.scene.add(pop.group);
      const art=k===SPREAD.coast?new CoastIllustration(pop):k===SPREAD.water?new WaterIllustration(pop):new RiverIllustration(pop);
      const flap=createFlap(this.book,k,{u0:54,v0:196,u1:172,v1:233},{hinge:'bottom',angle:2.85,face:(c:CanvasRenderingContext2D,w:number,h:number)=>this.drawFlap(c,w,h)});flap.group.visible=false;this.scene.add(flap.group);
      this.lessons.set(k,{pop,art,flap});
    }
    this.coverPlate();this.camera.position.set(-155,340,380);this.camera.lookAt(this.focus);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.resize();
    canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.cancel);canvas.addEventListener('lostpointercapture',this.cancel);canvas.addEventListener('wheel',this.wheel,{passive:false});canvas.addEventListener('webglcontextlost',this.lost);canvas.addEventListener('webglcontextrestored',this.restored);
  }
  private getPage(k:number,side:string){const key=`${k}:${side}`;let page=this.pages.get(key);if(!page){page=new Paper();this.pages.set(key,page);if(this.presentation)this.paint(page,k,side)}return page;}
  private paint(page:Paper,k:number,side:string){const p=this.presentation;if(!p)return;const at={...p,progress:{...p.progress,spread:k}};if(side==='left')page.left(at);else page.right(at,this.lastState);}
  private drawPage(k:number,side:string,c:CanvasRenderingContext2D){c.drawImage(this.getPage(k,side).canvas,0,0,190,250);}
  private drawFlap(c:CanvasRenderingContext2D,w:number,h:number){
    c.fillStyle='#f2ebdc';c.fillRect(0,0,w,h);c.strokeStyle='#a29b8c';c.lineWidth=.22;c.strokeRect(.7,.7,w-1.4,h-1.4);c.setLineDash([1.2,.65]);c.strokeRect(1.6,1.6,w-3.2,h-3.2);c.setLineDash([]);
    c.save();c.beginPath();c.rect(2.4,2.4,w-4.8,h-4.8);c.clip();c.strokeStyle='rgba(144,124,85,.12)';c.lineWidth=.22;for(let x=-h;x<w;x+=1.5){c.beginPath();c.moveTo(x,0);c.lineTo(x+h,h);c.stroke()}c.restore();
    c.fillStyle='#9a3b2a';c.font='600 3.5px FieldSerif';c.fillText('为什么？',5,8);c.fillStyle='#1c2433';c.font='5.7px FieldSerif';c.fillText('掀开纸片，核对你的想法',5,19);c.font='4px FieldSerif';c.fillStyle='#69645c';c.fillText('……先留一个预测。',5,28);c.font='italic 3.5px FieldSerif';c.fillText('从这里掀开',w-27,h-7);
    c.strokeStyle='#273463';c.lineWidth=.28;c.beginPath();c.moveTo(w-21,h-17);c.quadraticCurveTo(w-11,h-15,w-7,h-6);c.lineTo(w-7,h-12);c.moveTo(w-7,h-6);c.lineTo(w-13,h-8);c.stroke();
  }
  private coverPlate(){
    const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1020;const c=canvas.getContext('2d')!;c.fillStyle='#f2e8d2';c.fillRect(0,0,900,1020);c.strokeStyle='#1c2433';c.lineWidth=2;c.strokeRect(42,42,816,936);c.lineWidth=1;c.strokeRect(52,52,796,916);
    const shore=(z:number)=>440+45*Math.sin(z*.007);c.lineWidth=2;c.beginPath();for(let z=450;z<820;z+=3)z===450?c.moveTo(shore(z),z):c.lineTo(shore(z),z);c.stroke();
    for(let j=0;j<7;j++){c.beginPath();for(let x=105;x<405;x+=4){const y=480+j*45+6*Math.sin(x*.03+j);x===105?c.moveTo(x,y):c.lineTo(x,y)}c.stroke()}
    c.strokeRect(550,580,120,105);c.beginPath();c.moveTo(530,580);c.lineTo(610,520);c.lineTo(690,580);c.closePath();c.stroke();c.strokeRect(590,635,24,50);c.strokeRect(630,610,22,25);c.beginPath();c.moveTo(500,750);c.lineTo(500,525);c.lineTo(560,540);c.lineTo(500,565);c.stroke();
    c.lineWidth=3;c.beginPath();c.moveTo(230,425);c.bezierCurveTo(140,270,650,220,740,400);c.stroke();c.beginPath();c.moveTo(742,370);c.lineTo(740,400);c.lineTo(711,386);c.stroke();c.beginPath();c.moveTo(700,840);c.bezierCurveTo(590,910,280,920,160,840);c.stroke();c.beginPath();c.moveTo(179,867);c.lineTo(160,840);c.lineTo(192,840);c.stroke();c.font='40px FieldSerif';c.fillStyle='#9a3b2a';c.textAlign='center';c.fillText('海 陆 之 间',450,180);c.font='30px FieldSerif';c.fillStyle='#1c2433';c.fillText('一片海岸，两种热响应',450,230);
    const texture=new T.CanvasTexture(canvas);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;const mat=this.book.materials.plateMat;mat.map?.dispose();mat.map=texture;mat.needsUpdate=true;
  }
  async prepare(){
    await document.fonts.ready;if(this.disposed)return;
    this.shadowKey='';
    for(const [k,{pop,art}] of this.lessons){
      this.book.invalidatePage(k,'left');this.book.invalidatePage(k,'right');
      if(art instanceof CoastIllustration)art.update(0,this.lastState,{running:false,reveal:-1,flow:false,pressure:false,thermal:false,visible:false,reduced:true,quality:this.quality});
      else if(art instanceof WaterIllustration)art.update(0,this.presentation!.progress.chapters.water,false,true);
      else art.update(0,this.presentation!.progress.chapters.river,false,true,false);
      // Original print pass must see its geometry, even after an earlier frame hid it.
      pop.group.visible=true;pop.setFrame(pageFrame(this.book,k,14,212));this.scene.updateMatrixWorld(true);
      const mat=this.book.pageMaterial(k,'right');mat.uniforms.uPrintRect.value.set(4,16,180,200);mat.uniforms.uPrint.value=pop.renderPrint(this.scene);mat.uniforms.uPrintAlpha.value=1;pop.set('print');
    }
    this.leftKey='';this.rightKey='';if(this.presentation)this.setPresentation(this.presentation,true);
  }
  setPresentation(p:Presentation,force=false){
    this.presentation=p;this.lastState=evaluateSeaBreeze(p.progress.input);const key=JSON.stringify([p.progress.spread,p.progress.step,p.progress.prediction,p.progress.observations,p.progress.diagram,p.progress.checked,p.progress.transfer,p.progress.transferChecked,p.progress.hints,p.progress.conclusion,p.teacher,p.explain,p.watchIndex,p.watchPlaying]);
    const chapterKey=JSON.stringify({water:{...p.progress.chapters.water,phase:0},river:{...p.progress.chapters.river,phase:0}});
    if(force||key+chapterKey!==this.leftKey){for(const [id,page] of this.pages){const [k,side]=id.split(':');if(Number(k)===p.progress.spread||force){this.paint(page,Number(k),side);this.book.invalidatePage(Number(k),side)}}this.leftKey=key+chapterKey;this.rightKey=''}
    for(const [k,{flap}] of this.lessons){flap.group.visible=k===p.progress.spread&&!this.busy&&this.book.openSpread===k;if(flap.group.visible)flap.set(p.explain)}
  }
  setOpen(open:boolean){this.desiredOpen=open;}
  async enter(){if(!this.entry)return;this.targetLift=1;if(this.reduced)this.pop.set('live');else this.pop.draw();}
  async leave(){
    this.cancel();this.running=false;this.targetLift=0;this.view='阅读';
    for(const {flap} of this.lessons.values())flap.set(false);
    if(this.reduced){for(const {pop,flap} of this.lessons.values()){pop.set('print');flap.lay()}return}
    await Promise.all([...this.lessons.values()].map(async({pop,flap})=>{if(pop.state!=='print')await pop.undraw();flap.lay()}));
  }
  async flip(to:number,_from:number){this.busy=true;for(const {flap} of this.lessons.values())flap.group.visible=false;this.onHover('');if(this.presentation)for(const side of ['left','right']){const page=this.getPage(to,side);this.paint(page,to,side);this.book.invalidatePage(to,side)}if(this.reduced)this.book.setPosition(to);else await this.book.goTo(to,{duration:1.05});this.busy=false;this.leftKey='';this.rightKey='';const entry=this.lessons.get(to);if(entry)entry.pop.setFrame(pageFrame(this.book,to,14,212));}
  setQuality(q:string){this.quality=q;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='高'?1.5:q==='中'?1.25:1));if(this.post?.ao)this.post.ao.enabled=q==='高';const size=q==='高'?2048:q==='中'?1024:512,shadow=this.stage.key.shadow;if(shadow.mapSize.x!==size){shadow.mapSize.set(size,size);shadow.map?.dispose();shadow.map=null}this.shadowKey='';this.resize();}
  setGlassRects(rects:any[]){this.glass.setRects(rects,this.renderer.getPixelRatio(),this.host.clientWidth,this.host.clientHeight)}
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.stage.setSize(w,h);this.post.setSize(w,h);const s=this.renderer.getDrawingBufferSize(new T.Vector2());for(const {pop} of this.lessons.values())pop.setResolution(s.x,s.y);}
  update(dt:number,s:SeaBreezeDerivedState){
    if(this.disposed)return;this.renderer.info.reset();this.lastState=s;this.book.update(dt);const p=this.presentation;
    if(p){
      if(!this.busy&&!this.desiredOpen&&p.progress.spread===0&&this.book.position!==0)this.book.setPosition(0);
      const key=JSON.stringify([p.progress.spread,p.progress.step,p.progress.input.contrast,p.layers,p.teacher,p.playing,p.watchIndex,s.direction,s.stage,Math.round(s.phase*120)]);
      const chapter=chapterForSpread(p.progress.spread),rightKey=chapter?key+':'+Math.round(p.progress.chapters[chapter].phase*100):key;
      if(rightKey!==this.rightKey&&!this.busy&&(p.progress.spread===1||chapter)){const k=p.progress.spread,page=this.getPage(k,'right');page.right(p,s);this.book.invalidatePage(k,'right');this.rightKey=rightKey}
      for(const [k,{flap}] of this.lessons){flap.group.visible=k===p.progress.spread&&!this.busy&&this.book.openSpread===k;if(flap.group.visible){flap.place();flap.set(p.explain);if(this.reduced)flap.snap();else flap.update(dt)}}
      this.flopAngle=this.entry?this.flap.amount*2.85:0;
    }
    const active=!!p&&!!this.entry&&this.book.openSpread===p.progress.spread&&!this.busy&&!(p.progress.spread===1&&p.layers.diagram);
    for(const [k,{pop,art}] of this.lessons){
      const visible=active&&k===p?.progress.spread;
      pop.update(dt,this.scene);
      if(this.reduced&&visible&&this.targetLift&&pop.state!=='live')pop.set('live');
      pop.group.visible=visible&&pop.state!=='print';
      this.book.pageMaterial(k,'right').uniforms.uPrintAlpha.value=k===1&&p?.layers.diagram?0:pop.printAlpha;
      if(art instanceof CoastIllustration)art.update(dt,s,{running:this.running,reveal:this.reveal,flow:this.flowVisible,pressure:this.pressureVisible,thermal:this.thermalVisible,visible,reduced:this.reduced,quality:this.quality});
      else if(p&&art instanceof WaterIllustration)art.update(dt,p.progress.chapters.water,visible,this.reduced);
      else if(p&&art instanceof RiverIllustration)art.update(dt,p.progress.chapters.river,visible,this.reduced,this.running);
    }
    this.lift=!this.entry?0:this.pop.state==='live'?1:this.pop.state==='print'?0:Math.min(.995,this.pop.u.uClock.value/Math.max(.01,this.pop.drawEnd));
    // Original Every Joule camera (main.js:7889–7959), including aspect compensation.
    const open=T.MathUtils.clamp(this.book.position,0,1),blend=open*open*(3-2*open),aspect=this.camera.aspect;
    const dims=this.book.dims,centre=new T.Vector3(dims.CX+(dims.W+dims.OVER)/2,dims.Yb+dims.T/2,0);
    const focus=centre.clone().add(new T.Vector3(4,-8,6)).lerp(new T.Vector3(12,24,4),blend);
    const pos=centre.clone().add(new T.Vector3(-300,360,400)).lerp(new T.Vector3(16,430,400),blend);
    let dir=pos.sub(focus),distance=dir.length()*(aspect<1.6?Math.pow(1.6/aspect,aspect<1?.75:.9):1);
    if(active&&this.view!=='阅读'){focus.copy(new T.Vector3(85,25,-74).applyMatrix4(this.pop.group.matrixWorld));dir=this.view==='剖面'?new T.Vector3(0,.15,1):new T.Vector3(Math.sin(this.orbit)*.52,.65,.76);distance=(this.view==='剖面'?290:320)*this.zoom}
    const e=this.reduced?1:1-Math.exp(-5*dt);this.focus.lerp(focus,e);this.camera.position.lerp(dir.normalize().multiplyScalar(distance).add(this.focus),e);this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();this.stage.update(this.camera);
    const shadowKey=JSON.stringify([this.book.position,this.flopAngle,p?.progress.spread,[...this.lessons.values()].map(({pop})=>pop.state),s.direction,Math.round(s.strength*40),Math.round((p?.progress.chapters.river.phase??0)*1000),p?.layers]);
    this.shadowElapsed+=dt;
    const unfolding=[...this.lessons.values()].some(({pop})=>pop.state!=='print'&&pop.state!=='live');
    this.renderer.shadowMap.needsUpdate=this.busy||unfolding||shadowKey!==this.shadowKey||this.running&&p?.progress.spread===1&&this.shadowElapsed>(this.quality==='高'?1/15:1/8);
    if(this.renderer.shadowMap.needsUpdate){this.shadowKey=shadowKey;this.shadowElapsed=0}
    this.post.render(dt);
  }
  private pick(x:number,y:number){
    const r=this.host.getBoundingClientRect();this.mouse.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);
    if(this.book.position<.1){const found=this.ray.intersectObject(this.book.group,true);return found.length?{hit:{x:0,y:0,w:1280,h:1700,selector:'#start',label:'翻开这本书'} as PaperHit,px:0,py:0}:null}
    if(this.flap.group.visible&&this.ray.intersectObject(this.flap.mesh,false).length)return{hit:{x:0,y:0,w:1280,h:1700,selector:'[data-action="flap"]',kind:'flap',label:'掀开或合上解释纸片'} as PaperHit,px:0,py:0};
    const f=this.book.hitTest(this.ray);if(!f)return null;const page=this.getPage(f.k,f.side),px=f.u/190*PAPER_W,py=f.v/250*PAPER_H,hit=page.hits.find(h=>px>=h.x&&px<=h.x+h.w&&py>=h.y&&py<=h.y+h.h);return hit?{hit,px,py}:null;
  }
  private sliderFraction(f:{px:number;hit:PaperHit}){return T.MathUtils.clamp((f.px-130)/1016,0,f.hit.kind==='chapter-phase'?1:.999)};
  private down=(e:PointerEvent)=>{if(this.busy||e.button!==0)return;const f=this.pick(e.clientX,e.clientY);this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,hit:f?.hit??null,phase:(f?.hit.kind==='phase'||f?.hit.kind==='chapter-phase'),orbit:!f&&this.view==='实验'};this.renderer.domElement.setPointerCapture(e.pointerId);if((f?.hit.kind==='phase'||f?.hit.kind==='chapter-phase'))this.onPhase(this.sliderFraction(f),false)};
  private move=(e:PointerEvent)=>{if(this.busy)return;const p=this.pointer;if(p){if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>5)p.moved=true;if(p.phase){const f=this.pick(e.clientX,e.clientY);if((f?.hit.kind==='phase'||f?.hit.kind==='chapter-phase'))this.onPhase(this.sliderFraction(f),false)}else if(p.orbit){this.orbit=T.MathUtils.clamp(this.orbit+(e.clientX-p.x)*.007,-.65,.65);p.x=e.clientX;p.y=e.clientY}}else{const f=this.pick(e.clientX,e.clientY);this.renderer.domElement.style.cursor=(f?.hit.kind==='phase'||f?.hit.kind==='chapter-phase')?'ew-resize':f?'pointer':this.view==='实验'?'grab':'default';this.onHover(f?.hit.label??'')}};
  private up=(e:PointerEvent)=>{const p=this.pointer;this.pointer=null;if(!p)return;const f=this.pick(e.clientX,e.clientY);if(p.phase){if((f?.hit.kind==='phase'||f?.hit.kind==='chapter-phase'))this.onPhase(this.sliderFraction(f),true)}else if(!p.moved&&p.hit&&f?.hit.label===p.hit.label)this.onHit(p.hit);if(this.renderer.domElement.hasPointerCapture(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId)};
  private cancel=()=>{this.pointer=null};private wheel=(e:WheelEvent)=>{if(this.view==='实验'){e.preventDefault();this.zoom=T.MathUtils.clamp(this.zoom+e.deltaY*.00035,.82,1.13)}};
  private lost=(e:Event)=>{e.preventDefault();this.onLost()};private restored=()=>{this.leftKey='';this.rightKey='';this.prepare().then(()=>{if(this.targetLift)this.enter();this.onReady()})};
  get regions(){
    if(this.busy)return[];const rect=this.host.getBoundingClientRect(),project=(v:any)=>{v.project(this.camera);return{screenX:rect.left+(v.x+1)/2*rect.width,screenY:rect.top+(1-v.y)/2*rect.height}};
    if(this.book.position<.1)return[{x:0,y:0,w:1280,h:1700,selector:'#start',label:'翻开这本书',side:'cover',...project(new T.Vector3(103,12,40))}];const k=this.book.openSpread;if(!k)return[];
    const regions=['left','right'].flatMap(side=>this.getPage(k,side).hits.map(hit=>({...hit,side,...project(this.book.pageToWorld(k,side,(hit.x+hit.w/2)/PAPER_W*190,(hit.y+hit.h/2)/PAPER_H*250))})));
    if(this.flap.group.visible){this.flap.group.updateWorldMatrix(true,true);regions.push({x:0,y:0,w:1280,h:1700,kind:'flap',label:'掀开或合上解释纸片',selector:'[data-action="flap"]',side:'flap',...project(this.flap.mesh.localToWorld(new T.Vector3(59,.2,-18.5)))})}return regions;
  }
  get stats(){return{triangles:this.renderer.info.render.triangles,calls:this.renderer.info.render.calls,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,turningPagePool:this.book.parts.pool.length,lift:this.lift,open:Math.min(1,this.book.position),position:this.book.position,spread:this.book.openSpread,flap:this.flopAngle,busy:this.busy,activeModels:[...this.lessons.values()].filter(e=>e.pop.group.visible).length,engine:'Every Joule 48591dd'}}
  dispose(){
    this.disposed=true;this.observer.disconnect();const c=this.renderer.domElement;for(const [event,fn] of [['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.cancel],['lostpointercapture',this.cancel],['wheel',this.wheel],['webglcontextlost',this.lost],['webglcontextrestored',this.restored]] as const)c.removeEventListener(event,fn);
    for(const {art,pop} of this.lessons.values()){art.dispose();pop.print.target.dispose();pop.print.flipped.dispose()}this.book.dispose();this.post.composer.dispose();this.scene.traverse((o:any)=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){m.map?.dispose();m.normalMap?.dispose();m.roughnessMap?.dispose();m.dispose()}});this.scene.environment?.dispose();for(const p of this.pages.values())p.dispose();this.renderer.dispose();c.remove();
  }
}
