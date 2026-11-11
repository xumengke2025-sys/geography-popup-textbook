import './textbook-style.css';
import { createCapsule, capsuleCSS } from './reference/engine.js';
import { TextbookBook } from './textbook-book';
import { TITLE, SPREADS, contents, pdfAt, spreadAt, printedPage, numberedPage, spreadPageLabel, LAST_PRINTED_PAGE, sectionAt, pageUrl, figuresAt, figures, figureById, type Figure } from './textbook-catalog';
import { evaluateFigure } from './textbook-effects';
import { flatModelSvg } from './textbook-flat-model';
import { evaluateSeaBreeze, AFTERNOON, NIGHT } from './model';
import { createWorkbench } from './textbook-workbench';
import { processTimeline, seekProcessPhase, type ProcessTimeline } from './textbook-timeline';
import './textbook-timeline.css';
import { playbackPolicy, restartForSelection } from './textbook-playback-policy';
import { inspectionTargets } from './textbook-inspection';
import { advancePresentationPhase } from './textbook-playback-rhythm';
import { quakeResponseActions } from './textbook-integrated-model';

const KEY='pep-geography-first-original-v2';
const PLAYBACK_SPEEDS=[0.5,1,2,4] as const;
type PlaybackSpeed=typeof PLAYBACK_SPEEDS[number];
// A strata layer can be the active evidence while the two reading modes stay
// unchanged. Values 2–7 identify six physical layers, rather than extra tabs.
const selectionLimit=(f:Figure)=>f.selectionLimit??(f.effect==='strata'?7:f.effect==='orbit'?8:(f.controls?.length??1)-1);
interface Bookmark {version:2;spread:number;figures:Record<string,{phase:number;selection:number}>;notes:Record<string,string>;quality:string;reduced:boolean;playbackSpeed:PlaybackSpeed}
const fresh=():Bookmark=>({version:2,spread:0,figures:{},notes:{},quality:'中',reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,playbackSpeed:2});
let student=fresh(),storage=true;
try{const p=JSON.parse(localStorage.getItem(KEY)??'null');if(p?.version===2){student.spread=Number.isInteger(p.spread)?Math.min(SPREADS,Math.max(0,p.spread)):0;student.quality=['高','中','低'].includes(p.quality)?p.quality:'中';student.reduced=typeof p.reduced==='boolean'?p.reduced:student.reduced;
  if(PLAYBACK_SPEEDS.includes(p.playbackSpeed))student.playbackSpeed=p.playbackSpeed;
  for(const f of figures){const item=p.figures?.[f.id];if(item)student.figures[f.id]={phase:Number.isFinite(item.phase)?Math.min(1,Math.max(0,item.phase)):0,selection:Number.isInteger(item.selection)?Math.min(selectionLimit(f),Math.max(f.effect==='soil'?-1:0,item.selection)):f.effect==='soil'?-1:0}}
  if(p.notes&&typeof p.notes==='object')for(const[k,v]of Object.entries(p.notes))if(typeof v==='string'&&v.length<=20000)student.notes[k]=v;
}}catch{storage=false}
const entryQuery=new URLSearchParams(location.search);
// A narrow desktop preview is still a 3-D book. Only phone-sized touch
// screens start in reading mode; the explicit URL switches take precedence.
const phoneReading=innerWidth<600&&matchMedia('(pointer: coarse) and (hover: none)').matches;
let data=student,teacher=false,twoD=entryQuery.has('3d')?false:entryQuery.has('2d')||phoneReading,opened=false,spread=0,target=0,turning=false,active:Figure|null=null,playing=false,book:TextbookBook|null=null,ready=false,figureBusy=false;
type ReadingReason='manual'|'phone'|'webgl'|'resource'|'context'|'initialization';
let readingReason:ReadingReason|null=twoD?(entryQuery.has('2d')?'manual':'phone'):null,renderFailure:string|null=null,retrying3D=false;
let previous=performance.now(),hidden=false,lastSave=0,notifyTimer=0;
let switchingTeacher=false,studentView:{spread:number;figure:string|null}|null=null;
 let figureRequest=0,modeRequest=0,navigationPromise:Promise<void>|null=null,foldingPromise:Promise<void>|null=null;
