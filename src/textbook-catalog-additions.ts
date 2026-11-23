import type { Figure } from './textbook-catalog';
import { GNSS_STOPS } from './textbook-gnss-model';
import { COLD_WAVE_STOPS } from './textbook-cold-wave-model';
import { INSOLATION_REFERENCE, INSOLATION_STOPS } from './textbook-insolation-model';

export type AdditionalEffect =
  | 'cosmic-scale' | 'habitable' | 'solar-distribution' | 'solar-activity' | 'geo-time' | 'seismic-waves' | 'external-spheres' | 'mars-base'
  | 'air-composition' | 'greenhouse' | 'wind-forces' | 'haze' | 'water-renewal' | 'salinity' | 'density' | 'desalination'
  | 'karst-cave' | 'river-valley' | 'delta' | 'aeolian' | 'coastal-landform' | 'terrain-observation' | 'karst-livelihood'
  | 'vegetation' | 'soil-composition' | 'soil-texture' | 'soil-factors' | 'soil-care' | 'urban-waterlogging'
  | 'flood' | 'drought' | 'cold-wave' | 'disaster-chain' | 'gnss' | 'warehouse';

/** A margin marker opens a spatial explanation of the nearby textbook text.
 * rect defines its physical stage, never an image crop or a replacement page.
 * Pages below are printed textbook numbers, verified against pages.json/PDF. */
function prose(id: AdditionalEffect, page: number, title: string, controls: string[], note: string, markerY = .3): Figure {
  const progressive: AdditionalEffect[] = ['solar-activity', 'greenhouse', 'external-spheres', 'mars-base', 'terrain-observation', 'river-valley', 'solar-distribution', 'haze', 'water-renewal', 'salinity', 'desalination', 'karst-cave', 'delta', 'aeolian', 'coastal-landform', 'soil-texture', 'soil-factors', 'soil-care', 'karst-livelihood', 'urban-waterlogging', 'flood', 'drought', 'cold-wave', 'disaster-chain', 'gnss'];
  const stops = id === 'gnss' ? GNSS_STOPS : id === 'cold-wave' ? COLD_WAVE_STOPS : id === 'solar-distribution' ? INSOLATION_STOPS : undefined;
  return { id, effect: id, pdf: page + 5, title, controls: stops ? stops.map(stop => stop.label) : controls,
    controlPhases: stops?.map(stop => stop.phase), note,
    playback: progressive.includes(id) ? 'once' : undefined,
    restartOnSelection: ['solar-activity','greenhouse','external-spheres','mars-base','water-renewal','desalination','karst-cave','soil-factors','karst-livelihood','flood','drought','disaster-chain','haze','salinity','coastal-landform','soil-care','aeolian','urban-waterlogging'].includes(id),
    origin: 'text', marker: [.95, markerY], rect: [.10, .28, .78, .35] };
}

