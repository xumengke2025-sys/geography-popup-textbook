import { THREE as T } from './reference/engine.js';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';
import type { CirculationProcessState } from './textbook-air-process-model';

/** A smoke tracer belongs to the air, including the descending limbs above
 * the ice baths. It follows the reveal phase so a paused demonstration,
 * a reverse scrub, and reduced motion give the same plume. */
export function createConvectionSmoke(b: TextbookGeometry, scale: number,
  point: (x: number, y: number, z: number) => Vec3) {
  const count = 34, strands = 3, paths = 7;
  const particles = count * strands * paths;
  const geometry = new T.BufferGeometry();
  const buffer = (size: number) => new T.Float32BufferAttribute(new Float32Array(particles * size), size).setUsage(T.DynamicDrawUsage);
  const positions = buffer(3), tangent = buffer(3), strength = buffer(1), width = buffer(1);
  geometry.setAttribute('position', positions);
  geometry.setAttribute('aTangent', tangent);
  geometry.setAttribute('aStrength', strength);
  geometry.setAttribute('aWidth', width);
  const material = new T.ShaderMaterial({
    uniforms: { uReveal: b.pop.u?.uSurfAlpha ?? { value: 1 }, uPixelScale: { value: 1 } },
    transparent: true, depthWrite: false,
    vertexShader: `
      attribute vec3 aTangent;
      attribute float aStrength;
      attribute float aWidth;
      uniform float uPixelScale;
      varying float vStrength;
      varying vec2 vAxis;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vec4 ahead = projectionMatrix * (mv + modelViewMatrix * vec4(aTangent, 0.0));
        vec2 d = ahead.xy / ahead.w - gl_Position.xy / gl_Position.w;
        vAxis = normalize(vec2(d.x * projectionMatrix[1][1] / projectionMatrix[0][0], -d.y) + vec2(1e-7));
        vStrength = aStrength;
        gl_PointSize = clamp(uPixelScale * aWidth / max(1.0,-mv.z), 1.0, 96.0);
      }`,
    fragmentShader: `
      uniform float uReveal;
      varying float vStrength;
      varying vec2 vAxis;
      void main() {
        vec2 p = gl_PointCoord - .5;
        vec2 local = vec2(dot(p,vAxis), dot(p,vec2(-vAxis.y,vAxis.x)));
        float envelope = max(0.0, exp(-8.0*local.x*local.x - 32.0*local.y*local.y) - .14);
        float alpha = envelope * uReveal * vStrength;
        if (alpha < .004) discard;
        gl_FragColor = vec4(vec3(.81,.87,.82), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const smoke = new T.Points(geometry, material);
  smoke.name = '热力环流空气示踪烟';
  smoke.frustumCulled = false;
  smoke.renderOrder = 2;
  const resolution = new T.Vector2();
  smoke.onBeforeRender = (renderer: any, _scene: any, camera: any) => {
    material.uniforms.uPixelScale.value = .5 * renderer.getDrawingBufferSize(resolution).y * camera.projectionMatrix.elements[5] * scale;
  };
  b.root.add(smoke);

  return (state: CirculationProcessState) => {
    smoke.visible = state.visibility.vertical > .005;
    if (!smoke.visible) return;
    const phase = state.phase;
    let index = 0;
    // All paths share the science diagram's x=18,50,82 columns. At the top
    // the rising stream divides left and right. Both floor currents return
    // toward the heated plate. The open ends fade into their joining limb.
    for (let path = 0; path < paths; path++) {
      const vertical = path < 3, warm = path === 0;
      const side = path === 1 || path === 3 || path === 5 ? -1 : 1;
      const upper = path === 3 || path === 4;
      const visibility = vertical ? state.visibility.vertical : state.visibility.horizontal;
      for (let strand = 0; strand < strands; strand++) for (let j = 0; j < count; j++, index++) {
        const u = ((j + .31 * strand) / count + phase * 1.7) % 1;
        const wave = u * Math.PI * (vertical ? 3.4 : 2.5) - phase * 9.7 + .68 * strand;
        const taper = Math.sin(Math.PI * u);
        const spread = (.45 + taper * 1.24) * Math.sin(wave) + (strand - 1) * .78;
        const origin = warm ? 50 : 50 + side * 32;
        const x = vertical ? origin + spread : 50 + side * 32 * (upper ? u : 1 - u);
        const y = vertical ? (warm ? 10 + 35 * u : 45 - 35 * u)
          : (upper ? 43.0 + 2.1 * taper : 26.8 - 1.0 * taper) + spread * .62;
        const z = 43 + 1.45 * Math.cos(wave * .89 + strand * 1.83);
        positions.setXYZ(index, ...point(x, y, z));
        tangent.setXYZ(index, vertical ? .20 * Math.cos(wave) : side * (upper ? 1 : -1),
          vertical ? (warm ? 1 : -1) : .13 * Math.cos(wave), .02);
        width.setX(index, (vertical ? 4.5 : 4.0) + 2.35 * taper + .54 * Math.sin(wave));
        const clearDial = vertical ? 1 - state.visibility.pressure * .86 * Math.exp(-((y - 12) ** 2) / 22) : 1;
        strength.setX(index, clearDial * visibility * taper * (warm ? .23 : .16) * (.72 + .28 * Math.sin(wave * 1.6)));
      }
    }
    for (const attribute of [positions, tangent, strength, width]) attribute.needsUpdate = true;
  };
}

