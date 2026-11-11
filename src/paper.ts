import { THREE } from './reference/engine.js';
import type { CanvasTexture } from 'three';
import { lesson, transfer } from './content';
import { complete, type Progress } from './state';
import type { SeaBreezeDerivedState } from './model';
import { chapterForSpread, chapterCopy, chapterComplete, waterModes, waterPaths, evaluateWater, evaluateRiver, SPREAD, type ChapterId } from './chapters';

export const PAPER_W = 1280, PAPER_H = 1700;
export interface Presentation {
  progress: Progress; teacher: boolean; explain: boolean; watchIndex: number;
  playing: boolean; watchPlaying: boolean;
  layers: { thermal: boolean; pressure: boolean; flow: boolean; diagram: boolean };
}
export interface PaperHit {
  x: number; y: number; w: number; h: number; selector?: string;
  kind?: string; value?: string | number; label: string;
}
const ink = '#1c2433', muted = '#4b5466', red = '#9a3b2a', line = '#b8ad97';

/** Both the displayed texture and UV hit regions are authored in paper pixels. */
export class Paper {
  canvas = document.createElement('canvas');
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
  hits: PaperHit[] = [];
  private background: HTMLCanvasElement;
  constructor() {
    this.canvas.width = PAPER_W; this.canvas.height = PAPER_H;
    this.ctx = this.canvas.getContext('2d')!;
    this.background = document.createElement('canvas');
    this.background.width = PAPER_W; this.background.height = PAPER_H;
    const b = this.background.getContext('2d')!;
    b.fillStyle = '#fbf7ee'; b.fillRect(0, 0, PAPER_W, PAPER_H);
    const g = b.createLinearGradient(0, 0, PAPER_W, 0);
    g.addColorStop(0, '#e8dfca'); g.addColorStop(.035, '#f5eedc');
    g.addColorStop(.95, '#f5eedc'); g.addColorStop(1, '#eae1cb');
    b.fillStyle = g; b.fillRect(0, 0, PAPER_W, PAPER_H);
    let seed = 37;
    for (let i = 0; i < 15000; i++) {
      seed = (seed * 16807) % 2147483647; const x = seed % PAPER_W;
      seed = (seed * 16807) % 2147483647;
      b.fillStyle = `rgba(100,79,42,${(seed % 6) / 220})`;
      b.fillRect(x, seed % PAPER_H, 1, 1);
    }
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.clear();
  }
  // The original engine already paints its seeded paper fibers underneath drawPage.
  clear() { this.ctx.clearRect(0, 0, PAPER_W, PAPER_H); this.hits = []; }
  text(t: string, x: number, y: number, size = 44, color = ink, font = 'FieldSerif', align: CanvasTextAlign = 'left') {
    const c = this.ctx;
    c.font = `${size}px ${font}, "Microsoft YaHei", serif`;
    c.fillStyle = color; c.textAlign = align; c.textBaseline = 'alphabetic';
    c.fillText(t, x, y); c.textAlign = 'left';
  }
  wrap(t: string, x: number, y: number, width: number, size = 44, color = ink, lineHeight = size * 1.6, font = 'FieldSerif') {
    let row = '', at = y;
    const startPunctuation = /[，。！？；：、）》」』】…]/;
    for (const ch of t) {
      if (ch === '\n') { this.text(row, x, at, size, color, font); row = ''; at += lineHeight; continue; }
      this.ctx.font = `${size}px ${font}, "Microsoft YaHei", serif`;
      if (this.ctx.measureText(row + ch).width > width && row && !startPunctuation.test(ch)) {
        this.text(row, x, at, size, color, font); row = ch; at += lineHeight;
      } else row += ch;
    }
    if (row) this.text(row, x, at, size, color, font);
    return at + lineHeight;
  }
  rule(y: number, x = 108, w = 1060) {
    this.ctx.strokeStyle = line; this.ctx.lineWidth = 1.6;
    this.ctx.beginPath(); this.ctx.moveTo(x, y); this.ctx.lineTo(x + w, y); this.ctx.stroke();
  }
  button(label: string, x: number, y: number, w: number, h: number, hit: Omit<PaperHit, 'x'|'y'|'w'|'h'|'label'> = {}, active = false, filled = false, size = 42) {
    const c = this.ctx;
    c.fillStyle = filled ? ink : active ? '#dce4d5' : '#faf3e5';
    c.strokeStyle = active ? '#5c847a' : '#bab59f'; c.lineWidth = active ? 3 : 1.8;
    c.beginPath(); c.roundRect(x, y, w, h, 8); c.fill(); c.stroke();
    c.font = `${size}px FieldSans, "Microsoft YaHei", sans-serif`;
    if (c.measureText(label).width < w - 36) this.text(label, x + w / 2, y + h / 2 + size * .35, size, filled ? '#fbf4df' : ink, 'FieldSans', 'center');
    else this.wrap(label, x + 28, y + h / 2 - size * .2, w - 56, size, filled ? '#fbf4df' : ink, size * 1.28, 'FieldSans');
    this.hits.push({ x, y, w, h, label, ...hit });
  }
  footer(number: string) {
    this.rule(1597);
    this.text('地球现场 · 海陆间的热力环流', 108, 1650, 26, muted, 'FieldSans');
    this.text(number, 1168, 1650, 32, muted, 'FieldSerif', 'right');
    this.hits.push({ x: 1120, y: 1585, w: 160, h: 115, kind: 'next', label: '下一跨页' });
    this.hits.push({ x: 0, y: 1585, w: 160, h: 115, kind: 'prev', label: '上一跨页' });
    this.texture.needsUpdate = true;
  }
  header(kicker: string, title: string) {
    this.text(kicker, 108, 126, 30, red, 'FieldSans');
    this.text(title, 108, 245, 66); this.rule(294);
  }
  left(p: Presentation) {
    this.clear(); const s = p.progress;
    if (s.spread === 2) { this.challenge(p); return; }
    if (s.spread === SPREAD.guide) { this.guide(false); return; }
    const chapter=chapterForSpread(s.spread);if(chapter){this.chapterLeft(p,chapter);return}
    if(s.spread===SPREAD.end){this.end(false);return}
    // Every Joule qr(): 12–50 mm margin, 56–172 mm text column.
    const x=377,w=782,c=this.ctx;
    this.text('第 1 课 · 海陆风',81,71,23,muted);this.rule(88,81,1077);
    this.text('第一课',x,177,25,red);this.text('海陆风',x,273,80);
    this.wrap('海边的风，为什么会转向？',x,362,w,38,ink,51);
    this.wrap('同一片海岸，午后吹来海风，夜间可能转为陆风。先看海陆的冷热。',x,435,w,33,muted,47);
    c.strokeStyle=line;c.lineWidth=1.6;c.strokeRect(x-13,570,w+13,163);
    this.text('冷热差异 → 空气升降',x+20,633,43);
    this.text('同高度气压差 → 水平气流',x+20,695,32,muted);
    this.text('关键词',x,804,24,red);
    [['温差','海陆升温、降温的快慢不同。'],['环流','上升、下沉和水平运动相联系。'],['风向','海风从海上来，陆风从陆上来。']].forEach(([term,copy],i)=>{
      this.text(term,x,858+i*53,30);this.text(copy,x+92,858+i*53,29,muted);
    });
    this.text('预测',x,1048,24,red);
    this.wrap('晴朗、背景风弱的午后，近地面的风从哪里来？',x,1097,w,33,ink,45);
    lesson.prediction.forEach((a,i)=>{
      const y=1190+i*58;c.strokeStyle=ink;c.lineWidth=1.8;c.strokeRect(x,y-26,27,27);
      if(s.prediction===i){c.strokeStyle='#273463';c.lineWidth=3;c.beginPath();c.moveTo(x+4,y-12);c.lineTo(x+12,y-3);c.lineTo(x+31,y-30);c.stroke()}
      this.text(a,x+47,y,30);
      this.hits.push({x:x-10,y:y-41,w:w+10,h:54,selector:`[data-predict="${i}"]`,label:a});
    });
    // These short answers sit physically beneath the original hinged flap.
    this.text('为什么？',x,1376,24,red);
    this.wrap('陆地热响应更快。午后陆侧较暖，上升；近地面由海向陆。夜间冷热关系改变，环流随之反向。',x,1424,w-15,31,ink,45);
    this.text('高低压只在同一高度比较。',x,1567,26,muted);
    const marginX=81;
    this.text('动手读图',marginX,464,24,red);
    ['预测','观察','动手','解释','挑战'].forEach((name,i)=>{
      const y=534+i*96;
      c.fillStyle=s.step===i?red:muted;c.beginPath();c.arc(marginX+8,y-10,s.step===i?5:2.5,0,Math.PI*2);c.fill();
      this.text(name,marginX+29,y,27,s.step===i?red:muted);
      this.hits.push({x:marginX-10,y:y-43,w:240,h:76,selector:`[data-step="${i}"]`,label:name});
    });
    if(s.step===0)this.link(s.prediction===null?'先观察':'展开海岸',marginX,1090,185,{selector:s.prediction===null?'[data-action="skip"]':'[data-step="1"]'},29);
    if(s.step===1){
      this.wrap(lesson.observationSteps[p.watchIndex].title,marginX,1070,240,29,ink,42);
      this.link('上一步',marginX,1140,110,{selector:'[data-action="watch-prev"]'},24);
      this.link(p.watchIndex===4?'动手':'下一步',marginX+120,1140,110,{selector:'[data-action="watch-next"]'},24);
      this.link(p.watchPlaying?'暂停':'播放',marginX,1201,210,{selector:'[data-action="watch-play"]'},26);
    }
    c.strokeStyle=line;c.lineWidth=2;c.setLineDash([5,7]);c.beginPath();c.arc(209,1346,86,0,Math.PI*2);c.stroke();c.setLineDash([]);
    if(complete(s)){this.text('完成',209,1360,40,red,'FieldSerif','center')}
    this.text('挑战',marginX,1480,24,red);
    this.wrap('让风转向，再画出夜间的环流。',marginX,1527,245,27,muted,39);
    this.hits.push({x:marginX-10,y:1438,w:265,h:135,selector:'[data-action="challenge"]',label:'去挑战'});
    this.folio('2',true);
  }
  right(p: Presentation, state: SeaBreezeDerivedState) {
    this.clear(); const s = p.progress;
    if (s.spread === 2) { this.records(p); return; }
    if (s.spread === SPREAD.guide) { this.guide(true); return; }
    const chapter=chapterForSpread(s.spread);if(chapter){this.chapterRight(p,chapter);return}
    if(s.spread===SPREAD.end){this.end(true);return}
    const hidden = s.step === 0 && !p.teacher;
    this.text('人教版地理必修一',1185,71,23,muted,'FieldSerif','right');this.rule(88,121,1064);
    if (p.layers.diagram) this.circulation(state, hidden, p);
    const c = this.ctx;
    c.strokeStyle=line;c.lineWidth=2;c.beginPath();c.moveTo(130,1390);c.lineTo(1146,1390);c.stroke();
    for(const t of [0,.25,.5,.75,1]){c.beginPath();c.moveTo(130+1016*t,1381);c.lineTo(130+1016*t,1399);c.stroke()}
    c.fillStyle=ink;c.beginPath();c.arc(130+1016*state.phase,1390,9,0,Math.PI*2);c.fill();
    this.hits.push({x:108,y:1355,w:1060,h:82,kind:'phase',label:'昼夜阶段'});
    this.link('夜间',108,1440,115,{selector:'[data-phase="0"]'},27);
    this.link('午后',576,1440,115,{selector:'[data-phase="0.5"]'},27);
    this.link(p.playing?'暂停':'播放',1050,1440,118,{selector:'#play'},27);
    this.text(`图 1  海陆间的热力环流${hidden?'':` · ${state.stage}`}`,121,1503,25,muted);
    this.link('冷热',710,1503,100,{kind:'layer',value:'thermal'},25,p.layers.thermal);
    this.link('气压',835,1503,100,{kind:'layer',value:'pressure'},25,p.layers.pressure);
    this.link('气流',960,1503,100,{kind:'layer',value:'flow'},25,p.layers.flow);
    this.link('二维',1085,1503,100,{kind:'layer',value:'diagram'},25,p.layers.diagram);
    this.text(hidden?'点播放，让海岸从纸面立起。':'拖动昼夜，留意风旗怎样转向。',121,1563,30,ink);
    this.link('温差：'+(s.input.contrast===1?'通常':s.input.contrast===.5?'减弱':'无'),121,1623,228,{kind:'contrast'},26);
    this.link('记下观察',406,1623,190,{selector:'[data-action="save-observation"]'},26);
    this.link('换个视角',656,1623,190,{kind:'view'},26);
    this.link('重置',909,1623,120,{selector:'[data-action="reset"]'},26);
    this.folio('3',false);
  }
  private link(label:string,x:number,y:number,w:number,hit:Omit<PaperHit,'x'|'y'|'w'|'h'|'label'>,size=29,active=false){
    this.text(label,x,y,size,active?ink:muted);
    if(active){const c=this.ctx;c.strokeStyle=line;c.lineWidth=1.4;c.beginPath();c.moveTo(x,y+7);c.lineTo(x+c.measureText(label).width,y+7);c.stroke()}
    this.hits.push({x:x-10,y:y-40,w:w+20,h:67,label,...hit});
  }
  private chapterLeft(p:Presentation,id:ChapterId){
    const s=p.progress.chapters[id],copy=chapterCopy[id],x=377,w=782,c=this.ctx,n=id==='water'?2:3;
    this.text(`第 ${n} 课 · ${copy.title}`,81,71,23,muted);this.rule(88,81,1077);
    this.text(copy.chapter,x,177,25,red);this.text(copy.title,x,273,id==='water'?80:66);
    this.wrap(copy.question,x,362,w,38,ink,51);this.wrap(copy.intro,x,435,w,33,muted,47);
    c.strokeStyle=line;c.lineWidth=1.6;c.strokeRect(x-13,570,w+13,163);
    this.text(copy.principle[0],x+20,633,id==='water'?39:37);this.text(copy.principle[1],x+20,695,31,muted);
    this.text('读图',x,804,24,red);
    this.wrap(id==='water'?'看水的去向，区分海陆间、陆地内与海上内三种循环。':'先找到颈部，再看新河道与旧弯道的联系怎样改变。',x,858,w,33,ink,51);
    this.text('预测',x,1048,24,red);this.wrap(copy.prediction,x,1097,w,33,ink,45);
    copy.options.forEach((text,i)=>{
      const y=1200+i*64;c.strokeStyle=ink;c.lineWidth=1.8;c.strokeRect(x,y-26,27,27);
      if(s.prediction===i){c.strokeStyle='#273463';c.lineWidth=3;c.beginPath();c.moveTo(x+4,y-12);c.lineTo(x+12,y-3);c.lineTo(x+31,y-30);c.stroke()}
      this.text(text,x+47,y,30);this.hits.push({x:x-10,y:y-41,w:w+10,h:57,kind:'chapter-predict',value:i,label:text});
    });
    // Printed explanation remains under the original hinged paper flap.
    this.text('为什么？',x,1376,24,red);this.wrap(copy.explanation,x,1424,w-15,30,ink,44);
    const mx=81;this.text('动手读图',mx,464,24,red);
    this.wrap(id==='water'?'换一种循环，追踪一滴水。':'拖动过程，盯住颈部。',mx,534,245,28,muted,42);
    this.link(s.revealed?'收回图画':'让图立起',mx,738,240,{kind:'chapter',value:'reveal'},30,s.revealed);
    this.link('检查读图',mx,852,240,{kind:'chapter',value:'answer'},30,s.checked);
    this.wrap(id==='water'?`${p.progress.chapters.water.visited.length} / 3 种循环`:`${p.progress.chapters.river.visited.length} / 2 处观察`,mx,957,245,27,muted,42);
    c.strokeStyle=line;c.lineWidth=2;c.setLineDash([5,7]);c.beginPath();c.arc(209,1135,86,0,Math.PI*2);c.stroke();c.setLineDash([]);
    if(chapterComplete(id,p.progress.chapters))this.text('完成',209,1149,40,red,'FieldSerif','center');
    this.text('教材',mx,1467,24,red);this.wrap(copy.source,mx,1515,245,26,muted,39);
    this.folio(String(n===2?6:8),true);
  }
  private chapterRight(p:Presentation,id:ChapterId){
    const s=p.progress.chapters[id];this.text('人教版地理必修一',1185,71,23,muted,'FieldSerif','right');this.rule(88,121,1064);
    const c=this.ctx,phase=s.phase;
    c.strokeStyle=line;c.lineWidth=2;c.beginPath();c.moveTo(130,1390);c.lineTo(1146,1390);c.stroke();
    for(const t of [0,.25,.5,.75,1]){c.beginPath();c.moveTo(130+1016*t,1381);c.lineTo(130+1016*t,1399);c.stroke()}
    c.fillStyle=ink;c.beginPath();c.arc(130+1016*phase,1390,9,0,Math.PI*2);c.fill();
    this.hits.push({x:108,y:1355,w:1060,h:82,kind:'chapter-phase',label:id==='water'?'沿路径观察':'河曲成湖过程'});
    if(id==='water'){
      const water=p.progress.chapters.water,derived=evaluateWater(water);
      waterModes.forEach((mode,i)=>this.link(mode,121+i*357,1453,332,{kind:'water-mode',value:i},29,water.mode===mode));
      this.text('图 2  水循环',121,1514,25,muted);
      this.link(p.playing?'暂停':'播放',984,1514,120,{kind:'chapter',value:'play'},27,p.playing);
      const focused=waterPaths.find(q=>q.id===derived.focus);
      this.text(s.revealed?(focused?.note??'点选一个环节，再沿箭头看去向。'):'点播放，让水循环从纸面立起。',121,1571,29,ink);
      derived.paths.forEach((path,i)=>this.link(path.label,121+i*178,1631,155,{kind:'water-process',value:path.id},23,derived.focus===path.id));
    }else{
      const river=evaluateRiver(phase);
      this.link('河曲',121,1453,200,{kind:'river-stage',value:0},29,phase<.3);
      this.link('颈部冲断',390,1453,240,{kind:'river-stage',value:.52},29,phase>=.3&&phase<.63);
      this.link('新河道贯通',675,1453,260,{kind:'river-stage',value:.78},29,phase>=.63&&phase<.94);
      this.link('牛轭湖',1014,1453,170,{kind:'river-stage',value:1},29,phase>=.94);
      this.text(`图 3  ${river.stage}`,121,1514,25,muted);this.link(p.playing?'暂停':'播放',984,1514,120,{kind:'chapter',value:'play'},27,p.playing);
      this.text(s.revealed?(river.connected?'看颈部怎样贯通，旧弯道是否仍相连。':'旧弯道留在原处，主河道已取直。'):'点播放，让河曲从纸面立起。',121,1571,29,ink);
      this.text('理想化事件；并非每个河曲都会成湖。',121,1631,26,muted);
    }
    this.folio(id==='water'?'7':'9',false);
  }
  private end(right:boolean){
    if(right){this.text('人教版地理必修一',1185,71,23,muted,'FieldSerif','right');this.rule(88,121,1064);this.text('把图读懂，再去看真实的世界。',640,800,47,ink,'FieldSerif','center');this.link('重新翻开',440,990,500,{selector:'[data-action="reopen"]'},35);this.folio('13',false)}
    else{this.header('本次收录','三幅会动的地理图');['第二章 · 海陆风','第三章 · 水循环','第四章 · 河曲与牛轭湖'].forEach((t,i)=>this.link(t,108,490+i*230,1060,{kind:'goto',value:[1,3,4][i]},46));this.wrap('本版本是三课交互改编，并非整册内容。',108,1370,1000,34,muted,56);this.folio('12',true)}
  }
  private folio(n:string,left:boolean){
    this.text(n,left?81:1185,1660,25,muted,'FieldSerif',left?'left':'right');
    this.hits.push({x:left?0:1140,y:1620,w:140,h:80,kind:left?'prev':'next',label:left?'上一跨页':'下一跨页'});
    this.texture.needsUpdate=true;
  }
  private answer(label:string,x:number,y:number,w:number,hit:Omit<PaperHit,'x'|'y'|'w'|'h'|'label'>,correct=false,wrong=false,size=35){
    const c=this.ctx;c.strokeStyle=wrong?red:line;c.lineWidth=1.6;
    c.beginPath();c.moveTo(x,y+20);c.lineTo(x+w,y+20);c.stroke();
    this.text(label,x+5,y,size,wrong?red:ink);
    if(correct)this.text('✓',x+w-8,y,29,muted,'FieldSans','right');
    this.hits.push({x:x-10,y:y-51,w:w+20,h:85,label,...hit});
  }
  private arrow(x1: number, y1: number, x2: number, y2: number, color = ink) {
    const c = this.ctx, a = Math.atan2(y2-y1, x2-x1);
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 7;
    c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke();
    c.beginPath(); c.moveTo(x2,y2); c.lineTo(x2-24*Math.cos(a-.45),y2-24*Math.sin(a-.45)); c.lineTo(x2-24*Math.cos(a+.45),y2-24*Math.sin(a+.45)); c.closePath(); c.fill();
  }
  private circulation(state: SeaBreezeDerivedState, hidden: boolean, p: Presentation) {
    const c = this.ctx;
    c.fillStyle = '#b0c9c8'; c.fillRect(150, 932, 490, 70);
    c.fillStyle = '#d8c292'; c.fillRect(640, 932, 490, 70);
    this.text('海洋', 375, 1050, 40, ink, 'FieldSerif', 'center'); this.text('陆地', 885, 1050, 40, ink, 'FieldSerif', 'center');
    if (hidden) { this.text('先留下你的预测', 640, 735, 46, muted, 'FieldSerif', 'center'); return; }
    const reveal = p.progress.step === 1 ? p.watchIndex : 4;
    if (p.layers.thermal) {
      this.text(state.seaThermal, 375, 901, 37, state.direction < 0 ? red : ink, 'FieldSans', 'center');
      this.text(state.landThermal, 885, 901, 37, state.direction > 0 ? red : ink, 'FieldSans', 'center');
    }
    if (p.layers.pressure && reveal >= 2) {
      c.setLineDash([12,10]); this.rule(570, 165, 950); this.rule(838,165,950); c.setLineDash([]);
      this.text(state.pressure.seaUpper, 375, 540, 36, ink, 'FieldSans', 'center'); this.text(state.pressure.landUpper, 885, 540, 36, ink, 'FieldSans', 'center');
      this.text(state.pressure.seaGround, 375, 820, 36, ink, 'FieldSans', 'center'); this.text(state.pressure.landGround, 885, 820, 36, ink, 'FieldSans', 'center');
    }
    if (p.layers.flow && state.direction && reveal >= 1) {
      const d = state.direction;
      this.arrow(225, d > 0 ? 620 : 755, 225, d > 0 ? 755 : 620);
      this.arrow(1060, d > 0 ? 755 : 620, 1060, d > 0 ? 620 : 755);
      if (reveal >= 3) { this.arrow(d > 0 ? 470 : 810,760,d > 0 ? 810 : 470,760); this.arrow(d > 0 ? 810 : 470,610,d > 0 ? 470 : 810,610); }
    }
    if (!state.direction) this.text('局地环流分量很弱',640,718,44,muted,'FieldSerif','center');
  }
  challenge(p: Presentation) {
    const s = p.progress; this.header('挑战  /  01','夜间，风怎样走？');
    this.text('夜间，补全海陆间的环流。',108,370,38,muted);
    const c = this.ctx;
    c.setLineDash([12,12]); this.rule(665,130,1020); this.rule(1023,130,1020); c.setLineDash([]);
    c.strokeStyle=ink;c.lineWidth=2;c.beginPath();c.moveTo(108,1260);c.lineTo(1168,1260);c.stroke();
    for(let i=0;i<6;i++){c.beginPath();c.moveTo(130,1281+i*7);c.bezierCurveTo(260,1271+i*7,420,1291+i*7,603,1281+i*7);c.stroke()}
    for(let x=665;x<1160;x+=18){c.beginPath();c.moveTo(x,1263);c.lineTo(x-17,1292);c.stroke()}
    this.text('海 洋',370,1332,36,ink,'FieldSerif','center'); this.text('陆 地',910,1332,36,ink,'FieldSerif','center');
    c.strokeStyle=line;c.lineWidth=2;c.beginPath();c.moveTo(270,700);c.lineTo(1005,700);c.lineTo(1005,1080);c.lineTo(270,1080);c.closePath();c.stroke();
    const positions = [[130,1137,430],[720,1137,430],[130,884,430],[720,884,430],[130,510,430],[720,510,430],[445,1000,390],[445,650,390],[120,746,310],[850,746,310]];
    lesson.challenge.forEach((q,i) => {
      const [x,y,w]=positions[i];
      this.text(q.label,x,y-18,26,muted);
      this.answer(s.diagram[i] || '点击填写', x,y+36,w,{kind:'diagram',value:i},s.checked&&s.diagram[i]===q.answer,s.checked&&s.diagram[i]!==q.answer,33);
    });
    this.link('检查环流图',108,1450,380,{selector:'[data-action="check-diagram"]'},35);
    this.link('提示',980,1450,160,{selector:'[data-action="hint"]'},31);
    this.text(s.checked?`已完成 ${s.diagram.filter((v,i)=>v===lesson.challenge[i].answer).length} / 10`:'先比冷热，再看气压与气流。',108,1550,29,muted);
    this.folio('4',true);
  }
  records(p: Presentation) {
    const s=p.progress; this.header('记录与迁移  /  02','给结论留一份证据');
    let y=369;
    ['午后','夜间','无温差'].forEach(k=>{
      const o=s.observations.find(o=>o.kind===k);
      this.text(k,108,y,39,red); this.text(o?o.ground:'还缺这份观察',345,y,42,o?ink:muted);
      this.rule(y+42); y+=132;
    });
    this.link('回到海岸',108,750,380,{selector:'[data-action="experiment"]'},31);
    transfer.forEach((q,i)=>{
      const top=908+i*179;
      const questions=['海在右、陆在左，午后风往哪吹？','能直接比较不同高度的相对气压吗？','太阳落山，风一定立即转向吗？'];
      this.text(`${i+1}. ${questions[i]}`,108,top,34);
      const value=s.transfer[i];
      this.answer(value<0?'点击作答':q.options[value],108,top+75,1060,{kind:'transfer',value:i},s.transferChecked&&value===q.answer,s.transferChecked&&value!==q.answer,30);
    });
    this.link('检查判断',108,1530,310,{selector:'[data-action="check-transfer"]'},32);
    this.link('结论',520,1530,180,{kind:'conclusion'},32,!!s.conclusion);
    this.link('打印记录',858,1530,310,{selector:'[data-action="print"]'},32,complete(s));
    if(complete(s)) {
      this.ctx.save();this.ctx.translate(1067,172);this.ctx.rotate(-.15);this.ctx.strokeStyle=red;this.ctx.lineWidth=4;this.ctx.strokeRect(-96,-68,192,126);
      this.text('练习完成',0,-6,34,red,'FieldSerif','center');this.text('观察 · 迁移',0,38,24,red,'FieldSans','center');this.ctx.restore();
    }
    this.folio('5',false);
  }
  guide(right: boolean) {
    this.header(right?'来源与边界  /  04':'教师手册  /  03',right?'知道它从哪里来':'把问题留给学生');
    let y=402;
    if (right) {
      this.text('人教版《地理 必修 第一册》',108,y,45);y+=90;
      y=this.wrap('36、38 页：热力环流与海陆风。\n46—49 页、图 3.2：水循环。\n70 页、图 4.8：河曲与牛轭湖。',108,y,1060,39,ink,65)+45;
      this.text('参考 Every Joule 的书本机制',108,y,45);y+=90;
      y=this.wrap('直接改编 Techartist 的书本、纸张、笔触与展开代码。参考版本 48591dd。',108,y,1060,43,ink,73)+65;
      this.text('模型的边界',108,y,48,red);y+=90;
      y=this.wrap('海陆风显示理想化局地环流；水循环路径不表示水量和速度；河曲页只演示一次可能发生的截弯成湖事件。',108,y,1060,39,ink,65)+45;
      this.wrap('示意模型不作为真实天气、流量或地貌演变预报。',108,y,1060,38,red,63);
      this.link('完整来源与模型说明',108,1510,1000,{kind:'read'},35);
    } else {
      for(const [i,t] of lesson.learningObjectives.entries()) y=this.wrap(`${i+1}. ${t}`,108,y,1060,44,ink,68)+30;
      this.text('3—5 分钟，演示一个因果链',108,y+15,47,red);
      y=this.wrap('先隐藏气流，让学生预测。逐步显示冷热、升降、气压与水平运动。切到夜间，再缓慢经过转向区。',108,y+110,1060,46,ink,76)+65;
      this.wrap('教师演示独立运行，不写入学生记录。',108,y,1060,43,muted,68);
      this.link('教师演示',108,1510,760,{selector:'[data-action="teacher"]'},35);
    }
    this.folio(right?'11':'10',!right);
  }
  cover(back=false,resume=false) {
    const c=this.ctx;this.hits=[];c.fillStyle='#294b4c';c.fillRect(0,0,PAPER_W,PAPER_H);
    let seed=83;for(let i=0;i<30000;i++){seed=(seed*16807)%2147483647;const x=seed%PAPER_W;seed=(seed*16807)%2147483647;c.fillStyle=`rgba(228,218,178,${(seed%8)/250})`;c.fillRect(x,seed%PAPER_H,1,3)}
    c.strokeStyle='#b7b48b';c.lineWidth=2;c.strokeRect(86,86,1108,1528);c.strokeRect(101,101,1078,1498);
    this.text('高中地理 · 自然地理实验手册',640,243,35,'#c9c7a6','FieldSans','center');
    this.text(back?'下一阵风，':'人教版地理必修一',640,450,78,'#eddfb6','FieldSerif','center');
    this.text(back?'你会怎样解释？':'海边的风，',640,635,69,'#eddfb6','FieldSerif','center');
    if(!back)this.text('为什么会转向？',640,735,69,'#eddfb6','FieldSerif','center');
    c.strokeStyle='#d4d0ab';c.lineWidth=3;
    for(let k=0;k<4;k++){c.beginPath();for(let x=220;x<750;x+=8){const y=1030+k*42+Math.sin(x*.018)*13;if(x===220)c.moveTo(x,y);else c.lineTo(x,y)}c.stroke()}
    c.beginPath();c.moveTo(730,1160);c.lineTo(730,980);c.lineTo(855,900);c.lineTo(1020,1010);c.stroke();
    this.arrow(300,905,690,905,'#d4d0ab');this.arrow(960,835,570,835,'#d4d0ab');
    this.button(back?'重新翻开':resume?'继续学习':'翻开这本书',250,1340,780,130,{selector:back?'[data-action="reopen"]':'#start'},false,false,52);
    this.text('一课 · 三张跨页 · 本地学习',640,1545,33,'#c9c7a6','FieldSans','center');
    this.texture.needsUpdate=true;
  }
  snapshot() {
    const c=document.createElement('canvas');c.width=PAPER_W;c.height=PAPER_H;c.getContext('2d')!.drawImage(this.canvas,0,0);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
  }
  dispose(){this.texture.dispose();}
}
