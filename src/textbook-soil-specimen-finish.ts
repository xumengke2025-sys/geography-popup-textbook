import { createSolidMaterial } from './textbook-solid-materials';

/** A cut sample has mineral grain, pores and broken bedrock, rather than the
 * smooth coating of its metal holder. Coordinates remain object-local during
 * reveal and seeking. No bitmap, extra meshes or per-frame allocations. */
export function createSoilSpecimenFinish(pop: any, color: string, level: number, scale: number) {
  const material = createSolidMaterial(pop, level === 0 ? 'rock' : 'land', color);
  const baseCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader: any, renderer: any) => {
    baseCompile.call(material, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSoilSample;\nvarying mat3 vSoilFrame;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vSoilSample = position / ${scale.toFixed(8)};
        vSoilFrame = mat3(normalize(normalMatrix[0]), normalize(normalMatrix[1]), normalize(normalMatrix[2]));`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vSoilSample;
      varying mat3 vSoilFrame;
      float sampleHash(vec3 p) {
        p = fract(p * vec3(.1031, .11369, .13787));
        p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z);
      }
      float sampleNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(sampleHash(i), sampleHash(i + vec3(1,0,0)), f.x),
          mix(sampleHash(i + vec3(0,1,0)), sampleHash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(sampleHash(i + vec3(0,0,1)), sampleHash(i + vec3(1,0,1)), f.x),
          mix(sampleHash(i + vec3(0,1,1)), sampleHash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float sampleRelief(vec3 p) {
        return sampleNoise(p * 1.4) * .12 + sampleNoise(p * 4.7) * .045;
      }
      float rockJoint(vec2 p) {
        vec2 cell = floor(p), f = fract(p); float first = 10.0, second = 10.0;
        for (int y=-1; y<=1; y++) for (int x=-1; x<=1; x++) {
          vec2 g = vec2(float(x),float(y)), id = cell + g;
          vec2 site = vec2(sampleHash(vec3(id,2.0)),sampleHash(vec3(id,7.0)));
          float dist = length(g + .12 + site * .76 - f);
          if (dist < first) { second = first; first = dist; } else second = min(second,dist);
        }
        return 1.0 - smoothstep(.012,.046,second-first);
      }
    `).replace('#include <color_fragment>', `#include <color_fragment>
      float soilCloud = sampleNoise(vSoilSample * .47);
      float soilGrain = sampleNoise(vSoilSample * 3.8);
      // Derivative filtering keeps fine pores from sparkling during orbit.
      float grainFilter = 1.0 - smoothstep(.3, 1.4, length(fwidth(vSoilSample)) * 3.8);
      float pore = smoothstep(.70, .84, soilGrain) * grainFilter;
      diffuseColor.rgb *= .84 + .26 * soilCloud + .13 * soilGrain - pore * .24;
      ${level === 0 ? `
      vec2 rockCell = vec2(vSoilSample.x + vSoilSample.z * .47, vSoilSample.y) * vec2(.22,.35);
      rockCell += vec2(sampleNoise(vSoilSample * .8) * .18);
      diffuseColor.rgb *= 1.0 - rockJoint(rockCell) * .18;
      ` : ''}
    `).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      // Analytic object-space height gradient projected onto this cut face.
      vec3 soilGrad = vec3(
        sampleRelief(vSoilSample + vec3(.035,0,0)) - sampleRelief(vSoilSample - vec3(.035,0,0)),
        sampleRelief(vSoilSample + vec3(0,.035,0)) - sampleRelief(vSoilSample - vec3(0,.035,0)),
        sampleRelief(vSoilSample + vec3(0,0,.035)) - sampleRelief(vSoilSample - vec3(0,0,.035))) / .07;
      soilGrad = vSoilFrame * soilGrad;
      normal = normalize(normal - (soilGrad - normal * dot(soilGrad, normal)) * .55);
    `);
  };
  material.customProgramCacheKey = () => `cut-soil-v1:${level}:${scale.toFixed(8)}`;
  return material;
}
