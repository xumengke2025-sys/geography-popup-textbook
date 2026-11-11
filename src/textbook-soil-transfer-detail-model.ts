import { evaluateSoilProvenance } from './textbook-ground-process-model';

const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (start: number, end: number, phase: number) => { const q = clamp((phase - start) / (end - start)); return q * q * (3 - 2 * q); };
type Point = { u: number; v: number; h: number };
const mix = (a: Point, b: Point, q: number): Point => ({ u: a.u + (b.u - a.u) * q, v: a.v + (b.v - a.v) * q, h: a.h + (b.h - a.h) * q });

/** Marked pieces keep their identity while source material enters a receiving
 * layer. Positions, packet size and phase are explanatory, never a measured
 * rate of weathering, decomposition, soil depth or chemical concentration. */
export function evaluateSoilTransferDetail(input: number, selection: number) {
  const phase = clamp(input), factor = Math.max(0, Math.min(4, Math.round(Number.isFinite(selection) ? selection : 0)));
  const base = evaluateSoilProvenance(phase, factor);
  const particles = Array.from({ length: 12 }, (_, id) => {
    const column = id % 6, row = Math.floor(id / 6), u = .19 + column * .12;
    const releaseAt = (factor === 2 ? .22 : .04) + (id % 4) * .045;
    const contactAt = (factor === 2 ? .51 : .37) + (id % 3) * (factor === 2 ? .055 : .065);
    const settledAt = (factor === 2 ? .79 : .71) + (id % 4) * (factor === 2 ? .04 : .045);
    const travel = smooth(releaseAt, contactAt, phase), incorporation = smooth(contactAt, settledAt, phase);
    const source: Point = factor === 0 ? { u, v: .94, h: 15.0 + row * 1.6 + column % 2 * .35 }
      : factor === 1 ? { u: .50 + Math.sin(id * 2.1) * .055, v: .55 + (id % 3 - 1) * .045, h: 25 + row * 3.3 + id % 3 }
        : { u, v: .94, h: 18.5 + row * .5 };
    const target: Point = factor === 0 ? { u: u + (row ? .012 : -.012), v: .94, h: 9.2 + row * 2.1 }
      : factor === 1 ? { u: .23 + column * .108, v: .94, h: 18.65 + row * .58 }
        : { u: u + (row ? .012 : -.012), v: .94, h: 10.0 + row * 1.25 };
    const contact: Point = { ...target, h: factor === 1 ? 20.25 : factor === 0 ? 12.8 + row * .5 : 12.7 + row * .4 };
    const point = phase <= contactAt ? mix(source, contact, travel) : mix(contact, target, incorporation);
    return { id, source, contact, target, ...point, releaseAt, contactAt, settledAt,
      travel, incorporation, retained: phase >= settledAt, arrived: phase >= contactAt,
      sourcePresent: phase <= releaseAt, stage: phase < releaseAt ? 'source' : phase < contactAt ? 'transfer' : phase < settledAt ? 'incorporation' : 'retained' };
  });
  const received = factor < 3 ? particles.reduce((sum, particle) => sum + particle.incorporation, 0) / 12 : 0;
  const inventory = { source: particles.filter(p => p.stage === 'source').length, moving: particles.filter(p => p.stage === 'transfer').length,
    incorporating: particles.filter(p => p.stage === 'incorporation').length, retained: particles.filter(p => p.stage === 'retained').length, total: particles.length };
  const receiverPatches = Array.from({ length: 6 }, (_, column) => {
    const local = particles.filter(particle => particle.id % 6 === column);
    return { column, u: factor === 1 ? .23 + column * .108 : .19 + column * .12,
      amount: factor < 3 ? local.reduce((sum, particle) => sum + particle.incorporation, 0) / local.length : 0,
      base: factor === 0 ? 8.6 : factor === 1 ? 18.05 : 9.4,
      growth: factor === 0 ? 2.7 : factor === 1 ? 1.55 : 2.2 };
  });
  const water = { rain: factor === 2 && phase < .70, rainReach: factor === 2 ? smooth(0, .12, phase) : 0,
    front: factor === 2 ? 20 - 11 * smooth(.12, .35, phase) : 20, active: factor === 2 && phase >= .12 && phase < .79 };
  return { phase, factor, particles, receiverPatches, received, inventory, water, retained: inventory.retained,
    soilDepth: base.soilDepth, material: ['weathered-rock-fragment', 'litter-fragment', 'mobile-soil-constituent', 'profile', 'relief-sorting'][factor],
    sameMarkedMaterial: true, receivingResponseAfterContact: true, rainAddsMobileMaterial: false,
    trajectoryIsIllustrative: true, decompositionIsNotInstantaneous: true, actualYearsOrCentimetres: false };
}
