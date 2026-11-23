# 整册场景造型与验收台账 · 当前源码复核 2026-11-11

## 2026-11-20 水实验组 · index-Xd90qJ0J.js

| 场景 | 主体改造 | 当前检查与主看 | 用户认可 |
| --- | --- | --- | --- |
| density | 原生 Blender 镂空称重横梁、同体积瓷盏和三点铅直吊架 | 三分支两种视口及实体选择，主看只降温和形成帧 | 待反馈 |
| salinity | 原生 Blender 共用瓷衬剖槽、三种进出水件、独立水位读数和进度导柱 | 三分支关键状态、实体正反拖动，主看降水、河流和形成帧 | 待反馈 |
| desalination | 原生 Blender 双分支，冰体格栅与带实际开孔的转篮共用集液槽 | 两种方法、手柄点击和终点保留量，主看离心、重力与形成帧 | 待反馈 |

见 [实拍与原生渲染](visual-Xd90qJ0J/本版复核.md)。其余 B6 场景（water、water-renewal、temperature）继续逐件核对主体。其余批次保持原有范围和逐分支要求。

> 当前接续入口：`../整册接续执行计划_20261111.md`、`reconstruction-index.md`、`reconstruction-manifest.json`。下方行表为历史源审，部分入口已漂移：cosmic-scale现为独立cosmic-instrument-world；habitable现为独立habitable-world；vegetation现为独立vegetation-world；mars-base现为独立mars-base-world＋mars-cabin。新清单为63项唯一批次归属与228历史分支基线，不继承验收。当前火星纵向厚壳首轮、生命条件遮陆修复、灾害链新生产复验的四级证据见style-review顶部与verification/reconstruction-20261111.json；三项都没有用户审美认可。

任务仍是**先修改整个项目，最后录屏**。本台账只更新证据口径，不修改 src、不构建、不启动全册浏览器截图。目录、profile 与历史清单交叉核对为 **63 个场景：60 个原有内容＋3 个综合拓展**，ID集合与原页位置一致。教材封面和原页底子保留，模型在书页上方形成。

## 判定口径

- **主体专改已接入**：当前分发实际进入新造型，结构有真实连接或连续自然表面；不表示达到用户要求。
- **部分主体重建**：明确限定分支或自然表面，不用一个好分支代表全项。
- **既有专题主体**：已有科学几何与互动；本轮未找到足够专项主体重建证据。不能因文件名专用就算重建完成。
- **共享包装**：实体材质、光照、刚性形成与 profile/可选支承为通用基础；不单独证明主体美术完成。表中 support 是当前共享配置，none 也可能已有自己构建的实际轴座。
- **子看**＝专项执行者明确记录亲看；**主看**＝主线程明确记录亲看，并尽量绑定版本。只有截图/JSON存在时不写“已亲看”。旧版本主看不自动延伸到新版本。
- 所有行均为**用户尚未认可**；所有分支、真实触屏、离线包及整册最终视觉验收尚未完成。不计算伪精确完成百分比。

旧 scene-ledger.json 保留为当时的源函数抽样快照，**未随本次 markdown 重生成**。其中 selection、SVG检查、节点数量和“3个候选、51待迁移”是历史统计，不作为当前主体状态或当前全套验证结果。下表以当前 illustration 分发及其包装函数为准。

## 已读取的专项证据索引

