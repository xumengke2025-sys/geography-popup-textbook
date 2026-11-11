import { THREE as T } from './reference/engine.js';
import { FIELD_VISUAL_THEME } from './textbook-visual-theme';

/** Materials only: the original stage still owns the geometry, lighting and
 * shadows. The textbook pages and the scientific models are untouched. */
export function dressDesk(stage: any, book: any, renderer: any) {
  let disposed = false;
  const loaded = new Set<any>();
  const loader = new T.TextureLoader();
  const load = async (file: string, color = false) => {
    const texture = await loader.loadAsync(`${import.meta.env.BASE_URL}desk/${file}`);
    if (disposed) { texture.dispose(); return null; }
    texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.repeat.set(1.6, 1.35);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    loaded.add(texture);
    return texture;
  };
  const ready = Promise.all([
    load('dark_wood_diff_1k.jpg', true), load('dark_wood_nor_gl_1k.jpg'), load('dark_wood_rough_1k.jpg'),
  ]).then(([map, normalMap, roughnessMap]) => {
    if (disposed || !map || !normalMap || !roughnessMap) return;
    const material = stage.desk.material;
    material.map = map; material.normalMap = normalMap; material.roughnessMap = roughnessMap;
    material.normalScale.set(.055, .055); material.roughness = .96; material.envMapIntensity = .32;
    material.onBeforeCompile = (shader: any) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float walnutLuma = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
        vec3 walnut = mix(vec3(walnutLuma), diffuseColor.rgb, .24);
        diffuseColor.rgb = mix(vec3(.065, .052, .039), walnut, .18);`);
    };
    material.customProgramCacheKey = () => 'fieldbook-walnut-v4'; material.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }).catch(() => { /* Keep the source stage's procedural oak if a map fails. */ });

  // Fine woven writing mat and linen binding use the source engine's actual
  // weave maps, rather than a picture pasted across the textbook.
  const pad = stage.pad.material[0];
  pad.color.set(FIELD_VISUAL_THEME.desk.felt); pad.normalScale.set(.07, .07); pad.envMapIntensity = .24;
  stage.pad.material[1].color.set(FIELD_VISUAL_THEME.desk.feltEdge);
  for (const name of ['clothFront', 'clothSpine', 'clothBack']) {
    const material = book.materials[name];
    material.color.set(FIELD_VISUAL_THEME.desk.binding); material.normalScale.set(.30, .30);
    material.sheenColor.set(FIELD_VISUAL_THEME.desk.bindingSheen);
  }
  // A soft fill lifts black window shadows without adding another stage or
  // washing out the original paper. The model's cut faces retain clear form.
  stage.hemi.intensity = .48;
  stage.key.shadow.radius = 3.4;
  stage.scene.background.set(FIELD_VISUAL_THEME.desk.backdrop);
  return { ready, dispose() { disposed = true; loaded.forEach(texture => texture.dispose()); loaded.clear(); } };
}