let processSeek:{from:number;to:number;elapsed:number;cyclic:boolean}|null=null;
let inspection='overview';
let processInfo:ProcessTimeline|null=null,processKey='',choiceKey='',processLayoutKey='',processNoteMeasureKey='',processBoundsReadyAt=0;
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const app=$('#app');
const playIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5.5 19 12 9 18.5Z" fill="currentColor"/></svg>';
const closeIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" stroke-width="1.5"/></svg>';
app.innerHTML=`<main id="book-stage" aria-label="${TITLE}"><div id="scene"></div><div id="hotspots"></div><section id="flat-reader" aria-label="教材原页" hidden></section><button id="open-book" class="sr-only">${student.spread?'继续阅读':'翻开课本'}</button></main>
<div id="book-ui"></div><div id="hover-title" aria-hidden="true"></div><aside id="process-note" aria-label="当前过程说明" hidden><div class="process-note-heading"><span id="process-stage"></span><span id="process-count" aria-hidden="true"></span></div><div id="process-note-copy" role="status" aria-live="polite" aria-atomic="true"><h2 id="process-title"></h2><p id="process-text"></p></div></aside><aside id="render-mode-notice" aria-label="阅读模式" hidden><span id="render-mode-label">二维阅读</span><span id="render-mode-reason" role="status" aria-live="polite"></span><button id="retry-3d" type="button">进入立体书</button></aside><div id="status" role="status" aria-live="polite"></div>
<aside id="contents" aria-label="教材目录" hidden><div class="panel-heading"><h1>${TITLE}</h1><button id="close-contents" class="icon" aria-label="关闭目录">${closeIcon}</button></div><div class="contents-scroll"><button data-spread="0" class="contents-row"><span>封面</span></button><button data-pdf="4" class="contents-row"><span>目录</span></button>
${contents.map(c=>`<section class="chapter"><button class="chapter-title" data-pdf="${c.page+5}">${c.title}</button>${c.sections.map(s=>`<button class="contents-row${s.type?' secondary':''}" data-pdf="${s.page+5}"><span>${s.title}</span><span>${s.page}</span></button>`).join('')}</section>`).join('')}
<details class="figure-index"><summary>立体演示</summary>${figures.map(f=>`<button class="contents-row" data-figure="${f.id}"><span>${f.title}</span><span>${f.pdf-5}</span></button>`).join('')}</details></div>
<form id="page-jump"><label for="page-number">页码</label><input id="page-number" type="number" min="1" max="${LAST_PRINTED_PAGE}" inputmode="numeric" required><button>前往</button></form><div class="menu-tools"><button id="read-left">放大左页</button><button id="read-right">放大右页</button><button id="read-whole">整本</button><button id="mode">二维阅读</button><button id="settings-button">设置</button><button id="notes-button">笔记</button><button id="sources-button">来源</button></div></aside>
<section id="figure-controls" aria-label="插图控制" hidden><div id="selections"></div><label id="compact-selection" hidden><span class="sr-only">实验条件或类型</span><select id="condition-choice" aria-label="实验条件或类型"></select><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg></label><div id="process-stops" aria-label="形成过程快捷节点" hidden></div><div class="figure-timeline"><div class="process-range"><label class="sr-only" for="phase">演示进度</label><input id="phase" type="range" min="0" max="1000" value="0"><div id="process-ticks" aria-hidden="true"></div></div><button id="model-inspect" aria-controls="model-inspections" aria-expanded="false" hidden>部位</button><div id="model-inspections" role="group" aria-label="局部观察" hidden></div><button id="scene-view" aria-label="近看立体场景" aria-pressed="false">近看</button><button id="restart">重放</button><button id="fold">收回</button><button id="figure-note" class="icon" aria-label="模型说明"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 11v6m0-10v1" stroke="currentColor" stroke-width="1.6"/></svg></button></div></section>
<dialog id="settings-dialog"><div class="panel-heading"><h2>设置</h2><button class="icon" data-close aria-label="关闭设置">${closeIcon}</button></div><label class="setting">画质<select id="quality"><option>高</option><option>中</option><option>低</option></select></label><label class="setting">减少动态效果<input type="checkbox" id="reduced"></label><button id="clear-bookmark">清除本书记录</button><p id="storage-state"></p></dialog>
<dialog id="notes-dialog"><div class="panel-heading"><h2 id="notes-title">笔记</h2><button class="icon" data-close aria-label="关闭笔记">${closeIcon}</button></div><label class="sr-only" for="notes-text">本页笔记</label><textarea id="notes-text" rows="10" maxlength="20000"></textarea><button id="print-pages">打印原页与笔记</button></dialog>
<dialog id="sources-dialog"><div class="panel-heading"><h2>来源</h2><button class="icon" data-close aria-label="关闭来源">${closeIcon}</button></div><p>人教版普通高中教科书《地理 必修 第一册》。内页直接使用本地核验 PDF 第2—133页，含印刷页1—124页、扉页、版权页、目录及4张书末留白；文字、插图和版式保持原页。</p><p>书本、纸张、翻页、笔触、立体展开和底栏改编自 <a href="https://github.com/iamtechartist/every-joule-lesson1/tree/48591ddc5f0a22e6eb2a5a41c424a426599061ca" target="_blank" rel="noreferrer">Every Joule · 48591dd</a>。</p><p><a href="https://github.com/TapXWorld/ChinaTextbook/blob/master/高中/地理/人教版-人民教育出版社/普通高中教科书·地理必修%20第一册.pdf" target="_blank" rel="noreferrer">教材 PDF 来源</a>。教材与原项目的权利归原权利人；本地改编记录见交付文档。</p><p>立体解释由独立三维几何构成，在原教材页上方展开。每个模型的条件可在展开后打开“模型说明”。</p></dialog>
<dialog id="figure-dialog"><div class="panel-heading"><h2 id="figure-dialog-title"></h2><button class="icon" data-close aria-label="关闭说明">${closeIcon}</button></div><p id="figure-dialog-text"></p></dialog>
<dialog id="page-reader" aria-label="原页放大阅读"><header class="reader-toolbar"><button id="reader-prev" class="icon" aria-label="上一页"><svg viewBox="0 0 24 24"><path d="m14 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button><span id="reader-title"></span><button id="reader-next" class="icon" aria-label="下一页"><svg viewBox="0 0 24 24"><path d="m10 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button><span class="reader-space"></span><button id="reader-smaller" aria-label="缩小原页">−</button><output id="reader-scale">100%</output><button id="reader-larger" aria-label="放大原页">+</button><button id="reader-close" class="icon" aria-label="返回立体书">${closeIcon}</button></header><div id="reader-scroll"><img id="reader-image" alt=""></div></dialog><div id="print-area"></div>`;
const style=document.createElement('style');style.textContent=capsuleCSS;document.head.append(style);
const capsule=createCapsule($('#book-ui'),{
 onContents:()=>toggleContents(),onPrev:()=>navigate((turning?target:spread)-1),onNext:()=>opened?navigate((turning?target:spread)+1):navigate(data.spread||1),
 onWatch:()=>{const f=figuresAt(spread)[0];if(f)showFigure(f)},onPause:()=>togglePlay(),onStill:(value:boolean)=>{data.reduced=value;finishProcessSeek();if(book)book.reduced=value;playing=false;capsule.setStill(value);save();refreshControls()},
 onLeave:()=>toggleTeacher(),teachersHref:'#',hide:['cSound'],
});
const dock=$('.capsule');dock.setAttribute('aria-label','课本控制');
// LiquidGlass caches screen-space rectangles. Invalidate both its rectangle
// and resolution when responsive controls reflow or the viewport moves them.
const invalidateGlass=()=>{capsule.dirty=true;const rect=dock.getBoundingClientRect();document.documentElement.style.setProperty('--book-dock-height',`${Math.ceil(rect.height)}px`);if(book)book.controlInset=Math.max(96,innerHeight-rect.top+22)};
new ResizeObserver(invalidateGlass).observe(dock);
window.addEventListener('resize',invalidateGlass,{passive:true});
dock.insertBefore($('#figure-controls'),$('#cNext'));
$('#scene-view').insertAdjacentHTML('beforebegin','<button id="cSpeed" type="button" aria-label="演示速度：2 倍，点击切换">2×</button>');
$('#scene-view').insertAdjacentHTML('afterend','<button id="scene-orbit" type="button" aria-label="自动环看立体模型" aria-pressed="false" hidden>环看</button>');
$('#cStill').insertAdjacentHTML('beforebegin',`<button id="cRead" class="ic" aria-label="放大阅读原页" title="放大阅读原页"><svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m15.5 15.5 5 5M7.5 10.5h6m-3-3v6" stroke="currentColor" stroke-width="1.5"/></svg></button>`);
$('#cTeach').addEventListener('click',e=>e.preventDefault());
const names:Record<string,string>={cContents:'目录',cPrev:'上一跨页',cNext:'下一跨页',cWatch:'展开插图',cPause:'暂停演示',cStill:'减少动态效果',cTeach:'教师演示'};
for(const[id,name]of Object.entries(names)){$('#'+id).setAttribute('aria-label',name);$('#'+id).title=name}
$('#cPrev').title='上一跨页 · ← / Page Up';$('#cNext').title='下一跨页 · → / Page Down';
const workbench=createWorkbench({onNavigate:navigate});
function syncWorkbench(){workbench.update({spread,active:active?.id??null,playing,teacher,twoD,reduced:data.reduced,busy:turning||figureBusy});syncRenderingMode()}

function syncRenderingMode(){
 const notice=$('#render-mode-notice');notice.hidden=!twoD;
 notice.dataset.reason=readingReason??'manual';
 const labels:Record<ReadingReason,string>={manual:'可切换为立体书',phone:'手机阅读布局',webgl:'立体渲染暂不可用',resource:'课本资源未载入',context:'立体视图已暂停',initialization:'立体视图未完成加载'};
 const reason=twoD?labels[readingReason??'manual']:'';
 if($('#render-mode-reason').textContent!==reason)$('#render-mode-reason').textContent=reason;
 const retry=$<HTMLButtonElement>('#retry-3d');retry.disabled=retrying3D||turning||figureBusy;
 retry.textContent=retrying3D?'正在打开…':readingReason&&['webgl','resource','context','initialization'].includes(readingReason)?'重试立体书':'进入立体书';
 $('#mode').textContent=twoD?'立体书':'二维阅读';
}

function readingFailure(error:unknown):ReadingReason{
 renderFailure=error instanceof Error?`${error.name}: ${error.message}`:String(error);
 if(/webgl|creating.*context|graphics context/i.test(renderFailure))return 'webgl';
 if(/decode|source image|image|encodingerror|load|fetch|network/i.test(renderFailure))return 'resource';
 return 'initialization';
}

function fallBackToReading(error:unknown){
 readingReason=readingFailure(error);book?.dispose();book=null;
 // The renderer constructor may append its canvas before throwing, so a
 // failed construction needs to remove children even without a book instance.
 $('#scene').replaceChildren();twoD=true;document.body.classList.add('two-d');$('#scene').hidden=true;
 renderFlat();syncRenderingMode();console.error(error);
}

