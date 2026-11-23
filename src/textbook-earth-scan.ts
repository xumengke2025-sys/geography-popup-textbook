import { THREE as T } from './reference/engine.js';

export type EarthScan = 'loam' | 'outcrop' | 'alluvium' | 'turf' | 'sand';
const scans: EarthScan[] = ['loam', 'outcrop', 'alluvium', 'turf'];
const textures = new Map<EarthScan | 'walnut', { value: any }>();

export function scanUniform(kind: EarthScan | 'walnut') {
  let uniform = textures.get(kind);
  if (uniform) return uniform;
  const neutral = new T.DataTexture(new Uint8Array([128, 128, 210, 128]), 1, 1);
  neutral.needsUpdate = true;
  uniform = { value: neutral };
  textures.set(kind, uniform);
  if (typeof document === 'undefined') return uniform;
  const slot = uniform;
  new T.TextureLoader().load(import.meta.env.BASE_URL + 'textbook/materials/' + kind + '.webp', (image: any) => {
    image.wrapS = image.wrapT = T.RepeatWrapping;
    image.colorSpace = T.NoColorSpace;
    image.anisotropy = 4;
    slot.value = image;
    neutral.dispose();
  });
  return uniform;
}

/** Object-space box projection works on cut faces, sloping ground and grains
 * without a UV unwrap. All three physical channels use the same mip level. */
export function applyEarthScan(material: any, kind: EarthScan | 'valley', tileSize: number) {
  const previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey();
  const kinds = kind === 'valley' ? scans : [kind];
  const mixed = kind === 'valley';
  const span = Math.max(.0001, tileSize).toFixed(7);
  material.userData.earthScan = kind;
  material.userData.scanTileSize = tileSize;
  material.onBeforeCompile = (shader: any, renderer: any) => {
    previous.call(material, shader, renderer);
    for (const name of kinds) shader.uniforms['scan_' + name] = scanUniform(name);
    const varyings = 'varying vec3 vEarthPos, vEarthNormal; varying float vEarthDepth;' +
      (mixed ? ' varying vec3 vEarthFacies;' : '');
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + varyings + (mixed ? ' attribute vec3 facies;' : ''))
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vEarthPos = position / ${span};
        vEarthNormal = normal;
        vEarthDepth = ${span} * length(modelViewMatrix[0].xyz);
        ${mixed ? 'vEarthFacies = facies;' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        ${varyings}
        ${kinds.map(k => 'uniform sampler2D scan_' + k + ';').join('\n')}
        vec4 earthProjection(sampler2D photo, vec3 q, vec3 weights) {
          return texture2D(photo,q.zy) * weights.x
               + texture2D(photo,q.xz) * weights.y
               + texture2D(photo,q.xy) * weights.z;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 earthWeights = pow(abs(vEarthNormal),vec3(6.));
        earthWeights /= max(.00001,dot(earthWeights,vec3(1.)));
        vec3 earthP = vEarthPos;
        // Broad, gentle warping breaks up visible repeats across long strata.
        earthP += .064*sin(earthP.zxy*1.37 + .42*cos(earthP.yzx*1.71));
        ${mixed ? `vec3 faciesWeight = clamp(vEarthFacies,0.,1.);
          vec4 earthRead = earthProjection(scan_outcrop,earthP*.70,earthWeights)*faciesWeight.r
            + earthProjection(scan_alluvium,earthP*1.35,earthWeights)*faciesWeight.g
            + earthProjection(scan_turf,earthP*1.13,earthWeights)*faciesWeight.b
            + earthProjection(scan_loam,earthP,earthWeights)*max(0.,1.-dot(faciesWeight,vec3(1.)));` :
          'vec4 earthRead = earthProjection(scan_' + kind + ',earthP,earthWeights);'}
        float warmth = (255.0 * earthRead.a - 128.0) / 128.0;
        diffuseColor.rgb *= exp(vec3(.86,.10,-.94)*warmth) * mix(.43,1.57,earthRead.r);
        float earthHeight = (earthRead.g*.79 + earthRead.r*.21) * vEarthDepth * .033;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(.52*roughnessFactor+.48*earthRead.b,.36,.99);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 earthDx = -dFdx(vViewPosition), earthDy = -dFdy(vViewPosition);
        vec3 earthR1 = cross(earthDy,normal), earthR2 = cross(normal,earthDx);
        float earthDet = dot(earthDx,earthR1);
        vec3 earthGradient = (earthR1*dFdx(earthHeight) + earthR2*dFdy(earthHeight))
          * sign(earthDet)/max(abs(earthDet),.00000001);
        normal = normalize(normal - earthGradient / max(1.,length(earthGradient)*1.7));`);
  };
  material.customProgramCacheKey = () => previousKey + ':earth-scan-v2:' + kind + ':' + span;
  material.needsUpdate = true;
  return material;
}