| 代码 | 证据（工作区相对路径） | 实际证明及边界 |
|---|---|---|
| E | work/instrument-atlas-20261110/earth-instrument/CHECKPOINT.md | 专项7单测、真实手轮/锁扣与抽层；子看 |
| I | work/instrument-atlas-20261110/insolation-optics/CHECKPOINT.md | 专项16单测；真实光阑正反拖、同位与buffer复用；子看 |
| A | work/instrument-atlas-20261110/atmosphere/CHECKPOINT.md | 专项14单测、原生拖探针/层标签；子看三高度 |
| M | work/instrument-atlas-20261110/material-refinement/CHECKPOINT.md | 历史生产 index-Ok-dnQ6U：23项检查、六场景七图主看；不覆盖后续新几何 |
| O | work/instrument-atlas-20261111/orrery/review-source.json | 实机20项、0失败/错误、手轮/行星/反拖；reviewedEntry为源入口，final-built文件名不能当生产证据 |
| S | work/precision-family-20261111/solar/CHECKPOINT.md | 以末尾Stable production closure为准；太阳26项及盐度/地层13项生产检查，主看明确绑定；不累加早期重复测试 |
| H | work/precision-family-20261111/strata/CHECKPOINT.md | 最终双外导杆图子看；完整647通过/34旧title断言失败如实保留，窄复测4项通过，不能称全套通过 |
| G | work/instrument-atlas-20261111/geological-specimens/CHECKPOINT.md | 四叶雕塑标本册13单测；子看八图；32通过/8旧几何计数失败及窄稳定复测并列 |
| Q | work/precision-family-20261111/seismic/CHECKPOINT.md | 专项15单测、Chrome21项及子看；无完整生产验收 |
| P | work/instrument-atlas-20261111/air-instruments/CHECKPOINT.md | 压差/受热/环流主体专改；专项13单测与Chrome13项、子看 |
| R | work/style-correction-20261111/CHECKPOINT.md | 后续梁脚、同高面修正；生产index-BPxJPHm8，主看1024压力/环流 |
| F | work/reference-fidelity-20261111/CHECKPOINT.md | 更晚index-DlbvmLsp；表盘字/连续土体修正；air13项及soil-care39项；主看当前压力/环流/土体 |
| C | work/instrument-atlas-20261111/coastal-reconstruction/rounded-review.json | 源预览20项、4状态、实际中间形成，0错误；不据JSON推断主看 |
| B | work/instrument-atlas-20261111/basin-refinement/CHECKPOINT.md | 标本山脊/五片主体；专项4单测和5状态、子看；地下水取景有待决定 |
| W | work/instrument-atlas-20261110/water-renewal/CHECKPOINT.md | 当前内容日期为11日；8单测、34项源Chrome及子看；水/透明件阴影细带未关 |
| L | work/precision-family-20261111/salinity/CHECKPOINT.md | 连续槽主体、24盐/18水身份；专项113项、平面6项，子看形成；生产证据另见S |
| D | work/instrument-atlas-20261111/density-instrument/CHECKPOINT.md | 专项4单测、Chrome25项；最终3原生铭牌窄复测；主看仅早期版本 |
| V | work/instrument-atlas-20261111/vessel-refinement/desalination-review.json | 8项、5状态、0错误；源预览及中间形成；并非整册生产验收 |
| T | work/instrument-atlas-20261111/soil-instruments/CHECKPOINT.md | 孔隙/三土柱27单测；texture57项及atlas46项；子看，未变成主看 |
| A0 | work/air-counting-instrument-20261111/production-review.json＋主线程本轮亲看说明 | 正式入口index-Cu_mxpiD；13项原生检查、0页面错误；主看1440/1024/调角/准确原图形成中间态。专项4项＋其余13项既有相关测试通过，不重复叠加旧批次。视觉仍平面、副铭偏小，不写审美达标 |

历史构建号只绑定该记录时点，不能宣称本表全部处于其中任何一个包。台账本身没有跑新测试，也没有把源码派生状态当成新画面证据。

## 当前63项逐项覆盖

“未证实本轮专改”不表示没有动画，也不表示应当整项推倒；优先按下方最弱5项推进。

