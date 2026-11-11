import { describe, expect, it } from 'vitest';
import { contents, figures, figuresAt, pdfAt, sectionFigures, spreadAt, printedPage, numberedPage, spreadPageLabel, LAST_PRINTED_PAGE } from '../src/textbook-catalog';
import { flatModelSvg } from '../src/textbook-flat-model';

describe('原教材的整册连接', () => {
  it('保留原PDF的书末留白，不虚构125—128印刷页码', () => {
    expect(LAST_PRINTED_PAGE).toBe(124);
    expect(numberedPage(129)).toBe(124);
    expect(printedPage(129)).toBe('124');
    for (const pdf of [130,131,132,133]) {
      expect(numberedPage(pdf)).toBeNull();
      expect(printedPage(pdf)).toBe(`书末留白 ${pdf-129}`);
      expect(pdfAt(spreadAt(pdf),pdf%2?'left':'right')).toBe(pdf);
    }
    expect(spreadPageLabel(65)).toBe('124 · 留白');
    expect(spreadPageLabel(66)).toBe('留白 2—3');
    expect(spreadPageLabel(67)).toBe('留白 4');
    expect(spreadPageLabel(20)).toBe('34—35');
    expect(spreadPageLabel(0)).toBe('封面');
  });
  it('132张内页可由67个跨页完整到达，不重复或丢失', () => {
    const pages = Array.from({ length: 68 }, (_, k) => ['left', 'right'].map(side => pdfAt(k, side as 'left' | 'right'))).flat().filter(n => n !== null);
    expect(pages).toEqual(Array.from({ length: 132 }, (_, i) => i + 2));
    expect(new Set(figures.map(f => f.id)).size).toBe(figures.length);
    for (const figure of figures) expect(figuresAt(spreadAt(figure.pdf))).toContain(figure);
  });

  it('17节与6个问题研究均有原页对应的立体解释', () => {
    const sections = contents.flatMap(c => c.sections);
    expect(sections.filter(s => !s.type)).toHaveLength(17);
    expect(sections.filter(s => s.type === 'study')).toHaveLength(6);
    for (const section of sections.filter(s => s.type !== 'appendix')) expect(sectionFigures(section).length, section.title).toBeGreaterThan(0);
    const studies = ['mars-base', 'haze', 'desalination', 'karst-livelihood', 'urban-waterlogging', 'warehouse'];
    for (const id of studies) expect(figures.some(f => f.id === id)).toBe(true);
  });

  it('此前覆盖缺口均有独立模型，不靠教材裁图补足', () => {
    const required = ['solar-activity', 'greenhouse', 'wind-forces', 'salinity', 'density', 'aeolian', 'coastal-landform', 'soil-texture', 'soil-factors', 'soil-care', 'cold-wave', 'gnss'];
    for (const effect of required) {
      const figure = figures.find(f => f.effect === effect);
      expect(figure, effect).toBeDefined();
      expect(figure?.origin).toBe('text');
      expect(figure?.controls?.length, effect).toBeGreaterThan(1);
    }
  });
});

describe('当前二维解释的内容完整性', () => {
  it('实际生产分发的全部条件均有有限几何，不依赖外部素材', () => {
    const native = new Set<string>(), cropped = new Set<string>();
    for (const f of figures) {
      for (let selection = 0; selection <= (f.selectionLimit ?? Math.max(0,(f.controls?.length ?? 1)-1)); selection++) {
        for (const phase of [0, .5, 1]) {
          const svg = flatModelSvg(f, phase, selection);
          expect(svg, `${f.id}/${selection}/${phase}`).toBeTruthy();
          expect(svg).toMatch(/viewBox="0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?"/);
          // xmlns is an SVG namespace identifier, not a fetched asset. Check
          // actual resource references instead of rejecting that valid URI.
          expect(svg).not.toMatch(/(?:href|src)\s*=\s*["'](?:https?:)?\/\/|url\(\s*["']?(?:https?:)?\/\/|NaN|Infinity|undefined/);
          expect(svg).toMatch(/role="(?:img|group)"/);
          (/<image\b/.test(svg) ? cropped : native).add(f.id);
          if (f.origin === 'text' || ['atmosphere', 'forest', 'water', 'heat', 'circulation', 'remote', 'wave', 'tide', 'karst', 'soil', 'river', 'quake', 'gis', 'strata', 'landslide', 'current', 'radiation', 'typhoon'].includes(f.effect))
            expect(svg, `${f.id}: the active explanation uses native geometry`).not.toMatch(/<image\b/);
        }
      }
    }
    expect(native.size).toBe(figures.length);
    expect(figures.filter(f=>!f.extension)).toHaveLength(60);
    expect(figures.filter(f=>f.extension)).toHaveLength(3);
    expect(cropped.size).toBe(0);
    expect([...native].some(id => cropped.has(id))).toBe(false);
  });

  it('连续过程的预设停靠点均为可到达且有限的进度', () => {
    for (const figure of figures.filter(f => f.controlPhases)) {
      expect(figure.controlPhases?.length, figure.id).toBe(figure.controls?.length);
      for (const phase of figure.controlPhases!) {
        expect(Number.isFinite(phase), figure.id).toBe(true);
        expect(phase, figure.id).toBeGreaterThanOrEqual(0);
        expect(phase, figure.id).toBeLessThanOrEqual(1);
      }
    }
  });
});
