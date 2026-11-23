import type { MeshStandardMaterial } from 'three';
import { applyEarthScan } from './textbook-earth-scan';
import { mountFieldInstrument, coastLandmarks } from './textbook-field-instruments';
import type { TextbookGeometry } from './textbook-geometry';

export function buildCoastalSpecimen(b: TextbookGeometry, scale: number, back: number) {
  const groups = mountFieldInstrument(b, 'breeze', scale, [0, 0, back]);
  for (const [group, scan, span] of [['strata', 'outcrop', 13], ['shore', 'alluvium', 7]] as const) {
    for (const mesh of groups.get(group)!) {
      if (!(mesh.material as MeshStandardMaterial).userData.earthScan) applyEarthScan(mesh.material, scan, span * scale);
    }
  }
  for (const [selection, label] of ['白天', '夜晚'].entries()) {
    for (const mesh of groups.get('key' + selection)!) {
      mesh.userData.modelInput = { kind: 'select', selection, keepPhase: false, label: '观察' + label + '的海陆风' };
    }
  }
  return { ...coastLandmarks(), groups,
    update(daylight: boolean, landHeat: number, seaHeat: number) {
      for (const [group, temperature] of [['land', landHeat], ['sea', seaHeat]] as const) {
        for (const mesh of groups.get(group)!) {
          (mesh.material as MeshStandardMaterial).color.setRGB(.96 + .035 * temperature, .96, .96 - .048 * temperature);
        }
      }
      for (const mesh of groups.get('lantern')!) {
        (mesh.material as MeshStandardMaterial).emissive?.setHex(daylight ? 0x000000 : 0xc9923c);
        (mesh.material as MeshStandardMaterial).emissiveIntensity = daylight ? 0 : .54;
      }
    },
  };
}