export const additionalFigures: Figure[] = [
  prose('cosmic-scale', 3, '天体系统的层次', ['地月系', '太阳系', '银河系', '可观测宇宙'], '依正文3—4页查看天体系统的隶属关系。大小、间距和速度不按真实比例；展台不表示宇宙由层层硬壳构成。'),
  prose('habitable', 6, '地球存在生命的条件', ['适宜温度', '液态水', '大气条件'], '依正文6页分项查看温度、液态水和大气条件。地球位置、自身体积与质量、安全宇宙环境共同起作用；单个条件不是生命出现的充分保证。'),
  prose('solar-distribution', 9, '太阳辐射的纬度差异', ['低纬度', '中纬度', '高纬度'], INSOLATION_REFERENCE.note, .2),
  prose('solar-activity', 11, '太阳活动与地球', ['较平静', '活动增强'], '依正文10—13页展示太阳活动、空间扰动和极光的关系。磁场线、粒子路径及时间为示意；不预测某次爆发会造成何种地面影响。'),
  prose('geo-time', 16, '地质年代与生命演化', ['前寒武纪', '古生代', '中生代', '新生代'], '依正文15—19页查看代表性生物与环境。各展台及切换时长不代表时期长短；不把所有地区理解为同一演变路径。'),
  prose('seismic-waves', 21, '地震波如何穿过不同介质', ['固体与液体', '两侧都是固体'], '依正文21页演示纵波质点振动平行于传播方向、横波质点振动垂直于传播方向；P波可通过固体和液体，S波不能通过液体。速度、粒距及振幅为示意。'),
  prose('external-spheres', 23, '地球外部圈层的联系', ['圈层联系', '水的迁移', '生物联系'], '依正文23—24页展示大气圈、水圈、生物圈与岩石圈的联系和渗透。箭头不表示完整物质收支。'),
  prose('mars-base', 26, '问题研究 · 火星基地', ['基地整体', '水的再生', '植物与乘员', '能源供给'], '依据25—26页“绿航星际”四类舱段展开生命保障联系。回路不表示物质完全闭合，部分食物仍需补给；本模型不是可直接建设的火星基地工程方案。'),
  prose('air-composition', 28, '大气的组成', ['干洁空气', '水汽与杂质'], '依正文28—29页：100格表示干洁空气的体积分数，78格氮、21格氧、1格其他。格子不是分子个数；水汽和杂质另列，比例随地时变化。'),
  prose('greenhouse', 35, '大气的保温作用', ['无大气对照', '有大气', '有低云'], '依正文35页比较长波直接逸出与被大气吸收后的向上、向下再辐射。逆辐射补偿地面热量损失，不产生能量；箭头数量不代表能量比例。'),
  prose('wind-forces', 39, '等压线与风向', ['只受气压梯度力', '北半球高空', '北半球近地面', '南半球近地面'], '依图2.14—2.16及思考题，在同一水平面比较风向。高空风与等压线平行，近地面风由高压侧斜穿等压线吹向低压侧。斜交角为示意；不计算实际风速。'),
  prose('haze', 43, '问题研究 · 何时蓝天常在', ['排放积聚', '通风扩散', '减少排放'], '依正文42—44页对比排放与通风。点烟囱或风旗可开始对照；每项从相同初始污染存量重放。减排只减少后续排放，已有污染仍需逐渐移出观察范围。示踪、速率与时间均为教学设定，不是AQI、实测轨迹或治理天数；湿度和地表等条件也会影响污染。'),
  prose('water-renewal', 48, '水体更新与水资源短缺', ['取用与补给相当', '取用超过补给', '水体污染'], '依正文48页：比较一定时空范围内的补给、取用与污染。储水变化只代表局地可用淡水，不是全球水量被消灭。补给和取用速度为教学设定。'),
  prose('salinity', 52, '哪些条件影响海水盐度', ['蒸发增强', '降水增多', '河流注入'], '依正文52—53页，三个独立实验从同一份海水开始。拖动水滴回看：蒸发只带走水，降水和径流补入淡水；盐量保持，盐度随水量改变。金色标记表示溶解盐量，不是沉淀的盐晶；内部水量、比例和时长均为示意，不是实测盐度或完整海洋收支，径流简化为淡水输入。'),
  prose('density', 55, '海水密度的条件对照', ['相同条件', '只降低温度', '只增加盐度'], '依正文55页比较等体积海水的质量。一般情况下降温、增盐使密度增大；每次只改变一个条件。天平为关系示意，深度压力暂不模拟。'),
  prose('desalination', 64, '问题研究 · 海冰淡化', ['重力排盐', '破碎离心'], '依正文63—64页展示两种盐水与冰分离的方法。保留部分包裹盐水，不能推断处理后立即可饮用；需结合能耗、成本、生态影响和输水条件讨论。'),
  prose('karst-cave', 68, '地下喀斯特地貌', ['溶洞', '石钟乳与石笋'], '依正文68页展示真实空腔及洞顶、洞底碳酸钙沉积。动画长短不表示地质年代，也不保证洞体按相同时序演化。'),
  prose('river-valley', 69, '河流地貌与河谷', ['山地河谷', '平原河谷'], '依正文69—70页比较山地河谷和平原河谷的形态与河流作用。地形和过程为示意，不代表河流必然处处具备相同横断面。'),
  prose('delta', 71, '冲积平原与河口三角洲', ['冲积平原', '河口沉积', '三角洲推进'], '依正文70—71页演示河流搬运物在流速减弱处沉积。河口向海推进的幅度与时间为示意，不代表所有河口都形成三角洲或永远推进。'),
  prose('aeolian', 73, '风沙地貌', ['风蚀蘑菇', '雅丹', '新月形沙丘', '植被固沙'], '摇动木柄，观察含沙气流对标本的作用；按瓷键可换入另一标本。依正文72—73页分辨风力侵蚀与堆积。沙粒路径、侵蚀速率及固沙效果为示意，不将四种条件解释为必经演化阶段。'),
  prose('coastal-landform', 74, '海岸侵蚀与堆积', ['海蚀崖与平台', '海蚀拱桥', '海蚀柱', '海滩堆积'], '依正文74页比较海蚀与海积地貌。第一项可拖动过程纸签查看浪蚀凹槽、失去支撑、有限岩块崩落与原位平台露出，崩落岩块保留在坡脚。四类地貌为独立观察，不把拱桥、海蚀柱和海滩解释为所有海岸必经的同一序列；地形、物料量和速率均为示意。'),
  prose('terrain-observation', 77, '地貌观察：高度、坡度与坡向', ['绝对高度', '相对高度', '坡度', '坡向'], '依正文76—78页比较绝对高度、相对高度、坡度和坡向。地形为原创示意，不读取实际海拔；坡向光照仅以北半球中纬度为例。'),
  prose('karst-livelihood', 80, '问题研究 · 喀斯特峰丛山地', ['植被覆盖', '破坏与侵蚀', '雨涝晴旱', '立体农业'], '依正文79—80页对照地形、水土条件与经济活动。模型帮助讨论因地制宜，不以动画保证产业收益，也不替代实地调查。'),
  prose('vegetation', 84, '植被与环境的适应', ['热带雨林', '常绿阔叶林', '落叶阔叶林', '亚寒带针叶林', '热带草原', '温带草原', '荒漠植被'], '依正文82—87页比较代表性植被结构与环境适应。各类型分项观察，不是同一地点的连续演替；树木与草株不表示实测株数及高度。'),
  prose('soil-composition', 88, '土壤的四种组成', ['较干', '适中', '较湿'], '依正文88页分辨矿物质、有机质、水分和空气。增加孔隙水时空气空间减少；颗粒大小与各组成比例为示意，不代表实际土样。', .25),
  prose('soil-texture', 89, '砂土、壤土与黏土', ['砂土', '壤土', '黏土'], '依图5.16，在同一场示意降水下对比三种土壤质地的下渗、留存与出流。点击土柱强调观察，不改变三柱的降水和进度；拖动水滴可回看，末尾保留结果，点回卷纸签重新降雨。水量份额、孔隙、颗粒与速度均为教学设定，不能据此选定田间灌溉量。', .25),
  prose('soil-factors', 91, '土壤形成的因素', ['成土母质', '生物循环', '气候作用', '时间与土层', '地貌与颗粒'], '依正文91—92页分项观察成土母质、生物、气候、地貌与时间的共同作用。颗粒分选仅表示水流搬运的一种示意关系，不是全部成土因素，也不表示真实侵蚀或成土速率。'),
  prose('soil-care', 94, '土壤水盐运动与养护', ['蒸发返盐', '引淡淋盐', '覆盖抑蒸发'], '依图5.21，三项条件从相同水盐示踪开始。覆盖减弱蒸发与返盐，不直接去除已有盐；淋洗须配合排水，同一批盐标记随排水离开土柱并保留部分盐。金色标记表示溶解盐而非盐晶，数量与进度均为教学设定；本模型不计算盐浓度和用水量，不是田间治理处方。'),
  prose('urban-waterlogging', 97, '问题研究 · 城市不再看海', ['硬化地面', '透水地面', '雨水花园'], '依正文96—98页，在相同示意降水下比较径流、下渗和蓄积。雨水花园延缓径流，不保证任何暴雨下都不积水；不套用特定案例削减率。'),
  prose('flood', 100, '洪涝与低地积水', ['正常水位', '连续强降水'], '依正文100—101页展示持续强降水、汇流增加与淹没低地的一种联系。水位与时长不用于真实预警；灾害损失还与人口设施及防御条件有关。'),
  prose('drought', 102, '干旱与水分不足', ['水分充足', '持续少雨'], '依正文101—102页展示少雨、土壤缺水、水源减少与作物受影响的联系。水位和植株变化只表示趋势，不给出产量损失或旱情阈值。'),
  prose('cold-wave', 104, '寒潮中的冷空气推进', ['冷空气到来前', '冷空气推进'], '依正文104页显示冷空气推进、大风和降温的联系。推进方向、温差及动画时间为示意；是否构成寒潮须依据实际降温幅度和温度标准判断，不以画面替代预警。'),
  prose('disaster-chain', 109, '自然灾害的关联', ['旱灾关联', '地震关联'], '依正文108—109页活动及115页案例，展示有条件的灾害链：沿海缺水后加抽地下水，松软层压密并发生咸水入侵；松散陡坡滑移堵河，上游蓄湖，在选定溃决情景下形成下游洪水。海面保持稳定，抽水井和滑坡体可重放当前情景。一次灾害并非必然产生全部后果，不模拟概率、预报或真实时长。'),
  prose('gnss', 116, '全球卫星导航系统与救援', ['卫星与地面', '接收定位', '定位助救援'], '依正文116页区分空间、地面控制和用户三部分，并参照114页定位与通信协同求救案例。卫星数、轨道和路径为示意，不计算定位精度；并非所有GNSS接收机都能发送卫星求救。'),
  prose('warehouse', 121, '问题研究 · 救灾物资储备库', ['近河低地', '路网节点', '偏远山地'], '依正文120—121页，在虚构地形与路网上比较灾害暴露、通达与服务范围。不是现实选址结论，不计算24小时覆盖，也不推荐任何真实地点。'),
];
