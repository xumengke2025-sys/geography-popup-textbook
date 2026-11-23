import type { Figure } from './textbook-catalog';

export const INSTRUMENT_FAMILIES = {
  orrery: '天体仪', cutaway: '球体剖层', strata: '地层标本', air: '空气剖面',
  vessel: '实验容器', coast: '水体海岸', terrain: '地形教具', forest: '森林标本',
  column: '土柱', hazard: '灾害地景', mapping: '地图技术',
} as const;
export type InstrumentFamily = keyof typeof INSTRUMENT_FAMILIES;
export type InstrumentMaterialRole = 'brass' | 'wood' | 'steel' | 'ivory';
export type InstrumentRevealType = 'orbit' | 'shell' | 'strata' | 'section' | 'vessel' | 'landscape' | 'canopy' | 'column' | 'map' | 'network';
export type InstrumentSupportStrategy = 'bearing' | 'paired-skids' | 'corner-shoes' | 'section-feet' | 'specimen-clips' | 'map-pins' | 'none';
export interface InstrumentProfile {
  id: string;
  chapter: 1 | 2 | 3 | 4 | 5 | 6;
  family: InstrumentFamily;
  staging: {
    layout: string;
    viewpoint: 'three-quarter' | 'section-front' | 'oblique-plan';
    keepClear: string[];
  };
  observe: string;
  operations: string[];
  materials: Record<InstrumentMaterialRole | 'enamel', string>;
  reveal: {
    type: InstrumentRevealType;
    parts: string[];
    rigid: true;
    order: 'base-to-detail' | 'rear-to-front' | 'bottom-to-top' | 'outside-to-inside';
  };
  support: {
    strategy: InstrumentSupportStrategy;
    /** Extra geometry stays below the model's structural footprint. */
    attachment: 'underside';
    motionClearance: 'preserve';
    tickMarks: boolean;
  };
}

type Row = readonly [id: string, chapter: InstrumentProfile['chapter'], family: InstrumentFamily,
  reveal: InstrumentRevealType, support: InstrumentSupportStrategy, observe: string, parts: string, operations: string];

