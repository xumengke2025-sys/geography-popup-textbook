import fs from 'node:fs/promises';
import crypto from 'node:crypto';

// Planning coverage only. Do not turn historical smoke checks into acceptance.
const input = 'docs/handoff/catalog-branch-inventory.json';
const raw = await fs.readFile(input, 'utf8'), inventory = JSON.parse(raw);
const batches = [
  ['B1', 'forest vegetation soil-composition soil-texture soil soil-factors soil-care'],
  ['B2', 'cosmic-scale solar habitable solar-distribution earth'],
  ['B3', 'sun solar-activity external-spheres mars-base'],
  ['B4', 'history geo-time seismic-waves'],
  ['B5', 'air-composition atmosphere heating greenhouse thermal breeze pressure-wind wind-forces'],
  ['B6', 'water water-renewal temperature salinity density desalination'],
  ['B7', 'waves tides currents coastal-landform'],
  ['B8', 'karst karst-cave karst-livelihood aeolian'],
  ['B9', 'river-valley river delta slope terrain-observation'],
  ['B10', 'haze flood drought typhoon cold-wave'],
  ['B11', 'earthquake slide disaster-chain mitigation urban-waterlogging'],
  ['B12', 'remote gnss gis warehouse'],
  ['B13', 'basin-system city-rain-system quake-response-system'],
];
const targets = {
  'cosmic-scale': '四级常驻标本的所属联系与主体体积；连接退后，示意尺度明确',
  solar: '行星与细轨道在同一轮系承托，手轮连同一进度；不伪装真实比例周期',
  habitable: '一颗可见陆海的地球，温度/水/气共存；薄大气不遮陆，不模拟造生命',
  'solar-distribution': '同束光入射真实曲面，光斑贴球；光阑和观察纬度共轴',
  sun: '集热器—水路—储水—室内接收闭合，房屋剖面避开观察线',
  'solar-activity': '日地传播路径与极区接收，扰动有到达次序，不直喷地面',
  history: '两柱连续自然断面、六层九化石对应，外导向避开连线与抽样',
  'geo-time': '铰轴标本册的页厚/断口/代表生物；四时期不冒充等时长',
  'seismic-waves': 'P/S联接与介质共轴，追踪同一质点，液体无S传播',
  earth: '闭合球壳的真实切面与抽层路径，极轴承托，核层独立可见',
  'external-spheres': '同一岩土/水/植物/空气环境，跨圈层迁移留在实际接收端',
  'mars-base': '统一厚壳剖开舱段、舱内设备与接头，取消整块矩形板主导；四回路边界保留',
  'air-composition': '开放百格体积分数立体教具，局部展开仍保留整体分母',
  atmosphere: '开放垂直剖面与同源曲线探针，去玻璃砖，固定高度与观察焦点',
  heating: '短波—地表—长波—吸收分离但相接，接收体随实际到达响应',
  greenhouse: '同地表三条件对照，低云/大气为开放层，不成密封玻璃盖',
  thermal: '冷热标本与同高梁一体，垂直/水平闭环；控制接入同一机构',
  breeze: '海岸水下切面、风旗和日月柄整体，临界弱风与反向同源',
  'pressure-wind': '同高比较面与指示器共梁，差压输入对应风旗，零差压边界准确',
  'wind-forces': '薄地图等压线与风/力向量，四条件独立比较，不强加时间演化',
  haze: '同城市排放—输送—滞留—迁出，污染存量不因减排瞬间清零',
  water: '山海地下水连续切块，六示踪跨状态同身份，三循环独立',
  'water-renewal': '同储水体可见补给/取用/污染口，数量与可用性分开',
  temperature: '开放深水剖面、切片与探针同曲线，不将观测深度画成水位',
  salinity: '开口槽与三输入/固定盐示踪/水位共状态，蒸发不带盐',
  density: '等体积样本的质量比较，轴承/悬杯/指示同机构；不暗改体积',
  waves: '水槽剖面与表面波一体，同质点闭合往复，不随波峰迁走',
  tides: '岸滩/水下地形/水位杆/浮舟同高度，潮间带可见',
  currents: '十二水体身份净迁移与原位往复参照，保留首末位置',
  desalination: '冰体真盐水通道、有限收集端与离心同轴，残余盐水可见',
  karst: '有闭合侧面与裂隙的可溶岩体，六形态独立，水进入真实表面',
  'karst-cave': '剖壳后的真洞腔，顶底沉积与滴水接触，观察侧可开合',
  'river-valley': '山地/平原两类自然河谷与河床连续，可比取景，非强制演化',
  river: '同岸线/水/流路冲颈、接通、两端淤塞，牛轭湖结果保留',
  delta: '水下基底与不对称分汊连通，有限泥沙落点改变沉积与岸线',
  aeolian: '风蚀岩、雅丹、沙丘与固沙分别造型，迎背风和堆积落点成立',
  'coastal-landform': '岩壁真凹槽/平台/崩落体，拱桥柱滩分支独立，崩落不消失',
  slope: '同网格等高线连续抬升，甲乙点贴地；879.0/885.4/6.4关系保留',
  'terrain-observation': '同地形的高程基准/坡尺/方向，四观察量不改自然对象',
  'karst-livelihood': '峰丛薄土/地下通道/农业接触，雨涝晴旱与水土去向可追踪',
  forest: '冠干灌草根土共一片标本，观察面滑移不删除其他层',
  vegetation: '七类枝冠根叶轮廓分别构建，林下有层次，低矮植被独立取景',
  'soil-composition': '真实团聚体和互补孔隙，水气在同空间替换，去悬浮分项',
  'soil-texture': '三柱统一入水与独立接收，颗粒/水保身份，质地差异可见',
  soil: '六层自然连续断面与低位夹持，抽层/标签/24物质同向且有留存',
  'soil-factors': '岩土断口、根孔/枯落物与风化接触；0—3与分选4分别验',
  'soil-care': '地下水/毛管/土面/排水口连续，返盐淋盐抑蒸各有去向',
  'urban-waterlogging': '同街区三地面与有限雨水，下渗暂存排出接收区可见',
  flood: '同河床低地建筑水位，积水随实际地形接触，不整片蓝面遮盖',
  drought: '水分亏缺—水体减少—植被响应共环境，不仅变黄加裂纹',
  typhoon: '真实眼洞和眼墙层次，北半球四股运动为观察序列非形成史',
  'cold-wave': '连续冷锋前缘与同测站风温响应，到达时刻一致',
  earthquake: '断层/震源/监测与近远接收点，波到站后处理通信；震后预警',
  slide: '可分滑体/母体与沟谷碎屑/堆积分别动作，有限物料留下',
  'disaster-chain': '井—含水层—压密/盐界及滑坡—堵河—蓄湖—洪水两链独立',
  mitigation: '玉树搜救与北川恢复独立环境，阶段结果与设施接收端保留',
  remote: '太阳—地物—传感—接收—处理—成果同十二样本身份',
  gnss: '空间/控制/用户与通信端分离，定位后经通信才发送',
  gis: '同坐标两信息源薄层对位及派生计数；33身份和5/15/13保留，字清楚',
  warehouse: '同地形河道路网三库址，门口接路，受阻路段到服务终点连续',
  'basin-system': '山地—河口共流域地形；本次水路与长期沉积不同时间尺度',
  'city-rain-system': '同街区可开地下剖面，有限雨水分配守恒，三条件相同布局',
  'quake-response-system': '同灾后地形上影像/定位/通信/道路核验/方案分状态，未知路不提前通行',
};
const assignments = batches.flatMap(([batch, ids]) => ids.split(' ').map(id => ({ batch, id })));
const ids = inventory.map(x => x.id), planned = assignments.map(x => x.id);
if (inventory.length !== 63 || new Set(ids).size !== 63 || planned.length !== 63 || new Set(planned).size !== 63
  || ids.some(id => !planned.includes(id) || !targets[id]) || planned.some(id => !ids.includes(id))
  || inventory.filter(x => x.extension).length !== 3 || Object.keys(targets).length !== 63)
  throw Error('Plan must assign exactly the current 60 original and 3 extension IDs once, with a subject target.');
