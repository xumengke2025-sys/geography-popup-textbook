import { THREE as T, createRenderer, createStage, createBook, createLight, Popout, createPost, PaperTone, LiquidGlass } from './reference/engine.js';
import { TextbookIllustration, LIFT_MARGIN } from './textbook-illustration';
import { SpecimenCloth } from './textbook-specimen-cloth';
import { dressDesk } from './textbook-desk';
import { pdfAt, pageUrl, SPREADS, figuresAt, spreadAt, type Figure } from './textbook-catalog';
import { advanceCrank, isDragInput, isPhaseInput, nearestDialStop, phaseDialPoint, phaseFromSpatialDialPoint, phaseTrackPoint, phaseFromTrackPoint, type PhaseInput, type DragInput, type IndexedDial, type ModelInput, type ModelInputChange } from './textbook-model-input';
import { fitModelViewport, measureProjectedLabel } from './textbook-framing';
import { BookCameraMotion, blendCameraPose, lessonObservationAngle, observationCameraArc, type CameraPose } from './textbook-camera-motion';
import { INSTRUMENT_LIGHT_LAYER } from './textbook-solid-materials';
import { loadSolarInstrument } from './textbook-solar-instrument';
import { loadFieldInstrument } from './textbook-field-instruments';
import { createInstrumentStudio } from './textbook-instrument-studio';

const contentW=250*612.28302/858.89801,offsetX=(190-contentW)/2;
export const rectMm=(f:Figure)=>({x:offsetX+f.rect[0]*contentW,y:f.rect[1]*250,w:f.rect[2]*contentW,h:f.rect[3]*250});
type Entry={figure:Figure;pop:any;art:TextbookIllustration;phase:number;selection:number};
type GrabOffset={x:number;y:number;z:number};

