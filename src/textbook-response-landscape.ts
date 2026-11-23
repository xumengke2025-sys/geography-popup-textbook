import { THREE as T } from './reference/engine.js';
import { QUAKE_LAYOUT, type IntegratedPoint } from './textbook-integrated-model';
import { type Vec3, type TextbookGeometry } from './textbook-geometry';
import { applyEarthScan } from './textbook-earth-scan';
import { createSolidMaterial } from './textbook-solid-materials';

const riverX = (z: number) => 49.5 + 3.2 * Math.sin((z - 43) * .103) + 1.4 * Math.sin((z - 43) * .19);
const roads = QUAKE_LAYOUT.roads.map(edge => [QUAKE_LAYOUT.nodes[edge.a], QUAKE_LAYOUT.nodes[edge.b]]);

function relief(x: number, z: number) {
  let clearance = Infinity;
  for (const [a, b] of roads) {
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz)));
    clearance = Math.min(clearance, Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t));
  }
  clearance = Math.min(clearance, Math.hypot(x - 50, z - 7), Math.hypot(x - 89, z - 41));
  const shoulder = Math.min(1, Math.max(0, (clearance - 5) / 8));
  const hill = (cx: number, cz: number, w: number, d: number) => Math.exp(-(((x - cx) / w) ** 2 + ((z - cz) / d) ** 2));
  const ridge = 8 * hill(20, 3, 18, 8) + 6 * hill(75, 5, 27, 10) + 5 * hill(103, 30, 12, 22)
    + 3.3 * hill(31, 30, 18, 8);
  const distance = Math.abs(x - riverX(z));
  const bank = Math.min(1, Math.max(0, (distance - 3.5) / 6));
  const height = 2.4 + bank * shoulder * shoulder * (3 - 2 * shoulder) * ridge
    * (1 + .12 * Math.sin(x * .35 + z * .47)) - 2.4 * Math.exp(-((distance / 2.65) ** 2));
  return { height, distance };
}

/** A single terrain and water ribbon run through the three crossings. The
 * settlements and route centre lines keep their original registration. */
export function buildResponseLandscape(b: TextbookGeometry, s: number, p: (at: IntegratedPoint) => Vec3) {
  const z0 = p([0, 0, 0])[2];
  const nx = 128, nz = 74;
  const ground = b.terrain(2*s, 108*s, z0 + 3*s, z0 + 65*s,
    (x, z) => relief(x/s, (z-z0)/s).height*s, '#faf6ed', nx, nz, -3*s);
  const position = ground.geometry.attributes.position;
  const colors = new Float32Array(position.count * 3),facies=new Float32Array(position.count*3);
  const loam = new T.Color('#af9a76'), meadow = new T.Color('#74866e');
  const high = new T.Color('#9e9e86'), clay = new T.Color('#9d8669'), shade = new T.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)/s, z = (position.getZ(i)-z0)/s;
    const { height, distance } = relief(x,z);
    shade.copy(loam).lerp(meadow, Math.min(.88, .12 + .55 * Math.exp(-((distance/8)**2)) + Math.max(0,height-2.4)*.13));
    shade.lerp(high, Math.min(.7,Math.max(0,height-4)*.1));
    if (i >= (nx+1)*(nz+1)) shade.copy(clay);
    shade.multiplyScalar(.98 + .025 * Math.sin(x*.52 + Math.sin(z*.47)) + .018 * Math.cos(z*.67-x*.22));
    shade.toArray(colors,i*3);
    const gravel=.50*Math.exp(-((distance/6)**2)),stone=.55*Math.min(1,Math.max(0,(height-4.2)/6));
    facies.set([stone,gravel,(1-stone-gravel)*(.42+.28*Math.sin(x*.21-z*.14))],i*3);
  }
  ground.geometry.setAttribute('color',new T.BufferAttribute(colors,3));
  ground.geometry.setAttribute('facies',new T.BufferAttribute(facies,3));
  ground.material=applyEarthScan(createSolidMaterial(b.pop,'land','#ffffff'),'valley',15*s);
  ground.material.vertexColors = true;
  ground.userData.integratedRole = 'fictional-response-terrain';
  ground.userData.interactionFeedback = false;
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i <= nz; i++) {
    const z = 3 + 62*i/nz, x = riverX(z);
    for (const side of [-1,1]) vertices.push(...p([x+side*2.28,1.02,z]));
    if (i) { const j=2*i; indices.push(j-2,j,j-1,j-1,j,j+1); }
  }
  const surface = new T.BufferGeometry();
  surface.setAttribute('position', new T.Float32BufferAttribute(vertices,3));
  surface.setIndex(indices); surface.computeVertexNormals();
  const river = b.mesh(surface,'#658f91',false,false,'water');
  river.userData.integratedRole = 'river-in-fictional-map';
}
