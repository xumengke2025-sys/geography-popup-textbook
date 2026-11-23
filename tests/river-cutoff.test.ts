import { describe, expect, it } from 'vitest';
import { distanceToRiver, evaluateRiverCutoff, sampleRiverBanks, riverCutoffSvg } from '../src/textbook-river-model';

describe('A possible flood-triggered meander cutoff', () => {
  it('starts with a connected bend and no shortcut', () => {
    const s = evaluateRiverCutoff(0);
    expect(s.upstream.at(-1)).toEqual(s.bend[0]);
    expect(s.bend.at(-1)).toEqual(s.downstream[0]);
    expect(s.shortcut).toHaveLength(0);
    expect(s.bendFlow).toBe(1);
  });
  it('opens the neck before separating the old bend', () => {
    const before = evaluateRiverCutoff(.4), during = evaluateRiverCutoff(.55), through = evaluateRiverCutoff(.66);
    expect(before.breach).toBe(0);
    expect(during.breach).toBeGreaterThan(0);
    expect(during.breach).toBeLessThan(1);
    expect(during.separation).toBe(0);
    expect(through.shortcut.at(-1)).toEqual(through.downstream[0]);
    expect(through.separation).toBe(0);
  });
  it('leaves a dry separation wider than the combined water half-widths at both lake ends', () => {
    const s = evaluateRiverCutoff(1), channels = [s.upstream, s.downstream, s.shortcut];
    expect(s.isolated).toBe(true);
    expect(s.bendFlow).toBe(0);
    expect(s.shortcutFlow).toBe(1);
    for (const point of [s.bend[0], s.bend.at(-1)!]) {
      const distance = Math.min(...channels.map(path => distanceToRiver(point, path, .62)));
      expect(distance).toBeGreaterThan((s.riverWidth + s.bendWidth) / 2 + .007);
    }
  });
  it('is seekable without history, remains continuous, and shares geometry with the 2D fallback', () => {
    const first = evaluateRiverCutoff(.55); evaluateRiverCutoff(1); evaluateRiverCutoff(.01);
    expect(evaluateRiverCutoff(.55)).toEqual(first);
    for (const phase of [.37, .42, .65, .68, .83, .94]) {
      const a = evaluateRiverCutoff(phase - .00001), b = evaluateRiverCutoff(phase + .00001);
      expect(Math.abs(a.breach - b.breach)).toBeLessThan(.001);
      expect(Math.abs(a.bend[0][0] - b.bend[0][0])).toBeLessThan(.001);
    }
    expect(riverCutoffSvg(1)).toContain('牛轭湖');
    expect(riverCutoffSvg(1)).not.toContain('<image');
  });
  it('matches the distance to the changing river bed on a reusable grid',()=>{
    const nx=32,nz=24,grid=new Float32Array((nx+1)*(nz+1));
    for(const phase of [0,.43,.56,.87,1,.31]){
      const state=evaluateRiverCutoff(phase);
      sampleRiverBanks(state,nx,nz,grid);
      for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
        const point=[.012+.976*i/nx,.045+.91*j/nz] as const;
        const distance=(path:typeof state.bend,width:number)=>distanceToRiver(point,path,.62)/(width/2);
        const expected=Math.min(2.4,distance(state.upstream,state.riverWidth),distance(state.downstream,state.riverWidth),
          distance(state.bend,state.bendWidth),state.shortcutWidth>.0001?distance(state.shortcut,state.shortcutWidth):Infinity);
        expect(grid[j*(nx+1)+i]).toBeCloseTo(expected,5);
      }
    }
  });
});
