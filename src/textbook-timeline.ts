import type { Figure } from './textbook-catalog';
import { evaluateSeaBreeze } from './model';
import { evaluateCoastalProcess } from './textbook-coastal-process-model';
import { evaluateTide } from './textbook-tide-model';
import { evaluateRiverCutoff } from './textbook-river-model';
import { evaluateGis } from './textbook-gis-model';
import { evaluateSalinity, SALINITY_MODES } from './textbook-salinity-model';
import { evaluateSoilProfile } from './textbook-soil-profile-model';
import { evaluateLandslide } from './textbook-landslide-model';
import { evaluateQuake } from './textbook-quake-model';
import { evaluateRemoteSensing, REMOTE_PROCESS_STOPS } from './textbook-remote-model';
import { evaluateAirProcess, AIR_PROCESS_STOPS } from './textbook-air-process-model';
import { evaluateAtmosphere, ATMOSPHERE_STOPS } from './textbook-atmosphere-model';
import { evaluateForest, FOREST_STOPS } from './textbook-forest-model';
import { evaluateWaterCycle, WATER_CYCLE_STOPS } from './textbook-water-cycle-model';
import { evaluateOceanCurrent, CURRENT_STOPS } from './textbook-current-model';
import { evaluateSolarHeating, SOLAR_HEATING_STOPS } from './textbook-solar-heating-model';
import { evaluateTyphoon, TYPHOON_STOPS } from './textbook-typhoon-model';
import { evaluateTemperatureProfile, TEMPERATURE_STOPS } from './textbook-temperature-model';
import { evaluateSlopeRelief, SLOPE_STOPS } from './textbook-slope-model';
import { evaluateRecovery, RECOVERY_STOPS } from './textbook-recovery-model';
import { evaluateSoilCare, SOIL_CARE_STOPS } from './textbook-soil-care-model';
import { evaluateGnss, GNSS_STOPS } from './textbook-gnss-model';
import { evaluateUrbanWater, URBAN_WATER_STOPS } from './textbook-urban-water-model';
import { evaluateColdWave, COLD_WAVE_STOPS } from './textbook-cold-wave-model';
import { evaluateInsolation, INSOLATION_STOPS } from './textbook-insolation-model';
import { evaluateIntegrated } from './textbook-integrated-model';

export interface ProcessStop { label: string; phase: number; selection?: number }
export interface ProcessTimeline {
  key: string;
  stage: string;
  title: string;
  text: string;
  stops: readonly ProcessStop[];
  activeStop: number;
  /** Only true when all the original choices describe this same process. */
  replacesChoices: boolean;
  cyclic: boolean;
  /** A spatial observation is never described as elapsed time. */
  progressLabel?: string;
}
const breezeStops: ProcessStop[] = [
  { label: '夜晚', phase: 0, selection: 1 }, { label: '日出', phase: .25 },
  { label: '白天', phase: .5, selection: 0 }, { label: '日落', phase: .75 },
];
const coastalStops: ProcessStop[] = [
  { label: '凹蚀', phase: .18 }, { label: '失撑', phase: .44 },
  { label: '崩塌', phase: .67 }, { label: '平台', phase: 1 },
];
const tideStops: ProcessStop[] = [
  { label: '低潮', phase: 0, selection: 0 }, { label: '涨潮', phase: .25, selection: 1 },
  { label: '高潮', phase: .5, selection: 2 }, { label: '落潮', phase: .75, selection: 3 },
];
const riverStops: ProcessStop[] = [
  { label: '河曲', phase: 0, selection: 0 }, { label: '洪水冲颈', phase: .6, selection: 1 },
  { label: '牛轭湖', phase: 1, selection: 2 },
];
const gisStops: ProcessStop[] = [
  { label: '图层分离', phase: 0, selection: 0 }, { label: '叠合统计', phase: 1, selection: 1 },
];
const salinityStops: ProcessStop[] = [
  { label: '初始海水', phase: 0 }, { label: '水量交换', phase: .45 }, { label: '比较结果', phase: 1 },
];
const soilStops: ProcessStop[] = [
  { label: '初始剖面', phase: 0 }, { label: '水分下渗', phase: .2 },
  { label: '淋溶迁移', phase: .6 }, { label: '淀积留存', phase: 1 },
];
const slideStops: ProcessStop[] = [
  { label: '初始物料', phase: 0 }, { label: '沿坡下移', phase: .45 }, { label: '坡脚留存', phase: 1 },
];
const remoteStops: ProcessStop[] = REMOTE_PROCESS_STOPS.map((stop, selection) => ({ ...stop, selection }));
const heatStops: ProcessStop[] = AIR_PROCESS_STOPS.heat.map((stop, selection) => ({ ...stop, selection }));
const circulationStops: ProcessStop[] = AIR_PROCESS_STOPS.circulation.map((stop, selection) => ({ ...stop, selection }));

