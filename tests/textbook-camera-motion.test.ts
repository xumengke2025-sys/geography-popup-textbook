import { describe, expect, it } from 'vitest';
import { BookCameraMotion, blendCameraPose, observationCameraArc, revealCameraProgress, type CameraPose } from '../src/textbook-camera-motion';

const paper: CameraPose = { position: [12, 530, 285], focus: [12, 22, 2] };
const model: CameraPose = { position: [60, 220, 205], focus: [90, 100, -10] };

describe('one continuous camera for the paper and the raised model', () => {
  it('moves from the actual paper pose without a preliminary retreat', () => {
    expect(blendCameraPose(paper, model, 0)).toEqual(paper);
    expect(blendCameraPose(paper, model, 1)).toEqual(model);
    let previous = paper.position[1];
    for (let i = 1; i <= 100; i++) {
      const next = blendCameraPose(paper, model, i / 100);
      expect(next.position[1]).toBeLessThanOrEqual(previous);
      expect(next.position[1]).toBeGreaterThanOrEqual(model.position[1]);
      previous = next.position[1];
    }
  });
  it('starts and lands with effectively zero speed and acceleration', () => {
    const h = .0001;
    expect(revealCameraProgress(h) / h).toBeLessThan(.00001);
    expect((1 - revealCameraProgress(1 - h)) / h).toBeLessThan(.00001);
    expect((revealCameraProgress(2*h) - 2*revealCameraProgress(h)) / (h*h)).toBeLessThan(.02);
  });
  it('gives the same static-target journey at 30, 60, and 120 fps', () => {
    const results = [30,60,120].map(fps => {
      const camera = new BookCameraMotion(paper);
      for (let i=0;i<fps;i++) camera.step(model,1/fps);
      return camera.pose;
    });
    for (const pose of results.slice(1)) {
      pose.position.forEach((value,i)=>expect(value).toBeCloseTo(results[0].position[i],9));
      pose.focus.forEach((value,i)=>expect(value).toBeCloseTo(results[0].focus[i],9));
    }
  });
  it('retargets a moving camera without a position jump', () => {
    const camera = new BookCameraMotion(paper);
    for(let i=0;i<20;i++)camera.step(model,1/60);
    const before = camera.pose;
    expect(camera.step(paper,0)).toEqual(before);
    const after = camera.step(paper,1/120);
    expect(Math.hypot(...after.position.map((v,i)=>v-before.position[i]))).toBeLessThan(12);
  });
  it('reduced motion immediately reaches the complete readable pose', () => {
    const camera=new BookCameraMotion(paper);
    expect(camera.step(model,1/60,true)).toEqual(model);
    expect(camera.step(model,1/60)).toEqual(model);
  });
});

describe('bounded observation camera', () => {
  it('starts at the reader position without an angular kick', () => {
    const base={orbit:.48,elevation:.72};
    expect(observationCameraArc(base,0)).toEqual(base);
    expect(observationCameraArc(base,.001).orbit-base.orbit).toBeLessThan(1e-9);
  });
  it('never circles behind a model or below the readable side', () => {
    for(const base of [{orbit:.48,elevation:.72},{orbit:-.72,elevation:.26},{orbit:.8,elevation:1.45}]){
      for(let t=0;t<=240;t+=.2){
        const pose=observationCameraArc(base,t);
        expect(Math.abs(pose.orbit)).toBeLessThanOrEqual(.8);
        expect(pose.elevation).toBeGreaterThanOrEqual(base.elevation);
        expect(pose.elevation).toBeLessThanOrEqual(1.45);
      }
      expect(observationCameraArc(base,24).orbit).toBeCloseTo(base.orbit,12);
      expect(observationCameraArc(base,24).elevation).toBeCloseTo(base.elevation,12);
    }
  });
});