function bindOriginalPageImages(){
 for(const image of $('#flat-reader').querySelectorAll<HTMLImageElement>('.original-page>img')){
  const article=image.parentElement!,pdf=Number(article.dataset.originalPdf);
  const failed=()=>{
   if(article.querySelector('.page-load-fallback'))return;
   image.hidden=true;
   const placeholder=document.createElement('div');placeholder.className='page-load-fallback';placeholder.setAttribute('role','status');
   const text=document.createElement('p');text.textContent=`教材第 ${printedPage(pdf)} 页暂未载入`;
   const retry=document.createElement('button');retry.type='button';retry.textContent='重新载入原页';
   retry.onclick=()=>{placeholder.remove();image.hidden=false;image.src=`${pageUrl(pdf)}?retry=${Date.now()}`};
   placeholder.append(text,retry);article.append(placeholder);
  };
  image.addEventListener('error',failed);
  image.addEventListener('load',()=>{image.hidden=false;article.querySelector('.page-load-fallback')?.remove()});
  if(image.complete&&!image.naturalWidth)failed();
 }
}

function message(text:string){$('#status').textContent=text;clearTimeout(notifyTimer);notifyTimer=window.setTimeout(()=>$('#status').textContent='',4500)}
function save(){if(teacher)return;data.spread=spread||data.spread;try{localStorage.setItem(KEY,JSON.stringify(data));storage=true}catch{storage=false}$('#storage-state').textContent=storage?'书签和笔记保存在当前浏览器。':'临时会话：关闭后不会保留本次记录。'}
function item(f=active){if(!f)return{phase:0,selection:0};return data.figures[f.id]??(data.figures[f.id]={phase:f.effect==='breeze'?AFTERNOON:0,selection:f.effect==='soil'?-1:0})}
function closeContents(){const panel=$('#contents');if(!panel.hidden&&panel.contains(document.activeElement))$('#cContents').focus({preventScroll:true});panel.hidden=true;workbench.syncContents(false)}
function toggleContents(value=!$('#contents').hidden){$('#contents').hidden=value;workbench.syncContents(!value);if(value)$('#cContents').focus({preventScroll:true})}
function refreshCapsule(){
 const l=pdfAt(spread,'left'),r=pdfAt(spread,'right'),n=spreadPageLabel(spread);
 capsule.setWhere(opened?n:'',opened?sectionAt(r??l??2):TITLE,{canWatch:opened&&figuresAt(spread).length>0,first:spread===0,last:spread===SPREADS});
 capsule.setStill(data.reduced);capsule.caption(active?active.title:null,0,0,!playing);$('#cPause').setAttribute('aria-label',playing?'暂停演示':'继续演示');
 const speedButton=$('#cSpeed'),nextSpeed=PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(data.playbackSpeed)+1)%PLAYBACK_SPEEDS.length];
 speedButton.textContent=`${data.playbackSpeed}×`;speedButton.title=`演示速度：${data.playbackSpeed} 倍 · 点击切换为 ${nextSpeed} 倍`;speedButton.setAttribute('aria-label',speedButton.title);
 document.title=TITLE;document.body.classList.toggle('teacher-mode',teacher);$('#cTeach').setAttribute('aria-pressed',String(teacher));
 $('#cRead').hidden=!opened;$('#cWatch').hidden=!!active||!opened||!figuresAt(spread).length;
 $('#cPause').hidden=!active||!playbackPolicy(active,item().selection).enabled;capsule.dirty=true;
 $<HTMLSelectElement>('#quality').value=data.quality;$<HTMLInputElement>('#reduced').checked=data.reduced;
 $<HTMLButtonElement>('#clear-bookmark').disabled=teacher;$('#clear-bookmark').textContent=teacher?'个人记录在授课中受保护':'清除本书记录';
 syncWorkbench();
}
function renderFlat(){
 const flat=$('#flat-reader');flat.hidden=!twoD;
 if(!twoD)return;
 if(!opened){flat.innerHTML=`<button class="flat-cover" id="flat-open"><h1>${TITLE}</h1><img src="${import.meta.env.BASE_URL}textbook/cover-detail.webp" alt="教材封面的河流影像"></button>`;$('#flat-open').onclick=()=>navigate(data.spread||1);return}
 const demo=active?`<section class="flat-demonstration" aria-label="${active.title}二维演示"><div class="flat-concept">${flatModelSvg(active,item().phase,item().selection,inspection)}</div></section>`:'';
 flat.innerHTML=demo+`<div class="original-spread">`+(['left','right']as const).map(side=>{const pdf=pdfAt(spread,side);if(!pdf)return'';const fs=figures.filter(f=>f.pdf===pdf);return`<article class="original-page" data-original-pdf="${pdf}"><img src="${pageUrl(pdf)}" alt="教材原页 ${printedPage(pdf)}" decoding="async" draggable="false">${active?'':fs.map(f=>`<button class="figure-play" data-figure="${f.id}" style="left:${(f.marker?.[0]??f.rect[0]+f.rect[2]) *100}%;top:${(f.marker?.[1]??f.rect[1]+f.rect[3]) *100}%" aria-label="展开${f.title}">${playIcon}</button>`).join('')}</article>`}).join('')+`</div>`;
 bindOriginalPageImages();
 flat.querySelectorAll<HTMLElement>('[data-figure]').forEach(b=>b.onclick=()=>{const f=figureById(b.dataset.figure!);if(f)showFigure(f)});
}
const flatControlSelector='[data-model-selection],[data-model-replay],[data-model-inspection]';
function restoreFlatFocus(previous:SVGElement|null,index:number){
 if(!previous)return;
 const controls=[...document.querySelectorAll<SVGElement>('.flat-concept '+flatControlSelector.split(',').join(',.flat-concept '))];
 // A cutaway may insert new controls before the one being operated. Match
 // the physical object's identity before falling back to its former index.
 const identity=previous.dataset.modelInspection!==undefined?'data-model-inspection':previous.dataset.modelSelection!==undefined?'data-model-selection':null;
 const same=identity?controls.find(control=>control.getAttribute(identity)===previous.getAttribute(identity)):undefined;
 (same??controls[index])?.focus({preventScroll:true});
}
function navigate(n:number,request?:number):Promise<void>{
 if(request===undefined)figureRequest++;else if(request!==figureRequest)return Promise.resolve();
 target=Math.min(SPREADS,Math.max(0,Math.round(n)));closeContents();workbench.closeFolio();
 if(turning)return navigationPromise!;turning=true;playing=false;processSeek=null;hideProcessNote();syncWorkbench();
 navigationPromise=(async()=>{
  try{
   await closeCurrentFigure();
   do{const to=target;if(book&&!twoD)await book.goTo(to);spread=to;opened=spread>0;renderFlat();refreshCapsule();save()}while(spread!==target);
  }catch(e){message('原页暂未加载成功，请再翻一次。');console.error(e)}
  finally{turning=false;navigationPromise=null;updateHotspots();syncWorkbench()}
 })();
 return navigationPromise;
}
async function showFigure(f:Figure){
 if(figureBusy)return;
 if(active?.id===f.id){closeContents();return;}
 const request=++figureRequest,destination=spreadAt(f.pdf);
 const current=()=>request===figureRequest&&spread===destination&&!turning;
 figureBusy=true;closeContents();workbench.closeFolio();syncWorkbench();
 try{
  if(spread!==destination||turning)await navigate(destination,request);
  if(!current())return;
  await closeCurrentFigure();if(!current())return;
  // Reopening is a return to an observation: hold its saved condition until
  // the reader presses Play. Only a first visit starts playing automatically.
  const returning=Object.hasOwn(data.figures,f.id);
  active=f;playing=false;const s=item();
  if(book&&!twoD)await book.openFigure(f,s.phase,s.selection,current);
  if(!current())return;
  playing=!data.reduced&&!returning&&playbackPolicy(f,s.selection).autoplay;
  $('#scene-view').textContent='整本';$('#scene-view').setAttribute('aria-pressed','true');$('#scene-view').setAttribute('aria-label','回到立体书全景');
  closeContents();renderFlat();refreshControls();refreshCapsule();updateHotspots();
  if(twoD){positionProcessNote(true);window.scrollTo({top:0,behavior:'instant'})}
 }catch(e){active=null;playing=false;message('这幅图暂时未能展开，原页仍可阅读。');console.error(e)}finally{figureBusy=false;syncWorkbench()}
}
function closeCurrentFigure():Promise<void>{
 if(foldingPromise)return foldingPromise;
 playing=false;processSeek=null;book?.setAutoOrbit(false);syncOrbitControl();hideProcessNote();
 foldingPromise=(async()=>{
  if(book)await book.closeFigure();active=null;inspection='overview';closeInspections();$('#figure-controls').hidden=true;$('#hover-title').textContent='';renderFlat();refreshCapsule();
 })().finally(()=>{foldingPromise=null});
 return foldingPromise;
}
function fold(){figureRequest++;return closeCurrentFigure()}
function refreshSelectionPressed(){
 if(!active)return;
 const s=item(),timeline=processTimeline(active,s.phase,s.selection);
 const condition=$<HTMLSelectElement>('#condition-choice'),selected=String(active.effect==='strata'?Math.min(1,s.selection):s.selection);
 if(condition.value!==selected)condition.value=selected;
 $('#selections').querySelectorAll<HTMLElement>('[data-selection]').forEach(button=>{
  if(button.dataset.processNode!==undefined)return;
  const index=Number(button.dataset.selection);
  const pressed=String((active?.effect==='strata'?Math.min(1,s.selection):s.selection)===index);
  if(button.getAttribute('aria-pressed')!==pressed)button.setAttribute('aria-pressed',pressed);
 });
 $('#selections').querySelectorAll<HTMLButtonElement>('[data-evidence-action]').forEach(button=>{
  const action=quakeResponseActions(s.selection,s.phase).find(action=>action.id===button.dataset.evidenceAction);
  if(!action)return;
  button.setAttribute('aria-pressed',String(action.pressed));button.disabled=!action.enabled;
  if(button.textContent!==action.label)button.textContent=action.label;
 });
 $('#figure-controls').querySelectorAll<HTMLElement>('[data-process-node]').forEach(button=>{
  const pressed=String(Number(button.dataset.processNode)===timeline?.activeStop);
  if(button.getAttribute('aria-pressed')!==pressed){
   button.setAttribute('aria-pressed',pressed);
   const rail=button.parentElement;
   if(pressed==='true'&&rail&&['process-stops','selections'].includes(rail.id)&&rail.scrollWidth>rail.clientWidth){
    const start=button.offsetLeft,end=start+button.offsetWidth;
    if(start<rail.scrollLeft||end>rail.scrollLeft+rail.clientWidth)
     rail.scrollTo({left:start-(rail.clientWidth-button.offsetWidth)/2,behavior:data.reduced?'instant':'smooth'});
   }
  }
 });
}
function refreshControls(){
 $('#figure-controls').hidden=!active;
 $('#scene-view').hidden=twoD;
 if(twoD||data.reduced||!active)book?.setAutoOrbit(false);
 syncOrbitControl();
 if(!active){closeInspections();return;}
 const targets=inspectionTargets(active.effect,item().selection);
 $('#model-inspect').hidden=!targets.length;
 if(!targets.length)closeInspections();
 const buttons=targets.map(({target,label})=>`<button data-inspection="${target}" aria-pressed="${inspection===target}">${label}</button>`).join('');
 if($('#model-inspections').innerHTML!==buttons)$('#model-inspections').innerHTML=buttons;
 const timeline=processTimeline(active,item().phase,item().selection);
 const policy=playbackPolicy(active,item().selection);
 if(!policy.enabled)playing=false;
 $('#figure-controls').classList.toggle('structure-view',!policy.enabled);
 $('#phase').closest<HTMLElement>('.process-range')!.hidden=!policy.enabled;
 $('#restart').hidden=!policy.enabled;$('#cSpeed').hidden=!policy.enabled;
 const key=`${active.id}-${timeline?.replacesChoices??false}-${timeline?.stops.map(stop=>`${stop.label}:${stop.phase}:${stop.selection??''}`).join('|')??''}`;
 if(choiceKey!==key){
  choiceKey=key;
  const nodes=timeline?.stops.map((stop,i)=>`<button data-process-node="${i}"${stop.selection===undefined?'':` data-selection="${stop.selection}"`} aria-pressed="false" title="定位到${stop.label}">${stop.label}</button>`).join('')??'';
  $('#selections').innerHTML=active.effect==='quake-response-system'
   ?quakeResponseActions(item().selection,item().phase).map(action=>`<button data-evidence-action="${action.id}" aria-pressed="false">${action.label}</button>`).join('')
   :timeline?.replacesChoices?nodes:(active.controls??[]).map((label,i)=>`<button data-selection="${i}" aria-pressed="false">${label}</button>`).join('');
  const compactChoices=!timeline?.replacesChoices&&(active.controls?.length??0)>1;
  $('#figure-controls').classList.toggle('compact-choices',compactChoices);
  $('#compact-selection').hidden=!compactChoices;
  $<HTMLSelectElement>('#condition-choice').innerHTML=compactChoices?(active.effect==='soil'?'<option value="-1">完整土柱</option>':'')+(active.controls??[]).map((label,i)=>`<option value="${i}">${label}</option>`).join(''):'';
  $('#process-stops').innerHTML=timeline&&!timeline.replacesChoices?nodes:'';
  $('#process-stops').hidden=!timeline||timeline.replacesChoices;
  $('#figure-controls').classList.toggle('has-process-stops',!!timeline&&!timeline.replacesChoices);
  $('#process-ticks').innerHTML=timeline?.stops.map(stop=>`<i style="left:${stop.phase*100}%"></i>`).join('')??'';
 }
 refreshSelectionPressed();
 updateProcessInfo();refreshCapsule();
}
function chooseSelection(next:number){
 if(!active)return;
 const state=item(),selected=Math.max(active.effect==='soil'?-1:0,Math.min(selectionLimit(active),Math.round(next))),previous=state.selection;
 state.selection=selected;
 if(previous!==selected){inspection='overview';book?.inspect(inspection);closeInspections();}
 const stop=active.controlPhases?.[selected];
 if(stop!==undefined){state.phase=stop;playing=false}
 else if(restartForSelection(active,previous,selected)){state.phase=0;playing=!data.reduced&&playbackPolicy(active,selected).autoplay}
 if(active.effect==='breeze'){state.phase=selected===0?AFTERNOON:NIGHT;playing=false}
 if(!playbackPolicy(active,selected).enabled)playing=false;
}
function updateModel(){if(active){const s=item(),timeline=processTimeline(active,s.phase,s.selection);
 if(active.effect==='breeze')s.selection=evaluateSeaBreeze({phase:s.phase,contrast:1}).direction<0?1:0;
 else if(timeline?.replacesChoices)s.selection=timeline.stops[timeline.activeStop].selection??s.selection;
 book?.setFigure(s.phase,s.selection);refreshSelectionPressed();updateProcessInfo();
 if(twoD){const holder=document.querySelector('.flat-concept');if(holder){
  const controls=flatControlSelector;
  const focused=holder.contains(document.activeElement)?(document.activeElement as Element).closest<SVGElement>(controls):null;
  const focusIndex=focused?[...holder.querySelectorAll<SVGElement>(controls)].indexOf(focused):-1;
  holder.innerHTML=flatModelSvg(active,s.phase,s.selection,inspection);
  if(focusIndex>=0)restoreFlatFocus(focused,focusIndex);
 }}}}
