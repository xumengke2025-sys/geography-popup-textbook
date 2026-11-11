import { TextbookGeometry, LIFT_MARGIN, type ModelMotion } from './textbook-geometry';
import { buildAir } from './textbook-models-air';
import { buildAstronomy, buildStrata } from './textbook-models-astronomy';
import { buildOcean } from './textbook-models-water';
import { buildLand } from './textbook-models-land';
import { buildDisasters, buildGeoTechnology } from './textbook-models-disasters';
import { buildFoundation } from './textbook-models-foundation';
import { buildSkyExtra } from './textbook-models-sky-extra';
import { buildLandExtra } from './textbook-models-land-extra';
import { buildWaterRiskExtra } from './textbook-models-water-risk-extra';
import type { Figure } from './textbook-catalog';
import { buildGnssWorld } from './textbook-gnss-world';
import { buildUrbanWaterWorld } from './textbook-urban-water-world';
import { buildColdWaveWorld } from './textbook-cold-wave-world';
import { createInstrumentAssembly, type InstrumentAssembly } from './textbook-instrument-assembly';
import { instrumentProfile } from './textbook-instrument-profiles';
import { RigidFormation } from './textbook-formation';
import { buildIntegratedWorld } from './textbook-integrated-world';

export { LIFT_MARGIN };

