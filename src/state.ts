import { evaluateSeaBreeze, type SeaBreezeInput } from "./model";
import { lesson, transfer } from "./content";
import { initialChapters, waterModes, waterPaths, SPREAD, type ChaptersProgress } from './chapters';
export const STORAGE_KEY = "earth-fieldbook:sea-breeze:v1";
export const CONTENT_VERSION = "geography-three-lessons-2026-11-04";
export interface Observation {
  kind: string;
  input: SeaBreezeInput;
  ground: string;
  upper: string;
  sea: string;
  land: string;
  at: string;
}
export interface Progress {
  version: 1;
  contentVersion: string;
  spread: number;
  step: number;
  observationStep: number;
  input: SeaBreezeInput;
  prediction: number | null;
  observations: Observation[];
  diagram: string[];
  firstDiagram: string[];
  transfer: number[];
  firstTransfer: number[];
  edits: number;
  hints: number;
  checked: boolean;
  transferChecked: boolean;
  conclusion: string;
  quality: string;
  sound: boolean;
  chapters: ChaptersProgress;
}
export function initial(): Progress {
  return {
    version: 1,
    contentVersion: CONTENT_VERSION,
    spread: 0,
    step: 0,
    observationStep: 0,
    input: { phase: 0.5, contrast: 1 },
    prediction: null,
    observations: [],
    diagram: Array(10).fill(""),
    firstDiagram: Array(10).fill(""),
    transfer: Array(3).fill(-1),
    firstTransfer: Array(3).fill(-1),
    edits: 0,
    hints: 0,
    checked: false,
    transferChecked: false,
    conclusion: "",
    quality: "高",
    sound: false,
    chapters: initialChapters(),
  };
}
export function complete(p: Progress) {
  return (
    ["午后", "夜间", "无温差"].every((k) =>
      p.observations.some((o) => o.kind === k),
    ) &&
    p.checked &&
    p.transferChecked &&
    p.diagram.length === lesson.challenge.length &&
    p.diagram.every((v, i) => v === lesson.challenge[i].answer) &&
    p.transfer.length === transfer.length &&
    p.transfer.every((v, i) => v === transfer[i].answer)
  );
}
export function observation(input: SeaBreezeInput): Observation | null {
  const s = evaluateSeaBreeze(input);
  const kind =
    input.contrast === 0
      ? "无温差"
      : s.stage === "午后" && s.direction === 1 && s.strength > 0.15
        ? "午后"
        : s.stage === "夜间" && s.direction === -1 && s.strength > 0.15
          ? "夜间"
          : null;
  return kind
    ? {
        kind,
        input: { ...input },
        ground: s.ground,
        upper: s.upper,
        sea: s.seaThermal,
        land: s.landThermal,
        at: new Date().toISOString(),
      }
    : null;
}
export function readProgress(): { progress: Progress; available: boolean } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    localStorage.setItem(STORAGE_KEY + ":probe", "1");
    localStorage.removeItem(STORAGE_KEY + ":probe");
  } catch {
    return { progress: initial(), available: false };
  }
  if (!raw) return { progress: initial(), available: true };
  try {
    const p = JSON.parse(raw);
    if (
      !p || typeof p !== 'object' ||
      p.version !== 1 ||
      !Array.isArray(p.diagram) ||
      p.diagram.length !== 10 ||
      !Array.isArray(p.transfer) ||
      p.transfer.length !== 3 ||
      !Array.isArray(p.observations) ||
      !Number.isFinite(p.input?.phase) ||
      ![0, 0.5, 1].includes(p.input?.contrast)
    )
      return { progress: initial(), available: true };
    const index = (v: unknown, max: number) => typeof v === 'number' && Number.isInteger(v) ? Math.max(0, Math.min(max, v)) : 0;
    const answers = (values: unknown) => lesson.challenge.map((q,i) => Array.isArray(values) && q.options.includes(values[i]) ? values[i] as string : '');
    const transfers = (values: unknown) => transfer.map((q,i) => Array.isArray(values) && Number.isInteger(values[i]) && values[i] >= 0 && values[i] < q.options.length ? values[i] as number : -1);
    const records: Observation[] = [];
    for (const value of p.observations) {
      if (!Number.isFinite(value?.input?.phase) || ![0,.5,1].includes(value?.input?.contrast)) continue;
      const record = observation(value.input);
      if (record && record.kind === value.kind) {
        if (typeof value.at === 'string') record.at = value.at;
        const old = records.findIndex(o => o.kind === record.kind);
        if (old >= 0) records.splice(old,1);
        records.push(record);
      }
    }
    const chapters=initialChapters();
    for(const id of ['water','river'] as const){
      const saved=p.chapters?.[id],item=chapters[id];if(!saved||typeof saved!=='object')continue;
      item.revealed=saved.revealed===true;
      item.prediction=[0,1].includes(saved.prediction)?saved.prediction:null;
      item.phase=Number.isFinite(saved.phase)?Math.max(0,Math.min(id==='water'?.999:1,saved.phase)):0;
      item.answer=Number.isInteger(saved.answer)&&saved.answer>=0&&saved.answer<3?saved.answer:null;
      item.firstAnswer=Number.isInteger(saved.firstAnswer)&&saved.firstAnswer>=0&&saved.firstAnswer<3?saved.firstAnswer:null;
      item.checked=saved.checked===true;item.edits=index(saved.edits,100000);
      if(id==='water'){
        chapters.water.mode=waterModes.includes(saved.mode)?saved.mode:waterModes[0];
        chapters.water.focus=waterPaths.some(q=>q.id===saved.focus)?saved.focus:null;
        chapters.water.visited=waterModes.filter(v=>Array.isArray(saved.visited)&&saved.visited.includes(v));
      }else chapters.river.visited=['河曲','牛轭湖'].filter(v=>Array.isArray(saved.visited)&&saved.visited.includes(v));
    }
    // Older bookmarks used spread 3 for sources and 4 for the end page.
    const spread=p.contentVersion===CONTENT_VERSION?index(p.spread,SPREAD.end):p.spread===3?SPREAD.guide:p.spread===4?SPREAD.end:index(p.spread,2);
    return {
      progress: {
        ...initial(),
        spread, step: index(p.step,3), observationStep:index(p.observationStep,4),
        input: {phase:evaluateSeaBreeze(p.input).phase, contrast:p.input.contrast},
        prediction: [null,-1,0,1,2].includes(p.prediction) ? p.prediction : null,
        observations: records, diagram:answers(p.diagram), firstDiagram:answers(p.firstDiagram),
        transfer:transfers(p.transfer), firstTransfer:transfers(p.firstTransfer),
        edits:index(p.edits,100000), hints:index(p.hints,100000),
        checked:p.checked===true, transferChecked:p.transferChecked===true,
        conclusion:['午后与夜间的冷热关系相反，近地面风向也相反。','温差减弱时局地环流变弱，无温差时这一分量消失。'].includes(p.conclusion) ? p.conclusion : '',
        quality:['高','中','低'].includes(p.quality)?p.quality:'高', sound:p.sound===true, chapters,
      },
      available: true,
    };
  } catch {
    // A damaged record is different from unavailable browser storage.
    return { progress: initial(), available: true };
  }
}
export function persist(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
