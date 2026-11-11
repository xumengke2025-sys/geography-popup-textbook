import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
import { evaluateRemoteSensing, remoteSensingSvg, REMOTE_PROCESS_STOPS, REMOTE_SAMPLES,
  REMOTE_PROCESS_REFERENCE, REMOTE_SAMPLE_COUNT } from '../src/textbook-remote-model';
import type { TextbookGeometry, Vec3 } from '../src/textbook-geometry';

vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
import { buildRemoteSensingWorld, buildRemoteWorld } from '../src/textbook-remote-world';

function fixture() {
  const meshes: Three.Mesh[] = [], root = new Three.Group(), contours: Vec3[][] = [];
  const b: any = {
    width: 300, height: 140, root, meshes, contours, flow: [], accentStrokes: [],
    pop: { paper: ({ color = '#fff' }: { color?: string }) => new Three.MeshBasicMaterial({ color }) },
    v: (point: Vec3) => new Three.Vector3(...point),
    mesh(geometry: Three.BufferGeometry, color = '#fff') {
      const mesh = new Three.Mesh(geometry, new Three.MeshBasicMaterial({ color }));
      root.add(mesh); meshes.push(mesh); return mesh;
    },
    cylinder(from: Vec3, to: Vec3, radius: number, color: string, _outline: boolean, top = radius) {
      const a = new Three.Vector3(...from), z = new Three.Vector3(...to), delta = z.clone().sub(a);
      const geometry = new Three.CylinderGeometry(top, radius, delta.length(), 12);
      geometry.applyQuaternion(new Three.Quaternion().setFromUnitVectors(new Three.Vector3(0, 1, 0), delta.normalize()));
      geometry.translate(...a.add(z).multiplyScalar(.5).toArray()); return this.mesh(geometry, color);
    },
    sphere(point: Vec3, radius: number, color: string) {
      const geometry = new Three.SphereGeometry(radius, 16, 10); geometry.translate(...point); return this.mesh(geometry, color);
    },
    label(text: string, point: Vec3, width: number, height: number) {
      const mesh = this.mesh(new Three.PlaneGeometry(width, height)); mesh.position.set(...point);
      mesh.userData.kind = 'text-label'; mesh.userData.text = text; return mesh;
    },
    stroke(points: Vec3[]) { contours.push(points); },
    outline(_mesh: Three.Mesh) {},
  };
  return { b, meshes, motion: buildRemoteSensingWorld(b as TextbookGeometry) };
}

