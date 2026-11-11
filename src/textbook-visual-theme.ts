/** Shared art direction for the whole fieldbook. Original textbook pages are
 * never recolored: these tokens belong only to the raised paper constructions. */
export const FIELD_PALETTE = {
  paper: '#f4f0e5', ink: '#273d40', sea: '#b1d0cf', water: '#4d8c98',
  land: '#cbbd99', rock: '#b5a58a', green: '#91aa88', darkGreen: '#507867',
  warm: '#cb8b5b', cool: '#6095aa', red: '#a75541', gold: '#b3925a',
};

export const FIELD_VISUAL_THEME = {
  id: 'raised-paper-atlas-v1',
  material: {
    ink: '#3f5654', spacing: 2.2, hatch: .20, shade: .30,
  },
  lines: { flow: '#3b7d87', accent: '#ad6448', structure: '#354d4d' },
  labels: {
    paper: '#faf7ee', edge: '#d0c7b3', foot: '#e7dfcc', ink: '#263c40',
  },
  desk: {
    backdrop: '#3e3933', felt: '#a8b6a3', feltEdge: '#546453',
    binding: '#475e53', bindingSheen: '#bdc9af',
  },
};
