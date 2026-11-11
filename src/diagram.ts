import type { SeaBreezeDerivedState } from "./model";
let diagramSequence = 0;
export function diagram(
  s: SeaBreezeDerivedState,
  options: {
    pressure?: boolean;
    thermal?: boolean;
    flow?: boolean;
    reveal?: number;
    blank?: boolean;
  } = {},
) {
  const {
    pressure = true,
    thermal = true,
    flow = true,
    reveal = 4,
    blank = false,
  } = options;
  const positive = s.direction === 1,
    calm = s.direction === 0;
  const markerId = `flow-arrow-${++diagramSequence}`;
  const arrow = (path: string) =>
    `<path d="${path}" fill="none" stroke="#207d83" stroke-width="4" marker-end="url(#${markerId})"/>`;
  return `<svg class="circulation" viewBox="0 0 520 310" role="img" aria-label="${blank ? "夜间环流待补全示意图" : `海陆环流图，近地面${s.ground}，高空${s.upper}`}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10" fill="#207d83"/></marker></defs>
 <rect x="20" y="30" width="480" height="217" rx="12" fill="#e9ece0"/><path d="M20 247H260V287H20Z" fill="#91b7bc"/><path d="M260 247H500V287H260Z" fill="#d6bc88"/>
 <path d="M38 82H482M38 216H482" stroke="#a3aba2" stroke-dasharray="5 5"/><text x="260" y="58" text-anchor="middle" class="svg-small">高空 · 同一高度比较</text><text x="260" y="240" text-anchor="middle" class="svg-small">近地面 · 同一高度比较</text>
 <text x="125" y="275" text-anchor="middle">海洋${thermal && !blank ? " · " + s.seaThermal : ""}</text><text x="385" y="275" text-anchor="middle">陆地${thermal && !blank ? " · " + s.landThermal : ""}</text>
 ${pressure && reveal >= 2 && !blank ? `<g class="svg-pressure"><text x="104" y="79" text-anchor="middle">${s.pressure.seaUpper}</text><text x="416" y="79" text-anchor="middle">${s.pressure.landUpper}</text><text x="104" y="213" text-anchor="middle">${s.pressure.seaGround}</text><text x="416" y="213" text-anchor="middle">${s.pressure.landGround}</text></g>` : ""}
 ${flow && !calm && !blank ? `<g opacity="${0.3 + 0.7 * s.strength}">${reveal >= 3 ? arrow(positive ? "M172 199H348" : "M348 199H172") + arrow(positive ? "M348 95H172" : "M172 95H348") : ""}${reveal >= 1 ? arrow(positive ? "M405 180V115" : "M405 115V180") + arrow(positive ? "M115 115V180" : "M115 180V115") : ""}</g>` : ""}
 <text x="260" y="157" text-anchor="middle" class="svg-center">${blank ? "夜间 · 请补全环流" : calm ? "局地热力环流很弱" : positive ? "海风" : "陆风"}</text><text x="260" y="303" text-anchor="middle" class="svg-small">${blank ? "海在左，陆在右。答案填写在下方。" : "示意模型 · 不代表真实气象读数"}</text></svg>`;
}