const scenes = assignments.map(({ batch, id }) => {
  const x = inventory.find(x => x.id === id);
  return { id, title: x.title, printedPage: x.printedPage, extension: x.extension, batch, family: x.profile.family,
    subjectTarget: targets[id], baselineControls: x.controls, baselineSelectionLimit: x.selectionLimit,
    branches: x.branches.map(b => ({ selection: b.selection, control: b.publicControl,
      phases: [...new Set([0, .25, .5, .75, 1, ...(b.samplePhases ?? []), ...(x.controlPhases ?? []),
        ...(b.timelineStops ?? []).map(s => s.phase)].filter(Number.isFinite))].sort((a,b) => a-b),
      inspectionTargets: b.inspectionTargets, nativeAdditionalTargets: b.nativeAdditionalTargets, actions: b.actions,
      verification: 'unverified-current-build' })),
    evidence: { implementation: 'existing-needs-current-source-audit', subjectReconstruction: 'pending-review',
      tests: 'not-inherited-from-history', visuallyInspected: [], userApproval: 'pending', productionEntry: null },
  };
});
const manifest = { version: 1, generatedAt: new Date().toISOString(), purpose: 'implementation plan, not acceptance evidence',
  sourceInventory: { path: input, sha256: crypto.createHash('sha256').update(raw).digest('hex'),
    limitation: 'Historical branch baseline; reconcile current UI, native selections, actions and source at each batch.' },
  counts: { scenes: 63, original: 60, extensions: 3, baselineBranches: scenes.reduce((n,x) => n+x.branches.length,0) }, scenes };
await fs.writeFile('docs/handoff/reconstruction-manifest.json', JSON.stringify(manifest, null, 2)+'\n');
const rows = scenes.map(x => `| ${x.batch} | ${x.id}／${x.title} | ${x.printedPage} | ${x.family} | ${x.branches.map(b => `${b.selection}:${b.control ?? '实体/内部部位'}`).join('；')} | ${x.subjectTarget} |`);
await fs.writeFile('docs/handoff/reconstruction-index.md', `# 63项主体重构执行索引\n\n生成自当前计划分配与历史分支基线。不是验收结果。每行须核对当前源码及UI；机器清单保留全部分支、节点、实体部位及actions基线，不继承历史通过。\n\n总计60原有＋3拓展；分支基线${manifest.counts.baselineBranches}项。每分支至少0/.25/.5/.75/1及公开节点，静态观察标明时间轴不适用。\n\n| 批次 | ID／标题 | 正文锚页 | 构造家族 | selection基线 | 整件主体与关键边界 |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`);
console.log(JSON.stringify(manifest.counts));
