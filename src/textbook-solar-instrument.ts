type SolarPlate = typeof import('./assets/solar-instrument/instrument.json');
let plate: SolarPlate | undefined;
export async function loadSolarInstrument() {
  plate ??= (await import('./assets/solar-instrument/instrument.json')).default;
}
import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import type { SolidMaterialRole } from './textbook-solid-materials';

const bytes = (data: string) => Uint8Array.from(atob(data), c => c.charCodeAt(0));

// The Blender master uses centimetres, Z up, and a front-facing negative Y.
// Its exporter stores Y-up vertices at hundredth-unit precision. Batching
// preserves the two specimen assemblies and the three independent motions.
export function buildSolarInstrument(b: TextbookGeometry, scale: number, depth: number) {
  const track = { start: [12.5 * scale, 5 * scale, depth + 7.7 * scale] as Vec3,
    end: [82.5 * scale, 5 * scale, depth + 7.7 * scale] as Vec3 };
  const drive: InstanceType<typeof T.Mesh>[] = [], slide: InstanceType<typeof T.Mesh>[] = [], pointer: InstanceType<typeof T.Mesh>[] = [];
  if (!plate) throw new Error('日地扰动演示仪模型尚未载入');
  for (const part of plate) {
    const source = new Int16Array(bytes(part.p).buffer);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(Float32Array.from(source, value => value * scale / 100), 3));
    geometry.setAttribute('normal', new T.BufferAttribute(new Int8Array(bytes(part.n).buffer), 3, true));
    geometry.setIndex(new T.BufferAttribute(new Uint16Array(bytes(part.i).buffer), 1));
    geometry.translate(0, 0, depth);
    const mesh = b.mesh(geometry, part.color, false, true, part.finish as SolidMaterialRole);
    mesh.userData.instrumentPart = part.group;
    if (part.group.startsWith('support-')) {
      const sun = part.group === 'support-sun';
      mesh.userData.causalRole = 'solar-specimen-support';
      mesh.userData.specimenContact = [(sun ? 16 : 79) * scale, (sun ? 11 : 12) * scale, depth];
    }
    if (part.group === 'sun' || part.group === 'earth') {
      mesh.userData.modelInput = { kind: 'select', selection: 1, toggleTo:0, keepPhase:true, label: '轻点天体，切换较平静与活动增强' };
    }
    if (part.group === 'slide' || part.group === 'drive') {
      mesh.userData.modelInput = { kind: 'phase-track', track, label: '拖动游标，回看扰动抵达磁层和极区的过程' };
    }
    if (part.group === 'slide') slide.push(mesh);
    if (part.group === 'drive' || part.group === 'pointer') {
      const isDrive = part.group === 'drive';
      const pivot: Vec3 = isDrive ? [0, 4 * scale, depth + 7.7 * scale] : [47.5 * scale, 9 * scale, depth + 2.53 * scale];
      geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
      mesh.position.set(...pivot);
      (isDrive ? drive : pointer).push(mesh);
    }
  }
  return (phase: number) => {
    for (const mesh of slide) mesh.position.x = phase * 70 * scale;
    for (const mesh of drive) mesh.rotation.x = -phase * 32 * Math.PI;
    for (const mesh of pointer) mesh.rotation.z = -phase * 4 * Math.PI / 3;
  };
}
