import { THREE as T } from './reference/engine.js';

/** The close-up uses the instrument's own support plane. A matte, locally
 * lit surface receives the same moving shadows as the original desk. */
export class SpecimenCloth {
  readonly mesh: any;
  private key = new T.DirectionalLight('#fff2db', 0);
  private rim = new T.DirectionalLight('#e1eaf0', 0);
  private room: any;
  private paperBackground: any;
  private farCloth = new T.Color('#263a33');
  private deskKey: any;
  private deskIntensity: number;
  private target = 0;
  private amount = 0;
  private radius = { value: 60 };
  private reveal = { value: 0 };
  constructor(scene: any, deskKey: any) {
    this.room = scene;
    this.paperBackground = scene.background.clone();
    this.deskKey = deskKey;
    this.deskIntensity = deskKey.intensity;
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -.00018;
    this.key.shadow.radius = 3.6;
    this.key.shadow.intensity = .76;
    this.key.visible = this.rim.visible = false;
    scene.add(this.key, this.key.target, this.rim, this.rim.target);
    const mat = new T.MeshStandardMaterial({
      color: '#34453f', roughness: 1, metalness: 0, envMapIntensity: .18,
      transparent: true, depthWrite: false,
    });
    mat.onBeforeCompile = (shader: any) => {
      shader.uniforms.uClothRadius = this.radius;
      shader.uniforms.uClothReveal = this.reveal;
      shader.uniforms.uClothDistanceColor = { value: this.farCloth };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vCloth;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCloth = position.xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform float uClothRadius;
          uniform vec3 uClothDistanceColor;
          uniform float uClothReveal;
          varying vec2 vCloth;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 xy = vCloth / uClothRadius;
          float poolLight = exp(-dot(xy - vec2(-.63, -.21), xy - vec2(-.63, -.21)) * .54);
          float weavePhase = dot(vCloth, vec2(9.1, 6.3));
          float weave = sin(weavePhase) * sin(dot(vCloth, vec2(-6.3,9.1)));
          float filteredPile = weave * (1.0-smoothstep(.65, 2.8, fwidth(weavePhase)));
          diffuseColor.rgb *= mix(vec3(.27,.35,.37), vec3(1.05,.98,.79), poolLight) * (1.0 + .038 * filteredPile);
          diffuseColor.a *= uClothReveal;`)
        .replace('#include <opaque_fragment>', `
          outgoingLight = mix(outgoingLight, uClothDistanceColor, smoothstep(2.9,5.8,length(xy)));
          #include <opaque_fragment>`);
    };
    const geometry = new T.PlaneGeometry(12000, 12000);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new T.Mesh(geometry, mat);
    this.mesh.name = '近看仪器的绒面';
    this.mesh.visible = false;
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = -1000;
    scene.add(this.mesh);
  }
  seat(frame: any, bounds: any) {
    const centre = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
    this.mesh.position.set(centre.x, bounds.min.y - .12, centre.z).applyMatrix4(frame);
    this.mesh.quaternion.setFromRotationMatrix(frame);
    const focus = centre.clone().applyMatrix4(frame);
    const span = Math.max(16, size.length() * .6);
    this.key.target.position.copy(focus);
    this.rim.target.position.copy(focus);
    this.key.position.copy(centre).add(new T.Vector3(-1.1, 2.7, 1.3).multiplyScalar(span)).applyMatrix4(frame);
    this.rim.position.copy(centre).add(new T.Vector3(1.4, 1.1, -1.8).multiplyScalar(span)).applyMatrix4(frame);
    const camera = this.key.shadow.camera;
    camera.left = camera.bottom = -span * 1.55;
    camera.right = camera.top = span * 1.55;
    camera.near = .1;
    camera.far = span * 8;
    camera.updateProjectionMatrix();
    this.key.shadow.normalBias = span * .00055;
    this.radius.value = Math.max(18, .57 * Math.max(size.x, size.z));
  }
  update(active: boolean, progress: number, seconds: number, reduced: boolean) {
    this.target = active ? T.MathUtils.smoothstep(progress, .68, 1) : 0;
    this.amount = reduced ? this.target : T.MathUtils.damp(this.amount, this.target, 10, Math.min(.1, seconds));
    if (Math.abs(this.target - this.amount) < .004) this.amount = this.target;
    this.reveal.value = this.amount;
    this.mesh.visible = this.key.visible = this.rim.visible = this.amount > 0;
    this.key.intensity = this.amount * 2.15;
    this.rim.intensity = this.amount * 1.40;
    this.deskKey.intensity = this.deskIntensity * (1 - this.amount);
    this.deskKey.visible = this.amount < 1;
    this.room.background.copy(this.paperBackground).lerp(this.farCloth, this.amount);
  }
  get seated() { return this.amount >= 1; }
  reset() { this.update(false, 0, 0, true); }
  dispose() { this.key.shadow.dispose(); }
}