describe('textbook fig.6.21 finite passive-optical information chain', () => {
  it('records the verified page and the limits of this optical example', () => {
    expect(REMOTE_PROCESS_REFERENCE).toMatchObject({ printedPage: 114, pdfPage: 119, figure: '6.21',
      example: 'passive-optical', activeRadarAlsoExists: true, automaticRecognition: false, disasterPrediction: false });
    const state = evaluateRemoteSensing(1);
    expect(state.sensorIlluminatesTarget).toBe(false);
    expect(state.measuredSamples).toBe(false);
    expect(state.predictsDisasters).toBe(false);
    expect(state.processing.identifiesLandCover).toBe(false);
    expect(state.processing.operation).toBe('restore-known-spatial-order');
  });

  it('keeps the same twelve source identities and tones through all four stations', () => {
    expect(REMOTE_SAMPLE_COUNT).toBe(12); expect(REMOTE_SAMPLES).toHaveLength(12);
    expect(new Set(REMOTE_SAMPLES.map(s => s.id)).size).toBe(12);
    expect(new Set(REMOTE_SAMPLES.map(s => s.source.join(','))).size).toBe(12);
    expect(new Set(REMOTE_SAMPLES.map(s => s.received.join(','))).size).toBe(12);
    const source = REMOTE_SAMPLES.map(({ id, tone, source }) => ({ id, tone, source }));
    for (const phase of [0, .17, .4, .62, .84, 1, .22, 0]) {
      expect(evaluateRemoteSensing(phase).samples.map(({ id, tone, source }) => ({ id, tone, source }))).toEqual(source);
    }
    const state = evaluateRemoteSensing(1);
    expect(state.samples.every(s => s.captured && s.received && s.processed && s.output)).toBe(true);
    expect(state.retainedInformationCopies).toBe(true);
  });

  it('makes the named controls stops in one process and retains each completed station', () => {
    expect(REMOTE_PROCESS_STOPS.map(s => s.phase)).toEqual([.22, .45, .69, 1]);
    const keys = ['captured', 'received', 'processed', 'output'] as const;
    REMOTE_PROCESS_STOPS.forEach((stop, index) => {
      const s = evaluateRemoteSensing(stop.phase);
      expect(s.selection).toBe(index);
      keys.forEach((key, station) => expect(s.counts[key]).toBe(station <= index ? 12 : 0));
    });
    expect(REMOTE_PROCESS_STOPS.map(stop => evaluateRemoteSensing(stop.phase).stage)).toEqual(['acquiring', 'transmitting', 'processing', 'complete']);
    expect(evaluateRemoteSensing(0).counts).toEqual({ captured: 0, received: 0, processed: 0, output: 0 });
  });

  it('never delivers a result before its input and never loses a previous result', () => {
    let last = { captured: 0, received: 0, processed: 0, output: 0 };
    for (let step = 0; step <= 600; step++) {
      const state = evaluateRemoteSensing(step / 600), c = state.counts;
      expect(c.captured).toBeGreaterThanOrEqual(c.received);
      expect(c.received).toBeGreaterThanOrEqual(c.processed);
      expect(c.processed).toBeGreaterThanOrEqual(c.output);
      for (const key of ['captured', 'received', 'processed', 'output'] as const) {
        expect(c[key]).toBeGreaterThanOrEqual(last[key]); expect(c[key]).toBeLessThanOrEqual(12);
        expect(c[key]).toBe(state.samples.filter(s => s[key]).length);
      }
      for (const sample of state.samples) {
        if (sample.transmission.active) expect(sample.captured).toBe(true);
        if (sample.processingTransfer.active) expect(sample.received).toBe(true);
        if (sample.outputTransfer.active) expect(sample.processed).toBe(true);
        if (sample.output) expect(sample.captured && sample.received && sample.processed).toBe(true);
      }
      last = c;
    }
  });

  it('is deterministic across backward seeking and does not invent elapsed seconds', () => {
    const source = JSON.stringify(REMOTE_SAMPLES), expected = evaluateRemoteSensing(.813);
    for (const phase of [1, 0, .92, .45, .16, .88]) evaluateRemoteSensing(phase);
    expect(evaluateRemoteSensing(.813)).toEqual(expected);
    for (const phase of [NaN, Infinity, -Infinity, -9]) expect(evaluateRemoteSensing(phase)).toEqual(evaluateRemoteSensing(0));
    expect(evaluateRemoteSensing(5)).toEqual(evaluateRemoteSensing(1));
    expect(JSON.stringify(REMOTE_SAMPLES)).toBe(source);
    expect(REMOTE_PROCESS_REFERENCE.phaseMeansElapsedTime).toBe(false);
  });

  it('moves each information token continuously along its shared 3D path', () => {
    const events = REMOTE_SAMPLES.flatMap(s => [s.captureStart, s.captureEnd, s.transmissionStart,
      s.transmissionEnd, s.processingStart, s.processingEnd, s.outputStart, s.outputEnd]);
    for (const phase of events) {
      const before = evaluateRemoteSensing(phase - 1e-7), after = evaluateRemoteSensing(phase + 1e-7);
      before.samples.forEach((sample, i) => {
        for (const key of ['acquisition', 'transmission', 'processingTransfer', 'outputTransfer'] as const) {
          const q = after.samples[i][key];
          expect(q.progress).toBeGreaterThanOrEqual(sample[key].progress);
          expect(Math.hypot(...q.point.map((v, j) => v - sample[key].point[j]))).toBeLessThan(.001);
        }
      });
    }
    for (const sample of evaluateRemoteSensing(1).samples) {
      expect(sample.acquisition.point).toEqual(sample.sensor);
      expect(sample.transmission.point).toEqual(sample.receiver);
      expect(sample.processingTransfer.point).toEqual(sample.processor);
      expect(sample.outputTransfer.point).toEqual(sample.result);
    }
  });

  it('renders native SVG with the same identities, retained copies and accessible nodes', () => {
    for (const phase of [0, .15, .22, .45, .69, .85, 1]) {
      const s = evaluateRemoteSensing(phase), svg = remoteSensingSvg(phase);
      expect(svg).not.toMatch(/<image|data:image|NaN|Infinity/);
      expect(svg.match(/data-remote-sample="/g)).toHaveLength(12);
      expect(svg.match(/data-remote-node="/g)).toHaveLength(4);
      expect(svg.match(/role="button" tabindex="0"/g)).toHaveLength(4);
      expect(svg).toContain(`data-remote-stage="${s.stage}"`);
      for (const key of ['captured', 'received', 'processed', 'output'] as const) {
        expect(svg).toContain(`data-remote-${key}="${s.counts[key]}"`);
        expect(svg.match(new RegExp(`data-remote-copy="${key}"`, 'g')) ?? []).toHaveLength(s.counts[key]);
      }
    }
  });
});

describe('the raised remote-sensing rig reads exactly the same state', () => {
  it('builds real thick sample meshes, optics, a curved dish and all four selectable nodes', () => {
    const { meshes } = fixture();
    expect(buildRemoteWorld).toBe(buildRemoteSensingWorld);
    expect(meshes.filter(m => m.userData.remoteRole === 'sample-source')).toHaveLength(12);
    expect(meshes.filter(m => m.userData.remoteRole === 'sample-copy')).toHaveLength(48);
    expect(meshes.filter(m => m.userData.remoteRole === 'information-packet')).toHaveLength(48);
    expect(meshes.some(m => m.userData.remoteRole === 'receiving-dish' && m.geometry.type === 'LatheGeometry')).toBe(true);
    expect(meshes.some(m => m.userData.remoteRole === 'passive-optical-sensor')).toBe(true);
    expect(meshes.filter(m => m.userData.kind === 'text-label').map(m => m.userData.text)).toEqual(['获取', '传输', '处理', '成果']);
    for (const mesh of meshes.filter(m => ['sample-source', 'sample-copy'].includes(m.userData.remoteRole))) {
      mesh.geometry.computeBoundingBox(); const bounds = mesh.geometry.boundingBox!;
      expect(bounds.max.z - bounds.min.z).toBeGreaterThan(1);
      expect(mesh.userData.remoteSampleId).toMatch(/^sample-\d+$/);
      expect(mesh.userData.modelInput.kind).toBe('select');
    }
    expect(new Set(meshes.filter(m => m.userData.modelInput?.kind === 'select').map(m => m.userData.modelInput.selection))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('retains all earlier information as visible geometry and stops all packets at the end', () => {
    const { motion, meshes } = fixture();
    for (const phase of [0, .15, .22, .45, .69, .85, 1, .45, .91, 1]) {
      motion.update(phase, 3, 1 / 60, false);
      const state = evaluateRemoteSensing(phase), actual = motion.describe!();
      expect(actual).toMatchObject({ kind: 'remote-sensing-process', phase: state.phase, stage: state.stage,
        counts: state.counts, samples: state.samples, processing: state.processing, output: state.output,
        sensorIlluminatesTarget: false, measuredSamples: false, predictsDisasters: false, retainedInformationCopies: true });
      for (const kind of ['captured', 'received', 'processed', 'output'] as const) {
        const copies = meshes.filter(m => m.userData.remoteCopy === kind && m.visible);
        expect(copies).toHaveLength(state.counts[kind]);
        for (const mesh of copies) expect(state.samples.find(s => s.id === mesh.userData.remoteSampleId)![kind]).toBe(true);
      }
    }
    expect(meshes.filter(m => m.userData.remoteRole === 'information-packet' && m.visible)).toHaveLength(0);
    expect(meshes.filter(m => m.userData.remoteRole === 'sample-copy' && m.visible)).toHaveLength(48);
  });

  it('has a real seekable pull-tab and stable framing, buffers and transforms after repeated updates', () => {
    const { b, motion, meshes } = fixture(), focus = motion.focusBounds!();
    const buffers = meshes.map(m => m.geometry.attributes.position.array);
    const handle = meshes.find(m => m.userData.remoteRole === 'phase-handle')!;
    expect(handle.userData.modelInput.kind).toBe('phase-track');
    for (const phase of [0, .71, 1, .22, 0, .45, 1]) {
      b.flow.length = b.accentStrokes.length = 0;
      motion.update(phase, 0, .01, false);
      const actual = motion.describe!(), track = actual.phaseTrackWorld as { start: Vec3; end: Vec3 }, at = actual.handleWorld as Vec3;
      expect(at).toEqual(track.start.map((value, i) => value + (track.end[i] - value) * phase));
      expect(motion.focusBounds!()).toEqual(focus);
      meshes.forEach((m, i) => expect(m.geometry.attributes.position.array).toBe(buffers[i]));
      expect(b.flow.length + b.accentStrokes.length).toBeLessThanOrEqual(5);
    }
    motion.update(.613, 0, 1 / 30, false); const at30 = motion.describe!();
    motion.update(.613, 3, 1 / 144, true); expect(motion.describe!()).toEqual(at30);
  });
});
