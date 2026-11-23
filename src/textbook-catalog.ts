import { PLANET_NAMES } from './textbook-astronomy-model';
import { additionalFigures, type AdditionalEffect } from './textbook-catalog-additions';
import { REMOTE_PROCESS_STOPS } from './textbook-remote-model';
import { AIR_PROCESS_STOPS } from './textbook-air-process-model';
import { ATMOSPHERE_STOPS } from './textbook-atmosphere-model';
import { FOREST_STOPS } from './textbook-forest-model';
import { CURRENT_STOPS } from './textbook-current-model';
import { SOLAR_HEATING_STOPS } from './textbook-solar-heating-model';
import { TYPHOON_STOPS } from './textbook-typhoon-model';
import { TEMPERATURE_STOPS } from './textbook-temperature-model';
import { SLOPE_STOPS } from './textbook-slope-model';
import { integratedFigures } from './textbook-catalog-integrated';
import type { IntegratedEffect } from './textbook-integrated-model';
/** Page numbers and wording follow the locally verified PEP textbook. */
export const TITLE = '人教版地理必修一';
export const PAGE_W = 612.28302;
export const PAGE_H = 858.89801;
export const LAST_PDF = 133;
/** The source ends at printed p.124, followed by four unnumbered leaves. */
export const LAST_PRINTED_PAGE = 124;
export const SPREADS = 67;
export const pageUrl = (pdf:number,thumb=false) => `${import.meta.env.BASE_URL}textbook/${thumb?'thumb':'page'}-${String(pdf).padStart(3,'0')}.webp`;
export const pdfAt = (spread:number,side:'left'|'right'):number|null => {
  const n=side==='left'?spread*2-1:spread*2;
  return spread>0&&n>=2&&n<=LAST_PDF?n:null;
};
export const spreadAt = (pdf:number) => Math.ceil(pdf/2);
export const numberedPage = (pdf:number):number|null => pdf>=6&&pdf<=LAST_PRINTED_PAGE+5?pdf-5:null;
export const printedPage = (pdf:number) => pdf>LAST_PRINTED_PAGE+5?`书末留白 ${pdf-LAST_PRINTED_PAGE-5}`:pdf>=6?String(pdf-5):pdf===4?'目录 1':pdf===5?'目录 2':pdf===2?'扉页':'版权页';
export function spreadPageLabel(spread:number):string {
  if(spread===0)return '封面';
  const pages=(['left','right'] as const).map(side=>pdfAt(spread,side)).filter((pdf):pdf is number=>pdf!==null);
  const blanks=pages.filter(pdf=>pdf>LAST_PRINTED_PAGE+5);
  if(blanks.length){
    const numbers=pages.map(numberedPage).filter((n):n is number=>n!==null);
    return numbers.length?`${numbers.join('—')} · 留白`:`留白 ${blanks.map(pdf=>pdf-LAST_PRINTED_PAGE-5).join('—')}`;
  }
  return pages.map(printedPage).join('—');
}
export interface Section { title:string; page:number; type?:'study'|'appendix' }
export const contents: {title:string;page:number;sections:Section[]}[] = [
  {title:'第一章　宇宙中的地球',page:1,sections:[{title:'第一节　地球的宇宙环境',page:2},{title:'第二节　太阳对地球的影响',page:8},{title:'第三节　地球的历史',page:14},{title:'第四节　地球的圈层结构',page:21},{title:'问题研究　火星基地应该是什么样子',page:25,type:'study'}]},
  {title:'第二章　地球上的大气',page:27,sections:[{title:'第一节　大气的组成和垂直分层',page:28},{title:'第二节　大气受热过程和大气运动',page:34},{title:'问题研究　何时“蓝天”常在',page:42,type:'study'}]},
  {title:'第三章　地球上的水',page:45,sections:[{title:'第一节　水循环',page:46},{title:'第二节　海水的性质',page:50},{title:'第三节　海水的运动',page:57},{title:'问题研究　能否淡化海冰缓解环渤海地区淡水短缺问题',page:63,type:'study'}]},
  {title:'第四章　地貌',page:65,sections:[{title:'第一节　常见地貌类型',page:66},{title:'第二节　地貌的观察',page:76},{title:'问题研究　如何提升我国西南喀斯特峰丛山地的经济发展水平',page:79,type:'study'}]},
  {title:'第五章　植被与土壤',page:81,sections:[{title:'第一节　植被',page:82},{title:'第二节　土壤',page:88},{title:'问题研究　如何让城市不再“看海”',page:96,type:'study'}]},
  {title:'第六章　自然灾害',page:99,sections:[{title:'第一节　气象灾害',page:100},{title:'第二节　地质灾害',page:106},{title:'第三节　防灾减灾',page:110},{title:'第四节　地理信息技术在防灾减灾中的应用',page:114},{title:'问题研究　救灾物资储备库应该建在哪里',page:120,type:'study'}]},
  {title:'附录',page:122,sections:[{title:'附录一　本书主要地理词汇中英文对照表',page:122,type:'appendix'},{title:'附录二　本套书常用地图图例',page:124,type:'appendix'}]},
];
export function sectionAt(pdf:number) {
  const page=pdf-5;
  const ch=[...contents].reverse().find(c=>page>=c.page);
  return ch?.sections.slice().reverse().find(s=>page>=s.page)?.title??ch?.title??TITLE;
}
export type Effect = AdditionalEffect | IntegratedEffect | 'orbit'|'radiation'|'strata'|'spheres'|'atmosphere'|'heat'|'circulation'|'breeze'|'pressure'|'water'|'temperature'|'wave'|'tide'|'current'|'karst'|'river'|'slope'|'forest'|'soil'|'typhoon'|'quake'|'landslide'|'rescue'|'remote'|'gis';
export interface Figure {
  id:string; pdf:number; title:string; effect:Effect;
  /** Supplemental experiments retain explicit attribution to source pages. */
  extension?:boolean;
  sourcePages?:readonly number[];
  /** Independent action flags may use more values than a condition list. */
  selectionLimit?:number;
  /** Original page fractions, x/y from its top left. Caption is excluded. */
  rect:[number,number,number,number];
  photo?:boolean;
  /** Text-origin demonstrations keep the paragraph untouched and open from a margin marker. */
  origin?:'text';
  marker?:[number,number];
  /** Local crop fractions that remain on the original page (captions, prose). */
  keepOnPage?:[number,number,number,number][];
  controls?:string[];
  /** Named stops within one continuous process, rather than separate scenes. */
  controlPhases?:number[];
  /** A progressive process stops at its end instead of silently reversing history. */
  playback?:'once';
  /** Independent condition trials share an initial state and replay on change. */
  restartOnSelection?:boolean;
  /** Only shown by an explicit information request. Never printed onto the page. */
  note:string;
}
export const figures:Figure[] = [
 {id:'solar',pdf:8,title:'图1.4　太阳系结构',effect:'orbit',rect:[.122,.548,.57,.285],photo:true,controls:['整体',...PLANET_NAMES],note:'摇动木柄带动八颗行星，松手停住，反摇回看。拨动选星盘，从 1 到 8 依次选中水星至海王星，0 位回到整体。扳开红柄可观察所选支臂的轮副，再扳合可看全貌。从太阳系北侧看，八颗行星均逆时针公转。模型的大小、距离和转速均为示意。'},
 {id:'sun',pdf:14,title:'图1.14　家庭太阳能供热系统',effect:'radiation',rect:[.122,.506,.267,.163],controls:SOLAR_HEATING_STOPS.map(s=>s.label),controlPhases:SOLAR_HEATING_STOPS.map(s=>s.phase),playback:'once',note:'依正文9页图1.14，在同一剖面房屋中连续观察太阳短波到达、集热器吸收、水路循环和室内供热。点击太阳、集热器、水泵或散热器定位，也可拖动前缘纸签回看。辐射示踪与水体示踪分别保留身份，不把光变成水；共享储存池与水路为教学简化，不增加光伏板或换热设备。进度表示讲解顺序，不是实测水温、流速、效率或设备安装方案。'},
 {id:'history',pdf:20,title:'图1.23　A、B两地地层对比',effect:'strata',rect:[.17,.089,.477,.151],photo:true,controls:['同时代地层','分层查看'],note:'保留原图A、B两柱的六层与可辨化石形态。点层体、化石或短标签查看对应组合；另一柱未画出对应组合时不虚配。拖动间距手柄展开地层，层间距不表示地质时间等距；印痕不作物种鉴定。'},
 {id:'earth',pdf:27,title:'图1.34　地球内部地震波传播速度与圈层结构',effect:'spheres',rect:[.347,.087,.642,.283],controls:['完整','地壳','地幔','地核'],note:'以原图的圈层顺序展示地球内部结构，不把模型宽度当作真实厚度比例。'},
 {id:'atmosphere',pdf:36,title:'图2.5　大气的垂直分层',effect:'atmosphere',rect:[.12,.205,.544,.595],photo:true,controls:ATMOSPHERE_STOPS.map(s=>s.label),controlPhases:ATMOSPHERE_STOPS.map(s=>s.phase),playback:'once',note:'依教材31—32页图2.5，在同一个三层剖面中上下拖动探针，观察位置、温度曲线读点和旁注一起变化；点层体或标签定位观察高度。三层始终保留，进度是观察高度，不是气象时间。温度曲线只保留定性趋势，高层大气先降后升，顶部是教学窗口而不是大气边缘；不显示未标定的高度和气温。对流层以垂直运动为主、平流层以水平运动为主，不把“为主”理解为排除其他运动。'},
 {id:'heating',pdf:39,title:'图2.9　大气的受热过程',effect:'heat',rect:[.11,.58,.51,.244],controls:AIR_PROCESS_STOPS.heat.map(s=>s.label),controlPhases:AIR_PROCESS_STOPS.heat.map(s=>s.phase),playback:'once',note:'依教材34页图2.9，同一地面剖面依次显现太阳短波到达、地面增温、地面长波与近地面大气吸收，前一步结果保留。进度是讲解显现顺序，不是气象时间或定量能量收支；没有按比例量化太阳辐射的吸收与反射。大气逆辐射在下一图讨论，不在本图增加箭头。可点太阳、地面、长波箭带和空气层定位，也可拖动前缘手柄回看。'},
 {id:'thermal',pdf:41,title:'图2.11　大气热力环流的形成',effect:'circulation',rect:[.108,.414,.405,.412],controls:AIR_PROCESS_STOPS.circulation.map(s=>s.label),controlPhases:AIR_PROCESS_STOPS.circulation.map(s=>s.phase),playback:'once',note:'中央铜盘由酒精灯加热，两侧为冰水槽。白色烟迹示意空气的运动方向。依教材36页图2.11，在同一个B冷—A暖—C冷剖面中连续显现冷热差、垂直运动、同高相对气压与完整环流。仅在同一高度比较相对气压；垂直运动依据冷热与浮力解释。分步显现是讲解顺序，不表示真实大气分成互不重叠的时段。可点对象定位或拖动前缘手柄回看。'},
 {id:'breeze',pdf:43,title:'海陆间的大气热力环流',effect:'breeze',rect:[.12,.443,.65,.125],controls:['白天','夜晚'],note:'依据本页活动和热力环流原理展开完整海岸场景，陆地在左、海洋在右。昼夜滑块连续改变冷热关系；气压、空中环流和风旗读取同一模型。高低压只在同一高度比较。地形、建筑、空气箭带都是三维几何。晴朗且背景风较弱时的示意，不表示实测气温、风速或精确转向时刻。'},
 {id:'pressure-wind',pdf:43,title:'大气的水平运动——风',effect:'pressure',origin:'text',marker:[.86,.73],rect:[.14,.69,.59,.17],controls:['存在气压差','气压相同'],note:'依据本页“大气的水平运动——风”正文建立空间演示，不替换或改写原文。气压只在同一高度比较；在仅受水平气压梯度力的理想条件下，空气由高压区流向低压区。气压相同表示这个理想分量为零，并非真实大气一定无风。地转偏向力与摩擦力在下一页继续学习。'},
 {id:'water',pdf:52,title:'图3.2　水循环示意',effect:'water',rect:[0,.475,1,.415],keepOnPage:[[.119,.853,.155,.045]],controls:['海陆间循环','陆地内循环','海上内循环'],playback:'once',restartOnSelection:true,note:'依教材46—47页图3.2，拖动前缘纸签追踪同一批水的蒸发、输送、降水与返回。三种循环是独立类型，选项用于切换对照，各类型内部的节点用于定位进度；它们不表示先后演变。示踪数量、分流和时间均为教学示意，不表示水量比例、实际流速或完整水量收支。陆地内循环不将水送入海洋，海上内循环不越过海岸；完成后示踪留在接收水体。'},
 {id:'temperature',pdf:55,title:'图3.8　海水温度随深度的变化',effect:'temperature',rect:[.083,.574,.283,.276],controls:TEMPERATURE_STOPS.map(s=>s.label),controlPhases:TEMPERATURE_STOPS.map(s=>s.phase),playback:'once',note:'依正文50页图3.8，在原页上方观察一个固定的海水剖面；拖动深度探针、切片或前缘纸签，水体、原曲线读点与旁注联动。快捷节点定位表层、约1000米和深层。曲线为太平洋西经170°低纬某站印刷图的近似读图，不是新观测，也不代表所有海域；保留0—6千米原坐标，曲线与水体到约5千米，不向下外推。进度表示观察深度，不表示水温随时间降低。'},
 {id:'waves',pdf:62,title:'图3.20　波浪要素示意',effect:'wave',rect:[.017,.713,.977,.164],photo:true,controls:['整体','追踪水质点'],note:'依据正文57页图3.20，观察波形向前传播与同一水质点的闭合往复。点击橙色水质点可强调其轨迹，拖动前方手柄暂停回看。理想周期深水波的示意，不模拟破碎、漂移或真实浮标；波高、波长、周期均未按实际尺度标定。'},
 {id:'tides',pdf:64,title:'图3.22—3.23　潮汐与人类活动',effect:'tide',rect:[.123,.353,.501,.481],photo:true,controls:['低潮','涨潮','高潮','落潮'],controlPhases:[0,.25,.5,.75],note:'依据正文59页周期性涨落与潮间带露出、淹没关系，拖动潮汐手柄观察同一潮位如何改变水面、岸线与浮体高度。四个按钮定位并暂停在对应示意阶段；不计算具体地点潮时、潮高，也不把局地水平水流方向等同所有海岸的潮流。'},
 {id:'currents',pdf:66,title:'图3.26　海水运动',effect:'current',rect:[.12,.362,.56,.502],photo:true,controls:CURRENT_STOPS.map(s=>s.label),controlPhases:CURRENT_STOPS.map(s=>s.phase),playback:'once',note:'依正文61页海水持续向一定方向流动的解释，在原教材上方追踪同一组十二个水体符号，起点墨圈不变，末位置保留。可点击水体或拖动前缘纸签回看；小型往复对照复用波浪的同一质点轨道。图3.26是阿根廷东南沿海洋流交汇处浮游生物影像，原图没有方向箭头；本演示为不作地理定位的补充示意，不冒充墨西哥湾流、真实海岸、海温、海流轨迹或到达时间。'},
 {id:'karst',pdf:72,title:'图4.2　地表喀斯特地貌演变',effect:'karst',rect:[.185,.111,.575,.377],controls:['溶沟','洼地','峰丛','峰林','孤峰','残丘'],playback:'once',restartOnSelection:true,note:'依教材66—68页及图4.2，对照六种地表喀斯特形态。拖动水滴可以回看雨水沿地表低处与裂隙进入、岩石溶解并被带走、沟槽逐渐加深拓宽的示意过程。岩体顶面不凭空长高，六幅图不表示每一地点必然经历的等时序列；雨量、速率与高度均未标定。'},
 {id:'river',pdf:75,title:'图4.8　河曲和牛轭湖',effect:'river',rect:[0,.605,1,.395],keepOnPage:[[.025,.78,.36,.20]],photo:true,controls:['河曲','洪水冲颈','牛轭湖'],controlPhases:[0,.6,1],playback:'once',note:'依教材第70页展示一次可能的洪水冲颈：河槽与岸坡连续变化，旧弯道两端逐渐淤塞，形成牛轭湖。底页照片不变，立体地形不对应照片的实测高程，进度不是侵蚀速率或地质年限；并非每条河曲都会形成牛轭湖。'},
 {id:'slope',pdf:82,title:'图4.22　黄土高原某地等高线地形',effect:'slope',rect:[.119,.237,.447,.195],controls:SLOPE_STOPS.map(s=>s.label),controlPhases:SLOPE_STOPS.map(s=>s.phase),playback:'once',note:'依正文77页图4.22的主要等高线转折、中央沟谷、右侧支沟与甲乙点位建立教学近似；同一地形、等高线和点位连续由平面抬升。甲879.0米、乙885.4米，乙高6.4米，旁尺另作放大对照。原页保持不变；模型不是实测DEM，垂直方向夸张，未标明的沟底、边界高程及细部作教学插值。辅助等高线间隔10米不代表原图等高距。进度是观察方式的变化，不是地貌形成时间。'},
 {id:'forest',pdf:88,title:'图5.2　森林中的成层现象',effect:'forest',rect:[.12,.207,.51,.277],controls:FOREST_STOPS.map(s=>s.label),controlPhases:FOREST_STOPS.map(s=>s.phase),playback:'once',note:'依教材83页图5.2，在同一片完整林地中由树冠连续向林下观察。拖动侧边纸签或点植物、层标签定位；观察面、相对光照提示与旁注一起变化，乔木、灌木和草本始终并存。进度表示观察高度，不是植物生长或群落演替；高度和相对光照未作实测标定，不显示照度百分比。'},
 {id:'soil',pdf:94,title:'图5.17　森林土壤剖面及各土层特点',effect:'soil',rect:[.117,.535,.461,.335],controls:['有机层','腐殖质层','淋溶层','淀积层','母质层','母岩层'],playback:'once',note:'按教材89页图5.17由上至下保留六层剖面。点击层体或短标签抽出，再次点击复原；拖动水滴回看雨水下渗、淋溶层中部分可移动物质下移，并在淀积层保留的过程。标记不代表全部土壤矿物质；厚度、数量和过程进度均为示意，不表示所有土壤或真实成土年限。'},
 {id:'typhoon',pdf:108,title:'图6.5　台风',effect:'typhoon',rect:[.121,.181,.764,.258],keepOnPage:[[.37,.71,.63,.29]],photo:true,controls:TYPHOON_STOPS.map(s=>s.label),controlPhases:TYPHOON_STOPS.map(s=>s.phase),playback:'once',note:'依正文103页图6.5，在同一个成熟台风的前侧剖切体上逐步观察低层辐合、云墙上升、高空外流及眼内下沉。北半球近地面气流从上方看呈逆时针方向。点实体定位，拖动前缘纸签回看，眼洞与云墙保留。进度表示结构观察与讲解顺序，不是台风生成、强度、路径、风速或降雨预报。'},
 {id:'earthquake',pdf:112,title:'图6.11　地震构造示意',effect:'quake',rect:[.06,.127,.842,.387],controls:['震源与震中','震后预警','近场对照'],playback:'once',note:'依教材107页保留震源与震中结构，并连接111页震后预警案例：P波先到监测站，探测后才发出通信预警，远处聚落可能在S波到达前收到；近场可能没有提前量。震后预警不是震前预测。波速、距离及进度均为示意，不显示真实秒数或预测震级。'},
 {id:'slide',pdf:113,title:'图6.12—6.13　滑坡和泥石流',effect:'landslide',rect:[.455,.397,.422,.423],keepOnPage:[[0,.55,1,.055]],photo:true,controls:['滑坡','泥石流'],playback:'once',restartOnSelection:true,note:'比较坡体沿坡整体滑移与有限含水碎屑沿沟下行、在坡脚展宽堆积。拖动过程手柄回看，点击实体或回卷纸签重放；物料在终点保留。地形、进度与物料量均为教学示意，不预测实际失稳条件或灾害范围。'},
 {id:'mitigation',pdf:116,title:'图6.16—6.17　救援与灾后恢复',effect:'rescue',rect:[.121,.628,.78,.191],photo:true,controls:['玉树搜救','北川恢复'],playback:'once',restartOnSelection:true,note:'依正文111页图6.16、6.17独立观察玉树废墟搜救与汶川地震后异地修建的北川新县城。每个案例在同一完整场景中连续转移观察重点，选项切换案例，不把玉树废墟变成北川新城。医疗保障点和开敞空间是概念提示，不认定照片的实际布局或用途。进度表示观察顺序，不是救援耗时、恢复率或应急行动方案。'},
 {id:'remote',pdf:119,title:'图6.21　遥感技术示意',effect:'remote',rect:[.32,.637,.55,.225],controls:REMOTE_PROCESS_STOPS.map(s=>s.label),controlPhases:REMOTE_PROCESS_STOPS.map(s=>s.phase),playback:'once',note:'按教材114页图6.21的被动光学遥感例子，地物反射太阳光进入传感器，获取的信息经接收、整理后形成影像。十二个样本始终保留位置与身份，处理只示意按已知空间位置整理，不表示自动识别地类或预测灾害；色值、距离与进度均未标定。点击装置或拖动前方手柄可回看同一过程。'},
 {id:'gis',pdf:122,title:'图6.26　地理信息系统的空间叠合分析',effect:'gis',rect:[.12,.42,.47,.395],controls:['图层分离','叠合统计'],controlPhases:[0,1],playback:'once',note:'按教材第117页示意图重绘33个雨量站与三个行政区：图层先对齐，再依据点在多边形内的空间归属逐区计数，得到5、15、13。点位与区界来自教材图示，不是实际地理测量；原教材底页保持不变。'},
 ...additionalFigures,
 ...integratedFigures,
];
figures.sort((a,b)=>a.pdf-b.pdf||(a.marker?.[1]??a.rect[1])-(b.marker?.[1]??b.rect[1]));
export const figuresAt = (spread:number) => figures.filter(f=>spreadAt(f.pdf)===spread);
export const figureById = (id:string) => figures.find(f=>f.id===id);
export const sectionFigures = (s:Section) => {
  const all=contents.flatMap(c=>c.sections).map(c=>c.page).sort((a,b)=>a-b);
  const end=all.find(p=>p>s.page)??129;
  return figures.filter(f=>f.pdf-5>=s.page&&f.pdf-5<end);
};
