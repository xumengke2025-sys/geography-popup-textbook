import "./style.css";
import { BookScene } from "./scene";
import { evaluateSeaBreeze } from "./model";
import { lesson, transfer } from "./content";
import {
  initial,
  readProgress,
  persist,
  complete,
  observation,
  type Progress,
} from "./state";
import { diagram } from "./diagram";
import type { PaperHit } from "./paper";
import { createCapsule, capsuleCSS } from './reference/engine.js';
import { SPREAD, spreadTitles, chapterForSpread, chapterCopy, chapterComplete, waterModes, waterPaths, evaluateWater, evaluateRiver, type WaterMode, type WaterProcess } from './chapters';
import { waterDiagram, riverDiagram } from './chapter-diagrams';

const loaded = readProgress();
let student = loaded.progress,
  p = student,
  storage = loaded.available;
let teacher = false,
  projecting = false,
  playing = false,
  watchPlaying = false,
  watchIndex = p.observationStep,
  watchElapsed = 0,
  opened = false,
  explain = false,
  turning = false,
  target = 0,
  readingOpen = false;
let twoD = innerWidth < 700 || new URLSearchParams(location.search).has("2d"),
  view = "阅读",
  layers = { thermal: true, pressure: true, flow: true, diagram: false };
let scene: BookScene | null = null;
let projectionView='阅读',projectionReading=false;
let studentDisplay: {view:string;layers:typeof layers;watchIndex:number;explain:boolean} | null = null;
let lastTime = 0,
  raf = 0,
  saveTimer = 0,
  slowFrames = 0,
  frames = 0,
  totalMs = 0,
  downgraded = false;
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<header class="topbar"><a class="wordmark" href="#" id="home">人教版地理必修一</a><nav aria-label="书本菜单"><button data-goto="0">封面</button><button data-goto="1">海陆风</button><button data-goto="2">挑战</button><button data-goto="3">水循环</button><button data-goto="4">河曲与牛轭湖</button><button data-goto="5">来源</button><button id="reading-toggle" aria-expanded="false" aria-controls="page-content">文字阅读</button><button id="mode2d">二维阅读</button><button id="projector" hidden aria-pressed="false">投屏</button><button id="teacher">教师演示</button><button id="settings" aria-expanded="false">设置</button></nav></header>
 <div id="notice" role="status" aria-live="polite"></div><aside id="settings-panel" hidden><label>画质 <select id="quality"><option>高</option><option>中</option><option>低</option></select></label><label><input id="reduce-motion" type="checkbox">减少动态效果</label><label><input id="sound" type="checkbox">翻页轻音效</label><button id="clear">清除本课记录</button><p>进度仅保存在当前浏览器。离线包请始终使用同一地址。</p></aside>
 <main id="workspace"><div id="scene" aria-label="可展开的三维书本"></div><section id="cover" aria-labelledby="cover-title"><h1 id="cover-title">人教版地理必修一</h1><div class="cover-art"><svg viewBox="0 0 420 120" aria-hidden="true"><path d="M10 85Q80 65 150 84T275 80L320 37L350 70L370 57L410 87M10 98Q80 80 150 98T275 94M130 65V26H205M205 26l-13-8m13 8-13 8M280 15H205m0 0 13-8m-13 8 13 8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg></div><button class="primary" id="start">${p.spread > 0 ? "继续学习" : "翻开这本书"} <span>↗</span></button><p class="cover-meta">海陆风 · 水循环 · 河曲与牛轭湖</p></section>
 <section id="spread" hidden><div id="spread-label"></div><div id="page-content" aria-label="完整课文与键盘操作"></div><div class="page-navigation"><button id="prev" aria-label="上一跨页">← 上一页</button><span id="page-count"></span><button id="next" aria-label="下一跨页">下一页 →</button></div></section><div id="book-tools" hidden><button data-camera="阅读">阅读视图</button><button data-camera="实验">实验近景</button><button data-camera="剖面">侧面剖面</button></div><div id="paper-hint" aria-live="off"></div></main>
 <section id="projection-overlay" hidden aria-label="课堂投屏工具"><div class="projection-copy"><h2>海陆冷热改变时，近地面的风怎样转向？</h2><p id="projection-status"></p><p id="projection-explanation" hidden>先比冷热，再分别在近地面和高空比较气压；暖侧上升、冷侧下沉，构成局地环流。</p></div><div class="projection-controls"><button data-projector-phase="0.5">午后</button><button data-projector-phase="0">夜间</button><button id="projector-play">播放昼夜</button><button data-projector-layer="thermal">冷热</button><button data-projector-layer="pressure">气压</button><button data-projector-layer="flow">气流</button><button id="projector-explain">显示解释</button><button id="projector-reset">课堂重置</button></div></section>
 <footer class="bottom"><span>人教版 · 必修第一册 · 海陆间的热力环流</span><span id="save-status">${storage ? "本机保存 · 无需账号" : "临时会话 · 关闭后不会保留本次记录"}</span></footer><div id="book-ui"></div><div id="report"></div><dialog id="paper-answer" aria-labelledby="answer-title"><form method="dialog"><button class="dialog-close" aria-label="关闭选择">关闭</button><h2 id="answer-title"></h2><p id="answer-question"></p><div id="answer-options"></div><p id="answer-feedback"></p></form></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const capsuleStyle=document.createElement('style');capsuleStyle.textContent=capsuleCSS;document.head.append(capsuleStyle);
