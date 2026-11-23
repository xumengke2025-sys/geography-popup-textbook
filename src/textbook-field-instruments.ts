import { applyEarthScan } from './textbook-earth-scan';
import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import { phaseTrackPoint, type PhaseTrack } from './textbook-model-input';
import type { SolidMaterialRole } from './textbook-solid-materials';

const load = {
  breeze: () => import('./assets/field-instruments/breeze.json'),
  'cold-wave': () => import('./assets/field-instruments/cold-wave.json'),
  heating: () => import('./assets/field-instruments/heating.json'),
  greenhouse: () => import('./assets/field-instruments/greenhouse.json'),
  'external-spheres': () => import('./assets/field-instruments/external-spheres.json'),
  'urban-waterlogging': () => import('./assets/field-instruments/urban-waterlogging.json'),
  'karst-cave': () => import('./assets/field-instruments/karst-cave.json'),
  'karst-livelihood': () => import('./assets/field-instruments/karst-livelihood.json'),
  aeolian: () => import('./assets/field-instruments/aeolian.json'),
  thermal: () => import('./assets/field-instruments/thermal.json'),
  solar: () => import('./assets/field-instruments/solar.json'),
  'wind-forces': () => import('./assets/field-instruments/wind-forces.json'),
  earthquake: () => import('./assets/field-instruments/earthquake.json'),
  'river-valley': () => import('./assets/field-instruments/river-valley.json'),
  delta: () => import('./assets/field-instruments/delta.json'),
  river: () => import('./assets/field-instruments/river.json'),
  waves: () => import('./assets/field-instruments/waves.json'),
  tides: () => import('./assets/field-instruments/tides.json'),
  currents: () => import('./assets/field-instruments/currents.json'),
  density: () => import('./assets/field-instruments/density.json'),
  salinity: () => import('./assets/field-instruments/salinity.json'),
  desalination: () => import('./assets/field-instruments/desalination.json'),
  'water-renewal': () => import('./assets/field-instruments/water-renewal.json'),
  water: () => import('./assets/field-instruments/water.json'),
  'coastal-landform': async () => {
    const [arch, stack] = await Promise.all([
      import('./assets/field-instruments/coastal-arch.json'),
      import('./assets/field-instruments/coastal-stack.json'),
    ]);
    return { default: { parts: [...arch.default.parts, ...stack.default.parts] } };
  },
};
type AuthoredFigure = keyof typeof load;
type Asset = Awaited<ReturnType<(typeof load)[AuthoredFigure]>>['default'];
type Mesh = InstanceType<typeof T.Mesh>;
const assets: Partial<Record<AuthoredFigure, Asset>> = {};
const bytes = (encoded: string) => Uint8Array.from(atob(encoded), character => character.charCodeAt(0));

export async function loadFieldInstrument(effect: string) {
  if (effect === 'city-rain-system') effect = 'urban-waterlogging';
  if (!Object.hasOwn(load, effect)) return;
  const id = effect as AuthoredFigure;
  assets[id] ??= (await load[id]()).default;
}

function authoredAsset(id: AuthoredFigure) {
  const asset = assets[id];
  if (!asset) throw new Error('Blender model is missing for ' + id);
  return asset;
}

export function orreryDimensions() {
  const asset = authoredAsset('solar');
  if (!('crank' in asset)) throw new Error('Missing orrery dimensions');
  return asset;
}

export function coastLandmarks() {
  const asset = authoredAsset('breeze');
  if (!('flagCoast' in asset)) throw new Error('Missing coast positions');
  return asset;
}

export function estuaryLandmarks() {
  const asset=authoredAsset('external-spheres');
  if (!('treeBase' in asset)) throw new Error('Missing estuary positions');
  return asset;
}

export function riverSculpture() {
  const asset = authoredAsset('river');
  if (!('elevation' in asset)) throw new Error('River sculpture is missing');
  return { height: new Int16Array(bytes(asset.elevation).buffer), pigment: bytes(asset.pigments),
    columns: asset.columns, rows: asset.rows };
}

export function deltaDriveDimensions() {
  const asset = authoredAsset('delta');
  if (!('rackStart' in asset)) throw new Error('Missing sediment rack dimensions');
  return asset;
}

export function tideDialDimensions() {
  const asset = authoredAsset('tides');
  if (!('dial' in asset)) throw new Error('Tide drive dimensions are missing');
  return asset.dial;
}