| ID／教材正文页 | 当前实际主体入口 | 家族／共享support | 主体状态及可见机制 | 证据与亲看范围 | 下一限制 |
|---|---|---|---|---|---|
| cosmic-scale **优先**／3 | `src/textbook-models-sky-extra.ts` → `cosmicScale` | orrery／none | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| solar／3 | `src/textbook-orrery-world.ts` → `buildOrreryWorld` | orrery／none | **主体专改已接入**；独立轮系、轨道承托、同态手轮 | O；专项实机；主看证据未明确 | 检查当前生产形成与低分辨率金属层次 |
| habitable **优先**／6 | `src/textbook-models-sky-extra.ts` → `habitable` | cutaway／bearing | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| solar-distribution／9 | `src/textbook-insolation-world.ts` → `buildInsolationWorld` | cutaway／none | **主体专改已接入**；真实光学滑架、光阑与同源光束 | I、M；子看＋主看历史生产 | 新共享光照后仍需当前版本复看 |
| sun／9 | `src/textbook-solar-heating-world.ts` → `buildSolarHeatingWorld` | vessel／none | **主体专改已接入**；供热房屋剖面、集热器、闭合管接及泵 | S；主看指定生产形成帧 | 当前尺寸下细连接可读性仍待提高 |
| solar-activity／11 | `src/textbook-sky-causality-world.ts` → `buildSolarDisturbanceWorld` | orrery／none | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| history／15 | `src/textbook-strata-world.ts` → `buildStrataWorld` | strata／none | **主体专改已接入**；闭合厚岩层、嵌入化石、每柱外侧导杆与层夹 | H、S；子看＋主看最终外导杆图 | 规则切块、化石浮雕与细五金质感仍弱 |
| geo-time／16 | `src/textbook-geological-specimen-world.ts` → `buildGeologicalSpecimenWorld` | strata／none | **主体专改已接入**；连续铰轴四叶标本册、层叠断口及重塑生物 | G；子看当前八图；主看版本未绑定 | 专项旧失败项与窄复测须并列保留 |
| seismic-waves／21 | `src/textbook-seismic-instrument-world.ts` → `buildSeismicInstrumentWorld` | vessel／none | **主体专改已接入**；P珠列联轴弹簧；S导杆、滑套与剪切联接 | Q；子看当前状态及原生操作 | 尚无当前生产主看与形成验收证据 |
| earth／22 | `src/textbook-earth-instrument-world.ts` → `buildEarthInstrumentWorld` | cutaway／none | **主体专改已接入**；开敞子午弓、抽层导轨与丝杆滑架 | E、M；子看＋主看历史生产 | 新共享光照后仍需当前版本复看 |
| external-spheres／23 | `src/textbook-sky-causality-world.ts` → `buildSphereExchangeWorld` | terrain／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| mars-base **优先**／26 | `src/textbook-sky-causality-world.ts` → `buildMarsTransferWorld` | vessel／paired-skids | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| air-composition／28 | `src/textbook-air-counting-world.ts` → `buildAirCountingWorld` | vessel／none | **主体专改已接入；专项技术验证**；百格计数装置；已由当前分发连接新模块 | A0；主看当前生产1440/1024/调角/形成中间态 | 平面感仍在，1024副铭偏小；不等于审美达标 |
| atmosphere／31 | `src/textbook-atmosphere-world.ts` → `buildAtmosphereWorld` | air／section-feet | **主体专改已接入**；双导杆探针、三段样片与开敞定性温度轨道 | A、M；子看＋主看历史生产 | 形成逐帧、真实触屏和当前生产复看未完 |
| heating／34 | `src/textbook-air-process-world.ts` → `buildAirProcessWorld` | air／none | **主体专改已接入**；受热标本支架与同源受热指示 | P；子看专项 | 当前生产主看未明确；仍须核对字与实体尺度 |
| greenhouse／35 | `src/textbook-sky-causality-world.ts` → `buildGreenhouseResponseWorld` | air／section-feet | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| thermal／36 | `src/textbook-air-process-world.ts` → `buildAirProcessWorld` | air／none | **主体专改已接入**；双比较梁、六表盘、同高冷热环流装置 | P、R、F；主看当前生产 | 表盘字已整合；主体小、材质纵深仍不足 |
| breeze／38 | `src/textbook-coastal-world.ts` → `buildBreeze` | coast／none | **主体专改已接入**；圆润连续海岸主体、地景与同源昼夜环流 | C；专项实机；主看仅早期版本 | 当前 rounded 图须主看，不能沿用旧生产认可 |
| pressure-wind／38 | `src/textbook-pressure-world.ts` → `buildPressureWind` | air／none | **主体专改已接入**；同高双表与实际梁脚、后轴和原生旋钮 | P、R、F；主看当前生产 | 薄小配件在1024视口仍偏弱 |
| wind-forces／39 | `src/textbook-sky-causality-world.ts` → `buildWindForceParcelWorld` | mapping／map-pins | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| haze／43 | `src/textbook-haze-world.ts` → `buildHazeWorld` | hazard／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| basin-system／47（拓展锚页） | `src/textbook-integrated-world.ts` → `buildBasin` | terrain／corner-shoes | **主体专改已接入**；五片流域标本、山脊、形随托盘和实际轴座 | B；子看专项；主看仅早期版本 | 地下水近景上界可能裁新峰顶，待主线程定取景 |
| water／47 | `src/textbook-water-cycle-world.ts` → `buildWaterCycleWorld` | coast／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| water-renewal／48 | `src/textbook-water-renewal-world.ts` → `buildWaterRenewalWorld` | vessel／none | **主体专改已接入**；补给主筒、低位取水接收、前置质量样本及真阀 | W；子看专项34项 | 水面/透明件阴影细带未关；缺当前生产主看 |
| temperature／50 | `src/textbook-temperature-world.ts` → `buildTemperatureWorld` | vessel／section-feet | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| salinity／52 | `src/textbook-salinity-world.ts` → `buildSalinityWorld` | vessel／none | **主体专改已接入**；连续开口搪瓷槽、卷边、真入口及浮子联动 | L、S；子看＋主看指定生产 | 1024主体偏小；不能用全景代表所有状态 |
| density／55 | `src/textbook-density-world.ts` → `buildDensityInstrumentWorld` | vessel／none | **主体专改已接入**；等体积悬杯天平、轴承、立柱与前缘原生旋钮 | D；子看；主看第一版 | 最终小铭牌版主看未明确，缺生产形成验证 |
| waves／57 | `src/textbook-wave-world.ts` → `buildWaveWorld` | coast／paired-skids | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| tides／59 | `src/textbook-tide-world.ts` → `buildTideWorld` | coast／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| currents／61 | `src/textbook-current-world.ts` → `buildCurrentWorld` | coast／paired-skids | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| desalination／64 | `src/textbook-desalination-instrument.ts` → `buildDesalinationInstrumentWorld` | vessel／none | **主体专改已接入**；方法专属接收器与真实离心承载装置 | V；专项实机8项、5状态 | 现有报告为源预览；截图存在不等于主看 |
| karst／67 | `src/textbook-karst-world.ts` → `buildKarstWorld` | terrain／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| karst-cave／68 | `src/textbook-foundation-process-world.ts` → `buildCaveDepositionWorld` | terrain／section-feet | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| river-valley／69 | `src/textbook-models-land-extra.ts` → `riverValley` | terrain／corner-shoes | **部分主体重建已接入**；河谷切面及自然表面已改 | 当前源码可见；逐分支主看未证实 | 验证山地/平原真实河床与闭合侧面 |
| river／70 | `src/textbook-river-world.ts` → `buildRiverWorld` | terrain／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| delta／71 | `src/textbook-delta-world.ts` → `buildDeltaWorld` | terrain／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| aeolian／73 | `src/textbook-models-land-extra.ts` → `aeolian` | terrain／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| coastal-landform／74 | `src/textbook-coastal-process-world.ts` → `buildCoastalProcessWorld` | coast／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| slope／77 | `src/textbook-slope-world.ts` → `buildSlopeWorld` | terrain／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| terrain-observation／77 | `src/textbook-models-land-extra.ts` → `terrainObservation` | terrain／corner-shoes | **部分主体重建已接入**；同一地形切块与自然表面已改 | 当前源码可见；逐分支主看未证实 | 保持四种观察量；检验标签与参照尺 |
| karst-livelihood／80 | `src/textbook-models-land-extra.ts` → `karstLivelihood` | terrain／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| forest／83 | `src/textbook-forest-world.ts` → `buildForestWorld` | forest／specimen-clips | **已有专门标本主体**；乔灌草并存、连续观察高度；不能归为仅共享支脚 | 专题源码；当前本轮主看未证实 | 检查真实树冠材质、层面遮挡和原生侧签 |
| vegetation／84 | `src/textbook-models-land-extra.ts` → `vegetation` | forest／specimen-clips | **部分主体重建已接入**；连续树冠、枝干、藤本和板根；七类不能互相代验 | 既有专项源改；当前完整主看未证实 | 核验七种独立形态和低视口轮廓 |
| soil-composition／88 | `src/textbook-soil-pore-world.ts` → `buildSoilPoreInstrument` | vessel／none | **主体专改已接入**；同空间团聚体、五处真孔隙与互补水气体积 | T；子看专项 | 保留孔隙体积科学约束；缺当前生产主看 |
| soil-texture／89 | `src/textbook-soil-texture-world.ts` → `buildSoilTextureWorld` | column／none | **主体专改已接入**；三开口土柱、同量雨头、空心喷嘴与三接收器 | T；子看专项 | 三分支同屏与反拖已查；缺当前生产主看 |
| soil／89 | `src/textbook-soil-profile-world.ts` → `buildSoilProfileWorld` | column／specimen-clips | **已有专门标本主体**；闭合六层抽取剖面与保留迁移结果 | 专题源码；当前本轮主看未证实 | 查六层抽出/复原、标签随动及连接 |
| soil-factors **优先**／91 | `src/textbook-models-land-extra.ts` → `soilFactors` | column／specimen-clips | **仅部分分支专改**；selection 4 接 soil-sorting；0–3仍为盒层、碎粒、管根 | 当前分发可见；其余分支无主体专改证据 | 只改0–3；不能重做已专门化的地形分选 |
| soil-care／94 | `src/textbook-soil-care-world.ts` → `buildSoilCareWorld` | column／none | **主体专改已接入**；连续土体、真实观察轨夹持及同一批盐迁移 | F；主看当前生产3条件 | 深裂纹已撤；仍有软块感且1024偏小 |
| city-rain-system／97（拓展锚页） | `src/textbook-integrated-world.ts` → `buildCity` | hazard／corner-shoes | **已有针对性连续主体**；当前调用 urban-water 专题地景，综合界面复用 | M；主看早期生产 | 历史视图不能代表当前共享材料；查地下窗口 |
| urban-waterlogging／97 | `src/textbook-urban-water-world.ts` → `buildUrbanWaterWorld` | hazard／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| flood／100 | `src/textbook-models-water-risk-extra.ts` → `buildFlood` | hazard／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| drought／102 | `src/textbook-models-water-risk-extra.ts` → `buildDrought` | hazard／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| typhoon／103 | `src/textbook-typhoon-world.ts` → `buildTyphoonWorld` | air／section-feet | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| cold-wave／104 | `src/textbook-cold-wave-world.ts` → `buildColdWaveWorld` | hazard／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| earthquake／107 | `src/textbook-quake-world.ts` → `buildQuakeWorld` | hazard／section-feet | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| slide／108 | `src/textbook-landslide-world.ts` → `buildLandslideWorld` | hazard／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| disaster-chain／109 | `src/textbook-disaster-chain-world.ts` → `buildDisasterChainWorld` | hazard／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| mitigation／111 | `src/textbook-recovery-world.ts` → `buildRecoveryWorld` | hazard／corner-shoes | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| remote／114 | `src/textbook-remote-world.ts` → `buildRemoteSensingWorld` | mapping／map-pins | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| gnss／116 | `src/textbook-gnss-world.ts` → `buildGnssWorld` | mapping／map-pins | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| gis／117 | `src/textbook-gis-world.ts` → `buildGisWorld` | mapping／map-pins | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| quake-response-system／120（拓展锚页） | `src/textbook-integrated-world.ts` → `buildQuakeResponse` | hazard／section-feet | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |
| warehouse **优先**／121 | `src/textbook-models-water-risk-extra.ts` → `buildWarehouse` | mapping／map-pins | **既有专题主体；未证实本轮专改**；已有科学过程几何；仅可确认共享材质/形成/配置支承桥接 | 当前分发与源码；无本轮逐项主看证据 | 须按独立条件看主体、形成、字和原生操作 |