const capsule=createCapsule($('#book-ui'),{
  onContents:()=>{document.body.classList.toggle('controls-open');$('#cContents').setAttribute('aria-expanded',String(document.body.classList.contains('controls-open')))},
  onPrev:()=>requestSpread((turning?target:p.spread)-1),
  onNext:()=>!opened?openBook():requestSpread((turning?target:p.spread)+1),
  onWatch:()=>startDemonstration(),
  onPause:()=>{if(chapterForSpread(p.spread))chapterAction('chapter','play');else if(p.step===1){watchPlaying=!watchPlaying;render()}else action('play')},
  onSound:(v:boolean)=>{p.sound=v;$<HTMLInputElement>('#sound').checked=v;capsule.setSound(v);save()},
  onStill:(v:boolean)=>{$<HTMLInputElement>('#reduce-motion').checked=v;if(scene)scene.reduced=v;if(v){playing=false;watchPlaying=false}capsule.setStill(v);render()},
  onLeave:()=>toggleTeacher(),teachersHref:'#'
});
$('#cTeach').addEventListener('click',e=>e.preventDefault());
const controlNames:Record<string,string>={cContents:'书本菜单',cPrev:'上一跨页',cNext:'下一跨页',cWatch:'播放演示',cPause:'暂停演示',cSound:'翻页声音',cStill:'减少动态效果',cTeach:'教师演示'};
Object.entries(controlNames).forEach(([id,label])=>{$('#'+id).setAttribute('aria-label',label);$('#'+id).title=label});
async function startDemonstration(){
  document.body.classList.remove('controls-open');
  if(!opened){await openBook();return}
  if(chapterForSpread(p.spread)){chapterAction('chapter','play');return}
  if(p.spread!==1)return;
  if(p.step>=2){action('play');return}
  if(p.prediction===null)p.prediction=-1;
  p.step=1;watchIndex=0;watchElapsed=0;watchPlaying=true;playing=false;
  scene?.enter();save();render();
}
function toast(text: string) {
  $("#notice").textContent = text;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => ($("#notice").textContent = ""), 5000);
}
function save() {
  if (teacher) return;
  p.observationStep=watchIndex;
  student = p;
  storage = persist(p);
  $("#save-status").textContent = storage
    ? "已保存到本机"
    : "临时会话 · 关闭后不会保留本次记录";
}
function resetInput() {
  p.input = { phase: 0.5, contrast: 1 };
  playing = false;
  watchPlaying = false;
  updateExperiment();
  save();
}
function initScene() {
  if (twoD) return;
  try {
    scene = new BookScene($("#scene"));
    scene.reduced=$<HTMLInputElement>('#reduce-motion').checked;
    scene.onHit = paperAction;
    scene.onPhase = (phase, commit) => {
      const chapter=chapterForSpread(p.spread);
      if(chapter){if(!p.chapters[chapter].revealed||turning)return;setChapterPhase(phase,commit);return}
      if (p.step === 0 || (p.step === 1 && !teacher) || turning) return;
      playing = false; watchPlaying = false; p.input.phase = phase;
      updateExperiment(); if (commit) save();
    };
    scene.onHover = (label) => { $("#paper-hint").textContent = label; };
    scene.setQuality(p.quality);
    scene.onLost = () => {
      playing = false;
      watchPlaying = false;
      save();
      twoD = true;
      applyMode();
      toast("三维显示暂时中断，已切换二维模式，学习记录保留。");
    };
    scene.onReady = () => toast("三维环境已恢复，可以切回立体书。");
    scene.prepare().then(() => {
      scene?.setOpen(opened);
      if(opened)enterCurrent();
    });
  } catch {
    twoD = true;
    toast("此设备暂不支持三维显示。二维模式保留全部实验与练习。");
  }
}
function applyMode() {
  if(twoD&&projecting)setProjector(false);
  document.body.classList.toggle("two-d", twoD);
  $("#mode2d").textContent = twoD ? "立体书" : "二维阅读";
  $("#scene").hidden = twoD;
  if (!twoD && !scene) initScene();
  render();
}
function sceneState() {
  if (!scene) return;
  scene.running = playing || watchPlaying;
  scene.view = view;
  scene.flowVisible = layers.flow;
  scene.thermalVisible = layers.thermal;
  scene.pressureVisible = layers.pressure;
  scene.reveal = p.step === 0 && !teacher ? -1 : p.step === 1 ? watchIndex : 4;
  scene.setOpen(opened);
  scene.setPresentation({ progress: p, teacher, explain, watchIndex, playing, watchPlaying, layers });
}
function render() {
  const focus=document.activeElement as HTMLElement|null;
  const focusKey=focus && $('#page-content').contains(focus) ? focus.id ? `#${focus.id}` : ['data-step','data-action','data-predict','data-answer','data-transfer','data-phase','data-contrast','data-highlight'].map(k=>focus.hasAttribute(k)?`[${k}="${focus.getAttribute(k)}"]${focus instanceof HTMLInputElement?`[value="${focus.value}"]`:''}`:null).find(Boolean) : null;
  $("#cover").hidden = opened;
  $("#spread").hidden = !opened;
  document.body.classList.toggle("teacher-mode", teacher);
  document.body.classList.toggle('projecting',projecting&&teacher);
  $('#projector').hidden=!(teacher&&!twoD&&p.spread===1);
  $('#projection-overlay').hidden=!(projecting&&teacher&&!twoD&&p.spread===1);
  document.body.classList.toggle("book-open", opened);
  document.body.classList.toggle("reading-open", readingOpen);
  $("#reading-toggle").setAttribute("aria-expanded", String(readingOpen));
  $("#book-tools").hidden = !opened || !(p.spread===1||chapterForSpread(p.spread)) || twoD;
  document.body.dataset.view = view;
  $("#teacher").textContent = teacher ? "退出教师演示" : "教师演示";
  capsule.setWhere(opened?(p.spread===1?'1':p.spread===3?'2':p.spread===4?'3':''):'',opened?spreadTitles[p.spread]:spreadTitles[0],{canWatch:opened&&(p.spread===1||!!chapterForSpread(p.spread)),first:!opened||p.spread===0,last:p.spread===SPREAD.end});
  capsule.caption(opened&&p.spread===1&&p.step===1?lesson.observationSteps[watchIndex].text:null,watchIndex,5,!watchPlaying);
  $('#cPause').setAttribute('aria-label',watchPlaying?'暂停演示':'继续演示');
  $('#cTeach').setAttribute('aria-label',teacher?'退出教师演示':'教师演示');
  $('#cTeach').title=teacher?'退出教师演示':'教师演示';
  capsule.setSound(p.sound);capsule.setStill(scene?.reduced??false);
  if (!opened) {
    sceneState();
    return;
  }
  const spread = p.spread;
  $("#spread-label").textContent =
    spread === 1
      ? "01 / 观察一片海岸"
      : spread === 2
        ? "02 / 留下你的证据"
        : spread === 3
          ? "02 / 水循环"
          : spread === 4
            ? "03 / 河曲与牛轭湖"
            : spread === SPREAD.guide
              ? "教师与来源"
          : "书末";
  $("#page-count").textContent = spread === SPREAD.end ? "书末" : `跨页 ${spread} / 5`;
  $("#page-content").innerHTML =
    spread === 1
      ? mainSpread()
      : spread === 2
        ? challengeSpread()
        : chapterForSpread(spread)
          ? chapterSpread()
          : spread === SPREAD.guide
          ? guideSpread()
          : `<article class="back-cover"><h2>把图读懂，<br>再去看真实的世界。</h2><button class="primary" data-action="reopen">重新翻开</button></article>`;
  sceneState();
  bindPage();
  updateExperiment();
  if(focusKey) document.querySelector<HTMLElement>(`#page-content ${focusKey}`)?.focus({preventScroll:true});
}
function mainSpread() {
  const step = p.step;
  return `<article class="paper left-page"><p class="eyebrow">问题 01 <span>一片海岸，两种热响应</span></p><h1>海边的风，<br>为什么会转向？</h1><p class="intro">晴朗的午后，你站在海滩上。到了夜间，风的来处可能改变。推动它的是什么？</p>
 <nav class="steps" aria-label="学习步骤">${["预测", "观察", "动手", "解释", "挑战"].map((v, i) => `<button data-step="${i}" class="${p.step === i ? "active" : ""}" aria-current="${p.step === i ? "step" : "false"}"><small>0${i + 1}</small>${v}</button>`).join("")}</nav>${teacher ? '<div class="teacher-banner">教师演示 · 不计入学生学习记录</div>' : ''}
 ${
   step === 0
     ? `<h2 class="question">午后，近地面的风更可能从哪里吹来？</h2><div class="choices">${lesson.prediction.map((v, i) => `<button data-predict="${i}" ${p.prediction !== null ? "disabled" : ""} class="${p.prediction === i ? "chosen" : ""}"><span>${"ABC"[i]}</span>${v}</button>`).join("")}</div>${p.prediction !== null ? `<p class="muted">首次预测：${p.prediction === -1 ? "先观察" : lesson.prediction[p.prediction]}。带着这个想法去观察。</p><button class="primary" data-step="1">展开海岸，开始观察 ↗</button>` : '<button class="text-button" data-action="skip">先观察，再判断 →</button>'}`
     : step === 1
       ? `<p class="eyebrow">观察 ${watchIndex + 1} / 5</p><h2>${lesson.observationSteps[watchIndex].title}</h2><p class="observation-copy">${lesson.observationSteps[watchIndex].text}</p><div class="button-row"><button data-action="watch-prev" ${watchIndex === 0 ? "disabled" : ""}>上一步</button><button data-action="watch-play">${watchPlaying ? "暂停讲解" : "连续讲解"}</button><button data-action="watch-next">${watchIndex === 4 ? "进入动手" : "下一步 →"}</button></div><button class="text-button" data-action="watch-reset">重新观察</button><p class="small-note">这是讲解顺序，真实大气过程相互联系，并非五个独立阶段。</p>`
       : step === 2 && teacher
         ? `<h2 class="projection-question">此刻，近地面的风<br>从哪里来？</h2><p class="teacher-prompt">先比较海陆冷热，再在同一高度比较气压，最后追踪完整环流。</p><div class="teacher-checklist"><p>① 午后与夜间，哪一侧较暖？</p><p>② 上下两层的气流为何相反？</p><p>③ 转向时，风旗发生什么变化？</p></div><details class="teacher-explanation"><summary>展开 / 隐藏讲解依据</summary>${lesson.explanation.map((e) => `<p><b>${e.title}</b><br>${e.text}</p>`).join("")}</details><p class="small-note">用右页图层控制揭示顺序。可随时暂停并让学生作答。</p>`
         : step === 2
           ? `<h2>让风自己告诉你</h2><ol class="tasks">${lesson.experiments.map((t, i) => `<li><b>${"ABC"[i]}</b><span>${t}</span></li>`).join("")}</ol><div class="record-chips">${["午后", "夜间", "无温差"].map((k) => `<span class="${p.observations.some((o) => o.kind === k) ? "done" : ""}">${p.observations.some((o) => o.kind === k) ? "✓" : "○"} ${k}</span>`).join("")}</div><button class="text-button" data-step="3">掀开解释，核对想法 →</button>`
           : `<h2>从冷热，走到风向</h2><button class="flap-toggle" data-action="flap" aria-expanded="${explain}"><span>为什么会这样？</span><span>${explain ? "收起 −" : "掀开 ↗"}</span></button>${explain ? `<div class="explanations">${lesson.explanation.map((e, i) => `<button class="explanation" data-highlight="${i}"><b>0${i + 1} / ${e.title}</b><span>${e.text}</span></button>`).join("")}</div>` : '<p class="flap-hint">试着先用自己的话解释，再掀开纸片核对。</p>'}<button class="primary" data-action="challenge">带着证据，去挑战 →</button>`
 }
 <div class="keywords"><span>温差</span><span>热力环流</span><span>相对气压</span><span>风向</span></div><details class="misconceptions"><summary>三个容易混淆的地方</summary><p>① 高低压必须在同一高度比较。<br>② 海风、陆风按风的来向命名。<br>③ 无温差只消除本课的局地环流分量，不表示真实世界没有风。</p></details></article>
 <article class="experiment-page"><div class="experiment-heading"><span class="eyebrow">海岸实验台</span><span id="phase-badge" class="phase-badge"></span></div><div id="diagram-stage" ${!(twoD || layers.diagram) ? "hidden" : ""}></div><div class="model-space" ${twoD || layers.diagram ? "hidden" : ""}><span class="model-caption">${step === 0 ? "先作预测，再让海岸从纸上立起" : "原创示意海岸 · 可切换剖面视图"}</span><div class="shore-labels"><span>海洋</span><span>陆地</span></div></div>
 <div class="instrument"><div class="live-summary" id="live-summary" aria-live="off"></div><div class="preset-row"><button data-phase="0.5">☀ 午后</button><button data-phase="0">☾ 夜间</button><button id="play" data-action="play" aria-label="播放昼夜变化">▷ 播放</button></div><label class="slider-label" for="phase">昼夜阶段 <span>拖动后保持暂停</span></label><input id="phase" type="range" min="0" max="999" value="${Math.round(p.input.phase * 1000)}" aria-label="昼夜阶段"><div class="slider-ticks"><span>夜间</span><span>日出附近</span><span>午后</span><span>日落附近</span><span>夜间</span></div><div class="contrast-row"><span>温差对照</span>${[
   [1, "通常"],
   [0.5, "减弱"],
   [0, "无温差"],
 ]
   .map(
     ([v, l]) =>
       `<button data-contrast="${v}" aria-pressed="${p.input.contrast === v}">${l}</button>`,
   )
   .join(
     "",
   )}</div><div class="tool-row"><label>视图 <select id="view"><option ${view === "阅读" ? "selected" : ""}>阅读</option><option ${view === "实验" ? "selected" : ""}>实验</option><option ${view === "剖面" ? "selected" : ""}>剖面</option></select></label>${[
   ["thermal", "冷热"],
   ["pressure", "气压"],
   ["flow", "气流"],
   ["diagram", "二维图"],
 ]
   .map(
     ([k, l]) =>
       `<label><input type="checkbox" data-layer="${k}" ${layers[k as keyof typeof layers] ? "checked" : ""}>${l}</label>`,
   )
   .join(
     "",
   )}</div><div class="button-row"><button class="primary" data-action="save-observation" ${step === 0 && !teacher ? "disabled" : ""}>${teacher ? "查看当前条件" : "保存当前观察"}</button><button data-action="reset">重置实验</button></div></div><p class="page-footnote">晴朗、背景风弱的理想化情景；内部数值不是气象观测。</p></article>`;
}
function enterCurrent(){
  const id=chapterForSpread(p.spread);
  if(p.spread===SPREAD.coast&&(p.step>0||teacher)||id&&p.chapters[id].revealed)scene?.enter();
}
function visitChapter(){
  const id=chapterForSpread(p.spread);if(!id||teacher||!p.chapters[id].revealed)return;
  if(id==='water'){
    const s=p.chapters.water;if(!s.visited.includes(s.mode))s.visited.push(s.mode);
  }else{
    const s=p.chapters.river,key=s.phase<=.01?'河曲':s.phase>=.99?'牛轭湖':null;
    if(key&&!s.visited.includes(key))s.visited.push(key);
  }
}
function setChapterPhase(value:number,commit=true){
  const id=chapterForSpread(p.spread);if(!id)return;
  playing=false;watchPlaying=false;p.chapters[id].phase=Math.max(0,Math.min(id==='water'?.999:1,value));
  visitChapter();updateChapterExperiment();if(commit){save();render()}
}
function chapterAction(kind:string,value:string|number|undefined){
  const id=chapterForSpread(p.spread);if(!id||turning)return;const s=p.chapters[id];
  if(kind==='chapter-predict'){
    if(!teacher&&s.prediction===null)s.prediction=Number(value);
  }else if(kind==='chapter'){
    if(value==='reveal'){
      playing=false;s.revealed=!s.revealed;if(s.revealed)scene?.enter();else scene?.leave();
    }else if(value==='play'){
      if(!s.revealed){s.revealed=true;scene?.enter();playing=true}
      else playing=!playing;
      if(id==='river'&&s.phase>=1&&playing)s.phase=0;
    }else if(value==='answer'){
      if(teacher){toast('教师演示不填写学生练习。');return}
      const copy=chapterCopy[id];$('#answer-title').textContent='读图检查';$('#answer-question').textContent=copy.check;
      $('#answer-feedback').textContent=s.checked?copy.feedback:'';
      $('#answer-options').replaceChildren(...copy.answers.map((label,i)=>{
        const button=document.createElement('button');button.type='button';button.textContent=label;
        button.onclick=()=>{
          if(s.firstAnswer===null)s.firstAnswer=i;if(s.answer!==null&&s.answer!==i)s.edits++;
          s.answer=i;s.checked=true;save();$<HTMLDialogElement>('#paper-answer').close();render();
          toast(chapterComplete(id,p.chapters)?'观察与读图检查完成。':i===(id==='water'?0:1)?'回答正确，再补齐图中的观察。':copy.feedback);
        };return button;
      }));$<HTMLDialogElement>('#paper-answer').showModal();return;
    }else if(value==='reset'){
      playing=false;s.phase=0;if(id==='water'){p.chapters.water.mode=waterModes[0];p.chapters.water.focus=null}
    }
  }else if(kind==='water-mode'&&id==='water'){
    playing=false;p.chapters.water.mode=waterModes[Number(value)]??waterModes[0];p.chapters.water.focus=null;
  }else if(kind==='water-process'&&id==='water'){
    const focus=value as WaterProcess;p.chapters.water.focus=p.chapters.water.focus===focus?null:focus;
  }else if(kind==='river-stage'&&id==='river'){
    setChapterPhase(Number(value));return;
  }
  visitChapter();save();render();
}
function chapterSpread(){
  const id=chapterForSpread(p.spread)!;const copy=chapterCopy[id],s=p.chapters[id];
  const water=p.chapters.water,river=p.chapters.river;
  return `<article class="paper chapter-copy"><p class="eyebrow">${copy.chapter}</p><h1>${copy.title}</h1><p class="chapter-question">${copy.question}</p><p>${copy.intro}</p><div class="formula"><strong>${copy.principle[0]}</strong><p>${copy.principle[1]}</p></div><h2>预测</h2><p>${copy.prediction}</p><div class="prediction-options">${copy.options.map((text,i)=>`<button data-chapter-kind="chapter-predict" data-chapter-value="${i}" aria-pressed="${s.prediction===i}" ${s.prediction!==null?'disabled':''}>${text}</button>`).join('')}</div><button data-chapter-kind="chapter" data-chapter-value="reveal">${s.revealed?'收回图画':'让图立起'}</button><details ${explain?'open':''}><summary>为什么？</summary><p>${copy.explanation}</p></details><button data-chapter-kind="chapter" data-chapter-value="answer">读图检查</button><p id="chapter-result">${s.checked?(s.answer===(id==='water'?0:1)?'回答正确。':copy.feedback):'观察后，再检查你的想法。'}</p><div class="stamp ${chapterComplete(id,p.chapters)?'earned':''}"><span>${chapterComplete(id,p.chapters)?'本课练习完成':'留下你的观察'}</span><small>${id==='water'?`${water.visited.length} / 3 种循环`:`${river.visited.length} / 2 处观察`}</small></div><small>${copy.source}</small></article>
  <article class="paper chapter-experiment"><div id="chapter-diagram"></div><p id="chapter-live" role="status"></p><label class="phase-label" for="chapter-phase">${id==='water'?'沿路径观察':'事件过程（不表示真实年数）'}</label><input id="chapter-phase" type="range" min="0" max="1000" value="${Math.round(s.phase*1000)}" aria-label="${id==='water'?'沿路径观察':'河曲成湖过程'}"><div class="chapter-controls">${id==='water'?waterModes.map((mode,i)=>`<button data-chapter-kind="water-mode" data-chapter-value="${i}" aria-pressed="${water.mode===mode}">${mode}</button>`).join(''):[['河曲',0],['颈部冲断',.52],['新河道贯通',.78],['牛轭湖',1]].map(([text,value])=>`<button data-chapter-kind="river-stage" data-chapter-value="${value}">${text}</button>`).join('')}<button id="chapter-play" data-chapter-kind="chapter" data-chapter-value="play">${playing?'暂停':'播放'}</button><button data-chapter-kind="chapter" data-chapter-value="reset">重置实验</button></div>${id==='water'?`<div class="chapter-processes">${evaluateWater(water).paths.map(q=>`<button data-chapter-kind="water-process" data-chapter-value="${q.id}" aria-pressed="${water.focus===q.id}">${q.label}</button>`).join('')}</div>`:''}<p id="chapter-note">${copy.caution}</p></article>`;
}
function updateChapterExperiment(){
  const id=chapterForSpread(p.spread);if(!id||!opened)return;
  const diagram=$('#chapter-diagram'),live=$('#chapter-live'),s=p.chapters[id];
  if(diagram)diagram.innerHTML=id==='water'?waterDiagram(p.chapters.water):riverDiagram(p.chapters.river);
  if(live){
    const focus=waterPaths.find(q=>q.id===p.chapters.water.focus);
    live.textContent=!s.revealed?'先预测，再让图画立起。':id==='water'?focus?.note??`${p.chapters.water.mode}：沿箭头追踪水的去向。`:`${evaluateRiver(s.phase).stage} · ${evaluateRiver(s.phase).mainRoute}`;
  }
  const slider=$<HTMLInputElement>('#chapter-phase');if(slider&&document.activeElement!==slider)slider.value=String(Math.round(s.phase*1000));
  const play=$('#chapter-play');if(play)play.textContent=playing?'暂停':'播放';
  sceneState();
}
function challengeSpread() {
  const done = complete(p);
  return `<article class="paper challenge-page"><p class="eyebrow">挑战 / 01</p><h1>夜间，风怎样走？</h1><p>海洋在左，陆地在右。填好冷热、同高度气压与四段气流。</p>${diagram(evaluateSeaBreeze({ phase: 0, contrast: 1 }), { blank: true })}<div class="diagram-answers">${lesson.challenge.map((q, i) => `<label class="${p.checked ? (p.diagram[i] === q.answer ? "correct" : "incorrect") : ""}"><span>${q.label}${p.checked ? (p.diagram[i] === q.answer ? " ✓" : " · 请再想想") : ""}</span><select data-answer="${i}" aria-label="${q.label}" ${teacher ? "disabled" : ""}><option value="">请选择</option>${q.options.map((v) => `<option ${p.diagram[i] === v ? "selected" : ""}>${v}</option>`).join("")}</select>${p.checked && p.diagram[i] !== q.answer ? `<small>${q.hint}</small>` : ""}</label>`).join("")}</div><div class="button-row"><button class="primary" data-action="check-diagram">检查环流图</button><button data-action="hint">提示（已用 ${p.hints} 次）</button></div><div id="hint-text" role="status"></div><h2 class="section-title">换一幅图，还能判断吗？</h2><div class="mirror-coast"><span>陆地</span><span>☀ 午后</span><span>海洋</span></div>${transfer.map((q, i) => `<fieldset><legend>${i + 1}. ${q.question}</legend>${q.options.map((v, j) => `<label class="radio"><input type="radio" name="transfer-${i}" data-transfer="${i}" value="${j}" ${p.transfer[i] === j ? "checked" : ""} ${teacher ? "disabled" : ""}>${v}</label>`).join("")}${p.transferChecked ? `<p class="feedback ${p.transfer[i] === q.answer ? "correct" : "incorrect"}">${p.transfer[i] === q.answer ? "✓ 正确。" : "再想想。"}${q.why}</p>` : ""}</fieldset>`).join("")}<button class="primary" data-action="check-transfer">检查迁移判断</button></article>
 <article class="paper records-page"><p class="eyebrow">记录 / 02</p><h1>给结论留一份证据</h1><p>改变条件，再比较。记录会保存在这个浏览器中。</p><div class="observation-records">${[
   "午后",
   "夜间",
   "无温差",
 ]
   .map((k) => {
     const o = p.observations.find((o) => o.kind === k);
     return `<section class="record"><span class="record-kind">${k === "午后" ? "☀" : k === "夜间" ? "☾" : "＝"} ${k}</span>${o ? `<h3>${o.ground}</h3><p>海侧${o.sea}，陆侧${o.land}。<br>高空：${o.upper}。</p><small>温差：${o.input.contrast === 1 ? "通常" : o.input.contrast === 0.5 ? "减弱" : "无温差"}</small>` : '<p class="empty-record">还没有这份观察。回到实验台，设置条件后保存。</p>'}</section>`;
   })
   .join(
     "",
   )}</div><button class="text-button" data-action="experiment">← 回实验台补充观察</button><h2 class="section-title">用证据说一句话</h2><label class="conclusion-label" for="conclusion">哪一项比较最能支持你的解释？</label><select id="conclusion"><option value="">选择一组证据</option>${["午后与夜间的冷热关系相反，近地面风向也相反。", "温差减弱时局地环流变弱，无温差时这一分量消失。"].map((t) => `<option ${p.conclusion === t ? "selected" : ""}>${t}</option>`).join("")}</select><p class="conclusion-text">${p.conclusion || "完成观察后，选择一组证据形成结论。"}</p><div class="stamp ${done ? "earned" : ""}"><span>${done ? "本课练习完成" : "等待你的证据"}</span><small>${done ? "观察 · 解释 · 迁移" : "三类观察 + 环流图 + 三道迁移题"}</small></div><p class="small-note">印章表示完成本课练习，不代表长期掌握。修改 ${p.edits} 次 · 主动提示 ${p.hints} 次。</p><button data-action="print">打印观察报告 / 保存 PDF</button></article>`;
}
function guideSpread() {
  return `<article class="paper"><p class="eyebrow">教师手册 / 03</p><h1>把问题留给学生</h1><h2>本课学习目标</h2><ol>${lesson.learningObjectives.map((x) => `<li>${x}</li>`).join("")}</ol><h2>3—5 分钟课堂演示</h2><p>先隐藏气流，请学生判断午后的风向。分步打开冷热、升降、气压与水平气流。切换夜间，最后缓慢经过转向区，让学生解释旗子为什么先垂落。</p><p>教师模式不写入学生的预测、观察与练习记录。退出时恢复原来的学习状态。</p><button class="primary" data-action="teacher">进入教师演示</button><h2>模型简化</h2><ul><li>晴朗、背景风弱、理想化平坦海岸。</li><li>忽略地转偏向、复杂地形与沿岸差异。</li><li>闭合二维气流展示局地环流，不是天气预报。</li><li>冷热曲线的振幅与滞后是教学设定，不是实测热容、温度、气压或风速。</li><li>讲解的五步是信息揭示顺序，实际过程相互联系。</li><li>太阳落山与海陆冷热逆转并非同一个时刻。</li></ul><details><summary>查看内部教学设定</summary><pre>sea = 0.25 cos[2π(phase − 2/3)]
landBase = 0.85 cos[2π(phase − 7/12)]
land = sea + contrast × (landBase − sea)
delta = land − sea</pre><p>phase ∈ [0,1)，contrast ∈ {1, 0.5, 0}。|delta|≤0.02 视为相近，0.02—0.08 之间平滑减弱。内部量不标物理单位，不以转向点考查钟点。</p></details></article><article class="paper"><p class="eyebrow">来源与图例</p><h1>知道它从哪里来</h1>${lesson.sourceRefs.map((s) => `<section class="source"><h2><a href="${s.url}" target="_blank" rel="noreferrer">${s.title} ↗</a></h2><p>${s.note}</p></section>`).join("")}<p>书壳、纸页、排线笔触、翻片、底栏与展开机制直接改编自 Every Joule 固定版本 48591dd。中文内容、地理模型和练习由本项目编写。</p><h2>图例</h2><dl class="legend"><dt>暖橙 / 冷蓝</dt><dd>海陆相对冷热，同时配有中文标签。</dd><dt>深青箭头</dt><dd>气流方向；示踪速度只表达示意强弱。</dd><dt>两条水平比较带</dt><dd>分别比较高空、近地面，不作跨高度气压比较。</dd></dl><h2>使用与可访问性</h2><p>方向键翻页，Tab 选择控件，空格或回车操作按钮。滑块及选择框内的方向键只调整当前控件。手机自动进入二维模式；二维模式包含所有核心任务。</p><p>切后台自动暂停。重置实验保留学习记录；清除记录需要单独确认。可在设置中选择低画质或减少动态效果。</p><p class="version">人教版地理必修一 1.0 · 本地学习，无账号<br>本版本包含海陆风、水循环与河曲成湖三课，尚未覆盖整册。</p></article>`;
}
function bindPage() {
  document.querySelectorAll<HTMLElement>('[data-chapter-kind]').forEach(button=>button.onclick=()=>chapterAction(button.dataset.chapterKind!,button.dataset.chapterValue));
  const chapterSlider=$<HTMLInputElement>('#chapter-phase');
  if(chapterSlider){chapterSlider.oninput=()=>setChapterPhase(Number(chapterSlider.value)/1000,false);chapterSlider.onchange=()=>{visitChapter();save();render()}}
  document
    .querySelectorAll<
      HTMLButtonElement | HTMLInputElement
    >("[data-phase],[data-contrast],#phase,#play")
    .forEach((el) => (el.disabled = p.step === 1 && !teacher));
  document.querySelectorAll<HTMLElement>("[data-step]").forEach(
    (b) =>
      (b.onclick = () => {
        const step = Number(b.dataset.step);
        if (step === 4) {
          requestSpread(2);
          return;
        }
        p.step = step;
        playing = false;
        watchPlaying = false;
        if (step === 1) {
          watchIndex = 0;
          p.input = { phase: 0.5, contrast: 1 };
        }
        if (step === 3) explain = false;
        if (step > 0) scene?.enter(); else scene?.leave();
        save();
        render();
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-predict]").forEach(
    (b) =>
      (b.onclick = () => {
        if (p.prediction !== null || teacher) return;
        p.prediction = Number(b.dataset.predict);
        save();
        render();
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-phase]").forEach(
    (b) =>
      (b.onclick = () => {
        p.input.phase = Number(b.dataset.phase);
        playing = false;
        watchPlaying = false;
        save();
        updateExperiment();
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-contrast]").forEach(
    (b) =>
      (b.onclick = () => {
        p.input.contrast = Number(b.dataset.contrast) as 0 | 0.5 | 1;
        playing = false;
        save();
        updateExperiment();
      }),
  );
  document.querySelectorAll<HTMLInputElement>("[data-layer]").forEach(
    (b) =>
      (b.onchange = () => {
        layers[b.dataset.layer as keyof typeof layers] = b.checked;
        sceneState();
        updateExperiment();
      }),
  );
  document.querySelectorAll<HTMLSelectElement>("[data-answer]").forEach(
    (b) =>
      (b.onchange = () => {
        if (teacher) return;
        const i = Number(b.dataset.answer);
        if (p.diagram[i] && p.diagram[i] !== b.value) p.edits++;
        p.diagram[i] = b.value;
        if (!p.firstDiagram[i]) p.firstDiagram[i] = b.value;
        save();
        sceneState();
      }),
  );
  document.querySelectorAll<HTMLInputElement>("[data-transfer]").forEach(
    (b) =>
      (b.onchange = () => {
        if (teacher) return;
        const i = Number(b.dataset.transfer),
          v = Number(b.value);
        if (p.transfer[i] !== -1 && p.transfer[i] !== v) p.edits++;
        p.transfer[i] = v;
        if (p.firstTransfer[i] === -1) p.firstTransfer[i] = v;
        save();
        sceneState();
      }),
  );
  document.querySelectorAll<HTMLElement>("[data-highlight]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = Number(b.dataset.highlight);
        layers = {
          ...layers,
          thermal: n === 0,
          pressure: n === 1 || n === 2,
          flow: n >= 2,
        };
        sceneState();
        updateExperiment();
        b.classList.toggle("highlighted");
      }),
  );
  document
    .querySelectorAll<HTMLElement>("[data-action]")
    .forEach((b) => (b.onclick = () => action(b.dataset.action!)));
  const slider = $<HTMLInputElement>("#phase");
  if (slider) {
    slider.oninput = () => {
      playing = false;
      watchPlaying = false;
      p.input.phase = Number(slider.value) / 1000;
      updateExperiment();
    };
    slider.onchange = save;
  }
  const v = $<HTMLSelectElement>("#view");
  if (v)
    v.onchange = () => {
      view = v.value;
      document.body.dataset.view = view;
      sceneState();
    };
  const c = $<HTMLSelectElement>("#conclusion");
  if (c)
    c.onchange = () => {
      if (teacher) return;
      p.conclusion = c.value;
      save();
      render();
    };
}
function action(a: string) {
  if (a === "skip") {
    if (p.prediction === null) p.prediction = -1;
    p.input = { phase: 0.5, contrast: 1 };
    p.step = 1;
    watchIndex = 0;
    scene?.enter();
    save();
    render();
  }
  if (a === "watch-prev") {
    watchIndex = Math.max(0, watchIndex - 1);
    watchPlaying = false;
    save();
    render();
  }
  if (a === "watch-next") {
    watchPlaying = false;
    if (watchIndex < 4) watchIndex++;
    else p.step = 2;
    save();
    render();
  }
  if (a === "watch-play") {
    watchPlaying = !watchPlaying;
    watchElapsed = 0;
    render();
  }
  if (a === "watch-reset") {
    watchIndex = 0;
    watchPlaying = false;
    p.input = { phase: 0.5, contrast: 1 };
    save();
    render();
  }
  if (a === "play") {
    if (p.step === 0 && !teacher) {
      toast("先选择预测，或点击“先观察”。");
      return;
    }
    playing = !playing;
    if (!playing) save();
    updateExperiment();
  }
  if (a === "reset") resetInput();
  if (a === "save-observation") {
    if (teacher) {
      toast(`当前：${evaluateSeaBreeze(p.input).ground}。教师演示不计入记录。`);
      return;
    }
    const o = observation(p.input);
    if (!o) {
      toast("当前在过渡阶段。请保存典型午后、夜间，或无温差条件。");
      return;
    }
    p.observations = p.observations.filter((x) => x.kind !== o.kind);
    p.observations.push(o);
    save();
    toast(`已保存${o.kind}观察。`);
    render();
  }
  if (a === "flap") {
    explain = !explain;
    render();
  }
  if (a === "challenge") requestSpread(2);
  if (a === "experiment") {
    p.step = 2;
    requestSpread(1);
  }
  if (a === "reopen") requestSpread(1);
  if (a === "check-diagram") {
    if (teacher) return;
    p.checked = true;
    save();
    render();
    toast(
      p.diagram.every((v, i) => v === lesson.challenge[i].answer)
        ? "夜间环流图已完成。"
        : "已标出需要再想一想的位置，正确答案仍然保留。",
    );
  }
  if (a === "check-transfer") {
    if (teacher) return;
    p.transferChecked = true;
    save();
    render();
    toast(
      complete(p)
        ? "观察与练习全部完成，印章已盖好。"
        : "已显示判断结果，可继续修改或补充观察。",
    );
  }
  if (a === "hint") {
    if (teacher) return;
    p.hints++;
    save();
    const hint =
      p.hints === 1
        ? "先找夜间较暖的一侧，再判断升降。"
        : p.hints === 2
          ? "近地面暖侧相对低压、冷侧相对高压；高空相反。"
          : "夜间海侧较暖、上升；陆侧较冷、下沉。近地面陆 → 海，高空海 → 陆。";
    $("#hint-text").textContent = hint;
    sceneState(); toast(hint);
  }
  if (a === "teacher") toggleTeacher();
  if (a === "print") printReport();
}
function paperAction(hit: PaperHit) {
  if (turning) return;
  if(hit.kind==='goto'){requestSpread(Number(hit.value));return}
  if(['chapter','chapter-predict','water-mode','water-process','river-stage'].includes(hit.kind??'')){chapterAction(hit.kind!,hit.value);return}
  const actionName=hit.selector?.match(/^\[data-action="([^"]+)"\]$/)?.[1];
  if(actionName){action(actionName);return}
  if(hit.selector==='#play'){if(p.step<2&&!teacher)startDemonstration();else action('play');return}
  if (hit.selector === '[data-action="reopen"]') { action('reopen'); return; }
  if (hit.kind === 'next') { requestSpread((turning ? target : p.spread) + 1); return; }
  if (hit.kind === 'prev') { requestSpread((turning ? target : p.spread) - 1); return; }
  if (hit.kind === 'read') { readingOpen = true; render(); return; }
  if (hit.kind === 'view') {
    view = view === '阅读' ? '实验' : view === '实验' ? '剖面' : '阅读';
    const v = $<HTMLSelectElement>('#view'); if (v) v.value = view;
    document.body.dataset.view=view;
    sceneState(); return;
  }
  if (hit.kind === 'layer') {
    const k = hit.value as keyof typeof layers; layers[k] = !layers[k];
    const b = $<HTMLInputElement>(`[data-layer="${k}"]`); if (b) b.checked = layers[k];
    updateExperiment(); return;
  }
  if (hit.kind === 'contrast') {
    if (p.step === 0 || (p.step === 1 && !teacher)) { toast('进入“动手”后即可改变实验条件。'); return; }
    p.input.contrast = p.input.contrast === 1 ? .5 : p.input.contrast === .5 ? 0 : 1;
    playing = false; save(); updateExperiment(); return;
  }
  if (['diagram','transfer','conclusion'].includes(hit.kind || '')) {
    if (teacher) { toast('教师演示不填写学生练习。可退出教师模式后作答。'); return; }
    const index = Number(hit.value), kind = hit.kind;
    const q = kind === 'diagram' ? lesson.challenge[index] : kind === 'transfer' ? transfer[index] : null;
    const options = q?.options ?? ['午后与夜间的冷热关系相反，近地面风向也相反。','温差减弱时局地环流变弱，无温差时这一分量消失。'];
    $('#answer-title').textContent = kind === 'diagram' ? lesson.challenge[index].label : kind === 'transfer' ? `迁移判断 ${index+1}` : '用证据形成结论';
    $('#answer-question').textContent = kind === 'diagram' ? '典型夜间，海洋在左、陆地在右。' : kind === 'transfer' ? transfer[index].question : '选择最能支持你解释的一组观察证据。';
    $('#answer-feedback').textContent = kind === 'diagram' && p.checked ? lesson.challenge[index].hint : kind === 'transfer' && p.transferChecked ? transfer[index].why : '';
    $('#answer-options').replaceChildren(...options.map((label,i) => {
      const b = document.createElement('button'); b.type='button'; b.textContent=label;
      b.onclick=()=>{
        if(kind==='diagram') {
          const select=$<HTMLSelectElement>(`[data-answer="${index}"]`); select.value=label; select.dispatchEvent(new Event('change'));
        } else if(kind==='transfer') {
          const radio=$<HTMLInputElement>(`[data-transfer="${index}"][value="${i}"]`);radio.checked=true;radio.dispatchEvent(new Event('change'));
        } else { p.conclusion=label; save(); }
        $<HTMLDialogElement>('#paper-answer').close(); render();
      }; return b;
    }));
    $<HTMLDialogElement>('#paper-answer').showModal(); return;
  }
  if (hit.selector) {
    const control = $(hit.selector) as HTMLButtonElement;
    if (control && !control.disabled) control.click();
    else if (control?.disabled) toast('进入“动手”后即可改变实验条件。');
  }
}
function updateExperiment() {
  if(chapterForSpread(p.spread)){updateChapterExperiment();return}
  if (p.spread !== 1 || !opened) return;
  const s = evaluateSeaBreeze(p.input),
    hidden = p.step === 0 && !teacher;
  $('#projection-status').textContent=`${s.stage} · 近地面 ${s.ground}`;
  $('#projector-play').textContent=playing?'暂停昼夜':'播放昼夜';
  document.querySelectorAll<HTMLElement>('[data-projector-layer]').forEach(b=>b.setAttribute('aria-pressed',String(layers[b.dataset.projectorLayer as keyof typeof layers])));
  const badge = $("#phase-badge");
  if (badge) badge.textContent = s.stage;
  const summary = $("#live-summary");
  if (summary)
    summary.innerHTML = hidden
      ? "先留下你的预测，再揭示风向。"
      : `<b>${s.direction === 1 ? "海风" : s.direction === -1 ? "陆风" : "接近静风"}</b><span>近地面 ${s.ground}</span><small>${s.seaThermal}的海侧 · ${s.landThermal}的陆侧</small>`;
  const slider = $<HTMLInputElement>("#phase");
  if (slider && document.activeElement !== slider)
    slider.value = String(Math.round(p.input.phase * 1000));
  const play = $("#play");
  if (play) play.textContent = playing ? "Ⅱ 暂停" : "▷ 播放";
  document
    .querySelectorAll<HTMLElement>("[data-contrast]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.contrast) === p.input.contrast),
      ),
    );
  const d = $("#diagram-stage");
  if (d) {
    d.hidden = !(twoD || layers.diagram);
    d.innerHTML = diagram(s, {
      ...layers,
      reveal: p.step === 1 ? watchIndex : 4,
      blank: hidden,
    });
    const ms = $(".model-space");
    if (ms) ms.hidden = twoD || layers.diagram;
  }
  sceneState();
}
async function requestSpread(n: number) {
  target = Math.max(0, Math.min(SPREAD.end, n));
  if (turning) return;
  turning = true;
  playing = false;
  watchPlaying = false;
  explain = false;
  sceneState();
  while (p.spread !== target || (!opened && target !== 0)) {
    const next = target,
      from = p.spread;
    if (scene && !twoD) {
      await scene.leave();
      $("#spread").classList.add("turning");
      await scene.flip(next, from);
    }
    p.spread = next;
    opened = next !== 0;
    save();
  }
  turning = false;
  $("#spread").classList.remove("turning");
  render();
  enterCurrent();
  $("#page-content").scrollTop = 0;
  $("#page-count").setAttribute("tabindex", "-1");
  $("#page-count").focus({ preventScroll: true });
  if (p.sound) playSound();
}
async function toggleTeacher() {
  if (turning) {
    toast("正在翻页，请稍候再切换教学模式。");
    return;
  }
  const from = p.spread;
  playing = false;
  watchPlaying = false;
  if(projecting)setProjector(false);
  if (!teacher) {
    save();
    student = structuredClone(p);
    studentDisplay = {view,layers:{...layers},watchIndex,explain};
    p = structuredClone(initial());
    p.quality=student.quality; p.sound=student.sound;
    p.spread = chapterForSpread(from)?from:1;
    p.step = 2;
    const chapter=chapterForSpread(p.spread);if(chapter)p.chapters[chapter].revealed=true;
    teacher = true;
    opened = true;
  } else {
    teacher = false;
    p = student;
    if (studentDisplay) {
      view=studentDisplay.view; layers={...studentDisplay.layers};
      watchIndex=studentDisplay.watchIndex; explain=studentDisplay.explain;
    }
    scene?.setQuality(p.quality);
    $<HTMLSelectElement>('#quality').value=p.quality;
    $<HTMLInputElement>('#sound').checked=p.sound;
    opened = p.spread !== 0;
  }
  if (teacher) view = "阅读";
  render();
  if (scene && !twoD) {
    turning = true;
    target = p.spread;
    await scene.leave();
    await scene.flip(p.spread, from);
    turning = false;
    if (target !== p.spread) {
      await requestSpread(target);
      return;
    }
    enterCurrent();
    render();
  }
}
function printReport() {
  const s = evaluateSeaBreeze({ phase: 0, contrast: 1 });
  $("#report").innerHTML =
    `<h1>人教版地理必修一 · 海陆风观察报告</h1><p>首次预测：${p.prediction === null ? "未填写" : p.prediction === -1 ? "先观察" : lesson.prediction[p.prediction]}</p>${p.observations.map((o) => `<h2>${o.kind}</h2><p>海侧${o.sea}；陆侧${o.land}。近地面：${o.ground}；高空：${o.upper}。</p>`).join("")}<h2>夜间环流图 ${p.checked && p.diagram.every((v, i) => v === lesson.challenge[i].answer) ? "（已完成）" : "（尚未完成）"}</h2>${diagram(s, { blank: !p.checked || !p.diagram.every((v, i) => v === lesson.challenge[i].answer) })}<p>结论：${p.conclusion || "尚未选择证据。"}</p><p>修改 ${p.edits} 次；主动提示 ${p.hints} 次；${complete(p) ? "本课练习完成" : "练习尚未全部完成"}。</p><p>模型条件：晴朗、背景风弱的理想化海岸；所有数值为教学设定。印章不代表长期掌握。</p>`;
  window.print();
}
function playSound() {
  try {
    const c = new AudioContext();
    const o = c.createOscillator(),
      g = c.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(380, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.1);
    g.gain.setValueAtTime(0.025, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.13);
    o.onended = () => c.close();
  } catch {}
}
async function openBook() {
  if (turning) return;
  turning = true;
  opened = true;
  if (p.spread === 0) p.spread = 1;
  target = p.spread;
  save();
  render();
  if (scene && !twoD) await scene.flip(p.spread, 0);
  turning = false;
  if (target !== p.spread) {
    await requestSpread(target);
    return;
  }
  enterCurrent();
  render();
}
$("#start").onclick = openBook;
$("#home").onclick = (e) => {
  e.preventDefault();
  requestSpread(0);
};
document.querySelectorAll<HTMLElement>('[data-goto]').forEach(b=>b.onclick=()=>{document.body.classList.remove('controls-open');requestSpread(Number(b.dataset.goto))});
$("#prev").onclick = () => requestSpread((turning ? target : p.spread) - 1);
$("#next").onclick = () => requestSpread((turning ? target : p.spread) + 1);
function setProjector(enabled:boolean) {
  if(enabled&&(!teacher||twoD))return;
  if(enabled){
    projectionView=view;projectionReading=readingOpen;view='剖面';readingOpen=false;layers.diagram=false;
    document.body.classList.remove('controls-open');
    $('#cContents').setAttribute('aria-expanded','false');
  }
  else if(projecting){view=projectionView;readingOpen=projectionReading}
  projecting=enabled;playing=false;watchPlaying=false;
  $('#projector').setAttribute('aria-pressed',String(enabled));
  $('#projector').textContent=enabled?'退出投屏':'投屏显示';
  render();
}
$('#projector').onclick=()=>setProjector(!projecting);
document.querySelectorAll<HTMLElement>('[data-projector-phase]').forEach(b=>b.onclick=()=>{p.input.phase=Number(b.dataset.projectorPhase);playing=false;updateExperiment()});
document.querySelectorAll<HTMLElement>('[data-projector-layer]').forEach(b=>b.onclick=()=>{const k=b.dataset.projectorLayer as keyof typeof layers;layers[k]=!layers[k];updateExperiment()});
$('#projector-play').onclick=()=>action('play');
$('#projector-explain').onclick=()=>{const e=$('#projection-explanation');e.hidden=!e.hidden;$('#projector-explain').textContent=e.hidden?'显示解释':'隐藏解释'};
$('#projector-reset').onclick=()=>{layers={thermal:true,pressure:true,flow:true,diagram:false};$('#projection-explanation').hidden=true;$('#projector-explain').textContent='显示解释';resetInput();render()};
$("#mode2d").onclick = () => {
  if(projecting)setProjector(false);
  twoD = !twoD;
  applyMode();
};
$("#teacher").onclick = toggleTeacher;
$("#reading-toggle").onclick = () => {
  if (twoD) return;
  document.body.classList.remove('controls-open');
  $('#cContents').setAttribute('aria-expanded','false');
  readingOpen = !readingOpen;
  document.body.classList.toggle('reading-open',readingOpen);
  $('#reading-toggle').setAttribute('aria-expanded',String(readingOpen));
  if (!opened) {
    document.body.classList.toggle('cover-reading',readingOpen);
  }
};
$('#page-content').addEventListener('focusin', () => {
  if (!twoD && !readingOpen) {
    readingOpen=true;document.body.classList.add('reading-open');$('#reading-toggle').setAttribute('aria-expanded','true');
  }
});
document.querySelectorAll<HTMLElement>('[data-camera]').forEach(b => b.onclick = () => {
  view=b.dataset.camera!; const v=$<HTMLSelectElement>('#view'); if(v)v.value=view; sceneState();
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && readingOpen) {
    readingOpen=false; document.body.classList.remove('reading-open','cover-reading');$('#reading-toggle').setAttribute('aria-expanded','false');$('#reading-toggle').focus();
  }
});
$("#settings").onclick = () => {
  const panel = $("#settings-panel");
  panel.hidden = !panel.hidden;
  $("#settings").setAttribute("aria-expanded", String(!panel.hidden));
};
$<HTMLSelectElement>("#quality").value = p.quality;
$<HTMLSelectElement>("#quality").onchange = (e) => {
  // An explicit selection takes priority over the one-time automatic reduction.
  downgraded = true;
  p.quality = (e.target as HTMLSelectElement).value;
  scene?.setQuality(p.quality);
  save();
};
$<HTMLInputElement>("#reduce-motion").checked = matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
$<HTMLInputElement>("#reduce-motion").onchange = (e) => {
  const reduced = (e.target as HTMLInputElement).checked;
  if (scene) scene.reduced = reduced;
  document.body.classList.toggle("reduced", reduced);
};
$<HTMLInputElement>("#sound").checked = p.sound;
$<HTMLInputElement>("#sound").onchange = (e) => {
  p.sound = (e.target as HTMLInputElement).checked;
  save();
};
$("#clear").onclick = () => {
  if (teacher) {
    toast("请先退出教师演示，再清除学生记录。");
    return;
  }
  if (confirm("清除本课预测、观察、练习与书签？此操作无法撤销。")) {
    p = initial();
    student = p;
    opened = false;
    playing = false;
    scene?.leave();
    save();
    render();
  }
};
window.addEventListener("keydown", (e) => {
  if (
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
      (e.target as HTMLElement).tagName,
    ) ||
    turning || $<HTMLDialogElement>('#paper-answer').open
  )
    return;
  if (e.key === "ArrowRight") {
    e.preventDefault();
    requestSpread(opened ? p.spread + 1 : Math.max(1,p.spread));
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    requestSpread(p.spread - 1);
  }
});
let swipe: { x: number; y: number } | null = null;
$("#workspace").addEventListener(
  "touchstart",
  (e) => {
    swipe=null;
    if (e.touches.length!==1 || (e.target as HTMLElement).closest('button,input,select,summary,dialog,a')) return;
    const t = e.touches[0];
    if (t.clientX < 70 || t.clientX > innerWidth - 70)
      swipe = { x: t.clientX, y: t.clientY };
  },
  { passive: true },
);
$("#workspace").addEventListener(
  "touchend",
  (e) => {
    if (!swipe) return;
    const t = e.changedTouches[0];
    if (
      Math.abs(t.clientX - swipe.x) > 60 &&
      Math.abs(t.clientY - swipe.y) < 60
    )
      requestSpread(p.spread + (t.clientX < swipe.x ? 1 : -1));
    swipe = null;
  },
  { passive: true },
);
$("#workspace").addEventListener('touchcancel',()=>{swipe=null},{passive:true});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    playing = false;
    watchPlaying = false;
    save();
  }
  lastTime = performance.now();
  updateExperiment();
});
function frame(time: number) {
  const frameMs = lastTime ? time-lastTime : 16;
  const dt = Math.min(0.05, frameMs / 1000 || 0.016);
  lastTime = time;
  if (!document.hidden) {
    if (playing && !turning) {
      const id=chapterForSpread(p.spread);
      if(id==='water')p.chapters.water.phase=(p.chapters.water.phase+dt/12)%1;
      else if(id==='river'){
        p.chapters.river.phase=Math.min(1,p.chapters.river.phase+dt/18);
        if(p.chapters.river.phase>=1){playing=false;visitChapter();save();render()}
      }else p.input.phase = (p.input.phase + dt / 120) % 1;
      updateExperiment();
    }
    if (watchPlaying) {
      watchElapsed += dt;
      if (watchElapsed > 5) {
        watchElapsed = 0;
        if (watchIndex < 4) watchIndex++;
        else {watchPlaying = false;p.step=2;}
        save();
        render();
      }
    }
    if (scene && !twoD) {
      scene.setGlassRects(capsule.rects());
      scene.update(dt, evaluateSeaBreeze(p.input));
      frames++;
      totalMs += frameMs;
      if (frameMs > 33) slowFrames++;
      if (totalMs > 5000 && frames >= 45 && !downgraded && slowFrames / frames > 0.65) {
        scene.setQuality("低");
        $<HTMLSelectElement>('#quality').value='低';
        downgraded = true;
        toast("已自动降低画质，保留完整实验。");
      }
    }
  }
  raf = requestAnimationFrame(frame);
}
window.addEventListener("beforeunload", () => {
  save();
  cancelAnimationFrame(raf);
  scene?.dispose();
});
// Diagnostics contain render counters only; no user data or external telemetry.
Object.defineProperty(window, "fieldbookDiagnostics", {
  get: () => ({
    mode: twoD ? "2d" : "3d",
    averageFrameMs: frames ? totalMs / frames : 0,
    quality: scene?.quality,
    render: scene ? {...scene.stats,busy:turning||scene.stats.busy} : null,
    paperRegions: scene?.regions,
    chapter: chapterForSpread(p.spread),
  }),
});
initScene();
applyMode();
raf = requestAnimationFrame(frame);
