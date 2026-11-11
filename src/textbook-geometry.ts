import { THREE as T } from './reference/engine.js';
import { GeographyPen } from './geography-pen';
import { FIELD_PALETTE, FIELD_VISUAL_THEME } from './textbook-visual-theme';
import { createSolidMaterial, inferSolidMaterialRole, INSTRUMENT_LIGHT_LAYER, type SolidMaterialRole } from './textbook-solid-materials';
import { buildMiniatureHouse } from './textbook-miniature-architecture';

export type Vec3 = [number, number, number];
export const LIFT_MARGIN = 96;
export const PALETTE = FIELD_PALETTE;
export interface ModelMotion {
  update(phase: number, selection: number, dt: number, reduced: boolean): void;
  describe?(): Record<string, unknown>;
  focusBounds?(): { min: Vec3; max: Vec3 };
  /** Optional complete apparatus envelope, distinct from a selected specimen.
   * Older lessons retain their existing focusBounds behavior in both views. */
  overviewBounds?(): { min: Vec3; max: Vec3 };
  inspect?(target: string): void;
  inspectTargets?(): { target: string; label: string }[];
}
type Stroke = { points: any[]; width: number };

/** Geometry is in millimetres in the original Popout frame. No diagram bitmap
 * is sampled or mapped onto the model. Only small text labels use textures. */
export class TextbookGeometry {
  readonly root = new T.Group();
  readonly pen: GeographyPen;
  readonly bounds = new T.Box3();
  readonly meshes: any[] = [];
  readonly flow: Stroke[] = [];
  readonly moving: any;
  readonly accent: any;
  readonly structure: any;
  readonly materials = new Map<string, any>();
  volumeCount = 0;
  labelCount = 0;
  private inkBounds = new T.Box3();
  private labelTextures: any[] = [];
  private edgeCache = new WeakMap<object, Vec3[][]>();
  private outlines: Stroke[] = [];
  private pressedOffsets = new Map<any, any>();

