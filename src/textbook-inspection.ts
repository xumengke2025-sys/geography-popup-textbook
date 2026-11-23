import { INTEGRATED_INSPECTIONS, type IntegratedEffect } from './textbook-integrated-model';
/** Observation choices never alter the scientific condition or playhead. */
export function inspectionTargets(effect: string, selection: number) {
  if (effect === 'seismic-waves') return [{target:'overview',label:'整体介质'}, {target:'particle-6',label:'左侧固体质点'}, {target:'particle-14',label:'右侧介质质点'}];
  if (effect === 'water-renewal') return [{target:'overview',label:'整座水槽'}, {target:'supply',label:'补给入口'}, {target:'storage',label:'储水与初始参照'}, {target:'receiver',label:'取用与接收'}, {target:'sample',label:'水质样本'}];
  if (effect === 'mars-base') return [{target:'overview',label:'整座基地'}, ...['乘员舱','植物舱','生保舱','资源舱'].map((label,i)=>({target:'mars-shell-'+i,label}))];
  if (effect === 'air-composition') return [{target:'overview',label:'整体'}, {target:'counting-face',label:'干洁空气计数板'}];
  if (effect in INTEGRATED_INSPECTIONS) return INTEGRATED_INSPECTIONS[effect as IntegratedEffect];
  if (effect === 'orbit') return [
    { target: 'overview', label: '整座行星仪' }, { target: 'train', label: '轮系剖视' },
  ];
  if (effect === 'soil') return [
    { target: 'overview', label: '合拢土柱' }, { target: 'section', label: '剖开半柱' },
  ];
  if (effect === 'wave') return [
    { target: 'overview', label: '整体' }, { target: 'displacement', label: '质点位移' },
    { target: 'depth-pair', label: '水深对照' },
  ];
  if (effect === 'temperature') return [
    { target: 'overview', label: '当前深度' }, { target: 'surface-compare', label: '表层对照' },
  ];
  if (effect === 'spheres') return [
    { target: 'overview', label: '剖面' }, { target: 'closed', label: '合拢外壳' },
  ];
  if (effect === 'gnss') return [
    { target: 'overview', label: '整体' }, ...[0, 1, 2, 3].map(i => ({ target: `sat-${i}`, label: `卫星${i + 1}链路` })),
  ];
  if (effect === 'vegetation' && selection === 0) return [
    { target: 'overview', label: '整体' }, { target: 'vine', label: '藤本' },
    { target: 'buttress', label: '板根' }, { target: 'layers', label: '林内层次' },
  ];
  if (effect === 'gis') return [
    { target: 'overview', label: '整体' }, ...[0, 1, 2].map(i => ({ target: `region-${i}`, label: `${i + 1}区` })),
  ];
  if (effect === 'urban-waterlogging') return [
    { target: 'overview', label: '整体' }, { target: 'packet-0', label: '追踪水滴' },
    { target: 'drain', label: '排水口' }, { target: 'collected', label: '收集池' },
  ];
  return [];
}
