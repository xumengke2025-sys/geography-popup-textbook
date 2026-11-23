import { describe, expect, it, vi } from 'vitest';
import * as Three from 'three';
vi.mock('../src/reference/engine.js', async () => ({ THREE: await import('three') }));
vi.mock('../src/geography-pen', () => ({ GeographyPen: class {
  lines = { mesh: new Three.Group() };
  dynamic() { return { mesh: new Three.Group(), setLines: vi.fn() }; }
  stroke() {} finish() {} dispose() {}
} }));
import { TextbookGeometry } from '../src/textbook-geometry';
import { RigidFormation } from '../src/textbook-formation';
import { instrumentProfile } from '../src/textbook-instrument-profiles';
import { createSolidMaterial, inferSolidMaterialRole } from '../src/textbook-solid-materials';

function fixture() {
  const pop = { group: new Three.Group(), paperMats: [] as Three.Material[], surfaces: [] as Three.Mesh[], u: { uSurfAlpha: { value: .7 } },
    paper({ color = '#fff' } = {}) { const mat = new Three.MeshLambertMaterial({ color }); this.paperMats.push(mat); return mat; },
    addSurface(mesh: Three.Mesh, parent: Three.Object3D) { parent.add(mesh); this.surfaces.push(mesh); return mesh; } };
  return { pop, g: new TextbookGeometry(pop, 100, 75) };
}
const shaderFixture = () => ({ uniforms: {} as Record<string, unknown>,
  vertexShader: '#include <common>\nvoid main(){\n#include <begin_vertex>\n}',
  fragmentShader: '#include <common>\nvoid main(){\n#include <alphahash_fragment>\n#include <opaque_fragment>\n#include <dithering_fragment>\n}' });

describe('physical materials retain the original book reveal contract', () => {
  it('uses substance-specific lighting and the same Popout alpha object', () => {
    const { pop } = fixture(), brass = createSolidMaterial(pop, 'brass', '#a88b50'), rock = createSolidMaterial(pop, 'rock', '#b5a58a');
    expect(brass.isMeshStandardMaterial).toBe(true); expect(brass.metalness).toBeGreaterThan(.7);
    expect(rock.roughness).toBeGreaterThan(brass.roughness); expect(rock.metalness).toBe(0);
    expect(pop.paperMats).toContain(brass); expect(pop.paperMats).toContain(rock);
    const shader = shaderFixture(); brass.onBeforeCompile(shader as any, null as any);
    expect(shader.uniforms.uSurfAlpha).toBe(pop.u.uSurfAlpha);
    expect(shader.fragmentShader).toContain('diffuseColor.a *= uSurfAlpha;');
    expect(inferSolidMaterialRole('#4d8c98')).toBe('water'); expect(inferSolidMaterialRole('#91aa88')).toBe('plant');
  });
  it('caches by role and color without replacing label/vellum paper factories', () => {
    const { g, pop } = fixture();
    expect(g.materialFor('brass', '#aaa')).toBe(g.materialFor('brass', '#aaa'));
    expect(g.materialFor('steel', '#aaa')).not.toBe(g.materialFor('brass', '#aaa'));
    expect(g.materialFor('paper').isMeshLambertMaterial).toBe(true);
    expect(pop.paper().isMeshLambertMaterial).toBe(true);
  });
  it('keeps the instrument reflection off scientific land and printed paper', () => {
    const {pop}=fixture(), environment=new Three.Texture();
    Object.assign(pop,{instrumentEnvironment:environment});
    for(const role of ['brass','steel','enamel'] as const) expect(createSolidMaterial(pop,role,'#aaa').envMap).toBe(environment);
    expect(createSolidMaterial(pop,'land','#aaa').envMap).toBeNull();
    expect(pop.paper().isMeshLambertMaterial).toBe(true);
    environment.dispose();
  });
  it('preserves mounted engraving while only free labels face the camera', () => {
    const {g}=fixture(), engraved=g.mesh(new Three.PlaneGeometry(8,3),'#eee',false), slip=g.mesh(new Three.PlaneGeometry(8,3),'#eee',false);
    engraved.userData.kind=slip.userData.kind='text-label'; engraved.userData.labelMount='surface';
    engraved.rotation.x=-.9; const mounted=engraved.quaternion.clone();
    const cameraRotation=new Three.Quaternion().setFromEuler(new Three.Euler(.3,.5,0));
    g.faceLabels(cameraRotation);
    expect(engraved.quaternion.equals(mounted)).toBe(true);
    expect(slip.quaternion.angleTo(cameraRotation)).toBeLessThan(1e-7);
  });
});