interface PlateFace {
  at: number[];
  angle: number;
  width: number;
  height: number;
}

/** Printed characters sit on the exact porcelain plane exported by Blender. */
export function mountInstrumentInscription(b: TextbookGeometry, id: 'density' | 'salinity' | 'desalination',
  plaque: string, text: string, scale: number, origin: Vec3) {
  const asset = authoredAsset(id);
  const plate = 'plaques' in asset ? (asset.plaques as Record<string, PlateFace>)[plaque] : undefined;
  if (!plate) throw new Error('Porcelain face is missing for ' + id + '/' + plaque);
  const at: Vec3 = [0, 1, 2].map(i => origin[i] + scale * plate.at[i]) as Vec3;
  const label = b.label(text, at, plate.width * scale, plate.height * scale, { appearance: 'engraved' });
  label.rotation.x = plate.angle - Math.PI / 2;
  label.userData.labelMount = 'surface';
  return label;
}

export function mountScrewDrive(id: 'waves' | 'currents', parts: Map<string, Mesh[]>,
  point: (x: number, height: number, depth: number) => Vec3, label: string) {
  const asset = authoredAsset(id);
  if (!('rail' in asset)) throw new Error('Screw drive dimensions are missing for ' + id);
  const { start, end, depth, height, pitch } = asset.rail;
  const axis = point(start, height, depth);
  const track: PhaseTrack = { start: point(start, height + 1.32, depth), end: point(end, height + 1.32, depth) };
  const carriage = parts.get('cursor')!;
  const screw = parts.get('screw')!;
  const handle = carriage.find(mesh => mesh.userData.blenderColor === '#d1b27a')!;
  for (const mesh of carriage) {
    mesh.geometry.translate(-track.start[0], -track.start[1], -track.start[2]);
    mesh.userData.modelInput = { kind: 'phase-track', track, label };
  }
  for (const mesh of screw) {
    mesh.geometry.translate(-axis[0], -axis[1], -axis[2]);
    mesh.position.set(...axis);
  }
  return {
    track, handle, pitch,
    move(phase: number) {
      const position = phaseTrackPoint(phase, track);
      const rotation = phase * (end - start) / pitch * 2 * Math.PI;
      for (const mesh of carriage) mesh.position.set(...position);
      for (const mesh of screw) mesh.rotation.x = rotation;
    },
  };
}

/** Shapes use the Blender measurements with the basis conversion already
 * applied. Scene-local scaling preserves the textbook's observation planes. */
export function mountFieldInstrument(b: TextbookGeometry, id: AuthoredFigure, scale: number, origin: Vec3, rockDepth = scale) {
  const groups = new Map<string, Mesh[]>();
  for (const part of authoredAsset(id).parts) {
    const coords = new Int16Array(bytes(part.p).buffer);
    const rawNormals = new Int8Array(bytes(part.n).buffer);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(Float32Array.from(coords, value => value / 100), 3));
    geometry.setAttribute('normal', new T.BufferAttribute(Float32Array.from(rawNormals, value => value / 127), 3));
    geometry.setIndex(new T.BufferAttribute(new Uint16Array(bytes(part.i).buffer), 1));
    const depthScale = id === 'coastal-landform' || id === 'external-spheres' || id === 'greenhouse' || part.group === 'rock' || part.group === 'cradle' ? rockDepth : scale;
    geometry.scale(scale, scale, depthScale).translate(...origin);
    const pigment = 'c' in part && typeof part.c === 'string' ? part.c : undefined;
    if (pigment) geometry.setAttribute('color', new T.BufferAttribute(bytes(pigment), 3, true));
    const finish = {
      roughness: 'roughness' in part && typeof part.roughness === 'number' ? part.roughness : undefined,
      metalness: 'metalness' in part && typeof part.metalness === 'number' ? part.metalness : undefined,
      vertexColors: !!pigment,
    };
    const mesh = b.mesh(geometry, part.color, false, true, part.finish as SolidMaterialRole, finish);
    if ('facies' in part && typeof part.facies === 'string') {
      geometry.setAttribute('facies', new T.BufferAttribute(bytes(part.facies), 3, true));
      if (!mesh.material.userData.earthScan) applyEarthScan(mesh.material, 'valley', 14 * scale);
    }
    mesh.userData.blenderPart = part.group;
    mesh.userData.blenderColor = part.color;
    const group = groups.get(part.group) ?? [];
    group.push(mesh);
    groups.set(part.group, group);
  }
  return groups;
}