## 最弱5项：尚未有完整主体专改证据

此排序为本次源审判断，尚未通过最新画面逐项对比。目标是让因果关系成为可读实体，保留科学状态与已有交互，避免给旧盒子加一圈装饰。

1. **habitable（第6页）**：当前地球、独立水滴/圆柱和三圈空气仍分离。改成同一个地球标本的三个可观察条件：地表水位置随真实球面，薄透大气围绕球体，入射光与受光面同位。条件选择只揭示局部，不让其余必要条件凭空消失；不把条件演示成生命发生模拟。共享bearing不能算主体已完成。
2. **cosmic-scale（第3页）**：当前四组独立圆环、球、三螺旋管和椭球群，细竖杆支起，隶属更多靠标签连线。用四级薄标本的嵌套观察窗与真实边界关联，选中某一级时露出其所属位置，镜头尺度变化只服务关系；必须写清示意非真实比例，不能做成四层物理硬壳。
3. **soil-factors的0–3分支（第91页）**：当前localBox母岩/母质/矿物/有机层、散碎粒和管根仍主导；selection 4已接专门分选，不在此重做。让母质风化剥离留下连续断口、根进入实际孔道、枯落物落在同一表面，保留原粒子身份和有后果的过程，四条件应分别验。
4. **warehouse（第121页）**：已有贴地路线、固定洪水暴露及可比较库址，有科学价值；主体仍是通用山坡、房屋和管状路线。围绕三个库址建立同一地形/河道/道路的精制实物地图，库房和门口接路，积水范围与低地接触成立，选址时直接突出受阻路段和实际服务终点。不可用无依据的精确分数、时长代替证据。
5. **mars-base（第26页）**：已有真实接收端响应和区分水/气体/食物的身份，不能说成纯装饰；但四圆柱穹顶、平窗、外贴小方块接收器仍较粗。用少量实际舱段剖口、法兰端口与连续管线，把滤芯/储水/植物反应嵌回本舱，材料抵达可见接口后产生变化。四系统沿同一进度，保留非完全闭合及需补给边界，不伪装工程方案。

已经实质专改的地层、年代册、密度、海冰、水更新、孔隙、三土柱、水盐、地震波与百格装置不再进入“从零迁移”队列。其剩余工作是当前生产亲看、取景与材料深度收敛，不能重复建模来制造进度。

## 下一个验收关口

1. air-counting当前生产专项技术QA已记录在A0，后续针对平面感和1024副铭偏小收敛；不能将13项操作检查当成整册或美学验收。
2. 优先收敛已接入主体的可读大小、连续连接与材质层次。最新明确主看结论仍低于用户要求，尤以1024主体偏小和五金屏幕尺度太细为限；无用户审美认可。
3. 之后逐项补上未覆盖的形成中间态、收回翻页、原生可点部位、正反拖、全部独立条件与二维/低画质等必要验收。真实平板与离线包仍不得用桌面模拟替代。
4. 项目整体通过后再做竖屏录屏，保留原书页到空间实体的形成，不先用运镜遮掩主体不足。