function hideProcessNote(){ document.body.classList.remove('has-process-note');$('#process-note').hidden=true;processInfo=null;processKey='';processLayoutKey='';processNoteMeasureKey='';$('#process-note').style.removeProperty('min-height');if(book)book.processNoteInset=0;
 const demo=document.querySelector<HTMLElement>('.flat-demonstration');if(demo)for(const property of ['margin-top','scroll-margin-top','--process-svg-max-height'])demo.style.removeProperty(property);
}
function updateProcessInfo(){
 if(!active){hideProcessNote();return}
 const s=item();processInfo=processTimeline(active,s.phase,s.selection);
 const range=$<HTMLInputElement>('#phase');range.value=String(Math.round(s.phase*1000));
 range.style.setProperty('--process-progress',`${s.phase*100}%`);
 const progressLabel=processInfo?.progressLabel??playbackPolicy(active,s.selection).label;
 if($('label[for="phase"]').textContent!==progressLabel)$('label[for="phase"]').textContent=progressLabel;
 range.setAttribute('aria-label',`拖动${progressLabel}，暂停并回看`);
 if(!processInfo){hideProcessNote();range.removeAttribute('aria-valuetext');return}
 document.body.classList.add('has-process-note');
 range.setAttribute('aria-valuetext',`${processInfo.stage}，${processInfo.title}，${processInfo.progressLabel??'演示进度'}${Math.round(s.phase*100)}%`);
 if(processKey!==processInfo.key){
  const narrativeChanged=$('#process-stage').textContent!==processInfo.stage||$('#process-text').textContent!==processInfo.text;
  processKey=processInfo.key;$('#process-stage').textContent=processInfo.stage;
  $('#process-count').textContent=`${String(processInfo.activeStop+1).padStart(2,'0')} / ${String(processInfo.stops.length).padStart(2,'0')}`;
  $('#process-title').textContent=processInfo.title;$('#process-text').textContent=processInfo.text;
  // Continuous readouts stay crisp while dragging or playing. Only a new
  // explanation fades in; changing a depth number must not restart the fade.
  if(narrativeChanged&&!data.reduced){const copy=$('#process-note-copy');copy.getAnimations().forEach(animation=>animation.cancel());copy.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'cubic-bezier(.16,1,.3,1)'})}
 }
}
function reserveProcessNoteSpace(){
 if(!active||!processInfo)return;
 const note=$('#process-note'),copy=$('#process-note-copy'),s=item();
 const key=`${processLayoutKey}-${note.dataset.position}-${note.clientWidth}-${processInfo.replacesChoices?'process':s.selection}`;
 if(key===processNoteMeasureKey)return;
 processNoteMeasureKey=key;note.style.removeProperty('min-height');
 // Measure the captions for this process once, in an inert off-screen copy.
 // The reserved space stays constant as the playhead moves. A shorter caption
 // must never reframe the model beneath a student's pointer during a drag.
 const measure=copy.cloneNode(true) as HTMLElement;
 const sources=[copy,...copy.querySelectorAll<HTMLElement>('*')];
 const targets=[measure,...measure.querySelectorAll<HTMLElement>('*')];
 const properties=['font-family','font-size','font-weight','font-style','line-height','letter-spacing','text-wrap','margin','padding','display','box-sizing'];
 sources.forEach((source,i)=>{const style=getComputedStyle(source),target=targets[i];
  target.removeAttribute('id');target.removeAttribute('role');target.removeAttribute('aria-live');
  for(const property of properties)target.style.setProperty(property,style.getPropertyValue(property));
 });
 const width=copy.getBoundingClientRect().width,extra=note.offsetHeight-copy.offsetHeight;
 Object.assign(measure.style,{position:'fixed',left:'-10000px',top:'0',width:`${width}px`,visibility:'hidden',pointerEvents:'none'});
 measure.setAttribute('aria-hidden','true');measure.inert=true;document.body.append(measure);
 try{
  const title=measure.querySelector('h2')!,text=measure.querySelector('p')!;
  const phases=[s.phase,...processInfo.stops.map(stop=>stop.phase),...Array.from({length:65},(_,i)=>i/64)];
  const captions=new Map<string,{title:string;text:string}>();
  for(const phase of phases){const info=processTimeline(active,phase,s.selection);if(info)captions.set(info.key,info)}
  let height=copy.offsetHeight;
  for(const caption of captions.values()){title.textContent=caption.title;text.textContent=caption.text;height=Math.max(height,measure.offsetHeight)}
  note.style.minHeight=`${Math.ceil(extra+height)}px`;
 }finally{measure.remove()}
}
function positionProcessNote(allowOpening=false){
 const note=$('#process-note');
 if(!active||!processInfo||turning||(figureBusy&&!allowOpening)||!$('#contents').hidden||!$('#folio').hidden){note.hidden=true;return}
 const topNote=()=>{note.hidden=false;note.dataset.position='top';note.style.removeProperty('left');note.style.removeProperty('top');reserveProcessNoteSpace();
  const clearance=note.offsetTop+note.offsetHeight+20;
  if(book)book.processNoteInset=twoD?0:Math.max(0,clearance-innerHeight*.06);
  if(twoD){const demo=document.querySelector<HTMLElement>('.flat-demonstration');if(demo){
   // The reading-mode note scrolls with the document. Its reserved space
   // belongs to normal page flow; changing a caption never scrolls the book.
   demo.style.marginTop=`${note.offsetHeight+24}px`;
   demo.style.scrollMarginTop=`${clearance}px`;
   demo.style.setProperty('--process-svg-max-height',`${Math.max(180,Math.min(500,dock.getBoundingClientRect().top-clearance-44))}px`);
  }}
 };
 const layoutKey=`${active.id}-${innerWidth}-${innerHeight}-${$('#scene-view').getAttribute('aria-pressed')}`;
 if(layoutKey!==processLayoutKey){processLayoutKey=layoutKey;processBoundsReadyAt=0;note.removeAttribute('data-position')}
 if(twoD||innerWidth<680||note.dataset.position==='top'){topNote();return}
 const box=book?.processBounds;
 if(!box){note.hidden=true;return}
 if(!processBoundsReadyAt)processBoundsReadyAt=performance.now();
 if(performance.now()-processBoundsReadyAt<550){note.hidden=true;if(book)book.processNoteInset=0;return}
 const width=innerWidth<900?152:innerWidth<1100?184:220,gap=innerWidth<1100?16:24,left=box.left-width-gap,right=box.right+gap;
 const canLeft=left>=(innerWidth<900?12:72),canRight=right+width<=innerWidth-(innerWidth<900?12:110);
 if(!canLeft&&!canRight){topNote();return}
 note.dataset.position='side';note.hidden=false;reserveProcessNoteSpace();
 if(book)book.processNoteInset=0;
 const x=canLeft?Math.min(left,innerWidth*.21):right,y=Math.max(innerWidth<900?198:112,Math.min(box.top+box.height*.32,dock.getBoundingClientRect().top-note.offsetHeight-18));
 note.style.left=`${Math.round(x)}px`;note.style.top=`${Math.round(y)}px`;
}
function seekProcess(stop:number){
 if(!active)return;
 const s=item(),timeline=processTimeline(active,s.phase,s.selection),node=timeline?.stops[stop];if(!node||!timeline)return;
 playing=false;processSeek=data.reduced?null:{from:s.phase,to:node.phase,elapsed:0,cyclic:timeline.cyclic};
 if(data.reduced){s.phase=node.phase;updateModel();save()}
 refreshCapsule();
}
function finishProcessSeek(){if(processSeek&&active){item().phase=processSeek.to;processSeek=null;updateModel()}}
function interactWithModel(change:import('./textbook-model-input').ModelInputChange){
 if(!active||turning||figureBusy)return;
 const state=item();playing=false;processSeek=null;
 if(change.inspection!==undefined){
  inspection=change.inspection;book?.inspect(inspection);
 }
 if(change.phase!==undefined){
  state.phase=Math.max(0,Math.min(1,change.phase));
  if(active.effect==='breeze')state.selection=evaluateSeaBreeze({phase:state.phase,contrast:1}).direction<0?1:0;
 }
 if(change.selection!==undefined){
  const timeline=processTimeline(active,state.phase,state.selection);
  const node=timeline?.replacesChoices?timeline.stops.findIndex(stop=>stop.selection===change.selection):-1;
  // Picking a physical object seeks this same playhead just like its DOM
  // shortcut. Independent conditions and layer selections keep their meaning.
  if(node!==undefined&&node>=0&&change.phase===undefined&&!change.replay){seekProcess(node);return}
  chooseSelection(change.selection);
 }
 if(change.replay)restartPlayback();
 updateModel();refreshControls();refreshCapsule();
 if(change.commit)save();
}
function closeInspections(){
 $('#model-inspections').hidden=true;$('#model-inspect').setAttribute('aria-expanded','false');
}
function togglePlay(){if(!active||figureBusy||!playbackPolicy(active,item().selection).enabled)return;processSeek=null;if(!playing&&playbackPolicy(active,item().selection).once&&item().phase>=1){item().phase=0;updateModel()}playing=!playing;refreshCapsule()}
function restartPlayback(){
 if(!active||!playbackPolicy(active,item().selection).enabled)return;
 processSeek=null;
 item().phase=active.effect==='breeze'?AFTERNOON:0;
 if(active.effect==='breeze'||active.effect==='tide')item().selection=0;
 playing=!data.reduced;
}
function updateHotspots(){
 const host=$('#hotspots');if(!book||twoD||active||turning){host.replaceChildren();return}
 const regions=book.regions;
 if(host.children.length!==regions.length||regions.some((r,i)=>(host.children[i] as HTMLElement)?.dataset.figure!==r.id)){
  host.innerHTML=regions.map(r=>`<button class="figure-play" data-figure="${r.id}" aria-label="展开${figureById(r.id)!.title}">${playIcon}</button>`).join('');
  host.querySelectorAll<HTMLElement>('button').forEach(b=>b.onclick=()=>showFigure(figureById(b.dataset.figure!)!));
 }
 for(const r of regions){const el=host.querySelector<HTMLElement>(`[data-figure="${r.id}"]`);if(el){el.style.left=`${r.screenX}px`;el.style.top=`${r.screenY}px`}}
}
async function setMode(value:boolean){
 const mode=++modeRequest;
 const f=active;playing=false;const folding=fold(),request=figureRequest;await folding;
 if(mode!==modeRequest)return;
 if(!value&&book&&!book.contextAvailable){book.dispose();book=null;$('#scene').replaceChildren()}
 twoD=value;if(value)readingReason='manual';document.body.classList.toggle('two-d',twoD);$('#scene').hidden=twoD;syncRenderingMode();
 if(!twoD){
  if(!book)await initBook();if(mode!==modeRequest)return;
  if(navigationPromise)await navigationPromise;if(mode!==modeRequest)return;
  if(book&&!twoD)try{await book.goTo(spread)}catch(error){fallBackToReading(error)}
  if(!twoD){readingReason=null;renderFailure=null}
 }
 if(mode!==modeRequest)return;
 renderFlat();
 // A later page or model request owns the destination. A mode switch may
 // reopen its captured observation only while that request is still current.
 if(f&&request===figureRequest){await showFigure(f);if(mode===modeRequest&&active?.id===f.id)playing=false}
 if(mode!==modeRequest)return;
 closeContents();refreshControls();refreshCapsule();
}
async function toggleTeacher(){
 if(switchingTeacher||figureBusy||turning)return;
 processSeek=null;
 switchingTeacher=true;
 try{
  if(!teacher){save();studentView={spread,figure:active?.id??null};data=structuredClone(student);teacher=true}
  else{
   const restore=studentView;await fold();data=student;teacher=false;if(book)book.reduced=data.reduced;
   await navigate(restore?.spread??student.spread);
   const figure=restore?.figure?figureById(restore.figure):null;if(figure)await showFigure(figure);
   studentView=null;
  }
  playing=false;if(book){book.setAutoOrbit(false);book.reduced=data.reduced;book.setQuality(data.quality)}refreshControls();refreshCapsule();updateModel();message(teacher?'教师演示':'已返回个人书签');
 }finally{switchingTeacher=false}
}
let readingPdf=2,readScale=1,readFit:'width'|'page'|'custom'='width';
$('#reader-close').insertAdjacentHTML('beforebegin','<button id="reader-fit" title="适宽 / 整页" aria-label="适宽或整页阅读">适宽</button><button id="reader-locate" title="定位当前立体图对应的原图" aria-label="定位当前立体图对应的教材位置">⌖</button>');
const readerPaper=document.createElement('div');readerPaper.id='reader-paper';
$('#reader-image').before(readerPaper);readerPaper.append($('#reader-image'));
readerPaper.insertAdjacentHTML('beforeend','<div id="reader-anchor" hidden aria-hidden="true"></div>');
function scaleReader(value:number,fit:typeof readFit='custom',anchor?:{x:number;y:number}){
 const scroll=$('#reader-scroll'),img=$<HTMLImageElement>('#reader-image'),before=img.getBoundingClientRect(),view=scroll.getBoundingClientRect();
 const x=anchor?.x??view.left+scroll.clientWidth/2,y=anchor?.y??view.top+scroll.clientHeight/2;
 const u=(x-before.left)/before.width,v=(y-before.top)/before.height;
 readScale=Math.max(.25,Math.min(3,value));readFit=fit;img.style.width=`${960*readScale}px`;
 $('#reader-scale').textContent=`${Math.round(readScale*100)}%`;$('#reader-fit').textContent=fit==='page'?'整页':'适宽';
 $('#reader-fit').setAttribute('aria-label',fit==='width'?'当前适宽，点击显示整页':'适合窗口宽度');
 const after=img.getBoundingClientRect();scroll.scrollLeft+=after.left+u*after.width-x;scroll.scrollTop+=after.top+v*after.height-y;
}
function fitReader(mode:'width'|'page'='width'){
 const scroll=$('#reader-scroll'),img=$<HTMLImageElement>('#reader-image'),style=getComputedStyle(scroll);
 const w=scroll.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
 const h=scroll.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);
 const ratio=img.naturalHeight&&img.naturalWidth?img.naturalHeight/img.naturalWidth:858.89801/612.28302;
 scaleReader(Math.min(w/960,mode==='page'?h/(960*ratio):3),mode);scroll.scrollTo(0,0);
}
async function readPage(pdf:number){
 playing=false;processSeek=null;refreshCapsule();readingPdf=Math.min(133,Math.max(2,pdf));
 const dialog=$<HTMLDialogElement>('#page-reader'),img=$<HTMLImageElement>('#reader-image');
 img.src=pageUrl(readingPdf);img.alt=`教材原页 ${printedPage(readingPdf)}`;
 $('#reader-title').textContent=numberedPage(readingPdf)!==null?`第 ${printedPage(readingPdf)} 页`:printedPage(readingPdf);
 $<HTMLButtonElement>('#reader-prev').disabled=readingPdf===2;$<HTMLButtonElement>('#reader-next').disabled=readingPdf===133;
 $('#reader-anchor').hidden=true;$('#reader-locate').hidden=!active;
 if(!dialog.open)dialog.showModal();await img.decode().catch(()=>message('原页加载失败，请重试。'));
 if(readingPdf!==pdf)return;
 if(readFit!=='custom')fitReader(readFit);else scaleReader(readScale);$('#reader-scroll').scrollTo(0,0);
}
async function initBook(){
  try{book=new TextbookBook($('#scene'));book.reduced=data.reduced;book.setQuality(data.quality);book.onFigure=showFigure;book.onNavigate=navigate;book.onOpen=()=>navigate(data.spread||1);book.onRead=readPage;book.onHover=f=>{$('#hover-title').textContent=active?'':f?.title??''};book.onModelInput=interactWithModel;book.onLost=()=>{modeRequest++;playing=false;processSeek=null;twoD=true;readingReason='context';document.body.classList.add('two-d');$('#scene').hidden=true;renderFlat();refreshControls();refreshCapsule();updateHotspots();save()};
  invalidateGlass();await book.prepare(data.spread||1);readingReason=null;renderFailure=null;syncRenderingMode();
 }catch(e){fallBackToReading(e)}
}

