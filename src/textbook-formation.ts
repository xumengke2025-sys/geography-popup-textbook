import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry } from './textbook-geometry';
import type { InstrumentProfile } from './textbook-instrument-profiles';

const clamp = (x: number) => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0;
const ease = (x: number) => { const t = clamp(x); return t * t * (3 - 2 * t); };
type Part = { mesh: any; pivot: any; anchor: any; offset: any; start: number; angle: number; axis: 'x' | 'y' | 'z' };

/** Build-time wrappers leave every scientific position, rotation, scale and
 * geometry untouched. Each wrapper is identity at the operational endpoint. */
export class RigidFormation {
  readonly uniform = { value: 1 };
  readonly parts: Part[] = [];
  private depth: any;
  private progress = 1;
  constructor(private g: TextbookGeometry, profile: InstrumentProfile) {
    g.root.updateWorldMatrix(true, true);
    const inverse = g.root.matrixWorld.clone().invert(), extent = g.bounds;
    const size = extent.getSize(new T.Vector3()), s = g.width / 100;
    const geometryRanks = new Map<any, number>(), materials = new Set<any>();
    for (const mesh of g.meshes) {
      if (mesh.userData.instrumentAssembly) continue;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
      const center = box.getCenter(new T.Vector3());
      let order = profile.reveal.order === 'rear-to-front' ? (center.z - extent.min.z) / Math.max(size.z, 1)
        : profile.reveal.order === 'outside-to-inside' ? 1 - Math.abs(center.x - (extent.min.x + extent.max.x) / 2) / Math.max(size.x / 2, 1)
        : (box.min.y - extent.min.y) / Math.max(size.y, 1);
      const label = mesh.userData.kind === 'text-label';
      const start = geometryRanks.get(mesh.geometry) ?? (label ? .58 : .04 + clamp(order) * .34);
      geometryRanks.set(mesh.geometry, start);
      if (!mesh.geometry.getAttribute('aFieldRevealStart')) mesh.geometry.setAttribute('aFieldRevealStart',
        new T.Float32BufferAttribute(new Float32Array(mesh.geometry.attributes.position.count).fill(start), 1));
      // All existing chapter meshes are immediate children of root. Keeping
      // this guard also permits a future chapter to own its own full rig.
      if (mesh.parent === g.root) {
        const pivot = new T.Group(); pivot.name = `formation:${mesh.name || this.parts.length}`;
        g.root.add(pivot); pivot.add(mesh);
        const section = ['section', 'column', 'strata'].includes(profile.reveal.type);
        const angle = label ? 0 : section ? -.12 : profile.reveal.type === 'shell' ? .13 : -.08;
        this.parts.push({ mesh, pivot, start, angle, axis: section ? 'x' : profile.reveal.type === 'shell' ? 'z' : 'y',
          anchor: new T.Vector3(center.x, box.min.y, center.z),
          offset: new T.Vector3(0, -(label ? 3 : 6) * s, (section ? 3 : 0) * s) });
      }
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    }
    // A nested lesson may opt its complete rigid subassemblies into forming.
    // The outer wrapper owns presentation motion; the lesson keeps writing
    // the exact same inner scientific position, rotation and uniform scale.
    const assemblies:any[]=[];
    g.root.traverse((node:any)=>{if(node!==g.root&&node.userData.rigidFormationGroup)assemblies.push(node)});
    for(const node of assemblies){
      const recipe=node.userData.rigidFormationGroup,parent=node.parent,pivot=new T.Group();
      pivot.name=`formation:${node.name}`;parent.add(pivot);pivot.add(node);
      this.parts.push({mesh:node,pivot,anchor:node.position.clone(),offset:new T.Vector3(...recipe.offset),
        start:recipe.start,angle:recipe.angle,axis:recipe.axis});
    }
    for (const material of materials) this.bridge(material);
    this.depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, alphaHash: true, side: T.DoubleSide });
    const depthCompile = this.depth.onBeforeCompile;
    this.depth.onBeforeCompile = (shader: any, renderer: any) => {
      depthCompile.call(this.depth, shader, renderer);
      shader.uniforms.uSurfAlpha = g.pop.u.uSurfAlpha;
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uSurfAlpha;')
        .replace('#include <alphahash_fragment>', 'diffuseColor.a *= uSurfAlpha * smoothstep(vFieldRevealStart, vFieldRevealStart + .4, uFieldReveal);\n#include <alphahash_fragment>');
    };
    this.bridge(this.depth, false);
    for (const mesh of g.meshes) if (!mesh.userData.instrumentAssembly) mesh.customDepthMaterial = this.depth;
  }
  private bridge(material: any, alpha = true) {
    const previous = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
    const uniform = this.uniform;
    material.onBeforeCompile = (shader: any, renderer: any) => {
      previous.call(material, shader, renderer);
      shader.uniforms.uFieldReveal = uniform;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aFieldRevealStart; varying float vFieldRevealStart;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFieldRevealStart = aFieldRevealStart;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
        '#include <common>\nuniform float uFieldReveal; varying float vFieldRevealStart;');
      if (alpha) shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
        'gl_FragColor.a *= smoothstep(vFieldRevealStart, vFieldRevealStart + .4, uFieldReveal);\n#include <dithering_fragment>');
    };
    material.customProgramCacheKey = () => `${key()}-rigid-formation-v2`;
    material.needsUpdate = true;
  }
  setProgress(value: number) {
    this.progress = clamp(value); this.uniform.value = this.progress;
    for (const part of this.parts) {
      part.mesh.userData.formationProgress = this.progress;
      const t = ease((this.progress - part.start) / .4);
      part.pivot.rotation.set(0, 0, 0); part.pivot.rotation[part.axis] = part.angle * (1 - t);
      part.pivot.position.copy(part.anchor).sub(part.anchor.clone().applyEuler(part.pivot.rotation))
        .addScaledVector(part.offset, 1 - t);
      part.pivot.scale.set(1, 1, 1);
    }
  }
  get diagnostics() { return { kind: 'rigid-parts', parts: this.parts.length, progress: this.progress, preservesScientificTransforms: true, surfaceReveal: 'per-part' }; }
  dispose() { this.depth.dispose(); }
}