  constructor(readonly pop: any, readonly width: number, readonly height: number) {
    pop.group.add(this.root);
    this.pen = new GeographyPen(pop, this.root);
    this.moving = this.pen.dynamic(FIELD_VISUAL_THEME.lines.flow, 14000, 1.25);
    this.accent = this.pen.dynamic(FIELD_VISUAL_THEME.lines.accent, 4000, 1.15);
    this.structure = this.pen.dynamic(FIELD_VISUAL_THEME.lines.structure, 18000, 1.05);
  }
  /** p is a position on the unchanged printed figure; y is actual height. */
  p(u: number, v: number, y = 0): Vec3 {
    return [u * this.width, y, -LIFT_MARGIN - (1 - v) * this.height];
  }
  v(p: Vec3) { return new T.Vector3(...p); }
  material(color: string) {
    return this.materialFor(inferSolidMaterialRole(color), color);
  }
  materialFor(role: SolidMaterialRole, color = PALETTE.paper) {
    const key = `${role}:${color}`;
    let mat = this.materials.get(key);
    if (!mat) {
      mat = role === 'paper'
        ? this.pop.paper({ color, ...FIELD_VISUAL_THEME.material, seed: this.materials.size + 3 })
        : createSolidMaterial(this.pop, role, color);
      mat.side = T.DoubleSide;
      mat.userData.materialRole = role;
      this.materials.set(key, mat);
    }
    return mat;
  }
  stroke(points: Vec3[], width = .65, closed = false) {
    this.pen.stroke(points, width, closed);
    for (const p of points) this.inkBounds.expandByPoint(this.v(p));
  }
  mesh(geometry: any, color = PALETTE.paper, edges = true, volume = true, role: SolidMaterialRole = inferSolidMaterialRole(color)) {
    const mesh = this.pop.addSurface(new T.Mesh(geometry, this.materialFor(role, color)), this.root);
    mesh.layers.enable(INSTRUMENT_LIGHT_LAYER);
    mesh.userData.kind = volume ? 'solid-geometry' : 'geometric-surface';
    mesh.userData.materialRole = role;
    this.meshes.push(mesh);
    if (volume) this.volumeCount++;
    if (edges) {
      const edge = new T.EdgesGeometry(geometry, 28), a = edge.attributes.position;
      for (let i = 0; i < a.count; i += 2) this.stroke([
        [a.getX(i), a.getY(i), a.getZ(i)], [a.getX(i + 1), a.getY(i + 1), a.getZ(i + 1)],
      ], .48);
      edge.dispose();
    }
    return mesh;
  }
  box(a: Vec3, b: Vec3, color = PALETTE.paper, edges = true) {
    const g = new T.BoxGeometry(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return this.mesh(g, color, edges);
  }
  /** A closed prism with a real top, bottom and side walls. */
  prism(footprint: [number, number][], bottom: number, top: number, color = PALETTE.land, outline = true) {
    const shape = new T.Shape();
    footprint.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    // Only a stable convex, reasonably thick landform gets a fine cut edge.
    // Thin map sheets and concave/dynamically deformed coastlines keep their
    // original extrusion and topology. The outer footprint never expands.
    const cut = this.prismCut(footprint, bottom, top);
    const g = cut?.geometry ?? new T.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, curveSegments: 2 });
    if (!cut) { g.rotateX(-Math.PI / 2); g.translate(0, bottom, 0); }
    const mesh = this.mesh(g, color, false);
    if (outline) {
      const rim = cut?.rim ?? footprint;
      this.stroke(rim.map(([x, z]) => [x, top, z]), .7, true);
      this.stroke(rim.map(([x, z]) => [x, bottom, z]), .4, true);
      for (const i of [0, Math.floor(footprint.length / 2)]) {
        const [x, z] = footprint[i]; this.stroke([[x, bottom, z], [x, top, z]], .45);
      }
    }
    return mesh;
  }
  /** A sub-millimetre bevel is face shading, not a new platform or outline. */
  private prismCut(points: [number, number][], bottom: number, top: number) {
    const n = points.length, s = this.width / 100;
    if (n < 3 || top - bottom < 1.2 * s) return null;
    const area = points.reduce((a, p, i) => a + p[0] * points[(i + 1) % n][1] - points[(i + 1) % n][0] * p[1], 0);
    const orientation = Math.sign(area);
    if (!orientation) return null;
    const shortest = Math.min(...points.map((p, i) => Math.hypot(p[0] - points[(i + 1) % n][0], p[1] - points[(i + 1) % n][1])));
    const r = Math.min(.16 * s, (top - bottom) * .055, shortest * .025);
    if (r < .025 * s) return null;
    const rim: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = points[(i + n - 1) % n], b = points[i], c = points[(i + 1) % n];
      const ax = b[0] - a[0], az = b[1] - a[1], bx = c[0] - b[0], bz = c[1] - b[1];
      const cross = ax * bz - az * bx;
      if (cross * orientation < 1e-6) return null;
      const al = Math.hypot(ax, az), bl = Math.hypot(bx, bz);
      const na = [-az / al * orientation, ax / al * orientation];
      const nb = [-bz / bl * orientation, bx / bl * orientation];
      const denominator = 1 + na[0] * nb[0] + na[1] * nb[1];
      if (denominator < .2) return null;
      rim.push([b[0] + r * (na[0] + nb[0]) / denominator, b[1] + r * (na[1] + nb[1]) / denominator]);
    }
    const vertices: number[] = [];
    const tri = (a: Vec3, b: Vec3, c: Vec3) => vertices.push(...a, ...b, ...c);
    const rings = [rim.map(([x, z]): Vec3 => [x, bottom, z]), points.map(([x, z]): Vec3 => [x, bottom + r, z]),
      points.map(([x, z]): Vec3 => [x, top - r, z]), rim.map(([x, z]): Vec3 => [x, top, z])];
    const center = rim.reduce((c, p) => [c[0] + p[0] / n, c[1] + p[1] / n], [0, 0]);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const next = orientation > 0 ? j : i, current = orientation > 0 ? i : j;
      tri([center[0], top, center[1]], rings[3][next], rings[3][current]);
      tri([center[0], bottom, center[1]], rings[0][current], rings[0][next]);
      for (let k = 0; k < 3; k++) {
        tri(rings[k][current], rings[k + 1][next], rings[k][next]);
        tri(rings[k][current], rings[k + 1][current], rings[k + 1][next]);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); geometry.computeVertexNormals();
    return { geometry, rim };
  }
  sphere(center: Vec3, radius: number, color = PALETTE.paper, outline = true, scale: Vec3 = [1, 1, 1]) {
    const g = new T.SphereGeometry(radius, 24, 16);
    g.scale(...scale); g.translate(...center);
    const mesh = this.mesh(g, color, false);
    if (outline) for (const plane of ['xy', 'xz', 'yz']) {
      this.stroke(Array.from({ length: 49 }, (_, i): Vec3 => {
        const a = i / 48 * Math.PI * 2, c = Math.cos(a) * radius, s = Math.sin(a) * radius;
        return [center[0] + (plane === 'yz' ? 0 : c * scale[0]), center[1] + (plane === 'xz' ? 0 : (plane === 'xy' ? s : c) * scale[1]), center[2] + (plane === 'xy' ? 0 : s * scale[2])];
      }), .45);
    }
    return mesh;
  }
  cylinder(a: Vec3, b: Vec3, radius: number, color = PALETTE.paper, outline = false, topRadius = radius) {
    const start = this.v(a), end = this.v(b), dir = end.clone().sub(start);
    const g = new T.CylinderGeometry(topRadius, radius, dir.length(), 12);
    g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray());
    return this.mesh(g, color, outline);
  }
  tube(points: Vec3[], radius: number, color = PALETTE.water, edges = false) {
    const curve = new T.CatmullRomCurve3(points.map(p => this.v(p)));
    return this.mesh(new T.TubeGeometry(curve, Math.max(20, points.length * 4), radius, 6, false), color, edges);
  }
  label(text: string, at: Vec3, w: number, h = w / Math.max(3, text.length) * 1.15, options: { appearance?: 'paper' | 'engraved' | 'dial'; ink?: string } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(256, Math.ceil(w * 24)); canvas.height = Math.max(64, Math.ceil(h * 24));
    const c = canvas.getContext('2d')!;
    const label = FIELD_VISUAL_THEME.labels;
    const engraved = options.appearance === 'engraved';
    const dial = options.appearance === 'dial';
    if (dial) {
      c.fillStyle = '#e9e1ce'; c.fillRect(0, 0, canvas.width, canvas.height);
      c.strokeStyle = label.ink; c.lineWidth = 1.3;
      c.beginPath(); c.arc(canvas.width / 2, canvas.height / 2, canvas.width * .477, 0, Math.PI * 2); c.stroke();
      // Nine qualitative divisions match the physical neutral face, without
      // inventing a calibrated pressure unit or adding another overlay.
      for (let i = -4; i <= 4; i++) {
        const angle = Math.PI / 2 + i * .2, inner = i % 2 ? .418 : .376;
        c.lineWidth = i % 2 ? 1.4 : 2;
        c.beginPath(); c.moveTo(canvas.width * (.5 + Math.cos(angle) * inner), canvas.height * (.5 - Math.sin(angle) * inner));
        c.lineTo(canvas.width * (.5 + Math.cos(angle) * .479), canvas.height * (.5 - Math.sin(angle) * .479)); c.stroke();
      }
    } else if (!engraved) {
    c.fillStyle = label.paper; c.fillRect(0, 0, canvas.width, canvas.height);
    // The same quiet paper slip throughout the atlas: a thin cut edge, a
    // slightly warmer foot, and crisp type. No extra caption or badge is added.
    c.fillStyle = label.foot; c.fillRect(0, canvas.height - 2, canvas.width, 2);
    c.strokeStyle = label.edge; c.lineWidth = 1;
    c.strokeRect(.5, .5, canvas.width - 1, canvas.height - 1);
    }
    c.fillStyle = options.ink ?? label.ink;
    let fontSize = Math.floor(canvas.height * (dial ? .27 : .69));
    c.font = `500 ${fontSize}px FieldSans, 'Microsoft YaHei', sans-serif`;
    // A label is measured before drawing: the canvas must never silently clip
    // Chinese characters or force the renderer to squeeze them horizontally.
    if (c.measureText(text).width > canvas.width * .90) {
      fontSize = Math.floor(fontSize * canvas.width * .90 / c.measureText(text).width);
      c.font = `500 ${fontSize}px FieldSans, 'Microsoft YaHei', sans-serif`;
    }
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, canvas.width / 2, canvas.height * (dial ? .74 : .53));
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    this.labelTextures.push(texture);
    // Instrument inscriptions belong to the real dial below, rather than
    // another paper rectangle floating in front of its machined face.
    const material = engraved || dial ? new T.MeshBasicMaterial({ transparent: true, toneMapped: false })
      : this.pop.paper({ hatch: 0, shade: .025 });
    material.map = texture; material.side = T.DoubleSide;
    if (engraved || dial) {
      material.alphaTest = .015;
      material.forceSinglePass = true;
      material.polygonOffset = true;
      material.polygonOffsetFactor = -2;
      material.polygonOffsetUnits = -2;
      // Ink has no separate specular surface. Keep its reveal in the original
      // Popout lifecycle, without lighting the transparent glyph carrier.
      const alpha = this.pop.u?.uSurfAlpha ?? { value: 1 };
      material.userData.uniforms = { uSurfAlpha: alpha };
      material.onBeforeCompile = (shader: any) => {
        shader.uniforms.uSurfAlpha = alpha;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uSurfAlpha;')
          .replace('#include <opaque_fragment>', 'diffuseColor.a *= uSurfAlpha;\n#include <opaque_fragment>');
      };
      material.customProgramCacheKey = () => 'fieldbook-instrument-inscription-v2';
      this.pop.paperMats?.push(material);
    }
    material.userData.visualTheme = FIELD_VISUAL_THEME.id;
    const g = dial ? new T.CircleGeometry(w / 2, 64) : new T.PlaneGeometry(w, h);
    const mesh = this.pop.addSurface(new T.Mesh(g, material), this.root); mesh.userData.kind = 'text-label';
    mesh.userData.text = text; mesh.userData.fontRatio = fontSize / canvas.height;
    if (engraved || dial) { mesh.userData.labelAppearance = options.appearance; mesh.userData.castShadow = false; mesh.castShadow = false; }
    mesh.position.set(...at);
    this.meshes.push(mesh); this.labelCount++;
    return mesh;
  }
  /** Animated contours use the same black ink as the static construction. */
  contour(points: Vec3[], width = .65) {
    this.outlines.push({ points: points.map(p => this.v(p)), width });
  }
  faceLabels(rotation: any) {
    this.root.updateWorldMatrix(true, true);
    const inverse = this.root.getWorldQuaternion(new T.Quaternion()).invert();
    for (const mesh of this.meshes) if (mesh.userData.kind === 'text-label' && mesh.userData.labelMount !== 'surface') {
      // rotation is already expressed in the natural-model root frame.
      const parentRotation = mesh.parent.getWorldQuaternion(new T.Quaternion());
      parentRotation.premultiply(inverse);
      mesh.quaternion.copy(parentRotation.invert().multiply(rotation));
    }
  }
  /** A topographic solid; its edge profile is part of its geometry. */
  terrain(x0: number, x1: number, z0: number, z1: number, fn: (x: number, z: number) => number, color = PALETTE.green, nx = 36, nz = 22, bottom = 0) {
    const verts: number[] = [], indices: number[] = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + (x1 - x0) * i / nx, z = z0 + (z1 - z0) * j / nz; verts.push(x, fn(x, z), z);
      if (j < nz && i < nx) { const k = j * (nx + 1) + i; indices.push(k, k + nx + 1, k + 1, k + 1, k + nx + 1, k + nx + 2); }
    }
    const boundary: Vec3[] = [];
    for (let i = 0; i <= nx; i++) boundary.push([x0 + (x1 - x0) * i / nx, fn(x0 + (x1 - x0) * i / nx, z0), z0]);
    for (let j = 1; j <= nz; j++) boundary.push([x1, fn(x1, z0 + (z1 - z0) * j / nz), z0 + (z1 - z0) * j / nz]);
    for (let i = nx - 1; i >= 0; i--) boundary.push([x0 + (x1 - x0) * i / nx, fn(x0 + (x1 - x0) * i / nx, z1), z1]);
    for (let j = nz - 1; j > 0; j--) boundary.push([x0, fn(x0, z0 + (z1 - z0) * j / nz), z0 + (z1 - z0) * j / nz]);
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i], b = boundary[(i + 1) % boundary.length], k = verts.length / 3;
      verts.push(...a, ...b, b[0], bottom, b[2], a[0], bottom, a[2]); indices.push(k, k + 1, k + 2, k, k + 2, k + 3);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(verts, 3)); g.setIndex(indices); g.computeVertexNormals();
    const mesh = this.mesh(g, color, false); this.stroke(boundary, .6, true);
    return mesh;
  }
  tree(at: Vec3, h: number, kind: 'broad' | 'pine' = 'broad', color = PALETTE.green) {
    const [x, y, z] = at;
    this.cylinder(at, [x, y + h * .78, z], h * .035, PALETTE.rock);
    this.stroke([at, [x, y + h * .9, z]], .5);
    if (kind === 'pine') {
      for (let j = 0; j < 3; j++) {
        const yy = y + h * (.42 + j * .19), r = h * (.26 - j * .055);
        this.cylinder([x, yy - h * .18, z], [x, yy + h * .26, z], r, color, false, 0);
        this.stroke([[x - r, yy - h * .18, z], [x, yy + h * .26, z], [x + r, yy - h * .18, z]], .5);
      }
    } else {
      // A shaded crown, rather than three full wireframe great circles, keeps
      // miniature trees solid and lets the scientific overlays remain legible.
      this.sphere([x, y + h * .78, z], h * .25, color, false, [1.15, .95, .9]);
      this.stroke([[x, y + h * .52, z], [x + h * .13, y + h * .8, z]], .4);
    }
  }
  cloud(at: Vec3, w: number) {
    for (const [x, y, r] of [[-.3, 0, .24], [0, .07, .31], [.31, -.02, .22]])
      this.sphere([at[0] + x * w, at[1] + y * w, at[2]], r * w, PALETTE.paper, true, [1, .64, .63]);
  }
  house(at: Vec3, w: number, h: number, color = PALETTE.paper) {
    buildMiniatureHouse(this,at,w,h,color);
  }
  /** Curve, tracer and arrowhead all share the same 3-D path. */
  trace(points: Vec3[], phase: number, count = 4, color: 'flow' | 'accent' = 'flow', direction = 1, strength = 1, closed = false) {
    if (strength < .015 || points.length < 2) return;
    // The reference engine's two-point Catmull-Rom curve overshoots its start
    // and briefly reverses its tangent. A straight pressure gradient needs a
    // straight path, including at the first and last particle positions.
    const path = points.length === 2
      ? new T.LineCurve3(this.v(points[0]), this.v(points[1]))
      : new T.CatmullRomCurve3(points.map(p => this.v(p)), closed, 'catmullrom', .28);
    const out: Stroke[] = color === 'flow' ? this.flow : this.accentStrokes;
    const scale = Math.max(1, Math.min(2.3, this.width / 70));
    out.push({ points: path.getPoints(70), width: .9 * strength });
    for (let j = 0; j < count; j++) {
      const t = ((phase * direction + j / count) % 1 + 1) % 1;
      const p = path.getPoint(t), tangent = path.getTangent(t).multiplyScalar(direction).normalize();
      let normal = new T.Vector3().crossVectors(tangent, new T.Vector3(0, 0, 1));
      if (normal.lengthSq() < .01) normal.crossVectors(tangent, new T.Vector3(0, 1, 0));
      normal.normalize();
      const back = p.clone().addScaledVector(tangent, -scale * 1.6 * strength);
      out.push({ points: [back.clone().addScaledVector(normal, scale * .75 * strength), p, back.clone().addScaledVector(normal, -scale * .75 * strength)], width: 1.45 });
    }
  }
  accentStrokes: Stroke[] = [];
  ring(center: Vec3, radius: number, plane: 'xy' | 'xz' = 'xy', color: 'flow' | 'accent' = 'accent') {
    const points = Array.from({ length: 65 }, (_, i) => {
      const a = i / 64 * Math.PI * 2;
      return this.v([center[0] + radius * Math.cos(a), center[1] + (plane === 'xy' ? radius * Math.sin(a) : 0), center[2] + (plane === 'xz' ? radius * Math.sin(a) : 0)]);
    });
    (color === 'flow' ? this.flow : this.accentStrokes).push({ points, width: .5 });
  }
  outline(mesh: any, width = .5) {
    let edges = this.edgeCache.get(mesh.geometry);
    if (!edges) {
      const geometry = new T.EdgesGeometry(mesh.geometry, 28), a = geometry.attributes.position;
      edges = [];
      for (let i = 0; i < a.count; i += 2) edges.push([[a.getX(i), a.getY(i), a.getZ(i)], [a.getX(i + 1), a.getY(i + 1), a.getZ(i + 1)]]);
      geometry.dispose(); this.edgeCache.set(mesh.geometry, edges);
    }
    const matrix = this.localMatrix(mesh);
    for (const edge of edges) this.outlines.push({ points: edge.map(p => this.v(p).applyMatrix4(matrix)), width });
  }
  /** Includes rigid-formation wrappers and any chapter-owned nested pivots. */
  localMatrix(mesh: any) {
    mesh.updateWorldMatrix(true, false);
    return this.root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  }
  beginFrame() {
    // Restore the last visual press before the deterministic world update.
    // It never becomes part of a scientific pose or an observation record.
    for (const [mesh, position] of this.pressedOffsets) mesh.position.copy(position);
    this.pressedOffsets.clear();
    this.flow.length = 0; this.accentStrokes.length = 0; this.outlines.length = 0;
  }
  endFrame(live: boolean, assembling = false) {
    if (live) for (const mesh of this.meshes) {
      if (!mesh.visible || !mesh.userData.modelInput || mesh.userData.kind === 'text-label'
        || mesh.userData.interactionFeedback === false) continue;
      if (!mesh.userData.modelHovered && !mesh.userData.modelPressed) continue;
      mesh.geometry.computeBoundingSphere();
      // Large terrain pieces use their own local response, rather than
      // outlining the whole scene when only a small place was selected.
      if (mesh.geometry.boundingSphere.radius * Math.max(mesh.scale.x, mesh.scale.y, mesh.scale.z) > this.width * .24) continue;
      if (mesh.userData.modelPressed) {
        this.pressedOffsets.set(mesh, mesh.position.clone());
        mesh.position.y -= this.width * .0035;
      }
      this.outline(mesh, mesh.userData.modelPressed ? .95 : .72);
    }
    if (assembling) {
      this.outlines.length = 0;
      for (const mesh of this.meshes) {
        if (!mesh.visible || mesh.userData.kind === 'text-label' || mesh.userData.instrumentAssembly) continue;
        const reveal = mesh.geometry.getAttribute('aFieldRevealStart')?.getX(0) ?? 0;
        if ((mesh.userData.formationProgress ?? 0) <= reveal) continue;
        // Round silhouettes are drawn by their original ink once seated;
        // high-tessellation smooth surfaces need no wire cage while rising.
        if (['SphereGeometry', 'LatheGeometry', 'TubeGeometry'].includes(mesh.geometry.type)) continue;
        this.outline(mesh, .36);
      }
    }
    this.pen.lines.mesh.visible = !assembling;
    this.moving.setLines(this.flow); this.accent.setLines(this.accentStrokes);
    this.moving.mesh.visible = live; this.accent.mesh.visible = live;
    this.structure.setLines(this.outlines); this.structure.mesh.visible = live || assembling;
  }
  finish() { this.pen.finish(); this.measure(); }
  measure() {
    this.bounds.copy(this.inkBounds);
    for (const mesh of this.meshes) {
      mesh.geometry.computeBoundingBox();
      this.bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(this.localMatrix(mesh)));
    }
  }
  dispose() { for (const texture of this.labelTextures) texture.dispose(); this.pen.dispose(); }
}