$('#open-book').onclick=()=>navigate(data.spread||1);$('#close-contents').onclick=()=>toggleContents(true);
$('#contents').querySelectorAll<HTMLElement>('[data-pdf]').forEach(b=>b.onclick=()=>navigate(spreadAt(Number(b.dataset.pdf))));
$('#contents').querySelectorAll<HTMLElement>('[data-spread]').forEach(b=>b.onclick=()=>navigate(Number(b.dataset.spread)));
$('#contents').querySelectorAll<HTMLElement>('[data-figure]').forEach(b=>b.onclick=()=>showFigure(figureById(b.dataset.figure!)!));
$('#page-jump').onsubmit=e=>{e.preventDefault();const page=Number($<HTMLInputElement>('#page-number').value);if(Number.isInteger(page)&&page>=1&&page<=LAST_PRINTED_PAGE)navigate(spreadAt(page+5))};
$('#read-left').onclick=()=>{const pdf=pdfAt(spread,'left');if(pdf)readPage(pdf);toggleContents(true)};$('#read-right').onclick=()=>{const pdf=pdfAt(spread,'right');if(pdf)readPage(pdf);toggleContents(true)};$('#read-whole').onclick=()=>{setSceneView(false);toggleContents(true)};
$('#cRead').onclick=()=>readPage(active?.pdf??pdfAt(spread,'left')??pdfAt(spread,'right')??2);
$('#reader-prev').onclick=()=>readPage(readingPdf-1);$('#reader-next').onclick=()=>readPage(readingPdf+1);
for(const[id,by]of [['reader-smaller',-.15],['reader-larger',.15]]as const)$('#'+id).onclick=()=>scaleReader(readScale+by);
$('#reader-fit').onclick=()=>fitReader(readFit==='width'?'page':'width');
$('#reader-locate').onclick=async()=>{if(!active)return;await readPage(active.pdf);scaleReader(Math.max(1,readScale));
 const img=$('#reader-image'),scroll=$('#reader-scroll'),anchor=$('#reader-anchor'),r=active.rect;
 anchor.hidden=false;anchor.style.cssText=`left:${r[0]*100}%;top:${r[1]*100}%;width:${r[2]*100}%;height:${r[3]*100}%`;
 const imageRect=img.getBoundingClientRect(),view=scroll.getBoundingClientRect();
 scroll.scrollTo({left:scroll.scrollLeft+imageRect.left+(r[0]+r[2]/2)*imageRect.width-view.left-scroll.clientWidth/2,top:scroll.scrollTop+imageRect.top+(r[1]+r[3]/2)*imageRect.height-view.top-scroll.clientHeight/2,behavior:data.reduced?'instant':'smooth'});
};
$('#reader-scroll').addEventListener('dblclick',e=>{e.preventDefault();if(readScale>1.4)fitReader();else scaleReader(Math.max(1.6,readScale*1.7),'custom',{x:e.clientX,y:e.clientY})});
$('#reader-scroll').addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();scaleReader(readScale*Math.exp(-e.deltaY*.002),'custom',{x:e.clientX,y:e.clientY})},{passive:false});
$('#page-reader').addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;
 if(e.key==='+'||e.key==='='){e.preventDefault();scaleReader(readScale+.15)}
 else if(e.key==='-'){e.preventDefault();scaleReader(readScale-.15)}
 else if(e.key==='0'){e.preventDefault();fitReader()}
 else if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&!(e.target as Element).closest('button')){e.preventDefault();readPage(readingPdf+(e.key==='ArrowRight'?1:-1))}
});
window.addEventListener('resize',()=>{if($<HTMLDialogElement>('#page-reader').open&&readFit!=='custom')fitReader(readFit)});
function closeReader(){ $<HTMLDialogElement>('#page-reader').close();if(spreadAt(readingPdf)!==spread)navigate(spreadAt(readingPdf));}
$('#reader-close').onclick=closeReader;
$('#page-reader').addEventListener('cancel',e=>{e.preventDefault();closeReader()});
$('#flat-reader').addEventListener('dblclick',e=>{const el=(e.target as HTMLElement).closest<HTMLElement>('[data-original-pdf]');if(el)readPage(Number(el.dataset.originalPdf))});
const flatModelAction=(event:Event)=>{
 const controls=flatControlSelector;
 const target=(event.target as Element).closest<SVGElement>(controls);
 if(!target||!twoD||!active)return;
 event.preventDefault();event.stopPropagation();
 const focusIndex=[...document.querySelectorAll<SVGElement>('.flat-concept '+controls.split(',').join(',.flat-concept '))].indexOf(target);
 const nextInspection=target.dataset.modelInspection;
 if(nextInspection!==undefined){
  if(!inspectionTargets(active.effect,item().selection).some(option=>option.target===nextInspection))return;
  interactWithModel({inspection:inspection===nextInspection?(target.dataset.modelInspectionToggle??'overview'):nextInspection,commit:true});
  if(event instanceof KeyboardEvent)restoreFlatFocus(target,focusIndex);
  return;
 }
 const selection=target.dataset.modelSelection===undefined?undefined:Number(target.dataset.modelSelection),toggle=Number(target.dataset.modelToggle??selection);
 const replay=target.hasAttribute('data-model-replay');
 const focus=event instanceof KeyboardEvent;
 interactWithModel({selection:selection===undefined?undefined:!replay&&item().selection===selection?toggle:selection,replay,commit:true});
 // The SVG is regenerated from model state. Keep a keyboard reader on the
 // same physical control instead of losing focus to the page after one tap.
 if(focus)restoreFlatFocus(target,focusIndex);
};
$('#flat-reader').addEventListener('click',flatModelAction);
$('#flat-reader').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')flatModelAction(event)});
$('#mode').onclick=()=>setMode(!twoD);
$('#retry-3d').onclick=async()=>{if(retrying3D||turning||figureBusy)return;retrying3D=true;syncRenderingMode();try{await setMode(false)}finally{retrying3D=false;syncRenderingMode()}};
$('#model-inspect').onclick=()=>{const panel=$('#model-inspections');panel.hidden=!panel.hidden;$('#model-inspect').setAttribute('aria-expanded',String(!panel.hidden))};
$('#model-inspections').onclick=event=>{
 const button=(event.target as Element).closest<HTMLElement>('[data-inspection]');
 if(!button||!active)return;
 const selected=button.dataset.inspection!;
 if(!inspectionTargets(active.effect,item().selection).some(option=>option.target===selected))return;
 interactWithModel({inspection:selected,commit:true});
 $('#model-inspections').querySelector<HTMLElement>(`[data-inspection="${selected}"]`)?.focus({preventScroll:true});
};
$('#condition-choice').onchange=()=>{
 if(!active||turning||figureBusy)return;
 processSeek=null;chooseSelection(Number($<HTMLSelectElement>('#condition-choice').value));updateModel();refreshControls();save();
};
$('#figure-controls').addEventListener('click',event=>{
 const button=(event.target as HTMLElement).closest<HTMLElement>('[data-process-node],[data-selection],[data-evidence-action]');if(!button||!active||turning||figureBusy)return;
 if(button.dataset.evidenceAction!==undefined){
  const action=quakeResponseActions(item().selection,item().phase).find(action=>action.id===button.dataset.evidenceAction);
  if(!action?.enabled)return;
  playing=false;processSeek=null;chooseSelection(action.selection);updateModel();refreshControls();save();return;
 }
 if(button.dataset.processNode!==undefined)seekProcess(Number(button.dataset.processNode));
 else{processSeek=null;chooseSelection(Number(button.dataset.selection));updateModel();refreshControls();save()}
});
$('#phase').oninput=()=>{playing=false;processSeek=null;item().phase=Number($<HTMLInputElement>('#phase').value)/1000;updateModel();refreshCapsule()};$('#phase').onchange=save;
$('#cSpeed').onclick=()=>{data.playbackSpeed=PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(data.playbackSpeed)+1)%PLAYBACK_SPEEDS.length];refreshCapsule();save()};
$('#restart').onclick=()=>{restartPlayback();updateModel();refreshControls();refreshCapsule();save()};$('#fold').onclick=fold;
function setSceneView(detail:boolean){book?.setSceneView(detail?'detail':'book');$('#scene-view').setAttribute('aria-pressed',String(detail));$('#scene-view').setAttribute('aria-label',detail?'回到立体书全景':'近看立体场景');$('#scene-view').textContent=detail?'整本':'近看'}
$('#scene-view').onclick=()=>setSceneView($('#scene-view').getAttribute('aria-pressed')!=='true');
function syncOrbitControl(){
 const control=$<HTMLButtonElement>('#scene-orbit'),pressed=String(!!book?.autoOrbit);
 control.hidden=twoD||data.reduced||!active;
 const disabled=turning||figureBusy||!book?.playbackReady;
 if(control.disabled!==disabled)control.disabled=disabled;
 if(control.getAttribute('aria-pressed')!==pressed)control.setAttribute('aria-pressed',pressed);
}
$('#scene-orbit').onclick=()=>{if(!book||twoD||data.reduced||!active)return;book.setAutoOrbit(!book.autoOrbit);syncOrbitControl()};
$('#figure-note').onclick=()=>{if(!active)return;$('#figure-dialog-title').textContent=active.title;$('#figure-dialog-text').textContent=active.note;$<HTMLDialogElement>('#figure-dialog').showModal()};
for(const [button,dialog]of [['settings-button','settings-dialog'],['sources-button','sources-dialog']])$('#'+button).onclick=()=>{closeContents();workbench.closeFolio();$<HTMLDialogElement>('#'+dialog).showModal()};
document.querySelectorAll<HTMLElement>('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog')?.close());
$('#notes-button').onclick=()=>{const label=spreadPageLabel(spread);$('#notes-title').textContent=`${label} · ${teacher?'临时笔记':'笔记'}`;$<HTMLTextAreaElement>('#notes-text').value=data.notes[String(spread)]??'';closeContents();workbench.closeFolio();$<HTMLDialogElement>('#notes-dialog').showModal()};
$('#notes-text').oninput=()=>{data.notes[String(spread)]=$<HTMLTextAreaElement>('#notes-text').value;save()};
$('#print-pages').onclick=()=>{
 const area=$('#print-area');area.replaceChildren();for(const side of ['left','right']as const){const pdf=pdfAt(spread,side);if(pdf){const image=document.createElement('img');image.src=pageUrl(pdf);image.alt=`教材原页 ${printedPage(pdf)}`;area.append(image)}}
 const note=document.createElement('p');note.textContent=data.notes[String(spread)]??'';area.append(note);Promise.all([...area.querySelectorAll('img')].map(i=>i.decode())).then(()=>window.print());
};
$<HTMLSelectElement>('#quality').value=data.quality;$('#quality').onchange=()=>{data.quality=$<HTMLSelectElement>('#quality').value;book?.setQuality(data.quality);invalidateGlass();save()};
$<HTMLInputElement>('#reduced').checked=data.reduced;$('#reduced').onchange=()=>{data.reduced=$<HTMLInputElement>('#reduced').checked;finishProcessSeek();if(book)book.reduced=data.reduced;playing=false;refreshControls();refreshCapsule();save()};
$('#clear-bookmark').onclick=()=>{if(teacher||!confirm('清除这本书的书签、插图进度和笔记？'))return;student=fresh();data=student;try{localStorage.removeItem(KEY)}catch{}navigate(0);message('本书记录已清除。')};
document.addEventListener('keydown',e=>{
 if(e.defaultPrevented||document.querySelector('dialog[open]'))return;
 if(e.key==='Escape'&&!$('#contents').hidden){e.preventDefault();toggleContents(true);return}
 if(e.key==='Escape'&&!$('#model-inspections').hidden){e.preventDefault();closeInspections();$('#model-inspect').focus({preventScroll:true});return}
 if(e.key==='Escape'){e.preventDefault();if(active)fold();else book?.setZoom(null);return}
 if((e.target as Element).closest('input,textarea,select,button,a,[role="button"],[role="tab"],[contenteditable="true"]'))return;
 if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();navigate((turning?target:spread)+1)}else if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();navigate((turning?target:spread)-1)}else if(e.key==='Escape'){if(!$('#contents').hidden)toggleContents(true);else if(active)fold();else book?.setZoom(null)}else if(e.key===' '&&active){e.preventDefault();togglePlay()}
});
document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden){playing=false;processSeek=null;save();refreshCapsule()}previous=performance.now()});
document.addEventListener('pointerdown',e=>{if(!$('#contents').hidden&&!(e.target as HTMLElement).closest('#contents,#cContents'))closeContents()});
document.addEventListener('pointerdown',e=>{if(!$('#model-inspections').hidden&&!(e.target as Element).closest('#model-inspections,#model-inspect'))closeInspections()});
window.addEventListener('beforeunload',save);
document.body.classList.toggle('two-d',twoD);$('#scene').hidden=twoD;$('#mode').textContent=twoD?'立体书':'二维阅读';
$('#storage-state').textContent=storage?'书签和笔记保存在当前浏览器。':'临时会话：关闭后不会保留本次记录。';
refreshCapsule();renderFlat();