// Every entry describes an existing scientific scene, rather than assigning
// one interchangeable display pedestal to the whole textbook.
const rows: readonly Row[] = [
  ['solar',1,'orrery','orbit','none','公转轨道与内外行星运行关系','中心轴|八条轨道|行星球体','拖动公转进度|点击行星'],
  ['cosmic-scale',1,'orrery','network','none','地月系到可观测宇宙的隶属关系','地月系|太阳系|银河系|层次联系','切换天体系统|连续推进观察'],
  ['habitable',1,'cutaway','shell','none','适宜温度、液态水和大气共同形成生命条件','地球球体|水体层|大气提示','分项对照条件|回看整体'],
  ['solar-distribution',1,'cutaway','shell','none','同束太阳辐射在不同纬度展开的面积','地球主体|入射光束|纬度观察面','拖动入射位置|定位纬度'],
  ['sun',1,'vessel','section','none','同一套太阳能供热系统中的光与水路','房屋剖面|集热器|储水池|循环水路','点装置定位|拖动过程手柄'],
  ['solar-activity',1,'orrery','network','none','太阳扰动与空间粒子、极光的联系','太阳|地球|磁场路径|极光','对照活动条件|拖动过程'],
  ['geo-time',1,'strata','strata','none','代表性生物与地质时期的对应','年代薄册|地层标本|生物形态','选择地质时期|查看代表生物'],
  ['history',1,'strata','strata','none','A、B两柱地层和可辨化石的对应','A地六层|B地六层|化石印痕','点击地层化石|拖动柱间距'],
  ['seismic-waves',1,'vessel','vessel','none','纵波与横波在固液介质中的传播差异','固体质点列|液体质点列|传播方向','改变介质条件|回看质点振动'],
  ['earth',1,'cutaway','shell','none','地球内部四层结构与剖开、抽出的对应','地壳|地幔|外核|内核','点击圈层|抽出对照|复原整体'],
  ['external-spheres',1,'terrain','landscape','corner-shoes','岩石、水、大气与生命的相互联系','岩体|水体|植被|迁移路径','选择联系类型|跟随路径'],
  ['mars-base',1,'vessel','section','paired-skids','舱段之间的水、食物、人员和能源联系','乘员舱|植物舱|水再生舱|能源系统','选择子系统|跟随生命保障回路'],
  ['air-composition',2,'vessel','vessel','none','干洁空气体积分数与水汽杂质的区分','百格阵列|水汽样本|杂质样本','切换组成|观察固定百格'],
  ['atmosphere',2,'air','section','none','同一高度探针对应的分层与温度趋势','对流层|平流层|高层大气|温度曲线','拖动高度探针|点击层体'],
  ['heating',2,'air','section','none','太阳短波、地面增温与地面长波的先后联系','地面剖面|空气层|短波|长波','点辐射定位|拖动过程'],
  ['greenhouse',2,'air','section','section-feet','大气逆辐射对地面热量损失的补偿','地面|大气层|云层|长波路径','改变大气条件|对照辐射路径'],
  ['thermal',2,'air','section','none','B冷—A暖—C冷剖面中的闭合热力环流','三处地面|垂直气流|同高气压|水平气流','点击对象|逐步观察环流'],
  ['breeze',2,'coast','landscape','none','冷热关系改变、环流减弱并反向','海岸地块|风旗|闭合气流|日月手柄','拖动日月|推进昼夜|观察风旗'],
  ['pressure-wind',2,'air','section','none','同高水平气压差与空气水平运动','两处气压柱|比较面|水平气流','切换有差与同压|回看水平气流'],
  ['wind-forces',2,'mapping','map','none','相同等压线条件下各力与风向的关系','等压线面|气压梯度力|偏向力|风向','选择受力条件|比较风向'],
  ['haze',2,'hazard','landscape','corner-shoes','同一起始污染存量下排放与通风的影响','城市地景|排放源|污染示踪|风旗','点烟囱风旗|独立重放条件'],
  ['water',3,'coast','landscape','corner-shoes','同一批水在三种循环中的迁移与终点','山地|海洋|蒸发示踪|云|降水|径流','选择循环类型|拖动水过程'],
  ['water-renewal',3,'vessel','vessel','none','局地可用淡水的补给、取用与污染','储水容器|补给口|取水口|污染样本','切换供需条件|观察储量变化'],
  ['temperature',3,'vessel','section','section-feet','海水深度探针与原曲线读点同步','海水剖面|深度探针|温度曲线','拖动探针切片|定位表层深层'],
  ['salinity',3,'vessel','vessel','none','盐量保持而水量改变的三项独立实验','海水容器|溶盐示踪|蒸发降水径流','选择实验|拖动水滴|对照终点'],
  ['density',3,'vessel','vessel','none','等体积海水在单一变量改变后的质量差异','等体积容器|天平|温度与盐度条件','选择单一条件|观察天平'],
  ['waves',3,'coast','section','none','波形传播与水质点往复是两种运动','波面|追踪质点|闭合轨道','点击水质点|拖动传播进度'],
  ['tides',3,'coast','landscape','none','同一潮位引起水面、岸线与浮体联动','海岸剖面|潮间带|水面|浮体','拖动潮位|定位涨落阶段'],
  ['currents',3,'coast','landscape','none','十二个同身份水体符号从起点持续迁移','水面|固定起点|十二个水体|往复对照','点击水体|拖动迁移过程'],
  ['desalination',3,'vessel','vessel','none','海冰中部分包裹盐水的分离','冰体|盐水通道|收集容器|离心部件','切换分离方法|观察残余盐水'],
  ['karst',4,'terrain','landscape','corner-shoes','水进入裂隙后溶蚀加深、拓宽的过程','可溶岩体|裂隙|地表水|溶蚀地貌','选择地貌|拖动水滴'],
  ['karst-cave',4,'terrain','section','none','真实空腔中的洞顶、洞底沉积','岩壳剖面|洞腔|石钟乳|石笋|水滴','切换观察对象|跟随水滴'],
  ['river-valley',4,'terrain','landscape','none','山地与平原河谷横断面和作用差异','河谷切块|测量滑架|黄铜垂锤','按瓷键更换标本|沿导轨推拉测架'],
  ['river',4,'terrain','landscape','none','洪水冲颈后旧弯道淤塞、形成牛轭湖','可变河槽|岸坡|洪水|旧弯道','拖动冲颈过程|查看旧河道'],
  ['delta',4,'terrain','landscape','none','搬运物减速沉积与河口向海推进','给沙料斗|沉积体|分汊水流','推拉给沙齿条|按瓷键观察沉积与岸线'],
  ['aeolian',4,'terrain','landscape','none','风蚀形态、堆积形态与植被固沙对照','离心风机|风沙标本|导风嘴|沙粒','按瓷键换标本|摇动风机|比较同一进度'],
  ['coastal-landform',4,'coast','landscape','corner-shoes','浪蚀凹槽、支撑丧失与有限崩落','海岸岩体|浪蚀平台|崩落岩块|海浪','选择地貌|拖动崩落过程'],
  ['terrain-observation',4,'terrain','landscape','corner-shoes','高度、相对高度、坡度与坡向的不同','地形切块|高程参照|坡面|光照','切换观察量|比较同一地形'],
  ['slope',4,'terrain','landscape','corner-shoes','同一组等高线从平面抬升到地形','黄土地形|等高线|甲乙点位|高差对照','拖动抬升进度|选择甲乙'],
  ['karst-livelihood',4,'terrain','landscape','none','峰丛地形、水土条件与因地制宜的联系','峰丛|表土|水流|植被|农业','独立切换条件|观察水土去向'],
  ['forest',5,'forest','canopy','none','同一片森林中乔灌草始终并存','基土薄片|乔木|灌木|草本|观察面','拖动侧签|点击植物与层名'],
  ['vegetation',5,'forest','canopy','specimen-clips','不同环境中的植被结构与适应','土片|树木或草株|形态观察','选择植被类型|查看结构'],
  ['soil-composition',5,'vessel','vessel','none','孔隙水增加时空气空间减少','矿物颗粒|有机质|孔隙水|空气','调整干湿条件|查看孔隙'],
  ['soil-texture',5,'column','column','none','同一降水下三种质地的下渗与留存','砂土柱|壤土柱|黏土柱|收集水体','点击土柱|拖动水滴|重新降雨'],
  ['soil',5,'column','column','none','六层剖面抽出观察与水、可移动物质下移','六层土柱|层间连接|水滴|迁移示踪','点击层体抽出复原|拖动水滴'],
  ['soil-factors',5,'column','column','none','五类成土因素共同作用而非单线替代','母质|土层|生物|气候|地形颗粒','选择作用因素|跟随颗粒'],
  ['soil-care',5,'column','column','none','同一批盐在返盐、淋盐与覆盖条件下的去向','土柱|水通道|盐示踪|覆盖物|排水','选择条件|拖动水盐过程'],
  ['urban-waterlogging',5,'hazard','landscape','corner-shoes','相同降水下径流、下渗和暂蓄的分配','城市切块|道路|透水层|雨水花园','选择地面条件|追踪水体'],
  ['flood',6,'hazard','landscape','none','持续强降水、汇流与低地淹没的联系','流域地景|河道|聚落|积水范围','按键对照降雨|推移水位记录游标'],
  ['drought',6,'hazard','landscape','none','持续少雨与土壤、水源及作物的变化','土层|水源|植株|少雨条件','按键对照降水|正反转动记录轮'],
  ['typhoon',6,'air','section','section-feet','成熟台风的眼洞、云墙与上下层环流','海面|剖切云墙|眼洞|低层高空气流','点结构定位|拖动过程'],
  ['cold-wave',6,'hazard','landscape','corner-shoes','冷空气推进、大风和降温的联系','地面剖面|冷空气边界|风向提示','拖动冷空气|选择推进前后'],
  ['earthquake',6,'hazard','section','none','P波先到监测站后才产生通信预警','地壳切块|震源|波前|监测站|聚落','定位震源震中|比较近远场'],
  ['slide',6,'hazard','landscape','corner-shoes','整体坡体滑移与含水碎屑沿沟下行','坡体|滑移块|沟道|碎屑堆积','选择滑坡泥石流|拖动过程'],
  ['disaster-chain',6,'hazard','landscape','corner-shoes','有条件的压密入侵和堵河溃决灾害链','松软地层|抽水井|坡体|堰塞湖|下游','选择独立情景|点对象重放'],
  ['mitigation',6,'hazard','landscape','corner-shoes','玉树搜救与北川恢复为两个独立案例','废墟搜救场景|恢复城市地景|观察重点','切换案例|推进观察重点'],
  ['remote',6,'mapping','network','map-pins','固定样本反射光进入传感器再整理成影像','地物样本|卫星传感器|接收端|影像阵列','点装置定位|拖动信息过程'],
  ['gnss',6,'mapping','network','map-pins','定位与求救通信协同且不能混为一体','卫星|控制端|接收机|定位与通信路径','点对象定位|拖动定位过程'],
  ['gis',6,'mapping','map','map-pins','对齐的33个雨量站按三区归属计数','行政区图层|雨量站图层|统计结果','拖动叠合进度|点击图层'],
  ['warehouse',6,'mapping','map','none','同一地形上的灾害暴露、通达与服务范围','虚构地形|路网|候选库址|服务路径','选择候选库址|比较证据'],
  ['basin-system',4,'terrain','landscape','corner-shoes','流域分水边界、坡面汇流、干支流与河口的联系','分水地形|坡面|支流|干流|河口','拖动汇流进度|点击上下游对象'],
  ['city-rain-system',5,'hazard','landscape','corner-shoes','城市降水、地表径流、下渗与排水的连续联系','城市地景|地表|土层|蓄排系统','改变地面条件|追踪同批降水'],
  ['quake-response-system',6,'hazard','section','section-feet','地震发生后的探测、通信、响应与救援联系','震源|监测站|聚落|预警链|救援路径','拖动震后过程|比较近远场响应'],
];

