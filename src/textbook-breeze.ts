import { THREE as T } from './reference/engine.js';
import { TextbookGeometry, type ModelMotion, type Vec3 } from './textbook-geometry';
import { evaluateSeaBreeze, AFTERNOON, NIGHT } from './model';

/** Two physical paper diagrams, occupying the two panels of textbook fig. 2.13.
 * The original Popout owns ink, the lift, paper shading and the return to print.
 * Every contour below belongs to a real surface. No textbook crop is textured
 * onto the coastline, the moving air or the flag. */
export function buildBreeze(b: TextbookGeometry): ModelMotion {
  const s = b.width / 100;
  const panels: { state: ReturnType<typeof evaluateSeaBreeze>; flag: any;
    rest: Float32Array; curve: any; pressure: any[]; guides: Vec3[][] }[] = [];

  for (let index = 0; index < 2; index++) {
    const left = index * .53, day = index === 0;
    const p = (u: number, v: number, h = 0) => b.p(left + u, v, h * s);
    const footprint = (a: [number, number][]) => a.map(([u, v]): [number, number] => {
      const q = p(u, v); return [q[0], q[2]];
    });
    const back = .44, front = .98;
    const shore = (v: number) => .224 + .014 * Math.sin((v - back) / (front - back) * Math.PI * 1.7)
      + .004 * Math.sin(v * 29);
    const edge = (v: number) => .018 + (front - v) * .05;
    const coast = Array.from({ length: 49 }, (_, j): [number, number] => {
      const v = back + j / 48 * (front - back); return [shore(v), v];
    });
    const ground = (u: number, v: number) => 2.35 + 4.2 * Math.sin(Math.PI * u) ** 2
      * Math.exp(-(((v - .63) / .23) ** 2));

    // An exposed coastal section: pale sand above a thin darker stratum.
    const outline: [number, number][] = [[edge(front), front], [edge(back), back], ...coast];
    b.prism(footprint(outline), -.65 * s, .65 * s, '#bbaa91');
    b.prism(footprint(outline), .65 * s, 2.35 * s, '#d4c6ac');
    b.prism(footprint([...coast, [.474, front], [.474, back]]), -.65 * s, 1.75 * s, '#c7dcd9');

    const nx = 32, nz = 28, vertices: number[] = [], indices: number[] = [];
    for (let row = 0; row <= nz; row++) for (let col = 0; col <= nx; col++) {
      const v = back + row / nz * (front - back), u = col / nx;
      vertices.push(...p(edge(v) + (shore(v) - edge(v)) * u, v, ground(u, v)));
      if (row < nz && col < nx) {
        const k = row * (nx + 1) + col;
        indices.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2);
      }
    }
    const boundary: Vec3[] = [];
    for (let col = 0; col <= nx; col++) boundary.push(p(edge(back) + (shore(back) - edge(back)) * col / nx, back, ground(col / nx, back)));
    for (let row = 1; row <= nz; row++) { const v = back + row / nz * (front - back); boundary.push(p(shore(v), v, 2.35)); }
    for (let col = nx - 1; col >= 0; col--) boundary.push(p(edge(front) + (shore(front) - edge(front)) * col / nx, front, ground(col / nx, front)));
    for (let row = nz - 1; row > 0; row--) { const v = back + row / nz * (front - back); boundary.push(p(edge(v), v, 2.35)); }
    for (let j = 0; j < boundary.length; j++) {
      const a = boundary[j], c = boundary[(j + 1) % boundary.length], k = vertices.length / 3;
      vertices.push(...a, ...c, c[0], 2.35 * s, c[2], a[0], 2.35 * s, a[2]);
      indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
    const terrain = new T.BufferGeometry();
    terrain.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    terrain.setIndex(indices); terrain.computeVertexNormals();
    b.mesh(terrain, '#eee5d2', false); b.stroke(boundary, .72, true);

    // The strand is a separate slender folded surface, not a stripe in a bitmap.
    const sandV: number[] = [], sandI: number[] = [];
    const waterline: Vec3[] = [];
    for (let j = 0; j < coast.length; j++) {
      const [u, v] = coast[j];
      const a = p(u - .008, v, 2.38), c = p(u + .012, v, 1.80);
      sandV.push(...a, ...c); waterline.push(c);
      if (j < coast.length - 1) { const k = j * 2; sandI.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const beach = new T.BufferGeometry();
    beach.setAttribute('position', new T.Float32BufferAttribute(sandV, 3)); beach.setIndex(sandI); beach.computeVertexNormals();
    b.mesh(beach, '#e1d2b2', false, false); b.stroke(waterline, .52);

    // Restrained, engraved water and dune marks. Their spacing follows the
    // coast rather than forming a second decorative screen-space texture.
    for (let row = 0; row < 10; row++) {
      const v = .47 + row * .050;
      for (let part = 0; part < 2; part++) {
        const start = shore(v) + .027 + part * .10;
        b.stroke(Array.from({ length: 15 }, (_, j) => p(start + j / 14 * .062,
          v + .0045 * Math.sin(j / 14 * Math.PI), 1.80)), .28);
      }
    }
    for (let row = 0; row < 6; row++) {
      const v = .49 + row * .079;
      b.stroke(Array.from({ length: 25 }, (_, j) => {
        const u = .12 + j / 24 * .70;
        return p(edge(v) + (shore(v) - edge(v)) * u, v + .005 * Math.sin(j * .12), ground(u, v) + .025);
      }), .25);
    }
    // Small tufts establish the scale without filling the diagram with scenery.
    for (const [u, v] of [[.075, .56], [.12, .86], [.08, .78]]) {
      const q = (u - edge(v)) / (shore(v) - edge(v)), h = ground(q, v);
      for (const lean of [-1, 0, 1]) b.stroke([p(u, v, h), p(u + lean * .006, v - .012, h + 1.10)], .38);
    }

    const state = evaluateSeaBreeze({ phase: day ? AFTERNOON : NIGHT, contrast: 1 });
    const xa = .12, xb = .402, low = 6.0, high = 34, v = .67;
    const path = [p(xb - .027, v, low), p(xa + .027, v, low), p(xa, v, low + 3.5),
      p(xa, v, high - 3.5), p(xa + .027, v, high), p(xb - .027, v, high),
      p(xb, v, high - 3.5), p(xb, v, low + 3.5)];
    const curve = new T.CatmullRomCurve3(path.map(q => b.v(q)), true, 'catmullrom', .20);
    // Four curved, freestanding paper arrows leave air between their tails.
    // A fine continuous guide makes the closed circulation easy to follow.
    b.stroke(curve.getPoints(128).map((q: any) => q.toArray() as Vec3), .30, true);
    for (let j = 0; j < 4; j++) ribbonArrow(b, curve, j / 4 + .015, .185, state.direction, s);

    const pressure: any[] = [], guides: Vec3[][] = [];
    for (const [height, a, c] of [[low + 6.3, state.pressure.landGround, state.pressure.seaGround],
      [high - 7, state.pressure.landUpper, state.pressure.seaUpper]] as const) {
      pressure.push(b.label(a.replace('相对', ''), p(.174, v - .012, height), 7.3 * s, 3.5 * s));
      pressure.push(b.label(c.replace('相对', ''), p(.348, v - .012, height), 7.3 * s, 3.5 * s));
      // These two short rules explicitly compare positions on one horizontal
      // plane; there is no line joining a surface pressure to an upper one.
      guides.push([p(.218, v, height), p(.303, v, height)]);
    }

    // The flag is the consequence of the near-surface air, rather than an
    // independently timed animation. The coast has land on its LEFT.
    const foot = p(shore(.90) - .024, .90, 2.7), top: Vec3 = [foot[0], foot[1] + 7.4 * s, foot[2]];
    b.cylinder(foot, top, .075 * s, '#53665e'); b.stroke([foot, top], .72);
    b.sphere(top, .13 * s, '#ede6d6', false);
    const cloth = new T.PlaneGeometry(4.7 * s, 1.65 * s, 24, 6); cloth.translate(2.35 * s, 0, 0);
    const flag = b.mesh(cloth, day ? '#b78361' : '#688f9b', false, false);
    flag.position.set(top[0], top[1] - .95 * s, top[2]);
    b.label('陆地', p(.112, 1.06, .9), 7.2 * s, 3.3 * s);
    b.label('海洋', p(.363, 1.06, .9), 7.2 * s, 3.3 * s);
    panels.push({ state, flag, rest: new Float32Array(cloth.attributes.position.array), curve, pressure, guides });
  }

  let selected = 0;
  return {
    update(phase, selection) {
      selected = selection;
      for (const [index, panel] of panels.entries()) {
        const { direction, strength } = panel.state;
        // Motion is slow enough to read the opposing surface / upper paths.
        for (let j = 0; j < 12; j++) {
          const t = ((phase * direction * 1.15 * strength + j / 12) % 1 + 1) % 1;
          const at = panel.curve.getPoint(t), tangent = panel.curve.getTangent(t);
          at.z += .24 * s;
          const tail = at.clone().addScaledVector(tangent, -.65 * s * direction);
          b.flow.push({ points: [tail, at], width: index === selection ? 1.35 : .85 });
        }
        panel.guides.forEach(rule => {
          for (let k = 0; k < 5; k++) b.contour([b.v(rule[0]).lerp(b.v(rule[1]), k / 5).toArray(),
            b.v(rule[0]).lerp(b.v(rule[1]), (k + .48) / 5).toArray()], .25);
        });
        // Keep the two textbook panels comparable without moving the camera
        // on selection. The selected panel alone has moving flag contours.
        for (const label of panel.pressure) label.visible = true;
        const a = panel.flag.geometry.attributes.position;
        for (let j = 0; j < a.count; j++) {
          const x = panel.rest[j * 3], y = panel.rest[j * 3 + 1], t = x / (4.7 * s);
          a.setXYZ(j, -direction * x * strength, y - (1 - strength) * t * 2.4 * s - .18 * s * t * t,
            (Math.sin(t * 7 - phase * Math.PI * 12) * .24 + Math.sin(t * 13 - phase * Math.PI * 17) * .07) * s * t * strength);
        }
        a.needsUpdate = true; panel.flag.geometry.computeVertexNormals();
        for (const ids of [Array.from({ length: 25 }, (_, j) => j), Array.from({ length: 25 }, (_, j) => j + 150),
          [0, 25, 50, 75, 100, 125, 150], [24, 49, 74, 99, 124, 149, 174]]) {
          b.contour(ids.map(j => new T.Vector3(a.getX(j), a.getY(j), a.getZ(j)).add(panel.flag.position).toArray()), .70);
        }
      }
    },
    describe: () => ({ kind: 'sea-breeze', layout: 'land-left-sea-right', selected: selected === 0 ? 'day' : 'night',
      groundX: -panels[selected].state.direction, upperX: panels[selected].state.direction,
      pressure: panels[selected].state.pressure, bitmapSurfaces: 0, panels: 2, sameHeightGuides: 4 }),
    focusBounds: () => ({ min: b.p(-.025, .33, -.8 * s), max: b.p(1.03, 1.17, 36 * s) }),
  };
}

/** An arrow bent along the actual air path, with both faces and a cut edge. */
function ribbonArrow(b: TextbookGeometry, curve: any, start: number, length: number, direction: number, s: number) {
  const positions: number[] = [], indices: number[] = [], outline: Vec3[][] = [[], []];
  const steps = 32;
  for (let j = 0; j <= steps; j++) {
    const progress = j / steps, t = ((start + progress * length * direction) % 1 + 1) % 1;
    const at = curve.getPoint(t), tangent = curve.getTangent(t).multiplyScalar(direction);
    const normal = new T.Vector3(-tangent.y, tangent.x, 0).normalize();
    const w = progress < .70 ? .29 : .97 * (1 - progress) / .30;
    for (const z of [-.085, .085]) for (const side of [-1, 1]) {
      const q = at.clone().addScaledVector(normal, side * w * s); q.z += z * s; positions.push(...q.toArray());
    }
    for (let side = 0; side < 2; side++) {
      const q = at.clone().addScaledVector(normal, (side * 2 - 1) * w * s); q.z += .095 * s;
      outline[side].push(q.toArray() as Vec3);
    }
    if (j < steps) {
      const k = j * 4;
      for (const [a, c] of [[0, 1], [2, 3], [0, 2], [1, 3]]) indices.push(k + a, k + c, k + a + 4, k + c, k + c + 4, k + a + 4);
    }
  }
  indices.push(0, 2, 1, 1, 2, 3);
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setIndex(indices); g.computeVertexNormals(); b.mesh(g, '#b8d0cd', false);
  outline.forEach(line => b.stroke(line, .58));
}
