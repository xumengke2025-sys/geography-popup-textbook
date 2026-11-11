import { THREE as T, createRenderer, Popout } from '../src/reference/engine.js';
import { TextbookGeometry } from '../src/textbook-geometry';
import { buildGisWorld } from '../src/textbook-gis-world';
import { gisSvg } from '../src/textbook-gis-model';

await document.fonts.ready;
const host = document.querySelector<HTMLDivElement>('#scene')!;
const canvas = document.createElement('canvas'); host.append(canvas);
const renderer = createRenderer(canvas); renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
const scene = new T.Scene(); scene.background = new T.Color('#e8e5de');
const camera = new T.PerspectiveCamera(34, 1, .1, 1500);
camera.position.set(147, 175, 51); camera.lookAt(50, 18, -145);
const hemi = new T.HemisphereLight('#fff9e9', '#b0b4a7', 2.2); scene.add(hemi);
const key = new T.DirectionalLight('#fff7e8', 3.2); key.position.set(-30, 190, -70); scene.add(key);
const ground = new T.Mesh(new T.BoxGeometry(116, .9, 105), new T.MeshStandardMaterial({ color: '#f7f2e6', roughness: 1 }));
ground.position.set(50, -3.5, -145); scene.add(ground);
const pop = new Popout(renderer, { frame: new T.Matrix4(), printRect: { x0: 0, x1: 100, y0: 80, y1: 190 }, cab: new T.Vector2(0, 1) });
scene.add(pop.group);
const geometry = new TextbookGeometry(pop, 100, 90), motion = buildGisWorld(geometry);
geometry.beginFrame(); motion.update(0, 0, 0, true); geometry.endFrame(true); geometry.finish();
pop.set('live');
let phase = 0;
function resize() {
  const width = host.clientWidth, height = host.clientHeight;
  renderer.setSize(width, height); camera.aspect = width / height; camera.updateProjectionMatrix();
  const res = renderer.getDrawingBufferSize(new T.Vector2()); pop.setResolution(res.x, res.y);
}
new ResizeObserver(resize).observe(host); resize();
function seek(value: number) {
  phase = Math.max(0, Math.min(1, value));
  document.querySelector<HTMLInputElement>('#phase')!.value = String(phase * 1000);
  document.querySelector<HTMLOutputElement>('#value')!.value = phase.toFixed(3);
  document.querySelector('#flat')!.innerHTML = gisSvg(phase, 0);
}
document.querySelector<HTMLInputElement>('#phase')!.addEventListener('input', event => seek(Number((event.target as HTMLInputElement).value) / 1000));
document.querySelectorAll<HTMLButtonElement>('[data-seek]').forEach(button => button.addEventListener('click', () => seek(Number(button.dataset.seek))));
const read = () => ({ ...motion.describe?.(), actualStationMeshes: geometry.meshes.filter(m => m.userData.gisRole === 'rain-station').length,
  texturesOnNonLabels: geometry.meshes.filter(m => m.material.map && m.userData.kind !== 'text-label').length,
  stationPositions: geometry.meshes.filter(m => m.userData.gisRole === 'rain-station').map(m => m.position.toArray()),
  labels: geometry.meshes.filter(m => m.userData.kind === 'text-label').map(m => ({ text: m.userData.text, visible: m.visible })),
  calls: renderer.info.render.calls, triangles: renderer.info.render.triangles });
(window as any).gisPreview = { seek, read };
seek(0);
function frame() {
  geometry.beginFrame(); motion.update(phase, 0, 1 / 60, true); geometry.endFrame(true);
  geometry.faceLabels(camera.quaternion); renderer.render(scene, camera); requestAnimationFrame(frame);
}
frame();