/** The page is the only textbook bitmap. Models never receive its image. */
export class TextbookIllustration {
  readonly geometry: TextbookGeometry;
  private motion: ModelMotion;
  private phase = 0;
  private selection = 0;
  private restPosition: any;
  private lift = 1;
  private assembly?: InstrumentAssembly;
  private formation?: RigidFormation;
  constructor(readonly figure: Figure, readonly pop: any, readonly width: number, readonly height: number) {
    this.geometry = new TextbookGeometry(pop, width, height);
    switch (figure.effect) {
      case 'gnss': this.motion = buildGnssWorld(this.geometry); break;
      case 'urban-waterlogging': this.motion = buildUrbanWaterWorld(this.geometry); break;
      case 'cold-wave': this.motion = buildColdWaveWorld(this.geometry); break;
      case 'orbit': case 'radiation': case 'spheres': this.motion = buildAstronomy(this.geometry, figure.effect); break;
      case 'strata': this.motion = buildStrata(this.geometry); break;
      case 'atmosphere': case 'heat': case 'circulation': case 'breeze': case 'pressure': this.motion = buildAir(this.geometry, figure.effect); break;
      case 'water': case 'temperature': case 'wave': case 'tide': case 'current': this.motion = buildOcean(this.geometry, figure.effect); break;
      case 'karst': case 'river': case 'slope': case 'forest': case 'soil': this.motion = buildLand(this.geometry, figure.effect); break;
      case 'typhoon': case 'quake': case 'landslide': case 'rescue': this.motion = buildDisasters(this.geometry, figure.effect); break;
      case 'remote': case 'gis': this.motion = buildGeoTechnology(this.geometry, figure.effect); break;
      default: {
        const model = buildIntegratedWorld(this.geometry, figure.effect)
          ?? buildFoundation(this.geometry, figure.effect)
          ?? buildSkyExtra(this.geometry, figure.effect)
          ?? buildLandExtra(this.geometry, figure.effect)
          ?? buildWaterRiskExtra(this.geometry, figure.effect);
        if (!model) throw new Error(`没有接入对应的立体模型：${figure.effect}`);
        this.motion = model;
      }
    }
    // The printed textbook stays below. The model is allowed to use the air
    // above it, instead of being squeezed into the source illustration's box.
    if (this.geometry.root.position.y === 0) {
      this.geometry.root.position.y = Math.max(34, Math.min(56, width * .46));
      this.geometry.root.position.z = -12;
    }
    this.restPosition = this.geometry.root.position.clone();
    this.geometry.beginFrame(); this.motion.update(0, 0, 0, true); this.geometry.endFrame(false);
    const profile = instrumentProfile(figure);
    if (profile) this.assembly = createInstrumentAssembly(this.geometry, profile);
    this.geometry.finish();
    if (profile) this.formation = new RigidFormation(this.geometry, profile);
    // Short outlines must not end the peel before the raised geometry can
    // visibly travel from the printed page into the space above it.
    const strokeDuration = this.pop.drawEnd;
    Object.defineProperty(this.pop, 'drawEnd', { get: () => Math.max(2.1, strokeDuration) });
  }
  get bounds() {
    return this.observationBounds(this.motion.overviewBounds?.() ?? this.motion.focusBounds?.());
  }
  get focusBounds() {
    return this.observationBounds(this.motion.focusBounds?.());
  }
  private observationBounds(focus?: { min: [number, number, number]; max: [number, number, number] }) {
    if (!focus) return this.geometry.bounds.clone().translate(this.restPosition);
    const bounds = this.geometry.bounds.clone();
    bounds.min.copy(this.geometry.v(focus.min)); bounds.max.copy(this.geometry.v(focus.max));
    return bounds.translate(this.restPosition);
  }
  get unfoldProgress() { return this.lift; }
  inspect(target: string) { this.motion.inspect?.(target); }
  get inspection() { return this.motion.describe?.().inspection ?? 'overview'; }
  get inspectTargets() { return this.motion.inspectTargets?.() ?? []; }
  erase(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha: number) {
    // An expanded explanation is anchored to the original, unchanged page.
    // It is not a replacement illustration pasted into an erased rectangle.
    if (this.restPosition.y > 0 || this.figure.origin === 'text') return;
    c.save(); c.globalAlpha = alpha; c.fillStyle = '#fff';
    c.beginPath(); c.rect(x, y, w, h);
    for (const [u, v, a, d] of this.figure.keepOnPage ?? []) c.rect(x + u * w, y + v * h, a * w, d * h);
    c.clip('evenodd'); c.fillRect(x, y, w, h); c.restore();
  }
  update(phase: number, selection: number, visible: boolean, dt = 1 / 60, reduced = false) {
    const live = visible && this.pop.state === 'live';
    this.phase = phase; this.selection = selection;
    const progress = reduced || this.pop.state === 'live' || this.pop.state === 'shade' ? 1
      : this.pop.state === 'peel' ? Math.min(1, this.pop.t / Math.max(.9, this.pop.drawEnd))
      : this.pop.state === 'undraw' ? Math.max(0, 1 - this.pop.t / .5) : 0;
    this.lift = progress * progress * (3 - 2 * progress);
    this.geometry.root.position.copy(this.restPosition);
    this.geometry.root.position.y *= this.lift;
    // Each solid keeps its volume. Independent mounting pivots and a staged
    // surface reveal construct it above the source page; no scene is squashed.
    this.geometry.root.scale.set(1, 1, 1);
    // Keep the solid visible while it rises. Waiting until "shade" made the
    // whole lift invisible, followed by an apparent cut to the finished model.
    if (this.pop.state === 'peel') {
      const reveal = Math.min(1, Math.max(0, progress / .36));
      this.pop._surfaces(.94 * reveal * reveal * (3 - 2 * reveal));
    } else if (this.pop.state === 'shade') {
      const reveal = Math.min(1, this.pop.t / .45);
      this.pop._surfaces(.94 + .06 * reveal * reveal * (3 - 2 * reveal));
    } else if (this.pop.state === 'undraw') {
      // The original engine clears its surfaces in the first .15 seconds.
      // Retain them while the rigid pieces actually return to the paper.
      this.pop._surfaces(Math.min(1, progress / .24));
    }
    // Keep the original ink/paper reveal, but fold the actual scene upward.
    // The projected print copy would write a second drawing across the source
    // paragraphs, so only that copy is hidden in this augmented-page variant.
    for (const set of this.pop.sets) set.flat.visible = false;
    this.pop.u.uCopyAlpha.value = 0;
    this.pop.u.uLiftAll.value = 1; this.pop.u.uLiftSurf.value = 1;
    this.geometry.beginFrame(); this.motion.update(phase, selection, dt, reduced);
    this.formation?.setProgress(progress); this.assembly?.setReveal(this.lift);
    this.geometry.endFrame(live, !reduced && progress > .002 && progress < .985);
  }
  faceLabels(rotation: any) { this.geometry.faceLabels(rotation); }
  get diagnostics() {
    return { architecture: 'three-dimensional-geometry', bitmapSurfaces: 0, solids: this.geometry.volumeCount,
      labels: this.geometry.labelCount, meshes: this.geometry.meshes.length,
      imageMappedMeshes: this.geometry.meshes.filter(m => m.material.map && m.userData.kind !== 'text-label').length,
      extent: this.geometry.bounds.getSize(this.geometry.v([0, 0, 0])).toArray(),
      sceneElevation: this.restPosition.y, unfoldProgress: this.lift, originalPagePreserved: true,
      materialRoles: [...new Set(this.geometry.meshes.map(m => m.material.userData.materialRole).filter(Boolean))],
      physicalMaterials: this.geometry.meshes.filter(m => m.material.isMeshStandardMaterial).length,
      formation: this.formation?.diagnostics, instrument: this.assembly?.diagnostics,
      phase: this.phase, selection: this.selection, ...this.motion.describe?.() };
  }
  dispose() { this.formation?.dispose(); this.assembly?.dispose(); this.geometry.dispose(); }
}
