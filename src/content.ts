export interface SourceReference {
  title: string;
  url: string;
  note: string;
}
export interface LessonDefinition {
  id: string;
  title: string;
  sourceRefs: SourceReference[];
  learningObjectives: string[];
  prediction: string[];
  observationSteps: { title: string; text: string }[];
  experiments: string[];
  explanation: { title: string; text: string; summary: string }[];
  challenge: {
    label: string;
    options: string[];
    answer: string;
    hint: string;
  }[];
}
export const lesson: LessonDefinition = {
  id: "sea-breeze",
  title: "海边的风，为什么会转向？",
  sourceRefs: [
    {
      title: "人教版《地理 必修 第一册》教材文本",
      url: "https://github.com/AsahiLuna/china-text-book-md/blob/ac26624dccf4df0ecebfb1d750e484285eb9f53d/高中_地理_人教版-人民教育出版社_普通高中教科书·地理必修%20第一册.md",
      note: "固定提交 ac26624；正文 34—35 页受热过程，36 页热力环流，38 页海陆风活动与水平气压梯度力。",
    },
    {
      title: "Every Joule · 第一课参考实现",
      url: "https://github.com/iamtechartist/every-joule-lesson1/tree/48591ddc5f0a22e6eb2a5a41c424a426599061ca",
      note: "固定提交 48591dd；直接改编其书本、纸面、笔触、模型展开、翻片及底栏代码；海陆风模型和中文内容另行编写。原仓库未附许可证。",
    },
  ],
  learningObjectives: [
    "用海陆冷热差异解释局地环流。",
    "判断近地面、高空和垂直方向的气流。",
    "在同一高度比较相对气压。",
    "换一幅海岸布局，仍能独立判断风向。",
    "按风的来向区分海风与陆风。",
    "说明模型条件与真实风的影响因素。",
  ],
  prediction: [
    "从海洋吹向陆地",
    "从陆地吹向海洋",
    "海陆之间只发生垂直空气运动",
  ],
  observationSteps: [
    { title: "看冷热", text: "午后，陆地比海洋升温更明显。先比较两侧的冷热。" },
    { title: "看升降", text: "较暖的陆侧空气上升，较冷的海侧空气下沉。" },
    {
      title: "比气压",
      text: "分别比较近地面和高空。每一条虚线带都只比较同一高度。",
    },
    { title: "看水平运动", text: "近地面从海洋吹向陆地；高空从陆地返回海洋。" },
    {
      title: "看完整环流",
      text: "上下、左右的气流相联系。近地面的海风使旗子朝陆地方向展开。",
    },
  ],
  experiments: [
    "保存午后与夜间的观察，比较风从哪里来。",
    "慢慢拖动昼夜阶段，寻找风旗垂落、环流减弱再反向的过程。",
    "把温差改为“无温差”，查看这个局地环流分量。",
  ],
  explanation: [
    {
      title: "海陆的冷热响应不同",
      summary: "典型白天陆地较暖，典型夜间海洋相对较暖。",
      text: "在相似的受热条件下，陆地升温、降温通常比海洋快。因此典型白天陆地较暖，典型夜间海洋相对较暖。这里的曲线只是这一差异的教学示意。",
    },
    {
      title: "升降与气压分布",
      summary: "暖侧上升，冷侧下沉。气压必须在同一高度比较。",
      text: "较暖一侧空气上升，较冷一侧空气下沉，形成相互联系的气压分布。近地面暖侧相对低压、冷侧相对高压；高空的相对关系相反。高低压必须在同一高度比较。",
    },
    {
      title: "上下两层，方向相反",
      summary: "近地面与高空气流，共同连成局地环流。",
      text: "同一高度上，水平气流从相对高压一侧流向相对低压一侧。近地面、高空与两侧的垂直运动，共同构成局地热力环流。垂直运动不能解释成“从地面低压吹向高空高压”。",
    },
    {
      title: "风的名字，说的是来处",
      summary: "从海洋来的叫海风，从陆地来的叫陆风。",
      text: "近地面从海洋吹来的叫海风，从陆地吹来的叫陆风。转向取决于海陆热状态，不能只凭太阳落山就断言风立即反向。真实风还受背景风、地形等影响。",
    },
  ],
  challenge: [
    {
      label: "海侧冷热",
      options: ["较暖", "较冷"],
      answer: "较暖",
      hint: "典型夜间，陆地冷却较快。",
    },
    {
      label: "陆侧冷热",
      options: ["较暖", "较冷"],
      answer: "较冷",
      hint: "典型夜间，陆地冷却较快。",
    },
    {
      label: "近地面 · 海侧",
      options: ["相对高压", "相对低压"],
      answer: "相对低压",
      hint: "近地面，较暖一侧为相对低压。",
    },
    {
      label: "近地面 · 陆侧",
      options: ["相对高压", "相对低压"],
      answer: "相对高压",
      hint: "与海侧在同一高度进行比较。",
    },
    {
      label: "高空 · 海侧",
      options: ["相对高压", "相对低压"],
      answer: "相对高压",
      hint: "高空的相对气压关系与近地面相反。",
    },
    {
      label: "高空 · 陆侧",
      options: ["相对高压", "相对低压"],
      answer: "相对低压",
      hint: "高空的相对气压关系与近地面相反。",
    },
    {
      label: "近地面气流",
      options: ["海 → 陆", "陆 → 海"],
      answer: "陆 → 海",
      hint: "同一高度，气流从相对高压流向相对低压。",
    },
    {
      label: "高空气流",
      options: ["海 → 陆", "陆 → 海"],
      answer: "海 → 陆",
      hint: "与近地面构成返回气流。",
    },
    {
      label: "海侧垂直气流",
      options: ["上升", "下沉"],
      answer: "上升",
      hint: "夜间海侧相对较暖。",
    },
    {
      label: "陆侧垂直气流",
      options: ["上升", "下沉"],
      answer: "下沉",
      hint: "夜间陆侧相对较冷。",
    },
  ],
};
export const transfer = [
  {
    question: "海在右、陆在左。典型午后的近地面气流应当怎样画？",
    options: ["向左：海 → 陆", "向右：陆 → 海"],
    answer: 0,
    why: "海风从海洋来。海岸镜像后，箭头向左。",
  },
  {
    question: "能把近地面“相对低压”和高空“相对高压”直接作为同一组比较吗？",
    options: ["可以，名称决定大小", "不可以，需要同一高度比较"],
    answer: 1,
    why: "“相对”是同一高度海陆之间的比较。",
  },
  {
    question: "太阳刚落山，可以断言近地面风立即反向吗？",
    options: ["可以，天黑立刻转向", "不可以，还需看海陆热状态及实际条件"],
    answer: 1,
    why: "冷热响应存在滞后，实际风还受背景风与地形影响。",
  },
];