describe('rigid parts form without changing the scientific pose or shape', () => {
  it('forms opted-in nested subassemblies without overwriting their scientific transforms',()=>{
    const {g}=fixture(),carrier=new Three.Group(),specimen=new Three.Group();
    carrier.name='inclined-carrier';carrier.position.set(20,8,-120);carrier.scale.setScalar(1.5);
    carrier.userData.rigidFormationGroup={start:.03,offset:[0,-6,0],angle:-.045,axis:'x'};
    specimen.name='earth-station';specimen.position.set(-30,23,5);specimen.scale.setScalar(.6);
    specimen.userData.rigidFormationGroup={start:.3,offset:[0,-3,0],angle:-.18,axis:'x'};
    g.root.add(carrier);carrier.add(specimen);
    const globe=g.mesh(new Three.SphereGeometry(8,16,12),'#537d80',false);specimen.add(globe);g.measure();
    const formation=new RigidFormation(g,instrumentProfile('cosmic-scale')!);
    expect(formation.parts).toHaveLength(2);
    const scientific=specimen.position.clone(),geometry=globe.geometry;
    formation.setProgress(.35);expect(specimen.parent!.rotation.x).not.toBe(0);
    for(const progress of [1,.3,0,.35,1]){
      specimen.rotation.z=.47;formation.setProgress(progress);
      expect(specimen.position.equals(scientific)).toBe(true);expect(specimen.rotation.z).toBe(.47);
      expect(specimen.scale.toArray()).toEqual([.6,.6,.6]);expect(globe.geometry).toBe(geometry);
    }
    specimen.parent!.updateMatrix();expect(specimen.parent!.matrix.equals(new Three.Matrix4())).toBe(true);
    formation.dispose();
  });
  it('preserves spherical volume, scientific transform and endpoint identity, in both directions', () => {
    const { g } = fixture();
    const sphere = g.sphere([50, 30, -130], 15, '#4d8c98', false);
    sphere.position.set(2, 3, 4); sphere.rotation.set(.1, .2, .3); g.measure();
    const scientific = sphere.matrix.clone(), vertices = Array.from(sphere.geometry.attributes.position.array);
    const formation = new RigidFormation(g, instrumentProfile('earth')!);
    formation.setProgress(.38); const partial = sphere.parent.matrix.clone(); sphere.parent.updateMatrix(); partial.copy(sphere.parent.matrix);
    for (const value of [0, .2, 1, .7, .38]) { formation.setProgress(value); sphere.updateMatrix(); expect(sphere.matrix.elements).toEqual(scientific.elements); }
    sphere.parent.updateMatrix(); expect(sphere.parent.matrix.elements).toEqual(partial.elements);
    expect(Array.from(sphere.geometry.attributes.position.array)).toEqual(vertices);
    expect(sphere.scale.toArray()).toEqual([1, 1, 1]); expect(g.root.scale.toArray()).toEqual([1, 1, 1]);
    formation.setProgress(1); sphere.parent.updateMatrix(); expect(sphere.parent.matrix.equals(new Three.Matrix4())).toBe(true);
    formation.dispose();
  });
  it('raises authored relief as a solid without rebuilding its mesh seams as ink on each frame', () => {
    const {g}=fixture();
    const specimen=g.mesh(new Three.BoxGeometry(4,6,8),'#ad9f82',false);
    specimen.userData.blenderPart='rock';
    specimen.userData.formationProgress=.8;
    const outline=vi.spyOn(g,'outline');
    g.beginFrame();g.endFrame(false,true);
    expect(outline).not.toHaveBeenCalledWith(specimen,expect.anything());
    expect(specimen.visible).toBe(true);
  });
  it('makes bounds and contours agree with deeply nested, rotated pivots', () => {
    const { g } = fixture(); g.root.position.set(10, 45, -8); g.root.rotation.y = .3;
    const box = g.mesh(new Three.BoxGeometry(4, 6, 8), '#b5a58a', false);
    const outer = new Three.Group(), inner = new Three.Group(); g.root.add(outer); outer.add(inner); inner.add(box);
    outer.rotation.z = .4; outer.position.set(20, 10, -130); inner.rotation.y = .7; inner.position.x = 5;
    g.measure(); g.root.updateWorldMatrix(true, true);
    const expected = box.geometry.boundingBox.clone().applyMatrix4(g.root.matrixWorld.clone().invert().multiply(box.matrixWorld));
    expect(g.bounds.min.distanceTo(expected.min)).toBeLessThan(1e-10); expect(g.bounds.max.distanceTo(expected.max)).toBeLessThan(1e-10);
    g.beginFrame(); g.outline(box); g.endFrame(true);
    const lines = (g.structure.setLines as ReturnType<typeof vi.fn>).mock.calls.at(-1)![0];
    for (const { points } of lines) for (const point of points) expect(expected.clone().expandByScalar(1e-6).containsPoint(point)).toBe(true);
  });
  it('keeps authored transparent shader callbacks and synchronizes per-piece depth alpha', () => {
    const { g, pop } = fixture(); const sheet = g.box([0, 0, -120], [80, .2, -70]);
    const vellum = pop.paper(); let authored = false;
    vellum.onBeforeCompile = shader => { authored = true; shader.fragmentShader += '\n// authored opacity multiplier'; };
    sheet.material = vellum; g.measure(); const formation = new RigidFormation(g, instrumentProfile('gis')!);
    const colorShader = shaderFixture(); vellum.onBeforeCompile(colorShader as any, null as any);
    expect(authored).toBe(true); expect(colorShader.fragmentShader).toContain('// authored opacity multiplier');
    expect(colorShader.fragmentShader).toContain('gl_FragColor.a *= smoothstep');
    const depthShader = shaderFixture(); sheet.customDepthMaterial.onBeforeCompile(depthShader as any, null as any);
    expect(depthShader.uniforms.uSurfAlpha).toBe(pop.u.uSurfAlpha);
    expect(depthShader.uniforms.uFieldReveal).toBe(colorShader.uniforms.uFieldReveal);
    expect(depthShader.fragmentShader).toContain('diffuseColor.a *= uSurfAlpha * smoothstep');
    expect(sheet.geometry.getAttribute('aFieldRevealStart').count).toBe(sheet.geometry.attributes.position.count);
    formation.dispose();
  });
});