const familyDefaults: Record<InstrumentFamily, {
  layout: string; clear: string[]; viewpoint: InstrumentProfile['staging']['viewpoint']; materials: InstrumentProfile['materials'];
}> = {
  orrery: {layout:'天体与轨道悬置，中心支承不跨越轨道',viewpoint:'oblique-plan',clear:['行星整圈轨道','系统隶属联系','天体标签'],materials:{brass:'中心轴套与轨道支点',wood:'轴座下缘',steel:'轴心和紧固件',ivory:'无数值定位刻线',enamel:'天体本色'}},
  cutaway: {layout:'剖切球体独立承托，正面与抽层方向完全留空',viewpoint:'three-quarter',clear:['球面剖切窗口','可抽出圈层','侧置标签'],materials:{brass:'球体下缘轴套',wood:'小型轴足',steel:'下轴',ivory:'轴足嵌片',enamel:'各自然圈层'}},
  strata: {layout:'标本底部薄托，层体与对照间距留给学生观察',viewpoint:'section-front',clear:['层间展开','化石表面','两柱对应连线'],materials:{brass:'低位标本夹',wood:'标本下缘细托',steel:'夹具内面',ivory:'夹具衬垫',enamel:'地层和化石'}},
  air: {layout:'空气剖面底缘两足，比较层与垂直流场无遮挡',viewpoint:'section-front',clear:['垂直气流','同高气压比较','高度探针','剖切云墙'],materials:{brass:'剖面下缘铰座',wood:'两足底垫',steel:'铰轴',ivory:'无量纲基准刻线',enamel:'空气与冷热提示'}},
  vessel: {layout:'容器和装置下方双托条，流路上方敞开',viewpoint:'three-quarter',clear:['液面与容器口','活塞天平或离心运动','示踪流路'],materials:{brass:'容器承托与铰套',wood:'双托条',steel:'装置暗面紧固',ivory:'承托内衬',enamel:'水体、样本与装置功能面'}},
  coast: {layout:'地景下缘离散包角，海面和岸线不加外框',viewpoint:'three-quarter',clear:['水面变化','岸线与浮体','完整空中环流','质点轨道'],materials:{brass:'下缘包角',wood:'局部薄底边',steel:'包角内面',ivory:'包角定位点',enamel:'海水、陆地与自然过程'}},
  terrain: {layout:'地形切块下角支承，不在山体上方架框',viewpoint:'three-quarter',clear:['地形抬升和变形','河道与坡面','崩落堆积区'],materials:{brass:'下角承托',wood:'地形边缘薄托',steel:'内侧连接片',ivory:'边缘观察基线',enamel:'岩层、地表、水与沉积'}},
  forest: {layout:'林地薄片低位夹持，上方树冠空间完全开放',viewpoint:'three-quarter',clear:['树冠与林下','层观察面','侧边拖动签'],materials:{brass:'土片下方小夹座',wood:'土片薄托',steel:'夹具内面',ivory:'标本托衬垫',enamel:'枝叶、树干与土片'}},
  column: {layout:'土柱底缘分离夹座，不跨过可抽层与水滴路径',viewpoint:'section-front',clear:['抽出的土层','水盐迁移','侧面标签','收集水体'],materials:{brass:'土柱基座小夹',wood:'底缘标本托',steel:'夹座内面',ivory:'层位基准嵌片',enamel:'各土层、水体和示踪'}},
  hazard: {layout:'地景边缘低位支承，灾害影响和响应路径保持可见',viewpoint:'three-quarter',clear:['灾害运动包络','波前与通信路径','保留的堆积和淹没结果'],materials:{brass:'地景下缘承托',wood:'低位局部托边',steel:'连接暗面',ivory:'观察基准嵌片',enamel:'地景、设施与灾害状态'}},
  mapping: {layout:'图层底部定位销，垂直叠合与信息路径上方开放',viewpoint:'oblique-plan',clear:['图层升降叠合','卫星与光学路径','地物点位和统计标签'],materials:{brass:'图层下缘定位销',wood:'低位定位座',steel:'销轴',ivory:'对齐定位嵌片',enamel:'地图区划、地物与技术设备'}},
};

function profileFrom(row: Row): InstrumentProfile {
  const [id,chapter,family,type,strategy,observe,parts,operations]=row, defaults=familyDefaults[family];
  return {id,chapter,family,staging:{layout:defaults.layout,viewpoint:defaults.viewpoint,keepClear:[...defaults.clear]},
    observe,operations:operations.split('|'),materials:{...defaults.materials},
    reveal:{type,parts:parts.split('|'),rigid:true,order:type==='shell'?'outside-to-inside':type==='strata'||type==='column'?'bottom-to-top':type==='map'?'rear-to-front':'base-to-detail'},
    support:{strategy,attachment:'underside',motionClearance:'preserve',tickMarks:['air','vessel','mapping'].includes(family)}};
}
export const INSTRUMENT_PROFILES: Readonly<Record<string, InstrumentProfile>> = Object.freeze(
  Object.fromEntries(rows.map(row=>[row[0],profileFrom(row)])),
);
/** Unknown extension modules receive no speculative bracket. */
export function instrumentProfile(figure: string | Pick<Figure,'id'>): InstrumentProfile | undefined {
  return INSTRUMENT_PROFILES[typeof figure==='string'?figure:figure.id];
}
