import type { Mesh } from 'three';
import { THREE as T } from './reference/engine.js';
import { applyEarthScan } from './textbook-earth-scan';
import type { TextbookGeometry, Vec3 } from './textbook-geometry';

const seaLevel = 2.28;
const smooth = (lo: number, hi: number, v: number) => T.MathUtils.smoothstep(v, lo, hi);

const jointPlanes = [-2, 9.7, 19.3, 32.5, 49.8, 61.3, 72.1];

/** Preserve the measured Blender portal and stack. Dark clay seams and the
 * spray line run across both the inland headland and its seaward faces. */
export function finishCoastalOutcrop(b: TextbookGeometry, parts: Mesh[], form: 'arch' | 'stack',
  scale: number, back: number, depthScale: number) {
  const point = (x: number, y: number, z: number): Vec3 => [x * scale, y * scale, back + z * depthScale];
  const bedrock = parts.find(m => m.userData.materialRole === 'rock')!;
  const position = bedrock.geometry.attributes.position;
  const original = bedrock.geometry.attributes.color;
  const baked: number[] = [];
  const limestone = new T.Color('#ad967d'), gray = new T.Color('#9a9b8a');
  const wet = new T.Color('#3d463d'), joint = new T.Color('#554d43');
  const tone = new T.Color(), pigment = new T.Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / scale, y = position.getY(i) / scale, z = (position.getZ(i) - back) / depthScale;
    const field = Math.sin(x * .17 + z * .14) * Math.cos(y * .21 - .11 * z);
    const bed = Math.sin(y * .84 + x * .085 + z * .071 + .65 * field);
    pigment.setRGB(original.getX(i),original.getY(i),original.getZ(i));
    tone.copy(limestone).lerp(gray, .37 + .25 * field).lerp(pigment, .29)
      .multiplyScalar(1 + .10 * bed + .034 * Math.sin(z * 1.1 + x * .85));
    const plane = x + .18 * y - .26 * z + .44 * Math.sin(.55 * y) + .33 * Math.sin(.44 * z);
    let fissure = Infinity;
    for (const offset of jointPlanes) fissure = Math.min(fissure, Math.abs(plane - offset));
    const exposure = smooth(2.8, 8, y) * (.68 + .32 * Math.sin(z * .14 + .20 * y));
    tone.lerp(joint, (1 - smooth(.16, 1.12, fissure)) * exposure);
    const tidalLimit = 7.5 + .53 * Math.sin(x * .47 + z * .16) + .38 * Math.cos(z * .54);
    const damp = 1 - smooth(tidalLimit - 1.52, tidalLimit + .64, y);
    tone.lerp(wet, damp * (.84 + .09 * field));
    baked.push(tone.r, tone.g, tone.b);
  }
  bedrock.geometry.setAttribute('color', new T.Float32BufferAttribute(baked, 3));
  const rock = b.materialFor('rock','#ffffff',{vertexColors:true,roughness:.84});
  if (!rock.userData.earthScan) applyEarthScan(rock,'outcrop',13 * scale);
  bedrock.material = rock;
  bedrock.userData.coastalRole = form === 'arch' ? 'through-arch' : 'sea-stack';

  // Rocks gather at the toe of each support. The open water through the arch
  // and the channel between the stack and mainland remain unobstructed.
  const clusters = form === 'arch' ? [[12.6,39.2,3.2], [33.2,47.4,2.9], [69.7,49.2,3.4]]
    : [[16.2,39.8,3.4], [43.3,37.2,2.9], [75.1,49.7,3.1]];
  const chips: number[] = [], chipColors: number[] = [], indices: number[] = [];
  const shardTones = ['#7c7667','#706b5c','#968669','#a0967e'].map(hex => new T.Color(hex));
  let seed = form === 'arch' ? 1931 : 2167;
  function sample() { seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296; }
  for (const [cx, cz, size] of clusters) {
    for (let chip = 0; chip < 12; chip++) {
      const q = chip / 11;
      const cx1 = cx + (sample() - .5) * (4 + 15 * q);
      const cz1 = cz + (sample() - .35) * (2.5 + 6 * q);
      const radius = size * (1 - .78 * q) * (.82 + sample() * .39);
      const tilt = sample() * Math.PI, stretch = .43 + sample() * .41;
      const bottom = seaLevel - .74, height = radius * (.42 + sample() * .52);
      const first = chips.length / 3;
      const angles = Array.from({length:7},(_,k) => (k + sample() * .39) * 2 * Math.PI / 7);
      const lengths = angles.map(() => radius * (.7 + sample() * .30));
      const chipColor = shardTones[Math.floor(sample() * shardTones.length)];
      for (const level of [0, .69, 1]) {
        for (const [k, a] of angles.entries()) {
          const r = lengths[k] * (level === 0 ? .81 : level === 1 ? .65 : 1);
          const dx = Math.cos(a) * r, dz = Math.sin(a) * r * stretch;
          chips.push(...point(cx1 + dx*Math.cos(tilt)-dz*Math.sin(tilt) + .21*radius*level,
            bottom + .54 + height * level + .14 * dx, cz1 + dx*Math.sin(tilt)+dz*Math.cos(tilt)));
          const value = (.58 + .41*level) * (1+.08*Math.cos(a));
          chipColors.push(chipColor.r*value,chipColor.g*value,chipColor.b*value);
        }
      }
      for(let k=0;k<7;k++) {
        const next=(k+1)%7;
        for(let row=0;row<2;row++) {
          const a=first+row*7+k, c=first+row*7+next;
          indices.push(a,a+7,c,c,a+7,c+7);
        }
        if(k>0&&k<6) indices.push(first,first+k,first+k+1,first+14,first+15+k,first+14+k);
      }
    }
  }
  const chipsGeometry = new T.BufferGeometry();
  chipsGeometry.setAttribute('position',new T.Float32BufferAttribute(chips,3));
  chipsGeometry.setAttribute('color',new T.Float32BufferAttribute(chipColors,3));
  chipsGeometry.setIndex(indices); chipsGeometry.computeVertexNormals();
  const talus=b.mesh(chipsGeometry,'#ffffff',false,true,'rock',{vertexColors:true,roughness:.84});
  talus.material=rock; talus.name='岩脚崩积砾石'; talus.userData.coastalRole='shore-talus';
  parts.push(talus);

  // Keep the original bevelled water body. Replace just its two flat top
  // triangles with a matching gently rippled top, with paler shoals at rock feet.
  const water=parts.find(m=>m.userData.materialRole==='water')!;
  const surface=water.geometry, pos=surface.attributes.position, ix=surface.index!;
  const rim:number[]=[], top:number[]=[];
  for(let i=0;i<ix.count;i+=3) {
    const face=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)];
    if(face.every(k=>Math.abs(pos.getY(k)/scale-seaLevel)<.001))top.push(...face);
    else rim.push(...face);
  }
  if(top.length!==6) throw new Error('Expected a planar top on the Blender coastal water casting');
  const xs=top.map(k=>pos.getX(k)/scale),zs=top.map(k=>(pos.getZ(k)-back)/depthScale);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  surface.setIndex(rim);
  const vertices:number[]=[], colors:number[]=[], triangles:number[]=[];
  const deep=new T.Color('#58878a'), shallow=new T.Color('#9fbdb0');
  const nx=70,nz=42;
  const surfaceModes: number[] = [], shoals: number[] = [];
  const minDistance = (x: number, z: number) => Math.min(...clusters.map(([cx,cz]) => Math.hypot((x-cx)*.72,z-cz)));
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=minX+(maxX-minX)*i/nx,z=minZ+(maxZ-minZ)*j/nz;
    const edge=smooth(0,2,Math.min(x-minX,maxX-x,z-minZ,maxZ-z));
    const shoreDistance=minDistance(x,z), shallowWater=1-smooth(2,27,shoreDistance);
    const swell=z*.83+1.27*Math.sin(x*.135)+.05*x+.35*Math.cos(z*.14+x*.11);
    const rebound=z*.73-x*.40+shoreDistance*.20;
    const main=(.13+.072*Math.sin(x*.19-z*.09))*edge;
    const reflected=(.035+.12*shallowWater)*edge;
    const uneven=.027*Math.cos(x*.42+z*.47)*edge;
    surfaceModes.push(main*Math.sin(swell),main*Math.cos(swell),
      reflected*Math.sin(rebound),reflected*Math.cos(rebound));
    shoals.push(shallowWater);
    tone.copy(deep).lerp(shallow,.16+.66*shallowWater+uneven);
    colors.push(tone.r,tone.g,tone.b);
    vertices.push(...point(x,seaLevel+main*Math.sin(swell)+reflected*Math.sin(rebound),z));
    if(i&&j){const k=j*(nx+1)+i;triangles.push(k-nx-2,k-1,k,k-nx-2,k,k-nx-1);}
  }
  const waterTop=new T.BufferGeometry();
  const field = new T.Float32BufferAttribute(vertices,3).setUsage(T.DynamicDrawUsage);
  waterTop.setAttribute('position',field);
  const waterColors = new T.Float32BufferAttribute(colors,3).setUsage(T.DynamicDrawUsage);
  waterTop.setAttribute('color',waterColors);
  waterTop.setIndex(triangles);waterTop.computeVertexNormals();
  const ripples=b.mesh(waterTop,'#ffffff',false,false,'water',{vertexColors:true,roughness:.36,metalness:.035});
  ripples.name='近岸浅水与波纹';ripples.userData.coastalRole='shore-water';parts.push(ripples);

  // Advance and reverse the incident swell and the reflected wave using the
  // hand-driven phase. The cast rim stays level on every edge.
  let lastPhase = -1;
  function updateWaves(phase: number) {
    if (phase === lastPhase) return;
    lastPhase = phase;
    const turn = phase * 2 * Math.PI;
    const c1 = Math.cos(2*turn), s1 = Math.sin(2*turn);
    const c2 = Math.cos(3*turn), s2 = Math.sin(3*turn);
    for(let i=0;i<field.count;i++) {
      const j=i*4;
      const rise = surfaceModes[j]*c1 + surfaceModes[j+1]*s1
        + surfaceModes[j+2]*c2 - surfaceModes[j+3]*s2;
      field.setY(i,scale*(seaLevel+rise));
      const crest = .45 * rise + .14 * shoals[i] * smooth(.11,.26,rise);
      waterColors.setXYZ(i,colors[3*i]*(1+crest),colors[3*i+1]*(1+crest),colors[3*i+2]*(1+crest));
    }
    field.needsUpdate=true;
    waterColors.needsUpdate=true;
    waterTop.computeVertexNormals();
  }
  updateWaves(0);
  return updateWaves;
}

