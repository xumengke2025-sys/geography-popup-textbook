import { THREE as T } from './reference/engine.js';

// The observation camera must collect this light layer. Layer membership is
// evaluated per camera by Three.js, not per receiving object.
export const INSTRUMENT_LIGHT_LAYER = 7;

/** A material role describes a substance, never a lesson or a selection. */
export type SolidMaterialRole = 'brass' | 'wood' | 'steel' | 'enamel' | 'ivory' | 'rock' | 'land' | 'water' | 'plant' | 'air' | 'paper';
export const SOLID_FINISHES: Record<Exclude<SolidMaterialRole, 'paper'>, { roughness: number; metalness: number; envMapIntensity: number }> = {
  brass: { roughness: .33, metalness: .87, envMapIntensity: 1 },
  wood: { roughness: .4, metalness: .03, envMapIntensity: .45 },
  steel: { roughness: .26, metalness: .92, envMapIntensity: 1 },
  // Painted iron has a dielectric surface. Treating the dark green coating as
  // bare steel made the chassis absorb its colour and read as flat dark metal.
  enamel: { roughness: .29, metalness: .06, envMapIntensity: .62 },
  ivory: { roughness: .43, metalness: .015, envMapIntensity: .4 },
  rock: { roughness: .87, metalness: 0, envMapIntensity: .28 },
  land: { roughness: .81, metalness: 0, envMapIntensity: .3 },
  water: { roughness: .25, metalness: .045, envMapIntensity: .65 },
  plant: { roughness: .73, metalness: 0, envMapIntensity: .33 },
  air: { roughness: .66, metalness: 0, envMapIntensity: .35 },
};

/** Semantic palette first; a hue fallback only handles older local palettes. */
export function inferSolidMaterialRole(color: string): SolidMaterialRole {
  const lower = color.toLowerCase();
  if (['#b3925a', '#a88b50', '#a57b35'].includes(lower)) return 'brass';
  if (['#544534', '#5a4938', '#69533c'].includes(lower)) return 'wood';
  if (['#424b4b', '#475457'].includes(lower)) return 'steel';
  if (['#f4f0e5', '#fbf7ee', '#faf7ee', '#ffffff', '#fff', '#e3ddc9'].includes(lower)) return 'ivory';
  const hsl = new T.Color(color).getHSL({ h: 0, s: 0, l: 0 });
  if (hsl.s < .1) return hsl.l > .77 ? 'ivory' : 'rock';
  if (hsl.h >= .43 && hsl.h <= .64) return 'water';
  if (hsl.h > .17 && hsl.h < .43) return 'plant';
  return hsl.l > .59 ? 'land' : 'rock';
}

/** Keep the original Popout's alpha object, material registry and cast-shadow
 * lifecycle. Only its hand-painted lighting is replaced by physical lighting.
 * Page text and specially authored vellum still use Popout.paper unchanged. */
export function createSolidMaterial(pop: any, role: Exclude<SolidMaterialRole, 'paper'>, color: string) {
  const material = new T.MeshStandardMaterial({ color, ...SOLID_FINISHES[role], side: T.DoubleSide, transparent: true });
  // The reveal is the only reason most solids are transparent. Avoid two
  // complete back/front draws for every opaque object after it has seated.
  material.forceSinglePass = true;
  // Closed two-sided specimen surfaces need the same back-face shadow
  // convention as the reference's front-sided solids. Double-sided shadow
  // depth caused visible self-shadow stripes on curved and shallow surfaces.
  material.shadowSide = T.BackSide;
  material.userData.materialRole = role;
  material.userData.visualTheme = 'physical-field-instruments-v2';
  if (pop.instrumentEnvironment && ['brass', 'steel', 'enamel'].includes(role)) {
    material.envMap = pop.instrumentEnvironment;
    material.envMapIntensity = role === 'enamel' ? .4 : .9;
  }
  const surfaceAlpha=pop.u?.uSurfAlpha??{value:1};
  material.userData.uniforms = { uSurfAlpha: surfaceAlpha };
  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.uSurfAlpha = surfaceAlpha;
    // Like the reference's brushed metal and restrained timber grain, finish
    // belongs to the substance. Object-space coordinates also work on custom
    // section meshes without UVs, and stay still while the instrument moves.
    const finished = role === 'brass' || role === 'steel' || role === 'wood';
    if (finished) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vInstrumentFinish;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstrumentFinish = position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vInstrumentFinish;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float finishCloud = (sin(vInstrumentFinish.x * 0.21 + sin(vInstrumentFinish.z * 0.13))
            + sin(vInstrumentFinish.z * 0.31 + vInstrumentFinish.y * 0.07)) * 0.5;
          ${role === 'wood' ? `
          float timberWarp = vInstrumentFinish.z + sin(vInstrumentFinish.x * 0.16) * 0.8;
          float timber = sin(timberWarp * 2.7 + sin(timberWarp * 0.27) * 2.1);
          float timberFine = sin(timberWarp * 15.3 + vInstrumentFinish.x * 0.03);
          diffuseColor.rgb *= vec3(1.035, 0.89, 0.76)
            * (0.97 + 0.065 * timber + 0.018 * timberFine + 0.022 * finishCloud);` : `
          diffuseColor.rgb *= ${role === 'brass' ? 'vec3(1.0, 0.87, 0.71)' : 'vec3(1.0)'} * (0.98 + 0.022 * finishCloud);`}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          float toolMark = sin(vInstrumentFinish.y * 32.0 + vInstrumentFinish.z * 0.3);
          // Filter the fine tool marks rather than letting subpixel machining
          // lines crawl on columns when the book camera moves.
          float toolFilter = 1.0 - smoothstep(0.6, 2.8, fwidth(vInstrumentFinish.y * 32.0));
          roughnessFactor = clamp(roughnessFactor + 0.018 * toolMark * toolFilter, 0.12, 1.0);`);
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSurfAlpha;')
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= uSurfAlpha;\n#include <opaque_fragment>');
  };
  material.customProgramCacheKey = () => `field-solid-popout-v4:${role}`;
  pop.paperMats?.push(material);
  return material;
}

/** Migration point for older scene-local paper factories. Each call retains
 * independent colour/opacity animation and the original Popout reveal alpha,
 * but its solid is lit like the other specimens. Actual labels and translucent
 * tracing sheets keep the paper factory and their special shader contracts. */
export function createSpecimenMaterial(pop:any, options:{color?:string;role?:Exclude<SolidMaterialRole,'paper'>;[key:string]:unknown}={}){
  const color=options.color??'#f4f0e5';
  const inferred=inferSolidMaterialRole(color);
  return createSolidMaterial(pop,options.role??(inferred==='paper'?'ivory':inferred),color);
}