/** Original Every Joule renderer, now turning the actual textbook's pages. */
export class TextbookBook {
  renderer:any;scene:any;camera:any;book:any;
  reduced=false;running=false;quality='中';processNoteInset=0;processNoteLeftInset=0;controlInset=170;
  onFigure:(f:Figure)=>void=()=>{};onOpen:()=>void=()=>{};onNavigate:(n:number)=>void=()=>{};onRead:(pdf:number)=>void=()=>{};onHover:(f:Figure|null)=>void=()=>{};onLost=()=>{};
  onModelInput:(change:ModelInputChange)=>void=()=>{};
  private stage:any;private post:any;private glass:any;private observer:ResizeObserver;
  private images=new Map<number,HTMLImageElement>();private pending=new Map<number,Promise<HTMLImageElement>>();
  private entry:Entry|null=null;private dead=false;private contextLost=false;private busy=false;private zoomSide:'left'|'right'|null=null;
  private focus=new T.Vector3(105,0,0);private ray=new T.Raycaster();private mouse=new T.Vector2();private orbit=0;private elevation=1.1;private zoom=1;
  private drag:{id:number;x:number;y:number;moved:boolean;hit:ReturnType<TextbookBook['pick']>;model:ReturnType<TextbookBook['pickModel']>;phaseOffset?:GrabOffset;crank?:{angle:number;phase:number}}|null=null;
  private modelHover:any=null;
  private cue:HTMLDivElement;private cuePoint:any=null;private cueUntil=0;
  private inkAmount=-1;private shadowTime=0;private prevShadow='';private shadowRevision=0;
  private sceneView:'book'|'detail'='book';
  private cameraMotion = new BookCameraMotion({position:[-155,340,380],focus:[105,0,0]});
  private openingPose:CameraPose|null=null;
  private paperPose:CameraPose|null=null;
  private closingPose:CameraPose|null=null;
  private paperZoomSide:'left'|'right'|null=null;
  private paperZoom=1;
  private closing:Promise<void>|null=null;
  private observing=false;
  private observationTime=0;
  private observationBase={orbit:0,elevation:.72};
  specimenLighting = true;
  private cloth: SpecimenCloth;
  private desk:ReturnType<typeof dressDesk>;
  private instrumentStudio:ReturnType<typeof createInstrumentStudio>;
  constructor(private host:HTMLElement){
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','人教版地理必修一立体课本。通过目录或方向键翻页，点击原插图展开。');canvas.style.touchAction='none';host.append(canvas);
    this.cue=document.createElement('div');this.cue.className='model-touch-cue';this.cue.hidden=true;this.cue.setAttribute('aria-hidden','true');this.cue.innerHTML='<i></i><span></span>';host.append(this.cue);
    this.renderer=createRenderer(canvas);this.renderer.info.autoReset=false;
    this.instrumentStudio=createInstrumentStudio(this.renderer);
    const light=createLight();
    this.book=createBook({renderer:this.renderer,nSpreads:SPREADS,leaf:.105,hiPx:8,loPx:.65,light,drawPage:(k:number,side:'left'|'right',c:CanvasRenderingContext2D)=>this.drawPage(k,side,c)});
    // Keep printed ink readable under the desk lighting. The original paper
    // deformation and shading remain; the source page retains its contrast.
    for(let k=1;k<=SPREADS;k++)for(const side of ['left','right']){
      const mat=this.book.pageMaterial(k,side),compile=mat.onBeforeCompile;
      mat.normalScale.set(.06,.06);
      mat.onBeforeCompile=(shader:any,renderer:any)=>{compile(shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight = mix(diffuseColor.rgb * 0.93, outgoingLight, 0.06);\n#include <opaque_fragment>')};
      mat.customProgramCacheKey=()=> 'ej-original-page-readable-v1';
    }
    this.book.parts.ribbon.mesh.visible=false;
    this.stage=createStage(this.renderer,{deskTop:this.book.dims.Yb-this.book.dims.BOARD,light});this.scene=this.stage.scene;this.camera=this.stage.camera;this.scene.add(this.book.group);
    this.desk=dressDesk(this.stage,this.book,this.renderer);
    // Match the inspected mechanical reference's broad warm key and cool
    // reflected fill. The former blue window flattened brass into pale yellow.
    // Printed pages retain their independent contrast shader above.
    this.stage.key.color.set('#ffecd0');this.stage.key.intensity=3.2;
    this.cloth = new SpecimenCloth(this.scene, this.stage.key);
    this.stage.key.shadow.normalBias=.18;
    for(const l of [this.stage.key,this.stage.hemi,...this.stage.spill])l.layers.enableAll();
    // The source stage's window is behind the open book. Collect a restrained
    // front fill explicitly: Three.js filters lights by CAMERA layers. Page
    // contrast is protected by its authored shader above, not by light layers.
    this.camera.layers.enable(INSTRUMENT_LIGHT_LAYER);
    const instrumentFill=new T.DirectionalLight('#b8c7c8',.7);
    instrumentFill.position.set(480,420,560);instrumentFill.target.position.set(80,70,-20);
    instrumentFill.layers.set(INSTRUMENT_LIGHT_LAYER);this.scene.add(instrumentFill,instrumentFill.target);
    this.renderer.shadowMap.autoUpdate=false;
    this.post=createPost({renderer:this.renderer,scene:this.scene,camera:this.camera,ao:false,tone:new PaperTone({exposure:1,desaturation:0})});
    this.glass=new LiquidGlass();this.post.addEffect(this.glass,{after:'tone'});this.post.vignette.offset=.24;this.post.vignette.darkness=.4;
    this.camera.position.set(-155,340,380);this.camera.lookAt(this.focus);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.setQuality('中');
    canvas.addEventListener('pointerdown',this.down);canvas.addEventListener('pointermove',this.move);canvas.addEventListener('pointerup',this.up);canvas.addEventListener('pointercancel',this.cancel);canvas.addEventListener('lostpointercapture',this.cancel);canvas.addEventListener('dblclick',this.double);canvas.addEventListener('wheel',this.wheel,{passive:false});canvas.addEventListener('webglcontextlost',this.lost);canvas.addEventListener('webglcontextrestored',this.restored);
  }
  private async load(pdf:number){
    const found=this.images.get(pdf);if(found)return found;
    const waiting=this.pending.get(pdf);if(waiting)return waiting;
    const promise=(async()=>{const image=new Image();image.src=pageUrl(pdf);await image.decode();if(this.dead)return image;
      this.images.set(pdf,image);this.book.invalidatePage(spreadAt(pdf),pdf%2?'left':'right');return image;})();
    this.pending.set(pdf,promise);try{return await promise}finally{this.pending.delete(pdf)}
  }
  async prepare(spread:number){
    await document.fonts.ready;
    await Promise.all([this.ensure(spread||1),this.desk.ready]);
    const plate=new Image();plate.src=`${import.meta.env.BASE_URL}textbook/cover-detail.webp`;
    try{await plate.decode();if(this.dead)return;const texture=new T.Texture(plate);texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;texture.needsUpdate=true;const mat=this.book.materials.plateMat;mat.map?.dispose();mat.map=texture;mat.needsUpdate=true}catch{}
  }
  async ensure(spread:number){
    const needed=['left','right'].map(side=>pdfAt(spread,side as any)).filter((v):v is number=>v!==null);
    await Promise.all(needed.map(p=>this.load(p)));
    this.trim(spread);
    for(const n of [spread-1,spread+1])if(n>=1&&n<=SPREADS)for(const side of ['left','right'] as const){const p=pdfAt(n,side);if(p)this.load(p).catch(()=>{})}
  }
  private trim(spread:number){for(const [pdf] of this.images)if(Math.abs(spreadAt(pdf)-spread)>2)this.images.delete(pdf)}
  private drawPage(k:number,side:'left'|'right',c:CanvasRenderingContext2D){
    c.fillStyle='#fff';c.fillRect(0,0,190,250);const pdf=pdfAt(k,side),image=pdf?this.images.get(pdf):null;if(!image)return;
    c.drawImage(image,offsetX,0,contentW,250);
    if(this.entry?.figure.pdf===pdf&&this.entry.pop.state!=='print'){
      const r=rectMm(this.entry.figure);this.entry.art.erase(c,r.x,r.y,r.w,r.h,1-this.entry.pop.printAlpha);
    }
  }
  async goTo(n:number){
    this.setAutoOrbit(false);
    this.busy=true;this.zoomSide=null;this.orbit=0;this.elevation=1.1;this.zoom=1;
    try{await this.closeFigure();this.zoomSide=null;this.zoom=1;if(n>0)await this.ensure(n);
      if(this.reduced)this.book.setPosition(n);else await this.book.goTo(n,{duration:.95});
      this.trim(n||1);
    }finally{this.busy=false}
  }
  private frame(f:Figure){
    const k=spreadAt(f.pdf),side=f.pdf%2?'left':'right',r=rectMm(f),o=this.book.pageToWorld(k,side,r.x,r.y+r.h);
    // The original pageFrame fits the sheet across its width. Sampling only
    // 3 mm at the gutter instead follows the steep spine curl and turns the
    // entire illustration into a sloping wall.
    const x=this.book.pageToWorld(k,side,r.x+r.w,r.y+r.h).sub(o).normalize(),z=this.book.pageToWorld(k,side,r.x,r.y+r.h-20).sub(o).normalize().negate();
    const y=new T.Vector3().crossVectors(z,x).normalize();if(y.y<0)y.negate();z.crossVectors(x,y).normalize();o.addScaledVector(y,.45).addScaledVector(z,LIFT_MARGIN);
    return new T.Matrix4().makeBasis(x,y,z).setPosition(o);
  }
  async openFigure(f:Figure,phase=0,selection=0,current=()=>true){
    await this.closeFigure();if(!current())return;
    await Promise.all([this.load(f.pdf), f.effect === 'solar-activity' ? loadSolarInstrument() : loadFieldInstrument(f.id)]);
    if(this.dead||!current())return;
    this.openingPose=this.cameraMotion.pose;this.paperPose=this.cameraMotion.pose;
    this.closingPose=null;this.paperZoomSide=this.zoomSide;this.paperZoom=this.zoom;
    this.zoomSide=null;this.sceneView='detail';this.resetObservation(f.id);
    const r=rectMm(f),pop=new Popout(this.renderer,{frame:this.frame(f),printRect:{x0:-8,x1:r.w+8,y0:LIFT_MARGIN-8,y1:LIFT_MARGIN+r.h+8},pxPerMm:5,cab:new T.Vector2(0,1)});
    pop.instrumentEnvironment=this.instrumentStudio.texture;
    this.scene.add(pop.group);const art=new TextbookIllustration(f,pop,r.w,r.h);
    const floorBounds = art.geometry.bounds.clone().translate(art.geometry.root.position);
    pop.group.updateWorldMatrix(true, false);
    this.cloth.seat(pop.group.matrixWorld, floorBounds);
    this.entry={figure:f,pop,art,phase,selection};const res=this.renderer.getDrawingBufferSize(new T.Vector2());pop.setResolution(res.x,res.y);
    // The page itself supplies the print image. No generated print replaces it.
    this.scene.updateMatrixWorld(true);pop.set('print');if(this.reduced)pop.set('live');else pop.draw();
    this.inkAmount=-1;this.book.invalidatePage(spreadAt(f.pdf),f.pdf%2?'left':'right');
  }
  setFigure(phase:number,selection:number){if(this.entry){this.entry.phase=phase;this.entry.selection=selection}}
  private resetObservation(id?:string){
    const angle=lessonObservationAngle(id);
    this.orbit=angle.orbit;this.elevation=angle.elevation;this.zoom=1;
  }
  setSceneView(view:'book'|'detail'){this.setAutoOrbit(false);this.sceneView=view;this.zoomSide=null;this.resetObservation(this.entry?.figure.id)}
  setAutoOrbit(enabled:boolean){
    this.observing=enabled&&!!this.entry&&this.entry.pop.state==='live'&&!this.closing&&!this.busy&&!this.drag&&!this.reduced&&this.sceneView==='detail'&&this.zoomSide===null&&this.contextAvailable;
    if(this.observing){this.observationTime=0;this.observationBase={orbit:this.orbit,elevation:this.elevation}}
  }
  get autoOrbit(){return this.observing&&!this.reduced&&!!this.entry&&!this.closing}
  closeFigure():Promise<void>{
    if(this.closing)return this.closing;
    this.closing=this.releaseFigure().finally(()=>{this.closing=null});
    return this.closing;
  }
  private async releaseFigure(){
    this.setAutoOrbit(false);
    const e=this.entry;if(!e)return;
    this.cancel();this.setModelHover(null);
    this.running=false;
    this.closingPose=this.cameraMotion.pose;this.openingPose=null;
    if(this.reduced)e.pop.set('print');else if(e.pop.state!=='print')await e.pop.undraw();
    if(this.entry!==e)return;
    this.cloth.reset(); this.setDeskVisible(true);
    this.entry=null;this.zoomSide=this.paperZoomSide;this.zoom=this.paperZoom;
    this.closingPose=null;this.paperPose=null;
    this.scene.remove(e.pop.group);this.book.invalidatePage(spreadAt(e.figure.pdf),e.figure.pdf%2?'left':'right');
    e.art.dispose();
    const geoms=new Set<any>(),mats=new Set<any>();
    e.pop.group.traverse((o:any)=>{if(o.geometry)geoms.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m)});
    for(const set of e.pop.sets){if(set.flatGeometry)geoms.add(set.flatGeometry);if(set.geometry)geoms.add(set.geometry)}
    for(const g of geoms)g.dispose();for(const m of mats)m.dispose();
    for(const m of [...e.pop.inkMats,...e.pop.paperMats])if(!mats.has(m))m.dispose();
    e.pop.print.target.dispose();e.pop.print.flipped.dispose();e.pop.print.depthTarget.dispose();e.pop.print.flipMat.dispose();e.pop.print.visMat.dispose();e.pop.print.flipScene.traverse((o:any)=>o.geometry?.dispose());e.pop.shadowDepth?.dispose();this.prevShadow='';
  }
  setZoom(side:'left'|'right'|null){this.setAutoOrbit(false);this.zoomSide=side;this.zoom=1}
  setQuality(q:string){this.quality=q;this.renderer.setPixelRatio(Math.min(devicePixelRatio,q==='高'?1.5:q==='低'?1:1.25));this.resize();this.prevShadow=''}
  private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.stage.setSize(w,h);this.post.setSize(w,h);if(this.entry){const s=this.renderer.getDrawingBufferSize(new T.Vector2());this.entry.pop.setResolution(s.x,s.y)}}
  setGlass(rects:any[]){this.glass.setRects(rects,this.renderer.getPixelRatio(),this.host.clientWidth,this.host.clientHeight)}
  get contextAvailable(){return !this.dead&&!this.contextLost&&!this.renderer.getContext().isContextLost()}
  get playbackReady(){return !!this.entry&&this.entry.pop.state==='live'&&!this.closing}
  update(dt:number,render=true){
    if(this.dead)return;this.book.update(dt);
    const e=this.entry;
    // Page turns and popout promises must finish even while the 2-D reader is
    // visible. Their CPU transitions do not need a WebGL render or print pass.
    const draw=render&&this.contextAvailable;
    if (e && e.pop.state !== 'live' && this.cloth.seated) this.setDeskVisible(true);
    if(e)e.pop.update(dt,draw?this.scene:undefined);
    if(!draw)return;
    if(this.observing){
      if(this.reduced||this.drag||!e||e.pop.state!=='live'||this.closing||this.sceneView!=='detail'||this.zoomSide!==null)this.setAutoOrbit(false);
      else{
        this.observationTime+=Math.max(0,Math.min(.1,dt));
        const angle=observationCameraArc(this.observationBase,this.observationTime);
        this.orbit=angle.orbit;this.elevation=angle.elevation;
      }
    }
    this.renderer.info.reset();
    if(e){
      e.art.update(e.phase,e.selection,true,this.running?dt:0,this.reduced);
      const amount=Math.round(e.pop.printAlpha*30);
      if(amount!==this.inkAmount){this.inkAmount=amount;this.book.invalidatePage(spreadAt(e.figure.pdf),e.figure.pdf%2?'left':'right')}
    }
    const open=T.MathUtils.smoothstep(Math.min(this.book.position,1),0,1),d=this.book.dims,centre=new T.Vector3(d.CX+(d.W+d.OVER)/2,d.Yb+d.T/2,0);
    const target=centre.clone().add(new T.Vector3(4,-8,6)).lerp(new T.Vector3(12,22,2),open);
    let direction=centre.clone().add(new T.Vector3(-300,360,400)).lerp(new T.Vector3(12,530,285),open).sub(target),distance=direction.length();
    const aspect=this.camera.aspect;if(aspect<1.6)distance*=Math.pow(1.6/aspect,aspect<1?.75:.9);
    if(this.zoomSide&&this.book.openSpread){target.copy(this.book.pageToWorld(this.book.openSpread,this.zoomSide,96,126));direction=new T.Vector3(0,1,.08);distance=(aspect<.8?390:325)*this.zoom}
    if(e&&this.zoomSide===null){
      const localBounds=this.sceneView==='detail'?e.art.focusBounds:e.art.bounds,
        bounds=localBounds.clone().applyMatrix4(e.pop.group.matrixWorld),centre=bounds.getCenter(new T.Vector3());
      target.copy(centre);direction=new T.Vector3(Math.sin(this.orbit)*(e.figure.effect==='solar-distribution'?1.8:.8),this.elevation*(e.figure.effect==='vegetation'&&e.selection>=4?.68:1),1).normalize();
      const right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),direction).normalize(),up=new T.Vector3().crossVectors(direction,right).normalize();
      const corners:any[]=[];
      const landmarks = this.sceneView === 'detail' ? e.art.framingPoints : null;
      if (landmarks) for (const p of landmarks) corners.push(p.applyMatrix4(e.pop.group.matrixWorld).sub(centre));
      else for(const x of [localBounds.min.x,localBounds.max.x])for(const y of [localBounds.min.y,localBounds.max.y])for(const z of [localBounds.min.z,localBounds.max.z])corners.push(new T.Vector3(x,y,z).applyMatrix4(e.pop.group.matrixWorld).sub(centre));
      const fit=fitModelViewport(corners.map(p=>[p.dot(right),p.dot(up),p.dot(direction)]),this.host.clientWidth,this.host.clientHeight,this.camera.fov,86+this.processNoteInset,this.controlInset,this.processNoteLeftInset);
      distance=fit.distance*this.zoom;
      target.addScaledVector(up,-fit.shift*this.zoom).addScaledVector(right,-fit.shiftX*this.zoom);
      // The complete book is a deliberate overview, not the first half of an
      // experiment zoom. Using the future model's entire bounds here during
      // lift made every illustration retreat before it could rise.
      const detailBlend=this.sceneView==='detail'?1:0;
      if(detailBlend<1){
        // Fit the actual book AND the elevated model in camera coordinates.
        // Reserving room below prevents the controls from hiding page corners.
        const points:any[]=[];
        for(const side of ['left','right'])for(const u of [0,95,190])for(const v of [0,125,250])
          points.push(this.book.pageToWorld(this.book.openSpread,side,u,v));
        for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])
          points.push(new T.Vector3(x,y,z));
        const detailTarget=target.clone(),detailDistance=distance;
        distance=this.fitView(points,direction,target)*this.zoom;
        target.lerp(detailTarget,detailBlend);distance=T.MathUtils.lerp(distance,detailDistance,detailBlend);
      }
    }
    let destination:CameraPose={position:direction.normalize().multiplyScalar(distance).add(target).toArray(),focus:target.toArray()};
    if(e&&this.openingPose&&e.pop.state!=='live'){
      destination=blendCameraPose(this.openingPose,destination,e.art.unfoldProgress);
    }else if(e?.pop.state==='live')this.openingPose=null;
    if(e&&this.closingPose&&this.paperPose)
      destination=blendCameraPose(this.closingPose,this.paperPose,1-e.art.unfoldProgress);
    // A new observation note can change the framing while the pointer is on
    // a crank or rail. Keep its projection fixed until the reader lets go.
    const holdingControl=isDragInput(this.drag?.model?.input);
    const pose=holdingControl?this.cameraMotion.pose:this.cameraMotion.step(destination,dt,this.reduced,this.drag?12:9);
    this.focus.fromArray(pose.focus);this.camera.position.fromArray(pose.position);
    this.camera.lookAt(this.focus);this.camera.updateMatrixWorld();this.stage.update(this.camera);
    // Labels remain small paper objects, but face the reader. Projecting a
    // vertical label from an overhead camera was flattening Chinese into slits.
    if(e){const frameRotation=new T.Quaternion().setFromRotationMatrix(e.pop.group.matrixWorld);e.art.faceLabels(frameRotation.invert().multiply(this.camera.quaternion))}
    this.cloth.update(!!e && this.specimenLighting && this.viewingDetail, e?.art.unfoldProgress ?? 0, dt, this.reduced);
    this.setDeskVisible(!this.cloth.seated);
    this.updateCue();
    const key=[this.cloth.seated,this.book.position,e?.pop.state,this.zoomSide,this.quality,e?.phase,e?.selection,this.shadowRevision].join(':');this.shadowTime+=dt;
    // Raised specimens now contain working sliders, cutaways and probes. The
    // print-era cache key left their shadows at an earlier scientific pose.
    // Refresh motion at a bounded rate; the static book remains cached.
    const forming=!!e&&e.pop.state!=='live'&&e.pop.state!=='print';
    this.renderer.shadowMap.needsUpdate=this.busy||forming||
      (key!==this.prevShadow||!!e&&this.running)&&this.shadowTime>=1/20;
    if(this.renderer.shadowMap.needsUpdate){this.prevShadow=key;this.shadowTime=0}this.post.render(dt);
  }
  private setDeskVisible(visible: boolean) {
    if (this.book.group.visible !== visible) this.prevShadow = '';
    this.book.group.visible = visible;
    this.stage.pad.visible = visible;
    this.stage.desk.visible = visible;
  }
  private fitView(points:any[],direction:any,target:any){
    const forward=direction.clone().normalize(),right=new T.Vector3().crossVectors(new T.Vector3(0,1,0),forward).normalize(),up=new T.Vector3().crossVectors(forward,right).normalize();
    const extents=[right,up,forward].map(axis=>{const values=points.map(p=>p.dot(axis));return[Math.min(...values),Math.max(...values)]});
    target.set(0,0,0);[right,up,forward].forEach((axis,i)=>target.addScaledVector(axis,(extents[i][0]+extents[i][1])/2));
    const tan=Math.tan(this.camera.fov*Math.PI/360),bottom=Math.max(.46,1-2*126/this.host.clientHeight),top=Math.max(.35,.88-2*this.processNoteInset/this.host.clientHeight);
    let distance=240;
    for(const point of points){const p=point.clone().sub(target),depth=p.dot(forward),y=p.dot(up);
      distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tan*this.camera.aspect*.91),depth+Math.abs(y)/(tan*(y<0?bottom:top)));
    }
    return distance;
  }
  private pick(x:number,y:number){
    if (this.cloth.seated) return null;
    const r=this.host.getBoundingClientRect();this.mouse.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera);
    if(this.book.position<.1)return this.ray.intersectObject(this.book.group,true).length?{cover:true}:null;
    const p=this.book.hitTest(this.ray);if(!p)return null;
    const pdf=pdfAt(p.k,p.side),figure=pdf?figuresAt(p.k).find(f=>{const a=rectMm(f);if(f.marker)return f.pdf===pdf&&Math.abs(p.u-(offsetX+f.marker[0]*contentW))<6&&Math.abs(p.v-f.marker[1]*250)<6;return f.pdf===pdf&&p.u>=a.x&&p.u<=a.x+a.w&&p.v>=a.y&&p.v<=a.y+a.h}):undefined;
    return{...p,figure,corner:p.v>230&&(p.side==='left'?p.u<25:p.u>165)};
  }
  private setRay(x:number,y:number){const r=this.host.getBoundingClientRect();this.mouse.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);this.ray.setFromCamera(this.mouse,this.camera)}
  private pickModel(x:number,y:number):{object:any;input:ModelInput|null}|null{
    if(!this.entry||this.entry.pop.state!=='live'||this.closing)return null;
    this.setRay(x,y);this.entry.art.geometry.root.updateWorldMatrix(true,true);
    const meshes=this.entry.art.geometry.meshes.filter(mesh=>{for(let node=mesh;node;node=node.parent)if(!node.visible)return false;return true});
    const hit=this.ray.intersectObjects(meshes,false)[0];
    if(hit?.object.userData.modelInput){this.cuePoint=hit.object.worldToLocal(hit.point.clone());return{object:hit.object,input:hit.object.userData.modelInput}}
    // Delicate handles and explicitly marked small points retain a 44 CSS px
    // target. A nearer solid still occludes them; no invisible scene planes.
    const rect=this.host.getBoundingClientRect();
    for(const mesh of meshes){
      if(!isDragInput(mesh.userData.modelInput)&&!(mesh.userData.modelInput&&mesh.userData.smallPointTarget))continue;
      if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
      const sphere=mesh.geometry.boundingSphere,world=sphere.center.clone().applyMatrix4(mesh.matrixWorld),screen=world.clone().project(this.camera);
      if(screen.z<-1||screen.z>1)continue;
      const sx=rect.left+(screen.x+1)*rect.width/2,sy=rect.top+(1-screen.y)*rect.height/2;
      if(Math.hypot(x-sx,y-sy)>22)continue;
      const scale=mesh.getWorldScale(new T.Vector3()),radius=sphere.radius*Math.max(scale.x,scale.y,scale.z);
      if(!hit||hit.distance>=this.camera.position.distanceTo(world)-radius){this.cuePoint=sphere.center.clone();return{object:mesh,input:mesh.userData.modelInput}}
    }
    return hit?{object:hit.object,input:hit.object.userData.modelInput??null}:null;
  }
  private setModelHover(hit:ReturnType<TextbookBook['pickModel']>){
    if(this.modelHover)this.modelHover.userData.modelHovered=false;
    this.modelHover=hit?.input?hit.object:null;
    if(this.modelHover)this.modelHover.userData.modelHovered=true;
    this.renderer.domElement.title='';
    this.cue.hidden=!hit?.input;
    if(hit?.input){this.cue.querySelector('span')!.textContent=hit.input.label.split('；')[0];this.cueUntil=performance.now()+3200;this.cue.dataset.action=isDragInput(hit.input)?'drag':'observe'}
  }
  private updateCue(){
    if(!this.modelHover||!this.cuePoint||this.entry?.pop.state!=='live'||performance.now()>this.cueUntil){this.cue.hidden=true;return}
    const p=this.cuePoint.clone().applyMatrix4(this.modelHover.matrixWorld).project(this.camera),w=this.host.clientWidth,h=this.host.clientHeight;
    if(p.z < -1 || p.z > 1){this.cue.hidden=true;return}
    this.cue.hidden=false;const x=(p.x+1)*w/2,y=(1-p.y)*h/2;
    this.cue.style.left=`${Math.max(30,Math.min(w-30,x))}px`;this.cue.style.top=`${Math.max(74,Math.min(h-this.controlInset,y))}px`;
    this.cue.dataset.edge=x>w*.65?'left':'right';this.cue.dataset.pressed=String(!!this.modelHover.userData.modelPressed);
    const text=this.cue.querySelector('span')!;text.hidden=false;
    const tw=text.offsetWidth,th=text.offsetHeight,labels=this.labelLayout;
    const note=document.querySelector<HTMLElement>('#process-note');
    const forbidden=note&&!note.hidden?[...labels,note.getBoundingClientRect()]:labels;
    const candidates=[[28,24],[28,-th-24],[-tw-28,24],[-tw-28,-th-24],[-tw/2,38]];
    const free=candidates.find(([dx,dy])=>x+dx>12&&x+dx+tw<w-12&&y+dy>80&&y+dy+th<h-this.controlInset&&
      forbidden.every(r=>Math.min(x+dx+tw,r.right)-Math.max(x+dx,r.left)<-5||Math.min(y+dy+th,r.bottom)-Math.max(y+dy,r.top)<-5));
    if(free){text.style.left=`${free[0]+15}px`;text.style.top=`${free[1]+15}px`;text.style.right='auto'}else text.hidden=true;
  }
  inspect(target:string){if(this.entry){this.entry.art.inspect(target);if(target!=='overview')this.sceneView='detail';this.zoom=1;this.shadowRevision++}}
  get inspectTargets(){return this.entry?.art.inspectTargets??[]}
  private pointOnPhaseControl(x:number,y:number,input:DragInput){
    if(!this.entry)return null;
    this.setRay(x,y);
    const root=this.entry.art.geometry.root;
    root.updateWorldMatrix(true,false);
    const z=input.kind==='phase-track'?input.track.start[2]:input.dial.center[2];
    const plane=new T.Plane(new T.Vector3(0,0,1),-z);
    if(input.kind==='phase-dial'&&input.dial.plane==='yz')plane.set(new T.Vector3(1,0,0),-input.dial.center[0]);
    if(input.kind==='phase-track' && input.track.start[2]!==input.track.end[2]){
      const start=new T.Vector3(...input.track.start),end=new T.Vector3(...input.track.end);
      const axis=end.clone().sub(start).normalize(),middle=start.clone().lerp(end,.5);
      const normal=root.worldToLocal(this.camera.getWorldPosition(new T.Vector3())).sub(middle);
      normal.addScaledVector(axis,-normal.dot(axis));
      if(normal.lengthSq()<1e-10)return null;
      plane.setFromNormalAndCoplanarPoint(normal.normalize(),middle);
    }
    plane.applyMatrix4(root.matrixWorld);
    const world=this.ray.ray.intersectPlane(plane,new T.Vector3());
    return world?root.worldToLocal(world):null;
  }
  private dragPhaseControl(x:number,y:number,input:PhaseInput,offset?:GrabOffset,commit=false){
    const local=this.pointOnPhaseControl(x,y,input);if(!local||!this.entry)return;
    if(input.kind==='phase-dial'&&input.dial.turns&&this.drag?.crank){
      const crank=this.drag.crank;
      const angle=phaseFromSpatialDialPoint([local.x,local.y,local.z],input.dial,crank.angle);
      crank.phase=advanceCrank(crank.phase,crank.angle,angle,input.dial.turns);crank.angle=angle;
      this.onModelInput({phase:crank.phase,commit});return;
    }
    const px=local.x+(offset?.x??0),py=local.y+(offset?.y??0);
    const phase=input.kind==='phase-dial'?phaseFromSpatialDialPoint([px,py,local.z+(offset?.z??0)],input.dial,this.entry.phase):phaseFromTrackPoint(px,py,input.track,this.entry.phase,local.z+(offset?.z??0));
    this.onModelInput({phase,commit});
  }
  private setDialStop(x:number,y:number,input:IndexedDial,tap:boolean,commit:boolean){
    if(!this.entry)return;
    const local=this.pointOnPhaseControl(x,y,input);
    const at=local?nearestDialStop(local.x,local.y,input):null;
    const current=input.stops.findIndex(stop=>'selection' in stop
      ?stop.selection===this.entry!.selection:stop.inspection===this.entry!.art.inspection);
    const choice=tap&&(input.toggleOnTap||(input.advanceAtHub&&at===null))?(current+1)%input.stops.length:at;
    if(choice!==null && choice!==current)this.onModelInput({...input.stops[choice],keepPhase:input.keepPhase,commit});
    else if(commit)this.onModelInput({commit:true});
  }
  private down=(e:PointerEvent)=>{
    if(this.busy||this.drag||e.button!==0)return;
    this.setAutoOrbit(false);
    const model=this.pickModel(e.clientX,e.clientY);
    this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,hit:this.pick(e.clientX,e.clientY),model};
    if(isPhaseInput(model?.input)&&this.entry){
      const input=model.input,local=this.pointOnPhaseControl(e.clientX,e.clientY,input);
      const at=input.kind==='phase-dial'?phaseDialPoint(this.entry.phase,input.dial):phaseTrackPoint(this.entry.phase,input.track);
      if(local&&input.kind==='phase-dial'&&input.dial.turns)
        this.drag.crank={angle:phaseFromSpatialDialPoint([local.x,local.y,local.z],input.dial,0),phase:this.entry.phase};
      if(local)this.drag.phaseOffset={x:at[0]-local.x,y:at[1]-local.y,z:at[2]-local.z};
    }
    this.setModelHover(model);if(model?.input)model.object.userData.modelPressed=true;
    this.renderer.domElement.setPointerCapture(e.pointerId);
    if(isDragInput(model?.input)){
      const engage=model.input.kind==='phase-track'?model.input.engage:undefined;
      this.running=false;
      this.onModelInput({selection:engage&&this.entry?.selection===engage.from?engage.to:undefined,keepPhase:true,commit:false});
      this.renderer.domElement.style.cursor='grabbing';
    }
  };
  private move=(e:PointerEvent)=>{
    const p=this.drag;if(p){
      if(e.pointerId!==p.id)return;
      if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>6)p.moved=true;
      if(isPhaseInput(p.model?.input)){if(p.moved)this.dragPhaseControl(e.clientX,e.clientY,p.model.input,p.phaseOffset);return}
      if(p.model?.input?.kind==='indexed-dial'){
        if(p.moved&&!p.model.input.toggleOnTap)this.setDialStop(e.clientX,e.clientY,p.model.input,false,false);
        return;
      }
      if(p.moved&&this.entry){this.orbit=Math.max(-.8,Math.min(.8,this.orbit+(e.clientX-p.x)*.006));this.elevation=Math.max(.44,Math.min(1.45,this.elevation+(e.clientY-p.y)*.008));p.x=e.clientX;p.y=e.clientY}
    }else if(!this.busy){
      const model=this.pickModel(e.clientX,e.clientY);this.setModelHover(model);
      const hit=model?null:this.pick(e.clientX,e.clientY);
      this.renderer.domElement.style.cursor=isDragInput(model?.input)?'grab':model?.input?'pointer':hit?.figure||hit?.corner||hit?.cover?'pointer':this.entry?'grab':'default';this.onHover(hit?.figure??null);
    }
  };
  private up=(e:PointerEvent)=>{
    const p=this.drag;if(!p||e.pointerId!==p.id)return;
    const input=p.model?.input;if(p.model)p.model.object.userData.modelPressed=false;
    if(isPhaseInput(input)){
      if(p.moved)this.dragPhaseControl(e.clientX,e.clientY,input,p.phaseOffset,true);else if(this.entry)this.onModelInput({phase:this.entry.phase,commit:true});
    }else if(input?.kind==='indexed-dial'){
      this.setDialStop(e.clientX,e.clientY,input,!p.moved,true);
    }else if(!p.moved&&input?.kind==='select'&&this.entry&&!this.busy){
      this.onModelInput({selection:this.entry.selection===input.selection?(input.toggleTo??input.selection):input.selection,keepPhase:input.keepPhase,commit:true});
    }else if(!p.moved&&input?.kind==='inspect'&&this.entry&&!this.busy){
      const current=this.entry.art.inspection;
      this.onModelInput({inspection:current===input.target?(input.toggleTo??input.target):input.target,commit:true});
    }else if(!p.moved&&input?.kind==='replay'&&this.entry&&!this.busy){
      this.onModelInput({selection:input.selection,replay:true,commit:true});
    }else if(!p.moved&&!p.model&&!this.busy){
      const hit=this.pick(e.clientX,e.clientY);
      if(hit){if(hit.cover)this.onOpen();else if(hit.corner)this.onNavigate(this.book.openSpread+(hit.side==='left'?-1:1));else if(hit.figure)this.onFigure(hit.figure);else{const pdf=pdfAt(hit.k,hit.side);if(pdf)this.onRead(pdf)}}
    }
    this.drag=null;
    this.renderer.domElement.style.cursor=isDragInput(input)?'grab':this.entry?'grab':'default';
    if(this.renderer.domElement.hasPointerCapture(e.pointerId))this.renderer.domElement.releasePointerCapture(e.pointerId);
  };
  private cancel=()=>{const p=this.drag;this.drag=null;if(p?.model)p.model.object.userData.modelPressed=false;if(isDragInput(p?.model?.input)&&this.entry)this.onModelInput({commit:true});if(p&&this.renderer.domElement.hasPointerCapture(p.id))this.renderer.domElement.releasePointerCapture(p.id);this.setModelHover(null)};
  private double=(e:MouseEvent)=>{if(this.pickModel(e.clientX,e.clientY))return;const h=this.pick(e.clientX,e.clientY);if(h&&!h.figure&&!h.cover){this.setAutoOrbit(false);this.zoomSide=this.zoomSide?null:h.side}};
  private wheel=(e:WheelEvent)=>{if(this.entry||this.zoomSide){this.setAutoOrbit(false);e.preventDefault();this.zoom=Math.min(1.5,Math.max(.7,this.zoom+e.deltaY*.0005))}};
  private lost=(e:Event)=>{e.preventDefault();this.setAutoOrbit(false);this.contextLost=true;this.running=false;this.cancel();this.onLost()};private restored=()=>{this.contextLost=false;this.prevShadow='';this.book.invalidatePage(this.book.openSpread??1,'left');this.book.invalidatePage(this.book.openSpread??1,'right')};
  get regions(){const k=this.book.openSpread;if(!k)return[];const r=this.host.getBoundingClientRect();return figuresAt(k).map(f=>{const b=rectMm(f),p=this.book.pageToWorld(k,f.pdf%2?'left':'right',f.marker?offsetX+f.marker[0]*contentW:b.x+b.w/2,f.marker?f.marker[1]*250:b.y+b.h/2);p.project(this.camera);return{id:f.id,screenX:r.left+(p.x+1)/2*r.width,screenY:r.top+(1-p.y)/2*r.height}})}
  get viewingDetail(){return this.sceneView==='detail'&&this.zoomSide===null}
  get processBounds(){
    const e=this.entry;if(!e||e.pop.state!=='live'||e.art.unfoldProgress<.98)return null;
    const bounds=e.art.bounds,rect=this.host.getBoundingClientRect();
    const points=[];
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])
      points.push(new T.Vector3(x,y,z).applyMatrix4(e.pop.group.matrixWorld).project(this.camera));
    const xs=points.map(p=>rect.left+(p.x+1)*rect.width/2),ys=points.map(p=>rect.top+(1-p.y)*rect.height/2);
    const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
    return{left,right,top,bottom,width:right-left,height:bottom-top};
  }
  private get labelLayout(){
    if(!this.entry||this.entry.pop.state!=='live')return[];
    return this.entry.art.geometry.meshes.filter(m=>m.visible&&m.userData.kind==='text-label').map(m=>{
      m.geometry.computeBoundingBox();const box=m.geometry.boundingBox;
      const corners=[[box.min.x,box.min.y],[box.max.x,box.min.y],[box.max.x,box.max.y],[box.min.x,box.max.y]]
        .map(([x,y])=>new T.Vector3(x,y,0).applyMatrix4(m.matrixWorld).project(this.camera))
        .map(p=>[(p.x+1)*this.host.clientWidth/2,(1-p.y)*this.host.clientHeight/2] as [number,number]);
      return{text:m.userData.text,...measureProjectedLabel(corners,m.userData.fontRatio)};
    });
  }
  get stats(){return{position:this.book.position,spread:this.book.openSpread,busy:this.busy,figure:this.entry?.figure.id??null,modelState:this.entry?.pop.state??null,geometry:this.entry?.art.diagnostics??null,view:this.sceneView,specimenCloth:this.cloth.seated,camera:{...this.cameraMotion.pose,autoOrbit:this.autoOrbit,orbit:this.orbit,elevation:this.elevation,transition:this.closingPose?'returning-to-page':this.openingPose?'following-lift':'observing'},labels:this.labelLayout,models:this.entry?1:0,images:this.images.size,triangles:this.renderer.info.render.triangles,calls:this.renderer.info.render.calls,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,hiRes:this.book.stats().hiRes,engine:'Every Joule 48591dd'}}
  dispose(){
    this.dead=true;this.observer.disconnect();this.reduced=true;this.closeFigure();this.desk.dispose();this.cloth.dispose();
    const canvas=this.renderer.domElement;for(const[name,fn]of[['pointerdown',this.down],['pointermove',this.move],['pointerup',this.up],['pointercancel',this.cancel],['lostpointercapture',this.cancel],['dblclick',this.double],['wheel',this.wheel],['webglcontextlost',this.lost],['webglcontextrestored',this.restored]]as const)canvas.removeEventListener(name,fn);
    this.book.dispose();this.post.composer.dispose();this.scene.traverse((o:any)=>{o.geometry?.dispose();for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[]){m.map?.dispose();m.normalMap?.dispose();m.roughnessMap?.dispose();m.dispose()}});this.scene.environment?.dispose();this.instrumentStudio.dispose();this.renderer.dispose();this.images.clear();canvas.remove();this.cue.remove();
  }
}