/** Narrative reads the production models; it never runs a second simulation.
 * Independent landforms and conditions deliberately do not become a sequence. */
export function processTimeline(f: Figure, phase: number, selection: number): ProcessTimeline | null {
  const integrated = evaluateIntegrated(f.effect, phase, selection);
  if (integrated) return {
    key: `${f.id}-${integrated.selection}-${integrated.stageIndex}`,
    stage: integrated.kind === 'basin-system' ? integrated.timeScale : integrated.kind === 'city-rain-system' ? f.controls?.[integrated.selection] ?? '城市雨水' : '综合观察 · 震后协同',
    title: integrated.title, text: integrated.text, stops: integrated.stops,
    activeStop: integrated.stageIndex, replacesChoices: false, cyclic: false,
    progressLabel: integrated.kind === 'basin-system' && integrated.longTerm ? '长期累积示意' : '过程观察',
  };
  switch (f.effect) {
    case 'solar-distribution': {
      const s = evaluateInsolation(phase);
      return { key: `insolation-${s.selection}`, stage: '同一束光，改变照射纬度',
        title: ['低纬度：照射范围较小', '纬度升高：光束逐渐斜照', '高纬度：照射范围变大'][s.selection],
        text: '上下拖动光束，比较球面的照射范围。光束宽度始终相同；此处固定太阳直射赤道，只对照局地正午的入射角。',
        stops: INSOLATION_STOPS, activeStop: s.selection, replacesChoices: true, cyclic: false, progressLabel: '观察纬度' };
    }
    case 'gnss': {
      const s = evaluateGnss(phase);
      return { key: `gnss-${s.stageIndex}-${s.communicationDelivered}`, stage: '卫星定位与通信协同', title: s.caption,
        text: s.explanation, stops: GNSS_STOPS.map((stop, selection) => ({ ...stop, selection })),
        activeStop: s.stageIndex, replacesChoices: true, cyclic: false, progressLabel: '观察进度' };
    }
    case 'urban-waterlogging': {
      const s = evaluateUrbanWater(phase, selection);
      return { key: `urban-water-${s.selection}-${s.stageIndex}`, stage: f.controls![s.selection], title: s.caption,
        text: s.text, stops: URBAN_WATER_STOPS, activeStop: s.stageIndex,
        replacesChoices: false, cyclic: false };
    }
    case 'cold-wave': {
      const s = evaluateColdWave(phase);
      return { key: `cold-wave-${s.stageIndex}`, stage: '同一地点，冷空气过境', title: s.caption,
        text: s.text, stops: COLD_WAVE_STOPS, activeStop: s.stageIndex,
        replacesChoices: true, cyclic: false };
    }
    case 'soil-care': {
      const s = evaluateSoilCare(phase, selection);
      return { key: `soil-care-${s.selection}-${s.stageIndex}`, stage: f.controls![s.selection], title: s.caption,
        text: s.stageIndex === 0 ? '三项条件从相同水盐示踪开始。金色标记表示溶解盐，不是结晶。'
          : s.selection === 0 ? '水分向表层移动并蒸发，溶解盐留在土中。留意同一批盐标记的位置。'
          : s.selection === 1 ? '淡水淋洗须配合排水。盐随排水离开土柱，末尾仍保留部分盐标记。'
          : '覆盖减弱蒸发和向上的水盐迁移，已有盐仍保留；覆盖本身不会直接排盐。',
        stops: SOIL_CARE_STOPS, activeStop: s.stageIndex, replacesChoices: false, cyclic: false };
    }
    case 'slope': {
      const s = evaluateSlopeRelief(phase);
      return { key: `slope-${s.stage}`, stage: '从等高线到立体地形', title: s.caption,
        text: ['先沿原图辨认两侧高地与中央沟谷，甲乙点位保持不变。',
          '等高线与地表一同抬升。这里改变观察方式，不是在演示山地形成。',
          '甲879.0米，乙885.4米，乙高6.4米。旁尺放大这段高差，其余地形是教学近似。'][s.stageIndex],
        stops: SLOPE_STOPS, activeStop: s.stageIndex, replacesChoices: true,
        cyclic: false, progressLabel: '立体观察进度' };
    }
    case 'rescue': {
      const s = evaluateRecovery(phase, selection);
      return { key: `recovery-${s.caseId}-${s.stage}`, stage: s.title, title: s.caption,
        text: s.text, stops: RECOVERY_STOPS[s.selection], activeStop: s.stageIndex,
        replacesChoices: false, cyclic: false, progressLabel: '观察进度' };
    }
    case 'temperature': {
      const s = evaluateTemperatureProfile(phase);
      return { key: `temperature-${s.stage}-${s.caption}`, stage: '沿深度观察海水', title: s.caption,
        text: ['先看表层。此处温度较高，水体和曲线保持固定。',
          '向下移动探针，约1000米以内，原曲线所示水温变化较大。',
          '更深处原曲线变化较小。读数为原图近似，不表示海水正在降温。'][s.stageIndex],
        stops: TEMPERATURE_STOPS, activeStop: s.stageIndex, replacesChoices: true,
        cyclic: false, progressLabel: '观察深度' };
    }
    case 'current': {
      const s = evaluateOceanCurrent(phase);
      return { key: `current-${s.stage}-${s.phase === 1}`, stage: '追踪同一组海水', title: s.caption,
        text: ['起点墨圈保持不动，蓝色水体从这里出发。',
          '水体整体向前迁移；旁边的小质点只在原处往复。',
          '对照起点与末位置：海流中的水体发生了迁移。此处不代表真实海岸。'][s.stageIndex],
        stops: CURRENT_STOPS, activeStop: s.stageIndex, replacesChoices: true, cyclic: false };
    }
    case 'radiation': {
      const s = evaluateSolarHeating(phase);
      return { key: `solar-heating-${s.stage}`, stage: '从太阳到室内', title: s.caption,
        text: ['太阳短波到达屋顶集热器；光的标记与水的标记分开。',
          '集热器吸收辐射而受热，再把热量传给水。',
          '沿同一组管道追踪水：经过集热器、储存池和房间后返回。',
          '散热器把热量传给房间。进度表示讲解顺序，不表示实测水温。'][s.stageIndex],
        stops: SOLAR_HEATING_STOPS, activeStop: s.stageIndex, replacesChoices: true, cyclic: false };
    }
    case 'typhoon': {
      const s = evaluateTyphoon(phase);
      return { key: `typhoon-${s.stage}`, stage: '剖开看成熟台风', title: s.caption,
        text: ['北半球近地面空气从上方看呈逆时针旋转，并向中心辐合。',
          '气流沿台风眼周围的云墙上升，眼洞保持可见。',
          '上升气流到达高处后向外流出，连接上下空间。',
          '眼内以空气下沉为主，云墙上升仍在继续；这是观察顺序。'][s.stageIndex],
        stops: TYPHOON_STOPS, activeStop: s.stageIndex, replacesChoices: true, cyclic: false,
        progressLabel: '观察进度' };
    }
    case 'atmosphere': {
      const s = evaluateAtmosphere(phase);
      return { key: `atmosphere-${s.stage}`, stage: '沿高度观察大气', title: s.caption,
        text: `${s.feature}${s.evidence}`, stops: ATMOSPHERE_STOPS, activeStop: s.stageIndex,
        replacesChoices: true, cyclic: false, progressLabel: '观察位置' };
    }
    case 'forest': {
      const s = evaluateForest(phase);
      return { key: `forest-${s.stage}`, stage: '从树冠到林下', title: s.selectedLayer,
        text: s.caption, stops: FOREST_STOPS, activeStop: s.stageIndex,
        replacesChoices: true, cyclic: false, progressLabel: '观察位置' };
    }
    case 'water': {
      const s = evaluateWaterCycle(phase, selection);
      const texts = [
        ['海水蒸发进入大气。浅色符号表示水汽示踪，水汽本身看不见。',
          '同一批示踪由海洋上空移向陆地；此时还没有降水。',
          '水汽凝结成云，云中的水以小水滴等形式存在，示踪身份保留。',
          '降水落向陆地，到达河槽和地表后继续参与循环。',
          '部分沿地表返回，部分经下渗和地下通道返回。示踪分流数量不表示比例。',
          '同一批示踪回到海洋，停留供对照。本次讲解暂停，水循环仍可继续。'],
        ['陆地水体蒸发，植物蒸腾，水汽进入陆地上空。',
          '陆地上空的水汽凝结，形成含小水滴等的云。',
          '降水重新落到陆地，这一类型的示踪不进入海洋。',
          '示踪留在陆地水体和土壤中，保留结果供对照。'],
        ['海水蒸发，水汽进入海洋上空，不越过海岸。',
          '海洋上空的水汽凝结成云，仍是同一批示踪。',
          '降水落回海面，观察水从大气回到海洋。',
          '同一批示踪回到海洋。三类循环是独立对照，不是先后阶段。'],
      ];
      return { key: `water-${s.selection}-${s.stage}`, stage: s.cycle, title: s.caption,
        text: texts[s.selection][s.stageIndex], stops: WATER_CYCLE_STOPS[s.selection],
        activeStop: s.stageIndex, replacesChoices: false, cyclic: false };
    }
    case 'heat': {
      const s = evaluateAirProcess('heat', phase);
      const text = [
        '太阳短波穿过大气，到达地面；本图只突出受热过程的主线。',
        '地面吸收太阳辐射后增温。到达地面的短波箭带保留，连接前一步的原因。',
        '增温的地面发出长波辐射，向大气传递能量。长波箭带从同一地面升起。',
        '近地面大气吸收地面长波而增温。这个显现顺序不是实际气象时间。',
      ][s.stageIndex];
      return { key: `heat-${s.stage}`, stage: '大气受热过程', title: s.caption, text,
        stops: heatStops, activeStop: s.stageIndex, replacesChoices: true, cyclic: false };
    }
    case 'circulation': {
      const s = evaluateAirProcess('circulation', phase);
      const text = [
        '先看同一个剖面。相同高度的气压分布均匀，还没有局地热力环流。',
        '中部A受热较多，两侧B、C相对较冷。颜色只表示相对冷热。',
        '暖处空气膨胀上升，冷处空气下沉；前一步的冷热关系保留。',
        '分别在近地面和高空作水平比较：A近地面相对低压，高空相对高压。',
        '近地面流向A，高空向两侧返回，与升降气流连接成环流。分步只为讲解。',
      ][s.stageIndex];
      return { key: `circulation-${s.stage}`, stage: '热力环流的形成', title: s.caption, text,
        stops: circulationStops, activeStop: s.stageIndex, replacesChoices: true, cyclic: false };
    }
    case 'remote': {
      const s = evaluateRemoteSensing(phase);
      const text = {
        observing: '先看太阳、地物和传感器的位置；这里演示利用太阳光的光学遥感。',
        acquiring: '地物反射的光进入传感器。已获取的样本保留在传感器内，等待传输。',
        transmitting: '同一批样本依次到达地面接收站，之前获取的信息仍可对照。',
        processing: '把收到的样本按已知空间位置整理，逐步恢复图像的排列关系。',
        outputting: '整理后的样本逐块组成影像；留意地物、传感器和接收站中的同一图案。',
        complete: '对照同一图案的位置。这里没有自动识别地类或预测灾害。',
      }[s.stage];
      return { key: `remote-${s.stage}`, stage: '遥感信息链', title: s.stage === 'complete' ? '影像已形成' : s.caption.replace(/。$/, ''), text,
        stops: remoteStops, activeStop: s.selection, replacesChoices: true, cyclic: false };
    }
    case 'salinity': {
      const s = evaluateSalinity(phase, selection), activeStop = s.stage === 'ready' ? 0 : s.stage === 'transferring' ? 1 : 2;
      const evaporation = s.mode === 0;
      const title = s.stage === 'ready' ? '同一海水，同样盐量' : s.stage === 'transferring'
        ? evaporation ? '水分离开，盐仍留在水中' : '淡水加入，溶解盐量不变'
        : `水量${evaporation ? '减少' : '增加'}，盐度${s.tendency}`;
      const text = s.stage === 'ready' ? '先看初始水面和溶解盐标记，再观察这一项条件引起的变化。'
        : evaporation ? '蒸发带走水，不带走溶解盐。比较水面与金色盐标记，盐标记不表示结晶。'
          : `${s.mode === 1 ? '降水' : '径流'}在这里简化为淡水输入；水量增加后，相同盐量分布在更多水中。`;
      return { key: `salinity-${s.mode}-${s.stage}`, stage: SALINITY_MODES[s.mode], title, text,
        stops: salinityStops, activeStop, replacesChoices: false, cyclic: false };
    }
    case 'soil': {
      const s = evaluateSoilProfile(phase, selection), activeStop = { ready: 0, infiltration: 1, leaching: 2, retained: 3 }[s.stage];
      return { key: `soil-${s.stage}`, stage: '森林土壤剖面',
        title: ['先看连成整体的六层土壤', '水先沿孔隙下渗', '部分可移动物质随水下迁', '迁移物质留在淀积层'][activeStop],
        text: ['点层体可抽出查看，水分过程仍在同一根土柱中进行。',
          '先观察蓝色水路到达下方；层体抽出只方便查看，不改变下渗进度。',
          '留意浅色淋溶层中的标记向下移动。这里只表示一部分可移动物质。',
          '标记保留在淀积层，没有凭空消失。整个过程不表示真实成土年限。'][activeStop],
        stops: soilStops, activeStop, replacesChoices: false, cyclic: false };
    }
    case 'landslide': {
      const s = evaluateLandslide(phase, selection), activeStop = s.stage === 'initial' ? 0 : s.stage === 'moving' ? 1 : 2;
      const debris = s.mode === 'debris-flow';
      return { key: `landslide-${s.mode}-${s.stage}`, stage: debris ? '泥石流' : '滑坡',
        title: s.caption.split('：')[1],
        text: s.stage === 'initial' ? debris ? '含水碎屑已在沟谷内，沿当前过程观察物料怎样向下运动。' : '先看坡上的连贯滑体及其下方滑动面。'
          : s.stage === 'moving' ? debris ? '物料沿沟道下行；进入坡脚后速度减小，横向展宽。' : '滑体沿滑动面整体下移，仍保留内部相邻关系。'
            : '物料停留在坡脚，终点仍可查看。滑坡与泥石流是两个独立情景。',
        stops: slideStops, activeStop, replacesChoices: false, cyclic: false };
    }
    case 'quake': {
      if (selection === 0) return null;
      const s = evaluateQuake(phase, selection), e = s.events;
      const stops: ProcessStop[] = [
        { label: '地震发生', phase: e.earthquake + .01 }, { label: '监测到达', phase: e.stationP + .001 },
        { label: '信号发出', phase: e.dispatch + .001 }, { label: '到达对照', phase: Math.min(1, Math.max(e.targetS + .15, e.warningArrival + .02)) },
      ];
      const activeStop = s.stage === 'result' ? 3 : s.sent ? 2 : s.detected ? 1 : 0;
      const texts = {
        ready: '地震尚未发生。震后预警必须等待监测到地震，不能提前预测震源。',
        waves: '地震波从震源向外传播。P波比S波快，监测站尚需接收和处理。',
        detected: '监测站已接收到P波，经过处理后才能发出通信预警。',
        transmitting: '监测后发出通信信号，继续比较信号和S波何时到达聚落。',
        lead: '此处先收到预警，S波尚未到达；提前量来自不同传播过程的时差。',
        shaking: 'S波已到达聚落。预警是在地震发生后发出，不是震前预测。',
        'near-hit': '近处的震动已经到达，监测和信号仍需时间；近场可能没有提前量。',
        result: s.hasLead ? '这个远处情景先收到预警。提前量依赖震源、台站和聚落的相对位置。' : '这个近处情景先受震动，没有提前量。不能把远处的结果套到所有地点。',
      };
      return { key: `quake-${s.view}-${s.stage}`, stage: s.view === 'near' ? '近场对照' : '震后预警', title: s.caption,
        text: texts[s.stage], stops, activeStop, replacesChoices: false, cyclic: false };
    }
    case 'breeze': {
      const s = evaluateSeaBreeze({ phase, contrast: 1 });
      const activeStop = { '夜间': 0, '日出附近': 1, '午后': 2, '日落附近': 3 }[s.stage] ?? 0;
      const daylight = Math.cos((s.phase - .5) * Math.PI * 2) > 0;
      let title: string, text: string, condition: string;
      if (s.strength < .08) {
        title = '风很弱，旗垂落'; condition = 'weak';
        text = '海陆冷热差异变小，局地环流随之减弱。温差反转后，风才逐渐转向。';
      } else if (s.direction > 0) {
        title = '海风吹向陆地'; condition = 'sea';
        text = daylight ? '陆地相对较暖，空气上升；近地面空气由海洋流向陆地，高空反向返回。'
          : '太阳已落下，陆地仍相对较暖。海风还在继续，日落不等于风立即转向。';
      } else {
        title = '陆风吹向海洋'; condition = 'land';
        text = daylight ? '太阳已升起，陆地尚相对较冷。近地面仍吹陆风，转向取决于海陆冷热关系。'
          : '陆地相对较冷，海上空气上升；近地面空气由陆地流向海洋，高空反向返回。';
      }
      return { key: `breeze-${activeStop}-${condition}-${daylight}`, stage: s.stage, title, text,
        stops: breezeStops, activeStop, replacesChoices: true, cyclic: true };
    }
    case 'coastal-landform': {
      if (selection !== 0) return null;
      const s = evaluateCoastalProcess(phase);
      const activeStop = { undercut: 0, fracture: 1, collapse: 2, platform: 3 }[s.stage];
      const title = ['海浪掏蚀崖脚', '上部岩体失去支撑', '岩块断裂、崩落', '岸退，平台留在原位'][activeStop];
      const text = ['海浪反复作用于崖脚，凹槽逐渐加深。留意上方悬空的岩体。',
        '崖脚继续凹蚀，上部岩体失去支撑，裂隙逐渐张开。',
        '有限的岩块向坡脚崩落，残块留在岸边；原有岩面逐渐露出。',
        '崖壁后退，原位岩面成为海蚀平台。它不是新长出的地面。'][activeStop];
      return { key: `coastal-${s.stage}`, stage: '海蚀崖与平台', title, text,
        stops: coastalStops, activeStop, replacesChoices: false, cyclic: false };
    }
    case 'tide': {
      const s = evaluateTide(phase), activeStop = { low: 0, rising: 1, high: 2, falling: 3 }[s.stage];
      return { key: `tide-${s.stage}`, stage: '一个潮汐周期', title: s.caption,
        text: ['潮位较低，潮间带露出较多。轻舟随水面降低，潮尺留在原位。',
          '水面逐渐升高，海水覆盖更多坡岸；轻舟随同一潮位上升。',
          '潮位较高，潮间带大部被淹没。固定潮尺帮助比较水位。',
          '水面逐渐降低，潮间带重新露出，轻舟随水面下降。'][activeStop],
        stops: tideStops, activeStop, replacesChoices: true, cyclic: true };
    }
    case 'river': {
      const s = evaluateRiverCutoff(phase), activeStop = s.stage;
      return { key: `river-${activeStop}`, stage: '一次可能的洪水冲颈', title: s.caption,
        text: ['河曲两侧逐渐靠近，曲流颈部变窄。并非每条河曲都会继续形成牛轭湖。',
          '洪水冲开狭窄的颈部，水流逐渐走向较直的新河槽。',
          '旧弯道两端逐渐淤塞，与主河道分离，留下弯月形湖泊。'][activeStop],
        stops: riverStops, activeStop, replacesChoices: true, cyclic: false };
    }
    case 'gis': {
      const s = evaluateGis(phase), activeStop = s.stage === 'separated' || s.stage === 'aligning' ? 0 : 1;
      const title = { separated: '两层信息分开看', aligning: '同一位置，逐渐对齐', aligned: '位置对齐，信息叠合',
        classifying: '按行政区归属雨量站', result: '叠合得到分区统计' }[s.stage] ?? '空间叠合分析';
      const text = s.stage === 'result' ? '同一批33个雨量站，按空间归属计入三个行政区，分别为5、15、13个。'
        : s.stage === 'classifying' ? '查看每个雨量站落在哪个行政区内，再逐区计数。'
        : '雨量站和行政区使用同一位置关系；叠合后，才能依据区界进行统计。';
      return { key: `gis-${s.stage}`, stage: '空间叠合分析', title, text,
        stops: gisStops, activeStop, replacesChoices: true, cyclic: false };
    }
    default: return null;
  }
}

/** Seek cyclic inputs through the nearest boundary, never play a second movie. */
export function seekProcessPhase(from: number, to: number, fraction: number, cyclic: boolean) {
  const q = Math.max(0, Math.min(1, fraction));
  if (q >= 1) return to;
  let distance = to - from;
  if (cyclic && Math.abs(distance) > .5) distance -= Math.sign(distance);
  const t = q * q * (3 - 2 * q), phase = from + distance * t;
  return cyclic ? ((phase % 1) + 1) % 1 : Math.max(0, Math.min(1, phase));
}
