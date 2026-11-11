/** Textbook figures expressed as shared data for the printed, 3D and SVG views. */
export const SPREAD = { cover: 0, coast: 1, challenge: 2, water: 3, river: 4, guide: 5, end: 6 } as const;
export const spreadTitles = ['人教版地理必修一', '海陆风', '挑战与记录', '水循环', '河曲与牛轭湖', '教师与来源', '书末'];
export type ChapterId = 'water' | 'river';
export type WaterMode = '海陆间循环' | '陆地内循环' | '海上内循环';
export const waterModes: WaterMode[] = ['海陆间循环', '陆地内循环', '海上内循环'];
export type WaterProcess = 'evapSea' | 'transport' | 'rainLand' | 'runoff' | 'infiltration' | 'groundwater' | 'evapLand' | 'transpiration' | 'rainSea';
export interface Point { x: number; y: number; z: number }
export const point = (x: number, y: number, z: number): Point => ({ x, y, z });
export interface WaterPath { id: WaterProcess; label: string; points: Point[]; note: string }
export const waterPaths: WaterPath[] = [
  {id:'evapSea', label:'海面蒸发', points:[point(143,9,-34),point(145,28,-37),point(141,52,-47)], note:'海水蒸发，水汽进入大气。'},
  {id:'transport', label:'水汽输送', points:[point(135,60,-51),point(103,64,-56),point(62,61,-60)], note:'气流把海洋上空的水汽带到陆地。'},
  {id:'rainLand', label:'降水', points:[point(43,52,-63),point(43,37,-65),point(43,23,-66)], note:'水汽在一定条件下形成降水，落到陆地。'},
  {id:'runoff', label:'地表径流', points:[point(45,23,-65),point(62,17,-58),point(75,14,-45),point(89,12,-37),point(111,9,-34)], note:'水沿地表汇流，流入河流，最终回到海洋。'},
  {id:'infiltration', label:'下渗', points:[point(59,16,-21.7),point(59,8,-21.7),point(61,1,-21.7)], note:'部分水进入土壤和岩石空隙。'},
  {id:'groundwater', label:'地下径流', points:[point(61,1,-21.7),point(79,1,-21.7),point(99,1,-21.7),point(116,5,-21.7)], note:'下渗的水还可能沿地下路径回到海洋。'},
  {id:'evapLand', label:'陆面蒸发', points:[point(73,15,-43),point(70,33,-47),point(62,54,-58)], note:'陆地水面和地面的水也会蒸发。'},
  {id:'transpiration', label:'植物蒸腾', points:[point(28,27,-77),point(29,40,-72),point(36,53,-66)], note:'植物通过蒸腾向大气释放水汽。'},
  {id:'rainSea', label:'海上降水', points:[point(151,51,-54),point(153,30,-54),point(154,9,-53)], note:'海洋上空的水汽形成降水，又落回海洋。'},
];
const waterRoutes: Record<WaterMode, WaterProcess[]> = {
  '海陆间循环': ['evapSea','transport','rainLand','runoff','infiltration','groundwater'],
  '陆地内循环': ['evapLand','transpiration','rainLand','infiltration'],
  '海上内循环': ['evapSea','rainSea'],
};
export interface WaterProgress {
  revealed: boolean; prediction: number | null; mode: WaterMode; focus: WaterProcess | null;
  phase: number; visited: WaterMode[]; answer: number | null; firstAnswer: number | null; checked: boolean; edits: number;
}
export interface RiverProgress {
  revealed: boolean; prediction: number | null; phase: number; visited: string[];
  answer: number | null; firstAnswer: number | null; checked: boolean; edits: number;
}
export interface ChaptersProgress { water: WaterProgress; river: RiverProgress }
export function initialChapters(): ChaptersProgress {
  return {
    water: {revealed:false,prediction:null,mode:waterModes[0],focus:null,phase:0,visited:[],answer:null,firstAnswer:null,checked:false,edits:0},
    river: {revealed:false,prediction:null,phase:0,visited:[],answer:null,firstAnswer:null,checked:false,edits:0},
  };
}
export const chapterForSpread = (n:number): ChapterId | null => n===SPREAD.water?'water':n===SPREAD.river?'river':null;
export function evaluateWater(input: Pick<WaterProgress,'mode'|'focus'|'phase'>) {
  const mode=waterModes.includes(input.mode)?input.mode:waterModes[0];
  const active=waterRoutes[mode];
  return {mode, phase:((input.phase%1)+1)%1, active, paths:waterPaths.filter(p=>active.includes(p.id)), focus:active.includes(input.focus!)?input.focus:null};
}
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const smooth=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t)};
/** Interpolation changes an illustrative event sequence, never a physical clock. */
export function evaluateRiver(value:number) {
  const phase=clamp(value),cut=smooth(.3,.63,phase),isolation=smooth(.7,.94,phase);
  const stage=phase<.3?'河曲':phase<.63?'洪水冲断颈部':phase<.94?'新河道贯通':'牛轭湖';
  return {phase,cut,isolation,stage,connected:isolation<.99,mainRoute:cut<.75?'弯曲河道':'取直河道'};
}
export const riverUpstream=[point(15,11,-25),point(34,11,-30),point(54,11,-42),point(72,11,-54)];
export const riverBend=[point(72,11,-54),point(100,11,-36),point(136,11,-40),point(152,11,-59),point(145,11,-83),point(121,11,-103),point(93,11,-99),point(76,11,-83),point(70,11,-66)];
export const riverDownstream=[point(70,11,-66),point(56,11,-84),point(35,11,-104),point(14,11,-112)];
export const riverShortcut=[point(72,11,-54),point(71,11,-60),point(70,11,-66)];
/** Uniform Catmull–Rom, shared by the 3D strips, ink edges and 2D diagrams. */
export function samplePath(points:Point[],t:number):Point {
  const n=points.length-1,k=clamp(t)*n,i=Math.min(n-1,Math.floor(k)),u=k-i;
  const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(n,i+2)];
  const value=(key:keyof Point)=>.5*((2*p1[key])+(-p0[key]+p2[key])*u+(2*p0[key]-5*p1[key]+4*p2[key]-p3[key])*u*u+(-p0[key]+3*p1[key]-3*p2[key]+p3[key])*u*u*u);
  return point(value('x'),value('y'),value('z'));
}
export function chapterComplete(id:ChapterId,p:ChaptersProgress) {
  return id==='water'?p.water.checked&&p.water.answer===0&&waterModes.every(m=>p.water.visited.includes(m)):
    p.river.checked&&p.river.answer===1&&['河曲','牛轭湖'].every(s=>p.river.visited.includes(s));
}
export const chapterCopy = {
  water: {
    title:'水循环', chapter:'第三章 · 地球上的水', source:'正文 46—49 页 · 图 3.2',
    question:'落到陆地的雨，怎样回到海洋？',
    intro:'沿着图中的水路走一遍。海洋在右，山地在左。',
    principle:['蒸发（蒸腾）→ 水汽 → 降水','地表与地下，都有回到海洋的路。'],
    prediction:'海洋蒸发的水，只会落回海洋吗？',
    options:['只会落回海洋。','还可能被输送到陆地。'],
    explanation:'海面蒸发的水汽可被气流带到陆地，形成降水。水既可沿地表汇流，也可下渗后形成地下径流，最终回到海洋。',
    caution:'路径与示踪点都是示意，不表示水量比例或实际速度。',
    check:'陆地降水回到海洋，可以经过哪条路？',
    answers:['地表径流或地下径流。','只能经过地表径流。','只能重新蒸发。'],
    feedback:'比较地表与地下两条回程。地下径流同样是海陆间循环的环节。',
  },
  river: {
    title:'河曲与牛轭湖',chapter:'第四章 · 地貌',source:'正文 70 页 · 图 4.8',
    question:'一段弯曲的河，怎样留下一片湖？',
    intro:'观察平缓地区的河曲。把视线放在弯道颈部。',
    principle:['洪水冲断颈部 → 河道取直','旧弯道与主河分离，留下牛轭湖。'],
    prediction:'洪水冲断颈部后，主河道更可能怎样走？',
    options:['沿较短的新河道通过。','仍只沿完整的旧弯道流动。'],
    explanation:'在一定条件下，洪水可能冲断河曲颈部。新河道贯通，旧弯道两端逐渐淤堵，与主河道分离，形成牛轭湖。',
    caution:'一次理想化事件；并非每个河曲都会成湖，滑块不表示真实年数。',
    check:'图中成湖之后，哪一项描述正确？',
    answers:['所有河曲都会按同样过程成湖。','旧弯道已与取直后的主河道分离。','湖中水仍按主河道速度持续流动。'],
    feedback:'看新水路是否贯通，再看旧弯道的两个入口。形成条件和经历时间各地不同。',
  },
};