function animate(now:number){
 const dt=Math.min(.05,Math.max(0,(now-previous)/1000));previous=now;
 if(!hidden){
  if(active&&processSeek&&!figureBusy&&!turning){
   processSeek.elapsed+=dt;const q=processSeek.elapsed/.72;
   item().phase=seekProcessPhase(processSeek.from,processSeek.to,q,processSeek.cyclic);updateModel();
   if(q>=1){processSeek=null;save()}
  }
  if(active&&playing&&!figureBusy&&!turning&&(twoD||book?.playbackReady)){const s=item(),policy=playbackPolicy(active,s.selection);s.phase=advancePresentationPhase(active.effect,s.selection,s.phase,dt*data.playbackSpeed/(active.effect==='breeze'?120:18),policy.once);if(policy.once&&s.phase===1){playing=false;refreshCapsule();save()}updateModel();if(now-lastSave>5000){lastSave=now;save()}}
  if(book){const draw=!twoD&&!$<HTMLDialogElement>('#page-reader').open;book.running=playing;book.update(dt,draw);syncOrbitControl();if(draw){updateHotspots();if(capsule.dirty){book.setGlass(capsule.rects());capsule.dirty=false}}}
  positionProcessNote();
 }
 requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
const boot=async()=>{
 if(!twoD)await initBook();ready=true;document.body.classList.add('ready');
 const figure=figureById(entryQuery.get('figure')??''),requested=entryQuery.get('page');
 if(figure){await navigate(spreadAt(figure.pdf));await showFigure(figure);playing=entryQuery.has('play')&&!data.reduced&&playbackPolicy(figure,item().selection).autoplay;refreshCapsule()}
 else if(requested&&Number(requested)>=1&&Number(requested)<=LAST_PRINTED_PAGE)await navigate(spreadAt(Number(requested)+5));
};boot();
Object.defineProperty(window,'textbookDiagnostics',{get:()=>({ready,twoD,readingReason,renderFailure,autoOrbit:book?.autoOrbit??false,spread,turning,figureBusy,active:active?.id??null,playing,playbackSpeed:data.playbackSpeed,teacher,stored:storage,state:active?evaluateFigure(active,item().phase,item().selection):null,process:processInfo?{key:processInfo.key,stage:processInfo.stage,title:processInfo.title,text:processInfo.text,activeStop:processInfo.activeStop,seeking:!!processSeek}:null,render:book?.stats??null,regions:book?.regions??[],pages:['left','right'].map(s=>pdfAt(spread,s as any)),notes:data.notes,originalPageCount:132,sectionCount:contents.flatMap(c=>c.sections).filter(s=>!s.type).length,studyCount:contents.flatMap(c=>c.sections).filter(s=>s.type==='study').length,figureCount:figures.length})});
// Explicit local inspection uses the very same production geometry and motion.
// No inspection object is attached during an ordinary student session.
if(import.meta.env.DEV||entryQuery.has('inspect'))Object.defineProperty(window,'textbookDebug',{get:()=>book,configurable:true});
